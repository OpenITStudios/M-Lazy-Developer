import type { KnowledgeCatalog } from "../../../knowledge/src/index.js";
import {
  loadCoverageCatalog,
  loadRegressionCatalog,
  loadUpdateDeltaCatalog,
} from "../../../reliability/src/index.js";
import {
  augmentRetestPlan,
  planRetest,
} from "../../../reliability/src/index.js";
import type {
  RegressionCase,
  ReliabilityDomain,
  RetestPlan,
  UpdateDeltaEntry,
} from "../../../reliability/src/index.js";
import { compareArtifacts, type ArtifactComparisonResult } from "./compare-artifacts.js";
import { inspectArtifact } from "./inspect-artifact.js";
import type { InspectTargetProfile } from "../core/types.js";
import {
  correlateScriptUsageWithUpdate,
  type ScriptUpdateCorrelation,
} from "./script-update-correlation.js";
import { causalRetestReasons } from "../diagnosis/causal-retest.js";

export interface VersionAwareEvidenceLink {
  updateEntryId: string;
  domain: ReliabilityDomain;
  overlappingCapabilities: string[];
  historicalRegressionIds: string[];
  nativeEvidence: {
    countDeltas: string[];
    changedChunkSignals: number;
  };
  scriptEvidence?: ScriptUpdateCorrelation;
}

export interface VersionAwareComparisonResult {
  targetVersion: string;
  comparison: ArtifactComparisonResult;
  retest: {
    before: RetestPlan;
    after: RetestPlan;
  };
  evidenceLinks: VersionAwareEvidenceLink[];
  causal: ArtifactComparisonResult["causal"];
}

function regressionIdsFor(
  entry: UpdateDeltaEntry,
  regressions: readonly RegressionCase[],
): string[] {
  const entryCaps = new Set(entry.capabilityTags);
  return regressions
    .filter((regression) =>
      regression.domain === entry.domain ||
      regression.capabilityTags.some((tag) => entryCaps.has(tag))
    )
    .map((regression) => regression.id)
    .sort();
}

function nativeCountDeltas(comparison: ArtifactComparisonResult): string[] {
  if (!("counts" in comparison.nativeWorld)) return [];
  return Object.entries(comparison.nativeWorld.counts)
    .filter(([, value]) => value.delta !== 0)
    .map(([key, value]) => `${key}:${value.delta > 0 ? "+" : ""}${value.delta}`)
    .sort();
}

export async function compareArtifactsForUpdate(
  beforePath: string,
  afterPath: string,
  targetVersion: string,
  reliabilityCatalogRoot: string,
  target: InspectTargetProfile = {},
  knowledgeCatalog?: KnowledgeCatalog,
): Promise<VersionAwareComparisonResult> {
  const versionedTarget: InspectTargetProfile = {
    ...target,
    version: targetVersion,
  };

  const [comparison, before, after, delta, regressions, coverage] = await Promise.all([
    compareArtifacts(beforePath, afterPath, versionedTarget, knowledgeCatalog),
    inspectArtifact(beforePath, versionedTarget, knowledgeCatalog),
    inspectArtifact(afterPath, versionedTarget, knowledgeCatalog),
    loadUpdateDeltaCatalog(reliabilityCatalogRoot, targetVersion),
    loadRegressionCatalog(reliabilityCatalogRoot),
    loadCoverageCatalog(reliabilityCatalogRoot),
  ]);

  const beforePlan = planRetest(
    before.reliability.fingerprint,
    delta,
    regressions,
    coverage,
  );
  const causalReasons = causalRetestReasons(comparison.causal);
  const afterPlan = augmentRetestPlan(
    planRetest(
      after.reliability.fingerprint,
      delta,
      regressions,
      coverage,
    ),
    causalReasons,
  );

  const beforeCaps = new Set(before.reliability.fingerprint.capabilityTags);
  const afterCaps = new Set(after.reliability.fingerprint.capabilityTags);
  const countDeltas = nativeCountDeltas(comparison);
  const changedChunkSignals =
    "changedChunkSignals" in comparison.nativeWorld
      ? comparison.nativeWorld.changedChunkSignals.length
      : 0;

  const evidenceLinks: VersionAwareEvidenceLink[] = delta.entries
    .flatMap((entry): VersionAwareEvidenceLink[] => {
      const overlappingCapabilities = entry.capabilityTags.filter(
        (tag) => beforeCaps.has(tag) || afterCaps.has(tag),
      );
      const domainOverlap =
        before.reliability.fingerprint.domains.includes(entry.domain) ||
        after.reliability.fingerprint.domains.includes(entry.domain);

      if (overlappingCapabilities.length === 0 && !domainOverlap) return [];

      const scriptEvidence = entry.domain === "scripts"
        ? correlateScriptUsageWithUpdate(
            entry,
            before.scriptApiUsage,
            after.scriptApiUsage,
          )
        : undefined;

      return [{
        updateEntryId: entry.id,
        domain: entry.domain,
        overlappingCapabilities,
        historicalRegressionIds: regressionIdsFor(entry, regressions),
        nativeEvidence: {
          countDeltas,
          changedChunkSignals,
        },
        ...(scriptEvidence ? { scriptEvidence } : {}),
      }];
    })
    .sort((a, b) => a.updateEntryId.localeCompare(b.updateEntryId));

  return {
    targetVersion,
    comparison,
    retest: {
      before: beforePlan,
      after: afterPlan,
    },
    evidenceLinks,
    causal: comparison.causal,
  };
}
