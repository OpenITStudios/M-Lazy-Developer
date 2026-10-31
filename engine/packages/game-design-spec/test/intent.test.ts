import { describe, expect, it } from "vitest";
import {
  intentAuthorityStrength,
  resolveGameDesignIntentRules,
  validateGameDesignSpec,
  migrateLegacyMapClassification,
  type GameDesignSpec,
} from "../src/index.js";

const design: GameDesignSpec = {
  schemaVersion: 1,
  id: "arena",
  status: "approved",
  source: {
    kind: "authored-spec",
    reference: "design/game-design.json",
  },
  mechanics: [],
  intentRules: [{
    id: "friendly-fire",
    statement: "Same-team damage is forbidden during active team play.",
    subjectIds: ["combat:team-damage"],
    outcome: "forbidden",
    appliesWhen: {
      modes: ["offense"],
      phases: ["active"],
      actorTypes: ["player"],
    },
    exceptions: [{
      id: "developer-mode",
      statement: "Developer diagnostics may bypass combat restrictions.",
      stateTags: ["developer"],
    }],
  }],
  invariants: [],
};

describe("Game Design intent resolution", () => {
  it("resolves scoped approved intent with authoritative strength", () => {
    const rules = resolveGameDesignIntentRules(
      design,
      {
        modeId: "offense",
        phase: "active",
        actorType: "player",
      },
      ["combat:team-damage"],
    );
    expect(rules).toHaveLength(1);
    expect(rules[0]?.authority).toBe("authoritative");
    expect(intentAuthorityStrength(design)).toBe("authoritative");
  });

  it("surfaces explicit exceptions instead of treating them as defects", () => {
    const [rule] = resolveGameDesignIntentRules(
      design,
      {
        modeId: "offense",
        phase: "active",
        actorType: "player",
        stateTags: ["developer"],
      },
      ["combat:team-damage"],
    );
    expect(rule?.exceptionId).toBe("developer-mode");
  });

  it("rejects malformed scoped intent rules", () => {
    const errors = validateGameDesignSpec({
      ...design,
      intentRules: [{
        id: "invalid",
        statement: "Invalid scope.",
        outcome: "allowed",
        appliesWhen: {
          actorTypes: ["invalid-actor"],
        },
      }],
    });

    expect(errors.join(" ")).toMatch(/actorTypes/);
  });

  it("accepts canonical resolved map classification", () => {
    const errors = validateGameDesignSpec({
      ...design,
      classification: {
        mapType: "SURVIVAL",
        playerMode: "COOPERATIVE",
        mechanicTags: [
          "WAVE_DEFENSE",
          "ENTITY_AI",
          "ROUND_TIMER",
          "WORLD_RESET",
        ],
        classificationStatus: "RESOLVED",
        evidenceRefs: [
          "design:survival-loop",
        ],
      },
    });

    expect(errors).toEqual([]);
  });

  it("rejects non-canonical map type labels", () => {
    const errors = validateGameDesignSpec({
      ...design,
      classification: {
        mapType: "PvP",
        playerMode: "COMPETITIVE",
        mechanicTags: [],
        classificationStatus: "RESOLVED",
        evidenceRefs: [
          "sheet:map-type",
        ],
      },
    });

    expect(errors.join(" ")).toMatch(
      /mapType is not canonical/,
    );
  });

  it("keeps unresolved classification explicit instead of inventing an UNKNOWN map type", () => {
    const errors = validateGameDesignSpec({
      ...design,
      classification: {
        mapType: null,
        playerMode: null,
        mechanicTags: [],
        classificationStatus:
          "UNRESOLVED",
        evidenceRefs: [],
      },
    });

    expect(errors).toEqual([]);
  });

  it("migrates legacy project labels conservatively without inventing player mode", () => {
    const cases = [
      [
        "Build - Build & Decode",
        "BUILDING",
        ["BUILD"],
      ],
      [
        "PvP - Beach Bedwars",
        "COMBAT",
        [],
      ],
      [
        "Challenge - Defense Map",
        "CHALLENGE_COURSE",
        [],
      ],
      [
        "Find The Button - Mysteries of Biomes / Level 1",
        "SEARCH_PUZZLE",
        ["SEARCH", "PUZZLE"],
      ],
      [
        "Skills - Aftershock",
        "SKILL_COURSE",
        [],
      ],
      [
        "Minigame - The Gauntlet",
        null,
        [],
      ],
    ] as const;

    for (
      const [
        label,
        mapType,
        mechanicTags,
      ] of cases
    ) {
      const result =
        migrateLegacyMapClassification(
          label,
          "workspace:project-registry",
        );

      expect(result).toMatchObject({
        mapType,
        playerMode: null,
        mechanicTags,
        classificationStatus:
          "UNRESOLVED",
        evidenceRefs: [
          "workspace:project-registry",
        ],
      });
    }
  });
});
