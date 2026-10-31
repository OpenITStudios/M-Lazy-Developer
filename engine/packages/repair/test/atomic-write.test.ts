import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { atomicWriteText } from "../src/atomic-write.js";

describe("atomicWriteText", () => {
  it("replaces content while preserving existing file mode", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-atomic-"));
    const path = join(root, "file.txt");
    await writeFile(path, "old", { mode: 0o640 });
    const beforeMode = (await stat(path)).mode & 0o777;

    await atomicWriteText(path, "new");

    expect(await readFile(path, "utf8")).toBe("new");
    expect((await stat(path)).mode & 0o777).toBe(beforeMode);
  });
});
