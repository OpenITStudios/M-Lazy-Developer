import { describe, expect, it } from "vitest";
import {
  captureMinecraftRuntimeProfile,
  compareDottedNumericVersions,
  compareScriptSemver,
  exportCapturedMinecraftRuntimeProfile,
  runtimeProfileFingerprint,
  validateMinecraftRuntimeProfile,
  type MinecraftRuntimeProfile,
} from "../src/index.js";

const profile: MinecraftRuntimeProfile = {
  schemaVersion: 2,
  product: {
    family: "bedrock-engine",
    edition: "education",
    version: "1.26.32",
  },
  host: "education-host",
  scriptModules: {
    "@minecraft/server": {
      version: "2.9.0",
      track: "stable",
    },
  },
  experiments: [],
  inventory: {
    scriptModules: "complete",
    experiments: "complete",
    worldSettings: "partial",
    packs: "partial",
  },
};

describe("runtime profile", () => {
  it("separates dotted product versions from Script API semver", () => {
    expect(compareDottedNumericVersions("1.26.32", "1.26.40")).toBe(-1);
    expect(compareScriptSemver("2.9.0", "2.9.0-beta.1")).toBe(1);
    expect(compareScriptSemver("2.10.0-beta.2", "2.10.0-beta.10")).toBe(-1);
  });

  it("validates an exact runtime identity independently from capability rules", () => {
    expect(validateMinecraftRuntimeProfile(profile)).toEqual([]);
  });

  it("rejects malformed module semver without guessing", () => {
    expect(validateMinecraftRuntimeProfile({
      ...profile,
      scriptModules: {
        "@minecraft/server": {
          version: "latest",
          track: "unknown",
        },
      },
    })).toContain(
      "Runtime profile script module version must be valid semver: @minecraft/server",
    );
  });

  it("fingerprints stable target identity without volatile player count", () => {
    const left = runtimeProfileFingerprint({
      ...profile,
      runtime: {
        playerCount: 1,
        platform: "win32",
      },
    });
    const right = runtimeProfileFingerprint({
      ...profile,
      runtime: {
        playerCount: 5,
        platform: "win32",
      },
    });
    expect(left).toBe(right);
    expect(left).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("changes the fingerprint when target identity changes", () => {
    expect(runtimeProfileFingerprint(profile)).not.toBe(
      runtimeProfileFingerprint({
        ...profile,
        host: "client",
      }),
    );
  });

  it("exports a capture only when its fingerprint still matches", () => {
    const capture = captureMinecraftRuntimeProfile(
      profile,
      {
        evidence: [{
          id: "fixture",
          kind: "configuration",
        }],
      },
    );

    expect(
      JSON.parse(
        exportCapturedMinecraftRuntimeProfile(capture),
      ).fingerprint,
    ).toBe(capture.fingerprint);

    expect(() =>
      exportCapturedMinecraftRuntimeProfile({
        ...capture,
        fingerprint: "sha256:stale",
      })
    ).toThrow(/fingerprint does not match/);
  });
});
