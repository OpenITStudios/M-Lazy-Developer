// Consolidated related development source tests, original lexical scopes retained.
import { describe, expect, it } from "vitest";
import { bridgeArenaRepairLocalization } from "../../src/arena/arena-repair-bridge.js";
import { localizeArenaRepairSources, sourceOverlappingArenaIds } from "../../src/arena/arena-repair-localization.js";

// Original engine/packages/orchestrator/test/arena/arena-repair-bridge.test.ts; blob 06fe922c1bdeb1409751d0e00babe509e26ebfc8
{
describe("arena repair bridge", () => {
  it("keeps an exactly matching authored repair proposal non-executable", () => {
    const bridge =
      bridgeArenaRepairLocalization(
        {
          localized: 1,
          unresolved: 0,
          items: [{
            kind: "voxel",
            arenaId: "arena-2",
            unresolved: false,
            reasons: [],
            candidates: [{
              sourceId: "source",
              source: {
                artifactId: "fixture",
                relativePath:
                  "functions/setup.mcfunction",
                range: {
                  lineStart: 4,
                  lineEnd: 4,
                },
              },
              sourceKind: "command",
              authoredKind: "setblock",
              strength: "exact-overlap",
              reason: "exact",
            }],
          }],
        },
        [{
          kind: "linear-topology-outlier",
          diagnosticCode:
            "TOPOLOGY_TRANSLATION_OUTLIER",
          sourcePath:
            "functions/setup.mcfunction",
          line: 4,
          status: "proposal",
          proposal: {
            title: "candidate only",
            sourceFingerprint: "fingerprint",
            operation: {
              kind: "replace-command",
              source: {
                artifactId: "fixture",
                relativePath: "functions/setup.mcfunction",
                range: { lineStart: 4, lineEnd: 4 },
              },
              expected: "setblock 1 2 3 stone",
              replacement: "setblock 2 2 3 stone",
            },
            validation: [],
          },
        }],
      );

    expect(bridge).toMatchObject({
      deterministicRepairs: 0,
      proposalOnly: 1,
      unresolved: 0,
    });
    expect(
      bridge.items[0]?.status,
    ).toBe(
      "proposal-only",
    );
    expect(bridge.items[0]?.transactionId).toBeUndefined();
  });

  it("keeps region-only localization proposal-only", () => {
    const bridge =
      bridgeArenaRepairLocalization(
        {
          localized: 1,
          unresolved: 0,
          items: [{
            kind: "voxel",
            arenaId: "arena-2",
            unresolved: false,
            reasons: [],
            candidates: [{
              sourceId: "source",
              source: {
                artifactId: "fixture",
                relativePath:
                  "functions/setup.mcfunction",
              },
              sourceKind: "command",
              authoredKind: "fill",
              strength: "arena-overlap",
              reason: "regional",
            }],
          }],
        },
        [],
      );

    expect(
      bridge.items[0]?.status,
    ).toBe("proposal-only");
  });
});
}

// Original engine/packages/orchestrator/test/arena/arena-repair-localization.test.ts; blob 5b19265a566f3e760549118e92fb14b9b9037c81
{
describe("arena repair localization", () => {
  it("localizes voxel mismatch to an overlapping authored mutation", () => {
    const result = localizeArenaRepairSources({
      layout: {
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
      regionPlan: {
        volumes: [{
          min: { x: 0, y: 0, z: 0 },
          max: { x: 20, y: 20, z: 20 },
          evidenceCandidateIds: [],
        }],
        boundingBox: {
          min: { x: 0, y: 0, z: 0 },
          max: { x: 20, y: 20, z: 20 },
        },
        totalBlocks: 9261,
        evidenceCandidates: 0,
        mergeGapBlocks: 0,
        confidence: "high",
      },
      sources: [{
        id: "source",
        kind: "setblock",
        source: {
          artifactId: "fixture",
          relativePath: "functions/setup.mcfunction",
          range: {
            lineStart: 4,
            lineEnd: 4,
          },
        },
        sourceKind: "command",
        volume: {
          min: { x: 105, y: 1, z: 5 },
          max: { x: 105, y: 1, z: 5 },
        },
      }],
      voxelProof: {
        status: "diverged",
        sampledBlocks: 1,
        requiredBlocks: 1,
        region: {
          min: { x: 0, y: 0, z: 0 },
          max: { x: 0, y: 0, z: 0 },
        },
        regions: [],
        regionSource: "topology-plan",
        replicas: [{
          arenaId: "arena-2",
          status: "diverged",
          comparedBlocks: 1,
          unresolvedBlocks: 0,
          mismatchCount: 1,
          mismatches: [{
            canonical: { x: 5, y: 1, z: 5 },
            replica: { x: 105, y: 1, z: 5 },
            canonicalSignature: "a",
            replicaSignature: "b",
          }],
        }],
      },
    });

    expect(result.localized).toBe(1);
    expect(result.items[0]?.candidates[0])
      .toMatchObject({
        sourceId: "source",
        strength: "exact-overlap",
      });
  });
  it("preserves exact-overlap priority when one source is also an arena-overlap candidate", () => {
    const result = localizeArenaRepairSources({
      layout: {
        basis: "topology",
        canonical: { arenaId: "arena-1", anchor: { x: 0, y: 0, z: 0 } },
        replicas: [{ arenaId: "arena-2", anchor: { x: 100, y: 0, z: 0 } }],
        offsets: [{ x: 100, y: 0, z: 0 }],
        confidence: "high",
      },
      regionPlan: {
        volumes: [{ min: { x: 0, y: 0, z: 0 }, max: { x: 20, y: 20, z: 20 }, evidenceCandidateIds: [] }],
        boundingBox: { min: { x: 0, y: 0, z: 0 }, max: { x: 20, y: 20, z: 20 } },
        totalBlocks: 9261,
        evidenceCandidates: 0,
        mergeGapBlocks: 0,
        confidence: "high",
      },
      sources: [{
        id: "same-source",
        kind: "setblock",
        source: { artifactId: "fixture", relativePath: "functions/setup.mcfunction" },
        sourceKind: "command",
        volume: { min: { x: 105, y: 1, z: 5 }, max: { x: 105, y: 1, z: 5 } },
      }],
      voxelProof: {
        status: "diverged",
        sampledBlocks: 1,
        requiredBlocks: 1,
        region: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } },
        regions: [],
        regionSource: "topology-plan",
        replicas: [{
          arenaId: "arena-2", status: "diverged", comparedBlocks: 1,
          unresolvedBlocks: 0, mismatchCount: 1,
          mismatches: [{
            canonical: { x: 5, y: 1, z: 5 }, replica: { x: 105, y: 1, z: 5 },
            canonicalSignature: "a", replicaSignature: "b",
          }],
        }],
      },
    });
    expect(result.items[0]?.candidates).toHaveLength(1);
    expect(result.items[0]?.candidates[0]).toMatchObject({
      sourceId: "same-source", strength: "exact-overlap",
    });
  });

  it("does not invent a replica region when its offset is missing", () => {
    const arenaIds = sourceOverlappingArenaIds(
      {
        id: "source", kind: "entity-spawn", sourceKind: "command",
        source: { artifactId: "fixture", relativePath: "functions/spawn.mcfunction" },
        position: { x: 5, y: 1, z: 5 },
      },
      {
        basis: "topology",
        canonical: { arenaId: "arena-1", anchor: { x: 0, y: 0, z: 0 } },
        replicas: [{ arenaId: "arena-2", anchor: { x: 100, y: 0, z: 0 } }],
        offsets: [], confidence: "low",
      },
      {
        volumes: [{ min: { x: 0, y: 0, z: 0 }, max: { x: 20, y: 20, z: 20 }, evidenceCandidateIds: [] }],
        boundingBox: { min: { x: 0, y: 0, z: 0 }, max: { x: 20, y: 20, z: 20 } },
        totalBlocks: 9261, evidenceCandidates: 0, mergeGapBlocks: 0, confidence: "low",
      },
    );
    expect(arenaIds).toEqual(["arena-1"]);
  });
});
}
