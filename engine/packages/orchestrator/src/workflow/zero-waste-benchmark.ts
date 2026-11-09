import type {
  ZeroWasteExecutionSummary,
} from "./zero-waste-execution-summary.js";
import type {
  CompiledContextPack,
} from "./context-compiler.js";

export interface ZeroWasteBenchmarkTargets {
  minimumDiagnosisReuseRatio?: number;
  minimumSemanticSkipRatio?: number;
  minimumValidationSkipRatio?: number;
  maximumContextTruncationRatio?: number;
}

export interface ZeroWasteBenchmarkInput {
  id: string;
  runMode: "cold" | "warm";
  summary: ZeroWasteExecutionSummary;
  context?: CompiledContextPack;
  targets?: ZeroWasteBenchmarkTargets;
}

export interface ZeroWasteBenchmarkMetric {
  id:
    | "diagnosis-reuse"
    | "semantic-skip"
    | "validation-skip"
    | "context-truncation";
  value: number;
  target?: number;
  disposition:
    | "pass"
    | "fail"
    | "unscored";
  detail: string;
}

export interface ZeroWasteBenchmarkReport {
  schemaVersion: 1;
  id: string;
  runMode: "cold" | "warm";
  disposition:
    | "pass"
    | "fail"
    | "unscored";
  metrics:
    readonly ZeroWasteBenchmarkMetric[];
  wasteSignals: readonly string[];
  reasons: readonly string[];
}

function boundedRatio(
  value: number,
): number {
  if (
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1
  ) {
    throw new Error(
      "Zero-waste benchmark ratios must be finite values from 0 through 1.",
    );
  }
  return value;
}

// A benchmark is invalid when its counters contradict its claimed ratios.
function nonNegativeCount(label: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("Invalid zero-waste count: " + label + ".");
  }
}

function consistentRatio(
  label: string,
  reported: number,
  numerator: number,
  denominator: number,
): void {
  boundedRatio(reported);
  const calculated = denominator === 0 ? 0 : numerator / denominator;
  if (Math.abs(reported - calculated) > 1e-9) {
    throw new Error("Inconsistent zero-waste ratio: " + label + ".");
  }
}

function validateSummary(summary: ZeroWasteExecutionSummary): void {
  const diagnosis = summary.diagnosis;
  nonNegativeCount("diagnosis.totalSteps", diagnosis.totalSteps);
  nonNegativeCount("diagnosis.executedSteps", diagnosis.executedSteps);
  nonNegativeCount("diagnosis.reusedSteps", diagnosis.reusedSteps);
  const successful = diagnosis.executedSteps + diagnosis.reusedSteps;
  if (!Number.isSafeInteger(successful) || successful > diagnosis.totalSteps) {
    throw new Error("Inconsistent zero-waste diagnosis step counts.");
  }
  consistentRatio(
    "diagnosis.reuseRatio",
    diagnosis.reuseRatio,
    diagnosis.reusedSteps,
    successful,
  );

  if (summary.semanticImpact) {
    const impact = summary.semanticImpact;
    nonNegativeCount("semanticImpact.totalNodes", impact.totalNodes);
    nonNegativeCount("semanticImpact.affectedNodes", impact.affectedNodes);
    nonNegativeCount("semanticImpact.skippedNodes", impact.skippedNodes);
    if (impact.affectedNodes + impact.skippedNodes !== impact.totalNodes) {
      throw new Error("Inconsistent zero-waste semantic node counts.");
    }
    consistentRatio(
      "semanticImpact.skipRatio",
      impact.skipRatio,
      impact.skippedNodes,
      impact.totalNodes,
    );
  }

  if (summary.validation) {
    const validation = summary.validation;
    nonNegativeCount("validation.totalScenarios", validation.totalScenarios);
    nonNegativeCount("validation.selectedScenarios", validation.selectedScenarios);
    nonNegativeCount("validation.skippedScenarios", validation.skippedScenarios);
    if (
      validation.selectedScenarios + validation.skippedScenarios !==
      validation.totalScenarios
    ) {
      throw new Error("Inconsistent zero-waste validation scenario counts.");
    }
    consistentRatio(
      "validation.skipRatio",
      validation.skipRatio,
      validation.skippedScenarios,
      validation.totalScenarios,
    );
  }
}

function minimumMetric(
  id:
    ZeroWasteBenchmarkMetric["id"],
  value: number,
  target: number | undefined,
  detail: string,
): ZeroWasteBenchmarkMetric {
  const normalized =
    boundedRatio(value);

  if (target === undefined) {
    return {
      id,
      value: normalized,
      disposition: "unscored",
      detail,
    };
  }

  const threshold =
    boundedRatio(target);

  return {
    id,
    value: normalized,
    target: threshold,
    disposition:
      normalized >= threshold
        ? "pass"
        : "fail",
    detail,
  };
}

function contextTruncationRatio(
  pack:
    CompiledContextPack |
    undefined,
): number | undefined {
  if (!pack) return undefined;

  const included =
    pack.semantic.nodes.length +
    pack.semantic.edges.length +
    pack.intent.nodes.length +
    pack.intent.invariants.length +
    pack.intent.unknowns.length +
    pack.intent.evidence.length;

  const omitted =
    pack.truncation.semanticNodes +
    pack.truncation.semanticEdges +
    pack.truncation.intentNodes +
    pack.truncation.invariants +
    pack.truncation.unknowns +
    pack.truncation.evidence;

  const total =
    included + omitted;

  return total === 0
    ? 0
    : omitted / total;
}

function maximumMetric(
  id:
    ZeroWasteBenchmarkMetric["id"],
  value: number,
  target: number | undefined,
  detail: string,
): ZeroWasteBenchmarkMetric {
  const normalized =
    boundedRatio(value);

  if (target === undefined) {
    return {
      id,
      value: normalized,
      disposition: "unscored",
      detail,
    };
  }

  const threshold =
    boundedRatio(target);

  return {
    id,
    value: normalized,
    target: threshold,
    disposition:
      normalized <= threshold
        ? "pass"
        : "fail",
    detail,
  };
}

export function evaluateZeroWasteBenchmark(
  input: ZeroWasteBenchmarkInput,
): ZeroWasteBenchmarkReport {
  if (!input.id.trim()) {
    throw new Error(
      "Zero-waste benchmark id must be non-empty.",
    );
  }

  if (input.runMode !== "cold" && input.runMode !== "warm") {
    throw new Error("Invalid zero-waste benchmark runMode.");
  }
  validateSummary(input.summary);
  if (
    input.targets?.minimumSemanticSkipRatio !== undefined &&
    input.summary.semanticImpact === undefined
  ) {
    throw new Error("Missing semanticImpact for configured zero-waste target.");
  }
  if (
    input.targets?.minimumValidationSkipRatio !== undefined &&
    input.summary.validation === undefined
  ) {
    throw new Error("Missing validation evidence for configured zero-waste target.");
  }
  if (
    input.targets?.maximumContextTruncationRatio !== undefined &&
    input.context === undefined
  ) {
    throw new Error("Missing context for configured zero-waste target.");
  }

  const metrics:
    ZeroWasteBenchmarkMetric[] = [];

  if (input.runMode === "warm") {
    metrics.push(
      minimumMetric(
        "diagnosis-reuse",
        input.summary.diagnosis
          .reuseRatio,
        input.targets
          ?.minimumDiagnosisReuseRatio,
        "Share of successful deterministic diagnosis steps reused instead of recomputed on a warm run.",
      ),
    );
  }

  if (
    input.summary.semanticImpact
  ) {
    metrics.push(
      minimumMetric(
        "semantic-skip",
        input.summary.semanticImpact
          .skipRatio,
        input.targets
          ?.minimumSemanticSkipRatio,
        "Case-specific share of semantic nodes outside the affected dependency closure; only interpret against an explicit benchmark target.",
      ),
    );
  }

  if (input.summary.validation) {
    metrics.push(
      minimumMetric(
        "validation-skip",
        input.summary.validation
          .skipRatio,
        input.targets
          ?.minimumValidationSkipRatio,
        "Case-specific share of validation scenarios proven outside the affected closure; only interpret against an explicit benchmark target.",
      ),
    );
  }

  const truncation =
    contextTruncationRatio(
      input.context,
    );

  if (truncation !== undefined) {
    const requiredScopeComplete =
      input.context?.complete === true;

    metrics.push(
      maximumMetric(
        "context-truncation",
        truncation,
        requiredScopeComplete
          ? undefined
          : input.targets
              ?.maximumContextTruncationRatio,
        requiredScopeComplete
          ? "Optional surrounding context omitted while explicitly required scope remains complete; informational only."
          : "Share of eligible context items omitted while the compiled context remains incomplete.",
      ),
    );
  }

  const failed =
    metrics.filter(
      (metric) =>
        metric.disposition ===
        "fail",
    );
  const scored =
    metrics.filter(
      (metric) =>
        metric.disposition !==
        "unscored",
    );

  const wasteSignals: string[] = [];

  if (
    input.runMode === "warm" &&
    input.summary.diagnosis
      .totalSteps > 1 &&
    input.summary.diagnosis
      .reusedSteps === 0
  ) {
    wasteSignals.push(
      "repeated-diagnosis-without-reuse",
    );
  }

  if (
    truncation !== undefined &&
    input.context?.complete === false &&
    truncation > 0.5
  ) {
    wasteSignals.push(
      "context-budget-high-truncation",
    );
  }

  return {
    schemaVersion: 1,
    id: input.id,
    runMode: input.runMode,
    disposition:
      failed.length > 0
        ? "fail"
        : scored.length > 0
          ? "pass"
          : "unscored",
    metrics,
    wasteSignals,
    reasons: [
      input.runMode === "cold"
        ? "Cold run: diagnosis reuse is not scored because no prior cache is assumed."
        : "Warm run: deterministic diagnosis reuse is eligible for scoring.",
      failed.length > 0
        ? String(failed.length) +
          " zero-waste target(s) missed."
        : scored.length > 0
          ? "All configured zero-waste targets passed."
          : "No benchmark targets were configured; metrics are informational only.",
      wasteSignals.length > 0
        ? "Waste signals: " +
          wasteSignals.join(", ") +
          "."
        : "No heuristic waste signal was detected.",
    ],
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

export function zeroWasteBenchmarkText(
  report:
    ZeroWasteBenchmarkReport,
): string {
  const lines = [
    "Zero-Waste Benchmark",
    "ID: " + report.id,
    "Mode: " + report.runMode,
    "Status: " +
      report.disposition,
    "",
    "Metrics",
  ];

  for (const metric of report.metrics) {
    lines.push(
      "- " +
        metric.id +
        ": " +
        pct(metric.value) +
        (
          metric.target ===
          undefined
            ? " [unscored]"
            : " / target " +
              pct(metric.target) +
              " [" +
              metric.disposition +
              "]"
        ),
    );
  }

  lines.push("", "Waste signals");
  if (
    report.wasteSignals.length === 0
  ) {
    lines.push("- none");
  } else {
    for (
      const signal of
      report.wasteSignals
    ) {
      lines.push("- " + signal);
    }
  }

  return lines.join("\n") + "\n";
}
