import { reviewBugReportCopy } from "./copy-quality.js";
import {
  reviewBugReportReadiness,
  type BugReportReadinessIssueCode,
} from "./report-readiness.js";
import {
  createBugReportV2,
  type CreateBugReportV2BugInput,
} from "./create-v2.js";
import type {
  BugReportV2,
  BugReportV2Bug,
  BugReportV2Map,
  BugReportV2RepairBy,
} from "./v2.js";

export type ConfirmedBugStatus = "confirmed-defect";

export type DefectConfirmationBasis =
  | "tester-reproduction"
  | "authored-contract-violation"
  | "runtime-observation";

export interface DefectConfirmation {
  readonly basis: DefectConfirmationBasis;
  readonly evidence: string;
}

export interface ConfirmedBugReportInput
  extends Omit<CreateBugReportV2BugInput, "fixed"> {
  readonly status: ConfirmedBugStatus;
  readonly confirmation: DefectConfirmation;
}

export interface PromoteConfirmedBugsInput {
  readonly map: BugReportV2Map;
  readonly repairBy: BugReportV2RepairBy;
  readonly bugs: readonly ConfirmedBugReportInput[];
}

export type BugReportPromotionIssueCode =
  | "no-confirmed-bugs"
  | "missing-reproduction"
  | "ai-missing-analysis"
  | "ai-missing-relevant-code"
  | "suggested-fix-without-analysis"
  | "too-many-relevant-code-locations"
  | "duplicate-bug-id"
  | "invalid-confirmation"
  | "ai-unproven-defect"
  | "invalid-confirmed-defect"
  | "duplicate-semantic-key"
  | "unresolved-defect-group"
  | "invalid-defect-group-resolution"
  | "unused-defect-group-resolution"
  | "copy-quality";

export interface BugReportPromotionIssue {
  readonly code: BugReportPromotionIssueCode;
  readonly bugId?: string;
  readonly message: string;
}

export type PromoteConfirmedBugsResult =
  | {
      readonly ok: true;
      readonly report: BugReportV2;
      readonly issues: readonly [];
    }
  | {
      readonly ok: false;
      readonly issues: readonly BugReportPromotionIssue[];
    };

function toV2Bug(
  bug: ConfirmedBugReportInput,
): BugReportV2Bug {
  return {
    id: bug.id,
    fixed: false,
    severity: bug.severity,
    category: bug.category,
    foundBy: bug.foundBy,
    title: bug.title,
    problem: bug.problem,
    expected: bug.expected,
    observed: bug.observed,
    ...(bug.reproduction === undefined
      ? {}
      : { reproduction: bug.reproduction }),
    ...(bug.reproductionProvenance === undefined
      ? {}
      : { reproductionProvenance: bug.reproductionProvenance }),
    ...(bug.aiAnalysis === undefined
      ? {}
      : { aiAnalysis: bug.aiAnalysis }),
    ...(bug.relevantCode === undefined
      ? {}
      : { relevantCode: bug.relevantCode }),
    ...(bug.suggestedFix === undefined
      ? {}
      : { suggestedFix: bug.suggestedFix }),
    ...(bug.mustPreserve === undefined
      ? {}
      : { mustPreserve: bug.mustPreserve }),
  };
}

function readinessPromotionCode(
  code: BugReportReadinessIssueCode,
): BugReportPromotionIssueCode {
  if (code === "missing-bug-trigger") return "missing-reproduction";
  if (code === "solution-without-support") {
    return "suggested-fix-without-analysis";
  }
  return code;
}

export function reviewConfirmedBugInputs(
  bugs: readonly ConfirmedBugReportInput[],
): readonly BugReportPromotionIssue[] {
  const issues: BugReportPromotionIssue[] = [];
  const seenIds = new Set<string>();

  if (bugs.length === 0) {
    issues.push({
      code: "no-confirmed-bugs",
      message:
        "A canonical Bug Report V2 must contain at least one confirmed defect.",
    });
  }

  for (const bug of bugs) {
    if (seenIds.has(bug.id)) {
      issues.push({
        code: "duplicate-bug-id",
        bugId: bug.id,
        message: "Confirmed bug ids must be unique within one report.",
      });
    }
    seenIds.add(bug.id);

    if (!bug.confirmation.evidence.trim()) {
      issues.push({
        code: "invalid-confirmation",
        bugId: bug.id,
        message:
          "Confirmed defects require a concise evidence statement describing why the defect itself is established.",
      });
    }

    if (
      bug.foundBy === "ai" &&
      bug.confirmation.basis === "tester-reproduction"
    ) {
      issues.push({
        code: "ai-unproven-defect",
        bugId: bug.id,
        message:
          "AI-found defects require authored contract violation or runtime observation.",
      });
    }
  }

  const reportBugs = bugs.map(toV2Bug);

  const readinessIssues =
    reviewBugReportReadiness(reportBugs);
  for (const issue of readinessIssues) {
    const indexMatch =
      /^bugs\[(\d+)\]/.exec(issue.path);
    const bugId = indexMatch
      ? bugs[Number(indexMatch[1])]?.id
      : undefined;
    issues.push({
      code: readinessPromotionCode(issue.code),
      ...(bugId === undefined ? {} : { bugId }),
      message: issue.path + ": " + issue.message,
    });
  }

  const copyIssues = reviewBugReportCopy(reportBugs)
    .filter((issue) => issue.code !== "missing-reproduction");
  for (const issue of copyIssues) {
    issues.push({
      code: "copy-quality",
      message: issue.path + ": " + issue.message,
    });
  }

  return issues;
}

export function promoteConfirmedBugsToV2(
  input: PromoteConfirmedBugsInput,
): PromoteConfirmedBugsResult {
  const issues = reviewConfirmedBugInputs(input.bugs);
  if (issues.length > 0) {
    return {
      ok: false,
      issues,
    };
  }

  return {
    ok: true,
    report: createBugReportV2({
      map: input.map,
      repairBy: input.repairBy,
      bugs: input.bugs.map((bug) => {
        const { fixed: _fixed, ...draft } = toV2Bug(bug);
        return draft;
      }),
    }),
    issues: [],
  };
}
