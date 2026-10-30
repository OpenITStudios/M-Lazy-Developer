// Source-preserving consolidation: original test cases remain in isolated lexical blocks.
import { describe, expect, it } from "vitest";
import { createBedrockConsoleTelemetrySink, createBedrockScriptEventTelemetryCollector, createBedrockScriptEventTelemetrySink, createBedrockTickProvider, createBufferedTelemetrySink, createTelemetryEmitter, createBedrockTelemetryKit, createCallbackTelemetrySink, createBedrockTelemetryLifecycleHost, createBedrockTelemetryRuntime, createTelemetryFlushController, createTelemetryInstrumentationKit } from "../../src/index.js";
import type { BedrockScriptEventMessageLike } from "../../src/index.js";

// Consolidated suite from engine/packages/telemetry/test/bedrock/bedrock-bridge.test.ts
{
describe("Bedrock telemetry bridge", () => {
  it("reads currentTick from an injected Bedrock-like system", () => {
    const system = { currentTick: 42 };
    const tick = createBedrockTickProvider(system);
    expect(tick()).toBe(42);
    system.currentTick = 43;
    expect(tick()).toBe(43);
  });

  it("sends telemetry as a namespaced script event payload", () => {
    const sent: Array<{ id: string; message: string }> = [];
    const system = {
      currentTick: 1,
      sendScriptEvent(id: string, message: string) {
        sent.push({ id, message });
      },
    };
    const sink = createBedrockScriptEventTelemetrySink(
      system,
      "mivubi:telemetry",
    );
    const emitter = createTelemetryEmitter({
      producer: "instrumentation",
      sink,
      tickProvider: createBedrockTickProvider(system),
    });

    const event = emitter.routeRevalidation({
      routeId: "bridge",
      result: "passed",
    });

    expect(sent).toHaveLength(1);
    expect(sent[0]?.id).toBe("mivubi:telemetry");
    expect(JSON.parse(sent[0]?.message ?? "{}")).toMatchObject({
      eventId: event.eventId,
      kind: "route-revalidation",
      tick: 1,
    });
  });

  it("writes prefixed json lines to an injected console", () => {
    const lines: string[] = [];
    const sink = createBedrockConsoleTelemetrySink({
      warn(message) {
        lines.push(String(message));
      },
    });
    const buffer = createBufferedTelemetrySink();
    const emitter = createTelemetryEmitter({
      producer: "qa",
      sink: {
        emit(event) {
          sink.emit(event);
          buffer.emit(event);
        },
      },
    });

    const event = emitter.mutationVerification({
      result: "passed",
    });

    expect(lines[0]).toBe(
      "[M-Bedrock-Dev telemetry] " + JSON.stringify(event),
    );
    expect(buffer.size).toBe(1);
  });

  it("collects telemetry from the injected script-event signal", () => {
    const callbacks = new Set<(event: {
      id: string;
      message: string;
    }) => void>();
    const buffer = createBufferedTelemetrySink();
    const collector = createBedrockScriptEventTelemetryCollector({
      signal: {
        subscribe(callback) {
          callbacks.add(callback);
        },
        unsubscribe(callback) {
          callbacks.delete(callback);
        },
      },
      sink: buffer,
      eventId: "mivubi:telemetry",
    });

    const event = {
      schemaVersion: 1 as const,
      eventId: "event-1",
      kind: "route-revalidation" as const,
      producer: "runtime" as const,
      scope: { operationId: "op-1" },
      routeId: "bridge",
      result: "passed" as const,
    };

    for (const callback of callbacks) {
      callback({
        id: "other:channel",
        message: JSON.stringify(event),
      });
      callback({
        id: "mivubi:telemetry",
        message: JSON.stringify(event),
      });
    }

    expect(buffer.snapshot()).toEqual([event]);

    collector.dispose();
    expect(callbacks.size).toBe(0);
  });

  it("can reject or report invalid script-event payloads", () => {
    const invalid: string[] = [];
    let callback:
      | ((event: { id: string; message: string }) => void)
      | undefined;
    createBedrockScriptEventTelemetryCollector({
      signal: {
        subscribe(next) {
          callback = next;
        },
      },
      sink: createBufferedTelemetrySink(),
      onInvalid(error) {
        invalid.push(error.message);
      },
    });

    callback?.({
      id: "mivubi:telemetry",
      message: JSON.stringify({
        schemaVersion: 1,
        eventId: "bad",
        kind: "unknown",
        producer: "qa",
        scope: {},
      }),
    });

    expect(invalid[0]).toMatch(/unsupported/);
  });

  it("rejects a script-event payload that exceeds the configured limit", () => {
    const sink = createBedrockScriptEventTelemetrySink(
      { sendScriptEvent() {} },
      "mivubi:telemetry",
      32,
    );
    const emitter = createTelemetryEmitter({
      producer: "qa",
      sink,
    });

    expect(() => emitter.routeRevalidation({
      routeId: "a-very-long-route-id-that-will-not-fit",
      result: "passed",
    })).toThrow(/payload limit/);
  });

  it("rejects an unnamespaced collector id", () => {
    expect(() => createBedrockScriptEventTelemetryCollector({
      signal: {
        subscribe() {},
      },
      sink: createBufferedTelemetrySink(),
      eventId: "telemetry",
    })).toThrow(/Collector script event id must be namespaced/);
  });

  it("rejects an unnamespaced script event id", () => {
    expect(() => createBedrockScriptEventTelemetrySink(
      { sendScriptEvent() {} },
      "telemetry",
    )).toThrow(/namespaced/);
  });
});
}

// Consolidated suite from engine/packages/telemetry/test/bedrock/bedrock-kit.test.ts
{
describe("Bedrock telemetry kit", () => {
  it("composes validation, buffering, mirroring, scope, and flush", () => {
    const system = { currentTick: 50 };
    const mirrored: string[] = [];
    const sent: unknown[] = [];

    const kit = createBedrockTelemetryKit({
      system,
      streamId: "arena-runtime",
      sessionId: "qa-run",
      artifactId: "art-1",
      baseScope: { subsystemGeneration: 2 },
      mirrorSink: createCallbackTelemetrySink((event) => {
        mirrored.push(event.eventId);
      }),
      transport: {
        send(batch) {
          sent.push(batch);
        },
      },
    });

    kit.scope.replace({
      arenaId: "arena-1",
      arenaGeneration: 7,
    });

    const event = kit.telemetry.entityStall({
      entityKey: "demo:zombie",
      stalledTicks: 40,
      scope: {
        entityKey: "demo:zombie",
        operationId: "route-op",
      },
    });

    expect(event.tick).toBe(50);
    expect(event.streamId).toBe("arena-runtime");
    expect(kit.buffer.size).toBe(1);
    expect(mirrored).toEqual([event.eventId]);

    const batch = kit.flush.flush();
    expect(batch).toMatchObject({
      schemaVersion: 1,
      sessionId: "qa-run",
      artifactId: "art-1",
    });
    expect(sent).toHaveLength(1);
    expect(kit.buffer.size).toBe(0);
  });

  it("honors minimum flush events", () => {
    const sent: unknown[] = [];
    const kit = createBedrockTelemetryKit({
      system: { currentTick: 1 },
      minimumFlushEvents: 2,
      transport: {
        send(batch) {
          sent.push(batch);
        },
      },
    });

    kit.telemetry.routeRevalidation({
      routeId: "bridge",
      result: "passed",
    });
    expect(kit.flush.flush()).toBeUndefined();
    expect(kit.buffer.size).toBe(1);

    kit.telemetry.routeRevalidation({
      routeId: "bridge",
      result: "failed",
    });
    expect(kit.flush.flush()).toBeDefined();
    expect(sent).toHaveLength(1);
  });
});
}

// Consolidated suite from engine/packages/telemetry/test/bedrock/bedrock-lifecycle.test.ts
{
function fakeSystem() {
  let nextHandle = 1;
  const intervals = new Map<number, () => void>();
  const scriptCallbacks = new Set<
    (event: BedrockScriptEventMessageLike) => void
  >();

  return {
    currentTick: 100,
    afterEvents: {
      scriptEventReceive: {
        subscribe(
          callback: (event: BedrockScriptEventMessageLike) => void,
        ) {
          scriptCallbacks.add(callback);
        },
        unsubscribe(
          callback: (event: BedrockScriptEventMessageLike) => void,
        ) {
          scriptCallbacks.delete(callback);
        },
      },
    },
    runInterval(callback: () => void, _intervalTicks: number) {
      const handle = nextHandle++;
      intervals.set(handle, callback);
      return handle;
    },
    clearRun(handle: number) {
      intervals.delete(handle);
    },
    fireIntervals() {
      for (const callback of [...intervals.values()]) callback();
    },
    emitScriptEvent(event: BedrockScriptEventMessageLike) {
      for (const callback of [...scriptCallbacks]) callback(event);
    },
    intervalCount: () => intervals.size,
    subscriberCount: () => scriptCallbacks.size,
  };
}

describe("Bedrock telemetry lifecycle host", () => {
  it("starts and stops periodic flush plus script-event collection idempotently", () => {
    const system = fakeSystem();
    const sent: unknown[] = [];
    const host = createBedrockTelemetryLifecycleHost({
      system,
      sessionId: "run-1",
      artifactId: "art-1",
      streamId: "runtime-main",
      flushIntervalTicks: 20,
      transport: {
        send(batch) {
          sent.push(batch);
        },
      },
    });

    expect(host.running).toBe(false);
    expect(host.start()).toBe(true);
    expect(host.start()).toBe(false);
    expect(host.running).toBe(true);
    expect(system.intervalCount()).toBe(1);
    expect(system.subscriberCount()).toBe(1);

    host.kit.emitter.routeRevalidation({
      routeId: "bridge",
      result: "passed",
    });
    expect(host.kit.buffer.size).toBe(1);

    system.fireIntervals();
    expect(sent).toHaveLength(1);
    expect(host.kit.buffer.size).toBe(0);

    expect(host.stop()).toBe(true);
    expect(host.stop()).toBe(false);
    expect(host.running).toBe(false);
    expect(system.intervalCount()).toBe(0);
    expect(system.subscriberCount()).toBe(0);
  });

  it("collects leaf telemetry from the shared ScriptEvent channel", () => {
    const system = fakeSystem();
    const host = createBedrockTelemetryLifecycleHost({
      system,
      transport: { send() {} },
    });
    host.start();

    system.emitScriptEvent({
      id: "mivubi:telemetry",
      message: JSON.stringify({
        schemaVersion: 1,
        eventId: "leaf-1",
        kind: "mutation-verification",
        producer: "instrumentation",
        scope: { operationId: "load-1" },
        result: "passed",
      }),
    });

    expect(host.kit.buffer.snapshot()).toEqual([
      expect.objectContaining({
        eventId: "leaf-1",
        kind: "mutation-verification",
      }),
    ]);

    host.dispose();
    expect(system.subscriberCount()).toBe(0);
  });

  it("retains buffered evidence if synchronous transport fails", () => {
    const system = fakeSystem();
    const errors: unknown[] = [];
    const host = createBedrockTelemetryLifecycleHost({
      system,
      transport: {
        send() {
          throw new Error("transport down");
        },
      },
      onFlushError(error) {
        errors.push(error);
      },
    });

    host.kit.emitter.routeRevalidation({
      routeId: "bridge",
      result: "failed",
    });

    expect(host.flushNow()).toBeUndefined();
    expect(errors).toHaveLength(1);
    expect(host.kit.buffer.size).toBe(1);
  });

  it("can flush during stop and rejects restart after dispose", () => {
    const system = fakeSystem();
    const sent: unknown[] = [];
    const host = createBedrockTelemetryLifecycleHost({
      system,
      transport: {
        send(batch) {
          sent.push(batch);
        },
      },
    });

    host.start();
    host.kit.emitter.mutationVerification({
      result: "passed",
    });

    expect(host.stop({ flush: true })).toBe(true);
    expect(sent).toHaveLength(1);

    host.dispose();
    expect(() => host.start()).toThrow(/disposed/);
  });

  it("honors the minimum flush event threshold", () => {
    const system = fakeSystem();
    const sent: unknown[] = [];
    const host = createBedrockTelemetryLifecycleHost({
      system,
      minimumFlushEvents: 2,
      transport: {
        send(batch) {
          sent.push(batch);
        },
      },
    });

    host.kit.emitter.routeRevalidation({
      routeId: "bridge",
      result: "passed",
    });
    expect(host.flushNow()).toBeUndefined();
    expect(host.kit.buffer.size).toBe(1);

    host.kit.emitter.routeRevalidation({
      routeId: "bridge",
      result: "failed",
    });
    expect(host.flushNow()).toBeDefined();
    expect(sent).toHaveLength(1);
  });
  it("does not schedule or subscribe in off profile", () => {
    const system = fakeSystem();
    const sent: unknown[] = [];
    const host = createBedrockTelemetryLifecycleHost({
      system,
      profile: "off",
      flushIntervalTicks: 20,
      transport: {
        send(batch) {
          sent.push(batch);
        },
      },
    });

    expect(host.kit.profile.name).toBe("off");
    expect(host.start()).toBe(true);
    expect(system.intervalCount()).toBe(0);
    expect(system.subscriberCount()).toBe(0);

    host.kit.emitter.staleCallback({
      subsystem: "countdown",
      capturedGeneration: 1,
      currentGeneration: 2,
    });
    expect(host.kit.buffer.size).toBe(0);
    expect(host.flushNow()).toBeUndefined();
    expect(sent).toEqual([]);

    host.dispose();
  });

  it("filters shared ScriptEvent input through the critical profile", () => {
    const system = fakeSystem();
    const host = createBedrockTelemetryLifecycleHost({
      system,
      profile: "critical",
      transport: { send() {} },
    });
    host.start();

    system.emitScriptEvent({
      id: "mivubi:telemetry",
      message: JSON.stringify({
        schemaVersion: 1,
        eventId: "pass-1",
        kind: "route-revalidation",
        producer: "instrumentation",
        scope: {},
        routeId: "bridge",
        result: "passed",
      }),
    });
    system.emitScriptEvent({
      id: "mivubi:telemetry",
      message: JSON.stringify({
        schemaVersion: 1,
        eventId: "fail-1",
        kind: "route-revalidation",
        producer: "instrumentation",
        scope: {},
        routeId: "bridge",
        result: "failed",
      }),
    });

    expect(host.kit.buffer.snapshot()).toEqual([
      expect.objectContaining({
        eventId: "fail-1",
        result: "failed",
      }),
    ]);

    host.dispose();
  });
});
}

// Consolidated suite from engine/packages/telemetry/test/bedrock/bedrock-runtime.test.ts
{
describe("Bedrock telemetry runtime bridge", () => {
  it("reads currentTick lazily and merges the runtime scope lease", () => {
    const system = { currentTick: 10 };
    const buffer = createBufferedTelemetrySink();
    const runtime = createBedrockTelemetryRuntime({
      system,
      sink: buffer,
      streamId: "bedrock-runtime",
      baseScope: { subsystemGeneration: 1 },
    });

    runtime.scope.replace({
      arenaId: "arena-1",
      arenaGeneration: 4,
    });

    const first = runtime.telemetry.routeRevalidation({
      routeId: "bridge",
      result: "passed",
    });
    expect(first.tick).toBe(10);
    expect(first.scope).toEqual({
      subsystemGeneration: 1,
      arenaId: "arena-1",
      arenaGeneration: 4,
    });

    system.currentTick = 11;
    runtime.scope.patch({ operationId: "mutation-1" });
    const second = runtime.telemetry.mutationApplied({
      mutationKind: "fill",
    });
    expect(second.tick).toBe(11);
    expect(second.scope.operationId).toBe("mutation-1");
  });

  it("retains buffered events when a flush transport throws", () => {
    const buffer = createBufferedTelemetrySink();
    const runtime = createBedrockTelemetryRuntime({
      system: { currentTick: 1 },
      sink: buffer,
    });
    runtime.telemetry.routeRevalidation({
      routeId: "bridge",
      result: "failed",
    });

    const controller = createTelemetryFlushController({
      buffer,
      transport: {
        send() {
          throw new Error("transport unavailable");
        },
      },
      sessionId: "run-1",
    });

    expect(() => controller.flush()).toThrow(/transport unavailable/);
    expect(buffer.size).toBe(1);
  });

  it("clears buffered events only after a successful flush", () => {
    const buffer = createBufferedTelemetrySink();
    const runtime = createBedrockTelemetryRuntime({
      system: { currentTick: 1 },
      sink: buffer,
    });
    runtime.telemetry.routeRevalidation({
      routeId: "bridge",
      result: "passed",
    });

    const sent: unknown[] = [];
    const controller = createTelemetryFlushController({
      buffer,
      transport: {
        send(batch) {
          sent.push(batch);
        },
      },
      sessionId: "run-1",
      artifactId: "art-1",
    });

    const batch = controller.flush();
    expect(batch?.sessionId).toBe("run-1");
    expect(batch?.artifactId).toBe("art-1");
    expect(sent).toHaveLength(1);
    expect(buffer.size).toBe(0);
  });
  it("applies the critical profile at the Bedrock runtime boundary", () => {
    const buffer = createBufferedTelemetrySink();
    const runtime = createBedrockTelemetryRuntime({
      system: { currentTick: 5 },
      sink: buffer,
      profile: "critical",
    });

    expect(runtime.profile.name).toBe("critical");

    runtime.telemetry.routeRevalidation({
      routeId: "bridge",
      result: "passed",
    });
    runtime.telemetry.routeRevalidation({
      routeId: "bridge",
      result: "failed",
    });

    expect(buffer.snapshot()).toEqual([
      expect.objectContaining({
        kind: "route-revalidation",
        result: "failed",
      }),
    ]);
  });
});
}

// Consolidated suite from engine/packages/telemetry/test/bedrock/kit.test.ts
{
describe("development telemetry instrumentation kit", () => {
  it("assembles emitter, scope, guards, buffer, and optional transport", () => {
    const transported: string[] = [];
    let tick = 100;

    const kit = createTelemetryInstrumentationKit({
      producer: "instrumentation",
      maxEvents: 10,
      initialScope: {
        arenaId: "arena-1",
        arenaGeneration: 4,
      },
      tickProvider: () => tick,
      transportSink: createCallbackTelemetrySink(
        (event) => transported.push(event.eventId),
      ),
    });

    kit.arenaStart.observeStart({
      arenaId: "arena-1",
      arenaGeneration: 4,
      operationId: "start-a",
    });
    kit.arenaStart.observeStart({
      arenaId: "arena-1",
      arenaGeneration: 4,
      operationId: "start-b",
    });

    expect(kit.buffer.size).toBe(1);
    expect(transported).toHaveLength(1);
    expect(kit.buffer.snapshot()[0]).toEqual(expect.objectContaining({
      kind: "arena-double-start",
      tick: 100,
      scope: expect.objectContaining({
        arenaId: "arena-1",
        arenaGeneration: 4,
      }),
    }));

    tick = 120;
    const generation = kit.captureGeneration({
      subsystem: "countdown",
      capturedGeneration: 4,
      scope: { operationId: "countdown-4" },
    });
    expect(generation.check(5)).toBe(false);

    expect(kit.buffer.size).toBe(2);
    expect(kit.batch({ sessionId: "qa-1" })).toEqual(
      expect.objectContaining({
        schemaVersion: 1,
        sessionId: "qa-1",
        events: expect.any(Array),
      }),
    );
  });

  it("resets instrumentation state without deleting captured evidence", () => {
    const kit = createTelemetryInstrumentationKit({
      initialScope: {
        arenaId: "arena-1",
        arenaGeneration: 1,
      },
    });

    kit.arenaStart.observeStart({
      arenaId: "arena-1",
      arenaGeneration: 1,
      operationId: "a",
    });
    kit.arenaStart.observeStart({
      arenaId: "arena-1",
      arenaGeneration: 1,
      operationId: "b",
    });
    expect(kit.buffer.size).toBe(1);

    kit.resetRuntimeState();

    expect(kit.buffer.size).toBe(1);
    expect(kit.scope.current()).toEqual({});

    kit.scope.replace({
      arenaId: "arena-1",
      arenaGeneration: 1,
    });
    kit.arenaStart.observeStart({
      arenaId: "arena-1",
      arenaGeneration: 1,
      operationId: "c",
    });
    kit.arenaStart.observeStart({
      arenaId: "arena-1",
      arenaGeneration: 1,
      operationId: "d",
    });
    expect(kit.buffer.size).toBe(2);
  });

  it("resets created entity progress probes while preserving their emitted evidence", () => {
    const kit = createTelemetryInstrumentationKit();
    const progress = kit.entityProgress({
      stallTicks: 10,
      minProgressDistance: 0.5,
    });

    progress.observe({
      entityKey: "demo:zombie",
      tick: 0,
      position: { x: 0, y: 0, z: 0 },
      expectedToProgress: true,
    });
    progress.observe({
      entityKey: "demo:zombie",
      tick: 10,
      position: { x: 0, y: 0, z: 0 },
      expectedToProgress: true,
    });
    expect(kit.buffer.size).toBe(1);

    kit.resetRuntimeState();

    expect(progress.observe({
      entityKey: "demo:zombie",
      tick: 11,
      position: { x: 0, y: 0, z: 0 },
      expectedToProgress: true,
    })).toBe("initialized");
    expect(kit.buffer.size).toBe(1);
  });

  it("can emit route samples from entity progress monitoring", () => {
    const kit = createTelemetryInstrumentationKit({
      initialScope: {
        arenaId: "arena_6",
        arenaGeneration: 3,
      },
    });
    const progress = kit.entityProgress({
      stallTicks: 10,
      minProgressDistance: 0.5,
      emitRouteObservations: true,
    });

    progress.observe({
      entityKey: "demo:zombie",
      tick: 100,
      position: {
        x: 1777.5,
        y: -30,
        z: 0,
      },
      expectedToProgress: true,
      routeId: "bridge",
      routeIndex: 606,
    });
    progress.observe({
      entityKey: "demo:zombie",
      tick: 105,
      position: {
        x: 1778,
        y: -30,
        z: 0,
      },
      expectedToProgress: true,
      routeId: "bridge",
      routeIndex: 606,
    });

    expect(
      kit.buffer.snapshot().filter(
        (event) =>
          event.kind === "route-observation",
      ),
    ).toEqual([
      expect.objectContaining({
        kind: "route-observation",
        tick: 100,
        entityKey: "demo:zombie",
        routeId: "bridge",
        routeIndex: 606,
        worldLocation: {
          x: 1777.5,
          y: -30,
          z: 0,
        },
        scope: expect.objectContaining({
          arenaId: "arena_6",
          arenaGeneration: 3,
        }),
      }),
      expect.objectContaining({
        kind: "route-observation",
        tick: 105,
        entityKey: "demo:zombie",
        routeId: "bridge",
        routeIndex: 606,
        worldLocation: {
          x: 1778,
          y: -30,
          z: 0,
        },
      }),
    ]);
  });

  it("emits navigation target and route reachability observations", () => {
    let tick = 200;
    const kit = createTelemetryInstrumentationKit({
      initialScope: {
        arenaId: "arena_6",
        arenaGeneration: 3,
      },
      tickProvider: () => tick,
    });

    kit.emitter.navigationTargetObservation({
      entityKey: "demo:zombie",
      routeId: "bridge",
      routeIndex: 606,
      targetLocation: {
        x: 1778,
        y: -28.5,
        z: 0.5,
      },
      mechanism: "moveToLocation",
    });

    tick = 201;
    kit.emitter.routeReachabilityObservation({
      entityKey: "demo:zombie",
      routeId: "bridge",
      routeIndex: 606,
      reachable: true,
      mechanism: "gametest-path-check",
    });

    expect(kit.buffer.snapshot()).toEqual([
      expect.objectContaining({
        kind: "navigation-target-observation",
        tick: 200,
        mechanism: "moveToLocation",
      }),
      expect.objectContaining({
        kind: "route-reachability-observation",
        tick: 201,
        reachable: true,
      }),
    ]);
  });

  it("reports verification and drains batches atomically", () => {
    const kit = createTelemetryInstrumentationKit({
      maxEvents: 1,
    });

    kit.verify.route({
      routeId: "bridge",
      result: "passed",
      scope: { operationId: "route-op" },
    });
    kit.verify.mutation({
      result: "failed",
      mechanism: "sentinel",
      scope: { operationId: "mutation-op" },
    });

    expect(kit.buffer.size).toBe(1);
    expect(kit.buffer.dropped).toBe(1);

    const batch = kit.drainBatch({
      sessionId: "run-1",
      artifactId: "art-1",
    });

    expect(batch).toEqual(expect.objectContaining({
      schemaVersion: 1,
      sessionId: "run-1",
      artifactId: "art-1",
      droppedEvents: 1,
      events: [
        expect.objectContaining({
          kind: "mutation-verification",
          result: "failed",
          mechanism: "sentinel",
        }),
      ],
    }));
    expect(kit.buffer.size).toBe(0);
    expect(kit.buffer.dropped).toBe(0);
  });

  it("drains framed batches with session defaults", () => {
    const kit = createTelemetryInstrumentationKit({
      sessionId: "session-default",
      artifactId: "art-default",
    });

    kit.emitter.routeRevalidation({
      routeId: "bridge",
      result: "passed",
    });

    const frames = kit.drainFrames({
      batchId: "frame-batch",
      maxPayloadCharacters: 32,
    });

    expect(frames.length).toBeGreaterThan(1);
    expect(kit.buffer.size).toBe(0);
    expect(frames.every(
      (frame) => frame.batchId === "frame-batch",
    )).toBe(true);
  });

  it("can clear evidence independently or clear everything", () => {
    const kit = createTelemetryInstrumentationKit({
      initialScope: { arenaId: "arena-1" },
    });

    kit.emitter.routeRevalidation({
      routeId: "bridge",
      result: "passed",
    });
    expect(kit.buffer.size).toBe(1);

    kit.clearBuffer();
    expect(kit.buffer.size).toBe(0);
    expect(kit.scope.current()).toEqual({ arenaId: "arena-1" });

    kit.emitter.routeRevalidation({
      routeId: "bridge",
      result: "failed",
    });
    kit.clearAll();

    expect(kit.buffer.size).toBe(0);
    expect(kit.scope.current()).toEqual({});
  });
  it("uses configured batch metadata and validates events by default", () => {
    const kit = createTelemetryInstrumentationKit({
      sessionId: "qa-run-1",
      artifactId: "art-1",
    });

    kit.emitter.routeRevalidation({
      routeId: "bridge",
      result: "passed",
    });

    expect(kit.batch()).toEqual(expect.objectContaining({
      schemaVersion: 1,
      sessionId: "qa-run-1",
      artifactId: "art-1",
      events: expect.any(Array),
    }));

    expect(() => kit.emitter.emit({
      schemaVersion: 1,
      eventId: "",
      kind: "route-revalidation",
      producer: "instrumentation",
      scope: {},
      routeId: "bridge",
      result: "passed",
    })).toThrow(/Invalid emitted telemetry event/);
  });

  it("can disable validation explicitly", () => {
    const kit = createTelemetryInstrumentationKit({
      validateEvents: false,
    });

    expect(() => kit.emitter.emit({
      schemaVersion: 1,
      eventId: "",
      kind: "route-revalidation",
      producer: "instrumentation",
      scope: {},
      routeId: "bridge",
      result: "passed",
    })).not.toThrow();
    expect(kit.buffer.size).toBe(1);
  });

  it("shares kit scope and tick with active runtime probes", () => {
    const requests: unknown[] = [];
    const kit = createTelemetryInstrumentationKit({
      baseScope: { subsystemGeneration: 3 },
      initialScope: { arenaId: "arena-2", arenaGeneration: 9 },
      scopeProvider: () => ({ operationId: "bridge-op" }),
      tickProvider: () => 240,
      activeProbeTransport: {
        send: (request) => requests.push(request),
      },
      probeRequestIdFactory: () => "probe-1",
    });

    expect(kit.activeProbe).toBeDefined();
    const request = kit.activeProbe!.request({
      probeId: "chunk-ready",
      predicate: "bridge-chunk-loaded",
      query: {
        kind: "chunk-loaded",
        dimension: "overworld",
        location: { x: 100, y: 64, z: 100 },
      },
      outcomeByState: {
        present: "ready",
        absent: "not-ready",
      },
    });

    expect(request.runtimeTick).toBe(240);
    expect(request.scope).toEqual({
      subsystemGeneration: 3,
      arenaId: "arena-2",
      arenaGeneration: 9,
      operationId: "bridge-op",
    });
    expect(requests).toEqual([request]);
  });

  it("disables heavy instrumentation in off mode", () => {
    const requests: unknown[] = [];
    const kit = createTelemetryInstrumentationKit({
      profile: "off",
      activeProbeTransport: {
        send(request) {
          requests.push(request);
        },
      },
    });

    expect(kit.profile.name).toBe("off");
    expect(kit.activeProbe).toBeUndefined();
    expect(kit.entityProgress({ stallTicks: 10 }).observe({
      entityKey: "demo:zombie",
      tick: 10,
      position: { x: 0, y: 0, z: 0 },
      expectedToProgress: true,
    })).toBe("disabled");
    expect(kit.stateMirror.observe({
      contractId: "ready",
      authority: {
        surface: { kind: "scoreboard", key: "ready" },
        value: 1,
      },
      mirror: {
        surface: { kind: "tag", key: "ready" },
        value: 0,
      },
    })).toBe("disabled");

    kit.emitter.staleCallback({
      subsystem: "countdown",
      capturedGeneration: 1,
      currentGeneration: 2,
    });

    expect(kit.buffer.size).toBe(0);
    expect(requests).toEqual([]);
  });

  it("critical profile retains failures while dropping normal observation noise", () => {
    const kit = createTelemetryInstrumentationKit({
      profile: "critical",
    });

    kit.emitter.routeRevalidation({
      routeId: "bridge",
      result: "passed",
    });
    kit.emitter.mutationApplied({
      mutationKind: "fill",
    });
    kit.emitter.routeRevalidation({
      routeId: "bridge",
      result: "failed",
    });
    kit.emitter.staleCallback({
      subsystem: "countdown",
      capturedGeneration: 1,
      currentGeneration: 2,
    });

    expect(kit.buffer.snapshot()).toEqual([
      expect.objectContaining({
        kind: "route-revalidation",
        result: "failed",
      }),
      expect.objectContaining({
        kind: "stale-callback",
      }),
    ]);
  });

  it("only exposes active probes in full profile", () => {
    const transport = { send() {} };

    const qa = createTelemetryInstrumentationKit({
      profile: "qa",
      activeProbeTransport: transport,
    });
    expect(qa.activeProbe).toBeUndefined();

    const full = createTelemetryInstrumentationKit({
      profile: "full",
      activeProbeTransport: transport,
    });
    expect(full.activeProbe).toBeDefined();
  });
  it("preserves critical anomalies with priority buffering", () => {
    const kit = createTelemetryInstrumentationKit({
      maxEvents: 1,
      bufferStrategy: "priority",
    });

    kit.emitter.mutationApplied({
      mutationKind: "fill",
    });
    kit.emitter.staleCallback({
      subsystem: "countdown",
      capturedGeneration: 1,
      currentGeneration: 2,
    });

    expect(kit.buffer.snapshot()).toEqual([
      expect.objectContaining({
        kind: "stale-callback",
      }),
    ]);
    expect(kit.buffer.dropped).toBe(1);
  });
});
}
