import { describe, expect, it } from "vitest";
import { evaluateSafeConfig } from "../../../../packages/behavior-model/src/index.js";
import { compileScriptSafeConfig } from "../../src/config/safe-config-compiler.js";

const source = {
  artifactId: "fixture",
  relativePath: "scripts/config.ts",
};

describe("safe config compiler", () => {
  it("compiles deterministic arena constants without executing source", () => {
    const result = compileScriptSafeConfig(
      [
        "const BASE = { x: 10, y: 20, z: 30 };",
        "const OFFSET = { x: 100, y: 0, z: -20 };",
        "const CENTER = translate3(BASE, OFFSET);",
        "const ARENA_COUNT = 2 + 4;",
      ].join("\n"),
      source,
    );

    const bindings = Object.fromEntries(
      result.bindings.map((item) => [
        item.name,
        item.expression,
      ]),
    );

    expect(
      evaluateSafeConfig(
        { kind: "ref", name: "CENTER" },
        { bindings },
      ),
    ).toEqual({ x: 110, y: 20, z: 10 });
    expect(
      evaluateSafeConfig(
        { kind: "ref", name: "ARENA_COUNT" },
        { bindings },
      ),
    ).toBe(6);
    expect(result.rejected).toEqual([]);
  });

  it("rejects impure calls and mutable declarations", () => {
    const result = compileScriptSafeConfig(
      [
        "let current = 1;",
        "current += 2;",
        "const dynamic = world.getPlayers();",
      ].join("\n"),
      source,
    );

    expect(result.bindings).toEqual([]);
    expect(result.rejected.map((item) => item.reason))
      .toEqual(["unsupported-call", "non-const"].sort());
  });

  it("preserves conservative reassignment ownership after indexing mutation sites", () => {
    const result = compileScriptSafeConfig([
      "let lowered = 7;",
      "let nested = 3;",
      "function mutate() { nested++; }",
      "let ownInitializer = (ownInitializer = 1);",
    ].join("\n"), source);
    expect(result.bindings.map(item => item.name)).toContain("lowered");
    expect(result.rejected).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "nested", reason: "non-const" }),
      expect.objectContaining({ name: "ownInitializer", reason: "unsupported-expression" }),
    ]));
    expect(result.rejected).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "ownInitializer", reason: "non-const" }),
    ]));
  });

  it("rejects direct collection mutations while preserving read-only mapping", () => {
    const result = compileScriptSafeConfig([
      'var ENABLED_ARENA_IDS = ["arena_a", "arena_b"];',
      'ENABLED_ARENA_IDS.push("arena_c");',
      'const CONFIG = { x: 1 };',
      'CONFIG.x = 2;',
      'const BLOCKS = [1, 2];',
      'BLOCKS[0] = 3;',
      'const UNCHANGED = [1, 2];',
      'UNCHANGED.map(value => value);',
    ].join("\n"), source);
    expect(result.rejected).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "ENABLED_ARENA_IDS", reason: "non-const" }),
      expect.objectContaining({ name: "CONFIG", reason: "non-const" }),
      expect.objectContaining({ name: "BLOCKS", reason: "non-const" }),
    ]));
    expect(result.bindings.map(binding => binding.name)).toContain("UNCHANGED");
    expect(result.bindings.map(binding => binding.name)).not.toContain("ENABLED_ARENA_IDS");
  });

  it("compiles map Array.from spreads conditionals and pure helpers", () => {
    const result = compileScriptSafeConfig(
      [
        "const BASE = { x: 10, y: 20, z: 30 };",
        "const OFFSETS = [{ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }];",
        "function makeArena(offset) { return translate3(BASE, offset); }",
        "const ARENA_CENTERS = OFFSETS.map(makeArena);",
        "const IDS = Array.from({ length: 3 }, (_, i) => 'arena-' + (i + 1));",
        "const EXTRA = [3, 4];",
        "const VALUES = [1, 2, ...EXTRA];",
        "const OPTIONS = { a: 1, ...{ b: 2 }, c: true ? 3 : 4 };",
      ].join("\n"),
      source,
    );

    const bindings = Object.fromEntries(
      result.bindings.map((item) => [
        item.name,
        item.expression,
      ]),
    );
    const functions = Object.fromEntries(
      result.functions.map((item) => [
        item.name,
        item.definition,
      ]),
    );

    expect(
      evaluateSafeConfig(
        { kind: "ref", name: "ARENA_CENTERS" },
        { bindings, functions },
      ),
    ).toEqual([
      { x: 10, y: 20, z: 30 },
      { x: 110, y: 20, z: 30 },
    ]);
    expect(
      evaluateSafeConfig(
        { kind: "ref", name: "IDS" },
        { bindings, functions },
      ),
    ).toEqual([
      "arena-1",
      "arena-2",
      "arena-3",
    ]);
    expect(
      evaluateSafeConfig(
        { kind: "ref", name: "VALUES" },
        { bindings, functions },
      ),
    ).toEqual([1, 2, 3, 4]);
    expect(
      evaluateSafeConfig(
        { kind: "ref", name: "OPTIONS" },
        { bindings, functions },
      ),
    ).toEqual({
      a: 1,
      b: 2,
      c: 3,
    });
  });

  it("supports safe property access chains", () => {
    const result = compileScriptSafeConfig(
      [
        "const CONFIG = { arena: { count: 6 } };",
        "const COUNT = CONFIG.arena.count;",
      ].join("\n"),
      source,
    );

    const bindings = Object.fromEntries(
      result.bindings.map((item) => [
        item.name,
        item.expression,
      ]),
    );
    expect(
      evaluateSafeConfig(
        { kind: "ref", name: "COUNT" },
        { bindings },
      ),
    ).toBe(6);
  });

  it("rejects namespace re-exports explicitly", () => {
    const result = compileScriptSafeConfig(
      'export * as config from "./base.js";',
      source,
    );

    expect(result.rejected).toEqual([
      expect.objectContaining({
        name: "config",
        reason: "unsupported-expression",
      }),
    ]);
  });

});
