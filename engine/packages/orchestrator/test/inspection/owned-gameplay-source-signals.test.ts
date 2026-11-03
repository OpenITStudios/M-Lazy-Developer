import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SemanticGraph, type SemanticNode } from "../../../graph/src/index.js";
import { populateOwnedEconomyReferences } from "../../../../analyzers/references/src/index.js";
import { deriveOwnedGameplaySourceSignals } from "../../src/inspection/owned-gameplay-source-signals.js";
import { inspectDirectory } from "../../src/inspection/inspect.js";
import { parseScriptFile } from "../../../../analyzers/scripts/src/index.js";

const selected = "artifact:current";
function owned(kind: "block" | "loot_table" | "item", path: string,
  data: unknown, artifactId = selected): SemanticNode {
  const id = artifactId + ":" + path;
  return {
    id, identity: { kind, scope: "project", identifier: path },
    kind, identifier: path, source: { artifactId, relativePath: path }, data,
  };
}
const ore = (name: string, loot: string) => ({
  "minecraft:block": {
    description: { identifier: name },
    components: {
      "minecraft:destructible_by_mining": { seconds_to_destroy: 3 },
      "minecraft:loot": loot,
    },
  },
});
const table = (item: string) => ({pools: [{ rolls: 1, entries: [{
  type: "item", name: item, weight: 1,
  functions: [{ function: "set_count", count: 1 }],
}]}]});

function graphWith(...nodes: SemanticNode[]) {
  const graph = new SemanticGraph();
  for (const node of nodes) graph.addNode(node);
  populateOwnedEconomyReferences(graph, nodes);
  return graph;
}

describe("BP authored source facts integrated with existing reference graph", () => {
  it("retains exact block → table → vanilla item source evidence without gameplay PASS", () => {
    const block = owned("block", "behavior_packs/BP/blocks/ore.json",
      ore("demo:ore", "loot_tables/blocks/ore.json"));
    const loot = owned("loot_table", "behavior_packs/BP/loot_tables/blocks/ore.json",
      table("minecraft:raw_copper"));
    const item = owned("item", "behavior_packs/BP/items/controller.json", {
      "minecraft:item": { description: { identifier: "demo:controller" },
        components: { "minecraft:max_stack_size": 1,
          "minecraft:cooldown": { category: "demo", duration: 1 },
          "minecraft:use_modifiers": { use_duration: 5 } } },
    });
    const output = deriveOwnedGameplaySourceSignals({
      artifactId: selected, graph: graphWith(block, loot, item),
      nodes: [block, loot, item],
    });
    expect(output.signals).toHaveLength(4);
    expect(output.relations).toHaveLength(2);
    expect(output.relations.map(link => link.edgeKind)).toEqual(["requires", "produces"]);
    expect(output.relations[0]).toMatchObject({
      locator: "behavior_packs/BP/blocks/ore.json#/minecraft:~1block/components/minecraft:~1loot",
      status: "inferred", evidenceOrigin: "source-code",
    });
    expect(output.relations[1]?.summary).toContain("set_count=1");
    expect(output.signals.find(s => s.label === "Item demo:controller")?.summary)
      .toContain("use_duration=5s");
    expect(output.signals.every(s => s.status === "inferred" &&
      s.summary.includes("not observed") || s.summary.includes("remain unverified"))).toBe(true);
  });

  it("keeps declared empty pools distinct from proven no-drop gameplay", () => {
    const empty = owned("loot_table", "behavior_packs/BP/loot_tables/empty.json", {pools: []});
    const output = deriveOwnedGameplaySourceSignals({
      artifactId: selected, graph: graphWith(empty), nodes: [empty],
    });
    expect(output.signals).toHaveLength(1);
    expect(output.signals[0]?.summary).toContain("pools=[]");
    expect(output.signals[0]?.summary).toContain("cannot infer global no-drop rule");
    expect(output.relations).toEqual([]);
  });

  it("does not infer item outputs for unknown conditions, counts, or nonliteral entries", () => {
    const malformed = [
      { pools: [{ rolls: 1, conditions: [{ condition: "random_chance", chance: .5 }],
        entries: [{ type: "item", name: "minecraft:iron_ingot" }] }] },
      { pools: [{ rolls: { min: 1, max: 2 }, entries: [{ type: "item", name: "minecraft:iron_ingot" }] }] },
      { pools: [{ rolls: 1, entries: [{ type: "alternatives", children: [] }] }] },
      { pools: [{ rolls: 1, entries: [{ type: "item", name: "minecraft:iron_ingot",
        functions: [{ function: "set_count", count: { min: 1, max: 4 } }] }] }] },
      { pools: [{ rolls: 1, entries: [{ type: "item", name: "minecraft:iron_ingot",
        functions: [{ function: "set_count", count: 0 }] }] }] },
    ];
    for (const [i, body] of malformed.entries()) {
      const target = owned("loot_table", `behavior_packs/BP/loot_tables/unresolved_${i}.json`, body);
      const output = deriveOwnedGameplaySourceSignals({
        artifactId: selected, graph: graphWith(target), nodes: [target],
      });
      expect(output.signals).toHaveLength(1);
      expect(output.relations).toEqual([]);
    }
  });

  it("does not borrow a table from another pack or a different artifact", () => {
    const block = owned("block", "behavior_packs/BP/blocks/ore.json",
      ore("demo:ore", "loot_tables/blocks/ore.json"));
    const wrongPack = owned("loot_table", "behavior_packs/OTHER/loot_tables/blocks/ore.json",
      table("minecraft:raw_copper"));
    const wrongArtifact = owned("loot_table", "behavior_packs/BP/loot_tables/blocks/ore.json",
      table("minecraft:raw_copper"), "artifact:historic");
    const output = deriveOwnedGameplaySourceSignals({
      artifactId: selected, graph: graphWith(block, wrongPack, wrongArtifact),
      nodes: [block, wrongPack, wrongArtifact],
    });
    // A valid, unrelated table may still declare a vanilla output, but the
    // selected BP block MUST NOT gain a cross-pack or cross-map loot edge.
    expect(output.relations.filter(link => link.fromSubjectKey.includes("BP%2Fblocks%2Fore.json")))
      .toEqual([]);
    expect(output.signals.some(item => item.label === "Block demo:ore")).toBe(true);
    expect(output.signals.some(item => item.locator.startsWith("behavior_packs/BP/loot_tables")))
      .toBe(false);
  });
});

describe("actual inspection source→Intent consumer", () => {
  const roots: string[] = [];
  afterEach(async () => {
    for (const root of roots.splice(0)) await rm(root, {recursive: true, force: true});
  });
  it("projects source-use witnesses through the actual inspection and Intent pipeline", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-lazy-bp-source-use-"));
    roots.push(root);
    const definitions = [
      ["blocks/ore.json", ore("demo:ore", "loot_tables/blocks/ore.json")],
      ["loot_tables/blocks/ore.json", table("minecraft:raw_copper")],
      ["items/leaderboard.json", { "minecraft:item": {
        description: { identifier: "demo:leaderboard" },
        components: { "minecraft:max_stack_size": 1 },
      }}],
    ] as const;
    for (const [path, content] of definitions) {
      const absolute = join(root, "behavior_packs/BP", path);
      await mkdir(absolute.slice(0, absolute.lastIndexOf("/")), { recursive: true });
      await writeFile(absolute, JSON.stringify(content));
    }
    await mkdir(join(root, "behavior_packs/BP/scripts"), {recursive: true});
    await writeFile(join(root, "behavior_packs/BP/scripts/main.js"), [
      'import { ItemStack } from "@minecraft/server";',
      'const ITEM_ID = "minecraft:raw_copper";',
      'const BLOCK_ID = "demo:ore";',
      'function checkItem(player, itemId) { return 0; }',
      'function usage(player) {',
      '  const stack = new ItemStack("demo:leaderboard", 1);',
      '  stack.setCanDestroy([BLOCK_ID]);',
      '  checkItem(player, ITEM_ID);',
      '}',
    ].join("\n"));
    const result = await inspectDirectory(root, selected);
    const model = result.gameplayIntent.model;
    const uses = model.nodes.filter(node => node.id.startsWith("resource:bp-script-use:"));
    const relations = model.edges.filter(edge => edge.from.startsWith("resource:bp-script-use:"));
    expect(uses).toHaveLength(3);
    expect(relations).toHaveLength(3);
    expect(relations.every(edge => edge.status === "inferred" &&
      edge.kind === "participates-in")).toBe(true);
    expect(model.evidence.some(item => item.locator ===
      "behavior_packs/BP/scripts/main.js#L8")).toBe(true);
    expect(result.gameplayDiscoveryClosure.semanticUnderstandingGaps).toBe(3);
  });

  it("projects exact block/loot/item source relations but retains incomplete semantic closure", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-lazy-owned-definitions-"));
    roots.push(root);
    const definitions = [
      ["blocks/ore.json", ore("demo:ore", "loot_tables/blocks/ore.json")],
      ["loot_tables/blocks/ore.json", table("minecraft:raw_copper")],
      ["items/leaderboard.json", { "minecraft:item": {
        description: { identifier: "demo:leaderboard" },
        components: { "minecraft:max_stack_size": 1 },
      }}],
    ] as const;
    for (const [path, content] of definitions) {
      const absolute = join(root, "behavior_packs/BP", path);
      await mkdir(absolute.slice(0, absolute.lastIndexOf("/")), { recursive: true });
      await writeFile(absolute, JSON.stringify(content));
    }
    const result = await inspectDirectory(root, selected);
    const model = result.gameplayIntent.model;
    expect(model.nodes.some(n => n.label === "Block demo:ore")).toBe(true);
    expect(model.nodes.some(n => n.label === "Item demo:leaderboard")).toBe(true);
    expect(model.nodes.some(n => n.label === "minecraft:raw_copper")).toBe(true);
    expect(model.edges.filter(edge => ["produces", "requires"].includes(edge.kind) &&
      edge.id.includes("resource:bp-")).map(x => x.kind).sort())
      .toEqual(["produces", "requires"]);
    // Source configuration is now interpreted as bounded hints, but this
    // cannot establish intended gameplay, activation or completed outcomes.
    expect(result.gameplayDiscoveryClosure.semanticUnderstandingGaps).toBe(3);
    expect(model.evidence.some(item => item.locator.includes("/pools/0/entries/0/name") &&
      item.summary.includes("does not prove"))).toBe(true);
  });
});


describe("script source usage binds exact authored BP resource identity", () => {
  const oreBlock = owned("block", "behavior_packs/BP/blocks/ore.json",
    ore("demo:ore", "loot_tables/blocks/ore.json"));
  const oreTable = owned("loot_table", "behavior_packs/BP/loot_tables/blocks/ore.json",
    table("minecraft:raw_copper"));
  const wandItem = owned("item", "behavior_packs/BP/items/wand.json", {
    "minecraft:item": { description: { identifier: "demo:wand" },
      components: { "minecraft:max_stack_size": 1 } },
  });
  const fixture = [oreBlock, oreTable, wandItem];
  const scriptEntry = (code: string, artifactId = selected) => {
    const source = { artifactId, relativePath: "behavior_packs/BP/scripts/main.js" };
    return { parsed: parseScriptFile("scripts/main", code, source), text: code };
  };
  const derive = (scriptCode: string, artifactId = selected) =>
    deriveOwnedGameplaySourceSignals({artifactId: selected,
      graph: graphWith(...fixture), nodes: fixture,
      scripts: [scriptEntry(scriptCode, artifactId)]});

  it("connects typed local call, item construction, type guard and owned ItemStack destroy permissions", () => {
    const output = derive([
      'import { ItemStack as Stack } from "@minecraft/server";',
      'var ORE_ID = "demo:ore";',
      'const INGREDIENT_ID = "minecraft:raw_copper";',
      'const TOOL_ID = "demo:wand";',
      'function countInventory(player, itemId) { return 0; }',
      'function run(player) {',
      '  const pick = new Stack(TOOL_ID, 1);',
      '  pick.setCanDestroy([ORE_ID]);',
      '  const amount = countInventory(player, INGREDIENT_ID);',
      '  if (player.getItem()?.typeId === TOOL_ID) { return amount; }',
      '}',
    ].join("\n"));
    const script = output.signals.filter(s => s.subjectKey.startsWith("resource:bp-script-use:"));
    expect(script).toHaveLength(4);
    expect(script.map(s => s.label).sort()).toEqual([
      "Script source ItemStack construction", "Script source item destroy permission",
      "Script source resolved local call", "Script source type ID comparison",
    ]);
    const uses = output.relations.filter(r => r.id.startsWith("bp-script-use-link:"));
    expect(uses).toHaveLength(4);
    expect(uses.every(r => r.status === "inferred" && r.edgeKind === "participates-in"
      && r.locator.startsWith("behavior_packs/BP/scripts/main.js#L"))).toBe(true);
    expect(uses.map(r => r.locator).sort()).toEqual([
      "behavior_packs/BP/scripts/main.js#L10",
      "behavior_packs/BP/scripts/main.js#L7",
      "behavior_packs/BP/scripts/main.js#L8",
      "behavior_packs/BP/scripts/main.js#L9",
    ]);
    expect(uses.some(r => r.toSubjectKey === "resource:bp-loot-item:behavior_packs%2FBP:minecraft%3Araw_copper")).toBe(true);
    expect(uses.some(r => r.toSubjectKey.includes("blocks%2Fore.json"))).toBe(true);
    expect(uses.some(r => r.toSubjectKey.includes("items%2Fwand.json"))).toBe(true);
  });

  it("groups repeated source sites by one lexical owner without discarding individual witnesses", () => {
    const output = derive([
      'const RAW = "minecraft:raw_copper";',
      'function sourceReader(player, typeId) { return 0; }',
      'function owner(player) {',
      '  sourceReader(player, RAW);',
      '  sourceReader(player, RAW);',
      '}',
    ].join("\n"));
    const sites = output.signals.filter(s => s.label === "Script source resolved local call");
    const links = output.relations.filter(s => s.id.startsWith("bp-script-use-link:"));
    expect(sites).toHaveLength(2);
    expect(new Set(sites.map(s => s.subjectKey)).size).toBe(1);
    expect(new Set(sites.map(s => s.id)).size).toBe(2);
    expect(sites.map(s => s.locator)).toEqual([
      "behavior_packs/BP/scripts/main.js#L4",
      "behavior_packs/BP/scripts/main.js#L5",
    ]);
    expect(links).toHaveLength(2);
    expect(links.every(link => link.fromSubjectKey === sites[0]?.subjectKey)).toBe(true);
  });

  it("fails closed for catch, loop and destructured parameter shadows", () => {
    const output = derive([
      'import { ItemStack } from "@minecraft/server";',
      'const ID = "demo:wand";',
      'function one({ID}) { new ItemStack(ID, 1); }',
      'function two(items) { for (const ID of items) new ItemStack(ID, 1); }',
      'function three() { try { throw 0; } catch (ID) { new ItemStack(ID, 1); } }',
    ].join("\n"));
    expect(output.relations.filter(r => r.id.startsWith("bp-script-use-link:"))).toEqual([]);
  });

  it("rejects inert strings, redeclared/mutated/shadowed names and external artifact scripts", () => {
    const output = derive([
      'const A = "demo:ore";',
      'var M = "demo:wand";',
      'function read(A) { return A === "demo:ore"; }',
      'function act(player) {',
      '  const A = "other:ore";',
      '  console.log("demo:ore", "demo:wand");',
      '  M = "other:wand";',
      '  if (player.typeId === M) return;',
      '}',
    ].join("\n"));
    expect(output.relations.filter(r => r.id.startsWith("bp-script-use-link:"))).toEqual([]);
    const other = derive([
      'import { ItemStack } from "@minecraft/server";',
      'new ItemStack("demo:wand", 1);',
    ].join("\n"), "artifact:old");
    expect(other.relations.filter(r => r.id.startsWith("bp-script-use-link:"))).toEqual([]);
  });

  it("does not cross packs or invent source roles from a bare identifier mention", () => {
    const output = derive([
      'var ORE_ID = "demo:ore";',
      'function write() { const untyped = ORE_ID; }',
      'function unknown(player) { console.log(ORE_ID); }',
    ].join("\n"));
    expect(output.relations.filter(r => r.id.startsWith("bp-script-use-link:"))).toEqual([]);
    const foreign = deriveOwnedGameplaySourceSignals({ artifactId: selected,
      graph: graphWith(...fixture), nodes: fixture,
      scripts: [{ parsed: parseScriptFile("scripts/main",
        'import { ItemStack } from "@minecraft/server"; new ItemStack("demo:wand", 1);',
        {artifactId: selected, relativePath:"behavior_packs/OTHER/scripts/main.js"}) }],
    });
    expect(foreign.relations.filter(r => r.id.startsWith("bp-script-use-link:"))).toEqual([]);
  });
});
