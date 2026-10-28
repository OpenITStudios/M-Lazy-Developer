import { describe, expect, it } from "vitest";
import {
  deriveCrossFileCallEdges,
  deriveScriptTerminalIdempotencyEvidence,
  deriveScriptTerminalPrecedenceEvidence,
  parseScriptFile,
} from "../../../../analyzers/scripts/src/index.js";
import { analyzeArenaLifecycleConvergence } from "../../src/arena/arena-lifecycle-analysis.js";

describe("arena lifecycle convergence", () => {
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
