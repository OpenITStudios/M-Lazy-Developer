// Consolidated same-owner, same-feature, same-lane test family.
// Original cases/assertions preserved; this is NOT executed test proof.
import { describe, expect, it } from "vitest";
import { type DiagnosticProbeDefinition, type RuntimeEvidenceRecord } from "../../../project-model/src/index.js";
import { bindDiagnosticProbeToRuntime } from "../../src/diagnosis/diagnostic-runtime-binding.js";
import { type CompiledDiagnosticInvariant } from "../../../knowledge/src/index.js";
import { materializeInvariantRuntimePlan } from "../../src/diagnosis/invariant-runtime-plan.js";
import { assessRuntimeEvidenceIntegrity } from "../../src/diagnosis/runtime-evidence-integrity.js";
import { assessRuntimeGenerationIntegrity } from "../../src/diagnosis/runtime-generation-integrity.js";
import { assessRuntimeTemporalRequirement } from "../../src/diagnosis/runtime-temporal-analysis.js";

// Original suite: engine/packages/orchestrator/test/diagnosis/diagnostic-runtime-binding.test.ts (Git blob e82e9157aada3aa7606a5393a90a837d245c3d35)
{


const probe: DiagnosticProbeDefinition = {
  id: "chunk-ready",
  label: "chunk readiness",
  requiredContext: "LIVE_MINECRAFT",
  costUnits: 1,
  mutationRisk: "read-only",
  outcomes: [
    { id: "ready", observation: "chunk ready" },
    { id: "not-ready", observation: "chunk not ready" },
  ],
};

describe("diagnostic runtime binding", () => {
  it("binds an abstract diagnostic probe to a concrete runtime query", () => {
    expect(bindDiagnosticProbeToRuntime(probe, {
      probeId: "chunk-ready",
      predicate: "target-chunk-loaded",
      query: {
        kind: "chunk-loaded",
        dimension: "overworld",
        location: { x: 32, y: 64, z: 48 },
      },
      outcomeByState: {
        present: "ready",
        absent: "not-ready",
      },
    })).toEqual(expect.objectContaining({
      probeId: "chunk-ready",
      predicate: "target-chunk-loaded",
      outcomeByState: {
        present: "ready",
        absent: "not-ready",
      },
    }));
  });

  it("rejects a binding for a different probe", () => {
    expect(() => bindDiagnosticProbeToRuntime(probe, {
      probeId: "route-ready",
      predicate: "route-revalidation",
      query: {
        kind: "tag-present",
        subjectKind: "entity",
        subjectId: "e1",
        tag: "route:ready",
      },
      outcomeByState: {
        present: "ready",
        absent: "not-ready",
      },
    })).toThrow(/binding targets/);
  });

  it("rejects runtime state mappings to undeclared diagnostic outcomes", () => {
    expect(() => bindDiagnosticProbeToRuntime(probe, {
      probeId: "chunk-ready",
      predicate: "target-chunk-loaded",
      query: {
        kind: "chunk-loaded",
        dimension: "overworld",
        location: { x: 0, y: 64, z: 0 },
      },
      outcomeByState: {
        present: "invented",
        absent: "not-ready",
      },
    })).toThrow(/undeclared outcome/);
  });
});
}

// Original suite: engine/packages/orchestrator/test/diagnosis/invariant-runtime-plan.test.ts (Git blob 24aca06b150c689fd94f22850e77018ff36be761)
{


function invariant(
  id: string,
  kind: CompiledDiagnosticInvariant["invariantKind"],
  classification: CompiledDiagnosticInvariant["classification"] = "project-policy",
): CompiledDiagnosticInvariant {
  return {
    id,
    relationId: id,
    relationKind: kind === "temporal-order" ? "queues-behind" : "requires",
    invariantKind: kind,
    domain: "validation",
    subject: "after",
    object: "before",
    ...(kind === "temporal-order"
      ? {
          beforePredicate: "before",
          afterPredicate: "after",
        }
      : { expectedObjectState: "present" }),
    classification,
    knowledgeSourceIds: ["source"],
  };
}

describe("compiled invariant runtime plan", () => {
  it("materializes temporal invariants without duplicating state evaluation", () => {
    const plan = materializeInvariantRuntimePlan([
      invariant("state", "requires-state"),
      invariant("temporal", "temporal-order"),
    ], { arenaId: "arena-1", arenaGeneration: 2 });

    expect(plan.stateInvariantIds).toEqual(["state"]);
    expect(plan.temporalRequirements).toEqual([
      expect.objectContaining({
        id: "temporal",
        beforePredicate: "before",
        afterPredicate: "after",
        scope: { arenaId: "arena-1", arenaGeneration: 2 },
      }),
    ]);
  });

  it("keeps open assumptions diagnostic-only", () => {
    const plan = materializeInvariantRuntimePlan([
      invariant("assumption", "temporal-order", "open-assumption"),
    ]);

    expect(plan.temporalRequirements).toEqual([]);
    expect(plan.diagnosticOnlyInvariantIds).toEqual(["assumption"]);
  });
});
}

// Original suite: engine/packages/orchestrator/test/diagnosis/runtime-evidence-integrity.test.ts (Git blob 8733b7da7cac83feaf882f6c8fbbc1510e79ed7b)
{


const observed: RuntimeEvidenceRecord = {
  predicate: "route-ready",
  state: "present",
  confidence: "observed",
  observedAt: { streamId: "s1", sequence: 1, tick: 10 },
};

describe("runtime evidence integrity", () => {
  it("fails closed when no observed runtime evidence exists", async () => {
    const { assessRuntimeEvidenceSetIntegrity } = await import(
      "../../src/diagnosis/runtime-evidence-integrity.js"
    );
    const report = assessRuntimeEvidenceSetIntegrity([]);

    expect(report.safeForCurrentStateClaims).toBe(false);
    expect(report.safeForTemporalViolationClaims).toBe(false);
    expect(report.reasons.join(" ")).toMatch(/insufficient/i);
  });

  it("allows current-state and temporal claims for clean continuous evidence", () => {
    const report = assessRuntimeEvidenceIntegrity(
      [observed],
      {
        map: {},
        conflicts: [],
        resolvedConflicts: [],
        sourceRefs: [],
        relatedNodeIds: [],
      },
      {
        events: 1,
        sequencedEvents: 1,
        unsequencedEvents: 0,
        unidentifiedStreamEvents: 0,
        streams: [],
        missingSequences: 0,
        duplicateSequences: 0,
        nonMonotonicTransitions: 0,
        droppedEvents: 0,
        incomplete: false,
      },
    );

    expect(report.safeForCurrentStateClaims).toBe(true);
    expect(report.safeForTemporalViolationClaims).toBe(true);
  });

  it("blocks current-state claims when conflicts remain unresolved", () => {
    const report = assessRuntimeEvidenceIntegrity(
      [observed],
      {
        map: {},
        conflicts: ["route-ready"],
        resolvedConflicts: [],
        sourceRefs: [],
        relatedNodeIds: [],
      },
    );

    expect(report.safeForCurrentStateClaims).toBe(false);
    expect(report.safeForTemporalViolationClaims).toBe(false);
  });

  it("allows current-state claims but blocks temporal absence claims when continuity is incomplete", () => {
    const report = assessRuntimeEvidenceIntegrity(
      [observed],
      {
        map: {},
        conflicts: [],
        resolvedConflicts: [],
        sourceRefs: [],
        relatedNodeIds: [],
      },
      {
        events: 2,
        sequencedEvents: 2,
        unsequencedEvents: 0,
        unidentifiedStreamEvents: 0,
        streams: [],
        missingSequences: 1,
        duplicateSequences: 0,
        nonMonotonicTransitions: 0,
        droppedEvents: 0,
        incomplete: true,
      },
    );

    expect(report.safeForCurrentStateClaims).toBe(true);
    expect(report.safeForTemporalViolationClaims).toBe(false);
  });

  it("blocks temporal claims for observed records without observation points", () => {
    const report = assessRuntimeEvidenceIntegrity(
      [{
        predicate: observed.predicate,
        state: observed.state,
        confidence: observed.confidence,
      }],
      {
        map: {},
        conflicts: [],
        resolvedConflicts: [],
        sourceRefs: [],
        relatedNodeIds: [],
      },
    );

    expect(report.unlocatedObservedRecords).toBe(1);
    expect(report.safeForTemporalViolationClaims).toBe(false);
  });
  it("rejects unbound observations when an exact target profile is required", () => {
    const report = assessRuntimeEvidenceIntegrity(
      [observed],
      {
        map: {},
        conflicts: [],
        resolvedConflicts: [],
        sourceRefs: [],
        relatedNodeIds: [],
      },
      undefined,
      {
        expectedTargetProfileFingerprint: "target-profile-a",
      },
    );

    expect(report.safeForCurrentStateClaims).toBe(false);
    expect(report.targetProfileUnboundRecords).toBe(1);
  });

  it("aggregates integrity per scope without cross-scope false conflicts", async () => {
    const { assessRuntimeEvidenceSetIntegrity } = await import(
      "../../src/diagnosis/runtime-evidence-integrity.js"
    );

    const report = assessRuntimeEvidenceSetIntegrity([
      {
        predicate: "route-ready",
        state: "present",
        confidence: "observed",
        scope: { operationId: "op-a" },
        observedAt: { tick: 10 },
      },
      {
        predicate: "route-ready",
        state: "absent",
        confidence: "observed",
        scope: { operationId: "op-b" },
        observedAt: { tick: 10 },
      },
    ]);

    expect(report.unresolvedConflictPredicates).toEqual([]);
    expect(report.safeForCurrentStateClaims).toBe(true);
    expect(report.safeForTemporalViolationClaims).toBe(true);
  });
});
}

// Original suite: engine/packages/orchestrator/test/diagnosis/runtime-generation-integrity.test.ts (Git blob d141defd997bba3b8947fd1882d24def9640127c)
{

describe("runtime generation integrity",()=>{it("rejects stale generations without timestamp heuristics",()=>{const exchange:any={response:{evidence:{scope:{arenaId:"a",arenaGeneration:1,bootGeneration:2}}}};expect(assessRuntimeGenerationIntegrity(exchange,{arenaId:"a",arenaGeneration:2,bootGeneration:2})).toEqual({status:"STALE",staleKeys:["arenaGeneration"]});expect(assessRuntimeGenerationIntegrity(exchange,{arenaId:"a",arenaGeneration:1,bootGeneration:2}).status).toBe("CURRENT");});});
}

// Original suite: engine/packages/orchestrator/test/diagnosis/runtime-temporal-analysis.test.ts (Git blob e716c023b8e73209ff05cbf63e764ad2579019af)
{


function record(
  predicate: string,
  sequence: number,
): RuntimeEvidenceRecord {
  return {
    predicate,
    state: "present",
    confidence: "observed",
    scope: { arenaId: "arena-1", arenaGeneration: 2 },
    observedAt: {
      streamId: "stream-1",
      sequence,
      tick: sequence,
    },
  };
}

const requirement = {
  id: "mutation-before-dependent",
  beforePredicate: "mutation-verification-passed",
  afterPredicate: "dependent-action-observed",
  scope: { arenaId: "arena-1", arenaGeneration: 2 },
};

describe("runtime temporal analysis", () => {
  it("proves order when comparable observations satisfy the requirement", () => {
    expect(assessRuntimeTemporalRequirement(
      [
        record("mutation-verification-passed", 10),
        record("dependent-action-observed", 11),
      ],
      requirement,
      true,
    ).status).toBe("satisfied");
  });

  it("enforces minimum tick separation when the temporal contract requires a later tick", () => {
    const strict = {
      ...requirement,
      minTickDelta: 1,
    };

    expect(assessRuntimeTemporalRequirement(
      [
        {
          ...record("mutation-verification-passed", 10),
          observedAt: {
            streamId: "stream-1",
            sequence: 10,
            tick: 20,
          },
        },
        {
          ...record("dependent-action-observed", 11),
          observedAt: {
            streamId: "stream-1",
            sequence: 11,
            tick: 20,
          },
        },
      ],
      strict,
      true,
    ).status).not.toBe("satisfied");

    expect(assessRuntimeTemporalRequirement(
      [
        {
          ...record("mutation-verification-passed", 10),
          observedAt: {
            streamId: "stream-1",
            sequence: 10,
            tick: 20,
          },
        },
        {
          ...record("dependent-action-observed", 11),
          observedAt: {
            streamId: "stream-1",
            sequence: 11,
            tick: 21,
          },
        },
      ],
      strict,
      true,
    ).status).toBe("satisfied");
  });

  it("detects reversed ordering on a complete stream", () => {
    expect(assessRuntimeTemporalRequirement(
      [
        record("dependent-action-observed", 10),
        record("mutation-verification-passed", 11),
      ],
      requirement,
      true,
    ).status).toBe("violated-order");
  });

  it("does not convert missing evidence into a violation on incomplete telemetry", () => {
    expect(assessRuntimeTemporalRequirement(
      [record("dependent-action-observed", 10)],
      requirement,
      false,
    ).status).toBe("evidence-incomplete");
  });

  it("can prove missing prerequisite only when continuity is complete", () => {
    expect(assessRuntimeTemporalRequirement(
      [record("dependent-action-observed", 10)],
      requirement,
      true,
    ).status).toBe("missing-before");
  });

  it("keeps cross-stream ordering unresolved without a shared tick", () => {
    const before = record("mutation-verification-passed", 10);
    const after = record("dependent-action-observed", 11);
    before.observedAt = { streamId: "stream-a", sequence: 10 };
    after.observedAt = { streamId: "stream-b", sequence: 11 };

    expect(assessRuntimeTemporalRequirement(
      [before, after],
      requirement,
      true,
    ).status).toBe("unresolved-order");
  });
});
}
