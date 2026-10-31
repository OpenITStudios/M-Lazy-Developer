import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { packageDirectoryDeterministically } from "../../../archive/src/index.js";
import { proveNoopPackageRoundtrip } from "../../src/reliability/package-roundtrip-proof.js";

describe("package roundtrip proof", () => {
  it("preserves every extracted file byte-for-byte through a no-op package cycle", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-roundtrip-test-"));
    const source = join(root, "source");
    const artifact = join(root, "input.mcworld");

    await mkdir(join(source, "behavior_packs/demo/functions"), {
      recursive: true,
    });
    await writeFile(join(source, "levelname.txt"), "Roundtrip Test\n");
    await writeFile(
      join(source, "behavior_packs/demo/functions/start.mcfunction"),
      "say roundtrip\n",
    );

    await packageDirectoryDeterministically(source, artifact);

    const proof = await proveNoopPackageRoundtrip(artifact);

    expect(proof.equivalent).toBe(true);
    expect(proof.differences).toEqual([]);
    expect(proof.beforeFiles).toBe(2);
    expect(proof.afterFiles).toBe(2);
  });
});
