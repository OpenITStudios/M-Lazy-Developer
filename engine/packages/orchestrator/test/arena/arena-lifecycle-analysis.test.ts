// Source-preserving consolidation: original test cases remain in isolated lexical blocks.
import { describe, expect, it } from "vitest";
import { deriveCrossFileCallEdges, deriveScriptTerminalIdempotencyEvidence, deriveScriptTerminalPrecedenceEvidence, parseScriptFile } from "../../../../analyzers/scripts/src/index.js";
import { analyzeArenaLifecycleConvergence } from "../../src/arena/arena-lifecycle-analysis.js";
import { arenaLifecycleDiagnostics } from "../../src/arena/arena-lifecycle-diagnostics.js";
import { deriveArenaRepeatedRunValidationPlan } from "../../src/arena/arena-repeated-run-validation.js";
import { compileArenaRepeatedRunRuntime } from "../../src/arena/arena-repeated-run-runtime-compiler.js";
import { proveArenaTickStateEquivalence } from "../../src/arena/arena-tick-state-proof.js";

// Consolidated suite from engine/packages/orchestrator/test/arena/arena-lifecycle-analysis.test.ts
{
describe("arena lifecycle convergence", () => {
  it("retains exact class-method terminal ownership in a bundled source", () => {
    const script = parseScriptFile("class-owners", [
      "const GameManager = class {",
      "  static endGame(arena, player) { this.cleanupArena(arena, player); }",
      "  static cleanupArena(arena, player) {",
      "    arena.players.delete(player);",
      "    arena.generation++;",
      "  }",
      "  static resetGame(arena, player) { this.cleanupArena(arena, player); }",
      "  static endGameUnrelated(arena) { return arena; }",
      "};",
      "function finish(arena, player) { GameManager.endGame(arena, player); }",
    ].join("\n"), {
      artifactId: "fixture",
      relativePath: "scripts/bundle.js",
    });
    const result = analyzeArenaLifecycleConvergence([script]);
    const regions = result.assessments.map(item => item.terminalRegion);
    expect(regions.some(region =>
      /^function:GameManager\.endGame@\d+:\d+$/.test(region),
    )).toBe(true);
    expect(regions.some(region =>
      /^function:GameManager\.resetGame@\d+:\d+$/.test(region),
    )).toBe(true);
    expect(regions.some(region => region.includes("endGameUnrelated"))).toBe(false);
    // Naming a terminal must never manufacture a gameplay event ingress.
    const end = result.terminalEntryPaths?.find(item =>
      item.terminalRegion.includes("GameManager.endGame@"));
    expect(end?.status).toBe("unresolved");
  });

  it("retains a single developer script-event entry without inventing a terminal race", () => {
    const sourceText = [
      'import { system } from "@minecraft/server";',
      "function resetArena(arena, player) {",
      "  arena.players.delete(player);",
      "  arena.generation++;",
      "}",
      "system.afterEvents.scriptEventReceive.subscribe((event) => {",
      '  if (event.id !== "dev:reset_arena") return;',
      "  resetArena(arena, player);",
      "});",
    ].join("\n");
    const script = parseScriptFile("main", sourceText, {
      artifactId: "fixture",
      relativePath: "scripts/main.ts",
    });
    const result = analyzeArenaLifecycleConvergence([script]);
    const resetPath = result.terminalEntryPaths?.find(
      item => item.terminalRegion === "function:resetArena");
    expect(resetPath).toMatchObject({
      status: "conditional-source-candidate",
      ingresses: [expect.objectContaining({
        kind: "event",
        sourcePathStatus: "conditional-candidate",
        id: "system.afterEvents.scriptEventReceive",
        eventIdGuard: {
          expression: { kind: "literal", value: "dev:reset_arena" },
        },
      })],
    });
    expect(result.terminalRaces).toHaveLength(0);
  });

  it("proves release and generation invalidation through a cleanup helper", () => {
    const script = parseScriptFile(
      "main",
      [
        "function endGame(arena, player) {",
        "  cleanupArena(arena, player);",
        "}",
        "function cleanupArena(arena, player) {",
        "  arena.players.delete(player);",
        "  arena.generation++;",
        "}",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result = analyzeArenaLifecycleConvergence([script]);
    expect(result.assessments).toHaveLength(2);
    expect(
      result.assessments.find(
        (item) => item.terminalRegion === "function:endGame",
      ),
    ).toMatchObject({
      status: "proven",
      scopes: [{
        arenaExpression: "arena",
        membershipRelease: true,
        generationInvalidation: true,
        status: "proven",
      }],
    });
  });

  it("keeps multiple independent terminal ingresses visible for collision proof", () => {
    const script = parseScriptFile(
      "main",
      [
        "function onFlagCaptured(arena, player) {",
        "  endGame(arena, player);",
        "}",
        "function onTimeExpired(arena, player) {",
        "  endGame(arena, player);",
        "}",
        "function endGame(arena, player) {",
        "  cleanupArena(arena, player);",
        "}",
        "function cleanupArena(arena, player) {",
        "  arena.players.delete(player);",
        "  arena.generation++;",
        "}",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzeArenaLifecycleConvergence(
        [script],
      );

    expect(
      result.multiIngressTerminalTargets,
    ).toBe(1);
    expect(
      result.terminalIngresses.find(
        (item) =>
          item.terminalRegion ===
            "function:endGame",
      ),
    ).toMatchObject({
      distinctIngresses: 2,
      status: "multi-ingress",
      incomingCallerRegions: [
        "function:onFlagCaptured",
        "function:onTimeExpired",
      ],
    });
  });

  it("proves an unguarded deferred terminal path can race another exact ingress", () => {
    const source = [
      "function endGame(arena, player) {",
      "  arena.players.delete(player);",
      "  arena.generation++;",
      "}",
      "world.afterEvents.entityDie.subscribe(() => {",
      "  endGame(arena, player);",
      "});",
      "system.runTimeout(() => {",
      "  endGame(arena, player);",
      "}, 20);",
    ].join("\n");
    const script = parseScriptFile(
      "main",
      source,
      {
        artifactId: "fixture",
        relativePath:
          "scripts/main.ts",
      },
    );

    const result =
      analyzeArenaLifecycleConvergence(
        [script],
      );

    expect(
      result.provenTerminalRaces,
    ).toBe(1);
    expect(
      result.terminalRaces.find(
        (item) =>
          item.terminalRegion ===
            "function:endGame",
      ),
    ).toMatchObject({
      status: "contradicted",
      ingresses: expect.arrayContaining([
        expect.objectContaining({
          kind: "event",
          id:
            "world.afterEvents.entityDie",
        }),
        expect.objectContaining({
          kind: "deferred",
          guardStatus:
            "unguarded",
        }),
      ]),
    });
  });

  it("closes a deferred terminal race when the terminal owner has a one-shot latch", () => {
    const source = [
      "let ended = false;",
      "function endGame(arena, player) {",
      "  if (ended) return;",
      "  ended = true;",
      "  arena.players.delete(player);",
      "  arena.generation++;",
      "}",
      "world.afterEvents.entityDie.subscribe(() => {",
      "  endGame(arena, player);",
      "});",
      "system.runTimeout(() => {",
      "  endGame(arena, player);",
      "}, 20);",
    ].join("\n");
    const script = parseScriptFile(
      "main",
      source,
      {
        artifactId: "fixture",
        relativePath:
          "scripts/main.ts",
      },
    );
    const latch =
      deriveScriptTerminalIdempotencyEvidence(
        source,
        script.source,
      );

    const result =
      analyzeArenaLifecycleConvergence(
        [script],
        [],
        latch,
      );

    expect(
      result.protectedTerminalRaces,
    ).toBe(1);
    expect(
      result.provenTerminalRaces,
    ).toBe(0);
    expect(
      result.terminalRaces.find(
        (item) =>
          item.terminalRegion ===
            "function:endGame",
      ),
    ).toMatchObject({
      status: "protected",
      idempotencyKind:
        "boolean-latch",
    });
  });

  it("keeps different event terminal ingresses unresolved without coexistence proof", () => {
    const source = [
      "function endGame(arena, player) {",
      "  arena.players.delete(player);",
      "  arena.generation++;",
      "}",
      "world.afterEvents.entityDie.subscribe(() => {",
      "  endGame(arena, player);",
      "});",
      "world.afterEvents.playerLeave.subscribe(() => {",
      "  endGame(arena, player);",
      "});",
    ].join("\n");
    const script = parseScriptFile(
      "main",
      source,
      {
        artifactId: "fixture",
        relativePath:
          "scripts/main.ts",
      },
    );

    const result =
      analyzeArenaLifecycleConvergence(
        [script],
      );

    expect(
      result.unresolvedTerminalRaces,
    ).toBe(1);
    expect(
      result.provenTerminalRaces,
    ).toBe(0);
    expect(
      result.terminalRaces.find(
        (item) =>
          item.terminalRegion ===
            "function:endGame",
      )?.status,
    ).toBe("unresolved");
  });

  it("keeps release-only cleanup partial", () => {
    const script = parseScriptFile(
      "main",
      [
        "function cleanupArena(arena, player) {",
        "  arena.players.delete(player);",
        "}",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result = analyzeArenaLifecycleConvergence([script]);
    expect(result.assessments[0]?.status).toBe("partial");
  });

  it("proves lifecycle convergence across imported cleanup modules", () => {
    const mainText = [
      'import { cleanupArena } from "../cleanup.js";',
      "function finishGame(arena, player) {",
      "  cleanupArena(arena, player);",
      "}",
    ].join("\n");
    const cleanupText = [
      "export function cleanupArena(arena, player) {",
      "  arena.players.delete(player);",
      "  arena.generation++;",
      "}",
    ].join("\n");

    const main = parseScriptFile(
      "main",
      mainText,
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );
    const cleanup = parseScriptFile(
      "cleanup",
      cleanupText,
      {
        artifactId: "fixture",
        relativePath: "scripts/cleanup.ts",
      },
    );

    const crossFileCalls =
      deriveCrossFileCallEdges([
        {
          path: "scripts/main.ts",
          text: mainText,
          source: main.source,
        },
        {
          path: "scripts/cleanup.ts",
          text: cleanupText,
          source: cleanup.source,
        },
      ]);

    const result =
      analyzeArenaLifecycleConvergence(
        [main, cleanup],
        crossFileCalls,
      );

    expect(result.crossFileCalls).toBe(1);
    expect(
      result.assessments.find((item) =>
        item.terminalRegion ===
        "module:scripts/main.ts#function:finishGame"
      ),
    ).toMatchObject({
      status: "proven",
      scopes: [{
        arenaExpression: "arena",
        membershipRelease: true,
        generationInvalidation: true,
        status: "proven",
      }],
    });
  });

  it("does not promote conditional cross-file cleanup to proven", () => {
    const mainText = [
      'import { cleanupArena } from "../cleanup.js";',
      "function finishGame(arena, player, shouldCleanup) {",
      "  if (shouldCleanup) {",
      "    cleanupArena(arena, player);",
      "  }",
      "}",
    ].join("\n");
    const cleanupText = [
      "export function cleanupArena(arena, player) {",
      "  arena.players.delete(player);",
      "  arena.generation++;",
      "}",
    ].join("\n");

    const main = parseScriptFile(
      "main",
      mainText,
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );
    const cleanup = parseScriptFile(
      "cleanup",
      cleanupText,
      {
        artifactId: "fixture",
        relativePath: "scripts/cleanup.ts",
      },
    );

    const calls = deriveCrossFileCallEdges([
      {
        path: "scripts/main.ts",
        text: mainText,
        source: main.source,
      },
      {
        path: "scripts/cleanup.ts",
        text: cleanupText,
        source: cleanup.source,
      },
    ]);

    const result =
      analyzeArenaLifecycleConvergence(
        [main, cleanup],
        calls,
      );

    expect(
      result.assessments.find((item) =>
        item.terminalRegion ===
        "module:scripts/main.ts#function:finishGame"
      )?.status,
    ).toBe("partial");
  });


  it("keeps an unguarded deferred gameplay mutation visible as unresolved ownership", () => {
    const source = [
      "let remainingEnemies = 0;",
      "system.runTimeout(() => {",
      "  remainingEnemies++;",
      "}, 20);",
    ].join("\n");
    const script = parseScriptFile(
      "main",
      source,
      {
        artifactId: "fixture",
        relativePath:
          "scripts/main.ts",
      },
    );

    const result =
      analyzeArenaLifecycleConvergence(
        [script],
      );

    expect(
      result.unresolvedDeferredMutations,
    ).toBe(1);
    expect(
      result.deferredMutations[0],
    ).toMatchObject({
      scheduler: "runTimeout",
      status: "unresolved",
    });
  });

  it("retains a lexical generation comparison as a source-only guard candidate", () => {
    const source = [
      "let remainingEnemies = 0;",
      "let arenaGeneration = 3;",
      "const capturedGeneration = arenaGeneration;",
      "system.runTimeout(() => {",
      "  if (capturedGeneration !== arenaGeneration) return;",
      "  remainingEnemies++;",
      "}, 20);",
    ].join("\n");
    const script = parseScriptFile(
      "main",
      source,
      {
        artifactId: "fixture",
        relativePath:
          "scripts/main.ts",
      },
    );

    const result =
      analyzeArenaLifecycleConvergence(
        [script],
      );

    expect(
      result.protectedDeferredMutations,
    ).toBe(0);
    expect(
      result.sourceGuardCandidateDeferredMutations,
    ).toBe(1);
    expect(
      result.unresolvedDeferredMutations,
    ).toBe(1);
    expect(
      result.deferredMutations[0],
    ).toMatchObject({
      status: "source-guard-candidate",
    });
  });

  it("keeps a connection-session guard visible without proving mutation ownership", () => {
    const source = [
      "let score = 0;",
      "let sessionId = 7;",
      "const capturedSessionId = sessionId;",
      "system.run(() => {",
      "  if (capturedSessionId !== sessionId) return;",
      "  score++;",
      "});",
    ].join("\n");
    const script = parseScriptFile(
      "main",
      source,
      {
        artifactId: "fixture",
        relativePath:
          "scripts/main.ts",
      },
    );

    const result =
      analyzeArenaLifecycleConvergence(
        [script],
      );

    expect(
      result.protectedDeferredMutations,
    ).toBe(0);
    expect(
      result.unresolvedDeferredMutations,
    ).toBe(1);
    expect(
      result.deferredMutations[0]?.status,
    ).toBe("source-guard-candidate");
    expect(
      result.deferredMutations[0]
        ?.guardIdentifiers,
    ).toEqual(
      expect.arrayContaining([
        "capturedSessionId",
        "sessionId",
      ]),
    );
  });

  it("does not promote a countdown guard into protected delayed-start ownership", () => {
    const source = [
      "let started = false;",
      "let countdownGeneration = 4;",
      "const capturedGeneration = countdownGeneration;",
      "system.runTimeout(() => {",
      "  if (capturedGeneration !== countdownGeneration) return;",
      "  started = true;",
      "}, 20);",
    ].join("\n");
    const script = parseScriptFile(
      "main",
      source,
      {
        artifactId: "fixture",
        relativePath:
          "scripts/main.ts",
      },
    );

    const result =
      analyzeArenaLifecycleConvergence(
        [script],
      );

    expect(
      result.protectedDeferredMutations,
    ).toBe(0);
    expect(
      result.sourceGuardCandidateDeferredMutations,
    ).toBe(1);
    expect(
      result.unresolvedDeferredMutations,
    ).toBe(1);
    expect(
      result.deferredMutations[0]?.status,
    ).toBe("source-guard-candidate");
  });

  it("surfaces delayed start callbacks that reuse a stale ready-set snapshot", () => {
    const script = parseScriptFile(
      "main",
      [
        "function beginCountdown(arena) {",
        "  const readyCount = arena.readyPlayers.size;",
        "  system.runTimeout(() => {",
        "    if (readyCount < arena.maxPlayers) return;",
        "    arena.state = 'active';",
        "  }, 20);",
        "}",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath:
          "scripts/main.ts",
      },
    );

    const result =
      analyzeArenaLifecycleConvergence(
        [script],
      );

    expect(
      result.staleReadySnapshotRisks,
    ).toBe(1);
    expect(
      result.readySetSnapshotRisks[0],
    ).toMatchObject({
      arenaExpression: "arena",
      snapshotExpression:
        "readyCount=arena.readyPlayers",
    });
  });

  it("retains a round-timer generation guard as unresolved source evidence", () => {
    const source = [
      "let resultCommitted = false;",
      "let timerGeneration = 9;",
      "const capturedTimerGeneration = timerGeneration;",
      "system.runTimeout(() => {",
      "  if (capturedTimerGeneration !== timerGeneration) return;",
      "  resultCommitted = true;",
      "}, 200);",
    ].join("\n");
    const script = parseScriptFile(
      "main",
      source,
      {
        artifactId: "fixture",
        relativePath:
          "scripts/main.ts",
      },
    );

    const result =
      analyzeArenaLifecycleConvergence(
        [script],
      );

    expect(
      result.protectedDeferredMutations,
    ).toBe(0);
    expect(
      result.sourceGuardCandidateDeferredMutations,
    ).toBe(1);
    expect(
      result.unresolvedDeferredMutations,
    ).toBe(1);
    expect(
      result.deferredMutations[0]?.status,
    ).toBe("source-guard-candidate");
  });

  it("separates one-shot terminal protection from deterministic simultaneous-outcome precedence", () => {
    const sourceText = [
      "const RESULT_PRECEDENCE = ['objective', 'timeout'];",
      "let ended = false;",
      "function endGame(candidates) {",
      "  if (ended) return;",
      "  ended = true;",
      "  return RESULT_PRECEDENCE.find((reason) => candidates.has(reason));",
      "}",
      "world.afterEvents.entityDie.subscribe(() => endGame(new Set(['objective'])));",
      "world.afterEvents.playerLeave.subscribe(() => endGame(new Set(['timeout'])));",
    ].join("\n");
    const script = parseScriptFile(
      "main",
      sourceText,
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzeArenaLifecycleConvergence(
        [script],
        [],
        deriveScriptTerminalIdempotencyEvidence(
          sourceText,
          script.source,
        ),
        deriveScriptTerminalPrecedenceEvidence(
          sourceText,
          script.source,
        ),
      );

    expect(
      result.protectedTerminalRaces,
    ).toBe(1);
    expect(
      result.terminalPrecedenceProven,
    ).toBe(1);
    expect(
      result.terminalRaces[0],
    ).toMatchObject({
      status: "protected",
      precedenceStatus: "proven",
      precedence: {
        policyBinding:
          "RESULT_PRECEDENCE",
        outcomes: [
          "objective",
          "timeout",
        ],
      },
    });
  });

  it("keeps simultaneous terminal resolution unresolved when a latch exists without an explicit precedence policy", () => {
    const sourceText = [
      "let ended = false;",
      "function endGame(result) {",
      "  if (ended) return;",
      "  ended = true;",
      "  return result;",
      "}",
      "world.afterEvents.entityDie.subscribe(() => endGame('objective'));",
      "world.afterEvents.playerLeave.subscribe(() => endGame('timeout'));",
    ].join("\n");
    const script = parseScriptFile(
      "main",
      sourceText,
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzeArenaLifecycleConvergence(
        [script],
        [],
        deriveScriptTerminalIdempotencyEvidence(
          sourceText,
          script.source,
        ),
      );

    expect(
      result.protectedTerminalRaces,
    ).toBe(1);
    expect(
      result.terminalPrecedenceUnresolved,
    ).toBe(1);
    expect(
      result.terminalRaces[0],
    ).toMatchObject({
      status: "protected",
      precedenceStatus:
        "unresolved",
    });
  });
});
}

// Consolidated suite from engine/packages/orchestrator/test/arena/arena-lifecycle-diagnostics.test.ts
{
describe("arena lifecycle diagnostics", () => {
  it("uses medium severity when terminal convergence or cleanup is unresolved", () => {
    const findings =
      arenaLifecycleDiagnostics(
        {
          multiIngressTerminalTargets: 0,
          terminalIngresses: [],
          terminalRaces: [],
          protectedTerminalRaces: 0,
          provenTerminalRaces: 0,
          unresolvedTerminalRaces: 0,
          terminalPrecedenceProven: 0,
          terminalPrecedenceUnresolved: 0,
          protectedDeferredMutations: 0,
          unresolvedDeferredMutations: 0,
          staleReadySnapshotRisks: 0,
          readySetSnapshotRisks: [],
          deferredMutations: [],
          terminalCandidates: 2,
          proven: 1,
          partial: 0,
          unresolved: 1,
          assessments: [],
        },
        {
          acquiredSurfaces: 2,
          terminalAssessments: [],
          lifecycle: { declared: false, complete: 0, unresolved: 0, assessments: [] },
          exactProven: 1,
          partial: 0,
          unresolved: 1,
          ledger: {
            resources: 2,
            complete: 1,
            partial: 0,
            missing: 1,
            coverageRatio: 0.5,
            obligations: [],
          },
        },
      );

    expect(findings[0]).toMatchObject({
      code: "ARENA_LIFECYCLE_COVERAGE_GAP",
      severity: "medium",
    });
  });

  it("uses minor severity for partial-only coverage", () => {
    const findings =
      arenaLifecycleDiagnostics(
        {
          multiIngressTerminalTargets: 0,
          terminalIngresses: [],
          terminalRaces: [],
          protectedTerminalRaces: 0,
          provenTerminalRaces: 0,
          unresolvedTerminalRaces: 0,
          terminalPrecedenceProven: 0,
          terminalPrecedenceUnresolved: 0,
          protectedDeferredMutations: 0,
          unresolvedDeferredMutations: 0,
          staleReadySnapshotRisks: 0,
          readySetSnapshotRisks: [],
          deferredMutations: [],
          terminalCandidates: 1,
          proven: 0,
          partial: 1,
          unresolved: 0,
          assessments: [],
        },
        {
          acquiredSurfaces: 1,
          terminalAssessments: [],
          lifecycle: { declared: false, complete: 0, unresolved: 0, assessments: [] },
          exactProven: 0,
          partial: 1,
          unresolved: 0,
          ledger: {
            resources: 1,
            complete: 0,
            partial: 1,
            missing: 0,
            coverageRatio: 0,
            obligations: [],
          },
        },
      );

    expect(findings[0]?.severity)
      .toBe("minor");
  });
});
}

// Consolidated suite from engine/packages/orchestrator/test/arena/arena-repeated-run-runtime-compiler.test.ts
{
describe("arena repeated-run runtime compiler", () => {
  it("compiles all 1/2/5/20 stages when arena generations and capacity are explicit", () => {
    const plan =
      deriveArenaRepeatedRunValidationPlan();

    // Consolidated from a separate plan smoke test: these are authored
    // runtime acceptance surfaces, not claims of live Minecraft execution.
    expect(plan.runCounts).toEqual([1, 2, 5, 20]);
    expect(plan.stages).toHaveLength(8);
    expect(plan.stages.find(item =>
      item.runs === 20 && item.scope === "all-arenas",
    )?.compareSurfaces).toEqual(expect.arrayContaining([
      "deferred-callbacks",
      "dynamic-properties",
      "pending-random-ticks",
      "world-global-leases",
    ]));

    const result =
      compileArenaRepeatedRunRuntime({
        plan,
        arenaIds: [
          "arena-1",
          "arena-2",
        ],
        arenaGenerations: {
          "arena-1": 1,
          "arena-2": 1,
        },
        playersPerArena: 5,
        targetProfileFingerprint:
          "target",
        fixtureFingerprint:
          "fixture",
        objectiveId: "qa",
        participant: "result",
      });

    expect(
      result.runtimeReady,
    ).toHaveLength(
      plan.stages.length,
    );
    expect(
      result.manualRequired,
    ).toEqual([]);
    expect(
      result.experiments.find(
        (item) =>
          item.id ===
          "arena-repeat:all-arenas:20",
      ),
    ).toBeDefined();
  });

  it("does not invent player capacity", () => {
    const result =
      compileArenaRepeatedRunRuntime({
        plan:
          deriveArenaRepeatedRunValidationPlan(
            [1],
          ),
        arenaIds: ["arena-1"],
        arenaGenerations: {
          "arena-1": 1,
        },
        targetProfileFingerprint:
          "target",
        fixtureFingerprint:
          "fixture",
        objectiveId: "qa",
        participant: "result",
      });

    expect(
      result.manualRequired,
    ).toHaveLength(2);
  });

  it("rejects invalid repeated-run counts before compiling a runtime plan", () => {
    expect(() => deriveArenaRepeatedRunValidationPlan([1, 0]))
      .toThrow(/positive integer/);
  });
});
}

// Consolidated suite from engine/packages/orchestrator/test/arena/arena-tick-state-proof.test.ts
{
const layout = {
  basis: "topology" as const,
  canonical: {
    arenaId: "arena-1",
    anchor: { x: 0, y: 0, z: 0 },
  },
  replicas: [{
    arenaId: "arena-2",
    anchor: { x: 32, y: 0, z: 0 },
  }],
  offsets: [{ x: 32, y: 0, z: 0 }],
  confidence: "high" as const,
};
const regionPlan = {
  volumes: [{
    min: { x: 0, y: 0, z: 0 },
    max: { x: 15, y: 15, z: 15 },
    evidenceCandidateIds: [],
  }],
  boundingBox: {
    min: { x: 0, y: 0, z: 0 },
    max: { x: 15, y: 15, z: 15 },
  },
  totalBlocks: 4096,
  evidenceCandidates: 0,
  mergeGapBlocks: 0,
  confidence: "high" as const,
};

describe("arena queued tick state proof", () => {
  it("verifies translated queued-tick records", () => {
    const result = proveArenaTickStateEquivalence(
      layout,
      regionPlan,
      [
        {
          chunkX: 0,
          chunkZ: 0,
          dimensionId: 0,
          kind: "PendingTicks",
          valueHash: "same",
        },
        {
          chunkX: 2,
          chunkZ: 0,
          dimensionId: 0,
          kind: "PendingTicks",
          valueHash: "same",
        },
      ],
    );

    expect(result.status).toBe("verified");
    expect(result.replicas[0]?.matchesCanonical)
      .toBe(true);
  });

  it("fails closed when the native observation set is truncated", () => {
    const result = proveArenaTickStateEquivalence(
      layout,
      regionPlan,
      [],
      { observationsTruncated: true },
    );
    expect(result.status).toBe("incomplete");
  });

  it("does not claim raw tick equivalence for non chunk-aligned offsets", () => {
    const result = proveArenaTickStateEquivalence(
      {
        ...layout,
        replicas: [{
          arenaId: "arena-2",
          anchor: { x: 17, y: 0, z: 0 },
        }],
        offsets: [{ x: 17, y: 0, z: 0 }],
      },
      regionPlan,
      [],
    );
    expect(result.replicas[0]?.status)
      .toBe("incomplete");
  });
});
}
