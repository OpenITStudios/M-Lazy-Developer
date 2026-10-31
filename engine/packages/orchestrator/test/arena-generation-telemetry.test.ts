import { describe, expect, it } from "vitest";
import type { KnowledgeCatalog } from "../../knowledge/src/index.js";
import { analyzeKnowledgeRuntime } from "../src/inspection/knowledge-runtime-analysis.js";
import { telemetryRuntimeEvidence } from "../src/diagnosis/telemetry-evidence.js";

const catalog: KnowledgeCatalog = {
  schemaVersion: 1,
  sources: [{
    id: "policy",
    title: "Policy",
    url: "project://knowledge/arena-generation-test",
    authority: "project-policy",
    confidence: "designed",
    retrievedDate: "2026-09-24",
  }],
  facts: [],
  relations: [{
    id: "arena-generation-validity",
    domain: "arena-cleanup",
    subject: "arena-generation-transition-observed",
    kind: "requires",
    object: "arena-generation-transition-valid",
    classification: "project-policy",
    applicability: { editions: ["bedrock"] },
    sourceIds: ["policy"],
    diagnosticSeverity: "critical",
    causalConsequences: ["dirty-arena-reuse-risk"],
    causalOutcomePredicates: {
      "dirty-arena-reuse-risk": [
        "arena-generation-anomaly-observed",
      ],
    },
  }],
};

describe("arena generation telemetry reasoning", () => {
  it("turns reuse-before-reset into a critical proven violation", () => {
    const evidence = telemetryRuntimeEvidence([{
      schemaVersion: 1,
      eventId: "reuse-1",
      kind: "arena-generation-anomaly",
      producer: "instrumentation",
      scope: {
        arenaId: "arena-1",
        arenaGeneration: 5,
        operationId: "start-5",
      },
      anomaly: "reuse-before-reset",
      arenaId: "arena-1",
      observedGeneration: 5,
      priorGeneration: 4,
      currentGeneration: 5,
    }]);

    const result = analyzeKnowledgeRuntime(
      catalog,
      { edition: "bedrock" },
      [],
      [],
      evidence,
    );

    expect(result.violations).toBe(1);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: "KNOWLEDGE_RELATION_VIOLATION",
        severity: "critical",
        data: expect.objectContaining({
          causalConsequences: ["dirty-arena-reuse-risk"],
        }),
      }),
    ]);
  });
});
