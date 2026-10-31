import { describe, expect, it } from "vitest";
import {
  createArenaGenerationMonitor,
  createBufferedTelemetrySink,
  createTelemetryEmitter,
} from "../../../src/index.js";

function fixture() {
  const buffer = createBufferedTelemetrySink();
  const telemetry = createTelemetryEmitter({
    producer: "instrumentation",
    sink: buffer,
    idNamespace: "arena-generation-test",
  });
  return {
    buffer,
    monitor: createArenaGenerationMonitor(telemetry),
  };
}

describe("arena generation lifecycle monitor", () => {
  it("accepts a clean generation advance after reset verification", () => {
    const { buffer, monitor } = fixture();

    expect(monitor.observeStart({
      arenaId: "arena-1",
      arenaGeneration: 1,
    })).toEqual([]);

    monitor.observeResetVerified({
      arenaId: "arena-1",
      arenaGeneration: 1,
    });

    expect(monitor.observeStart({
      arenaId: "arena-1",
      arenaGeneration: 2,
    })).toEqual([]);

    expect(buffer.size).toBe(0);
  });

  it("reports reuse before the previous generation reset is verified", () => {
    const { buffer, monitor } = fixture();

    monitor.observeStart({
      arenaId: "arena-1",
      arenaGeneration: 4,
    });

    expect(monitor.observeStart({
      arenaId: "arena-1",
      arenaGeneration: 5,
      scope: { operationId: "arena-start-5" },
      tick: 120,
    })).toEqual(["reuse-before-reset"]);

    expect(buffer.snapshot()).toEqual([
      expect.objectContaining({
        kind: "arena-generation-anomaly",
        anomaly: "reuse-before-reset",
        arenaId: "arena-1",
        observedGeneration: 5,
        priorGeneration: 4,
        tick: 120,
      }),
    ]);

    // Same anomaly is deduplicated.
    monitor.observeStart({
      arenaId: "arena-1",
      arenaGeneration: 5,
    });
    expect(buffer.size).toBe(1);
  });

  it("reports a generation regression without replacing the current generation", () => {
    const { buffer, monitor } = fixture();

    monitor.observeStart({
      arenaId: "arena-1",
      arenaGeneration: 8,
    });

    expect(monitor.observeStart({
      arenaId: "arena-1",
      arenaGeneration: 7,
    })).toEqual(["generation-regression"]);

    // Because 8 remains current, 9 still sees generation 8 as the prior one.
    expect(monitor.observeStart({
      arenaId: "arena-1",
      arenaGeneration: 9,
    })).toEqual(["reuse-before-reset"]);

    expect(buffer.snapshot()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        anomaly: "generation-regression",
        observedGeneration: 7,
        currentGeneration: 8,
      }),
      expect.objectContaining({
        anomaly: "reuse-before-reset",
        observedGeneration: 9,
        priorGeneration: 8,
      }),
    ]));
  });

  it("reports a terminal callback from an older generation", () => {
    const { buffer, monitor } = fixture();

    monitor.observeStart({
      arenaId: "arena-2",
      arenaGeneration: 10,
    });
    monitor.observeResetVerified({
      arenaId: "arena-2",
      arenaGeneration: 10,
    });
    monitor.observeStart({
      arenaId: "arena-2",
      arenaGeneration: 11,
    });

    expect(monitor.observeTerminal({
      arenaId: "arena-2",
      arenaGeneration: 10,
      scope: { operationId: "old-terminal" },
    })).toEqual(["stale-terminal"]);

    expect(buffer.snapshot()).toEqual([
      expect.objectContaining({
        kind: "arena-generation-anomaly",
        anomaly: "stale-terminal",
        observedGeneration: 10,
        currentGeneration: 11,
      }),
    ]);
  });

  it("resets per-arena observation state independently", () => {
    const { buffer, monitor } = fixture();

    monitor.observeStart({
      arenaId: "arena-a",
      arenaGeneration: 1,
    });
    monitor.observeStart({
      arenaId: "arena-b",
      arenaGeneration: 3,
    });

    monitor.reset("arena-a");

    expect(monitor.observeStart({
      arenaId: "arena-a",
      arenaGeneration: 1,
    })).toEqual([]);
    expect(monitor.observeStart({
      arenaId: "arena-b",
      arenaGeneration: 2,
    })).toEqual(["generation-regression"]);

    expect(buffer.size).toBe(1);
  });
});
