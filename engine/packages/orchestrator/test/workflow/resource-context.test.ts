import { describe, expect, it } from "vitest";
import type { RetrievalResult } from "../../../analysis-planner/src/index.js";
import {
  compileResourceContext,
  compileSectionContext,
  compileDeveloperPracticeReferenceContext,
  type RetrievedKnowledgeContext,
} from "../../src/workflow/resource-context.js";

const selection: readonly RetrievalResult[] = [
  {
    resource: {
      id: "document.analysis.player-lifecycle",
      class: "DOCUMENT",
      domain: "analysis",
      role: "DOMAIN",
      authority: "CANONICAL",
      path: "docs/analysis/player-lifecycle.md",
      lifecycle: "ACTIVE",
    },
    score: {
      routing: 30,
      graph: 12,
      structural: 16,
      lexical: 0,
      semantic: 0,
      authority: 20,
      total: 78,
    },
    reasons: [
      "domain-route",
      "graph-relation",
      "structural-match",
      "authority:CANONICAL",
    ],
  },
  {
    resource: {
      id: "reliability.system.history",
      class: "RELIABILITY",
      domain: "system",
      authority: "HISTORICAL",
      path: "engine/reliability/history",
      lifecycle: "ACTIVE",
    },
    score: {
      routing: 0,
      graph: 0,
      structural: 8,
      lexical: 0,
      semantic: 0,
      authority: 0,
      total: 8,
    },
    reasons: [
      "structural-match",
      "authority:HISTORICAL",
    ],
  },
];

describe("compileResourceContext", () => {
  it("preserves authority and ranking provenance", () => {
    const context = compileResourceContext(selection, 1);

    expect(context).toEqual({
      items: [
        {
          id: "document.analysis.player-lifecycle",
          class: "DOCUMENT",
          domain: "analysis",
          role: "DOMAIN",
          authority: "CANONICAL",
          path: "docs/analysis/player-lifecycle.md",
          score: 78,
          reasons: [
            "domain-route",
            "graph-relation",
            "structural-match",
            "authority:CANONICAL",
          ],
        },
      ],
      omitted: 1,
    });
  });

  it("delivers selected Knowledge content with provenance and explicit unknown applicability", () => {
    const chosen: RetrievalResult = {
      ...selection[0]!,
      resource: {
        id: "knowledge.persistence.relation-worldload-gates-reconcile",
        class: "KNOWLEDGE",
        domain: "persistence",
        authority: "REFERENCE",
        path: "engine/knowledge/world-engine/persistence-bedrock.json",
        locator: "persistence.relation-worldload-gates-reconcile",
        lifecycle: "ACTIVE",
      },
    };
    const record: RetrievedKnowledgeContext = {
      kind: "relation",
      subject: "worldLoad",
      summary: "worldLoad gates durable-state-reconciliation",
      classification: "derived-rule",
      applicability: { editions: ["bedrock", "education"] },
      applicabilityStatus: "NOT_EVALUATED",
      sourceIds: ["ms-persist-v2"],
      sources: [{
        id: "ms-persist-v2",
        title: "Multiplayer-Aware Scripts",
        url: "https://learn.microsoft.com/en-us/minecraft/creator/",
        authority: "official",
        confidence: "documented",
        retrievedDate: "2026-09-23",
      }],
      relation: { kind: "gates", object: "durable-state-reconciliation" },
    };
    const withContent = compileResourceContext([chosen], 1, {
      [chosen.resource.id]: record,
    });
    expect(withContent?.items[0]?.knowledge).toEqual(record);
    expect(withContent?.knowledgeContent).toEqual({
      status: "COMPLETE",
      missingResourceIds: [],
    });

    const withoutContent = compileResourceContext([chosen], 1, {});
    expect(withoutContent?.items[0]?.knowledge).toBeUndefined();
    expect(withoutContent?.knowledgeContent).toEqual({
      status: "PARTIAL",
      missingResourceIds: [chosen.resource.id],
    });
  });

  it("evaluates selected Knowledge against an explicit target profile without promoting it to runtime proof", () => {
    const selected = {
      ...selection[0]!,
      resource: {
        id: "knowledge.persistence.dynamic-properties-survive-restart",
        class: "KNOWLEDGE" as const,
        domain: "persistence",
        authority: "REFERENCE" as const,
        path: "engine/knowledge/world-engine/persistence-bedrock.json",
        locator: "persistence.dynamic-properties-survive-restart",
        lifecycle: "ACTIVE" as const,
      },
    };
    const record: RetrievedKnowledgeContext = {
      kind: "fact",
      subject: "dynamic properties",
      summary: "World dynamic properties survive restart.",
      classification: "engine-fact",
      applicability: {
        editions: ["bedrock"],
        versions: {
          minMinecraftVersion: "1.21.0",
          scriptModule: "@minecraft/server",
          scriptModuleVersion: "2.0.0",
        },
      },
      applicabilityStatus: "NOT_EVALUATED",
      sourceIds: ["official-example"],
      sources: [{
        id: "official-example",
        title: "Official reference",
        url: "https://learn.microsoft.com/en-us/minecraft/creator/",
        authority: "official",
        confidence: "documented",
        retrievedDate: "2026-09-23",
      }],
      capabilityTags: ["dynamic-properties"],
      riskSurfaces: ["stale-persistence"],
    };
    const profile = {
      schemaVersion: 2 as const,
      product: { family: "bedrock-engine" as const, edition: "bedrock-retail" as const, version: "1.21.30" },
      host: "client" as const,
      experiments: [],
      scriptModules: { "@minecraft/server": { version: "2.1.0", track: "stable" as const } },
      inventory: {
        scriptModules: "complete" as const,
        experiments: "unknown" as const,
        worldSettings: "unknown" as const,
        packs: "unknown" as const,
      },
    };
    const source = { [selected.resource.id]: record };
    const withoutProfile = compileResourceContext([selected], 1, source);
    expect(withoutProfile?.items[0]?.targetApplicability?.state).toBe("not-evaluated");

    const applies = compileResourceContext([selected], 1, source, profile);
    expect(applies?.items[0]?.targetApplicability?.state).toBe("applies");
    expect(applies?.items[0]?.knowledge?.applicabilityStatus).toBe("NOT_EVALUATED");

    const differentEdition = compileResourceContext([selected], 1, source, {
      ...profile,
      product: { ...profile.product, edition: "education" as const },
    });
    expect(differentEdition?.items[0]?.targetApplicability?.state).toBe("does-not-apply");

    const unknownModule = compileResourceContext([selected], 1, source, {
      ...profile,
      scriptModules: {},
      inventory: { ...profile.inventory, scriptModules: "partial" as const },
    });
    expect(unknownModule?.items[0]?.targetApplicability?.state).toBe("unknown");
    expect(unknownModule?.items[0]?.targetApplicability?.missing).toContain(
      "script-module:@minecraft/server",
    );
  });

  it("rejects invalid resource context limits", () => {
    expect(() => compileResourceContext(selection, 0)).toThrow(
      /positive integer/,
    );
  });
});

describe("compileSectionContext", () => {
  it("preserves exact document range and ranking provenance", () => {
    const context = compileSectionContext([
      {
        section: {
          id: "document.analysis.mandatory-audit-procedure#prove",
          documentId: "document.analysis.mandatory-audit-procedure",
          path: "docs/analysis/mandatory-audit-procedure.md",
          heading: "PROVE",
          level: 2,
          anchor: "prove",
          startLine: 100,
          endLine: 180,
        },
        score: {
          documentScope: 30,
          heading: 40,
          lexical: 0,
          semantic: 0,
          level: 8,
          total: 78,
        },
        reasons: [
          "document-scope",
          "heading-match",
          "heading-level:2",
        ],
      },
    ]);

    expect(context).toEqual({
      items: [
        {
          id: "document.analysis.mandatory-audit-procedure#prove",
          documentId: "document.analysis.mandatory-audit-procedure",
          path: "docs/analysis/mandatory-audit-procedure.md",
          heading: "PROVE",
          anchor: "prove",
          startLine: 100,
          endLine: 180,
          score: 78,
          reasons: [
            "document-scope",
            "heading-match",
            "heading-level:2",
          ],
        },
      ],
      omitted: 0,
    });
  });
});
// The manifest is a source declaration in a selected pack, not the engine
// version or proof that a pack's script actually executed in Minecraft.
describe("developer practice manifest-scoped version hints", () => {
  const ir = {
    schemaVersion: 1 as const,
    execution: { regions: [], edges: [] },
    state: { surfaces: [], operations: [], authorityBindings: [] },
    temporal: { relations: [] },
  };
  const data = {
    authority: "REFERENCE" as const,
    usagePolicy: "CONTEXT_HINT_ONLY_NOT_GAME_DESIGN_OR_DEFECT_PROOF" as const,
    sourceSnapshot: { archiveSha256: "a".repeat(64) },
    sourceFiles: [{
      id: "src.bedrock-version-targeting",
      path: "skills/bedrock-version-targeting/SKILL.md",
      sha256: "b".repeat(64),
      auditUsage: "INTERPRETATION_CANDIDATE",
    }],
    patterns: [{
      id: "developer.hint.version.compatibility",
      sourceId: "src.bedrock-version-targeting",
      kind: "IMPLEMENTATION_PATTERN",
      status: "SOURCE_REVIEWED",
      domains: ["manifest", "edition", "script-api"],
      sourceSignals: ["manifest.json", "min_engine_version", "@minecraft/server"],
      question: "What version does the selected pack declare?",
      candidateRelations: ["manifest dependency is not runtime support"],
      negativeControl: "A minimum engine version is not a live game version.",
      versionApplicability: "UNKNOWN",
      prohibits: "Never claim observed gameplay compatibility from manifest metadata.",
    }],
  };
  const witness = {
    packRoot: "behavior_packs/demo",
    source: {
      artifactId: "selected",
      relativePath: "behavior_packs/demo/manifest.json",
    },
    minEngineVersion: "1.21.0",
    scriptModules: [{
      moduleName: "@minecraft/server",
      version: "2.8.0",
      track: "stable",
    }],
    worldAttachment: "unknown" as const,
  };
  const baseline = {
    data, semanticIr: ir, selectedArtifactId: "selected",
    domains: ["manifest"], maximum: 2,
  };

  it("includes declared min-engine and Script API only for the selected pack", () => {
    const result = compileDeveloperPracticeReferenceContext({
      ...baseline,
      sourceLocators: ["behavior_packs/demo/scripts/main.ts:17"],
      manifestWitnesses: [witness],
    });
    expect(result?.items).toHaveLength(1);
    expect(result?.items[0]?.matchingSignals).toEqual(
      expect.arrayContaining(["manifest.json", "min_engine_version", "@minecraft/server"]),
    );
    expect(result?.items[0]?.manifestDeclarations).toEqual([{
      sourcePath: "behavior_packs/demo/manifest.json",
      minEngineVersion: "1.21.0",
      scriptModules: [{
        moduleName: "@minecraft/server", version: "2.8.0", track: "stable",
      }],
      worldAttachment: "unknown",
      proof: "MANIFEST_DECLARATION_ONLY",
    }]);
  });

  it("abstains from another pack, missing source, or another artifact", () => {
    for (const sourceLocators of [
      [],
      ["behavior_packs/another/scripts/main.js"],
      ["behavior_packs/demo-other/scripts/main.js"],
    ]) {
      const result = compileDeveloperPracticeReferenceContext({
        ...baseline, sourceLocators, manifestWitnesses: [witness],
      });
      expect(result?.items ?? []).toHaveLength(0);
    }
    const crossed = compileDeveloperPracticeReferenceContext({
      ...baseline,
      sourceLocators: ["behavior_packs/demo/scripts/main.ts"],
      manifestWitnesses: [{
        ...witness, source: { ...witness.source, artifactId: "other-map" },
      }],
    });
    expect(crossed?.items ?? []).toHaveLength(0);
  });

  it("does not treat invented min-engine versions as verified", () => {
    const result = compileDeveloperPracticeReferenceContext({
      ...baseline, sourceLocators: ["behavior_packs/demo/scripts/main.ts"],
      manifestWitnesses: [{ ...witness, minEngineVersion: "future" }],
    });
    expect(result?.items ?? []).toHaveLength(0);
  });
});
