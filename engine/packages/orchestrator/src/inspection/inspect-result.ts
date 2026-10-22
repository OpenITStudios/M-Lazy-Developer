import type { DiagnosticFinding } from "../../../diagnostics/src/index.js";
import type { FileInventoryEntry } from "../../../project-model/src/index.js";
import type { TelemetryEvent } from "../../../project-model/src/index.js";
import { semanticIrSummary, type SemanticIr } from "../../../semantic-ir/src/index.js";
import { telemetryEventKinds } from "../../../project-model/src/index.js";
import type { GameplayIntentModel } from "../../../gameplay-intent/src/index.js";
import type {
  GameDesignMapClassification,
} from "../../../game-design-spec/src/index.js";
import type { GameplayIntentRuntimeAnalysis } from "./gameplay-intent-runtime-stage.js";
import type {
  InspectDirectoryResult,
  InspectedPack,
  InspectTargetProfile,
} from "../types.js";
import { planInspectionRepairs } from "../repair/repair-planning.js";
import { deriveReliabilityFingerprint } from "../reliability/reliability-fingerprint.js";
import { deriveScriptApiUsage } from "./script-api-usage.js";
import { indexInspectionSources } from "./inspect-source-index.js";
import { prepareInspectionRuntimeEvidence } from "./inspect-runtime-evidence.js";
import { analyzeInspectionEntityKnowledge } from "./inspect-entity-knowledge-stage.js";
import { analyzeKnowledgeRuntime } from "./knowledge-runtime-analysis.js";
import { analyzeInspectionRuntimeState } from "./inspect-runtime-analysis-stage.js";
import { analyzeInspectionEducation } from "./inspect-education-stage.js";
import { analyzeInspectionCausality } from "./inspect-causality-stage.js";
import { deriveGameplayWorldModel } from "./gameplay-world-model.js";
import {
  assessObjectiveAuthorityDeclarations,
} from "./state-authority-analysis.js";
import { projectGameplaySemanticModel } from "./gameplay-semantic-model.js";
import { projectMapEngineeringAssessment } from "./map-engineering-assessment.js";
import { analyzeHiddenGameplayDefects } from "./hidden-gameplay-defect-analysis.js";
import { buildGameplayBoundaryRegistry } from "./gameplay-boundary-registry.js";
import { deriveInspectionEngineeringAnalyses } from "./engineering-analysis-stage.js";
import { deriveMultiplayerStateValidationPlan } from "./multiplayer-state-validation.js";
import { analyzeDeveloperToolReleaseExposure } from "./developer-tool-release-analysis.js";
import { buildGameplayReachabilityGraph } from "./gameplay-reachability-stage.js";
import { summarizeCapabilityExposure } from "./capability-exposure-stage.js";
import { assessGameplayDiscoveryClosure } from "./gameplay-discovery-closure.js";
import { deriveGameplayAnalysisPriorities } from "./gameplay-analysis-priority.js";
import { deriveArenaAuthoredSpatialSources } from "../arena/arena-authored-source-index.js";
import { deriveMandatoryAuditProcedureReceipt } from "./mandatory-audit-procedure.js";

type SourceIndex = Awaited<
  ReturnType<typeof indexInspectionSources>
>;
type RuntimeEvidenceStage = ReturnType<
  typeof prepareInspectionRuntimeEvidence
>;
type EntityKnowledgeStage = ReturnType<
  typeof analyzeInspectionEntityKnowledge
>;
type KnowledgeRuntimeStage = ReturnType<
  typeof analyzeKnowledgeRuntime
>;
type RuntimeAnalysisStage = ReturnType<
  typeof analyzeInspectionRuntimeState
>;
type EducationStage = ReturnType<
  typeof analyzeInspectionEducation
>;
type CausalityStage = ReturnType<
  typeof analyzeInspectionCausality
>;

export interface InspectionResultInput {
  artifactId: string;
  sourceFingerprint?: string;
  files: readonly FileInventoryEntry[];
  packs: readonly InspectedPack[];
  target: InspectTargetProfile;
  knowledgeCatalogPresent: boolean;
  sourceIndex: SourceIndex;
  semanticIr: SemanticIr;
  gameplayIntent: GameplayIntentModel;
  contractSourceFiles: number;
  gameplayIntentRuntime: GameplayIntentRuntimeAnalysis;
  runtimeEvidenceStage: RuntimeEvidenceStage;
  entityKnowledge: EntityKnowledgeStage;
  knowledgeRuntime: KnowledgeRuntimeStage;
  runtimeAnalysis: RuntimeAnalysisStage;
  releaseIdentity: import("../release/release-identity-analysis.js").ReleaseIdentityAnalysis;
  education: EducationStage;
  causal: CausalityStage;
  telemetryEvents: readonly TelemetryEvent[];
  telemetryDroppedEvents: number;
  runtimeProbeDroppedExchanges: number;
  mapClassification?: GameDesignMapClassification;
  diagnostics: readonly DiagnosticFinding[];
}

function normalizedCommand(
  value: string,
): string {
  return value
    .trim()
    .replace(/^\//, "")
    .toLowerCase();
}

function commandStartsWithAny(
  command: string,
  prefixes: readonly string[],
): boolean {
  const normalized = normalizedCommand(command);
  return prefixes.some(
    (prefix) =>
      normalized === prefix ||
      normalized.startsWith(prefix + " "),
  );
}

function deriveUnsupportedSurfaceSignals(
  parsedScripts: InspectionResultInput["sourceIndex"]["parsedScripts"],
) {
  const scripts = parsedScripts.map(
    (item) => item.parsed,
  );
  const commands = scripts.flatMap(
    (script) => script.commandLiterals,
  );
  const teleport =
    commands.some((item) =>
      commandStartsWithAny(
        item.command,
        ["tp", "teleport"],
      )
    ) ||
    scripts.some((script) =>
      script.methodCalls.some(
        (call) =>
          call.method === "teleport",
      )
    );
  const uiForm =
    scripts.some((script) =>
      script.imports.some(
        (item) =>
          item.module ===
          "@minecraft/server-ui",
      ) ||
      script.moduleMemberAccesses.some(
        (item) =>
          item.module ===
          "@minecraft/server-ui",
      )
    );
  const environment = commands.some((item) =>
    commandStartsWithAny(
      item.command,
      [
        "gamerule",
        "time",
        "weather",
        "difficulty",
        "gamemode",
      ],
    )
  );
  const mutatingAsyncPrefixes = [
    "give",
    "clear",
    "scoreboard",
    "tp",
    "teleport",
    "structure",
    "fill",
    "setblock",
    "clone",
    "summon",
    "event",
    "tag",
    "gamerule",
    "time",
    "weather",
    "difficulty",
    "gamemode",
    "tickingarea",
  ];
  const asyncCommandTransaction =
    commands.some(
      (item) =>
        item.mechanism ===
          "runCommandAsync" &&
        commandStartsWithAny(
          item.command,
          mutatingAsyncPrefixes,
        ),
    );
  const dynamicCommand =
    scripts.some((script) =>
      script.methodCalls.some(
        (call) =>
          (
            call.method === "runCommand" ||
            call.method === "runCommandAsync"
          ) &&
          (
            call.hasSpreadArgument ||
            call.argumentKinds[0] !== "string"
          ),
      )
    );

  return {
    teleport,
    uiForm,
    environment,
    asyncCommandTransaction,
    dynamicCommand,
  };
}

function countObservedOutcomes(
  causalChains: CausalityStage["causalChains"],
): number {
  return causalChains.reduce((sum, item) => {
    const nodesById = new Map(
      item.nodes.map((node) => [node.id, node]),
    );
    return sum + new Set(
      item.links
        .filter((link) => {
          const from = nodesById.get(link.from);
          const to = nodesById.get(link.to);
          return (
            link.strength === "direct-evidence" &&
            link.temporalIntegrity !== "incomplete" &&
            link.temporalStatus !== "before-subject" &&
            from?.kind === "downstream-risk" &&
            to?.kind === "observed-state"
          );
        })
        .map((link) => link.to),
    ).size;
  }, 0);
}

function transactionSummary(
  items: readonly {
    status:
      | "verified-before-dependent"
      | "dependent-before-verification"
      | "verification-unresolved"
      | "no-dependent-action";
  }[],
) {
  return {
    assessed: items.length,
    verifiedBeforeDependent: items.filter(
      (item) =>
        item.status === "verified-before-dependent",
    ).length,
    dependentBeforeVerification: items.filter(
      (item) =>
        item.status === "dependent-before-verification",
    ).length,
    verificationUnresolved: items.filter(
      (item) =>
        item.status === "verification-unresolved",
    ).length,
    noDependentAction: items.filter(
      (item) =>
        item.status === "no-dependent-action",
    ).length,
  };
}

export function buildInspectionResult(
  input: InspectionResultInput,
): InspectDirectoryResult {
  const {
    graph,
    nodes,
    parsedFunctions,
    parsedScripts,
    parsedEntities,
    parsedStructureModels,
    parsedStructures,
  } = input.sourceIndex;

  const {
    telemetryEvidence,
    combatRuntimeTelemetry,
    runtimeProbeEvidence,
    telemetryContinuity,
    telemetryEvidenceIntegrity,
    runtimeProbeEvidenceIntegrity,
    evidenceRecovery,
  } = input.runtimeEvidenceStage;

  const {
    knowledgeProfileResolution,
    entityStates,
    entityKnowledgeGaps,
    entityStaticLimits,
  } = input.entityKnowledge;

  const {
    entityAiStack,
    entityPopulation,
    interactionLifecycle,
    routeNavigationEnvironment,
    structureRuntime,
    scriptStructureLoads,
    placedEmbeddedCommands,
    topology,
    scriptSpatial,
    spatialAuthority,
    scriptSafeConfig,
    worldRuleAuthority,
    playerCapabilitySurfaces,
    clientMutationReconciliation,
    capabilityMutationFootprint,
    progressionActorAccounting,
    inventoryLifecycle,
    inventoryPolicy,
    inventoryRestoreOwnership,
    combatLifecycle,
    chunkLifecycle,
    persistenceSource,
    rewardSources,
    combatPolicy,
    economyPolicy,
    commandContext,
    arenaLifecycle,
    arenaCleanupSurfaces,
    arenaResetClosure,
    arenaGlobalState,
    arenaStateIsolation,
    arenaLayoutReconciliation,
    arenaCapacity,
    routeCorrelations,
    effectiveRouteCorridors,
    derivedGameplayRouteCorridors,
    mutationTransactions,
    scriptMutationTransactions,
    scriptCommandTransactions,
    preflightKnowledgeDemand,
  } = input.runtimeAnalysis;

  const {
    targetEducation,
    educationSpecialtyBlocks,
  } = input.education;

  const {
    decisionBasis,
    causalChains,
    causalIncidents,
    diagnosticProbeAnalysis,
  } = input.causal;

  const dbFiles = input.files.filter((file) => {
    const normalized =
      "/" + file.relativePath.replaceAll("\\", "/");
    return normalized.includes("/db/");
  });

  const scriptApiUsage = deriveScriptApiUsage(
    parsedScripts.map((item) => item.parsed),
  );

  const semanticSummary =
    semanticIrSummary(input.semanticIr);
  const entitySpawnEvidence =
    topology.resolvedSpatialEffects.filter(
      (
        effect,
      ): effect is Extract<
        typeof effect,
        { kind: "entity-spawn" }
      > => effect.kind === "entity-spawn",
    );
  const functionSources = Object.fromEntries(
    parsedFunctions.map((item) => [
      item.parsed.identifier,
      item.node.source,
    ]),
  );
  const authoredSources =
    deriveArenaAuthoredSpatialSources({
      topology,
      scripts: parsedScripts.map(
        (item) => item.parsed,
      ),
      scriptSpatial,
      structurePlacements:
        structureRuntime.absoluteStructurePlacements,
      functionSources,
    });

  const baseArenaAnalysis = {
    autoDetected:
      topology.arenaReplicaDiscovery !== undefined,
    ...(topology.arenaReplicaDiscovery === undefined
      ? {}
      : { discovery: topology.arenaReplicaDiscovery }),
    ...(topology.arenaRegionPlan === undefined
      ? {}
      : { regionPlan: topology.arenaRegionPlan }),
    ...(topology.arenaRegionClassification === undefined
      ? {}
      : {
          regionClassification:
            topology.arenaRegionClassification,
        }),
    capacity: arenaCapacity,
    layoutReconciliation:
      arenaLayoutReconciliation,
    lifecycle: arenaLifecycle,
    cleanupSurfaces: arenaCleanupSurfaces,
    resetClosure: arenaResetClosure,
    globalState: arenaGlobalState,
    stateIsolation: arenaStateIsolation,
    entitySpawnEvidence,
    authoredSources,
  };

  const gameplayBoundaries =
    buildGameplayBoundaryRegistry(
      scriptSafeConfig,
    );

  const unsupportedSurfaceSignals =
    deriveUnsupportedSurfaceSignals(
      parsedScripts,
    );

  // Restricted/debug capability reachability is selected-artifact evidence.
  // Resolve it before GameplayWorld/scenario compilation so an exposed
  // capability can become a static contradiction instead of a manual-test
  // obligation discovered only after the main causal graph is built.
  const gameplayReachability =
    buildGameplayReachabilityGraph(
      parsedScripts,
      nodes,
      parsedStructureModels,
    );
  const developerToolRelease =
    analyzeDeveloperToolReleaseExposure(
      parsedScripts,
      gameplayReachability,
    );
  const capabilityExposure =
    summarizeCapabilityExposure({
      developerTools:
        developerToolRelease,
    });

  const objectiveAuthority =
    assessObjectiveAuthorityDeclarations(
      input.gameplayIntent,
      input.target.stateAuthorityContracts ??
        [],
    );

  const gameplayWorld = deriveGameplayWorldModel({
    artifactId: input.artifactId,
    intent: input.gameplayIntent,
    arena: baseArenaAnalysis,
    scriptSpatial,
    ...(spatialAuthority === undefined
      ? {}
      : { spatialAuthority }),
    inventoryLifecycle,
    inventoryPolicy,
    inventoryRestoreOwnership,
    worldRuleAuthority,
    playerCapabilitySurfaces,
    capabilityExposure,
    clientMutationReconciliation,
    capabilityMutationFootprint,
    progressionActorAccounting,
    combatLifecycle,
    combatRuntime:
      combatRuntimeTelemetry,
    combatPolicy,
    chunkLifecycle,
    persistenceSource,
    rewardSources,
    economyPolicy,
    semanticIr: {
      stateSurfaces: semanticSummary.stateSurfaces,
      stateOperations: semanticSummary.stateOperations,
    },
    objectiveAuthority,
    broadWrites: topology.broadWrites,
    structures: {
      definitions: nodes.filter(
        (node) => node.kind === "structure",
      ).length,
      loads: structureRuntime.structureLoads.length,
      unresolvedLoads:
        structureRuntime.unresolvedStructureLoads,
      placements:
        structureRuntime.absoluteStructurePlacements.length +
        scriptSpatial.structurePlacements.length,
      runtimeLogicLoads:
        structureRuntime.runtimeLogicStructureLoads,
      transitionResidueRisks:
        parsedStructureModels.filter(
          (item) =>
            item.transitionResidue?.status ===
            "residue-risk",
        ).length,
      transitionResidueUnresolved:
        parsedStructureModels.filter(
          (item) =>
            item.transitionResidue?.status ===
            "unresolved",
        ).length,
      loadCorrelations:
        structureRuntime.correlations.map((item) => ({
          functionId: item.load.functionId,
          ...(item.load.line === undefined
            ? {}
            : { line: item.load.line }),
          target: item.load.semantics.name,
          status: item.status,
          findings: [...item.findings],
        })),
      transitionResidue:
        structureRuntime.structureTransitionResidue.map((item) => ({
          functionId: item.functionId,
          previousTarget: item.previousTarget,
          nextTarget: item.nextTarget,
          ...(item.previousLine === undefined
            ? {}
            : { previousLine: item.previousLine }),
          ...(item.nextLine === undefined
            ? {}
            : { nextLine: item.nextLine }),
          status: item.status,
          preservedByVoid: item.preservedByVoid,
          explicitlyCleared: item.explicitlyCleared,
          replaced: item.replaced,
          reasons: [...item.reasons],
        })),
    },
    entityAiStack,
    routeNavigationEnvironment,
    analysisDemand:
      preflightKnowledgeDemand,
    platformKnowledge: {
      profileResolved:
        input.knowledgeRuntime.profileResolved,
      profileSource:
        input.knowledgeRuntime.profileSource,
      claims:
        input.knowledgeRuntime.platformClaims,
    },
    entities: {
      definitions: parsedEntities.length,
      knowledgePrerequisiteGaps:
        entityKnowledgeGaps,
      staticAnalysisLimits:
        entityStaticLimits,
    },
    boundaries: {
      records:
        gameplayBoundaries.records.length,
      unresolvedNames:
        gameplayBoundaries.unresolvedNames,
    },
    unsupportedSurfaceSignals,
  });

  // Ambiguous targets are not resolved execution evidence: include them
  // in Discovery's unresolved reference accounting without choosing a pack.
  const discoveryUnresolvedReferences =
    graph.unresolvedEdges()
      .filter((edge) => edge.type !== "IMPORTS_MINECRAFT_MODULE").length +
    graph.ambiguousEdges().length;
  const gameplaySemantic = projectGameplaySemanticModel(gameplayWorld);
  const engineeringAssessment = projectMapEngineeringAssessment(gameplayWorld);
  const hiddenGameplayDefects =
    analyzeHiddenGameplayDefects({
      intent: input.gameplayIntent,
      semanticIr: input.semanticIr,
      world: gameplayWorld,
      ...(input.mapClassification === undefined
        ? {}
        : {
            classification:
              input.mapClassification,
          }),
    });
  const gameplayDiscoveryClosure =
    assessGameplayDiscoveryClosure({
      inventoriedFileCount: input.sourceIndex.coverage.physicalFiles,
      sourceFileAccountingComplete:
        input.sourceIndex.coverage.physicalInventoryAccounted,
      discoveredSurfaceIds:
        gameplayWorld.surfaceDiscovery
          .surfaceIds,
      unlistedPackRoots: input.packs
        .filter(pack => pack.worldAttachment === "not-listed" &&
          input.sourceIndex.coverage.fileOutcomes.some(outcome =>
            outcome.relativePath.startsWith(pack.root + "/")))
        .map(pack => pack.root),
      sourceRelevantFiles:
        input.sourceIndex.coverage.relevantFiles,
      sourceIndexedFiles:
        input.sourceIndex.coverage.indexedFiles,
      sourceCoverageComplete:
        input.sourceIndex.coverage.complete,
      sourceParseFailures:
        input.sourceIndex.coverage
          .parseFailures.length,
      unsupportedRelevantSourcePaths:
        input.sourceIndex.coverage
          .unsupportedRelevantFiles,
      semanticUnderstandingGapPaths:
        input.sourceIndex.coverage
          .semanticUnderstandingGaps,
      unresolvedReferences:
        discoveryUnresolvedReferences,
      discoveryChallengeIds:
        hiddenGameplayDefects.discoveryChallenges.map((item) => item.id),
       unresolvedSourceLinkIds: [
         ...input.semanticIr.execution.edges.filter((item) => item.resolution === "unresolved").map((item) => item.id),
         ...input.semanticIr.temporal.relations.filter((item) => item.resolution === "unresolved").map((item) => item.id),
       ],
      gameplayIntentUnknownIds: input.gameplayIntent.unknowns.map(item => item.id),
    });

  const engineeringAnalyses =
    deriveInspectionEngineeringAnalyses({
      world: gameplayWorld,
      arenaCapacity,
      target: input.target,
    });
  const multiplayerStateValidation =
    deriveMultiplayerStateValidationPlan(
      input.gameplayIntent,
    );
  const analysisPriorities =
    deriveGameplayAnalysisPriorities(
      gameplayWorld,
      capabilityExposure,
      hiddenGameplayDefects.scenarioAudit.graph,
    );

  const mandatoryAuditProcedure =
    deriveMandatoryAuditProcedureReceipt({
      artifactId: input.artifactId,
      discovery: gameplayDiscoveryClosure,
      world: gameplayWorld,
      intent: input.gameplayIntent,
      semanticIr: input.semanticIr,
      boundaries: gameplayBoundaries,
      multiplayer: multiplayerStateValidation,
      hidden: hiddenGameplayDefects,
    });

  const reliability = deriveReliabilityFingerprint({
    mapId: input.artifactId,
    ...(input.sourceFingerprint
      ? {
          artifactFingerprint:
            input.sourceFingerprint,
        }
      : {}),
    packs: [...input.packs],
    functions: parsedFunctions.map(
      (item) => item.parsed,
    ),
    scripts: parsedScripts.map(
      (item) => item.parsed,
    ),
    structures: nodes.filter(
      (node) => node.kind === "structure",
    ).length,
    parsedStructures,
    entities: parsedEntities.length,
    entityKnowledgeGaps,
    worldDatabasePresent: dbFiles.length > 0,
    stateAccesses: topology.stateAccesses.length,
    broadStateWrites: topology.broadWrites,
    repeatedTopologyCandidates:
      topology.candidates.length,
    diagnostics: input.diagnostics,
    causalChains,
    causalIncidents,
    target: input.target,
  });

  return {
    files: input.files.length,
    fileInventory: [...input.files],
    packs: [...input.packs],
    functions: nodes.filter(
      (node) => node.kind === "function",
    ).length,
    scripts: nodes.filter(
      (node) => node.kind === "script_file",
    ).length,
    authoredWaveStages: parsedScripts.flatMap(item =>
      item.parsed.waveConfigurations ?? []),
    authoredGameplayCatalog: parsedScripts.flatMap(item =>
      item.parsed.authoredGameplayCatalog ?? []),
    authoredContentCollections: parsedScripts.flatMap(item =>
      item.parsed.authoredContentCollections ?? []),
    scriptSourceMapNavigation: [...input.sourceIndex.scriptSourceMapNavigation],
    scriptApiUsage,
    scriptSafeConfig,
    scriptSpatial,
    worldRuleAuthority,
    playerCapabilitySurfaces,
    clientMutationReconciliation,
    capabilityMutationFootprint,
    ...(spatialAuthority === undefined
      ? {}
      : { spatialAuthority }),
    inventoryLifecycle,
    inventoryPolicy,
    inventoryRestoreOwnership,
    combatLifecycle,
    combatRuntime:
      combatRuntimeTelemetry,
    combatPolicy,
    chunkLifecycle,
    persistenceSource,
    rewardSources,
    economyPolicy,
    releaseIdentity: input.releaseIdentity,
    gameplayWorld,
    gameplayDiscoveryClosure,
    gameplaySemantic,
    engineeringAssessment,
    hiddenGameplayDefects,
    gameplayBoundaries,
    engineeringAnalyses,
    multiplayerStateValidation,
    developerToolRelease,
    gameplayReachability,
    capabilityExposure,
    analysisPriorities,
    mandatoryAuditProcedure,
    semanticIrModel: input.semanticIr,
    structures: nodes.filter(
      (node) => node.kind === "structure",
    ).length,
    parsedStructures,
    entities: parsedEntities.length,
    entityAiStack,
    entityPopulation,
    interactionLifecycle,
    routeNavigationEnvironment,
    entityKnowledge: {
      analyzed:
        input.knowledgeCatalogPresent &&
        knowledgeProfileResolution.profile
          ? parsedEntities.length
          : 0,
      states: entityStates,
      prerequisiteGaps: entityKnowledgeGaps,
      staticAnalysisLimits: entityStaticLimits,
    },
    knowledgeRuntime: {
      enabled: input.knowledgeRuntime.enabled,
      profileResolved:
        input.knowledgeRuntime.profileResolved,
      profileSource:
        input.knowledgeRuntime.profileSource,
      profileConflicts:
        input.knowledgeRuntime.profileConflicts,
      evidenceRecords:
        input.knowledgeRuntime.evidenceRecords,
      violations:
        input.knowledgeRuntime.violations,
      evidenceGaps:
        input.knowledgeRuntime.evidenceGaps,
      validationCases:
        input.knowledgeRuntime.validationCases.length,
    },
    causalAnalysis: {
      chains: causalChains,
      highConfidence: causalChains.filter(
        (item) => item.confidence === "high",
      ).length,
      mediumConfidence: causalChains.filter(
        (item) => item.confidence === "medium",
      ).length,
      lowConfidence: causalChains.filter(
        (item) => item.confidence === "low",
      ).length,
      projectedRisks: causalChains.reduce(
        (sum, item) =>
          sum +
          item.nodes.filter(
            (node) =>
              node.kind === "downstream-risk",
          ).length,
        0,
      ),
      corroboratedRisks: causalChains.reduce(
        (sum, item) =>
          sum +
          item.links.filter(
            (link) =>
              link.strength ===
              "corroborated-risk",
          ).length,
        0,
      ),
      observedOutcomes:
        countObservedOutcomes(causalChains),
      incidents: causalIncidents,
      rootCauseCandidates:
        causalIncidents.reduce(
          (sum, incident) =>
            sum +
            incident.rootCauseCandidates.length,
          0,
        ),
    },
    telemetryAnalysis: {
      events: input.telemetryEvents.length,
      evidenceRecords: telemetryEvidence.length,
      droppedEvents:
        input.telemetryDroppedEvents,
      byKind:
        telemetryEventKinds(input.telemetryEvents),
      continuity: {
        sequencedEvents:
          telemetryContinuity.sequencedEvents,
        unsequencedEvents:
          telemetryContinuity.unsequencedEvents,
        unidentifiedStreamEvents:
          telemetryContinuity
            .unidentifiedStreamEvents,
        streams:
          telemetryContinuity.streams.length,
        missingSequences:
          telemetryContinuity.missingSequences,
        duplicateSequences:
          telemetryContinuity.duplicateSequences,
        nonMonotonicTransitions:
          telemetryContinuity
            .nonMonotonicTransitions,
        incomplete:
          telemetryContinuity.incomplete,
      },
    },
    runtimeProbeAnalysis: {
      responses:
        runtimeProbeEvidence.summary.responses,
      evidenceRecords:
        runtimeProbeEvidence.records.length,
      present:
        runtimeProbeEvidence.summary.present,
      absent:
        runtimeProbeEvidence.summary.absent,
      unknown:
        runtimeProbeEvidence.summary.unknown,
      failed:
        runtimeProbeEvidence.summary.failed,
      droppedExchanges:
        input.runtimeProbeDroppedExchanges,
    },
    evidenceIntegrity: {
      telemetry: telemetryEvidenceIntegrity,
      runtimeProbe:
        runtimeProbeEvidenceIntegrity,
    },
    evidenceRecovery,
    diagnosticProbeAnalysis,
    worldDatabase: {
      present: dbFiles.length > 0,
      fileCount: dbFiles.length,
    },
    arenaAnalysis: baseArenaAnalysis,
    gameplayIntent: {
      model: input.gameplayIntent,
      contractSourceFiles: input.contractSourceFiles,
      nodes: input.gameplayIntent.nodes.length,
      authoredNodes: input.gameplayIntent.nodes.filter(
        (node) => node.status === "authored",
      ).length,
      inferredNodes: input.gameplayIntent.nodes.filter(
        (node) => node.status === "inferred",
      ).length,
      hypothesisNodes: input.gameplayIntent.nodes.filter(
        (node) => node.status === "hypothesis",
      ).length,
      invariants: input.gameplayIntent.invariants.length,
      unknowns: input.gameplayIntent.unknowns.length,
    },
    gameplayIntentRuntime: {
      assessments: input.gameplayIntentRuntime.assessments,
      routeAssessments:
        input.gameplayIntentRuntime.routeAssessments,
      routeStallAssessments:
        input.gameplayIntentRuntime.routeStallAssessments,
      designedBehavior:
        input.gameplayIntentRuntime.designedBehavior,
      confirmedDefects:
        input.gameplayIntentRuntime.confirmedDefects,
      ambiguousIntent:
        input.gameplayIntentRuntime.ambiguousIntent,
      insufficientEvidence:
        input.gameplayIntentRuntime.insufficientEvidence,
      runtimeStateObservations:
        input.runtimeEvidenceStage.runtimeStateObservations.length,
      runtimeOutcomeObservations:
        input.runtimeEvidenceStage.runtimeOutcomeObservations.length,
      runtimeRouteObservations:
        input.runtimeEvidenceStage.runtimeRouteObservations.length,
      routeResolved:
        input.gameplayIntentRuntime.routeResolved,
      routeAmbiguous:
        input.gameplayIntentRuntime.routeAmbiguous,
      routeUnresolved:
        input.gameplayIntentRuntime.routeUnresolved,
      runtimeNavigationStallObservations:
        input.runtimeEvidenceStage
          .runtimeNavigationStallObservations.length,
      runtimeNavigationTargetObservations:
        input.runtimeEvidenceStage
          .runtimeNavigationTargetObservations.length,
      runtimeRouteReachabilityObservations:
        input.runtimeEvidenceStage
          .runtimeRouteReachabilityObservations.length,
      runtimeRouteChunkAvailabilityObservations:
        input.runtimeEvidenceStage
          .runtimeRouteChunkAvailabilityObservations.length,
      routeEvidenceSatisfied:
        input.gameplayIntentRuntime.routeStallAssessments.reduce(
          (sum, item) =>
            sum + item.evidencePlan.satisfied.length,
          0,
        ),
      routeInstrumentationRequired:
        input.gameplayIntentRuntime.routeStallAssessments.reduce(
          (sum, item) =>
            sum + item.evidencePlan.instrumentation.length,
          0,
        ),
      routeProbeRequests:
        input.gameplayIntentRuntime.routeStallAssessments.reduce(
          (sum, item) =>
            sum + item.evidencePlan.runtimeProbeRequests.length,
          0,
        ),
      routeEvidenceBlocked:
        input.gameplayIntentRuntime.routeStallAssessments.reduce(
          (sum, item) =>
            sum + item.evidencePlan.blocked.length,
          0,
        ),
      stallTargetNearestMatch:
        input.gameplayIntentRuntime
          .stallTargetNearestMatch,
      stallTargetNearestDivergence:
        input.gameplayIntentRuntime
          .stallTargetNearestDivergence,
      stallAmbiguous:
        input.gameplayIntentRuntime.stallAmbiguous,
      stallUnresolved:
        input.gameplayIntentRuntime.stallUnresolved,
      stallRouteContextIncomplete:
        input.gameplayIntentRuntime.routeStallAssessments.filter(
          (item) =>
            item.investigationDirection ===
            "route-context-incomplete",
        ).length,
      stallTargetAssignmentDivergence:
        input.gameplayIntentRuntime.routeStallAssessments.filter(
          (item) =>
            item.investigationDirection ===
            "target-assignment-divergence",
        ).length,
      stallRouteChunkUnavailable:
        input.gameplayIntentRuntime.routeStallAssessments.filter(
          (item) =>
            item.investigationDirection ===
            "route-chunk-unavailable",
        ).length,
      stallRouteUnreachable:
        input.gameplayIntentRuntime.routeStallAssessments.filter(
          (item) =>
            item.investigationDirection ===
            "route-unreachable",
        ).length,
      stallNavigationTargetDivergence:
        input.gameplayIntentRuntime.routeStallAssessments.filter(
          (item) =>
            item.investigationDirection ===
            "navigation-target-divergence",
        ).length,
      stallEntityAiStackIncomplete:
        input.gameplayIntentRuntime.routeStallAssessments.filter(
          (item) => item.investigationDirection === "entity-ai-stack-incomplete",
        ).length,
      stallNavigationRuntimeSuspect:
        input.gameplayIntentRuntime.routeStallAssessments.filter(
          (item) =>
            item.investigationDirection ===
            "navigation-runtime-suspect",
        ).length,
      stallEvidenceIncomplete:
        input.gameplayIntentRuntime.routeStallAssessments.filter(
          (item) =>
            item.investigationDirection ===
            "evidence-incomplete",
        ).length,
      routeSupportedCandidates:
        input.gameplayIntentRuntime.routeStallAssessments.reduce(
          (sum, item) =>
            sum +
            item.candidateAnalysis
              .supportedCandidateIds.length,
          0,
        ),
      routeUnresolvedCandidates:
        input.gameplayIntentRuntime.routeStallAssessments.reduce(
          (sum, item) =>
            sum +
            item.candidateAnalysis
              .unresolvedCandidateIds.length,
          0,
        ),
      routeCauseSupportedStops:
        input.gameplayIntentRuntime.routeStallAssessments.filter(
          (item) =>
            item.candidateAnalysis.stopCondition ===
            "route-cause-supported",
        ).length,
      navigationRuntimeCandidateIsolatedStops:
        input.gameplayIntentRuntime.routeStallAssessments.filter(
          (item) =>
            item.candidateAnalysis.stopCondition ===
            "navigation-runtime-candidate-isolated",
        ).length,
      routeEvidenceCollectionContinuingStops:
        input.gameplayIntentRuntime.routeStallAssessments.filter(
          (item) =>
            item.candidateAnalysis.stopCondition ===
            "continue-evidence-collection",
        ).length,
    },
    semanticIr: semanticSummary,
    stateAnalysis: {
      accesses: topology.stateAccesses.length,
      broadWrites: topology.broadWrites,
    },
    structureRuntime: {
      loads: structureRuntime.structureLoads.length,
      resolvedLoads:
        structureRuntime.correlations.filter(
          (item) => item.status === "resolved",
        ).length,
      unresolvedLoads:
        structureRuntime.unresolvedStructureLoads,
      scriptLoads: scriptStructureLoads.length,
      resolvedScriptLoads:
        scriptStructureLoads.filter(
          (item) => item.status === "resolved",
        ).length,
      unresolvedScriptLoads:
        scriptStructureLoads.filter(
          (item) => item.status !== "resolved",
        ).length,
      probabilisticLoads:
        structureRuntime
          .probabilisticStructureLoads,
      runtimeLogicLoads:
        structureRuntime.runtimeLogicStructureLoads,
      tickingAreas:
        structureRuntime.chunkLifecycleEvidence
          .tickingAreas,
      preloadedTickingAreas:
        structureRuntime.chunkLifecycleEvidence
          .preloadedTickingAreas,
      areaLoadedSchedules:
        structureRuntime.chunkLifecycleEvidence
          .areaLoadedSchedules,
      embeddedCommandBlocks:
        parsedStructureModels.reduce(
          (sum, item) =>
            sum + item.embeddedCommands.length,
          0,
        ),
      unknownEmbeddedCommandEffects:
        parsedStructureModels.reduce(
          (sum, item) =>
            sum +
            item.embeddedCommands.reduce(
              (inner, command) =>
                inner + command.unknownEffects,
              0,
            ),
          0,
        ),
      queuedTickPositions:
        parsedStructureModels.reduce(
          (sum, item) =>
            sum + item.queuedTickPositions,
          0,
        ),
      structureTransitions:
        structureRuntime
          .structureTransitionResidue
          .length,
      analyzedStructureTransitions:
        structureRuntime
          .structureTransitionResidue
          .filter(
            (item) =>
              item.status === "analyzed",
          )
          .length,
      incompleteStructureTransitions:
        structureRuntime
          .structureTransitionResidue
          .filter(
            (item) =>
              item.status === "incomplete",
          )
          .length,
      preservedByVoidCells:
        structureRuntime
          .structureTransitionResidue
          .reduce(
            (sum, item) =>
              sum +
              item.preservedByVoid,
            0,
          ),
      explicitlyClearedTransitionCells:
        structureRuntime
          .structureTransitionResidue
          .reduce(
            (sum, item) =>
              sum +
              item.explicitlyCleared,
            0,
          ),
      replacedTransitionCells:
        structureRuntime
          .structureTransitionResidue
          .reduce(
            (sum, item) =>
              sum +
              item.replaced,
            0,
          ),
      structureTransitionResidue:
        structureRuntime
          .structureTransitionResidue
          .map((item) => ({
            functionId:
              item.functionId,
            previousTarget:
              item.previousTarget,
            nextTarget:
              item.nextTarget,
            ...(item.previousLine === undefined
              ? {}
              : {
                  previousLine:
                    item.previousLine,
                }),
            ...(item.nextLine === undefined
              ? {}
              : {
                  nextLine:
                    item.nextLine,
                }),
            status: item.status,
            preservedByVoid:
              item.preservedByVoid,
            explicitlyCleared:
              item.explicitlyCleared,
            replaced:
              item.replaced,
            reasons: [
              ...item.reasons,
            ],
          })),
      educationSpecialtyBlocks,
      structurePlacements:
        structureRuntime.absoluteStructurePlacements,
      absoluteLoadDestinations:
        structureRuntime.absoluteLoadDestinations,
      placedEmbeddedCommands,
    },
    topologyAnalysis: {
      resolvedSpatialEffects:
        topology.resolvedSpatialEffects.length,
      repeatedCandidates:
        topology.candidates.length,
      linearOutliers:
        topology.linearOutliers.length,
    },
    routeAnalysis: {
      contracts:
        effectiveRouteCorridors.length,
      explicitContracts:
        input.target.routeCorridors?.length ?? 0,
      derivedContracts:
        derivedGameplayRouteCorridors.length,
      effectiveContracts:
        effectiveRouteCorridors.length,
      overlaps: routeCorrelations.filter(
        (item) => item.status === "overlap",
      ).length,
      dimensionUnresolved:
        routeCorrelations.filter(
          (item) =>
            item.status ===
            "dimension-unresolved",
        ).length,
    },
    mutationTransactions:
      transactionSummary(
        mutationTransactions.assessments,
      ),
    scriptMutationTransactions:
      transactionSummary(
        scriptMutationTransactions,
      ),
    scriptCommandTransactions:
      transactionSummary(
        scriptCommandTransactions,
      ),
    reliability: {
      fingerprintId: reliability.id,
      fingerprint: reliability.fingerprint,
    },
    decisionBasis,
    repairCandidates: planInspectionRepairs(
      topology,
      input.sourceFingerprint,
    ),
    targetCompatibility: {
      edition:
        input.target.edition ?? "unknown",
      ...(input.target.version !== undefined
        ? { version: input.target.version }
        : {}),
      educationFeatures:
        input.target.edition === undefined &&
        input.target.educationFeatures === undefined
          ? "unknown"
          : targetEducation.educationFeatures,
      ...(targetEducation.eduLevel !== undefined
        ? { eduLevel: targetEducation.eduLevel }
        : {}),
    },
    diagnostics: [...input.diagnostics],
    unresolvedReferences: discoveryUnresolvedReferences,
  };
}
