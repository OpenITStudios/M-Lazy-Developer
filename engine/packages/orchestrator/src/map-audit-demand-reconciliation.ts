import type {
  AnalysisKnowledgeDomain,
} from "../../analysis-planner/src/index.js";
import type {
  InspectArtifactResult,
} from "./inspection/inspect-artifact.js";

export interface AuditDemandReconciliation {
  readonly policy: "monotonic-rig-demand-reconciliation";
  readonly analyzedDomains: readonly AnalysisKnowledgeDomain[];
  readonly requiredDomains: readonly AnalysisKnowledgeDomain[];
  readonly missingDomains: readonly AnalysisKnowledgeDomain[];
  readonly stable: boolean;
  readonly passCount: number;
  /** Actual per-pass observations, not audit authorization or speedup proof.
   * inspectionElapsedMs covers one prepared inspection (working copy, DB,
   * source indexing and downstream analysis); it excludes initial ZIP
   * extraction and final Map Audit report assembly.
   */
  readonly sourceIndexPasses?: readonly (NonNullable<
    InspectArtifactResult["sourceIndexWork"]
  > & {
    readonly pass: number;
    readonly inspectionElapsedMs?: number;
  })[];
}

export function reconcileSelectedMapAuditDemand(
  inspection: InspectArtifactResult,
  passCount = 1,
  previous?: AuditDemandReconciliation,
  inspectionElapsedMs?: number,
): AuditDemandReconciliation {
  if (inspectionElapsedMs !== undefined &&
      (!Number.isFinite(inspectionElapsedMs) || inspectionElapsedMs < 0)) {
    throw new Error("Inspection duration must be finite and nonnegative.");
  }
  if (!Number.isInteger(passCount) || passCount < 1) {
    throw new Error(
      "Audit demand reconciliation passCount must be a positive integer.",
    );
  }
  const analyzed = new Set(
    inspection.gameplayWorld.analysisDemand ?? [],
  );
  const required = new Set<AnalysisKnowledgeDomain>(
    inspection.hiddenGameplayDefects
      .scenarioAudit.graph.knowledgeRequirements
      .map((item) => item.domain),
  );
  const missing = [...required]
    .filter((domain) => !analyzed.has(domain))
    .sort();

  const sourceIndexPasses = [
    ...(previous?.sourceIndexPasses ?? []),
    ...(inspection.sourceIndexWork === undefined ? [] : [{
      pass: passCount,
      ...inspection.sourceIndexWork,
      ...(inspectionElapsedMs === undefined ? {} : { inspectionElapsedMs }),
    }]),
  ];
  return {
    policy: "monotonic-rig-demand-reconciliation",
    analyzedDomains: [...analyzed].sort(),
    requiredDomains: [...required].sort(),
    missingDomains: missing,
    stable: missing.length === 0,
    passCount,
    ...(sourceIndexPasses.length === 0 ? {} : { sourceIndexPasses }),
  };
}
