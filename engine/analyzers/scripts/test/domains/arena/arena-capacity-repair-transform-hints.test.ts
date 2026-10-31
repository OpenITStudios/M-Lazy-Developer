import { describe, expect, it } from "vitest";
import {
  deriveArenaCapacityGuardTransformHints,
  parseScriptFile,
} from "../../../src/index.js";

const source = {
  artifactId: "art-arena",
  relativePath: "scripts/arena.ts",
};

describe("arena capacity repair transform hints", () => {
  it("derives an exact terminal capacity guard from a two-statement authored arena path", () => {
    const text = [
      "function join(arena, player) {",
      "  const maxPlayers = arena.maxPlayers;",
      "  arena.members.add(player);",
      "}",
    ].join("\n");

    const hints =
      deriveArenaCapacityGuardTransformHints(
        "arena",
        text,
        source,
      );

    expect(hints).toHaveLength(1);
    expect(hints[0]).toMatchObject({
      family: "arena-capacity-guard",
      source: {
        ...source,
        range: expect.objectContaining({
          lineStart: 3,
          lineEnd: 3,
        }),
      },
      expectedText:
        "arena.members.add(player);",
      replacementText:
        "if (arena.members.size < maxPlayers) arena.members.add(player);",
      supportedPredicateIds: [
        "arena-capacity-overflow-observed",
      ],
      supportedFactorIds: [
        "capacity-guard-enabled",
      ],
    });

    expect(
      parseScriptFile(
        "arena",
        text,
        source,
      ).repairTransformHints,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          family: "arena-capacity-guard",
          supportedPredicateIds: [
            "arena-capacity-overflow-observed",
          ],
        }),
      ]),
    );
  });

  it("uses array length when the authored membership commit is push", () => {
    const text = [
      "function join(arena, player) {",
      "  const maxPlayers = arena.maxPlayers;",
      "  arena.players.push(player);",
      "}",
    ].join("\n");

    const hints =
      deriveArenaCapacityGuardTransformHints(
        "arena",
        text,
        source,
      );

    expect(hints).toHaveLength(1);
    expect(hints[0]?.replacementText).toBe(
      "if (arena.players.length < maxPlayers) arena.players.push(player);",
    );
  });

  it("does not emit a hint when the block has any extra side effect", () => {
    const text = [
      "function join(arena, player) {",
      "  const maxPlayers = arena.maxPlayers;",
      "  chargeEntryFee(player);",
      "  arena.members.add(player);",
      "}",
    ].join("\n");

    expect(
      deriveArenaCapacityGuardTransformHints(
        "arena",
        text,
        source,
      ),
    ).toEqual([]);
  });

  it("does not emit a hint for mutable capacity or capacity from a different arena object", () => {
    const mutable = [
      "function join(arena, player) {",
      "  let maxPlayers = arena.maxPlayers;",
      "  arena.members.add(player);",
      "}",
    ].join("\n");

    const otherArena = [
      "function join(arena, otherArena, player) {",
      "  const maxPlayers = otherArena.maxPlayers;",
      "  arena.members.add(player);",
      "}",
    ].join("\n");

    expect(
      deriveArenaCapacityGuardTransformHints(
        "arena",
        mutable,
        source,
      ),
    ).toEqual([]);
    expect(
      deriveArenaCapacityGuardTransformHints(
        "arena",
        otherArena,
        source,
      ),
    ).toEqual([]);
  });

  it("does not treat queue/join-pad collections as committed membership surfaces", () => {
    const text = [
      "function join(arena, player) {",
      "  const maxPlayers = arena.maxPlayers;",
      "  arena.queue.push(player);",
      "}",
    ].join("\n");

    expect(
      deriveArenaCapacityGuardTransformHints(
        "arena",
        text,
        source,
      ),
    ).toEqual([]);
  });
});
