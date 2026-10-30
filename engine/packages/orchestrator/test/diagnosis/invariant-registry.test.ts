// Coherent source-level test family; no coverage or runtime claim.
import { describe, expect, it } from "vitest";
import { buildInvariantIntelligence } from "../../src/diagnosis/invariant-intelligence.js";
import { type CompiledDiagnosticInvariant } from "../../../knowledge/src/index.js";
import { materializeInvariantRegistry } from "../../src/diagnosis/invariant-registry.js";

// Original source suite: engine/packages/orchestrator/test/diagnosis/invariant-intelligence.test.ts (Git blob 418bcd107e6ec4ee9014c3552b0824b565953066)
{


describe("invariant intelligence orchestration", () => {
  it("never auto-promotes challenged candidates", () => {
    const good = Array.from({ length: 5 }, (_, index) => ({
      schemaVersion: 1 as const,
      tick: index,
      players: [{
        playerId: "p1",
        connected: true,
        arenaId: "arena1",
        phase: "starting" as const,
        progress: 0,
      }],
      arenas: [{
        arenaId: "arena1",
        activePlayerIds: ["p1"],
        cutsceneActive: true,
        round: 0,
      }],
    }));

    const result = buildInvariantIntelligence({
      knownGoodSnapshots: good,
      historicalFailureSnapshots: [{
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
      options: {
        minAntecedentMatches: 3,
        minConfidence: 1,
        minDistinctStates: 1,
      },
    });

    const cutscene = result.candidates.find((item) =>
      item.candidate.kind === "arena-cutscene-implies-starting-player",
    );
    expect(cutscene?.candidate.status).toBe("challenged");
    expect(cutscene?.promotion.eligible).toBe(false);
  });
});
}

// Original source suite: engine/packages/orchestrator/test/diagnosis/invariant-registry.test.ts (Git blob c0b72ec0e3b1b1bf3cbdc19f745198cd1c252ebb)
{


function invariant(
  id: string,
  kind: CompiledDiagnosticInvariant["invariantKind"],
): CompiledDiagnosticInvariant {
  return {
    id,
    relationId: id,
    relationKind:
      kind === "temporal-order" ? "queues-behind" : "requires",
    invariantKind: kind,
    domain: "validation",
    subject: "after",
    object: "before",
    ...(kind === "temporal-order"
      ? {
          beforePredicate: "before",
          afterPredicate: "after",
        }
      : { expectedObjectState: "present" }),
    classification: "project-policy",
    knowledgeSourceIds: ["source"],
  };
}

describe("global invariant registry", () => {
  it("materializes executable state and temporal invariants", () => {
    const registry = materializeInvariantRegistry([
      invariant("state", "requires-state"),
      invariant("temporal", "temporal-order"),
    ], {
      knowledgeRevision: "knowledge-r1",
      profileKey: "bedrock:1.26.40",
      scope: { arenaId: "arena-1", arenaGeneration: 2 },
    });

    expect(registry.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "state",
        enforcement: "runtime-state",
        minimumRepairClaim: "proven-runtime",
      }),
      expect.objectContaining({
        id: "temporal",
        enforcement: "runtime-temporal",
        minimumRepairClaim: "proven-runtime",
      }),
    ]));
  });

  it("is deterministic across input ordering", () => {
    const a = invariant("a", "requires-state");
    const b = invariant("b", "temporal-order");

    const left = materializeInvariantRegistry([a, b], {
      knowledgeRevision: "r1",
      profileKey: "bedrock",
    });
    const right = materializeInvariantRegistry([b, a], {
      knowledgeRevision: "r1",
      profileKey: "bedrock",
    });

    expect(left.revision).toBe(right.revision);
    expect(left.entries).toEqual(right.entries);
  });

  it("keeps open assumptions diagnostic-only", () => {
    const open = {
      ...invariant("open", "requires-state"),
      classification: "open-assumption" as const,
    };

    const registry = materializeInvariantRegistry([open], {
      knowledgeRevision: "r1",
      profileKey: "education",
    });

    expect(registry.entries[0]).toMatchObject({
      enforcement: "diagnostic-only",
      minimumRepairClaim: "hypothesis",
    });
  });
});
}
