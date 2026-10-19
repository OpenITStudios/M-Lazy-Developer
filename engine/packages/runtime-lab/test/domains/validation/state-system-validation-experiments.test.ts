import { describe, expect, it } from "vitest";
import {
  STATE_SYSTEM_VALIDATION_ACTION_CAPABILITIES,
  createInventoryValidityExperiment,
  createPlayerSessionValidityExperiment,
  createProfilerValidationExperiment,
  createSpatialValidationExperiment,
  createWorldStorageInspectionExperiment,
} from "../../../src/domains/validation/state-system-validation-experiments.js";
import { validateRuntimeExperimentDefinition } from "../../../src/index.js";

const input = {
  id: "v",
  title: "v",
  targetProfileFingerprint: "p",
  fixtureFingerprint: "f",
  objectiveId: "o",
  participant: "p",
};

describe("state system validation", () => {
  it("builds five valid families", () => {
    const definitions = [
      createPlayerSessionValidityExperiment(input),
      createProfilerValidationExperiment(input),
      createSpatialValidationExperiment(input),
      createInventoryValidityExperiment(input),
      createWorldStorageInspectionExperiment(input),
    ];
    for (const definition of definitions) {
      expect(validateRuntimeExperimentDefinition(definition)).toEqual([]);
    }
  });

  it("uses observation-only protocol for read-only world storage", () => {
    const definition = createWorldStorageInspectionExperiment(input);
    expect(definition.mutationRisk).toBe("read-only");
    expect(definition.protocol.every((step) => step.phase === "observe")).toBe(true);
    expect(STATE_SYSTEM_VALIDATION_ACTION_CAPABILITIES.find((action) =>
      action.id === "state-system.storage")?.phases).toEqual(["observe"]);
    expect(createInventoryValidityExperiment(input).protocol.some((step) =>
      step.phase === "stimulus")).toBe(true);
  });
});
