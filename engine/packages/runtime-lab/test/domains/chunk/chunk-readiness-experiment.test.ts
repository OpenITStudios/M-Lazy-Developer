import { describe, expect, it } from "vitest";
import {
  CHUNK_READINESS_CAPABILITY_REGISTRY,
  createPlayerLoaderChunkReadinessExperiment,
  createTickingAreaChunkRecoveryExperiment,
  experimentQualificationCausalProof,
  qualifyRuntimeExperiment,
  runtimeExperimentDefinitionRevision,
  validateRuntimeActionCapabilityRegistry,
  validateRuntimeExperimentDefinition,
  type RuntimeExperimentTrial,
} from "../../../src/index.js";

const base = {
  id: "exp:chunk-ready",
  title: "Chunk readiness proof",
  targetProfileFingerprint: "profile-a",
  fixtureFingerprint: "fixture-a",
  target: {
    dimension: "minecraft:overworld",
    x: 128,
    y: 64,
    z: 128,
  },
};

describe("chunk readiness experiment families", () => {
  it("defines a valid player-loader control/treatment experiment", () => {
    const definition =
      createPlayerLoaderChunkReadinessExperiment({
        ...base,
        controlDistanceChunks: 12,
        treatmentDistanceChunks: 0,
      });

    expect(
      validateRuntimeExperimentDefinition(definition),
    ).toEqual([]);
    expect(definition.domain).toBe("chunks");
    expect(definition.requiredContext).toBe(
      "LIVE_MINECRAFT",
    );
    expect(definition.expectedContrasts).toEqual([{
      predicateId: "target-chunk-ready",
      controlState: "absent",
      treatmentState: "present",
    }]);
    expect(definition.arms).toEqual([
      expect.objectContaining({
        id: "control",
        factorValues: {
          "loader-distance-chunks": 12,
        },
      }),
      expect.objectContaining({
        id: "treatment",
        factorValues: {
          "loader-distance-chunks": 0,
        },
      }),
    ]);
  });

  it("defines a valid ticking-area recovery experiment with mandatory cleanup", () => {
    const definition =
      createTickingAreaChunkRecoveryExperiment(base);

    expect(
      validateRuntimeExperimentDefinition(definition),
    ).toEqual([]);
    expect(definition.protocol.map((step) => [
      step.phase,
      step.actionId,
    ])).toEqual([
      ["setup", "chunk.isolate-target-from-loaders"],
      ["stimulus", "chunk.set-temporary-ticking-area"],
      ["observe", "probe.chunk-loaded"],
      ["teardown", "chunk.clear-temporary-ticking-area"],
    ]);
    expect(definition.arms).toEqual([
      expect.objectContaining({
        id: "control",
        factorValues: {
          "ticking-area-enabled": false,
        },
      }),
      expect.objectContaining({
        id: "treatment",
        factorValues: {
          "ticking-area-enabled": true,
        },
      }),
    ]);
  });

  it("promotes repeated chunk readiness contrast into predicate-specific causal provenance", () => {
    const definition =
      createTickingAreaChunkRecoveryExperiment(base);

    function trial(
      id: string,
      armId: string,
      runIndex: number,
      state: "present" | "absent",
    ): RuntimeExperimentTrial {
      return {
        schemaVersion: 1,
        id,
        identity: {
          experimentId: definition.id,
          definitionRevision:
            runtimeExperimentDefinitionRevision(
              definition,
            ),
          armId,
          runIndex,
          targetProfileFingerprint:
            definition.targetProfileFingerprint,
          fixtureFingerprint:
            definition.fixtureFingerprint,
          environmentFingerprint: "env-a",
        },
        status: "completed",
        evidence: [{
          predicate: "target-chunk-ready",
          state,
          confidence: "observed",
          observedAt: {
            tick: 100 + runIndex,
          },
        }],
      };
    }

    const qualification = qualifyRuntimeExperiment(
      definition,
      [
        trial("c0", "control", 0, "absent"),
        trial("c1", "control", 1, "absent"),
        trial("t0", "treatment", 0, "present"),
        trial("t1", "treatment", 1, "present"),
      ],
    );

    expect(qualification).toMatchObject({
      state: "intervention-supported",
      expectedContrastMatches: [
        "target-chunk-ready",
      ],
      expectedContrastMismatches: [],
    });

    const proof = experimentQualificationCausalProof(
      qualification,
      definition,
    );

    expect(proof.interventionProvenance).toEqual([
      expect.objectContaining({
        interventionId: definition.id,
        predicateId: "target-chunk-ready",
        controlledFactorIds: [
          "ticking-area-enabled",
        ],
        controlledFactorContrasts: [{
          factorId: "ticking-area-enabled",
          controlValue: false,
          treatmentValue: true,
        }],
        controlState: "absent",
        treatmentState: "present",
        expectedContrastDisposition: "matched",
      }),
    ]);
  });

  it("publishes a valid guarded capability contract for chunk manipulation actions", () => {
    expect(
      validateRuntimeActionCapabilityRegistry(
        CHUNK_READINESS_CAPABILITY_REGISTRY,
      ),
    ).toEqual([]);

    expect(
      CHUNK_READINESS_CAPABILITY_REGISTRY.actions.map(
        (action) => action.id,
      ),
    ).toEqual([
      "chunk.position-loader-relative-to-target",
      "chunk.isolate-target-from-loaders",
      "chunk.set-temporary-ticking-area",
      "chunk.clear-temporary-ticking-area",
    ]);
  });

  it("keeps runtime proof conservative by requiring repeated trials by default", () => {
    expect(
      createTickingAreaChunkRecoveryExperiment(base)
        .minimumRunsPerArm,
    ).toBe(2);
    expect(
      createPlayerLoaderChunkReadinessExperiment({
        ...base,
        controlDistanceChunks: 12,
      }).minimumRunsPerArm,
    ).toBe(2);
  });
});
