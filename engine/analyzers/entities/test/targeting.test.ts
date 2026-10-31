import { describe, expect, it } from "vitest";
import { extractTargetingSemantics } from "../src/targeting.js";

describe("entity targeting semantics", () => {
  it("extracts target families and acquisition constraints", () => {
    const result = extractTargetingSemantics({
      id: "hostile",
      activeComponents: ["minecraft:behavior.nearest_attackable_target"],
      activeComponentData: {
        "minecraft:behavior.nearest_attackable_target": {
          must_see: true,
          must_reach: true,
          within_radius: 24,
          reselect_targets: true,
          entity_types: [{
            filters: {
              any_of: [
                { test: "is_family", subject: "other", value: "player" },
                { test: "is_family", subject: "other", value: "irongolem" },
              ],
            },
            max_dist: 32,
          }],
        },
      },
      activeGroups: [],
    });

    expect(result[0]).toMatchObject({
      configuredTargetTypes: 1,
      families: ["irongolem", "player"],
      mustSee: true,
      mustReach: true,
      withinRadius: 24,
      reselectTargets: true,
    });
    expect(result[0]?.capabilities).toEqual(expect.arrayContaining([
      "targeting:configured-entity-types",
      "targeting:provider",
      "targeting:family:player",
    ]));
  });

  it("does not claim a configured target provider when entity_types is empty", () => {
    const result = extractTargetingSemantics({
      id: "empty",
      activeComponents: ["minecraft:behavior.nearest_attackable_target"],
      activeComponentData: {
        "minecraft:behavior.nearest_attackable_target": {},
      },
      activeGroups: [],
    });

    expect(result[0]?.configuredTargetTypes).toBe(0);
    expect(result[0]?.capabilities).not.toContain("targeting:configured-entity-types");
  });
});
