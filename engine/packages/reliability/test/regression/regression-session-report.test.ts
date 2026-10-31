import { describe, expect, it } from "vitest";
import {
  buildRegressionSessionReport,
  createRuntimeControlPlan,
  multiArenaCutsceneQueueScenario,
} from "../../src/index.js";

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
