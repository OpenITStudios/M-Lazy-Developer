import { describe, expect, it } from "vitest";
import {
  captureMinecraftRuntimeProfile,
} from "../../../runtime-profile/src/index.js";
import {
  BEDROCK_ACTION_PREFIX,
  BEDROCK_CAPABILITIES_PREFIX,
  BEDROCK_PROFILE_PREFIX,
  BEDROCK_PROBE_PREFIX,
  createBedrockHarnessExperimentHost,
  executeRuntimeExperimentCampaign,
  type BedrockHarnessChannel,
  type BedrockHarnessWaitOptions,
  type RuntimeActionCapabilityRegistry,
  type RuntimeExperimentDefinition,
} from "../../src/index.js";

// Provenance describes synthetic fixture configuration, never a claim that
// Minecraft was observed live by this test's fake harness.
const syntheticProfileEvidence = [{
  id: "fixture:bedrock-host-profile",
  kind: "configuration" as const,
  detail: "Synthetic Bedrock harness profile for unit testing only.",
}];

const targetProfile = captureMinecraftRuntimeProfile({
  schemaVersion: 2,
  product: {
    family: "bedrock-engine",
    edition: "bedrock-retail",
    version: "1.26.40",
  },
  host: "listen-server",
  scriptModules: {
    "@minecraft/server": {
      version: "2.9.0",
      track: "stable",
    },
  },
  experiments: [],
  inventory: {
    scriptModules: "complete",
    experiments: "unknown",
    worldSettings: "unknown",
    packs: "partial",
  },
}, { evidence: syntheticProfileEvidence });

const actionCapabilities: RuntimeActionCapabilityRegistry = {
  schemaVersion: 1,
  actions: [{
    id: "test.join-arena",
    requiredContext: "LIVE_MINECRAFT",
    mutationRisk: "mutating",
    phases: ["stimulus"],
    optionalParameters: {
      arenaId: "string",
    },
  }],
};

const definition: RuntimeExperimentDefinition = {
  schemaVersion: 1,
  id: "exp:chunk-ready",
  title: "Chunk readiness",
  domain: "chunks",
  requiredContext: "LIVE_MINECRAFT",
  mutationRisk: "read-only",
  targetProfileFingerprint:
    targetProfile.fingerprint,
  fixtureFingerprint: "fixture-a",
  protocol: [{
    id: "observe",
    phase: "observe",
    actionId: "probe.chunk-loaded",
    parameters: {
      dimension: "overworld",
      x: "$factor.x",
      y: 64,
      z: 0,
    },
  }],
  factors: [{
    id: "x",
    description: "Probe x coordinate.",
  }],
  arms: [{
    id: "control",
    role: "control",
    factorValues: { x: 0 },
  }, {
    id: "treatment",
    role: "treatment",
    factorValues: { x: 128 },
  }],
  outcomePredicateIds: ["chunk-ready"],
  minimumRunsPerArm: 1,
};

function fakeChannel(): BedrockHarnessChannel {
  const lines: string[] = [];
  let tick = 10;

  return {
    context: "LIVE_MINECRAFT",
    environmentFingerprint: "env-a",

    async sendScriptEvent(id, message) {
      const payload = JSON.parse(message);

      if (id === "m-bedrock:target-profile") {
        lines.push(
          BEDROCK_PROFILE_PREFIX +
            JSON.stringify({
              schemaVersion: 1,
              bindingId: payload.bindingId,
              runtimeTick: tick++,
              profile: payload.profile,
              binding: {
                source: "script-event",
                sessionBound: true,
              },
            }),
        );
        return;
      }

      if (id === "m-bedrock:capabilities") {
        lines.push(
          BEDROCK_CAPABILITIES_PREFIX +
            JSON.stringify({
              schemaVersion: 1,
              requestId: payload.requestId,
              runtimeTick: tick++,
              registry: actionCapabilities,
            }),
        );
        return;
      }

      if (id === "m-bedrock:action") {
        const actionTick = tick++;
        lines.push(
          BEDROCK_ACTION_PREFIX +
            JSON.stringify({
              schemaVersion: 1,
              requestId: payload.requestId,
              actionId: payload.actionId,
              runtimeTick: actionTick,
              ok: true,
              evidence: [{
                predicate: "action-marker",
                state: "present",
                confidence: "observed",
                observedAt: {
                  streamId: "fake-actions",
                  sequence: actionTick,
                  tick: actionTick,
                },
              }],
            }),
        );
        return;
      }

      if (id === "m-bedrock:probe") {
        const present =
          payload.query.location.x === 0;
        lines.push(
          BEDROCK_PROBE_PREFIX +
            JSON.stringify({
              schemaVersion: 1,
              requestId: payload.requestId,
              probeId: payload.probeId,
              runtimeTick: tick++,
              ok: true,
              state: present
                ? "present"
                : "absent",
              outcomeId: present
                ? payload.outcomeByState.present
                : payload.outcomeByState.absent,
              evidence: {
                predicate: payload.predicate,
                state: present
                  ? "present"
                  : "absent",
                confidence: "observed",
                observedAt: {
                  tick: tick - 1,
                },
              },
              value: present,
            }),
        );
        return;
      }

      throw new Error(
        "Unexpected script event: " + id,
      );
    },

    async waitForLine(
      options: BedrockHarnessWaitOptions,
    ) {
      const index = lines.findIndex(
        (line) =>
          line.startsWith(options.prefix) &&
          options.accept(line),
      );
      if (index < 0) {
        throw new Error(
          "Fake channel timed out.",
        );
      }
      return lines.splice(index, 1)[0]!;
    },
  };
}

describe("bedrock runtime experiment host", () => {
  it("executes read-only probe experiments through the harness protocol", async () => {
    const result =
      await executeRuntimeExperimentCampaign(
        definition,
        createBedrockHarnessExperimentHost({
          channel: fakeChannel(),
          targetProfile,
          actionCapabilities,
        }),
      );

    expect(result.invalidTrialErrors).toEqual([]);
    expect(
      result.trials.map((trial) => [
        trial.identity.armId,
        trial.status,
        trial.evidence[0]?.state,
      ]),
    ).toEqual([
      ["control", "completed", "present"],
      ["treatment", "completed", "absent"],
    ]);
  });

  it("refuses profile drift before executing probes", async () => {
    const drifted =
      captureMinecraftRuntimeProfile({
        ...targetProfile.profile,
        host: "client",
      }, { evidence: syntheticProfileEvidence });

    const host =
      createBedrockHarnessExperimentHost({
        channel: fakeChannel(),
        targetProfile: drifted,
      });

    await expect(
      host.executeTrial(
        definition,
        {
          experimentId: definition.id,
          definitionRevision: "unused",
          armId: "control",
          runIndex: 0,
          targetProfileFingerprint:
            definition.targetProfileFingerprint,
          fixtureFingerprint:
            definition.fixtureFingerprint,
          environmentFingerprint: "env-a",
        },
      ),
    ).rejects.toThrow(
      /target profile fingerprint does not match/,
    );
  });
});


describe("bedrock runtime mutating action protocol", () => {
  it("executes acknowledged stimulus actions before observation", async () => {
    const mutating: RuntimeExperimentDefinition = {
      ...definition,
      id: "exp:mutating-repro",
      title: "Mutating reproduction",
      domain: "multiplayer",
      mutationRisk: "mutating",
      protocol: [
        {
          id: "stimulus",
          phase: "stimulus",
          actionId: "test.join-arena",
          parameters: {
            arenaId: "a1",
          },
        },
        definition.protocol[0]!,
      ],
    };

    const result =
      await executeRuntimeExperimentCampaign(
        mutating,
        createBedrockHarnessExperimentHost({
          channel: fakeChannel(),
          targetProfile,
          actionCapabilities,
        }),
      );

    expect(result.invalidTrialErrors).toEqual([]);
    expect(
      result.trials.every(
        (trial) => trial.status === "completed",
      ),
    ).toBe(true);
    expect(result.trials[0]?.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          predicate: "action-marker",
          origin: "controlled-experiment",
          targetProfileFingerprint:
            targetProfile.fingerprint,
          provenanceKey: expect.stringContaining(
            "runtime-experiment:exp:mutating-repro",
          ),
          observedAt: expect.objectContaining({
            streamId: "fake-actions",
          }),
        }),
      ]),
    );
  });

  it("rejects mutating execution outside LIVE_MINECRAFT", async () => {
    const base = fakeChannel();
    const localChannel: BedrockHarnessChannel = {
      ...base,
      context: "LOCAL_MINECRAFT",
    };
    const mutating: RuntimeExperimentDefinition = {
      ...definition,
      id: "exp:mutating-local",
      mutationRisk: "mutating",
      protocol: [
        {
          id: "stimulus",
          phase: "stimulus",
          actionId: "test.join-arena",
        },
        definition.protocol[0]!,
      ],
    };

    await expect(
      executeRuntimeExperimentCampaign(
        mutating,
        createBedrockHarnessExperimentHost({
          channel: localChannel,
          targetProfile,
          actionCapabilities,
        }),
      ),
    ).rejects.toThrow(
      /requires LIVE_MINECRAFT but host provides LOCAL_MINECRAFT/,
    );
  });
});
