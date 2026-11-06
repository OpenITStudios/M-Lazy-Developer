import type {
  DiagnosticEvidenceObservation,
  DiagnosticHypothesis,
  DiagnosticHypothesisSet,
  HypothesisAssessment,
} from "./types.js";

/** Evidence observations have no version or timestamp. Never infer that
 * the last input row supersedes an earlier row for the same predicate. */
function groupEvidenceByPredicate(
  evidence: readonly DiagnosticEvidenceObservation[],
): ReadonlyMap<string, readonly DiagnosticEvidenceObservation[]> {
  const map = new Map<string, DiagnosticEvidenceObservation[]>();
  for (const item of evidence) {
    const group = map.get(item.predicate) ?? [];
    group.push(item);
    map.set(item.predicate, group);
  }
  return map;
}

function evidenceId(
  item: DiagnosticEvidenceObservation,
): string {
  return item.evidenceId ??
    "predicate:" +
      item.predicate +
      ":" +
      item.state;
}

function assessOne(
  hypothesis: DiagnosticHypothesis,
  byPredicate: ReadonlyMap<
    string,
    readonly DiagnosticEvidenceObservation[]
  >,
): HypothesisAssessment {
  const supportingEvidenceIds: string[] = [];
  const eliminatingEvidenceIds: string[] = [];
  const missingRequiredPredicates: string[] = [];
  const reasons: string[] = [];
  const conflicts = new Set<string>();
  const observed = (predicate: string) => {
    const group = byPredicate.get(predicate) ?? [];
    const states = new Set(group.map((item) => item.state));
    if (states.size > 1) {
      if (!conflicts.has(predicate)) {
        reasons.push(
          "Conflicting observations for " + predicate +
          "; source scope and evidence identity remain unresolved.",
        );
        conflicts.add(predicate);
      }
      return { state: "unknown" as const, ids: [], conflicting: true };
    }
    return {
      state: group[0]?.state ?? "unknown" as const,
      ids: [...new Set(group.map(evidenceId))].sort(),
      conflicting: false,
    };
  };

  for (const predicate of hypothesis.falsifierPredicates ?? []) {
    const observation = observed(predicate);
    if (observation.conflicting) {
      // An ambiguous falsifier cannot be dismissed merely because the
      // hypothesis's positive predicates happen to be complete.
      missingRequiredPredicates.push(predicate);
    } else if (observation.state === "present") {
      eliminatingEvidenceIds.push(...observation.ids);
      reasons.push("Falsifier observed: " + predicate + ".");
    }
  }

  for (const predicate of hypothesis.requiredPredicates ?? []) {
    const observation = observed(predicate);
    if (observation.state === "unknown") {
      missingRequiredPredicates.push(predicate);
    } else if (observation.state === "absent") {
      eliminatingEvidenceIds.push(...observation.ids);
      reasons.push("Required predicate is absent: " + predicate + ".");
    } else {
      supportingEvidenceIds.push(...observation.ids);
    }
  }

  for (const predicate of hypothesis.supportingPredicates ?? []) {
    const observation = observed(predicate);
    if (observation.state === "present") {
      supportingEvidenceIds.push(...observation.ids);
    }
  }

  const missing = [...new Set(missingRequiredPredicates)];

  if (eliminatingEvidenceIds.length > 0) {
    return {
      hypothesisId: hypothesis.id,
      disposition: "eliminated",
      supportingEvidenceIds,
      eliminatingEvidenceIds,
      missingRequiredPredicates: missing,
      reasons,
    };
  }

  const requiredComplete =
    missing.length === 0;
  const hasRequired =
    (hypothesis.requiredPredicates?.length ??
      0) > 0;
  const hasSupport =
    supportingEvidenceIds.length > 0;

  return {
    hypothesisId: hypothesis.id,
    disposition:
      requiredComplete &&
      (hasRequired || hasSupport)
        ? "supported"
        : "open",
    supportingEvidenceIds,
    eliminatingEvidenceIds,
    missingRequiredPredicates: missing,
    reasons: [
      ...reasons,
      ...(requiredComplete &&
      (hasRequired || hasSupport)
        ? [
            "Observed evidence satisfies the declared support contract.",
          ]
        : [
            "The hypothesis remains open because evidence is incomplete or non-discriminating.",
          ]),
    ],
  };
}

export function assessDiagnosticHypotheses(
  set: DiagnosticHypothesisSet,
  evidence: readonly DiagnosticEvidenceObservation[],
): HypothesisAssessment[] {
  const byPredicate = groupEvidenceByPredicate(evidence);
  return set.hypotheses.map((hypothesis) =>
    assessOne(hypothesis, byPredicate)
  );
}
