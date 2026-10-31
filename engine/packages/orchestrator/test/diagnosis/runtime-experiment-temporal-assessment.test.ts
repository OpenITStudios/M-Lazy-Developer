import { describe, expect, it } from "vitest";
import {
  assessRuntimeExperimentTemporalTrials,
} from "../../src/index.js";
import {
  createNestedSystemRunOrderingExperiment,
  runtimeExperimentDefinitionRevision,
  type RuntimeExperimentTrial,
} from "../../../runtime-lab/src/index.js";

const plan = createNestedSystemRunOrderingExperiment({
  id: "exp:scheduler-ordering",
  title: "Nested system.run ordering",
  targetProfileFingerprint: "profile-a",
  fixtureFingerprint: "fixture-a",
  objectiveId: "scheduler_ordering",
  participant: "trial_complete",
});

function trial(
  id: string,
  armId: "control" | "treatment",
  originTick: number,
  callbackTick: number,
): RuntimeExperimentTrial {
  return {
    schemaVersion: 1,
    id,
    identity: {
      experimentId: plan.definition.id,
      definitionRevision:
        runtimeExperimentDefinitionRevision(
          plan.definition,
        ),
      armId,
      runIndex: 0,
      targetProfileFingerprint: "profile-a",
      fixtureFingerprint: "fixture-a",
      environmentFingerprint: "env-a",
    },
    status: "completed",
    evidence: [{
      predicate: "scheduler-origin-marker",
      state: "present",
      confidence: "observed",
      observedAt: {
        streamId: "scheduler",
        sequence: 10,
        tick: originTick,
      },
    }, {
      predicate: "scheduler-callback-marker",
      state: "present",
      confidence: "observed",
      observedAt: {
        streamId: "scheduler",
        sequence: 11,
        tick: callbackTick,
      },
    }, {
      predicate: "scheduler-ordering-trial-complete",
      state: "present",
      confidence: "observed",
      observedAt: {
        streamId: "scheduler",
        sequence: 12,
        tick: callbackTick,
      },
    }],
  };
}

describe("runtime experiment temporal assessment", () => {
  it("applies each arm's own minimum tick separation contract", () => {
    const result =
      assessRuntimeExperimentTemporalTrials(
        plan.definition.id,
        [
          trial("control-pass", "control", 100, 101),
          trial("treatment-fail", "treatment", 100, 101),
          trial("treatment-pass", "treatment", 100, 102),
        ],
        plan.temporalRequirementsByArm,
        true,
      );

    expect(
      result.find(
        (item) => item.trialId === "control-pass",
      )?.passed,
    ).toBe(true);

    expect(
      result.find(
        (item) => item.trialId === "treatment-fail",
      )?.passed,
    ).toBe(false);

    expect(
      result.find(
        (item) => item.trialId === "treatment-pass",
      )?.passed,
    ).toBe(true);
  });

  it("fails closed when timeline continuity is incomplete and ordering cannot be proven", () => {
    const incomplete = trial(
      "control-incomplete",
      "control",
      100,
      101,
    );
    incomplete.evidence[1]!.observedAt = {
      streamId: "different-stream",
      sequence: 11,
    };

    const result =
      assessRuntimeExperimentTemporalTrials(
        plan.definition.id,
        [incomplete],
        plan.temporalRequirementsByArm,
        false,
      );

    expect(result[0]?.passed).toBe(false);
    expect(
      result[0]?.assessments[0]?.status,
    ).toBe("evidence-incomplete");
  });
});
