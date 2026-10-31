// Consolidated bounded owner/feature/lane suite. Original tests/assertions preserved.
import { describe, expect, it } from "vitest";
import { captureBedrockObservationSnapshot, DEFAULT_ARENA_SESSION_MAPPING } from "../../src/index.js";
import { parseRuntimeObservationLog, RUNTIME_OBSERVATION_LOG_PREFIX } from "../../src/index.js";

// Original suite: engine/packages/reliability/test/runtime/bedrock-runtime-emitter.test.ts (blob ab9836877ce0b0a40857aad31be921410e386d16)
{
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
}

// Original suite: engine/packages/reliability/test/runtime/content-log-parser.test.ts (blob 76b255086ca4bbe7aa9f29b7b1dcc6f7719aaf86)
{
describe("runtime content-log parser", () => {
  it("extracts structured observation records from noisy content logs", () => {
    const payload = {
      schemaVersion: 1,
      tick: 42,
      players: [],
      arenas: [],
    };

    const result = parseRuntimeObservationLog([
      "[Scripting][warning]-some unrelated line",
      `[Scripting][warning]-${RUNTIME_OBSERVATION_LOG_PREFIX}${JSON.stringify(payload)}`,
      "another unrelated line",
    ].join("\n"));

    expect(result.malformed).toEqual([]);
    expect(result.snapshots).toEqual([payload]);
  });

  it("keeps malformed observation records visible", () => {
    const result = parseRuntimeObservationLog(
      `${RUNTIME_OBSERVATION_LOG_PREFIX}{not-json}`,
    );

    expect(result.snapshots).toEqual([]);
    expect(result.malformed).toHaveLength(1);
  });
});
}
