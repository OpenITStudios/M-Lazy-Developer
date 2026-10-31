// Source-preserving consolidation: original test cases remain in isolated lexical blocks.
import { describe, expect, it } from "vitest";
import { BEDROCK_RUNTIME_ACTION_CAPABILITY_REGISTRY, compareRequiredRuntimeActions, createAllArenaFinishStressExperiment, requiredBedrockActionCapabilities, validateRuntimeActionCapabilityRegistry, compareRuntimeActionRegistries, parseBedrockCapabilityAnnouncement, MULTIPLAYER_SESSION_ACTION_CAPABILITIES, compareHarnessCapabilities, extractHarnessCapabilities, BEDROCK_ACTION_PREFIX, BEDROCK_CAPABILITIES_PREFIX, BEDROCK_PROFILE_PREFIX, BEDROCK_PROBE_PREFIX, createBedrockHarnessExperimentHost, executeRuntimeExperimentCampaign, MULTIPLAYER_STRESS_CAPABILITY_REGISTRY } from "../../src/index.js";
import type { RuntimeActionCapabilityRegistry, BedrockHarnessChannel, BedrockHarnessWaitOptions, RuntimeExperimentDefinition } from "../../src/index.js";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { captureMinecraftRuntimeProfile } from "../../../runtime-profile/src/index.js";

// Consolidated suite from engine/packages/runtime-lab/test/host/bedrock-action-registry.test.ts
{
describe("canonical bedrock runtime action registry", () => {
  it("merges all runtime action families without conflicting ids", () => {
    expect(
      validateRuntimeActionCapabilityRegistry(
        BEDROCK_RUNTIME_ACTION_CAPABILITY_REGISTRY,
      ),
    ).toEqual([]);
    expect(
      BEDROCK_RUNTIME_ACTION_CAPABILITY_REGISTRY
        .actions.length,
    ).toBeGreaterThan(10);
  });

  it("derives only actions required by one experiment", () => {
    const definition =
      createAllArenaFinishStressExperiment({
        id: "finish",
        title: "finish",
        targetProfileFingerprint: "target",
        fixtureFingerprint: "fixture",
        objectiveId: "qa",
        participant: "result",
        arenas: [
          {
            arenaId: "arena-1",
            arenaGeneration: 1,
          },
          {
            arenaId: "arena-2",
            arenaGeneration: 1,
          },
        ],
        playerCountPerArena: 5,
      });

    const required =
      requiredBedrockActionCapabilities(
        definition,
      );

    expect(
      required.actions.map(
        (item) => item.id,
      ),
    ).toEqual([
      "multiplayer.cleanup-arena-stress-fixture",
      "multiplayer.execute-all-arena-finish-burst",
      "multiplayer.reset-arena-stress-fixture",
    ]);
  });

  it("accepts an announced superset when all required signatures match", () => {
    const required = {
      schemaVersion: 1 as const,
      actions:
        BEDROCK_RUNTIME_ACTION_CAPABILITY_REGISTRY
          .actions.slice(0, 1),
    };

    expect(
      compareRequiredRuntimeActions(
        required,
        BEDROCK_RUNTIME_ACTION_CAPABILITY_REGISTRY,
      ),
    ).toEqual([]);
  });
});
}

// Consolidated suite from engine/packages/runtime-lab/test/host/bedrock-capabilities.test.ts
{
const registry: RuntimeActionCapabilityRegistry = {
  schemaVersion: 1,
  actions: [{
    id: "test.join-arena",
    requiredContext: "LIVE_MINECRAFT",
    mutationRisk: "guarded",
    phases: ["stimulus"],
    requiredParameters: {
      arenaId: "string",
    },
  }],
};

describe("bedrock capability handshake", () => {
  it("parses a self-described runtime capability registry", () => {
    const announcement =
      parseBedrockCapabilityAnnouncement(
        JSON.stringify({
          schemaVersion: 1,
          requestId: "cap-1",
          runtimeTick: 42,
          registry,
        }),
      );

    expect(announcement.registry).toEqual(
      registry,
    );
  });

  it("detects drift between expected and runtime-announced capabilities", () => {
    const drifted: RuntimeActionCapabilityRegistry = {
      schemaVersion: 1,
      actions: [{
        ...registry.actions[0]!,
        mutationRisk: "mutating",
      }],
    };

    expect(
      compareRuntimeActionRegistries(
        registry,
        drifted,
      ).join(" "),
    ).toMatch(/do not match/);
  });
});
}

// Consolidated suite from engine/packages/runtime-lab/test/host/bedrock-harness-capability-parity.test.ts
{
describe("bedrock harness capability parity", () => {
  it("keeps runtime harness action signatures identical to the canonical registry", async () => {
    const source = await readFile(
      resolve(
        process.cwd(),
        "engine/runtime/bedrock-reliability-harness/scripts/action.js",
      ),
      "utf8",
    );

    const extracted = extractHarnessCapabilities(
      source,
      "engine/runtime/bedrock-reliability-harness/scripts/action.js",
      {
        spreadCapabilities: {
          SESSION_ACTION_CAPABILITIES:
            MULTIPLAYER_SESSION_ACTION_CAPABILITIES,
        },
      },
    );

    const parity = compareHarnessCapabilities(
      BEDROCK_RUNTIME_ACTION_CAPABILITY_REGISTRY,
      extracted,
    );

    expect(parity).toEqual({
      ok: true,
      missingInHarness: [],
      extraInHarness: [],
      signatureMismatches: [],
      unresolvedHarnessGroups: [],
      errors: [],
    });
  });
});
}

// Consolidated suite from engine/packages/runtime-lab/test/host/bedrock-host.test.ts
{
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
  // This unit harness acknowledges canonical actions without claiming
  // they were observed in a live Minecraft host.
  actions: MULTIPLAYER_STRESS_CAPABILITY_REGISTRY.actions.filter(
    (action) => action.id === "multiplayer.execute-all-arena-start-burst",
  ),
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
          actionId: "multiplayer.execute-all-arena-start-burst",
          parameters: {
            arenaIds: "a1,a2",
            arenaGenerations: "1,2",
            playerCountPerArena: 5,
            startOwnershipGuardEnabled: true,
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
          actionId: "multiplayer.execute-all-arena-start-burst",
          parameters: {
            arenaIds: "a1,a2",
            arenaGenerations: "1,2",
            playerCountPerArena: 5,
            startOwnershipGuardEnabled: true,
          },
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
}
