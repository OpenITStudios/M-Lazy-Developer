import {
  causalProofAtLeast,
  type DiagnosticRepairDecision,
} from "../../../project-model/src/index.js";
import type { PatchTransaction } from "../../../repair/src/index.js";
import type { RepairBlastRadiusDecision } from "./repair-counterfactual-types.js";

export type RepairAdmissionDisposition =
  | "eligible"
  | "guarded"
  | "review-required"
  | "blocked";

export interface RepairAdmissionDecision {
  transactionId: string;
  disposition: RepairAdmissionDisposition;
  reasons: readonly string[];
}

export function decideRepairAdmission(
  transaction: PatchTransaction,
  diagnostic: DiagnosticRepairDecision,
  blastRadius: RepairBlastRadiusDecision,
): RepairAdmissionDecision {
  if (blastRadius.transactionId !== transaction.id) {
    return {
      transactionId: transaction.id,
      disposition: "blocked",
      reasons: [
        "Blast-radius decision does not belong to this patch transaction.",
      ],
    };
  }

  if (
    diagnostic.disposition === "observe-only" ||
    diagnostic.disposition === "proposal-only"
  ) {
    return {
      transactionId: transaction.id,
      disposition: "blocked",
      reasons: [
        "Diagnostic evidence has not authorized mutation.",
        ...diagnostic.reasons,
      ],
    };
  }

  if (
    diagnostic.disposition === "repair-eligible" &&
    !causalProofAtLeast(diagnostic.proofState, "causal")
  ) {
    return {
      transactionId: transaction.id,
      disposition: "blocked",
      reasons: [
        "Full repair admission requires explicit causal proof-state evidence.",
      ],
    };
  }

  if (
    diagnostic.disposition === "guarded-repair-eligible" &&
    !causalProofAtLeast(diagnostic.proofState, "intervention-supported")
  ) {
    return {
      transactionId: transaction.id,
      disposition: "blocked",
      reasons: [
        "Guarded repair admission requires intervention-supported proof or stronger.",
      ],
    };
  }

  if (
    blastRadius.disposition === "blocked" ||
    blastRadius.disposition === "indeterminate"
  ) {
    return {
      transactionId: transaction.id,
      disposition: "blocked",
      reasons: [
        "Counterfactual impact does not satisfy the repair safety envelope.",
        ...blastRadius.reasons,
      ],
    };
  }

  if (blastRadius.disposition === "review-required") {
    return {
      transactionId: transaction.id,
      disposition: "review-required",
      reasons: [
        "Diagnostic evidence permits repair, but the semantic blast radius touches sensitive components.",
        ...blastRadius.reasons,
      ],
    };
  }

  if (diagnostic.disposition === "guarded-repair-eligible") {
    return {
      transactionId: transaction.id,
      disposition: "guarded",
      reasons: [
        "Repair is authorized only as a guarded working-copy mutation.",
        ...diagnostic.reasons,
        ...blastRadius.reasons,
      ],
    };
  }

  return {
    transactionId: transaction.id,
    disposition: "eligible",
    reasons: [
      "Causal diagnostic evidence authorizes a repair candidate and the semantic blast radius is bounded.",
      ...diagnostic.reasons,
      ...blastRadius.reasons,
    ],
  };
}
