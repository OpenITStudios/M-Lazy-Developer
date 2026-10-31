import {
  describe,
  expect,
  it,
} from "vitest";
import {
  evaluateZeroWasteBenchmark,
  zeroWasteBenchmarkText,
} from "../../src/workflow/zero-waste-benchmark.js";

describe("zero-waste benchmark", () => {
  it("scores reuse, semantic skipping, validation skipping, and context truncation", () => {
    const report =
      evaluateZeroWasteBenchmark({
        id: "bench:1",
        runMode: "warm",
        summary: {
          diagnosis: {
            totalSteps: 4,
            executedSteps: 1,
            reusedSteps: 3,
            reuseRatio: 0.75,
          },
          semanticImpact: {
            totalNodes: 100,
            affectedNodes: 20,
            skippedNodes: 80,
            skipRatio: 0.8,
          },
          validation: {
            totalScenarios: 10,
            selectedScenarios: 3,
            skippedScenarios: 7,
            skipRatio: 0.7,
          },
          reasons: [],
        },
        context: {
          schemaVersion: 1,
          goal: "arena",
          semantic: {
            nodes: [],
            edges: [],
            omitted: 0,
            omittedEdges: 0,
          },
          intent: {
            nodes: [],
            invariants: [],
            unknowns: [],
            evidence: [],
          },
          budget: {
            maxSemanticNodes: 1,
            maxSemanticEdges: 1,
            maxIntentNodes: 1,
            maxInvariants: 1,
            maxUnknowns: 1,
            maxEvidence: 1,
          },
          truncation: {
            semanticNodes: 0,
            semanticEdges: 0,
            intentNodes: 0,
            invariants: 0,
            unknowns: 0,
            evidence: 0,
          },
          missingRequested: {
            semanticNodeIds: [],
            intentSubjectIds: [],
            invariantIds: [],
            evidenceIds: [],
          },
          complete: true,
          reasons: [],
        },
        targets: {
          minimumDiagnosisReuseRatio:
            0.5,
          minimumSemanticSkipRatio:
            0.5,
          minimumValidationSkipRatio:
            0.5,
          maximumContextTruncationRatio:
            0.2,
        },
      });

    expect(report.disposition)
      .toBe("pass");
    expect(
      report.metrics.filter(
        (metric) =>
          metric.disposition ===
          "fail",
      ),
    ).toEqual([]);
    expect(
      report.metrics.find(
        (metric) =>
          metric.id ===
          "context-truncation",
      )?.disposition,
    ).toBe("unscored");
  });

  it("does not treat optional context truncation as waste when required scope is complete", () => {
    const report =
      evaluateZeroWasteBenchmark({
        id: "bench:bounded-context",
        runMode: "cold",
        summary: {
          diagnosis: {
            totalSteps: 0,
            executedSteps: 0,
            reusedSteps: 0,
            reuseRatio: 0,
          },
          reasons: [],
        },
        context: {
          schemaVersion: 1,
          goal: "bounded",
          semantic: {
            nodes: [{
              id: "required",
              kind: "function",
              identifier: "required",
              source: {
                artifactId: "map",
                relativePath:
                  "functions/required.mcfunction",
              },
            }],
            edges: [],
            omitted: 20,
            omittedEdges: 0,
          },
          intent: {
            nodes: [],
            invariants: [],
            unknowns: [],
            evidence: [],
          },
          budget: {
            maxSemanticNodes: 1,
            maxSemanticEdges: 1,
            maxIntentNodes: 1,
            maxInvariants: 1,
            maxUnknowns: 1,
            maxEvidence: 1,
          },
          truncation: {
            semanticNodes: 20,
            semanticEdges: 0,
            intentNodes: 0,
            invariants: 0,
            unknowns: 0,
            evidence: 0,
          },
          missingRequested: {
            semanticNodeIds: [],
            intentSubjectIds: [],
            invariantIds: [],
            evidenceIds: [],
          },
          complete: true,
          reasons: [],
        },
        targets: {
          maximumContextTruncationRatio:
            0.1,
        },
      });

    expect(
      report.wasteSignals,
    ).not.toContain(
      "context-budget-high-truncation",
    );
    expect(
      report.metrics.find(
        (metric) =>
          metric.id ===
          "context-truncation",
      )?.disposition,
    ).toBe("unscored");
  });

  it("reports missed targets instead of hiding poor efficiency", () => {
    const report =
      evaluateZeroWasteBenchmark({
        id: "bench:poor",
        runMode: "warm",
        summary: {
          diagnosis: {
            totalSteps: 3,
            executedSteps: 3,
            reusedSteps: 0,
            reuseRatio: 0,
          },
          semanticImpact: {
            totalNodes: 10,
            affectedNodes: 10,
            skippedNodes: 0,
            skipRatio: 0,
          },
          validation: {
            totalScenarios: 5,
            selectedScenarios: 5,
            skippedScenarios: 0,
            skipRatio: 0,
          },
          reasons: [],
        },
        targets: {
          minimumDiagnosisReuseRatio:
            0.5,
          minimumSemanticSkipRatio:
            0.3,
          minimumValidationSkipRatio:
            0.3,
        },
      });

    expect(report.disposition)
      .toBe("fail");
    expect(report.wasteSignals)
      .toContain(
        "repeated-diagnosis-without-reuse",
      );
    expect(report.wasteSignals)
      .not.toContain(
        "full-validation-set",
      );

    const text =
      zeroWasteBenchmarkText(
        report,
      );
    expect(text)
      .toContain("Status: fail");
  });

  it("does not treat a legitimately full semantic/validation closure as heuristic waste", () => {
    const report =
      evaluateZeroWasteBenchmark({
        id: "bench:full-legitimate",
        runMode: "cold",
        summary: {
          diagnosis: {
            totalSteps: 1,
            executedSteps: 1,
            reusedSteps: 0,
            reuseRatio: 0,
          },
          semanticImpact: {
            totalNodes: 4,
            affectedNodes: 4,
            skippedNodes: 0,
            skipRatio: 0,
          },
          validation: {
            totalScenarios: 3,
            selectedScenarios: 3,
            skippedScenarios: 0,
            skipRatio: 0,
          },
          reasons: [],
        },
      });

    expect(report.wasteSignals)
      .not.toContain(
        "full-semantic-closure",
      );
    expect(report.wasteSignals)
      .not.toContain(
        "full-validation-set",
      );
  });

  it("does not misclassify a cold run as missing cache reuse", () => {
    const report =
      evaluateZeroWasteBenchmark({
        id: "bench:cold",
        runMode: "cold",
        summary: {
          diagnosis: {
            totalSteps: 3,
            executedSteps: 3,
            reusedSteps: 0,
            reuseRatio: 0,
          },
          reasons: [],
        },
        targets: {
          minimumDiagnosisReuseRatio:
            0.9,
        },
      });

    expect(
      report.metrics.some(
        (metric) =>
          metric.id ===
          "diagnosis-reuse",
      ),
    ).toBe(false);
    expect(report.wasteSignals)
      .not.toContain(
        "repeated-diagnosis-without-reuse",
      );
  });

  it("keeps metrics informational when no targets are configured", () => {
    const report =
      evaluateZeroWasteBenchmark({
        id: "bench:info",
        runMode: "cold",
        summary: {
          diagnosis: {
            totalSteps: 0,
            executedSteps: 0,
            reusedSteps: 0,
            reuseRatio: 0,
          },
          reasons: [],
        },
      });

    expect(report.disposition)
      .toBe("unscored");
  });
});
