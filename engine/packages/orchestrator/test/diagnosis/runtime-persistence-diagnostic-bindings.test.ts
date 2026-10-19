import { describe, expect, it } from "vitest";
import type {
  GameplayIntentModel,
} from "../../../gameplay-intent/src/index.js";
import type {
  RuntimeEvidenceIntegrityReport,
  RuntimeEvidenceRecord,
} from "../../../project-model/src/index.js";
import {
  createJournalCrashRecoveryExperiment,
  createReloadReconciliationExperiment,
  qualifyRuntimeExperiment,
  runtimeExperimentDefinitionRevision,
  type RuntimeExperimentDefinition,
  type RuntimeExperimentTrial,
} from "../../../runtime-lab/src/index.js";
import {
  PERSISTENCE_DUPLICATE_APPLY_DIAGNOSTIC_BINDINGS,
  PERSISTENCE_TRANSIENT_RESTORE_DIAGNOSTIC_BINDINGS,
  reclassifyIntentDiagnosticFromRuntime,
  runtimeExperimentDiagnosticEvidence,
} from "../../src/index.js";

function authoredIntent(subjectId: string): GameplayIntentModel {
  return {
    schemaVersion: 1,
    id: "persistence-intent",
    evidence: [{
      id: "intent-evidence",
      origin: "source-code",
      locator: "scripts/persistence.ts",
      scope: "selected-artifact",
      summary: "Authored persistence recovery invariant.",
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
      id: "persistence-invariant",
      statement:
        "Reload recovery must restore durable state without resurrecting transient authority or duplicating committed side effects.",
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

const subject = {
  recordKey: "player:1",
  playerKey: "player-1",
  arenaId: "arena-1",
  arenaGeneration: 6,
  bootGeneration: 10,
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
    | typeof PERSISTENCE_TRANSIENT_RESTORE_DIAGNOSTIC_BINDINGS
    | typeof PERSISTENCE_DUPLICATE_APPLY_DIAGNOSTIC_BINDINGS,
  runtimeIntegrity = integrity,
) {
  const qualification =
    qualifyRuntimeExperiment(definition, trials);
  const bridge =
    runtimeExperimentDiagnosticEvidence(
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

describe("persistence runtime diagnostic bindings", () => {
  it("confirms stale transient restoration only from matched reload reconciliation evidence", () => {
    const definition =
      createReloadReconciliationExperiment({
        id: "exp:reload-reconcile",
        title: "Reload reconciliation",
        targetProfileFingerprint: "profile-a",
        fixtureFingerprint: "fixture-a",
        objectiveId: "persistence",
        participant: "stale_transient",
        subject,
      });
    const newBoot = subject.bootGeneration + 1;

    const trials = repeat(
      definition,
      (armId) => [{
        predicate:
          "stale-transient-state-restored-observed",
        state:
          armId === "control"
            ? "absent"
            : "present",
        confidence: "observed",
        scope: {
          playerKey: subject.playerKey,
          arenaId: subject.arenaId,
          arenaGeneration:
            subject.arenaGeneration,
          bootGeneration: newBoot,
        },
      }, {
        predicate: "boot-generation-active",
        state: "present",
        confidence: "observed",
        scope: {
          bootGeneration: newBoot,
        },
      }, {
        predicate: "durable-record-restored",
        state: "present",
        confidence: "observed",
        scope: {
          playerKey: subject.playerKey,
          arenaId: subject.arenaId,
          arenaGeneration:
            subject.arenaGeneration,
          bootGeneration: newBoot,
        },
        measurements: {
          schemaVersion: 1,
          recordGeneration: 1,
          durableValue: 42,
        },
      }, {
        predicate: "worldload-recovery-entered",
        state: "present",
        confidence: "observed",
        scope: {
          bootGeneration: newBoot,
        },
      }, ...(armId === "control" ? [{
        predicate: "transient-session-state-cleared",
        state: "present" as const,
        confidence: "observed" as const,
        scope: {
          playerKey: subject.playerKey,
          arenaId: subject.arenaId,
          arenaGeneration:
            subject.arenaGeneration,
          bootGeneration: newBoot,
        },
      }] : [])],
    );

    const result = classify(
      "reload-reconciliation",
      definition,
      trials,
      PERSISTENCE_TRANSIENT_RESTORE_DIAGNOSTIC_BINDINGS,
    );

    expect(result.disposition).toBe(
      "confirmed-defect",
    );
    expect(
      result.matchedPredicates.contradictions,
    ).toEqual([
      "stale-transient-state-restored-observed@role:treatment=present",
    ]);
  });

  it("confirms duplicate apply after reload only from matched idempotent recovery contrast", () => {
    const definition =
      createJournalCrashRecoveryExperiment({
        id: "exp:journal-recovery",
        title: "Journal recovery",
        targetProfileFingerprint: "profile-a",
        fixtureFingerprint: "fixture-b",
        objectiveId: "journal",
        participant: "duplicate_apply",
        subject,
      });
    const newBoot = subject.bootGeneration + 1;

    const trials = repeat(
      definition,
      (armId) => [{
        predicate:
          "duplicate-apply-after-reload-observed",
        state:
          armId === "control"
            ? "absent"
            : "present",
        confidence: "observed",
        scope: {
          bootGeneration: newBoot,
        },
      }, {
        predicate: "persistence-journal-prepared",
        state: "present",
        confidence: "observed",
        scope: {
          bootGeneration: subject.bootGeneration,
          operationId: "journal-prepared",
        },
        measurements: {
          journalGeneration: 1,
        },
      }, {
        predicate:
          "persistence-side-effect-applied",
        state: "present",
        confidence: "observed",
        scope: {
          bootGeneration: subject.bootGeneration,
          operationId: "side-effect-apply",
        },
        measurements: {
          applyCount: 1,
        },
      }, {
        predicate:
          "persistence-journal-recovery-entered",
        state: "present",
        confidence: "observed",
        scope: {
          bootGeneration: newBoot,
          operationId: "journal-recovery",
        },
      }, ...(armId === "control" ? [{
        predicate: "persistence-recovery-converged",
        state: "present" as const,
        confidence: "observed" as const,
        scope: {
          bootGeneration: newBoot,
          operationId: "journal-recovery",
        },
        measurements: {
          finalApplyCount: 1,
        },
      }] : [])],
    );

    const result = classify(
      "journal-recovery",
      definition,
      trials,
      PERSISTENCE_DUPLICATE_APPLY_DIAGNOSTIC_BINDINGS,
    );

    expect(result.disposition).toBe(
      "confirmed-defect",
    );
  });

  it("keeps persistence runtime violations unconfirmed when evidence integrity is unsafe", () => {
    const definition =
      createReloadReconciliationExperiment({
        id: "exp:reload-unsafe",
        title: "Reload reconciliation",
        targetProfileFingerprint: "profile-a",
        fixtureFingerprint: "fixture-c",
        objectiveId: "persistence",
        participant: "stale_transient",
        subject,
      });
    const newBoot = subject.bootGeneration + 1;

    const evidenceFor = (
      armId: "control" | "treatment",
    ): readonly RuntimeEvidenceRecord[] => [{
      predicate:
        "stale-transient-state-restored-observed",
      state:
        armId === "control"
          ? "absent"
          : "present",
      confidence: "observed",
      scope: {
        playerKey: subject.playerKey,
        arenaId: subject.arenaId,
        arenaGeneration:
          subject.arenaGeneration,
        bootGeneration: newBoot,
      },
    }, {
      predicate: "boot-generation-active",
      state: "present",
      confidence: "observed",
      scope: { bootGeneration: newBoot },
    }, {
      predicate: "durable-record-restored",
      state: "present",
      confidence: "observed",
      scope: {
        playerKey: subject.playerKey,
        arenaId: subject.arenaId,
        arenaGeneration:
          subject.arenaGeneration,
        bootGeneration: newBoot,
      },
      measurements: {
        schemaVersion: 1,
        recordGeneration: 1,
        durableValue: 42,
      },
    }, {
      predicate: "worldload-recovery-entered",
      state: "present",
      confidence: "observed",
      scope: { bootGeneration: newBoot },
    }, ...(armId === "control" ? [{
      predicate: "transient-session-state-cleared",
      state: "present" as const,
      confidence: "observed" as const,
      scope: {
        playerKey: subject.playerKey,
        arenaId: subject.arenaId,
        arenaGeneration:
          subject.arenaGeneration,
        bootGeneration: newBoot,
      },
    }] : [])];

    const result = classify(
      "reload-reconciliation",
      definition,
      repeat(definition, evidenceFor),
      PERSISTENCE_TRANSIENT_RESTORE_DIAGNOSTIC_BINDINGS,
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
