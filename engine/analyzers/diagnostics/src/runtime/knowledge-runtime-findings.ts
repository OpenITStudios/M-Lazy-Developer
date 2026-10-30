import { createHash } from "node:crypto";
import {
  assessKnowledgeRelations,
  type EffectiveKnowledgeProfile,
  type KnowledgeCatalog,
} from "../../../../packages/knowledge/src/index.js";
import {
  groupRuntimeEvidenceByScope,
  runtimeScopeContains,
  type RuntimeEvidenceRecord,
  type RuntimeScope,
  type RuntimeEvidenceSnapshot,
} from "../../../../packages/project-model/src/index.js";
import { mergeRuntimeEvidenceRecords } from "./runtime-evidence-merge.js";
import type { DiagnosticFinding } from "../../../../packages/diagnostics/src/index.js";

function sourceKey(source: {
  artifactId: string;
  relativePath: string;
  range?: {
    lineStart?: number;
    columnStart?: number;
  };
}): string {
  return [
    source.artifactId,
    source.relativePath,
    source.range?.lineStart ?? 0,
    source.range?.columnStart ?? 0,
  ].join(":");
}

function idFor(scopeKey: string, relationId: string, status: string): string {
  return "diag_" + createHash("sha256")
    .update(`knowledge:${scopeKey}:${relationId}:${status}`)
    .digest("hex")
    .slice(0, 16);
}

export interface KnowledgeRuntimeDiagnosticInput {
  catalog: KnowledgeCatalog;
  profile: EffectiveKnowledgeProfile;
  snapshot: RuntimeEvidenceSnapshot;
}

// This index is local to one immutable runtime-evidence snapshot. It only
// narrows candidates: runtimeScopeContains remains the semantic authority,
// including fields added to RuntimeScope after this indexed subset.
const INDEXED_SCOPE_FIELDS = [
  "arenaId", "arenaGeneration", "playerKey", "connectionGeneration",
  "lifeGeneration", "participationGeneration", "entityKey",
  "entityGeneration", "operationId", "subsystemGeneration",
  "bootGeneration",
] as const satisfies readonly (keyof RuntimeScope)[];

type RuntimeEvidenceScopeIndex = ReadonlyMap<
  keyof RuntimeScope,
  ReadonlyMap<string | number, readonly RuntimeEvidenceRecord[]>
>;

function indexRuntimeEvidenceByScopeFields(
  records: readonly RuntimeEvidenceRecord[],
): RuntimeEvidenceScopeIndex {
  const index = new Map<
    keyof RuntimeScope,
    Map<string | number, RuntimeEvidenceRecord[]>
  >();
  for (const record of records) {
    if (record.scope === undefined) continue;
    for (const field of INDEXED_SCOPE_FIELDS) {
      const value = record.scope[field];
      if (value === undefined) continue;
      let values = index.get(field);
      if (values === undefined) {
        values = new Map();
        index.set(field, values);
      }
      const bucket = values.get(value);
      if (bucket) bucket.push(record);
      else values.set(value, [record]);
    }
  }
  return index;
}

function causalEvidenceRecordsForScope(
  allRecords: readonly RuntimeEvidenceRecord[],
  scopedRecords: readonly RuntimeEvidenceRecord[],
  index: RuntimeEvidenceScopeIndex,
): readonly RuntimeEvidenceRecord[] {
  const baseScope = scopedRecords.find(
    (record) => record.scope !== undefined,
  )?.scope;
  if (!baseScope) return scopedRecords;

  // A record matching every scope dimension must match ANY indexed dimension.
  // Choose the smallest bucket and apply the original full matcher; bucket
  // insertion order is the original record order, preserving provenance.
  let candidates: readonly RuntimeEvidenceRecord[] | undefined;
  for (const field of INDEXED_SCOPE_FIELDS) {
    const expected = baseScope[field];
    if (expected === undefined) continue;
    const bucket = index.get(field)?.get(expected);
    if (bucket === undefined) return [];
    if (candidates === undefined || bucket.length < candidates.length) {
      candidates = bucket;
    }
  }
  // Empty-but-present scope matches every record WITH a scope. Retain the
  // original scan in that rare case instead of inventing global evidence.
  return (candidates ?? allRecords).filter((record) =>
    runtimeScopeContains(record.scope, baseScope)
  );
}

export function knowledgeRuntimeDiagnostics(
  input: KnowledgeRuntimeDiagnosticInput,
): DiagnosticFinding[] {
  const findings: DiagnosticFinding[] = [];
  const scopeIndex = indexRuntimeEvidenceByScopeFields(input.snapshot.records);

  for (const [scopeKey, records] of groupRuntimeEvidenceByScope(input.snapshot)) {
    const {
      map,
      conflicts,
      sourceRefs,
      relatedNodeIds,
    } = mergeRuntimeEvidenceRecords(records);
    const causalRecords = causalEvidenceRecordsForScope(
      input.snapshot.records,
      records,
      scopeIndex,
    );
    const presentPredicates = [...new Set(
      causalRecords
        .filter((record) => record.state === "present")
        .map((record) => record.predicate),
    )].sort();
    const runtimeScope = records.find(
      (record) => record.scope !== undefined,
    )?.scope;

    const predicateSourceKeys: Record<string, string[]> = {};
    const predicateObservations: Record<
      string,
      Array<{
        tick?: number;
        streamId?: string;
        sequence?: number;
        timestamp?: string;
        origin?: RuntimeEvidenceRecord["origin"];
      }>
    > = {};
    for (const record of causalRecords) {
      if (record.state !== "present") continue;
      if (record.observedAt || record.origin) {
        predicateObservations[record.predicate] = [
          ...(predicateObservations[record.predicate] ?? []),
          {
            ...(record.observedAt ?? {}),
            ...(record.origin === undefined
              ? {}
              : { origin: record.origin }),
          },
        ];
      }
      const keys = record.sourceRefs?.map(sourceKey) ?? [];
      if (keys.length === 0) continue;
      predicateSourceKeys[record.predicate] = [
        ...new Set([
          ...(predicateSourceKeys[record.predicate] ?? []),
          ...keys,
        ]),
      ].sort();
    }

    for (const predicate of conflicts) {
      findings.push({
        id: idFor(scopeKey, `evidence-conflict:${predicate}`, "unknown"),
        code: "KNOWLEDGE_EVIDENCE_GAP",
        severity: "info",
        message: `Conflicting runtime evidence prevents a reliable conclusion for ${predicate}.`,
        ...(sourceRefs[0] === undefined ? {} : { source: sourceRefs[0] }),
        ...(relatedNodeIds.length === 0 ? {} : { relatedNodeIds }),
        data: {
          scopeKey,
          ...(runtimeScope === undefined
            ? {}
            : { runtimeScope }),
          predicate,
          status: "unknown",
          evidenceConflict: true,
        },
      });
    }

    for (const assessment of assessKnowledgeRelations(
      input.catalog,
      input.profile,
      map,
    )) {
      if (assessment.status === "satisfied") continue;

      findings.push({
        id: idFor(scopeKey, assessment.relationId, assessment.status),
        code: assessment.status === "violation"
          ? "KNOWLEDGE_RELATION_VIOLATION"
          : "KNOWLEDGE_EVIDENCE_GAP",
        severity: assessment.status === "violation"
          ? (assessment.diagnosticSeverity ?? "medium")
          : "info",
        message: assessment.message,
        ...(sourceRefs[0] === undefined ? {} : { source: sourceRefs[0] }),
        ...(relatedNodeIds.length === 0 ? {} : { relatedNodeIds }),
        data: {
          scopeKey,
          ...(runtimeScope === undefined
            ? {}
            : { runtimeScope }),
          relationId: assessment.relationId,
          relationKind: assessment.kind,
          subject: assessment.subject,
          object: assessment.object,
          status: assessment.status,
          knowledgeSourceIds: assessment.knowledgeSourceIds,
          evidenceSourceIds: assessment.evidenceSourceIds,
          evidenceConflicts: conflicts,
          presentPredicates,
          ...(assessment.causalConsequences === undefined
            ? {}
            : { causalConsequences: assessment.causalConsequences }),
          ...(assessment.causalCorroborators === undefined
            ? {}
            : { causalCorroborators: assessment.causalCorroborators }),
          predicateSourceKeys,
          predicateObservations,
          ...(assessment.causalOutcomePredicates === undefined
            ? {}
            : { causalOutcomePredicates: assessment.causalOutcomePredicates }),
          ...(assessment.causalCorroborationMinSources === undefined
            ? {}
            : {
                causalCorroborationMinSources:
                  assessment.causalCorroborationMinSources,
              }),
        },
      });
    }
  }

  return findings.sort((a, b) =>
    a.code.localeCompare(b.code) ||
    a.id.localeCompare(b.id)
  );
}
