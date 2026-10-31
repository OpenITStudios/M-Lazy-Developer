// Source-preserving consolidation: original test cases remain in isolated lexical blocks.
import { describe, expect, it } from "vitest";
import { mineInvariantEvidence, assessInvariantFalsification, draftInvariantPromotion, challengeMinedInvariants, mineRuntimeInvariants, createInvariantRevalidationTasks, summarizeCrossMapInvariantEvidence } from "../../src/index.js";
import type { CampaignHistoryRecord, MinedInvariantCandidate } from "../../src/index.js";

// Consolidated suite from engine/packages/reliability-search/test/invariant/invariant-coverage-confidence.test.ts
{
function snapshot(tick: number) {
  return {
    schemaVersion: 1 as const,
    tick,
    minecraftVersion: "1.26.40",
    players: [{
      playerId: "p1",
      connected: true,
      arenaId: "arena1",
      phase: "starting" as const,
      progress: tick,
    }],
    arenas: [{
      arenaId: "arena1",
      activePlayerIds: ["p1"],
      cutsceneActive: true,
      round: 0,
    }],
  };
}

describe("invariant coverage confidence", () => {
  it("does not turn state diversity into fake coverage diversity when coverage is absent", () => {
    const result = mineInvariantEvidence(
      [snapshot(1), snapshot(2), snapshot(3), snapshot(4)].map((item) => ({
        snapshot: item,
        mapId: "map-a",
      })),
      {
        minAntecedentMatches: 2,
        minConfidence: 1,
        minDistinctStates: 2,
        minDistinctCoverageBuckets: 2,
      },
    );

    expect(result.distinctStates).toBeGreaterThan(1);
    expect(result.distinctCoverageBuckets).toBe(1);
    expect(result.candidates.some((item) => item.status === "supported")).toBe(false);
  });
});
}

// Consolidated suite from engine/packages/reliability-search/test/invariant/invariant-falsification.test.ts
{
const candidate: MinedInvariantCandidate = {
  id: "candidate-cutscene",
  kind: "arena-cutscene-implies-starting-player",
  description: "Cutscene requires a starting player.",
  minecraftVersions: ["1.26.40"],
  mapIds: ["map-a"],
  support: {
    observations: 30,
    distinctStates: 5,
    distinctCoverageBuckets: 5,
    distinctMaps: 1,
    distinctVersions: 1,
    antecedentMatches: 30,
    satisfied: 30,
    counterexamples: 0,
    confidence: 1,
  },
  status: "supported",
  evidence: ["e:1"],
  counterexampleEvidence: [],
  challengeEvidence: [],
};

function campaign(
  status: "killed" | "survived",
): CampaignHistoryRecord {
  return {
    schemaVersion: 1,
    campaignId: "campaign-1",
    createdAt: "2026-09-27T00:00:00Z",
    blindspotTasks: [],
    mutationReport: {
      total: 1,
      killed: status === "killed" ? 1 : 0,
      survived: status === "survived" ? 1 : 0,
      invalid: 0,
      score: status === "killed" ? 1 : 0,
      byDomain: {},
      results: [{
        descriptor: {
          id: "mutation-1",
          operator: "shared-cutscene-lock",
          domain: "state-concurrency",
          description: "Adversarial shared lock mutation.",
        },
        status,
      }],
    },
  };
}

describe("invariant adversarial promotion gate", () => {
  it("blocks supported candidates that were never adversarially exercised", () => {
    const receipt = assessInvariantFalsification(
      candidate,
      {},
    );

    expect(receipt.disposition)
      .toBe("insufficient");
    expect(
      draftInvariantPromotion(
        candidate,
        receipt,
      ).eligible,
    ).toBe(false);
  });

  it("permits drafting only after a relevant mutation is killed", () => {
    const receipt = assessInvariantFalsification(
      candidate,
      {
        campaignHistory: [
          campaign("killed"),
        ],
      },
    );

    expect(receipt.disposition)
      .toBe("passed");
    expect(
      draftInvariantPromotion(
        candidate,
        receipt,
      ),
    ).toMatchObject({
      eligible: true,
      invariant: {
        tags: expect.arrayContaining([
          "adversarially-falsified",
        ]),
      },
    });
  });

  it("fails qualification when a relevant adversarial mutation survives", () => {
    const receipt = assessInvariantFalsification(
      candidate,
      {
        campaignHistory: [
          campaign("survived"),
        ],
      },
    );

    expect(receipt.disposition)
      .toBe("failed");
    expect(
      receipt.survivedMutationOperators,
    ).toContain("shared-cutscene-lock");
    expect(
      draftInvariantPromotion(
        candidate,
        receipt,
      ).eligible,
    ).toBe(false);
  });

  it("fails qualification when historical evidence contradicts the candidate", () => {
    const receipt = assessInvariantFalsification(
      candidate,
      {
        campaignHistory: [
          campaign("killed"),
        ],
        historicalFailures: [{
          schemaVersion: 1,
          tick: 100,
          players: [{
            playerId: "p1",
            connected: true,
            arenaId: "arena1",
            phase: "playing",
            progress: 0,
          }],
          arenas: [{
            arenaId: "arena1",
            activePlayerIds: ["p1"],
            cutsceneActive: true,
            round: 0,
          }],
        }],
      },
    );

    expect(receipt.disposition)
      .toBe("failed");
    expect(
      receipt.contradictionEvidence.length,
    ).toBeGreaterThan(0);
  });
});
}

// Consolidated suite from engine/packages/reliability-search/test/invariant/invariant-mining-advanced.test.ts
{
function snapshot(
  tick: number,
  phase: "assigned" | "starting" | "playing",
  progress: number,
) {
  return {
    schemaVersion: 1 as const,
    tick,
    minecraftVersion: "1.26.40",
    players: [{
      playerId: "p1",
      connected: true,
      arenaId: "arena1",
      phase,
      progress,
      tags: ["arena:arena1", "role:runner"],
      scores: { stage: progress + 1 },
    }],
    arenas: [{
      arenaId: "arena1",
      activePlayerIds: ["p1"],
      cutsceneActive: phase === "starting",
      round: 1,
    }],
    entities: [{
      entityId: `z${tick}`,
      typeId: "minecraft:zombie",
      dimension: "overworld",
      arenaId: "arena1",
      tags: ["arena:arena1"],
      position: { x: tick, y: 10, z: 5 },
      alive: true,
    }],
  };
}

describe("advanced invariant mining", () => {
  it("does not treat repeated identical snapshots as independent support", () => {
    const repeated = Array.from({ length: 30 }, () => snapshot(1, "starting", 0));
    const result = mineRuntimeInvariants(repeated, {
      minAntecedentMatches: 20,
      minConfidence: 1,
      minDistinctStates: 3,
    });

    const cutscene = result.candidates.find((item) =>
      item.kind === "arena-cutscene-implies-starting-player",
    );
    expect(cutscene?.status).toBe("candidate");
    expect(cutscene?.support.distinctStates).toBe(1);
  });

  it("mines tag-score, entity arena and spatial candidates with diverse evidence", () => {
    const snapshots = [
      snapshot(1, "assigned", 0),
      snapshot(2, "starting", 0),
      snapshot(3, "playing", 1),
      snapshot(4, "playing", 2),
      snapshot(5, "playing", 3),
    ];

    const result = mineRuntimeInvariants(snapshots, {
      minAntecedentMatches: 2,
      minConfidence: 1,
      minDistinctStates: 2,
      tagScoreRelations: [{
        tag: "role:runner",
        objective: "stage",
        relation: "nonzero",
      }],
      arenaRegions: [{
        arenaId: "arena1",
        dimension: "overworld",
        min: { x: 0, y: 0, z: 0 },
        max: { x: 10, y: 20, z: 10 },
      }],
    });

    expect(result.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "player-tag-implies-score", status: "supported" }),
      expect.objectContaining({ kind: "entity-arena-tag-consistency", status: "supported" }),
      expect.objectContaining({ kind: "entity-within-arena-region", status: "supported" }),
      expect.objectContaining({ kind: "playing-progress-nondecreasing", status: "supported" }),
    ]));
  });

  it("marks a previously supported candidate stale on an unseen Minecraft version", () => {
    const result = mineRuntimeInvariants(
      [
        snapshot(1, "assigned", 0),
        snapshot(2, "starting", 0),
        snapshot(3, "playing", 1),
      ],
      {
        minAntecedentMatches: 2,
        minConfidence: 1,
        minDistinctStates: 2,
      },
    );

    const challenged = challengeMinedInvariants(result.candidates, {
      currentMinecraftVersion: "1.27.0",
    });

    expect(challenged.some((item) => item.status === "stale")).toBe(true);
  });
});
}

// Consolidated suite from engine/packages/reliability-search/test/invariant/invariant-mining.test.ts
{
function goodSnapshot(tick: number) {
  return {
    schemaVersion: 1 as const,
    tick,
    players: [
      {
        playerId: "p1",
        connected: true,
        arenaId: "arena1",
        phase: "starting" as const,
        progress: 0,
      },
    ],
    arenas: [
      {
        arenaId: "arena1",
        activePlayerIds: ["p1"],
        cutsceneActive: true,
        round: 0,
      },
    ],
  };
}

describe("dynamic invariant mining", () => {
  it("mines supported candidates only after minimum support is reached", () => {
    const result = mineRuntimeInvariants(
      Array.from({ length: 25 }, (_, index) => goodSnapshot(index)),
      {
        minAntecedentMatches: 20,
        minConfidence: 1,
        minDistinctStates: 1,
      },
    );

    const cutscene = result.candidates.find((item) =>
      item.kind === "arena-cutscene-implies-starting-player",
    );
    expect(cutscene).toMatchObject({
      status: "supported",
      support: {
        antecedentMatches: 25,
        counterexamples: 0,
        confidence: 1,
      },
    });
  });

  it("rejects a candidate contradicted by known-good evidence", () => {
    const snapshots = [
      goodSnapshot(1),
      {
        schemaVersion: 1 as const,
        tick: 2,
        players: [{
          playerId: "p1",
          connected: true,
          phase: "playing" as const,
          progress: 0,
        }],
        arenas: [],
      },
    ];

    const result = mineRuntimeInvariants(
      snapshots,
      { minAntecedentMatches: 1, minConfidence: 1, minDistinctStates: 1 },
    );

    expect(result.rejected.some((item) =>
      item.kind === "player-phase-implies-arena",
    )).toBe(true);
  });

  it("challenges supported candidates using historical failures and mutation survivors", () => {
    const mined = mineRuntimeInvariants(
      Array.from({ length: 3 }, (_, index) => goodSnapshot(index)),
      { minAntecedentMatches: 1, minConfidence: 1, minDistinctStates: 1 },
    );

    const challenged = challengeMinedInvariants(
      mined.candidates,
      {
        historicalFailures: [{
          schemaVersion: 1,
          tick: 100,
          players: [{
            playerId: "p1",
            connected: true,
            arenaId: "arena1",
            phase: "playing",
            progress: 0,
          }],
          arenas: [{
            arenaId: "arena1",
            activePlayerIds: ["p1"],
            cutsceneActive: true,
            round: 0,
          }],
        }],
        campaignHistory: [{
          schemaVersion: 1,
          campaignId: "c1",
          createdAt: "2026-09-23T00:00:00Z",
          blindspotTasks: [],
          mutationReport: {
            total: 1,
            killed: 0,
            survived: 1,
            invalid: 0,
            score: 0,
            byDomain: {},
            results: [{
              descriptor: {
                id: "m1",
                operator: "shared-cutscene-lock",
                domain: "state-concurrency",
                description: "shared",
              },
              status: "survived",
            }],
          },
        }],
      },
    );

    const cutscene = challenged.find((item) =>
      item.kind === "arena-cutscene-implies-starting-player",
    );
    expect(cutscene?.status).toBe("challenged");
    expect(cutscene?.challengeEvidence.length).toBeGreaterThan(0);
    expect(draftInvariantPromotion(cutscene!).eligible).toBe(false);
  });
});
}

// Consolidated suite from engine/packages/reliability-search/test/invariant/invariant-refinement.test.ts
{
function evidence(tick: number, mapId: string) {
  return {
    mapId,
    coverage: { features: [{ dimension: "interaction" as const, key: "bucket-" + tick }] },
    snapshot: {
      schemaVersion: 1 as const,
      tick,
      minecraftVersion: "1.26.40",
      players: [{
        playerId: "p1",
        connected: true,
        arenaId: "arena1",
        phase: tick % 2 ? "starting" as const : "playing" as const,
        progress: tick,
      }],
      arenas: [{
        arenaId: "arena1",
        activePlayerIds: ["p1"],
        cutsceneActive: tick % 2 === 1,
        round: tick % 3,
      }],
    },
  };
}

describe("invariant refinement", () => {
  it("requires coverage and map diversity", () => {
    const result = mineInvariantEvidence([
      evidence(1, "map-a"), evidence(2, "map-a"),
      evidence(3, "map-b"), evidence(4, "map-b"),
    ], {
      minAntecedentMatches: 2,
      minConfidence: 1,
      minDistinctStates: 2,
      minDistinctCoverageBuckets: 3,
      minDistinctMaps: 2,
    });

    expect(result.distinctMaps).toBe(2);
    expect(result.distinctCoverageBuckets).toBe(4);
    expect(result.candidates.some((item) => item.status === "supported")).toBe(true);
  });

  it("summarizes cross-map contradiction", () => {
    const base = {
      description: "x",
      minecraftVersions: ["1.26.40"],
      support: {
        observations: 5, distinctStates: 2, distinctCoverageBuckets: 2,
        distinctMaps: 1, distinctVersions: 1, antecedentMatches: 5,
        satisfied: 5, counterexamples: 0, confidence: 1,
      },
      evidence: [], counterexampleEvidence: [], challengeEvidence: [],
    };

    const summary = summarizeCrossMapInvariantEvidence([
      { mapId: "map-a", candidates: [{ ...base, id: "a", mapIds: ["map-a"], kind: "player-phase-implies-connected" as const, status: "supported" as const }] },
      { mapId: "map-b", candidates: [{ ...base, id: "b", mapIds: ["map-b"], kind: "player-phase-implies-connected" as const, status: "rejected" as const }] },
    ]);

    expect(summary[0]).toMatchObject({
      supportingMaps: ["map-a"],
      rejectedMaps: ["map-b"],
      totalMaps: 2,
    });
  });

  it("queues revalidation on related update delta", () => {
    const candidate = {
      id: "cutscene",
      kind: "arena-cutscene-implies-starting-player" as const,
      description: "x",
      minecraftVersions: ["1.26.30"],
      mapIds: ["map-a"],
      support: {
        observations: 20, distinctStates: 4, distinctCoverageBuckets: 4,
        distinctMaps: 1, distinctVersions: 1, antecedentMatches: 20,
        satisfied: 20, counterexamples: 0, confidence: 1,
      },
      status: "supported" as const,
      evidence: [], counterexampleEvidence: [], challengeEvidence: [],
    };
    const tasks = createInvariantRevalidationTasks([candidate], {
      fromVersion: "1.26.30",
      toVersion: "1.26.40",
      entries: [{
        id: "state-change",
        kind: "behavior-changed",
        domain: "multiplayer",
        capabilityTags: ["gameplay-state"],
        affectedIdentifiers: [],
        summary: "state behavior changed",
        source: "fixture",
        confidence: "documented",
      }],
    });

    expect(tasks[0]).toMatchObject({ candidateId: "cutscene", priority: "P0" });
  });
});
}
