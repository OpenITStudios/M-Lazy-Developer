import { describe, expect, it } from "vitest";
import {
  createBufferedTelemetrySink,
  createEntityProgressMonitor,
  createTelemetryEmitter,
} from "../../../src/index.js";

describe("entity progress monitor", () => {
  it("does not classify intentional idle as a stall", () => {
    const buffer = createBufferedTelemetrySink();
    const telemetry = createTelemetryEmitter({
      producer: "instrumentation",
      sink: buffer,
    });
    const monitor = createEntityProgressMonitor({
      telemetry,
      stallTicks: 20,
      minimumProgressDistance: 1,
    });

    monitor.observe({
      entityKey: "demo:zombie",
      tick: 0,
      position: { x: 0, y: 64, z: 0 },
      expectedToProgress: false,
    });
    monitor.observe({
      entityKey: "demo:zombie",
      tick: 100,
      position: { x: 0, y: 64, z: 0 },
      expectedToProgress: false,
    });

    expect(buffer.size).toBe(0);
  });

  it("emits one stall event after the expected-progress threshold", () => {
    const buffer = createBufferedTelemetrySink();
    const telemetry = createTelemetryEmitter({
      producer: "instrumentation",
      sink: buffer,
    });
    const monitor = createEntityProgressMonitor({
      telemetry,
      stallTicks: 20,
      minimumProgressDistance: 1,
    });

    expect(monitor.observe({
      entityKey: "demo:zombie",
      routeId: "bridge",
      tick: 0,
      position: { x: 0, y: 64, z: 0 },
      expectedToProgress: true,
      scope: { operationId: "route-op" },
    })).toBe(true);

    expect(monitor.observe({
      entityKey: "demo:zombie",
      routeId: "bridge",
      tick: 20,
      position: { x: 0.2, y: 64, z: 0.1 },
      expectedToProgress: true,
      scope: { operationId: "route-op" },
    })).toBe(false);

    expect(buffer.snapshot()).toEqual([
      expect.objectContaining({
        kind: "entity-stall",
        entityKey: "demo:zombie",
        routeId: "bridge",
        stalledTicks: 20,
        tick: 20,
        scope: expect.objectContaining({
          operationId: "route-op",
        }),
      }),
    ]);

    expect(monitor.observe({
      entityKey: "demo:zombie",
      routeId: "bridge",
      tick: 30,
      position: { x: 0.3, y: 64, z: 0.1 },
      expectedToProgress: true,
    })).toBe(false);
    expect(buffer.size).toBe(1);
  });

  it("re-arms after real progress", () => {
    const buffer = createBufferedTelemetrySink();
    const telemetry = createTelemetryEmitter({
      producer: "instrumentation",
      sink: buffer,
    });
    const monitor = createEntityProgressMonitor({
      telemetry,
      stallTicks: 10,
      minimumProgressDistance: 1,
    });

    monitor.observe({
      entityKey: "demo:zombie",
      tick: 0,
      position: { x: 0, y: 64, z: 0 },
      expectedToProgress: true,
    });
    monitor.observe({
      entityKey: "demo:zombie",
      tick: 10,
      position: { x: 0, y: 64, z: 0 },
      expectedToProgress: true,
    });
    expect(buffer.size).toBe(1);

    monitor.observe({
      entityKey: "demo:zombie",
      tick: 11,
      position: { x: 2, y: 64, z: 0 },
      expectedToProgress: true,
    });
    monitor.observe({
      entityKey: "demo:zombie",
      tick: 21,
      position: { x: 2, y: 64, z: 0 },
      expectedToProgress: true,
    });

    expect(buffer.size).toBe(2);
  });

  it("resets its progress window when ticks move backwards", () => {
    const buffer = createBufferedTelemetrySink();
    const telemetry = createTelemetryEmitter({
      producer: "instrumentation",
      sink: buffer,
    });
    const monitor = createEntityProgressMonitor({
      telemetry,
      stallTicks: 10,
      minimumProgressDistance: 1,
    });

    monitor.observe({
      entityKey: "demo:zombie",
      tick: 100,
      position: { x: 0, y: 64, z: 0 },
      expectedToProgress: true,
    });
    monitor.observe({
      entityKey: "demo:zombie",
      tick: 5,
      position: { x: 0, y: 64, z: 0 },
      expectedToProgress: true,
    });
    monitor.observe({
      entityKey: "demo:zombie",
      tick: 14,
      position: { x: 0, y: 64, z: 0 },
      expectedToProgress: true,
    });

    expect(buffer.size).toBe(0);
  });
});
