import type { SemanticGraph } from "../../../graph/src/index.js";
import type {
  RepairableTopologyCandidate,
} from "../inspection/topology-analysis.js";
import {
  planLinearTopologyRepair,
} from "../../../repair/src/index.js";
import type {
  ProviderRepairRealization,
  RepairStrategyEnumeration,
} from "./repair-strategy-enumeration.js";
import type {
  RepairStrategyProviderRegistry,
} from "./repair-strategy-provider.js";
import type {
  RepairRealizerRegistry,
} from "./repair-realizer-registry.js";

export function realizeLinearTopologyRepairStrategy(
  enumeration: RepairStrategyEnumeration,
  graph: SemanticGraph,
  registry: RepairStrategyProviderRegistry,
  realizerRegistry: RepairRealizerRegistry,
  candidate: RepairableTopologyCandidate,
): ProviderRepairRealization {
  // The supplied registry, not a hard-coded version, owns provider provenance.
  const sourceVersion = registry.providers.find(
    (provider) => provider.id === "linear-topology-repair",
  )?.version ?? "unregistered";
  if (
    candidate.record.effect.kind !== "fill" &&
    candidate.record.effect.kind !== "setblock"
  ) {
    return {
      status: "blocked",
      sourceKind: "provider",
      sourceVersion,
      sourceId: "linear-topology-repair",
      reasons: [
        "Linear topology repair supports fill/setblock effects only.",
      ],
    };
  }

  const planned = planLinearTopologyRepair(
    {
      outlier: {
        axis: candidate.outlier.axis,
        expectedCoordinate:
          candidate.outlier.expectedCoordinate,
        actualCoordinate:
          candidate.outlier.actualCoordinate,
      },
      effect: candidate.record.effect,
      rawCommand: candidate.record.rawCommand,
    },
    enumeration.envelope.sourceFingerprint,
  );

  if (planned.status === "unsupported") {
    return {
      status: "blocked",
      sourceKind: "provider",
      sourceVersion,
      sourceId: "linear-topology-repair",
      reasons: [planned.reason],
    };
  }

  // The planner produces an authored-source proposal, not an authorized
  // PatchTransaction. Never turn a proposal into executable repair authority.
  return {
    status: "blocked",
    sourceKind: "provider",
    sourceVersion,
    sourceId: "linear-topology-repair",
    reasons: [
      "Topology replacement is proposal-only; an authorized PatchTransaction with current evidence and preservation validation is required before realization.",
    ],
  };
}
