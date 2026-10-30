// Source-preserving family consolidation: original suites and assertions retained in separate lexical scopes.
import { describe } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { parseEconomyBehaviorContract } from "../../src/inspection/economy-contract-load.js";
import { analyzeEconomyBehaviorContract } from "../../src/inspection/economy-contract-analysis.js";
import type { RewardSourceAnalysis } from "../../src/inspection/reward-source-analysis.js";
import { economyContractDiagnostics } from "../../src/inspection/economy-contract-diagnostics.js";

// Original suite engine/packages/orchestrator/test/inspection/economy-contract-load.test.ts, blob 7edda38d8e71ffc0b305020d811ccf9ac1ae8f89
{



describe("economy contract loader", () => {
  it("parses explicit reward transaction contract", () => {
    expect(
      parseEconomyBehaviorContract({
        schemaVersion: 1,
        id: "arena-economy",
        deathRewardArbitration:
          "mutually-exclusive",
        pickupCurrencyItemContract:
          "consume",
        inventoryFullContract:
          "compensate",
        rewardIdempotencyRequired: true,
        pickupScopeValidationRequired: true,
        staleDropCleanupRequired: true,
        terminalRewardRequiresResultCommit:
          true,
      }),
    ).toMatchObject({
      id: "arena-economy",
      deathRewardArbitration:
        "mutually-exclusive",
      pickupCurrencyItemContract:
        "consume",
    });
  });

  it("rejects enum typos rather than inventing defaults", () => {
    expect(() =>
      parseEconomyBehaviorContract({
        schemaVersion: 1,
        id: "invalid",
        deathRewardArbitration:
          "exclusive",
        pickupCurrencyItemContract:
          "consume",
        inventoryFullContract:
          "compensate",
        rewardIdempotencyRequired: true,
        pickupScopeValidationRequired: true,
        staleDropCleanupRequired: true,
        terminalRewardRequiresResultCommit:
          true,
      }),
    ).toThrow(/invalid value/);
  });
});

}

// Original suite engine/packages/orchestrator/test/inspection/economy-contract-analysis.test.ts, blob c9e60e822dd523be8cb44e3649dbc5df05aaed17
{




const rewards: RewardSourceAnalysis = {
  sourceKinds: [
    "ENGINE_LOOT_TABLE",
    "SCRIPT_INVENTORY_GRANT",
    "DROPPED_ITEM_PICKUP",
    "SCOREBOARD_CURRENCY",
  ],
  engineLootEntities: 1,
  engineLootTables: 1,
  unresolvedEngineLootTables: 0,
  scriptInventoryGrants: 1,
  worldDrops: 1,
  pickupObservers: 1,
  scriptLootCommands: 0,
  functionLootCommands: 0,
  scoreboardCredits: 1,
  scoreboardDebits: 0,
  scoreboardAdjustments: 0,
  scoreboardWrites: 0,
  itemConsumes: 0,
  dropCleanupSurfaces: 0,
  worldDropRewardPathsWithoutCleanup: 1,
  rewardPathsWithoutIdempotency: 2,
  cleanupAfterRewardJournalProven: 0,
  cleanupBeforeRewardJournalRisks: 0,
  cleanupRewardJournalOrderingUnresolved: 0,
  deathRewardPaths: 1,
  pickupCurrencyPaths: 1,
  deathRewardSourceOverlapCandidates: 1,
  deathRewardSourceOverlapUnresolved: 0,
  pickupCurrencyWithoutConsumeCandidates: 1,
  paths: [],
};

const baseContract = {
  schemaVersion: 1 as const,
  id: "economy",
  pickupCurrencyItemPolicy: "consume" as const,
  inventoryFullPolicy:
    "compensate" as const,
  rewardIdempotencyRequired: true,
  pickupScopeValidationRequired: true,
  staleDropCleanupRequired: true,
  terminalRewardRequiresResultCommit: true,
};

describe("economy contract analysis", () => {
  it("keeps complementary death reward sources out of contract conflict", () => {
    const result = analyzeEconomyBehaviorContract(
      rewards,
      {
        ...baseContract,
        deathRewardArbitration:
          "complementary",
      },
    );

    expect(
      result.deathRewardOverlapContractConflicts,
    ).toBe(0);
    expect(
      result.pickupCurrencyConsumeCoverageGaps,
    ).toBe(1);
    expect(
      result.idempotencyCoverageGaps,
    ).toBe(2);
    expect(
      result.staleDropCleanupCoverageGaps,
    ).toBe(1);
  });

  it("surfaces mutually-exclusive death reward overlap as contract conflict, not confirmed defect", () => {
    const result = analyzeEconomyBehaviorContract(
      rewards,
      {
        ...baseContract,
        deathRewardArbitration:
          "mutually-exclusive",
      },
    );

    expect(
      result.deathRewardOverlapContractConflicts,
    ).toBe(1);
    expect(result.reasons.join(" "))
      .toMatch(/correlation is still required/);
  });

  it("keeps overlap unresolved when no economy contract is configured", () => {
    const result =
      analyzeEconomyBehaviorContract(rewards);

    expect(result.configured).toBe(false);
    expect(
      result.deathRewardOverlapUnresolved,
    ).toBe(1);
    expect(
      result.deathRewardOverlapContractConflicts,
    ).toBe(0);
  });

  it("keeps terminal reward ordering unresolved until RESULT_COMMITTED binding is proven", () => {
    const result = analyzeEconomyBehaviorContract(
      rewards,
      {
        ...baseContract,
        deathRewardArbitration:
          "complementary",
      },
    );

    expect(
      result.terminalRewardResultCommitUnproven,
    ).toBe(1);
    expect(result.reasons.join(" "))
      .toMatch(/RESULT_COMMITTED binding proof/);
  });
});

}

// Original suite engine/packages/orchestrator/test/inspection/economy-contract-diagnostics.test.ts, blob df1785935560f67cae69bf96b741b16e49d0fdf4
{



describe("economy contract diagnostics", () => {
  it("separates authored conflicts from coverage gaps", () => {
    const findings =
      economyContractDiagnostics({
        configured: true,
        contractId: "economy",
        deathRewardOverlapContractConflicts: 1,
        deathRewardOverlapUnresolved: 1,
        pickupCurrencyConsumeCoverageGaps: 0,
        pickupCurrencyContractMismatch: 0,
        idempotencyCoverageGaps: 1,
        staleDropCleanupCoverageGaps: 0,
        inventoryFullContractGaps: 0,
        pickupScopeValidationUnproven: 1,
        terminalRewardResultCommitUnproven: 0,
        reasons: [],
      });

    expect(
      findings.map((item) => item.code),
    ).toEqual([
      "ECONOMY_CONTRACT_CONFLICT",
      "ECONOMY_CONTRACT_COVERAGE_GAP",
    ]);
    expect(findings[0]?.severity)
      .toBe("medium");
    expect(findings[1]?.severity)
      .toBe("minor");
  });

  it("emits nothing when no authored economy contract is configured", () => {
    expect(
      economyContractDiagnostics({
        configured: false,
        deathRewardOverlapContractConflicts: 0,
        deathRewardOverlapUnresolved: 1,
        pickupCurrencyConsumeCoverageGaps: 0,
        pickupCurrencyContractMismatch: 0,
        idempotencyCoverageGaps: 0,
        staleDropCleanupCoverageGaps: 0,
        inventoryFullContractGaps: 0,
        pickupScopeValidationUnproven: 0,
        terminalRewardResultCommitUnproven: 0,
        reasons: [],
      }),
    ).toEqual([]);
  });
});

}
