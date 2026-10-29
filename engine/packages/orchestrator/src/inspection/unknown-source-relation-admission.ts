import { deriveSourceEffectSlices } from "../../../behavior-model/src/index.js";
import {
  admitReviewedUnknownSourceRelations,
  type GameplayIntentModel,
} from "../../../gameplay-intent/src/index.js";
import {
  semanticIrExecutionTraces,
  type SemanticIr,
} from "../../../semantic-ir/src/index.js";
import type { SourceRef } from "../../../project-model/src/index.js";

/**
 * Resolve only typed SOURCE-SITE relationships already present in the
 * selected artifact's IR and Behavior Model. Neither static source order
 * nor a candidate ingress proves gameplay activation, outcome or a BUG.
 * Retain the original unknown and every independent design/proof obligation.
 */
export function admitDeterministicUnknownSourceRelations(
  model: GameplayIntentModel,
  ir: SemanticIr,
): GameplayIntentModel {
  const artifactId = model.artifactId;
  if (!artifactId || !model.unknowns.some(item =>
    item.sourceEntryRegionId && (item.evidenceIds?.length ?? 0) > 1)) {
    return model;
  }
  // IDs with multiple source owners have no usable identity.
  const siteSource = new Map<string, SourceRef | null>();
  for (const site of [
    ...ir.state.operations,
    ...(ir.state.resourceActions ?? []),
    ...(ir.execution.outcomes ?? []),
    ...(ir.execution.worldEffects ?? []),
  ]) {
    siteSource.set(site.id, siteSource.has(site.id) ? null : site.source);
  }
  const evidence = new Map(model.evidence.map(item => [item.id, item] as const));
  const selectedSite = (id: string): boolean => {
    const ref = siteSource.get(id);
    const record = evidence.get(id);
    if (!ref || ref.artifactId !== artifactId ||
        !ref.relativePath.trim() ||
        record?.origin !== "source-code" ||
        record.scope !== "selected-artifact") return false;
    const locator = ref.relativePath +
      (ref.range?.lineStart === undefined ? "" :
        ":" + ref.range.lineStart + ":" + (ref.range.columnStart ?? 1));
    return record.locator === locator;
  };
  const roots = new Map<string,
    ReturnType<typeof semanticIrExecutionTraces>["traces"][number][]>();
  for (const trace of semanticIrExecutionTraces(ir).traces) {
    const existing = roots.get(trace.entryRegionId) ?? [];
    existing.push(trace);
    roots.set(trace.entryRegionId, existing);
  }
  const effectsById = new Map<string,
    ReturnType<typeof deriveSourceEffectSlices>[number][]>();
  for (const slice of deriveSourceEffectSlices(ir)) {
    const existing = effectsById.get(slice.effectId) ?? [];
    existing.push(slice);
    effectsById.set(slice.effectId, existing);
  }

  const proposals: Parameters<typeof admitReviewedUnknownSourceRelations>[1][number][] = [];
  for (const unknown of model.unknowns) {
    if (!unknown.sourceEntryRegionId) continue;
    const owners = roots.get(unknown.sourceEntryRegionId) ?? [];
    if (owners.length !== 1) continue;
    const trace = owners[0]!;
    const traceIds = new Set([
      ...trace.stateOperationIds, ...trace.resourceActionIds,
      ...trace.returnOutcomeIds, ...(trace.worldEffectIds ?? []),
    ]);
    const owned = new Set((unknown.evidenceIds ?? []).filter(id =>
      traceIds.has(id) && selectedSite(id)));
    if (owned.size < 2) continue;

    const seen = new Set<string>();
    const add = (
      fromStepId: string,
      toStepId: string,
      sourceClaim:
        "SOURCE_GUARD_VALUE_HANDOFF_CANDIDATE" |
        "SOURCE_EFFECT_RETURN_CANDIDATE",
    ): void => {
      if (fromStepId === toStepId ||
          !owned.has(fromStepId) || !owned.has(toStepId)) return;
      const key = sourceClaim + "\u0000" + fromStepId + "\u0000" + toStepId;
      if (seen.has(key) || seen.size >= 24) return;
      seen.add(key);
      proposals.push({
        unknownId: unknown.id,
        fromStepId, toStepId, sourceClaim,
        sourceRelationEvidenceIds: [fromStepId, toStepId].sort(),
      });
    };
    for (const id of [...owned].sort()) {
      for (const slice of effectsById.get(id) ?? []) {
        if (slice.status !== "CANDIDATE_INGRESS" || slice.truncated ||
            !slice.candidateIngress.some(path =>
              path.entryRegionId === unknown.sourceEntryRegionId)) continue;
        for (const handoff of slice.sourceLocalStateValueHandoffs) {
          if (handoff.origin === "SOURCE_LOCAL" &&
              slice.guardStateReadIds.includes(handoff.guardReadOperationId)) {
            add(handoff.writeOperationId, slice.effectId,
              "SOURCE_GUARD_VALUE_HANDOFF_CANDIDATE");
          }
        }
        for (const outcomeId of slice.sourceOrderedOutcomeIds) {
          add(slice.effectId, outcomeId, "SOURCE_EFFECT_RETURN_CANDIDATE");
        }
      }
    }
  }
  // The ONE existing Gameplay Intent source owner checks all exact IDs,
  // unknown ownership and duplicate claims; it adds no gameplay edge.
  return proposals.length === 0
    ? model : admitReviewedUnknownSourceRelations(model, proposals);
}
