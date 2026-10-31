import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createUpdateDelta } from "../../../reliability/src/index.js";
import { planDirectoryRetest } from "../../src/reliability/retest-plan-directory.js";

describe("retest planning API", () => {
  it("turns inspection facts plus update delta into a map-specific QA plan", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-retest-"));
    const pack = join(root, "behavior_packs/demo");
    await mkdir(join(pack, "functions"), { recursive: true });
    await writeFile(join(pack, "manifest.json"), JSON.stringify({
      format_version: 2,
      header: {
        name: "Demo",
        uuid: "00000000-0000-0000-0000-000000009001",
        version: [1, 0, 0],
        min_engine_version: [1, 21, 0]
      },
      modules: [{
        type: "data",
        uuid: "00000000-0000-0000-0000-000000009002",
        version: [1, 0, 0]
      }]
    }));

    await writeFile(
      join(pack, "functions/main.mcfunction"),
      [
        "structure load demo:room 0 0 0",
        "scoreboard players set @a active 1",
      ].join("\n"),
    );

    const updateDelta = createUpdateDelta("1.22.0", [{
      id: "structure-runtime-change",
      kind: "behavior-changed",
      domain: "structures",
      capabilityTags: ["structure-load"],
      affectedIdentifiers: ["structure"],
      summary: "Structure loading behavior changed.",
      source: "fixture",
      confidence: "documented",
    }], "1.21.0");

    const result = await planDirectoryRetest({
      root,
      mapId: "demo-map",
      updateDelta,
      coverage: [{
        domain: "multiplayer",
        lane: "runtime",
        state: "unknown",
      }],
    });

    expect(result.plan.mapId).toBe("demo-map");
    expect(result.plan.priority).toMatch(/P[0-3]/);
    expect(result.plan.reasons).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "update-overlap" }),
    ]));
    expect(result.plan.suggestedLanes).toContain("differential");
  });
});
