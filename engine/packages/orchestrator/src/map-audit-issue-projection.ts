import {
  uniqueGameplayCausalLinkScope,
  type GameplayScenarioGraph,
} from "./inspection/gameplay-scenario-model.js";
import {
  uniqueScenarioKnowledgeRequirement,
} from "./inspection/gameplay-scenario-knowledge.js";
import {
  capabilityDeliveryMatchesScope,
  type CounterProofSearchDimension,
  type GameplayDefectResolutionGate,
} from "./inspection/gameplay-defect-resolution.js";
import {
  classifyGameplayIssue,
  type GameplayCapabilityDeliveryAssessment,
  type GameplayReportIssueType,
  type GameplayIssueFailureDomain,
  type GameplayIssueFlowStage,
} from "../../diagnostic-reasoning/src/index.js";

export type AuditIssueStatus =
  | "PROVEN"
  | "NEED_VALIDATION";

interface AuditIssueProjectionBase {
  readonly status: AuditIssueStatus;
  readonly issueType: GameplayReportIssueType;
  readonly failureDomain: GameplayIssueFailureDomain;
  readonly contributingDomains:
    readonly GameplayIssueFailureDomain[];
  readonly gameplayFlow: GameplayIssueFlowStage;
  readonly informationMismatch: boolean;
  readonly playerFacingEvidenceIds: readonly string[];
  readonly causalLinkId: string;
  readonly scenarioId: string;
  readonly gameplayStage: string;
  readonly scenarioLabel: string;
  readonly gameplayTrigger: string;
  readonly gameplayConsequence: string;
  readonly expectedOutcome: string;
  readonly actualOutcome: string;
  readonly affectedScope: string;
  readonly subjectIds: readonly string[];
  readonly componentIds: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly knowledgeRequirementIds?: readonly string[];
}

export interface ReadyAuditIssueProjection
  extends AuditIssueProjectionBase {
  readonly status: "PROVEN";
}

export interface NeedValidationAuditIssueProjection
  extends AuditIssueProjectionBase {
  readonly status: "NEED_VALIDATION";
  readonly validationReason: string;
  readonly missingProof: string;
  readonly validationTest: string;
  /** Exact unsatisfied criteria from the canonical saturation owner.
   * Missing proof remains missing; this is an investigation index only.
   */
  readonly missingProofCriteria?: readonly {
    readonly id: string;
    readonly description: string;
    readonly scope: "universal" | "family";
  }[];
  /** Only canonical graph-scope counter-proof dimensions still without an
   * exhaustive source-bound witness; never runtime or missing-bug proof.
   */
  readonly missingCounterProofDimensions?: readonly CounterProofSearchDimension[];
  readonly proofNavigation?: import("./map-audit-proof-navigation.js").AuditProofNavigation;
  /**
   * Stable consolidation key. Multiple unresolved findings with the same key
   * should be exercised by one targeted test rather than repeated manually.
   */
  readonly validationGroupKey: string;
}

export type AuditIssueProjection =
  | ReadyAuditIssueProjection
  | NeedValidationAuditIssueProjection;

import {
  assessReadyResolutionSaturation,
  sourceBoundAuditEvidenceIds,
} from "./map-audit-proof-saturation.js";

export function relatedCapabilityDelivery(
  scenarioLabel: string,
  subjectIds: readonly string[],
  componentIds: readonly string[],
  capabilityDelivery:
    readonly GameplayCapabilityDeliveryAssessment[],
): readonly GameplayCapabilityDeliveryAssessment[] {
  return capabilityDelivery.filter(item =>
    (item.status === "DEGRADED" || item.status === "MISSING") &&
    capabilityDeliveryMatchesScope(
      item.subjectId,
      scenarioLabel,
      subjectIds,
      componentIds,
    )
  );
}

export function issueTypeFor(
  scenarioLabel: string,
  subjectIds: readonly string[],
  componentIds: readonly string[],
  capabilityDelivery:
    readonly GameplayCapabilityDeliveryAssessment[],
): GameplayReportIssueType {
  const related = relatedCapabilityDelivery(
    scenarioLabel,
    subjectIds,
    componentIds,
    capabilityDelivery,
  );

  return related.some(
    (item) =>
      item.issueType ===
      "DESIGN_MISMATCH",
  )
    ? "DESIGN_MISMATCH"
    : "BUG";
}

const GAMEPLAY_FLOW_ORDER: Readonly<
  Record<GameplayIssueFlowStage, number>
> = {
  ENTRY_JOIN: 0,
  READY_START: 1,
  SETUP: 2,
  ACTIVE_GAMEPLAY: 3,
  PROGRESSION: 4,
  TERMINAL: 5,
  CLEANUP_REPLAY: 6,
  RECOVERY: 7,
};

function nonEmpty(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function projectionContext(
  graph: GameplayScenarioGraph,
  causalLinkId: string,
  capabilityDelivery:
    readonly GameplayCapabilityDeliveryAssessment[],
) {
  // A stale gate/confirmation index cannot supply the first matching
  // component, scenario or causal-link owner to the published finding.
  // Use the exact scope used by the canonical PROVE gate.
  const owned = uniqueGameplayCausalLinkScope(graph, causalLinkId);
  if (owned === undefined) return undefined;
  const { link, scenario } = owned;

  const subjectIds = [...new Set(link.subjectIds)].sort();
  const componentIds = [...new Set(link.componentIds)].sort();
  // Report taxonomy must not derive its domain from the first matching
  // ID when a Knowledge requirement has foreign or duplicate owners.
  // PROVE uses exactly this unique link-scenario ownership boundary.
  const knowledgeDomains = link.knowledgeRequirementIds.flatMap((id) => {
    const requirement = uniqueScenarioKnowledgeRequirement(
      graph, id, link.scenarioId,
    );
    return requirement === undefined ? [] : [requirement.domain];
  });
  // A shared subject/arena can participate in several independent causal
  // links. Only capability evidence bound to THIS exact link may change
  // BUG vs DESIGN_MISMATCH or assert player-facing information mismatch.
  // Reuse the same canonical proof/source evidence selector that REPORT
  // already uses, rather than taking a neighbor's capability by name.
  const authorizedEvidenceIds = new Set(
    sourceBoundAuditEvidenceIds(graph, link.id),
  );
  const relatedDelivery = relatedCapabilityDelivery(
    scenario.label,
    subjectIds,
    componentIds,
    capabilityDelivery,
  ).filter(item =>
    item.evidenceIds.some(id => authorizedEvidenceIds.has(id)));
  const playerFacingEvidenceIds = [
    ...new Set(
      relatedDelivery.flatMap(item =>
        item.playerFacingEvidenceIds.filter(id =>
          authorizedEvidenceIds.has(id))),
    ),
  ].sort();
  const classification =
    classifyGameplayIssue({
      gameplayStage: scenario.gameplayStage,
      scenarioLabel: scenario.label,
      componentIds,
      knowledgeDomains,
    });

  return {
    link,
    scenario,
    subjectIds,
    componentIds,
    knowledgeDomains,
    playerFacingEvidenceIds,
    informationMismatch:
      relatedDelivery.some(item => item.informationMismatch) &&
      playerFacingEvidenceIds.length > 0,
    authorizedEvidenceIds,
    classification,
    issueType: issueTypeFor(
      scenario.label,
      subjectIds,
      componentIds,
      relatedDelivery,
    ),
  };
}

export function sortIssues<T extends AuditIssueProjection>(
  issues: readonly T[],
): readonly T[] {
  return [...issues].sort((a, b) =>
    GAMEPLAY_FLOW_ORDER[a.gameplayFlow] -
      GAMEPLAY_FLOW_ORDER[b.gameplayFlow] ||
    a.failureDomain.localeCompare(
      b.failureDomain,
    ) ||
    a.causalLinkId.localeCompare(
      b.causalLinkId,
    )
  );
}

export function projectReadyAuditIssues(
  graph: GameplayScenarioGraph,
  gate: GameplayDefectResolutionGate,
  capabilityDelivery:
    readonly GameplayCapabilityDeliveryAssessment[] = [],
): readonly ReadyAuditIssueProjection[] {
  const ready = new Set(gate.confirmedDefectReadyIds);

  return sortIssues(
    gate.resolutions
      .filter((resolution) => {
        // Most real-map resolution gates contain unresolved/non-reportable
        // work. Reject these before the graph-wide ambiguity/ownership scan;
        // only a confirmation-ready candidate may reach source proof.
        if (!ready.has(resolution.causalLinkId) ||
            resolution.disposition !== "CONFIRMED_DEFECT_READY") return false;
        const link = uniqueGameplayCausalLinkScope(
          graph, resolution.causalLinkId,
        )?.link;
        return (
        link?.status === "CONTRADICTED" &&
        resolution.scenarioId === link.scenarioId &&
        assessReadyResolutionSaturation(
          graph,
          resolution,
        ).saturated &&
        nonEmpty(resolution.scenarioId) &&
        nonEmpty(resolution.gameplayTrigger) &&
        nonEmpty(resolution.gameplayConsequence) &&
        nonEmpty(resolution.expectedOutcome) &&
        nonEmpty(resolution.actualOutcome) &&
        nonEmpty(resolution.affectedScope)
        );
      })
      .flatMap((resolution) => {
        const context = projectionContext(
          graph,
          resolution.causalLinkId,
          capabilityDelivery,
        );
        if (context === undefined) {
          throw new Error(
            "CONFIRMED_DEFECT_READY resolution lost its scenario/causal-link owner: " +
              resolution.causalLinkId +
              ".",
          );
        }
        const {
          link,
          scenario,
          subjectIds,
          componentIds,
          playerFacingEvidenceIds,
          informationMismatch,
          classification,
          issueType,
          authorizedEvidenceIds,
        } = context;
        // The canonical proof-bound ID set was computed once while resolving
        // this link's capability classification; reuse it in REPORT evidence.
        return [{
          status: "PROVEN" as const,
          issueType,
          failureDomain:
            classification.failureDomain,
          contributingDomains:
            classification.contributingDomains,
          gameplayFlow:
            classification.gameplayFlow,
          informationMismatch,
          playerFacingEvidenceIds,
          causalLinkId: resolution.causalLinkId,
          scenarioId: scenario.id,
          gameplayStage: scenario.gameplayStage,
          scenarioLabel: scenario.label,
          gameplayTrigger: resolution.gameplayTrigger!,
          gameplayConsequence: resolution.gameplayConsequence!,
          expectedOutcome: resolution.expectedOutcome!,
          actualOutcome: resolution.actualOutcome!,
          affectedScope: resolution.affectedScope!,
          // The causal link, not a resolution, owns report subjects/components.
          subjectIds,
          componentIds,
          evidenceIds: [...new Set([
            ...link.evidenceIds,
            ...(resolution.evidenceIds ?? []).filter((id) =>
              authorizedEvidenceIds.has(id)),
          ])].sort(),
          ...(link.knowledgeRequirementIds.length === 0
            ? {}
            : {
                // The causal link owns the knowledge obligation; the
                // supplied resolution cannot omit or invent report IDs.
                knowledgeRequirementIds:
                  [...new Set(link.knowledgeRequirementIds)].sort(),
              }),
        }];
      }),
  );
}
