import { describe, expect, it } from "vitest";
import { deriveScriptCleanupResourceEvidence } from "../../../src/domains/cleanup/cleanup-resource-evidence.js";
import { parseScriptFile } from "../../../src/index.js";

const source = {
  artifactId: "fixture",
  relativePath: "scripts/main.ts",
};

describe("script cleanup resource evidence", () => {
  it("retains source evidence for async reset exceptions and partial results", () => {
    const code = [
      "const ResetMapService = class {",
      "  static processChunksOverTime() {",
      "    const result = { processedChunks: 0, skippedChunks: [] };",
      "    try { result.processedChunks++; } catch (e) { result.skippedChunks.push(e); }",
      "    return result;",
      "  }",
      "  static waitForReset(job) { return job.promise.catch(() => {}); }",
      "};",
      "const GameManager = class {",
      "  static resetArenaPlacedBlocks() {",
      "    try { return ResetMapService.resetMap(); }",
      "    catch (e) { console.warn(e); return Promise.resolve(); }",
      "  }",
      "  static trackArenaCleanup(resetPromise) {",
      "    return Promise.resolve(resetPromise).catch(e => { console.warn(e); }).then(() => {});",
      "  }",
      "  static safeReset(p) { return p.catch(e => { throw e; }); }",
      "  static endGame(id) {",
      "    this.saveSession(id, { status: 'idle' });",
      "    return this.trackArenaCleanup(this.resetArenaPlacedBlocks());",
      "  }",
      "};",
    ].join("\n");
    const parsed = parseScriptFile("reset", code, source);
    const found = parsed.arenaResetCompletionEvidence ?? [];
    expect(found.filter(item => item.kind ===
      "reset-error-swallowed-candidate").length).toBeGreaterThan(0);
    expect(found.some(item => item.kind ===
      "partial-reset-result-candidate")).toBe(true);
    expect(found.some(item => item.kind ===
      "idle-before-cleanup-settlement-candidate")).toBe(true);
    expect(found.some(item => item.executionRegion.includes("safeReset@"))).toBe(false);
    expect(found.every(item =>
      item.source.relativePath === "scripts/main.ts" &&
      item.source.range?.lineStart !== undefined)).toBe(true);
  });

  it("extracts exact tag effect scoreboard and timer inverse keys", () => {
    const result =
      deriveScriptCleanupResourceEvidence(
        [
          "function start(player, objective, system) {",
          "  player.addTag('playing');",
          "  player.addEffect('speed', 20);",
          "  objective.setScore(player, 1);",
          "  const timer = system.runTimeout(() => {}, 20);",
          "}",
          "function cleanup(player, objective, system, timer) {",
          "  player.removeTag('playing');",
          "  player.removeEffect('speed');",
          "  objective.removeParticipant(player);",
          "  system.clearRun(timer);",
          "}",
        ].join("\n"),
        source,
      );

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          surface: "tag",
          action: "acquire",
          key: "player:playing",
          precision: "exact",
        }),
        expect.objectContaining({
          surface: "tag",
          action: "release",
          key: "player:playing",
          precision: "exact",
        }),
        expect.objectContaining({
          surface: "scoreboard",
          action: "release",
          key: "objective:player",
          precision: "exact",
        }),
        expect.objectContaining({
          surface: "deferred-callback",
          action: "acquire",
          key: "handle:timer",
          precision: "exact",
        }),
      ]),
    );
  });


  it("preserves exact resource branch arms, post-exit guards and callback boundaries", () => {
    const text = [
      "function reset(player, system, reject) {",
      '  if (reject) player.removeTag("playing");',
      '  else player.removeTag("ready");',
      '  if (reject) return { action: "abort" };',
      "  player.inputPermissions.movementEnabled = true;",
      '  if (!reject) system.runTimeout(() => player.removeTag("later"), 1);',
      "}",
    ].join("\n");
    const extracted = deriveScriptCleanupResourceEvidence(text, source);
    // Resource extraction owns the actions; the canonical parser supplies
    // conditional provenance by the exact AST range without guessing guards.
    expect(extracted.find(action => action.key === "player:playing")
      ?.lexicalGuards).toBeUndefined();
    const parsed = parseScriptFile("round", text, source);
    const actions = parsed.cleanupResourceEvidence ?? [];
    const playing = actions.find(action => action.key === "player:playing");
    const ready = actions.find(action => action.key === "player:ready");
    const permission = actions.find(action =>
      action.surface === "input-permission" && action.action === "release");
    const later = actions.find(action => action.key === "player:later");
    const timer = actions.find(action =>
      action.surface === "deferred-callback" && action.action === "acquire");
    expect(playing?.lexicalGuards?.map(guard => [guard.conditionText, guard.branch]))
      .toEqual([["reject", "true"]]);
    expect(ready?.lexicalGuards?.map(guard => [guard.conditionText, guard.branch]))
      .toEqual([["reject", "false"]]);
    expect(playing?.lexicalGuards?.[0]?.source.range?.lineStart).toBe(2);
    expect(ready?.lexicalGuards?.[0]?.source.range?.lineStart).toBe(2);
    expect(permission?.precedenceGuards?.map(guard =>
      [guard.conditionText, guard.branch, guard.source.range?.lineStart]))
      .toEqual([["reject", "false", 4]]);
    expect(timer?.lexicalGuards?.map(guard => [guard.conditionText, guard.branch]))
      .toEqual([["!reject", "true"]]);
    // The nested scheduled callback does not inherit the caller's guards.
    expect(later?.lexicalGuards ?? []).toEqual([]);
    expect(later?.precedenceGuards ?? []).toEqual([]);
    expect(later?.executionRegion).toMatch(/^callback@/);
    expect(playing?.precision).toBe("exact");
  });

  it("tracks exact rider relationship acquire and release", () => {
    const result = deriveScriptCleanupResourceEvidence(
      [
        "function start(rideable, player) { rideable.addRider(player); }",
        "function cleanup(rideable, player) { rideable.removeRider(player); }",
      ].join("\n"),
      source,
    );
    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ surface: "mount-relationship", action: "acquire", key: "rideable:player" }),
      expect.objectContaining({ surface: "mount-relationship", action: "release", key: "rideable:player" }),
    ]));
  });

  it("treats literal permission restoration as release evidence", () => {
    const result =
      deriveScriptCleanupResourceEvidence(
        [
          "function start(player) {",
          "  player.inputPermissions.movementEnabled = false;",
          "}",
          "function cleanup(player) {",
          "  player.inputPermissions.movementEnabled = true;",
          "}",
        ].join("\n"),
        source,
      );

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          surface: "input-permission",
          action: "acquire",
          precision: "exact",
        }),
        expect.objectContaining({
          surface: "input-permission",
          action: "release",
          precision: "exact",
        }),
      ]),
    );
  });
});
