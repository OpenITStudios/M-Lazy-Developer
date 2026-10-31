import { describe, expect, it } from "vitest";
import {
  incidentFilename,
  multiArenaCutsceneQueueScenario,
  runLiveRegression,
} from "../../src/index.js";

function snapshot(tick: number, secondCutscene = true) {
  return {
    schemaVersion: 1 as const,
    tick,
    minecraftVersion: "1.26.40",
    artifactFingerprint: "sha",
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

describe("live regression runner", () => {
  it("accepts aligned concurrent cutscene observations", () => {
    const result = runLiveRegression(
      multiArenaCutsceneQueueScenario(0),
      [snapshot(101), snapshot(102)],
      100,
    );

    expect(result.ok).toBe(true);
    expect(result.incident).toBeUndefined();
    expect(result.checkpoints.map((item) => item.scenarioTick)).toEqual([1, 2]);
  });

  it("captures the first divergence as an incident bundle", () => {
    const result = runLiveRegression(
      multiArenaCutsceneQueueScenario(0),
      [snapshot(101), snapshot(102, false), snapshot(103, false)],
      100,
    );

    expect(result.ok).toBe(false);
    expect(result.incident).toMatchObject({
      scenarioId: "reg_multi_arena_cutscene_queue_offset_0",
      firstDivergenceTick: 102,
      scenarioTick: 2,
      minecraftVersion: "1.26.40",
      artifactFingerprint: "sha",
    });
    expect(result.incident?.comparison.ok).toBe(false);
    expect(result.incident?.nearbySnapshots).toHaveLength(3);
    expect(incidentFilename(result.incident!)).toBe(
      "reg_multi_arena_cutscene_queue_offset_0-tick-102.incident.json",
    );
  });

  it("does not guess alignment for snapshots without ticks", () => {
    const noTick = {
      schemaVersion: 1 as const,
      players: [],
      arenas: [],
    };

    const result = runLiveRegression(
      multiArenaCutsceneQueueScenario(0),
      [noTick],
      100,
    );

    expect(result.ok).toBe(false);
    expect(result.checkpoints).toEqual([]);
    expect(result.skippedSnapshots).toEqual([noTick]);
  });
});
