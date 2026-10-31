import { describe, expect, it } from "vitest";
import {
  createBufferedTelemetrySink,
  createMutationLifecycle,
  createTelemetryEmitter,
} from "../../../src/index.js";

describe("mutation lifecycle instrumentation", () => {
  it("emits apply and verification in one stable operation scope", () => {
    const buffer = createBufferedTelemetrySink();
    const telemetry = createTelemetryEmitter({
      producer: "instrumentation",
      sink: buffer,
    });
    const lifecycle = createMutationLifecycle(telemetry, {
      operationId: "arena-load-7",
      mutationKind: "structure-load",
      routeId: "bridge",
      scope: {
        arenaId: "arena-1",
        arenaGeneration: 7,
      },
    });

    expect(lifecycle.state).toBe("prepared");
    lifecycle.markApplied({ tick: 100 });
    expect(lifecycle.state).toBe("applied");

    lifecycle.verify({
      result: "passed",
      mechanism: "sentinel-block",
      tick: 101,
    });
    expect(lifecycle.state).toBe("verified");

    lifecycle.revalidateRoute({
      result: "passed",
      tick: 102,
    });

    expect(buffer.snapshot()).toEqual([
      expect.objectContaining({
        kind: "mutation-applied",
        mutationKind: "structure-load",
        routeId: "bridge",
        tick: 100,
        scope: {
          arenaId: "arena-1",
          arenaGeneration: 7,
          operationId: "arena-load-7",
        },
      }),
      expect.objectContaining({
        kind: "mutation-verification",
        result: "passed",
        mechanism: "sentinel-block",
        tick: 101,
        scope: expect.objectContaining({
          operationId: "arena-load-7",
        }),
      }),
      expect.objectContaining({
        kind: "route-revalidation",
        routeId: "bridge",
        result: "passed",
        tick: 102,
        scope: expect.objectContaining({
          operationId: "arena-load-7",
        }),
      }),
    ]);
  });

  it("rejects verification or route proof before apply", () => {
    const buffer = createBufferedTelemetrySink();
    const telemetry = createTelemetryEmitter({
      producer: "instrumentation",
      sink: buffer,
    });
    const lifecycle = createMutationLifecycle(telemetry, {
      operationId: "mutation-1",
      mutationKind: "fill",
    });

    expect(() => lifecycle.verify({
      result: "passed",
    })).toThrow(/prior applied/);

    expect(() => lifecycle.revalidateRoute({
      routeId: "bridge",
      result: "passed",
    })).toThrow(/before mutation apply/);

    expect(buffer.size).toBe(0);
  });

  it("rejects duplicate apply and duplicate verification", () => {
    const buffer = createBufferedTelemetrySink();
    const telemetry = createTelemetryEmitter({
      producer: "instrumentation",
      sink: buffer,
    });
    const lifecycle = createMutationLifecycle(telemetry, {
      operationId: "mutation-1",
      mutationKind: "setblock",
    });

    lifecycle.markApplied();
    expect(() => lifecycle.markApplied()).toThrow(/exactly once/);

    lifecycle.verify({ result: "passed" });
    expect(() => lifecycle.verify({ result: "passed" })).toThrow(/prior applied/);
  });
});
