// Bounded owner-local source test family; original assertions retained.
import { describe, expect, it } from "vitest";
import { behaviorStateKey, type BehavioralWorldModel, type BehaviorState, type BehaviorPredicate } from "../../behavior-model/src/index.js";
import { compileAndSolveBehaviorConstraints, compileBehaviorConstraints, boundedBehaviorSolver, solveTemporalProperty } from "../src/index.js";

// Original source suite: engine/packages/logic-solver/test/compiler.test.ts (Git blob d10b7d48420d9cd2ae742bc4a14123ea9d99360d)
{


const initial: BehaviorState = {
  schemaVersion: 1,
  tick: 0,
  values: {
    [behaviorStateKey("arena.state", "arena:1")]: "idle",
    [behaviorStateKey("arena.members", "arena:1")]: 0,
  },
};

const model: BehavioralWorldModel = {
  schemaVersion: 1,
  id: "compiler-test",
  variables: [],
  transitions: [
    {
      id: "join",
      owner: "player",
      preconditions: [{
        kind: "condition",
        condition: {
          variableId: "arena.state",
          scopeKey: "arena:1",
          operator: "eq",
          value: "idle",
        },
      }],
      effects: [
        {
          kind: "set",
          variableId: "arena.members",
          scopeKey: "arena:1",
          value: 1,
        },
        {
          kind: "set",
          variableId: "arena.state",
          scopeKey: "arena:1",
          value: "active",
        },
      ],
    },
    {
      id: "impossible-start",
      owner: "script",
      preconditions: [{
        kind: "condition",
        condition: {
          variableId: "arena.members",
          scopeKey: "arena:1",
          operator: "gt",
          value: 5,
        },
      }],
      effects: [{
        kind: "set",
        variableId: "arena.state",
        scopeKey: "arena:1",
        value: "active",
      }],
    },
  ],
  properties: [
    {
      id: "active-needs-membership",
      kind: "always",
      predicate: {
        kind: "implies",
        if: {
          kind: "condition",
          condition: {
            variableId: "arena.state",
            scopeKey: "arena:1",
            operator: "eq",
            value: "active",
          },
        },
        then: {
          kind: "condition",
          condition: {
            variableId: "arena.members",
            scopeKey: "arena:1",
            operator: "gt",
            value: 0,
          },
        },
      },
    },
    {
      id: "eventually-idle",
      kind: "eventually",
      predicate: {
        kind: "condition",
        condition: {
          variableId: "arena.state",
          scopeKey: "arena:1",
          operator: "eq",
          value: "idle",
        },
      },
    },
  ],
};

describe("constraint compiler", () => {
  it("compiles always-properties and transition enablement without semantic name guessing", () => {
    const compilation = compileBehaviorConstraints(
      model,
      initial,
      { maxDepth: 4, maxStates: 32 },
    );

    expect(
      compilation.constraints.map((item) => item.id),
    ).toEqual([
      "property:active-needs-membership",
      "transition-enabled:join",
      "transition-enabled:impossible-start",
    ]);
    expect(compilation.unsupported).toEqual([]);
  });

  it("solves the compiled invariant and transition reachability batch", () => {
    const batch = compileAndSolveBehaviorConstraints(
      model,
      initial,
      { maxDepth: 4, maxStates: 32 },
    );

    const byId = new Map(
      batch.results.map((item) => [
        item.constraint.id,
        item.result,
      ]),
    );

    expect(
      byId.get("property:active-needs-membership")?.disposition,
    ).toBe("proved");
    expect(
      byId.get("transition-enabled:join")?.disposition,
    ).toBe("proved");
    expect(
      byId.get("transition-enabled:impossible-start")?.disposition,
    ).toBe("disproved");
    expect(batch.temporalResults).toEqual([
      expect.objectContaining({
        propertyId: "eventually-idle",
        disposition: "proved",
      }),
    ]);
  });
});
}

// Original source suite: engine/packages/logic-solver/test/solver.test.ts (Git blob 896f842901a0a3d762966376e45251b01e7a49de)
{


const active: BehaviorPredicate = {
  kind: "condition",
  condition: {
    variableId: "arena.state",
    scopeKey: "arena:1",
    operator: "eq",
    value: "active",
  },
};

const safeMembership: BehaviorPredicate = {
  kind: "implies",
  if: active,
  then: {
    kind: "condition",
    condition: {
      variableId: "arena.members",
      scopeKey: "arena:1",
      operator: "gt",
      value: 0,
    },
  },
};

const initial: BehaviorState = {
  schemaVersion: 1,
  tick: 0,
  values: {
    [behaviorStateKey("arena.state", "arena:1")]: "idle",
    [behaviorStateKey("arena.members", "arena:1")]: 0,
  },
};

const model: BehavioralWorldModel = {
  schemaVersion: 1,
  id: "solver-test",
  variables: [],
  properties: [],
  transitions: [
    {
      id: "join",
      owner: "player",
      preconditions: [{
        kind: "condition",
        condition: {
          variableId: "arena.state",
          scopeKey: "arena:1",
          operator: "eq",
          value: "idle",
        },
      }],
      effects: [
        {
          kind: "set",
          variableId: "arena.members",
          scopeKey: "arena:1",
          value: 1,
        },
        {
          kind: "set",
          variableId: "arena.state",
          scopeKey: "arena:1",
          value: "active",
        },
      ],
    },
    {
      id: "bad-cleanup",
      owner: "script",
      preconditions: [active],
      effects: [{
        kind: "set",
        variableId: "arena.members",
        scopeKey: "arena:1",
        value: 0,
      }],
    },
  ],
};

describe("bounded behavior solver", () => {
  it("returns the shortest reachability witness", () => {
    const result = boundedBehaviorSolver.solve({
      id: "reach-active",
      model,
      initialState: initial,
      query: {
        id: "active-reachable",
        kind: "reachability",
        target: active,
      },
      budget: { maxDepth: 4, maxStates: 32 },
    });

    expect(result.disposition).toBe("proved");
    expect(result.proof.transitionIds).toEqual(["join"]);
    expect(result.trace?.length).toBe(2);
  });

  it("returns the shortest invariant counterexample", () => {
    const result = boundedBehaviorSolver.solve({
      id: "membership-invariant",
      model,
      initialState: initial,
      query: {
        id: "active-needs-membership",
        kind: "invariant",
        predicate: safeMembership,
      },
      budget: { maxDepth: 4, maxStates: 32 },
    });

    expect(result.disposition).toBe("disproved");
    expect(result.proof.transitionIds).toEqual([
      "join",
      "bad-cleanup",
    ]);
  });

  it("returns unknown rather than claiming safety when depth truncates search", () => {
    const result = boundedBehaviorSolver.solve({
      id: "truncated",
      model,
      initialState: initial,
      query: {
        id: "never-bad",
        kind: "invariant",
        predicate: safeMembership,
      },
      budget: { maxDepth: 1, maxStates: 32 },
    });

    expect(result.disposition).toBe("unknown");
    expect(result.proof.completeExploration).toBe(false);
  });

  it("proves an invariant only after exhaustive semantic-state exploration", () => {
    const safeModel: BehavioralWorldModel = {
      ...model,
      transitions: [model.transitions[0]!],
    };
    const result = boundedBehaviorSolver.solve({
      id: "exhaustive",
      model: safeModel,
      initialState: initial,
      query: {
        id: "active-needs-membership",
        kind: "invariant",
        predicate: safeMembership,
      },
      budget: { maxDepth: 4, maxStates: 32 },
    });

    expect(result.disposition).toBe("proved");
    expect(result.proof.completeExploration).toBe(true);
  });
});
}

// Original source suite: engine/packages/logic-solver/test/temporal-solver.test.ts (Git blob bb9a522333b220a3ee7e4ab2340e6f6454b78326)
{


const initial: BehaviorState = {
  schemaVersion: 1,
  tick: 0,
  values: {
    phase: "idle",
    cleanup: false,
  },
};

function model(
  transitions: BehavioralWorldModel["transitions"],
): BehavioralWorldModel {
  return {
    schemaVersion: 1,
    id: "temporal-test",
    variables: [],
    transitions,
    properties: [],
  };
}

const eventuallyCleanup = {
  id: "eventually-cleanup",
  kind: "eventually" as const,
  predicate: {
    kind: "condition" as const,
    condition: {
      variableId: "cleanup",
      operator: "eq" as const,
      value: true,
    },
  },
};

describe("temporal solver", () => {
  it("proves EVENTUALLY when every path reaches the target", () => {
    const result = solveTemporalProperty(
      model([{
        id: "cleanup",
        owner: "script",
        preconditions: [],
        effects: [{
          kind: "set",
          variableId: "cleanup",
          value: true,
        }],
      }]),
      initial,
      eventuallyCleanup,
      { maxDepth: 4, maxStates: 32 },
    );

    expect(result.disposition).toBe("proved");
    expect(result.proof.completeExploration).toBe(true);
  });

  it("finds a lasso counterexample for EVENTUALLY", () => {
    const result = solveTemporalProperty(
      model([{
        id: "spin",
        owner: "script",
        preconditions: [],
        effects: [{
          kind: "set",
          variableId: "phase",
          value: "idle",
        }],
      }]),
      initial,
      eventuallyCleanup,
      { maxDepth: 4, maxStates: 32 },
    );

    expect(result.disposition).toBe("disproved");
    expect(result.trace?.at(-1)?.viaTransitionId).toBe("spin");
  });

  it("disproves UNTIL when hold fails first", () => {
    const result = solveTemporalProperty(
      model([{
        id: "break-hold",
        owner: "script",
        preconditions: [],
        effects: [{
          kind: "set",
          variableId: "phase",
          value: "broken",
        }],
      }]),
      initial,
      {
        id: "idle-until-cleanup",
        kind: "until",
        hold: {
          kind: "condition",
          condition: {
            variableId: "phase",
            operator: "eq",
            value: "idle",
          },
        },
        until: eventuallyCleanup.predicate,
      },
      { maxDepth: 4, maxStates: 32 },
    );

    expect(result.disposition).toBe("disproved");
  });

  it("proves LEADS-TO on exhausted acyclic paths", () => {
    const lifecycle = model([
      {
        id: "finish",
        owner: "script",
        preconditions: [{
          kind: "condition",
          condition: {
            variableId: "phase",
            operator: "eq",
            value: "idle",
          },
        }],
        effects: [{
          kind: "set",
          variableId: "phase",
          value: "finished",
        }],
      },
      {
        id: "cleanup",
        owner: "script",
        preconditions: [{
          kind: "condition",
          condition: {
            variableId: "phase",
            operator: "eq",
            value: "finished",
          },
        }],
        effects: [{
          kind: "set",
          variableId: "cleanup",
          value: true,
        }],
      },
    ]);

    const result = solveTemporalProperty(
      lifecycle,
      initial,
      {
        id: "finish-leads-cleanup",
        kind: "leads-to",
        trigger: {
          kind: "condition",
          condition: {
            variableId: "phase",
            operator: "eq",
            value: "finished",
          },
        },
        consequence: eventuallyCleanup.predicate,
      },
      { maxDepth: 4, maxStates: 32 },
    );

    expect(result.disposition).toBe("proved");
  });

  it("disproves cyclic LEADS-TO when the obligation stays open", () => {
    const result = solveTemporalProperty(
      model([{
        id: "spin",
        owner: "script",
        preconditions: [],
        effects: [{
          kind: "set",
          variableId: "phase",
          value: "idle",
        }],
      }]),
      initial,
      {
        id: "idle-leads-cleanup",
        kind: "leads-to",
        trigger: {
          kind: "condition",
          condition: {
            variableId: "phase",
            operator: "eq",
            value: "idle",
          },
        },
        consequence: eventuallyCleanup.predicate,
      },
      { maxDepth: 4, maxStates: 32 },
    );

    expect(result.disposition).toBe("disproved");
  });

  it("proves cyclic LEADS-TO when every trigger is discharged before the loop closes", () => {
    const result = solveTemporalProperty(
      model([
        {
          id: "trigger",
          owner: "script",
          preconditions: [{
            kind: "condition",
            condition: {
              variableId: "phase",
              operator: "eq",
              value: "idle",
            },
          }],
          effects: [{
            kind: "set",
            variableId: "phase",
            value: "finished",
          }],
        },
        {
          id: "cleanup",
          owner: "script",
          preconditions: [{
            kind: "condition",
            condition: {
              variableId: "phase",
              operator: "eq",
              value: "finished",
            },
          }],
          effects: [
            {
              kind: "set",
              variableId: "cleanup",
              value: true,
            },
            {
              kind: "set",
              variableId: "phase",
              value: "idle",
            },
          ],
        },
      ]),
      initial,
      {
        id: "finished-leads-cleanup",
        kind: "leads-to",
        trigger: {
          kind: "condition",
          condition: {
            variableId: "phase",
            operator: "eq",
            value: "finished",
          },
        },
        consequence: eventuallyCleanup.predicate,
      },
      { maxDepth: 6, maxStates: 64 },
    );

    expect(result.disposition).toBe("proved");
    expect(result.proof.completeExploration).toBe(true);
  });
});
}
