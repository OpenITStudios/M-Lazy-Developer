import { describe, expect, it } from "vitest";
import { SemanticGraph } from "../src/graph.js";
import type { ComponentKind } from "../../project-model/src/index.js";

const source = {
  artifactId: "art_demo",
  relativePath: "functions/start.mcfunction",
};

function node(id: string, kind: ComponentKind, identifier: string, nodeSource = source) {
  return {
    id,
    identity: { kind, scope: "pack", identifier },
    kind,
    identifier,
    source: nodeSource,
  };
}

describe("SemanticGraph", () => {
  it("indexes resolved dependencies in both directions", () => {
    const graph = new SemanticGraph();

    graph.addNode(node("function:pack:start", "function", "start"));
    graph.addNode(node(
      "structure:pack:arena",
      "structure",
      "arena",
      { artifactId: "art_demo", relativePath: "structures/arena.mcstructure" },
    ));

    graph.addEdge({
      from: "function:pack:start",
      type: "LOADS_STRUCTURE",
      targetIdentifier: "arena",
      status: "resolved",
      to: "structure:pack:arena",
      evidence: { source },
    });

    expect(graph.dependenciesOf("function:pack:start").map((item) => item.id)).toEqual([
      "structure:pack:arena",
    ]);
    expect(graph.dependentsOf("structure:pack:arena").map((item) => item.id)).toEqual([
      "function:pack:start",
    ]);
  });

  it("retains unresolved references", () => {
    const graph = new SemanticGraph();
    graph.addNode(node("function:pack:start", "function", "start"));

    graph.addEdge({
      from: "function:pack:start",
      type: "LOADS_STRUCTURE",
      targetIdentifier: "missing",
      status: "unresolved",
      evidence: { source },
    });

    expect(graph.unresolvedEdges()).toHaveLength(1);
  });

  it("traces reverse impact through dependents", () => {
    const graph = new SemanticGraph();

    graph.addNode(node("function:pack:a", "function", "a"));
    graph.addNode(node("function:pack:b", "function", "b"));
    graph.addNode(node("structure:pack:c", "structure", "c"));

    graph.addEdge({
      from: "function:pack:a",
      type: "CALLS",
      targetIdentifier: "b",
      status: "resolved",
      to: "function:pack:b",
      evidence: { source },
    });
    graph.addEdge({
      from: "function:pack:b",
      type: "LOADS_STRUCTURE",
      targetIdentifier: "c",
      status: "resolved",
      to: "structure:pack:c",
      evidence: { source },
    });

    expect([...graph.traceAffected("structure:pack:c")].sort()).toEqual(
      ["function:pack:a", "function:pack:b", "structure:pack:c"].sort(),
    );
  });
});
