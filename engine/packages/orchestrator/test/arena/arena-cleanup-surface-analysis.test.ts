// Consolidated related development source tests, original lexical scopes retained.
import { describe, expect, it } from "vitest";
import { parseScriptFile } from "../../../../analyzers/scripts/src/index.js";
import { analyzeArenaCleanupSurfaces } from "../../src/arena/arena-cleanup-surface-analysis.js";
import { assessArenaResetClosure } from "../../src/arena/arena-reset-closure-analysis.js";

// Original engine/packages/orchestrator/test/arena/arena-cleanup-surface-analysis.test.ts; blob ded0b2c5f5cdc3b12b63468d4dcf33adcdc4ecfa
{
describe("arena cleanup surface analysis", () => {
  it("joins class-method cleanup through an exact parser region", () => {
    const script = parseScriptFile("class-cleanup", [
      "const ArenaFlow = class {",
      "  static start(player) { player.addTag('arena_active'); }",
      "  static endGame(player) { this.cleanupArena(player); }",
      "  static cleanupArena(player) { player.removeTag('arena_active'); }",
      "};",
    ].join("\n"), {
      artifactId: "fixture",
      relativePath: "scripts/bundle.js",
    });
    const result = analyzeArenaCleanupSurfaces([script]);
    const terminal = result.terminalAssessments.find(item =>
      /^function:ArenaFlow\.endGame@\d+:\d+$/.test(item.terminalRegion));
    expect(terminal).toBeDefined();
    const tag = terminal?.surfaces.find(item => item.surface === "tag");
    expect(tag?.releaseReachableFromTerminal).toBe(true);
    // The tag inverse remains surface-level, not live player identity proof.
    expect(tag?.status).toBe("partial");
  });

  it("proves exact dynamic-property and membership cleanup reachable from terminal", () => {
    const script = parseScriptFile(
      "main",
      [
        "function join(arena, player) {",
        "  arena.players.add(player);",
        "  player.setDynamicProperty('arena:ready', true);",
        "}",
        "function endGame(arena, player) {",
        "  cleanupArena(arena, player);",
        "}",
        "function cleanupArena(arena, player) {",
        "  arena.players.delete(player);",
        "  player.setDynamicProperty('arena:ready', undefined);",
        "  arena.generation++;",
        "}",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result = analyzeArenaCleanupSurfaces([script]);
    const terminal = result.terminalAssessments.find(
      (item) => item.terminalRegion === "function:endGame",
    );
    expect(
      terminal?.surfaces.find(
        (item) => item.surface === "membership",
      )?.status,
    ).toBe("proven");
    expect(result.ledger?.resources).toBeGreaterThan(0);
    expect(
      result.ledger?.obligations.find(
        (item) => item.surface === "membership",
      )?.status,
    ).toBe("complete");
  });

  it("keeps surface-level API inverse as partial rather than exact proof", () => {
    const script = parseScriptFile(
      "main",
      [
        "function start(player) { player.addTag('playing'); }",
        "function cleanup(player) { player.removeTag('playing'); }",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result = analyzeArenaCleanupSurfaces([script]);
    expect(
      result.terminalAssessments[0]?.surfaces.find(
        (item) => item.surface === "tag",
      )?.status,
    ).toBe("partial");
    expect(
      result.ledger?.obligations.find(
        (item) => item.surface === "tag",
      )?.status,
    ).toBe("partial");
  });

  it("marks resources without any terminal cleanup path as missing", () => {
    const script = parseScriptFile(
      "main",
      [
        "function start(player) {",
        "  player.addTag('playing');",
        "}",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result = analyzeArenaCleanupSurfaces([script]);
    expect(result.ledger).toMatchObject({
      resources: 1,
      complete: 0,
      partial: 0,
      missing: 1,
      coverageRatio: 0,
    });
  });
  it("tracks equipment and temporary player capabilities as cleanup obligations", () => {
    const script = parseScriptFile(
      "main",
      [
        "function start(player, equipment) {",
        "  equipment.setEquipment('Chest', new ItemStack('minecraft:elytra'));",
        "  player.runCommand('ability @s mayfly true');",
        "}",
        "function endGame(player, equipment) {",
        "  equipment.setEquipment('Chest', undefined);",
        "  player.runCommand('ability @s mayfly false');",
        "}",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result = analyzeArenaCleanupSurfaces([script]);
    const surfaces = result.ledger?.obligations ?? [];

    expect(
      surfaces.some(
        (item) =>
          item.surface === "equipment" &&
          item.status !== "missing",
      ),
    ).toBe(true);
    expect(
      surfaces.some(
        (item) =>
          item.surface === "player-capability" &&
          item.key.includes("mayfly") &&
          item.status === "complete",
      ),
    ).toBe(true);
  });

  it("accepts a complete authored cleanup transaction lifecycle", () => {
    const script = parseScriptFile(
      "main",
      [
        "type CleanupState = 'FREEZE' | 'INVALIDATE' | 'CLEAN' | 'RESTORE_BASELINE' | 'VERIFY_EMPTY' | 'READY_FOR_NEXT_GENERATION';",
        "const cleanupTransitions: Record<CleanupState, readonly CleanupState[]> = {",
        "  FREEZE: ['INVALIDATE'],",
        "  INVALIDATE: ['CLEAN'],",
        "  CLEAN: ['RESTORE_BASELINE'],",
        "  RESTORE_BASELINE: ['VERIFY_EMPTY'],",
        "  VERIFY_EMPTY: ['READY_FOR_NEXT_GENERATION'],",
        "  READY_FOR_NEXT_GENERATION: [],",
        "};",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzeArenaCleanupSurfaces([
        script,
      ]);

    expect(
      result.lifecycle,
    ).toMatchObject({
      declared: true,
      complete: 1,
      unresolved: 0,
    });
  });

  it("keeps a cleanup lifecycle unresolved when verify-empty is skipped", () => {
    const script = parseScriptFile(
      "main",
      [
        "type ResetState = 'FREEZE' | 'INVALIDATE' | 'CLEAN' | 'RESTORE_BASELINE' | 'READY_FOR_NEXT_GENERATION';",
        "const resetTransitions: Record<ResetState, readonly ResetState[]> = {",
        "  FREEZE: ['INVALIDATE'],",
        "  INVALIDATE: ['CLEAN'],",
        "  CLEAN: ['RESTORE_BASELINE'],",
        "  RESTORE_BASELINE: ['READY_FOR_NEXT_GENERATION'],",
        "  READY_FOR_NEXT_GENERATION: [],",
        "};",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzeArenaCleanupSurfaces([
        script,
      ]);

    expect(
      result.lifecycle.unresolved,
    ).toBe(1);
    expect(
      result.lifecycle
        .assessments[0]
        ?.missingPhases,
    ).toContain("verifyempty");
  });

  it("requires an explicit cleanup lifecycle when mutable arena surfaces are acquired", () => {
    const script = parseScriptFile(
      "main",
      [
        "function start(player) {",
        "  player.addTag('playing');",
        "}",
        "function cleanup(player) {",
        "  player.removeTag('playing');",
        "}",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzeArenaCleanupSurfaces([
        script,
      ]);

    expect(
      result.lifecycle,
    ).toMatchObject({
      declared: false,
      complete: 0,
      unresolved: 1,
    });
  });


  it("does not treat Entity.kill or Player.remove as a typed arena cleanup", () => {
    const source = { artifactId: "fixture", relativePath: "scripts/main.ts" };
    const script = parseScriptFile("main", [
      "function start() { cleanup(); }",
      "function cleanup() {}",
    ].join("\n"), source);
    script.methodCalls = [
      {
        receiverType: "Dimension", method: "spawnEntity",
        symbol: "Dimension.spawnEntity", inference: "bounded",
        receiverHint: "actor", executionRegion: "function:start",
        argumentCount: 1, argumentKinds: ["string"],
        hasSpreadArgument: false, resultUse: "ignored", source,
      },
      {
        receiverType: "Entity", method: "kill",
        symbol: "Entity.kill", inference: "bounded",
        receiverHint: "actor", executionRegion: "function:cleanup",
        argumentCount: 0, argumentKinds: [],
        hasSpreadArgument: false, resultUse: "ignored", source,
      },
    ];
    expect(analyzeArenaCleanupSurfaces([script]).ledger?.obligations
      .find(item => item.surface === "entity")?.status).toBe("missing");
    script.methodCalls[1] = {
      ...script.methodCalls[1]!, receiverType: "Player",
      method: "remove", symbol: "Player.remove",
    };
    expect(analyzeArenaCleanupSurfaces([script]).ledger?.obligations
      .find(item => item.surface === "entity")?.status).toBe("missing");
  });

  it("separates bounded player state from exact World singleton cleanup", () => {
    const source = { artifactId: "fixture", relativePath: "scripts/main.ts" };
    const script = parseScriptFile("main", [
      "function start() { cleanup(); }",
      "function cleanup() {}",
    ].join("\n"), source);
    script.dynamicProperties = [
      { operation: "set", propertyId: "arena:ready",
        receiverHint: "player", receiverType: "Player",
        receiverInference: "bounded", executionRegion: "function:start", source },
      { operation: "delete", propertyId: "arena:ready",
        receiverHint: "player", receiverType: "Player",
        receiverInference: "bounded", executionRegion: "function:cleanup", source },
      { operation: "set", propertyId: "round_state",
        receiverHint: "w", receiverType: "World",
        receiverInference: "direct", executionRegion: "function:start", source },
      { operation: "delete", propertyId: "round_state",
        receiverHint: "world", receiverType: "World",
        receiverInference: "direct", executionRegion: "function:cleanup", source },
    ];
    const obligations = analyzeArenaCleanupSurfaces([script]).ledger?.obligations ?? [];
    expect(obligations.find(item => item.surface === "dynamic-property" &&
      item.key === "player:arena:ready")?.status).toBe("partial");
    expect(obligations.find(item => item.surface === "dynamic-property" &&
      item.key === "world:round_state")?.status).toBe("complete");
  });

  it("flags temporary equipment without cleanup as missing", () => {
    const script = parseScriptFile(
      "main",
      [
        "function start(equipment) {",
        "  equipment.setEquipment('Chest', new ItemStack('minecraft:elytra'));",
        "}",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result = analyzeArenaCleanupSurfaces([script]);

    expect(
      result.ledger?.obligations.find(
        (item) => item.surface === "equipment",
      )?.status,
    ).toBe("missing");
  });
});
}

// Original engine/packages/orchestrator/test/arena/arena-reset-closure-analysis.test.ts; blob 86e9fb086863ca39f43a2a9f063264c72a8d8f18
{
const clean: Parameters<typeof assessArenaResetClosure>[0] = {
  lifecycle: {
    terminalCandidates: 1,
    proven: 1,
    terminalEntryPaths: [{ status: "source-reachable" }],
  },
  cleanup: {
    ledger: { missing: 0, partial: 0 },
    lifecycle: { unresolved: 0 },
  },
  inventory: {
    unresolvedResetPairs: 0,
    unresolvedLoadoutTransactions: 0,
  },
  capability: {
    unguardedMutationRegions: 0,
  },
  combat: {
    staleReviveContradictions: 0,
    reviveAfterDeathContradictions: 0,
    projectileCleanupContractGap: 0,
  },
  interaction: {
    directInputLockRisks: 0,
    staleFormResponseGaps: 0,
    repeatedInputRisks: 0,
  },
  chunk: {
    unguardedDeferredChunkWork: 0,
    entityRemoveTerminalizationRisks: 0,
  },
  worldRules: {
    conflictingGlobalRules: 0,
  },
  baselineRestore: {
    candidates: 0,
    verified: 0,
    unresolved: 0,
  },
  entityPopulation: {
    registryAuthorities: 0,
    generationBoundAuthorities: 0,
    unresolvedAuthorities: 0,
    multiplicityContradictions: 0,
    autonomousReplacementSources: 0,
    replacementLineage: "not-applicable",
    unresolvedSpawnCommits: 0,
  },
};

describe("arena reset closure", () => {
  it("does not borrow unrelated mcfunction verification for arena world reset", () => {
    const genericCommandVerification = {
      candidates: 2,
      verified: 2,
      unresolved: 0,
    };
    const arenaRequest = assessArenaResetClosure({
      ...clean,
      baselineRestore: genericCommandVerification,
      cleanup: {
        ...clean.cleanup,
        asyncResetCompletion: {
          swallowedFailurePaths: 0,
          partialResultPaths: 0,
          earlyIdlePaths: 0,
          worldResetRequests: 2,
          observations: [],
        },
      },
    });

    // Two source reset requests, not two verified arenas or generations.
    // Neither mcfunction witness is linked to an exact Script API request.
    expect(arenaRequest.surfaces.baselinePositiveProofMissing).toBe(2);
    expect(arenaRequest.blockers).toContain("baselinePositiveProofMissing");
    expect(arenaRequest.warnings).toContain(
      "baselineCommandVerificationUnattributedToArenaGeneration",
    );
    expect(arenaRequest.reuseEligibility).toBe("quarantined");

    // Independent command evidence is not an arena-reset obligation
    // on a source that has no world reset requests.
    const withoutWorldReset = assessArenaResetClosure({
      ...clean,
      baselineRestore: genericCommandVerification,
    });
    expect(withoutWorldReset.surfaces.baselinePositiveProofMissing).toBe(0);
    expect(withoutWorldReset.reuseEligibility).toBe("reusable");
  });

  it("quarantines candidate swallowed failures or returned skipped chunks", () => {
    const source = {
      artifactId: "fixture",
      relativePath: "scripts/reset.js",
      range: { lineStart: 8, lineEnd: 8, columnStart: 1, columnEnd: 20 },
    };
    const result = assessArenaResetClosure({
      ...clean,
      cleanup: {
        ...clean.cleanup,
        asyncResetCompletion: {
          swallowedFailurePaths: 1,
          partialResultPaths: 1,
          earlyIdlePaths: 1,
          observations: [{
            scriptId: "reset",
            kind: "reset-error-swallowed-candidate",
            executionRegion: "function:GameManager.trackArenaCleanup@7:1",
            source,
            detail: "log-only source catch",
          }],
        },
      },
    });
    expect(result.status).toBe("unresolved");
    expect(result.reuseEligibility).toBe("quarantined");
    expect(result.blockers).toContain("asyncResetFailureSwallowCandidates");
    expect(result.blockers).toContain("asyncResetPartialResultCandidates");
    expect(result.warnings).toContain("idleBeforeCleanupSettlementSourceCandidate");
    expect(result.sourceWitnesses).toEqual(expect.arrayContaining([
      expect.objectContaining({ source, scriptId: "reset" }),
    ]));
  });

  it("fails closed when terminal, convergence, or entry proof is missing", () => {
    const absent = assessArenaResetClosure({
      ...clean,
      lifecycle: { terminalCandidates: 0, proven: 0, terminalEntryPaths: [] },
    });
    expect(absent.reuseEligibility).toBe("quarantined");
    expect(absent.blockers).toContain("terminalSourceMissing");

    const orphaned = assessArenaResetClosure({
      ...clean,
      lifecycle: {
        terminalCandidates: 1,
        proven: 1,
        terminalEntryPaths: [{ status: "unresolved" }],
      },
    });
    expect(orphaned.blockers).toContain("terminalIngressEvidenceMissing");

    const guarded = assessArenaResetClosure({
      ...clean,
      lifecycle: {
        terminalCandidates: 1,
        proven: 1,
        terminalEntryPaths: [{ status: "conditional-source-candidate" }],
      },
    });
    expect(guarded.blockers).toContain("terminalIngressEvidenceMissing");

    const partial = assessArenaResetClosure({
      ...clean,
      lifecycle: {
        terminalCandidates: 2,
        proven: 1,
        terminalEntryPaths: [{ status: "source-reachable" }],
      },
    });
    expect(partial.blockers).toContain("terminalConvergenceGaps");
    expect(partial.reuseEligibility).toBe("quarantined");
  });

  it("reports complete only when every consumed domain is closed", () => {
    expect(
      assessArenaResetClosure(clean),
    ).toMatchObject({
      status: "complete",
      reuseEligibility: "reusable",
      requiresRecovery: false,
      blockers: [],
    });
  });

  it("fails closed when any domain still leaks state", () => {
    const result =
      assessArenaResetClosure({
        ...clean,
        interaction: {
          ...clean.interaction,
          directInputLockRisks: 1,
        },
        combat: {
          ...clean.combat,
          staleReviveContradictions: 1,
        },
      });

    expect(result.status).toBe("unresolved");
    expect(result.reuseEligibility).toBe(
      "quarantined",
    );
    expect(result.requiresRecovery).toBe(
      true,
    );
    expect(result.blockers).toEqual([
      "inputLockRisks",
      "staleReviveContradictions",
    ]);
  });

  it("keeps surface-level cleanup proof partial instead of green", () => {
    const result =
      assessArenaResetClosure({
        ...clean,
        cleanup: {
          ledger: {
            missing: 0,
            partial: 1,
          },
          lifecycle: {
            unresolved: 0,
          },
        },
      });

    expect(result.status).toBe("partial");
    expect(result.reuseEligibility).toBe(
      "quarantined",
    );
    expect(result.requiresRecovery).toBe(
      true,
    );
    expect(result.warnings).toEqual([
      "cleanupLedgerPartial",
    ]);
  });
});


describe("arena reuse quarantine gate", () => {
  it("does not allow partial cleanup evidence to reactivate an arena", () => {
    const dirty =
      assessArenaResetClosure({
        ...clean,
        cleanup: {
          ledger: {
            missing: 0,
            partial: 1,
          },
          lifecycle: {
            unresolved: 0,
          },
        },
      });

    expect(dirty.reuseEligibility).toBe(
      "quarantined",
    );

    const recovered =
      assessArenaResetClosure(clean);

    expect(
      recovered.reuseEligibility,
    ).toBe("reusable");
  });
});


describe("baseline restore verification gate", () => {
  it("quarantines arena reuse when reset-world restoration remains unverified", () => {
    const result =
      assessArenaResetClosure({
        ...clean,
        baselineRestore: {
          candidates: 1,
          verified: 0,
          unresolved: 1,
        },
      });

    expect(result.status).toBe("unresolved");
    expect(result.reuseEligibility).toBe(
      "quarantined",
    );
    expect(result.blockers).toContain(
      "baselineRestoreVerificationGaps",
    );
  });
});


describe("entity identity and multiplicity reset gate", () => {
  it("quarantines reset reuse when a declared entity registry is not generation-bound", () => {
    const result =
      assessArenaResetClosure({
        ...clean,
        entityPopulation: {
          ...clean.entityPopulation,
          registryAuthorities: 1,
          generationBoundAuthorities: 0,
          unresolvedAuthorities: 1,
          multiplicityContradictions: 0,
        },
      });

    expect(result.reuseEligibility).toBe(
      "quarantined",
    );
    expect(result.blockers).toContain(
      "entityPopulationIdentityGaps",
    );
  });

  it("quarantines reset reuse on proven spawn multiplicity contradiction", () => {
    const result =
      assessArenaResetClosure({
        ...clean,
        entityPopulation: {
          ...clean.entityPopulation,
          registryAuthorities: 1,
          generationBoundAuthorities: 1,
          unresolvedAuthorities: 0,
          multiplicityContradictions: 1,
        },
      });

    expect(result.blockers).toContain(
      "entityMultiplicityContradictions",
    );
  });
});


describe("owned population cleanup gate", () => {
  it("quarantines reuse when autonomous replacement lineage is not explicit", () => {
    const result =
      assessArenaResetClosure({
        ...clean,
        entityPopulation: {
          ...clean.entityPopulation,
          autonomousReplacementSources: 1,
          replacementLineage:
            "declared-but-inheritance-unproven",
        },
      });

    expect(result.blockers).toContain(
      "ownedPopulationCleanupGaps",
    );
  });

  it("quarantines reuse when spawn commit remains unresolved", () => {
    const result =
      assessArenaResetClosure({
        ...clean,
        entityPopulation: {
          ...clean.entityPopulation,
          unresolvedSpawnCommits: 1,
        },
      });

    expect(result.reuseEligibility).toBe(
      "quarantined",
    );
  });
});
}
