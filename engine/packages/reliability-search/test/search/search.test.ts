// Family-level source tests, original assertion bodies preserved.
import { describe } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { createSessionBoundedDomain } from "../../src/index.js";
import { exploreBoundedStateSpace } from "../../src/index.js";
import { sessionStateIdentity } from "../../src/index.js";
import { createSessionModel } from "../../../reliability/src/index.js";
import { exploreInterleavings } from "../../src/index.js";
import { operationsHaveGenerationConflict } from "../../src/index.js";
import { type ScheduledOperation } from "../../src/index.js";
import { operationsIndependent } from "../../src/index.js";
import { analyzeMultiplayerInterleavings } from "../../src/search/multiplayer-interleaving.js";
import { multiplayerEventOperation } from "../../src/search/multiplayer-interleaving.js";
import { ddmin } from "../../src/index.js";
import { runCoverageGuidedSearch } from "../../src/index.js";
import { scheduledSessionActions } from "../../src/index.js";
import { sessionCoverageSearchDomain } from "../../src/index.js";
import { sessionSemanticCoverage } from "../../src/index.js";
import { type SessionSearchInput } from "../../src/index.js";

// Original suite engine/packages/reliability-search/test/search/bounded-explorer.test.ts, blob cbe8e82736bb67d28b9c2ffff38d72f5e47ab9b8
{
describe("bounded exhaustive state explorer", () => {
  it("explores unique session states deterministically within explicit bounds", () => {
    const domain = createSessionBoundedDomain({
      playerIds: ["p1", "p2"],
      arenaIds: ["arena1", "arena2"],
      progressAmounts: [1],
    });

    const first = exploreBoundedStateSpace(domain, {
      maxDepth: 4,
      maxStates: 500,
    });
    const second = exploreBoundedStateSpace(domain, {
      maxDepth: 4,
      maxStates: 500,
    });

    expect(first.statesExplored).toBeGreaterThan(1);
    expect(first.uniqueTransitions).toBeGreaterThan(0);
    expect(first.visitedStateIds).toEqual(second.visitedStateIds);
    expect(first.failures).toEqual(second.failures);
  });

  it("canonical state identity ignores insertion order", () => {
    const a = createSessionModel(["arena1", "arena2"]);
    const b = createSessionModel(["arena2", "arena1"]);

    expect(sessionStateIdentity(a)).toBe(sessionStateIdentity(b));
  });

  it("reports truncation when state budget is exhausted", () => {
    const domain = createSessionBoundedDomain({
      playerIds: ["p1", "p2"],
      arenaIds: ["arena1", "arena2"],
    });

    const result = exploreBoundedStateSpace(domain, {
      maxDepth: 8,
      maxStates: 5,
    });

    expect(result.statesExplored).toBe(5);
    expect(result.truncated).toBe(true);
  });
});
}

// Original suite engine/packages/reliability-search/test/search/generation-aware.test.ts, blob 9364325b39ad9f77dfbc21c1ab8dac0f9ca18005
{
function operation(
  id: string,
  generation: number,
  parents?: readonly string[],
): ScheduledOperation<string> {
  return {
    id,
    value: id,
    footprint: {
      reads: [],
      writes: [id + ":state"],
    },
    causal: {
      generationTokens: {
        "scope:p1": generation,
      },
      ...(parents === undefined
        ? {}
        : { parentOperationIds: parents }),
    },
  };
}

describe("generation-aware interleaving reduction", () => {
  it("keeps different generations as separate schedule choices", () => {
    const first = operation("op-a", 1);
    const second = operation("op-b", 2);

    expect(
      operationsHaveGenerationConflict(
        first,
        second,
      ),
    ).toBe(true);

    const result = exploreInterleavings(
      [first, second],
      { maxSchedules: 10 },
    );

    expect(result.generationDependencyPairs).toBe(1);
    expect(result.schedules).toHaveLength(2);
  });

  it("can reduce independent operations in the same generation", () => {
    const first = operation("op-a", 2);
    const second = operation("op-b", 2);

    const result = exploreInterleavings(
      [first, second],
      { maxSchedules: 10 },
    );

    expect(result.generationDependencyPairs).toBe(0);
    expect(result.schedules).toHaveLength(1);
  });

  it("converts causal parents into mandatory ordering", () => {
    const first = operation("op-a", 1);
    const second = operation(
      "op-b",
      2,
      ["op-a"],
    );

    const result = exploreInterleavings(
      [second, first],
      { maxSchedules: 10 },
    );

    expect(
      result.schedules.map((schedule) =>
        schedule.map((item) => item.id)
      ),
    ).toEqual([["op-a", "op-b"]]);
    expect(result.blockedByHappensBefore)
      .toBeGreaterThan(0);
  });

  it("rejects unknown causal parent references", () => {
    expect(() =>
      exploreInterleavings(
        [
          operation(
            "op-b",
            2,
            ["op-missing"],
          ),
        ],
        { maxSchedules: 10 },
      )
    ).toThrow(/unknown before operation/);
  });
});
}

// Original suite engine/packages/reliability-search/test/search/happens-before.test.ts, blob 3de607af73e6ef353e5ed145e48a001e11f52531
{
function operation(
  id: string,
  write: string,
  surface?: string,
): ScheduledOperation<string> {
  return {
    id,
    value: id,
    footprint: {
      reads: [],
      writes: [write],
      ...(surface === undefined
        ? {}
        : {
            semanticSurfaces: [surface],
          }),
    },
  };
}

describe("happens-before concurrency semantics", () => {
  it("does not collapse disjoint operations sharing an implicit engine surface", () => {
    const a = operation(
      "a",
      "player:p1",
      "event-ordering",
    );
    const b = operation(
      "b",
      "entity:e1",
      "event-ordering",
    );

    expect(
      operationsIndependent(
        a,
        b,
        {
          hiddenDependencySurfaces: [
            "event-ordering",
          ],
        },
      ),
    ).toBe(false);

    const result = exploreInterleavings(
      [a, b],
      {
        maxSchedules: 10,
        concurrency: {
          hiddenDependencySurfaces: [
            "event-ordering",
          ],
        },
      },
    );

    expect(result.schedules)
      .toHaveLength(2);
  });

  it("enforces explicit happens-before ordering", () => {
    const a = operation(
      "a",
      "a-state",
    );
    const b = operation(
      "b",
      "b-state",
    );

    const result = exploreInterleavings(
      [a, b],
      {
        maxSchedules: 10,
        concurrency: {
          happensBefore: [{
            before: "a",
            after: "b",
            reason: "causal-parent",
            evidenceIds: ["e:a-before-b"],
          }],
        },
      },
    );

    expect(
      result.schedules.map((schedule) =>
        schedule.map((item) => item.id)
      ),
    ).toEqual([["a", "b"]]);
    expect(
      result.blockedByHappensBefore,
    ).toBeGreaterThan(0);
  });

  it("rejects cyclic causal ordering instead of returning an empty search space", () => {
    expect(() =>
      exploreInterleavings(
        [
          operation("a", "a-state"),
          operation("b", "b-state"),
        ],
        {
          maxSchedules: 10,
          concurrency: {
            happensBefore: [
              {
                before: "a",
                after: "b",
                reason: "causal-parent",
              },
              {
                before: "b",
                after: "a",
                reason: "causal-parent",
              },
            ],
          },
        },
      )
    ).toThrow(/contains a cycle/);
  });
});
}

// Original suite engine/packages/reliability-search/test/search/interleaving-scale.test.ts, blob 42d088eaae27430a3e10b97ae6bfd0895b8bb73b
{
describe("interleaving reduction scalability", () => {
  it("does not enumerate factorial schedules when all operations are independent", () => {
    const operations: ScheduledOperation<number>[] = Array.from(
      { length: 8 },
      (_, index) => ({
        id: `op-${index}`,
        value: index,
        footprint: {
          reads: [],
          writes: [`resource-${index}`],
        },
      }),
    );

    const result = exploreInterleavings(operations, {
      maxSchedules: 100,
      maxExploredNodes: 1000,
    });

    expect(result.schedules).toHaveLength(1);
    expect(result.exploredNodes).toBeLessThan(20);
    expect(result.reducedEquivalentBranches).toBeGreaterThan(0);
    expect(result.truncated).toBe(false);
  });

  it("rejects duplicate operation ids because replay identity would be ambiguous", () => {
    expect(() => exploreInterleavings([
      { id: "same", value: 1, footprint: { reads: [], writes: ["a"] } },
      { id: "same", value: 2, footprint: { reads: [], writes: ["b"] } },
    ], { maxSchedules: 10 })).toThrow(/unique/);
  });
});
}

// Original suite engine/packages/reliability-search/test/search/multiplayer-interleaving.test.ts, blob c82c0c98c9efc57750a4ef45a8096a5cf61a7469
{
describe("multiplayer interleaving analysis", () => {
  it("binds generation changes as dependencies and ranks stale-work schedules", () => {
    const events = [
      {
        id: "disconnect",
        kind: "disconnect" as const,
        arenaId: "arena-1",
        playerId: "p1",
        arenaGeneration: 2,
        connectionGeneration: 7,
      },
      {
        id: "callback",
        kind: "deferred-callback" as const,
        arenaId: "arena-1",
        playerId: "p1",
        arenaGeneration: 2,
        connectionGeneration: 7,
      },
      {
        id: "reconnect",
        kind: "reconnect" as const,
        arenaId: "arena-1",
        playerId: "p1",
        arenaGeneration: 2,
        connectionGeneration: 8,
      },
    ];

    const result =
      analyzeMultiplayerInterleavings(events, {
        maxSchedules: 16,
      });

    expect(
      result.generationDependencyPairs,
    ).toBeGreaterThan(0);
    expect(result.schedules[0]?.riskReasons).toContain(
      "disconnect-stale-work",
    );
  });

  it("derives explicit footprints for arena membership state", () => {
    const operation = multiplayerEventOperation({
      id: "membership",
      kind: "membership-commit",
      arenaId: "arena-a",
      playerId: "player-a",
      arenaGeneration: 1,
      participationGeneration: 3,
    });

    expect(operation.footprint.writes).toEqual(
      expect.arrayContaining([
        "arena:arena-a:membership",
        "player:player-a:assignment",
      ]),
    );
  });

  it("preserves happens-before constraints while reducing independent schedules", () => {
    const result = analyzeMultiplayerInterleavings(
      [
        {
          id: "request-a",
          kind: "start-request",
          arenaId: "arena-a",
          arenaGeneration: 1,
        },
        {
          id: "commit-a",
          kind: "start-commit",
          arenaId: "arena-a",
          arenaGeneration: 1,
          parentEventIds: ["request-a"],
        },
        {
          id: "request-b",
          kind: "start-request",
          arenaId: "arena-b",
          arenaGeneration: 1,
        },
      ],
      {
        maxSchedules: 16,
      },
    );

    expect(
      result.schedules.every(
        (schedule) =>
          schedule.eventIds.indexOf("request-a") <
          schedule.eventIds.indexOf("commit-a"),
      ),
    ).toBe(true);
    expect(
      result.reducedEquivalentBranches,
    ).toBeGreaterThanOrEqual(0);
  });
});
}

// Original suite engine/packages/reliability-search/test/search/search.test.ts, blob 282b7521f25378656bad43003be42e3bd7a7d2e2
{
describe("semantic coverage-guided search", () => {
  it("retains only inputs that add semantic coverage or fail", async () => {
    const seed: SessionSearchInput = {
      arenaIds: ["arena1", "arena2"],
      actions: [
        { kind: "join", playerId: "p1" },
        { kind: "assign", playerId: "p1", arenaId: "arena1" },
        { kind: "start", playerId: "p1" },
        { kind: "join", playerId: "p2" },
        { kind: "assign", playerId: "p2", arenaId: "arena2" },
        { kind: "start", playerId: "p2" },
      ],
    };

    const result = await runCoverageGuidedSearch(
      [seed],
      sessionCoverageSearchDomain,
      { maxEvaluations: 40, maxCorpusEntries: 20 },
    );

    expect(result.evaluations).toBeGreaterThan(0);
    expect(result.corpus.length).toBeGreaterThan(0);
    expect(result.coverage.features).toEqual(expect.arrayContaining([
      expect.objectContaining({ dimension: "state" }),
      expect.objectContaining({ dimension: "transition" }),
      expect.objectContaining({ dimension: "action-pair" }),
      expect.objectContaining({ dimension: "interaction" }),
    ]));
  });

  it("semantic coverage is deterministic for identical inputs", () => {
    const input: SessionSearchInput = {
      arenaIds: ["arena1"],
      actions: [
        { kind: "join", playerId: "p1" },
        { kind: "assign", playerId: "p1", arenaId: "arena1" },
      ],
    };

    expect(sessionSemanticCoverage(input).coverage)
      .toEqual(sessionSemanticCoverage(input).coverage);
  });
});

describe("systematic interleaving exploration", () => {
  it("collapses schedules that differ only by independent operations", () => {
    const operations = scheduledSessionActions([
      { kind: "join", playerId: "p1" },
      { kind: "join", playerId: "p2" },
      { kind: "progress", playerId: "p1", amount: 1 },
    ]);

    const result = exploreInterleavings(operations, { maxSchedules: 20 });

    expect(result.exploredNodes).toBeGreaterThan(0);
    expect(result.schedules.length).toBeLessThan(6);
    expect(result.reducedEquivalentBranches).toBeGreaterThan(0);
  });

  it("keeps dependent ordering distinctions", () => {
    const operations = scheduledSessionActions([
      { kind: "join", playerId: "p1" },
      { kind: "progress", playerId: "p1", amount: 1 },
    ]);

    const result = exploreInterleavings(operations, { maxSchedules: 10 });

    expect(result.schedules).toHaveLength(2);
  });
});

describe("failure minimization", () => {
  it("reduces a failing action list to a 1-minimal reproduction", async () => {
    const actions = ["noise-a", "start-p1", "noise-b", "start-p2", "noise-c"];

    const result = await ddmin(
      actions,
      (candidate) =>
        candidate.includes("start-p1") && candidate.includes("start-p2"),
    );

    expect(result.minimized).toEqual(["start-p1", "start-p2"]);
    expect(result.minimizedLength).toBe(2);
    expect(result.originalLength).toBe(5);
  });
});
}
