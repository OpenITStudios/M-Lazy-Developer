import { describe, expect, it } from "vitest";
import { parseScriptFile } from "../../../src/parser/parse.js";

describe("chunk lifecycle evidence", () => {
  const source = {
    artifactId: "fixture",
    relativePath: "behavior_packs/demo/scripts/main.ts",
  };

  it("uses imported Bedrock events and retains other chunk evidence", () => {
    const parsed = parseScriptFile("main", [
      'import { world as w, system } from "@minecraft/server";',
      'w.afterEvents.worldLoad.subscribe(() => {});',
      'w.afterEvents.entityLoad.subscribe(() => {});',
      'w.afterEvents.entityRemove.subscribe(() => {});',
      'w.afterEvents.entityDie.subscribe(() => {});',
      'system.beforeEvents.shutdown.subscribe(() => {});',
      'function check(dimension, manager, options) {',
      '  dimension.isChunkLoaded({ x: 0, y: 0, z: 0 });',
      '  manager.hasCapacity(options);',
      '  manager.createTickingArea("lease-1", options);',
      '  manager.removeTickingArea("lease-1");',
      '  if (area.isFullyLoaded) return;',
      '}',
    ].join("\n"), source);
    expect((parsed.chunkLifecycleEvidence ?? []).map(item => item.kind))
      .toEqual(expect.arrayContaining([
        "world-load-subscription",
        "entity-load-subscription",
        "entity-remove-subscription",
        "entity-die-subscription",
        "shutdown-subscription",
        "chunk-readiness-probe",
        "ticking-area-acquire",
        "ticking-area-release",
        "ticking-area-capacity-check",
        "ticking-area-readiness-state",
      ]));
  });

  it("does not mistake an unrelated JavaScript emitter for Minecraft", () => {
    const parsed = parseScriptFile("lookalike", [
      'const world = { afterEvents: { entityRemove: { subscribe(fn) {} }, entityDie: { subscribe(fn) {} } } };',
      'world.afterEvents.entityRemove.subscribe(() => {});',
      'world.afterEvents.entityDie.subscribe(() => {});',
    ].join("\n"), source);
    expect((parsed.chunkLifecycleEvidence ?? [])
      .filter(item => item.kind === "entity-remove-subscription" ||
                      item.kind === "entity-die-subscription")).toEqual([]);
  });
});
