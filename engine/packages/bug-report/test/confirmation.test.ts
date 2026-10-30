// Source-preserving consolidation: original test cases remain in isolated lexical blocks.
import { describe, expect, it } from "vitest";
import { classifyBugCandidate, classifyBugSeverity, highestBugSeverity, routeBugFinderCategory, shouldIncludeInDefaultBugReport, BUG_REPORT_V2_SCHEMA, projectBugReportPreview, renderBugReportPreviewMarkdown, projectConfirmedDefects, allocateBugIds, buildBugReportFromConfirmedDefects, deriveRepairUnitIdsFromSourceEvidence, groupConfirmedDefects, deriveConfirmedDefectSemanticKey, reconcileCanonicalBugReport, reviewBugReportReadiness, resolveConfirmedDefectGroup, applyProposedBugReview, buildBugReportFromApprovedBugSet, projectProposedBugSet } from "../src/index.js";
import type { BugImpactAssessment, BugReportV2, ConfirmedDefect, BugReportV2Bug } from "../src/index.js";

// Consolidated suite from engine/packages/bug-report/test/decision.test.ts
{
const cleanImpact: BugImpactAssessment = {
  progression: "unaffected",
  recovery: "normal",
  stability: "stable",
  coreMechanic: "correct",
  importantState: "correct",
  fairness: "unaffected",
};

describe("bug candidate reportability", () => {
  it("rejects candidates when counter-evidence is present", () => {
    expect(classifyBugCandidate({
      intent: "grounded-contradiction",
      playerImpact: "blocking",
      testerObservable: true,
      counterEvidence: "present",
    }).disposition).toBe("counter-evidence-present");
  });

  it("fails closed while counter-evidence remains unresolved", () => {
    expect(classifyBugCandidate({
      intent: "grounded-contradiction",
      playerImpact: "blocking",
      testerObservable: true,
      counterEvidence: "unresolved",
    }).disposition).toBe("counter-evidence-unresolved");
  });

  it("rejects grounded game design as a bug", () => {
    expect(classifyBugCandidate({
      intent: "grounded-designed-behavior",
      playerImpact: "blocking",
      testerObservable: true,
      counterEvidence: "cleared",
    })).toEqual({
      disposition: "designed-behavior",
      reportable: false,
    });
  });

  it("rejects ambiguous intent instead of guessing", () => {
    expect(classifyBugCandidate({
      intent: "ambiguous",
      playerImpact: "material",
      testerObservable: true,
      counterEvidence: "cleared",
    }).disposition).toBe("ambiguous-intent");
  });

  it("rejects technical-only findings with no tester-visible trigger", () => {
    expect(classifyBugCandidate({
      intent: "grounded-contradiction",
      playerImpact: "material",
      testerObservable: false,
      counterEvidence: "cleared",
    }).disposition).toBe("tester-trigger-missing");
  });

  it("keeps limited issues out of the default report", () => {
    expect(classifyBugCandidate({
      intent: "grounded-contradiction",
      playerImpact: "limited",
      testerObservable: true,
      counterEvidence: "cleared",
    }).disposition).toBe("below-report-threshold");
  });

  it("reports grounded player-visible material failures", () => {
    expect(classifyBugCandidate({
      intent: "grounded-contradiction",
      playerImpact: "material",
      testerObservable: true,
      counterEvidence: "cleared",
    })).toEqual({
      disposition: "reportable-bug",
      reportable: true,
    });
  });
});

describe("bug report severity policy", () => {
  it("classifies blocked mandatory flow without normal recovery as blocker", () => {
    expect(
      classifyBugSeverity({
        ...cleanImpact,
        progression: "blocked",
        recovery: "abnormal",
      }),
    ).toBe("blocker");
  });

  it("keeps recoverable blocked flow at major", () => {
    expect(
      classifyBugSeverity({
        ...cleanImpact,
        progression: "blocked",
        recovery: "normal",
      }),
    ).toBe("major");
  });

  it("does not make recovery alone a blocker without gameplay impact", () => {
    expect(
      classifyBugSeverity({
        ...cleanImpact,
        recovery: "none",
      }),
    ).toBe("minor");
  });

  it("classifies crash or freeze as blocker", () => {
    expect(
      classifyBugSeverity({
        ...cleanImpact,
        stability: "crash-or-freeze",
      }),
    ).toBe("blocker");
  });

  it("classifies materially wrong gameplay mechanics as major", () => {
    expect(
      classifyBugSeverity({
        ...cleanImpact,
        coreMechanic: "materially-wrong",
      }),
    ).toBe("major");
  });

  it("classifies gameplay fairness violations as major", () => {
    expect(
      classifyBugSeverity({
        ...cleanImpact,
        fairness: "materially-affected",
      }),
    ).toBe("major");
  });

  it("classifies presentation-only defects as minor", () => {
    expect(classifyBugSeverity(cleanImpact)).toBe("minor");
  });

  it("shows only blocker and major in the default report", () => {
    expect(shouldIncludeInDefaultBugReport("blocker")).toBe(true);
    expect(shouldIncludeInDefaultBugReport("major")).toBe(true);
    expect(shouldIncludeInDefaultBugReport("minor")).toBe(false);
  });
});

describe("bug finder category routing", () => {
  it.each([
    ["game-progression", "game-flow"],
    ["player-owned-state", "player-state"],
    ["session-concurrency", "multiplayer-session"],
    ["world-mutation", "world-interaction"],
    ["entity-decision", "entity-behavior"],
    ["combat-rule", "combat"],
    ["score-reward", "score-reward"],
    ["presentation-feedback", "ui-feedback"],
    ["runtime-capacity", "performance-stability"],
    ["runtime-compatibility", "compatibility"],
  ] as const)("routes %s to %s", (failure, category) => {
    expect(routeBugFinderCategory(failure)).toBe(category);
  });

  it("derives finder severity without storing duplicate truth", () => {
    expect(
      highestBugSeverity([
        { severity: "minor" },
        { severity: "major" },
        { severity: "blocker" },
      ]),
    ).toBe("blocker");

    expect(highestBugSeverity([])).toBeUndefined();
  });
});
}

// Consolidated suite from engine/packages/bug-report/test/preview.test.ts
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
        id: "BUG-002",
        fixed: false,
        severity: "minor",
        category: "ui-feedback",
        foundBy: "tester",
        title: "Join feedback persists",
        problem: "Join feedback remains visible after leaving.",
        expected: "Feedback clears after leaving.",
        observed: "Feedback remains visible.",
        reproduction: [
          "Enter the join area.",
          "Leave the join area.",
          "Confirm the feedback remains visible.",
        ],
      },
      {
        id: "BUG-001",
        fixed: false,
        severity: "blocker",
        category: "game-flow",
        foundBy: "ai",
        title: "Match cannot restart",
        problem: "A completed arena cannot start again.",
        expected: "The arena can start a new match.",
        observed: "The previous session remains active.",
        reproduction: [
          "Finish a match.",
          "Return to the lobby.",
          "Start the same arena again.",
          "Confirm the new match does not start.",
        ],
        suggestedFix: "Clear stale session ownership during cleanup.",
        aiAnalysis: [
          "Root Cause",
          "Cleanup leaves stale session ownership.",
          "",
          "Verification",
          "1. Finish one match.",
          "2. Start the same arena again.",
        ].join("\n"),
        relevantCode: [{
          file: "scripts/session.ts",
          reason: "Owns arena session cleanup.",
        }],
      },
      {
        id: "BUG-003",
        fixed: true,
        severity: "major",
        category: "combat",
        foundBy: "tester",
        title: "Fixed combat issue",
        problem: "Already fixed.",
        expected: "Works.",
        observed: "Was broken.",
        reproduction: [
          "Trigger the combat state.",
          "Confirm the fixed behavior remains correct.",
        ],
      },
    ],
  };
}

describe("bug report preview", () => {
  it("defaults to open blocker/major bugs only", () => {
    const preview = projectBugReportPreview(report());

    expect(preview.bugs.map((bug) => bug.id)).toEqual([
      "BUG-001",
    ]);
    expect(preview.counts).toEqual({
      open: 1,
      fixed: 1,
      total: 2,
      blocker: 1,
      major: 0,
      minor: 0,
    });
  });

  it("can intentionally include minor issues", () => {
    const preview = projectBugReportPreview(report(), {
      includeMinor: true,
    });

    expect(preview.bugs.map((bug) => bug.id)).toEqual([
      "BUG-001",
      "BUG-002",
    ]);
    expect(preview.counts.minor).toBe(1);
  });

  it("separates design mismatches from bugs", () => {
    const base = report();
    const typed: BugReportV2 = {
      ...base,
      bugs: base.bugs.map((bug) =>
        bug.id === "BUG-001"
          ? {
              ...bug,
              issueType: "DESIGN_MISMATCH" as const,
            }
          : bug
      ),
    };
    const preview = projectBugReportPreview(typed);
    const markdown =
      renderBugReportPreviewMarkdown(
        preview,
        "standard",
      );

    expect(markdown).toContain(
      "## Design Mismatches",
    );
    expect(markdown).not.toContain("## Bugs");
  });

  it("keeps solution grounded in Suggested Fix", () => {
    const preview = projectBugReportPreview(report(), {
      mode: "summary",
    });

    expect(preview.bugs[0]?.solution).toBe(
      "Clear stale session ownership during cleanup.",
    );
    expect(preview.bugs[0]?.bugTrigger).toEqual([
      "Finish a match.",
      "Return to the lobby.",
      "Start the same arena again.",
      "Confirm the new match does not start.",
    ]);
  });

  it("keeps technical context out of standard preview", () => {
    const standard = projectBugReportPreview(report(), {
      mode: "standard",
    });
    const full = projectBugReportPreview(report(), {
      mode: "full",
    });

    expect(standard.bugs[0]?.technicalAnalysis).toBeUndefined();
    expect(full.bugs[0]?.technicalAnalysis).toContain(
      "Root Cause",
    );
  });

  it("renders issue before evidence and technical context", () => {
    const preview = projectBugReportPreview(report(), {
      mode: "full",
    });
    const markdown = renderBugReportPreviewMarkdown(preview, "full");

    expect(markdown).toContain("## Bugs");
    expect(markdown).toContain("| # | Severity | Category | Issue |");
    expect(markdown).toContain("#### [BLOCKER] BUG-001 — Match cannot restart");

    expect(markdown).not.toContain("Work Checklist");
    expect(markdown).not.toContain("☐");
    expect(markdown).not.toContain("- [ ]");
    expect(markdown).not.toContain("Minecraft Education 1.26.32");
    expect(markdown).toContain(
      "**Technical Analysis:**\nRoot Cause\nCleanup leaves stale session ownership.",
    );

    expect(markdown.indexOf("**Issue:**")).toBeLessThan(
      markdown.indexOf("**Observed:**"),
    );
    expect(markdown.indexOf("**Expected:**")).toBeLessThan(
      markdown.indexOf("**Technical Analysis:**"),
    );
  });
});
}

// Consolidated suite from engine/packages/bug-report/test/project-confirmed-defect.test.ts
{
{
describe("engineering analysis projection", () => {
  it("merges engineering analysis into persisted Technical Analysis without changing V2 schema", () => {
    const defect: ConfirmedDefect = {
      semanticKey: "subjects=arena|invariants=inv:capacity|failure=session-concurrency",
      subjectIds: ["arena"],
      foundBy: "ai",
      confirmation: {
        basis: "authored-contract-violation",
        evidence: "Selected source contradicts the stated design contract.",
      },
      impact: {
        progression: "degraded",
        recovery: "abnormal",
        stability: "stable",
        coreMechanic: "materially-wrong",
        importantState: "materially-wrong",
        fairness: "materially-affected",
      },
      primaryFailure: "session-concurrency",
      title: "Arena concurrency is capped below available capacity",
      problem: "Teams beyond the second active arena are queued.",
      expected: {
        authority: "selected-artifact",
        statement: "Independent arenas should remain available concurrently.",
        evidenceIds: ["design:arena-layout"],
      },
      observed: {
        statement: "Only two sessions are admitted.",
        evidenceIds: ["source:cap"],
      },
      aiAnalysis: "Static contradiction found.",
      engineeringAnalysis: "Root Cause\nGlobal concurrency gate is lower than available arena capacity.",
      sourceEvidence: [{
        source: {
          artifactId: "map:test",
          relativePath: "scripts/arena.ts",
          range: { lineStart: 10, lineEnd: 10 },
        },
        reason: "Declares concurrency cap.",
      }],
      brokenInvariantIds: ["inv:capacity"],
      repairUnitIds: ["source-range:scripts/arena.ts#L10-L10"],
    };

    const [projected] = projectConfirmedDefects({
      name: "Defense",
      mapVersion: "1.1.1",
      drive: "https://drive.google.com/test",
      baseVersion: "1.1.0",
      testedVersion: "1.1.1",
    }, [defect]);

    expect(projected?.aiAnalysis).toContain("Static contradiction found.");
    expect(projected?.aiAnalysis).toContain("Root Cause");
  });
});
}

// Original suite engine/packages/bug-report/test/project-confirmed-defect.test.ts, blob 82fa54ab85252091601beb752714212db680fc7d
{
const map = {
  name: "Beach Bedwars",
  mapVersion: "1.0.4",
      drive: "https://drive.google.com/file/d/map/view",
  baseVersion: "1.26.20",
  testedVersion: "1.26.32",
};

function defect(
  subject: string,
  overrides: Partial<Omit<
    ConfirmedDefect,
    "semanticKey"
  >> = {},
): ConfirmedDefect {
  const base: Omit<
    ConfirmedDefect,
    "semanticKey"
  > = {
    subjectIds: ["subject:" + subject],
    foundBy: "ai",
    confirmation: {
      basis: "authored-contract-violation",
      evidence:
        "Static implementation contradicts authored cleanup behavior.",
    },
    impact: {
      progression: "degraded",
      recovery: "normal",
      stability: "stable",
      coreMechanic: "correct",
      importantState: "materially-wrong",
      fairness: "unaffected",
    },
    primaryFailure: "player-owned-state",
    title: "Cleanup retains match state",
    problem: "Match-owned state remains after cleanup.",
    expected: {
      authority: "selected-artifact",
      statement: "Match-owned state is reset after cleanup.",
      evidenceIds: ["intent:cleanup"],
    },
    observed: {
      statement: "Previous match state remains active.",
      evidenceIds: ["static:cleanup"],
    },
    aiAnalysis:
      "The cleanup path does not clear the owned state.",
    sourceEvidence: [{
      source: {
        artifactId: "map",
        relativePath: "scripts/session.ts",
        range: {
          lineStart: 10,
          lineEnd: 12,
        },
      },
      reason: "Owns cleanup state mutation.",
    }],
    brokenInvariantIds: ["inv:cleanup"],
    repairUnitIds: ["unit:session-cleanup"],
  };

  const merged = {
    ...base,
    ...overrides,
  };
  return {
    ...merged,
    semanticKey:
      deriveConfirmedDefectSemanticKey(merged),
  };
}

describe("confirmed defect projection", () => {
  it("prefers semantic execution owner over source range for repair-unit identity", () => {
    const units = deriveRepairUnitIdsFromSourceEvidence([{
      source: {
        artifactId: "map",
        relativePath: "scripts/session.ts",
        range: {
          lineStart: 10,
          lineEnd: 12,
        },
      },
      semanticOwnerId:
        "exec:script:session:function%3Acleanup",
      reason: "Cleanup execution region.",
    }]);

    expect(units).toEqual([
      "execution-region:exec:script:session:function%3Acleanup",
    ]);
  });

  it("derives different repair units for different precise source ranges", () => {
    const first = deriveRepairUnitIdsFromSourceEvidence([{
      source: {
        artifactId: "map",
        relativePath: "scripts/session.ts",
        range: {
          lineStart: 10,
          lineEnd: 12,
        },
      },
      reason: "First unit.",
    }]);
    const second = deriveRepairUnitIdsFromSourceEvidence([{
      source: {
        artifactId: "map",
        relativePath: "scripts/session.ts",
        range: {
          lineStart: 30,
          lineEnd: 34,
        },
      },
      reason: "Second unit.",
    }]);

    expect(first).not.toEqual(second);
    expect(first[0]).toContain("#L10-L12");
    expect(second[0]).toContain("#L30-L34");
  });

  it("derives severity and category instead of trusting caller labels", () => {
    const projected = projectConfirmedDefects(
      map,
      [defect("cleanup")],
    );

    expect(projected[0]).toEqual(
      expect.objectContaining({
        severity: "major",
        category: "player-state",
      }),
    );
  });

  it("allocates ids from deterministic semantic identity", () => {
    const a = defect("a-first");
    const z = defect("z-last");
    const ids = allocateBugIds(
      map.name,
      [z, a],
    );

    expect(ids.get(a.semanticKey))
      .toMatch(/^BUG-BB-[A-Z0-9]+$/);
    expect(ids.get(z.semanticKey))
      .toMatch(/^BUG-BB-[A-Z0-9]+$/);
    expect(ids.get(a.semanticKey))
      .not.toBe(ids.get(z.semanticKey));
  });

  it("keeps defect identity stable when causal incident evidence changes", () => {
    const first = defect("cleanup", {
      causalIncidentId: "incident:first-observation",
    });
    const second = defect("cleanup", {
      causalIncidentId: "incident:later-observation",
    });

    expect(first.semanticKey).toBe(second.semanticKey);

    const firstId = allocateBugIds(
      map.name,
      [first],
    ).get(first.semanticKey);
    const secondId = allocateBugIds(
      map.name,
      [second],
    ).get(second.semanticKey);

    expect(firstId).toBe(secondId);
  });

  it("keeps defect identity stable when repair-unit knowledge changes", () => {
    const first = defect("cleanup", {
      repairUnitIds: ["source-range:scripts/session.ts#L10-L12"],
    });
    const second = defect("cleanup", {
      repairUnitIds: ["root-cause:cleanup-session"],
    });

    expect(first.semanticKey).toBe(second.semanticKey);

    const firstId = allocateBugIds(
      map.name,
      [first],
    ).get(first.semanticKey);
    const secondId = allocateBugIds(
      map.name,
      [second],
    ).get(second.semanticKey);

    expect(firstId).toBe(secondId);
  });

  it("keeps ids stable when input order changes", () => {
    const a = defect("a");
    const b = defect("b");
    const first = allocateBugIds(
      map.name,
      [a, b],
    );
    const second = allocateBugIds(
      map.name,
      [b, a],
    );

    expect([...first.entries()].sort()).toEqual(
      [...second.entries()].sort(),
    );
  });

  it("keeps an existing id stable when report contents grow", () => {
    const cleanup = defect("cleanup");
    const before = allocateBugIds(
      map.name,
      [cleanup],
    );
    const after = allocateBugIds(
      map.name,
      [
        defect("a-new-defect"),
        cleanup,
      ],
    );

    expect(after.get(cleanup.semanticKey)).toBe(
      before.get(cleanup.semanticKey),
    );
  });

  it("blocks unresolved multi-symptom semantic groups", () => {
    const result = buildBugReportFromConfirmedDefects({
      map,
      repairBy: "developer",
      defects: [
        defect("symptom-a", {
          causalIncidentId: "incident:cleanup",
        }),
        defect("symptom-b", {
          causalIncidentId: "incident:cleanup",
        }),
      ],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(
      result.issues.map((issue) => issue.code),
    ).toContain("unresolved-defect-group");
  });

  it("applies an explicit canonical group resolution before projection", () => {
    const a = defect("symptom-a", {
      causalIncidentId: "incident:cleanup",
    });
    const b = defect("symptom-b", {
      causalIncidentId: "incident:cleanup",
    });
    const groupKey = groupConfirmedDefects([a, b])[0]!.key;

    const result = buildBugReportFromConfirmedDefects({
      map,
      repairBy: "developer",
      defects: [a, b],
      groupResolutions: [{
        groupKey,
        narrative: {
          title: "Cleanup does not reset match state",
          problem: "Multiple match-owned state surfaces remain after cleanup.",
          expected: {
            statement: "All match-owned state is reset after cleanup.",
          },
          observed: {
            statement: "Multiple state surfaces remain active.",
          },
          expectedAuthority: "selected-artifact",
          primaryFailure: "player-owned-state",
          aiAnalysis: "Grouped symptoms share one cleanup defect.",
          ...(a.sourceEvidence === undefined
            ? {}
            : { sourceEvidence: a.sourceEvidence }),
        },
      }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.bugs).toHaveLength(1);
  });

  it("rejects an unused canonical group resolution", () => {
    const item = defect("cleanup");
    const result = buildBugReportFromConfirmedDefects({
      map,
      repairBy: "developer",
      defects: [item],
      groupResolutions: [{
        groupKey: "missing-group",
        narrative: {
          title: "Unused",
          problem: "Unused",
          expected: { statement: "Unused" },
          observed: { statement: "Unused" },
          expectedAuthority: "selected-artifact",
          primaryFailure: "player-owned-state",
        },
      }],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(
      result.issues.map((issue) => issue.code),
    ).toContain("unused-defect-group-resolution");
  });

  it("rejects a semantic key that does not match structured identity", () => {
    const item = defect("cleanup");
    const result = buildBugReportFromConfirmedDefects({
      map,
      repairBy: "developer",
      defects: [{
        ...item,
        semanticKey: "caller-controlled-key",
      }],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(
      result.issues.map((issue) => issue.code),
    ).toContain("invalid-confirmed-defect");
  });

  it("projects a canonical V2 report", () => {
    const item = defect("cleanup");
    const expectedId = allocateBugIds(
      map.name,
      [item],
    ).get(item.semanticKey);

    const result = buildBugReportFromConfirmedDefects({
      map,
      repairBy: "developer",
      defects: [item],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.bugs[0]).toEqual(
      expect.objectContaining({
        id: expectedId,
        severity: "major",
        category: "player-state",
        foundBy: "ai",
        relevantCode: [{
          file: "scripts/session.ts",
          reason: "Owns cleanup state mutation.",
        }],
      }),
    );
  });
});
}
}

// Consolidated suite from engine/packages/bug-report/test/reconcile-current.test.ts
{
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
}

// Consolidated suite from engine/packages/bug-report/test/report-readiness.test.ts
{
function readyBug(): BugReportV2Bug {
  return {
    id: "BUG-001",
    fixed: false,
    severity: "major",
    category: "game-flow",
    foundBy: "ai",
    title: "Match cannot restart",
    problem: "The arena cannot start another match.",
    expected: "The arena starts another match.",
    observed: "The start interaction no longer works.",
    reproduction: [
      "Finish a match and return to the lobby.",
      "Start the same arena again.",
      "Confirm the new match does not start.",
    ],
    aiAnalysis:
      "Cleanup leaves stale arena ownership after match end.",
    relevantCode: [{
      file: "scripts/session.ts",
      reason: "Owns arena session cleanup.",
    }],
    suggestedFix:
      "Clear arena ownership during match cleanup.",
  };
}

describe("bug report readiness", () => {
  it("accepts a tester-ready bug", () => {
    expect(
      reviewBugReportReadiness([readyBug()]),
    ).toEqual([]);
  });

  it("separates confirmed data from missing tester trigger", () => {
    const {
      reproduction: _reproduction,
      ...bug
    } = readyBug();

    expect(
      reviewBugReportReadiness([bug as BugReportV2Bug])
        .map((issue) => issue.code),
    ).toContain("missing-bug-trigger");
  });

  it("requires technical support for AI-found bugs", () => {
    const {
      aiAnalysis: _analysis,
      relevantCode: _code,
      ...bug
    } = readyBug();

    expect(
      reviewBugReportReadiness([bug as BugReportV2Bug])
        .map((issue) => issue.code),
    ).toEqual(
      expect.arrayContaining([
        "ai-missing-analysis",
        "ai-missing-relevant-code",
        "solution-without-support",
      ]),
    );
  });
});
}

// Consolidated suite from engine/packages/bug-report/test/resolve-confirmed-defect-group.test.ts
{
function defect(
  subject: string,
  overrides: Partial<Omit<
    ConfirmedDefect,
    "semanticKey"
  >> = {},
): ConfirmedDefect {
  const base: Omit<
    ConfirmedDefect,
    "semanticKey"
  > = {
    subjectIds: ["subject:" + subject],
    foundBy: "tester",
    confirmation: {
      basis: "tester-reproduction",
      evidence: "Reproduced symptom " + subject,
    },
    impact: {
      progression: "degraded",
      recovery: "normal",
      stability: "stable",
      coreMechanic: "correct",
      importantState: "materially-wrong",
      fairness: "unaffected",
    },
    primaryFailure: "player-owned-state",
    title: "Symptom " + subject,
    problem: "Symptom problem " + subject,
    expected: {
      authority: "explicit-requirement",
      statement: "Cleanup resets state.",
      evidenceIds: ["req:cleanup"],
    },
    observed: {
      statement: "State remains.",
      evidenceIds: ["obs:" + subject],
    },
    reproduction: [
      "Enter the cleanup scenario for " + subject + ".",
      "Complete the match and return to the lobby.",
      "Confirm the affected state remains after cleanup.",
    ],
    brokenInvariantIds: ["inv:cleanup"],
    repairUnitIds: ["unit:cleanup"],
    causalIncidentId: "incident:cleanup",
  };
  const merged = {
    ...base,
    ...overrides,
  };
  return {
    ...merged,
    semanticKey:
      deriveConfirmedDefectSemanticKey(merged),
  };
}

describe("canonical defect group resolution", () => {
  it("requires explicit canonical narrative while merging semantic evidence", () => {
    const group = groupConfirmedDefects([
      defect("inventory"),
      defect("scoreboard", {
        impact: {
          progression: "blocked",
          recovery: "normal",
          stability: "stable",
          coreMechanic: "materially-wrong",
          importantState: "materially-wrong",
          fairness: "unaffected",
        },
      }),
    ])[0]!;

    const resolved = resolveConfirmedDefectGroup(
      group,
      {
        title: "Cleanup does not reset match state",
        problem: "Multiple match-owned state surfaces remain after cleanup.",
        expected: {
          statement: "All match-owned state is reset after cleanup.",
        },
        observed: {
          statement: "Inventory and scoreboard state persist after cleanup.",
        },
        expectedAuthority: "explicit-requirement",
        primaryFailure: "player-owned-state",
        reproduction: [
          "Complete a match.",
          "Return to lobby.",
          "Start another match and observe retained state.",
        ],
      },
    );

    expect(resolved.semanticKey).toBe(
      deriveConfirmedDefectSemanticKey(resolved),
    );
    expect(resolved.subjectIds).toEqual([
      "subject:inventory",
      "subject:scoreboard",
    ]);
    expect(resolved.impact.progression).toBe("blocked");
    expect(resolved.expected.evidenceIds).toEqual([
      "req:cleanup",
    ]);
    expect(resolved.observed.evidenceIds).toEqual([
      "obs:inventory",
      "obs:scoreboard",
    ]);
    expect(resolved.reproduction).toEqual([
      "Complete a match.",
      "Return to lobby.",
      "Start another match and observe retained state.",
    ]);
  });

  it("requires explicit primary source selection when a group has more than three locations", () => {
    const withSource = (key: string, file: string): ConfirmedDefect =>
      defect(key, {
        foundBy: "ai",
        confirmation: {
          basis: "authored-contract-violation",
          evidence: "Static contradiction " + key,
        },
        sourceEvidence: [{
          source: {
            artifactId: "map",
            relativePath: file,
          },
          reason: "Primary location " + key,
        }],
      });

    const group = groupConfirmedDefects([
      withSource("a", "scripts/a.ts"),
      withSource("b", "scripts/b.ts"),
      withSource("c", "scripts/c.ts"),
      withSource("d", "scripts/d.ts"),
    ])[0]!;

    expect(() =>
      resolveConfirmedDefectGroup(
        group,
        {
          title: "Merged defect",
          problem: "Merged problem",
          expected: { statement: "Expected" },
          observed: { statement: "Observed" },
          expectedAuthority: "explicit-requirement",
          primaryFailure: "player-owned-state",
          aiAnalysis: "Merged analysis",
        },
      )
    ).toThrow(/select primary sourceEvidence explicitly/);
  });

  it("requires explicit discovery origin for mixed AI and tester groups", () => {
    const group = groupConfirmedDefects([
      defect("tester"),
      defect("ai", {
        foundBy: "ai",
        confirmation: {
          basis: "authored-contract-violation",
          evidence: "Static contradiction.",
        },
        aiAnalysis: "Static analysis.",
        sourceEvidence: [{
          source: {
            artifactId: "map",
            relativePath: "scripts/session.ts",
          },
          reason: "Owns cleanup.",
        }],
      }),
    ])[0]!;

    expect(() =>
      resolveConfirmedDefectGroup(
        group,
        {
          title: "Merged defect",
          problem: "Merged problem",
          expected: { statement: "Expected" },
          observed: { statement: "Observed" },
          expectedAuthority: "explicit-requirement",
          primaryFailure: "player-owned-state",
          reproduction: [
          "Complete a match and return to the lobby.",
          "Confirm the affected match state remains after cleanup.",
        ],
        },
      )
    ).toThrow(/explicit foundBy/);

    const resolved = resolveConfirmedDefectGroup(
      group,
      {
        title: "Merged defect",
        problem: "Merged problem",
        expected: { statement: "Expected" },
        observed: { statement: "Observed" },
        expectedAuthority: "explicit-requirement",
        foundBy: "tester",
        primaryFailure: "player-owned-state",
        reproduction: [
          "Complete a match and return to the lobby.",
          "Confirm the affected match state remains after cleanup.",
        ],
      },
    );

    expect(resolved.foundBy).toBe("tester");
  });

  it("uses Expected evidence only from the selected authority", () => {
    const group = groupConfirmedDefects([
      defect("requirement", {
        expected: {
          authority: "explicit-requirement",
          statement: "Cleanup resets state.",
          evidenceIds: ["req:cleanup"],
        },
      }),
      defect("runtime-contract", {
        expected: {
          authority: "runtime-contract",
          statement: "Cleanup resets runtime state.",
          evidenceIds: ["runtime-contract:cleanup"],
        },
      }),
    ])[0]!;

    const resolved = resolveConfirmedDefectGroup(
      group,
      {
        title: "Merged defect",
        problem: "Merged problem",
        expected: { statement: "Cleanup resets state." },
        observed: { statement: "State remains." },
        expectedAuthority: "explicit-requirement",
        primaryFailure: "player-owned-state",
        reproduction: [
          "Complete a match and return to the lobby.",
          "Confirm the affected match state remains after cleanup.",
        ],
      },
    );

    expect(resolved.expected.evidenceIds).toEqual([
      "req:cleanup",
    ]);
  });

  it("refuses groups with multiple primary failures", () => {
    const group = groupConfirmedDefects([
      defect("a"),
      defect("b", {
        primaryFailure: "session-concurrency",
      }),
    ])[0]!;

    expect(() =>
      resolveConfirmedDefectGroup(
        group,
        {
          title: "Merged defect",
          problem: "Merged problem",
          expected: { statement: "Expected" },
          observed: { statement: "Observed" },
          expectedAuthority: "explicit-requirement",
          primaryFailure: "player-owned-state",
          reproduction: [
          "Complete a match and return to the lobby.",
          "Confirm the affected match state remains after cleanup.",
        ],
        },
      )
    ).toThrow(/multiple primary failures/);
  });

  it("does not invent Suggested Fix during group resolution", () => {
    const group = groupConfirmedDefects([
      defect("a"),
      defect("b"),
    ])[0]!;

    const resolved = resolveConfirmedDefectGroup(
      group,
      {
        title: "Merged defect",
        problem: "Merged problem",
        expected: { statement: "Expected" },
        observed: { statement: "Observed" },
        expectedAuthority: "explicit-requirement",
        primaryFailure: "player-owned-state",
        reproduction: [
          "Complete a match and return to the lobby.",
          "Start the next match.",
          "Confirm the merged match-owned state remains from the previous match.",
        ],
      },
    );

    expect(resolved.suggestedFix).toBeUndefined();
  });

  it("does not carry Suggested Fix unless every symptom shares the same advice", () => {
    const group = groupConfirmedDefects([
      defect("a", {
        suggestedFix: "Reset state.",
      }),
      defect("b"),
    ])[0]!;

    const resolved = resolveConfirmedDefectGroup(
      group,
      {
        title: "Merged defect",
        problem: "Merged problem",
        expected: { statement: "Expected" },
        observed: { statement: "Observed" },
        expectedAuthority: "explicit-requirement",
        primaryFailure: "player-owned-state",
        reproduction: [
          "Complete a match and return to the lobby.",
          "Confirm the affected match state remains after cleanup.",
        ],
      },
    );

    expect(resolved.suggestedFix).toBeUndefined();
  });

  it("refuses incompatible defects even when caller constructs a group manually", () => {
    const group = {
      key: "manual",
      defects: [
        defect("a"),
        defect("b", {
          repairUnitIds: ["unit:other"],
        }),
      ],
    };

    expect(() =>
      resolveConfirmedDefectGroup(
        group,
        {
          title: "Merged",
          problem: "Merged",
          expected: { statement: "Expected" },
          observed: { statement: "Observed" },
          expectedAuthority: "explicit-requirement",
          primaryFailure: "player-owned-state",
          reproduction: [
          "Complete a match and return to the lobby.",
          "Confirm the affected match state remains after cleanup.",
        ],
        },
      )
    ).toThrow(/semantically incompatible/);
  });
});
}

// Consolidated suite from engine/packages/bug-report/test/review.test.ts
{
const map = {
  name: "Review Map",
  mapVersion: "1.0.0",
  drive: "https://drive.google.com/file/d/map/view",
  baseVersion: "1.26.20",
  testedVersion: "1.26.32",
};

function defect(
  subject: string,
  progression:
    | "blocked"
    | "degraded"
    | "unaffected" = "degraded",
): ConfirmedDefect {
  const base: Omit<ConfirmedDefect, "semanticKey"> = {
    subjectIds: ["subject:" + subject],
    foundBy: "ai",
    confirmation: {
      basis: "authored-contract-violation",
      evidence: "Current behavior contradicts approved gameplay.",
    },
    impact: {
      progression,
      recovery:
        progression === "blocked"
          ? "abnormal"
          : "normal",
      stability: "stable",
      coreMechanic:
        progression === "unaffected"
          ? "correct"
          : "materially-wrong",
      importantState: "correct",
      fairness: "unaffected",
    },
    primaryFailure: "game-progression",
    title: "Gameplay cannot continue normally",
    problem: "Players cannot continue the required gameplay path normally.",
    expected: {
      authority: "explicit-requirement",
      statement: "The required gameplay path remains completable.",
      evidenceIds: ["design:required-path"],
    },
    observed: {
      statement: "The required gameplay path becomes unavailable.",
      evidenceIds: ["static:path"],
    },
    reproduction: [
      "Start the affected gameplay.",
      "Complete the prerequisite action.",
      "Confirm the required next action is unavailable.",
    ],
    aiAnalysis:
      "The current flow contradicts the approved required path.",
    sourceEvidence: [{
      source: {
        artifactId: "map",
        relativePath: "scripts/gameplay.ts",
        range: {
          lineStart: 20,
          lineEnd: 24,
        },
      },
      reason: "Owns the required transition.",
    }],
    brokenInvariantIds: ["inv:required-path"],
    repairUnitIds: ["unit:gameplay"],
  };

  return {
    ...base,
    semanticKey:
      deriveConfirmedDefectSemanticKey(base),
  };
}

describe("proposed bug chat approval", () => {
  it("projects only blocker and major defects into the default proposed set", () => {
    const proposed = projectProposedBugSet(
      map,
      [
        defect("blocker", "blocked"),
        defect("major", "degraded"),
        defect("minor", "unaffected"),
      ],
    );

    expect(proposed.items).toHaveLength(2);
    expect(proposed.items.map((item) => item.severity))
      .toEqual(["blocker", "major"]);
  });

  it("blocks approval while any proposed bug lacks a review decision", () => {
    const proposed = projectProposedBugSet(
      map,
      [defect("a"), defect("b")],
    );

    const result = applyProposedBugReview(
      proposed,
      [{
        semanticKey: proposed.items[0]!.semanticKey,
        decision: "approve",
      }],
    );

    expect(result.ok).toBe(false);
  });

  it("blocks publication while an item still needs discussion", () => {
    const proposed = projectProposedBugSet(
      map,
      [defect("a")],
    );

    const result = applyProposedBugReview(
      proposed,
      [{
        semanticKey: proposed.items[0]!.semanticKey,
        decision: "needs-discussion",
        reason: "Need to confirm whether this behavior is intentional.",
      }],
    );

    expect(result.ok).toBe(false);
  });

  it("allows explicit rejection without publishing that bug", () => {
    const a = defect("a");
    const b = defect("b");
    const proposed = projectProposedBugSet(map, [a, b]);

    const reviewed = applyProposedBugReview(
      proposed,
      proposed.items.map((item, index) => ({
        semanticKey: item.semanticKey,
        decision:
          index === 0
            ? "approve" as const
            : "reject" as const,
        ...(index === 0
          ? {}
          : { reason: "Confirmed as intended game design." }),
      })),
    );

    expect(reviewed.ok).toBe(true);
    if (!reviewed.ok) return;
    expect(reviewed.approved.approvedSemanticKeys)
      .toHaveLength(1);
    expect(reviewed.approved.rejectedSemanticKeys)
      .toHaveLength(1);
  });

  it("builds canonical Bug Report V2 only from chat-approved defects", () => {
    const a = defect("a");
    const b = defect("b");
    const proposed = projectProposedBugSet(map, [a, b]);

    const reviewed = applyProposedBugReview(
      proposed,
      [
        {
          semanticKey: a.semanticKey,
          decision: "approve",
        },
        {
          semanticKey: b.semanticKey,
          decision: "reject",
          reason: "Confirmed as intended game design.",
        },
      ],
    );

    expect(reviewed.ok).toBe(true);
    if (!reviewed.ok) return;

    const report = buildBugReportFromApprovedBugSet({
      approved: reviewed.approved,
      repairBy: "developer",
      defects: [a, b],
    });

    expect(report.ok).toBe(true);
    if (!report.ok) return;
    expect(report.report.bugs).toHaveLength(1);
  });

  it("rejects fabricated approval state that does not match review decisions", () => {
    const a = defect("a");
    const proposed = projectProposedBugSet(map, [a]);
    const reviewed = applyProposedBugReview(
      proposed,
      [{
        semanticKey: a.semanticKey,
        decision: "approve",
      }],
    );

    expect(reviewed.ok).toBe(true);
    if (!reviewed.ok) return;

    const report = buildBugReportFromApprovedBugSet({
      approved: {
        ...reviewed.approved,
        approvedSemanticKeys: [],
      },
      repairBy: "developer",
      defects: [a],
    });

    expect(report.ok).toBe(false);
  });

  it("refuses artifact generation when chat review approves no bugs", () => {
    const a = defect("a");
    const proposed = projectProposedBugSet(map, [a]);
    const reviewed = applyProposedBugReview(
      proposed,
      [{
        semanticKey: a.semanticKey,
        decision: "reject",
        reason: "Designed behavior.",
      }],
    );

    expect(reviewed.ok).toBe(true);
    if (!reviewed.ok) return;

    const report = buildBugReportFromApprovedBugSet({
      approved: reviewed.approved,
      repairBy: "developer",
      defects: [a],
    });

    expect(report.ok).toBe(false);
  });

  it("rejects an approved set that loses a rejection reason", () => {
    const a = defect("a");
    const b = defect("b");
    const proposed = projectProposedBugSet(map, [a, b]);
    const reviewed = applyProposedBugReview(proposed, [
      { semanticKey: a.semanticKey, decision: "approve" },
      { semanticKey: b.semanticKey, decision: "reject", reason: "Intended behavior." },
    ]);
    expect(reviewed.ok).toBe(true);
    if (!reviewed.ok) return;

    const forged = buildBugReportFromApprovedBugSet({
      approved: {
        ...reviewed.approved,
        decisions: reviewed.approved.decisions.map((item) =>
          item.semanticKey === b.semanticKey
            ? { semanticKey: item.semanticKey, decision: "reject" as const }
            : item
        ),
      },
      repairBy: "developer",
      defects: [a, b],
    });
    expect(forged.ok).toBe(false);
    if (forged.ok) return;
    expect(forged.issues.some((item) =>
      item.message.includes("Rejected approved-set decision requires a reason")
    )).toBe(true);
  });

  it("rejects a stale review when the confirmed candidate set changes", () => {
    const a = defect("a");
    const b = defect("b");
    const proposed = projectProposedBugSet(map, [a]);
    const reviewed = applyProposedBugReview(proposed, [
      { semanticKey: a.semanticKey, decision: "approve" },
    ]);
    expect(reviewed.ok).toBe(true);
    if (!reviewed.ok) return;

    const report = buildBugReportFromApprovedBugSet({
      approved: reviewed.approved,
      repairBy: "developer",
      defects: [a, b],
    });
    expect(report.ok).toBe(false);
    if (report.ok) return;
    expect(report.issues.some((item) =>
      item.message.includes("Missing decisions:")
    )).toBe(true);
  });
});
}
