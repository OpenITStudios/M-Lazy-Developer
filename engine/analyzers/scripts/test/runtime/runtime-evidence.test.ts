import { describe, expect, it } from "vitest";
import { parseScriptFile, scriptRuntimeEvidence } from "../../src/index.js";

const source = { artifactId: "fixture", relativePath: "scripts/main.ts" };

describe("script runtime evidence", () => {
  it("preserves restricted mutation and event provenance", () => {
    const parsed = parseScriptFile(
      "scripts/main",
      `
        import { world } from "@minecraft/server";
        const player = world.getAllPlayers()[0];
        world.beforeEvents.playerBreakBlock.subscribe(() => {
          player.applyKnockback({ x: 1, z: 0 }, 0.4);
        });
      `,
      source,
    );

    const records = scriptRuntimeEvidence(parsed);
    const restricted = records.find(
      (record) => record.predicate === "restricted-execution-mutation-attempt",
    );
    expect(restricted?.state).toBe("present");
    expect(restricted?.note).toContain("Entity.applyKnockback");
    expect(restricted?.sourceRefs?.[0]?.relativePath).toBe("scripts/main.ts");
    expect(records.some((record) => record.predicate === "before-event-subscription")).toBe(true);
    expect(records.some((record) => record.predicate === "gameplay-knockback-request")).toBe(true);
  });

  it("emits generation revalidation evidence only for explicit callback guards", () => {
    const guarded = parseScriptFile(
      "scripts/main",
      `
        import { system } from "@minecraft/server";
        let arenaGeneration = 4;
        const capturedGeneration = arenaGeneration;
        system.run(() => {
          if (capturedGeneration !== arenaGeneration) return;
          arenaGeneration += 1;
        });
      `,
      source,
    );

    const guardedRecords = scriptRuntimeEvidence(guarded);
    expect(guarded.deferredCallbacks).toEqual([
      expect.objectContaining({
        scheduler: "run",
        guardEvidence: "explicit-generation-check",
        guardIdentifiers: expect.arrayContaining([
          "capturedGeneration",
          "arenaGeneration",
        ]),
      }),
    ]);
    expect(guardedRecords.some(
      (record) => record.predicate === "async-generation-revalidation",
    )).toBe(true);

    const unresolved = parseScriptFile(
      "scripts/main",
      `
        import { system } from "@minecraft/server";
        system.run(() => {
          doWork();
        });
      `,
      source,
    );
    const unresolvedRecords = scriptRuntimeEvidence(unresolved);
    expect(unresolved.deferredCallbacks[0]?.guardEvidence).toBe("unresolved");
    expect(unresolvedRecords.some(
      (record) => record.predicate === "async-generation-revalidation",
    )).toBe(false);
  });

  it("bridges literal runCommand commands into command evidence", () => {
    const parsed = parseScriptFile(
      "scripts/main",
      `
        import { world } from "@minecraft/server";
        const dimension = world.getDimension("overworld");
        const player = world.getAllPlayers()[0];
        dimension.runCommand("fill 0 64 0 1 65 1 minecraft:stone");
        player.runCommandAsync("tp @s 5 65 5");
      `,
      source,
    );

    const records = scriptRuntimeEvidence(parsed);
    expect(records).toEqual(expect.arrayContaining([
      expect.objectContaining({
        predicate: "script-command-execution-request",
        state: "present",
      }),
      expect.objectContaining({
        predicate: "block-write",
        state: "present",
      }),
      expect.objectContaining({
        predicate: "world-mutation-request",
        state: "present",
      }),
      expect.objectContaining({
        predicate: "teleport-apply",
        state: "present",
      }),
    ]));

    const block = records.find((item) => item.predicate === "block-write");
    const teleport = records.find((item) => item.predicate === "teleport-apply");
    expect(block?.scope?.operationId).not.toBe(teleport?.scope?.operationId);
  });

  it("emits durable-state and deferred-work evidence without claiming completion", () => {
    const parsed = parseScriptFile(
      "scripts/main",
      `
        import { system, world } from "@minecraft/server";
        world.setDynamicProperty("arena", 1);
        system.run(() => {});
      `,
      source,
    );
    const records = scriptRuntimeEvidence(parsed);
    expect(records.some((record) => record.predicate === "durable-state-write")).toBe(true);
    expect(records.some((record) => record.predicate === "deferred-script-work")).toBe(true);
    expect(records.some((record) => record.predicate === "COMMIT")).toBe(false);
  });
});