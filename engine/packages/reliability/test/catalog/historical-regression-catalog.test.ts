// Consolidated same-owner, same-feature, same-lane test family.
// Original cases/assertions preserved; this is NOT executed test proof.
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type RegressionCase, loadRegressionCatalog, writeRegressionCatalog, historicalRegressionId, mergeHistoricalRegressionCatalog } from "../../src/index.js";

// Original suite: engine/packages/reliability/test/catalog/catalog-writer.test.ts (Git blob 1bb60833a947dc337bdafed85ce9391b46c2468f)
{


const regression: RegressionCase = {
  id: "regression:reconnect",
  title: "Reconnect keeps membership",
  domain: "multiplayer",
  discoveredBy: "runtime",
  invariantIds: ["membership"],
  triggerTags: ["reconnect"],
  capabilityTags: ["multiplayer-session"],
  reproduction: [
    "1. Join arena.",
    "2. Reconnect player.",
  ],
  expected:
    "Player keeps arena membership.",
  observed:
    "Player became active without membership.",
};

describe("regression catalog writer", () => {
  it("atomically appends a new regression in deterministic id order", async () => {
    const root = await mkdtemp(
      join(tmpdir(), "m-bedrock-regression-"),
    );

    try {
      await writeFile(
        join(root, "regressions.json"),
        JSON.stringify({
          schemaVersion: 1,
          regressions: [{
            ...regression,
            id: "regression:z",
          }],
        }),
        "utf8",
      );

      const result =
        await writeRegressionCatalog(
          root,
          regression,
        );

      expect(result.regressionIds).toEqual([
        "regression:reconnect",
        "regression:z",
      ]);

      const loaded =
        await loadRegressionCatalog(root);
      expect(loaded.map((item) => item.id))
        .toEqual(result.regressionIds);

      const text = await readFile(
        join(root, "regressions.json"),
        "utf8",
      );
      expect(text.endsWith("\n")).toBe(true);
    } finally {
      await rm(root, {
        recursive: true,
        force: true,
      });
    }
  });

  it("is idempotent for identical regression semantics", async () => {
    const root = await mkdtemp(
      join(tmpdir(), "m-bedrock-regression-"),
    );

    try {
      await writeFile(
        join(root, "regressions.json"),
        JSON.stringify({
          schemaVersion: 1,
          regressions: [regression],
        }),
        "utf8",
      );

      const result =
        await writeRegressionCatalog(
          root,
          regression,
        );

      expect(result.regressionCount).toBe(1);
    } finally {
      await rm(root, {
        recursive: true,
        force: true,
      });
    }
  });

  it("rejects an existing regression id with changed semantics", async () => {
    const root = await mkdtemp(
      join(tmpdir(), "m-bedrock-regression-"),
    );

    try {
      await writeFile(
        join(root, "regressions.json"),
        JSON.stringify({
          schemaVersion: 1,
          regressions: [regression],
        }),
        "utf8",
      );

      await expect(
        writeRegressionCatalog(
          root,
          {
            ...regression,
            title: "Changed semantics",
          },
        ),
      ).rejects.toThrow(
        /different semantics/,
      );
    } finally {
      await rm(root, {
        recursive: true,
        force: true,
      });
    }
  });
});
}

// Original suite: engine/packages/reliability/test/catalog/historical-regression-catalog.test.ts (Git blob e4ecc38b5341d7fb6105ff9f99a66e91ee2ef668)
{


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
}
