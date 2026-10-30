// Source-preserving consolidation: original test cases remain in isolated lexical blocks.
import { describe, expect, it } from "vitest";
import type { DecisionLedgerSnapshot } from "../../../project-model/src/index.js";
import type { ValidationTraceReport } from "../../../validation/src/index.js";
import { buildEngineeringReviewInvalidationProjection } from "../../src/workflow/engineering-review-invalidation.js";
import { buildEngineeringReviewPriority } from "../../src/workflow/engineering-review-priority.js";
import { buildEngineeringReviewProjection } from "../../src/workflow/engineering-review-projection.js";
import type { EngineeringReviewSource } from "../../src/workflow/engineering-review-projection.js";

// Consolidated suite from engine/packages/orchestrator/test/workflow/engineering-review-invalidation.test.ts
{
describe("engineering review invalidation projection", () => {
  it("translates basis drift into a human-readable blocking action", () => {
    const ledger: DecisionLedgerSnapshot = {
      schemaVersion: 1,
      entries: [{
        id: "decision:repair",
        kind: "repair-authorization",
        status: "active",
        basis: {
          sourceFingerprint: "source-a",
          runtimeEvidenceRevision: "runtime-a",
        },
        upstreamDecisionIds: [],
        inputIds: [],
        outputIds: [],
        evidenceIds: [],
        createdSequence: 1,
      }],
    };

    const projection =
      buildEngineeringReviewInvalidationProjection(
        {
          sourceFingerprint: "source-b",
          runtimeEvidenceRevision: "runtime-a",
        },
        ledger,
      );

    expect(projection.invalidatedDecisionCount).toBe(1);
    expect(projection.items[0]).toMatchObject({
      category: "source-changed",
      nextAction: "reinspect-artifact",
      blocking: true,
      decisionId: "decision:repair",
    });
    expect(projection.items[0]?.reason).toMatch(
      /sourceFingerprint changed/,
    );
  });

  it("keeps superseded decisions non-blocking and points to the replacement", () => {
    const ledger: DecisionLedgerSnapshot = {
      schemaVersion: 1,
      entries: [
        {
          id: "old",
          kind: "diagnostic-candidate-selection",
          status: "superseded",
          basis: {},
          upstreamDecisionIds: [],
          inputIds: [],
          outputIds: [],
          evidenceIds: [],
          createdSequence: 1,
          supersededBy: "new",
        },
        {
          id: "new",
          kind: "diagnostic-candidate-selection",
          status: "active",
          basis: {},
          upstreamDecisionIds: [],
          inputIds: [],
          outputIds: [],
          evidenceIds: [],
          createdSequence: 2,
        },
      ],
    };

    const projection =
      buildEngineeringReviewInvalidationProjection(
        {},
        ledger,
      );

    expect(projection.supersededDecisionCount).toBe(1);
    expect(projection.blockingCount).toBe(0);
    expect(projection.items[0]).toMatchObject({
      category: "superseded",
      nextAction: "follow-replacement",
      blocking: false,
    });
    expect(projection.items[0]?.reason).toContain("new");
  });

  it("explains stale validation by cause without changing validation truth", () => {
    const trace: ValidationTraceReport = {
      runs: [{
        runId: "run:1",
        scenarioId: "scenario:1",
        scenarioRevision: "rev-1",
        intentInvariantIds: ["inv:1"],
        ok: true,
        proofLevel: "LIVE GAME VERIFIED",
        proofSufficient: true,
        current: false,
        staleReasons: [
          "artifact fingerprint changed since this validation run",
          "target runtime profile changed since this validation run",
        ],
        evidenceIds: ["ev:1"],
      }],
      invariants: [{
        invariantId: "inv:1",
        scenarioIds: ["scenario:1"],
        runIds: ["run:1"],
        currentPassingRunIds: [],
        current: false,
      }],
    };

    const projection =
      buildEngineeringReviewInvalidationProjection(
        {},
        undefined,
        trace,
      );

    expect(projection.staleValidationRunCount).toBe(1);
    expect(projection.items.map((item) => item.category)).toEqual([
      "validation-artifact-changed",
      "validation-runtime-changed",
    ]);
    expect(projection.blockingCount).toBe(2);
  });
});
}

// Consolidated suite from engine/packages/orchestrator/test/workflow/engineering-review-priority.test.ts
{
const emptyRuntime = {
  "confirmed-defect": 0,
  "design-review": 0,
  "designed-behavior": 0,
  "engine-constraint": 0,
  "compatibility-difference": 0,
  "insufficient-evidence": 0,
  "ambiguous-intent": 0,
  "runtime-proof-required": 0,
} as const;

describe("engineering review priority", () => {
  it("puts stale blocking proof above defects and diagnostics", () => {
    const priority = buildEngineeringReviewPriority({
      runtimeClassifications: {
        ...emptyRuntime,
        "confirmed-defect": 1,
        "design-review": 2,
      },
      diagnostics: [{
        id: "diag:1",
        code: "CROSS_SCOPE_STATE_RISK",
        severity: "critical",
        message: "critical",
      }],
      evidenceRecovery: {
        required: false,
        actions: [],
        blocksCurrentStateClaims: false,
        blocksTemporalClaims: false,
        blocksFullRepairAuthorization: false,
      },
      invalidation: {
        items: [{
          id: "validation:run:1:0",
          source: "validation",
          category: "validation-artifact-changed",
          summary: "Artifact changed.",
          reason: "artifact fingerprint changed since this validation run",
          nextAction: "rerun-validation",
          blocking: true,
          validationRunId: "run:1",
        }],
        invalidatedDecisionCount: 0,
        supersededDecisionCount: 0,
        staleValidationRunCount: 1,
        blockingCount: 1,
      },
      repairCandidates: [],
    });

    expect(priority.items.map((item) => item.lane)).toEqual([
      "blocking-proof",
      "confirmed-defect",
      "critical-diagnostic",
      "design-review",
    ]);
    expect(priority.hasBlockingProofGap).toBe(true);
  });

  it("does not treat critical diagnostics as confirmed defects", () => {
    const priority = buildEngineeringReviewPriority({
      runtimeClassifications: emptyRuntime,
      diagnostics: [{
        id: "diag:1",
        code: "CROSS_SCOPE_STATE_RISK",
        severity: "critical",
        message: "critical",
      }],
      evidenceRecovery: {
        required: false,
        actions: [],
        blocksCurrentStateClaims: false,
        blocksTemporalClaims: false,
        blocksFullRepairAuthorization: false,
      },
      invalidation: {
        items: [],
        invalidatedDecisionCount: 0,
        supersededDecisionCount: 0,
        staleValidationRunCount: 0,
        blockingCount: 0,
      },
      repairCandidates: [],
    });

    expect(priority.hasCriticalDiagnostic).toBe(true);
    expect(priority.hasConfirmedDefect).toBe(false);
    expect(priority.items.map((item) => item.kind)).toEqual([
      "critical-diagnostic",
    ]);
  });

  it("orders evidence recovery before probable defects and planned repairs", () => {
    const priority = buildEngineeringReviewPriority({
      runtimeClassifications: {
        ...emptyRuntime,
        "design-review": 1,
        "runtime-proof-required": 1,
      },
      diagnostics: [],
      evidenceRecovery: {
        required: true,
        actions: [{
          id: "recover:1",
          channel: "runtime-probe",
          kind: "rerun-runtime-probe-bundle",
          priority: "high",
          requiredContext: "LIVE_MINECRAFT",
          blocks: ["full-repair-authorization"],
          reason: "missing proof",
        }],
        blocksCurrentStateClaims: false,
        blocksTemporalClaims: true,
        blocksFullRepairAuthorization: true,
      },
      invalidation: {
        items: [],
        invalidatedDecisionCount: 0,
        supersededDecisionCount: 0,
        staleValidationRunCount: 0,
        blockingCount: 0,
      },
      repairCandidates: [{
        kind: "linear-topology-outlier",
        diagnosticCode: "TOPOLOGY_TRANSLATION_OUTLIER",
        sourcePath: "functions/test.mcfunction",
        status: "proposal",
      }],
    });

    expect(priority.items.map((item) => item.kind)).toEqual([
      "evidence-recovery",
      "runtime-proof-required",
      "design-review",
      "proposed-repair",
    ]);
  });
});
}

// Consolidated suite from engine/packages/orchestrator/test/workflow/engineering-review-projection.test.ts
{
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
}
