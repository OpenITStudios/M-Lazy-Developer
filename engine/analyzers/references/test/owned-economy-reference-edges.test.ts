import { describe, expect, it } from "vitest";
import { SemanticGraph, type SemanticNode } from "../../../packages/graph/src/index.js";
import { classifyOwnedLootTableSourceRoutes, populateOwnedEconomyReferences } from "../src/populate-owned-economy-references.js";

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

describe("authored loot-table source routes (not runtime reachability)", () => {
  it("distinguishes missing nested tables on entity-authored chains from orphan definitions", () => {
    const graph = new SemanticGraph();
    const linked = node("table:linked", "loot_table", "behavior_packs/a/loot_tables/entities/recruit.json", {
      pools: [{ entries: [{ type: "loot_table", name: "loot_tables/entities/deep.json" }] }],
    });
    const deep = node("table:deep", "loot_table", "behavior_packs/a/loot_tables/entities/deep.json", {
      pools: [{ entries: [
        { type: "loot_table", name: "loot_tables/entities/missing.json" },
        { type: "loot_table", name: "loot_tables/entities/recruit.json" },
      ] }],
    });
    const orphan = node("table:orphan", "loot_table", "behavior_packs/a/loot_tables/entities/swordman.json", {
      pools: [{ entries: [
        { type: "loot_table", name: "loot_tables/entities/armor_set_iron.json" },
        { type: "loot_table", name: "loot_tables/entities/armor_set_chain.json" },
      ] }],
    });
    const foreign = node("table:foreign", "loot_table", "behavior_packs/b/loot_tables/entities/foreign.json", {
      pools: [{ entries: [{ type: "loot_table", name: "loot_tables/entities/foreign_missing.json" }] }],
    });
    const entity = node("entity:recruit", "entity", "behavior_packs/a/entities/recruit.json", {});
    for (const value of [linked, deep, orphan, foreign, entity]) graph.addNode(value);
    populateOwnedEconomyReferences(graph, [linked, deep, orphan, foreign, entity]);
    graph.addEdge({
      from: entity.id,
      to: linked.id,
      type: "REFERENCES",
      targetIdentifier: "loot_tables/entities/recruit.json",
      status: "resolved",
      evidence: { source: { ...entity.source,
        jsonPointer: "/minecraft:entity/component_groups/equipment/minecraft:equipment/table" } },
    });
    // A malformed cross-pack edge must not turn a different pack's source into
    // a witnessed path, even when the graph contains that edge.
    graph.addEdge({
      from: linked.id, to: foreign.id,
      type: "REFERENCES", targetIdentifier: "loot_tables/entities/foreign.json",
      status: "resolved", evidence: { source: { ...linked.source, jsonPointer: "/pools/0/entries/2/name" } },
    });
    const routes = classifyOwnedLootTableSourceRoutes(graph);
    const missing = graph.unresolvedEdges().filter(edge => edge.type === "REFERENCES");
    expect(missing).toHaveLength(4);
    const byTarget = new Map(missing.map(edge => [edge.targetIdentifier, routes.get(edge.id)]));
    expect(byTarget.get("loot_tables/entities/missing.json")).toEqual({
      classification: "entity-authored-chain",
      proofCeiling: "SOURCE_REFERENCES_ONLY",
      rootEntityId: entity.id,
      rootReferencePath: entity.source.relativePath,
      rootReferencePointer: "/minecraft:entity/component_groups/equipment/minecraft:equipment/table",
    });
    for (const name of [
      "loot_tables/entities/armor_set_iron.json",
      "loot_tables/entities/armor_set_chain.json",
      "loot_tables/entities/foreign_missing.json",
    ]) {
      expect(byTarget.get(name)).toEqual({
        classification: "no-entity-chain-observed",
        proofCeiling: "SOURCE_REFERENCES_ONLY",
      });
    }
    // A circular table reference is not a new root or infinite traversal.
    expect(routes.size).toBe(4);
  });
});
