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


const domainInput = { id: "d", title: "d", targetProfileFingerprint: "p", fixtureFingerprint: "f", objectiveId: "o", participant: "p" };
const finalInput = { id: "f", title: "f", targetProfileFingerprint: "p", fixtureFingerprint: "w", objectiveId: "o", participant: "p" };
const orderingBase = { id: "x", title: "x", targetProfileFingerprint: "p", fixtureFingerprint: "f" };
const orderingInput = { ...orderingBase, objectiveId: "o", participant: "p" };
const worldInput = { ...orderingBase, dimension: "overworld", x: 0, y: 64, z: 0 };
const stateInput = { id: "v", title: "v", targetProfileFingerprint: "p", fixtureFingerprint: "f", objectiveId: "o", participant: "p" };

describe("runtime validation domain definition contracts", () => {
  it("validates the authored domain experiment families in one bounded matrix", () => {
    const definitions = [
      ["ai-compatibility", () => createAiCompatibilityExperiment(domainInput)],
      ["loot-runtime", () => createLootRuntimeExperiment(domainInput)],
      ["physics-compatibility", () => createPhysicsCompatibilityExperiment(domainInput)],
      ["state-handle", () => createStateHandleValidityExperiment(domainInput)],
      ["block-state", () => createBlockStateRuntimeExperiment(finalInput)],
      ["gametest", () => createGameTestRuntimeExperiment(finalInput)],
      ["command", () => createCommandRuntimeExperiment(finalInput)],
      ["hazard", () => createHazardRuntimeExperiment(finalInput)],
      ["education", () => createEducationRuntimeExperiment(finalInput)],
      ["observability", () => createObservabilityRuntimeExperiment(finalInput)],
      ["entity-special", () => createEntitySpecialRuntimeExperiment(finalInput)],
      ["watchdog", () => createWatchdogRuntimeExperiment(finalInput)],
      ["player-life-ordering", () => createPlayerLifeOrderingExperiment(orderingInput)],
      ["entity-tick-ordering", () => createEntityTickOrderingExperiment(orderingInput)],
      ["effect-state", () => createEffectStateExperiment(orderingInput)],
      ["health-reconciliation", () => createHealthReconciliationExperiment(orderingInput)],
      ["setblock-readiness", () => createSetBlockReadinessExperiment(worldInput)],
      ["structure-placement", () => createStructurePlacementExperiment(worldInput)],
      ["player-session", () => createPlayerSessionValidityExperiment(stateInput)],
      ["profiler", () => createProfilerValidationExperiment(stateInput)],
      ["spatial", () => createSpatialValidationExperiment(stateInput)],
      ["inventory", () => createInventoryValidityExperiment(stateInput)],
      ["world-storage", () => createWorldStorageInspectionExperiment(stateInput)],
    ] as const;
    const failures = definitions.flatMap(([label, build]) => {
      try {
        return validateRuntimeExperimentDefinition(build())
          .map(issue => label + ": " + issue);
      } catch (error) {
        return [label + ": " + String(error)];
      }
    });
    expect(failures).toEqual([]);
  });


  it("observes rather than mutates in the read-only observability experiment", () => {
    const definition = createObservabilityRuntimeExperiment(finalInput);
    expect(definition.mutationRisk).toBe("read-only");
    expect(definition.protocol.every((step) => step.phase === "observe")).toBe(true);
    expect(FINAL_RUNTIME_ACTION_CAPABILITIES.find((action) =>
      action.id === "final.observability")?.phases).toEqual(["observe"]);
    expect(createBlockStateRuntimeExperiment(finalInput).protocol.some((step) =>
      step.phase === "stimulus")).toBe(true);
  });

  it("uses observation-only protocol for read-only world storage", () => {
    const definition = createWorldStorageInspectionExperiment(stateInput);
    expect(definition.mutationRisk).toBe("read-only");
    expect(definition.protocol.every((step) => step.phase === "observe")).toBe(true);
    expect(STATE_SYSTEM_VALIDATION_ACTION_CAPABILITIES.find((action) =>
      action.id === "state-system.storage")?.phases).toEqual(["observe"]);
    expect(createInventoryValidityExperiment(stateInput).protocol.some((step) =>
      step.phase === "stimulus")).toBe(true);
  });
});
