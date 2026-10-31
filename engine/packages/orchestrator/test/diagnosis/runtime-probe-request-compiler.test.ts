import { describe, expect, it } from "vitest";
import type {
  DiagnosticProbeDefinition,
  DiagnosticProbePlan,
} from "../../../project-model/src/index.js";
import type { RuntimeProbeBinding } from "../../../project-model/src/index.js";
import { compileRuntimeProbeRequests } from "../../src/diagnosis/runtime-probe-request-compiler.js";

const probes: DiagnosticProbeDefinition[] = [{
  id: "chunk-readiness",
  label: "Observe target chunk readiness",
  requiredContext: "LIVE_MINECRAFT",
  costUnits: 1,
  mutationRisk: "read-only",
  outcomes: [{
    id: "ready",
    observation: "ready",
  }, {
    id: "not-ready",
    observation: "not ready",
  }],
}, {
  id: "mutating-reset",
  label: "Reset arena",
  requiredContext: "LIVE_MINECRAFT",
  costUnits: 5,
  mutationRisk: "mutating",
  outcomes: [{
    id: "changed",
    observation: "changed",
  }],
}];

const plan: DiagnosticProbePlan = {
  incidentId: "incident-1",
  availableContext: "LIVE_MINECRAFT",
  unresolvedCandidateIds: ["candidate-1"],
  recommended: [{
    probeId: "chunk-readiness",
    label: "Observe target chunk readiness",
    requiredContext: "LIVE_MINECRAFT",
    costUnits: 1,
    mutationRisk: "read-only",
    coveredCandidateIds: ["candidate-1"],
    pairSeparationCount: 0,
    score: 2,
  }],
  blockedByContext: [],
  stopCondition: "candidate-proven",
};

function binding(
  overrides: Partial<RuntimeProbeBinding> = {},
): RuntimeProbeBinding {
  return {
    probeId: "chunk-readiness",
    predicate: "loaded-target-chunk",
    query: {
      kind: "chunk-loaded",
      dimension: "overworld",
      location: { x: 16, y: 64, z: 16 },
    },
    outcomeByState: {
      present: "ready",
      absent: "not-ready",
    },
    ...overrides,
  };
}

describe("runtime probe request compiler", () => {
  it("compiles an explicit binding into a validated request", () => {
    const result = compileRuntimeProbeRequests(
      plan,
      probes,
      [binding({
        incidentId: "incident-1",
        statePath: "session.phase",
        scope: {
          arenaId: "arena-1",
          arenaGeneration: 4,
          operationId: "load-4",
        },
      })],
      {
        runtimeTick: 100,
      },
    );

    expect(result.issues).toEqual([]);
    expect(result.requests).toEqual([
      expect.objectContaining({
        requestId: "incident-1::chunk-readiness::1",
        probeId: "chunk-readiness",
        predicate: "loaded-target-chunk",
        statePath: "session.phase",
        runtimeTick: 100,
        scope: {
          arenaId: "arena-1",
          arenaGeneration: 4,
          operationId: "load-4",
        },
        query: expect.objectContaining({
          kind: "chunk-loaded",
          dimension: "overworld",
        }),
      }),
    ]);
  });

  it("prefers incident-specific binding over a generic binding", () => {
    const result = compileRuntimeProbeRequests(
      plan,
      probes,
      [
        binding({
          scope: { operationId: "generic" },
        }),
        binding({
          incidentId: "incident-1",
          scope: { operationId: "specific" },
        }),
      ],
    );

    expect(result.issues).toEqual([]);
    expect(result.requests[0]?.scope?.operationId).toBe("specific");
  });

  it("falls back to a generic binding when no incident binding exists", () => {
    const result = compileRuntimeProbeRequests(
      plan,
      probes,
      [binding({ scope: { operationId: "generic" } })],
    );

    expect(result.requests[0]?.scope?.operationId).toBe("generic");
  });

  it("fails closed on conflicting compiler and binding scopes", () => {
    const result = compileRuntimeProbeRequests(
      plan,
      probes,
      [binding({
        incidentId: "incident-1",
        scope: {
          arenaId: "arena-1",
          arenaGeneration: 4,
        },
      })],
      {
        scope: {
          arenaId: "arena-1",
          arenaGeneration: 5,
        },
      },
    );

    expect(result.requests).toEqual([]);
    expect(result.issues).toEqual([
      expect.objectContaining({
        kind: "binding-scope-conflict",
        probeId: "chunk-readiness",
      }),
    ]);
  });

  it("reports missing and ambiguous bindings instead of inventing queries", () => {
    expect(compileRuntimeProbeRequests(
      plan,
      probes,
      [],
    ).issues).toEqual([
      expect.objectContaining({ kind: "missing-binding" }),
    ]);

    expect(compileRuntimeProbeRequests(
      plan,
      probes,
      [
        binding({ incidentId: "incident-1" }),
        binding({ incidentId: "incident-1" }),
      ],
    ).issues).toEqual([
      expect.objectContaining({ kind: "duplicate-binding" }),
    ]);
  });

  it("rejects binding outcome ids not declared by the probe", () => {
    const result = compileRuntimeProbeRequests(
      plan,
      probes,
      [binding({
        outcomeByState: {
          present: "invented",
          absent: "not-ready",
        },
      })],
    );

    expect(result.requests).toEqual([]);
    expect(result.issues[0]?.kind).toBe("binding-outcome-unknown");
  });

  it("does not compile mutating diagnostic probes into read-only runtime requests", () => {
    const mutatingPlan: DiagnosticProbePlan = {
      ...plan,
      recommended: [{
        probeId: "mutating-reset",
        label: "Reset arena",
        requiredContext: "LIVE_MINECRAFT",
        costUnits: 5,
        mutationRisk: "mutating",
        coveredCandidateIds: ["candidate-1"],
        pairSeparationCount: 0,
        score: 1,
      }],
    };

    const result = compileRuntimeProbeRequests(
      mutatingPlan,
      probes,
      [{
        probeId: "mutating-reset",
        predicate: "reset-result",
        query: {
          kind: "scoreboard-value",
          objectiveId: "phase",
          participant: "arena-1",
        },
        outcomeByState: {
          present: "changed",
          absent: "changed",
        },
      }],
    );

    expect(result.requests).toEqual([]);
    expect(result.issues[0]?.kind).toBe("non-read-only-probe");
  });

  it("honors request budget deterministically", () => {
    const twoProbePlan: DiagnosticProbePlan = {
      ...plan,
      recommended: [
        plan.recommended[0]!,
        {
          ...plan.recommended[0]!,
          probeId: "second",
        },
      ],
    };
    const definitions: DiagnosticProbeDefinition[] = [
      ...probes,
      {
        ...probes[0]!,
        id: "second",
      },
    ];

    const result = compileRuntimeProbeRequests(
      twoProbePlan,
      definitions,
      [
        binding(),
        {
          ...binding(),
          probeId: "second",
        },
      ],
      { maxRequests: 1 },
    );

    expect(result.requests).toHaveLength(1);
    expect(result.issues).toEqual([
      expect.objectContaining({
        kind: "request-budget-exceeded",
        probeId: "second",
      }),
    ]);
  });
});
