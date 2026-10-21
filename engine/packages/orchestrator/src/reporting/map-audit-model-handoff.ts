/** Read-only selected-map model handoff over the SINGLE canonical audit.
 * Neither model task eligibility nor navigation is gameplay/defect proof.
 * Canonical audit admission and response mutations remain in map-audit-pipeline.ts.
 */
import type { MapAuditOutputV2 } from "../map-audit-output-v2.js";
import type { AuditModelTaskPacket } from "../map-audit-model-task.js";
import { MODEL_RESOLVABLE_KINDS } from "../map-audit-model-task.js";
import type { SelectedMapAuditRun } from "../map-audit-pipeline.js";

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
      readonly source: import("../../../project-model/src/index.js").SourceRef;
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

