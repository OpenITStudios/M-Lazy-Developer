import { describe, expect, it } from "vitest";
import {
  retrieveResources,
  scoreTextDocuments,
  prepareTextDocumentScorer,
  type CatalogResource,
  type GraphEdge,
} from "../src/retrieval.js";

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