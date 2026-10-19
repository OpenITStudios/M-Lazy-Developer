import { describe, expect, it } from "vitest";
import {
  analyzeMultiplayerStaticRisks,
  analyzePendingWorldOperations,
  assessWorldReleaseState,
  proposeTickingAreaConsolidation,
} from "../../src/index.js";
import type { McStructureModel } from "../../../../adapters/mcstructure/src/index.js";
import { assessStructureTransitionResidue } from "../../src/inspection/structure-transition-residue.js";

describe("last-mile arena audit helpers", () => {
  it("finds a feasible ticking-area consolidation without guessing runtime state", () => {
    const result = proposeTickingAreaConsolidation({
      arenaAreas: [
        { id: "a", minX: 0, maxX: 15, minZ: 0, maxZ: 15 },
        { id: "b", minX: 16, maxX: 31, minZ: 0, maxZ: 15 },
        { id: "c", minX: 32, maxX: 47, minZ: 0, maxZ: 15 },
      ],
      permanentAreaCount: 2,
      globalAreaLimit: 10,
      targetConcurrentArenas: 5,
      maxChunksPerArea: 8,
    });

    expect(result).toMatchObject({
      status: "feasible",
      currentAreasPerArena: 3,
      currentSafeConcurrentArenas: 2,
      candidateAreasPerArena: 1,
      candidateSafeConcurrentArenas: 8,
      mergedChunkCount: 3,
    });
  });

  it("blocks unsafe release metadata deterministically", () => {
    const result = assessWorldReleaseState({
      experiments: {
        experimental_cameras: true,
        approved_feature: true,
      },
      allowedExperiments: ["approved_feature"],
      educationFeaturesEnabled: false,
      expectedEducationFeaturesEnabled: false,
      playerPermissionsLevel: 2,
      maximumDefaultPermissionLevel: 1,
      lastOpenedWithVersion: [1, 26, 20],
      minimumOpenedVersion: [1, 26, 40],
    });

    expect(result.releasable).toBe(false);
    expect(result.findings.map((item) => item.code)).toEqual([
      "WORLD_UNAPPROVED_EXPERIMENT",
      "WORLD_DEFAULT_PERMISSION_TOO_HIGH",
      "WORLD_OPENED_VERSION_TOO_OLD",
    ]);
  });

  it("promotes pending native operations to release-blocking residue", () => {
    const result = analyzePendingWorldOperations([
      { key: "chunk_loaded_request:12:4" },
      { key: "normal:key" },
    ]);

    expect(result).toMatchObject({
      status: "residue-detected",
      releaseBlocking: true,
    });
    expect(result.operations).toHaveLength(1);
  });

  it("detects active structure_void cells rather than palette presence alone", () => {
    const structure = {
      size: { x: 2, y: 1, z: 2 },
      palette: [
        { index: 0, name: "minecraft:stone", raw: {} },
        { index: 1, name: "minecraft:structure_void", raw: {} },
      ],
      blockIndexLayers: [
        { layer: 0, indices: [0, 1, 0, 1] },
      ],
      entities: [],
    } as unknown as McStructureModel;

    const result = assessStructureTransitionResidue(structure);

    expect(result.status).toBe("residue-risk");
    expect(result.voidCellCount).toBe(2);
    expect(result.samples).toEqual([
      { x: 1, y: 0, z: 0, layer: 0 },
      { x: 1, y: 0, z: 1, layer: 0 },
    ]);
  });

  it("uses cheap multiplayer lint only as a deterministic prefilter", () => {
    const result = analyzeMultiplayerStaticRisks(
      'const target = world.getPlayers()[0];\\nplayer.runCommand("@p");',
    );

    expect(result.major).toBeGreaterThanOrEqual(2);
    expect(result.risks.map((item) => item.code)).toContain(
      "MULTIPLAYER_FIRST_PLAYER_ASSUMPTION",
    );
    expect(result.risks.map((item) => item.code)).toContain(
      "NONDETERMINISTIC_PLAYER_SELECTOR",
    );
  });
});
