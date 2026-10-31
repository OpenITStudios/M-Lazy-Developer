// Source-preserving consolidation: original test cases remain in isolated lexical blocks.
import { describe, expect, it } from "vitest";
import { parseRuntimeProbeRequest } from "../../../project-model/src/index.js";
import { createActiveRuntimeProbeClient } from "../../src/probes/active-probe.js";
import { createRuntimeProbeResponder } from "../../src/probes/probe-responder.js";
import { createBufferedTelemetrySink, createEntityProgressProbe, createStateMirrorProbe, createTelemetryEmitter, createRuntimeProbeExecutor, executeRuntimeProbeBundle, createRuntimeProbeSession } from "../../src/index.js";
import type { RuntimeProbeBackend, RuntimeProbeLookup } from "../../src/probes/runtime-probe-executor.js";

// Consolidated suite from engine/packages/telemetry/test/probes/active-probe.test.ts
{
describe("active runtime probe client", () => {
  it("inherits scope and tick while preserving explicit outcome mapping", () => {
    const sent: unknown[] = [];
    const client = createActiveRuntimeProbeClient({
      transport: { send: (request) => sent.push(request) },
      baseScope: { subsystemGeneration: 2 },
      scopeProvider: () => ({ arenaId: "arena-1", arenaGeneration: 7 }),
      tickProvider: () => 120,
      requestIdFactory: () => "req-1",
    });

    const request = client.request({
      probeId: "chunk-ready",
      predicate: "target-chunk-loaded",
      query: {
        kind: "chunk-loaded",
        dimension: "overworld",
        location: { x: 32, y: 64, z: 48 },
      },
      outcomeByState: {
        present: "ready",
        absent: "not-ready",
        unknown: "unknown",
      },
    });

    expect(parseRuntimeProbeRequest(request)).toEqual(request);
    expect(request.scope).toEqual({
      subsystemGeneration: 2,
      arenaId: "arena-1",
      arenaGeneration: 7,
    });
    expect(request.runtimeTick).toBe(120);
    expect(sent).toEqual([request]);
  });

  it("lets narrower request scope override inherited scope", () => {
    const client = createActiveRuntimeProbeClient({
      transport: { send: () => undefined },
      baseScope: { arenaId: "arena-1", arenaGeneration: 1 },
      requestIdFactory: () => "req-2",
    });

    const request = client.request({
      probeId: "entity-live",
      predicate: "critical-entity-resolvable",
      scope: { arenaGeneration: 2, entityKey: "entity-1" },
      query: { kind: "entity-resolvable", entityId: "entity-1" },
      outcomeByState: { present: "live", absent: "missing" },
    });

    expect(request.scope).toEqual({
      arenaId: "arena-1",
      arenaGeneration: 2,
      entityKey: "entity-1",
    });
  });
});
}

// Consolidated suite from engine/packages/telemetry/test/probes/probe-responder.test.ts
{
const baseRequest = {
  schemaVersion: 1 as const,
  requestId: "req-1",
  probeId: "chunk-ready",
  predicate: "loaded-target-chunk",
  scope: { operationId: "mutation-op" },
  runtimeTick: 90,
  query: {
    kind: "chunk-loaded" as const,
    dimension: "overworld",
    location: { x: 32, y: 64, z: 48 },
  },
  outcomeByState: {
    present: "ready",
    absent: "not-ready",
    unknown: "unknown",
  },
};

describe("runtime probe host responder", () => {
  it("builds observed present evidence from a host resolver", () => {
    const responder = createRuntimeProbeResponder({
      currentTick: () => 100,
      chunkLoaded: () => true,
    });

    const response = responder.respond(baseRequest);

    expect(response).toEqual(expect.objectContaining({
      requestId: "req-1",
      probeId: "chunk-ready",
      runtimeTick: 100,
      ok: true,
      state: "present",
      outcomeId: "ready",
      value: true,
      evidence: expect.objectContaining({
        predicate: "loaded-target-chunk",
        state: "present",
        confidence: "observed",
        scope: { operationId: "mutation-op" },
        observedAt: { tick: 100 },
      }),
    }));
  });

  it("maps false and unavailable boolean resolver results to absent and unknown", () => {
    const absent = createRuntimeProbeResponder({
      currentTick: () => 100,
      entityResolvable: () => false,
    }).respond({
      ...baseRequest,
      requestId: "req-2",
      probeId: "entity-live",
      predicate: "critical-entity-resolvable",
      query: {
        kind: "entity-resolvable",
        entityId: "entity-1",
      },
    });

    expect(absent.state).toBe("absent");
    expect(absent.outcomeId).toBe("not-ready");

    const unknown = createRuntimeProbeResponder({
      currentTick: () => 101,
    }).respond({
      ...baseRequest,
      requestId: "req-3",
    });

    expect(unknown).toEqual(expect.objectContaining({
      ok: true,
      state: "unknown",
      outcomeId: "unknown",
    }));
  });

  it("compares scoreboard values against an expected value", () => {
    const responder = createRuntimeProbeResponder({
      currentTick: () => 40,
      scoreboardValue: () => 3,
    });

    const response = responder.respond({
      ...baseRequest,
      requestId: "req-score",
      predicate: "score-is-five",
      query: {
        kind: "scoreboard-value",
        objectiveId: "phase",
        participant: "arena-1",
        expected: 5,
      },
    });

    expect(response.state).toBe("absent");
    expect(response.value).toBe(3);
  });

  it("fails closed to unknown when a resolver throws", () => {
    const responder = createRuntimeProbeResponder({
      currentTick: () => 50,
      tagPresent: () => {
        throw new Error("entity invalid");
      },
    });

    const response = responder.respond({
      ...baseRequest,
      requestId: "req-error",
      predicate: "tag-ready",
      query: {
        kind: "tag-present",
        subjectKind: "entity",
        subjectId: "entity-1",
        tag: "ready",
      },
    });

    expect(response).toEqual(expect.objectContaining({
      ok: false,
      state: "unknown",
      error: "entity invalid",
      evidence: expect.objectContaining({
        state: "unknown",
        confidence: "unknown",
      }),
    }));
  });

  it("fails closed when currentTick is invalid", () => {
    const responder = createRuntimeProbeResponder({
      currentTick: () => -1,
      chunkLoaded: () => true,
    });

    const response = responder.respond(baseRequest);

    expect(response.ok).toBe(false);
    expect(response.state).toBe("unknown");
    expect(response.runtimeTick).toBe(90);
    expect(response.error).toMatch(/invalid tick/);
  });
});
}

// Consolidated suite from engine/packages/telemetry/test/probes/probes.test.ts
{
describe("telemetry runtime probes", () => {
  it("emits one stall per no-progress episode and rearms after progress", () => {
    const buffer = createBufferedTelemetrySink();
    const telemetry = createTelemetryEmitter({
      producer: "instrumentation",
      sink: buffer,
    });
    const probe = createEntityProgressProbe(telemetry, {
      stallTicks: 20,
      minProgressDistance: 0.5,
    });

    expect(probe.observe({
      entityKey: "demo:zombie",
      tick: 100,
      position: { x: 0, y: 64, z: 0 },
      expectedToProgress: true,
      routeId: "bridge",
      scope: { operationId: "route-op" },
    })).toBe("initialized");

    expect(probe.observe({
      entityKey: "demo:zombie",
      tick: 110,
      position: { x: 0.1, y: 64, z: 0 },
      expectedToProgress: true,
      routeId: "bridge",
      scope: { operationId: "route-op" },
    })).toBe("waiting");

    expect(probe.observe({
      entityKey: "demo:zombie",
      tick: 120,
      position: { x: 0.1, y: 64, z: 0 },
      expectedToProgress: true,
      routeId: "bridge",
      scope: { operationId: "route-op" },
    })).toBe("stalled");

    expect(buffer.size).toBe(1);
    expect(buffer.snapshot()[0]).toEqual(expect.objectContaining({
      kind: "entity-stall",
      entityKey: "demo:zombie",
      routeId: "bridge",
      stalledTicks: 20,
      tick: 120,
    }));

    expect(probe.observe({
      entityKey: "demo:zombie",
      tick: 125,
      position: { x: 0.1, y: 64, z: 0 },
      expectedToProgress: true,
      routeId: "bridge",
      scope: { operationId: "route-op" },
    })).toBe("stalled");
    expect(buffer.size).toBe(1);

    expect(probe.observe({
      entityKey: "demo:zombie",
      tick: 130,
      position: { x: 1, y: 64, z: 0 },
      expectedToProgress: true,
      routeId: "bridge",
      scope: { operationId: "route-op" },
    })).toBe("progressed");

    expect(probe.observe({
      entityKey: "demo:zombie",
      tick: 150,
      position: { x: 1, y: 64, z: 0 },
      expectedToProgress: true,
      routeId: "bridge",
      scope: { operationId: "route-op" },
    })).toBe("stalled");
    expect(buffer.size).toBe(2);
  });

  it("pauses stall detection when progress is not expected", () => {
    const buffer = createBufferedTelemetrySink();
    const telemetry = createTelemetryEmitter({
      producer: "instrumentation",
      sink: buffer,
    });
    const probe = createEntityProgressProbe(telemetry, {
      stallTicks: 10,
    });

    expect(probe.observe({
      entityKey: "demo:zombie",
      tick: 0,
      position: { x: 0, y: 64, z: 0 },
      expectedToProgress: false,
    })).toBe("paused");

    expect(probe.observe({
      entityKey: "demo:zombie",
      tick: 100,
      position: { x: 0, y: 64, z: 0 },
      expectedToProgress: false,
    })).toBe("paused");
    expect(buffer.size).toBe(0);

    expect(probe.observe({
      entityKey: "demo:zombie",
      tick: 101,
      position: { x: 0, y: 64, z: 0 },
      expectedToProgress: true,
    })).toBe("waiting");
    expect(buffer.size).toBe(0);
  });

  it("deduplicates repeated mirror drift and rearms after consistency", () => {
    const buffer = createBufferedTelemetrySink();
    const telemetry = createTelemetryEmitter({
      producer: "instrumentation",
      sink: buffer,
    });
    const probe = createStateMirrorProbe(telemetry);

    const consistent = {
      contractId: "ready",
      authority: {
        surface: { kind: "scoreboard" as const, key: "ready" },
        value: 1,
        revision: 4,
      },
      mirror: {
        surface: { kind: "tag" as const, key: "ready" },
        value: 1,
        revision: 4,
      },
      scope: { arenaId: "arena-1", arenaGeneration: 4 },
    };

    expect(probe.observe(consistent)).toBe("consistent");
    expect(buffer.size).toBe(0);

    const drift = {
      ...consistent,
      mirror: {
        ...consistent.mirror,
        value: 0,
      },
    };

    expect(probe.observe(drift)).toBe("value-drift");
    expect(probe.observe(drift)).toBe("value-drift");
    expect(buffer.size).toBe(1);

    const changedDrift = {
      ...drift,
      authority: {
        ...drift.authority,
        revision: 5,
      },
      mirror: {
        ...drift.mirror,
        revision: 4,
      },
    };
    expect(probe.observe(changedDrift)).toBe("revision-stale");
    expect(buffer.size).toBe(2);

    expect(probe.observe({
      ...consistent,
      authority: { ...consistent.authority, revision: 5 },
      mirror: { ...consistent.mirror, revision: 5 },
    })).toBe("consistent");

    expect(probe.observe(changedDrift)).toBe("revision-stale");
    expect(buffer.size).toBe(3);
  });
});
}

// Consolidated suite from engine/packages/telemetry/test/probes/runtime-probe-bundle-runner.test.ts
{
const executor = createRuntimeProbeExecutor({
  currentTick: 120,
  chunkLoaded: () => ({ status: "value", value: true }),
  entityResolvable: () => ({ status: "value", value: false }),
  tagPresent: () => ({ status: "value", value: true }),
  scoreboardValue: () => ({ status: "value", value: 7 }),
  entityLocation: () => ({ status: "unknown", error: "not observed" }),
  dimensionHeightRange: () => ({ status: "unknown", error: "not observed" }),
  commandResult: () => ({ status: "unknown", error: "not observed" }),
});

const bundle = {
  schemaVersion: 1 as const,
  sessionId: "qa-run",
  artifactId: "art-1",
  incidentIds: ["incident-1"],
  requests: [{
    schemaVersion: 1 as const,
    requestId: "req-1",
    probeId: "chunk-ready",
    incidentId: "incident-1",
    predicate: "loaded-target-chunk",
    scope: {
      arenaId: "arena-1",
      arenaGeneration: 4,
      operationId: "load-4",
    },
    query: {
      kind: "chunk-loaded" as const,
      dimension: "overworld",
      location: { x: 16, y: 64, z: 16 },
    },
    outcomeByState: {
      present: "ready",
      absent: "not-ready",
    },
  }, {
    schemaVersion: 1 as const,
    requestId: "req-2",
    probeId: "phase",
    incidentId: "incident-1",
    predicate: "phase-is-active",
    query: {
      kind: "scoreboard-value" as const,
      objectiveId: "phase",
      participant: "arena-1",
      expected: 7,
    },
    outcomeByState: {
      present: "active",
      absent: "not-active",
    },
  }],
};

describe("runtime probe bundle runner", () => {
  it("executes a validated bundle and returns a canonical transcript", () => {
    const result = executeRuntimeProbeBundle(bundle, {
      executor,
      expectedArtifactId: "art-1",
      expectedSessionId: "qa-run",
    });

    expect(result.responses).toHaveLength(2);
    expect(result.responses.map((response) => response.state))
      .toEqual(["present", "present"]);
    expect(result.transcript).toMatchObject({
      schemaVersion: 1,
      sessionId: "qa-run",
      artifactId: "art-1",
      exchanges: [
        expect.objectContaining({
          request: expect.objectContaining({ requestId: "req-1" }),
          response: expect.objectContaining({
            requestId: "req-1",
            runtimeTick: 120,
            state: "present",
          }),
        }),
        expect.objectContaining({
          request: expect.objectContaining({ requestId: "req-2" }),
          response: expect.objectContaining({
            requestId: "req-2",
            state: "present",
            value: 7,
          }),
        }),
      ],
    });
  });

  it("fails closed when expected artifact identity is missing or different", () => {
    const { artifactId: _artifactId, ...withoutArtifactId } = bundle;
    expect(() => executeRuntimeProbeBundle(withoutArtifactId, {
      executor,
      expectedArtifactId: "art-1",
    })).toThrow(/does not match expected artifact/);

    expect(() => executeRuntimeProbeBundle({
      ...bundle,
      artifactId: "art-old",
    }, {
      executor,
      expectedArtifactId: "art-1",
    })).toThrow(/does not match expected artifact/);
  });

  it("fails closed when expected session identity is missing or different", () => {
    const { sessionId: _sessionId, ...withoutSessionId } = bundle;
    expect(() => executeRuntimeProbeBundle(withoutSessionId, {
      executor,
      expectedSessionId: "qa-run",
    })).toThrow(/does not match expected session/);

    expect(() => executeRuntimeProbeBundle({
      ...bundle,
      sessionId: "other-run",
    }, {
      executor,
      expectedSessionId: "qa-run",
    })).toThrow(/does not match expected session/);
  });

  it("preserves bounded transcript drop metadata when configured below bundle size", () => {
    const result = executeRuntimeProbeBundle(bundle, {
      executor,
      maxExchanges: 1,
    });

    expect(result.responses).toHaveLength(2);
    expect(result.transcript.exchanges).toHaveLength(1);
    expect(result.transcript.droppedExchanges).toBe(1);
    expect(result.transcript.exchanges[0]?.request.requestId)
      .toBe("req-2");
  });
});
}

// Consolidated suite from engine/packages/telemetry/test/probes/runtime-probe-executor.test.ts
{
function backend(overrides: Partial<RuntimeProbeBackend> = {}): RuntimeProbeBackend {
  return {
    currentTick: 100,
    chunkLoaded: () => ({ status: "value", value: true }),
    entityResolvable: () => ({ status: "value", value: true }),
    tagPresent: () => ({ status: "value", value: true }),
    scoreboardValue: () => ({ status: "value", value: 5 }),
    entityLocation: () => ({ status: "value", value: '{"dimension":"overworld","x":0,"y":64,"z":0}' }),
    dimensionHeightRange: () => ({ status: "value", value: '{"min":-64,"max":320}' }),
    commandResult: () => ({ status: "value", value: '{"successCount":1}' }),
    ...overrides,
  };
}

function request(
  query: Parameters<RuntimeProbeBackend["chunkLoaded"]> extends never
    ? never
    : any,
) {
  return {
    schemaVersion: 1 as const,
    requestId: "req-1",
    probeId: "probe-1",
    predicate: "runtime-proof",
    scope: {
      arenaId: "arena-1",
      arenaGeneration: 4,
      operationId: "operation-1",
    },
    runtimeTick: 90,
    query,
    outcomeByState: {
      present: "yes",
      absent: "no",
      unknown: "unknown",
    },
  };
}

describe("runtime probe executor", () => {
  it("executes chunk-loaded probes as observed evidence", () => {
    const executor = createRuntimeProbeExecutor(backend());
    const response = executor.execute(request({
      kind: "chunk-loaded",
      dimension: "overworld",
      location: { x: 16, y: 64, z: 16 },
    }));

    expect(response).toMatchObject({
      runtimeTick: 100,
      ok: true,
      state: "present",
      outcomeId: "yes",
      value: true,
      evidence: {
        predicate: "runtime-proof",
        state: "present",
        confidence: "observed",
        scope: {
          arenaId: "arena-1",
          arenaGeneration: 4,
          operationId: "operation-1",
        },
        observedAt: { tick: 100 },
      },
    });
  });

  it("executes entity and tag probes", () => {
    const executor = createRuntimeProbeExecutor(backend({
      entityResolvable: () => ({ status: "value", value: false }),
      tagPresent: () => ({ status: "missing" }),
    }));

    const entity = executor.execute(request({
      kind: "entity-resolvable",
      entityId: "entity-1",
    }));
    expect(entity.state).toBe("absent");
    expect(entity.value).toBe(false);

    const tag = executor.execute(request({
      kind: "tag-present",
      subjectKind: "player",
      subjectId: "player-a",
      tag: "ready",
    }));
    expect(tag.state).toBe("absent");
  });

  it("executes reusable location, height-range and command-result probes", () => {
    const executor = createRuntimeProbeExecutor(backend());
    expect(executor.execute(request({
      kind: "entity-location",
      entityId: "entity-1",
    })).state).toBe("present");
    expect(executor.execute(request({
      kind: "dimension-height-range",
      dimension: "overworld",
    })).state).toBe("present");
    expect(executor.execute(request({
      kind: "command-result",
      dimension: "overworld",
      command: "tickingarea list",
    })).state).toBe("present");
  });

  it("compares scoreboard values against an expected value", () => {
    const executor = createRuntimeProbeExecutor(backend({
      scoreboardValue: () => ({ status: "value", value: 7 }),
    }));

    const matching = executor.execute(request({
      kind: "scoreboard-value",
      objectiveId: "phase",
      participant: "arena-1",
      expected: 7,
    }));
    expect(matching.state).toBe("present");
    expect(matching.value).toBe(7);

    const mismatching = executor.execute(request({
      kind: "scoreboard-value",
      objectiveId: "phase",
      participant: "arena-1",
      expected: 8,
    }));
    expect(mismatching.state).toBe("absent");
    expect(mismatching.value).toBe(7);
  });

  it("turns backend unknown into a failed unknown response", () => {
    const executor = createRuntimeProbeExecutor(backend({
      chunkLoaded: (): RuntimeProbeLookup<boolean> => ({
        status: "unknown",
        error: "dimension unavailable",
      }),
    }));

    const response = executor.execute(request({
      kind: "chunk-loaded",
      dimension: "custom",
      location: { x: 0, y: 64, z: 0 },
    }));

    expect(response).toMatchObject({
      ok: false,
      state: "unknown",
      error: "dimension unavailable",
      evidence: {
        confidence: "unknown",
        state: "unknown",
      },
    });
  });

  it("converts backend exceptions into unknown evidence instead of throwing", () => {
    const executor = createRuntimeProbeExecutor(backend({
      entityResolvable() {
        throw new Error("entity reference invalid");
      },
    }));

    const response = executor.execute(request({
      kind: "entity-resolvable",
      entityId: "entity-1",
    }));

    expect(response.ok).toBe(false);
    expect(response.state).toBe("unknown");
    expect(response.error).toMatch(/entity reference invalid/);
  });
});
}

// Consolidated suite from engine/packages/telemetry/test/probes/runtime-probe-session.test.ts
{
const backend = {
  currentTick: 100,
  chunkLoaded: () => ({ status: "value", value: true } as const),
  entityResolvable: () => ({ status: "value", value: true } as const),
  tagPresent: () => ({ status: "value", value: true } as const),
  scoreboardValue: () => ({ status: "value", value: 1 } as const),
  // Queries not supported by this test backend remain UNKNOWN, not observed.
  entityLocation: () => ({ status: "unknown" } as const),
  dimensionHeightRange: () => ({ status: "unknown" } as const),
  commandResult: () => ({ status: "unknown" } as const),
};

function request(id: string) {
  return {
    schemaVersion: 1 as const,
    requestId: id,
    probeId: "chunk",
    predicate: "loaded-target-chunk",
    query: {
      kind: "chunk-loaded" as const,
      dimension: "overworld",
      location: { x: 0, y: 64, z: 0 },
    },
    outcomeByState: {
      present: "ready",
      absent: "not-ready",
    },
  };
}

describe("runtime probe session", () => {
  it("records validated exchanges into a transcript", () => {
    const session = createRuntimeProbeSession({
      executor: createRuntimeProbeExecutor(backend),
      sessionId: "qa-run",
      artifactId: "art-1",
    });

    const response = session.execute(request("req-1"));
    expect(response.state).toBe("present");
    expect(session.size).toBe(1);
    expect(session.snapshot()).toMatchObject({
      schemaVersion: 1,
      sessionId: "qa-run",
      artifactId: "art-1",
      exchanges: [{
        request: expect.objectContaining({ requestId: "req-1" }),
        response: expect.objectContaining({
          requestId: "req-1",
          state: "present",
        }),
      }],
    });
  });

  it("bounds retained exchanges and reports dropped history", () => {
    const session = createRuntimeProbeSession({
      executor: createRuntimeProbeExecutor(backend),
      maxExchanges: 2,
    });

    session.execute(request("req-1"));
    session.execute(request("req-2"));
    session.execute(request("req-3"));

    expect(session.size).toBe(2);
    expect(session.dropped).toBe(1);
    const transcript = session.snapshot();
    expect(transcript.droppedExchanges).toBe(1);
    expect(transcript.exchanges.map((item) => item.request.requestId))
      .toEqual(["req-2", "req-3"]);
  });

  it("keeps request ids unique across drained batches", () => {
    const session = createRuntimeProbeSession({
      executor: createRuntimeProbeExecutor(backend),
    });

    session.execute(request("req-1"));
    const transcript = session.drainTranscript();
    expect(transcript.exchanges).toHaveLength(1);
    expect(session.size).toBe(0);
    expect(session.dropped).toBe(0);

    expect(() => session.execute(request("req-1")))
      .toThrow(/Duplicate runtime probe requestId/);
  });

  it("clear starts a fresh request-id namespace", () => {
    const session = createRuntimeProbeSession({
      executor: createRuntimeProbeExecutor(backend),
    });

    session.execute(request("req-1"));
    session.clear();
    expect(() => session.execute(request("req-1"))).not.toThrow();
  });

  it("rejects invalid buffer sizes", () => {
    expect(() => createRuntimeProbeSession({
      executor: createRuntimeProbeExecutor(backend),
      maxExchanges: 0,
    })).toThrow(/positive integer/);
  });
});
}
