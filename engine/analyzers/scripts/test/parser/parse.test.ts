import { describe, expect, it } from "vitest";
import { parseScriptFile } from "../../src/parser/parse.js";
import { resolveScriptImports } from "../../src/parser/resolve.js";
import { summarizeMinecraftModules } from "../../src/parser/module-usage.js";

const source = {
  artifactId: "art_demo",
  relativePath: "behavior_packs/demo/scripts/main.ts",
};

describe("script analyzer", () => {
  it("retains exact authored translate-key object references, never random strings or computed keys", () => {
    const script = [
      'player.sendMessage({ translate: "welcome.guide" });',
      'const message = { translate: "daigon.welcome.line2" };',
      'const unrelated = "daigon.ui.winner.red";',
      'const computed = { translate: dynamicKey };',
      'const extra = { "translate": "translated.other" };',
      'const template = { translate: `translated.template` };',
    ].join("\n");
    const parsed = parseScriptFile("scripts/main", script, source);
    const refs = parsed.literalTranslationReferences ?? [];
    expect(refs.map(item => item.key)).toEqual([
      "welcome.guide", "daigon.welcome.line2",
      "translated.other", "translated.template",
    ]);
    expect(refs.map(item => item.source.range?.lineStart)).toEqual([1, 2, 5, 6]);
    expect(refs.every(item =>
      item.syntax === "translate-object-literal" &&
      item.source.artifactId === source.artifactId &&
      item.source.relativePath === source.relativePath &&
      item.source.range?.columnStart !== undefined)).toBe(true);
    expect(refs.some(item => item.key === "daigon.ui.winner.red")).toBe(false);
    expect(refs.some(item => item.key === "dynamicKey")).toBe(false);
  });

  it("retains exact source-branch context around a literal translation, not inferred UI execution", () => {
    const parsed = parseScriptFile("scripts/guarded", [
      "function showWelcome(ready) {",
      "  if (!ready) return;",
      '  const line = { translate: "welcome.guide" };',
      '  if (ready) { const option = { translate: "party.ready" }; }',
      "  return line;",
      "}",
    ].join("\n"), source);
    const guide = parsed.literalTranslationReferences?.find(item =>
      item.key === "welcome.guide");
    const option = parsed.literalTranslationReferences?.find(item =>
      item.key === "party.ready");
    expect(guide?.executionRegion).toBe("function:showWelcome");
    expect(guide?.source.range?.lineStart).toBe(3);
    expect(guide?.precedenceGuards?.some(guard =>
      guard.conditionText === "!ready" && guard.branch === "false"))
      .toBe(true);
    expect(option?.lexicalGuards?.some(guard =>
      guard.conditionText === "ready" && guard.branch === "true"))
      .toBe(true);
    expect(option?.precedenceGuards?.some(guard =>
      guard.conditionText === "!ready" && guard.branch === "false"))
      .toBe(true);
    // Conditions on source expression are NOT the same as proof of an
    // observed message, gameplay objective or session transition.
  });


  it("keeps helper-return receiver identity inside its original lexical scope", () => {
    const parsed = parseScriptFile("scripts/main", [
      'import { world } from "@minecraft/server";',
      'function original() { return world; }',
      'function use() {',
      '  original().sendMessage("real");',
      '  { const original = () => ({ sendMessage() {} });',
      '    original().sendMessage("local"); }',
      '}',
    ].join("\n"), source);
    const candidates = parsed.methodCalls.filter(call =>
      call.symbol === "world.sendMessage");
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.source.range?.lineStart).toBe(4);
  });

  it("does not confuse catch or for bindings with an outer local callback", () => {
    const parsed = parseScriptFile("scripts/main", [
      'import { system } from "@minecraft/server";',
      'function setup() {',
      '  const handler = () => {};',
      '  system.run(handler);',
      '  try { throw new Error("x"); } catch (handler) { system.runTimeout(handler, 2); }',
      '  for (const handler of callbacks) { system.runInterval(handler, 2); }',
      '}',
    ].join("\n"), source);
    expect(parsed.deferredCallbacks.find(item => item.scheduler === "run")?.callbackRegion)
      .toMatch(/^callback@/);
    expect(parsed.deferredCallbacks.find(item => item.scheduler === "runTimeout")?.callbackRegion)
      .toBeUndefined();
    expect(parsed.deferredCallbacks.find(item => item.scheduler === "runInterval")?.callbackRegion)
      .toBeUndefined();
  });

  it("links locally declared immutable callbacks without guessing Promise parameters", () => {
    const parsed = parseScriptFile("scripts/main", [
      'import { system } from "@minecraft/server";',
      'function run() {',
      '  const cleanup = () => {};',
      '  system.run(cleanup);',
      '  new Promise((resolve) => { system.runTimeout(resolve, 2); });',
      '}',
    ].join("\n"), source);
    const run = parsed.deferredCallbacks.find(item => item.scheduler === "run");
    const timeout = parsed.deferredCallbacks.find(item => item.scheduler === "runTimeout");
    expect(run?.callbackRegion).toMatch(/^callback@/);
    expect(timeout?.callbackRegion).toBeUndefined();
  });

  it("does not resolve callback aliases with conflicting module bindings", () => {
    const parsed = parseScriptFile("scripts/main", [
      'import { world, system } from "@minecraft/server";',
      'function onTick() {}',
      'var onTick = other;',
      'const aliased = onTick;',
      'system.runInterval(aliased, 20);',
    ].join("\n"), source);
    expect(parsed.deferredCallbacks.find(item => item.scheduler === "runInterval")?.callbackRegion)
      .toBeUndefined();
  });

  it("resolves a direct immutable callback alias but not mutable or shadowed aliases", () => {
    const parsed = parseScriptFile("scripts/main", [
      'import { world, system } from "@minecraft/server";',
      'function onSpawn() {}',
      'const handleSpawn = onSpawn;',
      'const onPulse = () => {};',
      'const tickHandler = onPulse;',
      'let mutableHandler = onSpawn;',
      'world.afterEvents.playerSpawn.subscribe(handleSpawn);',
      'system.runInterval(tickHandler, 20);',
      'system.runTimeout(mutableHandler, 20);',
      'function configure(handleSpawn) { system.runTimeout(handleSpawn, 20); }',
    ].join("\n"), source);
    expect(parsed.events.find(event => event.event === "playerSpawn")?.callbackRegion)
      .toBe("function:onSpawn");
    expect(parsed.deferredCallbacks.find(item => item.scheduler === "runInterval")?.callbackRegion)
      .toMatch(/^callback@/);
    expect(parsed.deferredCallbacks.filter(item => item.scheduler === "runTimeout")
      .every(item => item.callbackRegion === undefined)).toBe(true);
  });

  it("does not resolve shadowed top-level callbacks from nested lexical scopes", () => {
    const parsed = parseScriptFile("scripts/main", [
      'import { world, system } from "@minecraft/server";',
      'const onSpawn = () => {};',
      'function tick() {}',
      'function configure(onSpawn) { world.afterEvents.playerSpawn.subscribe(onSpawn); }',
      'function scoped() { const tick = other; system.runInterval(tick, 20); }',
    ].join("\n"), source);
    expect(parsed.events.find(event => event.event === "playerSpawn")?.callbackRegion)
      .toBeUndefined();
    expect(parsed.deferredCallbacks.find(item => item.scheduler === "runInterval")?.callbackRegion)
      .toBeUndefined();
  });

  it("keeps catch and loop-local callback shadows unresolved", () => {
    const parsed = parseScriptFile("scripts/main", [
      'import { world, system } from "@minecraft/server";',
      'function handler() {}',
      'try { throw new Error("x"); } catch (handler) {',
      '  world.afterEvents.playerSpawn.subscribe(handler);',
      '}',
      'for (const handler of handlers) {',
      '  system.runInterval(handler, 20);',
      '}',
    ].join("\n"), source);
    expect(parsed.events.find(item => item.event === "playerSpawn")?.callbackRegion)
      .toBeUndefined();
    expect(parsed.deferredCallbacks.find(item => item.scheduler === "runInterval")?.callbackRegion)
      .toBeUndefined();
  });

  it("does not resolve callbacks shadowed by destructured bindings", () => {
    const parsed = parseScriptFile("scripts/main", [
      'import { world, system } from "@minecraft/server";',
      'function handler() {}',
      'function configure({ handler }) { world.afterEvents.playerSpawn.subscribe(handler); }',
      'function scoped() { const [handler] = callbacks; system.runInterval(handler, 20); }',
    ].join("\n"), source);
    expect(parsed.events.find(item => item.event === "playerSpawn")?.callbackRegion)
      .toBeUndefined();
    expect(parsed.deferredCallbacks.find(item => item.scheduler === "runInterval")?.callbackRegion)
      .toBeUndefined();
  });

  it("links top-level const function callbacks without resolving mutable references", () => {
    const parsed = parseScriptFile("scripts/main", [
      'import { world, system } from "@minecraft/server";',
      'const handleSpawn = () => { world.setDynamicProperty("joined", 1); };',
      'const heartbeat = function () { world.setDynamicProperty("tick", 1); };',
      'let mutableCallback = heartbeat;',
      'world.afterEvents.playerSpawn.subscribe(handleSpawn);',
      'system.runInterval(heartbeat, 20);',
      'system.runTimeout(mutableCallback, 20);',
    ].join("\n"), source);
    expect(parsed.events.find(item => item.event === "playerSpawn")?.callbackRegion)
      .toMatch(/^callback@/);
    expect(parsed.deferredCallbacks.find(item => item.scheduler === "runInterval")?.callbackRegion)
      .toMatch(/^callback@/);
    expect(parsed.deferredCallbacks.find(item => item.scheduler === "runTimeout")?.callbackRegion)
      .toBeUndefined();
  });

  it("resolves explicit top-level named event and timer callbacks without guessing dynamic references", () => {
    const parsed = parseScriptFile("scripts/main", [
      'import { world, system } from "@minecraft/server";',
      'function onSpawn() { world.setDynamicProperty("joined", true); }',
      'function onTick() { world.setDynamicProperty("tick", 1); }',
      'world.afterEvents.playerSpawn.subscribe(onSpawn);',
      'system.runInterval(onTick, 20);',
      'system.runTimeout(dynamicCallback, 20);',
    ].join("\n"), source);
    expect(parsed.events.find(item => item.event === "playerSpawn")?.callbackRegion)
      .toBe("function:onSpawn");
    expect(parsed.deferredCallbacks.find(item => item.scheduler === "runInterval")?.callbackRegion)
      .toBe("function:onTick");
    expect(parsed.deferredCallbacks.find(item => item.scheduler === "runTimeout")?.callbackRegion)
      .toBeUndefined();
  });

  it("extracts Minecraft imports, event subscriptions and dynamic properties", () => {
    const parsed = parseScriptFile(
      "scripts/main",
      `
import { world, system } from "@minecraft/server";
import { helper } from "./helper";

world.afterEvents.playerSpawn.subscribe((event) => {
  event.player.setDynamicProperty("joined", true);
});

system.afterEvents.scriptEventReceive.subscribe(() => {});
`,
      source,
    );

    expect(parsed.imports.some((item) => item.module === "@minecraft/server")).toBe(true);
    expect(parsed.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        root: "world",
        phase: "afterEvents",
        event: "playerSpawn",
      }),
      expect.objectContaining({
        root: "system",
        phase: "afterEvents",
        event: "scriptEventReceive",
      }),
    ]));
    expect(parsed.dynamicProperties).toEqual(expect.arrayContaining([
      expect.objectContaining({ operation: "set", propertyId: "joined" }),
    ]));
  });

  it("canonicalizes aliased world/system imports used by bundled scripts", () => {
    const parsed = parseScriptFile(
      "scripts/main",
      `
import { world as world8, system as system5 } from "@minecraft/server";

world8.afterEvents.playerSpawn.subscribe(() => {});
system5.afterEvents.scriptEventReceive.subscribe(() => {});
world8.getDimension("overworld");
system5.runInterval(() => {}, 1);
const board = world8.scoreboard;
`,
      source,
    );

    expect(parsed.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        root: "world",
        phase: "afterEvents",
        event: "playerSpawn",
      }),
      expect.objectContaining({
        root: "system",
        phase: "afterEvents",
        event: "scriptEventReceive",
      }),
    ]));

    expect(parsed.methodCalls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        symbol: "world.getDimension",
        inference: "direct",
        root: "world",
      }),
      expect.objectContaining({
        symbol: "system.runInterval",
        inference: "direct",
        root: "system",
      }),
    ]));

    expect(parsed.propertyAccesses).toEqual(expect.arrayContaining([
      expect.objectContaining({
        symbol: "world.scoreboard",
        inference: "direct",
        root: "world",
      }),
    ]));
  });

  it("extracts direct world and system method symbols without guessing nested receiver types", () => {
    const parsed = parseScriptFile(
      "scripts/main",
      `
import { world, system } from "@minecraft/server";

world.getAllPlayers();
world.getDimension("overworld");
system.runInterval(() => {}, 1);
world.scoreboard.getObjective("round");
`,
      source,
    );

    expect(parsed.methodCalls).toEqual(expect.arrayContaining([
      expect.objectContaining({ symbol: "world.getAllPlayers" }),
      expect.objectContaining({ symbol: "world.getDimension" }),
      expect.objectContaining({ symbol: "system.runInterval" }),
    ]));
  });

  it("propagates a Player only from an exact playerSpawn callback and a unique local helper handoff", () => {
    const parsed = parseScriptFile("scripts/entry", [
      'import { world } from "@minecraft/server";',
      'function welcome(p) {',
      '  p.playSound("ui.welcome");',
      '}',
      'export function start() {',
      '  world.afterEvents.playerSpawn.subscribe((event) => {',
      '    const samePlayer = event.player;',
      '    samePlayer.playSound("ui.direct");',
      '    if (event.initialSpawn) welcome(event.player);',
      '  });',
      '}',
    ].join("\n"), source);
    const sounds = parsed.methodCalls.filter(call =>
      call.method === "playSound");
    expect(sounds.map(call => call.receiverType)).toEqual(["Player", "Player"]);
    expect(sounds.every(call => call.inference === "bounded")).toBe(true);
  });

  it("does not infer a helper Player from another event, multiple callers or shadowed symbols", () => {
    const parsed = parseScriptFile("scripts/entry", [
      'import { world } from "@minecraft/server";',
      'function multiple(p) { p.playSound("not.proven"); }',
      'function joined(p) { p.playSound("not.joined"); }',
      'function shadowed(p) { p.playSound("not.shadowed"); }',
      'export function start(other) {',
      '  world.afterEvents.playerSpawn.subscribe((event) => {',
      '    multiple(event.player);',
      '  });',
      '  multiple(other);',
      '  world.afterEvents.playerJoin.subscribe((event) => joined(event.player));',
      '  {',
      '    function shadowed(p) { p.playSound("local.shadow"); }',
      '    world.afterEvents.playerSpawn.subscribe((event) => shadowed(event.player));',
      '  }',
      '}',
    ].join("\n"), source);
    expect(parsed.methodCalls.some(call => call.method === "playSound"))
      .toBe(false);
  });

  it("does not forward a Player through mutable helper or event parameters", () => {
    const parsed = parseScriptFile("scripts/entry", [
      'import { world } from "@minecraft/server";',
      'function changed(p) { p = replacement; p.playSound("not.proven"); }',
      'function fixed(p) { p.playSound("also.not.proven"); }',
      'export function setup() {',
      '  world.afterEvents.playerSpawn.subscribe((event) => changed(event.player));',
      '  world.afterEvents.playerSpawn.subscribe((event) => {',
      '    event = replacement;',
      '    fixed(event.player);',
      '  });',
      '}',
    ].join("\n"), source);
    expect(parsed.methodCalls.some(call => call.method === "playSound"))
      .toBe(false);
  });

  it("does not trust an event source shadowed by a local world parameter", () => {
    const parsed = parseScriptFile("scripts/entry", [
      'import { world } from "@minecraft/server";',
      'function onSpawn(world) {',
      '  world.afterEvents.playerSpawn.subscribe(event => event.player.playSound("untrusted"));',
      '}',
    ].join("\n"), source);
    expect(parsed.methodCalls.some(call => call.method === "playSound"))
      .toBe(false);
  });

  it("does not infer Player after reassignment of the subscribed event object", () => {
    const parsed = parseScriptFile("scripts/entry", [
      'import { world } from "@minecraft/server";',
      'export function setup() {',
      '  world.afterEvents.playerSpawn.subscribe(event => {',
      '    event = fake;',
      '    event.player.playSound("not.proven");',
      '  });',
      '}',
    ].join("\n"), source);
    expect(parsed.methodCalls.some(call => call.method === "playSound"))
      .toBe(false);
  });

  it("does not trust an unimported global with the same event API spelling", () => {
    const parsed = parseScriptFile("scripts/entry", [
      'function main() {',
      '  world.afterEvents.playerSpawn.subscribe(event => event.player.playSound("fake"));',
      '}',
    ].join("\n"), source);
    expect(parsed.methodCalls.some(call => call.method === "playSound"))
      .toBe(false);
  });

  it("infers bounded receiver types through variables, loops, callbacks and property chains", () => {
    const parsed = parseScriptFile(
      "scripts/main",
      `
import { world } from "@minecraft/server";

const dimension = world.getDimension("overworld");
for (const entity of dimension.getEntities()) {
  entity.getTags();
}

world.getAllPlayers().forEach((player) => {
  player.addTag("arena:test");
  player.removeTag("arena:old");
});

const objective = world.scoreboard.getObjective("round");
objective?.getScore("#arena1");
`,
      source,
    );

    expect(parsed.methodCalls).toEqual(expect.arrayContaining([
      expect.objectContaining({ symbol: "world.getDimension", inference: "direct" }),
      expect.objectContaining({ symbol: "Dimension.getEntities", receiverType: "Dimension" }),
      expect.objectContaining({ symbol: "Entity.getTags", receiverType: "Entity" }),
      expect.objectContaining({ symbol: "Entity.addTag", receiverType: "Player" }),
      expect.objectContaining({ symbol: "Entity.removeTag", receiverType: "Player" }),
      expect.objectContaining({ symbol: "Scoreboard.getObjective", receiverType: "Scoreboard" }),
    ]));
  });

  it("retains Dimension receiver identity through Block and Entity dimension properties", () => {
    const parsed = parseScriptFile("scripts/main", [
      'import { world } from "@minecraft/server";',
      'const dimension = world.getDimension("overworld");',
      'const block = dimension.getBlock({x:0,y:64,z:0});',
      'block?.dimension.playSound("block.click", {x:0,y:64,z:0});',
      'for (const entity of dimension.getEntities()) {',
      '  entity.dimension.playSound("entity.call", entity.location);',
      '}',
      'for (const player of world.getAllPlayers()) {',
      '  player.dimension.playSound("player.step", player.location);',
      '}',
      'const unrelated = unknownFactory();',
      'unrelated.dimension.playSound("untrusted", {x:0,y:0,z:0});',
    ].join("\n"), source);
    const sounds = parsed.methodCalls.filter(call => call.method === "playSound");
    expect(sounds).toHaveLength(3);
    expect(sounds.every(call =>
      call.receiverType === "Dimension" && call.inference === "bounded"
    )).toBe(true);
  });

  it("propagates a bounded Player return from a local helper built on getAllPlayers().find", () => {
    const parsed = parseScriptFile(
      "scripts/main",
      `
import { world } from "@minecraft/server";

function findPlayer(name) {
  return world.getAllPlayers().find((player) => player.name === name);
}

const player = findPlayer("Alex");
player?.addTag("session:assigned");
`,
      source,
    );

    expect(parsed.methodCalls).toEqual(expect.arrayContaining([
      expect.objectContaining({ symbol: "world.getAllPlayers" }),
      expect.objectContaining({ symbol: "Entity.addTag", receiverType: "Player" }),
    ]));
  });

  it("extracts bounded property symbols and aliased module-member symbols", () => {
    const parsed = parseScriptFile(
      "scripts/main",
      `
import { world, GameMode as GM } from "@minecraft/server";

const player = world.getAllPlayers()[0];
const cameraEnabled = player.inputPermissions.cameraEnabled;
const legacyMode = GM.adventure;
`,
      source,
    );

    expect(parsed.propertyAccesses).toEqual(expect.arrayContaining([
      expect.objectContaining({
        symbol: "Player.inputPermissions",
        receiverType: "Player",
      }),
      expect.objectContaining({
        symbol: "PlayerInputPermissions.cameraEnabled",
        receiverType: "PlayerInputPermissions",
      }),
    ]));

    expect(parsed.moduleMemberAccesses).toEqual(expect.arrayContaining([
      expect.objectContaining({
        module: "@minecraft/server",
        importedName: "GameMode",
        localName: "GM",
        member: "adventure",
        symbol: "GameMode.adventure",
      }),
    ]));
  });

  it("canonicalizes inherited Player properties to Entity symbols", () => {
    const parsed = parseScriptFile(
      "scripts/main",
      `
import { world } from "@minecraft/server";
const player = world.getAllPlayers()[0];
const id = player.id;
const location = player.location;
const dimension = player.dimension;
const scoreboardIdentity = player.scoreboardIdentity;
const playerName = player.name;
`,
      source,
    );

    expect(parsed.propertyAccesses).toEqual(expect.arrayContaining([
      expect.objectContaining({ symbol: "Entity.id", receiverType: "Player" }),
      expect.objectContaining({ symbol: "Entity.location", receiverType: "Player" }),
      expect.objectContaining({ symbol: "Entity.dimension", receiverType: "Player" }),
      expect.objectContaining({ symbol: "Entity.scoreboardIdentity", receiverType: "Player" }),
      expect.objectContaining({ symbol: "Player.name", receiverType: "Player" }),
    ]));

    expect(parsed.propertyAccesses.some(
      (item) => item.symbol === "Player.id" || item.symbol === "Player.location",
    )).toBe(false);
  });

  it("records bounded method call shape evidence", () => {
    const parsed = parseScriptFile(
      "scripts/main",
      `
import { world } from "@minecraft/server";
const player = world.getAllPlayers()[0];
player.applyKnockback(0, 1, 0.5, 0.4);
player.applyKnockback({ x: 0, z: 1 }, 0.4);
`,
      source,
    );

    expect(parsed.methodCalls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        symbol: "Entity.applyKnockback",
        argumentCount: 4,
        argumentKinds: ["number", "number", "number", "number"],
        hasSpreadArgument: false,
      }),
      expect.objectContaining({
        symbol: "Entity.applyKnockback",
        argumentCount: 2,
        argumentKinds: ["object", "number"],
        hasSpreadArgument: false,
      }),
    ]));
  });

  it("classifies direct method result-use safety shapes", () => {
    const parsed = parseScriptFile(
      "scripts/main",
      `
import { world } from "@minecraft/server";
const entity = world.getDimension("overworld").getEntities()[0];
entity.getComponent("minecraft:health").currentValue;
entity.getComponent("minecraft:health")?.currentValue;
const assigned = entity.getComponent("minecraft:health");
`,
      source,
    );

    expect(parsed.methodCalls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        symbol: "Entity.getComponent",
        resultUse: "dereferenced",
      }),
      expect.objectContaining({
        symbol: "Entity.getComponent",
        resultUse: "optional-dereferenced",
      }),
      expect.objectContaining({
        symbol: "Entity.getComponent",
        resultUse: "assigned",
      }),
    ]));
  });

  it("recognizes logical-and and ternary guards for optional results", () => {
    const parsed = parseScriptFile(
      "scripts/main",
      `
import { world } from "@minecraft/server";
const entity = world.getDimension("overworld").getEntities()[0];

const withAnd = entity.getComponent("minecraft:health");
if (withAnd && entity.isValid) {
  withAnd.currentValue;
}

const withTernary = entity.getComponent("minecraft:health");
const text = withTernary ? withTernary.currentValue : 0;
`,
      source,
    );

    const componentCalls = parsed.methodCalls.filter(
      (item) => item.symbol === "Entity.getComponent",
    );
    expect(componentCalls).toHaveLength(2);
    expect(componentCalls).toEqual([
      expect.objectContaining({ resultUse: "guarded-assigned" }),
      expect.objectContaining({ resultUse: "guarded-assigned" }),
    ]);
  });

  it("classifies bounded local guards for assigned optional results", () => {
    const parsed = parseScriptFile(
      "scripts/main",
      `
import { world } from "@minecraft/server";
const entity = world.getDimension("overworld").getEntities()[0];

const guarded = entity.getComponent("minecraft:health");
if (guarded) {
  guarded.currentValue;
}

const early = entity.getComponent("minecraft:health");
if (!early) return;
early.currentValue;

const unsafe = entity.getComponent("minecraft:health");
unsafe.currentValue;
`,
      source,
    );

    expect(parsed.methodCalls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        symbol: "Entity.getComponent",
        resultUse: "guarded-assigned",
      }),
      expect.objectContaining({
        symbol: "Entity.getComponent",
        resultUse: "unguarded-assigned",
      }),
    ]));
  });

  it("tracks type-only symbols and bounded namespace members", () => {
    const parsed = parseScriptFile(
      "scripts/main",
      `
import type { WorldInitializeBeforeEvent } from "@minecraft/server";
import * as mc from "@minecraft/server";

const legacy = mc.GameMode.adventure;
type Init = mc.WorldInitializeAfterEvent;
`,
      source,
    );

    expect(parsed.importedSymbols).toEqual(expect.arrayContaining([
      expect.objectContaining({
        importedName: "WorldInitializeBeforeEvent",
        typeOnly: true,
      }),
      expect.objectContaining({
        importedName: "WorldInitializeAfterEvent",
        typeOnly: true,
      }),
    ]));

    expect(parsed.moduleMemberAccesses).toEqual(expect.arrayContaining([
      expect.objectContaining({
        importedName: "GameMode",
        member: "adventure",
        symbol: "GameMode.adventure",
      }),
    ]));
  });

  it("infers component property writes from getComponent identifiers", () => {
    const parsed = parseScriptFile(
      "scripts/main",
      `
import { world } from "@minecraft/server";
const entity = world.getDimension("overworld").getEntities()[0];
const scale = entity.getComponent("minecraft:scale");
scale.value = 2;
const mark = entity.getComponent("minecraft:mark_variant");
mark.value += 1;
`,
      source,
    );

    expect(parsed.propertyWrites).toEqual(expect.arrayContaining([
      expect.objectContaining({
        symbol: "EntityScaleComponent.value",
        operation: "assign",
      }),
      expect.objectContaining({
        symbol: "EntityMarkVariantComponent.value",
        operation: "compound",
      }),
    ]));
  });

  it("captures enum backing-value literal comparisons", () => {
    const parsed = parseScriptFile(
      "scripts/main",
      `
import { BlockComponentTypes as BCT } from "@minecraft/server";
import * as mc from "@minecraft/server";

const a = BCT.FluidContainer === "minecraft:fluidContainer";
const b = "minecraft:fluid_container" !== mc.BlockComponentTypes.FluidContainer;
`,
      source,
    );

    expect(parsed.enumValueComparisons).toEqual(expect.arrayContaining([
      expect.objectContaining({
        symbol: "BlockComponentTypes.FluidContainer",
        operator: "===",
        literal: "minecraft:fluidContainer",
      }),
      expect.objectContaining({
        symbol: "BlockComponentTypes.FluidContainer",
        operator: "!==",
        literal: "minecraft:fluid_container",
      }),
    ]));
  });

  it("extracts literal entity-event triggers and embedded command strings", () => {
    const parsed = parseScriptFile(
      "scripts/main",
      `
import { world } from "@minecraft/server";
const player = world.getAllPlayers()[0];
player.triggerEvent("daigon:recover");
const entry = {
  command: "/summon daigon:path 1 2 3 0 0 daigon:set_path_0",
};
`,
      source,
    );

    expect(parsed.entityEventTriggers).toEqual([
      expect.objectContaining({
        event: "daigon:recover",
        receiverHint: "player",
      }),
    ]);
    expect(parsed.commandLiterals).toEqual([
      expect.objectContaining({
        command: "/summon daigon:path 1 2 3 0 0 daigon:set_path_0",
      }),
    ]);
  });

  it("captures literal runCommand surfaces with execution context", () => {
    const parsed = parseScriptFile(
      "scripts/main",
      `
import { world } from "@minecraft/server";
const dimension = world.getDimension("overworld");
const player = world.getAllPlayers()[0];

dimension.runCommand("fill 0 64 0 1 65 1 minecraft:stone");
player.runCommandAsync("tp @s 5 65 5");
const dynamic = "tp @s " + player.name;
dimension.runCommand(dynamic);
`,
      source,
    );

    expect(parsed.commandLiterals).toEqual(expect.arrayContaining([
      expect.objectContaining({
        command: "fill 0 64 0 1 65 1 minecraft:stone",
        mechanism: "runCommand",
        executionRegion: "module",
        receiverHint: "dimension",
      }),
      expect.objectContaining({
        command: "tp @s 5 65 5",
        mechanism: "runCommandAsync",
        executionRegion: "module",
        receiverHint: "player",
      }),
    ]));
    expect(parsed.commandLiterals.some(
      (item) => item.command.includes("player.name"),
    )).toBe(false);
  });

  it("tracks lifecycle member exposure even when receiver typing is incomplete", () => {
    const parsed = parseScriptFile(
      "scripts/main",
      `
import { world } from "@minecraft/server";
const player = world.getAllPlayers()[0];
player.runCommandAsync("say typed");
customRuntime.runCommandAsync("say lexical");
player.isValid();
`,
      source,
    );

    expect(parsed.lifecycleMemberExposures).toEqual(expect.arrayContaining([
      expect.objectContaining({
        member: "runCommandAsync",
        evidence: "exact-symbol",
        exactSymbol: "Entity.runCommandAsync",
      }),
      expect.objectContaining({
        member: "runCommandAsync",
        evidence: "lexical-only",
      }),
      expect.objectContaining({
        member: "isValid",
        evidence: "exact-symbol",
        exactSymbol: "Entity.isValid",
      }),
    ]));
  });

  it("captures direct guarded return outcomes without crossing nested functions", () => {
    const parsed = parseScriptFile(
      "scripts/recovery-policy",
      `
function decideReconnect(state) {
  if (state.pendingCleanup) {
    return { action: "cleanup", reason: "pending" };
  }

  if (state.phase === "active") return { action: "resume" };

  if (state.phase === "countdown") {
    const nested = () => ({ action: "ignore" });
    return { action: "wait" };
  }

  return { action: "lobby" };
}
`,
      source,
    );

    expect(parsed.guardedOutcomes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        executionRegion: "function:decideReconnect",
        conditionText: "state.pendingCleanup",
        propertyName: "action",
        value: "cleanup",
      }),
      expect.objectContaining({
        executionRegion: "function:decideReconnect",
        conditionText: 'state.phase === "active"',
        propertyName: "action",
        value: "resume",
      }),
      expect.objectContaining({
        executionRegion: "function:decideReconnect",
        conditionText: 'state.phase === "countdown"',
        propertyName: "action",
        value: "wait",
      }),
    ]));

    expect(
      parsed.guardedOutcomes?.some(
        (item) => item.value === "ignore",
      ),
    ).toBe(false);
  });

  it("models recovery fallback and membership guards from authored control flow", () => {
    const parsed = parseScriptFile(
      "src/domain/recovery-policy",
      `
function decideRecovery(record, session, arena) {
  if (!record) return { action: "lobby", reason: "no recovery record" };
  if (record.pendingCleanup) return { action: "cleanup", reason: "pending cleanup" };
  if (!session || !arena) return { action: "cleanup", reason: "missing owner" };
  if (
    session.sessionId !== record.sessionId ||
    session.generation !== record.generation ||
    session.arenaId !== record.arenaId
  ) {
    return { action: "cleanup", reason: "ownership changed" };
  }
  if (!session.roster[record.playerId]) {
    return { action: "cleanup", reason: "membership missing" };
  }
  if (
    session.phase === "active" ||
    session.phase === "round_transition"
  ) {
    return { action: "resume" };
  }
  if (
    ["countdown", "preparing", "resetting", "cinematic"]
      .includes(session.phase)
  ) {
    return { action: "wait" };
  }
  return { action: "cleanup", reason: "phase fallback" };
}
`,
      source,
    );

    expect(
      parsed.guardedOutcomes?.some(
        (item) =>
          item.value === "wait" &&
          item.predicate.kind === "in",
      ),
    ).toBe(true);

    expect(
      parsed.guardedOutcomes?.some(
        (item) =>
          item.value === "cleanup" &&
          item.predicate.kind === "fallback",
      ),
    ).toBe(true);

    expect(
      parsed.guardedOutcomes?.some(
        (item) =>
          item.value === "cleanup" &&
          item.conditionText.includes(
            "session.generation !== record.generation",
          ),
      ),
    ).toBe(true);

    expect(
      parsed.guardedOutcomes?.some(
        (item) =>
          item.value === "cleanup" &&
          item.conditionText.includes(
            "session.roster[record.playerId]",
          ) &&
          item.predicate.kind === "falsy" &&
          item.predicate.operand.kind === "index" &&
          item.predicate.operand.base.kind === "path" &&
          item.predicate.operand.base.path === "session.roster" &&
          item.predicate.operand.key.kind === "path" &&
          item.predicate.operand.key.path === "record.playerId",
      ),
    ).toBe(true);
  });

  it("assigns class-method execution regions to guarded outcomes and fallbacks", () => {
    const parsed = parseScriptFile(
      "scripts/main",
      `
class Session {
  decideReconnect(state) {
    if (state.pendingCleanup) {
      return { kind: "cleanup" };
    }
    return { kind: "resume" };
  }
}
`,
      source,
    );

    expect(parsed.returnOutcomes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        executionRegion: expect.stringMatching(/^function:Session\.decideReconnect@/),
        propertyName: "kind",
        value: "cleanup",
      }),
      expect.objectContaining({
        executionRegion: expect.stringMatching(/^function:Session\.decideReconnect@/),
        propertyName: "kind",
        value: "resume",
      }),
    ]));

    expect(parsed.guardedOutcomes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        executionRegion: expect.stringMatching(/^function:Session\.decideReconnect@/),
        propertyName: "kind",
        value: "cleanup",
      }),
      expect.objectContaining({
        executionRegion: expect.stringMatching(/^function:Session\.decideReconnect@/),
        propertyName: "kind",
        value: "resume",
        predicate: expect.objectContaining({
          kind: "fallback",
        }),
      }),
    ]));
  });

  it("captures bounded intra-class method calls", () => {
    const parsed = parseScriptFile(
      "scripts/main",
      `
class Session {
  cleanup() {}
  reset() {
    this.cleanup();
    this.externalApi();
  }
}
`,
      source,
    );

    expect(parsed.localFunctionCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          callerRegion: expect.stringMatching(/^function:Session\.reset@/),
          targetRegion: expect.stringMatching(/^function:Session\.cleanup@/),
          targetName: "cleanup",
        }),
      ]),
    );

    expect(
      parsed.localFunctionCalls.some(
        (call) => call.targetName === "externalApi",
      ),
    ).toBe(false);
  });

  it("captures declared class members from bundled source", () => {
    const parsed = parseScriptFile(
      "scripts/main",
      `
class A {
  phase = "waiting";
  reconnect(player) {}
  disconnect(player) {}
  clearPlayerInventory(player) {}
  getNearbyReviver(player) {}
  initializeScoreboard() {}
}
`,
      source,
    );

    expect(parsed.declaredMembers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        member: "phase",
        memberKind: "property",
        containerHint: "A",
      }),
      expect.objectContaining({
        member: "reconnect",
        memberKind: "method",
      }),
      expect.objectContaining({
        member: "clearPlayerInventory",
        memberKind: "method",
      }),
      expect.objectContaining({
        member: "getNearbyReviver",
        memberKind: "method",
      }),
    ]));
  });

  it("captures authored spatial route-point tables", () => {
    const parsed = parseScriptFile(
      "scripts/main",
      `
const routePoints = [
  {
    location: { x: -17.5, y: -28.5, z: -110.51 },
    pathIndex: 0,
    route: "main",
  },
  {
    location: { x: 98.5, y: -28.5, z: 0.5 },
    pathIndex: 600,
    route: "bridge",
  },
  {
    location: { x: -69, y: -26.5, z: -8 },
    pathIndex: 500,
    route: "windmill",
  },
];
`,
      source,
    );

    expect(parsed.spatialRoutePoints).toEqual([
      expect.objectContaining({
        routeId: "main",
        location: {
          x: -17.5,
          y: -28.5,
          z: -110.51,
        },
        index: 0,
        collectionHint: "routePoints",
      }),
      expect.objectContaining({
        routeId: "bridge",
        location: {
          x: 98.5,
          y: -28.5,
          z: 0.5,
        },
        index: 600,
        collectionHint: "routePoints",
      }),
      expect.objectContaining({
        routeId: "windmill",
        location: {
          x: -69,
          y: -26.5,
          z: -8,
        },
        index: 500,
        collectionHint: "routePoints",
      }),
    ]);
  });

  it("captures local-to-context spatial offset transforms and uses", () => {
    const parsed = parseScriptFile(
      "scripts/main",
      `
function applyOffset(point, arena) {
  return {
    x: point.x + arena.gameplayOffset.x,
    y: point.y + arena.gameplayOffset.y,
    z: point.z + arena.gameplayOffset.z,
  };
}

function resolvePath(definition, arena) {
  return applyOffset(definition.location, arena);
}
`,
      source,
    );

    expect(parsed.spatialOffsetTransforms).toEqual([
      expect.objectContaining({
        functionName: "applyOffset",
        pointParameter: "point",
        contextParameter: "arena",
        offsetPath: "gameplayOffset",
      }),
    ]);

    expect(parsed.spatialTransformUses).toEqual([
      expect.objectContaining({
        functionName: "applyOffset",
        pointExpression: "definition.location",
        contextExpression: "arena",
      }),
    ]);
  });

  it("captures indexed context offset series from authored arena maps", () => {
    const parsed = parseScriptFile(
      "scripts/main",
      `
const ARENA_STRIDE = 351;
const joins = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
  [10, 11, 12],
  [13, 14, 15],
  [16, 17, 18],
];

const arenas = joins.map((entry, index) => {
  const number = index + 1;
  const offsetX = index * ARENA_STRIDE;
  return {
    id: \`arena_\${number}\`,
    gameplayOffset: {
      x: offsetX,
      y: 0,
      z: 0,
    },
  };
});
`,
      source,
    );

    expect(parsed.spatialContextOffsetSeries).toEqual([
      expect.objectContaining({
        collectionName: "arenas",
        sourceCollectionName: "joins",
        contextCount: 6,
        offsetPath: "gameplayOffset",
        offsetBase: { x: 0, y: 0, z: 0 },
        offsetStride: { x: 351, y: 0, z: 0 },
        contextIdPrefix: "arena_",
        contextIdIndexBase: 1,
      }),
    ]);
  });

  it("retains type imports without promoting them into runtime module use", () => {
    const parsed = parseScriptFile("scripts/types", [
      'import type { World } from "@minecraft/server";',
      'import { type Player, system } from "@minecraft/server";',
      'import { type Config } from "./config.js";',
      'import "./startup.js";',
    ].join("\n"), source);
    expect(parsed.imports.map(item => ({
      module: item.module, typeOnly: item.typeOnly ?? false,
      bindings: item.bindings,
    }))).toEqual([
      { module: "@minecraft/server", typeOnly: true, bindings: [] },
      { module: "@minecraft/server", typeOnly: false, bindings: ["system"] },
      { module: "./config.js", typeOnly: true, bindings: [] },
      { module: "./startup.js", typeOnly: false, bindings: [] },
    ]);
    expect(summarizeMinecraftModules([parsed])).toEqual([{
      module: "@minecraft/server", files: ["scripts/types"],
      bindings: ["system"],
    }]);
    expect(resolveScriptImports([parsed]).find(item =>
      item.module === "./config.js")?.typeOnly).toBe(true);
  });

  it("resolves relative script imports and summarizes Minecraft modules", () => {
    const main = parseScriptFile(
      "scripts/main",
      'import { world } from "@minecraft/server";\nimport "./helper";',
      source,
    );
    const helper = parseScriptFile(
      "scripts/helper",
      "export const helper = 1;",
      {
        artifactId: "art_demo",
        relativePath: "behavior_packs/demo/scripts/helper.ts",
      },
    );

    expect(resolveScriptImports([main, helper])).toEqual(expect.arrayContaining([
      expect.objectContaining({
        module: "./helper",
        status: "resolved",
        targetIdentifier: "scripts/helper",
      }),
    ]));

    expect(summarizeMinecraftModules([main, helper])).toEqual([
      {
        module: "@minecraft/server",
        files: ["scripts/main"],
        bindings: ["world"],
      },
    ]);
  });
  it("records source-owned dynamic literal and expression imports without claiming execution", () => {
    const primary = {
      artifactId: "selected-dynamic-world",
      relativePath: "behavior_packs/demo/scripts/main.ts",
    };
    const main = parseScriptFile("main", [
      "async function bootstrap(config) {",
      "  await import('./chunks/arena.js');",
      "  await import(\`./chunks/static.js\`);",
      "  return import(config.chunkName);",
      "}",
    ].join("\n"), primary);
    const arena = parseScriptFile("arena", "export const value = 1;", {
      artifactId: primary.artifactId,
      relativePath: "behavior_packs/demo/scripts/chunks/arena.js",
    });
    const staticChunk = parseScriptFile("static", "export const value = 2;", {
      artifactId: primary.artifactId,
      relativePath: "behavior_packs/demo/scripts/chunks/static.js",
    });
    expect(main.imports).toEqual(expect.arrayContaining([
      expect.objectContaining({
        module: "./chunks/arena.js",
        kind: "relative",
        importSyntax: "dynamic-literal",
        executionRegion: "function:bootstrap",
        source: expect.objectContaining({
          relativePath: primary.relativePath,
          range: expect.objectContaining({ lineStart: 2 }),
        }),
      }),
      expect.objectContaining({
        module: "./chunks/static.js",
        importSyntax: "dynamic-literal",
        executionRegion: "function:bootstrap",
      }),
      expect.objectContaining({
        module: "config.chunkName",
        kind: "unresolved",
        importSyntax: "dynamic-expression",
      }),
    ]));
    const imports = resolveScriptImports([main, arena, staticChunk]);
    expect(imports).toEqual(expect.arrayContaining([
      expect.objectContaining({
        module: "./chunks/arena.js", status: "resolved",
        targetIdentifier: "arena", importSyntax: "dynamic-literal",
        executionRegion: "function:bootstrap",
      }),
      expect.objectContaining({
        module: "./chunks/static.js", status: "resolved",
        targetIdentifier: "static", importSyntax: "dynamic-literal",
      }),
      expect.objectContaining({
        module: "config.chunkName", status: "unresolved",
        importSyntax: "dynamic-expression",
      }),
    ]));
    expect(imports.find(item => item.module === "config.chunkName")
      ?.targetSourcePath).toBeUndefined();
  });

  it("resolves a bundled .js dynamic specifier to one .ts source only when uniquely owned", () => {
    const source = {
      artifactId: "selected-map",
      relativePath: "behavior_packs/a/scripts/main.ts",
    };
    const main = parseScriptFile("main",
      "async function boot() { await import('./chunks/feature.js'); }",
      source);
    const tsTarget = parseScriptFile("typescript-chunk",
      "export const feature = true;", {
        artifactId: source.artifactId,
        relativePath: "behavior_packs/a/scripts/chunks/feature.ts",
      });
    const lookup = resolveScriptImports([main, tsTarget]);
    expect(lookup[0]).toMatchObject({
      status: "resolved", targetIdentifier: "typescript-chunk",
      importSyntax: "dynamic-literal",
    });

    const another = parseScriptFile("other", "export const feature = 2;", {
      artifactId: source.artifactId,
      relativePath: "behavior_packs/a/scripts/chunks/feature.jsx",
    });
    expect(resolveScriptImports([main, tsTarget, another])[0])
      .toMatchObject({ status: "unresolved" });
  });

  it("does not join dynamic imports across packs, artifacts or duplicate source owners", () => {
    const source = {
      artifactId: "artifact-current",
      relativePath: "behavior_packs/a/scripts/main.js",
    };
    const main = parseScriptFile("main", [
      "import('./chunks/feature.js');",
      "import('../../b/scripts/foreign.js');",
    ].join("\n"), source);
    const foreignArtifact = parseScriptFile("old-feature",
      "export const old = 1;", {
        artifactId: "artifact-previous",
        relativePath: "behavior_packs/a/scripts/chunks/feature.js",
      });
    const crossPack = parseScriptFile("cross-pack",
      "export const x = 1;", {
        artifactId: source.artifactId,
        relativePath: "behavior_packs/b/scripts/foreign.js",
      });
    expect(resolveScriptImports([main, foreignArtifact, crossPack])
      .every(item => item.status === "unresolved")).toBe(true);

    const current = parseScriptFile("current-feature", "export const x=1;", {
      artifactId: source.artifactId,
      relativePath: "behavior_packs/a/scripts/chunks/feature.js",
    });
    const duplicate = parseScriptFile("duplicate-feature", "export const x=2;", {
      artifactId: source.artifactId,
      relativePath: "behavior_packs/a/scripts/chunks/feature.js",
    });
    expect(resolveScriptImports([main, current, duplicate])[0])
      .toMatchObject({ status: "unresolved" });
  });

  it("preserves nested stage wave spawn recipes as source data, not gameplay proof", () => {
    const source = {
      artifactId: "selected",
      relativePath: "behavior_packs/example/scripts/main.js",
    };
    const parsed = parseScriptFile("main", [
      'var content = { stages: [{ id: "stage_1", name: "First", mobs: [',
      ' { wave: 1, delay_spawn: 20, next_wave_min_mob: 1, spawn: [',
      '  { type: i("pillager"), coordinates: "1 -2 3.5", event: "minecraft:ranged_mode", tag: "enemy" },',
      '  { type: "test:boss", position: {x: -4, y: 5, z: 6} },',
      '  ...dynamicSpawns',
      ' ], end_command: [{ command: "fill 1 2 3 air", delay: 0 }] },',
      ' { wave: 2, spawn: [{type: "test:boss", coordinates: "8 9 10"}] }',
      '] }] };',
    ].join("\n"), source);
    const stage = parsed.waveConfigurations?.[0];
    expect(parsed.waveConfigurations).toHaveLength(1);
    expect(stage?.id).toBe("stage_1");
    expect(stage?.waves).toHaveLength(2);
    expect(stage?.waves[0]).toMatchObject({
      number: 1, delaySpawn: 20, nextWaveMinMob: 1,
      recipeListIncomplete: true,
      endCommands: [{command:"fill 1 2 3 air",delay:0}],
    });
    expect(stage?.waves[0]?.recipes[0]).toMatchObject({
      typeExpression: 'i("pillager")',
      coordinates: {x:1,y:-2,z:3.5},
      event:"minecraft:ranged_mode",tag:"enemy",
    });
    expect(stage?.waves[0]?.recipes[1]).toMatchObject({
      typeId:"test:boss", coordinates:{x:-4,y:5,z:6},
    });
    expect(stage?.source.artifactId).toBe("selected");
    expect(stage?.waves[0]?.recipes[0]?.source.range?.columnStart).toBeGreaterThan(0);
    expect(parseScriptFile("other",
      'const ui = { level:"Level", wave:"Wave", stages: [] }',
      source).waveConfigurations).toHaveLength(0);
  });

  it("discovers independently authored mode catalogs without inventing waves", () => {
    const source = {
      artifactId: "selected-world",
      relativePath: "behavior_packs/demo/scripts/chunks/content.js",
    };
    const script = [
      'const modes = {',
      ' combat: Object.freeze({ gameplayId: "combat_trial", gameplayName: "Combat Trial", gameplayNumber: 1 }),',
      ' capture: Object.freeze({ gameplayId: "capture_run", gameplayName: "Capture Run", gameplayNumber: 5 }),',
      '};',
      'const menu = [',
      ' { gameplayId: "combat_trial", gameplayName: "Combat Trial" },',
      ' { gameplayId: "capture_run", gameplayName: "Capture Run" },',
      '];',
      'const independent = { modeId: "builder", modeName: "Builder", modeNumber: 2 };',
      'const dynamic = { gameplayId: requestedMode, gameplayName: "User selection" };',
      'const hud = { level: "Level", wave: "Wave" };',
    ].join("\n");
    const parsed = parseScriptFile("content", script, source);
    expect(parsed.waveConfigurations).toEqual([]);
    expect(parsed.authoredGameplayCatalog?.map(item => [
      item.kind, item.id, item.name, item.number,
    ])).toEqual([
      ["gameplay", "combat_trial", "Combat Trial", 1],
      ["mode", "builder", "Builder", 2],
      ["gameplay", "capture_run", "Capture Run", 5],
    ]);
    expect(parsed.authoredGameplayCatalog?.every(item =>
      item.source.artifactId === source.artifactId &&
      item.source.relativePath === source.relativePath &&
      item.source.range !== undefined)).toBe(true);
    expect(parsed.authoredGameplayCatalog?.some(item =>
      item.id === "User selection")).toBe(false);
  });

  it("retains content-choice categories for a building/guessing map with no wave structure", () => {
    const src = {artifactId:"world:builder",
      relativePath:"behavior_packs/example/scripts/game-content.js"};
    const parsed = parseScriptFile("game-content", [
      'export const PromptPool = [',
      ' { text: "Camera", difficulty: "easy" },',
      ' { text: "Cart", difficulty: "easy" },',
      ' { text: "Globe", difficulty: "medium" },',
      ' { text: choosePrompt(), difficulty: "hard" },',
      '];',
      'const decoration = [',
      ' { label: "Level", value: 1 },',
      ' { label: "Wave", value: 2 },',
      '];',
    ].join("\n"), src);
    expect(parsed.authoredContentCollections).toHaveLength(1);
    const pool = parsed.authoredContentCollections![0]!;
    expect(pool.name).toBe("PromptPool");
    expect(pool.textField).toBe("text");
    expect(pool.classificationField).toBe("difficulty");
    expect(pool.entries.map(entry => [entry.text,entry.classification]))
      .toEqual([["Camera","easy"],["Cart","easy"],["Globe","medium"]]);
    expect(pool.incomplete).toBe(true);
    expect(pool.entries[0]?.source.artifactId).toBe(src.artifactId);
    expect(pool.entries[0]?.source.range?.lineStart).toBe(2);
    expect(parsed.waveConfigurations).toEqual([]);
    expect(parsed.authoredGameplayCatalog).toEqual([]);
  });

  it("retains source method property writes with exact branch context, not score settlement", () => {
    const src = {artifactId:"world:guess",
      relativePath:"behavior_packs/demo/scripts/score.js"};
    const parsed = parseScriptFile("score", [
      'class GuessGame {',
      '  addContribution(points) {',
      '    const player = this.state.players[id];',
      '    player.score += points;',
      '    player.scores_by_difficulty[this.state.difficulty] += points;',
      '  }',
      '  guess(correct) {',
      '    if (correct) this.state.players[id].score += 5;',
      '  }',
      '}',
    ].join("\n"), src);
    const writes = parsed.authoredPropertyMutations ?? [];
    expect(writes).toHaveLength(3);
    expect(writes.map(item => [
      item.executionRegion, item.targetExpression,
      item.operator,item.valueExpression,
    ])).toEqual([
      [expect.stringMatching(/^function:GuessGame\.addContribution@/),"player.score","+=","points"],
      [expect.stringMatching(/^function:GuessGame\.addContribution@/),
        "player.scores_by_difficulty[this.state.difficulty]","+=","points"],
      [expect.stringMatching(/^function:GuessGame\.guess@/),"this.state.players[id].score","+=","5"],
    ]);
    expect(writes[2]?.lexicalGuards?.some(g =>
      g.conditionText === "correct" && g.branch === "true")).toBe(true);
    expect(writes[0]?.source.range?.lineStart).toBe(4);
    expect(writes.every(write => write.source.artifactId === "world:guess"))
      .toBe(true);
  });

  it("retains authored class Map set/get keys and same-block const constructor candidate", () => {
    const artifactId="map:session";
    const parsed=parseScriptFile("arena",[
      'import { Session } from "./session.js";',
      'export class Arena {',
      ' constructor(){ this.sessions = new Map(); }',
      ' boot(){',
      '   for(const a of this.definitions){',
      '     const game = new Session(this,a);',
      '     this.sessions.set(a.id,game);',
      '   }',
      ' }',
      ' use(player){ return this.sessions.get(this.membership(player.id)); }',
      '}',
    ].join("\n"),{
      artifactId,relativePath:"behavior_packs/demo/scripts/arena.js",
    });
    expect(parsed.sourceClassMaps).toHaveLength(1);
    expect(parsed.sourceClassMaps?.[0]).toMatchObject({
      className:"Arena",fieldName:"sessions",
    });
    const operations=parsed.sourceClassMapAccesses ?? [];
    expect(operations).toHaveLength(2);
    expect(operations[0]).toMatchObject({
      operation:"set",keyExpression:"a.id",valueExpression:"game",
      constructorName:"Session",executionRegion:expect.stringMatching(/^function:Arena\.boot@/),
    });
    expect(operations[0]?.constructorSource?.range?.lineStart).toBe(6);
    expect(operations[1]).toMatchObject({
      operation:"get",keyExpression:"this.membership(player.id)",
      executionRegion:expect.stringMatching(/^function:Arena\.use@/),
    });
    expect(operations[1]?.constructorName).toBeUndefined();
  });

  it("rejects unsafe Map ownership when a source field is reassigned", () => {
    const source={
      artifactId:"map:replaced",
      relativePath:"behavior_packs/demo/scripts/owner.js",
    };
    const parsed=parseScriptFile("owner",[
      'class Arena {',
      ' constructor(){ this.sessions = new Map(); }',
      ' reset(){ this["sessions"] = replacement; }',
      ' boot(){ this.sessions.set("x",game); }',
      ' use(){ return this.sessions.get("x"); }',
      '}',
    ].join("\n"),source);
    expect(parsed.sourceClassMaps).toEqual([]);
    expect(parsed.sourceClassMapAccesses).toEqual([]);
  });

  it("retains bundled top-level class expressions as class-owned source methods", () => {
    const src = {artifactId: "selected", relativePath: "behavior_packs/demo/scripts/chunks/logic.js"};
    const parsed = parseScriptFile("logic", [
      'var PartyService = class {',
      '  static init() { return true; }',
      '  static reset() { return false; }',
      '};',
      'var DatabaseService = class {',
      '  static init() { return 1; }',
      '};',
      'export { PartyService };',
    ].join("\n"), src);
    const methods = parsed.sourceClassMethods ?? [];
    expect(methods).toEqual(expect.arrayContaining([
      expect.objectContaining({className: "PartyService", methodName: "init", exported: true}),
      expect.objectContaining({className: "PartyService", methodName: "reset", exported: true}),
      expect.objectContaining({className: "DatabaseService", methodName: "init", exported: false}),
    ]));
    const regions = (parsed.controlFlowRegions ?? []).map(item => item.region);
    expect(regions).toEqual(expect.arrayContaining([
      expect.stringMatching(/^function:PartyService\.init@/),
      expect.stringMatching(/^function:DatabaseService\.init@/),
    ]));
    expect(new Set(regions).size).toBe(regions.length);
    for (const method of methods) {
      const start = method.source.range;
      expect(start?.columnStart).toBeGreaterThan(0);
      const expected = "function:" + method.className + "." + method.methodName +
        "@" + start!.lineStart + ":" + start!.columnStart;
      expect(regions).toContain(expected);
    }
  });

  it("recognizes a bundled class Map owner without equating the keys or instance identities", () => {
    const parsed = parseScriptFile("sessions", [
      'var Sessions = class {',
      '  constructor() { this.parties = new Map(); }',
      '  store(id, party) { this.parties.set(id, party); }',
      '  find(id) { return this.parties.get(id); }',
      '};',
      'export { Sessions };',
    ].join("\n"), {
      artifactId: "selected",
      relativePath: "behavior_packs/demo/scripts/chunks/sessions.js",
    });
    expect(parsed.sourceClassMaps).toEqual([
      expect.objectContaining({className: "Sessions", fieldName: "parties"}),
    ]);
    expect(parsed.sourceClassMapAccesses).toEqual(expect.arrayContaining([
      expect.objectContaining({
        operation: "set", className: "Sessions",
        executionRegion: expect.stringMatching(/^function:Sessions\.store@/),
      }),
      expect.objectContaining({
        operation: "get", className: "Sessions",
        executionRegion: expect.stringMatching(/^function:Sessions\.find@/),
      }),
    ]));
  });

  it("rejects duplicated top-level class bindings as unique class owners", () => {
    const parsed = parseScriptFile("duplicates", [
      'var Service = class { static init() {} };',
      'var Service = class { static init() {} };',
      'export { Service };',
    ].join("\n"), {
      artifactId: "selected", relativePath: "behavior_packs/demo/scripts/duplicate.js",
    });
    expect(parsed.sourceClassMethods?.filter(item => item.className === "Service")).toEqual([]);
  });

});
