// Source-preserving consolidation: original test cases remain in isolated lexical blocks.
import { describe, expect, it } from "vitest";
import { createBufferedTelemetrySink, createCounterTelemetryIdFactory, createSamplingTelemetrySink, createTelemetryEmitter, createTickBudgetedTelemetrySink, createCallbackTelemetrySink, createFanoutTelemetrySink, createJsonLineTelemetrySink, createTelemetryScopeLease, createValidatingTelemetrySink, createTelemetryFrameCollector, frameTelemetryBatch, captureDeferredGeneration, createArenaStartGuard, createPriorityBufferedTelemetrySink, telemetryEventPriority, createProfileTelemetrySink, telemetryRuntimeProfile, resolveTelemetryRuntimeProfile, createPeriodicTelemetryFlush, createTelemetryFlushController } from "../../src/index.js";
import { parseTelemetryBatch } from "../../../project-model/src/index.js";
import type { TelemetryEvent } from "../../../project-model/src/index.js";

// Consolidated suite from engine/packages/telemetry/test/core/budget.test.ts
{
describe("telemetry performance budgets", () => {
  it("limits events per tick and records dropped metrics", () => {
    const buffer = createBufferedTelemetrySink();
    const dropped: string[] = [];
    const budget = createTickBudgetedTelemetrySink(buffer, {
      maxEventsPerTick: 2,
      onDrop(event, reason) {
        dropped.push(event.eventId + ":" + reason);
      },
    });
    const telemetry = createTelemetryEmitter({
      producer: "instrumentation",
      sink: budget,
    });

    telemetry.routeRevalidation({
      routeId: "a",
      result: "passed",
      tick: 10,
    });
    telemetry.routeRevalidation({
      routeId: "b",
      result: "passed",
      tick: 10,
    });
    const third = telemetry.routeRevalidation({
      routeId: "c",
      result: "passed",
      tick: 10,
    });

    expect(buffer.size).toBe(2);
    expect(budget.stats()).toEqual({
      emitted: 2,
      dropped: 1,
      droppedByKind: {
        "route-revalidation": 1,
      },
    });
    expect(dropped).toEqual([
      third.eventId + ":tick-budget-exceeded",
    ]);

    telemetry.routeRevalidation({
      routeId: "d",
      result: "passed",
      tick: 11,
    });
    expect(buffer.size).toBe(3);
  });

  it("applies a separate bounded budget to unticked events", () => {
    const buffer = createBufferedTelemetrySink();
    const budget = createTickBudgetedTelemetrySink(buffer, {
      maxEventsPerTick: 10,
      maxEventsWithoutTick: 1,
    });
    const telemetry = createTelemetryEmitter({
      producer: "manual",
      sink: budget,
    });

    telemetry.mutationVerification({ result: "passed" });
    telemetry.mutationVerification({ result: "failed" });

    expect(buffer.size).toBe(1);
    expect(budget.stats().dropped).toBe(1);

    budget.resetStats();
    expect(budget.stats()).toEqual({
      emitted: 0,
      dropped: 0,
      droppedByKind: {},
    });
  });

  it("samples high-frequency events deterministically per key", () => {
    const buffer = createBufferedTelemetrySink();
    const sampled = createSamplingTelemetrySink(buffer, {
      every: 3,
      key: (event) => event.kind,
    });
    const telemetry = createTelemetryEmitter({
      producer: "instrumentation",
      sink: sampled,
      idFactory: createCounterTelemetryIdFactory("instrumentation"),
    });

    for (let index = 0; index < 7; index += 1) {
      telemetry.entityStall({
        entityKey: "zombie-" + index,
      });
    }

    expect(buffer.snapshot().map((event) => event.eventId)).toEqual([
      "instrumentation:entity-stall:1",
      "instrumentation:entity-stall:4",
      "instrumentation:entity-stall:7",
    ]);
  });
});
}

// Consolidated suite from engine/packages/telemetry/test/core/emitter.test.ts
{
describe("telemetry emitter sdk", () => {
  it("assigns monotonic sequence within its configured stream", () => {
    const buffer = createBufferedTelemetrySink();
    const emitter = createTelemetryEmitter({
      producer: "instrumentation",
      sink: buffer,
      streamId: "arena-runtime",
      tickProvider: () => 42,
    });

    const first = emitter.routeRevalidation({
      routeId: "bridge",
      result: "passed",
    });
    const second = emitter.mutationApplied({
      mutationKind: "fill",
      routeId: "bridge",
    });

    expect(first).toMatchObject({
      streamId: "arena-runtime",
      sequence: 1,
      tick: 42,
    });
    expect(second).toMatchObject({
      streamId: "arena-runtime",
      sequence: 2,
      tick: 42,
    });
  });

  it("merges base, dynamic, and event scope while filling tick and timestamp", () => {
    const buffer = createBufferedTelemetrySink();
    const lease = createTelemetryScopeLease({
      arenaId: "arena-1",
      arenaGeneration: 4,
    });

    const emitter = createTelemetryEmitter({
      producer: "instrumentation",
      sink: buffer,
      baseScope: { subsystemGeneration: 2 },
      scopeProvider: () => lease.current(),
      tickProvider: () => 120,
      timestampProvider: () => "2026-09-24T00:00:00.000Z",
      idFactory: createCounterTelemetryIdFactory("qa"),
    });

    const event = emitter.entityStall({
      entityKey: "demo:zombie",
      routeId: "bridge",
      stalledTicks: 80,
      scope: {
        entityKey: "demo:zombie",
        operationId: "mutation-1",
      },
    });

    expect(event.eventId).toBe("qa:entity-stall:1");
    expect(event.tick).toBe(120);
    expect(event.timestamp).toBe("2026-09-24T00:00:00.000Z");
    expect(event.scope).toEqual({
      subsystemGeneration: 2,
      arenaId: "arena-1",
      arenaGeneration: 4,
      entityKey: "demo:zombie",
      operationId: "mutation-1",
    });
    expect(buffer.snapshot()).toEqual([event]);
  });

  it("event fields override providers without mutating the scope lease", () => {
    const buffer = createBufferedTelemetrySink();
    const lease = createTelemetryScopeLease({ arenaId: "arena-1" });
    const emitter = createTelemetryEmitter({
      producer: "qa",
      sink: buffer,
      scopeProvider: () => lease.current(),
      tickProvider: () => 10,
      timestampProvider: () => "provider-time",
    });

    const event = emitter.routeRevalidation({
      routeId: "bridge",
      result: "passed",
      tick: 20,
      timestamp: "event-time",
      scope: { arenaGeneration: 3 },
    });

    expect(event.tick).toBe(20);
    expect(event.timestamp).toBe("event-time");
    expect(event.scope).toEqual({
      arenaId: "arena-1",
      arenaGeneration: 3,
    });
    expect(lease.current()).toEqual({ arenaId: "arena-1" });
  });

  it("buffers with a bounded ring and exports a valid telemetry batch", () => {
    const buffer = createBufferedTelemetrySink(2);
    const emitter = createTelemetryEmitter({
      producer: "runtime",
      sink: buffer,
      idFactory: createCounterTelemetryIdFactory("runtime"),
    });

    emitter.routeRevalidation({
      routeId: "a",
      result: "passed",
    });
    emitter.routeRevalidation({
      routeId: "b",
      result: "passed",
    });
    emitter.routeRevalidation({
      routeId: "c",
      result: "failed",
    });

    expect(buffer.size).toBe(2);
    expect(buffer.dropped).toBe(1);
    const batch = buffer.batch({
      sessionId: "run-1",
      artifactId: "art-1",
    });
    expect(batch.droppedEvents).toBe(1);
    expect(parseTelemetryBatch(batch).events.map((event) => event.eventId))
      .toEqual([
        "runtime:route-revalidation:2",
        "runtime:route-revalidation:3",
      ]);
  });

  it("rejects duplicate ids across emitters sharing one buffer", () => {
    const buffer = createBufferedTelemetrySink();
    const first = createTelemetryEmitter({
      producer: "runtime",
      sink: buffer,
      idFactory: createCounterTelemetryIdFactory("shared"),
    });
    const second = createTelemetryEmitter({
      producer: "runtime",
      sink: buffer,
      idFactory: createCounterTelemetryIdFactory("shared"),
    });

    first.routeRevalidation({
      routeId: "bridge",
      result: "passed",
    });

    expect(() => second.routeRevalidation({
      routeId: "bridge",
      result: "failed",
    })).toThrow(/Duplicate telemetry eventId/);
  });

  it("keeps default ids unique across emitter instances", () => {
    const left = createTelemetryEmitter({
      producer: "instrumentation",
      sink: createBufferedTelemetrySink(),
    });
    const right = createTelemetryEmitter({
      producer: "instrumentation",
      sink: createBufferedTelemetrySink(),
    });

    const a = left.routeRevalidation({
      routeId: "a",
      result: "passed",
    });
    const b = right.routeRevalidation({
      routeId: "b",
      result: "passed",
    });

    expect(a.eventId).not.toBe(b.eventId);
  });

  it("supports validating, fanout, callback, and json-line sinks", () => {
    const seen: string[] = [];
    const lines: string[] = [];
    const sink = createFanoutTelemetrySink([
      createCallbackTelemetrySink((event) => seen.push(event.eventId)),
      createJsonLineTelemetrySink((line) => lines.push(line)),
    ]);
    const validating = createValidatingTelemetrySink(sink);
    const emitter = createTelemetryEmitter({
      producer: "qa",
      sink: validating,
    });

    const event = emitter.mutationVerification({
      result: "passed",
      mechanism: "sentinel",
    });

    expect(seen).toEqual([event.eventId]);
    expect(JSON.parse(lines[0] ?? "{}")).toMatchObject({
      eventId: event.eventId,
      kind: "mutation-verification",
    });
  });
  it("emits gameplay state and outcome events with shared scope", () => {
    const events: any[] = [];
    const emitter = createTelemetryEmitter({
      producer: "instrumentation",
      sink: {
        emit(event) {
          events.push(event);
        },
      },
      baseScope: {
        arenaId: "arena-1",
        arenaGeneration: 4,
      },
      tickProvider: () => 120,
      idNamespace: "intent",
    });

    const state = emitter.stateObservation({
      path: "session.phase",
      value: "active",
      scope: {
        playerKey: "player-a",
      },
    });

    const outcome = emitter.gameplayOutcome({
      outcomeId: "outcome:decide-reconnect-resume",
      scope: {
        playerKey: "player-a",
      },
    });

    expect(state).toEqual(expect.objectContaining({
      kind: "state-observation",
      path: "session.phase",
      value: "active",
      tick: 120,
      scope: {
        arenaId: "arena-1",
        arenaGeneration: 4,
        playerKey: "player-a",
      },
    }));

    expect(outcome).toEqual(expect.objectContaining({
      kind: "gameplay-outcome",
      outcomeId: "outcome:decide-reconnect-resume",
      tick: 120,
      scope: {
        arenaId: "arena-1",
        arenaGeneration: 4,
        playerKey: "player-a",
      },
    }));

    expect(events).toHaveLength(2);
  });

});
}

// Consolidated suite from engine/packages/telemetry/test/core/frame-collector.test.ts
{
const batch = {
  schemaVersion: 1 as const,
  sessionId: "qa-1",
  events: [{
    schemaVersion: 1 as const,
    eventId: "route-1",
    kind: "route-revalidation" as const,
    producer: "runtime" as const,
    scope: { operationId: "route-op" },
    routeId: "bridge",
    result: "passed" as const,
  }],
};

describe("telemetry frame collector", () => {
  it("assembles out-of-order frames and removes completed state", () => {
    const collector = createTelemetryFrameCollector();
    const frames = frameTelemetryBatch(batch, {
      batchId: "batch-a",
      maxPayloadCharacters: 24,
    });

    let completed;
    for (const frame of [...frames].reverse()) {
      const result = collector.accept(frame);
      if (result.status === "complete") completed = result;
    }

    expect(completed).toEqual(expect.objectContaining({
      status: "complete",
      batchId: "batch-a",
      batch,
    }));
    expect(collector.pendingBatches).toBe(0);
  });

  it("treats an identical repeated frame as idempotent", () => {
    const collector = createTelemetryFrameCollector();
    const frames = frameTelemetryBatch(batch, {
      batchId: "batch-a",
      maxPayloadCharacters: 24,
    });
    const first = frames[0]!;

    expect(collector.accept(first).status).toBe("pending");
    const duplicate = collector.accept(first);
    expect(duplicate.status).toBe("duplicate");
    expect(duplicate.receivedParts).toBe(1);
  });

  it("rejects a conflicting duplicate frame", () => {
    const collector = createTelemetryFrameCollector();
    const frames = frameTelemetryBatch(batch, {
      batchId: "batch-a",
      maxPayloadCharacters: 24,
    });
    const first = frames[0]!;
    collector.accept(first);

    expect(() => collector.accept({
      ...first,
      payload: first.payload + "corrupt",
    })).toThrow(/conflicts with previously received part/);
  });

  it("evicts the oldest incomplete batch at the pending budget", () => {
    const collector = createTelemetryFrameCollector({
      maxPendingBatches: 1,
    });
    const a = frameTelemetryBatch(batch, {
      batchId: "batch-a",
      maxPayloadCharacters: 10,
    });
    const b = frameTelemetryBatch(batch, {
      batchId: "batch-b",
      maxPayloadCharacters: 10,
    });

    collector.accept(a[0]!);
    const result = collector.accept(b[0]!);

    expect(result.evictedBatchId).toBe("batch-a");
    expect(collector.pendingBatches).toBe(1);
    expect(collector.discard("batch-a")).toBe(false);
    expect(collector.discard("batch-b")).toBe(true);
  });

  it("enforces per-frame payload limits", () => {
    const collector = createTelemetryFrameCollector({
      maxPayloadCharactersPerFrame: 8,
    });
    const frames = frameTelemetryBatch(batch, {
      batchId: "batch-a",
      maxPayloadCharacters: 12,
    });

    expect(frames[0]!.payload.length).toBeGreaterThan(8);
    expect(() => collector.accept(frames[0]!))
      .toThrow(/payload exceeds collector character budget/);
    expect(collector.pendingPayloadCharacters).toBe(0);
  });

  it("evicts oldest incomplete batches to stay within total payload budget", () => {
    const collector = createTelemetryFrameCollector({
      maxPendingBatches: 8,
      maxPayloadCharactersPerFrame: 64,
      maxPendingPayloadCharacters: 20,
    });
    const a = frameTelemetryBatch(batch, {
      batchId: "batch-a",
      maxPayloadCharacters: 10,
    });
    const b = frameTelemetryBatch(batch, {
      batchId: "batch-b",
      maxPayloadCharacters: 10,
    });
    const c = frameTelemetryBatch(batch, {
      batchId: "batch-c",
      maxPayloadCharacters: 10,
    });

    collector.accept(a[0]!);
    collector.accept(b[0]!);
    expect(collector.pendingPayloadCharacters).toBe(20);

    const result = collector.accept(c[0]!);
    expect(result.evictedBatchId).toBe("batch-a");
    expect(collector.pendingBatches).toBe(2);
    expect(collector.pendingPayloadCharacters).toBe(20);
  });

  it("releases pending payload accounting on completion discard and clear", () => {
    const collector = createTelemetryFrameCollector({
      maxPayloadCharactersPerFrame: 64,
      maxPendingPayloadCharacters: 10_000,
    });
    const frames = frameTelemetryBatch(batch, {
      batchId: "batch-a",
      maxPayloadCharacters: 20,
    });

    for (const frame of frames.slice(0, -1)) {
      collector.accept(frame);
    }
    expect(collector.pendingPayloadCharacters).toBeGreaterThan(0);

    const final = collector.accept(frames.at(-1)!);
    expect(final.status).toBe("complete");
    expect(collector.pendingPayloadCharacters).toBe(0);

    const b = frameTelemetryBatch(batch, {
      batchId: "batch-b",
      maxPayloadCharacters: 20,
    });
    collector.accept(b[0]!);
    expect(collector.pendingPayloadCharacters).toBeGreaterThan(0);
    expect(collector.discard("batch-b")).toBe(true);
    expect(collector.pendingPayloadCharacters).toBe(0);

    const cFrames = frameTelemetryBatch(batch, {
      batchId: "batch-c",
      maxPayloadCharacters: 20,
    });
    collector.accept(cFrames[0]!);
    collector.clear();
    expect(collector.pendingPayloadCharacters).toBe(0);
    expect(collector.pendingBatches).toBe(0);
  });

  it("rejects batches larger than the configured frame budget", () => {
    const collector = createTelemetryFrameCollector({
      maxFramesPerBatch: 2,
    });
    const frames = frameTelemetryBatch(batch, {
      batchId: "batch-a",
      maxPayloadCharacters: 5,
    });

    expect(frames.length).toBeGreaterThan(2);
    expect(() => collector.accept(frames[0]!))
      .toThrow(/partCount exceeds collector bounds/);
  });
});
}

// Consolidated suite from engine/packages/telemetry/test/core/guards.test.ts
{
describe("telemetry instrumentation guards", () => {
  it("emits double-start only for a distinct second operation in one arena generation", () => {
    const buffer = createBufferedTelemetrySink();
    const telemetry = createTelemetryEmitter({
      producer: "instrumentation",
      sink: buffer,
    });
    const guard = createArenaStartGuard(telemetry);

    guard.observeStart({
      arenaId: "arena-1",
      arenaGeneration: 4,
      operationId: "start-a",
    });
    guard.observeStart({
      arenaId: "arena-1",
      arenaGeneration: 4,
      operationId: "start-a",
    });
    expect(buffer.size).toBe(0);

    guard.observeStart({
      arenaId: "arena-1",
      arenaGeneration: 4,
      operationId: "start-b",
    });

    expect(buffer.snapshot()).toEqual([
      expect.objectContaining({
        kind: "arena-double-start",
        arenaId: "arena-1",
        arenaGeneration: 4,
        startOperationIds: ["start-a", "start-b"],
      }),
    ]);

    guard.observeStart({
      arenaId: "arena-1",
      arenaGeneration: 4,
      operationId: "start-extra",
    });
    expect(buffer.size).toBe(1);

    guard.reset("arena-1", 4);
    guard.observeStart({
      arenaId: "arena-1",
      arenaGeneration: 4,
      operationId: "start-c",
    });
    expect(buffer.size).toBe(1);
  });

  it("emits stale-callback telemetry when a captured generation no longer matches", () => {
    const buffer = createBufferedTelemetrySink();
    const telemetry = createTelemetryEmitter({
      producer: "instrumentation",
      sink: buffer,
      baseScope: { arenaId: "arena-2" },
    });

    const guard = captureDeferredGeneration(telemetry, {
      subsystem: "countdown",
      callbackKind: "runTimeout",
      capturedGeneration: 7,
      scope: { operationId: "countdown-7" },
    });

    expect(guard.check(7)).toBe(true);
    expect(buffer.size).toBe(0);

    expect(guard.check(8, {
      scope: { arenaGeneration: 8 },
      tick: 240,
    })).toBe(false);

    expect(buffer.snapshot()).toEqual([
      expect.objectContaining({
        kind: "stale-callback",
        subsystem: "countdown",
        callbackKind: "runTimeout",
        capturedGeneration: 7,
        currentGeneration: 8,
        tick: 240,
        scope: {
          arenaId: "arena-2",
          operationId: "countdown-7",
          arenaGeneration: 8,
        },
      }),
    ]);

    expect(guard.check(9)).toBe(false);
    expect(buffer.size).toBe(1);
  });
});
}

// Consolidated suite from engine/packages/telemetry/test/core/priority-buffer.test.ts
{
function event(
  id: string,
  kind: TelemetryEvent["kind"],
  extra: Record<string, unknown> = {},
): TelemetryEvent {
  return {
    schemaVersion: 1,
    eventId: id,
    kind,
    producer: "instrumentation",
    scope: {},
    ...extra,
  } as TelemetryEvent;
}

describe("priority telemetry buffer", () => {
  it("evicts lower-priority observations for a critical anomaly", () => {
    const buffer = createPriorityBufferedTelemetrySink(2);

    buffer.emit(event("low-1", "mutation-applied", {
      mutationKind: "fill",
    }));
    buffer.emit(event("normal-1", "route-revalidation", {
      routeId: "bridge",
      result: "passed",
    }));
    buffer.emit(event("critical-1", "stale-callback", {
      subsystem: "countdown",
      capturedGeneration: 1,
      currentGeneration: 2,
    }));

    expect(buffer.snapshot().map((item) => item.eventId)).toEqual([
      "normal-1",
      "critical-1",
    ]);
    expect(buffer.dropped).toBe(1);
    expect(buffer.droppedByPriority()).toEqual({
      low: 1,
      normal: 0,
      high: 0,
      critical: 0,
    });
  });

  it("does not let lower or equal priority replace retained critical evidence", () => {
    const buffer = createPriorityBufferedTelemetrySink(1);

    buffer.emit(event("critical-1", "arena-double-start", {
      arenaId: "arena-1",
      arenaGeneration: 2,
    }));
    buffer.emit(event("high-1", "entity-stall", {
      entityKey: "demo:zombie",
    }));
    buffer.emit(event("critical-2", "stale-callback", {
      subsystem: "timer",
      capturedGeneration: 1,
      currentGeneration: 2,
    }));

    expect(buffer.snapshot().map((item) => item.eventId)).toEqual([
      "critical-1",
    ]);
    expect(buffer.dropped).toBe(2);
    expect(buffer.droppedByPriority()).toEqual({
      low: 0,
      normal: 0,
      high: 1,
      critical: 1,
    });
  });

  it("classifies downstream observations above routine mutation noise", () => {
    expect(telemetryEventPriority(event("a", "mutation-applied", {
      mutationKind: "fill",
    }))).toBe("low");
    expect(telemetryEventPriority(event("b", "entity-stall", {
      entityKey: "demo:zombie",
    }))).toBe("high");
    expect(telemetryEventPriority(event("c", "mutation-verification", {
      result: "failed",
    }))).toBe("critical");
  });

  it("classifies route diagnostic observations above raw route samples", () => {
    expect(
      telemetryEventPriority(
        event("route-sample", "route-observation", {
          entityKey: "demo:zombie",
          worldLocation: { x: 0, y: 0, z: 0 },
        }),
      ),
    ).toBe("low");

    expect(
      telemetryEventPriority(
        event(
          "nav-target",
          "navigation-target-observation",
          {
            entityKey: "demo:zombie",
            targetLocation: { x: 1, y: 2, z: 3 },
          },
        ),
      ),
    ).toBe("normal");

    expect(
      telemetryEventPriority(
        event(
          "reachability",
          "route-reachability-observation",
          {
            entityKey: "demo:zombie",
            reachable: true,
          },
        ),
      ),
    ).toBe("normal");
  });

  it("preserves dropped count in exported batches", () => {
    const buffer = createPriorityBufferedTelemetrySink(1);
    buffer.emit(event("low-1", "mutation-applied", {
      mutationKind: "fill",
    }));
    buffer.emit(event("critical-1", "state-drift", {
      contractId: "ready",
      authority: {
        surface: { kind: "scoreboard", key: "ready" },
        value: 1,
      },
      mirror: {
        surface: { kind: "tag", key: "ready" },
        value: 0,
      },
    }));

    expect(buffer.batch()).toMatchObject({
      schemaVersion: 1,
      droppedEvents: 1,
      events: [
        expect.objectContaining({ eventId: "critical-1" }),
      ],
    });
  });
});
}

// Consolidated suite from engine/packages/telemetry/test/core/profile.test.ts
{
function event(
  kind: TelemetryEvent["kind"],
  extra: Record<string, unknown> = {},
): TelemetryEvent {
  return {
    schemaVersion: 1,
    eventId: "event-" + kind,
    kind,
    producer: "instrumentation",
    scope: {},
    ...extra,
  } as TelemetryEvent;
}

describe("telemetry runtime profiles", () => {
  it("defaults to full for backward compatibility", () => {
    const profile = resolveTelemetryRuntimeProfile(undefined);
    expect(profile.name).toBe("full");
    expect(profile.continuousMonitoring).toBe(true);
    expect(profile.activeProbes).toBe(true);
  });
  it("off drops every event", () => {
    const buffer = createBufferedTelemetrySink();
    const sink = createProfileTelemetrySink(buffer, "off");

    sink.emit(event("arena-double-start", {
      arenaId: "arena-1",
      arenaGeneration: 1,
    }));
    sink.emit(event("entity-stall", {
      entityKey: "demo:zombie",
    }));

    expect(buffer.size).toBe(0);
  });

  it("critical keeps invariant anomalies and failed verification only", () => {
    const buffer = createBufferedTelemetrySink();
    const sink = createProfileTelemetrySink(buffer, "critical");

    sink.emit(event("arena-double-start", {
      arenaId: "arena-1",
      arenaGeneration: 1,
    }));
    sink.emit(event("route-revalidation", {
      routeId: "bridge",
      result: "passed",
    }));
    sink.emit(event("route-revalidation", {
      routeId: "bridge",
      result: "failed",
    }));
    sink.emit(event("mutation-applied", {
      mutationKind: "fill",
    }));
    sink.emit(event("entity-stall", {
      entityKey: "demo:zombie",
    }));

    expect(buffer.snapshot().map((item) => item.kind)).toEqual([
      "arena-double-start",
      "route-revalidation",
    ]);
    expect(
      buffer.snapshot().find((item) => item.kind === "route-revalidation"),
    ).toMatchObject({ result: "failed" });
  });

  it("qa enables continuous monitoring but not active probes", () => {
    const profile = telemetryRuntimeProfile("qa");
    expect(profile.continuousMonitoring).toBe(true);
    expect(profile.activeProbes).toBe(false);
  });

  it("full enables continuous monitoring and active probes", () => {
    const profile = telemetryRuntimeProfile("full");
    expect(profile.continuousMonitoring).toBe(true);
    expect(profile.activeProbes).toBe(true);
  });
});
}

// Consolidated suite from engine/packages/telemetry/test/core/scheduler.test.ts
{
class FakeScheduler {
  callback?: () => void;
  interval?: number;
  clearCalls: number[] = [];
  runCalls = 0;

  runInterval(callback: () => void, intervalTicks: number): number {
    this.runCalls += 1;
    this.callback = callback;
    this.interval = intervalTicks;
    return 99;
  }

  clearRun(handle: number): void {
    this.clearCalls.push(handle);
  }
}

describe("periodic telemetry flush", () => {
  it("starts and stops idempotently", () => {
    const scheduler = new FakeScheduler();
    const buffer = createBufferedTelemetrySink();
    const controller = createTelemetryFlushController({
      buffer,
      transport: { send() {} },
    });
    const periodic = createPeriodicTelemetryFlush({
      scheduler,
      controller,
      intervalTicks: 20,
    });

    expect(periodic.start()).toBe(true);
    expect(periodic.start()).toBe(false);
    expect(scheduler.runCalls).toBe(1);
    expect(scheduler.interval).toBe(20);
    expect(periodic.running).toBe(true);

    expect(periodic.stop()).toBe(true);
    expect(periodic.stop()).toBe(false);
    expect(scheduler.clearCalls).toEqual([99]);
    expect(periodic.running).toBe(false);
  });

  it("flushes batches from the scheduled callback", () => {
    const scheduler = new FakeScheduler();
    const buffer = createBufferedTelemetrySink();
    const sent: unknown[] = [];
    const flushed: unknown[] = [];
    const controller = createTelemetryFlushController({
      buffer,
      transport: {
        send(batch) {
          sent.push(batch);
        },
      },
    });
    const telemetry = createTelemetryEmitter({
      producer: "runtime",
      sink: buffer,
    });
    const periodic = createPeriodicTelemetryFlush({
      scheduler,
      controller,
      intervalTicks: 10,
      onFlush(batch) {
        flushed.push(batch);
      },
    });

    periodic.start();
    telemetry.routeRevalidation({
      routeId: "bridge",
      result: "passed",
    });
    scheduler.callback?.();

    expect(sent).toHaveLength(1);
    expect(flushed).toHaveLength(1);
    expect(buffer.size).toBe(0);
  });

  it("retains events and reports errors when scheduled transport fails", () => {
    const scheduler = new FakeScheduler();
    const buffer = createBufferedTelemetrySink();
    const errors: unknown[] = [];
    const controller = createTelemetryFlushController({
      buffer,
      transport: {
        send() {
          throw new Error("offline");
        },
      },
    });
    const telemetry = createTelemetryEmitter({
      producer: "runtime",
      sink: buffer,
    });
    const periodic = createPeriodicTelemetryFlush({
      scheduler,
      controller,
      intervalTicks: 10,
      onError(error) {
        errors.push(error);
      },
    });

    periodic.start();
    telemetry.routeRevalidation({
      routeId: "bridge",
      result: "failed",
    });
    scheduler.callback?.();

    expect(errors).toHaveLength(1);
    expect(buffer.size).toBe(1);
    expect(periodic.running).toBe(true);
  });

  it("can flush once when stopping", () => {
    const scheduler = new FakeScheduler();
    const buffer = createBufferedTelemetrySink();
    const sent: unknown[] = [];
    const controller = createTelemetryFlushController({
      buffer,
      transport: {
        send(batch) {
          sent.push(batch);
        },
      },
    });
    const telemetry = createTelemetryEmitter({
      producer: "runtime",
      sink: buffer,
    });
    const periodic = createPeriodicTelemetryFlush({
      scheduler,
      controller,
      intervalTicks: 10,
    });

    periodic.start();
    telemetry.routeRevalidation({
      routeId: "bridge",
      result: "passed",
    });

    expect(periodic.stop({ flush: true })).toBe(true);
    expect(sent).toHaveLength(1);
    expect(buffer.size).toBe(0);
  });
});
}
