// Owner-local same-feature test suite consolidation (source-only).
import { describe, expect, it } from "vitest";
import { gateIntentDiagnostic, gateObservedOutcomeAgainstIntent, gateRuntimeStateOutcomeAgainstIntent } from "../src/index.js";
import { type GameplayIntentModel } from "../../gameplay-intent/src/index.js";
import { type RuntimeStateSnapshot } from "../../project-model/src/index.js";

// Original suite: engine/packages/diagnostic-reasoning/test/intent-gate.test.ts (blob ea33db3b6ef1caf741e27a27689678e2d26e72ae)
{


function model(
  invariantStatus: "authored" | "inferred" = "authored",
  withUnknown = false,
  evidenceScope:
    | "selected-artifact"
    | "external-reference" = "selected-artifact",
): GameplayIntentModel {
  return {
    schemaVersion: 1,
    id: "arena-game",
    artifactId: "artifact:v1",
    evidence: [{
      id: "e:intent",
      origin: "source-code",
      locator: "behavior_packs/demo/scripts/session.js",
      summary: "Cleanup behavior.",
      scope: evidenceScope,
    }],
    nodes: [{
      id: "lifecycle:cleanup",
      kind: "lifecycle",
      label: "Cleanup",
      status: invariantStatus,
      evidenceIds: ["e:intent"],
    }],
    edges: [],
    invariants: [{
      id: "inv:cleanup",
      statement: "Cleanup returns the arena to reusable state.",
      strength: "must",
      status: invariantStatus,
      subjectIds: ["lifecycle:cleanup"],
      evidenceIds: ["e:intent"],
    }],
    unknowns: withUnknown ? [{
      id: "unknown:cleanup-owner",
      question: "Which subsystem owns final cleanup?",
      blockedSubjectIds: ["lifecycle:cleanup"],
    }] : [],
  };
}

describe("intent diagnostic gate", () => {
  it("confirms a contradiction against selected-artifact authored intent", () => {
    expect(gateIntentDiagnostic({
      intent: model(),
      subjectIds: ["lifecycle:cleanup"],
      observationEvidenceIds: ["runtime:arena-not-reusable"],
      contradictionEvidenceIds: ["trace:cleanup-complete-but-state-dirty"],
    }).disposition).toBe("confirmed-defect");
  });

  it("blocks when expected behavior exists only in external/reference material", () => {
    const result = gateIntentDiagnostic({
      intent: model("authored", false, "external-reference"),
      subjectIds: ["lifecycle:cleanup"],
      observationEvidenceIds: ["runtime:arena-not-reusable"],
      contradictionEvidenceIds: ["trace:cleanup-complete-but-state-dirty"],
    });

    expect(result.disposition).toBe("ambiguous-intent");
  });

  it("blocks when selected-artifact intent is inferred rather than grounded", () => {
    const result = gateIntentDiagnostic({
      intent: model("inferred"),
      subjectIds: ["lifecycle:cleanup"],
      observationEvidenceIds: ["runtime:arena-not-reusable"],
      contradictionEvidenceIds: ["trace:cleanup-complete-but-state-dirty"],
    });

    expect(result.disposition).toBe("ambiguous-intent");
  });

  it("blocks while material intent inside the selected artifact is unresolved", () => {
    expect(gateIntentDiagnostic({
      intent: model("authored", true),
      subjectIds: ["lifecycle:cleanup"],
      observationEvidenceIds: ["runtime:arena-not-reusable"],
      contradictionEvidenceIds: ["trace:cleanup-complete-but-state-dirty"],
    }).disposition).toBe("ambiguous-intent");
  });

  it("can classify selected-artifact behavior as designed when direct matching evidence exists", () => {
    expect(gateIntentDiagnostic({
      intent: model(),
      subjectIds: ["lifecycle:cleanup"],
      observationEvidenceIds: ["runtime:cleanup-delay"],
      designMatchEvidenceIds: ["artifact:cleanup-delay-policy"],
    }).disposition).toBe("designed-behavior");
  });



  it("requires runtime evidence integrity when runtime proof is required", () => {
    const result = gateIntentDiagnostic({
      intent: model(),
      subjectIds: ["lifecycle:cleanup"],
      observationEvidenceIds: ["runtime:arena-not-reusable"],
      contradictionEvidenceIds: ["trace:cleanup-complete-but-state-dirty"],
      runtimeProofRequired: true,
      runtimeProofEvidenceIds: ["runtime:cleanup-proof"],
      runtimeEvidenceIntegritySatisfied: false,
    });

    expect(result.disposition).toBe("runtime-proof-required");
    expect(result.nextEvidenceNeed).toBe("runtime-evidence-integrity");
  });
});
}

// Original suite: engine/packages/diagnostic-reasoning/test/observed-outcome-intent.test.ts (blob 29fc7656fe5ae3246c6173a3f7734495ab0f055e)
{


function policyModel(
  withUnknown = false,
): GameplayIntentModel {
  return {
    schemaVersion: 1,
    id: "reconnect-policy",
    artifactId: "artifact:reconnect",
    evidence: [{
      id: "e:policy",
      origin: "source-code",
      locator: "src/recovery-policy.ts",
      summary: "Direct guarded cleanup outcome.",
      scope: "selected-artifact",
    }],
    nodes: [
      {
        id: "outcome:cleanup",
        kind: "outcome",
        label: "Cleanup",
        status: "authored",
        evidenceIds: ["e:policy"],
      },
      {
        id: "policy:pending-cleanup",
        kind: "policy",
        label: "Pending Cleanup",
        status: "authored",
        evidenceIds: ["e:policy"],
        policyPredicate: {
          kind: "truthy",
          operand: {
            kind: "path",
            path: "state.pendingCleanup",
          },
        },
      },
    ],
    edges: [{
      id: "edge:cleanup-policy",
      from: "outcome:cleanup",
      to: "policy:pending-cleanup",
      kind: "requires",
      status: "authored",
      evidenceIds: ["e:policy"],
    }],
    invariants: [{
      id: "inv:admissible-policy:outcome:cleanup",
      statement: "Cleanup is statically observed only under pending cleanup.",
      strength: "must",
      status: "inferred",
      subjectIds: ["outcome:cleanup"],
      evidenceIds: ["e:policy"],
    }],
    unknowns: withUnknown
      ? [{
          id: "unknown:coverage",
          question: "Other cleanup branches are unresolved.",
          blockedSubjectIds: ["outcome:cleanup"],
        }]
      : [],
  };
}

describe("observed outcome intent gate", () => {
  it("classifies a policy-satisfied outcome as designed behavior", () => {
    expect(
      gateObservedOutcomeAgainstIntent({
        intent: policyModel(),
        outcomeId: "outcome:cleanup",
        stateValues: {
          state: {
            pendingCleanup: true,
          },
        },
        observationEvidenceIds: ["runtime:cleanup"],
      }).disposition,
    ).toBe("designed-behavior");
  });

  it("caps a policy-violating outcome at ambiguous outcome", () => {
    const result = gateObservedOutcomeAgainstIntent({
      intent: policyModel(),
      outcomeId: "outcome:cleanup",
      stateValues: {
        state: {
          pendingCleanup: false,
        },
      },
      observationEvidenceIds: ["runtime:cleanup"],
    });

    expect(result.disposition).toBe("ambiguous-intent");
    expect(result.basisInvariantIds).toEqual([
      "inv:admissible-policy:outcome:cleanup",
    ]);
  });

  it("preserves ambiguity when policy coverage is unresolved", () => {
    expect(
      gateObservedOutcomeAgainstIntent({
        intent: policyModel(true),
        outcomeId: "outcome:cleanup",
        stateValues: {
          state: {
            pendingCleanup: false,
          },
        },
        observationEvidenceIds: ["runtime:cleanup"],
      }).disposition,
    ).toBe("ambiguous-intent");
  });
});
}

// Original suite: engine/packages/diagnostic-reasoning/test/runtime-state-outcome-intent.test.ts (blob 03ebdde77cd3a7e15febb1d832cfd34d4a227978)
{


function model(): GameplayIntentModel {
  return {
    schemaVersion: 1,
    id: "reconnect-policy",
    artifactId: "artifact:reconnect",
    evidence: [{
      id: "e:policy",
      origin: "source-code",
      locator: "src/recovery-policy.ts",
      summary: "Authored cleanup policy.",
      scope: "selected-artifact",
    }],
    nodes: [
      {
        id: "outcome:cleanup",
        kind: "outcome",
        label: "Cleanup",
        status: "authored",
        evidenceIds: ["e:policy"],
      },
      {
        id: "policy:pending-cleanup",
        kind: "policy",
        label: "Pending Cleanup",
        status: "authored",
        evidenceIds: ["e:policy"],
        policyPredicate: {
          kind: "truthy",
          operand: {
            kind: "path",
            path: "record.pendingCleanup",
          },
        },
      },
    ],
    edges: [{
      id: "edge:cleanup-policy",
      from: "outcome:cleanup",
      to: "policy:pending-cleanup",
      kind: "requires",
      status: "authored",
      evidenceIds: ["e:policy"],
    }],
    invariants: [{
      id: "inv:admissible-policy:outcome:cleanup",
      statement: "Cleanup is admissible only under modeled guards.",
      strength: "must",
      status: "inferred",
      subjectIds: ["outcome:cleanup"],
      evidenceIds: ["e:policy"],
    }],
    unknowns: [],
  };
}

describe("runtime state outcome intent gate", () => {
  it("classifies policy-satisfied runtime state as designed behavior", () => {
    const snapshot: RuntimeStateSnapshot = {
      schemaVersion: 1,
      observations: [{
        path: "record.pendingCleanup",
        value: true,
        confidence: "observed",
        origin: "runtime-probe",
        evidenceId: "e:runtime-cleanup",
      }],
    };

    const result = gateRuntimeStateOutcomeAgainstIntent({
      intent: model(),
      outcomeId: "outcome:cleanup",
      stateSnapshot: snapshot,
      observationEvidenceIds: ["e:observed-outcome"],
    });

    expect(result.disposition).toBe("designed-behavior");
    expect(result.evidenceIds).toEqual([
      "e:observed-outcome",
      "e:runtime-cleanup",
    ]);
  });

  it("caps policy violation at ambiguous outcome", () => {
    const snapshot: RuntimeStateSnapshot = {
      schemaVersion: 1,
      observations: [{
        path: "record.pendingCleanup",
        value: false,
        confidence: "observed",
        origin: "runtime-probe",
        evidenceId: "e:runtime-cleanup",
      }],
    };

    expect(
      gateRuntimeStateOutcomeAgainstIntent({
        intent: model(),
        outcomeId: "outcome:cleanup",
        stateSnapshot: snapshot,
        observationEvidenceIds: ["e:observed-outcome"],
      }).disposition,
    ).toBe("ambiguous-intent");
  });

  it("selects state from the requested runtime scope", () => {
    const snapshot: RuntimeStateSnapshot = {
      schemaVersion: 1,
      observations: [
        {
          path: "record.pendingCleanup",
          value: false,
          confidence: "observed",
          origin: "telemetry",
          scope: {
            arenaId: "arena-1",
            arenaGeneration: 2,
          },
          observedAt: { tick: 10 },
          evidenceId: "e:arena-1",
        },
        {
          path: "record.pendingCleanup",
          value: true,
          confidence: "observed",
          origin: "telemetry",
          scope: {
            arenaId: "arena-2",
            arenaGeneration: 1,
          },
          observedAt: { tick: 10 },
          evidenceId: "e:arena-2",
        },
      ],
    };

    expect(
      gateRuntimeStateOutcomeAgainstIntent({
        intent: model(),
        outcomeId: "outcome:cleanup",
        stateSnapshot: snapshot,
        scope: {
          arenaId: "arena-2",
          arenaGeneration: 1,
        },
        observationEvidenceIds: ["e:observed-outcome"],
      }).disposition,
    ).toBe("designed-behavior");
  });

  it("fails closed on conflicting runtime state", () => {
    const snapshot: RuntimeStateSnapshot = {
      schemaVersion: 1,
      observations: [
        {
          path: "record.pendingCleanup",
          value: true,
          confidence: "observed",
          origin: "runtime-probe",
          evidenceId: "e:a",
        },
        {
          path: "record.pendingCleanup",
          value: false,
          confidence: "observed",
          origin: "telemetry",
          evidenceId: "e:b",
        },
      ],
    };

    expect(
      gateRuntimeStateOutcomeAgainstIntent({
        intent: model(),
        outcomeId: "outcome:cleanup",
        stateSnapshot: snapshot,
        observationEvidenceIds: ["e:observed-outcome"],
      }).disposition,
    ).toBe("insufficient-evidence");
  });
});
}
