import type {
  ParsedScriptFile,
  CrossFileCallEdge,
} from "../../../../analyzers/scripts/src/index.js";
import type { SourceRef } from "../../../project-model/src/index.js";

/** A current-artifact call-site witness enriched by the existing exact
 * local/ESM resolver. A resolved helper is NOT proof the helper deletes
 * state or that any playerLeave callback was delivered.
 */
export type PlayerSessionSourceSite = NonNullable<
  ParsedScriptFile["events"][number]["playerSessionSites"]
>[number] & {
  readonly helperTarget?: SourceRef;
  readonly helperResolution?: "local" | "imported-esm";
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
            helperResolution: "imported-esm" as const,
          }));
        // Multiple competing targets or incomplete range = unresolved.
        const targets = [...local, ...imported];
        return targets.length === 1
          ? { ...site, ...targets[0]! }
          : site;
      })));
  const leaveIdArgumentSites = sites.filter(site =>
    site.kind === "leave-id-argument" ||
    site.kind === "leave-direct-cache-delete").length;
  const directLeaveCacheDeleteSites = sites.filter(site =>
    site.kind === "leave-direct-cache-delete").length;
  const resolvedLeaveHelperSites = sites.filter(site =>
    site.kind === "leave-id-argument" &&
    site.helperTarget !== undefined).length;
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
