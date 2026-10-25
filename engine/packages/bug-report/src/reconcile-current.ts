import { reviewBugReportCopy } from "./copy-quality.js";
import { reviewBugReportReadiness } from "./report-readiness.js";
import {
  parseBugReportV2,
  type BugReportV2,
  type BugReportV2Bug,
} from "./v2.js";

export type CanonicalReportReconcileIssueCode =
  | "map-name-mismatch"
  | "map-version-mismatch"
  | "source-artifact-mismatch"
  | "base-version-mismatch"
  | "test-scope-mismatch"
  | "bug-id-semantic-conflict";

export interface CanonicalReportReconcileIssue {
  readonly code: CanonicalReportReconcileIssueCode;
  readonly bugId?: string;
  readonly message: string;
}

export type ReconcileCanonicalBugReportResult =
  | {
      readonly ok: true;
      readonly report: BugReportV2;
      readonly issues: readonly [];
    }
  | {
      readonly ok: false;
      readonly issues: readonly CanonicalReportReconcileIssue[];
    };

function sameBugIdentityMeaning(
  existing: BugReportV2Bug,
  incoming: BugReportV2Bug,
): boolean {
  return (
    existing.id === incoming.id &&
    existing.category === incoming.category
  );
}

/**
 * Reconcile a refreshed current-version audit into canonical report state.
 *
 * Safety rules:
 * - never cross map/version, Drive artifact, base-version or tested-scope boundaries;
 * - incoming content may refresh descriptive fields;
 * - generic reconciliation never changes an existing bug's fixed state;
 * - newly discovered bugs always start fixed=false;
 * - bugs omitted by a refreshed audit are retained instead of silently deleted;
 * - the same stable bug ID cannot be reused for a different semantic category.
 *
 * Verified repair completion is intentionally outside this function.
 */
export function reconcileCanonicalBugReport(
  existing: BugReportV2,
  incoming: BugReportV2,
): ReconcileCanonicalBugReportResult {
  const issues: CanonicalReportReconcileIssue[] = [];

  if (existing.map.name !== incoming.map.name) {
    issues.push({
      code: "map-name-mismatch",
      message:
        "Canonical reconciliation cannot cross map identity boundaries.",
    });
  }

  if (existing.map.mapVersion !== incoming.map.mapVersion) {
    issues.push({
      code: "map-version-mismatch",
      message:
        "Canonical reconciliation is current-version scoped and cannot merge different map versions.",
    });
  }

  // A repeated report of the same named map/version may still describe
  // a different world file or tested environment. Preserve fixed state only
  // within the same exact recorded source and test context.
  if (existing.map.drive !== incoming.map.drive) {
    issues.push({
      code: "source-artifact-mismatch",
      message:
        "Canonical reconciliation cannot carry a previous report's fixed state to another selected Drive artifact.",
    });
  }
  if (existing.map.baseVersion !== incoming.map.baseVersion) {
    issues.push({
      code: "base-version-mismatch",
      message:
        "Canonical reconciliation cannot silently carry fixed state across different base-version contexts.",
    });
  }
  if (existing.map.testedVersion !== incoming.map.testedVersion) {
    issues.push({
      code: "test-scope-mismatch",
      message:
        "Canonical reconciliation cannot silently carry fixed state across different tested-version or audit-scope records.",
    });
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  const existingById = new Map(
    existing.bugs.map((bug) => [bug.id, bug] as const),
  );

  for (const bug of incoming.bugs) {
    const previous = existingById.get(bug.id);
    if (
      previous !== undefined &&
      !sameBugIdentityMeaning(previous, bug)
    ) {
      issues.push({
        code: "bug-id-semantic-conflict",
        bugId: bug.id,
        message:
          "Stable Bug ID cannot be reused for a different canonical bug category.",
      });
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  const incomingIds = new Set(incoming.bugs.map((bug) => bug.id));

  const refreshed = incoming.bugs.map((bug) => {
    const previous = existingById.get(bug.id);
    return {
      ...bug,
      fixed: previous?.fixed ?? false,
    };
  });

  const retained = existing.bugs.filter(
    (bug) => !incomingIds.has(bug.id),
  );

  const candidate: BugReportV2 = {
    schema: incoming.schema,
    map: incoming.map,
    repairBy: incoming.repairBy,
    bugs: [
      ...refreshed,
      ...retained,
    ],
  };

  const parsed = parseBugReportV2(candidate);
  if (!parsed.ok) {
    return {
      ok: false,
      issues: [{
        code: "bug-id-semantic-conflict",
        message:
          "Reconciled canonical report failed V2 validation: " +
          parsed.issues
            .map((issue) => issue.path + ": " + issue.message)
            .join("; "),
      }],
    };
  }

  const readiness = reviewBugReportReadiness(parsed.report.bugs);
  const copy = reviewBugReportCopy(parsed.report.bugs);
  if (readiness.length > 0 || copy.length > 0) {
    return {
      ok: false,
      issues: [{
        code: "bug-id-semantic-conflict",
        message:
          "Reconciled canonical report failed report-quality validation.",
      }],
    };
  }

  return {
    ok: true,
    report: parsed.report,
    issues: [],
  };
}
