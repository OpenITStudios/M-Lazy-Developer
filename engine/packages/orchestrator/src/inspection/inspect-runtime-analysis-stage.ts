import { assessArenaResetClosure } from "../arena/arena-reset-closure-analysis.js";
import {
  entityHasConfiguredTargeting,
  entityHasNavigation,
  entityRuntimeKey,
} from "../../../../analyzers/entities/src/index.js";
import { structureRuntimeDiagnostics } from "../../../../analyzers/diagnostics/src/index.js";
import type { DiagnosticFinding } from "../../../diagnostics/src/index.js";
import type { GameplayIntentModel } from "../../../gameplay-intent/src/index.js";
import type { InspectTargetProfile } from "../core/types.js";
import type { InspectionSourceIndex } from "./inspect-source-index.js";
import { analyzeFunctionTopology } from "./topology-analysis.js";
import { analyzeStructureAndChunkRuntime } from "./structure-runtime-analysis.js";
import { correlateScriptStructureLoads } from "./script-structure-correlation.js";
import { derivePlacedEmbeddedCommands } from "./structure-placement-analysis.js";
import { derivePlacementProofs } from "./structure-proof-analysis.js";
import { correlateRouteMutations } from "./route-mutation-analysis.js";
import { deriveGameplayRouteCorridors } from "./gameplay-route-corridor.js";
import { analyzeMutationTransactionOrdering } from "../repair/mutation-transaction-analysis.js";
import { analyzeScriptMutationTransactions } from "../repair/script-mutation-transaction-analysis.js";
import { analyzeScriptCommandMutationTransactions } from "./script-command-transaction-analysis.js";
import { extractArenaConcurrencyCapacity } from "../arena/arena-capacity-extraction.js";
import { arenaCapacityDiagnostics } from "../../../../analyzers/diagnostics/src/index.js";
import { analyzeScriptSafeConfig } from "./script-safe-config-analysis.js";
import {
  deriveCrossFileCallEdges,
  type CrossFileCallEdge,
} from "../../../../analyzers/scripts/src/index.js";
import { reconcileArenaLayouts } from "../arena/arena-layout-reconciliation.js";
import { analyzeArenaLifecycleConvergence } from "../arena/arena-lifecycle-analysis.js";
import { analyzeArenaCleanupSurfaces } from "../arena/arena-cleanup-surface-analysis.js";
import { analyzeArenaStateIsolation } from "../arena/arena-state-isolation-analysis.js";
import { analyzeScriptSpatialMutations } from "./script-spatial-analysis.js";
import { analyzeSpatialAuthorityCoverage } from "./spatial-authority-analysis.js";
import { analyzeArenaGlobalState } from "../arena/arena-global-state-analysis.js";
import { analyzeInventoryLifecycle } from "./inventory-lifecycle-analysis.js";
import { analyzeInventoryContract } from "./inventory-contract-analysis.js";
import { analyzeInventoryRestoreOwnership } from "./inventory-restore-ownership-analysis.js";
import { analyzeCombatLifecycle } from "./combat-lifecycle-analysis.js";
import { analyzeCombatBehaviorContract } from "./combat-contract-analysis.js";
import { analyzePlayerSessionLifecycle } from "./player-session-lifecycle-analysis.js";
import { analyzeChunkLifecycle } from "./chunk-lifecycle-analysis.js";
import { analyzePersistenceSource } from "./persistence-source-analysis.js";
import { analyzeRewardSources } from "./reward-source-analysis.js";
import { analyzeEconomyBehaviorContract } from "./economy-contract-analysis.js";
import { createDiagnostic } from "../../../diagnostics/src/index.js";
import {
  derivePreflightKnowledgeDemand,
} from "./preflight-knowledge-demand.js";
import {
  analyzeWorldRuleAuthority,
} from "./world-rule-authority-analysis.js";
import {
  analyzePlayerCapabilitySurfaces,
} from "./player-capability-surface-analysis.js";
import {
  analyzeClientMutationReconciliation,
} from "./client-mutation-reconciliation-analysis.js";
import {
  analyzeCapabilityMutationFootprint,
} from "./capability-mutation-footprint-analysis.js";
import {
  analyzeProgressionActorAccounting,
} from "./progression-actor-accounting-analysis.js";
import {
  analyzeCommandContext,
  commandContextDiagnostics,
} from "./command-context-analysis.js";
import {
  analyzeEntityPopulationSources,
  entityPopulationSourceDiagnostics,
} from "./entity-population-analysis.js";
import {
  analyzeInteractionLifecycle,
} from "./interaction-lifecycle-analysis.js";
import {
  deriveEntityEventExternalEvidence,
} from "./entity-event-evidence.js";
import {
  deriveProgressionActiveStateValues,
  deriveScriptTerminalIdempotencyEvidence,
  deriveScriptTerminalPrecedenceEvidence,
  deriveScriptProgressionAdvanceEvidence,
  deriveScriptProgressionIdempotencyEvidence,
  deriveScriptProgressionOrdinalAdvanceEvidence,
  deriveScriptProgressionActiveCallEvidence,
  deriveScriptProgressionActiveEventEvidence,
  deriveScriptProgressionActiveTransitionEvidence,
  deriveScriptProgressionStateTransitionEvidence,
} from "../../../../analyzers/scripts/src/index.js";

export interface InspectionRuntimeAnalysisInput {
  target: InspectTargetProfile;
  gameplayIntent?: GameplayIntentModel;
  parsedFunctions: InspectionSourceIndex["parsedFunctions"];
  parsedScripts: InspectionSourceIndex["parsedScripts"];
  /** Reuse the selected-artifact ESM call resolution already sent to Semantic IR. */
  crossFileCallEdges?: readonly CrossFileCallEdge[];
  parsedEntities: InspectionSourceIndex["parsedEntities"];
  entityAiStack: import("./entity-ai-stack-analysis.js").EntityAiStackAnalysis;
  routeNavigationEnvironment: import("./route-navigation-environment-analysis.js").RouteNavigationEnvironmentAnalysis;
  combatRuntimeTelemetry: import("./combat-runtime-telemetry-analysis.js").CombatRuntimeTelemetryAnalysis;
  parsedStructureModels:
    InspectionSourceIndex["parsedStructureModels"];
}

export function analyzeInspectionRuntimeState(
  input: InspectionRuntimeAnalysisInput,
) {
  const parsedFunctionModels =
    input.parsedFunctions.map((item) => item.parsed);

  const parsedStructureSummaries =
    input.parsedStructureModels.map((item) => ({
      identifier: item.identifier,
      relativePath: item.node.source.relativePath,
      ...(item.size ? { size: item.size } : {}),
      ...(item.footprint
        ? { footprint: item.footprint }
        : {}),
      semantics: item.semantics,
    }));

  const structureRuntime =
    analyzeStructureAndChunkRuntime(
      parsedFunctionModels,
      parsedStructureSummaries,
    );

  const scriptStructureLoads =
    correlateScriptStructureLoads(
      input.parsedScripts.map((item) => item.parsed),
      parsedStructureSummaries,
    );

  const sourceByFunction = new Map(
    input.parsedFunctions.map((item) => [
      item.parsed.identifier,
      item.node.source,
    ]),
  );

  const diagnostics: DiagnosticFinding[] = [
    ...structureRuntimeDiagnostics(
      structureRuntime,
      sourceByFunction,
    ),
  ];

  const placedEmbeddedCommands =
    structureRuntime.correlations.flatMap(
      (correlation) => {
        if (correlation.status !== "resolved") {
          return [];
        }

        const parsed =
          input.parsedStructureModels.find(
            (item) =>
              item.identifier ===
              correlation.load.semantics.name,
          );
        if (!parsed) return [];

        return derivePlacedEmbeddedCommands(
          {
            ...(correlation.load.semantics.position
              ? {
                  position:
                    correlation.load.semantics.position,
                }
              : {}),
            ...(correlation.load.semantics.rotation
              ? {
                  rotation:
                    correlation.load.semantics.rotation,
                }
              : {}),
            ...(correlation.load.semantics.mirror
              ? {
                  mirror:
                    correlation.load.semantics.mirror,
                }
              : {}),
          },
          parsed.size,
          parsed.embeddedCommands.map(
            (item) => item.block,
          ),
        ).map((item) => ({
          target:
            correlation.load.semantics.name,
          flatIndex: item.flatIndex,
          worldX: item.world.x,
          worldY: item.world.y,
          worldZ: item.world.z,
          chunkX: Math.floor(item.world.x / 16),
          chunkZ: Math.floor(item.world.z / 16),
          command: item.command,
          confidence: item.confidence,
        }));
      },
    );

  const parsedScriptModels =
    input.parsedScripts.map((item) => item.parsed);
  const worldRuleAuthority =
    analyzeWorldRuleAuthority(
      input.parsedScripts.map((item) => ({
        parsed: item.parsed,
        ...(item.text === undefined
          ? {}
          : { text: item.text }),
      })),
    );
  const playerCapabilitySurfaces =
    analyzePlayerCapabilitySurfaces(
      input.parsedScripts.map((item) => ({
        parsed: item.parsed,
        ...(item.text === undefined
          ? {}
          : { text: item.text }),
      })),
    );
  const clientMutationReconciliation =
    analyzeClientMutationReconciliation(
      input.parsedScripts.map((item) => ({
        parsed: item.parsed,
        ...(item.text === undefined
          ? {}
          : { text: item.text }),
      })),
    );
  const preflightKnowledgeDemand =
    derivePreflightKnowledgeDemand({
      ...(input.gameplayIntent === undefined ? {} : { intent: input.gameplayIntent }),
      scripts: parsedScriptModels,
      entityCount: input.parsedEntities.length,
      target: input.target,
    });
  const demanded = new Set(
    preflightKnowledgeDemand,
  );
  const scriptsFor = (
    domain: import("../../../analysis-planner/src/index.js").AnalysisKnowledgeDomain,
  ) =>
    demanded.has(domain)
      ? parsedScriptModels
      : [];
  const scriptInputsFor = (
    domain: import("../../../analysis-planner/src/index.js").AnalysisKnowledgeDomain,
  ) =>
    demanded.has(domain)
      ? input.parsedScripts.map((item) => ({
          parsed: item.parsed,
          ...(item.text === undefined
            ? {}
            : { text: item.text }),
        }))
      : [];
  const interactionLifecycle =
    analyzeInteractionLifecycle(
      input.parsedScripts,
    );

  const entityAiStack =
    input.entityAiStack;
  const routeNavigationEnvironment =
    input.routeNavigationEnvironment;
  const scriptSpatial =
    analyzeScriptSpatialMutations(parsedScriptModels);
  const spatialAuthority =
    (input.target.spatialAuthorityContract ?? input.target.spatialAuthorityPolicy) === undefined
      ? undefined
      : analyzeSpatialAuthorityCoverage(
          input.target.arenaRegionContracts ?? [],
          (input.target.spatialAuthorityContract ?? input.target.spatialAuthorityPolicy)!,
          input.target.spatialAuthorityRequirements ?? [],
        );

  const topology =
    analyzeFunctionTopology(
      parsedFunctionModels,
      {
        arenaRegionContracts:
          input.target.arenaRegionContracts ?? [],
        additionalResolvedEffects:
          scriptSpatial.resolvedEffects,
      },
    );
  diagnostics.push(
    ...topology.stateDiagnostics,
    ...topology.topologyDiagnostics,
  );

  const scriptSafeConfig =
    analyzeScriptSafeConfig(parsedScriptModels);

  const crossFileCalls =
    input.crossFileCallEdges ?? deriveCrossFileCallEdges(
      input.parsedScripts.flatMap((item) =>
        item.text === undefined
          ? []
          : [{
              path:
                item.node.source.relativePath,
              text: item.text,
              source: item.node.source,
            }],
      ),
    );
  // Import/declaration resolution belongs to the existing ESM owner.
  // The session projection is still source navigation, not cleanup proof.
  const playerSessionLifecycle = analyzePlayerSessionLifecycle(
    parsedScriptModels, crossFileCalls,
  );

  const entityEventEvidence =
    deriveEntityEventExternalEvidence(
      parsedFunctionModels,
      parsedScriptModels,
    );
  const progressionActiveEventEvidence =
    input.parsedScripts.flatMap((item) => {
      if (item.text === undefined) {
        return [];
      }
      const activeStateValues =
        deriveProgressionActiveStateValues(
          item.parsed
            .transitionDeclarations ??
            [],
        );
      return deriveScriptProgressionActiveEventEvidence(
        item.text,
        item.node.source,
        activeStateValues,
      );
    });
  const progressionActiveCallEvidence =
    input.parsedScripts.flatMap((item) => {
      if (item.text === undefined) {
        return [];
      }
      const activeStateValues =
        deriveProgressionActiveStateValues(
          item.parsed
            .transitionDeclarations ??
            [],
        );
      return deriveScriptProgressionActiveCallEvidence(
        item.text,
        item.node.source,
        activeStateValues,
      );
    });
  const progressionActiveTransitionEvidence =
    input.parsedScripts.flatMap((item) =>
      item.text === undefined
        ? []
        : [{
            sourcePath:
              item.node.source.relativePath,
            evidence:
              deriveScriptProgressionActiveTransitionEvidence(
                item.text,
                item.node.source,
                deriveProgressionActiveStateValues(
                  item.parsed
                    .transitionDeclarations ??
                    [],
                ),
              ),
          }]
    );
  const progressionStateTransitionEvidence =
    input.parsedScripts.flatMap((item) =>
      item.text === undefined
        ? []
        : deriveScriptProgressionStateTransitionEvidence(
            item.text,
            item.node.source,
          )
    );
  const progressionAdvanceEvidence =
    input.parsedScripts.flatMap((item) =>
      item.text === undefined
        ? []
        : deriveScriptProgressionAdvanceEvidence(
            item.text,
            item.node.source,
          )
    );
  const progressionOrdinalAdvanceEvidence =
    input.parsedScripts.flatMap((item) =>
      item.text === undefined
        ? []
        : deriveScriptProgressionOrdinalAdvanceEvidence(
            item.text,
            item.node.source,
          )
    );
  const progressionIdempotencyEvidence =
    input.parsedScripts.flatMap((item) =>
      item.text === undefined
        ? []
        : deriveScriptProgressionIdempotencyEvidence(
            item.text,
            item.node.source,
          )
    );
  const effectiveProgressionActiveEventEvidence = [
    ...progressionActiveEventEvidence,
    ...progressionActiveTransitionEvidence.flatMap(
      (item) => item.evidence.events,
    ),
  ];
  const effectiveProgressionActiveCallEvidence = [
    ...progressionActiveCallEvidence,
    ...progressionActiveTransitionEvidence.flatMap(
      (item) => item.evidence.calls,
    ),
  ];
  const terminalIdempotencyEvidence =
    input.parsedScripts.flatMap((item) =>
      item.text === undefined
        ? []
        : deriveScriptTerminalIdempotencyEvidence(
            item.text,
            item.node.source,
          )
    );
  const terminalPrecedenceEvidence =
    input.parsedScripts.flatMap((item) =>
      item.text === undefined
        ? []
        : deriveScriptTerminalPrecedenceEvidence(
            item.text,
            item.node.source,
          )
    );

  const arenaLifecycle =
    analyzeArenaLifecycleConvergence(
      scriptsFor("arena-lifecycle"),
      demanded.has("arena-lifecycle")
        ? crossFileCalls
        : [],
      demanded.has("arena-lifecycle")
        ? terminalIdempotencyEvidence
        : [],
      demanded.has("arena-lifecycle")
        ? terminalPrecedenceEvidence
        : [],
    );
  const progressionActorAccounting =
    analyzeProgressionActorAccounting(
      input.parsedScripts.map((item) => ({
        parsed: item.parsed,
        ...(item.text === undefined
          ? {}
          : { text: item.text }),
      })),
      crossFileCalls,
      input.parsedEntities.map(
        (item) => item.parsed,
      ),
      arenaLifecycle,
      entityEventEvidence,
      effectiveProgressionActiveEventEvidence,
      effectiveProgressionActiveCallEvidence,
      progressionStateTransitionEvidence,
      progressionAdvanceEvidence,
      progressionOrdinalAdvanceEvidence,
      progressionIdempotencyEvidence,
    );

  const entityPopulation =
    analyzeEntityPopulationSources(
      input.parsedEntities.map(
        (item) => item.parsed,
      ),
      parsedScriptModels,
      {
        naturalMobSpawning:
          worldRuleAuthority
            .naturalMobSpawning,
        generationBoundRegistryAuthorities:
          progressionActorAccounting
            .generationBoundRegistryAuthorities,
      },
    );
  diagnostics.push(
    ...entityPopulationSourceDiagnostics(
      entityPopulation,
    ),
  );

  const arenaCleanupSurfaces =
    analyzeArenaCleanupSurfaces(
      scriptsFor("arena-lifecycle"),
    );
  const inventoryLifecycle =
    analyzeInventoryLifecycle(
      scriptsFor("inventory-state"),
      {
        requiresFullEquipmentReset:
          playerCapabilitySurfaces.creativeModeGrants > 0,
      },
    );
  const inventoryPolicy =
    analyzeInventoryContract(
      scriptsFor("inventory-state"),
      input.target.inventoryItemContract ?? input.target.inventoryItemPolicy,
    );
  const inventoryRestoreOwnership =
    analyzeInventoryRestoreOwnership(
      scriptInputsFor("inventory-state"),
    );
  const capabilityMutationFootprint =
    analyzeCapabilityMutationFootprint({
      playerCapabilities:
        playerCapabilitySurfaces,
      arenaCleanup:
        arenaCleanupSurfaces,
      inventory:
        inventoryLifecycle,
      ...(spatialAuthority === undefined
        ? {}
        : { spatialAuthority }),
    });
  const combatLifecycle =
    analyzeCombatLifecycle(
      scriptsFor("combat-lifecycle"),
    );
  const chunkLifecycle =
    analyzeChunkLifecycle(
      scriptsFor("chunk-simulation"),
    );
  const persistenceSource =
    analyzePersistenceSource(
      scriptsFor("persistence-recovery"),
    );
  const rewardSources =
    analyzeRewardSources(
      scriptsFor("economy-reward"),
      demanded.has("economy-reward")
        ? parsedFunctionModels
        : [],
      demanded.has("economy-reward")
        ? input.parsedEntities.map(
            (item) => item.parsed,
          )
        : [],
    );
  const combatPolicy =
    analyzeCombatBehaviorContract(
      combatLifecycle,
      input.combatRuntimeTelemetry,
      input.target.combatContract ?? input.target.combatPolicy,
    );
  const economyPolicy =
    analyzeEconomyBehaviorContract(
      rewardSources,
      input.target.economyContract ?? input.target.economyPolicy,
    );
  const arenaGlobalState =
    analyzeArenaGlobalState(
      demanded.has("multiplayer-interleaving")
        ? parsedFunctionModels
        : [],
      scriptsFor("multiplayer-interleaving"),
    );
  const arenaStateIsolation =
    analyzeArenaStateIsolation(
      scriptsFor("multiplayer-interleaving"),
      input.target.stateAuthorityContracts ?? [],
      demanded.has("multiplayer-interleaving") ? crossFileCalls : [],
    );

  for (const assessment of arenaGlobalState.assessments) {
    const mutation =
      arenaGlobalState.mutations.find(
        (item) =>
          item.id === assessment.mutationId,
      );
    if (!mutation || !mutation.arenaScoped) continue;

    if (assessment.status === "unleased") {
      diagnostics.push(
        createDiagnostic({
          code: "WORLDSTATE_GLOBAL_LEASE_MISSING",
          severity: "medium",
          message:
            `Arena-scoped mutation of world-global resource ${assessment.resource} has no matching static lease evidence.`,
          source: mutation.source,
          data: {
            resource: assessment.resource,
            ownerId: mutation.ownerId,
            executionRegion:
              mutation.executionRegion,
          },
        }),
      );
    }

    if (!assessment.audited) {
      diagnostics.push(
        createDiagnostic({
          code: "WORLDSTATE_GLOBAL_MUTATION_NOT_AUDITED",
          severity: "minor",
          message:
            `Arena-scoped mutation of world-global resource ${assessment.resource} has no explicit static audit helper evidence.`,
          source: mutation.source,
          data: {
            resource: assessment.resource,
            ownerId: mutation.ownerId,
            leaseStatus: assessment.status,
          },
        }),
      );
    }
  }

  const arenaLayoutReconciliation =
    reconcileArenaLayouts(
      topology.arenaReplicaDiscovery,
      scriptSafeConfig.resolvedArenaLayout,
    );

  const arenaCapacity =
    extractArenaConcurrencyCapacity({
      ...(topology.arenaReplicaDiscovery === undefined
        ? {}
        : { discovery: topology.arenaReplicaDiscovery }),
      tickingAreas: structureRuntime.tickingAreas.map(
        (item) => ({
          functionId: item.functionId,
          ...(item.line === undefined
            ? {}
            : { line: item.line }),
          semantics: item.tickingArea,
        }),
      ),
      scripts: parsedScriptModels,
      ...(scriptSafeConfig.resolvedArenaCount === undefined
        ? {}
        : {
            declaredArenaCount:
              scriptSafeConfig.resolvedArenaCount,
          }),
      ...(scriptSafeConfig.resolvedArenaConcurrencyLimit === undefined
        ? {}
        : {
            declaredConcurrentArenaLimit:
              scriptSafeConfig.resolvedArenaConcurrencyLimit,
          }),
    });
  if (arenaCapacity.report) {
    diagnostics.push(
      ...arenaCapacityDiagnostics(arenaCapacity.report),
    );
  }

  const commandContext =
    analyzeCommandContext(
      parsedScriptModels,
      (
        topology.arenaReplicaDiscovery
          ?.replicas.length ?? 0
      ) > 0 ||
      (
        scriptSafeConfig
          .resolvedArenaCount ?? 0
      ) > 1,
    );
  diagnostics.push(
    ...commandContextDiagnostics(
      commandContext,
    ),
  );

  const structureProofs = derivePlacementProofs(
    structureRuntime,
    parsedFunctionModels,
  );

  const explicitRouteCorridors =
    input.target.routeCorridors ?? [];
  const explicitRouteIds = new Set(
    explicitRouteCorridors.map(
      (route) => route.routeId ?? route.id,
    ),
  );

  const derivedGameplayRouteCorridors =
    (input.gameplayIntent === undefined
      ? []
      : deriveGameplayRouteCorridors(
          input.gameplayIntent,
          {
            ...(input.target.staticExecutionDimension === undefined
              ? {}
              : {
                  dimension:
                    input.target.staticExecutionDimension,
                }),
          },
        )).filter(
      (item) =>
        !explicitRouteIds.has(
          item.contract.routeId ?? item.contract.id,
        ),
    );

  const effectiveRouteCorridors = [
    ...explicitRouteCorridors,
    ...derivedGameplayRouteCorridors.map(
      (item) => item.contract,
    ),
  ];

  const routeCorrelations = correlateRouteMutations(
    effectiveRouteCorridors,
    topology,
    structureProofs,
    input.target.staticExecutionDimension,
  );

  const navigatingEntities = new Map(
    input.parsedEntities
      .map((item) => item.parsed)
      .filter(entityHasNavigation)
      .map((entity) => [
        entityRuntimeKey(entity),
        [entity.source] as const,
      ]),
  );

  const targetDrivenEntities = new Map(
    input.parsedEntities
      .map((item) => item.parsed)
      .filter(entityHasConfiguredTargeting)
      .map((entity) => [
        entityRuntimeKey(entity),
        [entity.source] as const,
      ]),
  );

  const mutationTransactions =
    analyzeMutationTransactionOrdering(
      parsedFunctionModels,
      structureProofs,
      input.target.mutationDependentActions ?? [],
    );

  const scriptMutationTransactions =
    analyzeScriptMutationTransactions(
      input.parsedScripts.map((item) => item.parsed),
      input.target.mutationDependentActions ?? [],
    );

  const resetMutationTransactions =
    mutationTransactions.assessments.filter(
      (item) =>
        /(?:reset|cleanup|restore|baseline)/i.test(
          item.rootFunctionId,
        ),
    );
  const baselineRestore = {
    candidates:
      resetMutationTransactions.length,
    verified:
      resetMutationTransactions.filter(
        (item) =>
          item.verificationStep !==
            undefined &&
          (
            item.status ===
              "verified-before-dependent" ||
            item.status ===
              "no-dependent-action"
          ),
      ).length,
    unresolved:
      resetMutationTransactions.filter(
        (item) =>
          item.verificationStep ===
            undefined ||
          item.status ===
            "dependent-before-verification" ||
          item.status ===
            "verification-unresolved",
      ).length,
  };

  const arenaResetClosure =
    assessArenaResetClosure({
      cleanup: arenaCleanupSurfaces,
      inventory: {
        unresolvedResetPairs: Math.max(0, inventoryLifecycle.resetCandidates - inventoryLifecycle.completeResets),
        unresolvedLoadoutTransactions: inventoryLifecycle.unresolvedLoadoutTransactions,
      },
      capability: {
        unguardedMutationRegions: capabilityMutationFootprint.unresolved,
      },
      combat: combatPolicy,
      interaction:
        interactionLifecycle,
      chunk: chunkLifecycle,
      worldRules:
        worldRuleAuthority,
      baselineRestore,
      entityPopulation: {
        registryAuthorities:
          progressionActorAccounting
            .registryAuthorityAssessments
            .length,
        generationBoundAuthorities:
          progressionActorAccounting
            .generationBoundRegistryAuthorities,
        unresolvedAuthorities:
          progressionActorAccounting
            .unboundRegistryAuthorities +
          progressionActorAccounting
            .unresolvedRegistryAuthorities,
        multiplicityContradictions:
          progressionActorAccounting
            .provenSpawnQuantityMismatch,
        autonomousReplacementSources:
          entityPopulation
            .autonomousReplacementSources,
        replacementLineage:
          entityPopulation
            .replacementLineage,
        unresolvedSpawnCommits:
          entityPopulation
            .unresolvedSpawnCommits,
      },
    });

  const scriptCommandTransactions =
    analyzeScriptCommandMutationTransactions(
      input.parsedScripts.map((item) => item.parsed),
      parsedStructureSummaries,
      input.target.mutationDependentActions ?? [],
    );

  return {
    parsedFunctionModels,
    parsedStructureSummaries,
    preflightKnowledgeDemand,
    worldRuleAuthority,
    playerCapabilitySurfaces,
    playerSessionLifecycle,
    clientMutationReconciliation,
    entityAiStack,
    entityPopulation,
    interactionLifecycle,
    routeNavigationEnvironment,
    structureRuntime,
    scriptStructureLoads,
    sourceByFunction,
    placedEmbeddedCommands,
    topology,
    scriptSpatial,
    ...(spatialAuthority === undefined
      ? {}
      : { spatialAuthority }),
    scriptSafeConfig,
    arenaLifecycle,
    arenaCleanupSurfaces,
    arenaResetClosure,
    inventoryLifecycle,
    inventoryPolicy,
    inventoryRestoreOwnership,
    capabilityMutationFootprint,
    combatLifecycle,
    progressionActorAccounting,
    chunkLifecycle,
    persistenceSource,
    rewardSources,
    combatPolicy,
    economyPolicy,
    arenaGlobalState,
    arenaStateIsolation,
    arenaLayoutReconciliation,
    arenaCapacity,
    commandContext,
    structureProofs,
    routeCorrelations,
    effectiveRouteCorridors,
    derivedGameplayRouteCorridors,
    navigatingEntities,
    targetDrivenEntities,
    mutationTransactions,
    scriptMutationTransactions,
    scriptCommandTransactions,
    diagnostics,
  };
}
