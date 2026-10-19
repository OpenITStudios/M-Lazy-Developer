import { describe, expect, it } from "vitest";
import { verifyPostRepairOutcome } from "../../src/repair/post-repair-verification.js";

function inspection(
  overrides: Record<string, unknown> = {},
) {
  return {
    fingerprint: "before",
    diagnostics: [],
    unresolvedReferences: 0,
    releaseIdentity: {
      status: "consistent",
      observations: [],
      conflicts: [],
    },
    arenaAnalysis: {
      proofExecution: {
        mode: "full",
      },
      proofConclusion: {
        conclusion: "complete-proof",
      },
      spatialLayout: {
        basis: "topology",
        canonical: {
          arenaId: "fixture-arena",
          anchor: { x: 0, y: 0, z: 0 },
        },
        replicas: [],
        offsets: [],
        confidence: "high",
      },
      regionPlan: {
        volumes: [{
          min: { x: 0, y: 0, z: 0 },
          max: { x: 15, y: 15, z: 15 },
        }],
        boundingBox: {
          min: { x: 0, y: 0, z: 0 },
          max: { x: 15, y: 15, z: 15 },
        },
        totalBlocks: 4096,
        evidenceCandidates: 1,
        mergeGapBlocks: 0,
        confidence: "high",
      },
      entitySpawnEvidence: [],
    },
    worldDatabase: {
      nativeScan: {
        status: "scanned",
        truncated: false,
        chunkSignalsTruncated: false,
        chunkContentObservationsTruncated: false,
        chunkContentObservations: [{
          dimensionId: 0,
          chunkX: 0,
          chunkZ: 0,
          kind: "SubChunk",
          subChunkIndex: 0,
          valueHash: "unchanged-voxel-content",
        }],
        actorRecords: 0,
        actorContentComplete: true,
      },
    },
    structureRuntime: {
      structurePlacements: [],
    },
    scriptSpatial: {
      structurePlacements: [],
    },
    gameplayWorld: {
      intent: {
        unknowns: [],
      },
    },
    evidenceRecovery: {
      actions: [],
    },
    ...overrides,
  } as any;
}

describe("post repair verification", () => {
  it("passes when targeted diagnostics are gone and no evidence regresses", () => {
    const before = inspection({
      diagnostics: [{
        id: "old",
        code: "ARENA_VOXEL_DIVERGENCE",
        severity: "critical",
        message: "old divergence",
      }],
    });
    const after = inspection({
      fingerprint: "after",
      diagnostics: [],
    });

    const result =
      verifyPostRepairOutcome({
        before,
        after,
        requiredResolvedDiagnosticCodes: [
          "ARENA_VOXEL_DIVERGENCE",
        ],
      });

    expect(result.status).toBe("pass");
    expect(result.differentialPass).toBe(true);
    expect(result.releaseReady).toBe(false);
    expect(result.closureRequired).toBe(true);
    expect(result.verificationReadiness.status)
      .toBe("VERIFIED_FIXED");
  });

  it("fails when repair introduces a new major diagnostic", () => {
    const before = inspection();
    const after = inspection({
      fingerprint: "after",
      diagnostics: [{
        id: "new",
        code: "WORLDSTATE_GLOBAL_LEASE_MISSING",
        severity: "medium",
        message: "new global-state defect",
      }],
    });

    const result =
      verifyPostRepairOutcome({
        before,
        after,
      });

    expect(result.status).toBe("fail");
    expect(result.releaseReady).toBe(false);
    expect(result.verificationReadiness.status)
      .toBe("REGRESSION_FOUND");
  });

  it("keeps progressive after-proof partial when before used full proof", () => {
    const before = inspection();
    const after = inspection({
      fingerprint: "after",
      arenaAnalysis: {
        proofExecution: {
          mode: "progressive",
        },
        proofConclusion: {
          conclusion: "bounded-proof",
        },
      },
    });

    const result =
      verifyPostRepairOutcome({
        before,
        after,
      });

    expect(result.status).toBe("partial");
    expect(
      result.followUps.join(" "),
    ).toMatch(/full arena proof/i);
    expect(result.verificationReadiness.status)
      .toBe("CONFIRMATION_REQUIRED");
  });
});
