export type FullMapReplicaStatus =
  | "EQUIVALENT"
  | "BOUNDED_EQUIVALENCE"
  | "DIVERGENCE_REQUIRES_CLASSIFICATION"
  | "INCOMPLETE_PROOF";

export interface FullMapReplicaResult {
  readonly replicaId: string;
  readonly replicaStatus: FullMapReplicaStatus;
  readonly replicaDivergenceIds: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly reason: string;
}

export interface FullMapReplicaReceipt {
  readonly policy: "full-map-baseline-delta";
  readonly replicaBaseline: string;
  readonly replicaResults: readonly FullMapReplicaResult[];
  readonly replicaDivergenceIds: readonly string[];
  readonly incompleteReplicaIds: readonly string[];
  readonly baselineReusableForAllReplicas: boolean;
}

/**
 * Consolidates existing replica proof into one readable baseline/delta receipt.
 * It does not perform new world comparison and therefore cannot become a
 * second replica analyzer.
 */
export function buildFullMapReplicaReceipt(input: {
  readonly replicaBaseline: string;
  /** Physical replica count from current-map topology, not a config guess. */
  readonly expectedReplicaCount?: number;
  readonly replicas: readonly {
    readonly replicaId: string;
    readonly proofStatus:
      | "complete-proof"
      | "bounded-proof"
      | "diverged"
      | "incomplete-proof"
      | "budget-exceeded"
      | "no-proof";
    readonly mismatchCount: number;
    readonly evidenceIds?: readonly string[];
  }[];
}): FullMapReplicaReceipt {
  const replicaResults: FullMapReplicaResult[] =
    input.replicas.map((replica) => {
      const incomplete =
        replica.proofStatus === "incomplete-proof" ||
        replica.proofStatus === "budget-exceeded" ||
        replica.proofStatus === "no-proof";
      const diverged =
        replica.proofStatus === "diverged" ||
        replica.mismatchCount > 0;
      const replicaStatus: FullMapReplicaStatus =
        incomplete
          ? "INCOMPLETE_PROOF"
          : diverged
            ? "DIVERGENCE_REQUIRES_CLASSIFICATION"
            : replica.proofStatus === "bounded-proof"
              ? "BOUNDED_EQUIVALENCE"
              : "EQUIVALENT";

      return {
        replicaId: replica.replicaId,
        replicaStatus,
        replicaDivergenceIds:
          replicaStatus === "DIVERGENCE_REQUIRES_CLASSIFICATION"
            ? [
                "replica-delta:" +
                  replica.replicaId,
              ]
            : [],
        evidenceIds: [
          ...(replica.evidenceIds ?? []),
        ],
        reason:
          replicaStatus === "EQUIVALENT"
            ? "Complete replica proof found no material divergence within the compared proof surface."
            : replicaStatus === "BOUNDED_EQUIVALENCE"
              ? "Bounded replica proof found no divergence within its covered scope. This does not claim full-map equivalence outside that scope."
              : replicaStatus === "DIVERGENCE_REQUIRES_CLASSIFICATION"
                ? "Replica contains one or more world/topology differences. These differences must continue to semantic/causal classification before they may be called gameplay-material or safely ignored."
                : "Replica proof is incomplete and baseline safety cannot be inherited.",
      };
    });

  const replicaDivergenceIds = [
    ...new Set(
      replicaResults.flatMap(
        (item) => item.replicaDivergenceIds,
      ),
    ),
  ].sort();
  const replicaIds = replicaResults.map(item => item.replicaId);
  const distinctReplicaIds = new Set(replicaIds);
  const completeReplicaRoster =
    input.expectedReplicaCount !== undefined &&
    Number.isSafeInteger(input.expectedReplicaCount) &&
    input.expectedReplicaCount > 0 &&
    replicaResults.length === input.expectedReplicaCount &&
    distinctReplicaIds.size === input.expectedReplicaCount &&
    replicaIds.every(id =>
      id.trim().length > 0 && id !== input.replicaBaseline);

  const incompleteReplicaIds =
    replicaResults
      .filter(
        (item) =>
          item.replicaStatus ===
          "INCOMPLETE_PROOF",
      )
      .map((item) => item.replicaId)
      .sort();

  return {
    policy: "full-map-baseline-delta",
    replicaBaseline: input.replicaBaseline,
    replicaResults: replicaResults.sort(
      (a, b) =>
        a.replicaId.localeCompare(b.replicaId),
    ),
    replicaDivergenceIds,
    incompleteReplicaIds,
    baselineReusableForAllReplicas:
      completeReplicaRoster &&
      replicaResults.every(
        (item) =>
          item.replicaStatus === "EQUIVALENT",
      ),
  };
}
