import {
  describe,
  expect,
  it,
} from "vitest";
import type {
  ConstraintProblem,
} from "../../logic-solver/src/index.js";
import {
  createContradictionProofDiagnosisExecutor,
  executePlannedDiagnosisStep,
} from "../src/index.js";
import {
  planMinimumSufficientAnalysis,
} from "../../analysis-planner/src/index.js";
import {
  DIAGNOSIS_ANALYSIS_CAPABILITY_REGISTRY,
} from "../src/profile.js";

function violatingProblem():
  ConstraintProblem {
  return {
    id: "problem:ready",
    model: {
      schemaVersion: 1,
      id: "model:ready",
      variables: [{
        id: "ready",
        scope: "world",
        valueType: "boolean",
        authority: "script",
      }],
      transitions: [{
        id: "break-ready",
        owner: "script",
        preconditions: [],
        effects: [{
          kind: "set",
          variableId: "ready",
          value: false,
        }],
      }],
      properties: [],
    },
    initialState: {
      schemaVersion: 1,
      tick: 0,
      values: {
        ready: true,
      },
    },
    query: {
      id: "inv:ready",
      kind: "invariant",
      predicate: {
        kind: "condition",
        condition: {
          variableId: "ready",
          operator: "eq",
          value: true,
        },
      },
    },
    budget: {
      maxDepth: 2,
      maxStates: 10,
    },
  };
}

function contradictionPlan() {
  return planMinimumSufficientAnalysis({
    goal: "contradiction-proof",
    relevantTags: ["state"],
    context: "LOCAL_ARTIFACT",
    availableEvidence: [{
      level: "semantic",
      evidenceIds: ["intent:e1"],
      quality: "usable",
      traits: [
        "semantic-model",
        "intent-grounded",
      ],
    }],
    completedCapabilityIds: [
      "diagnosis.source-index",
      "diagnosis.semantic-ir",
      "diagnosis.intent-grounding",
    ],
    capabilities:
      DIAGNOSIS_ANALYSIS_CAPABILITY_REGISTRY
        .capabilities,
  });
}

describe("contradiction proof diagnosis executor", () => {
  it("promotes only an explicit invariant counterexample into contradiction evidence", async () => {
    const plan =
      contradictionPlan();

    expect(
      plan.steps[0]?.capabilityId,
    ).toBe(
      "diagnosis.contradiction-proof",
    );

    const result =
      await executePlannedDiagnosisStep({
        plan,
        context: "LOCAL_ARTIFACT",
        payload: {
          problem:
            violatingProblem(),
        },
        registry: {
          schemaVersion: 1,
          executors: [
            createContradictionProofDiagnosisExecutor(),
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
        level: "formal",
        quality: "usable",
        traits: ["contradiction"],
      });
    expect(
      result.evidence[0]
        ?.evidenceIds[0],
    ).toMatch(
      /^contradiction-proof:[a-f0-9]{64}$/,
    );
  });

  it("does not manufacture contradiction evidence when invariant is proved", async () => {
    const problem =
      violatingProblem();

    const safeProblem: ConstraintProblem = {
      ...problem,
      model: {
        ...problem.model,
        transitions: [],
      },
    };

    const result =
      await executePlannedDiagnosisStep({
        plan: contradictionPlan(),
        context: "LOCAL_ARTIFACT",
        payload: {
          problem: safeProblem,
        },
        registry: {
          schemaVersion: 1,
          executors: [
            createContradictionProofDiagnosisExecutor(),
          ],
        },
      });

    expect(result.status).toBe(
      "blocked",
    );
    expect(result.reasons.join(" "))
      .toMatch(/no contradiction/i);
  });

  it("rejects non-invariant problems instead of reinterpreting them", async () => {
    const problem =
      violatingProblem();

    const result =
      await executePlannedDiagnosisStep({
        plan: contradictionPlan(),
        context: "LOCAL_ARTIFACT",
        payload: {
          problem: {
            ...problem,
            query: {
              id: "reach",
              kind: "reachability",
              target: {
                kind: "condition",
                condition: {
                  variableId: "ready",
                  operator: "eq",
                  value: false,
                },
              },
            },
          },
        },
        registry: {
          schemaVersion: 1,
          executors: [
            createContradictionProofDiagnosisExecutor(),
          ],
        },
      });

    expect(result.status).toBe(
      "blocked",
    );
    expect(result.reasons.join(" "))
      .toMatch(/only an explicit invariant/);
  });
});
