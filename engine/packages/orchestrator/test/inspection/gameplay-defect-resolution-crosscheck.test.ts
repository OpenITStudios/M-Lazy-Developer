import { describe, expect, it } from "vitest";
import {
  assessGameplayDefectResolutionGate,
  requiredCounterProofDimensions,
} from "../../src/inspection/gameplay-defect-resolution.js";
import type {
  GameplayScenarioGraph,
} from "../../src/inspection/gameplay-scenario-model.js";

const graph: GameplayScenarioGraph = {
  schemaVersion: 1,
  policy: "scenario-driven-causal-audit",
  scenarios: [{
    id: "preset:arena-capacity",
    label: "arena-capacity-plus-one",
    gameplayStage: "READY_START",
    purpose: "Validate playable multi-arena capacity.",
    sourceSubjectIds: ["policy:arena-capacity"],
    componentIds: [
      "policy:arena-capacity",
      "runtime:arena",
    ],
    causalLinkIds: ["link:arena-capacity"],
    playerCounts: [2],
    requiredKnowledgeIds: [],
    composedScenarioIds: [],
  }],
  components: [],
  causalLinks: [{
    id: "link:arena-capacity",
    scenarioId: "preset:arena-capacity",
    fromComponentId: "runtime:arena",
    toComponentId: "policy:arena-capacity",
    purpose: "Visible arena capacity remains concurrently playable.",
    evidenceIds: [
      "world:arena-count",
      "capacity:safe-concurrency",
    ],
    subjectIds: ["policy:arena-capacity"],
    componentIds: [
      "policy:arena-capacity",
      "runtime:arena",
    ],
    knowledgeRequirementIds: [],
    impactPathComponentIds: [],
    impactPathEvidenceIds: [],
    dimensionEvidence: {},
    status: "CONTRADICTED",
    reason: "Six arenas are visible but only two are concurrently playable.",
  }],
  knowledgeRequirements: [],
  knowledgeReceipts: [],
  requiredInspectionGraph: {
    policy: "required-inspection-graph",
    nodes: [],
    receipts: [],
  },
};

function resolution(
  searchedDimensions: readonly (
    | "owner"
    | "guard"
    | "generation"
    | "scope"
    | "cleanup"
    | "exclusion"
    | "geometry"
    | "capability"
    | "world-rule"
    | "activation"
    | "representation"
  )[],
) {
  return {
    causalLinkId: "link:arena-capacity",
    disposition: "CONFIRMED_DEFECT_READY" as const,
    gameplayTrigger: "Start independent parties in visible arenas.",
    gameplayConsequence: "Visible arena capacity is not actually available concurrently.",
    expectedOutcome: "All visible arena capacity is playable or design exposes the real limit.",
    actualOutcome: "Only two of six arenas can run concurrently.",
    affectedScope: "multi-arena admission",
    counterProofSearch: {
      schemaVersion: 1 as const,
      policy: "bounded-counterproof-search" as const,
      searchedDimensions,
      dimensionReceipts: searchedDimensions.map((dimension) => ({
        dimension,
        scopeIds: ["runtime:arena", "policy:arena-capacity"],
        evidenceIds: [
          "world:arena-count",
          "capacity:safe-concurrency",
        ],
        exhaustiveWithinScope: true,
      })),
      scopeIds: ["runtime:arena", "policy:arena-capacity"],
      evidenceIds: [
        "world:arena-count",
        "capacity:safe-concurrency",
      ],
      exhaustiveWithinScope: true,
      conclusion: "NO_BLOCKING_PROOF" as const,
    },
  };
}

describe("gameplay defect resolution crosscheck depth", () => {
  it("keeps ownership-sensitive contradiction in targeted counterproof continuation after safe automatic search", () => {
    const result = assessGameplayDefectResolutionGate(graph);

    expect(result.status).toBe("BLOCKED");
    expect(result.confirmedDefectReadyIds).toEqual([]);
    expect(
      result.counterProofSearchRequiredIds,
    ).toEqual(["link:arena-capacity"]);
    // No dimension is automatically covered by the raw contradiction IDs.
    expect(
      result.resolutions[0]?.counterProofSearch?.searchedDimensions,
    ).toEqual([]);
    expect(result.resolutions[0]?.counterProofSearch?.exhaustiveWithinScope)
      .toBe(false);
  });

  it("never drops a counter-proof dimension by selecting the first ambiguous Knowledge ID", () => {
    const linked = graph.causalLinks[0]!;
    const state = {
      id: "knowledge:shared-id",
      scenarioId: linked.scenarioId,
      domain: "state-flow" as const,
      reason: "State ownership",
      capabilityIds: [], dependsOnRequirementIds: [],
      subjectIds: [], componentIds: [],
    };
    const spatial = {
      ...state,
      scenarioId: "scenario:other",
      domain: "spatial-authority" as const,
    };
    const withKnowledge: GameplayScenarioGraph = {
      ...graph,
      knowledgeRequirements: [state, spatial],
      causalLinks: [{
        ...linked,
        knowledgeRequirementIds: [state.id],
      }],
    };
    const linkedScenario = withKnowledge.scenarios[0]!;
    const dimensions = requiredCounterProofDimensions(
      withKnowledge, withKnowledge.causalLinks[0]!, linkedScenario,
    );
    expect(dimensions).toContain("geometry");
    expect(dimensions).toContain("guard");
    expect(dimensions).toContain("scope");
    // This broadens search pressure, not evidence authority: the global
    // uniqueness/receipt gate remains responsible for rejecting PROVEN.
  });

  it("rejects shallow one-dimension counter-proof search for ownership-sensitive defects", () => {
    const result = assessGameplayDefectResolutionGate(
      graph,
      [resolution(["guard"])],
    );

    expect(result.status).toBe("BLOCKED");
    expect(result.issues.join(" ")).toMatch(
      /missing relevant dimensions/i,
    );
  });

  it("does not treat an overlapping exclusion on a different commit target as blocking counter-proof", () => {
    const withUnrelatedGuard: GameplayScenarioGraph = {
      ...graph,
      causalLinks: [
        ...graph.causalLinks,
        {
          ...graph.causalLinks[0]!,
          id: "link:unrelated-guard",
          scenarioId: "preset:arena-capacity",
          fromComponentId: "runtime:arena",
          toComponentId: "policy:other",
          purpose: "Guard unrelated policy state.",
          evidenceIds: ["source:other-guard"],
          subjectIds: ["policy:arena-capacity"],
          componentIds: ["runtime:arena"],
          intentEdgeKind: "excludes",
          status: "PROVEN",
          reason: "An unrelated guard exists.",
        },
      ],
    };

    const result =
      assessGameplayDefectResolutionGate(
        withUnrelatedGuard,
      );

    expect(result.blockingCounterProofIds).toEqual([]);
    expect(result.counterProofSearchRequiredIds).toEqual([
      "link:arena-capacity",
    ]);
  });

  it("accepts blocking counter-proof only when exclusion applies at the contradicted commit target", () => {
    const withExactGuard: GameplayScenarioGraph = {
      ...graph,
      causalLinks: [
        ...graph.causalLinks,
        {
          ...graph.causalLinks[0]!,
          id: "link:exact-guard",
          dimensionEvidence: { exclusion: ["source:exact-guard"], scope: ["source:exact-scope"] },
          scenarioId: "preset:arena-capacity",
          fromComponentId: "runtime:arena",
          toComponentId: "policy:arena-capacity",
          purpose: "Exclude unavailable arena admission.",
          evidenceIds: ["source:exact-guard", "source:exact-scope"],
          subjectIds: ["policy:arena-capacity"],
          componentIds: ["runtime:arena", "policy:arena-capacity"],
          intentEdgeKind: "excludes",
          status: "PROVEN",
          reason:
            "Exact admission guard blocks the contradicted target.",
        },
      ],
    };

    const result =
      assessGameplayDefectResolutionGate(
        withExactGuard,
      );

    expect(result.blockingCounterProofIds).toEqual([
      "link:arena-capacity",
    ]);
    expect(result.confirmedDefectReadyIds).toEqual([]);
  });

  it("does not suppress a defect without complete subject scope and an explicit scope witness", () => {
    const base = graph.causalLinks[0]!;
    const exact = {
      ...base,
      id: "link:source-exclusion",
      status: "PROVEN" as const,
      intentEdgeKind: "excludes" as const,
      evidenceIds: ["source:guard", "source:scope"],
      dimensionEvidence: { exclusion: ["source:guard"], scope: ["source:scope"] },
    };
    const withoutScopeEvidence: GameplayScenarioGraph = {
      ...graph,
      causalLinks: [base, { ...exact, dimensionEvidence: { exclusion: ["source:guard"] } }],
    };
    const broaderSubject: GameplayScenarioGraph = {
      ...graph,
      causalLinks: [base, { ...exact, subjectIds: [...base.subjectIds, "arena:foreign"] }],
    };
    const partialComponents: GameplayScenarioGraph = {
      ...graph,
      causalLinks: [base, { ...exact, componentIds: ["runtime:arena"] }],
    };
    const exactMatch: GameplayScenarioGraph = {
      ...graph,
      causalLinks: [base, exact],
    };
    for (const candidate of [withoutScopeEvidence, broaderSubject, partialComponents]) {
      const result = assessGameplayDefectResolutionGate(candidate);
      expect(result.blockingCounterProofIds).toEqual([]);
      expect(result.counterProofSearchRequiredIds).toContain(base.id);
    }
    expect(assessGameplayDefectResolutionGate(exactMatch).blockingCounterProofIds)
      .toEqual([base.id]);
  });

  it("does not confuse an authored return guard witness with completed blocking-guard search", () => {
    const base = graph.causalLinks[0]!;
    const guarded: GameplayScenarioGraph = {
      ...graph,
      causalLinks: [{
        ...base,
        intentEdgeKind: "requires",
        evidenceIds: [...base.evidenceIds, "source:observed-return", "source:modeled-scope"],
        dimensionEvidence: { guard: ["source:observed-return"], scope: ["source:modeled-scope"] },
      }],
    };
    const result = assessGameplayDefectResolutionGate(guarded);
    const guardReceipt = result.resolutions[0]?.counterProofSearch?.dimensionReceipts
      .find((receipt) => receipt.dimension === "guard");
    expect(guardReceipt?.evidenceIds).toEqual(["source:observed-return"]);
    expect(guardReceipt?.exhaustiveWithinScope).toBe(false);
    expect(result.confirmedDefectReadyIds).toEqual([]);
    expect(result.counterProofSearchRequiredIds).toEqual([base.id]);
  });

  it("rejects a supplied blocking counter-proof without a graph-backed exclusion", () => {
    const result = assessGameplayDefectResolutionGate(graph, [{
      causalLinkId: "link:arena-capacity",
      scenarioId: "preset:arena-capacity",
      disposition: "BLOCKING_COUNTERPROOF",
      counterProofEvidenceIds: ["source:unrelated-or-invented"],
    }]);

    expect(result.status).toBe("BLOCKED");
    expect(result.blockingCounterProofIds).toEqual([]);
    expect(result.counterProofSearchRequiredIds).toEqual(["link:arena-capacity"]);
    expect(result.issues.join(" ")).toMatch(/exact PROVEN exclusion/i);
    expect(result.resolutions[0]?.disposition).toBe("COUNTERPROOF_SEARCH_REQUIRED");
  });

  it("rejects foreign proof evidence despite a real unrelated guard", () => {
    const withUnrelatedGuard: GameplayScenarioGraph = {
      ...graph,
      causalLinks: [
        ...graph.causalLinks,
        {
          ...graph.causalLinks[0]!,
          id: "link:unrelated-counterproof",
          intentEdgeKind: "excludes",
          status: "PROVEN",
          toComponentId: "policy:other",
          evidenceIds: ["source:other-guard"],
        },
      ],
    };
    const result = assessGameplayDefectResolutionGate(withUnrelatedGuard, [{
      causalLinkId: "link:arena-capacity",
      disposition: "BLOCKING_COUNTERPROOF",
      counterProofEvidenceIds: ["source:other-guard"],
    }]);
    expect(result.blockingCounterProofIds).toEqual([]);
    expect(result.status).toBe("BLOCKED");
    expect(result.issues.join(" ")).toMatch(/exact PROVEN exclusion/i);
  });

  it("accepts a supplied blocker only when the same target has a real exclusion", () => {
    const withExactGuard: GameplayScenarioGraph = {
      ...graph,
      causalLinks: [
        ...graph.causalLinks,
        {
          ...graph.causalLinks[0]!,
          id: "link:real-exclusion",
          dimensionEvidence: { exclusion: ["source:exact-guard"], scope: ["source:exact-scope"] },
          intentEdgeKind: "excludes",
          status: "PROVEN",
          evidenceIds: ["source:exact-guard", "source:exact-scope"],
        },
      ],
    };
    const supported = assessGameplayDefectResolutionGate(withExactGuard, [{
      causalLinkId: "link:arena-capacity",
      disposition: "BLOCKING_COUNTERPROOF",
      counterProofEvidenceIds: ["source:exact-guard"],
    }]);
    expect(supported.status).toBe("READY_FOR_PROPOSED_BUG_SET");
    expect(supported.blockingCounterProofIds).toEqual(["link:arena-capacity"]);
    expect(supported.confirmedDefectReadyIds).toEqual([]);

    // Different authored causal links (or scenarios) may share a generated
    // ID. A valid exclusion cannot make that ambiguous source graph READY.
    const sameIdLink: GameplayScenarioGraph = {
      ...withExactGuard,
      causalLinks: [
        ...withExactGuard.causalLinks,
        { ...withExactGuard.causalLinks[0]!,
          purpose: "A different mode has a conflicting capacity rule." },
      ],
    };
    const ambiguousLink = assessGameplayDefectResolutionGate(sameIdLink, [{
      causalLinkId: "link:arena-capacity",
      disposition: "BLOCKING_COUNTERPROOF",
      counterProofEvidenceIds: ["source:exact-guard"],
    }]);
    expect(ambiguousLink.status).toBe("BLOCKED");
    expect(ambiguousLink.issues.join(" ")).toMatch(/Ambiguous causal-link ID/);
    const sameIdScenario: GameplayScenarioGraph = {
      ...withExactGuard,
      scenarios: [
        ...withExactGuard.scenarios,
        { ...withExactGuard.scenarios[0]!,
          label: "unrelated second mode" },
      ],
    };
    const ambiguousScenario = assessGameplayDefectResolutionGate(
      sameIdScenario, [{
        causalLinkId: "link:arena-capacity",
        disposition: "BLOCKING_COUNTERPROOF",
        counterProofEvidenceIds: ["source:exact-guard"],
      }],
    );
    expect(ambiguousScenario.status).toBe("BLOCKED");
    expect(ambiguousScenario.issues.join(" ")).toMatch(/Ambiguous scenario ID/);

    const component = {
      id: "runtime:arena", label: "Current arena owner",
      kind: "runtime-domain" as const, technicalRole: "Source arena",
      gameplayPurpose: "Arena admission", evidenceIds: ["source:current-arena"],
      usedByScenarioIds: ["preset:arena-capacity"], orphan: false,
    };
    const duplicateComponent: GameplayScenarioGraph = {
      ...withExactGuard,
      components: [component, { ...component, label: "Foreign arena owner" }],
    };
    const ambiguousComponentGate = assessGameplayDefectResolutionGate(
      duplicateComponent, [{
        causalLinkId: "link:arena-capacity",
        disposition: "BLOCKING_COUNTERPROOF",
        counterProofEvidenceIds: ["source:exact-guard"],
      }],
    );
    expect(ambiguousComponentGate.status).toBe("BLOCKED");
    expect(ambiguousComponentGate.issues.join(" "))
      .toMatch(/Ambiguous component ID runtime:arena/);
    expect(ambiguousComponentGate.confirmedDefectReadyIds).toEqual([]);

    const forged = assessGameplayDefectResolutionGate(withExactGuard, [{
      causalLinkId: "link:arena-capacity",
      disposition: "BLOCKING_COUNTERPROOF",
      counterProofEvidenceIds: ["source:exact-guard", "source:invented"],
    }]);
    expect(forged.status).toBe("BLOCKED");
    expect(forged.issues.join(" ")).toMatch(/foreign or unsupported evidence/i);
    expect(forged.resolutions[0]?.counterProofEvidenceIds).toEqual(["source:exact-guard"]);
  });

  it("does not allow incidental evidence on a proven exclusion to dismiss the same target", () => {
    const exact: GameplayScenarioGraph = {
      ...graph,
      causalLinks: [
        ...graph.causalLinks,
        {
          ...graph.causalLinks[0]!,
          id: "link:exact-exclusion-with-context",
          intentEdgeKind: "excludes",
          status: "PROVEN",
          evidenceIds: ["source:exclusion-proof", "source:incidental-context", "source:exact-scope"],
          dimensionEvidence: { exclusion: ["source:exclusion-proof"], scope: ["source:exact-scope"] },
        },
      ],
    };
    const result = assessGameplayDefectResolutionGate(exact, [{
      causalLinkId: "link:arena-capacity",
      disposition: "BLOCKING_COUNTERPROOF",
      counterProofEvidenceIds: ["source:incidental-context"],
    }]);
    expect(result.status).toBe("BLOCKED");
    expect(result.issues.join(" ")).toMatch(/foreign or unsupported evidence/i);
    expect(result.resolutions[0]?.counterProofEvidenceIds)
      .toEqual(["source:exclusion-proof"]);
  });

  it("does not accept supplied defect confirmation when source-proven exclusion blocks it", () => {
    const withGuard: GameplayScenarioGraph = {
      ...graph,
      causalLinks: [
        ...graph.causalLinks,
        {
          ...graph.causalLinks[0]!,
          id: "link:source-guard",
          dimensionEvidence: { exclusion: ["source:exact-guard"], scope: ["source:exact-scope"] },
          intentEdgeKind: "excludes",
          status: "PROVEN",
          evidenceIds: ["source:exact-guard", "source:exact-scope"],
        },
      ],
    };
    const result = assessGameplayDefectResolutionGate(withGuard, [resolution([
      "owner", "guard", "generation", "scope", "cleanup", "exclusion",
    ])]);
    expect(result.status).toBe("BLOCKED");
    expect(result.issues.join(" ")).toMatch(/cannot override source-proven blocking counter-proof/i);
    expect(result.confirmedDefectReadyIds).toEqual([]);
    expect(result.blockingCounterProofIds).toEqual(["link:arena-capacity"]);
  });

  it("rejects supplied exhaustive receipts that only repeat generic causal evidence", () => {
    const result = assessGameplayDefectResolutionGate(
      graph,
      [resolution([
        "owner", "guard", "generation", "scope", "cleanup", "exclusion",
      ])],
    );

    expect(result.status).toBe("BLOCKED");
    expect(result.confirmedDefectReadyIds).toEqual([]);
    expect(result.counterProofSearchRequiredIds).toEqual(["link:arena-capacity"]);
    expect(result.issues.join(" ")).toMatch(
      /canonical dimension witnesses|source-bound scope\/evidence/i,
    );
  });

  it("retains confirmed disposition when the canonical target has distinct witnessed dimensions", () => {
    // A model-level fixture representing a bounded upstream source analysis,
    // not a claim that this suite executed an actual Minecraft artifact.
    const dimensionEvidence = {
      cleanup: ["source:cleanup"],
      exclusion: ["source:exclusion"],
      generation: ["source:generation"],
      guard: ["source:guard"],
      owner: ["source:owner"],
      scope: ["source:scope"],
    };
    const witnessed: GameplayScenarioGraph = {
      ...graph,
      causalLinks: [{
        ...graph.causalLinks[0]!,
        evidenceIds: [
          ...graph.causalLinks[0]!.evidenceIds,
          ...Object.values(dimensionEvidence).flat(),
        ],
        dimensionEvidence,
      }],
    };
    const result = assessGameplayDefectResolutionGate(witnessed);
    expect(result.status).toBe("READY_FOR_PROPOSED_BUG_SET");
    expect(result.confirmedDefectReadyIds).toEqual(["link:arena-capacity"]);
    expect(result.resolutions[0]?.counterProofSearch?.exhaustiveWithinScope)
      .toBe(true);
  });

  it("does not accept an authored exclusion without an exact exclusion witness", () => {
    const authored: GameplayScenarioGraph = {
      ...graph,
      causalLinks: [
        ...graph.causalLinks,
        {
          ...graph.causalLinks[0]!,
          id: "link:declaration-only-exclusion",
          status: "PROVEN",
          intentEdgeKind: "excludes",
          evidenceIds: ["source:declared-exclusion"],
        },
      ],
    };
    const result = assessGameplayDefectResolutionGate(authored);
    expect(result.blockingCounterProofIds).toEqual([]);
    expect(result.counterProofSearchRequiredIds).toEqual(["link:arena-capacity"]);
  });

  it("does not borrow a same-subject exclusion or scope witness from another target", () => {
    const differentTarget: GameplayScenarioGraph = {
      ...graph,
      causalLinks: [
        ...graph.causalLinks,
        {
          ...graph.causalLinks[0]!,
          id: "link:different-commit-target",
          status: "PROVEN",
          toComponentId: "policy:other",
          intentEdgeKind: "excludes",
          evidenceIds: ["source:other-exclusion"],
          dimensionEvidence: {
            scope: ["source:other-exclusion"],
            exclusion: ["source:other-exclusion"],
          },
        },
      ],
    };
    const result = assessGameplayDefectResolutionGate(differentTarget);
    expect(result.blockingCounterProofIds).toEqual([]);
    expect(result.resolutions[0]?.counterProofSearch?.searchedDimensions)
      .not.toContain("scope");
    expect(result.resolutions[0]?.counterProofSearch?.searchedDimensions)
      .not.toContain("exclusion");
  });

  it("requires geometry counter-proof for physical escape claims", () => {
    const spatialGraph: GameplayScenarioGraph = {
      ...graph,
      scenarios: [{
        ...graph.scenarios[0]!,
        id: "preset:physical-escape",
        label: "arena-physical-escape",
        purpose: "Validate whether a flying player can cross the arena barrier boundary.",
        causalLinkIds: ["link:physical-escape"],
      }],
      causalLinks: [{
        ...graph.causalLinks[0]!,
        id: "link:physical-escape",
        scenarioId: "preset:physical-escape",
        purpose: "Player remains physically contained by arena collision geometry.",
        reason: "mayfly is enabled and no script position clamp was found.",
      }],
    };

    const result = assessGameplayDefectResolutionGate(spatialGraph);

    expect(result.status).toBe("BLOCKED");
    expect(result.counterProofSearchRequiredIds).toEqual([
      "link:physical-escape",
    ]);
    expect(
      result.resolutions[0]?.counterProofSearch?.searchedDimensions,
    ).not.toContain("geometry");
  });

  it("requires capability, activation and world-rule counter-proof for privileged spawn claims", () => {
    const capabilityGraph: GameplayScenarioGraph = {
      ...graph,
      scenarios: [{
        ...graph.scenarios[0]!,
        id: "preset:roommaster-spawn",
        label: "roommaster-manual-spawn",
        purpose: "Validate Roommaster/admin manual entity spawning under world gamerules.",
        causalLinkIds: ["link:roommaster-spawn"],
      }],
      causalLinks: [{
        ...graph.causalLinks[0]!,
        id: "link:roommaster-spawn",
        scenarioId: "preset:roommaster-spawn",
        purpose: "Protected live arena rejects unauthorized entity spawning.",
        reason: "Admin permission bypass may allow manual spawn while doMobSpawning is false.",
      }],
    };

    const result = assessGameplayDefectResolutionGate(capabilityGraph);

    expect(result.status).toBe("BLOCKED");
    expect(result.counterProofSearchRequiredIds).toEqual([
      "link:roommaster-spawn",
    ]);
  });

  it("requires representation counter-proof for client-only visual mutation claims", () => {
    const representationGraph: GameplayScenarioGraph = {
      ...graph,
      scenarios: [{
        ...graph.scenarios[0]!,
        id: "preset:waterlog-desync",
        label: "client-waterlog-desync",
        purpose: "Validate client/server reconciliation after cancelled water placement.",
        causalLinkIds: ["link:waterlog-desync"],
      }],
      causalLinks: [{
        ...graph.causalLinks[0]!,
        id: "link:waterlog-desync",
        scenarioId: "preset:waterlog-desync",
        purpose: "Cancelled world mutation reconciles to the authoritative server state.",
        reason: "Acting client may retain a waterlogged ghost visual.",
      }],
    };

    const result = assessGameplayDefectResolutionGate(representationGraph);

    expect(result.status).toBe("BLOCKED");
    expect(result.counterProofSearchRequiredIds).toEqual([
      "link:waterlog-desync",
    ]);
  });
});

describe("non-finding PROVE resolution conservation", () => {
  const gapGraph: GameplayScenarioGraph = {
    ...graph,
    causalLinks: graph.causalLinks.map((link) => ({
      ...link,
      status: "DETECTION_GAP" as const,
    })),
  };

  it("does not borrow a foreign same-ID Knowledge receipt as defect evidence", () => {
    const requirement = {
      id: "knowledge:arena:state",
      scenarioId: "preset:arena-capacity",
      domain: "state-flow" as const,
      reason: "Arena admission state ownership",
      capabilityIds: ["state-flow"],
      dependsOnRequirementIds: [],
      subjectIds: ["policy:arena-capacity"],
      componentIds: ["runtime:arena"],
    };
    const receipt = {
      requirementId: requirement.id,
      scenarioId: requirement.scenarioId,
      domain: requirement.domain,
      status: "SATISFIED" as const,
      evidenceIds: ["e:knowledge-owner"],
      knowledgeIds: ["knowledge:arena:state"],
      capabilityIdsUsed: ["state-flow"],
      subjectIds: requirement.subjectIds,
      componentIds: requirement.componentIds,
      reason: "Selected source proves arena ownership.",
    };
    const withKnowledge: GameplayScenarioGraph = {
      ...graph,
      knowledgeRequirements: [requirement],
      knowledgeReceipts: [receipt],
      causalLinks: graph.causalLinks.map((link) => ({
        ...link, knowledgeRequirementIds: [requirement.id],
      })),
    };
    const admitted = assessGameplayDefectResolutionGate(withKnowledge);
    expect(admitted.resolutions[0]?.evidenceIds)
      .toContain("e:knowledge-owner");

    for (const foreign of [
      { scenarioId: "scenario:elsewhere" },
      { domain: "chunk-simulation" as const },
    ]) {
      const conflicted: GameplayScenarioGraph = {
        ...withKnowledge,
        knowledgeReceipts: [receipt, { ...receipt, ...foreign }],
      };
      const resolution = assessGameplayDefectResolutionGate(conflicted);
      expect(resolution.resolutions[0]?.evidenceIds)
        .not.toContain("e:knowledge-owner");
      expect(resolution.resolutions[0]?.knowledgeRequirementIds)
        .toContain(requirement.id);
    }
  });

  it("keeps source detection gaps as valid non-finding obligations without fabricating a defect", () => {
    const result = assessGameplayDefectResolutionGate(gapGraph);
    expect(result.status).toBe("READY_FOR_PROPOSED_BUG_SET");
    expect(result.detectionGapIds).toEqual(["link:arena-capacity"]);
    expect(result.confirmedDefectReadyIds).toEqual([]);
    expect(result.issues).toEqual([]);
  });

  it("keeps a typed runtime question as an unresolved non-finding resolution", () => {
    const runtimeGraph: GameplayScenarioGraph = {
      ...graph,
      causalLinks: graph.causalLinks.map((link) => ({
        ...link,
        status: "RUNTIME_BLOCKED" as const,
        runtimeNativeReason: "engine-scheduling" as const,
      })),
    };
    const result = assessGameplayDefectResolutionGate(runtimeGraph);
    expect(result.status).toBe("READY_FOR_PROPOSED_BUG_SET");
    expect(result.runtimeProofRequiredIds).toEqual(["link:arena-capacity"]);
    expect(result.confirmedDefectReadyIds).toEqual([]);
    expect(result.resolutions[0]?.narrowRuntimeQuestion).toBeTruthy();
  });

  it("rejects attempts to turn an unproven causal gap into a gameplay finding", () => {
    const result = assessGameplayDefectResolutionGate(gapGraph, [{
      causalLinkId: "link:arena-capacity",
      scenarioId: "preset:arena-capacity",
      disposition: "CONFIRMED_DEFECT_READY",
    }]);
    expect(result.status).toBe("BLOCKED");
    expect(result.confirmedDefectReadyIds).toEqual([]);
    expect(result.detectionGapIds).toEqual(["link:arena-capacity"]);
    expect(result.issues.join(" ")).toMatch(/DETECTION_GAP cannot be promoted/);
  });

  it("rejects a supplied resolution assigned to another scenario", () => {
    const result = assessGameplayDefectResolutionGate(gapGraph, [{
      causalLinkId: "link:arena-capacity",
      scenarioId: "preset:other",
      disposition: "DETECTION_GAP",
      detectionGapReason: "Unresolved source causality.",
      missingCapability: "Selected-artifact causal evidence.",
    }]);
    expect(result.status).toBe("BLOCKED");
    expect(result.issues.join(" ")).toMatch(/scenarioId does not match/);
  });
});
