import { mkdtemp, mkdir, cp, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { NORMAL_EXTRACTION_BUDGET } from "../../../archive/src/index.js";
import { extractZipSafely, type ZipInventoryResult } from "../../../archive/src/index.js";
import { sha256File, artifactIdFromFingerprint } from "../../../artifact/src/index.js";
import {
  inspectDirectory,
  type InspectionFileInventoryReuse,
} from "./inspect.js";
import type { InspectDirectoryResult, InspectTargetProfile } from "../core/types.js";
import type { KnowledgeCatalog } from "../../../knowledge/src/index.js";
import {
  analyzeWorldDbNative,
  type WorldDbNativeSummary,
} from "./world-db-analysis.js";
import { worldDbRuntimeEvidence } from "./world-db-runtime-evidence.js";
import { correlateEmbeddedCommandsWithNativeChunks } from "./embedded-native-correlation.js";
import type { TelemetryBatch, TelemetryEvent } from "../../../project-model/src/index.js";
import { isTelemetryBatch, resolveTelemetryEventsForArtifact } from "../diagnosis/telemetry-load.js";
import type { RuntimeProbeTranscript } from "../../../project-model/src/index.js";
import { assertRuntimeProbeTranscriptArtifact } from "../diagnosis/runtime-probe-load.js";
import { auditArenaNativeSpatialContent } from "../arena/arena-native-extraction.js";
import { openBedrockLevelDbSnapshot } from "../../../../adapters/leveldb/src/index.js";
import { proveArenaBarrierEnclosure, proveArenaVoxelEquivalence } from "../arena/arena-voxel-proof.js";
import { proveArenaBlockEntityEquivalence } from "../arena/arena-block-entity-proof.js";
import { proveArenaStructureInstances } from "../arena/arena-structure-instance-proof.js";
import { proveArenaEntityPopulation } from "../arena/arena-entity-population-proof.js";
import { proveArenaActorPopulation } from "../arena/arena-actor-population-proof.js";
import { proveArenaTickStateEquivalence } from "../arena/arena-tick-state-proof.js";
import { extractPersistedPackIdentities } from "../release/persisted-pack-identity.js";
import { packIdentityDriftDiagnostics } from "../../../../analyzers/diagnostics/src/index.js";
import { partitionArenaProofVolumes, spatialLayoutFromReplicaDiscovery } from "../../../../analyzers/topology/src/index.js";
import { deriveScriptArenaLayoutFallback } from "../arena/script-arena-layout-fallback.js";
import { deriveArenaProofCoverage } from "../arena/arena-proof-coverage.js";
import { concludeArenaProof } from "../arena/arena-proof-conclusion.js";
import { deriveArenaReplicaProofQuality } from "../arena/arena-replica-proof-quality.js";
import { createDiagnostic } from "../../../diagnostics/src/index.js";
import { deriveArenaStressPlan } from "../arena/arena-stress-plan.js";
import { deriveArenaRepeatedRunValidationPlan } from "../arena/arena-repeated-run-validation.js";
import { localizeArenaRepairSources } from "../arena/arena-repair-localization.js";
import { bridgeArenaRepairLocalization } from "../arena/arena-repair-bridge.js";
import { arenaProofLayerEnabled, planArenaProofExecution } from "../arena/arena-proof-execution-plan.js";
import { deriveGameplayWorldModel } from "./gameplay-world-model.js";
import { projectGameplaySemanticModel } from "./gameplay-semantic-model.js";
import { projectMapEngineeringAssessment } from "./map-engineering-assessment.js";
import { refreshHiddenGameplayDefectsForWorld } from "./hidden-gameplay-defect-analysis.js";
import { deriveInspectionEngineeringAnalyses } from "./engineering-analysis-stage.js";
import { assessGameplayDiscoveryClosure } from "./gameplay-discovery-closure.js";
import { challengeGameplayDiscovery } from "./gameplay-discovery-challenger.js";
import { assessGameplayScenarioClosure } from "./gameplay-scenario-closure.js";
import { deriveGameplayAnalysisPriorities } from "./gameplay-analysis-priority.js";
import { collectArtifactReleaseObservations } from "../release/release-identity-evidence.js";
import { analyzeReleaseIdentity } from "../release/release-identity-analysis.js";
import { deriveMandatoryAuditProcedureReceipt } from "./mandatory-audit-procedure.js";
import {
  assertMapClassificationRoutingHint,
  type MapClassificationRoutingHint,
} from "../map-classification-routing.js";

export interface InspectArtifactResult extends InspectDirectoryResult {
  artifactId: string;
  fingerprint: string;
  archiveEntries: number;
  levelName?: string;
}

interface PreparedArtifactSource {
  readonly sessionRoot: string;
  readonly sourceRoot: string;
  readonly fingerprint: string;
  readonly inventory: ZipInventoryResult;
  readonly sourceInventoryReuse: InspectionFileInventoryReuse;
  nativeWorldDb?: WorldDbNativeSummary;
}

type PreparedArtifactInspect = (
  target?: InspectTargetProfile,
  knowledgeCatalog?: KnowledgeCatalog,
  telemetry?: readonly TelemetryEvent[] | TelemetryBatch,
  runtimeProbeTranscript?: RuntimeProbeTranscript,
  mapClassificationHint?: MapClassificationRoutingHint,
  expectedArtifactFingerprint?: string,
) => Promise<InspectArtifactResult>;

function assertExpectedArchiveFingerprint(
  fingerprint: string,
  expectedArtifactFingerprint?: string,
): void {
  if (expectedArtifactFingerprint !== undefined) {
    const expected = expectedArtifactFingerprint
      .replace(/^sha256:/i, "")
      .toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(expected) || expected !== fingerprint) {
      throw new Error(
        "Selected .mcworld SHA-256 differs from the acquired artifact; refusing stale or substituted audit input.",
      );
    }
  }
}

/** Re-evaluate the prepared immutable source on an independent working copy. */
async function inspectPreparedArtifact(
  path: string,
  prepared: PreparedArtifactSource,
  target: InspectTargetProfile = {},
  knowledgeCatalog?: KnowledgeCatalog,
  telemetry: readonly TelemetryEvent[] | TelemetryBatch = [],
  runtimeProbeTranscript?: RuntimeProbeTranscript,
  mapClassificationHint?: MapClassificationRoutingHint,
  expectedArtifactFingerprint?: string,
): Promise<InspectArtifactResult> {
  const fingerprint = await sha256File(path);
  if (fingerprint !== prepared.fingerprint) {
    throw new Error(
      "Selected .mcworld changed since preparation; refusing mixed-version audit.",
    );
  }
  assertExpectedArchiveFingerprint(fingerprint, expectedArtifactFingerprint);
  const mapClassification =
    mapClassificationHint === undefined
      ? undefined
      : assertMapClassificationRoutingHint(
          mapClassificationHint,
          fingerprint,
        );
  const artifactId = artifactIdFromFingerprint(fingerprint);
  const telemetryEvents = resolveTelemetryEventsForArtifact(
    telemetry,
    artifactId,
  );
  const telemetryDroppedEvents = isTelemetryBatch(telemetry)
    ? telemetry.droppedEvents ?? 0
    : 0;
  if (runtimeProbeTranscript) {
    assertRuntimeProbeTranscriptArtifact(
      runtimeProbeTranscript,
      artifactId,
    );
  }
  const runtimeProbeResponses =
    runtimeProbeTranscript?.exchanges.map(
      (exchange) => exchange.response,
    ) ?? [];
  const workingRoot = await mkdtemp(join(prepared.sessionRoot, "working-"));
  try {
    const inventory = prepared.inventory;
    // Native LevelDB readers can create files; each pass has its own copy.
    await cp(prepared.sourceRoot, workingRoot, { recursive: true });

    // Native DB summary is determined by selected source bytes, not by
    // RIG knowledge demand. Do not cache FAILED reads: retry them on pass 2.
    const nativeWorldDb = prepared.nativeWorldDb === undefined
      ? await analyzeWorldDbNative(workingRoot)
      : structuredClone(prepared.nativeWorldDb);
    if (prepared.nativeWorldDb === undefined && nativeWorldDb.status !== "failed") {
      prepared.nativeWorldDb = structuredClone(nativeWorldDb);
    }
    const result = await inspectDirectory(
      workingRoot,
      artifactId,
      target,
      fingerprint,
      knowledgeCatalog,
      worldDbRuntimeEvidence(nativeWorldDb),
      telemetryEvents,
      telemetryDroppedEvents,
      runtimeProbeResponses,
      runtimeProbeTranscript?.droppedExchanges ?? 0,
      mapClassification,
      prepared.sourceInventoryReuse,
    );

    const levelName = await readFile(
      join(workingRoot, "levelname.txt"),
      "utf8",
    ).then(
      (value) => value.trim(),
      () => undefined,
    );
    const releaseObservations =
      collectArtifactReleaseObservations({
        artifactPath: path,
        artifactId,
        ...(levelName === undefined ||
        levelName.length === 0
          ? {}
          : { levelName }),
      });
    const finalReleaseIdentity =
      analyzeReleaseIdentity(
        result.packs,
        result.scriptSafeConfig,
        target,
        releaseObservations,
      );
    const scriptLayoutFallback =
      result.arenaAnalysis.discovery === undefined
        ? deriveScriptArenaLayoutFallback(
            result.scriptSafeConfig,
            target.arenaRegionContracts ?? [],
          )
        : undefined;

    const spatialLayout =
      result.arenaAnalysis.discovery === undefined
        ? scriptLayoutFallback?.layout
        : spatialLayoutFromReplicaDiscovery(
            result.arenaAnalysis.discovery,
            result.arenaAnalysis.layoutReconciliation?.status ===
              "consistent"
              ? "reconciled"
              : "topology",
          );

    const stressPlan =
      deriveArenaStressPlan(
        spatialLayout,
        result.arenaAnalysis.capacity,
      );
    const repeatedRunPlan =
      deriveArenaRepeatedRunValidationPlan();

    const effectiveRegionPlan =
      result.arenaAnalysis.regionPlan ??
      scriptLayoutFallback?.regionPlan;
    const effectiveRegionClassification =
      result.arenaAnalysis.regionClassification ??
      scriptLayoutFallback?.regionClassification;

    const fullArenaProofRequested =
      target.arenaProofMode === "full";

    const rigKnowledgeDomains = new Set(
      result.hiddenGameplayDefects
        .scenarioAudit.graph
        .knowledgeRequirements
        .map((requirement) => requirement.domain),
    );
    const rigRequiresArenaSpatial =
      rigKnowledgeDomains.has("arena-lifecycle") ||
      rigKnowledgeDomains.has("multiplayer-interleaving") ||
      rigKnowledgeDomains.has("spatial-authority") ||
      rigKnowledgeDomains.has("world-structure");
    const rigRequiresStructureProof =
      rigKnowledgeDomains.has("world-structure") ||
      rigKnowledgeDomains.has("spatial-authority");
    const rigRequiresChunkProof =
      rigKnowledgeDomains.has("chunk-simulation");
    const rigRequiresEntityProof =
      rigKnowledgeDomains.has("entity-behavior");
    const rigRequiresSpatialContainment =
      result.hiddenGameplayDefects.auditScenarioPreset.scenarios.some(
        (scenario) => scenario.kind === "spatial-containment",
      );
    const rigRequiredProofLayers = [
      ...(rigRequiresArenaSpatial
        ? ["native-spatial" as const]
        : []),
      ...(rigRequiresStructureProof
        ? [
            "voxel" as const,
            "block-entity" as const,
          ]
        : []),
      ...(rigRequiresChunkProof
        ? ["tick-state" as const]
        : []),
      ...(rigRequiresEntityProof
        ? ["actor-population" as const]
        : []),
    ];

    const baseProofVolumes =
      effectiveRegionClassification === undefined
        ? effectiveRegionPlan?.volumes
        : [
            ...effectiveRegionClassification.staticVolumes,
            ...effectiveRegionClassification.mixedVolumes,
            ...effectiveRegionClassification.unknownVolumes,
          ];

    const proofPartition =
      baseProofVolumes === undefined
        ? undefined
        : partitionArenaProofVolumes(
            baseProofVolumes,
            effectiveRegionClassification
              ?.proofExclusionVolumes ?? [],
          );

    const proofVolumes =
      proofPartition?.volumes ??
      baseProofVolumes;

    const proofCoverage = deriveArenaProofCoverage(
      effectiveRegionPlan,
      effectiveRegionClassification,
      proofPartition,
    );

    const entityPopulationProof =
      spatialLayout === undefined ||
      (!fullArenaProofRequested &&
        !rigRequiresEntityProof)
        ? undefined
        : proveArenaEntityPopulation(
            spatialLayout,
            effectiveRegionPlan,
            result.arenaAnalysis.entitySpawnEvidence ?? [],
          );

    let tickStateProof;

    const structureInstanceProof =
      spatialLayout === undefined ||
      (!fullArenaProofRequested &&
        !rigRequiresStructureProof)
        ? undefined
        : proveArenaStructureInstances(
            spatialLayout,
            effectiveRegionPlan,
            [
              ...result.structureRuntime.structurePlacements.map(
                (placement) => ({
                  target: placement.target,
                  ...(placement.position === undefined
                    ? {}
                    : { position: placement.position }),
                  options: placement.options,
                  sourceKind: "command" as const,
                }),
              ),
              ...result.scriptSpatial.structurePlacements.map(
                (placement) => ({
                  ...(placement.identifier === undefined
                    ? {}
                    : { target: placement.identifier }),
                  position: placement.position,
                  options: {},
                  sourceKind: "script" as const,
                }),
              ),
            ],
          );

    const arenaNativeSpatial =
      spatialLayout === undefined ||
      (!fullArenaProofRequested &&
        !rigRequiresArenaSpatial)
        ? undefined
        : auditArenaNativeSpatialContent(
            spatialLayout,
            nativeWorldDb.chunkContentObservations ?? [],
            {
              ...(effectiveRegionPlan === undefined
                ? {}
                : { regionPlan: effectiveRegionPlan }),
              ...(proofVolumes === undefined
                ? {}
                : { includedVolumes: proofVolumes }),
            },
          );

    const proofExecution =
      spatialLayout === undefined
        ? undefined
        : planArenaProofExecution({
            mode:
              target.arenaProofMode ??
              "progressive",
            ...(arenaNativeSpatial === undefined
              ? {} : { nativeSpatial: arenaNativeSpatial }),
            nativeObservationsTruncated:
              nativeWorldDb
                .chunkContentObservationsTruncated ??
              false,
            blockEntityRecords:
              nativeWorldDb.blockEntityRecords,
            pendingTickRecords:
              nativeWorldDb.pendingTickRecords,
            randomTickRecords:
              nativeWorldDb.randomTickRecords,
            actorRecords:
              nativeWorldDb.actorRecords,
            ...(entityPopulationProof === undefined
              ? {} : { authoredEntityProof: entityPopulationProof }),
            requiredLayers:
              rigRequiredProofLayers,
          });

    if (
      spatialLayout !== undefined &&
      proofExecution !== undefined &&
      arenaProofLayerEnabled(
        proofExecution,
        "tick-state",
      )
    ) {
      tickStateProof =
        proveArenaTickStateEquivalence(
          spatialLayout,
          effectiveRegionPlan,
          nativeWorldDb
            .chunkContentObservations ?? [],
          {
            observationsTruncated:
              nativeWorldDb
                .chunkContentObservationsTruncated ??
              false,
          },
        );
    }

    let arenaVoxelProof;
    let arenaBarrierEnclosureProof;
    let arenaBlockEntityProof;
    let arenaActorPopulationProof;
    let persistedPackIdentity;
    const artifactDiagnostics = [
      ...result.diagnostics.filter(
        (finding) =>
          finding.code !==
          "RELEASE_IDENTITY_INCONSISTENT",
      ),
      ...finalReleaseIdentity.findings,
    ];

    if (
      arenaNativeSpatial?.canonical !== undefined
    ) {
      const canonicalRecords =
        arenaNativeSpatial.canonical.records;

      for (
        const replica of
          arenaNativeSpatial.replicas
      ) {
        if (
          replica.status !==
            "chunk-record-proof" ||
          replica.matchesCanonical !== false ||
          replica.fingerprint === undefined
        ) {
          continue;
        }

        const replicaRecords =
          replica.fingerprint.records;
        const ratio =
          canonicalRecords === 0
            ? 1
            : replicaRecords /
              canonicalRecords;

        artifactDiagnostics.push(
          createDiagnostic({
            code:
              ratio < 0.75
                ? "ARENA_NATIVE_CONTENT_DEFICIT"
                : "ARENA_NATIVE_SPATIAL_DIVERGENCE",
            severity:
              ratio < 0.75
                ? "critical"
                : "medium",
            message:
              ratio < 0.75
                ? `Arena ${replica.arenaId} contains substantially less native chunk content than the canonical arena.`
                : `Arena ${replica.arenaId} differs from the canonical arena in normalized native chunk content.`,
            data: {
              arenaId: replica.arenaId,
              canonicalRecords,
              replicaRecords,
              recordCoverageRatio: ratio,
              canonicalHash:
                arenaNativeSpatial.canonical
                  .hash,
              replicaHash:
                replica.fingerprint.hash,
            },
          }),
        );
      }
    }

    for (
      const replica of
        structureInstanceProof?.replicas ?? []
    ) {
      if (replica.status !== "diverged") continue;
      artifactDiagnostics.push(
        createDiagnostic({
          code: "ARENA_STRUCTURE_INSTANCE_DIVERGENCE",
          severity: "critical",
          message:
            `Arena ${replica.arenaId} differs from the canonical arena in resolved structure-placement instances.`,
          data: {
            arenaId: replica.arenaId,
            canonicalInstances:
              replica.canonicalInstances,
            replicaInstances:
              replica.replicaInstances,
            unresolvedPlacements:
              replica.unresolvedPlacements,
            mismatches: replica.mismatches,
          },
        }),
      );
    }

    for (
      const replica of
        tickStateProof?.replicas ?? []
    ) {
      if (replica.status !== "diverged") continue;
      artifactDiagnostics.push(
        createDiagnostic({
          code: "ARENA_TICK_STATE_DIVERGENCE",
          severity: "medium",
          message:
            `Arena ${replica.arenaId} differs from the canonical arena in normalized pending/random tick record state.`,
          data: {
            arenaId: replica.arenaId,
            pendingTickRecords:
              replica.pendingTickRecords,
            randomTickRecords:
              replica.randomTickRecords,
            matchesCanonical:
              replica.matchesCanonical,
            reason: replica.reason,
          },
        }),
      );
    }

    for (
      const replica of
        entityPopulationProof?.replicas ?? []
    ) {
      if (replica.status !== "diverged") continue;
      artifactDiagnostics.push(
        createDiagnostic({
          code: "ARENA_ENTITY_POPULATION_DIVERGENCE",
          severity: "critical",
          message:
            `Arena ${replica.arenaId} differs from the canonical arena in resolved entity-spawn population.`,
          data: {
            arenaId: replica.arenaId,
            canonicalSpawns: replica.canonicalSpawns,
            replicaSpawns: replica.replicaSpawns,
            unresolvedSpawns: replica.unresolvedSpawns,
            mismatches: replica.mismatches,
          },
        }),
      );
    }

    if (nativeWorldDb.status === "scanned") {
      try {
        const reader = await openBedrockLevelDbSnapshot(
          join(workingRoot, "db"),
        );
        try {
          persistedPackIdentity =
            await extractPersistedPackIdentities(reader);

          if (spatialLayout !== undefined) {
            if (
              effectiveRegionPlan !== undefined &&
              (
                fullArenaProofRequested ||
                rigRequiresSpatialContainment
              )
            ) {
              arenaBarrierEnclosureProof =
                await proveArenaBarrierEnclosure(
                  reader,
                  spatialLayout,
                  effectiveRegionPlan,
                );
            }

            if (
              proofExecution !== undefined &&
              arenaProofLayerEnabled(
                proofExecution,
                "voxel",
              )
            ) {
              arenaVoxelProof =
                await proveArenaVoxelEquivalence(
                  reader,
                  spatialLayout,
                  {
                    ...(effectiveRegionPlan === undefined
                      ? {}
                      : {
                          regionPlan:
                            effectiveRegionPlan,
                        }),
                    ...(proofVolumes === undefined
                      ? {}
                      : {
                          includedVolumes:
                            proofVolumes,
                        }),
                  },
                );
            }

            if (
              proofVolumes !== undefined &&
              proofExecution !== undefined &&
              arenaProofLayerEnabled(
                proofExecution,
                "block-entity",
              )
            ) {
              arenaBlockEntityProof =
                await proveArenaBlockEntityEquivalence(
                  reader,
                  spatialLayout,
                  {
                    includedVolumes: proofVolumes,
                  },
                );
            }

            if (
              proofExecution !== undefined &&
              arenaProofLayerEnabled(
                proofExecution,
                "actor-population",
              )
            ) {
              arenaActorPopulationProof =
                await proveArenaActorPopulation(
                  reader,
                  spatialLayout,
                  effectiveRegionPlan,
                );
            }

            for (
              const replica of
                arenaVoxelProof?.replicas ?? []
            ) {
              if (replica.status !== "diverged") continue;
              artifactDiagnostics.push(
                createDiagnostic({
                  code: "ARENA_VOXEL_DIVERGENCE",
                  severity: "critical",
                  message:
                    `Arena ${replica.arenaId} differs from the canonical arena at decoded voxel level.`,
                  data: {
                    arenaId: replica.arenaId,
                    comparedBlocks: replica.comparedBlocks,
                    unresolvedBlocks: replica.unresolvedBlocks,
                    mismatchCount: replica.mismatchCount,
                    mismatches: replica.mismatches,
                  },
                }),
              );
            }

            for (
              const replica of
                arenaActorPopulationProof?.replicas ?? []
            ) {
              if (replica.status !== "diverged") continue;
              artifactDiagnostics.push(
                createDiagnostic({
                  code: "ARENA_ACTOR_POPULATION_DIVERGENCE",
                  severity: "medium",
                  message:
                    `Arena ${replica.arenaId} differs from the canonical arena in runtime Actor DB population counts.`,
                  data: {
                    arenaId: replica.arenaId,
                    canonicalActors:
                      replica.canonicalActors,
                    replicaActors:
                      replica.replicaActors,
                    mismatchCount:
                      replica.mismatchCount,
                    mismatches:
                      replica.mismatches,
                  },
                }),
              );
            }

            for (
              const replica of
                arenaBlockEntityProof?.replicas ?? []
            ) {
              if (replica.status !== "diverged") continue;
              artifactDiagnostics.push(
                createDiagnostic({
                  code: "ARENA_BLOCK_ENTITY_DIVERGENCE",
                  severity: "critical",
                  message:
                    `Arena ${replica.arenaId} differs from the canonical arena at block-entity NBT level.`,
                  data: {
                    arenaId: replica.arenaId,
                    canonicalEntities:
                      replica.canonicalEntities,
                    replicaEntities:
                      replica.replicaEntities,
                    comparedEntities:
                      replica.comparedEntities,
                    unresolvedChunks:
                      replica.unresolvedChunks,
                    mismatchCount:
                      replica.mismatchCount,
                    mismatches:
                      replica.mismatches,
                  },
                }),
              );
            }
          }
        } finally {
          await reader.close();
        }
      } catch {
        // Native targeted proof is supplementary. Existing scan status remains authoritative.
      }
    }

    const repairLocalization =
      spatialLayout !== undefined &&
      effectiveRegionPlan !== undefined
        ? localizeArenaRepairSources({
            layout: spatialLayout,
            regionPlan: effectiveRegionPlan,
            sources:
              result.arenaAnalysis.authoredSources ?? [],
            ...(arenaVoxelProof === undefined
              ? {}
              : { voxelProof: arenaVoxelProof }),
            ...(structureInstanceProof === undefined
              ? {}
              : {
                  structureProof:
                    structureInstanceProof,
                }),
            ...(entityPopulationProof === undefined
              ? {}
              : {
                  entityPopulationProof,
                }),
            ...(arenaActorPopulationProof === undefined
              ? {}
              : {
                  actorPopulationProof:
                    arenaActorPopulationProof,
                }),
          })
        : undefined;

    const repairBridge =
      bridgeArenaRepairLocalization(
        repairLocalization,
        result.repairCandidates,
      );

    const proofConclusion = concludeArenaProof(
      proofCoverage,
      arenaVoxelProof,
      arenaBlockEntityProof,
    );
    const replicaProofQuality =
      deriveArenaReplicaProofQuality(
        proofCoverage,
        arenaVoxelProof,
        arenaNativeSpatial,
        arenaBlockEntityProof,
      );

    if (persistedPackIdentity?.status === "parsed") {
      const behaviorPackUuids = result.packs
        .filter((pack) =>
          pack.type === "behavior_pack" ||
          pack.type === "script_pack" ||
          pack.type === "mixed_pack"
        )
        .flatMap((pack) => pack.uuid ? [pack.uuid] : []);

      artifactDiagnostics.push(
        ...packIdentityDriftDiagnostics(
          behaviorPackUuids,
          persistedPackIdentity.namespaces.map((item) => ({
            identity: item.identity,
          })),
        ),
      );
    }

    const embeddedCommandNativeCorrelations =
      correlateEmbeddedCommandsWithNativeChunks(
        result.structureRuntime.placedEmbeddedCommands,
        nativeWorldDb.chunkSignals,
      );
    const nativeChunkCorrelations = result.structureRuntime.absoluteLoadDestinations.map(
      (destination) => ({
        target: destination.target,
        chunkX: destination.chunkX,
        chunkZ: destination.chunkZ,
        matches: nativeWorldDb.chunkSignals
          .filter((chunk) =>
            chunk.chunkX === destination.chunkX &&
            chunk.chunkZ === destination.chunkZ
          )
          .map((chunk) => ({
            dimensionId: chunk.dimensionId,
            kinds: chunk.kinds,
          })),
      }),
    );
    const finalArenaAnalysis = {
      ...result.arenaAnalysis,
      autoDetected:
        result.arenaAnalysis.autoDetected ||
        scriptLayoutFallback !== undefined,
      ...(spatialLayout === undefined
        ? {}
        : { spatialLayout }),
      stressPlan,
      repeatedRunPlan,
      ...(repairLocalization === undefined
        ? {}
        : { repairLocalization }),
      ...(proofExecution === undefined
        ? {}
        : { proofExecution }),
      ...(result.arenaAnalysis.regionPlan !== undefined ||
          effectiveRegionPlan === undefined
        ? {}
        : { regionPlan: effectiveRegionPlan }),
      ...(result.arenaAnalysis.regionClassification !== undefined ||
          effectiveRegionClassification === undefined
        ? {}
        : {
            regionClassification:
              effectiveRegionClassification,
          }),
      ...(arenaNativeSpatial === undefined
        ? {}
        : { nativeSpatial: arenaNativeSpatial }),
      ...(arenaVoxelProof === undefined
        ? {}
        : { voxelProof: arenaVoxelProof }),
      ...(arenaBarrierEnclosureProof === undefined
        ? {}
        : { barrierEnclosureProof: arenaBarrierEnclosureProof }),
      ...(arenaBlockEntityProof === undefined
        ? {}
        : {
            blockEntityProof:
              arenaBlockEntityProof,
          }),
      ...(structureInstanceProof === undefined
        ? {}
        : { structureInstanceProof }),
      ...(entityPopulationProof === undefined
        ? {}
        : { entityPopulationProof }),
      ...(arenaActorPopulationProof === undefined
        ? {}
        : {
            actorPopulationProof:
              arenaActorPopulationProof,
          }),
      ...(tickStateProof === undefined
        ? {}
        : { tickStateProof }),
      ...(proofPartition === undefined
        ? {}
        : { proofPartition }),
      ...(proofCoverage === undefined
        ? {}
        : { proofCoverage }),
      proofConclusion,
      ...(replicaProofQuality.length === 0
        ? {}
        : { replicaProofQuality }),
    };

    const finalGameplayWorld =
      deriveGameplayWorldModel({
        artifactId,
        intent: result.gameplayIntent.model,
        arena: finalArenaAnalysis,
        scriptSpatial: result.scriptSpatial,
        // An absent demand is not evidence that every analysis domain ran.
        ...(result.spatialAuthority === undefined
          ? {}
          : {
              spatialAuthority:
                result.spatialAuthority,
            }),
        persistenceSource:
          result.persistenceSource,
        combatLifecycle:
          result.combatLifecycle,
        combatRuntime:
          result.combatRuntime,
        combatPolicy:
          result.combatPolicy,
        chunkLifecycle:
          result.chunkLifecycle,
        rewardSources:
          result.rewardSources,
        economyPolicy:
          result.economyPolicy,
        inventoryLifecycle:
          result.inventoryLifecycle,
        inventoryPolicy:
          result.inventoryPolicy,
        inventoryRestoreOwnership:
          result.inventoryRestoreOwnership,
        worldRuleAuthority:
          result.worldRuleAuthority,
        playerCapabilitySurfaces:
          result.playerCapabilitySurfaces,
        clientMutationReconciliation:
          result.clientMutationReconciliation,
        capabilityMutationFootprint:
          result.capabilityMutationFootprint,
        semanticIr: {
          stateSurfaces:
            result.semanticIr.stateSurfaces,
          stateOperations:
            result.semanticIr.stateOperations,
        },
        broadWrites:
          result.stateAnalysis.broadWrites,
        entityAiStack:
          result.entityAiStack,
        routeNavigationEnvironment:
          result.routeNavigationEnvironment,
        ...(result.gameplayWorld.analysisDemand === undefined
          ? {} : { analysisDemand: result.gameplayWorld.analysisDemand }),
        platformKnowledge:
          result.gameplayWorld.platformKnowledge,
        structures: {
          definitions: result.structures,
          loads:
            result.structureRuntime.loads,
          unresolvedLoads:
            result.structureRuntime
              .unresolvedLoads,
          placements:
            result.structureRuntime
              .structurePlacements.length +
            result.scriptSpatial
              .structurePlacements.length,
          runtimeLogicLoads:
            result.structureRuntime
              .runtimeLogicLoads,
          transitionResidueRisks:
            result.gameplayWorld.structures
              .transitionResidueRisks,
          transitionResidueUnresolved:
            result.gameplayWorld.structures
              .transitionResidueUnresolved,
          loadCorrelations:
            result.gameplayWorld.structures
              .loadCorrelations,
          transitionResidue:
            result.gameplayWorld.structures
              .transitionResidue,
        },
        entities: {
          definitions: result.entities,
          knowledgePrerequisiteGaps:
            result.entityKnowledge
              .prerequisiteGaps,
          staticAnalysisLimits:
            result.entityKnowledge
              .staticAnalysisLimits,
        },
        boundaries: {
          records:
            result.gameplayBoundaries
              .records.length,
          unresolvedNames:
            result.gameplayBoundaries
              .unresolvedNames,
        },
      });

    const finalGameplaySemantic =
      projectGameplaySemanticModel(
        finalGameplayWorld,
      );
    const finalEngineeringAssessment =
      projectMapEngineeringAssessment(
        finalGameplayWorld,
      );
    const refreshedHiddenGameplayDefects =
      refreshHiddenGameplayDefectsForWorld(
        result.hiddenGameplayDefects,
        finalGameplayWorld,
        result.gameplayIntent.model,
      );
    const discoveryChallenges =
      challengeGameplayDiscovery({
        semanticIr: result.semanticIrModel,
        intent: result.gameplayIntent.model,
        graph: refreshedHiddenGameplayDefects.scenarioAudit.graph,
      });
    const finalHiddenGameplayDefects = {
      ...refreshedHiddenGameplayDefects,
      scenarioAudit: {
        ...refreshedHiddenGameplayDefects.scenarioAudit,
        closure: assessGameplayScenarioClosure(
          refreshedHiddenGameplayDefects.scenarioAudit.graph,
          discoveryChallenges.map(item => item.id),
        ),
      },
      discoveryChallenges,
      attention: {
        ...refreshedHiddenGameplayDefects.attention,
        discoveryChallengeSignals: discoveryChallenges.length,
      },
    };
    const finalGameplayDiscoveryClosure =
      assessGameplayDiscoveryClosure({
        inventoriedFileCount:
          result.gameplayDiscoveryClosure.inventoriedFileCount,
        sourceFileAccountingComplete:
          result.gameplayDiscoveryClosure.sourceFileAccountingComplete,
        discoveredSurfaceIds:
          finalGameplayWorld.surfaceDiscovery
            .surfaceIds,
        unlistedPackRoots: result.gameplayDiscoveryClosure.unlistedPackRoots,
        nativeWorldScanIncomplete:
          nativeWorldDb.status === "failed" ||
          nativeWorldDb.truncated ||
          !nativeWorldDb.actorContentComplete ||
          nativeWorldDb.chunkSignalsTruncated ||
          nativeWorldDb.chunkContentObservationsTruncated === true,
        sourceRelevantFiles:
          result.gameplayDiscoveryClosure
            .sourceRelevantFiles,
        sourceIndexedFiles:
          result.gameplayDiscoveryClosure
            .sourceIndexedFiles,
        sourceCoverageComplete:
          result.gameplayDiscoveryClosure
            .sourceCoverageComplete,
        sourceParseFailures:
          result.gameplayDiscoveryClosure
            .sourceParseFailures,
        unsupportedRelevantSourcePaths:
          result.gameplayDiscoveryClosure
            .unsupportedRelevantSourcePaths,
        semanticUnderstandingGapPaths:
          result.gameplayDiscoveryClosure
            .semanticUnderstandingGapPaths,
        unresolvedReferences:
          result.unresolvedReferences,
        discoveryChallengeIds:
          finalHiddenGameplayDefects.discoveryChallenges.map((item) => item.id),
         unresolvedSourceLinkIds: [
           ...result.semanticIrModel.execution.edges.filter((item) => item.resolution === "unresolved").map((item) => item.id),
           ...result.semanticIrModel.temporal.relations.filter((item) => item.resolution === "unresolved").map((item) => item.id),
         ],
        gameplayIntentUnknownIds: result.gameplayIntent.model.unknowns.map(item => item.id),
      });

    const finalEngineeringAnalyses =
      deriveInspectionEngineeringAnalyses({
        world: finalGameplayWorld,
        ...(finalArenaAnalysis.capacity === undefined
          ? {} : { arenaCapacity: finalArenaAnalysis.capacity }),
        target: result.targetCompatibility,
      });
    const finalAnalysisPriorities =
      deriveGameplayAnalysisPriorities(
        finalGameplayWorld,
        result.capabilityExposure,
        finalHiddenGameplayDefects
          .scenarioAudit.graph,
      );
    const finalMandatoryAuditProcedure =
      deriveMandatoryAuditProcedureReceipt({
        artifactId,
        artifactFingerprint: fingerprint,
        archiveEntries: inventory.entries.length,
        discovery:
          finalGameplayDiscoveryClosure,
        world: finalGameplayWorld,
        intent: result.gameplayIntent.model,
        semanticIr: result.semanticIrModel,
        boundaries:
          result.gameplayBoundaries,
        multiplayer:
          result.multiplayerStateValidation,
        hidden:
          finalHiddenGameplayDefects,
      });

    // The selected source must remain the same bytes throughout inspection.
    // A Drive-synced replacement must start a new audit, not reuse this result.
    if (await sha256File(path) !== fingerprint) {
      throw new Error(
        "Selected .mcworld changed during inspection; resolve the current artifact again.",
      );
    }

    return {
      artifactId,
      fingerprint,
      archiveEntries: inventory.entries.length,
      ...(levelName === undefined || levelName.length === 0
        ? {}
        : { levelName }),
      ...result,
      releaseIdentity:
        finalReleaseIdentity,
      gameplayWorld: finalGameplayWorld,
      gameplayDiscoveryClosure:
        finalGameplayDiscoveryClosure,
      gameplaySemantic: finalGameplaySemantic,
      engineeringAssessment:
        finalEngineeringAssessment,
      hiddenGameplayDefects:
        finalHiddenGameplayDefects,
      mandatoryAuditProcedure:
        finalMandatoryAuditProcedure,
      engineeringAnalyses:
        finalEngineeringAnalyses,
      analysisPriorities:
        finalAnalysisPriorities,
      arenaAnalysis: finalArenaAnalysis,
      worldDatabase: {
        ...result.worldDatabase,
        nativeScan: nativeWorldDb,
        ...(persistedPackIdentity === undefined
          ? {}
          : { persistedPackIdentity }),
      },
      diagnostics: artifactDiagnostics,
      structureRuntime: {
        ...result.structureRuntime,
        nativeChunkCorrelations,
        embeddedCommandNativeCorrelations,
      },
    };
  } finally {
    await rm(workingRoot, { recursive: true, force: true });
  }
}

/** One transient ZIP preparation shared only within a selected audit invocation.
 * A second RIG pass recomputes the analysis, never the source extraction.
 * This does not own an audit stage, status, cache, or persisted authority.
 */
export async function withPreparedArtifactInspection<T>(
  path: string,
  visit: (inspect: PreparedArtifactInspect) => Promise<T>,
  expectedArtifactFingerprint?: string,
  mapClassificationHint?: MapClassificationRoutingHint,
): Promise<T> {
  const fingerprint = await sha256File(path);
  assertExpectedArchiveFingerprint(fingerprint, expectedArtifactFingerprint);
  if (mapClassificationHint !== undefined) {
    assertMapClassificationRoutingHint(mapClassificationHint, fingerprint);
  }
  const sessionRoot = await mkdtemp(join(tmpdir(), "m-bedrock-inspect-"));
  const sourceRoot = join(sessionRoot, "source");
  try {
    await mkdir(sourceRoot, { recursive: true });
    const inventory = await extractZipSafely(
      path, sourceRoot, NORMAL_EXTRACTION_BUDGET,
    );
    if (await sha256File(path) !== fingerprint) {
      throw new Error(
        "Selected .mcworld changed during archive extraction; resolve the current artifact again.",
      );
    }
    const prepared: PreparedArtifactSource = {
      sessionRoot, sourceRoot, fingerprint, inventory,
      sourceInventoryReuse: {
        artifactId: artifactIdFromFingerprint(fingerprint),
        sourceFingerprint: fingerprint,
      },
    };
    const result = await visit((
      target,
      knowledgeCatalog,
      telemetry,
      runtimeProbeTranscript,
      mapClassificationHint,
      expectedArtifactFingerprint,
    ) => inspectPreparedArtifact(
      path,
      prepared,
      target,
      knowledgeCatalog,
      telemetry,
      runtimeProbeTranscript,
      mapClassificationHint,
      expectedArtifactFingerprint,
    ));
    if (await sha256File(path) !== fingerprint) {
      throw new Error(
        "Selected .mcworld changed during prepared audit; resolve the current artifact again.",
      );
    }
    return result;
  } finally {
    await rm(sessionRoot, { recursive: true, force: true });
  }
}

/** Existing standalone inspection API remains compatible. */
export async function inspectArtifact(
  path: string,
  target: InspectTargetProfile = {},
  knowledgeCatalog?: KnowledgeCatalog,
  telemetry: readonly TelemetryEvent[] | TelemetryBatch = [],
  runtimeProbeTranscript?: RuntimeProbeTranscript,
  mapClassificationHint?: MapClassificationRoutingHint,
  expectedArtifactFingerprint?: string,
): Promise<InspectArtifactResult> {
  return withPreparedArtifactInspection(
    path,
    (inspect) => inspect(
      target,
      knowledgeCatalog,
      telemetry,
      runtimeProbeTranscript,
      mapClassificationHint,
      expectedArtifactFingerprint,
    ),
    expectedArtifactFingerprint,
    mapClassificationHint,
  );
}
