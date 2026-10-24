import { describe, expect, it } from "vitest";
import type { GameplayContract } from "../../gameplay-intent/src/index.js";
import {
  evaluateGameplayBugCandidateEvidence,
  type GameplayBugCandidateRule,
} from "../src/index.js";

const readyContract = {
  schemaVersion: 1 as const,
  modelId: "test",
  artifactId: "artifact:test",
  evidenceScope: "selected-artifact-only" as const,
  subjectIds: ["objective:test"],
  invariantIds: ["inv:test"],
  authorityEvidenceIds: ["artifact:test:contract"],
  implementationEvidenceIds: [],
  playerFacingClaimEvidenceIds: [],
  designChallenge: {
    disposition: "grounded-design" as const,
    reasons: ["synthetic approved-design fixture"],
    evidenceIds: ["artifact:test:contract"],
    implementationEvidenceIds: [],
    designEvidenceIds: ["artifact:test:contract"],
    designClaimEvidenceIds: [],
    playerFacingEvidenceIds: [],
  },
  readiness: {
    disposition: "ready" as const,
    scopeSubjectIds: ["objective:test"],
    blockingUnknownIds: [],
    toleratedUnknownIds: [],
    reasons: ["ready"],
  },
} satisfies GameplayContract;

const rule: GameplayBugCandidateRule = {
  id: "reset-leak",
  kind: "reset-leakage",
  scopeSubjectIds: ["objective:test"],
  requiredPredicates: [
    "retry-occurs",
    "old-state-survives",
  ],
  playerImpactPredicates: [
    "next-attempt-gameplay-changed",
  ],
  counterEvidencePredicates: [
    "contract-allows-persistence",
  ],
};

// A plausible design alternative is explanatory only; suppressing a bug
// candidate requires separately declared counterproof that makes the bad
// postcondition unreachable.
const ruleWithBlockingProof: GameplayBugCandidateRule = {
  ...rule,
  blockingCounterEvidencePredicates: ["stale-state-provably-unreachable"],
};

describe("gameplay bug candidate evidence gate", () => {
  it("fails closed when Gameplay Contract is missing", () => {
    const result = evaluateGameplayBugCandidateEvidence(
      rule,
      [],
    );
    expect(result.disposition).toBe("contract-missing");
  });

  it("rejects a Gameplay Contract from another scope", () => {
    const result = evaluateGameplayBugCandidateEvidence(
      rule,
      [],
      {
        ...readyContract,
        subjectIds: ["objective:other"],
      },
    );
    expect(result.disposition).toBe("contract-missing");
  });

  it("blocks candidate discovery when the Gameplay Contract is blocked", () => {
    const result = evaluateGameplayBugCandidateEvidence(
      rule,
      [],
      {
        ...readyContract,
        readiness: {
          disposition: "blocked",
          scopeSubjectIds: ["objective:test"],
          blockingUnknownIds: ["unknown:contract"],
          toleratedUnknownIds: [],
          reasons: ["material contract unknown"],
        },
      },
    );
    expect(result.disposition).toBe("contract-blocked");
  });


  it("suppresses only explicit blocking proof, not explanatory alternatives", () => {
    const evidence = [
      { predicate: "retry-occurs", state: "present" as const, evidenceId: "e:retry" },
      { predicate: "old-state-survives", state: "present" as const, evidenceId: "e:state" },
      { predicate: "next-attempt-gameplay-changed", state: "present" as const, evidenceId: "e:impact" },
      { predicate: "contract-allows-persistence", state: "present" as const, evidenceId: "e:design" },
    ];
    const explanationOnly = evaluateGameplayBugCandidateEvidence(
      rule, evidence, readyContract,
    );
    expect(explanationOnly.disposition).toBe("candidate");
    expect(explanationOnly.counterEvidenceIds).toEqual([]);

    const result = evaluateGameplayBugCandidateEvidence(
      ruleWithBlockingProof,
      [...evidence, {
        predicate: "stale-state-provably-unreachable",
        state: "present",
        evidenceId: "e:blocking",
      }],
      readyContract,
    );
    expect(result.disposition).toBe("suppressed-by-counter-evidence");
    expect(result.counterEvidenceIds).toEqual(["e:blocking"]);
  });

  it("retains a material candidate while a blocking proof check is unresolved", () => {
    const result = evaluateGameplayBugCandidateEvidence(
      ruleWithBlockingProof,
      [
        { predicate: "retry-occurs", state: "present" },
        { predicate: "old-state-survives", state: "present" },
        { predicate: "next-attempt-gameplay-changed", state: "present" },
      ],
      readyContract,
    );

    expect(result.disposition).toBe("candidate");
    expect(result.unresolvedCounterPredicates).toEqual([
      "stale-state-provably-unreachable",
    ]);
  });

  it("retains a core defect pattern when player impact is still unknown", () => {
    const result = evaluateGameplayBugCandidateEvidence(
      rule,
      [
        { predicate: "retry-occurs", state: "present", evidenceId: "e:retry" },
        { predicate: "old-state-survives", state: "present", evidenceId: "e:state" },
        { predicate: "next-attempt-gameplay-changed", state: "unknown" },
        { predicate: "contract-allows-persistence", state: "absent" },
      ],
      readyContract,
    );

    expect(result.disposition).toBe("candidate");
    expect(result.missingPredicates).toEqual([
      "next-attempt-gameplay-changed",
    ]);
  });

  it("retains a partially grounded pattern and targets only missing required predicates", () => {
    const result = evaluateGameplayBugCandidateEvidence(
      rule,
      [
        { predicate: "retry-occurs", state: "present", evidenceId: "e:retry" },
        { predicate: "old-state-survives", state: "unknown" },
        { predicate: "next-attempt-gameplay-changed", state: "present", evidenceId: "e:impact" },
        { predicate: "contract-allows-persistence", state: "absent" },
      ],
      readyContract,
    );

    expect(result.disposition).toBe("candidate");
    expect(result.supportingEvidenceIds).toEqual([
      "e:retry",
    ]);
    expect(result.playerImpactEvidenceIds).toEqual([
      "e:impact",
    ]);
    expect(result.missingPredicates).toEqual([
      "old-state-survives",
    ]);
  });

  it("does not emit a candidate when every required defect predicate is still unknown", () => {
    const result = evaluateGameplayBugCandidateEvidence(
      rule,
      [
        { predicate: "contract-allows-persistence", state: "absent" },
      ],
      readyContract,
    );

    expect(result.disposition).toBe(
      "insufficient-evidence",
    );
  });

  it("does not report technical patterns without player-visible impact", () => {
    const result = evaluateGameplayBugCandidateEvidence(
      rule,
      [
        { predicate: "retry-occurs", state: "present" },
        { predicate: "old-state-survives", state: "present" },
        { predicate: "next-attempt-gameplay-changed", state: "absent" },
        { predicate: "contract-allows-persistence", state: "absent" },
      ],
      readyContract,
    );

    expect(result.disposition).toBe("no-player-impact");
  });

  it("emits a candidate only after counter-evidence is cleared and player impact is grounded", () => {
    const result = evaluateGameplayBugCandidateEvidence(
      rule,
      [
        { predicate: "retry-occurs", state: "present", evidenceId: "e:retry" },
        { predicate: "old-state-survives", state: "present", evidenceId: "e:state" },
        { predicate: "next-attempt-gameplay-changed", state: "present", evidenceId: "e:impact" },
        { predicate: "contract-allows-persistence", state: "absent" },
      ],
      readyContract,
    );

    expect(result.disposition).toBe("candidate");
    expect(result.supportingEvidenceIds).toEqual([
      "e:retry",
      "e:state",
    ]);
    expect(result.playerImpactEvidenceIds).toEqual([
      "e:impact",
    ]);
  });
});
