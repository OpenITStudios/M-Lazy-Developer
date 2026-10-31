import { describe, expect, it } from "vitest";
import type { KnowledgeCatalog } from "../../../../packages/knowledge/src/index.js";
import { parseMcFunction } from "../../../functions/src/index.js";
import { functionKnowledgeRuntimeDiagnostics } from "../../src/runtime/function-knowledge-runtime-findings.js";

const source = { artifactId: "a", relativePath: "functions/arena.mcfunction" };

const catalog: KnowledgeCatalog = {
  schemaVersion: 1,
  sources: [{
    id: "official",
    title: "Official",
    url: "https://learn.microsoft.com/example",
    authority: "official",
    confidence: "documented",
    retrievedDate: "2026-09-24",
  }],
  facts: [],
  relations: [{
    id: "structure-needs-readiness",
    domain: "world-mutation",
    subject: "structure-placement-request",
    kind: "requires",
    object: "post-placement-readiness-verification",
    classification: "derived-rule",
    applicability: { editions: ["bedrock"] },
    sourceIds: ["official"],
  }, {
    id: "block-write-needs-loaded-chunk",
    domain: "world-mutation",
    subject: "block-write",
    kind: "requires",
    object: "loaded-target-chunk",
    classification: "engine-fact",
    applicability: { editions: ["bedrock"] },
    sourceIds: ["official"],
  }],
};

describe("function knowledge runtime reasoning", () => {
  it("emits evidence gaps rather than invented failures", () => {
    const fn = parseMcFunction(
      "test:arena",
      "structure load test:arena 0 64 0\nfill 0 0 0 1 1 1 stone",
      source,
    );

    const findings = functionKnowledgeRuntimeDiagnostics({
      catalog,
      profile: { edition: "bedrock" },
      fn,
    });

    expect(findings).toHaveLength(2);
    expect(findings.every((finding) => finding.code === "KNOWLEDGE_EVIDENCE_GAP")).toBe(true);
    expect(findings.map((finding) => finding.data?.relationId)).toEqual(expect.arrayContaining([
      "structure-needs-readiness",
      "block-write-needs-loaded-chunk",
    ]));
  });
});