import { describe, expect, it } from "vitest";
import { SemanticGraph, type SemanticNode } from "../../../packages/graph/src/index.js";
import { populateOwnedEconomyReferences } from "../src/populate-owned-economy-references.js";

const artifactId = "art_frozen";
function node(id: string, kind: SemanticNode["kind"], path: string, data: unknown): SemanticNode {
  return {
    id,
    identity: { kind, scope: "project", identifier: id },
    kind, identifier: id,
    source: { artifactId, relativePath: path }, data,
  };
}

describe("owned item, loot-table and recipe source references", () => {
  it("resolves same-pack nested loot tables and preserves missing references as source-only gaps", () => {
    const graph = new SemanticGraph();
    const source = node("table:a", "loot_table", "behavior_packs/a/loot_tables/entities/main.json", {
      pools: [{ entries: [
        { type: "loot_table", name: "loot_tables/entities/present.json" },
        { type: "loot_table", name: "loot_tables/entities/missing.json" },
        { type: "loot_table", name: "../secrets.json" },
        { type: "alternatives", children: [
          { type: "loot_table", name: "loot_tables/entities/present.json" },
        ] },
      ] }],
    });
    const target = node("table:target", "loot_table", "behavior_packs/a/loot_tables/entities/present.json", { pools: [] });
    const otherPack = node("table:other", "loot_table", "behavior_packs/b/loot_tables/entities/missing.json", { pools: [] });
    for (const item of [source, target, otherPack]) graph.addNode(item);
    populateOwnedEconomyReferences(graph, [source, target, otherPack]);
    const edges = graph.outgoingEdges(source.id);
    expect(edges).toHaveLength(3);
    expect(edges.filter(edge => edge.status === "resolved")).toHaveLength(2);
    expect(edges.filter(edge => edge.status === "unresolved")).toHaveLength(1);
    expect(edges.find(edge => edge.status === "unresolved")?.targetIdentifier)
      .toBe("loot_tables/entities/missing.json");
    expect(edges.filter(edge => edge.status === "resolved").map(edge => edge.to))
      .toEqual([target.id, target.id]);
    expect(edges.map(edge => edge.evidence.source.jsonPointer).sort()).toEqual([
      "/pools/0/entries/0/name", "/pools/0/entries/1/name", "/pools/0/entries/3/children/0/name",
    ]);
  });

  it("resolves literal custom item ingredients and outputs without inventing vanilla or tag references", () => {
    const graph = new SemanticGraph();
    const recipe = node("recipe:a", "recipe", "behavior_packs/a/recipes/crafting.json", {
      "minecraft:recipe_shaped": {
        key: { A: { item: "demo:ore" }, B: { tag: "minecraft:planks" } },
        result: { item: "demo:ingot" },
      },
    });
    const item = node("item:ore", "item", "behavior_packs/a/items/ore.json", {
      "minecraft:item": { description: { identifier: "demo:ore" } },
    });
    const foreign = node("item:foreign", "item", "behavior_packs/b/items/ingot.json", {
      "minecraft:item": { description: { identifier: "demo:ingot" } },
    });
    for (const x of [recipe,item,foreign]) graph.addNode(x);
    populateOwnedEconomyReferences(graph, [recipe,item,foreign]);
    expect(graph.outgoingEdges(recipe.id).map(edge => ({
      name:edge.targetIdentifier,status:edge.status,to:edge.to,
    })).sort((a,b)=>a.name.localeCompare(b.name))).toEqual([
      {name:"demo:ingot",status:"unresolved",to:undefined},
      {name:"demo:ore",status:"resolved",to:item.id},
    ]);
  });

  it("does not invent edges from dynamic, unnamespaced, or vanilla reward names", () => {
    const graph = new SemanticGraph();
    const source = node("table:safe", "loot_table", "behavior_packs/a/loot_tables/entities/safe.json", {
      pools: [{ entries: [
        { type: "item", name: "minecraft:diamond" },
        { type: "item", name: "iron_sword" },
        { type: "loot_table", name: "$variable" },
        { type: "loot_table", name: "loot_tables/../outside.json" },
      ] }],
    });
    graph.addNode(source);
    populateOwnedEconomyReferences(graph, [source]);
    expect(graph.allEdges()).toEqual([]);
  });
});
