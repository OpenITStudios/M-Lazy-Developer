import { describe, expect, it } from "vitest";
import { deriveArenaAuthoredSpatialSources } from "../../src/arena/arena-authored-source-index.js";

describe("arena authored spatial source index", () => {
  it("indexes command and structure placement source locations", () => {
    const result =
      deriveArenaAuthoredSpatialSources({
        topology: {
          spatialRecords: [{
            effect: {
              kind: "setblock",
              position: {
                x: { mode: "absolute", value: 5 },
                y: { mode: "absolute", value: 1 },
                z: { mode: "absolute", value: 5 },
              },
              block: "minecraft:stone",
              source: {
                artifactId: "fixture",
                relativePath: "functions/setup.mcfunction",
                range: {
                  lineStart: 3,
                  lineEnd: 3,
                },
              },
            },
            resolved: {
              kind: "setblock",
              position: { x: 5, y: 1, z: 5 },
              block: "minecraft:stone",
              sourcePath:
                "functions/setup.mcfunction",
            },
            rawCommand:
              "setblock 5 1 5 stone",
            directTopLevel: true,
          }],
        } as any,
        scripts: [],
        scriptSpatial: {
          resolvedEffects: [],
          resolvedEffectSources: [],
          structurePlacements: [],
          failures: [],
          extractedMutations: 0,
          rejectedMutations: 0,
        },
        structurePlacements: [{
          target: "arena/base",
          position: { x: 10, y: 0, z: 10 },
          functionId: "setup",
          line: 8,
        }],
        functionSources: {
          setup: {
            artifactId: "fixture",
            relativePath:
              "functions/setup.mcfunction",
          },
        },
      });

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "setblock",
          volume: {
            min: { x: 5, y: 1, z: 5 },
            max: { x: 5, y: 1, z: 5 },
          },
        }),
        expect.objectContaining({
          kind: "structure-load",
          source: expect.objectContaining({
            range: {
              lineStart: 8,
              lineEnd: 8,
            },
          }),
        }),
      ]),
    );
  });
});
