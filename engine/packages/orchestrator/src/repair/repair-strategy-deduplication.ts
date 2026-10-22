import { createHash } from "node:crypto";
import type {
  RepairStrategyProviderProposal,
} from "./repair-strategy-provider.js";

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalJson).join(",") + "]";
  }
  if (
    value !== null &&
    typeof value === "object"
  ) {
    const record = value as Record<string, unknown>;
    return "{" +
      Object.keys(record)
        .sort()
        .map((key) =>
          JSON.stringify(key) +
          ":" +
          canonicalJson(record[key])
        )
        .join(",") +
      "}";
  }
  return JSON.stringify(value);
}

export function repairStrategySemanticFingerprint(
  proposal: RepairStrategyProviderProposal,
): string {
  const transaction = proposal.strategy.transaction;
  const normalized = {
    sourceFingerprint: transaction.sourceFingerprint,
    requiredProofs:
      [...(transaction.requiredProofs ?? [])].sort(),
    operations: transaction.operations
      .map((operation) => ({
        kind: operation.kind,
        source: operation.source,
        expected: operation.expected,
        replacement: operation.replacement,
      }))
      .sort((a, b) =>
        canonicalJson(a).localeCompare(canonicalJson(b))
      ),
    preconditions: transaction.preconditions
      .map((item) => ({ ...item }))
      .sort((a, b) =>
        canonicalJson(a).localeCompare(canonicalJson(b))
      ),
    validation: transaction.validation.map(
      (item) => ({ ...item }),
    ),
    changedNodeIds:
      [...proposal.strategy.changedNodeIds].sort(),
    supportingInvariantIds:
      [...proposal.strategy.supportingInvariantIds].sort(),
    addressesCandidateIds:
      [...proposal.strategy.addressesCandidateIds].sort(),
    repairClass:
      proposal.strategy.repairClass ?? "unspecified",
    causalBinding: proposal.strategy.causalBinding ?? {},
    validationObligations:
      proposal.strategy.validationObligations ?? {},
    reversible:
      proposal.strategy.reversible ?? null,
    idempotent:
      proposal.strategy.idempotent ?? null,
  };

  return createHash("sha256")
    .update(canonicalJson(normalized))
    .digest("hex");
}

export interface RepairStrategyDeduplicationGroup {
  semanticFingerprint: string;
  representativeStrategyId: string;
  strategyIds: readonly string[];
  providers: readonly {
    providerId: string;
    providerVersion: string;
  }[];
}

export interface RepairStrategyDeduplicationResult {
  proposals: readonly RepairStrategyProviderProposal[];
  groups: readonly RepairStrategyDeduplicationGroup[];
  duplicateCount: number;
}

export function deduplicateRepairStrategyProposals(
  proposals: readonly RepairStrategyProviderProposal[],
): RepairStrategyDeduplicationResult {
  const grouped = new Map<
    string,
    RepairStrategyProviderProposal[]
  >();

  for (const proposal of proposals) {
    const fingerprint =
      repairStrategySemanticFingerprint(proposal);
    const list = grouped.get(fingerprint) ?? [];
    list.push(proposal);
    grouped.set(fingerprint, list);
  }

  const groups: RepairStrategyDeduplicationGroup[] = [];
  const unique: RepairStrategyProviderProposal[] = [];

  for (
    const [semanticFingerprint, members] of
      [...grouped.entries()].sort(([a], [b]) =>
        a.localeCompare(b)
      )
  ) {
    const sorted = [...members].sort((a, b) =>
      a.providerId.localeCompare(b.providerId) ||
      a.providerVersion.localeCompare(b.providerVersion) ||
      a.strategy.strategyId.localeCompare(
        b.strategy.strategyId,
      )
    );
    const representative = sorted[0]!;
    const providers = [
      ...new Map(
        sorted.map((item) => [
          item.providerId + "@" + item.providerVersion,
          {
            providerId: item.providerId,
            providerVersion: item.providerVersion,
          },
        ]),
      ).values(),
    ].sort((a, b) =>
      a.providerId.localeCompare(b.providerId) ||
      a.providerVersion.localeCompare(b.providerVersion)
    );

    unique.push({
      ...representative,
      ...(providers.length <= 1
        ? {}
        : {
            equivalentProviderProvenance:
              providers.filter(
                (provider) =>
                  provider.providerId !==
                    representative.providerId ||
                  provider.providerVersion !==
                    representative.providerVersion,
              ),
          }),
    });

    groups.push({
      semanticFingerprint,
      representativeStrategyId:
        representative.strategy.strategyId,
      strategyIds: sorted
        .map((item) => item.strategy.strategyId)
        .sort(),
      providers,
    });
  }

  return {
    proposals: unique.sort((a, b) =>
      a.strategy.strategyId.localeCompare(
        b.strategy.strategyId,
      )
    ),
    groups,
    duplicateCount:
      proposals.length - unique.length,
  };
}
