import { describe, expect, it } from "vitest";
import { assessReadyResolutionSaturation } from "../src/map-audit-proof-saturation.js";
import { projectReadyAuditIssues } from "../src/map-audit-issue-projection.js";

function graph(impactPathComponentIds: readonly string[], label = "wave-progression") {
  return {
    scenarios: [{
      id: "s1",
      label,
      gameplayStage: "PROGRESSION",
      purpose: "Complete the wave",
      componentIds: ["runtime:chunks", "objective:wave"],
    }],
    components: [
      { id: "runtime:chunks", label: "Chunk simulation" },
      { id: "objective:wave", label: "Wave objective" },
    ],
    causalLinks: [{
      id: "l1",
      scenarioId: "s1",
      status: "CONTRADICTED",
      purpose: "Actors remain simulated until completion.",
      reason: "Simulation ownership is insufficient.",
      evidenceIds: ["source:contradiction"],
      componentIds: ["runtime:chunks"],
      knowledgeRequirementIds: [
        "knowledge:s1:chunk-simulation",
        "knowledge:s1:platform-constraints",
      ],
      impactPathComponentIds,
      impactPathEvidenceIds: impactPathComponentIds.length > 0 ? ["source:impact"] : [],
      dimensionEvidence: {},
    }],
    knowledgeReceipts: [
      { requirementId: "knowledge:s1:chunk-simulation", scenarioId: "s1", domain: "chunk-simulation", status: "SATISFIED", evidenceIds: ["knowledge:chunk"] },
      { requirementId: "knowledge:s1:platform-constraints", scenarioId: "s1", domain: "platform-constraints", status: "SATISFIED", evidenceIds: ["knowledge:platform"] },
    ],
    knowledgeRequirements: [
      { id: "knowledge:s1:chunk-simulation", scenarioId: "s1", domain: "chunk-simulation" },
      { id: "knowledge:s1:platform-constraints", scenarioId: "s1", domain: "platform-constraints" },
    ],
  } as any;
}

const resolution = {
  causalLinkId: "l1",
  scenarioId: "s1",
  disposition: "CONFIRMED_DEFECT_READY" as const,
  gameplayTrigger: "Complete the wave",
  gameplayConsequence: "Wave completion is blocked.",
  expectedOutcome: "Actors remain simulated.",
  actualOutcome: "Simulation ownership is insufficient.",
  affectedScope: "wave",
  evidenceIds: ["source:contradiction"],
  knowledgeRequirementIds: [
    "knowledge:s1:chunk-simulation",
    "knowledge:s1:platform-constraints",
  ],
  counterProofSearch: {
    conclusion: "NO_BLOCKING_PROOF" as const,
    exhaustiveWithinScope: true,
    evidenceIds: ["source:contradiction"],
  },
};

describe("map audit proof saturation", () => {
  it("keeps wave progression reconciliation unknown without dimension proof", () => {
    const result = assessReadyResolutionSaturation(
      graph([]),
      resolution as any,
    );
    expect(result.failureDomain).toBe("progression-wave-objective");
    expect(result.saturated).toBe(false);
    expect(result.missingFamilyCriteriaIds).toContain(
      "reconciliation-exhausted",
    );
  });

  it("accepts only satisfied matching knowledge receipts for chunk/platform criteria", () => {
    const result = assessReadyResolutionSaturation(
      graph(["objective:wave"], "chunk-residency-stall"),
      resolution as any,
    );
    expect(result.failureDomain).toBe("chunk-simulation");
    for (const [criterionId, evidenceId] of [
      ["residency-requirement-grounded", "knowledge:chunk"],
      ["platform-constraint-bound", "knowledge:platform"],
    ]) {
      const criterion = result.familyCriteria.find((item) => item.id === criterionId);
      expect(criterion?.satisfied).toBe(true);
      expect(criterion?.evidenceIds).toContain(evidenceId);
    }
  });

  it("does not promote generic source evidence or unsatisfied platform knowledge", () => {
    const scenario = graph(["objective:wave"], "chunk-residency-stall");
    scenario.knowledgeReceipts[1].status = "MISSING_REQUIRED_KNOWLEDGE";
    const result = assessReadyResolutionSaturation(scenario, resolution as any);
    const platform = result.familyCriteria.find((item) => item.id === "platform-constraint-bound");
    expect(result.failureDomain).toBe("chunk-simulation");
    expect(platform?.satisfied).toBe(false);
    expect(platform?.evidenceIds).toEqual([]);
    expect(result.saturated).toBe(false);
  });

  it("rejects a knowledge receipt borrowed from another scenario", () => {
    const scenario = graph(["objective:wave"], "chunk-residency-stall");
    scenario.knowledgeReceipts[1].scenarioId = "foreign-scenario";
    const result = assessReadyResolutionSaturation(scenario, resolution as any);
    expect(result.missingFamilyCriteriaIds).toContain("platform-constraint-bound");
    expect(result.familyCriteria.find((item) =>
      item.id === "residency-requirement-grounded")?.satisfied).toBe(true);
  });

  it("rejects explicit family platform evidence that bypasses missing knowledge", () => {
    const scenario = graph(["objective:wave"], "chunk-residency-stall");
    scenario.knowledgeReceipts[1].status = "MISSING_REQUIRED_KNOWLEDGE";
    for (const evidenceId of ["source:contradiction", "knowledge:platform"]) {
      const decorated = {
        ...resolution,
        familyProof: {
          schemaVersion: 1 as const,
          policy: "family-proof-receipt" as const,
          failureDomain: "chunk-simulation",
          criteria: [{ id: "platform-constraint-bound", satisfied: true, evidenceIds: [evidenceId] }],
        },
      };
      const result = assessReadyResolutionSaturation(scenario, decorated as any);
      expect(result.missingFamilyCriteriaIds).toContain("platform-constraint-bound");
    }
  });

  it("accepts exact satisfied knowledge evidence in explicit family proof", () => {
    const scenario = graph(["objective:wave"], "chunk-residency-stall");
    const decorated = {
      ...resolution,
      familyProof: {
        schemaVersion: 1 as const,
        policy: "family-proof-receipt" as const,
        failureDomain: "chunk-simulation",
        criteria: [{ id: "platform-constraint-bound", satisfied: true, evidenceIds: ["knowledge:platform"] }],
      },
    };
    const result = assessReadyResolutionSaturation(scenario, decorated as any);
    expect(result.familyCriteria.find((item) => item.id === "platform-constraint-bound")?.satisfied).toBe(true);
  });

  it("rejects knowledge declared by a resolution but absent from the causal link", () => {
    const scenario = graph(["objective:wave"], "chunk-residency-stall");
    scenario.causalLinks[0].knowledgeRequirementIds = ["knowledge:s1:chunk-simulation"];
    const result = assessReadyResolutionSaturation(scenario, resolution as any);
    expect(result.missingFamilyCriteriaIds).toContain("platform-constraint-bound");
  });

  it("blocks non-platform PROVEN promotion while causal-link knowledge is unresolved", () => {
    const scenario = graph(["objective:wave"], "wave-progression");
    const complete = {
      ...resolution,
      familyProof: {
        schemaVersion: 1 as const,
        policy: "family-proof-receipt" as const,
        failureDomain: "progression-wave-objective",
        criteria: [
          "completion-dependency-grounded", "failing-path-reachable",
          "reconciliation-exhausted",
        ].map((id) => ({ id, satisfied: true, evidenceIds: ["source:contradiction"] })),
      },
    };
    expect(assessReadyResolutionSaturation(scenario, complete as any).saturated).toBe(true);

    scenario.knowledgeReceipts[0].status = "MISSING_REQUIRED_KNOWLEDGE";
    const unresolved = assessReadyResolutionSaturation(scenario, complete as any);
    expect(unresolved.saturated).toBe(false);
    expect(unresolved.missingUniversalCriteriaIds).toContain("required-knowledge-satisfied");

    // A resolution cannot erase a requirement that is owned by the graph.
    const erased = { ...complete, knowledgeRequirementIds: [] };
    expect(assessReadyResolutionSaturation(scenario, erased as any).saturated).toBe(false);
    const forgedGate = {
      confirmedDefectReadyIds: ["l1"],
      resolutions: [complete],
    };
    expect(projectReadyAuditIssues(scenario, forgedGate as any)).toEqual([]);
  });

  it("rejects missing and cross-scenario RIG receipts even if family proof is explicit", () => {
    const scenario = graph(["objective:wave"], "wave-progression");
    const complete = {
      ...resolution,
      familyProof: {
        schemaVersion: 1 as const,
        policy: "family-proof-receipt" as const,
        failureDomain: "progression-wave-objective",
        criteria: [
          "completion-dependency-grounded", "failing-path-reachable",
          "reconciliation-exhausted",
        ].map((id) => ({ id, satisfied: true, evidenceIds: ["source:contradiction"] })),
      },
    };
    scenario.knowledgeReceipts[0].scenarioId = "foreign";
    expect(assessReadyResolutionSaturation(scenario, complete as any)
      .missingUniversalCriteriaIds).toContain("required-knowledge-satisfied");
    scenario.knowledgeReceipts[0].scenarioId = "s1";
    scenario.knowledgeReceipts[0].evidenceIds = [];
    expect(assessReadyResolutionSaturation(scenario, complete as any)
      .missingUniversalCriteriaIds).toContain("required-knowledge-satisfied");
  });

  it("rejects duplicate requirement ID owners even with SATISFIED scenario evidence", () => {
    const baseline = graph(["objective:wave"], "wave-progression");
    const complete = {
      ...resolution,
      familyProof: {
        schemaVersion: 1 as const,
        policy: "family-proof-receipt" as const,
        failureDomain: "progression-wave-objective",
        criteria: [
          "completion-dependency-grounded", "failing-path-reachable",
          "reconciliation-exhausted",
        ].map((id) => ({
          id, satisfied: true, evidenceIds: ["source:contradiction"],
        })),
      },
    };
    expect(assessReadyResolutionSaturation(baseline, complete as any).saturated)
      .toBe(true);
    for (const duplicate of [
      { ...baseline.knowledgeRequirements[0] },
      { ...baseline.knowledgeRequirements[0], scenarioId: "foreign-scenario" },
    ]) {
      const changed = {
        ...baseline,
        knowledgeRequirements: [...baseline.knowledgeRequirements, duplicate],
      };
      const assessment = assessReadyResolutionSaturation(changed, complete as any);
      expect(assessment.saturated).toBe(false);
      expect(assessment.missingUniversalCriteriaIds)
        .toContain("required-knowledge-satisfied");
      expect(projectReadyAuditIssues(changed, {
        confirmedDefectReadyIds: ["l1"], resolutions: [complete],
      } as any)).toEqual([]);
    }
  });

  it("rejects a satisfied knowledge receipt without matching requirement identity", () => {
    const scenario = graph(["objective:wave"], "chunk-residency-stall");
    scenario.knowledgeRequirements[1].id = "foreign-requirement";
    const result = assessReadyResolutionSaturation(scenario, resolution as any);
    expect(result.missingFamilyCriteriaIds).toContain("platform-constraint-bound");
  });
});
