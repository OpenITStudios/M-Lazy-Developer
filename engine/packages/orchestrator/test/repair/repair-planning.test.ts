import { describe, expect, it } from "vitest";
import { parseMcFunction } from "../../../../analyzers/functions/src/index.js";
import { analyzeFunctionTopology } from "../../src/inspection/topology-analysis.js";
import { planInspectionRepairs } from "../../src/repair/repair-planning.js";

const source = {
  artifactId: "art",
  relativePath: "behavior_packs/demo/functions/arenas.mcfunction",
};

function topologyFor(lines: string[]) {
  return analyzeFunctionTopology([
    parseMcFunction("arenas", lines.join("\n"), source),
  ]);
}

describe("orchestrated repair planning", () => {
  it("returns a repair proposal without creating a transaction during inspection", () => {
    const topology = topologyFor([
      "fill 0 0 0 3 2 3 stone",
      "fill 100 0 0 103 2 3 stone",
      "fill 198 0 0 201 2 3 stone",
      "fill 300 0 0 303 2 3 stone",
      "fill 400 0 0 403 2 3 stone",
    ]);

    const plans = planInspectionRepairs(topology, "artifact-sha");

    expect(plans).toEqual(expect.arrayContaining([
      expect.objectContaining({
        status: "proposal",
        sourcePath: source.relativePath,
        proposal: expect.objectContaining({
          sourceFingerprint: "artifact-sha",
        }),
      }),
    ]));
  });

  it("keeps directory-only analysis non-mutating when no fingerprint exists", () => {
    const topology = topologyFor([
      "fill 0 0 0 3 2 3 stone",
      "fill 100 0 0 103 2 3 stone",
      "fill 198 0 0 201 2 3 stone",
      "fill 300 0 0 303 2 3 stone",
      "fill 400 0 0 403 2 3 stone",
    ]);

    expect(planInspectionRepairs(topology)[0]).toMatchObject({
      status: "unavailable",
    });
  });

  it("does not plan a replacement that would discard an execute wrapper", () => {
    const topology = topologyFor([
      "execute as @s run fill 0 0 0 3 2 3 stone",
      "execute as @s run fill 100 0 0 103 2 3 stone",
      "execute as @s run fill 198 0 0 201 2 3 stone",
      "execute as @s run fill 300 0 0 303 2 3 stone",
      "execute as @s run fill 400 0 0 403 2 3 stone",
    ]);

    expect(planInspectionRepairs(topology, "artifact-sha")[0]).toMatchObject({
      status: "unsupported",
    });
  });
});
