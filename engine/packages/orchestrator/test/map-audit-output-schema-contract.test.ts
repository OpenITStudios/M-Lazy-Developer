import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Map Audit Output V2 naming contract", () => {
  it("keeps every canonical Game Reconstruction projection in the strict report schema", () => {
    const view = schema.properties.gameplayStructure;
    const projections = [
      "mechanicReconstructions",
      "gameplayJourneyCandidates",
      "gameplayJourneyTruncated",
      "guardedSourceTransitions",
      "sourceFlowCandidates",
      "authoredBehaviorRelationships",
      "uninterpretedSourceFlows",
    ];
    expect(view.additionalProperties).toBe(false);
    expect(view.required).toEqual(expect.arrayContaining(projections));
    expect(Object.keys(view.properties)).toEqual(expect.arrayContaining(projections));
    expect(view.properties.mechanicReconstructions.items.properties.runtimeStatus.const)
      .toBe("NOT_OBSERVED");
    expect(view.properties.sourceFlowCandidates.items.properties.runtimeStatus.const)
      .toBe("NOT_OBSERVED");
    expect(view.properties.gameplayJourneyCandidates.items.properties.runtimeStatus.const)
      .toBe("NOT_OBSERVED");
    const activation =
      view.properties.mechanicReconstructions.items.properties.sourceActivationCandidates;
    expect(view.properties.mechanicReconstructions.items.required)
      .toContain("sourceActivationCandidates");
    expect(activation.items.properties.evidenceBasis.enum)
      .toEqual(["EXACT_SOURCE_ENTRY_REFERENCE", "TRACE_CONTEXT_ONLY"]);
    expect(activation.items.properties.runtimeStatus.const)
      .toBe("NOT_OBSERVED");
    const interpretation =
      view.properties.gameplayJourneyCandidates.items.properties.interpretation;
    expect(interpretation.properties.basis.const)
      .toBe("DIRECTED_SELECTED_SOURCE_RELATIONS_NOT_PLAYER_SEQUENCE");
    expect(interpretation.additionalProperties).toBe(false);
    expect(interpretation.properties.missingUnderstanding.items.enum)
      .toContain("RUNTIME_NOT_OBSERVED");
    expect(interpretation.properties.missingUnderstanding.items.enum)
      .toContain("CROSS_SOURCE_JOIN_UNPROVEN");
    expect(view.properties.gameplayJourneyCandidates.items.properties.boundary.enum)
      .toContain("SOURCE_JOIN_UNPROVEN");
    expect(interpretation.properties.sourceJoinGap.additionalProperties).toBe(false);
    expect(interpretation.properties.sourceJoinGap.properties.missingProof.enum)
      .toEqual([
        "SHARED_EXACT_SOURCE_FLOW_OR_SAME_SOURCE_WITNESS",
        "OPPOSITE_AUTHORED_BRANCH_ARMS",
      ]);
    expect(view.properties.features.items.properties.sourceBehaviorPaths.items.properties.association.enum)
      .toEqual(["DIRECT_EFFECT_EVIDENCE", "CALL_PATH_CONTEXT"]);
    expect(view.properties.guardedSourceTransitions.items.$ref)
      .toContain("guardedStateTransitionCandidates");
  });


  const schema = JSON.parse(
    readFileSync(
      ".agents/schemas/map-audit-output-v2.schema.json",
      "utf8",
    ),
  );

  it("requires the canonical honesty and validation test surfaces", () => {
    expect(schema.required).toEqual(
      expect.arrayContaining([
        "honesty",
        "qualityGates",
        "validationTests",
        "unresolved",
      ]),
    );
  });

  it("keeps gray-zone state explicitly visible without inventing a third issue status", () => {
    const unresolved =
      schema.properties.unresolved;
    expect(unresolved.properties.status.enum)
      .toEqual([
        "CLEAR",
        "HAS_UNRESOLVED",
      ]);
    expect(unresolved.required).toEqual(
      expect.arrayContaining([
        "needValidationIds",
        "staticProofPendingIds",
        "runtimeRequiredIds",
        "auditObligationIds",
        "unknownSurfaceIds",
      ]),
    );
    // New A2 source-link visibility must not break older V2 report readers.
    expect(unresolved.required).not.toContain("unresolvedSourceLinkIds");
    expect(unresolved.properties.unresolvedSourceLinkIds).toMatchObject({
      type: "array",
      uniqueItems: true,
      items: { type: "string", minLength: 1 },
    });
    expect(
      schema.properties.bugs.items.properties.status.enum,
    ).toEqual([
      "PROVEN",
      "NEED_VALIDATION",
    ]);
  });

  it("keeps final quality projections bounded and non-authoritative", () => {
    expect(
      schema.properties.qualityGates.properties
        .informationIntegrity.properties.status.enum,
    ).toEqual([
      "CLOSED_CLEAR",
      "CLOSED_WITH_FINDINGS",
      "BLOCKED",
    ]);
    expect(
      schema.properties.qualityGates.properties
        .zeroFinding.properties.status.enum,
    ).toEqual([
      "ELIGIBLE",
      "NOT_ELIGIBLE",
      "NOT_APPLICABLE",
    ]);
  });

  it("requires the vital gameplay closure inside quality gates", () => {
    const vital =
      schema.properties.qualityGates.properties.vitalGameplay;
    expect(
      schema.properties.qualityGates.required,
    ).toContain("vitalGameplay");
    expect(vital.properties.domains.minItems).toBe(8);
    expect(vital.properties.domains.maxItems).toBe(8);
    expect(
      vital.properties.domains.items.properties.status.enum,
    ).toEqual([
      "UNDERSTOOD_PROVEN_SAFE",
      "UNDERSTOOD_WITH_FINDING",
      "RUNTIME_REQUIRED",
      "DETECTION_GAP",
      "NOT_APPLICABLE",
    ]);
  });

  it("keeps NEED_VALIDATION naming aligned with source contracts", () => {
    for (const lane of [
      "bugs",
      "designMismatches",
    ]) {
      const item =
        schema.properties[lane].items;
      expect(item.properties).toHaveProperty(
        "validationGroupKey",
      );
      expect(item.properties).toHaveProperty(
        "proofNavigation",
      );

      const validationRule =
        item.allOf.find(
          (rule: any) =>
            rule?.if?.properties?.status
              ?.const === "NEED_VALIDATION",
        );

      expect(
        validationRule.then.required,
      ).toEqual(
        expect.arrayContaining([
          "validationReason",
          "missingProof",
          "validationTest",
          "validationGroupKey",
          "proofNavigation",
        ]),
      );
    }
  });

  it("uses only canonical full-map replica status names", () => {
    const statuses =
      schema.properties.fullMapReplica
        .properties.replicaResults.items
        .properties.replicaStatus.enum;

    expect(statuses).toEqual([
      "EQUIVALENT",
      "BOUNDED_EQUIVALENCE",
      "DIVERGENCE_REQUIRES_CLASSIFICATION",
      "INCOMPLETE_PROOF",
    ]);
  });
});
