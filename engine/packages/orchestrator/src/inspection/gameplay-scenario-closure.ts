import type {
  GameplayScenarioClosure,
  GameplayScenarioGraph,
} from "./gameplay-scenario-model.js";
import {
  satisfiedScenarioKnowledgeReceipt,
  uniqueScenarioKnowledgeRequirement,
} from "./gameplay-scenario-knowledge.js";

export function assessGameplayScenarioClosure(
  graph: GameplayScenarioGraph,
  unmodeledSourceChallengeIds: readonly string[] = [],
): GameplayScenarioClosure {
  const orphanComponentIds = graph.components
    .filter((component) => component.orphan)
    .map((component) => component.id)
    .sort();

  const missingPurposeComponentIds = graph.components
    .filter((component) => !component.gameplayPurpose.trim())
    .map((component) => component.id)
    .sort();

  const scenarioLabels = new Map(
    graph.scenarios.map((scenario) => [scenario.id, scenario.label]),
  );

  const runtimeBlockedCausalLinks = graph.causalLinks
    .filter((edge) => edge.status === "RUNTIME_BLOCKED")
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id));
  const runtimeBlockedCausalLinkIds =
    runtimeBlockedCausalLinks.map((edge) => edge.id);
  const runtimeProofRequests =
    runtimeBlockedCausalLinks.map((edge) => {
      const scenarioLabel =
        scenarioLabels.get(edge.scenarioId) ?? edge.scenarioId;
      return {
        causalLinkId: edge.id,
        scenarioId: edge.scenarioId,
        runtimeReason: edge.reason,
        narrowRuntimeQuestion:
          "In scenario '" +
          scenarioLabel +
          "', does the runtime satisfy this required dependency: " +
          edge.purpose +
          "?",
        evidenceIds: [...edge.evidenceIds],
      };
    });

  const detectionGapCausalLinks = graph.causalLinks
    .filter((edge) => edge.status === "DETECTION_GAP")
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id));
  const detectionGapCausalLinkIds =
    detectionGapCausalLinks.map((edge) => edge.id);
  const detectionGapTestRequests =
    detectionGapCausalLinks.map((edge) => {
      const scenarioLabel =
        scenarioLabels.get(edge.scenarioId) ?? edge.scenarioId;
      return {
        causalLinkId: edge.id,
        scenarioId: edge.scenarioId,
        gapReason: edge.reason,
        narrowTestQuestion:
          "In scenario '" +
          scenarioLabel +
          "', resolve this unresolved dependency from selected-artifact source, ownership, reachability, lifecycle, cross-domain, or formal evidence first: " +
          edge.purpose +
          ". Do not request Minecraft/player execution unless the unresolved fact is later reclassified as explicitly runtime-native.",
        evidenceIds: [...edge.evidenceIds],
      };
    });

  const unresolvedCausalLinkIds = graph.causalLinks
    .filter(
      (edge) =>
        edge.status === "RUNTIME_BLOCKED" ||
        edge.status === "DETECTION_GAP",
    )
    .map((edge) => edge.id)
    .sort();

  // Scenario closure and D1/PROVE must agree on receipt authority.
  // A missing, duplicate, detached, or evidence-free SATISFIED receipt is
  // unresolved even if no explicit MISSING_REQUIRED_KNOWLEDGE row exists.
  const missingRequiredKnowledgeIds = [
    ...new Set([
      ...graph.knowledgeRequirements
        .filter((required) =>
          satisfiedScenarioKnowledgeReceipt(graph, required) === undefined
        )
        .map((required) => required.id),
      ...graph.knowledgeReceipts
        .filter((receipt) =>
          !graph.knowledgeRequirements.some((required) =>
            required.id === receipt.requirementId &&
            required.scenarioId === receipt.scenarioId &&
            required.domain === receipt.domain
          )
        )
        .map((receipt) => receipt.requirementId),
    ]),
  ].sort();

  const prerequisiteBlockedKnowledgeIds =
    graph.knowledgeReceipts
      .filter(
        (receipt) =>
          receipt.status ===
          "BLOCKED_BY_PREREQUISITE",
      )
      .map((receipt) => receipt.requirementId)
      .sort();

  const capabilityGapKnowledgeIds =
    graph.knowledgeReceipts
      .filter(
        (receipt) =>
          receipt.status === "CAPABILITY_GAP",
      )
      .map((receipt) => receipt.requirementId)
      .sort();

  const scenarioIds = new Set(
    graph.scenarios.map((scenario) => scenario.id),
  );
  const incompleteCompositionScenarioIds =
    graph.scenarios
      .filter(
        (scenario) =>
          scenario.composedScenarioIds.some(
            (id) => !scenarioIds.has(id),
          ),
      )
      .map((scenario) => scenario.id)
      .sort();

  const componentIds = new Set(graph.components.map((item) => item.id));
  const causalLinkIds = new Set(graph.causalLinks.map((item) => item.id));
  const invalidScenarioBindings = graph.scenarios
    .filter((scenario) =>
      scenario.componentIds.some((id) => !componentIds.has(id)) ||
      scenario.causalLinkIds.some((id) => !causalLinkIds.has(id)) ||
      scenario.requiredKnowledgeIds.some((id) =>
        uniqueScenarioKnowledgeRequirement(graph, id, scenario.id) === undefined))
    .map((scenario) => scenario.id).sort();
  const invalidCausalLinks = graph.causalLinks
    .filter((edge) =>
      !scenarioIds.has(edge.scenarioId) ||
      !componentIds.has(edge.fromComponentId) ||
      !componentIds.has(edge.toComponentId) ||
      edge.knowledgeRequirementIds.some((id) =>
        uniqueScenarioKnowledgeRequirement(graph, id, edge.scenarioId) === undefined))
    .map((edge) => edge.id).sort();
  const scenarioComponents = new Map(
    graph.scenarios.map((scenario) => [scenario.id, new Set(scenario.componentIds)]),
  );
  const scenarioCausalLinks = new Map(
    graph.scenarios.map((scenario) => [scenario.id, new Set(scenario.causalLinkIds)]),
  );
  const causalLinksOutsideScenarioBindings = graph.causalLinks
    .filter((edge) => {
      const components = scenarioComponents.get(edge.scenarioId);
      const links = scenarioCausalLinks.get(edge.scenarioId);
      return components !== undefined && links !== undefined &&
        (!components.has(edge.fromComponentId) ||
         !components.has(edge.toComponentId) ||
         !links.has(edge.id));
    })
    .map((edge) => edge.id).sort();
  const invalidKnowledgeRequirements = graph.knowledgeRequirements
    .filter((item) =>
      !scenarioIds.has(item.scenarioId) ||
      item.componentIds.some((id) => !componentIds.has(id)) ||
      item.dependsOnRequirementIds.some((id) =>
        uniqueScenarioKnowledgeRequirement(graph, id, item.scenarioId) === undefined) ||
      !graph.scenarios.some((scenario) =>
        scenario.id === item.scenarioId &&
        scenario.requiredKnowledgeIds.includes(item.id)))
    .map((item) => item.id).sort();

  const scenarioWithoutComponents = graph.scenarios
    .filter((scenario) => scenario.componentIds.length === 0)
    .map((scenario) => scenario.id)
    .sort();

  const unprovenLeafScenarioIds = graph.scenarios
    .filter(
      (scenario) =>
        scenario.composedScenarioIds.length === 0 &&
        scenario.componentIds.length > 0 &&
        scenario.causalLinkIds.length === 0,
    )
    .map((scenario) => scenario.id)
    .sort();

  // Candidate journeys are bounded source hypotheses, not a proven playthrough.
  // A budget cutoff or unjoined source relation cannot silently become CLOSED.
  const incompleteJourneyIds = (graph.gameplayJourneyCandidates ?? [])
    .filter(candidate => candidate.boundary === "DEPTH_LIMIT" ||
      candidate.boundary === "SOURCE_JOIN_UNPROVEN")
    .map(candidate => candidate.id).sort();
  const unresolvedSourceIds = [...new Set(unmodeledSourceChallengeIds)].sort();
  const journeyTruncated = graph.gameplayJourneyTruncated === true;
  const reasons: string[] = [];
  if (journeyTruncated) {
    reasons.push("Source journey exploration hit its path/depth budget; whole-game scenario closure is not established.");
  }
  if (incompleteJourneyIds.length > 0) {
    reasons.push("Source journeys have unproven cross-source joins or depth boundaries: " + incompleteJourneyIds.join(", "));
  }
  if (unresolvedSourceIds.length > 0) {
    reasons.push("Material selected-artifact execution/state evidence remains unmodeled by Intent and Scenario: " + unresolvedSourceIds.join(", "));
  }
  if (causalLinksOutsideScenarioBindings.length > 0) reasons.push("Causal links reference components or link IDs outside their owning scenario: " + causalLinksOutsideScenarioBindings.join(", "));

  if (invalidScenarioBindings.length) reasons.push("Missing scenario bindings: " + invalidScenarioBindings.join(", "));
  if (invalidCausalLinks.length) reasons.push("Invalid causal links: " + invalidCausalLinks.join(", "));
  if (invalidKnowledgeRequirements.length) reasons.push("Invalid knowledge dependencies: " + invalidKnowledgeRequirements.join(", "));
  if (graph.scenarios.length === 0) {
    reasons.push("No material gameplay scenarios were compiled.");
  }
  if (orphanComponentIds.length > 0) {
    reasons.push(
      "Gameplay/technical components exist without a scenario correlation: " +
      orphanComponentIds.join(", ") + ".",
    );
  }
  if (missingPurposeComponentIds.length > 0) {
    reasons.push(
      "Components are missing a gameplay purpose: " +
      missingPurposeComponentIds.join(", ") + ".",
    );
  }
  if (detectionGapCausalLinkIds.length > 0) {
    reasons.push(
      "Causal gameplay links remain unproven and require source-first detection/proof work: " +
      detectionGapCausalLinkIds.join(", ") +
      ". They remain explicit gray-zone evidence and must not be treated as safe or converted directly into player testing.",
    );
  }
  if (missingRequiredKnowledgeIds.length > 0) {
    reasons.push(
      "Required gameplay Knowledge lacks a unique scenario/domain-scoped, evidenced SATISFIED receipt or contains detached receipts: " +
        missingRequiredKnowledgeIds.join(", ") +
        ".",
    );
  }
  if (prerequisiteBlockedKnowledgeIds.length > 0) {
    reasons.push(
      "Required inspection nodes are blocked by unsatisfied prerequisite nodes: " +
        prerequisiteBlockedKnowledgeIds.join(", ") +
        ".",
    );
  }
  if (capabilityGapKnowledgeIds.length > 0) {
    reasons.push(
      "Required gameplay knowledge has no registered analysis capability: " +
        capabilityGapKnowledgeIds.join(", ") +
        ".",
    );
  }
  if (incompleteCompositionScenarioIds.length > 0) {
    reasons.push(
      "Composition scenarios reference missing child scenarios: " +
        incompleteCompositionScenarioIds.join(", ") +
        ".",
    );
  }
  if (scenarioWithoutComponents.length > 0) {
    reasons.push(
      "Scenario variants are present without concrete selected-artifact component bindings: " +
      scenarioWithoutComponents.join(", ") + ".",
    );
  }
  if (unprovenLeafScenarioIds.length > 0) {
    reasons.push(
      "Leaf gameplay scenarios contain selected-artifact components but no causal proof links; audit depth is suspiciously shallow: " +
        unprovenLeafScenarioIds.join(", ") +
        ".",
    );
  }
  if (runtimeBlockedCausalLinkIds.length > 0) {
    reasons.push(
      "Some causal links require irreducible Minecraft runtime proof.",
    );
  }

  const status =
    graph.scenarios.length === 0 ||
    journeyTruncated ||
    incompleteJourneyIds.length > 0 ||
    unresolvedSourceIds.length > 0 ||
    invalidScenarioBindings.length > 0 ||
    invalidCausalLinks.length > 0 ||
    causalLinksOutsideScenarioBindings.length > 0 ||
    invalidKnowledgeRequirements.length > 0 ||
    orphanComponentIds.length > 0 ||
    missingPurposeComponentIds.length > 0 ||
    detectionGapCausalLinkIds.length > 0 ||
    missingRequiredKnowledgeIds.length > 0 ||
    capabilityGapKnowledgeIds.length > 0 ||
    prerequisiteBlockedKnowledgeIds.length > 0 ||
    incompleteCompositionScenarioIds.length > 0 ||
    scenarioWithoutComponents.length > 0 ||
    unprovenLeafScenarioIds.length > 0
      ? "OPEN" as const
      : runtimeBlockedCausalLinkIds.length > 0
        ? "PARTIAL" as const
        : "CLOSED" as const;

  if (status === "CLOSED") {
    reasons.push(
      "Every compiled gameplay component has a gameplay purpose and scenario correlation, every required knowledge domain returned an execution receipt, and every causal link is resolved.",
    );
  }

  return {
    status,
    orphanComponentIds,
    missingPurposeComponentIds,
    unresolvedCausalLinkIds,
    runtimeBlockedCausalLinkIds,
    runtimeProofRequests,
    detectionGapCausalLinkIds,
    detectionGapTestRequests,
    missingRequiredKnowledgeIds,
    capabilityGapKnowledgeIds,
    prerequisiteBlockedKnowledgeIds,
    incompleteCompositionScenarioIds,
    unprovenLeafScenarioIds,
    reasons,
  };
}
