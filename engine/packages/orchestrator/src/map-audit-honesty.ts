import type {
  GameplayModelClosureResult,
} from "../../gameplay-intent/src/index.js";
import type {
  GameplayCapabilityDeliveryAssessment,
  NegativeSpaceSignal,
  TemporalInteractionRisk,
} from "../../diagnostic-reasoning/src/index.js";
import type {
  GameplayDefectResolutionGate,
} from "./inspection/gameplay-defect-resolution.js";
import type {
  GameplayScenarioGraph,
} from "./inspection/gameplay-scenario-model.js";
import type {
  AuditIssueProjection,
} from "./map-audit-issue-projection.js";
import {
  capabilityDeliveryObligations,
  unresolvedKnowledgeRequirements,
} from "./map-audit-obligations.js";
import type { MandatoryAuditProcedureReceipt } from "./inspection/mandatory-audit-support.js";
import type {
  GameplayDiscoveryChallengeSignal,
} from "./inspection/gameplay-discovery-challenger.js";
import type {
  SharedResourceOwnershipSignal,
} from "./inspection/shared-resource-ownership.js";
import {
  assessReadyResolutionSaturation,
} from "./map-audit-proof-saturation.js";
import type {
  AccumulationGrowthSignal,
  CompoundBoundarySignal,
} from "./inspection/gameplay-compound-growth-analysis.js";

export interface AuditHonestyAssessment {
  readonly policy: "no-hidden-material-finding";
  readonly status: "PASS" | "VIOLATION";
  readonly expectedVisibleResidueIds: readonly string[];
  readonly visibleNeedValidationIds: readonly string[];
  readonly visibleObligationIds: readonly string[];
  readonly expectedProvenIds: readonly string[];
  readonly visibleProvenIds: readonly string[];
  readonly missingVisibleResidueIds: readonly string[];
  readonly missingProvenProjectionIds: readonly string[];
  readonly reasons: readonly string[];
}

function temporalId(
  risk: TemporalInteractionRisk,
): string {
  return (
    "temporal-risk:" +
    risk.leftSystem +
    ":" +
    risk.rightSystem
  );
}

function unresolvedGraphResidueIds(
  graph: GameplayScenarioGraph,
  gate: GameplayDefectResolutionGate,
): readonly string[] {
  const ids = new Set<string>();

  for (const link of graph.causalLinks) {
    if (
      link.status === "RUNTIME_BLOCKED" ||
      link.status === "DETECTION_GAP"
    ) {
      ids.add(link.id);
    }
  }

  for (const id of [
    ...gate.runtimeProofRequiredIds,
    ...gate.detectionGapIds,
    ...gate.gameplayTranslationRequiredIds,
    ...gate.counterProofSearchRequiredIds,
  ]) {
    ids.add(id);
  }

  // Missing, duplicate or empty-evidence receipts are still unresolved
  // even if no non-SATISFIED receipt object exists to iterate.
  for (const { requirement } of unresolvedKnowledgeRequirements(graph)) {
    ids.add("knowledge-gap:" + requirement.id);
  }
  // A receipt without its scenario/domain Knowledge requirement owner is
  // unresolved structural residue even if it advertises SATISFIED.
  for (const receipt of graph.knowledgeReceipts) {
    const owned = graph.knowledgeRequirements.some((requirement) =>
      requirement.id === receipt.requirementId &&
      requirement.scenarioId === receipt.scenarioId &&
      requirement.domain === receipt.domain
    );
    if (receipt.status !== "SATISFIED" || !owned) {
      ids.add("knowledge-gap:" + receipt.requirementId);
    }
  }

  for (const scenario of graph.scenarios) {
    if (
      scenario.composedScenarioIds.length === 0 &&
      scenario.componentIds.length > 0 &&
      scenario.causalLinkIds.length === 0
    ) {
      ids.add(
        "shallow-scenario:" +
          scenario.id,
      );
    }

    if (
      scenario.composedScenarioIds.length === 0 &&
      scenario.componentIds.length === 0
    ) {
      ids.add(
        "scenario-without-components:" +
          scenario.id,
      );
    }
  }

  const scenarioIds = new Set(
    graph.scenarios.map((item) => item.id),
  );
  for (const scenario of graph.scenarios) {
    if (
      scenario.composedScenarioIds.some(
        (id) => !scenarioIds.has(id),
      )
    ) {
      ids.add(
        "incomplete-composition:" +
          scenario.id,
      );
    }
  }

  for (const component of graph.components) {
    if (component.orphan) {
      ids.add(
        "orphan-component:" +
          component.id,
      );
    } else if (!component.gameplayPurpose.trim()) {
      ids.add(
        "missing-purpose:" +
          component.id,
      );
    }
  }

  return [...ids].sort();
}

function unresolvedClosureResidueIds(
  closure: GameplayModelClosureResult,
): readonly string[] {
  const ids = new Set<string>();

  for (const surface of closure.surfaces) {
    if (
      surface.material &&
      (
        surface.status === "unknown" ||
        surface.status === "blocked"
      )
    ) {
      ids.add(
        "closure-surface:" +
          surface.id,
      );
    }
  }

  for (const id of closure.unaccountedSurfaceIds) {
    ids.add(
      "unaccounted-surface:" +
        id,
    );
  }

  if (!closure.stateModelComplete) {
    ids.add("closure-gap:state-model");
  }
  if (!closure.boundariesExtracted) {
    ids.add("closure-gap:boundaries");
  }

  return [...ids].sort();
}

export function assessAuditHonesty(input: {
  readonly graph: GameplayScenarioGraph;
  readonly mandatoryAuditProcedure?: MandatoryAuditProcedureReceipt;
  readonly gate: GameplayDefectResolutionGate;
  readonly gameplayClosure: GameplayModelClosureResult;
  readonly capabilityDelivery:
    readonly GameplayCapabilityDeliveryAssessment[];
  readonly negativeSpace: readonly NegativeSpaceSignal[];
  readonly temporalRisks: readonly TemporalInteractionRisk[];
  readonly discoveryChallenges:
    readonly GameplayDiscoveryChallengeSignal[];
  readonly sharedResourceSignals:
    readonly SharedResourceOwnershipSignal[];
  readonly compoundBoundaries:
    readonly CompoundBoundarySignal[];
  readonly accumulationGrowth:
    readonly AccumulationGrowthSignal[];
  readonly replicaDivergenceIds?: readonly string[];
  readonly visibleIssues: readonly AuditIssueProjection[];
  readonly visibleObligationIds?: readonly string[];
}): AuditHonestyAssessment {
  const expectedVisibleResidueIds = [
    ...new Set([
      ...unresolvedGraphResidueIds(
        input.graph,
        input.gate,
      ),
      ...(input.mandatoryAuditProcedure?.checkpoints.some((item) =>
        item.id === "C9" &&
        item.status !== "CLOSED" &&
        item.status !== "NOT_APPLICABLE"
      ) ? ["mandatory-checkpoint:C9"] : []),
      ...unresolvedClosureResidueIds(
        input.gameplayClosure,
      ),
      ...capabilityDeliveryObligations(input.capabilityDelivery, input.graph).map(
        item => item.id,
      ),
      ...input.negativeSpace.map(
        (signal) => signal.id,
      ),
      ...input.temporalRisks
        .filter(
          (risk) => risk.priority === "high",
        )
        .map(temporalId),
      ...input.discoveryChallenges.map(
        (signal) => signal.id,
      ),
      ...input.sharedResourceSignals.map(
        (signal) => signal.id,
      ),
      ...input.compoundBoundaries.map(
        (signal) => signal.id,
      ),
      ...input.accumulationGrowth.map(
        (signal) => signal.id,
      ),
      ...(input.replicaDivergenceIds ?? []),
    ]),
  ].sort();

  const visibleNeedValidationIds = [
    ...new Set(
      input.visibleIssues
        .filter(
          (item) =>
            item.status ===
            "NEED_VALIDATION",
        )
        .map(
          (item) => item.causalLinkId,
        ),
    ),
  ].sort();

  const confirmedSaturation = new Map(
    input.gate.resolutions
      .filter((resolution) =>
        input.gate.confirmedDefectReadyIds.includes(
          resolution.causalLinkId,
        )
      )
      .map((resolution) => [
        resolution.causalLinkId,
        assessReadyResolutionSaturation(
          input.graph,
          resolution,
        ),
      ]),
  );

  const expectedProvenIds = [
    ...confirmedSaturation.entries(),
  ]
    .filter(([, assessment]) =>
      assessment.saturated
    )
    .map(([id]) => id)
    .sort();

  for (const [id, assessment] of confirmedSaturation) {
    if (!assessment.saturated) {
      expectedVisibleResidueIds.push(id);
    }
  }
  expectedVisibleResidueIds.sort();
  const visibleProvenIds = [
    ...new Set(
      input.visibleIssues
        .filter(
          (item) =>
            item.status === "PROVEN",
        )
        .map(
          (item) => item.causalLinkId,
        ),
    ),
  ].sort();

  const visibleNeedSet = new Set(
    visibleNeedValidationIds,
  );
  const visibleObligationIds = [
    ...new Set(
      input.visibleObligationIds ?? [],
    ),
  ].sort();
  const visibleObligationSet = new Set(
    visibleObligationIds,
  );
  const visibleProvenSet = new Set(
    visibleProvenIds,
  );

  const missingVisibleResidueIds =
    expectedVisibleResidueIds.filter(
      (id) =>
        !visibleNeedSet.has(id) &&
        !visibleObligationSet.has(id),
    );
  const missingProvenProjectionIds =
    expectedProvenIds.filter(
      (id) => !visibleProvenSet.has(id),
    );
  // Honesty must conserve proof in both directions. An unexpected PROVEN
  // projection is not legitimized by covering other audit obligations.
  const expectedProvenSet = new Set(expectedProvenIds);
  const unsupportedVisibleProvenIds = visibleProvenIds.filter(
    (id) => !expectedProvenSet.has(id),
  );

  const reasons: string[] = [];
  if (missingVisibleResidueIds.length > 0) {
    reasons.push(
      "Material unresolved residue is hidden from findings and audit obligations: " +
        missingVisibleResidueIds.join(", ") +
        ".",
    );
  }
  if (missingProvenProjectionIds.length > 0) {
    reasons.push(
      "Confirmed-defect-ready causal links are not visible as PROVEN: " +
        missingProvenProjectionIds.join(", ") +
        ".",
    );
  }
  if (unsupportedVisibleProvenIds.length > 0) {
    reasons.push(
      "Visible PROVEN causal links lack confirmed, saturated proof: " +
        unsupportedVisibleProvenIds.join(", ") +
        ".",
    );
  }
  if (reasons.length === 0) {
    reasons.push(
      "Every tracked material unresolved residue is visible as a causal NEED_VALIDATION finding or an Audit Obligation, and every confirmed-defect-ready causal link is visible as PROVEN.",
    );
  }

  return {
    policy: "no-hidden-material-finding",
    status:
      reasons.length === 1 &&
      missingVisibleResidueIds.length === 0 &&
      missingProvenProjectionIds.length === 0 &&
      unsupportedVisibleProvenIds.length === 0
        ? "PASS"
        : "VIOLATION",
    expectedVisibleResidueIds,
    visibleNeedValidationIds,
    visibleObligationIds,
    expectedProvenIds,
    visibleProvenIds,
    missingVisibleResidueIds,
    missingProvenProjectionIds,
    reasons,
  };
}
