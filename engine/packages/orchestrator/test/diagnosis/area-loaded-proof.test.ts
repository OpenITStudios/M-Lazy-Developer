import { describe, expect, it } from "vitest";
import { parseMcFunction } from "../../../../analyzers/functions/src/index.js";
import { analyzeStructureAndChunkRuntime } from "../../src/inspection/structure-runtime-analysis.js";
import { areaLoadedBlockWriteEvidence } from "../../src/diagnosis/area-loaded-proof.js";

describe("area-loaded block-write proof", () => {
  it("proves a fill when the scheduled rectangle covers every mutated chunk", () => {
    const scheduler = parseMcFunction(
      "demo:schedule",
      "schedule on_area_loaded add 0 0 0 31 255 31 demo:mutate",
      { artifactId: "a", relativePath: "functions/schedule.mcfunction" },
    );
    const mutate = parseMcFunction(
      "demo:mutate",
      "fill 0 64 0 31 65 31 minecraft:stone",
      { artifactId: "a", relativePath: "functions/mutate.mcfunction" },
    );

    const runtime = analyzeStructureAndChunkRuntime([scheduler, mutate]);
    const records = areaLoadedBlockWriteEvidence(runtime, [scheduler, mutate]);

    expect(records).toEqual(expect.arrayContaining([
      expect.objectContaining({
        predicate: "loaded-target-chunk",
        state: "present",
        scope: {
          operationId: "a:functions/mutate.mcfunction:1",
        },
      }),
    ]));
  });

  it("does not prove coverage when the scheduled area misses mutated chunks", () => {
    const scheduler = parseMcFunction(
      "demo:schedule",
      "schedule on_area_loaded add 0 0 0 15 255 15 demo:mutate",
      { artifactId: "a", relativePath: "functions/schedule.mcfunction" },
    );
    const mutate = parseMcFunction(
      "demo:mutate",
      "fill 0 64 0 31 65 31 minecraft:stone",
      { artifactId: "a", relativePath: "functions/mutate.mcfunction" },
    );

    const runtime = analyzeStructureAndChunkRuntime([scheduler, mutate]);
    const records = areaLoadedBlockWriteEvidence(runtime, [scheduler, mutate]);

    expect(records.some((record) => record.predicate === "loaded-target-chunk")).toBe(false);
  });
});
