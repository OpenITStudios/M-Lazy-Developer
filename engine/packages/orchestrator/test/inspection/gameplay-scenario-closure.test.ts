import { describe, expect, it } from "vitest";
import {
  assessGameplayScenarioClosure,
} from "../../src/inspection/gameplay-scenario-closure.js";
import {
  deriveGameplayArchitectureNavigation,
  type GameplayScenarioGraph,
} from "../../src/inspection/gameplay-scenario-model.js";

function baseGraph(): GameplayScenarioGraph {
  return {
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
  };
}

describe("gameplay scenario closure", () => {
  it("keeps Scenario Closure OPEN when canonical Knowledge proof is missing or ambiguous", () => {
    const required = {
      id: "knowledge:wave:state",
      scenarioId: "scenario:wave",
      domain: "state-flow" as const,
      reason: "Wave state ownership",
      capabilityIds: ["state-flow"],
      dependsOnRequirementIds: [],
      subjectIds: ["objective:wave"],
      componentIds: ["component:state"],
    };
    const receipt = {
      requirementId: required.id,
      scenarioId: required.scenarioId,
      domain: required.domain,
      status: "SATISFIED" as const,
      evidenceIds: ["e:state"],
      knowledgeIds: ["knowledge:wave"],
      capabilityIdsUsed: ["state-flow"],
      subjectIds: required.subjectIds,
      componentIds: required.componentIds,
      reason: "Source-grounded state flow.",
    };
    const valid: GameplayScenarioGraph = {
      ...baseGraph(),
      scenarios: [{
        id: "scenario:wave", label: "wave-progression",
        gameplayStage: "PROGRESSION",
        purpose: "Complete one wave.",
        sourceSubjectIds: ["objective:wave"],
        componentIds: ["component:state", "component:goal"],
        causalLinkIds: ["link:wave"],
        playerCounts: [1],
        requiredKnowledgeIds: [required.id],
        composedScenarioIds: [],
      }],
      components: [{
        id: "component:state", label: "Wave state",
        kind: "state", technicalRole: "wave owner",
        gameplayPurpose: "Track state to completion.",
        evidenceIds: ["e:state"],
        usedByScenarioIds: ["scenario:wave"], orphan: false,
      }, {
        id: "component:goal", label: "Wave goal",
        kind: "objective", technicalRole: "wave completion",
        gameplayPurpose: "Conclude the wave.",
        evidenceIds: ["e:goal"],
        usedByScenarioIds: ["scenario:wave"], orphan: false,
      }],
      causalLinks: [{
        id: "link:wave", scenarioId: "scenario:wave",
        fromComponentId: "component:state",
        toComponentId: "component:goal",
        purpose: "State controls wave conclusion.",
        subjectIds: ["objective:wave"],
        componentIds: ["component:state", "component:goal"],
        evidenceIds: ["e:state"],
        knowledgeRequirementIds: [required.id],
        impactPathComponentIds: [],
        impactPathEvidenceIds: [],
        dimensionEvidence: {},
        status: "PROVEN",
        reason: "Grounded source dependency.",
      }],
      knowledgeRequirements: [required],
      knowledgeReceipts: [receipt],
    };
    expect(assessGameplayScenarioClosure(valid).status).toBe("CLOSED");
    // A generated scenario/component/causal ID is not a unique owner simply
    // because all referenced IDs exist. Duplicate definitions must prevent
    // Scenario Closure from declaring a player-facing graph complete.
    for (const [kind, candidate] of [
      ["component", {
        ...valid, components: [...valid.components,
          { ...valid.components[0]!, label: "Different arena state owner" }],
      }],
      ["scenario", {
        ...valid, scenarios: [...valid.scenarios,
          { ...valid.scenarios[0]!, label: "Different authored mode" }],
      }],
      ["causal-link", {
        ...valid, causalLinks: [...valid.causalLinks,
          { ...valid.causalLinks[0]!, purpose: "Different dependency" }],
      }],
    ] as readonly [string, GameplayScenarioGraph][]) {
      const closure = assessGameplayScenarioClosure(candidate);
      expect(closure.status, kind).toBe("OPEN");
      expect(closure.reasons.join(" "), kind)
        .toContain("Ambiguous selected-map " + kind + " ID owner(s)");
    }
    const variants: GameplayScenarioGraph[] = [
      { ...valid, knowledgeReceipts: [] },
      { ...valid, knowledgeReceipts: [{ ...receipt, evidenceIds: [] }] },
      { ...valid, knowledgeReceipts: [receipt, { ...receipt }] },
      { ...valid, knowledgeReceipts: [
        receipt, { ...receipt, scenarioId: "scenario:foreign" },
      ] },
      { ...valid, knowledgeRequirements: [required, { ...required }] },
      { ...valid, knowledgeReceipts: [
        receipt, { ...receipt, requirementId: "knowledge:orphan" },
      ] },
    ];
    for (const variant of variants) {
      const closure = assessGameplayScenarioClosure(variant);
      expect(closure.status).toBe("OPEN");
      expect(closure.missingRequiredKnowledgeIds.length).toBeGreaterThan(0);
    }

    // Two individually proven scenarios must not be able to borrow each
    // other's requirement, link ownership, or prerequisite identity.
    const otherRequirement = {
      ...required,
      id: "knowledge:other:state",
      scenarioId: "scenario:other",
    };
    const otherReceipt = {
      ...receipt,
      requirementId: otherRequirement.id,
      scenarioId: otherRequirement.scenarioId,
    };
    const otherScenario = {
      ...valid.scenarios[0]!,
      id: "scenario:other",
      causalLinkIds: ["link:other"],
      requiredKnowledgeIds: [otherRequirement.id],
    };
    const otherLink = {
      ...valid.causalLinks[0]!,
      id: "link:other",
      scenarioId: "scenario:other",
      knowledgeRequirementIds: [otherRequirement.id],
    };
    const multi: GameplayScenarioGraph = {
      ...valid,
      scenarios: [...valid.scenarios, otherScenario],
      causalLinks: [...valid.causalLinks, otherLink],
      knowledgeRequirements: [required, otherRequirement],
      knowledgeReceipts: [receipt, otherReceipt],
    };
    expect(assessGameplayScenarioClosure(multi).status).toBe("CLOSED");

    const wave = multi.scenarios[0]!;
    const waveLink = multi.causalLinks[0]!;
    const foreignBindings: GameplayScenarioGraph[] = [
      {
        ...multi,
        scenarios: [
          { ...wave, requiredKnowledgeIds: [otherRequirement.id] },
          otherScenario,
        ],
      },
      {
        ...multi,
        causalLinks: [
          { ...waveLink, knowledgeRequirementIds: [otherRequirement.id] },
          otherLink,
        ],
      },
      {
        ...multi,
        knowledgeRequirements: [
          { ...required, dependsOnRequirementIds: [otherRequirement.id] },
          otherRequirement,
        ],
      },
      {
        ...multi,
        scenarios: [
          { ...wave, requiredKnowledgeIds: [] },
          otherScenario,
        ],
      },
    ];
    for (const graph of foreignBindings) {
      const closure = assessGameplayScenarioClosure(graph);
      expect(closure.status).toBe("OPEN");
      expect(closure.reasons).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/(Missing scenario bindings|Invalid causal links|Invalid knowledge dependencies)/),
        ]),
      );
    }
  });

  it("opens when a leaf scenario has components but no causal proof links", () => {
    const result = assessGameplayScenarioClosure({
      ...baseGraph(),
      scenarios: [{
        id: "scenario:wave",
        label: "wave",
        gameplayStage: "ACTIVE_GAMEPLAY",
        purpose: "Resolve one wave.",
        sourceSubjectIds: ["phase:wave"],
        componentIds: ["component:wave"],
        causalLinkIds: [],
        playerCounts: [1],
        requiredKnowledgeIds: [],
        composedScenarioIds: [],
      }],
      components: [{
        id: "component:wave",
        label: "Wave",
        kind: "phase",
        technicalRole: "wave state",
        gameplayPurpose: "Advance progression.",
        evidenceIds: ["evidence:wave"],
        usedByScenarioIds: ["scenario:wave"],
        orphan: false,
      }],
    });

    expect(result.status).toBe("OPEN");
    expect(result.unprovenLeafScenarioIds).toEqual([
      "scenario:wave",
    ]);
  });

  it("emits one narrow runtime proof request for a runtime-blocked causal link", () => {
    const result = assessGameplayScenarioClosure({
      ...baseGraph(),
      scenarios: [{
        id: "scenario:chunk",
        label: "remote-wave",
        gameplayStage: "ACTIVE_GAMEPLAY",
        purpose: "Run a remote enemy wave.",
        sourceSubjectIds: ["phase:wave"],
        componentIds: [
          "component:spawn",
          "component:objective",
        ],
        causalLinkIds: ["link:chunk"],
        playerCounts: [1],
        requiredKnowledgeIds: [],
        composedScenarioIds: [],
      }],
      components: [{
        id: "component:spawn",
        label: "Spawn",
        kind: "mechanic",
        technicalRole: "remote spawn",
        gameplayPurpose: "Create the enemy.",
        evidenceIds: ["evidence:spawn"],
        usedByScenarioIds: ["scenario:chunk"],
        orphan: false,
      }, {
        id: "component:objective",
        label: "Objective",
        kind: "objective",
        technicalRole: "wave objective",
        gameplayPurpose: "Receive enemy progression.",
        evidenceIds: ["evidence:objective"],
        usedByScenarioIds: ["scenario:chunk"],
        orphan: false,
      }],
      causalLinks: [{
        id: "link:chunk",
        scenarioId: "scenario:chunk",
        fromComponentId: "component:spawn",
        toComponentId: "component:objective",
        purpose:
          "Remote enemy remains simulated until it reaches the objective",
        evidenceIds: ["evidence:spawn"],
        subjectIds: ["phase:wave"],
        componentIds: [
          "component:spawn",
          "component:objective",
        ],
        knowledgeRequirementIds: [],
        impactPathComponentIds: [],
        impactPathEvidenceIds: [],
        dimensionEvidence: {},
        status: "RUNTIME_BLOCKED",
        reason:
          "Static evidence cannot prove remote simulation residency.",
      }],
    });

    expect(result.status).toBe("PARTIAL");
    expect(result.runtimeProofRequests).toHaveLength(1);
    expect(
      result.runtimeProofRequests[0]?.narrowRuntimeQuestion,
    ).toContain(
      "Remote enemy remains simulated",
    );
  });

  it("emits one targeted tester obligation for each detection gap", () => {
    const result = assessGameplayScenarioClosure({
      ...baseGraph(),
      scenarios: [{
        id: "scenario:inventory",
        label: "inventory-reconnect",
        gameplayStage: "RECOVERY",
        purpose: "Recover inventory after reconnect.",
        sourceSubjectIds: ["mechanic:inventory"],
        componentIds: [
          "component:inventory",
          "component:reconnect",
        ],
        causalLinkIds: ["link:inventory-gap"],
        playerCounts: [1],
        requiredKnowledgeIds: [],
        composedScenarioIds: [],
      }],
      components: [{
        id: "component:inventory",
        label: "Inventory",
        kind: "mechanic",
        technicalRole: "inventory mutation",
        gameplayPurpose: "Restore the correct loadout.",
        evidenceIds: ["evidence:inventory"],
        usedByScenarioIds: ["scenario:inventory"],
        orphan: false,
      }, {
        id: "component:reconnect",
        label: "Reconnect",
        kind: "lifecycle",
        technicalRole: "player recovery",
        gameplayPurpose: "Return the player to a valid state.",
        evidenceIds: ["evidence:reconnect"],
        usedByScenarioIds: ["scenario:inventory"],
        orphan: false,
      }],
      causalLinks: [{
        id: "link:inventory-gap",
        scenarioId: "scenario:inventory",
        fromComponentId: "component:reconnect",
        toComponentId: "component:inventory",
        purpose:
          "Reconnect restores exactly one valid loadout",
        evidenceIds: ["evidence:inventory"],
        subjectIds: ["mechanic:inventory"],
        componentIds: [
          "component:inventory",
          "component:reconnect",
        ],
        knowledgeRequirementIds: [],
        impactPathComponentIds: [],
        impactPathEvidenceIds: [],
        dimensionEvidence: {},
        status: "DETECTION_GAP",
        reason:
          "Dynamic inventory mutation cannot be resolved statically.",
      }],
    });

    expect(result.status).toBe("OPEN");
    expect(result.detectionGapCausalLinkIds).toEqual([
      "link:inventory-gap",
    ]);
    expect(result.detectionGapTestRequests).toHaveLength(1);
    expect(
      result.detectionGapTestRequests[0]?.narrowTestQuestion,
    ).toContain("Reconnect restores exactly one valid loadout");
  });

  it("does not treat a composition-only scenario as shallow", () => {
    const result = assessGameplayScenarioClosure({
      ...baseGraph(),
      scenarios: [{
        id: "scenario:journey",
        label: "full-journey",
        gameplayStage: "FULL",
        purpose: "Compose the journey.",
        sourceSubjectIds: [],
        componentIds: ["component:journey"],
        causalLinkIds: [],
        playerCounts: [1],
        requiredKnowledgeIds: [],
        composedScenarioIds: ["scenario:child"],
      }, {
        id: "scenario:child",
        label: "child",
        gameplayStage: "ACTIVE_GAMEPLAY",
        purpose: "Child scenario.",
        sourceSubjectIds: ["phase:child"],
        componentIds: ["component:child"],
        causalLinkIds: ["link:child"],
        playerCounts: [1],
        requiredKnowledgeIds: [],
        composedScenarioIds: [],
      }],
      components: [{
        id: "component:journey",
        label: "Journey",
        kind: "game",
        technicalRole: "composition",
        gameplayPurpose: "Compose child scenarios.",
        evidenceIds: [],
        usedByScenarioIds: ["scenario:journey"],
        orphan: false,
      }, {
        id: "component:child",
        label: "Child",
        kind: "phase",
        technicalRole: "phase",
        gameplayPurpose: "Advance gameplay.",
        evidenceIds: ["evidence:child"],
        usedByScenarioIds: ["scenario:child"],
        orphan: false,
      }],
      causalLinks: [{
        id: "link:child",
        scenarioId: "scenario:child",
        fromComponentId: "component:child",
        toComponentId: "component:child",
        purpose: "Self-contained proof edge.",
        evidenceIds: ["evidence:child"],
        subjectIds: ["phase:child"],
        componentIds: ["component:child"],
        knowledgeRequirementIds: [],
        impactPathComponentIds: [],
        impactPathEvidenceIds: [],
        dimensionEvidence: {},
        status: "PROVEN",
        reason: "Selected-artifact proof exists.",
      }],
    });

    expect(result.unprovenLeafScenarioIds).toEqual([]);
    expect(result.status).toBe("CLOSED");
  });

  it("keeps closure open when a scenario references an absent component", () => {
    const result = assessGameplayScenarioClosure({
      ...baseGraph(),
      scenarios: [{
        id: "scenario:missing",
        label: "missing-component",
        gameplayStage: "SETUP",
        purpose: "Bind setup components.",
        sourceSubjectIds: [],
        componentIds: ["component:absent"],
        causalLinkIds: [],
        playerCounts: [1],
        requiredKnowledgeIds: [],
        composedScenarioIds: [],
      }],
    });
    expect(result.status).toBe("OPEN");
    expect(result.reasons).toContain(
      "Missing scenario bindings: scenario:missing",
    );
  });

  it("rejects a causal link outside its owning scenario bindings", () => {
    const result = assessGameplayScenarioClosure({
      ...baseGraph(),
      scenarios: [{
        id: "scenario:arena",
        label: "arena",
        gameplayStage: "ACTIVE_GAMEPLAY",
        purpose: "Resolve arena progression.",
        sourceSubjectIds: [],
        componentIds: ["component:arena"],
        causalLinkIds: ["link:arena"],
        playerCounts: [1],
        requiredKnowledgeIds: [],
        composedScenarioIds: [],
      }],
      components: ["component:arena", "component:other"].map((id) => ({
        id,
        label: id,
        kind: "mechanic" as const,
        technicalRole: "state",
        gameplayPurpose: "Control progression.",
        evidenceIds: [],
        usedByScenarioIds: ["scenario:arena"],
        orphan: false,
      })),
      causalLinks: [{
        id: "link:arena",
        scenarioId: "scenario:arena",
        fromComponentId: "component:arena",
        toComponentId: "component:other",
        purpose: "Advance progression.",
        evidenceIds: [],
        subjectIds: [],
        componentIds: ["component:arena", "component:other"],
        knowledgeRequirementIds: [],
        impactPathComponentIds: [],
        impactPathEvidenceIds: [],
        dimensionEvidence: {},
        status: "PROVEN",
        reason: "Fixture edge.",
      }],
    });
    expect(result.status).toBe("OPEN");
    expect(result.reasons.some((reason) =>
      reason.includes("link:arena") &&
      reason.includes("outside their owning scenario"),
    )).toBe(true);
  });

  it("keeps closure open when a knowledge prerequisite is missing", () => {
    const result = assessGameplayScenarioClosure({
      ...baseGraph(),
      scenarios: [{
        id: "scenario:knowledge",
        label: "knowledge",
        gameplayStage: "FORMALIZE",
        purpose: "Resolve required knowledge.",
        sourceSubjectIds: [],
        componentIds: [],
        causalLinkIds: [],
        playerCounts: [1],
        requiredKnowledgeIds: ["knowledge:root"],
        composedScenarioIds: [],
      }],
      knowledgeRequirements: [{
        id: "knowledge:root",
        scenarioId: "scenario:knowledge",
        domain: "chunk-simulation",
        reason: "Check simulation residency.",
        capabilityIds: [],
        dependsOnRequirementIds: ["knowledge:missing"],
        subjectIds: [],
        componentIds: [],
      }],
    });
    expect(result.status).toBe("OPEN");
    expect(result.reasons).toContain(
      "Invalid knowledge dependencies: knowledge:root",
    );
  });

  it("rejects a causal link with an absent knowledge requirement", () => {
    const graph = baseGraph();
    const result = assessGameplayScenarioClosure({
      ...graph,
      scenarios: [{
        id: "scenario:link-knowledge",
        label: "link knowledge",
        gameplayStage: "ACTIVE_GAMEPLAY",
        purpose: "Connect progression components.",
        sourceSubjectIds: [],
        componentIds: ["component:a", "component:b"],
        causalLinkIds: ["link:knowledge"],
        playerCounts: [1],
        requiredKnowledgeIds: [],
        composedScenarioIds: [],
      }],
      components: ["component:a", "component:b"].map((id) => ({
        id,
        label: id,
        kind: "mechanic" as const,
        technicalRole: "progression",
        gameplayPurpose: "Advance gameplay.",
        evidenceIds: [],
        usedByScenarioIds: ["scenario:link-knowledge"],
        orphan: false,
      })),
      causalLinks: [{
        id: "link:knowledge",
        scenarioId: "scenario:link-knowledge",
        fromComponentId: "component:a",
        toComponentId: "component:b",
        purpose: "Advance gameplay.",
        evidenceIds: [],
        subjectIds: [],
        componentIds: ["component:a", "component:b"],
        knowledgeRequirementIds: ["knowledge:absent"],
        impactPathComponentIds: [],
        impactPathEvidenceIds: [],
        dimensionEvidence: {},
        status: "PROVEN",
        reason: "Fixture link.",
      }],
    });
    expect(result.status).toBe("OPEN");
    expect(result.reasons).toContain("Invalid causal links: link:knowledge");
  });

  it("projects stage navigation without inventing systems and preserves missing links", () => {
    const model = deriveGameplayArchitectureNavigation({
      ...baseGraph(),
      scenarios: [{
        id: "scenario:lobby",
        label: "Lobby",
        gameplayStage: "ENTRY_JOIN",
        purpose: "Join.",
        sourceSubjectIds: [],
        componentIds: ["component:entry", "component:missing"],
        causalLinkIds: ["link:missing"],
        playerCounts: [1],
        requiredKnowledgeIds: [],
        composedScenarioIds: [],
      }],
      components: [{
        id: "component:entry",
        label: "Join",
        kind: "mechanic",
        technicalRole: "entry",
        gameplayPurpose: "Join map",
        evidenceIds: ["evidence:join"],
        usedByScenarioIds: ["scenario:lobby"],
        orphan: false,
      }, {
        id: "component:unplaced",
        label: "Unplaced",
        kind: "mechanic",
        technicalRole: "unclassified",
        gameplayPurpose: "",
        evidenceIds: ["evidence:other"],
        usedByScenarioIds: [],
        orphan: true,
      }],
    });
    expect(model.scenarios).toEqual([{
      id: "scenario:lobby",
      label: "Lobby",
      gameplayStage: "ENTRY_JOIN",
      purpose: "Join.",
      sourceSubjectIds: [],
      componentIds: ["component:entry", "component:missing"],
      causalLinkIds: ["link:missing"],
    }]);
    expect(model.stages[0]).toEqual({
      name: "ENTRY_JOIN",
      scenarioIds: ["scenario:lobby"],
      componentIds: ["component:entry", "component:missing"],
      causalLinkIds: ["link:missing"],
    });
    expect(model.components.find((item) => item.id === "component:entry")?.evidenceIds)
      .toEqual(["evidence:join"]);
    expect(model.knowledgeCoverage).toMatchObject({
      observedSourceIndexPercent: null,
      observedComponentPlacementPercent: 50,
      wholeGameUnderstandingPercent: null,
      wholeGameUnderstandingStatus: "NOT_MEASURABLE",
    });
    expect(model.unplacedComponentIds).toEqual(["component:unplaced"]);
    expect(model.missingGraphReferenceIds).toEqual([
      "component:missing", "link:missing",
    ]);
  });

  it("keeps arena evidence and measured source coverage distinct from whole-game knowledge", () => {
    const architecture = deriveGameplayArchitectureNavigation(
      baseGraph(),
      { relevantSourceCount: 20, indexedSourceCount: 15,
        arenaDetected: true, arenaCount: 6 },
    );
    expect(architecture.knowledgeCoverage).toEqual({
      observedSourceIndexPercent: 75,
      observedComponentPlacementPercent: null,
      wholeGameUnderstandingPercent: null,
      wholeGameUnderstandingStatus: "NOT_MEASURABLE",
      observedRelevantSourceCount: 20,
      observedIndexedSourceCount: 15,
      observedComponentCount: 0,
      observedPlacedComponentCount: 0,
      arenaEvidence: {
        detected: true,
        count: 6,
        countBasis: null,
        layoutStatus: null,
        spatialLayoutEntries: [],
        spatialLayoutConfidence: null,
        arenaRegionCandidates: [],
        spatialArenaIdsWithoutRegionCandidates: [],
        arenasWithoutSpatialLayoutCount: 6,
        spatialArenaIdsWithoutReplicaProof: [],
        arenaEvidenceComponentLinks: [],
        spatialArenaIdsWithoutComponentLinks: [],
        duplicateReplicaProofArenaIds: [],
        replicaProofEntries: [],
        entityPopulationProofEntries: [],
        actorPopulationProofEntries: [],
        populationArenaIdsWithoutReplicaProof: [],
        arenasWithoutReplicaProofCount: 6,
        declaredConcurrentArenaLimit: null,
        requestedConcurrentArenas: null,
        safeConcurrentArenas: null,
        perArenaPlayerCapacity: null,
        architectureMapping: "NOT_YET_RECONCILED",
        stateIsolationObservations: [],
        chunkLeases: [],
        cleanupAssessments: [],
        arenaSessionMapping: "NOT_YET_ESTABLISHED",
        spatialArenaIdsWithoutSessionOwnershipProof: [],
      },
    });
  });

  it("exposes observed gameplay systems without inferring absent mechanics", () => {
    const architecture = deriveGameplayArchitectureNavigation(
      baseGraph(),
      {
        relevantSourceCount: 5,
        indexedSourceCount: 5,
        arenaDetected: false,
        systemObservations: [{
          system: "ENTITY",
          observedCount: 2,
          observationReferences: ["minecraft:pillager", "minecraft:pillager"],
        }, {
          system: "ECONOMY",
          observedCount: 0,
          observationReferences: [],
        }],
      },
    );
    expect(architecture.systemInventory).toEqual([
      {
        system: "ECONOMY",
        observedCount: 0,
        observationReferences: [],
        evidenceIds: [],
        inventoryStatus: "NOT_OBSERVED",
        evidenceLinkedComponentIds: [],
        unmatchedEvidenceIds: [],
        architectureMapping: "NOT_YET_RECONCILED",
      },
      {
        system: "ENTITY",
        observedCount: 2,
        observationReferences: ["minecraft:pillager"],
        evidenceIds: [],
        inventoryStatus: "OBSERVED",
        evidenceLinkedComponentIds: [],
        unmatchedEvidenceIds: [],
        architectureMapping: "NOT_YET_RECONCILED",
      },
    ]);
    expect(architecture.knowledgeCoverage.wholeGameUnderstandingPercent).toBeNull();
  });

  it("preserves physical arena inventory separately from scenario placement", () => {
    const architecture = deriveGameplayArchitectureNavigation(
      baseGraph(),
      {
        relevantSourceCount: 3,
        indexedSourceCount: 3,
        arenaDetected: true,
        arenaCount: 3,
        arenaCountBasis: "reconciled",
        arenaLayoutStatus: "resolved",
        requestedConcurrentArenas: 3,
        safeConcurrentArenas: 2,
        replicaProof: [{
          arenaId: "arena:1",
          evidenceIds: ["native:a1", "native:a1"],
          status: "complete-proof",
        }, {
          arenaId: "arena:2",
          evidenceIds: ["native:a2"],
          status: "incomplete-proof",
        }],
        declaredConcurrentArenaLimit: 2,
        perArenaPlayerCapacity: 5,
        stateIsolationObservations: [{
          scriptId: "script:arena", region: "region:ready", key: "ready",
          status: "shared-global",
        }],
        chunkLeases: [{
          scriptId: "script:arena", leaseKey: "arena:lease",
          acquireRegions: ["region:setup"], releaseRegions: ["region:cleanup"],
          status: "paired",
        }],
        cleanupAssessments: [{
          scriptId: "script:arena", tableName: "sessionTable",
          status: "unresolved", missingPhases: ["cleanup"],
          orderingViolations: [],
        }],
      },
    );
    expect(architecture.knowledgeCoverage.arenaEvidence).toEqual({
      detected: true,
      count: 3,
      countBasis: "reconciled",
      layoutStatus: "resolved",
      spatialLayoutEntries: [],
      spatialLayoutConfidence: null,
      arenaRegionCandidates: [],
      spatialArenaIdsWithoutRegionCandidates: [],
      arenasWithoutSpatialLayoutCount: 3,
      spatialArenaIdsWithoutReplicaProof: [],
      arenaEvidenceComponentLinks: [],
      spatialArenaIdsWithoutComponentLinks: [],
      duplicateReplicaProofArenaIds: [],
      replicaProofEntries: [
        { arenaId: "arena:1", evidenceIds: ["native:a1"], proofStatus: "complete-proof" },
        { arenaId: "arena:2", evidenceIds: ["native:a2"], proofStatus: "incomplete-proof" },
      ],
      entityPopulationProofEntries: [],
      actorPopulationProofEntries: [],
      populationArenaIdsWithoutReplicaProof: [],
      arenasWithoutReplicaProofCount: 1,
      declaredConcurrentArenaLimit: 2,
      requestedConcurrentArenas: 3,
      safeConcurrentArenas: 2,
      perArenaPlayerCapacity: 5,
      architectureMapping: "NOT_YET_RECONCILED",
      stateIsolationObservations: [{
        scriptId: "script:arena", region: "region:ready", key: "ready",
        status: "shared-global",
      }],
      chunkLeases: [{
        scriptId: "script:arena", leaseKey: "arena:lease",
        acquireRegions: ["region:setup"], releaseRegions: ["region:cleanup"],
        status: "paired",
      }],
      cleanupAssessments: [{
        scriptId: "script:arena", tableName: "sessionTable",
        status: "unresolved", missingPhases: ["cleanup"],
        orderingViolations: [],
      }],
      arenaSessionMapping: "NOT_YET_ESTABLISHED",
      spatialArenaIdsWithoutSessionOwnershipProof: [],
    });
    expect(architecture.knowledgeCoverage.wholeGameUnderstandingPercent).toBeNull();
  });


  it("accounts for selected-artifact intent evidence without hiding unlinked sources", () => {
    const graph: GameplayScenarioGraph = {
      ...baseGraph(),
      components: [{
        id: "component:entry",
        label: "Entry",
        kind: "mechanic",
        technicalRole: "entry",
        gameplayPurpose: "Join",
        evidenceIds: ["evidence:join", "semantic-ir:operation"],
        usedByScenarioIds: [],
        orphan: false,
      }],
    };
    const architecture = deriveGameplayArchitectureNavigation(graph, {
      relevantSourceCount: 2,
      indexedSourceCount: 2,
      arenaDetected: false,
      selectedArtifactEvidenceIds: ["evidence:join", "evidence:shop"],
      allIntentEvidenceIds: ["evidence:join", "evidence:shop"],
    });
    expect(architecture.evidenceCoverage).toEqual({
      selectedArtifactEvidenceCount: 2,
      architectureLinkedEvidenceIds: ["evidence:join"],
      architectureUnlinkedEvidenceIds: ["evidence:shop"],
      architectureEvidenceWithoutIntentRecordIds: ["semantic-ir:operation"],
      selectedArtifactEvidenceLinkPercent: 50,
    });
  });




  it("exposes only region candidates with known offsets, not arena ownership", () => {
    const result = deriveGameplayArchitectureNavigation(baseGraph(), {
      relevantSourceCount: 1, indexedSourceCount: 1, arenaDetected: true,
      arenaCount: 3,
      spatialLayout: {
        canonical: { arenaId: "arena:1", anchor: { x: 0, y: 64, z: 0 } },
        replicas: [
          { arenaId: "arena:2", anchor: { x: 100, y: 64, z: 0 } },
          { arenaId: "arena:3", anchor: { x: 200, y: 64, z: 0 } },
        ],
        offsets: [{ x: 100, y: 0, z: 0 }],
        confidence: "medium",
      },
      regionPlan: {
        confidence: "low",
        volumes: [{ min: { x: 1, y: 64, z: 2 }, max: { x: 5, y: 67, z: 6 }, evidenceCandidateIds: ["candidate:1"] }],
      },
    }).knowledgeCoverage.arenaEvidence;
    expect(result.arenaRegionCandidates.map((item) => item.arenaId)).toEqual(["arena:1", "arena:2"]);
    expect(result.arenaRegionCandidates[1]?.volumes[0]?.min).toEqual({ x: 101, y: 64, z: 2 });
    expect(result.spatialArenaIdsWithoutRegionCandidates).toEqual(["arena:3"]);
    expect(result.arenaEvidenceComponentLinks).toEqual([]);
    expect(result.arenaSessionMapping).toBe("NOT_YET_ESTABLISHED");
  });


  it("does not manufacture arena region candidates when no region plan exists", () => {
    const result = deriveGameplayArchitectureNavigation(baseGraph(), {
      relevantSourceCount: 1,
      indexedSourceCount: 1,
      arenaDetected: true,
      arenaCount: 2,
      spatialLayout: {
        canonical: { arenaId: "arena:1", anchor: { x: 0, y: 64, z: 0 } },
        replicas: [{ arenaId: "arena:2", anchor: { x: 100, y: 64, z: 0 } }],
        offsets: [{ x: 100, y: 0, z: 0 }],
        confidence: "high",
      },
    }).knowledgeCoverage.arenaEvidence;
    expect(result.arenaRegionCandidates).toEqual([]);
    expect(result.spatialArenaIdsWithoutRegionCandidates).toEqual(["arena:1", "arena:2"]);
    expect(result.arenaSessionMapping).toBe("NOT_YET_ESTABLISHED");
  });

  it("does not manufacture spatial arena identities from a region plan alone", () => {
    const result = deriveGameplayArchitectureNavigation(baseGraph(), {
      relevantSourceCount: 1,
      indexedSourceCount: 1,
      arenaDetected: true,
      arenaCount: 2,
      regionPlan: {
        confidence: "high",
        volumes: [{
          min: { x: 0, y: 64, z: 0 },
          max: { x: 20, y: 80, z: 20 },
          evidenceCandidateIds: ["topology:region-1"],
        }],
      },
    }).knowledgeCoverage.arenaEvidence;
    expect(result.spatialLayoutEntries).toEqual([]);
    expect(result.arenaRegionCandidates).toEqual([]);
    expect(result.arenasWithoutSpatialLayoutCount).toBe(2);
    expect(result.arenaSessionMapping).toBe("NOT_YET_ESTABLISHED");
  });

  it("keeps arena-to-session ownership unproven even with arena and lifecycle evidence", () => {
    const result = deriveGameplayArchitectureNavigation(baseGraph(), {
      relevantSourceCount: 1, indexedSourceCount: 1, arenaDetected: true,
      arenaCount: 2,
      spatialLayout: {
        canonical: { arenaId: "arena:1", anchor: { x: 0, y: 64, z: 0 } },
        replicas: [{ arenaId: "arena:2", anchor: { x: 100, y: 64, z: 0 } }],
        confidence: "high",
      },
      replicaProof: [{ arenaId: "arena:1", evidenceIds: ["proof:a"], status: "complete-proof" }],
      stateIsolationObservations: [
        { scriptId: "script:game", region: "region:session", key: "players", status: "isolated" },
      ],
      cleanupAssessments: [
        { scriptId: "script:game", tableName: "sessions", status: "complete", missingPhases: [], orderingViolations: [] },
      ],
    }).knowledgeCoverage.arenaEvidence;
    expect(result.arenaSessionMapping).toBe("NOT_YET_ESTABLISHED");
    expect(result.spatialArenaIdsWithoutSessionOwnershipProof).toEqual(["arena:1", "arena:2"]);
  });

  it("links arena proof to gameplay components only through exact shared evidence IDs", () => {
    const graph: GameplayScenarioGraph = {
      ...baseGraph(),
      components: [{
        id: "component:arena-objective",
        label: "Objective",
        kind: "objective",
        technicalRole: "flag",
        gameplayPurpose: "Protect objective",
        evidenceIds: ["evidence:arena-1", "evidence:other"],
        usedByScenarioIds: [],
        orphan: false,
      }],
    };
    const layout = {
      canonical: { arenaId: "arena:1", anchor: { x: 0, y: 64, z: 0 } },
      replicas: [{ arenaId: "arena:2", anchor: { x: 200, y: 64, z: 0 } }],
      confidence: "medium" as const,
    };
    const observed = {
      relevantSourceCount: 1,
      indexedSourceCount: 1,
      arenaDetected: true,
      arenaCount: 2,
      spatialLayout: layout,
      replicaProof: [
        { arenaId: "arena:1", evidenceIds: ["evidence:arena-1"], status: "complete-proof" },
        { arenaId: "arena:2", evidenceIds: ["evidence:arena-2"], status: "bounded-proof" },
      ],
    };
    const architecture = deriveGameplayArchitectureNavigation(graph, observed);
    expect(architecture.knowledgeCoverage.arenaEvidence).toMatchObject({
      arenaEvidenceComponentLinks: [{
        arenaId: "arena:1",
        componentIds: ["component:arena-objective"],
        matchedEvidenceIds: ["evidence:arena-1"],
      }],
      spatialArenaIdsWithoutComponentLinks: ["arena:2"],
      arenaSessionMapping: "NOT_YET_ESTABLISHED",
    });
    const noProof = deriveGameplayArchitectureNavigation(graph, {
      ...observed,
      replicaProof: [
        { arenaId: "arena:1", evidenceIds: ["other-source:arena-1"], status: "complete-proof" },
      ],
    });
    expect(noProof.knowledgeCoverage.arenaEvidence.arenaEvidenceComponentLinks).toEqual([]);
    expect(noProof.knowledgeCoverage.arenaEvidence.spatialArenaIdsWithoutComponentLinks)
      .toEqual(["arena:1", "arena:2"]);
  });

  it("keeps physical arena coordinates distinct from replica proof and session inference", () => {
    const architecture = deriveGameplayArchitectureNavigation(baseGraph(), {
      relevantSourceCount: 1,
      indexedSourceCount: 1,
      arenaDetected: true,
      arenaCount: 3,
      spatialLayout: {
        canonical: { arenaId: "arena:1", anchor: { x: 0, y: 64, z: 0 } },
        replicas: [{ arenaId: "arena:2", anchor: { x: 300, y: 64, z: 0 } }],
        confidence: "medium",
      },
      replicaProof: [
        { arenaId: "arena:2", evidenceIds: ["native:arena2"], status: "bounded-proof" },
      ],
    });
    expect(architecture.knowledgeCoverage.arenaEvidence).toMatchObject({
      count: 3,
      spatialLayoutEntries: [
        { arenaId: "arena:1", role: "canonical", anchor: { x: 0, y: 64, z: 0 } },
        { arenaId: "arena:2", role: "replica", anchor: { x: 300, y: 64, z: 0 } },
      ],
      spatialLayoutConfidence: "medium",
      arenasWithoutSpatialLayoutCount: 1,
      spatialArenaIdsWithoutReplicaProof: ["arena:1"],
      arenaSessionMapping: "NOT_YET_ESTABLISHED",
    });
    expect(architecture.knowledgeCoverage.wholeGameUnderstandingPercent).toBeNull();
  });

  it("preserves per-arena entity and actor population evidence without inventing gameplay", () => {
    const architecture = deriveGameplayArchitectureNavigation(baseGraph(), {
      relevantSourceCount: 1,
      indexedSourceCount: 1,
      arenaDetected: true,
      arenaCount: 2,
      replicaProof: [{
        arenaId: "arena:1", status: "complete-proof", evidenceIds: ["world:arena-1"],
      }],
      entityPopulationProof: [{
        arenaId: "arena:1", status: "diverged",
        canonicalSpawns: 4, replicaSpawns: 2,
        unresolvedSpawns: 1, mismatches: [{ kind: "missing", signature: "abc" }],
      }],
      actorPopulationProof: [{
        arenaId: "arena:2", status: "incomplete",
        canonicalActors: 3, replicaActors: 1, mismatchCount: 1,
      }],
    });
    expect(architecture.knowledgeCoverage.arenaEvidence).toMatchObject({
      entityPopulationProofEntries: [{
        arenaId: "arena:1", status: "diverged",
        canonicalSpawns: 4, replicaSpawns: 2,
        unresolvedSpawns: 1, mismatchCount: 1,
      }],
      actorPopulationProofEntries: [{
        arenaId: "arena:2", status: "incomplete",
        canonicalActors: 3, replicaActors: 1, mismatchCount: 1,
      }],
      populationArenaIdsWithoutReplicaProof: ["arena:2"],
      architectureMapping: "NOT_YET_RECONCILED",
    });
    expect(architecture.knowledgeCoverage.wholeGameUnderstandingPercent).toBeNull();
  });

  it("summarizes observed architecture gaps without pretending whole-game completion", () => {
    const graph: GameplayScenarioGraph = {
      ...baseGraph(),
      components: [{
        id: "component:known",
        label: "Known",
        kind: "mechanic",
        technicalRole: "entry",
        gameplayPurpose: "Join",
        evidenceIds: ["evidence:known"],
        usedByScenarioIds: [],
        orphan: false,
      }],
    };
    const navigation = deriveGameplayArchitectureNavigation(graph, {
      relevantSourceCount: 4,
      indexedSourceCount: 3,
      arenaDetected: true,
      arenaCount: 6,
      selectedArtifactEvidenceIds: ["evidence:known", "evidence:unlinked"],
      semanticIr: {
        // Keep the required Semantic IR state registry present even for a
        // synthetic evidence-accounting-only fixture.
        state: { surfaces: [], authorityBindings: [], operations: [
          { id: "operation:unlinked", operation: "read",
            executionRegionId: "region:unlinked", surfaceId: "surface:unlinked",
            source: { artifactId: "synthetic:coverage", relativePath: "scripts/source.js" } },
        ] },
        execution: { regions: [], edges: [] },
        temporal: { relations: [] },
      } as unknown as import("../../../semantic-ir/src/index.js").SemanticIr,
      systemObservations: [{
        system: "ENTITY", observedCount: 2,
        observationReferences: ["minecraft:pillager"],
      }],
    });
    expect(navigation.architectureReconciliation).toEqual({
      scope: "OBSERVED_RECORDS_ONLY",
      status: "GAPS_PRESENT",
      sourceIndexIncomplete: true,
      gameplayIntentEvidenceUnlinkedCount: 1,
      semanticIrRecordsUnlinkedCount: 1,
      scenarioComponentsUnplacedCount: 1,
      causalLinksUnresolvedCount: 0,
      graphReferencesMissingCount: 0,
      arenaMappingUnresolved: true,
      observedSystemsUnreconciledCount: 1,
      // Preserve the current exact source-relationship and rooted-flow
      // coverage counts, even when this synthetic fixture observes none.
      behaviorFlowsUnmodeledCount: 0,
      behaviorFlowsPartiallyModeledCount: 0,
      behaviorFlowsPlacedUnprovenCount: 0,
      observedOutcomesWithoutEntryCount: 0,
      observedSourceRelationshipCount: 0,
      sourceRelationshipsWithoutProofCount: 0,
    });
    expect(navigation.knowledgeCoverage.wholeGameUnderstandingPercent).toBeNull();

    const scoped = deriveGameplayArchitectureNavigation({
      ...baseGraph(),
      scenarios: [{
        id: "scenario:join", label: "Join", gameplayStage: "ENTRY_JOIN",
        purpose: "Enter", sourceSubjectIds: [],
        componentIds: ["component:known"], causalLinkIds: [],
        playerCounts: [1], requiredKnowledgeIds: [], composedScenarioIds: [],
      }],
      components: graph.components,
    }, {
      relevantSourceCount: 1,
      indexedSourceCount: 1,
      arenaDetected: false,
      selectedArtifactEvidenceIds: ["evidence:known"],
    });
    expect(scoped.architectureReconciliation.status)
      .toBe("NO_GAPS_IN_MEASURED_SCOPE");
    expect(scoped.knowledgeCoverage.wholeGameUnderstandingPercent).toBeNull();
  });

  it("accounts for raw Semantic IR operations and execution without inventing architectural links", () => {
    const graph: GameplayScenarioGraph = {
      ...baseGraph(),
      components: [{
        id: "component:objective",
        label: "Objective",
        kind: "state",
        technicalRole: "objective",
        gameplayPurpose: "Track objective",
        evidenceIds: ["op:objective", "edge:resolved"],
        usedByScenarioIds: [],
        orphan: false,
      }],
    };
    const semanticIr = {
      schemaVersion: 1,
      state: {
        surfaces: [], authorityBindings: [],
        operations: [
          { id: "op:objective", operation: "read",
            executionRegionId: "region:main", surfaceId: "surface:objective",
            source: { artifactId: "synthetic:coverage", relativePath: "scripts/source.js" } },
          { id: "op:unmapped", operation: "read",
            executionRegionId: "region:main", surfaceId: "surface:unknown",
            source: { artifactId: "synthetic:coverage", relativePath: "scripts/source.js" } },
        ],
      },
      execution: {
        regions: [{ id: "region:main" }],
        edges: [{ id: "edge:resolved" }, { id: "edge:unresolved" }],
      },
      temporal: {
        relations: [{ id: "timer:late" }],
      },
    } as unknown as import("../../../semantic-ir/src/index.js").SemanticIr;
    const navigation = deriveGameplayArchitectureNavigation(graph, {
      relevantSourceCount: 1,
      indexedSourceCount: 1,
      arenaDetected: false,
      semanticIr,
    });
    expect(navigation.semanticIrCoverage).toEqual({
      observedSourceRelationships: [],
      untracedReturnOutcomeIds: [],
      stateOutcomeCandidates: [],
      resourceOutcomeCandidates: [],
      executionTraces: [],
      regionsOutsideTraces: ["region:main"],
      resourceActions: { observedCount: 0, linkedIds: [], unlinkedIds: [] },
      returnOutcomes: { observedCount: 0, linkedIds: [], unlinkedIds: [] },
      worldEffects: { observedCount: 0, linkedIds: [], unlinkedIds: [] },
      stateOperations: {
        observedCount: 2,
        linkedIds: ["op:objective"],
        unlinkedIds: ["op:unmapped"],
      },
      executionRegions: {
        observedCount: 1,
        linkedIds: [],
        unlinkedIds: ["region:main"],
      },
      executionEdges: {
        observedCount: 2,
        linkedIds: ["edge:resolved"],
        unlinkedIds: ["edge:unresolved"],
      },
      temporalRelations: {
        observedCount: 1,
        linkedIds: [],
        unlinkedIds: ["timer:late"],
      },
    });
    expect(navigation.knowledgeCoverage.wholeGameUnderstandingPercent).toBeNull();
  });

  it("links a system to graph components only on exact evidence identity", () => {
    const graph: GameplayScenarioGraph = {
      ...baseGraph(),
      components: [{
        id: "component:shop",
        label: "Shop",
        kind: "mechanic",
        technicalRole: "economy",
        gameplayPurpose: "Purchases",
        evidenceIds: ["evidence:purchase"],
        usedByScenarioIds: [],
        orphan: false,
      }],
    };
    const architecture = deriveGameplayArchitectureNavigation(graph, {
      relevantSourceCount: 1,
      indexedSourceCount: 1,
      arenaDetected: false,
      systemObservations: [{
        system: "ECONOMY",
        observedCount: 2,
        observationReferences: ["script:shop"],
        evidenceIds: ["evidence:purchase", "evidence:unmatched"],
      }],
    });
    expect(architecture.systemInventory[0]).toMatchObject({
      inventoryStatus: "OBSERVED",
      evidenceLinkedComponentIds: ["component:shop"],
      unmatchedEvidenceIds: ["evidence:unmatched"],
      architectureMapping: "EVIDENCE_LINKED",
    });
    expect(architecture.knowledgeCoverage.wholeGameUnderstandingPercent).toBeNull();
    const unverified = deriveGameplayArchitectureNavigation(graph, {
      relevantSourceCount: 1,
      indexedSourceCount: 1,
      arenaDetected: false,
      systemObservations: [{
        system: "ECONOMY",
        observedCount: 1,
        observationReferences: ["evidence:purchase"],
      }],
    });
    expect(unverified.systemInventory[0]).toMatchObject({
      evidenceLinkedComponentIds: [],
      architectureMapping: "NOT_YET_RECONCILED",
    });
  });
});
