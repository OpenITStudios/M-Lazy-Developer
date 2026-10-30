// Consolidated same-owner, same-feature, same-lane test family.
// Original cases/assertions preserved; this is NOT executed test proof.
import { describe, expect, it } from "vitest";
import { extractEntityAiStackSemantics } from "../src/ai-stack.js";
import { assessEntityBehaviorPrerequisites } from "../src/behavior-prerequisites.js";
import { extractRideableSemantics, parseEntityDefinition } from "../src/index.js";

// Original suite: engine/analyzers/entities/test/ai-stack.test.ts (Git blob f575abee27e3008cab5115e18f4f22b1edfc32ff)
{


describe("entity AI stack semantics", () => {
  it("summarizes movement, navigation, targeting, attack, and movement-goal candidates", () => {
    const result =
      extractEntityAiStackSemantics({
        id: "combat",
        activeComponents: [
          "minecraft:movement",
          "minecraft:navigation.walk",
          "minecraft:behavior.nearest_attackable_target",
          "minecraft:behavior.melee_attack",
        ],
        activeComponentData: {
          "minecraft:movement": {
            value: 0.25,
          },
          "minecraft:navigation.walk": {
            can_walk: true,
          },
          "minecraft:behavior.nearest_attackable_target": {
            priority: 1,
            entity_types: [
              {
                filters: {
                  test: "is_family",
                  value: "player",
                },
              },
            ],
          },
          "minecraft:behavior.melee_attack": {
            priority: 2,
            track_target: true,
          },
        },
        activeGroups: [],
      });

    expect(result.staticSignals).toEqual({
      movementPresent: true,
      navigationPresent: true,
      targetingProviderPresent: true,
      attackBehaviorPresent: true,
      movementGoalCandidatePresent: true,
    });
    expect(
      result.movementGoalCandidates,
    ).toContain(
      "minecraft:behavior.melee_attack",
    );
    expect(
      result.goals.find(
        (goal) =>
          goal.component ===
          "minecraft:behavior.melee_attack",
      )?.priority,
    ).toBe(2);
  });

  it("does not invent target or movement-goal readiness when those surfaces are absent", () => {
    const result =
      extractEntityAiStackSemantics({
        id: "navigation-only",
        activeComponents: [
          "minecraft:movement",
          "minecraft:navigation.walk",
        ],
        activeComponentData: {
          "minecraft:movement": {
            value: 0.2,
          },
          "minecraft:navigation.walk": {},
        },
        activeGroups: [],
      });

    expect(
      result.staticSignals
        .targetingProviderPresent,
    ).toBe(false);
    expect(
      result.staticSignals
        .movementGoalCandidatePresent,
    ).toBe(false);
  });
});
}

// Original suite: engine/analyzers/entities/test/behavior-prerequisites.test.ts (Git blob 944b45b5f2a8e778939e2fcece5358c86aa1923b)
{


describe("entity behavior prerequisites", () => {
  it("reports missing ranged shooter and melee damage components", () => {
    const result = assessEntityBehaviorPrerequisites({
      id: "combat",
      activeComponents: [
        "minecraft:behavior.ranged_attack",
        "minecraft:behavior.melee_attack",
      ],
      activeComponentData: {
        "minecraft:behavior.ranged_attack": {},
        "minecraft:behavior.melee_attack": {},
      },
      activeGroups: [],
    });

    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({
        behavior: "minecraft:behavior.ranged_attack",
        status: "missing-prerequisite",
        missing: ["minecraft:shooter"],
      }),
      expect.objectContaining({
        behavior: "minecraft:behavior.melee_attack",
        status: "missing-prerequisite",
        missing: ["minecraft:attack"],
      }),
    ]));
  });

  it("checks door pathing and stalk/pounce target prerequisites", () => {
    const result = assessEntityBehaviorPrerequisites({
      id: "movement",
      activeComponents: [
        "minecraft:navigation.walk",
        "minecraft:behavior.open_door",
        "minecraft:behavior.stalk_and_pounce_on_target",
        "minecraft:attack",
      ],
      activeComponentData: {
        "minecraft:navigation.walk": { can_pass_doors: false },
        "minecraft:behavior.open_door": {},
        "minecraft:behavior.stalk_and_pounce_on_target": {},
        "minecraft:attack": { damage: 4 },
      },
      activeGroups: [],
    });

    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({
        behavior: "minecraft:behavior.open_door",
        missing: ["navigation:path-through-doors"],
      }),
      expect.objectContaining({
        behavior: "minecraft:behavior.stalk_and_pounce_on_target",
        missing: ["target-acquisition"],
      }),
    ]));
  });
});
}

// Original suite: engine/analyzers/entities/test/mounts.test.ts (Git blob 273a596108a5d0a58926932a23131e3c5b6adaf2)
{


describe("rideable semantics", () => {
  it("keeps seat, control and dismount semantics state-scoped", () => {
    const entity = parseEntityDefinition({
      "minecraft:entity": {
        description: { identifier: "demo:vehicle" },
        component_groups: {
          mounted: {
            "minecraft:rideable": {
              seat_count: 2,
              dismount_mode: "on_top_center",
              family_types: ["player"],
              seats: [
                { controlling_seat: true },
                { controlling_seat: false },
              ],
            },
          },
        },
      },
    }, { artifactId: "fixture", relativePath: "entities/vehicle.json" });
    expect(extractRideableSemantics(entity)).toEqual([
      expect.objectContaining({
        entityIdentifier: "demo:vehicle",
        stateId: "group:mounted",
        seatCount: 2,
        declaredSeats: 2,
        controllingSeats: [0],
        dismountMode: "on_top_center",
        riderFamilies: ["player"],
      }),
    ]);
  });
});
}
