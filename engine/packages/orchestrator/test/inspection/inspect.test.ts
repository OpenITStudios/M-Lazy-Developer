import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { inspectDirectory } from "../../src/inspection/inspect.js";
import { parseScriptFile, resolveScriptImports } from "../../../../analyzers/scripts/src/index.js";
import { semanticIrExecutionTraces } from "../../../semantic-ir/src/index.js";
import { scriptRegionId } from "../../src/diagnosis/semantic-ir-stage.js";
import { SemanticGraph } from "../../../graph/src/index.js";
import { parseEntityDefinition } from "../../../../analyzers/entities/src/index.js";
import { populateEntityLootTableEdges } from "../../../../analyzers/references/src/index.js";
import type { SemanticNode } from "../../../graph/src/index.js";
import { populateInspectionScriptImportGraph } from "../../src/inspection/inspect-script-import-graph.js";
import { discoverInspectionPacks, resolveSelectedScriptRoots } from "../../src/inspection/inspect-packs.js";
import { buildFilesystemInventory } from "../../../project-model/src/index.js";
import { deriveGameplayResourceTextSignals } from "../../src/inspection/gameplay-intent-resource-text.js";
import { buildGameplayIntentModel } from "../../src/inspection/gameplay-intent-stage.js";

describe("inspectDirectory", () => {
  it("discovers pack, functions, structures and unresolved references", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-inspect-"));
    const pack = join(root, "behavior_packs/demo");

    await mkdir(join(pack, "functions"), { recursive: true });
    await mkdir(join(pack, "structures"), { recursive: true });

    await writeFile(join(pack, "manifest.json"), JSON.stringify({
      format_version: 2,
      header: {
        name: "Demo",
        description: "Demo",
        uuid: "00000000-0000-0000-0000-000000000001",
        version: [1,0,0]
      },
      modules: [{
        type: "data",
        uuid: "00000000-0000-0000-0000-000000000002",
        version: [1,0,0]
      }]
    }));

    await writeFile(join(pack, "functions/start.mcfunction"), [
      "function missing/reset",
      "structure load arena/test 0 0 0",
    ].join("\n"));

    await writeFile(join(pack, "structures/test.mcstructure"), "fixture");

    const result = await inspectDirectory(root);
    expect(result.packs[0]?.type).toBe("behavior_pack");
    expect(result.functions).toBe(1);
    expect(result.structures).toBe(1);
    expect(result.unresolvedReferences).toBeGreaterThan(0);
    expect(result.semanticIr.executionRegions).toBeGreaterThan(0);
    expect(result.semanticIr.executionEdges).toBeGreaterThan(0);
    expect(result.semanticIr.unresolvedExecutionTargets).toBeGreaterThan(0);
    expect(result.decisionBasis.semanticIrRevision).toMatch(/^[a-f0-9]{64}$/);
  });
  it("keeps duplicate function targets unresolved for Discovery Closure", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-ambiguous-"));
    try {
      for (const pack of ["a", "b"]) {
        const dir = join(root, "behavior_packs", pack, "functions");
        await mkdir(dir, { recursive: true });
        await writeFile(join(dir, "start.mcfunction"), "say ready\\n");
      }
      await writeFile(join(root, "behavior_packs", "a", "functions", "tick.json"),
        JSON.stringify({ values: ["start"] }));
      const result = await inspectDirectory(root);
      expect(result.gameplayDiscoveryClosure.unresolvedReferences).toBeGreaterThan(0);
      expect(result.unresolvedReferences).toBe(result.gameplayDiscoveryClosure.unresolvedReferences);
      expect(result.gameplayDiscoveryClosure.status).not.toBe("COMPLETE");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("does not treat an icon-only unlisted pack as gameplay source", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-icon-only-"));
    try {
      for (const name of ["a", "b"]) {
        await mkdir(join(root, "behavior_packs", name, "functions"), { recursive: true });
        await writeFile(join(root, "behavior_packs", name, "manifest.json"), JSON.stringify({
          format_version: 2,
          header: { name, uuid: name === "a" ? "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" : "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", version: [1,0,0] },
          modules: [{ type: "data", uuid: "cccccccc-cccc-cccc-cccc-cccccccccccc", version: [1,0,0] }],
        }));
      }
      await writeFile(join(root, "world_behavior_packs.json"), JSON.stringify([
        { pack_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", version: [1,0,0] },
      ]));
      await writeFile(join(root, "behavior_packs/b/pack_icon.png"), "icon");
      await writeFile(join(root, "behavior_packs/a/functions/start.mcfunction"), "say ready");
      const withoutSource = await inspectDirectory(root);
      expect(withoutSource.gameplayDiscoveryClosure.unlistedPackRoots).toEqual([]);
      await writeFile(join(root, "behavior_packs/b/functions/start.mcfunction"), "say ready");
      const withSource = await inspectDirectory(root);
      expect(withSource.gameplayDiscoveryClosure.unlistedPackRoots).toEqual(["behavior_packs/b"]);
      expect(withSource.gameplayDiscoveryClosure.sourceRelevantFiles)
        .toBeGreaterThan(withoutSource.gameplayDiscoveryClosure.sourceRelevantFiles);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("recognizes valid dialogue as source in an unlisted pack", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-dialogue-pack-"));
    try {
      const pack = join(root, "behavior_packs", "dialogue");
      await mkdir(join(pack, "dialogue"), { recursive: true });
      await writeFile(join(pack, "manifest.json"), JSON.stringify({
        format_version: 2,
        header: { name: "dialogue", uuid: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", version: [1,0,0] },
        modules: [{ type: "data", uuid: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", version: [1,0,0] }],
      }));
      await writeFile(join(root, "world_behavior_packs.json"), "[]");
      await writeFile(join(pack, "dialogue", "npc.json"), JSON.stringify({
        format_version: "1.17",
        minecraft_npc_dialogue: { scenes: [{ scene_tag: "entry", npc_name: "Guide", text: "Start" }] },
      }));
      const result = await inspectDirectory(root);
      expect(result.gameplayDiscoveryClosure.unlistedPackRoots).toEqual(["behavior_packs/dialogue"]);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("retains semantic understanding gaps from unlisted gameplay packs", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-gap-pack-"));
    try {
      const pack = join(root, "behavior_packs", "gap");
      await mkdir(join(pack, "loot_tables"), { recursive: true });
      await writeFile(join(pack, "manifest.json"), JSON.stringify({
        format_version: 2,
        header: { name: "gap", uuid: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", version: [1,0,0] },
        modules: [{ type: "data", uuid: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", version: [1,0,0] }],
      }));
      await writeFile(join(root, "world_behavior_packs.json"), "[]");
      await writeFile(join(pack, "loot_tables", "reward.json"), JSON.stringify({ pools: [] }));
      const result = await inspectDirectory(root);
      expect(result.gameplayDiscoveryClosure.unlistedPackRoots).toEqual(["behavior_packs/gap"]);
      expect(result.gameplayDiscoveryClosure.semanticUnderstandingGapPaths)
        .toContain("behavior_packs/gap/loot_tables/reward.json");
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("distinguishes declared world pack membership from manifest presence", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-pack-list-"));
    try {
      for (const name of ["a", "b"]) {
        await mkdir(join(root, "behavior_packs", name), { recursive: true });
        await writeFile(join(root, "behavior_packs", name, "manifest.json"), JSON.stringify({
          format_version: 2,
          header: { name, uuid: name === "a" ? "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" : "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", version: [1, 0, 0] },
          modules: [{ type: "data", uuid: "cccccccc-cccc-cccc-cccc-cccccccccccc", version: [1,0,0] }],
        }));
      }
      await writeFile(join(root, "world_behavior_packs.json"), JSON.stringify([
        { pack_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", version: [1,0,0] },
      ]));
      const entries = await buildFilesystemInventory(root);
      const result = await discoverInspectionPacks(root, "artifact", entries);
      expect(result.packs.map(pack => [pack.root, pack.worldAttachment])).toEqual([
        ["behavior_packs/a", "listed"], ["behavior_packs/b", "not-listed"],
      ]);
      await writeFile(join(root, "world_behavior_packs.json"), "{invalid");
      const unknown = await discoverInspectionPacks(root, "artifact", entries);
      expect(unknown.packs.every(pack => pack.worldAttachment === "unknown")).toBe(true);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("grounds a mixed data/script pack and traces only manifest-attached script roots", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-mixed-script-roots-"));
    const pack = "behavior_packs/demo";
    const scriptRoot = pack + "/scripts/";
    const mainPath = scriptRoot + "main.js";
    const gamePath = scriptRoot + "chunks/game.js";
    const orphanPath = scriptRoot + "entries/unreferenced.js";
    const files = [
      [mainPath, [
        'import { world } from "@minecraft/server";',
        'import "./chunks/game.js";',
        'world.afterEvents.playerSpawn.subscribe(() => {});',
      ].join("\n")],
      [gamePath, [
        'import { world } from "@minecraft/server";',
        'world.afterEvents.playerLeave.subscribe(() => {});',
      ].join("\n")],
      [orphanPath, [
        'import { world } from "@minecraft/server";',
        'world.afterEvents.entityDie.subscribe(() => {});',
      ].join("\n")],
    ] as const;
    try {
      for (const [name, content] of files) {
        await mkdir(join(root, name.slice(0, name.lastIndexOf("/"))), {
          recursive: true,
        });
        await writeFile(join(root, name), content);
      }
      await writeFile(join(root, pack, "manifest.json"), JSON.stringify({
        format_version: 2,
        header: {
          name: "Mixed authored source",
          uuid: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          version: [1, 1, 17],
          min_engine_version: [1, 21, 130],
        },
        modules: [
          { type: "data", uuid: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            version: [1, 1, 17] },
          { type: "script", language: "javascript", entry: "scripts/main.js",
            uuid: "cccccccc-cccc-cccc-cccc-cccccccccccc",
            version: [1, 1, 17] },
        ],
      }));
      await writeFile(join(root, "world_behavior_packs.json"), JSON.stringify([
        { pack_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          version: [1, 1, 17] },
      ]));
      const inventory = await buildFilesystemInventory(root);
      const discovery = await discoverInspectionPacks(root, "selected", inventory);
      expect(discovery.packs).toEqual([
        expect.objectContaining({
          root: pack, type: "mixed_pack", worldAttachment: "listed",
        }),
      ]);

      const scripts = files.map(([path, code]) =>
        parseScriptFile(path, code, {
          artifactId: "selected", relativePath: path,
        }));
      const resolved = resolveScriptImports(scripts);
      const roots = resolveSelectedScriptRoots(discovery, scripts, resolved);
      expect(roots).toEqual({
        entryPaths: [mainPath],
        staticallyReachablePaths: [gamePath, mainPath],
      });

      // This exercises the actual inspection producer, not an alternate
      // manifest model or independent hand-written source trace.
      const inspection = await inspectDirectory(root, "selected");
      expect(inspection.semanticIrModel.execution.manifestScriptRoots).toEqual(roots);
      const dependencies = inspection.semanticIrModel.execution.edges.filter(edge =>
        edge.kind === "static-module-dependency");
      expect(dependencies).toEqual([
        expect.objectContaining({
          from: scriptRegionId(scripts[0]!.source, "module"),
          to: scriptRegionId(scripts[1]!.source, "module"),
          source: expect.objectContaining({
            relativePath: mainPath,
            range: expect.objectContaining({ lineStart: 2 }),
          }),
        }),
      ]);
      expect(inspection.semanticIrModel.temporal.relations
        .some(relation => relation.id === "time:" + dependencies[0]!.id)).toBe(false);
      const traced = semanticIrExecutionTraces(inspection.semanticIrModel);
      const selectedRoot = traced.traces.find(trace =>
        trace.entryRegionId === scriptRegionId(scripts[0]!.source, "module"));
      expect(selectedRoot?.regionIds).toContain(
        scriptRegionId(scripts[1]!.source, "module"));
      const moduleEntries = traced.traces
        .filter(trace => trace.entryKind === "script-module")
        .map(trace => trace.entryRegionId);
      expect(moduleEntries).toEqual([
        scriptRegionId(scripts[0]!.source, "module"),
      ]);
      const orphanEvent = inspection.semanticIrModel.execution.regions.find(
        region => region.kind === "event-source" &&
          region.source?.relativePath === orphanPath);
      expect(orphanEvent).toBeDefined();
      expect(traced.traces.some(trace =>
        trace.entryRegionId === orphanEvent!.id)).toBe(false);
      expect(traced.regionsOutsideTraces).toContain(orphanEvent!.id);
      expect(traced.traces.some(trace =>
        trace.entryKind === "event-source" &&
        trace.regionIds.some(id => id.includes("playerLeave")))).toBe(true);

      // An unlisted pack or missing imported file does not authorize a
      // manifest-root filter. Those cases must remain UNKNOWN.
      await writeFile(join(root, "world_behavior_packs.json"), "[]");
      const notListed = await discoverInspectionPacks(root, "selected", inventory);
      expect(notListed.packs[0]?.worldAttachment).toBe("not-listed");
      expect(resolveSelectedScriptRoots(notListed, scripts, resolved))
        .toBeUndefined();
      const brokenMain = parseScriptFile(mainPath,
        'import "./chunks/missing.js";', {
          artifactId: "selected", relativePath: mainPath,
        });
      const mixedScripts = [brokenMain, ...scripts.slice(1)];
      expect(resolveSelectedScriptRoots(discovery, mixedScripts,
        resolveScriptImports(mixedScripts))).toBeUndefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps literal import() as a resolved source dependency, not a proven execution", () => {
    const source = {
      artifactId: "selected",
      relativePath: "behavior_packs/demo/scripts/main.js",
    };
    const targetSource = {
      artifactId: "selected",
      relativePath: "behavior_packs/demo/scripts/chunks/arena.js",
    };
    const entry = parseScriptFile("entry", [
      "import './chunks/arena.js';",
      "async function start(name) {",
      "  await import('./chunks/arena.js');",
      "  await import(name);",
      "}",
    ].join("\n"), source);
    const arena = parseScriptFile("arena", "export const value = 1;", targetSource);
    const graph = new SemanticGraph();
    const node = (id: string, s: typeof source): SemanticNode =>
      ({
        id,
        identifier: id,
        kind: "script_file",
        identity: { kind: "script_file", scope: "project", identifier: id },
        source: s,
      });
    const a = node("script:entry", source);
    const b = node("script:arena", targetSource);
    graph.addNode(a);
    graph.addNode(b);
    populateInspectionScriptImportGraph(graph, [
      { node: a, parsed: entry }, { node: b, parsed: arena },
    ]);
    const staticEdge = graph.allEdges().find(edge =>
      edge.type === "IMPORTS_SCRIPT" && edge.importSyntax === undefined);
    const literal = graph.allEdges().find(edge =>
      edge.type === "IMPORTS_SCRIPT" && edge.importSyntax === "dynamic-literal");
    const expression = graph.allEdges().find(edge =>
      edge.type === "IMPORTS_SCRIPT" && edge.importSyntax === "dynamic-expression");
    expect(staticEdge).toMatchObject({
      status: "resolved", from: a.id, to: b.id,
    });
    expect(literal).toMatchObject({
      status: "resolved", from: a.id, to: b.id,
      importSyntax: "dynamic-literal",
      evidence: { source: expect.objectContaining({
        relativePath: source.relativePath,
        range: expect.objectContaining({ lineStart: 3 }),
      }) },
    });
    expect(expression).toMatchObject({
      status: "unresolved", from: a.id,
      importSyntax: "dynamic-expression",
    });
    expect(expression?.to).toBeUndefined();
  });

  it("joins entity loot/equipment declarations only to exact same-pack table sources", () => {
    const artifactId = "source-artifact";
    const entitySource = {
      artifactId,
      relativePath: "behavior_packs/a/entities/archer.json",
    };
    const entity = parseEntityDefinition({
      "minecraft:entity": {
        description: { identifier: "sample:archer" },
        components: {
          "minecraft:loot": { table: "loot_tables/entities/normal.json" },
        },
        component_groups: {
          "sample:ranged_attack": {
            "minecraft:equipment": {
              table: "loot_tables/entities/pillager_gear.json",
            },
          },
          "sample:other": {
            "minecraft:equipment": {
              table: "loot_tables/entities/other.json",
            },
          },
        },
        events: {
          "sample:enable_ranged": {
            add: { component_groups: ["sample:ranged_attack"] },
          },
        },
      },
    }, entitySource);
    const node = (
      id: string, kind: "entity" | "loot_table", source: typeof entitySource,
    ): SemanticNode => ({
      id,
      kind,
      identifier: id,
      identity: { kind, scope: "project", identifier: id },
      source,
    }) as SemanticNode;
    const entityNode = node("entity:archer", "entity", entitySource);
    const normal = node("loot:normal", "loot_table", {
      artifactId,
      relativePath: "behavior_packs/a/loot_tables/entities/normal.json",
    });
    const otherPack = node("loot:foreign-pack", "loot_table", {
      artifactId,
      relativePath: "behavior_packs/b/loot_tables/entities/pillager_gear.json",
    });
    const previousMap = node("loot:foreign-version", "loot_table", {
      artifactId: "previous-artifact",
      relativePath: "behavior_packs/a/loot_tables/entities/pillager_gear.json",
    });
    const groupOther = node("loot:other", "loot_table", {
      artifactId,
      relativePath: "behavior_packs/a/loot_tables/entities/other.json",
    });
    const graph = new SemanticGraph();
    for (const n of [entityNode, normal, otherPack, previousMap, groupOther]) {
      graph.addNode(n);
    }
    populateEntityLootTableEdges(
      graph, [{ node: entityNode, parsed: entity }],
      [entityNode, normal, otherPack, previousMap, groupOther],
    );
    const edges = graph.allEdges();
    expect(edges).toHaveLength(3);
    expect(edges).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "REFERENCES",
        status: "resolved",
        to: normal.id,
        evidence: { source: expect.objectContaining({
          artifactId,
          relativePath: entitySource.relativePath,
          jsonPointer: "/minecraft:entity/components/minecraft:loot/table",
        }) },
      }),
      expect.objectContaining({
        type: "REFERENCES",
        status: "resolved",
        to: groupOther.id,
      }),
      expect.objectContaining({
        type: "REFERENCES",
        status: "unresolved",
        targetIdentifier: "loot_tables/entities/pillager_gear.json",
        evidence: { source: expect.objectContaining({
          jsonPointer:
            "/minecraft:entity/component_groups/sample:ranged_attack/minecraft:equipment/table",
        }) },
      }),
    ]));
    expect(edges.find(edge =>
      edge.targetIdentifier === "loot_tables/entities/pillager_gear.json")?.to
    ).toBeUndefined();
    expect(edges.every(edge => edge.type !== "EXECUTES_EVENT")).toBe(true);
  });

  it("distinguishes authored group activation from publisher-only vanilla table matches", async () => {
    const root = await mkdtemp(join(tmpdir(), "entity-loot-source-route-"));
    const pack = join(root, "behavior_packs/a");
    try {
      await mkdir(join(pack, "entities"), { recursive: true });
      await mkdir(join(pack, "loot_tables/entities"), { recursive: true });
      await writeFile(join(pack, "entities/sentry.json"), JSON.stringify({
        "minecraft:entity": {
          description: { identifier: "demo:sentry" },
          components: { "minecraft:loot": { table: "loot_tables/empty.json" } },
          component_groups: {
            armed: { "minecraft:equipment": { table: "loot_tables/entities/known.json" } },
          },
          events: { "demo:arm": { add: { component_groups: ["armed"] } } },
        },
      }));
      await writeFile(join(pack, "loot_tables/entities/known.json"), JSON.stringify({
        pools: [{ entries: [{ type: "loot_table",
          name: "loot_tables/entities/armor_set_chain.json" }] }],
      }));
      const result = await inspectDirectory(root, "selected-artifact");
      const missing = result.diagnostics.filter(item =>
        item.code === "UNRESOLVED_REFERENCE");
      const empty = missing.find(item =>
        item.message.includes("loot_tables/empty.json"));
      const chain = missing.find(item =>
        item.message.includes("loot_tables/entities/armor_set_chain.json"));
      expect(empty?.data).toMatchObject({
        sourceRoute: {
          rootActivation: { scope: "base", status: "BASE_COMPONENT_DECLARED" },
          publishedVanillaSample: {
            publisher: "Mojang/bedrock-samples",
            proof: "PUBLISHED_SAMPLE_ONLY_VERSION_AND_RUNTIME_UNVERIFIED",
          },
        },
      });
      expect(chain?.data).toMatchObject({
        sourceRoute: {
          classification: "entity-authored-chain",
          rootActivation: { scope: "component-group", groupId: "armed",
            status: "GROUP_ADD_EVENT_DECLARED", sourceEventIds: ["demo:arm"],
            sourceEventPointers: ["/minecraft:entity/events/demo:arm"] },
          publishedVanillaSample: {
            referencePath: "loot_tables/entities/armor_set_chain.json",
          },
        },
      });
      expect(result.unresolvedReferences).toBeGreaterThanOrEqual(2);
      expect(missing.find(item => item.message.includes("armor_set_chain"))?.severity)
        .toBe("medium");
      // Source reference and event syntax do not certify a runtime drop.
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("surfaces the missing packaged equipment reference through the existing inspection diagnostics", async () => {
    const root = await mkdtemp(join(tmpdir(), "entity-loot-ref-"));
    const pack = join(root, "behavior_packs/a");
    try {
      await mkdir(join(pack, "entities"), { recursive: true });
      await mkdir(join(pack, "loot_tables/entities"), { recursive: true });
      await writeFile(join(pack, "entities/archer.json"), JSON.stringify({
        "minecraft:entity": {
          description: { identifier: "sample:ranged" },
          component_groups: {
            "sample:ranged": {
              "minecraft:equipment": {
                table: "loot_tables/entities/missing.json",
              },
            },
          },
          events: { "sample:range": {
            add: { component_groups: ["sample:ranged"] },
          } },
        },
      }));
      await writeFile(join(pack, "loot_tables/entities/present.json"),
        JSON.stringify({ pools: [] }));
      const result = await inspectDirectory(root, "selected-artifact");
      expect(result.diagnostics).toEqual(expect.arrayContaining([
        expect.objectContaining({
          code: "UNRESOLVED_REFERENCE",
          source: expect.objectContaining({
            artifactId: "selected-artifact",
            relativePath: "behavior_packs/a/entities/archer.json",
            jsonPointer:
              "/minecraft:entity/component_groups/sample:ranged/minecraft:equipment/table",
          }),
        }),
      ]));
      expect(result.unresolvedReferences).toBeGreaterThan(0);
      // This is authored file-reference evidence, NOT a proof a mob spawned
      // with bad equipment or that Minecraft executed the source group.
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });


  it("preserves distinct source-labelled stage guides without claiming execution", async () => {
    const root = await mkdtemp(join(tmpdir(), "map-stage-guide-"));
    const path = "resource_packs/example/texts/en_US.lang";
    try {
      await mkdir(join(root, "resource_packs/example/texts"), { recursive: true });
      await writeFile(join(root, path), [
        "demo.stage_1.guide=§lEnter the fortress",
        "demo.stage_2.guide=§lEnter the fortress",
        "demo.stage_2.task.1=Eliminate all enemies",
        "demo.stage_2.task.2=Rescue the villager",
        "demo.stage_2.success=The path is clear",
        "demo.hud.level=Level",
        "demo.hud.wave=Wave",
        "demo.emoji.level_15=§e",
      ].join("\n"));
      const inventory = await buildFilesystemInventory(root);
      const { signals } = await deriveGameplayResourceTextSignals(root, inventory);
      const guides = signals.filter(item =>
        item.subjectKey.startsWith("phase:localized:"));
      expect(guides).toHaveLength(2);
      expect(guides.map(item => item.label)).toEqual([
        "Stage 1: Enter the fortress",
        "Stage 2: Enter the fortress",
      ]);
      expect(guides[0]?.subjectKey).not.toBe(guides[1]?.subjectKey);
      const stageTasks = signals.filter(item =>
        item.subjectKey.startsWith("mechanic:localized:"));
      expect(stageTasks.map(item => item.label)).toEqual([
        "Task 1: Eliminate all enemies",
        "Task 2: Rescue the villager",
        "Success feedback: The path is clear",
      ]);
      expect(stageTasks.every(item =>
        item.status === "inferred" &&
        item.summary.includes("not verified gameplay order"))).toBe(true);
      expect(signals.some(item =>
        item.subjectKey.includes("localized:") &&
        item.locator.endsWith("#L8"))).toBe(false);

      expect(guides.every(item =>
        item.status === "inferred" &&
        item.summary.includes("not verified gameplay order") &&
        item.locator.startsWith(path + "#L"))).toBe(true);
      const model = buildGameplayIntentModel({
        id: "intent:source-stages",
        artifactId: "selected-world",
        parsedScripts: [],
        supplementalSignals: signals,
      });
      const phases = model.nodes.filter(node =>
        node.id.startsWith("phase:localized:"));
      expect(phases).toHaveLength(2);
      const content = model.nodes.filter(node =>
        node.id.startsWith("mechanic:localized:"));
      expect(content).toHaveLength(3);
      expect(content.every(node => node.status === "inferred")).toBe(true);

      expect(phases.every(node => node.status === "inferred")).toBe(true);
      expect(phases.every(node =>
        node.evidenceIds.some(id => model.evidence.some(item =>
          item.id === id && item.scope === "selected-artifact")))).toBe(true);
      // Source key numbers and localized text are not runtime chronology.
      expect(model.edges.some(edge => edge.kind === "transitions-to")).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });


});
