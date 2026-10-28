import { describe, expect, it } from "vitest";
import { SemanticGraph, type SemanticNode } from "../../../packages/graph/src/index.js";
import { classifyOwnedLootTableSourceRoutes, populateOwnedEconomyReferences } from "../src/populate-owned-economy-references.js";
import { populateEntityLootTableEdges } from "../src/populate-entity-loot-table-edges.js";
import { parseEntityDefinition } from "../../entities/src/index.js";
import { matchPublishedVanillaLootSample } from "../src/published-vanilla-loot-samples.js";

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
      expect(byTarget.get(name)).toMatchObject({
        classification: "no-entity-chain-observed",
        proofCeiling: "SOURCE_REFERENCES_ONLY",
      });
    }
    // A circular table reference is not a new root or infinite traversal.
    expect(routes.size).toBe(4);
  });
});


describe("source-scoped component-group activation and publisher fallback references", () => {
  it("keeps group event adds conditional, distinguishes unsupported/no-event, and records published vanilla samples without resolving graph edges", () => {
    const graph = new SemanticGraph();
    const entity = node("entity:guard", "entity", "behavior_packs/a/entities/guard.json", {});
    const rootTable = node("loot:guard", "loot_table", "behavior_packs/a/loot_tables/entities/guard.json", {
      pools: [{ entries: [{ type: "loot_table", name: "loot_tables/entities/armor_set_iron.json" }] }],
    });
    const parsed = parseEntityDefinition({
      "minecraft:entity": {
        description: { identifier: "demo:guard" },
        components: { "minecraft:loot": { table: "loot_tables/empty.json" } },
        component_groups: {
          armored: { "minecraft:equipment": { table: "loot_tables/entities/guard.json" } },
          dormant: { "minecraft:loot": { table: "loot_tables/entities/custom_missing.json" } },
          unsupported: { "minecraft:loot": { table: "loot_tables/entities/other_missing.json" } },
        },
        events: {
          "demo:equip": { add: { component_groups: ["armored"] } },
          "demo:invalid": { sequence: [{
            add: { component_groups: ["unsupported"] },
            not_supported: true,
          }] },
        },
      },
    }, entity.source);
    graph.addNode(entity);
    graph.addNode(rootTable);
    populateEntityLootTableEdges(graph, [{ node: entity, parsed }], [entity, rootTable]);
    populateOwnedEconomyReferences(graph, [entity, rootTable]);
    const unresolved = graph.unresolvedEdges();
    const routes = classifyOwnedLootTableSourceRoutes(graph, [{ node: entity, parsed }]);
    const route = (name: string) => routes.get(unresolved.find(edge => edge.targetIdentifier === name)!.id);
    expect(unresolved).toHaveLength(4);
    expect(route("loot_tables/entities/armor_set_iron.json")).toMatchObject({
      classification: "entity-authored-chain",
      rootEntityId: entity.id,
      rootActivation: {
        scope: "component-group", groupId: "armored",
        status: "GROUP_ADD_EVENT_DECLARED",
        sourceEventIds: ["demo:equip"],
        sourceEventPointers: ["/minecraft:entity/events/demo:equip"],
      },
      publishedVanillaSample: {
        referencePath: "loot_tables/entities/armor_set_iron.json",
        publisher: "Mojang/bedrock-samples",
        proof: "PUBLISHED_SAMPLE_ONLY_VERSION_AND_RUNTIME_UNVERIFIED",
      },
    });
    expect(route("loot_tables/empty.json")).toMatchObject({
      rootActivation: { scope: "base", status: "BASE_COMPONENT_DECLARED" },
      publishedVanillaSample: { referencePath: "loot_tables/empty.json" },
    });
    expect(route("loot_tables/entities/custom_missing.json")).toMatchObject({
      rootActivation: {
        scope: "component-group", groupId: "dormant",
        status: "NO_LOCAL_GROUP_ADD_EVENT_OBSERVED",
      },
    });
    expect(route("loot_tables/entities/custom_missing.json")?.publishedVanillaSample).toBeUndefined();
    expect(route("loot_tables/entities/other_missing.json")).toMatchObject({
      rootActivation: { status: "UNSUPPORTED_EVENT_PROGRAM", groupId: "unsupported" },
    });
    expect(unresolved.every(edge => edge.status === "unresolved")).toBe(true);
    expect(graph.allEdges().some(edge => edge.targetIdentifier.includes("armor_set_iron") && edge.status === "resolved")).toBe(false);
  });

  it("pins the published source inventory without declaring runtime compatibility", () => {
    const chain = matchPublishedVanillaLootSample("loot_tables/entities/armor_set_chain");
    expect(chain).toMatchObject({
      publisher: "Mojang/bedrock-samples",
      commit: "46ba6ea985fb5a92d79a9419198f10dda14c199d",
      referencePath: "loot_tables/entities/armor_set_chain.json",
      proof: "PUBLISHED_SAMPLE_ONLY_VERSION_AND_RUNTIME_UNVERIFIED",
    });
    expect(matchPublishedVanillaLootSample("loot_tables/entities/tier_1_recruit.json")).toBeUndefined();
    expect(matchPublishedVanillaLootSample("loot_tables/../armor_set_chain.json")).toBeUndefined();
  });
});


describe("source-only entity spawn and settled event group routes", () => {
  it("requires the group to remain in an authored event branch; distinguishes spawn hook, randomize and remove", () => {
    const graph = new SemanticGraph();
    const entity = node("entity:guard-branch", "entity", "behavior_packs/a/entities/guard-branch.json", {});
    const parsed = parseEntityDefinition({
      "minecraft:entity": {
        description: { identifier: "example:guard" },
        component_groups: {
          armed: { "minecraft:equipment": { table: "loot_tables/entities/armed.json" } },
          transient: { "minecraft:equipment": { table: "loot_tables/entities/transient.json" } },
          surprise: { "minecraft:loot": { table: "loot_tables/entities/surprise.json" } },
        },
        events: {
          "minecraft:entity_spawned": { sequence: [
            { add: { component_groups: ["armed"] } },
            { remove: { component_groups: ["transient"] } },
          ] },
          "example:temporary": { sequence: [
            { add: { component_groups: ["transient"] } },
            { remove: { component_groups: ["transient"] } },
          ] },
          "example:surprise": { randomize: [
            { weight: 1, add: { component_groups: ["surprise"] } },
            { weight: 1, add: { component_groups: ["armed"] } },
          ] },
        },
      },
    }, entity.source);
    graph.addNode(entity);
    populateEntityLootTableEdges(graph, [{ node: entity, parsed }], [entity]);
    const spawnedAt = { artifactId, relativePath: "behavior_packs/a/scripts/main.js",
      range: { lineStart: 12, lineEnd: 12, columnStart: 2, columnEnd: 35 } };
    const routes = classifyOwnedLootTableSourceRoutes(graph, [{ node: entity, parsed }], [
      { entityIdentifier: "example:guard", source: spawnedAt, executionRegion: "function:spawn" },
      { entityIdentifier: "example:guard", source: { ...spawnedAt, relativePath: "behavior_packs/b/scripts/main.js" }, executionRegion: "function:foreign" },
      { entityIdentifier: "example:other", source: spawnedAt, executionRegion: "function:other" },
    ]);
    const route = (name: string) => routes.get(graph.unresolvedEdges()
      .find(edge => edge.targetIdentifier === name)!.id)!;
    expect(route("loot_tables/entities/armed.json").rootActivation).toMatchObject({
      status: "GROUP_ADD_EVENT_DECLARED", scope: "component-group", groupId: "armed",
      sourceEventIds: ["example:surprise", "minecraft:entity_spawned"],
    });
    expect(route("loot_tables/entities/armed.json").rootActivation?.sourceEventPaths)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ eventId: "minecraft:entity_spawned", spawnHookCandidate: true, conditioned: false }),
        expect.objectContaining({ eventId: "example:surprise", spawnHookCandidate: false, conditioned: true }),
      ]));
    expect(route("loot_tables/entities/armed.json").sourceSpawnRequests).toEqual([
      { source: spawnedAt, executionRegion: "function:spawn" },
    ]);
    expect(route("loot_tables/entities/surprise.json").rootActivation?.sourceEventPaths)
      .toEqual([expect.objectContaining({ eventId: "example:surprise", conditioned: true, spawnHookCandidate: false })]);
    expect(route("loot_tables/entities/transient.json").rootActivation).toEqual({
      scope: "component-group", groupId: "transient", status: "NO_NET_GROUP_ADD_AFTER_EVENT",
    });
    expect(graph.unresolvedEdges()).toHaveLength(3);
    expect(graph.allEdges().every(edge => edge.status === "unresolved")).toBe(true);
  });

  it("does not treat an unsupported or deferred trigger as a proven group activation", () => {
    const graph = new SemanticGraph();
    const entity = node("entity:delayed", "entity", "behavior_packs/a/entities/delayed.json", {});
    const parsed = parseEntityDefinition({
      "minecraft:entity": {
        description: { identifier: "example:delayed" },
        component_groups: {
          effect: { "minecraft:loot": { table: "loot_tables/entities/effect.json" } },
          unknown: { "minecraft:loot": { table: "loot_tables/entities/unknown.json" } },
        },
        events: {
          "minecraft:entity_spawned": { trigger: "example:activate_later" },
          "example:activate_later": { add: { component_groups: ["effect"] } },
          "example:opaque": { sequence: [{ add: { component_groups: ["unknown"] }, unsupported_feature: true }] },
        },
      },
    }, entity.source);
    graph.addNode(entity);
    populateEntityLootTableEdges(graph, [{ node: entity, parsed }], [entity]);
    const routes = classifyOwnedLootTableSourceRoutes(graph, [{ node: entity, parsed }]);
    const route = (target: string) => routes.get(graph.unresolvedEdges()
      .find(edge => edge.targetIdentifier === target)!.id)!.rootActivation;
    expect(route("loot_tables/entities/effect.json")).toMatchObject({
      status: "GROUP_ADD_EVENT_DECLARED",
      sourceEventIds: ["example:activate_later"],
      sourceEventPaths: [expect.objectContaining({ spawnHookCandidate: false })],
    });
    expect(route("loot_tables/entities/unknown.json")).toEqual({
      scope: "component-group", groupId: "unknown", status: "UNSUPPORTED_EVENT_PROGRAM",
    });
    // We did not invent execution of the triggered event from its caller.
    expect(route("loot_tables/entities/effect.json")?.sourceEventIds).not.toContain("minecraft:entity_spawned");
  });
});
