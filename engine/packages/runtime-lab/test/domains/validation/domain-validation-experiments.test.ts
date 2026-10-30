import { describe, expect, it } from "vitest";
import { validateRuntimeExperimentDefinition } from "../../../src/index.js";
import {createAiCompatibilityExperiment,createLootRuntimeExperiment,createPhysicsCompatibilityExperiment,createStateHandleValidityExperiment} from "../../../src/domains/validation/domain-validation-experiments.js";
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
import {createPlayerLifeOrderingExperiment,createEntityTickOrderingExperiment} from "../../../src/domains/ordering/event-ordering-validation-experiments.js";
import {createEffectStateExperiment,createHealthReconciliationExperiment} from "../../../src/domains/entity/entity-state-validation-experiments.js";
import {createSetBlockReadinessExperiment,createStructurePlacementExperiment} from "../../../src/domains/world/world-mutation-validation-experiments.js";
import {
  STATE_SYSTEM_VALIDATION_ACTION_CAPABILITIES,
  createInventoryValidityExperiment,
  createPlayerSessionValidityExperiment,
  createProfilerValidationExperiment,
  createSpatialValidationExperiment,
  createWorldStorageInspectionExperiment,
} from "../../../src/domains/validation/state-system-validation-experiments.js";

// Source-preserved test family: domain-validation-experiments.test.ts
{
const b={id:"d",title:"d",targetProfileFingerprint:"p",fixtureFingerprint:"f",objectiveId:"o",participant:"p"};
describe("domain validation experiments",()=>{it("builds valid domain families",()=>{for(const d of [createAiCompatibilityExperiment(b),createLootRuntimeExperiment(b),createPhysicsCompatibilityExperiment(b),createStateHandleValidityExperiment(b)])expect(validateRuntimeExperimentDefinition(d)).toEqual([]);});});
}
// Source-preserved test family: final-runtime-experiments.test.ts
{
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
}
// Source-preserved test family: ordering-entity-world.test.ts
{
const common={id:"x",title:"x",targetProfileFingerprint:"p",fixtureFingerprint:"f"};
describe("runtime validation batch",()=>{it("builds valid ordering/entity/world definitions",()=>{const e={...common,objectiveId:"o",participant:"p"};const w={...common,dimension:"overworld",x:0,y:64,z:0};for(const d of [createPlayerLifeOrderingExperiment(e),createEntityTickOrderingExperiment(e),createEffectStateExperiment(e),createHealthReconciliationExperiment(e),createSetBlockReadinessExperiment(w),createStructurePlacementExperiment(w)])expect(validateRuntimeExperimentDefinition(d)).toEqual([]);});});
}
// Source-preserved test family: state-system-validation-experiments.test.ts
{
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
}
