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
      graph: {
        causalLinks: [],
        sourceFlowCandidates: [{
          id: "source-flow:entry", entryRegionId: "entry",
          sourceTraceStatus: "SOURCE_ROOT_TRACE",
          sourceSteps: [{
            id: "op:clear", kind: "state", operation: "clear",
            executionRegionId: "handler",
            source: { artifactId: "selected", relativePath: "scripts/minified.js" },
          }, {
            id: "op:other", kind: "state", operation: "clear",
            executionRegionId: "handler",
            source: { artifactId: "older", relativePath: "scripts/minified.js" },
          }],
          branchPoints: [{
            expression: "canReset()", source: {
              artifactId: "selected", relativePath: "scripts/minified.js",
            },
            branches: [{
              branch: "true", stateWriteOperationIds: ["op:clear"],
              returnOutcomeIds: [], resourceActionIds: [], worldEffectIds: [],
            }],
          }],
          sourceHandoffs: [{
            edgeId: "edge:entry-handler",
            fromRegionId: "entry", toRegionId: "handler",
            source: { artifactId: "selected", relativePath: "scripts/minified.js" },
            directTargetStepIds: ["op:clear"],
          }],
          unresolvedExecutionEdgeIds: ["edge:dynamic"],
        }, {
          // Same entry and material ID from an older artifact cannot become
          // selected-world proof or override the current source path.
          id: "source-flow:historical", entryRegionId: "entry",
          sourceTraceStatus: "SOURCE_ROOT_TRACE",
          sourceSteps: [{
            id: "op:clear", kind: "state", operation: "clear",
            executionRegionId: "handler",
            source: { artifactId: "older", relativePath: "scripts/minified.js" },
          }],
        }],
      } as any,
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
    const investigation = task?.sourceInvestigation;
    expect(investigation?.authority).toBe(
      "SELECTED_SOURCE_PATH_CONTEXT_NOT_GAMEPLAY_OR_RUNTIME_PROOF");
    expect(investigation?.entries).toHaveLength(1);
    expect(investigation?.entries[0]?.steps.map(step => step.id)).toEqual(["op:clear"]);
    expect(investigation?.entries[0]?.sourceTraceStatus).toBe("SOURCE_ROOT_TRACE");
    expect(investigation?.entries[0]?.branchContexts[0]?.arms[0]?.matchedStepIds)
      .toEqual(["op:clear"]);
    expect(investigation?.entries[0]?.handoffs.map(item => item.edgeId))
      .toEqual(["edge:entry-handler"]);
    expect(investigation?.entries[0]?.unresolvedExecutionEdgeIds)
      .toEqual(["edge:dynamic"]);
    expect(investigation?.entries[0]?.unmatchedEvidenceIds).toEqual([]);
    expect(task?.allowedOutputs).not.toContain("confirmed gameplay bug");
  });
});


describe("source interpretation admission is a read-only model-task review", () => {
  const path = "scripts/unnamed.js";
  const from = {
    id: "op:a", kind: "state" as const, operation: "write",
    executionRegionId: "entry",
    source: { artifactId: "selected", relativePath: path },
  };
  const to = {
    ...from, id: "op:b", operation: "clear",
  };
  const condition = {
    artifactId: "selected", relativePath: path,
    range: { lineStart: 14, columnStart: 2, lineEnd: 14, columnEnd: 18 },
  };
  const task = {
    id: "task:audit-obligation:uninterpreted-gameplay-intent",
    auditRevision: "revision:selected",
    kind: "AUDIT_OBLIGATION" as const,
    stage: "UNDERSTAND" as const,
    evidenceIds: ["op:a", "op:b"],
    sourceInvestigation: {
      authority: "SELECTED_SOURCE_PATH_CONTEXT_NOT_GAMEPLAY_OR_RUNTIME_PROOF",
      entries: [{
        unknownId: "unknown:entry", question: "What does this source do?",
        entryRegionId: "entry", sourceTraceStatus: "SOURCE_ROOT_TRACE",
        steps: [from, to], omittedSteps: 0,
        branchContexts: [{
          expression: "phaseReady", source: condition,
          arms: [
            { branch: "true", matchedStepIds: ["op:a"] },
            { branch: "false", matchedStepIds: ["op:b"] },
          ],
        }],
        omittedBranchContexts: 0, handoffs: [], omittedHandoffs: 0,
        unresolvedExecutionEdgeIds: [], omittedUnresolvedExecutionEdges: 0,
        unmatchedEvidenceIds: [], omittedUnmatchedEvidence: 0,
      }],
      omittedEntries: 0,
    },
  };
  const report = { bugs: [], designMismatches: [] };
  const audit = {
    identity: { artifactId: "selected", artifactFingerprint: "x".repeat(64) },
    auditRevision: "revision:selected",
    modelTaskPackets: [task],
    mapAuditReport: report,
    status: "BLOCKED",
    admission: { status: "BLOCKED" },
  } as unknown as SelectedMapAuditRun;
  const proposal = {
    taskId: task.id, unknownId: "unknown:entry",
    fromStepId: "op:a", toStepId: "op:b",
    sourceClaim: "SAME_AUTHORED_BRANCH_CANDIDATE" as const,
    proposedGameplayMeaning: "These effects represent one gameplay action.",
    disconfirmingQuestion: "Are these operations on mutually exclusive branches?",
  };
  const responses = {
    schemaVersion: 1 as const,
    policy: "selected-map-audit-model-responses" as const,
    artifactId: "selected", artifactFingerprint: "x".repeat(64),
    auditRevision: "revision:selected",
    resolutions: [],
    sourceInterpretations: [proposal],
  };

  it("refutes exclusive authored arms without promoting audit or game design", () => {
    const result = applySelectedMapAuditModelResponses({ audit, responses });
    const review = result.modelTaskPackets[0]?.sourceInterpretationReviews?.[0];
    expect(review?.disposition).toBe("AUTHORED_BRANCH_COUNTEREXAMPLE");
    expect(review?.counterexample).toMatchObject({
      leftArm: "true", rightArm: "false",
    });
    expect(review?.proofBoundary).toBe(
      "AI_INTERPRETATION_NOT_GAMEPLAY_DESIGN_DEFECT_OR_RUNTIME_PROOF");
    expect(result.mapAuditReport).toBe(audit.mapAuditReport);
    expect(result.admission).toBe(audit.admission);
    expect(result.auditRevision).toBe(audit.auditRevision);
    expect(audit.modelTaskPackets[0]).not.toHaveProperty("sourceInterpretationReviews");
  });

  it("keeps a shared-arm proposal unresolved and rejects foreign or stale source", () => {
    const sameArmAudit = {
      ...audit,
      modelTaskPackets: [{
        ...task,
        sourceInvestigation: {
          ...task.sourceInvestigation,
          entries: [{
            ...task.sourceInvestigation.entries[0]!,
            branchContexts: [{
              expression: "phaseReady", source: condition,
              arms: [
                { branch: "true", matchedStepIds: ["op:a", "op:b"] },
                { branch: "false", matchedStepIds: [] },
              ],
            }],
          }],
        },
      }],
    } as unknown as SelectedMapAuditRun;
    const reviewed = applySelectedMapAuditModelResponses({
      audit: sameArmAudit, responses,
    });
    expect(reviewed.modelTaskPackets[0]?.sourceInterpretationReviews?.[0]
      ?.disposition).toBe("SOURCE_RELATION_UNRESOLVED");
    expect(() => applySelectedMapAuditModelResponses({
      audit,
      responses: { ...responses, artifactId: "another-map" },
    })).toThrow(/different selected artifact/);
    expect(() => applySelectedMapAuditModelResponses({
      audit,
      responses: {
        ...responses, sourceInterpretations: [{
          ...proposal, toStepId: "op:foreign",
        }],
      },
    })).toThrow(/foreign operation IDs/);
    expect(() => applySelectedMapAuditModelResponses({
      audit,
      responses: { ...responses, resolutions: [{
        taskId: "other", resolution: { causalLinkId: "link:other" },
      }] as any },
    })).toThrow(/Cannot mix source interpretation/);
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

    const detachedScenario = {
      ...audit,
      inspection: { hiddenGameplayDefects: {
        scenarioAudit: {
          graph: { ...graph, scenarios: graph.scenarios.map(scenario => ({
            ...scenario, causalLinkIds: [],
          })) },
          defectResolution: gate,
        },
      } },
    } as unknown as SelectedMapAuditRun;
    // A valid model-task ID and a claimed in-scope witness do not repair
    // the missing scenario -> causal-link source ownership binding.
    expect(() => applySelectedMapAuditModelResponses({
      audit: detachedScenario,
      responses: {
        ...responses,
        resolutions: [{
          taskId: task!.id,
          resolution: {
            causalLinkId: id,
            scenarioId,
            disposition: "COUNTERPROOF_SEARCH_REQUIRED" as const,
            evidenceIds: [ownId],
          },
        }],
      },
    })).toThrow(/ambiguous causal scope/);

    // Model response with ZERO claimed evidence must also fail when the
    // selected causal link shares its component ID with another owner.
    // Earlier code admitted the empty list and tried to continue a blocked
    // graph, rather than rejecting its ambiguous proof subject.
    const arenaOwner = {
      id: "runtime:arena", label: "Arena state owner",
      kind: "state" as const, technicalRole: "arena",
      gameplayPurpose: "Admission", evidenceIds: [ownId],
      usedByScenarioIds: [scenarioId], orphan: false,
    };
    const duplicateComponent = {
      ...audit,
      inspection: { hiddenGameplayDefects: {
        scenarioAudit: {
          graph: {
            ...graph,
            components: [arenaOwner, {
              ...arenaOwner, label: "Another component with this source ID",
            }],
          },
          defectResolution: gate,
        },
      } },
    } as unknown as SelectedMapAuditRun;
    expect(() => applySelectedMapAuditModelResponses({
      audit: duplicateComponent,
      responses: {
        ...responses,
        resolutions: [{
          taskId: task!.id,
          resolution: {
            causalLinkId: id,
            scenarioId,
            disposition: "COUNTERPROOF_SEARCH_REQUIRED" as const,
            evidenceIds: [],
          },
        }],
      },
    })).toThrow(/ambiguous causal scope/);
  });
});


describe("obligation packet memory ownership", () => {
  it("reuses only immutable empties and proof policy, without merging task identities or evidence", () => {
    const evidence = {
      id: "ev:shared", origin: "source-code", scope: "selected-artifact",
      locator: "behavior_packs/BP/scripts/main.js:7:9", summary: "Exact authored source",
    };
    const input = {
      admission: { firstBlockingStage: undefined },
      procedure: {}, graph: {}, defectResolution: {}, world: {},
      auditRevision: "revision:source-only",
      intent: {
        schemaVersion: 1, id: "intent:selected", artifactId: "selected",
        evidence: [evidence], nodes: [], edges: [], invariants: [], unknowns: [],
      },
      auditObligations: [
        { id: "obligation:a", title: "Resolve A", reason: "Source A", stage: "UNDERSTAND",
          subjectIds: [], componentIds: [], evidenceIds: [], missingProof: "Proof A" },
        { id: "obligation:b", title: "Resolve B", reason: "Source B", stage: "UNDERSTAND",
          subjectIds: [], componentIds: [], evidenceIds: [], missingProof: "Proof B" },
        { id: "obligation:c", title: "Resolve C", reason: "Source C", stage: "UNDERSTAND",
          subjectIds: ["actor:real"], componentIds: [], evidenceIds: ["ev:shared"],
          missingProof: "Proof C" },
      ],
    } as any;
    const tasks = deriveAuditModelTaskPackets(input);
    const [a, b, c] = tasks;
    expect(tasks.map(task => task.id)).toEqual([
      "task:audit-obligation:obligation:a",
      "task:audit-obligation:obligation:b",
      "task:audit-obligation:obligation:c",
    ]);
    expect(a?.allowedOutputs).toBe(b?.allowedOutputs);
    expect(a?.forbiddenActions).toBe(b?.forbiddenActions);
    expect(a?.evidenceIds).toBe(b?.evidenceIds);
    expect(a?.evidenceContext).toBe(b?.evidenceContext);
    expect(a?.requiredKnowledgeIds).toBe(b?.requiredKnowledgeIds);
    expect(a?.knowledgeContext).toBe(b?.knowledgeContext);
    expect(Object.isFrozen(a?.allowedOutputs)).toBe(true);
    expect(Object.isFrozen(a?.evidenceIds)).toBe(true);
    expect(c?.evidenceIds).toEqual(["ev:shared"]);
    expect(c?.evidenceContext).toEqual([{
      id: "ev:shared", kind: "selected-artifact-evidence",
      origin: "source-code", locator: evidence.locator, summary: evidence.summary,
    }]);
    expect(c?.evidenceIds).not.toBe(a?.evidenceIds);
    expect(a?.unresolvedObligationIds).toEqual(["obligation:a"]);
    expect(b?.unresolvedObligationIds).toEqual(["obligation:b"]);
    expect(c?.unresolvedObligationIds).toEqual(["obligation:c"]);
    expect(a?.missingClaims).toEqual(["Proof A"]);
    expect(b?.missingClaims).toEqual(["Proof B"]);
    expect(c?.missingClaims).toEqual(["Proof C"]);
    expect(a?.stopCondition).toContain("Do not promote it directly");
  });
});
