// Pinned same-feature gameplay intent source suites, original bodies retained.
import { describe, expect, it } from "vitest";
import { resolveGameplayAuthority, compareGameplayIntentModels, assessGameplayDesignReadiness, assessGameplayModelClosure, buildIntentClosureSurfaces, buildGameplayContract, validateGameplayIntentModel, assessGameplayIntentGrounding, deriveUnknownGameplayEvidenceInquiry, admitReviewedUnknownSourceRelations, assessGameplayRouteObservation, evaluateGameplayOutcomeAdmissibility, evaluateGameplayPolicyPredicate, gameplayOutcomePolicyRequirements, planGameplayOutcomeRuntimeObservations, findNearestGameplayRoutePoint, projectGameplayRoutePoint, resolveGameplayRouteIndex, resolveGameplayRouteTarget, resolveGameplaySpatialContext, unresolvedGameplayPolicyOperands, assessMechanicCompleteness, challengeDesignIntent, selectedArtifactPlayerFacingEvidence, assessGameplayStateClosure } from "../src/index.js";
import type { GameplayAuthorityClaim, GameplayIntentModel } from "../src/index.js";

// Original engine/packages/gameplay-intent/test/authority.test.ts; blob 4d6b785e904ccf8c258026186aa162b53e0d8b6f
{
function claim(
  partial: Partial<GameplayAuthorityClaim> &
    Pick<GameplayAuthorityClaim, "id" | "value">,
): GameplayAuthorityClaim {
  return {
    domain: "intended-gameplay",
    freshness: "current",
    source: "selected-artifact",
    scope: "capture-run/retry",
    ...partial,
  };
}

describe("gameplay authority resolution", () => {
  it("uses the selected artifact as the only current intended-gameplay authority", () => {
    const result = resolveGameplayAuthority([
      claim({
        id: "selected",
        value: "persist",
      }),
      claim({
        id: "external-doc",
        source: "approved-game-design",
        value: "reset",
      }),
    ], "intended-gameplay", "capture-run/retry");

    expect(result.disposition).toBe("resolved");
    expect(result.value).toBe("persist");
    expect(result.basisClaimIds).toEqual(["selected"]);
  });

  it("does not promote external current documents into current gameplay intent", () => {
    const result = resolveGameplayAuthority([
      claim({
        id: "external-doc",
        source: "current-gameplay-documentation",
        value: "reset",
      }),
    ], "intended-gameplay", "capture-run/retry");

    expect(result.disposition).toBe("unknown");
  });

  it("keeps conflicts inside the selected artifact ambiguous", () => {
    const result = resolveGameplayAuthority([
      claim({ id: "a", value: "reset" }),
      claim({ id: "b", value: "persist" }),
    ], "intended-gameplay", "capture-run/retry");

    expect(result.disposition).toBe("ambiguous");
  });

  it("never promotes historical evidence into current intent", () => {
    const result = resolveGameplayAuthority([
      claim({
        id: "old",
        freshness: "historical",
        source: "historical-evidence",
        value: "reset",
      }),
    ], "intended-gameplay", "capture-run/retry");

    expect(result.disposition).toBe("unknown");
    expect(result.historicalHintIds).toEqual(["old"]);
  });

  it("keeps scope exact instead of borrowing adjacent rules", () => {
    const result = resolveGameplayAuthority([
      claim({
        id: "same-tier",
        scope: "capture-run/retry",
        value: "persist",
      }),
    ], "intended-gameplay", "capture-run/next-tier");

    expect(result.disposition).toBe("unknown");
  });

  it("uses runtime as actual behavior authority without redefining intent", () => {
    const claims: GameplayAuthorityClaim[] = [
      {
        id: "runtime",
        domain: "actual-behavior",
        freshness: "current",
        source: "current-runtime-observation",
        scope: "defense/npc-route",
        value: "stalls",
      },
    ];

    expect(resolveGameplayAuthority(
      claims,
      "actual-behavior",
      "defense/npc-route",
    ).value).toBe("stalls");

    expect(resolveGameplayAuthority(
      claims,
      "intended-gameplay",
      "defense/npc-route",
    ).disposition).toBe("unknown");
  });
});
}

// Original engine/packages/gameplay-intent/test/compare.test.ts; blob 2ec11f46d003e449be54e7b16f9ae8eab4623ab6
{
function baseModel(
  id: string,
): GameplayIntentModel {
  return {
    schemaVersion: 1,
    id,
    artifactId: id,
    evidence: [{
      id: "e:state",
      origin: "source-code",
      locator: "scripts/state.js",
      summary: "Authored state.",
    }],
    nodes: [{
      id: "state:active",
      kind: "state",
      label: "Active",
      status: "authored",
      evidenceIds: ["e:state"],
    }],
    edges: [],
    invariants: [{
      id: "inv:active",
      statement: "Active is a valid authored state.",
      strength: "must",
      status: "authored",
      subjectIds: ["state:active"],
      evidenceIds: ["e:state"],
    }],
    unknowns: [],
  };
}

describe("gameplay intent historical comparison", () => {
  it("treats artifact identity changes as intent-stable when semantics are unchanged", () => {
    const before = baseModel("old-artifact");
    const after: GameplayIntentModel = {
      ...baseModel("new-artifact"),
      evidence: [{
        id: "e:state-new",
        origin: "source-code",
        locator: "scripts/state.js",
        summary: "Same authored state in repackaged artifact.",
      }],
      nodes: [{
        ...baseModel("new-artifact").nodes[0]!,
        evidenceIds: ["e:state-new"],
      }],
      invariants: [{
        ...baseModel("new-artifact").invariants[0]!,
        evidenceIds: ["e:state-new"],
      }],
    };

    const result = compareGameplayIntentModels(
      before,
      after,
    );

    expect(result.disposition).toBe("stable");
    expect(result.semanticallyStable).toBe(true);
    expect(result.added.nodeIds).toEqual([]);
    expect(result.removed.nodeIds).toEqual([]);
    expect(result.nodeEvidenceOriginChanges).toEqual([]);
  });

  it("reports pure semantic expansion separately from replacement", () => {
    const before = baseModel("old");
    const after: GameplayIntentModel = {
      ...baseModel("new"),
      evidence: [
        ...baseModel("new").evidence,
        {
          id: "e:cleanup",
          origin: "source-code",
          locator: "scripts/cleanup.js",
          summary: "Cleanup lifecycle.",
        },
      ],
      nodes: [
        ...baseModel("new").nodes,
        {
          id: "lifecycle:cleanup",
          kind: "lifecycle",
          label: "Cleanup",
          status: "inferred",
          evidenceIds: ["e:cleanup"],
        },
      ],
      edges: [{
        id: "edge:cleanup-active",
        from: "lifecycle:cleanup",
        to: "state:active",
        kind: "recovers-to",
        status: "inferred",
        evidenceIds: ["e:cleanup"],
      }],
    };

    const result = compareGameplayIntentModels(
      before,
      after,
    );

    expect(result.disposition).toBe("expanded");
    expect(result.added.nodeIds).toEqual([
      "lifecycle:cleanup",
    ]);
    expect(result.added.edgeKeys).toEqual([
      "recovers-to::lifecycle:cleanup::state:active",
    ]);
  });

  it("records status and evidence-origin changes as semantic history changes", () => {
    const before = baseModel("old");
    const after: GameplayIntentModel = {
      ...baseModel("new"),
      evidence: [{
        id: "e:runtime",
        origin: "historical-diff",
        locator: "history",
        summary: "Historical corroboration.",
      }],
      nodes: [{
        ...baseModel("new").nodes[0]!,
        status: "inferred",
        evidenceIds: ["e:runtime"],
      }],
      invariants: [{
        ...baseModel("new").invariants[0]!,
        status: "inferred",
        evidenceIds: ["e:runtime"],
      }],
    };

    const result = compareGameplayIntentModels(
      before,
      after,
    );

    expect(result.disposition).toBe("changed");
    expect(result.nodeStatusChanges).toEqual([{
      id: "state:active",
      before: "authored",
      after: "inferred",
    }]);
    expect(result.nodeEvidenceOriginChanges).toEqual([{
      id: "state:active",
      before: ["source-code"],
      after: ["historical-diff"],
    }]);
    expect(result.invariantChanges).toEqual([{
      id: "inv:active",
      changedFields: ["status"],
    }]);
  });
});
}

// Original engine/packages/gameplay-intent/test/design-readiness.test.ts; blob ae90e2304049f568b4a9ea7c9390206badfd009e
{
const model: GameplayIntentModel = {
  schemaVersion: 1,
  id: "design-readiness",
  evidence: [],
  nodes: [{
    id: "objective:flag",
    kind: "objective",
    label: "Flag",
    status: "authored",
    evidenceIds: [],
  }, {
    id: "objective:other",
    kind: "objective",
    label: "Other independently scoped objective",
    status: "authored",
    evidenceIds: [],
  }],
  edges: [],
  invariants: [],
  unknowns: [{
    id: "unknown:retry",
    question: "Should objective state reset on retry?",
    blockedSubjectIds: ["objective:flag"],
  }],
};

describe("gameplay design readiness", () => {
  it("blocks when selected-artifact contract evidence is missing", () => {
    const result = assessGameplayDesignReadiness(
      model,
      {
        scopeSubjectIds: ["objective:flag"],
      },
    );

    expect(result.disposition).toBe("blocked");
    expect(result.reasons.join(" ")).toMatch(/selected map artifact/i);
  });


  it("blocks when a material unknown affects the audit scope", () => {
    const result = assessGameplayDesignReadiness(
      model,
      {
        scopeSubjectIds: ["objective:flag"],
        authoritativeDesignAvailable: true,
        materialUnknownIds: ["unknown:retry"],
      },
    );

    expect(result.disposition).toBe("blocked");
  });

  it("allows partial readiness only for explicitly non-material unknowns", () => {
    const result = assessGameplayDesignReadiness(
      model,
      {
        scopeSubjectIds: ["objective:flag"],
        authoritativeDesignAvailable: true,
        nonMaterialUnknownIds: ["unknown:retry"],
      },
    );

    expect(result.disposition).toBe("partial");
  });

  it("is ready when no scoped material unknown remains", () => {
    const result = assessGameplayDesignReadiness(
      model,
      {
        scopeSubjectIds: ["objective:other"],
        authoritativeDesignAvailable: true,
      },
    );

    expect(result.disposition).toBe("ready");
  });

  const scoped = {
    scopeSubjectIds: ["objective:flag"],
    authoritativeDesignAvailable: true,
  };

  it("does not erase unlisted unknowns when a partial material list is supplied", () => {
    const result = assessGameplayDesignReadiness({
      ...model,
      unknowns: [...model.unknowns, {
        id: "unknown:reward", question: "Which reward applies?",
        blockedSubjectIds: ["objective:flag"],
      }],
    }, { ...scoped, materialUnknownIds: ["unknown:retry"] });
    expect(result.blockingUnknownIds).toEqual(["unknown:retry", "unknown:reward"]);
  });

  it("retains questions with no subject or a missing subject", () => {
    for (const blockedSubjectIds of [[], ["objective:missing"]]) {
      const result = assessGameplayDesignReadiness({
        ...model,
        unknowns: [{ id: "unknown:unbound", question: "Owner?", blockedSubjectIds }],
      }, scoped);
      expect(result.blockingUnknownIds).toEqual(["unknown:unbound"]);
    }
  });

  it("gives material classification precedence over an overlapping tolerance", () => {
    const result = assessGameplayDesignReadiness(model, {
      ...scoped,
      materialUnknownIds: ["unknown:retry"],
      nonMaterialUnknownIds: ["unknown:retry"],
    });
    expect(result.blockingUnknownIds).toEqual(["unknown:retry"]);
    expect(result.toleratedUnknownIds).toEqual([]);
  });

  it("rejects stale question selections rather than manufacturing readiness", () => {
    const result = assessGameplayDesignReadiness(model, {
      ...scoped, materialUnknownIds: ["unknown:stale"],
    });
    expect(result.disposition).toBe("blocked");
    expect(result.blockingUnknownIds).toEqual(["unknown:retry"]);
    expect(result.reasons.join(" ")).toContain("unknown:stale");
  });

  it("requires a nonempty scope with real selected-model subjects", () => {
    for (const scopeSubjectIds of [[], ["objective:missing"]]) {
      expect(assessGameplayDesignReadiness(model, {
        ...scoped, scopeSubjectIds,
      }).disposition).toBe("blocked");
    }
  });
});
}

// Original engine/packages/gameplay-intent/test/gameplay-closure.test.ts; blob 75a39da73f4637d51683172b4af5f445e56449e3
{
const intent: GameplayIntentModel = {
  schemaVersion: 1,
  id: "closure:test",
  artifactId: "map:test",
  evidence: [],
  nodes: [
    {
      id: "phase:lobby",
      kind: "phase",
      label: "Lobby",
      status: "authored",
      evidenceIds: [],
    },
    {
      id: "phase:combat",
      kind: "phase",
      label: "Combat",
      status: "authored",
      evidenceIds: [],
    },
  ],
  edges: [],
  invariants: [],
  unknowns: [],
};

describe("gameplay model closure", () => {
  it("stays OPEN after complete source recognition when no gameplay has been reconstructed", () => {
    const result = assessGameplayModelClosure({
      discoveredSurfaceIds: [],
      surfaces: [],
      stateModelComplete: true,
      boundariesExtracted: true,
    });
    expect(result.status).toBe("OPEN");
    expect(result.reasons.join(" ")).toContain("source recognition alone");
  });

  it("does not confuse a generic game/root with reconstructed mechanics", () => {
    const result = assessGameplayModelClosure({
      discoveredSurfaceIds: ["game:root", "runtime:state"],
      surfaces: [
        { id: "game:root", label: "Map", kind: "game", material: true, status: "understood" },
        { id: "runtime:state", label: "State present", kind: "runtime-domain", material: true, status: "understood" },
      ],
      stateModelComplete: true,
      boundariesExtracted: true,
    });
    expect(result.status).toBe("OPEN");
  });

  it("is OPEN when the state model is incomplete", () => {
    const surfaces = buildIntentClosureSurfaces(intent);
    const result = assessGameplayModelClosure({
      discoveredSurfaceIds: surfaces.map((surface) => surface.id),
      surfaces,
      stateModelComplete: false,
      boundariesExtracted: true,
    });

    expect(result.status).toBe("OPEN");
  });

  it("is PARTIAL when material boundaries remain unresolved", () => {
    const surfaces = buildIntentClosureSurfaces(intent);
    const result = assessGameplayModelClosure({
      discoveredSurfaceIds: surfaces.map((surface) => surface.id),
      surfaces,
      stateModelComplete: true,
      boundariesExtracted: false,
    });

    expect(result.status).toBe("PARTIAL");
  });

  it("is PARTIAL when a material surface remains unknown", () => {
    const surfaces = [
      ...buildIntentClosureSurfaces(intent),
      {
        id: "runtime:arena-capacity",
        label: "Arena capacity",
        kind: "runtime-domain" as const,
        status: "unknown" as const,
        material: true,
        reason: "Concurrent capacity is unresolved.",
      },
    ];

    const result = assessGameplayModelClosure({
      discoveredSurfaceIds: surfaces.map((surface) => surface.id),
      surfaces,
      stateModelComplete: true,
      boundariesExtracted: true,
    });

    expect(result.status).toBe("PARTIAL");
    expect(result.unknownSurfaceIds).toContain(
      "runtime:arena-capacity",
    );
  });

  it("keeps inferred material surfaces unresolved until grounded", () => {
    const inferredModel: GameplayIntentModel = {
      ...intent,
      nodes: [
        {
          id: "resource:max-concurrent-arenas",
          kind: "resource",
          label: "Max Concurrent Arenas",
          status: "inferred",
          evidenceIds: [],
        },
      ],
    };
    const surfaces =
      buildIntentClosureSurfaces(inferredModel);

    expect(surfaces[0]?.status).toBe("unknown");
    expect(surfaces[0]?.material).toBe(true);
  });

  it("retains unowned source gaps in whole-game closure without inventing mechanics", () => {
    const model: GameplayIntentModel = {
      ...intent,
      unknowns: [
        {
          id: "unknown:script-tag-dynamic-key:region-1",
          question: "Selected-artifact tag key unresolved.",
          blockedSubjectIds: [],
          evidenceIds: ["state-op:dynamic-tag"],
        },
        {
          id: "unknown:unplaced",
          question: "An observed dependency has an unresolved owner.",
          blockedSubjectIds: ["phase:combat", "state:missing"],
          evidenceIds: ["state-op:unplaced"],
        },
      ],
    };
    const surfaces = buildIntentClosureSurfaces(model);
    const result = assessGameplayModelClosure({
      discoveredSurfaceIds: intent.nodes.map(node => node.id),
      surfaces,
      stateModelComplete: true,
      boundariesExtracted: true,
    });
    expect(result.status).toBe("PARTIAL");
    expect(result.unknownSurfaceIds).toEqual([
      "intent-unknown:unknown:script-tag-dynamic-key:region-1",
      "intent-unknown:unknown:unplaced",
      "phase:combat",
    ]);
    expect(surfaces.find(item =>
      item.id === "intent-unknown:unknown:script-tag-dynamic-key:region-1"
    )?.evidenceIds).toEqual(["state-op:dynamic-tag"]);
    expect(result.unaccountedSurfaceIds).toEqual([]);
  });

  it("is CLOSED only when all discovered material surfaces are accounted", () => {
    const surfaces = buildIntentClosureSurfaces(intent);
    const result = assessGameplayModelClosure({
      discoveredSurfaceIds: surfaces.map((surface) => surface.id),
      surfaces,
      stateModelComplete: true,
      boundariesExtracted: true,
    });

    expect(result.status).toBe("CLOSED");
    expect(result.unaccountedSurfaceIds).toEqual([]);
  });
});
}

// Original engine/packages/gameplay-intent/test/gameplay-contract.test.ts; blob a485ec6a7ab32caa16752f13fbeb7685b7cc1cfe
{
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
}

// Original engine/packages/gameplay-intent/test/gameplay-intent.test.ts; blob 18b67ac6c83aff1c9b0125b69014b562bd69a879
{
const model: GameplayIntentModel = {
  schemaVersion: 1,
  id: "builder-memory",
  evidence: [
    {
      id: "e:phase",
      origin: "source-code",
      locator: "scripts/game/countdown.js",
      summary: "Source defines observation before building.",
    },
    {
      id: "e:plot",
      origin: "source-code",
      locator: "scripts/game/geometry.js",
      summary: "Source defines an assigned build plot.",
    },
  ],
  nodes: [
    {
      id: "phase:observation",
      kind: "phase",
      label: "Observation",
      status: "authored",
      evidenceIds: ["e:phase"],
    },
    {
      id: "mechanic:plot-build",
      kind: "mechanic",
      label: "Build in assigned plot",
      status: "authored",
      evidenceIds: ["e:plot"],
    },
  ],
  edges: [
    {
      id: "edge:observation-before-build",
      from: "phase:observation",
      to: "mechanic:plot-build",
      kind: "requires",
      status: "authored",
      evidenceIds: ["e:phase"],
    },
  ],
  invariants: [
    {
      id: "inv:plot-only",
      statement: "Player building is scoped to the assigned plot.",
      strength: "must",
      status: "authored",
      subjectIds: ["mechanic:plot-build"],
      evidenceIds: ["e:plot"],
    },
  ],
  unknowns: [],
};

describe("gameplay intent", () => {
  it("validates evidence-grounded graph references", () => {
    expect(validateGameplayIntentModel(model)).toEqual([]);
  });

  it("adopts only exact reviewed source relations without creating a gameplay mechanic", () => {
    const unknownModel: GameplayIntentModel = {
      ...model, artifactId: "map:selected",
      evidence: [
        { id: "op:write", origin: "source-code", scope: "selected-artifact",
          locator: "behavior_packs/demo/scripts/main.js:10:4", summary: "write site" },
        { id: "effect:gate", origin: "source-code", scope: "selected-artifact",
          locator: "behavior_packs/demo/scripts/main.js:12:4", summary: "effect site" },
        { id: "op:foreign", origin: "historical-diff", scope: "external-reference",
          locator: "old/scripts/main.js:10:4", summary: "old map" },
      ],
      nodes: [], edges: [], invariants: [],
      unknowns: [{
        id: "unknown:entry", question: "What is this unknown gameplay action?",
        blockedSubjectIds: [], sourceEntryRegionId: "exec:entry",
        evidenceIds: ["op:write", "effect:gate"],
      }],
    };
    const proposal = {
      unknownId: "unknown:entry",
      sourceClaim: "SOURCE_GUARD_VALUE_HANDOFF_CANDIDATE" as const,
      fromStepId: "op:write", toStepId: "effect:gate",
      sourceRelationEvidenceIds: ["effect:gate", "op:write"],
    };
    const accepted = admitReviewedUnknownSourceRelations(unknownModel, [proposal]);
    expect(validateGameplayIntentModel(accepted)).toEqual([]);
    expect(accepted.nodes).toEqual([]);
    expect(accepted.edges).toEqual([]);
    expect(accepted.unknowns[0]?.question).toBe(unknownModel.unknowns[0]?.question);
    expect(accepted.unknowns[0]?.sourceRelations).toMatchObject([{
      sourceClaim: "SOURCE_GUARD_VALUE_HANDOFF_CANDIDATE",
      proofBoundary: "REVIEWED_TYPED_SOURCE_RELATION_NOT_GAMEPLAY_OR_RUNTIME_PROOF",
      evidenceIds: ["effect:gate", "op:write"],
    }]);
    expect(() => admitReviewedUnknownSourceRelations(accepted, [proposal]))
      .toThrow(/already reviewed/);
    const invalid = {
      ...accepted,
      unknowns: [{ ...accepted.unknowns[0]!,
        sourceRelations: [
          ...(accepted.unknowns[0]!.sourceRelations ?? []),
          ...(accepted.unknowns[0]!.sourceRelations ?? []),
        ] }],
    };
    expect(validateGameplayIntentModel(invalid).some(issue =>
      issue.path.includes("sourceRelations"))).toBe(true);
    expect(() => admitReviewedUnknownSourceRelations(unknownModel, [{
      ...proposal, fromStepId: "op:foreign",
      sourceRelationEvidenceIds: ["op:foreign", "effect:gate"],
    }])).toThrow(/unowned, non-source or ambiguous/);
    expect(() => admitReviewedUnknownSourceRelations(unknownModel, [{
      ...proposal, unknownId: "unknown:other",
    }])).toThrow(/unowned, non-source or ambiguous/);
  });

  it("reports grounded subjects when no open intent question blocks them", () => {
    expect(
      assessGameplayIntentGrounding(
        model,
        ["mechanic:plot-build"],
      ).disposition,
    ).toBe("grounded");
  });

  it("evaluates structured policy predicates deterministically", () => {
    expect(
      evaluateGameplayPolicyPredicate(
        {
          kind: "truthy",
          operand: {
            kind: "path",
            path: "state.pendingCleanup",
          },
        },
        {
          state: {
            pendingCleanup: true,
            phase: "active",
          },
        },
      ),
    ).toBe("satisfied");

    expect(
      evaluateGameplayPolicyPredicate(
        {
          kind: "comparison",
          operator: "eq",
          left: {
            kind: "path",
            path: "state.phase",
          },
          right: {
            kind: "literal",
            value: "active",
          },
        },
        {
          state: {
            phase: "countdown",
          },
        },
      ),
    ).toBe("violated");

    expect(
      evaluateGameplayPolicyPredicate(
        {
          kind: "comparison",
          operator: "neq",
          left: {
            kind: "path",
            path: "record.generation",
          },
          right: {
            kind: "path",
            path: "session.generation",
          },
        },
        {
          record: {
            generation: 3,
          },
          session: {
            generation: 4,
          },
        },
      ),
    ).toBe("satisfied");

    expect(
      evaluateGameplayPolicyPredicate(
        {
          kind: "in",
          operand: {
            kind: "path",
            path: "state.phase",
          },
          values: [
            "countdown",
            "preparing",
            "resetting",
            "cinematic",
          ],
        },
        {
          state: {
            phase: "preparing",
          },
        },
      ),
    ).toBe("satisfied");

    expect(
      evaluateGameplayPolicyPredicate(
        {
          kind: "fallback",
          excludedPredicates: [
            {
              kind: "comparison",
              operator: "eq",
              left: {
                kind: "path",
                path: "state.phase",
              },
              right: {
                kind: "literal",
                value: "active",
              },
            },
            {
              kind: "in",
              operand: {
                kind: "path",
                path: "state.phase",
              },
              values: ["countdown", "preparing"],
            },
          ],
        },
        {
          state: {
            phase: "finishing",
          },
        },
      ),
    ).toBe("satisfied");

    expect(
      evaluateGameplayPolicyPredicate(
        {
          kind: "truthy",
          operand: {
            kind: "path",
            path: "missing.value",
          },
        },
        {},
      ),
    ).toBe("unknown");
  });

  it("evaluates indexed policy operands from runtime state", () => {
    const predicate = {
      kind: "falsy" as const,
      operand: {
        kind: "index" as const,
        base: {
          kind: "path" as const,
          path: "session.roster",
        },
        key: {
          kind: "path" as const,
          path: "record.playerId",
        },
      },
    };

    expect(
      evaluateGameplayPolicyPredicate(
        predicate,
        {
          record: { playerId: "player-a" },
          session: {
            roster: {
              "player-a": true,
            },
          },
        },
      ),
    ).toBe("violated");

    expect(
      evaluateGameplayPolicyPredicate(
        predicate,
        {
          record: { playerId: "player-a" },
          session: {
            roster: {
              "player-a": false,
            },
          },
        },
      ),
    ).toBe("satisfied");

    expect(
      evaluateGameplayPolicyPredicate(
        predicate,
        {
          record: { playerId: "player-b" },
          session: {
            roster: {
              "player-a": true,
            },
          },
        },
      ),
    ).toBe("unknown");
  });

  it("reports exact unresolved runtime policy operands", () => {
    const predicate = {
      kind: "all" as const,
      predicates: [
        {
          kind: "comparison" as const,
          operator: "neq" as const,
          left: {
            kind: "path" as const,
            path: "record.generation",
          },
          right: {
            kind: "path" as const,
            path: "session.generation",
          },
        },
        {
          kind: "falsy" as const,
          operand: {
            kind: "index" as const,
            base: {
              kind: "path" as const,
              path: "session.roster",
            },
            key: {
              kind: "path" as const,
              path: "record.playerId",
            },
          },
        },
      ],
    };

    const unresolved = unresolvedGameplayPolicyOperands(
      predicate,
      {
        record: {
          generation: 4,
          playerId: "player-a",
        },
      },
    );

    expect(unresolved).toEqual(expect.arrayContaining([
      {
        kind: "path",
        path: "session.generation",
      },
      {
        kind: "index",
        base: {
          kind: "path",
          path: "session.roster",
        },
        key: {
          kind: "path",
          path: "record.playerId",
        },
      },
    ]));
  });

  it("lists policy requirements for targeted runtime observation", () => {
    const policyModel: GameplayIntentModel = {
      schemaVersion: 1,
      id: "requirements",
      evidence: [{
        id: "e:policy",
        origin: "source-code",
        locator: "recovery-policy.ts",
        summary: "Recovery guard.",
      }],
      nodes: [
        {
          id: "outcome:resume",
          kind: "outcome",
          label: "Resume",
          status: "authored",
          evidenceIds: ["e:policy"],
        },
        {
          id: "policy:active",
          kind: "policy",
          label: "Active phase",
          status: "authored",
          evidenceIds: ["e:policy"],
          policyPredicate: {
            kind: "comparison",
            operator: "eq",
            left: {
              kind: "path",
              path: "session.phase",
            },
            right: {
              kind: "literal",
              value: "active",
            },
          },
        },
      ],
      edges: [{
        id: "edge:resume-active",
        from: "outcome:resume",
        to: "policy:active",
        kind: "requires",
        status: "authored",
        evidenceIds: ["e:policy"],
      }],
      invariants: [],
      unknowns: [],
    };

    expect(
      gameplayOutcomePolicyRequirements(
        policyModel,
        "outcome:resume",
      ),
    ).toEqual([
      expect.objectContaining({
        policyId: "policy:active",
        operands: [{
          kind: "path",
          path: "session.phase",
        }],
      }),
    ]);
  });

  it("plans concrete and deferred runtime observations for missing policy state", () => {
    const policyModel: GameplayIntentModel = {
      schemaVersion: 1,
      id: "runtime-needs",
      evidence: [{
        id: "e:policy",
        origin: "source-code",
        locator: "recovery-policy.ts",
        summary: "Membership and phase guards.",
      }],
      nodes: [
        {
          id: "outcome:cleanup",
          kind: "outcome",
          label: "Cleanup",
          status: "authored",
          evidenceIds: ["e:policy"],
        },
        {
          id: "policy:membership",
          kind: "policy",
          label: "Missing membership",
          status: "authored",
          evidenceIds: ["e:policy"],
          policyPredicate: {
            kind: "falsy",
            operand: {
              kind: "index",
              base: {
                kind: "path",
                path: "session.roster",
              },
              key: {
                kind: "path",
                path: "record.playerId",
              },
            },
          },
        },
      ],
      edges: [{
        id: "edge:membership",
        from: "outcome:cleanup",
        to: "policy:membership",
        kind: "requires",
        status: "authored",
        evidenceIds: ["e:policy"],
      }],
      invariants: [],
      unknowns: [],
    };

    expect(
      planGameplayOutcomeRuntimeObservations(
        policyModel,
        "outcome:cleanup",
        {
          record: {
            playerId: "player-a",
          },
        },
      ),
    ).toEqual([
      expect.objectContaining({
        policyId: "policy:membership",
        expression:
          "session.roster[record.playerId]",
        paths: ["session.roster.player-a"],
        deferred: false,
      }),
    ]);

    expect(
      planGameplayOutcomeRuntimeObservations(
        policyModel,
        "outcome:cleanup",
        {},
      ),
    ).toEqual([
      expect.objectContaining({
        expression:
          "session.roster[record.playerId]",
        paths: ["record.playerId"],
        deferred: true,
      }),
    ]);
  });

  it("evaluates outcome admissibility across authored policy guards", () => {
    const policyModel: GameplayIntentModel = {
      schemaVersion: 1,
      id: "reconnect-policy",
      evidence: [{
        id: "e:policy",
        origin: "source-code",
        locator: "src/recovery-policy.ts",
        summary: "Direct guarded cleanup outcome.",
      }],
      nodes: [
        {
          id: "outcome:cleanup",
          kind: "outcome",
          label: "Cleanup",
          status: "authored",
          evidenceIds: ["e:policy"],
        },
        {
          id: "policy:pending-cleanup",
          kind: "policy",
          label: "Pending Cleanup",
          status: "authored",
          evidenceIds: ["e:policy"],
          policyPredicate: {
            kind: "truthy",
            operand: {
              kind: "path",
              path: "state.pendingCleanup",
            },
          },
        },
      ],
      edges: [{
        id: "edge:cleanup-policy",
        from: "outcome:cleanup",
        to: "policy:pending-cleanup",
        kind: "requires",
        status: "authored",
        evidenceIds: ["e:policy"],
      }],
      invariants: [{
        id: "inv:cleanup-policy",
        statement: "Cleanup is admissible only under known guards.",
        strength: "must",
        status: "inferred",
        subjectIds: ["outcome:cleanup"],
        evidenceIds: ["e:policy"],
      }],
      unknowns: [],
    };

    expect(
      evaluateGameplayOutcomeAdmissibility(
        policyModel,
        "outcome:cleanup",
        { state: { pendingCleanup: true } },
      ).disposition,
    ).toBe("admissible");

    expect(
      evaluateGameplayOutcomeAdmissibility(
        policyModel,
        "outcome:cleanup",
        { state: { pendingCleanup: false } },
      ).disposition,
    ).toBe("inadmissible");

    expect(
      evaluateGameplayOutcomeAdmissibility(
        {
          ...policyModel,
          unknowns: [{
            id: "unknown:coverage",
            question: "Other cleanup branches are unresolved.",
            blockedSubjectIds: ["outcome:cleanup"],
          }],
        },
        "outcome:cleanup",
        { state: { pendingCleanup: false } },
      ).disposition,
    ).toBe("unknown");
  });

  it("resolves route-index ambiguity without guessing", () => {
    const routeModel: GameplayIntentModel = {
      schemaVersion: 1,
      id: "routes",
      evidence: [{
        id: "e:routes",
        origin: "source-code",
        locator: "scripts/routes.js",
        summary: "Authored route points.",
      }],
      nodes: [
        {
          id: "spatial-region:route-main",
          kind: "spatial-region",
          label: "Route Main",
          status: "authored",
          evidenceIds: ["e:routes"],
          spatialProfile: {
            coordinateSpace: "unknown",
            routeId: "main",
            points: [
              { x: 0, y: 0, z: 0, index: 9 },
            ],
            indexRanges: [{ min: 0, max: 18 }],
          },
        },
        {
          id: "spatial-region:route-bridge",
          kind: "spatial-region",
          label: "Route Bridge",
          status: "authored",
          evidenceIds: ["e:routes"],
          spatialProfile: {
            coordinateSpace: "unknown",
            routeId: "bridge",
            points: [
              { x: 1, y: 0, z: 0, index: 9 },
              { x: 2, y: 0, z: 0, index: 600 },
            ],
            indexRanges: [
              { min: 3, max: 13 },
              { min: 600, max: 610 },
            ],
          },
        },
        {
          id: "spatial-region:route-windmill",
          kind: "spatial-region",
          label: "Route Windmill",
          status: "authored",
          evidenceIds: ["e:routes"],
          spatialProfile: {
            coordinateSpace: "unknown",
            routeId: "windmill",
            points: [
              { x: 3, y: 0, z: 0, index: 9 },
            ],
            indexRanges: [
              { min: 6, max: 9 },
              { min: 500, max: 503 },
            ],
          },
        },
      ],
      edges: [],
      invariants: [],
      unknowns: [],
    };

    expect(
      resolveGameplayRouteIndex(routeModel, 9),
    ).toEqual({
      index: 9,
      disposition: "ambiguous",
      routeNodeIds: [
        "spatial-region:route-bridge",
        "spatial-region:route-main",
        "spatial-region:route-windmill",
      ],
      routeIds: ["bridge", "main", "windmill"],
    });

    expect(
      resolveGameplayRouteIndex(routeModel, 600),
    ).toEqual({
      index: 600,
      disposition: "unique",
      routeNodeIds: [
        "spatial-region:route-bridge",
      ],
      routeIds: ["bridge"],
    });

    expect(
      resolveGameplayRouteIndex(routeModel, 999),
    ).toEqual({
      index: 999,
      disposition: "unresolved",
      routeNodeIds: [],
      routeIds: [],
    });
  });

  it("projects local route points into authored arena world coordinates", () => {
    const routeModel: GameplayIntentModel = {
      schemaVersion: 1,
      id: "projected-routes",
      evidence: [{
        id: "e:route",
        origin: "source-code",
        locator: "scripts/main.js",
        summary: "Authored route + arena offset series.",
      }],
      nodes: [{
        id: "spatial-region:route-main",
        kind: "spatial-region",
        label: "Route Main",
        status: "authored",
        evidenceIds: ["e:route"],
        spatialProfile: {
          coordinateSpace: "local",
          routeId: "main",
          points: [
            {
              x: -17.5,
              y: -28.5,
              z: -110.5,
              index: 0,
            },
          ],
          indexRanges: [{ min: 0, max: 0 }],
          transform: {
            kind: "offset",
            offsetPath: "gameplayOffset",
            functionName: "applyOffset",
          },
          contextSeries: {
            collectionName: "arenas",
            contextCount: 6,
            offsetPath: "gameplayOffset",
            offsetBase: { x: 0, y: 0, z: 0 },
            offsetStride: { x: 351, y: 0, z: 0 },
            contextIdPrefix: "arena_",
            contextIdIndexBase: 1,
          },
        },
      }],
      edges: [],
      invariants: [],
      unknowns: [],
    };

    expect(
      resolveGameplaySpatialContext(
        routeModel,
        "spatial-region:route-main",
        "arena_3",
      ),
    ).toEqual({
      routeNodeId: "spatial-region:route-main",
      disposition: "resolved",
      contextIndex: 2,
      contextId: "arena_3",
    });

    expect(
      projectGameplayRoutePoint(
        routeModel,
        "spatial-region:route-main",
        0,
        "arena_3",
      ),
    ).toEqual({
      routeNodeId: "spatial-region:route-main",
      routeId: "main",
      routeIndex: 0,
      disposition: "resolved",
      contextIndex: 2,
      contextId: "arena_3",
      localPoint: {
        x: -17.5,
        y: -28.5,
        z: -110.5,
      },
      offset: {
        x: 702,
        y: 0,
        z: 0,
      },
      worldPoint: {
        x: 684.5,
        y: -28.5,
        z: -110.5,
      },
    });

    expect(
      projectGameplayRoutePoint(
        routeModel,
        "spatial-region:route-main",
        999,
        "arena_3",
      ).disposition,
    ).toBe("unresolved");
  });

  it("resolves route targets only when route context is sufficient", () => {
    const routeModel: GameplayIntentModel = {
      schemaVersion: 1,
      id: "route-targets",
      evidence: [{
        id: "e:route",
        origin: "source-code",
        locator: "scripts/main.js",
        summary: "Authored route targets.",
      }],
      nodes: [
        {
          id: "spatial-region:route-main",
          kind: "spatial-region",
          label: "Route Main",
          status: "authored",
          evidenceIds: ["e:route"],
          spatialProfile: {
            coordinateSpace: "local",
            routeId: "main",
            points: [{
              x: -66,
              y: -27.5,
              z: -26,
              index: 9,
            }],
            indexRanges: [{ min: 9, max: 9 }],
            transform: {
              kind: "offset",
              offsetPath: "gameplayOffset",
              functionName: "M",
            },
            contextSeries: {
              collectionName: "arenas",
              contextCount: 6,
              offsetPath: "gameplayOffset",
              offsetBase: { x: 0, y: 0, z: 0 },
              offsetStride: { x: 351, y: 0, z: 0 },
              contextIdPrefix: "arena_",
              contextIdIndexBase: 1,
            },
          },
        },
        {
          id: "spatial-region:route-bridge",
          kind: "spatial-region",
          label: "Route Bridge",
          status: "authored",
          evidenceIds: ["e:route"],
          spatialProfile: {
            coordinateSpace: "local",
            routeId: "bridge",
            points: [
              {
                x: 30,
                y: -28.5,
                z: -4,
                index: 9,
              },
              {
                x: 23,
                y: -28.5,
                z: 0.5,
                index: 606,
              },
            ],
            indexRanges: [
              { min: 9, max: 9 },
              { min: 606, max: 606 },
            ],
            transform: {
              kind: "offset",
              offsetPath: "gameplayOffset",
              functionName: "M",
            },
            contextSeries: {
              collectionName: "arenas",
              contextCount: 6,
              offsetPath: "gameplayOffset",
              offsetBase: { x: 0, y: 0, z: 0 },
              offsetStride: { x: 351, y: 0, z: 0 },
              contextIdPrefix: "arena_",
              contextIdIndexBase: 1,
            },
          },
        },
      ],
      edges: [],
      invariants: [],
      unknowns: [],
    };

    expect(
      resolveGameplayRouteTarget(
        routeModel,
        9,
        "arena_6",
      ).disposition,
    ).toBe("ambiguous");

    expect(
      resolveGameplayRouteTarget(
        routeModel,
        9,
        "arena_6",
        "bridge",
      ),
    ).toEqual({
      routeIndex: 9,
      disposition: "resolved",
      candidates: [{
        routeNodeId: "spatial-region:route-bridge",
        routeId: "bridge",
        routeIndex: 9,
        localPoint: {
          x: 30,
          y: -28.5,
          z: -4,
        },
        worldPoint: {
          x: 1785,
          y: -28.5,
          z: -4,
        },
      }],
    });

    const nearest = findNearestGameplayRoutePoint(
      routeModel,
      "arena_6",
      {
        x: 1778,
        y: -30,
        z: 0,
      },
      "bridge",
    );

    expect(nearest.disposition).toBe("resolved");
    expect(nearest.nearest).toEqual(
      expect.objectContaining({
        routeId: "bridge",
        routeIndex: 606,
        worldPoint: {
          x: 1778,
          y: -28.5,
          z: 0.5,
        },
      }),
    );
    expect(nearest.nearest?.distance).toBeCloseTo(
      Math.sqrt(2.5),
    );
  });

  it("assesses observed route position without inventing a bug threshold", () => {
    const routeModel: GameplayIntentModel = {
      schemaVersion: 1,
      id: "route-observation",
      evidence: [{
        id: "e:route",
        origin: "source-code",
        locator: "scripts/main.js",
        summary: "Authored route projection.",
      }],
      nodes: [
        {
          id: "spatial-region:route-main",
          kind: "spatial-region",
          label: "Route Main",
          status: "authored",
          evidenceIds: ["e:route"],
          spatialProfile: {
            coordinateSpace: "local",
            routeId: "main",
            points: [{
              x: -66,
              y: -27.5,
              z: -26,
              index: 9,
            }],
            indexRanges: [{ min: 9, max: 9 }],
            transform: {
              kind: "offset",
              offsetPath: "gameplayOffset",
              functionName: "M",
            },
            contextSeries: {
              collectionName: "arenas",
              contextCount: 6,
              offsetPath: "gameplayOffset",
              offsetBase: { x: 0, y: 0, z: 0 },
              offsetStride: { x: 351, y: 0, z: 0 },
              contextIdPrefix: "arena_",
              contextIdIndexBase: 1,
            },
          },
        },
        {
          id: "spatial-region:route-bridge",
          kind: "spatial-region",
          label: "Route Bridge",
          status: "authored",
          evidenceIds: ["e:route"],
          spatialProfile: {
            coordinateSpace: "local",
            routeId: "bridge",
            points: [
              {
                x: 30,
                y: -28.5,
                z: -4,
                index: 9,
              },
              {
                x: 23,
                y: -28.5,
                z: 0.5,
                index: 606,
              },
            ],
            indexRanges: [
              { min: 9, max: 9 },
              { min: 606, max: 606 },
            ],
            transform: {
              kind: "offset",
              offsetPath: "gameplayOffset",
              functionName: "M",
            },
            contextSeries: {
              collectionName: "arenas",
              contextCount: 6,
              offsetPath: "gameplayOffset",
              offsetBase: { x: 0, y: 0, z: 0 },
              offsetStride: { x: 351, y: 0, z: 0 },
              contextIdPrefix: "arena_",
              contextIdIndexBase: 1,
            },
          },
        },
      ],
      edges: [],
      invariants: [],
      unknowns: [],
    };

    expect(
      assessGameplayRouteObservation(
        routeModel,
        {
          context: "arena_6",
          routeIndex: 9,
          worldLocation: {
            x: 1778,
            y: -30,
            z: 0,
          },
        },
      ).disposition,
    ).toBe("ambiguous");

    const bridge = assessGameplayRouteObservation(
      routeModel,
      {
        context: "arena_6",
        routeId: "bridge",
        routeIndex: 606,
        worldLocation: {
          x: 1778,
          y: -30,
          z: 0,
        },
      },
    );

    expect(bridge.disposition).toBe("resolved");
    expect(bridge.target).toEqual(
      expect.objectContaining({
        routeId: "bridge",
        routeIndex: 606,
        worldPoint: {
          x: 1778,
          y: -28.5,
          z: 0.5,
        },
      }),
    );
    expect(bridge.nearest).toEqual(
      expect.objectContaining({
        routeId: "bridge",
        routeIndex: 606,
      }),
    );
    expect(bridge.distanceToTarget).toBeCloseTo(
      Math.sqrt(2.5),
    );
  });

  it("blocks diagnosis when an open intent question affects the subject", () => {
    const ambiguous: GameplayIntentModel = {
      ...model,
      unknowns: [{
        id: "unknown:reconnect",
        question: "Should reconnect resume the same round?",
        blockedSubjectIds: ["mechanic:plot-build"],
      }],
    };

    expect(
      assessGameplayIntentGrounding(
        ambiguous,
        ["mechanic:plot-build"],
      ).disposition,
    ).toBe("ambiguous");
  });
});


describe("current-map unknown gameplay purpose evidence", () => {
  it("links only exact source/blocked Intent subjects to independent design and player cues", () => {
    const current: GameplayIntentModel = {
      schemaVersion: 1, id: "intent:selected", artifactId: "selected",
      evidence: [{
        id: "op:effect", origin: "source-code", scope: "selected-artifact",
        locator: "scripts/entry.js:10:2", summary: "Exact selected operation",
      }, {
        id: "op:outcome", origin: "source-code", scope: "selected-artifact",
        locator: "scripts/entry.js:20:2", summary: "Exact return",
      }, {
        id: "spec:approved", origin: "game-design-spec",
        designStatus: "approved", scope: "selected-artifact",
        locator: "design/accepted.md#objective", summary: "Approved selected objective",
      }, {
        id: "cue:choice", origin: "translation", scope: "selected-artifact",
        locator: "resource_packs/demo/texts/en_US.lang#L8",
        summary: "Authored display copy", playerFacingText: {
          key: "demo.choice", text: "Choose your path",
        },
      }, {
        id: "spec:unrelated", origin: "game-design-spec",
        designStatus: "approved", scope: "selected-artifact",
        locator: "design/unrelated.md#goal", summary: "Other feature",
      }, {
        id: "spec:speculative", origin: "game-design-spec",
        designStatus: "approved", scope: "selected-artifact",
        locator: "design/speculation.md#goal", summary: "Hypothesis-only feature",
      }, {
        id: "spec:old", origin: "historical-diff",
        scope: "external-reference", locator: "older/goal.md",
        summary: "Old map claim",
      }, {
        id: "op:orphan", origin: "source-code", scope: "selected-artifact",
        locator: "scripts/other.js:9:1", summary: "Independent unknown",
      }],
      nodes: [{
        id: "objective:active", kind: "objective", label: "Possible objective",
        status: "authored", evidenceIds: ["op:effect", "spec:approved", "cue:choice"],
      }, {
        id: "outcome:result", kind: "outcome", label: "Possible outcome",
        status: "inferred", evidenceIds: ["op:outcome"],
      }, {
        id: "objective:unrelated", kind: "objective", label: "Other objective",
        status: "authored", evidenceIds: ["spec:unrelated"],
      }, {
        id: "objective:unverified", kind: "objective", label: "Hypothetical",
        status: "hypothesis", evidenceIds: ["op:effect", "spec:speculative"],
      }],
      edges: [{
        id: "edge:to-outcome", from: "objective:active",
        to: "outcome:result", kind: "produces", status: "inferred",
        evidenceIds: ["op:effect"],
      }],
      invariants: [],
      unknowns: [{
        id: "unknown:entry", question: "What does the selected code mean?",
        blockedSubjectIds: ["objective:active"],
        sourceEntryRegionId: "entry",
        evidenceIds: ["op:effect", "spec:old"],
      }, {
        id: "unknown:orphan", question: "What is the purpose of this state?",
        blockedSubjectIds: [], sourceEntryRegionId: "other",
        evidenceIds: ["op:orphan"],
      }],
    };
    const linked = deriveUnknownGameplayEvidenceInquiry(
      current, "unknown:entry", ["op:effect"]);
    expect(linked?.designDisposition).toBe("grounded-design");
    expect(linked?.approvedDesignEvidenceIds).toEqual(["spec:approved"]);
    expect(linked?.playerFacingEvidenceIds).toEqual(["cue:choice"]);
    expect(linked?.independentCues[0]?.approval).toBe("approved");
    expect(linked?.independentCues.find(item =>
      item.evidenceId === "cue:choice")?.literalPlayerText).toBe("Choose your path");
    expect(linked?.subjectLinks).toEqual([{
      subjectId: "objective:active", kind: "objective",
      basis: "SHARED_SELECTED_SOURCE_EVIDENCE",
    }]);
    expect(linked?.authoredRelationLeads.map(edge => edge.edgeId))
      .toEqual(["edge:to-outcome"]);
    expect(linked?.questions.map(question => question.focus))
      .toEqual(["DESIGN_PURPOSE", "PLAYER_PRESENTATION", "PLAYER_FLOW_OWNERSHIP"]);
    const allRefs = [
      ...(linked?.approvedDesignEvidenceIds ?? []),
      ...(linked?.playerFacingEvidenceIds ?? []),
    ];
    expect(allRefs).not.toContain("spec:unrelated");
    expect(allRefs).not.toContain("spec:speculative");
    expect(allRefs).not.toContain("spec:old");

    // A design record authored at the SAME technical site is not
    // independent corroboration, even if labeled approved.
    const coLocated: GameplayIntentModel = {
      ...current,
      evidence: current.evidence.map(item => item.id === "spec:approved"
        ? { ...item, locator: "scripts/entry.js:10:2" } : item),
    };
    const noIndependentDesign = deriveUnknownGameplayEvidenceInquiry(
      coLocated, "unknown:entry", ["op:effect"]);
    expect(noIndependentDesign?.approvedDesignEvidenceIds).toEqual([]);
    expect(noIndependentDesign?.designDisposition).not.toBe("grounded-design");

    // Draft gameplay notes must remain a claim, never an approved rule.
    const draft: GameplayIntentModel = {
      ...current,
      evidence: current.evidence.map(item => item.id === "spec:approved"
        ? { ...item, designStatus: "draft" as const } : item),
    };
    const draftInquiry = deriveUnknownGameplayEvidenceInquiry(
      draft, "unknown:entry", ["op:effect"]);
    expect(draftInquiry?.designDisposition).toBe("design-claim");
    expect(draftInquiry?.approvedDesignEvidenceIds).toEqual([]);
    expect(draftInquiry?.draftDesignEvidenceIds).toEqual(["spec:approved"]);

    const orphan = deriveUnknownGameplayEvidenceInquiry(
      current, "unknown:orphan", ["op:orphan"]);
    expect(orphan?.designDisposition).toBe("implementation-only");
    expect(orphan?.approvedDesignEvidenceIds).toEqual([]);
    expect(orphan?.subjectLinks).toEqual([]);
    expect(orphan?.questions[0]?.evidenceIds).toEqual([]);
    expect(deriveUnknownGameplayEvidenceInquiry(
      current, "unknown:entry", ["spec:old"])).toBeUndefined();
    expect(deriveUnknownGameplayEvidenceInquiry(
      current, "unknown:missing", ["op:effect"])).toBeUndefined();
  });
});
}

// Original engine/packages/gameplay-intent/test/hidden-defect-intent.test.ts; blob 2f7bf438ceb63e5567f50f9cf86f781aa6a91626
{
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
}

// Original engine/packages/gameplay-intent/test/state-closure.test.ts; blob 1523e39a040b495695bf91523da9008261be69f3
{
// Two representative topology contracts, not a map-specific answer table.
const proof = {
  id: "evidence:source-transition",
  origin: "source-code" as const,
  locator: "scripts/game.ts",
  summary: "Direct selected-artifact state transition",
  scope: "selected-artifact" as const,
};
const state = (id: string) => ({
  id,
  kind: "phase" as const,
  label: id,
  status: "authored" as const,
  evidenceIds: [proof.id],
});
const link = (
  id: string,
  from: string,
  to: string,
  kind: GameplayIntentModel["edges"][number]["kind"] = "transitions-to",
): GameplayIntentModel["edges"][number] => ({
  id, from, to, kind, status: "authored", evidenceIds: [proof.id],
});
function model(
  nodes: GameplayIntentModel["nodes"],
  edges: GameplayIntentModel["edges"],
): GameplayIntentModel {
  return {
    schemaVersion: 1,
    id: "closure:representative",
    artifactId: "artifact:current",
    evidence: [proof],
    nodes,
    edges,
    invariants: [],
    unknowns: [],
  };
}

describe("gameplay source state closure", () => {
  it("does not accept an internally connected loop with no entry or outcome", () => {
    const result = assessGameplayStateClosure(model(
      [state("phase:lobby"), state("phase:combat")],
      [
        link("a", "phase:lobby", "phase:combat"),
        link("b", "phase:combat", "phase:lobby", "recovers-to"),
      ],
    ));
    expect(result.complete).toBe(false);
    expect(result.records.every(record => record.status !== "closed")).toBe(true);
  });

  it("distinguishes an explicitly linked win/loss route from unrelated states", () => {
    const outcome = {
      id: "outcome:won",
      kind: "outcome" as const,
      label: "Won",
      status: "authored" as const,
      evidenceIds: [proof.id],
    };
    const connected = model(
      [state("phase:setup"), state("phase:active"), outcome],
      [
        link("start", "phase:setup", "phase:active"),
        link("win", "phase:active", "outcome:won", "wins-by"),
      ],
    );
    expect(assessGameplayStateClosure(connected).complete).toBe(true);

    const disconnected = model(
      [...connected.nodes, state("phase:orphan-a"), state("phase:orphan-b")],
      [
        ...connected.edges,
        link("orphan-1", "phase:orphan-a", "phase:orphan-b"),
        link("orphan-2", "phase:orphan-b", "phase:orphan-a"),
      ],
    );
    expect(assessGameplayStateClosure(disconnected).complete).toBe(false);
  });

  it("preserves two independent authored entry routes without inventing a single mode", () => {
    const multi = model(
      [state("phase:a-start"), state("phase:a-play"), state("phase:b-start"),
       state("phase:b-play"), {
         id: "outcome:a", kind: "outcome", label: "A", status: "authored", evidenceIds: [proof.id],
       }, {
         id: "outcome:b", kind: "outcome", label: "B", status: "authored", evidenceIds: [proof.id],
       }],
      [link("a-start", "phase:a-start", "phase:a-play"),
       link("a-win", "phase:a-play", "outcome:a", "wins-by"),
       link("b-start", "phase:b-start", "phase:b-play"),
       link("b-win", "phase:b-play", "outcome:b", "wins-by")],
    );
    const result = assessGameplayStateClosure(multi);
    expect(result.structuralEntryStateId).toBeUndefined();
    expect(result.structuralEntryStateIds).toEqual(["phase:a-start", "phase:b-start"]);
    expect(result.sourceRouteCoverageComplete).toBe(true);
    expect(result.complete).toBe(true);
  });

  it("does not mark an unrooted cycle complete next to valid independent routes", () => {
    const multi = model(
      [state("phase:start"), state("phase:play"),
       state("phase:orphan-a"), state("phase:orphan-b"), {
         id: "outcome:win", kind: "outcome", label: "Win",
         status: "authored", evidenceIds: [proof.id],
       }],
      [link("start", "phase:start", "phase:play"),
       link("win", "phase:play", "outcome:win", "wins-by"),
       link("orphan-a", "phase:orphan-a", "phase:orphan-b"),
       link("orphan-b", "phase:orphan-b", "phase:orphan-a")],
    );
    const result = assessGameplayStateClosure(multi);
    expect(result.sourceRouteCoverageComplete).toBe(false);
    expect(result.complete).toBe(false);
    expect(result.partialSubjectIds).toContain("phase:orphan-a");
  });

  it("does not lose unowned or stale gameplay questions in structural source closure", () => {
    const base = model([state("phase:start"), state("phase:play"), {
      id: "outcome:win", kind: "outcome", label: "Win",
      status: "authored", evidenceIds: [proof.id],
    }], [
      link("start", "phase:start", "phase:play"),
      link("win", "phase:play", "outcome:win", "wins-by"),
    ]);
    for (const blockedSubjectIds of [[], ["state:missing"]]) {
      const result = assessGameplayStateClosure({
        ...base,
        unknowns: [{
          id: "unknown:unowned", question: "Who controls this effect?",
          blockedSubjectIds,
        }],
      });
      expect(result.sourceRouteCoverageComplete).toBe(false);
      expect(result.complete).toBe(false);
    }
  });

  it("keeps topology distinct from an unresolved authored win condition", () => {
    const base = model([state("phase:start"), state("phase:play"), {
      id: "outcome:win", kind: "outcome", label: "Win",
      status: "authored", evidenceIds: [proof.id],
    }], [
      link("start", "phase:start", "phase:play"),
      link("win", "phase:play", "outcome:win", "wins-by"),
    ]);
    const result = assessGameplayStateClosure({
      ...base,
      unknowns: [{
        id: "unknown:outcome", question: "Who is awarded the win?",
        blockedSubjectIds: ["outcome:win"],
      }],
    });
    expect(result.sourceRouteCoverageComplete).toBe(true);
    expect(result.terminalOutcomeGrounded).toBe(false);
    expect(result.complete).toBe(false);
  });
});
}
