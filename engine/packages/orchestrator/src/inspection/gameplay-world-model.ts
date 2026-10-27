import {
  assessGameplayModelClosure,
  assessGameplayStateClosure,
  buildIntentClosureSurfaces,
  type GameplayClosureSurface,
  type GameplayIntentModel,
  type GameplayIntentNodeKind,
  type GameplayModelClosureResult,
} from "../../../gameplay-intent/src/index.js";
import type {
  ArenaCapacityExtractionResult,
} from "../arena/arena-capacity-extraction.js";
import type {
  ArenaCleanupSurfaceAnalysis,
} from "../arena/arena-cleanup-surface-analysis.js";
import type {
  ArenaLayoutReconciliation,
} from "../arena/arena-layout-reconciliation.js";
import type {
  ArenaLifecycleAnalysis,
} from "../arena/arena-lifecycle-analysis.js";
import type {
  ArenaProofConclusionReport,
} from "../arena/arena-proof-conclusion.js";
import type {
  ArenaStateIsolationAnalysis,
} from "../arena/arena-state-isolation-analysis.js";
import type {
  ArenaGlobalStateAnalysis,
} from "../arena/arena-global-state-analysis.js";
import type {
  ArenaStressPlan,
} from "../arena/arena-stress-plan.js";
import type {
  ArenaProofExecutionPlan,
} from "../arena/arena-proof-execution-plan.js";
import type {
  ArenaRepeatedRunValidationPlan,
} from "../arena/arena-repeated-run-validation.js";
import type {
  ArenaReplicaProofQuality,
} from "../arena/arena-replica-proof-quality.js";
import type {
  ScriptSpatialAnalysis,
} from "./script-spatial-analysis.js";
import type {
  EntityAiStackAnalysis,
} from "./entity-ai-stack-analysis.js";
import type {
  RouteNavigationEnvironmentAnalysis,
} from "./route-navigation-environment-analysis.js";
import type {
  CombatLifecycleAnalysis,
} from "./combat-lifecycle-analysis.js";
import type {
  CombatRuntimeTelemetryAnalysis,
} from "./combat-runtime-telemetry-analysis.js";
import type {
  CombatBehaviorContractAnalysis,
} from "./combat-contract-analysis.js";
import type {
  ChunkLifecycleAnalysis,
} from "./chunk-lifecycle-analysis.js";
import type {
  RewardSourceAnalysis,
  RewardSourceKind,
} from "./reward-source-analysis.js";
import type {
  EconomyBehaviorContractAnalysis,
} from "./economy-contract-analysis.js";
import type {
  InventoryLifecycleAnalysis,
} from "./inventory-lifecycle-analysis.js";
import type {
  InventoryContractAnalysis,
} from "./inventory-contract-analysis.js";
import type {
  InventoryRestoreOwnershipAnalysis,
} from "./inventory-restore-ownership-analysis.js";
import type {
  SpatialAuthorityCoverageReport,
} from "./spatial-authority-analysis.js";
import type {
  PersistenceSourceAnalysis,
} from "./persistence-source-analysis.js";
import type {
  WorldRuleAuthorityAnalysis,
} from "./world-rule-authority-analysis.js";
import type {
  PlayerCapabilitySurfaceAnalysis,
} from "./player-capability-surface-analysis.js";
import type {
  ClientMutationReconciliationAnalysis,
} from "./client-mutation-reconciliation-analysis.js";
import type {
  CapabilityMutationFootprintAnalysis,
} from "./capability-mutation-footprint-analysis.js";
import type {
  CapabilityExposureSummary,
} from "./capability-exposure-stage.js";
import type {
  ProgressionActorAccountingAnalysis,
} from "./progression-actor-accounting-analysis.js";
import type {
  ObjectiveAuthorityAssessment,
} from "./state-authority-analysis.js";
import {
  discoverGameplaySurfaces,
  type GameplaySurfaceDiscoveryResult,
} from "./gameplay-surface-discovery.js";

export interface GameplayWorldSubjectSummary {
  kind: GameplayIntentNodeKind;
  ids: readonly string[];
  authored: number;
  inferred: number;
  hypothesis: number;
}

export interface GameplayWorldModel {
  schemaVersion: 1;
  artifactId: string;
  subjects: readonly GameplayWorldSubjectSummary[];
  surfaceDiscovery:
    GameplaySurfaceDiscoveryResult;
  gameplayClosure: GameplayModelClosureResult;
  stateClosure:
    ReturnType<typeof assessGameplayStateClosure>;
  arenas: {
    detected: boolean;
    count?: number;
    basis?: "topology" | "script-config" | "reconciled";
    replicaBaselineId?: string;
    layoutStatus?: ArenaLayoutReconciliation["status"];
    requestedConcurrentArenas?: number;
    safeConcurrentArenas?: number | null;
    declaredConcurrentArenaLimit?: number;
    perArenaPlayerCapacity?: number;
    perArenaPlayerCapacitySources?:
      NonNullable<ArenaCapacityExtractionResult["evidence"]["perArenaPlayerCapacitySources"]>;
    unresolvedRosterCapacityPaths?: number;
    declaredMaxConcurrentPlayers?: number;
    capacityOk?: boolean;
    lifecycle: {
      terminalCandidates: number;
      proven: number;
      partial: number;
      unresolved: number;
      multiIngressTerminalTargets: number;
      protectedTerminalRaces: number;
      provenTerminalRaces: number;
      unresolvedTerminalRaces: number;
      terminalPrecedenceProven: number;
      terminalPrecedenceUnresolved: number;
      protectedDeferredMutations: number;
      unresolvedDeferredMutations: number;
      staleReadySnapshotRisks: number;
      readySetSnapshotRisks: readonly {
        scriptId: string;
        arenaExpression: string;
        executionRegion: string;
        snapshotExpression?: string;
      }[];
      /** Preserve the canonical lifecycle status union, including authored
       * guard/snapshot candidates. Source evidence is not runtime proof.
       * A projected subset avoids duplicating the full analyzer model.
       */
      deferredMutations: readonly Pick<
        ArenaLifecycleAnalysis["deferredMutations"][number],
        | "scriptId"
        | "scheduler"
        | "callbackRegion"
        | "mutationRegions"
        | "guardIdentifiers"
        | "status"
      >[];
      terminalRaces: readonly {
        scriptId: string;
        terminalRegion: string;
        ingresses: readonly {
          kind:
            | "event"
            | "deferred";
          id: string;
          callbackRegion: string;
          guardStatus:
            | "guarded"
            | "unguarded"
            | "not-applicable";
        }[];
        status:
          | "protected"
          | "contradicted"
          | "unresolved";
        idempotencyKind?:
          | "boolean-latch"
          | "state-latch";
        reason: string;
      }[];
      terminalIngresses: readonly {
        scriptId: string;
        terminalRegion: string;
        incomingCallerRegions: readonly string[];
        incomingControlFlows: readonly string[];
        distinctIngresses: number;
        status:
          | "single-ingress"
          | "multi-ingress";
      }[];
    };
    cleanup: {
      acquiredSurfaces: number;
      exactProven: number;
      partial: number;
      unresolved: number;
      resourceLedger: {
        resources: number;
        complete: number;
        partial: number;
        missing: number;
        coverageRatio: number;
      };
      lifecycle: {
        declared: boolean;
        complete: number;
        unresolved: number;
        assessments: readonly {
          scriptId: string;
          tableName: string;
          stateType?: string;
          status:
            | "complete"
            | "unresolved";
          missingPhases:
            readonly string[];
          orderingViolations:
            readonly string[];
          reason: string;
        }[];
      };
    };
    isolation: {
      isolated: number;
      partitionProofRequired: number;
      sharedGlobal: number;
      unknown: number;
      observations: readonly {
        scriptId: string;
        region: string;
        key: string;
        surface: ArenaStateIsolationAnalysis["observations"][number]["surface"];
        scope: ArenaStateIsolationAnalysis["observations"][number]["scope"];
        status:
          | "isolated"
          | "partition-proof-required"
          | "shared-global"
          | "unknown";
        reason: string;
        sourcePath: string | null;
        /** Exact operation site when the parser supplied a source range. */
        sourceLocator?: string | null;
      }[];
    };
    globalState: {
      arenaScopedMutations: number;
      pairedLeaseEvidence: number;
      unleasedArenaMutations: number;
      unauditedArenaMutations: number;
      mutations: readonly {
        id: string;
        ownerId: string;
        resource: string;
        arenaScoped: boolean;
      }[];
      assessments: readonly {
        mutationId: string;
        resource: string;
        status:
          | "paired-lease-evidence"
          | "partial-lease-evidence"
          | "unleased"
          | "unscoped";
        audited: boolean;
      }[];
    };
    stress: {
      status: "planned" | "unavailable";
      totalNominalPlayers?: number;
      scenarios?: number;
    };
    repeatedRun?: {
      runCounts: readonly number[];
      stages: number;
      compareSurfaces: readonly string[];
    };
    proofExecution?: {
      mode: ArenaProofExecutionPlan["mode"];
      executedLayers: readonly string[];
      skippedLayers: readonly string[];
    };
    proof?: ArenaProofConclusionReport["conclusion"];
    barrierContainment: {
      status:
        | "contained"
        | "open-or-unproven"
        | "incomplete"
        | "budget-exceeded"
        | "not-run";
      contained: number;
      openOrUnproven: number;
      incomplete: number;
      budgetExceeded: number;
    };
    replicaIntegrity: {
      complete: number;
      bounded: number;
      diverged: number;
      incomplete: number;
      noProof: number;
    };
    replicaProof: readonly {
      arenaId: string;
      status:
        | "complete-proof"
        | "bounded-proof"
        | "diverged"
        | "incomplete-proof"
        | "budget-exceeded"
        | "no-proof";
      mismatchCount: number;
      unresolvedBlocks: number;
      evidenceIds: readonly string[];
    }[];
  };
  spatial: {
    resolvedScriptEffects: number;
    structurePlacements: number;
    unresolvedScriptMutations: number;
    rejectedScriptMutations: number;
    authority: {
      configured: boolean;
      policyValid: boolean;
      resolved: number;
      uncovered: number;
      conflicts: number;
      unknownRegions: number;
    };
  };
  persistence?: {
    properties: number;
    appendWithoutClear: number;
    worldScopedAppendWithoutClear: number;
    unknownScope: number;
    unknownLifetime: number;
    resultAuditRecords: number;
    completeResultAuditRecords: number;
    partialResultAuditRecords: number;
    resultAuditRecordDetails: readonly {
      scriptId: string;
      propertyKey: string;
      status:
        | "complete"
        | "partial";
      semanticFields:
        readonly string[];
      missingRequiredFields:
        readonly string[];
    }[];
    reconnectTransientRestoreRiskCount: number;
    reconnectTransientRestoreRisks: readonly {
      scriptId: string;
      propertyId: string;
      lifecycleEvent:
        | "playerJoin"
        | "playerSpawn";
      callbackRegion: string;
      scope:
        | "arena"
        | "session";
      reason: string;
    }[];
    propertiesDetail: readonly {
      scriptId: string;
      propertyId: string;
      growth: "append-without-clear" | "append-with-clear" | "no-append" | "unknown";
      scope: "player" | "entity" | "arena" | "session" | "world" | "unknown";
      lifetime: "round" | "match" | "player-session" | "world" | "unknown";
    }[];
  };
  chunks: {
    worldLoadObservers: number;
    entityLoadObservers: number;
    entityRemoveObservers: number;
    readinessProbes: number;
    tickingAreaReadinessStates: number;
    tickingAreaAcquires: number;
    tickingAreaReleases: number;
    pairedLeases: number;
    acquireWithoutRelease: number;
    releaseUnreachable: number;
    cleanupOrderUnproven: number;
    dynamicLeaseKeys: number;
    capacityUncheckedLeases: number;
    readinessUnverifiedLeases: number;
    shutdownOnlyCleanupRisk: number;
    worldLoadReconciliationPaths: number;
    unguardedDeferredChunkWork: number;
    zeroTickDeferredChunkWork: number;
    spawnRecoveryRoutes: number;
    unloadedSpecificSpawnRecoveryRoutes: number;
    broadSpawnRecoveryRisks: number;
    otherSpecificSpawnRecoveryRoutes: number;
    entityRemoveTerminalizationRisks: number;
    completeResidencyStateMachines: number;
    unresolvedResidencyStateMachines: number;
    entityResidencyObservability:
      "complete" | "partial" | "absent";
    leases: readonly {
      scriptId: string;
      leaseKey?: string;
      acquireRegions: readonly string[];
      releaseRegions: readonly string[];
      capacityCheckRegions: readonly string[];
      status:
        | "paired"
        | "acquire-without-release"
        | "release-without-acquire"
        | "release-unreachable"
        | "cleanup-order-unproven"
        | "dynamic-key"
        | "capacity-unchecked"
        | "readiness-unverified";
    }[];
  };
  economy: {
    sourceKinds: readonly RewardSourceKind[];
    engineLootEntities: number;
    engineLootTables: number;
    unresolvedEngineLootTables: number;
    scriptInventoryGrants: number;
    worldDrops: number;
    pickupObservers: number;
    scriptLootCommands: number;
    functionLootCommands: number;
    scoreboardCredits: number;
    scoreboardDebits: number;
    scoreboardAdjustments: number;
    scoreboardWrites: number;
    deathRewardPaths: number;
    pickupCurrencyPaths: number;
    deathRewardSourceOverlapCandidates: number;
    deathRewardSourceOverlapUnresolved: number;
    pickupCurrencyWithoutConsumeCandidates: number;
    rewardPathsWithoutIdempotency: number;
    cleanupAfterRewardJournalProven: number;
    cleanupBeforeRewardJournalRisks: number;
    cleanupRewardJournalOrderingUnresolved: number;
    dropCleanupSurfaces: number;
    worldDropRewardPathsWithoutCleanup: number;
    policy: {
      configured: boolean;
      deathRewardOverlapContractConflicts: number;
      deathRewardOverlapUnresolved: number;
      pickupCurrencyConsumeCoverageGaps: number;
      pickupCurrencyContractMismatch: number;
      idempotencyCoverageGaps: number;
      staleDropCleanupCoverageGaps: number;
      inventoryFullContractGaps: number;
      pickupScopeValidationUnproven: number;
      terminalRewardResultCommitUnproven: number;
    };
    paths: readonly {
      scriptId: string;
      trigger: "death" | "pickup";
      callbackRegion: string;
      reachableRegions: readonly string[];
      inventoryGrants: number;
      worldDrops: number;
      lootCommands: number;
      scoreCredits: number;
      scoreWrites: number;
      itemConsumes: number;
      idempotencyGuards: number;
      cleanupReleases: number;
      rewardCleanupOrdering:
        | "proven-after-journal"
        | "contradicted-before-journal"
        | "unresolved"
        | "not-applicable";
    }[];
  };
  progression: {
    actorAccounting: {
      counters: number;
      provenMissingReconciliation: number;
      provenActorIdentityMismatch: number;
      provenSpawnQuantityMismatch: number;
      deferredSpawnAccountingGaps: number;
      generationBoundRegistryAuthorities: number;
      unboundRegistryAuthorities: number;
      unresolvedRegistryAuthorities: number;
      registryAuthorityAssessments: readonly {
        scriptId: string;
        registryExpression: string;
        actorIdentifiers: readonly string[];
        materializePaths: number;
        lifecycleReleasePaths: number;
        completionChecks: number;
        generationBound: boolean;
        status:
          | "generation-bound-authoritative"
          | "generation-unbound"
          | "incomplete";
        reason: string;
      }[];
      scriptedRemovalCoverageGaps: number;
      terminalOnlyScriptedRemovalCounters: number;
      nonTerminalScriptedRemovalCounters: number;
      provenImmediateDespawnWithoutReconciliation: number;
      conditionalDespawnUnknowns: number;
      reachableConditionalDespawnCounters: number;
      terminalOnlyConditionalDespawnCounters: number;
      inactiveConditionalDespawnCounters: number;
      provenActiveInstantDespawnWithoutReconciliation: number;
      activeInterproceduralProofs: number;
      activeTransitionProofs: number;
      declaredActiveStateAliases: number;
      validStateTransitions: number;
      invalidStateTransitions: number;
      unresolvedStateTransitions: number;
      completeStateMachines: number;
      deadEndStateMachines: number;
      unresolvedStateMachines: number;
      sourceEnteredDeadEndStates: number;
      duplicateProgressionAdvances: number;
      provenCrossIngressOrdinalAdvances: number;
      idempotentCrossIngressEffectCalls: number;
      provenCrossIngressEffectCalls: number;
      unresolvedCrossIngressEffectCalls: number;
      crossIngressEffectCalls: readonly {
        scriptId: string;
        ingress: string;
        target: string;
        callbackRegions:
          readonly string[];
        status:
          | "idempotent"
          | "contradicted"
          | "unresolved";
        directOrdinalAmount: number;
        idempotencyKind?:
          | "boolean-latch"
          | "state-latch";
        reason: string;
      }[];
      crossIngressOrdinalAdvances: readonly {
        scriptId: string;
        ingress: string;
        target: string;
        callbackRegions:
          readonly string[];
        totalAmount: number;
        reason: string;
      }[];
      progressionAdvances: readonly {
        scriptId: string;
        executionRegion: string;
        counterId: string;
        effectTarget: string;
        calls: number;
        status:
          | "single"
          | "duplicate";
        reason: string;
      }[];
      stateMachines: readonly {
        scriptId: string;
        tableName: string;
        stateType?: string;
        status:
          | "complete"
          | "dead-end"
          | "unresolved";
        activeStates:
          readonly string[];
        terminalStates:
          readonly string[];
        deadEndStates:
          readonly string[];
        sourceEnteredDeadEndStates:
          readonly string[];
        reason: string;
      }[];
      stateTransitions: readonly {
        scriptId: string;
        target: string;
        from: string;
        to: string;
        tableName?: string;
        status:
          | "valid"
          | "invalid"
          | "unresolved";
        allowedTargets:
          readonly string[];
        reason: string;
      }[];
      unresolvedCounters: number;
      reconciledFromMatchedActorLifecycle: number;
      details: readonly {
        scriptId: string;
        counterId: string;
        kind: "variable" | "scoreboard";
        growthWrites: number;
        decrementWrites: number;
        replacementWrites: number;
        completionChecks: number;
        lifecycleLinkedDecrements: number;
        deathLinkedDecrements: number;
        removeLinkedDecrements: number;
        reconciliationLifecycleKinds:
          readonly ("death" | "remove")[];
        deathLifecycleActorIdentifiers:
          readonly string[];
        removeLifecycleActorIdentifiers:
          readonly string[];
        scriptedRemovalActorIdentifiers:
          readonly string[];
        terminalOnlyScriptedRemovalActorIdentifiers:
          readonly string[];
        nonTerminalScriptedRemovalActorIdentifiers:
          readonly string[];
        unresolvedScriptedRemovalActorIdentifiers:
          readonly string[];
        scriptedRemovalScope:
          | "terminal-only"
          | "non-terminal"
          | "unresolved"
          | "none";
        uncoveredScriptedRemovalActorIdentifiers:
          readonly string[];
        scriptedRemovalCoverage:
          | "covered"
          | "uncovered"
          | "none"
          | "unresolved";
        immediateDespawnActorIdentifiers:
          readonly string[];
        conditionalDespawnActorIdentifiers:
          readonly string[];
        reachableConditionalDespawnActorIdentifiers:
          readonly string[];
        terminalOnlyConditionalDespawnActorIdentifiers:
          readonly string[];
        inactiveConditionalDespawnActorIdentifiers:
          readonly string[];
        activeInstantDespawnActorIdentifiers:
          readonly string[];
        uncoveredActiveInstantDespawnActorIdentifiers:
          readonly string[];
        uncoveredImmediateDespawnActorIdentifiers:
          readonly string[];
        unresolvedConditionalDespawnActorIdentifiers:
          readonly string[];
        quantityComparableGrowths: number;
        quantityMatchedGrowths: number;
        quantityMismatchGrowths: number;
        spawnQuantityStatus:
          | "matched"
          | "mismatch"
          | "unresolved"
          | "not-applicable";
        actorIdentityStatus:
          | "matched"
          | "mismatch"
          | "unresolved"
          | "not-applicable";
        deferredSpawnActorIdentifiers:
          readonly string[];
        deferredSpawnCallbacks: number;
        deferredSpawnReservationStatus:
          | "covered-before-defer"
          | "unresolved"
          | "none";
        deferredSpawnGenerationStatus:
          | "generation-guarded"
          | "unresolved"
          | "none";
        deferredSpawnQuantityStatus:
          | "matched"
          | "mismatch"
          | "unresolved"
          | "none";
        spawnLinkedActorIdentifiers:
          readonly string[];
        lifecycleActorIdentifiers:
          readonly string[];
        matchedActorIdentifiers:
          readonly string[];
        status:
          | "reconciled-from-matched-actor-lifecycle"
          | "actor-identity-mismatch"
          | "spawn-quantity-mismatch"
          | "instant-despawn-without-reconciliation"
          | "active-instant-despawn-without-reconciliation"
          | "missing-reconciliation"
          | "deferred-spawn-accounting-unproven"
          | "unresolved";
      }[];
    };
  };
  combat: {
    hurtHandlers: number;
    deathHandlers: number;
    damageApplications: number;
    secondaryEffects: number;
    projectileSpawns: number;
    projectileRemovals: number;
    projectileCleanupGap: number;
    hurtOnlyTerminalRisk: number;
    policy: {
      configured: boolean;
      reviveContractContradictions: number;
      projectileCleanupContractGap: number;
      secondaryEffectEligibilitySurfaces: number;
    };
    runtime: {
      reviveAnomalies: number;
      selfRevive: number;
      multipleRevivers: number;
      staleRevive: number;
      reviveAfterDeath: number;
      invalidReviver: number;
      scopedLifeGenerationMissing: number;
      scopedArenaGenerationMissing: number;
    };
    paths: readonly {
      scriptId: string;
      event: "hurt" | "death";
      callbackRegion: string;
      reachableRegions: readonly string[];
      projectileSpawns: number;
      projectileRemovals: number;
      damageApplications: number;
    }[];
  };
  inventory: {
    regions: number;
    resetCandidates: number;
    completeResets: number;
    partialResets: number;
    copyMutationRisks: number;
    grantVerificationGaps: number;
    grantRegions: number;
    dropRegions: number;
    knownEquipmentSlots: number;
    unresolvedEquipmentSlotEvidence: number;
    restoreOwnership: {
      pathways: number;
      deterministicItemRestores: number;
      unknownIdentityGrants: number;
      multipleRestoreOwners: number;
      initialSessionDuplicateOwners: number;
      initialSessionOverlapUnresolved: number;
    };
    policy: {
      configured: boolean;
      resolvedItemClasses: number;
      uncoveredItemClasses: number;
      unknownIdentityEvidence: number;
      deniedDrops: number;
      uncoveredDrops: number;
      unknownDrops: number;
    };
    assessments: readonly {
      scriptId: string;
      executionRegion: string;
      status:
        | "complete-reset"
        | "partial-reset"
        | "copy-writeback-risk"
        | "observed";
      itemGrants: number;
      checkedItemGrants: number;
      unverifiedItemGrants: number;
      propagatedItemGrants: number;
      itemDrops: number;
    }[];
    restoreConflicts: readonly {
      lifecycleEvent: "player-spawn" | "player-join" | "entity-die";
      itemIdentifier: string;
      ownerCallbackRegions: readonly string[];
    }[];
    crossLifecycleRestoreConflicts: readonly {
      itemIdentifier: string;
      lifecycleEvents: readonly [
        "player-join",
        "player-spawn",
      ];
      ownerCallbackRegions: readonly string[];
    }[];
  };
  worldRules: {
    writes: number;
    conflicts: number;
    naturalMobSpawning:
      | "disabled"
      | "enabled"
      | "conflicted"
      | "unresolved";
    scriptSpawnEntityPaths: number;
    commandSummonPaths: number;
    manualEntitySpawnPaths: number;
  };
  clientReconciliation: {
    predictedMutationCancellations: number;
    liquidOrWaterlogCancellations: number;
    blockPlaceCancellations: number;
    blockBreakCancellations: number;
    interactionCancellations: number;
  };
  capabilityMutationFootprint: {
    broadCapabilityDetected: boolean;
    covered: number;
    partial: number;
    unresolved: number;
    surfaces: readonly {
      surface:
        | "inventory"
        | "equipment"
        | "gamemode"
        | "player-capability"
        | "world-mutation";
      status:
        | "covered"
        | "partial"
        | "unresolved";
      requiredBecause: readonly string[];
      reason: string;
    }[];
  };
  capabilityExposure: {
    exposed: number;
    potentiallyExposed: number;
    releaseBlocking: number;
    unresolved: number;
    exposures: readonly {
      capabilityId: string;
      capabilityLabel: string;
      status:
        | "blocked"
        | "guarded"
        | "exposed"
        | "potentially-exposed"
        | "unknown";
      prerequisiteReachability:
        | "reachable"
        | "unreachable"
        | "unknown"
        | "not-required";
      impact:
        | "progression"
        | "state"
        | "fairness"
        | "interaction"
        | "debug-information"
        | "cosmetic"
        | "unknown";
      evidenceIds: readonly string[];
      reasons: readonly string[];
      /** Diagnostic assessment basis, not gameplay scope or execution proof. */
      resolutionBasis?: CapabilityExposureSummary["exposures"][number]["resolutionBasis"];
    }[];
  };
  playerCapabilities: {
    gamemodeWrites: number;
    creativeModeGrants: number;
    spectatorModeGrants: number;
    abilityWrites: number;
    mayflyGrants: number;
    commandPermissionWrites: number;
    privilegedGuardReferences: number;
    privilegedBypassReturns: number;
    protectionDefinitions: number;
    inactiveProtectionDefinitions: number;
  };
  state: {
    semanticSurfaces: number;
    semanticOperations: number;
    broadWrites: number;
    objectiveAuthorities: readonly ObjectiveAuthorityAssessment[];
    declaredObjectiveAuthorities: number;
    undeclaredObjectiveAuthorities: number;
    multipleObjectiveAuthorities: number;
  };
  structures: {
    definitions: number;
    loads: number;
    unresolvedLoads: number;
    placements: number;
    runtimeLogicLoads: number;
    transitionResidueRisks: number;
    transitionResidueUnresolved: number;
    loadCorrelations: readonly {
      functionId: string;
      line?: number;
      target: string;
      status: "resolved" | "missing" | "ambiguous";
      findings: readonly string[];
    }[];
    transitionResidue: readonly {
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
    }[];
  };
  analysisDemand?: readonly import("../../../analysis-planner/src/index.js").AnalysisKnowledgeDomain[];
  platformKnowledge: {
    profileResolved: boolean;
    profileSource: "target" | "education-metadata" | "unresolved";
    claims: readonly {
      relationId: string;
      domain: string;
      kind: string;
      subject: string;
      object: string;
      status: "satisfied" | "violation" | "unknown";
      message: string;
      knowledgeSourceIds: readonly string[];
      evidenceSourceIds: readonly string[];
      sources: readonly {
        id: string;
        title: string;
        url: string;
        authority: string;
      }[];
    }[];
  };
  entities: {
    definitions: number;
    knowledgePrerequisiteGaps: number;
    staticAnalysisLimits: number;
    resolvedSpawnEvidence: number;
    aiStack: {
      states: number;
      targetedStates: number;
      targetedStackComplete: number;
      targetedStackIncomplete: number;
      navigationWithoutMovement: number;
      targetedWithoutNavigation: number;
      movementGoalWithoutNavigation: number;
      assessments: readonly {
        entityKey: string;
        stateId: string;
        status:
          | "targeted-stack-complete"
          | "targeted-stack-incomplete"
          | "untargeted-navigation"
          | "non-navigation";
        missingSurfaces: readonly string[];
      }[];
    };
    navigationEnvironment: {
      contracts: number;
      compatible: number;
      incompatible: number;
      stateDependent: number;
      unresolved: number;
      assessments: readonly {
        contractId: string;
        routeId: string;
        entityKey: string;
        status:
          | "compatible"
          | "incompatible"
          | "state-dependent"
          | "unresolved";
        reasons: readonly string[];
      }[];
    };
  };
  analysisExecution: {
    readonly executedCapabilityIds: readonly string[];
  };
  intent: {
    invariants: number;
    unknowns: readonly {
      id: string;
      question: string;
      blockedSubjectIds: readonly string[];
    }[];
  };
}

export interface GameplayWorldModelSource {
  artifactId: string;
  intent: GameplayIntentModel;
  arena: {
    autoDetected: boolean;
    spatialLayout?: {
      basis: "topology" | "script-config" | "reconciled";
      canonical?: {
        arenaId: string;
      };
      replicas: readonly unknown[];
    };
    discovery?: {
      replicas: readonly unknown[];
    };
    layoutReconciliation?: ArenaLayoutReconciliation;
    capacity?: ArenaCapacityExtractionResult;
    lifecycle?: ArenaLifecycleAnalysis;
    cleanupSurfaces?: ArenaCleanupSurfaceAnalysis;
    stateIsolation?: ArenaStateIsolationAnalysis;
    globalState?: ArenaGlobalStateAnalysis;
    stressPlan?: ArenaStressPlan;
    repeatedRunPlan?:
      ArenaRepeatedRunValidationPlan;
    proofExecution?: ArenaProofExecutionPlan;
    proofConclusion?: ArenaProofConclusionReport;
    barrierEnclosureProof?: import("../arena/arena-voxel-proof.js").ArenaBarrierEnclosureProof;
    replicaProofQuality?:
      readonly ArenaReplicaProofQuality[];
    entitySpawnEvidence?: readonly unknown[];
  };
  scriptSpatial: ScriptSpatialAnalysis;
  spatialAuthority?: SpatialAuthorityCoverageReport;
  combatLifecycle?: CombatLifecycleAnalysis;
  progressionActorAccounting?:
    ProgressionActorAccountingAnalysis;
  combatRuntime?: CombatRuntimeTelemetryAnalysis;
  combatPolicy?: CombatBehaviorContractAnalysis;
  chunkLifecycle?: ChunkLifecycleAnalysis;
  persistenceSource?: PersistenceSourceAnalysis;
  rewardSources?: RewardSourceAnalysis;
  economyPolicy?: EconomyBehaviorContractAnalysis;
  inventoryLifecycle?: InventoryLifecycleAnalysis;
  inventoryPolicy?: InventoryContractAnalysis;
  inventoryRestoreOwnership?: InventoryRestoreOwnershipAnalysis;
  worldRuleAuthority?: WorldRuleAuthorityAnalysis;
  playerCapabilitySurfaces?: PlayerCapabilitySurfaceAnalysis;
  capabilityExposure?: CapabilityExposureSummary;
  clientMutationReconciliation?: ClientMutationReconciliationAnalysis;
  capabilityMutationFootprint?: CapabilityMutationFootprintAnalysis;
  semanticIr: {
    stateSurfaces: number;
    stateOperations: number;
  };
  objectiveAuthority?:
    readonly ObjectiveAuthorityAssessment[];
  broadWrites: number;
  structures: {
    definitions: number;
    loads: number;
    unresolvedLoads: number;
    placements: number;
    runtimeLogicLoads: number;
    transitionResidueRisks?: number;
    transitionResidueUnresolved?: number;
    loadCorrelations?: GameplayWorldModel["structures"]["loadCorrelations"];
    transitionResidue?: GameplayWorldModel["structures"]["transitionResidue"];
  };
  entityAiStack?: EntityAiStackAnalysis;
  routeNavigationEnvironment?: RouteNavigationEnvironmentAnalysis;
  analysisDemand?: readonly import("../../../analysis-planner/src/index.js").AnalysisKnowledgeDomain[];
  platformKnowledge?: {
    profileResolved: boolean;
    profileSource: "target" | "education-metadata" | "unresolved";
    claims?: GameplayWorldModel["platformKnowledge"]["claims"];
  };
  entities: {
    definitions: number;
    knowledgePrerequisiteGaps: number;
    staticAnalysisLimits: number;
  };
  boundaries?: {
    records: number;
    unresolvedNames: readonly string[];
  };
  unsupportedSurfaceSignals?: {
    teleport: boolean;
    uiForm: boolean;
    environment: boolean;
    asyncCommandTransaction: boolean;
    dynamicCommand: boolean;
  };
}

const SUBJECT_KINDS: readonly GameplayIntentNodeKind[] = [
  "game",
  "mechanic",
  "actor",
  "role",
  "objective",
  "phase",
  "state",
  "resource",
  "lifecycle",
  "spatial-region",
  "policy",
  "outcome",
];

function summarizeSubjects(
  intent: GameplayIntentModel,
): GameplayWorldSubjectSummary[] {
  return SUBJECT_KINDS.map((kind) => {
    const nodes = intent.nodes
      .filter((node) => node.kind === kind)
      .sort((a, b) => a.id.localeCompare(b.id));
    return {
      kind,
      ids: nodes.map((node) => node.id),
      authored: nodes.filter(
        (node) => node.status === "authored",
      ).length,
      inferred: nodes.filter(
        (node) => node.status === "inferred",
      ).length,
      hypothesis: nodes.filter(
        (node) => node.status === "hypothesis",
      ).length,
    };
  }).filter((item) => item.ids.length > 0);
}

export function deriveGameplayWorldModel(
  source: GameplayWorldModelSource,
): GameplayWorldModel {
  const arenaCount =
    source.arena.spatialLayout !== undefined
      ? 1 + source.arena.spatialLayout.replicas.length
      : source.arena.discovery !== undefined
        ? 1 + source.arena.discovery.replicas.length
        : source.arena.capacity?.evidence
            .discoveredArenaCount;

  const runtimeSurfaces: GameplayClosureSurface[] = [];

  const arenaDetected =
    source.arena.autoDetected ||
    arenaCount !== undefined;
  if (arenaDetected) {
    runtimeSurfaces.push({
      id: "runtime:arena",
      label: "Arena presence and topology",
      kind: "runtime-domain",
      status:
        arenaCount === undefined
          ? "unknown"
          : "understood",
      material: true,
      ...(arenaCount === undefined
        ? {
            reason:
              "Arena behavior is detected, but concrete arena topology/count is not yet grounded.",
          }
        : {}),
      boundaries:
        arenaCount === undefined
          ? []
          : ["visibleArenaCount=" + arenaCount],
    });

    const requested =
      source.arena.capacity?.evidence
        .requestedConcurrentArenas;
    const safe =
      source.arena.capacity?.report
        ?.safeConcurrentArenas;
    const unresolvedCapacity =
      source.arena.capacity === undefined ||
      source.arena.capacity.evidence.arenaCountConflict ||
      source.arena.capacity.report === undefined ||
      source.arena.capacity.report.safeConcurrentArenas === null ||
      (
        source.arena.capacity.evidence
          .scriptTickingAreaManagerReferenced &&
        !source.arena.capacity.evidence
          .scriptTickingAreaCapacityResolved
      );

    runtimeSurfaces.push({
      id: "runtime:arena-capacity",
      label: "Arena capacity and concurrency",
      kind: "runtime-domain",
      status: unresolvedCapacity
        ? "unknown"
        : "understood",
      material: true,
      ...(unresolvedCapacity
        ? {
            reason:
              "Arena capacity/concurrency has unresolved selected-artifact evidence.",
          }
        : {}),
      boundaries: [
        ...(arenaCount === undefined
          ? []
          : ["visibleArenaCount=" + arenaCount]),
        ...(requested === undefined
          ? []
          : ["requestedConcurrentArenas=" + requested]),
        ...(safe === undefined || safe === null
          ? []
          : ["safeConcurrentArenas=" + safe]),
      ],
    });
  }

  if (source.arena.lifecycle !== undefined) {
    runtimeSurfaces.push({
      id: "runtime:arena-lifecycle",
      label: "Arena lifecycle",
      kind: "runtime-domain",
      status:
        source.arena.lifecycle.unresolved > 0
          ? "unknown"
          : "understood",
      material: true,
      ...(source.arena.lifecycle.unresolved > 0
        ? { reason: "Arena lifecycle has unresolved terminal/transition evidence." }
        : {}),
    });
  }

  if (source.arena.cleanupSurfaces !== undefined) {
    const unresolved =
      source.arena.cleanupSurfaces.unresolved > 0 ||
      source.arena.cleanupSurfaces.lifecycle
        .unresolved > 0 ||
      (source.arena.cleanupSurfaces.ledger?.missing ?? 0) > 0;
    runtimeSurfaces.push({
      id: "runtime:arena-cleanup",
      label: "Arena cleanup and reuse",
      kind: "runtime-domain",
      status: unresolved ? "unknown" : "understood",
      material: true,
      ...(unresolved
        ? { reason: "Arena cleanup/reuse coverage is incomplete." }
        : {}),
    });
  }

  const replicaProof =
    source.arena.replicaProofQuality ?? [];
  if (replicaProof.length > 0) {
    const incomplete = replicaProof.filter(
      (item) =>
        item.status === "incomplete-proof" ||
        item.status === "budget-exceeded" ||
        item.status === "no-proof",
    ).length;
    const diverged = replicaProof.filter(
      (item) => item.status === "diverged",
    ).length;

    runtimeSurfaces.push({
      id: "runtime:arena-replica-integrity",
      label: "Arena replica integrity",
      kind: "runtime-domain",
      status:
        incomplete > 0
          ? "unknown"
          : "understood",
      material: true,
      ...(incomplete > 0
        ? {
            reason:
              String(incomplete) +
              " arena replica proof(s) remain incomplete or unavailable.",
          }
        : {}),
      boundaries: [
        "replicaCount=" +
          String(replicaProof.length),
        "divergedReplicas=" +
          String(diverged),
      ],
    });
  }

  if (source.arena.stateIsolation !== undefined) {
    runtimeSurfaces.push({
      id: "runtime:arena-isolation",
      label: "Arena state isolation",
      kind: "runtime-domain",
      status:
        source.arena.stateIsolation.unknown > 0 ||
        source.arena.stateIsolation.partitionProofRequired > 0
          ? "unknown"
          : "understood",
      material: true,
      ...(
        source.arena.stateIsolation.unknown > 0 ||
        source.arena.stateIsolation.partitionProofRequired > 0
          ? { reason: "Arena isolation still requires unresolved partition proof." }
          : {}
      ),
    });
  }

  const persistenceApplicable =
    (source.persistenceSource?.properties.length ?? 0) > 0;
  if (persistenceApplicable) {
    const unresolved =
      (source.persistenceSource?.unknownScope ?? 0) > 0 ||
      (source.persistenceSource?.unknownLifetime ?? 0) > 0;
    runtimeSurfaces.push({
      id: "runtime:persistence",
      label: "Persistence and recovery",
      kind: "runtime-domain",
      status: unresolved ? "unknown" : "understood",
      material: true,
      ...(unresolved
        ? { reason: "Persistence scope or lifetime remains unresolved." }
        : {}),
    });
  }

  const economyApplicable =
    (source.rewardSources?.sourceKinds.length ?? 0) > 0;
  if (economyApplicable) {
    const unresolved =
      (source.rewardSources?.unresolvedEngineLootTables ?? 0) > 0 ||
      (source.rewardSources?.deathRewardSourceOverlapUnresolved ?? 0) > 0 ||
      (source.rewardSources?.cleanupRewardJournalOrderingUnresolved ?? 0) > 0 ||
      (source.economyPolicy?.deathRewardOverlapUnresolved ?? 0) > 0;
    runtimeSurfaces.push({
      id: "runtime:economy",
      label: "Economy and rewards",
      kind: "runtime-domain",
      status: unresolved ? "unknown" : "understood",
      material: true,
      ...(unresolved
        ? { reason: "Material reward/economy behavior remains unresolved." }
        : {}),
    });
  }

  const combatApplicable =
    (source.combatLifecycle?.hurtHandlers ?? 0) > 0 ||
    (source.combatLifecycle?.deathHandlers ?? 0) > 0 ||
    (source.combatLifecycle?.damageApplications ?? 0) > 0;
  if (combatApplicable) {
    runtimeSurfaces.push({
      id: "runtime:combat",
      label: "Combat lifecycle",
      kind: "runtime-domain",
      status: "understood",
      material: true,
    });
  }

  const inventoryApplicable =
    (source.inventoryLifecycle?.regions ?? 0) > 0 ||
    (source.inventoryLifecycle?.grantRegions ?? 0) > 0 ||
    (source.inventoryLifecycle?.resetCandidates ?? 0) > 0;
  if (inventoryApplicable) {
    const unresolved =
      (source.inventoryLifecycle?.unresolvedEquipmentSlotEvidence ?? 0) > 0 ||
      (source.inventoryRestoreOwnership?.unknownIdentityGrants ?? 0) > 0 ||
      (source.inventoryPolicy?.unknownIdentityEvidence ?? 0) > 0 ||
      (source.inventoryPolicy?.unknownDrops ?? 0) > 0;
    runtimeSurfaces.push({
      id: "runtime:inventory",
      label: "Inventory and equipment",
      kind: "runtime-domain",
      status: unresolved ? "unknown" : "understood",
      material: true,
      ...(unresolved
        ? { reason: "Inventory/equipment identity or restore behavior remains unresolved." }
        : {}),
    });
  }

  const spatialApplicable =
    source.scriptSpatial.resolvedEffects.length > 0 ||
    source.scriptSpatial.structurePlacements.length > 0 ||
    source.scriptSpatial.failures.length > 0;
  if (spatialApplicable) {
    const unresolved =
      source.scriptSpatial.failures.length > 0 ||
      (source.spatialAuthority?.uncovered ?? 0) > 0 ||
      (source.spatialAuthority?.conflicts ?? 0) > 0 ||
      (source.spatialAuthority?.unknownRegions ?? 0) > 0;
    runtimeSurfaces.push({
      id: "runtime:spatial",
      label: "Spatial authority and world placement",
      kind: "runtime-domain",
      status: unresolved ? "unknown" : "understood",
      material: true,
      ...(unresolved
        ? { reason: "Spatial mutation/authority evidence remains unresolved." }
        : {}),
    });
  }

  if (
    source.structures.loads > 0 ||
    source.structures.runtimeLogicLoads > 0 ||
    (source.structures.transitionResidueRisks ?? 0) > 0 ||
    (source.structures.transitionResidueUnresolved ?? 0) > 0
  ) {
    const unresolved =
      source.structures.unresolvedLoads > 0 ||
      (source.structures.transitionResidueRisks ?? 0) > 0 ||
      (source.structures.transitionResidueUnresolved ?? 0) > 0;
    runtimeSurfaces.push({
      id: "runtime:structures",
      label: "Structure and world mutation",
      kind: "runtime-domain",
      status:
        unresolved
          ? "unknown"
          : "understood",
      material: true,
      ...(unresolved
        ? {
            reason:
              (source.structures.transitionResidueRisks ?? 0) > 0
                ? "Structure transitions contain residue-risk cells and require baseline/reset proof."
                : "One or more structure loads or transition states remain unresolved.",
          }
        : {}),
    });
  }

  if (source.entities.definitions > 0) {
    const unresolved =
      source.entities.knowledgePrerequisiteGaps > 0 ||
      source.entities.staticAnalysisLimits > 0 ||
      (source.routeNavigationEnvironment?.unresolved ?? 0) > 0;
    runtimeSurfaces.push({
      id: "runtime:entities",
      label: "Entity lifecycle and navigation",
      kind: "runtime-domain",
      status: unresolved ? "unknown" : "understood",
      material: true,
      ...(unresolved
        ? { reason: "Entity lifecycle/navigation has unresolved analysis limits." }
        : {}),
    });
  }

  const objectiveAuthority =
    source.objectiveAuthority ?? [];
  const objectiveAuthorityUnresolved =
    objectiveAuthority.some(
      (item) =>
        item.status !== "declared",
    );
  const stateEvidence =
    source.semanticIr.stateSurfaces > 0 ||
    source.semanticIr.stateOperations > 0 ||
    objectiveAuthority.length > 0;
  if (stateEvidence) {
    runtimeSurfaces.push({
      id: "runtime:state",
      label: "Gameplay state model",
      kind: "runtime-domain",
      status:
        source.broadWrites > 0 ||
        objectiveAuthorityUnresolved
          ? "unknown"
          : "understood",
      material: true,
      ...(source.broadWrites > 0 ||
          objectiveAuthorityUnresolved
        ? {
            reason:
              source.broadWrites > 0
                ? "Broad state writes exist, so state ownership/authority is not fully resolved."
                : "At least one gameplay objective has undeclared or multiple explicit authority declarations.",
          }
        : {}),
    });
  }

  const chunkEvidence =
    source.chunkLifecycle !== undefined &&
    (
      source.chunkLifecycle.worldLoadObservers > 0 ||
      source.chunkLifecycle.entityLoadObservers > 0 ||
      source.chunkLifecycle.tickingAreaAcquires > 0 ||
      source.chunkLifecycle.readinessProbes > 0
    );
  if (chunkEvidence) {
    runtimeSurfaces.push({
      id: "runtime:chunks",
      label: "Chunk and residency lifecycle",
      kind: "runtime-domain",
      status:
        source.chunkLifecycle?.entityResidencyObservability === "complete"
          ? "understood"
          : "unknown",
      material: true,
      ...(source.chunkLifecycle?.entityResidencyObservability === "complete"
        ? {}
        : {
            reason:
              source.chunkLifecycle?.entityResidencyObservability === "partial"
                ? "Chunk/entity residency observability is only partial; lifecycle proof remains incomplete."
                : "Chunk/entity residency is gameplay-relevant but observability is absent.",
          }),
    });
  }

  const boundaryEvidence =
    (source.boundaries?.records ?? 0) > 0 ||
    (source.boundaries?.unresolvedNames.length ?? 0) > 0;
  if (boundaryEvidence) {
    const unresolved =
      (source.boundaries?.unresolvedNames.length ?? 0) > 0;
    runtimeSurfaces.push({
      id: "runtime:boundaries",
      label: "Gameplay numeric and discrete boundaries",
      kind: "runtime-domain",
      status: unresolved ? "unknown" : "understood",
      material: true,
      ...(unresolved
        ? {
            reason:
              "One or more gameplay boundary values could not be resolved: " +
              (source.boundaries?.unresolvedNames.join(", ") ?? "unknown") +
              ".",
          }
        : {}),
    });
  }

  if (source.unsupportedSurfaceSignals?.teleport) {
    runtimeSurfaces.push({
      id: "runtime:teleport",
      label: "Teleport lifecycle and destination safety",
      kind: "runtime-domain",
      status: "unknown",
      material: true,
      reason:
        "Teleport behavior is present in the selected artifact, but no complete production semantic owner currently proves destination, dimension, ownership, timing, and post-teleport state.",
    });
  }
  if (source.unsupportedSurfaceSignals?.uiForm) {
    runtimeSurfaces.push({
      id: "runtime:ui-form",
      label: "UI/form reachability and state",
      kind: "runtime-domain",
      status: "unknown",
      material: true,
      reason:
        "Player UI/form behavior is present, but menu reachability, state transitions, and delivery semantics are not fully owned by a production analyzer.",
    });
  }
  const environmentEvidence =
    (source.worldRuleAuthority?.writes.length ?? 0) > 0 ||
    source.unsupportedSurfaceSignals?.environment === true;
  if (environmentEvidence) {
    const environmentUnresolved =
      source.worldRuleAuthority === undefined ||
      source.worldRuleAuthority.conflicts.length > 0;
    runtimeSurfaces.push({
      id: "runtime:environment",
      label: "Environment and gamerule contract",
      kind: "runtime-domain",
      status:
        environmentUnresolved
          ? "unknown"
          : "understood",
      material: true,
      ...(environmentUnresolved
        ? {
            reason:
              source.worldRuleAuthority === undefined
                ? "Environment/gamerule mutations are present without a complete world-rule authority analysis."
                : "Conflicting gamerule writers remain unresolved.",
          }
        : {}),
      boundaries:
        source.worldRuleAuthority === undefined
          ? []
          : [
              "worldRuleWrites=" +
                String(source.worldRuleAuthority.writes.length),
              "manualEntitySpawnPaths=" +
                String(source.worldRuleAuthority.manualEntitySpawnPaths),
              "naturalMobSpawning=" +
                source.worldRuleAuthority.naturalMobSpawning,
            ],
    });
  }

  const playerCapabilityEvidence =
    source.playerCapabilitySurfaces !== undefined &&
    (
      source.playerCapabilitySurfaces.gamemodeWrites > 0 ||
      source.playerCapabilitySurfaces.abilityWrites > 0 ||
      source.playerCapabilitySurfaces.commandPermissionWrites > 0 ||
      source.playerCapabilitySurfaces.privilegedGuardReferences > 0 ||
      source.playerCapabilitySurfaces.protectionDefinitions.length > 0
    );
  if (playerCapabilityEvidence) {
    const capabilityResidual =
      (source.capabilityMutationFootprint?.partial ?? 0) > 0 ||
      (source.capabilityMutationFootprint?.unresolved ?? 0) > 0;
    const inactiveProtection =
      (source.playerCapabilitySurfaces?.inactiveProtectionDefinitions ?? 0) > 0;
    runtimeSurfaces.push({
      id: "runtime:player-capability",
      label: "Player capability and privileged-role authority",
      kind: "runtime-domain",
      status:
        inactiveProtection || capabilityResidual
          ? "unknown"
          : "understood",
      material: true,
      ...(inactiveProtection || capabilityResidual
        ? {
            reason:
              inactiveProtection
                ? "One or more protection classes are defined but not instantiated in the selected production script graph."
                : "Broad player capability has partial or unresolved mutation/reset coverage.",
          }
        : {}),
      boundaries: [
        "gamemodeWrites=" +
          String(source.playerCapabilitySurfaces?.gamemodeWrites ?? 0),
        "abilityWrites=" +
          String(source.playerCapabilitySurfaces?.abilityWrites ?? 0),
        "privilegedBypassReturns=" +
          String(source.playerCapabilitySurfaces?.privilegedBypassReturns ?? 0),
        "capabilityMutationPartial=" +
          String(source.capabilityMutationFootprint?.partial ?? 0),
        "capabilityMutationUnresolved=" +
          String(source.capabilityMutationFootprint?.unresolved ?? 0),
      ],
    });
  }
  if (
    source.unsupportedSurfaceSignals
      ?.asyncCommandTransaction
  ) {
    runtimeSurfaces.push({
      id: "runtime:async-command-transaction",
      label: "Asynchronous command transaction",
      kind: "runtime-domain",
      status: "unknown",
      material: true,
      reason:
        "Gameplay-significant runCommandAsync mutation is present, but generic success/failure/await/rollback semantics are not fully proven before dependent gameplay state commits.",
    });
  }
  if (source.unsupportedSurfaceSignals?.dynamicCommand) {
    runtimeSurfaces.push({
      id: "runtime:dynamic-command",
      label: "Dynamic command semantics",
      kind: "runtime-domain",
      status: "unknown",
      material: true,
      reason:
        "A gameplay command is constructed dynamically. Its concrete effects cannot be exhaustively derived from literal command analysis, so the affected behavior remains a Detection Gap.",
    });
  }


  const stateClosure = assessGameplayStateClosure(source.intent);
  // A selected-source transition topology can be understood while its
  // game terminal rule remains unknown. Preserve both facts separately.
  const stateModelComplete = stateClosure.sourceRouteCoverageComplete;
  const terminalOutcomeUnresolved =
    stateModelComplete && !stateClosure.terminalOutcomeGrounded;
  if (terminalOutcomeUnresolved) {
    runtimeSurfaces.push({
      id: "runtime:terminal-outcome",
      label: "Game terminal outcome authority",
      kind: "runtime-domain",
      status: "unknown",
      material: true,
      reason:
        "Authored routes reach a state-machine sink, but no selected-artifact win/loss relation establishes game settlement. A sink is not an outcome.",
    });
  }
  const intentSurfaces = buildIntentClosureSurfaces(source.intent);
  const closureSurfaces = [...intentSurfaces, ...runtimeSurfaces];

  const arenaBoundariesExtracted =
    !arenaDetected ||
    (
      arenaCount !== undefined &&
      source.arena.capacity?.evidence
        .requestedConcurrentArenas !== undefined
    );
  // Missing boundary inventory is unknown, not an empty complete inventory.
  // Normal artifact inspection supplies an explicit registry, including zero records.
  const genericBoundariesExtracted =
    source.boundaries !== undefined &&
    source.boundaries.unresolvedNames.length === 0;
  const boundariesExtracted =
    arenaBoundariesExtracted &&
    genericBoundariesExtracted;

  const discovery = discoverGameplaySurfaces({
    intentSubjectIds:
      source.intent.nodes.map((node) => node.id),
    arenaDetected,
    arenaCapacityEvidence:
      source.arena.capacity !== undefined ||
      arenaCount !== undefined,
    arenaLifecycleEvidence:
      source.arena.lifecycle !== undefined,
    arenaCleanupEvidence:
      source.arena.cleanupSurfaces !== undefined,
    arenaIsolationEvidence:
      source.arena.stateIsolation !== undefined ||
      source.arena.globalState !== undefined,
    arenaReplicaEvidence:
      replicaProof.length > 0,
    stateEvidence,
    terminalOutcomeUnresolved,
    chunkEvidence,
    persistenceEvidence: persistenceApplicable,
    economyEvidence: economyApplicable,
    combatEvidence: combatApplicable,
    inventoryEvidence: inventoryApplicable,
    spatialEvidence: spatialApplicable,
    structureEvidence:
      source.structures.definitions > 0 ||
      source.structures.loads > 0 ||
      source.structures.runtimeLogicLoads > 0,
    entityEvidence:
      source.entities.definitions > 0,
    boundaryEvidence,
    ...(source.unsupportedSurfaceSignals?.teleport === undefined
      ? {} : { teleportEvidence: source.unsupportedSurfaceSignals.teleport }),
    ...(source.unsupportedSurfaceSignals?.uiForm === undefined
      ? {} : { uiFormEvidence: source.unsupportedSurfaceSignals.uiForm }),
    environmentEvidence,
    playerCapabilityEvidence,
    ...(source.unsupportedSurfaceSignals?.asyncCommandTransaction === undefined
      ? {} : { asyncCommandTransactionEvidence:
          source.unsupportedSurfaceSignals.asyncCommandTransaction }),
    ...(source.unsupportedSurfaceSignals?.dynamicCommand === undefined
      ? {} : { dynamicCommandEvidence:
          source.unsupportedSurfaceSignals.dynamicCommand }),
  });

  const gameplayClosure =
    assessGameplayModelClosure({
      discoveredSurfaceIds: discovery.surfaceIds,
      surfaces: closureSurfaces,
      stateModelComplete,
      boundariesExtracted,
    });

  return {
    schemaVersion: 1,
    artifactId: source.artifactId,
    subjects: summarizeSubjects(source.intent),
    surfaceDiscovery: discovery,
    gameplayClosure,
    stateClosure,
    arenas: {
      detected:
        source.arena.autoDetected ||
        arenaCount !== undefined,
      ...(arenaCount === undefined
        ? {}
        : { count: arenaCount }),
      ...(source.arena.spatialLayout === undefined
        ? {}
        : {
            basis:
              source.arena.spatialLayout.basis,
          }),
      ...(source.arena.spatialLayout?.canonical?.arenaId === undefined
        ? {}
        : {
            replicaBaselineId:
              source.arena.spatialLayout
                .canonical.arenaId,
          }),
      ...(source.arena.layoutReconciliation === undefined
        ? {}
        : {
            layoutStatus:
              source.arena.layoutReconciliation.status,
          }),
      ...(source.arena.capacity?.evidence
          .requestedConcurrentArenas === undefined
        ? {}
        : {
            requestedConcurrentArenas:
              source.arena.capacity.evidence
                .requestedConcurrentArenas,
          }),
      ...(source.arena.capacity?.report === undefined
        ? {}
        : {
            safeConcurrentArenas:
              source.arena.capacity.report
                .safeConcurrentArenas,
          }),
      ...(source.arena.capacity?.evidence
          .declaredConcurrentArenaLimit === undefined
        ? {}
        : {
            declaredConcurrentArenaLimit:
              source.arena.capacity.evidence
                .declaredConcurrentArenaLimit,
          }),
      ...(source.arena.capacity?.evidence
          .perArenaPlayerCapacity === undefined
        ? {}
        : {
            perArenaPlayerCapacity:
              source.arena.capacity.evidence
                .perArenaPlayerCapacity,
            perArenaPlayerCapacitySources:
              source.arena.capacity.evidence
                .perArenaPlayerCapacitySources ?? [],
          }),
      ...(source.arena.capacity?.evidence
          .unresolvedRosterCapacityPaths === undefined
        ? {}
        : {
            unresolvedRosterCapacityPaths:
              source.arena.capacity.evidence.unresolvedRosterCapacityPaths,
          }),
      ...(source.arena.capacity?.evidence
          .declaredMaxConcurrentPlayers === undefined
        ? {}
        : {
            declaredMaxConcurrentPlayers:
              source.arena.capacity.evidence
                .declaredMaxConcurrentPlayers,
          }),
      ...(source.arena.capacity?.report === undefined
        ? {}
        : {
            capacityOk:
              source.arena.capacity.report.ok,
          }),
      lifecycle: {
        terminalCandidates:
          source.arena.lifecycle?.terminalCandidates ?? 0,
        proven:
          source.arena.lifecycle?.proven ?? 0,
        partial:
          source.arena.lifecycle?.partial ?? 0,
        unresolved:
          source.arena.lifecycle?.unresolved ?? 0,
        multiIngressTerminalTargets:
          source.arena.lifecycle
            ?.multiIngressTerminalTargets ?? 0,
        protectedTerminalRaces:
          source.arena.lifecycle
            ?.protectedTerminalRaces ?? 0,
        provenTerminalRaces:
          source.arena.lifecycle
            ?.provenTerminalRaces ?? 0,
        unresolvedTerminalRaces:
          source.arena.lifecycle
            ?.unresolvedTerminalRaces ?? 0,
        terminalPrecedenceProven:
          source.arena.lifecycle
            ?.terminalPrecedenceProven ?? 0,
        terminalPrecedenceUnresolved:
          source.arena.lifecycle
            ?.terminalPrecedenceUnresolved ?? 0,
        protectedDeferredMutations:
          source.arena.lifecycle
            ?.protectedDeferredMutations ?? 0,
        unresolvedDeferredMutations:
          source.arena.lifecycle
            ?.unresolvedDeferredMutations ?? 0,
        staleReadySnapshotRisks:
          source.arena.lifecycle
            ?.staleReadySnapshotRisks ?? 0,
        readySetSnapshotRisks:
          source.arena.lifecycle
            ?.readySetSnapshotRisks.map(
              (item) => ({
                scriptId:
                  item.scriptId,
                arenaExpression:
                  item.arenaExpression,
                executionRegion:
                  item.executionRegion,
                ...(item.snapshotExpression === undefined
                  ? {}
                  : {
                      snapshotExpression:
                        item.snapshotExpression,
                    }),
              }),
            ) ?? [],
        deferredMutations:
          source.arena.lifecycle
            ?.deferredMutations.map((item) => ({
              scriptId: item.scriptId,
              scheduler: item.scheduler,
              callbackRegion:
                item.callbackRegion,
              mutationRegions:
                [...item.mutationRegions],
              guardIdentifiers:
                [...item.guardIdentifiers],
              status: item.status,
            })) ?? [],
        terminalRaces:
          source.arena.lifecycle
            ?.terminalRaces.map((item) => ({
              scriptId: item.scriptId,
              terminalRegion:
                item.terminalRegion,
              ingresses:
                item.ingresses.map(
                  (ingress) => ({
                    kind: ingress.kind,
                    id: ingress.id,
                    callbackRegion:
                      ingress.callbackRegion,
                    guardStatus:
                      ingress.guardStatus,
                  }),
                ),
              status: item.status,
              ...(item.idempotencyKind === undefined
                ? {}
                : {
                    idempotencyKind:
                      item.idempotencyKind,
                  }),
              reason: item.reason,
            })) ?? [],
        terminalIngresses:
          source.arena.lifecycle
            ?.terminalIngresses.map((item) => ({
              scriptId: item.scriptId,
              terminalRegion:
                item.terminalRegion,
              incomingCallerRegions:
                [...item.incomingCallerRegions],
              incomingControlFlows:
                [...item.incomingControlFlows],
              distinctIngresses:
                item.distinctIngresses,
              status: item.status,
            })) ?? [],
      },
      cleanup: {
        acquiredSurfaces:
          source.arena.cleanupSurfaces
            ?.acquiredSurfaces ?? 0,
        exactProven:
          source.arena.cleanupSurfaces
            ?.exactProven ?? 0,
        partial:
          source.arena.cleanupSurfaces
            ?.partial ?? 0,
        unresolved:
          source.arena.cleanupSurfaces
            ?.unresolved ?? 0,
        resourceLedger: {
          resources:
            source.arena.cleanupSurfaces
              ?.ledger?.resources ?? 0,
          complete:
            source.arena.cleanupSurfaces
              ?.ledger?.complete ?? 0,
          partial:
            source.arena.cleanupSurfaces
              ?.ledger?.partial ?? 0,
          missing:
            source.arena.cleanupSurfaces
              ?.ledger?.missing ?? 0,
          coverageRatio:
            source.arena.cleanupSurfaces
              ?.ledger?.coverageRatio ?? 1,
        },
        lifecycle: {
          declared:
            source.arena.cleanupSurfaces
              ?.lifecycle.declared ?? false,
          complete:
            source.arena.cleanupSurfaces
              ?.lifecycle.complete ?? 0,
          unresolved:
            source.arena.cleanupSurfaces
              ?.lifecycle.unresolved ?? 0,
          assessments:
            source.arena.cleanupSurfaces
              ?.lifecycle.assessments.map((item) => ({
                scriptId: item.scriptId,
                tableName: item.tableName,
                ...(item.stateType === undefined
                  ? {}
                  : {
                      stateType:
                        item.stateType,
                    }),
                status: item.status,
                missingPhases:
                  [...item.missingPhases],
                orderingViolations:
                  [...item.orderingViolations],
                reason: item.reason,
              })) ?? [],
        },
      },
      isolation: {
        isolated:
          source.arena.stateIsolation?.isolated ?? 0,
        partitionProofRequired:
          source.arena.stateIsolation
            ?.partitionProofRequired ?? 0,
        sharedGlobal:
          source.arena.stateIsolation
            ?.sharedGlobal ?? 0,
        unknown:
          source.arena.stateIsolation?.unknown ?? 0,
        observations:
          source.arena.stateIsolation?.observations.map((item) => ({
            scriptId: item.scriptId,
            region: item.region,
            key: item.key,
            surface: item.surface,
            scope: item.scope,
            status: item.status,
            reason: item.reason,
            sourcePath: item.source?.relativePath ?? null,
            sourceLocator: item.source?.range?.lineStart === undefined
              ? null
              : item.source.relativePath + ":" + item.source.range.lineStart +
                (item.source.range.columnStart === undefined
                  ? "" : ":" + item.source.range.columnStart),
          })) ?? [],
      },
      globalState: {
        arenaScopedMutations:
          source.arena.globalState
            ?.arenaScopedMutations ?? 0,
        pairedLeaseEvidence:
          source.arena.globalState
            ?.pairedLeaseEvidence ?? 0,
        unleasedArenaMutations:
          source.arena.globalState
            ?.unleasedArenaMutations ?? 0,
        unauditedArenaMutations:
          source.arena.globalState
            ?.unauditedArenaMutations ?? 0,
        mutations:
          source.arena.globalState?.mutations.map((item) => ({
            id: item.id,
            ownerId: item.ownerId,
            resource: item.resource,
            arenaScoped: item.arenaScoped,
          })) ?? [],
        assessments:
          source.arena.globalState?.assessments.map((item) => ({
            mutationId: item.mutationId,
            resource: item.resource,
            status: item.status,
            audited: item.audited,
          })) ?? [],
      },
      stress:
        source.arena.stressPlan?.status === "planned" &&
        source.arena.stressPlan.matrix !== undefined
          ? {
              status: "planned",
              totalNominalPlayers:
                source.arena.stressPlan.matrix
                  .totalNominalPlayers,
              scenarios:
                source.arena.stressPlan.matrix
                  .scenarios.length,
            }
          : {
              status: "unavailable",
            },
      ...(source.arena.repeatedRunPlan === undefined
        ? {}
        : {
            repeatedRun: {
              runCounts: [
                ...source.arena.repeatedRunPlan
                  .runCounts,
              ],
              stages:
                source.arena.repeatedRunPlan
                  .stages.length,
              compareSurfaces: [
                ...new Set(
                  source.arena.repeatedRunPlan
                    .stages.flatMap(
                      (stage) =>
                        stage.compareSurfaces,
                    ),
                ),
              ].sort(),
            },
          }),
      ...(source.arena.proofExecution === undefined
        ? {}
        : {
            proofExecution: {
              mode:
                source.arena.proofExecution.mode,
              executedLayers: [
                ...source.arena.proofExecution
                  .executedLayers,
              ],
              skippedLayers: [
                ...source.arena.proofExecution
                  .skippedLayers,
              ],
            },
          }),
      ...(source.arena.proofConclusion === undefined
        ? {}
        : {
            proof:
              source.arena.proofConclusion.conclusion,
          }),
      barrierContainment: {
        status:
          source.arena.barrierEnclosureProof?.status ?? "not-run",
        contained:
          source.arena.barrierEnclosureProof?.arenas.filter(
            (item) => item.status === "contained",
          ).length ?? 0,
        openOrUnproven:
          source.arena.barrierEnclosureProof?.arenas.filter(
            (item) => item.status === "open-or-unproven",
          ).length ?? 0,
        incomplete:
          source.arena.barrierEnclosureProof?.arenas.filter(
            (item) => item.status === "incomplete",
          ).length ?? 0,
        budgetExceeded:
          source.arena.barrierEnclosureProof?.arenas.filter(
            (item) => item.status === "budget-exceeded",
          ).length ?? 0,
      },
      replicaIntegrity: {
        complete:
          replicaProof.filter(
            (item) =>
              item.status === "complete-proof",
          ).length,
        bounded:
          replicaProof.filter(
            (item) =>
              item.status === "bounded-proof",
          ).length,
        diverged:
          replicaProof.filter(
            (item) =>
              item.status === "diverged",
          ).length,
        incomplete:
          replicaProof.filter(
            (item) =>
              item.status === "incomplete-proof" ||
              item.status === "budget-exceeded",
          ).length,
        noProof:
          replicaProof.filter(
            (item) =>
              item.status === "no-proof",
          ).length,
      },
      replicaProof:
        replicaProof.map((item) => ({
          arenaId: item.arenaId,
          status: item.status,
          mismatchCount: item.mismatchCount,
          unresolvedBlocks: item.unresolvedBlocks,
          evidenceIds: [
            "arena-replica-proof:" +
              item.arenaId,
          ],
        })),
    },
    spatial: {
      resolvedScriptEffects:
        source.scriptSpatial.resolvedEffects.length,
      structurePlacements:
        source.scriptSpatial.structurePlacements.length,
      unresolvedScriptMutations:
        source.scriptSpatial.failures.length,
      rejectedScriptMutations:
        source.scriptSpatial.rejectedMutations,
      authority: {
        configured:
          source.spatialAuthority !== undefined,
        policyValid:
          source.spatialAuthority?.policyValid ?? true,
        resolved:
          source.spatialAuthority?.resolved ?? 0,
        uncovered:
          source.spatialAuthority?.uncovered ?? 0,
        conflicts:
          source.spatialAuthority?.conflicts ?? 0,
        unknownRegions:
          source.spatialAuthority?.unknownRegions ?? 0,
      },
    },
    persistence: {
      properties:
        source.persistenceSource?.properties.length ?? 0,
      appendWithoutClear:
        source.persistenceSource?.appendWithoutClear ?? 0,
      worldScopedAppendWithoutClear:
        source.persistenceSource?.worldScopedAppendWithoutClear ?? 0,
      unknownScope:
        source.persistenceSource?.unknownScope ?? 0,
      unknownLifetime:
        source.persistenceSource?.unknownLifetime ?? 0,
      resultAuditRecords:
        source.persistenceSource?.resultAuditRecords.length ?? 0,
      completeResultAuditRecords:
        source.persistenceSource?.completeResultAuditRecords ?? 0,
      partialResultAuditRecords:
        source.persistenceSource?.partialResultAuditRecords ?? 0,
      resultAuditRecordDetails:
        source.persistenceSource?.resultAuditRecords.map((item) => ({
          scriptId: item.scriptId,
          propertyKey: item.propertyKey,
          status: item.status,
          semanticFields: item.semanticFields,
          missingRequiredFields: item.missingRequiredFields,
        })) ?? [],
      reconnectTransientRestoreRiskCount:
        source.persistenceSource?.reconnectTransientRestoreRiskCount ?? 0,
      reconnectTransientRestoreRisks:
        source.persistenceSource?.reconnectTransientRestoreRisks ?? [],
      propertiesDetail:
        source.persistenceSource?.properties.map((item) => ({
          scriptId: item.scriptId,
          propertyId: item.propertyId,
          growth: item.growth,
          scope: item.scope,
          lifetime: item.lifetime,
        })) ?? [],
    },
    chunks: {
      worldLoadObservers:
        source.chunkLifecycle?.worldLoadObservers ?? 0,
      entityLoadObservers:
        source.chunkLifecycle?.entityLoadObservers ?? 0,
      entityRemoveObservers:
        source.chunkLifecycle?.entityRemoveObservers ?? 0,
      readinessProbes:
        source.chunkLifecycle?.readinessProbes ?? 0,
      tickingAreaReadinessStates:
        source.chunkLifecycle?.tickingAreaReadinessStates ?? 0,
      tickingAreaAcquires:
        source.chunkLifecycle?.tickingAreaAcquires ?? 0,
      tickingAreaReleases:
        source.chunkLifecycle?.tickingAreaReleases ?? 0,
      pairedLeases:
        source.chunkLifecycle?.pairedLeases ?? 0,
      acquireWithoutRelease:
        source.chunkLifecycle?.acquireWithoutRelease ?? 0,
      releaseUnreachable:
        source.chunkLifecycle?.releaseUnreachable ?? 0,
      cleanupOrderUnproven:
        source.chunkLifecycle?.cleanupOrderUnproven ?? 0,
      dynamicLeaseKeys:
        source.chunkLifecycle?.dynamicLeaseKeys ?? 0,
      capacityUncheckedLeases:
        source.chunkLifecycle?.capacityUncheckedLeases ?? 0,
      readinessUnverifiedLeases:
        source.chunkLifecycle?.readinessUnverifiedLeases ?? 0,
      shutdownOnlyCleanupRisk:
        source.chunkLifecycle?.shutdownOnlyCleanupRisk ?? 0,
      worldLoadReconciliationPaths:
        source.chunkLifecycle?.worldLoadReconciliationPaths ?? 0,
      unguardedDeferredChunkWork:
        source.chunkLifecycle?.unguardedDeferredChunkWork ?? 0,
      zeroTickDeferredChunkWork:
        source.chunkLifecycle?.zeroTickDeferredChunkWork ?? 0,
      spawnRecoveryRoutes:
        source.chunkLifecycle?.spawnRecoveryRoutes ?? 0,
      unloadedSpecificSpawnRecoveryRoutes:
        source.chunkLifecycle?.unloadedSpecificSpawnRecoveryRoutes ?? 0,
      broadSpawnRecoveryRisks:
        source.chunkLifecycle?.broadSpawnRecoveryRisks ?? 0,
      otherSpecificSpawnRecoveryRoutes:
        source.chunkLifecycle?.otherSpecificSpawnRecoveryRoutes ?? 0,
      entityRemoveTerminalizationRisks:
        source.chunkLifecycle?.entityRemoveTerminalizationRisks ?? 0,
      completeResidencyStateMachines:
        source.chunkLifecycle?.completeResidencyStateMachines ?? 0,
      unresolvedResidencyStateMachines:
        source.chunkLifecycle?.unresolvedResidencyStateMachines ?? 0,
      entityResidencyObservability:
        source.chunkLifecycle?.entityResidencyObservability ?? "absent",
      leases:
        source.chunkLifecycle?.leases.map((lease) => ({
          scriptId: lease.scriptId,
          ...(lease.leaseKey === undefined
            ? {}
            : { leaseKey: lease.leaseKey }),
          acquireRegions: [...lease.acquireRegions],
          releaseRegions: [...lease.releaseRegions],
          capacityCheckRegions: [
            ...lease.capacityCheckRegions,
          ],
          status: lease.status,
        })) ?? [],
    },
    economy: {
      sourceKinds:
        source.rewardSources?.sourceKinds ?? [],
      engineLootEntities:
        source.rewardSources?.engineLootEntities ?? 0,
      engineLootTables:
        source.rewardSources?.engineLootTables ?? 0,
      unresolvedEngineLootTables:
        source.rewardSources?.unresolvedEngineLootTables ?? 0,
      scriptInventoryGrants:
        source.rewardSources?.scriptInventoryGrants ?? 0,
      worldDrops:
        source.rewardSources?.worldDrops ?? 0,
      pickupObservers:
        source.rewardSources?.pickupObservers ?? 0,
      scriptLootCommands:
        source.rewardSources?.scriptLootCommands ?? 0,
      functionLootCommands:
        source.rewardSources?.functionLootCommands ?? 0,
      scoreboardCredits:
        source.rewardSources?.scoreboardCredits ?? 0,
      scoreboardDebits:
        source.rewardSources?.scoreboardDebits ?? 0,
      scoreboardAdjustments:
        source.rewardSources?.scoreboardAdjustments ?? 0,
      scoreboardWrites:
        source.rewardSources?.scoreboardWrites ?? 0,
      deathRewardPaths:
        source.rewardSources?.deathRewardPaths ?? 0,
      pickupCurrencyPaths:
        source.rewardSources?.pickupCurrencyPaths ?? 0,
      deathRewardSourceOverlapCandidates:
        source.rewardSources
          ?.deathRewardSourceOverlapCandidates ?? 0,
      deathRewardSourceOverlapUnresolved:
        source.rewardSources
          ?.deathRewardSourceOverlapUnresolved ?? 0,
      pickupCurrencyWithoutConsumeCandidates:
        source.rewardSources
          ?.pickupCurrencyWithoutConsumeCandidates ?? 0,
      rewardPathsWithoutIdempotency:
        source.rewardSources
          ?.rewardPathsWithoutIdempotency ?? 0,
      cleanupAfterRewardJournalProven:
        source.rewardSources
          ?.cleanupAfterRewardJournalProven ?? 0,
      cleanupBeforeRewardJournalRisks:
        source.rewardSources
          ?.cleanupBeforeRewardJournalRisks ?? 0,
      cleanupRewardJournalOrderingUnresolved:
        source.rewardSources
          ?.cleanupRewardJournalOrderingUnresolved ?? 0,
      dropCleanupSurfaces:
        source.rewardSources?.dropCleanupSurfaces ?? 0,
      worldDropRewardPathsWithoutCleanup:
        source.rewardSources?.worldDropRewardPathsWithoutCleanup ?? 0,
      policy: {
        configured:
          source.economyPolicy?.configured ?? false,
        deathRewardOverlapContractConflicts:
          source.economyPolicy
            ?.deathRewardOverlapContractConflicts ?? 0,
        deathRewardOverlapUnresolved:
          source.economyPolicy
            ?.deathRewardOverlapUnresolved ?? 0,
        pickupCurrencyConsumeCoverageGaps:
          source.economyPolicy
            ?.pickupCurrencyConsumeCoverageGaps ?? 0,
        pickupCurrencyContractMismatch:
          source.economyPolicy
            ?.pickupCurrencyContractMismatch ?? 0,
        idempotencyCoverageGaps:
          source.economyPolicy
            ?.idempotencyCoverageGaps ?? 0,
        staleDropCleanupCoverageGaps:
          source.economyPolicy
            ?.staleDropCleanupCoverageGaps ?? 0,
        inventoryFullContractGaps:
          source.economyPolicy
            ?.inventoryFullContractGaps ?? 0,
        pickupScopeValidationUnproven:
          source.economyPolicy
            ?.pickupScopeValidationUnproven ?? 0,
        terminalRewardResultCommitUnproven:
          source.economyPolicy
            ?.terminalRewardResultCommitUnproven ?? 0,
      },
      paths:
        source.rewardSources?.paths.map((item) => ({
          scriptId: item.scriptId,
          trigger: item.trigger,
          callbackRegion: item.callbackRegion,
          reachableRegions: [...item.reachableRegions],
          inventoryGrants: item.inventoryGrants,
          worldDrops: item.worldDrops,
          lootCommands: item.lootCommands,
          scoreCredits: item.scoreCredits,
          scoreWrites: item.scoreWrites,
          itemConsumes: item.itemConsumes,
          idempotencyGuards: item.idempotencyGuards,
          cleanupReleases:
            item.cleanupReleases,
          rewardCleanupOrdering:
            item.rewardCleanupOrdering,
        })) ?? [],
    },
    progression: {
      actorAccounting: {
        counters:
          source.progressionActorAccounting
            ?.counters.length ?? 0,
        provenMissingReconciliation:
          source.progressionActorAccounting
            ?.provenMissingReconciliation ?? 0,
        provenActorIdentityMismatch:
          source.progressionActorAccounting
            ?.provenActorIdentityMismatch ?? 0,
        provenSpawnQuantityMismatch:
          source.progressionActorAccounting
            ?.provenSpawnQuantityMismatch ?? 0,
        deferredSpawnAccountingGaps:
          source.progressionActorAccounting
            ?.deferredSpawnAccountingGaps ?? 0,
        generationBoundRegistryAuthorities:
          source.progressionActorAccounting
            ?.generationBoundRegistryAuthorities ?? 0,
        unboundRegistryAuthorities:
          source.progressionActorAccounting
            ?.unboundRegistryAuthorities ?? 0,
        unresolvedRegistryAuthorities:
          source.progressionActorAccounting
            ?.unresolvedRegistryAuthorities ?? 0,
        registryAuthorityAssessments:
          source.progressionActorAccounting
            ?.registryAuthorityAssessments.map((item) => ({
              scriptId: item.scriptId,
              registryExpression:
                item.registryExpression,
              actorIdentifiers:
                [...item.actorIdentifiers],
              materializePaths:
                item.materializePaths,
              lifecycleReleasePaths:
                item.lifecycleReleasePaths,
              completionChecks:
                item.completionChecks,
              generationBound:
                item.generationBound,
              status: item.status,
              reason: item.reason,
            })) ?? [],
        scriptedRemovalCoverageGaps:
          source.progressionActorAccounting
            ?.scriptedRemovalCoverageGaps ?? 0,
        terminalOnlyScriptedRemovalCounters:
          source.progressionActorAccounting
            ?.terminalOnlyScriptedRemovalCounters ?? 0,
        nonTerminalScriptedRemovalCounters:
          source.progressionActorAccounting
            ?.nonTerminalScriptedRemovalCounters ?? 0,
        provenImmediateDespawnWithoutReconciliation:
          source.progressionActorAccounting
            ?.provenImmediateDespawnWithoutReconciliation ?? 0,
        conditionalDespawnUnknowns:
          source.progressionActorAccounting
            ?.conditionalDespawnUnknowns ?? 0,
        reachableConditionalDespawnCounters:
          source.progressionActorAccounting
            ?.reachableConditionalDespawnCounters ?? 0,
        terminalOnlyConditionalDespawnCounters:
          source.progressionActorAccounting
            ?.terminalOnlyConditionalDespawnCounters ?? 0,
        inactiveConditionalDespawnCounters:
          source.progressionActorAccounting
            ?.inactiveConditionalDespawnCounters ?? 0,
        provenActiveInstantDespawnWithoutReconciliation:
          source.progressionActorAccounting
            ?.provenActiveInstantDespawnWithoutReconciliation ?? 0,
        activeInterproceduralProofs:
          source.progressionActorAccounting
            ?.activeInterproceduralProofs ?? 0,
        activeTransitionProofs:
          source.progressionActorAccounting
            ?.activeTransitionProofs ?? 0,
        declaredActiveStateAliases:
          source.progressionActorAccounting
            ?.declaredActiveStateAliases ?? 0,
        validStateTransitions:
          source.progressionActorAccounting
            ?.validStateTransitions ?? 0,
        invalidStateTransitions:
          source.progressionActorAccounting
            ?.invalidStateTransitions ?? 0,
        unresolvedStateTransitions:
          source.progressionActorAccounting
            ?.unresolvedStateTransitions ?? 0,
        completeStateMachines:
          source.progressionActorAccounting
            ?.completeStateMachines ?? 0,
        deadEndStateMachines:
          source.progressionActorAccounting
            ?.deadEndStateMachines ?? 0,
        unresolvedStateMachines:
          source.progressionActorAccounting
            ?.unresolvedStateMachines ?? 0,
        sourceEnteredDeadEndStates:
          source.progressionActorAccounting
            ?.sourceEnteredDeadEndStates ?? 0,
        duplicateProgressionAdvances:
          source.progressionActorAccounting
            ?.duplicateProgressionAdvances ?? 0,
        provenCrossIngressOrdinalAdvances:
          source.progressionActorAccounting
            ?.provenCrossIngressOrdinalAdvances ?? 0,
        idempotentCrossIngressEffectCalls:
          source.progressionActorAccounting
            ?.idempotentCrossIngressEffectCalls ?? 0,
        provenCrossIngressEffectCalls:
          source.progressionActorAccounting
            ?.provenCrossIngressEffectCalls ?? 0,
        unresolvedCrossIngressEffectCalls:
          source.progressionActorAccounting
            ?.unresolvedCrossIngressEffectCalls ?? 0,
        crossIngressEffectCalls:
          source.progressionActorAccounting
            ?.crossIngressEffectCalls.map((item) => ({
              scriptId: item.scriptId,
              ingress: item.ingress,
              target: item.target,
              callbackRegions:
                [...item.callbackRegions],
              status: item.status,
              directOrdinalAmount:
                item.directOrdinalAmount,
              ...(item.idempotencyKind === undefined
                ? {}
                : {
                    idempotencyKind:
                      item.idempotencyKind,
                  }),
              reason: item.reason,
            })) ?? [],
        crossIngressOrdinalAdvances:
          source.progressionActorAccounting
            ?.crossIngressOrdinalAdvances.map((item) => ({
              scriptId: item.scriptId,
              ingress: item.ingress,
              target: item.target,
              callbackRegions:
                [...item.callbackRegions],
              totalAmount:
                item.totalAmount,
              reason: item.reason,
            })) ?? [],
        progressionAdvances:
          source.progressionActorAccounting
            ?.progressionAdvances.map((item) => ({
              scriptId: item.scriptId,
              executionRegion:
                item.executionRegion,
              counterId: item.counterId,
              effectTarget:
                item.effectTarget,
              calls: item.calls,
              status: item.status,
              reason: item.reason,
            })) ?? [],
        stateMachines:
          source.progressionActorAccounting
            ?.stateMachines.map((item) => ({
              scriptId: item.scriptId,
              tableName: item.tableName,
              ...(item.stateType === undefined
                ? {}
                : {
                    stateType:
                      item.stateType,
                  }),
              status: item.status,
              activeStates:
                [...item.activeStates],
              terminalStates:
                [...item.terminalStates],
              deadEndStates:
                [...item.deadEndStates],
              sourceEnteredDeadEndStates:
                [...item.sourceEnteredDeadEndStates],
              reason: item.reason,
            })) ?? [],
        stateTransitions:
          source.progressionActorAccounting
            ?.stateTransitions.map((item) => ({
              scriptId: item.scriptId,
              target: item.target,
              from: item.from,
              to: item.to,
              ...(item.tableName === undefined
                ? {}
                : {
                    tableName:
                      item.tableName,
                  }),
              status: item.status,
              allowedTargets:
                [...item.allowedTargets],
              reason: item.reason,
            })) ?? [],
        unresolvedCounters:
          source.progressionActorAccounting
            ?.unresolvedCounters ?? 0,
        reconciledFromMatchedActorLifecycle:
          source.progressionActorAccounting
            ?.reconciledFromMatchedActorLifecycle ?? 0,
        details:
          source.progressionActorAccounting
            ?.counters.map((item) => ({
              scriptId: item.scriptId,
              counterId: item.counterId,
              kind: item.kind,
              growthWrites:
                item.growthWrites,
              decrementWrites:
                item.decrementWrites,
              replacementWrites:
                item.replacementWrites,
              completionChecks:
                item.completionChecks,
              lifecycleLinkedDecrements:
                item.lifecycleLinkedDecrements,
              deathLinkedDecrements:
                item.deathLinkedDecrements,
              removeLinkedDecrements:
                item.removeLinkedDecrements,
              reconciliationLifecycleKinds:
                [...item.reconciliationLifecycleKinds],
              deathLifecycleActorIdentifiers:
                [...item.deathLifecycleActorIdentifiers],
              removeLifecycleActorIdentifiers:
                [...item.removeLifecycleActorIdentifiers],
              scriptedRemovalActorIdentifiers:
                [...item.scriptedRemovalActorIdentifiers],
              terminalOnlyScriptedRemovalActorIdentifiers:
                [...item.terminalOnlyScriptedRemovalActorIdentifiers],
              nonTerminalScriptedRemovalActorIdentifiers:
                [...item.nonTerminalScriptedRemovalActorIdentifiers],
              unresolvedScriptedRemovalActorIdentifiers:
                [...item.unresolvedScriptedRemovalActorIdentifiers],
              scriptedRemovalScope:
                item.scriptedRemovalScope,
              uncoveredScriptedRemovalActorIdentifiers:
                [...item.uncoveredScriptedRemovalActorIdentifiers],
              scriptedRemovalCoverage:
                item.scriptedRemovalCoverage,
              immediateDespawnActorIdentifiers:
                [...item.immediateDespawnActorIdentifiers],
              conditionalDespawnActorIdentifiers:
                [...item.conditionalDespawnActorIdentifiers],
              reachableConditionalDespawnActorIdentifiers:
                [...item.reachableConditionalDespawnActorIdentifiers],
              terminalOnlyConditionalDespawnActorIdentifiers:
                [...item.terminalOnlyConditionalDespawnActorIdentifiers],
              inactiveConditionalDespawnActorIdentifiers:
                [...item.inactiveConditionalDespawnActorIdentifiers],
              activeInstantDespawnActorIdentifiers:
                [...item.activeInstantDespawnActorIdentifiers],
              uncoveredActiveInstantDespawnActorIdentifiers:
                [...item.uncoveredActiveInstantDespawnActorIdentifiers],
              uncoveredImmediateDespawnActorIdentifiers:
                [...item.uncoveredImmediateDespawnActorIdentifiers],
              unresolvedConditionalDespawnActorIdentifiers:
                [...item.unresolvedConditionalDespawnActorIdentifiers],
              quantityComparableGrowths:
                item.quantityComparableGrowths,
              quantityMatchedGrowths:
                item.quantityMatchedGrowths,
              quantityMismatchGrowths:
                item.quantityMismatchGrowths,
              spawnQuantityStatus:
                item.spawnQuantityStatus,
              actorIdentityStatus:
                item.actorIdentityStatus,
              deferredSpawnActorIdentifiers:
                [...item.deferredSpawnActorIdentifiers],
              deferredSpawnCallbacks:
                item.deferredSpawnCallbacks,
              deferredSpawnReservationStatus:
                item.deferredSpawnReservationStatus,
              deferredSpawnGenerationStatus:
                item.deferredSpawnGenerationStatus,
              deferredSpawnQuantityStatus:
                item.deferredSpawnQuantityStatus,
              spawnLinkedActorIdentifiers:
                [...item.spawnLinkedActorIdentifiers],
              lifecycleActorIdentifiers:
                [...item.lifecycleActorIdentifiers],
              matchedActorIdentifiers:
                [...item.matchedActorIdentifiers],
              status: item.status,
            })) ?? [],
      },
    },
    combat: {
      hurtHandlers:
        source.combatLifecycle?.hurtHandlers ?? 0,
      deathHandlers:
        source.combatLifecycle?.deathHandlers ?? 0,
      damageApplications:
        source.combatLifecycle?.damageApplications ?? 0,
      secondaryEffects:
        source.combatLifecycle?.secondaryEffects ?? 0,
      projectileSpawns:
        source.combatLifecycle?.projectileSpawns ?? 0,
      projectileRemovals:
        source.combatLifecycle?.projectileRemovals ?? 0,
      projectileCleanupGap:
        source.combatLifecycle?.projectileCleanupGap ?? 0,
      hurtOnlyTerminalRisk:
        source.combatLifecycle?.hurtOnlyTerminalRisk ?? 0,
      policy: {
        configured:
          source.combatPolicy?.configured ?? false,
        reviveContractContradictions:
          source.combatPolicy?.reviveContractContradictions ?? 0,
        projectileCleanupContractGap:
          source.combatPolicy?.projectileCleanupContractGap ?? 0,
        secondaryEffectEligibilitySurfaces:
          source.combatPolicy?.secondaryEffectEligibilitySurfaces ?? 0,
      },
      runtime: {
        reviveAnomalies:
          source.combatRuntime?.reviveAnomalies ?? 0,
        selfRevive:
          source.combatRuntime?.byKind["self-revive"] ?? 0,
        multipleRevivers:
          source.combatRuntime?.byKind["multiple-revivers"] ?? 0,
        staleRevive:
          source.combatRuntime?.byKind["stale-revive"] ?? 0,
        reviveAfterDeath:
          source.combatRuntime?.byKind["revive-after-death"] ?? 0,
        invalidReviver:
          source.combatRuntime?.byKind["invalid-reviver"] ?? 0,
        scopedLifeGenerationMissing:
          source.combatRuntime?.scopedLifeGenerationMissing ?? 0,
        scopedArenaGenerationMissing:
          source.combatRuntime?.scopedArenaGenerationMissing ?? 0,
      },
      paths:
        source.combatLifecycle?.paths.map((item) => ({
          scriptId: item.scriptId,
          event: item.event,
          callbackRegion: item.callbackRegion,
          reachableRegions: [...item.reachableRegions],
          projectileSpawns: item.projectileSpawns,
          projectileRemovals: item.projectileRemovals,
          damageApplications: item.damageApplications,
        })) ?? [],
    },
    inventory: {
      regions:
        source.inventoryLifecycle?.regions ?? 0,
      resetCandidates:
        source.inventoryLifecycle?.resetCandidates ?? 0,
      completeResets:
        source.inventoryLifecycle?.completeResets ?? 0,
      partialResets:
        source.inventoryLifecycle?.partialResets ?? 0,
      copyMutationRisks:
        source.inventoryLifecycle?.copyMutationRisks ?? 0,
      grantVerificationGaps:
        source.inventoryLifecycle?.grantVerificationGaps ?? 0,
      grantRegions:
        source.inventoryLifecycle?.grantRegions ?? 0,
      dropRegions:
        source.inventoryLifecycle?.dropRegions ?? 0,
      knownEquipmentSlots:
        source.inventoryLifecycle
          ?.knownEquipmentSlots.length ?? 0,
      unresolvedEquipmentSlotEvidence:
        source.inventoryLifecycle
          ?.unresolvedEquipmentSlotEvidence ?? 0,
      restoreOwnership: {
        pathways:
          source.inventoryRestoreOwnership
            ?.restorePathways ?? 0,
        deterministicItemRestores:
          source.inventoryRestoreOwnership
            ?.deterministicItemRestores ?? 0,
        unknownIdentityGrants:
          source.inventoryRestoreOwnership
            ?.unknownIdentityGrants ?? 0,
        multipleRestoreOwners:
          source.inventoryRestoreOwnership
            ?.multipleRestoreOwners ?? 0,
        initialSessionDuplicateOwners:
          source.inventoryRestoreOwnership
            ?.initialSessionDuplicateOwners ?? 0,
        initialSessionOverlapUnresolved:
          source.inventoryRestoreOwnership
            ?.initialSessionOverlapUnresolved ?? 0,
      },
      policy: {
        configured:
          source.inventoryPolicy?.configured ?? false,
        resolvedItemClasses:
          source.inventoryPolicy
            ?.resolvedItemClasses ?? 0,
        uncoveredItemClasses:
          source.inventoryPolicy
            ?.uncoveredItemClasses ?? 0,
        unknownIdentityEvidence:
          source.inventoryPolicy
            ?.unknownIdentityEvidence ?? 0,
        deniedDrops:
          source.inventoryPolicy
            ?.deniedDrops ?? 0,
        uncoveredDrops:
          source.inventoryPolicy
            ?.uncoveredDrops ?? 0,
        unknownDrops:
          source.inventoryPolicy
            ?.unknownDrops ?? 0,
      },
      assessments:
        source.inventoryLifecycle?.assessments.map((item) => ({
          scriptId: item.scriptId,
          executionRegion: item.executionRegion,
          status: item.status,
          itemGrants: item.itemGrants,
          checkedItemGrants:
            item.checkedItemGrants,
          unverifiedItemGrants:
            item.unverifiedItemGrants,
          propagatedItemGrants:
            item.propagatedItemGrants,
          itemDrops: item.itemDrops,
        })) ?? [],
      restoreConflicts:
        source.inventoryRestoreOwnership?.conflicts.map((item) => ({
          lifecycleEvent: item.lifecycleEvent,
          itemIdentifier: item.itemIdentifier,
          ownerCallbackRegions: [...item.ownerCallbackRegions],
        })) ?? [],
      crossLifecycleRestoreConflicts:
        source.inventoryRestoreOwnership?.crossLifecycleConflicts.map(
          (item) => ({
            itemIdentifier: item.itemIdentifier,
            lifecycleEvents: [...item.lifecycleEvents] as [
              "player-join",
              "player-spawn",
            ],
            ownerCallbackRegions:
              [...item.ownerCallbackRegions],
          }),
        ) ?? [],
    },
    worldRules: {
      writes:
        source.worldRuleAuthority?.writes.length ?? 0,
      conflicts:
        source.worldRuleAuthority?.conflicts.length ?? 0,
      naturalMobSpawning:
        source.worldRuleAuthority?.naturalMobSpawning ?? "unresolved",
      scriptSpawnEntityPaths:
        source.worldRuleAuthority?.scriptSpawnEntityPaths ?? 0,
      commandSummonPaths:
        source.worldRuleAuthority?.commandSummonPaths ?? 0,
      manualEntitySpawnPaths:
        source.worldRuleAuthority?.manualEntitySpawnPaths ?? 0,
    },
    capabilityMutationFootprint: {
      broadCapabilityDetected:
        source.capabilityMutationFootprint?.broadCapabilityDetected ?? false,
      covered:
        source.capabilityMutationFootprint?.covered ?? 0,
      partial:
        source.capabilityMutationFootprint?.partial ?? 0,
      unresolved:
        source.capabilityMutationFootprint?.unresolved ?? 0,
      surfaces:
        source.capabilityMutationFootprint?.surfaces.map((item) => ({
          surface: item.surface,
          status: item.status,
          requiredBecause: [...item.requiredBecause],
          reason: item.reason,
        })) ?? [],
    },
    clientReconciliation: {
      predictedMutationCancellations:
        source.clientMutationReconciliation?.predictedMutationCancellations ?? 0,
      liquidOrWaterlogCancellations:
        source.clientMutationReconciliation?.liquidOrWaterlogCancellations ?? 0,
      blockPlaceCancellations:
        source.clientMutationReconciliation?.blockPlaceCancellations ?? 0,
      blockBreakCancellations:
        source.clientMutationReconciliation?.blockBreakCancellations ?? 0,
      interactionCancellations:
        source.clientMutationReconciliation?.interactionCancellations ?? 0,
    },
    capabilityExposure: {
      exposed:
        source.capabilityExposure?.exposed ?? 0,
      potentiallyExposed:
        source.capabilityExposure?.potentiallyExposed ?? 0,
      releaseBlocking:
        source.capabilityExposure?.releaseBlocking ?? 0,
      unresolved:
        source.capabilityExposure?.unresolved ?? 0,
      exposures:
        source.capabilityExposure?.exposures.map((item) => ({
          capabilityId: item.capabilityId,
          capabilityLabel: item.capabilityLabel,
          status: item.status,
          prerequisiteReachability:
            item.prerequisiteReachability,
          impact: item.impact,
          evidenceIds: [...item.evidenceIds],
          reasons: [...item.reasons],
          ...(item.resolutionBasis === undefined
            ? {}
            : { resolutionBasis: item.resolutionBasis }),
        })) ?? [],
    },
    playerCapabilities: {
      gamemodeWrites:
        source.playerCapabilitySurfaces?.gamemodeWrites ?? 0,
      creativeModeGrants:
        source.playerCapabilitySurfaces?.creativeModeGrants ?? 0,
      spectatorModeGrants:
        source.playerCapabilitySurfaces?.spectatorModeGrants ?? 0,
      abilityWrites:
        source.playerCapabilitySurfaces?.abilityWrites ?? 0,
      mayflyGrants:
        source.playerCapabilitySurfaces?.mayflyGrants ?? 0,
      commandPermissionWrites:
        source.playerCapabilitySurfaces?.commandPermissionWrites ?? 0,
      privilegedGuardReferences:
        source.playerCapabilitySurfaces?.privilegedGuardReferences ?? 0,
      privilegedBypassReturns:
        source.playerCapabilitySurfaces?.privilegedBypassReturns ?? 0,
      protectionDefinitions:
        source.playerCapabilitySurfaces?.protectionDefinitions.length ?? 0,
      inactiveProtectionDefinitions:
        source.playerCapabilitySurfaces?.inactiveProtectionDefinitions ?? 0,
    },
    state: {
      semanticSurfaces:
        source.semanticIr.stateSurfaces,
      semanticOperations:
        source.semanticIr.stateOperations,
      broadWrites: source.broadWrites,
      objectiveAuthorities:
        objectiveAuthority.map(
          (item) => ({
            ...item,
            contractIds:
              [...item.contractIds],
            authorityKeys:
              [...item.authorityKeys],
          }),
        ),
      declaredObjectiveAuthorities:
        objectiveAuthority.filter(
          (item) =>
            item.status === "declared",
        ).length,
      undeclaredObjectiveAuthorities:
        objectiveAuthority.filter(
          (item) =>
            item.status === "undeclared",
        ).length,
      multipleObjectiveAuthorities:
        objectiveAuthority.filter(
          (item) =>
            item.status ===
            "multiple-authorities",
        ).length,
    },
    structures: {
      ...source.structures,
      transitionResidueRisks:
        source.structures
          .transitionResidueRisks ?? 0,
      transitionResidueUnresolved:
        source.structures
          .transitionResidueUnresolved ?? 0,
      loadCorrelations:
        [...(source.structures.loadCorrelations ?? [])],
      transitionResidue:
        [...(source.structures.transitionResidue ?? [])],
    },
    analysisDemand: [...(source.analysisDemand ?? [])],
    platformKnowledge: {
      profileResolved:
        source.platformKnowledge?.profileResolved ?? false,
      profileSource:
        source.platformKnowledge?.profileSource ?? "unresolved",
      claims: [...(source.platformKnowledge?.claims ?? [])],
    },
    entities: {
      ...source.entities,
      resolvedSpawnEvidence:
        source.arena.entitySpawnEvidence?.length ?? 0,
      aiStack: {
        states:
          source.entityAiStack?.states ?? 0,
        targetedStates:
          source.entityAiStack?.targetedStates ?? 0,
        targetedStackComplete:
          source.entityAiStack
            ?.targetedStackComplete ?? 0,
        targetedStackIncomplete:
          source.entityAiStack
            ?.targetedStackIncomplete ?? 0,
        navigationWithoutMovement:
          source.entityAiStack
            ?.navigationWithoutMovement ?? 0,
        targetedWithoutNavigation:
          source.entityAiStack
            ?.targetedWithoutNavigation ?? 0,
        movementGoalWithoutNavigation:
          source.entityAiStack
            ?.movementGoalWithoutNavigation ?? 0,
        assessments:
          source.entityAiStack?.assessments.map((item) => ({
            entityKey: item.entityKey,
            stateId: item.stateId,
            status: item.status,
            missingSurfaces: [...item.missingSurfaces],
          })) ?? [],
      },
      navigationEnvironment: {
        contracts:
          source.routeNavigationEnvironment
            ?.contracts ?? 0,
        compatible:
          source.routeNavigationEnvironment
            ?.compatible ?? 0,
        incompatible:
          source.routeNavigationEnvironment
            ?.incompatible ?? 0,
        stateDependent:
          source.routeNavigationEnvironment
            ?.stateDependent ?? 0,
        unresolved:
          source.routeNavigationEnvironment
            ?.unresolved ?? 0,
        assessments:
          source.routeNavigationEnvironment?.assessments.map((item) => ({
            contractId: item.contractId,
            routeId: item.routeId,
            entityKey: item.entityKey,
            status: item.status,
            reasons: [...item.reasons],
          })) ?? [],
      },
    },
    analysisExecution: {
      executedCapabilityIds: [
        "semantic-ir-state-model",
        "script-spatial-integrity",
        ...(
          (source.analysisDemand ?? []).includes(
            "world-structure",
          )
            ? ["structure-transition-integrity"]
            : []
        ),
        ...(
          (source.analysisDemand ?? []).includes(
            "temporal-ownership",
          )
            ? ["temporal-ownership-integrity"]
            : []
        ),
        ...(
          source.platformKnowledge?.profileResolved
            ? ["platform-knowledge-applicability"]
            : []
        ),
        ...(
          (source.analysisDemand ?? []).includes(
            "arena-lifecycle",
          ) &&
          source.arena.lifecycle !== undefined
            ? ["arena-lifecycle-integrity"]
            : []
        ),
        ...(
          (source.analysisDemand ?? []).includes(
            "multiplayer-interleaving",
          ) &&
          (
            source.arena.stateIsolation !== undefined ||
            source.arena.globalState !== undefined
          )
            ? ["multiplayer-interleaving"]
            : []
        ),
        ...(
          (source.analysisDemand ?? []).includes(
            "chunk-simulation",
          ) &&
          source.chunkLifecycle !== undefined
            ? ["chunk-lifecycle-integrity"]
            : []
        ),
        ...(
          (source.analysisDemand ?? []).includes(
            "entity-behavior",
          ) &&
          source.entityAiStack !== undefined &&
          source.routeNavigationEnvironment !== undefined
            ? ["entity-ai-navigation-readiness"]
            : []
        ),
        ...(
          (source.analysisDemand ?? []).includes(
            "combat-lifecycle",
          ) &&
          source.combatLifecycle !== undefined
            ? ["combat-lifecycle-contract"]
            : []
        ),
        ...(
          (source.analysisDemand ?? []).includes(
            "inventory-state",
          ) &&
          source.inventoryLifecycle !== undefined
            ? ["inventory-lifecycle-integrity"]
            : []
        ),
        ...(
          (source.analysisDemand ?? []).includes(
            "persistence-recovery",
          ) &&
          source.persistenceSource !== undefined
            ? ["persistence-lifecycle-integrity"]
            : []
        ),
        ...(
          (source.analysisDemand ?? []).includes(
            "economy-reward",
          ) &&
          source.rewardSources !== undefined
            ? ["economy-reward-integrity"]
            : []
        ),
      ].sort(),
    },
    intent: {
      invariants: source.intent.invariants.length,
      unknowns: source.intent.unknowns
        .map((item) => ({
          id: item.id,
          question: item.question,
          blockedSubjectIds: [
            ...item.blockedSubjectIds,
          ],
        }))
        .sort((a, b) =>
          a.id.localeCompare(b.id)
        ),
    },
  };
}
