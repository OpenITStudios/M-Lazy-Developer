import type {
  McStructureModel,
  StructureBlockIndexLayer,
  StructurePaletteEntry,
  StructureSize,
} from "./types.js";
import type { ParsedNbtDocument } from "../../nbt/src/index.js";
import type { WorldPosition } from "../../../packages/common/src/index.js";

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function int3(value: unknown): [number, number, number] | undefined {
  if (!Array.isArray(value) || value.length < 3) return undefined;
  const [a, b, c] = value;
  if (![a, b, c].every((item) => Number.isInteger(item))) return undefined;
  return [Number(a), Number(b), Number(c)];
}

function normalizeSize(value: unknown): StructureSize | undefined {
  const tuple = int3(value);
  return tuple ? { x: tuple[0], y: tuple[1], z: tuple[2] } : undefined;
}

function normalizeOrigin(value: unknown): WorldPosition | undefined {
  const tuple = int3(value);
  return tuple ? { x: tuple[0], y: tuple[1], z: tuple[2] } : undefined;
}

function normalizePalette(root: Record<string, unknown>): StructurePaletteEntry[] {
  const structure = record(root.structure);
  const paletteRoot = record(structure?.palette);
  const defaultPalette = record(paletteRoot?.default);
  const blockPalette = Array.isArray(defaultPalette?.block_palette)
    ? defaultPalette.block_palette
    : [];

  return blockPalette.map((entry, index) => {
    const item = record(entry);
    const states = record(item?.states);
    const result: StructurePaletteEntry = { index, raw: entry };
    if (typeof item?.name === "string") result.name = item.name;
    if (states) result.states = states;
    return result;
  });
}

/** The default normalization owns its independent block-index arrays.
 * Read-only source indexing may share the already-parsed simplified NBT
 * arrays until it has constructed its own compact, immutable projection.
 * Do not use that mode for mutations, round-trips, or retained models.
 */
export interface McStructureNormalizeOptions {
  readonly readOnlySharedBlockIndices?: boolean;
}

function normalizeBlockIndices(
  root: Record<string, unknown>,
  options: McStructureNormalizeOptions = {},
): StructureBlockIndexLayer[] {
  const structure = record(root.structure);
  const value = structure?.block_indices;
  if (!Array.isArray(value)) return [];

  const layers: StructureBlockIndexLayer[] = [];
  value.forEach((layer, index) => {
    if (!Array.isArray(layer)) return;
    if (options.readOnlySharedBlockIndices) {
      // Avoid allocating a second large JS number array for each source-only
      // .mcstructure. Checking each index explicitly also rejects sparse
      // arrays, exactly as the original filter+length gate did.
      for (let position = 0; position < layer.length; position += 1) {
        if (!Number.isInteger(layer[position])) return;
      }
      layers.push({ layer: index, indices: layer });
      return;
    }
    const numbers = layer.filter((entry): entry is number => Number.isInteger(entry));
    if (numbers.length !== layer.length) return;
    layers.push({ layer: index, indices: numbers });
  });
  return layers;
}

export function normalizeMcStructure(
  nbt: ParsedNbtDocument,
  sourceName?: string,
  options: McStructureNormalizeOptions = {},
): McStructureModel {
  const root = record(nbt.simplified) ?? {};
  const structure = record(root.structure);
  const paletteRoot = record(structure?.palette);
  const defaultPalette = record(paletteRoot?.default);

  const result: McStructureModel = {
    palette: normalizePalette(root),
    blockIndexLayers: normalizeBlockIndices(root, options),
    entities: Array.isArray(structure?.entities) ? structure.entities : [],
    rawSimplified: nbt.simplified,
    nbt,
  };

  if (sourceName) result.sourceName = sourceName;
  if (Number.isInteger(root.format_version)) result.formatVersion = Number(root.format_version);

  const size = normalizeSize(root.size);
  if (size) result.size = size;

  const worldOrigin = normalizeOrigin(root.structure_world_origin);
  if (worldOrigin) result.worldOrigin = worldOrigin;

  if (defaultPalette && "block_position_data" in defaultPalette) {
    result.blockPositionData = defaultPalette.block_position_data;
  }

  return result;
}
