import { describe, expect, it } from "vitest";
import type { SemanticIr, AuthoredBranchGuard } from "../../semantic-ir/src/index.js";
import type { SourceRef } from "../../project-model/src/index.js";
import {
  reconcileSourceStateOutcomes,
  reconcileSourceResourceOutcomes,
  deriveSourceEffectSlices,
  describeSourceBehaviorShape,
  compareSourceBehaviorShapes,
  type SourceBehaviorShapeInput,
} from "../src/index.js";

const src = (line: number, columnStart = 1, columnEnd = 10,
  artifactId = "map:a", relativePath = "scripts/round.js"): SourceRef => ({
  artifactId, relativePath,
  range: { lineStart: line, lineEnd: line, columnStart, columnEnd },
});
const guard = (branch: "true" | "false", line = 3): AuthoredBranchGuard => ({
  expression: "ready", branch, source: src(line),
});
const region = "exec:script:round";
const ir = (): SemanticIr => ({
  schemaVersion: 1,
  execution: {
    regions: [{ id: region, kind: "script-function", ownerId: "round",
      label: "function:run", source: src(1) }],
    edges: [],
    outcomes: [{
      id: "outcome:start", executionRegionId: region,
      propertyName: "action", value: "start",
      source: src(8), lexicalGuards: [guard("true")],
    }, {
      id: "outcome:abort", executionRegionId: region,
      propertyName: "action", value: "abort",
      source: src(9), lexicalGuards: [guard("false")],
    }, {
      id: "outcome:unknown", executionRegionId: region,
      propertyName: "action", value: "unknown",
      source: src(2), lexicalGuards: [guard("true")],
    }],
  },
  state: {
    surfaces: [{ id: "state:phase", ref: { kind: "script-memory", key: "phase" } }],
    operations: [{
      id: "write:active", executionRegionId: region,
      surfaceId: "state:phase", operation: "write",
      writtenValue: { kind: "literal", value: "active" },
      source: src(5), lexicalGuards: [guard("true")],
    }, {
      id: "write:blocked", executionRegionId: region,
      surfaceId: "state:phase", operation: "write",
      writtenValue: { kind: "literal", value: "blocked" },
      source: src(6), lexicalGuards: [guard("false")],
    }, {
      id: "write:too-late", executionRegionId: region,
      surfaceId: "state:phase", operation: "write",
      writtenValue: { kind: "literal", value: "late" },
      source: src(11), lexicalGuards: [guard("true")],
    }, {
      id: "write:other-guard-site", executionRegionId: region,
      surfaceId: "state:phase", operation: "write",
      writtenValue: { kind: "literal", value: "different" },
      source: src(4), lexicalGuards: [guard("true", 4)],
    }, {
      id: "write:another-artifact", executionRegionId: region,
      surfaceId: "state:phase", operation: "write",
      writtenValue: { kind: "literal", value: "foreign" },
      source: src(4,1,10,"map:b"), lexicalGuards: [guard("true")],
    }],
    authorityBindings: [],
  },
  temporal: { relations: [] },
});

describe("source-observed state/outcome reconciliation", () => {
  it("marks unique world-property CFG reaching definitions only when the modeled path is complete", () => {
    const codeBlock = src(1);
    const site = (statementIndex: number) => ({
      block: codeBlock, statementIndex, directCall: true,
      stableWorldReceiver: true,
    });
    const controlFlow = {
      executionRegionId: region,
      entryId: "cfg:entry",
      nodes: [
        { id: "cfg:entry", kind: "entry" as const },
        { id: "cfg:write", kind: "statement" as const, site: site(0) },
        { id: "cfg:read", kind: "statement" as const, site: site(1) },
        { id: "cfg:effect", kind: "statement" as const, site: site(2) },
      ],
      edges: [
        { from: "cfg:entry", to: "cfg:write" },
        { from: "cfg:write", to: "cfg:read" },
        { from: "cfg:read", to: "cfg:effect" },
      ],
    };
    const selected: SemanticIr = {
      schemaVersion: 1,
      execution: {
        regions: [{ id: region, kind: "script-module", ownerId: "round",
          label: "module", source: src(1) }],
        edges: [], controlFlow: [controlFlow],
        worldEffects: [{
          id: "effect:gate", executionRegionId: region,
          kind: "block-mutation", mechanism: "script-api",
          targetLabel: "gate", precision: "typed-method",
          source: src(10), lexicalGuards: [guard("true", 8)],
        }],
      },
      state: {
        surfaces: [{ id: "state:phase", ref: {
          kind: "dynamic-property", key: "phase" } }],
        operations: [{
          id: "write:ready", executionRegionId: region,
          surfaceId: "state:phase", operation: "write",
          targetHint: "world", source: src(5),
          sourceSequence: site(0),
          writtenValue: { kind: "literal", value: "ready",
            scalarKind: "string" },
        }, {
          id: "read:guard", executionRegionId: region,
          surfaceId: "state:phase", operation: "read",
          targetHint: "world", source: src(8),
          sourceSequence: site(1),
        }],
        authorityBindings: [],
      },
      temporal: { relations: [] },
    };
    const handoffs = (value: SemanticIr) => deriveSourceEffectSlices(value)
      .find(item => item.effectId === "effect:gate")
      ?.sourceLocalStateValueHandoffs ?? [];
    expect(handoffs(selected)).toEqual([
      expect.objectContaining({
        writeOperationId: "write:ready",
        guardReadOperationId: "read:guard",
        origin: "SOURCE_LOCAL",
        sourceReachingProof:
          "UNIQUE_SOURCE_CFG_REACHING_DEFINITION_NOT_RUNTIME_VALUE",
      }),
    ]);
    const opaqueFlow = { ...controlFlow,
      nodes: [
        ...controlFlow.nodes.slice(0, 2),
        { id: "cfg:unknown", kind: "opaque" as const },
        ...controlFlow.nodes.slice(2),
      ],
      edges: [
        { from: "cfg:entry", to: "cfg:write" },
        { from: "cfg:write", to: "cfg:unknown" },
        { from: "cfg:unknown", to: "cfg:read" },
        { from: "cfg:read", to: "cfg:effect" },
      ],
    };
    const ambiguous = { ...selected, execution: {
      ...selected.execution, controlFlow: [opaqueFlow],
    }};
    expect(handoffs(ambiguous).some(item =>
      item.sourceReachingProof !== undefined)).toBe(false);
  });


  it("marks exact internal event-bus dispatch as a source boundary, not live delivery", () => {
    const root="exec:script:entry", save="exec:script:save",
      cb="exec:script:callback";
    const eventIr: SemanticIr = {
      schemaVersion:1,
      execution: {
        regions: [
          {id:root,kind:"script-module",ownerId:"entry",label:"module",source:src(1)},
          {id:save,kind:"script-function",ownerId:"entry",label:"save",source:src(2)},
          {id:cb,kind:"script-callback",ownerId:"entry",label:"callback",source:src(6)},
        ],
        edges: [{
          id:"call:save",kind:"synchronous-call",from:root,to:save,
          resolution:"resolved",targetLabel:"save",source:src(2),
        },{
          id:"bus:changed",kind:"internal-event-dispatch",from:save,to:cb,
          resolution:"resolved",targetLabel:"party:changed",source:src(4),
          internalSubscriptionRegionId:root,
          internalSubscriptionSource:src(1),
        }],
      },
      state:{
        surfaces:[{id:"flag",ref:{kind:"script-memory",key:"member.ready"}}],
        operations:[{
          id:"write:ready",surfaceId:"flag",operation:"write",
          executionRegionId:cb,source:src(7),
        }],
        authorityBindings:[],
      },
      temporal:{relations:[]},
    };
    const effect=deriveSourceEffectSlices(eventIr)
      .find(item=>item.effectId==="write:ready");
    const chain=effect?.candidateIngress.find(item=>item.entryRegionId===root);
    expect(chain?.regionIds).toEqual([root,save,cb]);
    expect(chain?.executionEdgeIds).toEqual(["call:save","bus:changed"]);
    expect(chain?.temporalBoundaryEdgeIds).toEqual(["bus:changed"]);
    expect(chain?.temporalBoundaryEvidence.map(item=>item.kind))
      .toEqual(["internal-event-dispatch"]);
    expect(chain?.temporalBoundaryEvidence[0]?.sourceGateStatus)
      .toBe("UNRESOLVED");
  });


  it("selects only earlier exact-document and same-branch writes", () => {
    const candidate = reconcileSourceStateOutcomes(ir());
    expect(candidate.map(item => item.outcomeId))
      .toEqual(["outcome:abort", "outcome:start", "outcome:unknown"]);
    expect(candidate.find(item => item.outcomeId === "outcome:start")
      ?.precedingWriteOperationIds).toEqual(["write:active"]);
    expect(candidate.find(item => item.outcomeId === "outcome:abort")
      ?.precedingWriteOperationIds).toEqual(["write:blocked"]);
    const start = candidate.find(item => item.outcomeId === "outcome:start");
    expect(start?.status).toBe("SOURCE_ORDER_CANDIDATE");
    expect(start?.provenance).toEqual(expect.objectContaining({
      kind: "source-inference", evidenceCeiling: "inferred",
      evidenceIds: ["outcome:start", "write:active"],
    }));
    expect(candidate.find(item => item.outcomeId === "outcome:unknown")
      ?.status).toBe("UNRESOLVED");
    expect(candidate.find(item => item.outcomeId === "outcome:unknown")
      ?.precedingWriteOperationIds).toEqual([]);
  });

  it("retains enclosing and unconditional source writes before nested return branches", () => {
    const fixture = ir();
    const operations: SemanticIr["state"]["operations"] = [{
      id: "write:base", executionRegionId: region,
      surfaceId: "state:session", operation: "write",
      writtenValue: { kind: "literal", value: "ready" },
      source: src(2),
    }, {
      id: "write:outer", executionRegionId: region,
      surfaceId: "state:phase", operation: "write",
      writtenValue: { kind: "literal", value: "active" },
      source: src(5), lexicalGuards: [guard("true", 3)],
    }, {
      id: "write:opposite", executionRegionId: region,
      surfaceId: "state:phase", operation: "write",
      writtenValue: { kind: "literal", value: "blocked" },
      source: src(6), lexicalGuards: [guard("false", 3)],
    }, {
      id: "write:lookalike", executionRegionId: region,
      surfaceId: "state:ignored", operation: "write",
      writtenValue: { kind: "literal", value: "not-same-guard" },
      source: src(7), lexicalGuards: [guard("true", 7)],
    }];
    const observed = reconcileSourceStateOutcomes({
      ...fixture,
      execution: { ...fixture.execution, outcomes: [{
        id: "outcome:nested", executionRegionId: region,
        propertyName: "action", value: "start", source: src(10),
        lexicalGuards: [guard("true", 3), guard("true", 8)],
      }, {
        id: "outcome:alternate", executionRegionId: region,
        propertyName: "action", value: "abort", source: src(11),
        lexicalGuards: [guard("false", 3)],
      }] },
      state: { ...fixture.state, operations },
    });
    const nested = observed.find(item => item.outcomeId === "outcome:nested");
    const alternate = observed.find(item => item.outcomeId === "outcome:alternate");
    expect(nested?.precedingWriteOperationIds)
      .toEqual(["write:base", "write:outer"]);
    expect(nested?.status).toBe("SOURCE_ORDER_CANDIDATE");
    expect(nested?.intermediateMutationOperationIds).toEqual([]);
    expect(alternate?.precedingWriteOperationIds)
      .toEqual(["write:base", "write:opposite"]);
    expect(alternate?.status).toBe("SOURCE_ORDER_CANDIDATE");
    expect(alternate?.provenance.evidenceCeiling).toBe("inferred");
  });

  it("fails closed on possible intervening writes and imprecise lexical source identities", () => {
    const fixture = ir();
    const operations: SemanticIr["state"]["operations"] = [{
      id: "write:before", executionRegionId: region,
      surfaceId: "state:phase", operation: "write",
      writtenValue: { kind: "literal", value: "active" },
      source: src(3),
    }, {
      id: "write:maybe", executionRegionId: region,
      surfaceId: "state:phase", operation: "write",
      writtenValue: { kind: "literal", value: "blocked" },
      source: src(6), lexicalGuards: [guard("true", 6)],
    }];
    const results = reconcileSourceStateOutcomes({
      ...fixture,
      execution: { ...fixture.execution, outcomes: [{
        id: "outcome:guarded", executionRegionId: region,
        propertyName: "action", value: "start", source: src(8),
        lexicalGuards: [guard("true", 4)],
      }, {
        id: "outcome:imprecise-guard", executionRegionId: region,
        propertyName: "action", value: "unknown", source: src(9),
        lexicalGuards: [{
          expression: "ready", branch: "true",
          source: { artifactId: "map:a", relativePath: "scripts/round.js" },
        }],
      }] },
      state: { ...fixture.state, operations },
    });
    const guarded = results.find(item => item.outcomeId === "outcome:guarded");
    expect(guarded?.precedingWriteOperationIds).toEqual(["write:before"]);
    expect(guarded?.intermediateMutationOperationIds).toEqual(["write:maybe"]);
    expect(guarded?.status).toBe("UNRESOLVED");
    const unknown = results.find(item => item.outcomeId === "outcome:imprecise-guard");
    expect(unknown?.precedingWriteOperationIds).toEqual([]);
    expect(unknown?.status).toBe("UNRESOLVED");
  });

  it("flags repeated writes to the same surface instead of selecting a stable final value", () => {
    const fixture = ir();
    const result = reconcileSourceStateOutcomes({
      ...fixture,
      state: { ...fixture.state, operations: [
        ...fixture.state.operations,
        {
          id: "write:second-active", executionRegionId: region,
          surfaceId: "state:phase", operation: "write",
          writtenValue: { kind: "literal", value: "overwritten" },
          source: src(7), lexicalGuards: [guard("true")],
        },
      ] },
    });
    const active = result.find(item => item.outcomeId === "outcome:start");
    expect(active?.precedingWriteOperationIds).toEqual([
      "write:active", "write:second-active",
    ]);
    expect(active?.status).toBe("UNRESOLVED");
    expect(active?.intermediateMutationOperationIds).toEqual([
      "write:active", "write:second-active",
    ]);
    const abort = result.find(item => item.outcomeId === "outcome:abort");
    expect(abort?.status).toBe("SOURCE_ORDER_CANDIDATE");
    expect(abort?.intermediateMutationOperationIds).toEqual([]);
  });

  it("flags potentially intervening writes from another guard or unknown position", () => {
    const fixture = ir();
    const newerWrite = {
      id: "write:conditional-intermediate", executionRegionId: region,
      surfaceId: "state:phase", operation: "write" as const,
      writtenValue: { kind: "literal" as const, value: "possibly-elsewhere" },
      source: src(6), lexicalGuards: [guard("true", 6)],
    };
    const missingPosition = {
      id: "write:unlocated", executionRegionId: region,
      surfaceId: "state:phase", operation: "write" as const,
      writtenValue: { kind: "literal" as const, value: "opaque" },
      source: { artifactId: "map:a", relativePath: "scripts/round.js" },
    };
    const unrelatedSurface = {
      id: "write:other-surface", executionRegionId: region,
      surfaceId: "state:unrelated", operation: "write" as const,
      writtenValue: { kind: "literal" as const, value: "unrelated" },
      source: src(6),
    };
    const results = reconcileSourceStateOutcomes({
      ...fixture,
      state: { ...fixture.state,
        operations: [...fixture.state.operations,
          newerWrite, missingPosition, unrelatedSurface],
      },
    });
    const result = results.find(item => item.outcomeId === "outcome:start");
    expect(result?.status).toBe("UNRESOLVED");
    // Source-order association does not yet establish causal surface ownership.
    // A compatible earlier write to another surface remains visible as a hint.
    expect(result?.precedingWriteOperationIds).toEqual([
      "write:active", "write:other-surface",
    ]);
    expect(result?.intermediateMutationOperationIds).toEqual([
      "write:conditional-intermediate", "write:unlocated",
    ]);
    expect(result?.provenance.evidenceIds).toEqual([
      "outcome:start", "write:active",
      "write:conditional-intermediate", "write:other-surface", "write:unlocated",
    ]);
  });

  it("rejects missing positional identity, foreign regions, and unmatched precedence", () => {
    const fixture = ir();
    const output = reconcileSourceStateOutcomes({
      ...fixture,
      execution: {
        ...fixture.execution,
        outcomes: [{
          id: "outcome:bounded", executionRegionId: region,
          propertyName: "action", value: "bounded",
          source: src(8),
          lexicalGuards: [guard("true")],
          precedenceGuards: [guard("false", 2)],
        }, {
          id: "outcome:imprecise", executionRegionId: region,
          propertyName: "action", value: "imprecise",
          source: { artifactId: "map:a", relativePath: "scripts/round.js" },
          lexicalGuards: [guard("true")],
        }],
      },
      state: {
        ...fixture.state,
        operations: [...fixture.state.operations, {
          id: "write:foreign-region", executionRegionId: "different-region",
          surfaceId: "state:phase", operation: "write",
          writtenValue: { kind: "literal", value: "remote" },
          source: src(4), lexicalGuards: [guard("true")],
        }],
      },
    });
    expect(output.every(candidate => candidate.status === "UNRESOLVED")).toBe(true);
    expect(output.every(candidate =>
      candidate.precedingWriteOperationIds.length === 0)).toBe(true);
  });
});


describe("source-observed resource/outcome reconciliation", () => {
  it("retains exact same-arm release before a return without declaring successful cleanup", () => {
    const fixture = ir();
    const actions: NonNullable<SemanticIr["state"]["resourceActions"]> = [{
      id: "action:release-playing", executionRegionId: region,
      surface: "tag", action: "release", key: "player:playing",
      precision: "exact", source: src(5),
      lexicalGuards: [guard("true")],
    }, {
      id: "action:acquire-ready", executionRegionId: region,
      surface: "tag", action: "acquire", key: "player:ready",
      precision: "exact", source: src(6),
      lexicalGuards: [guard("false")],
    }, {
      id: "action:unrelated-artifact", executionRegionId: region,
      surface: "tag", action: "release", key: "other:playing",
      precision: "exact", source: src(4, 1, 10, "map:b"),
      lexicalGuards: [guard("true")],
    }, {
      id: "action:too-late", executionRegionId: region,
      surface: "tag", action: "release", key: "player:too-late",
      precision: "exact", source: src(11),
      lexicalGuards: [guard("true")],
    }];
    const output = reconcileSourceResourceOutcomes({
      ...fixture,
      state: { ...fixture.state, resourceActions: actions },
    });
    const start = output.find(item => item.outcomeId === "outcome:start");
    const abort = output.find(item => item.outcomeId === "outcome:abort");
    const unknown = output.find(item => item.outcomeId === "outcome:unknown");
    expect(start?.precedingResourceActionIds).toEqual(["action:release-playing"]);
    expect(start?.precedingReleaseActionIds).toEqual(["action:release-playing"]);
    expect(start?.status).toBe("SOURCE_ORDER_CANDIDATE");
    expect(start?.provenance).toMatchObject({
      kind: "source-inference",
      evidenceCeiling: "inferred",
      evidenceIds: ["action:release-playing", "outcome:start"],
    });
    expect(abort?.precedingResourceActionIds).toEqual(["action:acquire-ready"]);
    expect(abort?.precedingReleaseActionIds).toEqual([]);
    expect(unknown?.precedingResourceActionIds).toEqual([]);
    expect(unknown?.status).toBe("UNRESOLVED");
  });

  it("accepts enclosing action guards but rejects opposite arms, wrong sites and early-exit mismatches", () => {
    const fixture = ir();
    const actions: NonNullable<SemanticIr["state"]["resourceActions"]> = [{
      id: "action:unguarded", executionRegionId: region,
      surface: "effect", action: "release", key: "player:*",
      precision: "surface-level", source: src(2),
    }, {
      id: "action:outer", executionRegionId: region,
      surface: "tag", action: "release", key: "player:playing",
      precision: "exact", source: src(4),
      lexicalGuards: [guard("true", 3)],
    }, {
      id: "action:opposite", executionRegionId: region,
      surface: "tag", action: "release", key: "player:ready",
      precision: "exact", source: src(5),
      lexicalGuards: [guard("false", 3)],
    }, {
      id: "action:lookalike", executionRegionId: region,
      surface: "tag", action: "release", key: "player:lookalike",
      precision: "exact", source: src(6),
      lexicalGuards: [guard("true", 6)],
    }, {
      id: "action:missing-position", executionRegionId: region,
      surface: "tag", action: "release", key: "player:unknown",
      precision: "exact", source: {
        artifactId: "map:a", relativePath: "scripts/round.js",
      },
    }, {
      id: "action:other-region", executionRegionId: "exec:other",
      surface: "tag", action: "release", key: "player:foreign",
      precision: "exact", source: src(7),
    }];
    const output = reconcileSourceResourceOutcomes({
      ...fixture,
      execution: { ...fixture.execution, outcomes: [{
        id: "outcome:nested", executionRegionId: region,
        propertyName: "action", value: "start", source: src(10),
        lexicalGuards: [guard("true", 3), guard("true", 8)],
      }, {
        id: "outcome:post-exit", executionRegionId: region,
        propertyName: "action", value: "retry", source: src(11),
        lexicalGuards: [guard("true", 3)],
        precedenceGuards: [guard("false", 9)],
      }, {
        id: "outcome:foreign", executionRegionId: "exec:foreign",
        propertyName: "action", value: "unknown", source: src(11),
      }] },
      state: { ...fixture.state, resourceActions: actions },
    });
    const nested = output.find(item => item.outcomeId === "outcome:nested");
    expect(nested?.precedingResourceActionIds)
      .toEqual(["action:outer", "action:unguarded"]);
    expect(nested?.precedingReleaseActionIds)
      .toEqual(["action:outer", "action:unguarded"]);
    expect(nested?.status).toBe("SOURCE_ORDER_CANDIDATE");
    const post = output.find(item => item.outcomeId === "outcome:post-exit");
    expect(post?.precedingResourceActionIds).toEqual([]);
    expect(post?.status).toBe("UNRESOLVED");
    expect(output.some(item => item.outcomeId === "outcome:foreign")).toBe(false);
  });
});


describe("source-only behavior shapes across unlike code styles", () => {
  it("recognizes typed structural analogs but abstains on missing or different source evidence", () => {
    const source = (
      entryKind: SourceBehaviorShapeInput["entryKind"],
      stepId: string,
      effectKind: "block-mutation" | "entity-spawn",
    ): SourceBehaviorShapeInput => ({
      sourceTraceStatus: "SOURCE_ROOT_TRACE",
      entryKind,
      steps: [
        { kind: "state", operation: "write",
          authoredWriteValueSyntax: "number:literal" },
        { kind: "world-effect" },
        { kind: "return" },
      ],
      effects: [{
        effectKind: "world-effect",
        worldEffectKind: effectKind,
        evidenceStatus: "CANDIDATE_INGRESS",
        guardStateReadIds: ["guard:" + stepId],
        sourceLocalStateValueHandoffs: [{
          origin: "SOURCE_LOCAL", scalarKind: "number",
        }],
        candidateOutcomeIds: ["return:" + stepId],
        temporalBoundaryCount: 0,
      }],
      omittedSteps: 0, omittedEffects: 0,
      unresolvedSourceEdges: 0,
    });
    // Source operation names, identifiers and entry syntax are deliberately
    // different: neither profile claims that the game designs are equal.
    const scripted = describeSourceBehaviorShape(source(
      "script-function", "prepareArena", "block-mutation"));
    const command = describeSourceBehaviorShape(source(
      "mcfunction", "f_6", "block-mutation"));
    const differentEffect = describeSourceBehaviorShape(source(
      "script-callback", "change", "entity-spawn"));
    expect(scripted.status).toBe("STRUCTURAL_CANDIDATE");
    expect(scripted.proofBoundary)
      .toBe("SOURCE_STRUCTURE_NOT_GAMEPLAY_EQUIVALENCE_OR_RUNTIME");
    const sameShape = compareSourceBehaviorShapes(scripted, command);
    expect(sameShape.disposition).toBe("STRUCTURAL_ANALOG_CANDIDATE");
    expect(sameShape.entryKindsDiffer).toBe(true);
    expect(compareSourceBehaviorShapes(scripted, differentEffect).disposition)
      .toBe("OBSERVED_STRUCTURE_DIFFERS");
    const incomplete = describeSourceBehaviorShape({
      ...source("script-callback", "partial", "block-mutation"),
      omittedEffects: 1,
    });
    expect(incomplete.status).toBe("INSUFFICIENT_SOURCE");
    expect(compareSourceBehaviorShapes(scripted, incomplete).disposition)
      .toBe("INSUFFICIENT_SOURCE");
    const disconnected = describeSourceBehaviorShape({
      ...source("script-function", "orphan", "block-mutation"),
      sourceTraceStatus: "DISCONNECTED_SOURCE_REGION",
    });
    expect(compareSourceBehaviorShapes(command, disconnected).disposition)
      .toBe("INSUFFICIENT_SOURCE");
    const genericOnly = describeSourceBehaviorShape({
      ...source("script-function", "generic", "block-mutation"),
      effects: [{
        ...source("script-function", "generic", "block-mutation").effects[0]!,
        guardStateReadIds: [],
        sourceLocalStateValueHandoffs: [],
        candidateOutcomeIds: [],
      }],
    });
    expect(genericOnly.status).toBe("INSUFFICIENT_SOURCE");

    const form = (rhs: "boolean:literal-false" | "boolean:literal-true" |
      "boolean:logical-expression") => describeSourceBehaviorShape({
      ...source("script-function", "variant", "block-mutation"),
      steps: [
        { kind: "state", operation: "write",
          authoredWriteValueSyntax: rhs },
        { kind: "world-effect" }, { kind: "return" },
      ],
    });
    // The same write KIND with different source syntax is not one shape.
    expect(compareSourceBehaviorShapes(
      form("boolean:literal-false"), form("boolean:literal-true")
    ).disposition).toBe("OBSERVED_STRUCTURE_DIFFERS");
    expect(compareSourceBehaviorShapes(
      form("boolean:logical-expression"), form("boolean:literal-false")
    ).disposition).toBe("OBSERVED_STRUCTURE_DIFFERS");
    const unknownWrite = describeSourceBehaviorShape({
      ...source("script-function", "unknown", "block-mutation"),
      steps: [{ kind: "state", operation: "write" }],
    });
    expect(unknownWrite.status).toBe("INSUFFICIENT_SOURCE");
    expect(compareSourceBehaviorShapes(
      form("boolean:literal-false"), unknownWrite
    ).disposition).toBe("INSUFFICIENT_SOURCE");
    const repeated = describeSourceBehaviorShape({
      ...source("script-function", "repeat", "block-mutation"),
      steps: [
        { kind: "state", operation: "write",
          authoredWriteValueSyntax: "boolean:literal-false" },
        { kind: "state", operation: "write",
          authoredWriteValueSyntax: "boolean:literal-false" },
        { kind: "world-effect" }, { kind: "return" },
      ],
    });
    expect(compareSourceBehaviorShapes(
      form("boolean:literal-false"), repeated
    ).disposition).toBe("OBSERVED_STRUCTURE_DIFFERS");
  });
});
