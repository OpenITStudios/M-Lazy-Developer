import { describe, expect, it } from "vitest";
import { parseMcFunction } from "../../../../analyzers/functions/src/index.js";
import { parseScriptFile, deriveCrossFileCallEdges } from "../../../../analyzers/scripts/src/index.js";
import {
  semanticIrSummary,
  semanticIrExecutionTraces,
} from "../../../semantic-ir/src/index.js";
import {
  buildInspectionSemanticIr,
} from "../../src/diagnosis/semantic-ir-stage.js";
import { developerPracticeSignalsFromSemanticIr } from "../../src/workflow/resource-context.js";

describe("inspection semantic IR", () => {
  it("links event, deferred callback, state operations and mcfunction calls without guessing unresolved targets", () => {
    const script = parseScriptFile(
      "main",
      [
        'import { world, system } from "@minecraft/server";',
        'function start() {',
        '  world.setDynamicProperty("round", 1);',
        '  system.run(() => {',
        '    world.getDynamicProperty("round");',
        '    world.runCommand("function arena/start");',
        '  });',
        '}',
        'world.afterEvents.playerSpawn.subscribe(() => { start(); });',
      ].join("\n"),
      {
        artifactId: "a",
        relativePath: "scripts/main.js",
      },
    );
    const fn = parseMcFunction(
      "arena/start",
      [
        "scoreboard players add @s score 1",
        "tag @s add ready",
        "function missing/next",
      ].join("\n"),
      {
        artifactId: "a",
        relativePath: "functions/arena/start.mcfunction",
      },
    );

    const ir = buildInspectionSemanticIr({
      parsedScripts: [{ parsed: script }],
      parsedFunctions: [{ parsed: fn }],
      stateAuthorityContracts: [{
        id: "arena-ready",
        authority: { kind: "scoreboard", key: "score" },
        mirrors: [{ kind: "tag", key: "ready" }],
        scope: "player",
      }],
    });

    const summary = semanticIrSummary(ir);
    expect(summary.eventDispatches).toBe(1);
    expect(summary.deferredEdges).toBe(1);
    expect(summary.authorityContracts).toBe(1);
    expect(summary.stateReads).toBeGreaterThan(0);
    expect(summary.stateWrites).toBeGreaterThan(1);
    expect(summary.unresolvedExecutionTargets).toBe(1);

    const deferred = ir.temporal.relations.find(
      (item) => item.kind === "deferred",
    );
    expect(deferred?.guardEvidence).toBe("unresolved");
  });

  it("preserves parsed conditional calls and authored state writes in the technical execution trace", () => {
    const source = { artifactId: "map:sample", relativePath: "scripts/round.js" };
    const parsed = parseScriptFile("round", [
      'let phase = "idle";',
      'function spawnWave() {}',
      'function startWave(ready) {',
      '  if (ready) spawnWave();',
      '  phase = "active";',
      '}',
      'startWave(true);',
    ].join("\n"), source);
    const ir = buildInspectionSemanticIr({
      parsedFunctions: [], parsedScripts: [{ parsed }],
    });
    const call = ir.execution.edges.find(edge => edge.targetLabel === "spawnWave");
    expect(call?.kind).toBe("synchronous-call");
    expect(call?.controlFlow).toBe("conditional");
    const written = ir.state.operations.filter(item =>
      item.operation === "write" &&
      ir.state.surfaces.some(surface =>
        surface.id === item.surfaceId &&
        surface.ref.kind === "script-memory" &&
        surface.ref.key === "scripts/round.js::phase")
    );
    expect(written.some(item =>
      item.writtenValue?.kind === "literal" &&
      item.writtenValue.value === "active")).toBe(true);
    const trace = semanticIrExecutionTraces(ir);
    expect(trace.traces.some(item =>
      item.conditionalExecutionEdgeIds.includes(call!.id) &&
      written.every(write => item.stateWriteOperationIds.includes(write.id)))).toBe(true);
  });


  it("propagates true/false and nested authored guards through Semantic IR and navigation traces", () => {
    const source = { artifactId: "map:guards", relativePath: "scripts/waves.js" };
    const parsed = parseScriptFile("waves", [
      'let phase = "idle";',
      'function spawnWave() {}',
      'function skipWave() {}',
      'function start(ready, wave) {',
      '  if (ready) {',
      '    if (wave > 0) { phase = "active"; spawnWave(); }',
      '  } else { phase = "skipped"; skipWave(); }',
      '  ready && spawnWave();',
      '}',
      'start(true, 1);',
    ].join("\n"), source);
    const ir = buildInspectionSemanticIr({
      parsedFunctions: [], parsedScripts: [{ parsed }],
    });
    const spawnEdges = ir.execution.edges.filter(edge => edge.targetLabel === "spawnWave");
    expect(spawnEdges).toHaveLength(2);
    const nested = spawnEdges.find(edge => edge.lexicalGuards?.length === 2);
    expect(nested?.lexicalGuards?.map(g => [g.expression, g.branch])).toEqual([
      ["ready", "true"], ["wave > 0", "true"],
    ]);
    expect(nested?.lexicalGuards?.every(g =>
      g.source.artifactId === source.artifactId &&
      g.source.relativePath === source.relativePath &&
      g.source.range?.lineStart !== undefined)).toBe(true);
    const shortCircuit = spawnEdges.find(edge => edge.lexicalGuards?.length === 1);
    expect(shortCircuit?.controlFlow).toBe("conditional");
    expect(shortCircuit?.lexicalGuards?.[0]?.expression).toBe("ready");
    const skip = ir.execution.edges.find(edge => edge.targetLabel === "skipWave");
    expect(skip?.lexicalGuards?.map(g => g.branch)).toEqual(["false"]);
    const writes = ir.state.operations.filter(op => op.writtenValue);
    expect(writes.find(op => op.writtenValue?.kind === "literal" &&
      op.writtenValue.value === "active")?.lexicalGuards?.map(g =>
      [g.expression, g.branch])).toEqual([
        ["ready", "true"], ["wave > 0", "true"],
      ]);
    expect(writes.find(op => op.writtenValue?.kind === "literal" &&
      op.writtenValue.value === "skipped")?.lexicalGuards?.map(g =>
      [g.expression, g.branch])).toEqual([["ready", "false"]]);
    const traces = semanticIrExecutionTraces(ir).traces;
    expect(traces.some(trace =>
      trace.guardedExecutionEdges.some(entry => entry.edgeId === nested?.id) &&
      trace.guardedStateWrites.some(entry => entry.guards.length === 2))).toBe(true);
  });

  it("does not infer lexical guard predicates from preceding return statements", () => {
    const source = { artifactId: "map:guards", relativePath: "scripts/exit.js" };
    const parsed = parseScriptFile("exit", [
      'function spawnWave() {}',
      'function start(ready) {',
      '  if (!ready) return;',
      '  spawnWave();',
      '}',
      'start(true);',
    ].join("\n"), source);
    const ir = buildInspectionSemanticIr({
      parsedFunctions: [], parsedScripts: [{ parsed }],
    });
    const call = ir.execution.edges.find(edge => edge.targetLabel === "spawnWave");
    expect(call?.controlFlow).toBe("conditional");
    expect(call?.lexicalGuards).toBeUndefined();
    expect(call?.precedenceGuards?.map(g => [g.expression, g.branch]))
      .toEqual([["!ready", "false"]]);
    expect(semanticIrExecutionTraces(ir).traces.some(trace =>
      trace.conditionalExecutionEdgeIds.includes(call!.id) &&
      !trace.guardedExecutionEdges.some(item => item.edgeId === call!.id) &&
      trace.precedenceGuardedExecutionEdges.some(item =>
        item.edgeId === call!.id))).toBe(true);
  });

  it("reconciles preceding exits and lexical returns under exact source branch points", () => {
    const source = { artifactId: "world:precedence", relativePath: "scripts/wave.ts" };
    const parsed = parseScriptFile("wave", [
      'let phase = "idle";',
      'function spawnWave() {}',
      'function run(skip) {',
      '  if (skip) return { action: "skipped" };',
      '  phase = "active";',
      '  spawnWave();',
      '  return { action: "started" };',
      '}',
      'run(false);',
    ].join("\n"), source);
    const ir = buildInspectionSemanticIr({
      parsedFunctions: [], parsedScripts: [{ parsed }],
    });
    const call = ir.execution.edges.find(edge => edge.targetLabel === "spawnWave");
    const active = ir.state.operations.find(op =>
      op.writtenValue?.kind === "literal" && op.writtenValue.value === "active");
    const skipped = ir.execution.outcomes?.find(x => x.value === "skipped");
    const started = ir.execution.outcomes?.find(x => x.value === "started");
    expect(call?.precedenceGuards?.map(g => [g.expression, g.branch]))
      .toEqual([["skip", "false"]]);
    expect(active?.precedenceGuards?.map(g => [g.expression, g.branch]))
      .toEqual([["skip", "false"]]);
    expect(started?.precedenceGuards?.map(g => [g.expression, g.branch]))
      .toEqual([["skip", "false"]]);
    expect(skipped?.lexicalGuards?.map(g => [g.expression, g.branch]))
      .toEqual([["skip", "true"]]);
    const trace = semanticIrExecutionTraces(ir).traces.find(x =>
      x.branchPoints.some(p => p.expression === "skip"));
    expect(trace).toBeDefined();
    const point = trace!.branchPoints.find(p => p.expression === "skip")!;
    const trueArm = point.branches.find(x => x.branch === "true")!;
    const falseArm = point.branches.find(x => x.branch === "false")!;
    expect(trueArm.returnOutcomeIds).toContain(skipped!.id);
    expect(trueArm.returnOutcomeIds).not.toContain(started!.id);
    expect(trueArm.precedenceEvidenceIds).toEqual([]);
    expect(falseArm.executionEdgeIds).toContain(call!.id);
    expect(falseArm.stateWriteOperationIds).toContain(active!.id);
    expect(falseArm.returnOutcomeIds).toContain(started!.id);
    expect(falseArm.precedenceEvidenceIds).toEqual([
      active!.id, call!.id, started!.id,
    ].sort());
    expect(trace!.precedenceGuardedReturnOutcomes.some(x =>
      x.outcomeId === started!.id)).toBe(true);
    // Both results remain static alternatives, not simultaneous outcomes.
    expect(trace!.returnOutcomeIds).toEqual([skipped!.id, started!.id].sort());
  });

  it("retains alternative source returns and resource releases without inferring a successful reset", () => {
    const source = {
      artifactId: "map:game",
      relativePath: "behavior_packs/test/scripts/game.js",
    };
    const parsed = parseScriptFile("game", [
      'import { world } from "@minecraft/server";',
      'function finish(ready, player) {',
      '  if (ready) {',
      '    player.removeTag("playing");',
      '    return { status: "done" };',
      '  } else {',
      '    return { status: "blocked" };',
      '  }',
      '}',
      'world.afterEvents.playerSpawn.subscribe((event) => finish(true, event.player));',
    ].join("\n"), source);
    const ir = buildInspectionSemanticIr({
      parsedFunctions: [], parsedScripts: [{ parsed }],
    });
    const outcomes = ir.execution.outcomes ?? [];
    expect(outcomes.map(outcome => outcome.value).sort()).toEqual(["blocked","done"]);
    const done = outcomes.find(outcome => outcome.value === "done");
    const blocked = outcomes.find(outcome => outcome.value === "blocked");
    expect(done?.lexicalGuards?.map(g => [g.expression,g.branch]))
      .toEqual([["ready","true"]]);
    expect(blocked?.lexicalGuards?.map(g => [g.expression,g.branch]))
      .toEqual([["ready","false"]]);
    const release = (ir.state.resourceActions ?? []).find(action =>
      action.surface === "tag" && action.action === "release");
    expect(release?.precision).toBe("exact");
    expect(release?.source.relativePath).toBe(source.relativePath);
    expect(release?.executionRegionId).toBe(done?.executionRegionId);
    const traces = semanticIrExecutionTraces(ir).traces;
    expect(traces.some(trace => done && blocked && release &&
      trace.returnOutcomeIds.includes(done.id) &&
      trace.returnOutcomeIds.includes(blocked.id) &&
      trace.resourceReleaseActionIds.includes(release.id))).toBe(true);
    expect(semanticIrSummary(ir).authoredReturnOutcomes).toBe(2);
    expect(semanticIrSummary(ir).authoredResourceReleases).toBeGreaterThanOrEqual(1);
  });

  it("retains exact cross-file state-parameter handoff without claiming runtime identity", () => {
    const prefix = "behavior_packs/demo/scripts/";
    const a = { artifactId: "selected", relativePath: prefix + "main.js" };
    const b = { artifactId: "selected", relativePath: prefix + "cleanup.js" };
    const mainText = [
      'import { finish as close } from "./cleanup.js";',
      "function join(arena, member) {",
      "  const copy = arena;",
      "  close(copy, member);",
      "}",
    ].join("\n");
    const targetText = "export function finish(ctx, player) { return ctx; }";
    const main = parseScriptFile("main", mainText, a);
    const target = parseScriptFile("cleanup", targetText, b);
    const calls = deriveCrossFileCallEdges([
      { path: a.relativePath, source: a, text: mainText },
      { path: b.relativePath, source: b, text: targetText },
    ]);
    const ir = buildInspectionSemanticIr({
      parsedFunctions: [], parsedScripts: [{ parsed: main }, { parsed: target }],
      crossFileCallEdges: calls,
    });
    const edge = ir.execution.edges.find(e =>
      e.kind === "synchronous-call" && e.targetLabel === "close");
    expect(edge?.resolution).toBe("resolved");
    expect(edge?.argumentParameterBindings).toEqual([
      expect.objectContaining({
        index: 0, argumentName: "arena", parameterName: "ctx",
        viaConstAliases: [expect.objectContaining({ name: "copy" })],
      }),
      expect.objectContaining({
        index: 1, argumentName: "member", parameterName: "player",
      }),
    ]);
    expect(edge?.argumentParameterBindings?.every(binding =>
      binding.argumentSource.relativePath === a.relativePath &&
      binding.parameterSource.relativePath === b.relativePath
    )).toBe(true);
    const unresolved = buildInspectionSemanticIr({
      parsedFunctions: [], parsedScripts: [{ parsed: main }],
      crossFileCallEdges: calls,
    });
    expect(unresolved.execution.edges.find(e =>
      e.targetLabel === "close")?.argumentParameterBindings).toBeUndefined();
  });

  it("carries authored tick roots into periodic Semantic IR without claiming missing targets", () => {
    const fn = parseMcFunction("start", "say ready", {
      artifactId: "a",
      relativePath: "behavior_packs/a/functions/start.mcfunction",
    });
    const ir = buildInspectionSemanticIr({
      parsedFunctions: [{ parsed: fn }],
      parsedScripts: [],
      tickFunctionRegistrations: [
        {
          source: { artifactId: "a", relativePath: "behavior_packs/a/functions/tick.json" },
          functions: ["start"],
        },
        {
          source: { artifactId: "a", relativePath: "behavior_packs/b/functions/tick.json" },
          functions: ["missing"],
        },
      ],
    });
    const roots = ir.execution.regions.filter((region) => region.id.startsWith("exec:tick:"));
    expect(roots).toHaveLength(2);
    const periodic = ir.execution.edges.filter((edge) => edge.kind === "periodic");
    expect(periodic).toHaveLength(2);
    expect(periodic.map((edge) => [edge.targetLabel, edge.resolution]).sort()).toEqual([
      ["missing", "unresolved"], ["start", "resolved"],
    ]);
    expect(ir.temporal.relations.filter((relation) => relation.kind === "periodic")).toHaveLength(2);
  });

  it("preserves repeated tick registrations as distinct periodic edges", () => {
    const fn = parseMcFunction("start", "say ready", {
      artifactId: "a", relativePath: "behavior_packs/a/functions/start.mcfunction",
    });
    const ir = buildInspectionSemanticIr({
      parsedFunctions: [{ parsed: fn }], parsedScripts: [],
      tickFunctionRegistrations: [{
        source: { artifactId: "a", relativePath: "behavior_packs/a/functions/tick.json" },
        functions: ["start", "start"],
      }],
    });
    const periodic = ir.execution.edges.filter(edge => edge.kind === "periodic");
    expect(periodic).toHaveLength(2);
    expect(new Set(periodic.map(edge => edge.id)).size).toBe(2);
    expect(ir.temporal.relations.filter(item => item.kind === "periodic")).toHaveLength(2);
  });

  it("keeps duplicate cross-pack functions separate and does not resolve an ambiguous call", () => {
    const source = (pack: string) => ({ artifactId: "a", relativePath: "behavior_packs/" + pack + "/functions/start.mcfunction" });
    const a = parseMcFunction("start", "function start", source("a"));
    const b = parseMcFunction("start", "say ready", source("b"));
    const ir = buildInspectionSemanticIr({
      parsedFunctions: [{ parsed: a }, { parsed: b }], parsedScripts: [],
      tickFunctionRegistrations: [{ source: { artifactId: "a", relativePath: "behavior_packs/a/functions/tick.json" }, functions: ["start"] }],
    });
    const functions = ir.execution.regions.filter(region => region.kind === "mcfunction");
    expect(functions).toHaveLength(2);
    expect(new Set(functions.map(region => region.id)).size).toBe(2);
    expect(ir.execution.edges.filter(edge => edge.targetLabel === "start").every(edge => edge.resolution === "unresolved")).toBe(true);
  });

  it("separates same-name script execution regions and subscriptions across packs", () => {
    const scriptText = [
      'import { world } from "@minecraft/server";',
      'world.afterEvents.playerSpawn.subscribe(() => { world.setDynamicProperty("join", 1); });',
    ].join("\n");
    const first = parseScriptFile("scripts/main", scriptText, {
      artifactId: "a", relativePath: "behavior_packs/a/scripts/main.js",
    });
    const second = parseScriptFile("scripts/main", scriptText, {
      artifactId: "a", relativePath: "behavior_packs/b/scripts/main.js",
    });
    const ir = buildInspectionSemanticIr({
      parsedFunctions: [], parsedScripts: [{ parsed: first }, { parsed: second }],
    });
    expect(ir.execution.regions.filter(region => region.kind === "script-module")).toHaveLength(2);
    expect(ir.execution.regions.filter(region => region.kind === "event-source")).toHaveLength(2);
    expect(ir.execution.edges.filter(edge => edge.kind === "event-dispatch")).toHaveLength(2);
  });

  it("preserves distinct subscriptions of the same event within one script", () => {
    const script = parseScriptFile("scripts/main", [
      'import { world } from "@minecraft/server";',
      'world.afterEvents.playerSpawn.subscribe(() => { world.setDynamicProperty("first", 1); });',
      'world.afterEvents.playerSpawn.subscribe(() => { world.setDynamicProperty("second", 1); });',
    ].join("\n"), {
      artifactId: "a", relativePath: "behavior_packs/a/scripts/main.js",
    });
    const ir = buildInspectionSemanticIr({ parsedFunctions: [], parsedScripts: [{ parsed: script }] });
    const eventRegions = ir.execution.regions.filter(region =>
      region.kind === "event-source" && region.label === "world.afterEvents.playerSpawn");
    expect(eventRegions).toHaveLength(2);
    expect(new Set(eventRegions.map(region => region.id)).size).toBe(2);
    expect(ir.execution.edges.filter(edge => edge.kind === "event-dispatch")).toHaveLength(2);
  });

  it("preserves explicit generation guards on deferred work", () => {
    const script = parseScriptFile(
      "guarded",
      [
        'import { system } from "@minecraft/server";',
        'const generation = 1;',
        'system.run(() => {',
        '  if (generation !== currentGeneration) return;',
        '});',
      ].join("\n"),
      {
        artifactId: "a",
        relativePath: "scripts/guarded.js",
      },
    );

    const ir = buildInspectionSemanticIr({
      parsedScripts: [{ parsed: script }],
      parsedFunctions: [],
    });

    expect(ir.temporal.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "deferred",
          guardEvidence: "explicit-generation-check",
        }),
      ]),
    );
  });

  it("keeps typed forms, HUD, entity lifecycle and feedback distinct from lookalike methods", () => {
    const artifactId = "selected:developer-reference";
    const relativePath = "behavior_packs/demo/scripts/hub.ts";
    const parsed = parseScriptFile("hub", [
      'import { world, system } from "@minecraft/server";',
      'import { ActionFormData as Menu, uiManager as manager } from "@minecraft/server-ui";',
      'function interact(player: Player, target: Entity) {',
      '  new Menu().title("Pick").button("Ready").show(player);',
      '  manager.closeAllForms(player);',
      '  player.onScreenDisplay.setActionBar("Preparing");',
      '  player.teleport({ x: 1, y: 2, z: 3 });',
      '  player.camera.setCamera("minecraft:free", { location: { x: 2, y: 3, z: 4 } });',
      '  player.camera.clear();',
      '  world.getAllPlayers();',
      '  const nowTick = system.currentTick;',
      '  player.dimension.getEntities({ type: "minecraft:zombie" });',
      '  target.kill();',
      '  world.sendMessage("Updated");',
      '  const fake = { show() {}, kill() {}, setActionBar() {}, setCamera() {} };',
      '  fake.show(); fake.kill(); fake.setActionBar(); fake.setCamera();',
      '}',
      'world.beforeEvents.entityHurt.subscribe(() => {});',
      'world.afterEvents.entityDie.subscribe(() => {});',
      'world.afterEvents.entityRemove.subscribe(() => {});',
    ].join("\n"), { artifactId, relativePath });
    const ir = buildInspectionSemanticIr({
      parsedFunctions: [],
      parsedScripts: [{ parsed }],
    });
    const calls = ir.execution.apiCalls ?? [];
    expect(calls.map(call => call.symbol)).toEqual(expect.arrayContaining([
      "ActionFormData.show",
      "UIManager.closeAllForms",
      "ScreenDisplay.setActionBar",
      "Entity.teleport",
      "Camera.setCamera",
      "Camera.clear",
      "world.getAllPlayers",
      "Dimension.getEntities",
      "Entity.kill",
      "world.sendMessage",
    ]));
    expect(calls.some(call => call.receiverType === "Player" &&
      call.method === "teleport")).toBe(true);
    expect(calls.filter(call => call.method === "show")).toHaveLength(1);
    expect(calls.filter(call => call.method === "kill")).toHaveLength(1);
    expect(calls.every(call => call.source.artifactId === artifactId &&
      call.source.relativePath === relativePath)).toBe(true);
    expect(ir.execution.apiPropertyReads).toEqual([
      expect.objectContaining({
        receiverType: "System",
        property: "currentTick",
        symbol: "system.currentTick",
        source: expect.objectContaining({ artifactId, relativePath }),
      }),
    ]);

    const signals = developerPracticeSignalsFromSemanticIr(ir, artifactId)
      .map(item => item.signal);
    expect(signals).toEqual(expect.arrayContaining([
      "ActionFormData",
      "closeAllForms",
      "onScreenDisplay.setActionBar",
      "player.teleport",
      "camera.setCamera",
      "camera.clear",
      "getAllPlayers",
      "getEntities",
      "system.currentTick",
      "Entity.kill",
      "sendMessage",
      "world.beforeEvents.entityHurt",
      "entityDie",
      "entityRemove",
    ]));
    expect(developerPracticeSignalsFromSemanticIr(ir, "different-world"))
      .toHaveLength(0);
  });

  it("does not infer Minecraft form or display APIs from a lookalike local class", () => {
    const parsed = parseScriptFile("fake", [
      'class ActionFormData { show() {} }',
      'const local = new ActionFormData();',
      'local.show();',
      'const manager = { closeAllForms() {} }; manager.closeAllForms();',
      'const player = { onScreenDisplay: { setActionBar() {} }, camera: { setCamera() {}, clear() {} } };',
      'player.onScreenDisplay.setActionBar("not minecraft");',
      'player.camera.setCamera("minecraft:free"); player.camera.clear();',
      'const entity = { remove() {}, getDynamicProperty() { return 4; } };',
      'entity.remove(); entity.getDynamicProperty("round");',
      'const storage = { setDynamicProperty() {}, getDynamicProperty() { return 2; } };',
      'storage.setDynamicProperty("round", 1); storage.getDynamicProperty("round");',
      'const dimension = { getEntities() {} }; dimension.getEntities();',
      'const world = { getAllPlayers() {}, afterEvents: { entityDie: { subscribe() {} } } };',
      'world.getAllPlayers(); world.afterEvents.entityDie.subscribe(() => {});',
      'system.runInterval(() => {}, 20);',
      'const phantomTick = system.currentTick;',
    ].join("\n"), {
      artifactId: "selected", relativePath: "scripts/fake.js",
    });
    const ir = buildInspectionSemanticIr({
      parsedFunctions: [], parsedScripts: [{ parsed }],
    });
    expect(ir.execution.apiCalls).toEqual([]);
    expect(ir.execution.apiPropertyReads ?? []).toHaveLength(0);
    expect(ir.state.operations).toEqual([]);
    const hints = developerPracticeSignalsFromSemanticIr(ir, "selected")
      .map(item => item.signal);
    expect(hints).not.toContain("system.runInterval");
    expect(hints).not.toContain("entityDie");
    expect(hints).not.toContain("getDynamicProperty");
    expect(hints).not.toContain("setDynamicProperty");
  });

});
