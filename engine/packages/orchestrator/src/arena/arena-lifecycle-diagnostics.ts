import {
  createDiagnostic,
  type DiagnosticFinding,
} from "../../../diagnostics/src/index.js";
import type {
  ArenaLifecycleAnalysis,
} from "./arena-lifecycle-analysis.js";
import type {
  ArenaCleanupSurfaceAnalysis,
} from "./arena-cleanup-surface-analysis.js";

export function arenaLifecycleDiagnostics(
  lifecycle: ArenaLifecycleAnalysis,
  cleanup: ArenaCleanupSurfaceAnalysis,
): DiagnosticFinding[] {
  const ledgerMissing =
    cleanup.ledger?.missing ?? 0;
  const ledgerPartial =
    cleanup.ledger?.partial ?? 0;

  const strongRisk =
    lifecycle.unresolved > 0 ||
    cleanup.unresolved > 0 ||
    cleanup.lifecycle.unresolved > 0 ||
    ledgerMissing > 0;

  const reviewRisk =
    lifecycle.partial > 0 ||
    cleanup.partial > 0 ||
    ledgerPartial > 0 ||
    lifecycle.unresolvedDeferredMutations > 0;

  if (!strongRisk && !reviewRisk) {
    return [];
  }

  return [
    createDiagnostic({
      code: "ARENA_LIFECYCLE_COVERAGE_GAP",
      severity: strongRisk
        ? "medium"
        : "minor",
      message:
        "Arena terminal, cleanup, or deferred mutation ownership remains unproven for the selected source; guard syntax alone is not runtime protection.",
      data: {
        lifecycleTerminalCandidates:
          lifecycle.terminalCandidates,
        lifecyclePartial:
          lifecycle.partial,
        lifecycleUnresolved:
          lifecycle.unresolved,
        deferredSourceGuardCandidates:
          lifecycle.sourceGuardCandidateDeferredMutations,
        deferredSourceSnapshotCandidates:
          lifecycle.sourceSnapshotCandidateDeferredMutations,
        deferredMutationOwnershipUnresolved:
          lifecycle.unresolvedDeferredMutations,
        cleanupAcquiredSurfaces:
          cleanup.acquiredSurfaces,
        cleanupPartial:
          cleanup.partial,
        cleanupUnresolved:
          cleanup.unresolved,
        cleanupLedgerPartial:
          ledgerPartial,
        cleanupLedgerMissing:
          ledgerMissing,
        cleanupLifecycleDeclared:
          cleanup.lifecycle.declared,
        cleanupLifecycleComplete:
          cleanup.lifecycle.complete,
        cleanupLifecycleUnresolved:
          cleanup.lifecycle.unresolved,
      },
    }),
  ];
}
