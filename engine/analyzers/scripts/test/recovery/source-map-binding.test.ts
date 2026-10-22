import { describe, expect, it } from "vitest";
import {
  bindGeneratedPosition,
  parseSourceMapV3,
} from "../../src/recovery/source-map-binding.js";

describe("source map binding", () => {
  it("binds a simple VLQ segment", () => {
    const map = parseSourceMapV3({
      version: 3,
      file: "bundle.js",
      sourceRoot: "src",
      sources: ["main.ts"],
      names: [],
      mappings: "AAAA",
    });

    expect(bindGeneratedPosition(map, 1, 0)).toEqual(
      expect.objectContaining({
        status: "resolved",
        source: "src/main.ts",
        originalLine: 1,
        originalColumn: 0,
      }),
    );
  });

  it("carries source and original line deltas across generated lines", () => {
    const map = parseSourceMapV3({
      version: 3, sources: ["a.ts", "b.ts"], names: [],
      // First line maps to b.ts line 3, next segment preserves both deltas.
      mappings: "ACEI;AAAA",
    });
    expect(bindGeneratedPosition(map, 2, 0)).toEqual(
      expect.objectContaining({
        status: "resolved", source: "b.ts", originalLine: 3,
        originalColumn: 4,
      }),
    );
  });

  it("does not map an explicitly unmapped gap in a bundled line", () => {
    const map = parseSourceMapV3({
      version: 3, sources: ["one.ts"], names: [],
      mappings: "AAAA,K,KAAA",
    });
    expect(bindGeneratedPosition(map, 1, 4).status).toBe("resolved");
    expect(bindGeneratedPosition(map, 1, 7).status).toBe("unmapped");
    expect(bindGeneratedPosition(map, 1, 10).status).toBe("resolved");
  });

  it("fails closed on malformed segment arity and excessive VLQ", () => {
    for (const mappings of ["AAA", "///////////A"]) {
      const map = parseSourceMapV3({
        version: 3, sources: ["one.ts"], names: [], mappings,
      });
      expect(bindGeneratedPosition(map, 1, 0).status).toBe("invalid");
    }
  });

  it("fails closed on invalid mappings", () => {
    const map = parseSourceMapV3({
      version: 3,
      sources: ["main.ts"],
      names: [],
      mappings: "*",
    });

    expect(bindGeneratedPosition(map, 1, 0).status).toBe("invalid");
  });
});
