import { describe, expect, it } from "vitest";
import {
  arenaCapacityDiagnostics,
  solveArenaConcurrencyCapacity,
} from "../../src/arena/arena-capacity.js";

describe("arena concurrency capacity", () => {
  it("uses backend evidence instead of a universal ticking-area constant", () => {
    const report = solveArenaConcurrencyCapacity(5, [
      {
        id: "command-ticking-area",
        backend: "fixed-pool",
        total: 10,
        reserved: 2,
        perArena: 3,
      },
      {
        id: "script-manager",
        backend: "reported-capacity",
        reportedAvailable: 40,
        perArena: 4,
      },
    ]);

    expect(report.safeConcurrentArenas).toBe(2);
    expect(report.limitingResourceIds).toEqual(["command-ticking-area"]);
    expect(arenaCapacityDiagnostics(report)).toHaveLength(1);
  });

  it("does not invent a limit for unbounded or zero-cost resources", () => {
    const report = solveArenaConcurrencyCapacity(6, [
      { id: "player-slot-tag", backend: "unbounded", perArena: 1 },
      { id: "global-rule", backend: "fixed-pool", total: 1, perArena: 0 },
    ]);

    expect(report.ok).toBe(true);
    expect(report.safeConcurrentArenas).toBeNull();
  });
});
