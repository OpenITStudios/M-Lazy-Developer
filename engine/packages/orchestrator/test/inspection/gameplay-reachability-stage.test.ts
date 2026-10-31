// Same-feature source tests; original describe/it/expect bodies remain intact.
import { describe, expect, it } from "vitest";
import { buildGameplayReachabilityGraph } from "../../src/inspection/gameplay-reachability-stage.js";
import { findGameplayReachability } from "../../../diagnostic-reasoning/src/index.js";
import { analyzeGameplayRouteCauseCandidates } from "../../src/inspection/gameplay-route-candidate-analysis.js";
import type { GameplayRouteCauseAnalysisInput } from "../../src/inspection/gameplay-route-candidate-analysis.js";
import type { GameplayIntentModel, GameplayRouteObservationAssessment, GameplayRouteRuntimeObservationNeed } from "../../../gameplay-intent/src/index.js";
import { deriveGameplayRouteCorridors } from "../../src/inspection/gameplay-route-corridor.js";
import { planGameplayRouteRuntimeEvidence } from "../../src/inspection/gameplay-route-runtime-plan.js";
import type { RuntimeNavigationStallObservation } from "../../../project-model/src/index.js";

// Original engine/packages/orchestrator/test/inspection/gameplay-reachability-stage.test.ts, blob 3355359a8ef651cb3f40c3ff2cec9780c8eb9056
{
describe("gameplay reachability stage", () => {
  it("projects player item acquisition without item-specific rules", () => {
    const graph =
      buildGameplayReachabilityGraph([
        {
          parsed: {
            identifier: "gameplay",
            source: {
              artifactId: "map",
              relativePath: "scripts/gameplay.ts",
            },
            inventoryLifecycleEvidence: [
              {
                kind: "item-grant",
                executionRegion:
                  "function:giveReward",
                subjectExpression:
                  "player.inventory",
                itemIdentifier:
                  "custom:access_token",
                source: {
                  artifactId: "map",
                  relativePath:
                    "scripts/gameplay.ts",
                  range: {
                    lineStart: 12,
                    lineEnd: 12,
                  },
                },
              },
            ],
            commandLiterals: [],
          } as any,
          text: "",
        },
      ]);

    expect(
      findGameplayReachability(
        graph,
        "item:custom:access_token",
      ).reachable,
    ).toBe(true);
  });

  it("indexes mcstructure container items without assuming the container is player-accessible", () => {
    const graph = buildGameplayReachabilityGraph(
      [],
      [],
      [{
        identifier: "levels/chest_build",
        node: {
          kind: "structure",
          source: {
            artifactId: "map",
            relativePath: "structures/chest_build.mcstructure",
          },
        } as any,
        containerItems: [{
          flatIndex: 7,
          itemId: "minecraft:oak_planks",
          count: 16,
        }],
      }],
    );

    const plank = graph.nodes.find(
      (node) => node.id === "item:minecraft:oak_planks",
    );
    const container = graph.nodes.find(
      (node) => node.kind === "container",
    );
    expect(plank?.evidenceIds).toContain(
      "structures/chest_build.mcstructure#container:7",
    );
    expect(container?.playerAccessible).not.toBe(true);
    const path = findGameplayReachability(
      graph,
      "item:minecraft:oak_planks",
    );
    expect(path.resolution).toBe("unknown");
    expect(path.evidenceIds).toContain(
      "structures/chest_build.mcstructure#container:7",
    );
    expect(graph.coverage?.sources).toContain(
      "mcstructure-container-contents",
    );
  });
});


describe("gameplay recipe reachability", () => {
  it("follows a single-ingredient behavior-pack recipe without item-specific rules", () => {
    const graph =
      buildGameplayReachabilityGraph(
        [{
          parsed: {
            identifier: "grant",
            source: {
              artifactId: "map",
              relativePath: "scripts/grant.ts",
            },
            inventoryLifecycleEvidence: [{
              kind: "item-grant",
              executionRegion: "function:grant",
              subjectExpression: "player.inventory",
              itemIdentifier: "custom:material",
              source: {
                artifactId: "map",
                relativePath: "scripts/grant.ts",
                range: {
                  lineStart: 1,
                  lineEnd: 1,
                },
              },
            }],
            commandLiterals: [],
          } as any,
        }],
        [{
          id: "recipe:test",
          identity: {
            kind: "recipe",
            scope: "project",
            identifier: "recipes/test",
          },
          kind: "recipe",
          identifier: "recipes/test",
          source: {
            artifactId: "map",
            relativePath: "behavior_packs/BP/recipes/test.json",
          },
          data: {
            "minecraft:recipe_shapeless": {
              ingredients: [{
                item: "custom:material",
              }],
              result: {
                item: "custom:trigger_tool",
              },
            },
          },
        } as any],
      );

    expect(
      findGameplayReachability(
        graph,
        "item:custom:trigger_tool",
      ),
    ).toMatchObject({
      reachable: true,
      resolution: "reachable",
    });
    expect(
      graph.coverage?.sources,
    ).toContain(
      "behavior-pack-recipes",
    );
  });

  it("does not falsely prove a multi-ingredient recipe from one reachable input", () => {
    const graph =
      buildGameplayReachabilityGraph(
        [{
          parsed: {
            identifier: "grant",
            source: {
              artifactId: "map",
              relativePath: "scripts/grant.ts",
            },
            inventoryLifecycleEvidence: [{
              kind: "item-grant",
              executionRegion: "function:grant",
              subjectExpression: "player.inventory",
              itemIdentifier: "custom:a",
              source: {
                artifactId: "map",
                relativePath: "scripts/grant.ts",
              },
            }],
            commandLiterals: [],
          } as any,
        }],
        [{
          id: "recipe:test",
          identity: {
            kind: "recipe",
            scope: "project",
            identifier: "recipes/test",
          },
          kind: "recipe",
          identifier: "recipes/test",
          source: {
            artifactId: "map",
            relativePath: "behavior_packs/BP/recipes/test.json",
          },
          data: {
            "minecraft:recipe_shapeless": {
              ingredients: [{
                item: "custom:a",
              }, {
                item: "custom:b",
              }],
              result: {
                item: "custom:result",
              },
            },
          },
        } as any],
      );

    expect(
      findGameplayReachability(
        graph,
        "item:custom:result",
      ).resolution,
    ).not.toBe("reachable");
    expect(
      graph.coverage?.gaps,
    ).toContain(
      "multi-ingredient-or-tag-recipes",
    );
  });
});
}

// Original engine/packages/orchestrator/test/inspection/gameplay-route-candidate-analysis.test.ts, blob c51a582fa383d498d367914e724d34bca49afd75
{
function baseAssessment(): GameplayRouteCauseAnalysisInput {
  return {
    stallObservation: {
      entityKey: "demo:zombie",
      routeId: "bridge",
      stalledTicks: 80,
      distanceDelta: 0.1,
      scope: {
        arenaId: "arena_6",
        arenaGeneration: 3,
        entityKey: "demo:zombie",
      },
      observedAt: { tick: 225 },
      evidenceId: "e:stall",
    },
    disposition: "target-nearest-match",
    routeAssessment: {
      routeObservation: {
        entityKey: "demo:zombie",
        routeId: "bridge",
        routeIndex: 606,
        worldLocation: {
          x: 1778,
          y: -30,
          z: 0,
        },
        scope: {
          arenaId: "arena_6",
          arenaGeneration: 3,
          entityKey: "demo:zombie",
        },
        observedAt: { tick: 220 },
        evidenceId: "e:route",
      },
      assessment: {
        disposition: "resolved",
        routeId: "bridge",
        routeIndex: 606,
        target: {
          routeNodeId: "spatial-region:route-bridge",
          routeId: "bridge",
          routeIndex: 606,
          localPoint: {
            x: 23,
            y: -28.5,
            z: 0.5,
          },
          worldPoint: {
            x: 1778,
            y: -28.5,
            z: 0.5,
          },
        },
        targetCandidates: [{
          routeNodeId: "spatial-region:route-bridge",
          routeId: "bridge",
          routeIndex: 606,
          localPoint: {
            x: 23,
            y: -28.5,
            z: 0.5,
          },
          worldPoint: {
            x: 1778,
            y: -28.5,
            z: 0.5,
          },
        }],
        nearest: {
          routeNodeId: "spatial-region:route-bridge",
          routeId: "bridge",
          routeIndex: 606,
          worldPoint: {
            x: 1778,
            y: -28.5,
            z: 0.5,
          },
          distance: 1.58,
        },
        distanceToTarget: 1.58,
        reasons: [],
      },
    },
    motionSeries: {
      sampleCount: 2,
      evidenceIds: ["e:route-a", "e:route-b"],
      firstTick: 210,
      lastTick: 220,
      displacement: 0.5,
    },
    navigationTargetObservation: {
      entityKey: "demo:zombie",
      targetLocation: {
        x: 1778,
        y: -28.5,
        z: 0.5,
      },
      routeId: "bridge",
      routeIndex: 606,
      mechanism: "moveToLocation",
      scope: {
        arenaId: "arena_6",
        arenaGeneration: 3,
        entityKey: "demo:zombie",
      },
      observedAt: { tick: 222 },
      evidenceId: "e:navigation",
    },
    reachabilityObservation: {
      entityKey: "demo:zombie",
      reachable: true,
      routeId: "bridge",
      routeIndex: 606,
      mechanism: "gametest-path-check",
      scope: {
        arenaId: "arena_6",
        arenaGeneration: 3,
        entityKey: "demo:zombie",
      },
      observedAt: { tick: 223 },
      evidenceId: "e:reachability",
    },
    chunkAvailabilityObservation: {
      requestId:
        "route-stall::e:stall::chunk-route-availability",
      state: "loaded",
      scope: {
        arenaId: "arena_6",
        arenaGeneration: 3,
        entityKey: "demo:zombie",
      },
      observedAt: { tick: 226 },
      evidenceId: "e:chunk",
    },
    navigationTargetDistanceToAuthoredTarget: 0,
    navigationTargetRouteMatchesAuthoredTarget: true,
    reasons: [],
  };
}


const completeAiStack = [{
  entityKey: "demo:zombie",
  stateId: "base",
  targeted: true,
  movementPresent: true,
  navigationPresent: true,
  movementGoalCandidatePresent: true,
  attackBehaviorPresent: true,
  movementGoalPriorities: [],
  duplicateMovementGoalPriorities: [],
  navigationCapabilities: [
    "navigation:walk",
  ],
  missingSurfaces: [],
  status: "targeted-stack-complete" as const,
}];

const compatibleRouteEnvironment = {
  contracts: 1,
  compatible: 1,
  incompatible: 0,
  stateDependent: 0,
  unresolved: 0,
  assessments: [{
    contractId: "bridge-ground",
    routeId: "bridge",
    entityKey: "demo:zombie",
    status: "compatible" as const,
    states: [{
      stateId: "base",
      compatible: true,
      missingCapabilities: [],
    }],
    reasons: ["compatible"],
  }],
};

describe("gameplay route candidate analysis", () => {
  it("isolates engine navigation only after all upstream candidates are rejected", () => {
    const result = analyzeGameplayRouteCauseCandidates(
      baseAssessment(),
      completeAiStack,
      compatibleRouteEnvironment,
    );

    expect(result.supportedCandidateIds).toEqual([
      "engine-navigation-runtime",
    ]);
    expect(result.rejectedCandidateIds).toEqual([
      "route-context",
      "target-assignment",
      "entity-ai-stack",
      "navigation-environment",
      "chunk-availability",
      "route-reachability",
      "navigation-target",
    ]);
    expect(result.unresolvedCandidateIds).toEqual([]);
    expect(result.leadingCandidateId)
      .toBe("engine-navigation-runtime");
    expect(result.stopCondition)
      .toBe("navigation-runtime-candidate-isolated");

    const engine = result.candidates.find(
      (item) =>
        item.id === "engine-navigation-runtime",
    );
    expect(engine).toEqual(expect.objectContaining({
      status: "supported",
      claimStrength: "corroborated",
    }));
  });

  it("keeps static AI stack ahead of engine navigation when every targeted state is incomplete", () => {
    const result =
      analyzeGameplayRouteCauseCandidates(
        baseAssessment(),
        [{
          entityKey: "demo:zombie",
          stateId: "base",
          targeted: true,
          movementPresent: true,
          navigationPresent: false,
          movementGoalCandidatePresent: true,
          attackBehaviorPresent: true,
          movementGoalPriorities: [],
          duplicateMovementGoalPriorities: [],
          navigationCapabilities: [],
          missingSurfaces: ["navigation"],
          status:
            "targeted-stack-incomplete",
        }],
        compatibleRouteEnvironment,
      );

    expect(result.leadingCandidateId)
      .toBe("entity-ai-stack");
    expect(result.stopCondition)
      .toBe("route-cause-supported");
    expect(
      result.candidates.find(
        (item) =>
          item.id === "entity-ai-stack",
      )?.status,
    ).toBe("supported");
    expect(
      result.candidates.find(
        (item) =>
          item.id ===
          "engine-navigation-runtime",
      )?.status,
    ).toBe("rejected");
  });

  it("selects chunk availability as the first supported upstream owner", () => {
    const input = baseAssessment();
    input.chunkAvailabilityObservation = {
      ...input.chunkAvailabilityObservation!,
      state: "not-loaded",
    };

    const result =
      analyzeGameplayRouteCauseCandidates(input);

    expect(result.leadingCandidateId)
      .toBe("chunk-availability");
    expect(result.stopCondition)
      .toBe("route-cause-supported");
    expect(
      result.candidates.find(
        (item) =>
          item.id === "chunk-availability",
      )?.status,
    ).toBe("supported");
    expect(
      result.candidates.find(
        (item) =>
          item.id === "engine-navigation-runtime",
      )?.status,
    ).toBe("rejected");
  });

  it("stops at unresolved route context before downstream engine claims", () => {
    const base = baseAssessment();
    const {
      navigationTargetObservation: _navigation,
      reachabilityObservation: _reachability,
      chunkAvailabilityObservation: _chunk,
      navigationTargetDistanceToAuthoredTarget: _distance,
      navigationTargetRouteMatchesAuthoredTarget: _routeMatches,
      ...rest
    } = base;

    const input: GameplayRouteCauseAnalysisInput = {
      ...rest,
      disposition: "ambiguous-route-context",
      routeAssessment: {
        ...base.routeAssessment!,
        assessment: {
          disposition: "ambiguous",
          routeIndex: 9,
          targetCandidates: [
            base.routeAssessment!.assessment.target!,
          ],
          reasons: [
            "Multiple authored routes contain this path index.",
          ],
        },
      },
    };

    const result =
      analyzeGameplayRouteCauseCandidates(input);

    expect(result.leadingCandidateId)
      .toBe("route-context");
    expect(result.stopCondition)
      .toBe("route-cause-supported");
    expect(
      result.candidates.find(
        (item) => item.id === "route-context",
      )?.status,
    ).toBe("supported");
    expect(
      result.candidates.find(
        (item) =>
          item.id === "engine-navigation-runtime",
      )?.status,
    ).toBe("rejected");
  });
});
}

// Original engine/packages/orchestrator/test/inspection/gameplay-route-corridor.test.ts, blob 1333848549a6e19d049a908bbc847293a8f782eb
{
function model(): GameplayIntentModel {
  return {
    schemaVersion: 1,
    id: "route-calibration",
    evidence: [{
      id: "e:route",
      origin: "source-code",
      locator: "scripts/main.js",
      summary: "Authored local route points.",
    }],
    nodes: [{
      id: "spatial-region:route-main",
      kind: "spatial-region",
      label: "Route Main",
      status: "authored",
      evidenceIds: ["e:route"],
      spatialProfile: {
        coordinateSpace: "local",
        routeId: "main",
        points: [
          { x: 0, y: 64, z: 0, index: 0 },
          { x: 4, y: 64, z: 0, index: 1 },
          { x: 12, y: 64, z: 0, index: 3 },
        ],
        transform: {
          kind: "offset",
          offsetPath: "gameplayOffset",
          functionName: "projectPoint",
        },
        contextSeries: {
          collectionName: "arenas",
          contextCount: 2,
          offsetPath: "gameplayOffset",
          offsetBase: { x: 0, y: 0, z: 0 },
          offsetStride: { x: 100, y: 0, z: 0 },
          contextIdPrefix: "arena_",
          contextIdIndexBase: 1,
        },
      },
    }],
    edges: [],
    invariants: [],
    unknowns: [],
  };
}

describe("gameplay route corridor derivation", () => {
  it("derives one narrow corridor per contiguous segment and context", () => {
    const result = deriveGameplayRouteCorridors(
      model(),
      {
        padding: 1,
        dimension: "overworld",
      },
    );

    expect(result).toHaveLength(2);
    expect(result.map((item) => item.contract.routeId))
      .toEqual(["main", "main"]);

    expect(result[0]).toEqual(expect.objectContaining({
      routeNodeId: "spatial-region:route-main",
      contextIndex: 0,
      contextId: "arena_1",
      segment: {
        fromIndex: 0,
        toIndex: 1,
      },
      contract: expect.objectContaining({
        id: "intent-route:main:arena_1:0-1",
        routeId: "main",
        dimension: "overworld",
        volume: {
          min: { x: -1, y: 63, z: -1 },
          max: { x: 5, y: 65, z: 1 },
        },
      }),
    }));

    expect(result[1]?.contract.volume).toEqual({
      min: { x: 99, y: 63, z: -1 },
      max: { x: 105, y: 65, z: 1 },
    });

    expect(
      result.some(
        (item) => item.segment.fromIndex === 1 &&
          item.segment.toIndex === 3,
      ),
    ).toBe(false);
  });

  it("does not project unresolved local coordinate space", () => {
    const unresolved: GameplayIntentModel = {
      ...model(),
      nodes: [{
        ...model().nodes[0]!,
        spatialProfile: {
          ...model().nodes[0]!.spatialProfile!,
          coordinateSpace: "unknown",
        },
      }],
    };

    expect(
      deriveGameplayRouteCorridors(unresolved),
    ).toEqual([]);
  });
});
}

// Original engine/packages/orchestrator/test/inspection/gameplay-route-runtime-plan.test.ts, blob c1123454cd7372bab0827300142502cb8a807365
{
const stall: RuntimeNavigationStallObservation = {
  entityKey: "demo:zombie",
  routeId: "bridge",
  stalledTicks: 80,
  distanceDelta: 0.1,
  scope: {
    arenaId: "arena_6",
    arenaGeneration: 3,
    entityKey: "demo:zombie",
  },
  observedAt: { tick: 225 },
  evidenceId: "telemetry-stall:stall-1",
};

const routeAssessment: GameplayRouteObservationAssessment = {
  disposition: "resolved",
  routeId: "bridge",
  routeIndex: 606,
  target: {
    routeNodeId: "spatial-region:route-bridge",
    routeId: "bridge",
    routeIndex: 606,
    localPoint: {
      x: 23,
      y: -28.5,
      z: 0.5,
    },
    worldPoint: {
      x: 1778,
      y: -28.5,
      z: 0.5,
    },
  },
  nearest: {
    routeNodeId: "spatial-region:route-bridge",
    routeId: "bridge",
    routeIndex: 606,
    worldPoint: {
      x: 1778,
      y: -28.5,
      z: 0.5,
    },
    distance: 1.58,
  },
  distanceToTarget: 1.58,
  reasons: [],
};

const needs: GameplayRouteRuntimeObservationNeed[] = [
  {
    kind: "entity-motion-series",
    reason: "Observe motion.",
  },
  {
    kind: "navigation-target",
    reason: "Observe navigation target.",
  },
  {
    kind: "route-reachability",
    reason: "Observe reachability.",
  },
  {
    kind: "chunk-route-availability",
    reason: "Observe chunk availability.",
  },
];

describe("gameplay route runtime evidence planner", () => {
  it("binds semantic evidence needs to instrumentation and safe chunk probe", () => {
    const plan = planGameplayRouteRuntimeEvidence({
      stall,
      routeAssessment,
      needs,
      dimension: "overworld",
    });

    expect(plan.instrumentation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          need: "entity-motion-series",
          instrumentation: "entity-progress-probe",
        }),
        expect.objectContaining({
          need: "navigation-target",
          instrumentation: "navigation-target-observation",
        }),
        expect.objectContaining({
          need: "route-reachability",
          instrumentation: "route-reachability-observation",
        }),
      ]),
    );

    expect(plan.runtimeProbeRequests).toEqual([
      expect.objectContaining({
        probeId: "gameplay-route-chunk-availability",
        predicate: "route-target-chunk-loaded",
        runtimeTick: 225,
        scope: expect.objectContaining({
          arenaId: "arena_6",
          arenaGeneration: 3,
          entityKey: "demo:zombie",
        }),
        query: {
          kind: "chunk-loaded",
          dimension: "overworld",
          location: {
            x: 1778,
            y: -28.5,
            z: 0.5,
          },
        },
      }),
    ]);
    expect(plan.blocked).toEqual([]);
  });

  it("blocks chunk probing without explicit dimension", () => {
    const plan = planGameplayRouteRuntimeEvidence({
      stall,
      routeAssessment,
      needs: [needs[3]!],
    });

    expect(plan.runtimeProbeRequests).toEqual([]);
    expect(plan.blocked).toEqual([
      expect.objectContaining({
        need: "chunk-route-availability",
        reason: expect.stringMatching(
          /explicit runtime dimension/,
        ),
      }),
    ]);
  });

  it("does not request instrumentation when evidence is already fulfilled", () => {
    const fulfilled = new Map([
      [
        "entity-motion-series" as const,
        {
          evidenceIds: ["route-a", "route-b"],
          reason: "Two samples already exist.",
        },
      ],
      [
        "navigation-target" as const,
        {
          evidenceIds: ["nav-1"],
          reason: "Navigation target observed.",
        },
      ],
    ]);

    const plan = planGameplayRouteRuntimeEvidence({
      stall,
      routeAssessment,
      needs,
      dimension: "overworld",
      fulfilled,
    });

    expect(
      plan.instrumentation.some(
        (item) =>
          item.need === "entity-motion-series" ||
          item.need === "navigation-target",
      ),
    ).toBe(false);
    expect(plan.satisfied).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          need: "entity-motion-series",
          evidenceIds: ["route-a", "route-b"],
        }),
        expect.objectContaining({
          need: "navigation-target",
          evidenceIds: ["nav-1"],
        }),
      ]),
    );
  });
});
}
