import { describe, expect, it } from "vitest";
import { derivePostRepairValidationObligations } from "../../src/repair/post-repair-validation-obligations.js";

function result(
  overrides: Record<string, unknown> = {},
) {
  return {
    diagnostics: [],
    arenaAnalysis: {
      cleanupSurfaces: {
        acquiredSurfaces: 0,
        terminalAssessments: [],
        exactProven: 0,
        partial: 0,
        unresolved: 0,
      },
      lifecycle: {
        terminalCandidates: 0,
        proven: 0,
        partial: 0,
        unresolved: 0,
        assessments: [],
      },
      stateIsolation: {
        arenaRegions: 0,
        observations: [],
        isolated: 0,
        partitionProofRequired: 0,
        sharedGlobal: 0,
        unknown: 0,
      },
      repairBridge: {
        items: [],
        deterministicRepairs: 0,
        proposalOnly: 0,
        unresolved: 0,
      },
    },
    ...overrides,
  } as any;
}

describe("post repair validation obligations", () => {
  it("requires repeated-run proof after cleanup uncertainty is reduced", () => {
    const before = result({
      arenaAnalysis: {
        ...result().arenaAnalysis,
        cleanupSurfaces: {
          ...result().arenaAnalysis
            .cleanupSurfaces,
          unresolved: 2,
        },
      },
    });
    const after = result();

    const obligations =
      derivePostRepairValidationObligations(
        before,
        after,
        {
          schemaVersion: 1,
          assessments: [],
          reusableLayers: [],
          staleLayers: [],
          blockedLayers: [],
        },
      );

    expect(
      obligations
        .repeatedRunValidationRequired,
    ).toBe(true);
  });

  it("requires full proof when physical dependency reuse is blocked", () => {
    const obligations =
      derivePostRepairValidationObligations(
        result(),
        result(),
        {
          schemaVersion: 1,
          assessments: [{
            layer: "voxel",
            status: "blocked",
            reason: "truncated",
          }],
          reusableLayers: [],
          staleLayers: [],
          blockedLayers: ["voxel"],
        },
      );

    expect(
      obligations.fullArenaProofRequired,
    ).toBe(true);
  });
});
