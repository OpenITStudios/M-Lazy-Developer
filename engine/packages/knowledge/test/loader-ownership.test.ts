import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadKnowledgeDirectory } from "../src/index.js";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })
  ));
});

async function makeKnowledgeDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "knowledge-ownership-"));
  directories.push(directory);
  await mkdir(join(directory, "platform"));
  await writeFile(join(directory, "platform", "commands.json"), JSON.stringify({
    schemaVersion: 1,
    sources: [],
    facts: [],
  }));
  await writeFile(join(directory, "ownership.json"), JSON.stringify({
    schemaVersion: 1,
    groups: { platform: { files: ["platform/commands.json"] } },
  }));
  return directory;
}

describe("Knowledge ownership at load boundary", () => {
  it("loads a catalog only when declared by the owning registry", async () => {
    const directory = await makeKnowledgeDirectory();
    const result = await loadKnowledgeDirectory(directory);
    expect(result.schemaVersion).toBe(1);
  });

  it("rejects an unregistered catalog rather than silently consuming it", async () => {
    const directory = await makeKnowledgeDirectory();
    await writeFile(join(directory, "platform", "extra.json"), JSON.stringify({
      schemaVersion: 1,
      sources: [],
      facts: [],
    }));
    await expect(loadKnowledgeDirectory(directory))
      .rejects.toThrow("does not match ownership.json");
  });

  it("rejects a registry referencing a missing catalog", async () => {
    const directory = await makeKnowledgeDirectory();
    await writeFile(join(directory, "ownership.json"), JSON.stringify({
      schemaVersion: 1,
      groups: { platform: { files: ["platform/missing.json"] } },
    }));
    await expect(loadKnowledgeDirectory(directory))
      .rejects.toThrow("does not match ownership.json");
  });

  it("rejects malformed ownership groups rather than treating them as empty", async () => {
    const directory = await makeKnowledgeDirectory();
    await writeFile(join(directory, "ownership.json"), JSON.stringify({
      schemaVersion: 1,
      groups: { platform: {} },
    }));
    await expect(loadKnowledgeDirectory(directory))
      .rejects.toThrow("requires files[]");
  });
});
