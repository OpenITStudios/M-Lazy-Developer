// Source-preserving family consolidation: original suites and assertions retained in separate lexical scopes.
import { describe } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { derivePrimaryFailureSignalsFromDiagnostics } from "../../src/reporting/report-classification-producers.js";
import { deriveReportDefectClassification } from "../../src/reporting/report-defect-classification.js";

// Original suite engine/packages/orchestrator/test/reporting/report-classification-producers.test.ts, blob d9c07cb8612ac6d1af1db22f0a9641d0a0db95dd
{



describe("report classification producers", () => {
  it("maps explicit entity diagnostic families to entity-decision", () => {
    const result =
      derivePrimaryFailureSignalsFromDiagnostics([
        {
          id: "diag:entity",
          code: "ENTITY_TRIGGER_EVENT_UNDEFINED",
          severity: "medium",
          message: "Undefined event.",
        },
      ]);

    expect(result.signals).toEqual([
      {
        failure: "entity-decision",
        evidenceIds: ["diag:entity"],
      },
    ]);
    expect(result.unmappedFindingIds).toEqual([]);
  });

  it("maps explicit script compatibility diagnostics to runtime-compatibility", () => {
    const result =
      derivePrimaryFailureSignalsFromDiagnostics([
        {
          id: "diag:compat",
          code: "SCRIPT_API_REMOVED_SYMBOL",
          severity: "critical",
          message: "Removed symbol.",
        },
      ]);

    expect(result.signals[0]?.failure)
      .toBe("runtime-compatibility");
  });

  it("does not convert raw replica/voxel divergence into a report failure before semantic classification", () => {
    const result =
      derivePrimaryFailureSignalsFromDiagnostics([
        {
          id: "diag:replica",
          code: "ARENA_VOXEL_DIVERGENCE",
          severity: "critical",
          message: "Replica differs physically.",
        },
      ]);

    expect(result.signals).toEqual([]);
    expect(result.unmappedFindingIds)
      .toEqual(["diag:replica"]);
  });

  it("does not infer primary failure for ambiguous diagnostics", () => {
    const result =
      derivePrimaryFailureSignalsFromDiagnostics([
        {
          id: "diag:unknown",
          code: "UNKNOWN_COMMAND_EFFECT",
          severity: "minor",
          message: "Unknown effect.",
        },
      ]);

    expect(result.signals).toEqual([]);
    expect(result.unmappedFindingIds)
      .toEqual(["diag:unknown"]);
  });

  it("never derives report impact from diagnostic severity", () => {
    const result =
      derivePrimaryFailureSignalsFromDiagnostics([
        {
          id: "diag:capacity",
          code: "ARENA_CONCURRENCY_CAPACITY_SHORTFALL",
          severity: "critical",
          message: "Capacity shortfall.",
        },
      ]);

    expect(result.signals).toEqual([
      {
        failure: "session-concurrency",
        evidenceIds: ["diag:capacity"],
      },
    ]);
    expect(
      "impact" in result,
    ).toBe(false);
  });
});

}

// Original suite engine/packages/orchestrator/test/reporting/report-defect-classification.test.ts, blob 7a81de843ebfceaa012c2c26fc6888fdbda07ff6
{



describe("report defect classification", () => {
  it("derives a major player-state defect from structured signals", () => {
    const result = deriveReportDefectClassification({
      impact: [{
        kind: "important-state-wrong",
        evidenceIds: ["runtime:inventory"],
      }],
      primaryFailure: [{
        failure: "player-owned-state",
        evidenceIds: ["intent:inventory"],
      }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.impact).toEqual({
      progression: "unaffected",
      recovery: "normal",
      stability: "stable",
      coreMechanic: "correct",
      importantState: "materially-wrong",
      fairness: "unaffected",
    });
    expect(result.primaryFailure)
      .toBe("player-owned-state");
  });

  it("derives blocker impact only from blocker-level signals", () => {
    const result = deriveReportDefectClassification({
      impact: [{
        kind: "progression-blocked",
        evidenceIds: ["runtime:blocked"],
      }],
      primaryFailure: [{
        failure: "game-progression",
        evidenceIds: ["intent:progression"],
      }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.impact.progression)
      .toBe("blocked");
  });

  it("rejects ambiguous primary failure signals", () => {
    const result = deriveReportDefectClassification({
      impact: [{
        kind: "important-state-wrong",
        evidenceIds: ["runtime:state"],
      }],
      primaryFailure: [
        {
          failure: "player-owned-state",
          evidenceIds: ["intent:state"],
        },
        {
          failure: "session-concurrency",
          evidenceIds: ["intent:session"],
        },
      ],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reasons.join(" "))
      .toMatch(/ambiguous/);
  });

  it("rejects ungrounded signals", () => {
    const result = deriveReportDefectClassification({
      impact: [{
        kind: "fairness-affected",
        evidenceIds: [],
      }],
      primaryFailure: [{
        failure: "combat-rule",
        evidenceIds: ["intent:combat"],
      }],
    });

    expect(result.ok).toBe(false);
  });
});

}
