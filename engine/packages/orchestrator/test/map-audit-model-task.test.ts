import { describe, expect, it } from "vitest";
import type { GameplayIntentModel } from "../../../packages/gameplay-intent/src/index.js";
import type { MandatoryAuditCheckpointReceipt } from "../src/inspection/mandatory-audit-procedure.js";
import {
  deriveAuditModelKnowledgeLookup,
  deriveAuditModelTaskPackets,
  selectCheckpointIntentSubjects,
} from "../src/map-audit-model-task.js";
import {
  applySelectedMapAuditModelResponses,
  type SelectedMapAuditRun,
} from "../src/map-audit-pipeline.js";
import {
  sourceBoundAuditEvidenceIds,
} from "../src/map-audit-proof-saturation.js";
import type {
  GameplayScenarioGraph,
} from "../src/inspection/gameplay-scenario-model.js";
import type {
  GameplayDefectResolutionGate,
} from "../src/inspection/gameplay-defect-resolution.js";
import {
  compileDeveloperPracticeReferenceContext,
  type DeveloperPracticeReferenceData,
} from "../src/workflow/resource-context.js";

describe("source-scoped UNDERSTAND checkpoint navigation", () => {
  const path = "behavior_packs/arena/scripts/round.ts";
  const intent: GameplayIntentModel = {
    schemaVersion: 1,
    id: "intent:selected",
    artifactId: "selected",
    evidence: [{
      id: "ev:phase", origin: "source-code", scope: "selected-artifact",
      locator: path + ":13:3", summary: "Authored round phase",
    }, {
      id: "ev:state", origin: "source-code", scope: "selected-artifact",
      locator: path + ":14:3", summary: "Dynamic property state",
    }, {
      id: "ev:actor", origin: "source-code", scope: "selected-artifact",
      locator: "behavior_packs/arena/scripts/actor.ts:6:2",
      summary: "Authored arena actor",
    }, {
      id: "ev:external", origin: "historical-diff", scope: "external-reference",
      locator: "previous-map/round.ts:1", summary: "Older map",
    }],
    nodes: [{
      id: "phase:ready", kind: "phase", label: "Active round",
      status: "authored", evidenceIds: ["ev:phase"],
    }, {
      id: "state:round", kind: "state", label: "Round persistent state",
      status: "authored", evidenceIds: ["ev:state"],
    }, {
      id: "actor:keeper", kind: "actor", label: "Arena keeper",
      status: "inferred", evidenceIds: ["ev:actor"],
    }, {
      id: "phase:old", kind: "phase", label: "Old round state",
      status: "authored", evidenceIds: ["ev:external"],
    }, {
      id: "phase:guess", kind: "phase", label: "Imagined round",
      status: "hypothesis", evidenceIds: ["ev:phase"],
    }],
    edges: [], invariants: [],
    unknowns: [{
      id: "unknown:state-owner", question: "Who owns round state?",
      blockedSubjectIds: ["state:round"], evidenceIds: ["ev:state"],
    }],
  };
  const checkpoint = (
    id: string,
    evidenceIds: readonly string[] = [],
    block: MandatoryAuditCheckpointReceipt["block"] = "UNDERSTAND",
    blocksPublication = true,
  ): MandatoryAuditCheckpointReceipt => ({
    id, block, label: "Scoped blocker", status: "OPEN",
    reasonCode: "OBLIGATION_INCOMPLETE", blocksPublication,
    evidenceIds, outputIds: [], obligations: [],
    reason: "Missing source-grounded interpretation",
  });

  it("routes A3-A6 only through selected-source subject kinds, with explicit provenance", () => {
    expect(selectCheckpointIntentSubjects(checkpoint("A3"), intent)).toEqual({
      subjectIds: ["phase:ready"],
      basis: "SOURCE_ROLE_CANDIDATE",
      omittedCandidates: 0,
    });
    const a4 = selectCheckpointIntentSubjects(checkpoint("A4"), intent);
    expect(a4.subjectIds).toEqual(["state:round"]);
    expect(a4.basis).toBe("SOURCE_ROLE_CANDIDATE");
    expect(selectCheckpointIntentSubjects(checkpoint("A5"), intent)
      .subjectIds).toEqual(["state:round", "actor:keeper"]);
    expect(selectCheckpointIntentSubjects(
      checkpoint("A4", ["ev:state"]), intent,
    ).basis).toBe("CHECKPOINT_EVIDENCE_LINK");
  });

  it("routes A7 only through exact source/unknown proof, never the full map", () => {
    expect(selectCheckpointIntentSubjects(checkpoint("A7"), intent)
      .subjectIds).toEqual([]);
    expect(selectCheckpointIntentSubjects(
      checkpoint("A7", ["unknown:state-owner"]), intent,
    )).toMatchObject({
      subjectIds: ["state:round"],
      basis: "CHECKPOINT_EVIDENCE_LINK",
    });
    expect(selectCheckpointIntentSubjects(
      checkpoint("A4", [], "DISCOVERY"), intent,
    ).subjectIds).toEqual([]);
    expect(selectCheckpointIntentSubjects(
      checkpoint("A4", [], "UNDERSTAND", false), intent,
    ).subjectIds).toEqual([]);
  });

  it("passes a checkpoint source candidate to typed IR-based developer retrieval", () => {
    const selection = selectCheckpointIntentSubjects(
      checkpoint("A4"), intent,
    );
    const lookup = deriveAuditModelKnowledgeLookup(
      intent, "Resolve persistent round state ownership", selection.subjectIds,
    );
    expect(lookup?.grounding).toBe("SELECTED_ARTIFACT");
    expect(lookup?.sourceEvidenceIds).toContain("ev:state");
    const data = {
      authority: "REFERENCE" as const,
      usagePolicy: "CONTEXT_HINT_ONLY_NOT_GAME_DESIGN_OR_DEFECT_PROOF" as const,
      sourceSnapshot: { archiveSha256: "a".repeat(64) },
      sourceFiles: [{
        id: "src.bedrock-data-persistence",
        path: "skills/bedrock-data-persistence/SKILL.md",
        sha256: "b".repeat(64),
        auditUsage: "INTERPRETATION_CANDIDATE",
        methodology: {
          applicability: "MAP_SOURCE_INTERPRETATION" as const,
          sourceSections: ["1. Source meaning", "2. Counterexample"],
          objective: "Identify the actual selected-map state owner.",
          investigationSteps: [
            "Inspect the exact selected source.",
            "Compare its intended behavior with an alternative explanation.",
          ],
          disconfirmingCase: "An intentional world-scope state key may be valid.",
          proofBoundary: "EXTERNAL_DEVELOPER_METHOD_NOT_SELECTED_MAP_BEHAVIOR_PROOF" as const,
        },
      }],
      patterns: [{
        id: "developer.hint.persistence.state-ownership",
        sourceId: "src.bedrock-data-persistence",
        kind: "IMPLEMENTATION_PATTERN", status: "SOURCE_REVIEWED",
        domains: ["state", "persistence"],
        sourceSignals: ["getDynamicProperty"],
        question: "Who owns the selected-map state?",
        candidateRelations: ["read/state-owner"],
        negativeControl: "An intentional world-scope key may be correct.",
        versionApplicability: "NOT_EVALUATED",
        prohibits: "Do not infer broken persistence from a read call.",
      }],
    };
    const ir = {
      schemaVersion: 1 as const,
      execution: { regions: [], edges: [] },
      state: {
        surfaces: [{
          id: "surface:round",
          ref: { kind: "dynamic-property" as const, key: "round" },
        }],
        operations: [{
          id: "state-op:round",
          executionRegionId: "exec:read",
          surfaceId: "surface:round",
          operation: "read" as const,
          source: { artifactId: "selected", relativePath: path,
            range: { lineStart: 14, lineEnd: 14,
              columnStart: 3, columnEnd: 16 } },
        }],
        authorityBindings: [],
      },
      temporal: { relations: [] },
    };
    const guidance = compileDeveloperPracticeReferenceContext({
      data, selectedArtifactId: "selected",
      semanticIr: ir,
      domains: ["state", "persistence"],
      ...(lookup?.sourceLocators === undefined ? {} : { sourceLocators: lookup.sourceLocators }),
    });
    expect(guidance?.items.map(item => item.patternId)).toEqual([
      "developer.hint.persistence.state-ownership",
    ]);
    expect(guidance?.items[0]?.matchingEvidenceIds).toContain("state-op:round");
    // A one-line bundle can contain different methods at different columns.
    // Do not attach the persistence hint to another position in that file.
    for (const sourceLocators of [
      [path + ":13:3"], [path + ":14:45"], [path + "#L15"],
      [path + "@otherMethod"],
    ]) {
      expect(compileDeveloperPracticeReferenceContext({
        data, selectedArtifactId: "selected", semanticIr: ir,
        domains: ["state", "persistence"], sourceLocators,
      })?.items ?? []).toHaveLength(0);
    }
    expect(compileDeveloperPracticeReferenceContext({
      data, selectedArtifactId: "selected", semanticIr: ir,
      domains: ["state"], sourceLocators: [path],
    })?.items).toHaveLength(1);
    expect(compileDeveloperPracticeReferenceContext({
      data, selectedArtifactId: "another-artifact",
      semanticIr: ir, domains: ["state"],
      ...(lookup?.sourceLocators === undefined ? {} : { sourceLocators: lookup.sourceLocators }),
    })?.items ?? []).toHaveLength(0);
    expect(compileDeveloperPracticeReferenceContext({
      data, selectedArtifactId: "selected",
      semanticIr: ir, domains: ["state"],
      sourceLocators: ["behavior_packs/other/scripts/main.ts:1"],
    })?.items ?? []).toHaveLength(0);
  });
});


describe("unfamiliar source gameplay evidence handoff", () => {
  it("attaches only exact selected-world operations to an existing UNDERSTAND unknown obligation", () => {
    const intent: GameplayIntentModel = {
      schemaVersion: 1, id: "unknown-operator", artifactId: "selected",
      evidence: [{
        id: "op:clear", origin: "source-code", scope: "selected-artifact",
        locator: "scripts/minified.js:152:8", summary: "Unknown state clear.",
      }, {
        id: "op:other", origin: "source-code", scope: "external-reference",
        locator: "old/scripts/minified.js:152", summary: "Foreign version.",
      }],
      nodes: [], edges: [], invariants: [],
      unknowns: [{
        id: "unknown:uninterpreted-execution:entry",
        question: "Which source state and player outcome does this affect?",
        blockedSubjectIds: [], sourceEntryRegionId: "entry",
        evidenceIds: ["op:clear", "op:other"],
      }],
    };
    const tasks = deriveAuditModelTaskPackets({
      admission: {
        policy: "selected-map-audit-ordered-admission",
        status: "BLOCKED", firstBlockingStage: "UNDERSTAND", issues: [],
      } as any,
      procedure: { checkpoints: [] } as any,
      graph: { causalLinks: [] } as any,
      defectResolution: {} as any,
      intent, auditRevision: "revision:1", world: {} as any,
      auditObligations: [{
        id: "uninterpreted-gameplay-intent", source: "gameplay-closure",
        stage: "UNDERSTAND", title: "Investigate unnamed source behavior",
        reason: "Unknown mechanic", missingProof: "Exact source trigger and effect.",
        validationTest: "Trace selected source.", validationGroupKey: "source:unknown",
        subjectIds: ["unknown:uninterpreted-execution:entry"],
        componentIds: [], evidenceIds: [],
      }],
    });
    const task = tasks.find(item =>
      item.id === "task:audit-obligation:uninterpreted-gameplay-intent");
    expect(task?.kind).toBe("AUDIT_OBLIGATION");
    expect(task?.evidenceIds).toEqual(["op:clear"]);
    expect(task?.evidenceContext).toContainEqual({
      id: "op:clear", kind: "selected-artifact-evidence",
      origin: "source-code", locator: "scripts/minified.js:152:8",
      summary: "Unknown state clear.",
    });
    expect(task?.evidenceIds).not.toContain("op:other");
    expect(task?.allowedOutputs).not.toContain("confirmed gameplay bug");
  });
});

describe("PROVE model evidence handoff", () => {
  it("preserves exact analyzer witnesses while rejecting a neighboring source and duplicate identity", () => {
    const artifactId = "artifact:selected";
    const id = "link:admission";
    const siblingId = "link:sibling";
    const scenarioId = "scenario:admission";
    const ownId = "source:admission";
    const guardId = "source:guard";
    const neighborId = "source:neighbor";
    const fakeId = "source:unbound-claim";

    // Reduced selected-artifact Source -> Intent contract. A sibling in the
    // same scenario shares a subject but not the operation being diagnosed.
    const intent: GameplayIntentModel = {
      schemaVersion: 1,
      id: "intent:selected",
      artifactId,
      evidence: [ownId, guardId, neighborId].map((evidenceId, i) => ({
        id: evidenceId, origin: "source-code" as const,
        scope: "selected-artifact" as const,
        // The Intent subject can name a whole file, while the contradicted
        // causal link retains the exact authored guard operation.
        locator: i === 0 ? "behavior_packs/demo/scripts/admission.js" :
          "behavior_packs/demo/scripts/admission.js:" + (i + 10) + ":2",
        summary: "Selected source witness",
      })),
      nodes: [{
        id: "policy:admission", kind: "policy", label: "Admission",
        status: "authored", evidenceIds: [ownId],
      }],
      edges: [],
      invariants: [],
      unknowns: [],
    };
    const target: GameplayScenarioGraph["causalLinks"][number] = {
      id, scenarioId,
      fromComponentId: "runtime:arena",
      toComponentId: "policy:admission",
      purpose: "Arena admission must stay valid.",
      status: "CONTRADICTED",
      reason: "A required admission state is contradicted.",
      evidenceIds: [ownId, guardId],
      subjectIds: ["policy:admission"],
      componentIds: ["runtime:arena", "policy:admission"],
      knowledgeRequirementIds: [],
      impactPathComponentIds: [],
      impactPathEvidenceIds: [],
      dimensionEvidence: { guard: [guardId], scope: [fakeId] },
    };
    const graph: GameplayScenarioGraph = {
      schemaVersion: 1,
      policy: "scenario-driven-causal-audit",
      scenarios: [{
        id: scenarioId, label: "arena-capacity-plus-one",
        gameplayStage: "READY_START",
        purpose: "Check arena admission.",
        sourceSubjectIds: ["policy:admission"],
        componentIds: ["runtime:arena", "policy:admission"],
        causalLinkIds: [id, siblingId],
        playerCounts: [2], requiredKnowledgeIds: [], composedScenarioIds: [],
      }],
      components: [],
      causalLinks: [target, {
        ...target,
        id: siblingId,
        fromComponentId: "runtime:other",
        toComponentId: "policy:other",
        status: "PROVEN",
        evidenceIds: [neighborId],
        dimensionEvidence: {},
      }],
      knowledgeRequirements: [],
      knowledgeReceipts: [],
      requiredInspectionGraph: {
        policy: "required-inspection-graph",
        nodes: [], receipts: [],
      },
    };
    const authorized = sourceBoundAuditEvidenceIds(graph, id);
    expect(authorized).toContain(ownId);
    expect(authorized).toContain(guardId);
    expect(authorized).not.toContain(neighborId);
    expect(authorized).not.toContain(fakeId);

    const gate: GameplayDefectResolutionGate = {
      status: "BLOCKED",
      contradictedCausalLinkIds: [id],
      resolutions: [],
      confirmedDefectReadyIds: [],
      blockingCounterProofIds: [],
      runtimeProofRequiredIds: [],
      detectionGapIds: [],
      gameplayTranslationRequiredIds: [],
      counterProofSearchRequiredIds: [id],
      issues: [],
    };
    const revision = "revision:selected";
    const input: Parameters<typeof deriveAuditModelTaskPackets>[0] = {
      admission: {
        policy: "selected-map-audit-ordered-admission",
        status: "BLOCKED", firstBlockingStage: "PROVE", issues: [],
      },
      procedure: {} as any,
      graph, defectResolution: gate, intent, auditRevision: revision,
      world: {} as any,
    };
    const tasks = deriveAuditModelTaskPackets(input);
    const task = tasks.find((item) =>
      item.causalLinkId === id && item.kind === "COUNTERPROOF_SEARCH"
    );
    expect(task).toBeDefined();
    expect(task?.evidenceIds).toEqual(authorized);
    expect(task?.evidenceContext.some((item) => item.id === guardId &&
      item.kind === "selected-artifact-evidence")).toBe(true);
    expect(task?.evidenceIds).not.toContain(neighborId);
    expect(task?.evidenceIds).not.toContain(fakeId);

    // Publisher methodology must follow the exact causal link's authored
    // guard, not another operation in the same (possibly bundled) script.
    // This is an authored source-contract fixture, NOT gameplay execution.
    const methodSourceId = "src.bedrock-data-persistence";
    const methodSourcePath = "behavior_packs/demo/scripts/admission.js";
    const developerPractice: DeveloperPracticeReferenceData = {
      authority: "REFERENCE",
      usagePolicy: "CONTEXT_HINT_ONLY_NOT_GAME_DESIGN_OR_DEFECT_PROOF",
      sourceSnapshot: { archiveSha256: "a".repeat(64) },
      sourceFiles: [{
        id: methodSourceId,
        path: "skills/bedrock-data-persistence/SKILL.md",
        sha256: "b".repeat(64),
        auditUsage: "INTERPRETATION_CANDIDATE",
        methodology: {
          applicability: "MAP_SOURCE_INTERPRETATION",
          sourceSections: ["1. State ownership", "2. Disconfirming state"],
          objective: "Trace the current map's dynamic-property owner.",
          investigationSteps: [
            "Inspect the actual authored write and read.",
            "Check a separate valid state owner.",
          ],
          disconfirmingCase: "The write may belong to another game session.",
          proofBoundary: "EXTERNAL_DEVELOPER_METHOD_NOT_SELECTED_MAP_BEHAVIOR_PROOF",
        },
      }],
      patterns: [{
        id: "developer.hint.persistence.read",
        sourceId: methodSourceId,
        kind: "IMPLEMENTATION_PATTERN",
        status: "SOURCE_REVIEWED",
        domains: ["state"],
        sourceSignals: ["getDynamicProperty"],
        question: "Which state reader owns the contradiction?",
        candidateRelations: [],
        negativeControl: "The read may be expected under a guard.",
        versionApplicability: "NOT_INDEPENDENTLY_VERIFIED",
        prohibits: "A read attempt is not a gameplay defect.",
      }, {
        id: "developer.hint.persistence.unrelated-write",
        sourceId: methodSourceId,
        kind: "IMPLEMENTATION_PATTERN",
        status: "SOURCE_REVIEWED",
        domains: ["state"],
        sourceSignals: ["setDynamicProperty"],
        question: "Which state writer caused the contradiction?",
        candidateRelations: [],
        negativeControl: "The neighboring write belongs to another link.",
        versionApplicability: "NOT_INDEPENDENTLY_VERIFIED",
        prohibits: "A same-file write is not this link's proof.",
      }],
    };
    const semanticIr = {
      schemaVersion: 1 as const,
      execution: { regions: [], edges: [] },
      state: {
        surfaces: [{
          id: "surface:round",
          ref: { kind: "dynamic-property" as const, key: "round" },
        }],
        operations: [{
          id: "state-op:guard",
          executionRegionId: "exec:guard",
          surfaceId: "surface:round",
          operation: "read" as const,
          source: {
            artifactId, relativePath: methodSourcePath,
            range: { lineStart: 11, lineEnd: 11,
              columnStart: 2, columnEnd: 21 },
          },
        }, {
          id: "state-op:neighbor",
          executionRegionId: "exec:neighbor",
          surfaceId: "surface:round",
          operation: "write" as const,
          source: {
            artifactId, relativePath: methodSourcePath,
            range: { lineStart: 12, lineEnd: 12,
              columnStart: 2, columnEnd: 21 },
          },
        }],
        authorityBindings: [],
      },
      temporal: { relations: [] },
    } as any;
    const scoped = deriveAuditModelTaskPackets({
      ...input, developerPractice, semanticIr,
    }).find(item => item.causalLinkId === id &&
      item.kind === "COUNTERPROOF_SEARCH");
    expect(scoped?.developerPractice?.items.map(item => item.patternId))
      .toEqual(["developer.hint.persistence.read"]);
    expect(scoped?.developerPractice?.items[0]?.matchingEvidenceIds)
      .toEqual(["state-op:guard"]);
    expect(scoped?.developerPractice?.items[0]?.matchingSignals)
      .toEqual(["getDynamicProperty"]);

    // A genuine source mention in a model prompt does not authorize that
    // source as proof for a different causal-link target.
    const fingerprint = "a".repeat(64);
    const audit = {
      identity: { artifactId, artifactFingerprint: fingerprint },
      auditRevision: revision,
      modelTaskPackets: tasks,
      inspection: { hiddenGameplayDefects: {
        scenarioAudit: { graph, defectResolution: gate },
      } },
    } as unknown as SelectedMapAuditRun;
    const responses = {
      schemaVersion: 1 as const,
      policy: "selected-map-audit-model-responses" as const,
      artifactId, artifactFingerprint: fingerprint, auditRevision: revision,
      resolutions: [{
        taskId: task!.id,
        resolution: {
          causalLinkId: id,
          scenarioId,
          disposition: "COUNTERPROOF_SEARCH_REQUIRED" as const,
          evidenceIds: [neighborId],
        },
      }],
    };
    expect(() => applySelectedMapAuditModelResponses({
      audit, responses,
    })).toThrow(/unverified or out-of-scope evidence/);

    const duplicate = {
      ...audit,
      inspection: { hiddenGameplayDefects: {
        scenarioAudit: {
          graph: {
            ...graph, causalLinks: [...graph.causalLinks, { ...target }],
          },
          defectResolution: gate,
        },
      } },
    } as unknown as SelectedMapAuditRun;
    expect(() => applySelectedMapAuditModelResponses({
      audit: duplicate,
      responses: {
        ...responses,
        resolutions: [{
          ...responses.resolutions[0]!,
          resolution: { ...responses.resolutions[0]!.resolution,
            evidenceIds: [ownId] },
        }],
      },
    })).toThrow(/ambiguous causal scope/);
  });
});
