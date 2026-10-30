// Cohesive family source consolidation. Original cases, assertions and lexical scopes retained; not executed.
import { describe } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { analyzeLootTableStructure } from "../src/loot-table.js";
import { extractEntityLootSemantics } from "../src/index.js";
import { parseEntityDefinition } from "../src/index.js";

// Original suite engine/analyzers/entities/test/loot-table.test.ts, blob 5d2ea0932d53cf17a26774e2b6822c3b0934f26d
{



describe("loot table structure", () => {
  it("preserves multiple pools and per-pool conditions", () => {
    const result = analyzeLootTableStructure({
      pools: [
        { rolls: 1, entries: [{ type: "item", name: "minecraft:apple" }] },
        {
          rolls: 1,
          conditions: [{ condition: "killed_by_player" }],
          entries: [{ type: "item", name: "minecraft:emerald" }],
        },
      ],
    });
    expect(result.poolCount).toBe(2);
    expect(result.conditional).toBe(true);
    expect(result.pools[1]).toMatchObject({ conditionCount: 1, entryCount: 1 });
  });
});

}

// Original suite engine/analyzers/entities/test/loot.test.ts, blob ac25595e90e2caead4f3ca2642fe437ef156855e
{



describe("entity loot semantics", () => {
  it("extracts minecraft:loot tables from entity states", () => {
    const entity = parseEntityDefinition(
      {
        format_version: "1.21.0",
        "minecraft:entity": {
          description: {
            identifier: "demo:zombie",
          },
          components: {
            "minecraft:loot": {
              table:
                "loot_tables/entities/zombie.json",
            },
          },
        },
      },
      {
        artifactId: "fixture",
        relativePath:
          "entities/zombie.json",
      },
    );

    const result =
      extractEntityLootSemantics(entity);

    expect(result).toMatchObject({
      entityKey: "demo:zombie",
      configuredStates: 1,
      lootTables: [
        "loot_tables/entities/zombie.json",
      ],
    });
  });
});

}
