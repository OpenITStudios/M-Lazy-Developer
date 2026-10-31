// Coherent Development test family, source-only consolidation.
// Original cases and assertions remain; executable equivalence not yet proven.
import { describe, expect, it } from "vitest";
import { assessAuditRisk, evaluateGameplayBugCandidateEvidence, type GameplayBugCandidateRule, assessDiagnosticHypotheses, rankDiagnosticProbes, validateDiagnosticHypothesisSet, validateDiagnosticProbeCandidates, type DiagnosticHypothesisSet, type DiagnosticProbeCandidate, findDesignConsistencyAnomalies, findNegativeSpace, prioritizeTemporalInteraction, semanticRevisionFromKnowledgeClaim, semanticRuntimeClassFromProfile } from "../src/index.js";
import { type GameplayContract } from "../../gameplay-intent/src/index.js";
import { type KnowledgeClaimV2 } from "../../knowledge/src/index.js";
import { type MinecraftRuntimeProfile } from "../../runtime-profile/src/index.js";

// Original suite: engine/packages/diagnostic-reasoning/test/audit-risk.test.ts (blob 0002ed00fcf00d1ed39658805fd046a45336d7f7)
{


describe("audit risk", () => {
  it("keeps simple non-critical surfaces static", () => {
    expect(
      assessAuditRisk({
        surfaceId: "surface:copy",
        factors: [],
      }),
    ).toMatchObject({
      priority: "low",
      proofDepth: "static",
      criticality: "low",
    });
  });

  it("escalates interacting high-risk factors to deep proof", () => {
    expect(
      assessAuditRisk({
        surfaceId: "runtime:persistence",
        factors: [
          "persistence",
          "reload",
          "reconnect",
        ],
      }),
    ).toMatchObject({
      priority: "high",
      proofDepth: "deep",
    });
  });

  it("never deprioritizes a blocker just because technical complexity is low", () => {
    expect(
      assessAuditRisk({
        surfaceId: "runtime:progression-completion",
        factors: [],
        criticality: "blocker",
      }),
    ).toMatchObject({
      technicalRiskScore: 0,
      criticality: "blocker",
      priority: "high",
      proofDepth: "deep",
    });
  });
});
}

// Original suite: engine/packages/diagnostic-reasoning/test/candidate-evidence.test.ts (blob 25694a81b65ab4d66c48a129fa1ca1a899cb44e1)
{


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
}

// Original suite: engine/packages/diagnostic-reasoning/test/diagnostic-reasoning.test.ts (blob b6b732ac7574110f718b7d20fc3dc1a08989832b)
{


const hypotheses: DiagnosticHypothesisSet = {
  schemaVersion: 1,
  id: "entity-stall",
  hypotheses: [
    {
      id: "chunk-unloaded",
      statement:
        "The entity cannot progress because its route chunk is not loaded for script.",
      requiredPredicates: [
        "route-chunk-unloaded",
      ],
      falsifierPredicates: [
        "route-chunk-loaded",
      ],
    },
    {
      id: "navigation-lost",
      statement:
        "The entity has lost its active navigation target.",
      requiredPredicates: [
        "navigation-target-missing",
      ],
      falsifierPredicates: [
        "navigation-target-present",
      ],
    },
    {
      id: "collision-congestion",
      statement:
        "Nearby entity collision is preventing forward progress.",
      supportingPredicates: [
        "local-entity-density-high",
      ],
      falsifierPredicates: [
        "local-entity-density-low",
      ],
    },
  ],
};

const probes: DiagnosticProbeCandidate[] = [
  {
    id: "probe-chunk",
    predicate: "route-chunk-loaded",
    cost: 0.1,
    risk: 0,
    predictions: [
      {
        hypothesisId: "chunk-unloaded",
        state: "absent",
      },
      {
        hypothesisId: "navigation-lost",
        state: "present",
      },
      {
        hypothesisId: "collision-congestion",
        state: "present",
      },
    ],
  },
  {
    id: "probe-scoreboard",
    predicate: "unrelated-score",
    cost: 0.1,
    risk: 0,
    predictions: [
      {
        hypothesisId: "chunk-unloaded",
        state: "present",
      },
      {
        hypothesisId: "navigation-lost",
        state: "present",
      },
      {
        hypothesisId: "collision-congestion",
        state: "present",
      },
    ],
  },
];

describe("diagnostic reasoning", () => {
  it("keeps incomplete alternatives open and eliminates only explicit contradictions", () => {
    const assessments =
      assessDiagnosticHypotheses(
        hypotheses,
        [{
          predicate:
            "route-chunk-loaded",
          state: "present",
          evidenceId: "e:chunk",
        }],
      );

    expect(
      assessments.find(
        (item) =>
          item.hypothesisId ===
          "chunk-unloaded",
      )?.disposition,
    ).toBe("eliminated");

    expect(
      assessments.find(
        (item) =>
          item.hypothesisId ===
          "navigation-lost",
      )?.disposition,
    ).toBe("open");
  });

  it("ranks a discriminating probe above a non-discriminating probe", () => {
    const assessments =
      assessDiagnosticHypotheses(
        hypotheses,
        [],
      );
    const ranked =
      rankDiagnosticProbes(
        probes,
        assessments,
      );

    expect(ranked[0]?.probeId)
      .toBe("probe-chunk");
    expect(
      ranked[0]?.pairwiseSeparations,
    ).toBeGreaterThan(0);
    expect(
      ranked[1]?.pairwiseSeparations,
    ).toBe(0);
  });

  it("validates hypothesis and probe references", () => {
    expect(
      validateDiagnosticHypothesisSet(
        hypotheses,
      ),
    ).toEqual([]);
    expect(
      validateDiagnosticProbeCandidates(
        hypotheses,
        probes,
      ),
    ).toEqual([]);
  });
});
}

// Original suite: engine/packages/diagnostic-reasoning/test/hidden-defect-analysis.test.ts (blob 2d3cce1c228afac86d550fc04fa5e678833544b5)
{


describe("hidden gameplay defect reasoning", () => {
  it("detects consumer-without-producer softlock risk", () => {
    const signals = findNegativeSpace({
      subjectId: "state:wave-ready",
      hasConsumer: true,
      hasProducer: false,
    });

    expect(signals[0]?.kind).toBe("consumer-without-producer");
  });

  it("prioritizes high-risk temporal intersections", () => {
    const risk = prioritizeTemporalInteraction({
      leftSystem: "reconnect",
      rightSystem: "respawn",
      factors: ["async", "reconnect", "delayed-callback"],
    });

    expect(risk.priority).toBe("high");
    expect(risk.windows).toEqual(["before", "overlap", "after"]);
  });

  it("flags a peer outlier without calling it a bug", () => {
    const result = findDesignConsistencyAnomalies([
      { subjectId: "arena:1", dimension: "session-capability", value: 1 },
      { subjectId: "arena:2", dimension: "session-capability", value: 1 },
      { subjectId: "arena:3", dimension: "session-capability", value: 0 },
    ]);

    expect(result).toEqual([
      expect.objectContaining({
        subjectId: "arena:3",
        peerValue: 1,
        peerCount: 2,
      }),
    ]);
  });
});
}

// Original suite: engine/packages/diagnostic-reasoning/test/knowledge-semantics.test.ts (blob 162862bfba7c21958de8815c5c61bceb93b15d8c)
{


const profile: MinecraftRuntimeProfile = {
  schemaVersion: 2,
  product: {
    family: "bedrock-engine",
    edition: "education",
    version: "1.26.32",
  },
  host: "education-host",
  scriptModules: {
    "@minecraft/server": {
      version: "2.9.0",
      track: "stable",
    },
  },
  experiments: [],
  inventory: {
    scriptModules: "complete",
    experiments: "complete",
    worldSettings: "partial",
    packs: "partial",
  },
};

const claim: KnowledgeClaimV2 = {
  schemaVersion: 2,
  id: "knowledge:edu:chunk",
  subject: {
    kind: "runtime-state",
    id: "chunk.loaded-for-script",
  },
  predicate: "is-supported-on",
  object: true,
  classification: "documented-contract",
  applicability: {
    editions: ["education"],
    hosts: ["education-host"],
    minProductVersion: "1.26.30",
    maxProductVersionInclusive: "1.26.40",
  },
  evidence: [{
    id: "e:official",
    kind: "source-revision",
    sourceRevisionId: "src:official",
    specificity: "version",
    reproducibility: "not-tested",
    targetMatch: "compatible",
  }],
  certainty: "established",
  lifecycle: "verified",
  description:
    "Education chunk loaded-for-script behavior is documented for this target range.",
};

describe("knowledge to semantic claim binding", () => {
  it("maps a compatible knowledge claim into the exact runtime semantic class", () => {
    expect(
      semanticRuntimeClassFromProfile(profile),
    ).toBe("education-host");

    const result =
      semanticRevisionFromKnowledgeClaim(
        claim,
        {
          knowledgeClaimId: claim.id,
          semanticClaimId:
            "chunk.loaded-for-script",
          disposition: "affirmed",
        },
        profile,
      );

    expect(result.applicability)
      .toBe("applies");
    expect(result.revision).toMatchObject({
      claimId: "chunk.loaded-for-script",
      runtimeClass: "education-host",
      minecraftVersion: "1.26.32",
      disposition: "affirmed",
      provenance: {
        kind: "official-knowledge",
        evidenceCeiling: "documented",
      },
    });
  });

  it("refuses to bind knowledge across incompatible runtime classes", () => {
    const bedrock: MinecraftRuntimeProfile = {
      ...profile,
      product: {
        ...profile.product,
        edition: "bedrock-retail",
      },
      host: "dedicated-server",
    };

    const result =
      semanticRevisionFromKnowledgeClaim(
        claim,
        {
          knowledgeClaimId: claim.id,
          semanticClaimId:
            "chunk.loaded-for-script",
          disposition: "affirmed",
        },
        bedrock,
      );

    expect(result.applicability)
      .toBe("does-not-apply");
    expect(result.revision)
      .toBeUndefined();
  });

  it("keeps conflicting knowledge claims unresolved", () => {
    const conflicting: KnowledgeClaimV2 = {
      ...claim,
      certainty: "conflicting",
      lifecycle: "contested",
    };

    const result =
      semanticRevisionFromKnowledgeClaim(
        conflicting,
        {
          knowledgeClaimId:
            conflicting.id,
          semanticClaimId:
            "chunk.loaded-for-script",
          disposition: "affirmed",
        },
        profile,
      );

    expect(result.applicability)
      .toBe("unknown");
    expect(result.revision)
      .toBeUndefined();
  });

  it("does not invent a semantic class for an unsupported edition-host combination", () => {
    const invalidRuntime: MinecraftRuntimeProfile = {
      ...profile,
      host: "client",
    };

    expect(
      semanticRuntimeClassFromProfile(
        invalidRuntime,
      ),
    ).toBeUndefined();
  });
});
}
