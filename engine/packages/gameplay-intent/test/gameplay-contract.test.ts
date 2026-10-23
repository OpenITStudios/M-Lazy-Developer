import { describe, expect, it } from "vitest";
import {
  buildGameplayContract,
  validateGameplayIntentModel,
  type GameplayIntentModel,
} from "../src/index.js";

function model(
  scope: "selected-artifact" | "external-reference",
): GameplayIntentModel {
  return {
    schemaVersion: 1,
    id: "contract",
    artifactId: "artifact:v1.1.1",
    evidence: [{
      id: "e:intent",
      origin: "source-code",
      locator: "behavior_packs/demo/scripts/game.js",
      summary: "Objective rule.",
      scope,
    }],
    nodes: [{
      id: "objective:flag",
      kind: "objective",
      label: "Flag",
      status: "authored",
      evidenceIds: ["e:intent"],
    }],
    edges: [],
    invariants: [{
      id: "inv:flag",
      statement: "The flag remains completable.",
      strength: "must",
      status: "authored",
      subjectIds: ["objective:flag"],
      evidenceIds: ["e:intent"],
    }],
    unknowns: [],
  };
}

describe("scoped Gameplay Contract", () => {
  it("keeps source-authored implementation evidence without design proof", () => {
    const contract = buildGameplayContract(
      model("selected-artifact"),
      { subjectIds: ["objective:flag"] },
    );
    expect(contract.artifactId).toBe("artifact:v1.1.1");
    expect(contract.evidenceScope).toBe("selected-artifact-only");
    expect(contract.readiness.disposition).toBe("blocked");
    expect(contract.authorityEvidenceIds).toEqual([]);
    expect(contract.implementationEvidenceIds).toEqual(["e:intent"]);
    expect(contract.designChallenge.disposition).toBe("implementation-only");
  });

  it("accepts only separately located approved design from the selected artifact", () => {
    const base = model("selected-artifact");
    const withDesign: GameplayIntentModel = {
      ...base,
      evidence: [...base.evidence, {
        id: "e:design", origin: "game-design-spec",
        locator: "behavior_packs/demo/game_design.json#objective",
        designStatus: "approved",
        summary: "Approved design objective.",
        scope: "selected-artifact",
      }],
      invariants: base.invariants.map(item => ({
        ...item, evidenceIds: [...item.evidenceIds, "e:design"],
      })),
    };
    const contract = buildGameplayContract(
      withDesign, { subjectIds: ["objective:flag"] },
    );
    expect(contract.readiness.disposition).toBe("ready");
    expect(contract.authorityEvidenceIds).toEqual(["e:design"]);
    expect(contract.implementationEvidenceIds).toEqual(["e:intent"]);
    expect(validateGameplayIntentModel(withDesign)).toEqual([]);
  });

  it("does not convert an independent UI promise into approved game design", () => {
    const base = model("selected-artifact");
    const withUi: GameplayIntentModel = {
      ...base,
      evidence: [...base.evidence, {
        id: "e:display", origin: "translation",
        locator: "resource_packs/demo/texts/en_US.lang#win",
        summary: "Return the flag to win.",
        scope: "selected-artifact",
      }],
      invariants: base.invariants.map(item => ({
        ...item, evidenceIds: [...item.evidenceIds, "e:display"],
      })),
    };
    const contract = buildGameplayContract(
      withUi, { subjectIds: ["objective:flag"] },
    );
    expect(contract.readiness.disposition).toBe("blocked");
    expect(contract.designChallenge.disposition).toBe("player-facing-claim");
    expect(contract.playerFacingClaimEvidenceIds).toEqual(["e:display"]);
  });

  it("rejects a forged approval marker on a technical source record", () => {
    const base = model("selected-artifact");
    const invalid: GameplayIntentModel = {
      ...base,
      evidence: base.evidence.map(item => ({
        ...item, designStatus: "approved" as const,
      })),
    };
    expect(validateGameplayIntentModel(invalid).some(item =>
      item.path.includes("designStatus"))).toBe(true);
    expect(buildGameplayContract(invalid, {
      subjectIds: ["objective:flag"],
    }).readiness.disposition).toBe("blocked");
  });

  it("blocks external/reference evidence even when it describes the same mechanic", () => {
    const contract = buildGameplayContract(
      model("external-reference"),
      { subjectIds: ["objective:flag"] },
    );

    expect(contract.readiness.disposition).toBe("blocked");
    expect(contract.authorityEvidenceIds).toEqual([]);
  });

  it("blocks when the model is not bound to one selected artifact", () => {
    const current = model("selected-artifact");
    const {
      artifactId: _artifactId,
      ...withoutArtifact
    } = current;
    const contract = buildGameplayContract(
      withoutArtifact,
      { subjectIds: ["objective:flag"] },
    );

    expect(contract.readiness.disposition).toBe("blocked");
  });
});
