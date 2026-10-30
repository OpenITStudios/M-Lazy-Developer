// Consolidated same-owner, same-feature, same-lane test family.
// Original cases/assertions preserved; this is NOT executed test proof.
import { describe, expect, it } from "vitest";
import { adaptBedrockState, DEFAULT_ARENA_SESSION_MAPPING, compareRuntimeObservation, runSessionSequence, validateRuntimeObservation, compareRuntimeSessionRecordings, createRuntimeSessionRecording } from "../../src/index.js";

// Original suite: engine/packages/reliability/test/runtime/bedrock-state-adapter.test.ts (Git blob 54ea6bf827347b1a75d1871a2d37c98a229bcfdb)
{


describe("Bedrock scoreboard/tag observation adapter", () => {
  it("maps explicit tags and scores into runtime observations", () => {
    const result = adaptBedrockState(
      [{
        playerId: "p1",
        connected: true,
        tags: ["arena:arena1", "session:playing"],
        scores: {
          session_progress: 3,
        },
      }],
      [{
        arenaId: "arena1",
        tags: [],
        scores: {
          cutscene_active: 0,
          round: 2,
        },
      }],
      DEFAULT_ARENA_SESSION_MAPPING,
      {
        minecraftVersion: "1.26.40",
        tick: 100,
      },
    );

    expect(result.issues).toEqual([]);
    expect(result.snapshot.players[0]).toMatchObject({
      playerId: "p1",
      arenaId: "arena1",
      phase: "playing",
      progress: 3,
    });
    expect(result.snapshot.arenas[0]).toMatchObject({
      arenaId: "arena1",
      activePlayerIds: ["p1"],
      cutsceneActive: false,
      round: 2,
    });
  });

  it("reports multiple arena tags as ambiguity instead of guessing", () => {
    const result = adaptBedrockState(
      [{
        playerId: "p1",
        connected: true,
        tags: ["arena:arena1", "arena:arena2", "session:playing"],
        scores: {},
      }],
      [],
      DEFAULT_ARENA_SESSION_MAPPING,
    );

    expect(result.snapshot.players[0]?.arenaId).toBeUndefined();
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "ambiguous",
        field: "arenaId",
      }),
    ]));
  });

  it("reports conflicting phase evidence as ambiguity", () => {
    const result = adaptBedrockState(
      [{
        playerId: "p1",
        connected: true,
        tags: ["session:starting", "session:playing"],
        scores: {},
      }],
      [],
      DEFAULT_ARENA_SESSION_MAPPING,
    );

    expect(result.snapshot.players[0]?.phase).toBeUndefined();
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "ambiguous",
        field: "phase",
      }),
    ]));
  });
});
}

// Original suite: engine/packages/reliability/test/runtime/runtime-observation.test.ts (Git blob 0c376002cb1d478a386d92e305ea21dc3bb93ee4)
{


describe("runtime observation contract", () => {
  it("accepts a runtime snapshot matching the expected model", () => {
    const expected = runSessionSequence(
      ["arena1", "arena2"],
      [
        { kind: "join", playerId: "p1" },
        { kind: "join", playerId: "p2" },
        { kind: "assign", playerId: "p1", arenaId: "arena1" },
        { kind: "assign", playerId: "p2", arenaId: "arena2" },
        { kind: "start", playerId: "p1" },
        { kind: "start", playerId: "p2" },
      ],
    ).finalModel;

    const snapshot = {
      schemaVersion: 1 as const,
      players: [
        { playerId: "p1", connected: true, arenaId: "arena1", phase: "starting" as const, progress: 0 },
        { playerId: "p2", connected: true, arenaId: "arena2", phase: "starting" as const, progress: 0 },
      ],
      arenas: [
        { arenaId: "arena1", activePlayerIds: ["p1"], cutsceneActive: true, round: 0 },
        { arenaId: "arena2", activePlayerIds: ["p2"], cutsceneActive: true, round: 0 },
      ],
    };

    expect(validateRuntimeObservation(snapshot)).toEqual([]);
    expect(compareRuntimeObservation(expected, snapshot)).toMatchObject({
      ok: true,
      divergences: [],
      invariantViolations: [],
    });
  });

  it("reports runtime/model divergence without hiding unknown evidence", () => {
    const expected = runSessionSequence(
      ["arena1"],
      [
        { kind: "join", playerId: "p1" },
        { kind: "assign", playerId: "p1", arenaId: "arena1" },
        { kind: "start", playerId: "p1" },
      ],
    ).finalModel;

    const result = compareRuntimeObservation(expected, {
      schemaVersion: 1,
      players: [
        { playerId: "p1", connected: true, arenaId: "arena1" },
      ],
      arenas: [
        { arenaId: "arena1" },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.unknowns).toEqual(expect.arrayContaining([
      "player:p1:phase-inferred",
      "player:p1:progress-unknown",
      "arena:arena1:membership-unknown",
      "arena:arena1:cutscene-unknown",
      "arena:arena1:round-unknown",
    ]));
    expect(result.divergences.length).toBeGreaterThan(0);
  });
});
}

// Original suite: engine/packages/reliability/test/runtime/runtime-session-replay.test.ts (Git blob cfe93aa834a1639337e92025e8273184d1a98614)
{


const plan = { schemaVersion: 1 as const, scenarioId: "demo", actions: [] };

describe("runtime session replay contract", () => {
  it("finds the first semantic observation divergence", () => {
    const expected = createRuntimeSessionRecording(plan, [
      { schemaVersion: 1, tick: 1, players: [], arenas: [] },
      { schemaVersion: 1, tick: 2, players: [{ playerId: "p", connected: true }], arenas: [] },
    ], "profile-a");
    const actual = createRuntimeSessionRecording(plan, [
      { schemaVersion: 1, tick: 1, players: [], arenas: [] },
      { schemaVersion: 1, tick: 2, players: [{ playerId: "p", connected: false }], arenas: [] },
    ], "profile-a");
    const comparison = compareRuntimeSessionRecordings(expected, actual);
    expect(comparison.status).toBe("diverged");
    expect(comparison.firstDivergence?.index).toBe(1);
  });

  it("refuses cross-profile equivalence", () => {
    const snapshots = [{ schemaVersion: 1 as const, tick: 1, players: [], arenas: [] }];
    const comparison = compareRuntimeSessionRecordings(
      createRuntimeSessionRecording(plan, snapshots, "profile-a"),
      createRuntimeSessionRecording(plan, snapshots, "profile-b"),
    );
    expect(comparison.status).toBe("incomplete");
  });
});
}
