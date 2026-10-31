import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  checkIndependentArenaCutscenes,
  concurrentArenaStartScenario,
  cutsceneQueueScenarioArbitrary,
  runTimedSessionScenario,
} from "../../src/index.js";

describe("targeted concurrency and timing perturbation", () => {
  it.each([0, 1, 2])(
    "allows independent arena starts with %i tick offset",
    (offset) => {
      const result = runTimedSessionScenario(
        ["arena1", "arena2"],
        concurrentArenaStartScenario(offset),
      );

      expect(result.sequence.ok).toBe(true);
      expect(
        checkIndependentArenaCutscenes(
          result.sequence.finalModel,
          ["arena1", "arena2"],
        ).ok,
      ).toBe(true);
    },
  );

  it("explores cutscene-queue regression scenarios with timing disturbances", () => {
    fc.assert(
      fc.property(
        cutsceneQueueScenarioArbitrary(),
        (scenario) => {
          const result = runTimedSessionScenario(
            ["arena1", "arena2"],
            scenario.actions,
          );

          expect(result.sequence.ok).toBe(true);

          const oracle = checkIndependentArenaCutscenes(
            result.sequence.finalModel,
            ["arena1", "arena2"],
          );
          expect(oracle.ok).toBe(true);
        },
      ),
      { numRuns: 300 },
    );
  });

  it("orders same-tick events deterministically by insertion order", () => {
    const result = runTimedSessionScenario(
      ["arena1"],
      [
        { tick: 0, action: { kind: "join", playerId: "p1" } },
        { tick: 1, action: { kind: "assign", playerId: "p1", arenaId: "arena1" } },
        { tick: 2, action: { kind: "start", playerId: "p1" } },
        { tick: 2, action: { kind: "disconnect", playerId: "p1" } },
      ],
    );

    expect(result.orderedActions[2]?.action.kind).toBe("start");
    expect(result.orderedActions[3]?.action.kind).toBe("disconnect");
    expect(result.sequence.finalModel.players.p1).toMatchObject({
      connected: false,
      phase: "assigned",
      progress: 0,
    });
  });
});
