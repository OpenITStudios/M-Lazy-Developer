import { describe, expect, it } from "vitest";
import { extractStructureRuntimeContent } from "../src/runtime-content.js";
import { deriveMcStructureSemantics } from "../src/semantics.js";
import type { McStructureModel } from "../src/types.js";

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
