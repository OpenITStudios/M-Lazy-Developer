import { performance } from "node:perf_hooks";
import {
  admitReviewedUnknownSourceRelations,
  type GameplayIntentModel,
  type GameplayIntentSourceRelation,
} from "../../gameplay-intent/src/index.js";
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
  withPreparedArtifactInspection,
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
  uniqueGameplayCausalLinkScope,
  type GameplayArchitectureNavigation,
} from "./inspection/gameplay-scenario-model.js";
import {
  projectReviewedSourceRelationships,
} from "./inspection/gameplay-scenario-compiler.js";
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
  reviewAuditModelSourceInterpretation,
  MODEL_RESOLVABLE_KINDS,
  type AuditModelSourceInterpretationProposal,
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
  mergePendingFamilyProof,
  sourceBoundAuditEvidenceIds,
} from "./map-audit-proof-saturation.js";
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
/** Stable import for existing CLI and external clients. Read-only projection owner:
 * reporting/map-audit-model-handoff.ts. Proof/admission remain in this pipeline.
 */
export { projectSelectedMapAuditModelHandoff } from "./reporting/map-audit-model-handoff.js";
export type { SelectedMapAuditModelHandoff } from "./reporting/map-audit-model-handoff.js";

export interface SelectedMapAuditModelResponseBatch {
  readonly schemaVersion: 1;
  readonly policy: "selected-map-audit-model-responses";
  readonly artifactId: string;
  readonly artifactFingerprint: string;
  readonly auditRevision: string;
  readonly resolutions: readonly {
    readonly taskId: string;
    /** Full canonical resolution, or a PROOF_NAVIGATION continuation with
     * only causalLinkId, disposition, optional scenarioId and familyProof.
     * The latter is merged against the same current-revision causal source
     * and accepted only for demonstrably still-missing family criteria.
     */
    readonly resolution: GameplayDefectResolution;
  }[];
  /** Non-authoritative source investigation, not a defect resolution. */
  readonly sourceInterpretations?: readonly AuditModelSourceInterpretationProposal[];
}

function deriveSelectedMapAuditControl(input: {
  readonly admission: SelectedMapAuditAdmission;
  readonly procedure:
    InspectArtifactResult["mandatoryAuditProcedure"];
  readonly scenario:
    InspectArtifactResult["hiddenGameplayDefects"]["scenarioAudit"];
  readonly gameplayIntent: InspectArtifactResult["gameplayIntent"]["model"];
  readonly sourceEffectContext?: GameplayArchitectureNavigation[
    "gameplayStructure"]["uninterpretedSourceFlows"];
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
        intent: input.gameplayIntent,
        ...(input.sourceEffectContext === undefined ? {} :
          { sourceEffectContext: input.sourceEffectContext }),
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
  // Reconcile demand without unpacking the selected map twice. A bounded
  // nonconverged result remains explicit in admission, not an exception
  // that discards usable selected-map evidence.
  return withPreparedArtifactInspection(
    input.artifactPath,
    async (inspect) => {
      const initialRequiredDomains:
        NonNullable<InspectTargetProfile["requiredKnowledgeDomains"]> = [
          ...deriveAuditUserIntentKnowledgeDemand(
            input.userIntent,
          ),
        ];

      const firstStartedAt = performance.now();
      const firstInspection = await inspect(
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
      const firstInspectionElapsedMs = Math.max(
        0, performance.now() - firstStartedAt,
      );
      const firstReconciliation =
        reconcileSelectedMapAuditDemand(
          firstInspection,
          1,
          undefined,
          firstInspectionElapsedMs,
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

      const secondStartedAt = performance.now();
      const secondInspection = await inspect(
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
      const secondInspectionElapsedMs = Math.max(
        0, performance.now() - secondStartedAt,
      );
      const secondReconciliation =
        reconcileSelectedMapAuditDemand(
          secondInspection,
          2,
          firstReconciliation,
          secondInspectionElapsedMs,
        );

      // Do not discard the second, hash-matched inspection just because a
      // dynamic knowledge requirement remains unresolved. The canonical
      // admission gate receives stable=false and blocks review/approval;
      // source-grounded findings and missing domains remain reportable.
      // A third broad reinspection would waste work and is not attempted.
      return {
        inspection: secondInspection,
        reconciliation: secondReconciliation,
      };
    },
    input.expectedArtifactFingerprint,
    input.mapClassificationHint,
  );
}

function assembleSelectedMapAuditRun(
  inspection: InspectArtifactResult,
  reconciliation: AuditDemandReconciliation,
  userIntent?: AuditUserIntentEnvelope,
  runtimeProbeTranscript?: RuntimeProbeTranscript,
  knowledgeCatalog?: KnowledgeCatalog,
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
    demandReconciliation: reconciliation,
  });
  const auditRevision = deriveSelectedMapAuditRevision({
    identity,
    admission,
    procedure,
    graph: scenario.graph,
    defectResolution: scenario.defectResolution,
    ...(userIntent === undefined ? {} : { userIntent }),
  });
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
            // Literal UI copy has no classified gameplay owner by design.
            // It is still canonical Intent evidence for investigation, but
            // must NOT inflate "unlinked semantic evidence" or claim a
            // missing Scenario Graph node for every translation sentence.
            .filter((item) => item.scope === "selected-artifact" &&
              item.playerFacingText === undefined &&
              // Source-only translate-literal sites are independent
              // navigation evidence, not a mechanic needing Scenario Graph
              // placement or proof of delivered UI.
              item.literalTranslationUse === undefined)
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

  const control = deriveSelectedMapAuditControl({
    admission,
    procedure,
    scenario,
    gameplayIntent: inspection.gameplayIntent.model,
    sourceEffectContext:
      gameplayArchitecture.gameplayStructure.uninterpretedSourceFlows,
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
    // The source effect slices are ALREADY constructed by the canonical
    // navigation. Reuse them; never run another analyzer for model context.
    sourceEffectContext:
      gameplayArchitecture.gameplayStructure.uninterpretedSourceFlows,
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
  // Context is re-derived ONLY from explicit current Knowledge/Developer
  // inputs. Reusing a prior model task by ID, query and source locator does
  // not bind its reference source revision, applicability or ZIP snapshot.
  // A source-only continuation without those inputs must abstain rather than
  // silently carry stale reference statements into the next audit revision.
  const modelTaskPackets = freshModelTaskPackets;
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

  const mapAuditReport =
    projectMapAuditOutputV2({
      auditRevision,
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
    input.developerPractice,
  );
}

export interface ResolveSelectedMapAuditInput {
  readonly audit: SelectedMapAuditRun;
  readonly basedOnAuditRevision: string;
  readonly runtimeProbeTranscript?: RuntimeProbeTranscript;
  /** Explicit, current snapshots only; no implicit prior task context reuse. */
  readonly knowledgeCatalog?: KnowledgeCatalog;
  readonly developerPractice?: DeveloperPracticeReferenceData;
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
  return rebuildSelectedMapAudit(
    input.audit,
    input.audit.inspection.gameplayIntent.model,
    input.resolutions,
    input.runtimeProbeTranscript,
    input.knowledgeCatalog,
    input.developerPractice,
  );
}

/** One current-artifact rebuild for canonical defect or source-understanding
 * continuations. Never copy model prose into the selected-map semantic model.
 */
function rebuildSelectedMapAudit(
  audit: SelectedMapAuditRun,
  intent: GameplayIntentModel,
  resolutions: readonly GameplayDefectResolution[],
  runtimeProbeTranscript?: RuntimeProbeTranscript,
  knowledgeCatalog?: KnowledgeCatalog,
  developerPractice?: DeveloperPracticeReferenceData,
): SelectedMapAuditRun {
  const inspection = audit.inspection;
  const hidden = refreshHiddenGameplayDefectsForWorld(
    inspection.hiddenGameplayDefects,
    inspection.gameplayWorld,
    intent,
    resolutions,
  );
  const mandatoryAuditProcedure =
    deriveMandatoryAuditProcedureReceipt({
      artifactId: inspection.artifactId,
      artifactFingerprint: inspection.fingerprint,
      archiveEntries: inspection.archiveEntries,
      discovery:
        inspection.gameplayDiscoveryClosure,
      world: inspection.gameplayWorld,
      intent,
      semanticIr: inspection.semanticIrModel,
      boundaries:
        inspection.gameplayBoundaries,
      multiplayer:
        inspection.multiplayerStateValidation,
      hidden,
    });
  const updatedInspection: InspectArtifactResult = {
    ...inspection,
    gameplayIntent: {
      ...inspection.gameplayIntent,
      model: intent,
    },
    hiddenGameplayDefects: hidden,
    mandatoryAuditProcedure,
  };
  const nextAudit = assembleSelectedMapAuditRun(
    updatedInspection,
    audit.demandReconciliation,
    audit.userIntent,
    runtimeProbeTranscript,
    knowledgeCatalog,
    developerPractice,
  );
  const previousReasoning = Object.fromEntries([
    ...audit.mapAuditReport.bugs,
    ...audit.mapAuditReport.designMismatches,
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
  readonly knowledgeCatalog?: KnowledgeCatalog;
  readonly developerPractice?: DeveloperPracticeReferenceData;
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
  const interpretations = responses.sourceInterpretations ?? [];
  if (!Array.isArray(interpretations) || interpretations.length > 12) {
    throw new Error("Model source interpretations must be a bounded array of at most 12.");
  }
  if (interpretations.length > 0 && responses.resolutions.length > 0) {
    throw new Error("Cannot mix source interpretation reviews with causal resolutions.");
  }
  if (interpretations.length > 0) {
    const tasks = new Map(audit.modelTaskPackets.map(task => [task.id, task] as const));
    const reviewsByTask = new Map<string,
      ReturnType<typeof reviewAuditModelSourceInterpretation>[]>();
    const acceptedSourcePairs: {
      readonly unknownId: string;
      readonly fromStepId: string;
      readonly toStepId: string;
      readonly sourceClaim: GameplayIntentSourceRelation["sourceClaim"];
      readonly sourceRelationEvidenceIds: readonly string[];
    }[] = [];
    const seen = new Set<string>();
    for (const proposal of interpretations) {
      if (!proposal || typeof proposal !== "object") {
        throw new Error("Malformed model source interpretation.");
      }
      const task = tasks.get(proposal.taskId);
      if (!task || task.auditRevision !== audit.auditRevision) {
        throw new Error("Source interpretation has no current matching model task.");
      }
      const key = task.id + "\u0000" + proposal.unknownId;
      if (seen.has(key)) {
        throw new Error("Duplicate source interpretation for one task and unknown.");
      }
      seen.add(key);
      const review = reviewAuditModelSourceInterpretation(
        task, proposal, audit.identity.artifactId);
      // Only a positive typed relation from a source-rooted, current
      // SourceEffectSlice may re-enter Gameplay Intent; a missing ingress,
      // truncated interpretation or a same-branch absence-of-refutation
      // cannot become independent semantic evidence.
      const entry = task.sourceInvestigation?.entries.find(item =>
        item.unknownId === proposal.unknownId);
      const effect = entry?.effectPaths?.find(item =>
        proposal.sourceClaim === "SOURCE_GUARD_VALUE_HANDOFF_CANDIDATE"
          ? item.effectId === proposal.toStepId &&
            item.sourceLocalStateValueHandoffs.some(handoff =>
              handoff.writeOperationId === proposal.fromStepId &&
              item.guardStateReadIds.includes(handoff.guardReadOperationId))
          : proposal.sourceClaim === "SOURCE_EFFECT_RETURN_CANDIDATE"
            ? item.effectId === proposal.fromStepId &&
              item.candidateOutcomeIds.includes(proposal.toStepId)
            : false);
      if (review.disposition === "SOURCE_RELATION_CANDIDATE" &&
          review.sourceRelationEvidenceIds?.length === 2 &&
          entry?.sourceTraceStatus === "SOURCE_ROOT_TRACE" &&
          effect?.evidenceStatus === "CANDIDATE_INGRESS" &&
          (proposal.sourceClaim === "SOURCE_GUARD_VALUE_HANDOFF_CANDIDATE" ||
           proposal.sourceClaim === "SOURCE_EFFECT_RETURN_CANDIDATE")) {
        acceptedSourcePairs.push({
          unknownId: review.unknownId,
          fromStepId: review.fromStepId,
          toStepId: review.toStepId,
          sourceClaim: proposal.sourceClaim,
          sourceRelationEvidenceIds: review.sourceRelationEvidenceIds,
        });
      }
      reviewsByTask.set(task.id, [
        ...(reviewsByTask.get(task.id) ?? []), review,
      ]);
    }
    // A review with no admitted typed relation remains an ephemeral,
    // non-authoritative diagnostic exactly as before. A POSITIVE source
    // relation is instead projected through the existing canonical Intent
    // and Scenario Graph without inventing nodes, objectives or proof.
    const refinedIntent = acceptedSourcePairs.length === 0
      ? audit.inspection.gameplayIntent.model
      : admitReviewedUnknownSourceRelations(
          audit.inspection.gameplayIntent.model, acceptedSourcePairs);
    // The same canonical Scenario compiler must still find ONE rooted,
    // selected-source owner for every proposed source pair. Otherwise the
    // review remains advisory and the unchanged audit keeps its unknown.
    // Never write a relation that disappears from graph/revision authority.
    const projected = acceptedSourcePairs.length === 0
      ? []
      : projectReviewedSourceRelationships(
          refinedIntent,
          audit.inspection.hiddenGameplayDefects.scenarioAudit.graph
            .sourceFlowCandidates ?? [],
        );
    const allCurrentSourcePairs = acceptedSourcePairs.every(pair =>
      projected.some(item =>
        item.unknownId === pair.unknownId &&
        item.sourceClaim === pair.sourceClaim &&
        item.fromStepId === pair.fromStepId &&
        item.toStepId === pair.toStepId));
    const continued = refinedIntent === audit.inspection.gameplayIntent.model ||
        !allCurrentSourcePairs
      ? audit
      : rebuildSelectedMapAudit(
          audit,
          refinedIntent,
          audit.inspection.hiddenGameplayDefects.scenarioAudit
            .defectResolution.resolutions,
          input.runtimeProbeTranscript,
          input.knowledgeCatalog,
          input.developerPractice,
        );
    return {
      ...continued,
      modelTaskPackets: continued.modelTaskPackets.map(task => {
        const { sourceInterpretationReviews: _prior, ...canonicalTask } = task;
        const reviews = reviewsByTask.get(task.id);
        return reviews === undefined ? canonicalTask : {
          ...canonicalTask, sourceInterpretationReviews: reviews,
        };
      }),
    };
  }
  if (responses.resolutions.length === 0) return audit;

  const graph = audit.inspection.hiddenGameplayDefects.scenarioAudit.graph;
  const byTask = new Map(audit.modelTaskPackets
    .map((task) => [task.id, task] as const));
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
    // Model narrative cannot choose a component identity that canonical
    // Scenario Closure/PROVE has already found ambiguous. This check must
    // occur even when the model supplies no evidence IDs.
    const link = uniqueGameplayCausalLinkScope(
      graph, task.causalLinkId,
    )?.link;
    if (!link ||
        !["CONTRADICTED", "RUNTIME_BLOCKED", "DETECTION_GAP"]
          .includes(link.status) ||
        (resolution.scenarioId !== undefined &&
          resolution.scenarioId !== link.scenarioId) ||
        !dispositionSet.has(resolution.disposition)) {
      throw new Error("Model response has unsupported or ambiguous causal scope/disposition.");
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

    // A model task is a read-only navigation hint, not an evidence owner.
    // Admission must use precisely the same unique-link, typed-dimension,
    // satisfied-Knowledge authority as PROVE and REPORT. Neighboring links
    // and a task's broader source context cannot add proof.
    const allowedEvidence = new Set(
      sourceBoundAuditEvidenceIds(graph, link.id),
    );
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
    const prior = candidateResolutions.get(link.id);
    // A bounded AI task may prove just ONE missing family criterion.
    // Do not overwrite earlier verified translation, counter-proof or family
    // evidence when the response intentionally contains only that delta.
    // Full resolution replacements retain their existing behavior and
    // canonical validation below; no second evidence store is created.
    const incrementalFamilyOnly =
      task.kind === "PROOF_NAVIGATION" &&
      prior?.disposition === "CONFIRMED_DEFECT_READY" &&
      resolution.disposition === "CONFIRMED_DEFECT_READY" &&
      resolution.familyProof !== undefined &&
      Object.keys(resolution).every(key =>
        key === "causalLinkId" || key === "scenarioId" ||
        key === "disposition" || key === "familyProof");
    candidateResolutions.set(
      link.id,
      incrementalFamilyOnly && prior !== undefined
        ? mergePendingFamilyProof(graph, prior, resolution)
        : resolution,
    );
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
    ...(input.knowledgeCatalog === undefined ? {} :
      { knowledgeCatalog: input.knowledgeCatalog }),
    ...(input.developerPractice === undefined ? {} :
      { developerPractice: input.developerPractice }),
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
