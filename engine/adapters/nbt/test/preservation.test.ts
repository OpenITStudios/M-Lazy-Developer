import { describe, expect, it } from "vitest";
import { writeBedrockNbt } from "../src/write.js";
import type { ParsedNbtDocument } from "../src/types.js";

describe("NBT preservation", () => {
  it("reuses exact original bytes while document is untouched", () => {
    const original = new Uint8Array([1, 2, 3, 4]);
    const document = {
      format: "little",
      typed: {} as ParsedNbtDocument["typed"],
      simplified: {},
      originalBytes: original,
      dirty: false,
    } satisfies ParsedNbtDocument;

    const result = writeBedrockNbt(document);
    expect(result.reusedOriginalBytes).toBe(true);
    expect([...result.bytes]).toEqual([1, 2, 3, 4]);
  });
});
