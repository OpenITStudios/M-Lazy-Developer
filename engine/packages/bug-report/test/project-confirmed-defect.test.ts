// Contract-preserving consolidated report test cases. Existing cases kept.
import { describe } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { projectConfirmedDefects } from "../src/index.js";
import { type ConfirmedDefect } from "../src/index.js";
import { allocateBugIds } from "../src/index.js";
import { buildBugReportFromConfirmedDefects } from "../src/index.js";
import { deriveRepairUnitIdsFromSourceEvidence } from "../src/index.js";
import { groupConfirmedDefects } from "../src/index.js";
import { deriveConfirmedDefectSemanticKey } from "../src/index.js";

// Original suite engine/packages/bug-report/test/engineering-analysis-projection.test.ts, blob 74efd0fe31c2d91cdcca9e0c0c1fe7743b292025
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
