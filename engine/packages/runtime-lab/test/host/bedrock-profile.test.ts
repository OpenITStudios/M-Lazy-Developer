import { describe, expect, it } from "vitest";
import {
  BEDROCK_PROFILE_PREFIX,
  captureBedrockHarnessProfileLine,
  parseBedrockHarnessProfileAnnouncement,
} from "../../src/index.js";

const payload = {
  schemaVersion: 1,
  bindingId: "binding:1",
  runtimeTick: 42,
  profile: {
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
  },
  binding: {
    source: "script-event",
    sessionBound: true,
  },
};

describe("bedrock target profile adapter", () => {
  it("ignores unrelated runtime log lines", () => {
    expect(
      parseBedrockHarnessProfileAnnouncement(
        "[M-BEDROCK-OBS]{}",
      ),
    ).toBeUndefined();
  });

  it("captures a session-bound target profile", () => {
    const capture = captureBedrockHarnessProfileLine(
      BEDROCK_PROFILE_PREFIX + JSON.stringify(payload),
    );

    expect(capture).toMatchObject({
      schemaVersion: 1,
      profile: {
        host: "listen-server",
        product: {
          edition: "bedrock-retail",
          version: "1.26.40",
        },
      },
    });
    expect(capture?.fingerprint)
      .toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(capture?.evidence[0]?.id)
      .toContain("binding:1");
  });

  it("rejects announcements without correlation identity", () => {
    expect(() =>
      parseBedrockHarnessProfileAnnouncement(
        BEDROCK_PROFILE_PREFIX +
          JSON.stringify({
            ...payload,
            bindingId: "",
          }),
      )
    ).toThrow(/Invalid Bedrock runtime profile announcement/);
  });
});
