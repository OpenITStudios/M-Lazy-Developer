import type {
  GameplayIssueFailureDomain,
} from "../../diagnostic-reasoning/src/index.js";
import type {
  NeedValidationAuditIssueProjection,
} from "./map-audit-issue-projection.js";
import type {
  GameplayWorldModel,
} from "./inspection/gameplay-world-model.js";
import {
  historicalSearchHintsForFinding,
  historicalSearchPressure,
  type AuditHistoricalSearchHint,
} from "./map-audit-history-hints.js";
import {
  proofSaturationFamilyCriteria,
} from "./map-audit-proof-saturation.js";

export interface AuditProofNavigationStep {
  readonly order: number;
  readonly knowledgeDomain: string;
  readonly question: string;
  readonly purpose: string;
  readonly evidencePreference:
    | "selected-artifact"
    | "cross-domain"
    | "formal"
    | "runtime";
}

export interface AuditEvidenceSubstitution {
  readonly id: string;
  readonly replaces: string;
  readonly requiredEvidence: readonly string[];
  readonly applicableBecause: readonly string[];
  readonly decisionRule: string;
}

export interface AuditProofNavigation {
  readonly recipeId: string;
  readonly proofGoal: string;
  readonly provenClaims: readonly string[];
  readonly missingClaims: readonly string[];
  readonly route: readonly AuditProofNavigationStep[];
  readonly evidenceSubstitutions: readonly AuditEvidenceSubstitution[];
  readonly historicalSearchHints: readonly AuditHistoricalSearchHint[];
  readonly historyPressure: number;
  readonly familyProofCriteria: readonly string[];
  readonly proofStopRule: string;
  /**
   * Runtime remains the final escalation tier, not the default next action.
   * This flag preserves the policy that runtime comes last.
   */
  readonly runtimeLastResort: boolean;
  /**
   * True only for an explicitly runtime-native deciding claim. An available
   * static/formal substitution is an investigation lead, not a proof receipt.
   * The route still prioritizes non-runtime proof before the last resort.
   */
  readonly runtimeRequired?: boolean;
}

interface ProofRecipe {
  readonly id: string;
  readonly goal: string;
  readonly route: readonly Omit<AuditProofNavigationStep, "order">[];
}

const RECIPES: Readonly<Record<GameplayIssueFailureDomain, ProofRecipe>> = {
  "progression-wave-objective": {
    id: "proof:progression-dead-end",
    goal:
      "Prove or disprove a reachable state where required progression cannot correctly advance or terminate.",
    route: [
      {
        knowledgeDomain: "state-flow",
        question:
          "What exact state/counter/objective gates progression and which paths mutate it?",
        purpose:
          "Establish the completion dependency and every reachable mutation path.",
        evidencePreference: "selected-artifact",
      },
      {
        knowledgeDomain: "entity-behavior",
        question:
          "Can required actors terminate, unload, despawn, or fail without the progression tracker being reconciled?",
        purpose:
          "Find alternate actor lifecycle paths that can strand progression.",
        evidencePreference: "cross-domain",
      },
      {
        knowledgeDomain: "chunk-simulation",
        question:
          "Does progression depend on actors/world logic outside guaranteed simulation ownership?",
        purpose:
          "Replace broad runtime uncertainty with simulation ownership evidence when possible.",
        evidencePreference: "cross-domain",
      },
      {
        knowledgeDomain: "runtime",
        question:
          "Can the exact unresolved progression state be observed in Minecraft?",
        purpose:
          "Use one narrow observation only if source/cross-domain proof cannot decide the claim.",
        evidencePreference: "runtime",
      },
    ],
  },
  "arena-multi-arena": {
    id: "proof:arena-concurrency-isolation",
    goal:
      "Prove or disprove that concurrent arenas preserve advertised capacity, ownership, isolation, and cleanup.",
    route: [
      {
        knowledgeDomain: "arena-lifecycle",
        question:
          "How are arena membership, ownership, admission, cleanup, and reuse scoped?",
        purpose:
          "Establish the arena ownership contract.",
        evidencePreference: "selected-artifact",
      },
      {
        knowledgeDomain: "multiplayer-interleaving",
        question:
          "Can one arena mutate players/state/entities/world effects owned by another arena?",
        purpose:
          "Search cross-arena write/select/isolation violations.",
        evidencePreference: "cross-domain",
      },
      {
        knowledgeDomain: "chunk-simulation",
        question:
          "Do shared simulation resources reduce actual concurrent capacity below visible capacity?",
        purpose:
          "Resolve resource-bound capacity without assuming a two-arena pass generalizes.",
        evidencePreference: "cross-domain",
      },
      {
        knowledgeDomain: "runtime",
        question:
          "At the unresolved boundary, can all required arenas progress independently?",
        purpose:
          "Observe only the irreducible concurrency boundary.",
        evidencePreference: "runtime",
      },
    ],
  },
  "inventory-economy": {
    id: "proof:inventory-reward-lifecycle",
    goal:
      "Prove or disprove item/currency loss, duplication, wrong ownership, or non-idempotent delivery.",
    route: [
      {
        knowledgeDomain: "inventory-state",
        question:
          "Which paths grant, clear, restore, drop, consume, or equip the same player/item scope?",
        purpose:
          "Enumerate competing lifecycle writers.",
        evidencePreference: "selected-artifact",
      },
      {
        knowledgeDomain: "persistence-recovery",
        question:
          "Can reconnect/reload restore the same item or currency after another grant path already committed?",
        purpose:
          "Find duplicate or missing restore ownership.",
        evidencePreference: "cross-domain",
      },
      {
        knowledgeDomain: "economy-reward",
        question:
          "Are reward delivery and consume/idempotency semantics deterministic across terminal and retry paths?",
        purpose:
          "Prove one-time entitlement and delivery.",
        evidencePreference: "cross-domain",
      },
      {
        knowledgeDomain: "runtime",
        question:
          "Does the exact unresolved lifecycle produce missing or duplicated player inventory/reward state?",
        purpose:
          "Use a single targeted lifecycle observation as last resort.",
        evidencePreference: "runtime",
      },
    ],
  },
  "temporal-async": {
    id: "proof:stale-async-mutation",
    goal:
      "Prove or disprove that deferred work can commit after its owner/session/arena/phase generation changes.",
    route: [
      {
        knowledgeDomain: "temporal-ownership",
        question:
          "Who schedules the work, what owner/generation existed then, and what mutation commits later?",
        purpose:
          "Bind deferred work to an explicit owner and generation.",
        evidencePreference: "selected-artifact",
      },
      {
        knowledgeDomain: "state-flow",
        question:
          "Can cleanup, retry, reconnect, terminal, or reuse change ownership before commit?",
        purpose:
          "Establish a reachable stale-commit window.",
        evidencePreference: "cross-domain",
      },
      {
        knowledgeDomain: "formal",
        question:
          "Can bounded state/interleaving search produce a counterexample ordering?",
        purpose:
          "Prefer deterministic ordering proof before live timing reproduction.",
        evidencePreference: "formal",
      },
      {
        knowledgeDomain: "runtime",
        question:
          "Can the unresolved callback commit across before/overlap/after timing windows?",
        purpose:
          "Observe only irreducible engine scheduling behavior.",
        evidencePreference: "runtime",
      },
    ],
  },
  "chunk-simulation": {
    id: "proof:simulation-residency",
    goal:
      "Prove or disprove whether gameplay-critical actors/world logic remain simulated for the full required lifecycle.",
    route: [
      {
        knowledgeDomain: "chunk-simulation",
        question:
          "What gameplay dependency requires residency, who acquires it, when is readiness proven, and who releases it?",
        purpose:
          "Establish explicit simulation ownership.",
        evidencePreference: "selected-artifact",
      },
      {
        knowledgeDomain: "platform-constraints",
        question:
          "What selected-version simulation/capacity constraint applies to the dependency?",
        purpose:
          "Substitute documented platform constraints for unnecessary runtime trial.",
        evidencePreference: "cross-domain",
      },
      {
        knowledgeDomain: "entity-behavior",
        question:
          "What player-visible progression depends on the remote actor/world region?",
        purpose:
          "Bind simulation failure to concrete gameplay consequence.",
        evidencePreference: "cross-domain",
      },
      {
        knowledgeDomain: "runtime",
        question:
          "Does the exact unresolved actor/region stop simulating under the required scenario?",
        purpose:
          "Use one narrow residency observation only when still irreducible.",
        evidencePreference: "runtime",
      },
    ],
  },
  "persistence-recovery": {
    id: "proof:persistence-recovery",
    goal:
      "Prove or disprove stale, missing, duplicated, or wrongly restored state across disconnect/reconnect/reload/retry.",
    route: [
      {
        knowledgeDomain: "persistence-recovery",
        question:
          "What state persists, what identity/scope owns it, and what restore/reset path consumes it?",
        purpose:
          "Establish save/restore/reset semantics.",
        evidencePreference: "selected-artifact",
      },
      {
        knowledgeDomain: "state-flow",
        question:
          "Can persisted state outlive its intended round/match/session lifetime?",
        purpose:
          "Find over-persistence and under-reset paths.",
        evidencePreference: "cross-domain",
      },
      {
        knowledgeDomain: "temporal-ownership",
        question:
          "Can pending work restore stale state after a newer lifecycle already started?",
        purpose:
          "Resolve persistence × async races.",
        evidencePreference: "cross-domain",
      },
      {
        knowledgeDomain: "runtime",
        question:
          "Does the exact unresolved recovery transition restore the expected state once?",
        purpose:
          "Observe only irreducible engine persistence behavior.",
        evidencePreference: "runtime",
      },
    ],
  },
  "state-ownership": {
    id: "proof:state-ownership-lifecycle",
    goal:
      "Prove or disprove that material state has one valid owner, bounded writers, and complete reset/exit semantics.",
    route: [
      {
        knowledgeDomain: "state-flow",
        question:
          "Who creates, reads, writes, clears, and transitions this state?",
        purpose:
          "Build the authoritative state lifecycle.",
        evidencePreference: "selected-artifact",
      },
      {
        knowledgeDomain: "arena-lifecycle",
        question:
          "Is state scoped to player/arena/run or accidentally shared?",
        purpose:
          "Resolve shared-state ownership when multiplayer/arena context exists.",
        evidencePreference: "cross-domain",
      },
      {
        knowledgeDomain: "temporal-ownership",
        question:
          "Can a stale writer commit after state ownership changes?",
        purpose:
          "Resolve generation and deferred-writer risk.",
        evidencePreference: "cross-domain",
      },
      {
        knowledgeDomain: "runtime",
        question:
          "Does the unresolved state actually leak/block/reset incorrectly in the target transition?",
        purpose:
          "Observe only the remaining irreducible state behavior.",
        evidencePreference: "runtime",
      },
    ],
  },
  "entity-ai-combat": {
    id: "proof:entity-combat-lifecycle",
    goal:
      "Prove or disprove actor spawn/navigation/combat/death/revive lifecycle contradictions that affect gameplay.",
    route: [
      {
        knowledgeDomain: "entity-behavior",
        question:
          "Can the actor spawn, target, navigate, terminate, and be accounted on every required path?",
        purpose:
          "Establish actor lifecycle completeness.",
        evidencePreference: "selected-artifact",
      },
      {
        knowledgeDomain: "combat-lifecycle",
        question:
          "Can hurt/downed/revive/death/respawn paths overlap or commit in the wrong order?",
        purpose:
          "Resolve combat terminal and recovery ownership.",
        evidencePreference: "cross-domain",
      },
      {
        knowledgeDomain: "chunk-simulation",
        question:
          "Can unload/residency behavior invalidate actor progression semantics?",
        purpose:
          "Resolve actor × simulation interaction.",
        evidencePreference: "cross-domain",
      },
      {
        knowledgeDomain: "runtime",
        question:
          "Does the exact unresolved actor path fail in Minecraft?",
        purpose:
          "Observe engine-only navigation/physics/runtime residue.",
        evidencePreference: "runtime",
      },
    ],
  },
  "world-structure-mutation": {
    id: "proof:world-mutation-lifecycle",
    goal:
      "Prove or disprove incorrect world/structure mutation, ordering, containment, or cleanup.",
    route: [
      {
        knowledgeDomain: "world-structure",
        question:
          "What structure/world mutation is applied, in what order, and what previous state must be cleared/replaced?",
        purpose:
          "Establish mutation and transition semantics.",
        evidencePreference: "selected-artifact",
      },
      {
        knowledgeDomain: "spatial-authority",
        question:
          "Is the mutation contained to the intended arena/plot/region?",
        purpose:
          "Resolve spatial leakage and wrong-target mutation.",
        evidencePreference: "cross-domain",
      },
      {
        knowledgeDomain: "state-flow",
        question:
          "Can progression advance before the mutation is ready or after stale residue remains?",
        purpose:
          "Bind world mutation to gameplay state.",
        evidencePreference: "cross-domain",
      },
      {
        knowledgeDomain: "runtime",
        question:
          "Does the exact unresolved placement/load/cleanup produce the wrong playable world state?",
        purpose:
          "Observe only engine-dependent placement behavior.",
        evidencePreference: "runtime",
      },
    ],
  },
  "boundary-capacity": {
    id: "proof:boundary-contract",
    goal:
      "Prove or disprove incorrect below/at/above-boundary behavior for a material gameplay limit.",
    route: [
      {
        knowledgeDomain: "state-flow",
        question:
          "What value is the boundary, what transition depends on it, and what should happen at N-1/N/N+1?",
        purpose:
          "Extract the boundary contract.",
        evidencePreference: "selected-artifact",
      },
      {
        knowledgeDomain: "platform-constraints",
        question:
          "Is the effective boundary reduced by a selected-version platform/resource constraint?",
        purpose:
          "Resolve implementation versus platform capacity.",
        evidencePreference: "cross-domain",
      },
      {
        knowledgeDomain: "formal",
        question:
          "Can arithmetic/config/state constraints prove the boundary violation without runtime?",
        purpose:
          "Prefer deterministic quantitative proof.",
        evidencePreference: "formal",
      },
      {
        knowledgeDomain: "runtime",
        question:
          "At the unresolved boundary, does actual behavior match the grounded contract?",
        purpose:
          "Observe only the final irreducible boundary.",
        evidencePreference: "runtime",
      },
    ],
  },
  "player-lifecycle": {
    id: "proof:player-lifecycle",
    goal:
      "Prove or disprove invalid player state across join/leave/death/respawn/disconnect/reconnect/recovery.",
    route: [
      {
        knowledgeDomain: "state-flow",
        question:
          "What player/session state changes at each lifecycle event and who owns the transition?",
        purpose:
          "Establish lifecycle state ownership.",
        evidencePreference: "selected-artifact",
      },
      {
        knowledgeDomain: "persistence-recovery",
        question:
          "What state is intentionally preserved or reset across reconnect/reload?",
        purpose:
          "Resolve recovery semantics.",
        evidencePreference: "cross-domain",
      },
      {
        knowledgeDomain: "inventory-state",
        question:
          "Do loadout/equipment/reward states follow the same lifecycle contract?",
        purpose:
          "Resolve player lifecycle × inventory interactions.",
        evidencePreference: "cross-domain",
      },
      {
        knowledgeDomain: "runtime",
        question:
          "Does the exact lifecycle transition return the player to one valid state?",
        purpose:
          "Observe only irreducible lifecycle behavior.",
        evidencePreference: "runtime",
      },
    ],
  },
  "ui-feedback-information": {
    id: "proof:player-information-contract",
    goal:
      "Prove or disprove that player-facing information matches actual gameplay state/capability.",
    route: [
      {
        knowledgeDomain: "state-flow",
        question:
          "What actual state/capability is communicated to the player?",
        purpose:
          "Ground the source of truth behind the UI/message.",
        evidencePreference: "selected-artifact",
      },
      {
        knowledgeDomain: "ui-feedback",
        question:
          "What text/form/HUD/message is actually presented and under what condition?",
        purpose:
          "Compare presented versus actual gameplay information.",
        evidencePreference: "cross-domain",
      },
      {
        knowledgeDomain: "runtime",
        question:
          "Is the unresolved UI state actually visible/misleading in the client?",
        purpose:
          "Observe rendering/visibility only when source evidence cannot decide it.",
        evidencePreference: "runtime",
      },
    ],
  },
  "platform-performance": {
    id: "proof:platform-gameplay-impact",
    goal:
      "Prove or disprove a selected-version platform/performance constraint that materially reduces gameplay behavior.",
    route: [
      {
        knowledgeDomain: "platform-constraints",
        question:
          "What exact selected-version platform constraint applies?",
        purpose:
          "Ground platform behavior from applicable knowledge.",
        evidencePreference: "selected-artifact",
      },
      {
        knowledgeDomain: "state-flow",
        question:
          "Which required gameplay dependency is changed by the constraint?",
        purpose:
          "Translate platform limitation into player-visible consequence.",
        evidencePreference: "cross-domain",
      },
      {
        knowledgeDomain: "runtime",
        question:
          "Does the target runtime exhibit the unresolved platform behavior?",
        purpose:
          "Observe only when documentation/source constraints are insufficient.",
        evidencePreference: "runtime",
      },
    ],
  },
};

function substitutionCandidates(
  finding: NeedValidationAuditIssueProjection,
  world?: GameplayWorldModel,
): readonly AuditEvidenceSubstitution[] {
  if (world === undefined) return [];

  const output: AuditEvidenceSubstitution[] = [];

  if (
    finding.failureDomain === "arena-multi-arena" &&
    world.arenas.count !== undefined &&
    world.arenas.safeConcurrentArenas !== undefined &&
    world.arenas.safeConcurrentArenas !== null
  ) {
    output.push({
      id: "substitution:arena-capacity-quantitative",
      replaces:
        "Broad runtime trial to discover whether visible arena capacity exceeds safe concurrent capacity.",
      requiredEvidence: [
        "visible arena count",
        "safe concurrent arena count",
        "selected-artifact/player-facing capacity presentation",
      ],
      applicableBecause: [
        "visibleArenaCount=" +
          String(world.arenas.count),
        "safeConcurrentArenas=" +
          String(world.arenas.safeConcurrentArenas),
      ],
      decisionRule:
        "If presented/visible concurrent capacity is greater than the grounded safe playable concurrency and no grounded design communicates the lower limit, the capacity mismatch can be proven without broad runtime trial.",
    });
  }

  if (
    (
      finding.failureDomain === "chunk-simulation" ||
      finding.failureDomain === "progression-wave-objective"
    ) &&
    world.entities.definitions > 0 &&
    world.platformKnowledge.profileResolved
  ) {
    output.push({
      id: "substitution:simulation-ownership",
      replaces:
        "Generic runtime test asking whether remote actors might stop simulating.",
      requiredEvidence: [
        "gameplay dependency on remote actor/world logic",
        "actor/spatial location or simulation dependency",
        "ticking/readiness ownership or its absence",
        "applicable selected-version platform constraint",
      ],
      applicableBecause: [
        "entityDefinitions=" +
          String(world.entities.definitions),
        "platformProfileResolved=true",
        "tickingAreaAcquires=" +
          String(world.chunks.tickingAreaAcquires),
        "readinessProbes=" +
          String(world.chunks.readinessProbes),
      ],
      decisionRule:
        "If progression requires simulation outside normal residency and selected-artifact evidence shows no sufficient residency/readiness ownership under the applicable platform constraint, prove the implementation/simulation gap statically; runtime is only needed to demonstrate the visible symptom.",
    });
  }

  if (
    finding.failureDomain === "inventory-economy" &&
    (
      world.inventory.restoreOwnership.multipleRestoreOwners > 0 ||
      world.inventory.restoreConflicts.length > 0
    )
  ) {
    output.push({
      id: "substitution:inventory-multi-writer",
      replaces:
        "Broad reconnect/death trial to discover duplicate restore ownership.",
      requiredEvidence: [
        "two or more reachable restore/grant owners",
        "same player/item lifecycle scope",
        "absence of mutual exclusion/idempotency/generation guard",
      ],
      applicableBecause: [
        "multipleRestoreOwners=" +
          String(
            world.inventory.restoreOwnership.multipleRestoreOwners,
          ),
        "restoreConflicts=" +
          String(world.inventory.restoreConflicts.length),
      ],
      decisionRule:
        "If competing restore/grant owners can reach the same item/player/run scope and no deterministic exclusion or idempotency guard makes double delivery unreachable, duplication/lifecycle conflict can be proven from source.",
    });
  }

  if (
    finding.failureDomain === "persistence-recovery" &&
    (world.persistence?.appendWithoutClear ?? 0) > 0
  ) {
    output.push({
      id: "substitution:persistence-growth-without-clear",
      replaces:
        "Repeated runtime sessions merely to discover stale accumulated persistent state.",
      requiredEvidence: [
        "append/write path",
        "intended finite lifecycle",
        "reachable cleanup/reset boundary",
        "absence of clear/reset before reuse",
      ],
      applicableBecause: [
        "appendWithoutClear=" +
          String(
            world.persistence?.appendWithoutClear ?? 0,
          ),
        "worldScopedAppendWithoutClear=" +
          String(
            world.persistence?.worldScopedAppendWithoutClear ?? 0,
          ),
      ],
      decisionRule:
        "If run/session-local state appends persistently and no reachable clear/reset exists before reuse, stale-state persistence can be proven without waiting for repeated runtime accumulation.",
    });
  }

  if (
    finding.failureDomain === "world-structure-mutation" &&
    (
      world.structures.transitionResidueRisks > 0 ||
      world.structures.transitionResidueUnresolved > 0
    )
  ) {
    output.push({
      id: "substitution:structure-transition-residue",
      replaces:
        "Broad replay testing to discover leftover structure/world state.",
      requiredEvidence: [
        "previous structure/mutation footprint",
        "next structure/mutation footprint",
        "preserved cells or unresolved replacement",
        "gameplay dependency on clean baseline",
      ],
      applicableBecause: [
        "transitionResidueRisks=" +
          String(world.structures.transitionResidueRisks),
        "transitionResidueUnresolved=" +
          String(
            world.structures.transitionResidueUnresolved,
          ),
      ],
      decisionRule:
        "If a transition preserves/reuses cells that the next gameplay state requires reset and no explicit clear/replacement covers them, residue can be proven structurally.",
    });
  }

  if (
    finding.failureDomain === "boundary-capacity" &&
    world.arenas.count !== undefined &&
    (
      world.arenas.safeConcurrentArenas !== undefined ||
      world.arenas.declaredConcurrentArenaLimit !== undefined
    )
  ) {
    output.push({
      id: "substitution:boundary-arithmetic",
      replaces:
        "Trial-and-error boundary discovery in runtime.",
      requiredEvidence: [
        "declared/visible boundary",
        "effective implementation limit",
        "admission/transition rule at the boundary",
      ],
      applicableBecause: [
        "arenaCount=" +
          String(world.arenas.count),
        "effectiveLimit=" +
          String(
            world.arenas.safeConcurrentArenas ??
            world.arenas.declaredConcurrentArenaLimit ??
            "unknown",
          ),
      ],
      decisionRule:
        "If the effective implementation limit is statically known, derive N-1/N/N+1 behavior from the admission/transition rule and reserve runtime only for engine-dependent boundary semantics.",
    });
  }

  return output;
}

function runtimeIsInherentlyRequired(
  finding: NeedValidationAuditIssueProjection,
): boolean {
  // Do not let a proposed alternative source check suppress an explicit
  // native-runtime unknown: substitution candidates are NOT executed proof.
  // Equally, generic instructions mentioning runtime do not by themselves
  // establish that the missing decision is runtime-native.
  const unresolved = [
    finding.validationReason,
    finding.missingProof,
  ].join(" ");

  return /(?:native\s+(?:client|engine|render|input|physics|collision|pathfind|simulation)|client[-\s/]*(?:server[-\s/]*)?reconcil|multi[-\s]?client\s+visual|render(?:ing)?\s+(?:visibility|state)|actual\s+(?:pathfind|collision|physics|simulation)|performance\s+manifestation)/i.test(
    unresolved,
  );
}

function reprioritizeRouteWithHistoricalHints(
  route: readonly AuditProofNavigationStep[],
  hints: readonly AuditHistoricalSearchHint[],
): readonly AuditProofNavigationStep[] {
  if (hints.length === 0) {
    return route;
  }

  const hintedDomains = new Set(
    hints.flatMap((hint) =>
      hint.knowledgeDomains,
    ),
  );

  const nonRuntime = route.filter(
    (step) => step.evidencePreference !== "runtime",
  );
  const runtime = route.filter(
    (step) => step.evidencePreference === "runtime",
  );

  const ordered = [
    ...nonRuntime.filter((step) =>
      hintedDomains.has(step.knowledgeDomain)
    ),
    ...nonRuntime.filter((step) =>
      !hintedDomains.has(step.knowledgeDomain)
    ),
    ...runtime,
  ];

  return ordered.map((step, index) => ({
    ...step,
    order: index + 1,
  }));
}

export function buildAuditProofNavigation(
  finding: NeedValidationAuditIssueProjection,
  world?: GameplayWorldModel,
): AuditProofNavigation {
  const recipe = RECIPES[finding.failureDomain];
  const provenClaims = [
    ...(finding.evidenceIds.length > 0
      ? [
          "Evidence is already bound to this finding scope: " +
            finding.evidenceIds.join(", ") +
            ".",
        ]
      : []),
    ...(finding.playerFacingEvidenceIds.length > 0
      ? [
          "Player-facing evidence is already bound: " +
            finding.playerFacingEvidenceIds.join(", ") +
            ".",
        ]
      : []),
  ];

  const baseRoute = recipe.route.map(
    (step, index) => ({
      order: index + 1,
      ...step,
    }),
  );
  const required = finding.missingProofCriteria;
  const missingClaims = required === undefined
    ? [finding.missingProof]
    : required.map(item =>
      item.scope.toUpperCase() + " " + item.id + ": " + item.description);
  const missingDimensions = finding.missingCounterProofDimensions ?? [];
  const exactCounterProofStep: readonly AuditProofNavigationStep[] =
    missingDimensions.length === 0 ? [] : [{
      order: 1,
      knowledgeDomain: "counter-proof",
      question:
        "Which source-bound witness exhausts the exact " +
        missingDimensions.join(", ") + " dimension(s) for this causal link?",
      purpose:
        "Search only the missing dimensions for a reachable guard, " +
        "scope or blocking alternative; attach one exact proof receipt " +
        "or keep the dimension unresolved.",
      evidencePreference: "selected-artifact",
    }];
  const historicalSearchHints =
    world === undefined
      ? []
      : historicalSearchHintsForFinding(
          finding,
          world,
        );

  const evidenceSubstitutions =
    substitutionCandidates(
      finding,
      world,
    );

  return {
    recipeId: recipe.id,
    proofGoal: recipe.goal,
    provenClaims,
    missingClaims,
    route: [
      ...exactCounterProofStep,
      ...reprioritizeRouteWithHistoricalHints(
        baseRoute,
        historicalSearchHints,
      ),
    ].map((step, index) => ({
      ...step,
      order: index + 1,
    })),
    evidenceSubstitutions,
    historicalSearchHints,
    historyPressure:
      historicalSearchPressure(
        historicalSearchHints,
      ),
    // Submit only still-unsatisfied family claims to the AI handoff.
    // Older manually supplied findings without criterion detail retain
    // their safe domain recipe as a fallback.
    familyProofCriteria: required === undefined
      ? proofSaturationFamilyCriteria(finding.failureDomain)
      : required.filter(item => item.scope === "family")
        .map(item => item.id + ": " + item.description),
    proofStopRule:
      "Once every applicable family criterion is grounded and universal contradiction/translation/scope/evidence/counter-proof criteria are saturated, stop searching and do not request runtime manifestation merely for reassurance.",
    runtimeLastResort: true,
    runtimeRequired:
      runtimeIsInherentlyRequired(finding),
  };
}
