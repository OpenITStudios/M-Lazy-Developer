import { describe, expect, it } from "vitest";
import { assessGameplayDefectResolutionGate, automaticCounterProofSearch, requiredCounterProofDimensions } from "../src/inspection/gameplay-defect-resolution.js";
import { dimensionEvidenceForRuntimeComponent } from "../src/inspection/gameplay-scenario-compiler.js";
import type { GameplayWorldModel } from "../src/inspection/gameplay-world-model.js";

function graph(componentIds: readonly string[], domain?: string) {
  return {
    scenarios: [{
      id: "s1",
      label: "generic",
      gameplayStage: "ACTIVE_GAMEPLAY",
      purpose: "Play",
      playerCounts: [1],
    }],
    components: [],
    causalLinks: [{
      id: "l1",
      scenarioId: "s1",
      status: "CONTRADICTED",
      purpose: "Dependency",
      reason: "Contradiction",
      evidenceIds: ["e1"],
      subjectIds: ["subject"],
      componentIds,
      knowledgeRequirementIds: domain ? ["k1"] : [],
      impactPathComponentIds: [],
      impactPathEvidenceIds: [],
      dimensionEvidence: {},
    }],
    knowledgeRequirements: domain
      ? [{ id: "k1", domain }]
      : [],
    knowledgeReceipts: [],
  } as any;
}

describe("gameplay defect proof dimensions", () => {
  it("derives recovery proof from canonical gameplay stage without lifecycle keywords", () => {
    const value = graph(["runtime:state"], "state-flow") as any;
    value.scenarios[0].label = "phase-seven";
    value.scenarios[0].gameplayStage = "RECOVERY";
    const dimensions = requiredCounterProofDimensions(
      value,
      value.causalLinks[0],
      value.scenarios[0],
    );
    expect(dimensions).toEqual(
      expect.arrayContaining([
        "scope",
        "guard",
        "owner",
        "generation",
        "cleanup",
      ]),
    );
  });

  it("does not let lifecycle keywords override a canonical active-gameplay stage by themselves", () => {
    const value = graph([], undefined) as any;
    value.scenarios[0].label = "reconnect-looking-name";
    value.scenarios[0].gameplayStage = "ACTIVE_GAMEPLAY";
    const dimensions = requiredCounterProofDimensions(
      value,
      value.causalLinks[0],
      value.scenarios[0],
    );
    expect(dimensions).toEqual(["scope"]);
  });

  it("does not require unrelated guard/exclusion proof for pure geometry", () => {
    const gate = assessGameplayDefectResolutionGate(
      graph(["runtime:spatial"], "spatial-authority"),
    );
    const receipt = gate.resolutions[0]?.counterProofSearch;
    expect(receipt?.searchedDimensions).not.toContain("scope");
    expect(receipt?.exhaustiveWithinScope).toBe(false);
    expect(receipt?.searchedDimensions).not.toContain("guard");
    expect(receipt?.searchedDimensions).not.toContain("exclusion");
  });

  it("keeps guard exclusion owner generation and cleanup pressure for temporal ownership", () => {
    const gate = assessGameplayDefectResolutionGate(
      graph(["runtime:persistence"], "temporal-ownership"),
    );
    const resolution = gate.resolutions[0];
    expect(resolution?.disposition).toBe(
      "COUNTERPROOF_SEARCH_REQUIRED",
    );
  });

  it("does not borrow generic causal-link evidence as geometry counterproof", () => {
    const value = graph(["runtime:spatial"], "spatial-authority");
    const search = automaticCounterProofSearch(
      value, value.causalLinks[0], value.scenarios[0],
    );
    expect(search.searchedDimensions).not.toContain("geometry");
    expect(search.exhaustiveWithinScope).toBe(false);
  });

  it("passes fully compared physical replica divergence into geometry proof without granting scope", () => {
    const world = {
      arenas: {
        count: 3,
        replicaProof: [
          { arenaId: "arena-2", status: "complete-proof",
            mismatchCount: 0, unresolvedBlocks: 0,
            evidenceIds: ["arena-replica-proof:arena-2"] },
          { arenaId: "arena-3", status: "diverged",
            mismatchCount: 2, unresolvedBlocks: 0,
            evidenceIds: ["arena-replica-proof:arena-3"] },
        ],
      },
    } as unknown as GameplayWorldModel;
    const dimensions = dimensionEvidenceForRuntimeComponent(
      "runtime:arena-replica-integrity", world, [], new Map(),
      "arena-replica-integrity",
    );
    expect(dimensions).toEqual({
      geometry: [
        "arena-replica-proof:arena-2",
        "arena-replica-proof:arena-3",
      ],
    });
    const value = graph(["runtime:arena-replica-integrity"]);
    value.causalLinks[0].dimensionEvidence = dimensions;
    const check = automaticCounterProofSearch(
      value, value.causalLinks[0], value.scenarios[0],
    );
    expect(check.searchedDimensions).toContain("geometry");
    expect(check.exhaustiveWithinScope).toBe(false);
    expect(check.searchedDimensions).not.toContain("scope");

    const partial = {
      ...world,
      arenas: {
        ...world.arenas,
        replicaProof: [
          world.arenas.replicaProof[0],
          { ...world.arenas.replicaProof[1]!, unresolvedBlocks: 1 },
        ],
      },
    } as GameplayWorldModel;
    expect(dimensionEvidenceForRuntimeComponent(
      "runtime:arena-replica-integrity", partial, [], new Map(),
      "arena-replica-integrity",
    )).toEqual({});
    expect(dimensionEvidenceForRuntimeComponent(
      "runtime:arena-replica-integrity", world, [], new Map(),
      "arena-capacity-plus-one",
    )).toEqual({});
  });

  it("uses only source-correlated, source-reachable capability exposure for activation", () => {
    const world = {
      capabilityExposure: {
        exposures: [
          { capabilityId: "dev:skip", status: "exposed",
            prerequisiteReachability: "reachable",
            evidenceIds: ["e:current"] },
          { capabilityId: "dev:unknown", status: "potentially-exposed",
            prerequisiteReachability: "unknown",
            evidenceIds: ["e:other"] },
          { capabilityId: "dev:inactive", status: "blocked",
            resolutionBasis: "trigger-absent",
            prerequisiteReachability: "unreachable",
            evidenceIds: ["e:current"] },
          { capabilityId: "dev:active", status: "guarded",
            resolutionBasis: "active-authorization-guard",
            prerequisiteReachability: "not-required",
            evidenceIds: ["e:current"] },
          { capabilityId: "dev:foreign", status: "exposed",
            prerequisiteReachability: "reachable",
            evidenceIds: ["e:foreign"] },
        ],
      },
    } as unknown as GameplayWorldModel;
    const locatorById = new Map([
      ["e:current", "behavior_packs/demo/scripts/dev.js:12:4"],
      ["e:other", "behavior_packs/demo/scripts/unknown.js:13:1"],
      ["e:foreign", "behavior_packs/another/scripts/dev.js:12:4"],
    ]);
    const proof = dimensionEvidenceForRuntimeComponent(
      "runtime:player-capability", world,
      ["behavior_packs/demo/scripts/dev.js:5:1"], locatorById,
      "player-capability-integrity",
    );
    expect(proof).toEqual({
      capability: ["e:current"],
      activation: ["e:current"],
    });
    expect(Object.keys(proof)).not.toContain("guard");
    expect(Object.keys(proof)).not.toContain("scope");
    expect(Object.keys(proof)).not.toContain("cleanup");
    expect(Object.keys(proof)).not.toContain("owner");
    const value = graph(["runtime:player-capability"]);
    value.causalLinks[0].dimensionEvidence = proof;
    const search = automaticCounterProofSearch(
      value, value.causalLinks[0], value.scenarios[0],
    );
    expect(search.searchedDimensions).toContain("activation");
    expect(search.exhaustiveWithinScope).toBe(false);

    expect(dimensionEvidenceForRuntimeComponent(
      "runtime:player-capability", world,
      ["behavior_packs/unrelated/scripts/dev.js:5:1"], locatorById,
      "player-capability-integrity",
    )).toEqual({});
    const otherScenario = dimensionEvidenceForRuntimeComponent(
      "runtime:player-capability", world,
      ["behavior_packs/demo/scripts/dev.js:5:1"], locatorById,
      "unrelated-gameplay",
    );
    expect(otherScenario).toEqual({ capability: ["e:current"] });
  });

  it("keeps genuine dimension-tagged geometry evidence available", () => {
    const value = graph(["runtime:spatial"], "spatial-authority");
    value.causalLinks[0].dimensionEvidence = {
      geometry: ["geometry:observed-voxel"],
    };
    const search = automaticCounterProofSearch(
      value, value.causalLinks[0], value.scenarios[0],
    );
    expect(search.searchedDimensions).toContain("geometry");
    expect(search.dimensionReceipts.find(
      (receipt: { dimension: string }) => receipt.dimension === "geometry",
    )?.evidenceIds).toContain("geometry:observed-voxel");
  });

});
