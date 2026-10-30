// Consolidated same-owner, same-feature, same-lane test family.
// Original cases/assertions preserved; this is NOT executed test proof.
import { describe, expect, it } from "vitest";
import { deriveScriptDataFlowGraph } from "../../src/index.js";
import { deriveScriptSemanticFlowBindings } from "../../src/flow/semantic-flow-bindings.js";
import { type DataFlowGraph } from "../../../../packages/dataflow/src/index.js";
import { deriveScriptSemanticFlowWitnesses } from "../../src/flow/semantic-flow-witness.js";

// Original suite: engine/analyzers/scripts/test/flow/dataflow-capability.test.ts (Git blob 4450406d08e4114cba7819ab109f4660d16b2782)
{


describe("script dataflow capability", () => {
  it("derives assignment, argument, and return flow from script source", () => {
    const graph = deriveScriptDataFlowGraph([{
      path: "scripts/main.ts",
      text: [
        "function identity(value) { return value; }",
        "const source = 7;",
        "const result = identity(source);",
      ].join("\n"),
      source: {
        artifactId: "artifact:test",
        relativePath: "scripts/main.ts",
      },
    }]);

    expect(
      graph.edges.some(
        (edge) =>
          edge.kind === "assignment",
      ),
    ).toBe(true);
    expect(
      graph.edges.some(
        (edge) =>
          edge.kind === "argument",
      ),
    ).toBe(true);
    expect(
      graph.edges.some(
        (edge) =>
          edge.kind === "return",
      ),
    ).toBe(true);
  });
});
}

// Original suite: engine/analyzers/scripts/test/flow/semantic-flow-bindings.test.ts (Git blob 0fc90e98ebb8405e1aedeb36582e19421b6984c6)
{


const graph: DataFlowGraph = {
  schemaVersion: 1,
  nodes: [
    {
      id: "call:getPlayers",
      kind: "call",
      modulePath: "scripts/main.ts",
      regionId: "function:start",
      symbol: "world.getAllPlayers",
    },
    {
      id: "call:teleport",
      kind: "call",
      modulePath: "scripts/main.ts",
      regionId: "function:start",
      symbol: "player.teleport",
    },
    {
      id: "call:setDynamic",
      kind: "call",
      modulePath: "scripts/main.ts",
      regionId: "function:start",
      symbol: "player.setDynamicProperty",
    },
  ],
  edges: [],
  unresolved: [],
};

describe("script semantic flow bindings", () => {
  it("labels player identity sources and sinks without emitting defects", () => {
    const bindings = deriveScriptSemanticFlowBindings(graph, []);
    expect(bindings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        nodeId: "call:getPlayers",
        label: "player-identity",
        role: "source",
      }),
      expect.objectContaining({
        nodeId: "call:teleport",
        label: "player-identity",
        role: "sink",
      }),
      expect.objectContaining({
        nodeId: "call:setDynamic",
        label: "persistent-state",
        role: "sink",
      }),
    ]));
  });
});
}

// Original suite: engine/analyzers/scripts/test/flow/semantic-flow-witness.test.ts (Git blob 2675bd379424123830ce763c304ca719ff362751)
{


const graph: DataFlowGraph = {
  schemaVersion: 1,
  nodes: [
    {
      id: "source",
      kind: "call",
      modulePath: "scripts/main.ts",
      symbol: "world.getAllPlayers",
    },
    {
      id: "middle",
      kind: "binding",
      modulePath: "scripts/main.ts",
      symbol: "player",
    },
    {
      id: "sink",
      kind: "call",
      modulePath: "scripts/main.ts",
      symbol: "player.teleport",
    },
  ],
  edges: [
    {
      id: "e1",
      from: "source",
      to: "middle",
      kind: "assignment",
      confidence: "exact",
    },
    {
      id: "e2",
      from: "middle",
      to: "sink",
      kind: "argument",
      confidence: "exact",
    },
  ],
  unresolved: [],
};

describe("semantic flow witnesses", () => {
  it("produces the shortest evidence path without declaring a defect", () => {
    const result =
      deriveScriptSemanticFlowWitnesses(
        graph,
        [
          {
            nodeId: "source",
            label: "player-identity",
            role: "source",
            basis: "player lookup",
            confidence: "exact",
          },
          {
            nodeId: "sink",
            label: "player-identity",
            role: "sink",
            basis: "teleport",
            confidence: "exact",
          },
        ],
      );

    expect(result.witnesses).toEqual([
      expect.objectContaining({
        label: "player-identity",
        sourceNodeId: "source",
        sinkNodeId: "sink",
        edgeIds: ["e1", "e2"],
        confidence: "exact",
      }),
    ]);
  });

  it("honors explicit barriers", () => {
    const result =
      deriveScriptSemanticFlowWitnesses(
        graph,
        [
          {
            nodeId: "source",
            label: "player-identity",
            role: "source",
            basis: "player lookup",
            confidence: "exact",
          },
          {
            nodeId: "sink",
            label: "player-identity",
            role: "sink",
            basis: "teleport",
            confidence: "exact",
          },
        ],
        { barrierNodeIds: ["middle"] },
      );

    expect(result.witnesses).toEqual([]);
  });
});
}
