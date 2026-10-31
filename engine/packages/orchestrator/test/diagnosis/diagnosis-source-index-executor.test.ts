import {
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  describe,
  expect,
  it,
} from "vitest";
import {
  planMinimumSufficientAnalysis,
} from "../../../analysis-planner/src/index.js";
import {
  DIAGNOSIS_ANALYSIS_CAPABILITY_REGISTRY,
  executePlannedDiagnosisStep,
} from "../../../diagnosis-pipeline/src/index.js";
import {
  createSourceIndexDiagnosisExecutor,
} from "../../src/diagnosis/diagnosis-source-index-executor.js";

function sourceIndexPlan() {
  return planMinimumSufficientAnalysis({
    goal: "intent-classification",
    relevantTags: ["session"],
    context: "LOCAL_ARTIFACT",
    capabilities:
      DIAGNOSIS_ANALYSIS_CAPABILITY_REGISTRY
        .capabilities,
  });
}

describe("source-index diagnosis executor", () => {
  it("executes the real source-index stage and returns reusable output", async () => {
    const root = await mkdtemp(
      join(tmpdir(), "m-bedrock-diagnosis-"),
    );

    try {
      await mkdir(join(root, "functions"), {
        recursive: true,
      });
      await writeFile(
        join(root, "functions", "start.mcfunction"),
        "say hello\n",
        "utf8",
      );

      const result =
        await executePlannedDiagnosisStep({
          plan: sourceIndexPlan(),
          context: "LOCAL_ARTIFACT",
          payload: {
            root,
            artifactId: "artifact:test",
            files: [{
              relativePath:
                "functions/start.mcfunction",
              size: 10,
              contentHash: "hash-start",
            }],
          },
          registry: {
            schemaVersion: 1,
            executors: [
              createSourceIndexDiagnosisExecutor(),
            ],
          },
        });

      expect(result.status).toBe(
        "executed",
      );
      if (result.status !== "executed") {
        return;
      }

      expect(result.evidence[0])
        .toMatchObject({
          level: "static",
          quality: "usable",
          traits: ["structural-proof"],
        });

      const output =
        result.output as {
          coverage: {
            complete: boolean;
            indexedFiles: number;
          };
        };

      expect(output.coverage).toEqual(
        expect.objectContaining({
          complete: true,
          indexedFiles: 1,
        }),
      );
    } finally {
      await rm(root, {
        recursive: true,
        force: true,
      });
    }
  });

  it("blocks confidence promotion while retaining partial source-index output", async () => {
    const root = await mkdtemp(
      join(tmpdir(), "m-bedrock-diagnosis-"),
    );

    try {
      await mkdir(join(root, "entities"), {
        recursive: true,
      });
      await writeFile(
        join(root, "entities", "broken.json"),
        "{ broken",
        "utf8",
      );

      const result =
        await executePlannedDiagnosisStep({
          plan: sourceIndexPlan(),
          context: "LOCAL_ARTIFACT",
          payload: {
            root,
            artifactId: "artifact:test",
            files: [{
              relativePath:
                "entities/broken.json",
              size: 8,
              contentHash: "hash-broken",
            }],
          },
          registry: {
            schemaVersion: 1,
            executors: [
              createSourceIndexDiagnosisExecutor(),
            ],
          },
        });

      expect(result.status).toBe(
        "blocked",
      );
      expect(result.reasons.join(" "))
        .toMatch(/coverage is incomplete/);

      if (result.status !== "blocked") {
        return;
      }

      const output =
        result.output as {
          coverage: {
            complete: boolean;
            parseFailures:
              readonly unknown[];
          };
        };

      expect(output.coverage.complete)
        .toBe(false);
      expect(
        output.coverage.parseFailures,
      ).toHaveLength(1);
    } finally {
      await rm(root, {
        recursive: true,
        force: true,
      });
    }
  });
});
