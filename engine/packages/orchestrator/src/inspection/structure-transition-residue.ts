import {
  flatIndexToCoordinate,
  type McStructureModel,
} from "../../../../adapters/mcstructure/src/index.js";

export interface StructureVoidCell {
  x: number;
  y: number;
  z: number;
  layer: number;
}

export interface StructureTransitionResidueAssessment {
  status: "clean" | "residue-risk" | "unresolved";
  structureVoidPaletteIndices: readonly number[];
  voidCellCount: number;
  samples: readonly StructureVoidCell[];
  reason: string;
}

export function assessStructureTransitionResidue(
  structure: McStructureModel,
  options: { sampleLimit?: number } = {},
): StructureTransitionResidueAssessment {
  if (!structure.size || structure.blockIndexLayers.length === 0) {
    return {
      status: "unresolved",
      structureVoidPaletteIndices: [],
      voidCellCount: 0,
      samples: [],
      reason: "Structure size or block-index layers are unavailable.",
    };
  }

  const voidIndices = structure.palette
    .filter((entry) => entry.name === "minecraft:structure_void")
    .map((entry) => entry.index);

  if (voidIndices.length === 0) {
    return {
      status: "clean",
      structureVoidPaletteIndices: [],
      voidCellCount: 0,
      samples: [],
      reason: "Structure contains no structure_void palette entries.",
    };
  }

  const set = new Set(voidIndices);
  const sampleLimit = options.sampleLimit ?? 64;
  const samples: StructureVoidCell[] = [];
  let voidCellCount = 0;

  for (const layer of structure.blockIndexLayers) {
    for (let index = 0; index < layer.indices.length; index += 1) {
      if (!set.has(layer.indices[index]!)) continue;
      voidCellCount += 1;
      if (samples.length < sampleLimit) {
        const position = flatIndexToCoordinate(index, structure.size);
        // Invalid dimensions cannot establish an actual voxel position.
        if (position) samples.push({ ...position, layer: layer.layer });
      }
    }
  }

  return {
    status: voidCellCount > 0 ? "residue-risk" : "clean",
    structureVoidPaletteIndices: voidIndices,
    voidCellCount,
    samples,
    reason:
      voidCellCount > 0
        ? "structure_void cells do not overwrite prior world blocks; level-to-level replacement requires explicit residue proof."
        : "structure_void is present in the palette but unused by indexed cells.",
  };
}
