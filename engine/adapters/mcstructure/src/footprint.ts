import {
  flatIndexToCoordinate,
  validateStructureLayerLengths,
} from "./indexing.js";
import {
  placedWorldCoordinate,
  type StructurePlacementTransform,
} from "./placement-transform.js";
import type {
  McStructureModel,
  StructureCoordinate,
  StructurePaletteEntry,
  StructureSize,
} from "./types.js";

/** Lossless normalized inputs needed to derive a complete per-block footprint.
 * Index layers may use compact typed arrays without changing cell semantics.
 * This is a read-only source projection, not a substitute for NBT authority.
 */
export interface McStructureFootprintSource {
  readonly size?: StructureSize;
  readonly palette: readonly (Pick<StructurePaletteEntry, "index" | "name"> &
    Partial<Pick<StructurePaletteEntry, "raw" | "states">>)[];
  readonly blockIndexLayers: readonly {
    readonly layer: number;
    readonly indices: ArrayLike<number>;
  }[];
}

/** Preserve all palette IDs and primary-layer values without retaining millions
 * of eager `{x,y,z,mode}` objects for structures never loaded by commands.
 * Out-of-int32 values fall back to float64 instead of silently wrapping.
 */
export function compactMcStructureFootprintSource(structure: McStructureModel): McStructureFootprintSource {
  return {
    ...(structure.size === undefined ? {} : { size: structure.size }),
    palette: structure.palette.map(entry => ({
      index: entry.index,
      ...(entry.name === undefined ? {} : { name: entry.name }),
    })),
    blockIndexLayers: structure.blockIndexLayers.map(layer => {
      const indices = layer.indices;
      const int32 = indices.every(value =>
        Number.isInteger(value) && value >= -2147483648 && value <= 2147483647);
      return {
        layer: layer.layer,
        indices: int32 ? Int32Array.from(indices) : Float64Array.from(indices),
      };
    }),
  };
}

export type McStructureFootprintMode =
  | "replace"
  | "air"
  | "void";

export interface McStructureFootprintCell
  extends StructureCoordinate {
  mode: McStructureFootprintMode;
  paletteIndex: number;
  blockName: string;
}

export interface McStructureFootprint {
  cells: readonly McStructureFootprintCell[];
  unknownPrimaryCells: number;
}

export interface PlacedMcStructureFootprint
  extends McStructureFootprint {
  origin: StructureCoordinate;
  transform: StructurePlacementTransform;
}

export function extractMcStructureFootprint(
  structure: McStructureFootprintSource,
): McStructureFootprint {
  if (!structure.size) {
    throw new Error(
      "mcstructure footprint requires declared structure size.",
    );
  }

  const validation =
    validateStructureLayerLengths(structure);
  if (!validation.ok) {
    throw new Error(
      "mcstructure footprint requires valid block index layer lengths.",
    );
  }

  const primary =
    structure.blockIndexLayers.find(
      (layer) => layer.layer === 0,
    );
  if (!primary) {
    return {
      cells: [],
      unknownPrimaryCells: 0,
    };
  }

  // One flattened cell per primary-layer index may require 100k+ objects.
  // Cache palette resolution and advance the declared z/y/x layout without
  // recomputing size and dividing for every occupied position. The length
  // gate above guarantees every index has a valid structure coordinate.
  const palette = new Map<number, { blockName?: string; mode: McStructureFootprintMode }>();
  for (const entry of structure.palette) {
    const blockName = entry.name;
    palette.set(entry.index, {
      ...(blockName === undefined ? {} : { blockName }),
      mode: blockName === "minecraft:structure_void" ? "void"
        : blockName === "minecraft:air" ? "air" : "replace",
    });
  }
  const cells: McStructureFootprintCell[] = [];
  let unknownPrimaryCells = 0;
  const size = structure.size;
  // Preserve the historical coordinate conversion for malformed but
  // volume-matching dimensions; genuine Bedrock sizes use the fast path.
  const canonicalAxes = [size.x, size.y, size.z].every(value =>
    Number.isSafeInteger(value) && value > 0);
  let x = 0;
  let y = 0;
  let z = 0;

  for (let flatIndex = 0; flatIndex < primary.indices.length; flatIndex += 1) {
    // Array.forEach in the original function skipped sparse slots. They are
    // malformed input but cannot silently acquire new evidence cells here.
    if (flatIndex in primary.indices) {
      const paletteIndex = primary.indices[flatIndex]!;
      if (paletteIndex < 0) {
        unknownPrimaryCells += 1;
      } else {
        const entry = palette.get(paletteIndex);
        if (!entry?.blockName) {
          unknownPrimaryCells += 1;
        } else if (canonicalAxes) {
          cells.push({
            x, y, z,
            paletteIndex,
            blockName: entry.blockName,
            mode: entry.mode,
          });
        } else {
          const coordinate = flatIndexToCoordinate(flatIndex, size);
          if (!coordinate) unknownPrimaryCells += 1;
          else cells.push({
            ...coordinate,
            paletteIndex,
            blockName: entry.blockName,
            mode: entry.mode,
          });
        }
      }
    }
    z += 1;
    if (z === size.z) {
      z = 0;
      y += 1;
      if (y === size.y) {
        y = 0;
        x += 1;
      }
    }
  }

  return {
    cells,
    unknownPrimaryCells,
  };
}

export function placeMcStructureFootprint(
  structure: McStructureModel,
  origin: StructureCoordinate,
  transform: StructurePlacementTransform = {},
): PlacedMcStructureFootprint {
  if (!structure.size) {
    throw new Error(
      "mcstructure placement requires declared structure size.",
    );
  }

  const local =
    extractMcStructureFootprint(structure);

  return {
    origin,
    transform,
    unknownPrimaryCells:
      local.unknownPrimaryCells,
    cells: local.cells.map((cell) => ({
      ...placedWorldCoordinate(
        cell,
        structure.size!,
        origin,
        transform,
      ),
      mode: cell.mode,
      paletteIndex: cell.paletteIndex,
      blockName: cell.blockName,
    })),
  };
}
