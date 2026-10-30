// Coherent Development test family, source-only consolidation.
// Original cases and assertions remain; executable equivalence not yet proven.
import { describe, expect, it } from "vitest";
import { analyzeCommand } from "../src/parse.js";
import { parseSelector } from "../src/selectors.js";
import { flattenCommandEffects } from "../src/flatten.js";
import { scoreboardAccesses, tagAccesses } from "../src/state-access.js";
import { commandRuntimeEvidence } from "../src/index.js";
import { parseScheduleAreaLoadedSemantics } from "../src/schedule-semantics.js";
import { parseBlockVerificationSemantics } from "../src/verification-semantics.js";

// Original suite: engine/analyzers/commands/test/dialogue-selector.test.ts (blob aee8fe99667276170f39a362f02e2ac7c964e434)
{


const source = {
  artifactId: "fixture",
  relativePath: "functions/dialogue.mcfunction",
};

describe("NPC dialogue command semantics", () => {
  it("recognizes @initiator as a selector", () => {
    expect(parseSelector("@initiator")).toMatchObject({
      base: "@initiator",
      raw: "@initiator",
    });
  });

  it("parses dialogue open", () => {
    const result = analyzeCommand(
      "dialogue open @e[type=npc,tag=guide] @p intro",
      source,
    );
    expect(result.effects).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "dialogue",
        operation: "open",
        npcTarget: "@e[type=npc,tag=guide]",
        playerTarget: "@p",
        sceneName: "intro",
      }),
    ]));
  });

  it("parses dialogue change with per-player target", () => {
    const result = analyzeCommand(
      "dialogue change @e[tag=guide] quest_done @initiator",
      source,
    );
    expect(result.effects).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "dialogue",
        operation: "change",
        sceneName: "quest_done",
        playerTarget: "@initiator",
      }),
      expect.objectContaining({
        kind: "selector-read",
        selector: expect.objectContaining({ base: "@initiator" }),
      }),
    ]));
  });
});
}

// Original suite: engine/analyzers/commands/test/grammar.test.ts (blob 401addf61989b125a7463a6a59c6d3b1dabc772c)
{


const source = { artifactId: "art", relativePath: "functions/test.mcfunction" };

describe("command grammar", () => {
  it("parses modern execute run with selector filters and nested structure load", () => {
    const result = analyzeCommand(
      "execute as @a[tag=arena1,scores={stage=1..}] at @s run structure load demo:gate ~ ~ ~",
      source,
    );
    const flat = flattenCommandEffects(result);

    expect(flat.some((effect) => effect.kind === "structure-load")).toBe(true);
    expect(scoreboardAccesses(flat)).toEqual(expect.arrayContaining([
      expect.objectContaining({ objective: "stage", access: "read" }),
    ]));
    expect(tagAccesses(flat)).toEqual(expect.arrayContaining([
      expect.objectContaining({ tag: "arena1", access: "read" }),
    ]));
  });

  it("models scoreboard operation as target read-write plus source read", () => {
    const result = analyzeCommand(
      "scoreboard players operation @s score += @p other",
      source,
    );
    const accesses = scoreboardAccesses(result.effects);

    expect(accesses).toEqual(expect.arrayContaining([
      expect.objectContaining({
        objective: "score",
        access: "read",
        target: "@s",
      }),
      expect.objectContaining({
        objective: "score",
        access: "write",
        target: "@s",
      }),
      expect.objectContaining({
        objective: "other",
        access: "read",
        target: "@p",
      }),
    ]));
  });

  it("recognizes direct function and structure references", () => {
    expect(analyzeCommand("function game/start", source).effects)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ kind: "function-call", target: "game/start" }),
      ]));

    expect(analyzeCommand("structure load arena:tier1 1 2 3", source).effects)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ kind: "structure-load", target: "arena:tier1" }),
      ]));
  });
});
}

// Original suite: engine/analyzers/commands/test/parse.test.ts (blob 0dd788db59ce3213c54ea3e8b8451af304c71eff)
{


const source = { artifactId: "art_demo", relativePath: "functions/demo.mcfunction" };

describe("command analyzer", () => {
  it("parses summon as an entity-spawn effect even without a spawn event", () => {
    const result = analyzeCommand(
      "summon minecraft:zombie 1 64 2",
      { artifactId: "a", relativePath: "functions/test.mcfunction" },
    );

    expect(result.effects).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "entity-spawn",
        entityIdentifier: "minecraft:zombie",
        position: {
          x: { mode: "absolute", value: 1 },
          y: { mode: "absolute", value: 64 },
          z: { mode: "absolute", value: 2 },
        },
      }),
    ]));
  });

  it("parses fill into a typed region effect", () => {
    const result = analyzeCommand("fill 8 -47 1 4 -50 1 spruce_wood", source);
    const effect = result.effects[0];
    expect(effect?.kind).toBe("fill");
    if (effect?.kind === "fill") {
      expect(effect.region.from.x).toEqual({ mode: "absolute", value: 8 });
      expect(effect.region.to.y).toEqual({ mode: "absolute", value: -50 });
      expect(effect.block).toBe("spruce_wood");
    }
  });

  it("recursively analyzes execute run commands", () => {
    const result = analyzeCommand(
      "execute as @a at @s run fill 1 2 3 4 5 6 stone",
      source,
    );
    const flat = flattenCommandEffects(result);
    expect(flat.some((effect) => effect.kind === "fill")).toBe(true);
  });

  it("extracts summon spawn events and event-command triggers", () => {
    expect(analyzeCommand(
      "summon daigon:path -17.5 -28.5 -110.51 0 0 daigon:set_path_0",
      source,
    ).effects).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "entity-event-trigger",
        mechanism: "summon",
        entityIdentifier: "daigon:path",
        event: "daigon:set_path_0",
      }),
    ]));

    expect(analyzeCommand(
      "/event entity @e[type=daigon:path] daigon:next_path",
      source,
    ).effects).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "entity-event-trigger",
        mechanism: "event-command",
        target: "@e[type=daigon:path]",
        event: "daigon:next_path",
      }),
    ]));
  });

  it("preserves coordinate modes", () => {
    const result = analyzeCommand("tp @s ~1 ~ ^2", source);
    const effect = result.effects.find((item) => item.kind === "teleport");
    expect(effect?.kind).toBe("teleport");
    if (effect?.kind === "teleport") {
      expect(effect.destination.x.mode).toBe("relative");
      expect(effect.destination.z.mode).toBe("local");
    }
  });
});


describe("execute context trace", () => {
  it("preserves nested execute context modifiers separately", () => {
    const result = analyzeCommand(
      "execute as @a[tag=arena1] at @s in nether positioned 1 2 3 rotated 90 0 anchored eyes run tp @s ~1 ~ ^2",
      source,
    );

    expect(
      result.contextTrace,
    ).toEqual({
      modifiers: [
        {
          kind: "as",
          value: "@a[tag=arena1]",
        },
        {
          kind: "at",
          value: "@s",
        },
        {
          kind: "in",
          value: "nether",
        },
        {
          kind: "positioned",
          value: "1 2 3",
        },
        {
          kind: "rotated",
          value: "90 0",
        },
        {
          kind: "anchored",
          value: "eyes",
        },
      ],
      nestedCommand:
        "tp @s ~1 ~ ^2",
    });
  });
});
}

// Original suite: engine/analyzers/commands/test/runtime-evidence.test.ts (blob a8b122c3f703a198273d090064a0d07df9992260)
{


const source = { artifactId: "a", relativePath: "functions/test.mcfunction" };

describe("command runtime evidence", () => {
  it("emits entity spawn request evidence", () => {
    const records = commandRuntimeEvidence(
      analyzeCommand(
        "summon minecraft:zombie 1 64 2",
        { artifactId: "a", relativePath: "functions/test.mcfunction" },
      ),
    );

    expect(records).toEqual(expect.arrayContaining([
      expect.objectContaining({
        predicate: "entity-spawn-request",
        state: "present",
      }),
    ]));
  });

  it("emits structure mutation predicates conservatively", () => {
    const analysis = analyzeCommand(
      "structure load arena 0 64 0 0_degrees none layer_by_layer 2 true true false 50",
      source,
    );
    const records = commandRuntimeEvidence(analysis);
    const predicates = records.map((record) => record.predicate);
    expect(predicates).toContain("structure-placement-request");
    expect(predicates).toContain("world-mutation-request");
    expect(predicates).toContain("animated-structure-load");
    expect(predicates).toContain("partial-integrity-structure-load");
    expect(records.find((r) => r.predicate === "structure-entities-included")?.state)
      .toBe("present");
    expect(predicates).not.toContain("post-placement-readiness-verification");
  });

  it("emits block and teleport intent without inventing runtime success", () => {
    const fill = commandRuntimeEvidence(analyzeCommand("fill 0 0 0 1 1 1 stone", source));
    expect(fill.map((r) => r.predicate)).toEqual(expect.arrayContaining([
      "block-write", "world-mutation-request",
    ]));

    const tp = commandRuntimeEvidence(analyzeCommand("tp @s 1 2 3", source));
    expect(tp.map((r) => r.predicate)).toEqual(expect.arrayContaining([
      "teleport-destination", "teleport-apply-request",
    ]));
    expect(tp.map((r) => r.predicate)).not.toContain("verified-location");
  });
});
}

// Original suite: engine/analyzers/commands/test/schedule-semantics.test.ts (blob 65b15a9baef7541bc2ba6bf5e257d65bea1d76ec)
{


describe("schedule on_area_loaded semantics", () => {
  it("parses ticking-area scheduling", () => {
    expect(parseScheduleAreaLoadedSemantics(
      "schedule on_area_loaded tickingarea arena_logic demo:boot",
    )).toEqual({
      kind: "tickingarea",
      tickingAreaName: "arena_logic",
      functionName: "demo:boot",
    });
  });

  it("parses rectangle scheduling", () => {
    expect(parseScheduleAreaLoadedSemantics(
      "schedule on_area_loaded add 0 60 0 31 80 31 demo:boot",
    )).toEqual({
      kind: "rectangle",
      from: {
        x: { mode: "absolute", value: 0 },
        y: { mode: "absolute", value: 60 },
        z: { mode: "absolute", value: 0 },
      },
      to: {
        x: { mode: "absolute", value: 31 },
        y: { mode: "absolute", value: 80 },
        z: { mode: "absolute", value: 31 },
      },
      functionName: "demo:boot",
    });
  });

  it("retains legacy position scheduling", () => {
    expect(parseScheduleAreaLoadedSemantics(
      "schedule on_area_loaded add 0 64 0 demo:boot",
    )).toMatchObject({
      kind: "position",
      functionName: "demo:boot",
    });
  });
});
}

// Original suite: engine/analyzers/commands/test/verification-semantics.test.ts (blob 50bfcd3a00b7a50f343264dbda5398811838a8de)
{


describe("block verification semantics", () => {
  it("does not treat standalone testforblock as a gameplay gate", () => {
    expect(parseBlockVerificationSemantics(
      "testforblock 1 64 1 minecraft:gold_block",
    )).toMatchObject({
      mechanism: "testforblock",
      gatesDependentCommand: false,
      expectedBlock: "minecraft:gold_block",
    });
  });

  it("recognizes execute-if-block with run as a gated verification", () => {
    expect(parseBlockVerificationSemantics(
      "execute if block 1 64 1 minecraft:gold_block run function demo:start",
    )).toMatchObject({
      mechanism: "execute-if-block",
      gatesDependentCommand: true,
      expectedBlock: "minecraft:gold_block",
    });
  });
});
}
