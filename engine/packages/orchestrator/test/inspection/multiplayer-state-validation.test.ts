import { describe, expect, it } from "vitest";
import {
  deriveMultiplayerStateValidationPlan,
} from "../../src/inspection/multiplayer-state-validation.js";
import type {
  GameplayIntentModel,
} from "../../../gameplay-intent/src/index.js";

describe("multiplayer state validation", () => {
  it("generates only relevant mixed-state scenarios", () => {
    const model: GameplayIntentModel = {
      schemaVersion: 1,
      id: "mixed-player",
      evidence: [],
      nodes: [
        {
          id: "role:team",
          kind: "role",
          label: "Team",
          status: "authored",
          evidenceIds: [],
        },
        {
          id: "lifecycle:respawn",
          kind: "lifecycle",
          label: "Respawn",
          status: "authored",
          evidenceIds: [],
        },
        {
          id: "lifecycle:reconnect",
          kind: "lifecycle",
          label: "Reconnect",
          status: "authored",
          evidenceIds: [],
        },
        {
          id: "role:spectator",
          kind: "role",
          label: "Spectator",
          status: "authored",
          evidenceIds: [],
        },
      ],
      edges: [],
      invariants: [],
      unknowns: [],
    };

    const plan =
      deriveMultiplayerStateValidationPlan(
        model,
      );

    expect(plan.applicable).toBe(true);
    expect(
      plan.scenarios.map((item) => item.id),
    ).toEqual(
      expect.arrayContaining([
        "mixed:active-respawning",
        "mixed:active-reconnecting",
        "mixed:active-spectator",
      ]),
    );
  });
});
