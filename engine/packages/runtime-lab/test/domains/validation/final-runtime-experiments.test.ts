import { describe, expect, it } from "vitest";
import {
  FINAL_RUNTIME_ACTION_CAPABILITIES,
  createBlockStateRuntimeExperiment,
  createCommandRuntimeExperiment,
  createEducationRuntimeExperiment,
  createEntitySpecialRuntimeExperiment,
  createGameTestRuntimeExperiment,
  createHazardRuntimeExperiment,
  createObservabilityRuntimeExperiment,
  createWatchdogRuntimeExperiment,
} from "../../../src/domains/validation/final-runtime-experiments.js";
import { validateRuntimeExperimentDefinition } from "../../../src/index.js";

const input = {
  id: "f",
  title: "f",
  targetProfileFingerprint: "p",
  fixtureFingerprint: "w",
  objectiveId: "o",
  participant: "p",
};

describe("final runtime frontier", () => {
  it("builds valid final families", () => {
    const definitions = [
      createBlockStateRuntimeExperiment(input),
      createGameTestRuntimeExperiment(input),
      createCommandRuntimeExperiment(input),
      createHazardRuntimeExperiment(input),
      createEducationRuntimeExperiment(input),
      createObservabilityRuntimeExperiment(input),
      createEntitySpecialRuntimeExperiment(input),
      createWatchdogRuntimeExperiment(input),
    ];
    for (const definition of definitions) {
      expect(validateRuntimeExperimentDefinition(definition)).toEqual([]);
    }
  });

  it("observes rather than mutates in the read-only observability experiment", () => {
    const definition = createObservabilityRuntimeExperiment(input);
    expect(definition.mutationRisk).toBe("read-only");
    expect(definition.protocol.every((step) => step.phase === "observe")).toBe(true);
    expect(FINAL_RUNTIME_ACTION_CAPABILITIES.find((action) =>
      action.id === "final.observability")?.phases).toEqual(["observe"]);
    expect(createBlockStateRuntimeExperiment(input).protocol.some((step) =>
      step.phase === "stimulus")).toBe(true);
  });
});
