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
    id: "target-needs-types",
    domain: "entity-ai",
    subject: "minecraft:behavior.nearest_attackable_target",
    kind: "requires",
    object: "targeting:configured-entity-types",
    applicability: { editions: ["bedrock", "education"] },
    sourceIds: ["official"],
  }],
};

describe("targeting knowledge orchestration", () => {
  it("flags an active target behavior with no configured valid target types", () => {
    const entity = parseEntityDefinition({
      "minecraft:entity": {
        description: { identifier: "demo:empty_target" },
        components: {
          "minecraft:behavior.nearest_attackable_target": {},
        },
      },
    }, { artifactId: "fixture", relativePath: "entities/empty.json" });

    const result = analyzeEntityWithKnowledge(entity, catalog, { edition: "bedrock" });

    expect(result.targetingProviders).toBe(1);
    expect(result.configuredTargetProviders).toBe(0);
    expect(result.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        relationId: "target-needs-types",
        stateId: "base",
      }),
    ]));
  });
});
