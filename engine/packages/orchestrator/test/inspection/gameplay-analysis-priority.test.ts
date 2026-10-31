// Small source-grounded discovery family; original test statements preserved.
import { describe, expect, it } from "vitest";
import { deriveGameplayAnalysisPriorities } from "../../src/inspection/gameplay-analysis-priority.js";
import { discoverGameplaySurfaces } from "../../src/inspection/gameplay-surface-discovery.js";
import type { InspectArtifactResult } from "../../src/inspect-artifact.js";
import { compareGameplayUnderstandingFingerprints, deriveGameplayUnderstandingFingerprint } from "../../src/inspection/gameplay-understanding-fingerprint.js";

// Original engine/packages/orchestrator/test/inspection/gameplay-analysis-priority.test.ts; source blob d4c8c1ade113c398980344ae3b0f19077ef29651
{
describe("gameplay analysis priority", () => {
  it("prioritizes high-criticality gameplay over a historical lower-impact lead", () => {
    const priorities = deriveGameplayAnalysisPriorities({
      gameplayClosure: { surfaces: [
        { id: "runtime:structures", status: "unknown" },
      ] },
      surfaceDiscovery: { surfaceIds: [
        "runtime:structures", "runtime:arena",
      ] },
      arenas: { detected: false },
      structures: { transitionResidueRisks: 1, transitionResidueUnresolved: 0 },
    } as any, { exposures: [], releaseBlocking: 0 } as any);
    expect(priorities.map(item => item.surfaceId)).toEqual([
      "runtime:arena", "runtime:structures",
    ]);
    expect(priorities[1]?.historyPressure).toBeGreaterThan(0);
  });


  it("promotes unguarded high-impact developer capability to its own deep priority", () => {
    const priorities = deriveGameplayAnalysisPriorities(
      {
        gameplayClosure: { surfaces: [] },
        surfaceDiscovery: { surfaceIds: [] },
        arenas: { detected: false },
      } as any,
      {
        exposures: [{
          capabilityId: "developer-tool:skip:level-skip",
          capabilityLabel: "skip level",
          status: "potentially-exposed",
          prerequisiteReachability: "unknown",
          impact: "progression",
          reasons: ["authorization missing"],
          evidenceIds: ["scripts/dev.js"],
        }],
        exposed: 0,
        potentiallyExposed: 1,
        releaseBlocking: 1,
        unresolved: 0,
      },
    );

    const capability = priorities.find(
      (item) =>
        item.surfaceId ===
        "capability:developer-tool:skip:level-skip",
    );

    expect(capability?.priority).toBe("high");
    expect(capability?.proofDepth).toBe("deep");
    expect(capability?.factors).toContain("permission");
  });
});
}

// Original engine/packages/orchestrator/test/inspection/gameplay-surface-discovery.test.ts; source blob c73e2fe60536b049142b39d02622d3d9db05bb2d
{
describe("gameplay surface discovery", () => {
  it("discovers runtime surfaces independently from closure accounting", () => {
    const result = discoverGameplaySurfaces({
      intentSubjectIds: ["phase:lobby"],
      arenaDetected: true,
      arenaCapacityEvidence: true,
      arenaLifecycleEvidence: true,
      arenaCleanupEvidence: false,
      arenaIsolationEvidence: true,
      arenaReplicaEvidence: true,
      stateEvidence: true,
      chunkEvidence: true,
      persistenceEvidence: false,
      economyEvidence: true,
      combatEvidence: true,
      inventoryEvidence: false,
      spatialEvidence: true,
      structureEvidence: true,
      entityEvidence: true,
      boundaryEvidence: true,
      teleportEvidence: true,
      uiFormEvidence: true,
      environmentEvidence: true,
      asyncCommandTransactionEvidence: true,
      dynamicCommandEvidence: true,
    });

    expect(result.surfaceIds).toEqual(
      expect.arrayContaining([
        "phase:lobby",
        "runtime:arena",
        "runtime:arena-capacity",
        "runtime:arena-lifecycle",
        "runtime:arena-isolation",
        "runtime:arena-replica-integrity",
        "runtime:state",
        "runtime:chunks",
        "runtime:economy",
        "runtime:combat",
        "runtime:spatial",
        "runtime:structures",
        "runtime:entities",
        "runtime:boundaries",
        "runtime:teleport",
        "runtime:ui-form",
        "runtime:environment",
        "runtime:async-command-transaction",
        "runtime:dynamic-command",
      ]),
    );
  });
});
}

// Original engine/packages/orchestrator/test/inspection/gameplay-understanding-fingerprint.test.ts; source blob 9f5a76e5f81a8c831693331cea46fcf7aab9fcbf
{
function result(): InspectArtifactResult {
  return {
    files: 10,
    scripts: 2,
    functions: 3,
    entities: 1,
    routeAnalysis: {
      contracts: 2,
      explicitContracts: 0,
      derivedContracts: 2,
      effectiveContracts: 2,
      overlaps: 0,
      dimensionUnresolved: 0,
    },
    gameplayIntent: {
      authoredSourceFiles: 1,
      nodes: 4,
      authoredNodes: 3,
      inferredNodes: 1,
      hypothesisNodes: 0,
      invariants: 1,
      unknowns: 0,
      model: {
        schemaVersion: 1,
        id: "intent:test",
        evidence: [
          {
            id: "e:1",
            origin: "source-code",
            locator: "scripts/main.ts",
            summary: "state",
          },
          {
            id: "e:2",
            origin: "runtime-observation",
            locator: "runtime",
            summary: "route",
          },
        ],
        nodes: [
          {
            id: "state:active",
            kind: "state",
            label: "Active",
            status: "authored",
            evidenceIds: ["e:1"],
          },
          {
            id: "lifecycle:cleanup",
            kind: "lifecycle",
            label: "Cleanup",
            status: "authored",
            evidenceIds: ["e:1"],
          },
          {
            id: "policy:cleanup",
            kind: "policy",
            label: "Cleanup policy",
            status: "authored",
            evidenceIds: ["e:1"],
            policyPredicate: {
              kind: "unknown",
              text: "minified guard",
            },
          },
          {
            id: "spatial-region:route-main",
            kind: "spatial-region",
            label: "Main",
            status: "inferred",
            evidenceIds: ["e:2"],
            spatialProfile: {
              coordinateSpace: "local",
              routeId: "main",
              points: [
                { x: 0, y: 0, z: 0, index: 0 },
                { x: 1, y: 0, z: 0, index: 1 },
              ],
              transform: {
                kind: "offset",
                offsetPath: "gameplayOffset",
                functionName: "offset",
              },
              contextSeries: {
                collectionName: "arenas",
                contextCount: 2,
                offsetPath: "gameplayOffset",
                offsetBase: { x: 0, y: 0, z: 0 },
                offsetStride: { x: 100, y: 0, z: 0 },
              },
            },
          },
        ],
        edges: [
          {
            id: "edge:cleanup-policy",
            from: "lifecycle:cleanup",
            to: "policy:cleanup",
            kind: "requires",
            status: "authored",
            evidenceIds: ["e:1"],
          },
        ],
        invariants: [
          {
            id: "inv:cleanup",
            statement: "Cleanup requires policy.",
            strength: "must",
            status: "authored",
            subjectIds: ["lifecycle:cleanup"],
            evidenceIds: ["e:1"],
          },
        ],
        unknowns: [],
      },
    },
  } as unknown as InspectArtifactResult;
}

describe("gameplay understanding fingerprint", () => {
  it("normalizes semantic coverage without preserving map-specific names", () => {
    const fingerprint =
      deriveGameplayUnderstandingFingerprint(result());

    expect(fingerprint).toEqual(expect.objectContaining({
      schemaVersion: 1,
      sourceShape: {
        files: 10,
        scripts: 2,
        authoredSourceFiles: 1,
        entities: 1,
        functions: 3,
      },
      totals: {
        nodes: 4,
        edges: 1,
        invariants: 1,
        unknowns: 0,
      },
      spatial: expect.objectContaining({
        routeProfiles: 1,
        routePoints: 2,
        derivedRouteContracts: 2,
        effectiveRouteContracts: 2,
        localProfiles: 1,
        contextSeries: 1,
      }),
      epistemic: {
        authoredRatio: 0.75,
        inferredRatio: 0.25,
        hypothesisRatio: 0,
        unknownsPerNode: 0,
      },
    }));
    expect(fingerprint.policy.unknownPredicates).toBe(1);
    expect(fingerprint.nodeKinds.state).toBe(1);
    expect(fingerprint.nodeKinds.lifecycle).toBe(1);
    expect(fingerprint.evidenceOrigins).toEqual({
      "runtime-observation": 1,
      "source-code": 1,
    });
  });

  it("surfaces understanding regressions without turning them into semantic policy", () => {
    const baseline =
      deriveGameplayUnderstandingFingerprint(result());
    const current = {
      ...baseline,
      totals: {
        ...baseline.totals,
        nodes: 3,
        unknowns: 1,
      },
      nodeStatuses: {
        ...baseline.nodeStatuses,
        authored: 2,
      },
      nodeKinds: {
        ...baseline.nodeKinds,
        lifecycle: 0,
      },
      spatial: {
        ...baseline.spatial,
        routeProfiles: 0,
        routePoints: 0,
      },
    };

    const drift =
      compareGameplayUnderstandingFingerprints(
        baseline,
        current,
      );

    expect(drift.regressionSignals).toEqual(
      expect.arrayContaining([
        "unknown-intent-count-increased",
        "authored-intent-count-decreased",
        "authored-route-profile-count-decreased",
        "authored-route-point-count-decreased",
        "intent-kind-coverage-lost",
      ]),
    );
    expect(drift.lostKinds).toContain("lifecycle");
  });
});
}
