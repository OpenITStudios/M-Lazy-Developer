// Source-preserving consolidation: original test cases remain in isolated lexical blocks.
import { describe, expect, it } from "vitest";
import { runtimeProbeResponseEvidence } from "../../src/diagnosis/runtime-probe-evidence.js";
import type { CausalIncident, DiagnosticProbeDefinition, RuntimeProbeExchange, RuntimeProbeTranscript, DiagnosticProbePlan, RuntimeProbeBinding } from "../../../project-model/src/index.js";
import { replayRuntimeProbeTranscript } from "../../src/diagnosis/runtime-probe-replay.js";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { assertRuntimeProbeTranscriptArtifact, loadRuntimeProbeTranscript } from "../../src/diagnosis/runtime-probe-load.js";
import type { DiagnosticProbeAnalysis } from "../../src/diagnosis/diagnostic-probe-analysis.js";
import { prepareRuntimeProbeBundle } from "../../src/diagnosis/runtime-probe-bundle.js";
import { loadRuntimeProbeBindings } from "../../src/diagnosis/runtime-probe-binding-load.js";

// Consolidated suite from engine/packages/orchestrator/test/diagnosis/runtime-probe-evidence.test.ts
{
describe("runtime probe response evidence", () => {
  it("normalizes response evidence and summarizes states", () => {
    const result = runtimeProbeResponseEvidence([{
      schemaVersion: 1,
      requestId: "req-present",
      probeId: "chunk",
      runtimeTick: 100,
      ok: true,
      state: "present",
      outcomeId: "ready",
      statePath: "session.phase",
      evidence: {
        predicate: "loaded-target-chunk",
        state: "present",
        confidence: "observed",
        scope: { operationId: "mutation-op" },
      },
      value: "active",
    }, {
      schemaVersion: 1,
      requestId: "req-failed",
      probeId: "entity",
      runtimeTick: 101,
      ok: false,
      state: "unknown",
      evidence: {
        predicate: "critical-entity-resolvable",
        state: "unknown",
        confidence: "unknown",
        scope: { entityKey: "entity-1" },
      },
      error: "entity unavailable",
    }]);

    expect(result.summary).toEqual({
      responses: 2,
      present: 1,
      absent: 0,
      unknown: 1,
      failed: 1,
    });
    expect(result.records[0]).toEqual(expect.objectContaining({
      predicate: "loaded-target-chunk",
      observedAt: { tick: 100 },
      relatedNodeIds: expect.arrayContaining([
        "runtime-probe-response:req-present",
        "runtime-probe-outcome:ready",
      ]),
    }));
    expect(result.records[1]).toEqual(expect.objectContaining({
      confidence: "unknown",
      observedAt: { tick: 101 },
    }));
    expect(result.stateObservations).toEqual([
      {
        path: "session.phase",
        value: "active",
        confidence: "observed",
        origin: "runtime-probe",
        scope: { operationId: "mutation-op" },
        observedAt: { tick: 100 },
        evidenceId: "runtime-probe-state:req-present",
      },
    ]);
    expect(
      result.routeChunkAvailabilityObservations,
    ).toEqual([]);
  });

  it("extracts typed route chunk availability observations", () => {
    const loaded = runtimeProbeResponseEvidence([{
      schemaVersion: 1,
      requestId:
        "route-stall::telemetry-stall:stall-225::chunk-route-availability",
      probeId: "gameplay-route-chunk-availability",
      runtimeTick: 226,
      ok: true,
      state: "present",
      outcomeId: "route-target-chunk-loaded",
      evidence: {
        predicate: "route-target-chunk-loaded",
        state: "present",
        confidence: "observed",
        scope: {
          arenaId: "arena_6",
          arenaGeneration: 3,
          entityKey: "demo:zombie",
        },
      },
    }]);

    expect(
      loaded.routeChunkAvailabilityObservations,
    ).toEqual([{
      requestId:
        "route-stall::telemetry-stall:stall-225::chunk-route-availability",
      state: "loaded",
      scope: {
        arenaId: "arena_6",
        arenaGeneration: 3,
        entityKey: "demo:zombie",
      },
      observedAt: { tick: 226 },
      evidenceId:
        "runtime-probe-route-chunk:route-stall::telemetry-stall:stall-225::chunk-route-availability",
    }]);

    const notLoaded = runtimeProbeResponseEvidence([{
      schemaVersion: 1,
      requestId:
        "route-stall::telemetry-stall:stall-225::chunk-route-availability",
      probeId: "gameplay-route-chunk-availability",
      runtimeTick: 226,
      ok: true,
      state: "absent",
      outcomeId: "route-target-chunk-not-loaded",
      evidence: {
        predicate: "route-target-chunk-loaded",
        state: "absent",
        confidence: "observed",
      },
    }]);

    expect(
      notLoaded.routeChunkAvailabilityObservations[0]?.state,
    ).toBe("not-loaded");

    const unknown = runtimeProbeResponseEvidence([{
      schemaVersion: 1,
      requestId:
        "route-stall::telemetry-stall:stall-225::chunk-route-availability",
      probeId: "gameplay-route-chunk-availability",
      runtimeTick: 226,
      ok: false,
      state: "unknown",
      evidence: {
        predicate: "route-target-chunk-loaded",
        state: "unknown",
        confidence: "unknown",
      },
      error: "probe unavailable",
    }]);

    expect(
      unknown.routeChunkAvailabilityObservations[0]?.state,
    ).toBe("unknown");
  });
});
}

// Consolidated suite from engine/packages/orchestrator/test/diagnosis/runtime-probe-replay.test.ts
{
function incident(): CausalIncident {
  return {
    id: "incident-1",
    scopeKey: "operation-1",
    severity: "critical",
    confidence: "medium",
    chainIds: [],
    relatedDiagnosticIds: [],
    nodes: [],
    links: [],
    rootCauseCandidates: [{
      id: "chunk",
      label: "chunk-not-ready",
      evidenceLevel: "unproven-candidate",
      severity: "critical",
      confidence: "medium",
      chainIds: [],
      relatedDiagnosticIds: [],
      support: {
        dependencyViolations: 0,
        evidenceGaps: 1,
        corroboratedRisks: 0,
        observedOutcomes: 0,
      },
    }, {
      id: "route",
      label: "route-invalid",
      evidenceLevel: "unproven-candidate",
      severity: "medium",
      confidence: "low",
      chainIds: [],
      relatedDiagnosticIds: [],
      support: {
        dependencyViolations: 0,
        evidenceGaps: 1,
        corroboratedRisks: 0,
        observedOutcomes: 0,
      },
    }],
  };
}

const probes: DiagnosticProbeDefinition[] = [{
  id: "chunk-ready",
  label: "Observe chunk readiness",
  requiredContext: "LIVE_MINECRAFT",
  costUnits: 1,
  mutationRisk: "read-only",
  outcomes: [{
    id: "ready",
    observation: "chunk ready",
    rejectsCandidateIds: ["chunk"],
  }, {
    id: "not-ready",
    observation: "chunk not ready",
    supportsCandidateIds: ["chunk"],
    rejectsCandidateIds: ["route"],
  }],
}, {
  id: "route-valid",
  label: "Observe route validity",
  requiredContext: "LIVE_MINECRAFT",
  costUnits: 1,
  mutationRisk: "read-only",
  outcomes: [{
    id: "valid",
    observation: "route valid",
    rejectsCandidateIds: ["route"],
  }, {
    id: "invalid",
    observation: "route invalid",
    supportsCandidateIds: ["route"],
  }],
}];

function exchange(input: {
  requestId: string;
  probeId: string;
  state: "present" | "absent" | "unknown";
  outcomeId?: string;
  ok?: boolean;
  incidentId?: string | null;
}): RuntimeProbeExchange {
  const ok = input.ok ?? true;
  const outcomeByState =
    input.probeId === "chunk-ready"
      ? {
          present: "ready",
          absent: "not-ready",
          unknown: "unknown",
        }
      : {
          present: "valid",
          absent: "invalid",
          unknown: "unknown",
        };

  return {
    request: {
      schemaVersion: 1,
      requestId: input.requestId,
      probeId: input.probeId,
      ...(input.incidentId === null
        ? {}
        : { incidentId: input.incidentId ?? "incident-1" }),
      predicate: input.probeId,
      runtimeTick: 90,
      query: {
        kind: "tag-present",
        subjectKind: "entity",
        subjectId: "entity-1",
        tag: input.probeId,
      },
      outcomeByState,
    },
    response: {
      schemaVersion: 1,
      requestId: input.requestId,
      probeId: input.probeId,
      runtimeTick: 100,
      ok,
      state: input.state,
      ...(input.outcomeId === undefined
        ? {}
        : { outcomeId: input.outcomeId }),
      evidence: {
        predicate: input.probeId,
        state: input.state,
        confidence: ok ? "observed" : "unknown",
        observedAt: { tick: 100 },
      },
      ...(ok ? {} : { error: "probe backend unavailable" }),
    },
  };
}

describe("adaptive runtime probe transcript replay", () => {
  it("rejects a candidate and plans only remaining unanswered probes", () => {
    const transcript: RuntimeProbeTranscript = {
      schemaVersion: 1,
      exchanges: [exchange({
        requestId: "req-1",
        probeId: "chunk-ready",
        state: "present",
        outcomeId: "ready",
      })],
    };

    const result = replayRuntimeProbeTranscript(
      incident(),
      probes,
      transcript,
      { availableContext: "LIVE_MINECRAFT" },
    );

    expect(result.successfulProbeIds).toEqual(["chunk-ready"]);
    expect(result.incident.rootCauseCandidates.map((item) => item.id))
      .toEqual(["route"]);
    expect(result.nextPlan.recommended.map((item) => item.probeId))
      .toEqual(["route-valid"]);
    expect(result.failed).toEqual([]);
  });

  it("keeps failed probes from changing candidates and allows them to be retried", () => {
    const transcript: RuntimeProbeTranscript = {
      schemaVersion: 1,
      exchanges: [exchange({
        requestId: "req-1",
        probeId: "chunk-ready",
        state: "unknown",
        ok: false,
      })],
    };

    const result = replayRuntimeProbeTranscript(
      incident(),
      probes,
      transcript,
      { availableContext: "LIVE_MINECRAFT" },
    );

    expect(result.successfulProbeIds).toEqual([]);
    expect(result.incident.rootCauseCandidates.map((item) => item.id).sort())
      .toEqual(["chunk", "route"]);
    expect(result.nextPlan.recommended.map((item) => item.probeId))
      .toContain("chunk-ready");
    expect(result.failed).toEqual([
      expect.objectContaining({
        requestId: "req-1",
        probeId: "chunk-ready",
      }),
    ]);
    expect(result.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        state: "unknown",
        confidence: "unknown",
      }),
    ]));
  });

  it("reports candidate-set-exhausted when evidence rejects the final candidate", () => {
    const singleIncident: CausalIncident = {
      ...incident(),
      rootCauseCandidates: [incident().rootCauseCandidates[0]!],
    };

    const transcript: RuntimeProbeTranscript = {
      schemaVersion: 1,
      exchanges: [exchange({
        requestId: "req-1",
        probeId: "chunk-ready",
        state: "present",
        outcomeId: "ready",
      })],
    };

    const result = replayRuntimeProbeTranscript(
      singleIncident,
      [probes[0]!],
      transcript,
      { availableContext: "LIVE_MINECRAFT" },
    );

    expect(result.incident.rootCauseCandidates).toEqual([]);
    expect(result.nextPlan.stopCondition).toBe("candidate-set-exhausted");
  });

  it("ignores unscoped exchanges by default", () => {
    const transcript: RuntimeProbeTranscript = {
      schemaVersion: 1,
      exchanges: [exchange({
        requestId: "req-unscoped",
        probeId: "chunk-ready",
        incidentId: null,
        state: "present",
        outcomeId: "ready",
      })],
    };

    const safe = replayRuntimeProbeTranscript(
      incident(),
      probes,
      transcript,
      { availableContext: "LIVE_MINECRAFT" },
    );
    expect(safe.ignoredIncidentExchanges).toBe(1);
    expect(safe.successfulProbeIds).toEqual([]);

    const legacy = replayRuntimeProbeTranscript(
      incident(),
      probes,
      transcript,
      {
        availableContext: "LIVE_MINECRAFT",
        allowUnscopedRequests: true,
      },
    );
    expect(legacy.ignoredIncidentExchanges).toBe(0);
    expect(legacy.successfulProbeIds).toEqual(["chunk-ready"]);
  });

  it("ignores exchanges explicitly bound to another incident", () => {
    const transcript: RuntimeProbeTranscript = {
      schemaVersion: 1,
      exchanges: [exchange({
        requestId: "req-other",
        probeId: "chunk-ready",
        incidentId: "incident-other",
        state: "present",
        outcomeId: "ready",
      }), exchange({
        requestId: "req-current",
        probeId: "route-valid",
        incidentId: "incident-1",
        state: "present",
        outcomeId: "valid",
      })],
    };

    const result = replayRuntimeProbeTranscript(
      incident(),
      probes,
      transcript,
      { availableContext: "LIVE_MINECRAFT" },
    );

    expect(result.ignoredIncidentExchanges).toBe(1);
    expect(result.successfulProbeIds).toEqual(["route-valid"]);
    expect(result.incident.rootCauseCandidates.map((item) => item.id))
      .toEqual(["chunk"]);
  });

  it("marks replay incomplete when the transcript dropped earlier exchanges", () => {
    const transcript: RuntimeProbeTranscript = {
      schemaVersion: 1,
      droppedExchanges: 2,
      exchanges: [exchange({
        requestId: "req-1",
        probeId: "chunk-ready",
        state: "present",
        outcomeId: "ready",
      })],
    };

    const result = replayRuntimeProbeTranscript(
      incident(),
      probes,
      transcript,
      { availableContext: "LIVE_MINECRAFT" },
    );

    expect(result.transcriptIncomplete).toBe(true);
    expect(result.droppedExchanges).toBe(2);
  });
});
}

// Consolidated suite from engine/packages/orchestrator/test/diagnosis/runtime-probe-load.test.ts
{
describe("runtime probe transcript loading", () => {
  it("loads and validates a trusted transcript", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-probe-load-"));
    try {
      const path = join(root, "probes.json");
      await writeFile(path, JSON.stringify({
        schemaVersion: 1,
        artifactId: "art-1",
        sessionId: "qa-1",
        exchanges: [{
          request: {
            schemaVersion: 1,
            requestId: "req-1",
            probeId: "chunk-ready",
            predicate: "loaded-target-chunk",
            scope: { operationId: "mutation-1" },
            runtimeTick: 90,
            query: {
              kind: "chunk-loaded",
              dimension: "overworld",
              location: { x: 0, y: 64, z: 0 },
            },
            outcomeByState: {
              present: "ready",
              absent: "not-ready",
            },
          },
          response: {
            schemaVersion: 1,
            requestId: "req-1",
            probeId: "chunk-ready",
            runtimeTick: 100,
            ok: true,
            state: "present",
            outcomeId: "ready",
            evidence: {
              predicate: "loaded-target-chunk",
              state: "present",
              confidence: "observed",
              scope: { operationId: "mutation-1" },
              observedAt: { tick: 100 },
            },
            value: true,
          },
        }],
      }), "utf8");

      const transcript = await loadRuntimeProbeTranscript(path);
      expect(transcript.exchanges).toHaveLength(1);
      expect(() =>
        assertRuntimeProbeTranscriptArtifact(transcript, "art-1")
      ).not.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects transcript evidence from another artifact", () => {
    expect(() => assertRuntimeProbeTranscriptArtifact({
      schemaVersion: 1,
      artifactId: "art-old",
      exchanges: [],
    }, "art-new")).toThrow(/does not match inspected artifact/);
  });
});
}

// Consolidated suite from engine/packages/orchestrator/test/diagnosis/runtime-probe-bundle.test.ts
{
const incident: CausalIncident = {
  id: "incident-1",
  scopeKey: "operation-1",
  severity: "medium",
  confidence: "low",
  chainIds: [],
  relatedDiagnosticIds: [],
  nodes: [],
  links: [],
  rootCauseCandidates: [{
    id: "candidate-1",
    label: "block-write",
    evidenceLevel: "unproven-candidate",
    severity: "medium",
    confidence: "low",
    chainIds: [],
    relatedDiagnosticIds: [],
    support: {
      dependencyViolations: 0,
      evidenceGaps: 1,
      corroboratedRisks: 0,
      observedOutcomes: 0,
    },
  }],
};

const definition: DiagnosticProbeDefinition = {
  id: "chunk-ready",
  label: "Observe chunk readiness",
  requiredContext: "LIVE_MINECRAFT",
  costUnits: 1,
  mutationRisk: "read-only",
  outcomes: [{
    id: "ready",
    observation: "ready",
    rejectsCandidateIds: ["candidate-1"],
  }, {
    id: "not-ready",
    observation: "not ready",
    supportsCandidateIds: ["candidate-1"],
  }],
};

const localPlan: DiagnosticProbePlan = {
  incidentId: "incident-1",
  availableContext: "LOCAL_ARTIFACT",
  unresolvedCandidateIds: ["candidate-1"],
  recommended: [],
  blockedByContext: [{
    probeId: "chunk-ready",
    label: "Observe chunk readiness",
    requiredContext: "LIVE_MINECRAFT",
    costUnits: 1,
    mutationRisk: "read-only",
    coveredCandidateIds: ["candidate-1"],
    pairSeparationCount: 0,
    score: 2,
  }],
  stopCondition: "candidate-proven",
};

const analysis: DiagnosticProbeAnalysis = {
  incidents: [{
    incidentId: "incident-1",
    definitions: [definition],
    plan: localPlan,
  }],
  definitions: 1,
  recommended: 0,
  blockedByContext: 1,
};

const binding: RuntimeProbeBinding = {
  probeId: "chunk-ready",
  incidentId: "incident-1",
  predicate: "loaded-target-chunk",
  scope: {
    arenaId: "arena-1",
    arenaGeneration: 4,
    operationId: "operation-1",
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
};

describe("runtime probe bundle preparation", () => {
  it("replans blocked static probes for live runtime and compiles requests", () => {
    const result = prepareRuntimeProbeBundle({
      causalAnalysis: {
        incidents: [incident],
      },
      diagnosticProbeAnalysis: analysis,
    }, {
      availableContext: "LIVE_MINECRAFT",
      bindings: [binding],
      artifactId: "art-1",
      sessionId: "qa-run",
      runtimeTick: 100,
    });

    expect(result.issues).toEqual([]);
    expect(result.bundle).toMatchObject({
      schemaVersion: 1,
      sessionId: "qa-run",
      artifactId: "art-1",
      incidentIds: ["incident-1"],
      requests: [{
        probeId: "chunk-ready",
        predicate: "loaded-target-chunk",
        runtimeTick: 100,
        scope: {
          arenaId: "arena-1",
          arenaGeneration: 4,
          operationId: "operation-1",
        },
      }],
    });
    expect(result.incidents[0]?.plan.recommended).toHaveLength(1);
  });

  it("keeps compilation issues visible when a binding is missing", () => {
    const result = prepareRuntimeProbeBundle({
      causalAnalysis: {
        incidents: [incident],
      },
      diagnosticProbeAnalysis: analysis,
    }, {
      availableContext: "LIVE_MINECRAFT",
      bindings: [],
    });

    expect(result.bundle.requests).toEqual([]);
    expect(result.issues).toEqual([
      expect.objectContaining({
        kind: "missing-binding",
        probeId: "chunk-ready",
      }),
    ]);
  });
});
}

// Consolidated suite from engine/packages/orchestrator/test/diagnosis/runtime-probe-binding-load.test.ts
{
describe("runtime probe binding loader", () => {
  it("loads a validated binding registry", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-bindings-"));
    try {
      const path = join(root, "bindings.json");
      await writeFile(path, JSON.stringify({
        schemaVersion: 1,
        bindings: [{
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
        }],
      }), "utf8");

      const result = await loadRuntimeProbeBindings(path);
      expect(result.bindings).toHaveLength(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects malformed binding registries", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-bindings-bad-"));
    try {
      const path = join(root, "bindings.json");
      await writeFile(path, JSON.stringify({
        schemaVersion: 1,
        bindings: [{
          probeId: "chunk-ready",
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
        }],
      }), "utf8");

      await expect(loadRuntimeProbeBindings(path))
        .rejects.toThrow(/Invalid runtime probe binding set/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
}
