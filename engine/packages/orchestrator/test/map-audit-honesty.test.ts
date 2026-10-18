import { describe, expect, it } from "vitest";
import {
  assessAuditHonesty,
} from "../src/map-audit-honesty.js";
import type {
  GameplayScenarioGraph,
} from "../src/inspection/gameplay-scenario-model.js";
import type {
  GameplayDefectResolutionGate,
} from "../src/inspection/gameplay-defect-resolution.js";
import type {
  AuditIssueProjection,
} from "../src/map-audit-issue-projection.js";

const graph: GameplayScenarioGraph = {
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
    purpose: "Enemy remains simulated until completion.",
    evidenceIds: ["e:entity"],
    subjectIds: ["objective:wave"],
    componentIds: ["runtime:entities"],
    knowledgeRequirementIds: [],
    impactPathComponentIds: [],
    impactPathEvidenceIds: [],
    dimensionEvidence: {},
    status: "RUNTIME_BLOCKED",
    reason: "Runtime residency is unresolved.",
  }],
  knowledgeRequirements: [],
  knowledgeReceipts: [],
  requiredInspectionGraph: {
    policy: "required-inspection-graph",
    nodes: [],
    receipts: [],
  },
};

const gate: GameplayDefectResolutionGate = {
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
};

const closure = {
  status: "CLOSED" as const,
  surfaces: [],
  unaccountedSurfaceIds: [],
  blockingSurfaceIds: [],
  unknownSurfaceIds: [],
  stateModelComplete: true,
  boundariesExtracted: true,
  reasons: [],
};

function visibleRuntimeFinding(): AuditIssueProjection {
  return {
    status: "NEED_VALIDATION",
    issueType: "BUG",
    failureDomain: "progression-wave-objective",
    contributingDomains: [
      "progression-wave-objective",
    ],
    gameplayFlow: "PROGRESSION",
    informationMismatch: false,
    playerFacingEvidenceIds: [],
    causalLinkId: "link:wave",
    scenarioId: "scenario:wave",
    gameplayStage: "PROGRESSION",
    scenarioLabel: "wave",
    gameplayTrigger: "Complete the wave.",
    gameplayConsequence: "Wave may block.",
    expectedOutcome:
      "Enemy remains simulated until completion.",
    actualOutcome:
      "Runtime residency is unresolved.",
    affectedScope: "objective:wave",
    subjectIds: ["objective:wave"],
    componentIds: ["runtime:entities"],
    evidenceIds: ["e:entity"],
    validationReason: "Runtime proof required.",
    missingProof: "Observed runtime residency.",
    validationTest:
      "Run the wave and observe the remote enemy.",
    validationGroupKey:
      "scenario:wave:chunk-simulation",
  };
}

describe("map audit honesty gate", () => {
  it("retains runtime-blocked residue but refuses PASS while capability delivery is unassessed", () => {
    const result = assessAuditHonesty({
      graph,
      gate,
      gameplayClosure: closure,
      capabilityDelivery: [],
      negativeSpace: [],
      temporalRisks: [],
      discoveryChallenges: [],
      sharedResourceSignals: [],
      compoundBoundaries: [],
      accumulationGrowth: [],
      visibleIssues: [],
      visibleObligationIds: ["link:wave"],
    });

    expect(result.status).toBe("VIOLATION");
    expect(result.visibleNeedValidationIds).toEqual([]);
    expect(result.visibleObligationIds).toEqual([
      "link:wave",
    ]);
    expect(
      result.missingVisibleResidueIds,
    ).toEqual(["capability-delivery:unassessed"]);
  });

  it("keeps unsaturated resolution as residue and blocks unassessed delivery", () => {
    const contradictedGraph: GameplayScenarioGraph = {
      ...graph,
      causalLinks: [{
        ...graph.causalLinks[0]!,
        status: "CONTRADICTED",
        reason: "Wave accounting can advance incorrectly.",
      }],
    };
    const unsaturatedGate: GameplayDefectResolutionGate = {
      ...gate,
      contradictedCausalLinkIds: ["link:wave"],
      confirmedDefectReadyIds: ["link:wave"],
      resolutions: [{
        causalLinkId: "link:wave",
        scenarioId: "scenario:wave",
        disposition: "CONFIRMED_DEFECT_READY",
        gameplayTrigger: "Complete the wave.",
        gameplayConsequence: "Wave progression may be wrong.",
        expectedOutcome:
          "Enemy remains accounted until completion.",
        actualOutcome:
          "Wave accounting can advance incorrectly.",
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
        dimensionReceipts: [
          {
            dimension: "guard",
            scopeIds: ["objective:wave"],
            evidenceIds: ["e:entity"],
            exhaustiveWithinScope: false,
          },
          {
            dimension: "scope",
            scopeIds: ["objective:wave"],
            evidenceIds: ["e:entity"],
            exhaustiveWithinScope: false,
          },
          {
            dimension: "exclusion",
            scopeIds: ["objective:wave"],
            evidenceIds: ["e:entity"],
            exhaustiveWithinScope: false,
          }
        ],
        scopeIds: ["objective:wave"],
          evidenceIds: ["e:entity"],
          exhaustiveWithinScope: false,
          conclusion: "NO_BLOCKING_PROOF",
        },
      }],
    };
    const visible = {
      ...visibleRuntimeFinding(),
      validationReason:
        "Family-specific proof remains incomplete.",
      missingProof:
        "Family proof criteria remain unresolved.",
    };

    const result = assessAuditHonesty({
      graph: contradictedGraph,
      gate: unsaturatedGate,
      gameplayClosure: closure,
      capabilityDelivery: [],
      negativeSpace: [],
      temporalRisks: [],
      discoveryChallenges: [],
      sharedResourceSignals: [],
      compoundBoundaries: [],
      accumulationGrowth: [],
      visibleIssues: [visible],
    });

    expect(result.status).toBe("VIOLATION");
    expect(result.expectedProvenIds).toEqual([]);
    expect(result.expectedVisibleResidueIds).toContain(
      "link:wave",
    );
  });

  it("rejects unexpected PROVEN findings even when all real residue is visible", () => {
    const visibleObligationIds = [
      "capability-delivery:unassessed",
      "link:wave",
    ];
    const assess = (visibleIssues: readonly AuditIssueProjection[]) =>
      assessAuditHonesty({
        graph,
        gate,
        gameplayClosure: closure,
        capabilityDelivery: [],
        negativeSpace: [],
        temporalRisks: [],
        discoveryChallenges: [],
        sharedResourceSignals: [],
        compoundBoundaries: [],
        accumulationGrowth: [],
        visibleIssues,
        visibleObligationIds,
      });

    expect(assess([]).status).toBe("PASS");
    for (const causalLinkId of ["foreign-link", "link:wave"]) {
      const result = assess([{
        ...visibleRuntimeFinding(),
        status: "PROVEN",
        causalLinkId,
      }]);
      expect(result.status, causalLinkId).toBe("VIOLATION");
      expect(result.expectedProvenIds).toEqual([]);
      expect(result.reasons.join(" "), causalLinkId).toContain(causalLinkId);
    }
  });

  it("requires unresolved Knowledge receipt gaps to remain visible", () => {
    const requirement = {
      id: "knowledge:wave:state",
      scenarioId: "scenario:wave",
      domain: "state-flow" as const,
      reason: "State evidence required.",
      capabilityIds: ["state-flow"],
      dependsOnRequirementIds: [],
      subjectIds: ["objective:wave"],
      componentIds: ["runtime:entities"],
    };
    const requiredGraph = {
      ...graph,
      knowledgeRequirements: [requirement],
      knowledgeReceipts: [],
    };
    const baseInput = {
      graph: requiredGraph, gate, gameplayClosure: closure,
      capabilityDelivery: [], negativeSpace: [], temporalRisks: [],
      discoveryChallenges: [], sharedResourceSignals: [],
      compoundBoundaries: [], accumulationGrowth: [],
      visibleIssues: [],
    };
    const visible = ["link:wave", "capability-delivery:unassessed"];
    const hidden = assessAuditHonesty({
      ...baseInput, visibleObligationIds: visible,
    });
    expect(hidden.status).toBe("VIOLATION");
    expect(hidden.missingVisibleResidueIds).toContain(
      "knowledge-gap:knowledge:wave:state",
    );
    const accounted = assessAuditHonesty({
      ...baseInput,
      visibleObligationIds: [...visible, "knowledge-gap:knowledge:wave:state"],
    });
    expect(accounted.missingVisibleResidueIds).toEqual([]);
    expect(accounted.status).toBe("PASS");
  });

  it("retains a detached SATISFIED receipt as material residue", () => {
    const receipt = {
      requirementId: "knowledge:orphan",
      scenarioId: "scenario:elsewhere",
      domain: "state-flow" as const,
      status: "SATISFIED" as const,
      evidenceIds: ["e:detached"],
      knowledgeIds: [],
      capabilityIdsUsed: [],
      subjectIds: [],
      componentIds: [],
      reason: "Missing requirement authority",
    };
    const input = {
      graph: {
        ...graph,
        knowledgeReceipts: [receipt],
      },
      gate, gameplayClosure: closure,
      capabilityDelivery: [], negativeSpace: [], temporalRisks: [],
      discoveryChallenges: [], sharedResourceSignals: [],
      compoundBoundaries: [], accumulationGrowth: [],
      visibleIssues: [],
    };
    const visibleBase = ["link:wave", "capability-delivery:unassessed"];
    const hidden = assessAuditHonesty({
      ...input, visibleObligationIds: visibleBase,
    });
    expect(hidden.status).toBe("VIOLATION");
    expect(hidden.missingVisibleResidueIds).toContain("knowledge-gap:knowledge:orphan");
    const conserved = assessAuditHonesty({
      ...input, visibleObligationIds: [...visibleBase, "knowledge-gap:knowledge:orphan"],
    });
    expect(conserved.missingVisibleResidueIds).toEqual([]);
    expect(conserved.status).toBe("PASS");
  });

  it("blocks review when a material unresolved residue is hidden", () => {
    const result = assessAuditHonesty({
      graph,
      gate,
      gameplayClosure: closure,
      capabilityDelivery: [],
      negativeSpace: [],
      temporalRisks: [],
      discoveryChallenges: [],
      sharedResourceSignals: [],
      compoundBoundaries: [],
      accumulationGrowth: [],
      visibleIssues: [],
    });

    expect(result.status).toBe("VIOLATION");
    expect(
      result.missingVisibleResidueIds,
    ).toEqual(["capability-delivery:unassessed", "link:wave"]);
  });
});
