import { describe, expect, it } from "vitest";
import { SemanticGraph } from "../../../graph/src/index.js";
import { semanticGraphFingerprint } from "../../src/workflow/semantic-graph-fingerprint.js";

function source(relativePath: string) {
  return { artifactId: "art-1", relativePath };
}

function graph(order: "normal" | "reverse" = "normal") {
  const graph = new SemanticGraph();
  const nodes = [{
    id: "function:p:a",
    identity: { kind: "function" as const, scope: "p", identifier: "a" },
    kind: "function" as const,
    identifier: "a",
    source: source("functions/a.mcfunction"),
  }, {
    id: "function:p:b",
    identity: { kind: "function" as const, scope: "p", identifier: "b" },
    kind: "function" as const,
    identifier: "b",
    source: source("functions/b.mcfunction"),
  }];

  for (const node of order === "reverse" ? [...nodes].reverse() : nodes) {
    graph.addNode(node);
  }

  graph.addEdge({
    from: "function:p:a",
    type: "CALLS",
    targetIdentifier: "b",
    status: "resolved",
    to: "function:p:b",
    evidence: { source: source("functions/a.mcfunction") },
  });

  return graph;
}

describe("semantic graph fingerprint", () => {
  it("is stable across insertion order", () => {
    expect(semanticGraphFingerprint(graph("normal")))
      .toBe(semanticGraphFingerprint(graph("reverse")));
  });

  it("changes when graph semantics change", () => {
    const left = graph();
    const right = graph();
    right.addNode({
      id: "function:p:c",
      identity: { kind: "function", scope: "p", identifier: "c" },
      kind: "function",
      identifier: "c",
      source: source("functions/c.mcfunction"),
    });

    expect(semanticGraphFingerprint(left))
      .not.toBe(semanticGraphFingerprint(right));
  });
});
