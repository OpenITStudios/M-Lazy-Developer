// Consolidated same-owner, same-feature, same-lane test family.
// Original cases/assertions preserved; this is NOT executed test proof.
import { describe, expect, it } from "vitest";
import { buildArenaGoldenBaselineCandidate } from "../../src/arena/arena-golden-baseline.js";
import { assertArenaGoldenApprovals, evaluateArenaGoldenAssertions, parseArenaGoldenManifest } from "../../src/arena/arena-golden-corpus.js";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { inspectArenaGoldenCorpusStatus } from "../../src/arena/arena-golden-status.js";

// Original suite: engine/packages/orchestrator/test/arena/arena-golden-baseline.test.ts (Git blob 2ea230cab2e47c5f266d9a902cb9f3a2b96a03a8)
{


describe("arena golden baseline candidate", () => {
  it("warns instead of accepting identity drift as a baseline", () => {
    const result =
      buildArenaGoldenBaselineCandidate(
        {
          arenaAnalysis: {
            autoDetected: true,
            proofExecution: {
              mode: "full",
              decisions: [],
              executedLayers: [],
              skippedLayers: [],
            },
            lifecycle: {
              terminalCandidates: 0,
              proven: 0,
              partial: 0,
              unresolved: 0,
              assessments: [],
            },
          },
          diagnostics: [{
            id: "drift",
            code: "PACK_IDENTITY_DRIFT",
            severity: "medium",
            message: "drift",
          }],
          releaseIdentity: {
            status: "consistent",
            observations: [],
            conflicts: [],
          },
        } as any,
        {
          id: "map-a",
          label: "Map A",
          artifactFile: "maps/a.mcworld",
        },
      );

    expect(
      result.case.assertions
        .requirePackIdentityDrift,
    ).toBe(false);
    expect(
      result.warnings.join(" "),
    ).toMatch(/PACK_IDENTITY_DRIFT/);
    expect(result.approvalRequired)
      .toBe(true);
  });
});
}

// Original suite: engine/packages/orchestrator/test/arena/arena-golden-corpus.test.ts (Git blob 28d8986bee70c2704cfc857babbbb6a384b229c5)
{


describe("arena golden corpus", () => {
  it("validates focused arena assertions without snapshotting raw inspection output", () => {
    const failures = evaluateArenaGoldenAssertions(
      {
        arenaCount: 6,
        detectionBasis: "reconciled",
        layoutStatus: "consistent",
        proofConclusion: "bounded-proof",
        coverageRatio: 0.8,
        capacityOk: true,
        packIdentityDrift: false,
        releaseStatus: "consistent",
        replicaStatuses: {
          "arena-2": "bounded-proof",
        },
        lifecycleUnresolved: 0,
        cleanupUnresolved: 0,
        sharedGlobalState: 0,
        partitionProofRequired: 0,
        globalStateUnleased: 0,
        globalStateUnaudited: 0,
        repairLocalizationUnresolved: 0,
        stressStatus: "planned",
      },
      {
        arenaCount: 6,
        layoutStatus: "consistent",
        proofConclusion: "bounded-proof",
        minCoverageRatio: 0.75,
        capacityOk: true,
        requirePackIdentityDrift: false,
        releaseStatus: "consistent",
        replicaStatuses: {
          "arena-2": "bounded-proof",
        },
      },
    );

    expect(failures).toEqual([]);
  });

  it("evaluates lifecycle cleanup isolation stress and fidelity assertions", () => {
    const failures = evaluateArenaGoldenAssertions(
      {
        arenaCount: 6,
        detectionBasis: "topology",
        proofConclusion: "bounded-proof",
        packIdentityDrift: false,
        releaseStatus: "consistent",
        replicaStatuses: {},
        lifecycleUnresolved: 0,
        cleanupUnresolved: 1,
        sharedGlobalState: 0,
        partitionProofRequired: 1,
        globalStateUnleased: 0,
        globalStateUnaudited: 0,
        repairLocalizationUnresolved: 0,
        stressStatus: "planned",
        nominalStressPlayers: 30,
        voxelStatus: "verified",
        blockEntityStatus: "verified",
        entityPopulationStatus: "verified",
        tickStateStatus: "incomplete",
        structureInstanceStatus: "verified",
      },
      {
        maxLifecycleUnresolved: 0,
        maxCleanupUnresolved: 1,
        maxSharedGlobalState: 0,
        maxPartitionProofRequired: 1,
        stressStatus: "planned",
        nominalStressPlayers: 30,
        voxelStatus: "verified",
        blockEntityStatus: "verified",
        entityPopulationStatus: "verified",
        tickStateStatus: "incomplete",
        structureInstanceStatus: "verified",
      },
    );

    expect(failures).toEqual([]);
  });

  it("blocks approval-required corpus before expensive execution", () => {
    expect(() =>
      assertArenaGoldenApprovals({
        schemaVersion: 1,
        id: "production",
        requireApproval: true,
        cases: [{
          id: "map-a",
          label: "Map A",
          artifactFile: "a.mcworld",
          assertions: {},
        }],
      }),
    ).toThrow(/Missing approval/);
  });

  it("accepts explicitly approved production cases", () => {
    expect(() =>
      assertArenaGoldenApprovals({
        schemaVersion: 1,
        id: "production",
        requireApproval: true,
        cases: [{
          id: "map-a",
          label: "Map A",
          artifactFile: "a.mcworld",
          assertions: {},
          approval: {
            status: "approved",
            approvedBy: "qa",
            approvedAt:
              "2026-09-30T00:00:00Z",
          },
        }],
      }),
    ).not.toThrow();
  });

  it("rejects unknown assertion keys", () => {
    expect(() =>
      parseArenaGoldenManifest({
        schemaVersion: 1,
        id: "arena-corpus",
        cases: [{
          id: "map",
          label: "Map",
          artifactFile: "map.mcworld",
          assertions: {
            somethingElse: true,
          },
        }],
      }),
    ).toThrow(/unsupported assertion/);
  });
});
}

// Original suite: engine/packages/orchestrator/test/arena/arena-golden-status.test.ts (Git blob 71af075e6d93be389482681e992ed4e97777e0de)
{


describe("arena golden corpus status", () => {
  it("preflights approvals and artifact paths without inspecting worlds", async () => {
    const root =
      await mkdtemp(
        join(
          tmpdir(),
          "arena-corpus-status-",
        ),
      );
    await writeFile(
      join(root, "a.mcworld"),
      "fixture",
    );

    const result =
      await inspectArenaGoldenCorpusStatus(
        {
          schemaVersion: 1,
          id: "production",
          requireApproval: true,
          cases: [{
            id: "a",
            label: "A",
            artifactFile:
              "a.mcworld",
            assertions: {},
          }, {
            id: "b",
            label: "B",
            artifactFile:
              "missing.mcworld",
            assertions: {},
            approval: {
              status: "approved",
              approvedBy: "qa",
              approvedAt:
                "2026-09-30T00:00:00Z",
            },
          }],
        },
        root,
      );

    expect(
      result.cases[0]?.readiness,
    ).toBe("unapproved");
    expect(
      result.cases[1]?.readiness,
    ).toBe("missing-artifact");
    expect(result.ready).toBe(0);
    expect(result.blocked).toBe(2);
  });
});
}
