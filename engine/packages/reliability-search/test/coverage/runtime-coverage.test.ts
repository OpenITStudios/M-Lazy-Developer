import { describe, expect, it } from "vitest";
import {
  RuntimeDivergenceCorpus,
  runtimeDivergenceCoverage,
} from "../../src/index.js";

describe("runtime divergence coverage", () => {
  it("turns divergence classes, invariant violations and unknowns into semantic features", () => {
    const comparison = {
      ok: false,
      unknowns: ["arena:arena2:cutscene-unknown"],
      invariantViolations: [{
        invariantId: "multiplayer.state-isolation",
        message: "shared state",
      }],
      divergences: [{
        kind: "arena-state" as const,
        arenaId: "arena2",
        message: "diverged",
      }],
    };

    const signature = runtimeDivergenceCoverage(comparison);

    expect(signature.features).toEqual(expect.arrayContaining([
      { dimension: "divergence", key: "arena-state:arena=arena2" },
      { dimension: "divergence", key: "unknown:arena:arena2:cutscene-unknown" },
      { dimension: "invariant", key: "multiplayer.state-isolation" },
    ]));
  });

  it("retains novel runtime divergence signatures in a dedicated corpus", () => {
    const corpus = new RuntimeDivergenceCorpus();
    const snapshot = {
      schemaVersion: 1 as const,
      tick: 102,
      players: [],
      arenas: [],
    };
    const comparison = {
      ok: false,
      unknowns: [],
      invariantViolations: [],
      divergences: [{
        kind: "missing-arena" as const,
        arenaId: "arena2",
        message: "missing",
      }],
    };

    const first = corpus.add({
      scenarioId: "s",
      runtimeTick: 102,
      snapshot,
      comparison,
    });
    const second = corpus.add({
      scenarioId: "s",
      runtimeTick: 103,
      snapshot: { ...snapshot, tick: 103 },
      comparison,
    });

    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(corpus.coverage().features).toContainEqual({
      dimension: "divergence",
      key: "missing-arena:arena=arena2",
    });
  });
});
