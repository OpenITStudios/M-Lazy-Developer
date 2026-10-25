import { describe, expect, it } from "vitest";
import {
  assessReadyResolutionSaturation,
  sourceBoundAuditEvidenceIds,
} from "../src/map-audit-proof-saturation.js";
import { automaticCounterProofSearch } from "../src/inspection/gameplay-defect-resolution.js";
import { projectReadyAuditIssues } from "../src/map-audit-issue-projection.js";

function graph(impactPathComponentIds: readonly string[], label = "wave-progression") {
  return {
    scenarios: [{
      id: "s1",
      label,
      gameplayStage: "PROGRESSION",
      purpose: "Complete the wave",
      componentIds: ["runtime:chunks", "objective:wave"],
      sourceSubjectIds: ["objective:wave"],
      playerCounts: [1],
      causalLinkIds: ["l1"],
      requiredKnowledgeIds: [],
      composedScenarioIds: [],
    }],
    components: [
      { id: "runtime:chunks", label: "Chunk simulation" },
      { id: "objective:wave", label: "Wave objective" },
    ],
    causalLinks: [{
      id: "l1",
      scenarioId: "s1",
      fromComponentId: "runtime:chunks",
      toComponentId: "objective:wave",
      subjectIds: ["objective:wave"],
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

/**
 * Positive source-graph fixture: every counterproof dimension is explicitly
 * witnessed on the same contradiction. No runtime/Minecraft execution claim.
 */
function witnessedWave() {
  const scenario = graph(["objective:wave"], "wave-progression");
  scenario.scenarios[0] = {
    ...scenario.scenarios[0],
    sourceSubjectIds: ["objective:wave"],
    playerCounts: [1],
    causalLinkIds: ["l1"],
    requiredKnowledgeIds: [],
    composedScenarioIds: [],
  };
  const dimensions = [
    "cleanup", "exclusion", "generation", "guard", "owner", "scope",
  ] as const;
  const witnesses = dimensions.map((dimension) =>
    "source:proof:" + dimension
  );
  scenario.causalLinks[0] = {
    ...scenario.causalLinks[0],
    fromComponentId: "runtime:chunks",
    toComponentId: "objective:wave",
    subjectIds: ["objective:wave"],
    evidenceIds: ["source:contradiction", ...witnesses],
    dimensionEvidence: Object.fromEntries(dimensions.map((dimension) =>
      [dimension, ["source:proof:" + dimension]]
    )),
  };
  const link = scenario.causalLinks[0]!;
  const search = automaticCounterProofSearch(
    scenario, link, scenario.scenarios[0],
  );
  const complete = {
    ...resolution,
    evidenceIds: ["source:contradiction", ...witnesses],
    counterProofSearch: search,
    familyProof: {
      schemaVersion: 1 as const,
      policy: "family-proof-receipt" as const,
      failureDomain: "progression-wave-objective",
      criteria: [
        { id: "completion-dependency-grounded", satisfied: true,
          evidenceIds: ["source:contradiction"] },
        { id: "failing-path-reachable", satisfied: true,
          evidenceIds: ["source:contradiction"] },
        { id: "reconciliation-exhausted", satisfied: true,
          evidenceIds: ["source:proof:guard", "source:proof:exclusion", "source:proof:scope"] },
      ],
    },
  };
  return { scenario, complete };
}

describe("map audit proof saturation", () => {
  it("keeps unrelated same-scenario evidence outside the causal target and report", () => {
    const { scenario, complete } = witnessedWave();
    scenario.causalLinks.push({
      ...scenario.causalLinks[0]!,
      id: "l2:neighbor",
      fromComponentId: "runtime:other",
      evidenceIds: ["source:neighbor-only"],
      dimensionEvidence: {},
      impactPathComponentIds: [],
      impactPathEvidenceIds: [],
    });
    const owner = scenario.causalLinks[0]!;
    const search = automaticCounterProofSearch(
      scenario, owner, scenario.scenarios[0],
    );
    expect(search.evidenceIds).not.toContain("source:neighbor-only");
    expect(sourceBoundAuditEvidenceIds(scenario, owner.id))
      .not.toContain("source:neighbor-only");
    expect(sourceBoundAuditEvidenceIds(scenario, owner.id))
      .toContain("source:proof:scope");
    expect(assessReadyResolutionSaturation(scenario, complete as any).saturated)
      .toBe(true);

    // A sibling cannot rescue the contradiction when the target loses
    // its source identity. Neither its impact nor its dimension receipts
    // are proof of the target's contradictory behavior.
    scenario.causalLinks[0] = {
      ...owner, evidenceIds: [], impactPathEvidenceIds: [],
    };
    const missing = assessReadyResolutionSaturation(scenario, complete as any);
    expect(missing.missingUniversalCriteriaIds).toContain("evidence-bound");
    expect(projectReadyAuditIssues(scenario, {
      confirmedDefectReadyIds: [owner.id],
      resolutions: [complete],
    } as any)).toEqual([]);
  });

  it("requires independently supplied reachability proof and unambiguous link identity", () => {
    const { scenario, complete } = witnessedWave();
    const noReachability = {
      ...complete,
      familyProof: {
        ...complete.familyProof,
        criteria: complete.familyProof.criteria.filter((criterion) =>
          criterion.id !== "failing-path-reachable"
        ),
      },
    };
    const pending = assessReadyResolutionSaturation(scenario, noReachability as any);
    expect(pending.saturated).toBe(false);
    expect(pending.missingFamilyCriteriaIds).toContain("failing-path-reachable");

    const duplicateLink = {
      ...scenario,
      causalLinks: [...scenario.causalLinks, { ...scenario.causalLinks[0]! }],
    };
    expect(sourceBoundAuditEvidenceIds(duplicateLink, "l1")).toEqual([]);
    expect(assessReadyResolutionSaturation(duplicateLink, complete as any).saturated)
      .toBe(false);

    // The link ID and scenario ID still exist, but the scenario no longer
    // claims THIS causal link: source/PROVE/report evidence must vanish.
    const detachedLink = {
      ...scenario,
      scenarios: [{
        ...scenario.scenarios[0]!,
        causalLinkIds: [],
      }],
    };
    expect(sourceBoundAuditEvidenceIds(detachedLink, "l1")).toEqual([]);
    expect(assessReadyResolutionSaturation(
      detachedLink, complete as any,
    ).saturated).toBe(false);
    expect(projectReadyAuditIssues(detachedLink, {
      confirmedDefectReadyIds: ["l1"], resolutions: [complete],
    } as any)).toEqual([]);

    // Nor may an otherwise unique link borrow components from a scenario
    // that no longer declares its source components.
    const detachedComponent = {
      ...scenario,
      scenarios: [{
        ...scenario.scenarios[0]!,
        componentIds: ["objective:wave"],
      }],
    };
    expect(sourceBoundAuditEvidenceIds(detachedComponent, "l1")).toEqual([]);
    expect(assessReadyResolutionSaturation(
      detachedComponent, complete as any,
    ).saturated).toBe(false);

    const duplicateComponent = {
      ...scenario,
      components: [...scenario.components, {
        ...scenario.components[0]!,
        label: "Another chunk manager with the same graph ID",
        evidenceIds: ["source:foreign-manager"],
      }],
    };
    expect(sourceBoundAuditEvidenceIds(duplicateComponent, "l1")).toEqual([]);
    const unsaturated = assessReadyResolutionSaturation(
      duplicateComponent, complete as any,
    );
    expect(unsaturated.saturated).toBe(false);
    expect(unsaturated.missingUniversalCriteriaIds)
      .toContain("scenario-grounded");
    expect(projectReadyAuditIssues(duplicateComponent, {
      confirmedDefectReadyIds: ["l1"], resolutions: [complete],
    } as any)).toEqual([]);

    // Do not hide independently owned evidence when a different system
    // has a duplicate component ID. Whole-map closure remains blocked,
    // but this particular causal scope still has one unique component.
    const unrelatedDuplicate = {
      ...scenario,
      components: [...scenario.components,
        { ...scenario.components[0]!, id: "unrelated:component" },
        { ...scenario.components[0]!, id: "unrelated:component",
          label: "Second unrelated component" }],
    };
    expect(sourceBoundAuditEvidenceIds(unrelatedDuplicate, "l1"))
      .toContain("source:contradiction");
    expect(assessReadyResolutionSaturation(
      unrelatedDuplicate, complete as any,
    ).saturated).toBe(true);
    expect(assessReadyResolutionSaturation(scenario, complete as any).saturated)
      .toBe(true);
  });

  it("admits a genuinely source-witnessed canonical PROVE receipt into the ready projection", () => {
    const { scenario, complete } = witnessedWave();
    expect(complete.counterProofSearch.exhaustiveWithinScope).toBe(true);
    expect(complete.counterProofSearch.searchedDimensions).toEqual(
      expect.arrayContaining(["scope", "guard", "exclusion", "owner", "generation", "cleanup"]),
    );
    const saturation = assessReadyResolutionSaturation(scenario, complete as any);
    expect(saturation.saturated).toBe(true);
    const result = projectReadyAuditIssues(scenario, {
      confirmedDefectReadyIds: ["l1"],
      resolutions: [complete],
    } as any);
    expect(result.map((item) => item.status)).toEqual(["PROVEN"]);
  });

  it("does not promote stale exhaustive claims after the canonical graph loses scope proof", () => {
    const { scenario, complete } = witnessedWave();
    scenario.causalLinks[0].dimensionEvidence.scope = [];
    const saturation = assessReadyResolutionSaturation(scenario, complete as any);
    expect(saturation.saturated).toBe(false);
    expect(saturation.missingUniversalCriteriaIds).toContain("counter-proof-cleared");
    expect(projectReadyAuditIssues(scenario, {
      confirmedDefectReadyIds: ["l1"],
      resolutions: [complete],
    } as any)).toEqual([]);
  });

  it("does not accept a partial family search or a duplicate family receipt", () => {
    const { scenario, complete } = witnessedWave();
    const partial = {
      ...complete,
      counterProofSearch: {
        ...complete.counterProofSearch,
        searchedDimensions: ["scope"],
        dimensionReceipts: complete.counterProofSearch.dimensionReceipts
          .filter((item) => item.dimension === "scope"),
      },
    };
    const partialAssessment = assessReadyResolutionSaturation(scenario, partial as any);
    expect(partialAssessment.saturated).toBe(false);
    expect(partialAssessment.missingFamilyCriteriaIds).toContain("reconciliation-exhausted");

    const duplicate = {
      ...complete,
      familyProof: {
        ...complete.familyProof,
        criteria: [...complete.familyProof.criteria, complete.familyProof.criteria[0]!],
      },
    };
    const duplicateAssessment = assessReadyResolutionSaturation(scenario, duplicate as any);
    expect(duplicateAssessment.saturated).toBe(false);
    expect(duplicateAssessment.missingUniversalCriteriaIds).toContain("family-proof-receipt-valid");
  });


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
    const { scenario, complete } = witnessedWave();
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
    const { scenario: baseline, complete } = witnessedWave();
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

  it("does not promote a causal link with a second foreign-domain Knowledge receipt", () => {
    const { scenario: worldGraph, complete } = witnessedWave();
    const valid = worldGraph.knowledgeReceipts[0];
    expect(assessReadyResolutionSaturation(worldGraph, complete as any).saturated).toBe(true);
    for (const override of [
      { scenarioId: "scenario:foreign" },
      { domain: "platform-constraints" },
    ]) {
      const ambiguous = {
        ...worldGraph,
        knowledgeReceipts: [
          ...worldGraph.knowledgeReceipts,
          { ...valid, ...override },
        ],
      };
      const result = assessReadyResolutionSaturation(ambiguous, complete as any);
      expect(result.missingUniversalCriteriaIds)
        .toContain("required-knowledge-satisfied");
      expect(projectReadyAuditIssues(ambiguous, {
        confirmedDefectReadyIds: ["l1"],
        resolutions: [complete],
      } as any)).toEqual([]);
    }
  });

  it("rejects a satisfied knowledge receipt without matching requirement identity", () => {
    const scenario = graph(["objective:wave"], "chunk-residency-stall");
    scenario.knowledgeRequirements[1].id = "foreign-requirement";
    const result = assessReadyResolutionSaturation(scenario, resolution as any);
    expect(result.missingFamilyCriteriaIds).toContain("platform-constraint-bound");
  });
  it("does not use invented resolution or foreign-scenario evidence to saturate proof", () => {
    const { scenario, complete } = witnessedWave();
    const criteria = complete.familyProof.criteria;
    expect(assessReadyResolutionSaturation(scenario, complete as any).saturated)
      .toBe(true);

    const foreign = {
      ...complete,
      evidenceIds: ["source:contradiction", "foreign:invented"],
      familyProof: {
        ...complete.familyProof,
        criteria: criteria.map((criterion) =>
          criterion.id === "reconciliation-exhausted"
            ? { ...criterion, evidenceIds: ["foreign:invented"] }
            : criterion),
      },
    };
    const assessment = assessReadyResolutionSaturation(scenario, foreign as any);
    expect(assessment.saturated).toBe(false);
    expect(assessment.missingFamilyCriteriaIds)
      .toContain("reconciliation-exhausted");

    const falseCounterproof = {
      ...complete,
      counterProofSearch: {
        ...complete.counterProofSearch,
        evidenceIds: ["foreign:invented"],
      },
    };
    expect(assessReadyResolutionSaturation(scenario, falseCounterproof as any)
      .missingUniversalCriteriaIds).toContain("counter-proof-cleared");

    const secondScenario = {
      ...scenario,
      causalLinks: [
        ...scenario.causalLinks,
        { ...scenario.causalLinks[0],
          id: "l2", scenarioId: "s2", evidenceIds: ["foreign:invented"] },
      ],
    };
    expect(assessReadyResolutionSaturation(secondScenario, foreign as any)
      .missingFamilyCriteriaIds).toContain("reconciliation-exhausted");
  });

  it("keeps platform performance impact and degradation unproven without a causal impact path", () => {
    const baseline = graph([], "performance-budget-exceeded");
    baseline.causalLinks[0].componentIds = ["runtime:environment"];
    baseline.causalLinks[0].knowledgeRequirementIds = [
      "knowledge:s1:platform-constraints",
    ];
    baseline.knowledgeRequirements = [baseline.knowledgeRequirements[1]!];
    baseline.knowledgeReceipts = [baseline.knowledgeReceipts[1]!];

    const decorated = {
      ...resolution,
      knowledgeRequirementIds: ["knowledge:s1:platform-constraints"],
      familyProof: {
        schemaVersion: 1 as const,
        policy: "family-proof-receipt" as const,
        failureDomain: "platform-performance",
        criteria: [
          { id: "platform-constraint-grounded", satisfied: true,
            evidenceIds: ["knowledge:platform"] },
          { id: "gameplay-dependency-affected", satisfied: true,
            evidenceIds: ["source:contradiction"] },
          { id: "player-degradation-derived", satisfied: true,
            evidenceIds: ["source:contradiction"] },
        ],
      },
    };
    const missing = assessReadyResolutionSaturation(
      baseline, decorated as any,
    );
    expect(missing.failureDomain).toBe("platform-performance");
    expect(missing.missingFamilyCriteriaIds).toEqual(
      expect.arrayContaining([
        "gameplay-dependency-affected",
        "player-degradation-derived",
      ]),
    );
    expect(missing.missingFamilyCriteriaIds)
      .not.toContain("platform-constraint-grounded");

    const withImpact = {
      ...baseline,
      causalLinks: [{
        ...baseline.causalLinks[0]!,
        impactPathComponentIds: ["objective:wave"],
        impactPathEvidenceIds: ["source:impact"],
      }],
    };
    const grounded = assessReadyResolutionSaturation(
      withImpact, decorated as any,
    );
    for (const id of [
      "gameplay-dependency-affected",
      "player-degradation-derived",
    ]) {
      expect(grounded.familyCriteria.find((item) => item.id === id)?.evidenceIds)
        .toEqual(["source:impact"]);
    }
  });

  it("requires exact causal impact-path evidence for player-impact family proof", () => {
    // Actor classification is owned by the causal graph, not by the
    // resolution. The unrelated chunk/platform requirements are removed
    // here so this independently exercises the entity-AI failure family.
    const baseline = graph([], "entity-navigation-stall");
    baseline.causalLinks[0].componentIds = ["runtime:entities"];
    baseline.causalLinks[0].knowledgeRequirementIds = [];
    baseline.knowledgeRequirements = [];
    baseline.knowledgeReceipts = [];

    const actorCriterionIds = [
      "actor-contract-grounded",
      "actor-failure-reachable",
      "actor-player-impact-grounded",
    ];
    const makeProof = (impactId: string) => ({
      ...resolution,
      knowledgeRequirementIds: [],
      familyProof: {
        schemaVersion: 1 as const,
        policy: "family-proof-receipt" as const,
        failureDomain: "entity-ai-combat",
        criteria: actorCriterionIds.map((id) => ({
          id,
          satisfied: true,
          evidenceIds: [
            id === "actor-player-impact-grounded"
              ? impactId
              : "source:contradiction",
          ],
        })),
      },
    });

    const noImpact = assessReadyResolutionSaturation(
      baseline, makeProof("source:contradiction") as any,
    );
    expect(noImpact.failureDomain).toBe("entity-ai-combat");
    expect(noImpact.saturated).toBe(false);
    expect(noImpact.missingFamilyCriteriaIds)
      .toContain("actor-player-impact-grounded");

    // An evidence ID from another scenario cannot substitute for the
    // missing player-impact path even if it is available elsewhere.
    const unrelated = {
      ...baseline,
      causalLinks: [
        ...baseline.causalLinks,
        {
          ...baseline.causalLinks[0]!,
          id: "foreign:link",
          scenarioId: "foreign:scenario",
          evidenceIds: ["source:foreign-impact"],
          impactPathComponentIds: ["objective:foreign"],
          impactPathEvidenceIds: ["source:foreign-impact"],
        },
      ],
    };
    const foreign = assessReadyResolutionSaturation(
      unrelated, makeProof("source:foreign-impact") as any,
    );
    expect(foreign.missingFamilyCriteriaIds)
      .toContain("actor-player-impact-grounded");

    // A proven path on the actual causal link may support the same family
    // criterion without requiring unrelated native-Minecraft execution.
    const withImpact = {
      ...baseline,
      causalLinks: [{
        ...baseline.causalLinks[0]!,
        impactPathComponentIds: ["objective:wave"],
        impactPathEvidenceIds: ["source:impact"],
      }],
    };
    const positive = assessReadyResolutionSaturation(
      withImpact, makeProof("source:impact") as any,
    );
    expect(positive.familyCriteria.find((item) =>
      item.id === "actor-player-impact-grounded")?.evidenceIds)
      .toEqual(["source:impact"]);
    expect(positive.missingFamilyCriteriaIds)
      .not.toContain("actor-player-impact-grounded");
  });


});
