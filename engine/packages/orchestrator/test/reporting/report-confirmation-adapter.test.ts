// Cohesive family source consolidation. Original cases, assertions and lexical scopes retained; not executed.
import { describe } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import type { IntentDiagnosticGateResult } from "../../../diagnostic-reasoning/src/index.js";
import type { GameplayIntentModel } from "../../../gameplay-intent/src/index.js";
import { confirmStaticIntentDefectForReport } from "../../src/reporting/static-report-confirmation-adapter.js";
import { confirmTesterDefectForReport } from "../../src/reporting/tester-report-confirmation-adapter.js";
import { confirmGameplayIntentRuntimeDefectForReport } from "../../src/reporting/report-confirmation-adapter.js";
import type { GameplayIntentRuntimeAssessment } from "../../src/gameplay-intent-runtime-stage.js";

// Original suite engine/packages/orchestrator/test/reporting/static-report-confirmation-adapter.test.ts, blob a7c3d0181791b01ae0aab242b013c31e106ff918
{





function intent(
  scope: "selected-artifact" | "external-reference" =
    "selected-artifact",
): GameplayIntentModel {
  return {
    schemaVersion: 1,
    id: "intent",
    artifactId: "artifact:v1",
    evidence: [{
      id: "intent:evidence",
      origin: "source-code",
      locator: "behavior_packs/demo/scripts/session.js",
      summary: "Cleanup contract.",
      scope,
    }],
    nodes: [{
      id: "outcome:cleanup",
      kind: "outcome",
      label: "Cleanup",
      status: "authored",
      evidenceIds: ["intent:evidence"],
    }],
    edges: [],
    invariants: [{
      id: "inv:cleanup",
      statement: "Cleanup must clear match-owned state.",
      strength: "must",
      status: "authored",
      subjectIds: ["outcome:cleanup"],
      evidenceIds: ["intent:evidence"],
    }],
    unknowns: [],
  };
}

function result(): IntentDiagnosticGateResult {
  return {
    disposition: "confirmed-defect",
    subjectIds: ["outcome:cleanup"],
    basisInvariantIds: ["inv:cleanup"],
    basisDesignRuleIds: [],
    basisDesignEvidenceIds: [],
    evidenceIds: ["static:contradiction"],
    nextEvidenceNeed: "none",
    reasons: ["Selected-artifact contract contradiction."],
  };
}

describe("static report confirmation adapter", () => {
  it("confirms only selected-artifact contract violations", () => {
    expect(
      confirmStaticIntentDefectForReport(
        intent(),
        result(),
      ).confirmed,
    ).toBe(true);
  });

  it("rejects external/reference intent even when disposition says confirmed", () => {
    expect(
      confirmStaticIntentDefectForReport(
        intent("external-reference"),
        result(),
      ).confirmed,
    ).toBe(false);
  });

  it("rejects manually supplied external design evidence without selected-artifact invariant authority", () => {
    const confirmation =
      confirmStaticIntentDefectForReport(
        {
          ...intent(),
          invariants: [],
        },
        {
          ...result(),
          basisInvariantIds: [],
          basisDesignRuleIds: ["external-rule"],
          basisDesignEvidenceIds: ["external:design"],
        },
      );

    expect(confirmation.confirmed).toBe(false);
  });
});

}

// Original suite engine/packages/orchestrator/test/reporting/tester-report-confirmation-adapter.test.ts, blob 84aa12dc16532dbadc0bd43708a61e3e481090bb
{



describe("tester report confirmation adapter", () => {
  it("confirms a reproduced mismatch against an explicit requirement", () => {
    const result = confirmTesterDefectForReport({
      expectedBehaviorAuthority:
        "explicit-requirement",
      expectedStatement:
        "A second match can start after the first completes.",
      expectedEvidenceIds: ["requirement:match-restart"],
      observationEvidenceIds: ["tester:match-restart"],
      reproduced: true,
      evidence:
        "The second match cannot start after completing the first match.",
    });

    expect(result.confirmed).toBe(true);
    if (!result.confirmed) return;
    expect(result.confirmation.basis).toBe(
      "tester-reproduction",
    );
  });

  it("does not confirm without expected behavior evidence identity", () => {
    const result = confirmTesterDefectForReport({
      expectedBehaviorAuthority:
        "explicit-requirement",
      expectedStatement:
        "A second match can start after the first completes.",
      expectedEvidenceIds: [],
      observationEvidenceIds: ["tester:match-restart"],
      reproduced: true,
      evidence:
        "The behavior is repeatable.",
    });

    expect(result.confirmed).toBe(false);
  });

  it("does not confirm without gameplay observation evidence identity", () => {
    const result = confirmTesterDefectForReport({
      expectedBehaviorAuthority:
        "explicit-requirement",
      expectedStatement:
        "A second match can start after the first completes.",
      expectedEvidenceIds: ["requirement:match-restart"],
      observationEvidenceIds: [],
      reproduced: true,
      evidence:
        "The behavior is repeatable.",
    });

    expect(result.confirmed).toBe(false);
  });

  it("does not confirm an unreproduced tester observation", () => {
    const result = confirmTesterDefectForReport({
      expectedBehaviorAuthority:
        "explicit-requirement",
      expectedStatement:
        "A second match can start after the first completes.",
      expectedEvidenceIds: ["requirement:match-restart"],
      observationEvidenceIds: ["tester:match-restart"],
      reproduced: false,
      evidence:
        "The behavior was observed once but could not be reproduced.",
    });

    expect(result.confirmed).toBe(false);
  });

  it("does not promote selected-artifact behavior that the intent gate classifies as designed", () => {
    const result = confirmTesterDefectForReport({
      expectedBehaviorAuthority: "selected-artifact",
      intentDiagnostic: {
        disposition: "designed-behavior",
        subjectIds: ["combat:team-damage"],
        basisInvariantIds: [],
        basisDesignRuleIds: ["friendly-fire"],
        basisDesignEvidenceIds: ["game-design:offense:rule:friendly-fire"],
        evidenceIds: ["runtime:friendly-fire"],
        nextEvidenceNeed: "none",
        reasons: ["An explicit exception applies."],
      },
      expectedStatement: "Friendly fire is disabled in normal play.",
      expectedEvidenceIds: ["game-design:offense:rule:friendly-fire"],
      observationEvidenceIds: ["runtime:friendly-fire"],
      reproduced: true,
      evidence: "Friendly fire occurred in developer mode.",
    });

    expect(result.confirmed).toBe(false);
  });

  it("allows selected-artifact tester mismatch only after canonical intent confirmation", () => {
    const result = confirmTesterDefectForReport({
      expectedBehaviorAuthority: "selected-artifact",
      intentDiagnostic: {
        disposition: "confirmed-defect",
        subjectIds: ["combat:team-damage"],
        basisInvariantIds: [],
        basisDesignRuleIds: ["friendly-fire"],
        basisDesignEvidenceIds: ["game-design:offense:rule:friendly-fire"],
        evidenceIds: ["runtime:friendly-fire", "tester:same-team-damage"],
        nextEvidenceNeed: "none",
        reasons: ["Observed behavior contradicts approved Game Design."],
      },
      expectedStatement: "Same-team damage is forbidden.",
      expectedEvidenceIds: ["game-design:offense:rule:friendly-fire"],
      observationEvidenceIds: ["runtime:friendly-fire"],
      reproduced: true,
      evidence: "Same-team damage is reproducible.",
    });

    expect(result.confirmed).toBe(true);
  });
});

}

// Original suite engine/packages/orchestrator/test/reporting/report-confirmation-adapter.test.ts, blob b54e946480c39d63da374fe896a77bc66e343fa4
{





function intent(
  scope: "selected-artifact" | "external-reference" =
    "selected-artifact",
): GameplayIntentModel {
  return {
    schemaVersion: 1,
    id: "intent",
    artifactId: "artifact:v1",
    evidence: [{
      id: "intent:evidence",
      origin: "source-code",
      locator: "behavior_packs/demo/scripts/session.js",
      summary: "Cleanup contract.",
      scope,
    }],
    nodes: [{
      id: "outcome:cleanup",
      kind: "outcome",
      label: "Cleanup",
      status: "authored",
      evidenceIds: ["intent:evidence"],
    }],
    edges: [],
    invariants: [{
      id: "inv:cleanup",
      statement: "Cleanup requires pending cleanup state.",
      strength: "must",
      status: "authored",
      subjectIds: ["outcome:cleanup"],
      evidenceIds: ["intent:evidence"],
    }],
    unknowns: [],
  };
}

function assessment(): GameplayIntentRuntimeAssessment {
  return {
    outcomeObservation: {
      outcomeId: "outcome:cleanup",
      evidenceId: "runtime:cleanup",
    },
    result: {
      disposition: "confirmed-defect",
      subjectIds: ["outcome:cleanup"],
      basisInvariantIds: ["inv:cleanup"],
      evidenceIds: ["runtime:cleanup"],
      nextEvidenceNeed: "none",
      reasons: ["Selected-artifact contract contradiction."],
    },
    observationNeeds: [],
  };
}

describe("runtime report confirmation adapter", () => {
  it("confirms runtime contradiction against selected-artifact contract evidence", () => {
    expect(
      confirmGameplayIntentRuntimeDefectForReport(
        intent(),
        assessment(),
      ).confirmed,
    ).toBe(true);
  });

  it("rejects external/reference intent even when runtime contradiction exists", () => {
    expect(
      confirmGameplayIntentRuntimeDefectForReport(
        intent("external-reference"),
        assessment(),
      ).confirmed,
    ).toBe(false);
  });
});

}
