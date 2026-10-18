import { describe, expect, it } from "vitest";
import {
  deriveAuditObligations,
} from "../src/map-audit-obligations.js";
import {
  projectNeedValidationAuditIssues,
} from "../src/map-audit-validation-projection.js";

function baseGraph(status: string) {
  return {
    schemaVersion: 1,
    policy: "scenario-driven-causal-audit",
    scenarios: [{
      id: "scenario:wave",
      label: "wave",
      gameplayStage: "PROGRESSION",
      purpose: "Complete the wave.",
      sourceSubjectIds: ["objective:wave"],
      componentIds: ["runtime:entities"],
      causalLinkIds: ["link:wave"],
      playerCounts: [1],
      requiredKnowledgeIds: [],
      composedScenarioIds: [],
    }],
    components: [{
      id: "runtime:entities",
      label: "Entities",
      kind: "runtime-domain",
      technicalRole: "entity runtime",
      gameplayPurpose: "Drive wave progression.",
      evidenceIds: ["e:entity"],
      usedByScenarioIds: ["scenario:wave"],
      orphan: false,
    }],
    causalLinks: [{
      id: "link:wave",
      scenarioId: "scenario:wave",
      fromComponentId: "runtime:entities",
      toComponentId: "objective:wave",
      purpose: "Enemy remains accounted until completion.",
      evidenceIds: ["e:entity"],
      subjectIds: ["objective:wave"],
      componentIds: ["runtime:entities"],
      status,
      knowledgeRequirementIds: [],
      impactPathComponentIds: [],
      impactPathEvidenceIds: [],
      dimensionEvidence: {},
      reason:
        status === "CONTRADICTED"
          ? "Wave accounting can complete while required enemy work remains."
          : "Runtime residency is unresolved.",
    }],
    knowledgeRequirements: [],
    knowledgeReceipts: [],
    requiredInspectionGraph: {
      policy: "required-inspection-graph",
      nodes: [],
      receipts: [],
    },
  } as any;
}

const closed = {
  status: "CLOSED",
  surfaces: [],
  unaccountedSurfaceIds: [],
  blockingSurfaceIds: [],
  unknownSurfaceIds: [],
  stateModelComplete: true,
  boundariesExtracted: true,
  reasons: [],
} as any;

describe("audit obligations versus gameplay findings", () => {
  it("keeps runtime-blocked evidence as a non-finding obligation", () => {
    const graph = baseGraph("RUNTIME_BLOCKED");
    const gate = {
      status: "READY_FOR_PROPOSED_BUG_SET",
      contradictedCausalLinkIds: [],
      resolutions: [],
      confirmedDefectReadyIds: [],
      blockingCounterProofIds: [],
      runtimeProofRequiredIds: [],
      detectionGapIds: [],
      gameplayTranslationRequiredIds: [],
      counterProofSearchRequiredIds: [],
      issues: [],
    } as any;

    const findings =
      projectNeedValidationAuditIssues(
        graph,
        gate,
      );
    const obligations =
      deriveAuditObligations({
        graph,
        defectResolution: gate,
        gameplayWorld: {
          surfaceDiscovery: {
            surfaceIds: ["runtime:entities"],
          },
          arenas: {
            detected: false,
            isolation: {
              isolated: 0, partitionProofRequired: 0,
              sharedGlobal: 0, unknown: 0, observations: [],
            },
            replicaProof: [],
          },
          platformKnowledge: {
            claims: [],
          },
        } as any,
        gameplayClosure: closed,
        capabilityDelivery: [],
        negativeSpace: [],
        temporalRisks: [],
        discoveryChallenges: [],
        sharedResourceSignals: [],
        compoundBoundaries: [],
        accumulationGrowth: [],
      });

    expect(findings).toEqual([]);
    expect(
      obligations.some(
        (item) =>
          item.id === "link:wave" &&
          item.source === "runtime-proof",
      ),
    ).toBe(true);
  });

  it("allows NEED_VALIDATION only after defect confirmation readiness", () => {
    const graph = baseGraph("CONTRADICTED");
    const gate = {
      status: "READY_FOR_PROPOSED_BUG_SET",
      contradictedCausalLinkIds: ["link:wave"],
      resolutions: [{
        causalLinkId: "link:wave",
        scenarioId: "scenario:wave",
        disposition: "CONFIRMED_DEFECT_READY",
        gameplayTrigger: "Complete the wave.",
        gameplayConsequence:
          "Wave progression can complete incorrectly.",
        expectedOutcome:
          "Enemy remains accounted until completion.",
        actualOutcome:
          "Wave accounting can complete while required enemy work remains.",
        affectedScope: "objective:wave",
        evidenceIds: ["e:entity"],
        counterProofSearch: {
          schemaVersion: 1,
          policy: "bounded-counterproof-search",
          searchedDimensions: [
            "guard",
            "scope",
            "exclusion",
          ],
          dimensionReceipts: [{
            dimension: "guard",
            scopeIds: ["objective:wave"],
            evidenceIds: ["e:entity"],
          }, {
            dimension: "scope",
            scopeIds: ["objective:wave"],
            evidenceIds: ["e:entity"],
          }, {
            dimension: "exclusion",
            scopeIds: ["objective:wave"],
            evidenceIds: ["e:entity"],
          }],
          scopeIds: ["objective:wave"],
          evidenceIds: ["e:entity"],
          exhaustiveWithinScope: true,
          conclusion: "NO_BLOCKING_PROOF",
        },
      }],
      confirmedDefectReadyIds: ["link:wave"],
      blockingCounterProofIds: [],
      runtimeProofRequiredIds: [],
      detectionGapIds: [],
      gameplayTranslationRequiredIds: [],
      counterProofSearchRequiredIds: [],
      issues: [],
    } as any;

    const findings =
      projectNeedValidationAuditIssues(
        graph,
        gate,
      );

    expect(findings).toHaveLength(1);
    expect(findings[0]?.status)
      .toBe("NEED_VALIDATION");
    expect(findings[0]?.issueType)
      .toBe("BUG");
  });
});


describe("reusable blind-spot obligations", () => {
  const gate = {
    status: "READY_FOR_PROPOSED_BUG_SET",
    contradictedCausalLinkIds: [],
    resolutions: [],
    confirmedDefectReadyIds: [],
    blockingCounterProofIds: [],
    runtimeProofRequiredIds: [],
    detectionGapIds: [],
    gameplayTranslationRequiredIds: [],
    counterProofSearchRequiredIds: [],
    issues: [],
  } as any;

  const graph = {
    schemaVersion: 1,
    policy: "scenario-driven-causal-audit",
    scenarios: [],
    components: [],
    causalLinks: [],
    knowledgeRequirements: [],
    knowledgeReceipts: [],
    requiredInspectionGraph: {
      policy: "required-inspection-graph",
      nodes: [],
      receipts: [],
    },
  } as any;

  const baseWorld = {
    surfaceDiscovery: { surfaceIds: [] },
    arenas: {
      detected: true,
      isolation: {
        isolated: 0,
        partitionProofRequired: 0,
        sharedGlobal: 0,
        unknown: 0,
        observations: [],
      },
      replicaProof: [],
    },
    platformKnowledge: { claims: [] },
  } as any;

  const derive = (extra: any) =>
    deriveAuditObligations({
      graph: extra.graph ?? graph,
      defectResolution: extra.gate ?? gate,
      gameplayWorld: {
        ...baseWorld,
        ...(extra.gameplayWorld ?? {}),
      },
      gameplayClosure: extra.gameplayClosure ?? closed,
      capabilityDelivery: [],
      negativeSpace: extra.negativeSpace ?? [],
      temporalRisks: extra.temporalRisks ?? [],
      discoveryChallenges: [],
      sharedResourceSignals: [],
      compoundBoundaries: [],
      accumulationGrowth: [],
      ...(extra.capabilityExposure === undefined ? {} : { capabilityExposure: extra.capabilityExposure }),
    });

  it("preserves the earliest causal blocker when graph and resolution share an ID", () => {
    const linkGraph = baseGraph("DETECTION_GAP");
    const obligations = derive({
      graph: linkGraph,
      gate: {
        ...gate,
        resolutions: [{
          causalLinkId: "link:wave",
          disposition: "DETECTION_GAP",
          detectionGapReason: "Parser cannot yet resolve the scoped transition.",
          missingCapability: "exact-source-transition",
          evidenceIds: ["e:extra-resolution"],
        }],
      },
    });
    const matching = obligations.filter((item) => item.id === "link:wave");
    expect(matching).toHaveLength(1);
    expect(matching[0]?.stage).toBe("UNDERSTAND");
    expect(matching[0]?.source).toBe("detection-gap");
    expect(matching[0]?.evidenceIds).toEqual(["e:entity", "e:extra-resolution"]);
    expect(matching[0]?.missingProof).toContain("Analysis capability: exact-source-transition");
    expect(matching[0]?.missingProof).toContain("Selected-artifact semantic evidence");
    expect(matching[0]?.reason).toContain("Parser cannot yet resolve");
  });

  it("surfaces incomplete replica proof instead of inheriting baseline safety", () => {
    const obligations = derive({
      gameplayWorld: {
        ...baseWorld,
        arenas: {
          ...baseWorld.arenas,
          replicaProof: [{
            arenaId: "arena:6",
            status: "no-proof",
            mismatchCount: 0,
            unresolvedBlocks: 1,
            evidenceIds: ["world:a6"],
          }],
        },
      },
    });

    expect(
      obligations.some(
        (item) =>
          item.id ===
          "replica-proof-incomplete:arena:6" &&
          item.source === "detection-gap",
      ),
    ).toBe(true);
  });

  it("forces proof for non-isolated arena resources", () => {
    const obligations = derive({
      gameplayWorld: {
        ...baseWorld,
        arenas: {
          ...baseWorld.arenas,
          isolation: {
            isolated: 0,
            partitionProofRequired: 1,
            sharedGlobal: 0,
            unknown: 0,
            observations: [{
              scriptId: "game",
              region: "arena:start",
              key: "shared_cinematic",
              status:
                "partition-proof-required",
            }],
          },
        },
      },
    });

    expect(
      obligations.some(
        (item) =>
          item.source === "shared-resource" &&
          item.id.includes("shared_cinematic"),
      ),
    ).toBe(true);
  });

  it("keeps unauthorized developer capability open until player reachability is proven", () => {
    const obligations = derive({
      capabilityExposure: {
        exposures: [{
          capabilityId:
            "developer-tool:skip",
          capabilityLabel:
            "Developer level skip",
          status: "potentially-exposed",
          prerequisiteReachability: "unknown",
          impact: "progression",
          reasons: [
            "Authorization is missing.",
          ],
          evidenceIds: ["scripts/dev.ts"],
        }],
        exposed: 0,
        potentiallyExposed: 1,
        releaseBlocking: 1,
        unresolved: 0,
      },
    });

    expect(
      obligations.some(
        (item) =>
          item.id ===
          "capability-reachability:developer-tool:skip" &&
          item.source === "detection-gap",
      ),
    ).toBe(true);
  });

  it("does not hide missing, duplicate or unevidenced Knowledge receipts", () => {
    const required = {
      id: "knowledge:wave:state",
      scenarioId: "scenario:wave", domain: "state-flow",
      reason: "Wave state ownership must be proven",
      capabilityIds: ["state-flow"], dependsOnRequirementIds: [],
      subjectIds: ["objective:wave"], componentIds: ["runtime:entities"],
    };
    const receipt = {
      requirementId: required.id,
      scenarioId: required.scenarioId,
      domain: required.domain,
      status: "SATISFIED",
      evidenceIds: ["e:knowledge"],
      knowledgeIds: ["fact:state-flow"],
      capabilityIdsUsed: ["state-flow"],
      subjectIds: required.subjectIds,
      componentIds: required.componentIds,
      reason: "Source grounded.",
    };
    for (const receipts of [
      [],
      [{ ...receipt, evidenceIds: [] }],
      [receipt, { ...receipt }],
    ]) {
      const changedGraph = {
        ...baseGraph("PROVEN"),
        knowledgeRequirements: [required],
        knowledgeReceipts: receipts,
      };
      const obligations = deriveAuditObligations({
        graph: changedGraph,
        defectResolution: {
          status: "READY_FOR_PROPOSED_BUG_SET",
          resolutions: [], confirmedDefectReadyIds: [],
          runtimeProofRequiredIds: [], detectionGapIds: [],
          gameplayTranslationRequiredIds: [], counterProofSearchRequiredIds: [],
        } as any,
        gameplayWorld: {
          arenas: { detected: false, isolation: { observations: [] }, replicaProof: [] },
          platformKnowledge: { claims: [] }, surfaceDiscovery: { surfaceIds: [] },
        } as any,
        gameplayClosure: closed,
        capabilityDelivery: [], negativeSpace: [], temporalRisks: [],
        discoveryChallenges: [], sharedResourceSignals: [], compoundBoundaries: [],
        accumulationGrowth: [],
      });
      expect(obligations.filter(o => o.id === "knowledge-gap:" + required.id))
        .toHaveLength(1);
    }
  });

  it("keeps orphaned Knowledge receipts visible without promoting detached evidence", () => {
    const orphan = {
      requirementId: "knowledge:unowned:state",
      scenarioId: "scenario:other",
      domain: "state-flow",
      status: "SATISFIED",
      evidenceIds: ["e:detached"],
      knowledgeIds: ["knowledge:unowned"],
      capabilityIdsUsed: ["state-flow"],
      subjectIds: ["objective:unowned"],
      componentIds: ["runtime:entities"],
      reason: "Detached evidence must not prove another scenario.",
    };
    for (const status of ["SATISFIED", "MISSING_REQUIRED_KNOWLEDGE"] as const) {
      const obligations = derive({
        graph: {
          ...graph,
          knowledgeReceipts: [{ ...orphan, status }],
        },
      });
      const orphanObligations = obligations.filter((item) =>
        item.id === "knowledge-gap:" + orphan.requirementId);
      expect(orphanObligations).toHaveLength(1);
      expect(orphanObligations[0]?.stage).toBe("FORMALIZE");
      expect(orphanObligations[0]?.evidenceIds).toEqual([]);
      expect(orphanObligations[0]?.reason).toContain(
        "no matching requirement owner",
      );
    }
  });

  it("keeps missing scenario knowledge as an audit obligation, not a bug", () => {
    const unresolvedGraph = {
      ...graph,
      scenarios: [{
        id: "scenario:wave", label: "wave", gameplayStage: "PROGRESSION",
        purpose: "Complete the wave.", sourceSubjectIds: ["objective:wave"],
        componentIds: ["runtime:entities"], causalLinkIds: [],
        playerCounts: [1], requiredKnowledgeIds: ["knowledge:wave:chunk"],
        composedScenarioIds: [],
      }],
      knowledgeRequirements: [{
        id: "knowledge:wave:chunk", scenarioId: "scenario:wave",
        domain: "chunk-simulation", reason: "Chunk evidence is required.",
        capabilityIds: ["chunk-lifecycle-integrity"],
        dependsOnRequirementIds: [], subjectIds: ["objective:wave"],
        componentIds: ["runtime:entities"],
      }],
      knowledgeReceipts: [{
        requirementId: "knowledge:wave:chunk", scenarioId: "scenario:wave",
        domain: "chunk-simulation", status: "MISSING_REQUIRED_KNOWLEDGE",
        evidenceIds: [], knowledgeIds: [],
        capabilityIdsUsed: ["chunk-lifecycle-integrity"],
        subjectIds: ["objective:wave"], componentIds: ["runtime:entities"],
        reason: "No decisive chunk simulation evidence.",
      }],
    };
    const obligations = derive({ graph: unresolvedGraph });
    expect(obligations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "knowledge-gap:knowledge:wave:chunk",
        source: "knowledge-gap",
        stage: "PROVE",
      }),
    ]));
    expect(projectNeedValidationAuditIssues(unresolvedGraph, gate)).toEqual([]);
  });

  it("preserves lifecycle asymmetry and high temporal risk as distinct obligations", () => {
    const obligations = derive({
      negativeSpace: [{
        id: "negative-space:entry-without-exit:state:round",
        kind: "entry-without-exit",
        subjectId: "state:round",
        evidenceIds: ["state:enter"],
        reason: "Reachable state lacks a grounded exit.",
      }],
      temporalRisks: [{
        leftSystem: "callback:reward", rightSystem: "arena:cleanup",
        factors: ["async", "cleanup"], priority: "high",
        windows: ["before", "overlap", "after"],
      }],
    });
    expect(obligations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "negative-space:entry-without-exit:state:round",
        source: "negative-space", stage: "EVALUATE",
      }),
      expect.objectContaining({
        id: "temporal-risk:callback:reward:arena:cleanup",
        source: "temporal-risk", stage: "EVALUATE",
      }),
    ]));
    expect(projectNeedValidationAuditIssues(graph, gate)).toEqual([]);
  });

  it("orders model-facing obligations by canonical audit stage, not alphabetic stage names", () => {
    const obligations = derive({
      negativeSpace: [{
        id: "negative-space:round-without-exit",
        kind: "entry-without-exit",
        subjectId: "state:round",
        evidenceIds: ["state:enter"],
        reason: "Missing confirmed exit path.",
      }],
      gameplayClosure: {
        ...closed,
        status: "PARTIAL",
        stateModelComplete: false,
      },
      gameplayWorld: {
        ...baseWorld,
        arenas: {
          ...baseWorld.arenas,
          replicaProof: [{
            arenaId: "arena:second",
            status: "no-proof",
            mismatchCount: 0,
            evidenceIds: ["world:arena-second"],
          }],
        },
      },
    });
    const stageOrder = obligations.map(item => item.stage);
    const distinctStages = [...new Set(stageOrder)];
    expect(distinctStages).toEqual([
      "UNDERSTAND", "FORMALIZE", "EVALUATE",
    ]);
    expect(stageOrder).not.toEqual(
      [...stageOrder].sort((a, b) => a.localeCompare(b)),
    );
  });

  it("retains unaccounted surfaces and incomplete closure as obligations", () => {
    const obligations = derive({
      gameplayClosure: {
        ...closed,
        status: "OPEN",
        surfaces: [{
          id: "runtime:arena-capacity", label: "Arena capacity",
          kind: "runtime-domain", status: "unknown", material: true,
          reason: "Concurrent capacity is unresolved.",
          evidenceIds: ["capacity:source"], boundaries: [],
        }],
        unaccountedSurfaceIds: ["mechanic:teleport"],
        unknownSurfaceIds: ["runtime:arena-capacity"],
        stateModelComplete: false, boundariesExtracted: false,
      },
    });
    const ids = obligations.map(item => item.id);
    expect(ids).toEqual(expect.arrayContaining([
      "closure-surface:runtime:arena-capacity",
      "unaccounted-surface:mechanic:teleport",
      "closure-gap:state-model",
      "closure-gap:boundaries",
    ]));
    expect(projectNeedValidationAuditIssues(graph, gate)).toEqual([]);
  });

});
