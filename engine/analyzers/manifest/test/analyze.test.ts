// Owner-local source consolidation. Original cases are preserved verbatim.
import { describe, expect, it } from "vitest";
import { analyzeManifest, classifyPackFromManifest } from "../src/analyze.js";
import { deriveManifestCompatibilityFacts } from "../src/compatibility.js";
import { deriveEducationTargetProfile } from "../src/education.js";
import { manifestRuntimeEvidence, resolveKnowledgeProfile } from "../src/index.js";

// Original engine/analyzers/manifest/test/analyze.test.ts [50beca19fd377950efaaa27744359ab990323cb1]
{
// Cohesive source test suite consolidation; original describe/it and assertions retained.

// Original suite engine/analyzers/manifest/test/analyze.test.ts, blob b4f752c412b88a8a73cf5860a52ef6faa7fa8449
{
describe("manifest analyzer", () => {
  const source = { artifactId: "art_demo", relativePath: "behavior_packs/demo/manifest.json" };

  it("normalizes pack identity and module types", () => {
    const manifest = analyzeManifest(
      {
        format_version: 2,
        header: {
          name: "Demo",
          uuid: "00000000-0000-0000-0000-000000000001",
          version: [1, 0, 0],
        },
        modules: [
          {
            type: "data",
            uuid: "00000000-0000-0000-0000-000000000002",
            version: [1, 0, 0],
          },
        ],
      },
      source,
    );

    expect(classifyPackFromManifest(manifest)).toBe("behavior_pack");
    expect(manifest.headerUuid).toBe("00000000-0000-0000-0000-000000000001");
  });
});
}

// Original suite engine/analyzers/manifest/test/compatibility.test.ts, blob 6ef36604ec00c49739634347dc87b6c979a0690e
{
describe("manifest compatibility facts", () => {
  it("derives min engine and script dependency track without owning compatibility policy", () => {
    const source = { artifactId: "art_demo", relativePath: "manifest.json" };
    const manifest = analyzeManifest({
      format_version: 2,
      header: {
        name: "Demo",
        uuid: "00000000-0000-0000-0000-000000000001",
        version: [1, 0, 0],
        min_engine_version: [1, 21, 40],
      },
      modules: [{
        type: "script",
        uuid: "00000000-0000-0000-0000-000000000002",
        version: [1, 0, 0],
        entry: "scripts/main.js",
      }],
      dependencies: [{
        module_name: "@minecraft/server",
        version: "2.0.0-beta",
      }],
      has_education_metadata: true,
    }, source);

    const facts = deriveManifestCompatibilityFacts(manifest);

    expect(facts.minEngineVersion).toEqual({ major: 1, minor: 21, patch: 40 });
    expect(facts.scriptModules[0]?.track).toBe("beta");
    expect(facts.educationMetadata).toBe(true);
  });
});
}

// Original suite engine/analyzers/manifest/test/education.test.ts, blob bfc15cfa4309b4e5611e3eb3389be9c6e021101e
{
const source = { artifactId: "fixture", relativePath: "manifest.json" };

describe("education target profile", () => {
  it("keeps Education as an explicit edition/version capability gate", () => {
    const result = deriveEducationTargetProfile({
      modules: [],
      dependencies: [],
      hasEducationMetadata: true,
      source,
      raw: {},
    });
    expect(result).toMatchObject({
      edition: "education",
      codeBuilderTrack: "supported-profile",
      versionTrack: "education-distinct",
      sharedBedrockFactsRequireEditionGate: true,
    });
  });

  it("does not infer Education capability from a normal Bedrock manifest", () => {
    expect(deriveEducationTargetProfile({
      modules: [],
      dependencies: [],
      source,
      raw: {},
    }).edition).toBe("bedrock");
  });
});
}
}

// Original engine/analyzers/manifest/test/runtime-evidence.test.ts [3feb17da3a08a9e874a86cb3ccba6bbd17cce1d0]
{
describe("manifest runtime evidence", () => {
  it("keeps manifest constraints separate from actual runtime profile", () => {
    const manifest = analyzeManifest({
      format_version: 2,
      header: {
        name: "Test",
        uuid: "00000000-0000-0000-0000-000000000001",
        version: [1, 0, 0],
        min_engine_version: [1, 21, 0],
      },
      modules: [{
        type: "script",
        uuid: "00000000-0000-0000-0000-000000000002",
        version: [1, 0, 0],
        entry: "scripts/main.js",
      }],
      dependencies: [{ module_name: "@minecraft/server", version: "2.0.0" }],
    }, { artifactId: "a", relativePath: "manifest.json" });

    const result = manifestRuntimeEvidence(manifest);
    expect(result.declaredMinEngineVersion).toBe("1.21.0");
    expect(result.manifestFormatVersion).toBe("2");
    expect(result.scriptModules["@minecraft/server"]).toBe("2.0.0");
    expect(result.records.map((record) => record.predicate)).toContain(
      "script-module-dependencies-declared",
    );
  });

  it("resolves runtime version from project session, not min_engine_version", () => {
    const manifest = analyzeManifest({
      format_version: 2,
      header: {
        uuid: "00000000-0000-0000-0000-000000000001",
        version: [1, 0, 0],
        min_engine_version: [1, 20, 0],
      },
      modules: [],
      dependencies: [{ module_name: "@minecraft/server", version: "2.0.0" }],
    }, { artifactId: "a", relativePath: "manifest.json" });

    const resolution = resolveKnowledgeProfile({
      projectId: "p",
      sourceArtifactId: "a",
      sourceFingerprint: "f",
      targetEdition: "bedrock",
      targetVersion: "1.21.130",
      workingRevision: 1,
      indexRevision: 1,
    }, [manifest]);

    expect(resolution.profile?.minecraftVersion).toBe("1.21.130");
    expect(resolution.profile?.scriptModules?.["@minecraft/server"]).toBe("2.0.0");
    expect(resolution.conflicts).toEqual([]);
  });
});
}
