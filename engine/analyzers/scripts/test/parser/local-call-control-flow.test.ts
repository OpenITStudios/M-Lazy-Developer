import { describe, expect, it } from "vitest";
import {
  parseScriptFile,
} from "../../src/parser/parse.js";

describe("local function call control flow", () => {
  it("distinguishes unconditional and conditional local calls", () => {
    const parsed = parseScriptFile(
      "scripts/main.ts",
      `
        function cleanupArena() {}
        function notifyPlayers() {}
        function finishGame(shouldNotify) {
          cleanupArena();
          if (shouldNotify) {
            notifyPlayers();
          }
        }
      `,
      {
        artifactId: "artifact:test",
        relativePath: "scripts/main.ts",
      },
    );

    const byTarget = new Map(
      parsed.localFunctionCalls.map((call) => [
        call.targetName,
        call.controlFlow,
      ]),
    );

    expect(byTarget.get("cleanupArena")).toBe(
      "unconditional",
    );
    expect(byTarget.get("notifyPlayers")).toBe(
      "conditional",
    );
  });

  it("carries source-ordered necessary guards from direct early exits", () => {
    const source = { artifactId: "artifact:flow", relativePath: "scripts/wave.ts" };
    const parsed = parseScriptFile("wave", [
      'let phase = "idle";',
      'function spawnWave() {}',
      'function run(skip, cancelled) {',
      '  if (skip) return;',
      '  if (cancelled) { throw new Error("cancelled"); }',
      '  phase = "active";',
      '  spawnWave();',
      '  return { action: "running" };',
      '}',
      'run(false, false);',
    ].join("\n"), source);
    const expected = [["skip", "false"], ["cancelled", "false"]];
    const call = parsed.localFunctionCalls.find(x => x.targetName === "spawnWave");
    expect(call?.controlFlow).toBe("conditional");
    expect(call?.lexicalGuards).toEqual([]);
    expect(call?.precedenceGuards?.map(g => [g.conditionText, g.branch]))
      .toEqual(expected);
    expect(call?.precedenceGuards?.map(g => g.source.range?.lineStart))
      .toEqual([4,5]);
    expect(parsed.stateMutations?.find(x => x.value.kind === "literal" &&
      x.value.literal === "active")?.precedenceGuards
      ?.map(g => [g.conditionText, g.branch])).toEqual(expected);
    expect(parsed.returnOutcomes?.find(x => x.value === "running")
      ?.precedenceGuards?.map(g => [g.conditionText, g.branch]))
      .toEqual(expected);
  });

  it("keeps camelCase state mutations and rejects incidental state substrings", () => {
    const parsed = parseScriptFile(
      "main",
      [
        'let residencyState = "RESIDENT";',
        'let roundStatus = "OPEN";',
        'let gamePhase = "WAITING";',
        'let statement = "none";',
        'let estate = "private";',
        'world.afterEvents.entityRemove.subscribe(() => {',
        '  residencyState = "DEAD";',
        '  roundStatus = "CLOSED";',
        '  gamePhase = "ENDED";',
        '  statement = "DEAD";',
        '  estate = "DEAD";',
        '});',
      ].join("\n"),
      { artifactId: "fixture", relativePath: "scripts/main.ts" },
    );
    const event = parsed.events.find((item) => item.event === "entityRemove");
    expect(event?.callbackRegion).toBeDefined();
    const writes = parsed.stateMutations?.filter(
      (item) => item.executionRegion === event?.callbackRegion,
    ) ?? [];
    expect(writes.map((item) => item.targetName).sort()).toEqual([
      "gamePhase", "residencyState", "roundStatus",
    ]);
    expect(writes.every((item) => item.value.kind === "literal")).toBe(true);
  });

  it("respects else-only exits and refuses nested uncertain exits", () => {
    const source = { artifactId: "artifact:flow", relativePath: "scripts/branch.ts" };
    const parsed = parseScriptFile("branch", [
      'function spawnWave() {}',
      'function play(ready) {',
      '  if (ready) {} else { return; }',
      '  spawnWave();',
      '}',
      'function unclear(skip, nested) {',
      '  if (skip) { if (nested) return; }',
      '  spawnWave();',
      '}',
      'function both(ready) {',
      '  if (ready) return; else throw new Error("stop");',
      '  spawnWave();',
      '}',
    ].join("\n"), source);
    const plays = parsed.localFunctionCalls.filter(x => x.targetName === "spawnWave");
    expect(plays).toHaveLength(3);
    expect(plays[0]?.precedenceGuards?.map(g => [g.conditionText, g.branch]))
      .toEqual([["ready", "true"]]);
    expect(plays[1]?.precedenceGuards ?? []).toEqual([]);
    expect(plays[1]?.controlFlow).toBe("conditional");
    expect(plays[2]?.precedenceGuards ?? []).toEqual([]);
  });

  it("treats calls after a possible early return as conditional", () => {
    const parsed = parseScriptFile(
      "scripts/main.ts",
      `
        function cleanupArena() {}
        function finishGame(skipCleanup) {
          if (skipCleanup) return;
          cleanupArena();
        }
      `,
      {
        artifactId: "artifact:test",
        relativePath: "scripts/main.ts",
      },
    );

    expect(
      parsed.localFunctionCalls.find(
        (call) => call.targetName === "cleanupArena",
      )?.controlFlow,
    ).toBe("conditional");
  });

});


describe("source-only local helper argument/formal forwarding", () => {
  const source = { artifactId: "local-parameter-source", relativePath: "scripts/main.js" };

  it("matches a local helper through a stable const alias chain", () => {
    const parsed = parseScriptFile("main", [
      "function cleanup(ctx, member) { ctx.state = member; }",
      "function join(arena, player) {",
      "  const first = arena;",
      "  const second = first;",
      "  cleanup(second, player);",
      "}",
    ].join("\n"), source);
    const call = parsed.localFunctionCalls.find(item =>
      item.callerRegion === "function:join" && item.targetName === "cleanup");
    expect(call?.argumentParameterBindings).toEqual([
      expect.objectContaining({
        argumentName: "arena", parameterName: "ctx",
        viaConstAliases: [
          expect.objectContaining({ name: "first" }),
          expect.objectContaining({ name: "second" }),
        ],
      }),
      expect.objectContaining({ argumentName: "player", parameterName: "member" }),
    ]);
    expect(call?.argumentParameterBindings?.every(item =>
      item.argumentSource.relativePath === source.relativePath &&
      item.parameterSource.relativePath === source.relativePath)).toBe(true);
  });

  it("rejects a shadowed local function and mutated caller parameter", () => {
    const parsed = parseScriptFile("main", [
      "function cleanup(ctx) { return ctx; }",
      "function join(arena) {",
      "  { const cleanup = (ctx) => ctx; cleanup(arena); }",
      "  arena = { id: 2 };",
      "  cleanup(arena);",
      "}",
    ].join("\n"), source);
    const calls = parsed.localFunctionCalls.filter(item =>
      item.targetName === "cleanup" && item.callerRegion === "function:join");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.argumentParameterBindings).toBeUndefined();
  });

  it("refuses ambiguous local declarations with the same executable name", () => {
    const parsed = parseScriptFile("main", [
      "function cleanup(ctx) {}",
      "function cleanup(ctx) {}",
      "function join(arena) { cleanup(arena); }",
    ].join("\n"), source);
    expect(parsed.localFunctionCalls.filter(item =>
      item.targetName === "cleanup")).toHaveLength(0);
  });
});


describe("source-unique bundled static class call recovery", () => {
  const source = { artifactId: "selected-world", relativePath: "behavior_packs/BP/scripts/chunks/game.js" };

  it("joins packaged Service.method() to its exact method region across guarded delayed gameplay", () => {
    const parsed = parseScriptFile("game", [
      "var CompositeSessionService = class {",
      "  static isCurrentRun(arenaId, runId) { return true; }",
      "  static get(arenaId) { return { status: 'active' }; }",
      "  static save(arenaId, session) { return session; }",
      "};",
      "var CompositeGameRuntime = class {",
      "  static advance(arenaId, runId) {",
      "    system.runTimeout(() => {",
      "      if (!CompositeSessionService.isCurrentRun(arenaId, runId)) return;",
      "      const session = CompositeSessionService.get(arenaId);",
      "      if (session.status === 'active') CompositeSessionService.save(arenaId, session);",
      "    }, 5);",
      "  }",
      "};",
    ].join("\n"), source);
    const edges = parsed.localFunctionCalls.filter(call =>
      call.targetName.startsWith("CompositeSessionService."));
    expect(edges.map(edge => edge.targetName).sort()).toEqual([
      "CompositeSessionService.get",
      "CompositeSessionService.isCurrentRun",
      "CompositeSessionService.save",
    ]);
    expect(edges.every(edge =>
      edge.callerRegion.startsWith("callback@") &&
      edge.targetRegion.startsWith("function:CompositeSessionService.") &&
      edge.targetRegion.includes("@") &&
      edge.source.relativePath === source.relativePath)).toBe(true);
    const getCall = edges.find(edge =>
      edge.targetName === "CompositeSessionService.get");
    expect(getCall?.controlFlow).toBe("conditional");
    expect(getCall?.targetSource).toMatchObject({
      artifactId: source.artifactId,
      relativePath: source.relativePath,
      range: { lineStart: 3 },
    });
    expect(getCall?.source.range?.lineStart).toBeGreaterThan(
      getCall!.targetSource!.range!.lineStart!,
    );
    expect(edges.every(edge =>
      edge.targetSource?.artifactId === source.artifactId &&
      edge.targetSource.relativePath === source.relativePath)).toBe(true);
    expect(edges.find(edge => edge.targetName === "CompositeSessionService.save")
      ?.lexicalGuards.length).toBeGreaterThan(0);
  });

  it("retains exact argument/formal forwarding through a stable local static method", () => {
    const parsed = parseScriptFile("state", [
      "class SessionStore { static save(arenaId, value) { return value; } }",
      "function commit(arena, state) { SessionStore.save(arena, state); }",
    ].join("\n"), source);
    const edge = parsed.localFunctionCalls.find(x =>
      x.targetName === "SessionStore.save");
    expect(edge?.argumentParameterBindings?.map(x => [
      x.argumentName, x.parameterName,
    ])).toEqual([["arena", "arenaId"], ["state", "value"]]);
  });

  it("rejects mutable class bindings, overwritten methods, duplicate methods, shadows, and instance methods", () => {
    const parsed = parseScriptFile("unsafe", [
      "var Rebound = class { static get() {} };",
      "Rebound = class { static get() {} };",
      "Rebound.get();",
      "var Overwritten = class { static get() {} };",
      "Overwritten.get = () => 2;",
      "Overwritten.get();",
      "var Duplicated = class { static get() {} static get() {} };",
      "Duplicated.get();",
      "var Store = class { static get() {} };",
      "function read(Store) { Store.get(); }",
      "Store.get();",
      "class InstanceOnly { get() {} }",
      "InstanceOnly.get();",
    ].join("\n"), source);
    expect(parsed.localFunctionCalls.filter(x =>
      /^(Rebound|Overwritten|Duplicated|InstanceOnly)\.get$/.test(x.targetName)))
      .toHaveLength(0);
    const safe = parsed.localFunctionCalls.filter(x =>
      x.targetName === "Store.get");
    expect(safe).toHaveLength(1);
    expect(safe[0]?.callerRegion).toBe("module");
  });
});
