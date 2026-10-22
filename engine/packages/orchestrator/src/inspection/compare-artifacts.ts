import type { KnowledgeCatalog } from "../../../knowledge/src/index.js";
import { inspectArtifact, type InspectArtifactResult } from "./inspect-artifact.js";
import type { InspectTargetProfile } from "../core/types.js";
import { diffWorldDbNative, type WorldDbNativeDiff } from "./world-db-diff.js";
import { compareCausalAnalysis, type CausalComparison } from "../diagnosis/causal-comparison.js";
import {
  compareGameplayIntentModels,
  type GameplayIntentModelComparison,
} from "../../../gameplay-intent/src/index.js";

export interface ArtifactComparisonResult {
  before: {
    artifactId: string;
    fingerprint: string;
    diagnostics: number;
    criticalDiagnostics: number;
  };
  after: {
    artifactId: string;
    fingerprint: string;
    diagnostics: number;
    criticalDiagnostics: number;
  };
  nativeWorld: WorldDbNativeDiff | {
    comparable: false;
    reason: string;
  };
  causal: CausalComparison;
  gameplayIntent: GameplayIntentModelComparison;
  artifactChangedIntentStable: boolean;
}

function summarize(result: InspectArtifactResult) {
  return {
    artifactId: result.artifactId,
    fingerprint: result.fingerprint,
    diagnostics: result.diagnostics.length,
    criticalDiagnostics: result.diagnostics.filter(
      (finding) => finding.severity === "critical",
    ).length,
  };
}

export async function compareArtifacts(
  beforePath: string,
  afterPath: string,
  target: InspectTargetProfile = {},
  knowledgeCatalog?: KnowledgeCatalog,
): Promise<ArtifactComparisonResult> {
  const [before, after] = await Promise.all([
    inspectArtifact(beforePath, target, knowledgeCatalog),
    inspectArtifact(afterPath, target, knowledgeCatalog),
  ]);

  const beforeNative = before.worldDatabase.nativeScan;
  const afterNative = after.worldDatabase.nativeScan;

  const gameplayIntent = compareGameplayIntentModels(
    before.gameplayIntent.model,
    after.gameplayIntent.model,
  );

  const beforeSummary = summarize(before);
  const afterSummary = summarize(after);

  return {
    before: beforeSummary,
    after: afterSummary,
    nativeWorld:
      beforeNative && afterNative
        ? diffWorldDbNative(beforeNative, afterNative)
        : {
            comparable: false,
            reason: "Both artifacts must expose native LevelDB summaries.",
          },
    causal: compareCausalAnalysis(before, after),
    gameplayIntent,
    artifactChangedIntentStable:
      beforeSummary.fingerprint !== afterSummary.fingerprint &&
      gameplayIntent.semanticallyStable,
  };
}
