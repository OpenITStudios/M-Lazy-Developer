import { describe, expect, it } from "vitest";
import {
  comparePreservationSemanticTraces,
  type PreservationSemanticTrace,
  type PreservationTraceEquivalencePolicy,
} from "../src/index.js";

const policy: PreservationTraceEquivalencePolicy = {
  schemaVersion: 1,
  id: "repair-session-start",
  requiredCheckpointIds: [
    "round-start",
    "round-ready",
  ],
  mustPreserveStateKeys: [
    "arena.score",
    "player.inventory",
  ],
  mustChangeStateKeys: [
    "player.phase",
  ],
  allowedChangeStateKeys: [
    "diagnostic.retry-count",
  ],
  timingToleranceTicks: 2,
};

function trace(
  phase: string,
  readyTick: number,
): PreservationSemanticTrace {
  return {
    schemaVersion: 1,
    complete: true,
    frames: [{
      checkpointId: "round-start",
      occurrence: 0,
      tick: 10,
      values: {
        "player.phase": "starting",
        "arena.score": 5,
        "player.inventory": "kit-a",
      },
    }, {
      checkpointId: "round-ready",
      occurrence: 0,
      tick: readyTick,
      values: {
        "player.phase": phase,
        "arena.score": 5,
        "player.inventory": "kit-a",
      },
    }],
  };
}

describe("semantic preservation trace comparison", () => {
  it("accepts intended semantic change while preserving unrelated behavior", () => {
    const result =
      comparePreservationSemanticTraces(
        trace("starting", 20),
        trace("playing", 21),
        policy,
      );

    expect(result.disposition)
      .toBe("changed-as-intended");
    expect(
      result.stateDeltas,
    ).toEqual([
      expect.objectContaining({
        checkpointId: "round-ready",
        stateKey: "player.phase",
        classification: "must-change",
      }),
    ]);
  });

  it("rejects unrelated state drift even when intended behavior changed", () => {
    const after = trace("playing", 21);
    const result =
      comparePreservationSemanticTraces(
        trace("starting", 20),
        {
          ...after,
          frames: after.frames.map((frame) =>
            frame.checkpointId === "round-ready"
              ? {
                  ...frame,
                  values: {
                    ...frame.values,
                    "arena.score": 0,
                  },
                }
              : frame
          ),
        },
        policy,
      );

    expect(result.disposition)
      .toBe("violated");
    expect(
      result.stateDeltas.some(
        (delta) =>
          delta.stateKey === "arena.score" &&
          delta.classification ===
            "must-preserve",
      ),
    ).toBe(true);
  });

  it("fails closed when required checkpoints or trace completion are missing", () => {
    const before = trace("starting", 20);
    const after = trace("playing", 21);

    const result =
      comparePreservationSemanticTraces(
        before,
        {
          ...after,
          complete: false,
          frames: after.frames.slice(0, 1),
        },
        policy,
      );

    expect(result.disposition)
      .toBe("unknown");
    expect(
      result.missingCheckpointInstances,
    ).toContain("round-ready#0");
  });

  it("rejects timing drift beyond tolerance", () => {
    const result =
      comparePreservationSemanticTraces(
        trace("starting", 20),
        trace("playing", 30),
        policy,
      );

    expect(result.disposition)
      .toBe("violated");
    expect(
      result.timingDeltas.some(
        (delta) =>
          delta.exceedsTolerance,
      ),
    ).toBe(true);
  });
});
