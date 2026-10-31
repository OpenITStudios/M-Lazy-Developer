import { describe, expect, it } from "vitest";
import {
  SCHEDULER_GENERATION_CAPABILITY_REGISTRY,
  createStaleGenerationCallbackExperiment,
  experimentQualificationCausalProof,
  preflightRuntimeExperimentCapabilities,
  qualifyRuntimeExperiment,
  runtimeExperimentDefinitionRevision,
  validateRuntimeActionCapabilityRegistry,
  validateRuntimeExperimentDefinition,
  type RuntimeExperimentTrial,
} from "../../../src/index.js";

const definition =
  createStaleGenerationCallbackExperiment({
    id: "exp:scheduler-stale-generation",
    title: "Stale scheduler callback generation ownership",
    targetProfileFingerprint: "profile-a",
    fixtureFingerprint: "fixture-a",
    objectiveId: "scheduler_test",
    participant: "stale_callback_count",
  });

function trial(
  id: string,
  armId: string,
  runIndex: number,
  state: "present" | "absent",
): RuntimeExperimentTrial {
  return {
    schemaVersion: 1,
    id,
    identity: {
      experimentId: definition.id,
      definitionRevision:
        runtimeExperimentDefinitionRevision(definition),
      armId,
      runIndex,
      targetProfileFingerprint:
        definition.targetProfileFingerprint,
      fixtureFingerprint:
        definition.fixtureFingerprint,
      environmentFingerprint: "env-a",
    },
    status: "completed",
    evidence: [{
      predicate: "stale-callback-observed",
      state,
      confidence: "observed",
      observedAt: {
        streamId: "scheduler-test",
        sequence: 10 + runIndex,
        tick: 100 + runIndex,
      },
    }],
  };
}

describe("scheduler generation experiment", () => {
  it("defines a valid guarded stale-generation experiment with cleanup", () => {
    expect(
      validateRuntimeExperimentDefinition(definition),
    ).toEqual([]);
    expect(definition.domain).toBe("scheduler");
    expect(definition.protocol.map((step) => [
      step.phase,
      step.actionId,
    ])).toEqual([
      ["setup", "scheduler.reset-generation-fixture"],
      ["stimulus", "scheduler.schedule-generation-callback"],
      ["stimulus", "scheduler.advance-generation"],
      ["stimulus", "scheduler.advance-runtime-ticks"],
      ["observe", "probe.scoreboard-value"],
      ["teardown", "scheduler.cancel-fixture-work"],
    ]);
    expect(definition.expectedContrasts).toEqual([{
      predicateId: "stale-callback-observed",
      controlState: "absent",
      treatmentState: "present",
    }]);
  });

  it("publishes a valid scheduler capability contract and passes preflight", () => {
    expect(
      validateRuntimeActionCapabilityRegistry(
        SCHEDULER_GENERATION_CAPABILITY_REGISTRY,
      ),
    ).toEqual([]);

    const preflight =
      preflightRuntimeExperimentCapabilities(
        definition,
        SCHEDULER_GENERATION_CAPABILITY_REGISTRY,
        "LIVE_MINECRAFT",
      );

    expect(preflight.ready).toBe(true);
    expect(preflight.missingActionIds).toEqual([]);
    expect(preflight.validationErrors).toEqual([]);
  });

  it("fails closed when generation replacement capability is unavailable", () => {
    const incomplete = {
      schemaVersion: 1 as const,
      actions:
        SCHEDULER_GENERATION_CAPABILITY_REGISTRY.actions
          .filter(
            (action) =>
              action.id !==
                "scheduler.advance-generation",
          ),
    };

    const preflight =
      preflightRuntimeExperimentCapabilities(
        definition,
        incomplete,
        "LIVE_MINECRAFT",
      );

    expect(preflight.ready).toBe(false);
    expect(preflight.missingActionIds).toEqual([
      "scheduler.advance-generation",
    ]);
  });

  it("promotes repeatable stale-generation contrast to exact causal provenance", () => {
    const qualification = qualifyRuntimeExperiment(
      definition,
      [
        trial("c0", "control", 0, "absent"),
        trial("c1", "control", 1, "absent"),
        trial("t0", "treatment", 0, "present"),
        trial("t1", "treatment", 1, "present"),
      ],
    );

    expect(qualification).toMatchObject({
      state: "intervention-supported",
      expectedContrastMatches: [
        "stale-callback-observed",
      ],
      expectedContrastMismatches: [],
    });

    const proof = experimentQualificationCausalProof(
      qualification,
      definition,
    );

    expect(proof.interventionProvenance).toEqual([
      expect.objectContaining({
        interventionId: definition.id,
        predicateId: "stale-callback-observed",
        controlledFactorIds: [
          "generation-guard-enabled",
        ],
        controlledFactorContrasts: [{
          factorId: "generation-guard-enabled",
          controlValue: true,
          treatmentValue: false,
        }],
        controlState: "absent",
        treatmentState: "present",
        expectedContrastDisposition: "matched",
      }),
    ]);
  });
});
