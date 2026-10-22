import {
  releaseIdentityConsistencyDiagnostics,
  type ReleaseIdentityObservation,
} from "../../../../analyzers/diagnostics/src/index.js";
import type { DiagnosticFinding } from "../../../diagnostics/src/index.js";
import type { InspectedPack, InspectTargetProfile } from "../core/types.js";
import type { ScriptSafeConfigAnalysis } from "../inspection/script-safe-config-analysis.js";

export interface ReleaseIdentityAnalysis {
  status: "unavailable" | "consistent" | "conflict";
  explicitReleaseObservations: readonly ReleaseIdentityObservation[];
  packVersions: readonly {
    component: string;
    packVersion: string;
  }[];
  engineVersions: readonly {
    component: string;
    engineVersion: string;
  }[];
  scriptApiVersions: readonly {
    component: string;
    moduleName: string;
    scriptApiVersion: string;
  }[];
  findings: readonly DiagnosticFinding[];
}

const RELEASE_BINDING_NAME =
  /^(?:RELEASE_VERSION|MAP_RELEASE_VERSION|BUILD_RELEASE_VERSION|CONTENT_RELEASE_VERSION)$/;

export function analyzeReleaseIdentity(
  packs: readonly InspectedPack[],
  scriptConfig: ScriptSafeConfigAnalysis,
  target: InspectTargetProfile,
  additionalObservations:
    readonly ReleaseIdentityObservation[] = [],
): ReleaseIdentityAnalysis {
  const explicitReleaseObservations: ReleaseIdentityObservation[] = [
    ...additionalObservations,
  ];

  if (
    target.releaseVersion !== undefined &&
    target.releaseVersion.trim().length > 0
  ) {
    explicitReleaseObservations.push({
      component: "target-profile",
      releaseVersion: target.releaseVersion.trim(),
    });
  }

  for (const item of scriptConfig.resolvedBindings) {
    if (
      !RELEASE_BINDING_NAME.test(item.name) ||
      typeof item.value !== "string" ||
      item.value.trim().length === 0
    ) {
      continue;
    }
    explicitReleaseObservations.push({
      component:
        "script:" + item.scriptId + ":" + item.name,
      releaseVersion: item.value.trim(),
      source: item.source,
    });
  }

  const deduplicatedObservations = [
    ...new Map(
      explicitReleaseObservations.map((item) => [
        [
          item.component,
          item.releaseVersion,
          item.source?.relativePath ?? "",
          item.source?.range?.lineStart ?? 0,
        ].join("|"),
        item,
      ]),
    ).values(),
  ];

  const findings =
    releaseIdentityConsistencyDiagnostics(
      deduplicatedObservations,
    );
  const versions = new Set(
    deduplicatedObservations.map(
      (item) => item.releaseVersion,
    ),
  );

  return {
    status:
      deduplicatedObservations.length === 0
        ? "unavailable"
        : versions.size === 1
          ? "consistent"
          : "conflict",
    explicitReleaseObservations:
      deduplicatedObservations.sort((a, b) =>
        a.component.localeCompare(b.component)
      ),
    packVersions: packs.flatMap((pack) =>
      pack.packVersion === undefined
        ? []
        : [{
            component: pack.root,
            packVersion: pack.packVersion,
          }]
    ),
    engineVersions: packs.flatMap((pack) =>
      pack.minEngineVersion === undefined
        ? []
        : [{
            component: pack.root,
            engineVersion: pack.minEngineVersion,
          }]
    ),
    scriptApiVersions: packs.flatMap((pack) =>
      pack.scriptModules.map((module) => ({
        component: pack.root,
        moduleName: module.moduleName,
        scriptApiVersion: module.version,
      }))
    ),
    findings,
  };
}
