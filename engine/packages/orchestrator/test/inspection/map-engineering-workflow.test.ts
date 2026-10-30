import { describe, expect, it } from "vitest";
import {
  buildMapEngineeringWorkflow,
} from "../../src/inspection/map-engineering-workflow.js";

function baseSource() {
  return {
    artifactId: "map:test",
    fingerprint: "abc",
    targetCompatibility: {
      edition: "bedrock",
      educationFeatures: "unknown",
    },
    gameplayDiscoveryClosure: {
      status: "COMPLETE",
      discoveredSurfaceIds: ["phase:lobby"],
      sourceCoverageComplete: true,
      sourceParseFailures: 0,
      unresolvedReferences: 0,
      reasons: [],
    },
    gameplaySemantic: {
      gameplayClosure: {
        status: "CLOSED",
        surfaces: [],
        unaccountedSurfaceIds: [],
        blockingSurfaceIds: [],
        unknownSurfaceIds: [],
        stateModelComplete: true,
        boundariesExtracted: true,
        reasons: [],
      },
      intent: {
        unknowns: [],
      },
    },
    gameplayIntentRuntime: {
      routeInstrumentationRequired: 0,
      routeEvidenceBlocked: 0,
    },
    hiddenGameplayDefects: {
      attention: {
        implementationOnlyIntent: 0,
        incompleteMechanics: 0,
        negativeSpaceSignals: 0,
        highTemporalRisks: 0,
        designAnomalies: 0,
        silentDegradations: 0,
      },
    },
    evidenceRecovery: {
      actions: [],
    },
    repairCandidates: [],
    engineeringAnalyses: [],
    developerToolRelease: {
      exposures: [],
      unguardedEnabled: 0,
      highRisk: 0,
    },
    capabilityExposure: {
      exposures: [],
      exposed: 0,
      potentiallyExposed: 0,
      releaseBlocking: 0,
      unresolved: 0,
    },
    analysisPriorities: [],
    releaseIdentity: {
      status: "consistent",
      observations: [],
      conflicts: [],
    },
    diagnostics: [],
    unresolvedReferences: 0,
  } as any;
}

describe("map engineering workflow projection", () => {
  it("keeps the projection compact and actionable", () => {
    const workflow =
      buildMapEngineeringWorkflow(
        baseSource(),
      );

    expect(
      workflow.stages.map(
        (stage) => stage.id,
      ),
    ).toEqual([
      "understand",
      "diagnose",
      "release",
    ]);

    expect(workflow.attention).toEqual({
      criticalDiagnostics: 0,
      unresolvedReferences: 0,
      contractUnknowns: 0,
      gameplayDiscoveryClosure: "COMPLETE",
      gameplayClosure: "CLOSED",
      evidenceRecoveryActions: 0,
      repairProposals: 0,
      hiddenDefectRisks: 0,
      engineeringAnalyses: 0,
      capabilityExposureRisks: 0,
      highRiskSurfaces: 0,
    });
  });


  it("checks the six stage-gating conditions in one decision matrix", () => {
    const base = baseSource();
    const cases = [
      {
        label: "unresolved references",
        input: { ...base, unresolvedReferences: 2 },
        stages: { understand: "partial" },
        attention: { unresolvedReferences: 2 },
      },
      {
        label: "discovery closure OPEN",
        input: { ...base, gameplayDiscoveryClosure: {
          ...base.gameplayDiscoveryClosure, status: "OPEN",
          sourceCoverageComplete: false, sourceParseFailures: 1,
        } },
        stages: { understand: "blocked", release: "blocked" },
        attention: {},
      },
      {
        label: "gameplay model closure OPEN",
        input: { ...base, gameplaySemantic: {
          ...base.gameplaySemantic, gameplayClosure: {
            ...base.gameplaySemantic.gameplayClosure,
            status: "OPEN", unaccountedSurfaceIds: ["runtime:arena-capacity"],
            stateModelComplete: false,
          },
        } },
        stages: { understand: "blocked", release: "blocked" },
        attention: {},
      },
      {
        label: "hidden design anomaly",
        input: { ...base, hiddenGameplayDefects: { attention: {
          ...base.hiddenGameplayDefects.attention, designAnomalies: 1,
        } } },
        stages: { diagnose: "partial" },
        attention: { hiddenDefectRisks: 1 },
      },
      {
        label: "reachable sensitive capability",
        input: { ...base, capabilityExposure: {
          exposures: [{
            capabilityId: "capability:restricted-action",
            capabilityLabel: "Restricted Action", status: "exposed",
            prerequisiteReachability: "reachable", impact: "progression",
            reasons: [], evidenceIds: [],
          }],
          exposed: 1, potentiallyExposed: 0, releaseBlocking: 1, unresolved: 0,
        } },
        stages: { release: "blocked" },
        attention: { capabilityExposureRisks: 1 },
      },
      {
        label: "critical diagnostic",
        input: { ...base, diagnostics: [{
          id: "critical", code: "ARENA_VOXEL_DIVERGENCE",
          severity: "critical", message: "voxel divergence",
        }] },
        stages: { release: "blocked" },
        attention: {},
      },
    ] as const;

    const observed = cases.map(({ label, input, stages, attention }) => {
      const workflow = buildMapEngineeringWorkflow(input);
      return {
        label,
        stages: Object.keys(stages).map(id => [
          id, workflow.stages.find(stage => stage.id === id)?.status,
        ]),
        attention: Object.keys(attention).map(key => [
          key, workflow.attention[key as keyof typeof workflow.attention],
        ]),
      };
    });
    const expected = cases.map(({ label, stages, attention }) => ({
      label, stages: Object.entries(stages), attention: Object.entries(attention),
    }));
    expect(observed).toEqual(expected);
  });

});
