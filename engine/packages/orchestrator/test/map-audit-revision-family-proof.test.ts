import { describe, expect, it } from "vitest";
import {
  deriveSelectedMapAuditRevision,
} from "../src/map-audit-revision.js";
import {
  createFallbackAuditUserIntent,
} from "../src/map-audit-user-intent.js";

describe("selected-map audit revision freshness", () => {
  it("invalidates stale model responses when reviewed unknown source scope changes", () => {
    const base: any = {
      identity: { artifactId: "map:selected", artifactFingerprint: "sha" },
      admission: { status: "BLOCKED", issues: [] },
      procedure: { status: "PARTIAL", checkpoints: [], blockingCheckpointIds: [] },
      graph: {
        scenarios: [], components: [], causalLinks: [],
        knowledgeRequirements: [], knowledgeReceipts: [],
        reviewedSourceRelationships: [],
      },
      defectResolution: { resolutions: [] },
    };
    const first = deriveSelectedMapAuditRevision(base);
    const second = deriveSelectedMapAuditRevision({
      ...base,
      graph: { ...base.graph, reviewedSourceRelationships: [{
        unknownId: "unknown:alpha", sourceEntryRegionId: "exec:alpha",
        sourceClaim: "SOURCE_EFFECT_RETURN_CANDIDATE",
        fromStepId: "effect:one", toStepId: "return:one",
        evidenceIds: ["effect:one", "return:one"],
        proofBoundary: "REVIEWED_TYPED_SOURCE_RELATION_NOT_GAMEPLAY_OR_RUNTIME_PROOF",
      }] },
    });
    expect(second).not.toBe(first);
  });

  it("changes when family proof changes", () => {
    const base: any = {
      identity: {
        artifactId: "artifact",
        artifactFingerprint: "fingerprint",
      },
      admission: {
        policy: "selected-map-audit-ordered-admission",
        status: "READY",
        issues: [],
      },
      procedure: {
        status: "CLOSED",
        blockingCheckpointIds: [],
        checkpoints: [],
      },
      graph: {
        scenarios: [],
        components: [],
        causalLinks: [],
        knowledgeRequirements: [],
        knowledgeReceipts: [],
      },
      defectResolution: {
        resolutions: [{
          causalLinkId: "link:1",
          disposition: "CONFIRMED_DEFECT_READY",
          familyProof: {
            schemaVersion: 1,
            policy: "family-proof-receipt",
            failureDomain: "state-ownership",
            criteria: [{
              id: "state-owner-grounded",
              satisfied: false,
              evidenceIds: [],
            }],
          },
        }],
      },
    };

    const before = deriveSelectedMapAuditRevision(base);
    const after = deriveSelectedMapAuditRevision({
      ...base,
      defectResolution: {
        resolutions: [{
          ...base.defectResolution.resolutions[0],
          familyProof: {
            ...base.defectResolution.resolutions[0].familyProof,
            criteria: [{
              id: "state-owner-grounded",
              satisfied: true,
              evidenceIds: ["e:owner"],
            }],
          },
        }],
      },
    });

    expect(after).not.toBe(before);
  });

  it("binds the current operator investigation scope, not user claims as gameplay proof", () => {
    const core: any = {
      identity: { artifactId: "same-map", artifactFingerprint: "sha:stable" },
      admission: { status: "BLOCKED", firstBlockingStage: "PROVE", issues: [] },
      procedure: { status: "PARTIAL", checkpoints: [],
        blockingCheckpointIds: ["D3"] },
      graph: { scenarios: [], components: [], causalLinks: [],
        knowledgeRequirements: [], knowledgeReceipts: [] },
      defectResolution: { status: "BLOCKED", resolutions: [],
        counterProofSearchRequiredIds: ["link:one"] },
    };
    const first = createFallbackAuditUserIntent(
      "Check arena capacity when a player reconnects.",
    );
    const same = createFallbackAuditUserIntent(
      "Check   arena capacity when a player reconnects. ",
    );
    const changed = createFallbackAuditUserIntent(
      "Check stage progression after a world reload.",
    );
    const firstRevision = deriveSelectedMapAuditRevision({
      ...core, userIntent: first,
    });
    expect(firstRevision).toBe(deriveSelectedMapAuditRevision({
      ...core, userIntent: same,
    }));
    expect(firstRevision).not.toBe(deriveSelectedMapAuditRevision(core));
    expect(firstRevision).not.toBe(deriveSelectedMapAuditRevision({
      ...core, userIntent: changed,
    }));
  });

  it("invalidates unchanged-ID checkpoint task text and Defect Resolution routing", () => {
    const base: any = {
      identity: { artifactId: "art_same", artifactFingerprint: "sha256:same" },
      admission: { status: "BLOCKED", firstBlockingStage: "PROVE", issues: [] },
      procedure: {
        status: "PARTIAL",
        blockingCheckpointIds: ["D1"],
        checkpoints: [{
          id: "D1", block: "PROVE", status: "PARTIAL",
          reasonCode: "KNOWLEDGE_GAP", blocksPublication: true,
          label: "Required Knowledge evidence",
          reason: "State ownership unresolved.",
          evidenceIds: ["e:initial"],
          outputIds: ["RequiredInspectionGraph"],
          obligations: [{
            id: "rig:state", required: true, satisfied: false,
            evidenceIds: ["e:initial"], reason: "Need decisive state owner.",
          }],
        }],
      },
      graph: {
        scenarios: [], components: [], causalLinks: [],
        knowledgeRequirements: [], knowledgeReceipts: [],
      },
      defectResolution: {
        status: "BLOCKED", resolutions: [],
        contradictedCausalLinkIds: [],
        confirmedDefectReadyIds: [],
        blockingCounterProofIds: [],
        runtimeProofRequiredIds: [],
        detectionGapIds: ["link:state"],
        gameplayTranslationRequiredIds: [],
        counterProofSearchRequiredIds: [],
        issues: [],
      },
    };
    const original = deriveSelectedMapAuditRevision(base);
    const updates: any[] = [
      { ...base, procedure: {
        ...base.procedure,
        checkpoints: [{ ...base.procedure.checkpoints[0],
          reason: "Different unresolved owner.",
        }],
      } },
      { ...base, procedure: {
        ...base.procedure,
        checkpoints: [{ ...base.procedure.checkpoints[0],
          label: "Revised Knowledge checkpoint",
        }],
      } },
      { ...base, procedure: {
        ...base.procedure,
        checkpoints: [{ ...base.procedure.checkpoints[0],
          obligations: [{ ...base.procedure.checkpoints[0].obligations[0],
            reason: "Different deciding proof requirement.",
          }],
        }],
      } },
      { ...base, defectResolution: {
        ...base.defectResolution,
        detectionGapIds: [],
        counterProofSearchRequiredIds: ["link:state"],
      } },
      { ...base, defectResolution: {
        ...base.defectResolution, status: "READY_FOR_PROPOSED_BUG_SET",
      } },
    ];
    for (const candidate of updates) {
      expect(deriveSelectedMapAuditRevision(candidate))
        .not.toBe(original);
    }
  });

  it("invalidates stale model responses when causal/knowledge scope changes without changing link IDs", () => {
    const base: any = {
      identity: {
        artifactId: "artifact", artifactFingerprint: "fingerprint",
      },
      admission: { status: "READY", issues: [] },
      procedure: { status: "CLOSED", blockingCheckpointIds: [], checkpoints: [] },
      graph: {
        scenarios: [{
          id: "scenario:1", label: "Entry", gameplayStage: "JOIN",
          purpose: "Start", sourceSubjectIds: ["player:1"],
          componentIds: ["component:1"], causalLinkIds: ["link:1"],
          playerCounts: [1], requiredKnowledgeIds: ["knowledge:1"],
          composedScenarioIds: [],
        }],
        components: [{
          id: "component:1", label: "Arena", kind: "runtime-domain",
          technicalRole: "admission", gameplayPurpose: "Enter the arena",
          evidenceIds: ["e:source"], usedByScenarioIds: ["scenario:1"],
          orphan: false,
        }],
        causalLinks: [{
          id: "link:1", scenarioId: "scenario:1",
          fromComponentId: "component:1", toComponentId: "component:1",
          purpose: "Admission", status: "CONTRADICTED",
          evidenceIds: ["e:source"], subjectIds: ["player:1"],
          componentIds: ["component:1"], knowledgeRequirementIds: ["knowledge:1"],
          impactPathComponentIds: ["component:1"],
          impactPathEvidenceIds: ["e:impact"],
          dimensionEvidence: { owner: ["e:owner"] }, reason: "State escapes scope",
        }],
        knowledgeRequirements: [{
          id: "knowledge:1", scenarioId: "scenario:1",
          domain: "state-flow", reason: "Admission owner",
          capabilityIds: ["capability:state"], dependsOnRequirementIds: [],
          subjectIds: ["player:1"], componentIds: ["component:1"],
        }],
        knowledgeReceipts: [{
          requirementId: "knowledge:1", scenarioId: "scenario:1",
          domain: "state-flow", status: "SATISFIED",
          evidenceIds: ["e:source"], knowledgeIds: ["fact:1"],
          capabilityIdsUsed: ["capability:state"],
          subjectIds: ["player:1"], componentIds: ["component:1"],
          reason: "Source grounded",
        }],
      },
      defectResolution: { resolutions: [] },
    };
    const original = deriveSelectedMapAuditRevision(base);
    const changedGraphs = [
      { ...base.graph, causalLinks: [{ ...base.graph.causalLinks[0],
        scenarioId: "scenario:2" }] },
      { ...base.graph, causalLinks: [{ ...base.graph.causalLinks[0],
        knowledgeRequirementIds: ["knowledge:2"] }] },
      { ...base.graph, causalLinks: [{ ...base.graph.causalLinks[0],
        impactPathEvidenceIds: ["e:different-impact"] }] },
      { ...base.graph, causalLinks: [{ ...base.graph.causalLinks[0],
        dimensionEvidence: { owner: ["e:different-owner"] } }] },
      { ...base.graph, knowledgeRequirements: [{ ...base.graph.knowledgeRequirements[0],
        dependsOnRequirementIds: ["knowledge:prerequisite"] }] },
      { ...base.graph, knowledgeReceipts: [{ ...base.graph.knowledgeReceipts[0],
        knowledgeIds: ["fact:2"] }] },
      { ...base.graph, scenarios: [{ ...base.graph.scenarios[0],
        causalLinkIds: [] }] },
    ];
    for (const graph of changedGraphs) {
      expect(deriveSelectedMapAuditRevision({ ...base, graph }))
        .not.toBe(original);
    }
  });
});
