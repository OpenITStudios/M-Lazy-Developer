// Related source tests retained as complete lexical original blocks.
import { describe, expect, it } from "vitest";
import { projectBugReportClientDocument, reviewBugReportClientDocument, BUG_REPORT_V2_SCHEMA, BUG_REPORT_V2_LABELS, reviewBugReportCopy } from "../src/index.js";
import type { BugReportV2 } from "../src/index.js";

// Original engine/packages/bug-report/test/client-document.test.ts; blob aa0fe87abe4b0ab82d8cf0efbfb85637e90a312d
{
// Contract-preserving consolidated report test cases. Existing cases kept.

// Original suite engine/packages/bug-report/test/client-document.test.ts, blob 06d6ddafdbef92d028101345166185852360d7c2
{
function report(): BugReportV2 {
  return {
    schema: "m-bedrock-bug-report/v2",
    map: {
      name: "Attack Challenge",
      mapVersion: "1.1.1",
      drive: "https://drive.google.com/file/d/map/view",
      baseVersion: "1.26.20",
      testedVersion: "1.26.32",
    },
    repairBy: "developer",
    bugs: [
      {
        id: "BUG-AC-A",
        fixed: false,
        severity: "blocker",
        category: "game-flow",
        foundBy: "tester",
        title: "Level cannot continue",
        problem:
          "The level stops after the objective and players cannot continue.",
        expected:
          "The next phase starts after the objective is completed.",
        observed:
          "The current phase remains active and the next phase never starts.",
        reproduction: [
          "Start the affected level.",
          "Complete the objective.",
          "Confirm the next phase does not start.",
        ],
        suggestedFix:
          "Advance the level state after the objective is completed.",
      },
      {
        id: "BUG-AC-B",
        fixed: false,
        severity: "major",
        category: "player-state",
        foundBy: "ai",
        title: "Inventory remains after reset",
        problem:
          "Match inventory remains after reset and affects the next run.",
        expected:
          "Match inventory is cleared before the next run begins.",
        observed:
          "Items from the previous run remain in player inventory.",
        reproduction: [
          "Finish the run with a match item in inventory.",
          "Return to the lobby.",
          "Start a new run.",
          "Confirm the previous item remains in inventory.",
        ],
        aiAnalysis:
          "Reset does not clear the match-owned inventory state.",
        relevantCode: [{
          file: "scripts/reset.ts",
          reason: "Owns match inventory cleanup.",
        }],
      },
      {
        id: "BUG-AC-C",
        fixed: false,
        severity: "minor",
        category: "ui-feedback",
        foundBy: "tester",
        title: "Old message remained visible",
        problem: "An old feedback message remained visible.",
        expected: "The message clears after the interaction ends.",
        observed: "The old message remained visible.",
        reproduction: [
          "Trigger the feedback message.",
          "Leave the interaction.",
          "Confirm the message remains visible.",
        ],
      },
    ],
  };
}

describe("client bug report document projection", () => {
  it("can explicitly filter the client document to blocker and major open issues", () => {
    const document =
      projectBugReportClientDocument(report(), { includeMinor: false });

    expect(document.summary).toEqual(
      expect.objectContaining({
        visibleIssues: 2,
        openIssues: 2,
        blocker: 1,
        major: 1,
        minor: 0,
      }),
    );
    expect(document.severityLegend.map((item) => item.severity)).not.toContain("minor");
    expect(document.issues.map((item) => item.title))
      .toEqual([
        "Level cannot continue",
        "Inventory remains after reset",
      ]);
  });

  it("can intentionally include minor issues", () => {
    const document =
      projectBugReportClientDocument(report(), {
        includeMinor: true,
      });

    expect(document.summary.visibleIssues).toBe(3);
    expect(document.summary.minor).toBe(1);
    expect(document.severityLegend.map((item) => item.severity)).toContain("minor");
  });

  it("preserves reviewable technical context without exposing internal control fields", () => {
    const document =
      projectBugReportClientDocument(report());
    const serialized = JSON.stringify(document);

    expect(serialized).not.toContain("aiAnalysis");
    expect(document.issues[1]?.relevantCode).toMatchObject([{
      file: "scripts/reset.ts",
    }]);
    expect(serialized).not.toContain("foundBy");
    expect(serialized).not.toContain("repairBy");
    expect(document.issues[0]?.id).toBe("BUG-AC-A");
  });

  it("passes the client-document structural readability gate", () => {
    const document =
      projectBugReportClientDocument(report());

    expect(
      reviewBugReportClientDocument(document),
    ).toEqual([]);
  });
});
}

// Original suite engine/packages/bug-report/test/document-client-presentation.test.ts, blob 2c6f38efeabdfdf68606c14a5c3a9d4398f05bd7
{
describe("bug report client presentation", () => {
  it("projects canonical metadata and presentation-only checklists", () => {
    const report: BugReportV2 = {
      schema: BUG_REPORT_V2_SCHEMA,
      map: {
        name: "Audit Map",
        mapVersion: "1.0.0",
        drive: "https://drive.google.com/file/d/map/view",
        baseVersion: "1.0.0",
        testedVersion: "1.26.30",
      },
      repairBy: "developer",
      bugs: [{
        id: "BUG-AUD-1",
        fixed: false,
        severity: "major",
        category: "game-flow",
        foundBy: "ai",
        title: "Restricted action remains exposed",
        problem: "Ordinary players can trigger a restricted action.",
        expected: "Only authorized players can trigger the action.",
        observed: "The action can be triggered without authorization.",
        reproduction: [
          "Enter the affected gameplay area.",
          "Trigger the interaction as a normal player.",
        ],
        suggestedFix: "Require the existing authorization gate.",
        aiAnalysis: "Root Cause\nAuthorization is not enforced.",
        relevantCode: [{
          file: "scripts/action.ts",
          reason: "Owns the interaction path.",
        }],
        mustPreserve: [
          "Authorized developer workflow remains available.",
        ],
      }],
    };

    const document =
      projectBugReportClientDocument(report, {
        includeMinor: true,
      });

    expect(document.issues[0]).toMatchObject({
      id: "BUG-AUD-1",
      category: "game-flow",
      foundBy: "ai",
      workChecklist: [
        "Reproduce issue",
        "Apply or confirm fix",
        "Retest expected behavior",
        "Confirm no regression",
      ],
    });
    expect(
      document.issues[0]?.technicalAnalysis,
    ).toContain("Root Cause");
    expect(
      reviewBugReportClientDocument(document),
    ).toEqual([]);
  });
});
}

// Original suite engine/packages/bug-report/test/vocabulary.test.ts, blob 68a65b865517fa0be42a89e8c911608f008e1eef
{
describe("bug report v2 vocabulary", () => {
  it("keeps canonical frontend labels explicit and stable", () => {
    expect(BUG_REPORT_V2_LABELS).toMatchObject({
      mapVersion: "Map Version",
      drive: "Map Drive",
      baseVersion: "Base Version",
      testedVersion: "Tested Version",
      repairBy: "Repair By",
      bugs: "Bugs",
      fixed: "Fixed",
      severity: "Severity",
      foundBy: "Found By",
      aiAnalysis: "AI Analysis",
      suggestedFix: "Suggested Fix",
      mustPreserve: "Must Preserve",
    });
  });
});
}
}

// Original engine/packages/bug-report/test/client-document-layout.test.ts; blob 8de40922235f72783766834d72c9d4c6322fd9e6
{
function report(count: number): BugReportV2 {
  return {
    schema: "m-bedrock-bug-report/v2",
    map: {
      name: "Layout Map",
      mapVersion: "1.0.0",
      drive: "https://drive.google.com/file/d/map/view",
      baseVersion: "1.26.20",
      testedVersion: "1.26.32",
    },
    repairBy: "developer",
    bugs: Array.from({ length: count }, (_, index) => ({
      id: "BUG-LAYOUT-" + String(index + 1),
      fixed: false,
      severity:
        index === 0
          ? "blocker" as const
          : index % 2 === 0
            ? "minor" as const
            : "major" as const,
      category: "game-flow" as const,
      foundBy: "tester" as const,
      title: "Issue " + String(index + 1),
      problem:
        "Gameplay issue " + String(index + 1) + " affects the current run.",
      expected:
        "The gameplay step completes normally.",
      observed:
        "The gameplay step does not complete normally.",
      reproduction: [
        "Start the affected gameplay.",
        "Perform the affected action.",
        "Confirm the wrong result is visible.",
      ],
    })),
  };
}

describe("client document canonical issue projection", () => {
  it("projects a short report directly, without a duplicate issue index", () => {
    const document = projectBugReportClientDocument(report(3));
    expect(document.issues).toHaveLength(3);
    expect(document.summary.visibleIssues).toBe(3);
    expect(document.issues.map(issue => issue.number)).toEqual([1, 2, 3]);
    expect("issueIndex" in document).toBe(false);
  });

  it("preserves one numbered issue per source defect from four onward", () => {
    const document = projectBugReportClientDocument(report(4));
    expect(document.issues).toHaveLength(4);
    expect(document.issues.map(issue => issue.number)).toEqual([1, 2, 3, 4]);
    expect(new Set(document.issues.map(issue => issue.id)).size).toBe(4);
  });

  it("keeps large reports in one canonical ordered issue collection", () => {
    const document = projectBugReportClientDocument(report(7));
    expect(document.summary.visibleIssues).toBe(7);
    expect(document.issues).toHaveLength(7);
    expect(document.issues.map(issue => issue.number)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect("issueIndex" in document).toBe(false);
  });
});
}

// Original engine/packages/bug-report/test/copy-quality.test.ts; blob 99646a447abdd377c8e8acfb2cc59cf61f49e719
{
function report(): BugReportV2 {
  return {
    schema: BUG_REPORT_V2_SCHEMA,
    map: {
      name: "Map",
      mapVersion: "1.0.0",
      drive: "https://drive.google.com/file/d/map/view",
      baseVersion: "1.26.0",
      testedVersion: "1.26.0",
    },
    repairBy: "developer",
    bugs: [{
      id: "BUG-001",
      fixed: false,
      severity: "major",
      category: "game-flow",
      foundBy: "tester",
      title: "Gate remains closed after objective",
      problem: "The closed gate blocks progression to the next area.",
      expected: "The gate opens after the objective completes.",
      observed: "The gate remains closed after completion.",
      reproduction: [
        "Complete the objective.",
        "Walk to the gate.",
        "Confirm the gate remains closed and blocks progression.",
      ],
    }],
  };
}

describe("bug report copy quality", () => {
  it("accepts concise player-facing copy", () => {
    expect(reviewBugReportCopy(report().bugs)).toEqual([]);
  });

  it("rejects implementation language in Issue", () => {
    const source = report();
    const issues = reviewBugReportCopy([{
      ...source.bugs[0]!,
      problem:
        "A race condition in the event handler can prevent the gate transition.",
    }]);

    expect(
      issues.some(
        (issue) => issue.code === "technical-issue-copy",
      ),
    ).toBe(true);
  });

  it("rejects duplicated core copy", () => {
    const source = report();
    const bug = source.bugs[0]!;
    const issues = reviewBugReportCopy([{
      ...bug,
      observed: bug.expected,
    }]);

    expect(
      issues.some((issue) => issue.code === "duplicate-core-copy"),
    ).toBe(true);
  });

  it("rejects trigger paths without an observable final result", () => {
    const source = report();
    const issues = reviewBugReportCopy([{
      ...source.bugs[0]!,
      reproduction: [
        "Complete the objective.",
        "Walk to the gate.",
      ],
    }]);

    expect(
      issues.some(
        (issue) =>
          issue.code === "missing-observable-result",
      ),
    ).toBe(true);
  });

  it("uses one tester-step rule for empty, technical and vague instructions", () => {
    const initial = report().bugs[0]!;
    for (const step of [
      "",
      "Inspect the session script.",
      "Verify the logic.",
      "Confirm the bug is visible.",
    ]) {
      const issues = reviewBugReportCopy([{
        ...initial,
        reproduction: ["Join the arena with 2 players.", step],
      }]);
      expect(issues.some(issue => [
        "empty-reproduction-step", "code-centric-reproduction",
        "vague-reproduction",
      ].includes(issue.code)), step).toBe(true);
    }
  });

  it("rejects multiline titles", () => {
    const source = report();
    const issues = reviewBugReportCopy([{
      ...source.bugs[0]!,
      title: "Gate remains closed\nafter objective",
    }]);

    expect(
      issues.some((issue) => issue.code === "title-multiline"),
    ).toBe(true);
  });
});
}
