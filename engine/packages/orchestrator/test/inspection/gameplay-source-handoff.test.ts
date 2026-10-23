import { describe, expect, it } from "vitest";
import { sourceFlowCandidates } from "../../src/inspection/gameplay-scenario-compiler.js";
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

});
