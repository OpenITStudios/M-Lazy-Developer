// Source-family consolidation; original testcase bodies are lexically isolated.
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { planMinimumSufficientAnalysis } from "../../../analysis-planner/src/index.js";
import { DIAGNOSIS_ANALYSIS_CAPABILITY_REGISTRY, executePlannedDiagnosisStep } from "../../../diagnosis-pipeline/src/index.js";
import { createSemanticIrDiagnosisExecutor } from "../../src/diagnosis/diagnosis-semantic-ir-executor.js";
import { createSourceIndexDiagnosisExecutor } from "../../src/diagnosis/diagnosis-source-index-executor.js";
import { semanticIrSummary, semanticIrExecutionTraces } from "../../../semantic-ir/src/index.js";
import type { SemanticIr } from "../../../semantic-ir/src/index.js";
import { semanticIrDiagnostics } from "../../src/diagnosis/semantic-ir-diagnostics.js";
import { parseMcFunction } from "../../../../analyzers/functions/src/index.js";
import { parseScriptFile, deriveCrossFileCallEdges } from "../../../../analyzers/scripts/src/index.js";
import { buildInspectionSemanticIr } from "../../src/diagnosis/semantic-ir-stage.js";
import { developerPracticeSignalsFromSemanticIr } from "../../src/workflow/resource-context.js";

// Original engine/packages/orchestrator/test/diagnosis/diagnosis-semantic-ir-executor.test.ts; blob 0bdc4cc06fca65d4a78011a26f40825effe74944
{
describe("semantic-IR diagnosis executor", () => {
  it("reuses source-index output and promotes semantic-model evidence", async () => {
    const root = await mkdtemp(
      join(tmpdir(), "m-bedrock-semantic-"),
    );

    try {
      await mkdir(join(root, "functions"), {
        recursive: true,
      });
      await writeFile(
        join(root, "functions", "start.mcfunction"),
        "scoreboard players set @s ready 1\n",
        "utf8",
      );

      const sourcePlan =
        planMinimumSufficientAnalysis({
          goal: "intent-classification",
          relevantTags: ["session"],
          context: "LOCAL_ARTIFACT",
          capabilities:
            DIAGNOSIS_ANALYSIS_CAPABILITY_REGISTRY
              .capabilities,
        });

      const sourceResult =
        await executePlannedDiagnosisStep({
          plan: sourcePlan,
          context: "LOCAL_ARTIFACT",
          payload: {
            root,
            artifactId: "artifact:test",
            files: [{
              relativePath:
                "functions/start.mcfunction",
              size: 32,
              contentHash: "hash-start",
            }],
          },
          registry: {
            schemaVersion: 1,
            executors: [
              createSourceIndexDiagnosisExecutor(),
            ],
          },
        });

      expect(sourceResult.status).toBe(
        "executed",
      );
      if (sourceResult.status !== "executed") {
        return;
      }

      const semanticPlan =
        planMinimumSufficientAnalysis({
          goal: "semantic-consistency",
          relevantTags: ["session"],
          context: "LOCAL_ARTIFACT",
          availableEvidence:
            sourceResult.evidence,
          completedCapabilityIds: [
            "diagnosis.source-index",
          ],
          capabilities:
            DIAGNOSIS_ANALYSIS_CAPABILITY_REGISTRY
              .capabilities,
        });

      expect(
        semanticPlan.steps[0]
          ?.capabilityId,
      ).toBe("diagnosis.semantic-ir");

      const semanticResult =
        await executePlannedDiagnosisStep({
          plan: semanticPlan,
          context: "LOCAL_ARTIFACT",
          payload: {
            sourceIndex:
              sourceResult.output,
          },
          registry: {
            schemaVersion: 1,
            executors: [
              createSemanticIrDiagnosisExecutor(),
            ],
          },
        });

      expect(semanticResult.status).toBe(
        "executed",
      );
      if (
        semanticResult.status !==
        "executed"
      ) {
        return;
      }

      expect(
        semanticResult.evidence[0],
      ).toMatchObject({
        level: "semantic",
        quality: "usable",
        traits: ["semantic-model"],
      });
      expect(
        semanticResult.evidence[0]
          ?.evidenceIds[0],
      ).toMatch(
        /^semantic-ir:[a-f0-9]{64}$/,
      );
    } finally {
      await rm(root, {
        recursive: true,
        force: true,
      });
    }
  });
});
}

// Original engine/packages/orchestrator/test/diagnosis/semantic-ir-diagnostics.test.ts; blob addd3a60b297519f8a87511353172adce7422022
{
const source = {
  artifactId: "a",
  relativePath: "scripts/main.js",
};

describe("semantic IR diagnostics", () => {
  it("keeps unresolved execution and unguarded deferred mutation as evidence gaps", () => {
    const ir: SemanticIr = {
      schemaVersion: 1,
      execution: {
        regions: [{
          id: "exec:module",
          kind: "script-module",
          ownerId: "main",
          label: "module",
          source,
        }, {
          id: "exec:callback",
          kind: "script-callback",
          ownerId: "main",
          label: "callback",
          source,
        }],
        edges: [{
          id: "edge:missing",
          from: "exec:module",
          kind: "synchronous-call",
          targetLabel: "missing/function",
          resolution: "unresolved",
          source,
        }, {
          id: "edge:deferred",
          from: "exec:module",
          to: "exec:callback",
          kind: "deferred",
          targetLabel: "callback",
          resolution: "resolved",
          guardEvidence: "unresolved",
          source,
        }],
      },
      state: {
        surfaces: [{
          id: "state:dynamic-property:round",
          ref: { kind: "dynamic-property", key: "round" },
        }],
        operations: [{
          id: "op:write",
          executionRegionId: "exec:callback",
          surfaceId: "state:dynamic-property:round",
          operation: "write",
          source,
        }],
        authorityBindings: [],
      },
      temporal: {
        relations: [{
          id: "time:deferred",
          from: "exec:module",
          to: "exec:callback",
          targetLabel: "callback",
          resolution: "resolved",
          kind: "deferred",
          guardEvidence: "unresolved",
          source,
        }],
      },
    };

    const diagnostics = semanticIrDiagnostics(ir);
    expect(diagnostics.map((item) => item.code).sort()).toEqual([
      "SEMANTIC_IR_DEFERRED_STATE_GUARD_UNKNOWN",
      "SEMANTIC_IR_EXECUTION_TARGET_UNRESOLVED",
    ]);
    expect(diagnostics.every((item) =>
      item.message.toLowerCase().includes("risk") ||
      item.message.toLowerCase().includes("unknown")
    )).toBe(true);
  });

  it("traces callback state writes through exact helpers, not unrelated event paths", () => {
    const origin = { artifactId: "selected", relativePath: "scripts/main.js" };
    const helper = { artifactId: "selected", relativePath: "scripts/cleanup.js" };
    const unrelated = { artifactId: "other", relativePath: "scripts/foreign.js" };
    const region = (id: string, source: typeof origin) => ({
      id, kind: "script-function" as const, ownerId: "script",
      label: id, source,
    });
    const ir: SemanticIr = {
      schemaVersion: 1,
      execution: {
        regions: [
          region("caller", origin), region("callback", origin),
          region("cleanup", helper), region("harmless", helper),
          region("another-callback", origin), region("foreign", unrelated),
        ],
        edges: [{
          id: "enqueue", from: "caller", to: "callback",
          kind: "deferred", targetLabel: "cb", resolution: "resolved", source: origin,
        }, {
          id: "call-cleanup", from: "callback", to: "cleanup",
          kind: "synchronous-call", targetLabel: "cleanup",
          resolution: "resolved", source: origin,
        }, {
          id: "call-harmless", from: "callback", to: "harmless",
          kind: "synchronous-call", targetLabel: "unrelatedHelper",
          resolution: "resolved", source: origin,
        }, {
          id: "enqueue-second", from: "callback", to: "another-callback",
          kind: "deferred", targetLabel: "later",
          resolution: "resolved", source: origin,
        }, {
          id: "call-foreign", from: "callback", to: "foreign",
          kind: "synchronous-call", targetLabel: "foreign",
          resolution: "resolved", source: origin,
        }],
      },
      state: {
        surfaces: [
          { id: "cleanup-state", ref: { kind: "dynamic-property", key: "session" } },
          { id: "next-state", ref: { kind: "dynamic-property", key: "next" } },
          { id: "foreign-state", ref: { kind: "dynamic-property", key: "foreign" } },
        ],
        operations: [{
          id: "cleanup-write", executionRegionId: "cleanup",
          surfaceId: "cleanup-state", operation: "write", source: helper,
        }, {
          id: "next-write", executionRegionId: "another-callback",
          surfaceId: "next-state", operation: "write", source: origin,
        }, {
          id: "foreign-write", executionRegionId: "foreign",
          surfaceId: "foreign-state", operation: "write", source: unrelated,
        }],
        authorityBindings: [],
      },
      temporal: { relations: [{
        id: "time:enqueue", from: "caller", to: "callback",
        kind: "deferred", targetLabel: "cb", resolution: "resolved",
        guardEvidence: "unresolved", source: origin,
      }] },
    };
    const candidate = semanticIrDiagnostics(ir).find(item =>
      item.code === "SEMANTIC_IR_DEFERRED_STATE_GUARD_UNKNOWN");
    expect(candidate).toBeDefined();
    expect(candidate?.data).toEqual(expect.objectContaining({
      mutatedStateSurfaceIds: ["cleanup-state"],
      authoredStateMutationIds: ["cleanup-write"],
      resolvedSynchronousCallEdgeIds: ["call-cleanup"],
    }));
    const guarded = { ...ir, temporal: { relations: [{
      ...ir.temporal.relations[0]!,
      guardEvidence: "explicit-generation-check" as const,
    }] } };
    expect(semanticIrDiagnostics(guarded).some(item =>
      item.code === "SEMANTIC_IR_DEFERRED_STATE_GUARD_UNKNOWN")).toBe(false);
    const unresolved = { ...ir, execution: { ...ir.execution,
      edges: ir.execution.edges.map(edge => {
        if (edge.id !== "call-cleanup") return edge;
        // Omit the optional resolved target rather than asserting a
        // literal undefined target into a strict execution-edge contract.
        const { to: _resolvedTarget, ...unresolvedEdge } = edge;
        return { ...unresolvedEdge, resolution: "unresolved" as const };
      }),
    } };
    expect(semanticIrDiagnostics(unresolved).some(item =>
      item.code === "SEMANTIC_IR_DEFERRED_STATE_GUARD_UNKNOWN")).toBe(false);
  });

  it("does not flag guarded deferred mutation", () => {
    const ir: SemanticIr = {
      schemaVersion: 1,
      execution: {
        regions: [{
          id: "a",
          kind: "script-module",
          ownerId: "main",
          label: "module",
          source,
        }, {
          id: "b",
          kind: "script-callback",
          ownerId: "main",
          label: "callback",
          source,
        }],
        edges: [],
      },
      state: {
        surfaces: [{
          id: "s",
          ref: { kind: "script-memory", key: "x" },
        }],
        operations: [{
          id: "o",
          executionRegionId: "b",
          surfaceId: "s",
          operation: "write",
          source,
        }],
        authorityBindings: [],
      },
      temporal: {
        relations: [{
          id: "t",
          from: "a",
          to: "b",
          targetLabel: "callback",
          resolution: "resolved",
          kind: "deferred",
          guardEvidence: "explicit-generation-check",
          source,
        }],
      },
    };

    expect(semanticIrDiagnostics(ir)).toEqual([]);
  });
});
}

// Original engine/packages/orchestrator/test/diagnosis/semantic-ir-stage.test.ts; blob 2209d9937fa20f7a5c6ff26e5638d37863eca61b
{
describe("inspection semantic IR", () => {
  it("keeps source-qualified authored boolean writes outside named state/status fields", () => {
    const source = {artifactId:"artifact:novel-game",
      relativePath:"behavior_packs/demo/scripts/party.js"};
    const parsed = parseScriptFile("party", [
      "class PartyService {",
      "  static handleReady(member) {",
      "    if (!member) return;",
      "    member.ready = !member.ready;",
      "    this.saveParty(member);",
      "  }",
      "  static saveParty(member) { member.ready = false; }",
      "  static anotherOwner(member) { member.ready = true; }",
      "  static minified(member) { member.ready = !1; }",
      "  static unrelated(member) { member.ready = resolveReady(member); }",
      "  static register(member) { subscribe(() => { member.ready = true; }); }",
      "}",
    ].join("\n"), source);
    expect((parsed.authoredPropertyMutations ?? [])
      .filter(item => item.booleanAssignment !== undefined)
      .map(item => item.booleanAssignment))
      .toEqual([
        "self-negation","literal-false","literal-true","literal-false",
        "literal-true",
      ]);
    const ir = buildInspectionSemanticIr({
      parsedScripts: [{parsed}], parsedFunctions: [],
    });
    const writes = ir.state.operations.filter(operation =>
      operation.authoredBooleanPropertyWrite !== undefined);
    expect(writes).toHaveLength(5);
    expect(new Set(writes.map(item => item.surfaceId)).size).toBe(5);
    expect(writes.some(item => item.executionRegionId.includes(
      "callback%40"))).toBe(true);
    const toggle = writes.find(item =>
      item.authoredBooleanPropertyWrite?.form === "self-negation");
    expect(toggle?.source.range?.lineStart).toBe(4);
    expect(toggle?.authoredBooleanPropertyWrite).toMatchObject({
      targetExpression:"member.ready",valueExpression:"!member.ready",
      form:"self-negation",
      proof:"SITE_LOCAL_SOURCE_SYNTAX_NOT_RUNTIME_STATE",
    });
    expect(toggle?.writtenValue).toBeUndefined();
    expect(toggle?.precedenceGuards?.some(guard =>
      guard.expression === "!member" && guard.branch === "false"))
      .toBe(true);
    const saveCall = ir.execution.edges.find(edge =>
      edge.kind === "synchronous-call" &&
      edge.targetLabel === "saveParty");
    expect(saveCall?.from).toBe(toggle?.executionRegionId);
    expect(saveCall?.source.range?.lineStart).toBe(5);
    const literalFalse = writes.filter(item =>
      item.authoredBooleanPropertyWrite?.form === "literal-false");
    expect(literalFalse.every(item =>
      item.writtenValue?.kind === "literal" &&
      item.writtenValue.value === "false" &&
      item.writtenValue.scalarKind === "boolean")).toBe(true);
    // No inferred party identity or proven event delivery.
  });


  it("retains runtime uncertainty on native Promise resolver without inventing a missing authored callback", () => {
    const src = { artifactId: "selected", relativePath: "scripts/promise.js" };
    const parsed = parseScriptFile("promise", [
      'import { system } from "@minecraft/server";',
      'function delay() { return new Promise((resolve) => { system.runTimeout(resolve, 20); }); }',
      'function unknown(handler) { system.run(handler); }',
    ].join("\n"), src);
    const ir = buildInspectionSemanticIr({ parsedScripts: [{ parsed }], parsedFunctions: [] });
    const native = ir.execution.edges.find(edge =>
      edge.kind === "deferred" && edge.scheduler === "runTimeout");
    expect(native?.externalPromiseResolver).toBe(true);
    expect(native?.resolution).toBe("unresolved");
    expect(native?.to).toBeUndefined();
    expect(native?.source.relativePath).toBe(src.relativePath);
    const authoredUnknown = ir.execution.edges.find(edge =>
      edge.kind === "deferred" && edge.scheduler === "run");
    expect(authoredUnknown?.externalPromiseResolver).toBeUndefined();
    expect(authoredUnknown?.resolution).toBe("unresolved");
    const a2MissingSourceTargets = ir.execution.edges.filter(edge =>
      edge.resolution === "unresolved" &&
      edge.externalRuntimeModule === undefined &&
      edge.externalPromiseResolver !== true);
    expect(a2MissingSourceTargets).toContain(authoredUnknown);
    expect(a2MissingSourceTargets).not.toContain(native);
    // Native resolver remains in the IR for A7 / temporal source analysis.
    expect(ir.execution.edges).toContain(native);
    const temporal = ir.temporal.relations.find(item => item.id === "time:" + native?.id);
    expect(temporal?.externalPromiseResolver).toBe(true);
    expect(temporal?.resolution).toBe("unresolved");
    const a2TemporalMissingSources = ir.temporal.relations.filter(item =>
      item.resolution === "unresolved" &&
      item.externalRuntimeModule === undefined &&
      item.externalPromiseResolver !== true);
    expect(a2TemporalMissingSources).not.toContain(temporal);
  });

  it("links event, deferred callback, state operations and mcfunction calls without guessing unresolved targets", () => {
    const script = parseScriptFile(
      "main",
      [
        'import { world, system } from "@minecraft/server";',
        'function start() {',
        '  world.setDynamicProperty("round", 1);',
        '  system.run(() => {',
        '    world.getDynamicProperty("round");',
        '    world.runCommand("function arena/start");',
        '  });',
        '}',
        'world.afterEvents.playerSpawn.subscribe(() => { start(); });',
      ].join("\n"),
      {
        artifactId: "a",
        relativePath: "scripts/main.js",
      },
    );
    const fn = parseMcFunction(
      "arena/start",
      [
        "scoreboard players add @s score 1",
        "tag @s add ready",
        "function missing/next",
      ].join("\n"),
      {
        artifactId: "a",
        relativePath: "functions/arena/start.mcfunction",
      },
    );

    const ir = buildInspectionSemanticIr({
      parsedScripts: [{ parsed: script }],
      parsedFunctions: [{ parsed: fn }],
      stateAuthorityContracts: [{
        id: "arena-ready",
        authority: { kind: "scoreboard", key: "score" },
        mirrors: [{ kind: "tag", key: "ready" }],
        scope: "player",
      }],
    });

    const summary = semanticIrSummary(ir);
    expect(summary.eventDispatches).toBe(1);
    expect(summary.deferredEdges).toBe(1);
    expect(summary.authorityContracts).toBe(1);
    expect(summary.stateReads).toBeGreaterThan(0);
    expect(summary.stateWrites).toBeGreaterThan(1);
    expect(summary.unresolvedExecutionTargets).toBe(1);

    const deferred = ir.temporal.relations.find(
      (item) => item.kind === "deferred",
    );
    expect(deferred?.guardEvidence).toBe("unresolved");
  });

  it("preserves parsed conditional calls and authored state writes in the technical execution trace", () => {
    const source = { artifactId: "map:sample", relativePath: "scripts/round.js" };
    const parsed = parseScriptFile("round", [
      'let phase = "idle";',
      'function spawnWave() {}',
      'function startWave(ready) {',
      '  if (ready) spawnWave();',
      '  phase = "active";',
      '}',
      'startWave(true);',
    ].join("\n"), source);
    const ir = buildInspectionSemanticIr({
      parsedFunctions: [], parsedScripts: [{ parsed }],
    });
    const call = ir.execution.edges.find(edge => edge.targetLabel === "spawnWave");
    expect(call?.kind).toBe("synchronous-call");
    expect(call?.controlFlow).toBe("conditional");
    const written = ir.state.operations.filter(item =>
      item.operation === "write" &&
      ir.state.surfaces.some(surface =>
        surface.id === item.surfaceId &&
        surface.ref.kind === "script-memory" &&
        surface.ref.key === "scripts/round.js::phase")
    );
    expect(written.some(item =>
      item.writtenValue?.kind === "literal" &&
      item.writtenValue.value === "active")).toBe(true);
    const trace = semanticIrExecutionTraces(ir);
    expect(trace.traces.some(item =>
      item.conditionalExecutionEdgeIds.includes(call!.id) &&
      written.every(write => item.stateWriteOperationIds.includes(write.id)))).toBe(true);
  });


  it("propagates true/false and nested authored guards through Semantic IR and navigation traces", () => {
    const source = { artifactId: "map:guards", relativePath: "scripts/waves.js" };
    const parsed = parseScriptFile("waves", [
      'let phase = "idle";',
      'function spawnWave() {}',
      'function skipWave() {}',
      'function start(ready, wave) {',
      '  if (ready) {',
      '    if (wave > 0) { phase = "active"; spawnWave(); }',
      '  } else { phase = "skipped"; skipWave(); }',
      '  ready && spawnWave();',
      '}',
      'start(true, 1);',
    ].join("\n"), source);
    const ir = buildInspectionSemanticIr({
      parsedFunctions: [], parsedScripts: [{ parsed }],
    });
    const spawnEdges = ir.execution.edges.filter(edge => edge.targetLabel === "spawnWave");
    expect(spawnEdges).toHaveLength(2);
    const nested = spawnEdges.find(edge => edge.lexicalGuards?.length === 2);
    expect(nested?.lexicalGuards?.map(g => [g.expression, g.branch])).toEqual([
      ["ready", "true"], ["wave > 0", "true"],
    ]);
    expect(nested?.lexicalGuards?.every(g =>
      g.source.artifactId === source.artifactId &&
      g.source.relativePath === source.relativePath &&
      g.source.range?.lineStart !== undefined)).toBe(true);
    const shortCircuit = spawnEdges.find(edge => edge.lexicalGuards?.length === 1);
    expect(shortCircuit?.controlFlow).toBe("conditional");
    expect(shortCircuit?.lexicalGuards?.[0]?.expression).toBe("ready");
    const skip = ir.execution.edges.find(edge => edge.targetLabel === "skipWave");
    expect(skip?.lexicalGuards?.map(g => g.branch)).toEqual(["false"]);
    const writes = ir.state.operations.filter(op => op.writtenValue);
    expect(writes.find(op => op.writtenValue?.kind === "literal" &&
      op.writtenValue.value === "active")?.lexicalGuards?.map(g =>
      [g.expression, g.branch])).toEqual([
        ["ready", "true"], ["wave > 0", "true"],
      ]);
    expect(writes.find(op => op.writtenValue?.kind === "literal" &&
      op.writtenValue.value === "skipped")?.lexicalGuards?.map(g =>
      [g.expression, g.branch])).toEqual([["ready", "false"]]);
    const traces = semanticIrExecutionTraces(ir).traces;
    expect(traces.some(trace =>
      trace.guardedExecutionEdges.some(entry => entry.edgeId === nested?.id) &&
      trace.guardedStateWrites.some(entry => entry.guards.length === 2))).toBe(true);
  });

  it("does not infer lexical guard predicates from preceding return statements", () => {
    const source = { artifactId: "map:guards", relativePath: "scripts/exit.js" };
    const parsed = parseScriptFile("exit", [
      'function spawnWave() {}',
      'function start(ready) {',
      '  if (!ready) return;',
      '  spawnWave();',
      '}',
      'start(true);',
    ].join("\n"), source);
    const ir = buildInspectionSemanticIr({
      parsedFunctions: [], parsedScripts: [{ parsed }],
    });
    const call = ir.execution.edges.find(edge => edge.targetLabel === "spawnWave");
    expect(call?.controlFlow).toBe("conditional");
    expect(call?.lexicalGuards).toBeUndefined();
    expect(call?.precedenceGuards?.map(g => [g.expression, g.branch]))
      .toEqual([["!ready", "false"]]);
    expect(semanticIrExecutionTraces(ir).traces.some(trace =>
      trace.conditionalExecutionEdgeIds.includes(call!.id) &&
      !trace.guardedExecutionEdges.some(item => item.edgeId === call!.id) &&
      trace.precedenceGuardedExecutionEdges.some(item =>
        item.edgeId === call!.id))).toBe(true);
  });

  it("reconciles preceding exits and lexical returns under exact source branch points", () => {
    const source = { artifactId: "world:precedence", relativePath: "scripts/wave.ts" };
    const parsed = parseScriptFile("wave", [
      'let phase = "idle";',
      'function spawnWave() {}',
      'function run(skip) {',
      '  if (skip) return { action: "skipped" };',
      '  phase = "active";',
      '  spawnWave();',
      '  return { action: "started" };',
      '}',
      'run(false);',
    ].join("\n"), source);
    const ir = buildInspectionSemanticIr({
      parsedFunctions: [], parsedScripts: [{ parsed }],
    });
    const call = ir.execution.edges.find(edge => edge.targetLabel === "spawnWave");
    const active = ir.state.operations.find(op =>
      op.writtenValue?.kind === "literal" && op.writtenValue.value === "active");
    const skipped = ir.execution.outcomes?.find(x => x.value === "skipped");
    const started = ir.execution.outcomes?.find(x => x.value === "started");
    expect(call?.precedenceGuards?.map(g => [g.expression, g.branch]))
      .toEqual([["skip", "false"]]);
    expect(active?.precedenceGuards?.map(g => [g.expression, g.branch]))
      .toEqual([["skip", "false"]]);
    expect(started?.precedenceGuards?.map(g => [g.expression, g.branch]))
      .toEqual([["skip", "false"]]);
    expect(skipped?.lexicalGuards?.map(g => [g.expression, g.branch]))
      .toEqual([["skip", "true"]]);
    const trace = semanticIrExecutionTraces(ir).traces.find(x =>
      x.branchPoints.some(p => p.expression === "skip"));
    expect(trace).toBeDefined();
    const point = trace!.branchPoints.find(p => p.expression === "skip")!;
    const trueArm = point.branches.find(x => x.branch === "true")!;
    const falseArm = point.branches.find(x => x.branch === "false")!;
    expect(trueArm.returnOutcomeIds).toContain(skipped!.id);
    expect(trueArm.returnOutcomeIds).not.toContain(started!.id);
    expect(trueArm.precedenceEvidenceIds).toEqual([]);
    expect(falseArm.executionEdgeIds).toContain(call!.id);
    expect(falseArm.stateWriteOperationIds).toContain(active!.id);
    expect(falseArm.returnOutcomeIds).toContain(started!.id);
    expect(falseArm.precedenceEvidenceIds).toEqual([
      active!.id, call!.id, started!.id,
    ].sort());
    expect(trace!.precedenceGuardedReturnOutcomes.some(x =>
      x.outcomeId === started!.id)).toBe(true);
    // Both results remain static alternatives, not simultaneous outcomes.
    expect(trace!.returnOutcomeIds).toEqual([skipped!.id, started!.id].sort());
  });

  it("retains alternative source returns and resource releases without inferring a successful reset", () => {
    const source = {
      artifactId: "map:game",
      relativePath: "behavior_packs/test/scripts/game.js",
    };
    const parsed = parseScriptFile("game", [
      'import { world } from "@minecraft/server";',
      'function finish(ready, player) {',
      '  if (ready) {',
      '    player.removeTag("playing");',
      '    return { status: "done" };',
      '  } else {',
      '    return { status: "blocked" };',
      '  }',
      '}',
      'world.afterEvents.playerSpawn.subscribe((event) => finish(true, event.player));',
    ].join("\n"), source);
    const ir = buildInspectionSemanticIr({
      parsedFunctions: [], parsedScripts: [{ parsed }],
    });
    const outcomes = ir.execution.outcomes ?? [];
    expect(outcomes.map(outcome => outcome.value).sort()).toEqual(["blocked","done"]);
    const done = outcomes.find(outcome => outcome.value === "done");
    const blocked = outcomes.find(outcome => outcome.value === "blocked");
    expect(done?.lexicalGuards?.map(g => [g.expression,g.branch]))
      .toEqual([["ready","true"]]);
    expect(blocked?.lexicalGuards?.map(g => [g.expression,g.branch]))
      .toEqual([["ready","false"]]);
    const release = (ir.state.resourceActions ?? []).find(action =>
      action.surface === "tag" && action.action === "release");
    expect(release?.precision).toBe("exact");
    expect(release?.source.relativePath).toBe(source.relativePath);
    expect(release?.executionRegionId).toBe(done?.executionRegionId);
    const traces = semanticIrExecutionTraces(ir).traces;
    expect(traces.some(trace => done && blocked && release &&
      trace.returnOutcomeIds.includes(done.id) &&
      trace.returnOutcomeIds.includes(blocked.id) &&
      trace.resourceReleaseActionIds.includes(release.id))).toBe(true);
    expect(semanticIrSummary(ir).authoredReturnOutcomes).toBe(2);
    expect(semanticIrSummary(ir).authoredResourceReleases).toBeGreaterThanOrEqual(1);
  });

  it("retains exact cross-file state-parameter handoff without claiming runtime identity", () => {
    const prefix = "behavior_packs/demo/scripts/";
    const a = { artifactId: "selected", relativePath: prefix + "main.js" };
    const b = { artifactId: "selected", relativePath: prefix + "cleanup.js" };
    const mainText = [
      'import { finish as close } from "./cleanup.js";',
      'import { system } from "@minecraft/server";',
      "function join(arena, member) {",
      "  const copy = arena;",
      "  close(copy, member);",
      "  system.runTimeout(() => { close(copy, member); }, 2);",
      "}",
    ].join("\n");
    const targetText = "export function finish(ctx, player) { return ctx; }";
    const main = parseScriptFile("main", mainText, a);
    const target = parseScriptFile("cleanup", targetText, b);
    const calls = deriveCrossFileCallEdges([
      { path: a.relativePath, source: a, text: mainText },
      { path: b.relativePath, source: b, text: targetText },
    ]);
    const ir = buildInspectionSemanticIr({
      parsedFunctions: [], parsedScripts: [{ parsed: main }, { parsed: target }],
      crossFileCallEdges: calls,
    });
    const edge = ir.execution.edges.find(e =>
      e.kind === "synchronous-call" && e.targetLabel === "close" &&
      e.source.range?.lineStart === 5);
    expect(edge?.resolution).toBe("resolved");
    expect(edge?.source.range?.lineStart).toBe(5);
    expect(calls.filter(call => call.status === "resolved")
      .every(call => call.targetSource?.relativePath === b.relativePath &&
        call.targetSource.range?.lineStart === 1)).toBe(true);
    expect(ir.execution.regions.find(region =>
      region.id === edge?.to)?.source).toMatchObject({
        artifactId: b.artifactId,
        relativePath: b.relativePath,
        range: { lineStart: 1 },
      });
    expect(edge?.argumentParameterBindings).toEqual([
      expect.objectContaining({
        index: 0, argumentName: "arena", parameterName: "ctx",
        viaConstAliases: [expect.objectContaining({ name: "copy" })],
      }),
      expect.objectContaining({
        index: 1, argumentName: "member", parameterName: "player",
      }),
    ]);
    expect(edge?.argumentParameterBindings?.every(binding =>
      binding.argumentSource.relativePath === a.relativePath &&
      binding.parameterSource.relativePath === b.relativePath
    )).toBe(true);
    // The nested call is synchronous inside a deferred callback. Preserve
    // both authored edges instead of mistaking the callee for a scheduler.
    const callbackCall = ir.execution.edges.find(e =>
      e.kind === "synchronous-call" && e.targetLabel === "close" &&
      e.source.range?.lineStart === 6);
    expect(callbackCall?.resolution).toBe("resolved");
    expect(callbackCall?.controlFlow).toBe("deferred");
    expect(ir.execution.edges.some(e =>
      e.kind === "deferred" && e.scheduler === "runTimeout" &&
      e.resolution === "resolved" && e.to === callbackCall?.from)).toBe(true);
    const unresolved = buildInspectionSemanticIr({
      parsedFunctions: [], parsedScripts: [{ parsed: main }],
      crossFileCallEdges: calls,
    });
    expect(unresolved.execution.edges.find(e =>
      e.targetLabel === "close")?.argumentParameterBindings).toBeUndefined();
  });

  it("carries authored tick roots into periodic Semantic IR without claiming missing targets", () => {
    const fn = parseMcFunction("start", "say ready", {
      artifactId: "a",
      relativePath: "behavior_packs/a/functions/start.mcfunction",
    });
    const ir = buildInspectionSemanticIr({
      parsedFunctions: [{ parsed: fn }],
      parsedScripts: [],
      tickFunctionRegistrations: [
        {
          source: { artifactId: "a", relativePath: "behavior_packs/a/functions/tick.json" },
          functions: ["start"],
        },
        {
          source: { artifactId: "a", relativePath: "behavior_packs/b/functions/tick.json" },
          functions: ["missing"],
        },
      ],
    });
    const roots = ir.execution.regions.filter((region) => region.id.startsWith("exec:tick:"));
    expect(roots).toHaveLength(2);
    const periodic = ir.execution.edges.filter((edge) => edge.kind === "periodic");
    expect(periodic).toHaveLength(2);
    expect(periodic.map((edge) => [edge.targetLabel, edge.resolution]).sort()).toEqual([
      ["missing", "unresolved"], ["start", "resolved"],
    ]);
    expect(ir.temporal.relations.filter((relation) => relation.kind === "periodic")).toHaveLength(2);
  });

  it("preserves repeated tick registrations as distinct periodic edges", () => {
    const fn = parseMcFunction("start", "say ready", {
      artifactId: "a", relativePath: "behavior_packs/a/functions/start.mcfunction",
    });
    const ir = buildInspectionSemanticIr({
      parsedFunctions: [{ parsed: fn }], parsedScripts: [],
      tickFunctionRegistrations: [{
        source: { artifactId: "a", relativePath: "behavior_packs/a/functions/tick.json" },
        functions: ["start", "start"],
      }],
    });
    const periodic = ir.execution.edges.filter(edge => edge.kind === "periodic");
    expect(periodic).toHaveLength(2);
    expect(new Set(periodic.map(edge => edge.id)).size).toBe(2);
    expect(ir.temporal.relations.filter(item => item.kind === "periodic")).toHaveLength(2);
  });

  it("keeps duplicate cross-pack functions separate and does not resolve an ambiguous call", () => {
    const source = (pack: string) => ({ artifactId: "a", relativePath: "behavior_packs/" + pack + "/functions/start.mcfunction" });
    const a = parseMcFunction("start", "function start", source("a"));
    const b = parseMcFunction("start", "say ready", source("b"));
    const ir = buildInspectionSemanticIr({
      parsedFunctions: [{ parsed: a }, { parsed: b }], parsedScripts: [],
      tickFunctionRegistrations: [{ source: { artifactId: "a", relativePath: "behavior_packs/a/functions/tick.json" }, functions: ["start"] }],
    });
    const functions = ir.execution.regions.filter(region => region.kind === "mcfunction");
    expect(functions).toHaveLength(2);
    expect(new Set(functions.map(region => region.id)).size).toBe(2);
    expect(ir.execution.edges.filter(edge => edge.targetLabel === "start").every(edge => edge.resolution === "unresolved")).toBe(true);
  });

  it("separates same-name script execution regions and subscriptions across packs", () => {
    const scriptText = [
      'import { world } from "@minecraft/server";',
      'world.afterEvents.playerSpawn.subscribe(() => { world.setDynamicProperty("join", 1); });',
    ].join("\n");
    const first = parseScriptFile("scripts/main", scriptText, {
      artifactId: "a", relativePath: "behavior_packs/a/scripts/main.js",
    });
    const second = parseScriptFile("scripts/main", scriptText, {
      artifactId: "a", relativePath: "behavior_packs/b/scripts/main.js",
    });
    const ir = buildInspectionSemanticIr({
      parsedFunctions: [], parsedScripts: [{ parsed: first }, { parsed: second }],
    });
    expect(ir.execution.regions.filter(region => region.kind === "script-module")).toHaveLength(2);
    expect(ir.execution.regions.filter(region => region.kind === "event-source")).toHaveLength(2);
    expect(ir.execution.edges.filter(edge => edge.kind === "event-dispatch")).toHaveLength(2);
  });

  it("resolves the native imported Daigon filter only from the selected source", () => {
    const path = "behavior_packs/a/scripts/";
    const handler = parseScriptFile("results", [
      'import { system } from "@minecraft/server";',
      'import { GAME_RESULTS_EVENT_ID } from "./modules/game-results/game-results-contract.js";',
      'system.afterEvents.scriptEventReceive.subscribe((event) => {',
      '  if (event.id !== GAME_RESULTS_EVENT_ID) return;',
      '  exportStoredResults();',
      '});',
    ].join("\n"), { artifactId: "selected", relativePath: path + "results.ts" });
    const parseContract = (id: string, artifactId = "selected") =>
      parseScriptFile("contract",
        'export const GAME_RESULTS_EVENT_ID = "' + id + '";',
        { artifactId, relativePath: path + "modules/game-results/game-results-contract.ts" });
    const build = (contract = parseContract("daigon:get_all_scoring")) =>
      buildInspectionSemanticIr({
        parsedScripts: [{ parsed: handler }, { parsed: contract }],
        parsedFunctions: [],
      });
    const eventRegion = (contract?: ReturnType<typeof parseContract>) =>
      build(contract).execution.regions.find(region =>
        region.label === "system.afterEvents.scriptEventReceive");
    const event = eventRegion();
    expect(event?.scriptEventIdRejection).toMatchObject({
      eventId: "daigon:get_all_scoring",
      resolution: "unique-imported-literal",
      valueSource: { relativePath:
        path + "modules/game-results/game-results-contract.ts" },
    });
    expect(developerPracticeSignalsFromSemanticIr(build(), "selected")
      .some(item => item.signal === "scriptevent:daigon:get_all_scoring"))
      .toBe(true);
    expect(eventRegion(parseContract("other:export"))
      ?.scriptEventIdRejection?.eventId).toBe("other:export");
    expect(eventRegion(parseContract("daigon:get_all_scoring", "other"))
      ?.scriptEventIdRejection).toBeUndefined();
  });

  it("preserves distinct subscriptions of the same event within one script", () => {
    const script = parseScriptFile("scripts/main", [
      'import { world } from "@minecraft/server";',
      'world.afterEvents.playerSpawn.subscribe(() => { world.setDynamicProperty("first", 1); });',
      'world.afterEvents.playerSpawn.subscribe(() => { world.setDynamicProperty("second", 1); });',
    ].join("\n"), {
      artifactId: "a", relativePath: "behavior_packs/a/scripts/main.js",
    });
    const ir = buildInspectionSemanticIr({ parsedFunctions: [], parsedScripts: [{ parsed: script }] });
    const eventRegions = ir.execution.regions.filter(region =>
      region.kind === "event-source" && region.label === "world.afterEvents.playerSpawn");
    expect(eventRegions).toHaveLength(2);
    expect(new Set(eventRegions.map(region => region.id)).size).toBe(2);
    expect(ir.execution.edges.filter(edge => edge.kind === "event-dispatch")).toHaveLength(2);
  });

  it("preserves explicit generation guards on deferred work", () => {
    const script = parseScriptFile(
      "guarded",
      [
        'import { system } from "@minecraft/server";',
        'const generation = 1;',
        'system.run(() => {',
        '  if (generation !== currentGeneration) return;',
        '});',
      ].join("\n"),
      {
        artifactId: "a",
        relativePath: "scripts/guarded.js",
      },
    );

    const ir = buildInspectionSemanticIr({
      parsedScripts: [{ parsed: script }],
      parsedFunctions: [],
    });

    expect(ir.temporal.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "deferred",
          guardEvidence: "explicit-generation-check",
        }),
      ]),
    );
  });

  it("keeps typed forms, HUD, entity lifecycle and feedback distinct from lookalike methods", () => {
    const artifactId = "selected:developer-reference";
    const relativePath = "behavior_packs/demo/scripts/hub.ts";
    const parsed = parseScriptFile("hub", [
      'import { world, system } from "@minecraft/server";',
      'import { ActionFormData as Menu, uiManager as manager } from "@minecraft/server-ui";',
      'function interact(player: Player, target: Entity) {',
      '  new Menu().title("Pick").button("Ready").show(player);',
      '  manager.closeAllForms(player);',
      '  player.onScreenDisplay.setActionBar("Preparing");',
      '  player.teleport({ x: 1, y: 2, z: 3 });',
      '  player.camera.setCamera("minecraft:free", { location: { x: 2, y: 3, z: 4 } });',
      '  player.camera.clear();',
      '  world.getAllPlayers();',
      '  const nowTick = system.currentTick;',
      '  player.dimension.getEntities({ type: "minecraft:zombie" });',
      '  target.kill();',
      '  world.sendMessage("Updated");',
      '  const fake = { show() {}, kill() {}, setActionBar() {}, setCamera() {} };',
      '  fake.show(); fake.kill(); fake.setActionBar(); fake.setCamera();',
      '}',
      'world.beforeEvents.entityHurt.subscribe(() => {});',
      'world.afterEvents.entityDie.subscribe(() => {});',
      'world.afterEvents.entityRemove.subscribe(() => {});',
    ].join("\n"), { artifactId, relativePath });
    const ir = buildInspectionSemanticIr({
      parsedFunctions: [],
      parsedScripts: [{ parsed }],
    });
    const calls = ir.execution.apiCalls ?? [];
    expect(calls.map(call => call.symbol)).toEqual(expect.arrayContaining([
      "ActionFormData.show",
      "UIManager.closeAllForms",
      "ScreenDisplay.setActionBar",
      "Entity.teleport",
      "Camera.setCamera",
      "Camera.clear",
      "world.getAllPlayers",
      "Dimension.getEntities",
      "Entity.kill",
      "world.sendMessage",
    ]));
    expect(calls.some(call => call.receiverType === "Player" &&
      call.method === "teleport")).toBe(true);
    expect(calls.filter(call => call.method === "show")).toHaveLength(1);
    expect(calls.filter(call => call.method === "kill")).toHaveLength(1);
    expect(calls.every(call => call.source.artifactId === artifactId &&
      call.source.relativePath === relativePath)).toBe(true);
    expect(ir.execution.apiPropertyReads).toEqual([
      expect.objectContaining({
        receiverType: "System",
        property: "currentTick",
        symbol: "system.currentTick",
        source: expect.objectContaining({ artifactId, relativePath }),
      }),
    ]);

    const signals = developerPracticeSignalsFromSemanticIr(ir, artifactId)
      .map(item => item.signal);
    expect(signals).toEqual(expect.arrayContaining([
      "ActionFormData",
      "closeAllForms",
      "onScreenDisplay.setActionBar",
      "player.teleport",
      "camera.setCamera",
      "camera.clear",
      "getAllPlayers",
      "getEntities",
      "system.currentTick",
      "Entity.kill",
      "sendMessage",
      "world.beforeEvents.entityHurt",
      "entityDie",
      "entityRemove",
    ]));
    expect(developerPracticeSignalsFromSemanticIr(ir, "different-world"))
      .toHaveLength(0);
  });

  it("does not infer Minecraft form or display APIs from a lookalike local class", () => {
    const parsed = parseScriptFile("fake", [
      'class ActionFormData { show() {} }',
      'const local = new ActionFormData();',
      'local.show();',
      'const manager = { closeAllForms() {} }; manager.closeAllForms();',
      'const player = { onScreenDisplay: { setActionBar() {} }, camera: { setCamera() {}, clear() {} } };',
      'player.onScreenDisplay.setActionBar("not minecraft");',
      'player.camera.setCamera("minecraft:free"); player.camera.clear();',
      'const entity = { remove() {}, getDynamicProperty() { return 4; } };',
      'entity.remove(); entity.getDynamicProperty("round");',
      'const storage = { setDynamicProperty() {}, getDynamicProperty() { return 2; } };',
      'storage.setDynamicProperty("round", 1); storage.getDynamicProperty("round");',
      'const dimension = { getEntities() {} }; dimension.getEntities();',
      'const world = { getAllPlayers() {}, afterEvents: { entityDie: { subscribe() {} } } };',
      'world.getAllPlayers(); world.afterEvents.entityDie.subscribe(() => {});',
      'system.runInterval(() => {}, 20);',
      'const phantomTick = system.currentTick;',
    ].join("\n"), {
      artifactId: "selected", relativePath: "scripts/fake.js",
    });
    const ir = buildInspectionSemanticIr({
      parsedFunctions: [], parsedScripts: [{ parsed }],
    });
    expect(ir.execution.apiCalls).toEqual([]);
    expect(ir.execution.apiPropertyReads ?? []).toHaveLength(0);
    expect(ir.state.operations).toEqual([]);
    const hints = developerPracticeSignalsFromSemanticIr(ir, "selected")
      .map(item => item.signal);
    expect(hints).not.toContain("system.runInterval");
    expect(hints).not.toContain("entityDie");
    expect(hints).not.toContain("getDynamicProperty");
    expect(hints).not.toContain("setDynamicProperty");
  });

});
}
