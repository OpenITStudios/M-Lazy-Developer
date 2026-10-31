import { describe, expect, it } from "vitest";
import { SemanticGraph } from "../../../graph/src/index.js";
import {
  proveStaticGraphPreservation,
} from "../../src/index.js";

function graph(options?: {
  changedAllowed?: boolean;
  changedHealthy?: boolean;
  addNode?: boolean;
  edgeTarget?: "healthy" | "allowed";
}) {
  const graph = new SemanticGraph();

  graph.addNode({
    id: "allowed",
    identity: {
      kind: "script_file",
      scope: "project",
      identifier: "allowed",
    },
    kind: "script_file",
    identifier: "allowed",
    source: {
      artifactId: "artifact",
      relativePath: "scripts/allowed.ts",
    },
    semanticHash:
      options?.changedAllowed
        ? "allowed-after"
        : "allowed-before",
  });

  graph.addNode({
    id: "healthy",
    identity: {
      kind: "script_file",
      scope: "project",
      identifier: "healthy",
    },
    kind: "script_file",
    identifier: "healthy",
    source: {
      artifactId: "artifact",
      relativePath: "scripts/healthy.ts",
    },
    semanticHash:
      options?.changedHealthy
        ? "healthy-after"
        : "healthy-before",
  });

  if (options?.addNode) {
    graph.addNode({
      id: "unexpected",
      identity: {
        kind: "script_file",
        scope: "project",
        identifier: "unexpected",
      },
      kind: "script_file",
      identifier: "unexpected",
      source: {
        artifactId: "artifact",
        relativePath: "scripts/unexpected.ts",
      },
    });
  }

  graph.addEdge({
    from: "allowed",
    type: "REFERENCES",
    targetIdentifier:
      options?.edgeTarget ?? "healthy",
    status: "resolved",
    to:
      options?.edgeTarget === "allowed"
        ? "allowed"
        : "healthy",
    evidence: {
      source: {
        artifactId: "artifact",
        relativePath: "scripts/allowed.ts",
        range: {
          lineStart: options?.changedAllowed
            ? 20
            : 10,
          lineEnd: options?.changedAllowed
            ? 20
            : 10,
        },
      },
    },
  });

  return graph;
}

describe("static graph preservation proof", () => {
  it("allows node content changes confined to the admitted repair path while normalizing source line drift", () => {
    const proof = proveStaticGraphPreservation(
      graph(),
      graph({
        changedAllowed: true,
      }),
      {
        allowedPaths: [
          "scripts/allowed.ts",
        ],
      },
    );

    expect(proof).toMatchObject({
      status: "proven",
      addedNodeIds: [],
      removedNodeIds: [],
      changedOutsideEnvelopeNodeIds: [],
      changedIdentityNodeIds: [],
      edgeTopologyChanged: false,
      proofFingerprint:
        expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(proof.beforeFingerprint)
      .toBe(proof.afterFingerprint);
  });

  it("blocks semantic node content drift outside the admitted envelope", () => {
    const proof = proveStaticGraphPreservation(
      graph(),
      graph({
        changedHealthy: true,
      }),
      {
        allowedPaths: [
          "scripts/allowed.ts",
        ],
      },
    );

    expect(proof.status).toBe("blocked");
    expect(
      proof.changedOutsideEnvelopeNodeIds,
    ).toEqual(["healthy"]);
    expect(proof.reasons.join(" "))
      .toMatch(/outside the admitted repair envelope/i);
  });

  it("blocks added or removed semantic nodes", () => {
    const added = proveStaticGraphPreservation(
      graph(),
      graph({
        addNode: true,
      }),
      {
        allowedPaths: [
          "scripts/allowed.ts",
        ],
      },
    );

    expect(added).toMatchObject({
      status: "blocked",
      addedNodeIds: ["unexpected"],
    });

    const removed = proveStaticGraphPreservation(
      graph({
        addNode: true,
      }),
      graph(),
      {
        allowedPaths: [
          "scripts/allowed.ts",
        ],
      },
    );

    expect(removed).toMatchObject({
      status: "blocked",
      removedNodeIds: ["unexpected"],
    });
  });

  it("blocks global semantic edge topology changes even when the edge originates in the repaired source", () => {
    const proof = proveStaticGraphPreservation(
      graph(),
      graph({
        edgeTarget: "allowed",
      }),
      {
        allowedPaths: [
          "scripts/allowed.ts",
        ],
      },
    );

    expect(proof).toMatchObject({
      status: "blocked",
      edgeTopologyChanged: true,
    });
    expect(proof.reasons.join(" "))
      .toMatch(/edge topology changed/i);
  });
});
