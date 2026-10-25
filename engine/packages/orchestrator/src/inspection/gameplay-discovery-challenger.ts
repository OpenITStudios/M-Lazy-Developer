import {
  semanticIrExecutionTraces,
  type SemanticIr,
} from "../../../semantic-ir/src/index.js";
import {
  reconcileSourceStateOutcomes,
  reconcileSourceResourceOutcomes,
  reconcileSourceWorldEffectOutcomes,
} from "../../../behavior-model/src/index.js";
import type {
  GameplayIntentModel,
} from "../../../gameplay-intent/src/index.js";
import {
  sourceLocatorMatchesSourceRef,
  type SourceRef,
} from "../../../project-model/src/index.js";
import {
  deriveObservedGameplaySourceRelationships,
  type GameplayScenarioGraph,
} from "./gameplay-scenario-model.js";

export interface GameplayDiscoveryChallengeSignal {
  readonly id: string;
  readonly kind:
    | "unowned-state-operation"
    | "unowned-return-outcome"
    | "unowned-resource-action"
    | "unowned-execution-region"
    | "unresolved-execution-edge"
    | "unowned-execution-edge"
    | "unowned-temporal-relation"
    | "unmodeled-source-relationship";
  readonly subjectId: string;
  readonly evidenceIds: readonly string[];
  readonly reason: string;
}

/** An evidence ID shared by two source records has no unique owner. */
function uniquelySelectedEvidence(
  intent: GameplayIntentModel,
): ReadonlyMap<string, GameplayIntentModel["evidence"][number]> {
  const counts = new Map<string, number>();
  for (const item of intent.evidence) {
    counts.set(item.id, (counts.get(item.id) ?? 0) + 1);
  }
  const selected = new Map<string, GameplayIntentModel["evidence"][number]>();
  for (const item of intent.evidence) {
    if (item.scope === "selected-artifact" && counts.get(item.id) === 1) {
      selected.set(item.id, item);
    }
  }
  return selected;
}

function usedEvidenceIds(
  intent: GameplayIntentModel,
  graph: GameplayScenarioGraph,
  selected: ReadonlyMap<string, GameplayIntentModel["evidence"][number]>,
): ReadonlySet<string> {
  // Do not close an IR obligation from unregistered or duplicate IDs.
  const groundedIds = new Set(selected.keys());
  const authoredEvidenceIds = new Set([
    ...intent.nodes.filter(node => node.status === "authored")
      .flatMap(node => node.evidenceIds),
    ...intent.edges.filter(edge => edge.status === "authored")
      .flatMap(edge => edge.evidenceIds),
  ]);
  // Scenario composition must consume the same exact evidence identity.
  // A stranded intent fact is not proof of a modeled gameplay path.
  // Neither component placement nor unproven links establish a gameplay path.
  const components = new Set(graph.components.map(component => component.id));
  const scenarios = new Map<string, GameplayScenarioGraph["scenarios"][number][]>();
  const causalIdCounts = new Map<string, number>();
  for (const scenario of graph.scenarios) {
    const owned = scenarios.get(scenario.id) ?? [];
    owned.push(scenario);
    scenarios.set(scenario.id, owned);
  }
  for (const link of graph.causalLinks) {
    causalIdCounts.set(link.id, (causalIdCounts.get(link.id) ?? 0) + 1);
  }
  const scenarioEvidenceIds = new Set(graph.causalLinks
    .filter(link => {
      const owned = scenarios.get(link.scenarioId) ?? [];
      const owner = owned.length === 1 ? owned[0] : undefined;
      // Duplicate graph owners cannot claim selected source evidence.
      // Keep the same unique causal-link/scenario identity as PROVE.
      return link.status === "PROVEN" &&
        causalIdCounts.get(link.id) === 1 &&
        owner !== undefined &&
        owner.causalLinkIds.includes(link.id) &&
        owner.componentIds.includes(link.fromComponentId) &&
        owner.componentIds.includes(link.toComponentId) &&
        components.has(link.fromComponentId) &&
        components.has(link.toComponentId);
    })
    .flatMap(link => link.evidenceIds));
  return new Set([...authoredEvidenceIds].filter(id =>
    groundedIds.has(id) && scenarioEvidenceIds.has(id)));
}

/**
 * Challenges Discovery Closure from the opposite direction:
 * raw executable/state evidence must not disappear merely because no semantic
 * owner was reconstructed for it.
 */
export function challengeGameplayDiscovery(input: {
  readonly semanticIr: SemanticIr;
  readonly intent: GameplayIntentModel;
  readonly graph: GameplayScenarioGraph;
}): readonly GameplayDiscoveryChallengeSignal[] {
  const selected = uniquelySelectedEvidence(input.intent);
  const evidence = usedEvidenceIds(
    input.intent,
    input.graph,
    selected,
  );
  const output: GameplayDiscoveryChallengeSignal[] = [];
  const evidenceLocations = new Map([...selected.values()]
    .map(item => [item.id, item.locator.replaceAll("\\", "/")] as const));
  const matchesSource = (id: string, source: SourceRef): boolean => {
    const locator = evidenceLocations.get(id);
    // An older selected map may reuse the same path and ID. When the
    // source model identifies this artifact, require that exact identity.
    if (!evidence.has(id) || locator === undefined ||
        (input.intent.artifactId !== undefined &&
          input.intent.artifactId !== source.artifactId)) return false;
    // A source locator cannot borrow an unrelated same-file operation
    // or JSON member when the IR has a precise authored-site witness.
    return sourceLocatorMatchesSourceRef(locator, {
      ...source,
      relativePath: source.relativePath.replaceAll("\\", "/"),
    });
  };

  for (const operation of input.semanticIr.state.operations) {
    // Surface ownership alone does not account for every state mutation.
    // Require the individual operation to be consumed as evidence.
    if (matchesSource(operation.id, operation.source)) {
      continue;
    }
    output.push({
      id: "discovery-challenge:state:" + operation.id,
      kind: "unowned-state-operation",
      subjectId: operation.surfaceId,
      evidenceIds: [operation.id],
      reason:
        "Semantic IR contains a material state operation that is not consumed by gameplay intent/scenario evidence. Its gameplay meaning may be missing from discovery.",
    });
  }

  for (const outcome of input.semanticIr.execution.outcomes ?? []) {
    if (matchesSource(outcome.id, outcome.source)) continue;
    output.push({
      id: "discovery-challenge:outcome:" + outcome.id,
      kind: "unowned-return-outcome",
      subjectId: outcome.executionRegionId,
      evidenceIds: [outcome.id],
      reason:
        "An authored function return value is not reconciled with a gameplay scenario; its property/value cannot establish a win/loss or player-visible outcome.",
    });
  }

  for (const action of input.semanticIr.state.resourceActions ?? []) {
    if (matchesSource(action.id, action.source)) continue;
    output.push({
      id: "discovery-challenge:resource:" + action.id,
      kind: "unowned-resource-action",
      subjectId: action.executionRegionId,
      evidenceIds: [action.id],
      reason:
        "An authored acquire/release action is not reconciled with a gameplay scenario; it does not by itself prove cleanup or successful reset.",
    });
  }

  // A consumed state mutation does not prove ownership of the whole
  // executable region, which may contain other unmodeled behavior.
  const ownedRegions = new Set(
    input.semanticIr.execution.regions
      .filter((region) => region.source !== undefined &&
        matchesSource(region.id, region.source))
      .map((region) => region.id),
  );
  for (const region of input.semanticIr.execution.regions) {
    if (ownedRegions.has(region.id)) {
      continue;
    }
    output.push({
      id: "discovery-challenge:region:" + region.id,
      kind: "unowned-execution-region",
      subjectId: region.id,
      evidenceIds: [region.id],
      reason:
        "Authored execution region is present in Semantic IR but lacks an exact gameplay/scenario evidence owner; source presence alone does not prove activation or meaning.",
    });
  }

  for (const edge of input.semanticIr.execution.edges) {
    if (edge.resolution === "resolved" && matchesSource(edge.id, edge.source)) {
      continue;
    }
    const unresolved = edge.resolution === "unresolved";
    output.push({
      id: "discovery-challenge:edge:" + edge.id,
      kind: unresolved
        ? "unresolved-execution-edge"
        : "unowned-execution-edge",
      subjectId: edge.from,
      evidenceIds: [edge.id],
      reason: unresolved
        ? "Execution edge target is unresolved, so downstream gameplay effects may exist outside the current semantic graph."
        : "Resolved execution edge is not consumed by gameplay intent/scenario evidence; target resolution alone does not establish its gameplay meaning.",
    });
  }

  for (const relation of input.semanticIr.temporal.relations) {
    // A generation guard proves a scheduling safety property, not that
    // the temporal relation has a gameplay/scenario owner.
    const relatedEvidence = matchesSource(relation.id, relation.source);
    // Evidence ownership cannot turn an unresolved scheduler target into
    // a resolved execution path.
    if (relatedEvidence && relation.resolution === "resolved") continue;
    output.push({
      id: "discovery-challenge:temporal:" + relation.id,
      kind: "unowned-temporal-relation",
      subjectId: relation.from,
      evidenceIds: [relation.id],
      reason: relation.resolution === "unresolved"
        ? "Deferred/periodic target remains unresolved even when the relation is referenced by gameplay evidence."
        : "Deferred/periodic relation is not semantically owned by a gameplay scenario, so stale work or hidden lifecycle effects may be missed.",
    });
  }


  // A map's two technical records may each appear on a different PROVEN
  // scenario link while their observed source relationship has no owner.
  // Challenge the *pair*, not just its members. When either member is
  // unowned, its existing single-record challenge already preserves the gap.
  const ownedOutcomes = (input.semanticIr.execution.outcomes ?? []).some(item =>
    matchesSource(item.id, item.source));
  const hasOwnedPrecursor = ownedOutcomes && (
    input.semanticIr.execution.regions.some(item => item.source &&
      matchesSource(item.id, item.source)) ||
    input.semanticIr.execution.edges.some(item =>
      item.resolution === "resolved" &&
      matchesSource(item.id, item.source)) ||
    input.semanticIr.state.operations.some(item =>
      matchesSource(item.id, item.source)) ||
    (input.semanticIr.state.resourceActions ?? []).some(item =>
      matchesSource(item.id, item.source)) ||
    (input.semanticIr.execution.worldEffects ?? []).some(item =>
      matchesSource(item.id, item.source))
  );
  if (hasOwnedPrecursor) {
    const sourceRelations = deriveObservedGameplaySourceRelationships(
      input.graph,
      {
        executionTraces: semanticIrExecutionTraces(input.semanticIr).traces,
        stateOutcomeEvidence: reconcileSourceStateOutcomes(input.semanticIr),
        resourceOutcomeEvidence: reconcileSourceResourceOutcomes(input.semanticIr),
        worldEffectOutcomeEvidence: reconcileSourceWorldEffectOutcomes(input.semanticIr),
        semanticIr: input.semanticIr,
      },
    );
    const sourceById = new Map([
      ...input.semanticIr.execution.edges.map(item => [item.id, item.source] as const),
      ...input.semanticIr.execution.regions.flatMap(item =>
        item.source ? [[item.id, item.source] as const] : []),
      ...input.semanticIr.state.operations.map(item => [item.id, item.source] as const),
      ...(input.semanticIr.state.resourceActions ?? []).map(item => [item.id, item.source] as const),
      ...(input.semanticIr.execution.outcomes ?? []).map(item => [item.id, item.source] as const),
      ...(input.semanticIr.execution.worldEffects ?? []).map(item => [item.id, item.source] as const),
    ]);
    for (const relation of sourceRelations) {
      const from = sourceById.get(relation.fromEvidenceId);
      const to = sourceById.get(relation.outcomeId);
      if (relation.gap === null ||
          from === undefined || to === undefined ||
          !matchesSource(relation.fromEvidenceId, from) ||
          !matchesSource(relation.outcomeId, to)) continue;
      output.push({
        id: "discovery-challenge:relationship:" + relation.kind + ":" +
          relation.fromEvidenceId + ":" + relation.outcomeId,
        kind: "unmodeled-source-relationship",
        subjectId: relation.outcomeId,
        evidenceIds: [relation.fromEvidenceId, relation.outcomeId],
        reason: "Both exact selected-artifact records have individual authored " +
          "scenario evidence, but their source-observed " + relation.kind +
          " relationship remains " + relation.gap +
          " (" + relation.sourceBasis + "). Individual proof links, shared " +
          "scenario membership or an ambiguous source order do not prove " +
          "the intervening gameplay behavior.",
      });
    }
  }

  return output
    .filter(
      (item, index, all) =>
        all.findIndex(
          (candidate) => candidate.id === item.id,
        ) === index,
    )
    .sort((a, b) => a.id.localeCompare(b.id));
}
