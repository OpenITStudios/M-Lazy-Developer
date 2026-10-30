// Family-level suite consolidation; preserves original suites and assertion bodies.
import { describe } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { authorizeRepair } from "../src/authorization.js";
import { createPatchTransaction } from "../src/create.js";
import { verifyPreconditions } from "../src/preconditions.js";
import { link } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { mkdir } from "node:fs/promises";
import { symlink } from "node:fs/promises";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepareMutationWorkspace } from "../src/workspace.js";
import { resolveWorkingPathSecure } from "../src/workspace.js";

// Original suite engine/packages/repair/test/authorization.test.ts, blob db25f201f2508530b51c00ff32ac65e40cb6906e
{
describe("repair authorization", () => {
  it("rejects stale evidence even for a confirmed defect", () => {
    expect(
      authorizeRepair({
        confirmedDefect: true,
        diagnosisEvidenceIds: ["evidence_1"],
        invariantIds: ["arena.release"],
        sourceFingerprint: "abc",
        sourceFingerprintMatches: true,
        evidenceFreshness: "stale",
      }).authorized,
    ).toBe(false);
  });

  it("returns a receipt only for fully grounded fresh repair plans", () => {
    const result = authorizeRepair({
      confirmedDefect: true,
      diagnosisEvidenceIds: ["evidence_1"],
      invariantIds: ["arena.release"],
      sourceFingerprint: "abc",
      sourceFingerprintMatches: true,
      evidenceFreshness: "fresh",
    });

    expect(result.authorized).toBe(true);
    expect(result.receipt).toEqual(
      expect.objectContaining({
        sourceFingerprint: "abc",
        evidenceFreshness: "fresh",
      }),
    );
  });
});
}

// Original suite engine/packages/repair/test/create.test.ts, blob b62adfea7fafa25fb7347be709c7d20953e9c990
{
describe("createPatchTransaction", () => {
  it("requires grounded authorization and derives affected paths", () => {
    const tx = createPatchTransaction({
      title: "derived paths",
      sourceFingerprint: "abc",
      authorization: {
        schemaVersion: 1,
        authorized: true,
        sourceFingerprint: "abc",
        diagnosisEvidenceIds: ["evidence_1"],
        invariantIds: ["arena.release"],
        evidenceFreshness: "fresh",
      },
      operations: [
        {
          kind: "replace-command",
          source: {
            artifactId: "a",
            relativePath: "b.mcfunction",
            range: {
              lineStart: 1,
              lineEnd: 1,
            },
          },
          expected: "say b",
          replacement: "say c",
        },
        {
          kind: "replace-command",
          source: {
            artifactId: "a",
            relativePath: "a.mcfunction",
            range: {
              lineStart: 1,
              lineEnd: 1,
            },
          },
          expected: "say a",
          replacement: "say d",
        },
      ],
      preconditions: [],
      validation: [],
    });

    expect(tx.affectedPaths).toEqual([
      "a.mcfunction",
      "b.mcfunction",
    ]);
  });
});
}

// Original suite engine/packages/repair/test/preconditions.test.ts, blob b0990cbad83bf9265e138913e3f2a85134bf705f
{
describe("repair preconditions", () => {
  it("fails closed on source fingerprint mismatch", async () => {
    const result = await verifyPreconditions(
      [{ kind: "source-fingerprint", expected: "abc" }],
      { sourceFingerprint: "def" },
    );
    expect(result.ok).toBe(false);
  });

  it("accepts matching text preconditions", async () => {
    const result = await verifyPreconditions(
      [{
        kind: "text-equals",
        source: { artifactId: "art", relativePath: "functions/a.mcfunction" },
        expected: "fill 0 0 0 1 1 1 stone",
      }],
      {
        sourceFingerprint: "abc",
        readText: async () => "fill 0 0 0 1 1 1 stone",
      },
    );
    expect(result.ok).toBe(true);
  });
});
}

// Original suite engine/packages/repair/test/public-api-boundary.test.ts, blob 0958ec2749d4f3e3fd0c3c91ea41eb554bc74841
{
describe("repair public API boundary", () => {
  it("does not expose low-level mutation primitives", async () => {
    const api = await import("../src/index.js") as Record<string, unknown>;

    expect(api).not.toHaveProperty("applyPatchTransaction");
    expect(api).not.toHaveProperty("rollbackAppliedFiles");
    expect(api).not.toHaveProperty("atomicWriteText");
  });
});
}

// Original suite engine/packages/repair/test/workspace-hardening.test.ts, blob 1d0b6c0fdc568c479458593201549e2aaf135269
{
describe("mutation workspace hardening", () => {
  it("rejects overlapping source and working roots", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-workspace-"));
    const sourceRoot = join(root, "source");
    const workingRoot = join(sourceRoot, "working");
    await mkdir(workingRoot, { recursive: true });

    await expect(
      prepareMutationWorkspace({ sourceRoot, workingRoot }),
    ).rejects.toThrow(/must not overlap/);
  });

  it("rejects symlink escapes from working root", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-workspace-"));
    const sourceRoot = join(root, "source");
    const workingRoot = join(root, "working");
    const outside = join(root, "outside");
    await mkdir(sourceRoot, { recursive: true });
    await mkdir(workingRoot, { recursive: true });
    await mkdir(outside, { recursive: true });
    await writeFile(join(outside, "target.mcfunction"), "say outside\n");

    const linkPath = join(workingRoot, "linked.mcfunction");
    await symlink(join(outside, "target.mcfunction"), linkPath);

    const prepared = await prepareMutationWorkspace({ sourceRoot, workingRoot });
    await expect(
      resolveWorkingPathSecure(prepared, "linked.mcfunction"),
    ).rejects.toThrow(/filesystem links|symbolic link/);
  });

  it("rejects hardlinks to immutable source content", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-workspace-"));
    const sourceRoot = join(root, "source");
    const workingRoot = join(root, "working");
    await mkdir(join(sourceRoot, "functions"), { recursive: true });
    await mkdir(join(workingRoot, "functions"), { recursive: true });
    const sourceFile = join(sourceRoot, "functions/a.mcfunction");
    const workingFile = join(workingRoot, "functions/a.mcfunction");
    await writeFile(sourceFile, "say source\n");
    await link(sourceFile, workingFile);

    const prepared = await prepareMutationWorkspace({ sourceRoot, workingRoot });
    await expect(
      resolveWorkingPathSecure(prepared, "functions/a.mcfunction"),
    ).rejects.toThrow(/hardlinked/);
  });

  it("rejects parent-directory symlink escapes for not-yet-existing targets", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-workspace-"));
    const sourceRoot = join(root, "source");
    const workingRoot = join(root, "working");
    const outside = join(root, "outside");
    await mkdir(sourceRoot, { recursive: true });
    await mkdir(workingRoot, { recursive: true });
    await mkdir(outside, { recursive: true });
    await symlink(outside, join(workingRoot, "linked-dir"));

    const prepared = await prepareMutationWorkspace({ sourceRoot, workingRoot });
    await expect(
      resolveWorkingPathSecure(prepared, "linked-dir/new.mcfunction"),
    ).rejects.toThrow(/filesystem links/);
  });
});
}
