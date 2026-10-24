import { describe, expect, it } from "vitest";
import { parseScriptFile, deriveCrossFileCallEdges } from "../../../../analyzers/scripts/src/index.js";
import { semanticIrExecutionTraces } from "../../../semantic-ir/src/index.js";
import { buildInspectionSemanticIr, scriptRegionId } from "../../src/diagnosis/semantic-ir-stage.js";
import { sourceFlowCandidates } from "../../src/inspection/gameplay-scenario-compiler.js";

const parsed = (path: string, text: string, artifactId = "selected-map") => {
  const source = { artifactId, relativePath: path };
  return { parsed: parseScriptFile(path, text, source) };
};
const build = (...scripts: ReturnType<typeof parsed>[]) =>
  buildInspectionSemanticIr({ parsedFunctions: [], parsedScripts: scripts });

describe("manifest-rooted static module dependencies", () => {
  it("tracks side-effect-only static imports and direct state writes without timing claims", () => {
    const main = parsed("behavior_packs/BP/scripts/main.js",
      'import "./chunks/session.js";');
    const session = parsed("behavior_packs/BP/scripts/chunks/session.js", [
      'import { world } from "@minecraft/server";',
      'world.setDynamicProperty("session:started", true);',
    ].join("\n"));
    const orphan = parsed("behavior_packs/BP/scripts/entries/unreferenced.js", [
      'import { world } from "@minecraft/server";',
      'world.setDynamicProperty("session:unused", true);',
    ].join("\n"));
    const ir = buildInspectionSemanticIr({
      parsedFunctions: [],
      parsedScripts: [main, session, orphan],
      manifestScriptRoots: {
        entryPaths: [main.parsed.source.relativePath],
        staticallyReachablePaths: [
          main.parsed.source.relativePath, session.parsed.source.relativePath,
        ],
      },
    });
    const dependency = ir.execution.edges.filter(edge =>
      edge.kind === "static-module-dependency");
    expect(dependency).toEqual([
      expect.objectContaining({
        from: scriptRegionId(main.parsed.source, "module"),
        to: scriptRegionId(session.parsed.source, "module"),
        targetLabel: "./chunks/session.js",
        resolution: "resolved",
        source: expect.objectContaining({
          relativePath: main.parsed.source.relativePath,
          range: expect.objectContaining({ lineStart: 1, columnStart: 1 }),
        }),
      }),
    ]);
    expect(ir.temporal.relations.some(rel =>
      rel.id === "time:" + dependency[0]!.id)).toBe(false);
    const selectedRoot = semanticIrExecutionTraces(ir).traces.find(trace =>
      trace.entryRegionId === scriptRegionId(main.parsed.source, "module"));
    const target = scriptRegionId(session.parsed.source, "module");
    const orphanId = scriptRegionId(orphan.parsed.source, "module");
    expect(selectedRoot?.regionIds).toContain(target);
    expect(selectedRoot?.regionIds).not.toContain(orphanId);
    const writes = ir.state.operations.filter(op =>
      op.executionRegionId === target && op.operation === "write");
    expect(writes.length).toBeGreaterThan(0);
    expect(selectedRoot?.stateWriteOperationIds).toEqual(
      expect.arrayContaining(writes.map(op => op.id)));
    expect(semanticIrExecutionTraces(ir).regionsOutsideTraces).toContain(orphanId);
  });

  it("excludes type imports and never invents unscoped static activation", () => {
    const root = "behavior_packs/BP/scripts/";
    const main = parsed(root + "main.ts", [
      'import type { Shape } from "./types.ts";',
      'import "./module.ts";',
    ].join("\n"));
    const types = parsed(root + "types.ts", "export type Shape = string;");
    const module = parsed(root + "module.ts", "export const state = true;");
    expect(build(main, types, module).execution.edges.some(edge =>
      edge.kind === "static-module-dependency")).toBe(false);
    const rooted = buildInspectionSemanticIr({
      parsedFunctions: [],
      parsedScripts: [main, types, module],
      manifestScriptRoots: {
        entryPaths: [main.parsed.source.relativePath],
        staticallyReachablePaths: [
          main.parsed.source.relativePath, module.parsed.source.relativePath,
        ],
      },
    });
    expect(rooted.execution.edges.filter(edge =>
      edge.kind === "static-module-dependency")).toEqual([
        expect.objectContaining({ targetLabel: "./module.ts" }),
      ]);
  });
});

describe("cross-file Map-backed application event source bridges", () => {
  const root = "behavior_packs/BP/scripts/";
  const sharedPath = root + "chunks/shared.js";
  const partyPath = root + "chunks/party.js";
  const runtimePath = root + "chunks/runtime.js";
  const mainPath = root + "main.js";
  const sharedText = [
    "var EVENT = { PARTY_CHANGED: 'party:changed' };",
    "var Bus = class {",
    "  static listeners = new Map();",
    "  static on(event, handler) {",
    "    const list = this.listeners.get(event) ?? [];",
    "    list.push(handler);",
    "    this.listeners.set(event, list);",
    "  }",
    "  static emit(event, ...args) {",
    "    const list = this.listeners.get(event) ?? [];",
    "    for (const handler of list) handler(...args);",
    "  }",
    "};",
    "export { EVENT, Bus };",
  ].join("\n");
  const partyText = [
    'import { world } from "@minecraft/server";',
    'import { Bus, EVENT } from "./shared.js";',
    "var Party = class {",
    "  static ready() { Bus.emit(EVENT.PARTY_CHANGED, 'arena_1'); }",
    "};",
    "function initParty() {",
    "  world.afterEvents.itemUse.subscribe(() => Party.ready());",
    "}",
    "export { initParty };",
  ].join("\n");
  const runtimeText = [
    'import { world } from "@minecraft/server";',
    'import { Bus, EVENT } from "./shared.js";',
    "function initRuntime() {",
    "  Bus.on(EVENT.PARTY_CHANGED, () => {",
    "    world.setDynamicProperty('arena:session', 'countdown');",
    "  });",
    "}",
    "export { initRuntime };",
  ].join("\n");
  const make = (withListener: boolean) => {
    const mainText = [
      'import { initParty } from "./chunks/party.js";',
      'import { initRuntime } from "./chunks/runtime.js";',
      "initParty();",
      ...(withListener ? ["initRuntime();"] : []),
    ].join("\n");
    const selected = [
      [mainPath, mainText],
      [sharedPath, sharedText],
      [partyPath, partyText],
      [runtimePath, runtimeText],
    ] as const;
    const scripts = selected.map(([path, sourceText]) =>
      parsed(path, sourceText));
    const crossFileCallEdges = deriveCrossFileCallEdges(
      selected.map(([path, text]) => ({
        path, text,
        source: { artifactId: "selected-map", relativePath: path },
      })));
    const ir = buildInspectionSemanticIr({
      parsedFunctions: [], parsedScripts: scripts,
      crossFileCallEdges,
      manifestScriptRoots: {
        entryPaths: [mainPath],
        staticallyReachablePaths: selected.map(([path]) => path).sort(),
      },
    });
    return { ir, crossFileCallEdges };
  };

  it("joins party changes to session writes only when the listener registration is source-reachable", () => {
    const { ir, crossFileCallEdges } = make(true);
    const listener = crossFileCallEdges.find(edge =>
      edge.localName === "Bus.on");
    expect(listener?.internalEvent).toMatchObject({
      role: "on", eventKey: "party:changed",
      callbackRegion: expect.stringMatching(/^callback@4:/),
    });
    const relay = ir.execution.edges.find(edge =>
      edge.kind === "internal-event-dispatch");
    expect(relay).toMatchObject({
      kind: "internal-event-dispatch",
      controlFlow: "conditional",
      targetLabel: "internal-event:party:changed",
      resolution: "resolved",
      source: expect.objectContaining({
        relativePath: partyPath,
        range: expect.objectContaining({ lineStart: 4 }),
      }),
    });
    expect(ir.temporal.relations.some(item =>
      item.id === "time:" + relay?.id)).toBe(false);
    const partyEvent = ir.execution.regions.find(region =>
      region.kind === "event-source" &&
      region.source?.relativePath === partyPath &&
      region.label === "world.afterEvents.itemUse");
    expect(partyEvent).toBeDefined();
    const trace = semanticIrExecutionTraces(ir).traces.find(item =>
      item.entryRegionId === partyEvent?.id);
    expect(trace).toBeDefined();
    expect(trace?.executionEdgeIds).toContain(relay!.id);
    expect(trace?.unresolvedExecutionEdgeIds).not.toContain(relay!.id);
    const writes = ir.state.operations.filter(operation =>
      operation.operation === "write" &&
      operation.source.relativePath === runtimePath);
    expect(writes.length).toBeGreaterThan(0);
    expect(trace?.stateWriteOperationIds).toEqual(
      expect.arrayContaining(writes.map(item => item.id)));
    const sourceFlow = sourceFlowCandidates(ir).find(flow =>
      flow.entryRegionId === partyEvent!.id);
    expect(sourceFlow?.sourceHandoffs?.some(handoff =>
      handoff.kind === "internal-event-dispatch" &&
      handoff.internalSubscriptionRegionId ===
        relay!.internalSubscriptionRegionId &&
      handoff.directTargetStateWriteIds.some(id =>
        writes.some(write => write.id === id)) &&
      handoff.proof === "RESOLVED_SOURCE_EDGE_NOT_RUNTIME_EXECUTION")).toBe(true);
    expect(sourceFlow?.runtimeStatus).toBe("NOT_OBSERVED");
  });

  it("does not traverse a source event relay when the imported subscriber is not initialized", () => {
    const { ir } = make(false);
    const relay = ir.execution.edges.find(edge =>
      edge.kind === "internal-event-dispatch");
    expect(relay).toBeDefined();
    const event = ir.execution.regions.find(region =>
      region.kind === "event-source" &&
      region.source?.relativePath === partyPath);
    const trace = semanticIrExecutionTraces(ir).traces.find(item =>
      item.entryRegionId === event?.id);
    expect(trace).toBeDefined();
    expect(trace?.unresolvedExecutionEdgeIds).toContain(relay!.id);
    expect(trace?.stateWriteOperationIds.some(writeId =>
      ir.state.operations.some(operation => operation.id === writeId &&
        operation.source.relativePath === runtimePath))).toBe(false);
  });
});

describe("manifest-rooted event registration provenance", () => {
  it("admits reachable subscriptions, including nested registration, but excludes unused and orphan handlers", () => {
    const prefix = "behavior_packs/BP/scripts/";
    const main = parsed(prefix + "main.js", 'import "./chunks/handlers.js";');
    const handlers = parsed(prefix + "chunks/handlers.js", [
      'import { world } from "@minecraft/server";',
      'world.afterEvents.playerSpawn.subscribe(() => {});',
      'function wireLeave() {',
      '  world.afterEvents.playerLeave.subscribe(() => {',
      '    world.setDynamicProperty("session:leave", true);',
      '    world.afterEvents.entityHurt.subscribe(() => {',
      '      world.setDynamicProperty("session:nested", true);',
      '    });',
      '  });',
      '}',
      'function dormant() {',
      '  world.afterEvents.entityDie.subscribe(() => {',
      '    world.setDynamicProperty("session:dormant", true);',
      '  });',
      '}',
      'wireLeave();',
      'const fake = { afterEvents: { pretend: { subscribe(_callback) {} } } };',
      'fake.afterEvents.pretend.subscribe(() => {});',
    ].join("\n"));
    const orphan = parsed(prefix + "entries/unused.js", [
      'import { world } from "@minecraft/server";',
      'world.afterEvents.playerJoin.subscribe(() => {});',
    ].join("\n"));
    const ir = buildInspectionSemanticIr({
      parsedFunctions: [],
      parsedScripts: [main, handlers, orphan],
      manifestScriptRoots: {
        entryPaths: [main.parsed.source.relativePath],
        staticallyReachablePaths: [
          main.parsed.source.relativePath,
          handlers.parsed.source.relativePath,
        ],
      },
    });
    const eventRegion = (label: string, path = handlers.parsed.source.relativePath) =>
      ir.execution.regions.find(region =>
        region.kind === "event-source" &&
        region.label === label && region.source?.relativePath === path);
    const spawn = eventRegion("world.afterEvents.playerSpawn");
    const leave = eventRegion("world.afterEvents.playerLeave");
    const nested = eventRegion("world.afterEvents.entityHurt");
    const dormant = eventRegion("world.afterEvents.entityDie");
    const orphanJoin = eventRegion("world.afterEvents.playerJoin",
      orphan.parsed.source.relativePath);
    const fake = eventRegion("unknown.afterEvents.pretend");
    expect([spawn, leave, nested, dormant, orphanJoin, fake].every(Boolean)).toBe(true);

    const leaveRegistration = ir.execution.edges.find(edge =>
      edge.kind === "event-dispatch" && edge.from === leave?.id);
    expect(leaveRegistration?.registrationRegionId).toBe(
      scriptRegionId(handlers.parsed.source, "function:wireLeave"));
    expect(ir.execution.edges.find(edge =>
      edge.kind === "event-dispatch" && edge.from === fake?.id)
      ?.registrationRegionId).toBeUndefined();

    const trace = semanticIrExecutionTraces(ir);
    for (const event of [spawn, leave, nested]) {
      expect(trace.traces.some(item => item.entryRegionId === event?.id)).toBe(true);
    }
    for (const event of [dormant, orphanJoin, fake]) {
      expect(trace.traces.some(item => item.entryRegionId === event?.id)).toBe(false);
      expect(trace.regionsOutsideTraces).toContain(event!.id);
    }
    const flows = sourceFlowCandidates(ir);
    const leaveFlow = flows.find(flow =>
      flow.entryRegionId === leave!.id);
    expect(leaveFlow?.sourceTraceStatus).toBe("SOURCE_ROOT_TRACE");
    // This source contains a valid authored dormant callback state write,
    // but its subscription is not source-reachable from the manifest.
    // Keep its source site as an orphan, never a successful game phase.
    expect(flows.some(flow =>
      flow.sourceTraceStatus === "DISCONNECTED_SOURCE_REGION" &&
      flow.sourceSteps.some(step =>
        step.source.relativePath === handlers.parsed.source.relativePath &&
        step.source.range?.lineStart === 13 &&
        step.kind === "state" && step.operation === "write"))).toBe(true);
    expect(leaveFlow?.sourceHandoffs?.some(handoff =>
      handoff.kind === "event-dispatch" &&
      handoff.registrationRegionId === leaveRegistration?.registrationRegionId &&
      handoff.directTargetStateWriteIds.length > 0 &&
      handoff.proof === "RESOLVED_SOURCE_EDGE_NOT_RUNTIME_EXECUTION")).toBe(true);
    expect(leaveFlow?.runtimeStatus).toBe("NOT_OBSERVED");
  });

  it("retains unknown-attachment behavior without inventing registration reachability", () => {
    const path = "behavior_packs/BP/scripts/main.js";
    const file = parsed(path, [
      'import { world } from "@minecraft/server";',
      'function installLater() {',
      '  world.afterEvents.playerLeave.subscribe(() => {});',
      '}',
    ].join("\n"));
    const unbound = build(file);
    expect(unbound.execution.manifestScriptRoots).toBeUndefined();
    // Without a world-attached manifest, a listener is still an authored
    // source possibility; it must NOT be labeled runtime-proven.
    const event = unbound.execution.regions.find(region =>
      region.kind === "event-source" &&
      region.label === "world.afterEvents.playerLeave");
    expect(event).toBeDefined();
    expect(semanticIrExecutionTraces(unbound).traces.some(trace =>
      trace.entryRegionId === event!.id)).toBe(true);
    const rooted = buildInspectionSemanticIr({
      parsedFunctions: [],
      parsedScripts: [file],
      manifestScriptRoots: {
        entryPaths: [path], staticallyReachablePaths: [path],
      },
    });
    const blocked = semanticIrExecutionTraces(rooted);
    expect(blocked.traces.some(trace => trace.entryRegionId === event!.id)).toBe(false);
    expect(blocked.regionsOutsideTraces).toContain(event!.id);
  });
});

describe("selected-map dynamic import source handoffs", () => {
  it("joins a literal import() to the exact same-pack module as a deferred candidate", () => {
    const main = parsed("behavior_packs/BP/scripts/main.js", [
      "async function start() {",
      "  await import('./chunks/bootstrap.js');",
      "}",
      "start();",
    ].join("\n"));
    const chunk = parsed("behavior_packs/BP/scripts/chunks/bootstrap.js",
      "export const loaded = true;");
    const ir = build(main, chunk);
    const imports = ir.execution.edges.filter(edge =>
      edge.targetLabel.startsWith("import("));
    expect(imports).toHaveLength(1);
    expect(imports[0]).toMatchObject({
      kind: "deferred",
      controlFlow: "deferred",
      resolution: "resolved",
      from: scriptRegionId(main.parsed.source, "function:start"),
      to: scriptRegionId(chunk.parsed.source, "module"),
      source: expect.objectContaining({
        relativePath: main.parsed.source.relativePath,
        range: expect.objectContaining({ lineStart: 2 }),
      }),
    });
    expect(ir.temporal.relations.find(rel =>
      rel.id === "time:" + imports[0]!.id)).toMatchObject({
      kind: "deferred", resolution: "resolved",
    });
    const traced = semanticIrExecutionTraces(ir);
    expect(traced.traces.some(trace =>
      trace.entryRegionId === scriptRegionId(main.parsed.source, "module") &&
      trace.regionIds.includes(scriptRegionId(chunk.parsed.source, "module"))
    )).toBe(true);
    expect(traced.traces.some(trace =>
      trace.entryRegionId === scriptRegionId(chunk.parsed.source, "module"))
    ).toBe(false);
  });

  it("retains bounded source statement order for serial awaited module loads", () => {
    const main = parsed("behavior_packs/BP/scripts/main.js", [
      "async function start() {",
      "  await import('./bootstrap.js');",
      "  await import('./gameplay.js');",
      "  await import('./lobby.js');",
      "}",
    ].join("\n"));
    const ir = build(main,
      parsed("behavior_packs/BP/scripts/bootstrap.js", "export const a = true;"),
      parsed("behavior_packs/BP/scripts/gameplay.js", "export const b = true;"),
      parsed("behavior_packs/BP/scripts/lobby.js", "export const c = true;"));
    const imports = ir.execution.edges.filter(edge =>
      edge.targetLabel.startsWith("import("));
    expect(imports).toHaveLength(3);
    const positions = imports.map(edge => edge.sourceSequence?.statementIndex).sort();
    expect(positions).toEqual([0, 1, 2]);
    expect(imports.every(edge =>
      edge.sourceSequence?.block.relativePath === main.parsed.source.relativePath
    )).toBe(true);
    // These are authored positions, not a claim that any promise resolved.
    expect(imports.every(edge => edge.kind === "deferred")).toBe(true);
  });

  it("keeps lexical and preceding-exit guards on a conditional dynamic import", () => {
    const main = parsed("behavior_packs/BP/scripts/main.js", [
      "async function start(ready, active) {",
      "  if (!ready) return;",
      "  if (active) {",
      "    await import('./gameplay.js');",
      "  }",
      "}",
    ].join("\n"));
    const target = parsed("behavior_packs/BP/scripts/gameplay.js",
      "export const stage = 1;");
    const ir = build(main, target);
    const edge = ir.execution.edges.find(e => e.targetLabel.startsWith("import("));
    expect(edge).toBeDefined();
    expect(edge?.resolution).toBe("resolved");
    expect(edge?.lexicalGuards).toEqual(expect.arrayContaining([
      expect.objectContaining({ expression: "active", branch: "true" }),
    ]));
    expect(edge?.precedenceGuards).toEqual(expect.arrayContaining([
      expect.objectContaining({ expression: "!ready", branch: "false" }),
    ]));
    expect(edge?.sourceSequence?.statementIndex).toBe(0);
  });


  it("does not invent an independent bootstrap path for a dynamically imported module", () => {
    const main = parsed("behavior_packs/BP/scripts/main.js", [
      "async function start() {",
      "  await import('./chunks/bootstrap.js');",
      "}",
      "// The entrypoint never calls start.",
    ].join("\n"));
    const chunk = parsed("behavior_packs/BP/scripts/chunks/bootstrap.js",
      "export const stage = 1;");
    const ir = build(main, chunk);
    const traced = semanticIrExecutionTraces(ir);
    const importedId = scriptRegionId(chunk.parsed.source, "module");
    const mainId = scriptRegionId(main.parsed.source, "module");
    expect(traced.traces.some(trace => trace.entryRegionId === mainId)).toBe(true);
    expect(traced.traces.some(trace => trace.entryRegionId === importedId)).toBe(false);
    expect(traced.regionsOutsideTraces).toContain(importedId);
    expect(ir.execution.edges.filter(edge => edge.targetLabel.startsWith("import(")))
      .toEqual([expect.objectContaining({ resolution: "resolved", to: importedId })]);
  });

  it("does not suppress another module root from unresolved or unrelated deferred edges", () => {
    const main = parsed("behavior_packs/BP/scripts/main.js",
      "async function start(key) { await import(key); }");
    const other = parsed("behavior_packs/BP/scripts/chunks/other.js",
      "export const independent = true;");
    const ir = build(main, other);
    const otherId = scriptRegionId(other.parsed.source, "module");
    const traced = semanticIrExecutionTraces(ir);
    expect(traced.traces.some(trace => trace.entryRegionId === otherId)).toBe(true);
    expect(ir.execution.edges.some(edge =>
      edge.targetLabel.startsWith("import(") && edge.resolution === "unresolved"
    )).toBe(true);
  });

  it("preserves nonliteral and absent module targets as unresolved evidence", () => {
    const main = parsed("behavior_packs/BP/scripts/main.js",
      "async function start(name) { await import(name); await import('./not-in-map.js'); }");
    const ir = build(main);
    const links = ir.execution.edges.filter(edge =>
      edge.targetLabel.startsWith("import("));
    expect(links).toHaveLength(2);
    expect(links.every(edge =>
      edge.kind === "deferred" && edge.resolution === "unresolved" &&
      edge.to === undefined)).toBe(true);
  });

  it("rejects foreign-pack and duplicate-path targets without selecting a winner", () => {
    const main = parsed("behavior_packs/BP/scripts/main.js",
      "async function start() { await import('./target.js'); await import('../../Other/scripts/target.js'); }");
    const first = parsed("behavior_packs/BP/scripts/target.js",
      "export const one = 1;");
    const duplicate = parsed("behavior_packs/BP/scripts/target.js",
      "export const two = 2;");
    const other = parsed("behavior_packs/Other/scripts/target.js",
      "export const outside = 3;");
    const ir = build(main, first, duplicate, other);
    const links = ir.execution.edges.filter(edge =>
      edge.targetLabel.startsWith("import("));
    expect(links).toHaveLength(2);
    expect(links.every(edge =>
      edge.resolution === "unresolved" && edge.to === undefined)).toBe(true);
  });
});
