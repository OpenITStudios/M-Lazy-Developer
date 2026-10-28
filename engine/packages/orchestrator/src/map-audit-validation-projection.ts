import {
  uniqueGameplayCausalLinkScope,
  type GameplayScenarioGraph,
} from "./inspection/gameplay-scenario-model.js";
import type {
  GameplayDefectResolutionGate,
} from "./inspection/gameplay-defect-resolution.js";
import type {
  GameplayCapabilityDeliveryAssessment,
} from "../../diagnostic-reasoning/src/index.js";
import {
  assessReadyResolutionSaturation,
} from "./map-audit-proof-saturation.js";
import {
  projectionContext,
  projectReadyAuditIssues,
  sortIssues,
  type AuditIssueProjection,
  type NeedValidationAuditIssueProjection,
} from "./map-audit-issue-projection.js";

export function projectNeedValidationAuditIssues(
  graph: GameplayScenarioGraph,
  gate: GameplayDefectResolutionGate,
  capabilityDelivery:
    readonly GameplayCapabilityDeliveryAssessment[] = [],
): readonly NeedValidationAuditIssueProjection[] {
  const confirmed = new Set(
    gate.confirmedDefectReadyIds,
  );

  return sortIssues(
    gate.resolutions.flatMap((resolution) => {
      // Check the confirmed-report gate before graph-wide identity scanning.
      // Unresolved obligations are never promoted to gameplay findings; a
      // stale confirmation ID alone still cannot bypass scoped source proof.
      if (!confirmed.has(resolution.causalLinkId) ||
          resolution.disposition !== "CONFIRMED_DEFECT_READY") return [];
      // A stale confirmation index is not permission to translate an
      // ambiguous graph component into a gameplay NEED_VALIDATION finding.
      // Keep identity residue with Scenario Closure and the proof gate.
      const scope = uniqueGameplayCausalLinkScope(
        graph, resolution.causalLinkId,
      );
      if (scope === undefined) return [];
      const causalLink = scope.link;
      // Even a stale confirmation index cannot promote a safe counter-proof,
      // unresolved runtime observation or foreign scenario into a defect.
      if (causalLink?.status !== "CONTRADICTED" ||
          resolution.scenarioId !== causalLink.scenarioId) {
        return [];
      }

      const saturation =
        assessReadyResolutionSaturation(
          graph,
          resolution,
        );
      if (saturation.saturated) {
        return [];
      }

      const context = projectionContext(
        graph,
        resolution.causalLinkId,
        capabilityDelivery,
      );
      if (context === undefined) {
        throw new Error(
          "Confirmation-ready unresolved defect lost its causal-link/scenario owner: " +
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

      const gameplayTrigger =
        resolution.gameplayTrigger?.trim();
      const gameplayConsequence =
        resolution.gameplayConsequence?.trim();
      const expectedOutcome =
        resolution.expectedOutcome?.trim();
      const actualOutcome =
        resolution.actualOutcome?.trim();
      const affectedScope =
        resolution.affectedScope?.trim();

      if (
        !gameplayTrigger ||
        !gameplayConsequence ||
        !expectedOutcome ||
        !actualOutcome ||
        !affectedScope
      ) {
        throw new Error(
          "CONFIRMED_DEFECT_READY resolution lacks the gameplay translation required for a NEED_VALIDATION finding: " +
            resolution.causalLinkId +
            ".",
        );
      }

      const missingCriteria = [
        ...saturation.missingUniversalCriteriaIds,
        ...saturation.missingFamilyCriteriaIds,
      ];
      const counterProofPending = saturation.missingUniversalCriteriaIds
        .includes("counter-proof-cleared");
      // Reuse the exact link-sourced evidence set used for issue taxonomy.
      return [{
        status: "NEED_VALIDATION" as const,
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
        gameplayTrigger,
        gameplayConsequence,
        expectedOutcome,
        actualOutcome,
        affectedScope,
        // Keep provisional report scope aligned with the causal-link owner.
        subjectIds,
        componentIds,
        evidenceIds: [
          ...new Set([
            ...link.evidenceIds,
            ...(resolution.evidenceIds ?? []),
            ...(resolution.counterProofSearch?.evidenceIds ?? []),
          ].filter((id) =>
            authorizedEvidenceIds.has(id))),
        ].sort(),
        ...(link.knowledgeRequirementIds.length
          ? { knowledgeRequirementIds: [...new Set(link.knowledgeRequirementIds)].sort() }
          : {}),
        validationReason: counterProofPending
          ? "A source-grounded contradiction has been translated, but the canonical counter-proof search is incomplete or disputed; a confirmed gameplay defect is not established."
          : "The gameplay contradiction is translated and bounded counter-proof is cleared, but minimum sufficient proof remains unsatisfied.",
        missingProof:
          missingCriteria.length > 0
            ? "Unsatisfied proof criteria: " +
              missingCriteria.join(", ") +
              "."
            : "Minimum sufficient proof remains incomplete.",
        validationTest: counterProofPending
          ? "Resolve the canonical source-scoped counter-proof and only the other missing proof criteria for '" +
            scenario.label + "'. Do not treat an unverified guard as cleared."
          : "Resolve only the unsatisfied proof criteria for '" +
            scenario.label +
            "'. Do not broaden testing or request runtime evidence for already-satisfied dimensions.",
        validationGroupKey:
          scenario.id +
          ":" +
          (
            (link.knowledgeRequirementIds.length
              ? [...new Set(link.knowledgeRequirementIds)].sort().join("+")
              : classification.failureDomain)
          ),
      }];
    }),
  );
}
/**
 * Compatibility alias for callers that previously requested "all" unresolved
 * issues. Audit/model/coverage gaps are no longer coerced into BUG findings;
 * they are owned by deriveAuditObligations().
 */
export function projectAllNeedValidationAuditIssues(
  graph: GameplayScenarioGraph,
  gate: GameplayDefectResolutionGate,
  capabilityDelivery:
    readonly GameplayCapabilityDeliveryAssessment[] = [],
): readonly NeedValidationAuditIssueProjection[] {
  return projectNeedValidationAuditIssues(
    graph,
    gate,
    capabilityDelivery,
  );
}

export function projectAllAuditIssues(
  graph: GameplayScenarioGraph,
  gate: GameplayDefectResolutionGate,
  capabilityDelivery:
    readonly GameplayCapabilityDeliveryAssessment[] = [],
): readonly AuditIssueProjection[] {
  return sortIssues([
    ...projectReadyAuditIssues(
      graph,
      gate,
      capabilityDelivery,
    ),
    ...projectAllNeedValidationAuditIssues(
      graph,
      gate,
      capabilityDelivery,
    ),
  ]);
}
