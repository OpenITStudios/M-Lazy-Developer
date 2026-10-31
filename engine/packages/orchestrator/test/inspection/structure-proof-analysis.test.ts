// Source-preserving same-owner, same-feature, same-lane suite.
import { describe, expect, it } from "vitest";
import { parseMcFunction } from "../../../../analyzers/functions/src/index.js";
import { analyzeStructureAndChunkRuntime } from "../../src/structure-runtime-analysis.js";
import { derivePlacementProofs } from "../../src/inspection/structure-proof-analysis.js";
import { assessStructureTransitionResidue } from "../../src/inspection/structure-transition-residue.js";
import type { McStructureModel } from "../../../../adapters/mcstructure/src/types.js";
import { SemanticGraph } from "../../../graph/src/index.js";
import type { SemanticNode } from "../../../graph/src/index.js";
import { analyzeEmbeddedStructureCommands } from "../../src/embedded-structure-commands.js";
import { populateEmbeddedStructureCommandGraph } from "../../src/inspection/embedded-structure-graph.js";
import { correlateEmbeddedCommandsWithNativeChunks } from "../../src/inspection/embedded-native-correlation.js";
import { structureIdentifier } from "../../src/inspection/inspect-identifiers.js";
import { derivePlacedEmbeddedCommands } from "../../src/inspection/structure-placement-analysis.js";
import type { KnowledgeCatalog } from "../../../knowledge/src/index.js";
import { parseScriptFile } from "../../../../analyzers/scripts/src/index.js";
import { correlateScriptStructureLoads } from "../../src/inspection/script-structure-correlation.js";
import { scriptStructureRuntimeEvidence } from "../../src/inspection/script-structure-correlation.js";
import { analyzeKnowledgeRuntime } from "../../src/knowledge-runtime-analysis.js";
import { structureRuntimeEvidence } from "../../src/inspection/structure-runtime-evidence.js";

// Original suite: engine/packages/orchestrator/test/inspection/structure-proof-analysis.test.ts (blob e12ba811a4741451628b7ab18f0b0c5008e05b3a)
{
const structure = {
  identifier: "demo:arena",
  relativePath: "structures/demo/arena.mcstructure",
  size: { x: 16, y: 8, z: 32 },
  semantics: {
    entityCount: 0,
    hasEntities: false,
    paletteSize: 1,
    hasBlockPositionData: false,
    commandBlockPaletteEntries: 0,
    containerPaletteEntries: 0,
    embeddedCommandBlocks: 0,
    queuedTickPositions: 0,
    educationAllowEntries: 0,
    educationDenyEntries: 0,
    educationBorderEntries: 0,
  },
};

describe("structure placement proofs", () => {
  it("accepts a gated sentinel inside rotated placement bounds", () => {
    const fn = parseMcFunction(
      "demo:load",
      [
        "structure load demo:arena 100 64 200 90_degrees",
        "execute if block 100 64 200 minecraft:gold_block run function demo:start",
      ].join("\n"),
      { artifactId: "a", relativePath: "functions/load.mcfunction" },
    );

    const runtime = analyzeStructureAndChunkRuntime([fn], [structure]);
    const proofs = derivePlacementProofs(runtime, [fn]);

    expect(proofs.postPlacementVerifications).toHaveLength(1);
    expect(proofs.postPlacementVerifications[0]?.verificationLine).toBe(2);
  });

  it("does not accept an ungated sentinel as readiness proof", () => {
    const fn = parseMcFunction(
      "demo:load",
      [
        "structure load demo:arena 100 64 200",
        "testforblock 101 64 201 minecraft:gold_block",
      ].join("\n"),
      { artifactId: "a", relativePath: "functions/load.mcfunction" },
    );

    const runtime = analyzeStructureAndChunkRuntime([fn], [structure]);
    const proofs = derivePlacementProofs(runtime, [fn]);

    expect(proofs.postPlacementVerifications).toEqual([]);
  });

  it("proves area-loaded coverage only when the scheduled area covers all placement chunks", () => {
    const scheduler = parseMcFunction(
      "demo:schedule",
      "schedule on_area_loaded add 96 0 192 143 255 239 demo:load",
      { artifactId: "a", relativePath: "functions/schedule.mcfunction" },
    );
    const loader = parseMcFunction(
      "demo:load",
      "structure load demo:arena 100 64 200",
      { artifactId: "a", relativePath: "functions/load.mcfunction" },
    );

    const runtime = analyzeStructureAndChunkRuntime([scheduler, loader], [structure]);
    const proofs = derivePlacementProofs(runtime, [scheduler, loader]);

    expect(proofs.areaLoadedCoverage).toHaveLength(1);
    expect(proofs.areaLoadedCoverage[0]?.functionId).toBe("demo:load");
  });
});

// Verify the same canonical X→Y→Z flat-index contract used for
// embedded command blocks and footprint projection, not another axis order.
describe("structure transition residue sampling", () => {
  it("locates structure_void cells at canonical non-cubic coordinates", () => {
    const indices = Array.from({ length: 12 }, () => -1);
    for (const flatIndex of [1, 3, 6]) indices[flatIndex] = 0;
    const source = {
      size: { x: 2, y: 2, z: 3 },
      palette: [{ index: 0, name: "minecraft:structure_void", raw: {} }],
      blockIndexLayers: [{ layer: 0, indices }],
      entities: [],
      rawSimplified: {},
      nbt: {} as McStructureModel["nbt"],
    } satisfies McStructureModel;

    const result = assessStructureTransitionResidue(source);
    expect(result.status).toBe("residue-risk");
    expect(result.voidCellCount).toBe(3);
    expect(result.samples).toEqual([
      { x: 0, y: 0, z: 1, layer: 0 },
      { x: 0, y: 1, z: 0, layer: 0 },
      { x: 1, y: 0, z: 0, layer: 0 },
    ]);
  });
});
}

// Original suite: engine/packages/orchestrator/test/inspection/embedded-structure-graph.test.ts (blob ee3beb5a5fff67b5e2fcc63f30c565797a71c757)
{
const source = {
  artifactId: "fixture",
  relativePath: "structures/demo/arena.mcstructure",
};

describe("structure command evidence across inspection stages", () => {
  it("connects embedded commands to their function, world position, and matching native chunk only", () => {
    const target = structureIdentifier("behavior_packs/demo/" + source.relativePath);
    expect(target).toBe("demo:arena");

    const graph = new SemanticGraph();
    const structureNode: SemanticNode = {
      id: "structure:project:demo:arena",
      identity: { kind: "structure", scope: "project", identifier: "demo:arena" },
      kind: "structure",
      identifier: target!,
      source,
    };
    const functionNode: SemanticNode = {
      id: "function:project:demo:start",
      identity: { kind: "function", scope: "project", identifier: "demo:start" },
      kind: "function",
      identifier: "demo:start",
      source: { artifactId: "fixture", relativePath: "functions/start.mcfunction" },
    };
    graph.addNode(structureNode);
    graph.addNode(functionNode);

    const blocks = [{
      flatIndex: 2,
      coordinate: { x: 1, y: 0, z: 1 },
      command: "function demo:start",
      auto: true,
    }];
    const analyses = analyzeEmbeddedStructureCommands(blocks, source);
    expect(analyses[0]?.effects).toEqual([
      expect.objectContaining({ kind: "function-call", target: "demo:start" }),
    ]);
    expect(analyses[0]?.unknownEffects).toBe(0);

    const commands = populateEmbeddedStructureCommandGraph(
      graph, structureNode, target!, analyses, [structureNode, functionNode],
    );
    expect(commands).toHaveLength(1);
    expect(graph.dependenciesOf(commands[0]!.id).map((item) => item.id))
      .toContain(functionNode.id);
    expect(graph.dependenciesOf(structureNode.id).map((item) => item.id))
      .toContain(commands[0]!.id);

    const placed = derivePlacedEmbeddedCommands({
      position: {
        x: { mode: "absolute", value: 32 },
        y: { mode: "absolute", value: 70 },
        z: { mode: "absolute", value: -2 },
      },
      rotation: "0_degrees",
      mirror: "none",
    }, { x: 2, y: 2, z: 2 }, blocks);
    expect(placed).toHaveLength(1);
    expect(placed[0]).toMatchObject({
      world: { x: 33, y: 70, z: -1 },
      confidence: "inferred-transform",
    });

    const placement = placed[0]!;
    const native = correlateEmbeddedCommandsWithNativeChunks([{
      target: target!,
      flatIndex: placement.flatIndex,
      worldX: placement.world.x,
      worldY: placement.world.y,
      worldZ: placement.world.z,
      chunkX: Math.floor(placement.world.x / 16),
      chunkZ: Math.floor(placement.world.z / 16),
      command: placement.command,
      confidence: placement.confidence,
    }], [{
      dimensionId: 0,
      chunkX: 2,
      chunkZ: -1,
      kinds: ["BlockEntity", "PendingTicks"],
    }, {
      dimensionId: 0,
      chunkX: 3,
      chunkZ: -1,
      kinds: ["RandomTicks"],
    }]);

    expect(native[0]?.matches).toHaveLength(1);
    expect(native[0]?.matches[0]).toMatchObject({
      hasBlockEntityEvidence: true,
      hasPendingTickEvidence: true,
      hasRandomTickEvidence: false,
    });
  });

  it("preserves nested names and does not invent namespaces for root structures", () => {
    expect(structureIdentifier("behavior_packs/demo/structures/demo/test.mcstructure"))
      .toBe("demo:test");
    expect(structureIdentifier("behavior_packs/demo/structures/demo/rooms/test.mcstructure"))
      .toBe("demo:rooms/test");
    expect(structureIdentifier("behavior_packs/demo/structures/test.mcstructure"))
      .toBe("test");
  });
});
}

// Original suite: engine/packages/orchestrator/test/inspection/script-structure-correlation.test.ts (blob 04f5bd370f74d4690dfba955eed0ade70b9823b3)
{
// Source-preserving family consolidation: original suites and assertions retained in separate lexical scopes.

// Original suite engine/packages/orchestrator/test/inspection/script-structure-correlation.test.ts, blob fab6fd2d4e3f3a1d59e497ac19e2caae1e03d7eb
{






const source = { artifactId: "a", relativePath: "scripts/main.ts" };

const structure = {
  identifier: "demo:arena",
  relativePath: "structures/demo/arena.mcstructure",
  size: { x: 16, y: 8, z: 16 },
  semantics: {
    entityCount: 0,
    hasEntities: false,
    paletteSize: 1,
    hasBlockPositionData: false,
    commandBlockPaletteEntries: 0,
    containerPaletteEntries: 0,
    embeddedCommandBlocks: 0,
    queuedTickPositions: 0,
    educationAllowEntries: 0,
    educationDenyEntries: 0,
    educationBorderEntries: 0,
  },
};

const catalog: KnowledgeCatalog = {
  schemaVersion: 1,
  sources: [{
    id: "official",
    title: "Official",
    url: "https://learn.microsoft.com/example",
    authority: "official",
    confidence: "documented",
    retrievedDate: "2026-09-24",
  }],
  facts: [],
  relations: [{
    id: "placement-needs-target",
    domain: "world-mutation",
    subject: "structure-placement-request",
    kind: "requires",
    object: "structure-target-resolved",
    classification: "derived-rule",
    applicability: { editions: ["bedrock"] },
    sourceIds: ["official"],
    diagnosticSeverity: "critical",
  }],
};

function script() {
  return parseScriptFile(
    "scripts/main",
    `
      import { world } from "@minecraft/server";
      const dimension = world.getDimension("overworld");
      dimension.runCommand("structure load demo:arena 0 64 0");
    `,
    source,
  );
}

describe("script structure load correlation", () => {
  it("satisfies structure target resolution when inventory contains one exact match", () => {
    const parsed = script();
    const correlations = correlateScriptStructureLoads(
      [parsed],
      [structure],
    );
    expect(correlations).toEqual([
      expect.objectContaining({
        target: "demo:arena",
        status: "resolved",
      }),
    ]);

    const result = analyzeKnowledgeRuntime(
      catalog,
      { edition: "bedrock" },
      [],
      [],
      scriptStructureRuntimeEvidence(correlations),
      [parsed],
    );

    expect(result.violations).toBe(0);
    expect(result.evidenceGaps).toBe(0);
  });

  it("turns a definitely missing Script structure target into a critical violation", () => {
    const parsed = script();
    const correlations = correlateScriptStructureLoads([parsed], []);
    expect(correlations[0]?.status).toBe("missing");

    const result = analyzeKnowledgeRuntime(
      catalog,
      { edition: "bedrock" },
      [],
      [],
      scriptStructureRuntimeEvidence(correlations),
      [parsed],
    );

    expect(result.violations).toBe(1);
    expect(result.diagnostics[0]?.severity).toBe("critical");
    expect(result.diagnostics[0]?.source?.relativePath).toBe("scripts/main.ts");
  });
});

}

// Original suite engine/packages/orchestrator/test/inspection/structure-runtime-evidence.test.ts, blob 5b43f8d943a8a3f8245186127d5b7bd4e14163fa
{







const catalog: KnowledgeCatalog = {
  schemaVersion: 1,
  sources: [{
    id: "official",
    title: "Official",
    url: "https://learn.microsoft.com/example",
    authority: "official",
    confidence: "documented",
    retrievedDate: "2026-09-24",
  }],
  facts: [],
  relations: [{
    id: "placement-needs-target",
    domain: "world-mutation",
    subject: "structure-placement-request",
    kind: "requires",
    object: "structure-target-resolved",
    classification: "derived-rule",
    applicability: { editions: ["bedrock"] },
    sourceIds: ["official"],
  }],
};

const semantics = {
  entityCount: 0,
  hasEntities: false,
  paletteSize: 1,
  hasBlockPositionData: false,
  commandBlockPaletteEntries: 0,
  containerPaletteEntries: 0,
  embeddedCommandBlocks: 0,
  queuedTickPositions: 0,
  educationAllowEntries: 0,
  educationDenyEntries: 0,
  educationBorderEntries: 0,
};

function fixture() {
  return parseMcFunction(
    "demo/start",
    "structure load demo:arena 0 64 0",
    { artifactId: "fixture", relativePath: "functions/start.mcfunction" },
  );
}

describe("structure runtime evidence", () => {
  it("satisfies resolved structure target evidence in the same operation scope", () => {
    const fn = fixture();
    const analysis = analyzeStructureAndChunkRuntime([fn], [{
      identifier: "demo:arena",
      relativePath: "structures/demo/arena.mcstructure",
      semantics,
    }]);
    const evidence = structureRuntimeEvidence(
      analysis,
      new Map([[fn.identifier, fn.source]]),
    );
    const result = analyzeKnowledgeRuntime(
      catalog,
      { edition: "bedrock" },
      [],
      [fn],
      evidence,
    );

    expect(result.violations).toBe(0);
    expect(result.evidenceGaps).toBe(0);
  });

  it("turns a missing structure target into an explicit knowledge violation", () => {
    const fn = fixture();
    const analysis = analyzeStructureAndChunkRuntime([fn], []);
    const evidence = structureRuntimeEvidence(
      analysis,
      new Map([[fn.identifier, fn.source]]),
    );
    const result = analyzeKnowledgeRuntime(
      catalog,
      { edition: "bedrock" },
      [],
      [fn],
      evidence,
    );

    expect(result.violations).toBe(1);
    expect(result.diagnostics[0]?.code).toBe("KNOWLEDGE_RELATION_VIOLATION");
    expect(result.diagnostics[0]?.source?.range?.lineStart).toBe(1);
  });
});
}
}
