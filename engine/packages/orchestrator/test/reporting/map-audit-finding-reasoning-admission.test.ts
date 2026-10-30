// Source-preserving consolidation: original test cases remain in isolated lexical blocks.
import { describe, expect, it } from "vitest";
import { projectMapAuditFindingReasoning } from "../../src/reporting/map-audit-finding-reasoning.js";
import { admitMapAuditFindingReasoning } from "../../src/reporting/map-audit-finding-reasoning-admission.js";

// Consolidated suite from engine/packages/orchestrator/test/reporting/map-audit-finding-reasoning.test.ts
{
describe("map audit finding reasoning projection", () => {
  it("projects evidence chain and minimal validation without changing proof status", () => {
    const result = projectMapAuditFindingReasoning({
      projection: {
        reportClassification: "LIKELY BUG",
        diagnosticDisposition: "confirmed-defect",
        proofConfidence: "high",
        reasons: [],
      },
      assessment: {
        hypothesisId:"h",disposition:"supported",
        supportingEvidenceIds:["static:a","runtime:b"],
        eliminatingEvidenceIds:[],
        missingRequiredPredicates:["target-ready"],reasons:[],
        domains:["runtime","static"],corroborationCount:2,
        confidence:"high",nextPredicate:"target-ready",
      },
      probe: {
        hypothesisId:"h",predicate:"target-ready",probeId:"chunk-ready",
        disposition:"probe-selected",
      },
    });
    expect(result).toMatchObject({
      reportClassification:"LIKELY BUG",
      diagnosticDisposition:"confirmed-defect",
      proofConfidence:"high",
      evidenceChain:["runtime:b","static:a"],
      unresolvedPredicates:["target-ready"],
      recommendedReadOnlyProbeId:"chunk-ready",
    });
  });
});
}

// Consolidated suite from engine/packages/orchestrator/test/reporting/map-audit-finding-reasoning-admission.test.ts
{
const finding:any={causalLinkId:"link:1",status:"NEED_VALIDATION",issueType:"BUG",evidenceIds:["e:1"]};
describe("map audit reasoning admission",()=>{
 it("admits only evidence-linked causal reasoning",()=>{
  const result=admitMapAuditFindingReasoning([finding],[{
   causalLinkId:"link:1",
   projection:{reportClassification:"LIKELY BUG",diagnosticDisposition:"confirmed-defect",proofConfidence:"high",reasons:[]},
   assessment:{hypothesisId:"h",disposition:"supported",supportingEvidenceIds:["e:1"],eliminatingEvidenceIds:[],missingRequiredPredicates:["runtime"],reasons:[],domains:["static"],corroborationCount:1,confidence:"high",nextPredicate:"runtime"},
  }]);
  expect(result.rejected).toEqual([]);
  expect(result.admitted["link:1"]?.reportClassification).toBe("LIKELY BUG");
 });
 it("rejects detached reasoning evidence",()=>{
  const result=admitMapAuditFindingReasoning([finding],[{
   causalLinkId:"link:1",
   projection:{reportClassification:"UNKNOWN",diagnosticDisposition:"insufficient-evidence",proofConfidence:"low",reasons:[]},
   assessment:{hypothesisId:"h",disposition:"open",supportingEvidenceIds:["other"],eliminatingEvidenceIds:[],missingRequiredPredicates:["runtime"],reasons:[],domains:["static"],corroborationCount:1,confidence:"low",nextPredicate:"runtime"},
  }]);
  expect(result.admitted).toEqual({});
  expect(result.rejected[0]?.reasons).toContain("Reasoning evidence does not intersect the owning audit finding.");
 });

 it("rejects PROVEN BUG reasoning for a NEED_VALIDATION finding",()=>{
  const result=admitMapAuditFindingReasoning([finding],[{
   causalLinkId:"link:1",
   projection:{reportClassification:"PROVEN BUG",diagnosticDisposition:"confirmed-defect",proofConfidence:"proven",reasons:[]},
   assessment:{hypothesisId:"h",disposition:"supported",supportingEvidenceIds:["e:1"],eliminatingEvidenceIds:[],missingRequiredPredicates:[],reasons:[],domains:["static"],corroborationCount:1,confidence:"high"},
  }]);
  expect(result.admitted).toEqual({});
  expect(result.rejected[0]?.reasons).toContain(
   "A NEED_VALIDATION audit finding cannot attach PROVEN BUG reasoning.",
  );
 });

 it("rejects proven confidence while the audit finding still needs validation",()=>{
  const result=admitMapAuditFindingReasoning([finding],[{
   causalLinkId:"link:1",
   projection:{reportClassification:"LIKELY BUG",diagnosticDisposition:"confirmed-defect",proofConfidence:"high",reasons:[]},
   assessment:{hypothesisId:"h",disposition:"supported",supportingEvidenceIds:["e:1"],eliminatingEvidenceIds:[],missingRequiredPredicates:[],reasons:[],domains:["static"],corroborationCount:1,confidence:"proven"},
  }]);
  expect(result.admitted).toEqual({});
  expect(result.rejected[0]?.reasons).toContain(
   "A NEED_VALIDATION audit finding cannot attach proven reasoning confidence.",
  );
 });
});
describe("reasoning classification follows the audit issue lane", () => {
  const evidence = {
    hypothesisId: "h",
    disposition: "supported" as const,
    supportingEvidenceIds: ["e:1"],
    eliminatingEvidenceIds: [],
    missingRequiredPredicates: [],
    reasons: [],
    domains: ["static"] as const,
    corroborationCount: 1,
    confidence: "proven" as const,
  };
  const candidate = (reportClassification: "PROVEN BUG" | "DESIGN MISMATCH") => ({
    causalLinkId: "link:1",
    projection: {
      reportClassification,
      diagnosticDisposition: reportClassification === "DESIGN MISMATCH"
        ? "design-review" as const
        : "confirmed-defect" as const,
      proofConfidence: "proven" as const,
      reasons: [],
    },
    assessment: evidence,
  });
  it("admits proven DESIGN_MISMATCH reasoning only in its own classification", () => {
    const mismatch = { ...finding, status: "PROVEN", issueType: "DESIGN_MISMATCH" };
    const accepted = admitMapAuditFindingReasoning(
      [mismatch], [candidate("DESIGN MISMATCH")],
    );
    expect(accepted.rejected).toEqual([]);
    expect(accepted.admitted["link:1"]?.reportClassification)
      .toBe("DESIGN MISMATCH");
    const wrong = admitMapAuditFindingReasoning([mismatch], [candidate("PROVEN BUG")]);
    expect(wrong.admitted).toEqual({});
    expect(wrong.rejected[0]?.reasons)
      .toContain("A PROVEN DESIGN_MISMATCH audit finding requires DESIGN MISMATCH reasoning classification.");
  });
  it("does not attach design-mismatch reasoning to an admitted PROVEN BUG", () => {
    const bug = { ...finding, status: "PROVEN", issueType: "BUG" };
    const rejected = admitMapAuditFindingReasoning([bug], [candidate("DESIGN MISMATCH")]);
    expect(rejected.admitted).toEqual({});
    expect(rejected.rejected[0]?.reasons)
      .toContain("A PROVEN BUG audit finding requires PROVEN BUG reasoning classification.");
  });
});
}
