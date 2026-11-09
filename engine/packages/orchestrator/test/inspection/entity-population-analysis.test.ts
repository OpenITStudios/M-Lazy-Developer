import {
  describe,
  expect,
  it,
} from "vitest";
import {
  parseEntityDefinition,
} from "../../../../analyzers/entities/src/index.js";
import {
  parseScriptFile,
} from "../../../../analyzers/scripts/src/index.js";
import {
  analyzeEntityPopulationSources,
  entityPopulationSourceDiagnostics,
} from "../../src/inspection/entity-population-analysis.js";

const source = {
  artifactId: "fixture",
  relativePath:
    "behavior_packs/demo/entities/enemy.json",
};

describe("entity population source analysis", () => {
  it("classifies base and component-group autonomous spawn sources", () => {
    const entity =
      parseEntityDefinition({
        "minecraft:entity": {
          description: {
            identifier:
              "demo:enemy",
          },
          components: {
            "minecraft:spawn_on_death": {
              entity_type:
                "demo:child",
            },
          },
          component_groups: {
            spawner: {
              "minecraft:behavior.spawn_entity": {
                entities: [],
              },
            },
          },
        },
      }, source);

    const result =
      analyzeEntityPopulationSources([
        entity,
      ]);

    expect(
      result.spawnEntitySources,
    ).toBe(1);
    expect(
      result.spawnOnDeathSources,
    ).toBe(1);
    expect(
      result.autonomousSpawnSources,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "spawn-on-death",
          scope: "base",
        }),
        expect.objectContaining({
          kind: "spawn-entity",
          scope:
            "component-group",
          componentGroup:
            "spawner",
        }),
      ]),
    );
  });

  it("emits evidence diagnostics without promoting autonomous spawning to a defect", () => {
    const entity =
      parseEntityDefinition({
        "minecraft:entity": {
          description: {
            identifier:
              "demo:enemy",
          },
          components: {
            "minecraft:spawn_on_death": {},
          },
        },
      }, source);

    const findings =
      entityPopulationSourceDiagnostics(
        analyzeEntityPopulationSources([
          entity,
        ]),
      );

    expect(findings).toEqual([
      expect.objectContaining({
        code:
          "ENTITY_AUTONOMOUS_SPAWN_SOURCE",
        severity: "info",
      }),
    ]);
  });
});


describe("population path and disappearance classification", () => {
  it("classifies script, command, natural, and autonomous spawn paths separately", () => {
    const script = parseScriptFile(
      "main",
      [
        "dimension.spawnEntity('demo:enemy', { x: 0, y: 0, z: 0 });",
        "dimension.runCommand('summon demo:enemy 0 0 0');",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );
    const entity =
      parseEntityDefinition({
        "minecraft:entity": {
          description: {
            identifier:
              "demo:enemy",
          },
          components: {
            "minecraft:spawn_on_death": {},
          },
        },
      }, source);

    const result =
      analyzeEntityPopulationSources(
        [entity],
        [script],
        {
          naturalMobSpawning:
            "enabled",
        },
      );

    expect(
      Object.fromEntries(
        result.spawnPaths.map(
          (item) => [
            item.kind,
            item.count,
          ],
        ),
      ),
    ).toMatchObject({
      NATURAL_RULE: 1,
      SCRIPT_SPAWN: 1,
      COMMAND_SUMMON: 1,
      SPAWN_ON_DEATH: 1,
    });
  });

  it("requires death, remove, and load observation before disappearance is fully separated", () => {
    const script = parseScriptFile(
      "main",
      [
        "world.afterEvents.entityDie.subscribe(() => {});",
        "world.afterEvents.entityRemove.subscribe(() => {});",
        "world.afterEvents.entityLoad.subscribe(() => {});",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    expect(
      analyzeEntityPopulationSources(
        [],
        [script],
      ).disappearance.classification,
    ).toBe(
      "death-remove-load-separated",
    );
  });

  it("accepts generation-bound registry ownership as natural-spawn isolation proof", () => {
    expect(
      analyzeEntityPopulationSources(
        [],
        [],
        {
          naturalMobSpawning:
            "enabled",
          generationBoundRegistryAuthorities:
            1,
        },
      ).naturalSpawnIsolation,
    ).toBe("registry-isolated");
  });
});


describe("spawn intent and replacement lineage", () => {
  it("accepts only a structurally complete spawn intent token", () => {
    const script = parseScriptFile(
      "main",
      [
        "const intent = {",
        "  arenaGeneration: 2,",
        "  waveGeneration: 4,",
        "  spawnOperationId: 'wave-4-a',",
        "  expectedEntityType: 'demo:enemy',",
        "  expectedCount: 3,",
        "};",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzeEntityPopulationSources(
        [],
        [script],
      );

    expect(
      result.completeSpawnIntents,
    ).toBe(1);
    expect(
      result.spawnIntents[0]
        ?.missingFields,
    ).toEqual([]);
  });

  it("keeps partial intent-like objects unresolved", () => {
    const script = parseScriptFile(
      "main",
      [
        "const intent = {",
        "  arenaGeneration: 2,",
        "  expectedCount: 3,",
        "};",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzeEntityPopulationSources(
        [],
        [script],
      );

    expect(
      result.incompleteSpawnIntents,
    ).toBe(1);
    expect(
      result.spawnIntents[0]
        ?.missingFields,
    ).toContain(
      "spawnOperationId",
    );
  });

  it("keeps autonomous replacement lineage unresolved without explicit inheritance metadata", () => {
    const entity =
      parseEntityDefinition({
        "minecraft:entity": {
          description: {
            identifier:
              "demo:parent",
          },
          components: {
            "minecraft:spawn_on_death": {
              entity_type:
                "demo:child",
            },
          },
        },
      }, source);

    expect(
      analyzeEntityPopulationSources([
        entity,
      ]).replacementLineage,
    ).toBe(
      "declared-but-inheritance-unproven",
    );
  });

  it("accepts explicit parent-generation-role inheritance evidence", () => {
    const entity =
      parseEntityDefinition({
        "minecraft:entity": {
          description: {
            identifier:
              "demo:parent",
          },
          components: {
            "minecraft:spawn_on_death": {},
          },
        },
      }, source);
    const script = parseScriptFile(
      "main",
      [
        "const lineage = {",
        "  parentEntityId,",
        "  arenaGeneration,",
        "  objectiveRole,",
        "};",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    expect(
      analyzeEntityPopulationSources(
        [entity],
        [script],
      ).replacementLineage,
    ).toBe("explicit");
  });
});


describe("spawn commit transaction", () => {
  it("proves verification before generation registry registration", () => {
    const script = parseScriptFile(
      "main",
      [
        "function spawn(dimension, arena) {",
        "  const enemy = dimension.spawnEntity('demo:enemy', { x: 0, y: 0, z: 0 });",
        "  if (!enemy.isValid || enemy.typeId !== 'demo:enemy') return;",
        "  if (arenaGenerationOf(enemy) !== arena.generation) return;",
        "  arena.enemyRegistry.add(enemy.id);",
        "}",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzeEntityPopulationSources(
        [],
        [script],
      );

    expect(
      result.verifiedSpawnCommits,
    ).toBe(1);
    expect(
      result.spawnCommits[0]
        ?.status,
    ).toBe(
      "verified-before-registration",
    );
  });

  it("rejects registration before verification", () => {
    const script = parseScriptFile(
      "main",
      [
        "function spawn(dimension, arena) {",
        "  const enemy = dimension.spawnEntity('demo:enemy', { x: 0, y: 0, z: 0 });",
        "  arena.enemyRegistry.add(enemy.id);",
        "  if (!enemy.isValid) return;",
        "}",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    expect(
      analyzeEntityPopulationSources(
        [],
        [script],
      ).spawnCommits[0]?.status,
    ).toBe(
      "registration-before-verification",
    );
  });

  it("keeps raw spawn without registry commit unresolved", () => {
    const script = parseScriptFile(
      "main",
      [
        "function spawn(dimension) {",
        "  const enemy = dimension.spawnEntity('demo:enemy', { x: 0, y: 0, z: 0 });",
        "  if (!enemy.isValid) return;",
        "}",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    expect(
      analyzeEntityPopulationSources(
        [],
        [script],
      ).spawnCommits[0]?.status,
    ).toBe(
      "spawn-without-registration",
    );
  });
});


describe("critical persistence and spawn performance policy", () => {
  it("accepts explicit entity persistence/despawn policy evidence", () => {
    const entity =
      parseEntityDefinition({
        "minecraft:entity": {
          description: {
            identifier:
              "demo:objective",
          },
          components: {
            "minecraft:persistent": {},
          },
        },
      }, source);

    const result =
      analyzeEntityPopulationSources([
        entity,
      ]);

    expect(
      result.criticalPersistenceStatus,
    ).toBe("explicit");
  });

  it("accepts generation-bound registry recovery as persistence tolerance", () => {
    expect(
      analyzeEntityPopulationSources(
        [],
        [],
        {
          generationBoundRegistryAuthorities:
            1,
        },
      ).criticalPersistenceStatus,
    ).toBe("registry-recoverable");
  });

  it("compares static burst spawning only against an authored budget", () => {
    const script = parseScriptFile(
      "main",
      [
        "const maxSpawnPerTick = 4;",
        "function spawnWave(dimension) {",
        "  for (let i = 0; i < 3; i++) {",
        "    dimension.spawnEntity('demo:enemy', { x: 0, y: 0, z: 0 });",
        "  }",
        "}",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzeEntityPopulationSources(
        [],
        [script],
      );

    expect(
      result.maxStaticSpawnBurst,
    ).toBe(3);
    expect(
      result.spawnBudgetStatus,
    ).toBe(
      "within-authored-budget",
    );
    expect(
      result.capPressureDiagnosticStatus,
    ).toBe("budget-observable");
  });

  it("keeps spawn performance unresolved without an authored budget", () => {
    const script = parseScriptFile(
      "main",
      "dimension.spawnEntity('demo:enemy', { x: 0, y: 0, z: 0 });",
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    expect(
      analyzeEntityPopulationSources(
        [],
        [script],
      ).spawnBudgetStatus,
    ).toBe("unresolved");
  });
});

describe("batch-local entity population AST reuse", () => {
  it("keeps four independent source inspections faithful across JS, TS and absent text", () => {
    const jsScript = parseScriptFile(
      "spawn-js",
      [
        "const intent = {",
        "  arenaGeneration: 1, waveGeneration: 2,",
        "  spawnOperationId: 'op:1', expectedEntityType: 'demo:enemy',",
        "  expectedCount: 2,",
        "};",
        "const maxSpawnPerTick = 3;",
        "function spawnWave(dimension, arena) {",
        "  const enemy = dimension.spawnEntity('demo:enemy', {x:0,y:0,z:0});",
        "  if (!enemy.isValid) return;",
        "  arena.enemyRegistry.add(enemy.id);",
        "  for (let i = 0; i < 2; i++) {",
        "    dimension.spawnEntity('demo:enemy', {x:0,y:0,z:0});",
        "  }",
        "}",
      ].join("\n"),
      { artifactId: "fixture", relativePath: "scripts/spawn.js" },
    );
    const tsScript = parseScriptFile(
      "partial-ts",
      "const partial: { arenaGeneration: number; expectedCount: number } = " +
        "{ arenaGeneration: 1, expectedCount: 2 };",
      { artifactId: "fixture", relativePath: "scripts/partial.ts" },
    );
    const missingText = {
      ...jsScript,
      identifier: "missing-source",
      text: undefined,
    };
    const result = analyzeEntityPopulationSources(
      [], [jsScript, tsScript, missingText],
    );

    expect(result.spawnIntents.map(item => [item.scriptId, item.status]))
      .toEqual([
        ["partial-ts", "incomplete"],
        ["spawn-js", "complete"],
      ]);
    expect(result.completeSpawnIntents).toBe(1);
    expect(result.incompleteSpawnIntents).toBe(1);
    expect(result.spawnCommits.map(item => [item.scriptId, item.status]))
      .toEqual([["spawn-js", "verified-before-registration"]]);
    expect(result.authoredSpawnBudgets)
      .toEqual([{scriptId: "spawn-js", name: "maxSpawnPerTick", limit: 3}]);
    expect(result.maxStaticSpawnBurst).toBe(2);
    expect(result.spawnBudgetStatus).toBe("within-authored-budget");
    // Missing original source text cannot provide fresh AST-only proof.
    expect(result.spawnIntents.some(item => item.scriptId === "missing-source"))
      .toBe(false);
  });
});
