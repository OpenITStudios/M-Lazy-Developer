import { createHash } from "node:crypto";
import type {
  InspectArtifactResult,
} from "../inspection/inspect-artifact.js";

export type ArenaProofReuseLayer =
  | "native-spatial"
  | "voxel"
  | "block-entity"
  | "tick-state"
  | "actor-population"
  | "structure-instance"
  | "entity-population";

export interface ArenaProofReuseAssessment {
  layer: ArenaProofReuseLayer;
  status: "reusable" | "stale" | "blocked";
  reason: string;
}

export interface ArenaProofReuseReport {
  schemaVersion: 1;
  assessments:
    readonly ArenaProofReuseAssessment[];
  reusableLayers:
    readonly ArenaProofReuseLayer[];
  staleLayers:
    readonly ArenaProofReuseLayer[];
  blockedLayers:
    readonly ArenaProofReuseLayer[];
}

function canonical(
  value: unknown,
): unknown {
  if (Array.isArray(value)) {
    return value.map(canonical);
  }
  if (
    value !== null &&
    typeof value === "object"
  ) {
    return Object.fromEntries(
      Object.entries(
        value as Record<string, unknown>,
      )
        .sort(([a], [b]) =>
          a.localeCompare(b)
        )
        .map(([key, child]) => [
          key,
          canonical(child),
        ]),
    );
  }
  return value;
}

function hash(
  value: unknown,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify(
        canonical(value),
      ),
    )
    .digest("hex");
}

function layoutFingerprint(
  result: InspectArtifactResult,
): string {
  return hash({
    layout:
      result.arenaAnalysis.spatialLayout ??
      null,
    regionPlan:
      result.arenaAnalysis.regionPlan ??
      null,
    regionClassification:
      result.arenaAnalysis
        .regionClassification ?? null,
    proofPartition:
      result.arenaAnalysis
        .proofPartition ?? null,
  });
}

function arenaChunkScope(
  result: InspectArtifactResult,
): ReadonlySet<string> | undefined {
  const layout =
    result.arenaAnalysis.spatialLayout;
  const plan =
    result.arenaAnalysis.regionPlan;
  if (!layout || !plan) {
    return undefined;
  }

  const offsets = [
    { x: 0, z: 0 },
    ...layout.offsets.map((offset) => ({
      x: offset.x,
      z: offset.z,
    })),
  ];
  const keys = new Set<string>();

  for (const offset of offsets) {
    for (const volume of plan.volumes) {
      const minChunkX =
        Math.floor(
          (volume.min.x + offset.x) /
            16,
        );
      const maxChunkX =
        Math.floor(
          (volume.max.x + offset.x) /
            16,
        );
      const minChunkZ =
        Math.floor(
          (volume.min.z + offset.z) /
            16,
        );
      const maxChunkZ =
        Math.floor(
          (volume.max.z + offset.z) /
            16,
        );

      for (
        let chunkX = minChunkX;
        chunkX <= maxChunkX;
        chunkX += 1
      ) {
        for (
          let chunkZ = minChunkZ;
          chunkZ <= maxChunkZ;
          chunkZ += 1
        ) {
          keys.add(
            "0:" +
              chunkX +
              ":" +
              chunkZ,
          );
        }
      }
    }
  }

  return keys;
}

function completeWorldDbFingerprint(
  result: InspectArtifactResult,
):
  | {
      complete: true;
      fingerprint: string;
    }
  | {
      complete: false;
      reason: string;
    } {
  const scan =
    result.worldDatabase?.nativeScan;
  if (!scan || scan.status !== "scanned") {
    return {
      complete: false,
      reason:
        "Native world DB scan is unavailable.",
    };
  }
  if (
    scan.truncated ||
    scan.chunkSignalsTruncated ||
    scan.chunkContentObservationsTruncated
  ) {
    return {
      complete: false,
      reason:
        "Native world DB evidence is truncated, so physical proof reuse cannot be authorized.",
    };
  }
  if (!scan.chunkContentObservations) {
    return {
      complete: false,
      reason:
        "Hashed native chunk content observations are unavailable.",
    };
  }

  const scope =
    arenaChunkScope(result);
  if (!scope) {
    return {
      complete: false,
      reason:
        "Arena layout/region scope is unavailable for dependency-scoped world DB proof reuse.",
    };
  }

  const observations =
    scan.chunkContentObservations
      .filter((item) =>
        scope.has(
          item.dimensionId +
            ":" +
            item.chunkX +
            ":" +
            item.chunkZ,
        )
      )
      .map((item) => ({
        chunkX: item.chunkX,
        chunkZ: item.chunkZ,
        dimensionId:
          item.dimensionId,
        kind: item.kind,
        valueHash:
          item.valueHash,
        ...(item.subChunkIndex ===
        undefined
          ? {}
          : {
              subChunkIndex:
                item.subChunkIndex,
            }),
      }))
      .sort((a, b) =>
        a.dimensionId -
          b.dimensionId ||
        a.chunkX - b.chunkX ||
        a.chunkZ - b.chunkZ ||
        a.kind.localeCompare(b.kind) ||
        (a.subChunkIndex ?? -1) -
          (b.subChunkIndex ?? -1) ||
        a.valueHash.localeCompare(
          b.valueHash,
        )
      );

  return {
    complete: true,
    fingerprint: hash({
      arenaChunkScope:
        [...scope].sort(),
      observations,
    }),
  };
}

function structureFingerprint(
  result: InspectArtifactResult,
): string {
  return hash({
    commandPlacements:
      result.structureRuntime
        .structurePlacements,
    scriptPlacements:
      result.scriptSpatial
        .structurePlacements,
  });
}

function authoredEntityFingerprint(
  result: InspectArtifactResult,
): string {
  return hash(
    result.arenaAnalysis
      .entitySpawnEvidence ?? [],
  );
}

function physicalAssessment(
  layer: ArenaProofReuseLayer,
  before: InspectArtifactResult,
  after: InspectArtifactResult,
): ArenaProofReuseAssessment {
  if (
    layoutFingerprint(before) !==
    layoutFingerprint(after)
  ) {
    return {
      layer,
      status: "stale",
      reason:
        "Arena layout/region dependency changed.",
    };
  }

  const left =
    completeWorldDbFingerprint(before);
  const right =
    completeWorldDbFingerprint(after);

  if (!left.complete) {
    return {
      layer,
      status: "blocked",
      reason: left.reason,
    };
  }
  if (!right.complete) {
    return {
      layer,
      status: "blocked",
      reason: right.reason,
    };
  }

  return left.fingerprint === right.fingerprint
    ? {
        layer,
        status: "reusable",
        reason:
          "Arena layout and complete arena-scoped hashed world DB dependencies are unchanged.",
      }
    : {
        layer,
        status: "stale",
        reason:
          "Arena-scoped hashed world DB dependency changed.",
      };
}

export function assessArenaProofReuse(
  before: InspectArtifactResult,
  after: InspectArtifactResult,
): ArenaProofReuseReport {
  const assessments:
    ArenaProofReuseAssessment[] = [
      physicalAssessment(
        "native-spatial",
        before,
        after,
      ),
      physicalAssessment(
        "voxel",
        before,
        after,
      ),
      physicalAssessment(
        "block-entity",
        before,
        after,
      ),
      physicalAssessment(
        "tick-state",
        before,
        after,
      ),
    ];

  assessments.push(
    layoutFingerprint(before) ===
      layoutFingerprint(after) &&
    structureFingerprint(before) ===
      structureFingerprint(after)
      ? {
          layer: "structure-instance",
          status: "reusable",
          reason:
            "Arena layout and authored structure placement dependencies are unchanged.",
        }
      : {
          layer: "structure-instance",
          status: "stale",
          reason:
            "Arena layout or authored structure placement dependency changed.",
        },
  );

  assessments.push(
    layoutFingerprint(before) ===
      layoutFingerprint(after) &&
    authoredEntityFingerprint(before) ===
      authoredEntityFingerprint(after)
      ? {
          layer: "entity-population",
          status: "reusable",
          reason:
            "Arena layout and authored entity-spawn dependencies are unchanged.",
        }
      : {
          layer: "entity-population",
          status: "stale",
          reason:
            "Arena layout or authored entity-spawn dependency changed.",
        },
  );

  const beforeScan =
    before.worldDatabase?.nativeScan;
  const afterScan =
    after.worldDatabase?.nativeScan;
  const actorLayoutSame =
    layoutFingerprint(before) ===
      layoutFingerprint(after);
  const actorHashesComplete =
    beforeScan?.status === "scanned" &&
    afterScan?.status === "scanned" &&
    beforeScan.truncated !== true &&
    afterScan.truncated !== true &&
    beforeScan.actorContentComplete === true &&
    afterScan.actorContentComplete === true;
  const beforeActorHash =
    beforeScan?.actorContentFingerprint;
  const afterActorHash =
    afterScan?.actorContentFingerprint;
  // Missing Actor DB evidence is UNKNOWN, never a verified zero record count.
  const beforeActors =
    beforeScan?.actorRecords;
  const afterActors =
    afterScan?.actorRecords;

  if (
    beforeActors === 0 &&
    afterActors === 0 &&
    actorLayoutSame &&
    actorHashesComplete
  ) {
    assessments.push({
      layer: "actor-population",
      status: "reusable",
      reason:
        "Both snapshots contain zero Actor records and arena layout is unchanged.",
    });
  } else if (
    actorLayoutSame &&
    actorHashesComplete &&
    beforeActorHash !== undefined &&
    beforeActorHash === afterActorHash
  ) {
    assessments.push({
      layer: "actor-population",
      status: "reusable",
      reason:
        "Arena layout and complete Actor record content fingerprint are unchanged.",
    });
  } else if (
    actorLayoutSame &&
    actorHashesComplete &&
    beforeActorHash !==
      afterActorHash
  ) {
    assessments.push({
      layer: "actor-population",
      status: "stale",
      reason:
        "Complete Actor record content fingerprint changed.",
    });
  } else {
    assessments.push({
      layer: "actor-population",
      status: "blocked",
      reason:
        "Actor record dependency fingerprint is incomplete; fresh Actor DB proof is required.",
    });
  }

  return {
    schemaVersion: 1,
    assessments,
    reusableLayers:
      assessments
        .filter(
          (item) =>
            item.status === "reusable",
        )
        .map((item) => item.layer),
    staleLayers:
      assessments
        .filter(
          (item) =>
            item.status === "stale",
        )
        .map((item) => item.layer),
    blockedLayers:
      assessments
        .filter(
          (item) =>
            item.status === "blocked",
        )
        .map((item) => item.layer),
  };
}
