import {
  BUILTIN_ANALYSIS_CAPABILITIES,
  createAnalysisCapabilityRegistry,
  type AnalysisExecutionContext,
} from "../../../analysis-planner/src/index.js";
import type {
  GameplayIntentEdge,
  GameplayIntentEdgeKind,
  GameplayIntentModel,
  GameplayIntentNode,
} from "../../../gameplay-intent/src/index.js";
import type {
  GameplayAuditScenarioKind,
} from "../../../diagnostic-reasoning/src/index.js";
import type {
  GameplayWorldModel,
} from "./gameplay-world-model.js";
import type {
  GameplayKnowledgeDomain,
  GameplayKnowledgeReceipt,
  GameplayKnowledgeRequirement,
  GameplayScenarioGraph,
} from "./gameplay-scenario-model.js";

/** A Knowledge requirement ID has one source/ownership identity graph-wide. */
export function uniqueScenarioKnowledgeRequirement(
  graph: Pick<GameplayScenarioGraph, "knowledgeRequirements">,
  requirementId: string,
  scenarioId: string,
): GameplayKnowledgeRequirement | undefined {
  const owners = graph.knowledgeRequirements.filter((item) =>
    item.id === requirementId
  );
  return owners.length === 1 && owners[0]?.scenarioId === scenarioId
    ? owners[0]
    : undefined;
}

/**
 * The canonical source-scoped Knowledge proof condition for checkpoints,
 * Audit Obligations, PROVE saturation and REPORT taxonomy consumers.
 * A status flag alone, a duplicate ID, or an empty evidence list is not proof.
 */
export function satisfiedScenarioKnowledgeReceipt(
  graph: Pick<GameplayScenarioGraph, "knowledgeRequirements" | "knowledgeReceipts">,
  requirement: GameplayKnowledgeRequirement,
): GameplayKnowledgeReceipt | undefined {
  const owner = uniqueScenarioKnowledgeRequirement(
    graph, requirement.id, requirement.scenarioId,
  );
  if (owner === undefined || owner.domain !== requirement.domain) {
    return undefined;
  }
  const receipts = graph.knowledgeReceipts.filter((item) =>
    item.requirementId === requirement.id &&
    item.scenarioId === requirement.scenarioId &&
    item.domain === requirement.domain
  );
  return receipts.length === 1 &&
    receipts[0]?.status === "SATISFIED" &&
    receipts[0].evidenceIds.length > 0
      ? receipts[0]
      : undefined;
}

const registry = createAnalysisCapabilityRegistry(
  BUILTIN_ANALYSIS_CAPABILITIES,
);

const DOMAIN_DEPENDENCIES: Readonly<Partial<Record<
  GameplayKnowledgeDomain,
  readonly GameplayKnowledgeDomain[]
>>> = {
  "arena-lifecycle": ["state-flow"],
  "multiplayer-interleaving": [
    "state-flow",
    "arena-lifecycle",
  ],
  "chunk-simulation": ["state-flow", "platform-constraints"],
  "entity-behavior": [
    "state-flow",
    "chunk-simulation",
  ],
  "combat-lifecycle": [
    "state-flow",
    "entity-behavior",
  ],
  "inventory-state": ["state-flow"],
  "persistence-recovery": ["state-flow"],
  "world-structure": ["state-flow"],
  "economy-reward": [
    "state-flow",
    "inventory-state",
  ],
  "spatial-authority": ["state-flow"],
  "temporal-ownership": ["state-flow"],
  "platform-constraints": ["state-flow"],
};

function capabilityIdsForDomain(
  domain: GameplayKnowledgeDomain,
  context: AnalysisExecutionContext,
): readonly string[] {
  return registry.capabilities
    .filter((capability) =>
      capability.contexts.includes(context) &&
      capability.evidenceLevel !== "runtime" &&
      capability.evidenceLevel !== "intervention" &&
      (capability.knowledgeDomains ?? [])
        .includes(domain)
    )
    .map((capability) => capability.id)
    .sort();
}

function executedCapabilityIdsForDomain(
  world: GameplayWorldModel,
  domain: GameplayKnowledgeDomain,
): readonly string[] {
  const executed = new Set(
    world.analysisExecution.executedCapabilityIds,
  );
  return registry.capabilities
    .filter((capability) =>
      (capability.knowledgeDomains ?? [])
        .includes(domain) &&
      executed.has(capability.id)
    )
    .map((capability) => capability.id)
    .sort();
}

function domainExecuted(
  world: GameplayWorldModel,
  domain: GameplayKnowledgeDomain,
): boolean {
  return executedCapabilityIdsForDomain(
    world,
    domain,
  ).length > 0;
}

function platformClaimDomainsForScenario(
  scenarioId: string,
  requirements: readonly GameplayKnowledgeRequirement[],
): ReadonlySet<string> {
  const siblingDomains = new Set(
    requirements
      .filter((item) => item.scenarioId === scenarioId)
      .map((item) => item.domain),
  );
  const domains = new Set<string>([
    "compatibility",
    "education-runtime",
    "education",
  ]);

  if (siblingDomains.has("chunk-simulation")) {
    domains.add("chunks");
  }
  if (
    siblingDomains.has("arena-lifecycle") ||
    siblingDomains.has("multiplayer-interleaving")
  ) {
    domains.add("multiplayer");
    domains.add("world-state");
  }
  if (siblingDomains.has("entity-behavior")) {
    domains.add("entity-runtime");
  }
  if (siblingDomains.has("temporal-ownership")) {
    domains.add("event-ordering");
    domains.add("script-api");
  }
  if (siblingDomains.has("persistence-recovery")) {
    domains.add("persistence");
  }
  if (siblingDomains.has("world-structure")) {
    domains.add("world-mutation");
  }

  return domains;
}

export function knowledgeIdsForRequirement(
  world: GameplayWorldModel,
  requirement: GameplayKnowledgeRequirement,
  requirements: readonly GameplayKnowledgeRequirement[],
): readonly string[] {
  if (requirement.domain !== "platform-constraints") return [];

  const relevantDomains = platformClaimDomainsForScenario(
    requirement.scenarioId,
    requirements,
  );

  return world.platformKnowledge.claims
    .filter(
      (claim) =>
        relevantDomains.has(claim.domain) &&
        claim.status !== "unknown",
    )
    .map((claim) => claim.relationId)
    .filter((id, index, values) => values.indexOf(id) === index)
    .sort();
}

function domainEvidence(
  world: GameplayWorldModel,
  domain: GameplayKnowledgeDomain,
  requirement?: GameplayKnowledgeRequirement,
  requirements: readonly GameplayKnowledgeRequirement[] = [],
): readonly string[] {
  if (!domainExecuted(world, domain)) return [];
  switch (domain) {
    case "state-flow":
      return ["analysis:state-flow"];
    case "arena-lifecycle":
      return ["analysis:arena-lifecycle"];
    case "multiplayer-interleaving":
      return ["analysis:multiplayer-interleaving"];
    case "chunk-simulation":
      return ["analysis:chunk-simulation"];
    case "entity-behavior":
      return ["analysis:entity-behavior"];
    case "combat-lifecycle":
      return ["analysis:combat-lifecycle"];
    case "inventory-state":
      return ["analysis:inventory-state"];
    case "persistence-recovery":
      return ["analysis:persistence-recovery"];
    case "world-structure":
      return ["analysis:world-structure"];
    case "economy-reward":
      return ["analysis:economy-reward"];
    case "spatial-authority":
      return ["analysis:spatial-authority"];
    case "temporal-ownership":
      return ["analysis:temporal-ownership"];
    case "platform-constraints": {
      if (requirement === undefined) return [];
      const relevantDomains =
        platformClaimDomainsForScenario(
          requirement.scenarioId,
          requirements,
        );
      const decisiveClaims =
        world.platformKnowledge.claims.filter(
          (claim) =>
            relevantDomains.has(claim.domain) &&
            claim.status !== "unknown",
        );
      return decisiveClaims.length > 0
        ? ["analysis:platform-constraints"]
        : [];
    }
  }
}

function add(
  domains: Set<GameplayKnowledgeDomain>,
  domain: GameplayKnowledgeDomain,
): void {
  domains.add(domain);
}

/**
 * Content authored in literal catalogues, stage/wave recipes and content
 * pools is navigation-only evidence, not a runtime gameplay resource.
 * Keep these canonical Intent nodes intact, but do not allow them to
 * silently create scenario obligations or connect unrelated mechanics.
 */
export function isAuthoredSourceContentNode(
  node: GameplayIntentNode,
): boolean {
  return node.id.includes(":authored-source:") ||
    node.id.startsWith("resource:authored-content:");
}

const SCENARIO_STRUCTURAL_EDGE_KINDS =
  new Set<GameplayIntentEdgeKind>([
    "owns",
    "participates-in",
    "valid-during",
    "scoped-to",
    "located-in",
  ]);

const SCENARIO_FORWARD_EDGE_KINDS =
  new Set<GameplayIntentEdgeKind>([
    "produces",
    "consumes",
    "transitions-to",
    "resets",
    "persists",
    "requires",
    "recovers-to",
    "wins-by",
    "loses-by",
  ]);

const SCENARIO_REVERSE_CONTEXT_EDGE_KINDS =
  new Set<GameplayIntentEdgeKind>([
    "produces",
    "transitions-to",
    "recovers-to",
    "wins-by",
    "loses-by",
  ]);

const SCENARIO_STOP_NODE_KINDS =
  new Set<GameplayIntentNode["kind"]>([
    "phase",
    "objective",
    "outcome",
    "policy",
    "spatial-region",
  ]);

function scenarioTraversalNeighbor(
  model: GameplayIntentModel,
  edge: GameplayIntentEdge,
  currentId: string,
): string | undefined {
  if (edge.status === "hypothesis") return undefined;

  if (SCENARIO_STRUCTURAL_EDGE_KINDS.has(edge.kind)) {
    if (edge.from === currentId) return edge.to;
    if (edge.to === currentId) return edge.from;
    return undefined;
  }

  if (SCENARIO_FORWARD_EDGE_KINDS.has(edge.kind)) {
    if (edge.from === currentId) return edge.to;
    if (edge.to !== currentId) return undefined;

    const current = model.nodes.find(
      (node) => node.id === currentId,
    );
    if (
      current !== undefined &&
      (
        current.kind === "objective" ||
        current.kind === "outcome" ||
        current.kind === "phase"
      ) &&
      SCENARIO_REVERSE_CONTEXT_EDGE_KINDS.has(edge.kind)
    ) {
      return edge.from;
    }
  }

  return undefined;
}

function scenarioTraversalCanExpand(
  model: GameplayIntentModel,
  nodeId: string,
  anchorId: string,
): boolean {
  if (nodeId === anchorId) return true;
  const node = model.nodes.find(
    (item) => item.id === nodeId,
  );
  if (node === undefined) return false;
  return !SCENARIO_STOP_NODE_KINDS.has(node.kind);
}

/**
 * Derive the semantic component closure for one gameplay scenario.
 *
 * This is intentionally not an undirected N-hop neighborhood. Directional
 * dependency edges follow authored flow, while structural ownership/scope
 * edges may be traversed both ways. Shared phase/objective/outcome/policy/
 * spatial nodes are included as context but stop traversal so they cannot
 * bridge unrelated sibling mechanics into the same scenario.
 */
export function gameplayScenarioNeighborhoodNodeIds(
  model: GameplayIntentModel,
  anchorId: string,
): readonly string[] {
  const known = new Set(
    model.nodes.filter(node => !isAuthoredSourceContentNode(node))
      .map((node) => node.id),
  );
  if (!known.has(anchorId)) return [];

  const visited = new Set<string>([anchorId]);
  const queue = [anchorId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (
      !scenarioTraversalCanExpand(
        model,
        current,
        anchorId,
      )
    ) {
      continue;
    }

    for (const edge of model.edges) {
      const neighbor = scenarioTraversalNeighbor(
        model,
        edge,
        current,
      );
      if (
        neighbor === undefined ||
        !known.has(neighbor) ||
        visited.has(neighbor)
      ) {
        continue;
      }
      visited.add(neighbor);
      queue.push(neighbor);
    }
  }

  return [...visited].sort();
}

function semanticDomains(
  node: GameplayIntentNode,
  model: GameplayIntentModel,
  world: GameplayWorldModel,
): Set<GameplayKnowledgeDomain> {
  const domains = new Set<GameplayKnowledgeDomain>([
    "state-flow",
  ]);

  const relatedIds = new Set(
    gameplayScenarioNeighborhoodNodeIds(
      model,
      node.id,
    ),
  );
  const relatedEdges: GameplayIntentEdge[] =
    model.edges.filter(
      (edge) =>
        edge.status !== "hypothesis" &&
        relatedIds.has(edge.from) &&
        relatedIds.has(edge.to),
    );
  const relatedNodes = model.nodes.filter((item) =>
    relatedIds.has(item.id)
  );

  if (
    relatedNodes.some((item) =>
      item.kind === "actor" || item.kind === "role"
    )
  ) {
    add(domains, "entity-behavior");
  }
  const hasActor = relatedNodes.some(
    (item) =>
      item.kind === "actor" || item.kind === "role",
  );
  const hasSpatialRegion = relatedNodes.some(
    (item) => item.kind === "spatial-region",
  );
  if (hasActor && hasSpatialRegion) {
    add(domains, "chunk-simulation");
  }
  if (
    relatedNodes.some((item) =>
      item.kind === "spatial-region"
    )
  ) {
    add(domains, "spatial-authority");
    add(domains, "world-structure");
  }
  if (
    relatedNodes.some((item) =>
      item.kind === "resource"
    )
  ) {
    if (
      world.inventory.regions > 0 ||
      world.inventory.grantRegions > 0
    ) {
      add(domains, "inventory-state");
    }
    if (world.economy.sourceKinds.length > 0) {
      add(domains, "economy-reward");
    }
  }
  if (
    relatedEdges.some((edge) =>
      edge.kind === "persists" ||
      edge.kind === "recovers-to" ||
      edge.kind === "resets"
    )
  ) {
    if ((world.persistence?.properties ?? 0) > 0) {
      add(domains, "persistence-recovery");
    }
  }
  if (
    relatedEdges.some((edge) =>
      edge.kind === "owns" ||
      edge.kind === "scoped-to"
    ) &&
    world.arenas.detected
  ) {
    add(domains, "arena-lifecycle");
  }
  if (
    node.kind === "lifecycle" &&
    world.arenas.detected
  ) {
    add(domains, "arena-lifecycle");
  }
  if (
    world.combat.hurtHandlers > 0 ||
    world.combat.deathHandlers > 0
  ) {
    if (
      relatedNodes.some((item) =>
        item.kind === "actor" ||
        item.kind === "lifecycle" ||
        item.kind === "outcome"
      )
    ) {
      add(domains, "combat-lifecycle");
    }
  }

  expandConditionalKnowledgeDomains(
    domains,
    world,
  );
  return domains;
}

function expandConditionalKnowledgeDomains(
  domains: Set<GameplayKnowledgeDomain>,
  world: GameplayWorldModel,
): void {
  const hasInventory =
    world.inventory.regions > 0 ||
    world.inventory.grantRegions > 0 ||
    world.inventory.dropRegions > 0;
  const hasEconomy =
    world.economy.sourceKinds.length > 0;
  const hasPersistence =
    (world.persistence?.properties ?? 0) > 0;
  const hasArena =
    world.arenas.detected;
  const hasChunk =
    world.chunks.tickingAreaAcquires > 0 ||
    world.chunks.tickingAreaReadinessStates > 0 ||
    world.chunks.readinessProbes > 0 ||
    world.chunks.entityResidencyObservability !== "absent";
  const hasEntity =
    world.entities.definitions > 0;
  const hasCombat =
    world.combat.hurtHandlers > 0 ||
    world.combat.deathHandlers > 0 ||
    world.combat.damageApplications > 0;

  // Conditional dependencies are activated only by coexistence of relevant
  // selected-artifact surfaces. They are proof pressure, not assumptions that
  // a defect exists.
  if (domains.has("inventory-state")) {
    if (hasPersistence) {
      domains.add("persistence-recovery");
    }
    if (hasEconomy) {
      domains.add("economy-reward");
    }
    if (hasArena) {
      domains.add("arena-lifecycle");
    }
  }

  if (domains.has("economy-reward")) {
    if (hasInventory) {
      domains.add("inventory-state");
    }
    if (hasPersistence) {
      domains.add("persistence-recovery");
    }
    domains.add("temporal-ownership");
  }

  if (domains.has("arena-lifecycle")) {
    domains.add("multiplayer-interleaving");
    if (hasChunk) {
      domains.add("chunk-simulation");
    }
  }

  if (domains.has("chunk-simulation")) {
    domains.add("platform-constraints");
    if (hasEntity) {
      domains.add("entity-behavior");
    }
  }

  if (domains.has("entity-behavior")) {
    if (hasChunk) {
      domains.add("chunk-simulation");
    }
    if (hasCombat) {
      domains.add("combat-lifecycle");
    }
  }

  if (domains.has("persistence-recovery")) {
    domains.add("temporal-ownership");
    if (hasArena) {
      domains.add("arena-lifecycle");
    }
    if (hasInventory) {
      domains.add("inventory-state");
    }
  }

  if (domains.has("combat-lifecycle")) {
    if (hasEntity) {
      domains.add("entity-behavior");
    }
    domains.add("temporal-ownership");
  }

  if (domains.has("world-structure")) {
    domains.add("spatial-authority");
    domains.add("temporal-ownership");
  }
}

function applicable(
  world: GameplayWorldModel,
  domain: GameplayKnowledgeDomain,
): boolean {
  switch (domain) {
    case "arena-lifecycle":
    case "multiplayer-interleaving":
      return world.arenas.detected;
    case "chunk-simulation":
      return (
        world.chunks.tickingAreaAcquires > 0 ||
        world.chunks.tickingAreaReadinessStates > 0 ||
        world.chunks.readinessProbes > 0 ||
        world.chunks.entityResidencyObservability !== "absent"
      );
    case "entity-behavior":
      return world.entities.definitions > 0;
    case "combat-lifecycle":
      return (
        world.combat.hurtHandlers > 0 ||
        world.combat.deathHandlers > 0 ||
        world.combat.damageApplications > 0
      );
    case "inventory-state":
      return (
        world.inventory.regions > 0 ||
        world.inventory.grantRegions > 0 ||
        world.inventory.dropRegions > 0
      );
    case "persistence-recovery":
      return (world.persistence?.properties ?? 0) > 0;
    case "world-structure":
      return (
        world.structures.definitions > 0 ||
        world.structures.loads > 0 ||
        world.structures.runtimeLogicLoads > 0
      );
    case "economy-reward":
      return world.economy.sourceKinds.length > 0;
    case "spatial-authority":
      return (
        world.spatial.resolvedScriptEffects > 0 ||
        world.spatial.structurePlacements > 0 ||
        world.spatial.authority.configured
      );
    case "platform-constraints":
      return world.platformKnowledge.profileResolved;
    case "state-flow":
    case "temporal-ownership":
      return true;
  }
}

export function requiredKnowledgeDomainsForPreset(
  kind: GameplayAuditScenarioKind,
  world: GameplayWorldModel,
): readonly GameplayKnowledgeDomain[] {
  const domains = new Set<GameplayKnowledgeDomain>([
    "state-flow",
  ]);
  const addIfApplicable = (
    domain: GameplayKnowledgeDomain,
  ) => {
    if (applicable(world, domain)) add(domains, domain);
  };

  switch (kind) {
    case "full-journey":
      // Full journey is a composition scenario. Its knowledge set is
      // derived by the scenario compiler from the concrete child scenarios.
      break;
    case "solo":
    case "two-player":
    case "max-party":
    case "party-capacity-plus-one":
      addIfApplicable("arena-lifecycle");
      addIfApplicable("multiplayer-interleaving");
      break;
    case "disconnect-reconnect":
      addIfApplicable("arena-lifecycle");
      addIfApplicable("multiplayer-interleaving");
      addIfApplicable("combat-lifecycle");
      addIfApplicable("inventory-state");
      addIfApplicable("persistence-recovery");
      break;
    case "multi-arena-parallel":
    case "arena-capacity-plus-one":
      addIfApplicable("arena-lifecycle");
      addIfApplicable("multiplayer-interleaving");
      add(domains, "platform-constraints");
      addIfApplicable("chunk-simulation");
      break;
    case "arena-replica-integrity":
      addIfApplicable("arena-lifecycle");
      addIfApplicable("world-structure");
      addIfApplicable("multiplayer-interleaving");
      break;
    case "reload-recovery":
      addIfApplicable("persistence-recovery");
      addIfApplicable("inventory-state");
      addIfApplicable("entity-behavior");
      addIfApplicable("combat-lifecycle");
      break;
    case "deferred-ownership":
      add(domains, "temporal-ownership");
      addIfApplicable("arena-lifecycle");
      addIfApplicable("persistence-recovery");
      add(domains, "platform-constraints");
      addIfApplicable("chunk-simulation");
      break;
    case "terminal-collision":
      add(domains, "temporal-ownership");
      addIfApplicable("combat-lifecycle");
      addIfApplicable("economy-reward");
      addIfApplicable("arena-lifecycle");
      break;
    case "transaction-atomicity":
      addIfApplicable("economy-reward");
      addIfApplicable("inventory-state");
      addIfApplicable("persistence-recovery");
      add(domains, "temporal-ownership");
      break;
    case "simulation-distance":
      // The scenario itself proves that simulation ownership is material.
      // Missing ticking/readiness evidence must remain visible rather than
      // making the domain appear not applicable.
      add(domains, "chunk-simulation");
      add(domains, "platform-constraints");
      addIfApplicable("entity-behavior");
      addIfApplicable("arena-lifecycle");
      addIfApplicable("spatial-authority");
      break;
    case "progression-wave-integrity":
      domains.add("chunk-simulation");
      domains.add("platform-constraints");
      addIfApplicable("entity-behavior");
      addIfApplicable("combat-lifecycle");
      addIfApplicable("arena-lifecycle");
      add(domains, "temporal-ownership");
      break;
    case "information-correctness":
      addIfApplicable("economy-reward");
      addIfApplicable("inventory-state");
      addIfApplicable("persistence-recovery");
      addIfApplicable("arena-lifecycle");
      break;
    case "player-capability-integrity":
      addIfApplicable("arena-lifecycle");
      addIfApplicable("spatial-authority");
      add(domains, "platform-constraints");
      break;
    case "world-rule-authority":
      add(domains, "platform-constraints");
      addIfApplicable("entity-behavior");
      addIfApplicable("world-structure");
      break;
    case "client-server-reconciliation":
      add(domains, "platform-constraints");
      addIfApplicable("spatial-authority");
      addIfApplicable("world-structure");
      break;
    case "spatial-containment":
      addIfApplicable("spatial-authority");
      addIfApplicable("world-structure");
      addIfApplicable("arena-lifecycle");
      add(domains, "platform-constraints");
      break;
    case "repeated-run":
      addIfApplicable("arena-lifecycle");
      addIfApplicable("world-structure");
      addIfApplicable("entity-behavior");
      addIfApplicable("inventory-state");
      addIfApplicable("economy-reward");
      addIfApplicable("persistence-recovery");
      break;
  }

  expandConditionalKnowledgeDomains(
    domains,
    world,
  );
  return [...domains].sort();
}

export function requiredKnowledgeDomainsForIntentScenario(
  node: GameplayIntentNode,
  model: GameplayIntentModel,
  world: GameplayWorldModel,
): readonly GameplayKnowledgeDomain[] {
  const domains = semanticDomains(node, model, world);
  if (domains.has("chunk-simulation")) {
    domains.add("platform-constraints");
  }
  return [...domains]
    .filter(
      (domain) =>
        domain === "chunk-simulation" ||
        domain === "platform-constraints" ||
        applicable(world, domain),
    )
    .sort();
}

export function buildGameplayKnowledgeRequirements(
  scenarioId: string,
  domains: readonly GameplayKnowledgeDomain[],
  scope: {
    readonly subjectIds?: readonly string[];
    readonly componentIds?: readonly string[];
  } = {},
  context: AnalysisExecutionContext = "REMOTE_GITHUB",
): readonly GameplayKnowledgeRequirement[] {
  const domainSet = new Set(domains);
  return domains.map((domain) => {
    const capabilityIds = capabilityIdsForDomain(
      domain,
      context,
    );
    const dependsOnRequirementIds =
      (DOMAIN_DEPENDENCIES[domain] ?? [])
        .filter((dependency) =>
          domainSet.has(dependency)
        )
        .map(
          (dependency) =>
            "knowledge:" +
            scenarioId +
            ":" +
            dependency,
        )
        .sort();
    return {
      id: "knowledge:" + scenarioId + ":" + domain,
      scenarioId,
      domain,
      reason:
        "Gameplay scenario requires " +
        domain +
        " evidence to close its causal chain.",
      capabilityIds,
      dependsOnRequirementIds,
      subjectIds: [...(scope.subjectIds ?? [])].sort(),
      componentIds: [...(scope.componentIds ?? [])].sort(),
    };
  });
}

export function expandGameplayKnowledgeRequirementIds(
  requirementIds: readonly string[],
  requirements: readonly GameplayKnowledgeRequirement[],
): readonly string[] {
  const byId = new Map(
    requirements.map((item) => [item.id, item]),
  );
  const expanded = new Set<string>();
  const visiting = new Set<string>();

  const visit = (id: string): void => {
    if (expanded.has(id) || visiting.has(id)) return;
    const requirement = byId.get(id);
    if (requirement === undefined) return;

    visiting.add(id);
    for (const dependencyId of requirement.dependsOnRequirementIds) {
      visit(dependencyId);
    }
    visiting.delete(id);
    expanded.add(id);
  };

  for (const id of requirementIds) {
    visit(id);
  }
  return [...expanded].sort();
}

export function buildGameplayKnowledgeReceipts(
  requirements: readonly GameplayKnowledgeRequirement[],
  world: GameplayWorldModel,
): readonly GameplayKnowledgeReceipt[] {
  const byId = new Map(
    requirements.map((requirement) => [
      requirement.id,
      requirement,
    ]),
  );
  const receipts = new Map<
    string,
    GameplayKnowledgeReceipt
  >();
  const visiting = new Set<string>();

  const resolve = (
    requirement: GameplayKnowledgeRequirement,
  ): GameplayKnowledgeReceipt => {
    const existing = receipts.get(requirement.id);
    if (existing) return existing;

    if (visiting.has(requirement.id)) {
      const cycleReceipt: GameplayKnowledgeReceipt = {
        requirementId: requirement.id,
        scenarioId: requirement.scenarioId,
        domain: requirement.domain,
        status: "BLOCKED_BY_PREREQUISITE",
        subjectIds: [...requirement.subjectIds],
        componentIds: [...requirement.componentIds],
        evidenceIds: [],
        knowledgeIds: [],
        capabilityIdsUsed: [],
        reason:
          "Required Inspection Graph contains a prerequisite cycle at " +
          requirement.id +
          ".",
      };
      receipts.set(requirement.id, cycleReceipt);
      return cycleReceipt;
    }

    visiting.add(requirement.id);
    const blockedDependencies: string[] = [];
    for (const dependencyId of
      requirement.dependsOnRequirementIds) {
      const dependency = byId.get(dependencyId);
      if (!dependency) {
        blockedDependencies.push(
          dependencyId + " (missing node)",
        );
        continue;
      }
      const receipt = resolve(dependency);
      if (receipt.status !== "SATISFIED") {
        blockedDependencies.push(dependencyId);
      }
    }
    visiting.delete(requirement.id);

    if (blockedDependencies.length > 0) {
      const receipt: GameplayKnowledgeReceipt = {
        requirementId: requirement.id,
        scenarioId: requirement.scenarioId,
        domain: requirement.domain,
        status: "BLOCKED_BY_PREREQUISITE",
        subjectIds: [...requirement.subjectIds],
        componentIds: [...requirement.componentIds],
        evidenceIds: [],
        knowledgeIds: [],
        capabilityIdsUsed: [],
        reason:
          "Required prerequisite inspection node(s) are not satisfied: " +
          blockedDependencies.sort().join(", ") +
          ".",
      };
      receipts.set(requirement.id, receipt);
      return receipt;
    }

    const capabilityIdsUsed =
      executedCapabilityIdsForDomain(
        world,
        requirement.domain,
      ).filter((capabilityId) =>
        requirement.capabilityIds.includes(
          capabilityId,
        )
      );
    const evidenceIds =
      domainEvidence(
        world,
        requirement.domain,
        requirement,
        requirements,
      );
    const knowledgeIds = knowledgeIdsForRequirement(
      world,
      requirement,
      requirements,
    );

    if (requirement.capabilityIds.length === 0) {
      const receipt: GameplayKnowledgeReceipt = {
        requirementId: requirement.id,
        scenarioId: requirement.scenarioId,
        domain: requirement.domain,
        status: "CAPABILITY_GAP",
        subjectIds: [...requirement.subjectIds],
        componentIds: [...requirement.componentIds],
        evidenceIds,
        knowledgeIds,
        capabilityIdsUsed: [],
        reason:
          "No analysis-planner capability is registered for this required gameplay knowledge domain.",
      };
      receipts.set(requirement.id, receipt);
      return receipt;
    }

    if (
      capabilityIdsUsed.length === 0 ||
      evidenceIds.length === 0 ||
      (
        requirement.domain === "platform-constraints" &&
        knowledgeIds.length === 0
      )
    ) {
      const receipt: GameplayKnowledgeReceipt = {
        requirementId: requirement.id,
        scenarioId: requirement.scenarioId,
        domain: requirement.domain,
        status: "MISSING_REQUIRED_KNOWLEDGE",
        subjectIds: [...requirement.subjectIds],
        componentIds: [...requirement.componentIds],
        evidenceIds: [],
        knowledgeIds: [],
        capabilityIdsUsed: [],
        reason:
          requirement.domain === "platform-constraints"
            ? "Platform capability/profile exists, but no decisive applicable platform relation claim is available for this scenario. A synthetic platform receipt alone cannot satisfy RIG."
            : "A registered capability exists, but no matching capability execution receipt returned to the scenario for this required domain.",
      };
      receipts.set(requirement.id, receipt);
      return receipt;
    }

    const receipt: GameplayKnowledgeReceipt = {
      requirementId: requirement.id,
      scenarioId: requirement.scenarioId,
      domain: requirement.domain,
      status: "SATISFIED",
      subjectIds: [...requirement.subjectIds],
      componentIds: [...requirement.componentIds],
      evidenceIds,
      knowledgeIds,
      capabilityIdsUsed,
      reason:
        requirement.domain === "platform-constraints"
          ? "Required platform knowledge is backed by an executed capability and at least one decisive applicable platform relation claim for this scenario."
          : "Required gameplay knowledge is present and tied to executed analysis capability receipt(s): " +
            capabilityIdsUsed.join(", ") +
            ".",
    };
    receipts.set(requirement.id, receipt);
    return receipt;
  };

  for (const requirement of requirements) {
    resolve(requirement);
  }

  return requirements.map(
    (requirement) => receipts.get(requirement.id)!,
  );
}
