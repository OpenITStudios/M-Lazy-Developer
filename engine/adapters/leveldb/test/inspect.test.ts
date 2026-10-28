import { describe, expect, it } from "vitest";
import {
  describeLevelDbEntry,
  scanLevelDbMetadata,
} from "../src/inspect.js";
import type { BedrockLevelDbReader } from "../src/types.js";

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
