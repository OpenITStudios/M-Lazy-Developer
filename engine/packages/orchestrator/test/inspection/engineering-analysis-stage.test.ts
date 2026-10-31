import { describe, expect, it } from "vitest";
import {
  deriveInspectionEngineeringAnalyses,
} from "../../src/inspection/engineering-analysis-stage.js";
import type {
  GameplayWorldModel,
} from "../../src/inspection/gameplay-world-model.js";

describe("inspection engineering analysis", () => {
  it("synthesizes a causal analysis for six arenas capped at two", () => {
    const world = {
      arenas: {
        detected: true,
        count: 6,
        safeConcurrentArenas: 2,
        declaredConcurrentArenaLimit: 2,
      },
    } as unknown as GameplayWorldModel;

    const analyses =
      deriveInspectionEngineeringAnalyses({
        world,
        arenaCapacity: {
          resources: [{
            id: "runtime-arena-admission-cap",
            backend: "fixed-pool",
            perArena: 1,
            total: 2,
          }],
          evidence: {
            requestedConcurrentArenas: 6,
            discoveredArenaCount: 6,
            declaredConcurrentArenaLimit: 2,
            arenaCountConflict: false,
            commandTickingAreaAdds: 0,
            completeCommandTickingAreaFamilies: 0,
            unmatchedCommandTickingAreaAdds: 0,
            commandTickingAreaResourceResolved: false,
            scriptTickingAreaManagerReferenced: false,
            scriptCapacitySignals: [],
            scriptTickingAreaCapacityResolved: false,
            conflictingPlayerCapacityValues: [],
            reasons: [],
          },
          report: {
            requestedConcurrentArenas: 6,
            safeConcurrentArenas: 2,
            ok: false,
            limitingResourceIds: [
              "runtime-arena-admission-cap",
            ],
            resources: [{
              id: "runtime-arena-admission-cap",
              backend: "fixed-pool",
              safeConcurrentArenas: 2,
              limiting: true,
              reason: "cap",
            }],
          },
        },
        target: {
          edition: "education",
          version: "1.26.30",
        },
      });

    expect(analyses).toHaveLength(1);
    expect(
      analyses[0]?.analysis.designContradiction,
    ).toMatch(/6 arena instances/);
    expect(
      analyses[0]?.analysis.constraints[0]
        ?.satisfied,
    ).toBe(false);
    expect(
      analyses[0]?.analysis.alternatives.some(
        (item) =>
          item.id === "raise-admission-cap",
      ),
    ).toBe(true);
  });
});
