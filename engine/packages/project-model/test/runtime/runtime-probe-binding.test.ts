import { describe, expect, it } from "vitest";
import {
  parseRuntimeProbeBindingSet,
  parseRuntimeProbeRequestBundle,
  validateRuntimeProbeBindingSet,
  validateRuntimeProbeRequestBundle,
} from "../../src/runtime/runtime-probe-validate.js";

describe("runtime probe binding and request bundles", () => {
  it("validates explicit incident-scoped bindings", () => {
    const set = parseRuntimeProbeBindingSet({
      schemaVersion: 1,
      bindings: [{
        probeId: "chunk-ready",
        incidentId: "incident-1",
        predicate: "loaded-target-chunk",
        scope: {
          arenaId: "arena-1",
          arenaGeneration: 4,
          operationId: "load-4",
        },
        query: {
          kind: "chunk-loaded",
          dimension: "overworld",
          location: { x: 16, y: 64, z: 16 },
        },
        outcomeByState: {
          present: "ready",
          absent: "not-ready",
        },
      }],
    });

    expect(set.bindings).toHaveLength(1);
  });

  it("rejects duplicate incident/probe bindings and malformed queries", () => {
    const binding = {
      probeId: "chunk-ready",
      incidentId: "incident-1",
      predicate: "loaded-target-chunk",
      query: {
        kind: "chunk-loaded",
        dimension: "",
        location: { x: 0, y: 64, z: 0 },
      },
      outcomeByState: {
        present: "ready",
        absent: "not-ready",
      },
    };

    const errors = validateRuntimeProbeBindingSet({
      schemaVersion: 1,
      bindings: [binding, binding],
    });

    expect(errors).toEqual(expect.arrayContaining([
      expect.stringMatching(/dimension/),
      expect.stringMatching(/Duplicate runtime probe binding/),
    ]));
  });

  it("accepts generic and incident-specific bindings for the same probe", () => {
    const generic = {
      probeId: "chunk-ready",
      predicate: "loaded-target-chunk",
      query: {
        kind: "chunk-loaded",
        dimension: "overworld",
        location: { x: 0, y: 64, z: 0 },
      },
      outcomeByState: {
        present: "ready",
        absent: "not-ready",
      },
    };
    expect(validateRuntimeProbeBindingSet({
      schemaVersion: 1,
      bindings: [
        generic,
        { ...generic, incidentId: "incident-1" },
      ],
    })).toEqual([]);
  });

  it("validates request bundles and rejects duplicate request ids", () => {
    const request = {
      schemaVersion: 1,
      requestId: "req-1",
      probeId: "chunk-ready",
      predicate: "loaded-target-chunk",
      query: {
        kind: "chunk-loaded",
        dimension: "overworld",
        location: { x: 0, y: 64, z: 0 },
      },
      outcomeByState: {
        present: "ready",
        absent: "not-ready",
      },
    };

    expect(parseRuntimeProbeRequestBundle({
      schemaVersion: 1,
      sessionId: "qa-run",
      artifactId: "art-1",
      incidentIds: ["incident-1"],
      requests: [request],
    }).requests).toHaveLength(1);

    expect(validateRuntimeProbeRequestBundle({
      schemaVersion: 1,
      incidentIds: ["incident-1", "incident-1"],
      requests: [request, request],
    })).toEqual(expect.arrayContaining([
      "Duplicate runtime probe request bundle incidentId: incident-1",
      "Duplicate runtime probe request bundle requestId: req-1",
    ]));
  });
});
