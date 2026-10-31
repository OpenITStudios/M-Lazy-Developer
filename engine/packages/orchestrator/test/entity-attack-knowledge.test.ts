import { describe, expect, it } from "vitest";
import { parseEntityDefinition } from "../../../analyzers/entities/src/index.js";
import type { KnowledgeCatalog } from "../../knowledge/src/index.js";
import { analyzeEntityWithKnowledge } from "../src/inspection/entity-knowledge-analysis.js";

const catalog: KnowledgeCatalog = {
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
    id: "ranged-needs-shooter",
    domain: "entity-ai",
    subject: "minecraft:behavior.ranged_attack",
    kind: "requires",
    object: "attack:shooter",
    applicability: { editions: ["bedrock", "education"] },
    sourceIds: ["official"],
  }, {
    id: "melee-needs-damage",
    domain: "entity-ai",
    subject: "minecraft:behavior.melee_attack",
    kind: "requires",
    object: "attack:damage-component",
    applicability: { editions: ["bedrock", "education"] },
    sourceIds: ["official"],
  }],
};

describe("attack knowledge orchestration", () => {
  it("flags missing ranged shooter and melee damage prerequisites", () => {
    const entity = parseEntityDefinition({
      "minecraft:entity": {
        description: { identifier: "demo:fighter" },
        components: {
          "minecraft:behavior.ranged_attack": {},
          "minecraft:behavior.melee_attack": {},
        },
      },
    }, { artifactId: "fixture", relativePath: "entities/fighter.json" });

    const result = analyzeEntityWithKnowledge(
      entity,
      catalog,
      { edition: "bedrock" },
    );

    expect(result.findings.map((item) => item.relationId)).toEqual(
      expect.arrayContaining(["ranged-needs-shooter", "melee-needs-damage"]),
    );
  });
});
