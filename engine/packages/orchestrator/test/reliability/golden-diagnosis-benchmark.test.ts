import {
  describe,
  expect,
  it,
} from "vitest";
import {
  evaluateGoldenDiagnosisBenchmark,
  goldenDiagnosisBenchmarkText,
  validateReviewedGoldenDiagnosisCases,
  type GoldenDiagnosisCase,
} from "../../src/reliability/golden-diagnosis-benchmark.js";

describe("golden diagnosis benchmark", () => {
  it("accepts reviewed labels only when they bind to a real regression case", () => {
    const regressions = [{
      id: "reg:1",
      title: "Regression",
      domain: "multiplayer" as const,
      discoveredBy: "manual" as const,
      invariantIds: [],
      triggerTags: ["multiplayer"],
      capabilityTags: ["session"],
      reproduction: ["run"],
      expected: "isolated",
      observed: "shared",
    }];

    expect(
      validateReviewedGoldenDiagnosisCases(
        regressions,
        [{
          id: "golden:reg:1",
          regressionCaseId:
            "reg:1",
          reviewRevision:
            "review:1",
          expectedDefect: true,
          acceptedDispositions: [
            "confirmed-defect",
          ],
        }],
      ),
    ).toEqual([]);

    expect(
      validateReviewedGoldenDiagnosisCases(
        regressions,
        [{
          id: "golden:missing",
          regressionCaseId:
            "reg:missing",
          reviewRevision:
            "review:1",
          expectedDefect: true,
          acceptedDispositions: [
            "confirmed-defect",
          ],
        }],
      ).join(" "),
    ).toMatch(/unknown regression case/);
  });
  it("scores defect detection and root cause separately", () => {
    const report =
      evaluateGoldenDiagnosisBenchmark(
        "golden:1",
        [{
          id: "bug",
          expectedDefect: true,
          acceptedDispositions: [
            "confirmed-defect",
          ],
          acceptedRootCauseIds: [
            "cause:stale-session",
          ],
        }, {
          id: "designed",
          expectedDefect: false,
          acceptedDispositions: [
            "designed-behavior",
          ],
        }],
        [{
          caseId: "bug",
          disposition:
            "confirmed-defect",
          rootCauseIds: [
            "cause:wrong",
          ],
        }, {
          caseId: "designed",
          disposition:
            "designed-behavior",
        }],
      );

    expect(
      report.metrics
        .predictionCoverage,
    ).toBe(1);
    expect(
      report.metrics.precision,
    ).toBe(1);
    expect(
      report.metrics.recall,
    ).toBe(1);
    expect(
      report.metrics
        .rootCauseAccuracy,
    ).toBe(0);
    expect(
      report.metrics
        .dispositionAccuracy,
    ).toBe(1);
  });

  it("surfaces false positives and false negatives", () => {
    const report =
      evaluateGoldenDiagnosisBenchmark(
        "golden:2",
        [{
          id: "bug",
          expectedDefect: true,
          acceptedDispositions: [
            "confirmed-defect",
          ],
        }, {
          id: "valid",
          expectedDefect: false,
          acceptedDispositions: [
            "designed-behavior",
          ],
        }],
        [{
          caseId: "bug",
          disposition:
            "designed-behavior",
        }, {
          caseId: "valid",
          // A wrong confirmed-defect prediction on a non-defect case is
          // a false positive under the current closed disposition taxonomy.
          disposition:
            "confirmed-defect",
        }],
      );

    expect(
      report.metrics.falsePositive,
    ).toBe(1);
    expect(
      report.metrics.falseNegative,
    ).toBe(1);

    const text =
      goldenDiagnosisBenchmarkText(
        report,
      );
    expect(text)
      .toContain(
        "false positives: 1",
      );
    expect(text)
      .toContain(
        "false negatives: 1",
      );
  });

  it("reports missing predictions without pretending they passed", () => {
    const report =
      evaluateGoldenDiagnosisBenchmark(
        "golden:3",
        [{
          id: "case:a",
          expectedDefect: false,
          acceptedDispositions: [
            "engine-constraint",
          ],
        }],
        [],
      );

    expect(
      report
        .missingPredictionCaseIds,
    ).toEqual(["case:a"]);
    expect(report.metrics.cases)
      .toBe(0);
    expect(
      report.metrics.corpusCases,
    ).toBe(1);
    expect(
      report.metrics
        .predictionCoverage,
    ).toBe(0);

    const text =
      goldenDiagnosisBenchmarkText(
        report,
      );
    expect(text)
      .toContain(
        "Prediction coverage: 0.0%",
      );
  });

  it("requires frozen targets before reporting quality acceptance", () => {
    const report = evaluateGoldenDiagnosisBenchmark(
      "acceptance:unscored",
      [{
        id: "bug", expectedDefect: true,
        acceptedDispositions: ["confirmed-defect"],
        acceptedRootCauseIds: ["root:a"],
      }],
      [{
        caseId: "bug", disposition: "confirmed-defect",
        rootCauseIds: ["root:a"],
      }],
    );
    expect(report.acceptance.disposition).toBe("unscored");
    expect(goldenDiagnosisBenchmarkText(report)).toContain(
      "Quality acceptance: unscored",
    );
  });

  it("accepts complete mixed-case diagnosis only when all frozen dimensions pass", () => {
    const report = evaluateGoldenDiagnosisBenchmark(
      "acceptance:complete",
      [{
        id: "bug", expectedDefect: true,
        acceptedDispositions: ["confirmed-defect"],
        acceptedRootCauseIds: ["root:a"],
      }, {
        id: "designed", expectedDefect: false,
        acceptedDispositions: ["designed-behavior"],
      }],
      [{
        caseId: "bug", disposition: "confirmed-defect",
        rootCauseIds: ["root:a"],
      }, {
        caseId: "designed", disposition: "designed-behavior",
      }],
      {
        minimumPrecision: 0.95,
        minimumRecall: 0.95,
        minimumDispositionAccuracy: 0.95,
        minimumRootCauseAccuracy: 0.95,
      },
    );
    expect(report.acceptance.disposition).toBe("pass");
    expect(report.acceptance.metrics).toHaveLength(5);
    expect(report.acceptance.metrics.every(item =>
      item.disposition === "pass")).toBe(true);
  });

  it("blocks 100% sampled accuracy when only 1% of expected cases were predicted", () => {
    const cases: GoldenDiagnosisCase[] = Array.from(
      {length: 100}, (_, index) => ({
        id: "case-" + index,
        expectedDefect: index % 2 === 0,
        acceptedDispositions: [index % 2 === 0
          ? "confirmed-defect" as const
          : "designed-behavior" as const],
        acceptedRootCauseIds: index % 2 === 0 ? ["root:a"] : [],
      }),
    );
    const report = evaluateGoldenDiagnosisBenchmark(
      "acceptance:partial", cases,
      [{
        caseId: "case-0", disposition: "confirmed-defect",
        rootCauseIds: ["root:a"],
      }],
      {
        minimumPrecision: 0.9, minimumRecall: 0.9,
        minimumDispositionAccuracy: 0.9, minimumRootCauseAccuracy: 0.9,
      },
    );
    expect(report.metrics.defectAccuracy).toBe(1);
    expect(report.metrics.predictionCoverage).toBe(0.01);
    expect(report.acceptance.disposition).toBe("blocked");
    expect(report.acceptance.reasons.join(" ")).toMatch(/sample-only accuracy/);
  });

  it("fails wrong cause or wrong disposition even with perfect defect precision", () => {
    const cases: GoldenDiagnosisCase[] = [{
      id: "bug", expectedDefect: true,
      acceptedDispositions: ["confirmed-defect"],
      acceptedRootCauseIds: ["root:a"],
    }, {
      id: "designed", expectedDefect: false,
      acceptedDispositions: ["designed-behavior"],
    }];
    const targets = {
      minimumPrecision: 1, minimumRecall: 1,
      minimumDispositionAccuracy: 1, minimumRootCauseAccuracy: 1,
    };
    const wrongRoot = evaluateGoldenDiagnosisBenchmark(
      "acceptance:root", cases,
      [{
        caseId: "bug", disposition: "confirmed-defect",
        rootCauseIds: ["root:wrong"],
      }, {
        caseId: "designed", disposition: "designed-behavior",
      }], targets,
    );
    expect(wrongRoot.metrics.precision).toBe(1);
    expect(wrongRoot.acceptance.disposition).toBe("fail");

    const wrongDisposition = evaluateGoldenDiagnosisBenchmark(
      "acceptance:disposition", cases,
      [{
        caseId: "bug", disposition: "confirmed-defect",
        rootCauseIds: ["root:a"],
      }, {
        caseId: "designed", disposition: "engine-constraint",
      }], targets,
    );
    expect(wrongDisposition.metrics.precision).toBe(1);
    expect(wrongDisposition.acceptance.disposition).toBe("fail");
  });

  it("blocks unsupported root-cause evidence and unknown prediction identifiers", () => {
    const targets = {
      minimumPrecision: 0.9, minimumRecall: 0.9,
      minimumDispositionAccuracy: 0.9, minimumRootCauseAccuracy: 0.9,
    };
    const cases: GoldenDiagnosisCase[] = [{
      id: "bug", expectedDefect: true,
      acceptedDispositions: ["confirmed-defect"],
    }, {
      id: "designed", expectedDefect: false,
      acceptedDispositions: ["designed-behavior"],
    }];
    const predictions = [{
      caseId: "bug", disposition: "confirmed-defect" as const,
    }, {
      caseId: "designed", disposition: "designed-behavior" as const,
    }];
    const missingProof = evaluateGoldenDiagnosisBenchmark(
      "acceptance:no-cause", cases, predictions, targets,
    );
    expect(missingProof.acceptance.disposition).toBe("blocked");
    const extra = evaluateGoldenDiagnosisBenchmark(
      "acceptance:extra", cases,
      [...predictions, {
        caseId: "foreign", disposition: "confirmed-defect",
      }], targets,
    );
    expect(extra.acceptance.disposition).toBe("blocked");
    expect(extra.unexpectedPredictionCaseIds).toEqual(["foreign"]);
    expect(() => evaluateGoldenDiagnosisBenchmark(
      "acceptance:invalid", cases, predictions,
      {...targets, minimumRecall: NaN},
    )).toThrow(/minimumRecall/);
  });
});
