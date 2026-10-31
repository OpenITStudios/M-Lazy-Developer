// Consolidated same-owner, same-feature, same-lane test family.
// Original cases/assertions preserved; this is NOT executed test proof.
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadCoverageCatalog, loadRegressionCatalog, loadUpdateDeltaCatalog } from "../../src/catalog/catalog-loader.js";
import { validateFailurePatternCatalog, validateRegressionCatalog, validateUpdateDelta } from "../../src/catalog/catalogs.js";

// Original suite: engine/packages/reliability/test/catalog/catalog-loader.test.ts (Git blob 9d3996b430f16c3168a1779368edebc4eb79aa86)
{


describe("reliability catalog loader", () => {
  it("loads validated persistent catalogs", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-catalog-"));
    await mkdir(join(root, "minecraft-updates"), { recursive: true });

    await writeFile(join(root, "regressions.json"), JSON.stringify({
      schemaVersion: 1,
      regressions: [{
        id: "reg",
        title: "Regression",
        domain: "commands",
        discoveredBy: "manual",
        invariantIds: [],
        triggerTags: [],
        capabilityTags: ["command:fill"],
        reproduction: ["run"],
        expected: "works",
        observed: "fails"
      }]
    }));

    await writeFile(join(root, "coverage.json"), JSON.stringify({
      schemaVersion: 1,
      coverage: [{
        domain: "commands",
        lane: "static",
        state: "partial",
        evidence: "Fixture proves the loader accepts evidence-backed partial coverage.",
        proofPaths: ["fixture://commands-static"]
      }]
    }));

    await writeFile(join(root, "minecraft-updates/1.2.3.json"), JSON.stringify({
      schemaVersion: 1,
      delta: {
        toVersion: "1.2.3",
        entries: [{
          id: "change",
          kind: "changed",
          domain: "commands",
          capabilityTags: ["command:fill"],
          affectedIdentifiers: ["fill"],
          summary: "Changed",
          source: "fixture",
          confidence: "documented"
        }]
      }
    }));

    expect(await loadRegressionCatalog(root)).toHaveLength(1);
    expect(await loadCoverageCatalog(root)).toHaveLength(1);
    expect((await loadUpdateDeltaCatalog(root, "1.2.3")).toVersion).toBe("1.2.3");
  });

  it("rejects filename/version mismatch", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-catalog-"));
    await mkdir(join(root, "minecraft-updates"), { recursive: true });
    await writeFile(join(root, "minecraft-updates/1.2.3.json"), JSON.stringify({
      schemaVersion: 1,
      delta: {
        toVersion: "9.9.9",
        entries: []
      }
    }));

    await expect(loadUpdateDeltaCatalog(root, "1.2.3"))
      .rejects.toThrow(/filename\/version mismatch/);
  });
});
}

// Original suite: engine/packages/reliability/test/catalog/catalogs.test.ts (Git blob 230431841ab8e6ed71fadabb20722a8efb12ad30)
{


describe("reliability catalog validation", () => {
  it("rejects duplicate update-delta ids", () => {
    expect(validateUpdateDelta({
      toVersion: "1.2.3",
      entries: [
        {
          id: "same",
          kind: "changed",
          domain: "commands",
          capabilityTags: [],
          affectedIdentifiers: [],
          summary: "a",
          source: "s",
          confidence: "documented",
        },
        {
          id: "same",
          kind: "changed",
          domain: "scripts",
          capabilityTags: [],
          affectedIdentifiers: [],
          summary: "b",
          source: "s",
          confidence: "documented",
        },
      ],
    })).toEqual(expect.arrayContaining([
      "Duplicate update delta entry id: same",
    ]));
  });

  it("requires expected and observed regression behavior", () => {
    expect(validateRegressionCatalog([{
      id: "reg",
      title: "Regression",
      domain: "commands",
      discoveredBy: "manual",
      invariantIds: [],
      triggerTags: [],
      capabilityTags: [],
      reproduction: [],
      expected: "",
      observed: "",
    }])).toHaveLength(2);
  });

  it("requires every durable regression to contribute to cross-map learning", () => {
    const regression = {
      id: "reg-learning",
      title: "Learning regression",
      domain: "state" as const,
      discoveredBy: "manual" as const,
      invariantIds: [],
      triggerTags: [],
      capabilityTags: [],
      reproduction: [],
      expected: "Expected state.",
      observed: "Observed state.",
    };

    expect(validateFailurePatternCatalog([], [regression])).toEqual([
      "Regression reg-learning has no failure-pattern learning coverage.",
    ]);

    expect(validateFailurePatternCatalog([{
      id: "state-boundary-leak",
      title: "State boundary leak",
      domain: "state",
      summary: "State survives a boundary where it should be cleared.",
      invariantIds: ["state.boundary-cleanup"],
      triggerTags: ["state"],
      capabilityTags: ["state"],
      supportingRegressionIds: ["reg-learning"],
      detectionHints: ["Compare mutation and cleanup ownership."],
      retestFocus: ["Repeat the transition with mutated state."],
    }], [regression])).toEqual([]);
  });

  it("accepts the production historical regression vocabulary", () => {
    expect(validateRegressionCatalog([{
      id: "reg-production",
      canonicalIssueId: "reg-production",
      title: "Production regression",
      issueType: "BUG",
      domain: "world",
      discoveredBy: "approved-ai",
      provenance: {
        source: "Canonical Bug Report V2",
        reportPath: "workspace/reports/Map-BugReport.json",
        map: "Map",
        mapVersion: "1.0.0",
        bugId: "BUG-001",
        artifactFingerprint: "sha256:example",
      },
      triggerTags: ["gameplay"],
      capabilityTags: ["world-mutation"],
      reproduction: ["Reproduce the issue."],
      expected: "World state remains isolated.",
      observed: "World state leaks.",
    }])).toEqual([]);
  });
});
}
