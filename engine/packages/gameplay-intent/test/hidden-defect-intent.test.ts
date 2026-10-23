import { describe, expect, it } from "vitest";
import {
  assessMechanicCompleteness,
  challengeDesignIntent,
  selectedArtifactPlayerFacingEvidence,
} from "../src/index.js";

describe("hidden gameplay defect intent analysis", () => {
  it("does not accept implementation-only behavior as grounded design", () => {
    const result = challengeDesignIntent({
      implementationEvidenceIds: ["source:max-concurrent-arenas"],
      independentDesignEvidenceIds: [],
      evidence: [{
        id: "source:max-concurrent-arenas", origin: "source-code",
        scope: "selected-artifact", locator: "scripts/arena.js:10",
        summary: "Source-only limit.",
      }],
    });

    expect(result.disposition).toBe("implementation-only");
  });

  it("accepts independent selected-artifact design evidence", () => {
    const result = challengeDesignIntent({
      implementationEvidenceIds: ["source:limit"],
      independentDesignEvidenceIds: ["design:queue-rule"],
      evidence: [{
        id: "source:limit", origin: "source-code",
        scope: "selected-artifact", locator: "scripts/arena.js:10",
        summary: "Implemented limit.",
      }, {
        id: "design:queue-rule", origin: "game-design-spec",
        scope: "selected-artifact", locator: "design/rules.json:2",
        designStatus: "approved",
        summary: "Approved design.",
      }],
    });

    expect(result.disposition).toBe("grounded-design");
    expect(result.designEvidenceIds).toEqual(["design:queue-rule"]);
  });

  it("rejects technical data, foreign sources and same-site aliases as design", () => {
    const evidence = [{
      id: "source:reset", origin: "command" as const,
      scope: "selected-artifact" as const,
      locator: "functions/reset.mcfunction:1", summary: "Reset command.",
    }, {
      id: "scoreboard:reset", origin: "scoreboard" as const,
      scope: "selected-artifact" as const,
      locator: "world-db/scoreboard", summary: "Technical scoreboard.",
    }, {
      id: "design:alias", origin: "game-design-spec" as const,
      scope: "selected-artifact" as const,
      locator: "functions/reset.mcfunction:1", designStatus: "approved" as const,
      summary: "Same source site.",
    }, {
      id: "design:other-map", origin: "game-design-spec" as const,
      scope: "external-reference" as const,
      locator: "historical/design.json", designStatus: "approved" as const,
      summary: "Outdated design.",
    }];
    const result = challengeDesignIntent({
      implementationEvidenceIds: ["source:reset"],
      independentDesignEvidenceIds: [
        "scoreboard:reset", "design:alias", "design:other-map", "absent",
      ],
      evidence,
    });
    expect(result.disposition).toBe("implementation-only");
    expect(result.designEvidenceIds).toEqual([]);
    expect(selectedArtifactPlayerFacingEvidence(evidence)).toEqual([]);
    expect(challengeDesignIntent({
      implementationEvidenceIds: ["source:reset"],
      independentDesignEvidenceIds: ["design:alias"],
    }).disposition).toBe("ambiguous");
  });

  it("distinguishes draft design from player-facing UI promises", () => {
    const evidence = [{
      id: "source:rule", origin: "source-code" as const,
      scope: "selected-artifact" as const,
      locator: "scripts/round.js:3", summary: "Source checks four waves.",
    }, {
      id: "design:draft", origin: "game-design-spec" as const,
      scope: "selected-artifact" as const,
      locator: "design/round.json#rule", designStatus: "draft" as const,
      summary: "Five-wave draft.",
    }, {
      id: "dialogue:rule", origin: "dialogue" as const,
      scope: "selected-artifact" as const,
      locator: "dialogue/start.json#text", summary: "Survive five waves.",
    }];
    const base = {
      implementationEvidenceIds: ["source:rule"],
      evidence,
    };
    const draft = challengeDesignIntent({
      ...base, independentDesignEvidenceIds: ["design:draft"],
    });
    expect(draft.disposition).toBe("design-claim");
    expect(draft.designEvidenceIds).toEqual([]);
    const presented = challengeDesignIntent({
      ...base, independentDesignEvidenceIds: [],
      playerFacingEvidenceIds: ["dialogue:rule"],
    });
    expect(presented.disposition).toBe("player-facing-claim");
    expect(presented.playerFacingEvidenceIds).toEqual(["dialogue:rule"]);
    expect(selectedArtifactPlayerFacingEvidence(evidence))
      .toEqual(["dialogue:rule"]);
  });

  it("finds incomplete declared mechanics", () => {
    const result = assessMechanicCompleteness({
      mechanicId: "mechanic:shears-attacker",
      stages: {
        declared: true,
        reachable: true,
        triggered: true,
        consumed: false,
        "effect-applied": false,
        "player-visible": false,
      },
    });

    expect(result.complete).toBe(false);
    expect(result.missingStages).toContain("consumed");
    expect(result.missingStages).toContain("effect-applied");
  });
});
