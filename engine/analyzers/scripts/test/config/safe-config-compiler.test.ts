// Coherent source-level test family; no coverage or runtime claim.
import { describe, expect, it } from "vitest";
import { evaluateSafeConfig } from "../../../../packages/behavior-model/src/index.js";
import { compileScriptSafeConfig } from "../../src/config/safe-config-compiler.js";
import { evaluateScriptSafeConfigExport, linkScriptSafeConfigProject } from "../../src/config/safe-config-project.js";

// Original source suite: engine/analyzers/scripts/test/config/safe-config-compiler.test.ts (Git blob 5e7d5721a658b103b919f2db3eedf34a829d380c)
{


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
}

// Original source suite: engine/analyzers/scripts/test/config/safe-config-project.test.ts (Git blob fb31aa5a4668deafbd761735a1a52d5a014dd454)
{


const source = (relativePath: string) => ({
  artifactId: "artifact:test",
  relativePath,
});

describe("safe-config project linker", () => {
  it("resolves deterministic imports and exports across script modules", () => {
    const project = linkScriptSafeConfigProject([
      {
        path: "scripts/base.ts",
        source: source("scripts/base.ts"),
        text: `
          export const BASE = { x: 100, y: 50, z: 200 };
          export const STEP = 512;
        `,
      },
      {
        path: "scripts/arena.ts",
        source: source("scripts/arena.ts"),
        text: `
          import { BASE, STEP } from "./base";
          const makeArena = (index) => ({
            x: BASE.x + index * STEP,
            y: BASE.y,
            z: BASE.z
          });
          export const ENABLED_ARENAS = Array.from(
            { length: 3 },
            (_, index) => makeArena(index)
          );
        `,
      },
    ]);

    expect(project.diagnostics).toEqual([]);
    expect(
      evaluateScriptSafeConfigExport(
        project,
        "scripts/arena.ts",
        "ENABLED_ARENAS",
      ),
    ).toEqual([
      { x: 100, y: 50, z: 200 },
      { x: 612, y: 50, z: 200 },
      { x: 1124, y: 50, z: 200 },
    ]);
  });

  it("fails closed when an imported module cannot be resolved", () => {
    const project = linkScriptSafeConfigProject([
      {
        path: "scripts/arena.ts",
        source: source("scripts/arena.ts"),
        text: `
          import { BASE } from "./missing";
          export const ARENA = { x: BASE.x, y: 0, z: 0 };
        `,
      },
    ]);

    expect(project.diagnostics).toEqual([
      expect.objectContaining({
        kind: "missing-module",
        symbol: "BASE",
      }),
    ]);
  });

  it("resolves multi-hop named re-export barrels", () => {
    const project = linkScriptSafeConfigProject([
      {
        path: "scripts/base.ts",
        source: source("scripts/base.ts"),
        text: `
          export const ARENA_COUNT = 6;
        `,
      },
      {
        path: "scripts/barrel.ts",
        source: source("scripts/barrel.ts"),
        text: `
          export { ARENA_COUNT } from "./base.js";
        `,
      },
      {
        path: "scripts/index.ts",
        source: source("scripts/index.ts"),
        text: `
          export { ARENA_COUNT } from "./barrel.js";
        `,
      },
      {
        path: "scripts/config.ts",
        source: source("scripts/config.ts"),
        text: `
          import { ARENA_COUNT } from "./index.js";
          export const VALUE = ARENA_COUNT + 1;
        `,
      },
    ]);

    expect(project.diagnostics).toEqual([]);
    expect(
      evaluateScriptSafeConfigExport(
        project,
        "scripts/config.ts",
        "VALUE",
      ),
    ).toBe(7);
  });

  it("resolves deterministic default exports and imports", () => {
    const project = linkScriptSafeConfigProject([
      {
        path: "scripts/base.ts",
        source: source("scripts/base.ts"),
        text: `
          const CONFIG = { arenaCount: 4 };
          export default CONFIG;
        `,
      },
      {
        path: "scripts/config.ts",
        source: source("scripts/config.ts"),
        text: `
          import CONFIG from "./base.js";
          export const COUNT = CONFIG.arenaCount;
        `,
      },
    ]);

    expect(project.diagnostics).toEqual([]);
    expect(
      evaluateScriptSafeConfigExport(
        project,
        "scripts/config.ts",
        "COUNT",
      ),
    ).toBe(4);
  });

  it("exposes deterministic namespace imports as read-only export objects", () => {
    const project = linkScriptSafeConfigProject([
      {
        path: "scripts/base.ts",
        source: source("scripts/base.ts"),
        text: `
          export const COUNT = 3;
          export const OFFSET = 64;
        `,
      },
      {
        path: "scripts/config.ts",
        source: source("scripts/config.ts"),
        text: `
          import * as base from "./base.js";
          export const VALUE = base.COUNT * base.OFFSET;
        `,
      },
    ]);

    expect(project.diagnostics).toEqual([]);
    expect(
      evaluateScriptSafeConfigExport(
        project,
        "scripts/config.ts",
        "VALUE",
      ),
    ).toBe(192);
  });

  it("fails closed on ambiguous star re-exports", () => {
    const project = linkScriptSafeConfigProject([
      {
        path: "scripts/a.ts",
        source: source("scripts/a.ts"),
        text: "export const COUNT = 2;",
      },
      {
        path: "scripts/b.ts",
        source: source("scripts/b.ts"),
        text: "export const COUNT = 3;",
      },
      {
        path: "scripts/index.ts",
        source: source("scripts/index.ts"),
        text: `
          export * from "./a.js";
          export * from "./b.js";
        `,
      },
      {
        path: "scripts/config.ts",
        source: source("scripts/config.ts"),
        text: `
          import { COUNT } from "./index.js";
          export const VALUE = COUNT;
        `,
      },
    ]);

    expect(
      project.diagnostics,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "ambiguous-export",
          symbol: "COUNT",
        }),
      ]),
    );
    expect(() =>
      evaluateScriptSafeConfigExport(
        project,
        "scripts/config.ts",
        "VALUE",
      )
    ).toThrow();
  });


  it("reports missing modules behind star re-exports", () => {
    const project = linkScriptSafeConfigProject([
      {
        path: "scripts/index.ts",
        source: source("scripts/index.ts"),
        text: 'export * from "./missing.js";',
      },
    ]);

    expect(project.diagnostics).toEqual([
      expect.objectContaining({
        kind: "missing-module",
        modulePath: "scripts/index.ts",
      }),
    ]);
  });


  it("materializes only value exports in namespace objects", () => {
    const project = linkScriptSafeConfigProject([
      {
        path: "scripts/base.ts",
        source: source("scripts/base.ts"),
        text: `
          export const COUNT = 5;
          export function make(value) { return value + 1; }
        `,
      },
      {
        path: "scripts/config.ts",
        source: source("scripts/config.ts"),
        text: `
          import * as base from "./base.js";
          export const VALUE = base.COUNT;
        `,
      },
    ]);

    expect(project.diagnostics).toEqual([]);
    expect(
      evaluateScriptSafeConfigExport(
        project,
        "scripts/config.ts",
        "VALUE",
      ),
    ).toBe(5);
  });

});
}
