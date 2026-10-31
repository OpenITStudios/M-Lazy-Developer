import {
  assessMechanicCompleteness,
  challengeDesignIntent,
  type DesignIntentChallengeResult,
  type GameplayIntentModel,
  type MechanicCompletenessResult,
} from "../../../gameplay-intent/src/index.js";
import {
  assessGameplayCapabilityDelivery,
  buildGameplayAuditScenarioPreset,
  detectGameplayDegradation,
  findDesignConsistencyAnomalies,
  findNegativeSpace,
  prioritizeTemporalInteraction,
  type DesignConsistencyAnomaly,
  type GameplayCapabilityDeliveryAssessment,
  type GameplayDegradationSignal,
  type GameplayAuditScenarioPreset,
  type NegativeSpaceSignal,
  type TemporalInteractionRisk,
} from "../../../diagnostic-reasoning/src/index.js";
import type {
  SemanticIr,
} from "../../../semantic-ir/src/index.js";
import type {
  GameDesignMapClassification,
} from "../../../game-design-spec/src/index.js";
import type {
  GameplayWorldModel,
} from "./gameplay-world-model.js";
import {
  compileGameplayScenarioGraph,
} from "./gameplay-scenario-compiler.js";
import {
  assessGameplayScenarioClosure,
} from "./gameplay-scenario-closure.js";
import {
  assessGameplayDefectResolutionGate,
  type GameplayDefectResolution,
  type GameplayDefectResolutionGate,
} from "./gameplay-defect-resolution.js";
import type {
  GameplayScenarioClosure,
  GameplayScenarioGraph,
} from "./gameplay-scenario-model.js";
import {
  challengeGameplayDiscovery,
  type GameplayDiscoveryChallengeSignal,
} from "./gameplay-discovery-challenger.js";
import {
  analyzeSharedResourceOwnership,
  type SharedResourceOwnershipRecord,
  type SharedResourceOwnershipSignal,
} from "./shared-resource-ownership.js";
import {
  analyzeAccumulationGrowth,
  analyzeCompoundBoundaries,
  type AccumulationGrowthSignal,
  type CompoundBoundarySignal,
} from "./gameplay-compound-growth-analysis.js";

export interface HiddenGameplayDefectAnalysis {
  readonly schemaVersion: 1;
  readonly classification?:
    GameDesignMapClassification;
  readonly designIntentChallenges: readonly {
    readonly subjectId: string;
    readonly label: string;
    readonly kind: GameplayIntentModel["nodes"][number]["kind"];
    readonly status: GameplayIntentModel["nodes"][number]["status"];
    readonly highRisk: boolean;
    readonly result: DesignIntentChallengeResult;
  }[];
  readonly mechanicCompleteness:
    readonly MechanicCompletenessResult[];
  readonly negativeSpace:
    readonly NegativeSpaceSignal[];
  readonly temporalRisks:
    readonly TemporalInteractionRisk[];
  readonly discoveryChallenges:
    readonly GameplayDiscoveryChallengeSignal[];
  readonly sharedResourceOwnership: {
    readonly records:
      readonly SharedResourceOwnershipRecord[];
    readonly signals:
      readonly SharedResourceOwnershipSignal[];
  };
  readonly compoundBoundaries:
    readonly CompoundBoundarySignal[];
  readonly accumulationGrowth:
    readonly AccumulationGrowthSignal[];
  readonly designConsistency:
    readonly DesignConsistencyAnomaly[];
  readonly degradations:
    readonly GameplayDegradationSignal[];
  readonly capabilityDelivery:
    readonly GameplayCapabilityDeliveryAssessment[];
  readonly auditScenarioPreset: GameplayAuditScenarioPreset;
  readonly scenarioAudit: {
    readonly graph: GameplayScenarioGraph;
    readonly closure: GameplayScenarioClosure;
    readonly defectResolution: GameplayDefectResolutionGate;
  };
  readonly attention: {
    readonly implementationOnlyIntent: number;
    readonly incompleteMechanics: number;
    readonly negativeSpaceSignals: number;
    readonly highTemporalRisks: number;
    readonly discoveryChallengeSignals: number;
    readonly sharedResourceSignals: number;
    readonly higherOrderSharedResources: number;
    readonly compoundBoundarySignals: number;
    readonly accumulationGrowthSignals: number;
    readonly designAnomalies: number;
    readonly silentDegradations: number;
    readonly designFailures: number;
    readonly designImplementationMismatches: number;
    readonly implementationFailures: number;
    readonly mandatoryAuditScenarios: number;
    readonly orphanGameplayComponents: number;
    readonly unresolvedCausalLinks: number;
    readonly contradictedCausalLinks: number;
    readonly defectResolutionBlocked: boolean;
    readonly runtimeProofResidue: number;
    readonly missingRequiredKnowledge: number;
    readonly knowledgeCapabilityGaps: number;
    readonly prerequisiteBlockedKnowledge: number;
  };
}

function evidenceForNode(
  model: GameplayIntentModel,
  evidenceIds: readonly string[],
) {
  const wanted = new Set(evidenceIds);
  return model.evidence.filter((item) =>
    wanted.has(item.id)
  );
}

function materialIntentChallenges(
  model: GameplayIntentModel,
) {
  return model.nodes
    .filter((node) =>
      node.kind === "mechanic" ||
      node.kind === "objective" ||
      node.kind === "phase" ||
      node.kind === "state" ||
      node.kind === "resource" ||
      node.kind === "lifecycle" ||
      node.kind === "spatial-region" ||
      node.kind === "policy" ||
      node.kind === "outcome"
    )
    .map((node) => {
      const evidence = evidenceForNode(
        model,
        node.evidenceIds,
      );
      const implementationEvidenceIds =
        evidence
          .filter((item) =>
            item.scope === "selected-artifact" &&
            item.origin === "source-code"
          )
          .map((item) => item.id);
      const independentDesignEvidenceIds =
        evidence
          .filter((item) =>
            item.scope === "selected-artifact" &&
            item.origin !== "source-code"
          )
          .map((item) => item.id);
      const playerFacingEvidenceIds =
        evidence
          .filter((item) =>
            item.scope === "selected-artifact" &&
            (
              item.origin === "dialogue" ||
              item.origin === "translation" ||
              item.origin === "structure" ||
              item.origin === "world-db" ||
              item.origin === "scoreboard" ||
              item.origin === "command"
            )
          )
          .map((item) => item.id);

      const highRisk =
        node.kind === "policy" ||
        node.kind === "resource" ||
        node.kind === "spatial-region" ||
        (
          node.kind === "mechanic" &&
          /(?:limit|capacity|queue|max|min|fallback|throttle|admission|concurrent|slot|spawn|place|materiali[sz]|tick|chunk|simulat|terminal|finish|complete|timeout|version|release|debug|spectat|owner)/i.test(
            node.label,
          )
        );

      return {
        subjectId: node.id,
        label: node.label,
        kind: node.kind,
        status: node.status,
        highRisk,
        result: challengeDesignIntent({
          implementationEvidenceIds,
          independentDesignEvidenceIds,
          playerFacingEvidenceIds,
          status: node.status,
        }),
      };
    });
}

function mechanicAssessments(
  model: GameplayIntentModel,
): readonly MechanicCompletenessResult[] {
  const outgoing = new Map<
    string,
    typeof model.edges
  >();
  const incoming = new Map<
    string,
    typeof model.edges
  >();

  // A hypothesized or unregistered relation is not a completed mechanic
  // delivery stage. Preserve uncertainty rather than awarding a false PASS.
  const groundedEvidenceIds = new Set(model.evidence
    .filter(item => item.scope === "selected-artifact")
    .map(item => item.id));
  const supportedEdges = model.edges.filter(edge =>
    edge.status === "authored" &&
    edge.evidenceIds.some(id => groundedEvidenceIds.has(id)));

  for (const edge of supportedEdges) {
    outgoing.set(
      edge.from,
      [...(outgoing.get(edge.from) ?? []), edge],
    );
    incoming.set(
      edge.to,
      [...(incoming.get(edge.to) ?? []), edge],
    );
  }

  return model.nodes
    .filter((node) => node.kind === "mechanic")
    .map((node) => {
      const out = outgoing.get(node.id) ?? [];
      const inc = incoming.get(node.id) ?? [];
      const evidenceIds = [
        ...new Set([
          ...node.evidenceIds.filter(id => groundedEvidenceIds.has(id)),
          ...out.flatMap((edge) => edge.evidenceIds.filter(id => groundedEvidenceIds.has(id))),
          ...inc.flatMap((edge) => edge.evidenceIds.filter(id => groundedEvidenceIds.has(id))),
        ]),
      ];

      const reachable =
        inc.some((edge) =>
          edge.kind === "requires" ||
          edge.kind === "transitions-to" ||
          edge.kind === "valid-during" ||
          edge.kind === "participates-in"
        ) ||
        out.some((edge) =>
          edge.kind === "valid-during" ||
          edge.kind === "scoped-to"
        );

      const triggered =
        inc.some((edge) =>
          edge.kind === "produces" ||
          edge.kind === "requires"
        ) ||
        out.some((edge) =>
          edge.kind === "produces"
        );

      const consumed =
        out.some((edge) =>
          edge.kind === "consumes" ||
          edge.kind === "produces" ||
          edge.kind === "transitions-to"
        );

      const effectApplied =
        out.some((edge) =>
          edge.kind === "produces" ||
          edge.kind === "transitions-to" ||
          edge.kind === "wins-by" ||
          edge.kind === "loses-by"
        );

      const playerVisible =
        out.some((edge) => {
          const target = model.nodes.find(
            (candidate) => candidate.id === edge.to,
          );
          return (
            target?.kind === "outcome" ||
            target?.kind === "objective" ||
            target?.kind === "state" ||
            target?.kind === "resource"
          );
        });

      return assessMechanicCompleteness({
        mechanicId: node.id,
        stages: {
          declared: node.status === "authored" &&
            node.evidenceIds.some(id => groundedEvidenceIds.has(id)),
          reachable,
          triggered,
          consumed,
          "effect-applied": effectApplied,
          "player-visible": playerVisible,
        },
        evidenceIds,
      });
    });
}

function negativeSpaceFromState(
  ir: SemanticIr,
): readonly NegativeSpaceSignal[] {
  const bySurface = new Map<
    string,
    {
      read: boolean;
      write: boolean;
      clear: boolean;
      evidenceIds: string[];
    }
  >();

  for (const operation of ir.state.operations) {
    const current = bySurface.get(
      operation.surfaceId,
    ) ?? {
      read: false,
      write: false,
      clear: false,
      evidenceIds: [],
    };

    if (operation.operation === "read") {
      current.read = true;
    }
    if (
      operation.operation === "write" ||
      operation.operation === "delete"
    ) {
      current.write = true;
    }
    if (
      operation.operation === "clear" ||
      operation.operation === "delete"
    ) {
      current.clear = true;
    }

    current.evidenceIds.push(operation.id);
    bySurface.set(operation.surfaceId, current);
  }

  return [...bySurface.entries()].flatMap(
    ([surfaceId, state]) =>
      findNegativeSpace({
        subjectId: surfaceId,
        hasProducer: state.write,
        hasConsumer: state.read,
        hasReset: state.clear,
        ...(state.clear ? { hasBaselineRestore: state.write } : {}),
        evidenceIds: state.evidenceIds,
      }),
  );
}

function temporalRisksFromIr(
  ir: SemanticIr,
): readonly TemporalInteractionRisk[] {
  return ir.temporal.relations.flatMap(
    (relation) => {
      const lifecycleText = [
        relation.from,
        relation.to ?? "",
        relation.targetLabel,
      ].join(" ");
      const factors = [
        relation.kind === "deferred"
          ? "async" as const
          : undefined,
        relation.kind === "periodic"
          ? "shared-resource" as const
          : undefined,
        relation.guardEvidence === "unresolved"
          ? "delayed-callback" as const
          : undefined,
        /disconnect|reconnect|playerleave|playerjoin|playerspawn/i.test(
          lifecycleText,
        )
          ? "reconnect" as const
          : undefined,
        /reload|worldload|world-load|initialize|bootstrap/i.test(
          lifecycleText,
        )
          ? "reload" as const
          : undefined,
        /cleanup|reset|abort|leavearena/i.test(
          lifecycleText,
        )
          ? "cleanup" as const
          : undefined,
        /terminal|finish|victory|defeat|timeout|endgame|endmatch/i.test(
          lifecycleText,
        )
          ? "terminal-transition" as const
          : undefined,
      ].filter(
        (
          value,
        ): value is
          | "async"
          | "shared-resource"
          | "delayed-callback"
          | "reconnect"
          | "reload"
          | "cleanup"
          | "terminal-transition" =>
          value !== undefined,
      );

      if (factors.length === 0) return [];

      return [
        prioritizeTemporalInteraction({
          leftSystem: relation.from,
          rightSystem:
            relation.to ??
            relation.targetLabel,
          factors,
        }),
      ];
    },
  );
}

function consistencyFromWorld(
  world: GameplayWorldModel,
): readonly DesignConsistencyAnomaly[] {
  if (
    !world.arenas.detected ||
    world.arenas.count === undefined ||
    world.arenas.count < 3
  ) {
    return [];
  }

  const observations = Array.from(
    { length: world.arenas.count },
    (_, index) => ({
      subjectId: "arena:" + String(index + 1),
      dimension: "arena-peer-availability",
      value: true,
    }),
  );

  const safeConcurrent =
    world.arenas.safeConcurrentArenas;
  if (
    safeConcurrent !== undefined &&
    safeConcurrent !== null &&
    safeConcurrent < world.arenas.count
  ) {
    for (
      let index = safeConcurrent;
      index < world.arenas.count;
      index += 1
    ) {
      observations[index] = {
        subjectId: "arena:" + String(index + 1),
        dimension: "arena-peer-availability",
        value: false,
      };
    }
  }

  return findDesignConsistencyAnomalies(
    observations,
  );
}

function capabilityDeliveryFromModel(
  intent: GameplayIntentModel,
  world: GameplayWorldModel,
  mechanicCompleteness:
    readonly MechanicCompletenessResult[],
): readonly GameplayCapabilityDeliveryAssessment[] {
  const assessments:
    GameplayCapabilityDeliveryAssessment[] = [];

  if (
    world.arenas.detected &&
    world.arenas.count !== undefined &&
    world.arenas.safeConcurrentArenas !== undefined &&
    world.arenas.safeConcurrentArenas !== null
  ) {
    assessments.push(
      assessGameplayCapabilityDelivery({
        subjectId: "runtime:arena-capacity",
        label: "Playable concurrent arena capacity",
        playerVisible: true,
        designed: true,
        implementationPresent: true,
        expectedCapacity:
          world.arenas.count,
        playableCapacity:
          world.arenas.safeConcurrentArenas,
        technicalConstraintReasons:
          world.platformKnowledge.claims
            .filter(
              (claim) =>
                claim.domain === "chunks" ||
                claim.domain === "multiplayer" ||
                claim.domain === "world-state",
            )
            .map((claim) => claim.message),
        evidenceIds: [
          "world:arena-count",
          "capacity:safe-concurrency",
        ],
        playerFacingEvidenceIds: [
          "world:arena-count",
        ],
      }),
    );
  }

  for (const completeness of mechanicCompleteness) {
    const node = intent.nodes.find(
      (item) =>
        item.id === completeness.mechanicId,
    );
    if (!node) continue;
    const evidence = evidenceForNode(
      intent,
      node.evidenceIds,
    );
    const designed =
      node.status === "authored" ||
      evidence.some(
        (item) =>
          item.scope === "selected-artifact" &&
          item.origin !== "source-code",
      );
    const implementationPresent =
      evidence.some(
        (item) =>
          item.scope === "selected-artifact" &&
          (
            item.origin === "source-code" ||
            item.origin === "command" ||
            item.origin === "scoreboard" ||
            item.origin === "tag"
          ),
      );
    const playerVisibleEvidence =
      evidence.some(
        (item) =>
          item.scope === "selected-artifact" &&
          (
            item.origin === "dialogue" ||
            item.origin === "translation" ||
            item.origin === "structure" ||
            item.origin === "world-db" ||
            item.origin === "scoreboard" ||
            item.origin === "command"
          ),
      );
    const playerVisible =
      playerVisibleEvidence ||
      !completeness.missingStages.includes(
        "player-visible",
      );

    assessments.push(
      assessGameplayCapabilityDelivery({
        subjectId: node.id,
        label: node.label,
        playerVisible,
        designed,
        implementationPresent,
        behaviorComplete:
          completeness.complete,
        evidenceIds:
          completeness.evidenceIds,
        playerFacingEvidenceIds:
          evidence
            .filter(
              (item) =>
                item.scope === "selected-artifact" &&
                (
                  item.origin === "dialogue" ||
                  item.origin === "translation" ||
                  item.origin === "structure" ||
                  item.origin === "world-db" ||
                  item.origin === "scoreboard" ||
                  item.origin === "command"
                ),
            )
            .map((item) => item.id),
      }),
    );
  }

  return assessments.sort((a, b) =>
    a.subjectId.localeCompare(b.subjectId)
  );
}

function degradationFromWorld(
  world: GameplayWorldModel,
): readonly GameplayDegradationSignal[] {
  const output: GameplayDegradationSignal[] = [];

  if (
    world.arenas.count !== undefined &&
    world.arenas.safeConcurrentArenas !==
      undefined &&
    world.arenas.safeConcurrentArenas !== null
  ) {
    output.push(
      ...detectGameplayDegradation({
        subjectId: "runtime:arena-capacity",
        primaryExpected: true,
        primaryObserved:
          world.arenas.safeConcurrentArenas >=
          world.arenas.count,
        expectedCapacity:
          world.arenas.count,
        observedCapacity:
          world.arenas.safeConcurrentArenas,
        evidenceIds: [
          "world:arena-count",
          "capacity:safe-concurrency",
        ],
      }),
    );
  }

  return output;
}

function selectedArtifactSearchText(
  intent: GameplayIntentModel,
): string {
  return [
    ...intent.nodes.flatMap((node) => [
      node.label,
      node.description ?? "",
    ]),
    ...intent.invariants.map((item) => item.statement),
    ...intent.evidence
      .filter((item) =>
        item.scope === undefined ||
        item.scope === "selected-artifact"
      )
      .flatMap((item) => [
        item.locator,
        item.summary,
      ]),
  ].join("\n");
}

function scenarioSurfaceSignals(
  intent: GameplayIntentModel,
): {
  privilegedCapability: boolean;
  worldRule: boolean;
  cancelledWorldMutation: boolean;
  spatialContainment: boolean;
  progressionActor: boolean;
} {
  const text = selectedArtifactSearchText(intent);
  return {
    privilegedCapability:
      /admin|roommaster|operator|permission|creative|spectator|developer|debug|gamemode|command permission/i.test(text),
    worldRule:
      /gamerule|doMobSpawning|doDaylightCycle|doWeatherCycle|keepInventory|difficulty|mob spawning|natural spawn/i.test(text),
    cancelledWorldMutation:
      /beforeEvents|before event|event\.cancel|cancelled interaction|cancelled item|bucket|waterlog|water bucket/i.test(text),
    spatialContainment:
      /barrier|arena boundary|containment|mayfly|flight|fly|physical arena|collision|outside arena/i.test(text),
    progressionActor:
      /\b(?:waves?|hordes?|(?:enemies|mobs?)\s+(?:remaining|alive|counts?|counter)|(?:remaining|alive|counts?)\s+(?:enemies|mobs?))\b/i.test(text),
  };
}

/** Source-grounded optional checks shared by first inspection and refresh.
 * Empty summary sections and generic player-inventory operations are not
 * evidence of persistence, payment, or wave-counter gameplay.
 */
function sourceBoundPresetSignals(
  world: GameplayWorldModel,
  actorProgressionCue: boolean,
): {
  hasPersistence: boolean;
  hasTransactionalGameplay: boolean;
  hasProgressionActorSurface: boolean;
} {
  return {
    // The world model always constructs a persistence summary. Its presence
    // is not proof that persistent gameplay properties were actually found.
    hasPersistence: (world.persistence?.properties ?? 0) > 0,
    // A kit grant/drop/reset alone is not a payment or reward transaction.
    hasTransactionalGameplay:
      world.economy.paths.length > 0 ||
      world.economy.scoreboardDebits > 0,
    // Counter observations are stronger than generic "round" / "kill" text.
    hasProgressionActorSurface:
      world.progression.actorAccounting.counters > 0 ||
      (world.entities.definitions > 0 && actorProgressionCue),
  };
}

function auditScenarioPresetFromModel(
  input: {
    readonly intent: GameplayIntentModel;
    readonly semanticIr: SemanticIr;
    readonly world: GameplayWorldModel;
    readonly classification?:
      GameDesignMapClassification;
    readonly defectResolutions?: readonly GameplayDefectResolution[];
  },
): GameplayAuditScenarioPreset {
  const deferredWork =
    input.semanticIr.temporal.relations.some(
      (relation) =>
        relation.kind === "deferred" ||
        relation.guardEvidence === "unresolved",
    );
  const surfaceSignals =
    scenarioSurfaceSignals(input.intent);
  const sourceSignals = sourceBoundPresetSignals(
    input.world, surfaceSignals.progressionActor,
  );

  return buildGameplayAuditScenarioPreset({
    ...(input.classification === undefined
      ? {}
      : {
          classification:
            input.classification,
        }),
    ...(input.world.arenas.count === undefined ? {} : { arenaCount: input.world.arenas.count }),
    ...((input.world.arenas.safeConcurrentArenas ?? input.world.arenas.declaredConcurrentArenaLimit) === undefined ? {} : { concurrentArenaLimit: (input.world.arenas.safeConcurrentArenas ?? input.world.arenas.declaredConcurrentArenaLimit)! }),
    ...(input.world.arenas.perArenaPlayerCapacity === undefined ? {} : { maxPartySize: input.world.arenas.perArenaPlayerCapacity }),
    hasMultiArena:
      input.world.arenas.detected &&
      (input.world.arenas.count ?? 0) > 1,
    ...sourceSignals,
    hasDeferredWork: deferredWork,
    hasRepeatedRunSurface:
      input.world.arenas.detected,
    hasSimulationDistanceDependency:
      input.world.entities.definitions > 0 &&
      (
        input.world.chunks.leases.length > 0 ||
        input.world.spatial.resolvedScriptEffects > 0 ||
        input.intent.nodes.some(
          (node) =>
            node.kind === "spatial-region" ||
            node.kind === "objective",
        )
      ),
    hasPlayerFeedbackSurface:
      input.intent.evidence.some((item) =>
        item.origin === "dialogue" ||
        item.origin === "translation" ||
        item.origin === "scoreboard" ||
        item.origin === "command"
      ),
    hasPrivilegedCapabilitySurface:
      surfaceSignals.privilegedCapability ||
      input.world.playerCapabilities.gamemodeWrites > 0 ||
      input.world.playerCapabilities.abilityWrites > 0 ||
      input.world.playerCapabilities.commandPermissionWrites > 0 ||
      input.world.playerCapabilities.privilegedGuardReferences > 0 ||
      input.world.playerCapabilities.protectionDefinitions > 0,
    hasWorldRuleSurface:
      surfaceSignals.worldRule ||
      input.world.worldRules.writes > 0 ||
      input.world.worldRules.manualEntitySpawnPaths > 0,
    hasCancelledWorldMutationSurface:
      surfaceSignals.cancelledWorldMutation ||
      input.world.clientReconciliation.predictedMutationCancellations > 0,
    hasSpatialContainmentSurface:
      surfaceSignals.spatialContainment ||
      (
        input.world.arenas.detected &&
        (
          input.world.playerCapabilities.mayflyGrants > 0 ||
          input.world.playerCapabilities.creativeModeGrants > 0
        )
      ),
  });
}

export function analyzeHiddenGameplayDefects(
  input: {
    readonly intent: GameplayIntentModel;
    readonly semanticIr: SemanticIr;
    readonly world: GameplayWorldModel;
    readonly classification?: GameDesignMapClassification;
    readonly defectResolutions?: readonly GameplayDefectResolution[];
  },
): HiddenGameplayDefectAnalysis {
  const designIntentChallenges =
    materialIntentChallenges(input.intent);
  const mechanicCompleteness =
    mechanicAssessments(input.intent);
  const negativeSpace =
    negativeSpaceFromState(input.semanticIr);
  const temporalRisks =
    temporalRisksFromIr(input.semanticIr);
  const designConsistency =
    consistencyFromWorld(input.world);
  const degradations =
    degradationFromWorld(input.world);
  const capabilityDelivery =
    capabilityDeliveryFromModel(
      input.intent,
      input.world,
      mechanicCompleteness,
    );
  const auditScenarioPreset =
    auditScenarioPresetFromModel(input);
  const scenarioGraph =
    compileGameplayScenarioGraph({
      intent: input.intent,
      world: input.world,
      preset: auditScenarioPreset,
      semanticIr: input.semanticIr,
    });
  const discoveryChallenges =
    challengeGameplayDiscovery({
      semanticIr: input.semanticIr,
      intent: input.intent,
      graph: scenarioGraph,
    });
  const sharedResourceOwnership =
    analyzeSharedResourceOwnership(
      input.semanticIr,
    );
  const compoundBoundaries =
    analyzeCompoundBoundaries(
      input.world,
    );
  const accumulationGrowth =
    analyzeAccumulationGrowth(
      input.world,
    );
  const scenarioClosure =
    assessGameplayScenarioClosure(
      scenarioGraph,
      discoveryChallenges.map(item => item.id),
    );
  const defectResolution =
    assessGameplayDefectResolutionGate(
      scenarioGraph,
      input.defectResolutions ?? [],
    );

  return {
    schemaVersion: 1,
    ...(input.classification === undefined
      ? {}
      : {
          classification:
            input.classification,
        }),
    designIntentChallenges,
    mechanicCompleteness,
    negativeSpace,
    temporalRisks,
    discoveryChallenges,
    sharedResourceOwnership,
    compoundBoundaries,
    accumulationGrowth,
    designConsistency,
    degradations,
    capabilityDelivery,
    auditScenarioPreset,
    scenarioAudit: {
      graph: scenarioGraph,
      closure: scenarioClosure,
      defectResolution,
    },
    attention: {
      implementationOnlyIntent:
        designIntentChallenges.filter(
          (item) =>
            item.highRisk &&
            item.result.disposition ===
            "implementation-only",
        ).length,
      incompleteMechanics:
        mechanicCompleteness.filter(
          (item) => !item.complete,
        ).length,
      negativeSpaceSignals:
        negativeSpace.length,
      highTemporalRisks:
        temporalRisks.filter(
          (item) => item.priority === "high",
        ).length,
      discoveryChallengeSignals:
        discoveryChallenges.length,
      sharedResourceSignals:
        sharedResourceOwnership.signals.length,
      higherOrderSharedResources:
        sharedResourceOwnership.records.filter(
          (item) => item.highOrderInteraction,
        ).length,
      compoundBoundarySignals:
        compoundBoundaries.length,
      accumulationGrowthSignals:
        accumulationGrowth.length,
      designAnomalies:
        designConsistency.length,
      silentDegradations:
        degradations.length,
      designFailures:
        capabilityDelivery.filter(
          (item) =>
            item.failureClass ===
            "DESIGN_FAILURE",
        ).length,
      designImplementationMismatches:
        capabilityDelivery.filter(
          (item) =>
            item.failureClass ===
            "DESIGN_IMPLEMENTATION_MISMATCH",
        ).length,
      implementationFailures:
        capabilityDelivery.filter(
          (item) =>
            item.failureClass ===
            "IMPLEMENTATION_FAILURE",
        ).length,
      mandatoryAuditScenarios:
        auditScenarioPreset.scenarios.length,
      orphanGameplayComponents:
        scenarioClosure.orphanComponentIds.length,
      unresolvedCausalLinks:
        scenarioClosure.unresolvedCausalLinkIds.length,
      contradictedCausalLinks:
        defectResolution.contradictedCausalLinkIds.length,
      defectResolutionBlocked:
        defectResolution.status === "BLOCKED",
      runtimeProofResidue:
        scenarioClosure.runtimeProofRequests.length +
        defectResolution.runtimeProofRequiredIds.length,
      missingRequiredKnowledge:
        scenarioClosure.missingRequiredKnowledgeIds.length,
      knowledgeCapabilityGaps:
        scenarioClosure.capabilityGapKnowledgeIds.length,
      prerequisiteBlockedKnowledge:
        scenarioClosure.prerequisiteBlockedKnowledgeIds.length,
    },
  };
}

export function refreshHiddenGameplayDefectsForWorld(
  existing: HiddenGameplayDefectAnalysis,
  world: GameplayWorldModel,
  intent?: GameplayIntentModel,
  defectResolutions?: readonly GameplayDefectResolution[],
): HiddenGameplayDefectAnalysis {
  const compoundBoundaries =
    analyzeCompoundBoundaries(world);
  const accumulationGrowth =
    analyzeAccumulationGrowth(world);
  const designConsistency =
    consistencyFromWorld(world);
  const degradations =
    degradationFromWorld(world);
  const capabilityDelivery =
    intent === undefined
      ? existing.capabilityDelivery
      : capabilityDeliveryFromModel(
          intent,
          world,
          existing.mechanicCompleteness,
        );
  const refreshSurfaceSignals =
    intent === undefined
      ? {
          privilegedCapability:
            existing.auditScenarioPreset.scenarios.some(
              (scenario) =>
                scenario.kind ===
                  "player-capability-integrity",
            ),
          worldRule:
            existing.auditScenarioPreset.scenarios.some(
              (scenario) =>
                scenario.kind ===
                  "world-rule-authority",
            ),
          cancelledWorldMutation:
            existing.auditScenarioPreset.scenarios.some(
              (scenario) =>
                scenario.kind ===
                  "client-server-reconciliation",
            ),
          spatialContainment:
            existing.auditScenarioPreset.scenarios.some(
              (scenario) =>
                scenario.kind ===
                  "spatial-containment",
            ),
          progressionActor:
            existing.auditScenarioPreset.scenarios.some(
              (scenario) =>
                scenario.kind ===
                  "progression-wave-integrity",
            ),
        }
      : scenarioSurfaceSignals(intent);
  const sourceSignals = sourceBoundPresetSignals(
    world, refreshSurfaceSignals.progressionActor,
  );
  const auditScenarioPreset =
    buildGameplayAuditScenarioPreset({
      ...(existing.classification === undefined
        ? {}
        : {
            classification:
              existing.classification,
          }),
      ...(world.arenas.count === undefined ? {} : { arenaCount: world.arenas.count }),
      ...((world.arenas.safeConcurrentArenas ?? world.arenas.declaredConcurrentArenaLimit) === undefined ? {} : { concurrentArenaLimit: (world.arenas.safeConcurrentArenas ?? world.arenas.declaredConcurrentArenaLimit)! }),
      ...(world.arenas.perArenaPlayerCapacity === undefined ? {} : { maxPartySize: world.arenas.perArenaPlayerCapacity }),
      hasMultiArena:
        world.arenas.detected &&
        (world.arenas.count ?? 0) > 1,
      ...sourceSignals,
      hasDeferredWork:
        existing.auditScenarioPreset.scenarios.some(
          (scenario) => scenario.kind === "deferred-ownership",
        ),
      hasRepeatedRunSurface:
        world.arenas.detected,
      hasSimulationDistanceDependency:
        world.entities.definitions > 0 &&
        (
          world.chunks.leases.length > 0 ||
          world.spatial.resolvedScriptEffects > 0 ||
          (intent?.nodes.some(
            (node) =>
              node.kind === "spatial-region" ||
              node.kind === "objective",
          ) ?? false)
        ),
      hasPlayerFeedbackSurface:
        intent?.evidence.some((item) =>
          item.origin === "dialogue" ||
          item.origin === "translation" ||
          item.origin === "scoreboard" ||
          item.origin === "command"
        ) ?? false,
      hasPrivilegedCapabilitySurface:
        refreshSurfaceSignals.privilegedCapability ||
        world.playerCapabilities.gamemodeWrites > 0 ||
        world.playerCapabilities.abilityWrites > 0 ||
        world.playerCapabilities.commandPermissionWrites > 0 ||
        world.playerCapabilities.privilegedGuardReferences > 0 ||
        world.playerCapabilities.protectionDefinitions > 0,
      hasWorldRuleSurface:
        refreshSurfaceSignals.worldRule ||
        world.worldRules.writes > 0 ||
        world.worldRules.manualEntitySpawnPaths > 0,
      hasCancelledWorldMutationSurface:
        refreshSurfaceSignals.cancelledWorldMutation ||
        world.clientReconciliation.predictedMutationCancellations > 0,
      hasSpatialContainmentSurface:
        refreshSurfaceSignals.spatialContainment ||
        (
          world.arenas.detected &&
          (
            world.playerCapabilities.mayflyGrants > 0 ||
            world.playerCapabilities.creativeModeGrants > 0
          )
        ),
    });

  const scenarioGraph =
    intent === undefined
      ? existing.scenarioAudit.graph
      : compileGameplayScenarioGraph({
          intent,
          world,
          preset: auditScenarioPreset,
          ...(existing.scenarioAudit.graph.sourceFlowCandidates === undefined ? {} : { existingSourceFlowCandidates: existing.scenarioAudit.graph.sourceFlowCandidates }),
           ...(existing.scenarioAudit.graph.guardedSourceTransitions === undefined ? {} : { existingGuardedSourceTransitions: existing.scenarioAudit.graph.guardedSourceTransitions }),
        });
  const scenarioClosure =
    intent === undefined
      ? existing.scenarioAudit.closure
      : assessGameplayScenarioClosure(
          scenarioGraph,
          existing.discoveryChallenges.map(item => item.id),
        );
  const defectResolution =
    intent === undefined
      ? existing.scenarioAudit.defectResolution
      : assessGameplayDefectResolutionGate(
          scenarioGraph,
          defectResolutions ??
            existing.scenarioAudit.defectResolution.resolutions,
        );

  return {
    ...existing,
    compoundBoundaries,
    accumulationGrowth,
    designConsistency,
    degradations,
    capabilityDelivery,
    auditScenarioPreset,
    scenarioAudit:
      intent === undefined
        ? existing.scenarioAudit
        : {
            graph: scenarioGraph,
            closure: scenarioClosure,
            defectResolution,
          },
    attention: {
      ...existing.attention,
      compoundBoundarySignals:
        compoundBoundaries.length,
      accumulationGrowthSignals:
        accumulationGrowth.length,
      designAnomalies:
        designConsistency.length,
      silentDegradations:
        degradations.length,
      designFailures:
        capabilityDelivery.filter(
          (item) =>
            item.failureClass ===
            "DESIGN_FAILURE",
        ).length,
      designImplementationMismatches:
        capabilityDelivery.filter(
          (item) =>
            item.failureClass ===
            "DESIGN_IMPLEMENTATION_MISMATCH",
        ).length,
      implementationFailures:
        capabilityDelivery.filter(
          (item) =>
            item.failureClass ===
            "IMPLEMENTATION_FAILURE",
        ).length,
      mandatoryAuditScenarios:
        auditScenarioPreset.scenarios.length,
      orphanGameplayComponents:
        intent === undefined
          ? existing.attention.orphanGameplayComponents
          : scenarioClosure.orphanComponentIds.length,
      unresolvedCausalLinks:
        intent === undefined
          ? existing.attention.unresolvedCausalLinks
          : scenarioClosure.unresolvedCausalLinkIds.length,
      contradictedCausalLinks:
        defectResolution.contradictedCausalLinkIds.length,
      defectResolutionBlocked:
        defectResolution.status === "BLOCKED",
      runtimeProofResidue:
        scenarioClosure.runtimeProofRequests.length +
        defectResolution.runtimeProofRequiredIds.length,
      missingRequiredKnowledge:
        scenarioClosure.missingRequiredKnowledgeIds.length,
      knowledgeCapabilityGaps:
        scenarioClosure.capabilityGapKnowledgeIds.length,
      prerequisiteBlockedKnowledge:
        scenarioClosure.prerequisiteBlockedKnowledgeIds.length,
    },
  };
}
