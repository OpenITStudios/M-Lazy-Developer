// Source-only co-location: all original test statements retained in isolated lexical scopes.
import { describe, expect, it } from "vitest";
import { parseMcFunction } from "../../../analyzers/functions/src/index.js";
import { analyzeStructureAndChunkRuntime } from "../src/inspection/structure-runtime-analysis.js";
import type { ParsedStructureSummary } from "../src/inspection/structure-runtime-analysis.js";
import type { McStructureSemantics } from "../../../adapters/mcstructure/src/index.js";

// Original engine/packages/orchestrator/test/structure-correlation.test.ts 732dce104f4038cc4d13e28adc33b0e0b6ef146f
{
describe("structure load correlation", () => {
  it("correlates load intent with actual structure content", () => {
    const fn = parseMcFunction(
      "demo/start",
      "structure load demo:arena 0 64 0 0_degrees none none 0 false true false 70 seed",
      { artifactId: "fixture", relativePath: "functions/start.mcfunction" },
    );

    const result = analyzeStructureAndChunkRuntime([fn], [{
      identifier: "demo:arena",
      relativePath: "structures/demo/arena.mcstructure",
      semantics: {
        entityCount: 2,
        hasEntities: true,
        paletteSize: 5,
        hasBlockPositionData: true,
        commandBlockPaletteEntries: 1,
        containerPaletteEntries: 1,
        embeddedCommandBlocks: 1,
        queuedTickPositions: 0,
        educationAllowEntries: 0,
        educationDenyEntries: 0,
        educationBorderEntries: 0,
      },
    }]);

    expect(result.correlations[0]).toMatchObject({
      status: "resolved",
      findings: expect.arrayContaining([
        "entities-excluded",
        "probabilistic-command-block-load",
        "runtime-logic-content",
      ]),
    });
  });
});
}

// Original engine/packages/orchestrator/test/structure-runtime-analysis.test.ts b80578a225c9ce448be1c4b85574032b7b5695e7
{
function semantics(
  paletteSize: number,
): McStructureSemantics {
  return {
    entityCount: 0,
    hasEntities: false,
    paletteSize,
    hasBlockPositionData: false,
    commandBlockPaletteEntries: 0,
    containerPaletteEntries: 0,
    embeddedCommandBlocks: 0,
    queuedTickPositions: 0,
    educationAllowEntries: 0,
    educationDenyEntries: 0,
    educationBorderEntries: 0,
  };
}

function structure(
  identifier: string,
  cells: ParsedStructureSummary["footprint"] extends infer T
    ? T
    : never,
): ParsedStructureSummary {
  return {
    identifier,
    relativePath:
      "structures/" +
      identifier.replace(":", "/") +
      ".mcstructure",
    size: {
      x: 2,
      y: 1,
      z: 1,
    },
    semantics: semantics(3),
    ...(cells === undefined
      ? {}
      : { footprint: cells }),
  };
}

describe("structure and chunk runtime analysis", () => {
  it("summarizes structure load and ticking-area semantics", () => {
    const fn = parseMcFunction(
      "demo/start",
      [
        "structure load demo:arena 0 64 0 0_degrees none true true false 80 seed",
        "tickingarea add circle 0 64 0 2 arena_logic true",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath:
          "functions/start.mcfunction",
      },
    );

    const result =
      analyzeStructureAndChunkRuntime(
        [fn],
      );
    expect(
      result.probabilisticStructureLoads,
    ).toBe(1);
    expect(
      result.preloadedTickingAreas,
    ).toBe(1);
  });

  it("records structure_void preservation as residue evidence between deterministic placements", () => {
    const fn = parseMcFunction(
      "demo/transition",
      [
        "structure load demo:first 0 64 0 0_degrees none true true false 100 seed",
        "structure load demo:second 0 64 0 0_degrees none true true false 100 seed",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath:
          "functions/transition.mcfunction",
      },
    );

    const first = structure(
      "demo:first",
      {
        unknownPrimaryCells: 0,
        cells: [
          {
            x: 0,
            y: 0,
            z: 0,
            mode: "replace",
            paletteIndex: 0,
            blockName:
              "minecraft:stone",
          },
          {
            x: 1,
            y: 0,
            z: 0,
            mode: "replace",
            paletteIndex: 0,
            blockName:
              "minecraft:stone",
          },
        ],
      },
    );

    const second = structure(
      "demo:second",
      {
        unknownPrimaryCells: 0,
        cells: [
          {
            x: 0,
            y: 0,
            z: 0,
            mode: "void",
            paletteIndex: 1,
            blockName:
              "minecraft:structure_void",
          },
          {
            x: 1,
            y: 0,
            z: 0,
            mode: "air",
            paletteIndex: 2,
            blockName:
              "minecraft:air",
          },
        ],
      },
    );

    const result =
      analyzeStructureAndChunkRuntime(
        [fn],
        [first, second],
      );

    expect(
      result.structureTransitionResidue,
    ).toHaveLength(1);
    expect(
      result.structureTransitionResidue[0],
    ).toMatchObject({
      status: "analyzed",
      previousTarget: "demo:first",
      nextTarget: "demo:second",
      preservedByVoid: 1,
      explicitlyCleared: 1,
      replaced: 0,
    });
    expect(
      result.structureTransitionResidue[0]
        ?.reasons.join(" "),
    ).toMatch(
      /residue evidence, not a defect conclusion/i,
    );
  });
});
}
