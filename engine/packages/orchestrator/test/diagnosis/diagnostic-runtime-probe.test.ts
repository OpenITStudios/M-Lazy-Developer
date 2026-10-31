import { describe, expect, it } from "vitest";
import type { CausalIncident } from "../../../project-model/src/index.js";
import type { DiagnosticProbeDefinition } from "../../../project-model/src/index.js";
import { createDiagnosticInvestigation } from "../../src/diagnosis/diagnostic-investigation.js";
import { applyRuntimeProbeResponse } from "../../src/diagnosis/diagnostic-runtime-probe.js";

const incident: CausalIncident = {
  id: "incident-1",
  scopeKey: "arena:1",
  severity: "critical",
  confidence: "medium",
  chainIds: [],
  relatedDiagnosticIds: [],
  nodes: [],
  links: [],
  rootCauseCandidates: ["chunk", "route"].map((id) => ({
    id,
    label: id,
    evidenceLevel: "unproven-candidate" as const,
    severity: "medium" as const,
    confidence: "low" as const,
    chainIds: [],
    relatedDiagnosticIds: [],
    support: {
      dependencyViolations: 0,
      evidenceGaps: 1,
      corroboratedRisks: 0,
      observedOutcomes: 0,
    },
  })),
};

const probes: DiagnosticProbeDefinition[] = [{
  id: "chunk-readiness",
  label: "chunk readiness",
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
}];

function issuedRequest(
  requestId: string,
  outcomeByState = {
    present: "ready",
    absent: "not-ready",
  },
) {
  return {
    schemaVersion: 1 as const,
    requestId,
    probeId: "chunk-readiness",
    predicate: "target-chunk-loaded",
    query: {
      kind: "chunk-loaded" as const,
      dimension: "overworld",
      location: { x: 0, y: 64, z: 0 },
    },
    outcomeByState,
  };
}

describe("runtime probe investigation adapter", () => {
  it("applies an explicitly mapped outcome to the investigation", () => {
    const result = applyRuntimeProbeResponse(
      createDiagnosticInvestigation(incident),
      probes,
      issuedRequest("req-1"),
      {
        schemaVersion: 1,
        requestId: "req-1",
        probeId: "chunk-readiness",
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
      },
    );

    expect(result.investigation.activeCandidateIds).toEqual(["route"]);
    expect(result.investigation.rejectedCandidateIds).toEqual(["chunk"]);
  });

  it("fails closed when no explicit outcome mapping is present", () => {
    expect(() => applyRuntimeProbeResponse(
      createDiagnosticInvestigation(incident),
      probes,
      issuedRequest("req-2"),
      {
        schemaVersion: 1,
        requestId: "req-2",
        probeId: "chunk-readiness",
        runtimeTick: 101,
        ok: true,
        state: "unknown",
        evidence: {
          predicate: "target-chunk-loaded",
          state: "unknown",
          confidence: "observed",
        },
      },
    )).toThrow(/no explicit bound outcome/);
  });

  it("rejects outcomes that do not belong to the declared probe", () => {
    expect(() => applyRuntimeProbeResponse(
      createDiagnosticInvestigation(incident),
      probes,
      issuedRequest("req-3", { present: "invented", absent: "not-ready" }),
      {
        schemaVersion: 1,
        requestId: "req-3",
        probeId: "chunk-readiness",
        runtimeTick: 102,
        ok: true,
        state: "present",
        outcomeId: "invented",
        evidence: {
          predicate: "target-chunk-loaded",
          state: "present",
          confidence: "observed",
        },
      },
    )).toThrow(/does not belong to probe/);
  });

  it("rejects a mismatched state-to-outcome response", () => {
    expect(() => applyRuntimeProbeResponse(
      createDiagnosticInvestigation(incident),
      probes,
      issuedRequest("req-4"),
      {
        schemaVersion: 1,
        requestId: "req-4",
        probeId: "chunk-readiness",
        runtimeTick: 103,
        ok: true,
        state: "present",
        outcomeId: "not-ready",
        evidence: {
          predicate: "target-chunk-loaded",
          state: "present",
          confidence: "observed",
        },
      },
    )).toThrow(/outcomeId does not match request outcome mapping/);
  });


  it("rejects a response for a different issued request", () => {
    expect(() => applyRuntimeProbeResponse(
      createDiagnosticInvestigation(incident),
      probes,
      issuedRequest("req-expected"),
      {
        schemaVersion: 1,
        requestId: "req-stale",
        probeId: "chunk-readiness",
        runtimeTick: 104,
        ok: true,
        state: "present",
        outcomeId: "ready",
        evidence: {
          predicate: "target-chunk-loaded",
          state: "present",
          confidence: "observed",
        },
      },
    )).toThrow(/requestId mismatch/);
  });

  it("rejects a response older than the issued probe", () => {
    const request = {
      ...issuedRequest("req-old"),
      runtimeTick: 200,
    };

    expect(() => applyRuntimeProbeResponse(
      createDiagnosticInvestigation(incident),
      probes,
      request,
      {
        schemaVersion: 1,
        requestId: "req-old",
        probeId: "chunk-readiness",
        runtimeTick: 199,
        ok: true,
        state: "present",
        outcomeId: "ready",
        evidence: {
          predicate: "target-chunk-loaded",
          state: "present",
          confidence: "observed",
        },
      },
    )).toThrow(/runtimeTick precedes request runtimeTick/);
  });

  it("rejects cross-scope evidence for a scoped probe request", () => {
    const request = {
      ...issuedRequest("req-scope"),
      runtimeTick: 200,
      scope: {
        arenaId: "arena-1",
        arenaGeneration: 7,
        operationId: "load-7",
      },
    };

    expect(() => applyRuntimeProbeResponse(
      createDiagnosticInvestigation(incident),
      probes,
      request,
      {
        schemaVersion: 1,
        requestId: "req-scope",
        probeId: "chunk-readiness",
        runtimeTick: 201,
        ok: true,
        state: "present",
        outcomeId: "ready",
        evidence: {
          predicate: "target-chunk-loaded",
          state: "present",
          confidence: "observed",
          scope: {
            arenaId: "arena-1",
            arenaGeneration: 8,
            operationId: "load-7",
          },
        },
      },
    )).toThrow(/evidence scope mismatch/);
  });

  it("accepts evidence that preserves the issued scope and adds narrower identity", () => {
    const request = {
      ...issuedRequest("req-narrow"),
      runtimeTick: 200,
      scope: {
        arenaId: "arena-1",
        arenaGeneration: 7,
      },
    };

    const result = applyRuntimeProbeResponse(
      createDiagnosticInvestigation(incident),
      probes,
      request,
      {
        schemaVersion: 1,
        requestId: "req-narrow",
        probeId: "chunk-readiness",
        runtimeTick: 201,
        ok: true,
        state: "present",
        outcomeId: "ready",
        evidence: {
          predicate: "target-chunk-loaded",
          state: "present",
          confidence: "observed",
          scope: {
            arenaId: "arena-1",
            arenaGeneration: 7,
            operationId: "chunk-check",
          },
        },
      },
    );

    expect(result.investigation.activeCandidateIds).toEqual(["route"]);
  });
});
