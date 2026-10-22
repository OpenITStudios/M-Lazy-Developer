import type {
  ProgressiveDiagnosisRunResult,
} from "../../../diagnosis-pipeline/src/index.js";
import type {
  SemanticAffectedPlan,
} from "./semantic-affected-plan.js";
import type {
  SelectiveValidationPlan,
} from "./selective-validation-plan.js";

export interface ZeroWasteExecutionSummary {
  diagnosis: {
    totalSteps: number;
    executedSteps: number;
    reusedSteps: number;
    reuseRatio: number;
  };
  semanticImpact?: {
    totalNodes: number;
    affectedNodes: number;
    skippedNodes: number;
    skipRatio: number;
  };
  validation?: {
    totalScenarios: number;
    selectedScenarios: number;
    skippedScenarios: number;
    skipRatio: number;
  };
  reasons: readonly string[];
}

function ratio(
  part: number,
  total: number,
): number {
  return total === 0
    ? 0
    : part / total;
}

export function summarizeZeroWasteExecution(
  diagnosis:
    ProgressiveDiagnosisRunResult,
  affected?:
    SemanticAffectedPlan,
  validation?:
    SelectiveValidationPlan,
): ZeroWasteExecutionSummary {
  const successful =
    diagnosis.executions.filter(
      (item) =>
        item.status === "executed",
    );
  const reused =
    successful.filter(
      (item) =>
        item.reused === true,
    );

  return {
    diagnosis: {
      totalSteps:
        diagnosis.executions.length,
      executedSteps:
        successful.length -
        reused.length,
      reusedSteps:
        reused.length,
      reuseRatio:
        ratio(
          reused.length,
          successful.length,
        ),
    },
    ...(affected === undefined
      ? {}
      : {
          semanticImpact: {
            totalNodes:
              affected.totalNodeCount,
            affectedNodes:
              affected.affectedNodeCount,
            skippedNodes:
              affected.skippedNodeCount,
            skipRatio:
              affected.skipRatio,
          },
        }),
    ...(validation === undefined
      ? {}
      : {
          validation: {
            totalScenarios:
              validation.totalScenarioCount,
            selectedScenarios:
              validation.selectedScenarioCount,
            skippedScenarios:
              validation.skippedScenarioCount,
            skipRatio:
              validation.skipRatio,
          },
        }),
    reasons: [
      diagnosis.executions.length === 0
        ? "Diagnosis required no capability execution in this run."
        : reused.length > 0
          ? String(reused.length) +
            " deterministic diagnosis step(s) were reused instead of recomputed."
          : "No deterministic diagnosis result was reused in this run.",
      ...(affected?.status === "planned"
        ? [
            String(
              affected.skippedNodeCount,
            ) +
              " semantic node(s) were outside the affected closure.",
          ]
        : []),
      ...(validation?.status ===
      "planned"
        ? [
            String(
              validation.skippedScenarioCount,
            ) +
              " validation scenario(s) were safely skipped.",
          ]
        : []),
    ],
  };
}

function pct(
  ratioValue: number,
): string {
  return (
    Math.round(
      ratioValue * 1000,
    ) / 10
  ).toFixed(1) + "%";
}

export function zeroWasteExecutionSummaryText(
  summary:
    ZeroWasteExecutionSummary,
): string {
  const lines = [
    "Zero-Waste Execution",
    "",
    "Diagnosis",
    "- executed: " +
      summary.diagnosis.executedSteps,
    "- reused: " +
      summary.diagnosis.reusedSteps,
    "- reuse ratio: " +
      pct(
        summary.diagnosis.reuseRatio,
      ),
  ];

  if (summary.semanticImpact) {
    lines.push(
      "",
      "Semantic impact",
      "- affected: " +
        summary.semanticImpact
          .affectedNodes +
        "/" +
        summary.semanticImpact.totalNodes,
      "- skipped: " +
        summary.semanticImpact
          .skippedNodes,
      "- skip ratio: " +
        pct(
          summary.semanticImpact
            .skipRatio,
        ),
    );
  }

  if (summary.validation) {
    lines.push(
      "",
      "Validation",
      "- selected: " +
        summary.validation
          .selectedScenarios +
        "/" +
        summary.validation
          .totalScenarios,
      "- skipped: " +
        summary.validation
          .skippedScenarios,
      "- skip ratio: " +
        pct(
          summary.validation
            .skipRatio,
        ),
    );
  }

  lines.push("", "Why");
  for (
    const reason of summary.reasons
  ) {
    lines.push("- " + reason);
  }

  return lines.join("\n") + "\n";
}
