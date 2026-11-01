import { describe, expect, it } from "vitest";
import {
  projectLifecycleStatus,
} from "../../../project-model/src/index.js";
import {
  approveProject,
  applyDrivePublishReceipt,
  assessProjectApprovalReadiness,
  buildProjectDrivePublishPlan,
  createDrivePublishReceipt,
  createProjectApprovalSnapshot,
  createProjectRecord,
  drivePublicationIsComplete,
  updateProjectRecord,
} from "../../src/workflow/index.js";

function baseProject() {
  return createProjectRecord({
    projectId: "defense-v2",
    projectName: "Defense V2",
    taskClass: "DIAGNOSE",
    artifact: {
      artifactId: "map:defense-v2",
      artifactFingerprint: "sha256:map",
      version: "2.0.0",
    },
    work: {
      sessionId: "session:1",
      workSessionRevision: 4,
    },
    drive: {
      schemaVersion: 1,
      projectId: "defense-v2",
      mapFolder: {
        folderId: "drive-folder-1",
      },
    },
  });
}

const deliverables = [{
  kind: "map-audit-report" as const,
  path:
    "workspace/projects/defense-v2/output/audit.html",
  fingerprint: "sha256:audit",
  destinationRole:
    "project-root" as const,
}, {
  kind: "bug-report" as const,
  path:
    "workspace/reports/Defense-v2.0.0-BugReport.json",
  fingerprint: "sha256:report",
  destinationRole:
    "project-root" as const,
}];

function projectWithReport() {
  return updateProjectRecord(
    baseProject(),
    {
      bugReportPath:
        "workspace/reports/Defense-v2.0.0-BugReport.json",
    },
  );
}

function approvedProject() {
  const project = projectWithReport();
  const snapshot =
    createProjectApprovalSnapshot({
      project,
      deliverables,
      requireBugReport: true,
    });
  const approved =
    approveProject(
      project,
      snapshot,
    );
  return {
    project: approved,
    snapshot,
  };
}

describe("project publication lifecycle", () => {
  it("derives publication readiness without persisting another lifecycle state", () => {
    const project = projectWithReport();
    const readiness =
      assessProjectApprovalReadiness({
        project,
        deliverables,
        requireBugReport: true,
      });

    expect(readiness.ready).toBe(true);
    expect(readiness.missing).toEqual([]);
    expect(
      projectLifecycleStatus(project),
    ).toBe("working");
  });

  it("derives approved state only from approval proof", () => {
    const { project } =
      approvedProject();

    expect(
      projectLifecycleStatus(project),
    ).toBe("approved");
    expect(
      project.publication
        .approvalSnapshotFingerprint,
    ).toBeTruthy();
  });

  it("invalidates approval proof when material project work changes", () => {
    const approved =
      approvedProject().project;

    const changed =
      updateProjectRecord(approved, {
        artifact: {
          ...approved.artifact,
          artifactFingerprint:
            "sha256:changed-map",
        },
      });

    expect(
      projectLifecycleStatus(changed),
    ).toBe("working");
    expect(
      changed.publication
        .approvalSnapshotFingerprint,
    ).toBeUndefined();
  });

  it("rejects a forged approval snapshot fingerprint", () => {
    const project = projectWithReport();
    const snapshot =
      createProjectApprovalSnapshot({
        project,
        deliverables,
        requireBugReport: true,
      });

    expect(() =>
      approveProject(
        project,
        {
          ...snapshot,
          snapshotFingerprint:
            "sha256:forged",
        },
      )
    ).toThrow(
      "Project approval snapshot fingerprint is invalid.",
    );
  });

  it("requires approval proof before Drive publication", () => {
    const project = projectWithReport();
    const snapshot =
      createProjectApprovalSnapshot({
        project,
        deliverables,
        requireBugReport: true,
      });

    expect(() =>
      buildProjectDrivePublishPlan({
        project,
        snapshot,
      })
    ).toThrow(
      "Drive publish plan requires derived lifecycle state approved.",
    );
  });

  it("derives incomplete Drive publication from missing approved files", () => {
    const {
      project,
      snapshot,
    } = approvedProject();

    const receipt =
      createDrivePublishReceipt({
        project,
        snapshot,
        files: [{
          kind: "bug-report",
          destinationRole:
            "project-root",
          fileId: "drive-report",
          fileName:
            "Defense - Bug Report.pdf",
          fingerprint:
            "sha256:report",
        }],
      });

    expect(
      drivePublicationIsComplete(
        snapshot,
        receipt,
      ),
    ).toBe(false);
    expect(() =>
      applyDrivePublishReceipt(
        project,
        snapshot,
        receipt,
      )
    ).toThrow(
      "Incomplete Drive publication cannot mark project drive-published.",
    );
  });

  it("derives drive-published only from complete approved publication proof", () => {
    const {
      project,
      snapshot,
    } = approvedProject();

    const receipt =
      createDrivePublishReceipt({
        project,
        snapshot,
        files: [{
          kind: "bug-report",
          destinationRole:
            "project-root",
          fileId: "drive-report",
          fileName:
            "Defense - Bug Report.pdf",
          fingerprint:
            "sha256:report",
        }, {
          kind: "map-audit-report",
          destinationRole:
            "project-root",
          fileId: "drive-audit",
          fileName:
            "Defense - Map Audit.html",
          fingerprint:
            "sha256:audit",
        }],
      });

    expect(
      drivePublicationIsComplete(
        snapshot,
        receipt,
      ),
    ).toBe(true);

    const published =
      applyDrivePublishReceipt(
        project,
        snapshot,
        receipt,
      );

    expect(
      projectLifecycleStatus(
        published,
      ),
    ).toBe("drive-published");
  });
});
