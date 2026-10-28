import {
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  describe,
  expect,
  it,
} from "vitest";
import {
  indexInspectionSources,
} from "../src/inspection/inspect-source-index.js";
import { enrichInspectionSemanticGraph } from "../src/inspection/inspect-graph-enrichment.js";

describe("inspection source index coverage", () => {
  it("does not present a failed structure parse as an indexed graph node", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-invalid-structure-"));
    try {
      await mkdir(join(root, "structures"), { recursive: true });
      await writeFile(join(root, "structures/invalid.mcstructure"), "not an NBT structure");
      const result = await indexInspectionSources(root, "artifact:invalid", [{
        relativePath: "structures/invalid.mcstructure", size: 20,
      }]);
      expect(result.coverage).toMatchObject({ relevantFiles: 1, indexedFiles: 0, complete: false });
      expect(result.coverage.parseFailures.map(item => item.kind)).toContain("structure");
      expect(result.graph.findByKind("structure")).toHaveLength(0);
      expect(result.parsedStructureModels).toHaveLength(0);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("keeps bundled map navigation scoped and non-authoritative", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-map-navigation-"));
    try {
      const path = "behavior_packs/demo/scripts/main.js";
      const mapPath = path + ".map";
      await mkdir(join(root, "behavior_packs/demo/scripts"), { recursive: true });
      await writeFile(join(root, path),
        'import { world } from "@minecraft/server";\n' +
        'world.sendMessage("ready");\n//# sourceMappingURL=main.js.map');
      await writeFile(join(root, mapPath), JSON.stringify({
        version: 3, file: "main.js",
        sources: ["src/main.ts"], names: [], mappings: "AAAA;AAAA",
      }));
      const result = await indexInspectionSources(root, "selected", [
        { relativePath: path, size: 140 },
        { relativePath: mapPath, size: 110 },
      ]);
      expect(result.scriptSourceMapNavigation).toEqual([
        expect.objectContaining({
          generatedPath: path, mapPath, status: "mapped",
          sites: expect.arrayContaining([expect.objectContaining({
            symbol: "world.sendMessage",
            originalLocator: expect.stringContaining("src/main.ts:1:1"),
          })]),
        }),
      ]);
      expect(result.coverage.physicalFiles).toBe(2);
      expect(result.coverage.parseFailures).toHaveLength(0);
      // Archive contents, not the map's 'src/main.ts', remain source proof.
      await writeFile(join(root, path),
        'world.sendMessage("unknown");\n//# sourceMappingURL=../outside.js.map');
      const second = await indexInspectionSources(root, "selected", [
        { relativePath: path, size: 120 },
        { relativePath: mapPath, size: 110 },
      ]);
      expect(second.scriptSourceMapNavigation[0]?.status).toBe("unavailable");
    } finally { await rm(root, { recursive: true, force: true }); }
  });


  it("navigates real-world-shaped esbuild chunks without pretending to have a source map", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-inline-source-hints-"));
    try {
      const path = "behavior_packs/BP/scripts/chunks/chunk-sample.js";
      await mkdir(join(root, "behavior_packs/BP/scripts/chunks"), { recursive: true });
      await writeFile(join(root, path), [
        "// build:production",
        "// packs/BP/scripts/modules/party/PartyService.ts",
        "export function joinParty() { return 1; }",
        "// packs/BP/scripts/../outside.ts",
        "// packs/BP/scripts/modules/ctf_composite/GameManager.ts",
        "export function startGame() { return joinParty(); }",
      ].join("\n"));
      const result = await indexInspectionSources(root, "sample:sha", [
        { relativePath: path, size: 330 },
      ]);
      expect(result.scriptSourceMapNavigation).toEqual([
        expect.objectContaining({
          generatedPath: path,
          status: "unavailable",
          sites: [],
          claimedSourceSections: [
            { generatedLocator: path + ":2", generatedLine: 2,
              claimedOriginalPath: "packs/BP/scripts/modules/party/PartyService.ts" },
            { generatedLocator: path + ":5", generatedLine: 5,
              claimedOriginalPath: "packs/BP/scripts/modules/ctf_composite/GameManager.ts" },
          ],
          omittedSourceSections: 0,
        }),
      ]);
      expect(result.coverage.parseFailures).toHaveLength(0);
      expect(result.coverage.indexedFiles).toBe(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("preserves 147 claimed sections of a modular world in indexed source navigation", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-large-bundle-hints-"));
    try {
      const path = "behavior_packs/BP/scripts/chunks/chunk-heavy.js";
      await mkdir(join(root, "behavior_packs/BP/scripts/chunks"), { recursive: true });
      const content = Array.from({ length: 147 }, (_, index) => [
        "// packs/BP/scripts/modules/generated/module_" + index + ".ts",
        "var module_" + index + " = " + index + ";",
      ].join("\n")).join("\n");
      await writeFile(join(root, path), content);
      const result = await indexInspectionSources(root, "artifact:bundle", [
        { relativePath: path, size: Buffer.byteLength(content) },
      ]);
      expect(result.coverage.parseFailures).toHaveLength(0);
      expect(result.scriptSourceMapNavigation).toEqual([
        expect.objectContaining({
          generatedPath: path,
          status: "unavailable",
          claimedSourceSections: expect.arrayContaining([
            { generatedLocator: path + ":279", generatedLine: 279,
              claimedOriginalPath: "packs/BP/scripts/modules/generated/module_139.ts" },
          ]),
          omittedSourceSections: 0,
        }),
      ]);
      expect(result.scriptSourceMapNavigation[0]?.claimedSourceSections).toHaveLength(147);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("accounts for inventoried but unreadable function and script without false nodes", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-missing-sources-"));
    try {
      const result = await indexInspectionSources(root, "artifact:missing", [
        { relativePath: "functions/missing.mcfunction", size: 12 },
        { relativePath: "scripts/missing.js", size: 12 },
      ]);
      expect(result.coverage).toMatchObject({ relevantFiles: 2, indexedFiles: 0, complete: false });
      expect(result.coverage.parseFailures.map(x => x.kind).sort()).toEqual(["function", "script"]);
      expect(result.parsedFunctions).toHaveLength(0);
      expect(result.parsedScripts).toHaveLength(0);
      expect(result.graph.findByKind("function")).toHaveLength(0);
      expect(result.graph.findByKind("script_file")).toHaveLength(0);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("keeps one ordered outcome per relevant source without conflating parser and semantic coverage", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-source-outcomes-"));
    try {
      const paths = [
        "functions/ready.mcfunction",
        "behavior_packs/a/loot_tables/reward.json",
        "behavior_packs/a/features/unknown.json",
      ];
      for (const path of paths) await mkdir(join(root, path.slice(0, path.lastIndexOf("/"))), { recursive: true });
      await writeFile(join(root, paths[0]!), "say ready");
      await writeFile(join(root, paths[1]!), JSON.stringify({ pools: [] }));
      await writeFile(join(root, paths[2]!), JSON.stringify({ custom: true }));
      const index = await indexInspectionSources(root, "artifact:outcomes",
        paths.map(relativePath => ({ relativePath, size: 20 })));
      expect(index.coverage.fileOutcomes).toEqual([
        { relativePath: paths[2], status: "unsupported" },
        { relativePath: paths[1], status: "semantic-gap" },
        { relativePath: paths[0], status: "indexed" },
      ]);
      expect(index.coverage.fileOutcomes).toHaveLength(index.coverage.relevantFiles);
      expect(index.coverage.physicalFiles).toBe(paths.length);
      expect(index.coverage.physicalInventoryAccounted).toBe(true);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("keeps loot tables under entities/ out of the entity parser without hiding source gaps", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-loot-owner-"));
    const paths = [
      "behavior_packs/a/loot_tables/entities/zombie.json",
      "behavior_packs/a/entities/real.json",
      "entities/standalone.json",
    ];
    try {
      for (const path of paths) {
        await mkdir(join(root, path.slice(0, path.lastIndexOf("/"))), { recursive: true });
        await writeFile(join(root, path), path.includes("loot_tables")
          ? JSON.stringify({ pools: [] })
          : JSON.stringify({ "minecraft:entity": {
              description: { identifier: path.includes("standalone")
                ? "test:standalone" : "test:real" },
            } }));
      }
      const index = await indexInspectionSources(root, "artifact:loot-entity",
        paths.map(relativePath => ({ relativePath, size: 100 })));
      expect(index.coverage.parseFailures).toHaveLength(0);
      expect(index.coverage.fileOutcomes).toEqual([
        { relativePath: paths[1], status: "indexed" },
        { relativePath: paths[0], status: "semantic-gap" },
        { relativePath: paths[2], status: "indexed" },
      ]);
      expect(index.parsedEntities.map(item => item.parsed.identifier).sort())
        .toEqual(["test:real", "test:standalone"]);
      // Source indexing is complete; semantic-gap is a separate A2 blocker.
      expect(index.coverage.complete).toBe(true);
      expect(index.coverage.semanticUnderstandingGaps).toEqual([paths[0]]);
      expect(index.coverage.physicalInventoryAccounted).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("marks recognized source coverage incomplete when a relevant entity cannot be parsed", async () => {
    const root = await mkdtemp(
      join(tmpdir(), "m-bedrock-index-"),
    );

    try {
      await mkdir(join(root, "functions"), {
        recursive: true,
      });
      await mkdir(join(root, "entities"), {
        recursive: true,
      });

      await writeFile(
        join(root, "functions", "start.mcfunction"),
        "say hello\n",
        "utf8",
      );
      await writeFile(
        join(root, "entities", "broken.json"),
        "{ broken",
        "utf8",
      );

      const result =
        await indexInspectionSources(
          root,
          "artifact:test",
          [{
            relativePath:
              "functions/start.mcfunction",
            size: 10,
            contentHash: "fn",
          }, {
            relativePath:
              "entities/broken.json",
            size: 8,
            contentHash: "entity",
          }],
        );

      expect(result.coverage).toMatchObject({
        relevantFiles: 2,
        indexedFiles: 1,
        complete: false,
      });
      expect(
        result.coverage.parseFailures,
      ).toHaveLength(1);
      expect(
        result.coverage.parseFailures[0],
      ).toMatchObject({
        relativePath: "entities/broken.json",
        kind: "entity",
      });
    } finally {
      await rm(root, {
        recursive: true,
        force: true,
      });
    }
  });

  it("includes dialogue and localized text in discovery coverage", async () => {
    const root = await mkdtemp(
      join(tmpdir(), "m-bedrock-index-"),
    );

    try {
      await mkdir(join(root, "dialogue"), {
        recursive: true,
      });
      await mkdir(join(root, "texts"), {
        recursive: true,
      });

      await writeFile(
        join(root, "dialogue", "npc.json"),
        JSON.stringify({
          format_version: "1.17",
          "minecraft:npc_dialogue": {
            scenes: [{
              scene_tag: "entry",
              npc_name: "Guide",
              text: "Start the match",
            }],
          },
        }),
        "utf8",
      );
      await writeFile(
        join(root, "texts", "en_US.lang"),
        "ui.start=Start Match\n",
        "utf8",
      );

      const result =
        await indexInspectionSources(
          root,
          "artifact:test",
          [{
            relativePath: "dialogue/npc.json",
            size: 100,
            contentHash: "dialogue",
          }, {
            relativePath: "texts/en_US.lang",
            size: 20,
            contentHash: "lang",
          }],
        );

      expect(result.coverage).toMatchObject({
        physicalFiles: 2,
        physicalInventoryAccounted: true,
        relevantFiles: 2,
        indexedFiles: 2,
        parseFailures: [],
        unsupportedRelevantFiles: [],
        semanticUnderstandingGaps: [],
        complete: true,
      });
      expect(
        result.parsedDialogueDocuments,
      ).toHaveLength(1);
    } finally {
      await rm(root, {
        recursive: true,
        force: true,
      });
    }
  });

  it("marks malformed dialogue as a discovery coverage failure", async () => {
    const root = await mkdtemp(
      join(tmpdir(), "m-bedrock-index-"),
    );

    try {
      await mkdir(join(root, "dialogue"), {
        recursive: true,
      });
      await writeFile(
        join(root, "dialogue", "broken.json"),
        "{ broken",
        "utf8",
      );

      const result =
        await indexInspectionSources(
          root,
          "artifact:test",
          [{
            relativePath:
              "dialogue/broken.json",
            size: 8,
            contentHash: "broken",
          }],
        );

      expect(result.coverage.complete).toBe(false);
      expect(
        result.coverage.parseFailures[0],
      ).toMatchObject({
        relativePath:
          "dialogue/broken.json",
        kind: "dialogue",
      });
    } finally {
      await rm(root, {
        recursive: true,
        force: true,
      });
    }
  });

  it("indexes owned gameplay JSON definitions", async () => {
    const root = await mkdtemp(
      join(tmpdir(), "m-bedrock-index-"),
    );

    try {
      await mkdir(join(root, "loot_tables"), {
        recursive: true,
      });
      await mkdir(
        join(root, "behavior_packs", "bp", "items"),
        { recursive: true },
      );
      await mkdir(join(root, "recipes"), {
        recursive: true,
      });
      await writeFile(
        join(root, "loot_tables", "reward.json"),
        JSON.stringify({ pools: [] }),
        "utf8",
      );
      await writeFile(
        join(
          root,
          "behavior_packs",
          "bp",
          "items",
          "ready.json",
        ),
        JSON.stringify({
          format_version: "1.21.0",
          "minecraft:item": {
            description: {
              identifier: "test:ready",
            },
          },
        }),
        "utf8",
      );
      await writeFile(
        join(root, "recipes", "stick.json"),
        JSON.stringify({
          "minecraft:recipe_shaped": {
            description: {
              identifier: "test:stick",
            },
          },
        }),
        "utf8",
      );

      const files = [
        "loot_tables/reward.json",
        "behavior_packs/bp/items/ready.json",
        "recipes/stick.json",
      ].map((relativePath) => ({
        relativePath,
        size: 16,
        contentHash: relativePath,
      }));

      const result =
        await indexInspectionSources(
          root,
          "artifact:test",
          files,
        );

      expect(result.coverage).toMatchObject({
        relevantFiles: 3,
        indexedFiles: 3,
        complete: true,
      });
      expect(
        result.nodes.map((node) => node.kind),
      ).toEqual(
        expect.arrayContaining([
          "loot_table",
          "item",
          "recipe",
        ]),
      );
      expect(
        result.coverage.unsupportedRelevantFiles,
      ).toEqual([]);
      expect(
        result.coverage.semanticUnderstandingGaps,
      ).toEqual(files.map((item) => item.relativePath).sort());
    } finally {
      await rm(root, {
        recursive: true,
        force: true,
      });
    }
  });

  it("keeps gameplay JSON without a semantic owner as explicit residue", async () => {
    const root = await mkdtemp(
      join(tmpdir(), "m-bedrock-index-"),
    );

    try {
      await mkdir(join(root, "feature_rules"), {
        recursive: true,
      });
      await writeFile(
        join(root, "feature_rules", "ore.json"),
        JSON.stringify({}),
        "utf8",
      );

      const result =
        await indexInspectionSources(
          root,
          "artifact:test",
          [{
            relativePath:
              "feature_rules/ore.json",
            size: 2,
            contentHash: "feature",
          }],
        );

      expect(result.coverage).toMatchObject({
        relevantFiles: 1,
        indexedFiles: 0,
        complete: false,
      });
      expect(
        result.coverage.unsupportedRelevantFiles,
      ).toEqual([
        "feature_rules/ore.json",
      ]);
    } finally {
      await rm(root, {
        recursive: true,
        force: true,
      });
    }
  });

  it("does not classify resource-pack client item JSON as gameplay residue", async () => {
    const root = await mkdtemp(
      join(tmpdir(), "m-bedrock-index-"),
    );

    try {
      await mkdir(
        join(root, "resource_packs", "visual", "items"),
        { recursive: true },
      );
      await writeFile(
        join(
          root,
          "resource_packs",
          "visual",
          "items",
          "client.json",
        ),
        JSON.stringify({}),
        "utf8",
      );

      const result =
        await indexInspectionSources(
          root,
          "artifact:test",
          [{
            relativePath:
              "resource_packs/visual/items/client.json",
            size: 2,
            contentHash: "client-item",
          }],
        );

      expect(
        result.coverage.unsupportedRelevantFiles,
      ).toEqual([]);
    } finally {
      await rm(root, {
        recursive: true,
        force: true,
      });
    }
  });

  it("reports complete coverage for fully indexed recognized sources", async () => {
    const root = await mkdtemp(
      join(tmpdir(), "m-bedrock-index-"),
    );

    try {
      await mkdir(join(root, "functions"), {
        recursive: true,
      });
      await writeFile(
        join(root, "functions", "start.mcfunction"),
        "say hello\n",
        "utf8",
      );

      const result =
        await indexInspectionSources(
          root,
          "artifact:test",
          [{
            relativePath:
              "functions/start.mcfunction",
            size: 10,
            contentHash: "fn",
          }],
        );

      expect(result.coverage).toMatchObject({
        physicalFiles: 1,
        physicalInventoryAccounted: true,
        relevantFiles: 1,
        indexedFiles: 1,
        parseFailures: [],
        unsupportedRelevantFiles: [],
        semanticUnderstandingGaps: [],
        complete: true,
      });
      expect(result.coverage.fileOutcomes).toEqual([
        { relativePath: "functions/start.mcfunction", status: "indexed" },
      ]);
    } finally {
      await rm(root, {
        recursive: true,
        force: true,
      });
    }
  });

  it("keeps malformed owned gameplay JSON as a parse failure, not indexed evidence", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-index-"));
    try {
      await mkdir(join(root, "behavior_packs", "bp", "items"), {
        recursive: true,
      });
      const relativePath = "behavior_packs/bp/items/broken.json";
      await writeFile(join(root, relativePath), "{ broken", "utf8");
      const result = await indexInspectionSources(root, "artifact:test", [{
        relativePath, size: 8, contentHash: "broken-item",
      }]);
      expect(result.coverage.relevantFiles).toBe(1);
      expect(result.coverage.indexedFiles).toBe(0);
      expect(result.coverage.complete).toBe(false);
      expect(result.coverage.parseFailures[0]).toMatchObject({
        relativePath, kind: "item",
      });
      expect(result.coverage.semanticUnderstandingGaps).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("does not treat resource-pack loot tables as behavior-pack gameplay", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-index-"));
    try {
      const relativePath = "resource_packs/visual/loot_tables/visual.json";
      await mkdir(join(root, "resource_packs", "visual", "loot_tables"), {
        recursive: true,
      });
      await writeFile(join(root, relativePath), JSON.stringify({ pools: [] }), "utf8");
      const result = await indexInspectionSources(root, "artifact:test", [{
        relativePath, size: 16, contentHash: "visual-only",
      }]);
      expect(result.coverage.relevantFiles).toBe(0);
      expect(result.coverage.unsupportedRelevantFiles).toEqual([]);
      expect(result.nodes).toHaveLength(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("conserves unfamiliar behavior-pack JSON as an unsupported gameplay candidate", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-index-"));
    try {
      const relativePath = "behavior_packs/novel_bp/experimental_mechanic/device.json";
      await mkdir(join(root, "behavior_packs/novel_bp/experimental_mechanic"), { recursive: true });
      await writeFile(join(root, relativePath), JSON.stringify({ custom: { activation: "event" } }));
      const result = await indexInspectionSources(root, "artifact:test", [
        { relativePath, size: 34, contentHash: "novel" },
      ]);
      expect(result.coverage).toMatchObject({
        relevantFiles: 1,
        indexedFiles: 0,
        complete: false,
        unsupportedRelevantFiles: [relativePath],
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("accounts for vanilla tick registration without inventing a mechanic", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-index-"));
    const relativePath = "behavior_packs/bp/functions/tick.json";
    try {
      await mkdir(join(root, "behavior_packs/bp/functions"), { recursive: true });
      const file = { relativePath, size: 20, contentHash: "tick" };
      await writeFile(join(root, relativePath), '{"values":[]}');
      const empty = await indexInspectionSources(root, "artifact:test", [file]);
      expect(empty.coverage).toMatchObject({
        relevantFiles: 1, indexedFiles: 1, complete: true,
        unsupportedRelevantFiles: [],
      });
      await writeFile(join(root, relativePath), '{"values":["start"]}');
      const active = await indexInspectionSources(root, "artifact:test", [file]);
      expect(active.coverage).toMatchObject({
        relevantFiles: 1, indexedFiles: 1, complete: true,
        unsupportedRelevantFiles: [],
      });
      expect(active.tickFunctionRegistrations).toEqual([{
        source: { artifactId: "artifact:test", relativePath },
        functions: ["start"],
      }]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it("keeps identical script module names distinct by pack source", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-script-packs-"));
    try {
      const paths = [
        "behavior_packs/a/scripts/main.js",
        "behavior_packs/b/scripts/main.js",
        "behavior_packs/a/scripts/util.js",
      ];
      for (const path of paths) {
        await mkdir(join(root, path.substring(0, path.lastIndexOf("/"))), { recursive: true });
        await writeFile(join(root, path), path.endsWith("main.js")
          ? 'import "./util.js";' : 'export const value = 1;');
      }
      const index = await indexInspectionSources(root, "artifact:script-packs",
        paths.map(relativePath => ({ relativePath, size: 32, contentHash: relativePath })));
      expect(index.parsedScripts).toHaveLength(3);
      expect(new Set(index.parsedScripts.map(item => item.node.id)).size).toBe(3);
      expect(index.coverage.complete).toBe(true);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("preserves distinct source nodes when behavior packs share one function identifier", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-same-function-"));
    try {
      const paths = [
        "behavior_packs/a/functions/start.mcfunction",
        "behavior_packs/b/functions/start.mcfunction",
        "behavior_packs/a/functions/tick.json",
      ];
      for (const path of paths) {
        await mkdir(join(root, path.substring(0, path.lastIndexOf("/"))), { recursive: true });
        await writeFile(join(root, path), path.endsWith(".json") ? '{"values":["start"]}' : "say ready\\n");
      }
      const index = await indexInspectionSources(root, "artifact:duplicate", paths.map(relativePath => ({
        relativePath, size: 32, contentHash: relativePath,
      })));
      expect(index.parsedFunctions).toHaveLength(2);
      expect(new Set(index.parsedFunctions.map(item => item.node.id)).size).toBe(2);
      enrichInspectionSemanticGraph({
        graph: index.graph, nodes: index.nodes, artifactId: "artifact:duplicate",
        parsedFunctions: index.parsedFunctions,
        parsedDialogueDocuments: index.parsedDialogueDocuments,
        parsedStructureModels: index.parsedStructureModels,
        tickFunctionRegistrations: index.tickFunctionRegistrations,
      });
      const scheduler = index.graph.findByKind("world").find(node => node.identifier.startsWith("function-schedule:tick:"))!;
      const edge = index.graph.outgoingEdges(scheduler.id, "CALLS")[0]!;
      expect(edge.status).toBe("ambiguous");
      expect(edge.candidates).toHaveLength(2);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("preserves authored tick registration order and repeated entries", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-tick-order-"));
    try {
      const relativePath = "behavior_packs/a/functions/tick.json";
      await mkdir(join(root, "behavior_packs/a/functions"), { recursive: true });
      await writeFile(join(root, relativePath),
        JSON.stringify({ values: ["init", "update", "init"] }));
      const result = await indexInspectionSources(root, "artifact:order", [{
        relativePath, size: 64, contentHash: "tick-order",
      }]);
      expect(result.tickFunctionRegistrations[0]?.functions).toEqual([
        "init", "update", "init",
      ]);
      expect(result.coverage.complete).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps repeated tick entries separately identifiable in Semantic Graph", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-tick-duplicates-"));
    try {
      const paths = [
        "behavior_packs/a/functions/tick.json",
        "behavior_packs/a/functions/start.mcfunction",
      ];
      await mkdir(join(root, "behavior_packs/a/functions"), { recursive: true });
      await writeFile(join(root, paths[0]!), JSON.stringify({ values: ["start", "start"] }));
      await writeFile(join(root, paths[1]!), "say ready\n");
      const index = await indexInspectionSources(root, "artifact:tick-repeat",
        paths.map(relativePath => ({ relativePath, size: 32, contentHash: relativePath })));
      enrichInspectionSemanticGraph({
        graph: index.graph, nodes: index.nodes, artifactId: "artifact:tick-repeat",
        parsedFunctions: index.parsedFunctions, parsedDialogueDocuments: index.parsedDialogueDocuments,
        parsedStructureModels: index.parsedStructureModels,
        tickFunctionRegistrations: index.tickFunctionRegistrations,
      });
      const scheduler = index.graph.findByKind("world")
        .find(node => node.identifier.startsWith("function-schedule:tick:"))!;
      const edges = index.graph.outgoingEdges(scheduler.id, "CALLS");
      expect(edges).toHaveLength(2);
      expect(edges.map(edge => edge.evidence.source.jsonPointer).sort()).toEqual([
        "/values/0", "/values/1",
      ]);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("keeps two tick registrations distinct and preserves unresolved function roots", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-tick-"));
    try {
      const paths = [
        "behavior_packs/a/functions/tick.json",
        "behavior_packs/b/functions/tick.json",
        "behavior_packs/a/functions/start.mcfunction",
      ];
      for (const path of paths) {
        await mkdir(join(root, path.substring(0, path.lastIndexOf("/"))), { recursive: true });
      }
      await writeFile(join(root, paths[0]!), JSON.stringify({ values: ["start"] }));
      await writeFile(join(root, paths[1]!), JSON.stringify({ values: ["missing"] }));
      await writeFile(join(root, paths[2]!), "say ready\\n");
      const index = await indexInspectionSources(root, "artifact:two-packs",
        paths.map((relativePath) => ({
          relativePath, size: 32, contentHash: relativePath,
        })),
      );
      expect(index.coverage.complete).toBe(true);
      expect(index.tickFunctionRegistrations).toHaveLength(2);
      enrichInspectionSemanticGraph({
        graph: index.graph,
        nodes: index.nodes,
        artifactId: "artifact:two-packs",
        parsedFunctions: index.parsedFunctions,
        parsedDialogueDocuments: index.parsedDialogueDocuments,
        parsedStructureModels: index.parsedStructureModels,
        tickFunctionRegistrations: index.tickFunctionRegistrations,
      });
      const schedules = index.graph.findByKind("world")
        .filter((node) => node.identifier.startsWith("function-schedule:tick:"));
      expect(schedules).toHaveLength(2);
      const edges = schedules.flatMap((node) => index.graph.outgoingEdges(node.id, "CALLS"));
      expect(edges).toHaveLength(2);
      expect(edges.map((edge) => [edge.targetIdentifier, edge.status]).sort()).toEqual([
        ["missing", "unresolved"],
        ["start", "resolved"],
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

});
