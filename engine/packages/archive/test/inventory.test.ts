// Cohesive source test suite consolidation; original describe/it and assertions retained.
import { describe } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { NORMAL_EXTRACTION_BUDGET } from "../src/budgets.js";
import { validateArchiveInventory } from "../src/inventory.js";
import { validateArchivePath } from "../src/path-safety.js";
import { mkdtemp } from "node:fs/promises";
import { mkdir } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { packageDirectoryDeterministically } from "../src/package-zip.js";
import { extractZipSafely } from "../src/zip-transport.js";
import { inventoryZip } from "../src/zip-transport.js";

// Original suite engine/packages/archive/test/inventory.test.ts, blob dc579ebb74398a11bfce28e5ce18af07281a8256
{
describe("validateArchiveInventory", () => {
  it("rejects duplicate normalized paths", () => {
    const result = validateArchiveInventory(
      [
        { path: "a/file.txt", compressedBytes: 10, expandedBytes: 20, isDirectory: false },
        { path: "a/file.txt", compressedBytes: 10, expandedBytes: 20, isDirectory: false },
      ],
      NORMAL_EXTRACTION_BUDGET,
    );

    expect(result.inventory).toBeUndefined();
    expect(result.findings.some((finding) => finding.code === "ARCHIVE_DUPLICATE_PATH")).toBe(true);
  });

  it("rejects suspicious expansion ratio", () => {
    const result = validateArchiveInventory(
      [
        {
          path: "db/huge.bin",
          compressedBytes: 1,
          expandedBytes: NORMAL_EXTRACTION_BUDGET.maxCompressionRatio + 1,
          isDirectory: false,
        },
      ],
      NORMAL_EXTRACTION_BUDGET,
    );

    expect(result.inventory).toBeUndefined();
  });
});
}

// Original suite engine/packages/archive/test/path-safety.test.ts, blob ace30f559bae2d0a2f26012d6122070b0f57468f
{
describe("validateArchivePath", () => {
  it("accepts a normal Bedrock path", () => {
    expect(validateArchivePath("behavior_packs/demo/functions/start.mcfunction", 32)).toEqual({
      ok: true,
      normalized: "behavior_packs/demo/functions/start.mcfunction",
    });
  });

  it("rejects traversal", () => {
    expect(validateArchivePath("../../outside.txt", 32).ok).toBe(false);
  });

  it("rejects Windows absolute paths", () => {
    expect(validateArchivePath("C:\\Windows\\System32\\x", 32).ok).toBe(false);
  });

  it("rejects reserved Windows device names", () => {
    expect(validateArchivePath("behavior_packs/con/file.json", 32).ok).toBe(false);
  });
});
}

// Original suite engine/packages/archive/test/zip-transport.test.ts, blob 7c256d52f201a8f79d475ffa2b44e713e4a83982
{
describe("zip transport", () => {
  it("packages, inventories and extracts a small tree", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-zip-"));
    const input = join(root, "input");
    const output = join(root, "output.mcworld");
    const extracted = join(root, "extracted");

    await mkdir(join(input, "behavior_packs/demo/functions"), { recursive: true });
    await writeFile(
      join(input, "behavior_packs/demo/functions/start.mcfunction"),
      "say hi\n",
    );

    await packageDirectoryDeterministically(input, output);
    const inventory = await inventoryZip(output);
    expect(inventory.entries.some((entry) => entry.path.endsWith("start.mcfunction"))).toBe(true);

    await extractZipSafely(output, extracted, NORMAL_EXTRACTION_BUDGET);
    expect(
      await readFile(join(extracted, "behavior_packs/demo/functions/start.mcfunction"), "utf8"),
    ).toBe("say hi\n");
  });
});
}
