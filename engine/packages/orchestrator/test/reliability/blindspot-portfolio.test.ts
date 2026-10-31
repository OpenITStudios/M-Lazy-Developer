import { describe, expect, it } from "vitest";
import { buildBlindspotPortfolio } from "../../src/reliability/blindspot-portfolio.js";

describe("blindspot portfolio", () => {
  it("builds one portfolio snapshot from multiple mutation campaigns", () => {
    const snapshot = buildBlindspotPortfolio([
      {
        campaignId: "map-a-commands",
        mapId: "map-a",
        results: [{
          descriptor: {
            id: "coord-a",
            operator: "coordinate-shift",
            domain: "command-coordinate",
            description: "shift",
          },
          status: "survived",
          evidence: "no repeated topology",
        }],
      },
      {
        campaignId: "map-b-commands",
        mapId: "map-b",
        results: [{
          descriptor: {
            id: "coord-b",
            operator: "coordinate-shift",
            domain: "command-coordinate",
            description: "shift",
          },
          status: "survived",
        }],
      },
    ], "2026-09-23T00:00:00Z");

    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.campaigns).toBe(2);
    expect(snapshot.blindspots.items[0]).toMatchObject({
      occurrences: 2,
      maps: ["map-a", "map-b"],
      priority: "P1",
    });
    expect(snapshot.budget.recommendations[0]?.action).toBe("increase");
  });
});
