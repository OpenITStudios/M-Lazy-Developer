import { describe, expect, it } from "vitest";
import { knowledgeRuntimeDiagnostics } from "../../src/runtime/knowledge-runtime-findings.js";
import type { KnowledgeCatalog } from "../../../../packages/knowledge/src/index.js";

const catalog: KnowledgeCatalog = {
  schemaVersion: 1,
  sources: [{
    id: "policy",
    title: "Policy",
    url: "project://knowledge/runtime-diagnostics-test",
    authority: "project-policy",
    confidence: "designed",
    retrievedDate: "2026-09-24",
  }],
  facts: [],
  relations: [{
    id: "verified-gates-commit",
    domain: "world-mutation",
    subject: "verified",
    kind: "gates",
    object: "committed",
    classification: "project-policy",
    applicability: { editions: ["bedrock"] },
    sourceIds: ["policy"],
  }],
};

describe("knowledge runtime diagnostics", () => {
  it("emits a violation only from explicit contradictory evidence", () => {
    const findings = knowledgeRuntimeDiagnostics({
      catalog,
      profile: { edition: "bedrock" },
      snapshot: {
        schemaVersion: 1,
        records: [{
          predicate: "committed",
          state: "present",
          confidence: "observed",
          scope: { arenaId: "arena-1", arenaGeneration: 3 },
        }, {
          predicate: "verified",
          state: "absent",
          confidence: "observed",
          scope: { arenaId: "arena-1", arenaGeneration: 3 },
        }],
      },
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]?.code).toBe("KNOWLEDGE_RELATION_VIOLATION");
    expect(findings[0]?.severity).toBe("medium");
  });

  it("does not treat missing evidence as explicit absence", () => {
    const findings = knowledgeRuntimeDiagnostics({
      catalog,
      profile: { edition: "bedrock" },
      snapshot: {
        schemaVersion: 1,
        records: [{
          predicate: "committed",
          state: "present",
          confidence: "observed",
          scope: { arenaId: "arena-1", arenaGeneration: 4 },
        }],
      },
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]?.code).toBe("KNOWLEDGE_EVIDENCE_GAP");
    expect(findings[0]?.severity).toBe("info");
  });

  it("honors critical severity only for explicit violations", () => {
    const criticalCatalog: KnowledgeCatalog = {
      ...catalog,
      relations: [{
        ...catalog.relations![0]!,
        diagnosticSeverity: "critical",
      }],
    };

    const violation = knowledgeRuntimeDiagnostics({
      catalog: criticalCatalog,
      profile: { edition: "bedrock" },
      snapshot: {
        schemaVersion: 1,
        records: [{
          predicate: "committed",
          state: "present",
          confidence: "observed",
        }, {
          predicate: "verified",
          state: "absent",
          confidence: "observed",
        }],
      },
    });
    expect(violation[0]?.severity).toBe("critical");

    const unknown = knowledgeRuntimeDiagnostics({
      catalog: criticalCatalog,
      profile: { edition: "bedrock" },
      snapshot: {
        schemaVersion: 1,
        records: [{
          predicate: "committed",
          state: "present",
          confidence: "observed",
        }],
      },
    });
    expect(unknown[0]?.severity).toBe("info");
  });
  it("retains requires-any alternative source provenance in diagnostic data", () => {
    const alternatives: KnowledgeCatalog = {
      ...catalog,
      relations: [{
        id: "navigation-requires-provider",
        domain: "entity-ai",
        subject: "navigation",
        kind: "requires-any",
        object: "provider-a | provider-b",
        applicability: { editions: ["bedrock"] },
        sourceIds: ["policy"],
      }],
    };
    const findings = knowledgeRuntimeDiagnostics({
      catalog: alternatives,
      profile: { edition: "bedrock" },
      snapshot: {
        schemaVersion: 1,
        records: [{
          predicate: "navigation",
          state: "present",
          confidence: "observed",
          sourceRefs: [{ artifactId: "world", relativePath: "navigation.json" }],
        }, {
          predicate: "provider-a",
          state: "absent",
          confidence: "observed",
          sourceRefs: [{ artifactId: "world", relativePath: "provider-a.json" }],
        }, {
          predicate: "provider-b",
          state: "unknown",
          confidence: "unknown",
          sourceRefs: [{ artifactId: "world", relativePath: "provider-b.json" }],
        }],
      },
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.code).toBe("KNOWLEDGE_EVIDENCE_GAP");
    expect(findings[0]?.data?.evidenceSourceIds).toEqual([
      "world:navigation.json",
      "world:provider-a.json",
      "world:provider-b.json",
    ]);
  });

  it("keeps scoped causal provenance isolated while allowing broader scope evidence", () => {
    const record = (
      predicate: string,
      state: "present" | "absent",
      scope?: { arenaId?: string; playerKey?: string; operationId?: string },
    ) => ({
      predicate, state, confidence: "observed" as const,
      ...(scope === undefined ? {} : { scope }),
    });
    const findings = knowledgeRuntimeDiagnostics({
      catalog,
      profile: { edition: "bedrock" },
      snapshot: {
        schemaVersion: 1,
        records: [
          record("committed", "present", { arenaId: "alpha" }),
          record("verified", "absent", { arenaId: "alpha", playerKey: "p" }),
          record("verified", "present", { arenaId: "alpha", playerKey: "q" }),
          record("alpha-child", "present", { arenaId: "alpha", playerKey: "q" }),
          record("committed", "present", { arenaId: "beta", playerKey: "p" }),
          record("verified", "absent", { arenaId: "beta", playerKey: "p" }),
          record("beta-only", "present", { arenaId: "beta", playerKey: "p" }),
          record("committed", "present", { operationId: "other" }),
          record("operation-only", "present", { operationId: "other" }),
          record("unscoped-only", "present"),
          record("committed", "present", {}),
        ],
      },
    });
    const fromScope = (scope: Record<string, unknown>) =>
      findings.find(item =>
        JSON.stringify(item.data?.runtimeScope) === JSON.stringify(scope));
    expect(fromScope({ arenaId: "alpha" })?.data?.presentPredicates)
      .toEqual(["alpha-child", "committed", "verified"]);
    expect(fromScope({ arenaId: "beta", playerKey: "p" })?.data?.presentPredicates)
      .toEqual(["beta-only", "committed"]);
    expect(fromScope({ operationId: "other" })?.data?.presentPredicates)
      .toEqual(["committed", "operation-only"]);
    // A present-but-empty scope keeps the legacy all-scoped evidence
    // interpretation; an absent scope must never join a scoped claim.
    expect(fromScope({})?.data?.presentPredicates)
      .toEqual(["alpha-child", "beta-only", "committed", "operation-only", "verified"]);
    expect(findings.some(item =>
      item.data?.presentPredicates?.includes("unscoped-only")))
      .toBe(false);
    expect(fromScope({ arenaId: "beta", playerKey: "p" })?.code)
      .toBe("KNOWLEDGE_RELATION_VIOLATION");
  });

});
