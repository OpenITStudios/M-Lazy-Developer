import type {
  DriveProjectBinding,
  ProjectRecord,
  ProjectWorkspaceLayout,
  WorkSessionAuditBinding,
  WorkSessionCheckpoint,
  WorkSessionStage,
} from "../../../project-model/src/index.js";
import {
  loadWorkSessionCheckpoint,
  saveWorkSessionCheckpoint,
} from "./work-session-store.js";
import {
  createProjectRecord,
  updateProjectRecord,
} from "./project-lifecycle.js";
import {
  loadProjectRecord,
  upsertProjectRecord,
} from "./project-record-store.js";
import type {
  SelectedMapAuditRun,
} from "../map-audit-pipeline.js";

export function workSessionAuditBinding(
  audit: SelectedMapAuditRun,
): WorkSessionAuditBinding {
  return {
    authority: "selected-map-audit",
    auditRevision: audit.auditRevision,
    currentStage: audit.currentStage,
    allowedNextAction: audit.allowedNextAction,
  };
}

/**
 * Coarse session UI/storage projection only. It never authorizes audit work.
 */
export function workSessionStageFromAudit(
  audit: SelectedMapAuditRun,
): WorkSessionStage {
  switch (audit.currentStage) {
    case "TARGET":
    case "DISCOVERY":
      return "new";
    case "UNDERSTAND":
    case "FORMALIZE":
      return "understood";
    case "EVALUATE":
      return "evidence-ready";
    case "PROVE":
      return "diagnosed";
    case "REPORT":
    case "COMPLETE":
      return "deliverable";
  }
}


function auditEvidenceIds(
  audit: SelectedMapAuditRun,
): readonly string[] {
  return [
    ...new Set(
      audit.inspection.mandatoryAuditProcedure.checkpoints.flatMap(
        (checkpoint) => [
          ...checkpoint.evidenceIds,
          ...checkpoint.obligations.flatMap(
            (obligation) => obligation.evidenceIds,
          ),
        ],
      ),
    ),
  ].sort();
}

/**
 * Canonical persistence projection for a selected-map audit.
 * The generic work-session stage is a mirror only; audit authority stays in
 * SelectedMapAuditRun/map-audit-admission.
 */
export function projectSelectedMapAuditWorkSession(input: {
  readonly audit: SelectedMapAuditRun;
  readonly sessionId: string;
  readonly goal: string;
  readonly previous?: WorkSessionCheckpoint;
}): WorkSessionCheckpoint {
  const { audit, previous } = input;

  if (!input.sessionId.trim() || !input.goal.trim()) {
    throw new Error(
      "Audit work-session mirror requires non-empty sessionId and goal.",
    );
  }

  if (
    previous !== undefined &&
    (
      previous.sessionId !== input.sessionId ||
      previous.artifact.artifactId !==
        audit.identity.artifactId ||
      previous.artifact.artifactFingerprint !==
        audit.identity.artifactFingerprint
    )
  ) {
    throw new Error(
      "Refusing to mirror SelectedMapAuditRun into a work session bound to another session/artifact.",
    );
  }

  const scenario =
    audit.inspection.hiddenGameplayDefects.scenarioAudit;

  const candidate: WorkSessionCheckpoint = {
    schemaVersion: 1,
    sessionId: input.sessionId,
    goal: input.goal,
    artifact: {
      artifactId: audit.identity.artifactId,
      artifactFingerprint:
        audit.identity.artifactFingerprint,
      ...(audit.identity.levelName === undefined
        ? {}
        : { label: audit.identity.levelName }),
      ...(audit.identity.releaseVersion === undefined
        ? {}
        : { version: audit.identity.releaseVersion }),
    },
    stage: workSessionStageFromAudit(audit),
    audit: workSessionAuditBinding(audit),
    revision:
      previous?.revision ?? 1,
    references: {
      completedCapabilityIds: [
        ...audit.inspection.gameplayWorld
          .analysisExecution.executedCapabilityIds,
      ].sort(),
      evidenceIds: [...auditEvidenceIds(audit)],
      semanticNodeIds:
        audit.inspection.gameplayIntent.model.nodes
          .map((node) => node.id)
          .sort(),
      proofClaimIds: [
        "audit-revision:" + audit.auditRevision,
        ...[
          ...audit.issueLanes.BUG,
          ...audit.issueLanes.DESIGN_MISMATCH,
        ]
          .filter((finding) =>
            finding.status === "PROVEN"
          )
          .map((finding) =>
            finding.causalLinkId
          ),
      ].sort(),
      validationScenarioIds:
        scenario.graph.scenarios
          .map((item) => item.id)
          .sort(),
    },
    nextActions: [audit.allowedNextAction],
    blockers:
      audit.status === "BLOCKED"
        ? [...audit.reasons].sort()
        : [],
  };

  if (
    previous !== undefined &&
    JSON.stringify(candidate) ===
      JSON.stringify(previous)
  ) {
    return previous;
  }

  return previous === undefined
    ? candidate
    : {
        ...candidate,
        revision: previous.revision + 1,
      };
}
export async function saveSelectedMapAuditWorkSessionMirror(
  workspace: ProjectWorkspaceLayout,
  input: {
    readonly audit: SelectedMapAuditRun;
    readonly sessionId: string;
    readonly goal: string;
    readonly previous?: WorkSessionCheckpoint;
  },
): Promise<WorkSessionCheckpoint> {
  const checkpoint =
    projectSelectedMapAuditWorkSession(input);
  await saveWorkSessionCheckpoint(
    workspace,
    checkpoint,
  );
  return checkpoint;
}

export async function saveSelectedMapAuditProjectContinuity(input: {
  readonly repositoryRoot: string;
  readonly workspace: ProjectWorkspaceLayout;
  readonly audit: SelectedMapAuditRun;
  readonly projectId: string;
  readonly projectName: string;
  readonly sessionId: string;
  readonly goal: string;
  readonly previousSession?: WorkSessionCheckpoint;
  readonly previousProject?: ProjectRecord;
  readonly drive?: DriveProjectBinding;
}): Promise<{
  readonly session: WorkSessionCheckpoint;
  readonly project: ProjectRecord;
}> {
  const previousSession =
    input.previousSession ??
    await loadWorkSessionCheckpoint(
      input.workspace,
    );
  const previousProject =
    input.previousProject ??
    await loadProjectRecord(
      input.repositoryRoot,
      input.projectId,
    );

  const session =
    await saveSelectedMapAuditWorkSessionMirror(
      input.workspace,
      {
        audit: input.audit,
        sessionId: input.sessionId,
        goal: input.goal,
        ...(previousSession === undefined
          ? {}
          : {
              previous:
                previousSession,
            }),
      },
    );

  if (
    previousProject !== undefined &&
    previousProject.projectId !==
      input.projectId
  ) {
    throw new Error(
      "Previous project record belongs to a different projectId.",
    );
  }

  const work = {
    sessionId: session.sessionId,
    workSessionRevision:
      session.revision,
  };

  const artifact = {
    artifactId:
      input.audit.identity.artifactId,
    artifactFingerprint:
      input.audit.identity
        .artifactFingerprint,
    ...(input.audit.identity
      .releaseVersion === undefined
      ? {}
      : {
          version:
            input.audit.identity
              .releaseVersion,
        }),
  };

  const project =
    previousProject === undefined
      ? createProjectRecord({
          projectId: input.projectId,
          projectName:
            input.projectName,
          taskClass: "DIAGNOSE",
          artifact,
          work,
          ...(input.drive === undefined
            ? {}
            : {
                drive:
                  input.drive,
              }),
        })
      : updateProjectRecord(
          previousProject,
          {
            artifact,
            work,
            ...(input.drive === undefined
              ? {}
              : {
                  drive:
                    input.drive,
                }),
          },
        );

  await upsertProjectRecord(
    input.repositoryRoot,
    project,
  );

  return {
    session,
    project,
  };
}
