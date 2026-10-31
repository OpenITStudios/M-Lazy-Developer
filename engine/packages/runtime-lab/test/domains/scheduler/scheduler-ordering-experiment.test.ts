import { describe, expect, it } from "vitest";
import {
  SCHEDULER_ORDERING_CAPABILITY_REGISTRY,
  createNestedSystemRunOrderingExperiment,
  preflightRuntimeExperimentCapabilities,
  validateRuntimeActionCapabilityRegistry,
  validateRuntimeExperimentDefinition,
  validateSchedulerOrderingTimelineEvidence,
} from "../../../src/index.js";

const plan = createNestedSystemRunOrderingExperiment({
  id: "exp:scheduler-ordering",
  title: "Nested system.run ordering",
  targetProfileFingerprint: "profile-a",
  fixtureFingerprint: "fixture-a",
  objectiveId: "scheduler_ordering",
  participant: "trial_complete",
});

describe("scheduler ordering experiment plan", () => {
  it("defines a valid guarded event-ordering experiment", () => {
    expect(
      validateRuntimeExperimentDefinition(plan.definition),
    ).toEqual([]);
    expect(plan.definition.domain).toBe("event-ordering");
    expect(plan.definition.arms).toEqual([
      expect.objectContaining({
        id: "control",
        factorValues: {
          "nesting-depth": 1,
        },
      }),
      expect.objectContaining({
        id: "treatment",
        factorValues: {
          "nesting-depth": 2,
        },
      }),
    ]);
  });

  it("requires stricter minimum tick separation for deeper nesting", () => {
    expect(
      plan.temporalRequirementsByArm.control,
    ).toEqual([
      expect.objectContaining({
        beforePredicate: "scheduler-origin-marker",
        afterPredicate: "scheduler-callback-marker",
        minTickDelta: 1,
      }),
    ]);
    expect(
      plan.temporalRequirementsByArm.treatment,
    ).toEqual([
      expect.objectContaining({
        beforePredicate: "scheduler-origin-marker",
        afterPredicate: "scheduler-callback-marker",
        minTickDelta: 2,
      }),
    ]);
  });

  it("publishes a valid capability contract and passes preflight", () => {
    expect(
      validateRuntimeActionCapabilityRegistry(
        SCHEDULER_ORDERING_CAPABILITY_REGISTRY,
      ),
    ).toEqual([]);

    const result = preflightRuntimeExperimentCapabilities(
      plan.definition,
      SCHEDULER_ORDERING_CAPABILITY_REGISTRY,
      "LIVE_MINECRAFT",
    );

    expect(result.ready).toBe(true);
    expect(result.missingActionIds).toEqual([]);
    expect(result.validationErrors).toEqual([]);
  });

  it("rejects timeline evidence without comparable runtime ordering metadata", () => {
    expect(
      validateSchedulerOrderingTimelineEvidence([
        {
          predicate: "scheduler-origin-marker",
          state: "present",
          confidence: "observed",
          observedAt: {
            tick: 10,
          },
        },
        {
          predicate: "scheduler-callback-marker",
          state: "present",
          confidence: "observed",
          observedAt: {
            tick: 11,
          },
        },
      ]).join(" "),
    ).toMatch(/stream|sequence/i);
  });

  it("accepts timeline evidence only when markers share a comparable stream with explicit tick and sequence", () => {
    expect(
      validateSchedulerOrderingTimelineEvidence([
        {
          predicate: "scheduler-origin-marker",
          state: "present",
          confidence: "observed",
          observedAt: {
            streamId: "scheduler",
            sequence: 10,
            tick: 100,
          },
        },
        {
          predicate: "scheduler-callback-marker",
          state: "present",
          confidence: "observed",
          observedAt: {
            streamId: "scheduler",
            sequence: 11,
            tick: 101,
          },
        },
      ]),
    ).toEqual([]);
  });
});
