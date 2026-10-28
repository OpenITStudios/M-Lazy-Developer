import { describe, expect, it } from "vitest";
import { parseScriptFile, deriveCrossFileCallEdges } from "../../../../analyzers/scripts/src/index.js";
import { buildInspectionSemanticIr } from "../../src/diagnosis/semantic-ir-stage.js";
import { buildGameplayIntentModel } from "../../src/inspection/gameplay-intent-stage.js";
import {
  deriveGameplayArchitectureNavigation,
  type GameplayScenarioGraph,
} from "../../src/inspection/gameplay-scenario-model.js";
import { compileGameplayScenarioGraph } from "../../src/inspection/gameplay-scenario-compiler.js";

const emptyGraph: GameplayScenarioGraph = {
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

describe("arena identity evidence propagation", () => {
  it("preserves conflicting replica receipts and exposes duplicate arena identities", () => {
    const navigation = deriveGameplayArchitectureNavigation(emptyGraph, {
      relevantSourceCount: 1,
      indexedSourceCount: 1,
      arenaDetected: true,
      arenaCount: 2,
      replicaProof: [
        { arenaId: "arena-2", evidenceIds: ["proof:first"], status: "complete-proof" },
        { arenaId: "arena-2", evidenceIds: ["proof:second"], status: "diverged" },
      ],
    });

    expect(navigation.knowledgeCoverage.arenaEvidence.duplicateReplicaProofArenaIds)
      .toEqual(["arena-2"]);
    expect(navigation.knowledgeCoverage.arenaEvidence.replicaProofEntries)
      .toEqual([
        { arenaId: "arena-2", evidenceIds: ["proof:first"], proofStatus: "complete-proof" },
        { arenaId: "arena-2", evidenceIds: ["proof:second"], proofStatus: "diverged" },
      ]);
    expect(navigation.architectureReconciliation.arenaMappingUnresolved).toBe(true);
    expect(navigation.architectureReconciliation.status).toBe("GAPS_PRESENT");
  });
  it("keeps uncertain behavior relations out of exact source-flow activation", () => {
    const source = { artifactId: "map:flow",
      relativePath: "behavior_packs/demo/scripts/game.js" };
    const model = {
      schemaVersion: 1,
      execution: {
        regions: [
          // A Minecraft event is an eligible source root only with an exact
          // API event identity. A generic event-like name is not enough.
          { id: "event:start", kind: "event-source",
            ownerId: "world", label: "world.afterEvents.playerSpawn", source },
          { id: "callback:join", kind: "script-callback",
            ownerId: "game", label: "join", source },
          { id: "function:apply", kind: "mcfunction",
            ownerId: "game", label: "apply", source },
        ],
        edges: [
          { id: "edge:unrelated", from: "event:start", to: "callback:join",
            kind: "event-dispatch", resolution: "resolved",
            targetLabel: "join", source },
          { id: "edge:resolved", from: "callback:join", to: "function:apply",
            kind: "synchronous-call", resolution: "resolved",
            targetLabel: "apply", source },
          { id: "edge:missing", from: "callback:join",
            kind: "synchronous-call", resolution: "unresolved",
            targetLabel: "dynamic", source },
        ],
        authoredBehaviorRelations: [],
      },
      state: { surfaces: [], authorityBindings: [], operations: [{
        id: "state:write", executionRegionId: "callback:join",
        surfaceId: "state:round", operation: "write", source,
      }] },
      temporal: { relations: [] },
    } as unknown as import("../../../semantic-ir/src/index.js").SemanticIr;
    const world = {
      arenas: { detected: false, cleanup: { resourceLedger: { resources: 0 } } },
      chunks: { tickingAreaAcquires: 0, tickingAreaReadinessStates: 0,
        capacityUncheckedLeases: 0 }, entities: { definitions: 0 },
      combat: { hurtHandlers: 0, deathHandlers: 0, damageApplications: 0 },
      inventory: { regions: 0, grantRegions: 0 },
      structures: { loads: 0, runtimeLogicLoads: 0 },
      economy: { sourceKinds: [] }, worldRules: { writes: 0, manualEntitySpawnPaths: 0 },
      playerCapabilities: { gamemodeWrites: 0, abilityWrites: 0,
        commandPermissionWrites: 0, privilegedGuardReferences: 0,
        protectionDefinitions: 0 },
      capabilityExposure: { exposed: 0, potentiallyExposed: 0, unresolved: 0 },
      clientReconciliation: { predictedMutationCancellations: 0 },
      spatial: { resolvedScriptEffects: 0, structurePlacements: 0,
        authority: { configured: false } },
    } as unknown as import("../../src/inspection/gameplay-world-model.js").GameplayWorldModel;
    const intent = { schemaVersion: 1, id: "intent:source", evidence: [],
      nodes: [], edges: [], invariants: [], unknowns: [] } as
      import("../../../gameplay-intent/src/index.js").GameplayIntentModel;
    const observed = (resolution: "EXACT_REFERENCE" | "POSSIBLE_TARGET" | "UNRESOLVED",
      edgeId: string) => compileGameplayScenarioGraph({
      intent, world, preset: { scenarios: [] } as unknown as
        import("../../../diagnostic-reasoning/src/index.js").GameplayAuditScenarioPreset,
      semanticIr: { ...model, execution: {
        ...model.execution,
        authoredBehaviorRelations: [{
          id: "relation:command", kind: "dialogue-button-command",
          ownerId: "game", from: "dialogue:join", to: "function apply",
          resolution, source, reason: "Authored source candidate",
          stateOperationIds: ["state:write"], executionEdgeIds: [edgeId],
        }],
      } },
    });
    const ids = (resolution: "EXACT_REFERENCE" | "POSSIBLE_TARGET" | "UNRESOLVED",
      edgeId: string) => observed(resolution, edgeId)
        .sourceFlowCandidates?.flatMap(flow => flow.authoredBehaviorRelationIds) ?? [];
    expect(ids("EXACT_REFERENCE", "edge:resolved")).toContain("relation:command");
    expect(ids("EXACT_REFERENCE", "edge:missing")).not.toContain("relation:command");
    expect(ids("POSSIBLE_TARGET", "edge:resolved")).not.toContain("relation:command");
    expect(ids("UNRESOLVED", "edge:resolved")).not.toContain("relation:command");
    const unresolved = observed("UNRESOLVED", "edge:missing");
    expect(unresolved.sourceFlowCandidates?.some(flow =>
      flow.unresolvedExecutionEdgeIds.includes("edge:missing"))).toBe(true);
  });

  it("reconstructs source-observed event to anonymous callback and state paths without guessing gameplay", () => {
    const source = { artifactId: "world:one",
      relativePath: "behavior_packs/a/scripts/game.js" };
    const ir = {
      schemaVersion: 1,
      execution: {
        regions: [
          { id: "event:join", kind: "event-source", ownerId: "world",
            label: "world.afterEvents.playerJoin", source },
          { id: "callback:anonymous", kind: "script-callback",
            ownerId: "game", label: "callback:1", source },
          { id: "function:unused", kind: "script-function",
            ownerId: "game", label: "unused", source },
        ],
        edges: [
          { id: "edge:join", from: "event:join", to: "callback:anonymous",
            kind: "event-dispatch", resolution: "resolved",
            targetLabel: "callback:1", source },
          { id: "edge:repeat", from: "callback:anonymous", to: "callback:anonymous",
            kind: "periodic", resolution: "resolved",
            targetLabel: "callback:1", source },
          { id: "edge:unknown", from: "callback:anonymous",
            kind: "deferred", resolution: "unresolved",
            targetLabel: "dynamic", source },
        ],
      },
      temporal: { relations: [
        { id: "time:edge:join", from: "event:join", to: "callback:anonymous",
          kind: "event-dispatch", resolution: "resolved",
          targetLabel: "callback:1", source },
        { id: "time:edge:repeat", from: "callback:anonymous",
          to: "callback:anonymous", kind: "periodic", resolution: "resolved",
          targetLabel: "callback:1", source },
      ] },
      state: { surfaces: [], authorityBindings: [],
        operations: [
          { id: "state-op:join", executionRegionId: "callback:anonymous",
            surfaceId: "state:session", operation: "write", source },
          { id: "state-op:unused", executionRegionId: "function:unused",
            surfaceId: "state:session", operation: "read", source },
        ],
      },
    } as unknown as import("../../../semantic-ir/src/index.js").SemanticIr;
    const graph = { ...emptyGraph, components: [{
      id: "component:join", label: "Join", kind: "lifecycle",
      technicalRole: "event handler", gameplayPurpose: "unverified",
      evidenceIds: ["edge:join"], usedByScenarioIds: [], orphan: true,
    }] } as GameplayScenarioGraph;
    const navigation = deriveGameplayArchitectureNavigation(graph, {
      relevantSourceCount: 1, indexedSourceCount: 1,
      arenaDetected: false, semanticIr: ir,
    });
    const trace = navigation.semanticIrCoverage.executionTraces;
    expect(trace).toHaveLength(1);
    expect(trace[0]?.entryRegionId).toBe("event:join");
    expect(trace[0]?.regionIds)
      .toEqual(["callback:anonymous", "event:join"]);
    expect(trace[0]?.executionEdgeIds)
      .toEqual(["edge:join", "edge:repeat", "edge:unknown"]);
    expect(trace[0]?.unresolvedExecutionEdgeIds).toEqual(["edge:unknown"]);
    expect(trace[0]?.conditionalExecutionEdgeIds).toEqual([]);
    expect(trace[0]?.stateWriteOperationIds).toEqual(["state-op:join"]);
    expect(trace[0]?.temporalRelationIds)
      .toEqual(["time:edge:join", "time:edge:repeat"]);
    expect(trace[0]?.stateOperationIds).toEqual(["state-op:join"]);
    expect(trace[0]?.evidenceMatchedComponentIds).toEqual(["component:join"]);
    expect(trace[0]?.modelingStatus).toBe("PARTIALLY_MODELED");
    expect(navigation.architectureReconciliation.behaviorFlowsPartiallyModeledCount)
      .toBe(1);
    expect(navigation.architectureReconciliation.behaviorFlowsUnmodeledCount)
      .toBe(0);
    expect(navigation.architectureReconciliation.status).toBe("GAPS_PRESENT");
    expect(trace[0]?.evidenceWithoutComponentIds).toContain("edge:unknown");
    expect(trace[0]?.evidenceWithoutComponentIds).not.toContain("edge:join");
    expect(trace[0]?.sharedScenarioPlacementIds).toEqual([]);

    expect(navigation.semanticIrCoverage.regionsOutsideTraces)
      .toEqual(["function:unused"]);
    expect(navigation.knowledgeCoverage.wholeGameUnderstandingStatus)
      .toBe("NOT_MEASURABLE");
  });


  it("reconciles complete technical flows without inventing a player-facing scenario", () => {
    const source = {
      artifactId: "sample:flow", relativePath: "behavior_packs/test/scripts/main.js",
    };
    const ir = {
      schemaVersion: 1,
      execution: {
        regions: [{ id: "region:event", kind: "event-source",
          ownerId: "world", label: "world.afterEvents.playerSpawn", source }],
        edges: [],
      },
      state: { surfaces: [], operations: [], authorityBindings: [] },
      temporal: { relations: [] },
    } as unknown as import("../../../semantic-ir/src/index.js").SemanticIr;
    const observe = (graph: GameplayScenarioGraph) =>
      deriveGameplayArchitectureNavigation(graph, {
        relevantSourceCount: 1, indexedSourceCount: 1,
        arenaDetected: false, semanticIr: ir,
      }).semanticIrCoverage.executionTraces[0]!;
    expect(observe(emptyGraph).modelingStatus).toBe("UNMODELED");
    const accounting = (graph: GameplayScenarioGraph) =>
      deriveGameplayArchitectureNavigation(graph, {
        relevantSourceCount: 1, indexedSourceCount: 1,
        arenaDetected: false, semanticIr: ir,
      }).architectureReconciliation;
    expect(accounting(emptyGraph).behaviorFlowsUnmodeledCount).toBe(1);
    expect(observe(emptyGraph).evidenceWithoutComponentIds)
      .toEqual(["region:event"]);
    const component: GameplayScenarioGraph["components"][number] = {
      id: "component:event", label: "Observed event",
      kind: "lifecycle", technicalRole: "event",
      gameplayPurpose: "Unverified activation",
      evidenceIds: ["region:event"],
      usedByScenarioIds: [], orphan: true,
    };
    const graph = {
      ...emptyGraph, components: [component],
    };
    expect(observe(graph).modelingStatus).toBe("PARTIALLY_MODELED");
    expect(observe(graph).evidenceWithoutComponentIds).toEqual([]);
    const placed = { ...graph, scenarios: [{
      id: "scenario:observed", label: "Observed source path",
      gameplayStage: "ENTRY_JOIN", purpose: "Unverified",
      sourceSubjectIds: [], componentIds: [component.id],
      causalLinkIds: [], playerCounts: [],
      requiredKnowledgeIds: [], composedScenarioIds: [],
    }] } as GameplayScenarioGraph;
    expect(observe(placed).modelingStatus).toBe("PLACED_UNPROVEN");
    expect(accounting(placed).behaviorFlowsUnmodeledCount).toBe(0);
    expect(accounting(placed).behaviorFlowsPartiallyModeledCount).toBe(0);
    expect(accounting(placed).behaviorFlowsPlacedUnprovenCount).toBe(1);
    expect(observe(placed).sharedScenarioPlacementIds).toEqual(["scenario:observed"]);
    const structure = deriveGameplayArchitectureNavigation(placed, {
      relevantSourceCount: 1,
      indexedSourceCount: 1,
      arenaDetected: false,
      semanticIr: ir,
    }).gameplayStructure;
    const sourceOnlyEvidence = structure.observedFlowEvidence.find(entry =>
      entry.entryRegionId === "region:event");
    expect(sourceOnlyEvidence).toEqual({
      entryRegionId: "region:event",
      modelingStatus: "PLACED_UNPROVEN",
      unmodeledEvidenceIds: [],
    });
    const feature = structure.features.find(entry => entry.id === component.id);
    expect(feature?.observedFlowEntries).toEqual([{
      entryRegionId: "region:event",
      modelingStatus: "PLACED_UNPROVEN",
    }]);
  });

  it("keeps authored true/false branches distinct and maps only exact scenario evidence", () => {
    const source = {
      artifactId: "map:one",
      relativePath: "behavior_packs/demo/scripts/round.js",
    };
    const parsed = parseScriptFile("round", [
      'import { world } from "@minecraft/server";',
      'let phase = "idle";',
      'function startRound(ready) {',
      '  if (ready) { phase = "active"; return { action: "start" }; }',
      '  else { phase = "blocked"; return { action: "abort" }; }',
      '}',
      'world.afterEvents.playerSpawn.subscribe(() => startRound(true));',
    ].join("\n"), source);
    const ir = buildInspectionSemanticIr({
      parsedFunctions: [], parsedScripts: [{ parsed }],
    });
    const authored = ir.execution.outcomes ?? [];
    const start = authored.find(outcome => outcome.value === "start");
    const abort = authored.find(outcome => outcome.value === "abort");
    expect(start).toBeDefined();
    expect(abort).toBeDefined();
    const graph: GameplayScenarioGraph = {
      ...emptyGraph,
      components: [{
        id: "component:start", label: "Start candidate",
        kind: "outcome", technicalRole: "authored return",
        gameplayPurpose: "unverified", evidenceIds: [start!.id],
        usedByScenarioIds: ["scenario:round"], orphan: false,
      }, {
        // A similar-looking but different ID must never acquire ownership.
        id: "component:other", label: "Abort-like candidate",
        kind: "outcome", technicalRole: "unrelated",
        gameplayPurpose: "unverified", evidenceIds: [abort!.id + ":other"],
        usedByScenarioIds: [], orphan: true,
      }],
      scenarios: [{
        id: "scenario:round", label: "Round candidate",
        gameplayStage: "ACTIVE", purpose: "unverified",
        sourceSubjectIds: [], componentIds: ["component:start"],
        causalLinkIds: [], playerCounts: [],
        requiredKnowledgeIds: [], composedScenarioIds: [],
      }],
    };
    const navigation = deriveGameplayArchitectureNavigation(graph, {
      relevantSourceCount: 1, indexedSourceCount: 1,
      arenaDetected: false, semanticIr: ir,
    });
    const trace = navigation.semanticIrCoverage.executionTraces.find(item =>
      item.entryKind === "event-source" &&
      item.branchPoints.some(point => point.expression === "ready"));
    expect(trace).toBeDefined();
    const point = trace!.branchPoints.find(item => item.expression === "ready")!;
    expect(point.source.artifactId).toBe(source.artifactId);
    expect(point.source.range?.lineStart).toBe(4);
    expect(point.branches.map(arm => arm.branch)).toEqual(["true", "false"]);
    const yes = point.branches.find(arm => arm.branch === "true")!;
    const no = point.branches.find(arm => arm.branch === "false")!;
    expect(yes.returnOutcomeIds).toContain(start!.id);
    expect(no.returnOutcomeIds).toContain(abort!.id);
    expect(yes.returnOutcomeIds).not.toContain(abort!.id);
    expect(no.returnOutcomeIds).not.toContain(start!.id);
    expect(yes.stateWriteOperationIds.length).toBeGreaterThan(0);
    expect(no.stateWriteOperationIds.length).toBeGreaterThan(0);
    expect(yes.evidenceMatchedComponentIds).toEqual(["component:start"]);
    expect(yes.scenarioPlacementIds).toEqual(["scenario:round"]);
    expect(no.evidenceMatchedComponentIds).toEqual([]);
    expect(no.scenarioPlacementIds).toEqual([]);
    expect(no.evidenceWithoutComponentIds).toContain(abort!.id);
    // A trace visits both arms as possibilities; it never says both occurred.
    expect(trace!.returnOutcomeIds).toEqual([abort!.id, start!.id].sort());
    expect(navigation.knowledgeCoverage.wholeGameUnderstandingStatus)
      .toBe("NOT_MEASURABLE");
  });

  it("places only exact precedence-arm evidence into existing scenarios", () => {
    const source = {
      artifactId: "map:precedence",
      relativePath: "behavior_packs/demo/scripts/round.js",
    };
    const parsed = parseScriptFile("round", [
      'import { world } from "@minecraft/server";',
      'function startRound(skip) {',
      '  if (skip) return { action: "abort" };',
      '  return { action: "start" };',
      '}',
      'world.afterEvents.playerSpawn.subscribe(() => startRound(false));',
    ].join("\n"), source);
    const ir = buildInspectionSemanticIr({
      parsedFunctions: [], parsedScripts: [{ parsed }],
    });
    const start = ir.execution.outcomes?.find(item => item.value === "start");
    const abort = ir.execution.outcomes?.find(item => item.value === "abort");
    expect(start).toBeDefined();
    expect(abort).toBeDefined();
    const graph: GameplayScenarioGraph = {
      ...emptyGraph,
      components: [{
        id: "component:start", label: "Candidate start",
        kind: "outcome", technicalRole: "authored return",
        gameplayPurpose: "unverified",
        evidenceIds: [start!.id], usedByScenarioIds: ["scenario:start"],
        orphan: false,
      }],
      scenarios: [{
        id: "scenario:start", label: "Start candidate",
        gameplayStage: "ACTIVE", purpose: "unverified",
        sourceSubjectIds: [], componentIds: ["component:start"],
        causalLinkIds: [], playerCounts: [],
        requiredKnowledgeIds: [], composedScenarioIds: [],
      }],
    };
    const navigation = deriveGameplayArchitectureNavigation(graph, {
      relevantSourceCount: 1, indexedSourceCount: 1,
      arenaDetected: false, semanticIr: ir,
    });
    const trace = navigation.semanticIrCoverage.executionTraces.find(item =>
      item.entryKind === "event-source" &&
      item.branchPoints.some(point => point.expression === "skip"));
    expect(trace).toBeDefined();
    const point = trace!.branchPoints.find(item => item.expression === "skip")!;
    const yes = point.branches.find(arm => arm.branch === "true")!;
    const no = point.branches.find(arm => arm.branch === "false")!;
    expect(yes.returnOutcomeIds).toContain(abort!.id);
    expect(yes.precedenceEvidenceIds).toEqual([]);
    expect(yes.evidenceMatchedComponentIds).toEqual([]);
    expect(no.returnOutcomeIds).toContain(start!.id);
    expect(no.precedenceEvidenceIds).toEqual([start!.id]);
    expect(no.evidenceMatchedComponentIds).toEqual(["component:start"]);
    expect(no.scenarioPlacementIds).toEqual(["scenario:start"]);
    expect(no.evidenceWithoutComponentIds).toEqual([]);
    expect(navigation.knowledgeCoverage.wholeGameUnderstandingPercent).toBeNull();
  });

  it("projects candidate state and outcome ownership only through exact evidence IDs", () => {
    const source = { artifactId: "map:behavior",
      relativePath: "behavior_packs/demo/scripts/round.js" };
    const parsed = parseScriptFile("round", [
      'import { world } from "@minecraft/server";',
      'let phase = "idle";',
      'function decide(ready) {',
      '  if (ready) { phase = "active"; return { action: "start" }; }',
      '  else { phase = "blocked"; return { action: "abort" }; }',
      '}',
      'world.afterEvents.playerSpawn.subscribe(() => decide(true));',
    ].join("\n"), source);
    const ir = buildInspectionSemanticIr({
      parsedFunctions: [], parsedScripts: [{ parsed }],
    });
    const start = ir.execution.outcomes?.find(item => item.value === "start");
    const abort = ir.execution.outcomes?.find(item => item.value === "abort");
    const active = ir.state.operations.find(item =>
      item.writtenValue?.kind === "literal" &&
      item.writtenValue.value === "active");
    const blocked = ir.state.operations.find(item =>
      item.writtenValue?.kind === "literal" &&
      item.writtenValue.value === "blocked");
    expect(start && abort && active && blocked).toBeTruthy();
    const graph: GameplayScenarioGraph = {
      ...emptyGraph,
      components: [{
        id: "component:start", label: "Start source record",
        kind: "outcome", technicalRole: "authored return",
        gameplayPurpose: "unverified", evidenceIds: [start!.id],
        usedByScenarioIds: ["scenario:round"], orphan: false,
      }, {
        id: "component:phase", label: "State source record",
        kind: "state", technicalRole: "authored state write",
        gameplayPurpose: "unverified", evidenceIds: [active!.id],
        usedByScenarioIds: ["scenario:round"], orphan: false,
      }, {
        id: "component:fake", label: "Lookalike unlinked record",
        kind: "state", technicalRole: "other",
        gameplayPurpose: "unverified", evidenceIds: [blocked!.id + ":other"],
        usedByScenarioIds: [], orphan: true,
      }],
      scenarios: [{
        id: "scenario:round", label: "Round candidate",
        gameplayStage: "ACTIVE", purpose: "unverified",
        sourceSubjectIds: [], componentIds: ["component:start", "component:phase"],
        causalLinkIds: [], playerCounts: [],
        requiredKnowledgeIds: [], composedScenarioIds: [],
      }],
    };
    const nav = deriveGameplayArchitectureNavigation(graph, {
      relevantSourceCount: 1, indexedSourceCount: 1,
      arenaDetected: false, semanticIr: ir,
    });
    const startCandidate = nav.semanticIrCoverage.stateOutcomeCandidates
      .find(item => item.outcomeId === start!.id);
    const abortCandidate = nav.semanticIrCoverage.stateOutcomeCandidates
      .find(item => item.outcomeId === abort!.id);
    expect(startCandidate?.precedingWriteOperationIds).toEqual([active!.id]);
    expect(startCandidate?.status).toBe("SOURCE_ORDER_CANDIDATE");
    expect(startCandidate?.outcomeComponentIds).toEqual(["component:start"]);
    expect(startCandidate?.precedingWriteComponentIds).toEqual(["component:phase"]);
    expect(startCandidate?.sharedScenarioPlacementIds).toEqual(["scenario:round"]);
    expect(abortCandidate?.precedingWriteOperationIds).toEqual([blocked!.id]);
    expect(abortCandidate?.outcomeComponentIds).toEqual([]);
    expect(abortCandidate?.precedingWriteComponentIds).toEqual([]);
    expect(abortCandidate?.sharedScenarioPlacementIds).toEqual([]);
    expect(nav.knowledgeCoverage.wholeGameUnderstandingStatus)
      .toBe("NOT_MEASURABLE");
    // No additional causal evidence can be manufactured by this projection.
    expect(nav.causalLinks).toEqual([]);
  });


  it("links repeated authored state-write sites through intent and existing scenario navigation", () => {
    const source = {
      artifactId: "map:reset-flow",
      relativePath: "behavior_packs/demo/scripts/session.js",
    };
    const parsed = parseScriptFile("session", [
      'let phase = "idle";',
      "function resetArena() {",
      '  phase = "active";',
      '  phase = "active";',
      "}",
    ].join("\n"), source);
    const ir = buildInspectionSemanticIr({
      parsedFunctions: [], parsedScripts: [{ parsed }],
    });
    const writes = ir.state.operations
      .filter(item => item.operation === "write" &&
        item.writtenValue?.kind === "literal" &&
        item.writtenValue.value === "active")
      .map(item => item.id).sort();
    expect(writes).toHaveLength(2);
    const intent = buildGameplayIntentModel({
      id: "intent:reset", parsedScripts: [{ parsed }], semanticIr: ir,
    });
    const state = intent.nodes.find(item =>
      item.kind === "state" && item.label === "Phase Active");
    expect(state).toBeDefined();
    expect(writes.every(id => state!.evidenceIds.includes(id))).toBe(true);
    const relation = intent.edges.find(item =>
      item.kind === "transitions-to" && item.to === state!.id);
    expect(relation?.status).toBe("inferred");
    expect(writes.every(id => relation!.evidenceIds.includes(id))).toBe(true);

    const graph: GameplayScenarioGraph = {
      ...emptyGraph,
      components: [{
        id: state!.id, label: state!.label, kind: state!.kind,
        technicalRole: "source state write", gameplayPurpose: "unverified",
        evidenceIds: state!.evidenceIds,
        usedByScenarioIds: ["scenario:reset"], orphan: false,
      }],
      scenarios: [{
        id: "scenario:reset", label: "Reset candidate",
        gameplayStage: "CLEANUP", purpose: "unverified",
        sourceSubjectIds: [state!.id],
        componentIds: [state!.id],
        causalLinkIds: [], playerCounts: [],
        requiredKnowledgeIds: [], composedScenarioIds: [],
      }],
    };
    const nav = deriveGameplayArchitectureNavigation(graph, {
      relevantSourceCount: 1, indexedSourceCount: 1,
      arenaDetected: false, semanticIr: ir,
    });
    expect(nav.semanticIrCoverage.stateOperations.linkedIds).toEqual(writes);
    expect(nav.knowledgeCoverage.wholeGameUnderstandingStatus)
      .toBe("NOT_MEASURABLE");
    // Technical provenance cannot promote a gameplay transition to PROVEN.
    expect(nav.causalLinks).toEqual([]);
  });

  it("rejects ambiguous, cross-artifact, unpositioned and wrong-value state write bridges", () => {
    const source = {
      artifactId: "map:source",
      relativePath: "behavior_packs/demo/scripts/session.js",
    };
    const parsed = parseScriptFile("session", [
      'let phase = "idle";',
      "function resetArena() {",
      '  phase = "active";',
      "}",
    ].join("\n"), source);
    const ir = buildInspectionSemanticIr({
      parsedFunctions: [], parsedScripts: [{ parsed }],
    });
    const write = ir.state.operations.find(item =>
      item.operation === "write" &&
      item.writtenValue?.kind === "literal" &&
      item.writtenValue.value === "active");
    expect(write).toBeDefined();
    const linked = (observed: typeof ir): readonly string[] => {
      const intent = buildGameplayIntentModel({
        id: "intent:negative", parsedScripts: [{ parsed }],
        semanticIr: observed,
      });
      return intent.nodes.find(item =>
        item.kind === "state" && item.label === "Phase Active")?.evidenceIds ?? [];
    };
    expect(linked(ir)).toContain(write!.id);
    const crossArtifact = {
      ...ir, state: { ...ir.state,
        operations: ir.state.operations.map(item =>
          item.id === write!.id
            ? { ...item, source: { ...item.source, artifactId: "map:other" } }
            : item),
      },
    };
    expect(linked(crossArtifact)).not.toContain(write!.id);
    const noRange = {
      ...ir, state: { ...ir.state,
        operations: ir.state.operations.map(item =>
          item.id === write!.id
            ? { ...item, source: {
              artifactId: source.artifactId, relativePath: source.relativePath,
            } }
            : item),
      },
    };
    expect(linked(noRange)).not.toContain(write!.id);
    const wrongValue = {
      ...ir, state: { ...ir.state,
        operations: ir.state.operations.map(item =>
          item.id === write!.id
            ? { ...item, writtenValue: { kind: "literal" as const, value: "other" } }
            : item),
      },
    };
    expect(linked(wrongValue)).not.toContain(write!.id);
    const ambiguous = {
      ...ir, state: { ...ir.state,
        operations: [...ir.state.operations, { ...write!, id: write!.id + ":duplicate" }],
      },
    };
    expect(linked(ambiguous)).not.toContain(write!.id);
    expect(linked(ambiguous)).not.toContain(write!.id + ":duplicate");
    const withoutIr = buildGameplayIntentModel({
      id: "intent:without-ir", parsedScripts: [{ parsed }],
    });
    const syntheticOnly = withoutIr.nodes.find(item =>
      item.kind === "state" && item.label === "Phase Active");
    expect(syntheticOnly?.evidenceIds).not.toContain(write!.id);
  });

  it("connects an event-reachable pre-branch write to a guarded return without claiming gameplay success", () => {
    const source = { artifactId: "map:round-flow",
      relativePath: "behavior_packs/demo/scripts/round.js" };
    const parsed = parseScriptFile("round", [
      'import { world } from "@minecraft/server";',
      'let phase = "idle";',
      'function startRound(ready) {',
      '  phase = "prepared";',
      '  if (ready) return { action: "start" };',
      '  return { action: "abort" };',
      '}',
      'world.afterEvents.playerSpawn.subscribe(() => startRound(true));',
    ].join("\n"), source);
    const ir = buildInspectionSemanticIr({
      parsedFunctions: [], parsedScripts: [{ parsed }],
    });
    const write = ir.state.operations.find(item =>
      item.writtenValue?.kind === "literal" &&
      item.writtenValue.value === "prepared");
    const start = ir.execution.outcomes?.find(item => item.value === "start");
    const abort = ir.execution.outcomes?.find(item => item.value === "abort");
    expect(write && start && abort).toBeTruthy();
    const graph: GameplayScenarioGraph = {
      ...emptyGraph,
      components: [{
        id: "component:phase", label: "Prepared write",
        kind: "state", technicalRole: "authored state write",
        gameplayPurpose: "unverified", evidenceIds: [write!.id],
        usedByScenarioIds: ["scenario:start"], orphan: false,
      }, {
        id: "component:outcome", label: "Start return",
        kind: "outcome", technicalRole: "authored return",
        gameplayPurpose: "unverified", evidenceIds: [start!.id],
        usedByScenarioIds: ["scenario:start"], orphan: false,
      }],
      scenarios: [{
        id: "scenario:start", label: "Start candidate",
        gameplayStage: "ACTIVE", purpose: "unverified",
        sourceSubjectIds: [], componentIds: ["component:phase", "component:outcome"],
        causalLinkIds: [], playerCounts: [],
        requiredKnowledgeIds: [], composedScenarioIds: [],
      }],
    };
    const navigation = deriveGameplayArchitectureNavigation(graph, {
      relevantSourceCount: 1, indexedSourceCount: 1,
      arenaDetected: false, semanticIr: ir,
    });
    const startEvidence = navigation.semanticIrCoverage.stateOutcomeCandidates
      .find(item => item.outcomeId === start!.id);
    const abortEvidence = navigation.semanticIrCoverage.stateOutcomeCandidates
      .find(item => item.outcomeId === abort!.id);
    expect(startEvidence?.precedingWriteOperationIds).toEqual([write!.id]);
    expect(startEvidence?.status).toBe("SOURCE_ORDER_CANDIDATE");
    expect(startEvidence?.sharedScenarioPlacementIds).toEqual(["scenario:start"]);
    // Abort follows a direct early exit and has distinct precedence evidence.
    expect(abortEvidence?.precedingWriteOperationIds).toEqual([]);
    expect(abortEvidence?.status).toBe("UNRESOLVED");
    const reachableEvent = navigation.semanticIrCoverage.executionTraces
      .find(trace => trace.entryKind === "event-source" &&
        trace.returnOutcomeIds.includes(start!.id));
    expect(reachableEvent?.stateWriteOperationIds).toContain(write!.id);
    expect(reachableEvent?.returnOutcomeIds).toContain(abort!.id);
    expect(navigation.knowledgeCoverage.wholeGameUnderstandingStatus)
      .toBe("NOT_MEASURABLE");
    expect(navigation.causalLinks).toEqual([]);
  });


  it("keeps cleanup resource actions on their exact event-reachable branches", () => {
    const source = {
      artifactId: "map:resource-flow",
      relativePath: "behavior_packs/demo/scripts/round.js",
    };
    const parsed = parseScriptFile("round", [
      'import { world } from "@minecraft/server";',
      "function resolveRound(player, reject) {",
      "  if (reject) {",
      '    player.removeTag("playing");',
      '    return { action: "abort" };',
      "  } else {",
      '    player.removeTag("ready");',
      '    return { action: "finish" };',
      "  }",
      "}",
      "world.afterEvents.playerLeave.subscribe((event) => resolveRound(event.player, true));",
    ].join("\n"), source);
    const ir = buildInspectionSemanticIr({
      parsedFunctions: [], parsedScripts: [{ parsed }],
    });
    const playing = ir.state.resourceActions?.find(action =>
      action.action === "release" && action.key === "player:playing");
    const ready = ir.state.resourceActions?.find(action =>
      action.action === "release" && action.key === "player:ready");
    const abort = ir.execution.outcomes?.find(outcome => outcome.value === "abort");
    const finish = ir.execution.outcomes?.find(outcome => outcome.value === "finish");
    expect(playing && ready && abort && finish).toBeTruthy();
    expect(playing?.lexicalGuards?.map(guard => guard.branch)).toEqual(["true"]);
    expect(ready?.lexicalGuards?.map(guard => guard.branch)).toEqual(["false"]);

    const graph: GameplayScenarioGraph = {
      ...emptyGraph,
      components: [{
        id: "component:abort-resource", label: "Potential abort cleanup",
        kind: "lifecycle", technicalRole: "authored release",
        gameplayPurpose: "unverified", evidenceIds: [playing!.id, abort!.id],
        usedByScenarioIds: ["scenario:abort"], orphan: false,
      }, {
        id: "component:lookalike", label: "Unrelated cleanup",
        kind: "lifecycle", technicalRole: "unmatched",
        gameplayPurpose: "unverified", evidenceIds: [ready!.id + ":other"],
        usedByScenarioIds: [], orphan: true,
      }],
      scenarios: [{
        id: "scenario:abort", label: "Abort candidate",
        gameplayStage: "CLEANUP", purpose: "unverified",
        sourceSubjectIds: [], componentIds: ["component:abort-resource"],
        causalLinkIds: [], playerCounts: [],
        requiredKnowledgeIds: [], composedScenarioIds: [],
      }],
    };
    const nav = deriveGameplayArchitectureNavigation(graph, {
      relevantSourceCount: 1, indexedSourceCount: 1,
      arenaDetected: false, semanticIr: ir,
    });
    const trace = nav.semanticIrCoverage.executionTraces.find(item =>
      item.entryKind === "event-source" &&
      item.resourceActionIds.includes(playing!.id));
    expect(trace).toBeDefined();
    expect(trace?.resourceReleaseActionIds).toEqual([playing!.id, ready!.id].sort());
    const guardPoint = trace?.branchPoints.find(point =>
      point.expression === "reject" && point.source.range?.lineStart === 3);
    expect(guardPoint).toBeDefined();
    const yes = guardPoint!.branches.find(arm => arm.branch === "true");
    const no = guardPoint!.branches.find(arm => arm.branch === "false");
    expect(yes?.resourceActionIds).toEqual([playing!.id]);
    expect(yes?.resourceReleaseActionIds).toEqual([playing!.id]);
    expect(yes?.returnOutcomeIds).toContain(abort!.id);
    expect(no?.resourceActionIds).toEqual([ready!.id]);
    expect(no?.resourceReleaseActionIds).toEqual([ready!.id]);
    expect(no?.returnOutcomeIds).toContain(finish!.id);
    expect(yes?.evidenceMatchedComponentIds).toEqual(["component:abort-resource"]);
    expect(yes?.scenarioPlacementIds).toEqual(["scenario:abort"]);
    expect(no?.evidenceMatchedComponentIds).toEqual([]);
    expect(no?.evidenceWithoutComponentIds).toContain(ready!.id);
    expect(trace?.guardedResourceActions.find(action =>
      action.actionId === playing!.id)?.guards[0]?.source.range?.lineStart).toBe(3);
    expect(nav.semanticIrCoverage.resourceActions.linkedIds).toEqual([playing!.id]);
    expect(nav.knowledgeCoverage.wholeGameUnderstandingStatus)
      .toBe("NOT_MEASURABLE");
    // A possible release in an authored branch does not prove successful reset.
    expect(nav.causalLinks).toEqual([]);
  });


  it("reconciles source-observed cleanup and terminal returns through exact evidence, not scenario naming", () => {
    const source = {
      artifactId: "map:cleanup-chain",
      relativePath: "behavior_packs/demo/scripts/round.js",
    };
    const parsed = parseScriptFile("round", [
      'import { world } from "@minecraft/server";',
      'function resolveRound(player, ended) {',
      '  if (ended) {',
      '    player.removeTag("playing");',
      '    return { action: "finish" };',
      '  }',
      '  player.addTag("ready");',
      '  return { action: "retry" };',
      '}',
      'world.afterEvents.playerLeave.subscribe(event => resolveRound(event.player, true));',
    ].join("\n"), source);
    const ir = buildInspectionSemanticIr({
      parsedFunctions: [], parsedScripts: [{ parsed }],
    });
    const released = ir.state.resourceActions?.find(action =>
      action.action === "release" && action.key === "player:playing");
    const acquired = ir.state.resourceActions?.find(action =>
      action.action === "acquire" && action.key === "player:ready");
    const finish = ir.execution.outcomes?.find(outcome => outcome.value === "finish");
    const retry = ir.execution.outcomes?.find(outcome => outcome.value === "retry");
    expect(released && acquired && finish && retry).toBeTruthy();
    const graph: GameplayScenarioGraph = {
      ...emptyGraph,
      components: [{
        id: "component:release", label: "Cleanup resource candidate",
        kind: "lifecycle", technicalRole: "authored release",
        gameplayPurpose: "unknown", evidenceIds: [released!.id],
        usedByScenarioIds: ["scenario:finish"], orphan: false,
      }, {
        id: "component:finish", label: "Finish return candidate",
        kind: "outcome", technicalRole: "authored return",
        gameplayPurpose: "unknown", evidenceIds: [finish!.id],
        usedByScenarioIds: ["scenario:finish"], orphan: false,
      }, {
        id: "component:false-id", label: "Unrelated lookalike",
        kind: "lifecycle", technicalRole: "unrelated",
        gameplayPurpose: "unknown", evidenceIds: [acquired!.id + ":different"],
        usedByScenarioIds: [], orphan: true,
      }],
      scenarios: [{
        id: "scenario:finish", label: "Finish evidence only",
        gameplayStage: "TERMINAL", purpose: "unverified",
        sourceSubjectIds: [],
        componentIds: ["component:release", "component:finish"],
        causalLinkIds: [], playerCounts: [],
        requiredKnowledgeIds: [], composedScenarioIds: [],
      }],
    };
    const nav = deriveGameplayArchitectureNavigation(graph, {
      relevantSourceCount: 1, indexedSourceCount: 1,
      arenaDetected: false, semanticIr: ir,
    });
    const finishCandidate = nav.semanticIrCoverage.resourceOutcomeCandidates
      .find(candidate => candidate.outcomeId === finish!.id);
    const retryCandidate = nav.semanticIrCoverage.resourceOutcomeCandidates
      .find(candidate => candidate.outcomeId === retry!.id);
    expect(finishCandidate?.precedingResourceActionIds).toEqual([released!.id]);
    expect(finishCandidate?.precedingReleaseActionIds).toEqual([released!.id]);
    expect(finishCandidate?.status).toBe("SOURCE_ORDER_CANDIDATE");
    expect(finishCandidate?.outcomeComponentIds).toEqual(["component:finish"]);
    expect(finishCandidate?.precedingResourceComponentIds)
      .toEqual(["component:release"]);
    expect(finishCandidate?.sharedScenarioPlacementIds)
      .toEqual(["scenario:finish"]);
    expect(retryCandidate?.precedingResourceActionIds).toEqual([acquired!.id]);
    expect(retryCandidate?.precedingReleaseActionIds).toEqual([]);
    expect(retryCandidate?.sharedScenarioPlacementIds).toEqual([]);
    const trace = nav.semanticIrCoverage.executionTraces.find(item =>
      item.entryKind === "event-source" && item.returnOutcomeIds.includes(finish!.id));
    expect(trace?.resourceReleaseActionIds).toContain(released!.id);
    expect(nav.knowledgeCoverage.wholeGameUnderstandingStatus).toBe("NOT_MEASURABLE");
    expect(nav.causalLinks).toEqual([]);
  });


  it("measures exact source relationships missing from scenario causality without inventing game completion", () => {
    const source = { artifactId: "world:wave",
      relativePath: "behavior_packs/demo/scripts/round.js" };
    const parsed = parseScriptFile("round", [
      'import { world } from "@minecraft/server";',
      'let phase = "idle";',
      'function settle(player, ready) {',
      '  if (ready) {',
      '    phase = "finished";',
      '    player.removeTag("playing");',
      '    return { action: "finish" };',
      '  } else {',
      '    phase = "retry";',
      '    player.addTag("ready");',
      '    return { action: "retry" };',
      '  }',
      '}',
      'world.afterEvents.playerLeave.subscribe(event => settle(event.player, true));',
    ].join("\n"), source);
    const ir = buildInspectionSemanticIr({
      parsedFunctions: [], parsedScripts: [{ parsed }],
    });
    const finished = ir.execution.outcomes?.find(item => item.value === "finish");
    const retried = ir.execution.outcomes?.find(item => item.value === "retry");
    const finishedWrite = ir.state.operations.find(item =>
      item.writtenValue?.kind === "literal" && item.writtenValue.value === "finished");
    const retryWrite = ir.state.operations.find(item =>
      item.writtenValue?.kind === "literal" && item.writtenValue.value === "retry");
    const release = ir.state.resourceActions?.find(item =>
      item.key === "player:playing" && item.action === "release");
    const acquire = ir.state.resourceActions?.find(item =>
      item.key === "player:ready" && item.action === "acquire");
    expect(finished && retried && finishedWrite && retryWrite && release && acquire)
      .toBeTruthy();

    // Read-only measurement is present even when no Gameplay Intent or
    // scenario ever adopted these exact technical records.
    const bare = deriveGameplayArchitectureNavigation(emptyGraph, {
      relevantSourceCount: 1, indexedSourceCount: 1,
      arenaDetected: false, semanticIr: ir,
    });
    const event = bare.semanticIrCoverage.executionTraces.find(trace =>
      trace.entryKind === "event-source" &&
      trace.returnOutcomeIds.includes(finished!.id));
    expect(event).toBeDefined();
    const relationship = (nav: typeof bare, from: string, to: string) =>
      nav.semanticIrCoverage.observedSourceRelationships.find(item =>
        item.fromEvidenceId === from && item.outcomeId === to);
    const entryPair = relationship(bare, event!.entryRegionId, finished!.id);
    const resourcePair = relationship(bare, release!.id, finished!.id);
    const statePair = relationship(bare, finishedWrite!.id, finished!.id);
    expect(entryPair?.sourceBasis).toBe("TRACE_REACHABILITY");
    expect(entryPair?.gap).toBe("NOT_IN_COMMON_SCENARIO");
    expect(resourcePair?.sourceBasis).toBe("SOURCE_ORDER_CANDIDATE");
    expect(resourcePair?.gap).toBe("NOT_IN_COMMON_SCENARIO");
    expect(statePair?.gap).toBe("NOT_IN_COMMON_SCENARIO");
    expect(relationship(bare, release!.id, retried!.id)).toBeUndefined();
    expect(relationship(bare, acquire!.id, finished!.id)).toBeUndefined();
    expect(relationship(bare, retryWrite!.id, finished!.id)).toBeUndefined();
    expect(bare.architectureReconciliation.sourceRelationshipsWithoutProofCount)
      .toBe(bare.architectureReconciliation.observedSourceRelationshipCount);
    expect(bare.semanticIrCoverage.untracedReturnOutcomeIds).toEqual([]);
    expect(bare.architectureReconciliation.status).toBe("GAPS_PRESENT");

    const graph: GameplayScenarioGraph = {
      ...emptyGraph,
      components: [{
        id: "component:event", label: "Event source candidate",
        kind: "lifecycle", technicalRole: "event",
        gameplayPurpose: "unverified", evidenceIds: [event!.entryRegionId],
        usedByScenarioIds: ["scenario:finish"], orphan: false,
      }, {
        id: "component:write", label: "State write candidate",
        kind: "state", technicalRole: "state",
        gameplayPurpose: "unverified", evidenceIds: [finishedWrite!.id],
        usedByScenarioIds: ["scenario:finish"], orphan: false,
      }, {
        id: "component:release", label: "Release candidate",
        kind: "lifecycle", technicalRole: "release",
        gameplayPurpose: "unverified", evidenceIds: [release!.id],
        usedByScenarioIds: ["scenario:finish"], orphan: false,
      }, {
        id: "component:outcome", label: "Return candidate",
        kind: "outcome", technicalRole: "return",
        gameplayPurpose: "unverified", evidenceIds: [finished!.id],
        usedByScenarioIds: ["scenario:finish"], orphan: false,
      }],
      scenarios: [{
        id: "scenario:finish", label: "Finish candidate",
        gameplayStage: "TERMINAL", purpose: "unverified",
        sourceSubjectIds: [], componentIds: [
          "component:event", "component:write", "component:release", "component:outcome",
        ],
        causalLinkIds: [], playerCounts: [],
        requiredKnowledgeIds: [], composedScenarioIds: [],
      }],
    };
    const placed = deriveGameplayArchitectureNavigation(graph, {
      relevantSourceCount: 1, indexedSourceCount: 1,
      arenaDetected: false, semanticIr: ir,
    });
    expect(relationship(placed, release!.id, finished!.id)?.sharedScenarioIds)
      .toEqual(["scenario:finish"]);
    expect(relationship(placed, release!.id, finished!.id)?.gap)
      .toBe("CAUSAL_PROOF_MISSING");
    expect(relationship(placed, retryWrite!.id, retried!.id)?.gap)
      .toBe("NOT_IN_COMMON_SCENARIO");

    // A link labeled PROVEN is insufficient when it omits one of the
    // exact paired source IDs; scene membership is never causal proof.
    const proof: GameplayScenarioGraph["causalLinks"][number] = {
      id: "link:resource-to-return", scenarioId: "scenario:finish",
      fromComponentId: "component:release", toComponentId: "component:outcome",
      purpose: "Authored source relationship (not runtime completion)",
      evidenceIds: [release!.id, finished!.id],
      subjectIds: [], componentIds: ["component:release", "component:outcome"],
      knowledgeRequirementIds: [], impactPathComponentIds: [],
      impactPathEvidenceIds: [], dimensionEvidence: {},
      status: "PROVEN", reason: "Mock existing scenario proof for projection verification",
    };
    const linkedGraph: GameplayScenarioGraph = {
      ...graph, causalLinks: [proof],
      scenarios: graph.scenarios.map(scenario => ({
        ...scenario, causalLinkIds: [proof.id],
      })),
    };
    const withoutExactReturn = deriveGameplayArchitectureNavigation({
      ...linkedGraph, causalLinks: [{ ...proof, evidenceIds: [release!.id] }],
    }, {
      relevantSourceCount: 1, indexedSourceCount: 1,
      arenaDetected: false, semanticIr: ir,
    });
    expect(relationship(withoutExactReturn, release!.id, finished!.id)?.gap)
      .toBe("CAUSAL_PROOF_MISSING");
    const exact = deriveGameplayArchitectureNavigation(linkedGraph, {
      relevantSourceCount: 1, indexedSourceCount: 1,
      arenaDetected: false, semanticIr: ir,
    });
    expect(relationship(exact, release!.id, finished!.id)?.gap).toBeNull();
    expect(relationship(exact, release!.id, finished!.id)?.exactProvenCausalLinkIds)
      .toEqual([proof.id]);
    expect(exact.architectureReconciliation.sourceRelationshipsWithoutProofCount)
      .toBe(placed.architectureReconciliation.sourceRelationshipsWithoutProofCount - 1);
    expect(exact.knowledgeCoverage.wholeGameUnderstandingStatus)
      .toBe("NOT_MEASURABLE");
  });

  it("retains source-order ambiguity as a relationship gap even for same-named states", () => {
    const source = { artifactId: "world:puzzle",
      relativePath: "behavior_packs/puzzle/scripts/door.js" };
    const parsed = parseScriptFile("door", [
      'let doorState = "closed";',
      'function useButton(ready) {',
      '  if (ready) {',
      '    doorState = "opening";',
      '    doorState = "opened";',
      '    return { action: "open" };',
      '  }',
      '}',
    ].join("\n"), source);
    const ir = buildInspectionSemanticIr({
      parsedFunctions: [], parsedScripts: [{ parsed }],
    });
    const opened = ir.execution.outcomes?.find(item => item.value === "open");
    expect(opened).toBeDefined();
    const navigation = deriveGameplayArchitectureNavigation(emptyGraph, {
      relevantSourceCount: 1, indexedSourceCount: 1,
      arenaDetected: false, semanticIr: ir,
    });
    const links = navigation.semanticIrCoverage.observedSourceRelationships
      .filter(item => item.outcomeId === opened!.id &&
        item.kind === "state-write-to-outcome");
    expect(links).toHaveLength(2);
    expect(links.every(link =>
      link.sourceBasis === "SOURCE_ORDER_UNRESOLVED" &&
      link.gap === "SOURCE_RELATION_UNRESOLVED")).toBe(true);
    expect(links.every(link => link.exactProvenCausalLinkIds.length === 0))
      .toBe(true);
    expect(navigation.semanticIrCoverage.untracedReturnOutcomeIds)
      .toContain(opened!.id);
    expect(navigation.architectureReconciliation.observedOutcomesWithoutEntryCount)
      .toBeGreaterThan(0);
    expect(navigation.knowledgeCoverage.wholeGameUnderstandingPercent).toBeNull();
  });


  it("reaches imported cleanup and finish outcomes through exact ESM call edges", () => {
    const sourceFor = (path: string) => ({
      artifactId: "world:crossfile", relativePath: path,
    });
    const pathMain = "behavior_packs/demo/scripts/main.js";
    const pathRound = "behavior_packs/demo/scripts/round.js";
    const mainText = [
      'import { world } from "@minecraft/server";',
      'import { settleRound as finishRound } from "./round.js";',
      'world.afterEvents.playerLeave.subscribe(event => finishRound(event.player));',
    ].join("\n");
    const roundText = [
      'export function settleRound(player) {',
      '  player.removeTag("playing");',
      '  return { action: "finish" };',
      '}',
    ].join("\n");
    const parsedMain = parseScriptFile("main", mainText, sourceFor(pathMain));
    const parsedRound = parseScriptFile("round", roundText, sourceFor(pathRound));
    const crossFileCallEdges = deriveCrossFileCallEdges([
      { path: pathMain, text: mainText, source: sourceFor(pathMain) },
      { path: pathRound, text: roundText, source: sourceFor(pathRound) },
    ]);
    expect(crossFileCallEdges).toEqual([expect.objectContaining({
      callerModule: pathMain, targetModule: pathRound,
      localName: "finishRound", targetExport: "settleRound",
      targetRegion: "function:settleRound", status: "resolved",
    })]);
    const ir = buildInspectionSemanticIr({
      parsedFunctions: [], parsedScripts: [
        { parsed: parsedMain }, { parsed: parsedRound },
      ], crossFileCallEdges,
    });
    const linked = ir.execution.edges.find(edge =>
      edge.targetLabel === "finishRound");
    expect(linked?.resolution).toBe("resolved");
    expect(linked?.source.relativePath).toBe(pathMain);
    expect(linked?.to).toContain(encodeURIComponent(pathRound));
    expect(linked?.to).toContain("function%3AsettleRound");
    const outcome = ir.execution.outcomes?.find(item => item.value === "finish");
    const released = ir.state.resourceActions?.find(item =>
      item.action === "release" && item.key === "player:playing");
    expect(outcome && released).toBeTruthy();
    const nav = deriveGameplayArchitectureNavigation(emptyGraph, {
      relevantSourceCount: 2, indexedSourceCount: 2,
      arenaDetected: false, semanticIr: ir,
    });
    const eventTrace = nav.semanticIrCoverage.executionTraces.find(trace =>
      trace.entryKind === "event-source" &&
      trace.returnOutcomeIds.includes(outcome!.id));
    expect(eventTrace).toBeDefined();
    expect(eventTrace?.executionEdgeIds).toContain(linked!.id);
    expect(eventTrace?.resourceReleaseActionIds).toContain(released!.id);
    expect(eventTrace?.regionIds).toContain(linked!.to);
    expect(nav.semanticIrCoverage.observedSourceRelationships.some(item =>
      item.kind === "entry-to-outcome" &&
      item.fromEvidenceId === eventTrace!.entryRegionId &&
      item.outcomeId === outcome!.id &&
      item.gap === "NOT_IN_COMMON_SCENARIO")).toBe(true);
    expect(nav.knowledgeCoverage.wholeGameUnderstandingStatus)
      .toBe("NOT_MEASURABLE");
    expect(nav.causalLinks).toEqual([]);
  });

  it("keeps unresolved or foreign exported call targets outside gameplay traces", () => {
    const mainPath = "behavior_packs/a/scripts/main.js";
    const otherPath = "behavior_packs/a/scripts/round.js";
    const mainSource = { artifactId: "world:a", relativePath: mainPath };
    const otherSource = { artifactId: "world:b", relativePath: otherPath };
    const mainText = [
      'import { settleRound } from "./round.js";',
      'settleRound();',
    ].join("\n");
    const roundText = 'export function settleRound() { return { action: "finish" }; }';
    const crossFileCallEdges = deriveCrossFileCallEdges([
      { path: mainPath, text: mainText, source: mainSource },
      { path: otherPath, text: roundText, source: otherSource },
    ]);
    expect(crossFileCallEdges[0]).toMatchObject({ status: "unresolved" });
    const ir = buildInspectionSemanticIr({
      parsedFunctions: [], parsedScripts: [
        { parsed: parseScriptFile("main", mainText, mainSource) },
        { parsed: parseScriptFile("other", roundText, otherSource) },
      ], crossFileCallEdges,
    });
    const edge = ir.execution.edges.find(item =>
      item.targetLabel === "settleRound");
    expect(edge?.resolution).toBe("unresolved");
    expect(edge?.to).toBeUndefined();
    const trace = deriveGameplayArchitectureNavigation(emptyGraph, {
      relevantSourceCount: 2, indexedSourceCount: 2,
      arenaDetected: false, semanticIr: ir,
    }).semanticIrCoverage.executionTraces.find(item =>
      item.entryKind === "script-module" &&
      item.regionIds.includes(edge!.from));
    expect(trace?.unresolvedExecutionEdgeIds).toContain(edge!.id);
    expect(trace?.returnOutcomeIds).toEqual([]);
  });

  it("keeps two exact imported calls to one authored return distinct", () => {
    const root = "behavior_packs/demo/scripts/";
    const src = (relativePath: string) => ({
      artifactId: "sample:round", relativePath: root + relativePath,
    });
    const mainText = [
      'import { resetRound as resetArena } from "./round.js";',
      'function finishSession() { resetArena(); resetArena(); }',
    ].join("\n");
    const roundText = 'export function resetRound() { return { action: "finish" }; }';
    const sources = [
      { path: src("main.js").relativePath, text: mainText, source: src("main.js") },
      { path: src("round.js").relativePath, text: roundText, source: src("round.js") },
    ];
    const ir = buildInspectionSemanticIr({
      parsedFunctions: [],
      parsedScripts: sources.map(item => ({
        parsed: parseScriptFile(item.path, item.text, item.source),
      })),
      crossFileCallEdges: deriveCrossFileCallEdges(sources),
    });
    const calls = ir.execution.edges.filter(e => e.targetLabel === "resetArena");
    const outcome = ir.execution.outcomes?.find(o => o.value === "finish");
    expect(calls).toHaveLength(2);
    expect(outcome).toBeDefined();
    const pairs = (model: typeof ir) =>
      deriveGameplayArchitectureNavigation(emptyGraph, {
        relevantSourceCount: 2, indexedSourceCount: 2,
        arenaDetected: false, semanticIr: model,
      }).semanticIrCoverage.observedSourceRelationships.filter(r =>
        r.kind === "direct-call-to-outcome" && r.outcomeId === outcome!.id);
    expect(pairs(ir).map(p => p.fromEvidenceId).sort())
      .toEqual(calls.map(c => c.id).sort());
    expect(pairs(ir).every(p => p.sourceBasis === "DIRECT_CALL_TARGET" &&
      p.gap === "NOT_IN_COMMON_SCENARIO")).toBe(true);
    const update = (predicate: (edge: typeof calls[number]) => typeof calls[number]) => ({
      ...ir, execution: { ...ir.execution, edges: ir.execution.edges.map(e =>
        e.targetLabel === "resetArena" ? predicate(e) : e),
      },
    });
    expect(pairs(update(e => {
      const { to: _unresolvedTarget, ...withoutTarget } = e;
      return { ...withoutTarget, resolution: "unresolved" };
    })))
      .toEqual([]);
    expect(pairs(update(e => ({ ...e, source: {
      artifactId: "sample:round", relativePath: src("main.js").relativePath,
    } })))).toEqual([]);
    expect(pairs({ ...ir, execution: { ...ir.execution,
      outcomes: ir.execution.outcomes!.map(o => ({
        ...o, source: { ...o.source, artifactId: "other-world" },
      })),
    } })).toEqual([]);
  });


  it("keeps imported true/false and preceding-exit call arms distinct in execution navigation", () => {
    const root = "behavior_packs/demo/scripts/";
    const origin = (relativePath: string) => ({
      artifactId: "map:branch", relativePath: root + relativePath,
    });
    const main = [
      'import { world, system } from "@minecraft/server";',
      'import { settle } from "./round.js";',
      'import * as rounds from "./round.js";',
      'function resolveRound(ready) {',
      '  if (ready) { settle(); }',
      '  else { rounds.settle(); }',
      '  if (!ready) return;',
      '  settle();',
      '  if (ready) system.run(() => settle());',
      '}',
      'world.afterEvents.playerLeave.subscribe(() => resolveRound(true));',
    ].join("\n");
    const round = 'export function settle() { return { action: "finish" }; }';
    const sources = [
      { path: origin("main.js").relativePath, text: main, source: origin("main.js") },
      { path: origin("round.js").relativePath, text: round, source: origin("round.js") },
    ];
    const parsed = sources.map(item => ({
      parsed: parseScriptFile(item.path, item.text, item.source),
    }));
    const crossFileCallEdges = deriveCrossFileCallEdges(sources);
    expect(crossFileCallEdges).toHaveLength(4);
    const ir = buildInspectionSemanticIr({
      parsedFunctions: [], parsedScripts: parsed, crossFileCallEdges,
    });
    const calls = ir.execution.edges.filter(edge =>
      edge.kind === "synchronous-call" &&
      (edge.targetLabel === "settle" || edge.targetLabel === "rounds.settle"));
    expect(calls).toHaveLength(4);
    const at = (line: number) => calls.find(edge =>
      edge.source.range?.lineStart === line)!;
    expect(at(5).lexicalGuards?.map(g => [g.expression, g.branch]))
      .toEqual([["ready", "true"]]);
    expect(at(6).lexicalGuards?.map(g => [g.expression, g.branch]))
      .toEqual([["ready", "false"]]);
    expect(at(8).precedenceGuards?.map(g =>
      [g.expression, g.branch, g.source.range?.lineStart]))
      .toEqual([["!ready", "false", 7]]);
    // A scheduled nested callback is a new execution region; its invocation
    // cannot inherit the enclosing ready=true branch of the scheduler.
    expect(at(9).lexicalGuards ?? []).toEqual([]);
    expect(at(9).precedenceGuards ?? []).toEqual([]);
    const nav = deriveGameplayArchitectureNavigation(emptyGraph, {
      relevantSourceCount: 2, indexedSourceCount: 2,
      arenaDetected: false, semanticIr: ir,
    });
    const trace = nav.semanticIrCoverage.executionTraces.find(t =>
      t.entryKind === "event-source" &&
      t.executionEdgeIds.includes(at(5).id));
    expect(trace).toBeDefined();
    const branch = trace!.branchPoints.find(point =>
      point.expression === "ready" && point.source.range?.lineStart === 5);
    expect(branch?.branches.find(arm => arm.branch === "true")
      ?.executionEdgeIds).toContain(at(5).id);
    expect(branch?.branches.find(arm => arm.branch === "false")
      ?.executionEdgeIds).toContain(at(6).id);
    expect(branch?.branches.find(arm => arm.branch === "false")
      ?.executionEdgeIds).not.toContain(at(5).id);
    const preceding = trace!.branchPoints.find(point =>
      point.expression === "!ready" && point.source.range?.lineStart === 7);
    expect(preceding?.branches.find(arm => arm.branch === "false")
      ?.precedenceEvidenceIds).toContain(at(8).id);
    expect(nav.knowledgeCoverage.wholeGameUnderstandingStatus).toBe("NOT_MEASURABLE");
  });

  it("keeps unclassified source effects attached to their exact entry, not a foreign flow", () => {
    const src = {
      artifactId: "world:entry-scope",
      relativePath: "behavior_packs/demo/scripts/flow.js",
    };
    const ir = {
      schemaVersion: 1,
      execution: {
        regions: [
          { id: "entry:alpha", kind: "event-source", ownerId: "world",
            label: "start", source: src },
          { id: "entry:beta", kind: "event-source", ownerId: "world",
            label: "unused", source: src },
          { id: "function:apply", kind: "script-function", ownerId: "game",
            label: "apply", source: src },
        ],
        edges: [{
          id: "edge:alpha-apply", from: "entry:alpha", to: "function:apply",
          kind: "synchronous-call", resolution: "resolved",
          targetLabel: "apply", source: src,
        }],
      },
      state: {
        surfaces: [], authorityBindings: [],
        operations: [{
          id: "state:write", executionRegionId: "function:apply",
          surfaceId: "score:round", operation: "write", source: src,
        }],
      },
      temporal: { relations: [] },
    } as unknown as import("../../../semantic-ir/src/index.js").SemanticIr;
    const navigation = deriveGameplayArchitectureNavigation(emptyGraph, {
      relevantSourceCount: 1,
      indexedSourceCount: 1,
      arenaDetected: false,
      semanticIr: ir,
      intentUnknowns: [{
        id: "unknown:alpha", question: "What does alpha change?",
        blockedSubjectIds: [],
        evidenceIds: ["state:write"],
        sourceEntryRegionId: "entry:alpha",
      }, {
        id: "unknown:beta", question: "Does beta also change state?",
        blockedSubjectIds: [],
        evidenceIds: ["state:write"],
        sourceEntryRegionId: "entry:beta",
      }],
    });
    const alpha = navigation.gameplayStructure.uninterpretedSourceFlows.find(
      flow => flow.unknownId === "unknown:alpha");
    const beta = navigation.gameplayStructure.uninterpretedSourceFlows.find(
      flow => flow.unknownId === "unknown:beta");
    expect(alpha?.effectPaths.map(path => path.effectId))
      .toEqual(["state:write"]);
    expect(alpha?.effectPaths[0]?.matchingIngress).toEqual([
      expect.objectContaining({ executionEdgeIds: ["edge:alpha-apply"] }),
    ]);
    expect(alpha?.materialIdsWithoutEffectSlice).toEqual([]);
    expect(beta?.effectPaths).toEqual([]);
    expect(beta?.materialIdsWithoutEffectSlice).toEqual(["state:write"]);
    expect(navigation.knowledgeCoverage.wholeGameUnderstandingPercent).toBeNull();
  });

  it("does not inherit imported-call guards from similar names or nonmatching source spans", () => {
    const prefix = "behavior_packs/demo/scripts/";
    const source = (path: string) => ({
      artifactId: "map:negative", relativePath: prefix + path,
    });
    const main = [
      'import { settle } from "./round.js";',
      'function resetArena(ready) { if (ready) settle(); }',
    ].join("\n");
    const round = 'export function settle() {}';
    const modules = [
      { path: source("main.js").relativePath, text: main, source: source("main.js") },
      { path: source("round.js").relativePath, text: round, source: source("round.js") },
    ];
    const parsed = modules.map(item => ({
      parsed: parseScriptFile(item.path, item.text, item.source),
    }));
    const call = deriveCrossFileCallEdges(modules)[0]!;
    const create = (edge: typeof call) => buildInspectionSemanticIr({
      parsedFunctions: [], parsedScripts: parsed,
      crossFileCallEdges: [edge],
    });
    const intact = create(call).execution.edges.find(edge =>
      edge.targetLabel === "settle");
    expect(intact?.lexicalGuards?.map(g => g.branch)).toEqual(["true"]);
    const misplaced = create({ ...call, source: {
      ...call.source, range: {
        ...call.source.range!, columnStart: call.source.range!.columnStart! + 1,
      },
    } }).execution.edges.find(edge => edge.targetLabel === "settle");
    expect(misplaced?.lexicalGuards).toBeUndefined();
    const foreign = create({ ...call, source: {
      ...call.source, artifactId: "another-artifact",
    } });
    expect(foreign.execution.edges.some(edge =>
      edge.targetLabel === "settle")).toBe(false);
    const noParserGuards = buildInspectionSemanticIr({
      parsedFunctions: [], parsedScripts: parsed.map(item => ({
        parsed: { ...item.parsed, importedCallGuardSites: [] },
      })),
      crossFileCallEdges: [call],
    }).execution.edges.find(edge => edge.targetLabel === "settle");
    expect(noParserGuards?.lexicalGuards).toBeUndefined();
  });

  it("does not reconcile duplicate spatial arena identities", () => {
    const navigation = deriveGameplayArchitectureNavigation(emptyGraph, {
      relevantSourceCount: 1,
      indexedSourceCount: 1,
      arenaDetected: true,
      arenaCount: 2,
      spatialLayout: {
        canonical: { arenaId: "arena-1", anchor: { x: 0, y: 0, z: 0 } },
        replicas: [{ arenaId: "arena-1", anchor: { x: 100, y: 0, z: 0 } }],
        confidence: "high",
      },
    });

    expect(navigation.knowledgeCoverage.arenaEvidence.arenasWithoutSpatialLayoutCount).toBeNull();
    expect(navigation.architectureReconciliation.arenaMappingUnresolved).toBe(true);
    expect(navigation.architectureReconciliation.status).toBe("GAPS_PRESENT");
  });

});
