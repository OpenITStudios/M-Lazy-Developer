import { describe, expect, it } from "vitest";
import {
  createRuntimeControlPlan,
  multiArenaCutsceneQueueScenario,
  serializeRuntimeControlAction,
  validateRuntimeControlPlan,
} from "../../src/index.js";

describe("runtime control protocol", () => {
  it("derives only executable session actions from a timed scenario", () => {
    const scenario = multiArenaCutsceneQueueScenario(1);
    const plan = createRuntimeControlPlan(scenario.id, scenario.actions);

    expect(validateRuntimeControlPlan(plan)).toEqual([]);
    expect(plan.actions.map((entry) => entry.action.kind)).toEqual([
      "assign",
      "assign",
      "start",
      "start",
    ]);
  });

  it("serializes one runtime action as a transport record", () => {
    const scenario = multiArenaCutsceneQueueScenario(0);
    const plan = createRuntimeControlPlan(scenario.id, scenario.actions);
    const record = serializeRuntimeControlAction(scenario.id, plan.actions[0]!);

    expect(record).toContain("[M-BEDROCK-CTRL]");
    expect(record).toContain('"scenarioId"');
    expect(record).toContain('"assign"');
  });
});
