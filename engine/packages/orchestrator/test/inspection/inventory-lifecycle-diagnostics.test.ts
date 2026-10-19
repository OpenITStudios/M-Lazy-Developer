import { describe, expect, it } from "vitest";
import {
  inventoryLifecycleDiagnostics,
} from "../../src/inspection/inventory-lifecycle-diagnostics.js";

const lifecycle = {
  regions: 2,
  resetCandidates: 1,
  completeResets: 0,
  partialResets: 1,
  copyMutationRisks: 1,
  grantVerificationGaps: 0,
  loadoutTransactions: [],
  completeLoadoutTransactions: 0,
  unresolvedLoadoutTransactions: 0,
  grantRegions: 1,
  dropRegions: 1,
  knownEquipmentSlots: ["'Head'"],
  unresolvedEquipmentSlotEvidence: 0,
  assessments: [],
};

const restore = {
  pathways: [],
  restorePathways: 0,
  deterministicItemRestores: 0,
  unknownIdentityGrants: 0,
  multipleRestoreOwners: 1,
  initialSessionDuplicateOwners: 0,
  initialSessionOverlapUnresolved: 0,
  conflicts: [],
  crossLifecycleConflicts: [],
};

describe("inventory lifecycle diagnostics", () => {
  it("separates authored drop conflicts from lifecycle coverage gaps", () => {
    const findings =
      inventoryLifecycleDiagnostics(
        lifecycle,
        {
          configured: true,
          contractId: "items",
          resolvedItemClasses: 1,
          uncoveredItemClasses: 0,
          unknownIdentityEvidence: 0,
          dropAssessments: [],
          deniedDrops: 1,
          uncoveredDrops: 0,
          unknownDrops: 0,
        },
        restore,
      );

    expect(
      findings.map((item) => item.code),
    ).toEqual([
      "INVENTORY_POLICY_CONFLICT",
      "INVENTORY_LIFECYCLE_COVERAGE_GAP",
    ]);
    expect(findings[0]?.severity)
      .toBe("medium");
    expect(findings[1]?.severity)
      .toBe("medium");
  });

  it("does not call uncovered or dynamic drop policy a conflict", () => {
    const findings =
      inventoryLifecycleDiagnostics(
        {
          ...lifecycle,
          partialResets: 0,
          copyMutationRisks: 0,
        },
        {
          configured: true,
          contractId: "items",
          resolvedItemClasses: 0,
          uncoveredItemClasses: 1,
          unknownIdentityEvidence: 1,
          dropAssessments: [],
          deniedDrops: 0,
          uncoveredDrops: 1,
          unknownDrops: 1,
        },
        {
          ...restore,
          multipleRestoreOwners: 0,
        },
      );

    expect(
      findings.map((item) => item.code),
    ).toEqual([
      "INVENTORY_LIFECYCLE_COVERAGE_GAP",
    ]);
    expect(findings[0]?.severity)
      .toBe("minor");
  });
});
