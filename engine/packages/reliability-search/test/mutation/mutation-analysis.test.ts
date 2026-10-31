// Source-preserving consolidation: original test cases remain in isolated lexical blocks.
import { describe, expect, it } from "vitest";
import { mutateFunctionReference, mutateScoreboardObjective, mutateTagFilterOmission, mutateTiming, SESSION_STATE_MUTATIONS, mutateAbsoluteCoordinates, mutateCommandSource, mutateSelectorScope, mutateStructureReference, mutationScoreReport, runSessionMutationCampaign, aggregateBlindspotTasks, blindspotTasksFromMutationResults, recommendSearchBudget, summarizeOperatorEffectiveness } from "../../src/index.js";

// Consolidated suite from engine/packages/reliability-search/test/mutation/extended-mutations.test.ts
{
describe("extended Bedrock mutation operators", () => {
  it("redirects function references", () => {
    expect(mutateFunctionReference("function game/start")[0]?.mutated)
      .toContain("__mutation_missing__/game/start");
  });

  it("substitutes scoreboard objectives", () => {
    expect(
      mutateScoreboardObjective("scoreboard players set @s stage 1")[0]?.mutated,
    ).toContain("__mutation_missing__stage");
  });

  it("removes tag filters while preserving other selector filters", () => {
    expect(
      mutateTagFilterOmission("@a[tag=arena1,scores={stage=1..}]")[0]?.mutated,
    ).toContain("@a[scores={stage=1..}]");
  });

  it("shifts timed actions by one tick without creating negative ticks", () => {
    const mutations = mutateTiming([
      { tick: 0, action: { kind: "join", playerId: "p1" } },
      { tick: 2, action: { kind: "start", playerId: "p1" } },
    ]);

    expect(mutations.some((item) => item.actions[1]?.tick === 1)).toBe(true);
    expect(mutations.some((item) => item.actions[1]?.tick === 3)).toBe(true);
    expect(mutations.every((item) =>
      item.actions.every((entry) => entry.tick >= 0),
    )).toBe(true);
  });
});
}

// Consolidated suite from engine/packages/reliability-search/test/mutation/mutation.test.ts
{
describe("Bedrock-specific source mutations", () => {
  it("broadens scoped selectors", () => {
    const mutations = mutateSelectorScope(
      "scoreboard players set @a[tag=arena1,scores={stage=1..}] active 1",
    );
    expect(mutations.some((item) =>
      item.descriptor.operator === "selector-broaden" &&
      item.mutated.includes("@a active 1"),
    )).toBe(true);
  });

  it("shifts absolute fill coordinates by plus/minus one", () => {
    const mutations = mutateAbsoluteCoordinates(
      "fill 10 20 30 12 22 32 stone",
    );
    expect(mutations).toHaveLength(12);
    expect(mutations.map((item) => item.mutated)).toContain(
      "fill 11 20 30 12 22 32 stone",
    );
  });

  it("redirects structure load references", () => {
    const mutations = mutateStructureReference(
      "structure load demo:arena 0 0 0",
    );
    expect(mutations).toHaveLength(1);
    expect(mutations[0]?.mutated).toContain("demo:__mutation_missing__arena");
  });

  it("combines source mutation operators deterministically", () => {
    const mutations = mutateCommandSource(
      "fill 10 20 30 12 22 32 stone",
    );
    expect(mutations.map((item) => item.descriptor.id))
      .toEqual([...mutations.map((item) => item.descriptor.id)]);
  });
});

describe("session mutation campaign", () => {
  it("kills reset/progress and phase mutations with targeted session cases", () => {
    const results = runSessionMutationCampaign(
      [
        {
          arenaIds: ["arena1"],
          actions: [
            { kind: "join", playerId: "p1" },
            { kind: "assign", playerId: "p1", arenaId: "arena1" },
            { kind: "start", playerId: "p1" },
            { kind: "begin-playing", playerId: "p1" },
            { kind: "progress", playerId: "p1", amount: 3 },
            { kind: "disconnect", playerId: "p1" },
          ],
        },
        {
          arenaIds: ["arena1", "arena2"],
          actions: [
            { kind: "join", playerId: "p1" },
            { kind: "join", playerId: "p2" },
            { kind: "assign", playerId: "p1", arenaId: "arena1" },
            { kind: "assign", playerId: "p2", arenaId: "arena2" },
            { kind: "start", playerId: "p1" },
            { kind: "start", playerId: "p2" },
          ],
        },
      ],
      SESSION_STATE_MUTATIONS,
    );

    const report = mutationScoreReport(results);
    expect(report.total).toBe(SESSION_STATE_MUTATIONS.length);
    expect(report.killed).toBeGreaterThan(0);
    expect(report.byDomain["state-reset"]?.total).toBeGreaterThan(0);
  });
});
}

// Consolidated suite from engine/packages/reliability-search/test/mutation/operator-effectiveness.test.ts
{
function result(
  operator: string,
  domain: "command-coordinate" | "command-selector",
  status: "killed" | "survived",
) {
  return {
    descriptor: {
      id: `${operator}-${status}`,
      operator,
      domain,
      description: operator,
    },
    status,
  } as const;
}

describe("operator effectiveness and blindspot aggregation", () => {
  it("aggregates repeated survived classes across maps and campaigns", () => {
    const campaigns = [
      {
        campaignId: "c1",
        mapId: "map-a",
        results: [
          result("coordinate-shift", "command-coordinate", "survived"),
          result("selector-broaden", "command-selector", "killed"),
        ],
      },
      {
        campaignId: "c2",
        mapId: "map-b",
        results: [
          result("coordinate-shift", "command-coordinate", "survived"),
        ],
      },
    ];

    const effectiveness = summarizeOperatorEffectiveness(campaigns);
    const blindspots = aggregateBlindspotTasks(
      campaigns.flatMap((campaign) =>
        blindspotTasksFromMutationResults(campaign.results).map((task) => ({
          task,
          campaignId: campaign.campaignId,
          mapId: campaign.mapId,
        })),
      ),
    );
    const budget = recommendSearchBudget(effectiveness, blindspots);

    expect(effectiveness.operators[0]).toMatchObject({
      operator: "coordinate-shift",
      survived: 2,
      survivalRate: 1,
      mapsSeen: 2,
    });
    expect(blindspots.items[0]).toMatchObject({
      key: "command-coordinate:coordinate-shift",
      occurrences: 2,
      maps: ["map-a", "map-b"],
    });
    expect(budget.recommendations[0]).toMatchObject({
      operator: "coordinate-shift",
      action: "increase",
    });
  });

  it("can reduce redundant operator pressure after strong kill history", () => {
    const results = Array.from({ length: 12 }, (_, index) => ({
      descriptor: {
        id: `selector-${index}`,
        operator: "selector-broaden",
        domain: "command-selector" as const,
        description: "selector",
      },
      status: "killed" as const,
    }));

    const effectiveness = summarizeOperatorEffectiveness([{
      campaignId: "c",
      results,
    }]);
    const blindspots = aggregateBlindspotTasks([]);
    const budget = recommendSearchBudget(effectiveness, blindspots);

    expect(budget.recommendations[0]).toMatchObject({
      operator: "selector-broaden",
      action: "decrease",
    });
  });
});
}
