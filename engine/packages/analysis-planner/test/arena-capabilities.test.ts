import { describe, expect, it } from "vitest";
import {
  ARENA_ANALYSIS_CAPABILITIES,
  createAnalysisCapabilityRegistry,
  planMinimumSufficientAnalysis,
} from "../src/index.js";

describe("arena analysis capabilities", () => {
  it("form a valid capability registry without duplicate ownership", () => {
    const registry = createAnalysisCapabilityRegistry(
      ARENA_ANALYSIS_CAPABILITIES,
    );
    expect(registry.capabilities).toHaveLength(
      ARENA_ANALYSIS_CAPABILITIES.length,
    );
  });

  it("selects the cheap capacity proof when capacity is the specific concern", () => {
    const plan = planMinimumSufficientAnalysis({
      goal: "semantic-consistency",
      relevantTags: ["arena", "capacity"],
      context: "REMOTE_GITHUB",
      capabilities: ARENA_ANALYSIS_CAPABILITIES,
    });

    expect(plan.disposition).toBe("execute");
    expect(plan.steps[0]?.capabilityId).toBe(
      "arena-concurrency-capacity",
    );
  });

  it("prefers terrain-specific chunk evidence before voxel decode", () => {
    const plan = planMinimumSufficientAnalysis({
      goal: "semantic-consistency",
      relevantTags: ["arena", "terrain"],
      context: "LOCAL_ARTIFACT",
      capabilities: ARENA_ANALYSIS_CAPABILITIES,
      completedCapabilityIds: [
        "safe-config-resolution",
        "arena-replica-fidelity",
      ],
    });

    expect(plan.disposition).toBe("execute");
    expect(plan.steps[0]).toMatchObject({
      capabilityId: "arena-spatial-fingerprint",
      cost: "moderate",
    });
  });

  it("keeps actor DB analysis behind cheaper authored entity evidence", () => {
    const plan = planMinimumSufficientAnalysis({
      goal: "semantic-consistency",
      relevantTags: ["arena", "entity"],
      context: "LOCAL_ARTIFACT",
      capabilities: ARENA_ANALYSIS_CAPABILITIES,
      completedCapabilityIds: [
        "safe-config-resolution",
      ],
    });

    expect(plan.steps[0]?.capabilityId).toBe(
      "arena-authored-entity-fidelity",
    );
  });
});
