// Source-preserving owner/feature/lane test family; not executable proof.
import { describe, expect, it } from "vitest";
import type { PortfolioRegressionSchedule } from "../../../reliability/src/index.js";
import type { PortfolioReleaseIntelligence } from "../../src/index.js";
import { historyDrivenQaPlanText, recommendHistoryDrivenQa } from "../../src/index.js";
import type { HistoryDrivenQaPlan } from "../../src/index.js";
import { planQaExecutionBudget, qaExecutionBudgetPlanText } from "../../src/index.js";
import type { RegressionExecutionQueue, RetestPlan } from "../../../reliability/src/index.js";
import type { RegressionBatchRunResult } from "../../src/index.js";
import { applyRegressionBatchRetestFeedback } from "../../src/index.js";

// Original suite: engine/packages/orchestrator/test/reliability/history-driven-qa-recommendation.test.ts (blob 72dc4b9c52f2c0b4ba642de59de19d209aa4d334)
{
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
}

// Original suite: engine/packages/orchestrator/test/reliability/qa-execution-budget.test.ts (blob 3be468d3168d74d54038cfdb1d63d151f1b5f2f6)
{
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
}

// Original suite: engine/packages/orchestrator/test/reliability/regression-batch-retest-feedback.test.ts (blob 20865ab1f93919bf9c97cf83d82bf87df83518f3)
{
const plan: RetestPlan = {
  mapId: "blitz-build",
  updateVersion: "1.26.40",
  priority: "P3",
  reasons: [],
  suggestedLanes: ["static"],
  affectedDomains: [],
};

const queue: RegressionExecutionQueue = {
  mapId: "blitz-build",
  updateVersion: "1.26.40",
  selectedRegressionIds: [
    "reg:reconnect",
    "reg:cleanup",
    "reg:visual",
  ],
  runtimeReady: [{
    regressionId: "reg:reconnect",
    title: "Reconnect",
    domain: "multiplayer",
    priorityWeight: 7,
    matchedCapabilityTags: [],
    domainMatched: true,
    updateOverlapIds: [],
    disposition: "runtime-ready",
    scenarioId: "scenario:reconnect",
    reasons: [],
  }, {
    regressionId: "reg:cleanup",
    title: "Cleanup",
    domain: "state",
    priorityWeight: 4,
    matchedCapabilityTags: [],
    domainMatched: true,
    updateOverlapIds: [],
    disposition: "runtime-ready",
    scenarioId: "scenario:cleanup",
    reasons: [],
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
    reasons: [],
  }],
};

describe("regression batch retest feedback", () => {
  it("raises retest priority when a historical defect reproduces", () => {
    const result: RegressionBatchRunResult = {
      mapId: "blitz-build",
      updateVersion: "1.26.40",
      passed: [],
      regressed: [{
        regressionId: "reg:reconnect",
        scenarioId: "scenario:reconnect",
        status: "regressed",
        evidenceIds: ["runtime:e1"],
        reasons: [],
      }],
      blocked: [],
      manualRequired: [],
    };

    const feedback =
      applyRegressionBatchRetestFeedback(
        plan,
        queue,
        result,
      );

    expect(feedback.plan.priority).toBe("P1");
    expect(
      feedback.addedReasons[0]?.kind,
    ).toBe("causal-regression");
    expect(feedback.addedDomains).toEqual([
      "multiplayer",
    ]);
  });

  it("records blocked and manual historical tests as coverage gaps", () => {
    const result: RegressionBatchRunResult = {
      mapId: "blitz-build",
      updateVersion: "1.26.40",
      passed: [],
      regressed: [],
      blocked: [{
        regressionId: "reg:cleanup",
        scenarioId: "scenario:cleanup",
        status: "blocked",
        evidenceIds: [],
        reasons: ["capability gap"],
      }],
      manualRequired: [{
        regressionId: "reg:visual",
        status: "manual-required",
        evidenceIds: [],
        reasons: ["manual"],
      }],
    };

    const feedback =
      applyRegressionBatchRetestFeedback(
        plan,
        queue,
        result,
      );

    expect(
      feedback.addedReasons.map(
        (item) => item.kind,
      ),
    ).toEqual([
      "coverage-gap",
      "coverage-gap",
    ]);
    expect(feedback.addedDomains).toEqual([
      "state",
    ]);
  });

  it("does not add risk for passed historical regressions", () => {
    const result: RegressionBatchRunResult = {
      mapId: "blitz-build",
      updateVersion: "1.26.40",
      passed: [{
        regressionId: "reg:reconnect",
        scenarioId: "scenario:reconnect",
        status: "passed",
        evidenceIds: ["runtime:e1"],
        reasons: [],
      }],
      regressed: [],
      blocked: [],
      manualRequired: [],
    };

    const feedback =
      applyRegressionBatchRetestFeedback(
        plan,
        queue,
        result,
      );

    expect(feedback.addedReasons).toEqual([]);
    expect(feedback.plan).toEqual(plan);
  });

  it("rejects feedback from another update version", () => {
    expect(() =>
      applyRegressionBatchRetestFeedback(
        plan,
        queue,
        {
          mapId: "blitz-build",
          updateVersion: "other",
          passed: [],
          regressed: [],
          blocked: [],
          manualRequired: [],
        },
      )
    ).toThrow(/updateVersion mismatch/);
  });
});
}
