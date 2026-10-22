import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { packageDirectoryDeterministically } from "../../../archive/src/index.js";
import { sha256File } from "../../../artifact/src/index.js";
import {
  inspectArtifact,
  withPreparedArtifactInspection,
} from "../../src/inspection/inspect-artifact.js";

async function createSyntheticWorldTree(root: string): Promise<void> {
  const pack = join(root, "behavior_packs/demo");
  await mkdir(join(pack, "functions"), { recursive: true });
  await mkdir(join(pack, "structures/demo"), { recursive: true });

  await writeFile(join(root, "levelname.txt"), "M-Bedrock-Dev Synthetic Fixture\n");
  await writeFile(join(pack, "manifest.json"), JSON.stringify({
    format_version: 2,
    header: {
      name: "Demo",
      description: "Synthetic fixture",
      uuid: "00000000-0000-0000-0000-000000000101",
      version: [1, 0, 0],
      min_engine_version: [1, 20, 0]
    },
    modules: [{
      type: "data",
      uuid: "00000000-0000-0000-0000-000000000102",
      version: [1, 0, 0]
    }]
  }, null, 2));

  await writeFile(
    join(pack, "functions/start.mcfunction"),
    [
      "structure load demo:test 0 0 0",
      "function missing/reset"
    ].join("\n") + "\n",
  );

  await writeFile(join(pack, "structures/demo/test.mcstructure"), "opaque-fixture");
}

describe("inspectArtifact", () => {
  it("packages then inspects a synthetic mcworld-shaped archive", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-artifact-"));
    const tree = join(root, "tree");
    const archive = join(root, "fixture.mcworld");

    await mkdir(tree, { recursive: true });
    await createSyntheticWorldTree(tree);
    await packageDirectoryDeterministically(tree, archive);

    const result = await inspectArtifact(
      archive, {}, undefined, [], undefined, undefined,
      await sha256File(archive),
    );

    await expect(inspectArtifact(
      archive, {}, undefined, [], undefined, undefined,
      "0".repeat(64),
    )).rejects.toThrow(/SHA-256 differs/);

    expect(result.archiveEntries).toBeGreaterThan(0);
    expect(result.packs[0]?.type).toBe("behavior_pack");
    expect(result.functions).toBe(1);
    expect(result.structures).toBe(1);
    expect(result.unresolvedReferences).toBe(1);
    expect(
      result.mandatoryAuditProcedure.checkpoints.find(
        (checkpoint) => checkpoint.id === "A1",
      )?.status,
    ).toBe("CLOSED");
    expect(result.gameplayDiscoveryClosure.unresolvedReferences).toBe(1);
    expect(result.gameplayDiscoveryClosure.status).not.toBe("COMPLETE");
    expect(result.gameplayDiscoveryClosure.semanticUnderstandingGapPaths)
      .toEqual([...result.gameplayDiscoveryClosure.semanticUnderstandingGapPaths].sort());

  });

  it("reuses one hash-pinned source across separate inspection passes", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-audit-passes-"));
    const world = join(root, "world");
    const archive = join(root, "selected.mcworld");
    await mkdir(world, { recursive: true });
    await createSyntheticWorldTree(world);
    await packageDirectoryDeterministically(world, archive);
    const fingerprint = await sha256File(archive);

    const passes = await withPreparedArtifactInspection(
      archive,
      async (inspect) => {
        const initial = await inspect({});
        const expanded = await inspect({ requiredKnowledgeDomains: [] });
        expect(initial.artifactId).toBe(expanded.artifactId);
        expect(initial.fingerprint).toBe(expanded.fingerprint);
        expect(initial.archiveEntries).toBe(expanded.archiveEntries);
        expect(initial.functions).toBe(expanded.functions);
        expect(expanded.fingerprint).toBe(fingerprint);
        return [initial, expanded];
      },
      fingerprint,
    );
    expect(passes).toHaveLength(2);
    expect(await sha256File(archive)).toBe(fingerprint);
  });

  it("produces byte-identical archives for identical trees", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-determinism-"));
    const tree = join(root, "tree");
    const first = join(root, "a.mcworld");
    const second = join(root, "b.mcworld");

    await mkdir(tree, { recursive: true });
    await createSyntheticWorldTree(tree);

    await packageDirectoryDeterministically(tree, first);
    await packageDirectoryDeterministically(tree, second);

    expect(await sha256File(first)).toBe(await sha256File(second));
  });
});
