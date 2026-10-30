import { describe, expect, it } from "vitest";
import { derivePrimaryFailureSignalsFromDiagnostics } from "../../src/reporting/report-classification-producers.js";
import { deriveReportDefectClassification } from "../../src/reporting/report-defect-classification.js";

describe("report diagnostic classification", () => {
  it("maps the complete diagnostic producer matrix without promoting unknown or spatial-only findings", () => {
    const cases = [
      {
        label: "entity event", id: "diag:entity",
        code: "ENTITY_TRIGGER_EVENT_UNDEFINED", severity: "medium",
        message: "Undefined event.",
        expected: { signals: [{ failure: "entity-decision", evidenceIds: ["diag:entity"] }], unmappedFindingIds: [] },
      },
      {
        label: "removed script API", id: "diag:compat",
        code: "SCRIPT_API_REMOVED_SYMBOL", severity: "critical",
        message: "Removed symbol.",
        expected: { signals: [{ failure: "runtime-compatibility", evidenceIds: ["diag:compat"] }], unmappedFindingIds: [] },
      },
      {
        label: "unclassified physical divergence", id: "diag:replica",
        code: "ARENA_VOXEL_DIVERGENCE", severity: "critical",
        message: "Replica differs physically.",
        expected: { signals: [], unmappedFindingIds: ["diag:replica"] },
      },
      {
        label: "ambiguous command behavior", id: "diag:unknown",
        code: "UNKNOWN_COMMAND_EFFECT", severity: "minor",
        message: "Unknown effect.",
        expected: { signals: [], unmappedFindingIds: ["diag:unknown"] },
      },
      {
        label: "capacity finding without inferred player impact", id: "diag:capacity",
        code: "ARENA_CONCURRENCY_CAPACITY_SHORTFALL", severity: "critical",
        message: "Capacity shortfall.",
        expected: { signals: [{ failure: "session-concurrency", evidenceIds: ["diag:capacity"] }], unmappedFindingIds: [] },
      },
    ] as const;

    const observed = cases.map(({ label, id, code, severity, message }) => {
      const result = derivePrimaryFailureSignalsFromDiagnostics([
        { id, code, severity, message },
      ]);
      return { label, ...result, hasUnprovenImpact: "impact" in result };
    });
    expect(observed).toEqual(cases.map(({ label, expected }) => ({
      label, ...expected, hasUnprovenImpact: false,
    })));
  });
});

describe("report defect classification", () => {
  const unaffectedImpact = {
    progression: "unaffected",
    recovery: "normal",
    stability: "stable",
    coreMechanic: "correct",
    importantState: "correct",
    fairness: "unaffected",
  } as const;

  it("derives evidenced player-state and blocked-progression classifications", () => {
    const cases = [
      {
        label: "material player-owned state",
        kind: "important-state-wrong",
        failure: "player-owned-state",
        impactEvidence: "runtime:inventory",
        failureEvidence: "intent:inventory",
        expectedImpact: { ...unaffectedImpact, importantState: "materially-wrong" },
      },
      {
        label: "blocked progression",
        kind: "progression-blocked",
        failure: "game-progression",
        impactEvidence: "runtime:blocked",
        failureEvidence: "intent:progression",
        expectedImpact: { ...unaffectedImpact, progression: "blocked" },
      },
    ] as const;
    const observed = cases.map(({ label, kind, failure, impactEvidence, failureEvidence }) => {
      const result = deriveReportDefectClassification({
        impact: [{ kind, evidenceIds: [impactEvidence] }],
        primaryFailure: [{ failure, evidenceIds: [failureEvidence] }],
      });
      return {
        label,
        ok: result.ok,
        impact: result.ok ? result.impact : undefined,
        primaryFailure: result.ok ? result.primaryFailure : undefined,
      };
    });
    expect(observed).toEqual(cases.map(({ label, failure, expectedImpact }) => ({
      label, ok: true, impact: expectedImpact, primaryFailure: failure,
    })));
  });

  it("rejects ambiguous or ungrounded classification signals", () => {
    const cases = [
      {
        label: "multiple competing failure classes",
        input: {
          impact: [{ kind: "important-state-wrong", evidenceIds: ["runtime:state"] }],
          primaryFailure: [
            { failure: "player-owned-state", evidenceIds: ["intent:state"] },
            { failure: "session-concurrency", evidenceIds: ["intent:session"] },
          ],
        },
        ambiguous: true,
      },
      {
        label: "impact without any evidence",
        input: {
          impact: [{ kind: "fairness-affected", evidenceIds: [] }],
          primaryFailure: [{ failure: "combat-rule", evidenceIds: ["intent:combat"] }],
        },
        ambiguous: false,
      },
    ] as const;
    const observed = cases.map(({ label, input }) => {
      const result = deriveReportDefectClassification(input);
      return {
        label,
        ok: result.ok,
        ambiguous: !result.ok && result.reasons.join(" ").includes("ambiguous"),
      };
    });
    expect(observed).toEqual(cases.map(({ label, ambiguous }) => ({
      label, ok: false, ambiguous,
    })));
  });
});
