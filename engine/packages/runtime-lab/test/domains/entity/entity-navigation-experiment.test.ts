import { describe, expect, it } from "vitest";
import {
  ENTITY_NAVIGATION_CAPABILITY_REGISTRY,
  createNavigationCrowdingExperiment,
  createNavigationRecoveryExperiment,
  experimentQualificationCausalProof,
  preflightRuntimeExperimentCapabilities,
  qualifyRuntimeExperiment,
  runtimeExperimentDefinitionRevision,
  validateNavigationProgressEvidence,
  validateRuntimeActionCapabilityRegistry,
  validateRuntimeExperimentDefinition,
  type RuntimeExperimentDefinition,
  type RuntimeExperimentTrial,
} from "../../../src/index.js";

const subject = {
  arenaId: "arena-1",
  arenaGeneration: 2,
  entityKey: "zombie-1",
  entityGeneration: 4,
  targetKey: "player-1",
};

const recovery = createNavigationRecoveryExperiment({
  id: "exp:navigation-recovery",
  title: "Navigation recovery",
  targetProfileFingerprint: "profile-a",
  fixtureFingerprint: "fixture-a",
  objectiveId: "nav_recovery",
  participant: "trial_complete",
  subject,
  pathAnchorId: "route-anchor-1778--30-0",
});

const crowding = createNavigationCrowdingExperiment({
  id: "exp:navigation-crowding",
  title: "Navigation crowding differential",
  targetProfileFingerprint: "profile-a",
  fixtureFingerprint: "fixture-b",
  objectiveId: "nav_crowding",
  participant: "trial_complete",
  subject,
  controlNearbyEntityCount: 0,
  treatmentNearbyEntityCount: 5,
});

function baseEvidence(
  operationId: string,
  displacement: number,
  distanceReduction: number,
  nearbyEntityCount: number,
) {
  const scope = {
    arenaId: subject.arenaId,
    arenaGeneration: subject.arenaGeneration,
    entityKey: subject.entityKey,
    entityGeneration: subject.entityGeneration,
    operationId,
  };
  return [{
    predicate: "navigation-target-valid",
    state: "present" as const,
    confidence: "observed" as const,
    scope,
  }, {
    predicate: "navigation-goal-active",
    state: "present" as const,
    confidence: "observed" as const,
    scope,
  }, {
    predicate: "navigation-chunk-ready",
    state: "present" as const,
    confidence: "observed" as const,
    scope,
  }, {
    predicate: "navigation-progress-sampled",
    state: "present" as const,
    confidence: "observed" as const,
    scope,
    measurements: {
      windowTicks: 20,
      displacement,
      distanceToTargetReduction: distanceReduction,
      velocityMagnitude: displacement / 20,
      nearbyEntityCount,
    },
  }];
}

function recoveryTrial(
  id: string,
  armId: "control" | "treatment",
  runIndex: number,
): RuntimeExperimentTrial {
  const treatment = armId === "treatment";
  return {
    schemaVersion: 1,
    id,
    identity: {
      experimentId: recovery.id,
      definitionRevision:
        runtimeExperimentDefinitionRevision(recovery),
      armId,
      runIndex,
      targetProfileFingerprint:
        recovery.targetProfileFingerprint,
      fixtureFingerprint:
        recovery.fixtureFingerprint,
      environmentFingerprint: "env-a",
    },
    status: "completed",
    evidence: [
      ...baseEvidence(
        "pre-recovery",
        0.05,
        0.02,
        0,
      ),
      {
        predicate: "navigation-stall-observed",
        state: "present",
        confidence: "observed",
        scope: {
          arenaId: subject.arenaId,
          arenaGeneration: subject.arenaGeneration,
          entityKey: subject.entityKey,
          entityGeneration: subject.entityGeneration,
          operationId: "pre-recovery",
        },
      },
      ...baseEvidence(
        "post-recovery",
        treatment ? 2.0 : 0.05,
        treatment ? 1.5 : 0.02,
        0,
      ),
      {
        predicate: "navigation-recovery-applied",
        state: treatment ? "present" : "absent",
        confidence: "observed",
        scope: {
          arenaId: subject.arenaId,
          arenaGeneration: subject.arenaGeneration,
          entityKey: subject.entityKey,
          entityGeneration: subject.entityGeneration,
        },
      },
      {
        predicate: "movement-resumed-after-recovery",
        state: treatment ? "present" : "absent",
        confidence: "observed",
        scope: {
          arenaId: subject.arenaId,
          arenaGeneration: subject.arenaGeneration,
          entityKey: subject.entityKey,
          entityGeneration: subject.entityGeneration,
          operationId: "post-recovery",
        },
      },
    ],
  };
}

function crowdingTrial(
  id: string,
  armId: "control" | "treatment",
  runIndex: number,
): RuntimeExperimentTrial {
  const crowded = armId === "treatment";
  return {
    schemaVersion: 1,
    id,
    identity: {
      experimentId: crowding.id,
      definitionRevision:
        runtimeExperimentDefinitionRevision(crowding),
      armId,
      runIndex,
      targetProfileFingerprint:
        crowding.targetProfileFingerprint,
      fixtureFingerprint:
        crowding.fixtureFingerprint,
      environmentFingerprint: "env-a",
    },
    status: "completed",
    evidence: [
      ...baseEvidence(
        "crowd-window",
        crowded ? 0.05 : 2.0,
        crowded ? 0.02 : 1.5,
        crowded ? 5 : 0,
      ),
      {
        predicate: "navigation-stall-observed",
        state: crowded ? "present" : "absent",
        confidence: "observed",
        scope: {
          arenaId: subject.arenaId,
          arenaGeneration: subject.arenaGeneration,
          entityKey: subject.entityKey,
          entityGeneration: subject.entityGeneration,
          operationId: "crowd-window",
        },
      },
    ],
  };
}

describe("entity navigation runtime experiments", () => {
  it("defines valid guarded recovery and crowding experiments", () => {
    expect(
      validateRuntimeExperimentDefinition(recovery),
    ).toEqual([]);
    expect(
      validateRuntimeExperimentDefinition(crowding),
    ).toEqual([]);
    expect(recovery.domain).toBe("entity-ai");
    expect(crowding.domain).toBe("entity-ai");
  });

  it("publishes a valid capability registry and passes preflight", () => {
    expect(
      validateRuntimeActionCapabilityRegistry(
        ENTITY_NAVIGATION_CAPABILITY_REGISTRY,
      ),
    ).toEqual([]);

    expect(
      preflightRuntimeExperimentCapabilities(
        recovery,
        ENTITY_NAVIGATION_CAPABILITY_REGISTRY,
        "LIVE_MINECRAFT",
      ).ready,
    ).toBe(true);

    expect(
      preflightRuntimeExperimentCapabilities(
        crowding,
        ENTITY_NAVIGATION_CAPABILITY_REGISTRY,
        "LIVE_MINECRAFT",
      ).ready,
    ).toBe(true);
  });

  it("promotes bounded recovery only after pre-stall and post-recovery evidence are both present", () => {
    const trials = [
      recoveryTrial("c0", "control", 0),
      recoveryTrial("c1", "control", 1),
      recoveryTrial("t0", "treatment", 0),
      recoveryTrial("t1", "treatment", 1),
    ];
    const qualification =
      qualifyRuntimeExperiment(recovery, trials);

    expect(qualification).toMatchObject({
      state: "intervention-supported",
      expectedContrastMatches: [
        "movement-resumed-after-recovery",
      ],
    });

    const proof = experimentQualificationCausalProof(
      qualification,
      recovery,
    );

    expect(proof.interventionProvenance).toEqual([
      expect.objectContaining({
        predicateId:
          "movement-resumed-after-recovery",
        controlledFactorContrasts: [{
          factorId: "recovery-enabled",
          controlValue: false,
          treatmentValue: true,
        }],
      }),
    ]);
  });

  it("classifies crowding as a controlled causal factor when only the crowded arm stalls", () => {
    const trials = [
      crowdingTrial("c0", "control", 0),
      crowdingTrial("c1", "control", 1),
      crowdingTrial("t0", "treatment", 0),
      crowdingTrial("t1", "treatment", 1),
    ];
    const qualification =
      qualifyRuntimeExperiment(crowding, trials);

    expect(qualification).toMatchObject({
      state: "intervention-supported",
      expectedContrastMatches: [
        "navigation-stall-observed",
      ],
    });

    const proof = experimentQualificationCausalProof(
      qualification,
      crowding,
    );

    expect(proof.interventionProvenance).toEqual([
      expect.objectContaining({
        predicateId: "navigation-stall-observed",
        controlledFactorContrasts: [{
          factorId: "nearby-entity-count",
          controlValue: 0,
          treatmentValue: 5,
        }],
      }),
    ]);
  });

  it("validates measurable stall evidence only for the requested observation window", () => {
    const evidence = recoveryTrial(
      "t0",
      "treatment",
      0,
    ).evidence;

    expect(
      validateNavigationProgressEvidence(
        evidence,
        subject,
        0.25,
        "pre-recovery",
      ),
    ).toEqual([]);

    expect(
      validateNavigationProgressEvidence(
        evidence,
        subject,
        0.25,
        "post-recovery",
      ),
    ).toEqual([]);
  });

  it("rejects stall claims that conflict with measured movement progress", () => {
    const scope = {
      arenaId: subject.arenaId,
      arenaGeneration: subject.arenaGeneration,
      entityKey: subject.entityKey,
      entityGeneration: subject.entityGeneration,
      operationId: "crowd-window",
    };
    const evidence = [
      ...baseEvidence(
        "crowd-window",
        2.0,
        1.5,
        5,
      ),
      {
        predicate: "navigation-stall-observed",
        state: "present" as const,
        confidence: "observed" as const,
        scope,
      },
    ];

    expect(
      validateNavigationProgressEvidence(
        evidence,
        subject,
        0.25,
        "crowd-window",
      ).join(" "),
    ).toMatch(/conflicts with displacement/i);
  });

  it("fails qualification when target, goal, chunk, or progress support is missing", () => {
    const incomplete: RuntimeExperimentTrial[] = [{
      ...crowdingTrial("c0", "control", 0),
      evidence: [{
        predicate: "navigation-stall-observed",
        state: "absent",
        confidence: "observed",
      }],
    }, {
      ...crowdingTrial("c1", "control", 1),
      evidence: [{
        predicate: "navigation-stall-observed",
        state: "absent",
        confidence: "observed",
      }],
    }, {
      ...crowdingTrial("t0", "treatment", 0),
      evidence: [{
        predicate: "navigation-stall-observed",
        state: "present",
        confidence: "observed",
      }],
    }, {
      ...crowdingTrial("t1", "treatment", 1),
      evidence: [{
        predicate: "navigation-stall-observed",
        state: "present",
        confidence: "observed",
      }],
    }];

    const qualification =
      qualifyRuntimeExperiment(crowding, incomplete);

    expect(qualification.state).toBe("observed");
    expect(qualification.reasons.join(" ")).toMatch(
      /supporting evidence requirement/i,
    );
  });
});
