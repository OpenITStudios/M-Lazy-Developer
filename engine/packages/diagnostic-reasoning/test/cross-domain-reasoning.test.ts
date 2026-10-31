import { describe, expect, it } from "vitest";
import { assessCrossDomainHypotheses, rankCrossDomainHypotheses } from "../src/cross-domain-reasoning.js";

const set = {
  schemaVersion: 1 as const,
  id: "chunk-wave",
  hypotheses: [{
    id: "inactive-chunk",
    statement: "Wave spawn fails because the target chunk is inactive.",
    requiredPredicates: ["wave-spawn-failed", "target-chunk-unloaded"],
    supportingPredicates: ["spawn-distance-risk"],
    falsifierPredicates: ["target-chunk-ready"],
  }],
};

describe("cross-domain reasoning", () => {
  it("promotes corroborated static + runtime + knowledge evidence to proven", () => {
    const result = assessCrossDomainHypotheses(set, [
      { predicate: "wave-spawn-failed", state: "present", evidenceId: "runtime:wave", domain: "runtime" },
      { predicate: "target-chunk-unloaded", state: "present", evidenceId: "knowledge:chunk", domain: "knowledge" },
      { predicate: "spawn-distance-risk", state: "present", evidenceId: "static:distance", domain: "static" },
    ])[0]!;
    expect(result).toMatchObject({
      disposition: "supported",
      confidence: "proven",
      corroborationCount: 3,
    });
  });

  it("allows complete non-runtime proof to reach proven", () => {
    const result = assessCrossDomainHypotheses(set, [
      { predicate: "wave-spawn-failed", state: "present", evidenceId: "static:wave", domain: "static" },
      { predicate: "target-chunk-unloaded", state: "present", evidenceId: "knowledge:chunk", domain: "knowledge" },
    ])[0]!;
    expect(result.disposition).toBe("supported");
    expect(result.confidence).toBe("proven");
    expect(result.missingRequiredPredicates).toEqual([]);
    expect(result.domains).not.toContain("runtime");
  });

  it("keeps partial evidence open and identifies the next missing predicate", () => {
    const result = assessCrossDomainHypotheses(set, [
      { predicate: "spawn-distance-risk", state: "present", evidenceId: "static:distance", domain: "static" },
    ])[0]!;
    expect(result.confidence).toBe("low");
    expect(result.nextPredicate).toBe("wave-spawn-failed");
  });

  it("ranks stronger corroborated hypotheses before unknown ones", () => {
    const ranked = rankCrossDomainHypotheses([
      { hypothesisId:"a",disposition:"open",supportingEvidenceIds:[],eliminatingEvidenceIds:[],missingRequiredPredicates:["x"],reasons:[],domains:[],corroborationCount:0,confidence:"unknown",nextPredicate:"x" },
      { hypothesisId:"b",disposition:"supported",supportingEvidenceIds:["e"],eliminatingEvidenceIds:[],missingRequiredPredicates:[],reasons:[],domains:["runtime","static"],corroborationCount:2,confidence:"high" },
    ]);
    expect(ranked[0]?.hypothesisId).toBe("b");
  });
});
