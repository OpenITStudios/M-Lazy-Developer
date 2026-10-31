// Same-owner, same-feature development source family; original lexical bodies preserved.
import { describe, expect, it, vi } from "vitest";
import { createInMemoryDiagnosisResultCache, diagnosisCacheValueFingerprint, diagnosisExecutionCacheKey, DIAGNOSIS_ANALYSIS_CAPABILITY_REGISTRY, executePlannedDiagnosisStep, validateDiagnosisExecutorRegistry, DIAGNOSIS_ANALYSIS_CAPABILITIES, diagnosisCapabilityByExecutorId, runProgressiveDiagnosis } from "../src/index.js";
import type { DiagnosisExecutorRegistry, DiagnosisCapabilityExecutor } from "../src/index.js";
import { planMinimumSufficientAnalysis } from "../../analysis-planner/src/index.js";

// Source engine/packages/diagnosis-pipeline/test/cache.test.ts; blob acd220922658c37748a98f4d20070ac99c8be9af
{
describe("diagnosis result cache", () => {
  it("fingerprints structurally equivalent payloads identically", () => {
    const first =
      diagnosisExecutionCacheKey({
        capabilityId:
          "diagnosis.source-index",
        executorId:
          "diagnosis.source-index",
        capabilityRevision: "1",
        executorRevision:
          "executor:test:1",
        context: "LOCAL_ARTIFACT",
        payload: {
          z: 2,
          a: {
            second: true,
            first: "x",
          },
        },
      });

    const second =
      diagnosisExecutionCacheKey({
        capabilityId:
          "diagnosis.source-index",
        executorId:
          "diagnosis.source-index",
        capabilityRevision: "1",
        executorRevision:
          "executor:test:1",
        context: "LOCAL_ARTIFACT",
        payload: {
          a: {
            first: "x",
            second: true,
          },
          z: 2,
        },
      });

    expect(first).toBe(second);
  });

  it("rejects ambiguous non-finite numeric cache inputs", () => {
    expect(() =>
      diagnosisExecutionCacheKey({
        capabilityId:
          "diagnosis.source-index",
        executorId:
          "diagnosis.source-index",
        capabilityRevision: "1",
        executorRevision:
          "executor:test:1",
        context: "LOCAL_ARTIFACT",
        payload: {
          value: Number.NaN,
        },
      })
    ).toThrow(/non-finite/);

    expect(() =>
      diagnosisExecutionCacheKey({
        capabilityId:
          "diagnosis.source-index",
        executorId:
          "diagnosis.source-index",
        capabilityRevision: "1",
        executorRevision:
          "executor:test:1",
        context: "LOCAL_ARTIFACT",
        payload: {
          value:
            Number.POSITIVE_INFINITY,
        },
      })
    ).toThrow(/non-finite/);
  });

  it("distinguishes negative zero from zero", () => {
    const zero =
      diagnosisExecutionCacheKey({
        capabilityId:
          "diagnosis.source-index",
        executorId:
          "diagnosis.source-index",
        capabilityRevision: "1",
        executorRevision:
          "executor:test:1",
        context: "LOCAL_ARTIFACT",
        payload: { value: 0 },
      });
    const negativeZero =
      diagnosisExecutionCacheKey({
        capabilityId:
          "diagnosis.source-index",
        executorId:
          "diagnosis.source-index",
        capabilityRevision: "1",
        executorRevision:
          "executor:test:1",
        context: "LOCAL_ARTIFACT",
        payload: { value: -0 },
      });

    expect(negativeZero)
      .not.toBe(zero);
  });

  it("fingerprints class-backed state without invoking public methods", () => {
    class Stateful {
      private readonly nodes =
        new Map<string, {
          id: string;
        }>();
      calls = 0;

      allNodes() {
        this.calls += 1;
        return [
          ...this.nodes.values(),
        ];
      }

      addNode(id: string) {
        this.nodes.set(id, { id });
      }
    }

    const value = new Stateful();
    const first =
      diagnosisCacheValueFingerprint(
        value,
      );

    expect(value.calls).toBe(0);

    value.addNode("n1");

    const second =
      diagnosisCacheValueFingerprint(
        value,
      );

    expect(value.calls).toBe(0);
    expect(second)
      .not.toBe(first);
  });

  it("changes the key when executor revision changes", () => {
    const first =
      diagnosisExecutionCacheKey({
        capabilityId:
          "diagnosis.source-index",
        executorId:
          "diagnosis.source-index",
        capabilityRevision: "1",
        executorRevision:
          "executor:test:1",
        context: "LOCAL_ARTIFACT",
        payload: { artifact: "a" },
      });

    const second =
      diagnosisExecutionCacheKey({
        capabilityId:
          "diagnosis.source-index",
        executorId:
          "diagnosis.source-index",
        capabilityRevision: "1",
        executorRevision:
          "executor:test:2",
        context: "LOCAL_ARTIFACT",
        payload: { artifact: "a" },
      });

    expect(second)
      .not.toBe(first);
  });

  it("changes the key when capability revision or payload changes", () => {
    const base = {
      capabilityId:
        "diagnosis.source-index",
      executorId:
        "diagnosis.source-index",
      executorRevision:
        "executor:test:1",
      context:
        "LOCAL_ARTIFACT" as const,
    };

    const first =
      diagnosisExecutionCacheKey({
        ...base,
        capabilityRevision: "1",
        payload: { artifact: "a" },
      });
    const changedPayload =
      diagnosisExecutionCacheKey({
        ...base,
        capabilityRevision: "1",
        payload: { artifact: "b" },
      });
    const changedRevision =
      diagnosisExecutionCacheKey({
        ...base,
        capabilityRevision: "2",
        executorRevision:
          "executor:test:1",
        payload: { artifact: "a" },
      });

    expect(changedPayload)
      .not.toBe(first);
    expect(changedRevision)
      .not.toBe(first);
  });

  it("preserves executor output identity so class prototypes are not destroyed", async () => {
    const cache =
      createInMemoryDiagnosisResultCache();
    class Output {
      value() {
        return "ok";
      }
    }
    const output = new Output();

    await cache.put({
      schemaVersion: 1,
      cacheKey: "k",
      capabilityId:
        "diagnosis.source-index",
      executorId:
        "diagnosis.source-index",
      capabilityRevision: "1",
      executorRevision:
        "executor:test:1",
      context: "LOCAL_ARTIFACT",
      outputFingerprint:
        diagnosisCacheValueFingerprint(
          output,
        ),
      evidence: [{
        level: "static",
        quality: "usable",
        traits: ["structural-proof"],
        evidenceIds: ["e1"],
      }],
      output,
      reasons: [],
    });

    const cached =
      await cache.get("k");

    expect(cached?.output)
      .toBe(output);
    expect(
      (cached?.output as Output)
        .value(),
    ).toBe("ok");
  });
});
}

// Source engine/packages/diagnosis-pipeline/test/execution.test.ts; blob 68133d82621907db49c5b9f67b181569449bd903
{
function plan() {
  return planMinimumSufficientAnalysis({
    goal: "intent-classification",
    relevantTags: ["session"],
    context: "LOCAL_ARTIFACT",
    capabilities:
      DIAGNOSIS_ANALYSIS_CAPABILITY_REGISTRY
        .capabilities,
  });
}

describe("diagnosis planned-step execution", () => {
  it("executes only the explicitly planned canonical executor", async () => {
    const execute = vi.fn(async () => ({
      status: "completed" as const,
      evidence: [{
        level: "static" as const,
        evidenceIds: ["source:e1"],
        quality: "usable" as const,
        traits: ["structural-proof" as const],
      }],
      output: { indexed: true },
    }));

    const result =
      await executePlannedDiagnosisStep({
        plan: plan(),
        context: "LOCAL_ARTIFACT",
        payload: { artifactId: "a" },
        registry: {
          schemaVersion: 1,
          executors: [{
            executorId:
              "diagnosis.source-index",
            executorRevision:
              "diagnosis.source-index:test:1",
            execute,
          }],
        },
      });

    expect(result.status).toBe(
      "executed",
    );
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("blocks executors that overclaim completion without declared evidence traits", async () => {
    const result =
      await executePlannedDiagnosisStep({
        plan: plan(),
        context: "LOCAL_ARTIFACT",
        payload: {},
        registry: {
          schemaVersion: 1,
          executors: [{
            executorId:
              "diagnosis.source-index",
            executorRevision:
              "diagnosis.source-index:test:1",
            execute: async () => ({
              status: "completed",
              evidence: [{
                level: "static",
                evidenceIds: ["source:e1"],
                quality: "usable",
                traits: [],
              }],
              output: {},
            }),
          }],
        },
      });

    expect(result.status).toBe(
      "blocked",
    );
    expect(result.reasons.join(" "))
      .toMatch(/declared evidence trait/);
  });

  it("does not execute a missing or unrelated executor", async () => {
    const result =
      await executePlannedDiagnosisStep({
        plan: plan(),
        context: "LOCAL_ARTIFACT",
        payload: {},
        registry: {
          schemaVersion: 1,
          executors: [],
        },
      });

    expect(result.status).toBe(
      "blocked",
    );
    expect(result.reasons.join(" "))
      .toMatch(/No executor is registered/);
  });

  it("fails open when cache-key generation cannot canonicalize the payload", async () => {
    const execute = vi.fn(async () => ({
      status: "completed" as const,
      evidence: [{
        level: "static" as const,
        evidenceIds: ["source:e1"],
        quality: "usable" as const,
        traits: ["structural-proof" as const],
      }],
      output: { indexed: true },
    }));

    const result =
      await executePlannedDiagnosisStep({
        plan: plan(),
        context: "LOCAL_ARTIFACT",
        payload: {
          unsupported:
            () => "not-cacheable",
        },
        registry: {
          schemaVersion: 1,
          executors: [{
            executorId:
              "diagnosis.source-index",
            executorRevision:
              "diagnosis.source-index:test:1",
            execute,
          }],
        },
        cache: {
          get: () => undefined,
          put: () => undefined,
        },
      });

    expect(result.status)
      .toBe("executed");
    expect(execute)
      .toHaveBeenCalledTimes(1);
    expect(
      result.status === "executed"
        ? result.reasons.join(" ")
        : "",
    ).toMatch(/cache key generation failed/i);
  });

  it("disables cache reuse when a deterministic executor has no revision", async () => {
    const execute = vi.fn(async () => ({
      status: "completed" as const,
      evidence: [{
        level: "static" as const,
        evidenceIds: ["source:e1"],
        quality: "usable" as const,
        traits: ["structural-proof" as const],
      }],
      output: { indexed: true },
    }));

    const result =
      await executePlannedDiagnosisStep({
        plan: plan(),
        context: "LOCAL_ARTIFACT",
        payload: { artifactId: "a" },
        registry: {
          schemaVersion: 1,
          executors: [{
            executorId:
              "diagnosis.source-index",
            execute,
          }],
        },
        cache: {
          get: () => {
            throw new Error(
              "cache should not be read",
            );
          },
          put: () => {
            throw new Error(
              "cache should not be written",
            );
          },
        },
      });

    expect(result.status)
      .toBe("executed");
    expect(
      result.status === "executed"
        ? result.reasons.join(" ")
        : "",
    ).toMatch(
      /no executorRevision/,
    );
  });

  it("rejects executor ids outside the canonical diagnosis profile", () => {
    const registry: DiagnosisExecutorRegistry = {
      schemaVersion: 1,
      executors: [{
        executorId: "random.executor",
        execute: async () => ({
          status: "blocked",
          reasons: ["unused"],
        }),
      }],
    };

    expect(
      validateDiagnosisExecutorRegistry(
        registry,
      ).join(" "),
    ).toMatch(/not declared/);
  });
});
}

// Source engine/packages/diagnosis-pipeline/test/profile.test.ts; blob 95ce623c57c305fb7ec0718179fba2ec9827db21
{
describe("diagnosis analysis capability profile", () => {
  it("declares one deterministic canonical registry", () => {
    expect(
      DIAGNOSIS_ANALYSIS_CAPABILITY_REGISTRY
        .capabilities.length,
    ).toBe(
      DIAGNOSIS_ANALYSIS_CAPABILITIES.length,
    );
    expect(
      DIAGNOSIS_ANALYSIS_CAPABILITY_REGISTRY
        .capabilities.map((item) => item.id),
    ).toEqual(
      [...DIAGNOSIS_ANALYSIS_CAPABILITIES]
        .map((item) => item.id)
        .sort(),
    );
  });

  it("selects source indexing before semantic intent work", () => {
    const plan =
      planMinimumSufficientAnalysis({
        goal: "intent-classification",
        relevantTags: ["session"],
        context: "LOCAL_ARTIFACT",
        capabilities:
          DIAGNOSIS_ANALYSIS_CAPABILITY_REGISTRY
            .capabilities,
      });

    expect(
      plan.steps[0]?.capabilityId,
    ).toBe("diagnosis.source-index");
  });

  it("reuses already-grounded intent without redundant analysis", () => {
    const plan =
      planMinimumSufficientAnalysis({
        goal: "intent-classification",
        relevantTags: ["session"],
        context: "LOCAL_ARTIFACT",
        availableEvidence: [{
          level: "semantic",
          evidenceIds: ["intent:inferred"],
          quality: "usable",
          traits: ["intent-grounded"],
        }],
        completedCapabilityIds: [
          "diagnosis.source-index",
          "diagnosis.intent-grounding",
        ],
        capabilities:
          DIAGNOSIS_ANALYSIS_CAPABILITY_REGISTRY
            .capabilities,
      });

    expect(plan.steps).toEqual([]);
  });

  it("binds executor ids to explicit owners", () => {
    expect(
      diagnosisCapabilityByExecutorId(
        "diagnosis.runtime-observation",
      ),
    ).toMatchObject({
      owner: "packages/runtime-lab/src/index.ts",
      evidenceLevel: "runtime",
    });
  });
});
}

// Source engine/packages/diagnosis-pipeline/test/progressive-runner.test.ts; blob 3d82bdc06806d79b5b2edcf9062b71789a0baa45
{
function executor(
  executorId: string,
  level:
    | "static"
    | "semantic",
  trait:
    | "structural-proof"
    | "intent-grounded",
): DiagnosisCapabilityExecutor {
  return {
    executorId,
    executorRevision:
      executorId + ":test:1",
    execute: vi.fn(async () => ({
      status: "completed" as const,
      output: {
        executorId,
      },
      evidence: [{
        level,
        quality: "usable" as const,
        traits: [trait],
        evidenceIds: [
          executorId + ":evidence",
        ],
      }],
    })),
  };
}

describe("progressive diagnosis runner", () => {
  it("takes the minimum sufficient route and skips semantic IR when intent grounding closes the goal directly", async () => {
    const source =
      executor(
        "diagnosis.source-index",
        "static",
        "structural-proof",
      );
    const intent =
      executor(
        "diagnosis.intent-grounding",
        "semantic",
        "intent-grounded",
      );
    const semantic = {
      executorId:
        "diagnosis.semantic-ir",
      executorRevision:
        "diagnosis.semantic-ir:test:1",
      execute: vi.fn(async () => ({
        status: "completed" as const,
        output: {},
        evidence: [{
          level: "semantic" as const,
          quality: "usable" as const,
          traits: [
            "semantic-model" as const,
          ],
          evidenceIds: ["semantic:e1"],
        }],
      })),
    };

    const result =
      await runProgressiveDiagnosis({
        goal: "intent-classification",
        relevantTags: ["session"],
        context: "LOCAL_ARTIFACT",
        executorRegistry: {
          schemaVersion: 1,
          executors: [
            source,
            semantic,
            intent,
          ],
        },
        payloadProvider: {
          payloadFor: () => ({}),
        },
      });

    expect(result.status).toBe(
      "sufficient",
    );
    expect(
      result.executions.map(
        (item) => item.capabilityId,
      ),
    ).toEqual([
      "diagnosis.source-index",
      "diagnosis.intent-grounding",
    ]);
    expect(
      semantic.execute,
    ).not.toHaveBeenCalled();
  });

  it("does not execute runtime work from local artifact context", async () => {
    const result =
      await runProgressiveDiagnosis({
        goal: "runtime-behavior",
        relevantTags: ["session"],
        context: "LOCAL_ARTIFACT",
        executorRegistry: {
          schemaVersion: 1,
          executors: [],
        },
        payloadProvider: {
          payloadFor: vi.fn(),
        },
      });

    expect(result.status).toBe(
      "requires-runtime-context",
    );
    expect(result.executions)
      .toEqual([]);
  });

  it("stops immediately when an executor reports an evidence or coverage block", async () => {
    const result =
      await runProgressiveDiagnosis({
        goal: "intent-classification",
        relevantTags: ["session"],
        context: "LOCAL_ARTIFACT",
        executorRegistry: {
          schemaVersion: 1,
          executors: [{
            executorId:
              "diagnosis.source-index",
            executorRevision:
              "diagnosis.source-index:test:blocked",
            execute: async () => ({
              status: "blocked",
              output: {
                partial: true,
              },
              reasons: [
                "coverage incomplete",
              ],
            }),
          }],
        },
        payloadProvider: {
          payloadFor: () => ({}),
        },
      });

    expect(result.status).toBe(
      "blocked",
    );
    expect(result.executions)
      .toHaveLength(1);
    expect(
      result.outputs[
        "diagnosis.source-index"
      ],
    ).toEqual({ partial: true });
  });

  it("enforces a hard step bound", async () => {
    const source =
      executor(
        "diagnosis.source-index",
        "static",
        "structural-proof",
      );

    const result =
      await runProgressiveDiagnosis({
        goal: "intent-classification",
        relevantTags: ["session"],
        context: "LOCAL_ARTIFACT",
        executorRegistry: {
          schemaVersion: 1,
          executors: [source],
        },
        payloadProvider: {
          payloadFor: () => ({}),
        },
        maxSteps: 1,
      });

    expect(result.status).toBe(
      "blocked",
    );
    expect(result.reasons.join(" "))
      .toMatch(/step limit/);
  });

  it("reuses deterministic capability results for identical inputs and revisions", async () => {
    const cache =
      createInMemoryDiagnosisResultCache();
    const firstSource =
      executor(
        "diagnosis.source-index",
        "static",
        "structural-proof",
      );
    const firstIntent =
      executor(
        "diagnosis.intent-grounding",
        "semantic",
        "intent-grounded",
      );

    const first =
      await runProgressiveDiagnosis({
        goal: "intent-classification",
        relevantTags: ["session"],
        context: "LOCAL_ARTIFACT",
        executorRegistry: {
          schemaVersion: 1,
          executors: [
            firstSource,
            firstIntent,
          ],
        },
        payloadProvider: {
          payloadFor: (input) => ({
            capabilityId:
              input.capabilityId,
            artifact: "same",
          }),
        },
        resultCache: cache,
      });

    expect(first.status).toBe(
      "sufficient",
    );

    const secondSource =
      executor(
        "diagnosis.source-index",
        "static",
        "structural-proof",
      );
    const secondIntent =
      executor(
        "diagnosis.intent-grounding",
        "semantic",
        "intent-grounded",
      );

    const second =
      await runProgressiveDiagnosis({
        goal: "intent-classification",
        relevantTags: ["session"],
        context: "LOCAL_ARTIFACT",
        executorRegistry: {
          schemaVersion: 1,
          executors: [
            secondSource,
            secondIntent,
          ],
        },
        payloadProvider: {
          payloadFor: (input) => ({
            capabilityId:
              input.capabilityId,
            artifact: "same",
          }),
        },
        resultCache: cache,
      });

    expect(second.status).toBe(
      "sufficient",
    );
    expect(
      second.executions.every(
        (item) =>
          item.status === "executed" &&
          item.reused === true,
      ),
    ).toBe(true);
    expect(
      secondSource.execute,
    ).not.toHaveBeenCalled();
    expect(
      secondIntent.execute,
    ).not.toHaveBeenCalled();
  });

  it("invalidates deterministic reuse when cached output is mutated", async () => {
    const cache =
      createInMemoryDiagnosisResultCache();

    const first =
      executor(
        "diagnosis.source-index",
        "static",
        "structural-proof",
      );

    const firstRun =
      await runProgressiveDiagnosis({
        goal: "structural-consistency",
        relevantTags: ["artifact"],
        context: "LOCAL_ARTIFACT",
        executorRegistry: {
          schemaVersion: 1,
          executors: [first],
        },
        payloadProvider: {
          payloadFor: () => ({
            artifact: "same",
          }),
        },
        resultCache: cache,
      });

    const firstOutput =
      firstRun.outputs[
        "diagnosis.source-index"
      ] as {
        executorId: string;
      };
    firstOutput.executorId =
      "mutated-after-cache";

    const second =
      executor(
        "diagnosis.source-index",
        "static",
        "structural-proof",
      );

    await runProgressiveDiagnosis({
      goal: "structural-consistency",
      relevantTags: ["artifact"],
      context: "LOCAL_ARTIFACT",
      executorRegistry: {
        schemaVersion: 1,
        executors: [second],
      },
      payloadProvider: {
        payloadFor: () => ({
          artifact: "same",
        }),
      },
      resultCache: cache,
    });

    expect(second.execute)
      .toHaveBeenCalledTimes(1);
  });

  it("invalidates deterministic reuse when executor revision changes", async () => {
    const cache =
      createInMemoryDiagnosisResultCache();

    const first =
      executor(
        "diagnosis.source-index",
        "static",
        "structural-proof",
      );

    await runProgressiveDiagnosis({
      goal: "structural-consistency",
      relevantTags: ["artifact"],
      context: "LOCAL_ARTIFACT",
      executorRegistry: {
        schemaVersion: 1,
        executors: [first],
      },
      payloadProvider: {
        payloadFor: () => ({
          artifact: "same",
        }),
      },
      resultCache: cache,
    });

    const second =
      executor(
        "diagnosis.source-index",
        "static",
        "structural-proof",
      );
    second.executorRevision =
      "diagnosis.source-index:test:2";

    await runProgressiveDiagnosis({
      goal: "structural-consistency",
      relevantTags: ["artifact"],
      context: "LOCAL_ARTIFACT",
      executorRegistry: {
        schemaVersion: 1,
        executors: [second],
      },
      payloadProvider: {
        payloadFor: () => ({
          artifact: "same",
        }),
      },
      resultCache: cache,
    });

    expect(second.execute)
      .toHaveBeenCalledTimes(1);
  });

  it("invalidates deterministic reuse when the payload changes", async () => {
    const cache =
      createInMemoryDiagnosisResultCache();
    const source =
      executor(
        "diagnosis.source-index",
        "static",
        "structural-proof",
      );

    const run = async (
      artifact: string,
    ) =>
      await runProgressiveDiagnosis({
        goal:
          "structural-consistency",
        relevantTags: ["artifact"],
        context: "LOCAL_ARTIFACT",
        executorRegistry: {
          schemaVersion: 1,
          executors: [source],
        },
        payloadProvider: {
          payloadFor: () => ({
            artifact,
          }),
        },
        resultCache: cache,
      });

    await run("a");
    await run("b");

    expect(source.execute)
      .toHaveBeenCalledTimes(2);
  });

});
}
