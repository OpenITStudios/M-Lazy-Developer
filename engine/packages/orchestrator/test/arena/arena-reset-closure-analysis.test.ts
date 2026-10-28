import {
  describe,
  expect,
  it,
} from "vitest";
import {
  assessArenaResetClosure,
} from "../../src/arena/arena-reset-closure-analysis.js";

const clean: Parameters<typeof assessArenaResetClosure>[0] = {
  lifecycle: {
    terminalCandidates: 1,
    proven: 1,
    terminalEntryPaths: [{ status: "source-reachable" }],
  },
  cleanup: {
    ledger: { missing: 0, partial: 0 },
    lifecycle: { unresolved: 0 },
  },
  inventory: {
    unresolvedResetPairs: 0,
    unresolvedLoadoutTransactions: 0,
  },
  capability: {
    unguardedMutationRegions: 0,
  },
  combat: {
    staleReviveContradictions: 0,
    reviveAfterDeathContradictions: 0,
    projectileCleanupContractGap: 0,
  },
  interaction: {
    directInputLockRisks: 0,
    staleFormResponseGaps: 0,
    repeatedInputRisks: 0,
  },
  chunk: {
    unguardedDeferredChunkWork: 0,
    entityRemoveTerminalizationRisks: 0,
  },
  worldRules: {
    conflictingGlobalRules: 0,
  },
  baselineRestore: {
    candidates: 0,
    verified: 0,
    unresolved: 0,
  },
  entityPopulation: {
    registryAuthorities: 0,
    generationBoundAuthorities: 0,
    unresolvedAuthorities: 0,
    multiplicityContradictions: 0,
    autonomousReplacementSources: 0,
    replacementLineage: "not-applicable",
    unresolvedSpawnCommits: 0,
  },
};

describe("arena reset closure", () => {
  it("quarantines candidate swallowed failures or returned skipped chunks", () => {
    const source = {
      artifactId: "fixture",
      relativePath: "scripts/reset.js",
      range: { lineStart: 8, lineEnd: 8, columnStart: 1, columnEnd: 20 },
    };
    const result = assessArenaResetClosure({
      ...clean,
      cleanup: {
        ...clean.cleanup,
        asyncResetCompletion: {
          swallowedFailurePaths: 1,
          partialResultPaths: 1,
          earlyIdlePaths: 1,
          observations: [{
            scriptId: "reset",
            kind: "reset-error-swallowed-candidate",
            executionRegion: "function:GameManager.trackArenaCleanup@7:1",
            source,
            detail: "log-only source catch",
          }],
        },
      },
    });
    expect(result.status).toBe("unresolved");
    expect(result.reuseEligibility).toBe("quarantined");
    expect(result.blockers).toContain("asyncResetFailureSwallowCandidates");
    expect(result.blockers).toContain("asyncResetPartialResultCandidates");
    expect(result.warnings).toContain("idleBeforeCleanupSettlementSourceCandidate");
    expect(result.sourceWitnesses).toEqual(expect.arrayContaining([
      expect.objectContaining({ source, scriptId: "reset" }),
    ]));
  });

  it("fails closed when terminal, convergence, or entry proof is missing", () => {
    const absent = assessArenaResetClosure({
      ...clean,
      lifecycle: { terminalCandidates: 0, proven: 0, terminalEntryPaths: [] },
    });
    expect(absent.reuseEligibility).toBe("quarantined");
    expect(absent.blockers).toContain("terminalSourceMissing");

    const orphaned = assessArenaResetClosure({
      ...clean,
      lifecycle: {
        terminalCandidates: 1,
        proven: 1,
        terminalEntryPaths: [{ status: "unresolved" }],
      },
    });
    expect(orphaned.blockers).toContain("terminalIngressEvidenceMissing");

    const guarded = assessArenaResetClosure({
      ...clean,
      lifecycle: {
        terminalCandidates: 1,
        proven: 1,
        terminalEntryPaths: [{ status: "conditional-source-candidate" }],
      },
    });
    expect(guarded.blockers).toContain("terminalIngressEvidenceMissing");

    const partial = assessArenaResetClosure({
      ...clean,
      lifecycle: {
        terminalCandidates: 2,
        proven: 1,
        terminalEntryPaths: [{ status: "source-reachable" }],
      },
    });
    expect(partial.blockers).toContain("terminalConvergenceGaps");
    expect(partial.reuseEligibility).toBe("quarantined");
  });

  it("reports complete only when every consumed domain is closed", () => {
    expect(
      assessArenaResetClosure(clean),
    ).toMatchObject({
      status: "complete",
      reuseEligibility: "reusable",
      requiresRecovery: false,
      blockers: [],
    });
  });

  it("fails closed when any domain still leaks state", () => {
    const result =
      assessArenaResetClosure({
        ...clean,
        interaction: {
          ...clean.interaction,
          directInputLockRisks: 1,
        },
        combat: {
          ...clean.combat,
          staleReviveContradictions: 1,
        },
      });

    expect(result.status).toBe("unresolved");
    expect(result.reuseEligibility).toBe(
      "quarantined",
    );
    expect(result.requiresRecovery).toBe(
      true,
    );
    expect(result.blockers).toEqual([
      "inputLockRisks",
      "staleReviveContradictions",
    ]);
  });

  it("keeps surface-level cleanup proof partial instead of green", () => {
    const result =
      assessArenaResetClosure({
        ...clean,
        cleanup: {
          ledger: {
            missing: 0,
            partial: 1,
          },
          lifecycle: {
            unresolved: 0,
          },
        },
      });

    expect(result.status).toBe("partial");
    expect(result.reuseEligibility).toBe(
      "quarantined",
    );
    expect(result.requiresRecovery).toBe(
      true,
    );
    expect(result.warnings).toEqual([
      "cleanupLedgerPartial",
    ]);
  });
});


describe("arena reuse quarantine gate", () => {
  it("does not allow partial cleanup evidence to reactivate an arena", () => {
    const dirty =
      assessArenaResetClosure({
        ...clean,
        cleanup: {
          ledger: {
            missing: 0,
            partial: 1,
          },
          lifecycle: {
            unresolved: 0,
          },
        },
      });

    expect(dirty.reuseEligibility).toBe(
      "quarantined",
    );

    const recovered =
      assessArenaResetClosure(clean);

    expect(
      recovered.reuseEligibility,
    ).toBe("reusable");
  });
});


describe("baseline restore verification gate", () => {
  it("quarantines arena reuse when reset-world restoration remains unverified", () => {
    const result =
      assessArenaResetClosure({
        ...clean,
        baselineRestore: {
          candidates: 1,
          verified: 0,
          unresolved: 1,
        },
      });

    expect(result.status).toBe("unresolved");
    expect(result.reuseEligibility).toBe(
      "quarantined",
    );
    expect(result.blockers).toContain(
      "baselineRestoreVerificationGaps",
    );
  });
});


describe("entity identity and multiplicity reset gate", () => {
  it("quarantines reset reuse when a declared entity registry is not generation-bound", () => {
    const result =
      assessArenaResetClosure({
        ...clean,
        entityPopulation: {
          ...clean.entityPopulation,
          registryAuthorities: 1,
          generationBoundAuthorities: 0,
          unresolvedAuthorities: 1,
          multiplicityContradictions: 0,
        },
      });

    expect(result.reuseEligibility).toBe(
      "quarantined",
    );
    expect(result.blockers).toContain(
      "entityPopulationIdentityGaps",
    );
  });

  it("quarantines reset reuse on proven spawn multiplicity contradiction", () => {
    const result =
      assessArenaResetClosure({
        ...clean,
        entityPopulation: {
          ...clean.entityPopulation,
          registryAuthorities: 1,
          generationBoundAuthorities: 1,
          unresolvedAuthorities: 0,
          multiplicityContradictions: 1,
        },
      });

    expect(result.blockers).toContain(
      "entityMultiplicityContradictions",
    );
  });
});


describe("owned population cleanup gate", () => {
  it("quarantines reuse when autonomous replacement lineage is not explicit", () => {
    const result =
      assessArenaResetClosure({
        ...clean,
        entityPopulation: {
          ...clean.entityPopulation,
          autonomousReplacementSources: 1,
          replacementLineage:
            "declared-but-inheritance-unproven",
        },
      });

    expect(result.blockers).toContain(
      "ownedPopulationCleanupGaps",
    );
  });

  it("quarantines reuse when spawn commit remains unresolved", () => {
    const result =
      assessArenaResetClosure({
        ...clean,
        entityPopulation: {
          ...clean.entityPopulation,
          unresolvedSpawnCommits: 1,
        },
      });

    expect(result.reuseEligibility).toBe(
      "quarantined",
    );
  });
});
