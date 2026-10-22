import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseMcFunction } from "../../../../analyzers/functions/src/index.js";
import {
  parseScriptFile,
} from "../../../../analyzers/scripts/src/index.js";
import ts from "typescript";
import { analyzeFunctionTopology } from "../inspection/topology-analysis.js";
import { inspectDirectory } from "../inspection/inspect.js";
import { summarizeValidation } from "../../../validation/src/index.js";
import type {
  TransactionValidationResult,
  ValidationStep,
  ValidationStepResult,
} from "../../../validation/src/index.js";
import type {
  SemanticGraph,
} from "../../../graph/src/index.js";
import {
  buildFilesystemInventory,
} from "../../../project-model/src/index.js";
import {
  indexInspectionSources,
} from "../inspection/inspect-source-index.js";
import {
  enrichInspectionSemanticGraph,
} from "../inspection/inspect-graph-enrichment.js";
import {
  populateInspectionScriptImportGraph,
} from "../inspection/inspect-script-import-graph.js";
import type { PatchTransaction } from "../../../repair/src/index.js";
import type { MutationWorkspace } from "../../../repair/src/index.js";
import type { InspectTargetProfile } from "../core/types.js";

function sameSource(
  actual: { relativePath?: string; range?: { lineStart?: number } } | undefined,
  expected: ValidationStep extends infer _ ? { relativePath: string; range?: { lineStart?: number } } : never,
): boolean {
  if (!actual?.relativePath || actual.relativePath !== expected.relativePath) return false;
  const expectedLine = expected.range?.lineStart;
  if (expectedLine === undefined) return true;
  return actual.range?.lineStart === expectedLine;
}

function scriptPath(path: string): boolean {
  return /\.(?:[cm]?js|jsx|[cm]?ts|tsx)$/i.test(path);
}

async function validateReparse(
  workingRoot: string,
  step: Extract<ValidationStep, { kind: "reparse" }>,
): Promise<ValidationStepResult> {
  try {
    const text = await readFile(
      join(workingRoot, step.source.relativePath),
      "utf8",
    );

    if (step.source.relativePath.endsWith(".mcfunction")) {
      parseMcFunction(
        step.source.relativePath,
        text,
        step.source,
      );
      return {
        step,
        ok: true,
        message:
          "Affected function reparsed successfully.",
      };
    }

    if (scriptPath(step.source.relativePath)) {
      const syntaxDiagnostics =
        (
          ts.transpileModule(text, {
            fileName: step.source.relativePath,
            reportDiagnostics: true,
            compilerOptions: {
              target: ts.ScriptTarget.ESNext,
              module: ts.ModuleKind.ESNext,
            },
          }).diagnostics ?? []
        ).filter(
          (diagnostic) =>
            diagnostic.category ===
            ts.DiagnosticCategory.Error,
        );

      if (syntaxDiagnostics.length > 0) {
        return {
          step,
          ok: false,
          message:
            "Affected script has TypeScript/JavaScript parse diagnostics after mutation: " +
            ts.flattenDiagnosticMessageText(
              syntaxDiagnostics[0]!.messageText,
              "\n",
            ),
        };
      }

      parseScriptFile(
        step.source.relativePath,
        text,
        step.source,
      );
      return {
        step,
        ok: true,
        message:
          "Affected script reparsed and analyzer extraction completed successfully.",
      };
    }

    return {
      step,
      ok: false,
      message:
        "No reparse validator is registered for this source type.",
    };
  } catch (error) {
    return {
      step,
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Reparse failed.",
    };
  }
}

export interface RepairTransactionValidationResult
  extends TransactionValidationResult {
  rebuiltGraph?: SemanticGraph;
}

export async function validatePatchTransaction(
  transaction: PatchTransaction,
  workspace: MutationWorkspace,
  target: InspectTargetProfile = {},
): Promise<RepairTransactionValidationResult> {
  let inspection: Awaited<ReturnType<typeof inspectDirectory>> | undefined;
  let topology: ReturnType<typeof analyzeFunctionTopology> | undefined;
  let rebuiltGraph: SemanticGraph | undefined;

  const ensureInspection = async () => {
    if (!inspection) {
      inspection = await inspectDirectory(
        workspace.workingRoot,
        transaction.sourceFingerprint,
        target,
      );
    }
    return inspection;
  };

  const ensureRebuiltGraph = async () => {
    if (rebuiltGraph) return rebuiltGraph;

    const files = await buildFilesystemInventory(
      workspace.workingRoot,
    );
    const sourceIndex =
      await indexInspectionSources(
        workspace.workingRoot,
        transaction.sourceFingerprint,
        files,
      );

    enrichInspectionSemanticGraph({
      graph: sourceIndex.graph,
      nodes: sourceIndex.nodes,
      artifactId:
        transaction.sourceFingerprint,
      parsedFunctions:
        sourceIndex.parsedFunctions,
      tickFunctionRegistrations: sourceIndex.tickFunctionRegistrations,
      parsedEntities: sourceIndex.parsedEntities,
      parsedDialogueDocuments:
        sourceIndex.parsedDialogueDocuments,
      parsedStructureModels:
        sourceIndex.parsedStructureModels,
    });
    populateInspectionScriptImportGraph(
      sourceIndex.graph,
      sourceIndex.parsedScripts,
    );

    rebuiltGraph = sourceIndex.graph;
    return rebuiltGraph;
  };

  const ensureTopology = async () => {
    if (topology) return topology;

    const parsedFunctions = [];
    for (const path of transaction.affectedPaths) {
      if (!path.endsWith(".mcfunction")) continue;
      const text = await readFile(join(workspace.workingRoot, path), "utf8");
      parsedFunctions.push(parseMcFunction(
        path,
        text,
        { artifactId: transaction.sourceFingerprint, relativePath: path },
      ));
    }

    topology = analyzeFunctionTopology(parsedFunctions);
    return topology;
  };

  const results: ValidationStepResult[] = [];

  for (const step of transaction.validation) {
    if (step.kind === "reparse") {
      results.push(await validateReparse(workspace.workingRoot, step));
      continue;
    }

    if (step.kind === "rebuild-graph") {
      try {
        // This validation step rebuilds the selected source graph only.
        // Full gameplay diagnostics remain owned by rerun-diagnostic.
        await ensureRebuiltGraph();
        results.push({ step, ok: true, message: "Integrated semantic graph rebuilt successfully." });
      } catch (error) {
        results.push({
          step,
          ok: false,
          message: error instanceof Error ? error.message : "Graph rebuild failed.",
        });
      }
      continue;
    }

    if (step.kind === "rerun-diagnostic") {
      try {
        const current = await ensureInspection();
        const matching = current.diagnostics.filter((finding) =>
          finding.code === step.code &&
          (!step.source || sameSource(finding.source, step.source))
        );
        results.push({
          step,
          ok: matching.length === 0,
          message: matching.length === 0
            ? `${step.code} is absent at the requested source scope.`
            : `${step.code} is still present at the requested source scope.`,
        });
      } catch (error) {
        results.push({
          step,
          ok: false,
          message: error instanceof Error ? error.message : "Diagnostic rerun failed.",
        });
      }
      continue;
    }

    if (step.kind === "topology-compare") {
      try {
        const current = await ensureTopology();
        const matching = current.linearOutliers.filter((outlier) => {
          if (outlier.sourcePath !== step.source.relativePath) return false;
          const record = current.spatialRecords[outlier.effectIndex];
          const expectedLine = step.source.range?.lineStart;
          return expectedLine === undefined ||
            record?.effect.source.range?.lineStart === expectedLine;
        });

        results.push({
          step,
          ok: matching.length === 0,
          message: matching.length === 0
            ? "Topology outlier is absent at the repaired source location."
            : "Topology outlier remains at the repaired source location.",
        });
      } catch (error) {
        results.push({
          step,
          ok: false,
          message: error instanceof Error ? error.message : "Topology comparison failed.",
        });
      }
    }
  }

  const summary = summarizeValidation(results);
  return {
    ...summary,
    ...(rebuiltGraph === undefined
      ? {}
      : { rebuiltGraph }),
  };
}
