import { describe, expect, it } from "vitest";
import { deriveScriptArenaLayoutFallback } from "../../src/arena/script-arena-layout-fallback.js";

describe("script arena layout fallback", () => {
  it("builds physical layout and authored region plan from absolute centers", () => {
    const result = deriveScriptArenaLayoutFallback(
      {
        compiledBindings: 1,
        rejectedBindings: 0,
        resolvedBindings: [],
        failedBindings: [],
        crossFileResolvedBindings: 0,
        arenaConcurrencyCandidates: [],
        arenaConcurrencyConflict: false,
        arenaCountCandidates: [],
        arenaLayoutCandidates: [],
        resolvedArenaCount: 2,
        resolvedArenaLayout: {
          mode: "absolute-centers",
          arenaCount: 2,
          canonicalAnchor: { x: 10, y: 50, z: 20 },
          offsets: [
            { x: 0, y: 0, z: 0 },
            { x: 100, y: 0, z: 0 },
          ],
          sourceNames: ["ARENA_CENTERS"],
        },
        arenaCountConflict: false,
        arenaLayoutConflict: false,
      },
      [{
        id: "build-plot",
        role: "mutable",
        coordinateSpace: "canonical-relative",
        volume: {
          min: { x: -5, y: 0, z: -5 },
          max: { x: 5, y: 20, z: 5 },
        },
      }],
    );

    expect(result?.layout.replicas[0]?.anchor)
      .toEqual({ x: 110, y: 50, z: 20 });
    expect(result?.regionClassification?.mutableVolumes)
      .toHaveLength(1);
  });

  it("refuses relative offsets without an absolute canonical anchor", () => {
    expect(
      deriveScriptArenaLayoutFallback({
        compiledBindings: 1,
        rejectedBindings: 0,
        resolvedBindings: [],
        failedBindings: [],
        crossFileResolvedBindings: 0,
        arenaConcurrencyCandidates: [],
        arenaConcurrencyConflict: false,
        arenaCountCandidates: [],
        arenaLayoutCandidates: [],
        resolvedArenaCount: 2,
        resolvedArenaLayout: {
          mode: "relative-offsets",
          arenaCount: 2,
          offsets: [
            { x: 0, y: 0, z: 0 },
            { x: 100, y: 0, z: 0 },
          ],
          sourceNames: ["ARENA_OFFSETS"],
        },
        arenaCountConflict: false,
        arenaLayoutConflict: false,
      }),
    ).toBeUndefined();
  });
});
