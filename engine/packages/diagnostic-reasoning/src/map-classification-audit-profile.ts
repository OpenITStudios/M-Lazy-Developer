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
/**
 * Type-specific QA navigation: eight bounded coverage questions per resolved
 * map type. Codes match the human QA matrix in bug-finding-coverage.md.
 * These are NOT standalone tests, PASS assertions, or proof-gate owners.
 */
const TYPE_SCENARIO_QUESTIONS: Readonly<Record<GameDesignMapType, readonly string[]>> = {
BUILDING: [
  "BLD01: Can only authorized players place or break blocks inside their assigned plot and active phase?",
  "BLD02: Are forbidden block, item-use, crafting and drop actions rejected at all relevant permission boundaries?",
  "BLD03: Do material grants, placements, removals, returns and remaining inventory reconcile per owner?",
  "BLD04: Do facing, waterlogging, block state and canceled liquid actions match intended authoritative world changes?",
  "BLD05: Is build comparison limited to correct positions, block variants and authored scoring criteria?",
  "BLD06: Do build, lock, judging and end phases change exactly once at their authored boundaries?",
  "BLD07: Are player, NPC, hazard and script block mutations distinguished and kept in their authorized regions?",
  "BLD08: Are plot blocks, world state, player inventory and deferred edits restored or intentionally persisted before the next round?",
  ],
COMBAT: [
  "CBT01: Do attacks and damage affect only phase-eligible actors and targets under selected map rules?",
  "CBT02: Are hit, actual damage, death and combat credit treated as distinct events and attributed once?",
  "CBT03: Do kit choice, upgrades, item use and death/round equipment changes follow the authored lifecycle?",
  "CBT04: Are spawned, pending, dead, removed and despawned enemies reconciled before a wave/round transition?",
  "CBT05: Can required actors reach targets and remain simulated whenever combat/progression depends on them?",
  "CBT06: Does objective health, capture or score change only from legal attacks, and terminate only on supported conditions?",
  "CBT07: Do downed, revive, death, respawn and forfeiture rules settle without double result or stale player ownership?",
  "CBT08: Does combat termination cancel old attacks/projectiles/timers and restore all required team, entity, score and world state?",
  ],
SURVIVAL: [
  "SUR01: Are entry, permitted actions and survival objectives defined and reachable according to the selected game contract?",
  "SUR02: Are environmental damage causes and protection applied to eligible players without inventing damage from harmless contacts?",
  "SUR03: Do food, supplies, crafting and resource consumption affect the correct player and result, without duplication?",
  "SUR04: Do healing, buffs, effects and recovery-area thresholds apply only when actually completed and to the intended actor?",
  "SUR05: Do required actor spawns, targets, despawns and chunk readiness preserve threat and progression?",
  "SUR06: Are survivor/hunter/party roles and role-dependent objectives correctly isolated and updated after conversion or leave?",
  "SUR07: Do timeout, last-player death, objective success and ties settle the authored outcome exactly once?",
  "SUR08: Does restart or reconnect restore only authorized survival resources, status and progress?",
  ],
STRATEGY: [
  "STG01: Are resource generation and balance changes scoped to the rightful player/team/arena?",
  "STG02: Is cost validation followed by atomic debit and delivery, with rollback or reconciliation on failure/retry?",
  "STG03: Do upgrade ownership, stacking, restrictions and persistence follow the authored progression contract?",
  "STG04: Can only legal actors alter objective health/capture, and does destruction update the right objective?",
  "STG05: Are roles/side membership, allied resources and objective attribution consistent before/after a switch?",
  "STG06: Do units spawn, navigate, attack and remain active in required chunks without violating team/arena ownership?",
  "STG07: Do competing win conditions, limit thresholds, timeout and simultaneous objective events resolve exactly once?",
  "STG08: Are temporary strategies, entities, economy, timers and structure mutations reset or persisted only by approved design?",
  ],
SEARCH_PUZZLE: [
  "PUZ01: Can every required clue, block, dialogue and mechanism be accessed from the legal player route?",
  "PUZ02: Do valid ordered actions advance, while invalid or reversed orders cannot bypass guards?",
  "PUZ03: Do repeated clicks, wrong answers and undo operations avoid double credit and impossible intermediate state?",
  "PUZ04: Does a puzzle consume, retain or return its items only when the required action truly completes?",
  "PUZ05: Are hints, player choices and authorized skips distinguished from automatically completed puzzles?",
  "PUZ06: Are player/party attempts and puzzle phase/region state owned correctly under concurrent actions?",
  "PUZ07: Do attempts, wrong/correct totals and player-facing progress reflect the correct stage, player and committed state?",
  "PUZ08: Do every legitimate branch, fail and checkpoint reset permit eventual completion without a softlock?",
  ],
STORY_QUEST: [
  "QST01: Can the intended quest begin from available triggers, with exact actors/locations and valid prerequisites?",
  "QST02: Does authored dialogue/selection route to the correct quest state and player with no stale callback?",
  "QST03: Do prerequisite guards block early progression while every legal branch reaches a valid ending?",
  "QST04: Do collected objects and action completion credit only the right player/party and current stage?",
  "QST05: Are stage and scene transitions atomic, preserving authored inventory/world changes without stale stages?",
  "QST06: Are optional assistance, player-selected skips and administrative bypasses distinguished in results?",
  "QST07: Do interrupted quests resume or intentionally reset from the correct checkpoint under saved-state rules?",
  "QST08: Does the correct ending settle once, deliver accurate feedback/reward and restore replayable world state?",
  ],
CHALLENGE_COURSE: [
  "CRS01: Is there a physically traversable start-to-finish player route respecting intended collision, bounds and barriers?",
  "CRS02: Do checkpoints activate once in correct order, storing the intended next spawn/retry position?",
  "CRS03: Are fall resets, damaging landings and death treated differently under the authored thresholds?",
  "CRS04: Do hazard activation, hits, block changes and immunity windows follow the current phase and player?",
  "CRS05: Do start, pause, fail, skip and finish boundaries yield accurate per-attempt durations and outcomes?",
  "CRS06: Are optional help, confirmed skip and legitimate retry counted distinctly, never as unassisted completion?",
  "CRS07: Do course restrictions and physical containment prevent bypass or illegal terrain edits while preserving authorized tools?",
  "CRS08: Does finish commit exactly once and replay reset current attempts without corrupting legitimate best/previous records?",
  ],
SKILL_COURSE: [
  "SKL01: Are the stated steps, available tools and success criteria explicit and actually achievable?",
  "SKL02: Are a learner's attempts started, completed or abandoned only by their defined game triggers?",
  "SKL03: Does evaluation use the action/input actually submitted by the learner and the intended task state?",
  "SKL04: Are scoring decisions, limits, correct/incorrect and repeated answers tied to explicit authored rules?",
  "SKL05: Does feedback reflect the real evaluated outcome, and are revisions/attempts distinguished from final answers?",
  "SKL06: Are learner, observer, teacher/admin roles and shared tasks isolated, without privileged bypass of learner results?",
  "SKL07: Do retries and checkpoints maintain permitted learner progress, respecting authored saved-state and reset rules?",
  "SKL08: Are achievements/report limited to actually observed criteria and is analytics aggregation bounded without uncontrolled per-tick history?",
  ],
};
/** Source-bound player-mode and PvP QA prompts: non-proof scenario
 * navigation only; no new runner, registry or failure-domain owner. */
const PLAYER_MODE_SCENARIO_QUESTIONS: Readonly<Record<GameDesignPlayerMode, readonly string[]>> = {
  SOLO: [
    "SOLO: Can one authorized player start, fail, finish and replay without hidden dependency on other players?",
    "SOLO: Are solo retry, owned inventory and exit state unaffected by stale party/team resources?",
  ],
  COOPERATIVE: [
    "COOPERATIVE: Does party join/leave/reconnect retain the authored quorum and distinct per-player vs collective progress?",
    "COOPERATIVE: Can a single disconnected, dead or departing member change group completion only through an explicit legal policy?",
  ],
  COMPETITIVE: [
    "COMPETITIVE: Are each opponent's eligibility, score and elimination isolated, with only one legal result at simultaneous termination?",
    "COMPETITIVE: Do late join, quit, disconnect and repeat matches preserve rival ownership and authorized access?",
  ],
  TEAM_COMPETITIVE: [
    "TEAM_COMPETITIVE: Are team roles, shared resources, friendly-fire policy and objective/score attribution owned by the correct team?",
    "TEAM_COMPETITIVE: Do side switching, spectator privileges and absent members preserve opposing-team isolation and one legal victory?",
  ],
  ASYMMETRIC: [
    "ASYMMETRIC: Are initial role assignment, conversion, role-specific permissions and objectives consistent with authored behavior?",
    "ASYMMETRIC: Do role changes and reconnect correctly restore identity, inventory, score and asymmetric victory eligibility?",
  ],
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

  const mechanicTags = new Set(classification.mechanicTags);
  const competitiveMode =
    classification.playerMode === "COMPETITIVE" ||
    classification.playerMode === "TEAM_COMPETITIVE" ||
    classification.playerMode === "ASYMMETRIC";
  // Type COMBAT or a positively declared combat/capture mechanic can raise
  // PvP QA questions even when the dominant type is STRATEGY or SURVIVAL.
  // Selection is advisory: actual opponent-vs-opponent behavior and expected
  // outcomes must still be established from current selected-artifact proof.
  const competitiveCombatSurface =
    classification.mapType === "COMBAT" ||
    mechanicTags.has("MELEE_COMBAT") ||
    mechanicTags.has("RANGED_COMBAT") ||
    mechanicTags.has("TEAM_COMBAT") ||
    mechanicTags.has("BASE_ATTACK") ||
    mechanicTags.has("BASE_DEFENSE") ||
    mechanicTags.has("CAPTURE_OBJECTIVE");
  const isCompetitiveCombat = competitiveMode && competitiveCombatSurface;

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
