// Source-preserving consolidation: original test cases remain in isolated lexical blocks.
import { describe, expect, it } from "vitest";
import { concludeArenaProof } from "../../src/arena/arena-proof-conclusion.js";
import { deriveArenaProofCoverage } from "../../src/arena/arena-proof-coverage.js";
import { planArenaProofExecution } from "../../src/arena/arena-proof-execution-plan.js";
import { assessArenaProofReuse } from "../../src/arena/arena-proof-reuse.js";

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
