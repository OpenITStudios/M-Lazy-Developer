import { describe, expect, it } from "vitest";
import { evaluateCapability } from "../src/engine.js";
import { classifyScriptApiVersion } from "../src/script-api.js";
import { parseGameVersion } from "../src/version.js";
import { CORE_CAPABILITY_RULES } from "../../../rules/capabilities/core.js";
import {
  deriveEducationProfile,
  requireEducationFeatures,
} from "../src/index.js";
import {
  capabilityQueryFromRuntimeProfile,
} from "../src/index.js";
import type {
  MinecraftRuntimeProfile,
} from "../../runtime-profile/src/index.js";

// Original coverage: compatibility.test.ts
describe("compatibility", () => {
  it("parses array and semantic string game versions", () => {
    expect(parseGameVersion([1, 21, 40])).toEqual({ major: 1, minor: 21, patch: 40 });
    expect(parseGameVersion("1.21.40")).toEqual({ major: 1, minor: 21, patch: 40 });
  });

  it("classifies beta Script API versions", () => {
    expect(classifyScriptApiVersion("@minecraft/server", "2.0.0-beta").track).toBe("beta");
  });

  it("requires Beta APIs experiment for beta Script API capability", () => {
    const withoutExperiment = evaluateCapability(
      CORE_CAPABILITY_RULES["script-api.beta"] ?? [],
      { edition: "bedrock" },
    );

    const withExperiment = evaluateCapability(
      CORE_CAPABILITY_RULES["script-api.beta"] ?? [],
      { edition: "bedrock", experiments: ["Beta APIs"] },
    );

    expect(withoutExperiment.supported).toBe(false);
    expect(withExperiment.supported).toBe(true);
  });
});

// Original coverage: education.test.ts
describe("Education capability profile", () => {
  it("treats Minecraft Education edition as Education-feature capable", () => {
    const profile = deriveEducationProfile({
      edition: "education",
    });

    expect(profile.educationFeatures).toBe("enabled");
    expect(requireEducationFeatures(profile).supported).toBe(true);
  });

  it("allows Bedrock worlds to explicitly enable Education features", () => {
    const profile = deriveEducationProfile({
      edition: "bedrock",
      worldEducationFeatures: true,
      eduLevel: 1,
    });

    expect(profile.educationFeatures).toBe("enabled");
    expect(profile.eduLevel).toBe(1);
  });

  it("preserves unknown edition without assuming Bedrock", () => {
    const profile = deriveEducationProfile({
      edition: "unknown",
    });

    expect(profile.edition).toBe("unknown");
    expect(profile.educationFeatures).toBe("unknown");
    expect(requireEducationFeatures(profile).supported).toBe("unknown");
  });

  it("does not treat manifest education metadata as proof that world features are enabled", () => {
    const profile = deriveEducationProfile({
      edition: "bedrock",
      manifestEducationMetadata: true,
    });

    expect(profile.educationFeatures).toBe("unknown");
    expect(profile.manifestEducationMetadata).toBe(true);
  });
});

// Original coverage: runtime-profile.test.ts
describe("runtime profile compatibility bridge", () => {
  it("maps richer runtime identity into the legacy capability engine without losing edition", () => {
    const profile: MinecraftRuntimeProfile = {
      schemaVersion: 2,
      product: {
        family: "bedrock-engine",
        edition: "education",
        version: "1.26.32",
      },
      host: "education-host",
      scriptModules: {},
      experiments: ["Beta APIs"],
      inventory: {
        scriptModules: "unknown",
        experiments: "complete",
        worldSettings: "unknown",
        packs: "unknown",
      },
    };

    expect(capabilityQueryFromRuntimeProfile(profile)).toEqual({
      edition: "education",
      gameVersion: {
        major: 1,
        minor: 26,
        patch: 32,
      },
      experiments: ["Beta APIs"],
    });
  });
});

