import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  checkSessionInvariants,
  createSessionModel,
  applySessionAction,
  runSessionSequence,
  sessionSequenceArbitrary,
} from "../../src/index.js";

describe("multiplayer session model", () => {
  it("allows independent arenas to start concurrently", () => {
    const result = runSessionSequence(
      ["arena1", "arena2"],
      [
        { kind: "join", playerId: "p1" },
        { kind: "join", playerId: "p2" },
        { kind: "assign", playerId: "p1", arenaId: "arena1" },
        { kind: "assign", playerId: "p2", arenaId: "arena2" },
        { kind: "start", playerId: "p1" },
        { kind: "start", playerId: "p2" },
      ],
    );

    expect(result.ok).toBe(true);
    expect(result.finalModel.arenas.arena1?.cutsceneActive).toBe(true);
    expect(result.finalModel.arenas.arena2?.cutsceneActive).toBe(true);
  });

  it("reconciles cutscene ownership when a starting player moves arenas", () => {
    const result = runSessionSequence(
      ["arena1", "arena2"],
      [
        { kind: "assign", playerId: "p1", arenaId: "arena1" },
        { kind: "start", playerId: "p1" },
        { kind: "assign", playerId: "p1", arenaId: "arena2" },
      ],
    );

    expect(result.ok).toBe(true);
    expect(result.finalModel.arenas.arena1?.cutsceneActive).toBe(false);
    expect(result.finalModel.players.p1).toMatchObject({
      arenaId: "arena2",
      phase: "assigned",
    });
  });

  it("disconnect resets progress but retains assignment for reconnect", () => {
    const result = runSessionSequence(
      ["arena1"],
      [
        { kind: "join", playerId: "p1" },
        { kind: "assign", playerId: "p1", arenaId: "arena1" },
        { kind: "start", playerId: "p1" },
        { kind: "begin-playing", playerId: "p1" },
        { kind: "progress", playerId: "p1", amount: 4 },
        { kind: "disconnect", playerId: "p1" },
        { kind: "reconnect", playerId: "p1" },
      ],
    );

    expect(result.ok).toBe(true);
    expect(result.finalModel.players.p1).toMatchObject({
      connected: true,
      arenaId: "arena1",
      phase: "assigned",
      progress: 0,
    });
  });

  it("preserves invariants over generated action sequences", () => {
    fc.assert(
      fc.property(
        sessionSequenceArbitrary({
          playerIds: ["p1", "p2", "p3"],
          arenaIds: ["arena1", "arena2"],
          maxSequenceLength: 50,
        }),
        (actions) => {
          const result = runSessionSequence(["arena1", "arena2"], actions);
          expect(result.ok).toBe(true);
        },
      ),
      { numRuns: 300 },
    );
  });

  it("detects explicit invalid multi-arena membership if runtime evidence violates the model", () => {
    const model = createSessionModel(["arena1", "arena2"]);
    const joined = applySessionAction(model, { kind: "join", playerId: "p1" });

    const corrupted = {
      ...joined,
      players: {
        ...joined.players,
        p1: {
          playerId: "p1",
          connected: true,
          arenaId: "arena1",
          phase: "playing" as const,
          progress: 1,
        },
      },
      arenas: {
        arena1: {
          ...joined.arenas.arena1!,
          activePlayerIds: ["p1"],
        },
        arena2: {
          ...joined.arenas.arena2!,
          activePlayerIds: ["p1"],
        },
      },
    };

    expect(checkSessionInvariants(corrupted)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        invariantId: "multiplayer.state-isolation",
      }),
    ]));
  });
});
