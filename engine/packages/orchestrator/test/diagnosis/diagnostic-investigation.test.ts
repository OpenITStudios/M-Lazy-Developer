import { describe, expect, it } from "vitest";
import type { CausalIncident } from "../../../project-model/src/index.js";
import type { DiagnosticProbeDefinition } from "../../../project-model/src/index.js";
import {
  applyDiagnosticProbeObservation,
  createDiagnosticInvestigation,
  investigationIncident,
} from "../../src/diagnosis/diagnostic-investigation.js";

const incident: CausalIncident = {
  id: "incident-1",
  scopeKey: "arena:1",
  severity: "critical",
  confidence: "medium",
  chainIds: [],
  relatedDiagnosticIds: [],
  nodes: [],
  links: [],
  rootCauseCandidates: ["chunk", "route", "state"].map((id) => ({
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
    observation: "chunk loaded",
    rejectsCandidateIds: ["chunk"],
  }, {
    id: "not-ready",
    observation: "chunk not loaded",
    supportsCandidateIds: ["chunk"],
    rejectsCandidateIds: ["route", "state"],
  }],
}];

describe("diagnostic investigation state", () => {
  it("rejects candidates explicitly ruled out by a probe outcome", () => {
    const state = applyDiagnosticProbeObservation(
      createDiagnosticInvestigation(incident),
      probes,
      { probeId: "chunk-readiness", outcomeId: "ready" },
    );
    expect(state.activeCandidateIds).toEqual(["route", "state"]);
    expect(state.rejectedCandidateIds).toEqual(["chunk"]);
  });

  it("keeps an explicitly supported candidate and removes rejected alternatives", () => {
    const state = applyDiagnosticProbeObservation(
      createDiagnosticInvestigation(incident),
      probes,
      { probeId: "chunk-readiness", outcomeId: "not-ready" },
    );
    expect(state.activeCandidateIds).toEqual(["chunk"]);
    expect(state.supportedCandidateIds).toEqual(["chunk"]);
    expect(investigationIncident(incident, state).rootCauseCandidates.map((x) => x.id))
      .toEqual(["chunk"]);
  });

  it("fails closed for unknown probes or outcomes", () => {
    expect(() => applyDiagnosticProbeObservation(
      createDiagnosticInvestigation(incident),
      probes,
      { probeId: "missing", outcomeId: "ready" },
    )).toThrow(/Unknown diagnostic probe/);
  });
});
