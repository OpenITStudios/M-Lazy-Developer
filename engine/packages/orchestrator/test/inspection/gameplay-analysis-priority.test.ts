import { describe, expect, it } from "vitest";
import {
  deriveGameplayAnalysisPriorities,
} from "../../src/inspection/gameplay-analysis-priority.js";

describe("gameplay analysis priority", () => {
  it("prioritizes high-criticality gameplay over a historical lower-impact lead", () => {
    const priorities = deriveGameplayAnalysisPriorities({
      gameplayClosure: { surfaces: [
        { id: "runtime:structures", status: "unknown" },
      ] },
      surfaceDiscovery: { surfaceIds: [
        "runtime:structures", "runtime:arena",
      ] },
      arenas: { detected: false },
      structures: { transitionResidueRisks: 1, transitionResidueUnresolved: 0 },
    } as any, { exposures: [], releaseBlocking: 0 } as any);
    expect(priorities.map(item => item.surfaceId)).toEqual([
      "runtime:arena", "runtime:structures",
    ]);
    expect(priorities[1]?.historyPressure).toBeGreaterThan(0);
  });


  it("promotes unguarded high-impact developer capability to its own deep priority", () => {
    const priorities = deriveGameplayAnalysisPriorities(
      {
        gameplayClosure: { surfaces: [] },
        surfaceDiscovery: { surfaceIds: [] },
        arenas: { detected: false },
      } as any,
      {
        exposures: [{
          capabilityId: "developer-tool:skip:level-skip",
          capabilityLabel: "skip level",
          status: "potentially-exposed",
          prerequisiteReachability: "unknown",
          impact: "progression",
          reasons: ["authorization missing"],
          evidenceIds: ["scripts/dev.js"],
        }],
        exposed: 0,
        potentiallyExposed: 1,
        releaseBlocking: 1,
        unresolved: 0,
      },
    );

    const capability = priorities.find(
      (item) =>
        item.surfaceId ===
        "capability:developer-tool:skip:level-skip",
    );

    expect(capability?.priority).toBe("high");
    expect(capability?.proofDepth).toBe("deep");
    expect(capability?.factors).toContain("permission");
  });
});
