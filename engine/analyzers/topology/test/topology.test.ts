// Map topology source tests (regression-flow remains its original regression lane).
import { describe } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { compareArenaReplicas } from "../src/arena-replica.js";
import { deriveTopologyCandidates } from "../src/candidates.js";
import { compareExpectedTranslation } from "../src/outliers.js";
import { detectLinearTopologyOutliers } from "../src/linear-outliers.js";
import { type ResolvedEffect } from "../src/effect-resolution.js";
import { effectSignature } from "../src/signature.js";
import { translationBetween } from "../src/signature.js";
import { classifySelector } from "../src/state-scope.js";
import { likelyGlobalAccess } from "../src/state-scope.js";
import { resolveCoordinate3 } from "../src/coordinate-context.js";
import { findRepeatedTranslatedEffects } from "../src/repeated-groups.js";

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
