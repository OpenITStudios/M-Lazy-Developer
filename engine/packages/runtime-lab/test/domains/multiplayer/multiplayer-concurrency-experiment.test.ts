import { describe, expect, it } from "vitest";
import {
  MULTIPLAYER_CONCURRENCY_CAPABILITY_REGISTRY,
  createArenaCapacityGuardExperiment,
  createFullCapacitySessionExperiment,
  createMultiArenaStartOwnershipExperiment,
  experimentQualificationCausalProof,
  preflightRuntimeExperimentCapabilities,
  qualifyRuntimeExperiment,
  runtimeExperimentDefinitionRevision,
  validateRuntimeActionCapabilityRegistry,
  validateRuntimeExperimentDefinition,
  type RuntimeExperimentDefinition,
  type RuntimeExperimentTrial,
} from "../../../src/index.js";

const arenaA = {
  arenaId: "arena-a",
  arenaGeneration: 3,
};
const arenaB = {
  arenaId: "arena-b",
  arenaGeneration: 8,
};

const capacity =
  createArenaCapacityGuardExperiment({
    id: "exp:arena-capacity",
    title: "Arena capacity atomicity",
    targetProfileFingerprint: "profile-a",
    fixtureFingerprint: "fixture-capacity",
    objectiveId: "arena_capacity",
    participant: "overflow_count",
    arena: arenaA,
    maxPlayers: 5,
    attemptedPlayers: 6,
  });

const fullCapacity =
  createFullCapacitySessionExperiment({
    id: "exp:full-capacity-session",
    title: "Full capacity session",
    targetProfileFingerprint: "profile-a",
    fixtureFingerprint: "fixture-full",
    objectiveId: "arena_session",
    participant: "invariant_violation",
    arena: arenaA,
    maxPlayers: 5,
  });

const multiArenaStart =
  createMultiArenaStartOwnershipExperiment({
    id: "exp:multi-arena-start",
    title: "Multi arena start ownership",
    targetProfileFingerprint: "profile-a",
    fixtureFingerprint: "fixture-start",
    objectiveId: "arena_start",
    participant: "ownership_violation",
    arenaA,
    arenaB,
    playerCountPerArena: 5,
  });

function identity(
  definition: RuntimeExperimentDefinition,
  armId: "control" | "treatment",
  runIndex: number,
) {
  return {
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
  };
}

function capacityTrial(
  armId: "control" | "treatment",
  runIndex: number,
  activePlayers = 5,
): RuntimeExperimentTrial {
  const control = armId === "control";
  return {
    schemaVersion: 1,
    id: armId + ":" + runIndex,
    identity: identity(capacity, armId, runIndex),
    status: "completed",
    evidence: [{
      predicate: "arena-capacity-overflow-observed",
      state: control ? "absent" : "present",
      confidence: "observed",
      scope: arenaA,
    }, {
      predicate: "arena-join-burst-observed",
      state: "present",
      confidence: "observed",
      scope: arenaA,
      measurements: {
        attemptedPlayers: 6,
        maxPlayers: 5,
      },
    }, ...(control ? [{
      predicate: "arena-membership-count-sampled",
      state: "present" as const,
      confidence: "observed" as const,
      scope: arenaA,
      measurements: {
        activePlayers,
      },
    }, {
      predicate: "arena-join-rejection-count-sampled",
      state: "present" as const,
      confidence: "observed" as const,
      scope: arenaA,
      measurements: {
        rejectedPlayers: 1,
      },
    }] : [])],
  };
}

function fullCapacityTrial(
  armId: "control" | "treatment",
  runIndex: number,
  returnedPlayers?: number,
): RuntimeExperimentTrial {
  const count = armId === "control" ? 1 : 5;
  return {
    schemaVersion: 1,
    id: armId + ":" + runIndex,
    identity: identity(
      fullCapacity,
      armId,
      runIndex,
    ),
    status: "completed",
    evidence: [{
      predicate:
        "arena-session-invariant-violation-observed",
      state: "absent",
      confidence: "observed",
      scope: arenaA,
    }, {
      predicate: "arena-player-count-sampled",
      state: "present",
      confidence: "observed",
      scope: arenaA,
      measurements: {
        activePlayers: count,
      },
    }, {
      predicate: "arena-session-started",
      state: "present",
      confidence: "observed",
      scope: arenaA,
    }, {
      predicate: "arena-session-cleanup-complete",
      state: "present",
      confidence: "observed",
      scope: arenaA,
    }, {
      predicate: "arena-participants-returned-lobby",
      state: "present",
      confidence: "observed",
      scope: arenaA,
      measurements: {
        returnedPlayers:
          returnedPlayers ?? count,
      },
    }],
  };
}

function multiArenaStartTrial(
  armId: "control" | "treatment",
  runIndex: number,
): RuntimeExperimentTrial {
  const control = armId === "control";
  return {
    schemaVersion: 1,
    id: armId + ":" + runIndex,
    identity: identity(
      multiArenaStart,
      armId,
      runIndex,
    ),
    status: "completed",
    evidence: [{
      predicate:
        "arena-start-ownership-violation-observed",
      state: control ? "absent" : "present",
      confidence: "observed",
    }, {
      predicate: "arena-start-request-burst-observed",
      state: "present",
      confidence: "observed",
      scope: arenaA,
      measurements: {
        playerCount: 5,
        startRequests: 5,
      },
    }, {
      predicate: "arena-start-request-burst-observed",
      state: "present",
      confidence: "observed",
      scope: arenaB,
      measurements: {
        playerCount: 5,
        startRequests: 5,
      },
    }, ...(control ? [{
      predicate: "arena-start-owner-count-sampled",
      state: "present" as const,
      confidence: "observed" as const,
      scope: arenaA,
      measurements: {
        owners: 1,
      },
    }, {
      predicate: "arena-start-owner-count-sampled",
      state: "present" as const,
      confidence: "observed" as const,
      scope: arenaB,
      measurements: {
        owners: 1,
      },
    }] : [])],
  };
}

function repeat(
  factory: (
    armId: "control" | "treatment",
    runIndex: number,
  ) => RuntimeExperimentTrial,
): RuntimeExperimentTrial[] {
  return [
    factory("control", 0),
    factory("control", 1),
    factory("treatment", 0),
    factory("treatment", 1),
  ];
}

describe("multiplayer concurrency runtime experiments", () => {
  it("defines valid capacity, full-session, and multi-arena start contracts", () => {
    for (const definition of [
      capacity,
      fullCapacity,
      multiArenaStart,
    ]) {
      expect(
        validateRuntimeExperimentDefinition(definition),
      ).toEqual([]);
      expect(definition.domain).toBe("multiplayer");
    }
  });

  it("publishes valid concurrency capabilities and passes preflight", () => {
    expect(
      validateRuntimeActionCapabilityRegistry(
        MULTIPLAYER_CONCURRENCY_CAPABILITY_REGISTRY,
      ),
    ).toEqual([]);

    for (const definition of [
      capacity,
      fullCapacity,
      multiArenaStart,
    ]) {
      expect(
        preflightRuntimeExperimentCapabilities(
          definition,
          MULTIPLAYER_CONCURRENCY_CAPABILITY_REGISTRY,
          "LIVE_MINECRAFT",
        ).ready,
      ).toBe(true);
    }
  });

  it("promotes capacity overflow only after bounded membership and rejection measurements are proven", () => {
    const qualification =
      qualifyRuntimeExperiment(
        capacity,
        repeat(capacityTrial),
      );

    expect(qualification).toMatchObject({
      state: "intervention-supported",
      expectedContrastMatches: [
        "arena-capacity-overflow-observed",
      ],
    });

    const proof = experimentQualificationCausalProof(
      qualification,
      capacity,
    );

    expect(proof.interventionProvenance).toEqual([
      expect.objectContaining({
        predicateId:
          "arena-capacity-overflow-observed",
        controlledFactorContrasts: [{
          factorId: "capacity-guard-enabled",
          controlValue: true,
          treatmentValue: false,
        }],
      }),
    ]);
  });

  it("rejects capacity proof when the measured active membership exceeds maxPlayers in the guarded arm", () => {
    const trials = repeat(capacityTrial);
    trials[0] = capacityTrial("control", 0, 6);

    const qualification =
      qualifyRuntimeExperiment(capacity, trials);

    expect(qualification.state).toBe("observed");
    expect(qualification.reasons.join(" ")).toMatch(
      /supporting evidence requirement/i,
    );
  });

  it("proves full five-player session scaling as repeatable without inventing a causal contrast", () => {
    const qualification =
      qualifyRuntimeExperiment(
        fullCapacity,
        repeat(fullCapacityTrial),
      );

    expect(qualification.state).toBe("repeatable");
    expect(
      qualification.controlTreatmentContrastPredicates,
    ).toEqual([]);
    expect(qualification.unknownOutcomes).toBe(0);
  });

  it("fails full-capacity validation when not all five participants return to lobby", () => {
    const trials = repeat(fullCapacityTrial);
    trials[2] = fullCapacityTrial(
      "treatment",
      0,
      4,
    );

    const qualification =
      qualifyRuntimeExperiment(
        fullCapacity,
        trials,
      );

    expect(qualification.state).toBe("observed");
    expect(qualification.reasons.join(" ")).toMatch(
      /supporting evidence requirement/i,
    );
  });

  it("promotes simultaneous multi-arena start ownership violation only after both arenas prove contention", () => {
    const qualification =
      qualifyRuntimeExperiment(
        multiArenaStart,
        repeat(multiArenaStartTrial),
      );

    expect(qualification).toMatchObject({
      state: "intervention-supported",
      expectedContrastMatches: [
        "arena-start-ownership-violation-observed",
      ],
    });

    const proof = experimentQualificationCausalProof(
      qualification,
      multiArenaStart,
    );

    expect(proof.interventionProvenance).toEqual([
      expect.objectContaining({
        predicateId:
          "arena-start-ownership-violation-observed",
        controlledFactorContrasts: [{
          factorId:
            "start-ownership-guard-enabled",
          controlValue: true,
          treatmentValue: false,
        }],
      }),
    ]);
  });

  it("rejects invalid numeric evidence requirement bounds at definition time", () => {
    const invalid = {
      ...capacity,
      evidenceRequirements: [{
        id: "bad-measurement",
        predicateId: "arena-join-burst-observed",
        state: "present" as const,
        measurements: {
          activePlayers: {
            min: 6,
            max: 5,
          },
        },
      }],
    };

    expect(
      validateRuntimeExperimentDefinition(invalid)
        .join(" "),
    ).toMatch(/min cannot exceed max/i);
  });
});
