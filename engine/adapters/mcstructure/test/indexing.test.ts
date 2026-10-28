import { normalizeMcStructure } from "../src/normalize.js";
import type { ParsedNbtDocument } from "../../nbt/src/index.js";
import { describe, expect, it } from "vitest";
import { flatIndexToCoordinate, validateStructureLayerLengths } from "../src/indexing.js";
import type { McStructureModel } from "../src/types.js";

describe("mcstructure indexing", () => {
  it("maps flat indices using X→Y→Z structure dimensions", () => {
    expect(flatIndexToCoordinate(0, { x: 2, y: 2, z: 2 })).toEqual({ x: 0, y: 0, z: 0 });
    expect(flatIndexToCoordinate(1, { x: 2, y: 2, z: 2 })).toEqual({ x: 0, y: 0, z: 1 });
    expect(flatIndexToCoordinate(4, { x: 2, y: 2, z: 2 })).toEqual({ x: 1, y: 0, z: 0 });
  });

  it("checks every block index layer against structure volume", () => {
    const structure = {
      size: { x: 2, y: 1, z: 2 },
      palette: [],
      blockIndexLayers: [
        { layer: 0, indices: [0, 0, 0, 0] },
        { layer: 1, indices: [-1, -1] },
      ],
      entities: [],
      rawSimplified: {},
      nbt: {} as McStructureModel["nbt"],
    } satisfies McStructureModel;

    expect(validateStructureLayerLengths(structure)).toEqual({
      ok: false,
      expected: 4,
      invalidLayers: [1],
    });
  });
});

describe("read-only structure index normalization", () => {
  it("shares only when explicitly requested and leaves the default independent", () => {
    const simplified = { structure: { block_indices: [[1, 0, -1], [0, 1, 1]] } };
    const nbt = { simplified } as ParsedNbtDocument;
    const owned = normalizeMcStructure(nbt);
    const readOnly = normalizeMcStructure(nbt, "example.mcstructure", {
      readOnlySharedBlockIndices: true,
    });
    expect(readOnly.blockIndexLayers).toEqual(owned.blockIndexLayers);
    expect(readOnly.blockIndexLayers[0]?.indices).toBe(simplified.structure.block_indices[0]);
    expect(owned.blockIndexLayers[0]?.indices).not.toBe(simplified.structure.block_indices[0]);
    simplified.structure.block_indices[0]![0] = 2;
    expect(owned.blockIndexLayers[0]?.indices[0]).toBe(1);
  });

  it("rejects sparse and malformed layers exactly like owned normalization", () => {
    const sparse = [0, , 2] as number[];
    const values = { structure: { block_indices: [sparse, [0, 1, 0], [0, 2.5], "bad", [0, NaN]] } };
    const nbt = { simplified: values } as ParsedNbtDocument;
    const owned = normalizeMcStructure(nbt);
    const shared = normalizeMcStructure(nbt, undefined, { readOnlySharedBlockIndices: true });
    expect(shared.blockIndexLayers).toEqual(owned.blockIndexLayers);
    expect(shared.blockIndexLayers.map(layer => layer.layer)).toEqual([1]);
  });
});
