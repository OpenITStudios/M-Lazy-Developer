export { structureIdentifier } from "./inspect-identifiers.js";
import { performance } from "node:perf_hooks";
import { discoverInspectionPacks, resolveSelectedScriptRoots } from "./inspect-packs.js";
import {
  indexInspectionSources,
  type InspectionSourceIndex,
} from "./inspect-source-index.js";
import { SemanticGraph } from "../../../graph/src/index.js";
import { analyzeInspectionScriptCompatibility } from "./inspect-script-compatibility.js";
import { populateInspectionScriptImportGraph } from "./inspect-script-import-graph.js";
import { enrichInspectionSemanticGraph } from "./inspect-graph-enrichment.js";
import { analyzeInspectionEntityKnowledge } from "./inspect-entity-knowledge-stage.js";
import { analyzeInspectionRuntimeState } from "./inspect-runtime-analysis-stage.js";
import { analyzeInspectionEducation } from "./inspect-education-stage.js";
import { analyzeInspectionCausality } from "./inspect-causality-stage.js";
import { buildInspectionResult } from "./inspect-result.js";
import { prepareInspectionRuntimeEvidence } from "./inspect-runtime-evidence.js";
import { classifyContentPath } from "../../../../analyzers/discovery/src/index.js";
import { referenceDiagnostics } from "../../../../analyzers/diagnostics/src/index.js";
import { classifyOwnedLootTableSourceRoutes } from "../../../../analyzers/references/src/index.js";
import { duplicateManifestUuidDiagnostics } from "../../../../analyzers/diagnostics/src/index.js";
import { buildFilesystemInventory } from "../../../project-model/src/index.js";
import type { FileInventoryEntry, RuntimeEvidenceRecord } from "../../../project-model/src/index.js";
import type { KnowledgeCatalog } from "../../../knowledge/src/index.js";
import type {
  InspectDirectoryResult,
  InspectTargetProfile,
} from "../core/types.js";
import { analyzeKnowledgeRuntime } from "./knowledge-runtime-analysis.js";
import { structureRuntimeEvidence } from "./structure-runtime-evidence.js";
import { scriptStructureRuntimeEvidence } from "./script-structure-correlation.js";
import { areaLoadedBlockWriteEvidence } from "../diagnosis/area-loaded-proof.js";
import { mutationTransactionRuntimeEvidence } from "../repair/mutation-transaction-analysis.js";
import { scriptMutationTransactionRuntimeEvidence } from "../repair/script-mutation-transaction-analysis.js";
import { scriptCommandMutationRuntimeEvidence } from "./script-command-transaction-analysis.js";
import { routeMutationRuntimeEvidence } from "./route-mutation-analysis.js";
import { topologyRuntimeEvidence } from "../diagnosis/topology-runtime-evidence.js";
import type { RuntimeProbeResponse } from "../../../project-model/src/index.js";
import type { TelemetryBatch, TelemetryEvent } from "../../../project-model/src/index.js";
import {
  externalEventRootsForEntity,
  deriveAuthoredEntityBehaviorRelations,
} from "./entity-event-evidence.js";
import { buildInspectionSemanticIr } from "../diagnosis/semantic-ir-stage.js";
import {
  deriveCrossFileCallEdges,
  resolveScriptImports,
  type CrossFileCallEdge,
} from "../../../../analyzers/scripts/src/index.js";
import { semanticIrDiagnostics } from "../diagnosis/semantic-ir-diagnostics.js";
import { buildGameplayIntentModel } from "./gameplay-intent-stage.js";
import {
  deriveGameplayIntentSurfaceSignals,
  deriveAuthoredDialogueBehaviorRelations,
} from "./gameplay-intent-surface-signals.js";
import { deriveGameplayResourceTextSignals } from "./gameplay-intent-resource-text.js";
import { indexSelectedArtifactContractSources } from "./inspect-contract-source.js";
import { analyzeGameplayIntentRuntime } from "./gameplay-intent-runtime-stage.js";
import { analyzeEntityAiStacks } from "./entity-ai-stack-analysis.js";
import { combatContractDiagnostics } from "./combat-contract-diagnostics.js";
import { chunkLifecycleDiagnostics } from "./chunk-lifecycle-diagnostics.js";
import { economyContractDiagnostics } from "./economy-contract-diagnostics.js";
import { spatialAuthorityDiagnostics } from "./spatial-authority-diagnostics.js";
import {
  assessObjectiveAuthorityDeclarations,
  objectiveAuthorityDiagnostics,
} from "./state-authority-analysis.js";
import { inventoryLifecycleDiagnostics } from "./inventory-lifecycle-diagnostics.js";
import { entityAiNavigationDiagnostics } from "./entity-ai-navigation-diagnostics.js";
import { arenaLifecycleDiagnostics } from "../arena/arena-lifecycle-diagnostics.js";
import { analyzeRouteNavigationEnvironments } from "./route-navigation-environment-analysis.js";
import { analyzeReleaseIdentity } from "../release/release-identity-analysis.js";
import type {
  GameDesignMapClassification,
} from "../../../game-design-spec/src/index.js";

/**
 * Transient, fingerprint-bound physical source inventory for repeated RIG
 * passes of the same selected ZIP. No filesystem state or gameplay proof is
 * persisted here. Domain-specific analyses must still be re-evaluated.
 */
export interface InspectionFileInventoryReuse {
  readonly artifactId: string;
  readonly sourceFingerprint: string;
  files?: FileInventoryEntry[];
  /** Same source bytes as the cached parser snapshot. Absent for no
   * module calls, failed clone, or a source-index pass with parse failures.
   * Never a second graph/evidence authority.
   */
  crossFileCallEdges?: CrossFileCallEdge[];
}

/**
 * Reuse only source-derived parsing inside one hash-pinned prepared audit.
 * The key is the existing ephemeral inventory-reuse owner, not a persisted
 * cache or a second gameplay-evidence authority. Keep the source-only graph
 * snapshot separate from the graph that the first pass will enrich.
 */
const parsedSourceIndexSnapshots = new WeakMap<
  InspectionFileInventoryReuse,
  Omit<InspectionSourceIndex, "graph">
>();

// Source snapshots are an optional RIG acceleration, never a proof owner.
// Refuse deep clones when known source strings/typed structure arrays alone
// exceed the cap. The independent reparse remains the safe fallback.
const SOURCE_INDEX_SNAPSHOT_BUDGET_BYTES = 32 * 1024 * 1024;
function sourceIndexSnapshotWithinBudget(
  index: Omit<InspectionSourceIndex, "graph">,
): boolean {
  let bytes = 0;
  for (const script of index.parsedScripts) {
    bytes += (script.text?.length ?? script.parsed.text?.length ?? 0) * 2;
    if (bytes > SOURCE_INDEX_SNAPSHOT_BUDGET_BYTES) return false;
  }
  for (const structure of index.parsedStructureModels) {
    for (const layer of structure.footprintSource?.blockIndexLayers ?? []) {
      bytes += ArrayBuffer.isView(layer.indices)
        ? layer.indices.byteLength
        : layer.indices.length * 8;
      if (bytes > SOURCE_INDEX_SNAPSHOT_BUDGET_BYTES) return false;
    }
  }
  return true;
}

export async function inspectDirectory(
  root: string,
  artifactId = "art_working",
  target: InspectTargetProfile = {},
  sourceFingerprint?: string,
  knowledgeCatalog?: KnowledgeCatalog,
  externalEvidence: readonly RuntimeEvidenceRecord[] = [],
  telemetryEvents: readonly TelemetryEvent[] = [],
  telemetryDroppedEvents = 0,
  runtimeProbeResponses: readonly RuntimeProbeResponse[] = [],
  runtimeProbeDroppedExchanges = 0,
  mapClassification?: GameDesignMapClassification,
  sourceInventoryReuse?: InspectionFileInventoryReuse,
): Promise<InspectDirectoryResult> {
  const runtimeEvidenceStage =
    prepareInspectionRuntimeEvidence({
      telemetryEvents,
      telemetryDroppedEvents,
      runtimeProbeResponses,
      runtimeProbeDroppedExchanges,
    });
  const {
    telemetryEvidence,
    runtimeProbeEvidence,
    telemetryContinuity,
    telemetryEvidenceIntegrity,
    runtimeProbeEvidenceIntegrity,
    diagnostics,
  } = runtimeEvidenceStage;
  if (
    sourceInventoryReuse !== undefined &&
    (
      sourceFingerprint === undefined ||
      sourceInventoryReuse.artifactId !== artifactId ||
      sourceInventoryReuse.sourceFingerprint !== sourceFingerprint
    )
  ) {
    throw new Error(
      "Selected source inventory reuse does not match the current artifact fingerprint.",
    );
  }

  // Content hashing is independent of RIG demand, so it is safe to reuse
  // within this already hash-pinned artifact invocation.
  const files = sourceInventoryReuse?.files === undefined
    ? await buildFilesystemInventory(root)
    : sourceInventoryReuse.files.map((file) => ({ ...file }));
  for (const file of files) file.kindHint = classifyContentPath(file.relativePath).kindHint;
  if (sourceInventoryReuse !== undefined && sourceInventoryReuse.files === undefined) {
    sourceInventoryReuse.files = files.map((file) => ({ ...file }));
  }

  const { packs, manifests } = await discoverInspectionPacks(
    root,
    artifactId,
    files,
  );

  // RIG's second pass changes demanded analysis domains, not selected
  // source bytes. Rehydrate fresh node and parser objects so the first
  // pass's graph enrichment, diagnostics and downstream consumers cannot
  // alter the second pass. Parser failures are never cached: retry them
  // against the independent working copy, like failed native DB reads.
  const sourceIndexStartedAt = performance.now();
  const sourceSnapshot = sourceInventoryReuse === undefined
    ? undefined
    : parsedSourceIndexSnapshots.get(sourceInventoryReuse);
  let sourceIndex: InspectionSourceIndex;
  if (sourceSnapshot !== undefined) {
    const parsed = structuredClone(sourceSnapshot);
    const graph = new SemanticGraph();
    for (const node of parsed.nodes) graph.addNode(node);
    sourceIndex = { ...parsed, graph };
  } else {
    sourceIndex = await indexInspectionSources(root, artifactId, files);
    if (sourceInventoryReuse !== undefined &&
        sourceIndex.coverage.parseFailures.length === 0) {
      const { graph: indexedGraph, ...parsed } = sourceIndex;
      // Source indexing currently produces nodes only. If a future parser
      // adds edges or unaccounted graph nodes, conservatively re-index the
      // next pass instead of silently dropping source evidence.
      if (indexedGraph.allEdges().length === 0 &&
          indexedGraph.allNodes().length === parsed.nodes.length &&
          sourceIndexSnapshotWithinBudget(parsed)) {
        try {
          parsedSourceIndexSnapshots.set(
            sourceInventoryReuse,
            structuredClone(parsed),
          );
        } catch {
          // Unsupported clone payloads must not block auditing. Keep the
          // canonical parser as the next pass's fallback.
          parsedSourceIndexSnapshots.delete(sourceInventoryReuse);
        }
      }
    }
  }
  const sourceIndexWork: NonNullable<InspectDirectoryResult["sourceIndexWork"]> = {
    action: sourceSnapshot === undefined ? "PARSED" : "REUSED",
    elapsedMs: Math.max(0, performance.now() - sourceIndexStartedAt),
    relevantFiles: sourceIndex.coverage.relevantFiles,
    indexedFiles: sourceIndex.coverage.indexedFiles,
    parseFailures: sourceIndex.coverage.parseFailures.length,
    snapshotReusable: sourceInventoryReuse !== undefined &&
      parsedSourceIndexSnapshots.has(sourceInventoryReuse),
  };
  const {
    graph,
    nodes,
    parsedFunctions,
    parsedScripts,
    parsedEntities,
    parsedDialogueDocuments,
    parsedStructureModels,
    tickFunctionRegistrations,
    diagnostics: sourceDiagnostics,
  } = sourceIndex;
  diagnostics.push(...sourceDiagnostics);

  // One exact selected-source import resolution feeds graph, manifest root
  // closure and Semantic IR; RIG passes rebuild this from the same SHA.
  const resolvedScriptImports = resolveScriptImports(
    parsedScripts.map(item => item.parsed),
  );
  const manifestScriptRoots = resolveSelectedScriptRoots(
    { packs, manifests },
    parsedScripts.map(item => item.parsed),
    resolvedScriptImports,
  );

  const contractSources =
    await indexSelectedArtifactContractSources(
      root,
      artifactId,
      files,
      target.contractSourceRoots === undefined
        ? {}
        : {
            contractSourceRoots:
              target.contractSourceRoots,
          },
    );

  // Cross-file source call edges are also a pure function of the pinned
  // selected scripts. On modular maps the analyzer reparses every module
  // into a TypeScript AST. Reuse only when the parsed-index snapshot is
  // reused; domain requests, model tasks, and runtime proof are NOT cached.
  const hasCrossFileImports = parsedScripts.some(({ parsed }) =>
    parsed.imports.some(item =>
      item.kind === "relative" && !item.typeOnly &&
      item.importSyntax === undefined));
  const cachedCrossFileCalls = sourceSnapshot === undefined
    ? undefined
    : sourceInventoryReuse?.crossFileCallEdges;
  const crossFileCallEdges = cachedCrossFileCalls !== undefined
    ? structuredClone(cachedCrossFileCalls)
    : hasCrossFileImports
      ? deriveCrossFileCallEdges(
          parsedScripts.flatMap(({ parsed, text }) =>
            text === undefined ? [] : [{
              path: parsed.source.relativePath,
              text,
              source: parsed.source,
            }]),
        )
      : [];
  if (cachedCrossFileCalls === undefined && hasCrossFileImports &&
      sourceInventoryReuse !== undefined &&
      parsedSourceIndexSnapshots.has(sourceInventoryReuse)) {
    try {
      sourceInventoryReuse.crossFileCallEdges =
        structuredClone(crossFileCallEdges);
    } catch {
      // A non-cloneable future edge payload must not block source
      // inspection; fall back to canonical reanalysis on the next pass.
      delete sourceInventoryReuse.crossFileCallEdges;
    }
  }
  const authoredBehaviorRelations = deriveAuthoredEntityBehaviorRelations({
    entities: parsedEntities.map(item => item.parsed),
    controllerSources: nodes.filter(node =>
      node.kind === "animation_controller" && node.source !== undefined)
      .map(node => ({ raw: node.data, source: node.source! })),
    animationSources: nodes.filter(node =>
      node.kind === "animation" && node.source !== undefined)
      .map(node => ({ raw: node.data, source: node.source! })),
    functions: parsedFunctions.map(item => item.parsed),
    scripts: parsedScripts.map(item => item.parsed),
  });
  const semanticIr = buildInspectionSemanticIr({
    parsedFunctions,
    resolvedScriptImports,
    ...(manifestScriptRoots === undefined ? {} : { manifestScriptRoots }),
    authoredBehaviorRelations: [
      ...authoredBehaviorRelations,
      ...deriveAuthoredDialogueBehaviorRelations(parsedDialogueDocuments),
    ],
    parsedScripts,
    crossFileCallEdges,
    tickFunctionRegistrations,
    stateAuthorityContracts:
      target.stateAuthorityContracts ?? [],
  });

  diagnostics.push(
    ...semanticIrDiagnostics(semanticIr),
  );

  const gameplayResourceText =
    await deriveGameplayResourceTextSignals(
      root,
      files,
    );

  const gameplaySurfaceSignals = [
    ...deriveGameplayIntentSurfaceSignals({
      functions: parsedFunctions.map(
        (item) => ({
          identifier:
            item.parsed.identifier,
          source:
            item.parsed.source,
        }),
      ),
      dialogues:
        parsedDialogueDocuments,
      structures:
        parsedStructureModels,
      entities:
        parsedEntities,
    }),
    ...gameplayResourceText.signals,
  ];

  const gameplayIntent = buildGameplayIntentModel({
    id: "gameplay-intent:" + artifactId,
    artifactId,
    parsedScripts,
    parsedFunctions,
    contractScripts: contractSources,
    supplementalSignals:
      gameplaySurfaceSignals,
    playerFacingTextCues: gameplayResourceText.playerFacingCues,
    // This inventory is generated from selected archive bytes before source
    // interpretation. Supplemental hints may NOT authorize their own path.
    selectedSourceInventoryPaths: files.map(file => file.relativePath),
    crossFileCallEdges,
    semanticIr,
  });

  const objectiveAuthority =
    assessObjectiveAuthorityDeclarations(
      gameplayIntent,
      target.stateAuthorityContracts ?? [],
    );
  diagnostics.push(
    ...objectiveAuthorityDiagnostics(
      objectiveAuthority,
    ),
  );

  const entityAiStack =
    analyzeEntityAiStacks(
      parsedEntities.map(
        (item) => item.parsed,
      ),
    );

  const routeNavigationEnvironment =
    analyzeRouteNavigationEnvironments(
      target.routeNavigationEnvironments ?? [],
      entityAiStack,
    );

  const gameplayIntentRuntime = analyzeGameplayIntentRuntime(
    gameplayIntent,
    runtimeEvidenceStage.runtimeStateObservations,
    runtimeEvidenceStage.runtimeOutcomeObservations,
    runtimeEvidenceStage.runtimeRouteObservations,
    runtimeEvidenceStage.runtimeNavigationStallObservations,
    runtimeEvidenceStage.runtimeNavigationTargetObservations,
    runtimeEvidenceStage.runtimeRouteReachabilityObservations,
    runtimeEvidenceStage.runtimeRouteChunkAvailabilityObservations,
    {
      ...(target.staticExecutionDimension === undefined
        ? {}
        : {
            dimension:
              target.staticExecutionDimension,
          }),
      entityAiStack,
      routeNavigationEnvironment,
    },
  );

  enrichInspectionSemanticGraph({
    graph,
    nodes,
    artifactId,
    parsedFunctions,
    parsedEntities,
    parsedDialogueDocuments,
    parsedStructureModels,
    tickFunctionRegistrations,
  });

  populateInspectionScriptImportGraph(
    graph,
    parsedScripts,
    resolvedScriptImports,
  );

  diagnostics.push(
    ...analyzeInspectionScriptCompatibility(
      manifests,
      parsedScripts,
    ),
  );

  const manifestModelsForKnowledge =
    manifests.map((item) => item.manifest);
  const parsedFunctionModelsForKnowledge =
    parsedFunctions.map((item) => item.parsed);

  const entityKnowledge = analyzeInspectionEntityKnowledge({
    target,
    ...(knowledgeCatalog === undefined
      ? {}
      : { knowledgeCatalog }),
    manifests: manifestModelsForKnowledge,
    parsedFunctions,
    parsedScripts,
    parsedEntities,
  });
  const { entityEventEvidence } =
    entityKnowledge;
  diagnostics.push(...entityKnowledge.diagnostics);

  diagnostics.push(
    ...duplicateManifestUuidDiagnostics(manifests.map((entry) => entry.manifest)),
    ...referenceDiagnostics([
      ...graph.unresolvedEdges().filter((edge) => edge.type !== "IMPORTS_MINECRAFT_MODULE"),
      ...graph.ambiguousEdges(),
    ], classifyOwnedLootTableSourceRoutes(graph)),
  );

  const runtimeAnalysis =
    analyzeInspectionRuntimeState({
      target,
      gameplayIntent,
      parsedFunctions,
      parsedScripts,
      crossFileCallEdges,
      parsedEntities,
      entityAiStack,
      routeNavigationEnvironment,
      combatRuntimeTelemetry:
        runtimeEvidenceStage
          .combatRuntimeTelemetry,
      parsedStructureModels,
    });
  const {
    parsedFunctionModels,
    structureRuntime,
    scriptStructureLoads,
    sourceByFunction,
    topology,
    structureProofs,
    routeCorrelations,
    navigatingEntities,
    targetDrivenEntities,
    mutationTransactions,
    scriptMutationTransactions,
    scriptCommandTransactions,
    combatPolicy,
    chunkLifecycle,
  } = runtimeAnalysis;
  diagnostics.push(...runtimeAnalysis.diagnostics);

  diagnostics.push(
    ...combatContractDiagnostics(
      combatPolicy,
    ),
    ...chunkLifecycleDiagnostics(
      chunkLifecycle,
    ),
    ...economyContractDiagnostics(
      runtimeAnalysis.economyPolicy,
    ),
    ...spatialAuthorityDiagnostics(
      runtimeAnalysis.spatialAuthority,
    ),
    ...inventoryLifecycleDiagnostics(
      runtimeAnalysis.inventoryLifecycle,
      runtimeAnalysis.inventoryPolicy,
      runtimeAnalysis.inventoryRestoreOwnership,
    ),
    ...entityAiNavigationDiagnostics(
      runtimeAnalysis.entityAiStack,
      runtimeAnalysis.routeNavigationEnvironment,
    ),
    ...arenaLifecycleDiagnostics(
      runtimeAnalysis.arenaLifecycle,
      runtimeAnalysis.arenaCleanupSurfaces,
    ),
  );

  const releaseIdentity = analyzeReleaseIdentity(
    packs,
    runtimeAnalysis.scriptSafeConfig,
    target,
  );
  diagnostics.push(...releaseIdentity.findings);

  const knowledgeRuntime = analyzeKnowledgeRuntime(
    knowledgeCatalog,
    target,
    manifestModelsForKnowledge,
    parsedFunctionModelsForKnowledge,
    [
      ...structureRuntimeEvidence(
        structureRuntime,
        sourceByFunction,
        structureProofs,
      ),
      ...topologyRuntimeEvidence(topology),
      ...areaLoadedBlockWriteEvidence(
        structureRuntime,
        parsedFunctionModels,
      ),
      ...routeMutationRuntimeEvidence(
        routeCorrelations,
        navigatingEntities,
        targetDrivenEntities,
      ),
      ...mutationTransactionRuntimeEvidence(
        mutationTransactions.assessments,
      ),
      ...scriptMutationTransactionRuntimeEvidence(
        scriptMutationTransactions,
      ),
      ...scriptStructureRuntimeEvidence(scriptStructureLoads),
      ...scriptCommandMutationRuntimeEvidence(
        scriptCommandTransactions,
      ),
      ...externalEvidence,
      ...telemetryEvidence,
      ...runtimeProbeEvidence.records,
    ],
    parsedScripts.map((item) => item.parsed),
    parsedEntities.map((item) => ({
      entity: item.parsed,
      externalRootEvents: externalEventRootsForEntity(
        item.parsed,
        entityEventEvidence,
      ),
    })),
  );
  diagnostics.push(...knowledgeRuntime.diagnostics);

  const education = analyzeInspectionEducation({
    target,
    manifests: manifestModelsForKnowledge,
    parsedStructureModels,
  });
  diagnostics.push(...education.diagnostics);

  const causal = analyzeInspectionCausality({
    ...(sourceFingerprint === undefined
      ? {}
      : { sourceFingerprint }),
    graph,
    semanticIr,
    ...(knowledgeCatalog === undefined
      ? {}
      : { knowledgeCatalog }),
    target,
    externalEvidence,
    telemetryEvidence,
    runtimeProbeEvidenceRecords:
      runtimeProbeEvidence.records,
    telemetryEvidenceIntegrity,
    runtimeProbeEvidenceIntegrity,
    telemetryContinuity,
    runtimeProbeDroppedExchanges,
    diagnostics,
    validationCases:
      knowledgeRuntime.validationCases,
  });

  return {
    ...buildInspectionResult({
      artifactId,
    ...(sourceFingerprint === undefined
      ? {}
      : { sourceFingerprint }),
    files,
    packs,
    target,
    knowledgeCatalogPresent:
      knowledgeCatalog !== undefined,
    sourceIndex,
    semanticIr,
    gameplayIntent,
    contractSourceFiles:
      contractSources.length,
    gameplayIntentRuntime,
    runtimeEvidenceStage,
    entityKnowledge,
    knowledgeRuntime,
    runtimeAnalysis,
    releaseIdentity,
    education,
    causal,
    telemetryEvents,
    telemetryDroppedEvents,
    runtimeProbeDroppedExchanges,
    ...(mapClassification === undefined
      ? {}
      : { mapClassification }),
      diagnostics,
    }),
    sourceIndexWork,
  };
}
