// Consolidated same-owner, same-feature, same-lane test family.
// Original cases/assertions preserved; this is NOT executed test proof.
import { describe, expect, it } from "vitest";
import { validateRuntimeExperimentCatalog, type RuntimeExperimentCatalog, CHUNK_READINESS_CAPABILITY_REGISTRY, createTickingAreaChunkRecoveryExperiment, preflightRuntimeExperimentCapabilities, type RuntimeActionCapabilityRegistry, experimentKnowledgeEvidence, type RuntimeExperimentDefinition, executeRuntimeExperimentCampaign, runtimeExperimentDefinitionRevision } from "../../src/index.js";

// Original suite: engine/packages/runtime-lab/test/experiment/catalog.test.ts (Git blob 52137be50643d345e3f843781de7e15ce22474f8)
{


const experiment = {
  schemaVersion: 1 as const,
  id: "exp:catalog",
  title: "Catalog fixture",
  domain: "scheduler" as const,
  requiredContext: "LIVE_MINECRAFT" as const,
  mutationRisk: "read-only" as const,
  targetProfileFingerprint: "profile-a",
  fixtureFingerprint: "fixture-a",
  protocol: [{
    id: "observe",
    phase: "observe" as const,
    actionId: "runtime.capture",
  }],
  factors: [{
    id: "mode",
    description: "fixture mode",
  }],
  arms: [{
    id: "control",
    role: "control" as const,
    factorValues: { mode: "control" },
  }, {
    id: "treatment",
    role: "treatment" as const,
    factorValues: { mode: "treatment" },
  }],
  outcomePredicateIds: ["outcome"],
  minimumRunsPerArm: 2,
};

describe("runtime experiment catalog", () => {
  it("rejects duplicate experiment identities", () => {
    const catalog: RuntimeExperimentCatalog = {
      schemaVersion: 1,
      experiments: [experiment, experiment],
    };
    expect(validateRuntimeExperimentCatalog(catalog).join(" "))
      .toMatch(/Duplicate runtime experiment id/);
  });

  it("keeps invalid controlled experiments out of the catalog", () => {
    const catalog: RuntimeExperimentCatalog = {
      schemaVersion: 1,
      experiments: [{
        ...experiment,
        arms: experiment.arms.map((arm) => ({
          ...arm,
          factorValues: { mode: "same" },
        })),
      }],
    };
    expect(validateRuntimeExperimentCatalog(catalog).join(" "))
      .toMatch(/must differ on at least one declared factor/);
  });
});
}

// Original suite: engine/packages/runtime-lab/test/experiment/experiment-capability-preflight.test.ts (Git blob 0ff45efc3351c3bdc9f287172110bcfc406b3749)
{


const definition =
  createTickingAreaChunkRecoveryExperiment({
    id: "exp:chunk-recovery",
    title: "Chunk recovery",
    targetProfileFingerprint: "profile-a",
    fixtureFingerprint: "fixture-a",
    target: {
      dimension: "minecraft:overworld",
      x: 128,
      y: 64,
      z: 128,
    },
  });

describe("runtime experiment capability preflight", () => {
  it("accepts the chunk recovery experiment when all required actions are announced", () => {
    const result = preflightRuntimeExperimentCapabilities(
      definition,
      CHUNK_READINESS_CAPABILITY_REGISTRY,
      "LIVE_MINECRAFT",
    );

    expect(result.ready).toBe(true);
    expect(result.requiredActionIds).toEqual([
      "chunk.clear-temporary-ticking-area",
      "chunk.isolate-target-from-loaders",
      "chunk.set-temporary-ticking-area",
    ]);
    expect(result.missingActionIds).toEqual([]);
    expect(result.validationErrors).toEqual([]);
  });

  it("fails closed before execution when a required chunk action is missing", () => {
    const incomplete: RuntimeActionCapabilityRegistry = {
      schemaVersion: 1,
      actions:
        CHUNK_READINESS_CAPABILITY_REGISTRY.actions.filter(
          (action) =>
            action.id !==
              "chunk.set-temporary-ticking-area",
        ),
    };

    const result = preflightRuntimeExperimentCapabilities(
      definition,
      incomplete,
      "LIVE_MINECRAFT",
    );

    expect(result.ready).toBe(false);
    expect(result.missingActionIds).toEqual([
      "chunk.set-temporary-ticking-area",
    ]);
    expect(result.reasons.join(" ")).toMatch(
      /Missing runtime experiment actions/,
    );
  });

  it("detects context mismatch before the experiment reaches the host", () => {
    const result = preflightRuntimeExperimentCapabilities(
      definition,
      CHUNK_READINESS_CAPABILITY_REGISTRY,
      "LOCAL_MINECRAFT",
    );

    expect(result.ready).toBe(false);
    expect(result.validationErrors.join(" ")).toMatch(
      /requires LIVE_MINECRAFT/,
    );
  });
});
}

// Original suite: engine/packages/runtime-lab/test/experiment/promotion.test.ts (Git blob b55d6b3a4834ba8e2c39351773ac28ee8bf315a2)
{


const definition: RuntimeExperimentDefinition = {
  schemaVersion: 1,
  id: "exp:knowledge",
  title: "Knowledge evidence fixture",
  domain: "compatibility",
  requiredContext: "LOCAL_MINECRAFT",
  mutationRisk: "read-only",
  targetProfileFingerprint: "profile-a",
  fixtureFingerprint: "fixture-a",
  protocol: [{
    id: "capture",
    phase: "observe",
    actionId: "runtime.capture",
  }],
  factors: [{ id: "version", description: "version" }],
  arms: [{
    id: "control",
    role: "control",
    factorValues: { version: 1 },
  }, {
    id: "treatment",
    role: "treatment",
    factorValues: { version: 2 },
  }],
  outcomePredicateIds: ["outcome"],
  minimumRunsPerArm: 2,
};

describe("runtime experiment knowledge evidence", () => {
  it("does not promote a single observed campaign", () => {
    expect(experimentKnowledgeEvidence(
      definition,
      {
        experimentId: definition.id,
        state: "observed",
        completedRunsByArm: { control: 1 },
        unknownOutcomes: 0,
        controlTreatmentContrastPredicates: [],
        evidenceIds: ["trial:a"],
        reasons: [],
      },
    )).toBeUndefined();
  });

  it("emits evidence metadata only after repeatability threshold", () => {
    expect(experimentKnowledgeEvidence(
      definition,
      {
        experimentId: definition.id,
        state: "intervention-supported",
        completedRunsByArm: {
          control: 2,
          treatment: 2,
        },
        unknownOutcomes: 0,
        controlTreatmentContrastPredicates: ["outcome"],
        evidenceIds: ["trial:a", "trial:b"],
        reasons: [],
      },
    )).toMatchObject({
      kind: "controlled-experiment",
      experimentId: definition.id,
      reproducibility: "repeatable",
      targetMatch: "exact",
    });
  });
});
}

// Original suite: engine/packages/runtime-lab/test/experiment/runner.test.ts (Git blob f791e0a8bff860fe27ea70e3a97adf5cc6528a6a)
{


const definition: RuntimeExperimentDefinition = {
  schemaVersion: 1,
  id: "exp:runner",
  title: "Runner fixture",
  domain: "chunks",
  requiredContext: "LIVE_MINECRAFT",
  mutationRisk: "read-only",
  targetProfileFingerprint: "profile-a",
  fixtureFingerprint: "fixture-a",
  protocol: [{
    id: "capture",
    phase: "observe",
    actionId: "chunk.capture",
  }],
  factors: [{ id: "probe", description: "probe" }],
  arms: [{
    id: "control",
    role: "control",
    factorValues: { probe: false },
  }, {
    id: "treatment",
    role: "treatment",
    factorValues: { probe: true },
  }],
  outcomePredicateIds: ["chunk-ready"],
  minimumRunsPerArm: 1,
};

describe("runtime experiment host boundary", () => {
  it("refuses a host below the required runtime context", async () => {
    await expect(executeRuntimeExperimentCampaign(
      definition,
      {
        context: "LOCAL_MINECRAFT",
        environmentFingerprint: "env-a",
        async executeTrial() {
          throw new Error("must not execute");
        },
      },
    )).rejects.toThrow(/requires LIVE_MINECRAFT/);
  });

  it("validates host trial identity rather than trusting the adapter", async () => {
    const result = await executeRuntimeExperimentCampaign(
      definition,
      {
        context: "LIVE_MINECRAFT",
        environmentFingerprint: "env-a",
        async executeTrial(_definition, identity) {
          return {
            schemaVersion: 1,
            id: "bad",
            identity: {
              ...identity,
              definitionRevision:
                runtimeExperimentDefinitionRevision({
                  ...definition,
                  title: "stale",
                }),
            },
            status: "completed",
            evidence: [{
              predicate: "chunk-ready",
              state: "present",
              confidence: "observed",
            }],
          };
        },
      },
    );

    expect(result.invalidTrialErrors.join(" "))
      .toMatch(/definition revision is stale/);
  });
});
}
