import { describe, expect, it } from "vitest";
import type {
  HistoryDrivenQaPlan,
} from "../../src/index.js";
import type {
  PortfolioRegressionSchedule,
} from "../../../reliability/src/index.js";
import {
  planQaExecutionBudget,
  qaExecutionBudgetPlanText,
} from "../../src/index.js";

const schedule: PortfolioRegressionSchedule = {
  updateVersion: "1.26.40",
  totalMaps: 2,
  totalSelectedRegressions: 4,
  totalRuntimeReady: 3,
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
          "reg:restart",
        ],
        runtimeReady: [{
          regressionId: "reg:cleanup",
          title: "Cleanup",
          domain: "state",
          priorityWeight: 8,
          matchedCapabilityTags: [],
          domainMatched: true,
          updateOverlapIds: [],
          disposition: "runtime-ready",
          scenarioId: "scenario:cleanup",
          reasons: ["queue cleanup"],
        }, {
          regressionId: "reg:restart",
          title: "Restart",
          domain: "state",
          priorityWeight: 5,
          matchedCapabilityTags: [],
          domainMatched: true,
          updateOverlapIds: [],
          disposition: "runtime-ready",
          scenarioId: "scenario:restart",
          reasons: ["queue restart"],
        }],
        manualRequired: [],
      },
      runtimeReadyCount: 2,
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
          "reg:visual",
        ],
        runtimeReady: [{
          regressionId: "reg:reconnect",
          title: "Reconnect",
          domain: "multiplayer",
          priorityWeight: 6,
          matchedCapabilityTags: [],
          domainMatched: true,
          updateOverlapIds: [],
          disposition: "runtime-ready",
          scenarioId: "scenario:reconnect",
          reasons: ["queue reconnect"],
        }],
        manualRequired: [{
          regressionId: "reg:visual",
          title: "Visual",
          domain: "state",
          priorityWeight: 1,
          matchedCapabilityTags: [],
          domainMatched: true,
          updateOverlapIds: [],
          disposition: "manual-required",
          reasons: ["manual"],
        }],
      },
      runtimeReadyCount: 1,
      manualRequiredCount: 1,
    }],
    P2: [],
    P3: [],
  },
};

const recommendations: HistoryDrivenQaPlan = {
  updateVersion: "1.26.40",
  recommendations: [{
    mapId: "defense",
    disposition: "test-first",
    scheduledPriority: "P0",
    runtimeReadyCount: 2,
    manualRequiredCount: 0,
    currentBlockerCount: 1,
    recurringRegressionCount: 0,
    worsenedTransitions: 1,
    reasons: ["current blocker"],
  }, {
    mapId: "blitz",
    disposition: "test-first",
    scheduledPriority: "P1",
    runtimeReadyCount: 1,
    manualRequiredCount: 1,
    currentBlockerCount: 0,
    recurringRegressionCount: 1,
    worsenedTransitions: 0,
    reasons: ["recurring regression"],
  }],
};

describe("QA execution budget planner", () => {
  it("selects runtime cases in recommendation and queue order, then explicitly defers the rest", () => {
    const plan = planQaExecutionBudget(
      schedule,
      recommendations,
      { maxRuntimeCases: 2 },
    );

    expect(
      plan.selected.map(
        (item) => item.regressionId,
      ),
    ).toEqual([
      "reg:cleanup",
      "reg:restart",
    ]);
    expect(
      plan.deferred.map(
        (item) => item.regressionId,
      ),
    ).toEqual([
      "reg:reconnect",
    ]);
    expect(plan.manualRequired).toEqual([{
      mapId: "blitz",
      regressionId: "reg:visual",
    }]);
  });

  it("supports a zero runtime budget without hiding work", () => {
    const plan = planQaExecutionBudget(
      schedule,
      recommendations,
      { maxRuntimeCases: 0 },
    );

    expect(plan.selected).toEqual([]);
    expect(plan.deferred).toHaveLength(3);
    expect(plan.availableRuntimeCases).toBe(3);
  });

  it("rejects mismatched release/update inputs", () => {
    expect(() =>
      planQaExecutionBudget(
        schedule,
        {
          ...recommendations,
          updateVersion: "different",
        },
        { maxRuntimeCases: 1 },
      )
    ).toThrow(/updateVersion mismatch/);
  });

  it("renders selected, deferred, and manual work from the same structured plan", () => {
    const text = qaExecutionBudgetPlanText(
      planQaExecutionBudget(
        schedule,
        recommendations,
        { maxRuntimeCases: 1 },
      ),
    );

    expect(text).toContain(
      "1. defense / reg:cleanup",
    );
    expect(text).toContain(
      "defense / reg:restart (budget-exhausted)",
    );
    expect(text).toContain(
      "blitz / reg:visual",
    );
  });
});
