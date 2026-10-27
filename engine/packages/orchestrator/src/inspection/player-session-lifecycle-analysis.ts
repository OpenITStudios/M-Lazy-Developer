import type { ParsedScriptFile } from "../../../../analyzers/scripts/src/index.js";

export interface PlayerSessionLifecycleAnalysis {
  playerJoinSubscriptions: number;
  playerSpawnSubscriptions: number;
  playerLeaveSubscriptions: number;
  persistentPlayerStateAccesses: number;
  deferredCallbacks: number;
  /** Event ID call arguments are not proof a callee evicted a cache. */
  leaveIdArgumentSites: number;
  directLeaveCacheDeleteSites: number;
  spawnInitialFlagReadSites: number;
  playerSessionSourceSites: NonNullable<
    ParsedScriptFile["events"][number]["playerSessionSites"]
  >;
  omittedPlayerSessionSourceSites: number;
  lifecycleCoverage: "complete-surface" | "partial-surface" | "absent";
  initialVsRespawnStatus: "runtime-flag-required" | "not-applicable";
  leaveCleanupStatus: "cleanup-proof-required" | "not-applicable";
  sessionReadinessStatus: "project-reconciliation-required" | "not-applicable";
}

export function analyzePlayerSessionLifecycle(
  scripts: readonly ParsedScriptFile[],
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
  const sites = events.filter(event =>
    event.root === "world" && event.phase === "afterEvents" &&
    (event.event === "playerLeave" || event.event === "playerSpawn"))
    .flatMap(event => event.playerSessionSites ?? []);
  const leaveIdArgumentSites = sites.filter(site =>
    site.kind === "leave-id-argument" ||
    site.kind === "leave-direct-cache-delete").length;
  const directLeaveCacheDeleteSites = sites.filter(site =>
    site.kind === "leave-direct-cache-delete").length;
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
