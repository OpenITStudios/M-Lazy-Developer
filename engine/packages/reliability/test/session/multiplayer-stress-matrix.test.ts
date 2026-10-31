import { describe, expect, it } from "vitest";
import { buildMultiplayerStressMatrix } from "../../src/session/multiplayer-stress-matrix.js";

describe("multiplayer stress matrix", () => {
  it("builds the full six-arena five-player validation matrix", () => {
    const result = buildMultiplayerStressMatrix({
      arenaIds: [
        "arena-1",
        "arena-2",
        "arena-3",
        "arena-4",
        "arena-5",
        "arena-6",
      ],
      playersPerArena: 5,
    });

    expect(result.totalNominalPlayers).toBe(30);
    expect(result.byKind["full-capacity-session"])
      .toBe(6);
    expect(result.byKind["capacity-overflow"])
      .toBe(6);
    expect(result.byKind["cleanup-start-overlap"])
      .toBe(6);
    expect(result.byKind["simultaneous-all-arena-start"])
      .toBe(1);
    expect(
      result.scenarios.find(
        (item) =>
          item.kind ===
          "simultaneous-all-arena-start",
      )?.playerIds,
    ).toHaveLength(30);
  });

  it("keeps scenario ids deterministic regardless of input order", () => {
    const a = buildMultiplayerStressMatrix({
      arenaIds: ["arena-2", "arena-1"],
      playersPerArena: 2,
    });
    const b = buildMultiplayerStressMatrix({
      arenaIds: ["arena-1", "arena-2"],
      playersPerArena: 2,
    });

    expect(
      a.scenarios.map((item) => item.id),
    ).toEqual(
      b.scenarios.map((item) => item.id),
    );
  });
});
