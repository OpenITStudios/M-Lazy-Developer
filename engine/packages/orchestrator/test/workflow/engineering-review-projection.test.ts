import { describe, expect, it } from "vitest";
import {
  buildEngineeringReviewProjection,
  type EngineeringReviewSource,
} from "../../src/workflow/engineering-review-projection.js";

function sourceFixture(): EngineeringReviewSource {
  return {
    artifactId: "art_demo",
    fingerprint: "f".repeat(64),
    archiveEntries: 12,
    targetCompatibility: {
      edition: "education",
      version: "1.26.40",
      educationFeatures: "enabled",
    },
    gameplayIntent: {
      model: {
        schemaVersion: 1,
        id: "intent:demo",
        artifactId: "art_demo",
        evidence: [],
        nodes: [],
        edges: [],
        invariants: [],
        unknowns: [{
          id: "unknown:1",
          question: "Whether reconnect should resume or reset the active round.",
          blockedSubjectIds: ["session"],
        }],
      },
      contractSourceFiles: 1,
      nodes: 4,
      authoredNodes: 2,
      inferredNodes: 2,
      hypothesisNodes: 0,
      invariants: 1,
      unknowns: 1,
    },
    gameplayIntentRuntime: {
      assessments: [
        {
          outcomeObservation: { outcomeId: "outcome:session", evidenceId: "obs:1" },
          observationNeeds: [],
          result: {
            disposition: "design-review",
            subjectIds: ["session"],
            basisInvariantIds: ["inv:1"],
            evidenceIds: ["ev:1"],
            nextEvidenceNeed: "intent-grounding",
            reasons: ["Observed evidence contradicts inferred intent."],
          },
        },
        {
          outcomeObservation: { outcomeId: "outcome:scheduler", evidenceId: "obs:2" },
          observationNeeds: [],
          result: {
            disposition: "runtime-proof-required",
            subjectIds: ["scheduler"],
            basisInvariantIds: [],
            evidenceIds: ["ev:2"],
            nextEvidenceNeed: "runtime-proof",
            reasons: ["Runtime proof is required."],
          },
        },
      ],
      routeAssessments: [],
      routeStallAssessments: [],
      designedBehavior: 0,
      confirmedDefects: 0,
      ambiguousIntent: 0,
      insufficientEvidence: 0,
      runtimeStateObservations: 0,
      runtimeOutcomeObservations: 2,
      runtimeRouteObservations: 0,
      routeResolved: 0,
      routeAmbiguous: 0,
      routeUnresolved: 0,
      runtimeNavigationStallObservations: 0,
      runtimeNavigationTargetObservations: 0,
      runtimeRouteReachabilityObservations: 0,
      runtimeRouteChunkAvailabilityObservations: 0,
      routeEvidenceSatisfied: 0,
      routeInstrumentationRequired: 0,
      routeProbeRequests: 0,
      routeEvidenceBlocked: 0,
      stallTargetNearestMatch: 0,
      stallTargetNearestDivergence: 0,
      stallAmbiguous: 0,
      stallUnresolved: 0,
      stallRouteContextIncomplete: 0,
      stallTargetAssignmentDivergence: 0,
      stallRouteChunkUnavailable: 0,
      stallRouteUnreachable: 0,
      stallNavigationTargetDivergence: 0,
      stallNavigationRuntimeSuspect: 0,
      stallEvidenceIncomplete: 0,
      stallEntityAiStackIncomplete: 0,
      routeSupportedCandidates: 0,
      routeUnresolvedCandidates: 0,
      routeCauseSupportedStops: 0,
      navigationRuntimeCandidateIsolatedStops: 0,
      routeEvidenceCollectionContinuingStops: 0,
    },
    causalAnalysis: {
      chains: [],
      highConfidence: 0,
      mediumConfidence: 1,
      lowConfidence: 0,
      projectedRisks: 0,
      corroboratedRisks: 0,
      observedOutcomes: 1,
      incidents: [{
        id: "incident:1",
        scopeKey: "arena:A",
        severity: "medium",
        confidence: "medium",
        chainIds: ["chain:1"],
        relatedDiagnosticIds: ["diag:1"],
        nodes: [],
        links: [],
        rootCauseCandidates: [{
          id: "root:1",
          label: "Session cleanup ordering",
          evidenceLevel: "corroborated-candidate",
          severity: "medium",
          confidence: "medium",
          chainIds: ["chain:1"],
          relatedDiagnosticIds: ["diag:1"],
          support: {
            dependencyViolations: 0,
            evidenceGaps: 1,
            corroboratedRisks: 1,
            observedOutcomes: 1,
          },
        }],
      }],
      rootCauseCandidates: 1,
    },
    evidenceRecovery: {
      required: true,
      actions: [{
        id: "recover:1",
        channel: "runtime-probe",
        kind: "rerun-runtime-probe-bundle",
        priority: "medium",
        requiredContext: "LIVE_MINECRAFT",
        blocks: ["full-repair-authorization"],
        reason: "Probe exchange was incomplete.",
      }],
      blocksCurrentStateClaims: false,
      blocksTemporalClaims: true,
      blocksFullRepairAuthorization: true,
    },
    repairCandidates: [{
      kind: "linear-topology-outlier",
      diagnosticCode: "TOPOLOGY_TRANSLATION_OUTLIER",
      sourcePath: "functions/a.mcfunction",
      status: "proposal",
    }],
    diagnostics: [{
      id: "diag:1",
      code: "CROSS_SCOPE_STATE_RISK",
      severity: "critical",
      message: "Cross-scope mutation is not isolated.",
      relatedNodeIds: ["session"],
    }],
    decisionBasis: {} as never,
  };
}

describe("engineering review projection", () => {
  it("projects canonical inspection truth without promoting probable defects", () => {
    const review = buildEngineeringReviewProjection(sourceFixture());

    expect(review.schemaVersion).toBe(1);
    expect(review.artifact.id).toBe("art_demo");
    expect(review.understanding.unknowns).toHaveLength(1);
    expect(review.runtimeClassifications["design-review"]).toBe(1);
    expect(review.runtimeClassifications["confirmed-defect"]).toBe(0);
    expect(review.runtimeClassifications["runtime-proof-required"]).toBe(1);
    expect(review.runtimeAssessments).toEqual([
      {
        id: "runtime:outcome:session:obs:1",
        outcomeId: "outcome:session",
        disposition: "design-review",
        subjectIds: ["session"],
        basisInvariantIds: ["inv:1"],
        evidenceIds: ["ev:1"],
        nextEvidenceNeed: "intent-grounding",
        reasons: ["Observed evidence contradicts inferred intent."],
      },
      {
        id: "runtime:outcome:scheduler:obs:2",
        outcomeId: "outcome:scheduler",
        disposition: "runtime-proof-required",
        subjectIds: ["scheduler"],
        basisInvariantIds: [],
        evidenceIds: ["ev:2"],
        nextEvidenceNeed: "runtime-proof",
        reasons: ["Runtime proof is required."],
      },
    ]);
    expect(review.incidents[0]?.rootCauseCandidates[0]?.label).toBe(
      "Session cleanup ordering",
    );
    expect(review.attention.map((item) => item.kind)).toEqual([
      "critical-diagnostic",
      "design-review",
      "runtime-proof-required",
      "evidence-recovery",
      "proposed-repair",
    ]);
    expect(review.priority.items.map((item) => item.kind)).toEqual([
      "critical-diagnostic",
      "evidence-recovery",
      "runtime-proof-required",
      "design-review",
      "proposed-repair",
    ]);
    expect(review.priority.hasCriticalDiagnostic).toBe(true);
    expect(review.priority.hasConfirmedDefect).toBe(false);
  });

  it("keeps repair planning distinct from verification", () => {
    const review = buildEngineeringReviewProjection(sourceFixture());

    expect(review.repairCandidates).toEqual([
      {
        kind: "linear-topology-outlier",
        diagnosticCode: "TOPOLOGY_TRANSLATION_OUTLIER",
        sourcePath: "functions/a.mcfunction",
        status: "proposal",
      },
    ]);
    expect(
      review.attention.find((item) => item.kind === "proposed-repair")?.reason,
    ).toContain("not authorized, applied, or verified");
  });
});
