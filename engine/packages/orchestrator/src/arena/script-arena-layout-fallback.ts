import {
  classifyArenaRegionRoles,
  type ArenaRegionPlan,
  type ArenaRegionVolume,
  type ArenaSpatialLayout,
} from "../../../../analyzers/topology/src/index.js";
import {
  resolveArenaRegionContractVolume,
  type ArenaRegionContract,
} from "../../../project-model/src/index.js";
import type {
  ScriptSafeConfigAnalysis,
} from "../inspection/script-safe-config-analysis.js";

export interface ScriptArenaLayoutFallback {
  layout: ArenaSpatialLayout;
  regionPlan?: ArenaRegionPlan;
  regionClassification?: ReturnType<
    typeof classifyArenaRegionRoles
  >;
}

function blockCount(volume: ArenaRegionVolume): number {
  return (
    (volume.max.x - volume.min.x + 1) *
    (volume.max.y - volume.min.y + 1) *
    (volume.max.z - volume.min.z + 1)
  );
}

function contractRegionPlan(
  contracts: readonly ArenaRegionContract[],
  anchor: { x: number; y: number; z: number },
): ArenaRegionPlan | undefined {
  if (contracts.length === 0) return undefined;

  const volumes = contracts.map((contract): ArenaRegionVolume => {
    const resolved = resolveArenaRegionContractVolume(
      contract,
      anchor,
    );
    return {
      min: resolved.min,
      max: resolved.max,
      evidenceCandidateIds: [
        "contract:" + contract.id,
      ],
    };
  });

  const boundingBox = volumes.reduce(
    (acc, volume) => ({
      min: {
        x: Math.min(acc.min.x, volume.min.x),
        y: Math.min(acc.min.y, volume.min.y),
        z: Math.min(acc.min.z, volume.min.z),
      },
      max: {
        x: Math.max(acc.max.x, volume.max.x),
        y: Math.max(acc.max.y, volume.max.y),
        z: Math.max(acc.max.z, volume.max.z),
      },
    }),
    {
      min: volumes[0]!.min,
      max: volumes[0]!.max,
    },
  );

  return {
    volumes,
    boundingBox,
    totalBlocks: volumes.reduce(
      (sum, volume) => sum + blockCount(volume),
      0,
    ),
    evidenceCandidates: 0,
    mergeGapBlocks: 0,
    confidence: "medium",
  };
}

export function deriveScriptArenaLayoutFallback(
  analysis: ScriptSafeConfigAnalysis,
  contracts: readonly ArenaRegionContract[] = [],
): ScriptArenaLayoutFallback | undefined {
  const source = analysis.resolvedArenaLayout;
  if (
    !source ||
    source.mode !== "absolute-centers" ||
    !source.canonicalAnchor ||
    source.offsets.length < 1
  ) {
    return undefined;
  }

  const canonical = source.canonicalAnchor;
  const offsets = source.offsets.slice(1);
  const layout: ArenaSpatialLayout = {
    basis: "script-config",
    canonical: {
      arenaId: "arena-1",
      anchor: canonical,
    },
    replicas: offsets.map((offset, index) => ({
      arenaId: `arena-${index + 2}`,
      anchor: {
        x: canonical.x + offset.x,
        y: canonical.y + offset.y,
        z: canonical.z + offset.z,
      },
    })),
    offsets,
    confidence:
      source.sourceNames.length > 1
        ? "high"
        : "medium",
  };

  const regionPlan = contractRegionPlan(
    contracts,
    canonical,
  );
  const regionClassification =
    regionPlan === undefined
      ? undefined
      : classifyArenaRegionRoles(
          regionPlan,
          [],
          [],
          contracts,
          canonical,
        );

  return {
    layout,
    ...(regionPlan === undefined
      ? {}
      : { regionPlan }),
    ...(regionClassification === undefined
      ? {}
      : { regionClassification }),
  };
}
