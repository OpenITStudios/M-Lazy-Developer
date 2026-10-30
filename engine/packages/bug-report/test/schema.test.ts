// Source-preserving consolidation: original test cases remain in isolated lexical blocks.
import { describe, expect, it } from "vitest";
import { confirmDefectForReport, createBugReportV2, parseBugReportToCurrent, BUG_REPORT_SCHEMA, normalizeBugReportV1, parseBugReportJson, parseBugReportV1, BUG_REPORT_WORKSPACE_DIRECTORY, buildBugReportWorkspacePath, BUG_REPORT_V2_SCHEMA, parseBugReportV2Json, promoteConfirmedBugsToV2, reviewConfirmedBugInputs, serializeBugReportV1, BUG_FINDER_CATEGORIES, BUG_REPORT_V2_FOUND_BY_VALUES, BUG_REPORT_V2_ISSUE_TYPES, BUG_REPORT_V2_REPAIR_BY_VALUES, BUG_SEVERITIES, bugReportV2Progress, serializeBugReportV2 } from "../src/index.js";
import type { CreateBugReportV2Input, BugReportBug, BugReportV1, BugReportV2 } from "../src/index.js";
import { readFileSync } from "node:fs";

// Consolidated suite from engine/packages/bug-report/test/confirmation-v2.test.ts
{
describe("defect confirmation for report promotion", () => {
  it("confirms a tester-found reproducible gameplay mismatch", () => {
    const result = confirmDefectForReport({
      foundBy: "tester",
      expectedBehaviorAuthority: "selected-artifact",
      testerReproduced: true,
      evidence: "The second match cannot start after completing the first match.",
    });

    expect(result.confirmed).toBe(true);
    if (!result.confirmed) return;
    expect(result.confirmation.basis).toBe(
      "tester-reproduction",
    );
  });

  it("confirms an AI-found selected-artifact contract violation", () => {
    const result = confirmDefectForReport({
      foundBy: "ai",
      expectedBehaviorAuthority: "selected-artifact",
      authoredContractViolation: true,
      evidence:
        "Session cleanup returns the player to lobby without clearing match-owned inventory required to reset at match end.",
    });

    expect(result.confirmed).toBe(true);
    if (!result.confirmed) return;
    expect(result.confirmation.basis).toBe(
      "authored-contract-violation",
    );
  });

  it("confirms runtime mismatch without requiring root-cause proof", () => {
    const result = confirmDefectForReport({
      foundBy: "ai",
      expectedBehaviorAuthority: "selected-artifact",
      runtimeMismatchObserved: true,
      evidence:
        "Observed player state violates the established arena lifecycle after reconnect.",
    });

    expect(result.confirmed).toBe(true);
    if (!result.confirmed) return;
    expect(result.confirmation.basis).toBe(
      "runtime-observation",
    );
  });

  it("rejects a version difference by itself", () => {
    const result = confirmDefectForReport({
      foundBy: "ai",
      expectedBehaviorAuthority: "selected-artifact",
      compatibilityDifferenceOnly: true,
      evidence: "Base 1.26.20 differs from Tested 1.26.32.",
    });

    expect(result.confirmed).toBe(false);
  });

  it("rejects risk-only AI findings", () => {
    const result = confirmDefectForReport({
      foundBy: "ai",
      expectedBehaviorAuthority: "selected-artifact",
      evidence:
        "Static topology suggests a possible stale session path.",
    });

    expect(result.confirmed).toBe(false);
  });

  it("rejects repeatable behavior without qualifying mismatch evidence", () => {
    const result = confirmDefectForReport({
      foundBy: "tester",
      expectedBehaviorAuthority: "runtime-contract",
      testerReproduced: false,
      evidence: "The observed behavior is repeatable, but no qualifying mismatch evidence was established.",
    });

    expect(result.confirmed).toBe(false);
  });

});
}

// Consolidated suite from engine/packages/bug-report/test/create-v2.test.ts
{
function validInput(): CreateBugReportV2Input {
  return {
    map: {
      name: "Beach Bedwars",
      mapVersion: "1.0.4",
      drive: "https://drive.google.com/file/d/map/view",
      baseVersion: "1.26.20",
      testedVersion: "1.26.32",
    },
    repairBy: "developer",
    bugs: [{
      id: "BUG-BBW-001",
      severity: "major",
      category: "multiplayer-session",
      foundBy: "ai",
      title: "Reconnect loses arena state",
      problem: "Arena state is stale after reconnect.",
      expected: "The player rejoins the same arena cleanly.",
      observed: "The previous membership remains active.",
      reproduction: [
        "Join an arena and start a match.",
        "Disconnect and reconnect.",
        "Confirm the previous arena membership remains bound to the old session.",
      ],
      aiAnalysis:
        "The reconnect path keeps stale arena membership.",
      relevantCode: [{
        file: "scripts/session.ts",
        reason: "Owns reconnect session membership.",
      }],
      suggestedFix:
        "Rebind arena membership to the new session.",
    }],
  };
}

describe("createBugReportV2", () => {
  it("creates a tester-ready canonical report", () => {
    const report = createBugReportV2(validInput());

    expect(report.schema).toBe("m-bedrock-bug-report/v2");
    expect(report.bugs[0]?.fixed).toBe(false);
    expect(report.repairBy).toBe("developer");
  });

  it("rejects invalid schema data at creation time", () => {
    const input = validInput();
    expect(() =>
      createBugReportV2({
        ...input,
        map: {
          ...input.map,
          testedVersion: "",
        },
      })
    ).toThrow(/creation failed/);
  });

  it("rejects an invalid canonical map Drive URL", () => {
    const input = validInput();
    expect(() =>
      createBugReportV2({
        ...input,
        map: {
          ...input.map,
          drive: "https://example.com/map",
        },
      })
    ).toThrow(/creation failed/);
  });

  it("rejects a report without Bug Trigger (In-Game)", () => {
    const input = validInput();
    const [bug] = input.bugs;
    if (!bug) throw new Error("Fixture bug is missing.");

    const {
      reproduction: _reproduction,
      ...withoutTrigger
    } = bug;

    expect(() =>
      createBugReportV2({
        ...input,
        bugs: [withoutTrigger],
      })
    ).toThrow(/readiness failed/);
  });

  it("rejects AI-found bugs without Relevant Code", () => {
    const input = validInput();
    const [bug] = input.bugs;
    if (!bug) throw new Error("Fixture bug is missing.");

    const {
      relevantCode: _relevantCode,
      ...withoutRelevantCode
    } = bug;

    expect(() =>
      createBugReportV2({
        ...input,
        bugs: [withoutRelevantCode],
      })
    ).toThrow(/readiness failed/);
  });
});
}

// Consolidated suite from engine/packages/bug-report/test/migrate.test.ts
{
describe("bug report migration boundary", () => {
  it("normalizes legacy V1 input to canonical V2", () => {
    const result = parseBugReportToCurrent(JSON.stringify({
      schema: "m-bedrock-bug-report/v1",
      map: {
        name: "Legacy Map",
        version: "1.2.3",
        minecraftVersion: "1.26.32",
        drive: "https://drive.google.com/file/d/map/view",
      },
      bugFinders: [],
    }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.schema).toBe("m-bedrock-bug-report/v2");
    expect(result.report.map).toMatchObject({
      name: "Legacy Map",
      mapVersion: "1.2.3",
      baseVersion: "1.26.32",
      testedVersion: "1.26.32",
    });
  });

  it("keeps canonical V2 input canonical", () => {
    const result = parseBugReportToCurrent(JSON.stringify({
      schema: "m-bedrock-bug-report/v2",
      map: {
        name: "Current Map",
        mapVersion: "2.0.0",
        drive: "https://drive.google.com/file/d/map/view",
        baseVersion: "1.26.20",
        testedVersion: "1.26.32",
      },
      repairBy: "developer",
      bugs: [{
        id: "BUG-001",
        fixed: false,
        severity: "major",
        category: "game-flow",
        foundBy: "tester",
        title: "Progress cannot continue",
        problem: "The player cannot continue after the objective completes.",
        expected: "The next objective becomes available.",
        observed: "The next objective remains unavailable.",
      }],
    }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.map.mapVersion).toBe("2.0.0");
  });
});
}

// Consolidated suite from engine/packages/bug-report/test/normalize.test.ts
{
function bug(title: string, severity: BugReportBug["severity"]): BugReportBug {
  return {
    title,
    severity,
    foundBy: "tester",
    verification: "observed",
    problem: "A gameplay defect is visible.",
    expected: "The intended gameplay rule is preserved.",
    observed: {
      gameplay: "The observed gameplay behavior differs.",
    },
  };
}

function report(): BugReportV1 {
  return {
    schema: BUG_REPORT_SCHEMA,
    map: {
      name: "Blitz Build",
      version: "1.0.3",
      minecraftVersion: "1.26.32",
      drive: "https://drive.google.com/file/d/map/view",
    },
    bugFinders: [
      {
        category: "ui-feedback",
        bugs: [
          bug("Z message", "minor"),
          bug("A message", "minor"),
        ],
      },
      {
        category: "game-flow",
        bugs: [
          bug("Minor flow issue", "minor"),
          bug("Major flow issue", "major"),
          bug("Blocked restart", "blocker"),
        ],
      },
      {
        category: "world-interaction",
        bugs: [
          bug("Water boundary", "major"),
        ],
      },
    ],
  };
}

describe("bug report canonical normalization", () => {
  it("orders finders by canonical domain order", () => {
    const normalized = normalizeBugReportV1(report());
    expect(normalized.bugFinders.map((finder) => finder.category)).toEqual([
      "game-flow",
      "world-interaction",
      "ui-feedback",
    ]);
  });

  it("orders bugs by severity then title", () => {
    const normalized = normalizeBugReportV1(report());
    expect(normalized.bugFinders[0]?.bugs.map((entry) => entry.title)).toEqual([
      "Blocked restart",
      "Major flow issue",
      "Minor flow issue",
    ]);
    expect(normalized.bugFinders[2]?.bugs.map((entry) => entry.title)).toEqual([
      "A message",
      "Z message",
    ]);
  });

  it("does not reorder authored reproduction and validation steps", () => {
    const source = report();
    const modified: BugReportV1 = {
      ...source,
      bugFinders: source.bugFinders.map((finder) =>
        finder.category === "game-flow"
          ? {
              ...finder,
              bugs: finder.bugs.map((entry) =>
                entry.title === "Minor flow issue"
                  ? {
                      ...entry,
                      reproduction: [
                        "second-dependent step 1",
                        "second-dependent step 2",
                      ],
                      fixValidation: [
                        "validation step 1",
                        "validation step 2",
                      ],
                    }
                  : entry,
              ),
            }
          : finder,
      ),
    };

    const normalized = normalizeBugReportV1(modified);
    const normalizedBug = normalized.bugFinders
      .find((finder) => finder.category === "game-flow")
      ?.bugs.find((entry) => entry.title === "Minor flow issue");

    expect(normalizedBug?.reproduction).toEqual([
      "second-dependent step 1",
      "second-dependent step 2",
    ]);
    expect(normalizedBug?.fixValidation).toEqual([
      "validation step 1",
      "validation step 2",
    ]);
  });

  it("does not mutate the source report ordering", () => {
    const source = report();
    normalizeBugReportV1(source);
    expect(source.bugFinders[0]?.category).toBe("ui-feedback");
    expect(source.bugFinders[0]?.bugs[0]?.title).toBe("Z message");
  });
});
}

// Consolidated suite from engine/packages/bug-report/test/parse.test.ts
{
function validReport(): Record<string, any> {
  return {
    schema: "m-bedrock-bug-report/v1",
    map: {
      name: "Blitz Build",
      version: "1.0.3",
      minecraftVersion: "1.26.32",
      drive: "https://drive.google.com/file/d/map/view",
    },
    bugFinders: [
      {
        category: "player-state",
        bugs: [
          {
            title: "Inventory remains after match end",
            severity: "major",
            foundBy: "tester",
            verification: "observed",
            problem: "Match state leaks into the lobby.",
            reproduction: [
              "Join a match",
              "Acquire an item",
              "Finish the match",
            ],
            expected: "Match inventory is cleared before returning to the lobby.",
            observed: {
              gameplay: "The match item remains in the lobby.",
            },
          },
        ],
      },
    ],
  };
}

describe("bug report ingest boundary", () => {
  it("parses a structurally and semantically valid report", () => {
    const result = parseBugReportV1(validReport());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.report.map.version).toBe("1.0.3");
      expect(result.report.bugFinders[0]?.category).toBe("player-state");
    }
  });

  it("rejects malformed JSON before structural parsing", () => {
    const result = parseBugReportJson("{");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe("invalid-json");
    }
  });

  it("rejects a missing mandatory map version", () => {
    const report = validReport();
    const { version: _version, ...map } = report.map;
    const result = parseBugReportV1({ ...report, map });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.path === "$.map.version")).toBe(true);
    }
  });

  it("rejects unknown fields instead of silently accepting drift", () => {
    const report = {
      ...validReport(),
      reportId: "noise",
    };
    const result = parseBugReportV1(report);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === "unknown-field")).toBe(true);
    }
  });

  it("rejects legacy severity values", () => {
    const report = validReport();
    report.bugFinders[0]!.bugs[0]!.severity = "critical";
    const result = parseBugReportV1(report);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.path.endsWith(".severity"))).toBe(true);
    }
  });

  it("rejects ambiguous legacy origin labels", () => {
    const report = validReport();
    report.bugFinders[0]!.bugs[0]!.foundBy = "both";
    const result = parseBugReportV1(report);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.path.endsWith(".foundBy"))).toBe(true);
    }
  });

  it("rejects a structurally valid report that violates semantic rules", () => {
    const report = validReport();
    report.bugFinders[0]!.bugs[0]!.foundBy = "ai";
    report.bugFinders[0]!.bugs[0]!.verification = "verified";
    report.bugFinders[0]!.bugs[0]!.observed = {
      code: "A stale branch is reachable.",
    };
    const result = parseBugReportV1(report);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === "semantic-error")).toBe(true);
    }
  });

  it("rejects evidence outside Google Drive", () => {
    const report = validReport();
    report.bugFinders[0]!.bugs[0]!.evidence = [
      {
        description: "Reproduction video",
        drive: "https://example.com/video.mp4",
      },
    ];
    const result = parseBugReportV1(report);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.path.endsWith(".evidence[0].drive"))).toBe(true);
    }
  });
});
}

// Consolidated suite from engine/packages/bug-report/test/persistence.test.ts
{
describe("project-scoped bug report paths", () => {
  it("builds canonical single-level and multi-level report paths", () => {
    expect(BUG_REPORT_WORKSPACE_DIRECTORY).toBe("workspace/projects");
    expect(buildBugReportWorkspacePath("attack-challenge")).toBe(
      "workspace/projects/attack-challenge/report/bug-report.json");
    expect(buildBugReportWorkspacePath("fall-of-the-pillager", "level-2")).toBe(
      "workspace/projects/fall-of-the-pillager/levels/level-2/report/bug-report.json");
  });
  it("rejects traversal and noncanonical level identifiers", () => {
    expect(() => buildBugReportWorkspacePath("../other")).toThrow();
    expect(() => buildBugReportWorkspacePath("attack-challenge", "other")).toThrow();
  });
});
}

// Consolidated suite from engine/packages/bug-report/test/promote-v2.test.ts
{
const map = {
  name: "Beach Bedwars",
  mapVersion: "1.0.4",
      drive: "https://drive.google.com/file/d/map/view",
  baseVersion: "1.26.20",
  testedVersion: "1.26.32",
};

/** Minimal valid canonical report for parser rejection tests. */
function report(): BugReportV2 {
  return {
    schema: BUG_REPORT_V2_SCHEMA,
    map,
    repairBy: "developer",
    bugs: [],
  };
}

describe("confirmed bug promotion", () => {
  it("promotes only confirmed defects into canonical V2", () => {
    const result = promoteConfirmedBugsToV2({
      map,
      repairBy: "developer",
      bugs: [{
        status: "confirmed-defect",
        confirmation: {
          basis: "authored-contract-violation",
          evidence: "The implementation contradicts the authored behavior contract.",
        },
        id: "BUG-BBW-001",
        severity: "major",
        category: "multiplayer-session",
        foundBy: "ai",
        title: "Reconnect loses arena state",
        problem: "The player returns to the lobby after reconnecting.",
        expected: "The player remains assigned to the same arena.",
        observed: "The previous arena membership remains bound to the old session.",
        reproduction: [
          "Join an arena and start a match.",
          "Disconnect and reconnect.",
          "Confirm the player is not cleanly rebound to the same arena session.",
        ],
        aiAnalysis: "Reconnect creates a new session without fully rebinding arena membership.",
        relevantCode: [{
          file: "scripts/session.ts",
          reason: "Owns reconnect session membership.",
        }],
        suggestedFix: "Rebind arena membership to the new session.",
        mustPreserve: [
          "Same-arena reconnect behavior.",
          "Cross-arena isolation.",
        ],
      }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.bugs).toHaveLength(1);
    expect(result.report.bugs[0]?.fixed).toBe(false);
    expect("status" in result.report.bugs[0]!).toBe(false);
    expect("confirmation" in result.report.bugs[0]!).toBe(false);
  });

  it("requires gameplay reproduction for tester-found confirmed defects", () => {
    const issues = reviewConfirmedBugInputs([{
      status: "confirmed-defect",
        confirmation: {
          basis: "authored-contract-violation",
          evidence: "The implementation contradicts the authored behavior contract.",
        },
      id: "BUG-BBW-002",
      severity: "major",
      category: "game-flow",
      foundBy: "tester",
      title: "Match cannot restart",
      problem: "A second match cannot start.",
      expected: "The arena can start another match.",
      observed: "The start interaction no longer works.",
    }]);

    expect(issues.map((issue) => issue.code)).toContain(
      "missing-reproduction",
    );
  });

  it("requires technical basis for AI-found confirmed defects", () => {
    const issues = reviewConfirmedBugInputs([{
      status: "confirmed-defect",
        confirmation: {
          basis: "authored-contract-violation",
          evidence: "The implementation contradicts the authored behavior contract.",
        },
      id: "BUG-BBW-003",
      severity: "minor",
      category: "ui-feedback",
      foundBy: "ai",
      title: "Feedback remains visible",
      problem: "Feedback persists after leaving.",
      expected: "Feedback clears.",
      observed: "The UI state is not cleared.",
      reproduction: [
        "Enter the join area until feedback appears.",
        "Leave the join area.",
        "Confirm the feedback remains visible.",
      ],
    }]);

    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "ai-missing-analysis",
        "ai-missing-relevant-code",
      ]),
    );
  });

  it("keeps tester as Found By when AI adds technical analysis", () => {
    const result = promoteConfirmedBugsToV2({
      map,
      repairBy: "developer",
      bugs: [{
        status: "confirmed-defect",
        confirmation: {
          basis: "tester-reproduction",
          evidence: "The waterlogging behavior is reproducible outside the active plot.",
        },
        id: "BUG-BBW-005",
        severity: "major",
        category: "world-interaction",
        foundBy: "tester",
        title: "Water mutates blocks outside the plot",
        problem: "Water changes world state outside the active plot.",
        expected: "Outside-plot interaction is rejected.",
        observed: "Iron bars outside the plot become waterlogged.",
        reproduction: [
          "Start the building phase.",
          "Use a water bucket on iron bars outside the active plot.",
          "Confirm the outside-plot iron bars become waterlogged.",
        ],
        aiAnalysis: "Bucket handling bypasses the normal plot containment gate.",
        relevantCode: [{
          file: "scripts/building.ts",
          reason: "Handles bucket interaction during the building phase.",
        }],
        suggestedFix: "Route bucket interaction through plot containment.",
      }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.bugs[0]?.foundBy).toBe("tester");
    expect(result.report.bugs[0]?.aiAnalysis).toContain(
      "bypasses",
    );
  });

  it("rejects AI discovery supported only by tester reproduction", () => {
    const issues = reviewConfirmedBugInputs([{
      status: "confirmed-defect",
      confirmation: {
        basis: "tester-reproduction",
        evidence: "A tester can reproduce the behavior.",
      },
      id: "BUG-BBW-006",
      severity: "major",
      category: "game-flow",
      foundBy: "ai",
      title: "AI-only claim without AI proof",
      problem: "The behavior is wrong.",
      expected: "Expected behavior.",
      observed: "Observed behavior.",
      reproduction: [
        "Trigger the affected game flow.",
        "Repeat the action that reaches the affected state.",
        "Confirm the reported behavior occurs.",
      ],
      aiAnalysis: "A possible path exists.",
      relevantCode: [{
        file: "scripts/game.ts",
        reason: "Potentially related.",
      }],
    }]);

    expect(issues.map((issue) => issue.code)).toContain(
      "ai-unproven-defect",
    );
  });

  it("keeps Relevant Code focused on primary locations", () => {
    const issues = reviewConfirmedBugInputs([{
      status: "confirmed-defect",
        confirmation: {
          basis: "authored-contract-violation",
          evidence: "The implementation contradicts the authored behavior contract.",
        },
      id: "BUG-BBW-004",
      severity: "major",
      category: "player-state",
      foundBy: "ai",
      title: "Inventory persists",
      problem: "Match items remain in the lobby.",
      expected: "Match-owned items are cleared.",
      observed: "Cleanup does not clear match items.",
      reproduction: [
        "Start a match and obtain match-owned items.",
        "Finish the match and return to the lobby.",
        "Confirm the match items remain in inventory.",
      ],
      aiAnalysis: "Inventory cleanup is missing from the match-end path.",
      relevantCode: [1, 2, 3, 4].map((index) => ({
        file: "scripts/file-" + index + ".ts",
        reason: "Candidate location " + index,
      })),
    }]);

    expect(issues.map((issue) => issue.code)).toContain(
      "too-many-relevant-code-locations",
    );
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

// Consolidated suite from engine/packages/bug-report/test/serialize.test.ts
{
function report(): BugReportV1 {
  return {
    schema: BUG_REPORT_SCHEMA,
    map: {
      name: "Blitz Build",
      version: "1.0.3",
      minecraftVersion: "1.26.32",
      drive: "https://drive.google.com/file/d/map/view",
    },
    bugFinders: [
      {
        category: "ui-feedback",
        bugs: [
          {
            title: "Join pad particle is missing",
            severity: "minor",
            foundBy: "tester",
            verification: "observed",
            problem: "Players lose visual feedback for join-pad state.",
            reproduction: [
              "Enter the lobby",
              "Approach an arena join pad",
            ],
            expected: "The join pad shows its intended visual indicator.",
            observed: {
              gameplay: "The expected join-pad particle is not visible.",
            },
          },
        ],
      },
      {
        category: "world-interaction",
        bugs: [
          {
            title: "Water affects blocks outside active plot",
            severity: "major",
            foundBy: "ai+tester",
            verification: "verified",
            problem: "Players can mutate world state outside their build area.",
            preconditions: [
              "Building phase is active",
            ],
            reproduction: [
              "Enter the active build plot",
              "Use a water bucket on iron bars outside the plot",
            ],
            reproducibility: {
              attempts: 3,
              reproduced: 3,
            },
            expected: "All outside-plot world interaction is rejected.",
            observed: {
              gameplay: "Outside iron bars become waterlogged.",
              code: "Bucket mutation bypasses the normal plot-containment gate.",
            },
            evidence: [
              {
                description: "Gameplay reproduction of outside-plot waterlogging.",
                drive: "https://drive.google.com/file/d/evidence/view",
              },
            ],
            diagnosis: "Bucket use follows a separate mutation path.",
            rootCause: "The bucket path omits active-plot containment validation.",
            relevantCode: [
              {
                file: "scripts/arena/session.ts",
                reason: "Processes bucket interaction during building.",
                lines: "318-352",
              },
            ],
            repairDirection: "Route bucket mutation through the existing containment policy.",
            mustPreserve: [
              "Water remains usable inside the active build plot.",
            ],
            fixValidation: [
              "Verify outside-plot water interaction is rejected",
              "Verify water still works inside the plot",
            ],
          },
        ],
      },
    ],
  };
}

describe("bug report canonical serialization", () => {
  it("round-trips without losing repair context", () => {
    const source = report();
    const serialized = serializeBugReportV1(source);
    expect(serialized.ok).toBe(true);

    if (!serialized.ok) return;

    const parsed = parseBugReportJson(serialized.json);
    expect(parsed.ok).toBe(true);

    if (!parsed.ok) return;

    expect(parsed.report).toEqual(normalizeBugReportV1(source));
  });

  it("does not truncate long diagnostic content", () => {
    const source = report();
    const longDiagnosis = "diagnostic detail ".repeat(1000);
    const modified: BugReportV1 = {
      ...source,
      bugFinders: source.bugFinders.map((finder) =>
        finder.category === "world-interaction"
          ? {
              ...finder,
              bugs: finder.bugs.map((entry) => ({
                ...entry,
                diagnosis: longDiagnosis,
              })),
            }
          : finder,
      ),
    };

    const serialized = serializeBugReportV1(modified);
    expect(serialized.ok).toBe(true);
    if (!serialized.ok) return;

    expect(serialized.json).toContain(longDiagnosis);

    const parsed = parseBugReportJson(serialized.json);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const parsedBug = parsed.report.bugFinders
      .find((finder) => finder.category === "world-interaction")
      ?.bugs[0];
    expect(parsedBug?.diagnosis).toBe(longDiagnosis);
  });

  it("rejects semantically invalid reports instead of exporting them", () => {
    const source = report();
    const modified: BugReportV1 = {
      ...source,
      bugFinders: source.bugFinders.map((finder) =>
        finder.category === "world-interaction"
          ? {
              ...finder,
              bugs: finder.bugs.map((entry) => ({
                ...entry,
                foundBy: "ai" as const,
                verification: "verified" as const,
                observed: {
                  code: "A risky code path exists.",
                },
              })),
            }
          : finder,
      ),
    };

    const serialized = serializeBugReportV1(modified);
    expect(serialized.ok).toBe(false);
  });

  it("emits deterministic pretty JSON with a trailing newline", () => {
    const first = serializeBugReportV1(report());
    const second = serializeBugReportV1(report());
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(first.json).toBe(second.json);
    expect(first.json.endsWith("\n")).toBe(true);
  });
});
}

// Consolidated suite from engine/packages/bug-report/test/v2.test.ts
{
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
}
