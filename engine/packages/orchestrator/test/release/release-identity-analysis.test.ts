// Consolidated same-owner, same-feature, same-lane test family.
// Original cases/assertions preserved; this is NOT executed test proof.
import { describe, expect, it } from "vitest";
import { comp, int, writeUncompressed, type NBT } from "prismarine-nbt";
import { type BedrockLevelDbReader } from "../../../../adapters/leveldb/src/index.js";
import { extractPersistedPackIdentities } from "../../src/release/persisted-pack-identity.js";
import { analyzeReleaseIdentity } from "../../src/release/release-identity-analysis.js";
import { artifactFilenameReleaseObservation, extractExplicitReleaseVersion, levelNameReleaseObservation } from "../../src/release/release-identity-evidence.js";

// Original suite: engine/packages/orchestrator/test/release/persisted-pack-identity.test.ts (Git blob 7c763829fa9fa4436add97a90c3ec1d520916014)
{


describe("persisted pack identity extraction", () => {
  it("reads DynamicProperties as bounded named NBT evidence", async () => {
    const bytes = writeUncompressed(
      comp({
        "8a121475-6f9f-4780-a746-2bf25f732204": comp({
          score: int(10),
        }),
      }, "") as NBT,
      "little",
    );

    const reader: BedrockLevelDbReader = {
      async get(key) {
        return Buffer.from(key).toString("utf8") === "DynamicProperties"
          ? bytes
          : undefined;
      },
      async *entries() {},
      async close() {},
    };

    const result = await extractPersistedPackIdentities(reader);
    expect(result.status).toBe("parsed");
    expect(result.namespaces[0]?.identity).toBe(
      "8a121475-6f9f-4780-a746-2bf25f732204",
    );
  });
});
}

// Original suite: engine/packages/orchestrator/test/release/release-identity-analysis.test.ts (Git blob 83dd2cd05972607e159bd71319e07b9620f85045)
{


describe("release identity analysis", () => {
  it("keeps pack engine and script API versions separate from release identity", () => {
    const result = analyzeReleaseIdentity(
      [{
        root: "behavior_packs/game",
        type: "behavior_pack",
        uuid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        packVersion: "1.2.3",
        minEngineVersion: "1.21.0",
        educationMetadata: false,
        scriptModules: [{
          moduleName: "@minecraft/server",
          version: "2.6.0",
          track: "stable",
        }],
      }],
      {
        compiledBindings: 1,
        crossFileResolvedBindings: 0,
        rejectedBindings: 0,
        resolvedBindings: [{
          scriptId: "config",
          name: "RELEASE_VERSION",
          value: "2026.09.29",
          source: {
            artifactId: "fixture",
            relativePath: "scripts/config.ts",
          },
        }],
        failedBindings: [],
        arenaCountCandidates: [],
        arenaConcurrencyCandidates: [],
        arenaLayoutCandidates: [],
        arenaCountConflict: false,
        arenaConcurrencyConflict: false,
        arenaLayoutConflict: false,
      },
      {},
    );

    expect(result.status).toBe("consistent");
    expect(result.explicitReleaseObservations[0]?.releaseVersion)
      .toBe("2026.09.29");
    expect(result.packVersions[0]?.packVersion).toBe("1.2.3");
    expect(result.engineVersions[0]?.engineVersion).toBe("1.21.0");
    expect(result.scriptApiVersions[0]?.scriptApiVersion).toBe("2.6.0");
  });

  it("reports conflict only between explicit release identities", () => {
    const result = analyzeReleaseIdentity(
      [],
      {
        compiledBindings: 1,
        crossFileResolvedBindings: 0,
        rejectedBindings: 0,
        resolvedBindings: [{
          scriptId: "config",
          name: "RELEASE_VERSION",
          value: "1.0.0",
          source: {
            artifactId: "fixture",
            relativePath: "scripts/config.ts",
          },
        }],
        failedBindings: [],
        arenaCountCandidates: [],
        arenaConcurrencyCandidates: [],
        arenaLayoutCandidates: [],
        arenaCountConflict: false,
        arenaConcurrencyConflict: false,
        arenaLayoutConflict: false,
      },
      { releaseVersion: "2.0.0" },
    );

    expect(result.status).toBe("conflict");
    expect(result.findings.length).toBeGreaterThan(0);
  });
});
}

// Original suite: engine/packages/orchestrator/test/release/release-identity-evidence.test.ts (Git blob aec0354083f4ed042d9c14a41758dcf3f337c4aa)
{


describe("release identity evidence", () => {
  it("extracts explicit v/version/release markers", () => {
    expect(
      extractExplicitReleaseVersion(
        "Beach Bedwars v1.0.4",
      ),
    ).toBe("1.0.4");
    expect(
      extractExplicitReleaseVersion(
        "Defense-version-2.1",
      ),
    ).toBe("2.1");
    expect(
      extractExplicitReleaseVersion(
        "Map release_3.0.0-beta.1",
      ),
    ).toBe("3.0.0-beta.1");
  });

  it("does not treat unrelated numbers as release identity", () => {
    expect(
      extractExplicitReleaseVersion(
        "Arena 6 Players 30",
      ),
    ).toBeUndefined();
    expect(
      extractExplicitReleaseVersion(
        "Minecraft 2026 Map",
      ),
    ).toBeUndefined();
  });

  it("creates filename and levelname observations", () => {
    expect(
      artifactFilenameReleaseObservation(
        "/tmp/The Gauntlet v1.0.1.mcworld",
      ),
    ).toMatchObject({
      component: "artifact-filename",
      releaseVersion: "1.0.1",
    });

    expect(
      levelNameReleaseObservation(
        "The Gauntlet v1.0.1",
        "art_123",
      ),
    ).toMatchObject({
      component: "levelname.txt",
      releaseVersion: "1.0.1",
      source: {
        artifactId: "art_123",
        relativePath: "levelname.txt",
      },
    });
  });
});
}
