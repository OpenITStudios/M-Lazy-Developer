import { describe, expect, it } from "vitest";
import { parseScriptFile } from "../../../../analyzers/scripts/src/index.js";
import { analyzePlayerSessionLifecycle } from "../../src/inspection/player-session-lifecycle-analysis.js";

describe("player session lifecycle analysis", () => {
  it("keeps join spawn and leave as distinct lifecycle surfaces", () => {
    const script = parseScriptFile(
      "main",
      [
        'import { world } from "@minecraft/server";',
        "world.afterEvents.playerJoin.subscribe(() => {});",
        "world.afterEvents.playerSpawn.subscribe((event) => { if (event.initialSpawn) {} });",
        "world.afterEvents.playerLeave.subscribe(() => {});",
      ].join("\n"),
      { artifactId: "fixture", relativePath: "scripts/main.ts" },
    );
    expect(analyzePlayerSessionLifecycle([script])).toMatchObject({
      playerJoinSubscriptions: 1,
      playerSpawnSubscriptions: 1,
      playerLeaveSubscriptions: 1,
      lifecycleCoverage: "complete-surface",
      initialVsRespawnStatus: "runtime-flag-required",
      leaveCleanupStatus: "cleanup-proof-required",
    });
  });

  it("counts only typed Player persistence sites, not player-named helpers", () => {
    const script = parseScriptFile("ownership", [
      'import { world } from "@minecraft/server";',
      'function change(member: Player) { member.setDynamicProperty("session", 1); }',
      'const playerCache = { setDynamicProperty() {}, getDynamicProperty() {} };',
      'playerCache.setDynamicProperty("session", 1);',
      'playerCache.getDynamicProperty("session");',
      'world.setDynamicProperty("global", 2);',
    ].join("\n"), {
      artifactId: "selected", relativePath: "scripts/state.ts",
    });
    expect(analyzePlayerSessionLifecycle([script]).persistentPlayerStateAccesses)
      .toBe(1);
  });

  it("retains leave and spawn source witnesses under the shared 12-site limit", () => {
    const source = {
      artifactId: "selected", relativePath: "scripts/many-events.js",
    };
    const spawn = "world.afterEvents.playerSpawn.subscribe(event => { if (event.initialSpawn) {} });";
    const leave = "world.afterEvents.playerLeave.subscribe(({playerId: id}) => cleanup(id));";
    const parse = (callbacks: string[]) => parseScriptFile("many-events", [
      'import { world } from "@minecraft/server";',
      "function cleanup(id) {}",
      ...callbacks,
    ].join("\n"), source);

    const spawnFirst = analyzePlayerSessionLifecycle([parse([
      ...Array.from({ length: 13 }, () => spawn),
      leave,
    ])]);
    expect(spawnFirst.spawnInitialFlagReadSites).toBe(13);
    expect(spawnFirst.leaveIdArgumentSites).toBe(1);
    expect(spawnFirst.playerSessionSourceSites).toHaveLength(12);
    expect(spawnFirst.playerSessionSourceSites.some(site =>
      site.kind === "leave-id-argument")).toBe(true);
    expect(spawnFirst.playerSessionSourceSites.some(site =>
      site.kind === "spawn-initial-flag-read")).toBe(true);
    expect(spawnFirst.omittedPlayerSessionSourceSites).toBe(2);

    const leaveFirst = analyzePlayerSessionLifecycle([parse([
      ...Array.from({ length: 13 }, () => leave),
      spawn,
    ])]);
    expect(leaveFirst.leaveIdArgumentSites).toBe(13);
    expect(leaveFirst.spawnInitialFlagReadSites).toBe(1);
    expect(leaveFirst.playerSessionSourceSites).toHaveLength(12);
    expect(leaveFirst.playerSessionSourceSites.filter(site =>
      site.kind === "leave-id-argument")).toHaveLength(11);
    expect(leaveFirst.playerSessionSourceSites.some(site =>
      site.kind === "spawn-initial-flag-read")).toBe(true);
    expect(leaveFirst.omittedPlayerSessionSourceSites).toBe(2);

    const noLeave = analyzePlayerSessionLifecycle([parse([
      ...Array.from({ length: 13 }, () => spawn),
    ])]);
    expect(noLeave.leaveIdArgumentSites).toBe(0);
    expect(noLeave.playerSessionSourceSites).toHaveLength(12);
    expect(noLeave.playerSessionSourceSites.every(site =>
      site.kind === "spawn-initial-flag-read")).toBe(true);
    expect(noLeave.omittedPlayerSessionSourceSites).toBe(1);
  });

  it("does not treat spawn subscription as universal readiness proof", () => {
    const script = parseScriptFile(
      "main",
      'import { world } from "@minecraft/server";\n' +
        "world.afterEvents.playerSpawn.subscribe(() => {});",
      { artifactId: "fixture", relativePath: "scripts/main.ts" },
    );
    expect(analyzePlayerSessionLifecycle([script])).toMatchObject({
      lifecycleCoverage: "partial-surface",
      sessionReadinessStatus: "project-reconciliation-required",
    });
  });
});
