import { describe, expect, it } from "vitest";
import {
  captureBedrockObservationSnapshot,
  DEFAULT_ARENA_SESSION_MAPPING,
} from "../../src/index.js";

describe("Bedrock runtime evidence emitter", () => {
  it("captures player tags, scores, arena scores, tick and selected entities", () => {
    const scores = {
      session_progress: new Map<unknown, number>([["p1", 3]]),
      cutscene_active: new Map<unknown, number>([["#arena1", 0]]),
      round: new Map<unknown, number>([["#arena1", 2]]),
    };

    const player = {
      id: "p1",
      getTags: () => ["arena:arena1", "session:playing"],
    };

    for (const objective of Object.values(scores)) {
      objective.set(player, objective.get("p1") ?? 3);
    }

    const world = {
      scoreboard: {
        getObjective(id: string) {
          const objective = scores[id as keyof typeof scores];
          if (!objective) return undefined;
          return {
            getScore(participant: unknown) {
              return objective.get(participant);
            },
          };
        },
      },
      getAllPlayers: () => [player],
      getDimension: () => ({
        id: "minecraft:overworld",
        getEntities: () => [{
          id: "z1",
          typeId: "minecraft:zombie",
          location: { x: 1, y: 2, z: 3 },
          getTags: () => ["arena:arena1"],
        }],
      }),
    };

    const result = captureBedrockObservationSnapshot(
      world,
      { currentTick: 120 },
      {
        playerObjectives: ["session_progress"],
        arenaObjectives: ["cutscene_active", "round"],
        arenas: [{ arenaId: "arena1", participant: "#arena1" }],
        entityQueries: [{
          dimension: "overworld",
          arenaTagPrefix: "arena:",
        }],
        minecraftVersion: "1.26.40",
        artifactFingerprint: "sha",
      },
      DEFAULT_ARENA_SESSION_MAPPING,
    );

    expect(result.captureIssues).toEqual([]);
    expect(result.mappingIssues).toEqual([]);
    expect(result.snapshot).toMatchObject({
      minecraftVersion: "1.26.40",
      artifactFingerprint: "sha",
      tick: 120,
      players: [{
        playerId: "p1",
        arenaId: "arena1",
        phase: "playing",
        progress: 3,
      }],
      arenas: [{
        arenaId: "arena1",
        cutsceneActive: false,
        round: 2,
      }],
      entities: [{
        entityId: "z1",
        typeId: "minecraft:zombie",
        arenaId: "arena1",
      }],
    });
  });

  it("records missing objectives instead of inventing scores", () => {
    const result = captureBedrockObservationSnapshot(
      {
        scoreboard: {
          getObjective: () => undefined,
        },
        getAllPlayers: () => [{
          id: "p1",
          getTags: () => [],
        }],
        getDimension: () => ({
          id: "minecraft:overworld",
          getEntities: () => [],
        }),
      },
      { currentTick: 1 },
      {
        playerObjectives: ["missing"],
        arenaObjectives: [],
        arenas: [],
      },
      DEFAULT_ARENA_SESSION_MAPPING,
    );

    expect(result.captureIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "objective-missing",
        subject: "missing",
      }),
    ]));
    expect(result.snapshot.players[0]?.scores).toEqual({});
  });
});
