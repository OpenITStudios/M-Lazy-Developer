// Same-owner, same-feature development source family; original lexical bodies preserved.
import { describe, expect, it } from "vitest";
import { compileBugTrigger, assessConfirmedDefectGrouping, decideBugGrouping, deriveConfirmedDefectSemanticKey, groupConfirmedDefects, BUG_REPORT_SCHEMA, validateBugReportSemantics } from "../src/index.js";
import type { ConfirmedDefect, BugReportV1 } from "../src/index.js";

// Source engine/packages/bug-report/test/bug-trigger.test.ts; blob a4cacb772d052e639114e9b817118a1537e7acc1
{
describe("Bug Trigger compiler", () => {
  it("compiles bounded gameplay facts into tester steps", () => {
    const result = compileBugTrigger({
      gameplayBasis: "authored-gameplay",
      startingCondition:
        "Join the arena with 2 players",
      actions: [
        "Finish the match normally",
        "Return to the lobby",
        "Start the same arena again",
      ],
      observableFailure:
        "the new match does not start",
      evidenceIds: [
        "intent:arena-restart",
        "runtime:restart-failed",
      ],
      stepEvidence: {
        startingCondition: ["intent:arena-restart"],
        actions: [
          ["intent:arena-restart"],
          ["intent:arena-restart"],
          ["intent:arena-restart"],
        ],
        observableFailure: ["runtime:restart-failed"],
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.steps).toEqual([
      "Join the arena with 2 players.",
      "Finish the match normally.",
      "Return to the lobby.",
      "Start the same arena again.",
      "Confirm: the new match does not start.",
    ]);
    expect(result.evidenceIds).toEqual([
      "intent:arena-restart",
      "runtime:restart-failed",
    ]);
    expect(result.gameplayBasis).toBe(
      "authored-gameplay",
    );
    expect(result.stepEvidence.observableFailure).toEqual(["runtime:restart-failed"]);
  });

  it("rejects source-code instructions and non-observable results at the draft stage", () => {
    for (const draft of [
      {
        gameplayBasis: "authored-gameplay" as const,
        startingCondition: "Inspect the session function",
        actions: ["Start the same arena again"],
        observableFailure: "the new match does not start",
        evidenceIds: ["intent:arena-restart"],
      },
      {
        gameplayBasis: "authored-gameplay" as const,
        startingCondition: "Join the arena with 2 players",
        actions: ["Finish the match normally"],
        observableFailure: "the bug is visible",
        evidenceIds: ["intent:arena-restart"],
      },
      {
        gameplayBasis: "authored-gameplay" as const,
        startingCondition: "Join the arena with 2 players",
        actions: ["Verify the logic"],
        observableFailure: "the match does not start",
        evidenceIds: ["intent:arena-restart"],
      },
    ]) {
      const result = compileBugTrigger(draft);
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.issues.map(issue => issue.code))
        .toContain("unusable-tester-step");
    }
  });

  it("rejects missing or incomplete per-step provenance before compiling AI Test In-Game", () => {
    const base = {
      gameplayBasis: "authored-gameplay" as const,
      startingCondition: "Join the arena with 2 players",
      actions: ["Finish the match"],
      observableFailure: "the next match does not start",
      evidenceIds: ["intent:arena-restart", "static:restart"],
    };
    const absent = compileBugTrigger(base);
    expect(absent.ok).toBe(false);
    if (!absent.ok) expect(absent.issues.map(issue => issue.code))
      .toContain("missing-step-evidence");

    const wrongCount = compileBugTrigger({ ...base, stepEvidence: {
      startingCondition: ["intent:arena-restart"],
      actions: [],
      observableFailure: ["static:restart"],
    } });
    expect(wrongCount.ok).toBe(false);
    if (!wrongCount.ok) expect(wrongCount.issues.map(issue => issue.code))
      .toContain("step-evidence-count-mismatch");

    const foreign = compileBugTrigger({ ...base, stepEvidence: {
      startingCondition: ["intent:arena-restart"],
      actions: [["foreign:unknown"]],
      observableFailure: ["static:restart"],
    } });
    expect(foreign.ok).toBe(false);
    if (!foreign.ok) expect(foreign.issues.map(issue => issue.code))
      .toContain("unbound-step-evidence");

    const blank = compileBugTrigger({ ...base, stepEvidence: {
      startingCondition: ["intent:arena-restart"],
      actions: [[]],
      observableFailure: ["static:restart"],
    } });
    expect(blank.ok).toBe(false);
    if (!blank.ok) expect(blank.issues.map(issue => issue.code))
      .toContain("missing-step-evidence");
  });

  it("does not compile without a visible failure", () => {
    const result = compileBugTrigger({
      gameplayBasis: "authored-gameplay",
      startingCondition: "Join the arena",
      actions: ["Finish the match"],
      observableFailure: "",
      evidenceIds: ["runtime:failure"],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(
      result.issues.map((issue) => issue.code),
    ).toContain("missing-observable-failure");
  });

  it("requires evidence for AI-authored trigger facts", () => {
    const result = compileBugTrigger({
      gameplayBasis: "authored-gameplay",
      startingCondition: "Join the arena",
      observableFailure:
        "the match does not start",
      evidenceIds: [],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(
      result.issues.map((issue) => issue.code),
    ).toContain("missing-evidence");
  });

  it("rejects trigger paths that exceed five steps", () => {
    const result = compileBugTrigger({
      gameplayBasis: "authored-gameplay",
      startingCondition: "Join the arena",
      actions: [
        "Action one",
        "Action two",
        "Action three",
        "Action four",
      ],
      observableFailure:
        "the bug is visible",
      evidenceIds: ["runtime:failure"],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(
      result.issues.map((issue) => issue.code),
    ).toContain("too-many-steps");
  });
});
}

// Source engine/packages/bug-report/test/grouping.test.ts; blob 94da9a7e4a9a8bdf99ab00abc3ee4c3b3651ce63
{
describe("bug report split and merge policy", () => {
  it("merges multiple symptoms of the same causal defect", () => {
    expect(
      decideBugGrouping({
        relatedCausalLineage: true,
        sameBrokenInvariant: true,
        sameRepairUnit: true,
        samePrimaryFailure: true,
      }),
    ).toBe("merge");
  });

  it("keeps one invariant and repair unit together despite different lineage", () => {
    expect(
      decideBugGrouping({
        relatedCausalLineage: false,
        sameBrokenInvariant: true,
        sameRepairUnit: true,
        samePrimaryFailure: true,
      }),
    ).toBe("merge");
  });

  it("splits findings that violate different gameplay invariants", () => {
    expect(
      decideBugGrouping({
        relatedCausalLineage: true,
        sameBrokenInvariant: false,
        sameRepairUnit: true,
        samePrimaryFailure: true,
      }),
    ).toBe("split");
  });

  it("splits findings that require independent repair units", () => {
    expect(
      decideBugGrouping({
        relatedCausalLineage: true,
        sameBrokenInvariant: true,
        sameRepairUnit: false,
        samePrimaryFailure: true,
      }),
    ).toBe("split");
  });

  it("keeps incomplete arena cleanup symptoms together when one cleanup defect owns them", () => {
    expect(
      decideBugGrouping({
        relatedCausalLineage: true,
        sameBrokenInvariant: true,
        sameRepairUnit: true,
        samePrimaryFailure: true,
      }),
    ).toBe("merge");
  });

  it("separates inventory reset, friendly fire, and UI feedback defects", () => {
    expect(
      decideBugGrouping({
        relatedCausalLineage: false,
        sameBrokenInvariant: false,
        sameRepairUnit: false,
        samePrimaryFailure: false,
      }),
    ).toBe("split");
  });
});


function defect(
  subject: string,
  options: {
    incident?: string;
    invariant?: string;
    repairUnit?: string;
  } = {},
): ConfirmedDefect {
  const base: Omit<
    ConfirmedDefect,
    "semanticKey"
  > = {
    subjectIds: ["subject:" + subject],
    foundBy: "tester",
    confirmation: {
      basis: "tester-reproduction",
      evidence: "Reproduced gameplay mismatch.",
    },
    impact: {
      progression: "degraded",
      recovery: "normal",
      stability: "stable",
      coreMechanic: "materially-wrong",
      importantState: "correct",
      fairness: "unaffected",
    },
    primaryFailure: "game-progression",
    title: "Gameplay failure",
    problem: "Gameplay does not follow the contract.",
    expected: {
      authority: "explicit-requirement",
      statement: "Gameplay follows the contract.",
      evidenceIds: ["requirement:gameplay"],
    },
    observed: {
      statement: "Gameplay diverges from the contract.",
      evidenceIds: ["tester:observation"],
    },
    reproduction: [
      "Enter the affected gameplay state.",
      "Perform the action that reaches the failure.",
      "Confirm the gameplay result diverges from the expected contract.",
    ],
    brokenInvariantIds: [
      options.invariant ?? "inv:gameplay",
    ],
    repairUnitIds: [
      options.repairUnit ?? "unit:gameplay",
    ],
    ...(options.incident === undefined
      ? {}
      : { causalIncidentId: options.incident }),
  };

  return {
    ...base,
    semanticKey:
      deriveConfirmedDefectSemanticKey(base),
  };
}

describe("confirmed defect semantic grouping", () => {
  it("merges only when causal incident invariant and repair unit all match", () => {
    const left = defect("symptom-a", {
      incident: "incident:cleanup",
    });
    const right = defect("symptom-b", {
      incident: "incident:cleanup",
    });

    expect(
      decideBugGrouping(
        assessConfirmedDefectGrouping(left, right),
      ),
    ).toBe("merge");
  });

  it("merges matching invariant and repair unit even without causal incident identity", () => {
    const groups = groupConfirmedDefects([
      defect("symptom-a"),
      defect("symptom-b"),
    ]);

    expect(groups).toHaveLength(1);
  });

  it("splits the same incident when repair units differ", () => {
    const left = defect("symptom-a", {
      incident: "incident:cleanup",
      repairUnit: "unit:inventory",
    });
    const right = defect("symptom-b", {
      incident: "incident:cleanup",
      repairUnit: "unit:session",
    });

    expect(
      decideBugGrouping(
        assessConfirmedDefectGrouping(left, right),
      ),
    ).toBe("split");
  });

  it("creates deterministic semantic groups independent of input order", () => {
    const a = defect("a", {
      incident: "incident:cleanup",
    });
    const b = defect("b", {
      incident: "incident:cleanup",
    });
    const first = groupConfirmedDefects([a, b]);
    const second = groupConfirmedDefects([b, a]);

    expect(first).toEqual(second);
    expect(first[0]?.defects.map((item) => item.semanticKey))
      .toEqual([
        a.semanticKey,
        b.semanticKey,
      ].sort());
  });
});
}

// Source engine/packages/bug-report/test/semantics.test.ts; blob 2861cf16444e96aa06d8f5e2f71ce129f6d07bfb
{
function baseReport(): BugReportV1 {
  return {
    schema: BUG_REPORT_SCHEMA,
    map: {
      name: "Blitz Build",
      version: "1.0.3",
      minecraftVersion: "1.26.32",
      drive: "https://drive.google.com/file/d/example/view",
    },
    bugFinders: [],
  };
}

describe("bug report semantic validation", () => {
  it("accepts a gameplay-only tester observation", () => {
    const report: BugReportV1 = {
      ...baseReport(),
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
                "Acquire a match item",
                "Finish the match",
                "Return to the lobby",
              ],
              expected: "Match inventory is cleared before lobby control returns.",
              observed: {
                gameplay: "The match sword remains in inventory in the lobby.",
              },
            },
          ],
        },
      ],
    };

    expect(validateBugReportSemantics(report)).toEqual({
      valid: true,
      issues: [],
    });
  });

  it("accepts an AI candidate with a concrete verification plan", () => {
    const report: BugReportV1 = {
      ...baseReport(),
      bugFinders: [
        {
          category: "multiplayer-session",
          bugs: [
            {
              title: "Reconnect can resolve stale session ownership",
              severity: "blocker",
              foundBy: "ai",
              verification: "candidate",
              problem: "A reconnecting player may attach to stale session state.",
              expected: "Reconnect resolves ownership only from the current session.",
              observed: {
                code: "Reconnect lookup can run while previous ownership remains readable.",
              },
              verifyBug: [
                "Run one arena with five players",
                "Disconnect one player during cleanup",
                "Reconnect during next-session initialization",
                "Check whether previous ownership survives",
              ],
              diagnosis: "Reconnect initialization can overlap previous-session cleanup.",
              relevantCode: [
                {
                  file: "scripts/arena/session.ts",
                  reason: "Owns disconnect cleanup and reconnect resolution.",
                },
              ],
            },
          ],
        },
      ],
    };

    expect(validateBugReportSemantics(report)).toEqual({
      valid: true,
      issues: [],
    });
  });

  it("accepts a verified AI+tester report with gameplay and code evidence", () => {
    const report: BugReportV1 = {
      ...baseReport(),
      bugFinders: [
        {
          category: "world-interaction",
          bugs: [
            {
              title: "Water affects blocks outside the active plot",
              severity: "major",
              foundBy: "ai+tester",
              verification: "verified",
              problem: "Players can modify world state outside their assigned build area.",
              reproduction: [
                "Start the building phase",
                "Use a water bucket on iron bars outside the active plot",
              ],
              reproducibility: {
                attempts: 3,
                reproduced: 3,
              },
              expected: "All world interaction outside the active plot is rejected.",
              observed: {
                gameplay: "Iron bars outside the plot become waterlogged.",
                code: "Bucket interaction reaches mutation without the normal containment gate.",
              },
              diagnosis: "Bucket use follows a separate mutation path.",
              rootCause: "The bucket path omits active-plot containment validation.",
              repairDirection: "Route bucket interaction through the existing containment policy.",
              mustPreserve: [
                "Water remains usable inside the active plot.",
              ],
              fixValidation: [
                "Verify outside-plot bucket interaction is rejected",
                "Verify water still works inside the plot",
              ],
            },
          ],
        },
      ],
    };

    expect(validateBugReportSemantics(report)).toEqual({
      valid: true,
      issues: [],
    });
  });

  it("rejects tester findings that contain code analysis", () => {
    const report: BugReportV1 = {
      ...baseReport(),
      bugFinders: [
        {
          category: "game-flow",
          bugs: [
            {
              title: "Round cannot restart",
              severity: "blocker",
              foundBy: "tester",
              verification: "observed",
              problem: "The next mandatory round cannot begin.",
              expected: "The arena can start a new round after cleanup.",
              observed: {
                gameplay: "Start no longer works after the first defeat.",
                code: "Cleanup leaves the arena state locked.",
              },
              diagnosis: "Cleanup is incomplete.",
            },
          ],
        },
      ],
    };

    const result = validateBugReportSemantics(report);

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain(
      "tester-contains-code-analysis",
    );
  });

  it("rejects AI-only findings that claim gameplay observation", () => {
    const report: BugReportV1 = {
      ...baseReport(),
      bugFinders: [
        {
          category: "multiplayer-session",
          bugs: [
            {
              title: "Stale reconnect state",
              severity: "major",
              foundBy: "ai",
              verification: "candidate",
              problem: "Reconnect may reuse stale state.",
              expected: "Reconnect uses current-session state only.",
              observed: {
                gameplay: "The player retained stale state.",
                code: "Old ownership remains readable during reconnect.",
              },
              verifyBug: ["Attempt reconnect during cleanup"],
            },
          ],
        },
      ],
    };

    const result = validateBugReportSemantics(report);

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain(
      "ai-contains-gameplay-observation",
    );
  });

  it("rejects verified tester findings without repeated reproduction", () => {
    const report: BugReportV1 = {
      ...baseReport(),
      bugFinders: [
        {
          category: "combat",
          bugs: [
            {
              title: "Friendly fire remains enabled",
              severity: "major",
              foundBy: "tester",
              verification: "verified",
              problem: "Players can damage teammates despite team rules.",
              reproduction: [
                "Start a team match",
                "Attack a teammate",
              ],
              reproducibility: {
                attempts: 2,
                reproduced: 1,
              },
              expected: "Teammate damage is rejected.",
              observed: {
                gameplay: "The teammate loses health.",
              },
            },
          ],
        },
      ],
    };

    const result = validateBugReportSemantics(report);

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain(
      "insufficient-verified-reproduction",
    );
  });

  it("rejects impossible reproducibility counts", () => {
    const report: BugReportV1 = {
      ...baseReport(),
      bugFinders: [
        {
          category: "player-state",
          bugs: [
            {
              title: "Inventory reset failure",
              severity: "major",
              foundBy: "tester",
              verification: "observed",
              problem: "Match inventory leaks into the lobby.",
              expected: "Match inventory is cleared.",
              observed: {
                gameplay: "A match item remains in inventory.",
              },
              reproducibility: {
                attempts: 2,
                reproduced: 3,
              },
            },
          ],
        },
      ],
    };

    const result = validateBugReportSemantics(report);

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain(
      "invalid-reproducibility-count",
    );
  });

  it("rejects duplicate finder categories", () => {
    const bug = {
      title: "Message repeats",
      severity: "minor" as const,
      foundBy: "tester" as const,
      verification: "observed" as const,
      problem: "Feedback is duplicated.",
      expected: "One message is shown.",
      observed: { gameplay: "The same message appears twice." },
    };

    const report: BugReportV1 = {
      ...baseReport(),
      bugFinders: [
        { category: "ui-feedback", bugs: [bug] },
        { category: "ui-feedback", bugs: [bug] },
      ],
    };

    const result = validateBugReportSemantics(report);

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain(
      "duplicate-category",
    );
  });

  it("rejects runtime conditions on non-runtime finder categories", () => {
    const report: BugReportV1 = {
      ...baseReport(),
      bugFinders: [
        {
          category: "world-interaction",
          bugs: [
            {
              title: "Water affects outside blocks",
              severity: "major",
              foundBy: "tester",
              verification: "observed",
              problem: "World interaction escapes the build boundary.",
              expected: "Outside interaction is rejected.",
              observed: {
                gameplay: "Outside iron bars become waterlogged.",
              },
              runtimeConditions: {
                players: 5,
              },
            },
          ],
        },
      ],
    };

    const result = validateBugReportSemantics(report);

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain(
      "runtime-conditions-outside-runtime-category",
    );
  });
});
}
