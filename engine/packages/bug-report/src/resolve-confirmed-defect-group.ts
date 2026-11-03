import {
  assessConfirmedDefectGrouping,
  decideBugGrouping,
  type ConfirmedDefectGroup,
} from "./grouping.js";
import type {
  BugImpactAssessment,
  BugPrimaryFailure,
} from "./decision.js";
import {
  deriveConfirmedDefectSemanticKey,
  type ConfirmedDefect,
  type ConfirmedDefectExpectedBasis,
  type ConfirmedDefectObservation,
  type ConfirmedDefectSourceEvidence,
} from "./confirmed-defect.js";
import type {
  DefectConfirmationBasis,
} from "./promote-v2.js";
import type {
  ExpectedBehaviorAuthority,
} from "./confirmation-v2.js";

export interface CanonicalDefectNarrative {
  readonly title: string;
  readonly problem: string;
  readonly expected: Pick<
    ConfirmedDefectExpectedBasis,
    "statement"
  >;
  readonly observed: Pick<
    ConfirmedDefectObservation,
    "statement"
  >;
  readonly expectedAuthority: ExpectedBehaviorAuthority;
  readonly foundBy?: ConfirmedDefect["foundBy"];
  readonly primaryFailure: BugPrimaryFailure;
  readonly reproduction?: readonly string[];
  readonly aiAnalysis?: string;
  readonly sourceEvidence?: readonly ConfirmedDefectSourceEvidence[];
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function maxByRank<T extends string>(
  values: readonly T[],
  rank: Readonly<Record<T, number>>,
): T {
  return [...values].sort((a, b) => rank[b] - rank[a])[0]!;
}

function mergeImpact(
  defects: readonly ConfirmedDefect[],
): BugImpactAssessment {
  return {
    progression: maxByRank(
      defects.map((item) => item.impact.progression),
      {
        unaffected: 0,
        degraded: 1,
        blocked: 2,
      },
    ),
    recovery: maxByRank(
      defects.map((item) => item.impact.recovery),
      {
        normal: 0,
        abnormal: 1,
        none: 2,
      },
    ),
    stability: maxByRank(
      defects.map((item) => item.impact.stability),
      {
        stable: 0,
        "crash-or-freeze": 1,
      },
    ),
    coreMechanic: maxByRank(
      defects.map((item) => item.impact.coreMechanic),
      {
        correct: 0,
        "materially-wrong": 1,
      },
    ),
    importantState: maxByRank(
      defects.map((item) => item.impact.importantState),
      {
        correct: 0,
        "materially-wrong": 1,
      },
    ),
    fairness: maxByRank(
      defects.map((item) => item.impact.fairness),
      {
        unaffected: 0,
        "materially-affected": 1,
      },
    ),
  };
}

function canonicalFoundBy(
  defects: readonly ConfirmedDefect[],
  narrative: CanonicalDefectNarrative,
): ConfirmedDefect["foundBy"] {
  const origins = [
    ...new Set(
      defects.map((item) => item.foundBy),
    ),
  ].sort() as ConfirmedDefect["foundBy"][];

  if (origins.length === 1) {
    return origins[0]!;
  }

  if (narrative.foundBy === undefined) {
    throw new Error(
      "Mixed-origin canonical groups require explicit foundBy based on the earliest documented discovery.",
    );
  }

  if (!origins.includes(narrative.foundBy)) {
    throw new Error(
      "Canonical foundBy must be represented by the grouped defects.",
    );
  }

  return narrative.foundBy;
}

function canonicalConfirmationBasis(
  defects: readonly ConfirmedDefect[],
): DefectConfirmationBasis {
  const bases = defects.map((item) => item.confirmation.basis);
  if (bases.includes("runtime-observation")) {
    return "runtime-observation";
  }
  if (bases.includes("authored-contract-violation")) {
    return "authored-contract-violation";
  }
  return "tester-reproduction";
}

function sourceEvidenceKey(
  item: ConfirmedDefectSourceEvidence,
): string {
  return [
    item.source.artifactId,
    item.source.relativePath,
    item.source.range?.lineStart ?? "",
    item.source.range?.lineEnd ?? "",
    item.source.range?.columnStart ?? "",
    item.source.range?.columnEnd ?? "",
    item.source.jsonPointer ?? "",
    item.reason,
  ].join("|");
}

function uniqueSourceEvidence(
  defects: readonly ConfirmedDefect[],
): readonly ConfirmedDefectSourceEvidence[] {
  const values = defects.flatMap(
    (item) => item.sourceEvidence ?? [],
  );
  const seen = new Set<string>();
  return values.filter((item) => {
    const key = sourceEvidenceKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sharedSuggestedFix(
  defects: readonly ConfirmedDefect[],
): string | undefined {
  const values = defects.map((item) =>
    item.suggestedFix?.trim()
  );

  if (
    values.some((value) => !value) ||
    values.length === 0
  ) {
    return undefined;
  }

  const uniqueValues = unique(
    values as readonly string[],
  );
  return uniqueValues.length === 1
    ? uniqueValues[0]
    : undefined;
}

function canonicalSourceEvidence(
  defects: readonly ConfirmedDefect[],
  narrative: CanonicalDefectNarrative,
): readonly ConfirmedDefectSourceEvidence[] {
  const available = uniqueSourceEvidence(defects);
  const selected = narrative.sourceEvidence;

  if (selected === undefined) {
    if (available.length > 3) {
      throw new Error(
        "Canonical group has more than three source locations; select primary sourceEvidence explicitly.",
      );
    }
    return available;
  }

  if (selected.length > 3) {
    throw new Error(
      "Canonical sourceEvidence must contain at most three primary locations.",
    );
  }

  const availableKeys = new Set(
    available.map(sourceEvidenceKey),
  );
  for (const item of selected) {
    if (!availableKeys.has(sourceEvidenceKey(item))) {
      throw new Error(
        "Canonical sourceEvidence must be selected from grouped defect evidence.",
      );
    }
  }
  return selected;
}

export function resolveConfirmedDefectGroup(
  group: ConfirmedDefectGroup,
  narrative: CanonicalDefectNarrative,
): ConfirmedDefect {
  if (group.defects.length < 2) {
    throw new Error(
      "Canonical group resolution requires at least two defects.",
    );
  }

  const [first, ...rest] = group.defects;
  if (!first) {
    throw new Error("Confirmed defect group is empty.");
  }

  for (const item of rest) {
    if (
      decideBugGrouping(
        assessConfirmedDefectGrouping(first, item),
      ) !== "merge"
    ) {
      throw new Error(
        "Confirmed defect group contains semantically incompatible defects.",
      );
    }
  }

  const primaryFailures = unique(
    group.defects.map((item) => item.primaryFailure),
  );
  if (primaryFailures.length !== 1) {
    throw new Error(
      "Canonical group contains multiple primary failures and must be split before report projection.",
    );
  }
  if (narrative.primaryFailure !== primaryFailures[0]) {
    throw new Error(
      "Canonical primaryFailure must match the grouped defect primaryFailure.",
    );
  }

  const expectedAuthorities = unique(
    group.defects.map((item) => item.expected.authority),
  );
  if (
    !expectedAuthorities.includes(
      narrative.expectedAuthority,
    )
  ) {
    throw new Error(
      "Canonical expectedAuthority must be represented by the grouped defects.",
    );
  }

  const foundBy = canonicalFoundBy(
    group.defects,
    narrative,
  );
  if (
    foundBy === "tester" &&
    (narrative.reproduction?.length ?? 0) === 0
  ) {
    throw new Error(
      "Tester-origin canonical defects require explicit canonical reproduction steps.",
    );
  }

  const sourceEvidence = canonicalSourceEvidence(
    group.defects,
    narrative,
  );
  const mustPreserve = unique(
    group.defects.flatMap((item) =>
      item.mustPreserve ?? []
    ),
  );
  const confirmationEvidence = unique(
    group.defects.map((item) =>
      item.confirmation.evidence
    ),
  ).join(" | ");
  const suggestedFix =
    sharedSuggestedFix(group.defects);

  const subjectIds = unique(
    group.defects.flatMap((item) =>
      item.subjectIds
    ),
  );
  const brokenInvariantIds = unique(
    group.defects.flatMap((item) =>
      item.brokenInvariantIds
    ),
  );
  const repairUnitIds = unique(
    group.defects.flatMap((item) =>
      item.repairUnitIds
    ),
  );
  const causalIncidentId =
    first.causalIncidentId;
  const semanticKey =
    deriveConfirmedDefectSemanticKey({
      subjectIds,
      brokenInvariantIds,
      primaryFailure: narrative.primaryFailure,
      ...(causalIncidentId === undefined
        ? {}
        : { causalIncidentId }),
    });

  // A consolidated issue may choose newly authored reproduction steps.
  // Never borrow step-specific proof from a different trigger or origin.
  const matching = narrative.reproduction === undefined ? [] :
    group.defects.filter((item) =>
      item.foundBy === foundBy &&
      item.expected.authority === narrative.expectedAuthority &&
      item.reproductionProvenance !== undefined &&
      Array.isArray(item.reproduction) &&
      item.reproduction.length === narrative.reproduction!.length &&
      item.reproduction.every((step, index) =>
        step === narrative.reproduction![index]));
  const distinctProvenance = new Set(matching.map((item) =>
    JSON.stringify(item.reproductionProvenance)));
  const reproductionProvenance = distinctProvenance.size === 1
    ? matching[0]!.reproductionProvenance : undefined;

  return {
    semanticKey,
    subjectIds,
    foundBy,
    confirmation: {
      basis: canonicalConfirmationBasis(group.defects),
      evidence: confirmationEvidence,
    },
    impact: mergeImpact(group.defects),
    primaryFailure: narrative.primaryFailure,
    title: narrative.title,
    problem: narrative.problem,
    expected: {
      authority: narrative.expectedAuthority,
      statement: narrative.expected.statement,
      evidenceIds: unique(
        group.defects
          .filter((item) =>
            item.expected.authority ===
            narrative.expectedAuthority
          )
          .flatMap((item) =>
            item.expected.evidenceIds
          ),
      ),
    },
    observed: {
      statement: narrative.observed.statement,
      evidenceIds: unique(
        group.defects.flatMap((item) =>
          item.observed.evidenceIds
        ),
      ),
    },
    ...(narrative.reproduction === undefined
      ? {}
      : {
          reproduction: [...narrative.reproduction],
        }),
    ...(reproductionProvenance === undefined
      ? {}
      : { reproductionProvenance }),
    ...(narrative.aiAnalysis === undefined
      ? {}
      : { aiAnalysis: narrative.aiAnalysis }),
    ...(sourceEvidence.length === 0
      ? {}
      : { sourceEvidence }),
    ...(suggestedFix === undefined
      ? {}
      : { suggestedFix }),
    ...(mustPreserve.length === 0
      ? {}
      : { mustPreserve }),
    brokenInvariantIds,
    repairUnitIds,
    ...(causalIncidentId === undefined
      ? {}
      : { causalIncidentId }),
  };
}


export interface ConfirmedDefectGroupResolution {
  readonly groupKey: string;
  readonly narrative: CanonicalDefectNarrative;
}

export interface ResolveConfirmedDefectGroupsResult {
  readonly defects: readonly ConfirmedDefect[];
  readonly unresolvedGroupKeys: readonly string[];
  readonly unusedResolutionKeys: readonly string[];
}

export function resolveConfirmedDefectGroups(
  groups: readonly ConfirmedDefectGroup[],
  resolutions:
    readonly ConfirmedDefectGroupResolution[],
): ResolveConfirmedDefectGroupsResult {
  const byKey = new Map<string, ConfirmedDefectGroupResolution>();

  for (const resolution of resolutions) {
    if (byKey.has(resolution.groupKey)) {
      throw new Error(
        "Duplicate canonical group resolution: " +
          resolution.groupKey +
          ".",
      );
    }
    byKey.set(resolution.groupKey, resolution);
  }

  const defects: ConfirmedDefect[] = [];
  const unresolvedGroupKeys: string[] = [];
  const used = new Set<string>();

  for (const group of groups) {
    if (group.defects.length === 1) {
      defects.push(group.defects[0]!);
      continue;
    }

    const resolution = byKey.get(group.key);
    if (!resolution) {
      unresolvedGroupKeys.push(group.key);
      continue;
    }

    used.add(group.key);
    defects.push(
      resolveConfirmedDefectGroup(
        group,
        resolution.narrative,
      ),
    );
  }

  const unusedResolutionKeys = [...byKey.keys()]
    .filter((key) => !used.has(key))
    .sort();

  return {
    defects: defects.sort((a, b) =>
      a.semanticKey.localeCompare(b.semanticKey)
    ),
    unresolvedGroupKeys:
      unresolvedGroupKeys.sort(),
    unusedResolutionKeys,
  };
}
