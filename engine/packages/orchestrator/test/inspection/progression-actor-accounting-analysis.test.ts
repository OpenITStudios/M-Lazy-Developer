import {
  describe,
  expect,
  it,
} from "vitest";
import {
  deriveCrossFileCallEdges,
  deriveProgressionActiveStateValues,
  deriveScriptProgressionAdvanceEvidence,
  deriveScriptProgressionIdempotencyEvidence,
  deriveScriptProgressionOrdinalAdvanceEvidence,
  deriveScriptProgressionActiveTransitionEvidence,
  deriveScriptProgressionStateTransitionEvidence,
  parseScriptFile,
} from "../../../../analyzers/scripts/src/index.js";
import {
  parseEntityDefinition,
} from "../../../../analyzers/entities/src/index.js";
import {
  analyzeProgressionActorAccounting,
} from "../../src/inspection/progression-actor-accounting-analysis.js";
import {
  analyzeArenaLifecycleConvergence,
} from "../../src/arena/arena-lifecycle-analysis.js";
import type {
  EntityEventExternalEvidence,
} from "../../src/inspection/entity-event-evidence.js";

function parsed(
  text: string,
  path = "scripts/main.ts",
) {
  return {
    parsed: parseScriptFile(
      path,
      text,
      {
        artifactId: "fixture",
        relativePath: path,
      },
    ),
    text,
  };
}

describe(
  "progression actor accounting analysis",
  () => {
    it("does not treat a diagnostic zero check as a progression completion gate", () => {
      const source = [
        "let remainingEnemies = 0;",
        "function spawnEnemy(dimension) {",
        "  dimension.spawnEntity('demo:enemy', { x: 0, y: 0, z: 0 });",
        "  remainingEnemies++;",
        "}",
        "function debug() {",
        "  if (remainingEnemies === 0) console.warn('zero');",
        "}",
      ].join("\n");

      const result =
        analyzeProgressionActorAccounting([
          parsed(source),
        ]);

      expect(
        result.provenMissingReconciliation,
      ).toBe(0);
      expect(result.counters[0]
        ?.completionChecks ?? 0)
        .toBe(0);
    });

    it("recognizes a zero gate that commits progression state", () => {
      const source = [
        "let remainingEnemies = 0;",
        "let waveState = 'active';",
        "function spawnEnemy(dimension) {",
        "  dimension.spawnEntity('demo:enemy', { x: 0, y: 0, z: 0 });",
        "  remainingEnemies++;",
        "}",
        "function maybeAdvance() {",
        "  if (remainingEnemies === 0) waveState = 'complete';",
        "}",
      ].join("\n");

      const result =
        analyzeProgressionActorAccounting([
          parsed(source),
        ]);

      expect(
        result.provenMissingReconciliation,
      ).toBe(1);
      expect(result.counters[0]
        ?.completionChecks)
        .toBe(1);
    });

    it("proves missing reconciliation when a strong actor counter only grows", () => {
      const result =
        analyzeProgressionActorAccounting([
          parsed([
            "let remainingEnemies = 0;",
            "function spawnEnemy(dimension) {",
            "  dimension.spawnEntity('demo:enemy', { x: 0, y: 0, z: 0 });",
            "  remainingEnemies += 1;",
            "}",
            "function maybeAdvance() {",
            "  if (remainingEnemies <= 0) nextWave();",
            "}",
          ].join("\n")),
        ]);

      expect(
        result.provenMissingReconciliation,
      ).toBe(1);
    });

    it("keeps a lifecycle decrement unresolved when actor identity is not guarded", () => {
      const source = [
        "let remainingEnemies = 0;",
        "world.afterEvents.entityDie.subscribe(() => {",
        "  decrementRemaining();",
        "});",
        "function spawnEnemy(dimension) {",
        "  dimension.spawnEntity('demo:enemy', { x: 0, y: 0, z: 0 });",
        "  remainingEnemies++;",
        "}",
        "function decrementRemaining() { remainingEnemies--; }",
        "function maybeAdvance() {",
        "  if (remainingEnemies === 0) nextWave();",
        "}",
      ].join("\n");

      const result =
        analyzeProgressionActorAccounting([
          parsed(source),
        ]);

      expect(
        result.unresolvedCounters,
      ).toBe(1);
      expect(result.counters[0])
        .toMatchObject({
          lifecycleLinkedDecrements: 1,
          actorIdentityStatus:
            "unresolved",
          status: "unresolved",
        });
    });

    it("proves matched actor identity from spawn through guarded death reconciliation", () => {
      const source = [
        "let remainingEnemies = 0;",
        "world.afterEvents.entityDie.subscribe((event) => {",
        "  if (event.deadEntity.typeId === 'demo:enemy') {",
        "    decrementRemaining();",
        "  }",
        "});",
        "function spawnEnemy(dimension) {",
        "  dimension.spawnEntity('demo:enemy', { x: 0, y: 0, z: 0 });",
        "  remainingEnemies++;",
        "}",
        "function decrementRemaining() { remainingEnemies--; }",
        "function maybeAdvance() {",
        "  if (remainingEnemies === 0) nextWave();",
        "}",
      ].join("\n");

      const result =
        analyzeProgressionActorAccounting([
          parsed(source),
        ]);

      expect(
        result
          .reconciledFromMatchedActorLifecycle,
      ).toBe(1);
      expect(result.counters[0])
        .toMatchObject({
          actorIdentityStatus: "matched",
          spawnLinkedActorIdentifiers: [
            "demo:enemy",
          ],
          lifecycleActorIdentifiers: [
            "demo:enemy",
          ],
          matchedActorIdentifiers: [
            "demo:enemy",
          ],
          spawnQuantityStatus:
            "matched",
          status:
            "reconciled-from-matched-actor-lifecycle",
        });
    });

    it("proves actor identity mismatch when growth and death reconciliation target different entity types", () => {
      const source = [
        "let remainingEnemies = 0;",
        "world.afterEvents.entityDie.subscribe((event) => {",
        "  if (event.deadEntity.typeId === 'demo:other') {",
        "    decrementRemaining();",
        "  }",
        "});",
        "function spawnEnemy(dimension) {",
        "  dimension.spawnEntity('demo:enemy', { x: 0, y: 0, z: 0 });",
        "  remainingEnemies++;",
        "}",
        "function decrementRemaining() { remainingEnemies--; }",
        "function maybeAdvance() {",
        "  if (remainingEnemies === 0) nextWave();",
        "}",
      ].join("\n");

      const result =
        analyzeProgressionActorAccounting([
          parsed(source),
        ]);

      expect(
        result.provenActorIdentityMismatch,
      ).toBe(1);
      expect(result.counters[0])
        .toMatchObject({
          actorIdentityStatus: "mismatch",
          spawnLinkedActorIdentifiers: [
            "demo:enemy",
          ],
          lifecycleActorIdentifiers: [
            "demo:other",
          ],
          matchedActorIdentifiers: [],
          status:
            "actor-identity-mismatch",
        });
    });

    it("proves deterministic spawn quantity mismatch against actor counter growth", () => {
      const source = [
        "let remainingEnemies = 0;",
        "world.afterEvents.entityDie.subscribe((event) => {",
        "  if (event.deadEntity.typeId === 'demo:enemy') decrementRemaining();",
        "});",
        "function spawnWave(dimension) {",
        "  dimension.spawnEntity('demo:enemy', { x: 0, y: 0, z: 0 });",
        "  remainingEnemies += 2;",
        "}",
        "function decrementRemaining() { remainingEnemies--; }",
        "function maybeAdvance() { if (remainingEnemies === 0) nextWave(); }",
      ].join("\n");

      const result =
        analyzeProgressionActorAccounting([
          parsed(source),
        ]);

      expect(
        result.provenSpawnQuantityMismatch,
      ).toBe(1);
      expect(result.counters[0])
        .toMatchObject({
          spawnQuantityStatus:
            "mismatch",
          quantityComparableGrowths: 1,
          quantityMismatchGrowths: 1,
          status:
            "spawn-quantity-mismatch",
        });
    });

    it("preserves distinct direct spawn calls when proving quantity equality", () => {
      const source = [
        "let remainingEnemies = 0;",
        "world.afterEvents.entityDie.subscribe((event) => {",
        "  if (event.deadEntity.typeId === 'demo:enemy') decrementRemaining();",
        "});",
        "function spawnWave(dimension) {",
        "  dimension.spawnEntity('demo:enemy', { x: 0, y: 0, z: 0 });",
        "  dimension.spawnEntity('demo:enemy', { x: 1, y: 0, z: 0 });",
        "  remainingEnemies += 2;",
        "}",
        "function decrementRemaining() { remainingEnemies--; }",
        "function maybeAdvance() { if (remainingEnemies === 0) nextWave(); }",
      ].join("\n");

      const result =
        analyzeProgressionActorAccounting([
          parsed(source),
        ]);

      expect(
        result.provenSpawnQuantityMismatch,
      ).toBe(0);
      expect(result.counters[0])
        .toMatchObject({
          spawnQuantityStatus: "matched",
          quantityComparableGrowths: 1,
          quantityMatchedGrowths: 1,
          reconciliationLifecycleKinds: [
            "death",
          ],
          status:
            "reconciled-from-matched-actor-lifecycle",
        });
    });

    it("keeps looped spawn quantity unresolved instead of inventing a mismatch", () => {
      const source = [
        "let remainingEnemies = 0;",
        "function spawnWave(dimension) {",
        "  for (let i = 0; i < 3; i++) {",
        "    dimension.spawnEntity('demo:enemy', { x: 0, y: 0, z: 0 });",
        "  }",
        "  remainingEnemies += 3;",
        "}",
        "function maybeAdvance() { if (remainingEnemies === 0) nextWave(); }",
      ].join("\n");

      const result =
        analyzeProgressionActorAccounting([
          parsed(source),
        ]);

      expect(
        result.provenSpawnQuantityMismatch,
      ).toBe(0);
      expect(result.counters[0]
        ?.spawnQuantityStatus)
        .toBe("unresolved");
    });

    it("accepts non-death entity-remove reconciliation when the same actor identity reaches decrement", () => {
      const source = [
        "let remainingEnemies = 0;",
        "world.afterEvents.entityRemove.subscribe((event) => {",
        "  if (event.entity.typeId === 'demo:enemy') decrementRemaining();",
        "});",
        "function spawnEnemy(dimension) {",
        "  dimension.spawnEntity('demo:enemy', { x: 0, y: 0, z: 0 });",
        "  remainingEnemies++;",
        "}",
        "function decrementRemaining() { remainingEnemies--; }",
        "function maybeAdvance() { if (remainingEnemies === 0) nextWave(); }",
      ].join("\n");

      const result =
        analyzeProgressionActorAccounting([
          parsed(source),
        ]);

      expect(
        result
          .reconciledFromMatchedActorLifecycle,
      ).toBe(1);
      expect(result.counters[0])
        .toMatchObject({
          actorIdentityStatus: "matched",
          spawnQuantityStatus: "matched",
          reconciliationLifecycleKinds: [
            "remove",
          ],
          removeLinkedDecrements: 1,
          status:
            "reconciled-from-matched-actor-lifecycle",
        });
    });

    it("keeps scripted non-death removal without counter reconciliation as explicit gray-zone evidence", () => {
      const source = [
        "let remainingEnemies = 0;",
        "function spawnEnemy(dimension) {",
        "  dimension.spawnEntity('demo:enemy', { x: 0, y: 0, z: 0 });",
        "  remainingEnemies++;",
        "}",
        "function cleanupEntity(entity) {",
        "  if (entity.typeId === 'demo:enemy') entity.remove();",
        "}",
        "function maybeAdvance() { if (remainingEnemies === 0) nextWave(); }",
      ].join("\n");

      const result =
        analyzeProgressionActorAccounting([
          parsed(source),
        ]);

      expect(
        result.scriptedRemovalCoverageGaps,
      ).toBe(1);
      expect(result.counters[0])
        .toMatchObject({
          scriptedRemovalCoverage:
            "uncovered",
          scriptedRemovalActorIdentifiers: [
            "demo:enemy",
          ],
          uncoveredScriptedRemovalActorIdentifiers: [
            "demo:enemy",
          ],
        });
    });

    it("closes scripted removal coverage when entityRemove for the same actor reaches decrement", () => {
      const source = [
        "let remainingEnemies = 0;",
        "world.afterEvents.entityRemove.subscribe((event) => {",
        "  if (event.entity.typeId === 'demo:enemy') decrementRemaining();",
        "});",
        "function spawnEnemy(dimension) {",
        "  dimension.spawnEntity('demo:enemy', { x: 0, y: 0, z: 0 });",
        "  remainingEnemies++;",
        "}",
        "function cleanupEntity(entity) {",
        "  if (entity.typeId === 'demo:enemy') entity.remove();",
        "}",
        "function decrementRemaining() { remainingEnemies--; }",
        "function maybeAdvance() { if (remainingEnemies === 0) nextWave(); }",
      ].join("\n");

      const result =
        analyzeProgressionActorAccounting([
          parsed(source),
        ]);

      expect(
        result.scriptedRemovalCoverageGaps,
      ).toBe(0);
      expect(result.counters[0])
        .toMatchObject({
          scriptedRemovalCoverage:
            "covered",
          removeLifecycleActorIdentifiers: [
            "demo:enemy",
          ],
        });
    });

    it("detects exact kill-selector disappearance for counted actor type", () => {
      const source = [
        "let remainingEnemies = 0;",
        "function spawnEnemy(dimension) {",
        "  dimension.spawnEntity('demo:enemy', { x: 0, y: 0, z: 0 });",
        "  remainingEnemies++;",
        "}",
        "function cleanup(dimension) {",
        "  dimension.runCommand('kill @e[type=demo:enemy]');",
        "}",
        "function maybeAdvance() { if (remainingEnemies === 0) nextWave(); }",
      ].join("\n");

      const result =
        analyzeProgressionActorAccounting([
          parsed(source),
        ]);

      expect(
        result.scriptedRemovalCoverageGaps,
      ).toBe(1);
      expect(result.counters[0]
        ?.scriptedRemovalActorIdentifiers)
        .toEqual(["demo:enemy"]);
    });

    it("proves base instant-despawn can strand a counted actor counter when remove reconciliation is absent", () => {
      const source = [
        "let remainingEnemies = 0;",
        "function spawnEnemy(dimension) {",
        "  dimension.spawnEntity('demo:enemy', { x: 0, y: 0, z: 0 });",
        "  remainingEnemies++;",
        "}",
        "function maybeAdvance() { if (remainingEnemies === 0) nextWave(); }",
      ].join("\n");
      const entity =
        parseEntityDefinition(
          {
            "minecraft:entity": {
              description: {
                identifier:
                  "demo:enemy",
              },
              components: {
                "minecraft:instant_despawn": {},
              },
            },
          },
          {
            artifactId: "fixture",
            relativePath:
              "entities/enemy.json",
          },
        );

      const result =
        analyzeProgressionActorAccounting(
          [parsed(source)],
          [],
          [entity],
        );

      expect(
        result
          .provenImmediateDespawnWithoutReconciliation,
      ).toBe(1);
      expect(result.counters[0])
        .toMatchObject({
          immediateDespawnActorIdentifiers: [
            "demo:enemy",
          ],
          uncoveredImmediateDespawnActorIdentifiers: [
            "demo:enemy",
          ],
          status:
            "instant-despawn-without-reconciliation",
        });
    });

    it("keeps component-group despawn as unresolved until activation reachability is proven", () => {
      const source = [
        "let remainingEnemies = 0;",
        "function spawnEnemy(dimension) {",
        "  dimension.spawnEntity('demo:enemy', { x: 0, y: 0, z: 0 });",
        "  remainingEnemies++;",
        "}",
        "function maybeAdvance() { if (remainingEnemies === 0) nextWave(); }",
      ].join("\n");
      const entity =
        parseEntityDefinition(
          {
            "minecraft:entity": {
              description: {
                identifier:
                  "demo:enemy",
              },
              component_groups: {
                despawn_state: {
                  "minecraft:instant_despawn": {},
                },
              },
              events: {
                "demo:despawn": {
                  add: {
                    component_groups: [
                      "despawn_state",
                    ],
                  },
                },
              },
            },
          },
          {
            artifactId: "fixture",
            relativePath:
              "entities/enemy.json",
          },
        );

      const result =
        analyzeProgressionActorAccounting(
          [parsed(source)],
          [],
          [entity],
        );

      expect(
        result.conditionalDespawnUnknowns,
      ).toBe(1);
      expect(result.counters[0])
        .toMatchObject({
          conditionalDespawnActorIdentifiers: [
            "demo:enemy",
          ],
          unresolvedConditionalDespawnActorIdentifiers: [
            "demo:enemy",
          ],
          status: "unresolved",
        });
    });

    it("proves exact instant-despawn activation during active wave state when reconciliation is absent", () => {
      const source = [
        "let remainingEnemies = 0;",
        "function spawnEnemy(dimension) {",
        "  dimension.spawnEntity('demo:enemy', { x: 0, y: 0, z: 0 });",
        "  remainingEnemies++;",
        "}",
        "function tick(entity, waveState) {",
        "  if (waveState === 'active') {",
        "    entity.triggerEvent('demo:despawn');",
        "  }",
        "}",
        "function maybeAdvance() { if (remainingEnemies === 0) nextWave(); }",
      ].join("\n");
      const input = parsed(source);
      const entity =
        parseEntityDefinition(
          {
            "minecraft:entity": {
              description: { identifier: "demo:enemy" },
              component_groups: {
                despawn_state: {
                  "minecraft:instant_despawn": {},
                },
              },
              events: {
                "demo:despawn": {
                  add: {
                    component_groups: ["despawn_state"],
                  },
                },
              },
            },
          },
          {
            artifactId: "fixture",
            relativePath: "entities/enemy.json",
          },
        );
      const external:
        EntityEventExternalEvidence[] = [{
          event: "demo:despawn",
          kind: "event-command",
          entityIdentifier: "demo:enemy",
          executionRegion: "function:tick",
          source: input.parsed.source,
        }];
      const active = [{
        event: "demo:despawn",
        executionRegion: "function:tick",
        source: input.parsed.source,
      }];

      const result =
        analyzeProgressionActorAccounting(
          [input],
          [],
          [entity],
          undefined,
          external,
          active,
        );

      expect(
        result
          .provenActiveInstantDespawnWithoutReconciliation,
      ).toBe(1);
      expect(result.counters[0])
        .toMatchObject({
          activeInstantDespawnActorIdentifiers: ["demo:enemy"],
          uncoveredActiveInstantDespawnActorIdentifiers: ["demo:enemy"],
          status:
            "active-instant-despawn-without-reconciliation",
        });
    });

    it("proves active instant-despawn through a local helper call", () => {
      const source = [
        "let remainingEnemies = 0;",
        "function spawnEnemy(dimension) {",
        "  dimension.spawnEntity('demo:enemy', { x: 0, y: 0, z: 0 });",
        "  remainingEnemies++;",
        "}",
        "function tick(entity, waveState) {",
        "  if (waveState === 'active') {",
        "    maybeDespawn(entity);",
        "  }",
        "}",
        "function maybeDespawn(entity) {",
        "  entity.triggerEvent('demo:despawn');",
        "}",
        "function maybeAdvance() { if (remainingEnemies === 0) nextWave(); }",
      ].join("\n");
      const input = parsed(source);
      const entity =
        parseEntityDefinition(
          {
            "minecraft:entity": {
              description: { identifier: "demo:enemy" },
              component_groups: {
                despawn_state: {
                  "minecraft:instant_despawn": {},
                },
              },
              events: {
                "demo:despawn": {
                  add: {
                    component_groups: ["despawn_state"],
                  },
                },
              },
            },
          },
          {
            artifactId: "fixture",
            relativePath: "entities/enemy.json",
          },
        );
      const external:
        EntityEventExternalEvidence[] = [{
          event: "demo:despawn",
          kind: "event-command",
          entityIdentifier: "demo:enemy",
          executionRegion: "function:maybeDespawn",
          source: input.parsed.source,
        }];
      const activeCalls = [{
        callerRegion: "function:tick",
        targetName: "maybeDespawn",
        source: input.parsed.source,
      }];

      const result =
        analyzeProgressionActorAccounting(
          [input],
          [],
          [entity],
          undefined,
          external,
          [],
          activeCalls,
        );

      expect(
        result.provenActiveInstantDespawnWithoutReconciliation,
      ).toBe(1);
      expect(result.activeInterproceduralProofs)
        .toBeGreaterThan(0);
    });

    it("proves active instant-despawn through an imported helper call", () => {
      const mainText = [
        'import { maybeDespawn } from "./despawn.js";',
        "function tick(entity, waveState) {",
        "  if (waveState === 'active') {",
        "    maybeDespawn(entity);",
        "  }",
        "}",
      ].join("\n");
      const helperText = [
        "export function maybeDespawn(entity) {",
        "  entity.triggerEvent('demo:despawn');",
        "}",
      ].join("\n");
      const counterText = [
        "export let remainingEnemies = 0;",
        "export function spawnEnemy(dimension) {",
        "  dimension.spawnEntity('demo:enemy', { x: 0, y: 0, z: 0 });",
        "  remainingEnemies++;",
        "}",
        "export function maybeAdvance() { if (remainingEnemies === 0) nextWave(); }",
      ].join("\n");
      const main = parsed(mainText, "scripts/main.ts");
      const helper = parsed(helperText, "scripts/despawn.ts");
      const counter = parsed(counterText, "scripts/counter.ts");
      const calls =
        deriveCrossFileCallEdges([
          {
            path: "scripts/main.ts",
            text: mainText,
            source: main.parsed.source,
          },
          {
            path: "scripts/despawn.ts",
            text: helperText,
            source: helper.parsed.source,
          },
          {
            path: "scripts/counter.ts",
            text: counterText,
            source: counter.parsed.source,
          },
        ]);
      const entity =
        parseEntityDefinition(
          {
            "minecraft:entity": {
              description: { identifier: "demo:enemy" },
              component_groups: {
                despawn_state: {
                  "minecraft:instant_despawn": {},
                },
              },
              events: {
                "demo:despawn": {
                  add: {
                    component_groups: ["despawn_state"],
                  },
                },
              },
            },
          },
          {
            artifactId: "fixture",
            relativePath: "entities/enemy.json",
          },
        );
      const external:
        EntityEventExternalEvidence[] = [{
          event: "demo:despawn",
          kind: "event-command",
          entityIdentifier: "demo:enemy",
          executionRegion: "function:maybeDespawn",
          source: helper.parsed.source,
        }];
      const activeCalls = [{
        callerRegion: "function:tick",
        targetName: "maybeDespawn",
        source: main.parsed.source,
      }];

      const result =
        analyzeProgressionActorAccounting(
          [main, helper, counter],
          calls,
          [entity],
          undefined,
          external,
          [],
          activeCalls,
        );

      expect(
        result.provenActiveInstantDespawnWithoutReconciliation,
      ).toBe(1);
      expect(result.activeInterproceduralProofs)
        .toBeGreaterThan(0);
    });

    it("proves active instant-despawn after a direct active-state transition and helper call", () => {
      const source = [
        "let remainingEnemies = 0;",
        "function spawnEnemy(dimension) {",
        "  dimension.spawnEntity('demo:enemy', { x: 0, y: 0, z: 0 });",
        "  remainingEnemies++;",
        "}",
        "function startWave(entity) {",
        "  waveState = 'active';",
        "  maybeDespawn(entity);",
        "}",
        "function maybeDespawn(entity) {",
        "  entity.triggerEvent('demo:despawn');",
        "}",
        "function maybeAdvance() { if (remainingEnemies === 0) nextWave(); }",
      ].join("\n");
      const input = parsed(source);
      const transition =
        deriveScriptProgressionActiveTransitionEvidence(
          source,
          input.parsed.source,
        );
      const entity =
        parseEntityDefinition(
          {
            "minecraft:entity": {
              description: {
                identifier: "demo:enemy",
              },
              component_groups: {
                despawn_state: {
                  "minecraft:instant_despawn": {},
                },
              },
              events: {
                "demo:despawn": {
                  add: {
                    component_groups: [
                      "despawn_state",
                    ],
                  },
                },
              },
            },
          },
          {
            artifactId: "fixture",
            relativePath:
              "entities/enemy.json",
          },
        );
      const external:
        EntityEventExternalEvidence[] = [{
          event: "demo:despawn",
          kind: "event-command",
          entityIdentifier:
            "demo:enemy",
          executionRegion:
            "function:maybeDespawn",
          source: input.parsed.source,
        }];

      const result =
        analyzeProgressionActorAccounting(
          [input],
          [],
          [entity],
          undefined,
          external,
          transition.events,
          transition.calls,
        );

      expect(
        result.provenActiveInstantDespawnWithoutReconciliation,
      ).toBe(1);
      expect(
        result.activeTransitionProofs,
      ).toBeGreaterThan(0);
    });

    it("propagates direct active-state transition ownership through an imported helper", () => {
      const mainText = [
        'import { maybeDespawn } from "./despawn.js";',
        "function startWave(entity) {",
        "  waveState = 'active';",
        "  maybeDespawn(entity);",
        "}",
      ].join("\n");
      const helperText = [
        "export function maybeDespawn(entity) {",
        "  entity.triggerEvent('demo:despawn');",
        "}",
      ].join("\n");
      const counterText = [
        "export let remainingEnemies = 0;",
        "export function spawnEnemy(dimension) {",
        "  dimension.spawnEntity('demo:enemy', { x: 0, y: 0, z: 0 });",
        "  remainingEnemies++;",
        "}",
        "export function maybeAdvance() { if (remainingEnemies === 0) nextWave(); }",
      ].join("\n");
      const main =
        parsed(
          mainText,
          "scripts/main.ts",
        );
      const helper =
        parsed(
          helperText,
          "scripts/despawn.ts",
        );
      const counter =
        parsed(
          counterText,
          "scripts/counter.ts",
        );
      const calls =
        deriveCrossFileCallEdges([
          {
            path: "scripts/main.ts",
            text: mainText,
            source:
              main.parsed.source,
          },
          {
            path:
              "scripts/despawn.ts",
            text: helperText,
            source:
              helper.parsed.source,
          },
          {
            path:
              "scripts/counter.ts",
            text: counterText,
            source:
              counter.parsed.source,
          },
        ]);
      const transition =
        deriveScriptProgressionActiveTransitionEvidence(
          mainText,
          main.parsed.source,
        );
      const entity =
        parseEntityDefinition(
          {
            "minecraft:entity": {
              description: {
                identifier:
                  "demo:enemy",
              },
              component_groups: {
                despawn_state: {
                  "minecraft:instant_despawn": {},
                },
              },
              events: {
                "demo:despawn": {
                  add: {
                    component_groups: [
                      "despawn_state",
                    ],
                  },
                },
              },
            },
          },
          {
            artifactId: "fixture",
            relativePath:
              "entities/enemy.json",
          },
        );
      const external:
        EntityEventExternalEvidence[] = [{
          event: "demo:despawn",
          kind: "event-command",
          entityIdentifier:
            "demo:enemy",
          executionRegion:
            "function:maybeDespawn",
          source:
            helper.parsed.source,
        }];

      const result =
        analyzeProgressionActorAccounting(
          [main, helper, counter],
          calls,
          [entity],
          undefined,
          external,
          [],
          transition.calls,
        );

      expect(
        result.provenActiveInstantDespawnWithoutReconciliation,
      ).toBe(1);
      expect(
        result.activeTransitionProofs,
      ).toBeGreaterThan(0);
    });

    it("proves two callbacks on the same exact event double-advance one wave ordinal", () => {
      const source = [
        "world.afterEvents.entityDie.subscribe(() => {",
        "  currentWave++;",
        "});",
        "world.afterEvents.entityDie.subscribe(() => {",
        "  currentWave++;",
        "});",
      ].join("\n");
      const input = parsed(source);
      const ordinal =
        deriveScriptProgressionOrdinalAdvanceEvidence(
          source,
          input.parsed.source,
        );

      const result =
        analyzeProgressionActorAccounting(
          [input],
          [],
          [],
          undefined,
          [],
          [],
          [],
          [],
          [],
          ordinal,
        );

      expect(
        result.provenCrossIngressOrdinalAdvances,
      ).toBe(1);
      expect(
        result.crossIngressOrdinalAdvances[0],
      ).toMatchObject({
        ingress:
          "world.afterEvents.entityDie",
        target: "currentWave",
        totalAmount: 2,
      });
    });

    it("retains each event of a shared named callback in both progression proofs", () => {
      const directSource = [
        'import { world } from "@minecraft/server";',
        "let currentWave = 0;",
        "function onShared() { currentWave++; }",
        "function onDeath() { currentWave++; }",
        "world.afterEvents.entityDie.subscribe(onShared);",
        "world.afterEvents.playerLeave.subscribe(onShared);",
        "world.afterEvents.entityDie.subscribe(onDeath);",
      ].join("\n");
      const direct = parsed(directSource);
      const directOrdinal =
        deriveScriptProgressionOrdinalAdvanceEvidence(
          directSource,
          direct.parsed.source,
        );
      const directResult = analyzeProgressionActorAccounting(
        [direct], [], [], undefined, [], [], [], [], [],
        directOrdinal,
      );
      expect(directResult.provenCrossIngressOrdinalAdvances).toBe(1);
      expect(directResult.crossIngressOrdinalAdvances).toMatchObject([{
        ingress: "world.afterEvents.entityDie",
        target: "currentWave",
        totalAmount: 2,
      }]);

      const indirectSource = [
        'import { world } from "@minecraft/server";',
        "let currentWave = 0;",
        "function nextWave() { currentWave++; }",
        "function onShared() { nextWave(); }",
        "function onDeath() { nextWave(); }",
        "world.afterEvents.entityDie.subscribe(onShared);",
        "world.afterEvents.playerLeave.subscribe(onShared);",
        "world.afterEvents.entityDie.subscribe(onDeath);",
      ].join("\n");
      const indirect = parsed(indirectSource);
      const indirectOrdinal =
        deriveScriptProgressionOrdinalAdvanceEvidence(
          indirectSource,
          indirect.parsed.source,
        );
      const indirectResult = analyzeProgressionActorAccounting(
        [indirect], [], [], undefined, [], [], [], [], [],
        indirectOrdinal,
      );
      expect(indirectResult.provenCrossIngressEffectCalls).toBe(1);
      expect(indirectResult.crossIngressEffectCalls).toMatchObject([{
        ingress: "world.afterEvents.entityDie",
        status: "contradicted",
        directOrdinalAmount: 1,
      }]);
    });

    it("does not merge different event types into one proven ordinal cross-ingress", () => {
      const source = [
        "world.afterEvents.entityDie.subscribe(() => {",
        "  currentWave++;",
        "});",
        "world.afterEvents.playerLeave.subscribe(() => {",
        "  currentWave++;",
        "});",
      ].join("\n");
      const input = parsed(source);
      const ordinal =
        deriveScriptProgressionOrdinalAdvanceEvidence(
          source,
          input.parsed.source,
        );

      const result =
        analyzeProgressionActorAccounting(
          [input],
          [],
          [],
          undefined,
          [],
          [],
          [],
          [],
          [],
          ordinal,
        );

      expect(
        result.provenCrossIngressOrdinalAdvances,
      ).toBe(0);
    });

    it("proves same-event duplicate effect calls when the target directly advances progression", () => {
      const source = [
        "function nextWave() {",
        "  currentWave++;",
        "}",
        "world.afterEvents.entityDie.subscribe(() => {",
        "  nextWave();",
        "});",
        "world.afterEvents.entityDie.subscribe(() => {",
        "  nextWave();",
        "});",
      ].join("\n");
      const input = parsed(source);
      const ordinal =
        deriveScriptProgressionOrdinalAdvanceEvidence(
          source,
          input.parsed.source,
        );
      const idempotency =
        deriveScriptProgressionIdempotencyEvidence(
          source,
          input.parsed.source,
        );

      const result =
        analyzeProgressionActorAccounting(
          [input],
          [],
          [],
          undefined,
          [],
          [],
          [],
          [],
          [],
          ordinal,
          idempotency,
        );

      expect(
        result.provenCrossIngressEffectCalls,
      ).toBe(1);
      expect(
        result.crossIngressEffectCalls[0],
      ).toMatchObject({
        ingress:
          "world.afterEvents.entityDie",
        status: "contradicted",
        directOrdinalAmount: 1,
      });
    });

    it("closes same-event duplicate effect calls when the target has a source-proven one-shot latch", () => {
      const source = [
        "let waveAdvancing = false;",
        "function nextWave() {",
        "  if (waveAdvancing) return;",
        "  waveAdvancing = true;",
        "  currentWave++;",
        "}",
        "world.afterEvents.entityDie.subscribe(() => {",
        "  nextWave();",
        "});",
        "world.afterEvents.entityDie.subscribe(() => {",
        "  nextWave();",
        "});",
      ].join("\n");
      const input = parsed(source);
      const ordinal =
        deriveScriptProgressionOrdinalAdvanceEvidence(
          source,
          input.parsed.source,
        );
      const idempotency =
        deriveScriptProgressionIdempotencyEvidence(
          source,
          input.parsed.source,
        );

      const result =
        analyzeProgressionActorAccounting(
          [input],
          [],
          [],
          undefined,
          [],
          [],
          [],
          [],
          [],
          ordinal,
          idempotency,
        );

      expect(
        result.idempotentCrossIngressEffectCalls,
      ).toBe(1);
      expect(
        result.provenCrossIngressEffectCalls,
      ).toBe(0);
      expect(
        result.crossIngressEffectCalls[0],
      ).toMatchObject({
        status: "idempotent",
        idempotencyKind:
          "boolean-latch",
      });
    });

    it("keeps same-event duplicate effect calls unresolved when target semantics are indirect and no latch is proven", () => {
      const source = [
        "function nextWave() {",
        "  scheduleWaveLoad();",
        "}",
        "function scheduleWaveLoad() {}",
        "world.afterEvents.entityDie.subscribe(() => {",
        "  nextWave();",
        "});",
        "world.afterEvents.entityDie.subscribe(() => {",
        "  nextWave();",
        "});",
      ].join("\n");
      const input = parsed(source);

      const result =
        analyzeProgressionActorAccounting(
          [input],
        );

      expect(
        result.unresolvedCrossIngressEffectCalls,
      ).toBe(1);
      expect(
        result.crossIngressEffectCalls[0]
          ?.status,
      ).toBe("unresolved");
    });

    it("proves duplicate next-wave ownership under one completion gate", () => {
      const source = [
        "let remainingEnemies = 0;",
        "function maybeAdvance() {",
        "  if (remainingEnemies === 0) {",
        "    nextWave();",
        "    nextWave();",
        "  }",
        "}",
      ].join("\n");
      const input = parsed(source);
      const advances =
        deriveScriptProgressionAdvanceEvidence(
          source,
          input.parsed.source,
        );

      const result =
        analyzeProgressionActorAccounting(
          [input],
          [],
          [],
          undefined,
          [],
          [],
          [],
          [],
          advances,
        );

      expect(
        result.duplicateProgressionAdvances,
      ).toBe(1);
      expect(
        result.progressionAdvances[0],
      ).toMatchObject({
        counterId:
          "remainingEnemies",
        effectTarget: "nextWave",
        calls: 2,
        status: "duplicate",
      });
    });

    it("accepts one next-wave invocation for one completion gate", () => {
      const source = [
        "let remainingEnemies = 0;",
        "function maybeAdvance() {",
        "  if (remainingEnemies === 0) {",
        "    nextWave();",
        "  }",
        "}",
      ].join("\n");
      const input = parsed(source);
      const advances =
        deriveScriptProgressionAdvanceEvidence(
          source,
          input.parsed.source,
        );

      const result =
        analyzeProgressionActorAccounting(
          [input],
          [],
          [],
          undefined,
          [],
          [],
          [],
          [],
          advances,
        );

      expect(
        result.duplicateProgressionAdvances,
      ).toBe(0);
      expect(
        result.progressionAdvances[0]
          ?.status,
      ).toBe("single");
    });

    it("proves an authored active-reachable state-machine dead-end", () => {
      const source = [
        "type WaveState = 'active' | 'combat_stuck' | 'victory';",
        "const waveTransitions: Record<WaveState, readonly WaveState[]> = {",
        "  active: ['combat_stuck', 'victory'],",
        "  combat_stuck: [],",
        "  victory: [],",
        "};",
      ].join("\n");
      const input = parsed(source);

      const result =
        analyzeProgressionActorAccounting(
          [input],
        );

      expect(
        result.deadEndStateMachines,
      ).toBe(1);
      expect(
        result.stateMachines[0],
      ).toMatchObject({
        tableName:
          "waveTransitions",
        status: "dead-end",
        activeStates: [
          "active",
          "combat_stuck",
        ],
        terminalStates: [
          "victory",
        ],
        deadEndStates: [
          "combat_stuck",
        ],
      });
    });

    it("accepts an authored active state-machine with a legal terminal path", () => {
      const source = [
        "type WaveState = 'active' | 'combat_live' | 'victory';",
        "const waveTransitions: Record<WaveState, readonly WaveState[]> = {",
        "  active: ['combat_live'],",
        "  combat_live: ['victory'],",
        "  victory: [],",
        "};",
      ].join("\n");
      const input = parsed(source);

      const result =
        analyzeProgressionActorAccounting(
          [input],
        );

      expect(
        result.completeStateMachines,
      ).toBe(1);
      expect(
        result.deadEndStateMachines,
      ).toBe(0);
    });

    it("keeps a progression-like table unresolved when no terminal state is authored", () => {
      const source = [
        "type WaveState = 'active' | 'combat_live';",
        "const waveTransitions: Record<WaveState, readonly WaveState[]> = {",
        "  active: ['combat_live'],",
        "  combat_live: [],",
        "};",
      ].join("\n");
      const input = parsed(source);

      const result =
        analyzeProgressionActorAccounting(
          [input],
        );

      expect(
        result.unresolvedStateMachines,
      ).toBe(1);
      expect(
        result.deadEndStateMachines,
      ).toBe(0);
    });

    it("records when valid source flow enters an authored dead-end state", () => {
      const source = [
        "type WaveState = 'active' | 'combat_stuck' | 'victory';",
        "const waveTransitions: Record<WaveState, readonly WaveState[]> = {",
        "  active: ['combat_stuck', 'victory'],",
        "  combat_stuck: [],",
        "  victory: [],",
        "};",
        "function advance(waveState) {",
        "  if (waveState === 'active') {",
        "    waveState = 'combat_stuck';",
        "  }",
        "}",
      ].join("\n");
      const input = parsed(source);
      const actual =
        deriveScriptProgressionStateTransitionEvidence(
          source,
          input.parsed.source,
        );

      const result =
        analyzeProgressionActorAccounting(
          [input],
          [],
          [],
          undefined,
          [],
          [],
          [],
          actual,
        );

      expect(
        result.sourceEnteredDeadEndStates,
      ).toBe(1);
      expect(
        result.stateMachines[0]
          ?.sourceEnteredDeadEndStates,
      ).toEqual([
        "combat_stuck",
      ]);
    });

    it("proves a guarded transition that skips the authored state-machine contract", () => {
      const source = [
        "type WaveState = 'preparing' | 'active' | 'combat_live' | 'victory';",
        "const waveTransitions: Record<WaveState, readonly WaveState[]> = {",
        "  preparing: ['active'],",
        "  active: ['combat_live'],",
        "  combat_live: ['victory'],",
        "  victory: [],",
        "};",
        "function advance(waveState) {",
        "  if (waveState === 'preparing') {",
        "    waveState = 'combat_live';",
        "  }",
        "}",
      ].join("\n");
      const input = parsed(source);
      const actual =
        deriveScriptProgressionStateTransitionEvidence(
          source,
          input.parsed.source,
        );

      const result =
        analyzeProgressionActorAccounting(
          [input],
          [],
          [],
          undefined,
          [],
          [],
          [],
          actual,
        );

      expect(
        result.invalidStateTransitions,
      ).toBe(1);
      expect(
        result.stateTransitions[0],
      ).toMatchObject({
        target: "waveState",
        from: "preparing",
        to: "combat_live",
        tableName:
          "waveTransitions",
        status: "invalid",
        allowedTargets: ["active"],
      });
    });

    it("accepts a guarded transition allowed by the authored state-machine contract", () => {
      const source = [
        "type WaveState = 'preparing' | 'active' | 'combat_live';",
        "const waveTransitions: Record<WaveState, readonly WaveState[]> = {",
        "  preparing: ['active'],",
        "  active: ['combat_live'],",
        "  combat_live: [],",
        "};",
        "function advance(waveState) {",
        "  if (waveState === 'preparing') {",
        "    waveState = 'active';",
        "  }",
        "}",
      ].join("\n");
      const input = parsed(source);
      const actual =
        deriveScriptProgressionStateTransitionEvidence(
          source,
          input.parsed.source,
        );

      const result =
        analyzeProgressionActorAccounting(
          [input],
          [],
          [],
          undefined,
          [],
          [],
          [],
          actual,
        );

      expect(
        result.validStateTransitions,
      ).toBe(1);
      expect(
        result.invalidStateTransitions,
      ).toBe(0);
    });

    it("uses parsed state-machine declarations to prove a custom active combat state", () => {
      const source = [
        "type WaveState = 'preparing' | 'active' | 'combat_live' | 'victory';",
        "const waveTransitions: Record<WaveState, readonly WaveState[]> = {",
        "  preparing: ['active'],",
        "  active: ['combat_live'],",
        "  combat_live: ['victory'],",
        "  victory: [],",
        "};",
        "let remainingEnemies = 0;",
        "function spawnEnemy(dimension) {",
        "  dimension.spawnEntity('demo:enemy', { x: 0, y: 0, z: 0 });",
        "  remainingEnemies++;",
        "}",
        "function enterCombat(entity) {",
        "  waveState = 'combat_live';",
        "  maybeDespawn(entity);",
        "}",
        "function maybeDespawn(entity) {",
        "  entity.triggerEvent('demo:despawn');",
        "}",
        "function maybeAdvance() { if (remainingEnemies === 0) nextWave(); }",
      ].join("\n");
      const input = parsed(source);
      const aliases =
        deriveProgressionActiveStateValues(
          input.parsed
            .transitionDeclarations ??
            [],
        );
      const transition =
        deriveScriptProgressionActiveTransitionEvidence(
          source,
          input.parsed.source,
          aliases,
        );
      const entity =
        parseEntityDefinition(
          {
            "minecraft:entity": {
              description: {
                identifier: "demo:enemy",
              },
              component_groups: {
                despawn_state: {
                  "minecraft:instant_despawn": {},
                },
              },
              events: {
                "demo:despawn": {
                  add: {
                    component_groups: [
                      "despawn_state",
                    ],
                  },
                },
              },
            },
          },
          {
            artifactId: "fixture",
            relativePath:
              "entities/enemy.json",
          },
        );
      const external:
        EntityEventExternalEvidence[] = [{
          event: "demo:despawn",
          kind: "event-command",
          entityIdentifier:
            "demo:enemy",
          executionRegion:
            "function:maybeDespawn",
          source: input.parsed.source,
        }];

      const result =
        analyzeProgressionActorAccounting(
          [input],
          [],
          [entity],
          undefined,
          external,
          transition.events,
          transition.calls,
        );

      expect(aliases).toEqual([
        "active",
        "combat_live",
      ]);
      expect(
        result.provenActiveInstantDespawnWithoutReconciliation,
      ).toBe(1);
      expect(
        result.declaredActiveStateAliases,
      ).toBe(2);
    });

    it("closes an unreachable conditional despawn path as statically inactive", () => {
      const source = [
        "let remainingEnemies = 0;",
        "function spawnEnemy(dimension) {",
        "  dimension.spawnEntity('demo:enemy', { x: 0, y: 0, z: 0 });",
        "  remainingEnemies++;",
        "}",
        "function maybeAdvance() { if (remainingEnemies === 0) nextWave(); }",
      ].join("\n");
      const entity =
        parseEntityDefinition(
          {
            "minecraft:entity": {
              description: { identifier: "demo:enemy" },
              component_groups: {
                despawn_state: {
                  "minecraft:instant_despawn": {},
                },
              },
              events: {
                "demo:despawn": {
                  add: {
                    component_groups: ["despawn_state"],
                  },
                },
              },
            },
          },
          {
            artifactId: "fixture",
            relativePath: "entities/enemy.json",
          },
        );

      const result =
        analyzeProgressionActorAccounting(
          [parsed(source)],
          [],
          [entity],
          undefined,
          [],
        );

      expect(result.conditionalDespawnUnknowns)
        .toBe(0);
      expect(result.inactiveConditionalDespawnCounters)
        .toBe(1);
      expect(result.counters[0])
        .toMatchObject({
          inactiveConditionalDespawnActorIdentifiers: ["demo:enemy"],
          unresolvedConditionalDespawnActorIdentifiers: [],
        });
    });

    it("keeps an exact non-terminal external despawn event reachable and unresolved", () => {
      const source = [
        "let remainingEnemies = 0;",
        "function spawnEnemy(dimension) {",
        "  dimension.spawnEntity('demo:enemy', { x: 0, y: 0, z: 0 });",
        "  remainingEnemies++;",
        "}",
        "function triggerDespawn(entity) {",
        "  entity.triggerEvent('demo:despawn');",
        "}",
        "function maybeAdvance() { if (remainingEnemies === 0) nextWave(); }",
      ].join("\n");
      const input = parsed(source);
      const entity =
        parseEntityDefinition(
          {
            "minecraft:entity": {
              description: { identifier: "demo:enemy" },
              component_groups: {
                despawn_state: {
                  "minecraft:instant_despawn": {},
                },
              },
              events: {
                "demo:despawn": {
                  add: {
                    component_groups: ["despawn_state"],
                  },
                },
              },
            },
          },
          {
            artifactId: "fixture",
            relativePath: "entities/enemy.json",
          },
        );
      const evidence:
        EntityEventExternalEvidence[] = [{
          event: "demo:despawn",
          kind: "event-command",
          entityIdentifier: "demo:enemy",
          executionRegion: "function:triggerDespawn",
          source: input.parsed.source,
        }];

      const result =
        analyzeProgressionActorAccounting(
          [input],
          [],
          [entity],
          undefined,
          evidence,
        );

      expect(result.reachableConditionalDespawnCounters)
        .toBe(1);
      expect(result.conditionalDespawnUnknowns)
        .toBe(1);
    });

    it("closes exact conditional despawn activation when every trigger is proven terminal-only", () => {
      const source = [
        "let remainingEnemies = 0;",
        "function spawnEnemy(dimension) {",
        "  dimension.spawnEntity('demo:enemy', { x: 0, y: 0, z: 0 });",
        "  remainingEnemies++;",
        "}",
        "function endGame(arena, player, entity) {",
        "  arena.players.delete(player);",
        "  arena.generation++;",
        "  triggerDespawn(entity);",
        "}",
        "function triggerDespawn(entity) {",
        "  entity.triggerEvent('demo:despawn');",
        "}",
        "function maybeAdvance() { if (remainingEnemies === 0) nextWave(); }",
      ].join("\n");
      const input = parsed(source);
      const lifecycle =
        analyzeArenaLifecycleConvergence(
          [input.parsed],
        );
      const entity =
        parseEntityDefinition(
          {
            "minecraft:entity": {
              description: { identifier: "demo:enemy" },
              component_groups: {
                despawn_state: {
                  "minecraft:instant_despawn": {},
                },
              },
              events: {
                "demo:despawn": {
                  add: {
                    component_groups: ["despawn_state"],
                  },
                },
              },
            },
          },
          {
            artifactId: "fixture",
            relativePath: "entities/enemy.json",
          },
        );
      const evidence:
        EntityEventExternalEvidence[] = [{
          event: "demo:despawn",
          kind: "event-command",
          entityIdentifier: "demo:enemy",
          executionRegion: "function:triggerDespawn",
          source: input.parsed.source,
        }];

      const result =
        analyzeProgressionActorAccounting(
          [input],
          [],
          [entity],
          lifecycle,
          evidence,
        );

      expect(result.conditionalDespawnUnknowns)
        .toBe(0);
      expect(result.terminalOnlyConditionalDespawnCounters)
        .toBe(1);
      expect(result.counters[0])
        .toMatchObject({
          terminalOnlyConditionalDespawnActorIdentifiers: ["demo:enemy"],
          unresolvedConditionalDespawnActorIdentifiers: [],
        });
    });

    it("excludes proven terminal-only cleanup removal from progression coverage gaps", () => {
      const source = [
        "let remainingEnemies = 0;",
        "function spawnEnemy(dimension) {",
        "  dimension.spawnEntity('demo:enemy', { x: 0, y: 0, z: 0 });",
        "  remainingEnemies++;",
        "}",
        "function endGame(arena, player, entity) {",
        "  cleanupArena(arena, player, entity);",
        "}",
        "function cleanupArena(arena, player, entity) {",
        "  arena.players.delete(player);",
        "  arena.generation++;",
        "  if (entity.typeId === 'demo:enemy') entity.remove();",
        "}",
        "function maybeAdvance() { if (remainingEnemies === 0) nextWave(); }",
      ].join("\n");
      const input = parsed(source);
      const lifecycle =
        analyzeArenaLifecycleConvergence(
          [input.parsed],
        );

      const result =
        analyzeProgressionActorAccounting(
          [input],
          [],
          [],
          lifecycle,
        );

      expect(
        result.scriptedRemovalCoverageGaps,
      ).toBe(0);
      expect(
        result.terminalOnlyScriptedRemovalCounters,
      ).toBe(1);
      expect(result.counters[0])
        .toMatchObject({
          scriptedRemovalScope:
            "terminal-only",
          terminalOnlyScriptedRemovalActorIdentifiers: [
            "demo:enemy",
          ],
          uncoveredScriptedRemovalActorIdentifiers: [],
        });
    });

    it("keeps a cleanup helper non-terminal when an active gameplay caller can also reach it", () => {
      const source = [
        "let remainingEnemies = 0;",
        "function spawnEnemy(dimension) {",
        "  dimension.spawnEntity('demo:enemy', { x: 0, y: 0, z: 0 });",
        "  remainingEnemies++;",
        "}",
        "function endGame(arena, player, entity) {",
        "  cleanupArena(arena, player, entity);",
        "}",
        "function abortWave(arena, player, entity) {",
        "  cleanupArena(arena, player, entity);",
        "}",
        "function cleanupArena(arena, player, entity) {",
        "  arena.players.delete(player);",
        "  arena.generation++;",
        "  if (entity.typeId === 'demo:enemy') entity.remove();",
        "}",
        "function maybeAdvance() { if (remainingEnemies === 0) nextWave(); }",
      ].join("\n");
      const input = parsed(source);
      const lifecycle =
        analyzeArenaLifecycleConvergence(
          [input.parsed],
        );

      const result =
        analyzeProgressionActorAccounting(
          [input],
          [],
          [],
          lifecycle,
        );

      expect(
        result.scriptedRemovalCoverageGaps,
      ).toBe(1);
      expect(
        result.nonTerminalScriptedRemovalCounters,
      ).toBe(1);
      expect(result.counters[0])
        .toMatchObject({
          scriptedRemovalScope:
            "non-terminal",
          nonTerminalScriptedRemovalActorIdentifiers: [
            "demo:enemy",
          ],
        });
    });

    it("proves matched actor reconciliation across imported counter helpers", () => {
      const mainText = [
        'import { decrementRemaining } from "./counter.js";',
        "world.afterEvents.entityDie.subscribe((event) => {",
        "  if (event.deadEntity.typeId === 'demo:enemy') {",
        "    decrementRemaining();",
        "  }",
        "});",
      ].join("\n");
      const counterText = [
        "export let remainingEnemies = 0;",
        "export function spawnEnemy(dimension) {",
        "  dimension.spawnEntity('demo:enemy', { x: 0, y: 0, z: 0 });",
        "  remainingEnemies++;",
        "}",
        "export function decrementRemaining() { remainingEnemies--; }",
        "export function maybeAdvance() {",
        "  if (remainingEnemies === 0) nextWave();",
        "}",
      ].join("\n");
      const main = parsed(
        mainText,
        "scripts/main.ts",
      );
      const counter = parsed(
        counterText,
        "scripts/counter.ts",
      );
      const calls =
        deriveCrossFileCallEdges([
          {
            path: "scripts/main.ts",
            text: mainText,
            source: main.parsed.source,
          },
          {
            path: "scripts/counter.ts",
            text: counterText,
            source: counter.parsed.source,
          },
        ]);

      const result =
        analyzeProgressionActorAccounting(
          [main, counter],
          calls,
        );

      expect(
        result
          .reconciledFromMatchedActorLifecycle,
      ).toBe(1);
      expect(
        result.counters[0]
          ?.matchedActorIdentifiers,
      ).toEqual(["demo:enemy"]);
    });

    it("accepts a complete authored result lifecycle transaction", () => {
      const source = [
        "type ResultState = 'active' | 'terminal_candidate' | 'resolving' | 'result_committed' | 'rewarding' | 'cleanup' | 'complete';",
        "const resultTransitions: Record<ResultState, readonly ResultState[]> = {",
        "  active: ['terminal_candidate'],",
        "  terminal_candidate: ['resolving'],",
        "  resolving: ['result_committed'],",
        "  result_committed: ['rewarding'],",
        "  rewarding: ['cleanup'],",
        "  cleanup: ['complete'],",
        "  complete: [],",
        "};",
      ].join("\n");
      const result =
        analyzeProgressionActorAccounting([
          parsed(source),
        ]);

      expect(
        result.completeStateMachines,
      ).toBe(1);
      expect(
        result.stateMachines[0],
      ).toMatchObject({
        tableName: "resultTransitions",
        status: "complete",
      });
    });

    it("proves a generation-bound entity registry as authoritative population ownership", () => {
      const source = [
        "function spawn(dimension, arena) {",
        "  const enemy = dimension.spawnEntity('demo:enemy', { x: 0, y: 0, z: 0 });",
        "  arena.enemyRegistryByGeneration.get(arena.generation).add(enemy.id);",
        "}",
        "world.afterEvents.entityDie.subscribe((event) => {",
        "  const arena = currentArena(event.deadEntity);",
        "  arena.enemyRegistryByGeneration.get(arena.generation).delete(event.deadEntity.id);",
        "});",
        "function maybeAdvance(arena) {",
        "  if (arena.enemyRegistryByGeneration.get(arena.generation).size === 0) nextWave();",
        "}",
      ].join("\n");

      const result =
        analyzeProgressionActorAccounting([
          parsed(source),
        ]);

      expect(
        result.generationBoundRegistryAuthorities,
      ).toBe(1);
      expect(
        result.registryAuthorityAssessments[0],
      ).toMatchObject({
        status:
          "generation-bound-authoritative",
        generationBound: true,
        actorIdentifiers: [
          "demo:enemy",
        ],
        materializePaths: 1,
        lifecycleReleasePaths: 1,
        completionChecks: 1,
      });
    });

    it("keeps a complete but unversioned entity registry explicitly generation-unbound", () => {
      const source = [
        "function spawn(dimension, arena) {",
        "  const enemy = dimension.spawnEntity('demo:enemy', { x: 0, y: 0, z: 0 });",
        "  arena.enemies.add(enemy.id);",
        "}",
        "world.afterEvents.entityDie.subscribe((event) => {",
        "  const arena = currentArena(event.deadEntity);",
        "  arena.enemies.delete(event.deadEntity.id);",
        "});",
        "function maybeAdvance(arena) {",
        "  if (arena.enemies.size === 0) nextWave();",
        "}",
      ].join("\n");

      const result =
        analyzeProgressionActorAccounting([
          parsed(source),
        ]);

      expect(
        result.unboundRegistryAuthorities,
      ).toBe(1);
      expect(
        result.registryAuthorityAssessments[0]
          ?.status,
      ).toBe("generation-unbound");
    });

    it("keeps deferred actor materialization unresolved when population is not reserved before scheduling", () => {
      const source = [
        "let remainingEnemies = 0;",
        "function spawnEnemy(dimension) {",
        "  dimension.spawnEntity('demo:enemy', { x: 0, y: 0, z: 0 });",
        "  remainingEnemies++;",
        "}",
        "function retrySpawn(dimension) {",
        "  system.runTimeout(() => {",
        "    spawnEnemy(dimension);",
        "  }, 20);",
        "}",
        "world.afterEvents.entityDie.subscribe((event) => {",
        "  if (event.deadEntity.typeId !== 'demo:enemy') return;",
        "  remainingEnemies--;",
        "});",
        "function maybeAdvance() {",
        "  if (remainingEnemies === 0) nextWave();",
        "}",
      ].join("\n");

      const result =
        analyzeProgressionActorAccounting([
          parsed(source),
        ]);

      expect(
        result.deferredSpawnAccountingGaps,
      ).toBe(1);
      expect(result.counters[0]).toMatchObject({
        counterId: "remainingEnemies",
        status:
          "deferred-spawn-accounting-unproven",
        deferredSpawnActorIdentifiers: [
          "demo:enemy",
        ],
        deferredSpawnReservationStatus:
          "unresolved",
        deferredSpawnGenerationStatus:
          "unresolved",
        deferredSpawnQuantityStatus:
          "unresolved",
      });
    });

    it("accepts deferred actor materialization when population is reserved before scheduling and generation is revalidated", () => {
      const source = [
        "let remainingEnemies = 0;",
        "let arenaGeneration = 4;",
        "function spawnReservedEnemy(dimension) {",
        "  dimension.spawnEntity('demo:enemy', { x: 0, y: 0, z: 0 });",
        "}",
        "function retrySpawn(dimension) {",
        "  remainingEnemies++;",
        "  const capturedGeneration = arenaGeneration;",
        "  system.runTimeout(() => {",
        "    if (capturedGeneration !== arenaGeneration) return;",
        "    spawnReservedEnemy(dimension);",
        "  }, 20);",
        "}",
        "world.afterEvents.entityDie.subscribe((event) => {",
        "  if (event.deadEntity.typeId !== 'demo:enemy') return;",
        "  remainingEnemies--;",
        "});",
        "function maybeAdvance() {",
        "  if (remainingEnemies === 0) nextWave();",
        "}",
      ].join("\n");

      const result =
        analyzeProgressionActorAccounting([
          parsed(source),
        ]);

      expect(
        result.deferredSpawnAccountingGaps,
      ).toBe(0);
      expect(result.counters[0]).toMatchObject({
        counterId: "remainingEnemies",
        deferredSpawnActorIdentifiers: [
          "demo:enemy",
        ],
        deferredSpawnReservationStatus:
          "covered-before-defer",
        deferredSpawnGenerationStatus:
          "generation-guarded",
        deferredSpawnQuantityStatus:
          "matched",
        actorIdentityStatus: "matched",
        spawnQuantityStatus: "matched",
        status:
          "reconciled-from-matched-actor-lifecycle",
      });
    });

    it("keeps an authored result lifecycle unresolved when a required reward phase is omitted", () => {
      const source = [
        "type ResultState = 'active' | 'terminal_candidate' | 'resolving' | 'result_committed' | 'cleanup' | 'complete';",
        "const resultTransitions: Record<ResultState, readonly ResultState[]> = {",
        "  active: ['terminal_candidate'],",
        "  terminal_candidate: ['resolving'],",
        "  resolving: ['result_committed'],",
        "  result_committed: ['cleanup'],",
        "  cleanup: ['complete'],",
        "  complete: [],",
        "};",
      ].join("\n");
      const result =
        analyzeProgressionActorAccounting([
          parsed(source),
        ]);

      expect(
        result.unresolvedStateMachines,
      ).toBe(1);
      expect(
        result.stateMachines[0],
      ).toMatchObject({
        tableName: "resultTransitions",
        status: "unresolved",
      });
      expect(
        result.stateMachines[0]?.reason,
      ).toMatch(/rewarding/);
    });
  },
);
