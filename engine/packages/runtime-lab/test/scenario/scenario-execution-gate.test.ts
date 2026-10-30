// Cohesive family source consolidation. Original cases, assertions and lexical scopes retained; not executed.
import { describe } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import type { CounterexampleScenario } from "../../src/index.js";
import type { RuntimeActionCapabilityRegistry } from "../../src/index.js";
import { planCounterexampleScenarioRequirements } from "../../src/index.js";
import { vi } from "vitest";
import { assertCounterexampleScenarioReady } from "../../src/index.js";
import { executeCounterexampleScenarioWithGate } from "../../src/index.js";

// Original suite engine/packages/runtime-lab/test/scenario/scenario-requirements.test.ts, blob cbe7d289353558e85a60d21abc26f964e3cfd219
{




function scenario(
  bound: boolean,
): CounterexampleScenario {
  return {
    schemaVersion: 1,
    id: bound ? "bound" : "manual",
    modelId: "m",
    queryId: "q",
    runtimeStatus:
      bound ? "runtime-bound" : "runtime-unbound",
    steps: [{
      index: 1,
      transitionId: "join",
      transitionOwner: "player",
      instruction: "Join arena.",
      ...(bound
        ? {
            runtimeBinding: {
              transitionId: "join",
              actionId: "test.join-arena",
              phase: "stimulus",
              parameters: {
                arenaId: "a1",
                playerId: "p1",
              },
            },
          }
        : {}),
    }],
    assertion: {
      queryId: "q",
      instruction: "Check invariant.",
      ...(bound
        ? {
            runtimeBinding: {
              actionId: "probe.scoreboard-value",
              parameters: {
                objectiveId: "members",
                participant: "a1",
              },
            },
          }
        : {}),
    },
    ...(bound
      ? {
          runtimeProtocol: [{
            id: "repro-01",
            phase: "stimulus",
            actionId: "test.join-arena",
            parameters: {
              arenaId: "a1",
              playerId: "p1",
            },
          }, {
            id: "assert-counterexample",
            phase: "observe",
            actionId: "probe.scoreboard-value",
            parameters: {
              objectiveId: "members",
              participant: "a1",
            },
          }],
        }
      : {}),
    replayTrace: [],
  };
}

const capabilities: RuntimeActionCapabilityRegistry = {
  schemaVersion: 1,
  actions: [{
    id: "test.join-arena",
    requiredContext: "LIVE_MINECRAFT",
    mutationRisk: "guarded",
    phases: ["stimulus"],
    requiredParameters: {
      arenaId: "string",
      playerId: "string",
    },
  }, {
    id: "probe.scoreboard-value",
    requiredContext: "LOCAL_MINECRAFT",
    mutationRisk: "read-only",
    phases: ["observe"],
    requiredParameters: {
      objectiveId: "string",
      participant: "string",
    },
  }],
};

describe("scenario requirement planner", () => {
  it("marks a fully supported bound scenario ready", () => {
    const plan =
      planCounterexampleScenarioRequirements({
        scenario: scenario(true),
        announcedCapabilities: capabilities,
        context: "LIVE_MINECRAFT",
        mutationRisk: "guarded",
        runtimeProfileMatches: true,
      });

    expect(plan.readiness).toBe(
      "READY_TO_EXECUTE",
    );
    expect(plan.missingActionIds).toEqual([]);
    expect(plan.requiredActions.map(
      (item) => item.actionId,
    )).toEqual([
      "probe.scoreboard-value",
      "test.join-arena",
    ]);
  });

  it("reports a missing runtime capability before execution", () => {
    const plan =
      planCounterexampleScenarioRequirements({
        scenario: scenario(true),
        announcedCapabilities: {
          schemaVersion: 1,
          actions: [],
        },
        context: "LIVE_MINECRAFT",
        mutationRisk: "guarded",
        runtimeProfileMatches: true,
      });

    expect(plan.readiness).toBe(
      "CAPABILITY_GAP",
    );
    expect(plan.missingActionIds).toEqual([
      "probe.scoreboard-value",
      "test.join-arena",
    ]);
  });

  it("reports a missing observation capability before execution", () => {
    const stimulusOnly:
      RuntimeActionCapabilityRegistry = {
        schemaVersion: 1,
        actions: [
          capabilities.actions[0]!,
        ],
      };

    const plan =
      planCounterexampleScenarioRequirements({
        scenario: scenario(true),
        announcedCapabilities: stimulusOnly,
        context: "LIVE_MINECRAFT",
        mutationRisk: "guarded",
        runtimeProfileMatches: true,
      });

    expect(plan.readiness).toBe(
      "CAPABILITY_GAP",
    );
    expect(plan.missingActionIds).toEqual([
      "probe.scoreboard-value",
    ]);
  });

  it("routes unbound scenarios to manual QA", () => {
    const plan =
      planCounterexampleScenarioRequirements({
        scenario: scenario(false),
        announcedCapabilities: capabilities,
        context: "LIVE_MINECRAFT",
        mutationRisk: "guarded",
        runtimeProfileMatches: true,
      });

    expect(plan.readiness).toBe(
      "REQUIRES_MANUAL_QA",
    );
  });

  it("reports runtime profile mismatch before capability checks", () => {
    const plan =
      planCounterexampleScenarioRequirements({
        scenario: scenario(true),
        announcedCapabilities: capabilities,
        context: "LIVE_MINECRAFT",
        mutationRisk: "guarded",
        runtimeProfileMatches: false,
      });

    expect(plan.readiness).toBe(
      "RUNTIME_PROFILE_MISMATCH",
    );
  });

  it("reports parameter incompatibility as a capability gap", () => {
    const broken = scenario(true);
    const invalid: CounterexampleScenario = {
      ...broken,
      steps: [{
        ...broken.steps[0]!,
        runtimeBinding: {
          transitionId: "join",
          actionId: "test.join-arena",
          phase: "stimulus",
          parameters: {
            arenaId: 1,
            playerId: "p1",
          },
        },
      }],
    };

    const plan =
      planCounterexampleScenarioRequirements({
        scenario: invalid,
        announcedCapabilities: capabilities,
        context: "LIVE_MINECRAFT",
        mutationRisk: "guarded",
        runtimeProfileMatches: true,
      });

    expect(plan.readiness).toBe(
      "CAPABILITY_GAP",
    );
    expect(
      plan.validationErrors.join(" "),
    ).toMatch(/arenaId must be string/);
  });
});

}

// Original suite engine/packages/runtime-lab/test/scenario/scenario-execution-gate.test.ts, blob 4051f137e672831dbacd969ce0340639ac93a4bc
{




const scenario: CounterexampleScenario = {
  schemaVersion: 1,
  id: "gated",
  modelId: "m",
  queryId: "q",
  runtimeStatus: "runtime-bound",
  steps: [{
    index: 1,
    transitionId: "join",
    transitionOwner: "player",
    instruction: "Join arena.",
    runtimeBinding: {
      transitionId: "join",
      actionId: "test.join-arena",
      phase: "stimulus",
      parameters: {
        arenaId: "a1",
        playerId: "p1",
      },
    },
  }],
  assertion: {
    queryId: "q",
    instruction: "Check invariant.",
    runtimeBinding: {
      actionId: "probe.scoreboard-value",
      parameters: {
        objectiveId: "members",
        participant: "a1",
      },
    },
  },
  runtimeProtocol: [{
    id: "repro-01",
    phase: "stimulus",
    actionId: "test.join-arena",
    parameters: {
      arenaId: "a1",
      playerId: "p1",
    },
  }, {
    id: "assert-counterexample",
    phase: "observe",
    actionId: "probe.scoreboard-value",
    parameters: {
      objectiveId: "members",
      participant: "a1",
    },
  }],
  replayTrace: [],
};

const capabilities: RuntimeActionCapabilityRegistry = {
  schemaVersion: 1,
  actions: [{
    id: "test.join-arena",
    requiredContext: "LIVE_MINECRAFT",
    mutationRisk: "guarded",
    phases: ["stimulus"],
    requiredParameters: {
      arenaId: "string",
      playerId: "string",
    },
  }, {
    id: "probe.scoreboard-value",
    requiredContext: "LOCAL_MINECRAFT",
    mutationRisk: "read-only",
    phases: ["observe"],
    requiredParameters: {
      objectiveId: "string",
      participant: "string",
    },
  }],
};

describe("counterexample scenario execution gate", () => {
  it("executes only when preflight is READY_TO_EXECUTE", async () => {
    const execute = vi.fn(async () => ({
      ok: true,
    }));

    const result =
      await executeCounterexampleScenarioWithGate(
        {
          scenario,
          announcedCapabilities: capabilities,
          context: "LIVE_MINECRAFT",
          mutationRisk: "guarded",
          runtimeProfileMatches: true,
        },
        { execute },
      );

    expect(result.status).toBe("executed");
    expect(result.plan.readiness).toBe(
      "READY_TO_EXECUTE",
    );
    expect(execute).toHaveBeenCalledTimes(1);
    expect(result.result).toEqual({ ok: true });
  });

  it("blocks before executor invocation on capability gaps", async () => {
    const execute = vi.fn(async () => ({
      ok: true,
    }));

    const result =
      await executeCounterexampleScenarioWithGate(
        {
          scenario,
          announcedCapabilities: {
            schemaVersion: 1,
            actions: [],
          },
          context: "LIVE_MINECRAFT",
          mutationRisk: "guarded",
          runtimeProfileMatches: true,
        },
        { execute },
      );

    expect(result.status).toBe("blocked");
    expect(result.plan.readiness).toBe(
      "CAPABILITY_GAP",
    );
    expect(execute).not.toHaveBeenCalled();
  });

  it("blocks before executor invocation when assertion observation capability is missing", async () => {
    const execute = vi.fn(async () => ({
      ok: true,
    }));

    const result =
      await executeCounterexampleScenarioWithGate(
        {
          scenario,
          announcedCapabilities: {
            schemaVersion: 1,
            actions: [
              capabilities.actions[0]!,
            ],
          },
          context: "LIVE_MINECRAFT",
          mutationRisk: "guarded",
          runtimeProfileMatches: true,
        },
        { execute },
      );

    expect(result.status).toBe("blocked");
    expect(result.plan.readiness).toBe(
      "CAPABILITY_GAP",
    );
    expect(result.plan.missingActionIds).toEqual([
      "probe.scoreboard-value",
    ]);
    expect(execute).not.toHaveBeenCalled();
  });

  it("blocks profile mismatch before executor invocation", async () => {
    const execute = vi.fn(async () => true);

    const result =
      await executeCounterexampleScenarioWithGate(
        {
          scenario,
          announcedCapabilities: capabilities,
          context: "LIVE_MINECRAFT",
          mutationRisk: "guarded",
          runtimeProfileMatches: false,
        },
        { execute },
      );

    expect(result.status).toBe("blocked");
    expect(result.plan.readiness).toBe(
      "RUNTIME_PROFILE_MISMATCH",
    );
    expect(execute).not.toHaveBeenCalled();
  });

  it("produces a structured blocking error when strict readiness is required", () => {
    expect(() =>
      assertCounterexampleScenarioReady({
        scenarioId: "gated",
        readiness: "CAPABILITY_GAP",
        requiredActions: [],
        missingActionIds: ["test.join-arena"],
        validationErrors: [],
        reasons: ["Missing runtime actions."],
      })
    ).toThrow(
      /CAPABILITY_GAP.*test\.join-arena/,
    );
  });
});

}
