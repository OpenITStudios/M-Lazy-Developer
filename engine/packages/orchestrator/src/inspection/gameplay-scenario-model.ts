import type {
  GameplayIntentNodeKind,
  GameplayIntentModel,
} from "../../../gameplay-intent/src/index.js";
import type {
  AnalysisKnowledgeDomain,
} from "../../../analysis-planner/src/index.js";
import {
  semanticIrExecutionTraces,
  type ObservedExecutionTrace,
  type ObservedBranchPoint,
  type SemanticIr,
} from "../../../semantic-ir/src/index.js";
import type { ArenaRegionPlan } from "../../../../analyzers/topology/src/index.js";
import {
  reconcileSourceStateOutcomes,
  reconcileSourceResourceOutcomes,
  reconcileSourceWorldEffectOutcomes,
  deriveSourceEffectSlices,
  type SourceEffectSlice,
  type SourceStateValueHandoff,
  type SourceGuardedStateTransitionCandidate,
  type SourceWorldEffectOutcomeCandidate,
  type SourceStateOutcomeCandidate,
  type SourceResourceOutcomeCandidate,
} from "../../../behavior-model/src/index.js";

export type GameplayKnowledgeDomain = AnalysisKnowledgeDomain;

export interface GameplayKnowledgeRequirement {
  readonly id: string;
  readonly scenarioId: string;
  readonly domain: GameplayKnowledgeDomain;
  readonly reason: string;
  readonly capabilityIds: readonly string[];
  readonly dependsOnRequirementIds: readonly string[];
  readonly subjectIds: readonly string[];
  readonly componentIds: readonly string[];
}

export type GameplayKnowledgeReceiptStatus =
  | "SATISFIED"
  | "BLOCKED_BY_PREREQUISITE"
  | "MISSING_REQUIRED_KNOWLEDGE"
  | "CAPABILITY_GAP";

export interface GameplayKnowledgeReceipt {
  readonly requirementId: string;
  readonly scenarioId: string;
  readonly domain: GameplayKnowledgeDomain;
  readonly status: GameplayKnowledgeReceiptStatus;
  readonly evidenceIds: readonly string[];
  /** Exact engine knowledge relations/facts that materially support this scenario requirement. */
  readonly knowledgeIds: readonly string[];
  readonly capabilityIdsUsed: readonly string[];
  readonly subjectIds: readonly string[];
  readonly componentIds: readonly string[];
  readonly reason: string;
}

export interface GameplayRequiredInspectionGraph {
  readonly policy: "required-inspection-graph";
  readonly nodes: readonly GameplayKnowledgeRequirement[];
  readonly receipts: readonly GameplayKnowledgeReceipt[];
}

export type GameplayCausalLinkStatus =
  | "PROVEN"
  | "CONTRADICTED"
  | "RUNTIME_BLOCKED"
  | "DETECTION_GAP";

export interface GameplayScenarioComponent {
  readonly id: string;
  readonly label: string;
  readonly kind:
    | GameplayIntentNodeKind
    | "runtime-domain";
  readonly technicalRole: string;
  readonly gameplayPurpose: string;
  readonly evidenceIds: readonly string[];
  readonly usedByScenarioIds: readonly string[];
  readonly orphan: boolean;
}

export interface GameplayCausalLink {
  readonly id: string;
  readonly scenarioId: string;
  readonly fromComponentId: string;
  readonly toComponentId: string;
  readonly purpose: string;
  readonly evidenceIds: readonly string[];
  readonly subjectIds: readonly string[];
  readonly componentIds: readonly string[];
  /** All scenario knowledge requirements that materially support this dependency. */
  readonly knowledgeRequirementIds: readonly string[];
  /** Proven selected-artifact dependency path from this link toward a player-facing objective/outcome. */
  readonly impactPathComponentIds: readonly string[];
  /** Selected-artifact evidence for every proven edge in impactPathComponentIds. Empty when no complete proven path exists. */
  readonly impactPathEvidenceIds: readonly string[];
  /**
   * Source-correlated witness IDs, keyed by the exact counterproof dimension.
   * Presence is not an exhaustive-search certificate. In particular, guard,
   * scope and exclusion may be filled only by their semantic evidence owner;
   * a scenario or runtime-component ID is never a guard/scope/exclusion proof.
   */
  readonly dimensionEvidence: Readonly<Partial<Record<
    "owner" | "guard" | "generation" | "scope" | "cleanup" | "exclusion" |
    "geometry" | "capability" | "world-rule" | "activation" | "representation",
    readonly string[]
  >>>;
  readonly intentEdgeKind?: import("../../../gameplay-intent/src/index.js").GameplayIntentEdgeKind;
  readonly status: GameplayCausalLinkStatus;
  /** Required only for RUNTIME_BLOCKED; identifies the irreducible native-runtime semantic. */
  readonly runtimeNativeReason?: "client-reconciliation" | "entity-navigation-manifestation" | "network-timing" | "engine-scheduling";
  readonly reason: string;
}

export interface GameplayScenario {
  readonly id: string;
  readonly label: string;
  readonly gameplayStage: string;
  readonly purpose: string;
  readonly sourceSubjectIds: readonly string[];
  readonly componentIds: readonly string[];
  readonly causalLinkIds: readonly string[];
  readonly playerCounts: readonly number[];
  readonly requiredKnowledgeIds: readonly string[];
  readonly composedScenarioIds: readonly string[];
}

/** Source-known behavior order is local to an execution region, not a player journey. */
export interface GameplaySourceFlowCandidate {
  readonly id: string;
  readonly entryRegionId: string;
  readonly entryKind: import("../../../semantic-ir/src/index.js").ExecutionRegionKind;
  /** SOURCE_ROOT_TRACE is a source-derived entry candidate, NEVER observed
   * gameplay. DISCONNECTED_SOURCE_REGION is preserved investigation evidence
   * that must not satisfy authored activation, player journey or exact-flow
   * support. Optional for old graph fixtures; canonical compilation emits it.
   * A missing value is UNKNOWN and cannot support rooted gameplay flow.
   */
  readonly sourceTraceStatus?: "SOURCE_ROOT_TRACE" | "DISCONNECTED_SOURCE_REGION";
  readonly regionIds: readonly string[];
  readonly executionEdgeIds: readonly string[];
  readonly unresolvedExecutionEdgeIds: readonly string[];
  readonly temporalRelationIds: readonly string[];
  readonly branchPoints: readonly ObservedBranchPoint[];
  /** Exact resolved IR edges with material sites in their direct target region.
   * Not a proof that the callback fired, survived reset, or caused those sites.
   */
  readonly sourceHandoffs?: readonly {
    readonly edgeId: string;
    readonly fromRegionId: string;
    readonly toRegionId: string;
    readonly kind: import("../../../semantic-ir/src/index.js").ExecutionEdgeKind;
    readonly source: import("../../../project-model/src/index.js").SourceRef;
    /** Exact source region of subscribe(); source eligibility only. */
    readonly registrationRegionId?: string;
    /** Custom Map-backed event listener source region; NOT runtime delivery. */
    readonly internalSubscriptionRegionId?: string;
    readonly scheduler?: "run" | "runTimeout" | "runInterval" | "runJob";
    readonly generationGuard: "EXPLICIT_SOURCE_CHECK" | "UNRESOLVED" | "NOT_RECORDED";
    readonly directTargetStepIds: readonly string[];
    readonly directTargetStateWriteIds: readonly string[];
    readonly directTargetWorldEffectIds: readonly string[];
    readonly directTargetReleaseIds: readonly string[];
    readonly omittedDirectTargetSteps: number;
    readonly proof: "RESOLVED_SOURCE_EDGE_NOT_RUNTIME_EXECUTION";
  }[];
  readonly omittedSourceHandoffs?: number;
  readonly sourceSteps: readonly {
    readonly id: string;
    readonly kind: "state" | "resource-action" | "return" | "world-effect";
    readonly executionRegionId: string;
    readonly source: import("../../../project-model/src/index.js").SourceRef;
    readonly targetLabel?: string;
    readonly operation?: string;
    /** Exact parser/IR state-write RHS syntax, not its live value. */
    readonly authoredWriteValueSyntax?: import("../../../semantic-ir/src/index.js").AuthoredStateWriteValueSyntax;
    readonly authoredTimingSeconds?: number;
  }[];
  /** Linked by IR world-effect IDs, never by filename/command text. */
  readonly authoredBehaviorRelationIds: readonly string[];
  readonly sourceOrderScope: "PER_EXECUTION_REGION_ONLY";
  readonly runtimeStatus: "NOT_OBSERVED";
}

/**
 * Classified mechanic + source evidence agreement, NOT executable behavior.
 * One owner: the existing Scenario Graph, from the same Gameplay Intent/IR.
 */
export interface GameplayMechanicReconstruction {
  readonly featureId: string;
  readonly kind: "mechanic" | "objective" | "phase" | "lifecycle" | "outcome";
  readonly name: string;
  readonly meaningStatus: "AUTHORED" | "INFERRED";
  readonly declaredEvidenceIds: readonly string[];
  /** Only source-root-traced flow IDs; not runtime activation proof. */
  readonly exactSourceFlowIds: readonly string[];
  /** Orphan source sites remain inspectable but are not flow evidence. */
  readonly disconnectedSourceFlowIds?: readonly string[];
  readonly exactSourceStepIds: readonly string[];
  readonly authoredBehaviorRelationIds: readonly string[];
  /** Candidate write IR ID is directly bound to feature source evidence; this is not proof of gameplay ownership or execution. */
  readonly sourceGuardedTransitionCandidateIds: readonly string[];
  /**
   * The feature and guarded read/write share a SOURCE REGION with
   * individually identified Semantic IR evidence. A broad trace may span
   * unrelated functions and alternate branches; trace co-membership ALONE
   * must not create a mechanic relationship. This is context only, NEVER
   * runtime reachability, a proven guard, or mechanic effect ownership.
   * Optional for historical graph fixtures; canonical compilation emits it.
   */
  readonly sourceGuardedTransitionContexts?: readonly {
    readonly readOperationId: string;
    readonly writeOperationId: string;
    readonly executionRegionId: string;
    /** The exact feature evidence IDs in the candidate's source region. */
    readonly featureRegionEvidenceIds: readonly string[];
    readonly sharedSourceFlowIds: readonly string[];
    readonly candidateStatus: "GUARDED_SOURCE_CANDIDATE" | "UNRESOLVED";
  }[];
  /** Source-only contexts omitted by the bounded per-feature navigation. */
  readonly sourceGuardedTransitionContextOmitted?: number;
  /** Source-only entry references; neither authored invocation nor runtime activation. */
  readonly sourceActivationCandidates: readonly {
    readonly sourceFlowId: string;
    readonly entryRegionId: string;
    readonly entryKind: GameplaySourceFlowCandidate["entryKind"];
    readonly evidenceBasis: "EXACT_SOURCE_ENTRY_REFERENCE" | "TRACE_CONTEXT_ONLY";
    readonly supportingEvidenceIds: readonly string[];
    readonly materialSourceStepIds: readonly string[];
    readonly unresolvedExecutionEdgeIds: readonly string[];
    readonly branchPointCount: number;
    readonly runtimeStatus: "NOT_OBSERVED";
  }[];
  /** Original direction and kinds are preserved; no inferred execution order. */
  readonly relations: readonly {
    readonly id: string;
    readonly from: string;
    readonly to: string;
    readonly kind: import("../../../gameplay-intent/src/index.js").GameplayIntentEdgeKind;
    readonly evidenceIds: readonly string[];
    readonly status: "AUTHORED_RELATION" | "INFERRED_RELATION";
  }[];
  readonly unresolvedDimensions: readonly (
    "NO_EXACT_IR_LINK" | "NO_ACTIVATION_RELATION" |
    "NO_STATE_OR_EFFECT_RELATION" | "NO_OUTCOME_RELATION"
  )[];
  readonly runtimeStatus: "NOT_OBSERVED";
}

/**
 * Context for ONE existing directed Intent path. This is an interpretation
 * of authored source relations, not proof of chronological player activity.
 * Technical resource/state bridges are retained rather than silently dropped.
 */
export interface GameplayJourneyInterpretation {
  readonly basis: "DIRECTED_SELECTED_SOURCE_RELATIONS_NOT_PLAYER_SEQUENCE";
  readonly scope: "MODE_ARENA_AND_ROLE_UNRESOLVED";
  readonly steps: readonly {
    readonly subjectId: string;
    readonly label: string;
    readonly kind: GameplayIntentNodeKind;
    readonly meaningBasis:
      | "EMBEDDED_DESIGN_TEXT"
      | "PLAYER_FACING_SOURCE_CUE"
      | "TECHNICAL_SOURCE_ONLY";
    readonly intentStatus: "authored" | "inferred";
    readonly sourceEvidenceIds: readonly string[];
    readonly omittedSourceEvidenceCount: number;
    readonly exactSourceFlowIds: readonly string[];
  }[];
  readonly relationships: readonly {
    readonly relationId: string;
    readonly kind: import("../../../gameplay-intent/src/index.js").GameplayIntentEdgeKind;
    readonly sourceStatus: "authored" | "inferred";
    readonly semanticRole:
      | "STATE_TRANSITION_CANDIDATE"
      | "RESOURCE_OR_EFFECT_DEPENDENCY"
      | "OUTCOME_RELATION"
      | "RESET_OR_RECOVERY_CANDIDATE";
    readonly sourceEvidenceIds: readonly string[];
  }[];
  /**
   * One abandoned cross-source join at the segment end. Source adjacency
   * without a shared exact IR flow is not a player transition/dataflow.
   */
  readonly sourceJoinGap?: {
    readonly viaSubjectId: string;
    readonly previousRelationId: string;
    readonly nextRelationId: string;
    readonly previousSourceLocators: readonly string[];
    readonly nextSourceLocators: readonly string[];
    readonly missingProof:
      | "SHARED_EXACT_SOURCE_FLOW_OR_SAME_SOURCE_WITNESS"
      | "OPPOSITE_AUTHORED_BRANCH_ARMS";
  };
  readonly sourceOutcome:
    | "WIN_RELATION_CANDIDATE"
    | "LOSE_RELATION_CANDIDATE"
    | "OUTCOME_NODE_WITHOUT_TERMINAL_RULE"
    | "NOT_ESTABLISHED";
  readonly missingUnderstanding: readonly (
    | "PLAYER_ENTRY_NOT_PROVEN"
    | "PLAYER_GOAL_NOT_INDEPENDENTLY_GROUNDED"
    | "OUTCOME_RULE_UNRESOLVED"
    | "EXACT_SOURCE_EFFECT_PATH_MISSING"
    | "CROSS_SOURCE_JOIN_UNPROVEN"
    | "SOURCE_RELATION_DIRECTION_NOT_PLAY_ORDER"
    | "MODE_ARENA_ROLE_SCOPE_UNRESOLVED"
    | "RUNTIME_NOT_OBSERVED"
  )[];
}

/**
 * Bounded directed authored/inferred relation chain; never a proven journey.
 */
export interface GameplayJourneyCandidate {
  readonly id: string;
  readonly subjectIds: readonly string[];
  readonly relationIds: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly exactSourceFlowIds: readonly string[];
  readonly meaningStatus: "SOURCE_AUTHORED" | "SOURCE_INFERRED";
  /** Optional for older readers/fixtures; canonical production emits it. */
  readonly interpretation?: GameplayJourneyInterpretation;
  readonly boundary: "OUTCOME_SUBJECT" | "SOURCE_SINK" | "CYCLE" |
    "DEPTH_LIMIT" | "SOURCE_JOIN_UNPROVEN";
  readonly runtimeStatus: "NOT_OBSERVED";
}

export interface GameplayScenarioGraph {
  readonly schemaVersion: 1;
  readonly policy: "scenario-driven-causal-audit";
  readonly scenarios: readonly GameplayScenario[];
  readonly components: readonly GameplayScenarioComponent[];
  readonly causalLinks: readonly GameplayCausalLink[];
  readonly knowledgeRequirements: readonly GameplayKnowledgeRequirement[];
  readonly knowledgeReceipts: readonly GameplayKnowledgeReceipt[];
  readonly requiredInspectionGraph: GameplayRequiredInspectionGraph;
  /**
   * Non-playing observed source flows; deliberately not GameplayScenario
   * entries, scenario closure evidence, or authored player journey.
   */
  readonly sourceFlowCandidates?: readonly GameplaySourceFlowCandidate[];
  /** One read-only projection of current Gameplay Intent's reviewed typed
   * source sites. Not causal links, mechanics, design, or execution proof.
   */
  readonly reviewedSourceRelationships?: readonly (
    NonNullable<GameplayIntentModel["unknowns"][number]["sourceRelations"]>[number] & {
      readonly unknownId: string;
      readonly sourceEntryRegionId: string;
    }
  )[];
  /** Evidence-first classified features, without manufacturing mechanic names. */
  readonly mechanicReconstructions?: readonly GameplayMechanicReconstruction[];
  /** Directed Intent relations, not an inferred chronological game session. */
  readonly gameplayJourneyCandidates?: readonly GameplayJourneyCandidate[];
  readonly gameplayJourneyTruncated?: boolean;
  readonly guardedSourceTransitions?: readonly SourceGuardedStateTransitionCandidate[];
}

/** One graph identity check, shared by Discovery, Scenario Closure and PROVE.
 * These are only ownership ambiguities, not gameplay or runtime findings.
 * A component can legitimately participate in several scenarios, but may
 * have only one definition for its ID within one selected-map graph.
 */
export function ambiguousGameplayGraphIds(
  graph: Pick<GameplayScenarioGraph, "scenarios" | "components" | "causalLinks">,
): {
  readonly scenarioIds: readonly string[];
  readonly componentIds: readonly string[];
  readonly causalLinkIds: readonly string[];
} {
  const duplicates = (rows: readonly { readonly id: string }[]): readonly string[] => {
    const counts = new Map<string, number>();
    for (const row of rows) counts.set(row.id, (counts.get(row.id) ?? 0) + 1);
    return [...counts].filter(([, count]) => count > 1)
      .map(([id]) => id).sort();
  };
  return {
    scenarioIds: duplicates(graph.scenarios),
    componentIds: duplicates(graph.components),
    causalLinkIds: duplicates(graph.causalLinks),
  };
}

/**
 * The single source-scoped owner check for a causal link. A duplicate graph
 * component makes ONLY its own scenario/link scope ambiguous, not independent
 * causal scopes in other mechanics. These identities are selected-source
 * navigation and proof prerequisites, never Minecraft runtime observations.
 *
 * Pass a precomputed graph ambiguity receipt when resolving many links in
 * one gate evaluation; it must come from this same immutable graph.
 */
export function uniqueGameplayCausalLinkScope(
  graph: GameplayScenarioGraph,
  causalLinkId: string,
  ambiguous: ReturnType<typeof ambiguousGameplayGraphIds> =
    ambiguousGameplayGraphIds(graph),
): {
  readonly link: GameplayCausalLink;
  readonly scenario: GameplayScenario;
} | undefined {
  if (ambiguous.causalLinkIds.includes(causalLinkId)) return undefined;
  const links = graph.causalLinks.filter(link => link.id === causalLinkId);
  if (links.length !== 1) return undefined;
  const link = links[0]!;
  if (ambiguous.scenarioIds.includes(link.scenarioId)) return undefined;
  const scenarios = graph.scenarios.filter(item => item.id === link.scenarioId);
  if (scenarios.length !== 1) return undefined;
  const scenario = scenarios[0]!;
  // A causal link is not owned merely because its scenario ID exists.
  // The scenario must explicitly bind this exact link and every component
  // asserted by the link. Scenario Closure already classifies detached links
  // as invalid, but independently visible findings need the same local guard.
  if (!scenario.causalLinkIds.includes(link.id) ||
      link.componentIds.some(id => !scenario.componentIds.includes(id))) {
    return undefined;
  }
  const ambiguousComponents = new Set(ambiguous.componentIds);
  const scopeIds = [
    ...scenario.componentIds,
    ...link.componentIds,
    link.fromComponentId,
    link.toComponentId,
    ...link.impactPathComponentIds,
  ];
  if (scopeIds.some(id => ambiguousComponents.has(id))) return undefined;
  return { link, scenario };
}

export type GameplayScenarioClosureStatus =
  | "CLOSED"
  | "PARTIAL"
  | "OPEN";

export interface GameplayRuntimeProofRequest {
  readonly causalLinkId: string;
  readonly scenarioId: string;
  readonly runtimeReason: string;
  readonly narrowRuntimeQuestion: string;
  readonly evidenceIds: readonly string[];
}

export interface GameplayDetectionGapTestRequest {
  readonly causalLinkId: string;
  readonly scenarioId: string;
  readonly gapReason: string;
  readonly narrowTestQuestion: string;
  readonly evidenceIds: readonly string[];
}

export interface GameplayScenarioClosure {
  readonly status: GameplayScenarioClosureStatus;
  readonly orphanComponentIds: readonly string[];
  readonly missingPurposeComponentIds: readonly string[];
  readonly unresolvedCausalLinkIds: readonly string[];
  readonly runtimeBlockedCausalLinkIds: readonly string[];
  readonly runtimeProofRequests: readonly GameplayRuntimeProofRequest[];
  readonly detectionGapCausalLinkIds: readonly string[];
  readonly detectionGapTestRequests: readonly GameplayDetectionGapTestRequest[];
  readonly missingRequiredKnowledgeIds: readonly string[];
  readonly capabilityGapKnowledgeIds: readonly string[];
  readonly prerequisiteBlockedKnowledgeIds: readonly string[];
  readonly incompleteCompositionScenarioIds: readonly string[];
  /**
   * Leaf scenarios with selected-artifact components but no causal proof edge.
   * These are treated as suspiciously shallow audit coverage.
   */
  readonly unprovenLeafScenarioIds: readonly string[];
  readonly reasons: readonly string[];
}

/**
 * Read-only navigation over the existing scenario graph.
 * No inferred rooms, systems, mechanics, or gameplay claims are created here.
 * IDs point back to their canonical component/causal-link records.
 */
export interface GameplayArchitectureNavigation {
  readonly schemaVersion: 1;
  readonly policy: "derived-gameplay-architecture-navigation";
  readonly stages: readonly {
    readonly name: string;
    readonly scenarioIds: readonly string[];
    readonly componentIds: readonly string[];
    readonly causalLinkIds: readonly string[];
  }[];
  /** Every scenario remains visible within the same map-wide navigation. */
  readonly scenarios: readonly {
    readonly id: string;
    readonly label: string;
    readonly gameplayStage: string;
    readonly purpose: string;
    readonly componentIds: readonly string[];
    readonly causalLinkIds: readonly string[];
    readonly sourceSubjectIds: readonly string[];
  }[];
  readonly components: readonly {
    readonly id: string;
    readonly label: string;
    readonly technicalRole: string;
    readonly gameplayPurpose: string;
    readonly scenarioIds: readonly string[];
    readonly evidenceIds: readonly string[];
  }[];
  readonly causalLinks: readonly {
    readonly id: string;
    readonly fromComponentId: string;
    readonly toComponentId: string;
    readonly purpose: string;
    readonly status: GameplayCausalLinkStatus;
    readonly evidenceIds: readonly string[];
  }[];
  /**
   * Game-centric, read-only navigation over existing scenario and IR owners.
   * Features are observed gameplay subjects (mechanic/objective/phase/
   * lifecycle/outcome), not invented rules or automatically proven behavior.
   */
  readonly gameplayStructure: {
    readonly scope: "OBSERVED_COMPONENTS_ONLY";
    readonly gameSubjectIds: readonly string[];
    /**
     * Exact source effects traced backward through resolved IR call topology.
     * Membership in a candidate path is not evidence of execution or design.
     */
    readonly effectSlices: readonly (SourceEffectSlice & {
      readonly exactComponentIds: readonly string[];
      readonly exactFeatureIds: readonly string[];
      readonly pathAssociatedFeatureIds: readonly string[];
    })[];
    readonly effectIdsWithoutComponentOwner: readonly string[];
    /** Source-to-effect traces compiled upstream in the scenario owner. */
    readonly mechanicReconstructions: readonly GameplayMechanicReconstruction[];
    readonly gameplayJourneyCandidates: readonly GameplayJourneyCandidate[];
    readonly gameplayJourneyTruncated: boolean;
    /** State read literal guard -> write literal; NEVER a verified stage change. */
    readonly guardedSourceTransitions: readonly SourceGuardedStateTransitionCandidate[];
    readonly sourceFlowCandidates: readonly (GameplaySourceFlowCandidate & {
      readonly exactFeatureIds: readonly string[];
      readonly candidateScenarioContextIds: readonly string[];
      readonly uninterpretedEvidenceIds: readonly string[];
      /** Material effects lacking exact classified feature ownership. */
      readonly unclassifiedMaterialStepIds: readonly string[];
    })[];
    /** Source-authored cross-file behavior references, not executable proof. */
    readonly authoredBehaviorRelationships: NonNullable<
      SemanticIr["execution"]["authoredBehaviorRelations"]
    >;
    /**
     * IR-backed behaviors lacking a grounded mechanic/flow owner. Grouped
     * by the existing Gameplay Intent unknown and exact source entry.
     * These are unclassified source candidates, NOT gameplay scenario
     * seeds, causal proof, or invented player objectives.
     */
    readonly uninterpretedSourceFlows: readonly {
      readonly unknownId: string;
      readonly entryRegionId: string;
      readonly materialEvidenceIds: readonly string[];
      readonly effectPaths: readonly {
        readonly effectId: string;
        readonly effectKind: SourceEffectSlice["effectKind"];
        readonly worldEffectKind: SourceEffectSlice["worldEffectKind"] | null;
        readonly targetLabel: string | null;
        readonly evidenceStatus: SourceEffectSlice["status"];
        readonly effectGuards: SourceEffectSlice["effectGuards"];
        readonly candidateOutcomeIds: readonly string[];
        readonly guardStateReadIds: readonly string[];
        readonly sourceLocalStateValueHandoffs: SourceEffectSlice["sourceLocalStateValueHandoffs"];
        /** Only call paths rooted at THIS unknown's exact IR entry. */
        readonly matchingIngress: readonly {
          readonly executionEdgeIds: readonly string[];
          readonly pathGuards: SourceEffectSlice["candidateIngress"][number]["pathGuards"];
          readonly temporalBoundaryEvidence:
            SourceEffectSlice["candidateIngress"][number]["temporalBoundaryEvidence"];
          readonly candidateCallerStateWriteIds: readonly string[];
        }[];
        /** Context only, never proof these features own this effect. */
        readonly candidateFeatureContextIds: readonly string[];
      }[];
      /** Material IR records with no corresponding source effect slice. */
      readonly materialIdsWithoutEffectSlice: readonly string[];
    }[];
    /** Canonical graph identities for resolving every referenced endpoint. */
    readonly subjects: readonly {
      readonly id: string;
      readonly kind: GameplayScenarioComponent["kind"];
      readonly label: string;
      readonly purpose: string;
      readonly evidenceIds: readonly string[];
    }[];
    /** Actual scenario identities, including presets explicitly labeled as such. */
    readonly scenarios: readonly {
      readonly id: string;
      readonly label: string;
      readonly gameplayStage: string;
      readonly purpose: string;
      readonly componentIds: readonly string[];
    }[];
    readonly systems: readonly {
      readonly id: string;
      readonly label: string;
      readonly evidenceIds: readonly string[];
      readonly scenarioIds: readonly string[];
      /** Only exact PROVEN causal links admit a feature-system association. */
      readonly provenFeatureIds: readonly string[];
      /** Scenario co-placement is navigation only, not system ownership. */
      readonly coPlacedFeatureIds: readonly string[];
    }[];
    readonly features: readonly {
      readonly id: string;
      readonly kind: "mechanic" | "objective" | "phase" | "lifecycle" | "outcome";
      readonly label: string;
      readonly purpose: string;
      readonly sourceEvidenceIds: readonly string[];
      readonly grounding: "SOURCE_EVIDENCED" | "UNVERIFIED";
      readonly scenarioIds: readonly string[];
      /**
       * Per-effect candidate behavioral paths, built from the same IR
       * slices already exposed above. They are NOT a proven player journey.
       * DIRECT_EFFECT_EVIDENCE and CALL_PATH_CONTEXT remain distinct.
       */
      readonly sourceBehaviorPaths: readonly {
        readonly effectId: string;
        readonly association: "DIRECT_EFFECT_EVIDENCE" | "CALL_PATH_CONTEXT";
        readonly evidenceStatus: SourceEffectSlice["status"];
        readonly entryRegionId: string | null;
        readonly executionEdgeIds: readonly string[];
        readonly temporalBoundaryEvidence:
          SourceEffectSlice["candidateIngress"][number]["temporalBoundaryEvidence"];
        readonly preconditions: readonly SourceEffectSlice["effectGuards"][number][];
        readonly precedingStateReadIds: readonly string[];
        /** Source-local possible writes for exact state reads in effect guards. */
        readonly candidateGuardStateWriteIds: readonly string[];
        /** Source-ordered writes in an upstream caller of THIS ingress. */
        readonly candidateCallerStateWriteIds: readonly string[];
        /** Source-authored scalar values associated with exact guard reads. */
        readonly sourceLocalStateValueHandoffs: SourceEffectSlice["sourceLocalStateValueHandoffs"];
        readonly guardedStateTransitionCandidates: SourceEffectSlice["guardedStateTransitionCandidates"];
        readonly candidateCallerStateValueHandoffs: readonly SourceStateValueHandoff[];
        readonly authoredStateValue: SourceEffectSlice["authoredStateValue"] | null;
        readonly effectKind: SourceEffectSlice["effectKind"];
        readonly worldEffectKind: SourceEffectSlice["worldEffectKind"] | null;
        readonly effectTarget: string | null;
        readonly candidateOutcomeIds: readonly string[];
        /** Observed acquire/release site, NOT completed cleanup. */
        readonly resourceAction: SourceEffectSlice["resourceAction"] | null;
        /** Same-region exact-key lifecycle candidate, not proven reset. */
        readonly sourceResourceLifetime: SourceEffectSlice["sourceResourceLifetime"] | null;
      }[];
      /** Relations originate in the scenario graph; status is unchanged. */
      readonly relationships: readonly {
        readonly id: string;
        readonly relationKind: import("../../../gameplay-intent/src/index.js").GameplayIntentEdgeKind | null;
        readonly fromComponentId: string;
        readonly toComponentId: string;
        readonly status: GameplayCausalLinkStatus;
        readonly sourceEvidenceIds: readonly string[];
      }[];
      readonly activationRelationIds: readonly string[];
      readonly effectRelationIds: readonly string[];
      readonly transitionRelationIds: readonly string[];
      readonly outcomeRelationIds: readonly string[];
      /** Technical traces mapped through exact evidence, not inferred purpose. */
      readonly observedFlowEntries: readonly {
        readonly entryRegionId: string;
        readonly modelingStatus: "UNMODELED" | "PARTIALLY_MODELED" | "PLACED_UNPROVEN";
        /** Resolve exact missing evidence from observedFlowEvidence by entryRegionId. */
      }[];
    }[];
    readonly unplacedFeatureIds: readonly string[];
    readonly unassignedSemanticIrEvidenceIds: readonly string[];
    /** One source-trace evidence record per observed entry region, referenced
     * by features[].observedFlowEntries[].entryRegionId. This is source
     * coverage, NOT observed runtime behavior or a completed game path.
     */
    readonly observedFlowEvidence: readonly {
      readonly entryRegionId: string;
      readonly modelingStatus: "UNMODELED" | "PARTIALLY_MODELED" | "PLACED_UNPROVEN";
      readonly unmodeledEvidenceIds: readonly string[];
    }[];
  };
  readonly unplacedComponentIds: readonly string[];
  readonly unresolvedCausalLinkIds: readonly string[];
  readonly missingGraphReferenceIds: readonly string[];
  /**
   * Non-authoritative summary of gaps in records already observed by the
   * engine. The details remain in their original coverage inventories.
   * NO_GAPS_IN_MEASURED_SCOPE never means that the whole map is understood.
   */
  readonly architectureReconciliation: {
    readonly scope: "OBSERVED_RECORDS_ONLY";
    readonly status: "GAPS_PRESENT" | "NO_GAPS_IN_MEASURED_SCOPE";
    readonly sourceIndexIncomplete: boolean;
    readonly gameplayIntentEvidenceUnlinkedCount: number;
    readonly semanticIrRecordsUnlinkedCount: number;
    /** Source-observed flow traces without any mapped gameplay component. */
    readonly behaviorFlowsUnmodeledCount: number;
    /** Source-observed flow traces with missing records or no common scenario. */
    readonly behaviorFlowsPartiallyModeledCount: number;
    /** Co-placed observed flows, still lacking whole-game causal proof. */
    readonly behaviorFlowsPlacedUnprovenCount: number;
    readonly scenarioComponentsUnplacedCount: number;
    readonly causalLinksUnresolvedCount: number;
    readonly graphReferencesMissingCount: number;
    readonly arenaMappingUnresolved: boolean;
    readonly observedSystemsUnreconciledCount: number;
    /** Authored returns outside all source-observed execution entry traces. */
    readonly observedOutcomesWithoutEntryCount: number;
    /** Exact technical relationships observed, not a full-game denominator. */
    readonly observedSourceRelationshipCount: number;
    /** Observed relationships still lacking precise scenario causal proof. */
    readonly sourceRelationshipsWithoutProofCount: number;
  };
  /**
   * Tracks source-scoped Gameplay Intent evidence against existing
   * architecture components/links. Unlinked is not a bug or proof of absence.
   */
  readonly evidenceCoverage: {
    readonly selectedArtifactEvidenceCount: number;
    readonly architectureLinkedEvidenceIds: readonly string[];
    readonly architectureUnlinkedEvidenceIds: readonly string[];
    readonly architectureEvidenceWithoutIntentRecordIds: readonly string[];
    readonly selectedArtifactEvidenceLinkPercent: number | null;
  };
  /**
   * Exact-ID reconciliation of raw Semantic IR records against the existing
   * gameplay architecture. Counts cover parsed IR only, not the whole map.
   * No inferred links from owner names, locations, or surface similarities.
   */
  readonly semanticIrCoverage: {
    /** Source evidence only. A matching write and return do not prove a state transition. */
    readonly stateOutcomeCandidates: readonly (SourceStateOutcomeCandidate & {
      readonly outcomeComponentIds: readonly string[];
      readonly precedingWriteComponentIds: readonly string[];
      /** Same existing scenario membership, not proof of execution or causality. */
      readonly sharedScenarioPlacementIds: readonly string[];
    })[];
    /** Source-only resource action/return association; no cleanup or terminal proof. */
    readonly resourceOutcomeCandidates: readonly (SourceResourceOutcomeCandidate & {
      readonly outcomeComponentIds: readonly string[];
      readonly precedingResourceComponentIds: readonly string[];
      /** Shared existing scenario placement is not proof of causal execution. */
      readonly sharedScenarioPlacementIds: readonly string[];
    })[];
    /**
     * Exact-ID, read-only accounting of *observed* source relationships.
     * A candidate reachability/order relationship is not gameplay causality.
     * Missing model links are coverage gaps, not confirmed game defects.
     */
    /** A return without an observed entry path may be dead/unreachable or under-discovered. */
    readonly untracedReturnOutcomeIds: readonly string[];
    readonly observedSourceRelationships: readonly {
      readonly kind: "entry-to-outcome" | "direct-call-to-outcome" |
        "state-write-to-outcome" | "resource-action-to-outcome" |
        "world-effect-to-outcome";
      readonly fromEvidenceId: string;
      readonly outcomeId: string;
      readonly sourceBasis: "TRACE_REACHABILITY" | "DIRECT_CALL_TARGET" |
        "SOURCE_ORDER_CANDIDATE" | "SOURCE_ORDER_UNRESOLVED";
      /** Co-placement only: same scenario does NOT prove a causal relation. */
      readonly sharedScenarioIds: readonly string[];
      /** Only existing PROVEN graph links explicitly carrying *both* exact IDs. */
      readonly exactProvenCausalLinkIds: readonly string[];
      readonly gap: "SOURCE_RELATION_UNRESOLVED" |
        "NOT_IN_COMMON_SCENARIO" | "CAUSAL_PROOF_MISSING" | null;
    }[];
    /** Read-only technical chains; do not interpret as complete gameplay flow. */
    readonly executionTraces: readonly (Omit<ObservedExecutionTrace, "branchPoints"> & {
      readonly evidenceMatchedComponentIds: readonly string[];
      /** Exact technical records in this observed flow without any gameplay component owner. */
      readonly evidenceWithoutComponentIds: readonly string[];
      /** A single scenario contains all mapped components; co-placement is NOT causal proof. */
      readonly sharedScenarioPlacementIds: readonly string[];
      /** A gap may be semantic, structural, or causal; never infer execution from source. */
      readonly modelingStatus: "UNMODELED" | "PARTIALLY_MODELED" | "PLACED_UNPROVEN";
      readonly branchPoints: readonly (Omit<ObservedBranchPoint, "branches"> & {
        /** Exact evidence association only; not a proven gameplay branch. */
        readonly branches: readonly (ObservedBranchPoint["branches"][number] & {
          readonly evidenceMatchedComponentIds: readonly string[];
          /** Existing scenario membership, not player-journey proof. */
          readonly scenarioPlacementIds: readonly string[];
          readonly evidenceWithoutComponentIds: readonly string[];
        })[];
      })[];
    })[];
    /** Includes isolated callbacks/functions; absence from a trace is not absence from the game. */
    readonly regionsOutsideTraces: readonly string[];
    readonly returnOutcomes: {
      readonly observedCount: number;
      readonly linkedIds: readonly string[];
      readonly unlinkedIds: readonly string[];
    };
    readonly resourceActions: {
      readonly observedCount: number;
      readonly linkedIds: readonly string[];
      readonly unlinkedIds: readonly string[];
    };
    readonly stateOperations: {
      readonly observedCount: number;
      readonly linkedIds: readonly string[];
      readonly unlinkedIds: readonly string[];
    };
    readonly executionRegions: {
      readonly observedCount: number;
      readonly linkedIds: readonly string[];
      readonly unlinkedIds: readonly string[];
    };
    readonly executionEdges: {
      readonly observedCount: number;
      readonly linkedIds: readonly string[];
      readonly unlinkedIds: readonly string[];
    };
    readonly worldEffects: {
      readonly observedCount: number;
      readonly linkedIds: readonly string[];
      readonly unlinkedIds: readonly string[];
    };
    readonly temporalRelations: {
      readonly observedCount: number;
      readonly linkedIds: readonly string[];
      readonly unlinkedIds: readonly string[];
    };
  };
  /**
   * Source-grounded system evidence, not a catalog of assumed map features.
   * A count of zero never proves a feature is absent from the full map.
   */
  readonly systemInventory: readonly {
    readonly system: "ENTITY" | "COMBAT" | "INVENTORY" | "ECONOMY" | "PROGRESSION";
    readonly observedCount: number;
    /** Analyzer observations can be source names or reward kinds, not evidence IDs. */
    readonly observationReferences: readonly string[];
    readonly evidenceIds: readonly string[];
    readonly inventoryStatus: "OBSERVED" | "NOT_OBSERVED";
    readonly evidenceLinkedComponentIds: readonly string[];
    readonly unmatchedEvidenceIds: readonly string[];
    readonly architectureMapping: "EVIDENCE_LINKED" | "NOT_YET_RECONCILED";
  }[];
  /**
   * Measured coverage of observed evidence, never a claim about all gameplay.
   * Full-map understanding has no defensible denominator while unidentified
   * source semantics, world content, or design intent can remain unknown.
   */
  readonly knowledgeCoverage: {
    readonly observedSourceIndexPercent: number | null;
    readonly observedComponentPlacementPercent: number | null;
    readonly wholeGameUnderstandingPercent: null;
    readonly wholeGameUnderstandingStatus: "NOT_MEASURABLE";
    readonly observedRelevantSourceCount: number;
    readonly observedIndexedSourceCount: number;
    readonly observedComponentCount: number;
    readonly observedPlacedComponentCount: number;
    readonly arenaEvidence: {
      readonly detected: boolean;
      /** Number of physical arenas inferred from the selected world. */
      readonly count: number | null;
      readonly countBasis: "topology" | "script-config" | "reconciled" | null;
      readonly layoutStatus: string | null;
      /** Only arena identities available from existing replica proof receipts. */
      /** Spatial layout is the source of arena identities and coordinates, not replica proof. */
      readonly spatialLayoutEntries: readonly {
        readonly arenaId: string;
        readonly role: "canonical" | "replica";
        readonly anchor: { readonly x: number; readonly y: number; readonly z: number };
      }[];
      readonly spatialLayoutConfidence: "low" | "medium" | "high" | null;
      /** Inferred candidate regions; neither containment nor ownership proof. */
      readonly arenaRegionCandidates: readonly {
        readonly arenaId: string;
        readonly volumes: readonly ArenaRegionPlan["volumes"][number][];
        readonly confidence: "low" | "medium" | "high";
      }[];
      readonly spatialArenaIdsWithoutRegionCandidates: readonly string[];
      readonly arenasWithoutSpatialLayoutCount: number | null;
      readonly spatialArenaIdsWithoutReplicaProof: readonly string[];
      /**
       * Exact evidence identity bridge only. Replica proof does not by itself
       * establish per-arena gameplay ownership or spatial containment.
       */
      readonly arenaEvidenceComponentLinks: readonly {
        readonly arenaId: string;
        readonly componentIds: readonly string[];
        readonly matchedEvidenceIds: readonly string[];
      }[];
      readonly spatialArenaIdsWithoutComponentLinks: readonly string[];
      readonly duplicateReplicaProofArenaIds: readonly string[];
      readonly replicaProofEntries: readonly {
        readonly arenaId: string;
        readonly evidenceIds: readonly string[];
        readonly proofStatus: string;
      }[];
      /** Source-observed per-arena population proof; no inferred instances. */
      readonly entityPopulationProofEntries: readonly {
        readonly arenaId: string;
        readonly status: string;
        readonly canonicalSpawns: number;
        readonly replicaSpawns: number;
        readonly unresolvedSpawns: number;
        readonly mismatchCount: number;
      }[];
      readonly actorPopulationProofEntries: readonly {
        readonly arenaId: string;
        readonly status: string;
        readonly canonicalActors: number;
        readonly replicaActors: number;
        readonly mismatchCount: number;
      }[];
      /** Population proof arena IDs not present in the replica-proof inventory. */
      readonly populationArenaIdsWithoutReplicaProof: readonly string[];
      /** Numeric coverage gap, not proof of absent arena instances. */
      readonly arenasWithoutReplicaProofCount: number | null;
      /** Configured limit, not a verified runtime capacity. */
      readonly declaredConcurrentArenaLimit: number | null;
      /** Requested coverage, not an approved game-design requirement. */
      readonly requestedConcurrentArenas: number | null;
      /** Analysis estimate; never treat as actual runtime outcome. */
      readonly safeConcurrentArenas: number | null;
      readonly perArenaPlayerCapacity: number | null;
      readonly architectureMapping: "NOT_YET_RECONCILED";
      /** These observations are arena-related, but not bound to specific arena IDs. */
      readonly stateIsolationObservations: readonly {
        readonly scriptId: string;
        readonly region: string;
        readonly key: string;
        readonly status: "isolated" | "partition-proof-required" | "shared-global" | "unknown";
      /** Source-only: none of these scopes proves a live player/arena ID. */
      readonly scope?: "arena-local" | "player-local" | "entity-local" |
        "world-global" | "module-shared" | "unknown";
      readonly surface?: "dynamic-property" | "scoreboard" |
        "world-property" | "world-command" | "world-player-enumeration" |
        "entity-tag" | "module-state";
      readonly reason?: string;
      readonly sourcePath?: string | null;
      /** Exact operation site; do not infer coordinates from script names. */
      readonly sourceLocator?: string | null;
      }[];
      readonly chunkLeases: readonly {
        readonly scriptId: string;
        readonly leaseKey: string | null;
        readonly acquireRegions: readonly string[];
        readonly releaseRegions: readonly string[];
        readonly status: string;
      }[];
      readonly cleanupAssessments: readonly {
        readonly scriptId: string;
        readonly tableName: string;
        readonly status: "complete" | "unresolved";
        readonly missingPhases: readonly string[];
        readonly orderingViolations: readonly string[];
      }[];
      readonly arenaSessionMapping: "NOT_YET_ESTABLISHED";
      /** Known spatial arena identities without proven arena-to-session binding. */
      readonly spatialArenaIdsWithoutSessionOwnershipProof: readonly string[];
    };
  };
}

/**
 * Reconcile only *observed source-evidence pairs* against existing scenario
 * composition. A link's PROVEN status is accepted here only as the graph's
 * existing claim; this projection does not grant authored intent, causal
 * status, runtime completion, or whole-game coverage.
 *
 * Shared by Architecture Navigation and Discovery Challenger so their exact
 * pair admission cannot drift into competing proof definitions.
 */
export function deriveObservedGameplaySourceRelationships(
  graph: GameplayScenarioGraph,
  observed: {
    readonly executionTraces: readonly ObservedExecutionTrace[];
    readonly stateOutcomeEvidence: readonly SourceStateOutcomeCandidate[];
    readonly resourceOutcomeEvidence: readonly SourceResourceOutcomeCandidate[];
    readonly worldEffectOutcomeEvidence?: readonly SourceWorldEffectOutcomeCandidate[];
    /** Exact resolved IR call-target identity (may still never execute). */
    readonly semanticIr?: SemanticIr;
  },
): GameplayArchitectureNavigation["semanticIrCoverage"]["observedSourceRelationships"] {
  const sorted = (values: readonly string[]) => [...new Set(values)].sort();
  // Reuse existing Semantic IR/Behavior Model witnesses. The graph and its
  // proven links retain causal authority; this projection only points out
  // observed relationships that the scenario composition has not accounted for.
  type ObservedRelation = GameplayArchitectureNavigation[
    "semanticIrCoverage"]["observedSourceRelationships"][number];
  // A direct resolved call can lead to a literal returned inside its exact
  // target region, including across ESM modules. This is source topology,
  // not proof of the call being reached or the outcome being delivered.
  const positionsComplete = (ref: { range?: {
    lineStart?: number; lineEnd?: number; columnStart?: number; columnEnd?: number;
  } }): boolean =>
    ref.range?.lineStart !== undefined &&
    ref.range.lineEnd !== undefined &&
    ref.range.columnStart !== undefined &&
    ref.range.columnEnd !== undefined;
  const outcomesByRegion = new Map<string, NonNullable<SemanticIr["execution"]["outcomes"]>>();
  for (const outcome of observed.semanticIr?.execution.outcomes ?? []) {
    const bucket = outcomesByRegion.get(outcome.executionRegionId) ?? [];
    outcomesByRegion.set(outcome.executionRegionId, [...bucket, outcome]);
  }
  const targetRegions = new Map((observed.semanticIr?.execution.regions ?? [])
    .map(region => [region.id, region]));
  const sourceRelationshipCandidates: Pick<ObservedRelation,
    "kind" | "fromEvidenceId" | "outcomeId" | "sourceBasis">[] = [
    ...(observed.semanticIr?.execution.edges ?? [])
      .filter(edge => edge.kind === "synchronous-call" &&
        edge.resolution === "resolved" && edge.to !== undefined &&
        positionsComplete(edge.source))
      .flatMap(edge => (outcomesByRegion.get(edge.to!) ?? [])
        .filter(outcome => positionsComplete(outcome.source) &&
          outcome.source.artifactId === edge.source.artifactId &&
          targetRegions.get(edge.to!)?.source?.artifactId === outcome.source.artifactId &&
          targetRegions.get(edge.to!)?.source?.relativePath === outcome.source.relativePath)
        .map(outcome => ({
          kind: "direct-call-to-outcome" as const,
          fromEvidenceId: edge.id,
          outcomeId: outcome.id,
          sourceBasis: "DIRECT_CALL_TARGET" as const,
        }))),
    ...observed.executionTraces.flatMap(trace =>
      trace.returnOutcomeIds.map(outcomeId => ({
        kind: "entry-to-outcome" as const,
        fromEvidenceId: trace.entryRegionId,
        outcomeId,
        sourceBasis: "TRACE_REACHABILITY" as const,
      }))),
    ...observed.stateOutcomeEvidence.flatMap(candidate =>
      candidate.precedingWriteOperationIds.map(fromEvidenceId => ({
        kind: "state-write-to-outcome" as const,
        fromEvidenceId,
        outcomeId: candidate.outcomeId,
        sourceBasis: candidate.status === "SOURCE_ORDER_CANDIDATE"
          ? "SOURCE_ORDER_CANDIDATE" as const
          : "SOURCE_ORDER_UNRESOLVED" as const,
      }))),
    ...observed.resourceOutcomeEvidence.flatMap(candidate =>
      candidate.precedingResourceActionIds.map(fromEvidenceId => ({
        kind: "resource-action-to-outcome" as const,
        fromEvidenceId,
        outcomeId: candidate.outcomeId,
        sourceBasis: candidate.status === "SOURCE_ORDER_CANDIDATE"
          ? "SOURCE_ORDER_CANDIDATE" as const
          : "SOURCE_ORDER_UNRESOLVED" as const,
      }))),
    ...(observed.worldEffectOutcomeEvidence ?? []).flatMap(candidate =>
      candidate.precedingWorldEffectIds.map(fromEvidenceId => ({
        kind: "world-effect-to-outcome" as const,
        fromEvidenceId,
        outcomeId: candidate.outcomeId,
        sourceBasis: candidate.guardCompatibleWorldEffectIds.includes(fromEvidenceId)
          ? "SOURCE_ORDER_CANDIDATE" as const
          : "SOURCE_ORDER_UNRESOLVED" as const,
      }))),
  ];
  const ambiguousGraphIds = ambiguousGameplayGraphIds(graph);
  const ambiguousComponents = new Set(ambiguousGraphIds.componentIds);
  const ambiguousScenarios = new Set(ambiguousGraphIds.scenarioIds);
  const ambiguousLinks = new Set(ambiguousGraphIds.causalLinkIds);
  const componentIdsByEvidence = new Map<string, Set<string>>();
  for (const component of graph.components) {
    // A duplicate component ID does not establish a unique source owner.
    if (ambiguousComponents.has(component.id)) continue;
    for (const id of component.evidenceIds) {
      const ids = componentIdsByEvidence.get(id) ?? new Set<string>();
      ids.add(component.id);
      componentIdsByEvidence.set(id, ids);
    }
  }
  const scenarioLinkIds = new Map(graph.scenarios
    .filter(scenario => !ambiguousScenarios.has(scenario.id))
    .map(scenario =>
      [scenario.id, new Set(scenario.causalLinkIds)] as const));
  const observedSourceRelationships: ObservedRelation[] = sourceRelationshipCandidates
    .map(relation => {
      const fromComponents = componentIdsByEvidence.get(relation.fromEvidenceId) ??
        new Set<string>();
      const outcomeComponents = componentIdsByEvidence.get(relation.outcomeId) ??
        new Set<string>();
      const sharedScenarioIds = sorted(graph.scenarios
        .filter(scenario =>
          !ambiguousScenarios.has(scenario.id) &&
          scenario.componentIds.some(id => fromComponents.has(id)) &&
          scenario.componentIds.some(id => outcomeComponents.has(id)))
        .map(scenario => scenario.id));
      const sharedScenarios = new Set(sharedScenarioIds);
      const exactProvenCausalLinkIds = sorted(graph.causalLinks
        .filter(link =>
          link.status === "PROVEN" &&
          !ambiguousLinks.has(link.id) &&
          !ambiguousComponents.has(link.fromComponentId) &&
          !ambiguousComponents.has(link.toComponentId) &&
          sharedScenarios.has(link.scenarioId) &&
          scenarioLinkIds.get(link.scenarioId)?.has(link.id) === true &&
          fromComponents.has(link.fromComponentId) &&
          outcomeComponents.has(link.toComponentId) &&
          link.evidenceIds.includes(relation.fromEvidenceId) &&
          link.evidenceIds.includes(relation.outcomeId))
        .map(link => link.id));
      return {
        ...relation,
        sharedScenarioIds,
        exactProvenCausalLinkIds,
        gap: relation.sourceBasis === "SOURCE_ORDER_UNRESOLVED"
          ? "SOURCE_RELATION_UNRESOLVED" as const
          : sharedScenarioIds.length === 0
            ? "NOT_IN_COMMON_SCENARIO" as const
            : exactProvenCausalLinkIds.length === 0
              ? "CAUSAL_PROOF_MISSING" as const
              : null,
      };
    })
    .sort((a, b) => a.kind.localeCompare(b.kind) ||
      a.outcomeId.localeCompare(b.outcomeId) ||
      a.fromEvidenceId.localeCompare(b.fromEvidenceId));
  return observedSourceRelationships;
}

/** Navigation only: preserve gaps rather than fabricating stage or system membership. */
export function deriveGameplayArchitectureNavigation(
  graph: GameplayScenarioGraph,
  observed: {
    readonly relevantSourceCount: number;
    readonly indexedSourceCount: number;
    readonly arenaDetected: boolean;
    readonly selectedArtifactEvidenceIds?: readonly string[];
    readonly allIntentEvidenceIds?: readonly string[];
    readonly semanticIr?: SemanticIr;
    /** Same selected-artifact Gameplay Intent unknowns as the scenario owner. */
    readonly intentUnknowns?: GameplayIntentModel["unknowns"];
    readonly arenaCount?: number;
    readonly arenaCountBasis?: "topology" | "script-config" | "reconciled";
    readonly arenaLayoutStatus?: string;
    readonly spatialLayout?: {
      readonly canonical: {
        readonly arenaId: string;
        readonly anchor: { readonly x: number; readonly y: number; readonly z: number };
      };
      readonly replicas: readonly {
        readonly arenaId: string;
        readonly anchor: { readonly x: number; readonly y: number; readonly z: number };
      }[];
      readonly confidence: "low" | "medium" | "high";
      readonly offsets?: readonly { readonly x: number; readonly y: number; readonly z: number }[];
    };
    readonly regionPlan?: Pick<ArenaRegionPlan, "volumes" | "confidence">;
    readonly replicaProof?: readonly {
      readonly arenaId: string;
      readonly evidenceIds: readonly string[];
      readonly status: string;
    }[];
    readonly entityPopulationProof?: readonly {
      readonly arenaId: string;
      readonly status: string;
      readonly canonicalSpawns: number;
      readonly replicaSpawns: number;
      readonly unresolvedSpawns: number;
      readonly mismatches: readonly unknown[];
    }[];
    readonly actorPopulationProof?: readonly {
      readonly arenaId: string;
      readonly status: string;
      readonly canonicalActors: number;
      readonly replicaActors: number;
      readonly mismatchCount: number;
    }[];
    readonly declaredConcurrentArenaLimit?: number;
    readonly requestedConcurrentArenas?: number;
    readonly safeConcurrentArenas?: number | null;
    readonly perArenaPlayerCapacity?: number;
    readonly stateIsolationObservations?: readonly {
      readonly scriptId: string;
      readonly region: string;
      readonly key: string;
      readonly status: "isolated" | "partition-proof-required" | "shared-global" | "unknown";
      /** Source-only: none of these scopes proves a live player/arena ID. */
      readonly scope?: "arena-local" | "player-local" | "entity-local" |
        "world-global" | "module-shared" | "unknown";
      readonly surface?: "dynamic-property" | "scoreboard" |
        "world-property" | "world-command" | "world-player-enumeration" |
        "entity-tag" | "module-state";
      readonly reason?: string;
      readonly sourcePath?: string | null;
      /** Exact operation site; do not infer coordinates from script names. */
      readonly sourceLocator?: string | null;
    }[];
    readonly chunkLeases?: readonly {
      readonly scriptId: string;
      readonly leaseKey?: string;
      readonly acquireRegions: readonly string[];
      readonly releaseRegions: readonly string[];
      readonly status: string;
    }[];
    readonly cleanupAssessments?: readonly {
      readonly scriptId: string;
      readonly tableName: string;
      readonly status: "complete" | "unresolved";
      readonly missingPhases: readonly string[];
      readonly orderingViolations: readonly string[];
    }[];
    readonly systemObservations?: readonly {
      readonly system: "ENTITY" | "COMBAT" | "INVENTORY" | "ECONOMY" | "PROGRESSION";
      readonly observedCount: number;
      readonly observationReferences: readonly string[];
      /** Only canonical evidence IDs positively supplied by the evidence owner. */
      readonly evidenceIds?: readonly string[];
    }[];
  } = {
    relevantSourceCount: 0,
    indexedSourceCount: 0,
    arenaDetected: false,
  },
): GameplayArchitectureNavigation {
  const sorted = (values: readonly string[]) =>
    [...new Set(values)].sort();
  const componentById = new Map(
    graph.components.map((component) => [component.id, component]),
  );
  const linksById = new Map(
    graph.causalLinks.map((link) => [link.id, link]),
  );
  const stageGroups = new Map<
    string,
    { scenarioIds: string[]; componentIds: string[]; causalLinkIds: string[] }
  >();

  for (const scenario of graph.scenarios) {
    const group = stageGroups.get(scenario.gameplayStage) ?? {
      scenarioIds: [], componentIds: [], causalLinkIds: [],
    };
    group.scenarioIds.push(scenario.id);
    group.componentIds.push(...scenario.componentIds);
    group.causalLinkIds.push(...scenario.causalLinkIds);
    stageGroups.set(scenario.gameplayStage, group);
  }

  const missing = new Set<string>();
  for (const scenario of graph.scenarios) {
    for (const id of scenario.componentIds) {
      if (!componentById.has(id)) missing.add(id);
    }
    for (const id of scenario.causalLinkIds) {
      if (!linksById.has(id)) missing.add(id);
    }
  }
  for (const link of graph.causalLinks) {
    if (!componentById.has(link.fromComponentId))
      missing.add(link.fromComponentId);
    if (!componentById.has(link.toComponentId))
      missing.add(link.toComponentId);
  }

  const placed = new Set(
    graph.scenarios.flatMap((scenario) => scenario.componentIds),
  );

  const percentage = (part: number, total: number): number | null =>
    Number.isSafeInteger(part) &&
    Number.isSafeInteger(total) &&
    total > 0 &&
    part >= 0 &&
    part <= total
      ? Math.round((part / total) * 10000) / 100
      : null;
  const placedCount = graph.components.filter((component) =>
    placed.has(component.id)
  ).length;
  const sourceEvidence = sorted(observed.selectedArtifactEvidenceIds ?? []);
  const intentEvidence = new Set(observed.allIntentEvidenceIds ?? []);
  const architectureEvidence = sorted([
    ...graph.components.flatMap((component) => component.evidenceIds),
    ...graph.causalLinks.flatMap((link) => link.evidenceIds),
  ]);
  const linkedEvidence = sourceEvidence.filter((id) =>
    architectureEvidence.includes(id)
  );
  const architectureEvidenceSet = new Set(architectureEvidence);
  const observedExecution = observed.semanticIr
    ? semanticIrExecutionTraces(observed.semanticIr)
    : { traces: [], regionsOutsideTraces: [] };
  const stateOutcomeEvidence = observed.semanticIr
    ? reconcileSourceStateOutcomes(observed.semanticIr)
    : [];
  const resourceOutcomeEvidence = observed.semanticIr
    ? reconcileSourceResourceOutcomes(observed.semanticIr)
    : [];
  const worldEffectOutcomeEvidence = observed.semanticIr
    ? reconcileSourceWorldEffectOutcomes(observed.semanticIr)
    : [];
  const observedSourceRelationships = deriveObservedGameplaySourceRelationships(
    graph,
    {
      executionTraces: observedExecution.traces,
      stateOutcomeEvidence,
      resourceOutcomeEvidence,
      worldEffectOutcomeEvidence,
      ...(observed.semanticIr === undefined ? {} : { semanticIr: observed.semanticIr }),
    },
  );
  const tracedOutcomes = new Set(observedExecution.traces.flatMap(trace =>
    trace.returnOutcomeIds));
  const untracedReturnOutcomeIds = sorted((observed.semanticIr?.execution.outcomes ?? [])
    .map(outcome => outcome.id)
    .filter(id => !tracedOutcomes.has(id)));
  const irAccounting = (ids: readonly string[]) => {
    const observedIds = sorted(ids);
    return {
      observedCount: observedIds.length,
      linkedIds: observedIds.filter((id) => architectureEvidenceSet.has(id)),
      unlinkedIds: observedIds.filter((id) => !architectureEvidenceSet.has(id)),
    };
  };
  // Do not overwrite conflicting receipts sharing the same arena ID.
  // Preserve every receipt and expose the identity conflict for reconciliation.
  const arenaInstances = [...(observed.replicaProof ?? [])]
    .sort((a, b) => a.arenaId.localeCompare(b.arenaId));
  const arenaIdCounts = new Map<string, number>();
  for (const instance of arenaInstances) {
    arenaIdCounts.set(instance.arenaId, (arenaIdCounts.get(instance.arenaId) ?? 0) + 1);
  }
  const duplicateReplicaProofArenaIds = [...arenaIdCounts]
    .filter(([, count]) => count > 1)
    .map(([id]) => id)
    .sort();
  const spatialEntries = observed.spatialLayout === undefined
    ? []
    : [
        {
          arenaId: observed.spatialLayout.canonical.arenaId,
          role: "canonical" as const,
          anchor: observed.spatialLayout.canonical.anchor,
        },
        ...observed.spatialLayout.replicas.map((replica) => ({
          arenaId: replica.arenaId,
          role: "replica" as const,
          anchor: replica.anchor,
        })),
      ].sort((a,b) => a.arenaId.localeCompare(b.arenaId));
  const layout = observed.spatialLayout;
  const plan = observed.regionPlan;
  const arenaRegionCandidates = layout === undefined || plan === undefined ? [] :
    [
      { arenaId: layout.canonical.arenaId, offset: { x: 0, y: 0, z: 0 } },
      ...layout.replicas.flatMap((replica, index) => {
        const offset = layout.offsets?.[index];
        return offset === undefined ? [] : [{ arenaId: replica.arenaId, offset }];
      }),
    ].map(({ arenaId, offset }) => ({
      arenaId,
      confidence: plan.confidence,
      volumes: plan.volumes.map((volume) => ({
        min: { x: volume.min.x + offset.x, y: volume.min.y + offset.y, z: volume.min.z + offset.z },
        max: { x: volume.max.x + offset.x, y: volume.max.y + offset.y, z: volume.max.z + offset.z },
        evidenceCandidateIds: sorted(volume.evidenceCandidateIds),
      })),
    })).filter((entry) => entry.volumes.length > 0)
      .sort((a, b) => a.arenaId.localeCompare(b.arenaId));
  const regionCandidateArenaIds = new Set(arenaRegionCandidates.map((entry) => entry.arenaId));
  const spatialArenaIdsWithoutRegionCandidates = sorted(
    spatialEntries.map((entry) => entry.arenaId).filter((id) => !regionCandidateArenaIds.has(id))
  );
  const spatialIds = new Set(spatialEntries.map((item) => item.arenaId));
  const spatialLayoutValid =
    spatialIds.size === spatialEntries.length;
  const arenasWithoutSpatialLayoutCount =
    observed.arenaCount === undefined ||
    !Number.isSafeInteger(observed.arenaCount) ||
    observed.arenaCount < 0 ||
    !spatialLayoutValid ||
    spatialEntries.length > observed.arenaCount
      ? null
      : observed.arenaCount - spatialEntries.length;
  const entityProof = [...(observed.entityPopulationProof ?? [])]
    .sort((a,b) => a.arenaId.localeCompare(b.arenaId));
  const actorProof = [...(observed.actorPopulationProof ?? [])]
    .sort((a,b) => a.arenaId.localeCompare(b.arenaId));
  const replicaProofIds = new Set(arenaInstances.map((entry) => entry.arenaId));
  const spatialArenaIdsWithoutReplicaProof = sorted(
    spatialEntries.map((entry) => entry.arenaId)
      .filter((id) => !replicaProofIds.has(id))
  );
  const populationArenaIdsWithoutReplicaProof = sorted([
    ...entityProof.map((entry) => entry.arenaId),
    ...actorProof.map((entry) => entry.arenaId),
  ].filter((id) => !replicaProofIds.has(id)));
  const arenaEvidenceComponentLinks = arenaInstances.map((instance) => {
    const proofEvidenceIds = new Set(instance.evidenceIds);
    const matchingComponents = graph.components.filter((component) =>
      component.evidenceIds.some((id) => proofEvidenceIds.has(id))
    );
    return {
      arenaId: instance.arenaId,
      componentIds: sorted(matchingComponents.map((component) => component.id)),
      matchedEvidenceIds: sorted(matchingComponents.flatMap((component) =>
        component.evidenceIds.filter((id) => proofEvidenceIds.has(id))
      )),
    };
  }).filter((link) => link.componentIds.length > 0);
  const arenaIdsWithComponentLinks = new Set(
    arenaEvidenceComponentLinks.map((link) => link.arenaId)
  );
  const spatialArenaIdsWithoutComponentLinks = sorted(
    spatialEntries.map((entry) => entry.arenaId)
      .filter((arenaId) => !arenaIdsWithComponentLinks.has(arenaId))
  );
  const arenasWithoutReplicaProofCount =
    observed.arenaCount === undefined ||
    !Number.isSafeInteger(observed.arenaCount) ||
    observed.arenaCount < 0 ||
    arenaInstances.length > observed.arenaCount
      ? null
      : observed.arenaCount - arenaInstances.length;


  // Assemble a single read-only projection. Its detailed inventories stay
  // authoritative for navigation; the summary only locates open work.
  const navigation: Omit<GameplayArchitectureNavigation, "architectureReconciliation" | "gameplayStructure"> = {
    schemaVersion: 1,
    policy: "derived-gameplay-architecture-navigation",
    stages: [...stageGroups].sort(([a], [b]) => a.localeCompare(b))
      .map(([name, group]) => ({
        name,
        scenarioIds: sorted(group.scenarioIds),
        componentIds: sorted(group.componentIds),
        causalLinkIds: sorted(group.causalLinkIds),
      })),
    scenarios: [...graph.scenarios].sort((a,b) => a.id.localeCompare(b.id))
      .map((scenario) => ({
        id: scenario.id,
        label: scenario.label,
        gameplayStage: scenario.gameplayStage,
        purpose: scenario.purpose,
        componentIds: sorted(scenario.componentIds),
        causalLinkIds: sorted(scenario.causalLinkIds),
        sourceSubjectIds: sorted(scenario.sourceSubjectIds),
      })),
    components: [...graph.components].sort((a,b) => a.id.localeCompare(b.id))
      .map((component) => ({
        id: component.id,
        label: component.label,
        technicalRole: component.technicalRole,
        gameplayPurpose: component.gameplayPurpose,
        scenarioIds: sorted(component.usedByScenarioIds),
        evidenceIds: sorted(component.evidenceIds),
      })),
    causalLinks: [...graph.causalLinks].sort((a,b) => a.id.localeCompare(b.id))
      .map((link) => ({
        id: link.id,
        fromComponentId: link.fromComponentId,
        toComponentId: link.toComponentId,
        purpose: link.purpose,
        status: link.status,
        evidenceIds: sorted(link.evidenceIds),
      })),
    unplacedComponentIds: sorted(graph.components
      .filter((component) => !placed.has(component.id))
      .map((component) => component.id)),
    unresolvedCausalLinkIds: sorted(graph.causalLinks
      .filter((link) => link.status !== "PROVEN")
      .map((link) => link.id)),
    missingGraphReferenceIds: sorted([...missing]),
    evidenceCoverage: {
      selectedArtifactEvidenceCount: sourceEvidence.length,
      architectureLinkedEvidenceIds: linkedEvidence,
      architectureUnlinkedEvidenceIds: sourceEvidence.filter((id) =>
        !architectureEvidence.includes(id)
      ),
      architectureEvidenceWithoutIntentRecordIds: architectureEvidence.filter(
        (id) => !intentEvidence.has(id)
      ),
      selectedArtifactEvidenceLinkPercent:
        percentage(linkedEvidence.length, sourceEvidence.length),
    },
    semanticIrCoverage: {
      observedSourceRelationships,
      untracedReturnOutcomeIds,
      stateOutcomeCandidates: stateOutcomeEvidence.map(candidate => {
        const outcomeComponentIds = sorted(graph.components
          .filter(component => component.evidenceIds.includes(candidate.outcomeId))
          .map(component => component.id));
        const writes = new Set(candidate.precedingWriteOperationIds);
        const precedingWriteComponentIds = sorted(graph.components
          .filter(component => component.evidenceIds.some(id => writes.has(id)))
          .map(component => component.id));
        const outcomeComponents = new Set(outcomeComponentIds);
        const writeComponents = new Set(precedingWriteComponentIds);
        return {
          ...candidate,
          outcomeComponentIds,
          precedingWriteComponentIds,
          sharedScenarioPlacementIds: outcomeComponents.size > 0 &&
            writeComponents.size > 0
            ? sorted(graph.scenarios
                .filter(scenario =>
                  scenario.componentIds.some(id => outcomeComponents.has(id)) &&
                  scenario.componentIds.some(id => writeComponents.has(id)))
                .map(scenario => scenario.id))
            : [],
        };
      }),
      resourceOutcomeCandidates: resourceOutcomeEvidence.map(candidate => {
        const outcomeComponentIds = sorted(graph.components
          .filter(component => component.evidenceIds.includes(candidate.outcomeId))
          .map(component => component.id));
        const actions = new Set(candidate.precedingResourceActionIds);
        const precedingResourceComponentIds = sorted(graph.components
          .filter(component => component.evidenceIds.some(id => actions.has(id)))
          .map(component => component.id));
        const outcomes = new Set(outcomeComponentIds);
        const resourceComponents = new Set(precedingResourceComponentIds);
        return {
          ...candidate,
          outcomeComponentIds,
          precedingResourceComponentIds,
          sharedScenarioPlacementIds: outcomes.size > 0 &&
            resourceComponents.size > 0
            ? sorted(graph.scenarios
                .filter(scenario =>
                  scenario.componentIds.some(id => outcomes.has(id)) &&
                  scenario.componentIds.some(id => resourceComponents.has(id)))
                .map(scenario => scenario.id))
            : [],
        };
      }),
      executionTraces: observedExecution.traces.map(trace => {
        const evidence = new Set([
          ...trace.regionIds,
          ...trace.executionEdgeIds,
          ...trace.temporalRelationIds,
          ...trace.stateOperationIds,
          ...trace.returnOutcomeIds,
          ...(trace.worldEffectIds ?? []),
          ...trace.resourceActionIds,
        ]);
        const matchingComponents = graph.components.filter(component =>
          component.evidenceIds.some(id => evidence.has(id)));
        const matchedEvidence = new Set(matchingComponents.flatMap(component =>
          component.evidenceIds.filter(id => evidence.has(id))));
        const coveredComponentIds = sorted(matchingComponents.map(c => c.id));
        const evidenceWithoutComponentIds = sorted([...evidence]
          .filter(id => !matchedEvidence.has(id)));
        const sharedScenarioPlacementIds = coveredComponentIds.length === 0
          ? [] : sorted(graph.scenarios.filter(scenario =>
              coveredComponentIds.every(id => scenario.componentIds.includes(id)))
            .map(scenario => scenario.id));
        return {
          ...trace,
          evidenceMatchedComponentIds: coveredComponentIds,
          evidenceWithoutComponentIds,
          sharedScenarioPlacementIds,
          modelingStatus: coveredComponentIds.length === 0
            ? "UNMODELED" as const
            : evidenceWithoutComponentIds.length > 0 ||
              sharedScenarioPlacementIds.length === 0
              ? "PARTIALLY_MODELED" as const
              : "PLACED_UNPROVEN" as const,
          // Explicit arm-by-arm correlation: a component attached to the
          // true arm is NOT automatically evidence for the false arm.
          branchPoints: trace.branchPoints.map(point => ({
            ...point,
            branches: point.branches.map(branch => {
              const branchIds = sorted([
                ...branch.executionEdgeIds,
                ...branch.stateWriteOperationIds,
                ...branch.returnOutcomeIds,
                ...(branch.worldEffectIds ?? []),
                ...branch.resourceActionIds,
              ]);
              const branchIdSet = new Set(branchIds);
              const matchedComponents = graph.components.filter(component =>
                component.evidenceIds.some(id => branchIdSet.has(id)));
              const linkedIds = new Set(matchedComponents.flatMap(component =>
                component.evidenceIds.filter(id => branchIdSet.has(id))));
              const matchedComponentIds = new Set(
                matchedComponents.map(component => component.id));
              return {
                ...branch,
                evidenceMatchedComponentIds: sorted([...matchedComponentIds]),
                scenarioPlacementIds: sorted(graph.scenarios
                  .filter(scenario => scenario.componentIds.some(id =>
                    matchedComponentIds.has(id)))
                  .map(scenario => scenario.id)),
                evidenceWithoutComponentIds: branchIds.filter(id =>
                  !linkedIds.has(id)),
              };
            }),
          })),
        };
      }),
      regionsOutsideTraces: observedExecution.regionsOutsideTraces,
      returnOutcomes: irAccounting((observed.semanticIr?.execution.outcomes ?? []).map(item => item.id)),
      resourceActions: irAccounting((observed.semanticIr?.state.resourceActions ?? []).map(item => item.id)),
      stateOperations: irAccounting(
        observed.semanticIr?.state.operations.map((item) => item.id) ?? [],
      ),
      executionRegions: irAccounting(
        observed.semanticIr?.execution.regions.map((item) => item.id) ?? [],
      ),
      executionEdges: irAccounting(
        observed.semanticIr?.execution.edges.map((item) => item.id) ?? [],
      ),
      temporalRelations: irAccounting(
        observed.semanticIr?.temporal.relations.map((item) => item.id) ?? [],
      ),
      worldEffects: irAccounting(
        observed.semanticIr?.execution.worldEffects?.map(item => item.id) ?? [],
      ),
    },
    systemInventory: [...(observed.systemObservations ?? [])]
      .sort((a, b) => a.system.localeCompare(b.system))
      .map((observation) => {
        const references = sorted(observation.observationReferences);
        const evidenceIds = sorted(observation.evidenceIds ?? []);
        const matchingComponents = graph.components.filter((component) =>
          component.evidenceIds.some((id) => evidenceIds.includes(id))
        );
        const matchedEvidenceIds = new Set(
          matchingComponents.flatMap((component) =>
            component.evidenceIds.filter((id) => evidenceIds.includes(id))
          ),
        );
        return {
          system: observation.system,
          observedCount: observation.observedCount,
          observationReferences: references,
          evidenceIds,
          inventoryStatus: observation.observedCount > 0
            ? "OBSERVED" as const
            : "NOT_OBSERVED" as const,
          evidenceLinkedComponentIds: sorted(
            matchingComponents.map((component) => component.id)
          ),
          unmatchedEvidenceIds: evidenceIds.filter(
            (id) => !matchedEvidenceIds.has(id)
          ),
          // A match establishes a navigable evidence bridge, not complete
          // system semantics, session ownership, or gameplay correctness.
          architectureMapping: matchedEvidenceIds.size > 0
            ? "EVIDENCE_LINKED" as const
            : "NOT_YET_RECONCILED" as const,
        };
      }),
    knowledgeCoverage: {
      observedSourceIndexPercent:
        percentage(observed.indexedSourceCount, observed.relevantSourceCount),
      observedComponentPlacementPercent:
        percentage(placedCount, graph.components.length),
      wholeGameUnderstandingPercent: null,
      wholeGameUnderstandingStatus: "NOT_MEASURABLE",
      observedRelevantSourceCount: observed.relevantSourceCount,
      observedIndexedSourceCount: observed.indexedSourceCount,
      observedComponentCount: graph.components.length,
      observedPlacedComponentCount: placedCount,
      arenaEvidence: {
        detected: observed.arenaDetected,
        count:
          observed.arenaCount === undefined
            ? null
            : observed.arenaCount,
        countBasis: observed.arenaCountBasis ?? null,
        layoutStatus: observed.arenaLayoutStatus ?? null,
        spatialLayoutEntries: spatialEntries,
        spatialLayoutConfidence: observed.spatialLayout?.confidence ?? null,
        arenaRegionCandidates,
        spatialArenaIdsWithoutRegionCandidates,
        arenasWithoutSpatialLayoutCount,
        spatialArenaIdsWithoutReplicaProof,
        arenaEvidenceComponentLinks,
        spatialArenaIdsWithoutComponentLinks,
        duplicateReplicaProofArenaIds,
        replicaProofEntries: arenaInstances.map((instance) => ({
          arenaId: instance.arenaId,
          evidenceIds: sorted(instance.evidenceIds),
          proofStatus: instance.status,
        })),
        entityPopulationProofEntries: entityProof.map((entry) => ({
          arenaId: entry.arenaId,
          status: entry.status,
          canonicalSpawns: entry.canonicalSpawns,
          replicaSpawns: entry.replicaSpawns,
          unresolvedSpawns: entry.unresolvedSpawns,
          mismatchCount: entry.mismatches.length,
        })),
        actorPopulationProofEntries: actorProof.map((entry) => ({
          arenaId: entry.arenaId,
          status: entry.status,
          canonicalActors: entry.canonicalActors,
          replicaActors: entry.replicaActors,
          mismatchCount: entry.mismatchCount,
        })),
        populationArenaIdsWithoutReplicaProof,
        arenasWithoutReplicaProofCount,
        declaredConcurrentArenaLimit:
          observed.declaredConcurrentArenaLimit ?? null,
        requestedConcurrentArenas:
          observed.requestedConcurrentArenas ?? null,
        safeConcurrentArenas:
          observed.safeConcurrentArenas ?? null,
        perArenaPlayerCapacity:
          observed.perArenaPlayerCapacity ?? null,
        architectureMapping: "NOT_YET_RECONCILED",
        stateIsolationObservations: [...(observed.stateIsolationObservations ?? [])]
          .sort((a,b) => a.scriptId.localeCompare(b.scriptId) ||
            a.region.localeCompare(b.region) || a.key.localeCompare(b.key))
          .map((item) => ({ ...item })),
        chunkLeases: [...(observed.chunkLeases ?? [])]
          .sort((a,b) => a.scriptId.localeCompare(b.scriptId) ||
            (a.leaseKey ?? "").localeCompare(b.leaseKey ?? ""))
          .map((lease) => ({
            scriptId: lease.scriptId,
            leaseKey: lease.leaseKey ?? null,
            acquireRegions: sorted(lease.acquireRegions),
            releaseRegions: sorted(lease.releaseRegions),
            status: lease.status,
          })),
        cleanupAssessments: [...(observed.cleanupAssessments ?? [])]
          .sort((a,b) => a.scriptId.localeCompare(b.scriptId) ||
            a.tableName.localeCompare(b.tableName))
          .map((item) => ({
            scriptId: item.scriptId,
            tableName: item.tableName,
            status: item.status,
            missingPhases: sorted(item.missingPhases),
            orderingViolations: sorted(item.orderingViolations),
          })),
        arenaSessionMapping: "NOT_YET_ESTABLISHED",
        spatialArenaIdsWithoutSessionOwnershipProof: sorted(spatialEntries.map((entry) => entry.arenaId)),
      },
    },
  };

  const featureKinds = new Set([
    "mechanic", "objective", "phase", "lifecycle", "outcome",
  ]);
  const featureComponents = graph.components.filter(component =>
    featureKinds.has(component.kind));
  const featureIds = new Set(featureComponents.map(component => component.id));
  const sourceEffectSlices = observed.semanticIr
    ? deriveSourceEffectSlices(observed.semanticIr)
    : [];
  const effectSlices: GameplayArchitectureNavigation[
    "gameplayStructure"]["effectSlices"] =
    sourceEffectSlices.map(slice => {
      const exactComponents = graph.components.filter(component =>
        component.evidenceIds.includes(slice.effectId));
      // A source-identified UI/action feature may own an exact call edge,
      // without owning the callee region. Preserve that as path CONTEXT,
      // never as direct effect ownership or evidence that the call ran.
      const pathEvidenceIds = new Set([
        slice.executionRegionId,
        ...slice.candidateIngress.flatMap(entry => [
          ...entry.regionIds, ...entry.executionEdgeIds,
        ]),
      ]);
      const exactComponentIds = sorted(exactComponents.map(c => c.id));
      return {
        ...slice,
        exactComponentIds,
        exactFeatureIds: exactComponentIds.filter(id => featureIds.has(id)),
        // A source-call path may pass through a classified function. This is
        // contextual association only, never a PROVEN semantic dependency.
        pathAssociatedFeatureIds: sorted(featureComponents
          .filter(component => component.evidenceIds.some(id =>
            pathEvidenceIds.has(id)) &&
            !exactComponentIds.includes(component.id))
          .map(component => component.id)),
      };
    });
  const featureComponentIds = new Set(featureComponents.map(component => component.id));
  const gameplayStructure: GameplayArchitectureNavigation["gameplayStructure"] = {
    scope: "OBSERVED_COMPONENTS_ONLY",
    // Publish each source-only trace's missing evidence once. The former
    // per-feature inline arrays multiplied the same IDs across features.
    observedFlowEvidence: navigation.semanticIrCoverage.executionTraces
      .filter(trace => trace.evidenceMatchedComponentIds.some(id => featureComponentIds.has(id)))
      .map(trace => ({
        entryRegionId: trace.entryRegionId,
        modelingStatus: trace.modelingStatus,
        unmodeledEvidenceIds: sorted(trace.evidenceWithoutComponentIds),
      }))
      .sort((a, b) => a.entryRegionId.localeCompare(b.entryRegionId)),
    gameSubjectIds: sorted(graph.components
      .filter(component => component.kind === "game")
      .map(component => component.id)),
    effectSlices,
    effectIdsWithoutComponentOwner: effectSlices
      .filter(slice => slice.exactComponentIds.length === 0)
      .map(slice => slice.effectId),
    mechanicReconstructions: graph.mechanicReconstructions ?? [],
    gameplayJourneyCandidates: graph.gameplayJourneyCandidates ?? [],
    gameplayJourneyTruncated: graph.gameplayJourneyTruncated ?? false,
    guardedSourceTransitions: graph.guardedSourceTransitions ?? [],
    sourceFlowCandidates: (graph.sourceFlowCandidates ?? []).map(flow => {
      const evidenceIds = new Set([
        flow.entryRegionId, ...flow.regionIds, ...flow.executionEdgeIds,
        ...flow.sourceSteps.map(step => step.id),
        ...flow.authoredBehaviorRelationIds,
      ]);
      const exactFeatureIds = sorted(featureComponents.filter(component =>
        component.evidenceIds.some(id => evidenceIds.has(id)))
        .map(component => component.id));
      const exactFeatures = new Set(exactFeatureIds);
      const directlyAssignedIds = new Set(featureComponents
        .flatMap(component => component.evidenceIds.filter(id => evidenceIds.has(id))));
      const materialSteps = flow.sourceSteps.filter(step =>
        step.kind !== "state" ||
        step.operation === "write" ||
        step.operation === "delete" ||
        step.operation === "clear");
      return {
        ...flow,
        exactFeatureIds,
        // Context membership alone does not establish a source dependency.
        candidateScenarioContextIds: sorted(graph.scenarios.filter(scenario =>
          scenario.componentIds.some(id => exactFeatures.has(id)))
          .map(scenario => scenario.id)),
        uninterpretedEvidenceIds: sorted((observed.intentUnknowns ?? [])
          .filter(unknown =>
            unknown.sourceEntryRegionId === flow.entryRegionId ||
            unknown.evidenceIds?.some(id => evidenceIds.has(id)))
          .flatMap(unknown =>
            (unknown.evidenceIds ?? []).filter(id => evidenceIds.has(id)))),
        unclassifiedMaterialStepIds: materialSteps
          .map(step => step.id).filter(id => !directlyAssignedIds.has(id)),
      };
    }).sort((a,b) => a.id.localeCompare(b.id)),
    authoredBehaviorRelationships:
      observed.semanticIr?.execution.authoredBehaviorRelations ?? [],
    uninterpretedSourceFlows: (observed.intentUnknowns ?? [])
      .filter(unknown =>
        unknown.sourceEntryRegionId !== undefined &&
        (unknown.evidenceIds?.length ?? 0) > 0)
      .map(unknown => {
        const entryRegionId = unknown.sourceEntryRegionId!;
        const materialEvidenceIds = sorted(unknown.evidenceIds ?? []);
        const materialSet = new Set(materialEvidenceIds);
        // One evidence ID can be referenced by several investigation
        // entries. The effect belongs to THIS unknown flow only when the
        // canonical effect owner supplies an ingress from that exact
        // source entry, or the effect is directly in its entry region.
        // A foreign entry cannot borrow a matching effect ID to
        // manufacture mechanic context or apparent flow completeness.
        const matchedSlices = effectSlices.filter(slice =>
          materialSet.has(slice.effectId) &&
          (slice.executionRegionId === entryRegionId ||
            slice.candidateIngress.some(path =>
              path.entryRegionId === entryRegionId)));
        const slicedIds = new Set(matchedSlices.map(slice => slice.effectId));
        return {
          unknownId: unknown.id,
          entryRegionId,
          materialEvidenceIds,
          effectPaths: matchedSlices.map(slice => {
            const matchingIngress = slice.candidateIngress.filter(path =>
              path.entryRegionId === entryRegionId);
            const contextRegions = new Set(matchingIngress.flatMap(path =>
              path.regionIds));
            const candidateFeatureContextIds = sorted(featureComponents
              .filter(component =>
                slice.exactFeatureIds.includes(component.id) ||
                component.evidenceIds.some(id => contextRegions.has(id)))
              .map(component => component.id));
            return {
              effectId: slice.effectId,
              effectKind: slice.effectKind,
              worldEffectKind: slice.worldEffectKind ?? null,
              targetLabel: slice.targetLabel ?? null,
              evidenceStatus: slice.status,
              effectGuards: slice.effectGuards,
              candidateOutcomeIds: slice.sourceOrderedOutcomeIds,
              guardStateReadIds: slice.guardStateReadIds,
              sourceLocalStateValueHandoffs: slice.sourceLocalStateValueHandoffs,
              matchingIngress: matchingIngress.map(path => ({
                executionEdgeIds: path.executionEdgeIds,
                pathGuards: path.pathGuards,
                temporalBoundaryEvidence: path.temporalBoundaryEvidence,
                candidateCallerStateWriteIds: path.candidateCallerStateWriteIds,
              })),
              candidateFeatureContextIds,
            };
          }).sort((a, b) => a.effectId.localeCompare(b.effectId)),
          materialIdsWithoutEffectSlice: materialEvidenceIds.filter(id =>
            !slicedIds.has(id)),
        };
      }).sort((a, b) => a.unknownId.localeCompare(b.unknownId)),
    subjects: [...graph.components]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(component => ({
        id: component.id,
        kind: component.kind,
        label: component.label,
        purpose: component.gameplayPurpose,
        evidenceIds: sorted(component.evidenceIds),
      })),
    scenarios: [...graph.scenarios]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(scenario => ({
        id: scenario.id,
        label: scenario.label,
        gameplayStage: scenario.gameplayStage,
        purpose: scenario.purpose,
        componentIds: sorted(scenario.componentIds),
      })),
    systems: graph.components
      .filter(component => component.kind === "runtime-domain")
      .map(component => {
        const scenarioIds = sorted(component.usedByScenarioIds);
        const provenFeatureIds = sorted(graph.causalLinks
          .filter(link => link.status === "PROVEN" &&
            (link.fromComponentId === component.id ||
              link.toComponentId === component.id))
          .map(link => link.fromComponentId === component.id
            ? link.toComponentId : link.fromComponentId)
          .filter(id => featureIds.has(id)));
        const coPlacedFeatureIds = sorted(graph.scenarios
          .filter(scenario => scenarioIds.includes(scenario.id))
          .flatMap(scenario => scenario.componentIds)
          .filter(id => featureIds.has(id) && !provenFeatureIds.includes(id)));
        return {
          id: component.id,
          label: component.label,
          evidenceIds: sorted(component.evidenceIds),
          scenarioIds,
          provenFeatureIds,
          coPlacedFeatureIds,
        };
      })
      .sort((a, b) => a.id.localeCompare(b.id)),
    features: featureComponents.map(component => {
      const scenarioIds = sorted(graph.scenarios
        .filter(scenario => scenario.sourceSubjectIds.includes(component.id) &&
          scenario.componentIds.includes(component.id))
        .map(scenario => scenario.id));
      const scenarioSet = new Set(scenarioIds);
      const relationships = graph.causalLinks
        .filter(link => scenarioSet.has(link.scenarioId) &&
          graph.scenarios.some(scenario => scenario.id === link.scenarioId &&
            scenario.causalLinkIds.includes(link.id)))
        .map(link => ({
          id: link.id,
          relationKind: link.intentEdgeKind ?? null,
          fromComponentId: link.fromComponentId,
          toComponentId: link.toComponentId,
          status: link.status,
          sourceEvidenceIds: sorted(link.evidenceIds.filter(id =>
            sourceEvidence.includes(id))),
        }))
        .sort((a, b) => a.id.localeCompare(b.id));
      const relationIds = (kinds: readonly (NonNullable<
        typeof relationships[number]["relationKind"]
      >)[]) => sorted(relationships
        .filter(relation => relation.relationKind !== null &&
          kinds.includes(relation.relationKind))
        .map(relation => relation.id));
      const sourceEvidenceIds = sorted(component.evidenceIds
        .filter(id => sourceEvidence.includes(id)));
      return {
        id: component.id,
        kind: component.kind as GameplayArchitectureNavigation[
          "gameplayStructure"]["features"][number]["kind"],
        label: component.label,
        purpose: component.gameplayPurpose,
        sourceEvidenceIds,
        grounding: sourceEvidenceIds.length > 0
          ? "SOURCE_EVIDENCED" as const
          : "UNVERIFIED" as const,
        scenarioIds,
        sourceBehaviorPaths: effectSlices
          .filter(slice => slice.exactFeatureIds.includes(component.id) ||
            slice.pathAssociatedFeatureIds.includes(component.id))
          .flatMap(slice => {
            const association = slice.exactFeatureIds.includes(component.id)
              ? "DIRECT_EFFECT_EVIDENCE" as const
              : "CALL_PATH_CONTEXT" as const;
            const paths = slice.candidateIngress.length > 0
              ? slice.candidateIngress
              : [undefined];
            // A feature found on ONE alternative ingress cannot own all
            // of this effect's alternative paths. DIRECT evidence belongs to
            // every path of that effect; CALL_PATH_CONTEXT belongs only to
            // paths that traverse an exact feature-evidenced IR region.
            const associatedPaths = paths.filter(entry =>
              association === "DIRECT_EFFECT_EVIDENCE" ||
              (entry !== undefined && component.evidenceIds.some(id =>
                entry.regionIds.includes(id) ||
                entry.executionEdgeIds.includes(id))));
            return associatedPaths.map(entry => ({
              effectId: slice.effectId,
              association,
              evidenceStatus: slice.status,
              entryRegionId: entry?.entryRegionId ?? null,
              executionEdgeIds: entry?.executionEdgeIds ?? [],
              temporalBoundaryEvidence: entry?.temporalBoundaryEvidence ?? [],
              preconditions: [
                ...slice.effectGuards,
                ...(entry?.pathGuards ?? []),
              ],
              precedingStateReadIds: sorted([
                ...slice.possiblePrecedingReadIds, ...slice.guardStateReadIds,
              ]),
              candidateGuardStateWriteIds: slice.candidateGuardStateWriteIds,
              candidateCallerStateWriteIds:
                entry?.candidateCallerStateWriteIds ?? [],
              sourceLocalStateValueHandoffs: slice.sourceLocalStateValueHandoffs,
              guardedStateTransitionCandidates: slice.guardedStateTransitionCandidates,
              candidateCallerStateValueHandoffs:
                entry?.candidateCallerStateValueHandoffs ?? [],
              authoredStateValue: slice.authoredStateValue ?? null,
              effectKind: slice.effectKind,
              worldEffectKind: slice.worldEffectKind ?? null,
              effectTarget: slice.targetLabel ?? null,
              candidateOutcomeIds: slice.sourceOrderedOutcomeIds,
              resourceAction: slice.resourceAction ?? null,
              sourceResourceLifetime: slice.sourceResourceLifetime ?? null,
            }));
          })
          .sort((a, b) => a.effectId.localeCompare(b.effectId) ||
            (a.entryRegionId ?? "").localeCompare(b.entryRegionId ?? "")),
        relationships,
        activationRelationIds: relationIds(["requires", "valid-during", "scoped-to"]),
        effectRelationIds: relationIds(["produces", "consumes", "resets", "persists", "owns"]),
        transitionRelationIds: relationIds(["transitions-to", "recovers-to"]),
        outcomeRelationIds: relationIds(["wins-by", "loses-by"]),
        observedFlowEntries: navigation.semanticIrCoverage.executionTraces
          .filter(trace => trace.evidenceMatchedComponentIds.includes(component.id))
          .map(trace => ({
            entryRegionId: trace.entryRegionId,
            modelingStatus: trace.modelingStatus,
          }))
          .sort((a, b) => a.entryRegionId.localeCompare(b.entryRegionId)),
      };
    }).sort((a, b) => a.id.localeCompare(b.id)),
    unplacedFeatureIds: sorted(featureComponents
      .filter(component => !graph.scenarios.some(scenario =>
        scenario.sourceSubjectIds.includes(component.id) &&
        scenario.componentIds.includes(component.id)))
      .map(component => component.id)),
    unassignedSemanticIrEvidenceIds: sorted([
      ...navigation.semanticIrCoverage.returnOutcomes.unlinkedIds,
      ...navigation.semanticIrCoverage.resourceActions.unlinkedIds,
      ...navigation.semanticIrCoverage.stateOperations.unlinkedIds,
      ...navigation.semanticIrCoverage.executionRegions.unlinkedIds,
      ...navigation.semanticIrCoverage.executionEdges.unlinkedIds,
      ...navigation.semanticIrCoverage.temporalRelations.unlinkedIds,
      ...navigation.semanticIrCoverage.worldEffects.unlinkedIds,
    ]),
  };

  const ir = navigation.semanticIrCoverage;
  const semanticIrRecordsUnlinkedCount = [
    ir.stateOperations,
    ir.returnOutcomes,
    ir.resourceActions,
    ir.executionRegions,
    ir.executionEdges,
    ir.temporalRelations,
    ir.worldEffects,
  ].reduce((total, group) => total + group.unlinkedIds.length, 0);
  const sourceIndexIncomplete =
    !Number.isSafeInteger(observed.relevantSourceCount) ||
    !Number.isSafeInteger(observed.indexedSourceCount) ||
    observed.relevantSourceCount <= 0 ||
    observed.indexedSourceCount < 0 ||
    observed.indexedSourceCount > observed.relevantSourceCount ||
    observed.indexedSourceCount !== observed.relevantSourceCount;
  const gapCounts = {
    gameplayIntentEvidenceUnlinkedCount:
      navigation.evidenceCoverage.architectureUnlinkedEvidenceIds.length,
    semanticIrRecordsUnlinkedCount,
    behaviorFlowsUnmodeledCount:
      ir.executionTraces.filter(trace => trace.modelingStatus === "UNMODELED").length,
    behaviorFlowsPartiallyModeledCount:
      ir.executionTraces.filter(trace => trace.modelingStatus === "PARTIALLY_MODELED").length,
    behaviorFlowsPlacedUnprovenCount:
      ir.executionTraces.filter(trace => trace.modelingStatus === "PLACED_UNPROVEN").length,
    scenarioComponentsUnplacedCount: navigation.unplacedComponentIds.length,
    causalLinksUnresolvedCount: navigation.unresolvedCausalLinkIds.length,
    graphReferencesMissingCount: navigation.missingGraphReferenceIds.length,
    observedSystemsUnreconciledCount: navigation.systemInventory.filter(
      (system) => system.inventoryStatus === "OBSERVED" &&
        system.architectureMapping === "NOT_YET_RECONCILED"
    ).length,
    sourceRelationshipsWithoutProofCount:
      ir.observedSourceRelationships.filter(relation => relation.gap !== null).length,
    observedOutcomesWithoutEntryCount: ir.untracedReturnOutcomeIds.length,
  };
  const observedSourceRelationshipCount = ir.observedSourceRelationships.length;
  const arenaMappingUnresolved =
    !spatialLayoutValid ||
    navigation.knowledgeCoverage.arenaEvidence.duplicateReplicaProofArenaIds.length > 0 ||
    (navigation.knowledgeCoverage.arenaEvidence.detected &&
    navigation.knowledgeCoverage.arenaEvidence.architectureMapping ===
      "NOT_YET_RECONCILED");
  const hasObservedGaps = sourceIndexIncomplete ||
    graph.components.length === 0 ||
    arenaMappingUnresolved ||
    Object.values(gapCounts).some((count) => count > 0);

  return {
    ...navigation,
    gameplayStructure,
    architectureReconciliation: {
      scope: "OBSERVED_RECORDS_ONLY",
      status: hasObservedGaps
        ? "GAPS_PRESENT"
        : "NO_GAPS_IN_MEASURED_SCOPE",
      sourceIndexIncomplete,
      ...gapCounts,
      observedSourceRelationshipCount,
      arenaMappingUnresolved,
    },
  };
}
