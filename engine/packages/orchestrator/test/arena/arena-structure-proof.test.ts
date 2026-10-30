// Source-preserving consolidation: original test cases remain in isolated lexical blocks.
import { comp, int, string, writeUncompressed } from "prismarine-nbt";
import type { NBT } from "prismarine-nbt";
import { describe, expect, it } from "vitest";
import type { BedrockLevelDbReader } from "../../../../adapters/leveldb/src/index.js";
import { proveArenaBlockEntityEquivalence } from "../../src/arena/arena-block-entity-proof.js";
import { proveArenaStructureInstances } from "../../src/arena/arena-structure-instance-proof.js";
import { proveArenaBarrierContainment, proveArenaBarrierEnclosure, proveArenaVoxelEquivalence } from "../../src/arena/arena-voxel-proof.js";

// Consolidated suite from engine/packages/orchestrator/test/arena/arena-block-entity-proof.test.ts
{
function key(chunkX: number, chunkZ: number): string {
  const bytes = Buffer.alloc(9);
  bytes.writeInt32LE(chunkX, 0);
  bytes.writeInt32LE(chunkZ, 4);
  bytes[8] = 49;
  return bytes.toString("hex");
}

function entity(
  x: number,
  y: number,
  z: number,
  command: string,
) {
  return writeUncompressed(
    comp({
      id: string("CommandBlock"),
      x: int(x),
      y: int(y),
      z: int(z),
      Command: string(command),
    }, "") as NBT,
    "little",
  );
}

function reader(values: Map<string, Uint8Array>): BedrockLevelDbReader {
  return {
    async get(raw) {
      return values.get(Buffer.from(raw).toString("hex"));
    },
    async *entries() {},
    async close() {},
  };
}

const layout = {
  basis: "script-config" as const,
  canonical: {
    arenaId: "arena-1",
    anchor: { x: 0, y: 0, z: 0 },
  },
  replicas: [{
    arenaId: "arena-2",
    anchor: { x: 32, y: 0, z: 0 },
  }],
  offsets: [{ x: 32, y: 0, z: 0 }],
  confidence: "medium" as const,
};

describe("arena block entity proof", () => {
  it("normalizes translated coordinates and verifies equal payload", async () => {
    const values = new Map<string, Uint8Array>([
      [key(0, 0), entity(1, 2, 3, "say hello")],
      [key(2, 0), entity(33, 2, 3, "say hello")],
    ]);

    const result = await proveArenaBlockEntityEquivalence(
      reader(values),
      layout,
      {
        includedVolumes: [{
          min: { x: 0, y: 0, z: 0 },
          max: { x: 15, y: 15, z: 15 },
        }],
      },
    );

    expect(result.status).toBe("verified");
    expect(result.replicas[0]).toMatchObject({
      status: "verified",
      mismatchCount: 0,
      comparedEntities: 1,
    });
  });

  it("detects semantic NBT payload divergence", async () => {
    const values = new Map<string, Uint8Array>([
      [key(0, 0), entity(1, 2, 3, "say hello")],
      [key(2, 0), entity(33, 2, 3, "say different")],
    ]);

    const result = await proveArenaBlockEntityEquivalence(
      reader(values),
      layout,
      {
        includedVolumes: [{
          min: { x: 0, y: 0, z: 0 },
          max: { x: 15, y: 15, z: 15 },
        }],
      },
    );

    expect(result.status).toBe("diverged");
    expect(result.replicas[0]?.mismatches[0]?.kind)
      .toBe("payload-mismatch");
  });

  it("treats absent records as an empty block-entity set", async () => {
    const result = await proveArenaBlockEntityEquivalence(
      reader(new Map()),
      layout,
      {
        includedVolumes: [{
          min: { x: 0, y: 0, z: 0 },
          max: { x: 15, y: 15, z: 15 },
        }],
      },
    );

    expect(result.status).toBe("verified");
    expect(result.canonicalEntities).toBe(0);
  });
});
}

// Consolidated suite from engine/packages/orchestrator/test/arena/arena-structure-instance-proof.test.ts
{
describe("arena structure instance proof", () => {
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
  const plan = {
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

  it("verifies translated structure instances with the same semantics", () => {
    const result = proveArenaStructureInstances(
      layout,
      plan,
      [
        {
          target: "arena/base",
          position: { x: 5, y: 0, z: 5 },
          options: { includeEntities: true },
          sourceKind: "command",
        },
        {
          target: "arena/base",
          position: { x: 105, y: 0, z: 5 },
          options: { includeEntities: true },
          sourceKind: "command",
        },
      ],
    );

    expect(result.status).toBe("verified");
    expect(result.replicas[0]?.mismatches).toEqual([]);
  });

  it("detects a different structure target in one replica", () => {
    const result = proveArenaStructureInstances(
      layout,
      plan,
      [
        {
          target: "arena/base",
          position: { x: 5, y: 0, z: 5 },
          sourceKind: "command",
        },
        {
          target: "arena/wrong",
          position: { x: 105, y: 0, z: 5 },
          sourceKind: "command",
        },
      ],
    );

    expect(result.status).toBe("diverged");
    expect(result.replicas[0]?.mismatches.length)
      .toBeGreaterThan(0);
  });
});
}

// Consolidated suite from engine/packages/orchestrator/test/arena/arena-voxel-proof.test.ts
{
function singleBlockSubchunk(name: string): Uint8Array {
  const palette = writeUncompressed(
    comp({
      name: string(name),
      states: comp({}),
      version: int(1),
    }, "") as NBT,
    "little",
  );
  return Buffer.concat([Buffer.from([9, 1, 0, 0]), palette]);
}

function reader(entries: Map<string, Uint8Array>): BedrockLevelDbReader {
  return {
    async get(key) {
      return entries.get(Buffer.from(key).toString("hex"));
    },
    async *entries() {},
    async close() {},
  };
}

function key(chunkX: number, chunkZ: number, subY: number): string {
  const bytes = Buffer.alloc(10);
  bytes.writeInt32LE(chunkX, 0);
  bytes.writeInt32LE(chunkZ, 4);
  bytes[8] = 47;
  bytes.writeInt8(subY, 9);
  return bytes.toString("hex");
}

describe("arena voxel proof", () => {
  it("compares non-chunk-aligned replicas by exact world coordinate", async () => {
    const db = new Map<string, Uint8Array>();
    db.set(key(0, 0, 0), singleBlockSubchunk("minecraft:stone"));
    db.set(key(1, 0, 0), singleBlockSubchunk("minecraft:stone"));

    const result = await proveArenaVoxelEquivalence(
      reader(db),
      {
        canonical: {
          arenaId: "arena-1",
          anchor: { x: 0, y: 0, z: 0 },
          items: [],
        },
        replicas: [{
          arenaId: "arena-2",
          anchor: { x: 17, y: 0, z: 0 },
          items: [],
        }],
        offsets: [{ x: 17, y: 0, z: 0 }],
        supportByOffset: { "17,0,0": 3 },
        confidence: "medium",
        evidenceCandidates: 3,
      },
      { marginBlocks: 0, maxBlocks: 1 },
    );

    expect(result.status).toBe("verified");
  });

  it("fails closed when required subchunks are unavailable", async () => {
    const result = await proveArenaVoxelEquivalence(
      reader(new Map()),
      {
        canonical: { arenaId: "arena-1", anchor: { x: 0, y: 0, z: 0 }, items: [] },
        replicas: [{ arenaId: "arena-2", anchor: { x: 17, y: 0, z: 0 }, items: [] }],
        offsets: [{ x: 17, y: 0, z: 0 }],
        supportByOffset: { "17,0,0": 3 },
        confidence: "medium",
        evidenceCandidates: 3,
      },
      { marginBlocks: 0, maxBlocks: 1 },
    );

    expect(result.status).toBe("incomplete");
  });
  it("proves a closed barrier shell blocks flight-style 3D traversal", async () => {
    const db = new Map<string, Uint8Array>();
    for (let chunkX = -1; chunkX <= 1; chunkX += 1) {
      for (let chunkZ = -1; chunkZ <= 1; chunkZ += 1) {
        for (let subY = -1; subY <= 1; subY += 1) {
          const interior = chunkX === 0 && chunkZ === 0 && subY === 0;
          db.set(
            key(chunkX, chunkZ, subY),
            singleBlockSubchunk(interior ? "minecraft:air" : "minecraft:barrier"),
          );
        }
      }
    }

    const result = await proveArenaBarrierContainment(
      reader(db),
      {
        searchVolume: {
          min: { x: -16, y: -16, z: -16 },
          max: { x: 31, y: 31, z: 31 },
        },
        starts: [{ x: 8, y: 2, z: 8 }],
        maxVisitedPositions: 20_000,
      },
    );

    expect(result.status).toBe("contained");
    expect(result.escapePosition).toBeUndefined();
  });

  it("does not call an open barrier shell contained", async () => {
    const db = new Map<string, Uint8Array>();
    for (let chunkX = -1; chunkX <= 1; chunkX += 1) {
      for (let chunkZ = -1; chunkZ <= 1; chunkZ += 1) {
        for (let subY = -1; subY <= 1; subY += 1) {
          const interior = chunkX === 0 && chunkZ === 0 && subY === 0;
          const opening = chunkX === 1 && chunkZ === 0 && subY === 0;
          db.set(
            key(chunkX, chunkZ, subY),
            singleBlockSubchunk(
              interior || opening ? "minecraft:air" : "minecraft:barrier",
            ),
          );
        }
      }
    }

    const result = await proveArenaBarrierContainment(
      reader(db),
      {
        searchVolume: {
          min: { x: -16, y: -16, z: -16 },
          max: { x: 31, y: 31, z: 31 },
        },
        starts: [{ x: 8, y: 2, z: 8 }],
        maxVisitedPositions: 40_000,
      },
    );

    expect(result.status).toBe("escape-reachable");
    expect(result.escapePosition).toBeDefined();
  });

  it("fails closed when barrier containment evidence is incomplete", async () => {
    const result = await proveArenaBarrierContainment(
      reader(new Map()),
      {
        searchVolume: {
          min: { x: -2, y: -2, z: -2 },
          max: { x: 2, y: 3, z: 2 },
        },
        starts: [{ x: 0, y: 0, z: 0 }],
      },
    );

    expect(result.status).toBe("incomplete");
  });
  it("marks barrier enclosure open-or-unproven when exterior reaches authored volume", async () => {
    const db = new Map<string, Uint8Array>();
    for (let chunkX = -1; chunkX <= 1; chunkX += 1) {
      for (let chunkZ = -1; chunkZ <= 1; chunkZ += 1) {
        for (let subY = -1; subY <= 1; subY += 1) {
          db.set(
            key(chunkX, chunkZ, subY),
            singleBlockSubchunk("minecraft:air"),
          );
        }
      }
    }

    const result = await proveArenaBarrierEnclosure(
      reader(db),
      {
        basis: "topology",
        canonical: {
          arenaId: "arena-1",
          anchor: { x: 0, y: 0, z: 0 },
        },
        replicas: [],
        offsets: [],
        confidence: "high",
      },
      {
        volumes: [{
          min: { x: 0, y: 0, z: 0 },
          max: { x: 1, y: 2, z: 1 },
          evidenceCandidateIds: ["fixture"],
        }],
        boundingBox: {
          min: { x: 0, y: 0, z: 0 },
          max: { x: 1, y: 2, z: 1 },
        },
        totalBlocks: 12,
        evidenceCandidates: 1,
        mergeGapBlocks: 0,
        confidence: "high",
      },
      {
        searchMarginBlocks: 4,
        maxVisitedPositionsPerArena: 10_000,
      },
    );

    expect(result.status).toBe("open-or-unproven");
    expect(result.arenas[0]?.reachedTargetPosition).toBeDefined();
  });

  it("fails closed when exterior barrier evidence is unavailable", async () => {
    const result = await proveArenaBarrierEnclosure(
      reader(new Map()),
      {
        basis: "topology",
        canonical: {
          arenaId: "arena-1",
          anchor: { x: 0, y: 0, z: 0 },
        },
        replicas: [],
        offsets: [],
        confidence: "high",
      },
      {
        volumes: [{
          min: { x: 0, y: 0, z: 0 },
          max: { x: 1, y: 2, z: 1 },
          evidenceCandidateIds: ["fixture"],
        }],
        boundingBox: {
          min: { x: 0, y: 0, z: 0 },
          max: { x: 1, y: 2, z: 1 },
        },
        totalBlocks: 12,
        evidenceCandidates: 1,
        mergeGapBlocks: 0,
        confidence: "high",
      },
    );

    expect(result.status).toBe("incomplete");
  });
});
}
