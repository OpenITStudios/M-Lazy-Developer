import { describe, expect, it } from "vitest";
import { parseScriptFile } from "../../src/parser/parse.js";

const source = {
  artifactId: "fixture",
  relativePath: "scripts/main.ts",
};

describe("script execution privilege analysis", () => {
  it("captures known world-state mutation calls inside before events", () => {
    const parsed = parseScriptFile(
      "scripts/main",
      `
        import { world } from "@minecraft/server";
        world.beforeEvents.playerBreakBlock.subscribe((event) => {
          event.player.setGameMode("creative");
          event.player.getGameMode();
        });
      `,
      source,
    );

    expect(parsed.restrictedMutations).toEqual([
      expect.objectContaining({
        root: "world",
        context: "before-event",
        event: "playerBreakBlock",
        method: "setGameMode",
        symbol: "Player.setGameMode",
        evidence: "contextual-fallback",
      }),
    ]);
  });

  it("uses exact inferred receiver symbols for restricted operations", () => {
    const parsed = parseScriptFile(
      "scripts/main",
      `
        import { world } from "@minecraft/server";
        const dimension = world.getDimension("overworld");
        const player = world.getAllPlayers()[0];

        world.beforeEvents.playerBreakBlock.subscribe(() => {
          world.setDifficulty("hard");
          dimension.spawnEntity("minecraft:zombie", { x: 0, y: 0, z: 0 });
          player.applyKnockback({ x: 1, z: 0 }, 0.4);
        });
      `,
      source,
    );

    expect(parsed.restrictedMutations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        symbol: "world.setDifficulty",
        evidence: "exact-symbol",
      }),
      expect.objectContaining({
        symbol: "Dimension.spawnEntity",
        evidence: "exact-symbol",
      }),
      expect.objectContaining({
        symbol: "Entity.applyKnockback",
        evidence: "exact-symbol",
      }),
    ]));
  });

  it("does not treat startup itself as restricted execution", () => {
    const parsed = parseScriptFile(
      "scripts/main",
      `
        import { system, world } from "@minecraft/server";
        system.beforeEvents.startup.subscribe(() => {
          world.setDifficulty("hard");
        });
      `,
      source,
    );

    expect(parsed.restrictedMutations).toEqual([]);
  });

  it("captures restricted operations inside custom command callbacks", () => {
    const parsed = parseScriptFile(
      "scripts/main",
      `
        import { system, world } from "@minecraft/server";

        system.beforeEvents.startup.subscribe((init) => {
          init.customCommandRegistry.registerCommand(
            { name: "demo:test", description: "demo", permissionLevel: 0 },
            () => {
              const player = world.getAllPlayers()[0];
              player.applyKnockback({ x: 1, z: 0 }, 0.4);
            },
          );
        });
      `,
      source,
    );

    expect(parsed.restrictedMutations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        context: "custom-command",
        event: "customCommand",
        symbol: "Entity.applyKnockback",
        evidence: "exact-symbol",
      }),
    ]));
  });

  it("flags restricted PlayerInputPermissions reads documented as denied", () => {
    const parsed = parseScriptFile(
      "scripts/main",
      `
        import { world } from "@minecraft/server";
        const player = world.getAllPlayers()[0];

        world.beforeEvents.playerBreakBlock.subscribe(() => {
          player.inputPermissions.isPermissionCategoryEnabled(0);
        });
      `,
      source,
    );

    expect(parsed.restrictedMutations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        context: "before-event",
        symbol: "PlayerInputPermissions.isPermissionCategoryEnabled",
      }),
    ]));
  });

  it("does not correlate mutations elsewhere on the same minified line", () => {
    const parsed = parseScriptFile(
      "scripts/main",
      'import { world } from "@minecraft/server"; world.beforeEvents.playerBreakBlock.subscribe((event) => { event.cancel = true; }); const player = world.getAllPlayers()[0]; player.removeTag("outside"); player.remove();',
      source,
    );

    expect(parsed.restrictedMutations).toEqual([]);
    const callback = parsed.events.find(
      (item) => item.event === "playerBreakBlock",
    );
    expect(callback?.source.range).toEqual(expect.objectContaining({
      lineStart: 1,
      lineEnd: 1,
      columnStart: expect.any(Number),
      columnEnd: expect.any(Number),
    }));
  });

  it("does not flag unrestricted reads", () => {
    const parsed = parseScriptFile(
      "scripts/main",
      `
        import { world } from "@minecraft/server";
        world.beforeEvents.playerBreakBlock.subscribe(() => {
          world.getAllPlayers();
          const difficulty = world.getDifficulty();
        });
      `,
      source,
    );
    expect(parsed.restrictedMutations).toEqual([]);
  });

  it("marks startup before-event as early execution", () => {
    const parsed = parseScriptFile(
      "scripts/main",
      `
        import { system } from "@minecraft/server";
        system.beforeEvents.startup.subscribe(() => {});
      `,
      source,
    );

    expect(parsed.capabilities).toEqual(expect.arrayContaining([
      expect.objectContaining({
        capability: "early-execution",
        detail: "system.beforeEvents.startup",
      }),
    ]));
  });
});
