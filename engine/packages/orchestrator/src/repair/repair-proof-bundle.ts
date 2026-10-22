import {
  causalProofAtLeast,
  type CausalInterventionProvenance,
  type DiagnosticRepairDecision,
} from "../../../project-model/src/index.js";
import type { DecisionBasisRevision } from "../../../project-model/src/index.js";
import {
  patchTransactionSemanticFingerprint,
  type PatchTransaction,
} from "../../../repair/src/index.js";
import type { PreservationReadinessResult } from "../../../preservation/src/index.js";
import type {
  RepairBlastRadiusDecision,
  RepairCounterfactualImpact,
  RepairImpactTrace,
} from "./repair-counterfactual-types.js";
import type { RepairAdmissionDecision } from "./repair-admission.js";

export interface RepairProofPostTransformBinding {
  transactionId: string;
  transactionFingerprint: string;
}

export interface RepairWorkflowProofAuthority {
  readonly kind: "approved-bug" | "intentional-modification";
  readonly approvedBugSemanticKey?: string;
  readonly mustChangeInvariantIds: readonly string[];
  readonly mustPreserveInvariantIds: readonly string[];
}

export interface RepairProofBundle {
  transactionId: string;
  transactionFingerprint?: string;
  sourceFingerprint: string;
  graphFingerprint: string;
  decisionBasis: DecisionBasisRevision;
  incidentId: string;
  selectedCandidateId?: string;
  diagnosticDisposition: DiagnosticRepairDecision["disposition"];
  claimStrength: DiagnosticRepairDecision["claimStrength"];
  effectiveEvidenceLevel?: DiagnosticRepairDecision["effectiveEvidenceLevel"];
  proofState?: DiagnosticRepairDecision["proofState"];
  causalInterventionProvenance?: readonly CausalInterventionProvenance[];
  blastRadiusDisposition: RepairBlastRadiusDecision["disposition"];
  admissionDisposition: RepairAdmissionDecision["disposition"];
  preservationContractId?: string;
  preservationReadinessDisposition?: PreservationReadinessResult["disposition"];
  preservationBaselineEvidenceIds?: readonly string[];
  workflowAuthorityKind?: RepairWorkflowProofAuthority["kind"];
  approvedBugSemanticKey?: string;
  mustChangeInvariantIds?: readonly string[];
  mustPreserveInvariantIds?: readonly string[];
  postTransformProofBinding?: RepairProofPostTransformBinding;
  supportingInvariantIds: readonly string[];
  changedNodeIds: readonly string[];
  affectedNodeIds: readonly string[];
  requiredRevalidationNodeIds: readonly string[];
  requiredRevalidationPaths: readonly string[];
  impactTraces: readonly RepairImpactTrace[];
  reasons: readonly string[];
}

export function createRepairProofBundle(
  transaction: PatchTransaction,
  diagnostic: DiagnosticRepairDecision,
  impact: RepairCounterfactualImpact,
  blastRadius: RepairBlastRadiusDecision,
  admission: RepairAdmissionDecision,
  decisionBasis: DecisionBasisRevision,
  supportingInvariantIds: readonly string[] = [],
  preservationReadiness?: PreservationReadinessResult,
  postTransformProofBinding?: RepairProofPostTransformBinding,
  workflowAuthority?: RepairWorkflowProofAuthority,
): RepairProofBundle {
  for (const [label, id] of [
    ["counterfactual impact", impact.transactionId],
    ["blast-radius decision", blastRadius.transactionId],
    ["admission decision", admission.transactionId],
  ] as const) {
    if (id !== transaction.id) {
      throw new Error(
        "Repair proof bundle " +
          label +
          " does not belong to transaction " +
          transaction.id +
          ".",
      );
    }
  }

  const changed = new Set(impact.changedNodeIds);
  const revalidationNodeIds = impact.affectedNodeIds
    .filter((id) => !changed.has(id))
    .sort();

  const changedPaths = new Set(transaction.affectedPaths);
  const revalidationPaths = impact.affectedPaths
    .filter((path) => !changedPaths.has(path))
    .sort();

  if (
    decisionBasis.sourceFingerprint !== transaction.sourceFingerprint
  ) {
    throw new Error(
      "Repair proof decision basis source fingerprint does not match transaction.",
    );
  }
  if (!decisionBasis.graphFingerprint?.trim()) {
    throw new Error(
      "Repair proof bundle requires a semantic graph fingerprint in decision basis.",
    );
  }

  return {
    transactionId: transaction.id,
    transactionFingerprint:
      patchTransactionSemanticFingerprint(
        transaction,
      ),
    sourceFingerprint: transaction.sourceFingerprint,
    graphFingerprint: decisionBasis.graphFingerprint,
    decisionBasis: { ...decisionBasis },
    incidentId: diagnostic.incidentId,
    ...(diagnostic.selectedCandidateId === undefined
      ? {}
      : { selectedCandidateId: diagnostic.selectedCandidateId }),
    diagnosticDisposition: diagnostic.disposition,
    claimStrength: diagnostic.claimStrength,
    ...(diagnostic.effectiveEvidenceLevel === undefined
      ? {}
      : { effectiveEvidenceLevel: diagnostic.effectiveEvidenceLevel }),
    ...(diagnostic.proofState === undefined
      ? {}
      : { proofState: diagnostic.proofState }),
    ...(diagnostic.causalProof?.interventionProvenance === undefined
      ? {}
      : {
          causalInterventionProvenance:
            diagnostic.causalProof.interventionProvenance.map((item) => ({
              ...item,
              ...(item.controlledFactorIds === undefined
                ? {}
                : {
                    controlledFactorIds: [...item.controlledFactorIds],
                  }),
              ...(item.evidenceIds === undefined
                ? {}
                : { evidenceIds: [...item.evidenceIds] }),
            })),
        }),
    blastRadiusDisposition: blastRadius.disposition,
    admissionDisposition: admission.disposition,
    ...(preservationReadiness === undefined
      ? {}
      : {
          preservationContractId: preservationReadiness.contractId,
          preservationReadinessDisposition:
            preservationReadiness.disposition,
          preservationBaselineEvidenceIds:
            [...preservationReadiness.baselineEvidenceIds],
        }),
    ...(workflowAuthority === undefined
      ? {}
      : {
          workflowAuthorityKind: workflowAuthority.kind,
          ...(workflowAuthority.approvedBugSemanticKey === undefined
            ? {}
            : {
                approvedBugSemanticKey:
                  workflowAuthority.approvedBugSemanticKey,
              }),
          mustChangeInvariantIds: [
            ...new Set(workflowAuthority.mustChangeInvariantIds),
          ].sort(),
          mustPreserveInvariantIds: [
            ...new Set(workflowAuthority.mustPreserveInvariantIds),
          ].sort(),
        }),
    ...(postTransformProofBinding === undefined
      ? {}
      : {
          postTransformProofBinding: {
            ...postTransformProofBinding,
          },
        }),
    supportingInvariantIds: [...new Set(supportingInvariantIds)].sort(),
    changedNodeIds: [...impact.changedNodeIds],
    affectedNodeIds: [...impact.affectedNodeIds],
    requiredRevalidationNodeIds: revalidationNodeIds,
    requiredRevalidationPaths: revalidationPaths,
    impactTraces: impact.impactTraces,
    reasons: [
      ...diagnostic.reasons,
      ...blastRadius.reasons,
      ...admission.reasons,
    ],
  };
}


function duplicateValues(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates].sort();
}

export function validateRepairProofBundle(
  transaction: PatchTransaction,
  proof: RepairProofBundle,
): string[] {
  const errors: string[] = [];

  if (proof.transactionId !== transaction.id) {
    errors.push(
      "Repair proof bundle does not belong to this patch transaction.",
    );
  }

  const transactionFingerprint =
    patchTransactionSemanticFingerprint(
      transaction,
    );
  if (
    proof.transactionFingerprint !== undefined &&
    proof.transactionFingerprint !==
      transactionFingerprint
  ) {
    errors.push(
      "Repair proof transaction fingerprint does not match the patch transaction semantics.",
    );
  }

  if (
    transaction.requiredProofs?.includes(
      "post-transform",
    )
  ) {
    if (
      proof.transactionFingerprint !==
        transactionFingerprint
    ) {
      errors.push(
        "Post-transform repair proof requires the exact patch transaction fingerprint.",
      );
    }
    if (!proof.postTransformProofBinding) {
      errors.push(
        "Patch transaction requires an explicit post-transform proof binding.",
      );
    } else {
      if (
        proof.postTransformProofBinding.transactionId !==
          transaction.id
      ) {
        errors.push(
          "Post-transform proof binding belongs to another patch transaction.",
        );
      }
      if (
        proof.postTransformProofBinding
          .transactionFingerprint !==
        transactionFingerprint
      ) {
        errors.push(
          "Post-transform proof binding fingerprint does not match the patch transaction semantics.",
        );
      }
    }
    if (
      !proof.decisionBasis
        .postTransformProofRevision?.trim()
    ) {
      errors.push(
        "Patch transaction requires postTransformProofRevision in the repair decision basis.",
      );
    }
  }

  if (proof.sourceFingerprint !== transaction.sourceFingerprint) {
    errors.push(
      "Repair proof source fingerprint does not match the patch transaction.",
    );
  }

  if (
    proof.decisionBasis.sourceFingerprint !==
      transaction.sourceFingerprint
  ) {
    errors.push(
      "Repair proof decision basis source fingerprint does not match the patch transaction.",
    );
  }

  if (
    proof.decisionBasis.graphFingerprint !==
      proof.graphFingerprint
  ) {
    errors.push(
      "Repair proof decision basis graph fingerprint does not match proof graph fingerprint.",
    );
  }

  if (!proof.graphFingerprint.trim()) {
    errors.push(
      "Repair proof semantic graph fingerprint must be non-empty.",
    );
  }

  if (
    causalProofAtLeast(proof.proofState, "intervention-supported") &&
    proof.causalInterventionProvenance !== undefined
  ) {
    const keys = proof.causalInterventionProvenance.map(
      (item) =>
        item.interventionId +
        "::" +
        (item.predicateId ?? "<missing>"),
    );
    const duplicates = duplicateValues(keys);
    if (duplicates.length > 0) {
      errors.push(
        "Repair proof causal intervention provenance contains duplicate intervention/predicate bindings: " +
          duplicates.join(", "),
      );
    }
  }

  for (const [label, values] of [
    ["supportingInvariantIds", proof.supportingInvariantIds],
    ["changedNodeIds", proof.changedNodeIds],
    ["affectedNodeIds", proof.affectedNodeIds],
    ["requiredRevalidationNodeIds", proof.requiredRevalidationNodeIds],
    ["requiredRevalidationPaths", proof.requiredRevalidationPaths],
  ] as const) {
    const duplicates = duplicateValues(values);
    if (duplicates.length > 0) {
      errors.push(
        label + " contains duplicate values: " + duplicates.join(", "),
      );
    }
  }

  const changed = new Set(proof.changedNodeIds);
  const affected = new Set(proof.affectedNodeIds);

  for (const id of changed) {
    if (!affected.has(id)) {
      errors.push(
        "Changed node is missing from affectedNodeIds: " + id,
      );
    }
  }

  for (const id of proof.requiredRevalidationNodeIds) {
    if (!affected.has(id)) {
      errors.push(
        "Revalidation node is outside affectedNodeIds: " + id,
      );
    }
    if (changed.has(id)) {
      errors.push(
        "Changed node must not also be listed as a transitive revalidation node: " +
          id,
      );
    }
  }

  const transactionPaths = new Set(transaction.affectedPaths);
  for (const path of proof.requiredRevalidationPaths) {
    if (transactionPaths.has(path)) {
      errors.push(
        "Directly mutated path must not also be listed as transitive revalidation: " +
          path,
      );
    }
  }

  for (const trace of proof.impactTraces) {
    if (!changed.has(trace.changedNodeId)) {
      errors.push(
        "Impact trace references undeclared changed node: " +
          trace.changedNodeId,
      );
    }
    if (!affected.has(trace.affectedNodeId)) {
      errors.push(
        "Impact trace references node outside affectedNodeIds: " +
          trace.affectedNodeId,
      );
    }
    if (trace.depth !== trace.edgePath.length) {
      errors.push(
        "Impact trace depth does not match edgePath length.",
      );
    }
    if (
      trace.nodePath[0] !== trace.changedNodeId ||
      trace.nodePath.at(-1) !== trace.affectedNodeId
    ) {
      errors.push(
        "Impact trace nodePath endpoints do not match declared nodes.",
      );
    }
  }

  if (
    proof.admissionDisposition === "eligible" &&
    proof.diagnosticDisposition !== "repair-eligible"
  ) {
    errors.push(
      "Eligible admission requires repair-eligible diagnostic authorization.",
    );
  }

  if (
    proof.admissionDisposition === "eligible" &&
    !causalProofAtLeast(proof.proofState, "causal")
  ) {
    errors.push(
      "Eligible admission requires causal proof-state evidence or stronger.",
    );
  }

  if (
    proof.admissionDisposition === "guarded" &&
    proof.diagnosticDisposition !== "guarded-repair-eligible"
  ) {
    errors.push(
      "Guarded admission requires guarded-repair-eligible diagnostic authorization.",
    );
  }

  if (
    proof.admissionDisposition === "guarded" &&
    !causalProofAtLeast(proof.proofState, "intervention-supported")
  ) {
    errors.push(
      "Guarded admission requires intervention-supported proof-state evidence or stronger.",
    );
  }

  if (
    (proof.admissionDisposition === "eligible" ||
      proof.admissionDisposition === "guarded") &&
    proof.blastRadiusDisposition !== "minimal" &&
    proof.blastRadiusDisposition !== "bounded"
  ) {
    errors.push(
      "Mutation-authorizing admission requires minimal or bounded blast radius.",
    );
  }

  if (
    proof.claimStrength === "proven-runtime" &&
    !proof.decisionBasis.runtimeEvidenceRevision?.trim()
  ) {
    errors.push(
      "proven-runtime repair proof requires a runtime evidence revision in decision basis.",
    );
  }

  if (
    proof.claimStrength === "proven-runtime" &&
    proof.effectiveEvidenceLevel !== "proven-with-observed-outcome"
  ) {
    errors.push(
      "proven-runtime claim requires proven-with-observed-outcome evidence.",
    );
  }

  if (
    proof.claimStrength === "proven-static" &&
    proof.effectiveEvidenceLevel !== "proven-dependency-violation"
  ) {
    errors.push(
      "proven-static claim requires proven-dependency-violation evidence.",
    );
  }

  if (
    (proof.admissionDisposition === "eligible" ||
      proof.admissionDisposition === "guarded") &&
    !proof.decisionBasis.contractRegistryRevision?.trim()
  ) {
    errors.push(
      "Mutation-authorizing proof requires contract registry revision.",
    );
  }

  if (
    (proof.admissionDisposition === "eligible" ||
      proof.admissionDisposition === "guarded") &&
    !proof.selectedCandidateId
  ) {
    errors.push(
      "Mutation-authorizing proof requires a selected root-cause candidate.",
    );
  }

  if (
    causalProofAtLeast(proof.proofState, "intervention-supported") &&
    proof.claimStrength !== "proven-runtime"
  ) {
    errors.push(
      "Intervention-supported or stronger causal proof requires proven-runtime claim strength.",
    );
  }

  if (
    proof.admissionDisposition === "eligible" ||
    proof.admissionDisposition === "guarded"
  ) {
    if (!proof.workflowAuthorityKind) {
      errors.push(
        "Mutation-authorizing proof requires explicit Approved Bug or intentional-modification workflow authority.",
      );
    }
    if (
      proof.workflowAuthorityKind === "approved-bug" &&
      !proof.approvedBugSemanticKey?.trim()
    ) {
      errors.push(
        "Approved bug repair proof requires approvedBugSemanticKey.",
      );
    }
    if (
      !Array.isArray(proof.mustChangeInvariantIds) ||
      proof.mustChangeInvariantIds.length === 0
    ) {
      errors.push(
        "Mutation-authorizing proof requires Must Change invariants.",
      );
    }
    if (
      !Array.isArray(proof.mustPreserveInvariantIds) ||
      proof.mustPreserveInvariantIds.length === 0
    ) {
      errors.push(
        "Mutation-authorizing proof requires Must Preserve invariants.",
      );
    }

    if (
      proof.preservationReadinessDisposition !== "ready" ||
      !proof.preservationContractId?.trim() ||
      !Array.isArray(proof.preservationBaselineEvidenceIds) ||
      proof.preservationBaselineEvidenceIds.length === 0
    ) {
      errors.push(
        "Mutation-authorizing proof requires ready preservation baseline evidence.",
      );
    }
    if (
      !proof.decisionBasis.preservationContractRevision?.trim() ||
      !proof.decisionBasis.preservationBaselineRevision?.trim()
    ) {
      errors.push(
        "Mutation-authorizing proof requires preservation contract and baseline revisions.",
      );
    }
  }

  return errors;
}
