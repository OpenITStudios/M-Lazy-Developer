import { describe, expect, it } from "vitest";
import {
  assessEntityKnowledge,
  type KnowledgeCatalog,
} from "../src/index.js";

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
    id: "move-target-needs-target",
    domain: "entity-ai",
    subject: "minecraft:behavior.move_towards_target",
    kind: "requires-any",
    object: "minecraft:behavior.nearest_attackable_target|minecraft:behavior.hurt_by_target",
    applicability: { editions: ["bedrock", "education"] },
    sourceIds: ["official"],
  }],
};

describe("entity knowledge reasoning", () => {
  it("surfaces missing documented prerequisites", () => {
    expect(assessEntityKnowledge(
      catalog,
      { edition: "bedrock" },
      { activeComponents: ["minecraft:behavior.move_towards_target"] },
    )).toEqual([
      expect.objectContaining({
        relationId: "move-target-needs-target",
        severity: "warning",
      }),
    ]);
  });

  it("accepts an available alternative provider", () => {
    expect(assessEntityKnowledge(
      catalog,
      { edition: "bedrock" },
      {
        activeComponents: [
          "minecraft:behavior.move_towards_target",
          "minecraft:behavior.nearest_attackable_target",
        ],
      },
    )).toEqual([]);
  });
});
