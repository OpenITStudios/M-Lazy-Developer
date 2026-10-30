import { describe, expect, it } from "vitest";
import { parseMcFunction } from "../../../../analyzers/functions/src/index.js";
import { analyzeStructureAndChunkRuntime } from "../../src/structure-runtime-analysis.js";
import { derivePlacementProofs } from "../../src/inspection/structure-proof-analysis.js";
import { assessStructureTransitionResidue } from "../../src/inspection/structure-transition-residue.js";
import type { McStructureModel } from "../../../../adapters/mcstructure/src/types.js";

const structure = {
  identifier: "demo:arena",
  relativePath: "structures/demo/arena.mcstructure",
  size: { x: 16, y: 8, z: 32 },
  semantics: {
    entityCount: 0,
    hasEntities: false,
    paletteSize: 1,
    hasBlockPositionData: false,
    commandBlockPaletteEntries: 0,
    containerPaletteEntries: 0,
    embeddedCommandBlocks: 0,
    queuedTickPositions: 0,
    educationAllowEntries: 0,
    educationDenyEntries: 0,
    educationBorderEntries: 0,
  },
};

describe("structure placement proofs", () => {
  it("accepts a gated sentinel inside rotated placement bounds", () => {
    const fn = parseMcFunction(
      "demo:load",
      [
        "structure load demo:arena 100 64 200 90_degrees",
        "execute if block 100 64 200 minecraft:gold_block run function demo:start",
      ].join("\n"),
      { artifactId: "a", relativePath: "functions/load.mcfunction" },
    );

    const runtime = analyzeStructureAndChunkRuntime([fn], [structure]);
    const proofs = derivePlacementProofs(runtime, [fn]);

    expect(proofs.postPlacementVerifications).toHaveLength(1);
    expect(proofs.postPlacementVerifications[0]?.verificationLine).toBe(2);
  });

  it("does not accept an ungated sentinel as readiness proof", () => {
    const fn = parseMcFunction(
      "demo:load",
      [
        "structure load demo:arena 100 64 200",
        "testforblock 101 64 201 minecraft:gold_block",
      ].join("\n"),
      { artifactId: "a", relativePath: "functions/load.mcfunction" },
    );

    const runtime = analyzeStructureAndChunkRuntime([fn], [structure]);
    const proofs = derivePlacementProofs(runtime, [fn]);

    expect(proofs.postPlacementVerifications).toEqual([]);
  });

  it("proves area-loaded coverage only when the scheduled area covers all placement chunks", () => {
    const scheduler = parseMcFunction(
      "demo:schedule",
      "schedule on_area_loaded add 96 0 192 143 255 239 demo:load",
      { artifactId: "a", relativePath: "functions/schedule.mcfunction" },
    );
    const loader = parseMcFunction(
      "demo:load",
      "structure load demo:arena 100 64 200",
      { artifactId: "a", relativePath: "functions/load.mcfunction" },
    );

    const runtime = analyzeStructureAndChunkRuntime([scheduler, loader], [structure]);
    const proofs = derivePlacementProofs(runtime, [scheduler, loader]);

    expect(proofs.areaLoadedCoverage).toHaveLength(1);
    expect(proofs.areaLoadedCoverage[0]?.functionId).toBe("demo:load");
  });
});

// Verify the same canonical X→Y→Z flat-index contract used for
// embedded command blocks and footprint projection, not another axis order.
describe("structure transition residue sampling", () => {
  it("locates structure_void cells at canonical non-cubic coordinates", () => {
    const indices = Array.from({ length: 12 }, () => -1);
    for (const flatIndex of [1, 3, 6]) indices[flatIndex] = 0;
    const source = {
      size: { x: 2, y: 2, z: 3 },
      palette: [{ index: 0, name: "minecraft:structure_void", raw: {} }],
      blockIndexLayers: [{ layer: 0, indices }],
      entities: [],
      rawSimplified: {},
      nbt: {} as McStructureModel["nbt"],
    } satisfies McStructureModel;

    const result = assessStructureTransitionResidue(source);
    expect(result.status).toBe("residue-risk");
    expect(result.voidCellCount).toBe(3);
    expect(result.samples).toEqual([
      { x: 0, y: 0, z: 1, layer: 0 },
      { x: 0, y: 1, z: 0, layer: 0 },
      { x: 1, y: 0, z: 0, layer: 0 },
    ]);
  });
});
