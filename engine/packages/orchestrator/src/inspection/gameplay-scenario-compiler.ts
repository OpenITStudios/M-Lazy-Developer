import type {
  GameplayIntentEdge,
  GameplayIntentModel,
  GameplayIntentNode,
} from "../../../gameplay-intent/src/index.js";
import type {
  GameplayAuditScenarioPreset,
} from "../../../diagnostic-reasoning/src/index.js";
import type {
  GameplayWorldModel,
} from "./gameplay-world-model.js";
import {
  buildGameplayKnowledgeReceipts,
  buildGameplayKnowledgeRequirements,
  expandGameplayKnowledgeRequirementIds,
  gameplayScenarioNeighborhoodNodeIds,
  requiredKnowledgeDomainsForIntentScenario,
  requiredKnowledgeDomainsForPreset,
  isAuthoredSourceContentNode,
} from "./gameplay-scenario-knowledge.js";
import type {
  GameplayScenarioComponent,
  GameplayCausalLink,
  GameplayScenarioGraph,
  GameplayScenario,
  GameplaySourceFlowCandidate,
  GameplayMechanicReconstruction,
  GameplayJourneyCandidate,
  GameplayJourneyInterpretation,
} from "./gameplay-scenario-model.js";
import {
  semanticIrExecutionTraces, type ObservedBranchPoint, type SemanticIr,
} from "../../../semantic-ir/src/index.js";
import {
  reconcileSourceGuardedStateTransitions,
  type SourceGuardedStateTransitionCandidate,
} from "../../../behavior-model/src/index.js";

const SCENARIO_NODE_KINDS = new Set([
  "mechanic",
  "objective",
  "phase",
  "lifecycle",
  "outcome",
]);

function purposeForNode(
  node: GameplayIntentNode,
): string {
  const description = node.description?.trim();
  // Current inferred source descriptions (for example NPC button wiring)
  // describe technical surfaces, not their intended player-facing purpose.
  // Source-observed state descriptions are likewise not authored design.
  if (description && node.status === "authored" &&
      !description.startsWith("Source-observed technical")) {
    return description;
  }
  return "Gameplay purpose UNKNOWN for " + node.kind +
    ": the selected artifact identifies this subject, but its intended " +
    "player-facing purpose is not independently established." +
    (description ? " Source context: " + description : "");
}

function technicalRoleForNode(
  node: GameplayIntentNode,
): string {
  return node.kind + ": " + node.label;
}

function edgeStatus(
  edge: GameplayIntentEdge,
  sourceEvidenceIds: ReadonlySet<string>,
): GameplayCausalLink["status"] {
  // Inferred dependencies or dangling evidence IDs are never causal proof.
  return edge.status === "authored" &&
    edge.evidenceIds.some(id => sourceEvidenceIds.has(id))
      ? "PROVEN"
      : "DETECTION_GAP";
}

/**
 * Only authored relations with selected-artifact evidence can close an
 * objective/outcome impact path. Keep the exact traversed edges and their
 * proof IDs together so an inferred parallel relation cannot supply proof.
 */
function provenImpactPathFrom(
  startId: string,
  scenarioComponentIds: ReadonlySet<string>,
  intent: GameplayIntentModel,
  sourceEvidenceIds: ReadonlySet<string>,
): Pick<GameplayCausalLink, "impactPathComponentIds" | "impactPathEvidenceIds"> {
  const empty = {
    impactPathComponentIds: [],
    impactPathEvidenceIds: [],
  };
  const terminalKinds = new Set<GameplayIntentNode["kind"]>([
    "objective",
    "outcome",
  ]);
  const byId = new Map(intent.nodes.map((node) => [node.id, node]));
  const queue: { nodeIds: string[]; evidenceIds: string[] }[] = [{
    nodeIds: [startId], evidenceIds: [],
  }];
  const visited = new Set<string>([startId]);
  const impactKinds = new Set<GameplayIntentEdge["kind"]>([
    "produces", "transitions-to", "recovers-to",
    "wins-by", "loses-by", "requires",
  ]);

  for (let i = 0; i < queue.length; i += 1) {
    const path = queue[i]!;
    const currentId = path.nodeIds[path.nodeIds.length - 1]!;
    const current = byId.get(currentId);
    if (path.nodeIds.length > 1 && current && terminalKinds.has(current.kind)) {
      return {
        impactPathComponentIds: path.nodeIds,
        impactPathEvidenceIds: [...new Set(path.evidenceIds)].sort(),
      };
    }
    const next = intent.edges.filter((edge) =>
      edge.from === currentId &&
      scenarioComponentIds.has(edge.to) &&
      impactKinds.has(edge.kind) &&
      edgeStatus(edge, sourceEvidenceIds) === "PROVEN"
    ).sort((a, b) => a.to.localeCompare(b.to) || a.id.localeCompare(b.id));
    for (const edge of next) {
      if (visited.has(edge.to)) continue;
      visited.add(edge.to);
      queue.push({
        nodeIds: [...path.nodeIds, edge.to],
        evidenceIds: [
          ...path.evidenceIds,
          ...edge.evidenceIds.filter((id) => sourceEvidenceIds.has(id)),
        ],
      });
    }
  }
  return empty;
}

/**
 * Proof dimensions require source-bound evidence IDs from their real owner.
 * Runtime component IDs, derived labels and summary counts are navigation,
 * not evidence that a guard, ownership or geometry obligation is satisfied.
 */
/**
 * Reuse the canonical, source-reviewed outcome-policy coverage invariant.
 * One authored outcome can have multiple policy relations; without an exact
 * single owner we cannot attribute the coverage to any one guard.
 *
 * The admitted witness is an actual Semantic IR return-outcome ID preserved
 * on BOTH the authored relation and its complete direct-guard invariant.
 * It proves an authored return was guarded, NOT that an authorization rule
 * blocked gameplay, not an exclusion, and not a player/arena scope claim.
 */
function authoredOutcomeGuardWitnessesByEdge(
  intent: GameplayIntentModel,
  selectedEvidenceIds: ReadonlySet<string>,
): ReadonlyMap<string, readonly string[]> {
  const nodeById = new Map(intent.nodes.map((node) => [node.id, node]));
  const evidenceById = new Map(intent.evidence
    .filter((record) =>
      record.scope === "selected-artifact" &&
      record.origin === "source-code"
    )
    .map((record) => [record.id, record]));
  const coverageBySubject = new Map<string, GameplayIntentModel["invariants"][number][]>();
  for (const item of intent.invariants) {
    if (!item.id.startsWith("inv:admissible-policy:")) continue;
    const subject = item.id.slice("inv:admissible-policy:".length);
    const list = coverageBySubject.get(subject) ?? [];
    list.push(item);
    coverageBySubject.set(subject, list);
  }
  const policyEdgesByOutcome = new Map<string, GameplayIntentEdge[]>();
  for (const edge of intent.edges) {
    if (
      edge.kind !== "requires" ||
      edge.status !== "authored" ||
      nodeById.get(edge.from)?.kind !== "outcome" ||
      nodeById.get(edge.to)?.kind !== "policy"
    ) continue;
    const list = policyEdgesByOutcome.get(edge.from) ?? [];
    list.push(edge);
    policyEdgesByOutcome.set(edge.from, list);
  }

  const byEdge = new Map<string, readonly string[]>();
  for (const [outcomeId, candidates] of policyEdgesByOutcome) {
    // Coverage of one outcome does not prove which of multiple distinct
    // predicates gates any particular relationship.
    if (candidates.length !== 1) continue;
    const edge = candidates[0]!;
    const policy = nodeById.get(edge.to);
    if (!policy?.policyPredicate ||
        policy.policyPredicate.kind === "unknown" ||
        edgeStatus(edge, selectedEvidenceIds) !== "PROVEN") continue;
    const coverage = coverageBySubject.get(outcomeId) ?? [];
    if (coverage.length !== 1 ||
        coverage[0]!.id !== "inv:admissible-policy:" + outcomeId ||
        coverage[0]!.status !== "authored" ||
        coverage[0]!.strength !== "must" ||
        coverage[0]!.subjectIds.length !== 1 ||
        coverage[0]!.subjectIds[0] !== outcomeId) continue;

    const guardedReturnIds = [...new Set(edge.evidenceIds.filter((id) => {
      const observed = evidenceById.get(id);
      return selectedEvidenceIds.has(id) &&
        coverage[0]!.evidenceIds.includes(id) &&
        id.startsWith("return-outcome:") &&
        observed !== undefined &&
        // The IR return SITE must be known, not merely the file path.
        /:[1-9]\d*:[1-9]\d*$/.test(observed.locator);
    }))].sort();
    if (guardedReturnIds.length > 0) byEdge.set(edge.id, guardedReturnIds);
  }
  return byEdge;
}

function dimensionEvidenceForRuntimeComponent(
  componentId: string,
  world: GameplayWorldModel,
  sourceLocators: readonly string[],
  selectedSourceEvidenceLocators: ReadonlyMap<string, string>,
): GameplayCausalLink["dimensionEvidence"] {
  const unique = (ids: readonly string[]) => [...new Set(ids)].sort();
  switch (componentId) {
    case "runtime:arena-replica-integrity": {
      const geometry = unique(world.arenas.replicaProof
        .filter((item) =>
          item.status === "complete-proof" &&
          item.mismatchCount === 0 &&
          item.unresolvedBlocks === 0
        )
        .flatMap((item) => item.evidenceIds));
      return geometry.length > 0 ? { geometry } : {};
    }
    case "runtime:player-capability": {
      // Not every "blocked" status is a source-backed protection: an absent
      // trigger is not the same as a disabled release or an active guard.
      // These IDs describe the capability assessment only. They do not
      // establish this scenario's guard, scope or blocking exclusion.
      // A protected capability elsewhere in the map cannot satisfy this
      // scenario. Match full selected-source file identities (not basenames
      // or similar labels), then preserve only the matched witness IDs.
      const scopedFiles = new Set(sourceLocators.map(sourceFileIdentity));
      const capability = scopedFiles.size === 0 ? [] : unique(
        world.capabilityExposure.exposures
          .filter((item) =>
            (item.status === "blocked" &&
              item.resolutionBasis === "release-disabled") ||
            (item.status === "guarded" &&
              item.resolutionBasis === "active-authorization-guard")
          )
          .flatMap((item) => item.evidenceIds.filter((id) => {
            const source = selectedSourceEvidenceLocators.get(id) ??
              (id.includes("/") || id.includes("\\") ? id : undefined);
            return source !== undefined &&
              scopedFiles.has(sourceFileIdentity(source));
          }))
      );
      return capability.length > 0 ? { capability } : {};
    }
    default:
      return {};
  }
}

function stageForNode(
  node: GameplayIntentNode,
): string {
  if (node.kind === "phase") return node.label;
  if (node.kind === "objective") return "Objective";
  if (node.kind === "outcome") return "Result / Terminal";
  if (node.kind === "lifecycle") return "Lifecycle / Recovery";
  return "Gameplay";
}

function presetAnchorIds(
  kind: GameplayAuditScenarioPreset["scenarios"][number]["kind"],
  intent: GameplayIntentModel,
): readonly string[] {
  const preferredKinds: readonly GameplayIntentNode["kind"][] =
    kind === "map-type-coverage"
      ? [
          "game",
          "mechanic",
          "objective",
          "phase",
          "lifecycle",
          "state",
          "resource",
          "policy",
          "outcome",
        ]
      : kind === "multi-arena-parallel" ||
    kind === "arena-replica-integrity" ||
    kind === "arena-capacity-plus-one" ||
    kind === "player-capability-integrity" ||
    kind === "world-rule-authority"
      ? ["policy", "lifecycle", "state"]
      : kind === "client-server-reconciliation" ||
        kind === "spatial-containment"
        ? ["spatial-region", "policy", "state"]
      : kind === "disconnect-reconnect" ||
        kind === "reload-recovery" ||
        kind === "repeated-run"
        ? ["lifecycle", "state", "outcome"]
        : kind === "terminal-collision"
          ? ["outcome", "lifecycle", "state"]
          : kind === "deferred-ownership"
            ? ["lifecycle", "state", "phase"]
            : kind === "full-journey"
              ? ["phase", "objective", "outcome"]
              : ["state", "lifecycle", "policy"];

  const authored = intent.nodes.filter(
    (node) =>
      preferredKinds.includes(node.kind) &&
      node.status !== "hypothesis" &&
      !isAuthoredSourceContentNode(node),
  );

  const ranked = authored.sort((a, b) => {
    const kindRank = (node: GameplayIntentNode) =>
      preferredKinds.indexOf(node.kind);
    return (
      kindRank(a) - kindRank(b) ||
      a.id.localeCompare(b.id)
    );
  });

  return ranked.slice(0, 3).map((node) => node.id);
}

function presetPlayerCounts(
  preset: GameplayAuditScenarioPreset,
): readonly number[] {
  return [...new Set(
    preset.scenarios
      .map((scenario) => scenario.playerCount)
      .filter((value): value is number => value !== undefined),
  )].sort((a, b) => a - b);
}

function runtimeComponents(
  world: GameplayWorldModel,
): readonly Omit<GameplayScenarioComponent, "usedByScenarioIds" | "orphan">[] {
  const output: Omit<GameplayScenarioComponent, "usedByScenarioIds" | "orphan">[] = [];
  if (world.arenas.detected) {
    output.push({
      id: "runtime:arena",
      label: "Arena ownership and capacity",
      kind: "runtime-domain",
      technicalRole: "Arena assignment, concurrency, isolation, cleanup, and reuse.",
      gameplayPurpose: "Keep simultaneous player sessions independent and make visible arena capacity actually playable.",
      evidenceIds: ["world:arena-count"],
    });
  }
  if (
    world.arenas.detected &&
    (world.arenas.count ?? 0) > 1
  ) {
    output.push({
      id: "runtime:arena-replica-integrity",
      label: "Arena replica integrity",
      kind: "runtime-domain",
      technicalRole: "World/topology equivalence and material delta classification across configured arena replicas.",
      gameplayPurpose: "Prevent incomplete or materially diverged physical arenas from inheriting the canonical arena's gameplay safety.",
      evidenceIds: ["runtime:arena-replica-integrity"],
    });
  }
  if (
    world.arenas.cleanup.resourceLedger.resources > 0
  ) {
    output.push({
      id: "runtime:arena-cleanup",
      label: "Arena cleanup resource ledger",
      kind: "runtime-domain",
      technicalRole: "Acquired gameplay resources and their terminal release coverage across tags, effects, scoreboards, callbacks, entities, permissions, membership, and dynamic properties.",
      gameplayPurpose: "Return every completed or aborted session to a reusable baseline without leaking Run 1 state into Run 2.",
      evidenceIds: ["runtime:arena-cleanup"],
    });
  }
  if (
    world.chunks.tickingAreaAcquires > 0 ||
    world.chunks.tickingAreaReadinessStates > 0 ||
    world.chunks.capacityUncheckedLeases > 0 ||
    world.entities.definitions > 0
  ) {
    output.push({
      id: "runtime:chunks",
      label: "Chunk and ticking simulation",
      kind: "runtime-domain",
      technicalRole: "Chunk residency, ticking-area acquisition, readiness, and release.",
      gameplayPurpose: "Keep remote gameplay actors and world logic simulated when progression depends on them.",
      evidenceIds: ["runtime:chunks"],
    });
  }
  if (world.entities.definitions > 0) {
    output.push({
      id: "runtime:entities",
      label: "Entity lifecycle and navigation",
      kind: "runtime-domain",
      technicalRole: "Entity spawn, AI, target, navigation, removal, and lifecycle evidence.",
      gameplayPurpose: "Make configured actors actually spawn, act, move, terminate, and contribute to progression.",
      evidenceIds: ["runtime:entities"],
    });
  }
  if (
    world.combat.hurtHandlers > 0 ||
    world.combat.deathHandlers > 0 ||
    world.combat.damageApplications > 0
  ) {
    output.push({
      id: "runtime:combat",
      label: "Combat lifecycle",
      kind: "runtime-domain",
      technicalRole: "Damage, death, projectile, revive, and combat terminal ownership.",
      gameplayPurpose: "Keep combat outcomes, death, revive, and terminal transitions consistent with player state.",
      evidenceIds: ["runtime:combat"],
    });
  }
  if (world.inventory.regions > 0 || world.inventory.grantRegions > 0) {
    output.push({
      id: "runtime:inventory",
      label: "Inventory and equipment lifecycle",
      kind: "runtime-domain",
      technicalRole: "Inventory grant, reset, drop, equipment, and restore ownership.",
      gameplayPurpose: "Keep kits, items, rewards, death state, reconnect state, and retry state correct for each player.",
      evidenceIds: ["runtime:inventory"],
    });
  }
  if ((world.persistence?.properties ?? 0) > 0) {
    output.push({
      id: "runtime:persistence",
      label: "Persistence and recovery",
      kind: "runtime-domain",
      technicalRole: "Persisted state scope, lifetime, reload, and recovery reconstruction.",
      gameplayPurpose: "Preserve or intentionally restart material gameplay state across reload and reconnect.",
      evidenceIds: ["runtime:persistence"],
    });
  }
  if (
    world.structures.loads > 0 ||
    world.structures.runtimeLogicLoads > 0
  ) {
    output.push({
      id: "runtime:structures",
      label: "World and structure setup",
      kind: "runtime-domain",
      technicalRole: "Structure load, placement, world setup, transition residue, and mutation.",
      gameplayPurpose: "Prepare the playable world state before a stage begins and restore it for later runs.",
      evidenceIds: ["runtime:structures"],
    });
  }
  if (world.economy.sourceKinds.length > 0) {
    output.push({
      id: "runtime:economy",
      label: "Economy and rewards",
      kind: "runtime-domain",
      technicalRole: "Reward sources, score/currency mutation, pickup, and idempotency.",
      gameplayPurpose: "Make progression rewards and scoring match what the player actually achieved.",
      evidenceIds: ["runtime:economy"],
    });
  }
  if (
    world.worldRules.writes > 0 ||
    world.worldRules.manualEntitySpawnPaths > 0
  ) {
    output.push({
      id: "runtime:world-rules",
      label: "World-rule and environment authority",
      kind: "runtime-domain",
      technicalRole: "Gamerule writers and manual entity-spawn mechanisms.",
      gameplayPurpose: "Attribute world behavior to the exact governing rule or spawn mechanism instead of conflating natural and privileged/manual paths.",
      evidenceIds: ["runtime:environment"],
    });
  }
  if (
    world.playerCapabilities.gamemodeWrites > 0 ||
    world.playerCapabilities.abilityWrites > 0 ||
    world.playerCapabilities.commandPermissionWrites > 0 ||
    world.playerCapabilities.privilegedGuardReferences > 0 ||
    world.playerCapabilities.protectionDefinitions > 0 ||
    world.capabilityExposure.exposed > 0 ||
    world.capabilityExposure.potentiallyExposed > 0 ||
    world.capabilityExposure.unresolved > 0
  ) {
    output.push({
      id: "runtime:player-capability",
      label: "Player capability and privileged-role authority",
      kind: "runtime-domain",
      technicalRole: "Gamemode, ability, command permission, privileged guards and protection activation.",
      gameplayPurpose: "Keep Builder, Roommaster/operator and developer privileges scoped to their intended gameplay and maintenance responsibilities.",
      evidenceIds: ["runtime:player-capability"],
    });
  }
  if (
    world.clientReconciliation.predictedMutationCancellations > 0
  ) {
    output.push({
      id: "runtime:client-reconciliation",
      label: "Client/server world-mutation reconciliation",
      kind: "runtime-domain",
      technicalRole: "Client-predicted world actions cancelled by server-side before-event protection.",
      gameplayPurpose: "Ensure a rejected world mutation converges to the same authoritative state on the acting client and other clients.",
      evidenceIds: ["runtime:client-reconciliation"],
    });
  }
  if (
    world.spatial.resolvedScriptEffects > 0 ||
    world.spatial.structurePlacements > 0 ||
    world.spatial.authority.configured
  ) {
    output.push({
      id: "runtime:spatial",
      label: "Spatial authority and collision/world interaction",
      kind: "runtime-domain",
      technicalRole: "World-space mutation, interaction ownership and physical/spatial constraints.",
      gameplayPurpose: "Ensure player and world interactions remain inside the intended physical and authority boundaries.",
      evidenceIds: ["runtime:spatial"],
    });
  }
  return output;
}

function normalizedLocator(value: string): string {
  return value.replaceAll("\\", "/").toLowerCase();
}

/** Exact file identity, ignoring only source range suffixes. */
function sourceFileIdentity(value: string): string {
  return normalizedLocator(value)
    .replace(/#l[1-9][0-9]*$/, "")
    .replace(/:[1-9][0-9]*:[1-9][0-9]*$/, "");
}

function scriptMatchesScenarioScope(
  scriptId: string,
  sourceLocators: readonly string[],
): boolean {
  const script = normalizedLocator(scriptId);
  return sourceLocators.some((locator) => {
    const normalized = normalizedLocator(locator);
    return (
      normalized === script ||
      normalized.endsWith("/" + script) ||
      normalized.includes("/" + script + ".") ||
      script.endsWith("/" + normalized)
    );
  });
}

function scopedByScript<T extends { scriptId: string }>(
  items: readonly T[],
  sourceLocators: readonly string[],
): readonly T[] {
  if (sourceLocators.length === 0) return [];
  return items.filter((item) =>
    scriptMatchesScenarioScope(
      item.scriptId,
      sourceLocators,
    )
  );
}

function identifierMatchesScenarioScope(
  identifier: string,
  sourceLocators: readonly string[],
): boolean {
  if (sourceLocators.length === 0) return false;
  const raw = normalizedLocator(identifier);
  const tail = raw.split(":").at(-1) ?? raw;
  return sourceLocators.some((locator) => {
    const normalized = normalizedLocator(locator).split("#")[0]!;
    const basename =
      normalized.split("/").at(-1)?.replace(/\.[^.]+$/, "") ?? normalized;
    return (
      normalized.includes(raw) ||
      basename === tail ||
      normalized.endsWith("/" + tail) ||
      normalized.includes("/" + tail + ".")
    );
  });
}

function aggregateCannotBeScoped(
  aggregateProblem: boolean,
  sourceLocators: readonly string[],
  scopedCount: number,
  domain: string,
): Pick<GameplayCausalLink, "status" | "reason"> | undefined {
  if (
    aggregateProblem &&
    sourceLocators.length > 0 &&
    scopedCount === 0
  ) {
    return {
      status: "DETECTION_GAP",
      reason:
        domain +
        " problems exist elsewhere in the selected artifact, but none are source-correlated to this scenario. Do not promote a domain-global contradiction into this scenario.",
    };
  }
  return undefined;
}


/**
 * A domain-wide lack of detected problems is not positive proof of a
 * selected scenario. Preserve UNKNOWN when its relevant owner produced no
 * source-correlated assessment, even if other parts of the map were scanned.
 */
function missingScenarioScopeEvidence(
  sourceLocators: readonly string[],
  matchedAssessments: number,
  domain: string,
): Pick<GameplayCausalLink, "status" | "reason"> | undefined {
  if (matchedAssessments > 0) return undefined;
  return {
    status: "DETECTION_GAP",
    reason: sourceLocators.length === 0
      ? domain + " has no selected-artifact source locator for this scenario; no scoped positive proof is available."
      : domain + " has no assessment matching this scenario's selected-artifact source locators; absence of contradiction is not proof.",
  };
}

function runtimeEdgeState(
  componentId: string,
  world: GameplayWorldModel,
  sourceLocators: readonly string[] = [],
  scenarioLabel?: string,
): Pick<GameplayCausalLink, "status" | "reason" | "runtimeNativeReason"> {
  switch (componentId) {
    case "runtime:world-rules": {
      if (
        world.arenas.detected &&
        world.arenas.globalState
          .unleasedArenaMutations > 0
      ) {
        return {
          status: "CONTRADICTED",
          reason:
            "Arena-owned gameplay mutates world-global state without a matching global ownership/lease path. A world-level gamerule or environment change cannot be treated as arena-local, so concurrent sessions can interfere without any player playtest being required to establish the ownership defect.",
        };
      }
      if (
        world.arenas.detected &&
        (
          world.arenas.globalState
            .unauditedArenaMutations > 0 ||
          world.arenas.globalState.assessments.some(
            (item) =>
              item.status ===
                "partial-lease-evidence",
          )
        )
      ) {
        return {
          status: "DETECTION_GAP",
          reason:
            "Arena-owned world-global mutation has only partial ownership/audit evidence. Keep it explicitly unresolved and complete the source-side lease/arbitration proof before requesting Minecraft runtime validation.",
        };
      }
      if (world.worldRules.conflicts > 0) {
        return {
          status: "DETECTION_GAP",
          reason:
            "The same gamerule has multiple selected-artifact values; lifecycle/order intent must be resolved before treating either value as the effective world baseline.",
        };
      }
      if (
        world.worldRules.writes === 0 ||
        world.worldRules.naturalMobSpawning === "unresolved" ||
        world.worldRules.naturalMobSpawning === "conflicted"
      ) {
        return {
          status: "DETECTION_GAP",
          reason: "World-rule authority has no resolved, selected-source rule writer/state; non-conflict alone cannot prove the effective environment baseline.",
        };
      }
      return {
        status: "PROVEN",
        reason:
          "World-rule writers are internally non-conflicting. Natural mob spawning is " +
          world.worldRules.naturalMobSpawning +
          ", while " +
          String(world.worldRules.manualEntitySpawnPaths) +
          " manual/script spawn path(s) are tracked separately.",
      };
    }
    case "runtime:player-capability": {
      if (world.capabilityExposure.exposed > 0) {
        const exposed = world.capabilityExposure.exposures
          .filter((item) => item.status === "exposed")
          .map((item) =>
            item.capabilityId +
            " (" +
            item.impact +
            ", prerequisite=" +
            item.prerequisiteReachability +
            ")"
          )
          .sort();
        return {
          status: "CONTRADICTED",
          reason:
            "Selected-artifact reachability proves release-enabled restricted capability exposure without its required authorization gate: " +
            exposed.join(", ") +
            ". Runtime reproduction is not required to establish the exposure; gameplay translation still determines the reportable player consequence.",
        };
      }
      if (world.capabilityExposure.potentiallyExposed > 0) {
        return {
          status: "DETECTION_GAP",
          reason:
            "Restricted capability exposure is source-detected, but ordinary-player prerequisite reachability or active-guard status is not yet fully proven. Resolve the selected-artifact reachability/guard path before any local Minecraft test.",
        };
      }
      if (world.playerCapabilities.inactiveProtectionDefinitions > 0) {
        return {
          status: "DETECTION_GAP",
          reason:
            "Protection code is defined but not instantiated; inactive protection cannot be credited as a blocking guard.",
        };
      }
      if (
        world.capabilityMutationFootprint.partial > 0 ||
        world.capabilityMutationFootprint.unresolved > 0
      ) {
        const residual = world.capabilityMutationFootprint.surfaces
          .filter((item) => item.status !== "covered")
          .map((item) => item.surface + "=" + item.status)
          .join(", ");
        return {
          status: "DETECTION_GAP",
          reason:
            "Broad player capability has unresolved mutation/reset footprint: " +
            residual +
            ". Resolve these exact residuals before treating the role as safely contained.",
        };
      }
      if (world.playerCapabilities.privilegedBypassReturns > 0) {
        return {
          status: "DETECTION_GAP",
          reason:
            "Privileged/admin early-return bypasses exist and require exact scope/impact proof before they can be classified safe or defective.",
        };
      }
      if (
        world.capabilityExposure.exposures.length === 0 ||
        world.capabilityExposure.unresolved > 0 ||
        world.capabilityExposure.exposures.some((item) => item.status === "unknown")
      ) {
        return {
          status: "DETECTION_GAP",
          reason: "Player capability mutations are present, but no source-correlated authorization/activation assessment establishes their safety.",
        };
      }
      return {
        status: "PROVEN",
        reason:
          "Detected player capability mutations have complete discovered reset/protection coverage and no inactive protection definition or unresolved privileged bypass signal.",
      };
    }
    case "runtime:client-reconciliation": {
      if (
        world.clientReconciliation.predictedMutationCancellations > 0
      ) {
        return {
          status: "RUNTIME_BLOCKED",
          runtimeNativeReason: "client-reconciliation" as const,
          reason:
            "Server-side cancellation of a client-predicted world mutation is source-proven, but actual client visual reconciliation is native runtime behavior. One narrow multi-client comparison is required; broad manual playthrough is not.",
        };
      }
      return {
        status: "PROVEN",
        reason:
          "No client-predicted world-mutation cancellation surface was detected for this scenario.",
      };
    }
    case "runtime:spatial": {
      if (scenarioLabel === "spatial-containment") {
        if (world.arenas.barrierContainment.status === "contained") {
          return {
            status: "PROVEN",
            reason:
              "Barrier-only exterior flood-fill cannot reach any authored arena volume in any replica. Physical barrier containment is established without treating loading bounds as collision bounds.",
          };
        }
        if (
          world.arenas.barrierContainment.status === "incomplete" ||
          world.arenas.barrierContainment.status === "budget-exceeded" ||
          world.arenas.barrierContainment.status === "not-run"
        ) {
          return {
            status: "DETECTION_GAP",
            reason:
              "Physical containment proof is incomplete or unavailable; an arena-escape finding must not be promoted from movement capability or loading-bound evidence alone.",
          };
        }
        return {
          status: "DETECTION_GAP",
          reason:
            "Barrier-only proof does not establish a closed enclosure. Other collision geometry must be checked before deciding whether physical escape is actually reachable.",
        };
      }
      if (world.spatial.authority.conflicts > 0) {
        return {
          status: "CONTRADICTED",
          reason:
            "Spatial authority rules conflict for one or more selected-artifact interactions.",
        };
      }
      if (
        !world.spatial.authority.configured ||
        !world.spatial.authority.policyValid ||
        world.spatial.authority.resolved === 0
      ) {
        return {
          status: "DETECTION_GAP",
          reason: "Spatial mutation/interaction exists but there is no resolved, valid authority policy covering this dependency.",
        };
      }
      if (
        world.spatial.authority.uncovered > 0 ||
        world.spatial.authority.unknownRegions > 0 ||
        world.spatial.unresolvedScriptMutations > 0
      ) {
        return {
          status: "DETECTION_GAP",
          reason:
            "Spatial authority or world-mutation coverage remains incomplete.",
        };
      }
      return {
        status: "PROVEN",
        reason:
          "Spatial mutation and authority coverage has no unresolved contradiction for the mapped dependency.",
      };
    }
    case "runtime:arena-replica-integrity": {
      if (world.arenas.replicaIntegrity.diverged > 0) {
        return {
          status: "CONTRADICTED",
          reason:
            "One or more configured arena replicas diverge from the canonical arena. Replica divergence must be classified for gameplay materiality before baseline safety can be reused.",
        };
      }
      if (
        world.arenas.replicaIntegrity.incomplete > 0 ||
        world.arenas.replicaIntegrity.noProof > 0 ||
        world.arenas.replicaIntegrity.bounded > 0
      ) {
        return {
          status: "DETECTION_GAP",
          reason:
            "Arena replica proof is incomplete or bounded. A configured/playable replica cannot inherit canonical arena safety until world/topology proof is complete or every material delta is classified.",
        };
      }
      if (
        world.arenas.replicaProof.length <
          Math.max(1, (world.arenas.count ?? 1) - 1) ||
        world.arenas.replicaProof.some((item) =>
          item.status !== "complete-proof" ||
          item.mismatchCount > 0 ||
          item.unresolvedBlocks > 0
        )
      ) {
        return {
          status: "DETECTION_GAP",
          reason: "Configured arena replicas have no source-bound complete equivalence proof; a lack of recorded divergence is not positive evidence.",
        };
      }
      return {
        status: "PROVEN",
        reason:
          "Configured arena replicas have complete equivalence proof with no unclassified material divergence.",
      };
    }
    case "runtime:arena": {
      if (
        scenarioLabel === "deferred-ownership" &&
        world.arenas.lifecycle
          .unresolvedDeferredMutations > 0
      ) {
        const deferred =
          world.arenas.lifecycle
            .deferredMutations
            .filter((item) =>
              item.status === "unresolved"
            )
            .map((item) =>
              item.scriptId +
              ":" +
              item.callbackRegion +
              " -> " +
              item.mutationRegions.join(" | ")
            )
            .sort();
        return {
          status: "DETECTION_GAP",
          reason:
            "Deferred gameplay mutation reaches mutable session/arena state without source-proven generation/session revalidation: " +
            deferred.join("; ") +
            ". Keep ownership unresolved until a generation/session guard or a blocking exclusion is proven.",
        };
      }

      if (
        scenarioLabel === "terminal-collision" &&
        world.arenas.lifecycle
          .terminalPrecedenceUnresolved > 0
      ) {
        return {
          status: "DETECTION_GAP",
          reason:
            "Multiple terminal ingress paths exist without source-proven deterministic outcome precedence or tie policy. A one-shot latch can prevent duplicate commit but does not prove which simultaneous terminal outcome wins.",
        };
      }

      if (
        scenarioLabel === "terminal-collision" &&
        world.arenas.lifecycle
          .provenTerminalRaces > 0
      ) {
        const races =
          world.arenas.lifecycle.terminalRaces
            .filter((item) =>
              item.status ===
                "contradicted"
            )
            .map((item) =>
              item.terminalRegion +
              " <= " +
              item.ingresses
                .map((ingress) =>
                  ingress.kind +
                  ":" +
                  ingress.id
                )
                .join(" | ")
            )
            .sort();
        return {
          status: "CONTRADICTED",
          reason:
            "A terminal owner is reachable from an unguarded deferred ingress and another distinct terminal ingress while no source-proven one-shot terminal latch blocks re-entry: " +
            races.join("; ") +
            ". This is a static terminal-race/double-ending contradiction and does not require broad runtime reproduction.",
        };
      }
      if (
        scenarioLabel === "terminal-collision" &&
        world.arenas.lifecycle
          .unresolvedTerminalRaces > 0
      ) {
        const races =
          world.arenas.lifecycle.terminalRaces
            .filter((item) =>
              item.status ===
                "unresolved"
            )
            .map((item) =>
              item.terminalRegion +
              " <= " +
              item.ingresses
                .map((ingress) =>
                  ingress.kind +
                  ":" +
                  ingress.id
                )
                .join(" | ")
            )
            .sort();
        return {
          status: "DETECTION_GAP",
          reason:
            "Different terminal ingresses converge on the same terminal owner, but source evidence does not yet prove coexistence or a blocking/idempotent exclusion: " +
            races.join("; ") +
            ". Keep this terminal-collision state explicit as unresolved rather than calling it a bug or safe.",
        };
      }
      if (
        scenarioLabel === "terminal-collision" &&
        world.arenas.lifecycle
          .multiIngressTerminalTargets >
        world.arenas.lifecycle
          .terminalRaces.length
      ) {
        const targets =
          world.arenas.lifecycle.terminalIngresses
            .filter((item) =>
              item.status ===
                "multi-ingress"
            )
            .map((item) =>
              item.terminalRegion +
              " <= " +
              item.incomingCallerRegions.join(" | ")
            )
            .sort();
        return {
          status: "DETECTION_GAP",
          reason:
            "Multiple independent source paths can enter a terminal owner, but their concrete event/deferred ingress provenance is not fully resolved: " +
            targets.join("; ") +
            ". Preserve this gray-zone until exactly-once ownership can be proven.",
        };
      }
      const reduced =
        world.arenas.count !== undefined &&
        world.arenas.safeConcurrentArenas !== undefined &&
        world.arenas.safeConcurrentArenas !== null &&
        world.arenas.safeConcurrentArenas < world.arenas.count;
      const scopedIsolation = scopedByScript(
        world.arenas.isolation.observations,
        sourceLocators,
      );
      const mutationById = new Map(
        world.arenas.globalState.mutations.map((item) => [
          item.id,
          item,
        ]),
      );
      const scopedGlobalAssessments =
        world.arenas.globalState.assessments.filter((item) => {
          const mutation = mutationById.get(item.mutationId);
          return (
            mutation !== undefined &&
            scriptMatchesScenarioScope(
              mutation.ownerId,
              sourceLocators,
            )
          );
        });
      const isolationGap =
        scopedIsolation.some(
          (item) => item.status === "shared-global",
        ) ||
        scopedGlobalAssessments.some(
          (item) => item.status === "unleased",
        );
      if (reduced || isolationGap) {
        return {
          status: "CONTRADICTED",
          reason:
            reduced
              ? "Selected-artifact arena capacity is player-visible at " +
                String(world.arenas.count) +
                " arena(s), but only " +
                String(world.arenas.safeConcurrentArenas) +
                " can run concurrently. Queue/fallback behavior and platform/resource limits explain or mitigate the implementation constraint but are not counter-proof for the gameplay/design capacity mismatch."
              : "Cross-arena ownership/isolation evidence contradicts the scenario dependency.",
        };
      }
      if (
        scopedIsolation.some(
          (item) =>
            item.status === "unknown" ||
            item.status === "partition-proof-required",
        ) ||
        scopedGlobalAssessments.some(
          (item) =>
            item.status === "partial-lease-evidence" ||
            !item.audited,
        ) ||
        world.arenas.lifecycle.unresolved > 0
      ) {
        return {
          status: "DETECTION_GAP",
          reason:
            "Arena lifecycle/isolation evidence remains unresolved.",
        };
      }
      const missingScope = missingScenarioScopeEvidence(
        sourceLocators, scopedIsolation.length + scopedGlobalAssessments.length, "Arena lifecycle/isolation",
      );
      if (missingScope) return missingScope;
      return {
        status: "PROVEN",
        reason: "Arena ownership/capacity evidence has no unresolved contradiction for this dependency.",
      };
    }
    case "runtime:chunks": {
      if (
        world.chunks.tickingAreaAcquires === 0 &&
        world.chunks.tickingAreaReadinessStates === 0 &&
        world.chunks.readinessProbes === 0
      ) {
        return {
          status: "CONTRADICTED",
          reason:
            "This gameplay scenario requires explicit chunk/simulation ownership, but the selected artifact exposes no ticking-area acquisition/readiness mechanism for the dependency.",
        };
      }

      const badStatuses = new Set([
        "acquire-without-release",
        "release-unreachable",
        "capacity-unchecked",
      ]);
      const unresolvedStatuses = new Set([
        "readiness-unverified",
        "cleanup-order-unproven",
        "dynamic-key",
      ]);
      const scopedLeases =
        sourceLocators.length === 0
          ? []
          : world.chunks.leases.filter((lease) =>
              scriptMatchesScenarioScope(
                lease.scriptId,
                sourceLocators,
              )
            );
      const scopedBad = scopedLeases.filter((lease) =>
        badStatuses.has(lease.status)
      );
      const scopedUnresolved = scopedLeases.filter((lease) =>
        unresolvedStatuses.has(lease.status)
      );

      if (scopedBad.length > 0) {
        return {
          status: "CONTRADICTED",
          reason:
            "Scoped chunk/ticking lease evidence for this scenario contains: " +
            scopedBad
              .map((lease) =>
                lease.scriptId +
                ":" +
                (lease.leaseKey ?? "<dynamic>") +
                "=" +
                lease.status
              )
              .join(", ") +
            ".",
        };
      }

      if (scopedUnresolved.length > 0) {
        return {
          status: "DETECTION_GAP",
          reason:
            "Scoped chunk/ticking lease evidence for this scenario remains unresolved: " +
            scopedUnresolved
              .map((lease) =>
                lease.scriptId +
                ":" +
                (lease.leaseKey ?? "<dynamic>") +
                "=" +
                lease.status
              )
              .join(", ") +
            ".",
        };
      }

      const aggregateProblem =
        world.chunks.acquireWithoutRelease > 0 ||
        world.chunks.releaseUnreachable > 0 ||
        world.chunks.capacityUncheckedLeases > 0 ||
        world.chunks.unguardedDeferredChunkWork > 0 ||
        world.chunks.readinessUnverifiedLeases > 0 ||
        world.chunks.cleanupOrderUnproven > 0;

      if (
        aggregateProblem &&
        sourceLocators.length > 0 &&
        scopedLeases.length === 0
      ) {
        return {
          status: "DETECTION_GAP",
          reason:
            "Chunk/ticking problems exist elsewhere in the selected artifact, but none are source-correlated to this scenario. Do not contaminate this scenario with a domain-global contradiction.",
        };
      }

      const missingScope = missingScenarioScopeEvidence(
        sourceLocators, scopedLeases.length, "Chunk/ticking ownership",
      );
      if (missingScope) return missingScope;
      return {
        status: "PROVEN",
        reason:
          "Chunk/ticking ownership has no scoped contradiction for the mapped gameplay dependency.",
      };
    }
    case "runtime:entities": {
      if (
        scenarioLabel ===
          "progression-wave-integrity" &&
        world.progression.actorAccounting
          .provenCrossIngressEffectCalls > 0
      ) {
        const effects =
          world.progression.actorAccounting
            .crossIngressEffectCalls
            .filter((item) =>
              item.status ===
                "contradicted"
            )
            .map((item) =>
              item.ingress +
              " -> " +
              item.target +
              " callbacks=" +
              String(
                item.callbackRegions.length,
              ) +
              " ordinalAdvance=" +
              String(
                item.directOrdinalAmount,
              )
            )
            .sort();
        return {
          status: "CONTRADICTED",
          reason:
            "A single exact event ingress reaches the same progression effect through multiple unconditional callbacks, and that effect directly advances progression without a source-proven one-shot latch: " +
            effects.join("; ") +
            ". This is a static cross-ingress exactly-once violation and does not require runtime reproduction.",
        };
      }
      if (
        scenarioLabel ===
          "progression-wave-integrity" &&
        world.progression.actorAccounting
          .provenCrossIngressOrdinalAdvances > 0
      ) {
        const ingresses =
          world.progression.actorAccounting
            .crossIngressOrdinalAdvances
            .map((item) =>
              item.ingress +
              " -> " +
              item.target +
              " callbacks=" +
              String(
                item.callbackRegions.length,
              ) +
              " totalAdvance=" +
              String(item.totalAmount)
            )
            .sort();
        return {
          status: "CONTRADICTED",
          reason:
            "A single exact event ingress fans out to multiple unconditional callbacks that directly advance the same progression ordinal: " +
            ingresses.join("; ") +
            ". One event occurrence therefore advances progression more than once; this is a static cross-ingress exactly-once violation.",
        };
      }
      if (
        scenarioLabel ===
          "progression-wave-integrity" &&
        world.progression.actorAccounting
          .duplicateProgressionAdvances > 0
      ) {
        const advances =
          world.progression.actorAccounting
            .progressionAdvances
            .filter((item) =>
              item.status ===
                "duplicate"
            )
            .map((item) =>
              item.counterId +
              "->" +
              item.effectTarget +
              " calls=" +
              String(item.calls) +
              " region=" +
              item.executionRegion
            )
            .sort();
        return {
          status: "CONTRADICTED",
          reason:
            "A single source completion gate invokes the same progression effect more than once for the same counter: " +
            advances.join("; ") +
            ". This proves an exactly-once progression ownership violation and a static double-advance risk without runtime reproduction.",
        };
      }
      if (
        scenarioLabel ===
          "progression-wave-integrity" &&
        world.progression.actorAccounting
          .deadEndStateMachines > 0
      ) {
        const machines =
          world.progression.actorAccounting
            .stateMachines
            .filter((item) =>
              item.status === "dead-end"
            )
            .map((item) =>
              item.tableName +
              " dead-end=[" +
              item.deadEndStates.join(",") +
              "]" +
              (
                item.sourceEnteredDeadEndStates
                  .length > 0
                  ? " source-entered=[" +
                    item.sourceEnteredDeadEndStates.join(",") +
                    "]"
                  : ""
              )
            )
            .sort();
        return {
          status: "CONTRADICTED",
          reason:
            "Authored progression state-machine contract contains active-reachable state(s) with no legal path to a recognized completion/terminal state: " +
            machines.join("; ") +
            ". This is a static progression dead-end/design mismatch; source-entered dead-end states are called out when present, and runtime reproduction is not required.",
        };
      }
      if (
        scenarioLabel ===
          "progression-wave-integrity" &&
        world.progression.actorAccounting
          .invalidStateTransitions > 0
      ) {
        const transitions =
          world.progression.actorAccounting
            .stateTransitions
            .filter((item) =>
              item.status === "invalid"
            )
            .map((item) =>
              item.target +
              ":" +
              item.from +
              "->" +
              item.to +
              " allowed=[" +
              item.allowedTargets.join(",") +
              "]"
            )
            .sort();
        return {
          status: "CONTRADICTED",
          reason:
            "Selected-artifact source performs guarded gameplay state transition(s) that violate the uniquely correlated authored transition table: " +
            transitions.join("; ") +
            ". This is a static design/state-machine mismatch and does not require runtime reproduction.",
        };
      }
      if (
        scenarioLabel ===
          "progression-wave-integrity" &&
        world.progression.actorAccounting
          .provenActiveInstantDespawnWithoutReconciliation > 0
      ) {
        const actors =
          world.progression.actorAccounting.details
            .flatMap((item) =>
              item.uncoveredActiveInstantDespawnActorIdentifiers
            )
            .filter((id, index, all) =>
              all.indexOf(id) === index
            )
            .sort();
        return {
          status: "CONTRADICTED",
          reason:
            "Selected-artifact source proves counted actor type(s) can activate minecraft:instant_despawn under an active gameplay state guard while no matching entity-remove reconciliation reaches the actor counter: " +
            actors.join(", ") +
            ". Active-state ownership may come from a direct guard, a parser-declared state-machine state reachable from an explicit active anchor, a source-proven active-state transition followed by calls/events in the same sequential block, or propagation through the source call graph; this is an active-wave counter convergence contradiction and does not require runtime reproduction.",
        };
      }
      if (
        scenarioLabel ===
          "progression-wave-integrity" &&
        world.progression.actorAccounting
          .provenImmediateDespawnWithoutReconciliation > 0
      ) {
        const actors =
          world.progression.actorAccounting.details
            .flatMap((item) =>
              item.uncoveredImmediateDespawnActorIdentifiers
            )
            .filter((id, index, all) =>
              all.indexOf(id) === index
            )
            .sort();
        return {
          status: "CONTRADICTED",
          reason:
            "Selected-artifact entity definitions prove counted actor type(s) include base minecraft:instant_despawn while their actor counter has no matching remove reconciliation path: " +
            actors.join(", ") +
            ". The actor population can disappear immediately without converging the progression counter, so runtime reproduction is not required to establish the contradiction.",
        };
      }
      if (
        scenarioLabel ===
          "progression-wave-integrity" &&
        world.progression.actorAccounting
          .provenSpawnQuantityMismatch > 0
      ) {
        const counters =
          world.progression.actorAccounting.details
            .filter((item) =>
              item.status ===
                "spawn-quantity-mismatch"
            )
            .map((item) =>
              item.counterId +
              " quantity-mismatch=" +
              String(
                item.quantityMismatchGrowths,
              )
            )
            .sort();
        return {
          status: "CONTRADICTED",
          reason:
            "Selected-artifact wave accounting proves a deterministic direct spawn quantity does not match the actor-counter growth amount: " +
            counters.join("; ") +
            ". The counter and spawned population diverge in the same source path, so runtime reproduction is not required to establish this progression contradiction.",
        };
      }
      if (
        scenarioLabel ===
          "progression-wave-integrity" &&
        world.progression.actorAccounting
          .provenActorIdentityMismatch > 0
      ) {
        const counters =
          world.progression.actorAccounting.details
            .filter((item) =>
              item.status ===
                "actor-identity-mismatch"
            )
            .map((item) =>
              item.counterId +
              " spawn=[" +
              item.spawnLinkedActorIdentifiers.join(",") +
              "] reconcile=[" +
              item.lifecycleActorIdentifiers.join(",") +
              "]"
            )
            .sort();
        return {
          status: "CONTRADICTED",
          reason:
            "Selected-artifact actor accounting proves counter growth is linked to one actor identity while the lifecycle-linked decrement is guarded for a different actor identity: " +
            counters.join("; ") +
            ". The counted actor has no matching reconciliation path, so runtime reproduction is not required to establish the identity mismatch.",
        };
      }
      if (
        scenarioLabel ===
          "progression-wave-integrity" &&
        world.progression.actorAccounting
          .provenMissingReconciliation > 0
      ) {
        const counters =
          world.progression.actorAccounting.details
            .filter((item) =>
              item.status ===
                "missing-reconciliation"
            )
            .map((item) =>
              item.scriptId +
              ":" +
              item.counterId
            )
            .sort();
        return {
          status: "CONTRADICTED",
          reason:
            "Selected-artifact progression accounting proves a completion counter can grow and is checked for zero/complete, but has no decrement or replacement/recompute path: " +
            counters.join(", ") +
            ". The progression gate cannot converge through that counter lifecycle, so runtime reproduction is not required to establish the accounting contradiction.",
        };
      }
      if (
        scenarioLabel ===
          "progression-wave-integrity" &&
        world.progression.actorAccounting
          .unboundRegistryAuthorities > 0
      ) {
        const registries =
          world.progression.actorAccounting
            .registryAuthorityAssessments
            .filter((item) =>
              item.status ===
                "generation-unbound"
            )
            .map((item) =>
              item.registryExpression
            )
            .sort();
        return {
          status: "DETECTION_GAP",
          reason:
            "Actor population lifecycle is owned by registry collection(s) " +
            registries.join(", ") +
            ", but their selected-artifact collection expressions are not explicitly generation/epoch/round/session bound. Do not treat an unversioned live-entity registry as authoritative across arena reuse.",
        };
      }
      if (
        scenarioLabel ===
          "progression-wave-integrity" &&
        world.progression.actorAccounting
          .deferredSpawnAccountingGaps > 0
      ) {
        const counters =
          world.progression.actorAccounting.details
            .filter((item) =>
              item.status ===
                "deferred-spawn-accounting-unproven"
            )
            .map((item) =>
              item.counterId +
              " deferredActors=[" +
              item.deferredSpawnActorIdentifiers.join(",") +
              "] reservation=" +
              item.deferredSpawnReservationStatus +
              " generation=" +
              item.deferredSpawnGenerationStatus
            )
            .sort();
        return {
          status: "DETECTION_GAP",
          reason:
            "Selected-artifact progression has zero-gated actor counters with deferred spawn materialization that is not fully covered by pre-defer population reservation and generation revalidation: " +
            counters.join("; ") +
            ". A pending/retry spawn can therefore remain semantically outstanding while the materialized-actor counter reads zero. Resolve this source-side ownership before treating the wave as safe or escalating to player testing.",
        };
      }
      if (
        scenarioLabel ===
          "progression-wave-integrity" &&
        world.progression.actorAccounting
          .unresolvedCrossIngressEffectCalls > 0
      ) {
        return {
          status: "DETECTION_GAP",
          reason:
            "One exact event ingress reaches the same progression-looking effect through multiple unconditional callbacks, but the target has neither direct progression-mutation proof nor source-proven idempotency. Keep this explicit as unresolved instead of calling it a bug or safe.",
        };
      }
      if (
        scenarioLabel ===
          "progression-wave-integrity" &&
        world.progression.actorAccounting
          .conditionalDespawnUnknowns > 0
      ) {
        const actors =
          world.progression.actorAccounting.details
            .flatMap((item) =>
              item.unresolvedConditionalDespawnActorIdentifiers
            )
            .filter((id, index, all) =>
              all.indexOf(id) === index
            )
            .sort();
        return {
          status: "DETECTION_GAP",
          reason:
            "Counted actor type(s) have conditional despawn activation that is source-reachable from an engine/sensor/exact external event path, or remains identity/scope unresolved, without source-proven remove reconciliation: " +
            actors.join(", ") +
            ". Terminal-only and statically inactive conditional despawn paths are excluded from this gray-zone; resolve the remaining event/state ownership before runtime escalation.",
        };
      }
      if (
        scenarioLabel ===
          "progression-wave-integrity" &&
        world.progression.actorAccounting
          .scriptedRemovalCoverageGaps > 0
      ) {
        const actors =
          world.progression.actorAccounting.details
            .flatMap((item) =>
              item.uncoveredScriptedRemovalActorIdentifiers
            )
            .filter((id, index, all) =>
              all.indexOf(id) === index
            )
            .sort();
        return {
          status: "DETECTION_GAP",
          reason:
            "Selected-artifact source proves counted actor type(s) can be removed/killed by a non-death scripted disappearance path without a source-linked remove reconciliation or direct counter decrement: " +
            actors.join(", ") +
            ". Proven terminal-only cleanup paths are excluded from this gap; the remaining removal path is non-terminal or its lifecycle scope is unresolved. Keep it as gray-zone evidence until source-side lifecycle ownership closes it before any runtime test.",
        };
      }
      if (
        scenarioLabel ===
          "progression-wave-integrity" &&
        world.progression.actorAccounting
          .unresolvedCounters > 0
      ) {
        return {
          status: "DETECTION_GAP",
          reason:
            "Progression-like counter evidence is present but its producer/consumer/reconciliation lifecycle is incomplete. Keep it explicit in unresolved reporting and finish source-side counter ownership proof before any player test.",
        };
      }
      if (
        scenarioLabel === "progression-wave-integrity" &&
        world.combat.deathHandlers === 0 &&
        world.chunks.entityRemoveObservers === 0
      ) {
        return {
          status: "DETECTION_GAP",
          reason:
            "Entity-backed progression is material, but no selected-artifact entity death/removal observer is available to prove actor-count reconciliation. This is an explicit wave/progression gray-zone: it is not a bug by itself, but it cannot be treated as safe until another source-proven completion/accounting path is found.",
        };
      }
      const scopedAi = world.entities.aiStack.assessments.filter(
        (item) =>
          identifierMatchesScenarioScope(
            item.entityKey,
            sourceLocators,
          ),
      );
      const scopedNavigation =
        world.entities.navigationEnvironment.assessments.filter(
          (item) =>
            identifierMatchesScenarioScope(
              item.entityKey,
              sourceLocators,
            ),
        );
      const badAi = scopedAi.filter(
        (item) =>
          item.status === "targeted-stack-incomplete" ||
          (
            item.missingSurfaces.includes("navigation") ||
            item.missingSurfaces.includes("movement")
          ),
      );
      const badNavigation = scopedNavigation.filter(
        (item) => item.status === "incompatible",
      );
      if (badAi.length > 0 || badNavigation.length > 0) {
        return {
          status: "CONTRADICTED",
          reason:
            "Scenario-scoped entity AI/navigation evidence contains an incomplete or incompatible actor path.",
        };
      }
      if (
        scopedNavigation.some(
          (item) =>
            item.status === "unresolved" ||
            item.status === "state-dependent",
        )
      ) {
        return {
          status: "DETECTION_GAP",
          reason:
            "Scenario-scoped entity navigation remains unresolved or state-dependent.",
        };
      }
      const aggregateProblem =
        world.entities.aiStack.targetedStackIncomplete > 0 ||
        world.entities.aiStack.navigationWithoutMovement > 0 ||
        world.entities.aiStack.targetedWithoutNavigation > 0 ||
        world.entities.navigationEnvironment.incompatible > 0;
      if (
        aggregateProblem &&
        sourceLocators.length > 0 &&
        scopedAi.length === 0 &&
        scopedNavigation.length === 0
      ) {
        return {
          status: "DETECTION_GAP",
          reason:
            "Entity AI/navigation problems exist in the selected artifact, but none can be correlated to this scenario's actor/source scope.",
        };
      }
      if (
        sourceLocators.length === 0 &&
        aggregateProblem
      ) {
        return {
          status: "DETECTION_GAP",
          reason:
            "Entity AI/navigation contains aggregate problems, but this scenario has no actor/source locator strong enough for scoped contradiction.",
        };
      }
      if (
        world.entities.staticAnalysisLimits > 0 &&
        scopedAi.length === 0
      ) {
        return {
          status: "DETECTION_GAP",
          reason:
            "Entity behavior has static-analysis limitations and no scoped actor proof for this scenario.",
        };
      }
      const missingScope = missingScenarioScopeEvidence(
        sourceLocators, scopedAi.length + scopedNavigation.length, "Entity AI/navigation",
      );
      if (missingScope) return missingScope;
      return {
        status: "PROVEN",
        reason:
          "Entity lifecycle/navigation has no scoped contradiction for the mapped gameplay dependency.",
      };
    }
    case "runtime:combat": {
      const scopedPaths = scopedByScript(
        world.combat.paths,
        sourceLocators,
      );
      const scopedProjectileGap = scopedPaths.some(
        (item) =>
          item.projectileSpawns > 0 &&
          item.projectileRemovals === 0,
      );
      const scopedHurtOnly =
        scopedPaths.some((item) => item.event === "hurt") &&
        !scopedPaths.some((item) => item.event === "death");
      if (
        scopedProjectileGap ||
        scopedHurtOnly ||
        world.combat.policy.reviveContractContradictions > 0
      ) {
        return {
          status: "CONTRADICTED",
          reason:
            "Scoped combat path or authored combat contract contradicts the gameplay dependency.",
        };
      }
      const contamination = aggregateCannotBeScoped(
        world.combat.projectileCleanupGap > 0 ||
        world.combat.hurtOnlyTerminalRisk > 0,
        sourceLocators,
        scopedPaths.length,
        "Combat lifecycle",
      );
      if (contamination) return contamination;
      const missingScope = missingScenarioScopeEvidence(
        sourceLocators, scopedPaths.length, "Combat lifecycle",
      );
      if (missingScope) return missingScope;
      return {
        status: "PROVEN",
        reason:
          "Combat lifecycle has no scoped contradiction for the mapped gameplay dependency.",
      };
    }
    case "runtime:inventory": {
      const scopedAssessments = scopedByScript(
        world.inventory.assessments,
        sourceLocators,
      );
      const bad = scopedAssessments.filter(
        (item) =>
          item.status === "partial-reset" ||
          item.status === "copy-writeback-risk",
      );
      if (
        bad.length > 0 ||
        world.inventory.restoreOwnership.multipleRestoreOwners > 0
      ) {
        return {
          status: "CONTRADICTED",
          reason:
            "Scoped inventory lifecycle contains partial reset/copy-writeback risk or restore ownership conflict.",
        };
      }
      const contamination = aggregateCannotBeScoped(
        world.inventory.partialResets > 0 ||
        world.inventory.copyMutationRisks > 0,
        sourceLocators,
        scopedAssessments.length,
        "Inventory lifecycle",
      );
      if (contamination) return contamination;

      const scopedGrantGaps =
        scopedAssessments.filter(
          (item) =>
            item.unverifiedItemGrants > 0 ||
            item.propagatedItemGrants > 0,
        );
      if (scopedGrantGaps.length > 0) {
        return {
          status: "DETECTION_GAP",
          reason:
            "Scoped inventory grant path calls Container.addItem without source proof that the returned remainder/result is checked. Grant success remains unresolved until the full quantity commit is verified.",
        };
      }
      const grantContamination =
        aggregateCannotBeScoped(
          world.inventory
            .grantVerificationGaps > 0,
          sourceLocators,
          scopedAssessments.length,
          "Inventory grant verification",
        );
      if (grantContamination) {
        return grantContamination;
      }

      if (
        world.inventory.unresolvedEquipmentSlotEvidence > 0 ||
        world.inventory.restoreOwnership.unknownIdentityGrants > 0 ||
        world.inventory.restoreOwnership
          .initialSessionOverlapUnresolved > 0
      ) {
        return {
          status: "DETECTION_GAP",
          reason:
            "Inventory identity/equipment or initial-session restore ownership remains unresolved. Resolve the source-side initialSpawn guard/ownership before requesting a reconnect playtest.",
        };
      }
      const missingScope = missingScenarioScopeEvidence(
        sourceLocators, scopedAssessments.length, "Inventory lifecycle",
      );
      if (missingScope) return missingScope;
      return {
        status: "PROVEN",
        reason:
          "Inventory lifecycle has no scoped contradiction for the mapped gameplay dependency.",
      };
    }
    case "runtime:arena-cleanup": {
      const ledger = world.arenas.cleanup.resourceLedger;
      if (ledger.missing > 0) {
        return {
          status: "CONTRADICTED",
          reason:
            "Arena cleanup resource ledger has " +
            ledger.missing +
            " acquired resource(s) with no proven terminal release path.",
        };
      }
      if (
        ledger.partial > 0 ||
        world.arenas.cleanup.unresolved > 0 ||
        ledger.complete !== ledger.resources
      ) {
        return {
          status: "DETECTION_GAP",
          reason:
            "Arena cleanup resource release is only partially proven; second-run baseline equivalence requires targeted validation.",
        };
      }
      return {
        status: "PROVEN",
        reason:
          "Arena cleanup resource ledger has complete terminal release coverage for discovered resources.",
      };
    }
    case "runtime:persistence": {
      const scopedProperties = scopedByScript(
        world.persistence?.propertiesDetail ?? [],
        sourceLocators,
      );
      const bad = scopedProperties.filter(
        (item) =>
          item.growth === "append-without-clear" &&
          (
            item.scope === "world" ||
            item.lifetime === "world" ||
            item.lifetime === "unknown"
          ),
      );
      if (bad.length > 0) {
        return {
          status: "CONTRADICTED",
          reason:
            "Scoped persistence property can outlive the intended gameplay lifecycle without a clear/reset path: " +
            bad.map((item) =>
              item.scriptId + ":" + item.propertyId
            ).join(", ") +
            ".",
        };
      }
      const contamination = aggregateCannotBeScoped(
        (world.persistence?.appendWithoutClear ?? 0) > 0,
        sourceLocators,
        scopedProperties.length,
        "Persistence",
      );
      if (contamination) return contamination;

      const scopedReconnectRisks =
        (world.persistence
          ?.reconnectTransientRestoreRisks ?? [])
          .filter((item) =>
            scriptMatchesScenarioScope(
              item.scriptId,
              sourceLocators,
            )
          );
      if (
        scopedReconnectRisks.length > 0
      ) {
        return {
          status: "DETECTION_GAP",
          reason:
            "Reconnect/initial-spawn path reads persisted session/arena-scoped state without source proof of reconciliation against current ownership: " +
            scopedReconnectRisks
              .map((item) =>
                item.scriptId +
                ":" +
                item.propertyId +
                " (" +
                item.lifecycleEvent +
                ")"
              )
              .sort()
              .join(", ") +
            ". Persisted state may inform recovery, but stale transient session state must not reactivate silently.",
        };
      }
      const reconnectContamination =
        aggregateCannotBeScoped(
          (world.persistence
            ?.reconnectTransientRestoreRiskCount ?? 0) > 0,
          sourceLocators,
          scopedReconnectRisks.length,
          "Reconnect persistence reconciliation",
        );
      if (reconnectContamination) {
        return reconnectContamination;
      }

      const scopedResultRecords =
        (world.persistence
          ?.resultAuditRecordDetails ?? [])
          .filter((item) =>
            scriptMatchesScenarioScope(
              item.scriptId,
              sourceLocators,
            )
          );
      if (
        scopedResultRecords.some(
          (item) =>
            item.status === "partial",
        )
      ) {
        return {
          status: "DETECTION_GAP",
          reason:
            "Durable result journal exists but does not carry the full recovery identity required for result/reward replay safety.",
        };
      }

      if (
        scopedProperties.some(
          (item) =>
            item.scope === "unknown" ||
            item.lifetime === "unknown",
        )
      ) {
        return {
          status: "DETECTION_GAP",
          reason:
            "Scoped persistence scope/lifetime remains unresolved.",
        };
      }
      const missingScope = missingScenarioScopeEvidence(
        sourceLocators, scopedProperties.length + scopedResultRecords.length, "Persistence/recovery",
      );
      if (missingScope) return missingScope;
      return {
        status: "PROVEN",
        reason:
          "Persistence/recovery has no scoped contradiction for the mapped gameplay dependency.",
      };
    }
    case "runtime:structures": {
      const scopedLoads =
        world.structures.loadCorrelations.filter(
          (item) =>
            scriptMatchesScenarioScope(
              item.functionId,
              sourceLocators,
            ),
        );
      const scopedTransitions =
        world.structures.transitionResidue.filter(
          (item) =>
            scriptMatchesScenarioScope(
              item.functionId,
              sourceLocators,
            ),
        );
      const missingLoads = scopedLoads.filter(
        (item) =>
          item.status === "missing" ||
          item.status === "ambiguous",
      );
      if (missingLoads.length > 0) {
        return {
          status: "CONTRADICTED",
          reason:
            "Scenario-scoped structure load does not resolve to exactly one selected-artifact structure definition.",
        };
      }
      if (
        scopedTransitions.some(
          (item) =>
            item.status === "incomplete" ||
            item.preservedByVoid > 0,
        )
      ) {
        return {
          status: "DETECTION_GAP",
          reason:
            "Scenario-scoped structure transition has residue/incomplete evidence. This is not promoted to a defect without a grounded reset/replacement contract.",
        };
      }
      const aggregateProblem =
        world.structures.unresolvedLoads > 0 ||
        world.structures.transitionResidueRisks > 0 ||
        world.structures.transitionResidueUnresolved > 0;
      if (
        aggregateProblem &&
        sourceLocators.length > 0 &&
        scopedLoads.length === 0 &&
        scopedTransitions.length === 0
      ) {
        return {
          status: "DETECTION_GAP",
          reason:
            "Structure problems exist elsewhere in the selected artifact, but none are source-correlated to this scenario.",
        };
      }
      if (aggregateProblem && sourceLocators.length === 0) {
        return {
          status: "DETECTION_GAP",
          reason:
            "Structure analysis contains aggregate problems, but this scenario lacks source scope for a safe contradiction.",
        };
      }
      const missingScope = missingScenarioScopeEvidence(
        sourceLocators, scopedLoads.length + scopedTransitions.length, "World/structure setup",
      );
      if (missingScope) return missingScope;
      return {
        status: "PROVEN",
        reason:
          "World/structure setup has no scoped contradiction for the mapped gameplay dependency.",
      };
    }
    case "runtime:economy": {
      const scopedResultMachines = scopedByScript(
        world.progression.actorAccounting.stateMachines.filter(
          (item) =>
            /(?:result|terminal)/i.test(item.tableName) ||
            item.reason.includes("Authored result lifecycle"),
        ),
        sourceLocators,
      );
      if (
        scopedResultMachines.length > 0 &&
        (world.persistence
          ?.completeResultAuditRecords ?? 0) === 0
      ) {
        return {
          status: "DETECTION_GAP",
          reason:
            "Result/terminal lifecycle is present but no complete durable result audit/recovery record is source-proven.",
        };
      }

      if (
        scopedResultMachines.some(
          (item) => item.status === "unresolved",
        )
      ) {
        return {
          status: "DETECTION_GAP",
          reason:
            "Result lifecycle ordering is unresolved before reward/cleanup commit.",
        };
      }

      const scopedPaths = scopedByScript(
        world.economy.paths,
        sourceLocators,
      );
      const bad = scopedPaths.filter(
        (item) =>
          item.rewardCleanupOrdering ===
            "contradicted-before-journal" ||
          (
            item.trigger === "pickup" &&
            (item.scoreCredits > 0 || item.scoreWrites > 0) &&
            item.itemConsumes === 0
          ) ||
          (
            (item.inventoryGrants > 0 ||
              item.worldDrops > 0 ||
              item.lootCommands > 0 ||
              item.scoreCredits > 0 ||
              item.scoreWrites > 0) &&
            item.idempotencyGuards === 0
          ),
      );
      if (
        bad.length > 0 ||
        world.economy.policy.deathRewardOverlapContractConflicts > 0 ||
        world.economy.policy.pickupCurrencyContractMismatch > 0
      ) {
        return {
          status: "CONTRADICTED",
          reason:
            "Scoped reward path or authored economy contract contains duplicate/non-idempotent/unconsumed reward behavior.",
        };
      }
      const contamination = aggregateCannotBeScoped(
        world.economy.pickupCurrencyWithoutConsumeCandidates > 0 ||
        world.economy.rewardPathsWithoutIdempotency > 0 ||
        world.economy.cleanupRewardJournalOrderingUnresolved > 0,
        sourceLocators,
        scopedPaths.length,
        "Economy/reward",
      );
      if (contamination) return contamination;
      if (
        scopedPaths.some(
          (item) =>
            item.rewardCleanupOrdering ===
              "unresolved",
        ) ||
        world.economy.unresolvedEngineLootTables > 0 ||
        world.economy.deathRewardSourceOverlapUnresolved > 0
      ) {
        return {
          status: "DETECTION_GAP",
          reason:
            "Economy/reward evidence remains unresolved, including reward-to-cleanup journal ordering where source ordering cannot yet be proven.",
        };
      }
      const missingScope = missingScenarioScopeEvidence(
        sourceLocators, scopedPaths.length, "Economy/reward",
      );
      if (missingScope) return missingScope;
      return {
        status: "PROVEN",
        reason:
          "Economy/reward has no scoped contradiction for the mapped gameplay dependency.",
      };
    }
    default:
      return {
        status: "DETECTION_GAP",
        reason: "No runtime-domain resolver is available for this gameplay dependency.",
      };
  }
}

/**
 * Lift observed execution entry candidates into the EXISTING scenario graph.
 * Only exact IR IDs can join across regions. Record all material operations
 * without synthesizing mechanic names or claiming a player-visible journey.
 */
export function sourceFlowCandidates(ir: SemanticIr): readonly GameplaySourceFlowCandidate[] {
  const execution = semanticIrExecutionTraces(ir);
  const regions = new Map(ir.execution.regions.map(region => [region.id, region]));
  const stepsByRegion = new Map<string, GameplaySourceFlowCandidate["sourceSteps"][number][]>();
  const append = (regionId: string, step: GameplaySourceFlowCandidate["sourceSteps"][number]) => {
    const list = stepsByRegion.get(regionId) ?? [];
    list.push(step);
    stepsByRegion.set(regionId, list);
  };
  for (const op of ir.state.operations) {
    append(op.executionRegionId, {
      id: op.id, kind: "state", executionRegionId: op.executionRegionId,
      source: op.source, operation: op.operation,
    });
  }
  for (const action of ir.state.resourceActions ?? []) {
    append(action.executionRegionId, {
      id: action.id, kind: "resource-action",
      executionRegionId: action.executionRegionId, source: action.source,
      operation: action.action, targetLabel: action.surface + ":" + action.key,
    });
  }
  for (const outcome of ir.execution.outcomes ?? []) {
    append(outcome.executionRegionId, {
      id: outcome.id, kind: "return",
      executionRegionId: outcome.executionRegionId, source: outcome.source,
      targetLabel: outcome.propertyName + "=" + outcome.value,
    });
  }
  for (const effect of ir.execution.worldEffects ?? []) {
    append(effect.executionRegionId, {
      id: effect.id, kind: "world-effect",
      executionRegionId: effect.executionRegionId, source: effect.source,
      targetLabel: effect.kind + ":" + effect.targetLabel,
      ...(effect.authoredTimingSeconds === undefined ? {} :
        { authoredTimingSeconds: effect.authoredTimingSeconds }),
    });
  }
  // Keep the most diagnostic DIRECT sites within a bounded handoff. Reads
  // alone must not displace a later authored state mutation, world-effect
  // attempt, resource action or result return in a large bundled callback.
  // This ranks read-only navigation, NOT reachability or gameplay success.
  const stepPriority = (
    step: GameplaySourceFlowCandidate["sourceSteps"][number],
  ): number =>
    step.kind === "world-effect" ||
    step.kind === "resource-action" ||
    (step.kind === "state" &&
      (step.operation === "write" ||
        step.operation === "clear" || step.operation === "delete"))
      ? 0 : step.kind === "return" ? 1 : 2;
  // A direct target with many writes must not hide its distinct world
  // effects, release sites or return outcomes behind the same eight slots.
  // At most eight kinds exist; this is only balanced READ-ONLY navigation.
  // None of the selected kinds proves that an action actually occurred.
  const stepCategory = (
    step: GameplaySourceFlowCandidate["sourceSteps"][number],
  ): string => {
    if (step.kind === "state") {
      return step.operation === "write" ||
        step.operation === "clear" || step.operation === "delete"
        ? "state:" + step.operation : "state:read";
    }
    if (step.kind === "resource-action") {
      return step.operation === "release"
        ? "resource:release" : "resource:acquire";
    }
    return step.kind;
  };
  // A source region can be the destination of many calls. Compute its
  // navigational priority once rather than rewalking it for every trace.
  const priorityByRegion = new Map([...stepsByRegion].map(([regionId, steps]) =>
    [regionId, steps.reduce((priority, step) =>
      Math.min(priority, stepPriority(step)), 2)] as const));

  // Reuse immutable selected-source order for all callers of a region:
  // a bundled game can reference one SessionService dozens of times.
  // Source order within a region does NOT prove cross-region runtime order.
  const sourceStepOrder = (
    a: GameplaySourceFlowCandidate["sourceSteps"][number],
    b: GameplaySourceFlowCandidate["sourceSteps"][number],
  ): number =>
    a.source.relativePath.localeCompare(b.source.relativePath) ||
    (a.source.range?.lineStart ?? 0) - (b.source.range?.lineStart ?? 0) ||
    (a.source.range?.columnStart ?? 0) - (b.source.range?.columnStart ?? 0) ||
    (a.authoredTimingSeconds ?? 0) - (b.authoredTimingSeconds ?? 0) ||
    (a.source.jsonPointer ?? "").localeCompare(b.source.jsonPointer ?? "") ||
    a.id.localeCompare(b.id);
  const orderedStepsByRegion = new Map([...stepsByRegion].map(
    ([id, steps]) => [id, [...steps].sort(sourceStepOrder)] as const,
  ));
  const ordered = (ids: readonly string[]) =>
    ids.flatMap(id => orderedStepsByRegion.get(id) ?? []);
  const relations = ir.execution.authoredBehaviorRelations ?? [];
  const edgesById = new Map(ir.execution.edges.map(edge => [edge.id, edge]));
  const build = (input: {
    readonly entryRegionId: string;
    readonly entryKind: GameplaySourceFlowCandidate["entryKind"];
    readonly regionIds: readonly string[];
    readonly executionEdgeIds: readonly string[];
    readonly unresolvedExecutionEdgeIds: readonly string[];
    readonly temporalRelationIds: readonly string[];
    readonly branchPoints: readonly ObservedBranchPoint[];
  }): GameplaySourceFlowCandidate => {
    const steps = ordered(input.regionIds);
    const ids = new Set(steps.map(step => step.id));
    const resolvedEdges = new Set(input.executionEdgeIds.filter(id =>
      !input.unresolvedExecutionEdgeIds.includes(id)));
    const traceRegions = new Set(input.regionIds);
    // A broad trace can contain many disjoint branches. Correlate only the
    // exact resolved edge with steps directly owned by its target region;
    // other steps in the trace are NOT implied successors of that edge.
    const sourceHandoffs = [...resolvedEdges].sort()
      .flatMap(id => {
        const edge = edgesById.get(id);
        if (!edge || edge.resolution !== "resolved" || !edge.to ||
            edge.from === edge.to ||
            !traceRegions.has(edge.from) || !traceRegions.has(edge.to)) {
          return [];
        }
        const from = regions.get(edge.from);
        const to = regions.get(edge.to);
        if (!from || !to ||
            edge.source.artifactId !== from.source.artifactId ||
            edge.source.artifactId !== to.source.artifactId) return [];
        const steps = ordered([edge.to]);
        // Preserve source order in the final projection after selecting the
        // eight most material DIRECT target sites. No transitive effects are
        // attributed to this edge.
        const selectedIds = new Set<string>();
        const representedKinds = new Set<string>();
        // Reserve one exact, source-ordered witness per represented kind
        // before using the remaining slots for higher-priority operations.
        // Eight kinds is an upper bound, so this does not grow the budget.
        for (const step of steps) {
          const category = stepCategory(step);
          if (representedKinds.has(category)) continue;
          representedKinds.add(category);
          selectedIds.add(step.id);
          if (selectedIds.size === 8) break;
        }
        for (const step of [...steps].sort((a, b) =>
          stepPriority(a) - stepPriority(b))) {
          if (selectedIds.size >= 8) break;
          selectedIds.add(step.id);
        }
        const selected = steps.filter(step => selectedIds.has(step.id));
        return [{
          edgeId: edge.id,
          fromRegionId: edge.from,
          toRegionId: edge.to,
          kind: edge.kind,
          source: edge.source,
          ...(edge.scheduler === undefined ? {} : { scheduler: edge.scheduler }),
          generationGuard: edge.guardEvidence === "explicit-generation-check" &&
              edge.generationGuardSource !== undefined
            ? "EXPLICIT_SOURCE_CHECK" as const
            : edge.guardEvidence !== undefined
              ? "UNRESOLVED" as const : "NOT_RECORDED" as const,
          directTargetStepIds: selected.map(step => step.id),
          directTargetStateWriteIds: selected
            .filter(step => step.kind === "state" &&
              (step.operation === "write" || step.operation === "clear" ||
               step.operation === "delete"))
            .map(step => step.id),
          directTargetWorldEffectIds: selected
            .filter(step => step.kind === "world-effect")
            .map(step => step.id),
          directTargetReleaseIds: selected
            .filter(step => step.kind === "resource-action" &&
              step.operation === "release")
            .map(step => step.id),
          omittedDirectTargetSteps: steps.length - selected.length,
          proof: "RESOLVED_SOURCE_EDGE_NOT_RUNTIME_EXECUTION" as const,
        }];
      });
    // Reserve one witness for each DISTINCT target region before filling
    // remaining slots with repeat calls. A hot getter must not hide a
    // different terminal/cleanup target under the existing 24-edge limit.
    // Exact source edges and proof status remain owned by Semantic IR.
    const rankedHandoffs = [...sourceHandoffs].sort((a, b) =>
      (priorityByRegion.get(a.toRegionId) ?? 2) -
        (priorityByRegion.get(b.toRegionId) ?? 2) ||
      a.edgeId.localeCompare(b.edgeId));
    const chosenHandoffIds = new Set<string>();
    const representedTargets = new Set<string>();
    for (const handoff of rankedHandoffs) {
      if (representedTargets.has(handoff.toRegionId)) continue;
      representedTargets.add(handoff.toRegionId);
      chosenHandoffIds.add(handoff.edgeId);
      if (chosenHandoffIds.size === 24) break;
    }
    if (chosenHandoffIds.size < 24) {
      for (const handoff of rankedHandoffs) {
        if (chosenHandoffIds.size === 24) break;
        chosenHandoffIds.add(handoff.edgeId);
      }
    }
    const visibleHandoffs = rankedHandoffs.filter(handoff =>
      chosenHandoffIds.has(handoff.edgeId));
    return {
      id: "source-flow:" + encodeURIComponent(input.entryRegionId),
      ...input,
      sourceSteps: steps,
      // Preserve source edge identities, materiality order and truthful
      // omission counts; navigational selection is NOT causal proof.
      sourceHandoffs: visibleHandoffs,
      omittedSourceHandoffs: Math.max(0, sourceHandoffs.length - visibleHandoffs.length),
      // Unknown/possible targets remain in canonical IR but must not
      // become an EXACT source activation via another resolved call in
      // the same broad source trace. A relation with its own /function
      // edges requires at least one of THOSE edges to be resolved.
      authoredBehaviorRelationIds: relations
        .filter(relation => {
          if (relation.resolution !== "EXACT_REFERENCE") return false;
          const relatedEdges = relation.executionEdgeIds ?? [];
          if (relatedEdges.length > 0 &&
              !relatedEdges.some(id => resolvedEdges.has(id))) return false;
          return relation.worldEffectIds?.some(id => ids.has(id)) ||
            relation.stateOperationIds?.some(id => ids.has(id)) ||
            relatedEdges.some(id => resolvedEdges.has(id));
        })
        .map(relation => relation.id).sort(),
      sourceOrderScope: "PER_EXECUTION_REGION_ONLY",
      runtimeStatus: "NOT_OBSERVED",
    };
  };
  const flows: GameplaySourceFlowCandidate[] = execution.traces.map(trace =>
    build({
      entryRegionId: trace.entryRegionId, entryKind: trace.entryKind,
      regionIds: trace.regionIds,
      executionEdgeIds: trace.executionEdgeIds,
      unresolvedExecutionEdgeIds: trace.unresolvedExecutionEdgeIds,
      temporalRelationIds: trace.temporalRelationIds,
      branchPoints: trace.branchPoints,
    }));
  for (const id of execution.regionsOutsideTraces) {
    const region = regions.get(id);
    if (!region || !(stepsByRegion.get(id)?.length)) continue;
    flows.push(build({
      entryRegionId: id, entryKind: region.kind, regionIds: [id],
      executionEdgeIds: [], unresolvedExecutionEdgeIds: [],
      temporalRelationIds: [], branchPoints: [],
    }));
  }
  // Empty source modules are not material gameplay flow evidence.
  return flows.filter(flow => flow.sourceSteps.length > 0 ||
    flow.executionEdgeIds.length > 0 ||
    flow.unresolvedExecutionEdgeIds.length > 0 ||
    flow.branchPoints.length > 0)
    .sort((a,b) => a.id.localeCompare(b.id));
}

/**
 * Strict provenance binding: only exact IR / classified Intent evidence IDs.
 * Source co-location, method names, and scenario neighborhood never prove a
 * mechanic owns a state mutation or an animation-command effect.
 */
function reconstructClassifiedMechanics(
  intent: GameplayIntentModel,
  flows: readonly GameplaySourceFlowCandidate[],
  guardedTransitions: readonly SourceGuardedStateTransitionCandidate[],
): readonly GameplayMechanicReconstruction[] {
  const featureKinds = new Set(["mechanic", "objective", "phase", "lifecycle", "outcome"]);
  const scopedEvidence = new Set(intent.evidence.filter(evidence =>
    evidence.scope === "selected-artifact").map(evidence => evidence.id));
  // One source-flow index for all feature correlations. An IR flow can be
  // broad or include mutually exclusive branches, so shared membership is
  // context only and NEVER proof a feature owns the state transition.
  const flowIdsByStep = new Map<string, Set<string>>();
  const stepsByFlow = new Map<string, Map<string, GameplaySourceFlowCandidate["sourceSteps"][number]>>();
  const evidenceRegionByFlow = new Map<string, Map<string, string>>();
  for (const flow of flows) {
    const steps = new Map<string, GameplaySourceFlowCandidate["sourceSteps"][number]>();
    const regionByEvidence = new Map<string, string>();
    for (const regionId of flow.regionIds) regionByEvidence.set(regionId, regionId);
    for (const step of flow.sourceSteps) {
      steps.set(step.id, step);
      regionByEvidence.set(step.id, step.executionRegionId);
      const owners = flowIdsByStep.get(step.id) ?? new Set<string>();
      owners.add(flow.id);
      flowIdsByStep.set(step.id, owners);
    }
    stepsByFlow.set(flow.id, steps);
    evidenceRegionByFlow.set(flow.id, regionByEvidence);
  }
  const guardedFlowContexts = guardedTransitions
    .filter(candidate => intent.artifactId === undefined ||
      candidate.guardComparisonSource.artifactId === intent.artifactId)
    .map(candidate => ({
      candidate,
      // A broad graph trace can include unrelated functions and opposite
      // authored branches. Require BOTH exact state operations to belong to
      // this candidate's source execution region and selected artifact.
      sharedSourceFlowIds: [...(flowIdsByStep.get(candidate.readOperationId) ??
        new Set<string>())].filter(id => {
          const read = stepsByFlow.get(id)?.get(candidate.readOperationId);
          const write = stepsByFlow.get(id)?.get(candidate.writeOperationId);
          return read?.kind === "state" && read.operation === "read" &&
            write?.kind === "state" && write.operation === "write" &&
            read.executionRegionId === candidate.executionRegionId &&
            write.executionRegionId === candidate.executionRegionId &&
            read.source.artifactId === candidate.guardComparisonSource.artifactId &&
            write.source.artifactId === candidate.guardComparisonSource.artifactId;
        }).sort(),
    }));
  return intent.nodes.filter(node =>
    featureKinds.has(node.kind) && node.status !== "hypothesis" &&
    node.evidenceIds.some(id => scopedEvidence.has(id)))
    .map(node => {
      const evidenceIds = new Set(node.evidenceIds.filter(id =>
        scopedEvidence.has(id)));
      const relations = intent.edges.filter(edge =>
        edge.status !== "hypothesis" &&
        (edge.from === node.id || edge.to === node.id) &&
        edge.evidenceIds.some(id => scopedEvidence.has(id)))
        .map(edge => ({
          id: edge.id, from: edge.from, to: edge.to,
          kind: edge.kind,
          evidenceIds: edge.evidenceIds.filter(id => scopedEvidence.has(id)).sort(),
          status: edge.status === "authored"
            ? "AUTHORED_RELATION" as const : "INFERRED_RELATION" as const,
        })).sort((a,b) => a.id.localeCompare(b.id));
      const witnessed = flows.filter(flow =>
        flow.sourceSteps.some(step => evidenceIds.has(step.id)) ||
        flow.executionEdgeIds.some(id => evidenceIds.has(id)) ||
        flow.authoredBehaviorRelationIds.some(id => evidenceIds.has(id)) ||
        (flow.regionIds.some(id => evidenceIds.has(id)) &&
          node.evidenceIds.includes(flow.entryRegionId)));
      const exactSourceFlowIds = [...new Set(witnessed.map(flow => flow.id))].sort();
      const exactSourceStepIds = [...new Set(witnessed.flatMap(flow =>
        flow.sourceSteps.filter(step => evidenceIds.has(step.id))
          .map(step => step.id)))].sort();
      const authoredBehaviorRelationIds = [...new Set(witnessed.flatMap(flow =>
        flow.authoredBehaviorRelationIds.filter(id => evidenceIds.has(id))))].sort();
      const sourceGuardedTransitionCandidateIds = guardedTransitions
        .filter(candidate => evidenceIds.has(candidate.writeOperationId))
        .map(candidate => candidate.readOperationId + ":" +
          candidate.writeOperationId).sort();
      // A source-flow spans multiple execution regions and may include both
      // sides of mutually exclusive branches. Feature association requires
      // its OWN individually identified source evidence in the guard/write
      // execution region, not mere membership in the broad flow. No source
      // identity is inferred from names, code layout, genre, or map title.
      const featureRegionEvidenceByFlow = new Map<string, Map<string, Set<string>>>();
      for (const flow of witnessed) {
        const byRegion = new Map<string, Set<string>>();
        const record = (regionId: string, evidenceId: string): void => {
          const ids = byRegion.get(regionId) ?? new Set<string>();
          ids.add(evidenceId);
          byRegion.set(regionId, ids);
        };
        const regionByEvidence = evidenceRegionByFlow.get(flow.id);
        for (const evidenceId of evidenceIds) {
          const regionId = regionByEvidence?.get(evidenceId);
          if (regionId !== undefined) record(regionId, evidenceId);
        }
        featureRegionEvidenceByFlow.set(flow.id, byRegion);
      }
      const guardedContexts = guardedFlowContexts.flatMap(({ candidate, sharedSourceFlowIds }) => {
        if (evidenceIds.has(candidate.writeOperationId) ||
            evidenceIds.has(candidate.readOperationId)) return [];
        const matched = sharedSourceFlowIds.filter(id =>
          (featureRegionEvidenceByFlow.get(id)?.get(candidate.executionRegionId)?.size ?? 0) > 0);
        if (matched.length === 0) return [];
        const regionEvidence = [...new Set(matched.flatMap(id =>
          [...(featureRegionEvidenceByFlow.get(id)?.get(candidate.executionRegionId) ??
            new Set<string>())]))].sort();
        return [{
          readOperationId: candidate.readOperationId,
          writeOperationId: candidate.writeOperationId,
          executionRegionId: candidate.executionRegionId,
          featureRegionEvidenceIds: regionEvidence,
          sharedSourceFlowIds: matched,
          candidateStatus: candidate.status,
        }];
      }).sort((a, b) => a.executionRegionId.localeCompare(b.executionRegionId) ||
        a.readOperationId.localeCompare(b.readOperationId) ||
        a.writeOperationId.localeCompare(b.writeOperationId));
      const sourceGuardedTransitionContexts = guardedContexts.slice(0, 16);
      const sourceGuardedTransitionContextOmitted =
        Math.max(0, guardedContexts.length - sourceGuardedTransitionContexts.length);
      // Do not mistake synchronous helper "requires" for a game trigger.
      // Exact event / dialogue / animation source links may establish an
      // authored entry REFERENCE only, never player reachability or execution.
      const entryKinds = new Set(["event-source", "dialogue-command",
        "behavior-animation"]);
      const participationIds = new Set(relations.filter(edge =>
        edge.kind === "participates-in").flatMap(edge => edge.evidenceIds));
      const sourceActivationCandidates:
        GameplayMechanicReconstruction["sourceActivationCandidates"] =
        witnessed.filter(flow => entryKinds.has(flow.entryKind))
          .map(flow => {
            const unresolved = new Set(flow.unresolvedExecutionEdgeIds);
            const supportingEvidenceIds = [...new Set([
              ...flow.executionEdgeIds.filter(id => scopedEvidence.has(id) &&
                !unresolved.has(id) &&
                (participationIds.has(id) || evidenceIds.has(id))),
              ...flow.authoredBehaviorRelationIds.filter(id =>
                scopedEvidence.has(id) && evidenceIds.has(id) &&
                (flow.executionEdgeIds.length === 0 ||
                 flow.executionEdgeIds.some(edgeId =>
                   !unresolved.has(edgeId)))),
            ])].sort();
            const materialSourceStepIds = flow.sourceSteps.filter(step =>
              evidenceIds.has(step.id) &&
              (step.kind === "world-effect" ||
               step.kind === "resource-action" ||
               (step.kind === "state" &&
                ["write", "delete", "clear"].includes(step.operation ?? ""))))
              .map(step => step.id).sort();
            return {
              sourceFlowId: flow.id,
              entryRegionId: flow.entryRegionId,
              entryKind: flow.entryKind,
              evidenceBasis: supportingEvidenceIds.length
                ? "EXACT_SOURCE_ENTRY_REFERENCE" as const
                : "TRACE_CONTEXT_ONLY" as const,
              supportingEvidenceIds,
              materialSourceStepIds,
              unresolvedExecutionEdgeIds: [...flow.unresolvedExecutionEdgeIds],
              branchPointCount: flow.branchPoints.length,
              runtimeStatus: "NOT_OBSERVED" as const,
            };
          }).sort((a,b) => a.sourceFlowId.localeCompare(b.sourceFlowId));
      const directlyObservedEffects = new Set(witnessed.flatMap(flow =>
        flow.sourceSteps.filter(step => evidenceIds.has(step.id) &&
          (step.kind === "world-effect" ||
           step.kind === "resource-action" ||
           (step.kind === "state" &&
             ["write", "delete", "clear"].includes(step.operation ?? ""))))
          .map(step => step.id)));
      const unresolvedDimensions: GameplayMechanicReconstruction["unresolvedDimensions"][number][] = [];
      if (exactSourceFlowIds.length === 0) unresolvedDimensions.push("NO_EXACT_IR_LINK");
      // Role-specific dimensions: a terminal outcome is not a mechanic
      // needing another outcome or activation edge of its own.
      const needsBehavior = node.kind === "mechanic" ||
        node.kind === "phase" || node.kind === "lifecycle";
      if (needsBehavior &&
          !sourceActivationCandidates.some(candidate =>
            candidate.evidenceBasis === "EXACT_SOURCE_ENTRY_REFERENCE"))
        unresolvedDimensions.push("NO_ACTIVATION_RELATION");
      if (needsBehavior && directlyObservedEffects.size === 0 &&
          !relations.some(edge => ["transitions-to","produces","consumes",
              "resets","persists","recovers-to"].includes(edge.kind)))
        unresolvedDimensions.push("NO_STATE_OR_EFFECT_RELATION");
      if (node.kind !== "outcome" &&
          !relations.some(edge =>
            ["wins-by","loses-by","produces"].includes(edge.kind) &&
            intent.nodes.some(target => target.id === edge.to &&
              (target.kind === "outcome" || target.kind === "objective"))))
        unresolvedDimensions.push("NO_OUTCOME_RELATION");
      return {
        featureId: node.id,
        kind: node.kind as GameplayMechanicReconstruction["kind"],
        name: node.label,
        meaningStatus: node.status === "authored"
          ? "AUTHORED" as const : "INFERRED" as const,
        declaredEvidenceIds: [...evidenceIds].sort(),
        exactSourceFlowIds,
        exactSourceStepIds,
        authoredBehaviorRelationIds,
        sourceGuardedTransitionCandidateIds,
        sourceGuardedTransitionContexts,
        sourceGuardedTransitionContextOmitted,
        sourceActivationCandidates,
        relations,
        unresolvedDimensions,
        runtimeStatus: "NOT_OBSERVED" as const,
      };
    }).sort((a,b) => a.featureId.localeCompare(b.featureId));
}

/**
 * Renders one bounded route PER distinct directed authored/inferred graph path.
 * It does not assert that these relations are chronologically executable.
 * No genre-based start, inferred terminal, or synthetic objective is added.
 */
export function reconstructAuthoredJourneyCandidates(
  intent: GameplayIntentModel,
  reconstructions: readonly GameplayMechanicReconstruction[],
  maxPaths = 128,
  maxDepth = 12,
  sourceFlows: readonly GameplaySourceFlowCandidate[] = [],
): { candidates: readonly GameplayJourneyCandidate[]; truncated: boolean } {
  const source = new Map(intent.evidence
    .filter(evidence => evidence.scope === "selected-artifact")
    .map(evidence => [evidence.id, evidence] as const));
  const isCurrent = (ids: readonly string[]) =>
    ids.some(id => source.has(id));
  const featureById = new Map(reconstructions.map(item => [item.featureId, item]));
  const featureIds = new Set(featureById.keys());
  // The earlier path algorithm dropped intermediate scoreboard/state/resource
  // subjects. Admit ONLY actual selected-artifact subjects as bridges: these
  // are not newly inferred mechanics or proof that effects occurred.
  const nodes = new Map(intent.nodes.filter(node =>
    node.status !== "hypothesis" &&
    !isAuthoredSourceContentNode(node) &&
    isCurrent(node.evidenceIds) &&
    (featureIds.has(node.id) ||
      node.kind === "state" || node.kind === "resource"))
    .map(node => [node.id, node] as const));
  // Relation direction is SOURCE semantics, not elapsed game time.
  // "requires"/"owns"/"valid-during" cannot safely act as traversal edges.
  const traversable = new Set([
    "transitions-to", "recovers-to", "produces", "consumes",
    "wins-by", "loses-by", "resets",
  ]);
  const links = intent.edges.filter(edge =>
    traversable.has(edge.kind) &&
    edge.status !== "hypothesis" &&
    nodes.has(edge.from) && nodes.has(edge.to) &&
    isCurrent(edge.evidenceIds))
    .sort((a, b) => a.id.localeCompare(b.id));

  // Two individually source-backed relations can touch the SAME technical
  // resource/state node without proving a data handoff. Equal file paths
  // cannot bind two different execution regions or opposite source branches.
  // Even a shared exact IR witness is only source context: no source trace
  // proves the live value, timing or player/mode/arena identity.
  const sorted = (ids: readonly string[]) => [...new Set(ids)].sort();
  const sourceLocators = (edge: typeof links[number]) => sorted(
    edge.evidenceIds.flatMap(id => {
      const path = source.get(id)?.locator.trim();
      return path && path !== "unknown" && path !== "unresolved"
        ? [path] : [];
    }),
  );
  const selectedArtifactId = intent.artifactId;
  const usableSourceFlows = sourceFlows
    .filter(flow => selectedArtifactId !== undefined &&
      flow.sourceSteps.length > 0 &&
      flow.executionEdgeIds.some(id =>
        !flow.unresolvedExecutionEdgeIds.includes(id)) &&
      flow.sourceSteps.every(step =>
        step.source.artifactId === selectedArtifactId) &&
      flow.branchPoints.every(point =>
        point.source.artifactId === selectedArtifactId))
    .map(flow => ({
      evidenceIds: new Set([
        ...flow.executionEdgeIds.filter(id =>
          !flow.unresolvedExecutionEdgeIds.includes(id)),
        ...flow.sourceSteps.map(step => step.id),
        ...flow.authoredBehaviorRelationIds,
      ]),
      // The canonical Semantic IR branch points are keyed by exact
      // authored condition source site, not matched expression text.
      // Only DIRECT evidence is used: precedence is not a runtime path.
      oppositeArms: flow.branchPoints.flatMap(point => {
        const byArm = (arm: "true" | "false") => {
          const selected = point.branches.find(branch => branch.branch === arm);
          return selected === undefined ? undefined : new Set([
            ...selected.executionEdgeIds,
            ...selected.stateWriteOperationIds,
            ...selected.returnOutcomeIds,
            ...selected.resourceActionIds,
            ...(selected.worldEffectIds ?? []),
          ]);
        };
        const trueArm = byArm("true");
        const falseArm = byArm("false");
        return trueArm && falseArm ? [{ trueArm, falseArm }] : [];
      }),
    }));
  type SourceJoinProof = NonNullable<
    GameplayJourneyInterpretation["sourceJoinGap"]
  >["missingProof"];
  const sourceJoinProof = (
    previous: typeof links[number], next: typeof links[number],
  ): { admitted: boolean; missingProof: SourceJoinProof } => {
    const previousIds = new Set(previous.evidenceIds.filter(id => source.has(id)));
    const nextIds = new Set(next.evidenceIds.filter(id => source.has(id)));
    let foundOppositeArms = false;
    let foundCompatibleFlow = false;
    for (const flow of usableSourceFlows) {
      const previousInFlow = [...previousIds].filter(id =>
        flow.evidenceIds.has(id));
      const nextInFlow = [...nextIds].filter(id =>
        flow.evidenceIds.has(id));
      if (previousInFlow.length === 0 || nextInFlow.length === 0) continue;
      const opposite = flow.oppositeArms.some(({ trueArm, falseArm }) => {
        const previousTrue = previousInFlow.some(id => trueArm.has(id));
        const previousFalse = previousInFlow.some(id => falseArm.has(id));
        const nextTrue = nextInFlow.some(id => trueArm.has(id));
        const nextFalse = nextInFlow.some(id => falseArm.has(id));
        // Only an EXCLUSIVE opposite authored arm establishes this conflict.
        // A fact appearing in both arms is unresolved, never an exclusive arm.
        return (previousTrue && !previousFalse && nextFalse && !nextTrue) ||
          (previousFalse && !previousTrue && nextTrue && !nextFalse);
      });
      if (opposite) foundOppositeArms = true;
      else foundCompatibleFlow = true;
    }
    // A conflicting EXACT authored branch site is a counter-witness even
    // if another broad trace includes both facts without branch detail.
    // A coarse trace cannot cancel more precise opposite-arm evidence.
    if (foundOppositeArms) {
      return { admitted: false,
        missingProof: "OPPOSITE_AUTHORED_BRANCH_ARMS" };
    }
    if (foundCompatibleFlow) {
      return { admitted: true,
        missingProof: "SHARED_EXACT_SOURCE_FLOW_OR_SAME_SOURCE_WITNESS" };
    }
    // A single exact selected-artifact witness shared by BOTH relations
    // may preserve a SOURCE-ONLY candidate when no flow contradicts it.
    // The same filename alone is NOT such a witness.
    if ([...previousIds].some(id => nextIds.has(id))) {
      return {
        admitted: true,
        missingProof: "SHARED_EXACT_SOURCE_FLOW_OR_SAME_SOURCE_WITNESS",
      };
    }
    return {
      admitted: false,
      missingProof: "SHARED_EXACT_SOURCE_FLOW_OR_SAME_SOURCE_WITNESS",
    };
  };
  const outgoing = new Map<string, typeof links>();
  const incoming = new Set<string>();
  for (const edge of links) {
    const list = outgoing.get(edge.from) ?? [];
    list.push(edge);
    outgoing.set(edge.from, list);
    incoming.add(edge.to);
  }
  const roots = [...outgoing.keys()].filter(id => !incoming.has(id)).sort();
  // Preserve isolated cycles rather than dropping them merely because some
  // other component of the map has a normal source root.
  const reachable = new Set<string>();
  const mark = (start: string) => {
    const pending = [start];
    for (let index = 0; index < pending.length; index++) {
      const node = pending[index]!;
      if (reachable.has(node)) continue;
      reachable.add(node);
      for (const edge of outgoing.get(node) ?? []) pending.push(edge.to);
    }
  };
  for (const root of roots) mark(root);
  for (const id of [...outgoing.keys()].sort()) {
    if (reachable.has(id)) continue;
    roots.push(id);
    mark(id);
  }

  type Boundary = GameplayJourneyCandidate["boundary"];
  type SourceJoinGap =
    NonNullable<GameplayJourneyInterpretation["sourceJoinGap"]>;
  type Walk = { ids: string[]; edges: typeof links };
  const describe = (
    walk: Walk, boundary: Boundary, joinGap?: SourceJoinGap,
  ): GameplayJourneyCandidate | undefined => {
    // A technical-only dependency chain is NOT a reconstructed game loop.
    if (walk.edges.length === 0 ||
        !walk.ids.some(id => featureIds.has(id))) return undefined;
    const relationEvidence = sorted(walk.edges.flatMap(edge =>
      edge.evidenceIds.filter(id => source.has(id))));
    const flowIds = sorted(walk.ids.flatMap(id =>
      featureById.get(id)?.exactSourceFlowIds ?? []));

    const steps: GameplayJourneyInterpretation["steps"] =
      walk.ids.map(subjectId => {
        const node = nodes.get(subjectId)!;
        const scopedEvidence = sorted(node.evidenceIds.filter(id => source.has(id)));
        const origins = scopedEvidence.map(id => source.get(id)!.origin);
        return {
          subjectId,
          label: node.label,
          kind: node.kind,
          meaningBasis: node.status === "authored" &&
              origins.includes("game-design-spec")
            ? "EMBEDDED_DESIGN_TEXT" as const
            : origins.some(origin => origin === "dialogue" ||
                origin === "translation")
              ? "PLAYER_FACING_SOURCE_CUE" as const
              : "TECHNICAL_SOURCE_ONLY" as const,
          intentStatus: node.status === "authored" ? "authored" : "inferred",
          sourceEvidenceIds: scopedEvidence.slice(0, 12),
          omittedSourceEvidenceCount:
            Math.max(0, scopedEvidence.length - 12),
          exactSourceFlowIds:
            featureById.get(subjectId)?.exactSourceFlowIds ?? [],
        };
      });
    const relationships: GameplayJourneyInterpretation["relationships"] =
      walk.edges.map(edge => ({
        relationId: edge.id,
        kind: edge.kind,
        sourceStatus: edge.status === "authored"
          ? "authored" as const : "inferred" as const,
        semanticRole: (edge.kind === "transitions-to")
          ? "STATE_TRANSITION_CANDIDATE" as const
          : (edge.kind === "recovers-to" || edge.kind === "resets")
            ? "RESET_OR_RECOVERY_CANDIDATE" as const
            : (edge.kind === "wins-by" || edge.kind === "loses-by")
              ? "OUTCOME_RELATION" as const
              : "RESOURCE_OR_EFFECT_DEPENDENCY" as const,
        sourceEvidenceIds: sorted(edge.evidenceIds.filter(id => source.has(id))),
      }));
    const win = walk.edges.some(edge => edge.kind === "wins-by");
    const lose = walk.edges.some(edge => edge.kind === "loses-by");
    const terminal = nodes.get(walk.ids[walk.ids.length - 1]!)?.kind === "outcome";
    const missing: GameplayJourneyInterpretation["missingUnderstanding"][number][] = [
      "PLAYER_ENTRY_NOT_PROVEN",
    ];
    if (!steps.some(step => step.kind === "objective" &&
        step.meaningBasis !== "TECHNICAL_SOURCE_ONLY")) {
      missing.push("PLAYER_GOAL_NOT_INDEPENDENTLY_GROUNDED");
    }
    if (!(win || lose)) missing.push("OUTCOME_RULE_UNRESOLVED");
    if (flowIds.length === 0) missing.push("EXACT_SOURCE_EFFECT_PATH_MISSING");
    if (joinGap !== undefined) missing.push("CROSS_SOURCE_JOIN_UNPROVEN");
    // A directed data/effect relationship never certifies play chronology.
    missing.push("SOURCE_RELATION_DIRECTION_NOT_PLAY_ORDER");
    missing.push("MODE_ARENA_ROLE_SCOPE_UNRESOLVED");
    missing.push("RUNTIME_NOT_OBSERVED");

    return {
      id: "authored-journey:" + walk.edges.map(edge =>
        encodeURIComponent(edge.id)).join(":") +
        (joinGap === undefined ? ""
          : ":unproven-join:" + encodeURIComponent(joinGap.nextRelationId)),
      subjectIds: [...walk.ids],
      relationIds: walk.edges.map(edge => edge.id),
      evidenceIds: relationEvidence,
      exactSourceFlowIds: flowIds,
      meaningStatus: walk.edges.every(edge => edge.status === "authored")
        ? "SOURCE_AUTHORED" : "SOURCE_INFERRED",
      boundary,
      runtimeStatus: "NOT_OBSERVED",
      interpretation: {
        basis: "DIRECTED_SELECTED_SOURCE_RELATIONS_NOT_PLAYER_SEQUENCE",
        scope: "MODE_ARENA_AND_ROLE_UNRESOLVED",
        steps,
        relationships,
        ...(joinGap === undefined ? {} : { sourceJoinGap: joinGap }),
        sourceOutcome: win
          ? "WIN_RELATION_CANDIDATE" : lose
            ? "LOSE_RELATION_CANDIDATE" : terminal
              ? "OUTCOME_NODE_WITHOUT_TERMINAL_RULE" : "NOT_ESTABLISHED",
        missingUnderstanding: missing,
      },
    };
  };
  const pending: Walk[] = [];
  const queued = new Set<string>();
  const enqueue = (walk: Walk): void => {
    const key = walk.edges.length === 0
      ? "root:" + walk.ids[0]
      : walk.edges.map(edge => edge.id).join("\u0000");
    if (queued.has(key)) return;
    queued.add(key);
    pending.push(walk);
  };
  for (const id of roots) enqueue({ ids: [id], edges: [] });
  const candidates: GameplayJourneyCandidate[] = [];
  const acceptedIds = new Set<string>();
  const append = (walk: Walk, boundary: Boundary,
    joinGap?: SourceJoinGap): void => {
    const candidate = describe(walk, boundary, joinGap);
    if (!candidate || acceptedIds.has(candidate.id)) return;
    acceptedIds.add(candidate.id);
    candidates.push(candidate);
  };
  let cursor = 0;
  let capacityReached = false;
  while (cursor < pending.length && candidates.length < maxPaths) {
    const walk = pending[cursor++]!;
    const last = walk.ids[walk.ids.length - 1]!;
    const terminal = nodes.get(last)?.kind === "outcome";
    const next = outgoing.get(last) ?? [];
    if (terminal || next.length === 0 || walk.ids.length >= maxDepth) {
      append(walk, terminal
        ? "OUTCOME_SUBJECT" : next.length === 0
          ? "SOURCE_SINK" : "DEPTH_LIMIT");
      continue;
    }
    for (const edge of next) {
      const previous = walk.edges[walk.edges.length - 1];
      const join = previous === undefined
        ? undefined : sourceJoinProof(previous, edge);
      if (join !== undefined && !join.admitted) {
        append(walk, "SOURCE_JOIN_UNPROVEN", {
          viaSubjectId: last,
          previousRelationId: previous!.id,
          nextRelationId: edge.id,
          previousSourceLocators: sourceLocators(previous!),
          nextSourceLocators: sourceLocators(edge),
          missingProof: join.missingProof,
        });
        // Preserve the independently source-backed downstream segment;
        // it starts at the shared node but never inherits upstream proof.
        enqueue({ ids: [last, edge.to], edges: [edge] });
      } else {
        const nextWalk: Walk = {
          ids: [...walk.ids, edge.to],
          edges: [...walk.edges, edge],
        };
        if (walk.ids.includes(edge.to)) {
          append(nextWalk, "CYCLE");
        } else {
          enqueue(nextWalk);
        }
      }
      if (pending.length > 2048 || candidates.length >= maxPaths) {
        capacityReached = true;
        break;
      }
    }
    if (capacityReached) break;
  }
  return {
    candidates: candidates.slice(0, maxPaths)
      .sort((a, b) => a.id.localeCompare(b.id)),
    truncated: capacityReached || cursor < pending.length,
  };
}

export function compileGameplayScenarioGraph(
  input: {
    readonly intent: GameplayIntentModel;
    readonly world: GameplayWorldModel;
    readonly preset: GameplayAuditScenarioPreset;
    /** Same selected-artifact IR already used by Gameplay Intent. */
    readonly semanticIr?: SemanticIr;
    /** Preserve source facts across world-only scenario refreshes. */
    readonly existingSourceFlowCandidates?: readonly GameplaySourceFlowCandidate[];
    /** World-only recompilation has no new source IR to recompute. */
    readonly existingGuardedSourceTransitions?: readonly SourceGuardedStateTransitionCandidate[];
  },
): GameplayScenarioGraph {
  const observedSourceFlows = input.semanticIr
    ? sourceFlowCandidates(input.semanticIr)
    : input.existingSourceFlowCandidates ?? [];
  const guardedSourceTransitions = input.semanticIr
    ? reconcileSourceGuardedStateTransitions(input.semanticIr)
    : input.existingGuardedSourceTransitions ?? [];
  const mechanicReconstructions = reconstructClassifiedMechanics(
    input.intent, observedSourceFlows, guardedSourceTransitions);
  const journey = reconstructAuthoredJourneyCandidates(
    input.intent, mechanicReconstructions, 128, 12, observedSourceFlows);
  const sourceEvidenceIds = new Set(input.intent.evidence
    .filter(record => record.scope === "selected-artifact")
    .map(record => record.id));
  const selectedSourceEvidenceLocators = new Map(input.intent.evidence
    .filter((record) =>
      record.scope === "selected-artifact" &&
      record.origin === "source-code"
    )
    .map((record) => [record.id, record.locator] as const));
  const authoredGuardWitnessesByEdge = authoredOutcomeGuardWitnessesByEdge(
    input.intent, sourceEvidenceIds,
  );
  const playerCounts = presetPlayerCounts(input.preset);
  // A classified name-only declaration is not an observed gameplay flow.
  // Do not promote hypothetical source structure into a player-facing
  // scenario until other selected-artifact evidence grounds that subject.
  const scenarioNodes = input.intent.nodes.filter(
    (node) => SCENARIO_NODE_KINDS.has(node.kind) &&
      node.status !== "hypothesis" &&
      !isAuthoredSourceContentNode(node),
  );
  const runtime = runtimeComponents(input.world);
  const runtimeIds = new Set(
    runtime.map((component) => component.id),
  );

  function presetComponentIds(
    kind: GameplayAuditScenarioPreset["scenarios"][number]["kind"],
  ): readonly string[] {
    const selected = new Set<string>();
    const addRuntime = (...ids: string[]) => {
      for (const id of ids) {
        if (runtimeIds.has(id)) selected.add(id);
      }
    };
    const addIntentKinds = (...kinds: GameplayIntentNode["kind"][]) => {
      for (const node of input.intent.nodes) {
        if (kinds.includes(node.kind) &&
            node.status !== "hypothesis" &&
            !isAuthoredSourceContentNode(node)) {
          selected.add(node.id);
        }
      }
    };

    switch (kind) {
      case "map-type-coverage":
        addIntentKinds(
          "mechanic",
          "objective",
          "phase",
          "lifecycle",
          "state",
          "resource",
          "policy",
          "outcome",
        );
        break;
      case "full-journey":
        // Composition only: concrete child scenarios own runtime knowledge.
        addIntentKinds(
          "phase",
          "mechanic",
          "objective",
          "lifecycle",
          "outcome",
        );
        break;
      case "solo":
      case "two-player":
      case "max-party":
      case "party-capacity-plus-one":
      case "disconnect-reconnect":
        addIntentKinds("lifecycle", "state", "policy", "outcome");
        addRuntime(
          "runtime:arena",
          "runtime:combat",
          "runtime:inventory",
          "runtime:persistence",
        );
        break;
      case "multi-arena-parallel":
      case "arena-capacity-plus-one":
        addIntentKinds("policy", "lifecycle", "state");
        addRuntime("runtime:arena", "runtime:chunks");
        break;
      case "arena-replica-integrity":
        addIntentKinds("policy", "lifecycle", "state", "spatial-region");
        addRuntime("runtime:arena-replica-integrity", "runtime:structures");
        break;
      case "reload-recovery":
        addIntentKinds("lifecycle", "state", "phase");
        addRuntime(
          "runtime:persistence",
          "runtime:arena",
          "runtime:inventory",
          "runtime:combat",
          "runtime:entities",
        );
        break;
      case "deferred-ownership":
        addIntentKinds("lifecycle", "state", "phase", "outcome");
        addRuntime(
          "runtime:arena",
          "runtime:persistence",
          "runtime:chunks",
        );
        break;
      case "terminal-collision":
        addIntentKinds("outcome", "lifecycle", "state", "phase");
        addRuntime(
          "runtime:combat",
          "runtime:arena",
          "runtime:economy",
        );
        break;
      case "transaction-atomicity":
        addIntentKinds("resource", "mechanic", "state", "outcome");
        addRuntime(
          "runtime:economy",
          "runtime:inventory",
          "runtime:persistence",
        );
        break;
      case "simulation-distance":
        addIntentKinds("mechanic", "objective", "spatial-region", "lifecycle");
        addRuntime(
          "runtime:chunks",
          "runtime:entities",
          "runtime:arena",
        );
        break;
      case "progression-wave-integrity":
        addIntentKinds(
          "objective",
          "mechanic",
          "phase",
          "state",
          "actor",
          "outcome",
        );
        addRuntime(
          "runtime:entities",
          "runtime:chunks",
          "runtime:combat",
          "runtime:arena",
        );
        break;
      case "information-correctness":
        addIntentKinds("objective", "resource", "state", "outcome", "policy");
        addRuntime(
          "runtime:economy",
          "runtime:arena",
          "runtime:persistence",
        );
        break;
      case "player-capability-integrity":
        addIntentKinds("policy", "role", "state", "lifecycle");
        addRuntime(
          "runtime:player-capability",
          "runtime:arena",
          "runtime:inventory",
        );
        break;
      case "world-rule-authority":
        addIntentKinds("policy", "state", "lifecycle");
        addRuntime(
          "runtime:world-rules",
          "runtime:entities",
        );
        break;
      case "client-server-reconciliation":
        addIntentKinds("policy", "state", "spatial-region");
        addRuntime(
          "runtime:client-reconciliation",
          "runtime:spatial",
          "runtime:inventory",
        );
        break;
      case "spatial-containment":
        addIntentKinds("spatial-region", "policy", "state");
        addRuntime(
          "runtime:spatial",
          "runtime:arena",
          "runtime:structures",
        );
        break;
      case "repeated-run":
        addIntentKinds("lifecycle", "phase", "state", "outcome");
        addRuntime(
          "runtime:arena",
          "runtime:arena-cleanup",
          "runtime:structures",
          "runtime:entities",
          "runtime:inventory",
          "runtime:economy",
        );
        break;
    }

    return [...selected].sort();
  }

  const scenarioKnowledgeDomains = new Map<string, readonly import("./gameplay-scenario-model.js").GameplayKnowledgeDomain[]>();

  const scenarios: GameplayScenario[] = scenarioNodes.map((node) => {
    const scenarioId = "scenario:" + node.id;
    const requiredDomains =
      requiredKnowledgeDomainsForIntentScenario(
        node,
        input.intent,
        input.world,
      );
    scenarioKnowledgeDomains.set(
      scenarioId,
      requiredDomains,
    );
    const componentIds =
      gameplayScenarioNeighborhoodNodeIds(
        input.intent,
        node.id,
      );
    const causalLinkIds = input.intent.edges
      .filter(
        (edge) =>
          componentIds.includes(edge.from) &&
          componentIds.includes(edge.to),
      )
      .map((edge) => "edge:scenario:" + node.id + ":" + edge.id);

    return {
      id: scenarioId,
      label: node.label,
      gameplayStage: stageForNode(node),
      purpose: purposeForNode(node),
      sourceSubjectIds: [node.id],
      componentIds,
      causalLinkIds,
      playerCounts,
      requiredKnowledgeIds: [],
      composedScenarioIds: [],
    };
  });

  for (const presetScenario of input.preset.scenarios) {
    const scenarioId =
      "preset:" + presetScenario.id;
    const requiredDomains =
      presetScenario.requiredKnowledgeDomains?.length
        ? [...presetScenario.requiredKnowledgeDomains]
        : requiredKnowledgeDomainsForPreset(
            presetScenario.kind,
            input.world,
          );
    scenarioKnowledgeDomains.set(
      scenarioId,
      requiredDomains,
    );
    const componentIds = presetComponentIds(
      presetScenario.kind,
    );
    const sourceSubjectIds =
      presetAnchorIds(
        presetScenario.kind,
        input.intent,
      );
    scenarios.push({
      id: scenarioId,
      label: presetScenario.kind,
      gameplayStage: presetScenario.flowStage,
      purpose: presetScenario.reason,
      sourceSubjectIds,
      componentIds,
      causalLinkIds: [],
      playerCounts:
        presetScenario.playerCount === undefined
          ? playerCounts
          : [presetScenario.playerCount],
      requiredKnowledgeIds: [],
      composedScenarioIds: [],
    });
  }

  const concreteScenarioIds = scenarios
    .filter((scenario) => scenario.label !== "full-journey")
    .map((scenario) => scenario.id)
    .sort();

  const scenariosWithComposition = scenarios.map(
    (scenario) =>
      scenario.label === "full-journey"
        ? {
            ...scenario,
            causalLinkIds: [],
            composedScenarioIds:
              concreteScenarioIds,
          }
        : scenario,
  );

  const knowledgeRequirements = scenariosWithComposition.flatMap(
    (scenario) =>
      buildGameplayKnowledgeRequirements(
        scenario.id,
        scenario.label === "full-journey"
          ? []
          : scenarioKnowledgeDomains.get(scenario.id) ?? [],
        {
          subjectIds: scenario.sourceSubjectIds,
          componentIds: scenario.componentIds,
        },
      ),
  );
  const requirementsByScenario = new Map<
    string,
    readonly string[]
  >();
  for (const scenario of scenariosWithComposition) {
    requirementsByScenario.set(
      scenario.id,
      knowledgeRequirements
        .filter((item) => item.scenarioId === scenario.id)
        .map((item) => item.id),
    );
  }
  const scenariosWithKnowledge = scenariosWithComposition.map(
    (scenario) => ({
      ...scenario,
      requiredKnowledgeIds:
        requirementsByScenario.get(scenario.id) ?? [],
    }),
  );

  const scenarioIdsBySubject = new Map<string, Set<string>>();
  for (const scenario of scenariosWithKnowledge) {
    for (const subjectId of scenario.componentIds) {
      const set = scenarioIdsBySubject.get(subjectId) ?? new Set<string>();
      set.add(scenario.id);
      scenarioIdsBySubject.set(subjectId, set);
    }
  }

  // Declaration-only hypotheses belong to Intent's unconfirmed candidate
  // inventory, not gameplay component ownership or orphan/closure accounting.
  // Canonical authored content trees belong to the selected-source
  // Game Design navigation, not to gameplay scenario proof components.
  // Their presence must not inflate closure, generic resource scenarios,
  // causal links or operator proof requirements.
  const components: GameplayScenarioComponent[] = input.intent.nodes
    .filter(node => node.status !== "hypothesis" &&
      !isAuthoredSourceContentNode(node))
    .map((node) => {
    const usedBy = [...(scenarioIdsBySubject.get(node.id) ?? [])].sort();
    return {
      id: node.id,
      label: node.label,
      kind: node.kind,
      technicalRole: technicalRoleForNode(node),
      gameplayPurpose: purposeForNode(node),
      evidenceIds: [...node.evidenceIds],
      usedByScenarioIds: usedBy,
      orphan: usedBy.length === 0 && node.kind !== "game",
    };
  });

  const runtimeDomainKnowledge: Readonly<Record<
    string,
    import("./gameplay-scenario-model.js").GameplayKnowledgeDomain
  >> = {
    "runtime:arena": "arena-lifecycle",
    "runtime:arena-cleanup": "arena-lifecycle",
    "runtime:arena-replica-integrity": "world-structure",
    "runtime:chunks": "chunk-simulation",
    "runtime:entities": "entity-behavior",
    "runtime:combat": "combat-lifecycle",
    "runtime:inventory": "inventory-state",
    "runtime:persistence": "persistence-recovery",
    "runtime:structures": "world-structure",
    "runtime:economy": "economy-reward",
    "runtime:world-rules": "platform-constraints",
    "runtime:player-capability": "platform-constraints",
    "runtime:client-reconciliation": "platform-constraints",
    "runtime:spatial": "spatial-authority",
  };

  for (const component of runtime) {
    const requiredDomain =
      runtimeDomainKnowledge[component.id];
    const usedBy = requiredDomain === undefined
      ? []
      : scenariosWithKnowledge
          .filter((scenario) => {
            const domains =
              scenarioKnowledgeDomains.get(
                scenario.id,
              ) ?? [];
            return domains.includes(requiredDomain);
          })
          .map((scenario) => scenario.id);
    components.push({
      ...component,
      usedByScenarioIds: usedBy,
      orphan: usedBy.length === 0,
    });
  }

  const componentIds = new Set(components.map((component) => component.id));
  const causalLinks: GameplayCausalLink[] = [];
  for (const scenario of scenariosWithKnowledge) {
    if (scenario.label === "full-journey") continue;
    const allowed = new Set(scenario.componentIds);
    for (const edge of input.intent.edges) {
      if (!allowed.has(edge.from) || !allowed.has(edge.to)) continue;
      if (!componentIds.has(edge.from) || !componentIds.has(edge.to)) continue;
      const impactPath = provenImpactPathFrom(
        edge.to, allowed, input.intent, sourceEvidenceIds,
      );
      const causalStatus = edgeStatus(edge, sourceEvidenceIds);
      const guardWitnessIds = authoredGuardWitnessesByEdge.get(edge.id) ?? [];
      causalLinks.push({
        id: "edge:" + scenario.id + ":" + edge.id,
        scenarioId: scenario.id,
        fromComponentId: edge.from,
        toComponentId: edge.to,
        purpose:
          edge.description?.trim() ||
          "Prove that " + edge.from + " " + edge.kind + " " + edge.to + " in this gameplay scenario.",
        evidenceIds: [...edge.evidenceIds],
        subjectIds: [
          ...new Set([
            ...scenario.sourceSubjectIds,
            edge.from,
            edge.to,
          ]),
        ].sort(),
        componentIds: [
          ...new Set([
            edge.from,
            edge.to,
          ]),
        ].sort(),
        knowledgeRequirementIds: [],
        impactPathComponentIds: impactPath.impactPathComponentIds,
        impactPathEvidenceIds: impactPath.impactPathEvidenceIds,
        dimensionEvidence: guardWitnessIds.length > 0
          ? { guard: guardWitnessIds }
          : {},
        intentEdgeKind: edge.kind,
        status: causalStatus,
        reason:
          causalStatus === "PROVEN"
            ? "Selected-artifact evidence connects both gameplay components."
            : "This causal link is not grounded strongly enough to close the scenario.",
      });
    }
  }

  const knowledgeReceipts =
    buildGameplayKnowledgeReceipts(
      knowledgeRequirements,
      input.world,
    );

  const scenarioById = new Map(
    scenariosWithKnowledge.map((scenario) => [
      scenario.id,
      scenario,
    ]),
  );
  for (const component of components.filter((item) => item.kind === "runtime-domain")) {
    for (const scenarioId of component.usedByScenarioIds) {
      const scenario = scenarioById.get(scenarioId);
      if (!scenario) continue;
      const anchorId =
        scenario.sourceSubjectIds.find(
          (id) => componentIds.has(id),
        );
      if (!anchorId || !componentIds.has(anchorId)) continue;
      const knowledgeDomain =
        runtimeDomainKnowledge[component.id];
      const requirement =
        knowledgeDomain === undefined
          ? undefined
          : knowledgeRequirements.find(
              (item) =>
                item.scenarioId === scenarioId &&
                item.domain === knowledgeDomain,
            );
      const relevantRequirements =
        knowledgeRequirements.filter(
          (item) =>
            item.scenarioId === scenarioId &&
            (
              item.id === requirement?.id ||
              item.componentIds.includes(component.id) ||
              item.componentIds.includes(anchorId)
            ),
        );
      const receipt =
        requirement === undefined
          ? undefined
          : knowledgeReceipts.find(
              (item) =>
                item.requirementId === requirement.id,
            );
      const anchorEvidenceIds = new Set(
        [
          ...(requirement?.subjectIds ?? []),
          ...(requirement?.componentIds ?? []),
        ].flatMap((id) => {
          const node = input.intent.nodes.find(
            (item) => item.id === id,
          );
          return node?.evidenceIds ?? [];
        }),
      );
      const sourceLocators = input.intent.evidence
        .filter(
          (item) =>
            anchorEvidenceIds.has(item.id) &&
            item.scope === "selected-artifact",
        )
        .map((item) => item.locator)
        .filter(Boolean);

      const impactPath = provenImpactPathFrom(
        anchorId, new Set(scenario.componentIds), input.intent, sourceEvidenceIds,
      );
      causalLinks.push({
        id: "edge:" + scenarioId + ":" + component.id,
        scenarioId,
        fromComponentId: component.id,
        toComponentId: anchorId,
        purpose: component.gameplayPurpose,
        evidenceIds:
          receipt?.status === "SATISFIED"
            ? [...receipt.evidenceIds]
            : [],
        subjectIds:
          requirement === undefined
            ? [...scenario.sourceSubjectIds]
            : [...requirement.subjectIds],
        componentIds:
          requirement === undefined
            ? [component.id, anchorId].sort()
            : [
                ...new Set([
                  ...requirement.componentIds,
                  component.id,
                  anchorId,
                ]),
              ].sort(),
        knowledgeRequirementIds:
          expandGameplayKnowledgeRequirementIds(
            relevantRequirements.map((item) => item.id),
            knowledgeRequirements,
          ),
        impactPathComponentIds: impactPath.impactPathComponentIds,
        impactPathEvidenceIds: impactPath.impactPathEvidenceIds,
        dimensionEvidence:
          dimensionEvidenceForRuntimeComponent(
            component.id,
            input.world,
            sourceLocators,
            selectedSourceEvidenceLocators,
          ),
        ...runtimeEdgeState(
          component.id,
          input.world,
          sourceLocators,
          scenario.label,
        ),
      });
    }
  }

  const scenariosWithCausalLinks =
    scenariosWithKnowledge.map((scenario) => ({
      ...scenario,
      causalLinkIds: causalLinks
        .filter(
          (link) =>
            link.scenarioId === scenario.id,
        )
        .map((link) => link.id)
        .sort(),
    }));

  return {
    schemaVersion: 1,
    policy: "scenario-driven-causal-audit",
    scenarios: scenariosWithCausalLinks,
    components,
    causalLinks,
    knowledgeRequirements,
    knowledgeReceipts,
    requiredInspectionGraph: {
      policy: "required-inspection-graph",
      nodes: knowledgeRequirements,
      receipts: knowledgeReceipts,
    },
    sourceFlowCandidates: observedSourceFlows,
    mechanicReconstructions,
    gameplayJourneyCandidates: journey.candidates,
    gameplayJourneyTruncated: journey.truncated,
    guardedSourceTransitions,
  };
}
