import { describe, expect, it } from "vitest";
import { parseScriptFile } from "../../../../analyzers/scripts/src/index.js";
import { deriveScriptApiUsage } from "../../src/inspection/script-api-usage.js";
import { correlateScriptUsageWithUpdate } from "../../src/inspection/script-update-correlation.js";

function usage(text: string) {
  return deriveScriptApiUsage([
    parseScriptFile(
      "scripts/main",
      text,
      { artifactId: "fixture", relativePath: "behavior_packs/demo/scripts/main.js" },
    ),
  ]);
}

describe("Script API update correlation", () => {
  it("matches direct class aliases and event-container aliases without broad guessing", () => {
    const before = usage(`
      import { world } from "@minecraft/server";
      const dimension = world.getDimension("overworld");
      dimension.fillBlocks({x:0,y:0,z:0}, "stone");
      world.afterEvents.playerCancelBreakingBlock.subscribe(() => {});
    `);
    const after = usage(`
      import { world } from "@minecraft/server";
      const dimension = world.getDimension("overworld");
      dimension.fillBlocks({x:0,y:0,z:0}, "stone");
      world.afterEvents.playerCancelBreakingBlock.subscribe(() => {});
    `);

    const result = correlateScriptUsageWithUpdate({
      id: "update",
      kind: "changed",
      domain: "scripts",
      capabilityTags: ["script-module:@minecraft/server"],
      affectedIdentifiers: [
        "@minecraft/server@2.9.0",
        "Dimension.fillBlocks",
        "WorldAfterEvents.playerCancelBreakingBlock",
      ],
      summary: "test",
      source: "official",
      confidence: "documented",
    }, before, after);

    expect(result.moduleSurfaceOverlap).toBe(true);
    expect(result.exactSymbolMatches).toEqual(expect.arrayContaining([
      expect.objectContaining({
        observedSymbol: "world.afterEvents.playerCancelBreakingBlock",
        affectedIdentifier: "WorldAfterEvents.playerCancelBreakingBlock",
        matchKind: "alias",
      }),
    ]));
  });

  it("keeps module overlap separate when no exact symbol is documented", () => {
    const mapUsage = usage(`
      import { world } from "@minecraft/server";
      world.getDimension("overworld");
    `);

    const result = correlateScriptUsageWithUpdate({
      id: "module-only",
      kind: "changed",
      domain: "scripts",
      capabilityTags: ["script-module:@minecraft/server"],
      affectedIdentifiers: ["@minecraft/server@2.9.0"],
      summary: "module release",
      source: "official",
      confidence: "documented",
    }, mapUsage, mapUsage);

    expect(result.moduleSurfaceOverlap).toBe(true);
    expect(result.exactSymbolMatches).toEqual([]);
  });
});
