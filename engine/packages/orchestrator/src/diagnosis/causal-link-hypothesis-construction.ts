import type {
  DiagnosticHypothesisSet,
} from "../../../diagnostic-reasoning/src/index.js";
import type {
  GameplayDefectResolution,
} from "../inspection/gameplay-defect-resolution.js";
import {
  uniqueGameplayCausalLinkScope,
  type GameplayScenarioGraph,
} from "../inspection/gameplay-scenario-model.js";
import {
  uniqueScenarioKnowledgeRequirement,
  satisfiedScenarioKnowledgeReceipt,
} from "../inspection/gameplay-scenario-knowledge.js";

export interface CausalLinkHypothesisConstruction {
  causalLinkId: string;
  hypothesisSet: DiagnosticHypothesisSet;
  evidenceIds: readonly string[];
  requiredPredicateIds: readonly string[];
  falsifierPredicateIds: readonly string[];
}

function predicate(
  causalLinkId: string,
  role: "contradiction" | "runtime" | "counterproof" |
    "counterproof-clearance" | "knowledge" | "impact-path",
  ownerId?: string,
): string {
  return [
    "causal-link",
    causalLinkId,
    role,
    ownerId ?? "none",
  ].join(":");
}

export function constructCausalLinkHypothesis(input: {
  graph: GameplayScenarioGraph;
  resolution: GameplayDefectResolution;
}): CausalLinkHypothesisConstruction | undefined {
  // Reuse the same unique causal/scenario/component identity boundary as
  // canonical PROVE. First-match graph lookup can borrow another owner.
  const scope = uniqueGameplayCausalLinkScope(
    input.graph, input.resolution.causalLinkId,
  );
  if (scope === undefined ||
      (input.resolution.scenarioId !== undefined &&
       input.resolution.scenarioId !== scope.scenario.id)) return undefined;
  const { link, scenario } = scope;

  // Keep every authored Knowledge obligation even if no unique matching
  // source requirement or fulfilled receipt exists. Missing proof must
  // remain a required predicate, never silently vanish from reasoning.
  const requiredKnowledgeIds = [...new Set(link.knowledgeRequirementIds)];
  const knowledgeReceipts = requiredKnowledgeIds.flatMap((id) => {
    const owner = uniqueScenarioKnowledgeRequirement(
      input.graph, id, scenario.id,
    );
    const receipt = owner === undefined ? undefined :
      satisfiedScenarioKnowledgeReceipt(input.graph, owner);
    return receipt === undefined ? [] : [receipt];
  });

  const contradiction = predicate(link.id, "contradiction");
  const runtime = input.resolution.disposition === "RUNTIME_PROOF_REQUIRED"
    ? predicate(link.id, "runtime")
    : undefined;
  const knowledgeRequirementPredicates =
    requiredKnowledgeIds.map((id) =>
      predicate(link.id, "knowledge", id)
    );
  const knowledgePredicates =
    knowledgeReceipts
      .flatMap((receipt) => receipt.knowledgeIds)
      .filter((id, index, all) => all.indexOf(id) === index)
      .sort()
      .map((knowledgeId) =>
        predicate(
          link.id,
          "knowledge",
          knowledgeId,
        )
      );
  const impactPath =
    link.impactPathComponentIds.length > 0
      ? predicate(link.id, "impact-path")
      : undefined;
  const counterproof = predicate(link.id, "counterproof");
  const counterproofClearance = predicate(link.id, "counterproof-clearance");

  // A missing counterproof receipt is not proof of NO_BLOCKING_PROOF.
  // Require the canonical bounded search to be complete before assigning
  // full confidence to a causal hypothesis. PROVE still alone admits BUGs.
  const requiredPredicates = [
    contradiction,
    ...(impactPath ? [impactPath] : []),
    ...(runtime ? [runtime] : []),
    ...knowledgeRequirementPredicates,
    ...knowledgePredicates,
    counterproofClearance,
  ];
  const falsifierPredicates = [counterproof];

  return {
    causalLinkId: link.id,
    hypothesisSet: {
      schemaVersion: 1,
      id: "causal-link-hypothesis:" + link.id,
      hypotheses: [{
        id: "causal-link-defect:" + link.id,
        statement:
          "The contradicted dependency '" + link.purpose +
          "' causes the observed scenario outcome for '" +
          scenario.purpose + "'.",
        requiredPredicates,
        falsifierPredicates,
      }],
    },
    evidenceIds: [...new Set([
      ...link.evidenceIds,
      ...link.impactPathEvidenceIds,
      ...knowledgeReceipts.flatMap(
        (receipt) => receipt.evidenceIds,
      ),
      ...(input.resolution.evidenceIds ?? []),
      ...(input.resolution.counterProofSearch?.evidenceIds ?? []),
    ])].sort(),
    requiredPredicateIds: requiredPredicates,
    falsifierPredicateIds: falsifierPredicates,
  };
}
