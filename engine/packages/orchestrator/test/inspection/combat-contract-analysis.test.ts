// Source-preserving family consolidation: original suites and assertions retained in separate lexical scopes.
import { describe } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { parseCombatBehaviorContract } from "../../src/inspection/combat-contract-load.js";
import { analyzeCombatBehaviorContract } from "../../src/inspection/combat-contract-analysis.js";
import { combatContractDiagnostics } from "../../src/inspection/combat-contract-diagnostics.js";

// Original suite engine/packages/orchestrator/test/inspection/combat-contract-load.test.ts, blob 28b2e9dab00c9d7f10b6192ca44770a383ad0453
{



describe("combat contract loader", () => {
  it("requires every combat contract decision explicitly", () => {
    expect(
      parseCombatBehaviorContract({
        schemaVersion: 1,
        id: "arena-combat",
        friendlyFireAllowed: false,
        crossArenaDamageAllowed: false,
        secondaryEffectsRequireDamageEligibility: true,
        projectileGenerationBound: true,
        projectileCleanupOnGenerationEnd: true,
        environmentalDamageAllowed: true,
        reviveGenerationBound: true,
        selfReviveAllowed: false,
        multipleReviversAllowed: false,
        reviveAfterDeathAllowed: false,
      }),
    ).toMatchObject({
      id: "arena-combat",
      friendlyFireAllowed: false,
      reviveGenerationBound: true,
    });
  });

  it("rejects missing booleans instead of applying hidden defaults", () => {
    expect(() =>
      parseCombatBehaviorContract({
        schemaVersion: 1,
        id: "bad",
        friendlyFireAllowed: false,
      }),
    ).toThrow(/must be boolean/);
  });
});

}

// Original suite engine/packages/orchestrator/test/inspection/combat-contract-analysis.test.ts, blob f07af467777cd657e4112ecc269b521d4192b447
{



const lifecycle = {
  hurtHandlers: 1,
  deathHandlers: 1,
  damageApplications: 0,
  secondaryEffects: 2,
  projectileSpawns: 1,
  projectileRemovals: 0,
  projectileCleanupGap: 1,
  hurtOnlyTerminalRisk: 0,
  explicitCombatScopeGuards: 0,
  hurtHandlersWithoutScopeGuard: 0,
  secondaryEffectPathsWithoutScopeGuard: 0,
  paths: [],
};

const runtime = {
  reviveAnomalies: 4,
  byKind: {
    "self-revive": 1,
    "multiple-revivers": 1,
    "stale-revive": 1,
    "revive-after-death": 1,
    "invalid-reviver": 0,
  },
  scopedLifeGenerationMissing: 0,
  scopedArenaGenerationMissing: 0,
  affectedPlayers: ["p1"],
};

describe("combat contract analysis", () => {
  it("counts only anomalies that contradict authored revive contract", () => {
    const result = analyzeCombatBehaviorContract(
      lifecycle,
      runtime,
      {
        schemaVersion: 1,
        id: "mode",
        friendlyFireAllowed: false,
        crossArenaDamageAllowed: false,
        secondaryEffectsRequireDamageEligibility: true,
        projectileGenerationBound: true,
        projectileCleanupOnGenerationEnd: true,
        environmentalDamageAllowed: true,
        reviveGenerationBound: true,
        selfReviveAllowed: true,
        multipleReviversAllowed: false,
        reviveAfterDeathAllowed: false,
      },
    );

    expect(result).toMatchObject({
      reviveContractContradictions: 3,
      selfReviveContradictions: 0,
      multipleReviverContradictions: 1,
      staleReviveContradictions: 1,
      reviveAfterDeathContradictions: 1,
      projectileCleanupContractGap: 1,
      secondaryEffectEligibilitySurfaces: 2,
    });
  });

  it("does not invent mode-specific contradictions without a combat contract", () => {
    const result =
      analyzeCombatBehaviorContract(
        lifecycle,
        runtime,
      );

    expect(result.configured).toBe(false);
    expect(
      result.reviveContractContradictions,
    ).toBe(0);
  });
});

}

// Original suite engine/packages/orchestrator/test/inspection/combat-contract-diagnostics.test.ts, blob c98f597ecccd18da093d8ff2fa059b74d6b157c2
{



describe("combat contract diagnostics", () => {
  it("emits no finding when authored combat contract has no observed contradiction", () => {
    expect(
      combatContractDiagnostics({
        configured: true,
        contractId: "mode",
        reviveContractContradictions: 0,
        selfReviveContradictions: 0,
        multipleReviverContradictions: 0,
        staleReviveContradictions: 0,
        reviveAfterDeathContradictions: 0,
        invalidReviverObservations: 0,
        projectileCleanupContractGap: 0,
        secondaryEffectEligibilitySurfaces: 0,
        reasons: [],
      }),
    ).toEqual([]);
  });

  it("projects runtime revive contradictions as one structured diagnostic", () => {
    const result =
      combatContractDiagnostics({
        configured: true,
        contractId: "mode",
        reviveContractContradictions: 3,
        selfReviveContradictions: 0,
        multipleReviverContradictions: 1,
        staleReviveContradictions: 1,
        reviveAfterDeathContradictions: 1,
        invalidReviverObservations: 0,
        projectileCleanupContractGap: 0,
        secondaryEffectEligibilitySurfaces: 0,
        reasons: [],
      });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      code:
        "COMBAT_REVIVE_CONTRACT_VIOLATION",
      severity: "medium",
      data: {
        selfRevive: 0,
        multipleRevivers: 1,
        staleRevive: 1,
        reviveAfterDeath: 1,
        invalidReviverObservations: 0,
      },
    });
  });
});

}
