import { describe, expect, it } from "vitest";
import {
  deriveCrossFileCallEdges,
} from "../../src/parser/cross-file-call.js";
import { parseScriptFile } from "../../src/parser/parse.js";

describe("cross-file call resolution", () => {
  it("refuses ambiguous extension fallbacks and type-only barrel exports", () => {
    const file = (name: string, text: string) => ({
      path: "behavior_packs/map/scripts/" + name,
      text,
      source: { artifactId: "selected",
        relativePath: "behavior_packs/map/scripts/" + name },
    });
    const main = file("main.ts", [
      'import { open } from "./entry";',
      "open();",
    ].join("\n"));
    const entryTs = file("entry.ts", "export function open() {}");
    const entryJs = file("entry.js", "export function open() {}");
    expect(deriveCrossFileCallEdges([main, entryTs, entryJs])[0])
      .toMatchObject({ status: "unresolved" });
    expect(deriveCrossFileCallEdges([main, entryTs])[0])
      .toMatchObject({ status: "resolved", targetModule: entryTs.path });

    const bar = file("bar.ts", "export function open() {}");
    const typeOnly = file("entry.ts", [
      'export type { open } from "./bar";',
    ].join("\n"));
    const typedMain = file("main.ts", [
      'import { open } from "./entry";',
      "open();",
    ].join("\n"));
    expect(deriveCrossFileCallEdges([typedMain, typeOnly, bar])[0])
      .toMatchObject({ status: "unresolved" });
    const runtimeBarrel = file("entry.ts",
      'export { type Debug, open } from "./bar";');
    expect(deriveCrossFileCallEdges([typedMain, runtimeBarrel, bar])[0])
      .toMatchObject({ status: "resolved" });
  });

  it("resolves named ESM imports across TypeScript .js specifiers", () => {
    const edges = deriveCrossFileCallEdges([
      {
        path: "scripts/cleanup.ts",
        text: "export function releaseArena() {}",
        source: { artifactId: "map", relativePath: "scripts/cleanup.ts" },
      },
      {
        path: "scripts/main.ts",
        text: `
          import { releaseArena } from "./cleanup.js";
          export function finishGame() {
            releaseArena();
          }
        `,
        source: { artifactId: "map", relativePath: "scripts/main.ts" },
      },
    ]);

    expect(edges).toEqual([
      expect.objectContaining({
        callerModule: "scripts/main.ts",
        callerRegion: "function:finishGame",
        targetModule: "scripts/cleanup.ts",
        targetExport: "releaseArena",
        controlFlow: "unconditional",
        status: "resolved",
      }),
    ]);
  });

  it("keeps a call unresolved when the module exists but the imported export does not", () => {
    const edges = deriveCrossFileCallEdges([
      {
        path: "scripts/cleanup.ts",
        text: "export function cleanupArena() {}",
        source: { artifactId: "map", relativePath: "scripts/cleanup.ts" },
      },
      {
        path: "scripts/main.ts",
        text: `
          import { releaseArena } from "./cleanup.js";
          export function finishGame() {
            releaseArena();
          }
        `,
        source: { artifactId: "map", relativePath: "scripts/main.ts" },
      },
    ]);

    expect(edges[0]).toEqual(
      expect.objectContaining({
        targetModule: "scripts/cleanup.ts",
        targetExport: "releaseArena",
        status: "unresolved",
      }),
    );
  });

  it("resolves namespace imports to the implementation module", () => {
    const edges = deriveCrossFileCallEdges([
      {
        path: "scripts/arena.ts",
        text: "export function cleanupArena() {}",
        source: { artifactId: "map", relativePath: "scripts/arena.ts" },
      },
      {
        path: "scripts/main.ts",
        text: `
          import * as arena from "./arena.js";
          export function finishGame() {
            arena.cleanupArena();
          }
        `,
        source: { artifactId: "map", relativePath: "scripts/main.ts" },
      },
    ]);

    expect(edges[0]).toEqual(
      expect.objectContaining({
        targetModule: "scripts/arena.ts",
        targetExport: "cleanupArena",
        localName: "arena.cleanupArena",
        status: "resolved",
      }),
    );
  });

  it("follows named re-export barrel chains to the implementation module", () => {
    const edges = deriveCrossFileCallEdges([
      {
        path: "scripts/cleanup.ts",
        text: "export function cleanupArena() {}",
        source: { artifactId: "map", relativePath: "scripts/cleanup.ts" },
      },
      {
        path: "scripts/barrel.ts",
        text: 'export { cleanupArena } from "./cleanup.js";',
        source: { artifactId: "map", relativePath: "scripts/barrel.ts" },
      },
      {
        path: "scripts/index.ts",
        text: 'export { cleanupArena } from "./barrel.js";',
        source: { artifactId: "map", relativePath: "scripts/index.ts" },
      },
      {
        path: "scripts/main.ts",
        text: `
          import { cleanupArena } from "./index.js";
          export function finishGame() {
            cleanupArena();
          }
        `,
        source: { artifactId: "map", relativePath: "scripts/main.ts" },
      },
    ]);

    expect(edges[0]).toEqual(
      expect.objectContaining({
        targetModule: "scripts/cleanup.ts",
        targetExport: "cleanupArena",
        status: "resolved",
      }),
    );
  });

  it("resolves local export aliases to the implementation symbol", () => {
    const edges = deriveCrossFileCallEdges([
      {
        path: "scripts/cleanup.ts",
        text: `
          function cleanup() {}
          export { cleanup as cleanupArena };
        `,
        source: { artifactId: "map", relativePath: "scripts/cleanup.ts" },
      },
      {
        path: "scripts/main.ts",
        text: `
          import { cleanupArena } from "./cleanup.js";
          export function finishGame() {
            cleanupArena();
          }
        `,
        source: { artifactId: "map", relativePath: "scripts/main.ts" },
      },
    ]);

    expect(edges[0]).toEqual(
      expect.objectContaining({
        targetModule: "scripts/cleanup.ts",
        targetExport: "cleanup",
        status: "resolved",
      }),
    );
  });

  it("resolves named default exports to the implementation symbol", () => {
    const edges = deriveCrossFileCallEdges([
      {
        path: "scripts/cleanup.ts",
        text: "export default function cleanupArena() {}",
        source: { artifactId: "map", relativePath: "scripts/cleanup.ts" },
      },
      {
        path: "scripts/main.ts",
        text: `
          import cleanup from "./cleanup.js";
          export function finishGame() {
            cleanup();
          }
        `,
        source: { artifactId: "map", relativePath: "scripts/main.ts" },
      },
    ]);

    expect(edges[0]).toEqual(
      expect.objectContaining({
        targetModule: "scripts/cleanup.ts",
        targetExport: "cleanupArena",
        status: "resolved",
      }),
    );
  });


  it("treats cross-file calls after early return as conditional", () => {
    const edges = deriveCrossFileCallEdges([
      {
        path: "scripts/cleanup.ts",
        text: "export function cleanupArena() {}",
        source: { artifactId: "map", relativePath: "scripts/cleanup.ts" },
      },
      {
        path: "scripts/main.ts",
        text: `
          import { cleanupArena } from "./cleanup.js";
          export function finishGame(skipCleanup) {
            if (skipCleanup) return;
            cleanupArena();
          }
        `,
        source: { artifactId: "map", relativePath: "scripts/main.ts" },
      },
    ]);

    expect(edges[0]).toEqual(
      expect.objectContaining({
        controlFlow: "conditional",
        status: "resolved",
      }),
    );
  });


  it("records exact target regions for exported functions and const callbacks", () => {
    const edges = deriveCrossFileCallEdges([
      { path: "behavior_packs/demo/scripts/round.js", source: {
        artifactId: "world", relativePath: "behavior_packs/demo/scripts/round.js",
      }, text: [
        "function cleanupArena() {}",
        "export { cleanupArena as finishRound };",
        "export const scheduleNext = () => {};",
        "export class ArenaService {}",
      ].join("\n") },
      { path: "behavior_packs/demo/scripts/main.js", source: {
        artifactId: "world", relativePath: "behavior_packs/demo/scripts/main.js",
      }, text: [
        'import { finishRound as settle, scheduleNext, ArenaService } from "./round.js";',
        "function resolveGame() { settle(); scheduleNext(); ArenaService(); }",
      ].join("\n") },
    ]);
    expect(edges).toEqual(expect.arrayContaining([
      expect.objectContaining({
        localName: "settle", targetExport: "cleanupArena",
        targetRegion: "function:cleanupArena", status: "resolved",
      }),
      expect.objectContaining({
        localName: "scheduleNext", targetExport: "scheduleNext",
        targetRegion: expect.stringMatching(/^callback@3:/), status: "resolved",
      }),
      expect.objectContaining({
        localName: "ArenaService", status: "unresolved",
      }),
    ]));
    expect(edges.find(item => item.localName === "ArenaService")?.targetRegion)
      .toBeUndefined();
  });

  it("does not resolve imported call names shadowed by function/block locals", () => {
    const edges = deriveCrossFileCallEdges([
      { path: "scripts/cleanup.js", source: {
        artifactId: "world", relativePath: "scripts/cleanup.js",
      }, text: "export function cleanup() {}" },
      { path: "scripts/main.js", source: {
        artifactId: "world", relativePath: "scripts/main.js",
      }, text: [
        'import { cleanup } from "./cleanup.js";',
        "function correct() { cleanup(); }",
        "function shadowedParameter(cleanup) { cleanup(); }",
        "function shadowedBlock() {",
        "  const cleanup = () => {};",
        "  cleanup();",
        "}",
      ].join("\n") },
    ]);
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({
      callerRegion: "function:correct",
      targetRegion: "function:cleanup",
      status: "resolved",
    });
  });

  it("fails closed for cross-artifact, cross-pack and duplicate-path targets", () => {
    const source = (artifactId: string, relativePath: string) => ({
      artifactId, relativePath,
    });
    const target = "behavior_packs/a/scripts/cleanup.js";
    const main = "behavior_packs/a/scripts/main.js";
    const modules = [{
      path: target, text: "export function cleanup() {}",
      source: source("world", target),
    }, {
      path: main,
      text: 'import { cleanup } from "./cleanup.js"; cleanup();',
      source: source("world", main),
    }];
    const valid = deriveCrossFileCallEdges(modules);
    expect(valid[0]).toMatchObject({
      status: "resolved", targetRegion: "function:cleanup",
    });
    const foreign = deriveCrossFileCallEdges([
      { ...modules[0]!, source: source("another-world", target) },
      modules[1]!,
    ]);
    expect(foreign[0]).toMatchObject({ status: "unresolved" });
    expect(foreign[0]?.targetRegion).toBeUndefined();
    const duplicate = deriveCrossFileCallEdges([
      ...modules, { ...modules[0]!, source: source("duplicate", target) },
    ]);
    expect(duplicate[0]).toMatchObject({ status: "unresolved" });
    const otherPack = "behavior_packs/b/scripts/cleanup.js";
    const crossPack = deriveCrossFileCallEdges([{
      path: otherPack, source: source("world", otherPack),
      text: "export function cleanup() {}",
    }, {
      path: main, source: source("world", main),
      text: 'import { cleanup } from "../../b/scripts/cleanup.js"; cleanup();',
    }]);
    expect(crossPack[0]).toMatchObject({ status: "unresolved" });
    expect(crossPack[0]?.targetRegion).toBeUndefined();
  });

  it("does not treat type-only ESM imports as executable calls", () => {
    const edges = deriveCrossFileCallEdges([
      {
        path: "scripts/cleanup.ts",
        text: "export function cleanupArena() {}",
        source: { artifactId: "map", relativePath: "scripts/cleanup.ts" },
      },
      {
        path: "scripts/main.ts",
        text: [
          'import type { cleanupArena } from "./cleanup.js";',
          "function illegalRuntimeUse() { cleanupArena(); }",
        ].join("\n"),
        source: { artifactId: "map", relativePath: "scripts/main.ts" },
      },
    ]);
    expect(edges).toEqual([]);
  });


  it("reconstructs unique exported static methods from authored class expressions", () => {
    const edges = deriveCrossFileCallEdges([
      { path: "behavior_packs/BP/scripts/chunks/service.js",
        source: { artifactId: "current-map", relativePath: "behavior_packs/BP/scripts/chunks/service.js" },
        text: "var Scheduler = class { static register(name) { return name; } }; export { Scheduler };" },
      { path: "behavior_packs/BP/scripts/main.js",
        source: { artifactId: "current-map", relativePath: "behavior_packs/BP/scripts/main.js" },
        text: 'import { Scheduler } from "./chunks/service.js"; Scheduler.register("flush");' },
    ]);
    expect(edges).toEqual([expect.objectContaining({
      localName: "Scheduler.register", targetExport: "Scheduler",
      status: "resolved",
      targetModule: "behavior_packs/BP/scripts/chunks/service.js",
    })]);
    expect(edges[0]?.source.range?.columnStart).toBeGreaterThan(0);
    expect(edges[0]?.targetRegion).toMatch(/^function:Scheduler\.register@/);
  });


  it("handles a direct exported class without requiring a bundler wrapper", () => {
    const edges = deriveCrossFileCallEdges([
      { path: "scripts/service.js", source: { artifactId: "map", relativePath: "scripts/service.js" },
        text: 'export class Gate { static unlock() {} }' },
      { path: "scripts/main.js", source: { artifactId: "map", relativePath: "scripts/main.js" },
        text: 'import { Gate } from "./service.js"; Gate.unlock();' },
    ]);
    expect(edges).toEqual([expect.objectContaining({
      localName: "Gate.unlock",
      status: "resolved", targetExport: "Gate",
    })]);
    expect(edges[0]?.targetRegion).toMatch(/^function:Gate\.unlock@/);
  });

  it("keeps same-name static methods distinct by class and authored location", () => {
    const edges = deriveCrossFileCallEdges([
      { path: "scripts/service.js", source: { artifactId: "map", relativePath: "scripts/service.js" },
        text: 'var A = class { static init() {} }; var B = class { static init() {} }; export { A, B };' },
      { path: "scripts/main.js", source: { artifactId: "map", relativePath: "scripts/main.js" },
        text: 'import { A } from "./service.js"; A.init();' },
    ]);
    expect(edges).toEqual([expect.objectContaining({
      localName: "A.init", targetExport: "A", status: "resolved",
    })]);
    expect(edges[0]?.targetRegion).toMatch(/^function:A\.init@/);
  });

  it("does not fabricate a class method for unrelated imported objects or mutated classes", () => {
    const service = (text: string) => ({
      path: "scripts/service.js", source: { artifactId: "map", relativePath: "scripts/service.js" }, text,
    });
    const main = (text: string) => ({
      path: "scripts/main.js", source: { artifactId: "map", relativePath: "scripts/main.js" }, text,
    });
    expect(deriveCrossFileCallEdges([
      service('export const Settings = { load() {} };'),
      main('import { Settings } from "./service.js"; Settings.load();'),
    ])).toEqual([]);
    const mutated = deriveCrossFileCallEdges([
      service('var Service = class { static start() {} }; Service.start = override; export { Service };'),
      main('import { Service } from "./service.js"; Service.start();'),
    ]);
    expect(mutated).toEqual([expect.objectContaining({
      localName: "Service.start", status: "unresolved",
    })]);
    expect(mutated[0]?.targetRegion).toBeUndefined();
  });

  it("keeps a unique imported method when an unrelated static field changes", () => {
    const artifactId = "real-world-source-shape";
    const source = {
      artifactId,
      relativePath: "behavior_packs/BP/scripts/chunks/database.js",
    };
    const service = {
      path: source.relativePath,
      source,
      text: [
        "var DatabaseService = class {",
        "  static init() { return true; }",
        "  static get() { return 1; }",
        "};",
        "DatabaseService._runtimeResetCallbacks = [];",
        "export { DatabaseService };",
      ].join("\n"),
    };
    const main = {
      path: "behavior_packs/BP/scripts/main.js",
      source: { artifactId, relativePath: "behavior_packs/BP/scripts/main.js" },
      text: 'import { DatabaseService } from "./chunks/database.js"; DatabaseService.init();',
    };
    const calls = deriveCrossFileCallEdges([main, service]);
    expect(calls).toEqual([expect.objectContaining({
      status: "resolved",
      localName: "DatabaseService.init",
      targetRegion: expect.stringMatching(/^function:DatabaseService\.init@/),
    })]);
    const parsed = parseScriptFile(service.path, service.text, source);
    expect(parsed.sourceClassMethods).toEqual(expect.arrayContaining([
      expect.objectContaining({
        className: "DatabaseService", methodName: "init", exported: true,
      }),
    ]));
  });

  it("refuses overwritten exported members and rebound imported class bindings", () => {
    const source = {
      artifactId: "same-selected-map", relativePath: "scripts/service.js",
    };
    const main = {
      path: "scripts/main.js",
      source: { artifactId: source.artifactId, relativePath: "scripts/main.js" },
      text: 'import { Service } from "./service.js"; Service.init();',
    };
    const cases = [
      'var Service = class { static init() {} }; Service.init = replacement; export { Service };',
      'var Service = class { static init() {} }; Service = Replacement; export { Service };',
      'var Service = class { static init() {} }; Object.defineProperty(Service, "init", {value: replacement}); export { Service };',
      'var Service = class { static init() {} }; Service[unknownProperty] = replacement; export { Service };',
    ];
    for (const text of cases) {
      const service = { path: source.relativePath, source, text };
      const calls = deriveCrossFileCallEdges([main, service]);
      expect(calls[0]).toMatchObject({
        localName: "Service.init", status: "unresolved",
      });
      expect(calls[0]?.targetRegion).toBeUndefined();
      const parsed = parseScriptFile(service.path, service.text, source);
      expect(parsed.sourceClassMethods?.find(item =>
        item.className === "Service" && item.methodName === "init")?.exported
      ).toBe(false);
    }
  });

  it("does not resolve a same-name shadow or cross-artifact static method", () => {
    const target = {
      path: "scripts/service.js", source: { artifactId: "other-map", relativePath: "scripts/service.js" },
      text: 'export class Gate { static open() {} }',
    };
    const shadow = {
      path: "scripts/main.js", source: { artifactId: "map", relativePath: "scripts/main.js" },
      text: 'import { Gate } from "./service.js"; function use(Gate) { Gate.open(); }',
    };
    expect(deriveCrossFileCallEdges([target, shadow])).toEqual([]);
    const notShadow = { ...shadow,
      text: 'import { Gate } from "./service.js"; Gate.open();' };
    expect(deriveCrossFileCallEdges([target, notShadow])).toEqual([]);
  });

  it("keeps the resolver's target region identical to the parser and CFG", () => {
    const service = {
      path: "behavior_packs/BP/scripts/service.js",
      text: 'var A = class { static init() { world.setDynamicProperty("a", 1); } }; var B = class { static init() { world.setDynamicProperty("b", 1); } }; export { A, B };',
      source: { artifactId: "selected", relativePath: "behavior_packs/BP/scripts/service.js" },
    };
    const main = {
      path: "behavior_packs/BP/scripts/main.js",
      text: 'import { B } from "./service.js"; B.init();',
      source: { artifactId: "selected", relativePath: "behavior_packs/BP/scripts/main.js" },
    };
    const edges = deriveCrossFileCallEdges([main, service]);
    const parsed = parseScriptFile(service.path, service.text, service.source);
    const methodRegions = parsed.controlFlowRegions?.map(item => item.region) ?? [];
    expect(edges[0]?.status).toBe("resolved");
    expect(edges[0]?.targetRegion).toMatch(/^function:B\.init@/);
    expect(methodRegions).toContain(edges[0]!.targetRegion);
    expect(methodRegions).toEqual(expect.arrayContaining([
      expect.stringMatching(/^function:A\.init@/),
      expect.stringMatching(/^function:B\.init@/),
    ]));
  });

  it("refuses a class with duplicate identically named members", () => {
    const edges = deriveCrossFileCallEdges([{
      path: "scripts/service.js",
      text: 'var Service = class { static start() {} static start() {} }; export { Service };',
      source: { artifactId: "map", relativePath: "scripts/service.js" },
    }, {
      path: "scripts/main.js",
      text: 'import { Service } from "./service.js"; Service.start();',
      source: { artifactId: "map", relativePath: "scripts/main.js" },
    }]);
    expect(edges[0]?.status).toBe("unresolved");
    expect(edges[0]?.targetRegion).toBeUndefined();
  });

});

describe("exact ESM argument-to-parameter reference evidence", () => {
  const file = (name: string, text: string) => ({
    path: "behavior_packs/example/scripts/" + name, text,
    source: { artifactId: "selected-world",
      relativePath: "behavior_packs/example/scripts/" + name },
  });
  it("binds direct immutable parameters by position even with import aliases", () => {
    const main = file("main.js", [
      'import { finish as close } from "./cleanup.js";',
      "function join(arena, player) { close(arena, player); }",
    ].join("\n"));
    const target = file("cleanup.js",
      "export function finish(ctx, member) { return ctx; }");
    const edges = deriveCrossFileCallEdges([main, target]);
    expect(edges[0]).toMatchObject({
      status: "resolved", targetExport: "finish",
      argumentParameterBindings: [
        expect.objectContaining({ index: 0, argumentName: "arena", parameterName: "ctx" }),
        expect.objectContaining({ index: 1, argumentName: "player", parameterName: "member" }),
      ],
    });
    const bindings = edges[0]?.argumentParameterBindings ?? [];
    expect(bindings).toHaveLength(2);
    expect(bindings.every(binding =>
      binding.argumentSource.relativePath === main.path &&
      binding.parameterSource.relativePath === target.path &&
      binding.argumentSource.range !== undefined &&
      binding.parameterSource.range !== undefined)).toBe(true);
  });

  it("does not infer identity through local aliases, mutations or default parameters", () => {
    const target = file("cleanup.js",
      "export function finish(ctx, member = null) { ctx = member; }");
    const main = file("main.js", [
      'import { finish } from "./cleanup.js";',
      "function join(arena, player) { const other = arena; finish(other, player); }",
    ].join("\n"));
    const edge = deriveCrossFileCallEdges([main, target])[0];
    expect(edge).toMatchObject({ status: "resolved" });
    expect(edge?.argumentParameterBindings).toBeUndefined();
  });

  it("rejects a same-named local shadow of a caller parameter", () => {
    const target = file("cleanup.js", "export function finish(ctx) { return ctx; }");
    const main = file("main.js", [
      'import { finish } from "./cleanup.js";',
      "function join(arena) { { const arena = { id: 4 }; finish(arena); } }",
    ].join("\n"));
    const edge = deriveCrossFileCallEdges([main, target])[0];
    expect(edge).toMatchObject({ status: "resolved" });
    expect(edge?.argumentParameterBindings).toBeUndefined();
  });

  it("rejects parameter writes through destructuring or loop assignments", () => {
    const target = file("cleanup.js", "export function finish(ctx) { return ctx; }");
    for (const mutation of ["({ arena } = other);", "for (arena of arenas) {}"]) {
      const main = file("main.js", [
        'import { finish } from "./cleanup.js";',
        "function join(arena, other, arenas) {",
        "  " + mutation,
        "  finish(arena);",
        "}",
      ].join("\n"));
      const edge = deriveCrossFileCallEdges([main, target])[0];
      expect(edge?.argumentParameterBindings).toBeUndefined();
    }
  });
});


describe("bounded immutable const alias forwarding into ESM calls", () => {
  const source = (name: string, lines: readonly string[]) => {
    const path = "behavior_packs/alias/scripts/" + name;
    return { path, text: lines.join("\n"),
      source: { artifactId: "selected-alias", relativePath: path } };
  };
  const target = source("helper.js", [
    "export function release(ctx, member) { return ctx; }",
  ]);

  it("resolves preceding immutable identifier alias chains to their original parameter", () => {
    const main = source("main.js", [
      'import { release } from "./helper.js";',
      "function join(arena, player) {",
      "  const first = arena;",
      "  const second = first;",
      "  release(second, player);",
      "}",
    ]);
    const call = deriveCrossFileCallEdges([main, target])[0];
    expect(call).toMatchObject({ status: "resolved",
      argumentParameterBindings: [
        expect.objectContaining({
          argumentName: "arena", parameterName: "ctx",
          viaConstAliases: [
            expect.objectContaining({ name: "first" }),
            expect.objectContaining({ name: "second" }),
          ],
        }),
        expect.objectContaining({ argumentName: "player", parameterName: "member" }),
      ],
    });
    expect(call?.argumentParameterBindings?.[0]?.viaConstAliases?.every(alias =>
      alias.source.relativePath === main.path &&
      alias.source.range?.lineStart !== undefined)).toBe(true);
  });

  it("refuses let aliases, parameter writes, temporal inversions and computed objects", () => {
    const cases = [
      ["let chosen = arena;", "release(chosen, player);"],
      ["const chosen = arena;", "arena = otherArena;", "release(chosen, player);"],
      ["release(chosen, player);", "const chosen = arena;"],
      ["const chosen = arena;", "release(chosen.id, player);"],
    ];
    for (const statements of cases) {
      const main = source("main.js", [
        'import { release } from "./helper.js";',
        "function join(arena, player, otherArena) {",
        ...statements.map(statement => "  " + statement),
        "}",
      ]);
      const call = deriveCrossFileCallEdges([main, target])[0];
      expect(call).toMatchObject({ status: "resolved" });
      expect(call?.argumentParameterBindings?.some(binding =>
        binding.parameterName === "ctx")).toBe(false);
    }
  });

  it("rejects a nested shadow and cyclic declaration without inventing identity", () => {
    const cases = [
      [
        "const chosen = arena;",
        "if (flag) { const chosen = otherArena; release(chosen, player); }",
      ],
      [
        "const chosen = chosen;",
        "release(chosen, player);",
      ],
    ];
    for (const statements of cases) {
      const main = source("main.js", [
        'import { release } from "./helper.js";',
        "function join(arena, player, otherArena, flag) {",
        ...statements.map(statement => "  " + statement),
        "}",
      ]);
      const call = deriveCrossFileCallEdges([main, target])[0];
      expect(call?.argumentParameterBindings?.some(binding =>
        binding.parameterName === "ctx")).toBe(false);
    }
  });
});
