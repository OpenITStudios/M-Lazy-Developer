// Owner-local source consolidation. Original cases are preserved verbatim.
import { describe, expect, it } from "vitest";
import { parseMcFunction } from "../src/parse.js";
import { functionRuntimeEvidence } from "../src/index.js";

// Original engine/analyzers/functions/test/parse.test.ts [bc2fc8e00389d6123b090ac9e8a41d9feb24c197]
{
describe("parseMcFunction", () => {
  const source = { artifactId: "art_demo", relativePath: "functions/game/start.mcfunction" };

  it("extracts function, structure, scoreboard and tag references", () => {
    const parsed = parseMcFunction(
      "game/start",
      [
        "# comment",
        "function game/reset",
        "structure load arena:tier1 0 0 0",
        "scoreboard players add @p game_state 1",
        "execute as @a[scores={wave=1..}] run say hi",
        "tag @p add active",
      ].join("\n"),
      source,
    );

    expect(parsed.references.map((ref) => ref.kind)).toEqual([
      "function",
      "structure",
      "scoreboard-write",
      "scoreboard-read",
      "tag-write",
    ]);
    expect(parsed.references[0]?.source.range?.lineStart).toBe(2);
  });
});
}

// Original engine/analyzers/functions/test/runtime-evidence.test.ts [849c71a68d1a04c4d080b1fdc71c041b2fbc6cbd]
{
describe("function runtime evidence", () => {
  it("aggregates command evidence and preserves line provenance", () => {
    const fn = parseMcFunction(
      "test:arena",
      "structure load test:arena 0 64 0\nfill 0 0 0 1 1 1 stone",
      { artifactId: "a", relativePath: "functions/arena.mcfunction" },
    );
    const records = functionRuntimeEvidence(fn);
    expect(records.some((record) => record.predicate === "mcfunction")).toBe(true);
    const structure = records.find((record) => record.predicate === "structure-placement-request");
    expect(structure?.sourceRefs?.[0]?.range?.lineStart).toBe(1);
    const blockWrite = records.find((record) => record.predicate === "block-write");
    expect(blockWrite?.sourceRefs?.[0]?.range?.lineStart).toBe(2);
  });
});
}
