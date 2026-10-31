// Source-only co-location: all original test statements retained in isolated lexical scopes.
import { describe, expect, it } from "vitest";
import { telemetryRuntimeEvidence, telemetryRuntimeNavigationStallObservations, telemetryRuntimeNavigationTargetObservations, telemetryRuntimeOutcomeObservations, telemetryRuntimeRouteObservations, telemetryRuntimeRouteReachabilityObservations, telemetryRuntimeStateObservations } from "../../src/diagnosis/telemetry-evidence.js";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { frameTelemetryBatch, frameTelemetryBatchSet } from "../../../telemetry/src/index.js";
import { loadTelemetryFile, parseTelemetryText, resolveTelemetryEventsForArtifact } from "../../src/diagnosis/telemetry-load.js";

// Original engine/packages/orchestrator/test/diagnosis/telemetry-evidence.test.ts 34052f8a45f9b1d7ebd1d86fbace657c5a61b25d
{
describe("telemetry evidence adapter", () => {
  it("maps state observations into typed runtime state", () => {
    const event = {
      schemaVersion: 1 as const,
      eventId: "phase-1",
      kind: "state-observation" as const,
      producer: "instrumentation" as const,
      scope: {
        arenaId: "arena-1",
        arenaGeneration: 4,
      },
      tick: 120,
      path: "session.phase",
      value: "active",
    };

    expect(telemetryRuntimeStateObservations([event])).toEqual([
      {
        path: "session.phase",
        value: "active",
        confidence: "observed",
        origin: "telemetry",
        scope: {
          arenaId: "arena-1",
          arenaGeneration: 4,
        },
        observedAt: { tick: 120 },
        evidenceId: "telemetry-state:phase-1",
      },
    ]);

    expect(telemetryRuntimeEvidence([event])).toEqual([
      expect.objectContaining({
        predicate: "runtime-state-observed:session.phase",
        state: "present",
      }),
    ]);
  });

  it("maps gameplay outcomes into typed runtime outcome observations", () => {
    const event = {
      schemaVersion: 1 as const,
      eventId: "outcome-1",
      kind: "gameplay-outcome" as const,
      producer: "instrumentation" as const,
      scope: {
        arenaId: "arena-1",
        arenaGeneration: 4,
        playerKey: "player-a",
      },
      tick: 121,
      outcomeId: "outcome:decide-reconnect-cleanup",
    };

    expect(telemetryRuntimeOutcomeObservations([event])).toEqual([
      {
        outcomeId: "outcome:decide-reconnect-cleanup",
        scope: {
          arenaId: "arena-1",
          arenaGeneration: 4,
          playerKey: "player-a",
        },
        observedAt: { tick: 121 },
        evidenceId: "telemetry-outcome:outcome-1",
      },
    ]);

    expect(telemetryRuntimeEvidence([event])).toEqual([
      expect.objectContaining({
        predicate:
          "gameplay-outcome-observed:outcome:decide-reconnect-cleanup",
        state: "present",
      }),
    ]);
  });

  it("maps navigation target and reachability into typed evidence", () => {
    const events = [
      {
        schemaVersion: 1 as const,
        eventId: "nav-1",
        kind: "navigation-target-observation" as const,
        producer: "instrumentation" as const,
        scope: {
          arenaId: "arena_6",
          arenaGeneration: 3,
        },
        tick: 222,
        entityKey: "demo:zombie",
        routeId: "bridge",
        routeIndex: 606,
        targetLocation: {
          x: 1778,
          y: -28.5,
          z: 0.5,
        },
        mechanism: "moveToLocation",
      },
      {
        schemaVersion: 1 as const,
        eventId: "reach-1",
        kind: "route-reachability-observation" as const,
        producer: "instrumentation" as const,
        scope: {
          arenaId: "arena_6",
          arenaGeneration: 3,
        },
        tick: 223,
        entityKey: "demo:zombie",
        routeId: "bridge",
        routeIndex: 606,
        reachable: true,
        mechanism: "gametest-path-check",
      },
    ];

    expect(
      telemetryRuntimeNavigationTargetObservations(events),
    ).toEqual([{
      entityKey: "demo:zombie",
      targetLocation: {
        x: 1778,
        y: -28.5,
        z: 0.5,
      },
      routeId: "bridge",
      routeIndex: 606,
      mechanism: "moveToLocation",
      scope: {
        arenaId: "arena_6",
        arenaGeneration: 3,
        entityKey: "demo:zombie",
      },
      observedAt: { tick: 222 },
      evidenceId: "telemetry-navigation-target:nav-1",
    }]);

    expect(
      telemetryRuntimeRouteReachabilityObservations(events),
    ).toEqual([{
      entityKey: "demo:zombie",
      reachable: true,
      routeId: "bridge",
      routeIndex: 606,
      mechanism: "gametest-path-check",
      scope: {
        arenaId: "arena_6",
        arenaGeneration: 3,
        entityKey: "demo:zombie",
      },
      observedAt: { tick: 223 },
      evidenceId: "telemetry-route-reachability:reach-1",
    }]);

    expect(telemetryRuntimeEvidence(events)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          predicate: "navigation-target-observed",
          state: "present",
        }),
        expect.objectContaining({
          predicate: "route-target-reachable",
          state: "present",
        }),
      ]),
    );
  });

  it("maps entity stalls into typed navigation stall observations", () => {
    const event = {
      schemaVersion: 1 as const,
      eventId: "stall-typed-1",
      kind: "entity-stall" as const,
      producer: "instrumentation" as const,
      scope: {
        arenaId: "arena_6",
        arenaGeneration: 3,
      },
      tick: 225,
      entityKey: "demo:zombie",
      routeId: "bridge",
      stalledTicks: 80,
      distanceDelta: 0.1,
    };

    expect(
      telemetryRuntimeNavigationStallObservations([event]),
    ).toEqual([{
      entityKey: "demo:zombie",
      routeId: "bridge",
      stalledTicks: 80,
      distanceDelta: 0.1,
      scope: {
        arenaId: "arena_6",
        arenaGeneration: 3,
        entityKey: "demo:zombie",
      },
      observedAt: { tick: 225 },
      evidenceId: "telemetry-stall:stall-typed-1",
    }]);
  });

  it("maps route observations into typed scoped route evidence", () => {
    const event = {
      schemaVersion: 1 as const,
      eventId: "route-1",
      kind: "route-observation" as const,
      producer: "instrumentation" as const,
      scope: {
        arenaId: "arena_6",
        arenaGeneration: 3,
      },
      tick: 220,
      entityKey: "demo:zombie",
      routeId: "bridge",
      routeIndex: 606,
      worldLocation: {
        x: 1778,
        y: -30,
        z: 0,
      },
    };

    expect(
      telemetryRuntimeRouteObservations([event]),
    ).toEqual([{
      entityKey: "demo:zombie",
      routeId: "bridge",
      routeIndex: 606,
      worldLocation: {
        x: 1778,
        y: -30,
        z: 0,
      },
      scope: {
        arenaId: "arena_6",
        arenaGeneration: 3,
        entityKey: "demo:zombie",
      },
      observedAt: { tick: 220 },
      evidenceId: "telemetry-route:route-1",
    }]);

    expect(telemetryRuntimeEvidence([event])).toEqual([
      expect.objectContaining({
        predicate: "route-observation-observed",
        state: "present",
        scope: expect.objectContaining({
          arenaId: "arena_6",
          entityKey: "demo:zombie",
        }),
      }),
    ]);
  });

  it("maps observed route outcomes into scoped causal evidence", () => {
    const records = telemetryRuntimeEvidence([{
      schemaVersion: 1,
      eventId: "stall-1",
      kind: "entity-stall",
      producer: "qa",
      scope: { operationId: "mutation-1" },
      entityKey: "demo:zombie",
      routeId: "bridge",
      stalledTicks: 80,
    }, {
      schemaVersion: 1,
      eventId: "fallback-1",
      kind: "teleport-fallback",
      producer: "runtime",
      scope: { operationId: "mutation-1" },
      entityKey: "demo:zombie",
      reason: "stalled",
    }]);

    expect(records).toEqual(expect.arrayContaining([
      expect.objectContaining({
        predicate: "navigation-stall-observed",
        state: "present",
        scope: expect.objectContaining({
          operationId: "mutation-1",
          entityKey: "demo:zombie",
        }),
      }),
      expect.objectContaining({
        predicate: "teleport-fallback-observed",
        state: "present",
      }),
    ]));
  });

  it("maps direct anomalies to explicit invariant violations", () => {
    const records = telemetryRuntimeEvidence([{
      schemaVersion: 1,
      eventId: "double-1",
      kind: "arena-double-start",
      producer: "qa",
      scope: {},
      arenaId: "arena-1",
      arenaGeneration: 9,
      startOperationIds: ["start-a", "start-b"],
    }, {
      schemaVersion: 1,
      eventId: "callback-1",
      kind: "stale-callback",
      producer: "instrumentation",
      scope: { operationId: "timer-1" },
      subsystem: "countdown",
      capturedGeneration: 8,
      currentGeneration: 9,
    }, {
      schemaVersion: 1,
      eventId: "revive-1",
      kind: "revive-anomaly",
      producer: "qa",
      scope: { arenaId: "arena-1", arenaGeneration: 9 },
      anomaly: "self-revive",
      targetPlayerKey: "player-a",
      reviverPlayerKey: "player-a",
    }]);

    expect(records).toEqual(expect.arrayContaining([
      expect.objectContaining({
        predicate: "single-start-transaction-owner",
        state: "absent",
      }),
      expect.objectContaining({
        predicate: "current-generation-callback",
        state: "absent",
      }),
      expect.objectContaining({
        predicate: "valid-revive-transaction",
        state: "absent",
      }),
    ]));
  });

  it("maps mutation applied telemetry into timed world mutation evidence", () => {
    const records = telemetryRuntimeEvidence([{
      schemaVersion: 1,
      eventId: "mutation-1",
      kind: "mutation-applied",
      producer: "instrumentation",
      scope: { operationId: "mutation-op" },
      tick: 40,
      sequence: 3,
      mutationKind: "structure-load",
      routeId: "bridge",
    }]);

    expect(records).toEqual(expect.arrayContaining([
      expect.objectContaining({
        predicate: "route-affecting-world-mutation",
        observedAt: {
          tick: 40,
          sequence: 3,
        },
      }),
      expect.objectContaining({
        predicate: "mutation-apply",
        state: "present",
      }),
    ]));
  });

  it("maps arena generation lifecycle anomalies into explicit invariant evidence", () => {
    const records = telemetryRuntimeEvidence([{
      schemaVersion: 1,
      eventId: "arena-generation-1",
      kind: "arena-generation-anomaly",
      producer: "instrumentation",
      scope: { operationId: "start-generation-5" },
      anomaly: "reuse-before-reset",
      arenaId: "arena-1",
      observedGeneration: 5,
      priorGeneration: 4,
      currentGeneration: 5,
    }]);

    expect(records).toEqual(expect.arrayContaining([
      expect.objectContaining({
        predicate: "arena-generation-transition-observed",
        state: "present",
        scope: expect.objectContaining({
          arenaId: "arena-1",
          arenaGeneration: 5,
        }),
      }),
      expect.objectContaining({
        predicate: "arena-generation-transition-valid",
        state: "absent",
      }),
      expect.objectContaining({
        predicate: "arena-generation-anomaly-observed",
        state: "present",
      }),
    ]));
  });

  it("maps state drift into authority/mirror evidence", () => {
    const records = telemetryRuntimeEvidence([{
      schemaVersion: 1,
      eventId: "state-1",
      kind: "state-drift",
      producer: "instrumentation",
      scope: { arenaId: "arena-1", arenaGeneration: 3 },
      contractId: "ready",
      authority: {
        surface: { kind: "scoreboard", key: "ready" },
        value: 1,
        revision: 4,
      },
      mirror: {
        surface: { kind: "tag", key: "ready" },
        value: 0,
        revision: 3,
      },
    }]);

    expect(records).toEqual(expect.arrayContaining([
      expect.objectContaining({
        predicate: "state-mirror-consistent",
        state: "absent",
      }),
      expect.objectContaining({
        predicate: "state-drift-observed",
        state: "present",
      }),
    ]));
  });
});
}

// Original engine/packages/orchestrator/test/diagnosis/telemetry-load.test.ts f7d561579fd17c3445ce2e39edf98ca804f1a72f
{
const batch = {
  schemaVersion: 1 as const,
  artifactId: "art-a",
  sessionId: "qa-1",
  events: [{
    schemaVersion: 1 as const,
    eventId: "stall-1",
    kind: "entity-stall" as const,
    producer: "qa" as const,
    scope: { operationId: "op-1" },
    entityKey: "demo:zombie",
  }],
};

describe("telemetry loading", () => {
  it("loads and validates telemetry batch JSON", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-telemetry-load-"));
    try {
      const path = join(root, "qa.json");
      await writeFile(path, JSON.stringify(batch), "utf8");

      const loaded = await loadTelemetryFile(path);
      expect(loaded).toEqual(batch);
      expect(resolveTelemetryEventsForArtifact(loaded, "art-a")).toHaveLength(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("loads a JSON array of telemetry frames", () => {
    const frames = frameTelemetryBatch(batch, {
      batchId: "batch-1",
      maxPayloadCharacters: 24,
    });

    expect(parseTelemetryText(JSON.stringify(frames))).toEqual(batch);
  });

  it("loads a canonical telemetry frame-set document", () => {
    const frameSet = frameTelemetryBatchSet(batch, {
      batchId: "batch-1",
      maxPayloadCharacters: 24,
    });

    expect(parseTelemetryText(JSON.stringify(frameSet))).toEqual(batch);
  });

  it("loads a JSONL telemetry frame stream", () => {
    const frames = frameTelemetryBatch(batch, {
      batchId: "batch-1",
      maxPayloadCharacters: 24,
    });
    const jsonl = frames
      .map((frame) => JSON.stringify(frame))
      .join("\n");

    expect(parseTelemetryText(jsonl, "capture.jsonl")).toEqual(batch);
  });

  it("does not reinterpret valid but invalid-schema JSON as JSONL", () => {
    expect(() => parseTelemetryText(JSON.stringify({
      schemaVersion: 1,
      events: [{
        schemaVersion: 1,
        eventId: "",
        kind: "entity-stall",
        producer: "qa",
        scope: {},
        entityKey: "demo:zombie",
      }],
    }))).toThrow(/Invalid telemetry batch/);
  });

  it("reports the exact malformed JSONL line", () => {
    const frames = frameTelemetryBatch(batch, {
      batchId: "batch-1",
      maxPayloadCharacters: 24,
    });
    const text = [
      JSON.stringify(frames[0]),
      "{broken",
    ].join("\n");

    expect(() => parseTelemetryText(text, "capture.jsonl"))
      .toThrow(/line 2/);
  });

  it("rejects telemetry captured from another artifact", () => {
    expect(() => resolveTelemetryEventsForArtifact({
      schemaVersion: 1,
      artifactId: "art-old",
      events: [],
    }, "art-new")).toThrow(/does not match inspected artifact/);
  });
});
}
