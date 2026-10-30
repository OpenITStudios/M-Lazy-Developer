// Contract-preserving consolidated report test cases. Existing cases kept.
import { describe } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { projectBugReportClientDocument } from "../src/index.js";
import { reviewBugReportClientDocument } from "../src/index.js";
import { type BugReportV2 } from "../src/index.js";
import { BUG_REPORT_V2_SCHEMA } from "../src/index.js";
import { BUG_REPORT_V2_LABELS } from "../src/index.js";

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
