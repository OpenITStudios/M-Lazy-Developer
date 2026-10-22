import { describe, expect, it } from "vitest";
import { deriveGameplayWorldModel } from "../../src/inspection/gameplay-world-model.js";
import { compileGameplayScenarioGraph } from "../../src/inspection/gameplay-scenario-compiler.js";

describe("gameplay world model", () => {
  it("summarizes gameplay and arena subsystems without copying raw evidence", () => {
    const source: Parameters<typeof deriveGameplayWorldModel>[0] = {
      artifactId: "map:test",
      intent: {
        schemaVersion: 1,
        id: "intent:test",
        evidence: [],
        nodes: [
          {
            id: "objective:flag",
            kind: "objective",
            label: "Flag",
            status: "authored",
            evidenceIds: [],
          },
          {
            id: "phase:active",
            kind: "phase",
            label: "Active",
            status: "inferred",
            evidenceIds: [],
          },
        ],
        edges: [],
        invariants: [{
          id: "inv:start",
          statement: "Start only when ready",
          strength: "must",
          status: "authored",
          subjectIds: ["phase:active"],
          evidenceIds: [],
        }],
        unknowns: [],
      },
      arena: {
        autoDetected: true,
        spatialLayout: {
          basis: "topology",
          replicas: [{}, {}],
        },
        lifecycle: {
          terminalCandidates: 2,
          multiIngressTerminalTargets: 0,
          terminalIngresses: [],
          terminalRaces: [],
          protectedTerminalRaces: 0,
          provenTerminalRaces: 0,
          unresolvedTerminalRaces: 0,
          terminalPrecedenceProven: 0,
          terminalPrecedenceUnresolved: 0,
          protectedDeferredMutations: 0,
          unresolvedDeferredMutations: 0,
          staleReadySnapshotRisks: 0,
          readySetSnapshotRisks: [],
          deferredMutations: [],
          proven: 1,
          partial: 1,
          unresolved: 0,
          assessments: [],
        },
      },
      scriptSpatial: {
        resolvedEffects: [],
        resolvedEffectSources: [],
        structurePlacements: [],
        failures: [],
        extractedMutations: 0,
        rejectedMutations: 0,
      },
      semanticIr: {
        stateSurfaces: 3,
        stateOperations: 8,
      },
      broadWrites: 1,
      structures: {
        definitions: 2,
        loads: 3,
        unresolvedLoads: 0,
        placements: 3,
        runtimeLogicLoads: 1,
      },
      entities: {
        definitions: 4,
        knowledgePrerequisiteGaps: 0,
        staticAnalysisLimits: 1,
      },
      unsupportedSurfaceSignals: {
        teleport: true,
        uiForm: true,
        environment: true,
        asyncCommandTransaction: true,
        dynamicCommand: true,
      },
    };
    const result = deriveGameplayWorldModel(source);

    expect(result.arenas.count).toBe(3);

    const scopedCapability = deriveGameplayWorldModel({
      ...source,
      capabilityExposure: {
        exposed: 0, potentiallyExposed: 0, releaseBlocking: 0, unresolved: 0,
        exposures: [
          {
            capabilityId: "capability:missing-trigger",
            capabilityLabel: "Unknown entry",
            status: "blocked",
            resolutionBasis: "trigger-absent",
            prerequisiteReachability: "unknown",
            impact: "state",
            evidenceIds: ["source:missing-entry"],
            reasons: ["No trigger path seen"],
          },
          {
            capabilityId: "capability:guarded",
            capabilityLabel: "Guarded entry",
            status: "guarded",
            resolutionBasis: "active-authorization-guard",
            prerequisiteReachability: "reachable",
            impact: "progression",
            evidenceIds: ["source:activated-guard"],
            reasons: ["Active guard verified by source owner"],
          },
        ],
      },
    });
    expect(scopedCapability.capabilityExposure.exposures.map((item) => [
      item.capabilityId, item.resolutionBasis,
    ])).toEqual([
      ["capability:missing-trigger", "trigger-absent"],
      ["capability:guarded", "active-authorization-guard"],
    ]);

    // Reuse the real scenario compiler to verify exact source-scope selection:
    // the same basename in another pack is not the selected guard's owner.
    const scenarioSource: Parameters<typeof deriveGameplayWorldModel>[0] = {
      ...source,
      intent: {
        schemaVersion: 1,
        id: "intent:capability-scope",
        evidence: [{
          id: "source:owner",
          origin: "source-code",
          scope: "selected-artifact",
          locator: "behavior_packs/a/scripts/policy.js:10:2",
          summary: "Exact selected policy source",
        }],
        nodes: [{
          id: "policy:guarded-capability",
          kind: "policy",
          label: "Capability restriction",
          status: "authored",
          evidenceIds: ["source:owner"],
        }],
        edges: [],
        invariants: [],
        unknowns: [],
      },
      capabilityExposure: {
        exposed: 1, potentiallyExposed: 0, releaseBlocking: 0, unresolved: 0,
        exposures: [
          {
            capabilityId: "capability:exposed",
            capabilityLabel: "Exposure discovered",
            status: "exposed",
            prerequisiteReachability: "reachable",
            impact: "state",
            evidenceIds: ["behavior_packs/a/scripts/policy.js"],
            reasons: [],
          },
          {
            capabilityId: "capability:selected",
            capabilityLabel: "Selected guard",
            status: "guarded",
            resolutionBasis: "active-authorization-guard",
            prerequisiteReachability: "reachable",
            impact: "state",
            evidenceIds: ["behavior_packs/a/scripts/policy.js"],
            reasons: [],
          },
          {
            capabilityId: "capability:foreign",
            capabilityLabel: "Foreign guard",
            status: "guarded",
            resolutionBasis: "active-authorization-guard",
            prerequisiteReachability: "reachable",
            impact: "state",
            evidenceIds: ["behavior_packs/b/scripts/policy.js"],
            reasons: [],
          },
          {
            capabilityId: "capability:missing-trigger",
            capabilityLabel: "No trigger",
            status: "blocked",
            resolutionBasis: "trigger-absent",
            prerequisiteReachability: "unknown",
            impact: "state",
            evidenceIds: ["behavior_packs/a/scripts/policy.js"],
            reasons: [],
          },
        ],
      },
    };
    const preset: Parameters<typeof compileGameplayScenarioGraph>[0]["preset"] = {
      schemaVersion: 1,
      policy: "selected-map-scenario-audit",
      scenarios: [{
        id: "capability-scope",
        kind: "player-capability-integrity",
        flowStage: "ACTIVE_GAMEPLAY",
        proofMode: "static-first",
        reason: "Inspect capability guard ownership",
        questions: [],
        requiredKnowledgeDomains: ["platform-constraints"],
      }],
    };
    const scopeGraph = compileGameplayScenarioGraph({
      intent: scenarioSource.intent,
      world: deriveGameplayWorldModel(scenarioSource),
      preset,
    });
    const capabilityLink = scopeGraph.causalLinks.find((link) =>
      link.scenarioId === "preset:capability-scope" &&
      link.fromComponentId === "runtime:player-capability");
    expect(capabilityLink).toBeDefined();
    expect(capabilityLink?.dimensionEvidence.capability)
      .toEqual(["behavior_packs/a/scripts/policy.js"]);

    const capacityEvidence = {
      requestedConcurrentArenas: 6,
      arenaCountConflict: false,
      commandTickingAreaAdds: 0,
      completeCommandTickingAreaFamilies: 0,
      unmatchedCommandTickingAreaAdds: 0,
      commandTickingAreaResourceResolved: false,
      scriptTickingAreaManagerReferenced: false,
      scriptCapacitySignals: [],
      scriptTickingAreaCapacityResolved: false,
      conflictingPlayerCapacityValues: [],
      reasons: [],
    };
    const requestedOnly = deriveGameplayWorldModel({
      ...source,
      arena: {
        autoDetected: true,
        capacity: { resources: [], evidence: capacityEvidence },
      },
    });
    expect(requestedOnly.arenas.count).toBeUndefined();
    expect(requestedOnly.arenas.requestedConcurrentArenas).toBe(6);
    expect(requestedOnly.gameplayClosure.unknownSurfaceIds).toContain("runtime:arena");
    const unresolvedCapacity = deriveGameplayWorldModel({
      ...source,
      arena: {
        autoDetected: true,
        capacity: {
          resources: [],
          evidence: { ...capacityEvidence, unresolvedRosterCapacityPaths: 2 },
        },
      },
    });
    expect(unresolvedCapacity.arenas.unresolvedRosterCapacityPaths).toBe(2);
    expect(unresolvedCapacity.arenas.perArenaPlayerCapacity).toBeUndefined();
    expect(requestedOnly.gameplayClosure.unknownSurfaceIds).toContain("runtime:arena-capacity");

    const withDiscoveredCount = deriveGameplayWorldModel({
      ...source,
      arena: {
        autoDetected: true,
        capacity: {
          resources: [],
          evidence: { ...capacityEvidence, discoveredArenaCount: 4 },
        },
      },
    });
    expect(withDiscoveredCount.arenas.count).toBe(4);
    expect(withDiscoveredCount.arenas.requestedConcurrentArenas).toBe(6);
    expect(result.subjects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "objective",
          authored: 1,
        }),
      ]),
    );
    expect(result.state.broadWrites).toBe(1);
    expect(result.gameplayClosure.status).toBe("OPEN");
    expect(
      result.gameplayClosure.surfaces.map(
        (surface) => surface.id,
      ),
    ).toContain("runtime:arena-capacity");
    expect(
      result.gameplayClosure.unknownSurfaceIds,
    ).toEqual(
      expect.arrayContaining([
        "runtime:teleport",
        "runtime:ui-form",
        "runtime:environment",
        "runtime:async-command-transaction",
        "runtime:dynamic-command",
      ]),
    );
  });
});
