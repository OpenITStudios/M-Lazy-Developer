import {
  buildBugReportFromApprovedBugSet,
  compileBugTrigger,
  reviewTesterReproductionSteps,
  projectProposedBugSet,
  deriveConfirmedDefectSemanticKey,
  deriveRepairUnitIdsFromSourceEvidence,
  type ConfirmedDefect,
  type ConfirmedDefectGroupResolution,
  type PromoteConfirmedBugsResult,
  type ProposedBugSet,
  type ApprovedBugSet,
  type BugReportV2Map,
  type BugReportV2RepairBy,
  type BugTriggerDraft,
  type BugReportV2ReproductionProvenance,
} from "../../../bug-report/src/index.js";
import {
  buildContradictionRegistry,
  renderEngineeringAnalysis,
  type ContradictionRegistry,
  type IntentDiagnosticGateResult,
  type IntentDiagnosticNextEvidenceNeed,
} from "../../../diagnostic-reasoning/src/index.js";
import type {
  GameplayIntentModel,
  GameplayModelClosureResult,
} from "../../../gameplay-intent/src/index.js";
import type {
  GameplayIntentRuntimeAssessment,
} from "../inspection/gameplay-intent-runtime-stage.js";
import type {
  InspectionEngineeringAnalysis,
} from "../inspection/engineering-analysis-stage.js";
import type {
  GameplayDiscoveryClosure,
} from "../inspection/gameplay-discovery-closure.js";
import type {
  GameplayScenarioClosure,
} from "../inspection/gameplay-scenario-model.js";
import type {
  GameplayDefectResolutionGate,
} from "../inspection/gameplay-defect-resolution.js";
import type {
  MandatoryAuditProcedureReceipt,
} from "../inspection/mandatory-audit-procedure.js";
import {
  assessSelectedMapAuditAdmission,
} from "../map-audit-admission.js";
import {
  selectedMapAuditAuthorityIssues,
  type SelectedMapAuditAuthority,
} from "../map-audit-authority.js";
import type {
  RuntimeExperimentDefinition,
} from "../../../runtime-lab/src/index.js";
import type {
  RuntimeExperimentDiagnosticBridge,
} from "../diagnosis/runtime-experiment-diagnostic-evidence.js";
import type {
  DiagnosticFinding,
} from "../../../diagnostics/src/index.js";
import type {
  SemanticIr,
} from "../../../semantic-ir/src/index.js";
import {
  sourceRefHasPreciseLocation,
  type DiagnosticRepairDecision,
  type FileInventoryEntry,
  type InvariantRegistrySnapshot,
} from "../../../project-model/src/index.js";
import type {
  RepairInvariantDerivation,
} from "../repair/repair-invariant-derivation.js";
import {
  applyReportRepairContext,
} from "./report-repair-context.js";
import {
  deriveReportDefectClassification,
  type ReportDefectClassificationSignals,
} from "./report-defect-classification.js";
import {
  derivePrimaryFailureSignalsFromDiagnostics,
} from "./report-classification-producers.js";
import {
  deriveReportClassificationFromRuntimeExperiment,
} from "./report-runtime-classification.js";
import {
  bindSourceEvidenceSemanticOwners,
} from "./report-source-owner.js";
import {
  confirmGameplayIntentRuntimeDefectForReport,
} from "./report-confirmation-adapter.js";
import {
  confirmStaticIntentDefectForReport,
} from "./static-report-confirmation-adapter.js";
import {
  confirmTesterDefectForReport,
  type TesterDefectConfirmationInput,
} from "./tester-report-confirmation-adapter.js";

/**
 * Evidence origin used by downstream confirmation adapters.
 * This is NOT an alternate audit workflow lane; every candidate must originate
 * from the canonical selected-map audit and report continuation.
 */
export type AuditReportEvidenceRoute =
  | "runtime"
  | "static"
  | "tester";

export type ConfirmedDefectDraft = Omit<
  ConfirmedDefect,
  | "semanticKey"
  | "subjectIds"
  | "foundBy"
  | "confirmation"
  | "mustPreserve"
  | "repairUnitIds"
  | "impact"
  | "primaryFailure"
  | "expected"
  | "observed"
  | "reproductionProvenance"
> & {
  // Only the validated BugTrigger compiler may supply persisted provenance.
  readonly reproductionProvenance?: never;
  readonly expectedStatement?: string;
  readonly observedStatement: string;
  readonly classificationSignals:
    ReportDefectClassificationSignals;
};

export type AiConfirmedDefectDraft = Omit<
  ConfirmedDefectDraft,
  | "brokenInvariantIds"
  | "expectedStatement"
  | "reproduction"
> & {
  readonly expectedStatement: string;
  readonly reproduction?: never;
};

export interface ReportCandidateRepairContext {
  readonly decision?: DiagnosticRepairDecision;
  readonly invariantDerivation?: RepairInvariantDerivation;
  readonly invariantRegistry?: InvariantRegistrySnapshot;
}

export interface RuntimeReportCandidate {
  readonly route: "runtime"; // evidence origin only
  /** @deprecated Use scenarioCausalLinkIds. */
  readonly scenarioCausalLinkId?: string;
  readonly scenarioCausalLinkIds?: readonly string[];
  readonly bugTrigger?: BugTriggerDraft;
  readonly intent: GameplayIntentModel;
  readonly assessment: GameplayIntentRuntimeAssessment;
  readonly runtimeExperimentClassification?: {
    readonly definition: RuntimeExperimentDefinition;
    readonly bridge: RuntimeExperimentDiagnosticBridge;
  };
  readonly semanticIr?: SemanticIr;
  readonly classificationDiagnostics?:
    readonly DiagnosticFinding[];
  readonly defect: AiConfirmedDefectDraft;
  readonly repairContext?: ReportCandidateRepairContext;
}

export interface StaticReportCandidate {
  readonly route: "static"; // evidence origin only
  /** @deprecated Use scenarioCausalLinkIds. */
  readonly scenarioCausalLinkId?: string;
  readonly scenarioCausalLinkIds?: readonly string[];
  readonly bugTrigger?: BugTriggerDraft;
  readonly intent: GameplayIntentModel;
  readonly result: IntentDiagnosticGateResult;
  readonly semanticIr?: SemanticIr;
  readonly classificationDiagnostics?:
    readonly DiagnosticFinding[];
  readonly defect: AiConfirmedDefectDraft;
  readonly repairContext?: ReportCandidateRepairContext;
}

export interface TesterReportCandidate {
  readonly route: "tester"; // evidence origin only
  /** @deprecated Use scenarioCausalLinkIds. */
  readonly scenarioCausalLinkId?: string;
  readonly scenarioCausalLinkIds?: readonly string[];
  readonly subjectIds: readonly string[];
  readonly confirmation: TesterDefectConfirmationInput;
  readonly semanticIr?: SemanticIr;
  readonly classificationDiagnostics?:
    readonly DiagnosticFinding[];
  readonly defect: ConfirmedDefectDraft;
  readonly repairContext?: ReportCandidateRepairContext;
}

export type AuditReportCandidate =
  | RuntimeReportCandidate
  | StaticReportCandidate
  | TesterReportCandidate;

/**
 * Candidate.route is retained for compatibility but semantically means
 * evidenceRoute. It must never be used to branch the production audit flow.
 */

export type ReportCandidateNextEvidenceNeed =
  | IntentDiagnosticNextEvidenceNeed
  | "tester-reproduction"
  | "expected-behavior-evidence"
  | "repair-decision"
  | "candidate-correction";

export interface RejectedReportCandidate {
  readonly route: AuditReportCandidate["route"];
  readonly semanticKey: string;
  readonly evidenceIds: readonly string[];
  readonly nextEvidenceNeed: ReportCandidateNextEvidenceNeed;
  readonly reasons: readonly string[];
}

export interface ConfirmedDefectCollection {
  readonly confirmed: readonly ConfirmedDefect[];
  readonly rejected: readonly RejectedReportCandidate[];
  readonly contradictionRegistry?:
    ContradictionRegistry;
}

export interface AuditReportCandidateDescriptor {
  /** Canonical name. This is evidence provenance, never an audit workflow lane. */
  readonly evidenceRoute: AuditReportEvidenceRoute;
  /** @deprecated Compatibility alias for evidenceRoute. */
  readonly route: AuditReportCandidate["route"];
  readonly semanticKey: string;
  readonly evidenceIds: readonly string[];
  readonly nextEvidenceNeed: ReportCandidateNextEvidenceNeed;
}

function candidateExpectedBasis(
  candidate: AuditReportCandidate,
): ConfirmedDefect["expected"] {
  if (candidate.route === "tester") {
    return {
      authority:
        candidate.confirmation.expectedBehaviorAuthority,
      statement:
        candidate.confirmation.expectedStatement,
      evidenceIds: [
        ...new Set(
          candidate.confirmation.expectedEvidenceIds,
        ),
      ].sort(),
    };
  }

  const basisIds = new Set(
    candidate.route === "runtime"
      ? candidate.assessment.result.basisInvariantIds
      : candidate.result.basisInvariantIds,
  );
  const invariants = candidate.intent.invariants
    .filter((invariant) =>
      basisIds.has(invariant.id) &&
      invariant.status === "authored"
    );

  return {
    authority: "selected-artifact",
    statement: candidate.defect.expectedStatement,
    evidenceIds: [
      ...new Set(
        invariants.flatMap(
          (invariant) => invariant.evidenceIds,
        ),
      ),
    ].sort(),
  };
}

function candidateObservedBasis(
  candidate: AuditReportCandidate,
): ConfirmedDefect["observed"] {
  const evidenceIds =
    candidate.route === "runtime"
      ? [
          candidate.assessment.outcomeObservation.evidenceId,
          ...candidate.assessment.result.evidenceIds,
        ]
      : candidate.route === "static"
        ? candidate.result.evidenceIds
        : candidate.confirmation.observationEvidenceIds;

  return {
    statement: candidate.defect.observedStatement,
    evidenceIds: [
      ...new Set(
        evidenceIds.filter(
          (id) => id.trim().length > 0,
        ),
      ),
    ].sort(),
  };
}

function candidateEvidenceUniverse(
  candidate: AuditReportCandidate,
): readonly string[] {
  const expected = candidateExpectedBasis(candidate);
  const observed = candidateObservedBasis(candidate);
  const values = [
    ...expected.evidenceIds,
    ...observed.evidenceIds,
    ...(candidate.classificationDiagnostics ?? [])
      .map((finding) => finding.id),
  ];

  return [
    ...new Set(
      values.filter(
        (value) => value.trim().length > 0,
      ),
    ),
  ].sort();
}

function runtimeClassificationSignals(
  candidate: AuditReportCandidate,
) {
  if (
    candidate.route !== "runtime" ||
    candidate.runtimeExperimentClassification === undefined
  ) {
    return {
      impact: [],
      primaryFailure: [],
    } as const;
  }

  try {
    return deriveReportClassificationFromRuntimeExperiment(
      candidate.runtimeExperimentClassification.definition,
      candidate.runtimeExperimentClassification.bridge,
    );
  } catch {
    return {
      impact: [],
      primaryFailure: [],
    } as const;
  }
}

function candidateClassification(
  candidate: AuditReportCandidate,
) {
  const diagnosticSignals =
    derivePrimaryFailureSignalsFromDiagnostics(
      candidate.classificationDiagnostics ?? [],
    ).signals;
  const runtimeSignals =
    runtimeClassificationSignals(candidate);

  return deriveReportDefectClassification({
    impact: [
      ...candidate.defect.classificationSignals.impact,
      ...runtimeSignals.impact,
    ],
    primaryFailure: [
      ...candidate.defect.classificationSignals
        .primaryFailure,
      ...diagnosticSignals,
      ...runtimeSignals.primaryFailure,
    ],
  });
}

function classificationIssues(
  candidate: AuditReportCandidate,
): readonly string[] {
  const classification =
    candidateClassification(candidate);
  if (!classification.ok) {
    return classification.reasons;
  }

  const universe = new Set(
    candidateEvidenceUniverse(candidate),
  );
  const errors: string[] = [];

  for (const evidenceId of [
    ...classification.impactEvidenceIds,
    ...classification.primaryFailureEvidenceIds,
  ]) {
    if (!universe.has(evidenceId)) {
      errors.push(
        "Classification evidence is not part of the confirmed defect evidence universe: " +
          evidenceId +
          ".",
      );
    }
  }

  return [...new Set(errors)];
}

function runtimeClassificationIssues(
  candidate: AuditReportCandidate,
): readonly string[] {
  if (
    candidate.route !== "runtime" ||
    candidate.runtimeExperimentClassification === undefined
  ) {
    return [];
  }

  let derived;
  try {
    derived =
      deriveReportClassificationFromRuntimeExperiment(
        candidate.runtimeExperimentClassification.definition,
        candidate.runtimeExperimentClassification.bridge,
      );
  } catch (error) {
    return [
      error instanceof Error
        ? error.message
        : String(error),
    ];
  }

  const classificationEvidence = [
    ...derived.impact.flatMap(
      (signal) => signal.evidenceIds,
    ),
    ...derived.primaryFailure.flatMap(
      (signal) => signal.evidenceIds,
    ),
  ];
  if (classificationEvidence.length === 0) {
    return [];
  }

  const confirmationEvidence = new Set([
    candidate.assessment.outcomeObservation.evidenceId,
    ...candidate.assessment.result.evidenceIds,
  ]);

  if (
    !classificationEvidence.some(
      (id) => confirmationEvidence.has(id),
    )
  ) {
    return [
      "Runtime classification evidence is not part of the confirmation evidence for this defect.",
    ];
  }

  return [];
}

function candidateSubjectIds(
  candidate: AuditReportCandidate,
): readonly string[] {
  if (candidate.route === "runtime") {
    return candidate.assessment.result.subjectIds;
  }
  if (candidate.route === "static") {
    return candidate.result.subjectIds;
  }
  return candidate.subjectIds;
}

function candidateBrokenInvariantIds(
  candidate: AuditReportCandidate,
): readonly string[] {
  if (candidate.route === "runtime") {
    return candidate.assessment.result.basisInvariantIds;
  }
  if (candidate.route === "static") {
    return candidate.result.basisInvariantIds;
  }
  return candidate.defect.brokenInvariantIds;
}

function candidateSourceEvidence(
  candidate: AuditReportCandidate,
) {
  return bindSourceEvidenceSemanticOwners(
    candidate.defect.sourceEvidence,
    candidate.semanticIr,
  );
}

function semanticOwnerIssues(
  candidate: AuditReportCandidate,
): readonly string[] {
  const owners = [
    ...new Set(
      (candidateSourceEvidence(candidate) ?? [])
        .map((item) => item.semanticOwnerId?.trim())
        .filter(
          (value): value is string =>
            typeof value === "string" &&
            value.length > 0,
        ),
    ),
  ];

  if (owners.length === 0) return [];
  if (candidate.semanticIr === undefined) {
    return [
      "Semantic owner evidence requires Semantic IR for validation.",
    ];
  }

  const known = new Set(
    candidate.semanticIr.execution.regions.map(
      (region) => region.id,
    ),
  );

  return owners
    .filter((owner) => !known.has(owner))
    .map(
      (owner) =>
        "Source evidence semanticOwnerId is not present in Semantic IR: " +
        owner +
        ".",
    );
}

function candidateRepairUnitIds(
  candidate: AuditReportCandidate,
): readonly string[] {
  return deriveRepairUnitIdsFromSourceEvidence(
    candidateSourceEvidence(candidate),
  );
}

function preclassificationCandidateKey(
  candidate: AuditReportCandidate,
): string {
  const failures = [
    ...new Set(
      candidate.defect.classificationSignals
        .primaryFailure
        .map((signal) => signal.failure),
    ),
  ].sort();

  return [
    "candidate",
    "subjects=" +
      [...new Set(candidateSubjectIds(candidate))].sort().join(","),
    "invariants=" +
      [...new Set(candidateBrokenInvariantIds(candidate))].sort().join(","),
    "failures=" + failures.join(","),
    candidate.defect.causalIncidentId === undefined
      ? undefined
      : "incident=" + candidate.defect.causalIncidentId,
  ]
    .filter(
      (value): value is string =>
        value !== undefined,
    )
    .join("|");
}

function candidateSemanticKey(
  candidate: AuditReportCandidate,
): string {
  const classification =
    candidateClassification(candidate);

  if (!classification.ok) {
    return preclassificationCandidateKey(candidate);
  }

  return deriveConfirmedDefectSemanticKey({
    subjectIds: candidateSubjectIds(candidate),
    brokenInvariantIds:
      candidateBrokenInvariantIds(candidate),
    primaryFailure:
      classification.primaryFailure,
    ...(candidate.defect.causalIncidentId === undefined
      ? {}
      : {
          causalIncidentId:
            candidate.defect.causalIncidentId,
        }),
  });
}

function candidateEvidenceIds(
  candidate: AuditReportCandidate,
): readonly string[] {
  return candidateEvidenceUniverse(candidate);
}

function routeNextEvidenceNeed(
  candidate: AuditReportCandidate,
): ReportCandidateNextEvidenceNeed {
  if (candidate.route === "runtime") {
    if (candidate.assessment.result.nextEvidenceNeed !== "none") {
      return candidate.assessment.result.nextEvidenceNeed;
    }
    if (candidate.bugTrigger === undefined) return "tester-reproduction";
    return aiBugTrigger(candidate).issues.length > 0
      ? "candidate-correction" : "none";
  }
  if (candidate.route === "static") {
    if (candidate.result.nextEvidenceNeed !== "none") {
      return candidate.result.nextEvidenceNeed;
    }
    if (candidate.bugTrigger === undefined) return "tester-reproduction";
    return aiBugTrigger(candidate).issues.length > 0
      ? "candidate-correction" : "none";
  }
  if (
    !candidate.confirmation.expectedStatement.trim() ||
    candidate.confirmation.expectedEvidenceIds.length === 0
  ) {
    return "expected-behavior-evidence";
  }
  if (
    !candidate.confirmation.reproduced ||
    candidate.confirmation.observationEvidenceIds.length === 0
  ) {
    return "tester-reproduction";
  }
  return reviewTesterReproductionSteps(
    candidate.defect.reproduction, "reproduction",
  ).length > 0 ? "tester-reproduction" : "none";
}

export function describeAuditReportCandidate(
  candidate: AuditReportCandidate,
): AuditReportCandidateDescriptor {
  return {
    evidenceRoute: candidate.route,
    route: candidate.route,
    semanticKey: candidateSemanticKey(candidate),
    evidenceIds: candidateEvidenceIds(candidate),
    nextEvidenceNeed: routeNextEvidenceNeed(candidate),
  };
}

function rejectedCandidate(
  candidate: AuditReportCandidate,
  reasons: readonly string[],
  nextEvidenceNeed:
    ReportCandidateNextEvidenceNeed =
      routeNextEvidenceNeed(candidate),
): RejectedReportCandidate {
  const descriptor =
    describeAuditReportCandidate(candidate);
  return {
    route: descriptor.route,
    semanticKey: descriptor.semanticKey,
    evidenceIds: descriptor.evidenceIds,
    nextEvidenceNeed,
    reasons,
  };
}

function earlyRejectedCandidate(
  candidate: AuditReportCandidate,
  reasons: readonly string[],
): RejectedReportCandidate {
  return {
    route: candidate.route,
    semanticKey:
      preclassificationCandidateKey(
        candidate,
      ),
    evidenceIds:
      candidateEvidenceIds(candidate),
    nextEvidenceNeed:
      routeNextEvidenceNeed(candidate),
    reasons,
  };
}

function aiBugTrigger(
  candidate: RuntimeReportCandidate | StaticReportCandidate,
): {
  readonly steps?: readonly string[];
  readonly reproductionProvenance?: BugReportV2ReproductionProvenance;
  readonly issues: readonly string[];
} {
  if (candidate.bugTrigger === undefined) {
    return { issues: [] };
  }

  const compiled = compileBugTrigger(candidate.bugTrigger);
  if (!compiled.ok) {
    return {
      issues: compiled.issues.map(
        (issue) => issue.message,
      ),
    };
  }

  const universe = new Set(
    candidateEvidenceUniverse(candidate),
  );
  const unrelated = compiled.evidenceIds
    .filter((id) => !universe.has(id));

  if (unrelated.length > 0) {
    return {
      issues: [
        "Bug Trigger evidence is not part of the confirmed defect evidence universe: " +
          unrelated.join(", ") +
          ".",
      ],
    };
  }

  if (
    candidate.route === "static" &&
    compiled.gameplayBasis !== "authored-gameplay"
  ) {
    return {
      issues: [
        "Static AI Bug Trigger must be grounded in authored gameplay intent.",
      ],
    };
  }

  if (
    candidate.route === "runtime" &&
    compiled.gameplayBasis === "tester-gameplay"
  ) {
    return {
      issues: [
        "Runtime AI Bug Trigger cannot claim tester gameplay provenance.",
      ],
    };
  }

  const expectedEvidence = new Set(
    candidateExpectedBasis(candidate).evidenceIds,
  );
  const observedEvidence = new Set(
    candidateObservedBasis(candidate).evidenceIds,
  );
  const gameplayBasisEvidence =
    compiled.gameplayBasis === "authored-gameplay"
      ? expectedEvidence : observedEvidence;

  if (
    !compiled.evidenceIds.some(
      (id) => gameplayBasisEvidence.has(id),
    )
  ) {
    return {
      issues: [
        "Bug Trigger gameplay basis is not supported by matching gameplay evidence from the same defect.",
      ],
    };
  }

  // A sourced expectation alone cannot validate the alleged wrong result.
  // Require both the expected-authority and observed-defect IDs from this
  // candidate. This is a necessary evidence gate, not proof of live gameplay.
  if (!compiled.evidenceIds.some(id => expectedEvidence.has(id))) {
    return {
      issues: [
        "Bug Trigger lacks matching expected-behavior evidence from this defect.",
      ],
    };
  }
  if (!compiled.evidenceIds.some(id => observedEvidence.has(id))) {
    return {
      issues: [
        "Bug Trigger observable failure lacks matching observed-defect evidence from this defect.",
      ],
    };
  }

  // Aggregate matching evidence is not sufficient: a step may claim a
  // setup/action/outcome that its cited sources never support. Preserve
  // distinct provenance for the authoring basis and the failed outcome.
  const setupBasis = compiled.gameplayBasis === "authored-gameplay"
    ? expectedEvidence : observedEvidence;
  const trace = compiled.stepEvidence;
  if (!trace.startingCondition.some(id => setupBasis.has(id))) {
    return {
      issues: ["Bug Trigger starting condition lacks matching gameplay-basis evidence from this defect."],
    };
  }
  if (trace.actions.some(ids => !ids.some(id => setupBasis.has(id)))) {
    return {
      issues: ["Bug Trigger player action lacks matching gameplay-basis evidence from this defect."],
    };
  }
  if (!trace.observableFailure.some(id => observedEvidence.has(id))) {
    return {
      issues: ["Bug Trigger observable failure step lacks matching observed-defect evidence from this defect."],
    };
  }

  return {
    steps: compiled.steps,
    reproductionProvenance: {
      gameplayBasis: compiled.gameplayBasis,
      stepEvidence: compiled.stepEvidence,
    },
    issues: [],
  };
}

function collectOne(
  candidate: AuditReportCandidate,
): {
  readonly confirmed?: ConfirmedDefect;
  readonly rejected?: RejectedReportCandidate;
} {
  const decision =
    candidate.route === "runtime"
      ? confirmGameplayIntentRuntimeDefectForReport(
          candidate.intent,
          candidate.assessment,
        )
      : candidate.route === "static"
        ? confirmStaticIntentDefectForReport(
            candidate.intent,
            candidate.result,
          )
        : confirmTesterDefectForReport(
            candidate.confirmation,
          );

  if (!decision.confirmed) {
    return {
      rejected:
        earlyRejectedCandidate(
          candidate,
          decision.reasons,
        ),
    };
  }

  const runtimeClassificationProblems =
    runtimeClassificationIssues(candidate);
  if (runtimeClassificationProblems.length > 0) {
    return {
      rejected: rejectedCandidate(
        candidate,
        runtimeClassificationProblems,
        "candidate-correction",
      ),
    };
  }

  const classificationProblems =
    classificationIssues(candidate);
  if (classificationProblems.length > 0) {
    return {
      rejected: rejectedCandidate(
        candidate,
        classificationProblems,
        "candidate-correction",
      ),
    };
  }

  const ownerIssues =
    semanticOwnerIssues(candidate);
  if (ownerIssues.length > 0) {
    return {
      rejected: rejectedCandidate(
        candidate,
        ownerIssues,
        "candidate-correction",
      ),
    };
  }

  const trigger: {
    readonly steps?: readonly string[];
    readonly reproductionProvenance?: BugReportV2ReproductionProvenance;
    readonly issues: readonly string[];
  } =
    candidate.route === "tester"
      ? { issues: [] }
      : aiBugTrigger(candidate);
  if (trigger.issues.length > 0) {
    return {
      rejected: rejectedCandidate(
        candidate,
        trigger.issues,
        "candidate-correction",
      ),
    };
  }

  if (
    candidate.defect.suggestedFix !== undefined &&
    candidate.repairContext?.decision === undefined
  ) {
    return {
      rejected: rejectedCandidate(
        candidate,
        [
          "Suggested Fix requires a diagnostic repair decision.",
        ],
        "repair-decision",
      ),
    };
  }

  const classification =
    candidateClassification(candidate);
  if (!classification.ok) {
    return {
      rejected: rejectedCandidate(
        candidate,
        classification.reasons,
        "candidate-correction",
      ),
    };
  }

  const boundSourceEvidence =
    candidateSourceEvidence(candidate);
  const expected =
    candidateExpectedBasis(candidate);
  const observed =
    candidateObservedBasis(candidate);
  const {
    classificationSignals:
      _classificationSignals,
    expectedStatement:
      _expectedStatement,
    observedStatement:
      _observedStatement,
    reproduction:
      rawReproduction,
    reproductionProvenance:
      _untrustedReproductionProvenance,
    ...defectDraft
  } = candidate.defect;

  const scenarioCausalLinkIds = [
    ...new Set([
      ...(candidate.scenarioCausalLinkIds ?? []),
      ...(candidate.scenarioCausalLinkId === undefined
        ? []
        : [candidate.scenarioCausalLinkId]),
    ]),
  ].sort();

  const confirmed: ConfirmedDefect = {
    ...defectDraft,
    ...(scenarioCausalLinkIds.length === 0
      ? {}
      : {
          causalIncidentIds:
            scenarioCausalLinkIds,
          ...(scenarioCausalLinkIds.length === 1
            ? {
                causalIncidentId:
                  scenarioCausalLinkIds[0],
              }
            : {}),
        }),
    expected,
    observed,
    impact: classification.impact,
    primaryFailure:
      classification.primaryFailure,
    ...(boundSourceEvidence === undefined
      ? {}
      : { sourceEvidence: boundSourceEvidence }),
    semanticKey: candidateSemanticKey(candidate),
    subjectIds: [...candidateSubjectIds(candidate)],
    brokenInvariantIds: [
      ...candidateBrokenInvariantIds(candidate),
    ],
    repairUnitIds: [
      ...candidateRepairUnitIds(candidate),
    ],
    foundBy:
      candidate.route === "tester"
        ? "tester"
        : "ai",
    confirmation: decision.confirmation,
    ...(candidate.route === "tester"
      ? rawReproduction === undefined
        ? {}
        : { reproduction: rawReproduction }
      : trigger.steps === undefined
        ? {}
        : { reproduction: trigger.steps }),
    ...(candidate.route !== "tester" && trigger.reproductionProvenance !== undefined
      ? { reproductionProvenance: trigger.reproductionProvenance }
      : {}),
  };

  return {
    confirmed: candidate.repairContext === undefined
      ? confirmed
      : applyReportRepairContext(
          confirmed,
          candidate.repairContext,
        ),
  };
}

function applyEngineeringAnalysis(
  defect: ConfirmedDefect,
  analyses:
    readonly InspectionEngineeringAnalysis[],
): ConfirmedDefect {
  const matching = analyses.find((item) =>
    item.domain === "arena-capacity" &&
    defect.primaryFailure ===
      "session-concurrency"
  );

  if (!matching) return defect;

  const rendered =
    renderEngineeringAnalysis(
      matching.analysis,
    );

  return {
    ...defect,
    engineeringAnalysis:
      defect.engineeringAnalysis === undefined
        ? rendered
        : [
            defect.engineeringAnalysis,
            rendered,
          ].join("\n\n"),
  };
}

export function collectConfirmedDefects(
  candidates: readonly AuditReportCandidate[],
  engineeringAnalyses:
    readonly InspectionEngineeringAnalysis[] = [],
): ConfirmedDefectCollection {
  const confirmed: ConfirmedDefect[] = [];
  const rejected: RejectedReportCandidate[] = [];

  const contradictionRegistry =
    buildContradictionRegistry(
      candidates.map((candidate) => ({
        semanticKey:
          preclassificationCandidateKey(
            candidate,
          ),
        route: candidate.route,
        evidenceIds:
          candidateEvidenceIds(candidate),
      })),
    );
  const duplicateIndexes = new Set(
    contradictionRegistry
      .exactDuplicateIndexes,
  );

  candidates.forEach(
    (candidate, index) => {
      if (duplicateIndexes.has(index)) {
        return;
      }

      const result = collectOne(candidate);
      if (result.confirmed) {
        confirmed.push(
          applyEngineeringAnalysis(
            result.confirmed,
            engineeringAnalyses,
          ),
        );
      }
      if (result.rejected) {
        rejected.push(result.rejected);
      }
    },
  );

  return {
    confirmed,
    rejected,
    contradictionRegistry,
  };
}

export interface BuildBugReportFromAuditInput {
  readonly map: BugReportV2Map;
  readonly repairBy: BugReportV2RepairBy;
  readonly approved: ApprovedBugSet;
  readonly files: readonly FileInventoryEntry[];
  readonly candidates: readonly AuditReportCandidate[];
  readonly engineeringAnalyses?:
    readonly InspectionEngineeringAnalysis[];
  readonly groupResolutions?:
    readonly ConfirmedDefectGroupResolution[];
}

export interface PrepareBugReportReviewFromAuditResult {
  readonly collection: ConfirmedDefectCollection;
  readonly proposed: ProposedBugSet;
}

export interface BuildBugReportFromAuditResult {
  readonly collection: ConfirmedDefectCollection;
  readonly promotion: PromoteConfirmedBugsResult;
}

export interface BuildBugReportFromClosedAuditInput
  extends BuildBugReportFromAuditInput {
  /**
   * @deprecated Compatibility evidence only. Canonical production admission
   * is owned by mandatoryAuditProcedure.
   */
  readonly gameplayDiscoveryClosure?:
    GameplayDiscoveryClosure;
  /**
   * @deprecated Compatibility evidence only. Canonical production admission
   * is owned by mandatoryAuditProcedure.
   */
  readonly gameplayClosure?:
    GameplayModelClosureResult;
  /**
   * @deprecated Compatibility evidence only. Canonical production admission
   * is owned by mandatoryAuditProcedure.
   */
  readonly gameplayScenarioClosure?:
    GameplayScenarioClosure;
  readonly gameplayDefectResolution?:
    GameplayDefectResolutionGate;
  readonly mandatoryAuditProcedure?:
    MandatoryAuditProcedureReceipt;
  /**
   * Canonical production authority. Missing authority blocks the closed-audit
   * production routes; compatibility functions remain engine-development only.
   */
  readonly auditAuthority?: SelectedMapAuditAuthority;
}

export function mandatoryAuditProcedurePublicationIssues(
  procedure: MandatoryAuditProcedureReceipt | undefined,
): readonly {
  code: "invalid-confirmed-defect";
  message: string;
}[] {
  if (procedure === undefined) {
    return [{
      code: "invalid-confirmed-defect",
      message:
        "Mandatory Audit Procedure receipt is missing. Production publication cannot bypass UNDERSTAND → MODEL → STRESS → PROVE → REPORT.",
    }];
  }
  if (
    procedure.status !== "OPEN" &&
    procedure.blockingCheckpointIds.length === 0
  ) {
    return [];
  }
  return [{
    code: "invalid-confirmed-defect",
    message:
      "Mandatory Audit Procedure has publication-blocking checkpoint(s): " +
      procedure.blockingCheckpointIds.join(", ") +
      ". " +
      procedure.reasons.join(" "),
  }];
}

export function gameplayDiscoveryPublicationIssues(
  closure: GameplayDiscoveryClosure,
): readonly {
  code: "invalid-confirmed-defect";
  message: string;
}[] {
  if (closure.status !== "OPEN") return [];

  return [{
    code: "invalid-confirmed-defect",
    message:
      "Gameplay Discovery Closure is OPEN. Map Audit Report publication is blocked until relevant selected-artifact sources are indexed and the gameplay surface inventory is stable.",
  }];
}

export function gameplayClosurePublicationIssues(
  closure: GameplayModelClosureResult,
): readonly {
  code: "invalid-confirmed-defect";
  message: string;
}[] {
  if (closure.status !== "OPEN") return [];

  return [{
    code: "invalid-confirmed-defect",
    message:
      "Gameplay Model Closure is OPEN. Map Audit Report publication is blocked until discovered gameplay surfaces and the major state model are accounted for.",
  }];
}

export function gameplayScenarioPublicationIssues(
  closure: GameplayScenarioClosure | undefined,
): readonly {
  code: "invalid-confirmed-defect";
  message: string;
}[] {
  if (closure === undefined) {
    return [{
      code: "invalid-confirmed-defect",
      message:
        "Gameplay Scenario Closure is missing. Production report publication cannot bypass scenario/causal analysis.",
    }];
  }
  if (closure.status !== "OPEN") return [];

  return [{
    code: "invalid-confirmed-defect",
    message:
      "Gameplay Scenario Closure is OPEN. Publication is blocked until gameplay components have scenario purpose, material causal links are resolved, and orphan/missing links are cleared.",
  }];
}

export function gameplayDefectResolutionPublicationIssues(
  gate: GameplayDefectResolutionGate | undefined,
): readonly {
  code: "invalid-confirmed-defect";
  message: string;
}[] {
  if (gate === undefined) {
    return [{
      code: "invalid-confirmed-defect",
      message:
        "Gameplay Defect Resolution is missing. Production report publication cannot bypass contradiction resolution.",
    }];
  }
  if (gate.status !== "BLOCKED") return [];

  return [{
    code: "invalid-confirmed-defect",
    message:
      "Gameplay Defect Resolution is BLOCKED. Every CONTRADICTED Gameplay Causal Link must resolve to CONFIRMED_DEFECT_READY, BLOCKING_COUNTERPROOF, RUNTIME_PROOF_REQUIRED, or DETECTION_GAP before report review.",
  }];
}

export function gameplayDefectCandidateNarrativeIssues(
  gate: GameplayDefectResolutionGate | undefined,
  candidates: readonly AuditReportCandidate[],
): readonly {
  code: "invalid-confirmed-defect";
  message: string;
}[] {
  if (gate === undefined) return [];

  const byLink = new Map(
    gate.resolutions.map((resolution) => [
      resolution.causalLinkId,
      resolution,
    ]),
  );
  const issues: {
    code: "invalid-confirmed-defect";
    message: string;
  }[] = [];

  for (const candidate of candidates) {
    if (candidate.route === "tester") continue;

    const linkIds = [
      ...new Set([
        ...(candidate.scenarioCausalLinkIds ?? []),
        ...(candidate.scenarioCausalLinkId === undefined
          ? []
          : [candidate.scenarioCausalLinkId]),
      ]),
    ].sort();
    if (linkIds.length === 0) continue;

    const resolutions = linkIds
      .map((id) => byLink.get(id))
      .filter(
        (item): item is NonNullable<typeof item> =>
          item !== undefined &&
          item.disposition === "CONFIRMED_DEFECT_READY",
      );

    if (resolutions.length !== linkIds.length) {
      continue;
    }

    const expected = [
      ...new Set(
        resolutions
          .map((item) => item.expectedOutcome?.trim())
          .filter(
            (value): value is string =>
              typeof value === "string" &&
              value.length > 0,
          ),
      ),
    ];
    const actual = [
      ...new Set(
        resolutions
          .map((item) => item.actualOutcome?.trim())
          .filter(
            (value): value is string =>
              typeof value === "string" &&
              value.length > 0,
          ),
      ),
    ];

    if (
      expected.length === 1 &&
      candidate.defect.expectedStatement.trim() !==
        expected[0]
    ) {
      issues.push({
        code: "invalid-confirmed-defect",
        message:
          "AI report candidate changed Expected behavior after Defect Resolution. " +
          "Expected must remain exactly bound to the CONFIRMED_DEFECT_READY resolution for causal link(s): " +
          linkIds.join(", ") +
          ".",
      });
    }

    if (
      actual.length === 1 &&
      candidate.defect.observedStatement.trim() !==
        actual[0]
    ) {
      issues.push({
        code: "invalid-confirmed-defect",
        message:
          "AI report candidate changed Actual/Observed behavior after Defect Resolution. " +
          "Observed must remain exactly bound to the CONFIRMED_DEFECT_READY resolution for causal link(s): " +
          linkIds.join(", ") +
          ".",
      });
    }

    if (
      linkIds.length > 1 &&
      (expected.length > 1 || actual.length > 1)
    ) {
      issues.push({
        code: "invalid-confirmed-defect",
        message:
          "One AI report candidate combines ready causal links with different Expected/Actual narratives. " +
          "Keep them split until ConfirmedDefect root-cause grouping resolves them canonically: " +
          linkIds.join(", ") +
          ".",
      });
    }
  }

  return issues;
}

export function gameplayDefectCandidateCoverageIssues(
  gate: GameplayDefectResolutionGate | undefined,
  candidates: readonly AuditReportCandidate[],
): readonly {
  code: "invalid-confirmed-defect";
  message: string;
}[] {
  if (gate === undefined) return [];

  const issues: {
    code: "invalid-confirmed-defect";
    message: string;
  }[] = [];
  const ready = new Set(
    gate.confirmedDefectReadyIds,
  );
  const candidateLinks = new Map<string, number>();

  for (const candidate of candidates) {
    const linkIds = [
      ...new Set([
        ...(candidate.scenarioCausalLinkIds ?? []),
        ...(candidate.scenarioCausalLinkId === undefined
          ? []
          : [candidate.scenarioCausalLinkId]),
      ]),
    ].sort();
    if (linkIds.length === 0) {
      if (candidate.route !== "tester") {
        issues.push({
          code: "invalid-confirmed-defect",
          message:
            "AI report candidate is not bound to a CONFIRMED_DEFECT_READY Gameplay Causal Link. Production AI findings must originate from Scenario → RIG → Causal Link → Defect Resolution.",
        });
      }
      continue;
    }

    for (const linkId of linkIds) {
      candidateLinks.set(
        linkId,
        (candidateLinks.get(linkId) ?? 0) + 1,
      );

      if (!ready.has(linkId)) {
        issues.push({
          code: "invalid-confirmed-defect",
          message:
            "Report candidate references Gameplay Causal Link " +
            linkId +
            " but that link is not CONFIRMED_DEFECT_READY.",
        });
      }
    }
  }

  for (const linkId of ready) {
    const count = candidateLinks.get(linkId) ?? 0;
    if (count === 0) {
      issues.push({
        code: "invalid-confirmed-defect",
        message:
          "CONFIRMED_DEFECT_READY Gameplay Causal Link has no report candidate: " +
          linkId +
          ". A resolved gameplay defect must not disappear before report review.",
      });
    } else if (count > 1) {
      issues.push({
        code: "invalid-confirmed-defect",
        message:
          "CONFIRMED_DEFECT_READY Gameplay Causal Link maps to multiple report candidates: " +
          linkId +
          ". Consolidate it before report review.",
      });
    }
  }

  return issues;
}

function lineAddressableSource(path: string): boolean {
  return /\.(?:ts|tsx|js|jsx|mcfunction)$/i.test(path);
}

function sourceEvidenceIssues(
  defects: readonly ConfirmedDefect[],
  files: readonly FileInventoryEntry[],
): readonly {
  code: "invalid-confirmed-defect";
  message: string;
}[] {
  const known = new Set(
    files.map((file) =>
      file.relativePath.replaceAll("\\", "/")
    ),
  );
  const issues: {
    code: "invalid-confirmed-defect";
    message: string;
  }[] = [];

  for (const defect of defects) {
    for (const item of defect.sourceEvidence ?? []) {
      const path =
        item.source.relativePath.replaceAll("\\", "/");
      if (!known.has(path)) {
        issues.push({
          code: "invalid-confirmed-defect",
          message:
            defect.semanticKey +
            ": source evidence path is not present in the audited file inventory: " +
            path +
            ".",
        });
        continue;
      }

      if (
        defect.foundBy === "ai" &&
        lineAddressableSource(path) &&
        !sourceRefHasPreciseLocation(item.source)
      ) {
        issues.push({
          code: "invalid-confirmed-defect",
          message:
            defect.semanticKey +
            ": line-addressable AI source evidence must include a precise range or location: " +
            path +
            ".",
        });
      }
    }
  }

  return issues;
}

/**
 * @deprecated Engine-internal compatibility route. Production callers must
 * start with runSelectedMapAudit() and continue with prepareSelectedMapAuditReview().
 */
export function prepareBugReportReviewFromAuditCandidatesCompatibility(
  input: Omit<
    BuildBugReportFromAuditInput,
    "repairBy" | "approved"
  >,
): PrepareBugReportReviewFromAuditResult {
  const collection = collectConfirmedDefects(
    input.candidates,
    input.engineeringAnalyses ?? [],
  );

  return {
    collection,
    proposed: projectProposedBugSet(
      input.map,
      collection.confirmed,
    ),
  };
}

export type PrepareBugReportReviewFromClosedAuditInput =
  Omit<
    BuildBugReportFromClosedAuditInput,
    "repairBy" | "approved"
  >;

export type PrepareBugReportReviewFromClosedAuditResult =
  | PrepareBugReportReviewFromAuditResult
  | {
      readonly collection:
        ConfirmedDefectCollection;
      readonly proposed?: never;
      readonly blocked: true;
      readonly reasons: readonly string[];
    };

export function prepareBugReportReviewFromAuditCandidates(
  input:
    PrepareBugReportReviewFromClosedAuditInput,
): PrepareBugReportReviewFromClosedAuditResult {
  const authorityIssues =
    selectedMapAuditAuthorityIssues(input.auditAuthority);
  if (authorityIssues.length > 0) {
    return {
      collection: collectConfirmedDefects(
        input.candidates,
        input.engineeringAnalyses ?? [],
      ),
      blocked: true,
      reasons: authorityIssues,
    };
  }
  const admission = assessSelectedMapAuditAdmission({
    mandatoryAuditProcedure:
      input.mandatoryAuditProcedure,
  });
  const closureIssues = [
    ...admission.issues.map((issue) => ({
      code: "invalid-confirmed-defect" as const,
      message:
        "[" + issue.stage + "] " +
        issue.message,
    })),
    ...gameplayDefectCandidateCoverageIssues(
      input.gameplayDefectResolution,
      input.candidates,
    ),
    ...gameplayDefectCandidateNarrativeIssues(
      input.gameplayDefectResolution,
      input.candidates,
    ),
  ];

  if (closureIssues.length > 0) {
    return {
      collection: collectConfirmedDefects(
        input.candidates,
        input.engineeringAnalyses ?? [],
      ),
      blocked: true,
      reasons: closureIssues.map(
        (issue) => issue.message,
      ),
    };
  }

  return prepareBugReportReviewFromAuditCandidatesCompatibility(
    input,
  );
}

/**
 * @deprecated Engine-internal compatibility route.
 * Production map audits must start with runSelectedMapAudit() and continue
 * with buildApprovedBugReportFromAudit(). Do not construct closure inputs manually.
 */
export function buildBugReportFromAuditCandidatesCompatibility(
  input: BuildBugReportFromAuditInput,
): BuildBugReportFromAuditResult {
  const collection = collectConfirmedDefects(
    input.candidates,
    input.engineeringAnalyses ?? [],
  );
  const sourceIssues = sourceEvidenceIssues(
    collection.confirmed,
    input.files,
  );

  if (
    input.approved.map.name !== input.map.name ||
    input.approved.map.mapVersion !== input.map.mapVersion
  ) {
    return {
      collection,
      promotion: {
        ok: false,
        issues: [{
          code: "invalid-confirmed-defect",
          message:
            "Approved Bug Set does not match the audited map/version.",
        }],
      },
    };
  }

  return {
    collection,
    promotion:
      sourceIssues.length > 0
        ? {
            ok: false,
            issues: sourceIssues,
          }
        : buildBugReportFromApprovedBugSet({
            approved: input.approved,
            repairBy: input.repairBy,
            defects: collection.confirmed,
            ...(input.groupResolutions === undefined
              ? {}
              : {
                  groupResolutions:
                    input.groupResolutions,
                }),
          }),
  };
}


export function buildBugReportFromAuditCandidates(
  input: BuildBugReportFromClosedAuditInput,
): BuildBugReportFromAuditResult {
  const authorityIssues =
    selectedMapAuditAuthorityIssues(input.auditAuthority);
  if (authorityIssues.length > 0) {
    return {
      collection: collectConfirmedDefects(
        input.candidates,
        input.engineeringAnalyses ?? [],
      ),
      promotion: {
        ok: false,
        issues: authorityIssues.map((message) => ({
          code: "invalid-confirmed-defect" as const,
          message,
        })),
      },
    };
  }
  const admission = assessSelectedMapAuditAdmission({
    mandatoryAuditProcedure:
      input.mandatoryAuditProcedure,
  });
  const closureIssues = [
    ...admission.issues.map((issue) => ({
      code: "invalid-confirmed-defect" as const,
      message:
        "[" + issue.stage + "] " +
        issue.message,
    })),
    ...gameplayDefectCandidateCoverageIssues(
      input.gameplayDefectResolution,
      input.candidates,
    ),
    ...gameplayDefectCandidateNarrativeIssues(
      input.gameplayDefectResolution,
      input.candidates,
    ),
  ];

  if (closureIssues.length > 0) {
    return {
      collection: collectConfirmedDefects(
        input.candidates,
        input.engineeringAnalyses ?? [],
      ),
      promotion: {
        ok: false,
        issues: closureIssues,
      },
    };
  }

  return buildBugReportFromAuditCandidatesCompatibility(
    input,
  );
}

export const buildBugReportFromClosedAuditCandidates =
  buildBugReportFromAuditCandidates;
