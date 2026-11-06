import { operatorMapTestStageFor, type OperatorMapTestStage } from "./map-audit-admission.js";
import { CANONICAL_PLAYER_FLOW_STAGES } from "../../diagnostic-reasoning/src/gameplay-audit-scenario-preset.js";
import type {
  GameDesignMapClassification,
} from "../../game-design-spec/src/index.js";
import {
  hasIndependentApprovedDesignEvidence,
  type GameplayIntentEdge,
  type GameplayIntentModel,
  type GameplayIntentNode,
} from "../../gameplay-intent/src/index.js";
import type {
  InspectArtifactResult,
} from "./inspection/inspect-artifact.js";
import type {
  SelectedMapAuditIdentity,
} from "./map-audit-identity.js";
import type {
  AuditIssueProjection,
  NeedValidationAuditIssueProjection,
} from "./map-audit-issue-projection.js";
import type {
  AuditValidationTestGroup,
} from "./map-audit-validation-plan.js";
import type {
  AuditHonestyAssessment,
} from "./map-audit-honesty.js";
import type {
  FullMapReplicaReceipt,
} from "./arena/full-map-replica-receipt.js";
import type {
  AuditObligation,
} from "./map-audit-obligations.js";
import type { SourceRef } from "../../project-model/src/index.js";
import type {
  GameplayArchitectureNavigation,
  GameplayCausalLink,
} from "./inspection/gameplay-scenario-model.js";
import {
  assessQaPositiveSourceCoverage,
  type QaPositiveSourceCoverageAssessment,
} from "./inspection/gameplay-defect-resolution.js";
import type {
  AuditUserIntentEnvelope,
} from "./map-audit-user-intent.js";
import {
  deriveMapAuditQualityGates,
  type MapAuditQualityGates,
} from "./map-audit-quality-gates.js";

export interface MapAuditOutputV2FindingReasoning {
  readonly reportClassification:
    | "PROVEN BUG"
    | "LIKELY BUG"
    | "RISK"
    | "DESIGN MISMATCH"
    | "UNKNOWN"
    | "EXPECTED";
  readonly diagnosticDisposition?: string;
  readonly proofConfidence:
    | "unknown"
    | "low"
    | "medium"
    | "high"
    | "proven";
  readonly evidenceDomainSources: readonly string[];
  readonly evidenceChain: readonly string[];
  readonly unresolvedPredicates: readonly string[];
  readonly recommendedValidationPredicate?: string;
  readonly recommendedReadOnlyProbeId?: string;
}

export interface MapAuditOutputV2Finding {
  readonly id: string;
  readonly status: "PROVEN" | "NEED_VALIDATION";
  readonly issueType: "BUG" | "DESIGN_MISMATCH";
  readonly gameplayFlow: string;
  readonly failureDomain: string;
  readonly contributingDomains: readonly string[];
  readonly informationMismatch: boolean;
  readonly playerFacingEvidenceIds: readonly string[];
  readonly issue: string;
  readonly playerImpact: string;
  /** Current selected-map context; never invented test preconditions. */
  readonly scenarioLabel?: string;
  readonly affectedScope?: string;
  /** Reason from this exact contradicted source-evidenced causal link. */
  readonly causalExplanation?: string;
  readonly reproduceSteps: readonly string[];
  readonly expected: string;
  readonly actual: string;
  readonly evidenceIds: readonly string[];
  /** Source-owned knowledge obligations for this finding, when present. */
  readonly knowledgeRequirementIds?: readonly string[];
  readonly proofCeiling:
    | "PROVEN"
    | "NEEDS_DECIDING_PROOF";
  readonly counterEvidence:
    | "cleared"
    | "unresolved";
  readonly validationReason?: string;
  readonly missingProof?: string;
  readonly validationTest?: string;
  readonly validationGroupKey?: string;
  readonly proofNavigation?:
    NeedValidationAuditIssueProjection["proofNavigation"];
  readonly reasoning?: MapAuditOutputV2FindingReasoning;
}

export interface MapAuditOutputControl {
  readonly status: "READY_FOR_REVIEW" | "BLOCKED";
  /** Public LOAD/UNDERSTAND/TEST/REPORT stage. The seven legacy internal
   * currentStage states remain source-proof/admission detail.
   */
  readonly operatorStage?: OperatorMapTestStage;
  readonly currentStage:
    | "TARGET"
    | "DISCOVERY"
    | "UNDERSTAND"
    | "FORMALIZE"
    | "EVALUATE"
    | "PROVE"
    | "REPORT"
    | "COMPLETE";
  readonly allowedNextAction:
    | "RESOLVE_BLOCKING_STAGE"
    | "RESOLVE_DEFECTS"
    | "PREPARE_REVIEW";
  readonly continuationOwner:
    | "ENGINE_OR_EVIDENCE"
    | "DEFECT_RESOLUTION"
    | "REVIEW";
  readonly requiresNewAuditRun: boolean;
  readonly blockingCheckpointIds: readonly string[];
  readonly reasons: readonly string[];
}

/**
 * Derived QA navigation. Evidence on the same gameplay scenario can guide
 * investigation but NEVER closes an individual requirement or proves a game.
 */
export interface MapAuditQaCoverage {
  readonly authority: "READ_ONLY_QA_NAVIGATION_NOT_PROOF";
  readonly profile: "RESOLVED_HINT_ROUTING_ONLY" |
    "SOURCE_BOUND_PER_MODE_ROUTING_ONLY" |
    "UNRESOLVED_SOURCE_CANDIDATES";
  readonly activityScope: "NO_SELECTED_SOURCE_ACTIVITY" | "SOURCE_ACTIVITY_CANDIDATES_SCOPE_UNVERIFIED";
  readonly sourceActivities: readonly {
    readonly subjectId: string;
    readonly kind: "game" | "mechanic" | "objective";
    readonly label: string;
    readonly evidenceIds: readonly string[];
  }[];
  readonly omittedSourceActivities: number;
  /** Explicit selected-source game/subject graph, not resolved game modes.
   * Each node retains its actual source edge and never borrows a genre.
   */
  readonly gameScopes?: readonly {
    readonly gameSubjectId: string;
    readonly gameLabel: string;
    readonly sourceEvidenceIds: readonly string[];
    readonly directRelations: readonly {
      readonly edgeId: string;
      readonly edgeKind: string;
      readonly relatedSubjectId: string;
      readonly relatedKind: string;
      readonly edgeEvidenceIds: readonly string[];
    }[];
    readonly omittedDirectRelations: number;
    readonly sharedSubjectIds: readonly string[];
    readonly classificationBoundary: "EXACT_SOURCE_EDGES_NOT_MODE_OR_GAME_TYPE";
  }[];
  readonly omittedGameScopes?: number;
  readonly unscopedActivitySubjectIds?: readonly string[];
  readonly omittedUnscopedActivities?: number;
  /** One exact map-hint claim per minigame. Failed source binding is explicit. */
  readonly modeClassifications?: readonly {
    readonly modeId: string;
    readonly gameSubjectId: string;
    readonly mapType: string;
    readonly playerMode: string;
    readonly status: "SOURCE_SCOPED_ROUTING_ONLY" | "SOURCE_BINDING_UNRESOLVED";
    readonly evidenceIds: readonly string[];
    readonly proof: "MODE_HINT_SOURCE_CORRELATION_NOT_GAMEPLAY_PROOF";
  }[];
  readonly selected: number;
  /** Canonically PROVEN violations tied to their exact QA invariants. */
  readonly confirmedViolations?: number;
  /** Source-level candidate evidence, NEVER QA PASS or native Minecraft proof. */
  readonly sourceRelationsAccounted?: number;
  /** No full QA PASS is inferred from a missing bug or one counterproof. */
  readonly proofBound: 0;
  readonly checks: readonly {
    readonly id: string;
    readonly scenarioId: string;
    readonly question: string;
    readonly status: "QA_SPECIFIC_PROOF_UNRESOLVED" | "QA_VIOLATION_PROVEN";
    readonly scenarioSourceEvidenceIds: readonly string[];
    readonly relatedCausalLinkIds: readonly string[];
    readonly omittedScenarioEvidence: number;
    readonly omittedRelatedLinks: number;
    readonly evidenceRole: "SCENARIO_SCOPE_NAVIGATION_NOT_REQUIREMENT_PROOF";
    /** Source-positive investigation from canonical graph, not a SAFE decision. */
    readonly positiveSourceCoverage?: QaPositiveSourceCoverageAssessment;
    /** Only an admitted canonical PROVE resolution + exact PROVEN finding
     * can supply this source violation. It never constitutes a QA PASS.
     */
    readonly qaViolation?: {
      readonly qaInvariantId: string;
      readonly causalLinkId: string;
      readonly scenarioId: string;
      readonly issueType: "BUG" | "DESIGN_MISMATCH";
      readonly evidenceIds: readonly string[];
      readonly proof: "CANONICAL_PROVE_ADMITTED_EXACT_QA_VIOLATION";
    };
    readonly modeScope?: {
      readonly modeId: string;
      readonly gameSubjectId: string;
      readonly evidenceIds: readonly string[];
      readonly proof: "EXACT_SOURCE_GAME_MODE_ROUTING_NOT_QA_PROOF";
    };
    /** Exact QA IDs can optionally be authored as Gameplay Intent invariants
     * (id = QA code or "qa:" + code). An associated causal link or even
     * a PROVEN issue is NOT a requirement-specific QA verdict.
     */
    readonly exactSourceQaRule?: {
      readonly status:
        "NO_EXACT_SELECTED_SOURCE_RULE" |
        "AMBIGUOUS_EXACT_SOURCE_RULE" |
        "EXACT_RULE_SUBJECT_SCOPE_UNRESOLVED" |
        "MODE_SCOPE_RULE_UNRESOLVED" |
        "EXACT_SOURCE_RULE_WITH_CAUSAL_LEADS";
      readonly invariantIds: readonly string[];
      readonly subjectIds: readonly string[];
      readonly sourceEvidenceIds: readonly string[];
      readonly selectedApprovedDesignEvidence: boolean;
      readonly relatedCausalLinkIds: readonly string[];
      readonly relatedProvenFindingIds: readonly string[];
      readonly omittedRelatedLinks: number;
      readonly proof: "QA_SOURCE_RULE_TO_CAUSAL_LEADS_NOT_QA_VERDICT";
    };
  }[];
}

export interface MapAuditOutputV2 {
  readonly schemaVersion: 2;
  readonly artifactId: string;
  /** SHA-256 of selected archive bytes, always projected by current engine.
   * Optional for legacy V2 data, not an attestation of executable Git commit.
   */
  readonly artifactFingerprint?: string;
  /** Canonical decision/proof revision for joining report and model handoff.
   * Optional for legacy V2 data; always emitted by runSelectedMapAudit().
   * This is NOT an attestation of TypeScript execution or Minecraft runtime.
   */
  readonly auditRevision?: string;
  /** Configured audit target, not a verified Minecraft runtime platform. */
  readonly auditTarget?: {
    readonly edition: "bedrock" | "education" | "unknown";
    readonly minecraftVersion?: string;
    readonly source: "selected-audit-runtime-target-not-live-observation";
  };
  readonly mapVersion: string;
  readonly control: MapAuditOutputControl;
  readonly userIntent?: AuditUserIntentEnvelope;
  readonly mapClassification?: {
    readonly use: "audit-routing-only";
    readonly classification:
      GameDesignMapClassification;
  };
  /** Derived QA-ID investigation navigation, NOT executed or PROVEN tests. */
  readonly qaCoverage?: MapAuditQaCoverage;
  readonly evidenceScope: {
    readonly mode: "selected-map-version-only";
    readonly selectedArtifact: string;
    readonly archiveSourcesUsed: false;
  };
  readonly gameDesign: {
    readonly objective: string;
    readonly objectiveGrounding:
      | "authored"
      | "inferred"
      | "unresolved";
    readonly winCondition: string;
    readonly winConditionGrounding:
      | "authored"
      | "inferred"
      | "unresolved";
    readonly loseCondition: string;
    readonly loseConditionGrounding:
      | "authored"
      | "inferred"
      | "unresolved";
    readonly resetRules: readonly string[];
    readonly preserveRules: readonly string[];
    readonly progressionRules: readonly string[];
  };
  /** Audit checklist stages, NOT a reconstructed or observed player route. */
  readonly gameplayFlow: readonly string[];
  readonly gameplayFlowBasis: "AUDIT_CHECKLIST_NOT_OBSERVED_GAMEPLAY";
  /** Derived game-centric source navigation; not a second Game Design or bug authority. */
  readonly gameplayStructure?: GameplayArchitectureNavigation["gameplayStructure"];
  readonly stateTransitions: readonly {
    readonly from: string;
    readonly event: string;
    readonly to: string;
    readonly notes?: string;
  }[];
  readonly multiArena: {
    readonly detected: boolean;
    readonly visibleArenaCount: number | null;
    /** Authored arena IDs; not a physical or active arena count. */
    readonly declaredArenaCount?: number | null;
    readonly declaredConcurrentArenaLimit: number | null;
    readonly safeConcurrentArenaLimit: number | null;
    readonly queueBehavior: string;
    readonly isolationRules: readonly string[];
  };
  readonly coverage: {
    readonly disposition:
      | "accounted"
      | "incomplete";
    readonly records: readonly {
      readonly surface: string;
      /** Preserve the canonical Gameplay Closure surface state. UNKNOWN is
       * missing evidence, not an observed blocked gameplay path.
       */
      readonly status:
        | "understood"
        | "blocked"
        | "unknown"
        | "not-applicable";
      readonly reason?: string;
      readonly evidenceIds: readonly string[];
    }[];
  };
  readonly gameplayClosure: {
    readonly status: "CLOSED" | "PARTIAL" | "OPEN";
    readonly surfaceInventory: readonly {
      readonly id: string;
      readonly label: string;
      readonly kind: string;
      readonly status:
        | "understood"
        | "blocked"
        | "unknown"
        | "not-applicable";
      readonly reason?: string;
      readonly boundaries: readonly string[];
    }[];
    readonly stateModelComplete: boolean;
    readonly boundariesExtracted: boolean;
    readonly unaccountedSurfaceIds: readonly string[];
    readonly notes: string;
  };
  readonly bugs: readonly MapAuditOutputV2Finding[];
  readonly designMismatches:
    readonly MapAuditOutputV2Finding[];
  readonly auditObligations?:
    readonly AuditObligation[];
  readonly validationTests:
    readonly AuditValidationTestGroup[];
  /**
   * Derived visibility index only. It never changes issue type/proof state and
   * exists so gray-zone evidence cannot disappear from the human report.
   */
  readonly unresolved: {
    readonly status:
      | "CLEAR"
      | "HAS_UNRESOLVED";
    readonly total: number;
    readonly needValidationIds: readonly string[];
    readonly staticProofPendingIds: readonly string[];
    readonly runtimeRequiredIds: readonly string[];
    readonly auditObligationIds: readonly string[];
    readonly unknownSurfaceIds: readonly string[];
    /** Exact unresolved source-call/scheduler IDs from selected-map
     * Discovery A2. Optional for existing V2 readers; never game or bug proof.
     */
    readonly unresolvedSourceLinkIds?: readonly string[];
    /** Bounded source-only deferred mutation candidates from the existing
     * Arena Lifecycle owner. These investigative leads are NOT included in
     * unresolved.total/status, never proof-gated audit obligations or BUGs.
     * Optional so existing V2 consumers remain valid.
     */
    readonly deferredMutationOwnership?: {
      readonly total: number;
      readonly samples: readonly {
        readonly scheduler: "run" | "runTimeout" | "runInterval" | "runJob";
        readonly source: SourceRef;
        readonly status:
          | "source-guard-candidate"
          | "source-snapshot-candidate"
          | "unresolved";
        readonly reason: string;
      }[];
      readonly omitted: number;
    };
  };
  readonly honesty: AuditHonestyAssessment;
  readonly qualityGates: MapAuditQualityGates;
  readonly fullMapReplica?: FullMapReplicaReceipt;
}

function nodeText(
  node: GameplayIntentNode | undefined,
): string | undefined {
  const value =
    node?.description?.trim() ||
    node?.label.trim();
  return value || undefined;
}

/** Duplicated evidence IDs have no unique current-artifact owner. */
function uniquelyOwnedSelectedEvidence(model: GameplayIntentModel) {
  const byId = new Map<string, GameplayIntentModel["evidence"][number]>();
  const ambiguous = new Set<string>();
  for (const evidence of model.evidence ?? []) {
    if (byId.has(evidence.id)) ambiguous.add(evidence.id);
    else byId.set(evidence.id, evidence);
  }
  for (const id of ambiguous) byId.delete(id);
  for (const [id, evidence] of byId) {
    if (evidence.scope !== "selected-artifact") byId.delete(id);
  }
  return byId;
}

function selectedSourceIds(model: GameplayIntentModel): Set<string> {
  return new Set(uniquelyOwnedSelectedEvidence(model).keys());
}

/** Duplicate node IDs cannot author a unique gameplay relationship. */
function uniquelyOwnedNodes(model: GameplayIntentModel) {
  const byId = new Map<string, GameplayIntentNode>();
  const ambiguous = new Set<string>();
  for (const node of model.nodes ?? []) {
    if (byId.has(node.id)) ambiguous.add(node.id);
    else byId.set(node.id, node);
  }
  for (const id of ambiguous) byId.delete(id);
  return byId;
}

function independentlyAuthoredDesign(
  model: GameplayIntentModel,
  ids: readonly string[],
): boolean {
  const byId = uniquelyOwnedSelectedEvidence(model);
  return hasIndependentApprovedDesignEvidence(ids.map(id => byId.get(id)));
}

/**
 * Preserve a bounded view of distinct selected-artifact design candidates.
 * Their source identity is retained in the original GameplayIntentModel;
 * textual alternatives do not establish mutual reachability or mode scope.
 */
function summarizeSourceAlternatives(
  subject: string,
  missingScope: string,
  statements: readonly string[],
): string {
  const shown = statements.slice(0, 3).map(statement =>
    JSON.stringify(statement.replace(/\s+/g, " ").trim().slice(0, 65)),
  );
  const omitted = statements.length - shown.length;
  return "Multiple source-backed " + subject + " (" + statements.length +
    "; " + missingScope + " unresolved): " + shown.join("; ") +
    (omitted > 0 ? "; +" + omitted + " further candidates." : ".");
}

function summarizeSourceObjectives(model: GameplayIntentModel): {
  readonly text: string;
  readonly grounding: "authored" | "inferred" | "unresolved";
} {
  const selected = selectedSourceIds(model);
  const uniqueNodes = uniquelyOwnedNodes(model);
  const candidates = (model.nodes ?? []).filter(node =>
    uniqueNodes.get(node.id) === node &&
    node.kind === "objective" && node.status !== "hypothesis" &&
    node.evidenceIds.some(id => selected.has(id)))
    .sort((left, right) => left.id.localeCompare(right.id));
  if (candidates.length === 0) return {
    text: "Unresolved from selected artifact.",
    grounding: "unresolved",
  };
  // Multiple real modes can have different objectives. Do not collapse
  // their selected-source statements to an unhelpful count, and do not imply
  // that any candidate is the one map-wide/player-wide objective.
  if (candidates.length > 1) return {
    text: summarizeSourceAlternatives(
      "objective candidates",
      "player/mode scope",
      candidates.map(node => nodeText(node) ?? node.id),
    ),
    grounding: "unresolved",
  };
  const node = candidates[0]!;
  return {
    text: nodeText(node) ?? "Unresolved from selected artifact.",
    grounding: node.status === "authored" &&
      independentlyAuthoredDesign(model, node.evidenceIds)
      ? "authored" : "inferred",
  };
}

function edgeStatement(
  edge: GameplayIntentEdge,
  nodes: ReadonlyMap<string, GameplayIntentNode>,
): string {
  if (edge.description?.trim()) {
    return edge.description.trim();
  }
  const from =
    nodeText(nodes.get(edge.from)) ?? edge.from;
  const to =
    nodeText(nodes.get(edge.to)) ?? edge.to;
  return from + " " + edge.kind + " " + to;
}

function outcomeFor(
  model: GameplayIntentModel,
  kind: "wins-by" | "loses-by",
): {
  readonly text: string;
  readonly grounding: "authored" | "inferred" | "unresolved";
} | undefined {
  const nodes = uniquelyOwnedNodes(model);
  const source = selectedSourceIds(model);
  const current = (ids: readonly string[]) =>
    ids.some(id => source.has(id));
  const candidates = (model.edges ?? []).filter(edge =>
    edge.kind === kind && edge.status !== "hypothesis" &&
    current(edge.evidenceIds) &&
    current(nodes.get(edge.from)?.evidenceIds ?? []) &&
    current(nodes.get(edge.to)?.evidenceIds ?? []))
    .sort((left, right) => left.id.localeCompare(right.id));
  if (candidates.length > 1) return {
    text: summarizeSourceAlternatives(
      kind + " relations",
      "mode/player scope",
      candidates.map(edge => edgeStatement(edge, nodes)),
    ),
    grounding: "unresolved",
  };
  const edge = candidates[0];
  if (edge === undefined) return undefined;
  return {
    text: edgeStatement(edge, nodes),
    grounding: edge.status === "authored" &&
      independentlyAuthoredDesign(model, edge.evidenceIds)
      ? "authored" : "inferred",
  };
}

function projectFinding(
  finding: AuditIssueProjection,
  reasoningByCausalLinkId?: Readonly<Record<string, MapAuditOutputV2FindingReasoning>>,
  causalExplanation?: string,
): MapAuditOutputV2Finding {
  const base = {
    id: finding.causalLinkId,
    status: finding.status,
    issueType: finding.issueType,
    gameplayFlow: finding.gameplayFlow,
    failureDomain: finding.failureDomain,
    contributingDomains:
      [...finding.contributingDomains],
    informationMismatch:
      finding.informationMismatch,
    playerFacingEvidenceIds:
      [...finding.playerFacingEvidenceIds],
    // Report the exact source discrepancy as the problem and its separate
    // player-facing consequence as impact; neither is an executed playtest.
    issue: finding.actualOutcome,
    playerImpact: finding.gameplayConsequence,
    ...(finding.scenarioLabel.trim()
      ? { scenarioLabel: finding.scenarioLabel.trim() } : {}),
    ...(finding.affectedScope.trim()
      ? { affectedScope: finding.affectedScope.trim() } : {}),
    ...(causalExplanation?.trim()
      ? { causalExplanation: causalExplanation.trim() } : {}),
    reproduceSteps: [
      finding.gameplayTrigger,
      "Observe whether: " + finding.actualOutcome,
    ],
    expected: finding.expectedOutcome,
    actual: finding.actualOutcome,
    evidenceIds: [...finding.evidenceIds],
    ...(finding.knowledgeRequirementIds?.length
      ? { knowledgeRequirementIds: [...new Set(finding.knowledgeRequirementIds)].sort() }
      : {}),
    proofCeiling:
      finding.status === "PROVEN"
        ? "PROVEN" as const
        : "NEEDS_DECIDING_PROOF" as const,
    counterEvidence:
      finding.status === "PROVEN"
        ? "cleared" as const
        : "unresolved" as const,
    ...(reasoningByCausalLinkId?.[finding.causalLinkId] === undefined
      ? {}
      : { reasoning: reasoningByCausalLinkId[finding.causalLinkId] }),
  };

  if (finding.status === "PROVEN") {
    return base;
  }

  if (finding.proofNavigation === undefined) {
    throw new Error(
      "NEED_VALIDATION finding is missing proofNavigation: " +
        finding.causalLinkId +
        ".",
    );
  }

  return {
    ...base,
    validationReason:
      finding.validationReason,
    missingProof:
      finding.missingProof,
    validationTest:
      finding.validationTest,
    validationGroupKey:
      finding.validationGroupKey,
    proofNavigation:
      finding.proofNavigation,
  };
}

/** Do not borrow scenario-wide source proof to certify any one QA ID. */
function projectSelectedMapQaCoverage(
  inspection: InspectArtifactResult,
  relatedFindings: readonly AuditIssueProjection[],
): MapAuditQaCoverage {
  const intent = inspection.gameplayIntent.model;
  const selectedIds = selectedSourceIds(intent);
  const byNode = uniquelyOwnedNodes(intent);
  const preset = inspection.hiddenGameplayDefects.auditScenarioPreset;
  const graph = inspection.hiddenGameplayDefects.scenarioAudit.graph;
  const activityCandidates = intent.nodes.flatMap(node => {
    if (byNode.get(node.id) !== node || node.status === "hypothesis" ||
        (node.kind !== "game" && node.kind !== "mechanic" &&
         node.kind !== "objective")) return [];
    const evidenceIds = [...new Set(node.evidenceIds
      .filter(id => selectedIds.has(id)))].sort();
    if (evidenceIds.length === 0) return [];
    return [{
      subjectId: node.id, kind: node.kind, label: node.label,
      evidenceIds: evidenceIds.slice(0, 8),
    }];
  }).sort((a, b) => a.subjectId.localeCompare(b.subjectId));
  // A single current-artifact Intent graph may describe multiple game
  // candidates. Only exact authored edges with selected-source evidence
  // connect them; labels, shared file names and inferred graph proximity
  // never assign a second mode or game type.
  const uniqueNode = (id: string) => byNode.get(id);
  const directGameScopes = activityCandidates
    .filter(item => item.kind === "game")
    .map(game => {
      const links = intent.edges.flatMap(edge => {
        if (edge.status !== "authored" ||
            (edge.from !== game.subjectId && edge.to !== game.subjectId)) {
          return [];
        }
        const otherId = edge.from === game.subjectId ? edge.to : edge.from;
        if (otherId === game.subjectId) return [];
        const other = uniqueNode(otherId);
        if (other === undefined || other.status === "hypothesis" ||
            !other.evidenceIds.some(id => selectedIds.has(id))) return [];
        const exactEvidence = [...new Set(edge.evidenceIds
          .filter(id => selectedIds.has(id)))].sort();
        if (exactEvidence.length === 0) return [];
        return [{
          edgeId: edge.id,
          edgeKind: edge.kind,
          relatedSubjectId: otherId,
          relatedKind: other.kind,
          edgeEvidenceIds: exactEvidence,
        }];
      }).sort((a, b) => a.edgeId.localeCompare(b.edgeId) ||
        a.relatedSubjectId.localeCompare(b.relatedSubjectId));
      return { game, links };
    });
  const ownersBySubject = new Map<string, Set<string>>();
  for (const group of directGameScopes) {
    for (const link of group.links) {
      const owners = ownersBySubject.get(link.relatedSubjectId) ??
        new Set<string>();
      owners.add(group.game.subjectId);
      ownersBySubject.set(link.relatedSubjectId, owners);
    }
  }
  const gameScopes: NonNullable<MapAuditQaCoverage["gameScopes"]> =
    directGameScopes.map(({ game, links }) => ({
      gameSubjectId: game.subjectId,
      gameLabel: game.label,
      sourceEvidenceIds: game.evidenceIds,
      directRelations: links.slice(0, 16),
      omittedDirectRelations: Math.max(0, links.length - 16),
      sharedSubjectIds: [...new Set(links.filter(link =>
        (ownersBySubject.get(link.relatedSubjectId)?.size ?? 0) > 1)
        .map(link => link.relatedSubjectId))].sort(),
      classificationBoundary: "EXACT_SOURCE_EDGES_NOT_MODE_OR_GAME_TYPE",
    }));
  const unscopedActivities = [...new Set(activityCandidates.filter(item =>
    item.kind !== "game" && !ownersBySubject.has(item.subjectId))
    .map(item => item.subjectId))].sort();

  // Mode routing is still a user/source hint; only matching current
  // authored game nodes may activate it. Unmatched claims remain visible.
  const sourceBoundModes = preset.sourceBoundModes ?? [];
  const modeClassifications: NonNullable<MapAuditQaCoverage["modeClassifications"]> =
    (inspection.hiddenGameplayDefects.classification?.modes ?? [])
      .map(mode => {
        const exact = sourceBoundModes.filter(bound =>
          bound.modeId === mode.modeId &&
          bound.gameSubjectId === mode.gameSubjectId);
        const admitted = exact.length === 1 ? exact[0] : undefined;
        return {
          modeId: mode.modeId,
          gameSubjectId: mode.gameSubjectId,
          mapType: mode.mapType,
          playerMode: mode.playerMode,
          status: admitted === undefined
            ? "SOURCE_BINDING_UNRESOLVED" as const
            : "SOURCE_SCOPED_ROUTING_ONLY" as const,
          evidenceIds: admitted?.evidenceIds ?? [],
          proof: "MODE_HINT_SOURCE_CORRELATION_NOT_GAMEPLAY_PROOF" as const,
        };
      });
  const selectedInvariantFor = (id: string, modeId?: string) =>
    intent.invariants.filter(invariant =>
      invariant.status === "authored" &&
      (modeId === undefined
        ? (invariant.id === id || invariant.id === "qa:" + id)
        : invariant.id === "qa:mode:" +
          encodeURIComponent(modeId) + ":" + id) &&
      invariant.evidenceIds.some(sourceId => selectedIds.has(sourceId)));
  const causalIdCounts = new Map<string, number>();
  for (const link of graph.causalLinks) {
    causalIdCounts.set(link.id, (causalIdCounts.get(link.id) ?? 0) + 1);
  }
  const relatedQaRuleFor = (
    id: string,
    relatedFindings: readonly AuditIssueProjection[],
    modeScope?: { readonly modeId: string; readonly gameSubjectId: string },
  ): NonNullable<MapAuditQaCoverage["checks"][number]["exactSourceQaRule"]> => {
    const matches = selectedInvariantFor(id, modeScope?.modeId);
    const common = {
      proof: "QA_SOURCE_RULE_TO_CAUSAL_LEADS_NOT_QA_VERDICT" as const,
    };
    const empty = (
      status: "NO_EXACT_SELECTED_SOURCE_RULE" |
        "AMBIGUOUS_EXACT_SOURCE_RULE" |
        "EXACT_RULE_SUBJECT_SCOPE_UNRESOLVED" |
        "MODE_SCOPE_RULE_UNRESOLVED",
      invariantIds: readonly string[],
    ) => ({
      ...common, status, invariantIds,
      subjectIds: [], sourceEvidenceIds: [],
      selectedApprovedDesignEvidence: false,
      relatedCausalLinkIds: [], relatedProvenFindingIds: [],
      omittedRelatedLinks: 0,
    });
    if (matches.length === 0) {
      return empty("NO_EXACT_SELECTED_SOURCE_RULE", []);
    }
    if (matches.length !== 1) {
      return empty("AMBIGUOUS_EXACT_SOURCE_RULE",
        matches.map(item => item.id).sort());
    }
    const rule = matches[0]!;
    const subjectIds = [...new Set(rule.subjectIds)].sort();
    if (subjectIds.length === 0 || subjectIds.some(subjectId => {
      const node = uniqueNode(subjectId);
      return node === undefined || node.status === "hypothesis" ||
        !node.evidenceIds.some(sourceId => selectedIds.has(sourceId));
    })) {
      return empty("EXACT_RULE_SUBJECT_SCOPE_UNRESOLVED", [rule.id]);
    }
    if (modeScope !== undefined &&
        !subjectIds.includes(modeScope.gameSubjectId)) {
      return empty("MODE_SCOPE_RULE_UNRESOLVED", [rule.id]);
    }
    const sourceEvidenceIds = [...new Set(rule.evidenceIds
      .filter(evidenceId => selectedIds.has(evidenceId)))].sort();
    // A link must own EVERY named source subject, have a unique graph
    // identity and carry its own current-artifact evidence. This proves
    // an exact source association, not that the rule's predicate was tested.
    const associated = graph.causalLinks.filter(link =>
      causalIdCounts.get(link.id) === 1 &&
      subjectIds.every(subjectId => link.subjectIds.includes(subjectId)) &&
      link.evidenceIds.some(evidenceId => selectedIds.has(evidenceId)))
      .sort((a,b) => a.id.localeCompare(b.id));
    const relatedProven = relatedFindings.filter(finding =>
      finding.status === "PROVEN" &&
      finding.evidenceIds.some(evidenceId => selectedIds.has(evidenceId)) &&
      associated.some(link =>
        link.id === finding.causalLinkId &&
        link.scenarioId === finding.scenarioId &&
        link.status === "CONTRADICTED"))
      .map(finding => finding.causalLinkId).sort();
    return {
      ...common, status: "EXACT_SOURCE_RULE_WITH_CAUSAL_LEADS",
      invariantIds: [rule.id],
      subjectIds,
      sourceEvidenceIds: sourceEvidenceIds.slice(0, 8),
      selectedApprovedDesignEvidence: sourceEvidenceIds.some(id =>
        intent.evidence.some(e => e.id === id &&
          e.origin === "game-design-spec" &&
          e.designStatus === "approved")),
      relatedCausalLinkIds: associated.slice(0, 8).map(x => x.id),
      relatedProvenFindingIds: [...new Set(relatedProven)].slice(0, 8),
      omittedRelatedLinks: Math.max(0, associated.length - 8),
    };
  };
  const canonicalProof =
    inspection.hiddenGameplayDefects.scenarioAudit.defectResolution;
  const admittedDefects = new Set(canonicalProof.confirmedDefectReadyIds);
  // PROVE alone owns confirmation. The QA report may ONLY project an
  // explicit QA-invariant binding from an admitted canonical resolution
  // joined to an independently PROVEN issue on the exact same source link.
  const admittedQaViolationFor = (
    invariantId: string,
    qaRuleStatus: string,
    modeGameSubjectId?: string,
  ): NonNullable<MapAuditQaCoverage["checks"][number]["qaViolation"]> | undefined => {
    if (qaRuleStatus !== "EXACT_SOURCE_RULE_WITH_CAUSAL_LEADS") return undefined;
    const found = canonicalProof.resolutions.flatMap(resolution => {
      if (resolution.qaInvariantId !== invariantId ||
          resolution.disposition !== "CONFIRMED_DEFECT_READY" ||
          !admittedDefects.has(resolution.causalLinkId)) return [];
      const links = graph.causalLinks.filter(link =>
        link.id === resolution.causalLinkId &&
        link.status === "CONTRADICTED" &&
        (resolution.scenarioId === undefined ||
         resolution.scenarioId === link.scenarioId) &&
        (modeGameSubjectId === undefined ||
         link.subjectIds.includes(modeGameSubjectId)));
      if (links.length !== 1) return [];
      const link = links[0]!;
      const admitted = relatedFindings.filter(finding =>
        finding.status === "PROVEN" &&
        (finding.issueType === "BUG" ||
         finding.issueType === "DESIGN_MISMATCH") &&
        finding.causalLinkId === link.id &&
        finding.scenarioId === link.scenarioId &&
        finding.evidenceIds.some(id => link.evidenceIds.includes(id)));
      if (admitted.length !== 1) return [];
      const finding = admitted[0]!;
      return [{
        qaInvariantId: invariantId,
        causalLinkId: finding.causalLinkId,
        scenarioId: finding.scenarioId,
        issueType: finding.issueType,
        evidenceIds: [...new Set(finding.evidenceIds)].sort().slice(0, 8),
        proof: "CANONICAL_PROVE_ADMITTED_EXACT_QA_VIOLATION" as const,
      }];
    });
    // Competing/duplicate admitted source owners are not a unique QA
    // verdict. Preserve the independent issue in canonical findings.
    return found.length === 1 ? found[0] : undefined;
  };
  const seen = new Set<string>();
  const checks: MapAuditQaCoverage["checks"][number][] = [];
  for (const scenario of preset.scenarios) {
    const matchGraph = graph.scenarios.filter(item =>
      item.id === "preset:" + scenario.id &&
      item.label === scenario.kind &&
      item.gameplayStage === scenario.flowStage);
    const scoped = matchGraph.length === 1 ? matchGraph[0] : undefined;
    const evidence = scoped === undefined ? [] : [...new Set(
      scoped.sourceSubjectIds.flatMap(subjectId =>
        byNode.get(subjectId)?.evidenceIds.filter(id => selectedIds.has(id)) ?? [])
    )].sort();
    const linkIds = scoped === undefined ? [] : graph.causalLinks.filter(link =>
      link.scenarioId === scoped.id &&
      scoped.causalLinkIds.includes(link.id) &&
      causalIdCounts.get(link.id) === 1 &&
      link.evidenceIds.some(id => selectedIds.has(id))
    ).map(link => link.id).sort();
    for (const question of scenario.questions) {
      const tagged = /^(U\d{2}|P\d{2}|BLD\d{2}|CBT\d{2}|SUR\d{2}|STG\d{2}|PUZ\d{2}|QST\d{2}|CRS\d{2}|SKL\d{2}):\s+(.+)$/.exec(question);
      if (!tagged) continue;
      const identity = scenario.id + "::" + tagged[1];
      if (seen.has(identity)) continue;
      seen.add(identity);
      const modeScope = scenario.sourceModeId === undefined ||
          scenario.sourceGameSubjectId === undefined
        ? undefined : sourceBoundModes.find(mode =>
            mode.modeId === scenario.sourceModeId &&
            mode.gameSubjectId === scenario.sourceGameSubjectId);
      const exactSourceQaRule = relatedQaRuleFor(
        tagged[1]!, relatedFindings, modeScope);
      const qaInvariantId = exactSourceQaRule.invariantIds.length === 1
        ? exactSourceQaRule.invariantIds[0] : undefined;
      const qaViolation = qaInvariantId === undefined ? undefined :
        admittedQaViolationFor(
          qaInvariantId, exactSourceQaRule.status,
          modeScope?.gameSubjectId);
      const positiveSourceCoverage = qaInvariantId === undefined ||
        exactSourceQaRule.status !== "EXACT_SOURCE_RULE_WITH_CAUSAL_LEADS"
        ? undefined : assessQaPositiveSourceCoverage({
          graph,
          intent,
          discovery: inspection.gameplayDiscoveryClosure,
          scenarioClosure: inspection.hiddenGameplayDefects.scenarioAudit.closure,
          qaInvariantId,
          ...(modeScope === undefined ? {} :
            { modeGameSubjectId: modeScope.gameSubjectId }),
        });
      checks.push({
        id: tagged[1]!, scenarioId: "preset:" + scenario.id,
        question: tagged[2]!,
        status: qaViolation === undefined
          ? "QA_SPECIFIC_PROOF_UNRESOLVED" : "QA_VIOLATION_PROVEN",
        ...(qaViolation === undefined ? {} : { qaViolation }),
        ...(positiveSourceCoverage === undefined ? {} :
          { positiveSourceCoverage }),
        scenarioSourceEvidenceIds: evidence.slice(0, 8),
        relatedCausalLinkIds: linkIds.slice(0, 8),
        omittedScenarioEvidence: Math.max(0, evidence.length - 8),
        omittedRelatedLinks: Math.max(0, linkIds.length - 8),
        evidenceRole: "SCENARIO_SCOPE_NAVIGATION_NOT_REQUIREMENT_PROOF",
        ...(modeScope === undefined ? {} : {
          modeScope: {
            modeId: modeScope.modeId,
            gameSubjectId: modeScope.gameSubjectId,
            evidenceIds: modeScope.evidenceIds,
            proof: "EXACT_SOURCE_GAME_MODE_ROUTING_NOT_QA_PROOF" as const,
          },
        }),
        exactSourceQaRule,
      });
    }
  }
  return {
    authority: "READ_ONLY_QA_NAVIGATION_NOT_PROOF",
    profile: inspection.hiddenGameplayDefects.classification?.classificationStatus === "RESOLVED"
      ? "RESOLVED_HINT_ROUTING_ONLY"
      : sourceBoundModes.length > 0
        ? "SOURCE_BOUND_PER_MODE_ROUTING_ONLY"
        : "UNRESOLVED_SOURCE_CANDIDATES",
    activityScope: activityCandidates.length === 0
      ? "NO_SELECTED_SOURCE_ACTIVITY"
      : "SOURCE_ACTIVITY_CANDIDATES_SCOPE_UNVERIFIED",
    sourceActivities: activityCandidates.slice(0, 16),
    omittedSourceActivities: Math.max(0, activityCandidates.length - 16),
    gameScopes: gameScopes.slice(0, 12),
    omittedGameScopes: Math.max(0, gameScopes.length - 12),
    unscopedActivitySubjectIds: unscopedActivities.slice(0, 16),
    omittedUnscopedActivities: Math.max(0, unscopedActivities.length - 16),
    modeClassifications,
    selected: checks.length,
    confirmedViolations: checks.filter(item =>
      item.status === "QA_VIOLATION_PROVEN").length,
    sourceRelationsAccounted: checks.filter(item =>
      item.positiveSourceCoverage?.status === "SOURCE_RELATIONS_ACCOUNTED").length,
    proofBound: 0,
    checks,
  };
}

export function projectMapAuditOutputV2(input: {
  readonly inspection: InspectArtifactResult;
  readonly identity: SelectedMapAuditIdentity;
  /** Derived by the canonical selected-map audit, not a caller proof claim. */
  readonly auditRevision?: string;
  readonly issueLanes: {
    readonly BUG: readonly AuditIssueProjection[];
    readonly DESIGN_MISMATCH:
      readonly AuditIssueProjection[];
  };
  readonly auditObligations:
    readonly AuditObligation[];
  readonly validationTests:
    readonly AuditValidationTestGroup[];
  readonly honesty: AuditHonestyAssessment;
  readonly userIntent?: AuditUserIntentEnvelope;
  readonly control: MapAuditOutputControl;
  readonly fullMapReplica?: FullMapReplicaReceipt;
  readonly gameplayStructure?: GameplayArchitectureNavigation["gameplayStructure"];
  readonly reasoningByCausalLinkId?: Readonly<Record<string, MapAuditOutputV2FindingReasoning>>;
}): MapAuditOutputV2 {
  if (input.auditRevision !== undefined &&
      !/^[a-f0-9]{64}$/.test(input.auditRevision)) {
    throw new Error("Invalid selected-map audit revision; expected SHA-256.");
  }
  const model =
    input.inspection.gameplayIntent.model;
  const nodes = uniquelyOwnedNodes(model);
  const sourceIds = selectedSourceIds(model);
  const isCurrent = (ids: readonly string[]): boolean =>
    ids.some(id => sourceIds.has(id));
  const currentEdge = (edge: GameplayIntentEdge): boolean =>
    isCurrent(edge.evidenceIds) &&
    isCurrent(nodes.get(edge.from)?.evidenceIds ?? []) &&
    isCurrent(nodes.get(edge.to)?.evidenceIds ?? []);
  const objectiveSummary = summarizeSourceObjectives(model);
  const objective = objectiveSummary.text;
  const objectiveGrounding = objectiveSummary.grounding;
  const win = outcomeFor(model, "wins-by");
  const lose = outcomeFor(model, "loses-by");
  const winCondition = win?.text ?? "Unresolved from selected artifact.";
  const loseCondition = lose?.text ?? "Unresolved from selected artifact.";

  const resetRules = model.edges
    .filter((edge) =>
      edge.kind === "resets" &&
      edge.status !== "hypothesis" && currentEdge(edge)
    )
    .map((edge) => edgeStatement(edge, nodes))
    .sort();
  const preserveRules = model.edges
    .filter((edge) =>
      edge.kind === "persists" &&
      edge.status !== "hypothesis" && currentEdge(edge)
    )
    .map((edge) => edgeStatement(edge, nodes))
    .sort();
  const progressionRules = [
    ...model.edges
      .filter((edge) =>
        (
          edge.kind === "transitions-to" ||
          edge.kind === "produces" ||
          edge.kind === "consumes"
        ) &&
        edge.status !== "hypothesis" &&
        currentEdge(edge)
      )
      .map((edge) => edgeStatement(edge, nodes)),
    ...model.invariants
      .filter((item) =>
        item.status !== "hypothesis" &&
        isCurrent(item.evidenceIds) &&
        item.subjectIds.every(id =>
          isCurrent(nodes.get(id)?.evidenceIds ?? []))
      )
      .map((item) => item.statement.trim())
      .filter(Boolean),
  ].filter(
    (value, index, all) =>
      all.indexOf(value) === index,
  ).sort();

  const stateTransitions = model.edges
    .filter((edge) =>
      (
        edge.kind === "transitions-to" ||
        edge.kind === "recovers-to"
      ) &&
      edge.status !== "hypothesis" && currentEdge(edge)
    )
    .map((edge) => ({
      from:
        nodeText(nodes.get(edge.from)) ??
        edge.from,
      event: edge.kind,
      to:
        nodeText(nodes.get(edge.to)) ??
        edge.to,
      ...(edge.description?.trim()
        ? { notes: edge.description.trim() }
        : {}),
    }));

  const world = input.inspection.gameplayWorld;
  const closure = world.gameplayClosure;
  const coverageRecords = closure.surfaces.map(
    (surface) => ({
      surface: surface.id,
      // Project the canonical state unchanged; do not relabel UNKNOWN
      // coverage as a blocked/failed gameplay surface.
      status: surface.status,
      ...(surface.reason === undefined
        ? {}
        : { reason: surface.reason }),
      evidenceIds:
        [...(surface.evidenceIds ?? [])],
    }),
  );

  const coverageDisposition =
    closure.status === "CLOSED" &&
    closure.unaccountedSurfaceIds.length === 0 &&
    closure.stateModelComplete &&
    closure.boundariesExtracted
      ? "accounted" as const
      : "incomplete" as const;
  const allFindings = [
    ...input.issueLanes.BUG,
    ...input.issueLanes.DESIGN_MISMATCH,
  ];
  // A cause is not a model guess: require the uniquely scoped current
  // CONTRADICTED link and evidence bound to the same finding.
  const linksById = new Map<string, GameplayCausalLink[]>();
  for (const link of input.inspection.hiddenGameplayDefects.scenarioAudit?.graph.causalLinks ?? []) {
    const group = linksById.get(link.id) ?? [];
    group.push(link);
    linksById.set(link.id, group);
  }
  const causeFor = (finding: AuditIssueProjection): string | undefined => {
    const group = linksById.get(finding.causalLinkId);
    if (group?.length !== 1) return undefined;
    const link = group[0]!;
    if (link.status !== "CONTRADICTED" ||
        link.scenarioId !== finding.scenarioId ||
        !link.evidenceIds.some(id => finding.evidenceIds.includes(id))) return undefined;
    return link.reason.trim() || undefined;
  };
  const needValidationIds = allFindings
    .filter((finding) =>
      finding.status === "NEED_VALIDATION"
    )
    .map((finding) => finding.causalLinkId)
    .sort();
  const runtimeRequiredIds = input.validationTests
    .filter((group) =>
      group.verificationMode ===
        "NARROW_RUNTIME_VERIFICATION"
    )
    .flatMap((group) => group.findingIds)
    .filter((id, index, values) =>
      values.indexOf(id) === index
    )
    .sort();
  const runtimeRequiredSet =
    new Set(runtimeRequiredIds);
  const staticProofPendingIds =
    needValidationIds
      .filter((id) =>
        !runtimeRequiredSet.has(id)
      )
      .sort();
  const auditObligationIds =
    input.auditObligations
      .map((item) => item.id)
      .sort();
  const unknownSurfaceIds =
    closure.surfaces
      .filter((surface) =>
        surface.status === "unknown"
      )
      .map((surface) => surface.id)
      .sort();
  // A2 already knows which exact selected-map function/scheduler targets
  // could not be resolved. Do not lose those uncertainties just because
  // later Gameplay Intent or report findings are unavailable. A source-link
  // gap is a DISCOVERY obligation, never an inferred player-facing BUG.
  const unresolvedSourceLinkIds = [...new Set(
    input.inspection.gameplayDiscoveryClosure?.unresolvedSourceLinkIds ?? [],
  )].filter((id) => id.trim().length > 0).sort();
  // Projection only: reuse the canonical selected-artifact Arena Lifecycle
  // assessment and never infer a BUG from a missing runtime safety proof.
  const deferredMutationSources = [
    ...(input.inspection.arenaAnalysis.lifecycle?.deferredMutations ?? []),
  ].filter(item => item.status !== "protected")
    .sort((a, b) =>
      a.source.relativePath.localeCompare(b.source.relativePath) ||
      (a.source.range?.lineStart ?? 0) -
        (b.source.range?.lineStart ?? 0) ||
      (a.source.range?.columnStart ?? 0) -
        (b.source.range?.columnStart ?? 0) ||
      a.callbackRegion.localeCompare(b.callbackRegion) ||
      a.scheduler.localeCompare(b.scheduler));
  // Source-only callback candidates have no admitted gameplay/material
  // obligation yet. Keep their exact count and source preview separately
  // without fabricating unresolved proof debt or changing audit readiness.
  const deferredMutationSamples = deferredMutationSources.slice(0, 6).map(item => ({
    scheduler: item.scheduler,
    source: item.source,
    status: item.status as
      "source-guard-candidate" | "source-snapshot-candidate" | "unresolved",
    reason: item.reason,
  }));
  const unresolvedIds = new Set([
    ...needValidationIds,
    ...auditObligationIds,
    ...unknownSurfaceIds,
    ...unresolvedSourceLinkIds,
  ]);
  const unresolved = {
    status:
      unresolvedIds.size === 0
        ? "CLEAR" as const
        : "HAS_UNRESOLVED" as const,
    total: unresolvedIds.size,
    needValidationIds,
    staticProofPendingIds,
    runtimeRequiredIds,
    auditObligationIds,
    unknownSurfaceIds,
    ...(unresolvedSourceLinkIds.length === 0
      ? {} : { unresolvedSourceLinkIds }),
    ...(deferredMutationSources.length === 0 ? {} : {
      deferredMutationOwnership: {
        total: deferredMutationSources.length,
        samples: deferredMutationSamples,
        omitted: Math.max(0,
          deferredMutationSources.length - deferredMutationSamples.length),
      },
    }),
  };

  const qualityGates = deriveMapAuditQualityGates({
    controlStatus: input.control.status,
    coverageDisposition,
    gameplayClosureStatus: closure.status,
    honestyStatus: input.honesty.status,
    findings: allFindings.map((finding) => ({
      id: finding.causalLinkId,
      status: finding.status,
      informationMismatch:
        finding.informationMismatch,
      failureDomain: finding.failureDomain,
      contributingDomains:
        [...finding.contributingDomains],
      gameplayFlow: finding.gameplayFlow,
    })),
    auditObligationCount:
      input.auditObligations.length,
    validationTestCount:
      input.validationTests.length,
    auditObligations:
      input.auditObligations,
    multiArenaDetected:
      world.arenas.detected,
  });

  return {
    schemaVersion: 2,
    artifactId: input.identity.artifactId,
    artifactFingerprint: input.identity.artifactFingerprint,
    ...(input.auditRevision === undefined
      ? {}
      : { auditRevision: input.auditRevision }),
    auditTarget: {
      edition: input.inspection.targetCompatibility?.edition ?? "unknown",
      ...(input.inspection.targetCompatibility?.version === undefined
        ? {}
        : { minecraftVersion: input.inspection.targetCompatibility.version }),
      source: "selected-audit-runtime-target-not-live-observation",
    },
    control: {
      ...input.control,
      operatorStage: operatorMapTestStageFor(input.control.currentStage),
    },
    ...(input.userIntent === undefined
      ? {}
      : { userIntent: input.userIntent }),
    mapVersion:
      input.identity.releaseVersion ??
      "UNRESOLVED",
    ...(input.inspection.hiddenGameplayDefects
      .classification === undefined
      ? {}
      : {
          mapClassification: {
            use: "audit-routing-only" as const,
            classification:
              input.inspection
                .hiddenGameplayDefects
                .classification,
          },
        }),
    qaCoverage: projectSelectedMapQaCoverage(input.inspection, [
      ...input.issueLanes.BUG,
      ...input.issueLanes.DESIGN_MISMATCH,
    ]),
    evidenceScope: {
      mode: "selected-map-version-only",
      selectedArtifact:
        input.identity.levelName ??
        input.identity.artifactId,
      archiveSourcesUsed: false,
    },
    gameDesign: {
      objective,
      objectiveGrounding,
      winCondition,
      winConditionGrounding:
        win?.grounding ?? "unresolved",
      loseCondition,
      loseConditionGrounding:
        lose?.grounding ?? "unresolved",
      resetRules,
      preserveRules,
      progressionRules,
    },
    gameplayFlow: CANONICAL_PLAYER_FLOW_STAGES,
    gameplayFlowBasis: "AUDIT_CHECKLIST_NOT_OBSERVED_GAMEPLAY",
    ...(input.gameplayStructure === undefined
      ? {}
      : { gameplayStructure: input.gameplayStructure }),
    stateTransitions,
    multiArena: {
      detected: world.arenas.detected,
      visibleArenaCount:
        world.arenas.count ?? null,
      declaredArenaCount:
        world.arenas.declaredArenaCount ?? null,
      declaredConcurrentArenaLimit:
        world.arenas.declaredConcurrentArenaLimit ??
        null,
      safeConcurrentArenaLimit:
        world.arenas.safeConcurrentArenas ??
        null,
      queueBehavior:
        world.arenas.detected
          ? "Unresolved from selected artifact."
          : "not-applicable",
      isolationRules:
        world.arenas.isolation.observations
          .map(item =>
            item.key + "=" + item.status +
            " [source-scope:" + item.scope + "]" +
            " [source:" + (item.sourceLocator ?? item.sourcePath ?? "UNRESOLVED") + "]" +
            " " + item.reason
          )
          .sort(),
    },
    coverage: {
      disposition: coverageDisposition,
      records: coverageRecords,
    },
    gameplayClosure: {
      status: closure.status,
      surfaceInventory:
        closure.surfaces.map((surface) => ({
          id: surface.id,
          label: surface.label,
          kind: surface.kind,
          status: surface.status,
          ...(surface.reason === undefined
            ? {}
            : { reason: surface.reason }),
          boundaries:
            [...(surface.boundaries ?? [])],
        })),
      stateModelComplete:
        closure.stateModelComplete,
      boundariesExtracted:
        closure.boundariesExtracted,
      unaccountedSurfaceIds:
        [...closure.unaccountedSurfaceIds],
      notes: closure.reasons.join(" "),
    },
    bugs:
      input.issueLanes.BUG.map((finding) =>
        projectFinding(finding, input.reasoningByCausalLinkId, causeFor(finding))),
    designMismatches:
      input.issueLanes.DESIGN_MISMATCH.map((finding) =>
        projectFinding(finding, input.reasoningByCausalLinkId, causeFor(finding))),
    auditObligations:
      [...(input.auditObligations ?? [])],
    validationTests:
      [...input.validationTests],
    unresolved,
    honesty: input.honesty,
    qualityGates,
    ...(input.fullMapReplica === undefined
      ? {}
      : {
          fullMapReplica:
            input.fullMapReplica,
        }),
  };
}

/**
 * Stable public import path for existing clients. Formatter implementation
 * belongs exclusively to the read-only reporting view; this re-export does
 * not introduce an alternative Map Audit report/proof authority.
 */
export { formatSelectedMapAuditBrief, formatSelectedMapAuditFinalReport } from "./reporting/map-audit-brief.js";
