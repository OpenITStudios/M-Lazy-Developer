import { describe, expect, it } from "vitest";
import type {
  GameplayIntentModel,
} from "../../../gameplay-intent/src/index.js";
import type {
  RuntimeEvidenceIntegrityReport,
} from "../../../project-model/src/index.js";
import {
  createSchedulerCancellationExperiment,
  createSchedulerCrossArenaIsolationExperiment,
  qualifyRuntimeExperiment,
  runtimeExperimentDefinitionRevision,
  type RuntimeExperimentDefinition,
  type RuntimeExperimentTrial,
} from "../../../runtime-lab/src/index.js";
import {
  SCHEDULER_CANCELLATION_DIAGNOSTIC_BINDINGS,
  SCHEDULER_CROSS_ARENA_DIAGNOSTIC_BINDINGS,
  reclassifyIntentDiagnosticFromRuntime,
  runtimeExperimentDiagnosticEvidence,
} from "../../src/index.js";

function authoredIntent(subjectId: string): GameplayIntentModel {
  return {
    schemaVersion: 1,
    id: "scheduler-intent",
    evidence: [{
      id: "intent-evidence",
      origin: "source-code",
      locator: "scripts/scheduler.ts",
      scope: "selected-artifact",
      summary: "Authored scheduler isolation invariant.",
    }],
    nodes: [{
      id: subjectId,
      kind: "state",
      label: subjectId,
      status: "authored",
      evidenceIds: ["intent-evidence"],
    }],
    edges: [],
    invariants: [{
      id: "scheduler-invariant",
      statement:
        "Deferred callbacks must not mutate after cancellation or across arena ownership boundaries.",
      strength: "must",
      status: "authored",
      subjectIds: [subjectId],
      evidenceIds: ["intent-evidence"],
    }],
    unknowns: [],
  };
}

const integrity: RuntimeEvidenceIntegrityReport = {
  records: 4,
  observedRecords: 4,
  derivedRecords: 0,
  unknownConfidenceRecords: 0,
  unlocatedObservedRecords: 0,
  unresolvedConflictPredicates: [],
  resolvedConflictCount: 0,
  continuityComplete: true,
  telemetryContinuityComplete: true,
  safeForCurrentStateClaims: true,
  safeForTemporalViolationClaims: true,
  reasons: ["integrity satisfied"],
};

function trial(
  definition: RuntimeExperimentDefinition,
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
      predicate ===
        "cancelled-callback-mutation-observed"
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

function bridgeFor(
  definition: RuntimeExperimentDefinition,
  predicate: string,
) {
  const trials = [
    trial(definition, "c0", "control", 0, predicate, "absent"),
    trial(definition, "c1", "control", 1, predicate, "absent"),
    trial(definition, "t0", "treatment", 0, predicate, "present"),
    trial(definition, "t1", "treatment", 1, predicate, "present"),
  ];
  const qualification =
    qualifyRuntimeExperiment(definition, trials);

  return runtimeExperimentDiagnosticEvidence(
    qualification,
    trials,
  );
}

describe("scheduler runtime diagnostic bindings", () => {
  it("confirms authored cancellation violation only from matched intervention evidence", () => {
    const definition =
      createSchedulerCancellationExperiment({
        id: "exp:scheduler-cancellation",
        title: "Scheduler cancellation",
        targetProfileFingerprint: "profile-a",
        fixtureFingerprint: "fixture-a",
        objectiveId: "scheduler_cancel",
        participant: "mutation_count",
      });

    const result =
      reclassifyIntentDiagnosticFromRuntime({
        intent: authoredIntent("scheduler-cancellation"),
        subjectIds: ["scheduler-cancellation"],
        bridge: bridgeFor(
          definition,
          "cancelled-callback-mutation-observed",
        ),
        bindings:
          SCHEDULER_CANCELLATION_DIAGNOSTIC_BINDINGS,
        runtimeProofRequired: true,
        runtimeIntegrity: integrity,
      });

    expect(result.disposition).toBe(
      "confirmed-defect",
    );
    expect(
      result.matchedPredicates.contradictions,
    ).toEqual([
      "cancelled-callback-mutation-observed@role:treatment=present",
    ]);
  });

  it("confirms authored cross-arena isolation violation only from matched intervention evidence", () => {
    const definition =
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

    const result =
      reclassifyIntentDiagnosticFromRuntime({
        intent: authoredIntent("cross-arena-isolation"),
        subjectIds: ["cross-arena-isolation"],
        bridge: bridgeFor(
          definition,
          "cross-arena-mutation-observed",
        ),
        bindings:
          SCHEDULER_CROSS_ARENA_DIAGNOSTIC_BINDINGS,
        runtimeProofRequired: true,
        runtimeIntegrity: integrity,
      });

    expect(result.disposition).toBe(
      "confirmed-defect",
    );
    expect(
      result.matchedPredicates.contradictions,
    ).toEqual([
      "cross-arena-mutation-observed@role:treatment=present",
    ]);
  });

  it("does not confirm when runtime evidence integrity is unsafe", () => {
    const definition =
      createSchedulerCancellationExperiment({
        id: "exp:scheduler-cancellation",
        title: "Scheduler cancellation",
        targetProfileFingerprint: "profile-a",
        fixtureFingerprint: "fixture-a",
        objectiveId: "scheduler_cancel",
        participant: "mutation_count",
      });

    const result =
      reclassifyIntentDiagnosticFromRuntime({
        intent: authoredIntent("scheduler-cancellation"),
        subjectIds: ["scheduler-cancellation"],
        bridge: bridgeFor(
          definition,
          "cancelled-callback-mutation-observed",
        ),
        bindings:
          SCHEDULER_CANCELLATION_DIAGNOSTIC_BINDINGS,
        runtimeProofRequired: true,
        runtimeIntegrity: {
          ...integrity,
          safeForCurrentStateClaims: false,
          reasons: ["runtime evidence conflict"],
        },
      });

    expect(result.disposition).toBe(
      "runtime-proof-required",
    );
    expect(result.gate.nextEvidenceNeed).toBe(
      "runtime-evidence-integrity",
    );
  });
});
