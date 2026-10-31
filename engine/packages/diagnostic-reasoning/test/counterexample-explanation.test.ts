import { describe, expect, it } from "vitest";
import {
  behaviorStateKey,
  type BehavioralWorldModel,
  type BehaviorPredicate,
  type BehaviorState,
} from "../../behavior-model/src/index.js";
import type {
  SolverQuery,
  SolverTraceStep,
} from "../../logic-solver/src/index.js";
import {
  explainInvariantCounterexample,
} from "../src/index.js";

const active: BehaviorPredicate = {
  kind: "condition",
  condition: {
    variableId: "arena.state",
    scopeKey: "arena:1",
    operator: "eq",
    value: "active",
  },
};

const query: SolverQuery = {
  id: "active-needs-member",
  kind: "invariant",
  predicate: {
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
  },
};

const idle: BehaviorState = {
  schemaVersion: 1,
  tick: 0,
  values: {
    [behaviorStateKey("arena.state", "arena:1")]: "idle",
    [behaviorStateKey("arena.members", "arena:1")]: 0,
  },
};

const activeState: BehaviorState = {
  schemaVersion: 1,
  tick: 1,
  values: {
    [behaviorStateKey("arena.state", "arena:1")]: "active",
    [behaviorStateKey("arena.members", "arena:1")]: 1,
  },
};

const broken: BehaviorState = {
  schemaVersion: 1,
  tick: 2,
  values: {
    [behaviorStateKey("arena.state", "arena:1")]: "active",
    [behaviorStateKey("arena.members", "arena:1")]: 0,
  },
};

const model: BehavioralWorldModel = {
  schemaVersion: 1,
  id: "explain",
  variables: [],
  properties: [],
  transitions: [
    {
      id: "join",
      owner: "player",
      preconditions: [],
      effects: [],
    },
    {
      id: "bad-cleanup",
      owner: "script",
      preconditions: [],
      effects: [],
    },
  ],
};

const trace: readonly SolverTraceStep[] = [
  { depth: 0, state: idle },
  {
    depth: 1,
    state: activeState,
    viaTransitionId: "join",
  },
  {
    depth: 2,
    state: broken,
    viaTransitionId: "bad-cleanup",
  },
];

describe("counterexample causal explanation", () => {
  it("binds the first violating transition to directly conflicting state keys", () => {
    const explanation = explainInvariantCounterexample(
      model,
      query,
      trace,
    );

    expect(explanation.transitionId).toBe("bad-cleanup");
    expect(explanation.transitionOwner).toBe("script");
    expect(explanation.strength).toBe(
      "direct-state-contradiction",
    );
    expect(explanation.directConflictStateKeys).toEqual([
      behaviorStateKey("arena.members", "arena:1"),
    ]);
  });
});
