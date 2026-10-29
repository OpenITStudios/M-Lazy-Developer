import { createHash } from "node:crypto";
import type {
  SelectedMapAuditAdmission,
} from "./map-audit-admission.js";
import type {
  MandatoryAuditProcedureReceipt,
} from "./inspection/mandatory-audit-procedure.js";
import type {
  GameplayScenarioGraph,
} from "./inspection/gameplay-scenario-model.js";
import type {
  GameplayDefectResolutionGate,
} from "./inspection/gameplay-defect-resolution.js";
import type {
  SelectedMapAuditIdentity,
} from "./map-audit-identity.js";
import type {
  AuditUserIntentEnvelope,
} from "./map-audit-user-intent.js";

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, canonical(child)]),
    );
  }
  return value;
}

export function deriveSelectedMapAuditRevision(input: {
  readonly identity: SelectedMapAuditIdentity;
  readonly admission: SelectedMapAuditAdmission;
  readonly procedure: MandatoryAuditProcedureReceipt;
  readonly graph: GameplayScenarioGraph;
  readonly defectResolution: GameplayDefectResolutionGate;
  /** Current operator intent is task/response scope, not gameplay proof. */
  readonly userIntent?: AuditUserIntentEnvelope;
}): string {
  const basis = {
    schemaVersion: 1,
    identity: input.identity,
    // Two questions about the SAME immutable map can require different
    // source navigation, exclusions and deciding-proof tasks. A response to
    // the prior question must not be admitted solely because graph IDs and
    // artifact SHA stayed unchanged. User input is guidance, never evidence.
    userIntent: input.userIntent ?? null,
    admission: {
      status: input.admission.status,
      firstBlockingStage:
        input.admission.firstBlockingStage ?? null,
      issues: input.admission.issues,
    },
    procedure: {
      status: input.procedure.status,
      blockingCheckpointIds:
        input.procedure.blockingCheckpointIds,
      // A checkpoint packet sends its label, reason and evidence to the
      // model. Binding only ID/status lets stale responses survive a changed
      // task decision even when the checkpoint remains blocked.
      checkpoints: input.procedure.checkpoints,
    },
    // Model responses are authorized against this revision. Bind the entire
    // canonical causal/proof core, not a lossy pick of its fields: scenario
    // ownership, link-to-scenario scope, impact-path evidence, required
    // knowledge and receipt provenance can all change without an ID change.
    // Exclude only derived navigation/rendering fields; they cannot create
    // source authority or independently authorize a proof resolution.
    scenario: {
      scenarios: input.graph.scenarios,
      components: input.graph.components,
      causalLinks: input.graph.causalLinks,
      knowledgeRequirements: input.graph.knowledgeRequirements,
      knowledgeReceipts: input.graph.knowledgeReceipts,
      // Admission of a previously unknown typed source relation changes
      // what the next model task is allowed to assume or investigate.
      // Source relations are navigation only, but response freshness must
      // still be bound to the newly known source scope.
      reviewedSourceRelationships: input.graph.reviewedSourceRelationships ?? [],
    },
    // PROVE tasks and publication also depend on the gate's routing lists,
    // status and issues. Resolution objects alone do not bind that context.
    defectResolution: input.defectResolution,
  };

  return createHash("sha256")
    .update(JSON.stringify(canonical(basis)))
    .digest("hex");
}
