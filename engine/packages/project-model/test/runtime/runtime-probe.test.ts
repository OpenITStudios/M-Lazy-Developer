import { describe, expect, it } from "vitest";
import {
  parseRuntimeProbeRequest,
  parseRuntimeProbeResponseJson,
  parseRuntimeProbeTranscript,
  validateRuntimeProbeRequest,
  validateRuntimeProbeResponse,
  validateRuntimeProbeTranscript,
} from "../../src/runtime/runtime-probe-validate.js";

describe("runtime probe contracts", () => {
  it("accepts bounded typed probe requests", () => {
    expect(parseRuntimeProbeRequest({
      schemaVersion: 1,
      requestId: "req-1",
      probeId: "chunk-ready",
      predicate: "target-chunk-loaded",
      query: {
        kind: "chunk-loaded",
        dimension: "overworld",
        location: { x: 0, y: 64, z: 0 },
      },
      outcomeByState: {
        present: "ready",
        absent: "not-ready",
      },
    }).query.kind).toBe("chunk-loaded");
  });

  it("binds statePath consistently across a runtime probe exchange", () => {
    const request = {
      schemaVersion: 1 as const,
      requestId: "req-state",
      probeId: "phase",
      predicate: "session-phase-observed",
      statePath: "session.phase",
      query: {
        kind: "scoreboard-value" as const,
        objectiveId: "phase",
        participant: "arena-1",
      },
      outcomeByState: {
        present: "known",
        absent: "missing",
      },
    };
    const response = {
      schemaVersion: 1 as const,
      requestId: "req-state",
      probeId: "phase",
      runtimeTick: 20,
      ok: true,
      state: "present" as const,
      outcomeId: "known",
      statePath: "session.phase",
      evidence: {
        predicate: "session-phase-observed",
        state: "present" as const,
        confidence: "observed" as const,
      },
      value: 3,
    };

    expect(validateRuntimeProbeTranscript({
      schemaVersion: 1,
      exchanges: [{ request, response }],
    })).toEqual([]);

    expect(validateRuntimeProbeTranscript({
      schemaVersion: 1,
      exchanges: [{
        request,
        response: {
          ...response,
          statePath: "record.phase",
        },
      }],
    })).toEqual(expect.arrayContaining([
      expect.stringContaining("statePath mismatch"),
    ]));
  });

  it("rejects arbitrary execution query kinds", () => {
    expect(validateRuntimeProbeRequest({
      schemaVersion: 1,
      requestId: "req-unsafe",
      probeId: "unsafe",
      predicate: "unsafe",
      query: {
        kind: "command",
        command: "kill @e",
      },
      outcomeByState: {
        present: "yes",
        absent: "no",
      },
    })).toEqual(expect.arrayContaining([
      expect.stringContaining("Unsupported runtime probe query kind"),
    ]));
  });

  it("parses a valid response and requires evidence state consistency", () => {
    const response = parseRuntimeProbeResponseJson(JSON.stringify({
      schemaVersion: 1,
      requestId: "req-1",
      probeId: "chunk-ready",
      runtimeTick: 100,
      ok: true,
      state: "present",
      outcomeId: "ready",
      evidence: {
        predicate: "target-chunk-loaded",
        state: "present",
        confidence: "observed",
      },
      value: true,
    }));

    expect(response.outcomeId).toBe("ready");

    expect(validateRuntimeProbeResponse({
      ...response,
      state: "absent",
    })).toEqual(expect.arrayContaining([
      expect.stringContaining("evidence.state must match response state"),
    ]));
  });

  it("validates request and evidence scopes", () => {
    expect(validateRuntimeProbeRequest({
      schemaVersion: 1,
      requestId: "req-scope",
      probeId: "chunk-ready",
      predicate: "target-chunk-loaded",
      scope: {
        arenaId: "",
        arenaGeneration: -1,
      },
      query: {
        kind: "chunk-loaded",
        dimension: "overworld",
        location: { x: 0, y: 64, z: 0 },
      },
      outcomeByState: {
        present: "ready",
        absent: "not-ready",
      },
    })).toEqual(expect.arrayContaining([
      expect.stringContaining("scope.arenaId"),
      expect.stringContaining("scope.arenaGeneration"),
    ]));

    expect(validateRuntimeProbeResponse({
      schemaVersion: 1,
      requestId: "req-scope",
      probeId: "chunk-ready",
      runtimeTick: 100,
      ok: true,
      state: "present",
      outcomeId: "ready",
      evidence: {
        predicate: "target-chunk-loaded",
        state: "present",
        confidence: "observed",
        scope: {
          operationId: "",
          entityGeneration: -1,
        },
      },
    })).toEqual(expect.arrayContaining([
      expect.stringContaining("evidence.scope.operationId"),
      expect.stringContaining("evidence.scope.entityGeneration"),
    ]));
  });

  it("treats participationGeneration as a validated runtime scope boundary", () => {
    expect(validateRuntimeProbeRequest({
      schemaVersion: 1,
      requestId: "req-participation",
      probeId: "session-scope",
      predicate: "session-current",
      scope: {
        playerKey: "player-1",
        connectionGeneration: 3,
        participationGeneration: -1,
      },
      query: {
        kind: "scoreboard-value",
        objectiveId: "session",
        participant: "player-1",
      },
      outcomeByState: {
        present: "current",
        absent: "stale",
      },
    })).toEqual(expect.arrayContaining([
      expect.stringContaining(
        "scope.participationGeneration",
      ),
    ]));

    const request = {
      schemaVersion: 1 as const,
      requestId: "req-participation-match",
      probeId: "session-scope",
      predicate: "session-current",
      scope: {
        playerKey: "player-1",
        connectionGeneration: 3,
        participationGeneration: 9,
      },
      query: {
        kind: "scoreboard-value" as const,
        objectiveId: "session",
        participant: "player-1",
      },
      outcomeByState: {
        present: "current",
        absent: "stale",
      },
    };

    expect(validateRuntimeProbeTranscript({
      schemaVersion: 1,
      exchanges: [{
        request,
        response: {
          schemaVersion: 1,
          requestId: request.requestId,
          probeId: request.probeId,
          runtimeTick: 30,
          ok: true,
          state: "present",
          outcomeId: "current",
          evidence: {
            predicate: request.predicate,
            state: "present",
            confidence: "observed",
            scope: {
              ...request.scope,
              participationGeneration: 8,
            },
            observedAt: { tick: 30 },
          },
          value: 1,
        },
      }],
    })).toEqual(expect.arrayContaining([
      expect.stringContaining("evidence scope mismatch"),
    ]));
  });

  it("treats bootGeneration as a validated runtime scope boundary", () => {
    expect(validateRuntimeProbeRequest({
      schemaVersion: 1,
      requestId: "req-boot",
      probeId: "recovery-scope",
      predicate: "boot-current",
      scope: {
        bootGeneration: -1,
      },
      query: {
        kind: "scoreboard-value",
        objectiveId: "boot",
        participant: "world",
      },
      outcomeByState: {
        present: "current",
        absent: "stale",
      },
    })).toEqual(expect.arrayContaining([
      expect.stringContaining("scope.bootGeneration"),
    ]));

    const request = {
      schemaVersion: 1 as const,
      requestId: "req-boot-match",
      probeId: "recovery-scope",
      predicate: "boot-current",
      scope: {
        bootGeneration: 12,
      },
      query: {
        kind: "scoreboard-value" as const,
        objectiveId: "boot",
        participant: "world",
      },
      outcomeByState: {
        present: "current",
        absent: "stale",
      },
    };

    expect(validateRuntimeProbeTranscript({
      schemaVersion: 1,
      exchanges: [{
        request,
        response: {
          schemaVersion: 1,
          requestId: request.requestId,
          probeId: request.probeId,
          runtimeTick: 40,
          ok: true,
          state: "present",
          outcomeId: "current",
          evidence: {
            predicate: request.predicate,
            state: "present",
            confidence: "observed",
            scope: {
              bootGeneration: 11,
            },
            observedAt: { tick: 40 },
          },
          value: 1,
        },
      }],
    })).toEqual(expect.arrayContaining([
      expect.stringContaining("evidence scope mismatch"),
    ]));
  });

  it("requires failed probes to return unknown state with an error", () => {
    expect(validateRuntimeProbeResponse({
      schemaVersion: 1,
      requestId: "req-failed",
      probeId: "chunk-ready",
      runtimeTick: 100,
      ok: false,
      state: "absent",
      evidence: {
        predicate: "target-chunk-loaded",
        state: "absent",
        confidence: "unknown",
      },
    })).toEqual(expect.arrayContaining([
      expect.stringContaining("ok=false responses must use unknown state"),
      expect.stringContaining("require a non-empty error"),
    ]));

    expect(validateRuntimeProbeResponse({
      schemaVersion: 1,
      requestId: "req-ok",
      probeId: "chunk-ready",
      runtimeTick: 100,
      ok: true,
      state: "present",
      evidence: {
        predicate: "target-chunk-loaded",
        state: "present",
        confidence: "observed",
      },
      error: "should-not-exist",
    })).toEqual(expect.arrayContaining([
      expect.stringContaining("ok=true responses must not include error"),
    ]));
  });

  it("validates request-response transcripts as a trust boundary", () => {
    const request = {
      schemaVersion: 1 as const,
      requestId: "req-transcript",
      probeId: "chunk-ready",
      predicate: "loaded-target-chunk",
      scope: {
        arenaId: "arena-1",
        arenaGeneration: 4,
        operationId: "mutation-1",
      },
      runtimeTick: 90,
      query: {
        kind: "chunk-loaded" as const,
        dimension: "overworld",
        location: { x: 16, y: 64, z: 16 },
      },
      outcomeByState: {
        present: "ready",
        absent: "not-ready",
        unknown: "unknown",
      },
    };

    const response = {
      schemaVersion: 1 as const,
      requestId: "req-transcript",
      probeId: "chunk-ready",
      runtimeTick: 100,
      ok: true,
      state: "present" as const,
      outcomeId: "ready",
      evidence: {
        predicate: "loaded-target-chunk",
        state: "present" as const,
        confidence: "observed" as const,
        scope: request.scope,
        observedAt: { tick: 100 },
      },
      value: true,
    };

    const transcript = parseRuntimeProbeTranscript({
      schemaVersion: 1,
      sessionId: "qa-run",
      artifactId: "art-1",
      exchanges: [{ request, response }],
    });

    expect(transcript.exchanges).toHaveLength(1);
    expect(validateRuntimeProbeTranscript({
      ...transcript,
      exchanges: [{
        request,
        response: {
          ...response,
          evidence: {
            ...response.evidence,
            predicate: "wrong-predicate",
            scope: {
              ...request.scope,
              arenaGeneration: 5,
            },
          },
          runtimeTick: 80,
          outcomeId: "not-ready",
        },
      }],
    })).toEqual(expect.arrayContaining([
      expect.stringContaining("evidence predicate mismatch"),
      expect.stringContaining("evidence scope mismatch"),
      expect.stringContaining("response runtimeTick precedes request runtimeTick"),
      expect.stringContaining("outcomeId does not match request outcome mapping"),
    ]));
  });

  it("rejects duplicate request ids inside one transcript", () => {
    const request = parseRuntimeProbeRequest({
      schemaVersion: 1,
      requestId: "req-dup",
      probeId: "entity-live",
      predicate: "critical-entity-resolvable",
      query: {
        kind: "entity-resolvable",
        entityId: "entity-1",
      },
      outcomeByState: {
        present: "live",
        absent: "missing",
      },
    });
    const response = {
      schemaVersion: 1 as const,
      requestId: "req-dup",
      probeId: "entity-live",
      runtimeTick: 10,
      ok: true,
      state: "present" as const,
      outcomeId: "live",
      evidence: {
        predicate: "critical-entity-resolvable",
        state: "present" as const,
        confidence: "observed" as const,
        observedAt: { tick: 10 },
      },
      value: true,
    };

    expect(validateRuntimeProbeTranscript({
      schemaVersion: 1,
      exchanges: [
        { request, response },
        { request, response },
      ],
    })).toEqual(expect.arrayContaining([
      expect.stringContaining("duplicates requestId req-dup"),
    ]));
  });

  it("allows failed transcript responses without a logical outcome id", () => {
    const request = parseRuntimeProbeRequest({
      schemaVersion: 1,
      requestId: "req-failed-transcript",
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
        unknown: "unknown",
      },
    });

    expect(validateRuntimeProbeTranscript({
      schemaVersion: 1,
      exchanges: [{
        request,
        response: {
          schemaVersion: 1,
          requestId: request.requestId,
          probeId: request.probeId,
          runtimeTick: 20,
          ok: false,
          state: "unknown",
          evidence: {
            predicate: request.predicate,
            state: "unknown",
            confidence: "unknown",
            observedAt: { tick: 20 },
          },
          error: "dimension unavailable",
        },
      }],
    })).toEqual([]);
  });

  it("rejects malformed response json", () => {
    expect(() => parseRuntimeProbeResponseJson("{bad-json"))
      .toThrow(/Invalid runtime probe response JSON/);
  });
});
