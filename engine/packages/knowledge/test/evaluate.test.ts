// Consolidated same-owner knowledge source tests; full original lexical blocks preserved.
import { describe, expect, it } from "vitest";
import { assessKnowledgeRelations, validationPlanFromAssessments, assessKnowledgeFreshness, createKnowledgeChangeCandidate, evaluateKnowledgeApplicabilityV2, validateKnowledgeClaimV2, effectiveKnowledge, validateKnowledgeCatalog, mergeKnowledgeCatalogs } from "../src/index.js";
import type { KnowledgeCatalog, KnowledgeClaimV2 } from "../src/index.js";
import type { MinecraftRuntimeProfile } from "../../runtime-profile/src/index.js";

// Original engine/packages/knowledge/test/evaluate.test.ts 19a7a35d33ea81a20f941310347326d4804ea629
{
const catalog: KnowledgeCatalog = {
  schemaVersion: 1,
  sources: [{
    id: "policy",
    title: "Policy",
    url: "project://knowledge/evaluator-test",
    authority: "project-policy",
    confidence: "designed",
    retrievedDate: "2026-09-24",
  }],
  facts: [],
  relations: [{
    id: "verify-gates-commit",
    domain: "world-mutation",
    subject: "verified-state",
    kind: "gates",
    object: "committed-state",
    classification: "project-policy",
    applicability: { editions: ["bedrock"] },
    sourceIds: ["policy"],
  }, {
    id: "cleanup-restores-baseline",
    domain: "arena-cleanup",
    subject: "cleanup-complete",
    kind: "restores",
    object: "arena-baseline",
    classification: "project-policy",
    applicability: { editions: ["bedrock"] },
    sourceIds: ["policy"],
  }],
};

describe("knowledge relation evaluator", () => {
  it("reports an explicit gate violation without treating unknown as absent", () => {
    const assessments = assessKnowledgeRelations(
      catalog,
      { edition: "bedrock" },
      {
        "committed-state": { state: "present", sourceIds: ["runtime:a"] },
        "verified-state": { state: "absent", sourceIds: ["runtime:b"] },
        "cleanup-complete": { state: "present" },
      },
    );

    expect(assessments.find((item) => item.relationId === "verify-gates-commit")?.status)
      .toBe("violation");
    expect(assessments.find((item) => item.relationId === "cleanup-restores-baseline")?.status)
      .toBe("unknown");
  });

  it("turns violations and evidence gaps into future validation cases", () => {
    const assessments = assessKnowledgeRelations(
      catalog,
      { edition: "bedrock" },
      {
        "committed-state": { state: "present" },
        "verified-state": { state: "absent" },
        "cleanup-complete": { state: "present" },
      },
    );
    const plan = validationPlanFromAssessments(assessments);
    expect(plan).toHaveLength(2);
    expect(plan.some((item) => item.priority === "high")).toBe(true);
    expect(plan.some((item) => item.strategy === "repeatability")).toBe(true);
  });
  it("preserves alternative evidence provenance for requires-any relation", () => {
    const alternativeCatalog: KnowledgeCatalog = {
      ...catalog,
      relations: [{
        id: "route-requires-one-provider",
        domain: "entity-ai",
        subject: "route",
        kind: "requires-any",
        object: "provider-a | provider-b",
        applicability: { editions: ["bedrock"] },
        sourceIds: ["policy"],
      }],
    };
    const [assessment] = assessKnowledgeRelations(
      alternativeCatalog,
      { edition: "bedrock" },
      {
        route: { state: "present", sourceIds: ["runtime:route"] },
        "provider-a": { state: "absent", sourceIds: ["runtime:a"] },
        "provider-b": { state: "unknown", sourceIds: ["runtime:b"] },
      },
    );
    expect(assessment?.status).toBe("unknown");
    expect(assessment?.evidenceSourceIds).toEqual([
      "runtime:route",
      "runtime:a",
      "runtime:b",
    ]);
    expect(validationPlanFromAssessments([assessment!])[0]?.evidenceSourceIds)
      .toEqual(assessment?.evidenceSourceIds);
  });

});
}

// Original engine/packages/knowledge/test/freshness.test.ts 4e2b15d157684ea4793d08103a887ff4b7abf1c7
{
describe("knowledge freshness", () => {
  const current = { sourceId: "official:update", url: "https://example.test", authority: "official" as const, contentFingerprint: "b", capturedAt: "2026-10-01T00:00:00Z" };
  it("quarantines changed source instead of promoting truth", () => {
    const baseline = { ...current, contentFingerprint: "a", capturedAt: "2026-09-01T00:00:00Z" };
    const assessment = assessKnowledgeFreshness(baseline, current, "2026-10-01T00:00:00Z", 30);
    expect(assessment.state).toBe("changed");
    expect(createKnowledgeChangeCandidate(baseline, current, assessment)?.state).toBe("quarantined");
  });
});
}

// Original engine/packages/knowledge/test/knowledge-claim-contracts.test.ts f58e3e3fd5f38a926417e5457573668156900050
{
const partialProfile: MinecraftRuntimeProfile = {
  schemaVersion: 2,
  product: {
    family: "bedrock-engine",
    edition: "education",
    version: "1.26.32",
  },
  host: "education-host",
  scriptModules: {},
  experiments: [],
  inventory: {
    scriptModules: "partial",
    experiments: "partial",
    worldSettings: "partial",
    packs: "partial",
  },
};

describe("knowledge claim applicability and provenance contracts", () => {
  it("returns unknown when required module absence is not proven", () => {
    expect(evaluateKnowledgeApplicabilityV2({
      editions: ["education"],
      scriptModules: {
        "@minecraft/server": {
          minVersion: "2.9.0",
        },
      },
    }, partialProfile)).toEqual({
      state: "unknown",
      reasons: [
        "Required Script API module is not observed, but module inventory is not complete.",
      ],
      missing: ["script-module:@minecraft/server"],
    });
  });

  it("returns does-not-apply only when a complete inventory proves absence", () => {
    expect(evaluateKnowledgeApplicabilityV2({
      scriptModules: {
        "@minecraft/server": {},
      },
    }, {
      ...partialProfile,
      inventory: {
        ...partialProfile.inventory,
        scriptModules: "complete",
      },
    }).state).toBe("does-not-apply");
  });

  it("requires provenance appropriate to the claim class", () => {
    const claim: KnowledgeClaimV2 = {
      schemaVersion: 2,
      id: "entity.event.example",
      subject: {
        kind: "event",
        id: "example",
      },
      predicate: "applies-effects-at",
      object: "entity-tick",
      classification: "documented-contract",
      applicability: {
        editions: ["bedrock-retail", "education"],
      },
      evidence: [],
      certainty: "established",
      lifecycle: "verified",
    };

    expect(validateKnowledgeClaimV2(claim)).toEqual([
      "Established knowledge claims require explicit evidence.",
      "Documented-contract claims require source-revision evidence.",
    ]);
  });
});
}

// Original engine/packages/knowledge/test/knowledge.test.ts 1530061ac90913856bf2135957897bab57b3bd00
{
const catalog: KnowledgeCatalog = {
  schemaVersion: 1,
  sources: [{
    id: "official",
    title: "Official",
    url: "https://learn.microsoft.com/example",
    authority: "official",
    confidence: "documented",
    retrievedDate: "2026-09-23",
  }],
  facts: [{
    id: "bedrock-only",
    domain: "commands",
    subject: "teleport",
    statement: "fixture",
    applicability: { editions: ["bedrock"] },
    sourceIds: ["official"],
    capabilityTags: ["command:teleport"],
    riskSurfaces: ["entity-position"],
  }, {
    id: "edu-only",
    domain: "education",
    subject: "npc",
    statement: "fixture",
    applicability: { editions: ["education"] },
    sourceIds: ["official"],
    capabilityTags: ["education:npc"],
    riskSurfaces: ["education-profile"],
  }],
};

describe("knowledge catalog", () => {
  it("validates provenance and IDs", () => {
    expect(validateKnowledgeCatalog(catalog)).toEqual([]);
  });

  it("requires explicit project-policy provenance for design rules", () => {
    const policyCatalog: KnowledgeCatalog = {
      schemaVersion: 1,
      sources: [{
        id: "policy",
        title: "Project Policy",
        url: "https://github.com/MIVUBI-STD/M-Bedrock-Dev/policy",
        authority: "project-policy",
        confidence: "designed",
        retrievedDate: "2026-09-23",
      }],
      facts: [{
        id: "coverage-policy",
        domain: "chunks",
        subject: "coverage-radius",
        statement: "fixture",
        classification: "project-policy",
        applicability: { editions: ["bedrock"] },
        sourceIds: ["policy"],
        capabilityTags: ["chunk-coverage"],
        riskSurfaces: ["chunk-lifecycle"],
      }],
    };
    expect(validateKnowledgeCatalog(policyCatalog)).toEqual([]);

    expect(validateKnowledgeCatalog({
      ...policyCatalog,
      sources: [{
        ...policyCatalog.sources[0]!,
        authority: "official",
        confidence: "documented",
      }],
    })).toEqual([
      "Project-policy knowledge fact requires project-policy provenance: coverage-policy",
    ]);
  });

  it("accepts open assumptions as explicit non-guarantees", () => {
    const assumptionCatalog: KnowledgeCatalog = {
      schemaVersion: 1,
      sources: [{
        id: "official",
        title: "Official",
        url: "https://learn.microsoft.com/example",
        authority: "official",
        confidence: "documented",
        retrievedDate: "2026-09-23",
      }],
      facts: [{
        id: "assumption",
        domain: "chunks",
        subject: "spectator-loading",
        statement: "Runtime proof required.",
        classification: "open-assumption",
        applicability: { editions: ["bedrock"] },
        sourceIds: ["official"],
        capabilityTags: ["runtime-proof"],
        riskSurfaces: ["chunk-lifecycle"],
      }],
    };
    expect(validateKnowledgeCatalog(assumptionCatalog)).toEqual([]);
  });

  it("builds edition-specific effective knowledge", () => {
    expect(effectiveKnowledge(catalog, { edition: "bedrock" }).map((fact) => fact.id))
      .toEqual(["bedrock-only"]);
    expect(effectiveKnowledge(catalog, { edition: "education" }).map((fact) => fact.id))
      .toEqual(["edu-only"]);
  });
});
}

// Original engine/packages/knowledge/test/merge.test.ts acfe3fb6522ce92b7ce39a8b193d4dd616f1dbf0
{
function catalog(url: string): KnowledgeCatalog {
  return {
    schemaVersion: 1,
    sources: [{
      id: "shared",
      title: "Shared official source",
      url,
      authority: "official",
      confidence: "documented",
      retrievedDate: "2026-09-23",
    }],
    facts: [],
  };
}

describe("knowledge catalog merge", () => {
  it("deduplicates identical provenance source ids across domain catalogs", () => {
    const merged = mergeKnowledgeCatalogs([
      catalog("https://learn.microsoft.com/example"),
      catalog("https://learn.microsoft.com/example"),
    ]);
    expect(merged.sources).toHaveLength(1);
  });

  it("rejects the same source id with conflicting provenance", () => {
    expect(() => mergeKnowledgeCatalogs([
      catalog("https://learn.microsoft.com/a"),
      catalog("https://learn.microsoft.com/b"),
    ])).toThrow(/Conflicting knowledge source id/);
  });
});
}
