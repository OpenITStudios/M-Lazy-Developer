import { describe, expect, it } from "vitest";
import {
  REPEATED_ARENA_CYCLE_CAPABILITY_REGISTRY,
  createRepeatedArenaCycleExperiment,
  preflightRuntimeExperimentCapabilities,
  validateRuntimeActionCapabilityRegistry,
  validateRuntimeExperimentDefinition,
} from "../../../src/index.js";

describe("repeated arena cycle runtime experiment", () => {
  it("defines a runtime-ready 20-cycle all-arena cleanup contract", () => {
    const definition =
      createRepeatedArenaCycleExperiment({
        id: "repeat-20",
        title: "repeat 20",
        targetProfileFingerprint: "target",
        fixtureFingerprint: "fixture",
        objectiveId: "qa",
        participant: "result",
        arenas: [
          {
            arenaId: "arena-1",
            arenaGeneration: 1,
          },
          {
            arenaId: "arena-2",
            arenaGeneration: 1,
          },
        ],
        playersPerArena: 5,
        cycles: 20,
        scope: "all-arenas",
        compareSurfaces: [
          "arena-membership",
          "dynamic-properties",
          "deferred-callbacks",
        ],
      });

    expect(
      validateRuntimeActionCapabilityRegistry(
        REPEATED_ARENA_CYCLE_CAPABILITY_REGISTRY,
      ),
    ).toEqual([]);
    expect(
      validateRuntimeExperimentDefinition(
        definition,
      ),
    ).toEqual([]);
    expect(
      preflightRuntimeExperimentCapabilities(
        definition,
        REPEATED_ARENA_CYCLE_CAPABILITY_REGISTRY,
        "LIVE_MINECRAFT",
      ).ready,
    ).toBe(true);
    expect(
      definition.evidenceRequirements,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          predicateId:
            "arena-residue-count-sampled",
          measurements: {
            residueCount: {
              equals: 0,
            },
          },
        }),
      ]),
    );
  });
});
