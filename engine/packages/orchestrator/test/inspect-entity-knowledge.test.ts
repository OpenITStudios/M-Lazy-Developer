import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { KnowledgeCatalog } from "../../knowledge/src/index.js";
import { inspectDirectory } from "../src/inspection/inspect.js";

const knowledge: KnowledgeCatalog = {
  schemaVersion: 1,
  sources: [{
    id: "official",
    title: "Official",
    url: "https://learn.microsoft.com/example",
    authority: "official",
    confidence: "documented",
    retrievedDate: "2026-09-23",
  }],
  facts: [],
  relations: [{
    id: "open-door-path",
    domain: "navigation",
    subject: "minecraft:behavior.open_door",
    kind: "requires",
    object: "navigation:path-through-doors",
    applicability: { editions: ["bedrock", "education"] },
    sourceIds: ["official"],
    diagnosticHint: "open_door cannot be trusted without door pathing capability.",
  }],
};

describe("inspect entity knowledge integration", () => {
  it("surfaces provenance-backed entity prerequisite diagnostics", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-entity-inspect-"));
    const pack = join(root, "behavior_packs", "demo");
    await mkdir(join(pack, "entities"), { recursive: true });

    await writeFile(join(pack, "manifest.json"), JSON.stringify({
      format_version: 2,
      header: {
        name: "demo",
        description: "demo",
        uuid: "11111111-1111-1111-1111-111111111111",
        version: [1, 0, 0],
        min_engine_version: [1, 21, 0],
      },
      modules: [{
        type: "data",
        uuid: "22222222-2222-2222-2222-222222222222",
        version: [1, 0, 0],
      }],
    }));

    await writeFile(join(pack, "entities", "mob.json"), JSON.stringify({
      format_version: "1.21.0",
      "minecraft:entity": {
        description: { identifier: "demo:mob" },
        components: {
          "minecraft:navigation.walk": {
            can_pass_doors: false,
          },
          "minecraft:behavior.open_door": {
            priority: 1,
          },
        },
      },
    }));

    const result = await inspectDirectory(
      root,
      "fixture",
      { edition: "bedrock" },
      undefined,
      knowledge,
    );

    expect(result.entities).toBe(1);
    expect(result.entityKnowledge).toMatchObject({
      analyzed: 1,
      prerequisiteGaps: 1,
    });
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "ENTITY_KNOWLEDGE_PREREQUISITE_GAP",
        data: expect.objectContaining({
          relationId: "open-door-path",
          sourceIds: ["official"],
        }),
      }),
    ]));
  });
});
