// Consolidated same-owner, same-feature, same-lane test family.
// Original cases/assertions preserved; this is NOT executed test proof.
import { describe, expect, it } from "vitest";
import { reconcileArenaLayouts } from "../../src/arena/arena-layout-reconciliation.js";
import { auditArenaNativeSpatialContent } from "../../src/arena/arena-native-extraction.js";
import { parseArenaRegionContracts } from "../../src/arena/arena-region-contract-load.js";
import { deriveArenaReplicaProofQuality } from "../../src/arena/arena-replica-proof-quality.js";
import { deriveScriptArenaLayoutFallback } from "../../src/arena/script-arena-layout-fallback.js";

// Original suite: engine/packages/orchestrator/test/arena/arena-layout-reconciliation.test.ts (Git blob 996da1d20593167c7d0bd3fbb56c9066e918c709)
{


describe("arena layout reconciliation", () => {
  const discovery = {
    canonical: {
      arenaId: "arena-1",
      anchor: { x: 0, y: 0, z: 0 },
      items: [],
    },
    replicas: [
      {
        arenaId: "arena-2",
        anchor: { x: 100, y: 0, z: 0 },
        items: [],
      },
    ],
    offsets: [{ x: 100, y: 0, z: 0 }],
    supportByOffset: { "100,0,0": 3 },
    confidence: "medium" as const,
    evidenceCandidates: 3,
  };

  it("confirms matching script and topology offsets", () => {
    const result = reconcileArenaLayouts(
      discovery,
      {
        mode: "absolute-centers",
        arenaCount: 2,
        canonicalAnchor: { x: 0, y: 0, z: 0 },
        offsets: [
          { x: 0, y: 0, z: 0 },
          { x: 100, y: 0, z: 0 },
        ],
        sourceNames: ["ARENA_CENTERS"],
      },
    );

    expect(result.status).toBe("consistent");
    expect(result.mismatchedOffsets).toEqual([]);
  });

  it("does not choose between conflicting layouts", () => {
    const result = reconcileArenaLayouts(
      discovery,
      {
        mode: "relative-offsets",
        arenaCount: 2,
        offsets: [
          { x: 0, y: 0, z: 0 },
          { x: 120, y: 0, z: 0 },
        ],
        sourceNames: ["ARENA_OFFSETS"],
      },
    );

    expect(result.status).toBe("conflict");
    expect(result.mismatchedOffsets).toEqual([
      "100,0,0",
      "120,0,0",
    ]);
  });
});
}

// Original suite: engine/packages/orchestrator/test/arena/arena-native-extraction.test.ts (Git blob f8db55e05a7d548087adecffbe07ab76853b0fa9)
{


describe("arena native spatial extraction", () => {
  const discovery = {
    canonical: {
      arenaId: "arena-1",
      anchor: { x: 0, y: 50, z: 0 },
      items: [{ key: "flag", signature: "flag", position: { x: 8, y: 50, z: 8 } }],
    },
    replicas: [
      {
        arenaId: "arena-2",
        anchor: { x: 160, y: 50, z: 0 },
        items: [{ key: "flag", signature: "flag", position: { x: 168, y: 50, z: 8 } }],
      },
    ],
    offsets: [{ x: 160, y: 0, z: 0 }],
    supportByOffset: { "160,0,0": 4 },
    confidence: "high",
    evidenceCandidates: 4,
  } as const;

  it("automatically proves chunk-aligned translated regions", () => {
    const result = auditArenaNativeSpatialContent(discovery, [
      { chunkX: 0, chunkZ: 0, dimensionId: 0, kind: "SubChunkPrefix", valueHash: "same", subChunkIndex: 0 },
      { chunkX: 10, chunkZ: 0, dimensionId: 0, kind: "SubChunkPrefix", valueHash: "same", subChunkIndex: 0 },
    ], { marginChunks: 0 });

    expect(result.replicas[0]?.status).toBe("chunk-record-proof");
    expect(result.replicas[0]?.matchesCanonical).toBe(true);
  });

  it("keeps the topology envelope when targeted gameplay volumes are supplied", () => {
    const broadDiscovery = {
      ...discovery,
      canonical: {
        ...discovery.canonical,
        items: [
          ...discovery.canonical.items,
          {
            key: "far-edge",
            signature: "far-edge",
            position: { x: 64, y: 50, z: 8 },
          },
        ],
      },
      replicas: [{
        ...discovery.replicas[0],
        items: [
          ...discovery.replicas[0].items,
          {
            key: "far-edge",
            signature: "far-edge",
            position: { x: 224, y: 50, z: 8 },
          },
        ],
      }],
    } as const;

    const result = auditArenaNativeSpatialContent(
      broadDiscovery,
      [
        { chunkX: 0, chunkZ: 0, dimensionId: 0, kind: "SubChunkPrefix", valueHash: "same", subChunkIndex: 0 },
        { chunkX: 4, chunkZ: 0, dimensionId: 0, kind: "SubChunkPrefix", valueHash: "canonical-terrain", subChunkIndex: 0 },
        { chunkX: 10, chunkZ: 0, dimensionId: 0, kind: "SubChunkPrefix", valueHash: "same", subChunkIndex: 0 },
        { chunkX: 14, chunkZ: 0, dimensionId: 0, kind: "SubChunkPrefix", valueHash: "replica-terrain-diff", subChunkIndex: 0 },
      ],
      {
        marginChunks: 0,
        includedVolumes: [{
          evidenceCandidateIds: [],
          min: { x: 0, y: 50, z: 0 },
          max: { x: 15, y: 55, z: 15 },
        }],
      },
    );

    expect(result.regions?.length).toBe(2);
    expect(result.replicas[0]?.matchesCanonical).toBe(false);
  });

  it("requires voxel proof when translation is not chunk aligned", () => {
    const result = auditArenaNativeSpatialContent(
      {
        ...discovery,
        replicas: [{ ...discovery.replicas[0], anchor: { x: 516, y: 50, z: 0 } }],
        offsets: [{ x: 516, y: 0, z: 0 }],
      },
      [{ chunkX: 0, chunkZ: 0, dimensionId: 0, kind: "SubChunkPrefix", valueHash: "a" }],
    );

    expect(result.status).toBe("voxel-proof-required");
  });
});
}

// Original suite: engine/packages/orchestrator/test/arena/arena-region-contract-load.test.ts (Git blob 1318cfc9541d0ff4577f30bfdb088fdeeb38e2f9)
{


describe("arena region contract loader", () => {
  it("parses compact contract documents", () => {
    const contracts = parseArenaRegionContracts({
      contracts: [{
        id: "build-plot",
        role: "mutable",
        coordinateSpace: "canonical-relative",
        volume: {
          min: { x: -12, y: 0, z: -12 },
          max: { x: 12, y: 40, z: 12 },
        },
      }],
    });

    expect(contracts[0]?.id).toBe("build-plot");
  });

  it("rejects duplicate ids", () => {
    expect(() =>
      parseArenaRegionContracts([
        {
          id: "same",
          role: "mutable",
          coordinateSpace: "absolute",
          volume: {
            min: { x: 0, y: 0, z: 0 },
            max: { x: 1, y: 1, z: 1 },
          },
        },
        {
          id: "same",
          role: "static",
          coordinateSpace: "absolute",
          volume: {
            min: { x: 2, y: 2, z: 2 },
            max: { x: 3, y: 3, z: 3 },
          },
        },
      ]),
    ).toThrow(/Duplicate/);
  });
});
}

// Original suite: engine/packages/orchestrator/test/arena/arena-replica-proof-quality.test.ts (Git blob 2ffaa4b84a468807ee09d8176b9e2fd419420def)
{


describe("arena replica proof quality", () => {
  it("keeps replica completeness independent", () => {
    const result = deriveArenaReplicaProofQuality(
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
        status: "incomplete",
        sampledBlocks: 80,
        requiredBlocks: 80,
        region: {
          min: { x: 0, y: 0, z: 0 },
          max: { x: 9, y: 0, z: 7 },
        },
        regions: [],
        regionSource: "topology-plan",
        replicas: [
          {
            arenaId: "arena-2",
            status: "verified",
            comparedBlocks: 80,
            unresolvedBlocks: 0,
            mismatches: [],
            mismatchCount: 0,
          },
          {
            arenaId: "arena-3",
            status: "incomplete",
            comparedBlocks: 60,
            unresolvedBlocks: 20,
            mismatches: [],
            mismatchCount: 0,
          },
        ],
      },
      undefined,
    );

    expect(result[0]).toMatchObject({
      arenaId: "arena-2",
      status: "bounded-proof",
      eligibleCoverageRatio: 1,
      effectiveArenaCoverageRatio: 0.8,
    });
    expect(result[1]).toMatchObject({
      arenaId: "arena-3",
      status: "incomplete-proof",
      eligibleCoverageRatio: 0.75,
      effectiveArenaCoverageRatio: 0.6,
    });
  });

  it("retains native-only divergence when voxel proof is not executed", () => {
    const result = deriveArenaReplicaProofQuality(
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
      undefined,
      {
        status: "chunk-record-proof",
        canonical: {
          algorithm: "sha256",
          hash: "canonical",
          records: 100,
          originChunkX: 0,
          originChunkZ: 0,
          components: [],
        },
        region: {
          minChunkX: 0,
          maxChunkX: 1,
          minChunkZ: 0,
          maxChunkZ: 1,
        },
        replicas: [{
          arenaId: "arena-2",
          status: "chunk-record-proof",
          reason: "native mismatch",
          matchesCanonical: false,
          fingerprint: {
            algorithm: "sha256",
            hash: "replica",
            records: 40,
            originChunkX: 10,
            originChunkZ: 0,
            components: [],
          },
        }],
      },
    );

    expect(result[0]).toMatchObject({
      arenaId: "arena-2",
      status: "diverged",
      mismatchCount: 1,
      nativeSpatial: {
        matchesCanonical: false,
      },
    });
  });

  it("never hides a divergence behind incomplete aggregate evidence", () => {
    const result = deriveArenaReplicaProofQuality(
      undefined,
      {
        status: "diverged",
        sampledBlocks: 10,
        requiredBlocks: 10,
        region: {
          min: { x: 0, y: 0, z: 0 },
          max: { x: 9, y: 0, z: 0 },
        },
        regions: [],
        regionSource: "topology-plan",
        replicas: [{
          arenaId: "arena-2",
          status: "diverged",
          comparedBlocks: 10,
          unresolvedBlocks: 0,
          mismatches: [],
          mismatchCount: 2,
        }],
      },
      undefined,
    );

    expect(result[0]?.status).toBe("diverged");
    expect(result[0]?.mismatchCount).toBe(2);
  });
});
}

// Original suite: engine/packages/orchestrator/test/arena/script-arena-layout-fallback.test.ts (Git blob 2ce7e1f8d04858d65d290d8be1d55f8c09ae45d9)
{


describe("script arena layout fallback", () => {
  it("builds physical layout and authored region plan from absolute centers", () => {
    const result = deriveScriptArenaLayoutFallback(
      {
        compiledBindings: 1,
        rejectedBindings: 0,
        resolvedBindings: [],
        failedBindings: [],
        crossFileResolvedBindings: 0,
        arenaConcurrencyCandidates: [],
        arenaConcurrencyConflict: false,
        arenaCountCandidates: [],
        arenaLayoutCandidates: [],
        resolvedArenaCount: 2,
        resolvedArenaLayout: {
          mode: "absolute-centers",
          arenaCount: 2,
          canonicalAnchor: { x: 10, y: 50, z: 20 },
          offsets: [
            { x: 0, y: 0, z: 0 },
            { x: 100, y: 0, z: 0 },
          ],
          sourceNames: ["ARENA_CENTERS"],
        },
        arenaCountConflict: false,
        arenaLayoutConflict: false,
      },
      [{
        id: "build-plot",
        role: "mutable",
        coordinateSpace: "canonical-relative",
        volume: {
          min: { x: -5, y: 0, z: -5 },
          max: { x: 5, y: 20, z: 5 },
        },
      }],
    );

    expect(result?.layout.replicas[0]?.anchor)
      .toEqual({ x: 110, y: 50, z: 20 });
    expect(result?.regionClassification?.mutableVolumes)
      .toHaveLength(1);
  });

  it("refuses relative offsets without an absolute canonical anchor", () => {
    expect(
      deriveScriptArenaLayoutFallback({
        compiledBindings: 1,
        rejectedBindings: 0,
        resolvedBindings: [],
        failedBindings: [],
        crossFileResolvedBindings: 0,
        arenaConcurrencyCandidates: [],
        arenaConcurrencyConflict: false,
        arenaCountCandidates: [],
        arenaLayoutCandidates: [],
        resolvedArenaCount: 2,
        resolvedArenaLayout: {
          mode: "relative-offsets",
          arenaCount: 2,
          offsets: [
            { x: 0, y: 0, z: 0 },
            { x: 100, y: 0, z: 0 },
          ],
          sourceNames: ["ARENA_OFFSETS"],
        },
        arenaCountConflict: false,
        arenaLayoutConflict: false,
      }),
    ).toBeUndefined();
  });
});
}
