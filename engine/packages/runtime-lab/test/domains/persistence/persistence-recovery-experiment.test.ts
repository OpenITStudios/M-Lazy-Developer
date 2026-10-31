import { describe, expect, it } from "vitest";
import {
  PERSISTENCE_RECOVERY_CAPABILITY_REGISTRY,
  createJournalCrashRecoveryExperiment,
  createOrphanResourceRecoveryExperiment,
  createReloadReconciliationExperiment,
  experimentQualificationCausalProof,
  preflightRuntimeExperimentCapabilities,
  qualifyRuntimeExperiment,
  runtimeExperimentDefinitionRevision,
  validateRuntimeActionCapabilityRegistry,
  validateRuntimeExperimentDefinition,
  type RuntimeExperimentDefinition,
  type RuntimeExperimentTrial,
} from "../../../src/index.js";

const subject = {
  recordKey: "player:1",
  playerKey: "player-1",
  arenaId: "arena-1",
  arenaGeneration: 6,
  bootGeneration: 10,
};

const base = {
  title: "Persistence recovery",
  targetProfileFingerprint: "profile-a",
  fixtureFingerprint: "fixture-a",
  objectiveId: "persistence_test",
  participant: "violation_count",
  subject,
};

const reload = createReloadReconciliationExperiment({
  ...base,
  id: "exp:reload-reconcile",
});

const journal = createJournalCrashRecoveryExperiment({
  ...base,
  id: "exp:journal-recovery",
});

const orphan = createOrphanResourceRecoveryExperiment({
  ...base,
  id: "exp:orphan-recovery",
  resourceKey: "tickingarea:fixture",
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

function trial(
  definition: RuntimeExperimentDefinition,
  armId: "control" | "treatment",
  runIndex: number,
  evidence: RuntimeExperimentTrial["evidence"],
): RuntimeExperimentTrial {
  return {
    schemaVersion: 1,
    id: armId + ":" + runIndex,
    identity: identity(definition, armId, runIndex),
    status: "completed",
    evidence,
  };
}

function repeat(
  definition: RuntimeExperimentDefinition,
  evidenceFor: (
    armId: "control" | "treatment",
  ) => RuntimeExperimentTrial["evidence"],
): RuntimeExperimentTrial[] {
  return [
    trial(definition, "control", 0, evidenceFor("control")),
    trial(definition, "control", 1, evidenceFor("control")),
    trial(definition, "treatment", 0, evidenceFor("treatment")),
    trial(definition, "treatment", 1, evidenceFor("treatment")),
  ];
}

function reloadEvidence(
  armId: "control" | "treatment",
) {
  const control = armId === "control";
  const newBoot = subject.bootGeneration + 1;
  return [{
    predicate:
      "stale-transient-state-restored-observed",
    state: control ? "absent" as const : "present" as const,
    confidence: "observed" as const,
    scope: {
      playerKey: subject.playerKey,
      arenaId: subject.arenaId,
      arenaGeneration: subject.arenaGeneration,
      bootGeneration: newBoot,
    },
  }, {
    predicate: "boot-generation-active",
    state: "present" as const,
    confidence: "observed" as const,
    scope: {
      bootGeneration: newBoot,
    },
  }, {
    predicate: "durable-record-restored",
    state: "present" as const,
    confidence: "observed" as const,
    scope: {
      playerKey: subject.playerKey,
      arenaId: subject.arenaId,
      arenaGeneration: subject.arenaGeneration,
      bootGeneration: newBoot,
    },
    measurements: {
      schemaVersion: 1,
      recordGeneration: 1,
      durableValue: 42,
    },
  }, {
    predicate: "worldload-recovery-entered",
    state: "present" as const,
    confidence: "observed" as const,
    scope: {
      bootGeneration: newBoot,
    },
  }, ...(control ? [{
    predicate: "transient-session-state-cleared",
    state: "present" as const,
    confidence: "observed" as const,
    scope: {
      playerKey: subject.playerKey,
      arenaId: subject.arenaId,
      arenaGeneration: subject.arenaGeneration,
      bootGeneration: newBoot,
    },
  }] : [])];
}

function journalEvidence(
  armId: "control" | "treatment",
  finalApplyCount = 1,
) {
  const control = armId === "control";
  return [{
    predicate: "duplicate-apply-after-reload-observed",
    state: control ? "absent" as const : "present" as const,
    confidence: "observed" as const,
    scope: {
      bootGeneration: subject.bootGeneration + 1,
    },
  }, {
    predicate: "persistence-journal-prepared",
    state: "present" as const,
    confidence: "observed" as const,
    scope: {
      bootGeneration: subject.bootGeneration,
      operationId: "journal-prepared",
    },
    measurements: {
      journalGeneration: 1,
    },
  }, {
    predicate: "persistence-side-effect-applied",
    state: "present" as const,
    confidence: "observed" as const,
    scope: {
      bootGeneration: subject.bootGeneration,
      operationId: "side-effect-apply",
    },
    measurements: {
      applyCount: 1,
    },
  }, {
    predicate: "persistence-journal-recovery-entered",
    state: "present" as const,
    confidence: "observed" as const,
    scope: {
      bootGeneration: subject.bootGeneration + 1,
      operationId: "journal-recovery",
    },
  }, ...(control ? [{
    predicate: "persistence-recovery-converged",
    state: "present" as const,
    confidence: "observed" as const,
    scope: {
      bootGeneration: subject.bootGeneration + 1,
      operationId: "journal-recovery",
    },
    measurements: {
      finalApplyCount,
    },
  }] : [])];
}

function orphanEvidence(
  armId: "control" | "treatment",
) {
  const control = armId === "control";
  return [{
    predicate: "orphan-resource-retained-observed",
    state: control ? "absent" as const : "present" as const,
    confidence: "observed" as const,
    scope: {
      bootGeneration: subject.bootGeneration + 1,
    },
  }, {
    predicate: "orphan-resource-seeded",
    state: "present" as const,
    confidence: "observed" as const,
    scope: {
      bootGeneration: subject.bootGeneration,
      operationId: "orphan-seed",
    },
    measurements: {
      seededResources: 1,
    },
  }, {
    predicate: "orphan-resource-scan-complete",
    state: "present" as const,
    confidence: "observed" as const,
    scope: {
      bootGeneration: subject.bootGeneration + 1,
      operationId: "orphan-reconcile",
    },
    measurements: {
      discoveredResources: 1,
    },
  }, ...(control ? [{
    predicate: "orphan-resource-count-sampled",
    state: "present" as const,
    confidence: "observed" as const,
    scope: {
      bootGeneration: subject.bootGeneration + 1,
      operationId: "orphan-reconcile",
    },
    measurements: {
      remainingOrphans: 0,
    },
  }] : [])];
}

describe("persistence reload and recovery experiments", () => {
  it("defines valid reload, journal, and orphan recovery contracts", () => {
    for (const definition of [
      reload,
      journal,
      orphan,
    ]) {
      expect(
        validateRuntimeExperimentDefinition(definition),
      ).toEqual([]);
      expect(definition.domain).toBe("persistence");
    }
  });

  it("publishes valid persistence capabilities and passes preflight", () => {
    expect(
      validateRuntimeActionCapabilityRegistry(
        PERSISTENCE_RECOVERY_CAPABILITY_REGISTRY,
      ),
    ).toEqual([]);

    for (const definition of [
      reload,
      journal,
      orphan,
    ]) {
      expect(
        preflightRuntimeExperimentCapabilities(
          definition,
          PERSISTENCE_RECOVERY_CAPABILITY_REGISTRY,
          "LIVE_MINECRAFT",
        ).ready,
      ).toBe(true);
    }
  });

  it("promotes stale transient-state restoration only when durable state survived into a new boot", () => {
    const qualification =
      qualifyRuntimeExperiment(
        reload,
        repeat(reload, reloadEvidence),
      );

    expect(qualification).toMatchObject({
      state: "intervention-supported",
      expectedContrastMatches: [
        "stale-transient-state-restored-observed",
      ],
    });

    const proof = experimentQualificationCausalProof(
      qualification,
      reload,
    );

    expect(proof.interventionProvenance).toEqual([
      expect.objectContaining({
        predicateId:
          "stale-transient-state-restored-observed",
        controlledFactorContrasts: [{
          factorId: "reconciliation-enabled",
          controlValue: true,
          treatmentValue: false,
        }],
      }),
    ]);
  });

  it("promotes duplicate apply only after pre-crash journal/apply and post-reload recovery evidence are proven", () => {
    const qualification =
      qualifyRuntimeExperiment(
        journal,
        repeat(journal, journalEvidence),
      );

    expect(qualification).toMatchObject({
      state: "intervention-supported",
      expectedContrastMatches: [
        "duplicate-apply-after-reload-observed",
      ],
    });

    const proof = experimentQualificationCausalProof(
      qualification,
      journal,
    );

    expect(proof.interventionProvenance).toEqual([
      expect.objectContaining({
        predicateId:
          "duplicate-apply-after-reload-observed",
        controlledFactorContrasts: [{
          factorId:
            "idempotent-recovery-enabled",
          controlValue: true,
          treatmentValue: false,
        }],
      }),
    ]);
  });

  it("rejects journal recovery proof when final apply count does not converge", () => {
    const trials = repeat(journal, journalEvidence);
    trials[0] = trial(
      journal,
      "control",
      0,
      journalEvidence("control", 2),
    );

    const qualification =
      qualifyRuntimeExperiment(journal, trials);

    expect(qualification.state).toBe("observed");
    expect(qualification.reasons.join(" ")).toMatch(
      /supporting evidence requirement/i,
    );
  });

  it("promotes orphan retention only after old-boot resource seeding and new-boot scan evidence", () => {
    const qualification =
      qualifyRuntimeExperiment(
        orphan,
        repeat(orphan, orphanEvidence),
      );

    expect(qualification).toMatchObject({
      state: "intervention-supported",
      expectedContrastMatches: [
        "orphan-resource-retained-observed",
      ],
    });

    const proof = experimentQualificationCausalProof(
      qualification,
      orphan,
    );

    expect(proof.interventionProvenance).toEqual([
      expect.objectContaining({
        predicateId:
          "orphan-resource-retained-observed",
        controlledFactorContrasts: [{
          factorId:
            "orphan-reconciliation-enabled",
          controlValue: true,
          treatmentValue: false,
        }],
      }),
    ]);
  });

  it("fails closed when durable recovery evidence is attributed to the old boot", () => {
    const trials = repeat(reload, reloadEvidence);
    const control = trials[0]!;
    trials[0] = {
      ...control,
      evidence: control.evidence.map((record) =>
        record.predicate === "durable-record-restored"
          ? {
              ...record,
              scope: {
                ...record.scope,
                bootGeneration: subject.bootGeneration,
              },
            }
          : record
      ),
    };

    const qualification =
      qualifyRuntimeExperiment(reload, trials);

    expect(qualification.state).toBe("observed");
    expect(qualification.reasons.join(" ")).toMatch(
      /supporting evidence requirement/i,
    );
  });
});
