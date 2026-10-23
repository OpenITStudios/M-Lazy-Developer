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
  // A manifest-rooted script may contain an event subscribe() inside an
  // unused function. Merely loading that script does not make the callback
  // an independently authored event entry. Registration eligibility must
  // originate at the exact subscribe() execution region, reachable through
  // the SAME existing source call/dependency graph. No event is asserted to
  // have actually fired or even been registered at runtime.
  const manifestRoots = ir.execution.manifestScriptRoots;
  const declaredEntryPaths = new Set(manifestRoots?.entryPaths ?? []);
  const isTypedEventRoot = (
    region: SemanticIr["execution"]["regions"][number],
  ): boolean => region.kind === "event-source" &&
    (region.ownerId === "world" || region.ownerId === "system") &&
    (region.label.startsWith(region.ownerId + ".afterEvents.") ||
      region.label.startsWith(region.ownerId + ".beforeEvents."));
  const nonEventEntryRegions = [...regions.values()].filter(region =>
    (region.kind === "script-module" && (
      manifestRoots === undefined
        ? !importedModules.has(region.id)
        : region.source !== undefined &&
          declaredEntryPaths.has(region.source.relativePath))) ||
    region.kind === "dialogue-command" ||
    region.kind === "behavior-animation" ||
    (region.kind === "mcfunction" && !incoming.has(region.id))
  );
  const eligibleEvents = new Set<string>();
  // A custom Map-backed bus is not automatically activated because its
  // on()/emit() source sites match. Both the registration region and the
  // emitting source region must be reachable from the selected manifest/
  // eligible event roots. Without a manifest identity this stays UNKNOWN.
  const eligibleInternalDispatches = new Set<string>();
  if (manifestRoots === undefined) {
    // Unknown pack identity retains legacy source-only candidate coverage,
    // but a lookalike, non-Minecraft event emitter cannot create an event
    // entry just because it has an .afterEvents.x.subscribe spelling.
    for (const region of regions.values()) {
      if (isTypedEventRoot(region)) eligibleEvents.add(region.id);
    }
  } else {
    const subscriptionsByRegion = new Map<string, string[]>();
    for (const edge of ir.execution.edges) {
      const eventRegion = regions.get(edge.from);
      if (edge.kind !== "event-dispatch" ||
          edge.registrationRegionId === undefined ||
          !eventRegion || !isTypedEventRoot(eventRegion) ||
          !regions.has(edge.registrationRegionId)) continue;
      const source = regions.get(edge.registrationRegionId)?.source;
      if (source?.artifactId !== edge.source.artifactId ||
          source?.relativePath !== edge.source.relativePath) continue;
      const owned = subscriptionsByRegion.get(edge.registrationRegionId) ?? [];
      owned.push(edge.from);
      subscriptionsByRegion.set(edge.registrationRegionId, owned);
    }
    // One fixed-point walk from manifest/script and other existing source
    // roots. Nested event registration is eligible only when its containing
    // callback is itself reached through another eligible event source.
    const reachable = new Set(nonEventEntryRegions.map(region => region.id));
    const queued = [...reachable];
    const visit = (id: string): void => {
      if (reachable.has(id) || !regions.has(id)) return;
      reachable.add(id);
      queued.push(id);
    };
    let next = 0;
    const drainSourceRegions = (): void => {
      while (next < queued.length) {
        const id = queued[next++]!;
        for (const eventId of subscriptionsByRegion.get(id) ?? []) {
          eligibleEvents.add(eventId);
          visit(eventId);
        }
        for (const edge of outgoing.get(id) ?? []) {
          if (edge.kind === "internal-event-dispatch" ||
              edge.resolution !== "resolved" || !edge.to) continue;
          // Only a verified subscribe() site admits a Minecraft event root.
          if (regions.get(edge.to)?.kind === "event-source") continue;
          visit(edge.to);
        }
      }
    };
    drainSourceRegions();
    // Source-join the application event bus only after a matched on() site's
    // registration region and the matching emit() owner are BOTH in a
    // source-rooted closure. Re-drain callbacks because they may themselves
    // install Minecraft or nested custom handlers. This fixed point is
    // source eligibility only, never event delivery or observed game state.
    const internalRelays = ir.execution.edges.filter(edge =>
      edge.kind === "internal-event-dispatch" &&
      edge.resolution === "resolved" && edge.to !== undefined &&
      edge.internalSubscriptionRegionId !== undefined);
    let changed = true;
    while (changed) {
      changed = false;
      for (const edge of internalRelays) {
        if (eligibleInternalDispatches.has(edge.id) ||
            !reachable.has(edge.from) ||
            !reachable.has(edge.internalSubscriptionRegionId!)) continue;
        eligibleInternalDispatches.add(edge.id);
        visit(edge.to!);
        changed = true;
      }
      if (changed) drainSourceRegions();
    }
  }
  const entryRegions = [
    ...nonEventEntryRegions,
    ...[...regions.values()].filter(region =>
      isTypedEventRoot(region) && eligibleEvents.has(region.id)),
  ].sort((a, b) => a.id.localeCompare(b.id));
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
        if (edge.kind === "internal-event-dispatch" &&
            !eligibleInternalDispatches.has(edge.id)) {
          // Preserve the authored emitter witness, not a false downstream
          // callback/terminal link from an unreachable on() site.
          unresolved.add(edge.id);
          continue;
        }
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



/**
 * Compares a fully spanned authored write with a following source call.
 * TypeScript's source range is [start, end): a call nested inside the RHS is
 * AFTER the assignment start but BEFORE the assignment completed. Treating
 * that inner call as a continuation manufactures the wrong source ordering.
 *
 * Fail closed if either source lacks enough exact coordinates. This is
 * lexical source order within one file, NOT control-flow or runtime proof.
 */
export function sourceSiteStrictlyAfter(
  write: SemanticIr["state"]["operations"][number]["source"],
  call: SemanticIr["execution"]["edges"][number]["source"],
): boolean {
  if (write.artifactId !== call.artifactId ||
      write.relativePath !== call.relativePath ||
      write.range?.lineEnd === undefined ||
      write.range.columnEnd === undefined ||
      call.range?.lineStart === undefined ||
      call.range.columnStart === undefined) return false;
  return call.range.lineStart > write.range.lineEnd ||
    (call.range.lineStart === write.range.lineEnd &&
      call.range.columnStart >= write.range.columnEnd);
}

/** A directed source-only call chain from one exact authored write site.
 * Its terminal evidence is located IN the last callee region, not proof that
 * the write caused that call, that guards held, or that the callee ran.
 */
export interface SourceWriteContinuationPath {
  readonly regionIds: readonly string[];
  readonly executionEdgeIds: readonly string[];
  readonly temporalBoundaryEdgeIds: readonly string[];
  readonly directTargetEvidenceIds: readonly string[];
  readonly omittedDirectTargetEvidenceCount: number;
}

export interface SourceWriteContinuationResult {
  readonly paths: readonly SourceWriteContinuationPath[];
  readonly omittedPaths: number;
  readonly searchTruncated: boolean;
  /** Distinct authored event edges not eligible from a source-rooted
   * registration/emit trace; NEVER treated as delivered callbacks.
   */
  readonly blockedUnrootedEventEdges: number;
}

/**
 * Follow existing resolved Semantic IR edges AFTER an exact write site,
 * without searching by member/function names or constructing another graph.
 * Eligible event edges come from the already-computed source-root traces:
 * source similarity or an unregistered custom bus cannot open a callback.
 *
 * Every hop remains navigation only. In particular, a later lexical call
 * can belong to another branch, and a direct callee effect is not a runtime
 * reaching definition, gameplay transition or actual result.
 */
export function semanticIrSourceWriteContinuations(
  ir: SemanticIr,
  writeOperationIds: readonly string[],
  eligibleEventEdgeIds: ReadonlySet<string>,
): ReadonlyMap<string, SourceWriteContinuationResult> {
  const maxDepth = 6;
  const maxStates = 96;
  const maxPaths = 5;
  type Edge = SemanticIr["execution"]["edges"][number];
  type Site = {
    readonly id: string;
    readonly category: string;
    readonly source: Edge["source"];
  };
  const regions = new Map(ir.execution.regions.map(item => [item.id, item]));
  const writes = new Map(ir.state.operations.map(item => [item.id, item]));
  const edgesById = new Map(ir.execution.edges.map(item => [item.id, item]));
  const outgoing = new Map<string, Edge[]>();
  for (const edge of ir.execution.edges) {
    if (edge.resolution !== "resolved" || !edge.to ||
        edge.kind === "static-module-dependency" ||
        !regions.has(edge.from) || !regions.has(edge.to)) continue;
    const items = outgoing.get(edge.from) ?? [];
    items.push(edge);
    outgoing.set(edge.from, items);
  }
  for (const items of outgoing.values()) {
    items.sort((a, b) =>
      a.source.relativePath.localeCompare(b.source.relativePath) ||
      (a.source.range?.lineStart ?? 0) - (b.source.range?.lineStart ?? 0) ||
      (a.source.range?.columnStart ?? 0) - (b.source.range?.columnStart ?? 0) ||
      a.id.localeCompare(b.id));
  }
  const sitesByRegion = new Map<string, Site[]>();
  const add = (regionId: string, site: Site): void => {
    const items = sitesByRegion.get(regionId) ?? [];
    items.push(site);
    sitesByRegion.set(regionId, items);
  };
  for (const item of ir.state.operations) {
    if (item.operation === "read") continue;
    add(item.executionRegionId, {
      id: item.id, category: "state:" + item.operation, source: item.source,
    });
  }
  for (const item of ir.state.resourceActions ?? []) {
    add(item.executionRegionId, {
      id: item.id, category: "resource:" + item.action, source: item.source,
    });
  }
  for (const item of ir.execution.worldEffects ?? []) {
    add(item.executionRegionId, {
      id: item.id, category: "world-effect", source: item.source,
    });
  }
  for (const item of ir.execution.outcomes ?? []) {
    add(item.executionRegionId, {
      id: item.id, category: "code-return", source: item.source,
    });
  }
  for (const items of sitesByRegion.values()) {
    items.sort((a, b) =>
      a.source.relativePath.localeCompare(b.source.relativePath) ||
      (a.source.range?.lineStart ?? 0) - (b.source.range?.lineStart ?? 0) ||
      (a.source.range?.columnStart ?? 0) - (b.source.range?.columnStart ?? 0) ||
      a.id.localeCompare(b.id));
  }
  const temporal = (edge: Edge): boolean =>
    edge.kind === "event-dispatch" ||
    edge.kind === "internal-event-dispatch" ||
    edge.kind === "deferred" || edge.kind === "periodic";
  const results = new Map<string, SourceWriteContinuationResult>();
  for (const operationId of [...new Set(writeOperationIds)]) {
    const write = writes.get(operationId);
    const empty: SourceWriteContinuationResult = {
      paths: [], omittedPaths: 0,
      searchTruncated: false, blockedUnrootedEventEdges: 0,
    };
    if (!write || write.operation !== "write" ||
        !regions.has(write.executionRegionId)) {
      results.set(operationId, empty);
      continue;
    }
    type Pending = {
      readonly regionIds: readonly string[];
      readonly executionEdgeIds: readonly string[];
      readonly temporalBoundaryEdgeIds: readonly string[];
    };
    const queued: Pending[] = [{
      regionIds: [write.executionRegionId],
      executionEdgeIds: [],
      temporalBoundaryEdgeIds: [],
    }];
    const paths: SourceWriteContinuationPath[] = [];
    const blockedEvents = new Set<string>();
    let searchTruncated = false;
    for (let index = 0; index < queued.length; index += 1) {
      if (index >= maxStates) {
        searchTruncated = true;
        break;
      }
      const current = queued[index]!;
      const from = current.regionIds[current.regionIds.length - 1]!;
      const edges = outgoing.get(from) ?? [];
      if (current.executionEdgeIds.length >= maxDepth) {
        if (edges.length > 0) searchTruncated = true;
        continue;
      }
      for (const edge of edges) {
        if (queued.length >= maxStates) {
          searchTruncated = true;
          break;
        }
        if (edge.source.artifactId !== write.source.artifactId ||
            (regions.get(edge.to!)?.source?.artifactId !== undefined &&
              regions.get(edge.to!)!.source!.artifactId !== write.source.artifactId) ||
            (current.executionEdgeIds.length === 0 &&
              !sourceSiteStrictlyAfter(write.source, edge.source))) continue;
        const isEvent = edge.kind === "event-dispatch" ||
          edge.kind === "internal-event-dispatch";
        if (isEvent && !eligibleEventEdgeIds.has(edge.id)) {
          blockedEvents.add(edge.id);
          continue;
        }
        if (current.regionIds.includes(edge.to!)) {
          searchTruncated = true;
          continue;
        }
        const next: Pending = {
          regionIds: [...current.regionIds, edge.to!],
          executionEdgeIds: [...current.executionEdgeIds, edge.id],
          temporalBoundaryEdgeIds: temporal(edge)
            ? [...current.temporalBoundaryEdgeIds, edge.id]
            : current.temporalBoundaryEdgeIds,
        };
        const material = (sitesByRegion.get(edge.to!) ?? []).filter(site =>
          site.source.artifactId === write.source.artifactId);
        if (material.length > 0) {
          // Preserve categories before filling the bounded direct-target
          // evidence preview; eight state writes cannot hide a world effect.
          const selected = new Set<string>();
          const categories = new Set<string>();
          for (const site of material) {
            if (categories.has(site.category)) continue;
            categories.add(site.category);
            selected.add(site.id);
            if (selected.size >= 8) break;
          }
          for (const site of material) {
            if (selected.size >= 8) break;
            selected.add(site.id);
          }
          paths.push({
            ...next,
            directTargetEvidenceIds: material.filter(site =>
              selected.has(site.id)).map(site => site.id),
            omittedDirectTargetEvidenceCount:
              material.length - selected.size,
          });
        }
        queued.push(next);
      }
    }
    // Make an independently resolved event-bus bridge visible before
    // abundant synchronous helper branches; no names/genre assumptions.
    const hasInternalBus = (path: SourceWriteContinuationPath): boolean =>
      path.temporalBoundaryEdgeIds.some(id =>
        edgesById.get(id)?.kind === "internal-event-dispatch");
    paths.sort((a, b) =>
      Number(hasInternalBus(b)) - Number(hasInternalBus(a)) ||
      Number(b.temporalBoundaryEdgeIds.length > 0) -
        Number(a.temporalBoundaryEdgeIds.length > 0) ||
      b.directTargetEvidenceIds.length - a.directTargetEvidenceIds.length ||
      a.executionEdgeIds.length - b.executionEdgeIds.length ||
      a.executionEdgeIds.join("|").localeCompare(b.executionEdgeIds.join("|")));
    results.set(operationId, {
      paths: paths.slice(0, maxPaths),
      omittedPaths: Math.max(0, paths.length - maxPaths),
      searchTruncated,
      blockedUnrootedEventEdges: blockedEvents.size,
    });
  }
  return results;
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
