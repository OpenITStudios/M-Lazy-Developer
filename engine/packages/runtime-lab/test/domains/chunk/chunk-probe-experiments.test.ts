// Consolidated same-directory source test suites; assertions retained unchanged.
import { describe } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { chunkKnowledgeValidationCoverage } from "../../../src/domains/chunk/chunk-knowledge-validation-plan.js";
import { chunkKnowledgeValidationPlans } from "../../../src/domains/chunk/chunk-knowledge-validation-plan.js";
import { createAreaLoadedSchedulerExperiment } from "../../../src/domains/chunk/chunk-lifecycle-experiments.js";
import { createDimensionGeometryExperiment } from "../../../src/domains/chunk/chunk-lifecycle-experiments.js";
import { createEntityPersistenceLifecycleExperiment } from "../../../src/domains/chunk/chunk-lifecycle-experiments.js";
import { createSimulationBoundaryExperiment } from "../../../src/domains/chunk/chunk-lifecycle-experiments.js";
import { validateRuntimeExperimentDefinition } from "../../../src/index.js";
import { createEntityActiveRegionExperiment } from "../../../src/domains/chunk/chunk-probe-experiments.js";
import { createTickingAreaPolicyExperiment } from "../../../src/domains/chunk/chunk-probe-experiments.js";
import { createUnloadedDestinationExperiment } from "../../../src/domains/chunk/chunk-probe-experiments.js";
import { createScriptTickingAreaManagerExperiment } from "../../../src/domains/chunk/script-ticking-area-experiment.js";

// Original suite engine/packages/runtime-lab/test/domains/chunk/chunk-knowledge-validation-plan.test.ts, blob 0cb65c79b85006edd493af63c6c7c605992182b8
{
describe("chunk knowledge validation plan", () => {
  it("keeps experiment-ready and probe-required knowledge distinct", () => {
    const plans = chunkKnowledgeValidationPlans();
    expect(plans.find((p) => p.knowledgeId === "chunks.dimension-is-chunk-loaded"))
      .toMatchObject({ status: "experiment-ready", existingExperiment: "player-loader-chunk-readiness" });
    // Only implemented experiment IDs can be marked immediately runnable.
    expect(plans.find((p) => p.knowledgeId === "chunks.chunk-size-horizontal"))
      .toMatchObject({ status: "probe-required", existingExperiment: null });
    expect(plans.every((p) => p.existingExperiment === null
      ? p.status === "probe-required"
      : p.status === "experiment-ready")).toBe(true);
    expect(plans.find((p) => p.knowledgeId === "chunks.tickingarea-limits"))
      .toMatchObject({ status: "probe-required" });
  });

  it("reports missing knowledge instead of silently routing it", () => {
    const report = chunkKnowledgeValidationCoverage([
      "chunks.dimension-is-chunk-loaded",
      "chunks.unknown",
    ]);
    expect(report).toMatchObject({ total: 2, planned: 1, missing: ["chunks.unknown"] });
  });
});
}

// Original suite engine/packages/runtime-lab/test/domains/chunk/chunk-lifecycle-experiments.test.ts, blob 25b1937183a4e5023533dcbd229688887248adb9
{
const base = {
  id: "fixture",
  title: "fixture",
  targetProfileFingerprint: "profile",
  fixtureFingerprint: "world",
  dimension: "overworld",
  x: 0, y: 64, z: 0,
};

describe("chunk lifecycle experiments", () => {
  it("builds valid geometry, simulation, scheduler and persistence definitions", () => {
    const definitions = [
      createDimensionGeometryExperiment(base),
      createSimulationBoundaryExperiment({
        ...base, controlDistanceChunks: 12, treatmentDistanceChunks: 1,
      }),
      createAreaLoadedSchedulerExperiment(base),
      createEntityPersistenceLifecycleExperiment({
        ...base, entityKey: "fixture:entity",
      }),
    ];
    for (const definition of definitions) {
      expect(validateRuntimeExperimentDefinition(definition)).toEqual([]);
    }
  });
});
}

// Original suite engine/packages/runtime-lab/test/domains/chunk/chunk-probe-experiments.test.ts, blob c0377dbc45a6a120f47296037d5dbbc55ab2b043
{
const base = {
  id: "fixture",
  title: "fixture",
  targetProfileFingerprint: "profile",
  fixtureFingerprint: "world",
  target: { dimension: "overworld", x: 0, y: 64, z: 0 },
};

describe("chunk probe experiments", () => {
  it("builds valid ticking-area policy experiments", () => {
    const definition = createTickingAreaPolicyExperiment({
      ...base,
      controlCommand: "tickingarea list",
      treatmentCommand: "tickingarea add circle 0 64 0 1 m_test",
      predicate: "ticking-area-policy-observed",
    });
    expect(validateRuntimeExperimentDefinition(definition)).toEqual([]);
    expect(definition.protocol.filter(step => step.phase === "observe"))
      .toMatchObject([{ id: "observe-ticking-area-policy",
        actionId: "probe.command-result" }]);
    expect(definition.protocol[1]?.parameters?.["command"])
      .toBe("tickingarea list");
  });

  it("builds valid unloaded destination experiments with teardown", () => {
    const definition = createUnloadedDestinationExperiment({
      ...base,
      entityId: "subject",
      operationCommand: "tp @e[tag=subject,c=1] 0 64 0",
      outcomePredicate: "teleport-destination-outcome",
    });
    expect(validateRuntimeExperimentDefinition(definition)).toEqual([]);
    expect(definition.protocol.at(-1)?.phase).toBe("teardown");
  });

  it("builds valid entity active-region experiments", () => {
    const definition = createEntityActiveRegionExperiment({
      ...base,
      entityId: "subject",
      moveOutCommand: "tp @e[tag=subject,c=1] 512 64 512",
    });
    expect(validateRuntimeExperimentDefinition(definition)).toEqual([]);
  });
});
}

// Original suite engine/packages/runtime-lab/test/domains/chunk/script-ticking-area-experiment.test.ts, blob cf3e11f0f4c4f6eed32d2acc20f15f84da2ec823
{
describe("script ticking-area experiment", () => {
  it("uses dedicated Script API fixture actions and teardown", () => {
    const definition = createScriptTickingAreaManagerExperiment({
      id: "script-area",
      title: "Script area",
      targetProfileFingerprint: "profile",
      fixtureFingerprint: "fixture",
      packId: "pack-a",
      areaName: "m_test",
      dimension: "overworld",
      x: 0, y: 64, z: 0,
    });
    expect(validateRuntimeExperimentDefinition(definition)).toEqual([]);
    expect(definition.protocol[0]?.actionId).toBe("chunk.script-ticking-area-create");
    expect(definition.protocol.at(-1)?.phase).toBe("teardown");
  });
});
}
