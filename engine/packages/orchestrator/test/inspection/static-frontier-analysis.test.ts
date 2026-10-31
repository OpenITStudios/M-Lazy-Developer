// Source-preserving Development test family: original suites and assertions retained.
import { describe, expect, it } from "vitest";
import { analyzeEntityTransitionIntegrity, analyzeInteractiveBlockComponents, analyzeScoreboardFakeParticipants } from "../../src/inspection/static-frontier-analysis.js";
import { parseEntityDefinition } from "../../../../analyzers/entities/src/index.js";
import { parseScriptFile } from "../../../../analyzers/scripts/src/index.js";
import { parseMcFunction } from "../../../../analyzers/functions/src/index.js";
import { analyzeFunctionTopology } from "../../src/inspection/topology-analysis.js";
import { analyzeSharedResourceOwnership } from "../../src/inspection/shared-resource-ownership.js";
import type { SemanticIr } from "../../../semantic-ir/src/index.js";
import { deriveInspectionEngineeringAnalyses } from "../../src/inspection/engineering-analysis-stage.js";
import type { GameplayWorldModel } from "../../src/inspection/gameplay-world-model.js";

// Original suite: engine/packages/orchestrator/test/inspection/static-frontier-analysis.test.ts (blob 80aecac3ae1836c9e498be89f2f3dab3426435f3)
{
const source = { artifactId: "fixture", relativePath: "fixture.json" };

describe("static frontier analysis", () => {
  it("classifies authored block component surfaces", () => {
    expect(analyzeInteractiveBlockComponents({
      source,
      components: {
        "minecraft:inventory": {},
        "minecraft:redstone_consumer": {},
      },
    }).map((item) => item.surface)).toEqual(["container", "redstone"]);
  });

  it("finds entity event references to missing groups/events", () => {
    const entity = parseEntityDefinition({
      "minecraft:entity": {
        component_groups: { active: {} },
        events: {
          start: {
            add: { component_groups: ["missing"] },
            trigger: "missing_event",
          },
        },
      },
    }, source);
    expect(analyzeEntityTransitionIntegrity(entity)[0]).toMatchObject({
      missingGroups: ["missing"],
      missingTriggeredEvents: ["missing_event"],
    });
  });

  it("distinguishes literal fake-player scoreboard participants", () => {
    const script = parseScriptFile(
      "main",
      'player.runCommand("scoreboard players set $global state 1");',
      { artifactId: "fixture", relativePath: "scripts/main.ts" },
    );
    expect(analyzeScoreboardFakeParticipants([script])[0]).toMatchObject({
      participant: "$global",
      objective: "state",
    });
  });
});
}

// Original suite: engine/packages/orchestrator/test/inspection/topology-analysis.test.ts (blob d4077b0350fd1e4b69ab13a28aac4ceb86e29f29)
{
const source = {
  artifactId: "art",
  relativePath: "behavior_packs/demo/functions/arenas.mcfunction",
};

describe("integrated topology/state analysis", () => {
  it("flags broad state writes", () => {
    const fn = parseMcFunction(
      "arenas",
      "scoreboard players set @a active 1\ntag @e add running\n",
      source,
    );

    const result = analyzeFunctionTopology([fn]);

    expect(result.broadWrites).toBe(2);
    expect(result.stateDiagnostics).toHaveLength(2);
    expect(result.stateDiagnostics[0]?.code).toBe("CROSS_SCOPE_STATE_RISK");
  });

  it("detects a single outlier in a strongly repeated linear spatial pattern", () => {
    const fn = parseMcFunction(
      "arenas",
      [
        "fill 0 0 0 3 2 3 stone",
        "fill 100 0 0 103 2 3 stone",
        "fill 198 0 0 201 2 3 stone",
        "fill 300 0 0 303 2 3 stone",
        "fill 400 0 0 403 2 3 stone",
      ].join("\n"),
      source,
    );

    const result = analyzeFunctionTopology([fn]);

    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.linearOutliers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        axis: "x",
        expectedCoordinate: 200,
        actualCoordinate: 198,
      }),
    ]));
  });

  it("does not force a non-linear repeated layout into a linear outlier diagnostic", () => {
    const fn = parseMcFunction(
      "arenas",
      [
        "fill 0 0 0 3 2 3 stone",
        "fill 100 0 0 103 2 3 stone",
        "fill 100 0 100 103 2 103 stone",
        "fill 0 0 100 3 2 103 stone",
      ].join("\n"),
      source,
    );

    const result = analyzeFunctionTopology([fn]);
    expect(result.linearOutliers).toHaveLength(0);
  });
});
}

// Original suite: engine/packages/orchestrator/test/inspection/shared-resource-ownership.test.ts (blob 26ccdcbf39285063cc87d8a3d3914a9ef0e8df85)
{
describe("shared resource ownership analysis", () => {
  it("finds multi-writer shared state without explicit authority", () => {
    const ir = {
      schemaVersion: 1,
      execution: {
        regions: [],
        edges: [],
      },
      state: {
        surfaces: [],
        operations: [
          {
            id: "op:a",
            executionRegionId: "region:a",
            surfaceId: "state:player-loadout",
            operation: "write",
            source: {
              kind: "script",
              locator: "a.js",
            },
          },
          {
            id: "op:b",
            executionRegionId: "region:b",
            surfaceId: "state:player-loadout",
            operation: "write",
            source: {
              kind: "script",
              locator: "b.js",
            },
          },
        ],
        authorityBindings: [],
      },
      temporal: {
        relations: [],
      },
    } as unknown as SemanticIr;

    const result =
      analyzeSharedResourceOwnership(ir);

    expect(result.signals.map((item) => item.kind)).toContain(
      "multi-writer-without-authority",
    );
  });

  it("raises higher-order interaction only when three or more regions converge with multiple writers", () => {
    const ir = {
      schemaVersion: 1,
      execution: {
        regions: [],
        edges: [],
      },
      state: {
        surfaces: [],
        operations: [
          {
            id: "op:a",
            executionRegionId: "region:a",
            surfaceId: "state:shared",
            operation: "write",
            source: {
              kind: "script",
              locator: "a.js",
            },
          },
          {
            id: "op:b",
            executionRegionId: "region:b",
            surfaceId: "state:shared",
            operation: "write",
            source: {
              kind: "script",
              locator: "b.js",
            },
          },
          {
            id: "op:c",
            executionRegionId: "region:c",
            surfaceId: "state:shared",
            operation: "read",
            source: {
              kind: "script",
              locator: "c.js",
            },
          },
        ],
        authorityBindings: [],
      },
      temporal: {
        relations: [],
      },
    } as unknown as SemanticIr;

    const result =
      analyzeSharedResourceOwnership(ir);

    expect(
      result.records[0]?.highOrderInteraction,
    ).toBe(true);
    expect(result.signals.map((item) => item.kind)).toContain(
      "higher-order-shared-resource",
    );
  });
});
}

// Original suite: engine/packages/orchestrator/test/inspection/engineering-analysis-stage.test.ts (blob a2a2c0835c0596a7f698b615787b4813405a03b3)
{
describe("inspection engineering analysis", () => {
  it("synthesizes a causal analysis for six arenas capped at two", () => {
    const world = {
      arenas: {
        detected: true,
        count: 6,
        safeConcurrentArenas: 2,
        declaredConcurrentArenaLimit: 2,
      },
    } as unknown as GameplayWorldModel;

    const analyses =
      deriveInspectionEngineeringAnalyses({
        world,
        arenaCapacity: {
          resources: [{
            id: "runtime-arena-admission-cap",
            backend: "fixed-pool",
            perArena: 1,
            total: 2,
          }],
          evidence: {
            requestedConcurrentArenas: 6,
            discoveredArenaCount: 6,
            declaredConcurrentArenaLimit: 2,
            arenaCountConflict: false,
            commandTickingAreaAdds: 0,
            completeCommandTickingAreaFamilies: 0,
            unmatchedCommandTickingAreaAdds: 0,
            commandTickingAreaResourceResolved: false,
            scriptTickingAreaManagerReferenced: false,
            scriptCapacitySignals: [],
            scriptTickingAreaCapacityResolved: false,
            conflictingPlayerCapacityValues: [],
            reasons: [],
          },
          report: {
            requestedConcurrentArenas: 6,
            safeConcurrentArenas: 2,
            ok: false,
            limitingResourceIds: [
              "runtime-arena-admission-cap",
            ],
            resources: [{
              id: "runtime-arena-admission-cap",
              backend: "fixed-pool",
              safeConcurrentArenas: 2,
              limiting: true,
              reason: "cap",
            }],
          },
        },
        target: {
          edition: "education",
          version: "1.26.30",
        },
      });

    expect(analyses).toHaveLength(1);
    expect(
      analyses[0]?.analysis.designContradiction,
    ).toMatch(/6 arena instances/);
    expect(
      analyses[0]?.analysis.constraints[0]
        ?.satisfied,
    ).toBe(false);
    expect(
      analyses[0]?.analysis.alternatives.some(
        (item) =>
          item.id === "raise-admission-cap",
      ),
    ).toBe(true);
  });
});
}
