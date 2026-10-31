import { afterEach, describe, expect, it } from "vitest";
import {
  mkdtemp,
  mkdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  indexSelectedArtifactContractSources,
} from "../../src/inspection/inspect-contract-source.js";

const roots: string[] = [];

afterEach(async () => {
  for (const root of roots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

describe("selected-artifact contract source indexing", () => {
  it("indexes behavior-pack src TypeScript without treating runtime scripts as authored source", async () => {
    const root = await mkdtemp(
      join(tmpdir(), "m-bedrock-authored-intent-"),
    );
    roots.push(root);

    await mkdir(
      join(root, "behavior_packs/demo/src/domain"),
      { recursive: true },
    );
    await mkdir(
      join(root, "behavior_packs/demo/scripts/domain"),
      { recursive: true },
    );

    await writeFile(
      join(
        root,
        "behavior_packs/demo/src/domain/types.ts",
      ),
      `
export interface ResourceRecord {
  owner: SessionToken;
}
export interface SessionToken {
  sessionId: string;
  generation: number;
}
`,
      "utf8",
    );

    await writeFile(
      join(
        root,
        "behavior_packs/demo/scripts/domain/types.js",
      ),
      "export {};",
      "utf8",
    );

    const result = await indexSelectedArtifactContractSources(
      root,
      "art_test",
      [
        {
          relativePath:
            "behavior_packs/demo/src/domain/types.ts",
          size: 100,
          kindHint: "script",
        },
        {
          relativePath:
            "behavior_packs/demo/scripts/domain/types.js",
          size: 10,
          kindHint: "script",
        },
      ],
    );

    expect(result).toHaveLength(1);
    expect(
      result[0]?.parsed.source.relativePath,
    ).toBe(
      "behavior_packs/demo/src/domain/types.ts",
    );
    expect(
      result[0]?.parsed.typeProperties?.some(
        (item) =>
          item.containerName === "ResourceRecord" &&
          item.propertyName === "owner" &&
          item.typeText === "SessionToken",
      ),
    ).toBe(true);
  });

  it("indexes development_behavior_packs authored TypeScript", async () => {
    const root = await mkdtemp(
      join(tmpdir(), "m-bedrock-authored-intent-dev-"),
    );
    roots.push(root);

    await mkdir(
      join(root, "development_behavior_packs/demo/src"),
      { recursive: true },
    );
    await writeFile(
      join(
        root,
        "development_behavior_packs/demo/src/state.ts",
      ),
      "export const state = 'active';",
      "utf8",
    );

    const result = await indexSelectedArtifactContractSources(
      root,
      "art_test",
      [{
        relativePath:
          "development_behavior_packs/demo/src/state.ts",
        size: 32,
      }],
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.parsed.source.relativePath)
      .toBe(
        "development_behavior_packs/demo/src/state.ts",
      );
  });

  it("supports an explicit authored source root for custom layouts", async () => {
    const root = await mkdtemp(
      join(tmpdir(), "m-bedrock-authored-intent-custom-"),
    );
    roots.push(root);

    await mkdir(
      join(root, "map-source/domain"),
      { recursive: true },
    );
    await writeFile(
      join(root, "map-source/domain/session.ts"),
      "export const session = true;",
      "utf8",
    );

    const result = await indexSelectedArtifactContractSources(
      root,
      "art_test",
      [{
        relativePath:
          "map-source/domain/session.ts",
        size: 28,
      }],
      {
        contractSourceRoots: ["map-source"],
      },
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.parsed.source.relativePath)
      .toBe("map-source/domain/session.ts");
  });

  it("allows custom authored roots to use a scripts subfolder", async () => {
    const root = await mkdtemp(
      join(tmpdir(), "m-bedrock-authored-intent-custom-scripts-"),
    );
    roots.push(root);

    await mkdir(join(root, "map-source/scripts"), {
      recursive: true,
    });
    await writeFile(
      join(root, "map-source/scripts/domain.ts"),
      "export const domain = true;",
      "utf8",
    );

    const result = await indexSelectedArtifactContractSources(
      root,
      "art_test",
      [{
        relativePath: "map-source/scripts/domain.ts",
        size: 28,
      }],
      {
        contractSourceRoots: ["map-source"],
      },
    );

    expect(result).toHaveLength(1);
  });

  it("does not treat Bedrock runtime scripts or generated outputs as authored", async () => {
    const root = await mkdtemp(
      join(tmpdir(), "m-bedrock-authored-intent-generated-"),
    );
    roots.push(root);

    await mkdir(
      join(root, "behavior_packs/demo/scripts"),
      { recursive: true },
    );
    await mkdir(join(root, "map-source/dist"), {
      recursive: true,
    });
    await writeFile(
      join(
        root,
        "behavior_packs/demo/scripts/runtime.ts",
      ),
      "export {};",
      "utf8",
    );
    await writeFile(
      join(root, "map-source/dist/generated.ts"),
      "export {};",
      "utf8",
    );

    const result = await indexSelectedArtifactContractSources(
      root,
      "art_test",
      [
        {
          relativePath:
            "behavior_packs/demo/scripts/runtime.ts",
          size: 10,
        },
        {
          relativePath: "map-source/dist/generated.ts",
          size: 10,
        },
      ],
      {
        contractSourceRoots: [
          "behavior_packs/demo",
          "map-source",
        ],
      },
    );

    expect(result).toEqual([]);
  });
});
