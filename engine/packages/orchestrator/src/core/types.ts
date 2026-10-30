import type { MinecraftEdition } from "../../../compatibility/src/index.js";
import type { ScriptWaveStage, ScriptAuthoredGameplayEntry, ScriptAuthoredContentCollection } from "../../../../analyzers/scripts/src/index.js";
import type { CombatBehaviorContract, CombatPolicy, EconomyBehaviorContract, EconomyPolicy, InventoryItemBehaviorContract, InventoryItemPolicy, SpatialAuthorityPolicy } from "../../../behavior-model/src/index.js";
import type { EducationFeatureState } from "../../../compatibility/src/index.js";
import type { DiagnosticFinding } from "../../../diagnostics/src/index.js";
import type { MapCompatibilityFingerprint } from "../../../reliability/src/index.js";
import type { AnalysisKnowledgeDomain } from "../../../analysis-planner/src/index.js";
import type { InspectionRepairCandidate } from "../repair-planning.js";
import type { ScriptApiUsageInventory } from "../script-api-usage.js";
import type { ArenaRegionContract, RouteCorridorContract, RouteNavigationEnvironmentContract, FileInventoryEntry } from "../../../project-model/src/index.js";
import type { StateAuthorityContract } from "../../../project-model/src/index.js";
import type { MutationDependentActionContract } from "../../../project-model/src/index.js";
import type { CausalChain, CausalIncident } from "../../../project-model/src/index.js";
import type { TelemetryEvent } from "../../../project-model/src/index.js";
import type { RuntimeProbeResponse } from "../../../project-model/src/index.js";
import type { DiagnosticProbeAnalysis } from "../diagnostic-probe-analysis.js";
import type { RuntimeEvidenceIntegrityReport } from "../../../project-model/src/index.js";
import type { DecisionBasisRevision } from "../../../project-model/src/index.js";
import type { EvidenceRecoveryPlan } from "../evidence-recovery.js";
import type { GameplayIntentModel } from "../../../gameplay-intent/src/index.js";
import type { SemanticIr } from "../../../semantic-ir/src/index.js";
import type { ArenaRegionClassification, ArenaRegionPartitionResult, ArenaRegionPlan, ArenaReplicaDiscovery, ArenaSpatialLayout, ResolvedEffect } from "../../../../analyzers/topology/src/index.js";
import type { ArenaNativeSpatialAudit } from "../arena-native-extraction.js";
import type { ArenaVoxelProof, ArenaBarrierEnclosureProof } from "../arena-voxel-proof.js";
import type { ArenaBlockEntityProof } from "../arena-block-entity-proof.js";
import type { ArenaStructureInstanceProof } from "../arena-structure-instance-proof.js";
import type { ArenaEntityPopulationProof } from "../arena-entity-population-proof.js";
import type { ArenaActorPopulationProof } from "../arena-actor-population-proof.js";
import type { ArenaTickStateProof } from "../arena-tick-state-proof.js";
import type { PersistedPackIdentityExtraction } from "../persisted-pack-identity.js";
import type { ArenaProofCoverageReport } from "../arena-proof-coverage.js";
import type { ArenaProofConclusionReport } from "../arena-proof-conclusion.js";
import type { ArenaReplicaProofQuality } from "../arena-replica-proof-quality.js";
import type { ArenaCapacityExtractionResult } from "../arena-capacity-extraction.js";
import type { ScriptSafeConfigAnalysis } from "../script-safe-config-analysis.js";
import type { ArenaLayoutReconciliation } from "../arena-layout-reconciliation.js";
import type { ArenaLifecycleAnalysis } from "../arena-lifecycle-analysis.js";
import type { ArenaCleanupSurfaceAnalysis } from "../arena-cleanup-surface-analysis.js";
import type { ArenaStateIsolationAnalysis } from "../arena-state-isolation-analysis.js";
import type { ArenaGlobalStateAnalysis } from "../arena-global-state-analysis.js";
import type { ScriptSpatialAnalysis } from "../script-spatial-analysis.js";
import type { InventoryLifecycleAnalysis } from "../inventory-lifecycle-analysis.js";
import type { InventoryContractAnalysis } from "../inventory-contract-analysis.js";
import type { InventoryRestoreOwnershipAnalysis } from "../inventory-restore-ownership-analysis.js";
import type { ReleaseIdentityAnalysis } from "../release-identity-analysis.js";
import type { EntityAiStackAnalysis } from "../entity-ai-stack-analysis.js";
import type { EntityPopulationSourceAnalysis } from "../inspection/entity-population-analysis.js";
import type { InteractionLifecycleAnalysis } from "../inspection/interaction-lifecycle-analysis.js";
import type { RouteNavigationEnvironmentAnalysis } from "../route-navigation-environment-analysis.js";
import type { CombatLifecycleAnalysis } from "../combat-lifecycle-analysis.js";
import type { CombatRuntimeTelemetryAnalysis } from "../combat-runtime-telemetry-analysis.js";
import type { CombatBehaviorContractAnalysis } from "../combat-contract-analysis.js";
import type { ChunkLifecycleAnalysis } from "../chunk-lifecycle-analysis.js";
import type { RewardSourceAnalysis } from "../reward-source-analysis.js";
import type { EconomyBehaviorContractAnalysis } from "../economy-contract-analysis.js";
import type { SpatialAuthorityCoverageReport, SpatialAuthorityCoverageRequirement } from "../spatial-authority-analysis.js";
import type { WorldRuleAuthorityAnalysis } from "../inspection/world-rule-authority-analysis.js";
import type { PlayerCapabilitySurfaceAnalysis } from "../inspection/player-capability-surface-analysis.js";
import type { ClientMutationReconciliationAnalysis } from "../inspection/client-mutation-reconciliation-analysis.js";
import type { CapabilityMutationFootprintAnalysis } from "../inspection/capability-mutation-footprint-analysis.js";
import type { GameplayWorldModel } from "../gameplay-world-model.js";
import type { GameplaySemanticModel } from "../gameplay-semantic-model.js";
import type { MapEngineeringAssessment } from "../map-engineering-assessment.js";
import type { HiddenGameplayDefectAnalysis } from "../inspection/hidden-gameplay-defect-analysis.js";
import type { GameplayBoundaryRegistry } from "../inspection/gameplay-boundary-registry.js";
import type { InspectionEngineeringAnalysis } from "../inspection/engineering-analysis-stage.js";
import type { MultiplayerStateValidationPlan } from "../inspection/multiplayer-state-validation.js";
import type { DeveloperToolReleaseAnalysis } from "../inspection/developer-tool-release-analysis.js";
import type { GameplayReachabilityGraph } from "../../../diagnostic-reasoning/src/index.js";
import type { CapabilityExposureSummary } from "../inspection/capability-exposure-stage.js";
import type { AuditRiskAssessment } from "../../../diagnostic-reasoning/src/index.js";
import type { GameplayDiscoveryClosure } from "../inspection/gameplay-discovery-closure.js";
import type { MandatoryAuditProcedureReceipt } from "../inspection/mandatory-audit-procedure.js";
import type { ArenaStressPlan } from "../arena-stress-plan.js";
import type { ArenaRepeatedRunValidationPlan } from "../arena-repeated-run-validation.js";
import type { ArenaAuthoredSpatialSource } from "../arena-authored-source-index.js";
import type { ArenaRepairLocalization } from "../arena-repair-localization.js";
import type { ArenaRepairBridge } from "../arena-repair-bridge.js";
import type { ArenaProofExecutionMode, ArenaProofExecutionPlan } from "../arena-proof-execution-plan.js";
import type {
  GameplayIntentRouteRuntimeAssessment,
  GameplayIntentRuntimeAssessment,
  GameplayRouteStallRuntimeAssessment,
} from "../gameplay-intent-runtime-stage.js";

export interface InspectTargetProfile {
  edition?: MinecraftEdition;
  version?: string;
  educationFeatures?: Exclude<EducationFeatureState, "unknown">;
  eduLevel?: number;
  experiments?: readonly string[];
  routeCorridors?: readonly RouteCorridorContract[];
  routeNavigationEnvironments?: readonly RouteNavigationEnvironmentContract[];
  arenaRegionContracts?: readonly ArenaRegionContract[];
  spatialAuthorityContract?: SpatialAuthorityPolicy;
  /** @deprecated Use spatialAuthorityContract. */
  spatialAuthorityPolicy?: SpatialAuthorityPolicy;
  spatialAuthorityRequirements?: readonly SpatialAuthorityCoverageRequirement[];
  mutationDependentActions?: readonly MutationDependentActionContract[];
  stateAuthorityContracts?: readonly StateAuthorityContract[];
  contractSourceRoots?: readonly string[];
  staticExecutionDimension?: string;
  releaseVersion?: string;
  /**
   * Internal/canonical demand reconciliation override. Production callers
   * normally leave this empty; runSelectedMapAudit() grows it monotonically
   * when final RIG requirements exceed preflight demand.
   */
  requiredKnowledgeDomains?: readonly AnalysisKnowledgeDomain[];
  arenaProofMode?: ArenaProofExecutionMode;
  inventoryItemContract?: InventoryItemBehaviorContract;
  combatContract?: CombatBehaviorContract;
  economyContract?: EconomyBehaviorContract;
  /** @deprecated Use inventoryItemContract. */
  inventoryItemPolicy?: InventoryItemPolicy;
  /** @deprecated Use combatContract. */
  combatPolicy?: CombatPolicy;
  /** @deprecated Use economyContract. */
  economyPolicy?: EconomyPolicy;
}

export interface InspectedPack {
  root: string;
  type: string;
  /** Actual selected-artifact manifest location; not a claimed runtime version. */
  manifestSource?: import("../../../project-model/src/index.js").SourceRef;
  uuid?: string;
  minEngineVersion?: string;
  packVersion?: string;
  educationMetadata: boolean;
  scriptModules: Array<{
    moduleName: string;
    version: string;
    track: string;
  }>;
  /** World pack-list declaration, not proof of actual runtime activation. */
  worldAttachment?: "listed" | "not-listed" | "unknown";
}

export interface InspectDirectoryResult {
  files: number;
  /**
   * Canonical selected-artifact file inventory retained for downstream
   * evidence validation. Callers must not rebuild a second inventory.
   */
  fileInventory: readonly FileInventoryEntry[];
  /** Observed source-index work only; never gameplay, proof, or full audit duration. */
  sourceIndexWork?: {
    readonly action: "PARSED" | "REUSED";
    /** Includes source indexing or cloning plus snapshot preparation, not downstream analyses. */
    readonly elapsedMs: number;
    readonly relevantFiles: number;
    readonly indexedFiles: number;
    readonly parseFailures: number;
    /** Eligible for a second pass in this one fingerprint-bound inspection. */
    readonly snapshotReusable: boolean;
    /** Source read, NBT decode and structure semantics on cold parse only.
     * Missing on reused passes and on archives with no structures.
     */
    readonly structureParseWork?: {
      readonly attemptedFiles: number;
      readonly sourceBytes: number;
      readonly elapsedMs: number;
    };
  };
  packs: InspectedPack[];
  functions: number;
  scripts: number;
  /** Extracted direct literal stage/wave recipes, not runtime waves. */
  authoredWaveStages: readonly ScriptWaveStage[];
  /** Source-labelled content catalog, not runtime activity or a genre label. */
  authoredGameplayCatalog: readonly ScriptAuthoredGameplayEntry[];
  /** Content categories and choices declared in source, NOT round delivery. */
  authoredContentCollections: readonly ScriptAuthoredContentCollection[];
  /** Navigation-only source map metadata; generated source remains authority. */
  scriptSourceMapNavigation?: readonly import(
    "../inspection/inspect-source-index.js"
  ).InspectionScriptSourceMapNavigation[];
  scriptApiUsage: ScriptApiUsageInventory;
  scriptSafeConfig: ScriptSafeConfigAnalysis;
  scriptSpatial: ScriptSpatialAnalysis;
  worldRuleAuthority: WorldRuleAuthorityAnalysis;
  playerCapabilitySurfaces: PlayerCapabilitySurfaceAnalysis;
  /** Source-only player lifecycle observations, not a tested reconnect. */
  playerSessionLifecycle?: import("../inspection/player-session-lifecycle-analysis.js").PlayerSessionLifecycleAnalysis;
  clientMutationReconciliation: ClientMutationReconciliationAnalysis;
  capabilityMutationFootprint: CapabilityMutationFootprintAnalysis;
  spatialAuthority?: SpatialAuthorityCoverageReport;
  inventoryLifecycle: InventoryLifecycleAnalysis;
  inventoryPolicy: InventoryContractAnalysis;
  inventoryRestoreOwnership: InventoryRestoreOwnershipAnalysis;
  combatLifecycle: CombatLifecycleAnalysis;
  combatRuntime: CombatRuntimeTelemetryAnalysis;
  combatPolicy: CombatBehaviorContractAnalysis;
  chunkLifecycle: ChunkLifecycleAnalysis;
  persistenceSource: import("../inspection/persistence-source-analysis.js").PersistenceSourceAnalysis;
  rewardSources: RewardSourceAnalysis;
  economyPolicy: EconomyBehaviorContractAnalysis;
  releaseIdentity: ReleaseIdentityAnalysis;
  /** @deprecated Composite compatibility view. Prefer gameplaySemantic + engineeringAssessment. */
  gameplayWorld: GameplayWorldModel;
  gameplayDiscoveryClosure:
    GameplayDiscoveryClosure;
  gameplaySemantic: GameplaySemanticModel;
  engineeringAssessment: MapEngineeringAssessment;
  hiddenGameplayDefects: HiddenGameplayDefectAnalysis;
  gameplayBoundaries: GameplayBoundaryRegistry;
  engineeringAnalyses:
    readonly InspectionEngineeringAnalysis[];
  multiplayerStateValidation:
    MultiplayerStateValidationPlan;
  developerToolRelease:
    DeveloperToolReleaseAnalysis;
  gameplayReachability:
    GameplayReachabilityGraph;
  capabilityExposure:
    CapabilityExposureSummary;
  analysisPriorities:
    readonly AuditRiskAssessment[];
  mandatoryAuditProcedure:
    MandatoryAuditProcedureReceipt;
  /**
   * Canonical Semantic IR snapshot for downstream artifact-level recomposition.
   * Do not reconstruct a second IR from summaries.
   */
  semanticIrModel: SemanticIr;
  structures: number;
  parsedStructures: number;
  entities: number;
  entityAiStack: EntityAiStackAnalysis;
  entityPopulation: EntityPopulationSourceAnalysis;
  interactionLifecycle: InteractionLifecycleAnalysis;
  routeNavigationEnvironment: RouteNavigationEnvironmentAnalysis;
  entityKnowledge: {
    analyzed: number;
    states: number;
    prerequisiteGaps: number;
    staticAnalysisLimits: number;
  };
  knowledgeRuntime: {
    enabled: boolean;
    profileResolved: boolean;
    profileSource: "target" | "education-metadata" | "unresolved";
    profileConflicts: readonly string[];
    evidenceRecords: number;
    violations: number;
    evidenceGaps: number;
    validationCases: number;
  };
  causalAnalysis: {
    chains: readonly CausalChain[];
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
    projectedRisks: number;
    corroboratedRisks: number;
    observedOutcomes: number;
    incidents: readonly CausalIncident[];
    rootCauseCandidates: number;
  };
  telemetryAnalysis: {
    events: number;
    evidenceRecords: number;
    droppedEvents: number;
    byKind: Readonly<Record<string, number>>;
    continuity: {
      sequencedEvents: number;
      unsequencedEvents: number;
      unidentifiedStreamEvents: number;
      streams: number;
      missingSequences: number;
      duplicateSequences: number;
      nonMonotonicTransitions: number;
      incomplete: boolean;
    };
  };
  runtimeProbeAnalysis: {
    responses: number;
    evidenceRecords: number;
    present: number;
    absent: number;
    unknown: number;
    failed: number;
    droppedExchanges: number;
  };
  evidenceIntegrity: {
    telemetry: RuntimeEvidenceIntegrityReport;
    runtimeProbe: RuntimeEvidenceIntegrityReport;
  };
  evidenceRecovery: EvidenceRecoveryPlan;
  diagnosticProbeAnalysis: DiagnosticProbeAnalysis;
  worldDatabase: {
    present: boolean;
    fileCount: number;
    persistedPackIdentity?: PersistedPackIdentityExtraction;
    nativeScan?: {
      status: "not-present" | "scanned" | "failed";
      entriesScanned: number;
      truncated: boolean;
      actorRecords: number;
      actorDigestRecords: number;
      actorContentFingerprint?: string;
      actorContentRecordsHashed: number;
      actorContentComplete: boolean;
      chunkRecords: number;
      blockEntityRecords: number;
      pendingTickRecords: number;
      randomTickRecords: number;
      finalizedStateRecords: number;
      subChunkRecords: number;
      dimensions: number[];
      chunksObserved: number;
      chunkSignals: Array<{
        chunkX: number;
        chunkZ: number;
        dimensionId: number;
        kinds: string[];
      }>;
      chunkSignalsTruncated: boolean;
      chunkContentObservations?: Array<{
        chunkX: number;
        chunkZ: number;
        dimensionId: number;
        kind: string;
        valueHash: string;
        subChunkIndex?: number;
      }>;
      chunkContentObservationsTruncated?: boolean;
      failure?: string;
    };
  };
  arenaAnalysis: {
    autoDetected: boolean;
    discovery?: ArenaReplicaDiscovery;
    spatialLayout?: ArenaSpatialLayout;
    regionPlan?: ArenaRegionPlan;
    regionClassification?: ArenaRegionClassification;
    proofPartition?: ArenaRegionPartitionResult;
    proofCoverage?: ArenaProofCoverageReport;
    proofConclusion?: ArenaProofConclusionReport;
    replicaProofQuality?: readonly ArenaReplicaProofQuality[];
    capacity?: ArenaCapacityExtractionResult;
    layoutReconciliation?: ArenaLayoutReconciliation;
    lifecycle?: ArenaLifecycleAnalysis;
    cleanupSurfaces?: ArenaCleanupSurfaceAnalysis;
    stateIsolation?: ArenaStateIsolationAnalysis;
    globalState?: ArenaGlobalStateAnalysis;
    stressPlan?: ArenaStressPlan;
    repeatedRunPlan?: ArenaRepeatedRunValidationPlan;
    authoredSources?: readonly ArenaAuthoredSpatialSource[];
    repairLocalization?: ArenaRepairLocalization;
    repairBridge?: ArenaRepairBridge;
    proofExecution?: ArenaProofExecutionPlan;
    nativeSpatial?: ArenaNativeSpatialAudit;
    voxelProof?: ArenaVoxelProof;
    barrierEnclosureProof?: ArenaBarrierEnclosureProof;
    blockEntityProof?: ArenaBlockEntityProof;
    structureInstanceProof?: ArenaStructureInstanceProof;
    entityPopulationProof?: ArenaEntityPopulationProof;
    actorPopulationProof?: ArenaActorPopulationProof;
    tickStateProof?: ArenaTickStateProof;
    entitySpawnEvidence?: readonly Extract<ResolvedEffect, { kind: "entity-spawn" }>[];
  };
  gameplayIntent: {
    model: GameplayIntentModel;
    contractSourceFiles: number;
    nodes: number;
    authoredNodes: number;
    inferredNodes: number;
    hypothesisNodes: number;
    invariants: number;
    unknowns: number;
  };
  gameplayIntentRuntime: {
    assessments: readonly GameplayIntentRuntimeAssessment[];
    routeAssessments: readonly GameplayIntentRouteRuntimeAssessment[];
    routeStallAssessments: readonly GameplayRouteStallRuntimeAssessment[];
    designedBehavior: number;
    confirmedDefects: number;
    ambiguousIntent: number;
    insufficientEvidence: number;
    runtimeStateObservations: number;
    runtimeOutcomeObservations: number;
    runtimeRouteObservations: number;
    routeResolved: number;
    routeAmbiguous: number;
    routeUnresolved: number;
    runtimeNavigationStallObservations: number;
    runtimeNavigationTargetObservations: number;
    runtimeRouteReachabilityObservations: number;
    runtimeRouteChunkAvailabilityObservations: number;
    routeEvidenceSatisfied: number;
    routeInstrumentationRequired: number;
    routeProbeRequests: number;
    routeEvidenceBlocked: number;
    stallTargetNearestMatch: number;
    stallTargetNearestDivergence: number;
    stallAmbiguous: number;
    stallUnresolved: number;
    stallRouteContextIncomplete: number;
    stallTargetAssignmentDivergence: number;
    stallRouteChunkUnavailable: number;
    stallRouteUnreachable: number;
    stallNavigationTargetDivergence: number;
    stallEntityAiStackIncomplete: number;
    stallNavigationRuntimeSuspect: number;
    stallEvidenceIncomplete: number;
    routeSupportedCandidates: number;
    routeUnresolvedCandidates: number;
    routeCauseSupportedStops: number;
    navigationRuntimeCandidateIsolatedStops: number;
    routeEvidenceCollectionContinuingStops: number;
  };
  semanticIr: {
    executionRegions: number;
    executionEdges: number;
    unresolvedExecutionTargets: number;
    eventDispatches: number;
    deferredEdges: number;
    stateSurfaces: number;
    stateOperations: number;
    stateReads: number;
    stateWrites: number;
    stateDeletes: number;
    authorityContracts: number;
    temporalRelations: number;
    guardedDeferredRelations: number;
    unguardedDeferredRelations: number;
  };
  stateAnalysis: {
    accesses: number;
    broadWrites: number;
  };
  structureRuntime: {
    loads: number;
    resolvedLoads: number;
    unresolvedLoads: number;
    scriptLoads: number;
    resolvedScriptLoads: number;
    unresolvedScriptLoads: number;
    probabilisticLoads: number;
    runtimeLogicLoads: number;
    tickingAreas: number;
    preloadedTickingAreas: number;
    areaLoadedSchedules: number;
    embeddedCommandBlocks: number;
    unknownEmbeddedCommandEffects: number;
    queuedTickPositions: number;
    structureTransitions: number;
    analyzedStructureTransitions: number;
    incompleteStructureTransitions: number;
    preservedByVoidCells: number;
    explicitlyClearedTransitionCells: number;
    replacedTransitionCells: number;
    structureTransitionResidue: Array<{
      functionId: string;
      previousTarget: string;
      nextTarget: string;
      previousLine?: number;
      nextLine?: number;
      status: "analyzed" | "incomplete";
      preservedByVoid: number;
      explicitlyCleared: number;
      replaced: number;
      reasons: readonly string[];
    }>;
    educationSpecialtyBlocks: {
      allow: number;
      deny: number;
      border: number;
    };
    structurePlacements: Array<{
      target: string;
      position?: {
        x: number;
        y: number;
        z: number;
      };
      options: Readonly<Record<string, unknown>>;
      functionId: string;
      line?: number;
    }>;
    absoluteLoadDestinations: Array<{
      target: string;
      chunkX: number;
      chunkZ: number;
      functionId: string;
      line?: number;
    }>;
    placedEmbeddedCommands: Array<{
      target: string;
      flatIndex: number;
      worldX: number;
      worldY: number;
      worldZ: number;
      chunkX: number;
      chunkZ: number;
      command: string;
      confidence: "inferred-transform";
    }>;
    nativeChunkCorrelations?: Array<{
      target: string;
      chunkX: number;
      chunkZ: number;
      matches: Array<{
        dimensionId: number;
        kinds: string[];
      }>;
    }>;
    embeddedCommandNativeCorrelations?: Array<{
      target: string;
      flatIndex: number;
      worldX: number;
      worldY: number;
      worldZ: number;
      chunkX: number;
      chunkZ: number;
      command: string;
      confidence: "inferred-transform";
      matches: Array<{
        dimensionId: number;
        kinds: string[];
        hasBlockEntityEvidence: boolean;
        hasPendingTickEvidence: boolean;
        hasRandomTickEvidence: boolean;
      }>;
    }>;
  };
  topologyAnalysis: {
    resolvedSpatialEffects: number;
    repeatedCandidates: number;
    linearOutliers: number;
  };
  routeAnalysis: {
    contracts: number;
    explicitContracts: number;
    derivedContracts: number;
    effectiveContracts: number;
    overlaps: number;
    dimensionUnresolved: number;
  };
  mutationTransactions: {
    assessed: number;
    verifiedBeforeDependent: number;
    dependentBeforeVerification: number;
    verificationUnresolved: number;
    noDependentAction: number;
  };
  scriptMutationTransactions: {
    assessed: number;
    verifiedBeforeDependent: number;
    dependentBeforeVerification: number;
    verificationUnresolved: number;
    noDependentAction: number;
  };
  scriptCommandTransactions: {
    assessed: number;
    verifiedBeforeDependent: number;
    dependentBeforeVerification: number;
    verificationUnresolved: number;
    noDependentAction: number;
  };
  reliability: {
    fingerprintId: string;
    fingerprint: MapCompatibilityFingerprint;
  };
  decisionBasis: DecisionBasisRevision;
  repairCandidates: InspectionRepairCandidate[];
  targetCompatibility: {
    edition: MinecraftEdition | "unknown";
    version?: string;
    educationFeatures: EducationFeatureState;
    eduLevel?: number;
  };
  diagnostics: DiagnosticFinding[];
  unresolvedReferences: number;
}


export interface InspectEvidenceInput {
  records?: readonly import("../../../project-model/src/index.js").RuntimeEvidenceRecord[];
  telemetryEvents?: readonly TelemetryEvent[];
  runtimeProbeResponses?: readonly RuntimeProbeResponse[];
}
