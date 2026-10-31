import { describe, expect, it } from "vitest";
import {
  MULTIPLAYER_SESSION_CAPABILITY_REGISTRY,
  createDeathDuringJoinExperiment,
  createJoinPadLeaveOwnershipExperiment,
  createReconnectGenerationResetExperiment,
  experimentQualificationCausalProof,
  preflightRuntimeExperimentCapabilities,
  qualifyRuntimeExperiment,
  runtimeExperimentDefinitionRevision,
  validateMultiplayerSessionEvidence,
  validateRuntimeActionCapabilityRegistry,
  validateRuntimeExperimentDefinition,
  type RuntimeExperimentDefinition,
  type RuntimeExperimentTrial,
} from "../../../src/index.js";

const subject = {
  playerKey: "player-1",
  arenaId: "arena-1",
  arenaGeneration: 4,
  connectionGeneration: 7,
  participationGeneration: 11,
  lifeGeneration: 3,
};

const base = {
  title: "Multiplayer session experiment",
  targetProfileFingerprint: "profile-a",
  fixtureFingerprint: "fixture-a",
  objectiveId: "session_test",
  participant: "violation_count",
  subject,
};

const leave = createJoinPadLeaveOwnershipExperiment({
  ...base,
  id: "exp:join-pad-leave",
});

const reconnect = createReconnectGenerationResetExperiment({
  ...base,
  id: "exp:reconnect-generation",
});

const death = createDeathDuringJoinExperiment({
  ...base,
  id: "exp:death-during-join",
});

function baseIdentity(
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

function leaveTrial(
  armId: "control" | "treatment",
  runIndex: number,
): RuntimeExperimentTrial {
  const treatment = armId === "treatment";
  const scope = {
    playerKey: subject.playerKey,
    connectionGeneration: subject.connectionGeneration,
    lifeGeneration: subject.lifeGeneration,
    participationGeneration:
      subject.participationGeneration,
    arenaId: subject.arenaId,
    arenaGeneration: subject.arenaGeneration,
  };
  return {
    schemaVersion: 1,
    id: armId + ":" + runIndex,
    identity: baseIdentity(leave, armId, runIndex),
    status: "completed",
    evidence: [{
      predicate: "stale-join-transition-observed",
      state: treatment ? "present" : "absent",
      confidence: "observed",
      scope,
    }, {
      predicate: "join-transition-requested",
      state: "present",
      confidence: "observed",
      scope: {
        ...scope,
        operationId: "join-request",
      },
    }, {
      predicate: "join-pad-left",
      state: "present",
      confidence: "observed",
      scope: {
        ...scope,
        operationId: "join-pad-leave",
      },
    }, {
      predicate: "arena-membership-current",
      state: "absent",
      confidence: "observed",
      scope: {
        ...scope,
        operationId: "post-leave",
      },
    }],
  };
}

function reconnectTrial(
  armId: "control" | "treatment",
  runIndex: number,
): RuntimeExperimentTrial {
  const treatment = armId === "treatment";
  const baseScope = {
    playerKey: subject.playerKey,
    lifeGeneration: subject.lifeGeneration,
    arenaId: subject.arenaId,
    arenaGeneration: subject.arenaGeneration,
  };
  return {
    schemaVersion: 1,
    id: armId + ":" + runIndex,
    identity: baseIdentity(
      reconnect,
      armId,
      runIndex,
    ),
    status: "completed",
    evidence: [{
      predicate: "stale-session-mutation-observed",
      state: treatment ? "present" : "absent",
      confidence: "observed",
      scope: {
        ...baseScope,
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
        ...baseScope,
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
        ...baseScope,
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
        ...baseScope,
        connectionGeneration:
          subject.connectionGeneration + 1,
        participationGeneration:
          subject.participationGeneration + 1,
        operationId: "reconnect-reconcile",
      },
    }],
  };
}

function deathTrial(
  armId: "control" | "treatment",
  runIndex: number,
): RuntimeExperimentTrial {
  const treatment = armId === "treatment";
  const baseScope = {
    playerKey: subject.playerKey,
    connectionGeneration:
      subject.connectionGeneration,
    arenaId: subject.arenaId,
    arenaGeneration: subject.arenaGeneration,
  };
  return {
    schemaVersion: 1,
    id: armId + ":" + runIndex,
    identity: baseIdentity(death, armId, runIndex),
    status: "completed",
    evidence: [{
      predicate: "stale-life-join-mutation-observed",
      state: treatment ? "present" : "absent",
      confidence: "observed",
      scope: {
        ...baseScope,
        lifeGeneration: subject.lifeGeneration + 1,
        participationGeneration:
          subject.participationGeneration + 1,
      },
    }, {
      predicate: "player-death-observed",
      state: "present",
      confidence: "observed",
      scope: {
        ...baseScope,
        lifeGeneration: subject.lifeGeneration,
        participationGeneration:
          subject.participationGeneration,
        operationId: "death",
      },
    }, {
      predicate: "player-respawn-observed",
      state: "present",
      confidence: "observed",
      scope: {
        ...baseScope,
        lifeGeneration: subject.lifeGeneration + 1,
        participationGeneration:
          subject.participationGeneration + 1,
        operationId: "respawn",
      },
    }, {
      predicate: "pending-join-invalidated",
      state: "present",
      confidence: "observed",
      scope: {
        ...baseScope,
        lifeGeneration: subject.lifeGeneration + 1,
        participationGeneration:
          subject.participationGeneration + 1,
        operationId: "respawn-reconcile",
      },
    }],
  };
}

function repeat(
  factory: (
    arm: "control" | "treatment",
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

describe("multiplayer session generation experiments", () => {
  it("defines valid join-leave, reconnect, and death-during-join contracts", () => {
    for (const definition of [
      leave,
      reconnect,
      death,
    ]) {
      expect(
        validateRuntimeExperimentDefinition(definition),
      ).toEqual([]);
      expect(definition.domain).toBe("multiplayer");
    }
  });

  it("publishes a valid session capability registry and passes preflight", () => {
    expect(
      validateRuntimeActionCapabilityRegistry(
        MULTIPLAYER_SESSION_CAPABILITY_REGISTRY,
      ),
    ).toEqual([]);

    for (const definition of [
      leave,
      reconnect,
      death,
    ]) {
      expect(
        preflightRuntimeExperimentCapabilities(
          definition,
          MULTIPLAYER_SESSION_CAPABILITY_REGISTRY,
          "LIVE_MINECRAFT",
        ).ready,
      ).toBe(true);
    }
  });

  it("promotes stale join transition only when leave and revoked-membership evidence are present", () => {
    const trials = repeat(leaveTrial);
    const qualification =
      qualifyRuntimeExperiment(leave, trials);

    expect(qualification).toMatchObject({
      state: "intervention-supported",
      expectedContrastMatches: [
        "stale-join-transition-observed",
      ],
    });

    const proof = experimentQualificationCausalProof(
      qualification,
      leave,
    );

    expect(proof.interventionProvenance).toEqual([
      expect.objectContaining({
        predicateId:
          "stale-join-transition-observed",
        controlledFactorContrasts: [{
          factorId: "membership-guard-enabled",
          controlValue: true,
          treatmentValue: false,
        }],
      }),
    ]);
  });

  it("promotes stale reconnect mutation only across a new connection and participation generation", () => {
    const qualification =
      qualifyRuntimeExperiment(
        reconnect,
        repeat(reconnectTrial),
      );

    expect(qualification).toMatchObject({
      state: "intervention-supported",
      expectedContrastMatches: [
        "stale-session-mutation-observed",
      ],
    });

    const proof = experimentQualificationCausalProof(
      qualification,
      reconnect,
    );

    expect(proof.interventionProvenance).toEqual([
      expect.objectContaining({
        predicateId:
          "stale-session-mutation-observed",
        controlledFactorContrasts: [{
          factorId:
            "connection-generation-guard-enabled",
          controlValue: true,
          treatmentValue: false,
        }],
      }),
    ]);
  });

  it("promotes stale join-after-respawn mutation only across a new life and participation generation", () => {
    const qualification =
      qualifyRuntimeExperiment(
        death,
        repeat(deathTrial),
      );

    expect(qualification).toMatchObject({
      state: "intervention-supported",
      expectedContrastMatches: [
        "stale-life-join-mutation-observed",
      ],
    });

    const proof = experimentQualificationCausalProof(
      qualification,
      death,
    );

    expect(proof.interventionProvenance).toEqual([
      expect.objectContaining({
        predicateId:
          "stale-life-join-mutation-observed",
        controlledFactorContrasts: [{
          factorId:
            "life-generation-guard-enabled",
          controlValue: true,
          treatmentValue: false,
        }],
      }),
    ]);
  });

  it("fails closed when supporting session lifecycle evidence is missing", () => {
    const incomplete = repeat(reconnectTrial)
      .map((trial) => ({
        ...trial,
        evidence: trial.evidence.filter(
          (record) =>
            record.predicate ===
              "stale-session-mutation-observed",
        ),
      }));

    const qualification =
      qualifyRuntimeExperiment(
        reconnect,
        incomplete,
      );

    expect(qualification.state).toBe("observed");
    expect(qualification.reasons.join(" ")).toMatch(
      /supporting evidence requirement/i,
    );
  });

  it("validates exact multiplayer runtime scope including participation generation", () => {
    const evidence = reconnectTrial(
      "control",
      0,
    ).evidence;

    expect(
      validateMultiplayerSessionEvidence(
        evidence,
        {
          playerKey: subject.playerKey,
          connectionGeneration:
            subject.connectionGeneration + 1,
          participationGeneration:
            subject.participationGeneration + 1,
          lifeGeneration: subject.lifeGeneration,
          arenaId: subject.arenaId,
          arenaGeneration:
            subject.arenaGeneration,
          operationId: "reconnect",
        },
        ["player-reconnected"],
      ),
    ).toEqual([]);

    expect(
      validateMultiplayerSessionEvidence(
        evidence,
        {
          playerKey: subject.playerKey,
          connectionGeneration:
            subject.connectionGeneration + 1,
          participationGeneration:
            subject.participationGeneration,
          arenaId: subject.arenaId,
          arenaGeneration:
            subject.arenaGeneration,
          operationId: "reconnect",
        },
        ["player-reconnected"],
      ).join(" "),
    ).toMatch(/expected runtime scope/i);
  });
});
