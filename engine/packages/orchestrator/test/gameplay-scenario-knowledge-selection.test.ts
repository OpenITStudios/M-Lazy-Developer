import { buildGameplayAuditScenarioPreset } from "../../diagnostic-reasoning/src/index.js";
import { describe, expect, it } from "vitest";
import { expandGameplayKnowledgeRequirementIds, knowledgeIdsForRequirement } from "../src/inspection/gameplay-scenario-knowledge.js";

describe("gameplay scenario knowledge selection", () => {
  it("expands direct requirements through the existing RIG prerequisite topology", () => {
    const requirements = [
      {
        id: "knowledge:s1:state-flow",
        scenarioId: "s1",
        domain: "state-flow" as const,
        reason: "state",
        capabilityIds: [],
        dependsOnRequirementIds: [],
        subjectIds: [],
        componentIds: [],
      },
      {
        id: "knowledge:s1:chunk-simulation",
        scenarioId: "s1",
        domain: "chunk-simulation" as const,
        reason: "chunk",
        capabilityIds: [],
        dependsOnRequirementIds: [
          "knowledge:s1:state-flow",
          "knowledge:s1:platform-constraints",
        ],
        subjectIds: [],
        componentIds: [],
      },
      {
        id: "knowledge:s1:platform-constraints",
        scenarioId: "s1",
        domain: "platform-constraints" as const,
        reason: "platform",
        capabilityIds: [],
        dependsOnRequirementIds: [
          "knowledge:s1:state-flow",
        ],
        subjectIds: [],
        componentIds: [],
      },
    ];

    expect(
      expandGameplayKnowledgeRequirementIds(
        ["knowledge:s1:chunk-simulation"],
        requirements,
      ),
    ).toEqual([
      "knowledge:s1:chunk-simulation",
      "knowledge:s1:platform-constraints",
      "knowledge:s1:state-flow",
    ]);
  });


  it("selects only exact knowledge records relevant to the scenario domains", () => {
    const requirement = {
      id: "knowledge:s1:platform-constraints",
      scenarioId: "s1",
      domain: "platform-constraints" as const,
      reason: "Need platform semantics.",
      capabilityIds: ["platform-knowledge-applicability"],
      dependsOnRequirementIds: [],
      subjectIds: [],
      componentIds: [],
    };
    const requirements = [
      requirement,
      {
        ...requirement,
        id: "knowledge:s1:chunk-simulation",
        domain: "chunk-simulation" as const,
      },
    ];

    const world = {
      platformKnowledge: {
        profileResolved: true,
        profileSource: "target",
        claims: [
          {
            relationId: "chunks.relevant",
            domain: "chunks",
            kind: "requires",
            subject: "simulation",
            object: "loaded-area",
            status: "satisfied",
            message: "Relevant.",
            knowledgeSourceIds: [],
            evidenceSourceIds: [],
            sources: [],
          },
          {
            relationId: "inventory.unrelated",
            domain: "inventory",
            kind: "requires",
            subject: "slot",
            object: "validity",
            status: "satisfied",
            message: "Unrelated.",
            knowledgeSourceIds: [],
            evidenceSourceIds: [],
            sources: [],
          },
          {
            relationId: "chunks.unknown",
            domain: "chunks",
            kind: "requires",
            subject: "simulation",
            object: "runtime-state",
            status: "unknown",
            message: "Not decisive.",
            knowledgeSourceIds: [],
            evidenceSourceIds: [],
            sources: [],
          },
        ],
      },
    } as any;

    expect(
      knowledgeIdsForRequirement(
        world,
        requirement,
        requirements,
      ),
    ).toEqual(["chunks.relevant"]);
  });
});

describe("map-type and mechanic-specific scenario selection", () => {
  const cases = [
    ["BUILDING", "plot boundaries"],
    ["COMBAT", "damage"],
    ["SURVIVAL", "survival resources"],
    ["STRATEGY", "resource generation"],
    ["SEARCH_PUZZLE", "puzzle action"],
    ["STORY_QUEST", "dialogue and quest"],
    ["CHALLENGE_COURSE", "checkpoints"],
    ["SKILL_COURSE", "instructions"],
  ] as const;

  it("routes resolved map types without suppressing universal map coverage", () => {
    for (const [mapType, needle] of cases) {
      const preset = buildGameplayAuditScenarioPreset({
        classification: {
          mapType, playerMode: "SOLO", mechanicTags: [],
          classificationStatus: "RESOLVED", evidenceRefs: ["authored:classification"],
        },
      });
      const text = preset.scenarios.find(s => s.kind === "map-type-coverage")?.questions.join(" ") ?? "";
      expect(text).toContain(needle);
      expect(preset.scenarios.some(s => s.kind === "full-journey")).toBe(true);
      expect(preset.scenarios.some(s => s.kind === "two-player")).toBe(false);
    }
  });

  it("adds only authored mechanic-specific questions", () => {
    const preset = buildGameplayAuditScenarioPreset({
      classification: {
        mapType: "STORY_QUEST", playerMode: "SOLO",
        mechanicTags: ["MULTI_STAGE", "PERSISTENCE"],
        classificationStatus: "RESOLVED", evidenceRefs: ["source:story"],
      },
    });
    const text = preset.scenarios.find(s => s.kind === "map-type-coverage")?.questions.join(" ") ?? "";
    expect(text).toContain("STORY_QUEST:");
    expect(text).toContain("MULTI_STAGE:");
    expect(text).toContain("PERSISTENCE:");
    expect(text).not.toContain("TEAM_COMBAT:");
    expect(text).not.toContain("SHOP:");
    expect(preset.scenarios.some(s => s.kind === "reload-recovery")).toBe(true);
  });

  it("does not invent map-specific checks for unresolved classification", () => {
    const preset = buildGameplayAuditScenarioPreset({
      classification: {
        mapType: null, playerMode: null, mechanicTags: [],
        classificationStatus: "UNRESOLVED", evidenceRefs: [],
      },
    });
    expect(preset.scenarios.some(s => s.kind === "map-type-coverage")).toBe(false);
    expect(preset.scenarios.some(s => s.kind === "full-journey")).toBe(true);
  });
});
