import { describe, expect, it } from "vitest";
import {
  reconcileCanonicalBugReport,
  type BugReportV2,
} from "../src/index.js";

function report(overrides: Partial<BugReportV2> = {}): BugReportV2 {
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
    bugs: [{
      id: "BUG-AC-AAAAAAA",
      fixed: false,
      severity: "major",
      category: "game-flow",
      foundBy: "tester",
      title: "Level cannot continue",
      problem: "The level cannot continue after the objective.",
      expected: "The next phase starts.",
      observed: "The level remains stuck.",
      reproduction: [
        "Start the affected level.",
        "Complete the objective.",
        "Confirm the next phase does not start.",
      ],
    }],
    ...overrides,
  };
}

describe("canonical current-version reconciliation", () => {
  it("preserves fixed state during generic refresh", () => {
    const existing = report({
      bugs: [{ ...report().bugs[0]!, fixed: true }],
    });
    const incoming = report({
      bugs: [{
        ...report().bugs[0]!,
        fixed: false,
        problem: "Updated description of the same defect.",
      }],
    });

    const result = reconcileCanonicalBugReport(existing, incoming);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.bugs[0]?.fixed).toBe(true);
    expect(result.report.bugs[0]?.problem)
      .toBe("Updated description of the same defect.");
  });

  it("starts newly discovered bugs as open", () => {
    const incoming = report({
      bugs: [
        report().bugs[0]!,
        {
          ...report().bugs[0]!,
          id: "BUG-AC-BBBBBBB",
          fixed: true,
          category: "player-state",
          title: "State remains",
        },
      ],
    });

    const result = reconcileCanonicalBugReport(report(), incoming);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.report.bugs.find((bug) => bug.id === "BUG-AC-BBBBBBB")?.fixed,
    ).toBe(false);
  });

  it("retains canonical bugs omitted by a refreshed audit", () => {
    const existing = report({
      bugs: [
        report().bugs[0]!,
        {
          ...report().bugs[0]!,
          id: "BUG-AC-BBBBBBB",
          category: "player-state",
          title: "State remains",
        },
      ],
    });

    const result = reconcileCanonicalBugReport(
      existing,
      report(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.bugs.map((bug) => bug.id).sort()).toEqual([
      "BUG-AC-AAAAAAA",
      "BUG-AC-BBBBBBB",
    ]);
  });

  it("rejects reconciliation across map versions", () => {
    const incoming = report({
      map: {
        ...report().map,
        mapVersion: "1.1.2",
      },
    });

    const result = reconcileCanonicalBugReport(report(), incoming);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map((issue) => issue.code))
      .toContain("map-version-mismatch");
  });

  it.each([
    ["Drive artifact URL", "drive", "https://drive.google.com/file/d/another-map/view", "source-artifact-mismatch"],
    ["base-version context", "baseVersion", "1.26.40", "base-version-mismatch"],
    ["tested-version or audit scope", "testedVersion", "Education 1.26.32 source review only", "test-scope-mismatch"],
  ] as const)("does not inherit repaired bugs across a changed %s", (_name, field, value, expectedCode) => {
    const existing = report({
      bugs: [{ ...report().bugs[0]!, fixed: true }],
    });
    const incoming = report({
      map: { ...report().map, [field]: value },
    });

    const result = reconcileCanonicalBugReport(existing, incoming);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map(issue => issue.code)).toContain(expectedCode);
  });

  it("rejects stable id reuse for a different category", () => {
    const incoming = report({
      bugs: [{
        ...report().bugs[0]!,
        category: "combat",
      }],
    });

    const result = reconcileCanonicalBugReport(report(), incoming);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map((issue) => issue.code))
      .toContain("bug-id-semantic-conflict");
  });
});
