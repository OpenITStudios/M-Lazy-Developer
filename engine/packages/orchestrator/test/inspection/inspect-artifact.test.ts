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

async function createSyntheticWorldTree(
  root: string,
  includeOpaqueStructure = true,
  includeModularScripts = false,
): Promise<void> {
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

  if (includeOpaqueStructure) {
    await writeFile(join(pack, "structures/demo/test.mcstructure"), "opaque-fixture");
  }
  if (includeModularScripts) {
    await mkdir(join(pack, "scripts"), { recursive: true });
    await writeFile(join(pack, "scripts/round-helper.js"), [
      'export function resolveRound() {',
      '  return "ready";',
      '}',
    ].join("\n"));
    await writeFile(join(pack, "scripts/round-manager.js"), [
      'import { resolveRound } from "./round-helper.js";',
      'export function beginRound() {',
      '  return resolveRound();',
      '}',
    ].join("\n"));
  }
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
    // Malformed native structures are not eligible for parsed-index reuse.
    expect(result.sourceIndexWork).toMatchObject({
      action: "PARSED",
      snapshotReusable: false,
    });
    expect(result.sourceIndexWork?.parseFailures).toBeGreaterThan(0);
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
    // Cache-eligible fixture: the separate parse-failure case above keeps
    // the malformed structure, but this one must exercise source reuse.
    await createSyntheticWorldTree(world, false, true);
    await packageDirectoryDeterministically(world, archive);
    const fingerprint = await sha256File(archive);
    // Distinct RIG demand is the reason production can require pass two.
    // An empty requested-domain list would exercise the same semantics
    // twice and miss stale graph, knowledge and report projections.
    const expandedTarget = {
      requiredKnowledgeDomains: [
        "economy-reward",
        "inventory-state",
        "temporal-ownership",
      ] as const,
    };

    const passes = await withPreparedArtifactInspection(
      archive,
      async (inspect) => {
        const initial = await inspect({});
        const expanded = await inspect(expandedTarget);
        expect(initial.artifactId).toBe(expanded.artifactId);
        expect(initial.fingerprint).toBe(expanded.fingerprint);
        expect(initial.archiveEntries).toBe(expanded.archiveEntries);
        expect(initial.functions).toBe(expanded.functions);
        expect(initial.gameplayWorld.analysisDemand)
          .not.toContain("temporal-ownership");
        expect(expanded.gameplayWorld.analysisDemand)
          .toEqual(expect.arrayContaining(expandedTarget.requiredKnowledgeDomains));
        // Source meaning is independent of downstream demand expansion.
        expect(initial.gameplayIntent.model)
          .toEqual(expanded.gameplayIntent.model);
        expect(initial.gameplayDiscoveryClosure.sourceParseFailures).toBe(0);
        expect(expanded.gameplayDiscoveryClosure.sourceParseFailures).toBe(0);
        expect(initial.sourceIndexWork).toMatchObject({
          action: "PARSED",
          snapshotReusable: true,
          parseFailures: 0,
        });
        expect(expanded.sourceIndexWork).toMatchObject({
          action: "REUSED",
          snapshotReusable: true,
          parseFailures: 0,
        });
        for (const pass of [initial, expanded]) {
          expect(pass.sourceIndexWork?.elapsedMs).toBeGreaterThanOrEqual(0);
          expect(Number.isFinite(pass.sourceIndexWork?.elapsedMs)).toBe(true);
          expect(pass.sourceIndexWork?.indexedFiles)
            .toBe(pass.gameplayDiscoveryClosure.sourceIndexedFiles);
        }
        expect(expanded.fingerprint).toBe(fingerprint);
        return [initial, expanded];
      },
      fingerprint,
    );
    expect(passes).toHaveLength(2);
    // The modular JavaScript importer exercises cross-file AST analysis,
    // not only the mcfunction source-index clone. A resolved, source-owned
    // call must survive reuse without manufacturing player chronology.
    const resolvedHandoff = passes[1]?.semanticIrModel.execution.edges.find(
      edge => edge.kind === "synchronous-call" &&
        edge.resolution === "resolved" &&
        edge.targetLabel === "resolveRound"
    );
    expect(resolvedHandoff).toBeDefined();
    expect(resolvedHandoff?.to).toContain("round-helper.js");

    // The second pass must stay semantically equivalent to a standalone
    // inspection that does not share physical-inventory or LevelDB results.
    const fresh = await inspectArtifact(archive, expandedTarget);
    expect(fresh.sourceIndexWork?.action).toBe("PARSED");
    expect(passes[1]?.sourceIndexWork?.indexedFiles)
      .toBe(fresh.sourceIndexWork?.indexedFiles);
    expect(passes[1]?.fileInventory).toEqual(fresh.fileInventory);
    expect(passes[1]?.authoredWaveStages).toEqual(fresh.authoredWaveStages);
    expect(passes[1]?.authoredContentCollections)
      .toEqual(fresh.authoredContentCollections);
    expect(passes[1]?.scriptSourceMapNavigation)
      .toEqual(fresh.scriptSourceMapNavigation);
    expect(passes[1]?.gameplayIntent.model).toEqual(fresh.gameplayIntent.model);
    expect(passes[1]?.semanticIrModel).toEqual(fresh.semanticIrModel);
    expect(passes[1]?.gameplayDiscoveryClosure).toEqual(fresh.gameplayDiscoveryClosure);
    // Semantic and defect decisions must agree with a cold analysis of the
    // same artifact and exact expanded knowledge requirements. Comparing only
    // parser/Intent output would not detect stale analysis downstream.
    expect(passes[1]?.gameplayWorld).toEqual(fresh.gameplayWorld);
    expect(passes[1]?.hiddenGameplayDefects.scenarioAudit.graph)
      .toEqual(fresh.hiddenGameplayDefects.scenarioAudit.graph);
    expect(passes[1]?.hiddenGameplayDefects.scenarioAudit.defectResolution)
      .toEqual(fresh.hiddenGameplayDefects.scenarioAudit.defectResolution);
    expect(passes[1]?.mandatoryAuditProcedure)
      .toEqual(fresh.mandatoryAuditProcedure);
    expect(passes[1]?.diagnostics).toEqual(fresh.diagnostics);
    expect(passes[1]?.worldDatabase.nativeScan).toEqual(fresh.worldDatabase.nativeScan);
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
