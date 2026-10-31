// Owner-local source consolidation. Original cases are preserved verbatim.
import { describe, expect, it, vi } from "vitest";
import { GitHubReportClient } from "../src/github-report-client.js";
import { filterBugReportBugs } from "../src/report-view.js";
import type { BugReportV2, BugReportV2Bug } from "../../../engine/packages/bug-report/src/index.js";

// Original apps/bug-report-ui/test/github-report-client.test.ts [43367dfdc8f2e4b9bbea77ea56a3acc7b69463da]
{
const report = {
  schema: "m-bedrock-bug-report/v2" as const,
  map: {
    name: "A",
    mapVersion: "1.0.0",
      drive: "https://drive.google.com/file/d/map/view",
    baseVersion: "1.26.20",
    testedVersion: "1.26.20",
  },
  repairBy: "developer" as const,
  bugs: [{
    id: "BUG-A-001",
    fixed: false,
    severity: "minor" as const,
    category: "ui-feedback" as const,
    issueType: "BUG" as const,
    foundBy: "tester" as const,
    title: "A",
    problem: "A",
    expected: "A",
    observed: "A",
  }],
};

describe("GitHubReportClient", () => {
  it("lists reports through the app backend", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({
        reports: [{
          path: "workspace/reports/a.json",
          mapName: "A",
          mapVersion: "1.0.0",
          fixed: 1,
          total: 2,
          blockers: 1,
        }],
      }), { status: 200 }),
    );
    const client = new GitHubReportClient({
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    await expect(client.listReports()).resolves.toEqual([{
      path: "workspace/reports/a.json",
      mapName: "A",
      mapVersion: "1.0.0",
      fixed: 1,
      total: 2,
      blockers: 1,
    }]);
  });

  it("loads a schema-valid canonical report for audit reading", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({
        report,
      }), { status: 200 }),
    );
    const client = new GitHubReportClient({
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    await expect(
      client.loadReport("workspace/reports/a.json"),
    ).resolves.toEqual(report);
  });


});
}

// Original apps/bug-report-ui/test/report-view.test.ts [78ae05bf0fddd18d3b4226df1dc3536ba30d2603]
{
function bug(
  index: number,
  options: {
    fixed?: boolean;
    severity?: "blocker" | "major" | "minor";
  } = {},
): BugReportV2Bug {
  return {
    id: "BUG-" + String(index).padStart(3, "0"),
    fixed: options.fixed ?? false,
    severity: options.severity ?? "major",
    category: "game-flow",
    foundBy: "ai",
    title: "Gameplay issue " + String(index),
    problem: "Problem " + String(index),
    expected: "Expected " + String(index),
    observed: "Observed " + String(index),
    reproduction: [
      "Enter arena " + String(index) + ".",
      "Confirm the gameplay issue is visible.",
    ],
    suggestedFix: "Reset the affected gameplay state.",
  };
}

function report(
  count: number,
  fixed: readonly number[] = [],
): BugReportV2 {
  return {
    schema: "m-bedrock-bug-report/v2",
    map: {
      name: "Scale Test",
      mapVersion: "1.0.0",
      drive: "https://drive.google.com/file/d/map/view",
      baseVersion: "1.26.20",
      testedVersion: "1.26.32",
    },
    repairBy: "developer",
    bugs: Array.from(
      { length: count },
      (_, index) =>
        bug(index + 1, {
          fixed: fixed.includes(index + 1),
          severity:
            index === 0
              ? "blocker"
              : index % 3 === 0
                ? "minor"
                : "major",
        }),
    ),
  };
}

describe("bug report view behavior", () => {
  it.each([5, 10, 24])(
    "keeps unfinished work focused for a %i-bug report",
    (count) => {
      const value = report(count, [2, 3]);
      const visible = filterBugReportBugs(
        value.bugs,
        {
          severity: "reportable",
          query: "",
        },
      );

      const expected = value.bugs.filter(
        (item) =>
          !item.fixed &&
          (item.severity === "blocker" || item.severity === "major"),
      );
      expect(visible.map((item) => item.id))
        .toEqual(expected.map((item) => item.id));
      expect(visible.some((item) => item.fixed)).toBe(false);
    },
  );

  it("can explicitly include Minor issues", () => {
    const value = report(5);
    const visible = filterBugReportBugs(
      value.bugs,
      {
        severity: "all",
        query: "",
      },
    );

    expect(
      visible.some((item) => item.severity === "minor"),
    ).toBe(true);
  });

  it("searches tester-facing trigger and solution copy", () => {
    const value = report(5);

    const byTrigger = filterBugReportBugs(
      value.bugs,
      {
        severity: "all",
        query: "arena 3",
      },
    );
    expect(byTrigger.map((item) => item.id)).toEqual([
      "BUG-003",
    ]);

    const bySolution = filterBugReportBugs(
      value.bugs,
      {
        severity: "all",
        query: "reset the affected gameplay state",
      },
    );
    expect(bySolution).toHaveLength(5);
  });

  it("combines state, severity, and search without changing report data", () => {
    const value = report(24, [2, 3, 4]);
    const visible = filterBugReportBugs(
      value.bugs,
      {
        severity: "blocker",
        query: "gameplay issue",
      },
    );

    expect(visible.map((item) => item.id)).toEqual([
      "BUG-001",
    ]);
    expect(value.bugs).toHaveLength(24);
  });
});
}
