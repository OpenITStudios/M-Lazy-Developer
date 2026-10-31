import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applyPatchTransaction, createPatchTransaction } from "../../../repair/src/index.js";
import { fixtureRepairAuthorization } from "../../../repair/test/fixture-authorization.js";
import { planLinearTopologyRepair } from "../../../repair/src/index.js";
import { parseMcFunction } from "../../../../analyzers/functions/src/index.js";
import { analyzeFunctionTopology } from "../../src/inspection/topology-analysis.js";
import { validatePatchTransaction } from "../../src/repair/repair-validation.js";

describe("repair validation executor", () => {
  it("accepts an applied topology repair only after the target outlier disappears", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-validation-"));
    const sourceRoot = join(root, "source");
    const workingRoot = join(root, "working");
    const relativePath = "behavior_packs/demo/functions/arenas.mcfunction";
    await mkdir(join(sourceRoot, "behavior_packs/demo/functions"), { recursive: true });
    await mkdir(join(workingRoot, "behavior_packs/demo/functions"), { recursive: true });

    const original = [
      "fill 0 0 0 3 2 3 stone",
      "fill 100 0 0 103 2 3 stone",
      "fill 198 0 0 201 2 3 stone",
      "fill 300 0 0 303 2 3 stone",
      "fill 400 0 0 403 2 3 stone",
    ].join("\n") + "\n";

    await writeFile(join(sourceRoot, relativePath), original);
    await writeFile(join(workingRoot, relativePath), original);

    const parsed = parseMcFunction("arenas", original, {
      artifactId: "source-sha",
      relativePath,
    });
    const topology = analyzeFunctionTopology([parsed]);
    const candidate = topology.repairableTopologyCandidates[0];
    if (!candidate) throw new Error("expected repairable candidate");

    if (
      candidate.record.effect.kind !== "fill" &&
      candidate.record.effect.kind !== "setblock"
    ) {
      throw new Error("expected fill/setblock repair effect");
    }

    const plan = planLinearTopologyRepair({
      outlier: candidate.outlier,
      effect: candidate.record.effect,
      rawCommand: candidate.record.rawCommand,
    }, "source-sha");
    if (plan.status !== "proposed") throw new Error("expected deterministic topology proposal");
    // The topology planner proposes source edits; only an authorized working-copy
    // transaction may apply them. Do not infer authorization from a proposal.
    const transaction = createPatchTransaction({
      title: plan.proposal.title,
      sourceFingerprint: plan.proposal.sourceFingerprint,
      authorization: fixtureRepairAuthorization(plan.proposal.sourceFingerprint),
      operations: [plan.proposal.operation],
      preconditions: [{ kind: "source-fingerprint", expected: "source-sha" }],
      validation: [
        { kind: "reparse", source: plan.proposal.operation.source },
        { kind: "topology-compare", source: plan.proposal.operation.source, expectation: "outlier-absent" },
        { kind: "rerun-diagnostic", code: "TOPOLOGY_TRANSLATION_OUTLIER", source: plan.proposal.operation.source, expectation: "absent" },
      ],
    });
    const applied = await applyPatchTransaction(
      transaction,
      { sourceRoot, workingRoot },
      { currentSourceFingerprint: "source-sha" },
    );
    expect(applied.ok).toBe(true);

    const validation = await validatePatchTransaction(
      transaction,
      { sourceRoot, workingRoot },
    );

    expect(validation.ok).toBe(true);
    expect(validation.steps.every((step) => step.ok)).toBe(true);
  });

  it("reparses JavaScript/TypeScript repair sources through the script analyzer", async () => {
    const root = await mkdtemp(
      join(tmpdir(), "m-bedrock-script-validation-"),
    );
    const sourceRoot = join(root, "source");
    const workingRoot = join(root, "working");
    const relativePath =
      "behavior_packs/demo/scripts/session.ts";

    await mkdir(
      join(
        workingRoot,
        "behavior_packs/demo/scripts",
      ),
      { recursive: true },
    );

    const text = [
      'import { system } from "@minecraft/server";',
      "class Controller {",
      "  generation = 1;",
      "  run() {",
      "    const capturedGeneration = this.generation;",
      "    system.run(() => { if (capturedGeneration !== this.generation) return; });",
      "  }",
      "}",
    ].join("\n");

    await writeFile(
      join(workingRoot, relativePath),
      text,
    );

    const transaction = {
      id: "patch_script_fixture",
      title: "script fixture",
      sourceFingerprint: "source-sha",
      authorization: fixtureRepairAuthorization("source-sha"),
      operations: [],
      preconditions: [],
      affectedPaths: [relativePath],
      validation: [{
        kind: "reparse" as const,
        source: {
          artifactId: "source-sha",
          relativePath,
          range: {
            lineStart: 6,
            lineEnd: 6,
          },
        },
      }],
    };

    const validation = await validatePatchTransaction(
      transaction,
      { sourceRoot, workingRoot },
    );

    expect(validation.ok).toBe(true);
    expect(validation.steps[0]?.ok).toBe(true);
    expect(validation.steps[0]?.message)
      .toMatch(/script reparsed/i);
  });

  it("rejects script reparse when the transformed source has syntax errors", async () => {
    const root = await mkdtemp(
      join(tmpdir(), "m-bedrock-script-validation-"),
    );
    const sourceRoot = join(root, "source");
    const workingRoot = join(root, "working");
    const relativePath =
      "behavior_packs/demo/scripts/broken.ts";

    await mkdir(
      join(
        workingRoot,
        "behavior_packs/demo/scripts",
      ),
      { recursive: true },
    );
    await writeFile(
      join(workingRoot, relativePath),
      "function broken( {",
    );

    const transaction = {
      id: "patch_broken_script_fixture",
      title: "broken script fixture",
      sourceFingerprint: "source-sha",
      authorization: fixtureRepairAuthorization("source-sha"),
      operations: [],
      preconditions: [],
      affectedPaths: [relativePath],
      validation: [{
        kind: "reparse" as const,
        source: {
          artifactId: "source-sha",
          relativePath,
        },
      }],
    };

    const validation = await validatePatchTransaction(
      transaction,
      { sourceRoot, workingRoot },
    );

    expect(validation.ok).toBe(false);
    expect(validation.steps[0]?.message)
      .toMatch(/parse diagnostics/i);
  });

  it("rejects validation when mutation did not remove the target diagnostic", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-validation-"));
    const sourceRoot = join(root, "source");
    const workingRoot = join(root, "working");
    const relativePath = "behavior_packs/demo/functions/arenas.mcfunction";
    await mkdir(join(workingRoot, "behavior_packs/demo/functions"), { recursive: true });

    const broken = [
      "fill 0 0 0 3 2 3 stone",
      "fill 100 0 0 103 2 3 stone",
      "fill 198 0 0 201 2 3 stone",
      "fill 300 0 0 303 2 3 stone",
      "fill 400 0 0 403 2 3 stone",
    ].join("\n") + "\n";
    await writeFile(join(workingRoot, relativePath), broken);

    const transaction = {
      id: "patch_fixture",
      title: "fixture",
      sourceFingerprint: "source-sha",
      authorization: fixtureRepairAuthorization("source-sha"),
      operations: [],
      preconditions: [],
      affectedPaths: [relativePath],
      validation: [{
        kind: "topology-compare" as const,
        source: {
          artifactId: "source-sha",
          relativePath,
          range: { lineStart: 3, lineEnd: 3 },
        },
        expectation: "outlier-absent" as const,
      }],
    };

    const validation = await validatePatchTransaction(
      transaction,
      { sourceRoot, workingRoot },
    );

    expect(validation.ok).toBe(false);
  });
});
