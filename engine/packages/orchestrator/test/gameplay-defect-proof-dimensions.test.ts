import { describe, expect, it } from "vitest";
import { assessGameplayDefectResolutionGate, automaticCounterProofSearch, requiredCounterProofDimensions } from "../src/inspection/gameplay-defect-resolution.js";

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
