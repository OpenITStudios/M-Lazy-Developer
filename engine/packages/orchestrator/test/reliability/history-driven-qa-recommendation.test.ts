import {
  describe,
  expect,
  it,
} from "vitest";
import type {
  PortfolioRegressionSchedule,
} from "../../../reliability/src/index.js";
import type {
  PortfolioReleaseIntelligence,
} from "../../src/index.js";
import {
  historyDrivenQaPlanText,
  recommendHistoryDrivenQa,
} from "../../src/index.js";

const schedule: PortfolioRegressionSchedule = {
  updateVersion: "1.26.40",
  totalMaps: 3,
  totalSelectedRegressions: 3,
  totalRuntimeReady: 2,
  totalManualRequired: 1,
  groups: {
    P0: [{
      mapId: "defense",
      labels: [],
      priority: "P0",
      plan: {
        mapId: "defense",
        updateVersion: "1.26.40",
        priority: "P0",
        reasons: [],
        suggestedLanes: ["runtime"],
        affectedDomains: ["state"],
      },
      queue: {
        mapId: "defense",
        updateVersion: "1.26.40",
        selectedRegressionIds: [
          "reg:cleanup",
        ],
        runtimeReady: [{
          regressionId: "reg:cleanup",
          title: "Cleanup",
          domain: "state",
          priorityWeight: 5,
          matchedCapabilityTags: [],
          domainMatched: true,
          updateOverlapIds: [],
          disposition: "runtime-ready",
          scenarioId: "scenario:cleanup",
          reasons: [],
        }],
        manualRequired: [],
      },
      runtimeReadyCount: 1,
      manualRequiredCount: 0,
    }],
    P1: [{
      mapId: "blitz",
      labels: [],
      priority: "P1",
      plan: {
        mapId: "blitz",
        updateVersion: "1.26.40",
        priority: "P1",
        reasons: [],
        suggestedLanes: ["runtime"],
        affectedDomains: ["multiplayer"],
      },
      queue: {
        mapId: "blitz",
        updateVersion: "1.26.40",
        selectedRegressionIds: [
          "reg:reconnect",
        ],
        runtimeReady: [{
          regressionId: "reg:reconnect",
          title: "Reconnect",
          domain: "multiplayer",
          priorityWeight: 5,
          matchedCapabilityTags: [],
          domainMatched: true,
          updateOverlapIds: [],
          disposition: "runtime-ready",
          scenarioId: "scenario:reconnect",
          reasons: [],
        }],
        manualRequired: [],
      },
      runtimeReadyCount: 1,
      manualRequiredCount: 0,
    }],
    P2: [{
      mapId: "pvp",
      labels: [],
      priority: "P2",
      plan: {
        mapId: "pvp",
        updateVersion: "1.26.40",
        priority: "P2",
        reasons: [],
        suggestedLanes: ["static"],
        affectedDomains: ["state"],
      },
      queue: {
        mapId: "pvp",
        updateVersion: "1.26.40",
        selectedRegressionIds: [
          "reg:inventory",
        ],
        runtimeReady: [],
        manualRequired: [{
          regressionId: "reg:inventory",
          title: "Inventory",
          domain: "state",
          priorityWeight: 2,
          matchedCapabilityTags: [],
          domainMatched: true,
          updateOverlapIds: [],
          disposition: "manual-required",
          reasons: [],
        }],
      },
      runtimeReadyCount: 0,
      manualRequiredCount: 1,
    }],
    P3: [],
  },
};

const intelligence: PortfolioReleaseIntelligence = {
  releases: 4,
  blockedReleases: 2,
  releaseEligibleReleases: 2,
  maps: [{
    mapId: "defense",
    releasesSeen: 4,
    cleared: 2,
    regressed: 1,
    blocked: 1,
    manualRequired: 0,
    missing: 0,
    worsenedTransitions: 2,
    improvedTransitions: 1,
    latestStatus: "blocked",
  }, {
    mapId: "blitz",
    releasesSeen: 4,
    cleared: 3,
    regressed: 1,
    blocked: 0,
    manualRequired: 0,
    missing: 0,
    worsenedTransitions: 1,
    improvedTransitions: 1,
    latestStatus: "cleared",
  }, {
    mapId: "pvp",
    releasesSeen: 4,
    cleared: 4,
    regressed: 0,
    blocked: 0,
    manualRequired: 0,
    missing: 0,
    worsenedTransitions: 0,
    improvedTransitions: 0,
    latestStatus: "cleared",
  }],
  recurringRegressions: [{
    key: "blitz::regressed::reg:reconnect",
    mapId: "blitz",
    kind: "regressed",
    regressionId: "reg:reconnect",
    occurrences: 2,
    releaseIds: ["r1", "r3"],
  }],
  currentBlockers: [{
    key: "defense::blocked::reg:cleanup",
    mapId: "defense",
    kind: "blocked",
    regressionId: "reg:cleanup",
    occurrences: 1,
    releaseIds: ["r4"],
  }],
};

describe("history-driven QA recommendation", () => {
  it("puts current blockers ahead of recurring regressions and manual-only work", () => {
    const plan = recommendHistoryDrivenQa(
      schedule,
      intelligence,
    );

    expect(
      plan.recommendations.map(
        (item) => item.mapId,
      ),
    ).toEqual([
      "defense",
      "blitz",
      "pvp",
    ]);
    expect(
      plan.recommendations[0]
        ?.disposition,
    ).toBe("test-first");
    expect(
      plan.recommendations[2]
        ?.disposition,
    ).toBe("manual-followup");
  });

  it("keeps reasons explicit and auditable", () => {
    const plan = recommendHistoryDrivenQa(
      schedule,
      intelligence,
    );

    const blitz =
      plan.recommendations.find(
        (item) =>
          item.mapId === "blitz",
      )!;

    expect(
      blitz.reasons.join(" "),
    ).toMatch(/Recurring regression history/);
    expect(
      blitz.reasons.join(" "),
    ).toMatch(/Current retest priority: P1/);
  });

  it("renders recommendations from the same structured plan", () => {
    const text = historyDrivenQaPlanText(
      recommendHistoryDrivenQa(
        schedule,
        intelligence,
      ),
    );

    expect(text).toContain(
      "History-Driven QA Plan",
    );
    expect(text).toContain(
      "defense [test-first] P0",
    );
    expect(text).toContain(
      "pvp [manual-followup] P2",
    );
  });
});
