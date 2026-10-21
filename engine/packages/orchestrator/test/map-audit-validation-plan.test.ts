import { describe, expect, it } from "vitest";
import { groupNeedValidationTests } from "../src/map-audit-validation-plan.js";

describe("map audit validation plan", () => {
  it("keeps runtime verification narrow and explicitly forbids broad playthrough", () => {
    const groups = groupNeedValidationTests([
      {
        status: "NEED_VALIDATION",
        issueType: "BUG",
        failureDomain: "ui-feedback-information",
        contributingDomains: ["ui-feedback-information"],
        gameplayFlow: "ACTIVE_GAMEPLAY",
        informationMismatch: true,
        playerFacingEvidenceIds: [],
        causalLinkId: "link:client-reconcile",
        scenarioId: "scenario:client-reconcile",
        gameplayStage: "ACTIVE_GAMEPLAY",
        scenarioLabel: "client-server-reconciliation",
        gameplayTrigger: "Cancel one predicted block interaction.",
        gameplayConsequence: "The acting client may retain stale visual state.",
        expectedOutcome: "All clients converge to authoritative state.",
        actualOutcome: "Client reconciliation remains the deciding native fact.",
        affectedScope: "acting client",
        subjectIds: [],
        componentIds: ["runtime:client-reconciliation"],
        evidenceIds: [],
        validationReason: "Native client reconciliation is not statically decidable.",
        missingProof: "One acting-client versus observer-client comparison.",
        validationTest: "Cancel one water placement and compare Client A with Client B.",
        validationGroupKey: "client-reconciliation:water",
        proofNavigation: {
          recipeId: "proof:client-reconciliation",
          proofGoal: "Decide one native client reconciliation fact.",
          provenClaims: [],
          missingClaims: ["client-reconciles"],
          route: [],
          evidenceSubstitutions: [],
          historicalSearchHints: [],
          historyPressure: 0,
          familyProofCriteria: [],
          proofStopRule: "Stop after the deciding observation.",
          runtimeLastResort: true,
          runtimeRequired: true,
        },
      } as any,
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      verificationMode: "NARROW_RUNTIME_VERIFICATION",
      broadPlaythroughAllowed: false,
      test: "Cancel one water placement and compare Client A with Client B.",
    });
  });

  it("does not mistake runtime-last policy for a requirement to run Minecraft", () => {
    const groups = groupNeedValidationTests([
      {
        status: "NEED_VALIDATION",
        causalLinkId: "link:static-with-route",
        validationGroupKey: "static:with-route",
        validationTest: "Complete the source-side ownership proof.",
        missingProof: "One source-side ownership edge.",
        issueType: "BUG",
        gameplayFlow: "PROVE",
        proofNavigation: {
          recipeId: "proof:test",
          proofGoal: "Close source proof before runtime.",
          provenClaims: [],
          missingClaims: ["owner-edge"],
          route: [
            {
              order: 1,
              knowledgeDomain: "state-flow",
              question: "Who owns the write?",
              purpose: "Resolve ownership.",
              evidencePreference: "selected-artifact",
            },
            {
              order: 2,
              knowledgeDomain: "runtime",
              question: "Observe only if source proof cannot decide.",
              purpose: "Last resort.",
              evidencePreference: "runtime",
            },
          ],
          evidenceSubstitutions: [],
          historicalSearchHints: [],
          historyPressure: 0,
          familyProofCriteria: [],
          proofStopRule: "Stop once source proof decides the claim.",
          runtimeLastResort: true,
          runtimeRequired: false,
        },
      } as any,
    ]);

    expect(groups[0]?.verificationMode).toBe(
      "STATIC_PROOF_COMPLETION",
    );
    expect(groups[0]?.test).toMatch(
      /resolve without minecraft first/i,
    );
    expect(groups[0]?.test).toMatch(
      /who owns the write/i,
    );
  });

  it("keeps static proof work out of runtime mode", () => {
    const groups = groupNeedValidationTests([
      {
        status: "NEED_VALIDATION",
        causalLinkId: "link:static",
        validationGroupKey: "static:proof",
        validationTest: "Resolve the exact owner from selected-artifact evidence.",
        missingProof: "Owner proof.",
        issueType: "BUG",
        gameplayFlow: "PROVE",
      } as any,
    ]);

    expect(groups[0]?.verificationMode).toBe(
      "STATIC_PROOF_COMPLETION",
    );
    expect(groups[0]?.broadPlaythroughAllowed).toBe(false);
    expect(groups[0]?.test).toBe(
      "Resolve the exact owner from selected-artifact evidence.",
    );
  });
  it("splits a shared group name when scenario, issue type or proof mode differs", () => {
    const basic: any = {
      status: "NEED_VALIDATION",
      causalLinkId: "link:a", scenarioId: "scenario:one",
      issueType: "BUG", gameplayFlow: "PROGRESSION",
      validationGroupKey: "arena:recheck",
      validationTest: "Check the first condition in source.",
      missingProof: "Source guard",
    };
    const items = [
      basic,
      { ...basic, causalLinkId: "link:b",
        validationTest: "Check the second source condition." },
      { ...basic, causalLinkId: "link:c",
        scenarioId: "scenario:two" },
      { ...basic, causalLinkId: "link:d",
        issueType: "DESIGN_MISMATCH" },
      { ...basic, causalLinkId: "link:e",
        proofNavigation: { runtimeRequired: true },
        validationTest: "Observe only the selected runtime boundary." },
    ];
    const groups = groupNeedValidationTests(items);
    expect(groups).toHaveLength(4);
    const common = groups.find(group => group.findingIds.includes("link:a"));
    expect(common?.findingIds).toEqual(["link:a", "link:b"]);
    expect(common?.verificationMode).toBe("STATIC_PROOF_COMPLETION");
    const runtime = groups.find(group => group.findingIds.includes("link:e"));
    expect(runtime?.verificationMode).toBe("NARROW_RUNTIME_VERIFICATION");
    expect(groups.every(group => group.broadPlaythroughAllowed === false)).toBe(true);
    expect(new Set(groups.map(group => group.key)).size).toBe(groups.length);
  });

  it("preserves the original validationGroupKey when there is no scope collision", () => {
    const groups = groupNeedValidationTests([{
      status: "NEED_VALIDATION",
      causalLinkId: "link:single", scenarioId: "scenario:single",
      issueType: "BUG", gameplayFlow: "PROGRESSION",
      validationGroupKey: "stable:single",
      validationTest: "Find one exact source witness.",
      missingProof: "Source witness",
    } as any]);
    expect(groups[0]?.key).toBe("stable:single");
  });

});
