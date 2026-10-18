import type {
  GameplayScenarioGraph,
} from "./inspection/gameplay-scenario-model.js";
import {
  capabilityDeliveryMatchesScope,
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
  const link = graph.causalLinks.find(
    (item) => item.id === causalLinkId,
  );
  if (link === undefined) return undefined;
  const scenario = graph.scenarios.find(
    (item) => item.id === link.scenarioId,
  );
  if (scenario === undefined) return undefined;

  const subjectIds = [...new Set(link.subjectIds)].sort();
  const componentIds = [...new Set(link.componentIds)].sort();
  // Report taxonomy must not derive its domain from the first matching
  // ID when a Knowledge requirement has foreign or duplicate owners.
  // PROVE uses exactly this unique link-scenario ownership boundary.
  const knowledgeDomains = link.knowledgeRequirementIds.flatMap((id) => {
    const owners = graph.knowledgeRequirements.filter((item) =>
      item.id === id
    );
    return owners.length === 1 &&
      owners[0]?.scenarioId === link.scenarioId
        ? [owners[0].domain]
        : [];
  });
  const relatedDelivery =
    relatedCapabilityDelivery(
      scenario.label,
      subjectIds,
      componentIds,
      capabilityDelivery,
    );
  const playerFacingEvidenceIds = [
    ...new Set(
      relatedDelivery.flatMap(
        (item) => item.playerFacingEvidenceIds,
      ),
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
      relatedDelivery.some(
        (item) => item.informationMismatch,
      ),
    classification,
    issueType: issueTypeFor(
      scenario.label,
      subjectIds,
      componentIds,
      capabilityDelivery,
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
        const link = graph.causalLinks.find(
          (item) =>
            item.id === resolution.causalLinkId,
        );
        return (
        ready.has(resolution.causalLinkId) &&
        resolution.disposition === "CONFIRMED_DEFECT_READY" &&
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
        } = context;
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
          subjectIds: [...new Set([
            ...subjectIds,
            ...(resolution.subjectIds ?? []),
          ])].sort(),
          componentIds: [...new Set([
            ...componentIds,
            ...(resolution.componentIds ?? []),
          ])].sort(),
          evidenceIds: [...new Set([
            ...link.evidenceIds,
            ...(resolution.evidenceIds ?? []),
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
