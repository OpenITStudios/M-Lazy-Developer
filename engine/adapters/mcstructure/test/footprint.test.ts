import { describe, expect, it } from "vitest";
import {
  extractMcStructureFootprint,
  placeMcStructureFootprint,
} from "../src/footprint.js";
import type {
  McStructureModel,
} from "../src/types.js";
import { flatIndexToCoordinate } from "../src/indexing.js";

function structure(): McStructureModel {
  return {
    size: { x: 2, y: 1, z: 2 },
    palette: [{
      index: 0,
      name: "minecraft:stone",
      raw: {},
    }, {
      index: 1,
      name: "minecraft:air",
      raw: {},
    }, {
      index: 2,
      name: "minecraft:structure_void",
      raw: {},
    }],
    blockIndexLayers: [{
      layer: 0,
      indices: [0, 1, 2, -1],
    }],
    entities: [],
    rawSimplified: {},
    nbt: {} as McStructureModel["nbt"],
  };
}

describe("mcstructure footprint", () => {
  it("uses canonical Bedrock flat-index coordinates", () => {
    const result =
      extractMcStructureFootprint(
        structure(),
      );

    expect(result.cells).toEqual([
      expect.objectContaining({
        x: 0,
        y: 0,
        z: 0,
        mode: "replace",
      }),
      expect.objectContaining({
        x: 0,
        y: 0,
        z: 1,
        mode: "air",
      }),
      expect.objectContaining({
        x: 1,
        y: 0,
        z: 0,
        mode: "void",
      }),
    ]);
    expect(result.unknownPrimaryCells).toBe(1);
  });

  it("keeps unknown palette, sparse slots, duplicate palette entries and malformed-axis coordinates", () => {
    const base = structure();
    const sparse = new Array<number>(4);
    sparse[0] = 0;
    sparse[2] = 7;
    const result = extractMcStructureFootprint({
      ...base,
      palette: [
        { index: 0, name: "minecraft:stone", raw: {} },
        { index: 0, name: "minecraft:air", raw: {} },
      ],
      blockIndexLayers: [{ layer: 0, indices: sparse }],
    });
    expect(result).toEqual({
      cells: [{ x: 0, y: 0, z: 0, paletteIndex: 0,
        blockName: "minecraft:air", mode: "air" }],
      unknownPrimaryCells: 1,
    });
    // Even invalid volume-matching dimensions retain the old mathematical
    // coordinate projection, rather than inventing new normal Bedrock axes.
    const malformed = extractMcStructureFootprint({
      ...base,
      size: { x: -2, y: -1, z: 2 },
      blockIndexLayers: [{ layer: 0, indices: [0, 0, 0, 0] }],
    });
    expect(malformed.cells.map(cell => ({ x: cell.x, y: cell.y, z: cell.z })))
      .toEqual([0, 1, 2, 3].map(index =>
        flatIndexToCoordinate(index, { x: -2, y: -1, z: 2 })));
  });

  it("delegates rotation and mirror to the canonical placement transform", () => {
    const result =
      placeMcStructureFootprint(
        structure(),
        { x: 100, y: 50, z: 200 },
        {
          rotation: "90_degrees",
          mirror: "x",
        },
      );

    expect(result.cells[0]).toEqual(
      expect.objectContaining({
        x: 101,
        y: 50,
        z: 201,
      }),
    );
  });
});
