// Source-preserving family consolidation: original suites and assertions retained in separate lexical scopes.
import { describe } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { parseInventoryItemBehaviorContract } from "../../src/inspection/inventory-contract-load.js";
import { parseScriptFile } from "../../../../analyzers/scripts/src/index.js";
import { analyzeInventoryContract } from "../../src/inspection/inventory-contract-analysis.js";

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
