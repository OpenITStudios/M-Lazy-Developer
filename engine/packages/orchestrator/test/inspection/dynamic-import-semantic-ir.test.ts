import { describe, expect, it } from "vitest";
import { parseScriptFile } from "../../../../analyzers/scripts/src/index.js";
import { semanticIrExecutionTraces } from "../../../semantic-ir/src/index.js";
import { buildInspectionSemanticIr, scriptRegionId } from "../../src/diagnosis/semantic-ir-stage.js";

const parsed = (path: string, text: string, artifactId = "selected-map") => {
  const source = { artifactId, relativePath: path };
  return { parsed: parseScriptFile(path, text, source) };
};
const build = (...scripts: ReturnType<typeof parsed>[]) =>
  buildInspectionSemanticIr({ parsedFunctions: [], parsedScripts: scripts });

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
