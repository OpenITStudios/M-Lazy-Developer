// Source-preserving owner/feature/lane test family; not executable proof.
import { describe, expect, it } from "vitest";
import type { PortfolioRegressionSchedule } from "../../../reliability/src/index.js";
import type { CounterexampleScenario, RuntimeActionCapabilityRegistry } from "../../../runtime-lab/src/index.js";
import { runPortfolioRegressionSchedule } from "../../src/index.js";
import { vi } from "vitest";
import type { RegressionExecutionQueue } from "../../../reliability/src/index.js";
import { runRegressionExecutionQueue } from "../../src/index.js";

// Original suite: engine/packages/orchestrator/test/reliability/portfolio-regression-batch-runner.test.ts (blob 7bf5ed02db43de59e93eaa1f1edf0957554f4c44)
{
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

const schedule: PortfolioRegressionSchedule = {
  updateVersion: "1.26.40",
  totalMaps: 2,
  totalSelectedRegressions: 2,
  totalRuntimeReady: 1,
  totalManualRequired: 1,
  groups: {
    P0: [{
      mapId: "blitz-build",
      labels: [],
      priority: "P0",
      plan: {
        mapId: "blitz-build",
        updateVersion: "1.26.40",
        priority: "P0",
        reasons: [],
        suggestedLanes: ["runtime"],
        affectedDomains: ["multiplayer"],
      },
      queue: {
        mapId: "blitz-build",
        updateVersion: "1.26.40",
        selectedRegressionIds: [
          "reg:reconnect",
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
          scenarioId: scenario.id,
          reasons: [],
        }],
        manualRequired: [],
      },
      runtimeReadyCount: 1,
      manualRequiredCount: 0,
    }],
    P1: [],
    P2: [{
      mapId: "pvp-arena",
      labels: [],
      priority: "P2",
      plan: {
        mapId: "pvp-arena",
        updateVersion: "1.26.40",
        priority: "P2",
        reasons: [],
        suggestedLanes: ["static"],
        affectedDomains: ["state"],
      },
      queue: {
        mapId: "pvp-arena",
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
          reasons: ["manual"],
        }],
      },
      runtimeReadyCount: 0,
      manualRequiredCount: 1,
    }],
    P3: [],
  },
};

describe("portfolio regression batch runner", () => {
  it("runs higher priority maps first and aggregates runtime/manual outcomes", async () => {
    const result =
      await runPortfolioRegressionSchedule(
        schedule,
        {
          forMap(mapId) {
            if (mapId !== "blitz-build") {
              return undefined;
            }
            return {
              resolver: {
                resolve: () => scenario,
              },
              executor: {
                execute: async () => ({
                  originalDefectReproduced:
                    false,
                  evidenceIds: [
                    "runtime:pass",
                  ],
                }),
              },
              announcedCapabilities:
                capabilities,
              context: "LIVE_MINECRAFT",
              mutationRisk: "guarded",
              runtimeProfileMatches: true,
            };
          },
        },
      );

    expect(
      result.maps.map((item) => item.mapId),
    ).toEqual([
      "blitz-build",
      "pvp-arena",
    ]);
    expect(result.passed).toBe(1);
    expect(result.regressed).toBe(0);
    expect(result.manualRequired).toBe(1);
  });

  it("turns missing map runtime targets into blocked coverage instead of silently passing", async () => {
    const result =
      await runPortfolioRegressionSchedule(
        schedule,
        {
          forMap: () => undefined,
        },
      );

    expect(result.blocked).toBe(1);
    expect(
      result.maps[0]?.feedback.addedReasons
        .some(
          (reason) =>
            reason.kind ===
            "coverage-gap",
        ),
    ).toBe(true);
  });

  it("feeds reproduced historical defects back into each map retest plan", async () => {
    const result =
      await runPortfolioRegressionSchedule(
        schedule,
        {
          forMap(mapId) {
            if (mapId !== "blitz-build") {
              return undefined;
            }
            return {
              resolver: {
                resolve: () => scenario,
              },
              executor: {
                execute: async () => ({
                  originalDefectReproduced:
                    true,
                  evidenceIds: [
                    "runtime:regressed",
                  ],
                }),
              },
              announcedCapabilities:
                capabilities,
              context: "LIVE_MINECRAFT",
              mutationRisk: "guarded",
              runtimeProfileMatches: true,
            };
          },
        },
      );

    expect(result.regressed).toBe(1);
    expect(
      result.maps[0]?.feedback.addedReasons
        .some(
          (reason) =>
            reason.kind ===
            "causal-regression",
        ),
    ).toBe(true);
  });
});
}

// Original suite: engine/packages/orchestrator/test/reliability/regression-execution-queue-runner.test.ts (blob 108e6c4b193fe361b6fa0f457930123bbf7f871c)
{
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
}
