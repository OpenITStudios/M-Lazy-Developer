import { describe, expect, it } from "vitest";
import { assessCrossDomainHypotheses, rankCrossDomainHypotheses } from "../src/cross-domain-reasoning.js";
import { projectFindingClassification } from "../src/finding-report-projection.js";

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
  it("keeps contradictory required observations OPEN regardless of order", () => {
    const evidence = [
      { predicate: "wave-spawn-failed", state: "present" as const,
        evidenceId: "source:wave", domain: "static" as const },
      { predicate: "target-chunk-unloaded", state: "present" as const,
        evidenceId: "knowledge:unloaded", domain: "knowledge" as const },
      { predicate: "target-chunk-unloaded", state: "absent" as const,
        evidenceId: "source:loaded", domain: "static" as const },
    ];
    for (const input of [evidence, [...evidence].reverse()]) {
      const result = assessCrossDomainHypotheses(set, input)[0]!;
      expect(result.disposition).toBe("open");
      expect(result.confidence).toBe("low");
      expect(result.missingRequiredPredicates).toContain("target-chunk-unloaded");
      expect(result.reasons.some(reason =>
        reason.includes("Conflicting observations for target-chunk-unloaded")
      )).toBe(true);
      expect(projectFindingClassification("confirmed-defect", result)
        .reportClassification).not.toBe("PROVEN BUG");
    }
  });

  it("does not dismiss a disputed falsifier or mask a known state with UNKNOWN", () => {
    const required = [
      { predicate: "wave-spawn-failed", state: "present" as const,
        evidenceId: "source:wave", domain: "static" as const },
      { predicate: "target-chunk-unloaded", state: "present" as const,
        evidenceId: "knowledge:unloaded", domain: "knowledge" as const },
    ];
    const guard = [
      { predicate: "target-chunk-ready", state: "absent" as const,
        evidenceId: "source:not-ready", domain: "static" as const },
      { predicate: "target-chunk-ready", state: "present" as const,
        evidenceId: "runtime:ready", domain: "runtime" as const },
    ];
    for (const input of [[...required, ...guard],
      [...required, ...[...guard].reverse()]]) {
      const result = assessCrossDomainHypotheses(set, input)[0]!;
      expect(result.disposition).toBe("open");
      expect(result.missingRequiredPredicates).toContain("target-chunk-ready");
      expect(result.confidence).toBe("low");
    }
    const unknown = {
      predicate: "target-chunk-unloaded", state: "unknown" as const,
      evidenceId: "source:unknown", domain: "static" as const,
    };
    for (const input of [[...required, unknown],
      [unknown, ...required]]) {
      const result = assessCrossDomainHypotheses(set, input)[0]!;
      expect(result.missingRequiredPredicates).toContain("target-chunk-unloaded");
      expect(result.disposition).toBe("open");
    }
    const realFalsifier = assessCrossDomainHypotheses(set,
      [...required, guard[1]!])[0]!;
    expect(realFalsifier.disposition).toBe("eliminated");
  });

  it("keeps consistent independent evidence and rejects ambiguous domain attribution", () => {
    const inputs = [
      { predicate: "wave-spawn-failed", state: "present" as const,
        evidenceId: "static:wave", domain: "static" as const },
      { predicate: "wave-spawn-failed", state: "present" as const,
        evidenceId: "runtime:wave", domain: "runtime" as const },
      { predicate: "target-chunk-unloaded", state: "present" as const,
        evidenceId: "knowledge:chunk", domain: "knowledge" as const },
    ];
    for (const input of [inputs, [...inputs].reverse()]) {
      const result = assessCrossDomainHypotheses(set, input)[0]!;
      expect(result.disposition).toBe("supported");
      expect(result.confidence).toBe("proven");
      expect(result.supportingEvidenceIds).toContain("static:wave");
      expect(result.supportingEvidenceIds).toContain("runtime:wave");
      expect(result.domains).toEqual(["knowledge", "runtime", "static"]);
    }
    const borrowed = assessCrossDomainHypotheses(set, [...inputs, {
      predicate: "spawn-distance-risk", state: "present",
      evidenceId: "static:wave", domain: "historical",
    }])[0]!;
    expect(borrowed.domains).not.toContain("historical");
    expect(borrowed.domains).not.toContain("static");
    expect(borrowed.corroborationCount).toBe(2);
  });

});
