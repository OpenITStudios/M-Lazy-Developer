import type { McStructureModel, StructureCoordinate } from "./types.js";

export function structureVolume(structure: Pick<McStructureModel, "size">): number | undefined {
  if (!structure.size) return undefined;
  return structure.size.x * structure.size.y * structure.size.z;
}

export function validateStructureLayerLengths(
  structure: Pick<McStructureModel, "size"> & {
    readonly blockIndexLayers: readonly {
      readonly layer: number;
      readonly indices: ArrayLike<number>;
    }[];
  },
): { ok: boolean; expected?: number; invalidLayers: number[] } {
  const expected = structureVolume(structure);
  if (expected === undefined) return { ok: false, invalidLayers: structure.blockIndexLayers.map((x) => x.layer) };

  const invalidLayers = structure.blockIndexLayers
    .filter((layer) => layer.indices.length !== expected)
    .map((layer) => layer.layer);

  return { ok: invalidLayers.length === 0, expected, invalidLayers };
}

export function flatIndexToCoordinate(
  index: number,
  size: { x: number; y: number; z: number },
): StructureCoordinate | undefined {
  const volume = size.x * size.y * size.z;
  if (!Number.isInteger(index) || index < 0 || index >= volume) return undefined;

  const x = Math.floor(index / (size.y * size.z));
  const remainder = index % (size.y * size.z);
  const y = Math.floor(remainder / size.z);
  const z = remainder % size.z;

  return { x, y, z };
}
