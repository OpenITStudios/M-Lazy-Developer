import type {
  RuntimeDiagnosticPredicateEvidence,
  RuntimeExperimentDiagnosticBridge,
} from "../diagnosis/runtime-experiment-diagnostic-evidence.js";

export type EntityNavigationRuntimeDisposition =
  | "dynamic-congestion-supported"
  | "recovery-effective"
  | "recovery-not-demonstrated"
  | "contrast-mismatch"
  | "insufficient";

export interface EntityNavigationRuntimeClassification {
  experimentId: string;
  kind: "crowding" | "recovery" | "unknown";
  disposition: EntityNavigationRuntimeDisposition;
  evidenceIds: readonly string[];
  reasons: readonly string[];
}

function predicate(
  bridge: RuntimeExperimentDiagnosticBridge,
  id: string,
): RuntimeDiagnosticPredicateEvidence | undefined {
  return bridge.predicates.find(
    (item) => item.predicate === id,
  );
}

function supportedContrast(
  item: RuntimeDiagnosticPredicateEvidence | undefined,
  controlState: "present" | "absent",
  treatmentState: "present" | "absent",
): boolean {
  return (
    item?.ceiling === "intervention-supported" &&
    item.interventionContrast === true &&
    item.expectedContrastDisposition === "matched" &&
    item.observedContrast?.controlState ===
      controlState &&
    item.observedContrast?.treatmentState ===
      treatmentState
  );
}

export function classifyEntityNavigationRuntimeExperiment(
  bridge: RuntimeExperimentDiagnosticBridge,
): EntityNavigationRuntimeClassification {
  const recovery = predicate(
    bridge,
    "movement-resumed-after-recovery",
  );
  const crowding = predicate(
    bridge,
    "navigation-stall-observed",
  );

  if (recovery) {
    if (
      supportedContrast(
        recovery,
        "absent",
        "present",
      )
    ) {
      return {
        experimentId: bridge.experimentId,
        kind: "recovery",
        disposition: "recovery-effective",
        evidenceIds:
          recovery.sourceEvidenceIds,
        reasons: [
          "Controlled recovery produced the expected absent→present movement-resumed contrast with intervention-supported evidence.",
        ],
      };
    }

    if (
      recovery.expectedContrastDisposition ===
      "mismatched"
    ) {
      return {
        experimentId: bridge.experimentId,
        kind: "recovery",
        disposition: "contrast-mismatch",
        evidenceIds:
          recovery.sourceEvidenceIds,
        reasons: [
          "Observed recovery contrast does not match the experiment's authored expected direction.",
        ],
      };
    }

    return {
      experimentId: bridge.experimentId,
      kind: "recovery",
      disposition:
        "recovery-not-demonstrated",
      evidenceIds:
        recovery.sourceEvidenceIds,
      reasons: [
        "Recovery evidence exists, but the required intervention-supported absent→present contrast is not established.",
      ],
    };
  }

  if (crowding) {
    if (
      supportedContrast(
        crowding,
        "absent",
        "present",
      )
    ) {
      return {
        experimentId: bridge.experimentId,
        kind: "crowding",
        disposition:
          "dynamic-congestion-supported",
        evidenceIds:
          crowding.sourceEvidenceIds,
        reasons: [
          "Controlled crowd density produced the expected absent→present navigation-stall contrast with intervention-supported evidence.",
        ],
      };
    }

    if (
      crowding.expectedContrastDisposition ===
      "mismatched"
    ) {
      return {
        experimentId: bridge.experimentId,
        kind: "crowding",
        disposition: "contrast-mismatch",
        evidenceIds:
          crowding.sourceEvidenceIds,
        reasons: [
          "Observed crowding contrast does not match the experiment's authored expected direction.",
        ],
      };
    }

    return {
      experimentId: bridge.experimentId,
      kind: "crowding",
      disposition: "insufficient",
      evidenceIds:
        crowding.sourceEvidenceIds,
      reasons: [
        "Crowding evidence does not establish the required intervention-supported stall contrast.",
      ],
    };
  }

  return {
    experimentId: bridge.experimentId,
    kind: "unknown",
    disposition: "insufficient",
    evidenceIds: [],
    reasons: [
      "Runtime experiment does not expose a recognized entity-navigation outcome predicate.",
    ],
  };
}
