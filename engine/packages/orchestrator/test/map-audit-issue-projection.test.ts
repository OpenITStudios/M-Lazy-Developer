import { describe, expect, it } from "vitest";
import { assessAuditHonesty } from "../src/map-audit-honesty.js";
import {
  projectReadyAuditIssues,
  projectionContext,
} from "../src/map-audit-issue-projection.js";
import {
  assessGameplayDefectResolutionGate,
  automaticCounterProofSearch,
} from "../src/inspection/gameplay-defect-resolution.js";
import {
  projectAllNeedValidationAuditIssues,
} from "../src/map-audit-validation-projection.js";
import type {
  GameplayScenarioGraph,
} from "../src/inspection/gameplay-scenario-model.js";
import type {
  GameplayDefectResolutionGate,
} from "../src/inspection/gameplay-defect-resolution.js";

const graph: GameplayScenarioGraph = {
  schemaVersion: 1,
  policy: "scenario-driven-causal-audit",
  scenarios: [
    {
      id: "scenario:capacity",
      label: "arena-capacity-plus-one",
      gameplayStage: "READY_START",
      purpose: "Validate playable arena capacity.",
      sourceSubjectIds: ["policy:arena"],
      componentIds: ["runtime:arena"],
      causalLinkIds: ["link:capacity"],
      playerCounts: [2],
      requiredKnowledgeIds: [],
      composedScenarioIds: [],
    },
    {
      id: "scenario:progression",
      label: "wave-progression",
      gameplayStage: "PROGRESSION",
      purpose: "Validate wave progression.",
      sourceSubjectIds: ["objective:wave"],
      componentIds: ["runtime:entities"],
      causalLinkIds: ["link:progression"],
      playerCounts: [1],
      requiredKnowledgeIds: [],
      composedScenarioIds: [],
    },
  ],
  components: [],
  causalLinks: [
    {
      id: "link:capacity",
      scenarioId: "scenario:capacity",
      fromComponentId: "runtime:arena",
      toComponentId: "policy:arena",
      purpose: "Visible arena capacity remains playable.",
      evidenceIds: [
        "world:arena-count",
        "capacity:safe-concurrency",
        ...(["owner", "guard", "generation", "cleanup", "exclusion", "scope"]
          .map((dimension) => "source:capacity-" + dimension)),
      ],
      subjectIds: ["policy:arena"],
      componentIds: ["runtime:arena"],
      knowledgeRequirementIds: [],
      impactPathComponentIds: [],
      impactPathEvidenceIds: [],
      dimensionEvidence: {
        owner: ["source:capacity-owner"],
        guard: ["source:capacity-guard"],
        generation: ["source:capacity-generation"],
        cleanup: ["source:capacity-cleanup"],
        exclusion: ["source:capacity-exclusion"],
        scope: ["source:capacity-scope"],
      },
      status: "CONTRADICTED",
      reason: "Six arenas are visible but only two can run concurrently.",
    },
    {
      id: "link:progression",
      scenarioId: "scenario:progression",
      fromComponentId: "runtime:entities",
      toComponentId: "objective:wave",
      purpose: "Wave progression requires successful entity spawn.",
      evidenceIds: ["source:wave", "source:wave-guard",
        "source:wave-exclusion", "source:wave-scope"],
      subjectIds: ["objective:wave"],
      componentIds: ["runtime:entities"],
      knowledgeRequirementIds: [],
      impactPathComponentIds: [],
      impactPathEvidenceIds: [],
      dimensionEvidence: {
        guard: ["source:wave-guard"],
        exclusion: ["source:wave-exclusion"],
        scope: ["source:wave-scope"],
      },
      status: "CONTRADICTED",
      reason: "Progression advances without the required spawn.",
    },
  ],
  knowledgeRequirements: [],
  knowledgeReceipts: [],
  requiredInspectionGraph: {
    policy: "required-inspection-graph",
    nodes: [],
    receipts: [],
  },
};

const gate: GameplayDefectResolutionGate = {
  status: "READY_FOR_PROPOSED_BUG_SET",
  contradictedCausalLinkIds: [
    "link:capacity",
    "link:progression",
  ],
  resolutions: [
    {
      causalLinkId: "link:capacity",
      scenarioId: "scenario:capacity",
      disposition: "CONFIRMED_DEFECT_READY",
      gameplayTrigger: "Start a third independent arena.",
      gameplayConsequence: "Visible capacity is unavailable.",
      expectedOutcome: "All visible arena capacity is playable.",
      actualOutcome: "Only two arenas can run concurrently.",
      affectedScope: "multi-arena capacity",
      familyProof: {
        schemaVersion: 1,
        policy: "family-proof-receipt",
        failureDomain: "arena-multi-arena",
        criteria: [
          {
            id: "arena-contract-grounded",
            satisfied: true,
            evidenceIds: ["world:arena-count"],
          },
          {
            id: "concurrent-violation-reachable",
            satisfied: true,
            evidenceIds: ["capacity:safe-concurrency"],
          },
          {
            id: "arena-counterproof-exhausted",
            satisfied: true,
            evidenceIds: ["owner", "guard", "generation", "cleanup",
              "exclusion", "scope"].map((d) => "source:capacity-" + d),
          },
        ],
      },
      counterProofSearch: automaticCounterProofSearch(
        graph, graph.causalLinks[0]!, graph.scenarios[0],
      ),
    },
    {
      causalLinkId: "link:progression",
      scenarioId: "scenario:progression",
      disposition: "CONFIRMED_DEFECT_READY",
      gameplayTrigger: "Fail a required wave spawn.",
      gameplayConsequence: "Wave progression becomes incorrect.",
      expectedOutcome: "Progress only after required spawn lifecycle completes.",
      actualOutcome: "Progression advances without required spawn.",
      affectedScope: "wave progression",
      familyProof: {
        schemaVersion: 1,
        policy: "family-proof-receipt",
        failureDomain: "progression-wave-objective",
        criteria: [
          {
            id: "completion-dependency-grounded",
            satisfied: true,
            evidenceIds: ["source:wave"],
          },
          {
            id: "failing-path-reachable",
            satisfied: true,
            evidenceIds: ["source:wave"],
          },
          {
            id: "reconciliation-exhausted",
            satisfied: true,
            evidenceIds: ["source:wave-guard", "source:wave-exclusion",
              "source:wave-scope"],
          },
        ],
      },
      counterProofSearch: automaticCounterProofSearch(
        graph, graph.causalLinks[1]!, graph.scenarios[1],
      ),
    },
  ],
  confirmedDefectReadyIds: [
    "link:capacity",
    "link:progression",
  ],
  blockingCounterProofIds: [],
  runtimeProofRequiredIds: [],
  detectionGapIds: [],
  gameplayTranslationRequiredIds: [],
  counterProofSearchRequiredIds: [],
  issues: [],
};

describe("EVALUATE to PROVE to issue projection", () => {
  const baseGraph: GameplayScenarioGraph = {
    ...graph,
    scenarios: [graph.scenarios[0]!],
    causalLinks: [graph.causalLinks[0]!],
  };
  const submitted = {
    ...gate.resolutions[0]!,
    counterProofSearch: automaticCounterProofSearch(
      baseGraph, baseGraph.causalLinks[0]!, baseGraph.scenarios[0],
    ),
  };

  it("publishes only source-bound evidence in PROVEN and NEED_VALIDATION", () => {
    const decorated = {
      ...submitted,
      evidenceIds: ["world:arena-count", "foreign:invented"],
      subjectIds: ["foreign:subject"],
      componentIds: ["foreign:component"],
    };
    const proof = assessGameplayDefectResolutionGate(baseGraph, [decorated]);
    expect(proof.confirmedDefectReadyIds).toEqual(["link:capacity"]);
    const published = projectReadyAuditIssues(baseGraph, proof);
    expect(published).toHaveLength(1);
    expect(published[0]?.evidenceIds).toContain("world:arena-count");
    expect(published[0]?.evidenceIds).not.toContain("foreign:invented");
    expect(published[0]?.subjectIds).not.toContain("foreign:subject");
    expect(published[0]?.componentIds).not.toContain("foreign:component");

    const missingKnowledge = "knowledge:capacity:unknown";
    const incomplete: GameplayScenarioGraph = {
      ...baseGraph,
      causalLinks: [{
        ...baseGraph.causalLinks[0]!,
        knowledgeRequirementIds: [missingKnowledge],
      }],
      knowledgeRequirements: [{
        id: missingKnowledge,
        scenarioId: "scenario:capacity",
        domain: "state-flow",
        reason: "Unresolved state requirement",
        capabilityIds: [],
        dependsOnRequirementIds: [],
        subjectIds: ["policy:arena"],
        componentIds: ["runtime:arena"],
      }],
      knowledgeReceipts: [],
    };
    const pending = projectAllNeedValidationAuditIssues(incomplete, proof);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.status).toBe("NEED_VALIDATION");
    expect(pending[0]?.evidenceIds).not.toContain("foreign:invented");
    expect(pending[0]?.subjectIds).not.toContain("foreign:subject");
    expect(pending[0]?.componentIds).not.toContain("foreign:component");
  });

  it("preserves a grounded source contradiction through the actual PROVE gate into PROVEN output", () => {
    const proof = assessGameplayDefectResolutionGate(baseGraph, [submitted]);
    expect(proof.status).toBe("READY_FOR_PROPOSED_BUG_SET");
    expect(proof.confirmedDefectReadyIds).toEqual(["link:capacity"]);
    const output = projectReadyAuditIssues(baseGraph, proof);
    expect(output).toHaveLength(1);
    expect(output[0]).toMatchObject({
      status: "PROVEN",
      causalLinkId: "link:capacity",
      scenarioId: "scenario:capacity",
      expectedOutcome: "All visible arena capacity is playable.",
      actualOutcome: "Only two arenas can run concurrently.",
    });
  });

  it("does not admit a globally exhaustive search with a non-exhaustive dimension", () => {
    const incomplete = {
      ...submitted,
      counterProofSearch: {
        ...submitted.counterProofSearch,
        dimensionReceipts: submitted.counterProofSearch.dimensionReceipts.map((receipt) =>
          receipt.dimension === "guard"
            ? { ...receipt, exhaustiveWithinScope: false }
            : receipt),
      },
    };
    const proof = assessGameplayDefectResolutionGate(baseGraph, [incomplete]);
    expect(proof.status).toBe("BLOCKED");
    expect(proof.confirmedDefectReadyIds).toEqual([]);
    expect(proof.issues.some((issue) =>
      issue.includes("counter-proof dimension 'guard'") &&
      issue.includes("exhaustive")
    )).toBe(true);
    expect(projectReadyAuditIssues(baseGraph, proof)).toEqual([]);
  });

  it("blocks conflicting or out-of-scope counter-proof receipts before PROVEN projection", () => {
    const baseline = assessGameplayDefectResolutionGate(baseGraph, [submitted]);
    expect(baseline.confirmedDefectReadyIds).toEqual(["link:capacity"]);

    const forgedCases = [
      {
        label: "contradictory duplicate dimension",
        search: {
          ...submitted.counterProofSearch,
          dimensionReceipts: [
            ...submitted.counterProofSearch.dimensionReceipts,
            {
              dimension: "guard" as const,
              scopeIds: ["runtime:arena"],
              evidenceIds: ["world:arena-count"],
              exhaustiveWithinScope: false,
            },
          ],
        },
      },
      {
        label: "unrelated dimension scope",
        search: {
          ...submitted.counterProofSearch,
          dimensionReceipts: submitted.counterProofSearch.dimensionReceipts.map((item) =>
            ({ ...item, scopeIds: ["foreign:arena"] })),
        },
      },
      {
        label: "invented dimension evidence",
        search: {
          ...submitted.counterProofSearch,
          dimensionReceipts: submitted.counterProofSearch.dimensionReceipts.map((item) =>
            ({ ...item, evidenceIds: ["foreign:evidence"] })),
        },
      },
      {
        label: "unrelated global search scope",
        search: {
          ...submitted.counterProofSearch,
          scopeIds: ["foreign:arena"],
        },
      },
      {
        label: "invented global search evidence",
        search: {
          ...submitted.counterProofSearch,
          evidenceIds: ["foreign:evidence"],
        },
      },
    ];
    for (const { label, search } of forgedCases) {
      const proof = assessGameplayDefectResolutionGate(baseGraph, [{
        ...submitted,
        counterProofSearch: search,
      }]);
      expect(proof.confirmedDefectReadyIds, label).toEqual([]);
      expect(projectReadyAuditIssues(baseGraph, proof), label).toEqual([]);
    }
  });

  it("preserves scoped dimension-specific source evidence", () => {
    const graphWithDimensionEvidence: GameplayScenarioGraph = {
      ...baseGraph,
      causalLinks: [{
        ...baseGraph.causalLinks[0]!,
        evidenceIds: [...baseGraph.causalLinks[0]!.evidenceIds, "source:owned-dimension"],
        dimensionEvidence: {
          ...baseGraph.causalLinks[0]!.dimensionEvidence,
          owner: ["source:capacity-owner", "source:owned-dimension"],
        },
      }],
    };
    const search = automaticCounterProofSearch(
      graphWithDimensionEvidence,
      graphWithDimensionEvidence.causalLinks[0]!,
      graphWithDimensionEvidence.scenarios[0],
    );
    const proof = assessGameplayDefectResolutionGate(graphWithDimensionEvidence, [{
      ...submitted,
      counterProofSearch: search,
    }]);
    expect(proof.confirmedDefectReadyIds).toEqual(["link:capacity"]);
    expect(projectReadyAuditIssues(graphWithDimensionEvidence, proof)).toHaveLength(1);
  });

  it("conserves graph knowledge and proof through issue lanes and honesty", () => {
    const provenGate = assessGameplayDefectResolutionGate(baseGraph, [submitted]);
    expect(provenGate.confirmedDefectReadyIds).toEqual(["link:capacity"]);
    const proven = projectReadyAuditIssues(baseGraph, provenGate);
    expect(proven.map((item) => item.causalLinkId)).toEqual(["link:capacity"]);

    const honestyInput = (sourceGraph: GameplayScenarioGraph,
      sourceGate: GameplayDefectResolutionGate,
      visibleIssues: ReturnType<typeof projectAllNeedValidationAuditIssues> | typeof proven) => ({
      graph: sourceGraph,
      gate: sourceGate,
      gameplayClosure: {
        status: "CLOSED" as const,
        surfaces: [],
        unaccountedSurfaceIds: [],
        blockingSurfaceIds: [],
        unknownSurfaceIds: [],
        stateModelComplete: true,
        boundariesExtracted: true,
        reasons: [],
      },
      capabilityDelivery: [],
      negativeSpace: [],
      temporalRisks: [],
      discoveryChallenges: [],
      sharedResourceSignals: [],
      compoundBoundaries: [],
      accumulationGrowth: [],
      visibleIssues,
      visibleObligationIds: ["capability-delivery:unassessed"],
    });
    const accepted = assessAuditHonesty(
      honestyInput(baseGraph, provenGate, proven));
    expect(accepted.status).toBe("PASS");
    expect(accepted.expectedProvenIds).toEqual(["link:capacity"]);
    expect(accepted.visibleProvenIds).toEqual(["link:capacity"]);

    const requirementId = "knowledge:capacity:state-flow";
    const pendingGraph: GameplayScenarioGraph = {
      ...baseGraph,
      causalLinks: baseGraph.causalLinks.map((link) => ({
        ...link,
        knowledgeRequirementIds: [requirementId],
      })),
      knowledgeRequirements: [{
        id: requirementId,
        scenarioId: "scenario:capacity",
        domain: "state-flow",
        reason: "Arena admission state requires source knowledge.",
        capabilityIds: [],
        dependsOnRequirementIds: [],
        subjectIds: ["policy:arena"],
        componentIds: ["runtime:arena"],
      }],
      knowledgeReceipts: [{
        requirementId,
        scenarioId: "scenario:capacity",
        domain: "state-flow",
        status: "MISSING_REQUIRED_KNOWLEDGE",
        evidenceIds: [],
        knowledgeIds: [],
        capabilityIdsUsed: [],
        subjectIds: ["policy:arena"],
        componentIds: ["runtime:arena"],
        reason: "Required source knowledge is not yet available.",
      }],
    };
    expect(projectReadyAuditIssues(pendingGraph, provenGate)).toEqual([]);
    const pending = projectAllNeedValidationAuditIssues(pendingGraph, provenGate);
    expect(pending.map((item) => item.status)).toEqual(["NEED_VALIDATION"]);
    expect(pending[0]?.knowledgeRequirementIds).toEqual([requirementId]);
    const unresolvedHonesty = assessAuditHonesty(
      honestyInput(pendingGraph, provenGate, pending));
    expect(unresolvedHonesty.expectedProvenIds).toEqual([]);
    expect(unresolvedHonesty.visibleNeedValidationIds).toEqual(["link:capacity"]);
  });

  it("rejects a false positive when a graph-owned exact-target guard blocks the contradiction", () => {
    const excluded: GameplayScenarioGraph = {
      ...baseGraph,
      causalLinks: [
        ...baseGraph.causalLinks,
        {
          ...baseGraph.causalLinks[0]!,
          id: "link:capacity-exclusion",
          intentEdgeKind: "excludes",
          status: "PROVEN",
          evidenceIds: ["source:exact-admission-guard", "source:exact-admission-scope"],
          dimensionEvidence: {
            exclusion: ["source:exact-admission-guard"],
            scope: ["source:exact-admission-scope"],
          },
        },
      ],
    };
    const proof = assessGameplayDefectResolutionGate(excluded, [submitted]);
    expect(proof.status).toBe("BLOCKED");
    expect(proof.confirmedDefectReadyIds).toEqual([]);
    expect(proof.blockingCounterProofIds).toEqual(["link:capacity"]);
    expect(projectReadyAuditIssues(excluded, proof)).toEqual([]);
  });

  it("does not let a stale confirmation bypass a new exact-target guard at issue projection", () => {
    const proof = assessGameplayDefectResolutionGate(baseGraph, [submitted]);
    expect(projectReadyAuditIssues(baseGraph, proof)).toHaveLength(1);
    const updatedGraph: GameplayScenarioGraph = {
      ...baseGraph,
      causalLinks: [
        ...baseGraph.causalLinks,
        {
          ...baseGraph.causalLinks[0]!,
          id: "link:late-exclusion",
          intentEdgeKind: "excludes",
          status: "PROVEN",
          evidenceIds: ["source:late-exact-guard", "source:late-exact-scope"],
          dimensionEvidence: {
            exclusion: ["source:late-exact-guard"],
            scope: ["source:late-exact-scope"],
          },
        },
      ],
    };
    expect(projectReadyAuditIssues(updatedGraph, proof)).toEqual([]);
  });

  it("does not borrow a guard from an unrelated commit target", () => {
    const unrelated: GameplayScenarioGraph = {
      ...baseGraph,
      causalLinks: [
        ...baseGraph.causalLinks,
        {
          ...baseGraph.causalLinks[0]!,
          id: "link:unrelated-exclusion",
          intentEdgeKind: "excludes",
          status: "PROVEN",
          toComponentId: "policy:other",
          evidenceIds: ["source:unrelated-guard"],
        },
      ],
    };
    const proof = assessGameplayDefectResolutionGate(unrelated, [submitted]);
    expect(proof.blockingCounterProofIds).toEqual([]);
    expect(projectReadyAuditIssues(unrelated, proof)
      .map((item) => item.causalLinkId)).toEqual(["link:capacity"]);
  });
});

describe("report Knowledge domain provenance", () => {
  it("ignores foreign and duplicate requirement ID owners in report taxonomy", () => {
    const requirement = {
      id: "knowledge:progression:state",
      scenarioId: "scenario:progression",
      domain: "inventory-state" as const,
      reason: "Inventory scope for progression",
      capabilityIds: [], dependsOnRequirementIds: [],
      subjectIds: ["objective:wave"], componentIds: ["runtime:entities"],
    };
    const scoped: GameplayScenarioGraph = {
      ...graph,
      causalLinks: graph.causalLinks.map((link) =>
        link.id === "link:progression"
          ? { ...link, knowledgeRequirementIds: [requirement.id] }
          : link
      ),
      knowledgeRequirements: [requirement],
    };
    const context = (scenarioGraph: GameplayScenarioGraph) =>
      projectionContext(scenarioGraph, "link:progression", [])?.knowledgeDomains;
    expect(context(scoped)).toEqual(["inventory-state"]);
    expect(context({
      ...scoped,
      knowledgeRequirements: [{ ...requirement, scenarioId: "scenario:foreign" }],
    })).toEqual([]);
    expect(context({
      ...scoped,
      knowledgeRequirements: [requirement, { ...requirement }],
    })).toEqual([]);
    expect(context({
      ...scoped,
      knowledgeRequirements: [
        requirement, { ...requirement, scenarioId: "scenario:foreign" },
      ],
    })).toEqual([]);
  });
});

describe("map audit issue projection", () => {
  it("does not promote stale, foreign or non-defect resolutions in report lanes", () => {
    const capacity = gate.resolutions[0]!;
    const foreign: GameplayDefectResolutionGate = {
      ...gate,
      confirmedDefectReadyIds: ["link:capacity"],
      resolutions: [{ ...capacity, scenarioId: "scenario:progression" }],
    };
    expect(projectReadyAuditIssues(graph, foreign)).toEqual([]);

    const {
      familyProof: _discardedFamilyProof,
      counterProofSearch: _discardedCounterProof,
      ...incomplete
    } = capacity;
    const unfinished: GameplayDefectResolutionGate = {
      ...gate,
      confirmedDefectReadyIds: ["link:capacity"],
      resolutions: [incomplete],
    };
    expect(projectAllNeedValidationAuditIssues(graph, unfinished)
      .map((item) => item.causalLinkId)).toEqual(["link:capacity"]);

    const runtimeGraph: GameplayScenarioGraph = {
      ...graph,
      causalLinks: graph.causalLinks.map((link) =>
        link.id === "link:capacity"
          ? { ...link, status: "RUNTIME_BLOCKED" as const }
          : link),
    };
    expect(projectReadyAuditIssues(runtimeGraph, unfinished)).toEqual([]);
    expect(projectAllNeedValidationAuditIssues(runtimeGraph, unfinished)).toEqual([]);

    const blocked: GameplayDefectResolutionGate = {
      ...unfinished,
      resolutions: [{
        ...incomplete,
        disposition: "BLOCKING_COUNTERPROOF" as const,
      }],
    };
    expect(projectAllNeedValidationAuditIssues(graph, blocked)).toEqual([]);
    expect(projectAllNeedValidationAuditIssues(graph, {
      ...unfinished,
      resolutions: [{ ...incomplete, scenarioId: "scenario:progression" }],
    })).toEqual([]);
  });


  it("keeps causal-link knowledge authority in PROVEN and NEED_VALIDATION report metadata", () => {
    const requirementId = "knowledge:capacity:state-flow";
    const withKnowledge: GameplayScenarioGraph = {
      ...graph,
      causalLinks: graph.causalLinks.map((link) =>
        link.id === "link:capacity"
          ? { ...link, knowledgeRequirementIds: [requirementId] }
          : link),
      knowledgeRequirements: [{
        id: requirementId,
        scenarioId: "scenario:capacity",
        domain: "state-flow",
        reason: "Capacity state changes must be accounted for.",
        capabilityIds: [],
        dependsOnRequirementIds: [],
        subjectIds: ["policy:arena"],
        componentIds: ["runtime:arena"],
      }],
      knowledgeReceipts: [{
        requirementId,
        scenarioId: "scenario:capacity",
        domain: "state-flow",
        status: "SATISFIED",
        evidenceIds: ["knowledge:capacity"],
        knowledgeIds: [],
        capabilityIdsUsed: [],
        subjectIds: ["policy:arena"],
        componentIds: ["runtime:arena"],
        reason: "Selected state-flow evidence satisfies the requirement.",
      }],
    };
    // A supplied resolution is not allowed to replace graph-owned knowledge.
    const supplied: GameplayDefectResolutionGate = {
      ...gate,
      resolutions: gate.resolutions.map((resolution) =>
        resolution.causalLinkId === "link:capacity"
          ? { ...resolution, knowledgeRequirementIds: ["knowledge:foreign"] }
          : resolution),
    };
    const ready = projectReadyAuditIssues(withKnowledge, supplied)
      .find((item) => item.causalLinkId === "link:capacity");
    expect(ready?.status).toBe("PROVEN");
    expect(ready?.knowledgeRequirementIds).toEqual([requirementId]);

    const missingKnowledge: GameplayScenarioGraph = {
      ...withKnowledge,
      knowledgeReceipts: withKnowledge.knowledgeReceipts.map((item) => ({
        ...item, status: "MISSING_REQUIRED_KNOWLEDGE" as const,
      })),
    };
    const unresolved = projectAllNeedValidationAuditIssues(missingKnowledge, supplied)
      .find((item) => item.causalLinkId === "link:capacity");
    expect(unresolved?.status).toBe("NEED_VALIDATION");
    expect(unresolved?.knowledgeRequirementIds).toEqual([requirementId]);
    expect(unresolved?.validationGroupKey).toBe(
      "scenario:capacity:" + requirementId);
  });

  it("reports unresolved canonical counterproof as pending rather than already cleared", () => {
    const staleScope: GameplayScenarioGraph = {
      ...graph,
      causalLinks: graph.causalLinks.map((link) =>
        link.id === "link:capacity"
          ? { ...link, dimensionEvidence: { ...link.dimensionEvidence, scope: [] } }
          : link),
    };
    const ready = projectReadyAuditIssues(staleScope, gate);
    expect(ready.find((item) => item.causalLinkId === "link:capacity"))
      .toBeUndefined();
    const pending = projectAllNeedValidationAuditIssues(staleScope, gate)
      .find((item) => item.causalLinkId === "link:capacity");
    expect(pending?.status).toBe("NEED_VALIDATION");
    expect(pending?.validationReason).toContain(
      "canonical counter-proof search is incomplete or disputed",
    );
    expect(pending?.validationTest).toContain(
      "Resolve the canonical source-scoped counter-proof",
    );
    expect(pending?.missingProof).toContain("counter-proof-cleared");
  });

  it("keeps confirmation NEED_VALIDATION until family proof receipt is complete", () => {
    const { familyProof: _omittedFamilyProof, ...unprovenResolution } =
      gate.resolutions[1]!;
    const withoutFamilyProof: GameplayDefectResolutionGate = {
      ...gate,
      resolutions: [unprovenResolution],
      confirmedDefectReadyIds: [
        "link:progression",
      ],
    };

    const proven = projectReadyAuditIssues(
      graph,
      withoutFamilyProof,
    );
    const unresolved =
      projectAllNeedValidationAuditIssues(
        graph,
        withoutFamilyProof,
      );

    expect(proven).toEqual([]);
    expect(
      unresolved.find(
        (item) =>
          item.causalLinkId ===
          "link:progression",
      ),
    ).toMatchObject({
      status: "NEED_VALIDATION",
    });
    expect(
      unresolved.find(
        (item) =>
          item.causalLinkId ===
          "link:progression",
      )?.missingProof,
    ).toMatch(/reconciliation-exhausted/i);
  });

  it("refuses PROVEN projection when minimum proof saturation is incomplete", () => {
    const unsaturatedGate: GameplayDefectResolutionGate = {
      ...gate,
      resolutions: [{
        causalLinkId: "link:progression",
        scenarioId: "scenario:progression",
        disposition: "CONFIRMED_DEFECT_READY",
        gameplayTrigger: "Fail a required wave spawn.",
        gameplayConsequence: "Wave progression becomes incorrect.",
        expectedOutcome:
          "Progress only after required spawn lifecycle completes.",
        actualOutcome:
          "Progression advances without required spawn.",
        affectedScope: "wave progression",
      }],
      confirmedDefectReadyIds: [
        "link:progression",
      ],
    };

    const result = projectReadyAuditIssues(
      graph,
      unsaturatedGate,
    );

    expect(result).toEqual([]);
  });

  it("separates design mismatch from implementation bug in one projection", () => {
    const result = projectReadyAuditIssues(
      graph,
      gate,
      [{
        subjectId: "runtime:arena-capacity",
        label: "Playable concurrent arena capacity",
        status: "DEGRADED",
        failureClass: "DESIGN_FAILURE",
        issueType: "DESIGN_MISMATCH",
        expectedCapacity: 6,
        playableCapacity: 2,
        technicalConstraintReasons: [],
        evidenceIds: [
          "world:arena-count",
          "capacity:safe-concurrency",
        ],
        playerFacingEvidenceIds: [
          "world:arena-count",
        ],
        informationMismatch: true,
        reason: "Presented arena capacity is not fully playable.",
      }],
    );

    expect(
      result.find(
        (item) =>
          item.causalLinkId === "link:capacity",
      ),
    ).toMatchObject({
      status: "PROVEN",
      issueType: "DESIGN_MISMATCH",
    });
    expect(
      result.find(
        (item) =>
          item.causalLinkId === "link:capacity",
      ),
    ).toMatchObject({
      failureDomain: "arena-multi-arena",
      gameplayFlow: "READY_START",
      informationMismatch: true,
    });

    expect(
      result.find(
        (item) =>
          item.causalLinkId === "link:capacity",
      ),
    ).toMatchObject({
      failureDomain: "arena-multi-arena",
      contributingDomains: [
        "arena-multi-arena",
      ],
      gameplayFlow: "READY_START",
    });

    expect(
      result.find(
        (item) =>
          item.causalLinkId === "link:progression",
      ),
    ).toMatchObject({
      status: "PROVEN",
      issueType: "BUG",
    });
    expect(
      result.find(
        (item) =>
          item.causalLinkId === "link:progression",
      ),
    ).toMatchObject({
      failureDomain: "progression-wave-objective",
      gameplayFlow: "PROGRESSION",
      informationMismatch: false,
    });

    expect(
      result.find(
        (item) =>
          item.causalLinkId === "link:progression",
      ),
    ).toMatchObject({
      failureDomain:
        "progression-wave-objective",
      contributingDomains: [
        "entity-ai-combat",
        "progression-wave-objective",
      ],
      gameplayFlow: "PROGRESSION",
    });
  });
});
