import { describe, expect, it } from "vitest";
import {
  BUILTIN_REPAIR_STRATEGY_SOURCES,
  validateRepairStrategySourceRegistry,
} from "../src/repair/repair-strategy-source-registry.js";

describe("arena repair strategy source coverage", () => {
  it("keeps physical arena divergence proposal-only until authored source is localized", () => {
    const source =
      BUILTIN_REPAIR_STRATEGY_SOURCES.sources.find(
        (item) =>
          item.id === "arena-replica-remediation",
      );

    expect(source).toMatchObject({
      selectionMode: "proposal-only",
      deterministic: false,
    });
    expect(source?.supportedDiagnosticCodes).toEqual(
      expect.arrayContaining([
        "ARENA_VOXEL_DIVERGENCE",
        "ARENA_BLOCK_ENTITY_DIVERGENCE",
        "ARENA_ENTITY_POPULATION_DIVERGENCE",
        "ARENA_TICK_STATE_DIVERGENCE",
        "ARENA_STRUCTURE_INSTANCE_DIVERGENCE",
      ]),
    );
  });

  it("keeps chunk lifecycle remediation proposal-only without requiring an unsafe deterministic mutation", () => {
    const source =
      BUILTIN_REPAIR_STRATEGY_SOURCES.sources.find(
        (item) =>
          item.id ===
          "chunk-lifecycle-remediation",
      );

    expect(source).toMatchObject({
      selectionMode: "proposal-only",
      deterministic: false,
      supportedDiagnosticCodes: [
        "CHUNK_LIFECYCLE_RUNTIME_RISK",
        "CHUNK_LIFECYCLE_SOURCE_RISK",
      ],
    });
  });

  it("keeps the built-in source registry valid", () => {
    expect(
      validateRepairStrategySourceRegistry(
        BUILTIN_REPAIR_STRATEGY_SOURCES,
      ),
    ).toEqual([]);
  });
});
