import { describe, expect, it } from "vitest";
import { routeRuntimeKnowledgeDebt } from "../../src/knowledge/runtime-knowledge-validation-registry.js";

describe("runtime knowledge validation registry", () => {
  it("routes runtime debt without treating routing as executed proof", () => {
    const report = routeRuntimeKnowledgeDebt([
      {
        knowledgeId: "chunks.dimension-is-chunk-loaded",
        status: "runtime-required",
        nextEvidenceOwner: "runtime-chunk-lifecycle",
      },
      {
        knowledgeId: "player.leave-player-object-no-longer-current",
        status: "runtime-required",
        nextEvidenceOwner: "runtime-player-session",
      },
    ]);
    expect(report.totalRuntimeDebt).toBe(2);
    expect(report.routed).toBe(2);
    expect(report.unrouted).toEqual([]);
    expect(report.routes).toEqual(expect.arrayContaining([
      expect.objectContaining({ strategy: "chunk-experiment" }),
      expect.objectContaining({ strategy: "multiplayer-experiment" }),
    ]));
  });

  it("keeps unknown owners visible as coverage gaps", () => {
    const report = routeRuntimeKnowledgeDebt([{
      knowledgeId: "unknown.fact",
      status: "runtime-required",
      nextEvidenceOwner: "missing-owner",
    }]);
    expect(report.routed).toBe(0);
    expect(report.unrouted).toEqual(["unknown.fact"]);
  });
});
