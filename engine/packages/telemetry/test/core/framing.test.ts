import { describe, expect, it } from "vitest";
import {
  frameTelemetryBatch,
  reassembleTelemetryFrames,
  telemetryBatchChecksum,
} from "../../src/core/framing.js";

const batch = {
  schemaVersion: 1 as const,
  sessionId: "qa-1",
  artifactId: "art-1",
  droppedEvents: 2,
  events: [{
    schemaVersion: 1 as const,
    eventId: "stall-1",
    kind: "entity-stall" as const,
    producer: "qa" as const,
    scope: { operationId: "route-op" },
    entityKey: "demo:zombie",
    routeId: "bridge",
    stalledTicks: 60,
  }],
};

describe("telemetry framing", () => {
  it("round-trips a batch even when frames arrive out of order", () => {
    const frames = frameTelemetryBatch(batch, {
      batchId: "batch-1",
      maxPayloadCharacters: 32,
    });

    expect(frames.length).toBeGreaterThan(1);
    expect(new Set(frames.map((frame) => frame.checksum)).size).toBe(1);
    expect(reassembleTelemetryFrames([...frames].reverse())).toEqual(batch);
    expect(frames[0]?.checksum).toBe(telemetryBatchChecksum(batch));
  });

  it("rejects incomplete and duplicate frame sets", () => {
    const frames = frameTelemetryBatch(batch, {
      batchId: "batch-1",
      maxPayloadCharacters: 20,
    });

    expect(() =>
      reassembleTelemetryFrames(frames.slice(1))
    ).toThrow(/incomplete/);

    expect(() =>
      reassembleTelemetryFrames([
        ...frames.slice(0, -1),
        frames[0]!,
      ])
    ).toThrow(/Duplicate telemetry frame partIndex/);
  });

  it("rejects mixed batches and corrupted payloads", () => {
    const frames = frameTelemetryBatch(batch, {
      batchId: "batch-1",
      maxPayloadCharacters: 20,
    });

    expect(() =>
      reassembleTelemetryFrames([
        { ...frames[0]!, batchId: "other" },
        ...frames.slice(1),
      ])
    ).toThrow(/batchId mismatch/);

    const corrupted = frames.map((frame, index) =>
      index === 0
        ? { ...frame, payload: frame.payload + "x" }
        : frame
    );
    expect(() => reassembleTelemetryFrames(corrupted))
      .toThrow(/checksum validation failed/);
  });

  it("rejects invalid framing budgets", () => {
    expect(() => frameTelemetryBatch(batch, {
      batchId: "batch-1",
      maxPayloadCharacters: 0,
    })).toThrow(/positive integer/);
  });
});
