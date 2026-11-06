import{describe,expect,it}from"vitest";import{reasonAboutCausalLinkFinding}from"../../src/diagnosis/causal-link-reasoning-coordinator.js";
describe("causal link reasoning coordinator",()=>{it("composes canonical reasoning and admits evidence-linked output",()=>{const graph:any={scenarios:[{id:"s1",purpose:"Complete objective",causalLinkIds:["l1"],componentIds:[]}],causalLinks:[{id:"l1",scenarioId:"s1",purpose:"Dependency resolves",reason:"Dependency contradicted",status:"CONTRADICTED",evidenceIds:["e1"],subjectIds:[],componentIds:[],impactPathComponentIds:[],impactPathEvidenceIds:[],knowledgeRequirementIds:[]}],components:[],knowledgeRequirements:[],knowledgeReceipts:[]};const resolution:any={causalLinkId:"l1",scenarioId:"s1",evidenceIds:["e1"],disposition:"CONFIRMED_DEFECT_READY"};const finding:any={causalLinkId:"l1",status:"PROVEN",issueType:"BUG",evidenceIds:["e1"]};const result=reasonAboutCausalLinkFinding({graph,resolution,finding,diagnosticDisposition:"confirmed-defect"});expect(result.status).toBe("ADMITTED");expect(result).toMatchObject({causalLinkId:"l1",reportClassification:"PROVEN BUG",proofConfidence:"proven"});expect(result.reasoning?.reportClassification).toBe("PROVEN BUG");});
 it("derives minimal probe candidates from canonical definitions and bindings",()=>{const graph:any={scenarios:[{id:"s1",purpose:"Complete",causalLinkIds:["l1"],componentIds:[]}],causalLinks:[{id:"l1",scenarioId:"s1",purpose:"Dependency",reason:"Blocked",status:"CONTRADICTED",evidenceIds:["e1"],subjectIds:[],componentIds:[],impactPathComponentIds:[],impactPathEvidenceIds:[],knowledgeRequirementIds:[]}],components:[],knowledgeRequirements:[],knowledgeReceipts:[]};const result=reasonAboutCausalLinkFinding({graph,resolution:{causalLinkId:"l1",disposition:"RUNTIME_PROOF_REQUIRED",evidenceIds:["e1"]} as any,finding:{causalLinkId:"l1",status:"NEED_VALIDATION",issueType:"BUG",evidenceIds:["e1"]} as any,diagnosticDisposition:"runtime-proof-required",probeDefinitions:[{id:"p1",label:"Runtime predicate",requiredContext:"LIVE_MINECRAFT",costUnits:1,mutationRisk:"read-only",outcomes:[{id:"yes",observation:"yes",supportsCandidateIds:["causal-link-defect:l1"]},{id:"no",observation:"no",rejectsCandidateIds:["causal-link-defect:l1"]}]}],runtimeProbeBindings:[{probeId:"p1",predicate:"causal-link:l1:runtime:none",query:{kind:"entity-resolvable",entityId:"e"},outcomeByState:{present:"yes",absent:"no"}}]});expect(result.nextPredicate).toBe("causal-link:l1:runtime:none");expect(result.recommendedReadOnlyProbeId).toBe("p1");});
});

describe("causal observation provenance", () => {
 it("links a generated composite evidence ID back to the exact finding source", () => {
  const graph:any={scenarios:[{id:"s1",purpose:"Complete objective",causalLinkIds:["l1"],componentIds:[]}],causalLinks:[{
   id:"l1",scenarioId:"s1",purpose:"Dependency resolves",reason:"Contradicted dependency",
   status:"CONTRADICTED",evidenceIds:["e:source"],subjectIds:[],componentIds:[],
   impactPathComponentIds:[],impactPathEvidenceIds:[],knowledgeRequirementIds:[],
  }],components:[],knowledgeRequirements:[],knowledgeReceipts:[]};
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

describe("causal reasoning exact owner and Knowledge proof boundaries", () => {
  const graph: any = {
    scenarios: [{
      id: "scenario:a", purpose: "Complete objective",
      causalLinkIds: ["link:a"], componentIds: [],
    }],
    components: [],
    causalLinks: [{
      id: "link:a", scenarioId: "scenario:a",
      purpose: "Objective dependency", reason: "Source contradiction",
      status: "CONTRADICTED", evidenceIds: ["e:link"],
      subjectIds: [], componentIds: [], impactPathComponentIds: [],
      impactPathEvidenceIds: [], knowledgeRequirementIds: ["req:a"],
    }],
    knowledgeRequirements: [{
      id: "req:a", scenarioId: "scenario:a", domain: "state-flow",
      reason: "State handoff", capabilityIds: [], dependsOnRequirementIds: [],
      subjectIds: [], componentIds: [],
    }],
    knowledgeReceipts: [],
  };
  const resolution: any = {
    causalLinkId: "link:a", scenarioId: "scenario:a",
    disposition: "COUNTERPROOF_SEARCH_REQUIRED", evidenceIds: ["e:link"],
  };
  const finding: any = {
    causalLinkId: "link:a", scenarioId: "scenario:a",
    status: "NEED_VALIDATION", issueType: "BUG", evidenceIds: ["e:link"],
  };
  const reason = (source: any, res = resolution) =>
    reasonAboutCausalLinkFinding({
      graph: source, resolution: res, finding,
      diagnosticDisposition: "insufficient-evidence",
    });

  it("retains missing Knowledge as unresolved rather than dropping a predicate", () => {
    const actual = reason({ ...graph, knowledgeRequirements: [] });
    expect(actual.status).toBe("ADMITTED");
    expect(actual.nextPredicate).toBe("causal-link:link:a:knowledge:req:a");
    expect(actual.proofConfidence).not.toBe("proven");
  });

  it("refuses a SATISFIED Knowledge receipt owned by a foreign scenario", () => {
    const foreignReceipt = {
      requirementId: "req:a", scenarioId: "scenario:other",
      domain: "state-flow", status: "SATISFIED",
      evidenceIds: ["e:foreign"], knowledgeIds: ["knowledge:foreign"],
    };
    const actual = reason({
      ...graph, knowledgeReceipts: [foreignReceipt],
    });
    expect(actual.status).toBe("ADMITTED");
    expect(actual.nextPredicate).toBe("causal-link:link:a:knowledge:req:a");
    expect(actual.evidenceIds).not.toContain("knowledge-receipt:e:foreign");
    expect(actual.proofConfidence).not.toBe("proven");
    const collided = reason({
      ...graph, knowledgeReceipts: [
        { ...foreignReceipt, scenarioId: "scenario:a" }, foreignReceipt,
      ],
    });
    expect(collided.nextPredicate).toBe("causal-link:link:a:knowledge:req:a");
  });

  it("admits a uniquely owned satisfied Knowledge receipt, without borrowed claims", () => {
    const satisfied = reason({
      ...graph, knowledgeReceipts: [{
        requirementId: "req:a", scenarioId: "scenario:a",
        domain: "state-flow", status: "SATISFIED",
        evidenceIds: ["e:knowledge"], knowledgeIds: ["knowledge:state"],
      }],
    });
    expect(satisfied.status).toBe("REJECTED");
    expect(satisfied.nextPredicate).toBeUndefined();
    expect(satisfied.evidenceIds).toContain("knowledge-receipt:e:knowledge");
    // NEED_VALIDATION cannot attach a full proven-confidence explanation;
    // canonical issue admission remains the only PROVEN authority.
    expect(satisfied.proofConfidence).toBe("proven");
  });

  it("never chooses the first duplicate causal or scenario owner", () => {
    const duplicateLink = reason({
      ...graph, causalLinks: [...graph.causalLinks, { ...graph.causalLinks[0] }],
    });
    expect(duplicateLink.status).toBe("NOT_CONSTRUCTIBLE");
    const duplicateScenario = reason({
      ...graph, scenarios: [...graph.scenarios, { ...graph.scenarios[0] }],
    });
    expect(duplicateScenario.status).toBe("NOT_CONSTRUCTIBLE");
    expect(reason(graph, {
      ...resolution, scenarioId: "scenario:foreign",
    }).status).toBe("NOT_CONSTRUCTIBLE");
  });
});
