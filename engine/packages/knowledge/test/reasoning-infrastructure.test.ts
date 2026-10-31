import { describe, expect, it } from "vitest";
import {
  buildKnowledgeGraph,
  compileDiagnosticTemplates,
  validateKnowledgeCatalog,
  type KnowledgeCatalog,
} from "../src/index.js";

const source = {
  id: "policy",
  title: "Policy",
  url: "project://knowledge/test-policy",
  authority: "project-policy" as const,
  confidence: "designed" as const,
  retrievedDate: "2026-09-24",
};

describe("knowledge reasoning infrastructure", () => {
  it("accepts project:// provenance for project-policy sources", () => {
    const catalog: KnowledgeCatalog = {
      schemaVersion: 1,
      sources: [source],
      facts: [{
        id: "policy-fact",
        domain: "arena-cleanup",
        subject: "reset",
        statement: "fixture",
        classification: "project-policy",
        applicability: { editions: ["bedrock"] },
        sourceIds: ["policy"],
        capabilityTags: ["reset"],
        riskSurfaces: ["dirty-reuse"],
      }],
    };
    expect(validateKnowledgeCatalog(catalog)).toEqual([]);
  });

  it("rejects runtime catalogs with unregistered domains", () => {
    const catalog = {
      schemaVersion: 1,
      sources: [source],
      facts: [{
        id: "bad-domain",
        domain: "not-a-domain",
        subject: "x",
        statement: "fixture",
        classification: "project-policy",
        applicability: { editions: ["bedrock"] },
        sourceIds: ["policy"],
        capabilityTags: [],
        riskSurfaces: [],
      }],
    } as unknown as KnowledgeCatalog;

    expect(validateKnowledgeCatalog(catalog)).toContain(
      "Knowledge fact bad-domain has unknown domain: not-a-domain",
    );
  });

  it("builds provenance-preserving cross-domain paths", () => {
    const catalog: KnowledgeCatalog = {
      schemaVersion: 1,
      sources: [source],
      facts: [],
      relations: [{
        id: "r1",
        domain: "world-mutation",
        subject: "structure-load",
        kind: "deactivates",
        object: "route-proof",
        classification: "project-policy",
        applicability: { editions: ["bedrock"] },
        sourceIds: ["policy"],
      }, {
        id: "r2",
        domain: "entity-runtime",
        subject: "route-proof",
        kind: "validates",
        object: "navigation-ready",
        classification: "project-policy",
        applicability: { editions: ["bedrock"] },
        sourceIds: ["policy"],
      }],
    };

    const graph = buildKnowledgeGraph(catalog, { edition: "bedrock" });
    const paths = graph.paths("structure-load", "navigation-ready");
    expect(paths).toHaveLength(1);
    expect(paths[0]?.edges.map((edge) => edge.id)).toEqual(["r1", "r2"]);
    expect(paths[0]?.edges.every((edge) => edge.sourceIds.includes("policy"))).toBe(true);
  });

  it("compiles risk surfaces into evidence-backed diagnostic templates", () => {
    const catalog: KnowledgeCatalog = {
      schemaVersion: 1,
      sources: [source],
      facts: [{
        id: "cleanup-risk",
        domain: "arena-cleanup",
        subject: "arena reset",
        statement: "Reset must verify baseline.",
        classification: "project-policy",
        applicability: { editions: ["bedrock"] },
        sourceIds: ["policy"],
        capabilityTags: ["cleanup"],
        riskSurfaces: ["dirty-reuse", "state-residue"],
      }],
    };

    const templates = compileDiagnosticTemplates(catalog, { edition: "bedrock" });
    expect(templates.map((item) => item.id)).toEqual([
      "cleanup-risk::dirty-reuse",
      "cleanup-risk::state-residue",
    ]);
    expect(templates.every((item) => item.confidence === "supported")).toBe(true);
  });
});
