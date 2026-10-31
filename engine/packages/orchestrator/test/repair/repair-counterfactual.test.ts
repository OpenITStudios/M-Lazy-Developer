import { describe, expect, it } from "vitest";
import { SemanticGraph } from "../../../graph/src/index.js";
import { createPatchTransaction } from "../../../repair/src/index.js";
import { analyzeRepairCounterfactual } from "../../src/repair/repair-counterfactual.js";
import {
  DEFAULT_REPAIR_BLAST_RADIUS_POLICY,
  decideRepairBlastRadius,
} from "../../src/repair/repair-blast-radius.js";
import { fixtureRepairAuthorization } from "../../../repair/test/fixture-authorization.js";

function graphFixture(): SemanticGraph {
  const graph = new SemanticGraph();
  const source = (relativePath: string) => ({
    artifactId: "art-1",
    relativePath,
  });

  graph.addNode({
    id: "function:p:target",
    identity: { kind: "function", scope: "p", identifier: "target" },
    kind: "function",
    identifier: "target",
    source: source("functions/target.mcfunction"),
  });
  graph.addNode({
    id: "function:p:caller",
    identity: { kind: "function", scope: "p", identifier: "caller" },
    kind: "function",
    identifier: "caller",
    source: source("functions/caller.mcfunction"),
  });
  graph.addNode({
    id: "function:p:unrelated",
    identity: { kind: "function", scope: "p", identifier: "unrelated" },
    kind: "function",
    identifier: "unrelated",
    source: source("functions/unrelated.mcfunction"),
  });

  graph.addEdge({
    from: "function:p:caller",
    type: "CALLS",
    targetIdentifier: "target",
    status: "resolved",
    to: "function:p:target",
    evidence: { source: source("functions/caller.mcfunction") },
  });

  return graph;
}

function transaction(path = "functions/target.mcfunction") {
  return createPatchTransaction({
    title: "demo",
    sourceFingerprint: "abc",
    authorization: fixtureRepairAuthorization("abc"),
    operations: [{
      kind: "replace-text",
      source: {
        artifactId: "art-1",
        relativePath: path,
      },
      expected: "a",
      replacement: "b",
    }],
    preconditions: [{
      kind: "source-fingerprint",
      expected: "abc",
    }],
    validation: [],
  });
}

describe("repair counterfactual and blast radius", () => {
  it("traces reverse dependents from changed semantic nodes", () => {
    const impact = analyzeRepairCounterfactual(graphFixture(), {
      transaction: transaction(),
      changedNodeIds: ["function:p:target"],
    });

    expect(impact.affectedNodeIds).toEqual([
      "function:p:caller",
      "function:p:target",
    ]);
    expect(impact.affectedPaths).toEqual([
      "functions/caller.mcfunction",
      "functions/target.mcfunction",
    ]);
    expect(impact.graphCoverageComplete).toBe(true);
  });

  it("marks unknown changed nodes as indeterminate", () => {
    const impact = analyzeRepairCounterfactual(graphFixture(), {
      transaction: transaction(),
      changedNodeIds: ["function:p:missing"],
    });

    expect(decideRepairBlastRadius(impact).disposition)
      .toBe("indeterminate");
  });

  it("blocks repairs outside an explicit small blast-radius policy", () => {
    const impact = analyzeRepairCounterfactual(graphFixture(), {
      transaction: transaction(),
      changedNodeIds: ["function:p:target"],
    });

    expect(decideRepairBlastRadius(impact, {
      ...DEFAULT_REPAIR_BLAST_RADIUS_POLICY,
      maxAffectedNodes: 1,
    }).disposition).toBe("blocked");
  });

  it("keeps a resolved dependent impact inside a bounded envelope", () => {
    const impact = analyzeRepairCounterfactual(graphFixture(), {
      transaction: transaction(),
      changedNodeIds: ["function:p:target"],
    });

    expect(decideRepairBlastRadius(impact).disposition)
      .toBe("bounded");
  });

  it("flags unresolved topology touching the affected region as indeterminate", () => {
    const graph = graphFixture();
    graph.addEdge({
      from: "function:p:target",
      type: "CALLS",
      targetIdentifier: "missing",
      status: "unresolved",
      evidence: {
        source: {
          artifactId: "art-1",
          relativePath: "functions/target.mcfunction",
        },
      },
    });

    const impact = analyzeRepairCounterfactual(graph, {
      transaction: transaction(),
      changedNodeIds: ["function:p:target"],
    });

    expect(impact.unresolvedEdgeIds.length).toBe(1);
    expect(decideRepairBlastRadius(impact).disposition)
      .toBe("indeterminate");
  });

  it("marks undeclared extra patch paths as indeterminate", () => {
    const tx = createPatchTransaction({
      title: "wide",
      sourceFingerprint: "abc",
      authorization: fixtureRepairAuthorization("abc"),
      operations: [{
        kind: "replace-text",
        source: {
          artifactId: "art-1",
          relativePath: "functions/target.mcfunction",
        },
        expected: "a",
        replacement: "b",
      }, {
        kind: "replace-text",
        source: {
          artifactId: "art-1",
          relativePath: "functions/unrelated.mcfunction",
        },
        expected: "x",
        replacement: "y",
      }],
      preconditions: [{
        kind: "source-fingerprint",
        expected: "abc",
      }],
      validation: [],
    });

    const impact = analyzeRepairCounterfactual(graphFixture(), {
      transaction: tx,
      changedNodeIds: ["function:p:target"],
    });

    expect(impact.graphCoverageComplete).toBe(false);
    expect(decideRepairBlastRadius(impact).disposition)
      .toBe("indeterminate");
  });


  it("can explicitly allow unresolved topology without falsifying graph coverage", () => {
    const graph = graphFixture();
    graph.addEdge({
      from: "function:p:target",
      type: "CALLS",
      targetIdentifier: "missing",
      status: "unresolved",
      evidence: {
        source: {
          artifactId: "art-1",
          relativePath: "functions/target.mcfunction",
        },
      },
    });

    const impact = analyzeRepairCounterfactual(graph, {
      transaction: transaction(),
      changedNodeIds: ["function:p:target"],
    });

    expect(impact.graphCoverageComplete).toBe(true);
    expect(impact.dependencyTopologyResolved).toBe(false);
    expect(decideRepairBlastRadius(impact, {
      ...DEFAULT_REPAIR_BLAST_RADIUS_POLICY,
      blockOnUnresolvedTopology: false,
    }).disposition).toBe("bounded");
  });

});
