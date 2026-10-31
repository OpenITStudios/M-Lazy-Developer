import { describe, expect, it } from "vitest";
import { SemanticGraph } from "../src/graph.js";
import { buildInvalidationPlan } from "../src/invalidation.js";

describe("buildInvalidationPlan", () => {
  it("invalidates only changed nodes and reverse dependents", () => {
    const graph = new SemanticGraph();
    const source = { artifactId: "art_demo", relativePath: "demo" };

    for (const identifier of ["a", "b", "unrelated"]) {
      const id = `function:p:${identifier}`;
      graph.addNode({
        id,
        identity: { kind: "function", scope: "p", identifier },
        kind: "function",
        identifier,
        source,
      });
    }

    graph.addEdge({
      from: "function:p:a",
      type: "CALLS",
      targetIdentifier: "b",
      status: "resolved",
      to: "function:p:b",
      evidence: { source },
    });

    const plan = buildInvalidationPlan(graph, ["function:p:b"]);

    expect(plan.affected.has("function:p:a")).toBe(true);
    expect(plan.affected.has("function:p:b")).toBe(true);
    expect(plan.affected.has("function:p:unrelated")).toBe(false);
  });
});
