import { describe, expect, it } from "vitest";
import {
  normalizeProjectRecord,
  normalizeProjectRegistry,
  projectLifecycleStatus,
} from "../src/project/project-lifecycle.js";

function record(): any {
  return {
    schemaVersion: 1,
    projectId: "defense-v2",
    projectName: "Defense V2",
    taskClass: "DIAGNOSE",
    revision: 1,
    artifact: {
      artifactId: "map:defense-v2",
      artifactFingerprint:
        "sha256:map",
    },
    work: {},
    knowledge: {},
    publication: {},
  };
}

describe("project lifecycle contracts", () => {
  it("rejects legacy persisted lifecycle status", () => {
    expect(() =>
      normalizeProjectRecord({
        ...record(),
        status: "approved",
      })
    ).toThrow(
      "Project record contains unsupported or legacy fields.",
    );
  });

  it("requires approval proof before publication proof", () => {
    expect(() =>
      normalizeProjectRecord({
        ...record(),
        publication: {
          drivePublishReceiptFingerprint:
            "sha256:publish",
        },
      })
    ).toThrow(
      "Drive publication proof requires approvalSnapshotFingerprint.",
    );
  });

  it("derives lifecycle from proof fingerprints", () => {
    expect(
      projectLifecycleStatus(
        normalizeProjectRecord(
          record(),
        ),
      ),
    ).toBe("working");

    expect(
      projectLifecycleStatus(
        normalizeProjectRecord({
          ...record(),
          publication: {
            approvalSnapshotFingerprint:
              "sha256:approval",
          },
        }),
      ),
    ).toBe("approved");

    expect(
      projectLifecycleStatus(
        normalizeProjectRecord({
          ...record(),
          publication: {
            approvalSnapshotFingerprint:
              "sha256:approval",
            drivePublishReceiptFingerprint:
              "sha256:publish",
          },
        }),
      ),
    ).toBe("drive-published");
  });

  it("rejects duplicate project ids in registry", () => {
    expect(() =>
      normalizeProjectRegistry({
        schemaVersion: 1,
        projects: [
          record(),
          record(),
        ],
      })
    ).toThrow(
      "Project registry contains duplicate projectId",
    );
  });

  it("rejects different project ids bound to the same artifact", () => {
    expect(() =>
      normalizeProjectRegistry({
        schemaVersion: 1,
        projects: [
          record(),
          {
            ...record(),
            projectId: "defense-alias",
          },
        ],
      })
    ).toThrow(
      "duplicate artifactId",
    );
  });

  it("rejects different projects bound to the same current Drive world", () => {
    const withDrive = {
      ...record(),
      publication: {
        drive: {
          schemaVersion: 1,
          projectId: "defense-v2",
          mapFolder: {
            folderId: "folder:a",
          },
          currentWorld: {
            fileId: "drive:world",
            fileName: "world.mcworld",
            artifactFingerprint:
              "sha256:map",
            version: "1.0.0",
          },
        },
      },
    };
    expect(() =>
      normalizeProjectRegistry({
        schemaVersion: 1,
        projects: [
          withDrive,
          {
            ...withDrive,
            projectId: "other",
            artifact: {
              artifactId: "map:other",
              artifactFingerprint:
                "sha256:other",
            },
            publication: {
              drive: {
                ...withDrive.publication.drive,
                projectId: "other",
              },
            },
          },
        ],
      })
    ).toThrow(
      "duplicate current-world Drive file",
    );
  });

  it("rejects one canonical report path owned by multiple projects", () => {
    const withReport = {
      ...record(),
      knowledge: {
        bugReportPath:
          "workspace/reports/shared.json",
      },
    };
    expect(() =>
      normalizeProjectRegistry({
        schemaVersion: 1,
        projects: [
          withReport,
          {
            ...withReport,
            projectId: "other",
            artifact: {
              artifactId: "map:other",
              artifactFingerprint:
                "sha256:other",
            },
          },
        ],
      })
    ).toThrow(
      "duplicate canonical Bug Report path",
    );
  });
});
