// Source-preserving feature-local runtime suite. Cases remain in their original lexical scopes.
import { describe, expect, it } from "vitest";
import { SCHEDULER_ISOLATION_CAPABILITY_REGISTRY, createBidirectionalSchedulerIsolationExperiment, createSchedulerCancellationExperiment, createSchedulerCrossArenaIsolationExperiment, experimentQualificationCausalProof, preflightRuntimeExperimentCapabilities, qualifyRuntimeExperiment, runtimeExperimentDefinitionRevision, validateCrossArenaSchedulerEvidence, validateSchedulerCancellationEvidence, validateRuntimeActionCapabilityRegistry, validateRuntimeExperimentDefinition, type RuntimeExperimentTrial } from "../../../src/index.js";
import { SCHEDULER_GENERATION_CAPABILITY_REGISTRY, createStaleGenerationCallbackExperiment } from "../../../src/index.js";
import { SCHEDULER_ORDERING_CAPABILITY_REGISTRY, createNestedSystemRunOrderingExperiment, validateSchedulerOrderingTimelineEvidence } from "../../../src/index.js";

// Original source suite: engine/packages/runtime-lab/test/domains/scheduler/scheduler-isolation-experiment.test.ts (blob d87337c0c053e4bbf58359a8cb1d7a5f3a418aa3)
{
const cancellation =
  createSchedulerCancellationExperiment({
    id: "exp:scheduler-cancellation",
    title: "Scheduler cancellation",
    targetProfileFingerprint: "profile-a",
    fixtureFingerprint: "fixture-a",
    objectiveId: "scheduler_cancel",
    participant: "mutation_count",
  });

const isolation =
  createSchedulerCrossArenaIsolationExperiment({
    id: "exp:scheduler-isolation",
    title: "Cross-arena scheduler isolation",
    targetProfileFingerprint: "profile-a",
    fixtureFingerprint: "fixture-b",
    objectiveId: "scheduler_isolation",
    participant: "cross_arena_mutation_count",
    arenaA: "arena-a",
    arenaB: "arena-b",
    arenaGeneration: 3,
  });

function trial(
  definition: typeof cancellation,
  id: string,
  armId: string,
  runIndex: number,
  predicate: string,
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
      predicate,
      state,
      confidence: "observed",
      observedAt: {
        streamId: "scheduler",
        sequence: 10 + runIndex,
        tick: 100 + runIndex,
      },
    }, ...(
      definition.id === cancellation.id
        ? armId === "control"
          ? [{
              predicate: "scheduler-work-cancelled",
              state: "present" as const,
              confidence: "observed" as const,
            }, {
              predicate: "scheduler-callback-attempted",
              state: "absent" as const,
              confidence: "observed" as const,
            }]
          : [{
              predicate: "scheduler-work-cancelled",
              state: "absent" as const,
              confidence: "observed" as const,
            }]
        : [{
            predicate: "scheduler-callback-attempted",
            state: "present" as const,
            confidence: "observed" as const,
            scope: {
              arenaId: "arena-a",
              arenaGeneration: 3,
            },
          }]
    )],
  };
}

describe("scheduler cancellation and isolation experiments", () => {
  it("defines valid guarded cancellation and isolation contracts", () => {
    expect(
      validateRuntimeExperimentDefinition(cancellation),
    ).toEqual([]);
    expect(
      validateRuntimeExperimentDefinition(isolation),
    ).toEqual([]);

    expect(cancellation.expectedContrasts).toEqual([{
      predicateId:
        "cancelled-callback-mutation-observed",
      controlState: "absent",
      treatmentState: "present",
    }]);

    expect(isolation.expectedContrasts).toEqual([{
      predicateId: "cross-arena-mutation-observed",
      controlState: "absent",
      treatmentState: "present",
    }]);
  });

  it("publishes valid capabilities and passes preflight", () => {
    expect(
      validateRuntimeActionCapabilityRegistry(
        SCHEDULER_ISOLATION_CAPABILITY_REGISTRY,
      ),
    ).toEqual([]);

    expect(
      preflightRuntimeExperimentCapabilities(
        cancellation,
        SCHEDULER_ISOLATION_CAPABILITY_REGISTRY,
        "LIVE_MINECRAFT",
      ).ready,
    ).toBe(true);

    expect(
      preflightRuntimeExperimentCapabilities(
        isolation,
        SCHEDULER_ISOLATION_CAPABILITY_REGISTRY,
        "LIVE_MINECRAFT",
      ).ready,
    ).toBe(true);
  });

  it("requires explicit cancellation evidence instead of treating a silent callback as cancelled", () => {
    expect(
      validateSchedulerCancellationEvidence([{
        predicate: "scheduler-work-cancelled",
        state: "present",
        confidence: "observed",
      }]),
    ).toEqual([]);

    expect(
      validateSchedulerCancellationEvidence([]).join(" "),
    ).toMatch(/missing explicit scheduler-work-cancelled/i);

    expect(
      validateSchedulerCancellationEvidence([{
        predicate: "scheduler-work-cancelled",
        state: "present",
        confidence: "observed",
      }, {
        predicate: "scheduler-callback-attempted",
        state: "present",
        confidence: "observed",
      }]).join(" "),
    ).toMatch(/callback attempt after cancellation/i);
  });

  it("defines bidirectional concurrent isolation with both A→B and B→A scheduled before the shared callback window", () => {
    const concurrent =
      createBidirectionalSchedulerIsolationExperiment({
        id: "exp:scheduler-isolation-bidirectional",
        title: "Bidirectional scheduler isolation",
        targetProfileFingerprint: "profile-a",
        fixtureFingerprint: "fixture-c",
        objectiveId: "scheduler_isolation",
        participant: "cross_arena_mutation_count",
        arenaA: "arena-a",
        arenaB: "arena-b",
        arenaGeneration: 3,
      });

    expect(
      validateRuntimeExperimentDefinition(concurrent),
    ).toEqual([]);

    expect(concurrent.protocol.map((step) => step.id))
      .toEqual([
        "reset-owned-work",
        "schedule-arena-a-to-b",
        "schedule-arena-b-to-a",
        "allow-concurrent-callback-window",
        "probe-cross-arena-mutation",
        "cleanup-owned-work",
      ]);
  });

  it("does not promote cancellation outcome contrast without required supporting evidence", () => {
    const raw = [
      "c0",
      "c1",
      "t0",
      "t1",
    ].map((id, index): RuntimeExperimentTrial => ({
      schemaVersion: 1,
      id,
      identity: {
        experimentId: cancellation.id,
        definitionRevision:
          runtimeExperimentDefinitionRevision(
            cancellation,
          ),
        armId: index < 2 ? "control" : "treatment",
        runIndex: index % 2,
        targetProfileFingerprint: "profile-a",
        fixtureFingerprint: "fixture-a",
        environmentFingerprint: "env-a",
      },
      status: "completed",
      evidence: [{
        predicate:
          "cancelled-callback-mutation-observed",
        state: index < 2 ? "absent" : "present",
        confidence: "observed",
      }],
    }));

    const qualification = qualifyRuntimeExperiment(
      cancellation,
      raw,
    );

    expect(qualification.state).toBe("observed");
    expect(qualification.reasons.join(" ")).toMatch(
      /supporting evidence requirement/i,
    );
  });

  it("promotes repeatable cancellation contrast to causal provenance", () => {
    const qualification = qualifyRuntimeExperiment(
      cancellation,
      [
        trial(
          cancellation,
          "c0",
          "control",
          0,
          "cancelled-callback-mutation-observed",
          "absent",
        ),
        trial(
          cancellation,
          "c1",
          "control",
          1,
          "cancelled-callback-mutation-observed",
          "absent",
        ),
        trial(
          cancellation,
          "t0",
          "treatment",
          0,
          "cancelled-callback-mutation-observed",
          "present",
        ),
        trial(
          cancellation,
          "t1",
          "treatment",
          1,
          "cancelled-callback-mutation-observed",
          "present",
        ),
      ],
    );

    expect(qualification).toMatchObject({
      state: "intervention-supported",
      expectedContrastMatches: [
        "cancelled-callback-mutation-observed",
      ],
    });

    const proof = experimentQualificationCausalProof(
      qualification,
      cancellation,
    );

    expect(proof.interventionProvenance).toEqual([
      expect.objectContaining({
        predicateId:
          "cancelled-callback-mutation-observed",
        controlledFactorContrasts: [{
          factorId: "cancellation-enabled",
          controlValue: true,
          treatmentValue: false,
        }],
      }),
    ]);
  });

  it("promotes repeatable cross-arena mutation contrast to causal provenance", () => {
    const qualification = qualifyRuntimeExperiment(
      isolation,
      [
        trial(
          isolation,
          "c0",
          "control",
          0,
          "cross-arena-mutation-observed",
          "absent",
        ),
        trial(
          isolation,
          "c1",
          "control",
          1,
          "cross-arena-mutation-observed",
          "absent",
        ),
        trial(
          isolation,
          "t0",
          "treatment",
          0,
          "cross-arena-mutation-observed",
          "present",
        ),
        trial(
          isolation,
          "t1",
          "treatment",
          1,
          "cross-arena-mutation-observed",
          "present",
        ),
      ],
    );

    const proof = experimentQualificationCausalProof(
      qualification,
      isolation,
    );

    expect(proof.interventionProvenance).toEqual([
      expect.objectContaining({
        predicateId: "cross-arena-mutation-observed",
        controlledFactorContrasts: [{
          factorId: "owner-isolation-enabled",
          controlValue: true,
          treatmentValue: false,
        }],
      }),
    ]);
  });

  it("requires callback-attempt evidence to be scoped to the owner arena generation", () => {
    expect(
      validateCrossArenaSchedulerEvidence(
        [{
          predicate: "scheduler-callback-attempted",
          state: "present",
          confidence: "observed",
          scope: {
            arenaId: "arena-a",
            arenaGeneration: 3,
          },
        }, {
          predicate: "cross-arena-mutation-observed",
          state: "present",
          confidence: "observed",
          scope: {
            arenaId: "arena-b",
            arenaGeneration: 3,
          },
        }],
        "arena-a",
        "arena-b",
        3,
      ),
    ).toEqual([]);

    expect(
      validateCrossArenaSchedulerEvidence(
        [{
          predicate: "scheduler-callback-attempted",
          state: "present",
          confidence: "observed",
          scope: {
            arenaId: "arena-b",
            arenaGeneration: 3,
          },
        }],
        "arena-a",
        "arena-b",
        3,
      ).join(" "),
    ).toMatch(/owner arena generation/i);
  });

  it("rejects mutation evidence attributed to the wrong target arena", () => {
    expect(
      validateCrossArenaSchedulerEvidence(
        [{
          predicate: "scheduler-callback-attempted",
          state: "present",
          confidence: "observed",
          scope: {
            arenaId: "arena-a",
            arenaGeneration: 3,
          },
        }, {
          predicate: "cross-arena-mutation-observed",
          state: "present",
          confidence: "observed",
          scope: {
            arenaId: "arena-a",
            arenaGeneration: 3,
          },
        }],
        "arena-a",
        "arena-b",
        3,
      ).join(" "),
    ).toMatch(/target arena generation/i);
  });
});
}

// Original source suite: engine/packages/runtime-lab/test/domains/scheduler/scheduler-generation-experiment.test.ts (blob 886acd1c2f862e960c04f6dbe870b8a57e4de39a)
{
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
}

// Original source suite: engine/packages/runtime-lab/test/domains/scheduler/scheduler-ordering-experiment.test.ts (blob d329bc92fa309bcfdc11a26349616d75e663cb1b)
{
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
}
