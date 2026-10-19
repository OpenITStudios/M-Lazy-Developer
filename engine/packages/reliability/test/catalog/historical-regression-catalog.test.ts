import { describe, expect, it } from "vitest";
import {
  historicalRegressionId,
  mergeHistoricalRegressionCatalog,
  type RegressionCase,
} from "../../src/index.js";

const incoming: RegressionCase = {
  id: "reg_defense_2_0_0_bug_001",
  title: "Arena state leaks",
  domain: "multiplayer",
  discoveredBy: "approved-ai",
  triggerTags: ["arena-isolation"],
  capabilityTags: ["multiplayer"],
  provenance: {
    source: "Canonical Bug Report V2",
    reportPath:
      "workspace/reports/Defense-v2.0.0-BugReport.json",
    map: "Defense",
    mapVersion: "2.0.0",
    bugId: "BUG-001",
    artifactFingerprint:
      "sha256:defense",
  },
  expected:
    "Each arena owns isolated state.",
  observed:
    "Two arenas can write the same state.",
};

describe("historical regression catalog", () => {
  it("derives stable historical incident ids", () => {
    expect(
      historicalRegressionId({
        mapName: "Defense",
        mapVersion: "2.0.0",
        bugId: "BUG-001",
      }),
    ).toBe(
      "reg_defense_2_0_0_bug_001",
    );
  });

  it("preserves compatible legacy history", () => {
    const merged =
      mergeHistoricalRegressionCatalog(
        {
          schemaVersion: 1,
          regressions: [{
            id: "legacy-regression",
            title: "Legacy issue",
            expected: "A",
            observed: "B",
          }],
        },
        [incoming],
      );

    expect(
      merged.regressions.map(
        (item) => item.id,
      ),
    ).toEqual([
      "legacy-regression",
      "reg_defense_2_0_0_bug_001",
    ]);
  });

  it("merges a canonical approved issue into an explicitly mapped legacy incident", () => {
    const canonicalId =
      "reg_defense_2_0_0_bug_001";
    const merged =
      mergeHistoricalRegressionCatalog(
        {
          schemaVersion: 1,
          regressions: [{
            id: "legacy-defense-race",
            canonicalIssueId:
              canonicalId,
            title: "Legacy title",
            invariantIds: [
              "legacy.invariant",
            ],
            expected: "Legacy expected.",
            observed: "Legacy observed.",
          }],
        },
        [{
          ...incoming,
          id: canonicalId,
          canonicalIssueId:
            canonicalId,
        }],
      );

    expect(merged.regressions).toHaveLength(1);
    expect(merged.regressions[0]?.id)
      .toBe("legacy-defense-race");
    expect(
      merged.regressions[0]
        ?.canonicalIssueId,
    ).toBe(canonicalId);
    expect(
      merged.regressions[0]?.title,
    ).toBe("Arena state leaks");
    expect(
      merged.regressions[0]
        ?.invariantIds,
    ).toEqual([
      "legacy.invariant",
    ]);
  });

  it("rejects semantic conflict for an existing historical id", () => {
    expect(() =>
      mergeHistoricalRegressionCatalog(
        {
          schemaVersion: 1,
          regressions: [{
            id: incoming.id,
            expected:
              "Different expected behavior",
            observed:
              "Different observed behavior",
          }],
        },
        [incoming],
      )
    ).toThrow(
      "Historical regression ID semantic conflict",
    );
  });
});
