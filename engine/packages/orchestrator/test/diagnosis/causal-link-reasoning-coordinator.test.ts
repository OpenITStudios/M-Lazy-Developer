import{describe,expect,it}from"vitest";import{reasonAboutCausalLinkFinding}from"../../src/diagnosis/causal-link-reasoning-coordinator.js";
describe("causal link reasoning coordinator",()=>{it("composes canonical reasoning and admits evidence-linked output",()=>{const graph:any={scenarios:[{id:"s1",purpose:"Complete objective"}],causalLinks:[{id:"l1",scenarioId:"s1",purpose:"Dependency resolves",reason:"Dependency contradicted",status:"CONTRADICTED",evidenceIds:["e1"],subjectIds:[],componentIds:[],impactPathComponentIds:[],impactPathEvidenceIds:[],knowledgeRequirementIds:[]}],knowledgeRequirements:[],knowledgeReceipts:[]};const resolution:any={causalLinkId:"l1",scenarioId:"s1",evidenceIds:["e1"],disposition:"CONFIRMED_DEFECT_READY"};const finding:any={causalLinkId:"l1",status:"PROVEN",issueType:"BUG",evidenceIds:["e1"]};const result=reasonAboutCausalLinkFinding({graph,resolution,finding,diagnosticDisposition:"confirmed-defect"});expect(result.status).toBe("ADMITTED");expect(result).toMatchObject({causalLinkId:"l1",reportClassification:"PROVEN BUG",proofConfidence:"proven"});expect(result.reasoning?.reportClassification).toBe("PROVEN BUG");});
 it("derives minimal probe candidates from canonical definitions and bindings",()=>{const graph:any={scenarios:[{id:"s1",purpose:"Complete"}],causalLinks:[{id:"l1",scenarioId:"s1",purpose:"Dependency",reason:"Blocked",status:"CONTRADICTED",evidenceIds:["e1"],subjectIds:[],componentIds:[],impactPathComponentIds:[],impactPathEvidenceIds:[],knowledgeRequirementIds:[]}],knowledgeRequirements:[],knowledgeReceipts:[]};const result=reasonAboutCausalLinkFinding({graph,resolution:{causalLinkId:"l1",disposition:"RUNTIME_PROOF_REQUIRED",evidenceIds:["e1"]} as any,finding:{causalLinkId:"l1",status:"NEED_VALIDATION",issueType:"BUG",evidenceIds:["e1"]} as any,diagnosticDisposition:"runtime-proof-required",probeDefinitions:[{id:"p1",label:"Runtime predicate",requiredContext:"LIVE_MINECRAFT",costUnits:1,mutationRisk:"read-only",outcomes:[{id:"yes",observation:"yes",supportsCandidateIds:["causal-link-defect:l1"]},{id:"no",observation:"no",rejectsCandidateIds:["causal-link-defect:l1"]}]}],runtimeProbeBindings:[{probeId:"p1",predicate:"causal-link:l1:runtime:none",query:{kind:"entity-resolvable",entityId:"e"},outcomeByState:{present:"yes",absent:"no"}}]});expect(result.nextPredicate).toBe("causal-link:l1:runtime:none");expect(result.recommendedReadOnlyProbeId).toBe("p1");});
});

describe("causal observation provenance", () => {
 it("links a generated composite evidence ID back to the exact finding source", () => {
  const graph:any={scenarios:[{id:"s1",purpose:"Complete objective"}],causalLinks:[{
   id:"l1",scenarioId:"s1",purpose:"Dependency resolves",reason:"Contradicted dependency",
   status:"CONTRADICTED",evidenceIds:["e:source"],subjectIds:[],componentIds:[],
   impactPathComponentIds:[],knowledgeRequirementIds:[],
  }],knowledgeRequirements:[],knowledgeReceipts:[]};
  const result=reasonAboutCausalLinkFinding({graph,
   resolution:{causalLinkId:"l1",scenarioId:"s1",evidenceIds:["e:source"],disposition:"CONFIRMED_DEFECT_READY"} as any,
   finding:{causalLinkId:"l1",status:"PROVEN",issueType:"BUG",evidenceIds:["e:source"]} as any,
   diagnosticDisposition:"confirmed-defect"});
  expect(result.status).toBe("ADMITTED");
  expect(result.reasoning?.evidenceChain).toContain("causal-link:e:source");
  // Canonical source evidence remains on the finding; no synthetic observation
  // becomes a new runtime or source proof receipt.
 });
});
