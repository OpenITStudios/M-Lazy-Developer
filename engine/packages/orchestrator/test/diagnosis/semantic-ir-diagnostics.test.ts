import { describe, expect, it } from "vitest";
import type { SemanticIr } from "../../../semantic-ir/src/index.js";
import { semanticIrDiagnostics } from "../../src/diagnosis/semantic-ir-diagnostics.js";

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
