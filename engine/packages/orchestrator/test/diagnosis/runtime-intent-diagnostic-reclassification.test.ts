import { describe, expect, it } from "vitest";
import type {
  GameplayIntentModel,
} from "../../../gameplay-intent/src/index.js";
import type {
  RuntimeEvidenceIntegrityReport,
} from "../../../project-model/src/index.js";
import type {
  RuntimeExperimentDiagnosticBridge,
} from "../../src/index.js";
import {
  reclassifyIntentDiagnosticFromRuntime,
} from "../../src/index.js";

function intent(
  invariantStatus: "authored" | "inferred",
): GameplayIntentModel {
  return {
    schemaVersion: 1,
    id: "intent",
    evidence: [{
      id: "intent-evidence",
      origin: "source-code",
      locator: "scripts/main.ts",
      scope: "selected-artifact",
      summary: "Authored lifecycle evidence.",
    }],
    nodes: [{
      id: "arena",
      kind: "state",
      label: "Arena state",
      status: invariantStatus,
      evidenceIds: ["intent-evidence"],
    }],
    edges: [],
    invariants: [{
      id: "arena-invariant",
      statement: "Arena active requires membership.",
      strength: "must",
      status: invariantStatus,
      subjectIds: ["arena"],
      evidenceIds: ["intent-evidence"],
    }],
    unknowns: [],
  };
}

function bridge(
  items: readonly {
    predicate: string;
    state: "present" | "absent" | "unknown";
    ceiling:
      | "unknown"
      | "observed"
      | "repeatable"
      | "intervention-supported";
  }[],
): RuntimeExperimentDiagnosticBridge {
  return {
    experimentId: "exp",
    qualificationState: "observed",
    predicates: items.map((item) => ({
      predicate: item.predicate,
      observation: {
        predicate: item.predicate,
        state: item.state,
        evidenceId: "obs:" + item.predicate,
      },
      ceiling: item.ceiling,
      sourceEvidenceIds: [
        "evidence:" + item.predicate,
      ],
    })),
    observations: items.map((item) => ({
      predicate: item.predicate,
      state: item.state,
      evidenceId: "obs:" + item.predicate,
    })),
  };
}

const integrity: RuntimeEvidenceIntegrityReport = {
  records: 2,
  observedRecords: 2,
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

describe("runtime intent diagnostic reclassification", () => {
  it("confirms an authored-intent defect after runtime contradiction proof arrives", () => {
    const result =
      reclassifyIntentDiagnosticFromRuntime({
        intent: intent("authored"),
        subjectIds: ["arena"],
        bridge: bridge([
          {
            predicate: "membership-contradiction",
            state: "present",
            ceiling: "observed",
          },
          {
            predicate: "runtime-semantics-observed",
            state: "present",
            ceiling: "observed",
          },
        ]),
        bindings: {
          contradictionPredicates: [
            "membership-contradiction",
          ],
          runtimeProofPredicates: [
            "runtime-semantics-observed",
          ],
        },
        runtimeProofRequired: true,
        runtimeIntegrity: integrity,
        previousDisposition:
          "runtime-proof-required",
      });

    expect(result.disposition).toBe(
      "confirmed-defect",
    );
    expect(result.changed).toBe(true);
    expect(
      result.matchedPredicates.contradictions,
    ).toEqual(["membership-contradiction"]);
  });

  it("requires runtime evidence integrity before confirming a runtime-backed authored defect", () => {
    const result =
      reclassifyIntentDiagnosticFromRuntime({
        intent: intent("authored"),
        subjectIds: ["arena"],
        bridge: bridge([
          {
            predicate: "membership-contradiction",
            state: "present",
            ceiling: "observed",
          },
          {
            predicate: "runtime-semantics-observed",
            state: "present",
            ceiling: "observed",
          },
        ]),
        bindings: {
          contradictionPredicates: [
            "membership-contradiction",
          ],
          runtimeProofPredicates: [
            "runtime-semantics-observed",
          ],
        },
        runtimeProofRequired: true,
      });

    expect(result.disposition).toBe(
      "runtime-proof-required",
    );
    expect(result.gate.nextEvidenceNeed).toBe(
      "runtime-evidence-integrity",
    );
  });

  it("does not accept unsafe runtime evidence integrity for confirmation", () => {
    const result =
      reclassifyIntentDiagnosticFromRuntime({
        intent: intent("authored"),
        subjectIds: ["arena"],
        bridge: bridge([
          {
            predicate: "membership-contradiction",
            state: "present",
            ceiling: "observed",
          },
          {
            predicate: "runtime-semantics-observed",
            state: "present",
            ceiling: "observed",
          },
        ]),
        bindings: {
          contradictionPredicates: [
            "membership-contradiction",
          ],
          runtimeProofPredicates: [
            "runtime-semantics-observed",
          ],
        },
        runtimeProofRequired: true,
        runtimeIntegrity: {
          ...integrity,
          safeForCurrentStateClaims: false,
          reasons: ["conflicting runtime evidence"],
        },
      });

    expect(result.disposition).toBe(
      "runtime-proof-required",
    );
    expect(result.gate.nextEvidenceNeed).toBe(
      "runtime-evidence-integrity",
    );
  });

  it("uses arm-scoped treatment evidence without collapsing deterministic contrast into global ambiguity", () => {
    const armBridge: RuntimeExperimentDiagnosticBridge = {
      experimentId: "exp",
      qualificationState: "intervention-supported",
      predicates: [{
        predicate: "membership-contradiction",
        observation: {
          predicate: "membership-contradiction",
          state: "unknown",
          evidenceId: "obs:membership-contradiction",
        },
        ceiling: "intervention-supported",
        sourceEvidenceIds: [
          "evidence:control",
          "evidence:treatment",
        ],
        interventionContrast: true,
        armObservations: [{
          armId: "control",
          observation: {
            predicate: "membership-contradiction",
            state: "absent",
            evidenceId: "obs:membership-contradiction:control",
          },
          sourceEvidenceIds: ["evidence:control"],
        }, {
          armId: "treatment",
          observation: {
            predicate: "membership-contradiction",
            state: "present",
            evidenceId: "obs:membership-contradiction:treatment",
          },
          sourceEvidenceIds: ["evidence:treatment"],
        }],
      }, {
        predicate: "runtime-semantics-observed",
        observation: {
          predicate: "runtime-semantics-observed",
          state: "unknown",
          evidenceId: "obs:runtime-semantics-observed",
        },
        ceiling: "intervention-supported",
        sourceEvidenceIds: [
          "runtime:control",
          "runtime:treatment",
        ],
        interventionContrast: true,
        armObservations: [{
          armId: "control",
          observation: {
            predicate: "runtime-semantics-observed",
            state: "absent",
            evidenceId: "obs:runtime-semantics-observed:control",
          },
          sourceEvidenceIds: ["runtime:control"],
        }, {
          armId: "treatment",
          observation: {
            predicate: "runtime-semantics-observed",
            state: "present",
            evidenceId: "obs:runtime-semantics-observed:treatment",
          },
          sourceEvidenceIds: ["runtime:treatment"],
        }],
      }],
      observations: [{
        predicate: "membership-contradiction",
        state: "unknown",
        evidenceId: "obs:membership-contradiction",
      }, {
        predicate: "runtime-semantics-observed",
        state: "unknown",
        evidenceId: "obs:runtime-semantics-observed",
      }],
    };

    const result =
      reclassifyIntentDiagnosticFromRuntime({
        intent: intent("authored"),
        subjectIds: ["arena"],
        bridge: armBridge,
        bindings: {
          contradictionArmPredicates: [{
            predicate: "membership-contradiction",
            armId: "treatment",
          }],
          runtimeProofArmPredicates: [{
            predicate: "runtime-semantics-observed",
            armId: "treatment",
          }],
        },
        runtimeProofRequired: true,
        runtimeIntegrity: integrity,
      });

    expect(result.disposition).toBe(
      "confirmed-defect",
    );
    expect(
      result.matchedPredicates.contradictions,
    ).toEqual([
      "membership-contradiction@arm:treatment",
    ]);
    expect(
      result.matchedPredicates.runtimeProof,
    ).toEqual([
      "runtime-semantics-observed@arm:treatment",
    ]);
    expect(result.gate.evidenceIds).toContain(
      "evidence:treatment",
    );
    expect(result.gate.evidenceIds).toContain(
      "evidence:control",
    );
  });

  it("confirms only when role, state, intervention contrast, and expected direction all match", () => {
    const roleBridge: RuntimeExperimentDiagnosticBridge = {
      experimentId: "exp",
      qualificationState: "intervention-supported",
      predicates: [{
        predicate: "membership-contradiction",
        observation: {
          predicate: "membership-contradiction",
          state: "unknown",
          evidenceId: "obs:membership-contradiction",
        },
        ceiling: "intervention-supported",
        sourceEvidenceIds: [
          "evidence:control",
          "evidence:treatment",
        ],
        interventionContrast: true,
        expectedContrastDisposition: "matched",
        observedContrast: {
          controlState: "absent",
          treatmentState: "present",
        },
        armObservations: [{
          armId: "baseline",
          role: "control",
          observation: {
            predicate: "membership-contradiction",
            state: "absent",
            evidenceId: "obs:membership-contradiction:control",
          },
          sourceEvidenceIds: ["evidence:control"],
        }, {
          armId: "candidate",
          role: "treatment",
          observation: {
            predicate: "membership-contradiction",
            state: "present",
            evidenceId: "obs:membership-contradiction:treatment",
          },
          sourceEvidenceIds: ["evidence:treatment"],
        }],
      }, {
        predicate: "runtime-semantics-observed",
        observation: {
          predicate: "runtime-semantics-observed",
          state: "unknown",
          evidenceId: "obs:runtime-semantics-observed",
        },
        ceiling: "intervention-supported",
        sourceEvidenceIds: [
          "runtime:control",
          "runtime:treatment",
        ],
        interventionContrast: true,
        expectedContrastDisposition: "matched",
        observedContrast: {
          controlState: "absent",
          treatmentState: "present",
        },
        armObservations: [{
          armId: "baseline",
          role: "control",
          observation: {
            predicate: "runtime-semantics-observed",
            state: "absent",
            evidenceId: "obs:runtime-semantics-observed:control",
          },
          sourceEvidenceIds: ["runtime:control"],
        }, {
          armId: "candidate",
          role: "treatment",
          observation: {
            predicate: "runtime-semantics-observed",
            state: "present",
            evidenceId: "obs:runtime-semantics-observed:treatment",
          },
          sourceEvidenceIds: ["runtime:treatment"],
        }],
      }],
      observations: [],
    };

    const result =
      reclassifyIntentDiagnosticFromRuntime({
        intent: intent("authored"),
        subjectIds: ["arena"],
        bridge: roleBridge,
        bindings: {
          contradictionRolePredicates: [{
            predicate: "membership-contradiction",
            role: "treatment",
            state: "present",
            requireInterventionContrast: true,
            requireExpectedContrast: true,
          }],
          runtimeProofRolePredicates: [{
            predicate: "runtime-semantics-observed",
            role: "treatment",
            state: "present",
            requireInterventionContrast: true,
            requireExpectedContrast: true,
          }],
        },
        runtimeProofRequired: true,
        runtimeIntegrity: integrity,
      });

    expect(result.disposition).toBe(
      "confirmed-defect",
    );
    expect(result.matchedPredicates.contradictions).toEqual([
      "membership-contradiction@role:treatment=present",
    ]);
  });

  it("does not promote role-scoped evidence when deterministic contrast direction contradicts the experiment definition", () => {
    const mismatchedBridge: RuntimeExperimentDiagnosticBridge = {
      experimentId: "exp",
      qualificationState: "intervention-supported",
      predicates: [{
        predicate: "membership-contradiction",
        observation: {
          predicate: "membership-contradiction",
          state: "unknown",
          evidenceId: "obs:membership-contradiction",
        },
        ceiling: "intervention-supported",
        sourceEvidenceIds: [
          "evidence:control",
          "evidence:treatment",
        ],
        interventionContrast: true,
        expectedContrastDisposition: "mismatched",
        observedContrast: {
          controlState: "present",
          treatmentState: "absent",
        },
        armObservations: [{
          armId: "baseline",
          role: "control",
          observation: {
            predicate: "membership-contradiction",
            state: "present",
            evidenceId: "obs:membership-contradiction:control",
          },
          sourceEvidenceIds: ["evidence:control"],
        }, {
          armId: "candidate",
          role: "treatment",
          observation: {
            predicate: "membership-contradiction",
            state: "absent",
            evidenceId: "obs:membership-contradiction:treatment",
          },
          sourceEvidenceIds: ["evidence:treatment"],
        }],
      }],
      observations: [],
    };

    const result =
      reclassifyIntentDiagnosticFromRuntime({
        intent: intent("authored"),
        subjectIds: ["arena"],
        bridge: mismatchedBridge,
        bindings: {
          contradictionRolePredicates: [{
            predicate: "membership-contradiction",
            role: "control",
            state: "present",
            requireInterventionContrast: true,
            requireExpectedContrast: true,
          }],
        },
      });

    expect(result.disposition).toBe(
      "insufficient-evidence",
    );
    expect(
      result.matchedPredicates.contradictions,
    ).toEqual([]);
  });

  it("keeps inferred intent contradictions ambiguous", () => {
    const result =
      reclassifyIntentDiagnosticFromRuntime({
        intent: intent("inferred"),
        subjectIds: ["arena"],
        bridge: bridge([{
          predicate: "membership-contradiction",
          state: "present",
          ceiling: "repeatable",
        }]),
        bindings: {
          contradictionPredicates: [
            "membership-contradiction",
          ],
        },
      });

    expect(result.disposition).toBe(
      "ambiguous-intent",
    );
  });

  it("keeps runtime-proof-required when the required runtime predicate remains unknown", () => {
    const result =
      reclassifyIntentDiagnosticFromRuntime({
        intent: intent("authored"),
        subjectIds: ["arena"],
        bridge: bridge([{
          predicate: "runtime-semantics-observed",
          state: "unknown",
          ceiling: "observed",
        }]),
        bindings: {
          runtimeProofPredicates: [
            "runtime-semantics-observed",
          ],
        },
        runtimeProofRequired: true,
      });

    expect(result.disposition).toBe(
      "runtime-proof-required",
    );
  });

  it("classifies direct runtime design matches as designed behavior", () => {
    const result =
      reclassifyIntentDiagnosticFromRuntime({
        intent: intent("authored"),
        subjectIds: ["arena"],
        bridge: bridge([{
          predicate: "matches-design",
          state: "present",
          ceiling: "observed",
        }]),
        bindings: {
          designMatchPredicates: [
            "matches-design",
          ],
        },
      });

    expect(result.disposition).toBe(
      "designed-behavior",
    );
  });

  it("does not use conflicting runtime observations as contradiction evidence", () => {
    const result =
      reclassifyIntentDiagnosticFromRuntime({
        intent: intent("authored"),
        subjectIds: ["arena"],
        bridge: bridge([{
          predicate: "membership-contradiction",
          state: "unknown",
          ceiling: "repeatable",
        }]),
        bindings: {
          contradictionPredicates: [
            "membership-contradiction",
          ],
        },
      });

    expect(result.disposition).toBe(
      "insufficient-evidence",
    );
    expect(
      result.matchedPredicates.contradictions,
    ).toEqual([]);
  });
});
