// Contract-preserving consolidated report test cases. Existing cases kept.
import { readFileSync } from "node:fs";
import { describe } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { BUG_FINDER_CATEGORIES } from "../src/index.js";
import { BUG_REPORT_V2_FOUND_BY_VALUES } from "../src/index.js";
import { BUG_REPORT_V2_ISSUE_TYPES } from "../src/index.js";
import { BUG_REPORT_V2_REPAIR_BY_VALUES } from "../src/index.js";
import { BUG_SEVERITIES } from "../src/index.js";
import { BUG_REPORT_V2_SCHEMA } from "../src/index.js";
import { bugReportV2Progress } from "../src/index.js";
import { parseBugReportV2Json } from "../src/index.js";
import { serializeBugReportV2 } from "../src/index.js";
import { type BugReportV2 } from "../src/index.js";

// Original suite engine/packages/bug-report/test/schema-runtime-parity.test.ts, blob f685b14a4f4120faf86187296bac384cf104881b
{
interface EnumSchema {
  readonly enum?: readonly string[];
}

interface BugReportSchema {
  readonly properties?: {
    readonly repairBy?: EnumSchema;
  };
  readonly $defs?: {
    readonly bug?: {
      readonly properties?: {
        readonly severity?: EnumSchema;
        readonly category?: EnumSchema;
        readonly foundBy?: EnumSchema;
        readonly issueType?: EnumSchema;
      };
    };
  };
}

function schema(): BugReportSchema {
  const url = new URL(
    "../../../schemas/bug-report/v2.schema.json",
    import.meta.url,
  );
  return JSON.parse(readFileSync(url, "utf8")) as BugReportSchema;
}

describe("Bug Report V2 schema/runtime parity", () => {
  it("keeps canonical enum values aligned", () => {
    const value = schema();
    const bug = value.$defs?.bug?.properties;

    expect(value.properties?.repairBy?.enum)
      .toEqual(BUG_REPORT_V2_REPAIR_BY_VALUES);
    expect(bug?.severity?.enum)
      .toEqual(BUG_SEVERITIES);
    expect(bug?.category?.enum)
      .toEqual(BUG_FINDER_CATEGORIES);
    expect(bug?.foundBy?.enum)
      .toEqual(BUG_REPORT_V2_FOUND_BY_VALUES);
    expect(bug?.issueType?.enum)
      .toEqual(BUG_REPORT_V2_ISSUE_TYPES);
  });
});
}

// Original suite engine/packages/bug-report/test/v2.test.ts, blob 7a2d4eed7449a351e6e782b2cbe633bd45ec21d6
{
function report(): BugReportV2 {
  return {
    schema: BUG_REPORT_V2_SCHEMA,
    map: {
      name: "Beach Bedwars",
      mapVersion: "1.0.4",
      drive: "https://drive.google.com/file/d/map/view",
      baseVersion: "1.26.20",
      testedVersion: "1.26.32",
    },
    repairBy: "developer",
    bugs: [
      {
        id: "BUG-BBW-002",
        fixed: false,
        severity: "minor",
        category: "ui-feedback",
        foundBy: "tester",
        title: "Join feedback persists",
        problem: "Feedback remains visible after leaving.",
        expected: "Feedback clears after leaving.",
        observed: "Feedback remains visible.",
      },
      {
        id: "BUG-BBW-001",
        fixed: true,
        severity: "blocker",
        category: "game-flow",
        foundBy: "ai",
        title: "Match cannot restart",
        problem: "A completed arena cannot start again.",
        expected: "The arena can start a new match.",
        observed: "The previous session remains active.",
        reproduction: [
          "Start and finish a match normally.",
          "Return to the lobby and start the same arena again.",
          "Confirm the new match does not start.",
        ],
        aiAnalysis: "Cleanup leaves stale session ownership.",
        relevantCode: [{
          file: "scripts/session.ts",
          reason: "Owns arena session cleanup.",
        }],
        suggestedFix: "Clear stale session ownership during cleanup.",
        mustPreserve: [
          "Other arenas remain isolated.",
        ],
      },
    ],
  };
}

describe("bug report v2", () => {
  it("round-trips the canonical persisted vocabulary", () => {
    const serialized = serializeBugReportV2(report());
    expect(serialized.ok).toBe(true);
    if (!serialized.ok || !serialized.json) return;

    const parsed = parseBugReportV2Json(serialized.json);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.report.map.baseVersion).toBe("1.26.20");
    expect(parsed.report.map.testedVersion).toBe("1.26.32");
    expect(parsed.report.bugs[0]?.severity).toBe("blocker");
    expect(parsed.report.bugs[0]?.issueType).toBe("BUG");
  });

  it("round-trips explicit design mismatch issue type", () => {
    const base = report();
    const source: BugReportV2 = {
      ...base,
      bugs: base.bugs.map((bug, index) =>
        index === 0
          ? {
              ...bug,
              issueType: "DESIGN_MISMATCH" as const,
            }
          : bug
      ),
    };
    const serialized = serializeBugReportV2(source);
    expect(serialized.ok).toBe(true);
    if (!serialized.ok || !serialized.json) return;
    const parsed = parseBugReportV2Json(serialized.json);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(
      parsed.report.bugs.some(
        (bug) => bug.issueType === "DESIGN_MISMATCH",
      ),
    ).toBe(true);
  });

  it("derives report progress from per-bug fixed checkboxes", () => {
    expect(bugReportV2Progress(report())).toEqual({
      fixed: 1,
      total: 2,
      allFixed: false,
    });
  });

  it("rejects per-bug repair ownership", () => {
    const source = JSON.parse(
      JSON.stringify(report()),
    ) as Record<string, unknown>;
    const bugs = source.bugs as Array<Record<string, unknown>>;
    bugs[0]!.repairBy = "chatgpt";

    const parsed = parseBugReportV2Json(JSON.stringify(source));
    expect(parsed.ok).toBe(false);
  });

  it("requires map, base, and tested versions", () => {
    const source = JSON.parse(
      JSON.stringify(report()),
    ) as {
      map: Record<string, unknown>;
    };
    delete source.map.testedVersion;

    const parsed = parseBugReportV2Json(JSON.stringify(source));
    expect(parsed.ok).toBe(false);
  });

  it("requires the canonical map Drive URL", () => {
    const missing = JSON.parse(
      JSON.stringify(report()),
    ) as {
      map: Record<string, unknown>;
    };
    delete missing.map.drive;

    const missingResult =
      parseBugReportV2Json(
        JSON.stringify(missing),
      );
    expect(missingResult.ok).toBe(false);

    const invalid = JSON.parse(
      JSON.stringify(report()),
    ) as {
      map: Record<string, unknown>;
    };
    invalid.map.drive =
      "https://example.com/map";

    const invalidResult =
      parseBugReportV2Json(
        JSON.stringify(invalid),
      );
    expect(invalidResult.ok).toBe(false);
  });

});
}
