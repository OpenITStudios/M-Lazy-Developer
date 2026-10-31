// Same-directory feature/lane test consolidation, original cases kept in lexical blocks.
import { describe, expect, it } from "vitest";
import { analyzeTelemetryContinuity } from "../../src/evidence/telemetry-continuity.js";
import type { TelemetryBatch } from "../../src/evidence/telemetry.js";
import { parseTelemetryBatch, validateTelemetryBatch } from "../../src/evidence/telemetry-validate.js";

// Original engine/packages/project-model/test/evidence/telemetry-continuity.test.ts; SHA a50d254a3da2ff4416eb4df23f4932dc85ac95b1
{
function batch(
  events: TelemetryBatch["events"],
  droppedEvents = 0,
): TelemetryBatch {
  return {
    schemaVersion: 1,
    ...(droppedEvents === 0 ? {} : { droppedEvents }),
    events,
  };
}

describe("telemetry continuity", () => {
  it("analyzes sequence continuity independently per stream", () => {
    const report = analyzeTelemetryContinuity(batch([
      {
        schemaVersion: 1,
        eventId: "a1",
        kind: "route-revalidation",
        producer: "runtime",
        scope: {},
        streamId: "stream-a",
        sequence: 10,
        routeId: "a",
        result: "passed",
      },
      {
        schemaVersion: 1,
        eventId: "b1",
        kind: "route-revalidation",
        producer: "runtime",
        scope: {},
        streamId: "stream-b",
        sequence: 50,
        routeId: "b",
        result: "passed",
      },
      {
        schemaVersion: 1,
        eventId: "a3",
        kind: "route-revalidation",
        producer: "runtime",
        scope: {},
        streamId: "stream-a",
        sequence: 12,
        routeId: "a",
        result: "passed",
      },
      {
        schemaVersion: 1,
        eventId: "b2",
        kind: "route-revalidation",
        producer: "runtime",
        scope: {},
        streamId: "stream-b",
        sequence: 51,
        routeId: "b",
        result: "passed",
      },
    ]));

    expect(report.streams).toHaveLength(2);
    expect(report.missingSequences).toBe(1);
    expect(report.streams.find(
      (stream) => stream.streamId === "stream-a",
    )?.gaps).toEqual([{
      after: 10,
      before: 12,
      missing: 1,
    }]);
    expect(report.streams.find(
      (stream) => stream.streamId === "stream-b",
    )?.gaps).toEqual([]);
    expect(report.incomplete).toBe(true);
  });

  it("detects duplicate and non-monotonic sequence values", () => {
    const report = analyzeTelemetryContinuity(batch([
      {
        schemaVersion: 1,
        eventId: "e1",
        kind: "mutation-verification",
        producer: "runtime",
        scope: {},
        streamId: "stream-a",
        sequence: 3,
        result: "passed",
      },
      {
        schemaVersion: 1,
        eventId: "e2",
        kind: "mutation-verification",
        producer: "runtime",
        scope: {},
        streamId: "stream-a",
        sequence: 2,
        result: "passed",
      },
      {
        schemaVersion: 1,
        eventId: "e3",
        kind: "mutation-verification",
        producer: "runtime",
        scope: {},
        streamId: "stream-a",
        sequence: 2,
        result: "failed",
      },
    ]));

    expect(report.duplicateSequences).toBe(1);
    expect(report.nonMonotonicTransitions).toBe(2);
    expect(report.incomplete).toBe(true);
  });

  it("does not assume that a stream must start at sequence one", () => {
    const report = analyzeTelemetryContinuity(batch([
      {
        schemaVersion: 1,
        eventId: "e50",
        kind: "route-revalidation",
        producer: "runtime",
        scope: {},
        streamId: "stream-a",
        sequence: 50,
        routeId: "bridge",
        result: "passed",
      },
      {
        schemaVersion: 1,
        eventId: "e51",
        kind: "route-revalidation",
        producer: "runtime",
        scope: {},
        streamId: "stream-a",
        sequence: 51,
        routeId: "bridge",
        result: "passed",
      },
    ]));

    expect(report.missingSequences).toBe(0);
    expect(report.incomplete).toBe(false);
  });

  it("tracks unidentified and unsequenced telemetry separately", () => {
    const report = analyzeTelemetryContinuity(batch([
      {
        schemaVersion: 1,
        eventId: "sequenced",
        kind: "route-revalidation",
        producer: "runtime",
        scope: {},
        sequence: 4,
        routeId: "bridge",
        result: "passed",
      },
      {
        schemaVersion: 1,
        eventId: "manual",
        kind: "route-revalidation",
        producer: "manual",
        scope: {},
        routeId: "bridge",
        result: "passed",
      },
    ], 2));

    expect(report.sequencedEvents).toBe(1);
    expect(report.unsequencedEvents).toBe(1);
    expect(report.unidentifiedStreamEvents).toBe(1);
    expect(report.droppedEvents).toBe(2);
    expect(report.incomplete).toBe(true);
  });
});
}

// Original engine/packages/project-model/test/evidence/telemetry-validate.test.ts; SHA d7e78e0e3b2c0fd4aa6046fe6b39f3b5f44c9c9f
{
describe("telemetry validation", () => {
  it("accepts a standardized telemetry batch", () => {
    const batch = parseTelemetryBatch({
      schemaVersion: 1,
      sessionId: "qa-1",
      events: [{
        schemaVersion: 1,
        eventId: "stall-1",
        kind: "entity-stall",
        producer: "qa",
        scope: {
          arenaId: "arena-1",
          arenaGeneration: 4,
          entityKey: "demo:zombie",
          operationId: "mutation-1",
        },
        entityKey: "demo:zombie",
        routeId: "bridge",
        stalledTicks: 60,
      }],
    });

    expect(batch.events).toHaveLength(1);
  });

  it("accepts typed state observation telemetry", () => {
    const batch = parseTelemetryBatch({
      schemaVersion: 1,
      events: [{
        schemaVersion: 1,
        eventId: "state-1",
        kind: "state-observation",
        producer: "instrumentation",
        scope: {
          arenaId: "arena-1",
          arenaGeneration: 2,
        },
        path: "session.phase",
        value: "active",
      }],
    });

    expect(batch.events[0]?.kind).toBe("state-observation");
  });

  it("accepts gameplay outcome telemetry", () => {
    const batch = parseTelemetryBatch({
      schemaVersion: 1,
      events: [{
        schemaVersion: 1,
        eventId: "outcome-1",
        kind: "gameplay-outcome",
        producer: "instrumentation",
        scope: {
          arenaId: "arena-1",
          arenaGeneration: 2,
        },
        outcomeId: "outcome:decide-reconnect-cleanup",
      }],
    });

    expect(batch.events[0]?.kind).toBe("gameplay-outcome");
  });

  it("accepts route observation telemetry", () => {
    const batch = parseTelemetryBatch({
      schemaVersion: 1,
      events: [{
        schemaVersion: 1,
        eventId: "route-1",
        kind: "route-observation",
        producer: "instrumentation",
        scope: {
          arenaId: "arena_6",
          arenaGeneration: 3,
        },
        entityKey: "demo:zombie",
        routeId: "bridge",
        routeIndex: 606,
        worldLocation: {
          x: 1778,
          y: -30,
          z: 0,
        },
      }],
    });

    expect(batch.events[0]?.kind).toBe("route-observation");
  });

  it("rejects malformed route observation coordinates", () => {
    const errors = validateTelemetryBatch({
      schemaVersion: 1,
      events: [{
        schemaVersion: 1,
        eventId: "route-bad",
        kind: "route-observation",
        producer: "qa",
        scope: {},
        entityKey: "demo:zombie",
        routeIndex: 1.5,
        worldLocation: {
          x: 1,
          y: "bad",
          z: 2,
        },
      }],
    });

    expect(errors).toEqual(expect.arrayContaining([
      expect.stringMatching(/routeIndex must be an integer/),
      expect.stringMatching(/worldLocation\.y/),
    ]));
  });

  it("accepts navigation target and reachability telemetry", () => {
    const batch = parseTelemetryBatch({
      schemaVersion: 1,
      events: [
        {
          schemaVersion: 1,
          eventId: "nav-1",
          kind: "navigation-target-observation",
          producer: "instrumentation",
          scope: {
            arenaId: "arena_6",
            arenaGeneration: 3,
          },
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
          schemaVersion: 1,
          eventId: "reach-1",
          kind: "route-reachability-observation",
          producer: "instrumentation",
          scope: {
            arenaId: "arena_6",
            arenaGeneration: 3,
          },
          entityKey: "demo:zombie",
          routeId: "bridge",
          routeIndex: 606,
          reachable: true,
          mechanism: "gametest-path-check",
        },
      ],
    });

    expect(batch.events.map((event) => event.kind)).toEqual([
      "navigation-target-observation",
      "route-reachability-observation",
    ]);
  });

  it("rejects malformed navigation evidence", () => {
    const errors = validateTelemetryBatch({
      schemaVersion: 1,
      events: [
        {
          schemaVersion: 1,
          eventId: "nav-bad",
          kind: "navigation-target-observation",
          producer: "qa",
          scope: {},
          entityKey: "demo:zombie",
          targetLocation: {
            x: 1,
            y: "bad",
            z: 2,
          },
        },
        {
          schemaVersion: 1,
          eventId: "reach-bad",
          kind: "route-reachability-observation",
          producer: "qa",
          scope: {},
          entityKey: "demo:zombie",
          reachable: "yes",
        },
      ],
    });

    expect(errors).toEqual(expect.arrayContaining([
      expect.stringMatching(/targetLocation\.y/),
      expect.stringMatching(/reachable must be boolean/),
    ]));
  });

  it("rejects duplicate event ids and malformed event payloads", () => {
    const errors = validateTelemetryBatch({
      schemaVersion: 1,
      events: [{
        schemaVersion: 1,
        eventId: "same",
        kind: "arena-double-start",
        producer: "qa",
        scope: {},
        arenaId: "arena-1",
      }, {
        schemaVersion: 1,
        eventId: "same",
        kind: "unknown-event",
        producer: "qa",
        scope: {},
      }],
    });

    expect(errors).toEqual(expect.arrayContaining([
      expect.stringMatching(/arenaGeneration/),
      expect.stringMatching(/unsupported/),
      "Duplicate telemetry eventId: same",
    ]));
  });
});
}
