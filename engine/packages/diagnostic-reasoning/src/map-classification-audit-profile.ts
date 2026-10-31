import type {
  AnalysisKnowledgeDomain,
} from "../../analysis-planner/src/index.js";
import {
  isResolvedMapClassification,
  type GameDesignMapClassification,
  type GameDesignMapType,
  type GameDesignMechanicTag,
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

const MECHANIC_SCENARIO_QUESTIONS: Readonly<Partial<Record<GameDesignMechanicTag, readonly string[]>>> = {
  BUILD: ["BUILD: Are denied placement, stateful blocks and liquids rejected at every plot edge?"],
  TEAM_COMBAT: ["TEAM_COMBAT: Do friendly fire and cross-team score follow authored team ownership?"],
  BASE_DEFENSE: ["BASE_DEFENSE: Does objective health change only from authored attacks?"],
  CAPTURE_OBJECTIVE: ["CAPTURE_OBJECTIVE: Can multiple actors capture or score an objective only once?"],
  WAVE_DEFENSE: ["WAVE_DEFENSE: Are spawn, death/removal, wave progression and cleanup reconciled?"],
  ENTITY_AI: ["ENTITY_AI: Do critical actors have navigable targets and simulation residency?"],
  RESOURCE_ECONOMY: ["RESOURCE_ECONOMY: Are earn, debit, rollback and retry atomic per owner?"],
  SHOP: ["SHOP: Does purchase failure or retry avoid duplicate grants and partial debit?"],
  CRAFTING: ["CRAFTING: Are permitted recipes and consumed inventory consistent with restrictions?"],
  LOADOUT: ["LOADOUT: Are class, kit, death and respawn inventories scoped correctly?"],
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
      ...classification.mechanicTags.flatMap((tag) =>
        MECHANIC_SCENARIO_QUESTIONS[tag] ?? []
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
