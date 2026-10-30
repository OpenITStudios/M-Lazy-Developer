// Bounded owner-local source test family; original assertions retained.
import { describe, expect, it } from "vitest";
import { comp, float, list, string, writeUncompressed, type NBT } from "prismarine-nbt";
import { proveArenaActorPopulation } from "../../src/arena/arena-actor-population-proof.js";
import { type ResolvedEffect } from "../../../../analyzers/topology/src/index.js";
import { proveArenaEntityPopulation } from "../../src/arena/arena-entity-population-proof.js";

// Original source suite: engine/packages/orchestrator/test/arena/arena-actor-population-proof.test.ts (Git blob 53a2c12f8a3039b25e6ca65cd3e879a5e954be67)
{


function actor(
  identifier: string,
  x: number,
  y: number,
  z: number,
) {
  const value = comp({
    identifier: string(identifier),
    Pos: list(float([x, y, z])),
  }, "") as unknown as NBT;
  return new Uint8Array(
    writeUncompressed(value, "little"),
  );
}

function actorKey(id: number): Uint8Array {
  return new Uint8Array([
    ...Buffer.from("actorprefix", "ascii"),
    id,
  ]);
}

describe("arena actor population proof", () => {
  const layout = {
    basis: "topology" as const,
    canonical: {
      arenaId: "arena-1",
      anchor: { x: 0, y: 0, z: 0 },
    },
    replicas: [{
      arenaId: "arena-2",
      anchor: { x: 100, y: 0, z: 0 },
    }],
    offsets: [{ x: 100, y: 0, z: 0 }],
    confidence: "high" as const,
  };
  const regionPlan = {
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
    confidence: "high" as const,
  };

  it("compares actor counts per identifier and ignores players", async () => {
    const entries = [
      {
        key: actorKey(1),
        value: actor(
          "minecraft:zombie",
          5,
          1,
          5,
        ),
      },
      {
        key: actorKey(2),
        value: actor(
          "minecraft:zombie",
          105,
          1,
          5,
        ),
      },
      {
        key: actorKey(3),
        value: actor(
          "minecraft:player",
          6,
          1,
          5,
        ),
      },
    ];
    const reader = {
      async get() {
        return undefined;
      },
      async *entries() {
        yield* entries;
      },
      async close() {},
    };

    const result =
      await proveArenaActorPopulation(
        reader,
        layout,
        regionPlan,
      );

    expect(result.status).toBe("verified");
    expect(result.canonicalActors).toBe(1);
  });

  it("detects actor population count divergence", async () => {
    const reader = {
      async get() {
        return undefined;
      },
      async *entries() {
        yield {
          key: actorKey(1),
          value: actor(
            "minecraft:zombie",
            5,
            1,
            5,
          ),
        };
      },
      async close() {},
    };

    const result =
      await proveArenaActorPopulation(
        reader,
        layout,
        regionPlan,
      );

    expect(result.status).toBe("diverged");
    expect(
      result.replicas[0]?.mismatches[0],
    ).toMatchObject({
      identifier: "minecraft:zombie",
      canonicalCount: 1,
      replicaCount: 0,
    });
  });
});
}

// Original source suite: engine/packages/orchestrator/test/arena/arena-entity-population-proof.test.ts (Git blob c85d301bc0059dc9484182e7fe9bae6a82de4fdf)
{


describe("arena entity population proof", () => {
  const layout = {
    basis: "topology" as const,
    canonical: {
      arenaId: "arena-1",
      anchor: { x: 0, y: 0, z: 0 },
    },
    replicas: [{
      arenaId: "arena-2",
      anchor: { x: 100, y: 0, z: 0 },
    }],
    offsets: [{ x: 100, y: 0, z: 0 }],
    confidence: "high" as const,
  };
  const regionPlan = {
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
    confidence: "high" as const,
  };

  it("verifies translated entity spawn populations", () => {
    const effects: ResolvedEffect[] = [
      {
        kind: "entity-spawn",
        entityIdentifier: "minecraft:zombie",
        position: { x: 5, y: 1, z: 5 },
        sourcePath: "a",
      },
      {
        kind: "entity-spawn",
        entityIdentifier: "minecraft:zombie",
        position: { x: 105, y: 1, z: 5 },
        sourcePath: "b",
      },
    ];

    const result = proveArenaEntityPopulation(
      layout,
      regionPlan,
      effects,
    );
    expect(result.status).toBe("verified");
  });

  it("detects missing replica entity spawn", () => {
    const effects: ResolvedEffect[] = [{
      kind: "entity-spawn",
      entityIdentifier: "minecraft:zombie",
      position: { x: 5, y: 1, z: 5 },
      sourcePath: "a",
    }];

    const result = proveArenaEntityPopulation(
      layout,
      regionPlan,
      effects,
    );
    expect(result.status).toBe("diverged");
    expect(result.replicas[0]?.mismatches[0]?.kind)
      .toBe("missing");
  });
});
}
