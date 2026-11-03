import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SemanticGraph, type SemanticNode } from "../../../graph/src/index.js";
import { populateOwnedEconomyReferences } from "../../../../analyzers/references/src/index.js";
import { deriveOwnedGameplaySourceSignals } from "../../src/inspection/owned-gameplay-source-signals.js";
import { inspectDirectory } from "../../src/inspection/inspect.js";

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
