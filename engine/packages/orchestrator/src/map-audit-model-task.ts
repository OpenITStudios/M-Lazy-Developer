import {
  deriveUnknownGameplayEvidenceInquiry,
  type GameplayIntentModel,
  type UnknownGameplayEvidenceInquiry,
} from "../../gameplay-intent/src/index.js";
import {
  describeSourceBehaviorShape,
  compareSourceBehaviorShapes,
  type SourceBehaviorShape,
  type SourceBehaviorShapeComparison,
} from "../../behavior-model/src/source-behavior-shape.js";
import {
  findExclusiveAuthoredBranch,
  type AuthoredBranchExclusion,
  type SemanticIr,
} from "../../semantic-ir/src/index.js";
import type { InspectedPack } from "./core/types.js";
import {
  compileDeveloperPracticeReferenceContext,
  prepareDeveloperPracticeReferenceSelector,
  type CompiledDeveloperPracticeReferenceContext,
  type DeveloperPracticeReferenceData,
} from "./workflow/resource-context.js";
import { prepareTextDocumentScorer } from "../../analysis-planner/src/index.js";
import type {
  KnowledgeApplicability,
  KnowledgeCatalog,
  KnowledgeEdition,
  KnowledgeSource,
} from "../../knowledge/src/index.js";
import type {
  GameplayWorldModel,
} from "./inspection/gameplay-world-model.js";
import type {
  MandatoryAuditProcedureReceipt,
  MandatoryAuditCheckpointReceipt,
} from "./inspection/mandatory-audit-procedure.js";
import type {
  GameplayArchitectureNavigation,
  GameplayScenarioGraph,
  GameplaySourceFlowCandidate,
} from "./inspection/gameplay-scenario-model.js";
import {
  satisfiedScenarioKnowledgeReceipt,
  uniqueScenarioKnowledgeRequirement,
} from "./inspection/gameplay-scenario-knowledge.js";
import type {
  GameplayDefectResolutionGate,
} from "./inspection/gameplay-defect-resolution.js";
import {
  sourceBoundAuditEvidenceIds,
} from "./map-audit-proof-saturation.js";
import {
  SELECTED_MAP_AUDIT_STAGE_ORDER,
  type SelectedMapAuditAdmission,
  type SelectedMapAuditStage,
} from "./map-audit-admission.js";
import type {
  AuditObligation,
} from "./map-audit-obligations.js";
import {
  auditUserIntentAuthorityNote,
  deriveAuditUserIntentSearchPressure,
  type AuditUserIntentEnvelope,
} from "./map-audit-user-intent.js";

export type AuditModelTaskKind =
  | "CHECKPOINT_REASONING"
  | "GAMEPLAY_TRANSLATION"
  | "COUNTERPROOF_SEARCH"
  | "PROOF_NAVIGATION"
  | "AUDIT_OBLIGATION";

/** Shared model response eligibility vocabulary. A task kind alone never
 * authorizes causal proof: both handoff and canonical response gate also
 * require the source-backed causal-link / audit-revision checks.
 */
export const MODEL_RESOLVABLE_KINDS: ReadonlySet<AuditModelTaskKind> = new Set([
  "COUNTERPROOF_SEARCH",
  "GAMEPLAY_TRANSLATION",
  "PROOF_NAVIGATION",
]);

export interface AuditModelTaskEvidenceContext {
  readonly id: string;
  readonly kind: "selected-artifact-evidence" | "analysis-receipt";
  readonly origin?: string;
  readonly locator?: string;
  readonly summary?: string;
}

export interface AuditModelTaskKnowledgeContext {
  readonly requirementId: string;
  readonly domain: string;
  readonly status: string;
  readonly capabilityIds: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly platformClaims?: GameplayWorldModel["platformKnowledge"]["claims"];
}

export interface AuditModelTaskKnowledgeLookup {
  readonly query: string;
  readonly matchedSubjectIds: readonly string[];
  readonly sourceEvidenceIds: readonly string[];
  readonly sourceLocators: readonly string[];
  readonly unresolvedSubjectIds: readonly string[];
  readonly omittedSupportedSubjectIds: readonly string[];
  readonly grounding: "SELECTED_ARTIFACT" | "GOAL_ONLY";
  readonly authority: "SEARCH_HINT_NOT_GAMEPLAY_PROOF";
}

export interface AuditModelTaskKnowledgeReference {
  readonly knowledgeId: string;
  readonly kind: "fact" | "relation";
  readonly domain: string;
  readonly statement: string;
  readonly classification: string;
  /** Claim scope from Knowledge source, not a validated gameplay claim. */
  readonly applicability: KnowledgeApplicability;
  readonly editionCheck: "MATCHED_EDITION_ONLY" | "NOT_EVALUATED";
  readonly sourceIds: readonly string[];
  readonly sources: readonly KnowledgeSource[];
  readonly matchedMechanicTerms: readonly string[];
  readonly authority: "RETRIEVED_REFERENCE_NOT_BUG_PROOF";
}

export interface AuditModelTaskKnowledgeSelection {
  readonly status: "MATCHED" | "NO_SCOPED_MATCH";
  readonly references: readonly AuditModelTaskKnowledgeReference[];
  readonly omitted: number;
  readonly basis: "CURRENT_MAP_SOURCE_GROUNDED_MECHANICS";
}


/**
 * A bounded SOURCE investigation of material operations whose gameplay owner
 * is still unknown. It is a view of the existing Intent/Scenario/IR owners,
 * never another gameplay contract, proof receipt, or AI-generated source fact.
 */
type UnclassifiedSourceEffect = GameplayArchitectureNavigation[
  "gameplayStructure"]["uninterpretedSourceFlows"][number]["effectPaths"][number];

/** Read-only model task projection over the existing canonical source graph. */
export interface AuditModelSourceInvestigation {
  readonly authority: "SELECTED_SOURCE_PATH_CONTEXT_NOT_GAMEPLAY_OR_RUNTIME_PROOF";
  readonly entries: readonly {
    readonly unknownId: string;
    readonly question: string;
    readonly entryRegionId: string;
    readonly sourceTraceStatus:
      "SOURCE_ROOT_TRACE" | "DISCONNECTED_SOURCE_REGION" | "UNKNOWN";
    readonly steps: ReadonlyArray<GameplaySourceFlowCandidate["sourceSteps"][number]>;
    readonly omittedSteps: number;
    /** Already accepted exact source pairs; do not ask AI to rediscover
     * them or treat them as an inferred player objective.
     */
    readonly reviewedSourceRelationships?: NonNullable<
      GameplayScenarioGraph["reviewedSourceRelationships"]
    >;
    /** Branch membership describes authored source syntax, not feasibility. */
    readonly branchContexts: readonly {
      readonly expression: string;
      readonly source: GameplaySourceFlowCandidate["branchPoints"][number]["source"];
      readonly arms: readonly {
        readonly branch: "true" | "false";
        readonly matchedStepIds: readonly string[];
      }[];
    }[];
    readonly omittedBranchContexts: number;
    /** Resolved source calls are candidates, not observed callback delivery. */
    readonly handoffs: ReadonlyArray<
      NonNullable<GameplaySourceFlowCandidate["sourceHandoffs"]>[number]
    >;
    readonly omittedHandoffs: number;
    /** Existing source-effect slices: candidate syntax, never game semantics. */
    readonly effectPaths?: readonly {
      readonly effectId: string;
      readonly effectKind: UnclassifiedSourceEffect["effectKind"];
      readonly worldEffectKind: UnclassifiedSourceEffect["worldEffectKind"];
      readonly targetLabel: string | null;
      readonly evidenceStatus: UnclassifiedSourceEffect["evidenceStatus"];
      readonly guardStateReadIds: readonly string[];
      readonly omittedGuardStateReads: number;
      readonly sourceLocalStateValueHandoffs:
        UnclassifiedSourceEffect["sourceLocalStateValueHandoffs"];
      readonly omittedValueHandoffs: number;
      readonly candidateOutcomeIds: readonly string[];
      readonly omittedCandidateOutcomes: number;
      readonly ingressEdgeIds: readonly string[];
      readonly omittedIngressEdges: number;
      readonly temporalBoundaryCount: number;
    }[];
    readonly omittedEffectPaths?: number;
    /** Name-independent authored anatomy; not a gameplay rule. */
    readonly behaviorShape?: SourceBehaviorShape;
    /** Independently source-linked design / player presentation / Intent
     * navigation. Never a confirmed mechanic or playable journey.
     */
    readonly gameplayEvidenceInquiry?: UnknownGameplayEvidenceInquiry;
    /** Existing authored journey candidates joined by exact source-flow and
     * selected source evidence. Context only, NOT causal/gameplay proof.
     */
    readonly candidateJourneyIds?: readonly string[];
    readonly omittedCandidateJourneys?: number;
    readonly unresolvedExecutionEdgeIds: readonly string[];
    readonly omittedUnresolvedExecutionEdges: number;
    /** Selected-source evidence not represented by this one exact IR flow. */
    readonly unmatchedEvidenceIds: readonly string[];
    readonly omittedUnmatchedEvidence: number;
  }[];
  readonly omittedEntries: number;
  /** Name-independent structural analogs among this task's source entries. */
  readonly structuralAnalogs?: readonly {
    readonly leftUnknownId: string;
    readonly rightUnknownId: string;
    readonly comparison: SourceBehaviorShapeComparison;
    /** Separate design and player-flow questions must be settled per entry;
     * similarity cannot transfer an objective from one source path to another.
     */
    readonly gameplayContrast: {
      readonly question: string;
      readonly leftDesignEvidenceIds: readonly string[];
      readonly rightDesignEvidenceIds: readonly string[];
      readonly leftPlayerFacingEvidenceIds: readonly string[];
      readonly rightPlayerFacingEvidenceIds: readonly string[];
      readonly missingIndependentDesignFor: readonly string[];
      readonly entryKindsDiffer: boolean;
      readonly proof: "SOURCE_ANALOGY_NOT_GAMEPLAY_EQUIVALENCE";
    };
  }[];
  readonly omittedStructuralAnalogs?: number;
}


/** A model's bounded SAME-ARM source hypothesis, never authored design. */
export interface AuditModelSourceInterpretationProposal {
  readonly taskId: string;
  readonly unknownId: string;
  readonly fromStepId: string;
  readonly toStepId: string;
  readonly proposedGameplayMeaning: string;
  readonly disconfirmingQuestion: string;
  readonly sourceClaim:
    | "SAME_AUTHORED_BRANCH_CANDIDATE"
    | "SOURCE_GUARD_VALUE_HANDOFF_CANDIDATE"
    | "SOURCE_EFFECT_RETURN_CANDIDATE";
}

/** Source-falsification review: never a Gameplay Intent or PROVE receipt. */
export interface AuditModelSourceInterpretationReview
  extends AuditModelSourceInterpretationProposal {
  readonly disposition:
    | "AUTHORED_BRANCH_COUNTEREXAMPLE"
    | "SOURCE_RELATION_UNRESOLVED"
    | "SOURCE_RELATION_CANDIDATE";
  /** Exact source operation IDs are NOT observed/runtime or gameplay proof. */
  readonly sourceRelationEvidenceIds?: readonly string[];
  readonly counterexample?: AuthoredBranchExclusion;
  readonly nextEvidenceQuestion: string;
  readonly proofBoundary:
    "AI_INTERPRETATION_NOT_GAMEPLAY_DESIGN_DEFECT_OR_RUNTIME_PROOF";
}

export interface AuditModelTaskPacket {
  readonly schemaVersion: 1;
  readonly policy: "bounded-audit-model-task";
  readonly id: string;
  readonly auditRevision: string;
  readonly kind: AuditModelTaskKind;
  readonly stage: SelectedMapAuditStage;
  readonly goal: string;
  readonly decisionNeeded: string;
  readonly scenarioId?: string;
  readonly causalLinkId?: string;
  readonly checkpointId?: string;
  readonly subjectIds: readonly string[];
  readonly componentIds: readonly string[];
  readonly requiredKnowledgeIds: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly evidenceContext: readonly AuditModelTaskEvidenceContext[];
  readonly unresolvedEvidenceIds: readonly string[];
  /** Unclassified source behavior is investigable without inventing a mechanic. */
  readonly sourceInvestigation?: AuditModelSourceInvestigation;
  /** One-shot, non-authoritative model review; discarded on audit rebuild. */
  readonly sourceInterpretationReviews?: readonly AuditModelSourceInterpretationReview[];
  /** Routing provenance, not an audit checkpoint or proof-state change. */
  readonly subjectSelection?: {
    readonly basis: "CHECKPOINT_EVIDENCE_LINK" | "SOURCE_ROLE_CANDIDATE";
    readonly omittedCandidates: number;
  };
  readonly knowledgeContext: readonly AuditModelTaskKnowledgeContext[];
  /** Route ChatGPT/source lookup from the current map, not from a generic bug taxonomy. */
  readonly knowledgeLookup?: AuditModelTaskKnowledgeLookup;
  /** Bounded, source-grounded Knowledge references; never a detector proof. */
  readonly retrievedKnowledge?: AuditModelTaskKnowledgeSelection;
  /** Optional reference questions; never a gameplay assertion or proof. */
  readonly developerPractice?: CompiledDeveloperPracticeReferenceContext;
  readonly unresolvedObligationIds: readonly string[];
  readonly userSearchContext?: {
    readonly authorityNote: string;
    readonly priorityDomains:
      readonly string[];
    readonly priorityPlayerFlows:
      readonly string[];
    readonly symptomHints:
      readonly string[];
    readonly suspicionHints:
      readonly string[];
    readonly expectationHints:
      readonly string[];
    readonly designHints:
      readonly string[];
    readonly historicalHints:
      readonly string[];
    readonly scopeHints:
      readonly string[];
    readonly exclusionHints:
      readonly string[];
    readonly testConstraints:
      readonly string[];
  };
  readonly proofGoal?: string;
  readonly provenClaims?: readonly string[];
  readonly missingClaims?: readonly string[];
  readonly navigationRoute?: readonly {
    readonly order: number;
    readonly knowledgeDomain: string;
    readonly question: string;
    readonly purpose: string;
    readonly evidencePreference: string;
  }[];
  readonly evidenceSubstitutions?: readonly {
    readonly id: string;
    readonly replaces: string;
    readonly requiredEvidence: readonly string[];
    readonly applicableBecause: readonly string[];
    readonly decisionRule: string;
  }[];
  readonly historicalSearchHints?: readonly {
    readonly id: string;
    readonly family: string;
    readonly priority: "high" | "medium";
    readonly knowledgeDomains: readonly string[];
    readonly searchQuestions: readonly string[];
    readonly matchedBecause: readonly string[];
  }[];
  readonly historyPressure?: number;
  readonly familyProofCriteria?: readonly string[];
  readonly proofStopRule?: string;
  /**
   * False means the model must keep resolving source/cross-domain/formal proof
   * and must not hand the task to a local Minecraft/player test.
   */
  readonly runtimeRequired?: boolean;
  readonly allowedOutputs: readonly string[];
  readonly forbiddenActions: readonly string[];
  readonly stopCondition: string;
}

/** Shared, frozen read-only projection values for the high-volume obligation
 * lane. Values are not a new evidence store: each packet retains all own
 * source IDs, reason, missing proof and task identity. */
const EMPTY_TASK_IDS: readonly string[] = Object.freeze([] as string[]);
const EMPTY_TASK_CONTEXT: readonly AuditModelTaskEvidenceContext[] =
  Object.freeze([] as AuditModelTaskEvidenceContext[]);
const EMPTY_KNOWLEDGE_CONTEXT: readonly AuditModelTaskKnowledgeContext[] =
  Object.freeze([] as AuditModelTaskKnowledgeContext[]);
const EMPTY_EVIDENCE_RESULT = Object.freeze({
  context: EMPTY_TASK_CONTEXT,
  unresolved: EMPTY_TASK_IDS,
});
const OBLIGATION_ALLOWED_OUTPUTS: readonly string[] = Object.freeze([
  "selected-artifact evidence that resolves the obligation",
  "evidence-backed not-applicable or normal-behavior disposition",
  "new causal dependency/contradiction evidence for a fresh canonical audit run",
  "source-bounded interpretation hypothesis with a counterexample, never an inferred gameplay rule",
  "exact remaining missing-proof statement",
]);
const OBLIGATION_FORBIDDEN_ACTIONS: readonly string[] = Object.freeze([
  "classify BUG or DESIGN_MISMATCH without a player-visible causal contradiction",
  "assign severity",
  "invent expected behavior",
  "treat risk presence as defect proof",
  "use stale or external map behavior as current gameplay authority",
  "claim the obligation is closed from model narrative alone",
]);

function unique(values: readonly string[]): string[] {
  return [...new Set(
    values.filter((value) => value.trim().length > 0),
  )].sort();
}

const SOURCE_EVIDENCE_ORIGINS = new Set([
  "game-design-spec", "source-code", "manifest", "command",
  "scoreboard", "tag", "dialogue", "translation", "structure", "world-db",
]);
function isCurrentArtifactSourceEvidence(
  evidence: GameplayIntentModel["evidence"][number] | undefined,
): evidence is GameplayIntentModel["evidence"][number] {
  return evidence !== undefined &&
    evidence.scope === "selected-artifact" &&
    SOURCE_EVIDENCE_ORIGINS.has(evidence.origin);
}

// A lookup suggestion uses only source-grounded selected-map mechanics.
// Unknown/hypothetical subjects remain visible and never become a reason to
// invent a mechanic or force an unrelated global knowledge domain.
/** Ephemeral lookup tables for one audit-result projection. The canonical Intent
 * arrays remain the authority; no cache survives a run or its revisions. */
interface AuditModelIntentLookup {
  readonly evidenceById: ReadonlyMap<string, GameplayIntentModel["evidence"][number]>;
  readonly nodeById: ReadonlyMap<string, GameplayIntentModel["nodes"][number]>;
}
function buildAuditModelIntentLookup(intent: GameplayIntentModel): AuditModelIntentLookup {
  // Maintain the existing Map-from-array last-owner semantics for duplicate IDs.
  return {
    evidenceById: new Map(intent.evidence.map(item => [item.id, item])),
    nodeById: new Map(intent.nodes.map(item => [item.id, item])),
  };
}

export function deriveAuditModelKnowledgeLookup(
  intent: GameplayIntentModel,
  question: string,
  subjectIds: readonly string[],
  lookupIndex?: AuditModelIntentLookup,
): AuditModelTaskKnowledgeLookup | undefined {
  const wanted = unique(subjectIds);
  if (wanted.length === 0) return undefined;

  const index = lookupIndex ?? buildAuditModelIntentLookup(intent);
  const evidenceById = index.evidenceById;
  const bySubject = index.nodeById;
  const supported = wanted.flatMap((id) => {
    const node = bySubject.get(id);
    if (node === undefined || node.status === "hypothesis") return [];
    const sourceEvidenceIds = node.evidenceIds.filter((evidenceId) => {
      return isCurrentArtifactSourceEvidence(evidenceById.get(evidenceId));
    });
    return sourceEvidenceIds.length === 0
      ? []
      : [{ node, sourceEvidenceIds }];
  });
  const matchedIds = new Set(supported.map(({ node }) => node.id));
  const bounded = supported.slice(0, 4);
  const query = [
    question.trim().slice(0, 220),
    ...bounded.map(({ node }) => node.label.trim().slice(0, 90)),
  ].filter(Boolean).join(" ").trim();
  if (!query) return undefined;
  const usedEvidenceIds = unique(
    bounded.flatMap(({ sourceEvidenceIds }) => sourceEvidenceIds),
  );

  return {
    query,
    matchedSubjectIds: bounded.map(({ node }) => node.id),
    sourceEvidenceIds: usedEvidenceIds,
    sourceLocators: unique(usedEvidenceIds.flatMap((id) => {
      const locator = evidenceById.get(id)?.locator;
      return locator === undefined ? [] : [locator];
    })),
    unresolvedSubjectIds: wanted.filter((id) => !matchedIds.has(id)),
    omittedSupportedSubjectIds: supported.slice(4).map(({ node }) => node.id),
    grounding: bounded.length > 0 ? "SELECTED_ARTIFACT" : "GOAL_ONLY",
    authority: "SEARCH_HINT_NOT_GAMEPLAY_PROOF",
  };
}


/** One-query-batch Knowledge index. Same catalog, edition and source order;
 * only repeated tokenization/source resolution is avoided. Not a knowledge
 * cache across audits, proof state, map revisions or source variants. */
function prepareAuditTaskKnowledgeIndex(
  catalog: KnowledgeCatalog,
  edition?: KnowledgeEdition,
) {
  const sourcesById = new Map(
    catalog.sources.map(source => [source.id, source]),
  );
  const entries = [
    ...catalog.facts.map((item) => ({
      kind: "fact" as const,
      item,
      statement: item.statement,
      extra: [
        ...item.capabilityTags,
        ...item.riskSurfaces,
        ...(item.diagnosticHints ?? []),
      ],
    })),
    ...(catalog.relations ?? []).map((item) => ({
      kind: "relation" as const,
      item,
      statement: item.subject + " " + item.kind + " " + item.object,
      extra: [
        ...(item.diagnosticHint === undefined ? [] : [item.diagnosticHint]),
        ...(item.causalConsequences ?? []),
      ],
    })),
  ].filter(({ item }) =>
    item.classification !== "project-policy" &&
    item.classification !== "open-assumption" &&
    (edition === undefined ||
      item.applicability.editions.includes(edition))
  );
  const documents = entries.map(({ item, statement, extra }) => ({
    id: item.id,
    text: [
      item.id, item.domain, item.subject, statement, ...extra,
    ].join(" "),
  }));
  // Index the same Unicode terms already used by candidate matching. The
  // lookup contains only entry POSITIONS; it is rebuilt for each audit and
  // cannot supply new Knowledge facts or cross-map scope.
  const bodyTerms = documents.map(doc => new Set(
    doc.text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [],
  ));
  const entriesByTerm = new Map<string, number[]>();
  for (let index = 0; index < bodyTerms.length; index += 1) {
    for (const term of bodyTerms[index]!) {
      const matches = entriesByTerm.get(term);
      if (matches) matches.push(index);
      else entriesByTerm.set(term, [index]);
    }
  }
  const bm25 = prepareTextDocumentScorer(documents);
  // Only exact repeated queries from THIS immutable catalog+edition batch
  // may reuse numerical BM25 scores. This is never a cross-map proof cache.
  const scoresByQuery = new Map<string, Readonly<Record<string, number>>>();
  const score = (query: string): Readonly<Record<string, number>> => {
    const cached = scoresByQuery.get(query);
    if (cached !== undefined) return cached;
    const value = bm25(query);
    // Prevent per-map memory growth when almost every question is unique.
    // Eviction affects computation cost only, not the selected evidence.
    if (scoresByQuery.size >= 512) {
      scoresByQuery.delete(scoresByQuery.keys().next().value!);
    }
    scoresByQuery.set(query, value);
    return value;
  };
  return {
    catalog,
    edition,
    sourcesById,
    entries,
    score,
    bodyTerms,
    entriesByTerm,
  };
}

// This is a read-only retrieval projection of the already-loaded Knowledge
// Catalog. The index and scores are ephemeral; source files retain authority.
// No Knowledge entry can create a gameplay subject or a report finding.
export function retrieveAuditTaskKnowledge(input: {
  readonly catalog: KnowledgeCatalog;
  readonly lookup: AuditModelTaskKnowledgeLookup;
  readonly intent: GameplayIntentModel;
  readonly edition?: KnowledgeEdition;
  /** Optional only within one projection; independent calls rebuild from current Intent. */
  readonly lookupIndex?: AuditModelIntentLookup;
  /** One canonical preprocessed catalog per model-task batch. */
  readonly preparedKnowledge?: ReturnType<typeof prepareAuditTaskKnowledgeIndex>;
}): AuditModelTaskKnowledgeSelection {
  const empty = (): AuditModelTaskKnowledgeSelection => ({
    status: "NO_SCOPED_MATCH",
    references: [],
    omitted: 0,
    basis: "CURRENT_MAP_SOURCE_GROUNDED_MECHANICS",
  });
  if (
    input.lookup.grounding !== "SELECTED_ARTIFACT" ||
    input.lookup.matchedSubjectIds.length === 0 ||
    input.lookup.sourceEvidenceIds.length === 0
  ) return empty();

  const index = input.lookupIndex ?? buildAuditModelIntentLookup(input.intent);
  const subjects = index.nodeById;
  const evidenceById = index.evidenceById;
  const groundedEvidenceIds = new Set(
    input.lookup.sourceEvidenceIds.filter((id) =>
      isCurrentArtifactSourceEvidence(evidenceById.get(id))),
  );
  const groundedSubjectIds = input.lookup.matchedSubjectIds.filter((id) => {
    const subject = subjects.get(id);
    return subject !== undefined &&
      subject.status !== "hypothesis" &&
      subject.evidenceIds.some((evidenceId) =>
        groundedEvidenceIds.has(evidenceId));
  });
  if (groundedSubjectIds.length === 0) return empty();
  const common = new Set([
    "the", "and", "from", "with", "this", "that", "game", "level",
    "challenge", "start", "source", "state", "system", "gameplay",
    "does", "what", "when", "where", "which", "that", "this",
    "determine", "whether", "expected", "actual", "result",
    "before", "after", "into", "with", "from", "keep",
  ]);
  const mechanicTokens = [...new Set(
    groundedSubjectIds
      .flatMap((id) =>
        subjects.get(id)?.label.toLowerCase()
          .match(/[\p{L}\p{N}]+/gu) ?? [])
      .filter((token) => token.length >= 3 && !common.has(token)),
  )].sort();
  if (mechanicTokens.length === 0) return empty();
  const questionTerms = [...new Set(
    input.lookup.query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [],
  )].filter((token) =>
    token.length >= 4 &&
    !common.has(token) &&
    !mechanicTokens.includes(token));

  const edition = input.edition;
  const prepared = input.preparedKnowledge?.catalog === input.catalog &&
    input.preparedKnowledge.edition === edition
      ? input.preparedKnowledge
      : prepareAuditTaskKnowledgeIndex(input.catalog, edition);
  const { sourcesById, entries, bodyTerms, entriesByTerm } = prepared;
  // Only records sharing the map's authored mechanic vocabulary can pass the
  // existing >=2 (or >=1) gate. Count matches using the once-built postings
  // instead of rescanning every unrelated catalog entry for every packet.
  const mechanicMatchCounts = new Map<number, number>();
  for (const token of mechanicTokens) {
    for (const index of entriesByTerm.get(token) ?? []) {
      mechanicMatchCounts.set(index, (mechanicMatchCounts.get(index) ?? 0) + 1);
    }
  }
  const minimumMatch = mechanicTokens.length >= 2 ? 2 : 1;
  const candidateIndices = [...mechanicMatchCounts]
    .filter(([, count]) => count >= minimumMatch)
    .map(([index]) => index)
    .sort((a, b) => a - b);
  // BM25 can only rank eligible mechanic candidates. An empty inverted
  // intersection cannot yield a reference, so skip query scoring entirely.
  if (candidateIndices.length === 0) return empty();
  const scores = prepared.score(input.lookup.query);
  const candidates = candidateIndices.flatMap((index) => {
    const { kind, item, statement } = entries[index]!;
    if ((scores[item.id] ?? 0) <= 0) return [];
    const sourceIds = item.sourceIds;
    const sources = sourceIds.flatMap((id) => {
      const source = sourcesById.get(id);
      return source === undefined ||
          source.authority === "project-policy"
        ? []
        : [source];
    });
    if (sourceIds.length === 0 || sources.length !== sourceIds.length) {
      return [];
    }
    const bodyTermsForEntry = bodyTerms[index];
    const matchedMechanicTerms = mechanicTokens.filter((token) =>
      bodyTermsForEntry?.has(token));
    const matchedQuestionTerms = questionTerms.filter((token) =>
      bodyTermsForEntry?.has(token));

    return [{
      record: {
        knowledgeId: item.id,
        kind,
        domain: item.domain,
        statement,
        classification: item.classification ?? "unspecified",
        applicability: item.applicability,
        editionCheck: edition === undefined
          ? "NOT_EVALUATED" as const
          : "MATCHED_EDITION_ONLY" as const,
        sourceIds: [...sourceIds],
        sources,
        matchedMechanicTerms,
        authority: "RETRIEVED_REFERENCE_NOT_BUG_PROOF" as const,
      },
      relevance: matchedMechanicTerms.length,
      questionRelevance: matchedQuestionTerms.length,
      score: scores[item.id] ?? 0,
    }];
  });
  candidates.sort((a, b) =>
    b.questionRelevance - a.questionRelevance ||
    b.relevance - a.relevance ||
    b.score - a.score ||
    a.record.knowledgeId.localeCompare(b.record.knowledgeId));

  // Prefer records answering the specific question, rather than merely
  // repeating broad mechanic/domain words. A single broad prerequisite
  // is safer than three weak coincidences when no specific term matches.
  const focused = candidates.some((item) => item.questionRelevance > 0)
    ? candidates.filter((item) => item.questionRelevance > 0)
    : candidates.slice(0, 1);
  const limit = 3;
  return {
    status: focused.length > 0 ? "MATCHED" : "NO_SCOPED_MATCH",
    references: focused.slice(0, limit).map(({ record }) => record),
    omitted: Math.max(0, candidates.length - Math.min(limit, focused.length)),
    basis: "CURRENT_MAP_SOURCE_GROUNDED_MECHANICS",
  };
}

function evidenceContext(
  evidenceIds: readonly string[],
  intent: GameplayIntentModel,
  lookupIndex?: AuditModelIntentLookup,
): {
  readonly context: readonly AuditModelTaskEvidenceContext[];
  readonly unresolved: readonly string[];
} {
  if (evidenceIds.length === 0) return EMPTY_EVIDENCE_RESULT;
  const byId = (lookupIndex ?? buildAuditModelIntentLookup(intent)).evidenceById;
  const context: AuditModelTaskEvidenceContext[] = [];
  const unresolved: string[] = [];

  for (const id of unique(evidenceIds)) {
    const evidence = byId.get(id);
    // Scope is source authority, not an optional convenience. An unscoped,
    // runtime or external reference must not become a selected-map witness
    // merely because its ID is present in the Gameplay Intent model.
    if (isCurrentArtifactSourceEvidence(evidence)) {
      context.push({
        id,
        kind: "selected-artifact-evidence",
        origin: evidence.origin,
        locator: evidence.locator,
        summary: evidence.summary,
      });
      continue;
    }

    if (id.startsWith("analysis:")) {
      context.push({
        id,
        kind: "analysis-receipt",
        summary:
          "Capability execution receipt; resolve concrete scoped evidence from the matching RIG knowledge receipt before making a factual source claim.",
      });
      continue;
    }

    unresolved.push(id);
  }

  return {
    context,
    unresolved: unresolved.sort(),
  };
}

function knowledgeContextFor(
  requirementIds: readonly string[],
  scenarioId: string,
  graph: GameplayScenarioGraph,
  world: GameplayWorldModel,
): readonly AuditModelTaskKnowledgeContext[] {
  return unique(requirementIds).flatMap<AuditModelTaskKnowledgeContext>((requirementId) => {
    const requirement = uniqueScenarioKnowledgeRequirement(
      graph, requirementId, scenarioId,
    );
    // Preserve unresolved Knowledge IDs as task context without choosing a
    // foreign/duplicate owner or borrowing a SATISFIED receipt as evidence.
    if (requirement === undefined) return [{
      requirementId,
      domain: "unresolved",
      status: "MISSING_RECEIPT",
      capabilityIds: [],
      evidenceIds: [],
    }];
    const admitted = satisfiedScenarioKnowledgeReceipt(graph, requirement);
    const receipts = graph.knowledgeReceipts.filter(
      (item) => item.requirementId === requirementId,
    );
    const scoped = receipts.length === 1 &&
      receipts[0]?.scenarioId === requirement.scenarioId &&
      receipts[0].domain === requirement.domain
        ? receipts[0]
        : undefined;
    return [{
      requirementId,
      domain: requirement.domain,
      status: admitted?.status ??
        (scoped?.status !== "SATISFIED"
          ? scoped?.status ?? "MISSING_RECEIPT"
          : "MISSING_RECEIPT"),
      capabilityIds:
        admitted?.capabilityIdsUsed.length
          ? [...admitted.capabilityIdsUsed]
          : [...requirement.capabilityIds],
      evidenceIds: [...(admitted?.evidenceIds ?? [])],
      ...(requirement.domain === "platform-constraints"
        ? { platformClaims: world.platformKnowledge.claims }
        : {}),
    }];
  });
}

/** Map UNDERSTAND checkpoints to actual Intent subjects without creating
 * another mechanic extractor. Direct evidence/unknown links win; A3–A6 can
 * use bounded source-backed role candidates when the receipt carries only
 * IR/scenario IDs. A7 never falls back to unrelated gameplay subjects.
 */
export function selectCheckpointIntentSubjects(
  checkpoint: MandatoryAuditCheckpointReceipt,
  intent: GameplayIntentModel,
): {
  readonly subjectIds: readonly string[];
  readonly basis?: "CHECKPOINT_EVIDENCE_LINK" | "SOURCE_ROLE_CANDIDATE";
  readonly omittedCandidates: number;
} {
  if (checkpoint.block !== "UNDERSTAND" || !checkpoint.blocksPublication) {
    return { subjectIds: [], omittedCandidates: 0 };
  }
  const kindsByCheckpoint: Readonly<Record<string, readonly string[]>> = {
    A3: ["objective", "phase", "outcome"],
    A4: ["state", "resource"],
    A5: ["actor", "role", "lifecycle", "state"],
    A6: ["objective", "phase", "outcome"],
    A7: ["mechanic", "objective", "phase", "state", "lifecycle",
      "resource", "actor", "role", "outcome", "spatial-region", "policy"],
  };
  const kinds = kindsByCheckpoint[checkpoint.id];
  if (!kinds) return { subjectIds: [], omittedCandidates: 0 };
  const eligibleKinds = new Set(kinds);
  const evidenceById = new Map(intent.evidence.map(item => [item.id, item]));
  const receiptIds = new Set([
    ...checkpoint.evidenceIds,
    ...checkpoint.obligations
      .filter(item => item.required && !item.satisfied)
      .flatMap(item => item.evidenceIds),
  ]);
  const blockedSubjectIds = new Set(intent.unknowns
    .filter(item => receiptIds.has(item.id) ||
      (item.evidenceIds ?? []).some(id => receiptIds.has(id)))
    .flatMap(item => item.blockedSubjectIds));
  const eligible = intent.nodes.filter(node =>
    eligibleKinds.has(node.kind) && node.status !== "hypothesis" &&
    node.evidenceIds.some(id =>
      isCurrentArtifactSourceEvidence(evidenceById.get(id))));
  const linked = eligible.filter(node => blockedSubjectIds.has(node.id) ||
    node.evidenceIds.some(id => receiptIds.has(id)));
  // A7 source debt may be enormous: use precise selected-source links only.
  const candidates = linked.length > 0 ? linked :
    checkpoint.id === "A7" ? [] : eligible;
  const selected = candidates.slice(0, 4);
  if (selected.length === 0) return { subjectIds: [], omittedCandidates: 0 };
  return {
    subjectIds: selected.map(node => node.id),
    basis: linked.length > 0
      ? "CHECKPOINT_EVIDENCE_LINK" : "SOURCE_ROLE_CANDIDATE",
    omittedCandidates: candidates.length - selected.length,
  };
}

function checkpointPackets(
  stage: SelectedMapAuditStage,
  procedure: MandatoryAuditProcedureReceipt,
  auditRevision: string,
  intent: GameplayIntentModel,
): readonly AuditModelTaskPacket[] {
  return procedure.checkpoints
    .filter((checkpoint) =>
      checkpoint.blocksPublication &&
      (
        (stage === "TARGET" && checkpoint.id === "A1") ||
        (stage === "DISCOVERY" && checkpoint.id === "A2") ||
        (stage === "UNDERSTAND" && checkpoint.id.startsWith("A") && checkpoint.id !== "A1" && checkpoint.id !== "A2") ||
        (stage === "FORMALIZE" && checkpoint.id.startsWith("B")) ||
        (stage === "EVALUATE" && checkpoint.id.startsWith("C")) ||
        (stage === "REPORT" && checkpoint.id.startsWith("E"))
      )
    )
    .map((checkpoint) => {
      const unresolved = checkpoint.obligations
        .filter((item) => item.required && !item.satisfied)
        .map((item) => item.id)
        .sort();
      const ids = unique([
        ...checkpoint.evidenceIds,
        ...checkpoint.obligations.flatMap((item) => item.evidenceIds),
      ]);
      const evidence = evidenceContext(ids, intent);
      const selection = selectCheckpointIntentSubjects(checkpoint, intent);
      return {
        schemaVersion: 1 as const,
        policy: "bounded-audit-model-task" as const,
        id: "task:checkpoint:" + checkpoint.id,
        auditRevision,
        kind: "CHECKPOINT_REASONING" as const,
        stage,
        goal:
          "Resolve only the blocking audit checkpoint " +
          checkpoint.id +
          " (" + checkpoint.label + ").",
        decisionNeeded:
          checkpoint.reason,
        checkpointId: checkpoint.id,
        subjectIds: selection.subjectIds,
        ...(selection.basis === undefined ? {} : {
          subjectSelection: {
            basis: selection.basis,
            omittedCandidates: selection.omittedCandidates,
          },
        }),
        componentIds: [],
        requiredKnowledgeIds: [],
        evidenceIds: ids,
        evidenceContext: evidence.context,
        unresolvedEvidenceIds: evidence.unresolved,
        knowledgeContext: [],
        unresolvedObligationIds: unresolved,
        allowedOutputs: [
          "diagnostic explanation of the blocking obligation",
          "missing evidence request",
          "detection gap",
        ],
        forbiddenActions: [
          "create or rank bug report items",
          "inspect unrelated gameplay systems",
          "infer intent from external/stale documents",
          "change audit stage",
          "claim the checkpoint is closed",
          "override deterministic obligation status",
          "infer the contents of unresolvedEvidenceIds",
        ],
        stopCondition:
          "Stop after diagnosing the current blocker and identifying the smallest evidence/engine change required. Do not close the checkpoint from model narrative; closure requires a new canonical audit run over updated evidence/engine state.",
      };
    });
}


/** Bind an existing UNDERSTAND obligation to its exact selected-source IR
 * neighborhood. Do not classify methods or infer gameplay from symbols;
 * unmatched paths and omitted sites remain visible, not silently absent.
 */
function deriveSourceInvestigation(
  obligation: AuditObligation,
  intent: GameplayIntentModel,
  graph: GameplayScenarioGraph,
  evidenceById: AuditModelIntentLookup["evidenceById"],
  sourceEffects?: GameplayArchitectureNavigation["gameplayStructure"]["uninterpretedSourceFlows"],
): AuditModelSourceInvestigation | undefined {
  if (obligation.stage !== "UNDERSTAND" ||
      intent.artifactId === undefined) return undefined;
  const unknownById = new Map(intent.unknowns.map(item => [item.id, item]));
  const effectByUnknown = new Map(
    (sourceEffects ?? []).map(item => [item.unknownId, item] as const));
  // Resolve candidate flows by entry once, rather than scanning the entire
  // scenario graph again for every unknown in a large map.
  const flowsByEntry = new Map<string, GameplaySourceFlowCandidate[]>();
  for (const flow of graph.sourceFlowCandidates ?? []) {
    const flows = flowsByEntry.get(flow.entryRegionId) ?? [];
    flows.push(flow);
    flowsByEntry.set(flow.entryRegionId, flows);
  }
  const candidates = obligation.subjectIds.flatMap(unknownId => {
    const unknown = unknownById.get(unknownId);
    if (!unknown?.sourceEntryRegionId) return [];
    const scopedIds = new Set((unknown.evidenceIds ?? []).filter(id =>
      isCurrentArtifactSourceEvidence(evidenceById.get(id))));
    if (scopedIds.size === 0) return [];
    const matching = (flowsByEntry.get(unknown.sourceEntryRegionId) ?? [])
      .map(flow => ({
        flow,
        matchedSteps: flow.sourceSteps.filter(step =>
          scopedIds.has(step.id) &&
          step.source.artifactId === intent.artifactId),
      }))
      .filter(item => item.matchedSteps.length > 0)
      .sort((a, b) =>
        Number(b.flow.sourceTraceStatus === "SOURCE_ROOT_TRACE") -
          Number(a.flow.sourceTraceStatus === "SOURCE_ROOT_TRACE") ||
        b.matchedSteps.length - a.matchedSteps.length ||
        a.flow.id.localeCompare(b.flow.id));
    const best = matching[0];
    return best === undefined ? [] : [{
      unknown,
      scopedIds,
      flow: best.flow,
      matchedSteps: best.matchedSteps,
    }];
  }).sort((a, b) =>
    Number(b.flow.sourceTraceStatus === "SOURCE_ROOT_TRACE") -
      Number(a.flow.sourceTraceStatus === "SOURCE_ROOT_TRACE") ||
    b.matchedSteps.length - a.matchedSteps.length ||
    a.unknown.id.localeCompare(b.unknown.id));

  if (candidates.length === 0) return undefined;
  const entries = candidates.slice(0, 4).map(({ unknown, scopedIds, flow, matchedSteps }) => {
    const steps = matchedSteps.slice(0, 6);
    const matchedIds = new Set(steps.map(step => step.id));
    const branchContexts = flow.branchPoints.flatMap(point => {
      if (point.source.artifactId !== intent.artifactId) return [];
      const arms = point.branches.map(arm => ({
        branch: arm.branch,
        matchedStepIds: [...new Set([
          ...arm.stateWriteOperationIds,
          ...arm.returnOutcomeIds,
          ...arm.resourceActionIds,
          ...(arm.worldEffectIds ?? []),
        ].filter(id => matchedIds.has(id)))].sort(),
      })).filter(arm => arm.matchedStepIds.length > 0);
      return arms.length > 0
        ? [{ expression: point.expression, source: point.source, arms }]
        : [];
    });
    const handoffs = (flow.sourceHandoffs ?? []).filter(handoff =>
      handoff.source.artifactId === intent.artifactId &&
      handoff.directTargetStepIds.some(id => matchedIds.has(id)));
    const unresolved = unique(flow.unresolvedExecutionEdgeIds);
    const matchedAll = new Set(matchedSteps.map(step => step.id));
    const unmatched = [...scopedIds].filter(id =>
      !matchedAll.has(id)).sort();
    const sourceEffect = effectByUnknown.get(unknown.id);
    // Match the SAME unknown, entry, selected-artifact effect identity and
    // bound source steps. Other map versions and neighboring paths cannot
    // silently provide evidence for this task.
    const applicableEffects = sourceEffect !== undefined &&
      sourceEffect.entryRegionId === flow.entryRegionId
      ? sourceEffect.effectPaths.filter(effect =>
          scopedIds.has(effect.effectId) &&
          steps.some(step => step.id === effect.effectId &&
            step.source.artifactId === intent.artifactId))
        .sort((a, b) => a.effectId.localeCompare(b.effectId))
      : [];
    const gameplayEvidenceInquiry = deriveUnknownGameplayEvidenceInquiry(
      intent, unknown.id, steps.map(step => step.id));
    // Cross from source to an existing authored journey ONLY when the same
    // current source effect ID and rooted flow are both represented AND a
    // selected Intent subject is explicitly linked to this unknown. No
    // chronological claim follows from this membership.
    const linkedSubjects = new Set(gameplayEvidenceInquiry?.subjectLinks
      .map(link => link.subjectId) ?? []);
    const journeyLeads = flow.sourceTraceStatus === "SOURCE_ROOT_TRACE"
      ? (graph.gameplayJourneyCandidates ?? []).filter(journey =>
          journey.exactSourceFlowIds.includes(flow.id) &&
          journey.evidenceIds.some(id => matchedIds.has(id)) &&
          journey.subjectIds.some(id => linkedSubjects.has(id)))
        .sort((a, b) => a.id.localeCompare(b.id))
      : [];
    const effectPaths = applicableEffects.slice(0, 4).map(effect => {
      const guardReads = unique(effect.guardStateReadIds);
      const handoffs = effect.sourceLocalStateValueHandoffs.filter(item =>
        guardReads.includes(item.guardReadOperationId) &&
        steps.some(step => step.id === item.writeOperationId &&
          step.kind === "state" && step.operation === "write" &&
          step.source.artifactId === intent.artifactId));
      const outcomes = unique(effect.candidateOutcomeIds.filter(id =>
        steps.some(step => step.id === id &&
          step.kind === "return" &&
          step.source.artifactId === intent.artifactId)));
      const ingressIds = unique(effect.matchingIngress
        .flatMap(path => path.executionEdgeIds));
      return {
        effectId: effect.effectId,
        effectKind: effect.effectKind,
        worldEffectKind: effect.worldEffectKind,
        targetLabel: effect.targetLabel,
        evidenceStatus: effect.evidenceStatus,
        guardStateReadIds: guardReads.slice(0, 6),
        omittedGuardStateReads: Math.max(0, guardReads.length - 6),
        sourceLocalStateValueHandoffs: handoffs.slice(0, 4),
        omittedValueHandoffs: Math.max(0, handoffs.length - 4),
        candidateOutcomeIds: outcomes.slice(0, 6),
        omittedCandidateOutcomes: Math.max(0, outcomes.length - 6),
        ingressEdgeIds: ingressIds.slice(0, 6),
        omittedIngressEdges: Math.max(0, ingressIds.length - 6),
        temporalBoundaryCount: effect.matchingIngress.reduce((sum, path) =>
          sum + path.temporalBoundaryEvidence.length, 0),
      };
    });
    return {
      unknownId: unknown.id,
      question: unknown.question,
      entryRegionId: unknown.sourceEntryRegionId!,
      sourceTraceStatus: flow.sourceTraceStatus ?? "UNKNOWN",
      steps,
      omittedSteps: matchedSteps.length - steps.length,
      ...((graph.reviewedSourceRelationships ?? [])
        .filter(relation => relation.unknownId === unknown.id &&
          relation.sourceEntryRegionId === flow.entryRegionId)
        .length === 0 ? {} : {
          reviewedSourceRelationships: (graph.reviewedSourceRelationships ?? [])
            .filter(relation => relation.unknownId === unknown.id &&
              relation.sourceEntryRegionId === flow.entryRegionId),
        }),
      ...(gameplayEvidenceInquiry === undefined ? {} : {
        gameplayEvidenceInquiry,
        candidateJourneyIds: journeyLeads.slice(0, 3).map(item => item.id),
        omittedCandidateJourneys: Math.max(0, journeyLeads.length - 3),
      }),
      branchContexts: branchContexts.slice(0, 4),
      omittedBranchContexts: branchContexts.length - Math.min(4, branchContexts.length),
      handoffs: handoffs.slice(0, 4),
      omittedHandoffs: handoffs.length - Math.min(4, handoffs.length),
      ...(sourceEffects === undefined ? {} : {
        effectPaths,
        omittedEffectPaths: applicableEffects.length - effectPaths.length,
        behaviorShape: describeSourceBehaviorShape({
          sourceTraceStatus: flow.sourceTraceStatus ?? "UNKNOWN",
          entryKind: flow.entryKind,
          steps,
          effects: effectPaths,
          omittedSteps: matchedSteps.length - steps.length,
          omittedEffects: applicableEffects.length - effectPaths.length,
          unresolvedSourceEdges: flow.unresolvedExecutionEdgeIds.length,
        }),
      }),
      unresolvedExecutionEdgeIds: unresolved.slice(0, 6),
      omittedUnresolvedExecutionEdges: unresolved.length - Math.min(6, unresolved.length),
      unmatchedEvidenceIds: unmatched.slice(0, 4),
      omittedUnmatchedEvidence: unmatched.length - Math.min(4, unmatched.length),
    };
  });
  // Pair only already-selected source entries. This neither discovers new
  // mechanics nor permits source-shape similarity to serve as defect proof.
  const comparable = entries.flatMap((left, index) =>
    entries.slice(index + 1).flatMap(right => {
      // Never compare one duplicated unknown or its same execution entry as
      // independent implementations, even when their shape is identical.
      if (left.unknownId === right.unknownId ||
          left.entryRegionId === right.entryRegionId ||
          !left.behaviorShape || !right.behaviorShape) return [];
      const comparison = compareSourceBehaviorShapes(
        left.behaviorShape, right.behaviorShape);
      if (comparison.disposition !== "STRUCTURAL_ANALOG_CANDIDATE") return [];
      const leftDesign = left.gameplayEvidenceInquiry?.approvedDesignEvidenceIds ?? [];
      const rightDesign = right.gameplayEvidenceInquiry?.approvedDesignEvidenceIds ?? [];
      const leftPlayer = left.gameplayEvidenceInquiry?.playerFacingEvidenceIds ?? [];
      const rightPlayer = right.gameplayEvidenceInquiry?.playerFacingEvidenceIds ?? [];
      return [{
        leftUnknownId: left.unknownId,
        rightUnknownId: right.unknownId,
        comparison,
        gameplayContrast: {
          question: "Compare exact source entry " +
            left.entryRegionId.slice(0, 120) +
            " (" + left.behaviorShape.entryKind + ") with " +
            right.entryRegionId.slice(0, 120) + " (" + right.behaviorShape.entryKind +
            "). Do they serve the SAME player objective and flow step? " +
            "Left approved design: " +
            (leftDesign.length
              ? leftDesign.slice(0, 2).map(id => id.slice(0, 120)).join(", ")
              : "NOT LINKED") +
            "; right approved design: " +
            (rightDesign.length
              ? rightDesign.slice(0, 2).map(id => id.slice(0, 120)).join(", ")
              : "NOT LINKED") +
            ". Independently verify both trigger conditions, player/arena/session " +
            "ownership, source outcome and presented UI" +
            (comparison.entryKindsDiffer
              ? "; their authored entry kinds differ"
              : "") + ". Source-shape similarity is not gameplay equivalence.",
          leftDesignEvidenceIds: leftDesign,
          rightDesignEvidenceIds: rightDesign,
          leftPlayerFacingEvidenceIds: leftPlayer,
          rightPlayerFacingEvidenceIds: rightPlayer,
          missingIndependentDesignFor: [
            ...(leftDesign.length ? [] : [left.unknownId]),
            ...(rightDesign.length ? [] : [right.unknownId]),
          ],
          entryKindsDiffer: comparison.entryKindsDiffer,
          proof: "SOURCE_ANALOGY_NOT_GAMEPLAY_EQUIVALENCE" as const,
        },
      }];
    }));
  return {
    authority: "SELECTED_SOURCE_PATH_CONTEXT_NOT_GAMEPLAY_OR_RUNTIME_PROOF",
    entries,
    omittedEntries: candidates.length - entries.length,
    ...(sourceEffects === undefined ? {} : {
      structuralAnalogs: comparable.slice(0, 4),
      omittedStructuralAnalogs: Math.max(0, comparable.length - 4),
    }),
  };
}


/** Validate exact source ownership before assessing a model-supplied claim.
 * The only falsifiable relation here is SAME-ARM code-site membership; do
 * not promote model language into authored game rules or defect findings.
 */
export function reviewAuditModelSourceInterpretation(
  task: AuditModelTaskPacket,
  proposal: AuditModelSourceInterpretationProposal,
  selectedArtifactId: string,
): AuditModelSourceInterpretationReview {
  if (task.kind !== "AUDIT_OBLIGATION" ||
      task.stage !== "UNDERSTAND" ||
      task.id !== proposal.taskId ||
      task.sourceInvestigation?.authority !==
        "SELECTED_SOURCE_PATH_CONTEXT_NOT_GAMEPLAY_OR_RUNTIME_PROOF" ||
      !([
        "SAME_AUTHORED_BRANCH_CANDIDATE",
        "SOURCE_GUARD_VALUE_HANDOFF_CANDIDATE",
        "SOURCE_EFFECT_RETURN_CANDIDATE",
      ] as readonly string[]).includes(proposal.sourceClaim) ||
      !selectedArtifactId.trim()) {
    throw new Error("Source interpretation is not a current UNDERSTAND source task.");
  }
  const meaning = proposal.proposedGameplayMeaning?.trim();
  const question = proposal.disconfirmingQuestion?.trim();
  if (typeof meaning !== "string" || meaning.length < 5 || meaning.length > 500 ||
      typeof question !== "string" || question.length < 5 || question.length > 400 ||
      typeof proposal.fromStepId !== "string" ||
      typeof proposal.toStepId !== "string" ||
      !proposal.fromStepId.trim() || !proposal.toStepId.trim() ||
      proposal.fromStepId === proposal.toStepId) {
    throw new Error("Source interpretation requires two distinct steps and bounded falsifiable wording.");
  }
  const entries = task.sourceInvestigation.entries.filter(entry =>
    entry.unknownId === proposal.unknownId);
  if (entries.length !== 1) {
    throw new Error("Source interpretation lacks a unique selected unknown.");
  }
  const entry = entries[0]!;
  if (entry.reviewedSourceRelationships?.some(relation =>
    relation.sourceClaim === proposal.sourceClaim &&
    relation.fromStepId === proposal.fromStepId &&
    relation.toStepId === proposal.toStepId)) {
    throw new Error("Source relationship already admitted; investigate remaining gameplay meaning instead.");
  }
  const from = entry.steps.filter(step =>
    step.id === proposal.fromStepId &&
    step.source.artifactId === selectedArtifactId);
  const to = entry.steps.filter(step =>
    step.id === proposal.toStepId &&
    step.source.artifactId === selectedArtifactId);
  if (from.length !== 1 || to.length !== 1 ||
      !task.evidenceIds.includes(proposal.fromStepId) ||
      !task.evidenceIds.includes(proposal.toStepId)) {
    throw new Error("Source interpretation cites missing, duplicate or foreign operation IDs.");
  }
  const contexts = entry.branchContexts.map(point => ({
    expression: point.expression,
    source: point.source,
    arms: point.arms.map(arm => ({
      branch: arm.branch,
      evidenceIds: arm.matchedStepIds,
    })),
  }));
  const counterexample = proposal.sourceClaim === "SAME_AUTHORED_BRANCH_CANDIDATE"
    ? findExclusiveAuthoredBranch(
        contexts, [proposal.fromStepId], [proposal.toStepId], selectedArtifactId)
    : undefined;
  // An existing typed SourceEffectSlice is a candidate semantic relationship,
  // not a causal or gameplay proof. Missing relationship stays UNKNOWN.
  const matchedEffect = (entry.effectPaths ?? []).find(effect =>
    proposal.sourceClaim === "SOURCE_GUARD_VALUE_HANDOFF_CANDIDATE"
      ? effect.effectId === proposal.toStepId &&
        effect.sourceLocalStateValueHandoffs.some(handoff =>
          handoff.writeOperationId === proposal.fromStepId &&
          effect.guardStateReadIds.includes(handoff.guardReadOperationId))
      : proposal.sourceClaim === "SOURCE_EFFECT_RETURN_CANDIDATE"
        ? effect.effectId === proposal.fromStepId &&
          effect.candidateOutcomeIds.includes(proposal.toStepId)
        : false);
  const sourceRelationEvidenceIds = matchedEffect === undefined
    ? undefined : unique([proposal.fromStepId, proposal.toStepId]);
  return {
    taskId: task.id,
    unknownId: entry.unknownId,
    fromStepId: proposal.fromStepId,
    toStepId: proposal.toStepId,
    proposedGameplayMeaning: meaning,
    disconfirmingQuestion: question,
    sourceClaim: proposal.sourceClaim,
    disposition: counterexample
      ? "AUTHORED_BRANCH_COUNTEREXAMPLE"
      : sourceRelationEvidenceIds !== undefined
        ? "SOURCE_RELATION_CANDIDATE" : "SOURCE_RELATION_UNRESOLVED",
    ...(counterexample ? { counterexample } : {}),
    ...(sourceRelationEvidenceIds === undefined ? {} : { sourceRelationEvidenceIds }),
    nextEvidenceQuestion: counterexample
      ? "Inspect the alternative authored branch and later re-entry/repeat paths before attributing both sites to one mechanic."
      : sourceRelationEvidenceIds !== undefined
        ? "Verify session/receiver identity, guard feasibility, independent intended gameplay and runtime delivery before treating this source relation as gameplay."
        : "Trace exact guards, other entry paths, state ownership and independent intended gameplay; a shared trace is not execution proof.",
    proofBoundary: "AI_INTERPRETATION_NOT_GAMEPLAY_DESIGN_DEFECT_OR_RUNTIME_PROOF",
  };
}

function obligationPackets(
  obligations: readonly AuditObligation[],
  auditRevision: string,
  intent: GameplayIntentModel,
  lookupIndex: AuditModelIntentLookup,
  graph: GameplayScenarioGraph,
  sourceEffects?: GameplayArchitectureNavigation["gameplayStructure"]["uninterpretedSourceFlows"],
): readonly AuditModelTaskPacket[] {
  const unknownById = new Map(intent.unknowns.map(item => [item.id, item]));
  const evidenceById = lookupIndex.evidenceById;
  return obligations.map((obligation) => {
    // UNDERSTAND obligations may reference exact unknown IDs rather than
    // ordinary model nodes. Preserve those identities while supplying their
    // actual selected-source operations to the same canonical model task.
    // The linked source is INVESTIGATION CONTEXT, never a design rule,
    // checkpoint closure, or authorization to confirm a gameplay defect.
    const unknownEvidenceIds = obligation.stage === "UNDERSTAND"
      ? unique(obligation.subjectIds.flatMap(id =>
          unknownById.get(id)?.evidenceIds ?? []))
        .filter(id => isCurrentArtifactSourceEvidence(evidenceById.get(id)))
      : EMPTY_TASK_IDS;
    const sourceInvestigation = deriveSourceInvestigation(
      obligation, intent, graph, evidenceById, sourceEffects);
    // Prioritize exact material source operations over unrelated unknown IDs.
    // This preserves the one-packet budget and never changes proof admission.
    const prioritizedIds = sourceInvestigation?.entries.flatMap(entry =>
      entry.steps.map(step => step.id)) ?? [];
    const selectedUnknownEvidenceIds = unknownEvidenceIds.length === 0
      ? EMPTY_TASK_IDS
      : [...new Set([...prioritizedIds, ...unknownEvidenceIds])].slice(0, 24);
    const omittedUnknownEvidenceCount =
      unknownEvidenceIds.filter(id => !selectedUnknownEvidenceIds.includes(id)).length;
    const evidenceIds = obligation.evidenceIds.length === 0 &&
        selectedUnknownEvidenceIds.length === 0
      ? EMPTY_TASK_IDS
      : unique([...obligation.evidenceIds, ...selectedUnknownEvidenceIds]);
    const evidence = evidenceContext(evidenceIds, intent, lookupIndex);
    const selectedEntries = new Set(
      sourceInvestigation?.entries.map(entry => entry.unknownId) ?? []);
    const exactSourceQuestions = (obligation.sourceProofRequirements ?? [])
      .filter(item => selectedEntries.has(item.unknownId))
      .flatMap(item => item.missingClaims.map(claim =>
        item.unknownId + ": " + claim)).slice(0, 12);
    const verifiedSourceClaims = (obligation.sourceProofRequirements ?? [])
      .filter(item => selectedEntries.has(item.unknownId))
      .flatMap(item => (item.sourceResolvedClaims ?? []).map(claim =>
        item.unknownId + ": " + claim)).slice(0, 6);
    const omittedSourceRequirements =
      (obligation.omittedSourceProofRequirements ?? 0) +
      (obligation.sourceProofRequirements ?? [])
        .filter(item => !selectedEntries.has(item.unknownId)).length;

    return {
      schemaVersion: 1 as const,
      policy: "bounded-audit-model-task" as const,
      id:
        "task:audit-obligation:" +
        obligation.id,
      auditRevision,
      kind: "AUDIT_OBLIGATION" as const,
      stage: obligation.stage,
      goal: obligation.title,
      decisionNeeded: obligation.reason +
        (exactSourceQuestions.length > 0
          ? " Investigate only the source-specific missing claims " +
            "listed in this task; they do not prove gameplay by themselves."
          : "") +
        (omittedSourceRequirements > 0
          ? " " + omittedSourceRequirements + " additional unknown source " +
            "identities remain outside this bounded task view." : "") +
        (sourceInvestigation?.entries.some(entry =>
          (entry.reviewedSourceRelationships?.length ?? 0) > 0)
          ? " Exact typed source relationships are already reviewed. " +
            "Investigate remaining player intent, scope and outcome; do not " +
            "repeat these source-pair hypotheses or claim gameplay proof." : "") +
        (omittedUnknownEvidenceCount === 0 ? "" :
          " The bounded source view omits " + omittedUnknownEvidenceCount +
          " additional selected-artifact operations; the canonical Intent unknowns retain them."),
      subjectIds: obligation.subjectIds.length === 0
        ? EMPTY_TASK_IDS : [...obligation.subjectIds],
      componentIds: obligation.componentIds.length === 0
        ? EMPTY_TASK_IDS : [...obligation.componentIds],
      requiredKnowledgeIds: EMPTY_TASK_IDS,
      evidenceIds,
      evidenceContext: evidence.context,
      unresolvedEvidenceIds:
        evidence.unresolved,
      ...(sourceInvestigation === undefined ? {} : { sourceInvestigation }),
      knowledgeContext: EMPTY_KNOWLEDGE_CONTEXT,
      unresolvedObligationIds: [
        obligation.id,
      ],
      ...(verifiedSourceClaims.length === 0
        ? {} : { provenClaims: verifiedSourceClaims }),
      missingClaims: exactSourceQuestions.length > 0
        ? exactSourceQuestions
        : [obligation.missingProof],
      allowedOutputs: OBLIGATION_ALLOWED_OUTPUTS,
      forbiddenActions: OBLIGATION_FORBIDDEN_ACTIONS,
      stopCondition:
        "Stop when the obligation is either evidence-backed normal/not-applicable, causally grounded for a fresh audit run, or reduced to one exact missing-proof requirement. Do not promote it directly to a report issue from model narrative.",
    };
  });
}

function provePackets(
  graph: GameplayScenarioGraph,
  gate: GameplayDefectResolutionGate,
  auditRevision: string,
  intent: GameplayIntentModel,
  world: GameplayWorldModel,
): readonly AuditModelTaskPacket[] {
  const ids = new Set([
    ...gate.gameplayTranslationRequiredIds,
    ...gate.counterProofSearchRequiredIds,
  ]);

  return graph.causalLinks
    .filter((link) => ids.has(link.id))
    .map((link) => {
      const scenario = graph.scenarios.find(
        (item) => item.id === link.scenarioId,
      );
      const needsTranslation =
        gate.gameplayTranslationRequiredIds.includes(link.id);
      const requirementIds = unique(link.knowledgeRequirementIds);
      // Handoff and proof admission must consume one authoritative evidence
      // boundary. A task cannot lose already sourced dimension witnesses or
      // gain unrelated sibling evidence merely from scenario proximity.
      const ids = sourceBoundAuditEvidenceIds(graph, link.id);
      const evidence = evidenceContext(ids, intent);
      return {
        schemaVersion: 1 as const,
        policy: "bounded-audit-model-task" as const,
        id:
          "task:" +
          (needsTranslation ? "translate:" : "counterproof:") +
          link.id,
        auditRevision,
        kind:
          needsTranslation
            ? "GAMEPLAY_TRANSLATION" as const
            : "COUNTERPROOF_SEARCH" as const,
        stage: "PROVE" as const,
        goal:
          needsTranslation
            ? "Translate the contradicted technical dependency into one concrete gameplay failure."
            : "Search only for deterministic blocking counter-proof for this contradicted gameplay dependency.",
        decisionNeeded:
          needsTranslation
            ? "Determine trigger, expected outcome, actual outcome, player-visible consequence, and affected scope."
            : "Determine whether a reachable guard/owner/generation/scope/cleanup/exclusion makes the wrong state unreachable before commit.",
        scenarioId: link.scenarioId,
        causalLinkId: link.id,
        subjectIds: unique(link.subjectIds),
        componentIds: unique(link.componentIds),
        requiredKnowledgeIds: requirementIds,
        evidenceIds: ids,
        evidenceContext: evidence.context,
        unresolvedEvidenceIds: evidence.unresolved,
        knowledgeContext:
          knowledgeContextFor(requirementIds, link.scenarioId, graph, world),
        unresolvedObligationIds: [],
        allowedOutputs:
          needsTranslation
            ? [
                "gameplay translation",
                "detection gap",
              ]
            : [
                "blocking counter-proof with evidence + CounterProofSearchReceipt",
                "counter-proof search exhausted within supplied scope + CounterProofSearchReceipt",
                "runtime proof required",
                "detection gap",
              ],
        forbiddenActions: [
          "inspect unrelated scenarios",
          "invent expected behavior not grounded in the selected artifact",
          "use nearby healthy code as counter-proof",
          "create final report text",
          "change severity",
          "infer the contents of unresolvedEvidenceIds",
        ],
        stopCondition:
          needsTranslation
            ? "Stop after one complete gameplay-causal translation or one explicit evidence gap."
            : "Stop only after returning a CounterProofSearchReceipt bound to this causal link scope. Exhaustion requires explicit searched dimensions, coverage evidence, exhaustiveWithinScope=true, and NO_BLOCKING_PROOF; a blocker requires BLOCKING_PROOF_FOUND.",
      };
    });
}


/** Developer method routing only; never a map-specific gameplay truth. */
const DEVELOPER_KIND_DOMAINS: Readonly<Record<string, readonly string[]>> = {
  actor: ["entity"], role: ["player"],
  phase: ["round", "timing"],
  lifecycle: ["lifecycle", "session"],
  state: ["state", "persistence"],
  resource: ["state", "inventory"],
  objective: ["progression"],
  outcome: ["round", "progression"],
  "spatial-region": ["spatial"],
};

export function deriveAuditModelTaskPackets(input: {
  readonly admission: SelectedMapAuditAdmission;
  readonly procedure: MandatoryAuditProcedureReceipt;
  readonly graph: GameplayScenarioGraph;
  /** Produced by the ONE canonical source/behavior navigation for this map. */
  readonly sourceEffectContext?: GameplayArchitectureNavigation["gameplayStructure"]["uninterpretedSourceFlows"];
  readonly defectResolution: GameplayDefectResolutionGate;
  readonly intent: GameplayIntentModel;
  readonly auditRevision: string;
  readonly world: GameplayWorldModel;
  readonly needValidationFindings?: readonly import("./map-audit-issue-projection.js").NeedValidationAuditIssueProjection[];
  readonly auditObligations?: readonly AuditObligation[];
  readonly userIntent?: AuditUserIntentEnvelope;
  readonly knowledgeCatalog?: KnowledgeCatalog;
  readonly developerPractice?: DeveloperPracticeReferenceData;
  readonly semanticIr?: SemanticIr;
  /** Selected artifact's manifest-backed packs, never a runtime state claim. */
  readonly selectedPacks?: readonly InspectedPack[];
  /** Only edition identity may be checked here; API/version remain unverified. */
  readonly knowledgeEdition?: KnowledgeEdition;
}): readonly AuditModelTaskPacket[] {
  const lookupIndex = buildAuditModelIntentLookup(input.intent);
  const preparedKnowledge = input.knowledgeCatalog === undefined ? undefined
    : prepareAuditTaskKnowledgeIndex(input.knowledgeCatalog, input.knowledgeEdition);
  const selectDeveloperReference = input.developerPractice !== undefined &&
    input.semanticIr !== undefined && input.intent.artifactId
      ? prepareDeveloperPracticeReferenceSelector(
          input.semanticIr, input.intent.artifactId,
        ) : undefined;
  // Source/pack inputs are immutable during this audit projection. Index
  // authored node POSITIONS once (not Map's last-writer node): duplicate
  // selected IDs must retain the original source-array order and all kinds.
  // Neither these routing indexes nor vendor references create map proof.
  const sourceNodePositionsById = new Map<string, number[]>();
  if (selectDeveloperReference !== undefined) {
    input.intent.nodes.forEach((node, index) => {
      const positions = sourceNodePositionsById.get(node.id);
      if (positions) positions.push(index);
      else sourceNodePositionsById.set(node.id, [index]);
    });
  }
  const manifestWitnesses = selectDeveloperReference === undefined ? [] :
    (input.selectedPacks ?? [])
      .filter(pack => pack.manifestSource !== undefined)
      .map(pack => ({
        packRoot: pack.root,
        source: pack.manifestSource!,
        ...(pack.minEngineVersion === undefined ? {} :
          { minEngineVersion: pack.minEngineVersion }),
        scriptModules: pack.scriptModules,
        ...(pack.worldAttachment === undefined ? {} :
          { worldAttachment: pack.worldAttachment }),
      }));
  const userPressure =
    deriveAuditUserIntentSearchPressure(
      input.userIntent,
    );
  const userSearchContext =
    input.userIntent === undefined
      ? undefined
      : {
          authorityNote:
            auditUserIntentAuthorityNote(),
          priorityDomains:
            Object.keys(userPressure.domains)
              .filter(
                (key) =>
                  (userPressure.domains as Record<string, number | undefined>)[key] !==
                  undefined,
              )
              .sort(),
          priorityPlayerFlows:
            Object.keys(userPressure.playerFlows)
              .filter(
                (key) =>
                  (userPressure.playerFlows as Record<string, number | undefined>)[key] !==
                  undefined,
              )
              .sort(),
          symptomHints:
            [...userPressure.symptomHints],
          suspicionHints:
            [...userPressure.suspicionHints],
          expectationHints:
            [...userPressure.expectationHints],
          designHints:
            [...userPressure.designHints],
          historicalHints:
            [...userPressure.historicalHints],
          scopeHints:
            [...userPressure.scopeHints],
          exclusionHints:
            [...userPressure.exclusionHints],
          testConstraints:
            [...userPressure.testConstraints],
        };

  const navigationPackets =
    (input.needValidationFindings ?? [])
      .filter((finding) =>
        finding.proofNavigation !== undefined
      )
      .map((finding) => {
        const navigation =
          finding.proofNavigation!;
        const evidence =
          evidenceContext(
            finding.evidenceIds,
            input.intent,
          );
        return {
          schemaVersion: 1 as const,
          policy: "bounded-audit-model-task" as const,
          id:
            "task:proof-navigation:" +
            finding.causalLinkId,
          auditRevision: input.auditRevision,
          kind: "PROOF_NAVIGATION" as const,
          stage: "PROVE" as const,
          goal:
            "Resolve NEED_VALIDATION finding " +
            finding.causalLinkId +
            " toward PROVEN using the cheapest sufficient proof route before runtime.",
          decisionNeeded:
            finding.validationReason,
          scenarioId: finding.scenarioId,
          causalLinkId: finding.causalLinkId,
          subjectIds: [...finding.subjectIds],
          componentIds: [...finding.componentIds],
          requiredKnowledgeIds: unique(finding.knowledgeRequirementIds ?? []),
          evidenceIds: [...finding.evidenceIds],
          evidenceContext: evidence.context,
          unresolvedEvidenceIds:
            evidence.unresolved,
          knowledgeContext: knowledgeContextFor(
            unique(finding.knowledgeRequirementIds ?? []),
            finding.scenarioId,
            input.graph,
            input.world,
          ),
          unresolvedObligationIds: [],
          proofGoal: navigation.proofGoal,
          provenClaims: [
            ...navigation.provenClaims,
          ],
          missingClaims: [
            ...navigation.missingClaims,
          ],
          navigationRoute: [
            ...navigation.route,
          ],
          evidenceSubstitutions: [
            ...navigation.evidenceSubstitutions,
          ],
          historicalSearchHints:
            navigation.historicalSearchHints.map(
              (hint) => ({
                id: hint.id,
                family: hint.family,
                priority: hint.priority,
                knowledgeDomains: [
                  ...hint.knowledgeDomains,
                ],
                searchQuestions: [
                  ...hint.searchQuestions,
                ],
                matchedBecause: [
                  ...hint.matchedBecause,
                ],
              }),
            ),
          historyPressure:
            navigation.historyPressure,
          familyProofCriteria: [
            ...navigation.familyProofCriteria,
          ],
          proofStopRule:
            navigation.proofStopRule,
          runtimeRequired:
            navigation.runtimeRequired === true,
          allowedOutputs: [
            "new selected-artifact proof",
            "cross-domain corroboration",
            "historically informed targeted search",
            "blocking counter-proof",
            "formal contradiction proof",
            "evidence substitution that removes runtime need",
            "PROVEN-ready causal resolution",
            "incremental familyProof with only still-missing criterion IDs, " +
              "exact current-source evidence, and unchanged confirmed disposition",
            ...(navigation.runtimeRequired === true
              ? [
                  "exactly one narrow runtime proof request after earlier routes are exhausted",
                ]
              : []),
          ],
          forbiddenActions: [
            "skip directly to runtime while an earlier navigation route remains applicable",
            ...(navigation.runtimeRequired === true
              ? []
              : [
                  "request a local Minecraft/player test while runtimeRequired=false",
                ]),
            "invent evidence",
            "infer unresolved evidence contents",
            "change severity",
            "inspect unrelated scenarios",
            "use historical/stale map behavior as current gameplay authority",
          ],
          stopCondition:
            navigation.runtimeRequired === true
              ? "Stop immediately when universal minimum proof and every applicable family saturation criterion are grounded with counter-proof cleared. If non-runtime proof still cannot decide the explicitly runtime-native claim, request exactly one narrow deciding runtime observation."
              : "Keep resolving selected-artifact, cross-domain, or formal proof until the claim is decided or the evidence model itself is shown insufficient. Do not request Minecraft/player testing merely to confirm a source-decidable claim.",
        };
      });

  const auditObligationPackets =
    obligationPackets(
      input.auditObligations ?? [],
      input.auditRevision,
      input.intent,
      lookupIndex,
      input.graph,
      input.sourceEffectContext,
    );

  const stage = input.admission.firstBlockingStage;
  const packets =
    stage === undefined
      ? [
          ...navigationPackets,
          ...auditObligationPackets,
        ]
      : stage === "PROVE"
        ? (() => {
            const prove = provePackets(
              input.graph,
              input.defectResolution,
              input.auditRevision,
              input.intent,
              input.world,
            );
            return prove.length > 0
              ? [
                  ...prove,
                  ...navigationPackets,
                  ...auditObligationPackets,
                ]
              : [
                  ...checkpointPackets(
                    stage,
                    input.procedure,
                    input.auditRevision,
                    input.intent,
                  ),
                  ...navigationPackets,
                  ...auditObligationPackets,
                ];
          })()
        : [
            ...checkpointPackets(
              stage,
              input.procedure,
              input.auditRevision,
              input.intent,
            ),
            ...navigationPackets,
            ...auditObligationPackets,
          ];

  // Navigation, PROVE and obligation packets may all be valid independent
  // work, but handoff must always introduce the earliest unresolved stage
  // first. Retain intra-stage producer order and every existing task ID.
  const orderedPackets = [...packets].sort((a, b) =>
    SELECTED_MAP_AUDIT_STAGE_ORDER.indexOf(a.stage) -
      SELECTED_MAP_AUDIT_STAGE_ORDER.indexOf(b.stage)
  );
  return orderedPackets.map((packet) => {
    const knowledgeLookup = deriveAuditModelKnowledgeLookup(
      input.intent,
      packet.decisionNeeded,
      packet.subjectIds,
      lookupIndex,
    );
    const retrievedKnowledge =
      input.knowledgeCatalog === undefined ||
      knowledgeLookup === undefined ||
      knowledgeLookup.grounding !== "SELECTED_ARTIFACT"
        ? undefined
        : retrieveAuditTaskKnowledge({
            catalog: input.knowledgeCatalog,
            lookup: knowledgeLookup,
            intent: input.intent,
            lookupIndex,
            ...(preparedKnowledge === undefined ? {} : { preparedKnowledge }),
            ...(input.knowledgeEdition === undefined
              ? {}
              : { edition: input.knowledgeEdition }),
          });
    // This entire enrichment is advisory. When there is no selected-source
    // developer selector or grounded subject, do not tokenize, traverse every
    // authored node, or rebuild manifest witnesses for each of thousands of
    // unrelated proof tasks. Canonical Knowledge/proof tasks stay unchanged.
    let reference: CompiledDeveloperPracticeReferenceContext | undefined;
    if (selectDeveloperReference !== undefined &&
        knowledgeLookup?.grounding === "SELECTED_ARTIFACT") {
      const subjectIds = new Set(knowledgeLookup.matchedSubjectIds);
      const authoredKinds = [...subjectIds]
        .flatMap(id => sourceNodePositionsById.get(id) ?? [])
        .sort((left, right) => left - right)
        .flatMap(index => {
          const kind = input.intent.nodes[index]!.kind;
          return [kind, ...(DEVELOPER_KIND_DOMAINS[kind] ?? [])];
        });
      const domains = [...new Set([
        // Keep canonical hyphenated domain IDs untouched. Maintain original
        // full-array kind order, including any duplicated source subject ID.
        ...packet.knowledgeContext.map(item => item.domain.toLowerCase()),
        ...[knowledgeLookup.query, ...authoredKinds]
          .join(" ").toLowerCase().split(/[^a-z0-9]+/g),
      ].filter(Boolean))];
      const versionQuestion = domains.some(term => [
        "manifest", "version", "versions", "edition", "compatibility",
        "compatible", "experiments", "experiment", "api",
      ].includes(term));
      // A causal task can carry a precise authored guard/effect site when
      // its broader Gameplay Intent subject only names the source file.
      const scopedSourceLocators = unique(packet.evidenceContext.flatMap(item =>
        item.kind === "selected-artifact-evidence" && item.locator
          ? [item.locator] : []));
      const candidateSourceLocators = unique([
        ...(knowledgeLookup.sourceLocators ?? []),
        ...scopedSourceLocators,
      ]);
      const preciseSourceSite = (locator: string): boolean =>
        /(?:#[/]\S+|#L[1-9]\d*(?:-L?[1-9]\d*)?(?::[1-9]\d*)?|:[1-9]\d*(?::[1-9]\d*)?)$/.test(locator);
      const scopedSites = scopedSourceLocators.filter(preciseSourceSite);
      const allSites = candidateSourceLocators.filter(preciseSourceSite);
      const referenceSourceLocators =
        packet.causalLinkId !== undefined && scopedSites.length > 0
          ? scopedSites
          : allSites.length > 0 ? allSites : candidateSourceLocators;
      if (referenceSourceLocators.length > 0 && domains.length > 0) {
        reference = selectDeveloperReference({
          data: input.developerPractice!,
          domains: [...new Set([
            ...domains,
            ...(versionQuestion ? ["manifest", "edition", "script-api"] : []),
          ])],
          sourceLocators: referenceSourceLocators,
          manifestWitnesses,
        });
      }
    }
    return {
      ...packet,
      ...(userSearchContext === undefined
        ? {}
        : { userSearchContext }),
      ...(knowledgeLookup === undefined ? {} : { knowledgeLookup }),
      ...(retrievedKnowledge === undefined ? {} : { retrievedKnowledge }),
      ...(reference?.items.length ? { developerPractice: reference } : {}),
    };
  });
}
