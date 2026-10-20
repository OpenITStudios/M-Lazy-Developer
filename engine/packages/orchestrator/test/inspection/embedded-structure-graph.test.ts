import { describe, expect, it } from "vitest";
import { SemanticGraph } from "../../../graph/src/index.js";
import type { SemanticNode } from "../../../graph/src/index.js";
import { analyzeEmbeddedStructureCommands } from "../../src/embedded-structure-commands.js";
import { populateEmbeddedStructureCommandGraph } from "../../src/inspection/embedded-structure-graph.js";
import { correlateEmbeddedCommandsWithNativeChunks } from "../../src/inspection/embedded-native-correlation.js";
import { structureIdentifier } from "../../src/inspection/inspect-identifiers.js";
import { derivePlacedEmbeddedCommands } from "../../src/inspection/structure-placement-analysis.js";

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
