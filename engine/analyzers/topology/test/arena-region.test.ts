// Consolidated same-directory source test suites; assertions retained unchanged.
import { describe } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { deriveTopologyCandidates } from "../src/candidates.js";
import { discoverArenaReplicasFromTopology } from "../src/arena-discovery.js";
import { type ResolvedEffect } from "../src/effect-resolution.js";
import { inferArenaRegionPlan } from "../src/arena-region.js";
import { classifyArenaRegionRoles } from "../src/arena-region-role.js";
import { partitionArenaProofVolumes } from "../src/arena-region-partition.js";
import { subtractArenaRegionVolume } from "../src/arena-region-partition.js";

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
