import type {
  AnalysisKnowledgeDomain,
} from "../../analysis-planner/src/index.js";
import type {
  GameDesignMapClassification,
} from "../../game-design-spec/src/index.js";
import {
  deriveMapClassificationAuditProfile,
} from "./map-classification-audit-profile.js";
import type {
  GameplayIssueFailureDomain,
} from "./gameplay-issue-taxonomy.js";
export type GameplayAuditScenarioKind =
  | "map-type-coverage"
  | "full-journey"
  | "solo"
  | "two-player"
  | "max-party"
  | "party-capacity-plus-one"
  | "multi-arena-parallel"
  | "arena-replica-integrity"
  | "arena-capacity-plus-one"
  | "disconnect-reconnect"
  | "reload-recovery"
  | "deferred-ownership"
  | "terminal-collision"
  | "transaction-atomicity"
  | "simulation-distance"
  | "progression-wave-integrity"
  | "information-correctness"
  | "player-capability-integrity"
  | "world-rule-authority"
  | "client-server-reconciliation"
  | "spatial-containment"
  | "repeated-run";

export type GameplayAuditScenarioProofMode =
  | "static-first"
  | "runtime-only-if-irreducible";

export type GameplayFlowStage =
  | "FULL_JOURNEY"
  | "ENTRY_JOIN"
  | "READY_START"
  | "SETUP"
  | "ACTIVE_GAMEPLAY"
  | "PROGRESSION"
  | "TERMINAL"
  | "CLEANUP_REPLAY"
  | "RECOVERY";

/** A source-grounded question contract, not a PASS/FAIL, finding or test receipt. */
export interface GameplayAuditDetectionIndicator {
  /** Candidate classification routing only; PROVE owns the actual issue domain. */
  readonly candidateFailureDomains: readonly GameplayIssueFailureDomain[];
  readonly contractToEstablish: string;
  readonly failureSignalToChallenge: string;
  readonly minimumEvidence: string;
  readonly counterProofToSeek: string;
}

export interface GameplayAuditScenario {
  readonly id: string;
  readonly kind: GameplayAuditScenarioKind;
  readonly playerCount?: number;
  readonly concurrentArenas?: number;
  readonly flowStage: GameplayFlowStage;
  readonly proofMode: GameplayAuditScenarioProofMode;
  readonly reason: string;
  readonly questions: readonly string[];
  /** Non-binding detection guidance; not evidence that a map feature exists or a bug occurred. */
  readonly detectionIndicator?: GameplayAuditDetectionIndicator;
  readonly requiredKnowledgeDomains?:
    readonly AnalysisKnowledgeDomain[];
}

export interface GameplayAuditScenarioPresetInput {
  readonly classification?:
    GameDesignMapClassification;
  readonly maxPartySize?: number;
  readonly arenaCount?: number;
  readonly concurrentArenaLimit?: number | null;
  readonly hasMultiArena?: boolean;
  readonly hasPersistence?: boolean;
  readonly hasDeferredWork?: boolean;
  readonly hasRepeatedRunSurface?: boolean;
  readonly hasTransactionalGameplay?: boolean;
  readonly hasSimulationDistanceDependency?: boolean;
  readonly hasProgressionActorSurface?: boolean;
  readonly hasPlayerFeedbackSurface?: boolean;
  readonly hasPrivilegedCapabilitySurface?: boolean;
  readonly hasWorldRuleSurface?: boolean;
  readonly hasCancelledWorldMutationSurface?: boolean;
  readonly hasSpatialContainmentSurface?: boolean;
}

export interface GameplayAuditScenarioPreset {
  readonly schemaVersion: 1;
  readonly policy: "selected-map-scenario-audit";
  readonly scenarios: readonly GameplayAuditScenario[];
}

/**
 * Indicators are co-located with the existing selected-map scenario router.
 * They do not define a second taxonomy, test lane, checker, or proof owner.
 * The scenario's selected-artifact trigger remains authoritative for routing;
 * candidateFailureDomains are investigation hints only.
 */
type ConcreteScenarioKind = Exclude<GameplayAuditScenarioKind,
  "full-journey" | "map-type-coverage">;

const DETECTION_INDICATORS: Readonly<Record<ConcreteScenarioKind,
  GameplayAuditDetectionIndicator>> = {
  "solo": {
    "candidateFailureDomains": [
      "player-lifecycle",
      "state-ownership"
    ],
    "contractToEstablish": "An authored solo join/ready/start/exit path admits one eligible player and settles the correct session state.",
    "failureSignalToChallenge": "Join pad remains occupied, ready never resolves, duplicate membership starts two sessions, or exit/replay retains stale owner.",
    "minimumEvidence": "Selected-artifact join-pad/ready/start and leave handlers, roster writes, spawn/teleport route and session ownership; compare initial and repeated path.",
    "counterProofToSeek": "A reachable exact guard, cleanup and authorized solo design that preserves the expected player/session state."
  },
  "two-player": {
    "candidateFailureDomains": [
      "player-lifecycle",
      "arena-multi-arena",
      "state-ownership"
    ],
    "contractToEstablish": "Where cooperative or shared-player play is authored, joining/leaving players retain independently scoped membership and authorized start/terminal rules.",
    "failureSignalToChallenge": "A second player inherits another's arena/role or a leaving/offline player blocks or prematurely ends an active session.",
    "minimumEvidence": "Two relevant player identities, selected-artifact roster/ready/leave selectors and writers, ownership boundaries and the actual required quorum.",
    "counterProofToSeek": "Source-supported scoped selectors, exactly-once admission and authored roster/quorum rules that reject the suspected cross-player path."
  },
  "max-party": {
    "candidateFailureDomains": [
      "boundary-capacity",
      "player-lifecycle"
    ],
    "contractToEstablish": "A selected-source supported maximum party can enter, receive roles and progress without losing membership or overwriting player state.",
    "failureSignalToChallenge": "The declared maximum exceeds the actually supported player count or an admitted player corrupts an existing player record.",
    "minimumEvidence": "Grounded declared limit, admission owner, shared resource budget and per-player state/role writers at that limit.",
    "counterProofToSeek": "Exact admission and resource constraints proving the whole stated party can run, or independent design authority defining a smaller advertised capability."
  },
  "party-capacity-plus-one": {
    "candidateFailureDomains": [
      "boundary-capacity",
      "player-lifecycle"
    ],
    "contractToEstablish": "At the authored party limit plus one, excess entry is rejected or queued only according to the selected map's player-facing design.",
    "failureSignalToChallenge": "Extra player bypasses the cap, starts a partially owned session, or receives a misleading/absent rejection.",
    "minimumEvidence": "Selected-artifact cap and owner, cap+1 admission condition, roster and queue mutation, plus player-facing feedback route.",
    "counterProofToSeek": "A reached cap guard with scoped queue/rejection, consistent committed roster and justified visible limitation."
  },
  "multi-arena-parallel": {
    "candidateFailureDomains": [
      "arena-multi-arena",
      "state-ownership"
    ],
    "contractToEstablish": "Each authored parallel arena owns its players, scores, resources, entity/world mutations and cleanup generation.",
    "failureSignalToChallenge": "Arena A changes Arena B's roster, scoreboard, gamerules, inventory, entities, messages or cleanup.",
    "minimumEvidence": "Two selected-source arena identities, actor selectors, shared resource keys, mutation writer paths, ownership and cleanup/release.",
    "counterProofToSeek": "Active arena-scoped selectors and leases, exact resource isolation and generation-aware cleanup that block the suspected cross-arena path."
  },
  "arena-replica-integrity": {
    "candidateFailureDomains": [
      "arena-multi-arena",
      "world-structure-mutation"
    ],
    "contractToEstablish": "Every advertised playable arena replica has the material topology, spawn, structures and objective routes required by the selected game.",
    "failureSignalToChallenge": "A replica admits play with missing blocks, paths, structures, actor positions or required objectives despite a safe baseline elsewhere.",
    "minimumEvidence": "Independent source/voxel/layout identity and completion comparison for each replica, including unresolved chunks and material divergences.",
    "counterProofToSeek": "Complete exact per-replica comparisons and separate evidence that differences are intentionally cosmetic or inaccessible."
  },
  "arena-capacity-plus-one": {
    "candidateFailureDomains": [
      "arena-multi-arena",
      "boundary-capacity"
    ],
    "contractToEstablish": "The concurrently playable arena count matches the independently presented capability, with an explicit admission response beyond the supported budget.",
    "failureSignalToChallenge": "Visible arena capacity exceeds proven concurrency or a limit+1 start steals another arena's resources.",
    "minimumEvidence": "Presented arena count, actual per-arena resource costs, safe shared budget, admission predicates and queue/fallback source.",
    "counterProofToSeek": "Independent authored design establishes the smaller playable capability, or source-backed capacity/lease proof supports all advertised arenas."
  },
  "disconnect-reconnect": {
    "candidateFailureDomains": [
      "player-lifecycle",
      "persistence-recovery",
      "state-ownership"
    ],
    "contractToEstablish": "An authored disconnect/rejoin lifecycle reconciles roster, inventory, life/phase and active arena ownership as designed.",
    "failureSignalToChallenge": "Stale offline membership is counted, restored items overwrite a fresh session, or pending death/respawn ownership is bypassed.",
    "minimumEvidence": "Selected player identity, leave/reconnect writer matrix, persisted and transient state boundaries and generation/phase guards.",
    "counterProofToSeek": "A same-generation reconciliation path with explicit stale-state invalidation and correct rejoin/restart conditions."
  },
  "reload-recovery": {
    "candidateFailureDomains": [
      "persistence-recovery",
      "state-ownership"
    ],
    "contractToEstablish": "After reload, each authored persisted field is either reconstructed with required transient dependencies or intentionally reset.",
    "failureSignalToChallenge": "Reload creates duplicate reward/progression, loses required stage, reuses old callback state or exposes an unready session.",
    "minimumEvidence": "Exact persistent keys, startup/load handlers, transient timers/actors/state dependencies and idempotent recovery order.",
    "counterProofToSeek": "Reachable current-version initialization/reconciliation that restores or intentionally clears every required dependent state."
  },
  "deferred-ownership": {
    "candidateFailureDomains": [
      "temporal-async",
      "state-ownership"
    ],
    "contractToEstablish": "Delayed or async gameplay work may commit only while its original player, arena, phase and generation remain authoritative.",
    "failureSignalToChallenge": "A scheduled callback writes after leave, reset, replay, phase change or rejoin into a newer owner's state.",
    "minimumEvidence": "Exact scheduler registration, captured owner/generation, callback mutation, cancellation/revalidation and relevant event ordering.",
    "counterProofToSeek": "Reachable cancellation or same-generation check on every mutation path, including failure and interruption branches."
  },
  "terminal-collision": {
    "candidateFailureDomains": [
      "temporal-async",
      "state-ownership",
      "progression-wave-objective"
    ],
    "contractToEstablish": "Simultaneous eligible win/lose/timeout/death paths settle once with one result owner and no late commits.",
    "failureSignalToChallenge": "Two terminal events grant rewards twice, publish conflicting outcomes or allow old cleanup to affect the next round.",
    "minimumEvidence": "Authored terminal predicates and result writer, same-tick overlap, idempotency/generation policy and deferred side effects.",
    "counterProofToSeek": "An activated exclusive winner/commit guard and generation-aware cancellation that reject all competing terminal writes."
  },
  "transaction-atomicity": {
    "candidateFailureDomains": [
      "inventory-economy",
      "state-ownership"
    ],
    "contractToEstablish": "Payment, consumption, grant and feedback follow the map's authored all-or-reconciled transaction rule.",
    "failureSignalToChallenge": "Currency is removed without delivery or a retry/reconnect duplicates item, reward or debit.",
    "minimumEvidence": "Exact debit/grant/refund writers, same-player/session identity, error branches, idempotency guard and committed result.",
    "counterProofToSeek": "Reachable commit/rollback compensation or generation-keyed exactly-once delivery covering the suspected partial-failure path."
  },
  "simulation-distance": {
    "candidateFailureDomains": [
      "chunk-simulation",
      "entity-ai-combat"
    ],
    "contractToEstablish": "Gameplay-critical remote entities and objectives receive the chunk/simulation residency required for their authored progress.",
    "failureSignalToChallenge": "An actor or scheduled operation stays pending while its location is not simulated or loaded when progression needs it.",
    "minimumEvidence": "Exact objective/actor coordinates, simulation vs loading bounds, ticking-area lease creation/readiness and dependency timing.",
    "counterProofToSeek": "Geometric and lifecycle evidence that the required area is resident before use, or an authored alternative independent of remote simulation."
  },
  "progression-wave-integrity": {
    "candidateFailureDomains": [
      "progression-wave-objective",
      "entity-ai-combat",
      "chunk-simulation"
    ],
    "contractToEstablish": "The required work, pending attempts, active actors and completion counter reconcile before one authored progression transition.",
    "failureSignalToChallenge": "A removed/despawned/unloaded actor stalls completion, or pending spawn/retry permits premature zero and double advancement.",
    "minimumEvidence": "Selected-source completion gate, spawn/request/commit/death/remove paths, outstanding count, chunk/actor readiness and state writers.",
    "counterProofToSeek": "An authoritative accounting invariant that includes pending work and reconciles all exit paths before exactly-once progression."
  },
  "information-correctness": {
    "candidateFailureDomains": [
      "ui-feedback-information",
      "state-ownership"
    ],
    "contractToEstablish": "Player-facing timer, wave, score, queue, price, success or failure reflects the committed state of that player/session.",
    "failureSignalToChallenge": "A stale/cross-arena UI update announces success before the corresponding state commit or delivers mismatched values.",
    "minimumEvidence": "Exact source of displayed value, UI-send route, state commit and scoped receiver, with runtime observation when delivery cannot be inferred statically.",
    "counterProofToSeek": "Source-correlated, correctly scoped delivery after commit and a counterexample-free reconciliation path; a send attempt alone is not observed display."
  },
  "player-capability-integrity": {
    "candidateFailureDomains": [
      "state-ownership",
      "world-structure-mutation"
    ],
    "contractToEstablish": "The selected map's Player, Builder, Roommaster and Developer roles can perform only their independently authored actions.",
    "failureSignalToChallenge": "An operational or player permission bypasses plot boundaries, destructive controls or another session's authority.",
    "minimumEvidence": "Selected-source role/tag/gamemode changes, authorization guards, protection registration and mutation capability path.",
    "counterProofToSeek": "A reachable active role-specific authorization and physical/state boundary that blocks the exact unauthorized action."
  },
  "world-rule-authority": {
    "candidateFailureDomains": [
      "world-structure-mutation",
      "platform-performance"
    ],
    "contractToEstablish": "Every authored gamerule and world setting controls only its actual engine mechanism; privileged source mutations remain separately governed.",
    "failureSignalToChallenge": "A natural spawn rule is credited as blocking script summons, or a later world-rule writer silently changes gameplay.",
    "minimumEvidence": "World rule baseline and writers, natural/script/command spawn provenance, role and engine/edition profile.",
    "counterProofToSeek": "Exact mechanism-appropriate rule evaluation plus all applicable active script/permission guards; mere gamerule presence is insufficient."
  },
  "client-server-reconciliation": {
    "candidateFailureDomains": [
      "world-structure-mutation",
      "ui-feedback-information"
    ],
    "contractToEstablish": "Where the client predicts a block, liquid or interaction that the server cancels, both converge on authoritative state.",
    "failureSignalToChallenge": "The acting client sees a block/liquid/state that other clients or the server rejected or replaced.",
    "minimumEvidence": "Source-bound before-event cancellation/rewrites, affected block positions, server authoritative state and narrow client observation where required.",
    "counterProofToSeek": "Observed or mechanism-specific reconciliation proving clients converge; a server-side cancellation statement alone cannot prove client appearance."
  },
  "spatial-containment": {
    "candidateFailureDomains": [
      "world-structure-mutation",
      "boundary-capacity"
    ],
    "contractToEstablish": "The selected gameplay's actual physical collision envelope contains permitted player movement and access as authored.",
    "failureSignalToChallenge": "A player reaches another arena or restricted volume through an actual traversable route ignored by logical/loading bounds.",
    "minimumEvidence": "Full 3D player-sized route, material collision geometry, allowed movement abilities and distinct world/gameplay/loading/ownership bounds.",
    "counterProofToSeek": "Continuous collision barrier or activated access guard blocks every relevant route with a profile-appropriate movement capability."
  },
  "repeated-run": {
    "candidateFailureDomains": [
      "state-ownership",
      "temporal-async",
      "world-structure-mutation"
    ],
    "contractToEstablish": "After terminal or abort, old state/resources release and the second authorized run uses a fresh intended baseline.",
    "failureSignalToChallenge": "Run 1 leaves entities, blocks, items, timers, score or callbacks that corrupt Run 2 or enable premature readiness.",
    "minimumEvidence": "Selected-source acquire/release matrix, terminal and cleanup ownership, reset footprint, deferred work and second-generation initialization.",
    "counterProofToSeek": "Complete scoped cleanup/compensation and new-generation ownership that prevent any old mutation from affecting the next run."
  }
};

function scenario(
  input: Omit<GameplayAuditScenario, "proofMode">,
): GameplayAuditScenario {
  return {
    ...input,
    ...(input.kind !== "full-journey" &&
        input.kind !== "map-type-coverage"
      ? { detectionIndicator: DETECTION_INDICATORS[input.kind] }
      : {}),
    proofMode: "static-first",
  };
}

export function buildGameplayAuditScenarioPreset(
  input: GameplayAuditScenarioPresetInput,
): GameplayAuditScenarioPreset {
  const classificationProfile =
    deriveMapClassificationAuditProfile(
      input.classification,
    );
  const effective = {
    hasMultiArena:
      Boolean(input.hasMultiArena) ||
      classificationProfile.signals
        .hasMultiArena,
    hasPersistence:
      Boolean(input.hasPersistence) ||
      classificationProfile.signals
        .hasPersistence,
    hasDeferredWork:
      Boolean(input.hasDeferredWork) ||
      classificationProfile.signals
        .hasDeferredWork,
    hasRepeatedRunSurface:
      Boolean(
        input.hasRepeatedRunSurface,
      ) ||
      classificationProfile.signals
        .hasRepeatedRunSurface,
    hasTransactionalGameplay:
      Boolean(
        input.hasTransactionalGameplay,
      ) ||
      classificationProfile.signals
        .hasTransactionalGameplay,
    hasSimulationDistanceDependency:
      Boolean(
        input.hasSimulationDistanceDependency,
      ) ||
      classificationProfile.signals
        .hasSimulationDistanceDependency,
    hasProgressionActorSurface:
      Boolean(
        input.hasProgressionActorSurface,
      ) ||
      classificationProfile.signals
        .hasProgressionActorSurface,
    hasPlayerFeedbackSurface:
      Boolean(
        input.hasPlayerFeedbackSurface,
      ) ||
      classificationProfile.signals
        .hasPlayerFeedbackSurface,
  };

  const scenarios: GameplayAuditScenario[] = [
    scenario({
      id: "journey:full",
      kind: "full-journey",
      flowStage: "FULL_JOURNEY",
      reason:
        "Every audit must trace one complete player journey through cleanup and replay.",
      questions: [
        "Can every required gameplay stage be reached in order?",
        "Where lobby/join pads, team selection or ready gates exist, are admission, occupancy, start, exit and rejoin counted and owned correctly?",
        "Does each stage have a valid success, failure, and exit path?",
        "Does cleanup restore enough baseline state for another run?",
        "Are the spawn route, gameplay actions and access permissions reachable?",
        "Does player-facing feedback reflect the actual state and terminal result?",
      ],
    }),
    scenario({
      id: "players:solo",
      kind: "solo",
      flowStage: "ENTRY_JOIN",
      playerCount: 1,
      reason:
        "Solo play exposes hidden assumptions about party members, ownership, voting, wipe, rewards, and progression.",
      questions: [
        "Does any mechanic incorrectly assume another active player exists?",
        "Can one player start, fail, recover, finish, and replay normally?",
      ],
    }),
    scenario({
      id: "terminal:collision",
      kind: "terminal-collision",
      flowStage: "TERMINAL",
      reason:
        "Terminal events commonly race with timers, death, cleanup, rewards, or delayed work.",
      questions: [
        "Can two terminal conditions become true in the same tick/window?",
        "Which owner wins and are all other pending mutations invalidated?",
        "Can reward, respawn, timeout, or cleanup commit after terminal ownership changes?",
        "Can an ordinary player trigger more than one terminal path for the same session/arena generation, and are terminal scopes guarded by exactly-once ownership?",
      ],
    }),
  ];

  if (
    classificationProfile.active &&
    input.classification?.mapType
  ) {
    scenarios.push(
      scenario({
        id: "classification:map-type",
        kind: "map-type-coverage",
        flowStage: "FULL_JOURNEY",
        reason:
          "Resolved Map Type establishes minimum audit coverage without proving any defect by itself.",
        questions: [
          "Are all knowledge domains required by this Map Type represented in the Required Inspection Graph?",
          "Do declared Mechanics add the expected bounded audit scenarios without assuming their failure?",
          "Does selected-artifact evidence still decide whether each suspected issue is proven, unresolved, or safe?",
          ...classificationProfile.specificScenarioQuestions,
        ],
        requiredKnowledgeDomains:
          classificationProfile
            .requiredKnowledgeDomains,
      }),
    );
  }

  const maxParty =
    input.maxPartySize !== undefined &&
    input.maxPartySize > 0
      ? Math.floor(input.maxPartySize)
      : undefined;

  // Resolved SOLO with no multiplayer surface need not generate mixed-player
  // or offline-roster checks. Unknown mode/cap remains conservative; declared
  // multiplayer, multi-arena evidence, or a conflicting capacity restores them.
  const declaredMultiplayer =
    classificationProfile.active &&
    input.classification?.playerMode !== "SOLO";
  const needsMixedPlayerCoverage =
    (maxParty ?? 0) >= 2 ||
    effective.hasMultiArena ||
    (input.arenaCount ?? 0) > 1 ||
    declaredMultiplayer ||
    (maxParty === undefined && !classificationProfile.active);

  if (needsMixedPlayerCoverage) {
    scenarios.push(
      scenario({
        id: "players:two",
        kind: "two-player",
        flowStage: "ENTRY_JOIN",
        playerCount: 2,
        reason:
          "Two-player play is the minimum useful mixed-player scenario for leave/death/ownership interactions.",
        questions: [
          "What changes when one player dies, disconnects, leaves, or finishes before the other?",
          "Are shared and per-player states separated correctly?",
          "After one player leaves, can stale roster membership still be selected as builder/role/target or counted by readiness/progression/terminal predicates?",
          "Can a normal per-player exit/leave action terminate or reset the whole party/session without an authored quorum, leader, teacher, or admin rule?",
        ],
      }),
      scenario({
        id: "players:disconnect-reconnect",
        kind: "disconnect-reconnect",
        flowStage: "RECOVERY",
        playerCount: 2,
        reason:
          "Reconnect must preserve or intentionally reset ownership without creating stale active/offline composite states.",
        questions: [
          "What membership/state remains while one player is offline?",
          "Can offline membership block wipe, vote, reward, cleanup, progression, builder/role selection, or completion?",
          "Do all-player/cooperative predicates use the locked required roster, or silently shrink to currently online players?",
          "Can reconnect bypass pending death/respawn/phase ownership?",
        ],
      }),
    );
  }

  if (maxParty !== undefined) {
    scenarios.push(
      scenario({
        id: "players:max",
        kind: "max-party",
        flowStage: "ENTRY_JOIN",
        playerCount: maxParty,
        reason:
          "Maximum supported party size is a gameplay boundary and must preserve scaling, ownership, rewards, and progression.",
        questions: [
          "Do player-scoped and shared states remain isolated at maximum party size?",
          "Do enemy/reward/score/admission rules still match the gameplay contract?",
        ],
      }),
      scenario({
        id: "players:max-plus-one",
        kind: "party-capacity-plus-one",
        flowStage: "READY_START",
        playerCount: maxParty + 1,
        reason:
          "Capacity+1 proves admission behavior instead of assuming a hard limit is valid because enforcement exists.",
        questions: [
          "Is the extra player rejected/queued by grounded design rather than implementation self-justification?",
          "Is the limitation visible and understandable to the player?",
        ],
      }),
    );
  }

  const arenaCount =
    input.arenaCount !== undefined &&
    input.arenaCount > 0
      ? Math.floor(input.arenaCount)
      : undefined;
  const limit =
    input.concurrentArenaLimit !== undefined &&
    input.concurrentArenaLimit !== null &&
    input.concurrentArenaLimit > 0
      ? Math.floor(input.concurrentArenaLimit)
      : undefined;

  if (
    effective.hasMultiArena ||
    (arenaCount !== undefined && arenaCount > 1)
  ) {
    scenarios.push(
      scenario({
        id: "arena:parallel",
        kind: "multi-arena-parallel",
        flowStage: "READY_START",
        concurrentArenas:
          arenaCount === undefined
            ? 2
            : arenaCount,
        reason:
          "Parallel sessions expose global selectors, shared resources, stale cleanup, cross-arena ownership leaks, and capacity failures that may appear only near the selected map's maximum arena count.",
        questions: [
          "Can an event in Arena A mutate players, entities, blocks, score, audio, messages, objectives, or cleanup in Arena B?",
          "Can arena-local cleanup remove a world-global tag, objective marker, ticking-area name, timer, or other named resource still owned by Arena B?",
          "Can a per-arena periodic/deferred job reach world-global players/entities/blocks through @a, world player enumeration, global entity queries, or unscoped world mutation?",
          "Can sessions start and progress independently at 2 arenas and at the selected map's maximum arena count?",
          "If a safe concurrency limit is known, is behavior explicitly checked at limit and limit + 1 rather than assuming a two-arena pass generalizes?",
        ],
      }),
    );

    if (arenaCount !== undefined && arenaCount > 1) {
      scenarios.push(
        scenario({
          id: "arena:replica-integrity",
          kind: "arena-replica-integrity",
          flowStage: "SETUP",
          concurrentArenas: arenaCount,
          reason:
            "Physical arena replicas must not inherit baseline safety until topology/world proof shows each replica is complete or every material divergence is classified.",
          questions: [
            "Does every configured/playable arena have complete world/topology coverage relative to the canonical arena?",
            "Are missing chunks, structures, block entities, routes, objectives, or spawn regions classified instead of hidden by source/config equality?",
            "Can a replica that is incomplete or only partially copied still admit players and start gameplay?",
            "Are cosmetic deltas separated from gameplay-material replica divergence?",
          ],
        }),
      );
    }

    if (
      arenaCount !== undefined &&
      limit !== undefined &&
      limit < arenaCount
    ) {
      scenarios.push(
        scenario({
          id: "arena:capacity-plus-one",
          kind: "arena-capacity-plus-one",
          flowStage: "READY_START",
          concurrentArenas: limit + 1,
          reason:
            "Visible arena capability exceeds playable concurrency. This is a gameplay/design capacity degradation even when queue/fallback behavior or platform limits explain why the implementation cannot run every visible arena at once.",
          questions: [
            "How many arenas are presented as available gameplay capacity versus how many can actually run concurrently?",
            "What technical constraint causes the reduction?",
            "How does queue/fallback mitigate the impact without erasing the capacity mismatch?",
          ],
        }),
      );
    }
  }

  if (effective.hasTransactionalGameplay) {
    scenarios.push(
      scenario({
        id: "transaction:atomicity",
        kind: "transaction-atomicity",
        flowStage: "PROGRESSION",
        reason:
          "Gameplay transactions must preserve payment/delivery atomicity across failure, retry, reconnect, and reload.",
        questions: [
          "Can payment or state consumption commit before item, upgrade, reward, or effect delivery succeeds?",
          "If delivery fails, is payment rolled back or safely reconciled?",
          "Can retry or reconnect duplicate delivery or consume payment twice?",
          "Do success and failure messages match the committed transaction result?",
        ],
      }),
    );
  }

  if (effective.hasProgressionActorSurface) {
    scenarios.push(
      scenario({
        id: "progression:actor-accounting",
        kind: "progression-wave-integrity",
        flowStage: "PROGRESSION",
        reason:
          "Entity-backed progression can deadlock when spawn, death/removal, objective counters, and simulation ownership do not converge on one completion rule.",
        questions: [
          "What exact actor/counter/objective state gates progression to the next wave, level, or terminal result?",
          "Which spawn paths increase the required actor population and which death/remove/despawn paths reconcile it?",
          "Can an actor disappear, unload, despawn, or die without the completion counter/state being reconciled?",
          "Can required actors stop simulating while progression still waits for them?",
          "Is zero/complete evaluated from one authoritative state rather than a stale mirror or partial actor set?",
        ],
      }),
    );
  }

  if (effective.hasSimulationDistanceDependency) {
    scenarios.push(
      scenario({
        id: "simulation:distance",
        kind: "simulation-distance",
        flowStage: "ACTIVE_GAMEPLAY",
        reason:
          "Remote actors, objectives, or routes must remain simulated when progression depends on them and players are not nearby.",
        questions: [
          "Which required actors or objectives can be farther than normal player-loaded simulation coverage?",
          "What ticking or chunk residency keeps each required spawn, route, and objective active?",
          "Is residency actually materialized before gameplay depends on it?",
          "Can intended player positioning leave remote NPC spawning or pathing frozen?",
        ],
      }),
    );
  }

  if (effective.hasPlayerFeedbackSurface) {
    scenarios.push(
      scenario({
        id: "feedback:correctness",
        kind: "information-correctness",
        flowStage: "PROGRESSION",
        reason:
          "Player-facing feedback must describe the committed gameplay state, not a requested, stale, failed, or cross-session state.",
        questions: [
          "Can success text be emitted before the underlying transaction or transition succeeds?",
          "Can failure and success messages both appear for one action?",
          "Can timer, score, wave, objective, queue, price, tier, or arena status become stale relative to canonical state?",
          "Can one arena or player receive feedback owned by another session?",
        ],
      }),
    );
  }

  if (effective.hasPersistence) {
    scenarios.push(
      scenario({
        id: "recovery:reload",
        kind: "reload-recovery",
        flowStage: "RECOVERY",
        reason:
          "Persisted sessions must reconstruct every material transient state needed to resume or intentionally restart gameplay.",
        questions: [
          "Which active state survives reload and which required timers/callbacks/actors do not?",
          "Can reload duplicate, skip, or reorder progression, death, objective, reward, or cleanup state?",
        ],
      }),
    );
  }

  if (effective.hasDeferredWork) {
    scenarios.push(
      scenario({
        id: "temporal:deferred-owner",
        kind: "deferred-ownership",
        flowStage: "RECOVERY",
        reason:
          "Deferred work can commit after its player/session/arena/phase owner has changed.",
        questions: [
          "What ownership revision existed when the callback was scheduled?",
          "Is ownership revalidated before mutation commits?",
          "Can cleanup, reuse, reconnect, reload, or phase transition happen first?",
        ],
      }),
    );
  }

  if (input.hasPrivilegedCapabilitySurface) {
    scenarios.push(
      scenario({
        id: "capability:privileged-role",
        kind: "player-capability-integrity",
        flowStage: "ACTIVE_GAMEPLAY",
        reason:
          "Privileged gameplay/operator roles must not silently inherit unrestricted world mutation or developer authority.",
        questions: [
          "What exact role, tag, gamemode, player permission and command permission authorize each privileged action?",
          "Does any admin/Roommaster/operator shortcut bypass arena build, break, item-use, entity-spawn or cross-arena protection?",
          "Is every credited protection actually imported, instantiated, subscribed and reachable in production?",
          "Can developer operation remain available without granting blanket live-world mutation?",
        ],
      }),
    );
  }

  if (input.hasWorldRuleSurface) {
    scenarios.push(
      scenario({
        id: "world:rule-authority",
        kind: "world-rule-authority",
        flowStage: "SETUP",
        reason:
          "World-rule observations must be attributed to the exact mechanism they govern instead of treating every world mutation as a gamerule effect.",
        questions: [
          "What is the authored world-rule baseline and who can rewrite it after setup?",
          "For entity creation, is the path natural spawning, spawn egg, command, script spawn, structure load, or setup tooling?",
          "Does the claimed gamerule actually control the observed path?",
          "Can a privileged role bypass a gameplay guard even while the world rule itself is correct?",
        ],
      }),
    );
  }

  if (input.hasCancelledWorldMutationSurface) {
    scenarios.push(
      scenario({
        id: "representation:cancelled-mutation",
        kind: "client-server-reconciliation",
        flowStage: "ACTIVE_GAMEPLAY",
        reason:
          "Client-predicted world actions that are cancelled or rewritten by the server can leave one client visually inconsistent with authoritative world state.",
        questions: [
          "Which player actions are client-predicted before a before-event guard cancels them?",
          "After cancellation, does the acting client reconcile to the same block/liquid/state seen by other clients?",
          "Do waterlogging, liquid placement, block replacement or interactive block-state changes require a narrow runtime proof?",
        ],
      }),
    );
  }

  if (input.hasSpatialContainmentSurface) {
    scenarios.push(
      scenario({
        id: "spatial:containment",
        kind: "spatial-containment",
        flowStage: "ACTIVE_GAMEPLAY",
        reason:
          "Movement capability and logical/loading bounds do not prove physical escape; collision geometry must decide containment.",
        questions: [
          "Can a player-sized 3D path actually cross the physical arena enclosure?",
          "Do minecraft:barrier, ceiling, floor, walls or other collision blocks close every reachable path?",
          "If physical escape is possible, can the player reach another arena or its interaction volume?",
          "Are loading bounds, gameplay bounds, collision bounds and session ownership bounds kept distinct?",
        ],
      }),
    );
  }

  if (effective.hasRepeatedRunSurface) {
    scenarios.push(
      scenario({
        id: "lifecycle:second-run",
        kind: "repeated-run",
        flowStage: "CLEANUP_REPLAY",
        reason:
          "A successful first run does not prove cleanup; the second run exposes leaked entities, timers, score, inventory, structures, objectives, and ownership.",
        questions: [
          "After completion/abort, is the arena/session baseline actually restored?",
          "Can any callback or state from Run 1 mutate Run 2?",
          "Does Run 2 behave equivalently to a fresh run?",
        ],
      }),
    );
  }

  return {
    schemaVersion: 1,
    policy: "selected-map-scenario-audit",
    scenarios,
  };
}
