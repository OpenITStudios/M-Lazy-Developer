import { describe, expect, it } from "vitest";
import type {
  RepairLifecycleState,
} from "../src/index.js";
import {
  createPostRepairClosureReceipt,
  evaluatePostRepairClosure,
} from "../src/index.js";

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
