import {
  assessDiagnosticHypotheses,
} from "./evaluate.js";
import type {
  DiagnosticEvidenceObservation,
  DiagnosticHypothesisSet,
  HypothesisAssessment,
} from "./types.js";

export type DiagnosticEvidenceDomain =
  | "static"
  | "runtime"
  | "knowledge"
  | "historical"
  | "intent";

export interface CrossDomainEvidenceObservation
  extends DiagnosticEvidenceObservation {
  domain: DiagnosticEvidenceDomain;
}

export type CrossDomainConfidence =
  | "unknown"
  | "low"
  | "medium"
  | "high"
  | "proven";

export interface CrossDomainHypothesisAssessment
  extends HypothesisAssessment {
  domains: readonly DiagnosticEvidenceDomain[];
  corroborationCount: number;
  confidence: CrossDomainConfidence;
  nextPredicate?: string;
}

function confidence(
  assessment: HypothesisAssessment,
  domains: readonly DiagnosticEvidenceDomain[],
): CrossDomainConfidence {
  if (assessment.disposition === "eliminated") return "proven";
  if (assessment.disposition === "open") {
    return assessment.supportingEvidenceIds.length > 0 ? "low" : "unknown";
  }

  const independent = new Set(domains).size;

  if (
    assessment.disposition === "supported" &&
    assessment.missingRequiredPredicates.length === 0
  ) {
    return "proven";
  }
  if (independent >= 3) return "high";
  if (independent >= 2) return "medium";
  return "low";
}

export function assessCrossDomainHypotheses(
  set: DiagnosticHypothesisSet,
  evidence: readonly CrossDomainEvidenceObservation[],
): CrossDomainHypothesisAssessment[] {
  const base = assessDiagnosticHypotheses(set, evidence);
  const byEvidenceId = new Map<string, CrossDomainEvidenceObservation>();
  const ambiguousEvidenceIds = new Set<string>();
  for (const item of evidence) {
    const id = item.evidenceId ??
      "predicate:" + item.predicate + ":" + item.state;
    const previous = byEvidenceId.get(id);
    if (previous !== undefined &&
        (previous.domain !== item.domain ||
         previous.predicate !== item.predicate ||
         previous.state !== item.state)) ambiguousEvidenceIds.add(id);
    else if (previous === undefined) byEvidenceId.set(id, item);
  }

  return base.map((assessment) => {
    const relevantIds = [
      ...assessment.supportingEvidenceIds,
      ...assessment.eliminatingEvidenceIds,
    ];
    const domains = [...new Set(
      relevantIds
        .map((id) => ambiguousEvidenceIds.has(id)
          ? undefined : byEvidenceId.get(id)?.domain)
        .filter((value): value is DiagnosticEvidenceDomain => value !== undefined),
    )].sort();

    return {
      ...assessment,
      domains,
      corroborationCount: domains.length,
      confidence: confidence(assessment, domains),
      ...(assessment.missingRequiredPredicates[0]
        ? { nextPredicate: assessment.missingRequiredPredicates[0] }
        : {}),
    };
  });
}

export function rankCrossDomainHypotheses(
  assessments: readonly CrossDomainHypothesisAssessment[],
): CrossDomainHypothesisAssessment[] {
  const rank: Record<CrossDomainConfidence, number> = {
    proven: 4,
    high: 3,
    medium: 2,
    low: 1,
    unknown: 0,
  };
  return [...assessments].sort((a, b) =>
    rank[b.confidence] - rank[a.confidence] ||
    b.corroborationCount - a.corroborationCount ||
    a.missingRequiredPredicates.length - b.missingRequiredPredicates.length ||
    a.hypothesisId.localeCompare(b.hypothesisId)
  );
}
