import { describe, expect, it } from "vitest";
import { sourceFlowCandidates, compileGameplayScenarioGraph } from "../../src/inspection/gameplay-scenario-compiler.js";
import { buildInspectionSemanticIr } from "../../src/diagnosis/semantic-ir-stage.js";
import { parseScriptFile } from "../../../../analyzers/scripts/src/index.js";
import type { SemanticIr } from "../../../semantic-ir/src/index.js";

const origin = { artifactId: "selected", relativePath: "scripts/start.ts" };
const target = { artifactId: "selected", relativePath: "scripts/round.ts" };
const other = { artifactId: "other", relativePath: "scripts/foreign.ts" };

function sample(overrideTarget = target): SemanticIr {
  return {
    schemaVersion: 1,
    execution: {
      regions: [
        { id: "entry", ownerId: "start", label: "start",
          kind: "script-module", source: origin },
        { id: "callback", ownerId: "round", label: "callback",
          kind: "script-callback", source: overrideTarget },
        { id: "unrelated", ownerId: "other", label: "other",
          kind: "script-callback", source: target },
      ],
      edges: [
        { id: "edge:deferred", from: "entry", to: "callback",
          kind: "deferred", targetLabel: "round-callback",
          resolution: "resolved", source: origin,
          scheduler: "runTimeout", guardEvidence: "unresolved" },
        { id: "edge:unknown", from: "entry",
          kind: "synchronous-call", targetLabel: "dynamic-target",
          resolution: "unresolved", source: origin },
      ],
      worldEffects: [{
        id: "effect:teleport", executionRegionId: "callback",
        kind: "teleport", mechanism: "script-api",
        targetLabel: "player", precision: "typed-method",
        source: overrideTarget,
      }],
    },
    state: {
      surfaces: [{ id: "state:round",
        ref: { kind: "dynamic-property", key: "round" } }],
      operations: [{
        id: "op:round-write", executionRegionId: "callback",
        surfaceId: "state:round", operation: "write", source: overrideTarget,
      }, {
        id: "op:unrelated", executionRegionId: "unrelated",
        surfaceId: "state:round", operation: "write", source: target,
      }],
      resourceActions: [{
        id: "release:join-pad", executionRegionId: "callback",
        surface: "tag", action: "release", key: "join-pad",
        precision: "exact", source: overrideTarget,
      }],
      authorityBindings: [],
    },
    temporal: { relations: [] },
  };
}

describe("cross-region source handoff tracing", () => {
  it("links a resolved deferred edge to only its DIRECT callback state/teleport/cleanup", () => {
    const flows = sourceFlowCandidates(sample());
    const entry = flows.find(flow => flow.entryRegionId === "entry");
    expect(entry).toBeDefined();
    expect(entry?.sourceTraceStatus).toBe("SOURCE_ROOT_TRACE");
    const disconnected = flows.find(flow =>
      flow.entryRegionId === "unrelated");
    expect(disconnected?.sourceTraceStatus).toBe("DISCONNECTED_SOURCE_REGION");
    expect(disconnected?.sourceSteps.map(step => step.id)).toEqual([
      "op:unrelated",
    ]);
    expect(entry?.sourceHandoffs).toEqual([
      expect.objectContaining({
        edgeId: "edge:deferred",
        fromRegionId: "entry", toRegionId: "callback",
        kind: "deferred", scheduler: "runTimeout",
        generationGuard: "UNRESOLVED",
        directTargetStateWriteIds: ["op:round-write"],
        directTargetWorldEffectIds: ["effect:teleport"],
        directTargetReleaseIds: ["release:join-pad"],
        proof: "RESOLVED_SOURCE_EDGE_NOT_RUNTIME_EXECUTION",
      }),
    ]);
    expect(entry?.sourceHandoffs?.[0]?.directTargetStepIds)
      .not.toContain("op:unrelated");
    expect(entry?.sourceHandoffs?.some(item =>
      item.edgeId === "edge:unknown")).toBe(false);
  });

  it("keeps an orphan state mutation as source evidence without supporting a mechanic or journey", () => {
    const ir = sample();
    const intent = {
      schemaVersion: 1,
      id: "intent:orphan",
      artifactId: "selected",
      evidence: [{
        id: "op:unrelated", origin: "source-code",
        locator: "scripts/round.ts:1", scope: "selected-artifact",
        summary: "Authored state write in an uncalled script callback",
      }],
      nodes: [{
        id: "mechanic:uncalled", kind: "mechanic",
        label: "Uncalled party cleanup", status: "authored",
        description: "Resets all teams to continue gameplay.",
        evidenceIds: ["op:unrelated"],
      }],
      edges: [], invariants: [], unknowns: [],
    } as import("../../../gameplay-intent/src/index.js").GameplayIntentModel;
    const world = {
      arenas: { detected: false, cleanup: { resourceLedger: { resources: 0 } } },
      chunks: { tickingAreaAcquires: 0, tickingAreaReadinessStates: 0,
        capacityUncheckedLeases: 0 },
      entities: { definitions: 0 },
      combat: { hurtHandlers: 0, deathHandlers: 0, damageApplications: 0 },
      inventory: { regions: 0, grantRegions: 0 },
      structures: { loads: 0, runtimeLogicLoads: 0 },
      economy: { sourceKinds: [] },
      worldRules: { writes: 0, manualEntitySpawnPaths: 0 },
      playerCapabilities: { gamemodeWrites: 0, abilityWrites: 0,
        commandPermissionWrites: 0, privilegedGuardReferences: 0,
        protectionDefinitions: 0 },
      capabilityExposure: { exposed: 0, potentiallyExposed: 0, unresolved: 0 },
      clientReconciliation: { predictedMutationCancellations: 0 },
      spatial: { resolvedScriptEffects: 0, structurePlacements: 0,
        authority: { configured: false } },
    } as unknown as import("../../src/inspection/gameplay-world-model.js").GameplayWorldModel;
    const graph = compileGameplayScenarioGraph({
      intent, world,
      preset: { scenarios: [] } as unknown as
        import("../../../diagnostic-reasoning/src/index.js").GameplayAuditScenarioPreset,
      semanticIr: ir,
    });
    const mechanic = graph.mechanicReconstructions?.find(item =>
      item.featureId === "mechanic:uncalled");
    expect(graph.scenarios.find(item =>
      item.sourceSubjectIds.includes("mechanic:uncalled"))?.purpose)
      .toContain("Gameplay purpose UNKNOWN");
    expect(graph.components.find(item =>
      item.id === "mechanic:uncalled")?.gameplayPurpose)
      .toContain("Gameplay purpose UNKNOWN");
    expect(mechanic?.exactSourceFlowIds).toEqual([]);
    expect(mechanic?.disconnectedSourceFlowIds).toEqual([
      "source-flow:unrelated",
    ]);
    expect(mechanic?.exactSourceStepIds).toContain("op:unrelated");
    expect(mechanic?.sourceActivationCandidates).toEqual([]);
    expect(mechanic?.unresolvedDimensions).toContain("NO_EXACT_IR_LINK");
    expect(graph.sourceFlowCandidates?.find(flow =>
      flow.entryRegionId === "unrelated")?.runtimeStatus).toBe("NOT_OBSERVED");
  });

  it("abstains on cross-artifact and unresolvable source joins", () => {
    const cross = sourceFlowCandidates(sample(other))
      .find(flow => flow.entryRegionId === "entry");
    expect(cross?.sourceHandoffs ?? []).toHaveLength(0);
    const unresolvedOnly = sample();
    unresolvedOnly.execution.edges = unresolvedOnly.execution.edges
      .filter(edge => edge.resolution === "unresolved");
    const selected = sourceFlowCandidates(unresolvedOnly)
      .find(flow => flow.entryRegionId === "entry");
    expect(selected?.sourceHandoffs ?? []).toHaveLength(0);
  });

  it("preserves exact caller/target locations through event, delayed callback, same-bundle static call and state write", () => {
    const source = {
      artifactId: "composite:selected-sha",
      relativePath: "behavior_packs/BP/scripts/chunks/composite.js",
    };
    const code = [
      'import { world, system } from "@minecraft/server";',
      "var CompositeSessionService = class {",
      '  static persist(arenaId) { world.setDynamicProperty("arena:phase", "active"); }',
      "};",
      "world.afterEvents.playerSpawn.subscribe(() => {",
      "  system.runTimeout(() => {",
      '    if (!world.getDynamicProperty("arena:ready")) return;',
      '    CompositeSessionService.persist("arena_1");',
      "  }, 5);",
      "});",
    ].join("\n");
    const parsed = parseScriptFile("composite", code, source);
    const localCall = parsed.localFunctionCalls.find(call =>
      call.targetName === "CompositeSessionService.persist");
    expect(localCall?.source.range?.lineStart).toBe(8);
    expect(localCall?.targetSource?.range?.lineStart).toBe(3);

    const ir = buildInspectionSemanticIr({
      parsedFunctions: [],
      parsedScripts: [{ parsed }],
    });
    const callEdge = ir.execution.edges.find(edge =>
      edge.targetLabel === "CompositeSessionService.persist");
    expect(callEdge).toMatchObject({
      kind: "synchronous-call",
      resolution: "resolved",
      source: { artifactId: source.artifactId, range: { lineStart: 8 } },
    });
    const region = ir.execution.regions.find(item => item.id === callEdge?.to);
    expect(region?.source).toMatchObject({
      artifactId: source.artifactId,
      relativePath: source.relativePath,
      range: { lineStart: 3 },
    });
    const stateWrite = ir.state.operations.find(op =>
      op.executionRegionId === callEdge?.to &&
      op.operation === "write" &&
      op.source.relativePath === source.relativePath);
    expect(stateWrite?.source.range?.lineStart).toBe(3);
    expect(ir.execution.edges.some(edge =>
      edge.kind === "event-dispatch" && edge.resolution === "resolved")).toBe(true);
    expect(ir.execution.edges.some(edge =>
      edge.kind === "deferred" && edge.resolution === "resolved")).toBe(true);
    const flow = sourceFlowCandidates(ir).find(candidate =>
      candidate.sourceHandoffs?.some(handoff =>
        handoff.edgeId === callEdge?.id &&
        handoff.directTargetStateWriteIds.includes(stateWrite!.id) &&
        handoff.proof === "RESOLVED_SOURCE_EDGE_NOT_RUNTIME_EXECUTION"));
    expect(flow).toBeDefined();
    expect(flow?.runtimeStatus).toBe("NOT_OBSERVED");
  });


  it("prioritizes a late direct state write over earlier reads under the eight-step navigation limit", () => {
    const ir = sample();
    const located = (line: number) => ({
      ...target,
      range: { lineStart: line, lineEnd: line, columnStart: 1, columnEnd: 12 },
    });
    ir.state.operations = [
      ...ir.state.operations,
      ...Array.from({ length: 12 }, (_, index) => ({
        id: "op:read-" + index,
        executionRegionId: "callback",
        surfaceId: "state:round",
        operation: "read" as const,
        source: located(index + 1),
      })),
      {
        id: "op:late-write",
        executionRegionId: "callback",
        surfaceId: "state:round",
        operation: "write",
        source: located(90),
      },
    ];
    const entry = sourceFlowCandidates(ir).find(flow => flow.entryRegionId === "entry");
    const handoff = entry?.sourceHandoffs?.find(x => x.edgeId === "edge:deferred");
    expect(handoff?.directTargetStepIds).toHaveLength(8);
    expect(handoff?.directTargetStateWriteIds).toContain("op:late-write");
    expect(handoff?.directTargetStateWriteIds).toContain("op:round-write");
    expect(handoff?.directTargetWorldEffectIds).toContain("effect:teleport");
    expect(handoff?.directTargetReleaseIds).toContain("release:join-pad");
    expect(handoff?.omittedDirectTargetSteps).toBe(8);
    expect(handoff?.directTargetStepIds).not.toContain("op:unrelated");
    expect(entry?.runtimeStatus).toBe("NOT_OBSERVED");
  });

  it("does not hide world, release or terminal witnesses behind twelve earlier state writes", () => {
    const ir = sample();
    const source = (line: number) => ({
      ...target,
      range: { lineStart: line, lineEnd: line, columnStart: 1, columnEnd: 25 },
    });
    ir.state.operations = [
      ...Array.from({ length: 12 }, (_, i) => ({
        id: "op:write-many-" + i,
        executionRegionId: "callback",
        surfaceId: "state:round",
        operation: "write" as const,
        source: source(i + 1),
      })),
      ...ir.state.operations,
    ];
    ir.execution.outcomes = [{
      id: "out:terminal",
      executionRegionId: "callback",
      propertyName: "status", value: "closed",
      source: source(140),
    }];
    const flow = sourceFlowCandidates(ir)
      .find(flow => flow.entryRegionId === "entry");
    const handoff = flow?.sourceHandoffs?.find(x =>
      x.edgeId === "edge:deferred");
    expect(handoff?.directTargetStepIds).toHaveLength(8);
    expect(handoff?.directTargetWorldEffectIds).toEqual(["effect:teleport"]);
    expect(handoff?.directTargetReleaseIds).toEqual(["release:join-pad"]);
    expect(handoff?.directTargetStepIds).toContain("out:terminal");
    expect(handoff?.directTargetStateWriteIds.length).toBeGreaterThan(0);
    expect(handoff?.omittedDirectTargetSteps).toBe(8);
    expect(handoff?.directTargetStepIds).not.toContain("op:unrelated");
    expect(flow?.runtimeStatus).toBe("NOT_OBSERVED");
  });

  it("does not hide a distinct terminal target behind thirty calls to one session getter", () => {
    const ir = sample();
    ir.execution.regions = [...ir.execution.regions, {
      id: "terminal", kind: "script-function",
      ownerId: "composite", label: "end", source: target,
    }];
    const repeated = Array.from({ length: 30 }, (_, index) => ({
      id: "edge:hot-" + String(index).padStart(2, "0"),
      from: "entry", to: "callback",
      kind: "synchronous-call" as const,
      targetLabel: "CompositeSessionService.get",
      resolution: "resolved" as const, source: origin,
    }));
    ir.execution.edges = [
      ...ir.execution.edges,
      ...repeated,
      { id: "edge:zz-terminal", from: "entry", to: "terminal",
        kind: "synchronous-call", targetLabel: "endCompositeGame",
        resolution: "resolved", source: origin },
    ];
    ir.state.operations = [...ir.state.operations, {
      id: "op:terminal",
      executionRegionId: "terminal",
      surfaceId: "state:round", operation: "write", source: target,
    }];
    const flow = sourceFlowCandidates(ir)
      .find(candidate => candidate.entryRegionId === "entry");
    expect(flow?.sourceHandoffs).toHaveLength(24);
    expect(flow?.omittedSourceHandoffs).toBe(8);
    expect(flow?.sourceHandoffs?.find(handoff =>
      handoff.edgeId === "edge:zz-terminal")?.directTargetStateWriteIds)
      .toEqual(["op:terminal"]);
    expect(flow?.sourceHandoffs?.some(handoff =>
      handoff.edgeId === "edge:unknown")).toBe(false);
    expect(flow?.sourceHandoffs?.every(handoff =>
      handoff.proof === "RESOLVED_SOURCE_EDGE_NOT_RUNTIME_EXECUTION"))
      .toBe(true);
    expect(flow?.runtimeStatus).toBe("NOT_OBSERVED");
    // Source enumeration order must not change the bounded view.
    ir.execution.edges = [...ir.execution.edges].reverse();
    expect(sourceFlowCandidates(ir)
      .find(candidate => candidate.entryRegionId === "entry")
      ?.sourceHandoffs?.map(handoff => handoff.edgeId))
      .toEqual(flow?.sourceHandoffs?.map(handoff => handoff.edgeId));
  });

  it("retains a late material call among thirty exact target handoffs", () => {
    const ir = sample();
    const ordinary = Array.from({ length: 28 }, (_, index) => ({
      id: "target:read-" + index,
      edgeId: "edge:read-" + String(index).padStart(2, "0"),
    }));
    ir.execution.regions = [
      ...ir.execution.regions,
      ...ordinary.map(item => ({
        id: item.id,
        kind: "script-function" as const,
        ownerId: "composite",
        label: item.id,
        source: target,
      })),
      { id: "target:late-result", kind: "script-function",
        ownerId: "composite", label: "result", source: target },
    ];
    ir.execution.edges = [
      ...ir.execution.edges,
      ...ordinary.map(item => ({
        id: item.edgeId, from: "entry", to: item.id,
        kind: "synchronous-call" as const,
        targetLabel: "read-only-helper",
        resolution: "resolved" as const, source: origin,
      })),
      { id: "edge:zz-result-write", from: "entry",
        to: "target:late-result", kind: "synchronous-call",
        targetLabel: "persist-result", resolution: "resolved", source: origin },
    ];
    ir.state.operations = [
      ...ir.state.operations,
      ...ordinary.map(item => ({
        id: "op:" + item.id,
        executionRegionId: item.id,
        surfaceId: "state:round",
        operation: "read" as const, source: target,
      })),
      { id: "op:result-write", executionRegionId: "target:late-result",
        surfaceId: "state:round", operation: "write", source: target },
    ];
    const entry = sourceFlowCandidates(ir).find(flow => flow.entryRegionId === "entry");
    expect(entry?.sourceHandoffs).toHaveLength(24);
    expect(entry?.omittedSourceHandoffs).toBe(6);
    const result = entry?.sourceHandoffs?.find(item =>
      item.edgeId === "edge:zz-result-write");
    expect(result?.directTargetStateWriteIds).toEqual(["op:result-write"]);
    expect(entry?.sourceHandoffs?.some(item =>
      item.edgeId === "edge:unknown")).toBe(false);
    // A handoff is a static source topology witness only.
    expect(result?.proof).toBe("RESOLVED_SOURCE_EDGE_NOT_RUNTIME_EXECUTION");
    expect(entry?.runtimeStatus).toBe("NOT_OBSERVED");
  });

});
