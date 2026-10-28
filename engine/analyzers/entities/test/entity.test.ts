import { describe, expect, it } from "vitest";
import {
  deriveEntityStateGraph,
  parseEntityDefinition,
} from "../src/index.js";

describe("entity definition analysis", () => {
  it("extracts base components, groups and nested event mutations", () => {
    const parsed = parseEntityDefinition({
      format_version: "1.21.0",
      "minecraft:entity": {
        description: {
          identifier: "demo:zombie",
          runtime_identifier: "minecraft:zombie",
        },
        components: {
          "minecraft:health": { value: 20 },
        },
        component_groups: {
          "demo:hostile": {
            "minecraft:behavior.move_towards_target": { priority: 2 },
            "minecraft:behavior.nearest_attackable_target": { priority: 1 },
          },
        },
        events: {
          "demo:become_hostile": {
            sequence: [{
              add: { component_groups: ["demo:hostile"] },
            }, {
              trigger: "demo:announce",
            }],
          },
        },
      },
    }, {
      artifactId: "fixture",
      relativePath: "behavior_packs/demo/entities/zombie.json",
    });

    expect(parsed.identifier).toBe("demo:zombie");
    expect(parsed.runtimeIdentifier).toBe("minecraft:zombie");
    expect(parsed.baseComponents).toEqual(["minecraft:health"]);
    expect(parsed.componentGroups["demo:hostile"]).toEqual([
      "minecraft:behavior.move_towards_target",
      "minecraft:behavior.nearest_attackable_target",
    ]);
    expect(parsed.events["demo:become_hostile"]).toMatchObject({
      addGroups: ["demo:hostile"],
      triggerEvents: ["demo:announce"],
    });
  });

  it("derives separate possible states instead of merging unrelated groups", () => {
    const parsed = parseEntityDefinition({
      "minecraft:entity": {
        components: { "minecraft:health": {} },
        component_groups: {
          a: { "minecraft:behavior.move_towards_target": {} },
          b: { "minecraft:behavior.nearest_attackable_target": {} },
        },
        events: {
          enable_a: { add: { component_groups: ["a"] } },
        },
      },
    }, { artifactId: "fixture", relativePath: "entities/demo.json" });

    const graph = deriveEntityStateGraph(parsed);
    const stateA = graph.candidates.find((item) => item.id === "group:a");
    expect(stateA?.activeComponents).not.toContain(
      "minecraft:behavior.nearest_attackable_target",
    );
  });

  it("follows bounded local event triggers in order without merging incompatible branches", () => {
    const source = { artifactId: "fixture", relativePath: "entities/guards.json" };
    const parsed = parseEntityDefinition({ "minecraft:entity": {
      component_groups: {
        armed: { "minecraft:equipment": { table: "loot_tables/entities/armed.json" } },
        disabled: { "minecraft:loot": { table: "loot_tables/entities/disabled.json" } },
      },
      events: {
        "minecraft:entity_spawned": { trigger: "demo:arm" },
        "demo:arm": { sequence: [
          { add: { component_groups: ["armed"] } },
          { trigger: "demo:finalize" },
        ] },
        "demo:finalize": { remove: { component_groups: ["disabled"] } },
      },
    } }, source);
    const graph = deriveEntityStateGraph(parsed);
    const state = graph.candidates.find(item =>
      item.viaEvent === "minecraft:entity_spawned" && item.activeGroups.includes("armed"));
    expect(state?.sourceEventChain).toEqual([
      "minecraft:entity_spawned", "demo:arm", "demo:finalize",
    ]);
    expect(state?.activeGroups).toEqual(["armed"]);
    expect(state?.sourceEventPath).toEqual([
      "/minecraft:entity/events/minecraft:entity_spawned",
      "/minecraft:entity/events/demo:arm",
      "/minecraft:entity/events/demo:arm/sequence/0",
      "/minecraft:entity/events/demo:arm/sequence/1",
      "/minecraft:entity/events/demo:finalize",
    ]);
  });

  it("does not claim net group activation when a triggered event removes it", () => {
    const parsed = parseEntityDefinition({ "minecraft:entity": {
      component_groups: { armed: { "minecraft:equipment": {} } },
      events: {
        "minecraft:entity_spawned": { sequence: [
          { add: { component_groups: ["armed"] } },
          { trigger: "demo:disarm" },
        ] },
        "demo:disarm": { remove: { component_groups: ["armed"] } },
      },
    } }, { artifactId: "fixture", relativePath: "entities/disarm.json" });
    const states = deriveEntityStateGraph(parsed);
    expect(states.candidates.filter(state => state.viaEvent === "minecraft:entity_spawned"))
      .toEqual([]);
    expect(states.staticAnalysisLimits).toBeUndefined();
  });

  it("rejects cyclic, missing and unsupported local triggers without inventing net activation", () => {
    const source = { artifactId: "fixture", relativePath: "entities/guards.json" };
    const parsed = parseEntityDefinition({ "minecraft:entity": {
      component_groups: { armed: { "minecraft:equipment": {} } },
      events: {
        rootCycle: { sequence: [
          { add: { component_groups: ["armed"] } }, { trigger: "cycle" },
        ] },
        cycle: { trigger: "rootCycle" },
        rootMissing: { sequence: [
          { add: { component_groups: ["armed"] } }, { trigger: "missing" },
        ] },
        rootUnsupported: { sequence: [
          { add: { component_groups: ["armed"] } }, { filters: { invalid: true }, trigger: { target: "other", event: "unknown" } },
        ] },
      },
    } }, source);
    const graph = deriveEntityStateGraph(parsed);
    expect(graph.candidates.filter(x => x.viaEvent?.startsWith("root"))).toEqual([]);
    expect(graph.staticAnalysisLimits).toEqual(expect.arrayContaining([
      expect.stringContaining("rootCycle:"),
      expect.stringContaining("rootMissing:"),
      expect.stringContaining("rootUnsupported:"),
    ]));
  });

});
