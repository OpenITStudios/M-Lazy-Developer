// Same-directory feature/lane test consolidation, original cases kept in lexical blocks.
import { describe, expect, it } from "vitest";
import { parseCombatBehaviorContract } from "../../src/inspection/combat-contract-load.js";
import { analyzeCombatBehaviorContract } from "../../src/inspection/combat-contract-analysis.js";
import { combatContractDiagnostics } from "../../src/inspection/combat-contract-diagnostics.js";
import { parseScriptFile } from "../../../../analyzers/scripts/src/index.js";
import { analyzeCombatLifecycle } from "../../src/inspection/combat-lifecycle-analysis.js";

// Original engine/packages/orchestrator/test/inspection/combat-contract-analysis.test.ts; SHA aa097b64bcd4d9d29e164466e41edb0c91691dd1
{
// Source-preserving family consolidation: original suites and assertions retained in separate lexical scopes.

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
}

// Original engine/packages/orchestrator/test/inspection/combat-lifecycle-analysis.test.ts; SHA 1a5d46ab9f01255f694dfe9ee49bc6833eed7e23
{
describe("combat lifecycle analysis", () => {
  it("keeps hurt-only handling as a terminal-lifecycle review risk", () => {
    const script = parseScriptFile(
      "main",
      [
        "world.afterEvents.entityHurt.subscribe((event) => {",
        "  event.hurtEntity.applyKnockback(1, 0, 1, 1);",
        "});",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzeCombatLifecycle([script]);

    expect(result).toMatchObject({
      hurtHandlers: 1,
      deathHandlers: 0,
      hurtOnlyTerminalRisk: 1,
      secondaryEffects: 1,
    });
  });

  it("follows callback call graph without merging hurt and death paths", () => {
    const script = parseScriptFile(
      "main",
      [
        "world.afterEvents.entityHurt.subscribe((event) => {",
        "  applyCombatEffects(event.hurtEntity);",
        "});",
        "world.afterEvents.entityDie.subscribe((event) => {",
        "  finishElimination(event.deadEntity);",
        "});",
        "function applyCombatEffects(entity) {",
        "  entity.applyKnockback(1, 0, 1, 1);",
        "}",
        "function finishElimination(entity) {",
        "  entity.addEffect('weakness', 20);",
        "}",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzeCombatLifecycle([script]);
    const hurt = result.paths.find(
      (item) => item.event === "hurt",
    );
    const death = result.paths.find(
      (item) => item.event === "death",
    );

    expect(hurt).toMatchObject({
      knockbackEffects: 1,
      statusEffects: 0,
    });
    expect(death).toMatchObject({
      knockbackEffects: 0,
      statusEffects: 1,
    });
  });

  it("proves explicit arena/team scope gating on hurt handling", () => {
    const script = parseScriptFile(
      "main",
      [
        "world.afterEvents.entityHurt.subscribe((event) => {",
        "  const victimArena = arenaOf(event.hurtEntity);",
        "  const attackerArena = arenaOf(event.damageSource.damagingEntity);",
        "  if (victimArena !== attackerArena) return;",
        "  event.hurtEntity.applyKnockback(1, 0, 1, 1);",
        "});",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzeCombatLifecycle([script]);

    expect(
      result.explicitCombatScopeGuards,
    ).toBe(1);
    expect(
      result.hurtHandlersWithoutScopeGuard,
    ).toBe(0);
    expect(
      result.secondaryEffectPathsWithoutScopeGuard,
    ).toBe(0);
  });

  it("keeps hurt handling without explicit arena/team comparison as a scope gap", () => {
    const script = parseScriptFile(
      "main",
      [
        "world.afterEvents.entityHurt.subscribe((event) => {",
        "  event.hurtEntity.applyKnockback(1, 0, 1, 1);",
        "});",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzeCombatLifecycle([
        script,
      ]);
    expect(
      result.hurtHandlersWithoutScopeGuard,
    ).toBe(1);
    expect(
      result.secondaryEffectPathsWithoutScopeGuard,
    ).toBe(1);
  });

  it("reports projectile cleanup gap only for projectile-bounded evidence", () => {
    const script = parseScriptFile(
      "main",
      [
        "function fire(projectileComponent, direction) {",
        "  projectileComponent.shoot(direction);",
        "}",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzeCombatLifecycle([script]);

    expect(result.projectileSpawns).toBe(1);
    expect(result.projectileRemovals).toBe(0);
    expect(result.projectileCleanupGap).toBe(1);
  });
});
}
