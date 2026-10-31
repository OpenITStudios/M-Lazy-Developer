import { describe, expect, it } from "vitest";
import { parseMcFunction } from "../../../../analyzers/functions/src/index.js";
import { analyzeFunctionTopology } from "../../src/inspection/topology-analysis.js";

const source = {
  artifactId: "art",
  relativePath: "behavior_packs/demo/functions/arenas.mcfunction",
};

describe("integrated topology/state analysis", () => {
  it("flags broad state writes", () => {
    const fn = parseMcFunction(
      "arenas",
      "scoreboard players set @a active 1\ntag @e add running\n",
      source,
    );

    const result = analyzeFunctionTopology([fn]);

    expect(result.broadWrites).toBe(2);
    expect(result.stateDiagnostics).toHaveLength(2);
    expect(result.stateDiagnostics[0]?.code).toBe("CROSS_SCOPE_STATE_RISK");
  });

  it("detects a single outlier in a strongly repeated linear spatial pattern", () => {
    const fn = parseMcFunction(
      "arenas",
      [
        "fill 0 0 0 3 2 3 stone",
        "fill 100 0 0 103 2 3 stone",
        "fill 198 0 0 201 2 3 stone",
        "fill 300 0 0 303 2 3 stone",
        "fill 400 0 0 403 2 3 stone",
      ].join("\n"),
      source,
    );

    const result = analyzeFunctionTopology([fn]);

    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.linearOutliers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        axis: "x",
        expectedCoordinate: 200,
        actualCoordinate: 198,
      }),
    ]));
  });

  it("does not force a non-linear repeated layout into a linear outlier diagnostic", () => {
    const fn = parseMcFunction(
      "arenas",
      [
        "fill 0 0 0 3 2 3 stone",
        "fill 100 0 0 103 2 3 stone",
        "fill 100 0 100 103 2 103 stone",
        "fill 0 0 100 3 2 103 stone",
      ].join("\n"),
      source,
    );

    const result = analyzeFunctionTopology([fn]);
    expect(result.linearOutliers).toHaveLength(0);
  });
});
