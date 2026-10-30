// Consolidated same-directory source test suites; assertions retained unchanged.
import { describe } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { writeUncompressed } from "prismarine-nbt";
import { type NBT } from "prismarine-nbt";
import { decodeBedrockActorRecord } from "../src/actor.js";
import { comp } from "prismarine-nbt";
import { int } from "prismarine-nbt";
import { string } from "prismarine-nbt";
import { decodeBedrockBlockEntityRecord } from "../src/block-entity.js";
import { describeLevelDbEntry } from "../src/inspect.js";
import { scanLevelDbMetadata } from "../src/inspect.js";
import { type BedrockLevelDbReader } from "../src/types.js";
import { classifyBedrockLevelDbKey } from "../src/keyspace.js";
import { blockAt } from "../src/subchunk.js";
import { decodeBedrockSubChunk } from "../src/subchunk.js";

// Original suite engine/adapters/leveldb/test/actor.test.ts, blob 5c8b49835fa842d789eb381309f73b6199a02a96
{
describe("bedrock actor decoder", () => {
  it("decodes identifier and Pos without inventing other fields", async () => {
    const nbt: NBT = {
      type: "compound",
      name: "",
      value: {
        identifier: { type: "string", value: "minecraft:zombie" },
        Pos: {
          type: "list",
          value: { type: "float", value: [10.5, 64, -2.25] },
        },
      },
    };
    const bytes = new Uint8Array(
      writeUncompressed(nbt, "little"),
    );

    const decoded =
      await decodeBedrockActorRecord(bytes);

    expect(decoded.identifier)
      .toBe("minecraft:zombie");
    expect(decoded.position)
      .toEqual({
        x: 10.5,
        y: 64,
        z: -2.25,
      });
  });
});
}

// Original suite engine/adapters/leveldb/test/block-entity.test.ts, blob b2b10b15007586dd59addcfe129700e42dc775ea
{
function entity(
  id: string,
  x: number,
  y: number,
  z: number,
): Buffer {
  return writeUncompressed(
    comp({
      id: string(id),
      x: int(x),
      y: int(y),
      z: int(z),
    }, "") as NBT,
    "little",
  );
}

describe("Bedrock block entity record decoder", () => {
  it("decodes concatenated little-endian block entity compounds", async () => {
    const bytes = Buffer.concat([
      entity("Chest", 1, 2, 3),
      entity("CommandBlock", 4, 5, 6),
    ]);

    const result =
      await decodeBedrockBlockEntityRecord(bytes);

    expect(result.entities).toHaveLength(2);
    expect(result.entities[0]).toMatchObject({
      identifier: "Chest",
      position: { x: 1, y: 2, z: 3 },
    });
    expect(result.entities[1]).toMatchObject({
      identifier: "CommandBlock",
      position: { x: 4, y: 5, z: 6 },
    });
    expect(result.bytesConsumed).toBe(bytes.length);
  });
});
}

// Original suite engine/adapters/leveldb/test/inspect.test.ts, blob 8eec4a7218c311c5ace6428636755d3780a8257b
{
describe("LevelDB metadata inspection", () => {
  it("preserves binary keys as hex and exposes printable key preview only when safe", () => {
    expect(
      describeLevelDbEntry(
        new Uint8Array(Buffer.from("DynamicProperties")),
        new Uint8Array([1, 2, 3]),
      ),
    ).toMatchObject({
      keyPreview: "DynamicProperties",
      keyBytes: 17,
      valueBytes: 3,
    });

    expect(
      describeLevelDbEntry(
        new Uint8Array([0, 255, 1]),
        new Uint8Array([9]),
      ).keyPreview,
    ).toBeUndefined();
  });

  it("streams complete metadata to one aggregate without a retained duplicate", async () => {
    const keys = [new Uint8Array([1]), new Uint8Array([2])];
    const reader: BedrockLevelDbReader = {
      async get() { return undefined; },
      async *entries() {
        for (const key of keys) yield { key, value: new Uint8Array([9, 8]) };
      },
      async close() {},
    };
    const evidence: string[] = [];
    const result = await scanLevelDbMetadata(reader, {
      maxEntries: 3, maxValueBytes: 16, maxTotalValueBytes: 8,
    }, {
      retainMetadata: false,
      onMetadata(entry) { evidence.push(entry.keyHex); },
    });
    expect(result.entriesScanned).toBe(2);
    expect(result.metadata).toEqual([]);
    expect(evidence).toEqual(["01", "02"]);
    expect(result.totalValueBytes).toBe(4);
    expect(result.truncated).toBe(false);
  });

  it("does not let streaming hide a finite budget truncation", async () => {
    const reader: BedrockLevelDbReader = {
      async get() { return undefined; },
      async *entries() {
        yield { key: new Uint8Array([1]), value: new Uint8Array([1]) };
        yield { key: new Uint8Array([2]), value: new Uint8Array([2]) };
      },
      async close() {},
    };
    const observed: string[] = [];
    const result = await scanLevelDbMetadata(reader, {
      maxEntries: 1, maxValueBytes: 16, maxTotalValueBytes: 16,
    }, { retainMetadata: false, onMetadata(entry) { observed.push(entry.keyHex); } });
    expect(result.truncated).toBe(true);
    expect(result.metadata).toEqual([]);
    expect(observed).toEqual(["01"]);
  });

  it("stops at bounded scan budgets", async () => {
    const reader: BedrockLevelDbReader = {
      async get() { return undefined; },
      async *entries() {
        yield { key: new Uint8Array([1]), value: new Uint8Array([1]) };
        yield { key: new Uint8Array([2]), value: new Uint8Array([2]) };
      },
      async close() {},
    };

    const result = await scanLevelDbMetadata(reader, {
      maxEntries: 1,
      maxValueBytes: 16,
      maxTotalValueBytes: 16,
    });

    expect(result.entriesScanned).toBe(1);
    expect(result.truncated).toBe(true);
  });
});
}

// Original suite engine/adapters/leveldb/test/keyspace.test.ts, blob c8526451020acb3fa83a819c6b9d450a98803218
{
function chunkKey(
  x: number,
  z: number,
  tag: number,
  dimension?: number,
  suffix?: number,
): Uint8Array {
  const length = dimension === undefined ? 9 : 13;
  const bytes = new Uint8Array(length + (suffix === undefined ? 0 : 1));
  const view = new DataView(bytes.buffer);
  view.setInt32(0, x, true);
  view.setInt32(4, z, true);
  let offset = 8;
  if (dimension !== undefined) {
    view.setInt32(8, dimension, true);
    offset = 12;
  }
  bytes[offset] = tag;
  if (suffix !== undefined) bytes[offset + 1] = suffix & 0xff;
  return bytes;
}

describe("Bedrock LevelDB keyspace classification", () => {
  it("classifies actor and digest keyspaces", () => {
    expect(classifyBedrockLevelDbKey(
      new Uint8Array(Buffer.from("actorprefix123", "ascii")),
    ).family).toBe("actor");

    expect(classifyBedrockLevelDbKey(
      new Uint8Array(Buffer.from("digp123", "ascii")),
    ).family).toBe("actor-digest");
  });

  it("classifies chunk data and coordinates", () => {
    expect(classifyBedrockLevelDbKey(chunkKey(12, -4, 49, 0))).toMatchObject({
      family: "chunk-data",
      chunkDataKind: "BlockEntity",
      chunkX: 12,
      chunkZ: -4,
      dimensionId: 0,
    });
  });

  it("classifies subchunk index", () => {
    expect(classifyBedrockLevelDbKey(chunkKey(1, 2, 47, undefined, -3))).toMatchObject({
      family: "chunk-data",
      chunkDataKind: "SubChunkPrefix",
      subChunkIndex: -3,
    });
  });
});
}

// Original suite engine/adapters/leveldb/test/subchunk.test.ts, blob 41de4b1c7185fdc73d0d5366d0a9f58111795039
{
function paletteBlock(name: string): NBT {
  return comp({
    name: string(name),
    states: comp({}),
    version: int(1),
  }, "") as NBT;
}

describe("Bedrock subchunk decoder", () => {
  it("decodes a v9 single-block persistent layer", async () => {
    const palette = writeUncompressed(paletteBlock("minecraft:stone"), "little");
    const bytes = Buffer.concat([
      Buffer.from([9, 1, 0, 0]),
      palette,
    ]);

    const decoded = await decodeBedrockSubChunk(bytes);
    expect(decoded.version).toBe(9);
    expect(decoded.yIndex).toBe(0);
    expect(blockAt(decoded, 0, 0, 0)?.name).toBe("minecraft:stone");
    expect(blockAt(decoded, 15, 15, 15)?.name).toBe("minecraft:stone");
  });

  it("rejects runtime palettes rather than fabricating stable block identities", async () => {
    const bytes = Buffer.from([9, 1, 0, 3]);
    await expect(decodeBedrockSubChunk(bytes)).rejects.toThrow(
      /Runtime-ID/,
    );
  });
});
}
