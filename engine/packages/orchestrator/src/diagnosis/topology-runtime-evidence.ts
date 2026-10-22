import type { RuntimeEvidenceRecord } from "../../../project-model/src/index.js";
import type { analyzeFunctionTopology } from "../inspection/topology-analysis.js";

type TopologyAnalysis = ReturnType<typeof analyzeFunctionTopology>;

function operationId(record: TopologyAnalysis["spatialRecords"][number]): string {
  const source = record.effect.source;
  return source.artifactId + ":" + source.relativePath + ":" + (source.range?.lineStart ?? 0);
}

export function topologyRuntimeEvidence(
  analysis: TopologyAnalysis,
): RuntimeEvidenceRecord[] {
  const records: RuntimeEvidenceRecord[] = [];

  for (const record of analysis.spatialRecords) {
    records.push({
      predicate: "resolved-spatial-effect",
      state: "present",
      confidence: "derived",
      scope: { operationId: operationId(record) },
      sourceRefs: [record.effect.source],
      note: record.resolved.kind,
    });
  }

  for (const outlier of analysis.linearOutliers) {
    const record = analysis.spatialRecords[outlier.effectIndex];
    if (!record) continue;
    records.push({
      predicate: "spatial-topology-outlier",
      state: "present",
      confidence: "derived",
      scope: { operationId: operationId(record) },
      sourceRefs: [record.effect.source],
    });
  }

  if (analysis.broadWrites > 0) {
    records.push({
      predicate: "broad-state-write",
      state: "present",
      confidence: "derived",
      note: String(analysis.broadWrites),
    });
  }

  if (analysis.candidates.length > 0) {
    records.push({
      predicate: "repeated-spatial-topology",
      state: "present",
      confidence: "derived",
      note: String(analysis.candidates.length),
    });
  }

  return records;
}