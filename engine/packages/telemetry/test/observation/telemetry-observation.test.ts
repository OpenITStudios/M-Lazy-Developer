// Source-preserving consolidation: original test cases remain in isolated lexical blocks.
import { describe, expect, it } from "vitest";
import { createBufferedTelemetrySink, createEntityProgressMonitor, createStateMirrorMonitor, createTelemetryEmitter, emitTeleportFallback, observeReviveCompletion, observeStateMirror } from "../../src/index.js";

// Consolidated suite from engine/packages/telemetry/test/observation/monitors.test.ts
{
describe("telemetry monitors", () => {
  it("reports an entity stall only after the configured progress window", () => {
    const buffer = createBufferedTelemetrySink();
    const telemetry = createTelemetryEmitter({
      producer: "instrumentation",
      sink: buffer,
    });
    const monitor = createEntityProgressMonitor({
      telemetry,
      stallTicks: 20,
      minimumProgressDistance: 0.5,
      repeatCooldownTicks: 20,
    });

    monitor.observe({
      entityKey: "demo:zombie",
      routeId: "bridge",
      position: { x: 0, y: 64, z: 0 },
      tick: 100,
      scope: { operationId: "op-1" },
    });
    monitor.observe({
      entityKey: "demo:zombie",
      routeId: "bridge",
      position: { x: 0.1, y: 64, z: 0.1 },
      tick: 119,
      scope: { operationId: "op-1" },
    });
    expect(buffer.size).toBe(0);

    monitor.observe({
      entityKey: "demo:zombie",
      routeId: "bridge",
      position: { x: 0.1, y: 64, z: 0.1 },
      tick: 120,
      scope: { operationId: "op-1" },
    });

    expect(buffer.snapshot()).toEqual([
      expect.objectContaining({
        kind: "entity-stall",
        entityKey: "demo:zombie",
        routeId: "bridge",
        stalledTicks: 20,
        tick: 120,
      }),
    ]);

    monitor.observe({
      entityKey: "demo:zombie",
      routeId: "bridge",
      position: { x: 0.1, y: 64, z: 0.1 },
      tick: 121,
    });
    expect(buffer.size).toBe(1);
  });

  it("resets stall tracking after meaningful movement or ineligible state", () => {
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
      entityKey: "e",
      position: { x: 0, y: 0, z: 0 },
      tick: 0,
    });
    monitor.observe({
      entityKey: "e",
      position: { x: 2, y: 0, z: 0 },
      tick: 8,
    });
    monitor.observe({
      entityKey: "e",
      position: { x: 2, y: 0, z: 0 },
      tick: 17,
    });
    expect(buffer.size).toBe(0);

    monitor.observe({
      entityKey: "e",
      position: { x: 2, y: 0, z: 0 },
      tick: 18,
      eligible: false,
    });
    monitor.observe({
      entityKey: "e",
      position: { x: 2, y: 0, z: 0 },
      tick: 40,
    });
    expect(buffer.size).toBe(0);
  });

  it("emits state drift once until the drift changes or returns healthy", () => {
    const buffer = createBufferedTelemetrySink();
    const telemetry = createTelemetryEmitter({
      producer: "instrumentation",
      sink: buffer,
    });
    const monitor = createStateMirrorMonitor(telemetry);

    const drift = {
      contractId: "ready",
      authority: {
        surface: { kind: "scoreboard" as const, key: "ready" },
        value: 1,
        revision: 5,
      },
      mirror: {
        surface: { kind: "tag" as const, key: "ready" },
        value: 1,
        revision: 4,
      },
      scope: { arenaId: "arena-1", arenaGeneration: 3 },
    };

    expect(monitor.observe(drift)).toBe(true);
    expect(monitor.observe(drift)).toBe(true);
    expect(buffer.size).toBe(1);

    expect(monitor.observe({
      ...drift,
      mirror: {
        ...drift.mirror,
        revision: 5,
      },
    })).toBe(false);

    expect(monitor.observe(drift)).toBe(true);
    expect(buffer.size).toBe(2);
  });
});
}

// Consolidated suite from engine/packages/telemetry/test/observation/observers.test.ts
{
describe("telemetry observer helpers", () => {
  it("emits state drift only when value or revision diverges", () => {
    const buffer = createBufferedTelemetrySink();
    const telemetry = createTelemetryEmitter({
      producer: "instrumentation",
      sink: buffer,
    });

    expect(observeStateMirror(telemetry, {
      contractId: "ready",
      authority: {
        surface: { kind: "scoreboard", key: "ready" },
        value: 1,
        revision: 4,
      },
      mirror: {
        surface: { kind: "tag", key: "ready" },
        value: 1,
        revision: 4,
      },
    })).toBe(true);
    expect(buffer.size).toBe(0);

    expect(observeStateMirror(telemetry, {
      contractId: "ready",
      authority: {
        surface: { kind: "scoreboard", key: "ready" },
        value: 1,
        revision: 5,
      },
      mirror: {
        surface: { kind: "tag", key: "ready" },
        value: 1,
        revision: 4,
      },
    })).toBe(false);

    expect(buffer.snapshot()[0]).toMatchObject({
      kind: "state-drift",
      contractId: "ready",
    });
  });

  it("classifies revive anomalies deterministically", () => {
    const buffer = createBufferedTelemetrySink();
    const telemetry = createTelemetryEmitter({
      producer: "instrumentation",
      sink: buffer,
    });

    expect(observeReviveCompletion(telemetry, {
      targetPlayerKey: "player-a",
      reviverPlayerKey: "player-a",
    })).toBe(false);

    expect(buffer.snapshot()[0]).toMatchObject({
      kind: "revive-anomaly",
      anomaly: "self-revive",
      targetPlayerKey: "player-a",
      reviverPlayerKey: "player-a",
    });

    buffer.clear();
    expect(observeReviveCompletion(telemetry, {
      targetPlayerKey: "player-a",
      reviverPlayerKey: "player-b",
      targetLifeGeneration: 2,
      currentLifeGeneration: 3,
    })).toBe(false);
    expect(buffer.snapshot()[0]).toMatchObject({
      anomaly: "stale-revive",
    });
  });

  it("does not emit for a valid revive completion", () => {
    const buffer = createBufferedTelemetrySink();
    const telemetry = createTelemetryEmitter({
      producer: "instrumentation",
      sink: buffer,
    });

    expect(observeReviveCompletion(telemetry, {
      targetPlayerKey: "player-a",
      reviverPlayerKey: "player-b",
      targetLifeGeneration: 2,
      currentLifeGeneration: 2,
      targetDead: false,
      activeReviverCount: 1,
      reviverEligible: true,
    })).toBe(true);
    expect(buffer.size).toBe(0);
  });

  it("requires an entity or player for teleport fallback", () => {
    const buffer = createBufferedTelemetrySink();
    const telemetry = createTelemetryEmitter({
      producer: "instrumentation",
      sink: buffer,
    });

    expect(() => emitTeleportFallback(telemetry, {
      reason: "stalled",
    })).toThrow(/entityKey or playerKey/);

    emitTeleportFallback(telemetry, {
      entityKey: "demo:zombie",
      routeId: "bridge",
      reason: "stalled",
    });
    expect(buffer.snapshot()[0]).toMatchObject({
      kind: "teleport-fallback",
      entityKey: "demo:zombie",
      routeId: "bridge",
    });
  });
});
}
