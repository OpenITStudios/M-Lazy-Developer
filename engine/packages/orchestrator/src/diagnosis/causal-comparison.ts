import type { InspectDirectoryResult } from "../core/types.js";

export interface CausalComparisonSnapshot {
  chains: number;
  incidents: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
  projectedRisks: number;
  corroboratedRisks: number;
  observedOutcomes: number;
  rootCauseCandidates: number;
  candidateLabels: string[];
}

export interface CausalComparisonDelta {
  chains: number;
  incidents: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
  projectedRisks: number;
  corroboratedRisks: number;
  observedOutcomes: number;
  rootCauseCandidates: number;
  addedCandidateLabels: string[];
  removedCandidateLabels: string[];
}

export interface CausalComparison {
  before: CausalComparisonSnapshot;
  after: CausalComparisonSnapshot;
  delta: CausalComparisonDelta;
}

function candidateLabels(
  result: Pick<InspectDirectoryResult, "causalAnalysis">,
): string[] {
  return [...new Set(
    result.causalAnalysis.incidents.flatMap((incident) =>
      incident.rootCauseCandidates.map((candidate) => candidate.label)
    ),
  )].sort();
}

function snapshot(
  result: Pick<InspectDirectoryResult, "causalAnalysis">,
): CausalComparisonSnapshot {
  return {
    chains: result.causalAnalysis.chains.length,
    incidents: result.causalAnalysis.incidents.length,
    highConfidence: result.causalAnalysis.highConfidence,
    mediumConfidence: result.causalAnalysis.mediumConfidence,
    lowConfidence: result.causalAnalysis.lowConfidence,
    projectedRisks: result.causalAnalysis.projectedRisks,
    corroboratedRisks: result.causalAnalysis.corroboratedRisks,
    observedOutcomes: result.causalAnalysis.observedOutcomes,
    rootCauseCandidates: result.causalAnalysis.rootCauseCandidates,
    candidateLabels: candidateLabels(result),
  };
}

function difference(after: number, before: number): number {
  return after - before;
}

export function compareCausalAnalysis(
  beforeResult: Pick<InspectDirectoryResult, "causalAnalysis">,
  afterResult: Pick<InspectDirectoryResult, "causalAnalysis">,
): CausalComparison {
  const before = snapshot(beforeResult);
  const after = snapshot(afterResult);
  const beforeLabels = new Set(before.candidateLabels);
  const afterLabels = new Set(after.candidateLabels);

  return {
    before,
    after,
    delta: {
      chains: difference(after.chains, before.chains),
      incidents: difference(after.incidents, before.incidents),
      highConfidence: difference(
        after.highConfidence,
        before.highConfidence,
      ),
      mediumConfidence: difference(
        after.mediumConfidence,
        before.mediumConfidence,
      ),
      lowConfidence: difference(
        after.lowConfidence,
        before.lowConfidence,
      ),
      projectedRisks: difference(
        after.projectedRisks,
        before.projectedRisks,
      ),
      corroboratedRisks: difference(
        after.corroboratedRisks,
        before.corroboratedRisks,
      ),
      observedOutcomes: difference(
        after.observedOutcomes,
        before.observedOutcomes,
      ),
      rootCauseCandidates: difference(
        after.rootCauseCandidates,
        before.rootCauseCandidates,
      ),
      addedCandidateLabels: after.candidateLabels.filter(
        (label) => !beforeLabels.has(label),
      ),
      removedCandidateLabels: before.candidateLabels.filter(
        (label) => !afterLabels.has(label),
      ),
    },
  };
}
