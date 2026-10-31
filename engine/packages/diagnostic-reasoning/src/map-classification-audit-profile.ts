import type {
  AnalysisKnowledgeDomain,
} from "../../analysis-planner/src/index.js";
import {
  isResolvedMapClassification,
  type GameDesignMapClassification,
  type GameDesignMapType,
  type GameDesignMechanicTag,
  type GameDesignPlayerMode,
} from "../../game-design-spec/src/index.js";

export interface MapClassificationAuditSignals {
  readonly hasMultiArena: boolean;
  readonly hasPersistence: boolean;
  readonly hasDeferredWork: boolean;
  readonly hasRepeatedRunSurface: boolean;
  readonly hasTransactionalGameplay: boolean;
  readonly hasSimulationDistanceDependency: boolean;
  readonly hasProgressionActorSurface: boolean;
  readonly hasPlayerFeedbackSurface: boolean;
}

export interface MapClassificationAuditProfile {
  readonly active: boolean;
  readonly requiredKnowledgeDomains:
    readonly AnalysisKnowledgeDomain[];
  readonly specificScenarioQuestions: readonly string[];
  readonly signals: MapClassificationAuditSignals;
}

const TYPE_DOMAINS: Readonly<
  Record<
    GameDesignMapType,
    readonly AnalysisKnowledgeDomain[]
  >
> = {
  BUILDING: [
    "state-flow",
    "inventory-state",
    "world-structure",
    "spatial-authority",
  ],
  COMBAT: [
    "state-flow",
    "combat-lifecycle",
    "inventory-state",
    "temporal-ownership",
  ],
  SURVIVAL: [
    "state-flow",
    "combat-lifecycle",
    "entity-behavior",
    "temporal-ownership",
  ],
  STRATEGY: [
    "state-flow",
    "economy-reward",
    "temporal-ownership",
  ],
  SEARCH_PUZZLE: [
    "state-flow",
    "world-structure",
    "spatial-authority",
  ],
  STORY_QUEST: ["state-flow"],
  CHALLENGE_COURSE: [
    "state-flow",
    "inventory-state",
    "persistence-recovery",
    "temporal-ownership",
  ],
  SKILL_COURSE: [
    "state-flow",
    "persistence-recovery",
    "platform-constraints",
  ],
};

const MECHANIC_DOMAINS: Readonly<
  Partial<
    Record<
      GameDesignMechanicTag,
      readonly AnalysisKnowledgeDomain[]
    >
  >
> = {
  BUILD: [
    "inventory-state",
    "world-structure",
    "spatial-authority",
  ],
  MEMORY: [
    "state-flow",
    "persistence-recovery",
  ],
  SEARCH: [
    "state-flow",
    "world-structure",
  ],
  PUZZLE: [
    "state-flow",
    "world-structure",
  ],
  PARKOUR: ["spatial-authority"],
  MELEE_COMBAT: ["combat-lifecycle"],
  RANGED_COMBAT: ["combat-lifecycle"],
  TEAM_COMBAT: [
    "combat-lifecycle",
    "multiplayer-interleaving",
  ],
  BASE_DEFENSE: [
    "combat-lifecycle",
    "state-flow",
  ],
  BASE_ATTACK: [
    "combat-lifecycle",
    "state-flow",
  ],
  CAPTURE_OBJECTIVE: [
    "combat-lifecycle",
    "state-flow",
  ],
  ESCORT: [
    "entity-behavior",
    "state-flow",
  ],
  EXTRACTION: [
    "state-flow",
    "spatial-authority",
  ],
  WAVE_DEFENSE: [
    "combat-lifecycle",
    "entity-behavior",
    "chunk-simulation",
    "state-flow",
  ],
  SURVIVAL_TIMER: [
    "state-flow",
    "temporal-ownership",
  ],
  ENTITY_AI: [
    "entity-behavior",
    "chunk-simulation",
  ],
  RESOURCE_ECONOMY: [
    "economy-reward",
    "inventory-state",
  ],
  SHOP: [
    "economy-reward",
    "inventory-state",
  ],
  LOADOUT: ["inventory-state"],
  CRAFTING: [
    "inventory-state",
    "economy-reward",
  ],
  COLLECTION: [
    "inventory-state",
    "state-flow",
  ],
  RESPAWN: [
    "combat-lifecycle",
    "persistence-recovery",
  ],
  REVIVE: [
    "combat-lifecycle",
    "persistence-recovery",
  ],
  ROUND_TIMER: [
    "state-flow",
    "temporal-ownership",
  ],
  MULTI_ARENA: [
    "arena-lifecycle",
    "multiplayer-interleaving",
  ],
  MULTI_STAGE: ["state-flow"],
  PROGRESSION: ["state-flow"],
  PERSISTENCE: ["persistence-recovery"],
  RECONNECT: ["persistence-recovery"],
  WORLD_RESET: [
    "arena-lifecycle",
    "world-structure",
  ],
};


/** Resolved map type / mechanic questions reuse the existing scenario and proof owners.
 * These questions do not create tests or prove failures without current-map evidence.
 */
const TYPE_SCENARIO_QUESTIONS: Readonly<Record<GameDesignMapType, readonly string[]>> = {
  BUILDING: [
    "BUILDING: Are plot boundaries and block place/break permissions correct for every authored phase?",
    "BUILDING: Do stateful blocks, liquids and reset restore the correct world and player inventories?",
  ],
  COMBAT: [
    "COMBAT: Do damage, team restrictions, equipment, death and respawn obey the intended owner?",
    "COMBAT: Are score, win/loss, simultaneous terminal and cleanup correctly arbitrated?",
  ],
  SURVIVAL: [
    "SURVIVAL: Do survival resources, hazards and entity threats follow the authored game rules?",
    "SURVIVAL: Can death, depletion, timer failure and restart recover without stale state?",
  ],
  STRATEGY: [
    "STRATEGY: Are resource generation, spending, upgrades and objectives consistently authoritative?",
    "STRATEGY: Do concurrent actions, partial transactions and delayed results preserve owner and score?",
  ],
  SEARCH_PUZZLE: [
    "SEARCH_PUZZLE: Are every necessary clue, puzzle action and objective transition reachable in order?",
    "SEARCH_PUZZLE: Do wrong choices, skipped stages, retries and checkpoint restore prevent false completion or softlock?",
  ],
  STORY_QUEST: [
    "STORY_QUEST: Are dialogue and quest triggers reachable in their authored sequence without early advancement?",
    "STORY_QUEST: If choices or branching paths exist, can each valid branch progress without dead ends or softlock?",
    "STORY_QUEST: When checkpoints or endings exist, do recovery and player-facing outcome preserve the authored story?",
  ],
  CHALLENGE_COURSE: [
    "CHALLENGE_COURSE: Are course stages and checkpoints reachable without unintended shortcuts or dead ends?",
    "CHALLENGE_COURSE: Do death, failed jumps, teleport and retry restore the intended checkpoint and completion state?",
  ],
  SKILL_COURSE: [
    "SKILL_COURSE: Do instructions, practice steps and feedback match the authored skill objective?",
    "SKILL_COURSE: Are evaluation triggers, retries and completion evidence consistent with required exercises?",
  ],
};

/** Source-bound player-mode and PvP QA prompts: non-proof scenario
 * navigation only; no new runner, registry or failure-domain owner. */
const PLAYER_MODE_SCENARIO_QUESTIONS: Readonly<Record<GameDesignPlayerMode, readonly string[]>> = {
  SOLO: ["SOLO: Does a one-player journey start, progress and terminate without relying on absent teammates?"],
  COOPERATIVE: ["COOPERATIVE: Are party membership, quorum, collective objectives and individual reward ownership correct after join, leave or disconnect?"],
  COMPETITIVE: ["COMPETITIVE: Are opponent eligibility, score and simultaneous terminal rules separated for each player?"],
  TEAM_COMPETITIVE: ["TEAM_COMPETITIVE: Are team roles, membership, friendly-fire policy, shared objective and scoring scoped to the correct team?"],
  ASYMMETRIC: ["ASYMMETRIC: Do authored initial roles, conversions, role-specific permissions and victory conditions remain correct through recovery?"],
};

const PVP_COMBAT_SCENARIO_QUESTIONS: readonly string[] = [
  "P01: Each player is in exactly one authorized active match; duplicate or late joining follows the selected map's rule.",
  "P02: A match starts only after its authored participant/ready conditions; pre-start actors cannot progress it.",
  "P03: The declared minimum, maximum and max+1 are accepted, rejected or queued consistently without partial admission.",
  "P04: Spawn and teleport destinations are reachable, valid and contained; protected or spectator roles cannot escape through movement privileges.",
  "P05: Unready, eliminated, post-terminal, outsider or protected actors cannot damage, score or mutate the match illegally.",
  "P06: Melee, projectile, environmental damage and health changes affect only legal targets according to the authored rules.",
  "P07: Each death commits once; kill, environmental death, assist and final-elimination credit go to the correct participant without duplication.",
  "P08: Individual, team and objective scores are scoped and updated exactly once, never by another arena or side.",
  "P09: All authored victory, defeat, tie, forfeiture and no-result paths reach exactly one coherent result.",
  "P10: Simultaneous final kills, death, timeout, score threshold or overtime cannot produce competing winners or double rewards.",
  "P11: Confirmed quit/surrender is not inferred from disconnect, death, timer expiry or forced removal.",
  "P12: Offline roster membership and active-session progression follow the defined missing-player and quorum rules.",
  "P13: If reconnect exists, restore the correct team, life, kit, arena and match; otherwise reject/forfeit re-entry consistently.",
  "P14: Current HUD, timer, player/team labels and winner announcements reflect committed state for the correct audience.",
  "P15: After the terminal result, old damage, timers, rewards, subscriptions or projectiles cannot mutate the finished outcome.",
  "P16: Owned player state, inventory, entities, timers and world changes are cleaned or intentionally persisted at exit/abort.",
  "P17: Replay starts from the authored baseline, not stale Run 1 state, roster or delayed callbacks.",
];
/**
 * Each canonical design mechanic has one source-scoped audit question family.
 * This is a map-type coverage projection, not a detector, test runner or
 * proof of a defect. Adding a mechanic tag requires an explicit question.
 */
const MECHANIC_SCENARIO_QUESTIONS: Readonly<Record<GameDesignMechanicTag, readonly string[]>> = {
  BUILD: ["BUILD: Are denied placement, stateful blocks and liquids rejected at every plot edge?"],
  MEMORY: ["MEMORY: Can required memory sequences be presented, attempted, failed, retried and completed without stale progress?"],
  SEARCH: ["SEARCH: Are required search targets discoverable and reachable, and do missing or repeated interactions preserve completion rules?"],
  PUZZLE: ["PUZZLE: Do correct and incorrect puzzle actions respect authored guards, retries and completion without skip or softlock?"],
  PARKOUR: ["PARKOUR: Do jumps, hazards, checkpoints and retry/teleport paths prevent unintended shortcuts or lost progress?"],
  MELEE_COMBAT: ["MELEE_COMBAT: Are melee hit eligibility, damage, attacker/target ownership and death credit consistent with authored rules?"],
  RANGED_COMBAT: ["RANGED_COMBAT: Are projectile hit, target scope, team restrictions and kill credit consistent with authored rules?"],
  TEAM_COMBAT: ["TEAM_COMBAT: Do friendly fire and cross-team score follow authored team ownership?"],
  BASE_DEFENSE: ["BASE_DEFENSE: Does objective health change only from authored attacks?"],
  BASE_ATTACK: ["BASE_ATTACK: Can only valid attacks change the opposing base's health and trigger a single authorized outcome?"],
  CAPTURE_OBJECTIVE: ["CAPTURE_OBJECTIVE: Can multiple actors capture or score an objective only once?"],
  ESCORT: ["ESCORT: Can the escorted actor follow required routes and remain simulated, and do loss/recovery rules permit completion?"],
  EXTRACTION: ["EXTRACTION: Are collection, entry and extraction gates ordered correctly, with no early or duplicate completion?"],
  WAVE_DEFENSE: ["WAVE_DEFENSE: Are spawn, death/removal, wave progression and cleanup reconciled?"],
  SURVIVAL_TIMER: ["SURVIVAL_TIMER: Can start, pause, expiry and cancellation follow the authored survival condition without stale timeout commits?"],
  ENTITY_AI: ["ENTITY_AI: Do critical actors have navigable targets and simulation residency?"],
  RESOURCE_ECONOMY: ["RESOURCE_ECONOMY: Are earn, debit, rollback and retry atomic per owner?"],
  SHOP: ["SHOP: Does purchase failure or retry avoid duplicate grants and partial debit?"],
  LOADOUT: ["LOADOUT: Are class, kit, death and respawn inventories scoped correctly?"],
  CRAFTING: ["CRAFTING: Are permitted recipes and consumed inventory consistent with restrictions?"],
  COLLECTION: ["COLLECTION: Are required items counted per correct owner, without duplicate credit or premature completion?"],
  RESPAWN: ["RESPAWN: Does respawn restore the correct location, role and life-state?"],
  REVIVE: ["REVIVE: Are multi-reviver and stale terminal-after-revive conflicts rejected?"],
  ROUND_TIMER: ["ROUND_TIMER: Can timeout race with victory without duplicate commit?"],
  MULTI_ARENA: ["MULTI_ARENA: Are shared selectors, scoreboards and world changes isolated per arena?"],
  MULTI_STAGE: ["MULTI_STAGE: Does stage advancement require the correct authored guards?"],
  PROGRESSION: ["PROGRESSION: Are first/last counters, reward and terminal transitions reconciled?"],
  PERSISTENCE: ["PERSISTENCE: Are saved state, reload and intentional reset distinguished?"],
  RECONNECT: ["RECONNECT: Is offline membership and restored ownership correct on rejoin?"],
  WORLD_RESET: ["WORLD_RESET: Does replay restore all changed regions and cancel stale work?"],
};
const EMPTY_SIGNALS: MapClassificationAuditSignals = {
  hasMultiArena: false,
  hasPersistence: false,
  hasDeferredWork: false,
  hasRepeatedRunSurface: false,
  hasTransactionalGameplay: false,
  hasSimulationDistanceDependency: false,
  hasProgressionActorSurface: false,
  hasPlayerFeedbackSurface: false,
};

export function deriveMapClassificationAuditProfile(
  classification:
    | GameDesignMapClassification
    | undefined,
): MapClassificationAuditProfile {
  if (
    classification === undefined ||
    !isResolvedMapClassification(
      classification,
    )
  ) {
    return {
      active: false,
      requiredKnowledgeDomains: [],
      specificScenarioQuestions: [],
      signals: EMPTY_SIGNALS,
    };
  }

  const domains =
    new Set<AnalysisKnowledgeDomain>(
      TYPE_DOMAINS[
        classification.mapType!
      ],
    );

  if (
    classification.playerMode !== "SOLO"
  ) {
    domains.add(
      "multiplayer-interleaving",
    );
  }

  for (
    const mechanic of
      classification.mechanicTags
  ) {
    for (
      const domain of
        MECHANIC_DOMAINS[mechanic] ?? []
    ) {
      domains.add(domain);
    }
  }

  const isCompetitiveCombat =
    classification.mapType === "COMBAT" &&
    (classification.playerMode === "COMPETITIVE" ||
     classification.playerMode === "TEAM_COMPETITIVE" ||
     classification.playerMode === "ASYMMETRIC");

  const mechanicTags =
    new Set(
      classification.mechanicTags,
    );

  return {
    active: true,
    requiredKnowledgeDomains:
      [...domains].sort(),
    specificScenarioQuestions: [...new Set([
      ...TYPE_SCENARIO_QUESTIONS[classification.mapType!],
      ...PLAYER_MODE_SCENARIO_QUESTIONS[classification.playerMode!],
      ...(isCompetitiveCombat ? PVP_COMBAT_SCENARIO_QUESTIONS : []),
      ...classification.mechanicTags.flatMap((tag) =>
        MECHANIC_SCENARIO_QUESTIONS[tag]
      ),
    ])],
    signals: {
      hasMultiArena:
        mechanicTags.has("MULTI_ARENA"),
      hasPersistence:
        mechanicTags.has("PERSISTENCE") ||
        mechanicTags.has("RECONNECT"),
      hasDeferredWork:
        mechanicTags.has("ROUND_TIMER") ||
        mechanicTags.has("SURVIVAL_TIMER"),
      hasRepeatedRunSurface:
        mechanicTags.has("WORLD_RESET"),
      hasTransactionalGameplay:
        mechanicTags.has("SHOP") ||
        mechanicTags.has("RESOURCE_ECONOMY") ||
        mechanicTags.has("CRAFTING"),
      hasSimulationDistanceDependency:
        mechanicTags.has("ENTITY_AI") ||
        mechanicTags.has("WAVE_DEFENSE"),
      hasProgressionActorSurface:
        mechanicTags.has("WAVE_DEFENSE"),
      hasPlayerFeedbackSurface:
        mechanicTags.has("SHOP") ||
        mechanicTags.has("ROUND_TIMER") ||
        mechanicTags.has("PROGRESSION") ||
        mechanicTags.has("CAPTURE_OBJECTIVE"),
    },
  };
}
