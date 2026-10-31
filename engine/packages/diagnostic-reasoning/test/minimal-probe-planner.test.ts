import { describe, expect, it } from "vitest";
import { planMinimalCrossDomainProbes } from "../src/minimal-probe-planner.js";

describe("minimal cross-domain probe planner", () => {
  it("selects the lowest-cost useful probe for the next missing predicate", () => {
    const result = planMinimalCrossDomainProbes([{
      hypothesisId: "chunk",
      disposition: "open",
      supportingEvidenceIds: ["static:risk"],
      eliminatingEvidenceIds: [],
      missingRequiredPredicates: ["target-chunk-ready"],
      reasons: [],
      domains: ["static"],
      corroborationCount: 1,
      confidence: "low",
      nextPredicate: "target-chunk-ready",
    }], [{
      id: "expensive",
      predicate: "target-chunk-ready",
      cost: 4,
      risk: 1,
      predictions: [{ hypothesisId: "chunk", state: "present" }],
    }, {
      id: "cheap",
      predicate: "target-chunk-ready",
      cost: 1,
      risk: 0,
      predictions: [{ hypothesisId: "chunk", state: "present" }],
    }]);
    expect(result[0]).toMatchObject({
      probeId: "cheap",
      disposition: "probe-selected",
    });
  });

  it("keeps missing probe coverage explicit", () => {
    expect(planMinimalCrossDomainProbes([{
      hypothesisId: "x", disposition: "open",
      supportingEvidenceIds: [], eliminatingEvidenceIds: [],
      missingRequiredPredicates: ["missing"], reasons: [],
      domains: [], corroborationCount: 0, confidence: "unknown",
      nextPredicate: "missing",
    }], [])[0]).toMatchObject({
      predicate: "missing",
      disposition: "missing-probe",
    });
  });
});
