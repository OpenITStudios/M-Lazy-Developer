import type {
  KnowledgeCatalog,
} from "../../knowledge/src/index.js";
import type { DeveloperPracticeReferenceData } from "./workflow/resource-context.js";
import type {
  MapClassificationRoutingHint,
} from "./map-classification-routing.js";
import type {
  RuntimeProbeTranscript,
  TelemetryBatch,
  TelemetryEvent,
} from "../../project-model/src/index.js";
import type {
  ApprovedBugSet,
  BugReportV2Map,
  BugReportV2RepairBy,
  ConfirmedDefectGroupResolution,
} from "../../bug-report/src/index.js";
import type {
  InspectTargetProfile,
} from "./core/types.js";
import {
  inspectArtifact,
  type InspectArtifactResult,
} from "./inspection/inspect-artifact.js";
import {
  buildBugReportFromAuditCandidates,
  collectConfirmedDefects,
  prepareBugReportReviewFromAuditCandidates,
  type AuditReportCandidate,
  type BuildBugReportFromAuditResult,
  type PrepareBugReportReviewFromClosedAuditResult,
} from "./reporting/report-defect-collector.js";
import {
  deriveGameplayArchitectureNavigation,
  type GameplayArchitectureNavigation,
} from "./inspection/gameplay-scenario-model.js";
import type {
  InspectionEngineeringAnalysis,
} from "./inspection/engineering-analysis-stage.js";
import {
  assessGameplayDefectResolutionGate,
  automaticCounterProofSearch,
  blockingCounterProofFor,
  type GameplayDefectResolution,
  type GameplayDefectResolutionDisposition,
} from "./inspection/gameplay-defect-resolution.js";
import {
  refreshHiddenGameplayDefectsForWorld,
} from "./inspection/hidden-gameplay-defect-analysis.js";
import {
  deriveMandatoryAuditProcedureReceipt,
} from "./inspection/mandatory-audit-procedure.js";
import {
  SELECTED_MAP_AUDIT_STAGE_ORDER,
  assessSelectedMapAuditAdmission,
  canProjectIndependentAuditEvidence,
  canAdmitAuditIssueLanes,
  type SelectedMapAuditAdmission,
  type SelectedMapAuditStage,
} from "./map-audit-admission.js";
import {
  deriveAuditModelTaskPackets,
  type AuditModelTaskPacket,
} from "./map-audit-model-task.js";
import {
  deriveSelectedMapAuditIdentity,
  selectedMapReportIdentityIssues,
  type SelectedMapAuditIdentity,
} from "./map-audit-identity.js";
import {
  projectReadyAuditIssues,
  type AuditIssueProjection,
  type NeedValidationAuditIssueProjection,
  type ReadyAuditIssueProjection,
} from "./map-audit-issue-projection.js";
import {
  projectNeedValidationAuditIssues,
} from "./map-audit-validation-projection.js";
import {
  groupNeedValidationTests,
  type AuditValidationTestGroup,
} from "./map-audit-validation-plan.js";
import {
  deriveAuditObligations,
  type AuditObligation,
} from "./map-audit-obligations.js";
import {
  buildAuditProofNavigation,
} from "./map-audit-proof-navigation.js";
import {
  projectMapAuditOutputV2,
  type MapAuditOutputV2,
} from "./map-audit-output-v2.js";
import {
  deriveSelectedMapAuditRevision,
} from "./map-audit-revision.js";
import {
  reconcileSelectedMapAuditDemand,
  type AuditDemandReconciliation,
} from "./map-audit-demand-reconciliation.js";
import {
  deriveAuditExecutionTrace,
  type AuditExecutionTrace,
} from "./map-audit-execution-trace.js";
import {
  issueSelectedMapAuditAuthority,
} from "./map-audit-authority.js";
import {
  assessAuditHonesty,
  type AuditHonestyAssessment,
} from "./map-audit-honesty.js";
import {
  buildFullMapReplicaReceipt,
  type FullMapReplicaReceipt,
} from "./arena/full-map-replica-receipt.js";
import {
  createFallbackAuditUserIntent,
  deriveAuditUserIntentKnowledgeDemand,
  validateAuditUserIntentConfirmation,
  type AuditUserIntentConfirmationReceipt,
  normalizeAuditUserIntent,
  validateAuditUserIntent,
  type AuditUserIntentEnvelope,
} from "./map-audit-user-intent.js";
import {
  reasonAboutCausalLinkFinding,
} from "./diagnosis/causal-link-reasoning-coordinator.js";
import {
  diagnosticDispositionForDefectResolution,
} from "./diagnosis/defect-resolution-diagnostic-disposition.js";
import {
  assessReasoningMonotonicity,
} from "./reporting/reasoning-monotonicity.js";
import {
  auditCandidateGroupCoverageIssues,
  groupReadyAuditIssuesForCandidateCoverage,
  type ReadyAuditCandidateGroup,
} from "./map-audit-candidate-grouping.js";

export type SelectedMapAuditRuntimeTarget = Pick<
  InspectTargetProfile,
  | "edition"
  | "version"
  | "educationFeatures"
  | "eduLevel"
  | "experiments"
  | "arenaProofMode"
  | "staticExecutionDimension"
>;

export interface SelectedMapAuditInput {
  /**
   * Exact selected .mcworld artifact. Production audit authority starts here.
   */
  readonly artifactPath: string;
  /**
   * Optional SHA-256 from the selected Drive/download handoff. This checks
   * the actual bytes; GitHub project context never overrides the selection.
   */
  readonly expectedArtifactFingerprint?: string;
  /**
   * Runtime/platform identity only. Map-specific behavior contracts, arena
   * layouts, state authority, and expected-behavior policy cannot enter the
   * production audit from caller-supplied target configuration.
   */
  readonly target?: SelectedMapAuditRuntimeTarget;
  readonly knowledgeCatalog?: KnowledgeCatalog;
  /** Approved external developer patterns; reference-only model guidance. */
  readonly developerPractice?: DeveloperPracticeReferenceData;
  readonly telemetry?: readonly TelemetryEvent[] | TelemetryBatch;
  readonly runtimeProbeTranscript?: RuntimeProbeTranscript;
  /**
   * Optional map classification used only to broaden audit routing.
   * The fingerprint must match the selected artifact exactly.
   * It never becomes expected-behavior or defect proof.
   */
  readonly mapClassificationHint?:
    MapClassificationRoutingHint;
  /**
   * Optional raw prompt fallback. Used only when structured userIntent is not
   * supplied. The raw prompt is preserved as an unmapped Audit Obligation.
   */
  readonly rawUserPrompt?: string;
  /**
   * Structured interpretation of the user's wording.
   * Search guidance only; never gameplay authority or report proof.
   */
  readonly userIntent?: AuditUserIntentEnvelope;
  /**
   * Explicit chat confirmation bound to the normalized user intent.
   * Required whenever rawUserPrompt or userIntent is supplied.
   */
  readonly userIntentConfirmation?:
    AuditUserIntentConfirmationReceipt;
}

export interface SelectedMapAuditRun {
  readonly schemaVersion: 1;
  readonly policy: "selected-map-audit-single-entry";
  readonly inspection: InspectArtifactResult;
  readonly identity: SelectedMapAuditIdentity;
  readonly auditRevision: string;
  /** Derived navigation only; inspection and scenario graph retain authority. */
  readonly gameplayArchitecture: GameplayArchitectureNavigation;
  readonly userIntent?: AuditUserIntentEnvelope;
  readonly demandReconciliation: AuditDemandReconciliation;
  readonly executionTrace: AuditExecutionTrace;
  readonly stageOrder: readonly SelectedMapAuditStage[];
  readonly status: "READY_FOR_REVIEW" | "BLOCKED";
  readonly admission: SelectedMapAuditAdmission;
  readonly currentStage: SelectedMapAuditStage | "COMPLETE";
  readonly allowedNextAction:
    | "RESOLVE_BLOCKING_STAGE"
    | "RESOLVE_DEFECTS"
    | "PREPARE_REVIEW";
  readonly continuation: {
    readonly owner:
      | "ENGINE_OR_EVIDENCE"
      | "DEFECT_RESOLUTION"
      | "REVIEW";
    readonly requiresNewAuditRun: boolean;
    readonly modelMayAuthorizeCompletion: boolean;
  };
  /**
   * Bounded proof-improvement tasks. When allowedNextAction is PREPARE_REVIEW,
   * these packets are optional attempts to promote NEED_VALIDATION; they are
   * not a second blocking workflow.
   */
  readonly modelTaskPackets: readonly AuditModelTaskPacket[];
  readonly mapAuditReport: MapAuditOutputV2;
  readonly issueLanes: {
    readonly BUG: readonly AuditIssueProjection[];
    readonly DESIGN_MISMATCH:
      readonly AuditIssueProjection[];
  };
  readonly candidateGroups: readonly ReadyAuditCandidateGroup[];
  readonly auditObligations: readonly AuditObligation[];
  readonly validationTests: readonly AuditValidationTestGroup[];
  readonly fullMapReplica?: FullMapReplicaReceipt;
  readonly honesty: AuditHonestyAssessment;
  readonly blockingCheckpointIds: readonly string[];
  readonly reasons: readonly string[];
}


/**
 * Read-only, bounded model handoff from the SINGLE production audit result.
 * It is not an audit result, a second evidence owner or an LLM invocation.
 */
export interface SelectedMapAuditModelHandoff {
  readonly schemaVersion: 1;
  readonly policy: "selected-map-audit-model-handoff";
  readonly artifactId: string;
  readonly artifactFingerprint: string;
  readonly auditRevision: string;
  readonly currentStage: SelectedMapAuditRun["currentStage"];
  readonly allowedNextAction: SelectedMapAuditRun["allowedNextAction"];
  readonly gameUnderstanding: {
    readonly gameDesign: MapAuditOutputV2["gameDesign"];
    readonly gameplayFlowBasis: MapAuditOutputV2["gameplayFlowBasis"];
    readonly features: readonly {
      readonly id: string;
      readonly label: string;
      readonly kind: string;
      readonly grounding: "SOURCE_EVIDENCED" | "UNVERIFIED";
      readonly sourceEvidenceIds: readonly string[];
      readonly sourceEffectCount: number;
      readonly sourceActivationCandidates:
        NonNullable<MapAuditOutputV2["gameplayStructure"]>["mechanicReconstructions"][number]["sourceActivationCandidates"];
    }[];
    readonly omittedFeatures: number;
    /** Selected-source memory alias uncertainty; not game/runtime scope. */
    readonly sourceStateIdentityQuestions: readonly {
      readonly id: string;
      readonly question: string;
      readonly blockedSubjectIds: readonly string[];
      readonly evidenceIds: readonly string[];
    }[];
    readonly omittedSourceStateIdentityQuestions: number;
    /** Scoped return-guard matching questions; no authored policy proof. */
    readonly sourceReturnPolicyQuestions: readonly {
      readonly id: string;
      readonly question: string;
      readonly blockedSubjectIds: readonly string[];
      readonly evidenceIds: readonly string[];
    }[];
    readonly omittedSourceReturnPolicyQuestions: number;
    /** Bounded source-only arena/player partition questions, not runtime proof. */
    readonly sourceArenaPartitionQuestions: readonly string[];
    readonly omittedSourceArenaPartitionQuestions: number;
    /** Existing directed source paths, not chronological player sessions. */
    readonly sourceDesignPaths: NonNullable<MapAuditOutputV2["gameplayStructure"]>["gameplayJourneyCandidates"];
    readonly omittedSourceDesignPaths: number;
    /** Source-only resolved inter-region calls and immediate target operations.
     * Not proof of callback activation, live cancellation or player arrival.
     */
    readonly sourceHandoffs: readonly {
      readonly sourceFlowId: string;
      readonly edgeId: string;
      readonly fromRegionId: string;
      readonly toRegionId: string;
      readonly kind: "synchronous-call" | "event-dispatch" | "deferred" | "periodic";
      readonly source: import("../../project-model/src/index.js").SourceRef;
      readonly scheduler?: "run" | "runTimeout" | "runInterval" | "runJob";
      readonly generationGuard: "EXPLICIT_SOURCE_CHECK" | "UNRESOLVED" | "NOT_RECORDED";
      readonly directTargetStateWriteIds: readonly string[];
      readonly directTargetWorldEffectIds: readonly string[];
      readonly directTargetReleaseIds: readonly string[];
      readonly omittedDirectTargetSteps: number;
      readonly proof: "RESOLVED_SOURCE_EDGE_NOT_RUNTIME_EXECUTION";
    }[];
    readonly omittedSourceHandoffs: number;
    readonly unresolved: MapAuditOutputV2["unresolved"];
  };
  /** Read-only consolidation of the EXISTING admitted BUG root groups and
   * unresolved validation groups. No new finding, proof, admission or root ID.
   */
  readonly diagnosisNavigation: {
    readonly authority: "READ_ONLY_CANONICAL_GROUPS_NOT_REPORT_PROOF";
    readonly admittedBugRootGroups: readonly {
      readonly candidateGroupKey: string;
      readonly technicalOwnerId: string;
      readonly dependencyTargetId: string;
      readonly causalLinkIds: readonly string[];
      readonly failureDomains: readonly string[];
    }[];
    readonly omittedBugRootGroups: number;
    readonly pendingProofGroups: readonly {
      readonly key: string;
      readonly verificationMode: "STATIC_PROOF_COMPLETION" | "NARROW_RUNTIME_VERIFICATION";
      readonly causalLinkIds: readonly string[];
      readonly nextCheck: string;
      readonly missingProof: readonly string[];
    }[];
    readonly omittedPendingProofGroups: number;
  };
  readonly taskCount: number;
  readonly offset: number;
  readonly nextOffset: number | null;
  readonly tasks: readonly {
    readonly task: AuditModelTaskPacket;
    readonly resolutionEligible: boolean;
  }[];
  readonly proofBoundary: "MODEL_RESPONSE_IS_UNTRUSTED_UNTIL_CANONICAL_ENGINE_ADMISSION";
}

const MODEL_RESOLVABLE_KINDS = new Set([
  "COUNTERPROOF_SEARCH",
  "GAMEPLAY_TRANSLATION",
  "PROOF_NAVIGATION",
]);

export function projectSelectedMapAuditModelHandoff(
  audit: SelectedMapAuditRun,
  offset = 0,
  limit = 12,
): SelectedMapAuditModelHandoff {
  if (!Number.isSafeInteger(offset) || offset < 0 ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > 50) {
    throw new Error("Model handoff offset must be nonnegative and limit must be 1–50.");
  }
  const graph = audit.inspection.hiddenGameplayDefects.scenarioAudit.graph;
  const resolvable = new Set(graph.causalLinks
    .filter((link) => ["CONTRADICTED", "RUNTIME_BLOCKED", "DETECTION_GAP"]
      .includes(link.status))
    .map((link) => link.id));
  const features = audit.mapAuditReport.gameplayStructure?.features ?? [];
  const activationByFeature = new Map(
    (audit.mapAuditReport.gameplayStructure?.mechanicReconstructions ?? [])
      .map(item => [item.featureId, item.sourceActivationCandidates] as const),
  );
  const sourceStateIdentityQuestions =
    audit.inspection.gameplayIntent.model.unknowns
      .filter(item => item.id.startsWith("unknown:source-state-alias:"))
      .sort((a, b) => a.id.localeCompare(b.id));
  const sourceReturnPolicyQuestions =
    audit.inspection.gameplayIntent.model.unknowns
      .filter(item => item.id.startsWith("unknown:outcome-policy-coverage:"))
      .sort((a, b) => a.id.localeCompare(b.id));
  const sourceArenaPartitionQuestions =
    audit.mapAuditReport.multiArena.isolationRules.filter(rule =>
      rule.includes("=partition-proof-required") ||
      rule.includes("=unknown"));
  const selected = audit.modelTaskPackets.slice(offset, offset + limit);
  const handoffFlows =
    audit.mapAuditReport.gameplayStructure?.sourceFlowCandidates ?? [];
  const handoffsByEdge = new Map<string, {
    sourceFlowId: string;
    handoff: NonNullable<typeof handoffFlows[number]["sourceHandoffs"]>[number];
  }>();
  for (const flow of handoffFlows) {
    for (const handoff of flow.sourceHandoffs ?? []) {
      if (!handoffsByEdge.has(handoff.edgeId)) {
        handoffsByEdge.set(handoff.edgeId, {
          sourceFlowId: flow.id, handoff,
        });
      }
    }
  }
  const handoffs = [...handoffsByEdge.values()].sort((a, b) =>
    a.handoff.edgeId.localeCompare(b.handoff.edgeId));
  const omittedHandoffsInFlows = handoffFlows.reduce((sum, flow) =>
    sum + (flow.omittedSourceHandoffs ?? 0), 0);
  return {
    schemaVersion: 1,
    policy: "selected-map-audit-model-handoff",
    artifactId: audit.identity.artifactId,
    artifactFingerprint: audit.identity.artifactFingerprint,
    auditRevision: audit.auditRevision,
    currentStage: audit.currentStage,
    allowedNextAction: audit.allowedNextAction,
    gameUnderstanding: {
      gameDesign: audit.mapAuditReport.gameDesign,
      gameplayFlowBasis: audit.mapAuditReport.gameplayFlowBasis,
      features: features.slice(0, 16).map((feature) => ({
        id: feature.id,
        label: feature.label,
        kind: feature.kind,
        grounding: feature.grounding,
        sourceEvidenceIds: [...feature.sourceEvidenceIds],
        sourceEffectCount: new Set(feature.sourceBehaviorPaths
          .filter((path) => path.association === "DIRECT_EFFECT_EVIDENCE")
          .map((path) => path.effectId)).size,
        sourceActivationCandidates:
          (activationByFeature.get(feature.id) ?? []).slice(0, 3),
      })),
      omittedFeatures: Math.max(0, features.length - 16),
      sourceStateIdentityQuestions: sourceStateIdentityQuestions.slice(0, 8)
        .map(item => ({
          id: item.id,
          question: item.question,
          blockedSubjectIds: [...item.blockedSubjectIds],
          evidenceIds: [...(item.evidenceIds ?? [])],
        })),
      omittedSourceStateIdentityQuestions: Math.max(
        0, sourceStateIdentityQuestions.length - 8,
      ),
      sourceReturnPolicyQuestions: sourceReturnPolicyQuestions.slice(0, 8)
        .map(item => ({
          id: item.id,
          question: item.question,
          blockedSubjectIds: [...item.blockedSubjectIds],
          evidenceIds: [...(item.evidenceIds ?? [])],
        })),
      omittedSourceReturnPolicyQuestions: Math.max(
        0, sourceReturnPolicyQuestions.length - 8,
      ),
      sourceArenaPartitionQuestions: sourceArenaPartitionQuestions.slice(0, 8),
      omittedSourceArenaPartitionQuestions: Math.max(0,
        sourceArenaPartitionQuestions.length - 8),
      sourceDesignPaths: (audit.mapAuditReport.gameplayStructure?.gameplayJourneyCandidates ?? [])
        .slice(0, 6),
      omittedSourceDesignPaths: Math.max(0,
        (audit.mapAuditReport.gameplayStructure?.gameplayJourneyCandidates.length ?? 0) - 6),
      sourceHandoffs: handoffs.slice(0, 12).map(({ sourceFlowId, handoff }) => ({
        sourceFlowId,
        edgeId: handoff.edgeId,
        fromRegionId: handoff.fromRegionId,
        toRegionId: handoff.toRegionId,
        kind: handoff.kind,
        source: handoff.source,
        ...(handoff.scheduler === undefined ? {} : { scheduler: handoff.scheduler }),
        generationGuard: handoff.generationGuard,
        directTargetStateWriteIds: handoff.directTargetStateWriteIds,
        directTargetWorldEffectIds: handoff.directTargetWorldEffectIds,
        directTargetReleaseIds: handoff.directTargetReleaseIds,
        omittedDirectTargetSteps: handoff.omittedDirectTargetSteps,
        proof: handoff.proof,
      })),
      omittedSourceHandoffs:
        Math.max(0, handoffs.length - 12) + omittedHandoffsInFlows,
      unresolved: audit.mapAuditReport.unresolved,
    },
    diagnosisNavigation: {
      authority: "READ_ONLY_CANONICAL_GROUPS_NOT_REPORT_PROOF",
      admittedBugRootGroups: audit.candidateGroups.slice(0, 8).map(group => ({
        candidateGroupKey: group.candidateGroupKey,
        technicalOwnerId: group.technicalOwnerId,
        dependencyTargetId: group.dependencyTargetId,
        causalLinkIds: [...group.causalLinkIds],
        failureDomains: [...group.failureDomains],
      })),
      omittedBugRootGroups: Math.max(0, audit.candidateGroups.length - 8),
      pendingProofGroups: audit.validationTests.slice(0, 8).map(group => ({
        key: group.key,
        verificationMode: group.verificationMode,
        causalLinkIds: [...group.findingIds],
        nextCheck: group.test,
        missingProof: [...group.missingProof],
      })),
      omittedPendingProofGroups: Math.max(0, audit.validationTests.length - 8),
    },
    taskCount: audit.modelTaskPackets.length,
    offset,
    nextOffset: offset + selected.length < audit.modelTaskPackets.length
      ? offset + selected.length
      : null,
    tasks: selected.map((task) => ({
      task,
      resolutionEligible:
        task.auditRevision === audit.auditRevision &&
        MODEL_RESOLVABLE_KINDS.has(task.kind) &&
        task.causalLinkId !== undefined &&
        resolvable.has(task.causalLinkId),
    })),
    proofBoundary:
      "MODEL_RESPONSE_IS_UNTRUSTED_UNTIL_CANONICAL_ENGINE_ADMISSION",
  };
}

export interface SelectedMapAuditModelResponseBatch {
  readonly schemaVersion: 1;
  readonly policy: "selected-map-audit-model-responses";
  readonly artifactId: string;
  readonly artifactFingerprint: string;
  readonly auditRevision: string;
  readonly resolutions: readonly {
    readonly taskId: string;
    readonly resolution: GameplayDefectResolution;
  }[];
}

function deriveSelectedMapAuditControl(input: {
  readonly admission: SelectedMapAuditAdmission;
  readonly procedure:
    InspectArtifactResult["mandatoryAuditProcedure"];
  readonly scenario:
    InspectArtifactResult["hiddenGameplayDefects"]["scenarioAudit"];
  readonly capabilityDelivery:
    InspectArtifactResult["hiddenGameplayDefects"]["capabilityDelivery"];
  readonly negativeSpace:
    InspectArtifactResult["hiddenGameplayDefects"]["negativeSpace"];
  readonly temporalRisks:
    InspectArtifactResult["hiddenGameplayDefects"]["temporalRisks"];
  readonly gameplayClosure:
    InspectArtifactResult["gameplayWorld"]["gameplayClosure"];
  readonly gameplayWorld:
    InspectArtifactResult["gameplayWorld"];
  readonly discovery?: InspectArtifactResult["gameplayDiscoveryClosure"];
  readonly discoveryChallenges:
    InspectArtifactResult["hiddenGameplayDefects"]["discoveryChallenges"];
  readonly sharedResourceSignals:
    InspectArtifactResult["hiddenGameplayDefects"]["sharedResourceOwnership"]["signals"];
  readonly compoundBoundaries:
    InspectArtifactResult["hiddenGameplayDefects"]["compoundBoundaries"];
  readonly accumulationGrowth:
    InspectArtifactResult["hiddenGameplayDefects"]["accumulationGrowth"];
  readonly capabilityExposure:
    InspectArtifactResult["capabilityExposure"];
  readonly userIntent?: AuditUserIntentEnvelope;
}): Pick<
  SelectedMapAuditRun,
  | "executionTrace"
  | "currentStage"
  | "allowedNextAction"
  | "continuation"
  | "issueLanes"
  | "candidateGroups"
  | "auditObligations"
  | "validationTests"
  | "fullMapReplica"
  | "honesty"
  | "status"
  | "blockingCheckpointIds"
  | "reasons"
> {
  const firstBlockingStage =
    input.admission.firstBlockingStage;
  // Project only evidence-backed, scoped results. A2 PARTIAL (or later
  // blocked checkpoints) still blocks publication, not independent analysis.
  const evidenceProjectionAuthorized =
    canProjectIndependentAuditEvidence(input.procedure);
  // Showing independently proven/confirmation-ready findings is not the
  // same authority as admitting a complete audit to the proposed issue set.
  // Per-finding causal and proof checks remain in the projection owners.
  const proposalAdmissionAuthorized = canAdmitAuditIssueLanes(
    input.admission,
    input.procedure,
  );
  const provenIssues = evidenceProjectionAuthorized
    ? projectReadyAuditIssues(
        input.scenario.graph,
        input.scenario.defectResolution,
        input.capabilityDelivery,
      )
    : [];
  const needValidationIssues = evidenceProjectionAuthorized
    ? projectNeedValidationAuditIssues(
        input.scenario.graph,
        input.scenario.defectResolution,
        input.capabilityDelivery,
      )
    : [];
  const replicaDivergenceIds =
    input.gameplayWorld.arenas.replicaProof
      .filter((item) =>
        item.status === "diverged" ||
        item.mismatchCount > 0
      )
      .map((item) =>
        "replica-delta:" + item.arenaId
      )
      .sort();

  const auditObligations = evidenceProjectionAuthorized
    ? deriveAuditObligations({
        graph: input.scenario.graph,
        mandatoryAuditProcedure: input.procedure,
        defectResolution: input.scenario.defectResolution,
        gameplayWorld: input.gameplayWorld,
        capabilityDelivery: input.capabilityDelivery,
        ...(input.userIntent === undefined ? {} : { userIntent: input.userIntent }),
        gameplayClosure: input.gameplayClosure,
        ...(input.discovery === undefined ? {} : { discovery: input.discovery }),
        negativeSpace: input.negativeSpace,
        temporalRisks: input.temporalRisks,
        discoveryChallenges: input.discoveryChallenges,
        sharedResourceSignals: input.sharedResourceSignals,
        compoundBoundaries: input.compoundBoundaries,
        accumulationGrowth: input.accumulationGrowth,
        capabilityExposure: input.capabilityExposure,
        replicaDivergenceIds,
      })
    : [];

  const navigatedNeedValidationIssues = [
    ...needValidationIssues,
  ].map((item) => ({
    ...item,
    proofNavigation:
      buildAuditProofNavigation(
        item,
        input.gameplayWorld ?? undefined,
      ),
  }));
  const allVisibleIssues: readonly AuditIssueProjection[] = [
    ...provenIssues,
    ...navigatedNeedValidationIssues,
  ];
  const validationTests = groupNeedValidationTests(
    navigatedNeedValidationIssues,
  );
  const fullMapReplica =
    input.gameplayWorld.arenas.replicaProof.length === 0 ||
    input.gameplayWorld.arenas.replicaBaselineId === undefined
      ? undefined
      : buildFullMapReplicaReceipt({
          replicaBaseline:
            input.gameplayWorld.arenas.replicaBaselineId,
          replicas:
            input.gameplayWorld.arenas.replicaProof.map(
              (item) => ({
                replicaId: item.arenaId,
                proofStatus: item.status,
                mismatchCount:
                  item.mismatchCount,
                evidenceIds:
                  item.evidenceIds,
              }),
            ),
        });
  const honesty = assessAuditHonesty({
    graph: input.scenario.graph,
    mandatoryAuditProcedure: input.procedure,
    gate: input.scenario.defectResolution,
    gameplayClosure: input.gameplayClosure,
    capabilityDelivery: input.capabilityDelivery,
    negativeSpace: input.negativeSpace,
    temporalRisks: input.temporalRisks,
    discoveryChallenges:
      input.discoveryChallenges,
    sharedResourceSignals:
      input.sharedResourceSignals,
    compoundBoundaries:
      input.compoundBoundaries,
    accumulationGrowth:
      input.accumulationGrowth,
    replicaDivergenceIds,
    visibleIssues: allVisibleIssues,
    visibleObligationIds:
      auditObligations.map((item) => item.id),
  });
  const issueLanes = {
    BUG: allVisibleIssues.filter(
      (item) => item.issueType === "BUG",
    ),
    DESIGN_MISMATCH: allVisibleIssues.filter(
      (item) =>
        item.issueType === "DESIGN_MISMATCH",
    ),
  } as const;
  // Proposal grouping remains gated by the ordered mandatory procedure.
  // Partial report visibility must never approve publication or repair.
  const candidateGroups = proposalAdmissionAuthorized
    ? groupReadyAuditIssuesForCandidateCoverage(
        input.scenario.graph,
        issueLanes.BUG.filter(
          (item): item is ReadyAuditIssueProjection =>
            item.status === "PROVEN",
        ),
      )
    : [];
  const executionTrace = deriveAuditExecutionTrace({
    admission: input.admission,
    procedure: input.procedure,
  });
  const readyForReview =
    input.admission.status === "READY" &&
    honesty.status === "PASS";
  const currentStage =
    firstBlockingStage ??
    (readyForReview ? "COMPLETE" : "REPORT");
  const allowedNextAction =
    readyForReview
      ? "PREPARE_REVIEW" as const
      : firstBlockingStage === "PROVE" &&
          (
            input.scenario.defectResolution
              .gameplayTranslationRequiredIds.length > 0 ||
            input.scenario.defectResolution
              .counterProofSearchRequiredIds.length > 0
          )
        ? "RESOLVE_DEFECTS" as const
        : "RESOLVE_BLOCKING_STAGE" as const;
  const continuation =
    allowedNextAction === "PREPARE_REVIEW"
      ? {
          owner: "REVIEW" as const,
          requiresNewAuditRun: false,
          modelMayAuthorizeCompletion: false,
        }
      : allowedNextAction === "RESOLVE_DEFECTS"
        ? {
            owner: "DEFECT_RESOLUTION" as const,
            requiresNewAuditRun: false,
            modelMayAuthorizeCompletion: true,
          }
        : {
            owner: "ENGINE_OR_EVIDENCE" as const,
            requiresNewAuditRun: true,
            modelMayAuthorizeCompletion: false,
          };

  return {
    executionTrace,
    currentStage,
    allowedNextAction,
    continuation,
    issueLanes,
    candidateGroups,
    auditObligations,
    validationTests,
    ...(fullMapReplica === undefined
      ? {}
      : { fullMapReplica }),
    honesty,
    status:
      readyForReview
        ? "READY_FOR_REVIEW"
        : "BLOCKED",
    blockingCheckpointIds: [
      ...input.procedure.blockingCheckpointIds,
    ],
    reasons: [
      ...input.admission.issues.map((issue) =>
        "[" + issue.stage + "] " + issue.message
      ),
      ...(honesty.status === "PASS"
        ? []
        : honesty.reasons.map(
            (reason) =>
              "[HONESTY] " + reason,
          )),
    ],
  };
}

/**
 * Canonical and only supported starting point for a production selected-map audit.
 *
 * Low-level inspection/analyzer functions remain available for engine development,
 * focused diagnostics, and compatibility, but must not be used as alternate
 * production audit entry points.
 */
function productionInspectTarget(
  target: SelectedMapAuditRuntimeTarget | undefined,
  requiredKnowledgeDomains:
    InspectTargetProfile["requiredKnowledgeDomains"],
): InspectTargetProfile {
  return {
    ...(target ?? {}),
    ...(requiredKnowledgeDomains === undefined
      ? {}
      : { requiredKnowledgeDomains }),
  };
}

async function inspectSelectedMapToDemandFixedPoint(
  input: SelectedMapAuditInput,
): Promise<{
  readonly inspection: InspectArtifactResult;
  readonly reconciliation: AuditDemandReconciliation;
}> {
  const initialRequiredDomains:
    NonNullable<InspectTargetProfile["requiredKnowledgeDomains"]> = [
      ...deriveAuditUserIntentKnowledgeDemand(
        input.userIntent,
      ),
    ];

  const firstInspection = await inspectArtifact(
    input.artifactPath,
    productionInspectTarget(
      input.target,
      initialRequiredDomains,
    ),
    input.knowledgeCatalog,
    input.telemetry ?? [],
    input.runtimeProbeTranscript,
    input.mapClassificationHint,
    input.expectedArtifactFingerprint,
  );
  const firstReconciliation =
    reconcileSelectedMapAuditDemand(
      firstInspection,
      1,
    );
  if (firstReconciliation.stable) {
    return {
      inspection: firstInspection,
      reconciliation: firstReconciliation,
    };
  }

  const reconciledDomains = [
    ...new Set([
      ...initialRequiredDomains,
      ...firstReconciliation.requiredDomains,
    ]),
  ].sort();

  const secondInspection = await inspectArtifact(
    input.artifactPath,
    productionInspectTarget(
      input.target,
      reconciledDomains,
    ),
    input.knowledgeCatalog,
    input.telemetry ?? [],
    input.runtimeProbeTranscript,
    input.mapClassificationHint,
    input.expectedArtifactFingerprint,
  );
  // Both passes must describe one immutable selected artifact.
  if (secondInspection.fingerprint !== firstInspection.fingerprint) {
    throw new Error(
      "Selected .mcworld changed between inspection passes; refusing mixed-version audit.",
    );
  }
  const secondReconciliation =
    reconcileSelectedMapAuditDemand(
      secondInspection,
      2,
    );

  if (!secondReconciliation.stable) {
    throw new Error(
      "RIG knowledge demand did not converge after the bounded reconciliation pass. " +
        "Refusing repeated full-artifact reinspection; unresolved domain(s): " +
        secondReconciliation.missingDomains.join(", ") +
        ".",
    );
  }

  return {
    inspection: secondInspection,
    reconciliation: secondReconciliation,
  };
}

function assembleSelectedMapAuditRun(
  inspection: InspectArtifactResult,
  reconciliation: AuditDemandReconciliation,
  userIntent?: AuditUserIntentEnvelope,
  runtimeProbeTranscript?: RuntimeProbeTranscript,
  knowledgeCatalog?: KnowledgeCatalog,
  previousModelTaskPackets?: readonly AuditModelTaskPacket[],
  developerPractice?: DeveloperPracticeReferenceData,
): SelectedMapAuditRun {
  const identity =
    deriveSelectedMapAuditIdentity(inspection);
  const procedure =
    inspection.mandatoryAuditProcedure;
  const hidden =
    inspection.hiddenGameplayDefects;
  const scenario = hidden.scenarioAudit;
  const admission = assessSelectedMapAuditAdmission({
    mandatoryAuditProcedure: procedure,
  });
  const auditRevision = deriveSelectedMapAuditRevision({
    identity,
    admission,
    procedure,
    graph: scenario.graph,
    defectResolution: scenario.defectResolution,
  });
  const control = deriveSelectedMapAuditControl({
    admission,
    procedure,
    scenario,
    capabilityDelivery:
      hidden.capabilityDelivery,
    negativeSpace:
      hidden.negativeSpace,
    temporalRisks:
      hidden.temporalRisks,
    gameplayClosure:
      inspection.gameplayWorld.gameplayClosure,
    gameplayWorld:
      inspection.gameplayWorld,
    discovery: inspection.gameplayDiscoveryClosure,
    discoveryChallenges:
      hidden.discoveryChallenges,
    sharedResourceSignals:
      hidden.sharedResourceOwnership.signals,
    compoundBoundaries:
      hidden.compoundBoundaries,
    accumulationGrowth:
      hidden.accumulationGrowth,
    capabilityExposure:
      inspection.capabilityExposure,
    ...(userIntent === undefined ? {} : { userIntent }),
  });
  const needValidationFindings = [
    ...control.issueLanes.BUG,
    ...control.issueLanes.DESIGN_MISMATCH,
  ].filter(
    (item): item is NeedValidationAuditIssueProjection =>
      item.status === "NEED_VALIDATION",
  );
  // Only a resolved, conflict-free edition can filter Knowledge candidates.
  // Matching edition does NOT prove game version/API/experiment applicability.
  const edition = inspection.targetCompatibility.edition;
  const knowledgeEdition =
    inspection.knowledgeRuntime.profileResolved &&
    inspection.knowledgeRuntime.profileConflicts.length === 0 &&
    (edition === "bedrock" || edition === "education")
      ? edition
      : undefined;
  const freshModelTaskPackets = deriveAuditModelTaskPackets({
    admission,
    procedure,
    graph: scenario.graph,
    defectResolution: scenario.defectResolution,
    intent: inspection.gameplayIntent.model,
    auditRevision,
    world: inspection.gameplayWorld,
    ...(userIntent === undefined ? {} : { userIntent }),
    needValidationFindings,
    auditObligations:
      control.auditObligations,
    ...(knowledgeCatalog === undefined ? {} : { knowledgeCatalog }),
    ...(developerPractice === undefined ? {} : {
      developerPractice,
      semanticIr: inspection.semanticIrModel,
      selectedPacks: inspection.packs,
    }),
    ...(knowledgeEdition === undefined ? {} : { knowledgeEdition }),
  });
  // resolveSelectedMapAudit reuses the same immutable artifact but may have
  // no catalogue argument. Carry only a bounded selection whose task goal,
  // evidence and source-grounded query are still identical.
  const previousById = new Map(
    (previousModelTaskPackets ?? []).map((task) => [task.id, task]),
  );
  const modelTaskPackets = freshModelTaskPackets.map((task) => {
    const previous = previousById.get(task.id);
    const sameEvidence = previous !== undefined &&
      previous.decisionNeeded === task.decisionNeeded &&
      previous.knowledgeLookup?.query === task.knowledgeLookup?.query &&
      JSON.stringify(previous.knowledgeLookup?.sourceEvidenceIds ?? []) ===
        JSON.stringify(task.knowledgeLookup?.sourceEvidenceIds ?? []) &&
      JSON.stringify(previous.knowledgeLookup?.sourceLocators ?? []) ===
        JSON.stringify(task.knowledgeLookup?.sourceLocators ?? []);
    if (!sameEvidence) return task;
    return {
      ...task,
      ...(task.retrievedKnowledge === undefined &&
          previous?.retrievedKnowledge !== undefined
        ? { retrievedKnowledge: previous.retrievedKnowledge }
        : {}),
      ...(task.developerPractice === undefined &&
          previous?.developerPractice?.selectedArtifactId === inspection.artifactId
        ? { developerPractice: previous.developerPractice }
        : {}),
    };
  });
  const allFindings = [
    ...control.issueLanes.BUG,
    ...control.issueLanes.DESIGN_MISMATCH,
  ];
  const reasoningByCausalLinkId = Object.fromEntries(
    allFindings.flatMap((finding) => {
      const resolution = scenario.defectResolution.resolutions.find(
        (item) => item.causalLinkId === finding.causalLinkId,
      );
      if (!resolution) return [];
      const receipt = reasonAboutCausalLinkFinding({
        graph: scenario.graph,
        resolution,
        finding,
        diagnosticDisposition:
          diagnosticDispositionForDefectResolution(
            resolution.disposition,
            finding.issueType,
          ),
        ...(runtimeProbeTranscript
          ? { runtimeProbeTranscript }
          : {}),
        expectedArtifactId: identity.artifactId,
      });
      return receipt.status === "ADMITTED" && receipt.reasoning
        ? [[finding.causalLinkId, receipt.reasoning] as const]
        : [];
    }),
  );

  // One derived navigation for the run and the operator-facing audit output.
  // No second mechanic extractor or persisted game model.
  const gameplayArchitecture =
    deriveGameplayArchitectureNavigation(scenario.graph, {
        relevantSourceCount:
          inspection.gameplayDiscoveryClosure.sourceRelevantFiles,
        indexedSourceCount:
          inspection.gameplayDiscoveryClosure.sourceIndexedFiles,
        arenaDetected: inspection.gameplayWorld.arenas.detected,
        allIntentEvidenceIds:
          inspection.gameplayIntent.model.evidence.map((item) => item.id),
        semanticIr: inspection.semanticIrModel,
        intentUnknowns: inspection.gameplayIntent.model.unknowns,
        selectedArtifactEvidenceIds:
          inspection.gameplayIntent.model.evidence
            .filter((item) => item.scope === "selected-artifact")
            .map((item) => item.id),
        ...(inspection.gameplayWorld.arenas.count === undefined
          ? {}
          : { arenaCount: inspection.gameplayWorld.arenas.count }),
        replicaProof: inspection.gameplayWorld.arenas.replicaProof,
        ...(inspection.arenaAnalysis.regionPlan === undefined ? {} : { regionPlan: inspection.arenaAnalysis.regionPlan }),
        ...(inspection.arenaAnalysis.spatialLayout === undefined
          ? {}
          : { spatialLayout: inspection.arenaAnalysis.spatialLayout }),
        ...(inspection.arenaAnalysis.entityPopulationProof === undefined
          ? {}
          : { entityPopulationProof:
              inspection.arenaAnalysis.entityPopulationProof.replicas }),
        ...(inspection.arenaAnalysis.actorPopulationProof === undefined
          ? {}
          : { actorPopulationProof:
              inspection.arenaAnalysis.actorPopulationProof.replicas }),
        stateIsolationObservations:
          inspection.gameplayWorld.arenas.isolation.observations,
        chunkLeases: inspection.gameplayWorld.chunks.leases,
        cleanupAssessments:
          inspection.gameplayWorld.arenas.cleanup.lifecycle.assessments,
        systemObservations: [
          {
            system: "ENTITY",
            observedCount: inspection.gameplayWorld.entities.definitions,
            observationReferences:
              inspection.gameplayWorld.entities.aiStack.assessments.map(
                (item) => item.entityKey,
              ),
          },
          {
            system: "COMBAT",
            observedCount: inspection.gameplayWorld.combat.paths.length,
            observationReferences:
              inspection.gameplayWorld.combat.paths.map(
                (item) => item.scriptId + ":" + item.callbackRegion,
              ),
          },
          {
            system: "INVENTORY",
            observedCount: inspection.gameplayWorld.inventory.assessments.length,
            observationReferences:
              inspection.gameplayWorld.inventory.assessments.map(
                (item) => item.scriptId + ":" + item.executionRegion,
              ),
          },
          {
            system: "ECONOMY",
            observedCount: inspection.gameplayWorld.economy.sourceKinds.length,
            observationReferences: inspection.gameplayWorld.economy.sourceKinds,
          },
          {
            system: "PROGRESSION",
            observedCount:
              inspection.gameplayWorld.progression.actorAccounting.counters,
            observationReferences:
              inspection.gameplayWorld.progression.actorAccounting
                .registryAuthorityAssessments.map(
                  (item) => item.scriptId + ":" + item.registryExpression,
                ),
          },
        ],
        ...(inspection.gameplayWorld.arenas.basis === undefined
          ? {}
          : { arenaCountBasis: inspection.gameplayWorld.arenas.basis }),
        ...(inspection.gameplayWorld.arenas.layoutStatus === undefined
          ? {}
          : { arenaLayoutStatus: inspection.gameplayWorld.arenas.layoutStatus }),
        ...(inspection.gameplayWorld.arenas.requestedConcurrentArenas === undefined
          ? {}
          : { requestedConcurrentArenas:
              inspection.gameplayWorld.arenas.requestedConcurrentArenas }),
        ...(inspection.gameplayWorld.arenas.safeConcurrentArenas === undefined
          ? {}
          : { safeConcurrentArenas:
              inspection.gameplayWorld.arenas.safeConcurrentArenas }),
        ...(inspection.gameplayWorld.arenas.declaredConcurrentArenaLimit === undefined
          ? {}
          : { declaredConcurrentArenaLimit:
              inspection.gameplayWorld.arenas.declaredConcurrentArenaLimit }),
        ...(inspection.gameplayWorld.arenas.perArenaPlayerCapacity === undefined
          ? {}
          : { perArenaPlayerCapacity:
              inspection.gameplayWorld.arenas.perArenaPlayerCapacity }),
      });

  const mapAuditReport =
    projectMapAuditOutputV2({
      gameplayStructure: gameplayArchitecture.gameplayStructure,
      inspection,
      identity,
      issueLanes: control.issueLanes,
      auditObligations:
        control.auditObligations,
      validationTests:
        control.validationTests,
      honesty: control.honesty,
      ...(Object.keys(reasoningByCausalLinkId).length === 0
        ? {}
        : { reasoningByCausalLinkId }),
      ...(userIntent === undefined
        ? {}
        : { userIntent }),
      control: {
        status: control.status,
        currentStage: control.currentStage,
        allowedNextAction:
          control.allowedNextAction,
        continuationOwner:
          control.continuation.owner,
        requiresNewAuditRun:
          control.continuation.requiresNewAuditRun,
        blockingCheckpointIds:
          [...control.blockingCheckpointIds],
        reasons: [...control.reasons],
      },
      ...(control.fullMapReplica === undefined
        ? {}
        : {
            fullMapReplica:
              control.fullMapReplica,
          }),
    });

  return {
    schemaVersion: 1,
    policy: "selected-map-audit-single-entry",
    inspection,
    identity,
    auditRevision,
    gameplayArchitecture,
    ...(userIntent === undefined
      ? {}
      : { userIntent }),
    demandReconciliation: reconciliation,
    admission,
    stageOrder: SELECTED_MAP_AUDIT_STAGE_ORDER,
    modelTaskPackets,
    mapAuditReport,
    ...control,
  };
}

/**
 * Canonical and only supported starting point for a production selected-map audit.
 * Demand is reconciled monotonically until final RIG requirements are covered.
 */
export async function runSelectedMapAudit(
  input: SelectedMapAuditInput,
): Promise<SelectedMapAuditRun> {
  let userIntent: AuditUserIntentEnvelope | undefined;

  if (input.userIntent !== undefined) {
    const rawIssues =
      validateAuditUserIntent(input.userIntent);
    if (rawIssues.length > 0) {
      throw new Error(
        "Invalid non-authoritative user audit intent: " +
          rawIssues.join("; "),
      );
    }

    userIntent =
      normalizeAuditUserIntent(input.userIntent);
  } else if (
    typeof input.rawUserPrompt === "string" &&
    input.rawUserPrompt.trim().length > 0
  ) {
    userIntent =
      createFallbackAuditUserIntent(
        input.rawUserPrompt,
      );
  }

  if (
    userIntent !== undefined &&
    userIntent.blockingAmbiguities.length > 0
  ) {
    throw new Error(
      "Blocking user-input ambiguity must be resolved before production audit: " +
        userIntent.blockingAmbiguities.join(" | "),
    );
  }

  if (userIntent !== undefined) {
    const confirmationIssues =
      validateAuditUserIntentConfirmation(
        userIntent,
        input.userIntentConfirmation,
      );
    if (confirmationIssues.length > 0) {
      throw new Error(
        "User prompt confirmation required: " +
          confirmationIssues.join("; "),
      );
    }
  }

  const inspectionInput =
    userIntent === undefined
      ? input
      : {
          ...input,
          userIntent,
        };

  const { inspection, reconciliation } =
    await inspectSelectedMapToDemandFixedPoint(
      inspectionInput,
    );

  return assembleSelectedMapAuditRun(
    inspection,
    reconciliation,
    userIntent,
    input.runtimeProbeTranscript,
    input.knowledgeCatalog,
    undefined,
    input.developerPractice,
  );
}

export interface ResolveSelectedMapAuditInput {
  readonly audit: SelectedMapAuditRun;
  readonly basedOnAuditRevision: string;
  readonly runtimeProbeTranscript?: RuntimeProbeTranscript;
  readonly resolutions:
    readonly GameplayDefectResolution[];
}

/**
 * Canonical continuation for source-side defect resolution.
 * It preserves the exact selected-artifact snapshot and recomputes only the
 * resolution-dependent analysis, procedure closure, and ordered admission.
 */
export function resolveSelectedMapAudit(
  input: ResolveSelectedMapAuditInput,
): SelectedMapAuditRun {
  if (
    input.basedOnAuditRevision !==
    input.audit.auditRevision
  ) {
    throw new Error(
      "Refusing stale audit resolution: model/result revision does not match the current SelectedMapAuditRun.",
    );
  }
  const inspection = input.audit.inspection;
  const hidden = refreshHiddenGameplayDefectsForWorld(
    inspection.hiddenGameplayDefects,
    inspection.gameplayWorld,
    inspection.gameplayIntent.model,
    input.resolutions,
  );
  const mandatoryAuditProcedure =
    deriveMandatoryAuditProcedureReceipt({
      artifactId: inspection.artifactId,
      artifactFingerprint: inspection.fingerprint,
      archiveEntries: inspection.archiveEntries,
      discovery:
        inspection.gameplayDiscoveryClosure,
      world: inspection.gameplayWorld,
      intent: inspection.gameplayIntent.model,
      semanticIr: inspection.semanticIrModel,
      boundaries:
        inspection.gameplayBoundaries,
      multiplayer:
        inspection.multiplayerStateValidation,
      hidden,
    });
  const updatedInspection: InspectArtifactResult = {
    ...inspection,
    hiddenGameplayDefects: hidden,
    mandatoryAuditProcedure,
  };
  const nextAudit = assembleSelectedMapAuditRun(
    updatedInspection,
    input.audit.demandReconciliation,
    input.audit.userIntent,
    input.runtimeProbeTranscript,
    undefined,
    input.audit.modelTaskPackets,
  );
  const previousReasoning = Object.fromEntries([
    ...input.audit.mapAuditReport.bugs,
    ...input.audit.mapAuditReport.designMismatches,
  ].flatMap((finding) =>
    finding.reasoning
      ? [[finding.id, finding.reasoning] as const]
      : []
  ));
  const nextReasoning = Object.fromEntries([
    ...nextAudit.mapAuditReport.bugs,
    ...nextAudit.mapAuditReport.designMismatches,
  ].flatMap((finding) =>
    finding.reasoning
      ? [[finding.id, finding.reasoning] as const]
      : []
  ));
  const monotonicityIssues = assessReasoningMonotonicity(
    previousReasoning,
    nextReasoning,
  );
  if (monotonicityIssues.length > 0) {
    throw new Error(
      "Refusing non-monotonic reasoning resolution: " +
      monotonicityIssues.map((issue) =>
        issue.causalLinkId + ": " + issue.reason
      ).join("; "),
    );
  }
  return nextAudit;
}


/**
 * Apply a caller-supplied ChatGPT/model proposal through the EXISTING proof
 * gate. The model cannot create source evidence, close checkpoint tasks, or
 * change an artifact/version/revision. No second detector or state machine.
 */
export function applySelectedMapAuditModelResponses(input: {
  readonly audit: SelectedMapAuditRun;
  readonly responses: SelectedMapAuditModelResponseBatch;
  readonly runtimeProbeTranscript?: RuntimeProbeTranscript;
}): SelectedMapAuditRun {
  const { audit, responses } = input;
  if (
    responses.schemaVersion !== 1 ||
    responses.policy !== "selected-map-audit-model-responses" ||
    responses.artifactId !== audit.identity.artifactId ||
    responses.artifactFingerprint !== audit.identity.artifactFingerprint ||
    responses.auditRevision !== audit.auditRevision
  ) {
    throw new Error(
      "Refusing model responses for a different selected artifact or audit revision.",
    );
  }
  if (!Array.isArray(responses.resolutions) ||
      responses.resolutions.length > 50) {
    throw new Error("Model responses must contain at most 50 bounded resolutions.");
  }
  if (responses.resolutions.length === 0) return audit;

  const graph = audit.inspection.hiddenGameplayDefects.scenarioAudit.graph;
  const byTask = new Map(audit.modelTaskPackets
    .map((task) => [task.id, task] as const));
  const byLink = new Map(graph.causalLinks
    .map((link) => [link.id, link] as const));
  const seenTasks = new Set<string>();
  const seenLinks = new Set<string>();
  const candidateResolutions = new Map(
    audit.inspection.hiddenGameplayDefects.scenarioAudit
      .defectResolution.resolutions
      .map((item) => [item.causalLinkId, item] as const),
  );
  const dispositionSet = new Set<GameplayDefectResolutionDisposition>([
    "CONFIRMED_DEFECT_READY",
    "BLOCKING_COUNTERPROOF",
    "RUNTIME_PROOF_REQUIRED",
    "DETECTION_GAP",
    "GAMEPLAY_TRANSLATION_REQUIRED",
    "COUNTERPROOF_SEARCH_REQUIRED",
  ]);

  for (const answer of responses.resolutions) {
    if (answer === null || typeof answer !== "object" ||
        typeof answer.taskId !== "string" ||
        answer.resolution === null || typeof answer.resolution !== "object") {
      throw new Error("Malformed model response; expected taskId and resolution.");
    }
    const task = byTask.get(answer.taskId);
    const resolution = answer.resolution;
    if (!task ||
        task.auditRevision !== audit.auditRevision ||
        !MODEL_RESOLVABLE_KINDS.has(task.kind) ||
        !task.causalLinkId ||
        task.causalLinkId !== resolution.causalLinkId) {
      throw new Error(
        "Model response does not belong to a resolvable causal task: " +
        answer.taskId,
      );
    }
    const link = byLink.get(task.causalLinkId);
    if (!link ||
        !["CONTRADICTED", "RUNTIME_BLOCKED", "DETECTION_GAP"]
          .includes(link.status) ||
        (resolution.scenarioId !== undefined &&
          resolution.scenarioId !== link.scenarioId) ||
        !dispositionSet.has(resolution.disposition)) {
      throw new Error("Model response has unsupported causal scope/disposition.");
    }
    if (seenTasks.has(task.id) || seenLinks.has(link.id)) {
      throw new Error("Duplicate model response for a task/causal link.");
    }
    seenTasks.add(task.id);
    seenLinks.add(link.id);

    for (const [label, supplied, authorized] of [
      ["subjects", resolution.subjectIds, link.subjectIds],
      ["components", resolution.componentIds, link.componentIds],
      ["knowledge requirements", resolution.knowledgeRequirementIds,
        link.knowledgeRequirementIds],
    ] as const) {
      if (supplied?.some((id: string) => !authorized.includes(id))) {
        throw new Error("Model response cites out-of-scope " + label +
          " for " + link.id + ".");
      }
    }

    const overlaps = (left: readonly string[], right: readonly string[]) =>
      left.some((id) => right.includes(id));
    const related = graph.causalLinks.filter((candidate) =>
      candidate.scenarioId === link.scenarioId &&
      (candidate.id === link.id ||
        overlaps(candidate.subjectIds, link.subjectIds) ||
        overlaps(candidate.componentIds, link.componentIds)));
    const allowedEvidence = new Set([
      ...task.evidenceContext
        .filter((evidence) => evidence.kind === "selected-artifact-evidence")
        .map((evidence) => evidence.id),
      ...related.flatMap((candidate) => [
        ...candidate.evidenceIds,
        ...Object.values(candidate.dimensionEvidence ?? {}).flat(),
      ]),
    ]);
    const claimedEvidence = [
      ...(resolution.evidenceIds ?? []),
      ...(resolution.counterProofEvidenceIds ?? []),
      ...(resolution.counterProofSearch?.evidenceIds ?? []),
      ...(resolution.counterProofSearch?.dimensionReceipts ?? [])
        .flatMap((receipt: { readonly evidenceIds: readonly string[] }) => receipt.evidenceIds),
      ...(resolution.familyProof?.criteria ?? [])
        .flatMap((criterion: { readonly evidenceIds: readonly string[] }) => criterion.evidenceIds),
    ];
    if (claimedEvidence.some((id: string) =>
      typeof id !== "string" ||
      !id.trim() ||
      !allowedEvidence.has(id))) {
      throw new Error(
        "Model response cites unverified or out-of-scope evidence for " +
        link.id + ".",
      );
    }
    if (resolution.disposition === "CONFIRMED_DEFECT_READY") {
      const scenario = graph.scenarios.find((item) =>
        item.id === link.scenarioId);
      const sourceProof = automaticCounterProofSearch(
        graph, link, scenario,
      );
      if (
        link.status !== "CONTRADICTED" ||
        !sourceProof.exhaustiveWithinScope ||
        sourceProof.conclusion !== "NO_BLOCKING_PROOF"
      ) {
        throw new Error(
          "Model cannot promote a defect before the canonical graph proves " +
          "source-bounded counterproof exhaustion. Reinspect new source evidence first.",
        );
      }
    }
    if (resolution.disposition === "BLOCKING_COUNTERPROOF") {
      const blocking = new Set(blockingCounterProofFor(graph, link));
      if (!(resolution.counterProofEvidenceIds?.length) ||
          resolution.counterProofEvidenceIds.some((id: string) => !blocking.has(id))) {
        throw new Error(
          "AI cannot invent a blocking counterproof; no exact PROVEN exclusion supports " +
          link.id + ".",
        );
      }
    }
    candidateResolutions.set(link.id, resolution);
  }

  const candidate = [...candidateResolutions.values()];
  const assessment = assessGameplayDefectResolutionGate(graph, candidate);
  // A global unresolved checkpoint may remain legitimately open. A specific
  // proposed response must not pass through malformed resolution diagnostics.
  const invalid = assessment.issues.filter((issue) =>
    [...seenLinks].some((id) => issue.startsWith(id + ":")) ||
    issue.startsWith("Duplicate defect resolution") ||
    issue.startsWith("Resolution references"));
  if (invalid.length > 0) {
    throw new Error(
      "Model response fails canonical defect resolution: " +
      invalid.join("; "),
    );
  }

  return resolveSelectedMapAudit({
    audit,
    basedOnAuditRevision: audit.auditRevision,
    resolutions: candidate,
    ...(input.runtimeProbeTranscript === undefined
      ? {}
      : { runtimeProbeTranscript: input.runtimeProbeTranscript }),
  });
}

function designMismatchCandidateIssues(
  audit: SelectedMapAuditRun,
  candidates: readonly AuditReportCandidate[],
): readonly string[] {
  // All DESIGN_MISMATCH audit findings stay in their own output lane,
  // including NEED_VALIDATION. A tester-origin candidate is independent
  // only when it does not claim a causal link owned by that lane.
  const designMismatchLinks = new Set(
    audit.issueLanes.DESIGN_MISMATCH.map((item) => item.causalLinkId),
  );
  const issues: string[] = [];

  for (const candidate of candidates) {
    const linkIds = [
      ...new Set([
        ...(candidate.scenarioCausalLinkIds ?? []),
        ...(candidate.scenarioCausalLinkId === undefined
          ? []
          : [candidate.scenarioCausalLinkId]),
      ]),
    ];
    const wrongLane = linkIds.filter(
      (id) => designMismatchLinks.has(id),
    );
    if (wrongLane.length > 0) {
      issues.push(
        "DESIGN_MISMATCH causal link(s) cannot enter Bug Report V2 candidate promotion: " +
          wrongLane.sort().join(", ") +
          ". Keep them in audit.issueLanes.DESIGN_MISMATCH.",
      );
    }
  }

  return [...new Set(issues)].sort();
}

function selectedMapAuditReviewAuthorityIssues(
  audit: SelectedMapAuditRun,
): readonly string[] {
  const issues: string[] = [];

  if (audit.status !== "READY_FOR_REVIEW") {
    issues.push(
      "Selected-map audit is not READY_FOR_REVIEW.",
    );
  }
  if (audit.honesty.status !== "PASS") {
    issues.push(
      "Selected-map audit honesty gate is not PASS.",
    );
  }
  if (
    audit.currentStage !== "COMPLETE" ||
    audit.allowedNextAction !== "PREPARE_REVIEW" ||
    audit.continuation.owner !== "REVIEW"
  ) {
    issues.push(
      "Selected-map audit control state does not authorize review continuation.",
    );
  }

  return issues;
}

export interface PrepareSelectedMapAuditReviewInput {
  readonly audit: SelectedMapAuditRun;
  readonly basedOnAuditRevision: string;
  readonly map: BugReportV2Map;
  readonly candidates: readonly AuditReportCandidate[];
  readonly engineeringAnalyses?: readonly InspectionEngineeringAnalysis[];
  readonly groupResolutions?: readonly ConfirmedDefectGroupResolution[];
}

/**
 * Canonical review continuation. It derives every closure gate from the
 * original audit run, so callers cannot accidentally omit or replace one.
 */
export function prepareSelectedMapAuditReview(
  input: PrepareSelectedMapAuditReviewInput,
): PrepareBugReportReviewFromClosedAuditResult {
  const inspection = input.audit.inspection;
  const authorityIssues =
    selectedMapAuditReviewAuthorityIssues(
      input.audit,
    );
  if (authorityIssues.length > 0) {
    return {
      collection: collectConfirmedDefects(
        input.candidates,
        input.engineeringAnalyses ??
          inspection.engineeringAnalyses,
      ),
      blocked: true,
      reasons: authorityIssues,
    };
  }
  if (
    input.basedOnAuditRevision !==
    input.audit.auditRevision
  ) {
    return {
      collection: collectConfirmedDefects(
        input.candidates,
        input.engineeringAnalyses ??
          inspection.engineeringAnalyses,
      ),
      blocked: true,
      reasons: [
        "Review candidate set was produced from a stale auditRevision.",
      ],
    };
  }
  const scenario =
    inspection.hiddenGameplayDefects.scenarioAudit;
  const identityIssues =
    selectedMapReportIdentityIssues(
      input.audit.identity,
      input.map,
    );
  if (identityIssues.length > 0) {
    return {
      collection: collectConfirmedDefects(
        input.candidates,
        input.engineeringAnalyses ??
          inspection.engineeringAnalyses,
      ),
      blocked: true,
      reasons: identityIssues,
    };
  }
  const rootCauseIssues = [
    ...auditCandidateGroupCoverageIssues(
      input.audit.candidateGroups,
      input.candidates,
    ),
    ...designMismatchCandidateIssues(
      input.audit,
      input.candidates,
    ),
  ];
  if (rootCauseIssues.length > 0) {
    return {
      collection: collectConfirmedDefects(
        input.candidates,
        input.engineeringAnalyses ??
          inspection.engineeringAnalyses,
      ),
      blocked: true,
      reasons: rootCauseIssues,
    };
  }

  const auditAuthority =
    issueSelectedMapAuditAuthority({
      auditRevision: input.audit.auditRevision,
      artifactFingerprint:
        input.audit.identity.artifactFingerprint,
    });
  return prepareBugReportReviewFromAuditCandidates({
    map: input.map,
    auditAuthority,
    files: inspection.fileInventory,
    candidates: input.candidates,
    engineeringAnalyses:
      input.engineeringAnalyses ??
      inspection.engineeringAnalyses,
    ...(input.groupResolutions === undefined
      ? {}
      : { groupResolutions: input.groupResolutions }),
    gameplayDefectResolution:
      scenario.defectResolution,
    mandatoryAuditProcedure:
      inspection.mandatoryAuditProcedure,
  });
}

export interface BuildApprovedBugReportFromAuditInput
  extends PrepareSelectedMapAuditReviewInput {
  readonly approved: ApprovedBugSet;
  readonly repairBy: BugReportV2RepairBy;
}

export interface BuildApprovedBugReportFromAuditResult
  extends BuildBugReportFromAuditResult {
  /**
   * Complete human-facing audit finding set. This is the honest report surface:
   * no material PROVEN or NEED_VALIDATION finding may disappear here.
   */
  readonly findings: {
    readonly BUG: readonly AuditIssueProjection[];
    readonly DESIGN_MISMATCH:
      readonly AuditIssueProjection[];
  };
  readonly proven:
    readonly ReadyAuditIssueProjection[];
  readonly needValidation:
    readonly NeedValidationAuditIssueProjection[];
  readonly designMismatches:
    readonly AuditIssueProjection[];
  readonly auditObligations:
    readonly AuditObligation[];
  readonly validationTests:
    readonly AuditValidationTestGroup[];
  readonly fullMapReplica?: FullMapReplicaReceipt;
}

function completeSelectedMapAuditFindingProjection(
  audit: SelectedMapAuditRun,
): Pick<
  BuildApprovedBugReportFromAuditResult,
  | "findings"
  | "proven"
  | "needValidation"
  | "designMismatches"
  | "auditObligations"
  | "validationTests"
  | "fullMapReplica"
> {
  const all = [
    ...audit.issueLanes.BUG,
    ...audit.issueLanes.DESIGN_MISMATCH,
  ];
  return {
    findings: {
      BUG: audit.issueLanes.BUG,
      DESIGN_MISMATCH:
        audit.issueLanes.DESIGN_MISMATCH,
    },
    proven: all.filter(
      (item): item is ReadyAuditIssueProjection =>
        item.status === "PROVEN",
    ),
    needValidation: all.filter(
      (item): item is NeedValidationAuditIssueProjection =>
        item.status === "NEED_VALIDATION",
    ),
    designMismatches:
      audit.issueLanes.DESIGN_MISMATCH,
    auditObligations:
      audit.auditObligations,
    validationTests:
      audit.validationTests,
    ...(audit.fullMapReplica === undefined
      ? {}
      : {
          fullMapReplica:
            audit.fullMapReplica,
        }),
  };
}

/**
 * Canonical approved Bug Report V2 continuation. It cannot be called without the
 * original SelectedMapAuditRun and therefore cannot bypass procedure closure.
 */
export function buildApprovedBugReportFromAudit(
  input: BuildApprovedBugReportFromAuditInput,
): BuildApprovedBugReportFromAuditResult {
  const inspection = input.audit.inspection;
  const authorityIssues =
    selectedMapAuditReviewAuthorityIssues(
      input.audit,
    );
  if (authorityIssues.length > 0) {
    return {
      ...completeSelectedMapAuditFindingProjection(
        input.audit,
      ),
      collection: collectConfirmedDefects(
        input.candidates,
        input.engineeringAnalyses ??
          inspection.engineeringAnalyses,
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
  if (
    input.basedOnAuditRevision !==
    input.audit.auditRevision
  ) {
    return {
      ...completeSelectedMapAuditFindingProjection(
        input.audit,
      ),
      collection: collectConfirmedDefects(
        input.candidates,
        input.engineeringAnalyses ??
          inspection.engineeringAnalyses,
      ),
      promotion: {
        ok: false,
        issues: [{
          code: "invalid-confirmed-defect" as const,
          message:
            "Report build input was produced from a stale auditRevision.",
        }],
      },
    };
  }
  const scenario =
    inspection.hiddenGameplayDefects.scenarioAudit;
  const identityIssues =
    selectedMapReportIdentityIssues(
      input.audit.identity,
      input.map,
    );
  if (identityIssues.length > 0) {
    return {
      ...completeSelectedMapAuditFindingProjection(
        input.audit,
      ),
      collection: collectConfirmedDefects(
        input.candidates,
        input.engineeringAnalyses ??
          inspection.engineeringAnalyses,
      ),
      promotion: {
        ok: false,
        issues: identityIssues.map((message) => ({
          code: "invalid-confirmed-defect" as const,
          message,
        })),
      },
    };
  }
  const rootCauseIssues = [
    ...auditCandidateGroupCoverageIssues(
      input.audit.candidateGroups,
      input.candidates,
    ),
    ...designMismatchCandidateIssues(
      input.audit,
      input.candidates,
    ),
  ];
  if (rootCauseIssues.length > 0) {
    return {
      ...completeSelectedMapAuditFindingProjection(
        input.audit,
      ),
      collection: collectConfirmedDefects(
        input.candidates,
        input.engineeringAnalyses ??
          inspection.engineeringAnalyses,
      ),
      promotion: {
        ok: false,
        issues: rootCauseIssues.map((message) => ({
          code: "invalid-confirmed-defect" as const,
          message,
        })),
      },
    };
  }

  const auditAuthority =
    issueSelectedMapAuditAuthority({
      auditRevision: input.audit.auditRevision,
      artifactFingerprint:
        input.audit.identity.artifactFingerprint,
    });
  const bugReport =
    buildBugReportFromAuditCandidates({
    map: input.map,
    auditAuthority,
    repairBy: input.repairBy,
    approved: input.approved,
    files: inspection.fileInventory,
    candidates: input.candidates,
    engineeringAnalyses:
      input.engineeringAnalyses ??
      inspection.engineeringAnalyses,
    ...(input.groupResolutions === undefined
      ? {}
      : { groupResolutions: input.groupResolutions }),
    gameplayDefectResolution:
      scenario.defectResolution,
    mandatoryAuditProcedure:
      inspection.mandatoryAuditProcedure,
  });

  return {
    ...bugReport,
    ...completeSelectedMapAuditFindingProjection(
      input.audit,
    ),
  };
}
