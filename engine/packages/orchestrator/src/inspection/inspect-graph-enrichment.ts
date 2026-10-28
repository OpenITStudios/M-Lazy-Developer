import {
  populateFunctionEdges,
  populateEntityLootTableEdges,
  populateOwnedEconomyReferences,
} from "../../../../analyzers/references/src/index.js";
import type { ParsedFunction } from "../../../../analyzers/functions/src/index.js";
import type { SemanticGraph } from "../../../graph/src/index.js";
import type { SemanticNode } from "../../../graph/src/index.js";
import { semanticNodeId } from "../../../project-model/src/index.js";
import {
  createDialogueSceneNodes,
  dialogueStateIdentifiers,
  populateDialogueCommandGraph,
  type DialogueGraphDocument,
} from "./dialogue-graph.js";
import {
  embeddedCommandStateIdentifiers,
  populateEmbeddedStructureCommandGraph,
} from "./embedded-structure-graph.js";
import type { InspectionSourceIndex } from "./inspect-source-index.js";
import { resolveByIdentifier } from "../../../../analyzers/references/src/index.js";

export interface InspectionGraphEnrichmentInput {
  graph: SemanticGraph;
  nodes: SemanticNode[];
  artifactId: string;
  parsedFunctions: readonly {
    node: SemanticNode;
    parsed: ParsedFunction;
  }[];
  /** Existing source index owns parsed entity/component-group evidence. */
  parsedEntities?: InspectionSourceIndex["parsedEntities"];
  parsedDialogueDocuments:
    InspectionSourceIndex["parsedDialogueDocuments"];
  parsedStructureModels:
    InspectionSourceIndex["parsedStructureModels"];
  tickFunctionRegistrations:
    InspectionSourceIndex["tickFunctionRegistrations"];
}

export interface InspectionGraphEnrichmentResult {
  dialogueGraphDocuments: DialogueGraphDocument[];
}

export function enrichInspectionSemanticGraph(
  input: InspectionGraphEnrichmentInput,
): InspectionGraphEnrichmentResult {
  const dialogueGraphDocuments =
    input.parsedDialogueDocuments
      .filter(
        (
          item,
        ): item is NonNullable<typeof item> =>
          item !== undefined,
      )
      .map((document) =>
        createDialogueSceneNodes(
          input.graph,
          document,
          input.nodes,
        ),
      );

  const scoreboardIds = new Set<string>();
  const tagIds = new Set<string>();

  const dialogueIds =
    dialogueStateIdentifiers(dialogueGraphDocuments);
  for (const objective of dialogueIds.scoreboardObjectives) {
    scoreboardIds.add(objective);
  }
  for (const tag of dialogueIds.tags) {
    tagIds.add(tag);
  }

  for (const structure of input.parsedStructureModels) {
    const identifiers =
      embeddedCommandStateIdentifiers(
        structure.embeddedCommands,
      );
    for (const objective of identifiers.scoreboardObjectives) {
      scoreboardIds.add(objective);
    }
    for (const tag of identifiers.tags) {
      tagIds.add(tag);
    }
  }

  for (const { parsed } of input.parsedFunctions) {
    for (const ref of parsed.references) {
      if ("objective" in ref) {
        scoreboardIds.add(ref.objective);
      }
      if ("tag" in ref) {
        tagIds.add(ref.tag);
      }
    }
  }

  for (const objective of scoreboardIds) {
    const node: SemanticNode = {
      id: semanticNodeId(
        "scoreboard_objective",
        "project",
        objective,
      ),
      identity: {
        kind: "scoreboard_objective",
        scope: "project",
        identifier: objective,
      },
      kind: "scoreboard_objective",
      identifier: objective,
      source: {
        artifactId: input.artifactId,
        relativePath: "<derived>",
      },
    };
    input.graph.addNode(node);
    input.nodes.push(node);
  }

  for (const tag of tagIds) {
    const node: SemanticNode = {
      id: semanticNodeId(
        "tag",
        "project",
        tag,
      ),
      identity: {
        kind: "tag",
        scope: "project",
        identifier: tag,
      },
      kind: "tag",
      identifier: tag,
      source: {
        artifactId: input.artifactId,
        relativePath: "<derived>",
      },
    };
    input.graph.addNode(node);
    input.nodes.push(node);
  }

  for (const registration of input.tickFunctionRegistrations) {
    const scheduleId = "function-schedule:tick:" + registration.source.relativePath;
    const scheduler: SemanticNode = {
      id: semanticNodeId("world", "project", scheduleId),
      identity: {
        kind: "world",
        scope: "project",
        identifier: scheduleId,
      },
      kind: "world",
      identifier: scheduleId,
      source: registration.source,
    };
    input.graph.addNode(scheduler);
    input.nodes.push(scheduler);
    const functions = input.nodes.filter((node) => node.kind === "function");
    for (const [index, name] of registration.functions.entries()) {
      const resolution = resolveByIdentifier(functions, name);
      input.graph.addEdge({
        from: scheduler.id,
        type: "CALLS",
        targetIdentifier: name,
        status: resolution.status,
        ...(resolution.to ? { to: resolution.to } : {}),
        ...(resolution.candidates ? { candidates: resolution.candidates } : {}),
        evidence: { source: { ...registration.source, jsonPointer: "/values/" + index } },
      });
    }
  }

  for (const item of input.parsedFunctions) {
    populateFunctionEdges(
      input.graph,
      item.node,
      item.parsed,
      input.nodes,
    );
  }
  // File presence is source reference integrity only. Entity component-group
  // activation, table load, inventory drops and gameplay remain unproven.
  populateEntityLootTableEdges(
    input.graph,
    input.parsedEntities ?? [],
    input.nodes,
  );
  // Cross-definition literals add precise missing-reference obligations but
  // do not close semantic gaps for loot rolls, recipes, or item use.
  populateOwnedEconomyReferences(input.graph, input.nodes);

  for (const dialogue of dialogueGraphDocuments) {
    populateDialogueCommandGraph(
      input.graph,
      dialogue,
      input.nodes,
    );
  }

  for (const structure of input.parsedStructureModels) {
    populateEmbeddedStructureCommandGraph(
      input.graph,
      structure.node,
      structure.identifier,
      structure.embeddedCommands,
      input.nodes,
    );
  }

  return { dialogueGraphDocuments };
}
