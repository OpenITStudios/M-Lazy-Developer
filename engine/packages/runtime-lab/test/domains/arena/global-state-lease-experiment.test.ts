import { describe, expect, it } from "vitest";
import {
  GLOBAL_STATE_LEASE_CAPABILITY_REGISTRY,
  createGlobalStateLeaseRaceExperiment,
  preflightRuntimeExperimentCapabilities,
  validateRuntimeActionCapabilityRegistry,
  validateRuntimeExperimentDefinition,
} from "../../../src/index.js";

describe("global state lease race experiment", () => {
  it("defines a generation-scoped stale-owner restore race", () => {
    const definition =
      createGlobalStateLeaseRaceExperiment({
        id: "lease-race:pvp",
        title: "gamerule pvp lease race",
        targetProfileFingerprint: "target",
        fixtureFingerprint: "fixture",
        objectiveId: "qa",
        participant: "result",
        resource: "gamerule:pvp",
        firstOwner: {
          arenaId: "arena-1",
          arenaGeneration: 1,
        },
        secondOwner: {
          arenaId: "arena-2",
          arenaGeneration: 3,
        },
        firstValue: "false",
        secondValue: "true",
        baselineValue: "true",
      });

    expect(
      validateRuntimeActionCapabilityRegistry(
        GLOBAL_STATE_LEASE_CAPABILITY_REGISTRY,
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
        GLOBAL_STATE_LEASE_CAPABILITY_REGISTRY,
        "LIVE_MINECRAFT",
      ).ready,
    ).toBe(true);
    expect(
      definition.evidenceRequirements,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          predicateId:
            "worldstate-stale-restore-blocked",
        }),
      ]),
    );
  });
});
