import type {
  RepairStrategyEnumeration,
} from "./repair-strategy-enumeration.js";
import type {
  ProviderRepairRealization,
} from "./repair-strategy-enumeration.js";
import type {
  RepairTransformHintRealization,
} from "./script-transform-hint-realizer.js";
import type {
  RepairRealizerCoverageReport,
} from "./repair-realizer-execution.js";

export type RepairRealizationCoverageDisposition =
  | "realized"
  | "proposal-only"
  | "blocked"
  | "missing-realizer"
  | "no-applicable-source";

export interface RepairRealizationCoverageItem {
  sourceKind: string;
  sourceId: string;
  sourceVersion: string;
  disposition: RepairRealizationCoverageDisposition;
  strategyId?: string;
  transactionId?: string;
  reasons: readonly string[];
}

export interface RepairRealizationCoverageReport {
  incidentId: string;
  candidateId: string;
  items: readonly RepairRealizationCoverageItem[];
  realizedCount: number;
  proposalOnlyCount: number;
  blockedCount: number;
  missingRealizerCount: number;
  noImplementationCoverage: boolean;
}

export type RepairRealizationResult =
  | ProviderRepairRealization
  | RepairTransformHintRealization;

function realizationSourceId(
  realization: RepairRealizationResult,
): string {
  if (realization.status === "blocked") {
    return realization.sourceId;
  }
  return "providerId" in realization.proposal
    ? realization.proposal.providerId
    : realization.proposal.sourceId;
}

function realizedStrategy(
  realization: Extract<
    RepairRealizationResult,
    { status: "realized" }
  >,
) {
  return realization.proposal.strategy;
}

export function buildRepairRealizationCoverageReport(
  enumeration: RepairStrategyEnumeration,
  realizerCoverage: RepairRealizerCoverageReport,
  realizations: readonly RepairRealizationResult[],
): RepairRealizationCoverageReport {
  if (enumeration.applicableSources.length === 0) {
    return {
      incidentId: enumeration.envelope.incidentId,
      candidateId: enumeration.envelope.candidateId,
      items: [{
        sourceKind: "<none>",
        sourceId: "<none>",
        sourceVersion: "<none>",
        disposition: "no-applicable-source",
        reasons: [
          "No applicable repair strategy source was discovered for the proven causal candidate.",
        ],
      }],
      realizedCount: 0,
      proposalOnlyCount: 0,
      blockedCount: 0,
      missingRealizerCount: 0,
      noImplementationCoverage: true,
    };
  }

  // A realized proposal is valid only for the exact enumerated
  // source kind and version. An old provider/hint realization must not
  // be credited to a newer registry entry with the same source ID.
  const matchingRealization = (
    source: RepairStrategyEnumeration["applicableSources"][number],
  ): RepairRealizationResult | undefined =>
    [...realizations].reverse().find((item) => {
      if (realizationSourceId(item) !== source.sourceId) {
        return false;
      }
      if (item.status === "blocked") {
        // A blocked result can explain only the exact source that
        // produced it; unrelated or unversioned blocks cannot mask
        // a current realization with the same short ID.
        return item.sourceKind === source.sourceKind &&
          item.sourceVersion === source.sourceVersion;
      }
      return "providerId" in item.proposal
        ? source.sourceKind === "provider" &&
          item.proposal.providerVersion === source.sourceVersion
        : item.proposal.sourceKind === source.sourceKind &&
          item.proposal.sourceVersion === source.sourceVersion;
    });

  const items = enumeration.applicableSources.map(
    (source): RepairRealizationCoverageItem => {
      const realizerItem = realizerCoverage.items.find(
        (item) =>
          item.sourceKind === source.sourceKind &&
          item.sourceId === source.sourceId &&
          item.sourceVersion === source.sourceVersion,
      );

      if (
        realizerItem?.status ===
        "realizer-not-required"
      ) {
        return {
          sourceKind: source.sourceKind,

          sourceId: source.sourceId,
          sourceVersion: source.sourceVersion,
          disposition: "proposal-only",
          reasons: realizerItem.reasons,
        };
      }

      if (
        !realizerItem ||
        realizerItem.status === "missing-realizer"
      ) {
        return {
          sourceKind: source.sourceKind,

          sourceId: source.sourceId,
          sourceVersion: source.sourceVersion,
          disposition: "missing-realizer",
          reasons:
            realizerItem?.reasons ?? [
              "Applicable source has no realizer coverage record.",
            ],
        };
      }

      const realization =
        matchingRealization(source);
      if (!realization) {
        return {
          sourceKind: source.sourceKind,

          sourceId: source.sourceId,
          sourceVersion: source.sourceVersion,
          disposition: "blocked",
          reasons: [
            "Applicable source has a realizer but no realization result was produced.",
          ],
        };
      }

      if (realization.status === "blocked") {
        return {
          sourceKind: source.sourceKind,

          sourceId: source.sourceId,
          sourceVersion: source.sourceVersion,
          disposition: "blocked",
          reasons: realization.reasons,
        };
      }

      const strategy =
        realizedStrategy(realization);
      return {
        sourceKind: source.sourceKind,

        sourceId: source.sourceId,
        sourceVersion: source.sourceVersion,
        disposition: "realized",
        strategyId: strategy.strategyId,
        transactionId: strategy.transaction.id,
        reasons: realization.reasons,
      };
    },
  ).sort((a, b) =>
    a.sourceKind.localeCompare(b.sourceKind) ||
    a.sourceId.localeCompare(b.sourceId) ||
    a.sourceVersion.localeCompare(b.sourceVersion)
  );

  const realizedCount = items.filter(
    (item) => item.disposition === "realized",
  ).length;
  const proposalOnlyCount = items.filter(
    (item) =>
      item.disposition === "proposal-only",
  ).length;
  const blockedCount = items.filter(
    (item) => item.disposition === "blocked",
  ).length;
  const missingRealizerCount = items.filter(
    (item) =>
      item.disposition === "missing-realizer",
  ).length;

  return {
    incidentId: enumeration.envelope.incidentId,
    candidateId: enumeration.envelope.candidateId,
    items,
    realizedCount,
    proposalOnlyCount,
    blockedCount,
    missingRealizerCount,
    noImplementationCoverage:
      realizedCount === 0,
  };
}
