import { describe, expect, it } from "vitest";
import type { KnowledgeCatalog } from "../../../knowledge/src/index.js";
import { analyzeManifest } from "../../../../analyzers/manifest/src/index.js";
import { parseMcFunction } from "../../../../analyzers/functions/src/index.js";
import { analyzeKnowledgeRuntime, resolveInspectionKnowledgeProfile } from "../../src/inspection/knowledge-runtime-analysis.js";

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

const manifest = analyzeManifest({
  format_version: 2,
  header: {
    uuid: "00000000-0000-0000-0000-000000000001",
    version: [1, 0, 0],
    min_engine_version: [1, 20, 0],
  },
  modules: [],
  dependencies: [],
}, { artifactId: "a", relativePath: "manifest.json" });

const fn = parseMcFunction(
  "test:arena",
  "structure load test:arena 0 64 0\nfill 0 0 0 1 1 1 stone",
  { artifactId: "a", relativePath: "functions/arena.mcfunction" },
);

describe("orchestrator knowledge runtime analysis", () => {
  it("resolves an explicit target profile and emits scoped evidence gaps", () => {
    const result = analyzeKnowledgeRuntime(
      catalog,
      { edition: "bedrock", version: "1.21.130" },
      [manifest],
      [fn],
    );

    expect(result.profileResolved).toBe(true);
    expect(result.profileSource).toBe("target");
    expect(result.violations).toBe(0);
    expect(result.evidenceGaps).toBe(2);
    expect(result.validationCases.length).toBeGreaterThan(0);
    expect(result.diagnostics.every((finding) => finding.source?.relativePath === "functions/arena.mcfunction")).toBe(true);
  });

  it("keeps the profile unresolved when edition is genuinely unknown", () => {
    const resolution = resolveInspectionKnowledgeProfile({}, [manifest]);
    expect(resolution.profile).toBeUndefined();
    expect(resolution.source).toBe("unresolved");

    const result = analyzeKnowledgeRuntime(catalog, {}, [manifest], [fn]);
    expect(result.profileResolved).toBe(false);
    expect(result.diagnostics).toEqual([]);
    expect(result.evidenceRecords).toBeGreaterThan(0);
  });
});