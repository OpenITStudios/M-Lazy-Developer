import { describe, expect, it } from "vitest";
import {
  behaviorStateKey,
  type BehavioralWorldModel,
  type BehaviorState,
} from "../../../behavior-model/src/index.js";
import type {
  SolverQuery,
} from "../../../logic-solver/src/index.js";
import {
  compileCounterexampleScenario,
  counterexampleScenarioText,
} from "../../src/index.js";

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
  id: "scenario-model",
  variables: [],
  properties: [],
  transitions: [
    {
      id: "join",
      owner: "player",
      description: "Join Arena 1.",
      preconditions: [],
      effects: [
        {
          kind: "set",
          variableId: "arena.state",
          scopeKey: "arena:1",
          value: "active",
        },
        {
          kind: "set",
          variableId: "arena.members",
          scopeKey: "arena:1",
          value: 1,
        },
      ],
    },
    {
      id: "bad-cleanup",
      owner: "script",
      description: "Run cleanup.",
      preconditions: [],
      effects: [{
        kind: "set",
        variableId: "arena.members",
        scopeKey: "arena:1",
        value: 0,
      }],
    },
  ],
};

const query: SolverQuery = {
  id: "active-needs-member",
  kind: "invariant",
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
};

describe("counterexample scenario compiler", () => {
  it("always produces a deterministic model-replay QA scenario", () => {
    const scenario = compileCounterexampleScenario({
      id: "membership-repro",
      model,
      initialState: initial,
      query,
      transitionIds: ["join", "bad-cleanup"],
    });

    expect(scenario.runtimeStatus).toBe(
      "runtime-unbound",
    );
    expect(scenario.steps.map((step) => step.transitionId)).toEqual([
      "join",
      "bad-cleanup",
    ]);
    expect(
      counterexampleScenarioText(scenario),
    ).toContain("1. Join Arena 1.");
    expect(
      scenario.replayTrace.at(-1)?.viaTransitionId,
    ).toBe("bad-cleanup");
  });

  it("emits a runtime protocol only when every stimulus and assertion has an explicit binding", () => {
    const scenario = compileCounterexampleScenario({
      id: "membership-runtime-repro",
      model,
      initialState: initial,
      query,
      transitionIds: ["join", "bad-cleanup"],
      transitionBindings: [
        {
          transitionId: "join",
          actionId: "test.join-arena",
          parameters: { arenaId: "1" },
        },
        {
          transitionId: "bad-cleanup",
          actionId: "test.cleanup-arena",
          parameters: { arenaId: "1" },
        },
      ],
      assertionBinding: {
        actionId: "probe.scoreboard-value",
        parameters: {
          objectiveId: "arena_members",
          participant: "arena:1",
          expected: 0,
          predicate: "active-needs-member",
        },
      },
    });

    expect(scenario.runtimeStatus).toBe(
      "runtime-bound",
    );
    expect(scenario.runtimeProtocol?.map((step) => step.actionId)).toEqual([
      "test.join-arena",
      "test.cleanup-arena",
      "probe.scoreboard-value",
    ]);
  });

  it("rejects a transition sequence that no longer reproduces the invariant violation", () => {
    expect(() =>
      compileCounterexampleScenario({
        id: "invalid-repro",
        model,
        initialState: initial,
        query,
        transitionIds: ["join"],
      })
    ).toThrow(/does not reproduce/);
  });
});
