import type {
  SourceRef,
} from "../../project-model/src/index.js";
import type {
  BugImpactAssessment,
  BugPrimaryFailure,
} from "./decision.js";
import type {
  DefectConfirmation,
} from "./promote-v2.js";
import type {
  BugReportV2FoundBy,
  BugReportV2ReproductionProvenance,
} from "./v2.js";
import type {
  ExpectedBehaviorAuthority,
} from "./confirmation-v2.js";

export interface ConfirmedDefectExpectedBasis {
  readonly authority: ExpectedBehaviorAuthority;
  readonly statement: string;
  readonly evidenceIds: readonly string[];
}

export interface ConfirmedDefectObservation {
  readonly statement: string;
  readonly evidenceIds: readonly string[];
}

export interface ConfirmedDefectSourceEvidence {
  readonly source: SourceRef;
  readonly reason: string;
  readonly semanticOwnerId?: string;
}

function sourceRepairUnitId(
  evidence: ConfirmedDefectSourceEvidence,
): string | undefined {
  const semanticOwnerId =
    evidence.semanticOwnerId?.trim();
  if (semanticOwnerId) {
    return "execution-region:" + semanticOwnerId;
  }

  const source = evidence.source;
  const path = source.relativePath
    .replaceAll("\\", "/")
    .trim();
  if (!path) return undefined;

  if (
    source.jsonPointer !== undefined &&
    source.jsonPointer.trim().length > 0
  ) {
    return (
      "source-json:" +
      path +
      "#" +
      source.jsonPointer.trim()
    );
  }

  const range = source.range;
  if (range?.lineStart !== undefined) {
    return (
      "source-range:" +
      path +
      "#L" +
      String(range.lineStart) +
      (range.lineEnd === undefined
        ? ""
        : "-L" + String(range.lineEnd))
    );
  }

  return "source-file:" + path;
}

export function deriveRepairUnitIdsFromSourceEvidence(
  sourceEvidence:
    readonly ConfirmedDefectSourceEvidence[] | undefined,
): readonly string[] {
  if (!sourceEvidence || sourceEvidence.length === 0) {
    return [];
  }

  return [
    ...new Set(
      sourceEvidence
        .map((item) =>
          sourceRepairUnitId(item)
        )
        .filter(
          (value): value is string =>
            value !== undefined,
        ),
    ),
  ].sort();
}

function validateConfirmedDefectSourceRef(
  source: SourceRef,
): readonly string[] {
  const errors: string[] = [];

  if (!source.artifactId.trim()) {
    errors.push("artifactId must be non-empty.");
  }
  if (!source.relativePath.trim()) {
    errors.push("relativePath must be non-empty.");
  }

  const range = source.range;
  if (range) {
    const values = [
      ["lineStart", range.lineStart],
      ["lineEnd", range.lineEnd],
      ["columnStart", range.columnStart],
      ["columnEnd", range.columnEnd],
    ] as const;

    for (const [name, value] of values) {
      if (
        value !== undefined &&
        (!Number.isInteger(value) || value < 1)
      ) {
        errors.push(
          name + " must be a positive integer when present.",
        );
      }
    }

    if (
      range.lineStart !== undefined &&
      range.lineEnd !== undefined &&
      range.lineEnd < range.lineStart
    ) {
      errors.push(
        "lineEnd must be greater than or equal to lineStart.",
      );
    }
  }

  if (
    source.jsonPointer !== undefined &&
    source.jsonPointer !== "" &&
    !source.jsonPointer.startsWith("/")
  ) {
    errors.push(
      "jsonPointer must be empty or start with '/'.",
    );
  }

  return errors;
}

export interface ConfirmedDefectIdentityInput {
  readonly subjectIds: readonly string[];
  readonly brokenInvariantIds: readonly string[];
  readonly primaryFailure: BugPrimaryFailure;
}

function normalizedIdentityPart(
  values: readonly string[],
): string {
  return [...new Set(
    values
      .map((value) => value.trim())
      .filter(Boolean),
  )].sort().join(",");
}

export function deriveConfirmedDefectSemanticKey(
  input: ConfirmedDefectIdentityInput,
): string {
  return [
    "subjects=" + normalizedIdentityPart(input.subjectIds),
    "invariants=" +
      normalizedIdentityPart(input.brokenInvariantIds),
    "failure=" + input.primaryFailure,
  ]
    .filter(
      (value): value is string =>
        value !== undefined &&
        value.trim().length > 0,
    )
    .join("|");
}

export interface ConfirmedDefect {
  readonly semanticKey: string;
  readonly subjectIds: readonly string[];
  readonly foundBy: BugReportV2FoundBy;
  readonly confirmation: DefectConfirmation;
  readonly impact: BugImpactAssessment;
  readonly primaryFailure: BugPrimaryFailure;
  readonly title: string;
  readonly problem: string;
  readonly expected: ConfirmedDefectExpectedBasis;
  readonly observed: ConfirmedDefectObservation;
  readonly reproduction?: readonly string[];
  readonly reproductionProvenance?: BugReportV2ReproductionProvenance;
  readonly aiAnalysis?: string;
  readonly engineeringAnalysis?: string;
  readonly sourceEvidence?: readonly ConfirmedDefectSourceEvidence[];
  readonly suggestedFix?: string;
  readonly mustPreserve?: readonly string[];
  readonly brokenInvariantIds: readonly string[];
  readonly repairUnitIds: readonly string[];
  readonly causalIncidentId?: string;
  readonly causalIncidentIds?: readonly string[];
}

export function validateConfirmedDefect(
  defect: ConfirmedDefect,
): readonly string[] {
  const errors: string[] = [];

  if (defect.subjectIds.length === 0) {
    errors.push(
      "subjectIds must identify the affected semantic subject.",
    );
  }
  const derivedSemanticKey =
    deriveConfirmedDefectSemanticKey(defect);
  if (!defect.semanticKey.trim()) {
    errors.push("semanticKey must be non-empty.");
  } else if (defect.semanticKey !== derivedSemanticKey) {
    errors.push(
      "semanticKey must match the deterministic confirmed-defect identity.",
    );
  }
  if (!defect.title.trim()) {
    errors.push("title must be non-empty.");
  }
  if (!defect.problem.trim()) {
    errors.push("problem must be non-empty.");
  }
  if (!defect.expected.statement.trim()) {
    errors.push("expected.statement must be non-empty.");
  }
  if (defect.expected.evidenceIds.length === 0) {
    errors.push("expected.evidenceIds must contain authoritative evidence.");
  }
  if (!defect.observed.statement.trim()) {
    errors.push("observed.statement must be non-empty.");
  }
  if (defect.observed.evidenceIds.length === 0) {
    errors.push("observed.evidenceIds must contain defect evidence.");
  }
  if (
    defect.foundBy === "ai" &&
    (defect.sourceEvidence?.length ?? 0) === 0
  ) {
    errors.push(
      "AI-found defects must include verified sourceEvidence.",
    );
  }
  for (const item of defect.sourceEvidence ?? []) {
    for (const error of validateConfirmedDefectSourceRef(item.source)) {
      errors.push(
        "sourceEvidence: " + error,
      );
    }
    if (!item.reason.trim()) {
      errors.push(
        "sourceEvidence reason must be non-empty.",
      );
    }
    if (
      item.semanticOwnerId !== undefined &&
      !item.semanticOwnerId.trim()
    ) {
      errors.push(
        "sourceEvidence semanticOwnerId must be non-empty when present.",
      );
    }
  }
  if ((defect.sourceEvidence?.length ?? 0) > 3) {
    errors.push(
      "sourceEvidence must contain at most three primary locations.",
    );
  }
  if (defect.brokenInvariantIds.length === 0) {
    errors.push("brokenInvariantIds must identify the violated invariant.");
  }
  return errors;
}
