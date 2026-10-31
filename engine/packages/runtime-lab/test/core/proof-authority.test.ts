// Synthetic trial records validate authority gating; they are not captured Minecraft runs.
import { describe, expect, it } from "vitest";
import {
  qualifyRuntimeExperiment,
  runtimeExperimentDefinitionRevision,
} from "../../src/index.js";

const definition = {
  schemaVersion: 1 as const,
  id: "authority-test",
  title: "Authority test",
  domain: "multiplayer" as const,
  requiredContext: "LIVE_MINECRAFT" as const,
  mutationRisk: "read-only" as const,
  targetProfileFingerprint: "target",
  fixtureFingerprint: "fixture",
  protocol: [{
    id: "observe",
    phase: "observe" as const,
    actionId: "probe.scoreboard-value",
    parameters: {
      objectiveId: "qa",
      participant: "result",
      predicate: "network-disconnect-observed",
    },
  }],
  factors: [],
  arms: [{
    id: "control",
    role: "control" as const,
    factorValues: {},
  }, {
    id: "treatment",
    role: "treatment" as const,
    factorValues: {},
  }],
  outcomePredicateIds: [
    "network-disconnect-observed",
  ],
  evidenceRequirements: [{
    id: "network-authority",
    predicateId:
      "network-disconnect-observed",
    state: "present" as const,
    minimumProofAuthority:
      "live-runtime" as const,
  }],
  minimumRunsPerArm: 1,
};

function trial(
  armId: "control" | "treatment",
  proofAuthority:
    "server-simulated" | "live-runtime",
) {
  return {
    schemaVersion: 1 as const,
    id: "trial:" + armId,
    identity: {
      experimentId: definition.id,
      definitionRevision:
        runtimeExperimentDefinitionRevision(
          definition,
        ),
      armId,
      runIndex: 0,
      targetProfileFingerprint:
        definition.targetProfileFingerprint,
      fixtureFingerprint:
        definition.fixtureFingerprint,
      environmentFingerprint:
        "environment",
    },
    status: "completed" as const,
    evidence: [{
      predicate:
        "network-disconnect-observed",
      state: "present" as const,
      confidence: "observed" as const,
      proofAuthority,
    }],
  };
}

describe("runtime evidence proof authority", () => {
  it("does not satisfy live-runtime requirements with server-simulated evidence", () => {
    const result =
      qualifyRuntimeExperiment(
        definition,
        [
          trial(
            "control",
            "server-simulated",
          ),
          trial(
            "treatment",
            "server-simulated",
          ),
        ],
      );

    expect(result.state).toBe("observed");
    expect(
      result.reasons.join(" "),
    ).toMatch(
      /supporting evidence requirement/i,
    );
  });

  it("accepts live-authority-labelled trial records at the qualification boundary", () => {
    const result =
      qualifyRuntimeExperiment(
        definition,
        [
          trial(
            "control",
            "live-runtime",
          ),
          trial(
            "treatment",
            "live-runtime",
          ),
        ],
      );

    expect(result.state).toBe("repeatable");
  });
});
