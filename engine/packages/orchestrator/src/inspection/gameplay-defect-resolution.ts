import type {
  GameplayCausalLink,
  GameplayScenarioGraph,
} from "./gameplay-scenario-model.js";
import {
  satisfiedScenarioKnowledgeReceipt,
  uniqueScenarioKnowledgeRequirement,
} from "./gameplay-scenario-knowledge.js";

/** Exact selected-artifact subject/scope relation; not a proof of reachability or delivery. */
export function capabilityDeliveryMatchesScope(
  subjectId: string,
  scenarioLabel: string | undefined,
  subjectIds: readonly string[],
  componentIds: readonly string[],
): boolean {
  return subjectIds.includes(subjectId) ||
    componentIds.includes(subjectId) ||
    (subjectId === "runtime:arena-capacity" &&
      scenarioLabel === "arena-capacity-plus-one");
}

export type GameplayDefectResolutionDisposition =
  | "CONFIRMED_DEFECT_READY"
  | "BLOCKING_COUNTERPROOF"
  | "RUNTIME_PROOF_REQUIRED"
  | "DETECTION_GAP"
  | "GAMEPLAY_TRANSLATION_REQUIRED"
  | "COUNTERPROOF_SEARCH_REQUIRED";

export type CounterProofSearchDimension =
  | "owner"
  | "guard"
  | "generation"
  | "scope"
  | "cleanup"
  | "exclusion"
  | "geometry"
  | "capability"
  | "world-rule"
  | "activation"
  | "representation";

export interface CounterProofDimensionReceipt {
  readonly dimension: CounterProofSearchDimension;
  readonly scopeIds: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly exhaustiveWithinScope: boolean;
}

export interface CounterProofSearchReceipt {
  readonly schemaVersion: 1;
  readonly policy: "bounded-counterproof-search";
  readonly searchedDimensions:
    readonly CounterProofSearchDimension[];
  readonly dimensionReceipts:
    readonly CounterProofDimensionReceipt[];
  readonly scopeIds: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly exhaustiveWithinScope: boolean;
  readonly conclusion:
    | "NO_BLOCKING_PROOF"
    | "BLOCKING_PROOF_FOUND";
}

export interface FamilyProofCriterionReceipt {
  readonly id: string;
  readonly satisfied: boolean;
  readonly evidenceIds: readonly string[];
}

export interface FamilyProofReceipt {
  readonly schemaVersion: 1;
  readonly policy: "family-proof-receipt";
  readonly failureDomain: string;
  readonly criteria: readonly FamilyProofCriterionReceipt[];
}

export interface GameplayDefectResolution {
  readonly causalLinkId: string;
  readonly scenarioId?: string;
  readonly knowledgeRequirementIds?: readonly string[];
  readonly subjectIds?: readonly string[];
  readonly componentIds?: readonly string[];
  readonly evidenceIds?: readonly string[];
  readonly disposition: GameplayDefectResolutionDisposition;
  readonly gameplayTrigger?: string;
  readonly gameplayConsequence?: string;
  readonly expectedOutcome?: string;
  readonly actualOutcome?: string;
  readonly affectedScope?: string;
  readonly counterProofEvidenceIds?: readonly string[];
  readonly counterProofSearch?: CounterProofSearchReceipt;
  readonly familyProof?: FamilyProofReceipt;
  readonly runtimeReason?: string;
  readonly narrowRuntimeQuestion?: string;
  readonly detectionGapReason?: string;
  readonly missingCapability?: string;
}

export interface GameplayDefectResolutionGate {
  readonly status:
    | "READY_FOR_PROPOSED_BUG_SET"
    | "BLOCKED";
  readonly contradictedCausalLinkIds: readonly string[];
  readonly resolutions: readonly GameplayDefectResolution[];
  readonly confirmedDefectReadyIds: readonly string[];
  readonly blockingCounterProofIds: readonly string[];
  readonly runtimeProofRequiredIds: readonly string[];
  readonly detectionGapIds: readonly string[];
  readonly gameplayTranslationRequiredIds: readonly string[];
  readonly counterProofSearchRequiredIds: readonly string[];
  readonly issues: readonly string[];
}

function nonEmpty(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function unique(values: readonly string[] | undefined): readonly string[] {
  return [...new Set(
    (values ?? []).map((value) => value.trim()).filter(Boolean),
  )].sort();
}

export function requiredCounterProofDimensions(
  graph: GameplayScenarioGraph,
  link: GameplayCausalLink,
  scenario:
    GameplayScenarioGraph["scenarios"][number] | undefined,
): readonly CounterProofSearchDimension[] {
  const required = new Set<CounterProofSearchDimension>([
    "scope",
  ]);
  const components = new Set(link.componentIds);
  const knowledgeDomains = new Set(
    link.knowledgeRequirementIds.flatMap((id) => {
      const owner = uniqueScenarioKnowledgeRequirement(
        graph, id, link.scenarioId,
      );
      if (owner !== undefined) return [owner.domain];
      // An ambiguous Knowledge ID can never satisfy a proof criterion.
      // Counter-proof search is only a conservative plan: consider all
      // possible domains rather than silently choosing the first one and
      // omitting a necessary blocking dimension.
      return graph.knowledgeRequirements
        .filter((requirement) => requirement.id === id)
        .map((requirement) => requirement.domain);
    }),
  );
  const hasComponent = (...ids: string[]) =>
    ids.some((id) => components.has(id));
  const hasKnowledge = (...domains: string[]) =>
    domains.some((domain) => knowledgeDomains.has(domain as any));

  const guardSensitive =
    hasComponent(
      "runtime:player-capability",
      "runtime:inventory",
      "runtime:arena",
      "runtime:persistence",
      "runtime:state",
    ) ||
    hasKnowledge(
      "state-flow",
      "arena-lifecycle",
      "multiplayer-interleaving",
      "inventory-state",
      "persistence-recovery",
      "temporal-ownership",
    );
  if (guardSensitive) {
    required.add("guard");
  }

  const exclusionSensitive =
    hasComponent(
      "runtime:arena",
      "runtime:inventory",
      "runtime:persistence",
      "runtime:combat",
      "runtime:entities",
    ) ||
    hasKnowledge(
      "arena-lifecycle",
      "multiplayer-interleaving",
      "inventory-state",
      "persistence-recovery",
      "combat-lifecycle",
      "entity-behavior",
      "temporal-ownership",
    );
  if (exclusionSensitive) {
    required.add("exclusion");
  }

  const canonicalLifecycleStage =
    scenario?.gameplayStage === "RECOVERY" ||
    scenario?.gameplayStage === "CLEANUP_REPLAY" ||
    scenario?.gameplayStage === "TERMINAL";
  const lifecycleStructure =
    hasComponent(
      "runtime:persistence",
      "runtime:arena-cleanup",
      "runtime:arena",
      "runtime:state",
    ) ||
    hasKnowledge(
      "persistence-recovery",
      "arena-lifecycle",
      "temporal-ownership",
      "state-flow",
    );
  const legacyLifecycleFallback =
    scenario !== undefined &&
    ![
      "ENTRY_JOIN",
      "READY_START",
      "SETUP",
      "ACTIVE_GAMEPLAY",
      "PROGRESSION",
      "TERMINAL",
      "CLEANUP_REPLAY",
      "RECOVERY",
    ].includes(scenario.gameplayStage) &&
    /reconnect|reload|repeated|deferred|recovery|terminal/i.test(
      scenario.label + " " + scenario.gameplayStage,
    );
  const recoveryLike =
    canonicalLifecycleStage ||
    lifecycleStructure ||
    legacyLifecycleFallback;
  const ownershipSensitive =
    hasComponent(
      "runtime:arena",
      "runtime:persistence",
      "runtime:chunks",
      "runtime:inventory",
      "runtime:state",
    ) ||
    hasKnowledge(
      "arena-lifecycle",
      "multiplayer-interleaving",
      "persistence-recovery",
      "inventory-state",
      "temporal-ownership",
      "state-flow",
    ) ||
    (scenario?.playerCounts.some((count) => count > 1) ?? false);
  if (ownershipSensitive) {
    required.add("owner");
  }
  if (
    recoveryLike ||
    hasComponent(
      "runtime:arena",
      "runtime:persistence",
      "runtime:chunks",
      "runtime:arena-cleanup",
    ) ||
    hasKnowledge(
      "arena-lifecycle",
      "persistence-recovery",
      "chunk-simulation",
      "temporal-ownership",
    )
  ) {
    required.add("generation");
    required.add("cleanup");
  }

  if (
    hasComponent(
      "runtime:spatial",
      "runtime:structures",
      "runtime:arena-replica-integrity",
    ) ||
    hasKnowledge(
      "spatial-authority",
      "world-structure",
    )
  ) {
    required.add("geometry");
  }

  if (
    hasComponent("runtime:player-capability")
  ) {
    required.add("capability");
    required.add("activation");
  }

  if (
    hasComponent("runtime:world-rules")
  ) {
    required.add("world-rule");
  }

  if (
    hasComponent("runtime:client-reconciliation")
  ) {
    required.add("representation");
  }

  if (
    hasComponent("runtime:chunks") ||
    hasKnowledge("chunk-simulation")
  ) {
    required.add("owner");
    required.add("cleanup");
  }

  if (
    hasComponent("runtime:combat", "runtime:entities") ||
    hasKnowledge("combat-lifecycle", "entity-behavior")
  ) {
    required.add("exclusion");
  }

  if (
    hasComponent("runtime:inventory", "runtime:economy") ||
    hasKnowledge("inventory-state", "economy-reward")
  ) {
    required.add("owner");
    required.add("exclusion");
  }

  const scenarioText = [
    scenario?.label ?? "",
    scenario?.gameplayStage ?? "",
    scenario?.purpose ?? "",
    link.purpose,
    link.reason,
  ].join(" ");

  if (
    !required.has("geometry") &&
    /escape|boundary|contain|flight|fly|path|travers|spatial|geometry|barrier|collision/i.test(
      scenarioText,
    )
  ) {
    required.add("geometry");
  }

  if (
    !required.has("capability") &&
    /admin|roommaster|operator|permission|creative|spectator|capabilit|privileg|spawn.?egg|manual.?spawn/i.test(
      scenarioText,
    )
  ) {
    required.add("capability");
    required.add("activation");
  }

  if (
    !required.has("world-rule") &&
    /gamerule|natural.?spawn|mob.?spawn|weather|daylight|world.?setting/i.test(
      scenarioText,
    )
  ) {
    required.add("world-rule");
  }

  if (
    !required.has("representation") &&
    /client|visual|waterlog|prediction|desync|ghost|render|reconcil/i.test(
      scenarioText,
    )
  ) {
    required.add("representation");
  }

  return [...required].sort();
}

function validateResolution(
  graph: GameplayScenarioGraph,
  link: GameplayCausalLink,
  resolution: GameplayDefectResolution,
  scenario:
    GameplayScenarioGraph["scenarios"][number] | undefined,
): readonly string[] {
  const issues: string[] = [];

  if (resolution.disposition === "CONFIRMED_DEFECT_READY") {
    if (blockingCounterProofFor(graph, link).length > 0) {
      issues.push(
        link.id +
          ": confirmed defect cannot override source-proven blocking counter-proof at the same commit target.",
      );
    }
    if (!nonEmpty(resolution.gameplayTrigger)) {
      issues.push(link.id + ": confirmed defect requires gameplayTrigger.");
    }
    if (!nonEmpty(resolution.gameplayConsequence)) {
      issues.push(link.id + ": confirmed defect requires gameplayConsequence.");
    }
    if (!nonEmpty(resolution.expectedOutcome)) {
      issues.push(link.id + ": confirmed defect requires expectedOutcome.");
    }
    if (!nonEmpty(resolution.actualOutcome)) {
      issues.push(link.id + ": confirmed defect requires actualOutcome.");
    }
    if (!nonEmpty(resolution.affectedScope)) {
      issues.push(link.id + ": confirmed defect requires affectedScope.");
    }
    const search = resolution.counterProofSearch;
    if (search === undefined) {
      issues.push(
        link.id +
          ": confirmed defect requires CounterProofSearchReceipt.",
      );
    } else {
      if (
        search.schemaVersion !== 1 ||
        search.policy !== "bounded-counterproof-search"
      ) {
        issues.push(
          link.id +
            ": counter-proof search receipt has unsupported schema/policy.",
        );
      }
      const searchedDimensions =
        unique(search.searchedDimensions) as readonly CounterProofSearchDimension[];
      if (searchedDimensions.length === 0) {
        issues.push(
          link.id +
            ": counter-proof search must record searched dimensions.",
        );
      }
      const dimensionReceipts =
        search.dimensionReceipts ?? [];
      // A NO_BLOCKING_PROOF search must cover the exact causal-link scope.
      // Supplied receipts cannot introduce unobserved targets or evidence.
      const linkScopeIds = new Set([
        ...link.subjectIds,
        ...link.componentIds,
      ]);
      const searchScopeIds = unique(search.scopeIds);
      const scopedEvidenceIds = new Set(graph.causalLinks
        .filter((candidate) =>
          candidate.scenarioId === link.scenarioId &&
          (candidate.id === link.id ||
            overlapping(candidate.subjectIds, link.subjectIds) ||
            overlapping(candidate.componentIds, link.componentIds))
        )
        .flatMap((candidate) => [
          ...candidate.evidenceIds,
          ...Object.values(candidate.dimensionEvidence ?? {}).flat(),
        ]));
      if (searchScopeIds.some((id) => !linkScopeIds.has(id))) {
        issues.push(link.id +
          ": counter-proof scope is outside the causal-link source target.");
      }
      if (unique(search.evidenceIds).some((id) =>
          !scopedEvidenceIds.has(id))) {
        issues.push(link.id +
          ": counter-proof evidence is absent from the selected-scenario causal source.");
      }
      if (dimensionReceipts.length !== searchedDimensions.length ||
          search.searchedDimensions.length !== searchedDimensions.length) {
        issues.push(link.id +
          ": counter-proof dimensions require exactly one receipt each.");
      }
      for (const dimension of searchedDimensions) {
        const matches = dimensionReceipts.filter(
          (item) => item.dimension === dimension,
        );
        const receipt = matches[0];
        if (
          matches.length !== 1 ||
          receipt === undefined ||
          unique(receipt.scopeIds).length === 0 ||
          unique(receipt.evidenceIds).length === 0 ||
          receipt.exhaustiveWithinScope !== true ||
          unique(receipt.scopeIds).some((id) =>
            !searchScopeIds.includes(id)) ||
          unique(receipt.evidenceIds).some((id) =>
            !scopedEvidenceIds.has(id))
        ) {
          issues.push(
            link.id +
              ": counter-proof dimension '" +
              dimension +
              "' requires unique, source-bound scope/evidence and exhaustive dimension receipt.",
          );
        }
      }
      const requiredDimensions =
        requiredCounterProofDimensions(
          graph,
          link,
          scenario,
        );
      const missingDimensions =
        requiredDimensions.filter(
          (dimension) =>
            !searchedDimensions.includes(dimension),
        );
      if (missingDimensions.length > 0) {
        issues.push(
          link.id +
            ": counter-proof search is incomplete; missing relevant dimensions: " +
            missingDimensions.join(", ") +
            ".",
        );
      }
      if (unique(search.scopeIds).length === 0) {
        issues.push(
          link.id +
            ": counter-proof search must bind the searched gameplay/source scope.",
        );
      }
      if (unique(search.evidenceIds).length === 0) {
        issues.push(
          link.id +
            ": counter-proof search must include coverage evidence.",
        );
      }
      if (!search.exhaustiveWithinScope) {
        issues.push(
          link.id +
            ": confirmed defect requires counter-proof search exhaustion within the bounded scope.",
        );
      }
      if (search.conclusion !== "NO_BLOCKING_PROOF") {
        issues.push(
          link.id +
            ": confirmed defect requires NO_BLOCKING_PROOF conclusion.",
        );
      }
    }
  }

  if (resolution.disposition === "BLOCKING_COUNTERPROOF") {
    const supportedIds = blockingCounterProofFor(graph, link);
    const suppliedIds = unique(resolution.counterProofEvidenceIds);
    // A supplied proof cannot dismiss a CONTRADICTED source link with
    // unrelated evidence or a guard on another commit target.
    if (supportedIds.length === 0 ||
        suppliedIds.length === 0 ||
        !suppliedIds.every((id) => supportedIds.includes(id))) {
      issues.push(
        link.id +
          ": blocking counter-proof must cite an exact PROVEN exclusion at the contradicted commit target; foreign or unsupported evidence cannot suppress the finding.",
      );
    }
    if (
      resolution.counterProofSearch !== undefined &&
      resolution.counterProofSearch.conclusion !==
        "BLOCKING_PROOF_FOUND"
    ) {
      issues.push(
        link.id +
          ": blocking counter-proof search receipt must conclude BLOCKING_PROOF_FOUND.",
      );
    }
  }

  if (resolution.disposition === "RUNTIME_PROOF_REQUIRED") {
    if (!nonEmpty(resolution.runtimeReason)) {
      issues.push(link.id + ": runtime proof requires runtimeReason.");
    }
    if (!nonEmpty(resolution.narrowRuntimeQuestion)) {
      issues.push(
        link.id +
          ": runtime proof requires one narrowRuntimeQuestion; do not emit a broad validation checklist.",
      );
    }
  }

  if (resolution.disposition === "DETECTION_GAP") {
    if (!nonEmpty(resolution.detectionGapReason)) {
      issues.push(link.id + ": detection gap requires detectionGapReason.");
    }
    if (!nonEmpty(resolution.missingCapability)) {
      issues.push(link.id + ": detection gap requires missingCapability.");
    }
  }

  return issues;
}

function overlapping(
  left: readonly string[],
  right: readonly string[],
): boolean {
  const set = new Set(left);
  return right.some((item) => set.has(item));
}

function dimensionScopeClosed(
  graph: GameplayScenarioGraph,
  contradicted: GameplayCausalLink,
  dimension: CounterProofSearchDimension,
): boolean {
  const evidenceIds = dimensionEvidenceFor(
    graph,
    contradicted,
    dimension,
  );
  if (evidenceIds.length === 0) return false;

  const relevant = graph.causalLinks.filter(
    (candidate) =>
      candidate.scenarioId === contradicted.scenarioId &&
      (
        candidate.id === contradicted.id ||
        overlapping(candidate.subjectIds, contradicted.subjectIds) ||
        overlapping(candidate.componentIds, contradicted.componentIds)
      ) &&
      (
        candidate.id === contradicted.id ||
        (boundedDimensionEvidence(candidate, dimension).length ?? 0) > 0
      ),
  );
  if (relevant.length === 0) return false;
  return relevant.every(
    (candidate) =>
      candidate.evidenceIds.length > 0 &&
      candidate.status !== "DETECTION_GAP" &&
      candidate.status !== "RUNTIME_BLOCKED",
  );
}

function dimensionEvidenceFor(
  graph: GameplayScenarioGraph,
  contradicted: GameplayCausalLink,
  dimension: CounterProofSearchDimension,
): readonly string[] {
  const scoped = graph.causalLinks.filter(
    (candidate) =>
      candidate.scenarioId === contradicted.scenarioId &&
      (
        candidate.id === contradicted.id ||
        overlapping(candidate.subjectIds, contradicted.subjectIds) ||
        overlapping(candidate.componentIds, contradicted.componentIds)
      ),
  );

  const componentHints: Readonly<Record<CounterProofSearchDimension, readonly string[]>> = {
    owner: ["runtime:arena", "runtime:persistence", "runtime:inventory", "runtime:state"],
    guard: [],
    generation: ["runtime:arena", "runtime:persistence"],
    scope: [],
    cleanup: ["runtime:arena-cleanup", "runtime:structures", "runtime:inventory"],
    exclusion: [],
    geometry: ["runtime:spatial", "runtime:structures", "runtime:arena-replica-integrity"],
    capability: ["runtime:player-capability"],
    "world-rule": ["runtime:world-rules"],
    activation: ["runtime:player-capability"],
    representation: ["runtime:client-reconciliation"],
  };
  const hints = componentHints[dimension];
  const directDimensionEvidence =
    boundedDimensionEvidence(contradicted, dimension);

  // Typed proof dimensions cannot borrow generic component/knowledge IDs.
  // For scope/guard/exclusion the legacy coverage search remains conservative
  // until those dimensions have a dedicated selected-source witness contract.
  const explicitDimensions = new Set<CounterProofSearchDimension>([
    "owner", "generation", "cleanup", "geometry", "capability",
    "world-rule", "activation", "representation",
  ]);
  return [
    ...new Set([
      ...directDimensionEvidence,
      ...scoped
        .filter((candidate) =>
          hints.length === 0 ||
          candidate.componentIds.some((id) => hints.includes(id))
        )
        .flatMap((candidate) =>
          explicitDimensions.has(dimension)
            ? boundedDimensionEvidence(candidate, dimension)
            : [
                ...candidate.evidenceIds,
                ...boundedDimensionEvidence(candidate, dimension),
              ]
        )
        .filter(Boolean),
    ]),
  ].sort();
}

/** A missing dimension is unknown evidence, never an exhaustive counterproof. */
function boundedDimensionEvidence(
  link: GameplayCausalLink,
  dimension: CounterProofSearchDimension,
): readonly string[] {
  if (!(dimension in link.dimensionEvidence)) return [];
  return link.dimensionEvidence[dimension as keyof GameplayCausalLink["dimensionEvidence"]] ?? [];
}

function runtimeQuestionFor(
  link: GameplayCausalLink,
): string | undefined {
  switch (link.runtimeNativeReason) {
    case "client-reconciliation":
      return "Does the affected client visually reconcile the source-proven cancelled mutation, or does stale/ghost state remain visible?";
    case "entity-navigation-manifestation":
      return "Does the source-grounded navigation state manifest as the predicted entity pathing failure in the selected scenario?";
    case "network-timing":
      return "Under the selected network timing condition, does the source-grounded ordering ambiguity manifest in the predicted gameplay outcome?";
    case "engine-scheduling":
      return "Under the selected engine scheduling condition, does the source-grounded timing dependency manifest in the predicted gameplay outcome?";
    default:
      return undefined;
  }
}

export function automaticCounterProofSearch(
  graph: GameplayScenarioGraph,
  contradicted: GameplayCausalLink,
  scenario:
    GameplayScenarioGraph["scenarios"][number] | undefined,
): CounterProofSearchReceipt {
  const requiredDimensions =
    requiredCounterProofDimensions(
      graph,
      contradicted,
      scenario,
    );
  const automaticallySearchable =
    requiredDimensions.filter((dimension) =>
      dimension === "guard" ||
      dimension === "scope" ||
      dimension === "exclusion" ||
      dimensionEvidenceFor(
        graph,
        contradicted,
        dimension,
      ).length > 0
    );
  const scopeIds = [
    ...new Set([
      ...contradicted.subjectIds,
      ...contradicted.componentIds,
    ]),
  ].sort();

  const scopedLinks = graph.causalLinks.filter(
    (candidate) =>
      candidate.scenarioId === contradicted.scenarioId &&
      (
        candidate.id === contradicted.id ||
        overlapping(candidate.subjectIds, scopeIds) ||
        overlapping(candidate.componentIds, scopeIds)
      ),
  );

  const blocking = blockingCounterProofFor(
    graph,
    contradicted,
  );

  const evidenceIds = [
    ...new Set([
      ...contradicted.evidenceIds,
      ...scopedLinks.flatMap((candidate) =>
        candidate.evidenceIds
      ),
    ]),
  ].filter(Boolean).sort();

  return {
    schemaVersion: 1,
    policy: "bounded-counterproof-search",
    searchedDimensions: automaticallySearchable,
    dimensionReceipts:
      automaticallySearchable.map((dimension) => {
        const dimensionEvidence =
          dimensionEvidenceFor(
            graph,
            contradicted,
            dimension,
          );
        return {
          dimension,
          scopeIds,
          evidenceIds:
            dimensionEvidence.length > 0
              ? dimensionEvidence
              : evidenceIds,
          exhaustiveWithinScope:
            dimensionScopeClosed(
              graph,
              contradicted,
              dimension,
            ),
        };
      }),
    scopeIds,
    evidenceIds,
    // This receipt is exhaustive only within the already-closed selected-
    // artifact scenario graph. Runtime-unknown semantics never reach this
    // branch as a source-confirmed contradiction; they remain RUNTIME_BLOCKED
    // or DETECTION_GAP with targeted test obligations.
    exhaustiveWithinScope:
      requiredDimensions.every((dimension) =>
        automaticallySearchable.includes(dimension) &&
        dimensionScopeClosed(
          graph,
          contradicted,
          dimension,
        )
      ),
    conclusion:
      blocking.length > 0
        ? "BLOCKING_PROOF_FOUND"
        : "NO_BLOCKING_PROOF",
  };
}

function counterProofAppliesAtCommit(
  candidate: GameplayCausalLink,
  contradicted: GameplayCausalLink,
): boolean {
  if (
    candidate.scenarioId !== contradicted.scenarioId ||
    candidate.status !== "PROVEN" ||
    candidate.intentEdgeKind !== "excludes" ||
    candidate.evidenceIds.length === 0
  ) {
    return false;
  }

  const exactTarget =
    candidate.toComponentId ===
      contradicted.toComponentId;
  const exactDependency =
    candidate.fromComponentId ===
      contradicted.fromComponentId &&
    candidate.toComponentId ===
      contradicted.toComponentId;
  const sameSubjectAtTarget =
    exactTarget &&
    overlapping(
      candidate.subjectIds,
      contradicted.subjectIds,
    );

  return (
    exactDependency ||
    sameSubjectAtTarget
  );
}

export function blockingCounterProofFor(
  graph: GameplayScenarioGraph,
  contradicted: GameplayCausalLink,
): readonly string[] {
  return graph.causalLinks
    .filter((candidate) =>
      counterProofAppliesAtCommit(
        candidate,
        contradicted,
      )
    )
    .flatMap((candidate) => candidate.evidenceIds)
    .filter(Boolean)
    .filter(
      (id, index, all) =>
        all.indexOf(id) === index,
    )
    .sort();
}

export function assessGameplayDefectResolutionGate(
  graph: GameplayScenarioGraph,
  suppliedResolutions: readonly GameplayDefectResolution[] = [],
): GameplayDefectResolutionGate {
  const contradicted = graph.causalLinks
    .filter((link) => link.status === "CONTRADICTED")
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id));
  const runtimeBlocked = graph.causalLinks
    .filter((link) => link.status === "RUNTIME_BLOCKED")
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id));
  const detectionGaps = graph.causalLinks
    .filter((link) => link.status === "DETECTION_GAP")
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id));

  const resolvableIds = new Set([
    ...contradicted,
    ...runtimeBlocked,
    ...detectionGaps,
  ].map((link) => link.id));
  const byId = new Map<string, GameplayDefectResolution>();
  const issues: string[] = [];

  for (const resolution of suppliedResolutions) {
    if (!resolvableIds.has(resolution.causalLinkId)) {
      issues.push(
        "Resolution references a causal link that is not currently CONTRADICTED: " +
          resolution.causalLinkId +
          ".",
      );
      continue;
    }
    if (byId.has(resolution.causalLinkId)) {
      issues.push(
        "Duplicate defect resolution for causal link: " +
          resolution.causalLinkId +
          ".",
      );
      continue;
    }
    const sourceLink = graph.causalLinks.find(
      (link) => link.id === resolution.causalLinkId,
    );
    if (
      resolution.scenarioId !== undefined &&
      resolution.scenarioId !== sourceLink?.scenarioId
    ) {
      issues.push(
        resolution.causalLinkId +
          ": supplied resolution scenarioId does not match the causal-link owner.",
      );
      continue;
    }
    if (
      sourceLink?.status === "DETECTION_GAP" &&
      resolution.disposition !== "DETECTION_GAP"
    ) {
      issues.push(
        resolution.causalLinkId +
          ": DETECTION_GAP cannot be promoted or converted into runtime validation; resolve selected-source causal evidence first.",
      );
      continue;
    }
    if (
      sourceLink?.status === "RUNTIME_BLOCKED" &&
      resolution.disposition !== "RUNTIME_PROOF_REQUIRED" &&
      resolution.disposition !== "DETECTION_GAP"
    ) {
      issues.push(
        resolution.causalLinkId +
          ": RUNTIME_BLOCKED cannot become a gameplay finding or safe counter-proof without a runtime-backed causal-link refresh.",
      );
      continue;
    }
    // Invalid externally supplied resolutions are never projected into
    // PROVE or the issue set, even while the overall admission is BLOCKED.
    // Fall back to the canonical graph-derived disposition instead.
    if (sourceLink === undefined) continue;
    const scenario = graph.scenarios.find(
      (candidate) => candidate.id === sourceLink.scenarioId,
    );
    const invalid = validateResolution(
      graph, sourceLink, resolution, scenario,
    );
    if (invalid.length > 0) {
      issues.push(...invalid);
      continue;
    }
    byId.set(resolution.causalLinkId, resolution);
  }

  const runtimeAndGapResolutions: GameplayDefectResolution[] = [
    ...runtimeBlocked.map((link) => {
      const supplied = byId.get(link.id);
      if (supplied) {
        const scenario = graph.scenarios.find(
          (item) => item.id === link.scenarioId,
        );
        issues.push(
          ...validateResolution(
            graph,
            link,
            supplied,
            scenario,
          ),
        );
        return supplied;
      }
      const runtimeQuestion = runtimeQuestionFor(link);
      if (runtimeQuestion === undefined) {
        return {
          causalLinkId: link.id,
          scenarioId: link.scenarioId,
          knowledgeRequirementIds: [...link.knowledgeRequirementIds],
          subjectIds: [...link.subjectIds],
          componentIds: [...link.componentIds],
          evidenceIds: [...link.evidenceIds],
          disposition: "DETECTION_GAP" as const,
          detectionGapReason:
            "RUNTIME_BLOCKED causal link has no typed runtime-native semantic boundary.",
          missingCapability:
            "Classify the irreducible runtime semantic before requesting validation.",
        };
      }
      return {
        causalLinkId: link.id,
        scenarioId: link.scenarioId,
        knowledgeRequirementIds: [...link.knowledgeRequirementIds],
        subjectIds: [...link.subjectIds],
        componentIds: [...link.componentIds],
        evidenceIds: [...link.evidenceIds],
        disposition: "RUNTIME_PROOF_REQUIRED" as const,
        runtimeReason: link.reason,
        narrowRuntimeQuestion: runtimeQuestion,
      };
    }),
    ...detectionGaps.map((link) => {
      const supplied = byId.get(link.id);
      if (supplied) {
        const scenario = graph.scenarios.find(
          (item) => item.id === link.scenarioId,
        );
        issues.push(
          ...validateResolution(
            graph,
            link,
            supplied,
            scenario,
          ),
        );
        return supplied;
      }
      return {
      causalLinkId: link.id,
      scenarioId: link.scenarioId,
      knowledgeRequirementIds: [...link.knowledgeRequirementIds],
      subjectIds: [...link.subjectIds],
      componentIds: [...link.componentIds],
      evidenceIds: [...link.evidenceIds],
      disposition: "DETECTION_GAP" as const,
      detectionGapReason: link.reason,
      missingCapability:
        "Resolve the missing selected-artifact causal evidence before requesting runtime validation.",
      };
    }),
  ];

  const resolutions: GameplayDefectResolution[] = [
    ...contradicted.map((link) => {
    const supplied = byId.get(link.id);
    if (supplied) {
      const scenario = graph.scenarios.find(
        (item) => item.id === link.scenarioId,
      );
      issues.push(
        ...validateResolution(
          graph,
          link,
          supplied,
          scenario,
        ),
      );
      return supplied;
    }

    const scenario = graph.scenarios.find(
      (item) => item.id === link.scenarioId,
    );
    const scope = [
      ...new Set([
        ...link.subjectIds,
        ...link.componentIds,
      ]),
    ].sort();

    const impactPathLabels = link.impactPathComponentIds.map((id) => graph.components.find((component) => component.id === id)?.label ?? id);
    const propagatedConsequence = impactPathLabels.length > 0 ? "Dependency impact path: " + impactPathLabels.join(" -> ") + "." : undefined;
    const translationReady =
      scenario !== undefined &&
      link.purpose.trim().length > 0 &&
      link.reason.trim().length > 0 &&
      scope.length > 0 &&
      link.evidenceIds.length > 0;
    const blockingCounterProofEvidenceIds =
      blockingCounterProofFor(
        graph,
        link,
      );
    const automaticSearch =
      automaticCounterProofSearch(
        graph,
        link,
        scenario,
      );
    const requiredDimensions =
      requiredCounterProofDimensions(
        graph,
        link,
        scenario,
      );
    const missingAutomaticDimensions =
      requiredDimensions.filter(
        (dimension) =>
          !automaticSearch.searchedDimensions.includes(
            dimension,
          ),
      );
    const requiredDimensionEvidenceIds = [
      ...new Set(
        automaticSearch.dimensionReceipts
          .filter((receipt) =>
            requiredDimensions.includes(
              receipt.dimension,
            )
          )
          .flatMap((receipt) => receipt.evidenceIds),
      ),
    ].sort();

    return {
      causalLinkId: link.id,
      scenarioId: link.scenarioId,
      ...(link.knowledgeRequirementIds.length === 0
        ? {}
        : {
            knowledgeRequirementIds:
              [...link.knowledgeRequirementIds],
          }),
      subjectIds: [...link.subjectIds],
      componentIds: [...link.componentIds],
      evidenceIds: [
        ...new Set([
          ...link.evidenceIds,
          ...link.impactPathEvidenceIds,
          ...requiredDimensionEvidenceIds,
          ...link.knowledgeRequirementIds.flatMap((id) => {
            const required = uniqueScenarioKnowledgeRequirement(
              graph, id, link.scenarioId,
            );
            return required === undefined ? [] :
              satisfiedScenarioKnowledgeReceipt(graph, required)?.evidenceIds ?? [];
          }),
        ]),
      ].sort(),
      ...(blockingCounterProofEvidenceIds.length > 0
        ? {
            counterProofEvidenceIds:
              blockingCounterProofEvidenceIds,
            counterProofSearch:
              automaticSearch,
            disposition:
              "BLOCKING_COUNTERPROOF" as const,
          }
        : translationReady
        ? missingAutomaticDimensions.length > 0
          ? {
              gameplayTrigger:
                scenario.purpose,
              gameplayConsequence:
                "A required dependency for " +
                scenario.label +
                " is contradicted, but sensitive counter-proof dimensions remain unresolved.",
              expectedOutcome:
                link.purpose,
              actualOutcome:
                link.reason,
              affectedScope:
                scope.join(", "),
              counterProofSearch:
                automaticSearch,
              disposition:
                "COUNTERPROOF_SEARCH_REQUIRED" as const,
            }
          : {
              gameplayTrigger:
                scenario.purpose,
              gameplayConsequence:
                propagatedConsequence ?? ("A required dependency for " + scenario.label + " is contradicted, so the scenario can produce an incorrect or blocked player-visible result."),
              expectedOutcome:
                link.purpose,
              actualOutcome:
                link.reason,
              affectedScope:
                scope.join(", "),
              counterProofSearch:
                automaticSearch,
              disposition:
                "CONFIRMED_DEFECT_READY" as const,
            }
        : {
            disposition:
              "GAMEPLAY_TRANSLATION_REQUIRED" as const,
          }),
    };
  }),
    ...runtimeAndGapResolutions,
  ];

  const idsFor = (
    disposition: GameplayDefectResolutionDisposition,
  ): readonly string[] =>
    resolutions
      .filter((item) => item.disposition === disposition)
      .map((item) => item.causalLinkId)
      .sort();

  const confirmedDefectReadyIds =
    idsFor("CONFIRMED_DEFECT_READY");
  const blockingCounterProofIds =
    idsFor("BLOCKING_COUNTERPROOF");
  const runtimeProofRequiredIds =
    idsFor("RUNTIME_PROOF_REQUIRED");
  const detectionGapIds =
    idsFor("DETECTION_GAP");
  const gameplayTranslationRequiredIds =
    idsFor("GAMEPLAY_TRANSLATION_REQUIRED");
  const counterProofSearchRequiredIds =
    idsFor("COUNTERPROOF_SEARCH_REQUIRED");

  if (gameplayTranslationRequiredIds.length > 0) {
    issues.push(
      "Gameplay translation is incomplete for contradicted causal links: " +
        gameplayTranslationRequiredIds.join(", ") +
        ". This is AI analysis work, not tester validation.",
    );
  }

  if (counterProofSearchRequiredIds.length > 0) {
    issues.push(
      "Blocking counter-proof search is incomplete for contradicted causal links: " +
        counterProofSearchRequiredIds.join(", ") +
        ". Complete the source-side search before report publication.",
    );
  }

  // The resolution inventory includes non-finding runtime and detection-gap
  // obligations. Validate each against its own causal-link owner, not against
  // the CONTRADICTED subset (which would reject every valid gap/runtime item).
  const malformedFinalResolution = resolutions.some((resolution) => {
    const link = graph.causalLinks.find(
      (candidate) => candidate.id === resolution.causalLinkId,
    );
    if (
      link === undefined ||
      link.status === "PROVEN" ||
      (
        resolution.scenarioId !== undefined &&
        resolution.scenarioId !== link.scenarioId
      )
    ) return true;
    if (
      link.status === "DETECTION_GAP" &&
      resolution.disposition !== "DETECTION_GAP"
    ) return true;
    if (
      link.status === "RUNTIME_BLOCKED" &&
      resolution.disposition !== "RUNTIME_PROOF_REQUIRED" &&
      resolution.disposition !== "DETECTION_GAP"
    ) return true;
    const scenario = graph.scenarios.find(
      (item) => item.id === link.scenarioId,
    );
    return validateResolution(
      graph,
      link,
      resolution,
      scenario,
    ).length > 0;
  });

  // READY means the typed resolution inventory is coherent. It is not
  // proof that separate scenario-closure or publication gates have closed.
  const status =
    gameplayTranslationRequiredIds.length === 0 &&
    counterProofSearchRequiredIds.length === 0 &&
    !malformedFinalResolution &&
    issues.length === 0
      ? "READY_FOR_PROPOSED_BUG_SET" as const
      : "BLOCKED" as const;

  return {
    status,
    contradictedCausalLinkIds: contradicted.map((link) => link.id),
    resolutions,
    confirmedDefectReadyIds,
    blockingCounterProofIds,
    runtimeProofRequiredIds,
    detectionGapIds,
    gameplayTranslationRequiredIds,
    counterProofSearchRequiredIds,
    issues: [...new Set(issues)],
  };
}
