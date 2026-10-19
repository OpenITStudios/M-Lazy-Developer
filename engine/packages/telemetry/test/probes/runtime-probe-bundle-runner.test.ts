import { describe, expect, it } from "vitest";
import {
  createRuntimeProbeExecutor,
  executeRuntimeProbeBundle,
} from "../../src/index.js";

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
