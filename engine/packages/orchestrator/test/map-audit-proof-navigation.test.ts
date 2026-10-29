import { describe, expect, it } from "vitest";
import {
  buildAuditProofNavigation,
} from "../src/map-audit-proof-navigation.js";
import type {
  NeedValidationAuditIssueProjection,
} from "../src/map-audit-issue-projection.js";
import type {
  GameplayWorldModel,
} from "../src/inspection/gameplay-world-model.js";
import {
  deriveAuditModelTaskPackets,
} from "../src/map-audit-model-task.js";

function finding(
  failureDomain: NeedValidationAuditIssueProjection["failureDomain"],
): NeedValidationAuditIssueProjection {
  return {
    status: "NEED_VALIDATION",
    issueType: "BUG",
    failureDomain,
    contributingDomains: [failureDomain],
    gameplayFlow: "PROGRESSION",
    informationMismatch: false,
    playerFacingEvidenceIds: [],
    causalLinkId: "link:test",
    scenarioId: "scenario:test",
    gameplayStage: "PROGRESSION",
    scenarioLabel: "wave-progression",
    gameplayTrigger: "Run the wave.",
    gameplayConsequence: "Progression may block.",
    expectedOutcome: "Wave must complete.",
    actualOutcome: "Completion remains unresolved.",
    affectedScope: "objective:test",
    subjectIds: ["objective:test"],
    componentIds: ["runtime:entities"],
    evidenceIds: ["e:test"],
    validationReason: "Proof is incomplete.",
    missingProof: "Reachable completion accounting.",
    validationTest: "Run the exact unresolved transition.",
    validationGroupKey: "scenario:test:progression",
  };
}

describe("map audit proof navigation", () => {
  it("routes progression findings through static/cross-domain proof before runtime", () => {
    const result = buildAuditProofNavigation(
      finding("progression-wave-objective"),
    );

    expect(result.recipeId).toBe(
      "proof:progression-dead-end",
    );
    expect(result.route[0]?.knowledgeDomain).toBe(
      "state-flow",
    );
    expect(result.route.at(-1)?.evidencePreference).toBe(
      "runtime",
    );
    expect(result.runtimeLastResort).toBe(true);
    expect(result.runtimeRequired).toBe(false);
    expect(result.missingClaims).toEqual([
      "Reachable completion accounting.",
    ]);
  });

  it("routes only unsatisfied criteria and exact missing counter-proof dimensions", () => {
    const unresolved = {
      ...finding("progression-wave-objective"),
      missingProofCriteria: [
        { id: "counter-proof-cleared", scope: "universal" as const,
          description: "Search every exact blocking guard before promotion." },
        { id: "failing-path-reachable", scope: "family" as const,
          description: "Prove the failure path is independently reachable." },
      ],
      missingCounterProofDimensions: ["scope", "guard"] as const,
    };
    const result = buildAuditProofNavigation(unresolved);
    expect(result.missingClaims).toEqual([
      "UNIVERSAL counter-proof-cleared: Search every exact blocking guard before promotion.",
      "FAMILY failing-path-reachable: Prove the failure path is independently reachable.",
    ]);
    expect(result.familyProofCriteria).toEqual([
      "failing-path-reachable: Prove the failure path is independently reachable.",
    ]);
    expect(result.route[0]).toMatchObject({
      order: 1, knowledgeDomain: "counter-proof",
      evidencePreference: "selected-artifact",
    });
    expect(result.route[0]?.question).toContain("scope, guard");
    expect(result.route[1]?.order).toBe(2);
    expect(result.route.at(-1)?.evidencePreference).toBe("runtime");
  });

  it("feeds only current unresolved proof claims to the active model handoff", () => {
    const pending = {
      ...finding("progression-wave-objective"),
      missingProofCriteria: [
        { id: "failing-path-reachable", scope: "family" as const,
          description: "Show the exact reachable failure path." },
        { id: "counter-proof-cleared", scope: "universal" as const,
          description: "Exhaust the current guard/scope search." },
      ],
      missingCounterProofDimensions: ["scope"] as const,
    };
    const navigation = buildAuditProofNavigation(pending);
    const tasks = deriveAuditModelTaskPackets({
      admission: { firstBlockingStage: undefined },
      procedure: {},
      graph: {},
      defectResolution: {},
      auditRevision: "revision:selected",
      world: {},
      intent: {
        id: "intent:selected", artifactId: "selected",
        evidence: [{
          id: "e:test", scope: "selected-artifact", origin: "source-code",
          locator: "behavior_packs/demo/scripts/active.js:8:2",
          summary: "Source witness",
        }],
        nodes: [], edges: [], invariants: [], unknowns: [],
      },
      needValidationFindings: [{ ...pending, proofNavigation: navigation }],
      auditObligations: [],
    } as any);
    const task = tasks.find(item => item.kind === "PROOF_NAVIGATION");
    expect(task?.missingClaims).toEqual(navigation.missingClaims);
    expect(task?.familyProofCriteria).toEqual([
      "failing-path-reachable: Show the exact reachable failure path.",
    ]);
    expect(task?.navigationRoute?.[0]?.knowledgeDomain).toBe("counter-proof");
    expect(task?.evidenceIds).toEqual(["e:test"]);
    expect(task?.unresolvedEvidenceIds).toEqual([]);
  });

  it("keeps explicit zero family gaps empty rather than requesting unrelated proofs", () => {
    const unresolved = {
      ...finding("progression-wave-objective"),
      missingProofCriteria: [
        { id: "required-knowledge-satisfied", scope: "universal" as const,
          description: "One selected-map Knowledge receipt remains missing." },
      ],
    };
    const result = buildAuditProofNavigation(unresolved);
    expect(result.familyProofCriteria).toEqual([]);
    expect(result.missingClaims).toHaveLength(1);
  });

  it("marks explicitly native client reconciliation residue as runtime-required", () => {
    const item = {
      ...finding("ui-feedback-information"),
      validationReason:
        "Native client reconciliation is not statically decidable.",
      missingProof:
        "One acting-client versus observer-client comparison.",
      validationTest:
        "Cancel one predicted mutation and compare both clients.",
    };

    const result = buildAuditProofNavigation(item);

    expect(result.runtimeLastResort).toBe(true);
    expect(result.runtimeRequired).toBe(true);
  });

  it("offers static simulation evidence substitution only when world evidence supports it", () => {
    const world = {
      entities: {
        definitions: 12,
      },
      platformKnowledge: {
        profileResolved: true,
      },
      chunks: {
        tickingAreaAcquires: 0,
        readinessProbes: 0,
      },
    } as unknown as GameplayWorldModel;

    const result = buildAuditProofNavigation(
      finding("chunk-simulation"),
      world,
    );

    expect(
      result.evidenceSubstitutions.map(
        (item) => item.id,
      ),
    ).toContain(
      "substitution:simulation-ownership",
    );
  });

  it("does not treat a candidate static substitution as completed native-runtime evidence", () => {
    const world = {
      entities: { definitions: 12 },
      platformKnowledge: { profileResolved: true },
      chunks: { tickingAreaAcquires: 0, readinessProbes: 0 },
    } as unknown as GameplayWorldModel;
    const unresolved = {
      ...finding("chunk-simulation"),
      validationReason: "Native simulation timing remains unresolved.",
      missingProof: "Native simulation behavior at the relevant client.",
    };
    const result = buildAuditProofNavigation(unresolved, world);
    expect(result.evidenceSubstitutions.map(item => item.id))
      .toContain("substitution:simulation-ownership");
    expect(result.runtimeRequired).toBe(true);
    expect(result.route[0]?.evidencePreference).not.toBe("runtime");
    expect(result.route.at(-1)?.evidencePreference).toBe("runtime");
  });

  it("does not classify native-runtime requirement from a suggested test alone", () => {
    const unresolved = {
      ...finding("ui-feedback-information"),
      validationTest: "Observe native client visuals only if source proof remains insufficient.",
    };
    expect(buildAuditProofNavigation(unresolved).runtimeRequired).toBe(false);
  });

  it("moves historically relevant knowledge earlier without moving runtime forward", () => {
    const world = {
      entities: {
        definitions: 5,
      },
      platformKnowledge: {
        profileResolved: false,
      },
      chunks: {
        tickingAreaAcquires: 0,
        capacityUncheckedLeases: 0,
        readinessUnverifiedLeases: 0,
        entityRemoveObservers: 1,
      },
      arenas: {
        detected: false,
        isolation: {
          sharedGlobal: 0,
        },
        globalState: {
          unleasedArenaMutations: 0,
        },
        cleanup: {
          resourceLedger: {
            missing: 0,
          },
        },
      },
      inventory: {
        restoreOwnership: {
          multipleRestoreOwners: 0,
        },
        restoreConflicts: [],
        partialResets: 0,
      },
      structures: {
        transitionResidueRisks: 0,
        transitionResidueUnresolved: 0,
      },
      combat: {
        deathHandlers: 1,
      },
      spatial: {
        authority: {
          conflicts: 0,
        },
      },
    } as unknown as GameplayWorldModel;

    const result = buildAuditProofNavigation(
      finding("progression-wave-objective"),
      world,
    );

    expect(result.historyPressure).toBeGreaterThan(0);
    expect(result.historicalSearchHints.length).toBeGreaterThan(0);
    expect(result.route.at(-1)?.evidencePreference).toBe(
      "runtime",
    );
  });

  it("provides family-specific saturation criteria and an explicit stop rule", () => {
    const result = buildAuditProofNavigation(
      finding("inventory-economy"),
    );

    expect(result.familyProofCriteria.length).toBeGreaterThan(0);
    expect(
      result.familyProofCriteria.join(" "),
    ).toMatch(/idempotency|exclusion|generation/i);
    expect(result.proofStopRule).toMatch(
      /stop searching/i,
    );
  });

  it("does not label unevidenced expected/actual narrative as proven claims", () => {
    const item = {
      ...finding("inventory-economy"),
      evidenceIds: [],
    };
    const result =
      buildAuditProofNavigation(item);

    expect(result.provenClaims).toEqual([]);
  });
});
