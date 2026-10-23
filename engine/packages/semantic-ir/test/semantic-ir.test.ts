import { describe, expect, it } from "vitest";
import {
  semanticIrSummary,
  validateSemanticIr,
  type SemanticIr,
} from "../src/index.js";

const source = {
  artifactId: "a",
  relativePath: "scripts/main.js",
};

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
      id: "edge:1",
      from: "exec:module",
      to: "exec:callback",
      targetLabel: "callback",
      resolution: "resolved",
      kind: "deferred",
      scheduler: "run",
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
      id: "state-op:1",
      executionRegionId: "exec:callback",
      surfaceId: "state:dynamic-property:round",
      operation: "write",
      source,
    }],
    authorityBindings: [],
  },
  temporal: {
    relations: [{
      id: "time:1",
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

describe("semantic IR", () => {
  it("validates cross-layer references", () => {
    expect(validateSemanticIr(ir)).toEqual([]);
  });

  it("summarizes unresolved and unguarded temporal surfaces", () => {
    expect(semanticIrSummary(ir)).toMatchObject({
      executionRegions: 2,
      executionEdges: 1,
      deferredEdges: 1,
      stateWrites: 1,
      unguardedDeferredRelations: 1,
    });
  });

  it("fails closed on dangling resolved references", () => {
    expect(validateSemanticIr({
      ...ir,
      execution: {
        ...ir.execution,
        edges: [{
          ...ir.execution.edges[0]!,
          to: "missing",
        }],
      },
    })).toEqual([
      "Resolved execution edge target does not exist: edge:1",
    ]);
  });
  it("rejects manufactured or non-unique manifest script entry roots", () => {
    const good = {
      ...ir,
      execution: {
        ...ir.execution,
        manifestScriptRoots: {
          entryPaths: [source.relativePath],
          staticallyReachablePaths: [source.relativePath],
        },
      },
    } satisfies SemanticIr;
    expect(validateSemanticIr(good)).toEqual([]);
    expect(validateSemanticIr({
      ...good,
      execution: {
        ...good.execution,
        manifestScriptRoots: {
          entryPaths: ["scripts/missing.js"],
          staticallyReachablePaths: [source.relativePath],
        },
      },
    }).some(error => error.includes("not uniquely owned") ||
      error.includes("outside its static module closure"))).toBe(true);
    expect(validateSemanticIr({
      ...good,
      execution: {
        ...good.execution,
        manifestScriptRoots: {
          entryPaths: [source.relativePath, source.relativePath],
          staticallyReachablePaths: [source.relativePath],
        },
      },
    }).some(error => error.includes("nonempty and unique"))).toBe(true);
  });

});
