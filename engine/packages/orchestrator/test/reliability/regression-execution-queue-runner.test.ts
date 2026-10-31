import { describe, expect, it, vi } from "vitest";
import type {
  RegressionExecutionQueue,
} from "../../../reliability/src/index.js";
import type {
  CounterexampleScenario,
  RuntimeActionCapabilityRegistry,
} from "../../../runtime-lab/src/index.js";
import {
  runRegressionExecutionQueue,
} from "../../src/index.js";

const scenario: CounterexampleScenario = {
  schemaVersion: 1,
  id: "scenario:reconnect",
  modelId: "m",
  queryId: "q",
  runtimeStatus: "runtime-bound",
  steps: [{
    index: 1,
    transitionId: "join",
    transitionOwner: "player",
    instruction: "Join arena.",
    runtimeBinding: {
      transitionId: "join",
      actionId: "test.join-arena",
      phase: "stimulus",
      parameters: {
        arenaId: "a1",
      },
    },
  }],
  assertion: {
    queryId: "q",
    instruction: "Verify membership.",
    runtimeBinding: {
      actionId: "probe.scoreboard-value",
      parameters: {
        objectiveId: "members",
        participant: "a1",
      },
    },
  },
  runtimeProtocol: [{
    id: "repro-01",
    phase: "stimulus",
    actionId: "test.join-arena",
    parameters: {
      arenaId: "a1",
    },
  }, {
    id: "assert-counterexample",
    phase: "observe",
    actionId: "probe.scoreboard-value",
    parameters: {
      objectiveId: "members",
      participant: "a1",
    },
  }],
  replayTrace: [],
};

const capabilities: RuntimeActionCapabilityRegistry = {
  schemaVersion: 1,
  actions: [{
    id: "test.join-arena",
    requiredContext: "LIVE_MINECRAFT",
    mutationRisk: "guarded",
    phases: ["stimulus"],
    requiredParameters: {
      arenaId: "string",
    },
  }, {
    id: "probe.scoreboard-value",
    requiredContext: "LOCAL_MINECRAFT",
    mutationRisk: "read-only",
    phases: ["observe"],
    requiredParameters: {
      objectiveId: "string",
      participant: "string",
    },
  }],
};

function queue(): RegressionExecutionQueue {
  return {
    mapId: "blitz-build",
    updateVersion: "1.26.40",
    selectedRegressionIds: [
      "regression:reconnect",
      "regression:visual",
    ],
    runtimeReady: [{
      regressionId: "regression:reconnect",
      title: "Reconnect membership",
      domain: "multiplayer",
      priorityWeight: 7,
      matchedCapabilityTags: [
        "multiplayer-session",
      ],
      domainMatched: true,
      updateOverlapIds: ["session-change"],
      disposition: "runtime-ready",
      scenarioId: scenario.id,
      reasons: ["selected"],
    }],
    manualRequired: [{
      regressionId: "regression:visual",
      title: "Visual alignment",
      domain: "state",
      priorityWeight: 2,
      matchedCapabilityTags: [],
      domainMatched: true,
      updateOverlapIds: [],
      disposition: "manual-required",
      reasons: ["manual"],
    }],
  };
}

describe("regression execution queue runner", () => {
  it("reports passed historical regressions with runtime evidence", async () => {
    const execute = vi.fn(async () => ({
      originalDefectReproduced: false,
      evidenceIds: ["runtime:pass"],
    }));

    const result =
      await runRegressionExecutionQueue(
        {
          queue: queue(),
          resolver: {
            resolve: (id) =>
              id === scenario.id
                ? scenario
                : undefined,
          },
          announcedCapabilities: capabilities,
          context: "LIVE_MINECRAFT",
          mutationRisk: "guarded",
          runtimeProfileMatches: true,
        },
        { execute },
      );

    expect(result.passed.map(
      (item) => item.regressionId,
    )).toEqual(["regression:reconnect"]);
    expect(result.regressed).toEqual([]);
    expect(result.manualRequired.map(
      (item) => item.regressionId,
    )).toEqual(["regression:visual"]);
  });

  it("reports a historical regression when the original defect reproduces", async () => {
    const result =
      await runRegressionExecutionQueue(
        {
          queue: queue(),
          resolver: {
            resolve: () => scenario,
          },
          announcedCapabilities: capabilities,
          context: "LIVE_MINECRAFT",
          mutationRisk: "guarded",
          runtimeProfileMatches: true,
        },
        {
          execute: async () => ({
            originalDefectReproduced: true,
            evidenceIds: ["runtime:regressed"],
          }),
        },
      );

    expect(result.regressed.map(
      (item) => item.regressionId,
    )).toEqual(["regression:reconnect"]);
  });

  it("blocks execution when runtime capability readiness fails", async () => {
    const execute = vi.fn(async () => ({
      originalDefectReproduced: false,
      evidenceIds: ["should-not-run"],
    }));

    const result =
      await runRegressionExecutionQueue(
        {
          queue: queue(),
          resolver: {
            resolve: () => scenario,
          },
          announcedCapabilities: {
            schemaVersion: 1,
            actions: [],
          },
          context: "LIVE_MINECRAFT",
          mutationRisk: "guarded",
          runtimeProfileMatches: true,
        },
        { execute },
      );

    expect(result.blocked[0]?.regressionId)
      .toBe("regression:reconnect");
    expect(execute).not.toHaveBeenCalled();
  });

  it("blocks runtime-ready items whose scenario binding cannot be resolved", async () => {
    const execute = vi.fn(async () => ({
      originalDefectReproduced: false,
      evidenceIds: ["e"],
    }));

    const result =
      await runRegressionExecutionQueue(
        {
          queue: queue(),
          resolver: {
            resolve: () => undefined,
          },
          announcedCapabilities: capabilities,
          context: "LIVE_MINECRAFT",
          mutationRisk: "guarded",
          runtimeProfileMatches: true,
        },
        { execute },
      );

    expect(result.blocked[0]?.reasons.join(" "))
      .toMatch(/could not be resolved/);
    expect(execute).not.toHaveBeenCalled();
  });
});
