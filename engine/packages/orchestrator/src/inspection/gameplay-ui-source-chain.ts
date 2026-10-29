import type {
  GameplayIntentEvidence,
  GameplayIntentModel,
  GameplayUiSourceStepBinding,
} from "../../../gameplay-intent/src/index.js";
import type { SourceRef } from "../../../project-model/src/index.js";
import {
  sourceSiteStrictlyAfter,
  type AuthoredBranchGuard,
} from "../../../semantic-ir/src/index.js";
import type {
  AuthoredScriptApiCall,
  ObservedExecutionTrace,
  SemanticIr,
} from "../../../semantic-ir/src/index.js";

type Use = NonNullable<GameplayIntentEvidence["literalTranslationUse"]>;
type UiCall = NonNullable<Use["authoredUiSendCall"]>;
type Activation = NonNullable<UiCall["sourceActivation"]>;
type Path = Activation["sourcePaths"][number];

const MAX_ROOTS = 32;
const MAX_HOPS = 12;
const MAX_EXPLORED = 512;
const MAX_PATHS = 4;

/** Reuse canonical Semantic IR root eligibility. Bounded graph exploration
 * finds exact, contiguous source paths; it does not infer callback execution,
 * player identity, satisfied conditions, or successful client delivery.
 */
export function traceUiSourceActivation(
  ir: SemanticIr,
  traces: readonly ObservedExecutionTrace[],
  call: AuthoredScriptApiCall,
  artifactId: string,
): Activation {
  const unknown = (status: Activation["status"]): Activation => ({
    status,
    sourcePaths: [],
    unresolvedEntryCandidates: 0,
    proof: "SOURCE_ROOTED_IR_PATH_NOT_RUNTIME_EXECUTION",
  });
  if (ir.execution.manifestScriptRoots === undefined ||
      call.source.artifactId !== artifactId) {
    return unknown("MANIFEST_SOURCE_ROOTS_UNVERIFIED");
  }
  const regions = new Map(ir.execution.regions.map(region =>
    [region.id, region] as const));
  const entries = traces.filter(trace =>
    (trace.entryKind === "script-module" ||
      trace.entryKind === "event-source") &&
    trace.regionIds.includes(call.executionRegionId) &&
    regions.get(trace.entryRegionId)?.source?.artifactId === artifactId
  ).sort((a, b) => a.entryRegionId.localeCompare(b.entryRegionId));
  if (entries.length === 0) return unknown("NO_ADMITTED_SOURCE_ROOT_PATH");

  const byId = new Map(ir.execution.edges.map(edge => [edge.id, edge] as const));
  const results: Path[] = [];
  let bounded = entries.length > MAX_ROOTS;
  for (const trace of entries.slice(0, MAX_ROOTS)) {
    const scope = new Set(trace.regionIds);
    const byFrom = new Map<string, typeof ir.execution.edges[number][]>();
    for (const id of trace.executionEdgeIds) {
      const edge = byId.get(id);
      const range = edge?.source.range;
      if (!edge || edge.resolution !== "resolved" || !edge.to ||
          edge.source.artifactId !== artifactId ||
          range?.lineStart === undefined || range.lineEnd === undefined ||
          range.columnStart === undefined || range.columnEnd === undefined ||
          !scope.has(edge.from) || !scope.has(edge.to)) continue;
      const list = byFrom.get(edge.from) ?? [];
      list.push(edge);
      byFrom.set(edge.from, list);
    }
    for (const list of byFrom.values()) list.sort((a, b) =>
      a.to!.localeCompare(b.to!) || a.id.localeCompare(b.id));
    const queue: { id: string; edges: readonly string[] }[] = [
      { id: trace.entryRegionId, edges: [] },
    ];
    const visited = new Set<string>([trace.entryRegionId]);
    let result: Path | undefined;
    let cursor = 0;
    for (; cursor < queue.length && cursor < MAX_EXPLORED; cursor += 1) {
      const node = queue[cursor]!;
      if (node.id === call.executionRegionId) {
        const edgeGuards: Path["edgeGuards"][number][] = [];
        for (const id of node.edges) {
          const edge = byId.get(id);
          if (!edge) continue;
          for (const [kind, guards] of [
            ["lexical", edge.lexicalGuards ?? []],
            ["precedence", edge.precedenceGuards ?? []],
          ] as const) {
            for (const guard of guards) {
              const r = guard.source.range;
              if (guard.source.artifactId !== artifactId ||
                  r?.lineStart === undefined || r.lineEnd === undefined ||
                  r.columnStart === undefined || r.columnEnd === undefined) continue;
              edgeGuards.push({
                edgeId: id, kind,
                expression: guard.expression,
                branch: guard.branch,
                locator: guard.source.relativePath + ":" +
                  r.lineStart + ":" + r.columnStart,
              });
            }
          }
        }
        result = {
          entryRegionId: trace.entryRegionId,
          executionEdgeIds: node.edges,
          edgeGuards,
        };
        break;
      }
      if (node.edges.length >= MAX_HOPS) {
        if ((byFrom.get(node.id) ?? []).length > 0) bounded = true;
        continue;
      }
      for (const edge of byFrom.get(node.id) ?? []) {
        if (visited.has(edge.to!)) continue;
        visited.add(edge.to!);
        queue.push({ id: edge.to!, edges: [...node.edges, edge.id] });
      }
    }
    if (cursor < queue.length) bounded = true;
    if (result) results.push(result);
  }
  return {
    status: results.length > 0
      ? "SOURCE_ROOTED_PATH_CANDIDATE"
      : bounded ? "SOURCE_PATH_SEARCH_BOUNDED" :
        "NO_ADMITTED_SOURCE_ROOT_PATH",
    sourcePaths: results.slice(0, MAX_PATHS),
    unresolvedEntryCandidates: Math.max(0, entries.length -
      Math.min(results.length, MAX_PATHS)),
    proof: "SOURCE_ROOTED_IR_PATH_NOT_RUNTIME_EXECUTION",
  };
}


/**
 * Attach only positive, uniquely owned source-step identities to UI source
 * candidates. No edges, invariants or design approval are authored here.
 * A common execution region is insufficient: the relevant Intent subject
 * must own the EXACT Semantic IR operation ID, with a uniquely located
 * source site, compatible exact guard branches and non-overlapping order.
 */
export function correlateUiSourceGameplaySteps(
  model: GameplayIntentModel,
  ir: SemanticIr,
): GameplayIntentModel {
  if (!model.artifactId?.trim()) return model;
  const artifactId = model.artifactId;
  type Binding = GameplayUiSourceStepBinding;
  type Step = {
    readonly id: string;
    readonly kind: Binding["sourceStepKind"];
    readonly regionId: string;
    readonly source: SourceRef;
    readonly lexicalGuards?: readonly AuthoredBranchGuard[];
    readonly precedenceGuards?: readonly AuthoredBranchGuard[];
  };

  const siteLocator = (source: SourceRef): string | undefined => {
    const range = source.range;
    return source.artifactId === artifactId &&
      source.relativePath.trim() &&
      range?.lineStart !== undefined && range.columnStart !== undefined &&
      range.lineEnd !== undefined && range.columnEnd !== undefined
      ? source.relativePath + ":" + range.lineStart + ":" + range.columnStart
      : undefined;
  };
  const siteIdentity = (guard: AuthoredBranchGuard): string | undefined => {
    const range = guard.source.range;
    return siteLocator(guard.source) !== undefined && range !== undefined
      ? JSON.stringify([
        guard.source.artifactId, guard.source.relativePath,
        guard.source.jsonPointer ?? null, range.lineStart, range.columnStart,
        range.lineEnd, range.columnEnd, guard.expression,
      ]) : undefined;
  };
  const guards = (step: Pick<Step, "lexicalGuards" | "precedenceGuards">) =>
    [
      ...(step.lexicalGuards ?? []).map(guard =>
        ({ kind: "lexical" as const, guard })),
      ...(step.precedenceGuards ?? []).map(guard =>
        ({ kind: "precedence" as const, guard })),
    ];
  const oppositeArms = (
    call: AuthoredScriptApiCall,
    step: Step,
  ): boolean => {
    const arms = new Map<string, "true" | "false">();
    for (const { guard } of guards(call)) {
      const key = siteIdentity(guard);
      if (!key) continue;
      if (arms.has(key) && arms.get(key) !== guard.branch) return true;
      arms.set(key, guard.branch);
    }
    const seenStep = new Map<string, "true" | "false">();
    for (const { guard } of guards(step)) {
      const key = siteIdentity(guard);
      if (!key) continue;
      if ((arms.has(key) && arms.get(key) !== guard.branch) ||
          (seenStep.has(key) && seenStep.get(key) !== guard.branch)) return true;
      seenStep.set(key, guard.branch);
    }
    return false;
  };
  const subjectCounts = new Map<string, number>();
  for (const node of model.nodes)
    subjectCounts.set(node.id, (subjectCounts.get(node.id) ?? 0) + 1);
  const ownersByStepId = new Map<string, GameplayIntentModel["nodes"][number][]>();
  for (const node of model.nodes) {
    if (subjectCounts.get(node.id) !== 1 || node.status === "hypothesis" ||
        !(["state", "phase", "objective", "outcome"] as readonly string[])
          .includes(node.kind)) continue;
    for (const id of new Set(node.evidenceIds)) {
      const records = ownersByStepId.get(id) ?? [];
      records.push(node);
      ownersByStepId.set(id, records);
    }
  }
  const selectedEvidence = new Map(model.evidence
    .filter(item => item.scope === "selected-artifact" &&
      item.origin === "source-code" &&
      item.locator.trim().length > 0)
    .map(item => [item.id, item] as const));

  const sourceSteps: Step[] = [
    ...ir.state.operations.filter(op =>
      op.operation === "write").map(op => ({
        id: op.id, kind: "state-write" as const,
        regionId: op.executionRegionId, source: op.source,
        lexicalGuards: op.lexicalGuards,
        precedenceGuards: op.precedenceGuards,
      })),
    ...(ir.execution.outcomes ?? []).map(outcome => ({
      id: outcome.id, kind: "return-outcome" as const,
      regionId: outcome.executionRegionId, source: outcome.source,
      lexicalGuards: outcome.lexicalGuards,
      precedenceGuards: outcome.precedenceGuards,
    })),
    ...(ir.execution.worldEffects ?? []).map(effect => ({
      id: effect.id, kind: "world-effect" as const,
      regionId: effect.executionRegionId, source: effect.source,
      lexicalGuards: effect.lexicalGuards,
      precedenceGuards: effect.precedenceGuards,
    })),
  ];
  // One canonical exact IR operation identity, never an ambiguous duplicate.
  const stepCounts = new Map<string, number>();
  for (const step of sourceSteps)
    stepCounts.set(step.id, (stepCounts.get(step.id) ?? 0) + 1);
  const byRegion = new Map<string, Step[]>();
  for (const step of sourceSteps) {
    const locator = siteLocator(step.source);
    if (!locator || stepCounts.get(step.id) !== 1 ||
        selectedEvidence.get(step.id)?.locator !== locator ||
        !ownersByStepId.has(step.id)) continue;
    const list = byRegion.get(step.regionId) ?? [];
    list.push(step);
    byRegion.set(step.regionId, list);
  }
  for (const list of byRegion.values()) list.sort((a, b) =>
    a.id.localeCompare(b.id));

  const apiById = new Map(ir.execution.apiCalls?.map(call =>
    [call.id, call] as const) ?? []);
  const MAX_STEP_BINDINGS = 24;
  let didChange = false;
  const evidence = model.evidence.map(item => {
    const use = item.literalTranslationUse;
    const originalCall = use?.authoredUiSendCall;
    if (item.scope !== "selected-artifact" ||
        item.origin !== "source-code" ||
        originalCall === undefined || use?.executionRegionId === undefined)
      return item;
    const call = apiById.get(originalCall.apiCallEvidenceId);
    const actualCallRegion = originalCall.uiExecutionRegionId ??
      use.executionRegionId;
    if (!call || call.executionRegionId !== actualCallRegion ||
        call.source.artifactId !== artifactId ||
        siteLocator(call.source) !== originalCall.sourceLocator ||
        selectedEvidence.get(call.id)?.locator !== originalCall.sourceLocator)
      return item;
    const result: Binding[] = [];
    for (const step of byRegion.get(call.executionRegionId) ?? []) {
      if (oppositeArms(call, step)) continue;
      const stepBefore = sourceSiteStrictlyAfter(step.source, call.source);
      const uiBefore = sourceSiteStrictlyAfter(call.source, step.source);
      if (stepBefore === uiBefore) continue;
      // Once the same function returns, its later UI call cannot be reached
      // in the same synchronous flow; do not invent a continuation.
      if (step.kind === "return-outcome" && stepBefore) continue;
      for (const owner of ownersByStepId.get(step.id) ?? []) {
        const stepGuards = guards(step).flatMap(({ kind, guard }) => {
          const locator = siteLocator(guard.source);
          return locator === undefined ? [] : [{
            kind, expression: guard.expression,
            branch: guard.branch, locator,
          }];
        });
        result.push({
          subjectId: owner.id,
          subjectKind: owner.kind as Binding["subjectKind"],
          sourceStepEvidenceId: step.id,
          sourceStepKind: step.kind,
          sourceLocator: siteLocator(step.source)!,
          lexicalOrder: stepBefore
            ? "STEP_BEFORE_UI" : "UI_BEFORE_STEP",
          stepGuards,
          entryBasis: originalCall.sourceActivation?.status ===
            "SOURCE_ROOTED_PATH_CANDIDATE"
            ? "ROOTED_UI_REGION_CANDIDATE" : "LOCAL_UI_REGION_ONLY",
          proof: "EXACT_SELECTED_SOURCE_STEP_CONTEXT_NOT_GAMEPLAY_CAUSALITY",
        });
      }
    }
    result.sort((a, b) =>
      a.subjectId.localeCompare(b.subjectId) ||
      a.sourceStepEvidenceId.localeCompare(b.sourceStepEvidenceId) ||
      a.sourceStepKind.localeCompare(b.sourceStepKind));
    if (result.length === 0) return item;
    didChange = true;
    return {
      ...item,
      literalTranslationUse: {
        ...use,
        authoredUiSendCall: {
          ...originalCall,
          sourceGameplayStepBindings: result.slice(0, MAX_STEP_BINDINGS),
          omittedSourceGameplayStepBindings: Math.max(
            0, result.length - MAX_STEP_BINDINGS),
        },
      },
    };
  });
  return didChange ? { ...model, evidence } : model;
}
