import { describe, expect, it } from "vitest";
import type {
  GameplayIntentModel,
} from "../../../gameplay-intent/src/index.js";
import type {
  RuntimeEvidenceIntegrityReport,
  RuntimeEvidenceRecord,
} from "../../../project-model/src/index.js";
import {
  createArenaCapacityGuardExperiment,
  createFullCapacitySessionExperiment,
  createMultiArenaStartOwnershipExperiment,
  createReconnectGenerationResetExperiment,
  qualifyRuntimeExperiment,
  runtimeExperimentDefinitionRevision,
  type RuntimeExperimentDefinition,
  type RuntimeExperimentTrial,
} from "../../../runtime-lab/src/index.js";
import {
  MULTIPLAYER_CAPACITY_DIAGNOSTIC_BINDINGS,
  MULTIPLAYER_FULL_CAPACITY_DIAGNOSTIC_BINDINGS,
  MULTIPLAYER_RECONNECT_DIAGNOSTIC_BINDINGS,
  MULTIPLAYER_START_OWNERSHIP_DIAGNOSTIC_BINDINGS,
  reclassifyIntentDiagnosticFromRuntime,
  runtimeExperimentDiagnosticEvidence,
} from "../../src/index.js";

function authoredIntent(subjectId: string): GameplayIntentModel {
  return {
    schemaVersion: 1,
    id: "multiplayer-intent",
    artifactId: "fixture:selected-map",
    evidence: [{
      id: "intent-evidence",
      origin: "source-code",
      locator: "scripts/session.ts",
      scope: "selected-artifact",
      summary: "Authored multiplayer session invariant.",
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
      id: "multiplayer-invariant",
      statement:
        "Session, arena capacity, and arena-start ownership must remain generation-scoped and isolated.",
      strength: "must",
      status: "authored",
      subjectIds: [subjectId],
      evidenceIds: ["intent-evidence"],
    }],
    unknowns: [],
  };
}

const integrity: RuntimeEvidenceIntegrityReport = {
  records: 16,
  observedRecords: 16,
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
  armId: "control" | "treatment",
  runIndex: number,
  evidence: readonly RuntimeEvidenceRecord[],
): RuntimeExperimentTrial {
  return {
    schemaVersion: 1,
    id: armId + ":" + runIndex,
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
    evidence,
  };
}

function repeat(
  definition: RuntimeExperimentDefinition,
  evidenceFor: (
    armId: "control" | "treatment",
  ) => readonly RuntimeEvidenceRecord[],
): RuntimeExperimentTrial[] {
  return [
    trial(definition, "control", 0, evidenceFor("control")),
    trial(definition, "control", 1, evidenceFor("control")),
    trial(definition, "treatment", 0, evidenceFor("treatment")),
    trial(definition, "treatment", 1, evidenceFor("treatment")),
  ];
}

function classify(
  subjectId: string,
  definition: RuntimeExperimentDefinition,
  trials: readonly RuntimeExperimentTrial[],
  bindings:
    | typeof MULTIPLAYER_RECONNECT_DIAGNOSTIC_BINDINGS
    | typeof MULTIPLAYER_CAPACITY_DIAGNOSTIC_BINDINGS
    | typeof MULTIPLAYER_START_OWNERSHIP_DIAGNOSTIC_BINDINGS
    | typeof MULTIPLAYER_FULL_CAPACITY_DIAGNOSTIC_BINDINGS,
  runtimeIntegrity = integrity,
) {
  const qualification =
    qualifyRuntimeExperiment(definition, trials);
  const bridge = runtimeExperimentDiagnosticEvidence(
    qualification,
    trials,
  );

  return reclassifyIntentDiagnosticFromRuntime({
    intent: authoredIntent(subjectId),
    subjectIds: [subjectId],
    bridge,
    bindings,
    runtimeProofRequired: true,
    runtimeIntegrity,
  });
}

describe("multiplayer runtime diagnostic bindings", () => {
  it("confirms stale reconnect mutation only from generation-bound intervention evidence", () => {
    const subject = {
      playerKey: "player-1",
      arenaId: "arena-1",
      arenaGeneration: 4,
      connectionGeneration: 7,
      participationGeneration: 11,
      lifeGeneration: 3,
    };
    const definition =
      createReconnectGenerationResetExperiment({
        id: "exp:reconnect",
        title: "Reconnect generation reset",
        targetProfileFingerprint: "profile-a",
        fixtureFingerprint: "fixture-a",
        objectiveId: "session",
        participant: "stale_mutation",
        subject,
      });

    const base = {
      playerKey: subject.playerKey,
      lifeGeneration: subject.lifeGeneration,
      arenaId: subject.arenaId,
      arenaGeneration: subject.arenaGeneration,
    };
    const trials = repeat(
      definition,
      (armId) => [{
        predicate: "stale-session-mutation-observed",
        state: armId === "control" ? "absent" : "present",
        confidence: "observed",
        scope: {
          ...base,
          connectionGeneration:
            subject.connectionGeneration + 1,
          participationGeneration:
            subject.participationGeneration + 1,
        },
      }, {
        predicate: "player-disconnected",
        state: "present",
        confidence: "observed",
        scope: {
          ...base,
          connectionGeneration:
            subject.connectionGeneration,
          participationGeneration:
            subject.participationGeneration,
          operationId: "disconnect",
        },
      }, {
        predicate: "player-reconnected",
        state: "present",
        confidence: "observed",
        scope: {
          ...base,
          connectionGeneration:
            subject.connectionGeneration + 1,
          participationGeneration:
            subject.participationGeneration + 1,
          operationId: "reconnect",
        },
      }, {
        predicate: "session-progress-reset",
        state: "present",
        confidence: "observed",
        scope: {
          ...base,
          connectionGeneration:
            subject.connectionGeneration + 1,
          participationGeneration:
            subject.participationGeneration + 1,
          operationId: "reconnect-reconcile",
        },
      }],
    );

    const result = classify(
      "reconnect-session",
      definition,
      trials,
      MULTIPLAYER_RECONNECT_DIAGNOSTIC_BINDINGS,
    );

    expect(result.disposition).toBe("confirmed-defect");
    expect(result.matchedPredicates.contradictions)
      .toEqual([
        "stale-session-mutation-observed@role:treatment=present",
      ]);
  });

  it("confirms arena capacity overflow only from measured guarded-vs-unguarded contrast", () => {
    const definition =
      createArenaCapacityGuardExperiment({
        id: "exp:capacity",
        title: "Capacity atomicity",
        targetProfileFingerprint: "profile-a",
        fixtureFingerprint: "fixture-b",
        objectiveId: "capacity",
        participant: "overflow",
        arena: {
          arenaId: "arena-a",
          arenaGeneration: 2,
        },
        maxPlayers: 5,
        attemptedPlayers: 6,
      });
    const arenaScope = {
      arenaId: "arena-a",
      arenaGeneration: 2,
    };
    const trials = repeat(
      definition,
      (armId) => [{
        predicate: "arena-capacity-overflow-observed",
        state: armId === "control" ? "absent" : "present",
        confidence: "observed",
        scope: arenaScope,
      }, {
        predicate: "arena-join-burst-observed",
        state: "present",
        confidence: "observed",
        scope: arenaScope,
        measurements: {
          attemptedPlayers: 6,
          maxPlayers: 5,
        },
      }, ...(armId === "control" ? [{
        predicate: "arena-membership-count-sampled",
        state: "present" as const,
        confidence: "observed" as const,
        scope: arenaScope,
        measurements: {
          activePlayers: 5,
        },
      }, {
        predicate: "arena-join-rejection-count-sampled",
        state: "present" as const,
        confidence: "observed" as const,
        scope: arenaScope,
        measurements: {
          rejectedPlayers: 1,
        },
      }] : [])],
    );

    const result = classify(
      "arena-capacity",
      definition,
      trials,
      MULTIPLAYER_CAPACITY_DIAGNOSTIC_BINDINGS,
    );

    expect(result.disposition).toBe("confirmed-defect");
  });

  it("confirms simultaneous multi-arena start ownership violation only after both arenas prove contention", () => {
    const definition =
      createMultiArenaStartOwnershipExperiment({
        id: "exp:start-ownership",
        title: "Start ownership",
        targetProfileFingerprint: "profile-a",
        fixtureFingerprint: "fixture-c",
        objectiveId: "start",
        participant: "violation",
        arenaA: {
          arenaId: "arena-a",
          arenaGeneration: 3,
        },
        arenaB: {
          arenaId: "arena-b",
          arenaGeneration: 9,
        },
        playerCountPerArena: 5,
      });
    const a = {
      arenaId: "arena-a",
      arenaGeneration: 3,
    };
    const b = {
      arenaId: "arena-b",
      arenaGeneration: 9,
    };
    const trials = repeat(
      definition,
      (armId) => [{
        predicate:
          "arena-start-ownership-violation-observed",
        state: armId === "control" ? "absent" : "present",
        confidence: "observed",
      }, {
        predicate: "arena-start-request-burst-observed",
        state: "present",
        confidence: "observed",
        scope: a,
        measurements: {
          playerCount: 5,
          startRequests: 5,
        },
      }, {
        predicate: "arena-start-request-burst-observed",
        state: "present",
        confidence: "observed",
        scope: b,
        measurements: {
          playerCount: 5,
          startRequests: 5,
        },
      }, ...(armId === "control" ? [{
        predicate: "arena-start-owner-count-sampled",
        state: "present" as const,
        confidence: "observed" as const,
        scope: a,
        measurements: { owners: 1 },
      }, {
        predicate: "arena-start-owner-count-sampled",
        state: "present" as const,
        confidence: "observed" as const,
        scope: b,
        measurements: { owners: 1 },
      }] : [])],
    );

    const result = classify(
      "arena-start-ownership",
      definition,
      trials,
      MULTIPLAYER_START_OWNERSHIP_DIAGNOSTIC_BINDINGS,
    );

    expect(result.disposition).toBe("confirmed-defect");
  });

  it("can confirm a full-capacity invariant violation without pretending player-count scaling is the causal root cause", () => {
    const definition =
      createFullCapacitySessionExperiment({
        id: "exp:full-capacity",
        title: "Full capacity",
        targetProfileFingerprint: "profile-a",
        fixtureFingerprint: "fixture-d",
        objectiveId: "session",
        participant: "violation",
        arena: {
          arenaId: "arena-a",
          arenaGeneration: 5,
        },
        maxPlayers: 5,
      });
    const arenaScope = {
      arenaId: "arena-a",
      arenaGeneration: 5,
    };

    const trials = [
      trial(definition, "control", 0, [{
        predicate:
          "arena-session-invariant-violation-observed",
        state: "absent",
        confidence: "observed",
        scope: arenaScope,
      }, {
        predicate: "arena-player-count-sampled",
        state: "present",
        confidence: "observed",
        scope: arenaScope,
        measurements: { activePlayers: 1 },
      }, {
        predicate: "arena-session-started",
        state: "present",
        confidence: "observed",
        scope: arenaScope,
      }, {
        predicate: "arena-session-cleanup-complete",
        state: "present",
        confidence: "observed",
        scope: arenaScope,
      }, {
        predicate: "arena-participants-returned-lobby",
        state: "present",
        confidence: "observed",
        scope: arenaScope,
        measurements: { returnedPlayers: 1 },
      }]),
      trial(definition, "control", 1, [{
        predicate:
          "arena-session-invariant-violation-observed",
        state: "absent",
        confidence: "observed",
        scope: arenaScope,
      }, {
        predicate: "arena-player-count-sampled",
        state: "present",
        confidence: "observed",
        scope: arenaScope,
        measurements: { activePlayers: 1 },
      }, {
        predicate: "arena-session-started",
        state: "present",
        confidence: "observed",
        scope: arenaScope,
      }, {
        predicate: "arena-session-cleanup-complete",
        state: "present",
        confidence: "observed",
        scope: arenaScope,
      }, {
        predicate: "arena-participants-returned-lobby",
        state: "present",
        confidence: "observed",
        scope: arenaScope,
        measurements: { returnedPlayers: 1 },
      }]),
      ...[0, 1].map((runIndex) =>
        trial(definition, "treatment", runIndex, [{
          predicate:
            "arena-session-invariant-violation-observed",
          state: "present",
          confidence: "observed",
          scope: arenaScope,
        }, {
          predicate: "arena-player-count-sampled",
          state: "present",
          confidence: "observed",
          scope: arenaScope,
          measurements: { activePlayers: 5 },
        }, {
          predicate: "arena-session-started",
          state: "present",
          confidence: "observed",
          scope: arenaScope,
        }, {
          predicate: "arena-session-cleanup-complete",
          state: "present",
          confidence: "observed",
          scope: arenaScope,
        }, {
          predicate: "arena-participants-returned-lobby",
          state: "present",
          confidence: "observed",
          scope: arenaScope,
          measurements: { returnedPlayers: 5 },
        }])
      ),
    ];

    const qualification =
      qualifyRuntimeExperiment(definition, trials);
    expect(qualification.state).toBe(
      "intervention-supported",
    );
    expect(
      qualification.expectedContrastMatches,
    ).toEqual([]);

    const result = classify(
      "full-capacity-session",
      definition,
      trials,
      MULTIPLAYER_FULL_CAPACITY_DIAGNOSTIC_BINDINGS,
    );

    expect(result.disposition).toBe("confirmed-defect");
    expect(result.matchedPredicates.contradictions)
      .toEqual([
        "arena-session-invariant-violation-observed@role:treatment=present",
      ]);
  });

  it("keeps multiplayer runtime violations unconfirmed when evidence integrity is unsafe", () => {
    const subject = {
      playerKey: "player-1",
      arenaId: "arena-1",
      arenaGeneration: 4,
      connectionGeneration: 7,
      participationGeneration: 11,
      lifeGeneration: 3,
    };
    const definition =
      createReconnectGenerationResetExperiment({
        id: "exp:reconnect-unsafe",
        title: "Reconnect generation reset",
        targetProfileFingerprint: "profile-a",
        fixtureFingerprint: "fixture-e",
        objectiveId: "session",
        participant: "stale_mutation",
        subject,
      });
    const base = {
      playerKey: subject.playerKey,
      lifeGeneration: subject.lifeGeneration,
      arenaId: subject.arenaId,
      arenaGeneration: subject.arenaGeneration,
    };
    const trials = repeat(
      definition,
      (armId) => [{
        predicate: "stale-session-mutation-observed",
        state: armId === "control" ? "absent" : "present",
        confidence: "observed",
        scope: {
          ...base,
          connectionGeneration: 8,
          participationGeneration: 12,
        },
      }, {
        predicate: "player-disconnected",
        state: "present",
        confidence: "observed",
        scope: {
          ...base,
          connectionGeneration: 7,
          participationGeneration: 11,
          operationId: "disconnect",
        },
      }, {
        predicate: "player-reconnected",
        state: "present",
        confidence: "observed",
        scope: {
          ...base,
          connectionGeneration: 8,
          participationGeneration: 12,
          operationId: "reconnect",
        },
      }, {
        predicate: "session-progress-reset",
        state: "present",
        confidence: "observed",
        scope: {
          ...base,
          connectionGeneration: 8,
          participationGeneration: 12,
          operationId: "reconnect-reconcile",
        },
      }],
    );

    const result = classify(
      "reconnect-session",
      definition,
      trials,
      MULTIPLAYER_RECONNECT_DIAGNOSTIC_BINDINGS,
      {
        ...integrity,
        safeForCurrentStateClaims: false,
        reasons: ["runtime conflict"],
      },
    );

    expect(result.disposition).toBe(
      "runtime-proof-required",
    );
  });
});
