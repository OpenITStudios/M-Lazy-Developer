import { describe, expect, it } from "vitest";
import { deriveArenaRepeatedRunValidationPlan } from "../../src/arena/arena-repeated-run-validation.js";
import { compileArenaRepeatedRunRuntime } from "../../src/arena/arena-repeated-run-runtime-compiler.js";

describe("arena repeated-run runtime compiler", () => {
  it("compiles all 1/2/5/20 stages when arena generations and capacity are explicit", () => {
    const plan =
      deriveArenaRepeatedRunValidationPlan();

    // Consolidated from a separate plan smoke test: these are authored
    // runtime acceptance surfaces, not claims of live Minecraft execution.
    expect(plan.runCounts).toEqual([1, 2, 5, 20]);
    expect(plan.stages).toHaveLength(8);
    expect(plan.stages.find(item =>
      item.runs === 20 && item.scope === "all-arenas",
    )?.compareSurfaces).toEqual(expect.arrayContaining([
      "deferred-callbacks",
      "dynamic-properties",
      "pending-random-ticks",
      "world-global-leases",
    ]));

    const result =
      compileArenaRepeatedRunRuntime({
        plan,
        arenaIds: [
          "arena-1",
          "arena-2",
        ],
        arenaGenerations: {
          "arena-1": 1,
          "arena-2": 1,
        },
        playersPerArena: 5,
        targetProfileFingerprint:
          "target",
        fixtureFingerprint:
          "fixture",
        objectiveId: "qa",
        participant: "result",
      });

    expect(
      result.runtimeReady,
    ).toHaveLength(
      plan.stages.length,
    );
    expect(
      result.manualRequired,
    ).toEqual([]);
    expect(
      result.experiments.find(
        (item) =>
          item.id ===
          "arena-repeat:all-arenas:20",
      ),
    ).toBeDefined();
  });

  it("does not invent player capacity", () => {
    const result =
      compileArenaRepeatedRunRuntime({
        plan:
          deriveArenaRepeatedRunValidationPlan(
            [1],
          ),
        arenaIds: ["arena-1"],
        arenaGenerations: {
          "arena-1": 1,
        },
        targetProfileFingerprint:
          "target",
        fixtureFingerprint:
          "fixture",
        objectiveId: "qa",
        participant: "result",
      });

    expect(
      result.manualRequired,
    ).toHaveLength(2);
  });

  it("rejects invalid repeated-run counts before compiling a runtime plan", () => {
    expect(() => deriveArenaRepeatedRunValidationPlan([1, 0]))
      .toThrow(/positive integer/);
  });
});
