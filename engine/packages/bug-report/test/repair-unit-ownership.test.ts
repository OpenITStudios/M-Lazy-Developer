import {
  describe,
  expect,
  it,
} from "vitest";
import {
  deriveConfirmedDefectSemanticKey,
  deriveRepairUnitIdsFromSourceEvidence,
  groupConfirmedDefects,
  type ConfirmedDefect,
} from "../src/index.js";

function defect(
  subject: string,
  repairUnitIds: readonly string[],
): ConfirmedDefect {
  const identity = {
    subjectIds: ["subject:" + subject],
    brokenInvariantIds: ["inv:cleanup"],
    repairUnitIds,
    primaryFailure: "player-owned-state" as const,
    causalIncidentId: "incident:cleanup",
  };

  return {
    ...identity,
    semanticKey:
      deriveConfirmedDefectSemanticKey(identity),
    foundBy: "tester",
    confirmation: {
      basis: "tester-reproduction",
      evidence: "Reproduced gameplay mismatch.",
    },
    impact: {
      progression: "degraded",
      recovery: "normal",
      stability: "stable",
      coreMechanic: "correct",
      importantState: "materially-wrong",
      fairness: "unaffected",
    },
    title: "Cleanup retains state",
    problem: "State remains after cleanup.",
    expected: {
      authority: "explicit-requirement",
      statement: "State resets after cleanup.",
      evidenceIds: ["requirement:cleanup"],
    },
    observed: {
      statement: "State remains.",
      evidenceIds: ["tester:cleanup"],
    },
    reproduction: [
      "Complete a match normally.",
      "Return to the lobby.",
      "Confirm the match-owned state remains after cleanup.",
    ],
  };
}

describe("confirmed defect repair unit ownership", () => {
  it("keeps distinct precise source ranges as distinct repair units", () => {
    expect(
      deriveRepairUnitIdsFromSourceEvidence([
        {
          source: {
            artifactId: "map",
            relativePath: "scripts/session.ts",
            range: {
              lineStart: 10,
              lineEnd: 12,
            },
          },
          reason: "Owns cleanup.",
        },
        {
          source: {
            artifactId: "map",
            relativePath: "scripts/session.ts",
            range: {
              lineStart: 40,
              lineEnd: 45,
            },
          },
          reason: "Same implementation unit.",
        },
      ]),
    ).toEqual([
      "source-range:scripts/session.ts#L10-L12",
      "source-range:scripts/session.ts#L40-L45",
    ]);
  });

  it("does not group defects when repair unit identity is unknown", () => {
    const groups = groupConfirmedDefects([
      defect("inventory", []),
      defect("scoreboard", []),
    ]);

    expect(groups).toHaveLength(2);
  });
});
