import type { AuthoredBranchGuard, SemanticIr, StateOperationKind } from "./types.js";

/**
 * A single lexically authored condition at one exact source range.
 * Arms are source-observed alternatives, NOT exhaustive executable paths.
 */
export interface ObservedBranchPoint {
  readonly expression: string;
  readonly source: AuthoredBranchGuard["source"];
  readonly branches: readonly {
    readonly branch: "true" | "false";
    readonly executionEdgeIds: readonly string[];
    readonly stateWriteOperationIds: readonly string[];
    readonly returnOutcomeIds: readonly string[];
    /** Possible resource acquire/release sites within this authored arm. */
    readonly resourceActionIds: readonly string[];
    readonly resourceReleaseActionIds: readonly string[];
    readonly worldEffectIds?: readonly string[];
    /** Evidence dependent on the opposite arm of a prior direct exit. */
    readonly precedenceEvidenceIds: readonly string[];
  }[];
}

export interface ObservedExecutionTrace {
  /** Authored entry candidate, NOT proof that gameplay actually executed. */
  readonly entryRegionId: string;
  readonly entryKind: SemanticIr["execution"]["regions"][number]["kind"];
  readonly regionIds: readonly string[];
  readonly executionEdgeIds: readonly string[];
  readonly unresolvedExecutionEdgeIds: readonly string[];
  /** Potentially conditional or deferred local calls, not guaranteed traversal. */
  readonly conditionalExecutionEdgeIds: readonly string[];
  readonly temporalRelationIds: readonly string[];
  readonly stateOperationIds: readonly string[];
  /** Exact state writes on this potential path, not runtime mutation proof. */
  readonly stateWriteOperationIds: readonly string[];
  /** Authored object returns, not game terminal proof. */
  readonly returnOutcomeIds: readonly string[];
  /** Source-observed world-effect attempts, not engine execution proof. */
  readonly worldEffectIds?: readonly string[];
  /** Potential resource effects, not verified cleanup. */
  readonly resourceActionIds: readonly string[];
  readonly resourceReleaseActionIds: readonly string[];
  /** Only lexical guard evidence, not complete path predicates. */
  readonly guardedExecutionEdges: readonly { edgeId: string; guards: readonly AuthoredBranchGuard[] }[];
  readonly guardedStateWrites: readonly { operationId: string; guards: readonly AuthoredBranchGuard[] }[];
  readonly guardedReturnOutcomes: readonly { outcomeId: string; guards: readonly AuthoredBranchGuard[] }[];
  readonly guardedResourceActions: readonly { actionId: string; guards: readonly AuthoredBranchGuard[] }[];
  /** Preceding source-time return/throw constraints; not evaluated current state. */
  readonly precedenceGuardedExecutionEdges: readonly { edgeId: string; guards: readonly AuthoredBranchGuard[] }[];
  readonly precedenceGuardedStateWrites: readonly { operationId: string; guards: readonly AuthoredBranchGuard[] }[];
  readonly precedenceGuardedReturnOutcomes: readonly { outcomeId: string; guards: readonly AuthoredBranchGuard[] }[];
  readonly precedenceGuardedResourceActions: readonly { actionId: string; guards: readonly AuthoredBranchGuard[] }[];
  /** Correlation by the exact authored guard site, never by matching words. */
  readonly branchPoints: readonly ObservedBranchPoint[];
}

/**
 * Traverse exact, resolved IR edges from authored event sources, modules,
 * unreferenced mcfunctions, and command-bearing dialogue/BP animation sites.
 * Those authored command sites are activation-UNKNOWN roots; a resolved
 * function reference does NOT establish that the button was clicked, the
 * animation played, or the command succeeded. Unresolved targets are never
 * traversed and unreachable callbacks remain outside traces.
 */
export function semanticIrExecutionTraces(ir: SemanticIr): {
  readonly traces: readonly ObservedExecutionTrace[];
  readonly regionsOutsideTraces: readonly string[];
} {
  const sorted = (items: Iterable<string>) =>
    [...new Set(items)].sort();
  const regions = new Map(ir.execution.regions.map(r => [r.id, r]));
  const outgoing = new Map<string, typeof ir.execution.edges[number][]>();
  for (const edge of ir.execution.edges) {
    const list = outgoing.get(edge.from) ?? [];
    list.push(edge);
    outgoing.set(edge.from, list);
  }
  const operations = new Map<string, typeof ir.state.operations[number][]>();
  for (const operation of ir.state.operations) {
    const list = operations.get(operation.executionRegionId) ?? [];
    list.push(operation);
    operations.set(operation.executionRegionId, list);
  }
  const observedOutcomes = new Map<string, NonNullable<typeof ir.execution.outcomes>[number][]>();
  for (const outcome of ir.execution.outcomes ?? []) {
    const items = observedOutcomes.get(outcome.executionRegionId) ?? [];
    items.push(outcome);
    observedOutcomes.set(outcome.executionRegionId, items);
  }
  const worldEffects = new Map<string, NonNullable<typeof ir.execution.worldEffects>[number][]>();
  for (const effect of ir.execution.worldEffects ?? []) {
    const bucket = worldEffects.get(effect.executionRegionId) ?? [];
    bucket.push(effect);
    worldEffects.set(effect.executionRegionId, bucket);
  }
  const observedActions = new Map<string, NonNullable<typeof ir.state.resourceActions>[number][]>();
  for (const action of ir.state.resourceActions ?? []) {
    const items = observedActions.get(action.executionRegionId) ?? [];
    items.push(action);
    observedActions.set(action.executionRegionId, items);
  }
  const temporal = new Map(ir.temporal.relations.map(item => [item.id, item]));
  const edgeById = new Map(ir.execution.edges.map(edge => [edge.id, edge]));
  const operationById = new Map(ir.state.operations.map(op => [op.id, op]));
  const outcomeById = new Map((ir.execution.outcomes ?? []).map(op => [op.id, op]));
  const actionById = new Map((ir.state.resourceActions ?? []).map(action => [action.id, action]));
  const worldEffectById = new Map((ir.execution.worldEffects ?? []).map(effect => [effect.id, effect]));
  const incoming = new Set(ir.execution.edges
    .filter(edge => edge.resolution === "resolved" && edge.to !== undefined)
    .map(edge => edge.to!));
  // A source module reached through a resolved import() is not an
  // independent source entry candidate. Its module body is traversed from
  // the importing region if that region is in a source-rooted trace.
  // Otherwise retain it in regionsOutsideTraces: the absent route is
  // unproven, not evidence that the module cannot be activated at runtime.
  //
  // Only an exact, resolved dynamic-import site qualifies: an unrelated
  // deferred callback or guessed matching module name must not suppress
  // a candidate root.
  const importedModules = new Set(ir.execution.edges
    .filter(edge => edge.kind === "deferred" &&
      edge.targetLabel.startsWith("import(") &&
      edge.resolution === "resolved" && edge.to !== undefined &&
      regions.get(edge.to)?.kind === "script-module")
    .map(edge => edge.to!));
  // Restrict ONLY when a selected attached manifest and its static imports
  // were fully resolved. A module merely present in the archive is not an
  // independently declared gameplay entrypoint. An unrooted event source
  // remains in regionsOutsideTraces rather than being promoted by its name.
  const manifestRoots = ir.execution.manifestScriptRoots;
  const declaredEntryPaths = new Set(manifestRoots?.entryPaths ?? []);
  const reachableScriptPaths = new Set(
    manifestRoots?.staticallyReachablePaths ?? []);
  const inventoriedScriptPaths = new Set([...regions.values()]
    .filter(region => region.kind === "script-module")
    .flatMap(region => region.source ? [region.source.relativePath] : []));
  const entryRegions = [...regions.values()].filter(region =>
    (region.kind === "event-source" &&
      (manifestRoots === undefined ||
        !region.source ||
        !inventoriedScriptPaths.has(region.source.relativePath) ||
        reachableScriptPaths.has(region.source.relativePath))) ||
    (region.kind === "script-module" && (
      manifestRoots === undefined
        ? !importedModules.has(region.id)
        : region.source !== undefined &&
          declaredEntryPaths.has(region.source.relativePath))) ||
    region.kind === "dialogue-command" ||
    region.kind === "behavior-animation" ||
    (region.kind === "mcfunction" && !incoming.has(region.id))
  ).sort((a, b) => a.id.localeCompare(b.id));
  const coveredRegions = new Set<string>();
  const traces: ObservedExecutionTrace[] = entryRegions.map(entry => {
    const visited = new Set<string>([entry.id]);
    const queued = [entry.id];
    const edges = new Set<string>();
    const unresolved = new Set<string>();
    const conditional = new Set<string>();
    const times = new Set<string>();
    const state = new Set<string>();
    const writes = new Set<string>();
    const returnOutcomes = new Set<string>();
    const worldEffectIds = new Set<string>();
    const resourceActions = new Set<string>();
    const resourceReleases = new Set<string>();
    for (let index = 0; index < queued.length; index += 1) {
      const regionId = queued[index]!;
      coveredRegions.add(regionId);
      for (const op of operations.get(regionId) ?? []) {
        state.add(op.id);
        if (op.operation === "write") writes.add(op.id);
      }
      for (const outcome of observedOutcomes.get(regionId) ?? []) {
        returnOutcomes.add(outcome.id);
      }
      for (const effect of worldEffects.get(regionId) ?? []) {
        worldEffectIds.add(effect.id);
      }
      for (const action of observedActions.get(regionId) ?? []) {
        resourceActions.add(action.id);
        if (action.action === "release") resourceReleases.add(action.id);
      }
      for (const edge of outgoing.get(regionId) ?? []) {
        edges.add(edge.id);
        if (edge.resolution !== "resolved") unresolved.add(edge.id);
        if (edge.controlFlow === "conditional" || edge.controlFlow === "deferred") {
          conditional.add(edge.id);
        }
        const relation = temporal.get("time:" + edge.id);
        if (relation && relation.from === edge.from &&
          relation.to === edge.to && relation.targetLabel === edge.targetLabel) {
          times.add(relation.id);
        }
        if (edge.resolution === "resolved" && edge.to &&
            regions.has(edge.to) && !visited.has(edge.to)) {
          visited.add(edge.to);
          queued.push(edge.to);
        }
      }
    }
    // Build lexical branch associations from the exact same guard site.
    // Different function regions or different source ranges cannot coalesce
    // merely because their guard expression text happens to match.
    type BranchArm = {
      executionEdgeIds: Set<string>;
      stateWriteOperationIds: Set<string>;
      returnOutcomeIds: Set<string>;
      resourceActionIds: Set<string>;
      resourceReleaseActionIds: Set<string>;
      worldEffectIds: Set<string>;
      precedenceEvidenceIds: Set<string>;
    };
    const arm = (): BranchArm => ({
      executionEdgeIds: new Set(),
      stateWriteOperationIds: new Set(),
      returnOutcomeIds: new Set(),
      resourceActionIds: new Set(),
      resourceReleaseActionIds: new Set(),
      worldEffectIds: new Set(),
      precedenceEvidenceIds: new Set(),
    });
    const points = new Map<string, {
      expression: string;
      source: AuthoredBranchGuard["source"];
      true: BranchArm;
      false: BranchArm;
    }>();
    const include = (
      guards: readonly AuthoredBranchGuard[] | undefined,
      id: string,
      kind: "executionEdgeIds" | "stateWriteOperationIds" | "returnOutcomeIds" |
        "resourceActionIds" | "resourceReleaseActionIds" | "worldEffectIds",
      precedingExit = false,
    ): void => {
      for (const guard of guards ?? []) {
        const range = guard.source.range;
        // No line/column means no unique branch-point identity. Keep the
        // individual guard evidence, but refuse to merge unrelated branches.
        if (range?.lineStart === undefined ||
            range.columnStart === undefined ||
            range.lineEnd === undefined ||
            range.columnEnd === undefined) continue;
        const key = JSON.stringify([
          guard.source.artifactId, guard.source.relativePath,
          guard.source.jsonPointer ?? null,
          range.lineStart, range.columnStart,
          range.lineEnd, range.columnEnd, guard.expression,
        ]);
        let point = points.get(key);
        if (!point) {
          point = {
            expression: guard.expression, source: guard.source,
            true: arm(), false: arm(),
          };
          points.set(key, point);
        }
        point[guard.branch][kind].add(id);
        if (precedingExit) point[guard.branch].precedenceEvidenceIds.add(id);
      }
    };
    for (const id of sorted(edges)) {
      include(edgeById.get(id)?.lexicalGuards, id, "executionEdgeIds");
      include(edgeById.get(id)?.precedenceGuards, id, "executionEdgeIds", true);
    }
    for (const id of sorted(writes)) {
      include(operationById.get(id)?.lexicalGuards, id, "stateWriteOperationIds");
      include(operationById.get(id)?.precedenceGuards, id, "stateWriteOperationIds", true);
    }
    for (const id of sorted(returnOutcomes)) {
      include(outcomeById.get(id)?.lexicalGuards, id, "returnOutcomeIds");
      include(outcomeById.get(id)?.precedenceGuards, id, "returnOutcomeIds", true);
    }
    for (const id of sorted(worldEffectIds)) {
      const effect = worldEffectById.get(id);
      include(effect?.lexicalGuards, id, "worldEffectIds");
      include(effect?.precedenceGuards, id, "worldEffectIds", true);
    }
    for (const id of sorted(resourceActions)) {
      const action = actionById.get(id);
      include(action?.lexicalGuards, id, "resourceActionIds");
      include(action?.precedenceGuards, id, "resourceActionIds", true);
      if (action?.action === "release") {
        include(action.lexicalGuards, id, "resourceReleaseActionIds");
        include(action.precedenceGuards, id, "resourceReleaseActionIds", true);
      }
    }
    const branchPoints: ObservedBranchPoint[] = [...points]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, point]) => ({
        expression: point.expression,
        source: point.source,
        branches: (["true", "false"] as const)
          .filter(branch => {
            const value = point[branch];
            return value.executionEdgeIds.size > 0 ||
              value.stateWriteOperationIds.size > 0 ||
              value.returnOutcomeIds.size > 0 ||
              value.resourceActionIds.size > 0 ||
              value.worldEffectIds.size > 0;
          })
          .map(branch => ({
            branch,
            executionEdgeIds: sorted(point[branch].executionEdgeIds),
            stateWriteOperationIds: sorted(point[branch].stateWriteOperationIds),
            returnOutcomeIds: sorted(point[branch].returnOutcomeIds),
            resourceActionIds: sorted(point[branch].resourceActionIds),
            worldEffectIds: sorted(point[branch].worldEffectIds),
            resourceReleaseActionIds: sorted(point[branch].resourceReleaseActionIds),
            precedenceEvidenceIds: sorted(point[branch].precedenceEvidenceIds),
          })),
      }));
    return {
      entryRegionId: entry.id,
      entryKind: entry.kind,
      regionIds: sorted(visited),
      executionEdgeIds: sorted(edges),
      unresolvedExecutionEdgeIds: sorted(unresolved),
      conditionalExecutionEdgeIds: sorted(conditional),
      temporalRelationIds: sorted(times),
      stateOperationIds: sorted(state),
      stateWriteOperationIds: sorted(writes),
      returnOutcomeIds: sorted(returnOutcomes),
      worldEffectIds: sorted(worldEffectIds),
      resourceActionIds: sorted(resourceActions),
      resourceReleaseActionIds: sorted(resourceReleases),
      guardedExecutionEdges: sorted(edges).flatMap(id => {
        const guards = edgeById.get(id)?.lexicalGuards;
        return guards?.length ? [{ edgeId: id, guards }] : [];
      }),
      guardedStateWrites: sorted(writes).flatMap(id => {
        const guards = operationById.get(id)?.lexicalGuards;
        return guards?.length ? [{ operationId: id, guards }] : [];
      }),
      guardedReturnOutcomes: sorted(returnOutcomes).flatMap(id => {
        const guards = outcomeById.get(id)?.lexicalGuards;
        return guards?.length ? [{ outcomeId: id, guards }] : [];
      }),
      guardedResourceActions: sorted(resourceActions).flatMap(id => {
        const guards = actionById.get(id)?.lexicalGuards;
        return guards?.length ? [{ actionId: id, guards }] : [];
      }),
      precedenceGuardedExecutionEdges: sorted(edges).flatMap(id => {
        const guards = edgeById.get(id)?.precedenceGuards;
        return guards?.length ? [{ edgeId: id, guards }] : [];
      }),
      precedenceGuardedStateWrites: sorted(writes).flatMap(id => {
        const guards = operationById.get(id)?.precedenceGuards;
        return guards?.length ? [{ operationId: id, guards }] : [];
      }),
      precedenceGuardedReturnOutcomes: sorted(returnOutcomes).flatMap(id => {
        const guards = outcomeById.get(id)?.precedenceGuards;
        return guards?.length ? [{ outcomeId: id, guards }] : [];
      }),
      precedenceGuardedResourceActions: sorted(resourceActions).flatMap(id => {
        const guards = actionById.get(id)?.precedenceGuards;
        return guards?.length ? [{ actionId: id, guards }] : [];
      }),
      branchPoints,
    };
  });
  return {
    traces,
    regionsOutsideTraces: sorted([...regions.keys()]
      .filter(id => !coveredRegions.has(id))),
  };
}


export function semanticIrSummary(ir: SemanticIr) {
  const byOperation = (operation: StateOperationKind) =>
    ir.state.operations.filter((item) => item.operation === operation).length;

  return {
    executionRegions: ir.execution.regions.length,
    executionEdges: ir.execution.edges.length,
    unresolvedExecutionTargets: ir.execution.edges.filter(
      (item) => item.resolution === "unresolved",
    ).length,
    eventDispatches: ir.execution.edges.filter(
      (item) => item.kind === "event-dispatch",
    ).length,
    deferredEdges: ir.execution.edges.filter(
      (item) => item.kind === "deferred" || item.kind === "periodic",
    ).length,
    stateSurfaces: ir.state.surfaces.length,
    stateOperations: ir.state.operations.length,
    authoredReturnOutcomes: ir.execution.outcomes?.length ?? 0,
    authoredWorldEffects: ir.execution.worldEffects?.length ?? 0,
    authoredResourceActions: ir.state.resourceActions?.length ?? 0,
    authoredResourceReleases: (ir.state.resourceActions ?? []).filter(
      action => action.action === "release").length,
    stateReads: byOperation("read"),
    stateWrites: byOperation("write"),
    stateDeletes: byOperation("delete") + byOperation("clear"),
    authorityContracts: ir.state.authorityBindings.length,
    temporalRelations: ir.temporal.relations.length,
    guardedDeferredRelations: ir.temporal.relations.filter(
      (item) =>
        (item.kind === "deferred" || item.kind === "periodic") &&
        item.guardEvidence === "explicit-generation-check",
    ).length,
    unguardedDeferredRelations: ir.temporal.relations.filter(
      (item) =>
        (item.kind === "deferred" || item.kind === "periodic") &&
        item.guardEvidence !== "explicit-generation-check",
    ).length,
  };
}
