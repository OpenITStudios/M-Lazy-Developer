import { describe, expect, it } from "vitest";
import {
  createEntityActiveRegionExperiment,
  createTickingAreaPolicyExperiment,
  createUnloadedDestinationExperiment,
} from "../../../src/domains/chunk/chunk-probe-experiments.js";
import { validateRuntimeExperimentDefinition } from "../../../src/index.js";

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
