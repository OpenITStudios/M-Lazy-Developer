// Source-preserving consolidation: original test cases remain in isolated lexical blocks.
import { describe, expect, it } from "vitest";
import { behaviorStateKey } from "../../../behavior-model/src/index.js";
import type { BehavioralWorldModel, BehaviorPredicate, BehaviorState } from "../../../behavior-model/src/index.js";
import type { ConstraintProblem, SolverResult } from "../../../logic-solver/src/index.js";
import { minimizeInvariantCounterexample, minimizeGraphFixture, minimizeSourceLines, minimizeTimedScenario } from "../../src/index.js";

// Consolidated suite from engine/packages/reliability-search/test/minimization/logic-counterexample-minimizer.test.ts
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

const invariant: BehaviorPredicate = {
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
    noise: false,
  },
};

const model: BehavioralWorldModel = {
  schemaVersion: 1,
  id: "minimize-test",
  variables: [],
  properties: [],
  transitions: [
    {
      id: "join",
      owner: "player",
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
      id: "noise",
      owner: "script",
      preconditions: [],
      effects: [{
        kind: "set",
        variableId: "noise",
        value: true,
      }],
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

const problem: ConstraintProblem = {
  id: "problem",
  model,
  initialState: initial,
  query: {
    id: "membership",
    kind: "invariant",
    predicate: invariant,
  },
  budget: { maxDepth: 8, maxStates: 64 },
};

const result: SolverResult = {
  problemId: "problem",
  queryId: "membership",
  disposition: "disproved",
  reason: "fixture",
  proof: {
    completeExploration: false,
    transitionIds: ["join", "noise", "bad-cleanup"],
    exploredStates: 4,
    maxDepthReached: 3,
  },
  trace: [
    { depth: 0, state: initial },
    {
      depth: 1,
      viaTransitionId: "join",
      state: {
        schemaVersion: 1,
        tick: 1,
        values: {
          ...initial.values,
          [behaviorStateKey("arena.state", "arena:1")]: "active",
          [behaviorStateKey("arena.members", "arena:1")]: 1,
        },
      },
    },
    {
      depth: 2,
      viaTransitionId: "noise",
      state: {
        schemaVersion: 1,
        tick: 2,
        values: {
          ...initial.values,
          [behaviorStateKey("arena.state", "arena:1")]: "active",
          [behaviorStateKey("arena.members", "arena:1")]: 1,
          noise: true,
        },
      },
    },
    {
      depth: 3,
      viaTransitionId: "bad-cleanup",
      state: {
        schemaVersion: 1,
        tick: 3,
        values: {
          ...initial.values,
          [behaviorStateKey("arena.state", "arena:1")]: "active",
          [behaviorStateKey("arena.members", "arena:1")]: 0,
          noise: true,
        },
      },
    },
  ],
};

describe("logic counterexample minimizer", () => {
  it("removes irrelevant transitions while preserving the invariant violation", async () => {
    const minimized = await minimizeInvariantCounterexample(
      problem,
      result,
    );

    expect(minimized.transitionIds).toEqual([
      "join",
      "bad-cleanup",
    ]);
    expect(minimized.originalTransitions).toBe(3);
    expect(minimized.minimizedTransitions).toBe(2);
    expect(
      minimized.trace.at(-1)?.viaTransitionId,
    ).toBe("bad-cleanup");
  });
});
}

// Consolidated suite from engine/packages/reliability-search/test/minimization/minimizers.test.ts
{
describe("domain-specific minimizers", () => {
  it("minimizes source text by relevant lines", async () => {
    const source = [
      "noise-a",
      "critical-start",
      "noise-b",
      "critical-end",
      "noise-c",
    ].join("\n");

    const result = await minimizeSourceLines(
      source,
      (candidate) =>
        candidate.includes("critical-start") &&
        candidate.includes("critical-end"),
    );

    expect(result.minimizedText).toContain("critical-start");
    expect(result.minimizedText).toContain("critical-end");
    expect(result.minimizedLines).toBe(2);
  });

  it("minimizes timed scenarios and normalizes unnecessary absolute delay", async () => {
    const actions = [
      { tick: 10, action: { kind: "join" as const, playerId: "p1" } },
      { tick: 11, action: { kind: "start" as const, playerId: "p1" } },
      { tick: 12, action: { kind: "start" as const, playerId: "p2" } },
      { tick: 30, action: { kind: "reset-arena" as const, arenaId: "noise" } },
    ];

    const result = await minimizeTimedScenario(
      actions,
      (candidate) => {
        const kinds = candidate.map((entry) => entry.action.kind);
        return kinds.filter((kind) => kind === "start").length >= 2;
      },
    );

    expect(result.actions).toHaveLength(2);
    expect(result.actions[0]?.tick).toBe(0);
  });

  it("minimizes dependency graph fixtures by irrelevant nodes", async () => {
    const nodes = [
      { id: "root", value: "calls-child" },
      { id: "child", value: "target" },
      { id: "noise", value: "unrelated" },
    ];

    const result = await minimizeGraphFixture(
      nodes,
      (candidate) =>
        candidate.some((node) => node.id === "root") &&
        candidate.some((node) => node.id === "child"),
    );

    expect(result.nodes.map((node) => node.id).sort()).toEqual(["child", "root"]);
  });
});
}
