import { describe, expect, it } from "vitest";
import type { KnowledgeCatalog } from "../../knowledge/src/index.js";
import { parseMcFunction } from "../../../analyzers/functions/src/index.js";
import { analyzeFunctionTopology } from "../src/inspection/topology-analysis.js";
import { analyzeStructureAndChunkRuntime } from "../src/inspection/structure-runtime-analysis.js";
import { derivePlacementProofs } from "../src/inspection/structure-proof-analysis.js";
import {
  correlateRouteMutations,
  routeMutationRuntimeEvidence,
} from "../src/inspection/route-mutation-analysis.js";
import { analyzeKnowledgeRuntime } from "../src/inspection/knowledge-runtime-analysis.js";

const catalog: KnowledgeCatalog = {
  schemaVersion: 1,
  sources: [{
    id: "policy",
    title: "Policy",
    url: "project://knowledge/route-test",
    authority: "project-policy",
    confidence: "designed",
    retrievedDate: "2026-09-24",
  }],
  facts: [],
  relations: [{
    id: "route-mutation-needs-revalidation",
    domain: "entity-runtime",
    subject: "route-affecting-world-mutation",
    kind: "requires",
    object: "route-revalidation",
    classification: "project-policy",
    applicability: { editions: ["bedrock"] },
    sourceIds: ["policy"],
    diagnosticSeverity: "medium",
  }],
};

describe("route mutation knowledge reasoning", () => {
  it("produces a revalidation evidence gap instead of an AI failure claim", () => {
    const fn = parseMcFunction(
      "demo:mutate",
      "fill 10 64 10 20 70 20 minecraft:stone",
      { artifactId: "a", relativePath: "functions/mutate.mcfunction" },
    );
    const topology = analyzeFunctionTopology([fn]);
    const runtime = analyzeStructureAndChunkRuntime([fn]);
    const proofs = derivePlacementProofs(runtime, [fn]);
    const correlations = correlateRouteMutations([{
      id: "bridge",
      volume: {
        min: { x: 0, y: 60, z: 0 },
        max: { x: 30, y: 80, z: 30 },
      },
    }], topology, proofs);

    const result = analyzeKnowledgeRuntime(
      catalog,
      { edition: "bedrock" },
      [],
      [fn],
      routeMutationRuntimeEvidence(correlations),
    );

    expect(result.violations).toBe(0);
    expect(result.evidenceGaps).toBe(1);
    expect(result.diagnostics[0]?.message).toMatch(/route-revalidation/);
  });
});
