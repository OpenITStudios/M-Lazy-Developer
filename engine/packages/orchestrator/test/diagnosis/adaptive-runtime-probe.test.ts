import {
  describe,
  expect,
  it,
} from "vitest";
import {
  prepareAdaptiveRuntimeProbeBundle,
  type AdaptiveRuntimeProbeInspection,
} from "../../src/diagnosis/adaptive-runtime-probe.js";

describe("adaptive runtime probe bundle", () => {
  it("spends a global budget on the highest-value probes first", () => {
    const inspection:
      AdaptiveRuntimeProbeInspection = {
      causalAnalysis: {
        incidents: [{
          id: "incident:a",
          scopeKey: "a",
          severity: "medium",
          confidence: "medium",
          chainIds: [],
          relatedDiagnosticIds: [],
          nodes: [],
          links: [],
          rootCauseCandidates: [{
            id: "candidate:a1",
            label: "A1",
            evidenceLevel:
              "unproven-candidate",
            severity: "medium",
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
            id: "candidate:a2",
            label: "A2",
            evidenceLevel:
              "unproven-candidate",
            severity: "medium",
            confidence: "medium",
            chainIds: [],
            relatedDiagnosticIds: [],
            support: {
              dependencyViolations: 0,
              evidenceGaps: 1,
              corroboratedRisks: 0,
              observedOutcomes: 0,
            },
          }],
        }],
      },
      diagnosticProbeAnalysis: {
        incidents: [{
          incidentId: "incident:a",
          definitions: [{
            id: "probe:cheap",
            label: "cheap",
            requiredContext:
              "LIVE_MINECRAFT",
            costUnits: 1,
            mutationRisk:
              "read-only",
            outcomes: [{
              id: "present",
              observation: "yes",
              supportsCandidateIds: [
                "candidate:a1",
              ],
              rejectsCandidateIds: [
                "candidate:a2",
              ],
            }],
          }, {
            id: "probe:expensive",
            label: "expensive",
            requiredContext:
              "LIVE_MINECRAFT",
            costUnits: 10,
            mutationRisk:
              "read-only",
            outcomes: [{
              id: "present",
              observation: "yes",
              supportsCandidateIds: [
                "candidate:a1",
              ],
              rejectsCandidateIds: [
                "candidate:a2",
              ],
            }],
          }],
        }],
      },
    };

    const result =
      prepareAdaptiveRuntimeProbeBundle(
        inspection,
        {
          availableContext:
            "LIVE_MINECRAFT",
          bindings: [{
            probeId:
              "probe:cheap",
            predicate: "p",
            query: {
              kind:
                "scoreboard-value",
              objectiveId: "o",
              participant: "#p",
            },
            outcomeByState: {
              present: "present",
              absent: "present",
            },
          }, {
            probeId:
              "probe:expensive",
            predicate: "p",
            query: {
              kind:
                "scoreboard-value",
              objectiveId: "o",
              participant: "#p",
            },
            outcomeByState: {
              present: "present",
              absent: "present",
            },
          }],
          budget: {
            maxRequests: 1,
            maxCostUnits: 2,
          },
        },
      );

    expect(result.usedRequests)
      .toBe(1);
    expect(
      result.selected[0]?.probeId,
    ).toBe("probe:cheap");
    expect(
      result.bundle.requests,
    ).toHaveLength(1);
  });

  it("selects only one next-best probe per incident before re-planning", () => {
    const inspection:
      AdaptiveRuntimeProbeInspection = {
      causalAnalysis: {
        incidents: [{
          id: "incident:progressive",
          scopeKey: "p",
          severity: "medium",
          confidence: "medium",
          chainIds: [],
          relatedDiagnosticIds: [],
          nodes: [],
          links: [],
          rootCauseCandidates: [{
            id: "candidate:p1",
            label: "P1",
            evidenceLevel:
              "unproven-candidate",
            severity: "medium",
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
            id: "candidate:p2",
            label: "P2",
            evidenceLevel:
              "unproven-candidate",
            severity: "medium",
            confidence: "medium",
            chainIds: [],
            relatedDiagnosticIds: [],
            support: {
              dependencyViolations: 0,
              evidenceGaps: 1,
              corroboratedRisks: 0,
              observedOutcomes: 0,
            },
          }],
        }],
      },
      diagnosticProbeAnalysis: {
        incidents: [{
          incidentId:
            "incident:progressive",
          definitions: [{
            id: "probe:first",
            label: "first",
            requiredContext:
              "LIVE_MINECRAFT",
            costUnits: 1,
            mutationRisk:
              "read-only",
            outcomes: [{
              id: "present",
              observation: "yes",
              supportsCandidateIds: [
                "candidate:p1",
              ],
              rejectsCandidateIds: [
                "candidate:p2",
              ],
            }],
          }, {
            id: "probe:second",
            label: "second",
            requiredContext:
              "LIVE_MINECRAFT",
            costUnits: 2,
            mutationRisk:
              "read-only",
            outcomes: [{
              id: "present",
              observation: "yes",
              supportsCandidateIds: [
                "candidate:p1",
              ],
              rejectsCandidateIds: [
                "candidate:p2",
              ],
            }],
          }],
        }],
      },
    };

    const bindings = [
      "probe:first",
      "probe:second",
    ].map((probeId) => ({
      probeId,
      predicate: "p",
      query: {
        kind:
          "scoreboard-value" as const,
        objectiveId: "o",
        participant: "#p",
      },
      outcomeByState: {
        present: "present",
        absent: "present",
      },
    }));

    const result =
      prepareAdaptiveRuntimeProbeBundle(
        inspection,
        {
          availableContext:
            "LIVE_MINECRAFT",
          bindings,
          budget: {
            maxRequests: 2,
            maxCostUnits: 10,
          },
        },
      );

    expect(result.selected)
      .toHaveLength(1);
    expect(
      result.skipped.some(
        (item) =>
          item.reason ===
          "awaiting-replan",
      ),
    ).toBe(true);
  });

  it("reports missing runtime bindings as compile-blocked rather than lower-value", () => {
    const inspection:
      AdaptiveRuntimeProbeInspection = {
      causalAnalysis: {
        incidents: [{
          id: "incident:b",
          scopeKey: "b",
          severity: "medium",
          confidence: "medium",
          chainIds: [],
          relatedDiagnosticIds: [],
          nodes: [],
          links: [],
          rootCauseCandidates: [{
            id: "candidate:b1",
            label: "B1",
            evidenceLevel:
              "unproven-candidate",
            severity: "medium",
            confidence: "medium",
            chainIds: [],
            relatedDiagnosticIds: [],
            support: {
              dependencyViolations: 0,
              evidenceGaps: 1,
              corroboratedRisks: 0,
              observedOutcomes: 0,
            },
          }],
        }],
      },
      diagnosticProbeAnalysis: {
        incidents: [{
          incidentId: "incident:b",
          definitions: [{
            id: "probe:missing-binding",
            label: "missing",
            requiredContext:
              "LIVE_MINECRAFT",
            costUnits: 1,
            mutationRisk:
              "read-only",
            outcomes: [{
              id: "present",
              observation: "present",
              supportsCandidateIds: [
                "candidate:b1",
              ],
            }],
          }],
        }],
      },
    };

    const result =
      prepareAdaptiveRuntimeProbeBundle(
        inspection,
        {
          availableContext:
            "LIVE_MINECRAFT",
          bindings: [],
          budget: {
            maxRequests: 1,
            maxCostUnits: 2,
          },
        },
      );

    expect(
      result.skipped[0]?.reason,
    ).toBe("compile-blocked");
    expect(result.issues)
      .not.toHaveLength(0);
  });

  it("returns an empty valid bundle when budget is zero", () => {
    const result =
      prepareAdaptiveRuntimeProbeBundle(
        {
          causalAnalysis: {
            incidents: [],
          },
          diagnosticProbeAnalysis: {
            incidents: [],
          },
        },
        {
          availableContext:
            "LIVE_MINECRAFT",
          bindings: [],
          budget: {
            maxRequests: 0,
            maxCostUnits: 0,
          },
        },
      );

    expect(result.bundle.requests)
      .toEqual([]);
    expect(result.usedCostUnits)
      .toBe(0);
  });
});
