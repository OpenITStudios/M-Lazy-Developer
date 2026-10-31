// Same-directory feature suite, retaining original lexical test bodies.
import { describe, expect, it } from "vitest";
import { parseInventoryItemBehaviorContract } from "../../src/inspection/inventory-contract-load.js";
import { parseScriptFile } from "../../../../analyzers/scripts/src/index.js";
import { analyzeInventoryContract } from "../../src/inspection/inventory-contract-analysis.js";
import { analyzeInventoryLifecycle } from "../../src/inspection/inventory-lifecycle-analysis.js";
import { inventoryLifecycleDiagnostics } from "../../src/inspection/inventory-lifecycle-diagnostics.js";

// Original engine/packages/orchestrator/test/inspection/inventory-contract-analysis.test.ts; blob a52f2f71ad3988265381fb5df1ccfb2a88e440f1
{
// Source-preserving family consolidation: original suites and assertions retained in separate lexical scopes.

// Original suite engine/packages/orchestrator/test/inspection/inventory-contract-load.test.ts, blob 61a1c756973a8b177cf36ae96b4cc23ff3500c45
{



describe("inventory item contract parser", () => {
  it("parses explicit ownership, drop, reset, and restore rules", () => {
    expect(
      parseInventoryItemBehaviorContract({
        schemaVersion: 1,
        id: "arena-items",
        rules: [
          {
            id: "upgrade-sword",
            itemClass: "minecraft:diamond_sword",
            ownershipScope: "round",
            dropAllowed: false,
            resetOn: ["round-end", "arena-end"],
            restoreOn: ["respawn"],
          },
        ],
      }),
    ).toEqual({
      schemaVersion: 1,
      id: "arena-items",
      rules: [
        {
          id: "upgrade-sword",
          itemClass: "minecraft:diamond_sword",
          ownershipScope: "round",
          dropAllowed: false,
          resetOn: ["round-end", "arena-end"],
          restoreOn: ["respawn"],
        },
      ],
    });
  });

  it("rejects invalid transitions instead of accepting typos", () => {
    expect(() =>
      parseInventoryItemBehaviorContract({
        schemaVersion: 1,
        id: "invalid",
        rules: [
          {
            id: "bad",
            itemClass: "minecraft:stone",
            ownershipScope: "round",
            dropAllowed: false,
            resetOn: ["round_end"],
          },
        ],
      }),
    ).toThrow(/invalid resetOn transition/);
  });

  it("rejects durable items with automatic reset transitions", () => {
    expect(() =>
      parseInventoryItemBehaviorContract({
        schemaVersion: 1,
        id: "invalid-durable",
        rules: [
          {
            id: "durable",
            itemClass: "minecraft:clock",
            ownershipScope: "player-durable",
            dropAllowed: true,
            resetOn: ["round-end"],
          },
        ],
      }),
    ).toThrow(/Player-durable item contract rule/);
  });
});

}

// Original suite engine/packages/orchestrator/test/inspection/inventory-contract-analysis.test.ts, blob c20f56f9b60fccf0dc81acfe4bb9c988b9518065
{




describe("inventory contract analysis", () => {
  it("binds deterministic item drop evidence to authored deny contract", () => {
    const script = parseScriptFile(
      "main",
      [
        "function drop(dimension, location) {",
        "  const sword = new ItemStack('minecraft:diamond_sword');",
        "  dimension.dropItem(sword, location);",
        "}",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result = analyzeInventoryContract(
      [script],
      {
        schemaVersion: 1,
        id: "contract",
        rules: [
          {
            id: "sword",
            itemClass: "minecraft:diamond_sword",
            ownershipScope: "round",
            dropAllowed: false,
            resetOn: ["round-end"],
          },
        ],
      },
    );

    expect(result.deniedDrops).toBe(1);
    expect(result.dropAssessments[0]).toMatchObject({
      itemIdentifier: "minecraft:diamond_sword",
      status: "denied",
      matchedRuleIds: ["sword"],
    });
  });

  it("keeps dynamic drop identity unknown rather than guessing", () => {
    const script = parseScriptFile(
      "main",
      [
        "function drop(dimension, item, location) {",
        "  dimension.dropItem(item, location);",
        "}",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result = analyzeInventoryContract(
      [script],
      {
        schemaVersion: 1,
        id: "contract",
        rules: [],
      },
    );

    expect(result.unknownDrops).toBe(1);
    expect(result.deniedDrops).toBe(0);
  });

  it("does not treat world spawnItem as player-drop contract evidence", () => {
    const script = parseScriptFile(
      "main",
      [
        "function reward(dimension, location) {",
        "  const sword = new ItemStack('minecraft:diamond_sword');",
        "  dimension.spawnItem(sword, location);",
        "}",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result = analyzeInventoryContract(
      [script],
      {
        schemaVersion: 1,
        id: "contract",
        rules: [
          {
            id: "sword",
            itemClass: "minecraft:diamond_sword",
            ownershipScope: "round",
            dropAllowed: false,
            resetOn: ["round-end"],
          },
        ],
      },
    );

    expect(result.dropAssessments).toEqual([]);
    expect(result.deniedDrops).toBe(0);
  });
});

}
}

// Original engine/packages/orchestrator/test/inspection/inventory-lifecycle-analysis.test.ts; blob aed1a1f2a9c728ac50bee99373e020ce9cd70b5e
{
// Source-preserving family consolidation: original suites and assertions retained in separate lexical scopes.

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
}
