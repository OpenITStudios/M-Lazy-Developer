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
