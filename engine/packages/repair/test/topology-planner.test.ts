import { describe, expect, it } from "vitest";
import { planLinearTopologyRepair } from "../src/topology-planner.js";

const source = {
  artifactId: "fixture",
  relativePath: "functions/arena.mcfunction",
  range: { lineStart: 3, lineEnd: 3 },
};

describe("linear topology repair planner", () => {
  it("plans a fill translation while preserving region shape", () => {
    const result = planLinearTopologyRepair({
      effect: {
        kind: "fill",
        region: {
          from: { x: { mode: "absolute", value: 198 }, y: { mode: "absolute", value: 0 }, z: { mode: "absolute", value: 0 } },
          to: { x: { mode: "absolute", value: 201 }, y: { mode: "absolute", value: 2 }, z: { mode: "absolute", value: 3 } },
        },
        block: "stone",
        source,
      },
      rawCommand: "fill 198 0 0 201 2 3 stone",
      outlier: { axis: "x", expectedCoordinate: 200, actualCoordinate: 198 },
    }, "source-sha");

    expect(result.status).toBe("proposed");
    if (result.status !== "proposed") return;
    expect(result.proposal.operation).toMatchObject({
      expected: "fill 198 0 0 201 2 3 stone",
      replacement: "fill 200 0 0 203 2 3 stone",
    });
  });

  it("rejects relative-coordinate repair", () => {
    const result = planLinearTopologyRepair({
      effect: {
        kind: "fill",
        region: {
          from: { x: { mode: "relative", value: 198 }, y: { mode: "relative", value: 0 }, z: { mode: "relative", value: 0 } },
          to: { x: { mode: "relative", value: 201 }, y: { mode: "relative", value: 2 }, z: { mode: "relative", value: 3 } },
        },
        block: "stone",
        source,
      },
      rawCommand: "fill ~198 ~ ~ ~201 ~2 ~3 stone",
      outlier: { axis: "x", expectedCoordinate: 200, actualCoordinate: 198 },
    }, "source-sha");
    expect(result.status).toBe("unsupported");
  });
});
