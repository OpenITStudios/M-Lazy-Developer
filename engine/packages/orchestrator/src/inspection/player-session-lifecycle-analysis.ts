import type {
  ParsedScriptFile,
  CrossFileCallEdge,
} from "../../../../analyzers/scripts/src/index.js";
import type { SourceRef, SourceSequentialSite } from "../../../project-model/src/index.js";

/** A current-artifact call-site witness enriched by the existing exact
 * local/ESM resolver. A resolved helper is NOT proof the helper deletes
 * state or that any playerLeave callback was delivered.
 */
export type PlayerSessionSourceSite = NonNullable<
  ParsedScriptFile["events"][number]["playerSessionSites"]
>[number] & {
  readonly helperTarget?: SourceRef;
  readonly helperResolution?: "local" | "imported-esm";
  /** Direct source call(s) to module-const Map/Set.delete(formal) in the
   * resolved helper, with exact playerId argument index/arity. This does NOT
   * prove that the event or helper executed or that every cache was cleared.
   */
  readonly helperCacheDeleteSites?: readonly {
    readonly collection: string;
    readonly source: SourceRef;
    readonly parameterName: string;
  }[];
  readonly omittedHelperCacheDeleteSites?: number;
  /** Same-helper, same-parameter source membership release, joined from
   * the parser's arena authority paths. Not a live identity or safe reset.
   */
  readonly helperArenaReleaseSites?: readonly {
    readonly arenaExpression: string;
    readonly membershipSource: SourceRef;
    readonly generationExpression?: string;
    readonly generationInvalidationSource?: SourceRef;
    readonly ambiguousGenerationInvalidationSites?: number;
    /** Relative direct-statement order ONLY when all sites have the same
     * exact containing block. Different branches stay unknown.
     */
    readonly cacheDeleteRelativeToMembership: "before" | "after" | "unknown";
    readonly generationWriteRelativeToMembership: "before" | "after" | "unknown";
    readonly generationWriteRelativeToCache: "before" | "after" | "unknown";
  }[];
  readonly omittedHelperArenaReleaseSites?: number;
  /** Scheduler call authored inside the uniquely resolved helper. The
   * leading generation mismatch check is only a source guard candidate.
   */
  readonly helperDeferredWorkSites?: readonly {
    readonly scheduler: ParsedScriptFile["deferredCallbacks"][number]["scheduler"];
    readonly source: SourceRef;
    readonly generationGuardSource?: SourceRef;
    readonly generationGuardOperands?: readonly [string, string];
    readonly sourceGenerationCapture?: ParsedScriptFile["deferredCallbacks"][number]["sourceGenerationCapture"];
    readonly mentionsSameAuthoredArenaGeneration: boolean;
    /** Scheduling call relative to the uniquely linked generation write,
     * source statement order, not delivery/cancellation/guard dominance.
     */
    readonly schedulerRelativeToGenerationWrite: "before" | "after" | "unknown";
  }[];
  readonly omittedHelperDeferredWorkSites?: number;
};

/** Never match a guessed call by filename or nearby text. */
function exactCallSite(a: SourceRef, b: SourceRef): boolean {
  const ar = a.range;
  const br = b.range;
  return a.artifactId === b.artifactId &&
    a.relativePath === b.relativePath &&
    a.jsonPointer === b.jsonPointer &&
    ar !== undefined && br !== undefined &&
    ar.lineStart === br.lineStart &&
    ar.lineEnd === br.lineEnd &&
    ar.columnStart === br.columnStart &&
    ar.columnEnd === br.columnEnd;
}

/** Source statement index within exactly one lexical block. Nested if,
 * loops and other source blocks cannot be ordered by line proximity or
 * function name. An order never proves an operation was executed.
 */
function sameBlockOrder(
  a: SourceSequentialSite | undefined,
  b: SourceSequentialSite | undefined,
): "before" | "after" | "unknown" {
  if (!a || !b || !exactCallSite(a.block, b.block) ||
      a.statementIndex === b.statementIndex) return "unknown";
  return a.statementIndex < b.statementIndex ? "before" : "after";
}


export interface PlayerSessionLifecycleAnalysis {
  playerJoinSubscriptions: number;
  playerSpawnSubscriptions: number;
  playerLeaveSubscriptions: number;
  persistentPlayerStateAccesses: number;
  deferredCallbacks: number;
  /** Event ID call arguments are not proof a callee evicted a cache. */
  leaveIdArgumentSites: number;
  directLeaveCacheDeleteSites: number;
  /** Resolved function declaration sites receiving event.playerId,
   * independent of whether that helper actually releases session state.
   */
  resolvedLeaveHelperSites: number;
  resolvedLeaveHelperDeletePaths: number;
  /** A direct helper body releases arena membership with the same parameter
   * receiving event.playerId. These are source attempts, not runtime facts.
   */
  resolvedLeaveHelperArenaReleasePaths: number;
  /** Of those, authored generation invalidation occurs in the same
   * arena source region. It does not prove session isolation.
   */
  resolvedLeaveHelperGenerationInvalidationPaths: number;
  /** Three direct cleanup source sites admit a common lexical block/order.
   * Neither actual execution nor generation-owner identity is proven.
   */
  sourceOrderedLeaveCleanupPaths: number;
  /** Schedulers authored directly in resolved playerLeave helpers; never
   * infer callback execution or generation-safe cleanup from the count.
   */
  resolvedLeaveHelperDeferredWorkPaths: number;
  spawnInitialFlagReadSites: number;
  playerSessionSourceSites: readonly PlayerSessionSourceSite[];
  omittedPlayerSessionSourceSites: number;
  lifecycleCoverage: "complete-surface" | "partial-surface" | "absent";
  initialVsRespawnStatus: "runtime-flag-required" | "not-applicable";
  leaveCleanupStatus: "cleanup-proof-required" | "not-applicable";
  sessionReadinessStatus: "project-reconciliation-required" | "not-applicable";
}

export function analyzePlayerSessionLifecycle(
  scripts: readonly ParsedScriptFile[],
  crossFileCalls: readonly CrossFileCallEdge[] = [],
): PlayerSessionLifecycleAnalysis {
  const events = scripts.flatMap((script) => script.events);
  const playerJoinSubscriptions = events.filter(
    (event) => event.root === "world" && event.phase === "afterEvents" && event.event === "playerJoin",
  ).length;
  const playerSpawnSubscriptions = events.filter(
    (event) => event.root === "world" && event.phase === "afterEvents" && event.event === "playerSpawn",
  ).length;
  const playerLeaveSubscriptions = events.filter(
    (event) => event.root === "world" && event.phase === "afterEvents" && event.event === "playerLeave",
  ).length;
  // Reuse the parser's typed receiver identity, not a variable name such
  // as "playerCache" or "myPlayer". A write/read is source-authored only;
  // it never proves durable state, session ownership or reconnection.
  const playerStateMethods = new Set([
    "getDynamicProperty", "setDynamicProperty",
    "clearDynamicProperties", "getDynamicPropertyIds",
    "getDynamicPropertyTotalByteCount",
  ]);
  const persistentPlayerStateAccesses = scripts.reduce(
    (sum, script) => sum + script.methodCalls.filter(call =>
      call.receiverType === "Player" && playerStateMethods.has(call.method)
    ).length,
    0,
  );
  const deferredCallbacks = scripts.reduce(
    (sum, script) => sum + script.deferredCallbacks.length,
    0,
  );
  // The parser already binds each site to the exact imported-world event
  // callback. Join that call to the canonical local/ESM resolver instead of
  // guessing from function names such as "cleanup" or "disconnect".
  const sites: PlayerSessionSourceSite[] = scripts.flatMap(script =>
    script.events.filter(event =>
      event.root === "world" && event.phase === "afterEvents" &&
      (event.event === "playerLeave" || event.event === "playerSpawn"))
      .flatMap(event => (event.playerSessionSites ?? []).map(site => {
        if (site.kind !== "leave-id-argument") return site;
        const local = script.localFunctionCalls
          .filter(call => call.targetSource !== undefined &&
            exactCallSite(call.source, site.source) &&
            call.targetSource.artifactId === script.source.artifactId &&
            call.targetSource.relativePath === script.source.relativePath)
          .map(call => ({
            helperTarget: call.targetSource!,
            helperRegion: call.targetRegion,
            helperResolution: "local" as const,
          }));
        const imported = crossFileCalls
          .filter(call => call.status === "resolved" &&
            call.targetRegion !== undefined &&
            call.targetSource !== undefined &&
            call.targetModule !== undefined &&
            call.source.artifactId === script.source.artifactId &&
            call.callerModule === script.source.relativePath &&
            exactCallSite(call.source, site.source) &&
            call.targetSource.artifactId === script.source.artifactId &&
            call.targetSource.relativePath === call.targetModule)
          .map(call => ({
            helperTarget: call.targetSource!,
            helperRegion: call.targetRegion!,
            helperResolution: "imported-esm" as const,
          }));
        // Multiple competing targets or incomplete range = unresolved.
        const targets = [...local, ...imported];
        if (targets.length !== 1) return site;
        const target = targets[0]!;
        if (site.argumentIndex === undefined ||
            site.argumentCount === undefined) return { ...site, ...target };
        const owned = scripts.filter(candidate =>
          candidate.source.artifactId === script.source.artifactId &&
          candidate.source.relativePath === target.helperTarget.relativePath);
        const directDeletes = owned.length === 1
          ? (owned[0]!.moduleCollectionDeletes ?? []).filter(deletion =>
              exactCallSite(deletion.callableSource, target.helperTarget) &&
              deletion.parameterIndex === site.argumentIndex &&
              deletion.parameterCount === site.argumentCount)
          : [];
        // The shared identity of an arena cannot be inferred from
        // source spelling alone. Here we can only correlate the *same*
        // unshadowed helper formal with the exact arena membership release.
        const candidateArenaPaths = owned.length === 1
          ? (owned[0]!.arenaAuthorityPaths ?? []).filter(path =>
              path.parserExecutionRegion === target.helperRegion &&
              path.membershipRelease !== undefined &&
              path.membershipRelease.arenaExpression === path.arenaExpression &&
              path.membershipRelease.source.artifactId === script.source.artifactId &&
              path.membershipRelease.source.relativePath ===
                target.helperTarget.relativePath &&
              path.membershipRelease.subjectParameterIndex === site.argumentIndex &&
              path.membershipRelease.subjectParameterCount === site.argumentCount &&
              directDeletes.some(deletion =>
                deletion.parameterIndex === path.membershipRelease!.subjectParameterIndex &&
                deletion.parameterCount === path.membershipRelease!.subjectParameterCount &&
                deletion.parameterName === path.membershipRelease!.subjectExpression))
          : [];
        const arenaReleaseSites = candidateArenaPaths.map(path => {
          const release = path.membershipRelease!;
          const matchingDeletes = directDeletes.filter(deletion =>
            deletion.parameterName === release.subjectExpression);
          // Two matching direct collection deletions can refer to distinct
          // caches: do not pick an arbitrary one to establish lexical order.
          const uniqueDelete = matchingDeletes.length === 1
            ? matchingDeletes[0] : undefined;
          const directDeleteSequence =
            uniqueDelete?.sourceSequence?.directCall === true
              ? uniqueDelete.sourceSequence : undefined;
          const directReleaseSequence =
            release.sourceSequence?.directCall === true
              ? release.sourceSequence : undefined;
          const generation = path.generationInvalidation?.generationExpression !==
              undefined && path.generationInvalidation.source.artifactId ===
              script.source.artifactId &&
              path.generationInvalidation.source.relativePath ===
              target.helperTarget.relativePath
            ? path.generationInvalidation : undefined;
          return {
            arenaExpression: path.arenaExpression,
            membershipSource: release.source,
            ...(path.ambiguousGenerationInvalidationSites === undefined ? {} : {
              ambiguousGenerationInvalidationSites:
                path.ambiguousGenerationInvalidationSites,
            }),
            ...(generation?.generationExpression === undefined ? {} : {
              generationExpression: generation.generationExpression,
              generationInvalidationSource: generation.source,
            }),
            cacheDeleteRelativeToMembership: sameBlockOrder(
              directDeleteSequence, directReleaseSequence),
            generationWriteRelativeToMembership: sameBlockOrder(
              generation?.sourceSequence, directReleaseSequence),
            generationWriteRelativeToCache: sameBlockOrder(
              generation?.sourceSequence, directDeleteSequence),
          };
        });
        const deferredWork = owned.length === 1
          ? owned[0]!.deferredCallbacks.filter(callback =>
              callback.callerRegion === target.helperRegion &&
              callback.source.artifactId === script.source.artifactId &&
              callback.source.relativePath === target.helperTarget.relativePath)
          : [];
        const normalize = (value: string): string => value.replace(/\s+/g, "");
        const authoredGenerationPaths = candidateArenaPaths.filter(path =>
          path.generationInvalidation?.generationExpression !== undefined &&
          path.generationInvalidation.source.artifactId === script.source.artifactId &&
          path.generationInvalidation.source.relativePath ===
            target.helperTarget.relativePath);
        // A helper touching two different arena generations cannot borrow
        // one arena's guard or scheduling order to establish another's.
        const uniqueGeneration = authoredGenerationPaths.length === 1
          ? authoredGenerationPaths[0]!.generationInvalidation : undefined;
        const helperDeferredWork = deferredWork.map(callback => {
          const generation = uniqueGeneration?.generationExpression;
          const operands = callback.generationGuardOperands;
          const citedGeneration = generation !== undefined && operands !== undefined &&
            operands.filter(operand => normalize(operand) === normalize(generation)).length === 1 &&
            operands.filter(operand => normalize(operand) !== normalize(generation)).length === 1;
          return {
            scheduler: callback.scheduler,
            source: callback.source,
            ...(callback.generationGuardSource === undefined ? {} : {
              generationGuardSource: callback.generationGuardSource,
            }),
            ...(callback.generationGuardOperands === undefined ? {} : {
              generationGuardOperands: callback.generationGuardOperands,
            }),
            ...(callback.sourceGenerationCapture === undefined ? {} : {
              sourceGenerationCapture: callback.sourceGenerationCapture,
            }),
            // Exact syntax of an early-exit reference is not a stable
            // captured token or proof of the selected arena's generation.
            mentionsSameAuthoredArenaGeneration:
              callback.guardEvidence === "explicit-generation-check" &&
              callback.generationGuardSource !== undefined && citedGeneration,
            schedulerRelativeToGenerationWrite: sameBlockOrder(
              callback.sourceSequence?.directCall === true
                ? callback.sourceSequence : undefined,
              uniqueGeneration?.sourceSequence),
          };
        });
        return {
          ...site,
          helperTarget: target.helperTarget,
          helperResolution: target.helperResolution,
          ...(directDeletes.length === 0 ? {} : {
            helperCacheDeleteSites: directDeletes.slice(0, 4).map(deletion => ({
              collection: deletion.collection,
              source: deletion.source,
              parameterName: deletion.parameterName,
            })),
            omittedHelperCacheDeleteSites: Math.max(0, directDeletes.length - 4),
          }),
          ...(arenaReleaseSites.length === 0 ? {} : {
            helperArenaReleaseSites: arenaReleaseSites.slice(0, 4),
            omittedHelperArenaReleaseSites: Math.max(0, arenaReleaseSites.length - 4),
          }),
          ...(helperDeferredWork.length === 0 ? {} : {
            helperDeferredWorkSites: helperDeferredWork.slice(0, 4),
            omittedHelperDeferredWorkSites: Math.max(0, helperDeferredWork.length - 4),
          }),
        };
      })));
  const leaveIdArgumentSites = sites.filter(site =>
    site.kind === "leave-id-argument" ||
    site.kind === "leave-direct-cache-delete").length;
  const directLeaveCacheDeleteSites = sites.filter(site =>
    site.kind === "leave-direct-cache-delete").length;
  const resolvedLeaveHelperSites = sites.filter(site =>
    site.kind === "leave-id-argument" &&
    site.helperTarget !== undefined).length;
  const resolvedLeaveHelperDeletePaths = sites.filter(site =>
    site.kind === "leave-id-argument" &&
    (site.helperCacheDeleteSites?.length ?? 0) > 0).length;
  const resolvedLeaveHelperArenaReleasePaths = sites.filter(site =>
    site.kind === "leave-id-argument" &&
    (site.helperArenaReleaseSites?.length ?? 0) > 0).length;
  const resolvedLeaveHelperGenerationInvalidationPaths = sites.filter(site =>
    site.kind === "leave-id-argument" &&
    site.helperArenaReleaseSites?.some(path =>
      path.generationInvalidationSource !== undefined)).length;
  const sourceOrderedLeaveCleanupPaths = sites.filter(site =>
    site.kind === "leave-id-argument" &&
    site.helperArenaReleaseSites?.some(path =>
      path.cacheDeleteRelativeToMembership !== "unknown" &&
      path.generationWriteRelativeToMembership !== "unknown" &&
      path.generationWriteRelativeToCache !== "unknown")).length;
  const resolvedLeaveHelperDeferredWorkPaths = sites.filter(site =>
    site.kind === "leave-id-argument" &&
    (site.helperDeferredWorkSites?.length ?? 0) > 0).length;
  const spawnInitialFlagReadSites = sites.filter(site =>
    site.kind === "spawn-initial-flag-read").length;
  const orderedSites = [...sites].sort((a, b) =>
    a.source.relativePath.localeCompare(b.source.relativePath) ||
    (a.source.range?.lineStart ?? 0) - (b.source.range?.lineStart ?? 0) ||
    (a.source.range?.columnStart ?? 0) - (b.source.range?.columnStart ?? 0) ||
    a.kind.localeCompare(b.kind));
  const surfaces = [
    playerJoinSubscriptions > 0,
    playerSpawnSubscriptions > 0,
    playerLeaveSubscriptions > 0,
  ].filter(Boolean).length;

  return {
    playerJoinSubscriptions,
    playerSpawnSubscriptions,
    playerLeaveSubscriptions,
    persistentPlayerStateAccesses,
    deferredCallbacks,
    leaveIdArgumentSites,
    directLeaveCacheDeleteSites,
    resolvedLeaveHelperSites,
    resolvedLeaveHelperDeletePaths,
    resolvedLeaveHelperArenaReleasePaths,
    resolvedLeaveHelperGenerationInvalidationPaths,
    sourceOrderedLeaveCleanupPaths,
    resolvedLeaveHelperDeferredWorkPaths,
    spawnInitialFlagReadSites,
    playerSessionSourceSites: orderedSites.slice(0, 12),
    omittedPlayerSessionSourceSites: Math.max(0, orderedSites.length - 12),
    lifecycleCoverage:
      surfaces === 3
        ? "complete-surface"
        : surfaces > 0
          ? "partial-surface"
          : "absent",
    initialVsRespawnStatus:
      playerSpawnSubscriptions > 0
        ? "runtime-flag-required"
        : "not-applicable",
    leaveCleanupStatus:
      playerLeaveSubscriptions > 0
        ? "cleanup-proof-required"
        : "not-applicable",
    sessionReadinessStatus:
      playerSpawnSubscriptions > 0
        ? "project-reconciliation-required"
        : "not-applicable",
  };
}
