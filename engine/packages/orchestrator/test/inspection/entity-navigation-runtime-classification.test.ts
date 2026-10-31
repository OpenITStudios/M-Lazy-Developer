// Same-directory feature/lane test consolidation, original cases kept in lexical blocks.
import { describe, expect, it } from "vitest";
import { entityAiNavigationDiagnostics } from "../../src/inspection/entity-ai-navigation-diagnostics.js";
import { classifyEntityNavigationRuntimeExperiment } from "../../src/inspection/entity-navigation-runtime-classification.js";
import { parseRouteNavigationEnvironmentContracts } from "../../src/inspection/route-navigation-environment-load.js";
import { analyzeRouteNavigationEnvironments } from "../../src/inspection/route-navigation-environment-analysis.js";

// Original engine/packages/orchestrator/test/inspection/entity-navigation-runtime-classification.test.ts; SHA 0b5bdcb9b9405747f21f15ac36a54e4935e42143
{
// Cohesive source test family; same owner, feature, execution lane.

// Original source suite: engine/packages/orchestrator/test/inspection/entity-ai-navigation-diagnostics.test.ts (Git blob 456b3bdd656bb3847a1e38c475ad17b5bc270d17)
{


describe("entity AI navigation diagnostics", () => {
  it("uses medium severity for missing targeted navigation", () => {
    const findings =
      entityAiNavigationDiagnostics(
        {
          entities: 1,
          states: 1,
          targetedStates: 1,
          targetedStackComplete: 0,
          targetedStackIncomplete: 1,
          navigationWithoutMovement: 0,
          targetedWithoutNavigation: 1,
          movementGoalWithoutNavigation: 0,
          goalPriorityConflictStates: 0,
          assessments: [],
        },
        {
          contracts: 0,
          assessments: [],
          compatible: 0,
          incompatible: 0,
          stateDependent: 0,
          unresolved: 0,
        },
      );

    expect(findings[0]).toMatchObject({
      code:
        "ENTITY_AI_NAVIGATION_COVERAGE_GAP",
      severity: "medium",
    });
  });

  it("uses minor severity when route compatibility is only state-dependent", () => {
    const findings =
      entityAiNavigationDiagnostics(
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
          assessments: [],
        },
        {
          contracts: 1,
          assessments: [],
          compatible: 0,
          incompatible: 0,
          stateDependent: 1,
          unresolved: 0,
        },
      );

    expect(findings[0]).toMatchObject({
      severity: "minor",
    });
  });
});
}

// Original source suite: engine/packages/orchestrator/test/inspection/entity-navigation-runtime-classification.test.ts (Git blob 6942689b2b6887d7546989aa7f90bc0d9f7b24b6)
{


describe("entity navigation runtime classification", () => {
  it("classifies intervention-supported crowding contrast as dynamic congestion", () => {
    const result =
      classifyEntityNavigationRuntimeExperiment({
        experimentId: "crowding",
        qualificationState:
          "intervention-supported",
        observations: [],
        predicates: [{
          predicate:
            "navigation-stall-observed",
          observation: {
            predicate:
              "navigation-stall-observed",
            state: "unknown",
            evidenceId: "aggregate",
          },
          ceiling:
            "intervention-supported",
          sourceEvidenceIds: [
            "e:control",
            "e:treatment",
          ],
          interventionContrast: true,
          expectedContrastDisposition:
            "matched",
          observedContrast: {
            controlState: "absent",
            treatmentState: "present",
          },
        }],
      });

    expect(result).toMatchObject({
      kind: "crowding",
      disposition:
        "dynamic-congestion-supported",
    });
  });

  it("classifies intervention-supported recovery contrast as effective", () => {
    const result =
      classifyEntityNavigationRuntimeExperiment({
        experimentId: "recovery",
        qualificationState:
          "intervention-supported",
        observations: [],
        predicates: [{
          predicate:
            "movement-resumed-after-recovery",
          observation: {
            predicate:
              "movement-resumed-after-recovery",
            state: "unknown",
            evidenceId: "aggregate",
          },
          ceiling:
            "intervention-supported",
          sourceEvidenceIds: [
            "e:control",
            "e:treatment",
          ],
          interventionContrast: true,
          expectedContrastDisposition:
            "matched",
          observedContrast: {
            controlState: "absent",
            treatmentState: "present",
          },
        }],
      });

    expect(result).toMatchObject({
      kind: "recovery",
      disposition: "recovery-effective",
    });
  });

  it("fails closed on expected contrast mismatch", () => {
    const result =
      classifyEntityNavigationRuntimeExperiment({
        experimentId: "recovery",
        qualificationState: "repeatable",
        observations: [],
        predicates: [{
          predicate:
            "movement-resumed-after-recovery",
          observation: {
            predicate:
              "movement-resumed-after-recovery",
            state: "present",
            evidenceId: "aggregate",
          },
          ceiling: "repeatable",
          sourceEvidenceIds: [
            "e:recovery",
          ],
          interventionContrast: false,
          expectedContrastDisposition:
            "mismatched",
        }],
      });

    expect(result.disposition)
      .toBe("contrast-mismatch");
  });
});
}
}

// Original engine/packages/orchestrator/test/inspection/route-navigation-environment-analysis.test.ts; SHA 007f1b0ec17c5a30af71bd9d115a42fb50ee5886
{
// Source-preserving family consolidation: original suites and assertions retained in separate lexical scopes.

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
}
