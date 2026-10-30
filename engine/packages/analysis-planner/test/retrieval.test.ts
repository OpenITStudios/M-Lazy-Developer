// Coherent Development test family, source-only consolidation.
// Original cases and assertions remain; executable equivalence not yet proven.
import { describe, expect, it } from "vitest";
import { BUILTIN_ANALYSIS_CAPABILITIES, createAnalysisCapabilityRegistry, planMinimumSufficientAnalysis, assertEngineeringTaskPreconditions, routeEngineeringTask } from "../src/index.js";
import { retrieveResources, scoreTextDocuments, prepareTextDocumentScorer, type CatalogResource, type GraphEdge } from "../src/retrieval.js";
import { retrieveDocumentSections, type DocumentSection } from "../src/section-retrieval.js";

// Original suite: engine/packages/analysis-planner/test/domain-capabilities.test.ts (blob bebc6da2eacd0d50b96d93b5944dd1ddcef8c29d)
{


describe("domain analysis capabilities", () => {
  it("forms one valid builtin capability registry", () => {
    const registry =
      createAnalysisCapabilityRegistry(
        BUILTIN_ANALYSIS_CAPABILITIES,
      );

    expect(registry.capabilities.length)
      .toBe(
        BUILTIN_ANALYSIS_CAPABILITIES.length,
      );
  });

  it("selects inventory semantic analysis directly in remote GitHub context", () => {
    const plan =
      planMinimumSufficientAnalysis({
        goal: "semantic-consistency",
        relevantTags: [
          "inventory",
          "loadout",
        ],
        context: "REMOTE_GITHUB",
        capabilities:
          BUILTIN_ANALYSIS_CAPABILITIES,
      });

    expect(plan.disposition)
      .toBe("execute");
    expect(plan.steps[0]).toMatchObject({
      capabilityId:
        "inventory-lifecycle-integrity",
      evidenceLevel: "semantic",
      cost: "moderate",
    });
  });

  it("selects static navigation readiness before expensive runtime navigation", () => {
    const plan =
      planMinimumSufficientAnalysis({
        goal: "runtime-behavior",
        relevantTags: [
          "entity",
          "navigation",
        ],
        context: "LIVE_MINECRAFT",
        capabilities:
          BUILTIN_ANALYSIS_CAPABILITIES,
      });

    expect(plan.disposition)
      .toBe("execute");
    expect(plan.steps[0]?.capabilityId)
      .toBe(
        "entity-ai-navigation-readiness",
      );
  });

  it("advances to runtime navigation after semantic prerequisite is complete", () => {
    const plan =
      planMinimumSufficientAnalysis({
        goal: "runtime-behavior",
        relevantTags: [
          "entity",
          "navigation",
        ],
        context: "LIVE_MINECRAFT",
        completedCapabilityIds: [
          "entity-ai-navigation-readiness",
        ],
        availableEvidence: [{
          level: "semantic",
          evidenceIds: [
            "entity-ai-stack:demo:zombie",
          ],
          quality: "usable",
          traits: ["semantic-model"],
        }],
        capabilities:
          BUILTIN_ANALYSIS_CAPABILITIES,
      });

    expect(plan.disposition)
      .toBe("execute");
    expect(plan.steps[0]?.capabilityId)
      .toBe(
        "entity-ai-navigation-runtime",
      );
  });

  it("does not invent runtime economy capability where no controlled experiment exists", () => {
    const plan =
      planMinimumSufficientAnalysis({
        goal: "runtime-behavior",
        relevantTags: [
          "economy",
          "reward",
        ],
        context: "LIVE_MINECRAFT",
        completedCapabilityIds: [
          "economy-reward-integrity",
        ],
        availableEvidence: [{
          level: "semantic",
          evidenceIds: [
            "economy:semantic",
          ],
          quality: "usable",
          traits: ["semantic-model"],
        }],
        capabilities:
          BUILTIN_ANALYSIS_CAPABILITIES,
      });

    expect(plan.disposition)
      .toBe("capability-gap");
    expect(plan.steps).toEqual([]);
  });

  it("selects persistence semantic analysis before runtime recovery", () => {
    const plan =
      planMinimumSufficientAnalysis({
        goal: "runtime-behavior",
        relevantTags: [
          "persistence",
          "recovery",
        ],
        context: "LIVE_MINECRAFT",
        capabilities:
          BUILTIN_ANALYSIS_CAPABILITIES,
      });

    expect(plan.disposition).toBe("execute");
    expect(plan.steps[0]).toMatchObject({
      capabilityId:
        "persistence-lifecycle-integrity",
      evidenceLevel: "semantic",
      cost: "moderate",
    });
  });

  it("advances persistence analysis to controlled runtime recovery after semantic evidence", () => {
    const plan =
      planMinimumSufficientAnalysis({
        goal: "runtime-behavior",
        relevantTags: [
          "persistence",
          "recovery",
        ],
        context: "LIVE_MINECRAFT",
        completedCapabilityIds: [
          "persistence-lifecycle-integrity",
        ],
        availableEvidence: [{
          level: "semantic",
          evidenceIds: [
            "persistence:semantic",
          ],
          quality: "usable",
          traits: ["semantic-model"],
        }],
        capabilities:
          BUILTIN_ANALYSIS_CAPABILITIES,
      });

    expect(plan.disposition).toBe("execute");
    expect(plan.steps[0]).toMatchObject({
      capabilityId:
        "persistence-recovery-runtime",
      evidenceLevel: "runtime",
      cost: "expensive",
    });
  });

});
}

// Original suite: engine/packages/analysis-planner/test/retrieval.test.ts (blob e5c3cecbda1dcae017146c204db4fdcf17b8c571)
{


const resources: readonly CatalogResource[] = [
  {
    id: "document.analysis.inventory-runtime",
    class: "DOCUMENT",
    domain: "analysis",
    role: "DOMAIN",
    authority: "CANONICAL",
    path: "docs/analysis/inventory-runtime.md",
    lifecycle: "ACTIVE",
  },
  {
    id: "document.analysis.player-lifecycle",
    class: "DOCUMENT",
    domain: "analysis",
    role: "DOMAIN",
    authority: "CANONICAL",
    path: "docs/analysis/player-lifecycle.md",
    lifecycle: "ACTIVE",
  },
  {
    id: "knowledge.player-runtime.inventory",
    class: "KNOWLEDGE",
    domain: "player-runtime",
    authority: "REFERENCE",
    path: "engine/knowledge/player-runtime/inventory-bedrock.json",
    lifecycle: "ACTIVE",
  },
  {
    id: "reliability.system.history",
    class: "RELIABILITY",
    domain: "system",
    authority: "HISTORICAL",
    path: "engine/reliability/history",
    lifecycle: "ACTIVE",
  },
  {
    id: "document.system.retired-note",
    class: "DOCUMENT",
    domain: "system",
    role: "DOMAIN",
    authority: "CANONICAL",
    path: "docs/system/retired-note.md",
    lifecycle: "RETIRED",
  },
];

const edges: readonly GraphEdge[] = [
  {
    from: "document.analysis.player-lifecycle",
    type: "RELATES_TO",
    to: "document.analysis.inventory-runtime",
  },
  {
    from: "document.analysis.inventory-runtime",
    type: "USES",
    to: "knowledge.player-runtime.inventory",
  },
];

describe("retrieveResources", () => {
  it("scores in-memory text with the same scorer used by repository and map audit context", () => {
    const scores = scoreTextDocuments([{
      id: "knowledge.inventory",
      text: "Arena cleanup resets player inventory and equipment slots.",
    }, {
      id: "knowledge.chunks",
      text: "Chunk simulation and ticking area loading.",
    }], "arena cleanup inventory equipment");
    expect(scores["knowledge.inventory"]).toBe(1);
    expect(scores["knowledge.chunks"]).toBeUndefined();
    expect(scoreTextDocuments([], "inventory")).toEqual({});
    expect(scoreTextDocuments([{
      id: "empty", text: "inventory",
    }], "")).toEqual({});
  });

  it("reuses BM25 document tokens across queries without changing ranking or duplicate-ID overwrite", () => {
    const docs = [
      { id: "same", text: "arena rescue ☃ player state" },
      { id: "other", text: "state ownership persistence 重大" },
      { id: "same", text: "arena return player slot" },
    ];
    const prepared = prepareTextDocumentScorer(docs);
    for (const query of [
      "arena player", "state ownership", "重大 persistence", "not-present", "",
    ]) {
      expect(prepared(query)).toEqual(scoreTextDocuments(docs, query));
    }
    expect(prepared("arena return").same).toBeGreaterThan(0);
  });

  it("preserves dense-reference BM25 scores with sparse postings, Unicode and duplicate IDs", () => {
    // Frozen from the pre-index, full-document-scan scorer; do not regenerate
    // expectations from the optimized scorer under test.
    const docs = [
      { id: "same", text: "arena reset arena player score" },
      { id: "other", text: "score world loading tick" },
      { id: "same", text: "state persistence 重大 inventory" },
      { id: "last", text: "minecraft ナビゲーション world state" },
      { id: "empty", text: "" },
      { id: "other", text: "player state arena" },
    ];
    const scorer = prepareTextDocumentScorer(docs);
    const cases: readonly [string, Readonly<Record<string, number>>][] = [
      ["arena player", { other: 1, same: 0.9782417292157339 }],
      ["world state", {
        last: 1, other: 0.4522917024736386, same: 0.4023453795010897,
      }],
      ["重大 persistence", { same: 1 }],
      ["minecraft ナビゲーション", { last: 1 }],
      ["unmatched", {}],
      ["", {}],
      ["arena arena score", { other: 0.5111211115486302, same: 1 }],
      ["player state arena world", {
        last: 0.5567977839099212, other: 1,
        same: 0.22402501567260294,
      }],
    ];
    for (const [query, expected] of cases) {
      expect(scorer(query)).toEqual(expected);
    }
  });

  it("keeps routing structural and authority signals explicit", () => {
    const results = retrieveResources(resources, edges, {
      text: "inventory reconnect lifecycle",
      domains: ["analysis"],
      limit: 10,
    });

    expect(results.map((item) => item.resource.id)).toEqual([
      "document.analysis.inventory-runtime",
      "document.analysis.player-lifecycle",
    ]);
    expect(results[0]?.score.routing).toBe(30);
    expect(results[0]?.reasons).toContain("authority:CANONICAL");
  });

  it("uses graph seeds to expand bounded candidates", () => {
    const results = retrieveResources(resources, edges, {
      text: "",
      seedIds: ["document.analysis.player-lifecycle"],
      limit: 10,
    });

    expect(results.map((item) => item.resource.id)).toEqual([
      "document.analysis.player-lifecycle",
      "document.analysis.inventory-runtime",
    ]);
    expect(results[1]?.reasons).toContain("graph-relation");
  });

  it("expands to a second graph hop only when requested", () => {
    const oneHop = retrieveResources(resources, edges, {
      text: "",
      seedIds: ["document.analysis.player-lifecycle"],
      limit: 10,
    });
    const twoHop = retrieveResources(resources, edges, {
      text: "",
      seedIds: ["document.analysis.player-lifecycle"],
      graphDepth: 2,
      limit: 10,
    });

    expect(
      oneHop.some(
        (item) =>
          item.resource.id === "knowledge.player-runtime.inventory",
      ),
    ).toBe(false);
    expect(
      twoHop.some(
        (item) =>
          item.resource.id === "knowledge.player-runtime.inventory",
      ),
    ).toBe(true);
  });

  it("does not surface unrelated historical data by default routed scope", () => {
    const results = retrieveResources(resources, edges, {
      text: "inventory",
      domains: ["analysis"],
    });

    expect(
      results.some((item) => item.resource.authority === "HISTORICAL"),
    ).toBe(false);
  });

  it("allows historical data only when explicitly requested", () => {
    const results = retrieveResources(resources, edges, {
      text: "",
      includeHistorical: true,
      limit: 50,
    });

    expect(
      results.some((item) => item.resource.authority === "HISTORICAL"),
    ).toBe(true);
  });

  it("recovers scored knowledge for an orphaned source seed without restoring administrative edges", () => {
    const orphan = {
      id: "source.package.orchestrator",
      class: "SOURCE" as const,
      domain: "package",
      authority: "CANONICAL" as const,
      path: "engine/packages/orchestrator",
      lifecycle: "ACTIVE" as const,
    };
    const corpus = [...resources, orphan];
    const query = {
      text: "equipment reset inventory",
      seedIds: [orphan.id],
      classes: ["KNOWLEDGE" as const],
      lexicalScores: { "knowledge.player-runtime.inventory": 0.9 },
      limit: 5,
    };
    const recovered = retrieveResources(corpus, [], query);
    expect(recovered.map((item) => item.resource.id)).toEqual([
      "knowledge.player-runtime.inventory",
    ]);
    expect(recovered[0]?.reasons).toContain("lexical-rank");
    expect(recovered[0]?.reasons).not.toContain("graph-relation");

    const domainScoped = retrieveResources(corpus, [], {
      ...query,
      domains: ["analysis"],
    });
    expect(domainScoped).toEqual([]);

    const graphOnly = retrieveResources(corpus, [], {
      ...query,
      text: "",
    });
    expect(graphOnly).toEqual([]);

    // A reachable but irrelevant document must not suppress knowledge recall.
    const unrelatedLink = retrieveResources(corpus, [{
      from: orphan.id,
      type: "RELATES_TO",
      to: "document.analysis.player-lifecycle",
    }], query);
    expect(unrelatedLink.map((item) => item.resource.id)).toEqual([
      "knowledge.player-runtime.inventory",
    ]);

    // A genuinely relevant graph neighbor remains available without fallback.
    const relevantLink = retrieveResources(corpus, [{
      from: orphan.id,
      type: "USES",
      to: "knowledge.player-runtime.inventory",
    }], query);
    expect(relevantLink.map((item) => item.resource.id)).toEqual([
      "knowledge.player-runtime.inventory",
    ]);
    expect(relevantLink[0]?.reasons).toContain("graph-relation");
  });

  it("never returns retired resources", () => {
    const results = retrieveResources(resources, edges, {
      text: "",
      limit: 50,
    });

    expect(
      results.some((item) => item.resource.lifecycle === "RETIRED"),
    ).toBe(false);
  });
});
}

// Original suite: engine/packages/analysis-planner/test/section-retrieval.test.ts (blob 386dfcc4eee09482174e45c9b4459160002c9932)
{


const sections: readonly DocumentSection[] = [
  {
    id: "document.analysis.mandatory-audit-procedure#prove",
    documentId: "document.analysis.mandatory-audit-procedure",
    path: "docs/analysis/mandatory-audit-procedure.md",
    heading: "PROVE",
    level: 2,
    anchor: "prove",
    startLine: 100,
    endLine: 180,
  },
  {
    id: "document.analysis.mandatory-audit-procedure#report",
    documentId: "document.analysis.mandatory-audit-procedure",
    path: "docs/analysis/mandatory-audit-procedure.md",
    heading: "REPORT",
    level: 2,
    anchor: "report",
    startLine: 181,
    endLine: 240,
  },
  {
    id: "document.analysis.player-lifecycle#reconnect",
    documentId: "document.analysis.player-lifecycle",
    path: "docs/analysis/player-lifecycle.md",
    heading: "Reconnect",
    level: 3,
    anchor: "reconnect",
    startLine: 80,
    endLine: 120,
  },
];

describe("retrieveDocumentSections", () => {
  it("restricts search to selected documents", () => {
    const results = retrieveDocumentSections(sections, {
      text: "prove",
      documentIds: [
        "document.analysis.mandatory-audit-procedure",
      ],
    });

    expect(results.map((item) => item.section.anchor)).toEqual([
      "prove",
    ]);
    expect(results[0]?.reasons).toContain("document-scope");
  });

  it("can use optional semantic ranking without making it authority", () => {
    const results = retrieveDocumentSections(sections, {
      text: "session recovery",
      semanticScores: {
        "document.analysis.player-lifecycle#reconnect": 0.9,
      },
    });

    expect(results[0]?.section.anchor).toBe("reconnect");
    expect(results[0]?.reasons).toContain("semantic-rank");
  });
});
}

// Original suite: engine/packages/analysis-planner/test/task-routing.test.ts (blob eae8b16d65a45088f0b9c59a7c908e78e0ebe34a)
{


describe("engineering task routing", () => {
  it("starts bug diagnosis from intent instead of mutation", () => {
    const route =
      routeEngineeringTask({
        kind: "diagnose",
        context:
          "LOCAL_ARTIFACT",
      });

    expect(route.initialGoal)
      .toBe(
        "intent-classification",
      );
    expect(route.mutationAllowed)
      .toBe(false);
  });

  it("requires runtime behavior for runtime-sensitive bug verification", () => {
    const route =
      routeEngineeringTask({
        kind: "verify-bug",
        context:
          "LIVE_MINECRAFT",
        runtimeSensitive: true,
      });

    expect(route.initialGoal)
      .toBe(
        "runtime-behavior",
      );
    expect(
      route.requiredPreconditions,
    ).toContain(
      "candidate-bug",
    );
  });

  it("keeps lower-context bug verification below the runtime proof ceiling", () => {
    const route =
      routeEngineeringTask({
        kind: "verify-bug",
        context:
          "LOCAL_ARTIFACT",
        runtimeSensitive: true,
      });

    expect(route.initialGoal)
      .toBe(
        "contradiction-proof",
      );
    expect(route.runtimeMayBeRequired)
      .toBe(true);
  });

  it("keeps lower-context repair work below the runtime proof ceiling", () => {
    const route =
      routeEngineeringTask({
        kind: "repair",
        context:
          "LOCAL_ARTIFACT",
      });

    expect(route.initialGoal)
      .toBe(
        "semantic-consistency",
      );
    expect(route.runtimeMayBeRequired)
      .toBe(true);
    expect(route.requiredPreconditions)
      .toContain("approved-bug");
  });

  it("does not allow repair without Approved Bug and preservation preconditions", () => {
    const route =
      routeEngineeringTask({
        kind: "repair",
        context:
          "LOCAL_ARTIFACT",
      });

    expect(() =>
      assertEngineeringTaskPreconditions(
        route,
        {
          hasApprovedBug:
            true,
        },
      )
    ).toThrow(
      /repair-invariants/,
    );
  });

  it("keeps performance conclusions below runtime proof when runtime is unavailable", () => {
    const route =
      routeEngineeringTask({
        kind:
          "performance-audit",
        context:
          "LOCAL_ARTIFACT",
      });

    expect(route.initialGoal)
      .toBe(
        "semantic-consistency",
      );
    expect(
      route.runtimeMayBeRequired,
    ).toBe(true);
  });
});
}
