import type {
  CrossDomainHypothesisAssessment,
  FindingReportProjection,
  MinimalProbeRecommendation,
} from "../../../diagnostic-reasoning/src/index.js";
import type { AuditIssueProjection } from "../map-audit-issue-projection.js";
import type { MapAuditOutputV2FindingReasoning } from "../map-audit-output-v2.js";
import { projectMapAuditFindingReasoning } from "./map-audit-finding-reasoning.js";

export interface MapAuditFindingReasoningCandidate {
  causalLinkId: string;
  projection: FindingReportProjection;
  assessment: CrossDomainHypothesisAssessment;
  probe?: MinimalProbeRecommendation;
  /** Exact source IDs owned by each derived observation, supplied by its producer. */
  evidenceOriginsById?: ReadonlyMap<string, readonly string[]>;
}

export interface MapAuditFindingReasoningAdmission {
  admitted: Readonly<Record<string, MapAuditOutputV2FindingReasoning>>;
  rejected: readonly {
    causalLinkId: string;
    reasons: readonly string[];
  }[];
}

export function admitMapAuditFindingReasoning(
  findings: readonly AuditIssueProjection[],
  candidates: readonly MapAuditFindingReasoningCandidate[],
): MapAuditFindingReasoningAdmission {
  const findingsById = new Map(
    findings.map((finding) => [finding.causalLinkId, finding] as const),
  );
  const admitted: Record<string, MapAuditOutputV2FindingReasoning> = {};
  const rejected: { causalLinkId: string; reasons: string[] }[] = [];

  for (const candidate of candidates) {
    const reasons: string[] = [];
    const finding = findingsById.get(candidate.causalLinkId);
    if (!finding) {
      reasons.push("No audit finding owns this causalLinkId.");
    }
    if (
      candidate.assessment.supportingEvidenceIds.length === 0 &&
      candidate.assessment.eliminatingEvidenceIds.length === 0
    ) {
      reasons.push("Reasoning requires at least one concrete evidence id.");
    }
    if (finding) {
      const findingEvidence = new Set(finding.evidenceIds);
      const reasoningEvidence = [
        ...candidate.assessment.supportingEvidenceIds,
        ...candidate.assessment.eliminatingEvidenceIds,
      ];
      if (!reasoningEvidence.some((id) =>
        findingEvidence.has(id) ||
        candidate.evidenceOriginsById?.get(id)?.some(
          (sourceId) => findingEvidence.has(sourceId)) === true
      )) {
        reasons.push("Reasoning evidence does not intersect the owning audit finding.");
      }
      if (
        finding.status === "NEED_VALIDATION" &&
        candidate.projection.reportClassification === "PROVEN BUG"
      ) {
        reasons.push(
          "A NEED_VALIDATION audit finding cannot attach PROVEN BUG reasoning.",
        );
      }
      if (
        finding.status === "NEED_VALIDATION" &&
        candidate.assessment.confidence === "proven"
      ) {
        reasons.push(
          "A NEED_VALIDATION audit finding cannot attach proven reasoning confidence.",
        );
      }
      if (
        finding.status === "PROVEN" &&
        candidate.projection.reportClassification === "UNKNOWN"
      ) {
        reasons.push("A PROVEN audit finding cannot attach UNKNOWN report reasoning.");
      }
      if (finding.status === "PROVEN") {
        const expectedClassification = finding.issueType === "DESIGN_MISMATCH"
          ? "DESIGN MISMATCH"
          : "PROVEN BUG";
        if (candidate.assessment.disposition !== "supported") {
          reasons.push(
            "A PROVEN audit finding requires a supported canonical hypothesis assessment.",
          );
        }
        if (
          candidate.assessment.nextPredicate !== undefined ||
          candidate.assessment.missingRequiredPredicates.length > 0
        ) {
          reasons.push(
            "A PROVEN audit finding cannot retain an unresolved required predicate.",
          );
        }
        if (
          candidate.projection.reportClassification !== expectedClassification
        ) {
          reasons.push(
            "A PROVEN " + finding.issueType +
            " audit finding requires " + expectedClassification +
            " reasoning classification.",
          );
        }
      }
    }

    if (reasons.length > 0) {
      rejected.push({
        causalLinkId: candidate.causalLinkId,
        reasons,
      });
      continue;
    }

    // Keep the existing observation-ID chain stable for monotonicity checks.
    // Provenance is consulted only for admission and never upgrades proof.
    admitted[candidate.causalLinkId] =
      projectMapAuditFindingReasoning(candidate);
  }

  return { admitted, rejected };
}
