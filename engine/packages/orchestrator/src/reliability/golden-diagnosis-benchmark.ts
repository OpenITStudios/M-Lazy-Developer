import type {
  IntentDiagnosticDisposition,
} from "../../../diagnostic-reasoning/src/index.js";
import type {
  RegressionCase,
} from "../../../reliability/src/index.js";

export interface GoldenDiagnosisCase {
  id: string;
  expectedDefect: boolean;
  acceptedDispositions:
    readonly IntentDiagnosticDisposition[];
  acceptedRootCauseIds?:
    readonly string[];
}

export interface ReviewedGoldenDiagnosisCase
  extends GoldenDiagnosisCase {
  regressionCaseId: string;
  reviewRevision: string;
}

export interface GoldenDiagnosisPrediction {
  caseId: string;
  disposition:
    IntentDiagnosticDisposition;
  rootCauseIds?:
    readonly string[];
}

export interface GoldenDiagnosisCaseResult {
  caseId: string;
  expectedDefect: boolean;
  predictedDefect: boolean;
  dispositionCorrect: boolean;
  rootCauseRequired: boolean;
  rootCauseCorrect: boolean;
  falsePositive: boolean;
  falseNegative: boolean;
}

export interface GoldenDiagnosisMetrics {
  corpusCases: number;
  cases: number;
  predictionCoverage: number;
  truePositive: number;
  trueNegative: number;
  falsePositive: number;
  falseNegative: number;
  precision: number;
  recall: number;
  specificity: number;
  defectAccuracy: number;
  dispositionAccuracy: number;
  rootCauseAccuracy: number;
  rootCauseCases: number;
}


/** Frozen thresholds are selected before the benchmark is observed. */
export interface GoldenDiagnosisAcceptanceTargets {
  minimumPrecision: number;
  minimumRecall: number;
  minimumDispositionAccuracy: number;
  minimumRootCauseAccuracy: number;
}
export interface GoldenDiagnosisAcceptanceMetric {
  id:
    | "prediction-coverage"
    | "precision"
    | "recall"
    | "disposition-accuracy"
    | "root-cause-accuracy";
  value: number | null;
  target: number;
  disposition: "pass" | "fail" | "blocked";
}
export interface GoldenDiagnosisAcceptanceReport {
  disposition: "pass" | "fail" | "blocked" | "unscored";
  metrics: readonly GoldenDiagnosisAcceptanceMetric[];
  reasons: readonly string[];
}

export interface GoldenDiagnosisBenchmarkReport {
  schemaVersion: 1;
  corpusId: string;
  cases:
    readonly GoldenDiagnosisCaseResult[];
  metrics:
    GoldenDiagnosisMetrics;
  missingPredictionCaseIds:
    readonly string[];
  unexpectedPredictionCaseIds:
    readonly string[];
  acceptance: GoldenDiagnosisAcceptanceReport;
  reasons: readonly string[];
}

export function validateReviewedGoldenDiagnosisCases(
  regressions: readonly RegressionCase[],
  cases: readonly ReviewedGoldenDiagnosisCase[],
): string[] {
  const errors: string[] = [];
  const regressionIds =
    new Set(
      regressions.map(
        (item) => item.id,
      ),
    );
  const caseIds =
    new Set<string>();
  const linkedRegressionIds =
    new Set<string>();

  for (const item of cases) {
    if (!item.id.trim()) {
      errors.push(
        "Reviewed golden diagnosis case id must be non-empty.",
      );
    }
    if (caseIds.has(item.id)) {
      errors.push(
        "Duplicate reviewed golden diagnosis case id: " +
          item.id +
          ".",
      );
    }
    caseIds.add(item.id);

    if (
      !item.regressionCaseId.trim() ||
      !regressionIds.has(
        item.regressionCaseId,
      )
    ) {
      errors.push(
        "Reviewed golden diagnosis case " +
          item.id +
          " references unknown regression case " +
          item.regressionCaseId +
          ".",
      );
    }

    if (
      linkedRegressionIds.has(
        item.regressionCaseId,
      )
    ) {
      errors.push(
        "Multiple reviewed golden diagnosis cases reference the same regression case: " +
          item.regressionCaseId +
          ".",
      );
    }
    linkedRegressionIds.add(
      item.regressionCaseId,
    );

    if (!item.reviewRevision.trim()) {
      errors.push(
        "Reviewed golden diagnosis case " +
          item.id +
          " requires a non-empty reviewRevision.",
      );
    }

    if (
      item.acceptedDispositions
        .length === 0
    ) {
      errors.push(
        "Reviewed golden diagnosis case " +
          item.id +
          " requires at least one accepted disposition.",
      );
    }
  }

  return errors.sort();
}

const DEFECT_DISPOSITIONS =
  new Set<
    IntentDiagnosticDisposition
  >([
    // Design review is not a proven defect for precision/recall scoring.
    "confirmed-defect",
  ]);

function unique(
  values: readonly string[] |
    undefined,
): string[] {
  return [
    ...new Set(values ?? []),
  ].sort();
}

function ratio(
  numerator: number,
  denominator: number,
): number {
  return denominator === 0
    ? 0
    : numerator / denominator;
}

function rootCauseMatches(
  expected:
    readonly string[] |
    undefined,
  predicted:
    readonly string[] |
    undefined,
): boolean {
  const accepted =
    unique(expected);

  if (accepted.length === 0) {
    return true;
  }

  const actual =
    new Set(
      unique(predicted),
    );

  return accepted.some(
    (id) => actual.has(id),
  );
}


function acceptanceTarget(name: string, value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error("Invalid golden diagnosis acceptance threshold: " + name + ".");
  }
  return value;
}

function acceptanceMetric(
  id: GoldenDiagnosisAcceptanceMetric["id"],
  value: number,
  target: number,
  supported: boolean,
): GoldenDiagnosisAcceptanceMetric {
  return {
    id,
    value: supported ? value : null,
    target,
    disposition: !supported ? "blocked" : value >= target ? "pass" : "fail",
  };
}

/** Benchmark acceptance is not a map/Minecraft release decision. */
export function assessGoldenDiagnosisAcceptance(
  report: GoldenDiagnosisBenchmarkReport,
  targets: GoldenDiagnosisAcceptanceTargets | undefined,
): GoldenDiagnosisAcceptanceReport {
  if (!targets) {
    return {
      disposition: "unscored",
      metrics: [],
      reasons: ["No frozen quality targets supplied; raw diagnosis scores are informational."],
    };
  }
  const precision = acceptanceTarget("minimumPrecision", targets.minimumPrecision);
  const recall = acceptanceTarget("minimumRecall", targets.minimumRecall);
  const disposition = acceptanceTarget("minimumDispositionAccuracy", targets.minimumDispositionAccuracy);
  const rootCause = acceptanceTarget("minimumRootCauseAccuracy", targets.minimumRootCauseAccuracy);
  const m = report.metrics;
  const metrics: GoldenDiagnosisAcceptanceMetric[] = [
    acceptanceMetric("prediction-coverage", m.predictionCoverage, 1,
      m.corpusCases > 0),
    acceptanceMetric("precision", m.precision, precision,
      m.truePositive + m.falsePositive > 0),
    acceptanceMetric("recall", m.recall, recall,
      m.truePositive + m.falseNegative > 0),
    acceptanceMetric("disposition-accuracy", m.dispositionAccuracy, disposition,
      m.cases > 0),
    acceptanceMetric("root-cause-accuracy", m.rootCauseAccuracy, rootCause,
      m.rootCauseCases > 0),
  ];
  // A partial corpus is unsupported for acceptance; retain its observed
  // coverage value for diagnosis instead of hiding it behind null.
  if (m.corpusCases > 0 && m.predictionCoverage < 1) {
    metrics[0] = {...metrics[0]!, disposition: "blocked"};
  }
  const blocked = metrics.some(item => item.disposition === "blocked") ||
    report.unexpectedPredictionCaseIds.length > 0;
  const failed = metrics.some(item => item.disposition === "fail");
  return {
    disposition: blocked ? "blocked" : failed ? "fail" : "pass",
    metrics,
    reasons: [
      m.predictionCoverage < 1
        ? "Incomplete golden predictions; sample-only accuracy cannot establish acceptance."
        : "Complete golden prediction coverage.",
      report.unexpectedPredictionCaseIds.length > 0
        ? "Predictions contain unknown case IDs."
        : "No unexpected prediction case IDs.",
      blocked ? "Required prediction/quality evidence missing or invalid."
        : failed ? "At least one frozen diagnosis-quality threshold missed."
          : "All frozen diagnosis-quality targets met.",
    ],
  };
}

export function evaluateGoldenDiagnosisBenchmark(
  corpusId: string,
  cases:
    readonly GoldenDiagnosisCase[],
  predictions:
    readonly GoldenDiagnosisPrediction[],
  acceptanceTargets: GoldenDiagnosisAcceptanceTargets | undefined = undefined,
): GoldenDiagnosisBenchmarkReport {
  if (!corpusId.trim()) {
    throw new Error(
      "Golden diagnosis corpus id must be non-empty.",
    );
  }

  const caseIds =
    new Set<string>();
  for (const item of cases) {
    if (!item.id.trim()) {
      throw new Error(
        "Golden diagnosis case id must be non-empty.",
      );
    }
    if (caseIds.has(item.id)) {
      throw new Error(
        "Duplicate golden diagnosis case id: " +
          item.id +
          ".",
      );
    }
    caseIds.add(item.id);

    if (
      item.acceptedDispositions
        .length === 0
    ) {
      throw new Error(
        "Golden diagnosis case " +
          item.id +
          " requires at least one accepted disposition.",
      );
    }
  }

  const predictionById =
    new Map<string,
      GoldenDiagnosisPrediction>();
  const unexpected:
    string[] = [];

  for (const prediction of predictions) {
    if (
      predictionById.has(
        prediction.caseId,
      )
    ) {
      throw new Error(
        "Duplicate golden diagnosis prediction for case: " +
          prediction.caseId +
          ".",
      );
    }

    if (
      !caseIds.has(
        prediction.caseId,
      )
    ) {
      unexpected.push(
        prediction.caseId,
      );
      continue;
    }

    predictionById.set(
      prediction.caseId,
      prediction,
    );
  }

  const missing =
    cases
      .map((item) => item.id)
      .filter(
        (id) =>
          !predictionById.has(id),
      )
      .sort();

  const results:
    GoldenDiagnosisCaseResult[] = [];

  let truePositive = 0;
  let trueNegative = 0;
  let falsePositive = 0;
  let falseNegative = 0;
  let dispositionCorrectCount = 0;
  let rootCauseCases = 0;
  let rootCauseCorrectCount = 0;

  for (const item of cases) {
    const prediction =
      predictionById.get(item.id);
    if (!prediction) {
      continue;
    }

    const predictedDefect =
      DEFECT_DISPOSITIONS.has(
        prediction.disposition,
      );
    const dispositionCorrect =
      item.acceptedDispositions
        .includes(
          prediction.disposition,
        );
    const rootCauseRequired =
      (
        item.acceptedRootCauseIds
          ?.length ?? 0
      ) > 0;
    const rootCauseCorrect =
      rootCauseMatches(
        item.acceptedRootCauseIds,
        prediction.rootCauseIds,
      );

    if (dispositionCorrect) {
      dispositionCorrectCount += 1;
    }
    if (rootCauseRequired) {
      rootCauseCases += 1;
      if (rootCauseCorrect) {
        rootCauseCorrectCount += 1;
      }
    }

    if (
      item.expectedDefect &&
      predictedDefect
    ) {
      truePositive += 1;
    } else if (
      !item.expectedDefect &&
      !predictedDefect
    ) {
      trueNegative += 1;
    } else if (
      !item.expectedDefect &&
      predictedDefect
    ) {
      falsePositive += 1;
    } else {
      falseNegative += 1;
    }

    results.push({
      caseId: item.id,
      expectedDefect:
        item.expectedDefect,
      predictedDefect,
      dispositionCorrect,
      rootCauseRequired,
      rootCauseCorrect,
      falsePositive:
        !item.expectedDefect &&
        predictedDefect,
      falseNegative:
        item.expectedDefect &&
        !predictedDefect,
    });
  }

  const scoredCases =
    results.length;

  const report: GoldenDiagnosisBenchmarkReport = {
    schemaVersion: 1,
    corpusId,
    cases: results.sort(
      (a, b) =>
        a.caseId.localeCompare(
          b.caseId,
        ),
    ),
    metrics: {
      corpusCases:
        cases.length,
      cases: scoredCases,
      predictionCoverage:
        ratio(
          scoredCases,
          cases.length,
        ),
      truePositive,
      trueNegative,
      falsePositive,
      falseNegative,
      precision:
        ratio(
          truePositive,
          truePositive +
            falsePositive,
        ),
      recall:
        ratio(
          truePositive,
          truePositive +
            falseNegative,
        ),
      specificity:
        ratio(
          trueNegative,
          trueNegative +
            falsePositive,
        ),
      defectAccuracy:
        ratio(
          truePositive +
            trueNegative,
          scoredCases,
        ),
      dispositionAccuracy:
        ratio(
          dispositionCorrectCount,
          scoredCases,
        ),
      rootCauseAccuracy:
        ratio(
          rootCauseCorrectCount,
          rootCauseCases,
        ),
      rootCauseCases,
    },
    missingPredictionCaseIds:
      missing,
    unexpectedPredictionCaseIds:
      unique(unexpected),
    acceptance: {
      disposition: "unscored",
      metrics: [],
      reasons: [],
    },
    reasons: [
      missing.length === 0
        ? "Every golden case has a prediction."
        : String(missing.length) +
          " golden case(s) have no prediction; accuracy metrics apply only to predicted cases and prediction coverage must be read alongside them.",
      falsePositive === 0
        ? "No false-positive defect classification was observed."
        : String(falsePositive) +
          " false-positive defect classification(s) were observed.",
      falseNegative === 0
        ? "No false-negative defect classification was observed."
        : String(falseNegative) +
          " false-negative defect classification(s) were observed.",
      rootCauseCases === 0
        ? "No golden case requires root-cause scoring."
        : "Root-cause accuracy is scored independently from defect detection.",
    ],
  };
  return {
    ...report,
    acceptance: assessGoldenDiagnosisAcceptance(report, acceptanceTargets),
  };
}

function pct(
  value: number,
): string {
  return (
    Math.round(value * 1000) /
    10
  ).toFixed(1) + "%";
}

export function goldenDiagnosisBenchmarkText(
  report:
    GoldenDiagnosisBenchmarkReport,
): string {
  const m = report.metrics;
  return [
    "Golden Diagnosis Benchmark",
    "Corpus: " + report.corpusId,
    "Cases: " +
      String(m.corpusCases),
    "Cases scored: " +
      String(m.cases),
    "Prediction coverage: " +
      pct(m.predictionCoverage),
    "Quality acceptance: " +
      report.acceptance.disposition,
    ...report.acceptance.reasons.map(reason => "- " + reason),
    "",
    "Defect detection",
    "- precision: " +
      pct(m.precision),
    "- recall: " +
      pct(m.recall),
    "- specificity: " +
      pct(m.specificity),
    "- accuracy: " +
      pct(m.defectAccuracy),
    "",
    "Diagnosis quality",
    "- disposition accuracy: " +
      pct(
        m.dispositionAccuracy,
      ),
    "- root-cause accuracy: " +
      pct(
        m.rootCauseAccuracy,
      ) +
      " (" +
      String(m.rootCauseCases) +
      " case(s))",
    "",
    "Errors",
    "- false positives: " +
      String(m.falsePositive),
    "- false negatives: " +
      String(m.falseNegative),
    "- missing predictions: " +
      String(
        report
          .missingPredictionCaseIds
          .length,
      ),
  ].join("\n") + "\n";
}
