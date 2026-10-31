// Consolidated bounded owner/feature/lane suite. Original tests/assertions preserved.
import { describe, expect, it } from "vitest";
import type { MapCompatibilityFingerprint, MinecraftUpdateDelta, RegressionCase } from "../../src/index.js";
import { buildRegressionExecutionQueue } from "../../src/index.js";
import { buildRegressionSessionReport, createRuntimeControlPlan, multiArenaCutsceneQueueScenario } from "../../src/index.js";

// Original suite: engine/packages/reliability/test/regression/regression-execution-queue.test.ts (blob 14d8b0d4b18118d34f2c9e17232861b508f46fea)
{
const fingerprint: MapCompatibilityFingerprint = {
  schemaVersion: 1,
  mapId: "blitz-build",
  minEngineVersions: [],
  editions: ["bedrock"],
  experiments: [],
  commandVerbs: [],
  scriptModules: [],
  capabilityTags: [
    "multiplayer-session",
    "scoreboard",
  ],
  domains: [
    "multiplayer",
    "state",
  ],
  structures: {
    count: 0,
    parsed: 0,
  },
  worldDatabasePresent: true,
  riskSurfaces: [
    "multiplayer-concurrency",
  ],
};

const delta: MinecraftUpdateDelta = {
  toVersion: "1.26.40",
  entries: [{
    id: "player-session-change",
    kind: "behavior-changed",
    domain: "multiplayer",
    capabilityTags: [
      "multiplayer-session",
    ],
    affectedIdentifiers: [],
    summary:
      "Player session lifecycle changed.",
    source: "test",
    confidence: "documented",
  }],
};

const reconnect: RegressionCase = {
  id: "regression:reconnect",
  title: "Reconnect keeps membership",
  domain: "multiplayer",
  discoveredBy: "runtime",
  invariantIds: ["membership"],
  triggerTags: [
    "disconnect",
    "reconnect",
  ],
  capabilityTags: [
    "multiplayer-session",
  ],
  reproduction: [],
  expected: "membership retained",
  observed: "membership missing",
};

const unrelated: RegressionCase = {
  id: "regression:structure",
  title: "Structure loads",
  domain: "structures",
  discoveredBy: "static",
  invariantIds: ["structure"],
  triggerTags: ["load"],
  capabilityTags: [
    "structure-loading",
  ],
  reproduction: [],
  expected: "load",
  observed: "missing",
};

describe("regression execution queue", () => {
  it("selects relevant historical regressions by capability/domain/update overlap", () => {
    const queue =
      buildRegressionExecutionQueue(
        fingerprint,
        delta,
        [reconnect, unrelated],
      );

    expect(
      queue.selectedRegressionIds,
    ).toEqual([
      "regression:reconnect",
    ]);
    expect(
      queue.manualRequired[0]
        ?.updateOverlapIds,
    ).toEqual([
      "player-session-change",
    ]);
  });

  it("only marks regressions runtime-ready when an explicit scenario binding exists", () => {
    const queue =
      buildRegressionExecutionQueue(
        fingerprint,
        delta,
        [reconnect],
        [{
          regressionId:
            "regression:reconnect",
          scenarioId:
            "scenario:reconnect",
        }],
      );

    expect(
      queue.runtimeReady.map(
        (item) => item.regressionId,
      ),
    ).toEqual([
      "regression:reconnect",
    ]);
    expect(
      queue.runtimeReady[0]?.scenarioId,
    ).toBe(
      "scenario:reconnect",
    );
    expect(
      queue.manualRequired,
    ).toEqual([]);
  });

  it("keeps selected regressions manual when no execution binding exists", () => {
    const queue =
      buildRegressionExecutionQueue(
        fingerprint,
        delta,
        [reconnect],
      );

    expect(
      queue.runtimeReady,
    ).toEqual([]);
    expect(
      queue.manualRequired.map(
        (item) => item.regressionId,
      ),
    ).toEqual([
      "regression:reconnect",
    ]);
  });
});
}

// Original suite: engine/packages/reliability/test/regression/regression-session-report.test.ts (blob 32a7944629c6bb52be356d87e0b88fbf07b1ecff)
{
function runtimeSnapshot(tick: number, secondCutscene = true) {
  return {
    schemaVersion: 1 as const,
    tick,
    players: [
      {
        playerId: "p1",
        connected: true,
        arenaId: "arena1",
        phase: tick >= 102 ? "starting" as const : "assigned" as const,
        progress: 0,
      },
      {
        playerId: "p2",
        connected: true,
        arenaId: "arena2",
        phase: tick >= 102 ? "starting" as const : "assigned" as const,
        progress: 0,
      },
    ],
    arenas: [
      {
        arenaId: "arena1",
        activePlayerIds: ["p1"],
        cutsceneActive: tick >= 102,
        round: 0,
      },
      {
        arenaId: "arena2",
        activePlayerIds: ["p2"],
        cutsceneActive: tick >= 102 ? secondCutscene : false,
        round: 0,
      },
    ],
  };
}

function acknowledgementsForStart(startTick: number) {
  return [
    {
      scenarioId: "reg_multi_arena_cutscene_queue_offset_0",
      runtimeTick: startTick + 1,
      requestedTick: startTick + 1,
      ok: true,
      action: { kind: "assign" as const, playerId: "p1", arenaId: "arena1" },
    },
    {
      scenarioId: "reg_multi_arena_cutscene_queue_offset_0",
      runtimeTick: startTick + 1,
      requestedTick: startTick + 1,
      ok: true,
      action: { kind: "assign" as const, playerId: "p2", arenaId: "arena2" },
    },
    {
      scenarioId: "reg_multi_arena_cutscene_queue_offset_0",
      runtimeTick: startTick + 2,
      requestedTick: startTick + 2,
      ok: true,
      action: { kind: "start" as const, playerId: "p1" },
    },
    {
      scenarioId: "reg_multi_arena_cutscene_queue_offset_0",
      runtimeTick: startTick + 2,
      requestedTick: startTick + 2,
      ok: true,
      action: { kind: "start" as const, playerId: "p2" },
    },
  ];
}

describe("end-to-end regression session report", () => {
  it("reports pass when controls execute on time and observations match", () => {
    const scenario = multiArenaCutsceneQueueScenario(0);
    const controlPlan = createRuntimeControlPlan(scenario.id, scenario.actions);

    const report = buildRegressionSessionReport(
      scenario,
      controlPlan,
      acknowledgementsForStart(100),
      [runtimeSnapshot(101), runtimeSnapshot(102)],
      100,
    );

    expect(report.verdict).toBe("pass");
    expect(report.control.executed).toBe(4);
    expect(report.live.ok).toBe(true);
  });

  it("distinguishes runtime divergence from control failure", () => {
    const scenario = multiArenaCutsceneQueueScenario(0);
    const controlPlan = createRuntimeControlPlan(scenario.id, scenario.actions);

    const report = buildRegressionSessionReport(
      scenario,
      controlPlan,
      acknowledgementsForStart(100),
      [runtimeSnapshot(101), runtimeSnapshot(102, false)],
      100,
    );

    expect(report.verdict).toBe("runtime-divergence");
    expect(report.live.incident?.firstDivergenceTick).toBe(102);
  });

  it("marks a late control action as control failure", () => {
    const scenario = multiArenaCutsceneQueueScenario(0);
    const controlPlan = createRuntimeControlPlan(scenario.id, scenario.actions);
    const acks = acknowledgementsForStart(100);
    acks[3] = { ...acks[3]!, runtimeTick: 103 };

    const report = buildRegressionSessionReport(
      scenario,
      controlPlan,
      acks,
      [runtimeSnapshot(101), runtimeSnapshot(102)],
      100,
    );

    expect(report.verdict).toBe("control-failure");
    expect(report.control.late).toBe(1);
  });

  it("marks missing acknowledgement as incomplete evidence", () => {
    const scenario = multiArenaCutsceneQueueScenario(0);
    const controlPlan = createRuntimeControlPlan(scenario.id, scenario.actions);

    const report = buildRegressionSessionReport(
      scenario,
      controlPlan,
      acknowledgementsForStart(100).slice(0, 3),
      [runtimeSnapshot(101), runtimeSnapshot(102)],
      100,
    );

    expect(report.verdict).toBe("incomplete-evidence");
    expect(report.control.missing).toBe(1);
  });
});
}
