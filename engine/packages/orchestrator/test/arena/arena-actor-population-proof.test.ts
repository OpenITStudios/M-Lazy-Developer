import { describe, expect, it } from "vitest";
import { comp, float, list, string, writeUncompressed, type NBT } from "prismarine-nbt";
import { proveArenaActorPopulation } from "../../src/arena/arena-actor-population-proof.js";

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
