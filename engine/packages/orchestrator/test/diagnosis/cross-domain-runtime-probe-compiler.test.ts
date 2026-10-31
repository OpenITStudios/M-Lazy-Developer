import { describe, expect, it } from "vitest";
import { compileMinimalCrossDomainRuntimeProbes } from "../../src/diagnosis/cross-domain-runtime-probe-compiler.js";

describe("cross-domain runtime probe compiler", () => {
  it("turns a minimal read-only recommendation into a concrete runtime request", () => {
    const result = compileMinimalCrossDomainRuntimeProbes(
      "incident-1",
      [{
        hypothesisId:"chunk", disposition:"open",
        supportingEvidenceIds:["static:risk"], eliminatingEvidenceIds:[],
        missingRequiredPredicates:["target-chunk-ready"], reasons:[],
        domains:["static"], corroborationCount:1, confidence:"low",
        nextPredicate:"target-chunk-ready",
      }],
      [{
        id:"chunk-ready", predicate:"target-chunk-ready", cost:1, risk:0,
        predictions:[{hypothesisId:"chunk",state:"present"}],
      }],
      [{
        id:"chunk-ready", label:"Chunk ready", requiredContext:"LIVE_MINECRAFT",
        costUnits:1, mutationRisk:"read-only",
        outcomes:[{id:"yes",observation:"ready"},{id:"no",observation:"not ready"},{id:"unknown",observation:"unknown"}],
      }],
      [{
        probeId:"chunk-ready",
        predicate:"target-chunk-ready",
        query:{kind:"chunk-loaded",dimension:"overworld",location:{x:0,y:64,z:0}},
        outcomeByState:{present:"yes",absent:"no",unknown:"unknown"},
      }],
    );
    expect(result.requests).toHaveLength(1);
    expect(result.requests[0]).toMatchObject({
      incidentId:"incident-1",
      predicate:"target-chunk-ready",
      query:{kind:"chunk-loaded"},
    });
    expect(result.issues).toEqual([]);
  });

  it("does not compile mutating recommendations as read-only runtime requests", () => {
    const result = compileMinimalCrossDomainRuntimeProbes(
      "incident-2",
      [{
        hypothesisId:"x",disposition:"open",supportingEvidenceIds:[],
        eliminatingEvidenceIds:[],missingRequiredPredicates:["p"],reasons:[],
        domains:[],corroborationCount:0,confidence:"unknown",nextPredicate:"p",
      }],
      [{id:"mutate",predicate:"p",cost:1,risk:1,predictions:[{hypothesisId:"x",state:"present"}]}],
      [{id:"mutate",label:"Mutate",requiredContext:"LIVE_MINECRAFT",costUnits:1,mutationRisk:"guarded",outcomes:[]}],
      [],
    );
    expect(result.requests).toEqual([]);
    expect(result.plan.blockedByContext).toHaveLength(1);
  });
});
