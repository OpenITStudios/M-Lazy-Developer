import type {
  AuditReportCandidate,
  RejectedReportCandidate,
  ReportCandidateNextEvidenceNeed,
} from "./report-defect-collector.js";
import {
  describeAuditReportCandidate,
} from "./report-defect-collector.js";

const REUSABLE_WITH_UNCHANGED_EVIDENCE = new Set<
  ReportCandidateNextEvidenceNeed
>([
  "intent-grounding",
  "contradiction-proof",
  "runtime-proof",
  "runtime-evidence-integrity",
  "expected-behavior-evidence",
]);

/**
 * Reuse is bound to an exact candidate identity, not only its semantic
 * category. JSON tuple encoding avoids delimiter ambiguity in source IDs.
 */
function reuseIdentity(
  item: Pick<RejectedReportCandidate, "route" | "semanticKey" | "evidenceIds">,
): string {
  return JSON.stringify([
    item.route,
    item.semanticKey,
    [...new Set(item.evidenceIds)].sort(),
  ]);
}

export interface ReportCandidateReusePlan {
  readonly reevaluate: readonly AuditReportCandidate[];
  readonly reusedRejected:
    readonly RejectedReportCandidate[];
}

export function planReportCandidateReuse(
  candidates: readonly AuditReportCandidate[],
  previousRejected:
    readonly RejectedReportCandidate[],
): ReportCandidateReusePlan {
  const previous = new Map<string, RejectedReportCandidate[]>();
  for (const item of previousRejected) {
    const key = reuseIdentity(item);
    previous.set(key, [...(previous.get(key) ?? []), item]);
  }

  const reevaluate: AuditReportCandidate[] = [];
  const reusedRejected: RejectedReportCandidate[] = [];

  for (const candidate of candidates) {
    const descriptor =
      describeAuditReportCandidate(candidate);
    const matches = previous.get(reuseIdentity(descriptor)) ?? [];

    // Conflicting historical rows for the same exact identity must not
    // choose an arbitrary rejection and silence a current investigation.
    if (
      matches.length === 1 &&
      REUSABLE_WITH_UNCHANGED_EVIDENCE.has(
        matches[0]!.nextEvidenceNeed,
      )
    ) {
      reusedRejected.push(matches[0]!);
      continue;
    }

    reevaluate.push(candidate);
  }

  return {
    reevaluate,
    reusedRejected,
  };
}


export interface AuditBoundRejectedCandidate {
  readonly auditRevision: string;
  readonly rejected: RejectedReportCandidate;
}

export interface AuditBoundReportCandidateReusePlan {
  readonly auditRevision: string;
  readonly reevaluate: readonly AuditReportCandidate[];
  readonly reusedRejected:
    readonly AuditBoundRejectedCandidate[];
}

export function planAuditBoundReportCandidateReuse(
  input: {
    readonly auditRevision: string;
    readonly candidates: readonly AuditReportCandidate[];
    readonly previousRejected:
      readonly AuditBoundRejectedCandidate[];
  },
): AuditBoundReportCandidateReusePlan {
  if (!input.auditRevision.trim()) {
    throw new Error(
      "Audit-bound candidate reuse requires a non-empty auditRevision.",
    );
  }

  const sameRevision = input.previousRejected
    .filter(
      (item) =>
        item.auditRevision === input.auditRevision,
    );
  const plan = planReportCandidateReuse(
    input.candidates,
    sameRevision.map((item) => item.rejected),
  );
  // The bound plan must return only the exact rejected objects that
  // passed the evidence-set check. Semantic-key-only filtering reattached
  // unrelated previous evidence to a newly changed candidate.
  const reusedReferences = new Set(plan.reusedRejected);

  return {
    auditRevision: input.auditRevision,
    reevaluate: plan.reevaluate,
    reusedRejected: sameRevision
      .filter((item) =>
        reusedReferences.has(item.rejected)
      ),
  };
}

export function bindRejectedCandidatesToAuditRevision(
  auditRevision: string,
  rejected: readonly RejectedReportCandidate[],
): readonly AuditBoundRejectedCandidate[] {
  if (!auditRevision.trim()) {
    throw new Error(
      "Rejected candidate binding requires a non-empty auditRevision.",
    );
  }
  return rejected.map((item) => ({
    auditRevision,
    rejected: item,
  }));
}
