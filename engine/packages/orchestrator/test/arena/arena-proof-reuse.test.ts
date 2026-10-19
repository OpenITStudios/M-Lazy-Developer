import { describe, expect, it } from "vitest";
import { assessArenaProofReuse } from "../../src/arena/arena-proof-reuse.js";

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
