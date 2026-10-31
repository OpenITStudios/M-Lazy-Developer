import { describe, expect, it } from "vitest";
import { analyzeCommand } from "../../commands/src/index.js";
import { resolveEffect } from "../src/effect-resolution.js";
import { compareExpectedTranslation } from "../src/outliers.js";
import type { ResolvedEffect } from "../src/effect-resolution.js";

const source = { artifactId: "fixture", relativePath: "functions/start.mcfunction" };
const context = { origin: { x: 0, y: 0, z: 0 } };

function fillEffect(command: string): ResolvedEffect {
  const analysis = analyzeCommand(command, source);
  const effect = analysis.effects[0]!;
  const resolved = resolveEffect(effect, context);
  if (!resolved) throw new Error("fixture effect must resolve");
  return resolved;
}

describe("topology regression flow", () => {
  it("shows broken then repaired arena translation", () => {
    const base = fillEffect("fill 0 0 0 3 2 3 stone");
    const broken = fillEffect("fill 298 0 0 301 2 3 stone");
    const repaired = fillEffect("fill 300 0 0 303 2 3 stone");

    expect(compareExpectedTranslation([base, broken], 0, 1, {x:300,y:0,z:0}).status).toBe("outlier");
    expect(compareExpectedTranslation([base, repaired], 0, 1, {x:300,y:0,z:0}).status).toBe("match");
  });
});
