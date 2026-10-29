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
  };
  /** Literal source `translate` property referring to a selected .lang
   * key. This independent code site does not certify UI delivery or which
   * resource/behavior pack translation wins when keys collide.
   */
  literalTranslationUse?: {
    readonly key: string;
    readonly syntax: "translate-object-literal";
    readonly executionRegion: string;
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
