import {
  describe,
  expect,
  it,
} from "vitest";
import {
  evaluateGoldenDiagnosisBenchmark,
  goldenDiagnosisBenchmarkText,
  validateReviewedGoldenDiagnosisCases,
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
});
