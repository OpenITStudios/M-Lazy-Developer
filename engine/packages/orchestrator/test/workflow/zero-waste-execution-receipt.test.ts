// Consolidated same-owner development family, original lexical bodies preserved.
import { describe, expect, it } from "vitest";
import type { ZeroWasteWorkflowPlan } from "../../src/workflow/zero-waste-workflow.js";
import { createZeroWasteExecutionReceipt } from "../../src/workflow/zero-waste-execution-receipt.js";
import { summarizeZeroWasteExecution, zeroWasteExecutionSummaryText } from "../../src/workflow/zero-waste-execution-summary.js";
import type { ProgressiveDiagnosisRunResult } from "../../../diagnosis-pipeline/src/index.js";
import type { GameplayIntentModel } from "../../../gameplay-intent/src/index.js";
import { SemanticGraph } from "../../../graph/src/index.js";
import type { PatchTransaction } from "../../../repair/src/index.js";
import { createSemanticProofClaim, prepareZeroWasteWorkflow, zeroWasteWorkflowPlanText } from "../../src/index.js";

// Source engine/packages/orchestrator/test/workflow/zero-waste-execution-receipt.test.ts; blob a13c6105aad2bc59eb42fb544f0322c601d6c173
{
const plan: ZeroWasteWorkflowPlan = {
  transactionId: "tx",
  impactAuthority: "post-patch",
  status: "ready",
  affected: {
    status: "planned",
    changedNodeIds: [],
    affectedNodeIds: [],
    skippedNodeIds: [],
    affectedPaths: [],
    knownPaths: [],
    totalNodeCount: 0,
    changedNodeCount: 0,
    affectedNodeCount: 0,
    skippedNodeCount: 0,
    skipRatio: 0,
    reasons: [],
  },
  context: {
    schemaVersion: 1,
    goal: "test",
    semantic: { nodes: [], edges: [], omitted: 0, omittedEdges: 0 },
    intent: { nodes: [], invariants: [], unknowns: [], evidence: [] },
    budget: {
      maxSemanticNodes: 0,
      maxSemanticEdges: 0,
      maxIntentNodes: 0,
      maxInvariants: 0,
      maxUnknowns: 0,
      maxEvidence: 0,
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
  validation: {
    status: "planned",
    selected: [{
      scenarioId: "scenario:a",
      title: "A",
      reason: "always-run",
      detail: "required",
    }],
    skipped: [{
      scenarioId: "scenario:b",
      title: "B",
      reason: "outside-affected-closure",
      detail: "unaffected",
    }],
    totalScenarioCount: 2,
    selectedScenarioCount: 1,
    skippedScenarioCount: 1,
    skipRatio: 0.5,
    affectedNodeCount: 0,
    affectedPathCount: 0,
    reasons: [],
    errors: [],
  },
  proofReuse: [],
  reusableProofClaimIds: ["claim:a"],
  staleProofClaimIds: ["claim:b"],
  blockedProofClaimIds: [],
  proofActions: [
    {
      claimId: "claim:a",
      action: "reuse",
      dependsOnClaimIds: [],
      reasons: [],
    },
    {
      claimId: "claim:b",
      action: "recompute",
      dependsOnClaimIds: [],
      reasons: [],
    },
  ],
  reasons: [],
};

describe("zero-waste execution receipt", () => {
  it("records completed proof routing and validation selection", () => {
    const receipt = createZeroWasteExecutionReceipt(
      plan,
      [
        {
          claimId: "claim:a",
          action: "reuse",
          completed: true,
          evidenceIds: ["e:a"],
        },
        {
          claimId: "claim:b",
          action: "recompute",
          completed: true,
          evidenceIds: ["e:b"],
        },
      ],
      [{
        scenarioId: "scenario:a",
        completed: true,
        evidenceIds: ["validation:a"],
      }],
    );

    expect(receipt.status).toBe("complete");
    expect(receipt.skippedValidationScenarioIds).toEqual([
      "scenario:b",
    ]);
    expect(receipt.evidenceIds).toEqual([
      "e:a",
      "e:b",
      "validation:a",
    ]);
    expect(receipt.avoidedWork).toEqual({
      proofExecutions: 1,
      validationScenarios: 1,
      totalUnits: 2,
    });
    expect(receipt.dependencyViolations).toEqual([]);
  });

  it("rejects outcomes that violate proof dependency order", () => {
    const dependentPlan: ZeroWasteWorkflowPlan = {
      ...plan,
      proofActions: [
        {
          claimId: "claim:dependency",
          action: "recompute",
          dependsOnClaimIds: [],
          reasons: [],
        },
        {
          claimId: "claim:consumer",
          action: "recompute",
          dependsOnClaimIds: ["claim:dependency"],
          reasons: [],
        },
      ],
      reusableProofClaimIds: [],
      staleProofClaimIds: [
        "claim:dependency",
        "claim:consumer",
      ],
    };

    const receipt = createZeroWasteExecutionReceipt(
      dependentPlan,
      [
        {
          claimId: "claim:consumer",
          action: "recompute",
          completed: true,
          evidenceIds: ["e:consumer"],
        },
        {
          claimId: "claim:dependency",
          action: "recompute",
          completed: true,
          evidenceIds: ["e:dependency"],
        },
      ],
      [{
        scenarioId: "scenario:a",
        completed: true,
        evidenceIds: ["validation:a"],
      }],
    );

    expect(receipt.status).toBe("incomplete");
    expect(receipt.dependencyViolations.join(" ")).toMatch(
      /before dependency/i,
    );
  });

  it("marks the receipt incomplete when selected validation has not executed", () => {
    const receipt =
      createZeroWasteExecutionReceipt(
        plan,
        [
          {
            claimId: "claim:a",
            action: "reuse",
            completed: true,
            evidenceIds: ["e:a"],
          },
          {
            claimId: "claim:b",
            action: "recompute",
            completed: true,
            evidenceIds: ["e:b"],
          },
        ],
        [],
      );

    expect(receipt.status).toBe(
      "incomplete",
    );
    expect(
      receipt.reasons.join(" "),
    ).toMatch(
      /selected validation scenarios are incomplete/i,
    );
  });

});
}

// Source engine/packages/orchestrator/test/workflow/zero-waste-execution-summary.test.ts; blob adf4c34a647189f7504effdcb2ae8365eef9285c
{
describe("zero-waste execution summary", () => {
  it("reports reuse and skip ratios without changing execution authority", () => {
    const diagnosis = {
      status: "sufficient",
      goal: "semantic-consistency",
      finalPlan: {
        goal:
          "semantic-consistency",
        requiredEvidenceLevel:
          "semantic",
        requiredEvidenceTraits: [
          "semantic-model",
        ],
        currentEvidenceLevel:
          "semantic",
        missingEvidenceTraits: [],
        disposition:
          "stop-sufficient",
        steps: [],
        skippedCapabilityIds: [],
        reasons: [],
      },
      completedCapabilityIds: [],
      evidence: [],
      outputs: {},
      executions: [
        {
          status: "executed",
          capabilityId: "a",
          executorId: "a",
          evidence: [],
          output: {},
          reasons: [],
          reused: false,
        },
        {
          status: "executed",
          capabilityId: "b",
          executorId: "b",
          evidence: [],
          output: {},
          reasons: [],
          reused: true,
        },
      ],
      reasons: [],
    } satisfies ProgressiveDiagnosisRunResult;

    const summary =
      summarizeZeroWasteExecution(
        diagnosis,
        {
          status: "planned",
          changedNodeIds: ["n1"],
          affectedNodeIds: ["n1"],
          skippedNodeIds: [
            "n2",
            "n3",
          ],
          affectedPaths: ["a.ts"],
          knownPaths: [
            "a.ts",
            "b.ts",
            "c.ts",
          ],
          totalNodeCount: 3,
          changedNodeCount: 1,
          affectedNodeCount: 1,
          skippedNodeCount: 2,
          skipRatio: 2 / 3,
          reasons: [],
        },
        {
          status: "planned",
          selected: [],
          skipped: [],
          totalScenarioCount: 4,
          selectedScenarioCount: 1,
          skippedScenarioCount: 3,
          skipRatio: 0.75,
          affectedNodeCount: 1,
          affectedPathCount: 1,
          reasons: [],
          errors: [],
        },
      );

    expect(
      summary.diagnosis.reusedSteps,
    ).toBe(1);
    expect(
      summary.semanticImpact
        ?.skippedNodes,
    ).toBe(2);
    expect(
      summary.validation
        ?.skippedScenarios,
    ).toBe(3);

    const text =
      zeroWasteExecutionSummaryText(
        summary,
      );
    expect(text)
      .toContain("reuse ratio: 50.0%");
    expect(text)
      .toContain("skip ratio: 75.0%");
  });
});
}

// Source engine/packages/orchestrator/test/workflow/zero-waste-workflow.test.ts; blob 39cc1471a00e37d6d8893daa43194b8b0084e38c
{
function graphFixture() {
  const graph =
    new SemanticGraph();

  for (const id of [
    "arena",
    "shop",
  ]) {
    graph.addNode({
      id: "function:pack:" + id,
      identity: {
        kind: "function",
        scope: "pack",
        identifier: id,
      },
      kind: "function",
      identifier: id,
      source: {
        artifactId: "map",
        relativePath:
          "functions/" +
          id +
          ".mcfunction",
      },
      contentHash:
        id + "-v1",
    });
  }

  return graph;
}

const intent: GameplayIntentModel = {
  schemaVersion: 1,
  id: "intent",
  evidence: [],
  nodes: [],
  edges: [],
  invariants: [],
  unknowns: [],
};

const transaction:
  PatchTransaction = {
  id: "patch",
  title: "arena fix",
  sourceFingerprint: "fp",
  authorization: {
    schemaVersion: 1,
    authorized: true,
    sourceFingerprint: "fp",
    diagnosisEvidenceIds: ["e:authorization"],
    invariantIds: ["inv:arena"],
    evidenceFreshness: "fresh",
  },
  operations: [{
    kind: "replace-command",
    source: {
      artifactId: "map",
      relativePath:
        "functions/arena.mcfunction",
    },
    expected: "old",
    replacement: "new",
  }],
  preconditions: [],
  validation: [],
  affectedPaths: [
    "functions/arena.mcfunction",
  ],
};

describe("zero-waste workflow facade", () => {
  it("composes impact, selective validation, context, and proof reuse without duplicating their authority", () => {
    const graph =
      graphFixture();
    const shopProof =
      createSemanticProofClaim({
        claimId: "claim:shop",
        claimRevision: "1",
        kind: "static",
        graph,
        basisNodeIds: [
          "function:pack:shop",
        ],
        evidenceIds: ["e:shop"],
      });

    const plan =
      prepareZeroWasteWorkflow({
        goal: "repair arena",
        graph,
        postPatchGraph: graph,
        intent,
        transaction,
        validationScenarios: [{
          schemaVersion: 1,
          id: "scenario:arena",
          revision: "1",
          title: "arena",
          intentInvariantIds: [],
          steps: [{
            kind: "rebuild-graph",
          }],
          requiredProofLevel:
            "STATIC VERIFIED",
        }, {
          schemaVersion: 1,
          id: "scenario:shop",
          revision: "1",
          title: "shop",
          intentInvariantIds: [],
          steps: [{
            kind: "rebuild-graph",
          }],
          requiredProofLevel:
            "STATIC VERIFIED",
        }],
        validationBindings: [{
          scenarioId:
            "scenario:arena",
          semanticNodeIds: [
            "function:pack:arena",
          ],
        }, {
          scenarioId:
            "scenario:shop",
          semanticNodeIds: [
            "function:pack:shop",
          ],
        }],
        proofClaims: [{
          claim: shopProof,
          claimRevision: "1",
          availableEvidenceIds: [
            "e:shop",
          ],
        }],
      });

    expect(plan.status)
      .toBe("ready");
    expect(
      plan.validation
        .selectedScenarioCount,
    ).toBe(1);
    expect(
      plan.validation
        .skippedScenarioCount,
    ).toBe(1);
    expect(
      plan.reusableProofClaimIds,
    ).toEqual([
      "claim:shop",
    ]);

    const text =
      zeroWasteWorkflowPlanText(
        plan,
      );
    expect(text)
      .toContain("Status: ready");
    expect(text)
      .toContain("- reusable: 1");
  });

  it("retains changed semantic nodes as required context even when optional context is budget-limited", () => {
    const graph =
      graphFixture();

    const plan =
      prepareZeroWasteWorkflow({
        goal: "repair arena",
        graph,
        postPatchGraph: graph,
        intent,
        transaction,
        validationScenarios: [],
        validationBindings: [],
        contextBudget: {
          maxSemanticNodes: 1,
        },
      });

    expect(plan.context.complete)
      .toBe(true);
    expect(
      plan.context.semantic.nodes.map(
        (node) => node.id,
      ),
    ).toContain(
      "function:pack:arena",
    );
  });

  it("rejects runtime proof reuse across arena generations", () => {
    const graph = graphFixture();
    const runtimeProof =
      createSemanticProofClaim({
        claimId: "claim:arena:g4",
        claimRevision: "1",
        kind: "runtime",
        graph,
        basisNodeIds: ["function:pack:arena"],
        evidenceIds: ["runtime:arena:g4"],
        targetProfileFingerprint: "runtime-a",
        runtimeScope: {
          arenaId: "arena-2",
          arenaGeneration: 4,
        },
      });

    const plan = prepareZeroWasteWorkflow({
      goal: "repair arena",
      graph,
      postPatchGraph: graph,
      intent,
      transaction,
      validationScenarios: [],
      validationBindings: [],
      proofClaims: [{
        claim: runtimeProof,
        claimRevision: "1",
        availableEvidenceIds: ["runtime:arena:g4"],
        targetProfileFingerprint: "runtime-a",
        runtimeScope: {
          arenaId: "arena-2",
          arenaGeneration: 5,
        },
      }],
    });

    expect(plan.staleProofClaimIds).toEqual([
      "claim:arena:g4",
    ]);
    expect(plan.reusableProofClaimIds).toEqual([]);
    expect(plan.proofActions).toEqual([
      expect.objectContaining({
        claimId: "claim:arena:g4",
        action: "recompute",
      }),
    ]);
  });

  it("rejects explicitly stale evidence from zero-waste reuse", () => {
    const graph = graphFixture();
    const proof =
      createSemanticProofClaim({
        claimId: "claim:arena:stale",
        claimRevision: "1",
        kind: "static",
        graph,
        basisNodeIds: ["function:pack:arena"],
        evidenceIds: ["e:arena:old"],
      });

    const plan = prepareZeroWasteWorkflow({
      goal: "repair arena",
      graph,
      postPatchGraph: graph,
      intent,
      transaction,
      validationScenarios: [],
      validationBindings: [],
      proofClaims: [{
        claim: proof,
        claimRevision: "1",
        availableEvidenceIds: ["e:arena:old"],
        staleEvidenceIds: ["e:arena:old"],
      }],
    });

    expect(plan.staleProofClaimIds).toEqual([
      "claim:arena:stale",
    ]);
  });

  it("orders dependent proof actions before their consumers", () => {
    const graph = graphFixture();
    const dependency =
      createSemanticProofClaim({
        claimId: "claim:dependency",
        claimRevision: "1",
        kind: "static",
        graph,
        basisNodeIds: ["function:pack:shop"],
        evidenceIds: ["e:dependency"],
      });
    const consumer =
      createSemanticProofClaim({
        claimId: "claim:consumer",
        claimRevision: "1",
        kind: "static",
        graph,
        basisNodeIds: ["function:pack:arena"],
        evidenceIds: ["e:consumer"],
      });

    const plan = prepareZeroWasteWorkflow({
      goal: "repair arena",
      graph,
      postPatchGraph: graph,
      intent,
      transaction,
      validationScenarios: [],
      validationBindings: [],
      proofClaims: [{
        claim: consumer,
        claimRevision: "2",
        availableEvidenceIds: ["e:consumer"],
        dependsOnClaimIds: ["claim:dependency"],
      }, {
        claim: dependency,
        claimRevision: "2",
        availableEvidenceIds: ["e:dependency"],
      }],
    });

    expect(plan.proofActions.map((item) => item.claimId)).toEqual([
      "claim:dependency",
      "claim:consumer",
    ]);
    expect(plan.status).toBe("ready");
  });

  it("blocks zero-waste routing when a proof dependency is missing", () => {
    const graph = graphFixture();
    const proof =
      createSemanticProofClaim({
        claimId: "claim:consumer",
        claimRevision: "1",
        kind: "static",
        graph,
        basisNodeIds: ["function:pack:arena"],
        evidenceIds: ["e:consumer"],
      });

    const plan = prepareZeroWasteWorkflow({
      goal: "repair arena",
      graph,
      postPatchGraph: graph,
      intent,
      transaction,
      validationScenarios: [],
      validationBindings: [],
      proofClaims: [{
        claim: proof,
        claimRevision: "2",
        availableEvidenceIds: ["e:consumer"],
        dependsOnClaimIds: ["claim:missing"],
      }],
    });

    expect(plan.status).toBe("blocked");
    expect(plan.reasons.join(" ")).toMatch(/unknown claim/i);
  });

  it("falls back to conservative validation and blocks proof reuse without a post-patch graph", () => {
    const graph =
      graphFixture();
    const shopProof =
      createSemanticProofClaim({
        claimId:
          "claim:shop:no-post",
        claimRevision: "1",
        kind: "static",
        graph,
        basisNodeIds: [
          "function:pack:shop",
        ],
        evidenceIds: [
          "e:shop",
        ],
      });

    const plan =
      prepareZeroWasteWorkflow({
        goal: "pre-patch only",
        graph,
        intent,
        transaction,
        validationScenarios: [{
          schemaVersion: 1,
          id: "scenario:shop",
          revision: "1",
          title: "shop",
          intentInvariantIds: [],
          steps: [{
            kind: "rebuild-graph",
          }],
          requiredProofLevel:
            "STATIC VERIFIED",
        }],
        validationBindings: [{
          scenarioId:
            "scenario:shop",
          semanticNodeIds: [
            "function:pack:shop",
          ],
        }],
        proofClaims: [{
          claim: shopProof,
          claimRevision: "1",
          availableEvidenceIds: [
            "e:shop",
          ],
        }],
      });

    expect(
      plan.impactAuthority,
    ).toBe(
      "pre-patch-conservative",
    );
    expect(
      plan.validation
        .selectedScenarioCount,
    ).toBe(1);
    expect(
      plan.validation
        .skippedScenarioCount,
    ).toBe(0);
    expect(
      plan.blockedProofClaimIds,
    ).toEqual([
      "claim:shop:no-post",
    ]);
  });

  it("does not report ready when the bounded context is incomplete", () => {
    const plan =
      prepareZeroWasteWorkflow({
        goal: "repair arena",
        graph: graphFixture(),
        postPatchGraph:
          graphFixture(),
        intent: {
          ...intent,
          nodes: [{
            id: "intent:arena",
            kind: "mechanic",
            label: "Arena",
            status: "authored",
            evidenceIds: [],
          }, {
            id: "intent:shop",
            kind: "mechanic",
            label: "Shop",
            status: "authored",
            evidenceIds: [],
          }],
        },
        transaction,
        validationScenarios: [],
        validationBindings: [],
        contextBudget: {
          maxIntentNodes: 1,
        },
      });

    expect(plan.status)
      .toBe(
        "needs-context-expansion",
      );
    expect(plan.context.complete)
      .toBe(false);
  });
});
}
