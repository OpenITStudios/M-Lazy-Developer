import type { SemanticGraph } from "../../../graph/src/index.js";
import type { DiagnosticRepairDecision, DiagnosticClaimStrength } from "../../../project-model/src/index.js";
import type { InvariantRegistrySnapshot } from "../../../project-model/src/index.js";
import {
  validateInvariantRegistrySnapshot,
} from "../../../project-model/src/index.js";
import type { DecisionBasisRevision } from "../../../project-model/src/index.js";
import {
  patchTransactionSemanticFingerprint,
  type PatchTransaction,
} from "../../../repair/src/index.js";
import type { PreservationReadinessResult } from "../../../preservation/src/index.js";
import {
  evaluateRepairAdmissionPipeline,
  type RepairAdmissionPipelineResult,
} from "./repair-admission-pipeline.js";
import {
  decideRepairAdmission,
  type RepairAdmissionDecision,
} from "./repair-admission.js";
import type {
  RepairBlastRadiusPolicy,
} from "./repair-counterfactual-types.js";

export type RepairStrategyClass =
  | "implementation-repair"
  | "configuration-repair"
  | "compatibility-workaround"
  | "runtime-recovery-mitigation";

export interface RepairStrategyCausalBinding {
  interventionIds?: readonly string[];
  predicateIds?: readonly string[];
  factorIds?: readonly string[];
}

export interface RepairStrategyValidationObligations {
  invariantIds: readonly string[];
  runtimeExperimentIds: readonly string[];
  validationKinds: readonly string[];
}

export interface RepairStrategyPostTransformProof {
  hintId: string;
  family: string;
  proofFingerprint: string;
  semanticImpactFingerprint?: string;
  transactionId: string;
  transactionFingerprint: string;
}

export function repairStrategyPostTransformProofRevision(
  proof: RepairStrategyPostTransformProof | undefined,
): string | undefined {
  if (
    proof === undefined ||
    !proof.proofFingerprint.trim() ||
    !proof.semanticImpactFingerprint?.trim() ||
    !proof.transactionId.trim() ||
    !proof.transactionFingerprint.trim()
  ) {
    return undefined;
  }
  return (
    proof.transactionId +
    ":" +
    proof.transactionFingerprint +
    ":" +
    proof.proofFingerprint +
    ":" +
    proof.semanticImpactFingerprint
  );
}

export interface RepairStrategyCandidate {
  strategyId: string;
  transaction: PatchTransaction;
  changedNodeIds: readonly string[];
  supportingInvariantIds: readonly string[];
  addressesCandidateIds: readonly string[];
  repairClass?: RepairStrategyClass;
  causalBinding?: RepairStrategyCausalBinding;
  validationObligations?: RepairStrategyValidationObligations;
  postTransformProofRequired?: boolean;
  postTransformProof?: RepairStrategyPostTransformProof;
  reversible?: boolean;
  idempotent?: boolean;
  preservationReadiness?: PreservationReadinessResult;
}

export interface RepairStrategySelectionPolicy {
  invariantRegistry: InvariantRegistrySnapshot;
  requiredInvariantIds: readonly string[];
  allowGuarded?: boolean;
  blastRadiusPolicy?: RepairBlastRadiusPolicy;
  preservationReadiness?: PreservationReadinessResult;
  allowedRepairClasses?: readonly RepairStrategyClass[];
  preferReversible?: boolean;
  preferIdempotent?: boolean;
  decisionBasis?: Omit<
    DecisionBasisRevision,
    "sourceFingerprint" | "graphFingerprint" | "invariantRegistryRevision"
  >;
}

export interface RepairStrategyAssessment {
  strategyId: string;
  transactionId: string;
  admissible: boolean;
  reasons: readonly string[];
  pipeline: RepairAdmissionPipelineResult;
  selectionAdmission: RepairAdmissionDecision;
  metrics: {
    admissionRank: number;
    blastRadiusRank: number;
    affectedNodes: number;
    affectedPaths: number;
    sensitiveKinds: number;
    impactDepth: number;
    changedNodes: number;
    operations: number;
    preservationRiskRank: number;
    runtimeRetestBurden: number;
    reversibilityRank: number;
    idempotencyRank: number;
  };
  intelligence: {
    repairClass: RepairStrategyClass | "unspecified";
    causalBindingSatisfied: boolean;
    causalBindingReasons: readonly string[];
    authorizingRuntimeExperiments: readonly string[];
    validationObligations?: RepairStrategyValidationObligations;
    postTransformProofRequired: boolean;
    postTransformProof?: RepairStrategyPostTransformProof;
  };
}

export interface RepairStrategyRejectedAlternative {
  strategyId: string;
  disposition: "inadmissible" | "dominated";
  reasons: readonly string[];
  dominatedBy?: readonly string[];
}

export type RepairStrategySelection =
  | {
      status: "selected";
      selected: RepairStrategyAssessment;
      assessments: readonly RepairStrategyAssessment[];
      selectionRationale: readonly string[];
      rejectedAlternatives: readonly RepairStrategyRejectedAlternative[];
    }
  | {
      status: "ambiguous";
      tied: readonly RepairStrategyAssessment[];
      assessments: readonly RepairStrategyAssessment[];
      reasons: readonly string[];
    }
  | {
      status: "none-eligible";
      assessments: readonly RepairStrategyAssessment[];
      reasons: readonly string[];
    };

function claimRank(
  claim: DiagnosticClaimStrength,
): number {
  switch (claim) {
    case "hypothesis":
      return 0;
    case "corroborated":
      return 1;
    case "proven-static":
      return 2;
    case "proven-runtime":
      return 3;
  }
}

function admissionRank(
  disposition: RepairAdmissionPipelineResult["admission"]["disposition"],
): number {
  switch (disposition) {
    case "eligible":
      return 0;
    case "guarded":
      return 1;
    case "review-required":
      return 2;
    case "blocked":
      return 3;
  }
}

function blastRadiusRank(
  disposition: RepairAdmissionPipelineResult["blastRadius"]["disposition"],
): number {
  switch (disposition) {
    case "minimal":
      return 0;
    case "bounded":
      return 1;
    case "review-required":
      return 2;
    case "indeterminate":
      return 3;
    case "blocked":
      return 4;
  }
}

function declaredSet(
  values: readonly string[] | undefined,
): Set<string> {
  return new Set(values ?? []);
}

function causalBindingAssessment(
  diagnostic: DiagnosticRepairDecision,
  candidate: RepairStrategyCandidate,
): {
  satisfied: boolean;
  reasons: string[];
  interventionIds: string[];
} {
  const provenance =
    diagnostic.causalProof?.interventionProvenance ?? [];
  if (provenance.length === 0) {
    return {
      satisfied: true,
      reasons: [
        "Diagnostic has no controlled-intervention provenance requiring exact strategy binding.",
      ],
      interventionIds: [],
    };
  }

  const requiredInterventions = [
    ...new Set(provenance.map((item) => item.interventionId)),
  ].sort();
  const requiredPredicates = [
    ...new Set(
      provenance
        .map((item) => item.predicateId)
        .filter((value): value is string => Boolean(value)),
    ),
  ].sort();
  const requiredFactors = [
    ...new Set(
      provenance.flatMap(
        (item) => item.controlledFactorIds ?? [],
      ),
    ),
  ].sort();

  if (!candidate.causalBinding) {
    return {
      satisfied: false,
      reasons: [
        "Runtime-causal repair strategy is missing exact causalBinding metadata.",
      ],
      interventionIds: requiredInterventions,
    };
  }

  const interventions = declaredSet(
    candidate.causalBinding.interventionIds,
  );
  const predicates = declaredSet(
    candidate.causalBinding.predicateIds,
  );
  const factors = declaredSet(
    candidate.causalBinding.factorIds,
  );
  const reasons: string[] = [];

  const missingInterventions = requiredInterventions.filter(
    (id) => !interventions.has(id),
  );
  const missingPredicates = requiredPredicates.filter(
    (id) => !predicates.has(id),
  );
  const missingFactors = requiredFactors.filter(
    (id) => !factors.has(id),
  );

  if (missingInterventions.length > 0) {
    reasons.push(
      "Strategy causal binding is missing intervention(s): " +
        missingInterventions.join(", ") +
        ".",
    );
  }
  if (missingPredicates.length > 0) {
    reasons.push(
      "Strategy causal binding is missing predicate(s): " +
        missingPredicates.join(", ") +
        ".",
    );
  }
  if (missingFactors.length > 0) {
    reasons.push(
      "Strategy causal binding is missing controlled factor(s): " +
        missingFactors.join(", ") +
        ".",
    );
  }

  return {
    satisfied: reasons.length === 0,
    reasons:
      reasons.length === 0
        ? [
            "Strategy causal binding covers the full controlled-intervention provenance.",
          ]
        : reasons,
    interventionIds: requiredInterventions,
  };
}

function preservationRiskRank(
  pipeline: RepairAdmissionPipelineResult,
): number {
  const sensitive =
    pipeline.blastRadius.sensitiveKinds.length;
  const revalidation =
    pipeline.impact.affectedNodeIds.length +
    pipeline.impact.affectedPaths.length;
  return sensitive * 100 + revalidation;
}

function coversRequiredInvariants(
  actual: readonly string[],
  required: readonly string[],
): boolean {
  const set = new Set(actual);
  return required.every((id) => set.has(id));
}

function metricVector(
  item: RepairStrategyAssessment,
): readonly number[] {
  return [
    item.metrics.admissionRank,
    item.metrics.blastRadiusRank,
    item.metrics.sensitiveKinds,
    item.metrics.affectedNodes,
    item.metrics.affectedPaths,
    item.metrics.impactDepth,
    item.metrics.preservationRiskRank,
    item.metrics.runtimeRetestBurden,
    item.metrics.reversibilityRank,
    item.metrics.idempotencyRank,
    item.metrics.changedNodes,
    item.metrics.operations,
  ];
}

const METRIC_LABELS = [
  "admission",
  "blast-radius",
  "sensitive-kinds",
  "affected-nodes",
  "affected-paths",
  "impact-depth",
  "preservation-risk",
  "runtime-retest-burden",
  "reversibility",
  "idempotency",
  "changed-nodes",
  "operations",
] as const;

function dominanceReasons(
  winner: RepairStrategyAssessment,
  loser: RepairStrategyAssessment,
): string[] {
  const a = metricVector(winner);
  const b = metricVector(loser);
  return METRIC_LABELS.flatMap((label, index) =>
    a[index]! < b[index]!
      ? [
          label +
            " improves from " +
            b[index] +
            " to " +
            a[index] +
            ".",
        ]
      : []
  );
}

function dominates(
  left: RepairStrategyAssessment,
  right: RepairStrategyAssessment,
): boolean {
  const a = metricVector(left);
  const b = metricVector(right);
  let strictlyBetter = false;

  for (let index = 0; index < a.length; index += 1) {
    if (a[index]! > b[index]!) return false;
    if (a[index]! < b[index]!) strictlyBetter = true;
  }

  return strictlyBetter;
}

export function selectRepairStrategy(
  graph: SemanticGraph,
  diagnostic: DiagnosticRepairDecision,
  candidates: readonly RepairStrategyCandidate[],
  policy: RepairStrategySelectionPolicy,
): RepairStrategySelection {
  const registryErrors = validateInvariantRegistrySnapshot(
    policy.invariantRegistry,
  );
  if (registryErrors.length > 0) {
    throw new Error(
      "Invalid invariant registry for repair strategy selection: " +
        registryErrors.join("; "),
    );
  }

  const strategyIds = new Set<string>();
  const transactionIds = new Set<string>();
  for (const candidate of candidates) {
    if (strategyIds.has(candidate.strategyId)) {
      throw new Error(
        "Duplicate repair strategy id: " + candidate.strategyId,
      );
    }
    if (transactionIds.has(candidate.transaction.id)) {
      throw new Error(
        "Repair strategies must not alias the same patch transaction: " +
          candidate.transaction.id,
      );
    }
    strategyIds.add(candidate.strategyId);
    transactionIds.add(candidate.transaction.id);
  }

  const requiredInvariantIds =
    [...new Set(policy.requiredInvariantIds)].sort();

  if (requiredInvariantIds.length === 0) {
    throw new Error(
      "Repair strategy selection requires at least one required invariant.",
    );
  }

  const registryById = new Map(
    policy.invariantRegistry.entries.map((entry) => [
      entry.id,
      entry,
    ]),
  );

  const missingRequired = requiredInvariantIds.filter(
    (id) => !registryById.has(id),
  );
  if (missingRequired.length > 0) {
    throw new Error(
      "Required repair invariant is not present in invariant registry: " +
        missingRequired.join(", "),
    );
  }

  const requiredInvariantIssues: string[] = [];
  for (const id of requiredInvariantIds) {
    const invariant = registryById.get(id)!;
    if (invariant.enforcement === "diagnostic-only") {
      requiredInvariantIssues.push(
        "Required invariant " + id +
          " is diagnostic-only and cannot authorize automatic strategy selection.",
      );
    }
    if (
      claimRank(diagnostic.claimStrength) <
      claimRank(invariant.minimumRepairClaim)
    ) {
      requiredInvariantIssues.push(
        "Diagnostic claim strength " +
          diagnostic.claimStrength +
          " is below invariant minimum " +
          invariant.minimumRepairClaim +
          " for " +
          id +
          ".",
      );
    }
  }

  const assessments = candidates
    .map((candidate): RepairStrategyAssessment => {
      const causalBinding =
        causalBindingAssessment(
          diagnostic,
          candidate,
        );
      const repairClassAllowed =
        candidate.repairClass === undefined ||
        policy.allowedRepairClasses === undefined ||
        policy.allowedRepairClasses.includes(
          candidate.repairClass,
        );

      const pipeline = evaluateRepairAdmissionPipeline({
        graph,
        transaction: candidate.transaction,
        diagnostic,
        changedNodeIds: candidate.changedNodeIds,
        supportingInvariantIds:
          candidate.supportingInvariantIds,
        decisionBasis: {
          ...(policy.decisionBasis ?? {}),
          invariantRegistryRevision:
            policy.invariantRegistry.revision,
          ...(repairStrategyPostTransformProofRevision(
            candidate.postTransformProof,
          ) === undefined
            ? {}
            : {
                postTransformProofRevision:
                  repairStrategyPostTransformProofRevision(
                    candidate.postTransformProof,
                  )!,
              }),
        },
        ...(policy.blastRadiusPolicy === undefined
          ? {}
          : { blastRadiusPolicy: policy.blastRadiusPolicy }),
        ...(
          candidate.preservationReadiness !== undefined
            ? {
                preservationReadiness:
                  candidate.preservationReadiness,
              }
            : policy.preservationReadiness !== undefined &&
              policy.preservationReadiness.transactionId ===
                candidate.transaction.id
            ? {
                preservationReadiness:
                  policy.preservationReadiness,
              }
            : {}
        ),
        ...(candidate.postTransformProof === undefined
          ? {}
          : {
              postTransformProofBinding: {
                transactionId:
                  candidate.postTransformProof.transactionId,
                transactionFingerprint:
                  candidate.postTransformProof.transactionFingerprint,
              },
            }),
      });

      const selectionAdmission =
        decideRepairAdmission(
          candidate.transaction,
          diagnostic,
          pipeline.blastRadius,
        );

      const reasons: string[] = [
        "Strategy selection evaluates causal fit, semantic blast radius, preservation risk, reversibility, idempotency, and retest burden before mutation authorization.",
        ...causalBinding.reasons,
        ...(repairClassAllowed
          ? []
          : [
              "Strategy repair class is not allowed by the current selection policy: " +
                candidate.repairClass +
                ".",
            ]),
        ...(pipeline.admission.disposition === "blocked" &&
        selectionAdmission.disposition !== "blocked"
          ? [
              "This strategy may be selected as the best proposal, but mutation remains blocked until preservation readiness and proof authorization are complete.",
            ]
          : []),
      ];

      if (
        candidate.preservationReadiness !== undefined &&
        candidate.preservationReadiness.transactionId !==
          candidate.transaction.id
      ) {
        reasons.push(
          "Strategy preservation readiness belongs to a different patch transaction.",
        );
      }

      if (
        candidate.preservationReadiness === undefined &&
        policy.preservationReadiness !== undefined &&
        policy.preservationReadiness.transactionId !==
          candidate.transaction.id
      ) {
        reasons.push(
          "Policy-level preservation readiness was not applied because it belongs to a different patch transaction.",
        );
      }

      const addressesSelectedCandidate =
        diagnostic.selectedCandidateId !== undefined &&
        candidate.addressesCandidateIds.includes(
          diagnostic.selectedCandidateId,
        );
      if (!addressesSelectedCandidate) {
        reasons.push(
          diagnostic.selectedCandidateId === undefined
            ? "Diagnostic decision has no selected root-cause candidate."
            : "Strategy does not address the selected root-cause candidate: " +
                diagnostic.selectedCandidateId +
                ".",
        );
      }

      const unknownSupportingInvariantIds =
        candidate.supportingInvariantIds.filter(
          (id) => !registryById.has(id),
        );
      if (unknownSupportingInvariantIds.length > 0) {
        reasons.push(
          "Strategy references invariant(s) outside the active registry: " +
            unknownSupportingInvariantIds.sort().join(", ") +
            ".",
        );
      }

      const invariantCoverage =
        requiredInvariantIssues.length === 0 &&
        unknownSupportingInvariantIds.length === 0 &&
        coversRequiredInvariants(
          candidate.supportingInvariantIds,
          requiredInvariantIds,
        );
      if (requiredInvariantIssues.length > 0) {
        reasons.push(...requiredInvariantIssues);
      }
      if (
        requiredInvariantIssues.length === 0 &&
        !invariantCoverage
      ) {
        reasons.push(
          "Strategy does not cover every required supporting invariant.",
        );
      }

      const transactionFingerprint =
        patchTransactionSemanticFingerprint(
          candidate.transaction,
        );
      const postTransformProofSatisfied =
        candidate.postTransformProofRequired !== true ||
        (
          candidate.postTransformProof !== undefined &&
          candidate.postTransformProof.proofFingerprint.trim().length > 0 &&
          (
            candidate.postTransformProof.semanticImpactFingerprint?.trim().length ??
            0
          ) > 0 &&
          candidate.postTransformProof.transactionId ===
            candidate.transaction.id &&
          candidate.postTransformProof.transactionFingerprint ===
            transactionFingerprint
        );
      if (!postTransformProofSatisfied) {
        reasons.push(
          "Strategy requires post-transform guard and semantic-impact proofs bound to the exact selected patch transaction before selection.",
        );
      }

      if (candidate.transaction.validation.length === 0) {
        reasons.push(
          "Strategy has no concrete post-mutation validation step.",
        );
      }

      const admissionAllowed =
        selectionAdmission.disposition === "eligible" ||
        (
          selectionAdmission.disposition === "guarded" &&
          policy.allowGuarded === true
        );

      if (!admissionAllowed) {
        reasons.push(
          "Repair admission disposition is not selectable under the current strategy policy: " +
            selectionAdmission.disposition +
            ".",
        );
      }

      return {
        strategyId: candidate.strategyId,
        transactionId: candidate.transaction.id,
        admissible:
          addressesSelectedCandidate &&
          causalBinding.satisfied &&
          repairClassAllowed &&
          invariantCoverage &&
          postTransformProofSatisfied &&
          candidate.transaction.validation.length > 0 &&
          (
            candidate.preservationReadiness === undefined ||
            candidate.preservationReadiness.transactionId ===
              candidate.transaction.id
          ) &&
          admissionAllowed,
        reasons,
        pipeline,
        selectionAdmission,
        metrics: {
          admissionRank: admissionRank(
            selectionAdmission.disposition,
          ),
          blastRadiusRank: blastRadiusRank(
            pipeline.blastRadius.disposition,
          ),
          affectedNodes:
            pipeline.impact.affectedNodeIds.length,
          affectedPaths:
            pipeline.impact.affectedPaths.length,
          sensitiveKinds:
            pipeline.blastRadius.sensitiveKinds.length,
          impactDepth: pipeline.impact.maxImpactDepth,
          preservationRiskRank:
            preservationRiskRank(pipeline),
          runtimeRetestBurden:
            causalBinding.interventionIds.length +
            pipeline.impact.affectedNodeIds.length +
            pipeline.impact.affectedPaths.length,
          reversibilityRank:
            policy.preferReversible === false
              ? 0
              : candidate.reversible === true
                ? 0
                : candidate.reversible === false
                  ? 2
                  : 1,
          idempotencyRank:
            policy.preferIdempotent === false
              ? 0
              : candidate.idempotent === true
                ? 0
                : candidate.idempotent === false
                  ? 2
                  : 1,
          changedNodes: candidate.changedNodeIds.length,
          operations: candidate.transaction.operations.length,
        },
        intelligence: {
          repairClass:
            candidate.repairClass ?? "unspecified",
          causalBindingSatisfied:
            causalBinding.satisfied,
          causalBindingReasons:
            causalBinding.reasons,
          authorizingRuntimeExperiments:
            causalBinding.interventionIds,
          ...(candidate.validationObligations === undefined
            ? {}
            : {
                validationObligations:
                  candidate.validationObligations,
              }),
          postTransformProofRequired:
            candidate.postTransformProofRequired === true,
          ...(candidate.postTransformProof === undefined
            ? {}
            : {
                postTransformProof:
                  candidate.postTransformProof,
              }),
        },
      };
    })
    .sort((a, b) => a.strategyId.localeCompare(b.strategyId));

  const admissible = assessments.filter(
    (assessment) => assessment.admissible,
  );

  if (admissible.length === 0) {
    return {
      status: "none-eligible",
      assessments,
      reasons: [
        "No repair strategy satisfies diagnostic authorization, invariant coverage, validation, and blast-radius policy.",
      ],
    };
  }

  const frontier = admissible.filter(
    (candidate) =>
      !admissible.some(
        (other) =>
          other !== candidate &&
          dominates(other, candidate),
      ),
  );

  if (frontier.length > 1) {
    return {
      status: "ambiguous",
      tied: frontier,
      assessments,
      reasons: [
        "Multiple repair strategies remain on the non-dominated Pareto frontier.",
        "No strategy is better or equal on every safety/impact dimension while being strictly better on at least one.",
        "Human review or an additional explicit policy criterion is required.",
      ],
    };
  }

  const selected = frontier[0]!;
  const rejectedAlternatives:
    RepairStrategyRejectedAlternative[] =
      assessments
        .filter(
          (assessment) =>
            assessment.strategyId !==
              selected.strategyId,
        )
        .map((assessment) => {
          if (!assessment.admissible) {
            return {
              strategyId: assessment.strategyId,
              disposition: "inadmissible" as const,
              reasons: assessment.reasons,
            };
          }

          const dominators = admissible
            .filter(
              (other) =>
                other.strategyId !==
                  assessment.strategyId &&
                dominates(other, assessment),
            )
            .map((other) => other.strategyId)
            .sort();

          return {
            strategyId: assessment.strategyId,
            disposition: "dominated" as const,
            reasons:
              dominators.includes(
                selected.strategyId,
              )
                ? dominanceReasons(
                    selected,
                    assessment,
                  )
                : [
                    "Strategy is outside the final non-dominated frontier.",
                  ],
            ...(dominators.length === 0
              ? {}
              : { dominatedBy: dominators }),
          };
        })
        .sort((a, b) =>
          a.strategyId.localeCompare(b.strategyId)
        );

  const smallerRawRejected =
    rejectedAlternatives.filter((item) => {
      const assessment = assessments.find(
        (candidate) =>
          candidate.strategyId === item.strategyId,
      );
      if (!assessment) return false;
      return (
        assessment.metrics.changedNodes <
          selected.metrics.changedNodes ||
        assessment.metrics.operations <
          selected.metrics.operations
      );
    });

  return {
    status: "selected",
    selected,
    assessments,
    selectionRationale: [
      "Selected strategy is the only admissible strategy on the Pareto frontier across causal fit, admission, semantic impact, preservation risk, retest burden, reversibility, idempotency, and mutation size.",
      ...(smallerRawRejected.length === 0
        ? []
        : [
            "A smaller raw mutation existed but was rejected for non-size reasons: " +
              smallerRawRejected
                .map((item) =>
                  item.strategyId +
                  " (" +
                  item.disposition +
                  ")"
                )
                .join(", ") +
              ".",
          ]),
    ],
    rejectedAlternatives,
  };
}
