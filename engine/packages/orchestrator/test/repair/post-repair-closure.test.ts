// Source-preserving owner-local family consolidation at pinned GitHub revision.
// Original case/expect bodies retained in separate lexical blocks.
import { describe, expect, it } from "vitest";
import type { RepairLifecycleState } from "../../src/index.js";
import { createPostRepairClosureReceipt, evaluatePostRepairClosure } from "../../src/index.js";

// Original engine/packages/orchestrator/test/repair/post-repair-closure.test.ts; blob a7722ee6055be49413e7c5d05118a02691b2bd75
{
function lifecycle(
  complete: boolean,
): RepairLifecycleState {
  return {
    transactionId: "tx",
    stage: "static-validated",
    mutationPresent: true,
    localStaticValidationPassed: true,
    transitiveRevalidationComplete: true,
    runtimeVerificationComplete: complete,
    preservationVerificationComplete: complete,
    packageVerificationComplete: complete,
    pendingNodeIds: [],
    pendingPaths: [],
    reasons: [],
  };
}

describe("post-repair regression closure", () => {
  it("closes a repair only when the original defect is gone and all proof layers are complete", () => {
    const result = evaluatePostRepairClosure(
      lifecycle(true),
      {
        transactionId: "tx",
        scenarioId: "reconnect-counterexample",
        originalDefectReproduced: false,
        evidenceIds: ["runtime:retest:pass"],
      },
    );

    expect(result.disposition).toBe("fixed");
    expect(result.release.disposition).toBe(
      "release-eligible",
    );
  });

  it("marks repair as regression when the original counterexample still reproduces", () => {
    const result = evaluatePostRepairClosure(
      lifecycle(true),
      {
        transactionId: "tx",
        scenarioId: "reconnect-counterexample",
        originalDefectReproduced: true,
        evidenceIds: ["runtime:retest:fail"],
      },
    );

    expect(result.disposition).toBe(
      "regression",
    );
    expect(result.release.disposition).toBe(
      "blocked",
    );
  });

  it("keeps repair incomplete when defect is gone but preservation/package/runtime proof is not complete", () => {
    const result = evaluatePostRepairClosure(
      lifecycle(false),
      {
        transactionId: "tx",
        scenarioId: "reconnect-counterexample",
        originalDefectReproduced: false,
        evidenceIds: ["runtime:retest:pass"],
      },
    );

    expect(result.disposition).toBe(
      "incomplete",
    );
    expect(result.release.disposition).toBe(
      "blocked",
    );
  });

  it("rejects a receipt from another repair transaction", () => {
    expect(() =>
      evaluatePostRepairClosure(
        lifecycle(true),
        {
          transactionId: "other",
          scenarioId: "repro",
          originalDefectReproduced: false,
          evidenceIds: ["e"],
        },
      )
    ).toThrow(/another repair transaction/);
  });
});
}

// Original engine/packages/orchestrator/test/post-repair-closure-receipt.test.ts; blob 4c4c2b782ce385579b30500b4412178567a5c296
{
function lifecycle(): RepairLifecycleState {
  return {
    transactionId: "tx",
    stage: "static-validated",
    mutationPresent: true,
    localStaticValidationPassed: true,
    transitiveRevalidationComplete: true,
    runtimeVerificationComplete: true,
    preservationVerificationComplete: true,
    packageVerificationComplete: true,
    pendingNodeIds: [],
    pendingPaths: [],
    reasons: [],
  };
}

describe("post-repair closure receipt", () => {
  it("requires explicit evidence from every proof layer", () => {
    const result = evaluatePostRepairClosure(
      lifecycle(),
      {
        transactionId: "tx",
        scenarioId: "regression:arena-release",
        originalDefectReproduced: false,
        evidenceIds: ["regression:pass"],
      },
    );

    const receipt =
      createPostRepairClosureReceipt(
        result,
        {
          transitive: ["static:dependent-pass"],
          runtime: ["runtime:pass"],
          preservation: ["preservation:pass"],
          package: ["package:pass"],
        },
      );

    expect(receipt.evidenceIds).toEqual([
      "package:pass",
      "preservation:pass",
      "regression:pass",
      "runtime:pass",
      "static:dependent-pass",
    ]);
  });

  it("rejects incomplete proof-layer evidence", () => {
    const result = evaluatePostRepairClosure(
      lifecycle(),
      {
        transactionId: "tx",
        scenarioId: "regression:arena-release",
        originalDefectReproduced: false,
        evidenceIds: ["regression:pass"],
      },
    );

    expect(() =>
      createPostRepairClosureReceipt(
        result,
        {
          transitive: [],
          runtime: ["runtime:pass"],
          preservation: ["preservation:pass"],
          package: ["package:pass"],
        },
      )
    ).toThrow(/transitive evidence/i);
  });

  it("binds a complete zero-waste receipt into closure lineage", () => {
    const result = evaluatePostRepairClosure(
      lifecycle(),
      {
        transactionId: "tx",
        scenarioId: "regression:arena-release",
        originalDefectReproduced: false,
        evidenceIds: ["regression:pass"],
      },
    );

    const receipt =
      createPostRepairClosureReceipt(
        result,
        {
          transitive: ["static:dependent-pass"],
          runtime: ["runtime:pass"],
          preservation: ["preservation:pass"],
          package: ["package:pass"],
          zeroWaste: {
            schemaVersion: 1,
            transactionId: "tx",
            status: "complete",
            reusedClaimIds: ["claim:reuse"],
            recomputedClaimIds: [],
            restoredEvidenceClaimIds: [],
            skippedValidationScenarioIds: ["scenario:shop"],
            selectedValidationScenarioIds: ["scenario:arena"],
            avoidedWork: {
              proofExecutions: 1,
              validationScenarios: 1,
              totalUnits: 2,
            },
            evidenceIds: ["zero-waste:receipt"],
            dependencyViolations: [],
            executionViolations: [],
            reasons: ["complete"],
          },
        },
      );

    expect(
      receipt.zeroWasteExecution,
    ).toMatchObject({
      transactionId: "tx",
      status: "complete",
      avoidedWork: {
        totalUnits: 2,
      },
    });
    expect(receipt.evidenceIds).toContain(
      "zero-waste:receipt",
    );
  });

  it("rejects zero-waste lineage from another repair transaction", () => {
    const result = evaluatePostRepairClosure(
      lifecycle(),
      {
        transactionId: "tx",
        scenarioId: "regression:arena-release",
        originalDefectReproduced: false,
        evidenceIds: ["regression:pass"],
      },
    );

    expect(() =>
      createPostRepairClosureReceipt(
        result,
        {
          transitive: ["static:dependent-pass"],
          runtime: ["runtime:pass"],
          preservation: ["preservation:pass"],
          package: ["package:pass"],
          zeroWaste: {
            schemaVersion: 1,
            transactionId: "other",
            status: "complete",
            reusedClaimIds: [],
            recomputedClaimIds: [],
            restoredEvidenceClaimIds: [],
            skippedValidationScenarioIds: [],
            selectedValidationScenarioIds: [],
            avoidedWork: {
              proofExecutions: 0,
              validationScenarios: 0,
              totalUnits: 0,
            },
            evidenceIds: ["zero-waste:other"],
            dependencyViolations: [],
            executionViolations: [],
            reasons: ["complete"],
          },
        },
      )
    ).toThrow(/another repair transaction/i);
  });

});
}
