export type GameplayIntentNodeKind =
  | "game"
  | "mechanic"
  | "actor"
  | "role"
  | "objective"
  | "phase"
  | "state"
  | "resource"
  | "lifecycle"
  | "spatial-region"
  | "policy"
  | "outcome";

export type GameplayIntentEdgeKind =
  | "owns"
  | "participates-in"
  | "produces"
  | "consumes"
  | "transitions-to"
  | "valid-during"
  | "scoped-to"
  | "located-in"
  | "resets"
  | "persists"
  | "requires"
  | "excludes"
  | "recovers-to"
  | "wins-by"
  | "loses-by";

export type GameplayIntentStatus =
  | "authored"
  | "inferred"
  | "hypothesis";

export type GameplayIntentEvidenceOrigin =
  | "game-design-spec"
  | "source-code"
  | "manifest"
  | "command"
  | "scoreboard"
  | "tag"
  | "dialogue"
  | "translation"
  | "structure"
  | "world-db"
  | "runtime-observation"
  | "controlled-experiment"
  | "historical-diff"
  | "project-policy"
  | "official-documentation";

export type GameplayIntentEvidenceScope =
  | "selected-artifact"
  | "external-reference"
  | "runtime";


/**
 * An exact Semantic IR state/return/world-effect source site owned by a
 * current Gameplay Intent subject, in the SAME authored execution region
 * as a typed UI-send call. This is source context, not a causal edge,
 * an approved objective, game execution, or player delivery.
 */
export interface GameplayUiSourceStepBinding {
  readonly subjectId: string;
  readonly subjectKind: "state" | "phase" | "objective" | "outcome";
  readonly sourceStepEvidenceId: string;
  readonly sourceStepKind: "state-write" | "return-outcome" | "world-effect";
  readonly sourceLocator: string;
  /** Lexical source order in a single region is not runtime operation order. */
  readonly lexicalOrder: "STEP_BEFORE_UI" | "UI_BEFORE_STEP";
  readonly stepGuards: readonly {
    readonly kind: "lexical" | "precedence";
    readonly expression: string;
    readonly branch: "true" | "false";
    readonly locator: string;
  }[];
  /** This qualifies only the UI region entry, NOT execution of the step. */
  readonly entryBasis: "ROOTED_UI_REGION_CANDIDATE" | "LOCAL_UI_REGION_ONLY";
  readonly proof: "EXACT_SELECTED_SOURCE_STEP_CONTEXT_NOT_GAMEPLAY_CAUSALITY";
}

export interface GameplayIntentEvidence {
  id: string;
  origin: GameplayIntentEvidenceOrigin;
  locator: string;
  summary: string;
  scope?: GameplayIntentEvidenceScope;
  /**
   * Only for game-design-spec: carry the validated selected-source document's
   * draft/approved status. Source node status "authored" is not approval.
   */
  designStatus?: "draft" | "approved";
  /**
   * Literal current-artifact .lang copy. A player-facing SOURCE CUE, not an
   * approved game rule, delivered UI, or proven victory/defeat condition.
   */
  playerFacingText?: {
    readonly key: string;
    readonly text: string;
    /** Current-world pack-list declaration, not effective client selection. */
    readonly pack?: {
      readonly root: string;
      readonly worldAttachment: "listed" | "not-listed" | "unknown";
    };
  };
  /** Literal source `translate` property referring to a selected .lang
   * key. This independent code site does not certify UI delivery or which
   * resource/behavior pack translation wins when keys collide.
   */
  literalTranslationUse?: {
    readonly key: string;
    readonly syntax: "translate-object-literal";
    readonly executionRegion: string;
    /** Exact AST translation argument -> typed Semantic IR UI call site.
     * The API is authored but may never run; effective display/locale
     * and designed gameplay are independent unresolved obligations.
     */
    readonly authoredUiSendCall?: {
      readonly apiCallEvidenceId: string;
      readonly sourceLocator: string;
      readonly receiverType: "Player" | "World" | "ScreenDisplay";
      readonly method: "sendMessage" | "setTitle" | "setActionBar";
      readonly proof: "EXACT_SOURCE_ARGUMENT_TO_TYPED_UI_CALL_NOT_DELIVERY";
      readonly receiverInference?: "direct" | "bounded";
      /** Actual exact typed UI call region may differ from the literal's
       * region when a module constant/local helper forwards its value.
       */
      readonly uiExecutionRegionId?: string;
      readonly valueFlow?: {
        readonly hops: readonly {
          readonly kind: "immutable-const-binding" | "simple-helper-parameter" |
            "local-this-method-parameter";
          readonly declarationLocator: string;
          readonly consumptionLocator: string;
          readonly evidenceId: string;
        }[];
        readonly proof: "BOUNDED_SOURCE_LITERAL_FORWARDING_NOT_UI_DELIVERY";
      };
      /** Exact source operations linked to existing Intent subject IDs.
       * No independent design authority or proof of gameplay causality.
       */
      readonly sourceGameplayStepBindings?: readonly GameplayUiSourceStepBinding[];
      readonly omittedSourceGameplayStepBindings?: number;
      /** Conditions on the typed call site. Not evaluated gameplay guards. */
      readonly callGuards?: readonly {
        readonly kind: "lexical" | "precedence";
        readonly expression: string;
        readonly branch: "true" | "false";
        readonly locator: string;
      }[];
      /** Alternative entrypoint paths stay separate, including their
       * source-edge guards. They do NOT establish runtime activation.
       */
      readonly sourceActivation?: {
        readonly status:
          | "MANIFEST_SOURCE_ROOTS_UNVERIFIED"
          | "SOURCE_ROOTED_PATH_CANDIDATE"
          | "NO_ADMITTED_SOURCE_ROOT_PATH"
          | "SOURCE_PATH_SEARCH_BOUNDED";
        readonly sourcePaths: readonly {
          readonly entryRegionId: string;
          readonly executionEdgeIds: readonly string[];
          readonly edgeGuards: readonly {
            readonly edgeId: string;
            readonly kind: "lexical" | "precedence";
            readonly expression: string;
            readonly branch: "true" | "false";
            readonly locator: string;
          }[];
        }[];
        readonly unresolvedEntryCandidates: number;
        readonly proof: "SOURCE_ROOTED_IR_PATH_NOT_RUNTIME_EXECUTION";
      };
    };
    /** Only when the exact canonical IR script region was found; absence
     * is an explicit source-graph identity gap, not proof of dead code. */
    readonly executionRegionId?: string;
    /** Expression-local source conditions; not necessarily guards on a
     * later sendMessage() or the full player session lifecycle. */
    readonly sourceConditions?: readonly {
      readonly kind: "lexical" | "precedence";
      readonly condition: string;
      readonly branch: "true" | "false";
      readonly sourceLocator: string;
    }[];
  };
}

export type GameplayIntentScalar =
  | string
  | number
  | boolean
  | null;

export type GameplayIntentPolicyOperand =
  | { kind: "path"; path: string }
  | { kind: "literal"; value: GameplayIntentScalar }
  | {
      kind: "index";
      base: GameplayIntentPolicyOperand;
      key: GameplayIntentPolicyOperand;
    };

export type GameplayIntentPolicyPredicate =
  | {
      kind: "truthy";
      operand: GameplayIntentPolicyOperand;
    }
  | {
      kind: "falsy";
      operand: GameplayIntentPolicyOperand;
    }
  | {
      kind: "comparison";
      operator: "eq" | "neq" | "lt" | "lte" | "gt" | "gte";
      left: GameplayIntentPolicyOperand;
      right: GameplayIntentPolicyOperand;
    }
  | {
      kind: "all" | "any";
      predicates: readonly GameplayIntentPolicyPredicate[];
    }
  | {
      kind: "in";
      operand: GameplayIntentPolicyOperand;
      values: readonly GameplayIntentScalar[];
    }
  | {
      kind: "fallback";
      excludedPredicates: readonly GameplayIntentPolicyPredicate[];
    }
  | {
      kind: "unknown";
      text: string;
    };

export interface GameplayIntentSpatialPoint {
  x: number;
  y: number;
  z: number;
  index?: number;
}

export interface GameplayIntentSpatialIndexRange {
  min: number;
  max: number;
}

export interface GameplayIntentSpatialOffsetTransform {
  kind: "offset";
  offsetPath: string;
  functionName: string;
}

export interface GameplayIntentSpatialContextSeries {
  collectionName: string;
  contextCount: number;
  offsetPath: string;
  offsetBase: {
    x: number;
    y: number;
    z: number;
  };
  offsetStride: {
    x: number;
    y: number;
    z: number;
  };
  contextIdPrefix?: string;
  contextIdIndexBase?: number;
}

export interface GameplayIntentSpatialProfile {
  coordinateSpace: "unknown" | "local" | "world";
  routeId: string;
  collectionHint?: string;
  points: readonly GameplayIntentSpatialPoint[];
  indexRanges?: readonly GameplayIntentSpatialIndexRange[];
  transform?: GameplayIntentSpatialOffsetTransform;
  contextSeries?: GameplayIntentSpatialContextSeries;
}

export interface GameplayIntentNode {
  id: string;
  kind: GameplayIntentNodeKind;
  label: string;
  status: GameplayIntentStatus;
  evidenceIds: readonly string[];
  description?: string;
  policyPredicate?: GameplayIntentPolicyPredicate;
  spatialProfile?: GameplayIntentSpatialProfile;
}

export interface GameplayIntentEdge {
  id: string;
  from: string;
  to: string;
  kind: GameplayIntentEdgeKind;
  status: GameplayIntentStatus;
  evidenceIds: readonly string[];
  description?: string;
}

export type GameplayIntentInvariantStrength =
  | "must"
  | "must-not"
  | "should";

export interface GameplayIntentInvariant {
  id: string;
  statement: string;
  strength: GameplayIntentInvariantStrength;
  status: GameplayIntentStatus;
  subjectIds: readonly string[];
  evidenceIds: readonly string[];
}

/** A reviewed, typed relation between TWO exact selected-source sites.
 * This is source syntax only; it is not a gameplay edge or runtime witness.
 */
export interface GameplayIntentSourceRelation {
  readonly sourceClaim:
    | "SOURCE_GUARD_VALUE_HANDOFF_CANDIDATE"
    | "SOURCE_EFFECT_RETURN_CANDIDATE";
  readonly fromStepId: string;
  readonly toStepId: string;
  readonly evidenceIds: readonly string[];
  readonly proofBoundary: "REVIEWED_TYPED_SOURCE_RELATION_NOT_GAMEPLAY_OR_RUNTIME_PROOF";
}

export interface GameplayIntentUnknown {
  id: string;
  question: string;
  blockedSubjectIds: readonly string[];
  evidenceIds?: readonly string[];
  /**
   * Exact authored execution entry for an unclassified technical flow.
   * It is not a mechanic, runtime event, or proof the entry actually ran.
   */
  sourceEntryRegionId?: string;
  /** Positive typed source relationships, without resolving this unknown's
   * independent design, player-flow or native runtime obligations.
   */
  sourceRelations?: readonly GameplayIntentSourceRelation[];
}

export interface GameplayIntentModel {
  schemaVersion: 1;
  id: string;
  artifactId?: string;
  evidence: readonly GameplayIntentEvidence[];
  nodes: readonly GameplayIntentNode[];
  edges: readonly GameplayIntentEdge[];
  invariants: readonly GameplayIntentInvariant[];
  unknowns: readonly GameplayIntentUnknown[];
}

export type IntentGroundingDisposition =
  | "grounded"
  | "ambiguous"
  | "insufficient";

export interface IntentGroundingAssessment {
  disposition: IntentGroundingDisposition;
  subjectIds: readonly string[];
  unknownIds: readonly string[];
  unsupportedIds: readonly string[];
  reasons: readonly string[];
}
