// Same-owner arena proof family; original case bodies isolated per source.
import { describe, expect, it } from "vitest";
import { createSpatialFingerprint } from "../../../../analyzers/world-db/src/index.js";
import { runArenaAudit } from "../../src/arena/arena-audit.js";
import { buildArenaEngineeringProjection } from "../../src/arena/arena-engineering-projection.js";
import { analyzeMultiplayerStaticRisks, analyzePendingWorldOperations, assessWorldReleaseState, proposeTickingAreaConsolidation } from "../../src/index.js";
import type { McStructureModel } from "../../../../adapters/mcstructure/src/index.js";
import { assessStructureTransitionResidue } from "../../src/inspection/structure-transition-residue.js";
import { concludeArenaProof } from "../../src/arena/arena-proof-conclusion.js";
import { deriveArenaProofCoverage } from "../../src/arena/arena-proof-coverage.js";
import { planArenaProofExecution } from "../../src/arena/arena-proof-execution-plan.js";
import { assessArenaProofReuse } from "../../src/arena/arena-proof-reuse.js";
import { deriveArenaRuntimeAdapterRequirements } from "../../src/arena/arena-runtime-adapter-requirements.js";

// Original engine/packages/orchestrator/test/arena/arena-audit.test.ts, SHA 42d76a941c4ba9cdaad97f520ebe54981fde11b0
{
describe("runArenaAudit", () => {
  it("combines replica, spatial, capacity, persistence, and release checks without duplicate analyzer ownership", () => {
    const canonicalFingerprint = createSpatialFingerprint([
      { x: 0, y: 0, z: 0, blockIdentifier: "minecraft:stone" },
    ]);
    const driftedFingerprint = createSpatialFingerprint([
      { x: 0, y: 0, z: 0, blockIdentifier: "minecraft:dirt" },
    ]);

    const result = runArenaAudit({
      canonicalReplica: {
        arenaId: "arena-1",
        anchor: { x: 0, y: 0, z: 0 },
        items: [
          { key: "flag", signature: "flag:v1", position: { x: 10, y: 0, z: 0 } },
        ],
      },
      replicaCandidates: [
        {
          arenaId: "arena-2",
          anchor: { x: 100, y: 0, z: 0 },
          items: [
            { key: "flag", signature: "flag:v1", position: { x: 111, y: 0, z: 0 } },
          ],
        },
      ],
      canonicalSpatialFingerprint: canonicalFingerprint,
      spatialReplicaFingerprints: [
        { arenaId: "arena-2", fingerprint: driftedFingerprint },
      ],
      requestedConcurrentArenas: 5,
      capacityResources: [
        {
          id: "command-ticking-area",
          backend: "fixed-pool",
          total: 10,
          reserved: 2,
          perArena: 3,
        },
      ],
      currentPackUuids: ["current"],
      persistedPackIdentities: [{ identity: "old" }],
      releaseIdentities: [
        { component: "world", releaseVersion: "1.0.4" },
        { component: "behavior-pack", releaseVersion: "1.0.3" },
      ],
    });

    expect(result.capacity?.safeConcurrentArenas).toBe(2);
    expect(new Set(result.findings.map((item) => item.code))).toEqual(
      new Set([
        "ARENA_REPLICA_DIVERGENCE",
        "ARENA_SPATIAL_FINGERPRINT_DIVERGENCE",
        "ARENA_CONCURRENCY_CAPACITY_SHORTFALL",
        "PACK_IDENTITY_DRIFT",
        "RELEASE_IDENTITY_INCONSISTENT",
      ]),
    );
  });
});
}

// Original engine/packages/orchestrator/test/arena/arena-engineering-projection.test.ts, SHA e456542f538b3d06a0b76aadf14e1932be4b7a80
{
describe("arena engineering projection", () => {
  it("keeps arena reporting compact and arena-scoped", () => {
    const source = {
      artifactId: "map:test",
      fingerprint: "abc",
      targetCompatibility: {
        edition: "bedrock",
        educationFeatures: "unknown",
      },
      arenaAnalysis: {
        autoDetected: true,
        spatialLayout: {
          basis: "topology",
          canonical: {
            arenaId: "arena-1",
            anchor: { x: 0, y: 0, z: 0 },
          },
          replicas: [{
            arenaId: "arena-2",
            anchor: { x: 100, y: 0, z: 0 },
          }],
          offsets: [{ x: 100, y: 0, z: 0 }],
          confidence: "high",
        },
        lifecycle: {
          terminalCandidates: 1,
          proven: 1,
          partial: 0,
          unresolved: 0,
          assessments: [],
        },
        cleanupSurfaces: {
          acquiredSurfaces: 2,
          terminalAssessments: [],
          exactProven: 2,
          partial: 0,
          unresolved: 0,
        },
        stateIsolation: {
          arenaRegions: 1,
          observations: [],
          isolated: 2,
          partitionProofRequired: 0,
          sharedGlobal: 0,
          unknown: 0,
        },
        stressPlan: {
          status: "unavailable",
          reasons: ["capacity unresolved"],
        },
      },
      diagnostics: [{
        id: "arena:test",
        code: "ARENA_CONCURRENCY_CAPACITY_SHORTFALL",
        severity: "critical",
        message: "capacity shortfall",
      }, {
        id: "other:test",
        code: "SCRIPT_MODULE_UNDECLARED",
        severity: "minor",
        message: "other",
      }],
    } as any;

    const result =
      buildArenaEngineeringProjection(source);

    expect(result.architecture.count).toBe(2);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.code)
      .toBe("ARENA_CONCURRENCY_CAPACITY_SHORTFALL");
    expect(result.stress.status)
      .toBe("unavailable");
  });
});
}

// Original engine/packages/orchestrator/test/arena/arena-last-mile-audit.test.ts, SHA 32822e3deb9718e0355d0abc103e147f358ce8f6
{
describe("last-mile arena audit helpers", () => {
  it("finds a feasible ticking-area consolidation without guessing runtime state", () => {
    const result = proposeTickingAreaConsolidation({
      arenaAreas: [
        { id: "a", minX: 0, maxX: 15, minZ: 0, maxZ: 15 },
        { id: "b", minX: 16, maxX: 31, minZ: 0, maxZ: 15 },
        { id: "c", minX: 32, maxX: 47, minZ: 0, maxZ: 15 },
      ],
      permanentAreaCount: 2,
      globalAreaLimit: 10,
      targetConcurrentArenas: 5,
      maxChunksPerArea: 8,
    });

    expect(result).toMatchObject({
      status: "feasible",
      currentAreasPerArena: 3,
      currentSafeConcurrentArenas: 2,
      candidateAreasPerArena: 1,
      candidateSafeConcurrentArenas: 8,
      mergedChunkCount: 3,
    });
  });

  it("blocks unsafe release metadata deterministically", () => {
    const result = assessWorldReleaseState({
      experiments: {
        experimental_cameras: true,
        approved_feature: true,
      },
      allowedExperiments: ["approved_feature"],
      educationFeaturesEnabled: false,
      expectedEducationFeaturesEnabled: false,
      playerPermissionsLevel: 2,
      maximumDefaultPermissionLevel: 1,
      lastOpenedWithVersion: [1, 26, 20],
      minimumOpenedVersion: [1, 26, 40],
    });

    expect(result.releasable).toBe(false);
    expect(result.findings.map((item) => item.code)).toEqual([
      "WORLD_UNAPPROVED_EXPERIMENT",
      "WORLD_DEFAULT_PERMISSION_TOO_HIGH",
      "WORLD_OPENED_VERSION_TOO_OLD",
    ]);
  });

  it("promotes pending native operations to release-blocking residue", () => {
    const result = analyzePendingWorldOperations([
      { key: "chunk_loaded_request:12:4" },
      { key: "normal:key" },
    ]);

    expect(result).toMatchObject({
      status: "residue-detected",
      releaseBlocking: true,
    });
    expect(result.operations).toHaveLength(1);
  });

  it("detects active structure_void cells rather than palette presence alone", () => {
    const structure = {
      size: { x: 2, y: 1, z: 2 },
      palette: [
        { index: 0, name: "minecraft:stone", raw: {} },
        { index: 1, name: "minecraft:structure_void", raw: {} },
      ],
      blockIndexLayers: [
        { layer: 0, indices: [0, 1, 0, 1] },
      ],
      entities: [],
    } as unknown as McStructureModel;

    const result = assessStructureTransitionResidue(structure);

    expect(result.status).toBe("residue-risk");
    expect(result.voidCellCount).toBe(2);
    expect(result.samples).toEqual([
      { x: 1, y: 0, z: 0, layer: 0 },
      { x: 1, y: 0, z: 1, layer: 0 },
    ]);
  });

  it("uses cheap multiplayer lint only as a deterministic prefilter", () => {
    const result = analyzeMultiplayerStaticRisks(
      'const target = world.getPlayers()[0];\\nplayer.runCommand("@p");',
    );

    expect(result.major).toBeGreaterThanOrEqual(2);
    expect(result.risks.map((item) => item.code)).toContain(
      "MULTIPLAYER_FIRST_PLAYER_ASSUMPTION",
    );
    expect(result.risks.map((item) => item.code)).toContain(
      "NONDETERMINISTIC_PLAYER_SELECTOR",
    );
  });
});
}

// Original engine/packages/orchestrator/test/arena/arena-proof.test.ts, SHA 4595a79984fecca4b1f3fb6f4ae43b57edafca61
{
// Source-preserving consolidation: original test cases remain in isolated lexical blocks.

// Consolidated suite from engine/packages/orchestrator/test/arena/arena-proof-conclusion.test.ts
{
describe("arena proof conclusion", () => {
  it("only emits complete-proof for full coverage plus verified voxel proof", () => {
    const result = concludeArenaProof(
      {
        status: "full",
        plannedBlocks: 100,
        proofBlocks: 100,
        excludedBlocks: 0,
        coverageRatio: 1,
        partitionTruncated: false,
        regions: { planned: 1, proof: 1 },
        roleBlocks: {
          static: 100,
          mutable: 0,
          mixed: 0,
          ignored: 0,
          unknown: 0,
        },
      },
      {
        status: "verified",
        sampledBlocks: 100,
        requiredBlocks: 100,
        region: {
          min: { x: 0, y: 0, z: 0 },
          max: { x: 9, y: 0, z: 9 },
        },
        regions: [{
          min: { x: 0, y: 0, z: 0 },
          max: { x: 9, y: 0, z: 9 },
        }],
        regionSource: "topology-plan",
        replicas: [],
      },
    );

    expect(result.conclusion).toBe("complete-proof");
  });

  it("keeps verified partial coverage explicitly bounded", () => {
    const result = concludeArenaProof(
      {
        status: "partial",
        plannedBlocks: 100,
        proofBlocks: 80,
        excludedBlocks: 20,
        coverageRatio: 0.8,
        partitionTruncated: false,
        regions: { planned: 1, proof: 2 },
        roleBlocks: {
          static: 80,
          mutable: 20,
          mixed: 0,
          ignored: 0,
          unknown: 0,
        },
      },
      {
        status: "verified",
        sampledBlocks: 80,
        requiredBlocks: 80,
        region: {
          min: { x: 0, y: 0, z: 0 },
          max: { x: 9, y: 0, z: 9 },
        },
        regions: [],
        regionSource: "topology-plan",
        replicas: [],
      },
    );

    expect(result.conclusion).toBe("bounded-proof");
  });
});
}

// Consolidated suite from engine/packages/orchestrator/test/arena/arena-proof-coverage.test.ts
{
describe("arena proof coverage", () => {
  it("reports exact coverage after mutable subtraction", () => {
    const result = deriveArenaProofCoverage(
      {
        volumes: [{
          min: { x: 0, y: 0, z: 0 },
          max: { x: 9, y: 9, z: 9 },
          evidenceCandidateIds: ["arena"],
        }],
        boundingBox: {
          min: { x: 0, y: 0, z: 0 },
          max: { x: 9, y: 9, z: 9 },
        },
        totalBlocks: 1000,
        evidenceCandidates: 1,
        mergeGapBlocks: 0,
        confidence: "medium",
      },
      undefined,
      {
        volumes: [{
          min: { x: 0, y: 0, z: 0 },
          max: { x: 7, y: 9, z: 9 },
          evidenceCandidateIds: ["arena"],
        }],
        excludedBlocks: 200,
        partitionCount: 1,
        truncated: false,
      },
    );

    expect(result?.plannedBlocks).toBe(1000);
    expect(result?.proofBlocks).toBe(800);
    expect(result?.excludedBlocks).toBe(200);
    expect(result?.coverageRatio).toBe(0.8);
    expect(result?.status).toBe("partial");
  });

  it("marks zero proof volume as none", () => {
    const result = deriveArenaProofCoverage(
      {
        volumes: [{
          min: { x: 0, y: 0, z: 0 },
          max: { x: 0, y: 0, z: 0 },
          evidenceCandidateIds: [],
        }],
        boundingBox: {
          min: { x: 0, y: 0, z: 0 },
          max: { x: 0, y: 0, z: 0 },
        },
        totalBlocks: 1,
        evidenceCandidates: 0,
        mergeGapBlocks: 0,
        confidence: "low",
      },
      undefined,
      {
        volumes: [],
        excludedBlocks: 1,
        partitionCount: 0,
        truncated: false,
      },
    );

    expect(result?.status).toBe("none");
    expect(result?.coverageRatio).toBe(0);
  });
});
}

// Consolidated suite from engine/packages/orchestrator/test/arena/arena-proof-execution-plan.test.ts
{
describe("arena proof execution plan", () => {
  const nativeMatch = {
    status: "chunk-record-proof" as const,
    region: {
      minChunkX: 0,
      maxChunkX: 0,
      minChunkZ: 0,
      maxChunkZ: 0,
      dimensionId: 0,
    },
    replicas: [{
      arenaId: "arena-2",
      status: "chunk-record-proof" as const,
      reason: "match",
      matchesCanonical: true,
    }],
  };

  it("skips expensive decode when complete native evidence already matches", () => {
    const plan = planArenaProofExecution({
      mode: "progressive",
      nativeSpatial: nativeMatch,
      blockEntityRecords: 10,
      pendingTickRecords: 0,
      randomTickRecords: 0,
      actorRecords: 100,
    });

    expect(plan.skippedLayers).toEqual(
      expect.arrayContaining([
        "voxel",
        "block-entity",
        "actor-population",
      ]),
    );
  });

  it("escalates voxel when translation requires coordinate proof", () => {
    const plan = planArenaProofExecution({
      nativeSpatial: {
        ...nativeMatch,
        status: "voxel-proof-required",
        replicas: [{
          arenaId: "arena-2",
          status: "voxel-proof-required",
          reason: "non aligned",
        }],
      },
      blockEntityRecords: 0,
      pendingTickRecords: 0,
      randomTickRecords: 0,
      actorRecords: 0,
    });

    expect(
      plan.executedLayers,
    ).toContain("voxel");
  });

  it("full mode executes every available proof layer", () => {
    const plan = planArenaProofExecution({
      mode: "full",
      nativeSpatial: nativeMatch,
      blockEntityRecords: 1,
      pendingTickRecords: 1,
      randomTickRecords: 0,
      actorRecords: 1,
    });

    expect(plan.executedLayers).toEqual([
      "native-spatial",
      "voxel",
      "block-entity",
      "tick-state",
      "actor-population",
    ]);
  });
});
}

// Consolidated suite from engine/packages/orchestrator/test/arena/arena-proof-reuse.test.ts
{
function inspection(
  overrides:
    Record<string, unknown> = {},
) {
  return {
    fingerprint: "artifact-a",
    arenaAnalysis: {
      spatialLayout: {
        basis: "topology",
        canonical: {
          arenaId: "arena-1",
          anchor: { x: 0, y: 0, z: 0 },
        },
        replicas: [{
          arenaId: "arena-2",
          anchor: { x: 100, y: 0, z: 0 },
        }],
        offsets: [{
          x: 100,
          y: 0,
          z: 0,
        }],
        confidence: "high",
      },
      regionPlan: {
        // The baseline proof actually covers chunk 0,0. An empty region
        // cannot prove that a change to that chunk invalidates arena proof.
        volumes: [{
          min: { x: 0, y: 0, z: 0 },
          max: { x: 15, y: 0, z: 15 },
        }],
        boundingBox: {
          min: { x: 0, y: 0, z: 0 },
          max: { x: 15, y: 0, z: 15 },
        },
        totalBlocks: 256,
        evidenceCandidates: 0,
        mergeGapBlocks: 0,
        confidence: "high",
      },
      entitySpawnEvidence: [],
    },
    worldDatabase: {
      nativeScan: {
        status: "scanned",
        entriesScanned: 1,
        truncated: false,
        actorRecords: 0,
        actorContentComplete: true,
        actorDigestRecords: 0,
        chunkRecords: 1,
        blockEntityRecords: 0,
        pendingTickRecords: 0,
        randomTickRecords: 0,
        finalizedStateRecords: 0,
        subChunkRecords: 1,
        dimensions: [0],
        chunksObserved: 1,
        chunkSignals: [],
        chunkSignalsTruncated: false,
        chunkContentObservations: [{
          chunkX: 0,
          chunkZ: 0,
          dimensionId: 0,
          kind: "SubChunk",
          valueHash: "same",
          subChunkIndex: 0,
        }],
        chunkContentObservationsTruncated:
          false,
      },
    },
    structureRuntime: {
      structurePlacements: [],
    },
    scriptSpatial: {
      structurePlacements: [],
    },
    ...overrides,
  } as any;
}

describe("arena proof reuse", () => {
  it("reuses physical proof after script-only artifact change when complete world DB dependencies are unchanged", () => {
    const before = inspection();
    const after = inspection({
      fingerprint: "artifact-b",
    });

    const result =
      assessArenaProofReuse(
        before,
        after,
      );

    expect(result.reusableLayers).toEqual(
      expect.arrayContaining([
        "voxel",
        "block-entity",
        "tick-state",
        "structure-instance",
        "entity-population",
        "actor-population",
      ]),
    );
  });

  it("does not manufacture zero-Actor or physical reuse when world DB scans are missing", () => {
    const before = inspection({ worldDatabase: undefined });
    const after = inspection({
      fingerprint: "artifact-b",
      worldDatabase: undefined,
    });
    const result = assessArenaProofReuse(before, after);
    expect(result.blockedLayers).toEqual(expect.arrayContaining([
      "native-spatial", "voxel", "block-entity", "tick-state",
      "actor-population",
    ]));
    expect(result.reusableLayers).not.toContain("actor-population");
  });

  it("ignores world DB changes outside arena chunk scope", () => {
    const before = inspection();
    const after = inspection({
      fingerprint: "artifact-b",
      worldDatabase: {
        nativeScan: {
          ...before.worldDatabase.nativeScan,
          chunkContentObservations: [
            ...before.worldDatabase.nativeScan
              .chunkContentObservations,
            {
              chunkX: 999,
              chunkZ: 999,
              dimensionId: 0,
              kind: "SubChunk",
              valueHash: "outside-change",
              subChunkIndex: 0,
            },
          ],
        },
      },
    });

    const result =
      assessArenaProofReuse(
        before,
        after,
      );

    expect(
      result.assessments.find(
        (item) => item.layer === "voxel",
      )?.status,
    ).toBe("reusable");
  });

  it("invalidates physical proof when arena-scoped chunk content changes", () => {
    const before = inspection();
    const after = inspection({
      fingerprint: "artifact-b",
      worldDatabase: {
        nativeScan: {
          ...before.worldDatabase.nativeScan,
          chunkContentObservations: [{
            chunkX: 0,
            chunkZ: 0,
            dimensionId: 0,
            kind: "SubChunk",
            valueHash: "changed",
            subChunkIndex: 0,
          }],
        },
      },
    });

    const result =
      assessArenaProofReuse(
        before,
        after,
      );

    expect(
      result.assessments.find(
        (item) => item.layer === "voxel",
      )?.status,
    ).toBe("stale");
  });

  it("blocks physical reuse when native observations are truncated", () => {
    const before = inspection();
    const after = inspection({
      fingerprint: "artifact-b",
      worldDatabase: {
        nativeScan: {
          ...before.worldDatabase.nativeScan,
          chunkContentObservationsTruncated:
            true,
        },
      },
    });

    const result =
      assessArenaProofReuse(
        before,
        after,
      );

    expect(result.blockedLayers).toEqual(
      expect.arrayContaining([
        "voxel",
        "block-entity",
        "tick-state",
      ]),
    );
  });

  it("invalidates authored entity proof when spawn evidence changes", () => {
    const before = inspection();
    const after = inspection({
      fingerprint: "artifact-b",
      arenaAnalysis: {
        ...before.arenaAnalysis,
        entitySpawnEvidence: [{
          kind: "entity-spawn",
          entityIdentifier:
            "minecraft:zombie",
          position: {
            x: 1,
            y: 2,
            z: 3,
          },
          sourcePath: "scripts/main.ts",
        }],
      },
    });

    const result =
      assessArenaProofReuse(
        before,
        after,
      );

    expect(
      result.assessments.find(
        (item) =>
          item.layer ===
          "entity-population",
      )?.status,
    ).toBe("stale");
  });
});
}
}

// Original engine/packages/orchestrator/test/arena/arena-runtime-adapter-requirements.test.ts, SHA 21fe72b88125afeded3eea7c0be43bfa1b1e3fcc
{
describe("arena runtime adapter requirements", () => {
  it("derives baseline surfaces and live-client needs from validation plans", () => {
    const result =
      deriveArenaRuntimeAdapterRequirements({
        arenaAnalysis: {
          autoDetected: true,
          spatialLayout: {
            basis: "topology",
            canonical: {
              arenaId: "arena-1",
              anchor: { x: 0, y: 0, z: 0 },
            },
            replicas: [],
            offsets: [],
            confidence: "high",
          },
          stressPlan: {
            status: "planned",
            reasons: [],
            matrix: {
              schemaVersion: 1,
              arenaIds: ["arena-1"],
              playersPerArena: 5,
              totalNominalPlayers: 5,
              scenarios: [{
                id: "disconnect",
                kind: "disconnect-during-active",
                arenaIds: ["arena-1"],
                playerIds: ["p"],
                invariants: [],
                purpose: "disconnect",
              }],
              byKind: {} as any,
            },
          },
          repeatedRunPlan: {
            schemaVersion: 1,
            runCounts: [1],
            stages: [{
              runs: 1,
              scope: "single-arena",
              invariants: [],
              compareSurfaces: [
                "arena-membership",
                "dynamic-properties",
                "deferred-callbacks",
              ],
              purpose: "repeat",
            }],
          },
          globalState: {
            mutations: [{
              id: "g",
              ownerKind: "script",
              ownerId: "main",
              executionRegion: "function:start",
              resource: "gamerule:pvp",
              command: "gamerule pvp false",
              arenaScoped: true,
              source: {
                artifactId: "fixture",
                relativePath: "scripts/main.ts",
              },
            }],
            assessments: [],
            arenaScopedMutations: 1,
            pairedLeaseEvidence: 0,
            partialLeaseEvidence: 0,
            unleasedArenaMutations: 1,
            unscopedMutations: 0,
            unauditedArenaMutations: 1,
          },
        },
      } as any);

    expect(result.requiredHooks).toEqual(
      expect.arrayContaining([
        "resetArena",
        "startArena",
        "finishArena",
        "captureArenaBaseline",
        "compareArenaBaseline",
        "disconnectPlayer",
      ]),
    );
    expect(result.requiredBaselineSurfaces)
      .toContain("dynamic-properties");
    expect(result.requiredGlobalResources)
      .toEqual(["gamerule:pvp"]);
    expect(result.liveClientLifecycleRequired)
      .toBe(true);
  });
});
}
