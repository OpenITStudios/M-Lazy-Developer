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
