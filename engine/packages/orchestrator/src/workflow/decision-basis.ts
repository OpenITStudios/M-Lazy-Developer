import { createHash } from "node:crypto";
import type { SemanticGraph } from "../../../graph/src/index.js";
import type { KnowledgeCatalog } from "../../../knowledge/src/index.js";
import type { SemanticIr } from "../../../semantic-ir/src/index.js";
import type {
  RepairPreservationBaseline,
  RepairPreservationContract,
} from "../../../preservation/src/index.js";
import type {
  InvariantRegistrySnapshot,
} from "../../../project-model/src/index.js";
import type {
  DecisionBasisRevision,
} from "../../../project-model/src/index.js";
import {
  CONTRACT_REGISTRY_REVISION,
} from "../../../project-model/src/index.js";
import type {
  RuntimeProbeBinding,
} from "../../../project-model/src/index.js";
import {
  runtimeScopeKey,
  type RuntimeEvidenceRecord,
} from "../../../project-model/src/index.js";
import type {
  RuntimeEvidenceIntegrityReport,
} from "../../../project-model/src/index.js";
import type { InspectTargetProfile } from "../core/types.js";
import {
  repairRealizerRegistryRevision,
  type RepairRealizerRegistry,
} from "../repair/repair-realizer-registry.js";
import {
  repairStrategySourceRegistryRevision,
  type RepairStrategySourceRegistry,
} from "../repair/repair-strategy-source-registry.js";
import { semanticGraphFingerprint } from "./semantic-graph-fingerprint.js";

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonical);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, canonical(child)]),
    );
  }
  return value;
}

function fingerprint(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
}

function normalizedRuntimeEvidence(
  records: readonly RuntimeEvidenceRecord[],
): unknown[] {
  return [...records]
    .map((record) => ({
      predicate: record.predicate,
      state: record.state,
      confidence: record.confidence,
      origin: record.origin ?? null,
      provenanceKey: record.provenanceKey ?? null,
      targetProfileFingerprint: record.targetProfileFingerprint ?? null,
      scopeKey: runtimeScopeKey(record.scope),
      observedAt: record.observedAt ?? null,
      sourceRefs: [...(record.sourceRefs ?? [])]
        .map((source) => ({
          artifactId: source.artifactId,
          relativePath: source.relativePath,
          range: source.range ?? null,
          jsonPointer: source.jsonPointer ?? null,
        }))
        .sort((a, b) =>
          a.artifactId.localeCompare(b.artifactId) ||
          a.relativePath.localeCompare(b.relativePath) ||
          JSON.stringify(a.range).localeCompare(JSON.stringify(b.range)) ||
          String(a.jsonPointer).localeCompare(String(b.jsonPointer))
        ),
      relatedNodeIds: [...(record.relatedNodeIds ?? [])].sort(),
    }))
    .sort((a, b) =>
      a.scopeKey.localeCompare(b.scopeKey) ||
      a.predicate.localeCompare(b.predicate) ||
      a.state.localeCompare(b.state) ||
      a.confidence.localeCompare(b.confidence) ||
      JSON.stringify(a.observedAt).localeCompare(
        JSON.stringify(b.observedAt),
      )
    );
}

function normalizedEvidenceIntegrity(
  integrity: Readonly<Record<string, RuntimeEvidenceIntegrityReport>>,
): unknown {
  return Object.fromEntries(
    Object.entries(integrity)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([channel, report]) => [
        channel,
        {
          records: report.records,
          observedRecords: report.observedRecords,
          derivedRecords: report.derivedRecords,
          unknownConfidenceRecords: report.unknownConfidenceRecords,
          unlocatedObservedRecords: report.unlocatedObservedRecords,
          unresolvedConflictPredicates: [
            ...report.unresolvedConflictPredicates,
          ].sort(),
          resolvedConflictCount: report.resolvedConflictCount,
          continuityComplete: report.continuityComplete,
          telemetryContinuityComplete:
            report.telemetryContinuityComplete,
          safeForCurrentStateClaims:
            report.safeForCurrentStateClaims,
          safeForTemporalViolationClaims:
            report.safeForTemporalViolationClaims,
          minimumObservedRecords: report.minimumObservedRecords ?? null,
          targetProfileEvidenceComplete:
            report.targetProfileEvidenceComplete ?? null,
          targetProfileMismatchRecords:
            report.targetProfileMismatchRecords ?? null,
          targetProfileUnboundRecords:
            report.targetProfileUnboundRecords ?? null,
        },
      ]),
  );
}

export interface DecisionBasisInput {
  sourceFingerprint?: string;
  graph?: SemanticGraph;
  semanticIr?: SemanticIr;
  preservationContract?: RepairPreservationContract;
  preservationBaseline?: RepairPreservationBaseline;
  knowledge?: KnowledgeCatalog;
  invariantRegistry?: InvariantRegistrySnapshot;
  target?: InspectTargetProfile;
  probeBindings?: readonly RuntimeProbeBinding[];
  runtimeEvidence?: readonly RuntimeEvidenceRecord[];
  evidenceIntegrity?: Readonly<Record<string, RuntimeEvidenceIntegrityReport>>;
  repairRealizerRegistry?: RepairRealizerRegistry;
  repairStrategySourceRegistry?: RepairStrategySourceRegistry;
  postTransformProofRevision?: string;
}

export function buildDecisionBasis(
  input: DecisionBasisInput,
): DecisionBasisRevision {
  return {
    contractRegistryRevision: CONTRACT_REGISTRY_REVISION,
    ...(input.sourceFingerprint === undefined
      ? {}
      : { sourceFingerprint: input.sourceFingerprint }),
    ...(input.graph === undefined
      ? {}
      : { graphFingerprint: semanticGraphFingerprint(input.graph) }),
    ...(input.semanticIr === undefined
      ? {}
      : { semanticIrRevision: fingerprint(input.semanticIr) }),
    ...(input.preservationContract === undefined
      ? {}
      : {
          preservationContractRevision:
            fingerprint(input.preservationContract),
        }),
    ...(input.preservationBaseline === undefined
      ? {}
      : {
          preservationBaselineRevision:
            fingerprint(input.preservationBaseline),
        }),
    ...(input.knowledge === undefined
      ? {}
      : { knowledgeRevision: fingerprint(input.knowledge) }),
    ...(input.invariantRegistry === undefined
      ? {}
      : {
          invariantRegistryRevision:
            input.invariantRegistry.revision,
        }),
    ...(input.target === undefined
      ? {}
      : { targetProfileFingerprint: fingerprint(input.target) }),
    ...(input.repairStrategySourceRegistry === undefined
      ? {}
      : {
          repairStrategySourceRegistryRevision:
            repairStrategySourceRegistryRevision(
              input.repairStrategySourceRegistry,
            ),
        }),
    ...(input.repairRealizerRegistry === undefined
      ? {}
      : {
          repairRealizerRegistryRevision:
            repairRealizerRegistryRevision(
              input.repairRealizerRegistry,
            ),
        }),
    ...(input.postTransformProofRevision === undefined
      ? {}
      : {
          postTransformProofRevision:
            input.postTransformProofRevision,
        }),
    ...(input.probeBindings === undefined
      ? {}
      : {
          probeBindingRevision: fingerprint(
            [...input.probeBindings].sort((a, b) =>
              a.probeId.localeCompare(b.probeId) ||
              a.predicate.localeCompare(b.predicate)
            ),
          ),
        }),
    ...(input.runtimeEvidence === undefined &&
      input.evidenceIntegrity === undefined
      ? {}
      : {
          runtimeEvidenceRevision: fingerprint({
            records: normalizedRuntimeEvidence(
              input.runtimeEvidence ?? [],
            ),
            integrity: input.evidenceIntegrity === undefined
              ? {}
              : normalizedEvidenceIntegrity(
                  input.evidenceIntegrity,
                ),
          }),
        }),
  };
}
