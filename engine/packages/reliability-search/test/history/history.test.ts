// Consolidated same-directory source test suites; assertions retained unchanged.
import { describe } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { AppendOnlyCampaignHistory } from "../../src/index.js";
import { campaignHistoryIdentity } from "../../src/index.js";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadCampaignHistoryDirectory } from "../../src/index.js";
import { persistCampaignHistoryRecord } from "../../src/index.js";
import { analyzeCampaignHistory } from "../../src/index.js";
import { createTargetedSearchTasks } from "../../src/index.js";

// Original suite engine/packages/reliability-search/test/history/history.test.ts, blob 2cde06191d3fd0bbe023733c27f5c6ab08ee07bf
{
describe("append-only campaign history", () => {
  it("retains unique evidence records and rejects duplicates", () => {
    const history = new AppendOnlyCampaignHistory();
    const record = {
      schemaVersion: 1 as const,
      campaignId: "campaign-a",
      createdAt: "2026-09-23T00:00:00Z",
      blindspotTasks: [],
    };

    expect(history.append(record).accepted).toBe(true);
    const duplicate = history.append(record);
    expect(duplicate.accepted).toBe(false);
    expect(duplicate.id).toBe(campaignHistoryIdentity(record));
    expect(history.all()).toHaveLength(1);
  });
});
}

// Original suite engine/packages/reliability-search/test/history/history-storage.test.ts, blob 7111d96470aa45bb5463e74a808efd5235548a14
{
describe("persistent append-only campaign history", () => {
  it("persists once and treats identical evidence as immutable duplicate", async () => {
    const directory = await mkdtemp(join(tmpdir(), "m-bedrock-history-"));
    const record = {
      schemaVersion: 1 as const,
      campaignId: "c1",
      createdAt: "2026-09-23T00:00:00Z",
      mapId: "map-a",
      blindspotTasks: [],
    };

    const first = await persistCampaignHistoryRecord(directory, record);
    const second = await persistCampaignHistoryRecord(directory, record);

    expect(first.written).toBe(true);
    expect(second.written).toBe(false);

    const loaded = await loadCampaignHistoryDirectory(directory);
    expect(loaded).toEqual([record]);
  });
});
}

// Original suite engine/packages/reliability-search/test/history/history-intelligence.test.ts, blob d069b8a71f89610cf6b28486d423d73bf7028887
{
describe("history-driven targeted search", () => {
  it("aggregates historical survived mutants and emits prioritized search tasks", () => {
    const records = [
      {
        schemaVersion: 1 as const,
        campaignId: "c1",
        createdAt: "2026-09-23T00:00:00Z",
        mapId: "map-a",
        mutationReport: {
          total: 1,
          killed: 0,
          survived: 1,
          invalid: 0,
          score: 0,
          byDomain: {},
          results: [{
            descriptor: {
              id: "coord-a",
              operator: "coordinate-shift",
              domain: "command-coordinate" as const,
              description: "shift",
            },
            status: "survived" as const,
          }],
        },
        blindspotTasks: [{
          id: "blindspot:coord-a",
          operator: "coordinate-shift",
          domain: "command-coordinate" as const,
          reason: "no oracle",
          suggestedStrategies: ["topology" as const, "differential" as const],
          priority: "P1" as const,
        }],
      },
      {
        schemaVersion: 1 as const,
        campaignId: "c2",
        createdAt: "2026-09-23T01:00:00Z",
        mapId: "map-b",
        mutationReport: {
          total: 1,
          killed: 0,
          survived: 1,
          invalid: 0,
          score: 0,
          byDomain: {},
          results: [{
            descriptor: {
              id: "coord-b",
              operator: "coordinate-shift",
              domain: "command-coordinate" as const,
              description: "shift",
            },
            status: "survived" as const,
          }],
        },
        blindspotTasks: [{
          id: "blindspot:coord-b",
          operator: "coordinate-shift",
          domain: "command-coordinate" as const,
          reason: "no oracle",
          suggestedStrategies: ["topology" as const, "runtime-observation" as const],
          priority: "P1" as const,
        }],
      },
    ];

    const analysis = analyzeCampaignHistory(records);
    const tasks = createTargetedSearchTasks(
      analysis.blindspots,
      analysis.budget,
    );

    expect(analysis.records).toBe(2);
    expect(analysis.blindspots.items[0]).toMatchObject({
      occurrences: 2,
      maps: ["map-a", "map-b"],
    });
    expect(tasks[0]).toMatchObject({
      priority: "P1",
      operator: "coordinate-shift",
      evidenceCount: 2,
    });
  });
});
}
