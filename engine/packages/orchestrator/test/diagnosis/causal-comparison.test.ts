import { describe, expect, it } from "vitest";
import { compareCausalAnalysis } from "../../src/diagnosis/causal-comparison.js";
import { causalRetestReasons } from "../../src/diagnosis/causal-retest.js";

function result(input: {
  confidence: "low" | "medium" | "high";
  observedOutcomes: number;
  corroboratedRisks: number;
  candidate: string;
}) {
  return {
    causalAnalysis: {
      chains: [{
        id: "chain-" + input.candidate,
        scopeKey: "op:1",
        severity: input.confidence === "high" ? "critical" as const : "info" as const,
        confidence: input.confidence,
        title: input.candidate,
        summary: "fixture",
        nodes: [],
        links: [],
        relatedDiagnosticIds: [],
      }],
      highConfidence: input.confidence === "high" ? 1 : 0,
      mediumConfidence: input.confidence === "medium" ? 1 : 0,
      lowConfidence: input.confidence === "low" ? 1 : 0,
      projectedRisks: 1,
      corroboratedRisks: input.corroboratedRisks,
      observedOutcomes: input.observedOutcomes,
      incidents: [{
        id: "incident-1",
        scopeKey: "op:1",
        severity: "critical" as const,
        confidence: input.confidence,
        chainIds: ["chain-" + input.candidate],
        relatedDiagnosticIds: [],
        nodes: [],
        links: [],
        rootCauseCandidates: [{
          id: "candidate-" + input.candidate,
          label: input.candidate,
          evidenceLevel: input.observedOutcomes > 0
            ? "proven-with-observed-outcome" as const
            : input.corroboratedRisks > 0
              ? "corroborated-candidate" as const
              : "unproven-candidate" as const,
          severity: "critical" as const,
          confidence: input.confidence,
          chainIds: ["chain-" + input.candidate],
          relatedDiagnosticIds: [],
          support: {
            dependencyViolations: 0,
            evidenceGaps: 1,
            corroboratedRisks: input.corroboratedRisks,
            observedOutcomes: input.observedOutcomes,
          },
        }],
      }],
      rootCauseCandidates: 1,
    },
  };
}

describe("causal comparison", () => {
  it("describes projection-to-observed evidence changes", () => {
    const before = result({
      confidence: "low",
      observedOutcomes: 0,
      corroboratedRisks: 0,
      candidate: "route-mutation",
    });
    const after = result({
      confidence: "medium",
      observedOutcomes: 1,
      corroboratedRisks: 1,
      candidate: "route-mutation",
    });

    const comparison = compareCausalAnalysis(before, after);
    expect(comparison.delta).toEqual(expect.objectContaining({
      highConfidence: 0,
      mediumConfidence: 1,
      lowConfidence: -1,
      corroboratedRisks: 1,
      observedOutcomes: 1,
      rootCauseCandidates: 0,
    }));
    expect(comparison.delta.addedCandidateLabels).toEqual([]);
    expect(comparison.delta.removedCandidateLabels).toEqual([]);
  });

  it("reports candidate labels added and removed", () => {
    const comparison = compareCausalAnalysis(
      result({
        confidence: "low",
        observedOutcomes: 0,
        corroboratedRisks: 0,
        candidate: "old-cause",
      }),
      result({
        confidence: "high",
        observedOutcomes: 1,
        corroboratedRisks: 0,
        candidate: "new-cause",
      }),
    );

    expect(comparison.delta.addedCandidateLabels).toEqual(["new-cause"]);
    expect(comparison.delta.removedCandidateLabels).toEqual(["old-cause"]);
  });
});

// One comparison → retest behavior contract replaces a separate mock-delta suite.
describe("causal comparison-to-retest", () => {
  it("prioritizes actual positive causal deltas by impact", () => {
    const before = result({ confidence: "low", observedOutcomes: 0,
      corroboratedRisks: 0, candidate: "old-cause" });
    const after = result({ confidence: "high", observedOutcomes: 1,
      corroboratedRisks: 2, candidate: "new-cause" });
    const reasons = causalRetestReasons(compareCausalAnalysis(before, after));
    expect(reasons.map((reason) => reason.weight).toEqual([5, 4, 3, 2]);
    expect(reasons.every((reason) => reason.kind === "causal-regression")).toBe(true);
    expect(reasons.some((reason) => reason.detail.includes("new-cause"))).toBe(true);
  });

  it("does not invent regression work for causal improvements", () => {
    const before = result({ confidence: "high", observedOutcomes: 1,
      corroboratedRisks: 2, candidate: "old-cause" });
    const after = result({ confidence: "low", observedOutcomes: 0,
      corroboratedRisks: 0, candidate: "old-cause" });
    expect(causalRetestReasons(compareCausalAnalysis(before, after))).toEqual([]);
  });
});
