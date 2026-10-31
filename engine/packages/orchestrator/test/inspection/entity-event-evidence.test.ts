// Co-located same-feature source tests; original test cases remain in lexical blocks.
import { describe, expect, it } from "vitest";
import { parseMcFunction } from "../../../../analyzers/functions/src/index.js";
import { parseScriptFile } from "../../../../analyzers/scripts/src/index.js";
import { parseEntityDefinition } from "../../../../analyzers/entities/src/index.js";
import { deriveEntityEventExternalEvidence, externalEventRootsForEntity } from "../../src/inspection/entity-event-evidence.js";
import type { KnowledgeCatalog } from "../../../knowledge/src/index.js";
import { analyzeEntityWithKnowledge } from "../../src/inspection/entity-knowledge-analysis.js";

// Original engine/packages/orchestrator/test/inspection/entity-event-evidence.test.ts; blob 63e71c1ea8b44695e26d7dfe80ee200f8a1ffd4f
{
describe("entity event external evidence", () => {
  it("collects exact summon events, command strings, and literal triggerEvent calls", () => {
    const fn = parseMcFunction(
      "setup/path",
      "summon daigon:path 1 2 3 0 0 daigon:set_path_0",
      { artifactId: "fixture", relativePath: "functions/setup/path.mcfunction" },
    );
    const script = parseScriptFile(
      "scripts/main",
      `
        const command = "/summon daigon:path 4 5 6 0 0 daigon:set_path_1";
        entity.triggerEvent("daigon:next_path");
      `,
      { artifactId: "fixture", relativePath: "scripts/main.js" },
    );

    const evidence = deriveEntityEventExternalEvidence([fn], [script]);
    expect(evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        event: "daigon:set_path_0",
        entityIdentifier: "daigon:path",
        kind: "summon-spawn-event",
      }),
      expect.objectContaining({
        event: "daigon:set_path_1",
        entityIdentifier: "daigon:path",
        kind: "summon-spawn-event",
      }),
      expect.objectContaining({
        event: "daigon:next_path",
        kind: "script-trigger-event",
        executionRegion: expect.any(String),
      }),
    ]));

    const entity = parseEntityDefinition({
      "minecraft:entity": {
        description: { identifier: "daigon:path" },
        events: {
          "daigon:set_path_0": {},
          "daigon:set_path_1": {},
          "daigon:next_path": {},
          "daigon:unused": {},
        },
      },
    }, { artifactId: "fixture", relativePath: "entities/path.json" });

    expect(externalEventRootsForEntity(entity, evidence)).toEqual([
      "daigon:next_path",
      "daigon:set_path_0",
      "daigon:set_path_1",
    ]);
  });
});
}

// Original engine/packages/orchestrator/test/inspection/entity-knowledge-analysis.test.ts; blob 901b8fe1c9eec5cc5fd08c6d49714f6228735265
{
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
    id: "move-needs-target",
    domain: "entity-ai",
    subject: "minecraft:behavior.move_towards_target",
    kind: "requires-any",
    object: "minecraft:behavior.nearest_attackable_target|minecraft:behavior.hurt_by_target",
    applicability: { editions: ["bedrock", "education"] },
    sourceIds: ["official"],
  }],
};

describe("entity knowledge orchestration", () => {
  it("finds a prerequisite gap only in states where the behavior can be active", () => {
    const entity = parseEntityDefinition({
      "minecraft:entity": {
        description: {
          identifier: "demo:mob",
          runtime_identifier: "minecraft:zombie",
        },
        component_groups: {
          moving: { "minecraft:behavior.move_towards_target": {} },
          targeting: { "minecraft:behavior.nearest_attackable_target": {} },
          complete: {
            "minecraft:behavior.move_towards_target": {},
            "minecraft:behavior.nearest_attackable_target": {},
          },
        },
        events: {
          start_complete: { add: { component_groups: ["complete"] } },
        },
      },
    }, { artifactId: "fixture", relativePath: "entities/mob.json" });

    const result = analyzeEntityWithKnowledge(
      entity,
      catalog,
      { edition: "bedrock" },
    );

    expect(result.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ stateId: "group:moving" }),
    ]));
    expect(result.findings.some((item) => item.stateId === "group:complete")).toBe(false);
    expect(result.staticAnalysisLimits).toHaveLength(1);
  });
});
}
