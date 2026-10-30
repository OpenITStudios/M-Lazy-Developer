import type { McStructureModel } from "./types.js";
import {
  extractStructureRuntimeContent,
  type StructureRuntimeContent,
} from "./runtime-content.js";

export interface McStructureSemantics {
  entityCount: number;
  hasEntities: boolean;
  paletteSize: number;
  hasBlockPositionData: boolean;
  commandBlockPaletteEntries: number;
  containerPaletteEntries: number;
  embeddedCommandBlocks: number;
  queuedTickPositions: number;
  educationAllowEntries: number;
  educationDenyEntries: number;
  educationBorderEntries: number;
}

const COMMAND_BLOCK_NAMES = new Set([
  "minecraft:command_block",
  "minecraft:chain_command_block",
  "minecraft:repeating_command_block",
]);

const CONTAINER_HINTS = [
  "chest",
  "barrel",
  "hopper",
  "dispenser",
  "dropper",
  "furnace",
  "shulker_box",
];

export function deriveMcStructureSemantics(
  structure: McStructureModel,
  runtime: StructureRuntimeContent = extractStructureRuntimeContent(structure),
): McStructureSemantics {
  let commandBlockPaletteEntries = 0;
  let containerPaletteEntries = 0;
  let educationAllowEntries = 0;
  let educationDenyEntries = 0;
  let educationBorderEntries = 0;

  for (const entry of structure.palette) {
    const name = entry.name ?? "";
    if (COMMAND_BLOCK_NAMES.has(name)) commandBlockPaletteEntries += 1;
    if (CONTAINER_HINTS.some((hint) => name.includes(hint))) {
      containerPaletteEntries += 1;
    }
    if (name === "minecraft:allow") educationAllowEntries += 1;
    if (name === "minecraft:deny") educationDenyEntries += 1;
    if (name === "minecraft:border_block") educationBorderEntries += 1;
  }

  return {
    entityCount: structure.entities.length,
    hasEntities: structure.entities.length > 0,
    paletteSize: structure.palette.length,
    hasBlockPositionData: structure.blockPositionData !== undefined,
    commandBlockPaletteEntries,
    containerPaletteEntries,
    embeddedCommandBlocks: runtime.commandBlocks.length,
    queuedTickPositions: runtime.queuedTickPositions,
    educationAllowEntries,
    educationDenyEntries,
    educationBorderEntries,
  };
}
