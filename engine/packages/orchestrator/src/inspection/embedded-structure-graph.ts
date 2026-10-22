import { SemanticGraph } from "../../../graph/src/index.js";
import type { SemanticNode } from "../../../graph/src/index.js";
import { semanticNodeId } from "../../../project-model/src/index.js";
import type { EmbeddedStructureCommandAnalysis } from "./embedded-structure-commands.js";
import { commandEffectStateIdentifiers, populateCommandEffectEdges } from "./command-effect-graph.js";

export function embeddedCommandStateIdentifiers(
  analyses: readonly EmbeddedStructureCommandAnalysis[],
): {
  scoreboardObjectives: string[];
  tags: string[];
} {
  const scoreboardObjectives = new Set<string>();
  const tags = new Set<string>();

  for (const analysis of analyses) {
    const ids = commandEffectStateIdentifiers(analysis.effects);
    for (const objective of ids.scoreboardObjectives) scoreboardObjectives.add(objective);
    for (const tag of ids.tags) tags.add(tag);
  }

  return {
    scoreboardObjectives: [...scoreboardObjectives].sort(),
    tags: [...tags].sort(),
  };
}

export function populateEmbeddedStructureCommandGraph(
  graph: SemanticGraph,
  structureNode: SemanticNode,
  structureIdentifier: string,
  analyses: readonly EmbeddedStructureCommandAnalysis[],
  candidateNodes: SemanticNode[],
): SemanticNode[] {
  const created: SemanticNode[] = [];

  for (const analysis of analyses) {
    const identifier = `${structureIdentifier}#command:${analysis.block.flatIndex}`;
    const node: SemanticNode = {
      id: semanticNodeId("command", `structure:${structureIdentifier}`, String(analysis.block.flatIndex)),
      identity: {
        kind: "command",
        scope: `structure:${structureIdentifier}`,
        identifier: String(analysis.block.flatIndex),
      },
      kind: "command",
      identifier,
      ...(structureNode.contentHash === undefined
        ? {}
        : { contentHash: structureNode.contentHash }),
      ...(structureNode.parserVersion === undefined
        ? {}
        : { parserVersion: structureNode.parserVersion }),
      source: structureNode.source,
      data: {
        command: analysis.block.command,
        flatIndex: analysis.block.flatIndex,
        coordinate: analysis.block.coordinate ?? null,
        auto: analysis.block.auto ?? null,
        conditional: analysis.block.conditional ?? null,
        tickDelay: analysis.block.tickDelay ?? null,
      },
    };

    graph.addNode(node);
    candidateNodes.push(node);
    created.push(node);

    graph.addEdge({
      from: structureNode.id,
      type: "CONTAINS",
      targetIdentifier: identifier,
      status: "resolved",
      to: node.id,
      evidence: { source: structureNode.source },
    });

    for (const effect of analysis.effects) {
      populateCommandEffectEdges(graph, node, effect, candidateNodes);
    }
  }

  return created;
}
