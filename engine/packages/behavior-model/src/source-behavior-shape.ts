import type {
  AuthoredStateWriteValueSyntax, ExecutionRegionKind,
} from "../../semantic-ir/src/index.js";
import type { SourceEffectSlice, SourceStateValueHandoff } from "./source-evidence.js";

/**
 * A source-structural profile, NOT a gameplay identity, phase classifier,
 * state value, causal proof, or a runtime observation.
 *
 * Inputs are already selected and source-scoped by their canonical owners.
 * Only typed structural operations are compared: paths, names, IDs, literal
 * game labels and entity identities MUST NOT become equality evidence.
 */
export interface SourceBehaviorShapeInput {
  readonly sourceTraceStatus:
    "SOURCE_ROOT_TRACE" | "DISCONNECTED_SOURCE_REGION" | "UNKNOWN";
  readonly entryKind: ExecutionRegionKind;
  readonly steps: readonly {
    readonly kind: "state" | "resource-action" | "return" | "world-effect";
    readonly operation?: string;
    /** A known authored write form, not proven runtime assignment. */
    readonly authoredWriteValueSyntax?: AuthoredStateWriteValueSyntax;
  }[];
  readonly effects: readonly {
    readonly effectKind: SourceEffectSlice["effectKind"];
    readonly worldEffectKind?: SourceEffectSlice["worldEffectKind"] | null;
    readonly evidenceStatus: SourceEffectSlice["status"];
    readonly guardStateReadIds: readonly string[];
    readonly sourceLocalStateValueHandoffs: readonly Pick<
      SourceStateValueHandoff, "origin" | "scalarKind"
    >[];
    readonly candidateOutcomeIds: readonly string[];
    readonly temporalBoundaryCount: number;
    readonly omittedGuardStateReads?: number;
    readonly omittedValueHandoffs?: number;
    readonly omittedCandidateOutcomes?: number;
  }[];
  readonly omittedSteps: number;
  readonly omittedEffects: number;
  readonly unresolvedSourceEdges: number;
}

export interface SourceBehaviorShape {
  readonly status: "STRUCTURAL_CANDIDATE" | "INSUFFICIENT_SOURCE";
  readonly entryKind: ExecutionRegionKind;
  readonly sourceTraceStatus: SourceBehaviorShapeInput["sourceTraceStatus"];
  /** Sorted source-agnostic per-effect signatures. No file/variable/label IDs. */
  readonly effectShapes: readonly string[];
  /** Bounded, source-only context; it never asserts chronological execution. */
  readonly operationKinds: readonly string[];
  readonly limitations: readonly string[];
  readonly proofBoundary: "SOURCE_STRUCTURE_NOT_GAMEPLAY_EQUIVALENCE_OR_RUNTIME";
}

export interface SourceBehaviorShapeComparison {
  readonly disposition:
    | "STRUCTURAL_ANALOG_CANDIDATE"
    | "OBSERVED_STRUCTURE_DIFFERS"
    | "INSUFFICIENT_SOURCE";
  readonly commonStructuralFeatures: readonly string[];
  /** Divergent entry kinds require independently proving trigger equivalence. */
  readonly entryKindsDiffer: boolean;
  readonly onlyInLeft: readonly string[];
  readonly onlyInRight: readonly string[];
  readonly proofBoundary: "SOURCE_STRUCTURE_NOT_GAMEPLAY_EQUIVALENCE_OR_RUNTIME";
}

/** Coarse source anatomy is useful for retrieval, not a proof of meaning. */
export function describeSourceBehaviorShape(
  input: SourceBehaviorShapeInput,
): SourceBehaviorShape {
  const limitations: string[] = [];
  if (input.sourceTraceStatus !== "SOURCE_ROOT_TRACE") {
    limitations.push("Source entry activation is not rooted in the selected source graph.");
  }
  if (input.omittedSteps > 0 || input.omittedEffects > 0 ||
      input.effects.some(effect =>
        (effect.omittedGuardStateReads ?? 0) > 0 ||
        (effect.omittedValueHandoffs ?? 0) > 0 ||
        (effect.omittedCandidateOutcomes ?? 0) > 0)) {
    limitations.push("Bounded source projection omits relevant operations or relations.");
  }
  if (input.unresolvedSourceEdges > 0) {
    limitations.push("At least one source call edge has an unresolved target.");
  }
  if (input.steps.some(step =>
    step.kind === "state" && step.operation === "write" &&
    step.authoredWriteValueSyntax === undefined)) {
    limitations.push("At least one authored state-write RHS has no typed source syntax; comparison must abstain.");
  }
  if (input.effects.length === 0) {
    limitations.push("No exact selected-source effect slice is available.");
  }
  if (input.effects.some(effect => effect.evidenceStatus !== "CANDIDATE_INGRESS")) {
    limitations.push("An effect lacks a complete known ingress or has truncated paths.");
  }
  if (input.effects.some(effect =>
    effect.effectKind === "world-effect" && !effect.worldEffectKind)) {
    limitations.push("A generic world-effect without a typed effect kind cannot ground an analogy.");
  }

  // Preserve each effect's own read/handoff/return/boundary relationships.
  // Flattening them across effects would fabricate a shared dataflow chain.
  const effectShapes = input.effects.map(effect => {
    const handoffs = [...new Set(effect.sourceLocalStateValueHandoffs
      .map(item => item.origin + ":" + item.scalarKind))].sort();
    return [
      effect.effectKind,
      effect.worldEffectKind ?? "unspecified",
      effect.guardStateReadIds.length > 0 ? "guard-read" : "no-guard-read-recorded",
      handoffs.length > 0 ? "value:" + handoffs.join("+") : "no-local-value-handoff-recorded",
      effect.candidateOutcomeIds.length > 0 ? "source-return" : "no-source-return-recorded",
      effect.temporalBoundaryCount > 0 ? "temporal-boundary" : "no-temporal-boundary-recorded",
    ].join("|");
  }).sort();

  // Preserve both per-site RHS syntax and multiplicity: a single true write
  // cannot silently equal several false/reset writes in another map.
  const operationKinds = input.steps.map(step =>
    step.kind + (step.operation ? ":" + step.operation : "") +
    (step.kind === "state" && step.operation === "write"
      ? ":" + (step.authoredWriteValueSyntax ?? "RHS_UNKNOWN") : "")
  ).sort();

  const hasMaterialRelation = input.effects.some(effect =>
    effect.sourceLocalStateValueHandoffs.length > 0 ||
    effect.candidateOutcomeIds.length > 0 ||
    effect.temporalBoundaryCount > 0);

  if (!hasMaterialRelation) {
    limitations.push("A generic effect alone cannot identify a behavior relationship.");
  }

  return {
    status: limitations.length === 0
      ? "STRUCTURAL_CANDIDATE" : "INSUFFICIENT_SOURCE",
    entryKind: input.entryKind,
    sourceTraceStatus: input.sourceTraceStatus,
    effectShapes,
    operationKinds,
    limitations,
    proofBoundary: "SOURCE_STRUCTURE_NOT_GAMEPLAY_EQUIVALENCE_OR_RUNTIME",
  };
}

/**
 * Compare two independently grounded source profiles. Identical profiles
 * mean only that a reader should investigate the same *kind* of authored
 * structure. They do not authorize a player objective, bug, or designed
 * equivalence, even when the implementation uses different filenames.
 */
export function compareSourceBehaviorShapes(
  left: SourceBehaviorShape,
  right: SourceBehaviorShape,
): SourceBehaviorShapeComparison {
  // A shape match must retain exact kinds of the authored state/resource
  // operations too. "write" and "delete" are not interchangeable merely
  // because the downstream world effect has the same kind.
  const leftFeatures = [
    ...left.effectShapes.map(shape => "effect:" + shape),
    ...left.operationKinds.map(kind => "operation:" + kind),
  ].sort();
  const rightFeatures = [
    ...right.effectShapes.map(shape => "effect:" + shape),
    ...right.operationKinds.map(kind => "operation:" + kind),
  ].sort();
  // Multiset matching retains operation/effect multiplicity instead of
  // merging repeated effects and silently equating one with several.
  const remainingRight = [...rightFeatures];
  const common: string[] = [];
  const onlyInLeft: string[] = [];
  for (const feature of leftFeatures) {
    const found = remainingRight.indexOf(feature);
    if (found < 0) onlyInLeft.push(feature);
    else {
      common.push(feature);
      remainingRight.splice(found, 1);
    }
  }
  const onlyInRight = remainingRight;
  const disposition =
    left.status !== "STRUCTURAL_CANDIDATE" ||
      right.status !== "STRUCTURAL_CANDIDATE"
      ? "INSUFFICIENT_SOURCE"
      : onlyInLeft.length === 0 && onlyInRight.length === 0 &&
        leftFeatures.length === rightFeatures.length
        ? "STRUCTURAL_ANALOG_CANDIDATE"
        : "OBSERVED_STRUCTURE_DIFFERS";
  return {
    disposition,
    commonStructuralFeatures: [...new Set(common)].sort(),
    entryKindsDiffer: left.entryKind !== right.entryKind,
    onlyInLeft: [...new Set(onlyInLeft)].sort(),
    onlyInRight: [...new Set(onlyInRight)].sort(),
    proofBoundary: "SOURCE_STRUCTURE_NOT_GAMEPLAY_EQUIVALENCE_OR_RUNTIME",
  };
}
