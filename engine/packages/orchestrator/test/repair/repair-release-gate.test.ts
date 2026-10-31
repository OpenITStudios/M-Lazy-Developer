import { describe, expect, it } from "vitest";
import {
  decideRepairPackageStaging,
  decideRepairRelease,
} from "../../src/repair/repair-release-gate.js";
import {
  markRepairPackageVerified,
  markRepairPreservationVerified,
  markRepairRuntimeVerified,
  type RepairLifecycleState,
} from "../../src/repair/repair-lifecycle.js";

function state(): RepairLifecycleState {
  return {
    transactionId: "tx-1",
    stage: "static-validated",
    mutationPresent: true,
    localStaticValidationPassed: true,
    transitiveRevalidationComplete: true,
    runtimeVerificationComplete: false,
    preservationVerificationComplete: false,
    packageVerificationComplete: false,
    pendingNodeIds: [],
    pendingPaths: [],
    reasons: [],
  };
}

describe("repair release gate", () => {
  it("allows package staging after static and transitive validation only", () => {
    expect(decideRepairPackageStaging(state()).disposition)
      .toBe("staging-eligible");
    expect(decideRepairRelease(state()).disposition)
      .toBe("blocked");
  });

  it("blocks package staging while transitive revalidation remains pending", () => {
    expect(decideRepairPackageStaging({
      ...state(),
      stage: "transitive-revalidation-pending",
      transitiveRevalidationComplete: false,
      pendingNodeIds: ["n2"],
    }).disposition).toBe("blocked");
  });

  it("requires both runtime and package proof before release", () => {
    let current = state();

    current = markRepairPackageVerified(current, {
      transactionId: "tx-1",
      kind: "package",
      passed: true,
      evidenceIds: ["package:deterministic"],
    });
    expect(decideRepairRelease(current).disposition)
      .toBe("blocked");

    current = markRepairRuntimeVerified(current, {
      transactionId: "tx-1",
      kind: "runtime",
      passed: true,
      evidenceIds: ["runtime:invariant-pass"],
    });
    expect(decideRepairRelease(current).disposition)
      .toBe("blocked");

    current = markRepairPreservationVerified(current, {
      contractId: "preserve:tx-1",
      transactionId: "tx-1",
      passed: true,
      verifiedMustChangeInvariantIds: ["inv:fixed"],
      verifiedMustPreserveInvariantIds: ["inv:healthy"],
      evidenceIds: ["preservation:pass"],
    });
    expect(decideRepairRelease(current).disposition)
      .toBe("release-eligible");
  });

  it("never treats rollback failure as packageable", () => {
    expect(decideRepairPackageStaging({
      ...state(),
      stage: "rollback-failed",
      localStaticValidationPassed: false,
      transitiveRevalidationComplete: false,
    }).disposition).toBe("blocked");
  });
});
