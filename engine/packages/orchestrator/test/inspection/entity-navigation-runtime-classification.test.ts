// Cohesive source test family; same owner, feature, execution lane.
import { describe, expect, it } from "vitest";
import { entityAiNavigationDiagnostics } from "../../src/inspection/entity-ai-navigation-diagnostics.js";
import { classifyEntityNavigationRuntimeExperiment } from "../../src/inspection/entity-navigation-runtime-classification.js";

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
