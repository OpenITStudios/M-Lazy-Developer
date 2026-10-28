import { describe, expect, it } from "vitest";
import {
  deriveScriptProgressionActiveCallEvidence,
  deriveScriptProgressionActiveEventEvidence,
  deriveProgressionActiveStateValues,
  deriveScriptProgressionAdvanceEvidence,
  deriveScriptProgressionIdempotencyEvidence,
  deriveScriptProgressionOrdinalAdvanceEvidence,
  deriveScriptProgressionActiveTransitionEvidence,
  deriveScriptProgressionStateTransitionEvidence,
  deriveScriptProgressionActorRegistryEvidence,
  deriveScriptProgressionRuntimeEvidenceBundle,
} from "../../../src/domains/progression/progression-counter-evidence.js";

const source = {
  artifactId: "fixture",
  relativePath: "scripts/main.ts",
};

describe("progression active event evidence", () => {
  it("captures event activation only under a direct active state guard", () => {
    const result =
      deriveScriptProgressionActiveEventEvidence(
        [
          "function tick(entity, waveState) {",
          "  if (waveState === 'active') {",
          "    entity.triggerEvent('demo:despawn');",
          "  }",
          "  if (waveState === 'waiting') {",
          "    entity.triggerEvent('demo:other');",
          "  }",
          "}",
        ].join("\n"),
        source,
      );

    expect(result).toEqual([
      expect.objectContaining({
        event: "demo:despawn",
        executionRegion: "function:tick",
      }),
    ]);
  });
  it("captures helper calls made under a direct active state guard", () => {
    const result =
      deriveScriptProgressionActiveCallEvidence(
        [
          "function tick(entity, waveState) {",
          "  if (waveState === 'active') {",
          "    maybeDespawn(entity);",
          "  }",
          "}",
          "function maybeDespawn(entity) {}",
        ].join("\n"),
        source,
      );

    expect(result).toEqual([
      expect.objectContaining({
        callerRegion: "function:tick",
        targetName: "maybeDespawn",
      }),
    ]);
  });

  it("captures calls and events after a direct active-state transition in the same block", () => {
    const result =
      deriveScriptProgressionActiveTransitionEvidence(
        [
          "function startWave(entity) {",
          "  waveState = 'active';",
          "  updateWave(entity);",
          "  entity.triggerEvent('demo:despawn');",
          "}",
          "function updateWave(entity) {}",
        ].join("\n"),
        source,
      );

    expect(result.calls).toEqual([
      expect.objectContaining({
        callerRegion:
          "function:startWave",
        targetName: "updateWave",
        basis: "transition",
      }),
    ]);
    expect(result.events).toEqual([
      expect.objectContaining({
        executionRegion:
          "function:startWave",
        event: "demo:despawn",
        basis: "transition",
      }),
    ]);
  });

  it("stops transition ownership after a direct non-active state replacement", () => {
    const result =
      deriveScriptProgressionActiveTransitionEvidence(
        [
          "function startWave(entity) {",
          "  waveState = 'active';",
          "  waveState = 'waiting';",
          "  maybeDespawn(entity);",
          "}",
          "function maybeDespawn(entity) {}",
        ].join("\n"),
        source,
      );

    expect(result.calls).toEqual([]);
    expect(result.events).toEqual([]);
  });

  it("derives active aliases from declared transitions and stops before terminal states", () => {
    const values =
      deriveProgressionActiveStateValues([
        {
          from: "preparing",
          to: ["active"],
        },
        {
          from: "active",
          to: ["combat_live"],
        },
        {
          from: "combat_live",
          to: ["victory"],
        },
      ]);

    expect(values).toEqual([
      "active",
      "combat_live",
    ]);
  });

  it("uses a declared active alias in guards and direct state transitions", () => {
    const aliases = ["combat_live"];

    const calls =
      deriveScriptProgressionActiveCallEvidence(
        [
          "function tick(entity, waveState) {",
          "  if (waveState === 'combat_live') {",
          "    maybeDespawn(entity);",
          "  }",
          "}",
        ].join("\n"),
        source,
        aliases,
      );
    const transition =
      deriveScriptProgressionActiveTransitionEvidence(
        [
          "function enterCombat(entity) {",
          "  waveState = 'combat_live';",
          "  maybeDespawn(entity);",
          "}",
        ].join("\n"),
        source,
        aliases,
      );

    expect(calls).toEqual([
      expect.objectContaining({
        targetName: "maybeDespawn",
      }),
    ]);
    expect(transition.calls).toEqual([
      expect.objectContaining({
        targetName: "maybeDespawn",
        basis: "transition",
      }),
    ]);
  });

  it("extracts an actual guarded state transition from source", () => {
    const result =
      deriveScriptProgressionStateTransitionEvidence(
        [
          "function advance(waveState) {",
          "  if (waveState === 'preparing') {",
          "    waveState = 'combat_live';",
          "  }",
          "}",
        ].join("\n"),
        source,
      );

    expect(result).toEqual([
      expect.objectContaining({
        target: "waveState",
        from: "preparing",
        to: "combat_live",
        executionRegion:
          "function:advance",
      }),
    ]);
  });

  it("does not invent a transition when the assignment targets a different state owner", () => {
    const result =
      deriveScriptProgressionStateTransitionEvidence(
        [
          "function advance(waveState) {",
          "  if (waveState === 'preparing') {",
          "    uiState = 'combat_live';",
          "  }",
          "}",
        ].join("\n"),
        source,
      );

    expect(result).toEqual([]);
  });

  it("captures duplicate progression effects under the same completion gate", () => {
    const result =
      deriveScriptProgressionAdvanceEvidence(
        [
          "let remainingEnemies = 0;",
          "function maybeAdvance() {",
          "  if (remainingEnemies === 0) {",
          "    nextWave();",
          "    nextWave();",
          "  }",
          "}",
        ].join("\n"),
        source,
      );

    expect(result).toHaveLength(2);
    expect(result).toEqual([
      expect.objectContaining({
        counterId:
          "remainingEnemies",
        effectTarget: "nextWave",
        executionRegion:
          "function:maybeAdvance",
      }),
      expect.objectContaining({
        counterId:
          "remainingEnemies",
        effectTarget: "nextWave",
        executionRegion:
          "function:maybeAdvance",
      }),
    ]);
  });

  it("keeps a single progression effect as one exactly-once candidate", () => {
    const result =
      deriveScriptProgressionAdvanceEvidence(
        [
          "let remainingEnemies = 0;",
          "function maybeAdvance() {",
          "  if (remainingEnemies === 0) {",
          "    nextWave();",
          "  }",
          "}",
        ].join("\n"),
        source,
      );

    expect(result).toHaveLength(1);
  });

  it("extracts direct ordinal progression increments", () => {
    const result =
      deriveScriptProgressionOrdinalAdvanceEvidence(
        [
          "function advance() {",
          "  currentWave++;",
          "  round += 2;",
          "  score += 1;",
          "}",
        ].join("\n"),
        source,
      );

    expect(result).toEqual([
      expect.objectContaining({
        target: "currentWave",
        amount: 1,
        executionRegion:
          "function:advance",
      }),
      expect.objectContaining({
        target: "round",
        amount: 2,
        executionRegion:
          "function:advance",
      }),
    ]);
  });

  it("proves a boolean one-shot latch on a progression effect", () => {
    const result =
      deriveScriptProgressionIdempotencyEvidence(
        [
          "function nextWave() {",
          "  if (waveAdvancing) return;",
          "  waveAdvancing = true;",
          "  currentWave++;",
          "}",
        ].join("\n"),
        source,
      );

    expect(result).toEqual([
      expect.objectContaining({
        functionRegion:
          "function:nextWave",
        guardTarget:
          "waveAdvancing",
        kind: "boolean-latch",
      }),
    ]);
  });

  it("proves a state one-shot latch on a progression effect", () => {
    const result =
      deriveScriptProgressionIdempotencyEvidence(
        [
          "function nextWave() {",
          "  if (waveState !== 'active') return;",
          "  waveState = 'transitioning';",
          "  currentWave++;",
          "}",
        ].join("\n"),
        source,
      );

    expect(result).toEqual([
      expect.objectContaining({
        functionRegion:
          "function:nextWave",
        guardTarget: "waveState",
        kind: "state-latch",
      }),
    ]);
  });

  it("does not credit a latch installed after progression work", () => {
    const result =
      deriveScriptProgressionIdempotencyEvidence(
        [
          "function nextWave() {",
          "  if (waveAdvancing) return;",
          "  currentWave++;",
          "  waveAdvancing = true;",
          "}",
        ].join("\n"),
        source,
      );

    expect(result).toEqual([]);
  });

});

describe("progression actor registry evidence", () => {
  it("proves materialize release and zero-gate on one generation-bound registry", () => {
    const result =
      deriveScriptProgressionActorRegistryEvidence(
        [
          "function spawn(dimension, arena) {",
          "  const enemy = dimension.spawnEntity('demo:enemy', { x: 0, y: 0, z: 0 });",
          "  arena.enemyRegistryByGeneration.get(arena.generation).add(enemy.id);",
          "}",
          "function onDeath(event, arena) {",
          "  arena.enemyRegistryByGeneration.get(arena.generation).delete(event.deadEntity.id);",
          "}",
          "function maybeAdvance(arena) {",
          "  if (arena.enemyRegistryByGeneration.get(arena.generation).size === 0) nextWave();",
          "}",
        ].join("\n"),
        source,
      );

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "materialize",
          registryExpression:
            "arena.enemyRegistryByGeneration.get(arena.generation)",
          generationBound: true,
          actorIdentifier: "demo:enemy",
        }),
        expect.objectContaining({
          action: "release",
          generationBound: true,
        }),
        expect.objectContaining({
          action: "completion-check",
          generationBound: true,
        }),
      ]),
    );
  });

  it("keeps an unversioned registry generation-unbound", () => {
    const result =
      deriveScriptProgressionActorRegistryEvidence(
        [
          "function spawn(dimension, arena) {",
          "  const enemy = dimension.spawnEntity('demo:enemy', { x: 0, y: 0, z: 0 });",
          "  arena.enemies.add(enemy.id);",
          "}",
          "function onDeath(event, arena) {",
          "  arena.enemies.delete(event.deadEntity.id);",
          "}",
          "function maybeAdvance(arena) {",
          "  if (arena.enemies.size === 0) nextWave();",
          "}",
        ].join("\n"),
        source,
      );

    expect(result).toHaveLength(3);
    expect(
      result.every(
        (item) =>
          item.generationBound === false,
      ),
    ).toBe(true);
  });
});


describe("shared progression AST projection", () => {
  it("preserves each independent detector and source identity across positive and negative paths", () => {
    const text = [
      "let waveState = 'preparing';",
      "let remainingEnemies = 0;",
      "let waveAdvancing = false;",
      "function begin(entity) {",
      "  if (waveState === 'preparing') waveState = 'active';",
      "  if (waveState === 'active') {",
      "    entity.triggerEvent('test:awake');",
      "    announceActive(entity);",
      "  }",
      "  waveState = 'active';",
      "  notify(entity);",
      "  entity.triggerEvent('test:active');",
      "}",
      "function maybeAdvance() {",
      "  if (remainingEnemies === 0) { nextWave(); nextWave(); }",
      "}",
      "function nextWave() {",
      "  if (waveAdvancing) return;",
      "  waveAdvancing = true;",
      "  currentWave++;",
      "}",
      "function announceActive(entity) {}",
      "function notify(entity) {}",
    ].join("\n");
    const active = ["active", "combat_live"];
    const independent = {
      activeEvents: deriveScriptProgressionActiveEventEvidence(text, source, active),
      activeCalls: deriveScriptProgressionActiveCallEvidence(text, source, active),
      activeTransition: deriveScriptProgressionActiveTransitionEvidence(text, source, active),
      stateTransitions: deriveScriptProgressionStateTransitionEvidence(text, source),
      advances: deriveScriptProgressionAdvanceEvidence(text, source),
      ordinals: deriveScriptProgressionOrdinalAdvanceEvidence(text, source),
      idempotency: deriveScriptProgressionIdempotencyEvidence(text, source),
    };
    const bundled = deriveScriptProgressionRuntimeEvidenceBundle(text, source, active);
    expect(bundled).toEqual(independent);
    expect(bundled.activeEvents.length).toBeGreaterThan(0);
    expect(bundled.activeCalls.length).toBeGreaterThan(0);
    expect(bundled.activeTransition.calls.length).toBeGreaterThan(0);
    expect(bundled.advances.length).toBeGreaterThan(0);
    expect(Object.keys(bundled)).toEqual(Object.keys(independent));
    expect(JSON.stringify(bundled)).toBe(JSON.stringify(independent));
  });

  it("preserves uncertainty and does not create evidence from unrelated source", () => {
    const text = "function idle(entity) { entity.triggerEvent('test:idle'); }";
    const bundle = deriveScriptProgressionRuntimeEvidenceBundle(text, source, []);
    expect(bundle.activeEvents).toEqual([]);
    expect(bundle.activeTransition.events).toEqual([]);
    expect(bundle.stateTransitions).toEqual([]);
    expect(bundle.advances).toEqual([]);
  });
});
