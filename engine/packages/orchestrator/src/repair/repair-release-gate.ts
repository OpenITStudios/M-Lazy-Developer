import type { RepairLifecycleState } from "./repair-lifecycle.js";
import { repairReleaseEligible } from "./repair-lifecycle.js";

export type PackageStagingDisposition =
  | "staging-eligible"
  | "blocked";

export interface PackageStagingDecision {
  transactionId: string;
  disposition: PackageStagingDisposition;
  reasons: readonly string[];
}

export type RepairReleaseDisposition =
  | "release-eligible"
  | "blocked";

export interface RepairReleaseDecision {
  transactionId: string;
  disposition: RepairReleaseDisposition;
  reasons: readonly string[];
}

export function decideRepairPackageStaging(
  state: RepairLifecycleState,
): PackageStagingDecision {
  if (
    state.stage !== "static-validated" ||
    !state.mutationPresent ||
    !state.localStaticValidationPassed ||
    !state.transitiveRevalidationComplete
  ) {
    return {
      transactionId: state.transactionId,
      disposition: "blocked",
      reasons: [
        "Repair package staging requires an applied mutation with complete static and transitive validation.",
        ...state.reasons,
      ],
    };
  }

  return {
    transactionId: state.transactionId,
    disposition: "staging-eligible",
    reasons: [
      "Static and transitive repair validation are complete.",
      "Package generation may proceed, but staging eligibility does not imply release eligibility.",
    ],
  };
}

export function decideRepairRelease(
  state: RepairLifecycleState,
): RepairReleaseDecision {
  if (!repairReleaseEligible(state)) {
    const missing: string[] = [];
    if (!state.localStaticValidationPassed) {
      missing.push("local static validation");
    }
    if (!state.transitiveRevalidationComplete) {
      missing.push("transitive revalidation");
    }
    if (
      state.staticPreservationRequired === true &&
      (
        state.staticPreservationComplete !== true ||
        !state.staticPreservationProofFingerprint?.trim()
      )
    ) {
      missing.push("static graph preservation");
    }
    if (!state.runtimeVerificationComplete) {
      missing.push("runtime verification");
    }
    if (!state.preservationVerificationComplete) {
      missing.push("preservation verification");
    }
    if (!state.packageVerificationComplete) {
      missing.push("package verification");
    }

    return {
      transactionId: state.transactionId,
      disposition: "blocked",
      reasons: [
        "Repair is not release-eligible.",
        ...(missing.length === 0
          ? ["Lifecycle stage is not releaseable."]
          : ["Missing proof layers: " + missing.join(", ") + "."]),
      ],
    };
  }

  return {
    transactionId: state.transactionId,
    disposition: "release-eligible",
    reasons: [
      "Static validation, required static graph preservation, transitive revalidation, runtime verification, preservation verification, and package verification are all complete.",
    ],
  };
}
