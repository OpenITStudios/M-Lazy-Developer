// Consolidated same-owner, same-feature, same-lane test family.
// Original cases/assertions preserved; this is NOT executed test proof.
import { describe, expect, it } from "vitest";
import { extractNavigationCapabilities } from "../src/navigation.js";
import { parseEntityDefinition } from "../src/parse.js";
import { analyzeEntityTransitionReachability } from "../src/reachability.js";

// Original suite: engine/analyzers/entities/test/navigation.test.ts (Git blob 81fbbb024117336f62e3a6ba7bb059bdc1f80ab9)
{


describe("entity navigation capabilities", () => {
  it("derives door and water capabilities from active navigation config", () => {
    const result = extractNavigationCapabilities({
      id: "fixture",
      activeComponents: ["minecraft:navigation.walk"],
      activeComponentData: {
        "minecraft:navigation.walk": {
          can_pass_doors: true,
          can_open_doors: true,
          can_break_doors: false,
          can_path_over_water: true,
          avoid_damage_blocks: true,
        },
      },
      activeGroups: [],
    });

    expect(result.capabilities).toEqual(expect.arrayContaining([
      "navigation:path-through-doors",
      "navigation:can-open-doors",
      "navigation:path-over-water",
      "navigation:avoid-damage-blocks",
    ]));
    expect(result.capabilities).not.toContain("navigation:can_break_doors");
  });
});
}

// Original suite: engine/analyzers/entities/test/reachability.test.ts (Git blob 4a873e489e45d535ad3a776f7d825290e94b0eba)
{


describe("entity transition reachability", () => {
  it("detects undefined sensor events and missing component groups", () => {
    const entity = parseEntityDefinition({
      "minecraft:entity": {
        component_groups: {
          hostile: { "minecraft:behavior.melee_attack": {} },
        },
        components: {
          "minecraft:environment_sensor": {
            triggers: [{ event: "demo:missing" }],
          },
        },
        events: {
          "demo:start": {
            add: { component_groups: ["missing_group"] },
            trigger: "demo:next",
          },
        },
      },
    }, { artifactId: "fixture", relativePath: "entities/demo.json" });

    const result = analyzeEntityTransitionReachability(entity);

    expect(result.undefinedSensorEvents).toEqual(["demo:missing"]);
    expect(result.undefinedTriggeredEvents).toEqual(["demo:next"]);
    expect(result.missingComponentGroups).toEqual([
      { event: "demo:start", group: "missing_group", operation: "add" },
    ]);
  });

  it("follows defined sensor-rooted event chains", () => {
    const entity = parseEntityDefinition({
      "minecraft:entity": {
        components: {
          "minecraft:environment_sensor": {
            triggers: [{ event: "demo:start" }],
          },
        },
        events: {
          "demo:start": { trigger: "demo:combat" },
          "demo:combat": {},
          "demo:external_only": {},
        },
      },
    }, { artifactId: "fixture", relativePath: "entities/demo.json" });

    const result = analyzeEntityTransitionReachability(entity);

    expect(result.reachableEvents).toEqual(["demo:combat", "demo:start"]);
    expect(result.internallyUnreachedEvents).toEqual(["demo:external_only"]);
    expect(result.unresolvedReachabilityEvents).toEqual(["demo:external_only"]);
  });

  it("separates external roots from unresolved reachability", () => {
    const entity = parseEntityDefinition({
      "minecraft:entity": {
        events: {
          "minecraft:entity_spawned": { trigger: "demo:spawn_ready" },
          "demo:spawn_ready": {},
          "demo:external": { trigger: "demo:external_next" },
          "demo:external_next": {},
          "demo:unknown": {},
        },
      },
    }, { artifactId: "fixture", relativePath: "entities/demo.json" });

    const result = analyzeEntityTransitionReachability(entity, {
      externalRootEvents: ["demo:external"],
    });

    expect(result.externalRootEvents).toEqual([
      "demo:external",
      "minecraft:entity_spawned",
    ]);
    expect(result.externallyReachableEvents).toEqual([
      "demo:external",
      "demo:external_next",
      "demo:spawn_ready",
      "minecraft:entity_spawned",
    ]);
    expect(result.unresolvedReachabilityEvents).toEqual(["demo:unknown"]);
  });
});
}
