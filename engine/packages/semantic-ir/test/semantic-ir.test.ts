import { describe, expect, it } from "vitest";
import {
  semanticIrSummary,
  semanticIrSourceWriteContinuations,
  sourceSiteStrictlyAfter,
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
  it("orders continuation calls AFTER the full assignment span, not inside its RHS", () => {
    // The original minified Bedwars readiness RHS contains a call whose
    // start is later than the write START but earlier than its END.
    // The checked source positions are shape evidence, not gameplay proof.
    const at = (line: number, columnStart: number, columnEnd: number) => ({
      artifactId: "artifact:span-fixture",
      relativePath: "behavior_packs/demo/scripts/main.js",
      range: {lineStart: line, lineEnd: line, columnStart, columnEnd},
    });
    const writeSource = at(175, 17079, 17115);
    const rhsCallSource = at(175, 17092, 17115);
    const laterCallSource = at(176, 3, 27);
    const insufficientSource = {
      artifactId: writeSource.artifactId,
      relativePath: writeSource.relativePath,
      range: {lineStart: 176, lineEnd: 176, columnStart: 3},
    };
    expect(sourceSiteStrictlyAfter(writeSource, rhsCallSource)).toBe(false);
    expect(sourceSiteStrictlyAfter(writeSource, laterCallSource)).toBe(true);
    expect(sourceSiteStrictlyAfter(writeSource,
      insufficientSource)).toBe(true);
    expect(sourceSiteStrictlyAfter({
      ...writeSource,
      range: {lineStart: 175, columnStart: 17079},
    }, laterCallSource)).toBe(false);
    expect(sourceSiteStrictlyAfter(writeSource, {
      ...laterCallSource, artifactId: "artifact:other-world",
    })).toBe(false);
    const candidate: SemanticIr = {
      schemaVersion: 1,
      execution: {
        regions: ["ready", "rhs-effect", "next-effect"].map(label => ({
          id: "exec:" + label, kind: "script-function" as const,
          ownerId: "demo", label, source: at(170, 1, 2),
        })),
        edges: [{
          id: "edge:inside-rhs", from: "exec:ready",
          to: "exec:rhs-effect", kind: "synchronous-call",
          resolution: "resolved", targetLabel: "computeReady",
          source: rhsCallSource,
        }, {
          id: "edge:after-write", from: "exec:ready",
          to: "exec:next-effect", kind: "synchronous-call",
          resolution: "resolved", targetLabel: "saveReady",
          source: laterCallSource,
        }],
        worldEffects: [],
        outcomes: [],
      },
      state: {
        surfaces: [
          {id:"surface:ready",
            ref:{kind:"script-memory",key:"main.js::ready@175"}},
        ],
        operations: [{
          id:"operation:ready", executionRegionId:"exec:ready",
          surfaceId:"surface:ready", operation:"write",
          source:writeSource, authoredBooleanPropertyWrite:{
            targetExpression:"t.ready",
            valueExpression:"!!n && this.loading.sweep(e,n)",
            form:"logical-expression",
            proof:"SITE_LOCAL_SOURCE_SYNTAX_NOT_RUNTIME_STATE",
          },
        }],
        resourceActions:[],
        authorityBindings:[],
      },
      temporal:{relations:[]},
    };
    const result = semanticIrSourceWriteContinuations(
      candidate, ["operation:ready"], new Set(),
    ).get("operation:ready")!;
    // The false downstream chain must not be manufactured. A later
    // authored call is still a navigable edge, not a runtime transition.
    expect(result.paths).toEqual([]);
    expect(result.blockedUnrootedEventEdges).toBe(0);
    expect(result.searchTruncated).toBe(false);
    const withEffects: SemanticIr = {
      ...candidate,
      execution: {
        ...candidate.execution,
        worldEffects: [{
          id:"world-effect:after", executionRegionId:"exec:next-effect",
          kind:"block-mutation", mechanism:"script-command",
          targetLabel:"setblock", precision:"parsed-command",
          source:at(178, 3, 13),
        }],
      },
    };
    const continued = semanticIrSourceWriteContinuations(
      withEffects, ["operation:ready"], new Set(),
    ).get("operation:ready")!;
    expect(continued.paths).toHaveLength(1);
    expect(continued.paths[0]?.executionEdgeIds).toEqual([
      "edge:after-write",
    ]);
    expect(continued.paths[0]?.directTargetEvidenceIds).toEqual([
      "world-effect:after",
    ]);
  });

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


  it("refuses a forged event subscription without an exact registration region", () => {
    const invalid: SemanticIr = {
      ...ir,
      execution: {
        ...ir.execution,
        regions: [
          ...ir.execution.regions,
          {
            id: "event:authored",
            kind: "event-source",
            ownerId: "world",
            label: "world.afterEvents.playerSpawn",
            source,
          },
        ],
        edges: [
          ...ir.execution.edges,
          {
            id: "edge:event-registration",
            from: "event:authored",
            kind: "event-dispatch",
            targetLabel: "unknown-callback",
            resolution: "unresolved",
            source,
            registrationRegionId: "missing:region",
          },
        ],
      },
    };
    expect(validateSemanticIr(invalid)).toContain(
      "Event registration region lacks exact source ownership: edge:event-registration",
    );
  });

});
