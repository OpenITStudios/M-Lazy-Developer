import { describe, expect, it } from "vitest";
import {
  deriveAuditObligations,
} from "../src/map-audit-obligations.js";
import {
  auditUserIntentAuthorityNote,
  fingerprintAuditUserIntent,
  createAuditUserIntentConfirmationRequest,
  confirmAuditUserIntent,
  createFallbackAuditUserIntent,
  deriveAuditUserIntentKnowledgeDemand,
  deriveAuditUserIntentSearchPressure,
  normalizeAuditUserIntent,
  validateAuditUserIntent,
  validateAuditUserIntentConfirmation,
  type AuditUserIntentEnvelope,
} from "../src/map-audit-user-intent.js";

function envelope(): AuditUserIntentEnvelope {
  return {
    schemaVersion: 1,
    policy:
      "user-input-is-search-guidance-not-gameplay-authority",
    fragments: [{
      id: "f1",
      raw: "wave suka stuck",
    }, {
      id: "f2",
      raw: "kayak ticking area",
    }, {
      id: "f3",
      raw: "jangan test semuanya",
    }],
    items: [{
      kind: "SYMPTOM_REPORT",
      raw: " wave   suka stuck ",
      normalized:
        "possible progression stall during wave completion",
      sourceFragmentIds: ["f1"],
    }, {
      kind: "SUSPICION",
      raw: " kayak ticking area ",
      normalized:
        "suspected chunk/residency mechanism",
      sourceFragmentIds: ["f2"],
    }, {
      kind: "TEST_CONSTRAINT",
      raw: "jangan test semuanya",
      normalized:
        "prefer bounded static-first proof over broad trial-and-error",
      sourceFragmentIds: ["f3"],
    }, {
      kind: "SYMPTOM_REPORT",
      raw: "kadang wave gak lanjut",
      normalized:
        "possible progression stall during wave completion",
      sourceFragmentIds: ["f1"],
    }],
    unmappedFragmentIds: [],
    priorityDomains: [
      "progression-wave-objective",
      "chunk-simulation",
      "progression-wave-objective",
    ],
    priorityPlayerFlows: [
      "PROGRESSION",
      "PROGRESSION",
    ],
    ambiguities: [
      "Root cause is not yet known.",
      " Root cause is not yet known. ",
    ],
    blockingAmbiguities: [],
  };
}

describe("map audit user intent", () => {
  it("normalizes and deduplicates hint-only prompt intake", () => {
    const normalized =
      normalizeAuditUserIntent(envelope());

    expect(normalized.items).toHaveLength(3);
    expect(normalized.priorityDomains).toEqual([
      "chunk-simulation",
      "progression-wave-objective",
    ]);
    expect(normalized.priorityPlayerFlows)
      .toEqual(["PROGRESSION"]);
    expect(normalized.ambiguities).toEqual([
      "Root cause is not yet known.",
    ]);
    expect(normalized.blockingAmbiguities)
      .toEqual([]);
  });

  it("maps user priority into additive existing knowledge demand", () => {
    const demand =
      deriveAuditUserIntentKnowledgeDemand(
        envelope(),
      );

    expect(demand).toEqual([
      "chunk-simulation",
      "entity-behavior",
      "platform-constraints",
      "state-flow",
    ]);
  });

  it("keeps symptom and suspicion search pressure separate", () => {
    const pressure =
      deriveAuditUserIntentSearchPressure(
        envelope(),
      );

    expect(pressure.symptomHints).toEqual([
      "possible progression stall during wave completion",
    ]);
    expect(pressure.suspicionHints).toEqual([
      "suspected chunk/residency mechanism",
    ]);
    expect(pressure.domains["chunk-simulation"])
      .toBe(2);
    expect(
      pressure.domains[
        "progression-wave-objective"
      ],
    ).toBe(2);
  });

  it("rejects malformed envelope shape without crashing", () => {
    const malformed: any = {
      schemaVersion: 1,
      policy:
        "user-input-is-search-guidance-not-gameplay-authority",
      items: "not-an-array",
      priorityDomains: null,
      priorityPlayerFlows: {},
      ambiguities: 42,
      blockingAmbiguities: false,
    };

    const issues =
      validateAuditUserIntent(malformed);

    expect(issues).toContain(
      "User audit intent items must be an array.",
    );
    expect(issues).toContain(
      "User audit intent priorityDomains must be an array.",
    );
    expect(issues).toContain(
      "User audit intent priorityPlayerFlows must be an array.",
    );

    expect(() =>
      normalizeAuditUserIntent(malformed)
    ).not.toThrow();
  });

  it("drops non-string imported fragment references without creating evidence", () => {
    const injected: AuditUserIntentEnvelope = {
      ...envelope(),
      items: [{
        kind: "SYMPTOM_REPORT",
        raw: "raw symptom",
        normalized: "unverified symptom",
        sourceFragmentIds: ["f1", 42, null, { id: "f2" }] as unknown as string[],
      }],
      unmappedFragmentIds: ["f2", false, { id: "f3" }] as unknown as string[],
    };
    const normalized = normalizeAuditUserIntent(injected);
    expect(normalized.items[0]?.sourceFragmentIds).toEqual(["f1"]);
    expect(normalized.unmappedFragmentIds).toEqual(["f2"]);
    expect(normalized.items[0]?.kind).toBe("SYMPTOM_REPORT");
  });

  it("rejects unsupported runtime values instead of trusting loose JSON", () => {
    const invalid: any = {
      ...envelope(),
      priorityDomains: ["made-up-domain"],
      priorityPlayerFlows: ["EVERYWHERE"],
      items: [{
        kind: "BUG_CONFIRMED",
        raw: "x",
        normalized: "x",
      }],
    };

    const issues =
      validateAuditUserIntent(invalid);

    expect(issues.some((item) =>
      item.includes("unsupported kind")
    )).toBe(true);
    expect(issues.some((item) =>
      item.includes("unsupported priority domain")
    )).toBe(true);
    expect(issues.some((item) =>
      item.includes("unsupported priority player flow")
    )).toBe(true);
  });

  it("preserves blocking ambiguity separately from ordinary uncertainty", () => {
    const input = envelope();
    const normalized =
      normalizeAuditUserIntent({
        ...input,
        blockingAmbiguities: [
          "Exact target map is ambiguous.",
        ],
      });

    expect(normalized.blockingAmbiguities)
      .toEqual([
        "Exact target map is ambiguous.",
      ]);
    expect(normalized.ambiguities)
      .toEqual([
        "Root cause is not yet known.",
      ]);
  });

  it("rejects a symptom intake that silently drops interpretation", () => {
    const incomplete: AuditUserIntentEnvelope = {
      schemaVersion: 1,
      policy:
        "user-input-is-search-guidance-not-gameplay-authority",
      fragments: [{
        id: "f1",
        raw: "game kadang gak selesai",
      }],
      items: [{
        kind: "SYMPTOM_REPORT",
        raw: "game kadang gak selesai",
        normalized:
          "possible game completion failure",
        sourceFragmentIds: ["f1"],
      }],
      unmappedFragmentIds: [],
      priorityDomains: [],
      priorityPlayerFlows: [],
      ambiguities: [],
      blockingAmbiguities: [],
    };

    expect(
      validateAuditUserIntent(incomplete),
    ).toContain(
      "User-reported symptoms require at least one bounded priority domain/player-flow interpretation or an explicit ambiguity record.",
    );
  });

  it("keeps an unexplained user symptom visible as a non-bug obligation", () => {
    const userIntent: AuditUserIntentEnvelope = {
      schemaVersion: 1,
      policy:
        "user-input-is-search-guidance-not-gameplay-authority",
      fragments: [{
        id: "f1",
        raw: "barang kadang ilang",
      }],
      items: [{
        kind: "SYMPTOM_REPORT",
        raw: "barang kadang ilang",
        normalized:
          "possible inventory item loss",
        sourceFragmentIds: ["f1"],
      }],
      unmappedFragmentIds: [],
      priorityDomains: [
        "inventory-economy",
      ],
      priorityPlayerFlows: [
        "ACTIVE_GAMEPLAY",
      ],
      ambiguities: [],
      blockingAmbiguities: [],
    };

    const obligations =
      deriveAuditObligations({
        graph: {
          schemaVersion: 1,
          policy: "scenario-driven-causal-audit",
          scenarios: [],
          components: [],
          causalLinks: [],
          knowledgeRequirements: [],
          knowledgeReceipts: [],
          requiredInspectionGraph: {
            policy: "required-inspection-graph",
            nodes: [],
            receipts: [],
          },
        } as any,
        defectResolution: {
          status: "READY_FOR_PROPOSED_BUG_SET",
          contradictedCausalLinkIds: [],
          resolutions: [],
          confirmedDefectReadyIds: [],
          blockingCounterProofIds: [],
          runtimeProofRequiredIds: [],
          detectionGapIds: [],
          gameplayTranslationRequiredIds: [],
          counterProofSearchRequiredIds: [],
          issues: [],
        } as any,
        gameplayWorld: {
          surfaceDiscovery: {
            surfaceIds: [],
          },
          arenas: {
            detected: false,
            isolation: { observations: [] },
            replicaProof: [],
          },
          platformKnowledge: {
            claims: [],
          },
        } as any,
        userIntent,
        capabilityDelivery: [],
        gameplayClosure: {
          status: "CLOSED",
          surfaces: [],
          unaccountedSurfaceIds: [],
          blockingSurfaceIds: [],
          unknownSurfaceIds: [],
          stateModelComplete: true,
          boundariesExtracted: true,
          reasons: [],
        } as any,
        negativeSpace: [],
        temporalRisks: [],
        discoveryChallenges: [],
        sharedResourceSignals: [],
        compoundBoundaries: [],
        accumulationGrowth: [],
      });

    expect(
      obligations.some(
        (item) =>
          item.id ===
            "user-symptom-uncovered-domain:inventory-economy" &&
          item.source ===
            "user-reported-symptom",
      ),
    ).toBe(true);
  });

  it("turns raw imperfect prompt into preserved fallback intake", () => {
    const fallback =
      createFallbackAuditUserIntent(
        "pokoknya kadang aneh pas akhir, cek ya",
      );

    expect(validateAuditUserIntent(fallback))
      .toEqual([]);
    expect(fallback.fragments).toEqual([{
      id: "prompt:1",
      raw: "pokoknya kadang aneh pas akhir, cek ya",
    }]);
    expect(fallback.items).toEqual([]);
    expect(fallback.unmappedFragmentIds)
      .toEqual(["prompt:1"]);
    expect(fallback.ambiguities.length)
      .toBeGreaterThan(0);
  });

  it("preserves unmapped prompt fragments instead of dropping them", () => {
    const input: AuditUserIntentEnvelope = {
      schemaVersion: 1,
      policy:
        "user-input-is-search-guidance-not-gameplay-authority",
      fragments: [{
        id: "f1",
        raw: "pokoknya yang aneh pas akhir",
      }],
      items: [],
      unmappedFragmentIds: ["f1"],
      priorityDomains: [],
      priorityPlayerFlows: [],
      ambiguities: [
        "The fragment is too vague to map safely yet.",
      ],
      blockingAmbiguities: [],
    };

    expect(validateAuditUserIntent(input))
      .toEqual([]);

    const normalized =
      normalizeAuditUserIntent(input);
    expect(normalized.unmappedFragmentIds)
      .toEqual(["f1"]);

    const obligations =
      deriveAuditObligations({
        graph: {
          schemaVersion: 1,
          policy: "scenario-driven-causal-audit",
          scenarios: [],
          components: [],
          causalLinks: [],
          knowledgeRequirements: [],
          knowledgeReceipts: [],
          requiredInspectionGraph: {
            policy: "required-inspection-graph",
            nodes: [],
            receipts: [],
          },
        } as any,
        defectResolution: {
          status: "READY_FOR_PROPOSED_BUG_SET",
          contradictedCausalLinkIds: [],
          resolutions: [],
          confirmedDefectReadyIds: [],
          blockingCounterProofIds: [],
          runtimeProofRequiredIds: [],
          detectionGapIds: [],
          gameplayTranslationRequiredIds: [],
          counterProofSearchRequiredIds: [],
          issues: [],
        } as any,
        gameplayWorld: {
          surfaceDiscovery: { surfaceIds: [] },
          arenas: { detected: false, isolation: { observations: [] }, replicaProof: [] },
          platformKnowledge: { claims: [] },
        } as any,
        userIntent: normalized,
        capabilityDelivery: [],
        gameplayClosure: {
          status: "CLOSED",
          surfaces: [],
          unaccountedSurfaceIds: [],
          blockingSurfaceIds: [],
          unknownSurfaceIds: [],
          stateModelComplete: true,
          boundariesExtracted: true,
          reasons: [],
        } as any,
        negativeSpace: [],
        temporalRisks: [],
        discoveryChallenges: [],
        sharedResourceSignals: [],
        compoundBoundaries: [],
        accumulationGrowth: [],
      });

    expect(
      obligations.some(
        (item) =>
          item.id ===
            "user-input-unmapped:f1" &&
          item.source ===
            "user-input-unmapped",
      ),
    ).toBe(true);
  });

  it("builds a complete pre-test plan even when the user reports no symptom", () => {
    const input: AuditUserIntentEnvelope = {
      schemaVersion: 1,
      policy:
        "user-input-is-search-guidance-not-gameplay-authority",
      fragments: [{
        id: "f1",
        raw: "cek map ini sebelum testing",
      }],
      items: [{
        kind: "SCOPE_REQUEST",
        raw: "cek map ini sebelum testing",
        normalized:
          "perform comprehensive pre-testing gameplay audit",
        sourceFragmentIds: ["f1"],
      }],
      unmappedFragmentIds: [],
      priorityDomains: [],
      priorityPlayerFlows: [],
      ambiguities: [],
      blockingAmbiguities: [],
    };

    expect(validateAuditUserIntent(input))
      .toEqual([]);

    const request =
      createAuditUserIntentConfirmationRequest(
        input,
      );

    expect(request.summary.reportedSymptoms)
      .toEqual([]);
    expect(request.summary.suspectedCauses)
      .toEqual([]);
    expect(request.summary.auditObjective)
      .toContain("comprehensive pre-testing");
    expect(request.summary.plannedChecks.length)
      .toBeGreaterThan(8);
    expect(request.summary.proofStrategy)
      .toContain(
        "Selected-artifact/source evidence first.",
      );
    expect(request.summary.outputPlan.length)
      .toBeGreaterThan(0);
  });

  it("requires explicit confirmation bound to the current normalized intent", () => {
    const input = normalizeAuditUserIntent(
      envelope(),
    );

    expect(
      validateAuditUserIntentConfirmation(
        input,
        undefined,
      ),
    ).toContain(
      "User audit intent must be confirmed in chat before production audit.",
    );

    const confirmation =
      confirmAuditUserIntent(input, true);

    expect(
      confirmation.intentFingerprint,
    ).toBe(
      fingerprintAuditUserIntent(input),
    );
    expect(
      validateAuditUserIntentConfirmation(
        input,
        confirmation,
      ),
    ).toEqual([]);

    const changed =
      normalizeAuditUserIntent({
        ...input,
        fragments: [
          ...input.fragments,
          {
            id: "f4",
            raw: "juga cek reconnect",
          },
        ],
        items: [
          ...input.items,
          {
            kind: "SCOPE_REQUEST",
            raw: "juga cek reconnect",
            normalized:
              "prioritize reconnect/recovery behavior",
            sourceFragmentIds: ["f4"],
          },
        ],
        priorityPlayerFlows: [
          ...input.priorityPlayerFlows,
          "RECOVERY",
        ],
      });

    expect(
      validateAuditUserIntentConfirmation(
        changed,
        confirmation,
      ),
    ).toContain(
      "User audit intent changed after confirmation; show the updated interpretation in chat and confirm again.",
    );
  });

  it("creates a confirmation preview bound to the exact normalized interpretation", () => {
    const normalized =
      normalizeAuditUserIntent(envelope());
    const request =
      createAuditUserIntentConfirmationRequest(
        normalized,
      );

    expect(request.policy)
      .toBe("confirm-user-intent-before-audit");
    expect(request.intentFingerprint)
      .toBe(
        fingerprintAuditUserIntent(normalized),
      );
    expect(request.summary.reportedSymptoms)
      .toContain(
        "possible progression stall during wave completion",
      );
    expect(request.summary.suspectedCauses)
      .toContain(
        "suspected chunk/residency mechanism",
      );
    expect(request.summary.testConstraints)
      .toContain(
        "prefer bounded static-first proof over broad trial-and-error",
      );
  });

  it("requires explicit confirmation before production audit intent is accepted", () => {
    const normalized =
      normalizeAuditUserIntent(envelope());

    expect(
      validateAuditUserIntentConfirmation(
        normalized,
        undefined,
      ),
    ).toContain(
      "User audit intent must be confirmed in chat before production audit.",
    );

    const receipt =
      confirmAuditUserIntent(
        normalized,
        true,
      );

    expect(
      validateAuditUserIntentConfirmation(
        normalized,
        receipt,
      ),
    ).toEqual([]);
  });

  it("invalidates confirmation when the interpreted intent changes", () => {
    const normalized =
      normalizeAuditUserIntent(envelope());
    const receipt =
      confirmAuditUserIntent(
        normalized,
        true,
      );

    const changed =
      normalizeAuditUserIntent({
        ...normalized,
        priorityDomains: [
          ...normalized.priorityDomains,
          "inventory-economy",
        ],
      });

    expect(
      validateAuditUserIntentConfirmation(
        changed,
        receipt,
      ),
    ).toContain(
      "User audit intent changed after confirmation; show the updated interpretation in chat and confirm again.",
    );
  });

  it("keeps confirmation fingerprint stable across equivalent normalized wording", () => {
    const first =
      normalizeAuditUserIntent(envelope());
    const second =
      normalizeAuditUserIntent({
        ...envelope(),
        items: envelope().items.map(
          (item) => ({
            ...item,
            raw: "  " + item.raw + "  ",
          }),
        ),
      });

    expect(
      fingerprintAuditUserIntent(first),
    ).toBe(
      fingerprintAuditUserIntent(second),
    );
  });

  it("states explicitly that prompt input cannot become proof", () => {
    expect(auditUserIntentAuthorityNote())
      .toContain("cannot establish Expected/Actual behavior");
    expect(auditUserIntentAuthorityNote())
      .toContain("issue type");
  });
});
