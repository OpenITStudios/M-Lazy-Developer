import type { ArenaResetCompletionSourceSummary } from "./arena-cleanup-surface-analysis.js";

export type ArenaResetClosureStatus =
  | "complete"
  | "partial"
  | "unresolved";

export type ArenaReuseEligibility =
  | "reusable"
  | "quarantined";

export interface ArenaResetClosureAssessment {
  status: ArenaResetClosureStatus;
  reuseEligibility: ArenaReuseEligibility;
  requiresRecovery: boolean;
  blockers: readonly string[];
  warnings: readonly string[];
  /** Source locators, not runtime failures. */
  sourceWitnesses?: ArenaResetCompletionSourceSummary["observations"];
  surfaces: {
    terminalSourceMissing: number;
    terminalConvergenceGaps: number;
    terminalIngressEvidenceMissing: number;
    asyncResetFailureSwallowCandidates: number;
    asyncResetPartialResultCandidates: number;
    cleanupLedgerMissing: number;
    cleanupLifecycleUnresolved: number;
    inventoryResetGaps: number;
    loadoutTransactionGaps: number;
    capabilityCleanupGaps: number;
    staleReviveContradictions: number;
    reviveAfterDeathContradictions: number;
    projectileCleanupGaps: number;
    inputLockRisks: number;
    staleFormResponseGaps: number;
    repeatedInputRisks: number;
    unguardedDeferredChunkWork: number;
    entityRemoveTerminalizationRisks: number;
    globalRuleConflicts: number;
    baselineRestoreVerificationGaps: number;
    baselinePositiveProofMissing: number;
    entityPopulationIdentityGaps: number;
    entityMultiplicityContradictions: number;
    ownedPopulationCleanupGaps: number;
  };
}

export function assessArenaResetClosure(input: {
  /** Required positive source witness; no executed reset is inferred. */
  lifecycle: {
    terminalCandidates: number;
    proven: number;
    terminalEntryPaths?: readonly {
      status:
        | "source-reachable"
        | "conditional-source-candidate"
        | "unresolved";
    }[];
  };
  cleanup: {
    ledger?: { missing: number; partial: number };
    lifecycle: { unresolved: number };
    asyncResetCompletion?: ArenaResetCompletionSourceSummary;
  };
  inventory: {
    unresolvedResetPairs: number;
    unresolvedLoadoutTransactions: number;
  };
  capability: {
    unguardedMutationRegions: number;
  };
  combat: {
    staleReviveContradictions: number;
    reviveAfterDeathContradictions: number;
    projectileCleanupContractGap: number;
  };
  interaction: {
    directInputLockRisks: number;
    staleFormResponseGaps: number;
    repeatedInputRisks: number;
  };
  chunk: {
    unguardedDeferredChunkWork: number;
    entityRemoveTerminalizationRisks: number;
  };
  worldRules: {
    conflictingGlobalRules: number;
  };
  baselineRestore: {
    candidates: number;
    verified: number;
    unresolved: number;
  };
  entityPopulation: {
    registryAuthorities: number;
    generationBoundAuthorities: number;
    unresolvedAuthorities: number;
    multiplicityContradictions: number;
    autonomousReplacementSources: number;
    replacementLineage:
      | "explicit"
      | "declared-but-inheritance-unproven"
      | "not-applicable";
    unresolvedSpawnCommits: number;
  };
}): ArenaResetClosureAssessment {
  // The command transaction analyzer reports verified .mcfunction ordering.
  // Those source facts do NOT bind an independently authored Script API
  // reset request to the same arena or the same generation. Until a verified
  // arena/generation attribution exists, each reset-world request still
  // carries its own unclosed world-baseline obligation.
  const worldResetRequests =
    input.cleanup.asyncResetCompletion?.worldResetRequests ?? 0;
  const surfaces = {
    // No reported gap is not positive evidence of reset or reusable arena.
    terminalSourceMissing:
      input.lifecycle.terminalCandidates === 0 ? 1 : 0,
    terminalConvergenceGaps:
      Math.max(0, input.lifecycle.terminalCandidates - input.lifecycle.proven),
    terminalIngressEvidenceMissing:
      Math.max(0, input.lifecycle.terminalCandidates -
        (input.lifecycle.terminalEntryPaths ?? []).filter(entry =>
          entry.status === "source-reachable").length),
    asyncResetFailureSwallowCandidates:
      input.cleanup.asyncResetCompletion?.swallowedFailurePaths ?? 0,
    asyncResetPartialResultCandidates:
      input.cleanup.asyncResetCompletion?.partialResultPaths ?? 0,
    cleanupLedgerMissing:
      input.cleanup.ledger?.missing ?? 0,
    cleanupLifecycleUnresolved:
      input.cleanup.lifecycle.unresolved,
    inventoryResetGaps:
      input.inventory.unresolvedResetPairs,
    loadoutTransactionGaps:
      input.inventory.unresolvedLoadoutTransactions,
    capabilityCleanupGaps:
      input.capability.unguardedMutationRegions,
    staleReviveContradictions:
      input.combat.staleReviveContradictions,
    reviveAfterDeathContradictions:
      input.combat.reviveAfterDeathContradictions,
    projectileCleanupGaps:
      input.combat.projectileCleanupContractGap,
    inputLockRisks:
      input.interaction.directInputLockRisks,
    staleFormResponseGaps:
      input.interaction.staleFormResponseGaps,
    repeatedInputRisks:
      input.interaction.repeatedInputRisks,
    unguardedDeferredChunkWork:
      input.chunk.unguardedDeferredChunkWork,
    entityRemoveTerminalizationRisks:
      input.chunk.entityRemoveTerminalizationRisks,
    globalRuleConflicts:
      input.worldRules.conflictingGlobalRules,
    baselineRestoreVerificationGaps:
      input.baselineRestore.unresolved,
    // Per-request source obligation. A verified transaction in another
    // function/world/arena/generation must never close this count just
    // because global mcfunction verified > 0.
    baselinePositiveProofMissing:
      worldResetRequests,
    entityPopulationIdentityGaps:
      input.entityPopulation.registryAuthorities > 0
        ? input.entityPopulation.unresolvedAuthorities
        : 0,
    entityMultiplicityContradictions:
      input.entityPopulation.multiplicityContradictions,
    ownedPopulationCleanupGaps:
      input.entityPopulation.unresolvedSpawnCommits +
      (
        input.entityPopulation.autonomousReplacementSources > 0 &&
        input.entityPopulation.replacementLineage !== "explicit"
          ? 1
          : 0
      ),
  };

  const blockers = Object.entries(surfaces)
    .filter(([, value]) => value > 0)
    .map(([key]) => key)
    .sort();
  const warnings = [
    ...((input.cleanup.ledger?.partial ?? 0) > 0
      ? ["cleanupLedgerPartial"] : []),
    ...((input.cleanup.asyncResetCompletion?.earlyIdlePaths ?? 0) > 0
      ? ["idleBeforeCleanupSettlementSourceCandidate"] : []),
    // Settlement alone is not positive evidence of VERIFY_EMPTY. This is a
    // source warning, not a claim that admission occurred with dirty blocks.
    ...((input.cleanup.asyncResetCompletion?.settlementOnlyAdmissions ?? 0) > 0
      ? ["startAdmissionReliesOnCleanupSettlementSourceCandidate"] : []),
    // Preserve the independently useful command verification fact while
    // marking that its arena/generation attribution was never established.
    ...(worldResetRequests > 0 && input.baselineRestore.verified > 0
      ? ["baselineCommandVerificationUnattributedToArenaGeneration"] : []),
  ];

  const status:
    ArenaResetClosureStatus =
      blockers.length > 0
        ? "unresolved"
        : warnings.length > 0
          ? "partial"
          : "complete";

  return {
    status,
    reuseEligibility:
      status === "complete"
        ? "reusable"
        : "quarantined",
    requiresRecovery:
      status !== "complete",
    blockers,
    warnings,
    sourceWitnesses: [...(input.cleanup.asyncResetCompletion?.observations ?? [])],
    surfaces,
  };
}
