// Owner-local source consolidation. Original cases are preserved verbatim.
import { describe, expect, it } from "vitest";
import { derivePersistentDataLifecycleEvidence } from "../../../src/domains/persistence/persistent-data-lifecycle.js";
import { inferPersistentStateLifetimes } from "../../../src/domains/persistence/persistent-state-lifetime.js";
import { inferPersistentStateScopes } from "../../../src/domains/persistence/persistent-state-scope.js";

// Original engine/analyzers/scripts/test/domains/persistence/persistent-data-lifecycle.test.ts [0bea285286aa22a598d26f8bdb4e7206983ce999]
{
describe("persistent data lifecycle evidence", () => {
  it("retains a direct reset statement's lexical block and excludes nested calls", () => {
    const output = derivePersistentDataLifecycleEvidence([
      "function reset(arena, flag) {",
      '  arena.setDynamicProperty("phase", undefined);',
      '  if (flag) { arena.setDynamicProperty("phase", undefined); }',
      '  if (flag) arena.setDynamicProperty("phase", undefined);',
      '  consume(arena.setDynamicProperty("phase", undefined));',
      "}",
    ].join("\n"), {
      artifactId: "artifact:test", relativePath: "scripts/main.ts",
    });
    const sites = output.find(x => x.propertyKey === "phase")?.resetSites ?? [];
    expect(sites).toHaveLength(4);
    expect(sites[0]?.sequentialBlockSource?.range?.lineStart).toBe(1);
    expect(sites[1]?.sequentialBlockSource?.range?.lineStart).toBe(3);
    expect(sites[2]?.sequentialBlockSource).toBeUndefined();
    expect(sites[3]?.sequentialBlockSource).toBeUndefined();
  });

  it("captures preceding exits and rebindings for direct reset statements", () => {
    const rows = derivePersistentDataLifecycleEvidence([
      "function reset(arena, otherArena, skip) {",
      '  arena.setDynamicProperty("round", undefined);',
      "  arena = otherArena;",
      "  if (skip) return;",
      '  arena.setDynamicProperty("round", undefined);',
      "}",
    ].join("\n"), {
      artifactId: "artifact:test", relativePath: "scripts/main.ts",
    });
    const sites = rows.find(item => item.propertyKey === "round")?.resetSites ?? [];
    expect(sites).toHaveLength(2);
    expect(sites[0]?.sequentialPathEvidence?.precedingControlExitSources)
      .toEqual([]);
    expect(sites[0]?.sequentialPathEvidence?.precedingReceiverRebindingSources)
      .toEqual([]);
    expect(sites[1]?.sequentialPathEvidence?.precedingControlExitSources
      .map(item => item.range?.lineStart)).toEqual([4]);
    expect(sites[1]?.sequentialPathEvidence?.precedingReceiverRebindingSources
      .map(item => item.range?.lineStart)).toEqual([3]);
  });

  it("tracks calls that may escape the receiver without guessing call effects", () => {
    const rows = derivePersistentDataLifecycleEvidence([
      "function cleanup(arena) {",
      '  arena.setDynamicProperty("roundState", undefined);',
      '  notify("ready");',
      "  const ref = arena;",
      "  mutate(ref);",
      '  arena.setDynamicProperty("roundState", undefined);',
      "}",
    ].join("\n"), {
      artifactId: "artifact:test", relativePath: "scripts/cleanup.ts",
    });
    const sites = rows.find(x => x.propertyKey === "roundState")?.resetSites ?? [];
    expect(sites).toHaveLength(2);
    expect(sites[0]?.sequentialPathEvidence?.precedingReceiverCallSources)
      .toEqual([]);
    expect(sites[1]?.sequentialPathEvidence?.precedingReceiverCallSources
      .map(item => item.range?.lineStart)).toEqual([5]);
  });

  it("retains property-specific reset-like source sites and separates removal from empty writes", () => {
    const source = { artifactId: "a", relativePath: "scripts/round.ts" };
    const result = derivePersistentDataLifecycleEvidence([
      "function resetRound(player) {",
      '  player.setDynamicProperty("roundState", undefined);',
      '  player.setDynamicProperty("roundState", "[]");',
      "  world.clearDynamicProperties();",
      "}",
      'world.setDynamicProperty("otherState", null);',
    ].join("\n"), source);
    const round = result.find(x => x.propertyKey === "roundState");
    expect(round?.clears).toBe(2);
    expect(round?.resetSites).toEqual([
      expect.objectContaining({
        propertyKey: "roundState", receiverHint: "player",
        executionRegion: "function:resetRound", kind: "undefined-removal",
        source: expect.objectContaining({
          artifactId: "a", relativePath: "scripts/round.ts",
          range: expect.objectContaining({ lineStart: 2 }),
        }),
      }),
      expect.objectContaining({
        propertyKey: "roundState", receiverHint: "player",
        executionRegion: "function:resetRound", kind: "empty-value-write",
        source: expect.objectContaining({
          range: expect.objectContaining({ lineStart: 3 }),
        }),
      }),
    ]);
    expect(result.find(x => x.propertyKey === "otherState")
      ?.resetSites?.map(x => x.kind)).toEqual(["empty-value-write"]);
    expect(result.every(x => x.resetSites?.every(site =>
      site.source.range?.lineStart !== 4) ?? true)).toBe(true);
  });

  it("does not assign broad clearDynamicProperties to an unrelated literal key", () => {
    const result = derivePersistentDataLifecycleEvidence([
      'const phase = world.getDynamicProperty("phase");',
      "world.clearDynamicProperties();",
    ].join("\n"), {
      artifactId: "a", relativePath: "scripts/main.ts",
    });
    expect(result.find(x => x.propertyKey === "phase")?.resetSites ?? [])
      .toEqual([]);
  });


  it("flags append/writeback without a visible clear as growth risk evidence", () => {
    const result = derivePersistentDataLifecycleEvidence(
      `
        const history = JSON.parse(
          world.getDynamicProperty("matchHistory") ?? "[]"
        );
        history.push({ score: 10 });
        world.setDynamicProperty("matchHistory", JSON.stringify(history));
      `,
      { artifactId: "artifact:test", relativePath: "scripts/main.ts" },
    );

    expect(result[0]).toEqual(
      expect.objectContaining({
        propertyKey: "matchHistory",
        appends: 1,
        writes: 1,
        growth: "append-without-clear",
      }),
    );
  });
});
}

// Original engine/analyzers/scripts/test/domains/persistence/persistent-state-lifetime.test.ts [b47f0856b9df5847bc385cf05f9402dc0e4b080a]
{
describe("persistent state lifetime", () => {
  it("does not infer player-session lifetime from a player dynamic-property receiver", () => {
    const result = inferPersistentStateLifetimes(
      [{
        propertyKey: "reconnectPhase", variable: "phase",
        reads: 1, appends: 0, writes: 1, clears: 0,
        growth: "no-append",
        source: { artifactId: "artifact:test", relativePath: "scripts/main.ts" },
      }],
      [{
        propertyId: "reconnectPhase", scope: "player",
        confidence: "exact-receiver", reasons: ["player receiver"],
      }],
      [],
    );
    expect(result[0]?.lifetime).toBe("unknown");
    expect(result[0]?.confidence).toBe("unknown");
    expect(result[0]?.reasons.join(" ")).toContain("not connection-session lifetime");
  });


  it("does not infer round or match lifetime from unrelated resource cleanup labels", () => {
    const source = { artifactId: "artifact:test", relativePath: "scripts/main.ts" };
    const result = inferPersistentStateLifetimes(
      [{
        propertyKey: "savedProgress",
        variable: "progress",
        reads: 1, appends: 1, writes: 1, clears: 1,
        growth: "append-with-clear", source,
      }],
      [{
        propertyId: "savedProgress", scope: "world",
        confidence: "exact-receiver", reasons: ["world receiver"],
      }],
      [{
        surface: "tag", action: "release", key: "player:ready",
        precision: "exact", executionRegion: "function:cleanupRound",
        source,
      }],
    );
    expect(result[0]?.lifetime).toBe("unknown");
    expect(result[0]?.confidence).toBe("unknown");
  });

  it("identifies world-lifetime growth when world state appends without cleanup", () => {
    const result = inferPersistentStateLifetimes(
      [{
        propertyKey: "history",
        variable: "history",
        reads: 1,
        appends: 1,
        writes: 1,
        clears: 0,
        growth: "append-without-clear",
        source: {
          artifactId: "artifact:test",
          relativePath: "scripts/main.ts",
        },
      }],
      [{
        propertyId: "history",
        scope: "world",
        confidence: "exact-receiver",
        reasons: ["world receiver"],
      }],
      [],
    );

    expect(result[0]?.lifetime).toBe("world");
  });
});
}

// Original engine/analyzers/scripts/test/domains/persistence/persistent-state-scope.test.ts [0a2454d30205afc49864d420a69f276d746eab4e]
{
describe("persistent state scope inference", () => {
  it("lets recognized world receiver outrank a round/arena key name", () => {
    const result = inferPersistentStateScopes([{
      operation: "set", propertyId: "arenaRoundState",
      receiverHint: "world",
      receiverType: "World",
      receiverInference: "direct",
      source: { artifactId: "a", relativePath: "scripts/main.ts" },
    }]);
    expect(result[0]).toMatchObject({
      scope: "world", confidence: "exact-receiver",
    });
  });

  it("keeps same literal key across player/world owners unresolved", () => {
    const source = { artifactId: "a", relativePath: "scripts/main.ts" };
    const result = inferPersistentStateScopes([
      { operation: "get", propertyId: "roundState",
        receiverHint: "world", receiverType: "World", receiverInference: "direct", source },
      { operation: "set", propertyId: "roundState",
        receiverHint: "player", receiverType: "Player", receiverInference: "direct", source },
    ]);
    expect(result[0]).toMatchObject({
      scope: "unknown", confidence: "unknown",
    });
  });

  it("does not turn an unidentified receiver into an exact mixed ownership proof", () => {
    const source = { artifactId: "a", relativePath: "scripts/main.ts" };
    const result = inferPersistentStateScopes([
      { operation: "get", propertyId: "matchState",
        receiverHint: "world", receiverType: "World", receiverInference: "direct", source },
      { operation: "set", propertyId: "matchState",
        receiverHint: "manager", source },
    ]);
    expect(result[0]?.scope).toBe("unknown");
    expect(result[0]?.confidence).toBe("unknown");
  });


  it("prefers receiver evidence over naming heuristics", () => {
    const result = inferPersistentStateScopes([
      {
        operation: "set",
        propertyId: "lastMatch",
        receiverHint: "player",
        receiverType: "Player",
        receiverInference: "direct",
        source: {
          artifactId: "artifact:test",
          relativePath: "scripts/main.ts",
        },
      },
    ]);

    expect(result[0]).toEqual(
      expect.objectContaining({
        scope: "player",
        confidence: "exact-receiver",
      }),
    );
  });


  it("does not promote a lexical world-looking variable to typed ownership", () => {
    const source = { artifactId: "selected", relativePath: "scripts/main.ts" };
    const lexicalOnly = inferPersistentStateScopes([{
      operation: "set", propertyId: "arenaRoundState",
      receiverHint: "world", source,
    }]);
    expect(lexicalOnly[0]).toMatchObject({
      scope: "arena", confidence: "name-pattern",
    });
    const bounded = inferPersistentStateScopes([{
      operation: "get", propertyId: "arenaRoundState",
      receiverHint: "world", receiverType: "World",
      receiverInference: "bounded", source,
    }]);
    expect(bounded[0]).toMatchObject({
      scope: "unknown", confidence: "unknown",
    });
  });

  it("preserves exact item dynamic-property ownership without borrowing player state", () => {
    const result = inferPersistentStateScopes([{
      operation: "get", propertyId: "item:unique-id",
      receiverHint: "item", receiverType: "ItemStack",
      receiverInference: "direct",
      source: { artifactId: "selected", relativePath: "scripts/items.ts" },
    }]);
    expect(result[0]).toMatchObject({
      scope: "item", confidence: "exact-receiver",
    });
  });

  it("keeps ambiguous properties unknown", () => {
    const result = inferPersistentStateScopes([
      {
        operation: "get",
        propertyId: "data",
        receiverHint: "manager",
        source: {
          artifactId: "artifact:test",
          relativePath: "scripts/main.ts",
        },
      },
    ]);

    expect(result[0]?.scope).toBe("unknown");
  });
});
}
