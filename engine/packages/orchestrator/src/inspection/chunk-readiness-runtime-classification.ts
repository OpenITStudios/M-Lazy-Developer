import type {
  RuntimeDiagnosticPredicateEvidence,
  RuntimeExperimentDiagnosticBridge,
} from "../diagnosis/runtime-experiment-diagnostic-evidence.js";

export type ChunkReadinessExperimentKind =
  | "player-loader"
  | "ticking-area";

export type ChunkReadinessRuntimeDisposition =
  | "player-loader-effective"
  | "ticking-area-effective"
  | "readiness-not-demonstrated"
  | "contrast-mismatch"
  | "insufficient";

export interface ChunkReadinessRuntimeClassification {
  experimentId: string;
  kind: ChunkReadinessExperimentKind;
  disposition: ChunkReadinessRuntimeDisposition;
  evidenceIds: readonly string[];
  reasons: readonly string[];
}

function readinessPredicate(
  bridge: RuntimeExperimentDiagnosticBridge,
): RuntimeDiagnosticPredicateEvidence | undefined {
  return bridge.predicates.find(
    (item) =>
      item.predicate ===
      "target-chunk-ready",
  );
}

export function classifyChunkReadinessRuntimeExperiment(
  kind: ChunkReadinessExperimentKind,
  bridge: RuntimeExperimentDiagnosticBridge,
): ChunkReadinessRuntimeClassification {
  const readiness =
    readinessPredicate(bridge);

  if (!readiness) {
    return {
      experimentId: bridge.experimentId,
      kind,
      disposition: "insufficient",
      evidenceIds: [],
      reasons: [
        "Runtime experiment does not expose target-chunk-ready evidence.",
      ],
    };
  }

  if (
    readiness.expectedContrastDisposition ===
    "mismatched"
  ) {
    return {
      experimentId: bridge.experimentId,
      kind,
      disposition: "contrast-mismatch",
      evidenceIds:
        readiness.sourceEvidenceIds,
      reasons: [
        "Observed chunk-readiness contrast does not match the experiment's authored expected direction.",
      ],
    };
  }

  const supported =
    readiness.ceiling ===
      "intervention-supported" &&
    readiness.interventionContrast === true &&
    readiness.expectedContrastDisposition ===
      "matched" &&
    readiness.observedContrast
      ?.controlState === "absent" &&
    readiness.observedContrast
      ?.treatmentState === "present";

  if (supported) {
    return {
      experimentId: bridge.experimentId,
      kind,
      disposition:
        kind === "player-loader"
          ? "player-loader-effective"
          : "ticking-area-effective",
      evidenceIds:
        readiness.sourceEvidenceIds,
      reasons: [
        "Controlled intervention produced the expected absent→present target-chunk-ready contrast.",
      ],
    };
  }

  return {
    experimentId: bridge.experimentId,
    kind,
    disposition:
      "readiness-not-demonstrated",
    evidenceIds:
      readiness.sourceEvidenceIds,
    reasons: [
      "Chunk-readiness evidence exists, but intervention-supported causality is not established.",
    ],
  };
}
