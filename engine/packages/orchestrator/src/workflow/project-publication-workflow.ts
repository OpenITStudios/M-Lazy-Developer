import type {
  BugReportV2,
} from "../../../bug-report/src/index.js";
import type {
  SelectedMapAuditRun,
} from "../map-audit-pipeline.js";
import type {
  ProjectDeliverableRef,
  ProjectDrivePublishReceipt,
  ProjectRecord,
  ProjectWorkspaceLayout,
} from "../../../project-model/src/index.js";
import {
  buildProjectDrivePublishPlan,
} from "./project-drive-publish-plan.js";
import {
  executeProjectDrivePublishPlan,
  type ProjectDriveUploadAdapter,
} from "./project-drive-publish-executor.js";
import {
  applyDrivePublishReceipt,
  approveProject,
  createDrivePublishReceipt,
  createProjectApprovalSnapshot,
  drivePublicationIsComplete,
} from "./project-lifecycle.js";
import {
  syncApprovedProjectIssueHistory,
} from "./project-history-sync.js";
import {
  assertProjectRecordWritable,
  saveProjectApprovalSnapshot,
  saveProjectDrivePublishReceipt,
  upsertProjectRecord,
} from "./project-record-store.js";

export async function approveAndPersistProject(input: {
  readonly repositoryRoot: string;
  readonly workspace: ProjectWorkspaceLayout;
  readonly project: ProjectRecord;
  readonly deliverables: readonly ProjectDeliverableRef[];
  readonly blockingReasons?: readonly string[];
  readonly requireBugReport?: boolean;
}): Promise<{
  readonly project: ProjectRecord;
  readonly snapshot:
    ReturnType<typeof createProjectApprovalSnapshot>;
}> {
  if (
    input.project.taskClass === "DIAGNOSE" &&
    input.project.knowledge.bugReportPath !== undefined
  ) {
    throw new Error(
      "Audit project with canonical Bug Report must use approveAuditProjectAndPersist() so historical issue sync cannot be skipped.",
    );
  }

  const snapshot =
    createProjectApprovalSnapshot({
      project: input.project,
      deliverables: input.deliverables,
      ...(input.blockingReasons === undefined ? {} : { blockingReasons: input.blockingReasons }),
      ...(input.requireBugReport === undefined ? {} : { requireBugReport: input.requireBugReport }),
    });
  const approved =
    approveProject(
      input.project,
      snapshot,
    );

  await assertProjectRecordWritable(input.repositoryRoot, approved);
  await saveProjectApprovalSnapshot(
    input.workspace,
    snapshot,
  );
  await upsertProjectRecord(
    input.repositoryRoot,
    approved,
  );

  return {
    project: approved,
    snapshot,
  };
}

export async function approveAuditProjectAndPersist(input: {
  readonly repositoryRoot: string;
  readonly workspace: ProjectWorkspaceLayout;
  readonly project: ProjectRecord;
  readonly deliverables: readonly ProjectDeliverableRef[];
  readonly report: BugReportV2;
  readonly reportPath: string;
  readonly audit: SelectedMapAuditRun;
  readonly blockingReasons?: readonly string[];
}): Promise<{
  readonly project: ProjectRecord;
  readonly snapshot:
    ReturnType<typeof createProjectApprovalSnapshot>;
  readonly historicalRegressionIds:
    readonly string[];
}> {
  if (
    input.project.knowledge.bugReportPath !==
      input.reportPath
  ) {
    throw new Error(
      "Audit approval reportPath must match the project canonical Bug Report reference.",
    );
  }

  if (
    input.audit.currentStage !== "COMPLETE"
  ) {
    throw new Error(
      "Audit project approval requires SelectedMapAuditRun currentStage COMPLETE.",
    );
  }
  if (
    input.audit.identity.artifactFingerprint !==
      input.project.artifact.artifactFingerprint
  ) {
    throw new Error(
      "Audit project approval artifact fingerprint does not match the current project.",
    );
  }

  const snapshot =
    createProjectApprovalSnapshot({
      project: input.project,
      deliverables: input.deliverables,
      ...(input.blockingReasons === undefined ? {} : { blockingReasons: input.blockingReasons }),
      requireBugReport: true,
      auditRevision:
        input.audit.auditRevision,
    });
  const approved =
    approveProject(
      input.project,
      snapshot,
    );

  // Immutable approved payload first. No tracked status has changed yet.
  await assertProjectRecordWritable(input.repositoryRoot, approved);
  await saveProjectApprovalSnapshot(
    input.workspace,
    snapshot,
  );

  // Historical incidents are derived only after the explicit approval
  // decision represented by the in-memory approved project.
  const history =
    await syncApprovedProjectIssueHistory({
      repositoryRoot: input.repositoryRoot,
      project: approved,
      report: input.report,
      reportPath: input.reportPath,
    });

  // Project Registry is the final durable commit marker.
  await upsertProjectRecord(
    input.repositoryRoot,
    approved,
  );

  return {
    project: approved,
    snapshot,
    historicalRegressionIds:
      history.historicalRegressionIds,
  };
}

export async function executeAndPersistApprovedDrivePublication(input: {
  readonly repositoryRoot: string;
  readonly workspace: ProjectWorkspaceLayout;
  readonly project: ProjectRecord;
  readonly snapshot:
    ReturnType<typeof createProjectApprovalSnapshot>;
  readonly adapter: ProjectDriveUploadAdapter;
}): Promise<{
  readonly project: ProjectRecord;
  readonly receipt: ProjectDrivePublishReceipt;
  readonly failed:
    Awaited<
      ReturnType<
        typeof executeProjectDrivePublishPlan
      >
    >["failed"];
}> {
  const plan =
    buildProjectDrivePublishPlan({
      project: input.project,
      snapshot: input.snapshot,
    });
  const execution =
    await executeProjectDrivePublishPlan(
      plan,
      input.adapter,
    );
  const recorded =
    await recordAndPersistDrivePublication({
      repositoryRoot:
        input.repositoryRoot,
      workspace: input.workspace,
      project: input.project,
      snapshot: input.snapshot,
      files: execution.files,
    });

  return {
    ...recorded,
    failed: execution.failed,
  };
}

export async function recordAndPersistDrivePublication(input: {
  readonly repositoryRoot: string;
  readonly workspace: ProjectWorkspaceLayout;
  readonly project: ProjectRecord;
  readonly snapshot:
    ReturnType<typeof createProjectApprovalSnapshot>;
  readonly files:
    readonly ProjectDrivePublishReceipt["files"][number][];
}): Promise<{
  readonly project: ProjectRecord;
  readonly receipt: ProjectDrivePublishReceipt;
}> {
  const receipt =
    createDrivePublishReceipt({
      project: input.project,
      snapshot: input.snapshot,
      files: input.files,
    });

  const published = drivePublicationIsComplete(input.snapshot, receipt)
    ? applyDrivePublishReceipt(input.project, input.snapshot, receipt)
    : undefined;
  if (published !== undefined) {
    await assertProjectRecordWritable(input.repositoryRoot, published);
  }
  await saveProjectDrivePublishReceipt(
    input.workspace,
    receipt,
  );

  if (published === undefined) {
    return { project: input.project, receipt };
  }

  await upsertProjectRecord(
    input.repositoryRoot,
    published,
  );

  return {
    project: published,
    receipt,
  };
}
