// Same-directory feature suite, retaining original lexical test bodies.
import { describe, expect, it } from "vitest";
import { deriveTopologyCandidates } from "../src/candidates.js";
import { discoverArenaReplicasFromTopology } from "../src/arena-discovery.js";
import type { ResolvedEffect } from "../src/effect-resolution.js";
import { inferArenaRegionPlan } from "../src/arena-region.js";
import { classifyArenaRegionRoles } from "../src/arena-region-role.js";
import { partitionArenaProofVolumes, subtractArenaRegionVolume } from "../src/arena-region-partition.js";
import { compareArenaReplicas } from "../src/arena-replica.js";
import { compareExpectedTranslation } from "../src/outliers.js";
import { detectLinearTopologyOutliers } from "../src/linear-outliers.js";
import { effectSignature, translationBetween } from "../src/signature.js";
import { classifySelector, likelyGlobalAccess } from "../src/state-scope.js";
import { resolveCoordinate3 } from "../src/coordinate-context.js";
import { findRepeatedTranslatedEffects } from "../src/repeated-groups.js";

// Original engine/analyzers/topology/test/arena-region.test.ts; blob 4fcf8bfee1d87865009c286c8a182b2062fcfa23
{
// Consolidated same-directory source test suites; assertions retained unchanged.

// Original suite engine/analyzers/topology/test/arena-discovery.test.ts, blob 8df5d404ae2535a7359f9aa2298081ea87f06f6f
{
describe("arena replica discovery", () => {
  it("discovers shared arena translations only when multiple independent topology candidates support them", () => {
    const effects: ResolvedEffect[] = [
      { kind: "setblock", position: { x: 0, y: 0, z: 0 }, block: "minecraft:stone", sourcePath: "a" },
      { kind: "setblock", position: { x: 100, y: 0, z: 0 }, block: "minecraft:stone", sourcePath: "a" },
      { kind: "setblock", position: { x: 0, y: 0, z: 10 }, block: "minecraft:gold_block", sourcePath: "b" },
      { kind: "setblock", position: { x: 100, y: 0, z: 10 }, block: "minecraft:gold_block", sourcePath: "b" },
      { kind: "entity-spawn", position: { x: 5, y: 0, z: 5 }, entityIdentifier: "minecraft:zombie", sourcePath: "c" },
      { kind: "entity-spawn", position: { x: 105, y: 0, z: 5 }, entityIdentifier: "minecraft:zombie", sourcePath: "c" },
    ];

    const discovery = discoverArenaReplicasFromTopology(
      effects,
      deriveTopologyCandidates(effects),
      { minCandidateSupport: 3 },
    );

    expect(discovery?.offsets).toEqual([{ x: 100, y: 0, z: 0 }]);
    expect(discovery?.canonical.items).toHaveLength(3);
    expect(discovery?.replicas[0]?.items).toHaveLength(3);
  });

  it("does not promote a single repeated effect into an arena model", () => {
    const effects: ResolvedEffect[] = [
      { kind: "setblock", position: { x: 0, y: 0, z: 0 }, block: "minecraft:stone", sourcePath: "a" },
      { kind: "setblock", position: { x: 100, y: 0, z: 0 }, block: "minecraft:stone", sourcePath: "a" },
    ];

    expect(
      discoverArenaReplicasFromTopology(
        effects,
        deriveTopologyCandidates(effects),
      ),
    ).toBeUndefined();
  });
});
}

// Original suite engine/analyzers/topology/test/arena-region-contract-role.test.ts, blob 64f1ceb34737459068cbb4b756e6085d4c539071
{
describe("authored arena region roles", () => {
  const effects: ResolvedEffect[] = [
    { kind: "fill", from: { x: 0, y: 0, z: 0 }, to: { x: 10, y: 10, z: 10 }, block: "minecraft:stone", sourcePath: "setup.mcfunction" },
    { kind: "fill", from: { x: 100, y: 0, z: 0 }, to: { x: 110, y: 10, z: 10 }, block: "minecraft:stone", sourcePath: "setup.mcfunction" },
    { kind: "setblock", position: { x: 20, y: 0, z: 0 }, block: "minecraft:gold_block", sourcePath: "flag.mcfunction" },
    { kind: "setblock", position: { x: 120, y: 0, z: 0 }, block: "minecraft:gold_block", sourcePath: "flag.mcfunction" },
  ];

  it("allows an authored mutable contract to override inferred static evidence", () => {
    const candidates = deriveTopologyCandidates(effects);
    const discovery = discoverArenaReplicasFromTopology(
      effects,
      candidates,
      { minCandidateSupport: 2 },
    )!;
    const plan = inferArenaRegionPlan(
      effects,
      candidates,
      discovery,
      { marginBlocks: 0, mergeGapBlocks: 0 },
    )!;

    const result = classifyArenaRegionRoles(
      plan,
      effects,
      candidates,
      [{
        id: "build-plot",
        role: "mutable",
        coordinateSpace: "canonical-relative",
        volume: {
          min: { x: 0, y: 0, z: 0 },
          max: { x: 10, y: 10, z: 10 },
        },
      }],
      discovery.canonical.anchor,
    );

    expect(result.mutableVolumes).toHaveLength(1);
    expect(
      result.volumes.find((item) => item.role === "mutable")
        ?.roleAuthority,
    ).toBe("authored-contract");
  });

  it("keeps conflicting authored roles as mixed instead of choosing silently", () => {
    const candidates = deriveTopologyCandidates(effects);
    const discovery = discoverArenaReplicasFromTopology(
      effects,
      candidates,
      { minCandidateSupport: 2 },
    )!;
    const plan = inferArenaRegionPlan(
      effects,
      candidates,
      discovery,
      { marginBlocks: 0, mergeGapBlocks: 0 },
    )!;

    const result = classifyArenaRegionRoles(
      plan,
      effects,
      candidates,
      [
        {
          id: "a",
          role: "mutable",
          coordinateSpace: "absolute",
          volume: {
            min: { x: 0, y: 0, z: 0 },
            max: { x: 10, y: 10, z: 10 },
          },
        },
        {
          id: "b",
          role: "static",
          coordinateSpace: "absolute",
          volume: {
            min: { x: 0, y: 0, z: 0 },
            max: { x: 10, y: 10, z: 10 },
          },
        },
      ],
      discovery.canonical.anchor,
    );

    expect(result.mixedVolumes).toHaveLength(1);
    expect(
      result.volumes.find((item) => item.role === "mixed")
        ?.roleAuthority,
    ).toBe("conflict");
  });
});
}

// Original suite engine/analyzers/topology/test/arena-region-partition.test.ts, blob e31e99ea61f267277c4d5f9adfce993103f6cd47
{
describe("arena region partitioning", () => {
  it("subtracts an internal mutable cuboid without losing the static shell", () => {
    const result = subtractArenaRegionVolume(
      {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 9, y: 9, z: 9 },
        evidenceCandidateIds: ["arena"],
      },
      {
        min: { x: 2, y: 2, z: 2 },
        max: { x: 7, y: 7, z: 7 },
        evidenceCandidateIds: ["mutable"],
      },
    );

    expect(result).toHaveLength(6);
    const remaining = result.reduce(
      (sum, item) =>
        sum +
        (item.max.x - item.min.x + 1) *
        (item.max.y - item.min.y + 1) *
        (item.max.z - item.min.z + 1),
      0,
    );
    expect(remaining).toBe(1000 - 216);
  });

  it("fails closed to original proof volumes when partition budget is exceeded", () => {
    const result = partitionArenaProofVolumes(
      [{
        min: { x: 0, y: 0, z: 0 },
        max: { x: 100, y: 100, z: 100 },
        evidenceCandidateIds: ["arena"],
      }],
      [
        {
          min: { x: 10, y: 10, z: 10 },
          max: { x: 20, y: 20, z: 20 },
          evidenceCandidateIds: [],
        },
        {
          min: { x: 30, y: 30, z: 30 },
          max: { x: 40, y: 40, z: 40 },
          evidenceCandidateIds: [],
        },
      ],
      { maxPartitions: 2 },
    );

    expect(result.truncated).toBe(true);
    expect(result.volumes).toHaveLength(1);
  });
});
}

// Original suite engine/analyzers/topology/test/arena-region-role.test.ts, blob 8db28c245b8d1618aca0d4e3763dc27e9af04ae8
{
describe("arena region role classification", () => {
  it("marks exact repeated writes with different content as mutable", () => {
    const effects: ResolvedEffect[] = [
      { kind: "fill", from: { x: 0, y: 0, z: 0 }, to: { x: 4, y: 0, z: 4 }, block: "minecraft:stone", sourcePath: "init.mcfunction" },
      { kind: "fill", from: { x: 100, y: 0, z: 0 }, to: { x: 104, y: 0, z: 4 }, block: "minecraft:stone", sourcePath: "init.mcfunction" },
      { kind: "fill", from: { x: 0, y: 0, z: 0 }, to: { x: 4, y: 0, z: 4 }, block: "minecraft:air", sourcePath: "reset.mcfunction" },
      { kind: "fill", from: { x: 100, y: 0, z: 0 }, to: { x: 104, y: 0, z: 4 }, block: "minecraft:air", sourcePath: "reset.mcfunction" },
    ];

    const candidates = deriveTopologyCandidates(effects);
    const discovery = discoverArenaReplicasFromTopology(
      effects,
      candidates,
      { minCandidateSupport: 2 },
    )!;
    const plan = inferArenaRegionPlan(
      effects,
      candidates,
      discovery,
      { marginBlocks: 0, mergeGapBlocks: 0 },
    )!;

    const classification = classifyArenaRegionRoles(
      plan,
      effects,
      candidates,
    );

    expect(classification.mutableVolumes).toHaveLength(1);
    expect(classification.staticVolumes).toHaveLength(0);
  });

  it("keeps a single replicated write as static evidence", () => {
    const effects: ResolvedEffect[] = [
      { kind: "fill", from: { x: 0, y: 0, z: 0 }, to: { x: 4, y: 0, z: 4 }, block: "minecraft:stone", sourcePath: "wall.mcfunction" },
      { kind: "fill", from: { x: 100, y: 0, z: 0 }, to: { x: 104, y: 0, z: 4 }, block: "minecraft:stone", sourcePath: "wall.mcfunction" },
      { kind: "setblock", position: { x: 10, y: 0, z: 0 }, block: "minecraft:gold_block", sourcePath: "flag.mcfunction" },
      { kind: "setblock", position: { x: 110, y: 0, z: 0 }, block: "minecraft:gold_block", sourcePath: "flag.mcfunction" },
    ];

    const candidates = deriveTopologyCandidates(effects);
    const discovery = discoverArenaReplicasFromTopology(
      effects,
      candidates,
      { minCandidateSupport: 2 },
    )!;
    const plan = inferArenaRegionPlan(
      effects,
      candidates,
      discovery,
      { marginBlocks: 0, mergeGapBlocks: 0 },
    )!;

    const classification = classifyArenaRegionRoles(
      plan,
      effects,
      candidates,
    );

    expect(classification.staticVolumes.length).toBeGreaterThan(0);
    expect(classification.mutableVolumes).toHaveLength(0);
  });
});
}

// Original suite engine/analyzers/topology/test/arena-region.test.ts, blob 8fe3db8fd5e0a004dff25a842efd2da5905eb766
{
describe("arena region inference", () => {
  it("uses clone destination footprint instead of remote source template", () => {
    const effects: ResolvedEffect[] = [
      {
        kind: "clone",
        from: { x: 1000, y: 0, z: 1000 },
        to: { x: 1009, y: 9, z: 1009 },
        destination: { x: 0, y: 0, z: 0 },
        sourcePath: "arena.mcfunction",
      },
      {
        kind: "clone",
        from: { x: 1000, y: 0, z: 1000 },
        to: { x: 1009, y: 9, z: 1009 },
        destination: { x: 100, y: 0, z: 0 },
        sourcePath: "arena.mcfunction",
      },
      {
        kind: "setblock",
        position: { x: 5, y: 1, z: 5 },
        block: "minecraft:gold_block",
        sourcePath: "arena.mcfunction",
      },
      {
        kind: "setblock",
        position: { x: 105, y: 1, z: 5 },
        block: "minecraft:gold_block",
        sourcePath: "arena.mcfunction",
      },
    ];

    const candidates = deriveTopologyCandidates(effects);
    const discovery = discoverArenaReplicasFromTopology(
      effects,
      candidates,
      { minCandidateSupport: 2 },
    )!;

    const plan = inferArenaRegionPlan(
      effects,
      candidates,
      discovery,
      { marginBlocks: 0, mergeGapBlocks: 0 },
    )!;

    expect(plan.boundingBox.min.x).toBe(0);
    expect(plan.boundingBox.max.x).toBe(9);
    expect(plan.boundingBox.max.x).toBeLessThan(1000);
  });

  it("keeps distant supported areas as separate volumes instead of scanning the empty gap", () => {
    const effects: ResolvedEffect[] = [
      { kind: "setblock", position: { x: 0, y: 0, z: 0 }, block: "minecraft:stone", sourcePath: "a" },
      { kind: "setblock", position: { x: 100, y: 0, z: 0 }, block: "minecraft:stone", sourcePath: "a" },
      { kind: "setblock", position: { x: 0, y: 0, z: 80 }, block: "minecraft:gold_block", sourcePath: "b" },
      { kind: "setblock", position: { x: 100, y: 0, z: 80 }, block: "minecraft:gold_block", sourcePath: "b" },
    ];

    const candidates = deriveTopologyCandidates(effects);
    const discovery = discoverArenaReplicasFromTopology(
      effects,
      candidates,
      { minCandidateSupport: 2 },
    )!;

    const plan = inferArenaRegionPlan(
      effects,
      candidates,
      discovery,
      { marginBlocks: 1, mergeGapBlocks: 8 },
    )!;

    expect(plan.volumes).toHaveLength(2);
    expect(plan.totalBlocks).toBeLessThan(
      (plan.boundingBox.max.x - plan.boundingBox.min.x + 1) *
      (plan.boundingBox.max.y - plan.boundingBox.min.y + 1) *
      (plan.boundingBox.max.z - plan.boundingBox.min.z + 1),
    );
  });
});
}
}

// Original engine/analyzers/topology/test/topology.test.ts; blob 16545bd0c2f57ca84befd6559ccf57d81832d75a
{
// Map topology source tests (regression-flow remains its original regression lane).

// Original suite engine/analyzers/topology/test/arena-replica.test.ts, blob 10677f9bf9b561106d49e2d5a4abc1df9be0fe95
{
describe("compareArenaReplicas", () => {
  it("accepts translated replicas with identical relative topology", () => {
    const result = compareArenaReplicas(
      {
        arenaId: "arena-1",
        anchor: { x: 100, y: 50, z: 100 },
        items: [
          { key: "spawn", signature: "player-spawn", position: { x: 102, y: 51, z: 100 } },
          { key: "flag", signature: "flag:v1", position: { x: 120, y: 50, z: 100 } },
        ],
      },
      {
        arenaId: "arena-2",
        anchor: { x: 100, y: 50, z: -400 },
        items: [
          { key: "spawn", signature: "player-spawn", position: { x: 102, y: 51, z: -400 } },
          { key: "flag", signature: "flag:v1", position: { x: 120, y: 50, z: -400 } },
        ],
      },
    );

    expect(result.ok).toBe(true);
    expect(result.translation).toEqual({ x: 0, y: 0, z: -500 });
  });

  it("reports semantic and coordinate drift independently", () => {
    const result = compareArenaReplicas(
      {
        arenaId: "canonical",
        anchor: { x: 0, y: 0, z: 0 },
        items: [
          { key: "gate", signature: "gate:v2", position: { x: 10, y: 0, z: 0 } },
        ],
      },
      {
        arenaId: "replica",
        anchor: { x: 100, y: 0, z: 0 },
        items: [
          { key: "gate", signature: "gate:v1", position: { x: 111, y: 0, z: 0 } },
        ],
      },
    );

    expect(result.ok).toBe(false);
    expect(result.mismatches.map((item) => item.kind).sort()).toEqual([
      "relative-position-mismatch",
      "signature-mismatch",
    ]);
  });
});
}

// Original suite engine/analyzers/topology/test/candidates.test.ts, blob 434beacc84348d52a7a711ebe3dd7cce98116d84
{
const effects = [
  { kind: "fill" as const, from: {x:0,y:0,z:0}, to:{x:3,y:2,z:3}, block:"stone", sourcePath:"a" },
  { kind: "fill" as const, from: {x:100,y:0,z:0}, to:{x:103,y:2,z:3}, block:"stone", sourcePath:"b" },
  { kind: "fill" as const, from: {x:200,y:0,z:0}, to:{x:203,y:2,z:3}, block:"stone", sourcePath:"c" },
];

describe("topology candidates", () => {
  it("derives evidence-backed repeated groups", () => {
    const candidates = deriveTopologyCandidates(effects);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.confidence).toBe("medium");
    expect(candidates[0]?.members).toHaveLength(3);
  });

  it("detects translation outliers", () => {
    const result = compareExpectedTranslation(effects, 0, 1, {x:90,y:0,z:0});
    expect(result.status).toBe("outlier");
    expect(result.actual).toEqual({x:100,y:0,z:0});
  });
});
}

// Original suite engine/analyzers/topology/test/entity-spawn-topology.test.ts, blob 7a903b18988cc67fe513f14c992a297757fc0cb9
{
describe("entity spawn topology", () => {
  it("groups translated spawn layouts and detects a coordinate outlier", () => {
    const effects: ResolvedEffect[] = [
      {
        kind: "entity-spawn",
        entityIdentifier: "minecraft:zombie",
        position: { x: 0, y: 64, z: 0 },
        sourcePath: "a",
      },
      {
        kind: "entity-spawn",
        entityIdentifier: "minecraft:zombie",
        position: { x: 100, y: 64, z: 0 },
        sourcePath: "b",
      },
      {
        kind: "entity-spawn",
        entityIdentifier: "minecraft:zombie",
        position: { x: 200, y: 64, z: 0 },
        sourcePath: "c",
      },
      {
        kind: "entity-spawn",
        entityIdentifier: "minecraft:zombie",
        position: { x: 350, y: 64, z: 0 },
        sourcePath: "d",
      },
      {
        kind: "entity-spawn",
        entityIdentifier: "minecraft:zombie",
        position: { x: 400, y: 64, z: 0 },
        sourcePath: "e",
      },
    ];

    const candidates = deriveTopologyCandidates(effects);
    expect(candidates).toEqual([
      expect.objectContaining({
        kind: "entity-spawn",
        evidenceCount: 5,
        confidence: "high",
      }),
    ]);

    const outliers = detectLinearTopologyOutliers(effects);
    expect(outliers).toEqual([
      expect.objectContaining({
        effectIndex: 3,
        axis: "x",
        expectedCoordinate: 300,
        actualCoordinate: 350,
        step: 100,
        sourcePath: "d",
      }),
    ]);
  });
});
}

// Original suite engine/analyzers/topology/test/signature.test.ts, blob 621f68847cf9219fc941d88e6e10f609e01fcfa3
{
describe("topology effect signature", () => {
  it("anchors clone translation at destination rather than source template", () => {
    const a: ResolvedEffect = {
      kind: "clone",
      from: { x: 1000, y: 0, z: 1000 },
      to: { x: 1009, y: 9, z: 1009 },
      destination: { x: 0, y: 0, z: 0 },
      sourcePath: "setup.mcfunction",
    };
    const b: ResolvedEffect = {
      kind: "clone",
      from: { x: 1000, y: 0, z: 1000 },
      to: { x: 1009, y: 9, z: 1009 },
      destination: { x: 100, y: 0, z: 0 },
      sourcePath: "setup.mcfunction",
    };

    expect(
      translationBetween(
        effectSignature(a),
        effectSignature(b),
      ),
    ).toEqual({ x: 100, y: 0, z: 0 });
  });
});
}

// Original suite engine/analyzers/topology/test/state-scope.test.ts, blob e4132c02ca1b791c3eec102009c0deab85aa73f0
{
describe("state scope", () => {
  it("classifies broad and scoped selectors", () => {
    expect(classifySelector("@a")).toBe("all_players");
    expect(classifySelector("@s")).toBe("self");
    expect(classifySelector("@a[tag=arena1]")).toBe("filtered");
  });

  it("marks all-player/all-entity access as likely global", () => {
    expect(likelyGlobalAccess({
      stateKind: "scoreboard",
      key: "state",
      access: "write",
      selector: "@a",
      selectorScope: "all_players",
    })).toBe(true);
  });
});
}

// Original suite engine/analyzers/topology/test/topology.test.ts, blob 9d716acc3cf3f1e05a9c0c63007b35c934850905
{
describe("topology analysis", () => {
  it("resolves relative coordinates from an origin", () => {
    const resolved = resolveCoordinate3(
      {
        x: { mode: "relative", value: 2 },
        y: { mode: "absolute", value: 50 },
        z: { mode: "relative", value: -3 },
      },
      { origin: { x: 100, y: 64, z: 200 } },
    );
    expect(resolved).toEqual({ x: 102, y: 50, z: 197 });
  });

  it("finds translated copies of equivalent effects", () => {
    const pairs = findRepeatedTranslatedEffects([
      {
        kind: "fill",
        from: { x: 0, y: 0, z: 0 },
        to: { x: 3, y: 2, z: 3 },
        block: "stone",
        sourcePath: "a",
      },
      {
        kind: "fill",
        from: { x: 100, y: 0, z: 0 },
        to: { x: 103, y: 2, z: 3 },
        block: "stone",
        sourcePath: "b",
      },
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.translation).toEqual({ x: 100, y: 0, z: 0 });
  });
});
}
}
