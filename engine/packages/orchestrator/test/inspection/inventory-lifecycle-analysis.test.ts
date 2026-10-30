// Source-preserving family consolidation: original suites and assertions retained in separate lexical scopes.
import { describe } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { parseScriptFile } from "../../../../analyzers/scripts/src/index.js";
import { analyzeInventoryLifecycle } from "../../src/inspection/inventory-lifecycle-analysis.js";
import { inventoryLifecycleDiagnostics } from "../../src/inspection/inventory-lifecycle-diagnostics.js";

// Original suite engine/packages/orchestrator/test/inspection/inventory-lifecycle-analysis.test.ts, blob 565215758656e2a31856eb5e7dfee679f31c90be
{




describe("inventory lifecycle analysis", () => {
  it("accepts inventory-only reset when the map has no equipment surface", () => {
    const script = parseScriptFile(
      "main",
      [
        "function reset(container) {",
        "  container.clearAll();",
        "}",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzeInventoryLifecycle([script]);

    expect(result).toMatchObject({
      resetCandidates: 1,
      completeResets: 1,
      partialResets: 0,
      copyMutationRisks: 0,
      knownEquipmentSlots: [],
    });
  });

  it("marks inventory and equipment reset in the same region as complete", () => {
    const script = parseScriptFile(
      "main",
      [
        "function reset(container, equippable) {",
        "  container.clearAll();",
        "  equippable.setEquipment('Head', undefined);",
        "}",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzeInventoryLifecycle([script]);

    expect(result.assessments[0]).toMatchObject({
      executionRegion: "function:reset",
      status: "complete-reset",
      inventoryClear: true,
      equipmentClear: true,
    });
  });

  it("keeps equipment reset partial when authored equipment slots are not all cleared", () => {
    const script = parseScriptFile(
      "main",
      [
        "function equip(equippable, head, offhand) {",
        "  equippable.setEquipment('Head', head);",
        "  equippable.setEquipment('Offhand', offhand);",
        "}",
        "function reset(container, equippable) {",
        "  container.clearAll();",
        "  equippable.setEquipment('Head', undefined);",
        "}",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzeInventoryLifecycle([script]);
    const reset = result.assessments.find(
      (item) =>
        item.executionRegion ===
        "function:reset",
    );

    expect(result.knownEquipmentSlots).toEqual([
      "'Head'",
      "'Offhand'",
    ]);
    expect(reset).toMatchObject({
      status: "partial-reset",
      equipmentCoverageComplete: false,
      clearedEquipmentSlots: ["'Head'"],
    });
  });

  it("proves a complete authored loadout transaction", () => {
    const script = parseScriptFile(
      "main",
      [
        "type LoadoutState = 'SNAPSHOT' | 'PLAN' | 'CLEAR_OR_REPLACE' | 'APPLY' | 'VERIFY' | 'COMMIT';",
        "const loadoutTransitions: Record<LoadoutState, readonly LoadoutState[]> = {",
        "  SNAPSHOT: ['PLAN'],",
        "  PLAN: ['CLEAR_OR_REPLACE'],",
        "  CLEAR_OR_REPLACE: ['APPLY'],",
        "  APPLY: ['VERIFY'],",
        "  VERIFY: ['COMMIT'],",
        "  COMMIT: [],",
        "};",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzeInventoryLifecycle([script]);

    expect(
      result.completeLoadoutTransactions,
    ).toBe(1);
    expect(
      result.unresolvedLoadoutTransactions,
    ).toBe(0);
  });

  it("keeps loadout commit unresolved when clear or verify is skipped", () => {
    const script = parseScriptFile(
      "main",
      [
        "type KitState = 'SNAPSHOT' | 'PLAN' | 'APPLY' | 'COMMIT';",
        "const kitTransitions: Record<KitState, readonly KitState[]> = {",
        "  SNAPSHOT: ['PLAN'],",
        "  PLAN: ['APPLY'],",
        "  APPLY: ['COMMIT'],",
        "  COMMIT: [],",
        "};",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzeInventoryLifecycle([script]);

    expect(
      result.unresolvedLoadoutTransactions,
    ).toBe(1);
    expect(
      result.loadoutTransactions[0]
        ?.missingPhases,
    ).toEqual(
      expect.arrayContaining([
        "clearorreplace",
        "verify",
      ]),
    );
  });

  it("flags a mutated ItemStack copy without writeback", () => {
    const script = parseScriptFile(
      "main",
      [
        "function damage(container) {",
        "  const item = container.getItem(0);",
        "  if (!item) return;",
        "  item.nameTag = 'Changed';",
        "}",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzeInventoryLifecycle([script]);

    expect(result.copyMutationRisks).toBe(1);
    expect(
      result.assessments[0]?.copyMutations[0],
    ).toMatchObject({
      itemBinding: "item",
      status: "missing-writeback",
    });
  });
  it("does not treat inventory-only reset as complete when Creative access can mutate equipment", () => {
    const script = parseScriptFile(
      "main",
      [
        "function reset(container) {",
        "  container.clearAll();",
        "}",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const normal = analyzeInventoryLifecycle([script]);
    const creative = analyzeInventoryLifecycle(
      [script],
      { requiresFullEquipmentReset: true },
    );

    expect(normal.completeResets).toBe(1);
    expect(creative.completeResets).toBe(0);
    expect(creative.partialResets).toBe(1);
    expect(creative.knownEquipmentSlots).toEqual(
      expect.arrayContaining([
        "Head",
        "Chest",
        "Legs",
        "Feet",
        "Offhand",
      ]),
    );
  });

  it("keeps addItem success unresolved until the remainder/result is checked", () => {
    const script = parseScriptFile(
      "main",
      [
        "function unchecked(container, item) {",
        "  container.addItem(item);",
        "}",
        "function checked(container, item) {",
        "  const remainder = container.addItem(item);",
        "  if (remainder) return false;",
        "  return true;",
        "}",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzeInventoryLifecycle([script]);

    expect(result.grantVerificationGaps)
      .toBe(1);
    expect(
      result.assessments.find(
        (item) =>
          item.executionRegion ===
          "function:unchecked",
      ),
    ).toMatchObject({
      itemGrants: 1,
      unverifiedItemGrants: 1,
      checkedItemGrants: 0,
    });
    expect(
      result.assessments.find(
        (item) =>
          item.executionRegion ===
          "function:checked",
      ),
    ).toMatchObject({
      itemGrants: 1,
      unverifiedItemGrants: 0,
      checkedItemGrants: 1,
    });
  });
});

}

// Original suite engine/packages/orchestrator/test/inspection/inventory-lifecycle-diagnostics.test.ts, blob 63e3129a6e124d8695868e616d528d0590a05913
{



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

}
