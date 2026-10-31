import { describe, expect, it } from "vitest";
import {
  MULTIPLAYER_STRESS_CAPABILITY_REGISTRY,
  createAllArenaFinishStressExperiment,
  createAllArenaStartStressExperiment,
  createCleanupStartOverlapExperiment,
  preflightRuntimeExperimentCapabilities,
  validateRuntimeActionCapabilityRegistry,
  validateRuntimeExperimentDefinition,
} from "../../../src/index.js";

const arenas = [
  { arenaId: "arena-1", arenaGeneration: 1 },
  { arenaId: "arena-2", arenaGeneration: 2 },
  { arenaId: "arena-3", arenaGeneration: 3 },
];

const common = {
  targetProfileFingerprint: "profile",
  fixtureFingerprint: "fixture",
  objectiveId: "qa",
  participant: "result",
};

describe("multi-arena stress runtime experiments", () => {
  it("publishes a valid stress capability registry", () => {
    expect(
      validateRuntimeActionCapabilityRegistry(
        MULTIPLAYER_STRESS_CAPABILITY_REGISTRY,
      ),
    ).toEqual([]);
  });

  it("defines runtime-ready all-arena start and finish experiments", () => {
    const definitions = [
      createAllArenaStartStressExperiment({
        ...common,
        id: "start-all",
        title: "start all",
        arenas,
        playerCountPerArena: 5,
      }),
      createAllArenaFinishStressExperiment({
        ...common,
        id: "finish-all",
        title: "finish all",
        arenas,
        playerCountPerArena: 5,
      }),
    ];

    for (const definition of definitions) {
      expect(
        validateRuntimeExperimentDefinition(
          definition,
        ),
      ).toEqual([]);
      expect(
        preflightRuntimeExperimentCapabilities(
          definition,
          MULTIPLAYER_STRESS_CAPABILITY_REGISTRY,
          "LIVE_MINECRAFT",
        ).ready,
      ).toBe(true);
    }
  });

  it("defines cleanup/start overlap for two distinct arenas", () => {
    const definition =
      createCleanupStartOverlapExperiment({
        ...common,
        id: "overlap",
        title: "cleanup start overlap",
        endingArena: arenas[0]!,
        startingArena: arenas[1]!,
        playerCountStartingArena: 5,
      });

    expect(
      validateRuntimeExperimentDefinition(
        definition,
      ),
    ).toEqual([]);
    expect(
      preflightRuntimeExperimentCapabilities(
        definition,
        MULTIPLAYER_STRESS_CAPABILITY_REGISTRY,
        "LIVE_MINECRAFT",
      ).ready,
    ).toBe(true);
  });
});
