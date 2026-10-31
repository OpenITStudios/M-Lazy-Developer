import { describe, expect, it } from "vitest";
import type {
  GameplayIntentModel,
} from "../../../gameplay-intent/src/index.js";
import {
  analyzeGameplayIntentRuntime,
} from "../../src/inspection/gameplay-intent-runtime-stage.js";

const intent: GameplayIntentModel = {
  schemaVersion: 1,
  id: "reconnect",
  evidence: [{
    id: "e:policy",
    origin: "source-code",
    locator: "src/recovery-policy.ts",
    summary: "Authored cleanup guard.",
  }],
  nodes: [
    {
      id: "outcome:cleanup",
      kind: "outcome",
      label: "Cleanup",
      status: "authored",
      evidenceIds: ["e:policy"],
    },
    {
      id: "policy:pending-cleanup",
      kind: "policy",
      label: "Pending Cleanup",
      status: "authored",
      evidenceIds: ["e:policy"],
      policyPredicate: {
        kind: "truthy",
        operand: {
          kind: "path",
          path: "record.pendingCleanup",
        },
      },
    },
  ],
  edges: [{
    id: "edge:cleanup-policy",
    from: "outcome:cleanup",
    to: "policy:pending-cleanup",
    kind: "requires",
    status: "authored",
    evidenceIds: ["e:policy"],
  }],
  invariants: [{
    id: "inv:admissible-policy:outcome:cleanup",
    statement: "Cleanup is observed only under modeled guards.",
    strength: "must",
    status: "inferred",
    subjectIds: ["outcome:cleanup"],
    evidenceIds: ["e:policy"],
  }],
  unknowns: [],
};

const routeIntent: GameplayIntentModel = {
  schemaVersion: 1,
  id: "routes",
  evidence: [{
    id: "e:route",
    origin: "source-code",
    locator: "scripts/main.js",
    summary: "Authored bridge route.",
  }],
  nodes: [{
    id: "spatial-region:route-bridge",
    kind: "spatial-region",
    label: "Route Bridge",
    status: "authored",
    evidenceIds: ["e:route"],
    spatialProfile: {
      coordinateSpace: "local",
      routeId: "bridge",
      points: [{
        x: 23,
        y: -28.5,
        z: 0.5,
        index: 606,
      }],
      indexRanges: [{ min: 606, max: 606 }],
      transform: {
        kind: "offset",
        offsetPath: "gameplayOffset",
        functionName: "M",
      },
      contextSeries: {
        collectionName: "arenas",
        contextCount: 6,
        offsetPath: "gameplayOffset",
        offsetBase: { x: 0, y: 0, z: 0 },
        offsetStride: { x: 351, y: 0, z: 0 },
        contextIdPrefix: "arena_",
        contextIdIndexBase: 1,
      },
    },
  }],
  edges: [],
  invariants: [],
  unknowns: [],
};


const completeEntityAiStack = {
  entities: 1,
  states: 1,
  targetedStates: 1,
  targetedStackComplete: 1,
  targetedStackIncomplete: 0,
  navigationWithoutMovement: 0,
  targetedWithoutNavigation: 0,
  movementGoalWithoutNavigation: 0,
  goalPriorityConflictStates: 0,
  assessments: [{
    entityKey: "demo:zombie",
    stateId: "base",
    targeted: true,
    movementPresent: true,
    navigationPresent: true,
    movementGoalCandidatePresent: true,
    attackBehaviorPresent: true,
    navigationCapabilities: [
      "navigation:walk",
    ],
    movementGoalPriorities: [],
    duplicateMovementGoalPriorities: [],
    missingSurfaces: [],
    status: "targeted-stack-complete" as const,
  }],
};

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

describe("gameplay intent runtime stage", () => {
  it("evaluates observed outcomes against scoped state at the outcome tick", () => {
    const result = analyzeGameplayIntentRuntime(
      intent,
      [
        {
          path: "record.pendingCleanup",
          value: false,
          confidence: "observed",
          origin: "telemetry",
          scope: {
            arenaId: "arena-1",
            arenaGeneration: 2,
          },
          observedAt: { tick: 100 },
          evidenceId: "e:state-old",
        },
        {
          path: "record.pendingCleanup",
          value: true,
          confidence: "observed",
          origin: "telemetry",
          scope: {
            arenaId: "arena-1",
            arenaGeneration: 2,
          },
          observedAt: { tick: 120 },
          evidenceId: "e:state-new",
        },
      ],
      [{
        outcomeId: "outcome:cleanup",
        scope: {
          arenaId: "arena-1",
          arenaGeneration: 2,
        },
        observedAt: { tick: 120 },
        evidenceId: "e:outcome",
      }],
    );

    expect(result.designedBehavior).toBe(1);
    expect(result.confirmedDefects).toBe(0);
    expect(result.assessments[0]?.result.disposition)
      .toBe("designed-behavior");
  });

  it("emits targeted observation needs when runtime state is missing", () => {
    const result = analyzeGameplayIntentRuntime(
      intent,
      [],
      [{
        outcomeId: "outcome:cleanup",
        observedAt: { tick: 20 },
        evidenceId: "e:outcome",
      }],
    );

    expect(result.insufficientEvidence).toBe(1);
    expect(
      result.assessments[0]?.observationNeeds,
    ).toEqual([
      expect.objectContaining({
        policyId: "policy:pending-cleanup",
        expression: "record.pendingCleanup",
        paths: ["record.pendingCleanup"],
        deferred: false,
      }),
    ]);
  });

  it("evaluates runtime route observations against authored route geometry", () => {
    const result = analyzeGameplayIntentRuntime(
      routeIntent,
      [],
      [],
      [{
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
        evidenceId: "e:route-observation",
      }],
    );

    expect(result.routeResolved).toBe(1);
    expect(result.routeAmbiguous).toBe(0);
    expect(result.routeUnresolved).toBe(0);
    expect(
      result.routeAssessments[0]?.assessment,
    ).toEqual(expect.objectContaining({
      disposition: "resolved",
      routeId: "bridge",
      routeIndex: 606,
      distanceToTarget: expect.any(Number),
      nearest: expect.objectContaining({
        routeId: "bridge",
        routeIndex: 606,
      }),
    }));
  });

  it("keeps route observations unresolved without arena scope", () => {
    const result = analyzeGameplayIntentRuntime(
      routeIntent,
      [],
      [],
      [{
        entityKey: "demo:zombie",
        routeId: "bridge",
        routeIndex: 606,
        worldLocation: {
          x: 1778,
          y: -30,
          z: 0,
        },
        scope: {
          entityKey: "demo:zombie",
        },
        evidenceId: "e:no-arena",
      }],
    );

    expect(result.routeUnresolved).toBe(1);
    expect(
      result.routeAssessments[0]?.assessment.reasons[0],
    ).toMatch(/missing scope\.arenaId/);
  });

  it("correlates a stall with the latest compatible route observation", () => {
    const result = analyzeGameplayIntentRuntime(
      routeIntent,
      [],
      [],
      [{
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
      }],
      [{
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
      }],
    );

    expect(result.stallTargetNearestMatch).toBe(1);
    expect(result.stallTargetNearestDivergence).toBe(0);
    expect(result.stallAmbiguous).toBe(0);
    expect(result.stallUnresolved).toBe(0);
    expect(
      result.routeStallAssessments[0],
    ).toEqual(expect.objectContaining({
      disposition: "target-nearest-match",
      routeAssessment: expect.objectContaining({
        assessment: expect.objectContaining({
          disposition: "resolved",
          routeId: "bridge",
          routeIndex: 606,
        }),
      }),
      observationNeeds: expect.arrayContaining([
        expect.objectContaining({
          kind: "entity-motion-series",
        }),
        expect.objectContaining({
          kind: "navigation-target",
        }),
        expect.objectContaining({
          kind: "route-reachability",
        }),
        expect.objectContaining({
          kind: "chunk-route-availability",
        }),
      ]),
    }));
  });

  it("keeps a stall unresolved when no compatible route observation exists", () => {
    const result = analyzeGameplayIntentRuntime(
      routeIntent,
      [],
      [],
      [],
      [{
        entityKey: "demo:zombie",
        routeId: "bridge",
        stalledTicks: 80,
        scope: {
          arenaId: "arena_6",
          arenaGeneration: 3,
          entityKey: "demo:zombie",
        },
        observedAt: { tick: 225 },
        evidenceId: "e:stall",
      }],
    );

    expect(result.stallUnresolved).toBe(1);
    expect(
      result.routeStallAssessments[0]?.disposition,
    ).toBe("no-route-observation");
    expect(
      result.routeStallAssessments[0]?.observationNeeds,
    ).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "route-target-assignment",
      }),
      expect.objectContaining({
        kind: "entity-motion-series",
      }),
    ]));
  });

  it("does not correlate a future route observation to an earlier stall", () => {
    const result = analyzeGameplayIntentRuntime(
      routeIntent,
      [],
      [],
      [{
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
        observedAt: { tick: 230 },
        evidenceId: "e:route-future",
      }],
      [{
        entityKey: "demo:zombie",
        routeId: "bridge",
        stalledTicks: 80,
        scope: {
          arenaId: "arena_6",
          arenaGeneration: 3,
          entityKey: "demo:zombie",
        },
        observedAt: { tick: 225 },
        evidenceId: "e:stall",
      }],
    );

    expect(
      result.routeStallAssessments[0]?.disposition,
    ).toBe("no-route-observation");
  });

  it("fulfills route evidence and compiles only the remaining chunk probe", () => {
    const result = analyzeGameplayIntentRuntime(
      routeIntent,
      [],
      [],
      [
        {
          entityKey: "demo:zombie",
          routeId: "bridge",
          routeIndex: 606,
          worldLocation: {
            x: 1777.5,
            y: -30,
            z: 0,
          },
          scope: {
            arenaId: "arena_6",
            arenaGeneration: 3,
            entityKey: "demo:zombie",
          },
          observedAt: { tick: 210 },
          evidenceId: "e:route-a",
        },
        {
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
          evidenceId: "e:route-b",
        },
      ],
      [{
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
      }],
      [{
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
        evidenceId: "e:navigation-target",
      }],
      [{
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
      }],
      [],
      {
        dimension: "overworld",
        entityAiStack: completeEntityAiStack,
        routeNavigationEnvironment:
          compatibleRouteEnvironment,
      },
    );

    const stall =
      result.routeStallAssessments[0]!;
    expect(stall.motionSeries).toEqual(
      expect.objectContaining({
        sampleCount: 2,
        evidenceIds: ["e:route-a", "e:route-b"],
        firstTick: 210,
        lastTick: 220,
      }),
    );
    expect(
      stall.navigationTargetDistanceToAuthoredTarget,
    ).toBe(0);
    expect(
      stall.navigationTargetRouteMatchesAuthoredTarget,
    ).toBe(true);
    expect(stall.reachabilityObservation?.reachable)
      .toBe(true);

    expect(stall.evidencePlan.satisfied).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          need: "entity-motion-series",
        }),
        expect.objectContaining({
          need: "navigation-target",
        }),
        expect.objectContaining({
          need: "route-reachability",
        }),
      ]),
    );
    expect(stall.evidencePlan.instrumentation).toEqual([]);
    expect(stall.evidencePlan.runtimeProbeRequests).toEqual([
      expect.objectContaining({
        probeId: "gameplay-route-chunk-availability",
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
    expect(stall.evidencePlan.blocked).toEqual([]);
  });

  it("closes route evidence when the target chunk is loaded", () => {
    const result = analyzeGameplayIntentRuntime(
      routeIntent,
      [],
      [],
      [
        {
          entityKey: "demo:zombie",
          routeId: "bridge",
          routeIndex: 606,
          worldLocation: {
            x: 1777.5,
            y: -30,
            z: 0,
          },
          scope: {
            arenaId: "arena_6",
            arenaGeneration: 3,
            entityKey: "demo:zombie",
          },
          observedAt: { tick: 210 },
          evidenceId: "e:route-a",
        },
        {
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
          evidenceId: "e:route-b",
        },
      ],
      [{
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
        evidenceId: "telemetry-stall:stall-225",
      }],
      [{
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
        evidenceId: "e:navigation-target",
      }],
      [{
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
      }],
      [{
        requestId:
          "route-stall::telemetry-stall:stall-225::chunk-route-availability",
        state: "loaded",
        scope: {
          arenaId: "arena_6",
          arenaGeneration: 3,
          entityKey: "demo:zombie",
        },
        observedAt: { tick: 226 },
        evidenceId: "e:chunk-loaded",
      }],
      {
        dimension: "overworld",
        entityAiStack: completeEntityAiStack,
        routeNavigationEnvironment:
          compatibleRouteEnvironment,
      },
    );

    const stall = result.routeStallAssessments[0]!;
    expect(stall.chunkAvailabilityObservation?.state)
      .toBe("loaded");
    expect(stall.investigationDirection)
      .toBe("navigation-runtime-suspect");
    expect(stall.candidateAnalysis).toEqual(
      expect.objectContaining({
        supportedCandidateIds: [
          "engine-navigation-runtime",
        ],
        leadingCandidateId:
          "engine-navigation-runtime",
        stopCondition:
          "navigation-runtime-candidate-isolated",
      }),
    );
    expect(stall.evidencePlan.runtimeProbeRequests)
      .toEqual([]);
    expect(stall.evidencePlan.blocked).toEqual([]);
    expect(stall.evidencePlan.satisfied).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          need: "entity-motion-series",
        }),
        expect.objectContaining({
          need: "navigation-target",
        }),
        expect.objectContaining({
          need: "route-reachability",
        }),
        expect.objectContaining({
          need: "chunk-route-availability",
          evidenceIds: ["e:chunk-loaded"],
        }),
      ]),
    );
  });

  it("redirects investigation when the authored target chunk is not loaded", () => {
    const result = analyzeGameplayIntentRuntime(
      routeIntent,
      [],
      [],
      [{
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
      }],
      [{
        entityKey: "demo:zombie",
        routeId: "bridge",
        stalledTicks: 80,
        scope: {
          arenaId: "arena_6",
          arenaGeneration: 3,
          entityKey: "demo:zombie",
        },
        observedAt: { tick: 225 },
        evidenceId: "telemetry-stall:stall-225",
      }],
      [],
      [],
      [{
        requestId:
          "route-stall::telemetry-stall:stall-225::chunk-route-availability",
        state: "not-loaded",
        scope: {
          arenaId: "arena_6",
          arenaGeneration: 3,
          entityKey: "demo:zombie",
        },
        observedAt: { tick: 226 },
        evidenceId: "e:chunk-not-loaded",
      }],
      {
        dimension: "overworld",
        entityAiStack: completeEntityAiStack,
        routeNavigationEnvironment:
          compatibleRouteEnvironment,
      },
    );

    const stall = result.routeStallAssessments[0]!;
    expect(stall.investigationDirection)
      .toBe("route-chunk-unavailable");
    expect(stall.candidateAnalysis).toEqual(
      expect.objectContaining({
        leadingCandidateId: "chunk-availability",
        stopCondition: "route-cause-supported",
      }),
    );
    expect(
      stall.candidateAnalysis.candidates.find(
        (item) =>
          item.id === "chunk-availability",
      )?.status,
    ).toBe("supported");
    expect(stall.evidencePlan.runtimeProbeRequests)
      .toEqual([]);
    expect(stall.evidencePlan.satisfied).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          need: "chunk-route-availability",
          evidenceIds: ["e:chunk-not-loaded"],
        }),
      ]),
    );
  });

  it("reports policy violation as probable defect, not confirmed defect", () => {
    const result = analyzeGameplayIntentRuntime(
      intent,
      [{
        path: "record.pendingCleanup",
        value: false,
        confidence: "observed",
        origin: "runtime-probe",
        observedAt: { tick: 40 },
        evidenceId: "e:state",
      }],
      [{
        outcomeId: "outcome:cleanup",
        observedAt: { tick: 40 },
        evidenceId: "e:outcome",
      }],
    );

    expect(result.confirmedDefects).toBe(0);
    expect(result.assessments[0]?.result.disposition)
      .toBe("ambiguous-intent");
  });
});
