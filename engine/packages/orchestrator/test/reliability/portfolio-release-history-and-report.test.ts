// Source-preserving consolidation: original test cases remain in isolated lexical blocks.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { comparePortfolioReleaseManifests, loadPortfolioReleaseManifest, persistPortfolioReleaseManifest, analyzePortfolioReleaseHistory, portfolioReleaseIntelligenceText, createPortfolioReleaseManifest, portfolioReleaseManifestJson, portfolioReleaseReportText } from "../../src/index.js";
import type { PortfolioReleaseManifest, PortfolioRegressionBatchRunResult } from "../../src/index.js";

// Consolidated suite from engine/packages/orchestrator/test/reliability/portfolio-release-history.test.ts
{
function manifest(
  statusA:
    PortfolioReleaseManifest["maps"][number]["status"],
  statusB:
    PortfolioReleaseManifest["maps"][number]["status"],
): PortfolioReleaseManifest {
  return {
    schemaVersion: 1,
    updateVersion: "1.26.40",
    disposition:
      statusA === "cleared" &&
      statusB === "cleared"
        ? "release-eligible"
        : "blocked",
    requiredMapIds: ["a", "b"],
    totals: {
      maps: 2,
      cleared: 0,
      regressed: 0,
      blocked: 0,
      manualRequired: 0,
      missing: 0,
      regressionPassed: 0,
      regressionRegressed: 0,
      regressionBlocked: 0,
      regressionManualRequired: 0,
    },
    maps: [{
      mapId: "a",
      status: statusA,
      passed: [],
      regressed:
        statusA === "regressed"
          ? [{
              regressionId: "reg:old",
              evidenceIds: ["e"],
              reasons: [],
            }]
          : [],
      blocked: [],
      manualRequired: [],
      evidenceIds: [],
      reasons: [],
    }, {
      mapId: "b",
      status: statusB,
      passed: [],
      regressed: [],
      blocked:
        statusB === "blocked"
          ? [{
              regressionId: "reg:block",
              evidenceIds: [],
              reasons: [],
            }]
          : [],
      manualRequired: [],
      evidenceIds: [],
      reasons: [],
    }],
    evidenceIds: [],
    reasons: [],
  };
}

describe(
  "portfolio release history",
  () => {
    it(
      "persists immutable release manifests and loads them back",
      async () => {
        const root = await mkdtemp(
          join(tmpdir(), "m-bedrock-release-"),
        );

        try {
          const current =
            manifest("cleared", "blocked");

          await persistPortfolioReleaseManifest({
            historyRoot: root,
            releaseId: "release-1",
            manifest: current,
          });

          const loaded =
            await loadPortfolioReleaseManifest(
              root,
              "release-1",
            );

          expect(loaded).toEqual(current);

          await expect(
            persistPortfolioReleaseManifest({
              historyRoot: root,
              releaseId: "release-1",
              manifest: current,
            }),
          ).rejects.toThrow(/already exists/);
        } finally {
          await rm(root, {
            recursive: true,
            force: true,
          });
        }
      },
    );

    it(
      "compares map status and regression deltas between releases",
      () => {
        const before =
          manifest("regressed", "blocked");
        const after =
          manifest("cleared", "cleared");

        const comparison =
          comparePortfolioReleaseManifests(
            "release-1",
            before,
            "release-2",
            after,
          );

        expect(
          comparison.improvedMapIds,
        ).toEqual(["a", "b"]);
        expect(
          comparison.worsenedMapIds,
        ).toEqual([]);
        expect(
          comparison.resolvedRegressions,
        ).toEqual([
          "a::regressed::reg:old",
          "b::blocked::reg:block",
        ]);
        expect(
          comparison.toDisposition,
        ).toBe("release-eligible");
      },
    );

    it(
      "rejects unsafe release history ids",
      async () => {
        const root = await mkdtemp(
          join(tmpdir(), "m-bedrock-release-"),
        );

        try {
          await expect(
            persistPortfolioReleaseManifest({
              historyRoot: root,
              releaseId: "../bad",
              manifest:
                manifest("cleared", "cleared"),
            }),
          ).rejects.toThrow(/Unsafe/);
        } finally {
          await rm(root, {
            recursive: true,
            force: true,
          });
        }
      },
    );
  },
);
}

// Consolidated suite from engine/packages/orchestrator/test/reliability/portfolio-release-intelligence.test.ts
{
function manifest(
  a:
    PortfolioReleaseManifest["maps"][number]["status"],
  b:
    PortfolioReleaseManifest["maps"][number]["status"],
  recurring = false,
): PortfolioReleaseManifest {
  const map = (
    mapId: string,
    status:
      PortfolioReleaseManifest["maps"][number]["status"],
  ) => ({
    mapId,
    status,
    passed: [],
    regressed:
      status === "regressed"
        ? [{
            regressionId:
              recurring
                ? "reg:repeat"
                : "reg:" + mapId,
            evidenceIds: ["e"],
            reasons: [],
          }]
        : [],
    blocked:
      status === "blocked"
        ? [{
            regressionId: "reg:block",
            evidenceIds: [],
            reasons: [],
          }]
        : [],
    manualRequired:
      status === "manual-required"
        ? [{
            regressionId: "reg:manual",
            evidenceIds: [],
            reasons: [],
          }]
        : [],
    evidenceIds: [],
    reasons: [],
  });

  return {
    schemaVersion: 1,
    updateVersion: "1.26.40",
    disposition:
      a === "cleared" &&
      b === "cleared"
        ? "release-eligible"
        : "blocked",
    requiredMapIds: ["a", "b"],
    totals: {
      maps: 2,
      cleared: 0,
      regressed: 0,
      blocked: 0,
      manualRequired: 0,
      missing: 0,
      regressionPassed: 0,
      regressionRegressed: 0,
      regressionBlocked: 0,
      regressionManualRequired: 0,
    },
    maps: [
      map("a", a),
      map("b", b),
    ],
    evidenceIds: [],
    reasons: [],
  };
}

describe("portfolio release intelligence", () => {
  it("tracks map instability using explicit status counts and transitions", () => {
    const intelligence =
      analyzePortfolioReleaseHistory([
        {
          releaseId: "r1",
          manifest:
            manifest("cleared", "blocked"),
        },
        {
          releaseId: "r2",
          manifest:
            manifest("regressed", "cleared"),
        },
        {
          releaseId: "r3",
          manifest:
            manifest("cleared", "cleared"),
        },
      ]);

    const a = intelligence.maps.find(
      (item) => item.mapId === "a",
    )!;

    expect(a.regressed).toBe(1);
    expect(a.worsenedTransitions).toBe(1);
    expect(a.improvedTransitions).toBe(1);
    expect(a.latestStatus).toBe("cleared");
  });

  it("identifies recurring historical regressions without opaque scoring", () => {
    const intelligence =
      analyzePortfolioReleaseHistory([
        {
          releaseId: "r1",
          manifest:
            manifest("regressed", "cleared", true),
        },
        {
          releaseId: "r2",
          manifest:
            manifest("cleared", "cleared", true),
        },
        {
          releaseId: "r3",
          manifest:
            manifest("regressed", "cleared", true),
        },
      ]);

    expect(
      intelligence.recurringRegressions
        .map((item) => ({
          key: item.key,
          occurrences: item.occurrences,
        })),
    ).toEqual([{
      key: "a::regressed::reg:repeat",
      occurrences: 2,
    }]);
  });

  it("reports current blockers only from the latest release snapshot", () => {
    const intelligence =
      analyzePortfolioReleaseHistory([
        {
          releaseId: "r1",
          manifest:
            manifest("regressed", "cleared"),
        },
        {
          releaseId: "r2",
          manifest:
            manifest("cleared", "blocked"),
        },
      ]);

    expect(
      intelligence.currentBlockers
        .map((item) => item.key),
    ).toEqual([
      "b::blocked::reg:block",
    ]);
  });

  it("renders human-readable intelligence from the same aggregate authority", () => {
    const text =
      portfolioReleaseIntelligenceText(
        analyzePortfolioReleaseHistory([{
          releaseId: "r1",
          manifest:
            manifest("cleared", "cleared"),
        }]),
      );

    expect(text).toContain(
      "Portfolio Release Intelligence",
    );
    expect(text).toContain(
      "a: latest=cleared",
    );
  });

  it("rejects duplicate release ids", () => {
    const current =
      manifest("cleared", "cleared");

    expect(() =>
      analyzePortfolioReleaseHistory([
        {
          releaseId: "same",
          manifest: current,
        },
        {
          releaseId: "same",
          manifest: current,
        },
      ])
    ).toThrow(/Duplicate/);
  });
});
}

// Consolidated suite from engine/packages/orchestrator/test/reliability/portfolio-release-report.test.ts
{
const batch: PortfolioRegressionBatchRunResult = {
  updateVersion: "1.26.40",
  maps: [{
    mapId: "blitz-build",
    scheduledPriority: "P0",
    batch: {
      mapId: "blitz-build",
      updateVersion: "1.26.40",
      passed: [{
        regressionId: "reg:reconnect",
        scenarioId: "scenario:reconnect",
        status: "passed",
        evidenceIds: [
          "runtime:z",
          "runtime:a",
        ],
        reasons: ["passed"],
      }],
      regressed: [],
      blocked: [],
      manualRequired: [],
    },
    feedback: {
      plan: {
        mapId: "blitz-build",
        updateVersion: "1.26.40",
        priority: "P0",
        reasons: [],
        suggestedLanes: ["runtime"],
        affectedDomains: ["multiplayer"],
      },
      addedReasons: [],
      addedDomains: [],
    },
  }, {
    mapId: "defense",
    scheduledPriority: "P1",
    batch: {
      mapId: "defense",
      updateVersion: "1.26.40",
      passed: [],
      regressed: [{
        regressionId: "reg:cleanup",
        scenarioId: "scenario:cleanup",
        status: "regressed",
        evidenceIds: ["runtime:cleanup"],
        reasons: ["regressed"],
      }],
      blocked: [],
      manualRequired: [],
    },
    feedback: {
      plan: {
        mapId: "defense",
        updateVersion: "1.26.40",
        priority: "P1",
        reasons: [],
        suggestedLanes: ["runtime"],
        affectedDomains: ["state"],
      },
      addedReasons: [],
      addedDomains: [],
    },
  }],
  passed: 1,
  regressed: 1,
  blocked: 0,
  manualRequired: 0,
};

describe("portfolio release report", () => {
  it("creates a deterministic evidence manifest from batch and release authority", () => {
    const manifest =
      createPortfolioReleaseManifest(batch);

    expect(manifest.disposition).toBe(
      "blocked",
    );
    expect(manifest.totals).toMatchObject({
      maps: 2,
      cleared: 1,
      regressed: 1,
      regressionPassed: 1,
      regressionRegressed: 1,
    });
    expect(manifest.evidenceIds).toEqual([
      "runtime:a",
      "runtime:cleanup",
      "runtime:z",
    ]);
    expect(
      manifest.maps.map((item) => item.mapId),
    ).toEqual([
      "blitz-build",
      "defense",
    ]);
  });

  it("serializes machine-readable manifest with stable trailing newline", () => {
    const manifest =
      createPortfolioReleaseManifest(batch);
    const json =
      portfolioReleaseManifestJson(manifest);

    expect(json.endsWith("\n")).toBe(true);
    expect(
      JSON.parse(json).schemaVersion,
    ).toBe(1);
  });

  it("renders a human-readable report from the manifest authority", () => {
    const report = portfolioReleaseReportText(
      createPortfolioReleaseManifest(batch),
    );

    expect(report).toContain(
      "Decision: blocked",
    );
    expect(report).toContain(
      "defense [regressed] P1",
    );
    expect(report).toContain(
      "REGRESSED reg:cleanup evidence=runtime:cleanup",
    );
    expect(report).toContain(
      "PASSED reg:reconnect evidence=runtime:a,runtime:z",
    );
  });

  it("records explicitly required missing maps in the same manifest", () => {
    const manifest =
      createPortfolioReleaseManifest(
        batch,
        {
          requiredMapIds: [
            "blitz-build",
            "defense",
            "fall-of-pillager",
          ],
        },
      );

    expect(manifest.totals.missing).toBe(1);
    expect(
      manifest.maps.find(
        (item) =>
          item.mapId ===
          "fall-of-pillager",
      )?.status,
    ).toBe("missing");
  });
});
}
