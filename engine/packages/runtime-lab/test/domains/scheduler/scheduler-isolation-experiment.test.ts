import { describe, expect, it } from "vitest";
import {
  SCHEDULER_ISOLATION_CAPABILITY_REGISTRY,
  createBidirectionalSchedulerIsolationExperiment,
  createSchedulerCancellationExperiment,
  createSchedulerCrossArenaIsolationExperiment,
  experimentQualificationCausalProof,
  preflightRuntimeExperimentCapabilities,
  qualifyRuntimeExperiment,
  runtimeExperimentDefinitionRevision,
  validateCrossArenaSchedulerEvidence,
  validateSchedulerCancellationEvidence,
  validateRuntimeActionCapabilityRegistry,
  validateRuntimeExperimentDefinition,
  type RuntimeExperimentTrial,
} from "../../../src/index.js";

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
