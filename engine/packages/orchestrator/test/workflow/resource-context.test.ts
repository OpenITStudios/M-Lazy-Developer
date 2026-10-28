import { describe, expect, it } from "vitest";
import type { RetrievalResult } from "../../../analysis-planner/src/index.js";
import {
  compileResourceContext,
  compileSectionContext,
  compileDeveloperPracticeReferenceContext,
  prepareDeveloperPracticeReferenceSelector,
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
      methodology: {
        applicability: "MAP_SOURCE_INTERPRETATION" as const,
        sourceSections: ["1. Source meaning", "2. Counterexample"],
        objective: "Interpret the selected manifest declaration.",
        investigationSteps: [
          "Inspect the exact selected source.",
          "Compare its intended behavior with an alternative explanation.",
        ],
        disconfirmingCase: "Manifest versions do not prove an executed runtime.",
        proofBoundary: "EXTERNAL_DEVELOPER_METHOD_NOT_SELECTED_MAP_BEHAVIOR_PROOF" as const,
      },
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

  it("keeps per-audit precompiled typed IR references identical to per-query compilation", () => {
    const prepared = prepareDeveloperPracticeReferenceSelector(ir, "selected");
    for (const sourceLocators of [
      ["behavior_packs/demo/scripts/main.ts:17"],
      ["behavior_packs/demo-other/scripts/main.ts"],
      [],
    ]) {
      const query = {
        data, domains: ["manifest"], sourceLocators,
        manifestWitnesses: [witness], maximum: 2,
      };
      expect(prepared(query)).toEqual(compileDeveloperPracticeReferenceContext({
        ...query, semanticIr: ir, selectedArtifactId: "selected",
      }));
    }
    expect(prepareDeveloperPracticeReferenceSelector(ir, "other-artifact")({
      data, domains: ["manifest"],
      sourceLocators: ["behavior_packs/demo/scripts/main.ts"],
      manifestWitnesses: [witness],
    })?.items ?? []).toEqual([]);
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

  it("retains upstream clean-example status boundaries after an exact source match", () => {
    // Synthetic upstream-index fixture: the source/lock and selected-map
    // witness gates, NOT a claim that this example exists in Skills Probe.
    const exampleIndex = {
      schemaVersion: 1 as const,
      authority: "UPSTREAM_INDEX_ONLY_NOT_SELECTED_MAP_PROOF" as const,
      sourceArchiveSha256: "c".repeat(64),
      indexPath: "docs/examples/index.json" as const,
      indexSha256: "d".repeat(64),
      sourceSkillLockTag: "v0.23.0",
      sourceSkillLockCommit: "e".repeat(40),
      target: { client: "education 26.32", engine: "1.26.30" },
      entries: [{
        id: "X1",
        skill: "bedrock-version-targeting",
        status: "PASS" as const,
        nodeStatus: "PASS",
        engineStatus: "pending",
        probeIds: ["PX"],
        report: null,
        sourcePath: "docs/examples/version/README.md",
      }],
    };
    const full = {
      ...baseline,
      data: {
        ...data,
        probeSnapshot: { observedSkillsLockTag: "v0.23.0", observedSkillsLockCommit: "e".repeat(40), archiveSha256: "c".repeat(64), archiveHistorySha256: [] },
        probeExamples: exampleIndex,
      },
      sourceLocators: ["behavior_packs/demo/scripts/main.ts:17"],
      manifestWitnesses: [witness],
    };
    const result = compileDeveloperPracticeReferenceContext(full);
    expect(result?.items).toHaveLength(1);
    expect(result?.items[0]?.cleanExamples).toMatchObject([{
      id: "X1",
      status: "PASS",
      nodeStatus: "PASS",
      engineStatus: "pending",
      sourceSkillLockTag: "v0.23.0",
      proof: "UPSTREAM_SOURCE_INDEX_ONLY_NOT_SELECTED_MAP_PROOF",
    }]);

    const noWitness = compileDeveloperPracticeReferenceContext({
      ...full, sourceLocators: ["behavior_packs/other/scripts/main.ts"],
    });
    expect(noWitness?.items ?? []).toHaveLength(0);

    const wrongRelease = compileDeveloperPracticeReferenceContext({
      ...full,
      data: {
        ...full.data,
        probeSnapshot: { observedSkillsLockTag: "v0.27.0", archiveSha256: "c".repeat(64), archiveHistorySha256: [] },
      },
    });
    expect(wrongRelease?.items[0]?.cleanExamples).toBeUndefined();

    // The same installed skill-lock with a *different probe source ZIP*
    // cannot borrow the previous clean-example index's runtime claims.
    const wrongArchive = compileDeveloperPracticeReferenceContext({
      ...full,
      data: {
        ...full.data,
        probeSnapshot: {
          observedSkillsLockTag: "v0.23.0",
          archiveSha256: "f".repeat(64),
          archiveHistorySha256: ["c".repeat(64)],
        },
      },
    });
    expect(wrongArchive?.items[0]?.cleanExamples).toBeUndefined();
  });
  it("never selects a source-reviewed but un-routed upstream technical skill", () => {
    const unroutedData = {
      ...data,
      sourceFiles: data.sourceFiles.map(file => ({
        ...file,
        id: "src.bedrock-player-attached-particles",
        path: "skills/bedrock-player-attached-particles/SKILL.md",
        auditUsage: "REFERENCE_ONLY_NOT_ROUTED",
        methodology: {
          ...file.methodology,
          applicability: "UNROUTED_TECHNICAL_REFERENCE" as const,
        },
      })),
      patterns: data.patterns.map(pattern => ({
        ...pattern,
        sourceId: "src.bedrock-player-attached-particles",
      })),
    };
    const result = compileDeveloperPracticeReferenceContext({
      ...baseline,
      data: unroutedData,
      sourceLocators: ["behavior_packs/demo/scripts/main.ts:17"],
      manifestWitnesses: [witness],
    });
    expect(result?.items).toEqual([]);
  });

});

describe("source-first Daigon export investigation reference", () => {
  const source = {
    artifactId: "selected",
    relativePath: "behavior_packs/demo/scripts/results.ts",
    range: { lineStart: 12, lineEnd: 12, columnStart: 1, columnEnd: 65 },
  };
  const subscription = {
    id: "event:results",
    kind: "event-source" as const,
    ownerId: "system",
    label: "system.afterEvents.scriptEventReceive",
    source,
    scriptEventIdRejection: {
      eventId: "daigon:get_all_scoring",
      source,
      valueSource: source,
      resolution: "inline-literal" as const,
    },
  };
  const data = {
    authority: "REFERENCE" as const,
    usagePolicy: "CONTEXT_HINT_ONLY_NOT_GAME_DESIGN_OR_DEFECT_PROOF" as const,
    sourceSnapshot: { archiveSha256: "a".repeat(64), release: "v0.27.0" },
    sourceFiles: [{
      id: "src.bedrock-game-results",
      path: "skills/bedrock-game-results/SKILL.md",
      sha256: "b".repeat(64),
      auditUsage: "INTERPRETATION_CANDIDATE",
      methodology: {
        applicability: "MAP_SOURCE_INTERPRETATION" as const,
        sourceSections: ["1. How the export works"],
        objective: "Check Daigon export only when adopted by this map.",
        investigationSteps: [
          "Establish selected-map Daigon requirement.",
          "Inspect original handler and stored snapshot source.",
        ],
        disconfirmingCase: "Unrelated ScriptEventReceive is not a Daigon contract.",
        proofBoundary: "EXTERNAL_DEVELOPER_METHOD_NOT_SELECTED_MAP_BEHAVIOR_PROOF" as const,
      },
    }],
    patterns: [{
      id: "developer.hint.game-results.daigon-export",
      sourceId: "src.bedrock-game-results",
      status: "SOURCE_REVIEWED" as const,
      domains: ["scoring", "result"],
      sourceSignals: ["scriptevent:daigon:get_all_scoring"],
      question: "Does an explicitly adopted results export satisfy its contract?",
      candidateRelations: ["subscription to potential export investigation"],
      negativeControl: "A generic event subscriber never proves Daigon scope.",
      versionApplicability: "SOURCE_SCOPE_ONLY",
      prohibits: "No Daigon bug without map-specific contractual proof.",
    }],
  };
  const context = (event: typeof subscription, sourceLocators: string[], domains = ["scoring"]) =>
    compileDeveloperPracticeReferenceContext({
      data,
      semanticIr: {
        schemaVersion: 1 as const,
        execution: { regions: [event], edges: [] },
        state: { surfaces: [], operations: [], authorityBindings: [] },
        temporal: { relations: [] },
      },
      selectedArtifactId: "selected",
      domains,
      sourceLocators,
    });

  it("routes the reviewed developer question only from an exact authored Daigon event filter", () => {
    const result = context(subscription, ["behavior_packs/demo/scripts/results.ts:12:20"]);
    expect(result?.items.map(item => item.patternId)).toEqual([
      "developer.hint.game-results.daigon-export",
    ]);
    expect(result?.items[0]?.methodology?.investigationSteps).toHaveLength(2);
    expect(result?.authority).toBe("REFERENCE");
    expect(result?.status).toBe("INVESTIGATION_HINTS_ONLY");
  });

  it("refuses a spoofed event root, another map/source, or an unrelated question", () => {
    for (const event of [
      { ...subscription, ownerId: "world" },
      { ...subscription, label: "system.afterEvents.anotherEvent" },
      { ...subscription, source: { ...source, artifactId: "other-map" } },
      { ...subscription, scriptEventIdRejection: undefined },
      { ...subscription, scriptEventIdRejection: {
        ...subscription.scriptEventIdRejection, eventId: "other:export",
      } },
      { ...subscription, scriptEventIdRejection: {
        ...subscription.scriptEventIdRejection,
        valueSource: { ...source, artifactId: "other-map" },
      } },
    ]) {
      expect(context(event, ["behavior_packs/demo/scripts/results.ts:12:20"])?.items)
        .toEqual([]);
    }
    expect(context(subscription, ["behavior_packs/demo/scripts/elsewhere.ts"])?.items)
      .toEqual([]);
    expect(context(subscription, ["behavior_packs/demo/scripts/results.ts:12:20"], ["combat"])?.items)
      .toEqual([]);
  });
});
