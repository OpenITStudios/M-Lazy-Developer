// Source-preserving family consolidation: original suites and assertions retained in separate lexical scopes.
import { describe } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { parseRouteNavigationEnvironmentContracts } from "../../src/inspection/route-navigation-environment-load.js";
import { analyzeRouteNavigationEnvironments } from "../../src/inspection/route-navigation-environment-analysis.js";

// Original suite engine/packages/orchestrator/test/inspection/route-navigation-environment-load.test.ts, blob b6cb0e310d4439dd2b708946dd07908c61b901de
{



describe("route navigation environment loader", () => {
  it("parses explicit route capability requirements", () => {
    expect(
      parseRouteNavigationEnvironmentContracts({
        contracts: [{
          id: "bridge-zombie",
          routeId: "bridge",
          entityKeys: ["demo:zombie"],
          medium: "ground",
          doorRequirement: "open",
          requiresWalking: true,
          avoidDamageBlocksRequired: true,
        }],
      }),
    ).toEqual([{
      id: "bridge-zombie",
      routeId: "bridge",
      entityKeys: ["demo:zombie"],
      medium: "ground",
      doorRequirement: "open",
      requiresWalking: true,
      avoidDamageBlocksRequired: true,
    }]);
  });

  it("rejects invalid capability enums", () => {
    expect(() =>
      parseRouteNavigationEnvironmentContracts([
        {
          id: "invalid",
          routeId: "bridge",
          medium: "lava",
        },
      ]),
    ).toThrow(/invalid medium/);
  });

  it("rejects contradictory water traversal policy", () => {
    expect(() =>
      parseRouteNavigationEnvironmentContracts([
        {
          id: "water-conflict",
          routeId: "river",
          medium: "water",
          avoidWaterRequired: true,
        },
      ]),
    ).toThrow(/avoid-water requirement conflict/);
  });
});

}

// Original suite engine/packages/orchestrator/test/inspection/route-navigation-environment-analysis.test.ts, blob aad9e3ba4582d67a70cd09256c9c39268bc1e73e
{



describe("route navigation environment analysis", () => {
  it("marks route incompatible when all navigation states miss authored capability", () => {
    const result =
      analyzeRouteNavigationEnvironments(
        [{
          id: "water-route",
          routeId: "bridge",
          entityKeys: ["demo:zombie"],
          medium: "water",
          requiresSwimming: true,
        }],
        {
          entities: 1,
          states: 1,
          targetedStates: 1,
          targetedStackComplete: 1,
          targetedStackIncomplete: 0,
          navigationWithoutMovement: 0,
          targetedWithoutNavigation: 0,
          movementGoalWithoutNavigation: 0,
          goalPriorityConflictStates: 0,
          assessments: [{
            entityKey: "demo:zombie",
            stateId: "base",
            targeted: true,
            movementPresent: true,
            navigationPresent: true,
            movementGoalCandidatePresent: true,
            attackBehaviorPresent: true,
            movementGoalPriorities: [],
            duplicateMovementGoalPriorities: [],
            navigationCapabilities: [
              "navigation:walk",
            ],
            missingSurfaces: [],
            status:
              "targeted-stack-complete",
          }],
        },
      );

    expect(result.incompatible).toBe(1);
    expect(result.assessments[0]).toMatchObject({
      status: "incompatible",
      entityKey: "demo:zombie",
      routeId: "bridge",
    });
    expect(
      result.assessments[0]?.states[0]
        ?.missingCapabilities,
    ).toContain("navigation:swim");
  });

  it("keeps mixed state compatibility state-dependent", () => {
    const base = {
      entityKey: "demo:zombie",
      targeted: true,
      movementPresent: true,
      navigationPresent: true,
      movementGoalCandidatePresent: true,
      attackBehaviorPresent: true,
      missingSurfaces: [] as const,
      movementGoalPriorities: [],
      duplicateMovementGoalPriorities: [],
      status:
        "targeted-stack-complete" as const,
    };

    const result =
      analyzeRouteNavigationEnvironments(
        [{
          id: "door-route",
          routeId: "gate",
          entityKeys: ["demo:zombie"],
          doorRequirement: "open",
        }],
        {
          entities: 1,
          states: 2,
          targetedStates: 2,
          targetedStackComplete: 2,
          targetedStackIncomplete: 0,
          navigationWithoutMovement: 0,
          targetedWithoutNavigation: 0,
          movementGoalWithoutNavigation: 0,
          goalPriorityConflictStates: 0,
          assessments: [
            {
              ...base,
              stateId: "open-capable",
              navigationCapabilities: [
                "navigation:walk",
                "navigation:can-open-doors",
              ],
            },
            {
              ...base,
              stateId: "closed-only",
              navigationCapabilities: [
                "navigation:walk",
              ],
            },
          ],
        },
      );

    expect(result.stateDependent).toBe(1);
    expect(result.incompatible).toBe(0);
  });
});

}
