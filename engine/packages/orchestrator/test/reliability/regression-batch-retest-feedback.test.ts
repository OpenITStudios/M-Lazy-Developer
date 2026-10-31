import { describe, expect, it } from "vitest";
import type {
  RegressionExecutionQueue,
  RetestPlan,
} from "../../../reliability/src/index.js";
import type {
  RegressionBatchRunResult,
} from "../../src/index.js";
import {
  applyRegressionBatchRetestFeedback,
} from "../../src/index.js";

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
