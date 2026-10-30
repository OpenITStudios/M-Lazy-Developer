// Cohesive source test suite consolidation; original describe/it and assertions retained.
import { describe } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { analyzeCommandBlockChains } from "../src/command-chain.js";
import { analyzeCommandBlockRuntime } from "../src/command-chain.js";
import { extractMcStructureFootprint } from "../src/footprint.js";
import { compactMcStructureFootprintSource } from "../src/footprint.js";
import { placeMcStructureFootprint } from "../src/footprint.js";
import { type McStructureModel } from "../src/types.js";
import { flatIndexToCoordinate } from "../src/indexing.js";
import { normalizeMcStructure } from "../src/normalize.js";
import { type ParsedNbtDocument } from "../../nbt/src/index.js";
import { validateStructureLayerLengths } from "../src/indexing.js";
import { placedWorldCoordinate } from "../src/placement-transform.js";
import { transformStructureCoordinate } from "../src/placement-transform.js";
import { extractStructureRuntimeContent } from "../src/runtime-content.js";
import { deriveMcStructureSemantics } from "../src/semantics.js";

// Original suite engine/adapters/mcstructure/test/command-chain.test.ts, blob 269801574414f9dff9a3f4b155ddeabe2301e3fe
{
describe("command block chain topology", () => {
  it("connects command blocks according to facing direction", () => {
    const result = analyzeCommandBlockChains([
      {
        flatIndex: 0,
        coordinate: { x: 0, y: 0, z: 0 },
        paletteName: "minecraft:repeating_command_block",
        command: "say start",
        facingDirection: 5,
      },
      {
        flatIndex: 1,
        coordinate: { x: 1, y: 0, z: 0 },
        paletteName: "minecraft:chain_command_block",
        command: "say next",
        facingDirection: 5,
        conditional: true,
      },
    ]);

    expect(result.edges).toEqual([{ fromFlatIndex: 0, toFlatIndex: 1 }]);
    expect(result.issues).toEqual([]);
  });

  it("flags conditional chain blocks without an incoming predecessor", () => {
    const result = analyzeCommandBlockChains([{
      flatIndex: 4,
      coordinate: { x: 3, y: 0, z: 0 },
      paletteName: "minecraft:chain_command_block",
      command: "say orphan",
      facingDirection: 5,
      conditional: true,
    }]);

    expect(result.issues).toEqual([
      { kind: "conditional-without-predecessor", flatIndex: 4 },
    ]);
  });
});
}

// Original suite engine/adapters/mcstructure/test/footprint.test.ts, blob 991876c597a4e0fe252fce636c79257670634740
{
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

  it("packs immutable source inputs without losing any canonical footprint cells", () => {
    const input = structure();
    const expected = extractMcStructureFootprint(input);
    const packed = compactMcStructureFootprintSource(input);
    expect(packed.blockIndexLayers[0]?.indices).toBeInstanceOf(Int32Array);
    expect(extractMcStructureFootprint(structuredClone(packed))).toEqual(expected);
    // The source-index reuse snapshot cannot depend on later parser mutation.
    input.blockIndexLayers[0] = { layer: 0, indices: [2, 2, 2, 2] };
    input.palette[0]!.name = "minecraft:gold_block";
    expect(extractMcStructureFootprint(packed)).toEqual(expected);
  });

  it("keeps out-of-int32 palette indices exact rather than wrapping them", () => {
    const input: McStructureModel = {
      ...structure(),
      palette: [{ index: 2147483648, name: "minecraft:stone", raw: {} }],
      blockIndexLayers: [{ layer: 0, indices: [2147483648, -1, -1, -1] }],
    };
    const packed = compactMcStructureFootprintSource(input);
    expect(packed.blockIndexLayers[0]?.indices).toBeInstanceOf(Float64Array);
    expect(extractMcStructureFootprint(packed)).toEqual(extractMcStructureFootprint(input));
  });
});
}

// Original suite engine/adapters/mcstructure/test/indexing.test.ts, blob 0439e4b55a712a937bca178a06c885ee8b0d171a
{
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
}

// Original suite engine/adapters/mcstructure/test/placement-transform.test.ts, blob a68bafd2340419c054a2d4b8c4e58d2d25c0de6d
{
describe("structure placement transform", () => {
  it("rotates local coordinates around the structure origin", () => {
    expect(transformStructureCoordinate(
      { x: 1, y: 0, z: 0 },
      { x: 3, y: 1, z: 2 },
      { rotation: "90_degrees", mirror: "none" },
    )).toEqual({ x: 1, y: 0, z: 1 });
  });

  it("maps transformed local coordinates into world coordinates", () => {
    expect(placedWorldCoordinate(
      { x: 0, y: 2, z: 1 },
      { x: 2, y: 4, z: 3 },
      { x: 100, y: 64, z: -20 },
      { rotation: "0_degrees", mirror: "x" },
    )).toEqual({ x: 101, y: 66, z: -19 });
  });
});
}

// Original suite engine/adapters/mcstructure/test/runtime-content.test.ts, blob e7ce5bb726006a9df8d5d4f3e78fa8ff4c3fe26f
{
describe("mcstructure runtime content", () => {
  it("extracts command block data only from command-block entries", () => {
    const structure = {
      size: { x: 2, y: 1, z: 1 },
      palette: [
        { index: 0, name: "minecraft:command_block", raw: {} },
        { index: 1, name: "minecraft:stone", raw: {} },
      ],
      blockIndexLayers: [{ layer: 0, indices: [0, 1] }],
      entities: [],
      blockPositionData: {
        "0": {
          block_entity_data: {
            id: "CommandBlock",
            Command: "say hello",
            auto: 1,
            TickDelay: 4,
            TrackOutput: 0,
          },
          tick_queue_data: [{ tick_delay: 1 }],
        },
        "1": {
          block_entity_data: {
            Command: "say should-not-be-extracted",
          },
        },
      },
      rawSimplified: {},
      nbt: {
        format: "little",
        typed: {} as McStructureModel["nbt"]["typed"],
        simplified: {},
        originalBytes: new Uint8Array(),
        dirty: false,
      },
    } satisfies McStructureModel;

    const result = extractStructureRuntimeContent(structure);

    expect(result.commandBlocks).toEqual([
      expect.objectContaining({
        flatIndex: 0,
        coordinate: { x: 0, y: 0, z: 0 },
        command: "say hello",
        auto: true,
        tickDelay: 4,
        trackOutput: false,
      }),
    ]);
    expect(result.queuedTickPositions).toBe(1);
    // Source indexing passes the already-extracted runtime view to semantics;
    // other callers retain the standalone extraction default.
    expect(deriveMcStructureSemantics(structure, result))
      .toEqual(deriveMcStructureSemantics(structure));
    expect(deriveMcStructureSemantics(structure, {
      ...result, queuedTickPositions: 3,
    }).queuedTickPositions).toBe(3);
  });

  it("extracts item stacks from structure block-entity containers", () => {
    const structure = {
      size: { x: 1, y: 1, z: 1 },
      palette: [
        { index: 0, name: "minecraft:barrel", raw: {} },
      ],
      blockIndexLayers: [{ layer: 0, indices: [0] }],
      entities: [],
      blockPositionData: {
        "0": {
          block_entity_data: {
            id: "Barrel",
            Items: [
              { Name: "minecraft:oak_planks", Count: 16 },
              { Name: "minecraft:apple", Count: 2 },
            ],
          },
        },
      },
      rawSimplified: {},
      nbt: {
        format: "little",
        typed: {} as McStructureModel["nbt"]["typed"],
        simplified: {},
        originalBytes: new Uint8Array(),
        dirty: false,
      },
    } satisfies McStructureModel;

    const result = extractStructureRuntimeContent(structure);

    expect(result.containerItems).toEqual([
      expect.objectContaining({
        flatIndex: 0,
        coordinate: { x: 0, y: 0, z: 0 },
        blockEntityId: "Barrel",
        itemId: "minecraft:apple",
        count: 2,
      }),
      expect.objectContaining({
        flatIndex: 0,
        coordinate: { x: 0, y: 0, z: 0 },
        blockEntityId: "Barrel",
        itemId: "minecraft:oak_planks",
        count: 16,
      }),
    ]);
  });
});
}
