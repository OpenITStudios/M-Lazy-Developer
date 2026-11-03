import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verifyPortableSource } from "../src/portable-source.js";

const COMMIT = "a".repeat(40);
const hash = (contents: string): string => createHash("sha256")
  .update(contents).digest("hex");

interface TestProvenance {
  schemaVersion: number;
  repository: string;
  branch: string;
  commit: string;
  nodeVersion: string;
  platform: string;
  architecture: string;
  packageLockSha256: string;
  canonicalAuditEntrypoint: { loadable: boolean };
  sourceManifest: {
    policy: string;
    fileCount: number;
    hashes: Record<string, string>;
  };
}

describe("ChatGPT portable exact-source provenance preflight", () => {
  let root: string;
  let provenance: TestProvenance;
  const save = async () => writeFile(join(root, ".portable-provenance.json"),
    JSON.stringify(provenance));
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "m-lazy-portable-contract-"));
    await mkdir(join(root, "engine"));
    await writeFile(join(root, "package-lock.json"), '{"name":"test"}');
    await writeFile(join(root, "engine", "parser.ts"), "export const n = 1;");
    const hashes = {
      "package-lock.json": hash('{"name":"test"}'),
      "engine/parser.ts": hash("export const n = 1;"),
    };
    provenance = {
      schemaVersion: 3,
      repository: "OpenITStudios/M-Lazy-Developer",
      branch: "Local", commit: COMMIT,
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch,
      packageLockSha256: hashes["package-lock.json"],
      canonicalAuditEntrypoint: { loadable: true },
      sourceManifest: {
        policy: "tracked-source-sha256", fileCount: 2, hashes,
      },
    };
    await save();
  });
  afterEach(async () => { await rm(root, { recursive: true, force: true }); });

  it("accepts only a matching complete portable source and harmless transport artifacts", async () => {
    await mkdir(join(root, "node_modules"));
    await writeFile(join(root, "node_modules", "index.js"), "dependency");
    await mkdir(join(root, ".portable-node"));
    await writeFile(join(root, ".portable-node", "node"), "binary-placeholder");
    await verifyPortableSource(COMMIT, root);
  });

  it("rejects a real edited source file even when provenance and commit text are unchanged", async () => {
    await writeFile(join(root, "engine", "parser.ts"), "export const n = 2;");
    await expect(verifyPortableSource(COMMIT, root)).rejects.toThrow("source bytes differ");
  });

  it("rejects extra or removed source rather than silently treating a patched checkout as exact HEAD", async () => {
    await writeFile(join(root, "engine", "patched.ts"), "export const injected = true;");
    await expect(verifyPortableSource(COMMIT, root)).rejects.toThrow("path set differs");
    await unlink(join(root, "engine", "patched.ts"));
    await unlink(join(root, "engine", "parser.ts"));
    await expect(verifyPortableSource(COMMIT, root)).rejects.toThrow("path set differs");
  });

  it("rejects a source symlink instead of following it outside the packaged tree", async () => {
    await unlink(join(root, "engine", "parser.ts"));
    await symlink(join(root, "package-lock.json"), join(root, "engine", "parser.ts"));
    await expect(verifyPortableSource(COMMIT, root)).rejects.toThrow("symlink is not allowed");
  });

  it("fails closed for stale or incomplete source metadata", async () => {
    await expect(verifyPortableSource("b".repeat(40), root)).rejects.toThrow("does not match");
    provenance.schemaVersion = 2;
    await save();
    await expect(verifyPortableSource(COMMIT, root)).rejects.toThrow("does not match");
    provenance.schemaVersion = 3;
    provenance.sourceManifest.fileCount = 1;
    await save();
    await expect(verifyPortableSource(COMMIT, root)).rejects.toThrow("file count");
  });
});
