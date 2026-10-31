// Source-preserving consolidation: original test cases remain in isolated lexical blocks.
import { describe, expect, it } from "vitest";
import type { DiagnosticFinding } from "../../../diagnostics/src/index.js";
import { synthesizeCausalChains } from "../../src/diagnosis/causal-analysis.js";
import { compareCausalAnalysis } from "../../src/diagnosis/causal-comparison.js";
import { causalRetestReasons } from "../../src/diagnosis/causal-retest.js";
import type { CausalChain, RuntimeProbeExchange, RuntimeTemporalAssessment } from "../../../project-model/src/index.js";
import { synthesizeCausalIncidents } from "../../src/diagnosis/causal-incident-analysis.js";
import { constructCausalLinkEvidence } from "../../src/diagnosis/causal-link-evidence-construction.js";
import { constructCausalLinkHypothesis } from "../../src/diagnosis/causal-link-hypothesis-construction.js";
import { identifyFirstWrongTransition } from "../../src/diagnosis/first-wrong-transition.js";

// Consolidated suite from engine/packages/orchestrator/test/diagnosis/causal-analysis.test.ts
{
function finding(
  code: "KNOWLEDGE_RELATION_VIOLATION" | "KNOWLEDGE_EVIDENCE_GAP",
): DiagnosticFinding {
  return {
    id: "diag-1",
    code,
    severity: code === "KNOWLEDGE_RELATION_VIOLATION" ? "critical" : "info",
    message: "route-affecting-world-mutation requires route-revalidation",
    data: {
      scopeKey: "operation:1",
      relationId: "route-revalidation",
      subject: "route-affecting-world-mutation",
      object: "route-revalidation",
      causalConsequences: [
        "navigation-stall-risk",
        "fallback-recovery-risk",
      ],
    },
  };
}

describe("causal chain synthesis", () => {
  it("builds a high-confidence dependency chain from an explicit violation", () => {
    const chains = synthesizeCausalChains([
      finding("KNOWLEDGE_RELATION_VIOLATION"),
    ]);

    expect(chains).toHaveLength(1);
    expect(chains[0]?.confidence).toBe("high");
    expect(chains[0]?.severity).toBe("critical");
    expect(chains[0]?.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "observed-state",
        label: "route-affecting-world-mutation",
      }),
      expect.objectContaining({
        kind: "missing-requirement",
        label: "route-revalidation",
      }),
      expect.objectContaining({
        kind: "downstream-risk",
        label: "navigation-stall-risk",
      }),
    ]));
    expect(chains[0]?.links.some(
      (link) => link.strength === "risk-only",
    )).toBe(true);
  });

  it("keeps an evidence-gap causal chain low confidence", () => {
    const chains = synthesizeCausalChains([
      finding("KNOWLEDGE_EVIDENCE_GAP"),
    ]);

    expect(chains[0]?.confidence).toBe("low");
    expect(chains[0]?.nodes.some(
      (node) => node.kind === "evidence-gap",
    )).toBe(true);
    expect(chains[0]?.nodes.some(
      (node) => node.kind === "downstream-risk",
    )).toBe(true);
  });

  it("raises an evidence-gap chain to medium confidence only with scoped corroborators", () => {
    const item = finding("KNOWLEDGE_EVIDENCE_GAP");
    item.data = {
      ...item.data,
      presentPredicates: [
        "route-affecting-world-mutation",
        "route-navigation-consumer-present",
        "route-target-driven-consumer-present",
      ],
      causalCorroborators: {
        "navigation-stall-risk": [
          "route-navigation-consumer-present",
          "route-target-driven-consumer-present",
        ],
      },
    };

    const chains = synthesizeCausalChains([item]);
    expect(chains[0]?.confidence).toBe("medium");
    expect(chains[0]?.links).toEqual(expect.arrayContaining([
      expect.objectContaining({
        strength: "corroborated-risk",
      }),
    ]));
  });

  it("requires the configured number of independent provenance sources", () => {
    const singleSource = finding("KNOWLEDGE_EVIDENCE_GAP");
    singleSource.data = {
      ...singleSource.data,
      presentPredicates: [
        "route-navigation-consumer-present",
        "route-target-driven-consumer-present",
      ],
      causalCorroborators: {
        "navigation-stall-risk": [
          "route-navigation-consumer-present",
          "route-target-driven-consumer-present",
        ],
      },
      causalCorroborationMinSources: {
        "navigation-stall-risk": 2,
      },
      predicateSourceKeys: {
        "route-navigation-consumer-present": ["artifact:entity.json:1:0"],
        "route-target-driven-consumer-present": ["artifact:entity.json:1:0"],
      },
    };

    const one = synthesizeCausalChains([singleSource]);
    expect(one[0]?.confidence).toBe("low");
    expect(one[0]?.links.some(
      (link) => link.strength === "corroborated-risk",
    )).toBe(false);

    const multiSource = finding("KNOWLEDGE_EVIDENCE_GAP");
    multiSource.data = {
      ...singleSource.data,
      predicateSourceKeys: {
        "route-navigation-consumer-present": [
          "artifact:mutation.mcfunction:1:0",
          "artifact:entity.json:1:0",
        ],
        "route-target-driven-consumer-present": [
          "artifact:mutation.mcfunction:1:0",
          "artifact:entity.json:1:0",
        ],
      },
    };

    const two = synthesizeCausalChains([multiSource]);
    expect(two[0]?.confidence).toBe("medium");
    expect(two[0]?.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: "navigation-stall-risk",
        corroboratingSourceKeys: [
          "artifact:entity.json:1:0",
          "artifact:mutation.mcfunction:1:0",
        ],
      }),
    ]));
  });

  it("adds a direct observed outcome node without upgrading an unproven dependency to high confidence", () => {
    const item = finding("KNOWLEDGE_EVIDENCE_GAP");
    item.data = {
      ...item.data,
      presentPredicates: [
        "route-affecting-world-mutation",
        "navigation-stall-observed",
      ],
      causalOutcomePredicates: {
        "navigation-stall-risk": [
          "navigation-stall-observed",
        ],
      },
    };

    const chains = synthesizeCausalChains([item]);
    expect(chains[0]?.confidence).toBe("medium");
    expect(chains[0]?.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "observed-state",
        label: "navigation-stall-observed",
      }),
    ]));
  });

  it("marks a later observed outcome as temporally after the subject", () => {
    const item = finding("KNOWLEDGE_EVIDENCE_GAP");
    item.data = {
      ...item.data,
      presentPredicates: [
        "route-affecting-world-mutation",
        "navigation-stall-observed",
      ],
      causalOutcomePredicates: {
        "navigation-stall-risk": ["navigation-stall-observed"],
      },
      predicateObservations: {
        "route-affecting-world-mutation": [{
          tick: 100,
          sequence: 1,
        }],
        "navigation-stall-observed": [{
          tick: 120,
          sequence: 5,
        }],
      },
    };

    const chains = synthesizeCausalChains([item]);
    expect(chains[0]?.confidence).toBe("medium");
    expect(chains[0]?.links).toEqual(expect.arrayContaining([
      expect.objectContaining({
        temporalStatus: "after-subject",
        strength: "direct-evidence",
      }),
    ]));
  });

  it("does not count an outcome observed before the subject as causal support", () => {
    const item = finding("KNOWLEDGE_EVIDENCE_GAP");
    item.data = {
      ...item.data,
      presentPredicates: [
        "route-affecting-world-mutation",
        "navigation-stall-observed",
      ],
      causalOutcomePredicates: {
        "navigation-stall-risk": ["navigation-stall-observed"],
      },
      predicateObservations: {
        "route-affecting-world-mutation": [{
          tick: 120,
          sequence: 5,
        }],
        "navigation-stall-observed": [{
          tick: 100,
          sequence: 1,
        }],
      },
    };

    const chains = synthesizeCausalChains([item]);
    expect(chains[0]?.confidence).toBe("low");
    expect(chains[0]?.links).toEqual(expect.arrayContaining([
      expect.objectContaining({
        temporalStatus: "before-subject",
        strength: "direct-evidence",
      }),
    ]));
  });

  it("uses sequence to order outcomes inside the same tick", () => {
    const item = finding("KNOWLEDGE_EVIDENCE_GAP");
    item.data = {
      ...item.data,
      presentPredicates: [
        "route-affecting-world-mutation",
        "navigation-stall-observed",
      ],
      causalOutcomePredicates: {
        "navigation-stall-risk": ["navigation-stall-observed"],
      },
      predicateObservations: {
        "route-affecting-world-mutation": [{
          tick: 200,
          streamId: "runtime-main",
          sequence: 2,
        }],
        "navigation-stall-observed": [{
          tick: 200,
          streamId: "runtime-main",
          sequence: 3,
        }],
      },
    };

    const chains = synthesizeCausalChains([item]);
    expect(chains[0]?.confidence).toBe("medium");
    expect(chains[0]?.links).toEqual(expect.arrayContaining([
      expect.objectContaining({
        temporalStatus: "after-subject",
      }),
    ]));
  });

  it("keeps temporal status unresolved when one side lacks observation timing", () => {
    const item = finding("KNOWLEDGE_EVIDENCE_GAP");
    item.data = {
      ...item.data,
      presentPredicates: [
        "route-affecting-world-mutation",
        "navigation-stall-observed",
      ],
      causalOutcomePredicates: {
        "navigation-stall-risk": ["navigation-stall-observed"],
      },
      predicateObservations: {
        "navigation-stall-observed": [{
          tick: 200,
          sequence: 3,
        }],
      },
    };

    const chains = synthesizeCausalChains([item]);
    expect(chains[0]?.confidence).toBe("medium");
    expect(chains[0]?.links).toEqual(expect.arrayContaining([
      expect.objectContaining({
        temporalStatus: "unresolved",
      }),
    ]));
  });

  it("turns Semantic IR unknowns into low-confidence evidence-gap chains only", () => {
    const chains = synthesizeCausalChains([{
      id: "semantic-gap",
      code: "SEMANTIC_IR_DEFERRED_STATE_GUARD_UNKNOWN",
      severity: "minor",
      message: "deferred state ownership is unknown",
      data: {
        subject: "deferred-state-mutation:time-1",
        object: "current-generation-ownership-proof",
        semanticIrRelationId: "time-1",
      },
    }]);

    expect(chains).toHaveLength(1);
    expect(chains[0]).toMatchObject({
      confidence: "low",
      scopeKey: "semantic-ir:time-1",
    });
    expect(chains[0]?.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "evidence-gap",
      }),
    ]));
    expect(chains[0]?.nodes.some(
      (node) => node.kind === "violation" || node.kind === "downstream-risk",
    )).toBe(false);
  });

  it("does not synthesize risk chains without explicit consequence metadata", () => {
    const item = finding("KNOWLEDGE_RELATION_VIOLATION");
    item.data = {
      ...item.data,
      causalConsequences: [],
    };
    expect(synthesizeCausalChains([item])).toEqual([]);
  });
});
}

// Consolidated suite from engine/packages/orchestrator/test/diagnosis/causal-comparison.test.ts
{
function result(input: {
  confidence: "low" | "medium" | "high";
  observedOutcomes: number;
  corroboratedRisks: number;
  candidate: string;
}) {
  return {
    causalAnalysis: {
      chains: [{
        id: "chain-" + input.candidate,
        scopeKey: "op:1",
        severity: input.confidence === "high" ? "critical" as const : "info" as const,
        confidence: input.confidence,
        title: input.candidate,
        summary: "fixture",
        nodes: [],
        links: [],
        relatedDiagnosticIds: [],
      }],
      highConfidence: input.confidence === "high" ? 1 : 0,
      mediumConfidence: input.confidence === "medium" ? 1 : 0,
      lowConfidence: input.confidence === "low" ? 1 : 0,
      projectedRisks: 1,
      corroboratedRisks: input.corroboratedRisks,
      observedOutcomes: input.observedOutcomes,
      incidents: [{
        id: "incident-1",
        scopeKey: "op:1",
        severity: "critical" as const,
        confidence: input.confidence,
        chainIds: ["chain-" + input.candidate],
        relatedDiagnosticIds: [],
        nodes: [],
        links: [],
        rootCauseCandidates: [{
          id: "candidate-" + input.candidate,
          label: input.candidate,
          evidenceLevel: input.observedOutcomes > 0
            ? "proven-with-observed-outcome" as const
            : input.corroboratedRisks > 0
              ? "corroborated-candidate" as const
              : "unproven-candidate" as const,
          severity: "critical" as const,
          confidence: input.confidence,
          chainIds: ["chain-" + input.candidate],
          relatedDiagnosticIds: [],
          support: {
            dependencyViolations: 0,
            evidenceGaps: 1,
            corroboratedRisks: input.corroboratedRisks,
            observedOutcomes: input.observedOutcomes,
          },
        }],
      }],
      rootCauseCandidates: 1,
    },
  };
}

describe("causal comparison", () => {
  it("describes projection-to-observed evidence changes", () => {
    const before = result({
      confidence: "low",
      observedOutcomes: 0,
      corroboratedRisks: 0,
      candidate: "route-mutation",
    });
    const after = result({
      confidence: "medium",
      observedOutcomes: 1,
      corroboratedRisks: 1,
      candidate: "route-mutation",
    });

    const comparison = compareCausalAnalysis(before, after);
    expect(comparison.delta).toEqual(expect.objectContaining({
      highConfidence: 0,
      mediumConfidence: 1,
      lowConfidence: -1,
      corroboratedRisks: 1,
      observedOutcomes: 1,
      rootCauseCandidates: 0,
    }));
    expect(comparison.delta.addedCandidateLabels).toEqual([]);
    expect(comparison.delta.removedCandidateLabels).toEqual([]);
  });

  it("reports candidate labels added and removed", () => {
    const comparison = compareCausalAnalysis(
      result({
        confidence: "low",
        observedOutcomes: 0,
        corroboratedRisks: 0,
        candidate: "old-cause",
      }),
      result({
        confidence: "high",
        observedOutcomes: 1,
        corroboratedRisks: 0,
        candidate: "new-cause",
      }),
    );

    expect(comparison.delta.addedCandidateLabels).toEqual(["new-cause"]);
    expect(comparison.delta.removedCandidateLabels).toEqual(["old-cause"]);
  });
});

// One comparison → retest behavior contract replaces a separate mock-delta suite.
describe("causal comparison-to-retest", () => {
  it("prioritizes actual positive causal deltas by impact", () => {
    const before = result({ confidence: "low", observedOutcomes: 0,
      corroboratedRisks: 0, candidate: "old-cause" });
    const after = result({ confidence: "high", observedOutcomes: 1,
      corroboratedRisks: 2, candidate: "new-cause" });
    const reasons = causalRetestReasons(compareCausalAnalysis(before, after));
    expect(reasons.map((reason) => reason.weight).toEqual([5, 4, 3, 2]);
    expect(reasons.every((reason) => reason.kind === "causal-regression")).toBe(true);
    expect(reasons.some((reason) => reason.detail.includes("new-cause"))).toBe(true);
  });

  it("does not invent regression work for causal improvements", () => {
    const before = result({ confidence: "high", observedOutcomes: 1,
      corroboratedRisks: 2, candidate: "old-cause" });
    const after = result({ confidence: "low", observedOutcomes: 0,
      corroboratedRisks: 0, candidate: "old-cause" });
    expect(causalRetestReasons(compareCausalAnalysis(before, after))).toEqual([]);
  });
});
}

// Consolidated suite from engine/packages/orchestrator/test/diagnosis/causal-incident-analysis.test.ts
{
function chain(input: {
  id: string;
  subject: string;
  severity: "info" | "minor" | "medium" | "critical";
  confidence: "low" | "medium" | "high";
  violation?: boolean;
  corroborated?: boolean;
  observedOutcome?: boolean;
}): CausalChain {
  const subjectId = input.id + ":subject";
  const statusId = input.id + ":status";
  const riskId = input.id + ":risk";
  const observedId = input.id + ":observed";
  const nodes: CausalChain["nodes"] = [
    {
      id: subjectId,
      kind: "observed-state",
      label: input.subject,
      diagnosticIds: [input.id + ":diag"],
    },
    {
      id: statusId,
      kind: input.violation ? "violation" : "evidence-gap",
      label: input.violation ? "violation" : "gap",
      diagnosticIds: [input.id + ":diag"],
    },
    {
      id: riskId,
      kind: "downstream-risk",
      label: input.subject + "-risk",
      diagnosticIds: [input.id + ":diag"],
    },
    ...(input.observedOutcome ? [{
      id: observedId,
      kind: "observed-state" as const,
      label: input.subject + "-observed",
      diagnosticIds: [input.id + ":diag"],
    }] : []),
  ];

  const links: CausalChain["links"] = [
    {
      from: subjectId,
      to: statusId,
      strength: input.violation ? "direct-evidence" : "dependency-supported",
      rationale: "fixture",
    },
    {
      from: statusId,
      to: riskId,
      strength: input.corroborated ? "corroborated-risk" : "risk-only",
      rationale: "fixture",
    },
    ...(input.observedOutcome ? [{
      from: riskId,
      to: observedId,
      strength: "direct-evidence" as const,
      rationale: "fixture",
    }] : []),
  ];

  return {
    id: input.id,
    scopeKey: "arena:1",
    severity: input.severity,
    confidence: input.confidence,
    title: input.subject,
    summary: "fixture",
    nodes,
    links,
    relatedDiagnosticIds: [input.id + ":diag"],
  };
}

describe("causal incident synthesis", () => {
  it("groups chains by scope and ranks evidence quality before severity", () => {
    const incidents = synthesizeCausalIncidents([
      chain({
        id: "weak",
        subject: "route-mutation",
        severity: "critical",
        confidence: "low",
      }),
      chain({
        id: "strong",
        subject: "missing-structure-target",
        severity: "medium",
        confidence: "high",
        violation: true,
        observedOutcome: true,
      }),
      chain({
        id: "corroborated",
        subject: "state-drift",
        severity: "medium",
        confidence: "medium",
        corroborated: true,
      }),
    ]);

    expect(incidents).toHaveLength(1);
    const incident = incidents[0]!;
    expect(incident.chainIds).toHaveLength(3);
    expect(incident.rootCauseCandidates.map((item) => item.label)).toEqual([
      "missing-structure-target",
      "state-drift",
      "route-mutation",
    ]);
    expect(incident.rootCauseCandidates[0]?.evidenceLevel)
      .toBe("proven-with-observed-outcome");
    expect(incident.rootCauseCandidates[1]?.evidenceLevel)
      .toBe("corroborated-candidate");
    expect(incident.rootCauseCandidates[2]?.evidenceLevel)
      .toBe("unproven-candidate");
  });

  it("does not merge unrelated scopes into one incident", () => {
    const a = chain({
      id: "a",
      subject: "route-a",
      severity: "medium",
      confidence: "low",
    });
    const b = {
      ...chain({
        id: "b",
        subject: "route-b",
        severity: "medium",
        confidence: "low",
      }),
      scopeKey: "arena:2",
    };

    expect(synthesizeCausalIncidents([a, b])).toHaveLength(2);
  });

  it("merges repeated candidate labels while preserving support counts", () => {
    const first = chain({
      id: "a",
      subject: "route-mutation",
      severity: "medium",
      confidence: "medium",
      corroborated: true,
    });
    const second = chain({
      id: "b",
      subject: "route-mutation",
      severity: "critical",
      confidence: "high",
      violation: true,
    });

    const incident = synthesizeCausalIncidents([first, second])[0]!;
    expect(incident.rootCauseCandidates).toHaveLength(1);
    expect(incident.rootCauseCandidates[0]).toEqual(expect.objectContaining({
      label: "route-mutation",
      evidenceLevel: "proven-dependency-violation",
      severity: "critical",
      confidence: "high",
      support: expect.objectContaining({
        dependencyViolations: 1,
        corroboratedRisks: 1,
      }),
    }));
  });
});
}

// Consolidated suite from engine/packages/orchestrator/test/diagnosis/causal-link-evidence-construction.test.ts
{
const graph = {
  causalLinks: [{
    id: "l1", status: "CONTRADICTED", evidenceIds: ["e1"],
    knowledgeRequirementIds: ["k1"], impactPathComponentIds: [],
    impactPathEvidenceIds: [], dimensionEvidence: {},
  }],
  knowledgeReceipts: [{
    requirementId: "k1", status: "SATISFIED", evidenceIds: ["ke1"],
    knowledgeIds: [],
  }],
} as any;
const runtimePredicate = "causal-link:l1:runtime:none";
const resolution = { causalLinkId: "l1", disposition: "RUNTIME_PROOF_REQUIRED" } as const;

function exchange(state: "present" | "absent", requestId: string): RuntimeProbeExchange {
  return {
    request: {
      schemaVersion: 1,
      requestId,
      probeId: "probe:l1",
      incidentId: "l1",
      predicate: runtimePredicate,
      query: { kind: "entity-resolvable", entityId: "entity:l1" },
      outcomeByState: { present: "resolvable", absent: "unresolvable" },
    },
    response: {
      schemaVersion: 1,
      requestId,
      probeId: "probe:l1",
      runtimeTick: 100,
      ok: true,
      state,
      evidence: {
        predicate: runtimePredicate,
        state,
        confidence: "observed",
        origin: "runtime-probe",
        proofAuthority: "live-runtime",
      },
    },
  };
}

describe("causal link evidence construction", () => {
  it("maps static knowledge, runtime unknown, and counterproof without guessing", () => {
    const construction = {
      causalLinkId: "l1",
      requiredPredicateIds: [
        "causal-link:l1:contradiction:none",
        "causal-link:l1:knowledge:k1",
        runtimePredicate,
      ],
    } as any;
    const result = constructCausalLinkEvidence({ graph, resolution, construction });
    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ predicate: "causal-link:l1:contradiction:none", state: "present", domain: "static" }),
      expect.objectContaining({ predicate: "causal-link:l1:knowledge:k1", state: "present", domain: "knowledge" }),
      expect.objectContaining({ predicate: runtimePredicate, state: "unknown", domain: "runtime" }),
      expect.objectContaining({ predicate: "causal-link:l1:counterproof:none", state: "absent" }),
    ]));
  });

  it("leaves conflicting or foreign-artifact runtime observations unknown", () => {
    const construction = { causalLinkId: "l1", requiredPredicateIds: [runtimePredicate] } as any;
    const conflict = constructCausalLinkEvidence({
      graph, resolution, construction, expectedArtifactId: "artifact:a",
      runtimeProbeTranscript: {
        schemaVersion: 1,
        artifactId: "artifact:a",
        exchanges: [exchange("present", "r1"), exchange("absent", "r2")],
      },
    });
    expect(conflict.find(item => item.domain === "runtime")?.state).toBe("unknown");
    const mismatch = constructCausalLinkEvidence({
      graph, resolution, construction, expectedArtifactId: "artifact:a",
      runtimeProbeTranscript: {
        schemaVersion: 1,
        artifactId: "artifact:b",
        exchanges: [exchange("present", "r1")],
      },
    });
    expect(mismatch.find(item => item.domain === "runtime")).toMatchObject({
      state: "unknown", evidenceId: "runtime-artifact-mismatch:l1",
    });
  });
});
}

// Consolidated suite from engine/packages/orchestrator/test/diagnosis/causal-link-hypothesis-construction.test.ts
{
describe("causal link hypothesis construction", () => {
  it("binds scenario knowledge claims into the causal proof predicates", () => {
    const result = constructCausalLinkHypothesis({
      graph: {
        schemaVersion: 1,
        policy: "scenario-driven-causal-audit",
        scenarios: [{
          id: "s1",
          label: "Anything",
          gameplayStage: "PROGRESSION",
          purpose: "Complete objective",
          sourceSubjectIds: [],
          componentIds: ["c1"],
          causalLinkIds: ["l1"],
          playerCounts: [1],
          requiredKnowledgeIds: ["k1"],
          composedScenarioIds: [],
        }],
        components: [],
        causalLinks: [{
          id: "l1",
          scenarioId: "s1",
          fromComponentId: "c1",
          toComponentId: "c2",
          purpose: "Dependency must resolve",
          evidenceIds: ["e1"],
          subjectIds: ["subject"],
          componentIds: ["c1"],
          knowledgeRequirementIds: ["k1"], impactPathComponentIds: [], impactPathEvidenceIds: [], dimensionEvidence: {},
          status: "CONTRADICTED",
          reason: "Dependency is contradicted",
        }],
        knowledgeRequirements: [{
          id: "k1",
          scenarioId: "s1",
          domain: "platform-constraints",
          reason: "Need applicable platform semantics",
          capabilityIds: [],
          dependsOnRequirementIds: [],
          subjectIds: ["subject"],
          componentIds: ["c1"],
        }],
        knowledgeReceipts: [{
          requirementId: "k1",
          scenarioId: "s1",
          domain: "platform-constraints",
          status: "SATISFIED",
          evidenceIds: ["analysis:platform-constraints"],
          knowledgeIds: ["chunks.relation.player-proximity-activates-simulation"],
          capabilityIdsUsed: ["analysis:platform-constraints"],
          subjectIds: ["subject"],
          componentIds: ["c1"],
          reason: "Applicable platform claim is present.",
        }],
        requiredInspectionGraph: {
          policy: "required-inspection-graph",
          nodes: [],
          receipts: [],
        },
      },
      resolution: {
        causalLinkId: "l1",
        scenarioId: "s1",
        knowledgeRequirementIds: ["k1"],
        evidenceIds: ["e1"],
        disposition: "RUNTIME_PROOF_REQUIRED",
        runtimeReason: "Runtime needed",
        narrowRuntimeQuestion: "Is target ready?",
      },
    });

    expect(result?.hypothesisSet.hypotheses[0]).toMatchObject({
      id: "causal-link-defect:l1",
      requiredPredicates: [
        "causal-link:l1:contradiction:none",
        "causal-link:l1:runtime:none",
        "causal-link:l1:knowledge:k1",
        "causal-link:l1:knowledge:chunks.relation.player-proximity-activates-simulation",
      ],
      falsifierPredicates: ["causal-link:l1:counterproof:none"],
    });
  });
});
}

// Consolidated suite from engine/packages/orchestrator/test/diagnosis/first-wrong-transition.test.ts
{
function violation(
  id: string,
  sequence: number,
  streamId = "stream-1",
): RuntimeTemporalAssessment {
  return {
    requirementId: id,
    status: "violated-order",
    beforePredicate: id + ":before",
    afterPredicate: id + ":after",
    after: {
      predicate: id + ":after",
      state: "present",
      confidence: "observed",
      observedAt: { streamId, sequence, tick: sequence },
    },
    reason: id,
  };
}

describe("first wrong transition", () => {
  it("selects the earliest comparable temporal violation", () => {
    const result = identifyFirstWrongTransition([
      violation("later", 20),
      violation("earlier", 10),
    ]);

    expect(result.status).toBe("identified");
    expect(result.candidate?.requirementId).toBe("earlier");
  });

  it("refuses to choose between incomparable streams", () => {
    const left = violation("left", 10, "stream-a");
    left.after = {
      ...left.after!,
      observedAt: { streamId: "stream-a", sequence: 10 },
    };
    const right = violation("right", 11, "stream-b");
    right.after = {
      ...right.after!,
      observedAt: { streamId: "stream-b", sequence: 11 },
    };

    const result = identifyFirstWrongTransition([left, right]);
    expect(result.status).toBe("ambiguous");
    expect(result.competingCandidates).toHaveLength(2);
  });

  it("does not treat unresolved or incomplete evidence as a first wrong transition", () => {
    const assessment: RuntimeTemporalAssessment = {
      requirementId: "incomplete",
      status: "evidence-incomplete",
      beforePredicate: "before",
      afterPredicate: "after",
      reason: "continuity gap",
    };

    expect(identifyFirstWrongTransition([assessment]).status)
      .toBe("not-observed");
  });
});
}
