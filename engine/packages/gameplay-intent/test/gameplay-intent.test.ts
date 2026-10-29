import { describe, expect, it } from "vitest";
import {
  assessGameplayIntentGrounding,
  deriveUnknownGameplayEvidenceInquiry,
  admitReviewedUnknownSourceRelations,
  assessGameplayRouteObservation,
  evaluateGameplayOutcomeAdmissibility,
  evaluateGameplayPolicyPredicate,
  gameplayOutcomePolicyRequirements,
  planGameplayOutcomeRuntimeObservations,
  findNearestGameplayRoutePoint,
  projectGameplayRoutePoint,
  resolveGameplayRouteIndex,
  resolveGameplayRouteTarget,
  resolveGameplaySpatialContext,
  unresolvedGameplayPolicyOperands,
  validateGameplayIntentModel,
  type GameplayIntentModel,
} from "../src/index.js";

const model: GameplayIntentModel = {
  schemaVersion: 1,
  id: "builder-memory",
  evidence: [
    {
      id: "e:phase",
      origin: "source-code",
      locator: "scripts/game/countdown.js",
      summary: "Source defines observation before building.",
    },
    {
      id: "e:plot",
      origin: "source-code",
      locator: "scripts/game/geometry.js",
      summary: "Source defines an assigned build plot.",
    },
  ],
  nodes: [
    {
      id: "phase:observation",
      kind: "phase",
      label: "Observation",
      status: "authored",
      evidenceIds: ["e:phase"],
    },
    {
      id: "mechanic:plot-build",
      kind: "mechanic",
      label: "Build in assigned plot",
      status: "authored",
      evidenceIds: ["e:plot"],
    },
  ],
  edges: [
    {
      id: "edge:observation-before-build",
      from: "phase:observation",
      to: "mechanic:plot-build",
      kind: "requires",
      status: "authored",
      evidenceIds: ["e:phase"],
    },
  ],
  invariants: [
    {
      id: "inv:plot-only",
      statement: "Player building is scoped to the assigned plot.",
      strength: "must",
      status: "authored",
      subjectIds: ["mechanic:plot-build"],
      evidenceIds: ["e:plot"],
    },
  ],
  unknowns: [],
};

describe("gameplay intent", () => {
  it("validates evidence-grounded graph references", () => {
    expect(validateGameplayIntentModel(model)).toEqual([]);
  });

  it("adopts only exact reviewed source relations without creating a gameplay mechanic", () => {
    const unknownModel: GameplayIntentModel = {
      ...model, artifactId: "map:selected",
      evidence: [
        { id: "op:write", origin: "source-code", scope: "selected-artifact",
          locator: "behavior_packs/demo/scripts/main.js:10:4", summary: "write site" },
        { id: "effect:gate", origin: "source-code", scope: "selected-artifact",
          locator: "behavior_packs/demo/scripts/main.js:12:4", summary: "effect site" },
        { id: "op:foreign", origin: "historical-diff", scope: "external-reference",
          locator: "old/scripts/main.js:10:4", summary: "old map" },
      ],
      nodes: [], edges: [], invariants: [],
      unknowns: [{
        id: "unknown:entry", question: "What is this unknown gameplay action?",
        blockedSubjectIds: [], sourceEntryRegionId: "exec:entry",
        evidenceIds: ["op:write", "effect:gate"],
      }],
    };
    const proposal = {
      unknownId: "unknown:entry",
      sourceClaim: "SOURCE_GUARD_VALUE_HANDOFF_CANDIDATE" as const,
      fromStepId: "op:write", toStepId: "effect:gate",
      sourceRelationEvidenceIds: ["effect:gate", "op:write"],
    };
    const accepted = admitReviewedUnknownSourceRelations(unknownModel, [proposal]);
    expect(validateGameplayIntentModel(accepted)).toEqual([]);
    expect(accepted.nodes).toEqual([]);
    expect(accepted.edges).toEqual([]);
    expect(accepted.unknowns[0]?.question).toBe(unknownModel.unknowns[0]?.question);
    expect(accepted.unknowns[0]?.sourceRelations).toMatchObject([{
      sourceClaim: "SOURCE_GUARD_VALUE_HANDOFF_CANDIDATE",
      proofBoundary: "REVIEWED_TYPED_SOURCE_RELATION_NOT_GAMEPLAY_OR_RUNTIME_PROOF",
      evidenceIds: ["effect:gate", "op:write"],
    }]);
    expect(() => admitReviewedUnknownSourceRelations(accepted, [proposal]))
      .toThrow(/already reviewed/);
    expect(() => admitReviewedUnknownSourceRelations(unknownModel, [{
      ...proposal, fromStepId: "op:foreign",
      sourceRelationEvidenceIds: ["op:foreign", "effect:gate"],
    }])).toThrow(/unowned, non-source or ambiguous/);
    expect(() => admitReviewedUnknownSourceRelations(unknownModel, [{
      ...proposal, unknownId: "unknown:other",
    }])).toThrow(/unowned, non-source or ambiguous/);
  });

  it("reports grounded subjects when no open intent question blocks them", () => {
    expect(
      assessGameplayIntentGrounding(
        model,
        ["mechanic:plot-build"],
      ).disposition,
    ).toBe("grounded");
  });

  it("evaluates structured policy predicates deterministically", () => {
    expect(
      evaluateGameplayPolicyPredicate(
        {
          kind: "truthy",
          operand: {
            kind: "path",
            path: "state.pendingCleanup",
          },
        },
        {
          state: {
            pendingCleanup: true,
            phase: "active",
          },
        },
      ),
    ).toBe("satisfied");

    expect(
      evaluateGameplayPolicyPredicate(
        {
          kind: "comparison",
          operator: "eq",
          left: {
            kind: "path",
            path: "state.phase",
          },
          right: {
            kind: "literal",
            value: "active",
          },
        },
        {
          state: {
            phase: "countdown",
          },
        },
      ),
    ).toBe("violated");

    expect(
      evaluateGameplayPolicyPredicate(
        {
          kind: "comparison",
          operator: "neq",
          left: {
            kind: "path",
            path: "record.generation",
          },
          right: {
            kind: "path",
            path: "session.generation",
          },
        },
        {
          record: {
            generation: 3,
          },
          session: {
            generation: 4,
          },
        },
      ),
    ).toBe("satisfied");

    expect(
      evaluateGameplayPolicyPredicate(
        {
          kind: "in",
          operand: {
            kind: "path",
            path: "state.phase",
          },
          values: [
            "countdown",
            "preparing",
            "resetting",
            "cinematic",
          ],
        },
        {
          state: {
            phase: "preparing",
          },
        },
      ),
    ).toBe("satisfied");

    expect(
      evaluateGameplayPolicyPredicate(
        {
          kind: "fallback",
          excludedPredicates: [
            {
              kind: "comparison",
              operator: "eq",
              left: {
                kind: "path",
                path: "state.phase",
              },
              right: {
                kind: "literal",
                value: "active",
              },
            },
            {
              kind: "in",
              operand: {
                kind: "path",
                path: "state.phase",
              },
              values: ["countdown", "preparing"],
            },
          ],
        },
        {
          state: {
            phase: "finishing",
          },
        },
      ),
    ).toBe("satisfied");

    expect(
      evaluateGameplayPolicyPredicate(
        {
          kind: "truthy",
          operand: {
            kind: "path",
            path: "missing.value",
          },
        },
        {},
      ),
    ).toBe("unknown");
  });

  it("evaluates indexed policy operands from runtime state", () => {
    const predicate = {
      kind: "falsy" as const,
      operand: {
        kind: "index" as const,
        base: {
          kind: "path" as const,
          path: "session.roster",
        },
        key: {
          kind: "path" as const,
          path: "record.playerId",
        },
      },
    };

    expect(
      evaluateGameplayPolicyPredicate(
        predicate,
        {
          record: { playerId: "player-a" },
          session: {
            roster: {
              "player-a": true,
            },
          },
        },
      ),
    ).toBe("violated");

    expect(
      evaluateGameplayPolicyPredicate(
        predicate,
        {
          record: { playerId: "player-a" },
          session: {
            roster: {
              "player-a": false,
            },
          },
        },
      ),
    ).toBe("satisfied");

    expect(
      evaluateGameplayPolicyPredicate(
        predicate,
        {
          record: { playerId: "player-b" },
          session: {
            roster: {
              "player-a": true,
            },
          },
        },
      ),
    ).toBe("unknown");
  });

  it("reports exact unresolved runtime policy operands", () => {
    const predicate = {
      kind: "all" as const,
      predicates: [
        {
          kind: "comparison" as const,
          operator: "neq" as const,
          left: {
            kind: "path" as const,
            path: "record.generation",
          },
          right: {
            kind: "path" as const,
            path: "session.generation",
          },
        },
        {
          kind: "falsy" as const,
          operand: {
            kind: "index" as const,
            base: {
              kind: "path" as const,
              path: "session.roster",
            },
            key: {
              kind: "path" as const,
              path: "record.playerId",
            },
          },
        },
      ],
    };

    const unresolved = unresolvedGameplayPolicyOperands(
      predicate,
      {
        record: {
          generation: 4,
          playerId: "player-a",
        },
      },
    );

    expect(unresolved).toEqual(expect.arrayContaining([
      {
        kind: "path",
        path: "session.generation",
      },
      {
        kind: "index",
        base: {
          kind: "path",
          path: "session.roster",
        },
        key: {
          kind: "path",
          path: "record.playerId",
        },
      },
    ]));
  });

  it("lists policy requirements for targeted runtime observation", () => {
    const policyModel: GameplayIntentModel = {
      schemaVersion: 1,
      id: "requirements",
      evidence: [{
        id: "e:policy",
        origin: "source-code",
        locator: "recovery-policy.ts",
        summary: "Recovery guard.",
      }],
      nodes: [
        {
          id: "outcome:resume",
          kind: "outcome",
          label: "Resume",
          status: "authored",
          evidenceIds: ["e:policy"],
        },
        {
          id: "policy:active",
          kind: "policy",
          label: "Active phase",
          status: "authored",
          evidenceIds: ["e:policy"],
          policyPredicate: {
            kind: "comparison",
            operator: "eq",
            left: {
              kind: "path",
              path: "session.phase",
            },
            right: {
              kind: "literal",
              value: "active",
            },
          },
        },
      ],
      edges: [{
        id: "edge:resume-active",
        from: "outcome:resume",
        to: "policy:active",
        kind: "requires",
        status: "authored",
        evidenceIds: ["e:policy"],
      }],
      invariants: [],
      unknowns: [],
    };

    expect(
      gameplayOutcomePolicyRequirements(
        policyModel,
        "outcome:resume",
      ),
    ).toEqual([
      expect.objectContaining({
        policyId: "policy:active",
        operands: [{
          kind: "path",
          path: "session.phase",
        }],
      }),
    ]);
  });

  it("plans concrete and deferred runtime observations for missing policy state", () => {
    const policyModel: GameplayIntentModel = {
      schemaVersion: 1,
      id: "runtime-needs",
      evidence: [{
        id: "e:policy",
        origin: "source-code",
        locator: "recovery-policy.ts",
        summary: "Membership and phase guards.",
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
          id: "policy:membership",
          kind: "policy",
          label: "Missing membership",
          status: "authored",
          evidenceIds: ["e:policy"],
          policyPredicate: {
            kind: "falsy",
            operand: {
              kind: "index",
              base: {
                kind: "path",
                path: "session.roster",
              },
              key: {
                kind: "path",
                path: "record.playerId",
              },
            },
          },
        },
      ],
      edges: [{
        id: "edge:membership",
        from: "outcome:cleanup",
        to: "policy:membership",
        kind: "requires",
        status: "authored",
        evidenceIds: ["e:policy"],
      }],
      invariants: [],
      unknowns: [],
    };

    expect(
      planGameplayOutcomeRuntimeObservations(
        policyModel,
        "outcome:cleanup",
        {
          record: {
            playerId: "player-a",
          },
        },
      ),
    ).toEqual([
      expect.objectContaining({
        policyId: "policy:membership",
        expression:
          "session.roster[record.playerId]",
        paths: ["session.roster.player-a"],
        deferred: false,
      }),
    ]);

    expect(
      planGameplayOutcomeRuntimeObservations(
        policyModel,
        "outcome:cleanup",
        {},
      ),
    ).toEqual([
      expect.objectContaining({
        expression:
          "session.roster[record.playerId]",
        paths: ["record.playerId"],
        deferred: true,
      }),
    ]);
  });

  it("evaluates outcome admissibility across authored policy guards", () => {
    const policyModel: GameplayIntentModel = {
      schemaVersion: 1,
      id: "reconnect-policy",
      evidence: [{
        id: "e:policy",
        origin: "source-code",
        locator: "src/recovery-policy.ts",
        summary: "Direct guarded cleanup outcome.",
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
              path: "state.pendingCleanup",
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
        id: "inv:cleanup-policy",
        statement: "Cleanup is admissible only under known guards.",
        strength: "must",
        status: "inferred",
        subjectIds: ["outcome:cleanup"],
        evidenceIds: ["e:policy"],
      }],
      unknowns: [],
    };

    expect(
      evaluateGameplayOutcomeAdmissibility(
        policyModel,
        "outcome:cleanup",
        { state: { pendingCleanup: true } },
      ).disposition,
    ).toBe("admissible");

    expect(
      evaluateGameplayOutcomeAdmissibility(
        policyModel,
        "outcome:cleanup",
        { state: { pendingCleanup: false } },
      ).disposition,
    ).toBe("inadmissible");

    expect(
      evaluateGameplayOutcomeAdmissibility(
        {
          ...policyModel,
          unknowns: [{
            id: "unknown:coverage",
            question: "Other cleanup branches are unresolved.",
            blockedSubjectIds: ["outcome:cleanup"],
          }],
        },
        "outcome:cleanup",
        { state: { pendingCleanup: false } },
      ).disposition,
    ).toBe("unknown");
  });

  it("resolves route-index ambiguity without guessing", () => {
    const routeModel: GameplayIntentModel = {
      schemaVersion: 1,
      id: "routes",
      evidence: [{
        id: "e:routes",
        origin: "source-code",
        locator: "scripts/routes.js",
        summary: "Authored route points.",
      }],
      nodes: [
        {
          id: "spatial-region:route-main",
          kind: "spatial-region",
          label: "Route Main",
          status: "authored",
          evidenceIds: ["e:routes"],
          spatialProfile: {
            coordinateSpace: "unknown",
            routeId: "main",
            points: [
              { x: 0, y: 0, z: 0, index: 9 },
            ],
            indexRanges: [{ min: 0, max: 18 }],
          },
        },
        {
          id: "spatial-region:route-bridge",
          kind: "spatial-region",
          label: "Route Bridge",
          status: "authored",
          evidenceIds: ["e:routes"],
          spatialProfile: {
            coordinateSpace: "unknown",
            routeId: "bridge",
            points: [
              { x: 1, y: 0, z: 0, index: 9 },
              { x: 2, y: 0, z: 0, index: 600 },
            ],
            indexRanges: [
              { min: 3, max: 13 },
              { min: 600, max: 610 },
            ],
          },
        },
        {
          id: "spatial-region:route-windmill",
          kind: "spatial-region",
          label: "Route Windmill",
          status: "authored",
          evidenceIds: ["e:routes"],
          spatialProfile: {
            coordinateSpace: "unknown",
            routeId: "windmill",
            points: [
              { x: 3, y: 0, z: 0, index: 9 },
            ],
            indexRanges: [
              { min: 6, max: 9 },
              { min: 500, max: 503 },
            ],
          },
        },
      ],
      edges: [],
      invariants: [],
      unknowns: [],
    };

    expect(
      resolveGameplayRouteIndex(routeModel, 9),
    ).toEqual({
      index: 9,
      disposition: "ambiguous",
      routeNodeIds: [
        "spatial-region:route-bridge",
        "spatial-region:route-main",
        "spatial-region:route-windmill",
      ],
      routeIds: ["bridge", "main", "windmill"],
    });

    expect(
      resolveGameplayRouteIndex(routeModel, 600),
    ).toEqual({
      index: 600,
      disposition: "unique",
      routeNodeIds: [
        "spatial-region:route-bridge",
      ],
      routeIds: ["bridge"],
    });

    expect(
      resolveGameplayRouteIndex(routeModel, 999),
    ).toEqual({
      index: 999,
      disposition: "unresolved",
      routeNodeIds: [],
      routeIds: [],
    });
  });

  it("projects local route points into authored arena world coordinates", () => {
    const routeModel: GameplayIntentModel = {
      schemaVersion: 1,
      id: "projected-routes",
      evidence: [{
        id: "e:route",
        origin: "source-code",
        locator: "scripts/main.js",
        summary: "Authored route + arena offset series.",
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
            {
              x: -17.5,
              y: -28.5,
              z: -110.5,
              index: 0,
            },
          ],
          indexRanges: [{ min: 0, max: 0 }],
          transform: {
            kind: "offset",
            offsetPath: "gameplayOffset",
            functionName: "applyOffset",
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

    expect(
      resolveGameplaySpatialContext(
        routeModel,
        "spatial-region:route-main",
        "arena_3",
      ),
    ).toEqual({
      routeNodeId: "spatial-region:route-main",
      disposition: "resolved",
      contextIndex: 2,
      contextId: "arena_3",
    });

    expect(
      projectGameplayRoutePoint(
        routeModel,
        "spatial-region:route-main",
        0,
        "arena_3",
      ),
    ).toEqual({
      routeNodeId: "spatial-region:route-main",
      routeId: "main",
      routeIndex: 0,
      disposition: "resolved",
      contextIndex: 2,
      contextId: "arena_3",
      localPoint: {
        x: -17.5,
        y: -28.5,
        z: -110.5,
      },
      offset: {
        x: 702,
        y: 0,
        z: 0,
      },
      worldPoint: {
        x: 684.5,
        y: -28.5,
        z: -110.5,
      },
    });

    expect(
      projectGameplayRoutePoint(
        routeModel,
        "spatial-region:route-main",
        999,
        "arena_3",
      ).disposition,
    ).toBe("unresolved");
  });

  it("resolves route targets only when route context is sufficient", () => {
    const routeModel: GameplayIntentModel = {
      schemaVersion: 1,
      id: "route-targets",
      evidence: [{
        id: "e:route",
        origin: "source-code",
        locator: "scripts/main.js",
        summary: "Authored route targets.",
      }],
      nodes: [
        {
          id: "spatial-region:route-main",
          kind: "spatial-region",
          label: "Route Main",
          status: "authored",
          evidenceIds: ["e:route"],
          spatialProfile: {
            coordinateSpace: "local",
            routeId: "main",
            points: [{
              x: -66,
              y: -27.5,
              z: -26,
              index: 9,
            }],
            indexRanges: [{ min: 9, max: 9 }],
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
        },
        {
          id: "spatial-region:route-bridge",
          kind: "spatial-region",
          label: "Route Bridge",
          status: "authored",
          evidenceIds: ["e:route"],
          spatialProfile: {
            coordinateSpace: "local",
            routeId: "bridge",
            points: [
              {
                x: 30,
                y: -28.5,
                z: -4,
                index: 9,
              },
              {
                x: 23,
                y: -28.5,
                z: 0.5,
                index: 606,
              },
            ],
            indexRanges: [
              { min: 9, max: 9 },
              { min: 606, max: 606 },
            ],
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
        },
      ],
      edges: [],
      invariants: [],
      unknowns: [],
    };

    expect(
      resolveGameplayRouteTarget(
        routeModel,
        9,
        "arena_6",
      ).disposition,
    ).toBe("ambiguous");

    expect(
      resolveGameplayRouteTarget(
        routeModel,
        9,
        "arena_6",
        "bridge",
      ),
    ).toEqual({
      routeIndex: 9,
      disposition: "resolved",
      candidates: [{
        routeNodeId: "spatial-region:route-bridge",
        routeId: "bridge",
        routeIndex: 9,
        localPoint: {
          x: 30,
          y: -28.5,
          z: -4,
        },
        worldPoint: {
          x: 1785,
          y: -28.5,
          z: -4,
        },
      }],
    });

    const nearest = findNearestGameplayRoutePoint(
      routeModel,
      "arena_6",
      {
        x: 1778,
        y: -30,
        z: 0,
      },
      "bridge",
    );

    expect(nearest.disposition).toBe("resolved");
    expect(nearest.nearest).toEqual(
      expect.objectContaining({
        routeId: "bridge",
        routeIndex: 606,
        worldPoint: {
          x: 1778,
          y: -28.5,
          z: 0.5,
        },
      }),
    );
    expect(nearest.nearest?.distance).toBeCloseTo(
      Math.sqrt(2.5),
    );
  });

  it("assesses observed route position without inventing a bug threshold", () => {
    const routeModel: GameplayIntentModel = {
      schemaVersion: 1,
      id: "route-observation",
      evidence: [{
        id: "e:route",
        origin: "source-code",
        locator: "scripts/main.js",
        summary: "Authored route projection.",
      }],
      nodes: [
        {
          id: "spatial-region:route-main",
          kind: "spatial-region",
          label: "Route Main",
          status: "authored",
          evidenceIds: ["e:route"],
          spatialProfile: {
            coordinateSpace: "local",
            routeId: "main",
            points: [{
              x: -66,
              y: -27.5,
              z: -26,
              index: 9,
            }],
            indexRanges: [{ min: 9, max: 9 }],
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
        },
        {
          id: "spatial-region:route-bridge",
          kind: "spatial-region",
          label: "Route Bridge",
          status: "authored",
          evidenceIds: ["e:route"],
          spatialProfile: {
            coordinateSpace: "local",
            routeId: "bridge",
            points: [
              {
                x: 30,
                y: -28.5,
                z: -4,
                index: 9,
              },
              {
                x: 23,
                y: -28.5,
                z: 0.5,
                index: 606,
              },
            ],
            indexRanges: [
              { min: 9, max: 9 },
              { min: 606, max: 606 },
            ],
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
        },
      ],
      edges: [],
      invariants: [],
      unknowns: [],
    };

    expect(
      assessGameplayRouteObservation(
        routeModel,
        {
          context: "arena_6",
          routeIndex: 9,
          worldLocation: {
            x: 1778,
            y: -30,
            z: 0,
          },
        },
      ).disposition,
    ).toBe("ambiguous");

    const bridge = assessGameplayRouteObservation(
      routeModel,
      {
        context: "arena_6",
        routeId: "bridge",
        routeIndex: 606,
        worldLocation: {
          x: 1778,
          y: -30,
          z: 0,
        },
      },
    );

    expect(bridge.disposition).toBe("resolved");
    expect(bridge.target).toEqual(
      expect.objectContaining({
        routeId: "bridge",
        routeIndex: 606,
        worldPoint: {
          x: 1778,
          y: -28.5,
          z: 0.5,
        },
      }),
    );
    expect(bridge.nearest).toEqual(
      expect.objectContaining({
        routeId: "bridge",
        routeIndex: 606,
      }),
    );
    expect(bridge.distanceToTarget).toBeCloseTo(
      Math.sqrt(2.5),
    );
  });

  it("blocks diagnosis when an open intent question affects the subject", () => {
    const ambiguous: GameplayIntentModel = {
      ...model,
      unknowns: [{
        id: "unknown:reconnect",
        question: "Should reconnect resume the same round?",
        blockedSubjectIds: ["mechanic:plot-build"],
      }],
    };

    expect(
      assessGameplayIntentGrounding(
        ambiguous,
        ["mechanic:plot-build"],
      ).disposition,
    ).toBe("ambiguous");
  });
});


describe("current-map unknown gameplay purpose evidence", () => {
  it("links only exact source/blocked Intent subjects to independent design and player cues", () => {
    const current: GameplayIntentModel = {
      schemaVersion: 1, id: "intent:selected", artifactId: "selected",
      evidence: [{
        id: "op:effect", origin: "source-code", scope: "selected-artifact",
        locator: "scripts/entry.js:10:2", summary: "Exact selected operation",
      }, {
        id: "op:outcome", origin: "source-code", scope: "selected-artifact",
        locator: "scripts/entry.js:20:2", summary: "Exact return",
      }, {
        id: "spec:approved", origin: "game-design-spec",
        designStatus: "approved", scope: "selected-artifact",
        locator: "design/accepted.md#objective", summary: "Approved selected objective",
      }, {
        id: "cue:choice", origin: "translation", scope: "selected-artifact",
        locator: "resource_packs/demo/texts/en_US.lang#L8",
        summary: "Authored display copy", playerFacingText: {
          key: "demo.choice", text: "Choose your path",
        },
      }, {
        id: "spec:unrelated", origin: "game-design-spec",
        designStatus: "approved", scope: "selected-artifact",
        locator: "design/unrelated.md#goal", summary: "Other feature",
      }, {
        id: "spec:speculative", origin: "game-design-spec",
        designStatus: "approved", scope: "selected-artifact",
        locator: "design/speculation.md#goal", summary: "Hypothesis-only feature",
      }, {
        id: "spec:old", origin: "historical-diff",
        scope: "external-reference", locator: "older/goal.md",
        summary: "Old map claim",
      }, {
        id: "op:orphan", origin: "source-code", scope: "selected-artifact",
        locator: "scripts/other.js:9:1", summary: "Independent unknown",
      }],
      nodes: [{
        id: "objective:active", kind: "objective", label: "Possible objective",
        status: "authored", evidenceIds: ["op:effect", "spec:approved", "cue:choice"],
      }, {
        id: "outcome:result", kind: "outcome", label: "Possible outcome",
        status: "inferred", evidenceIds: ["op:outcome"],
      }, {
        id: "objective:unrelated", kind: "objective", label: "Other objective",
        status: "authored", evidenceIds: ["spec:unrelated"],
      }, {
        id: "objective:unverified", kind: "objective", label: "Hypothetical",
        status: "hypothesis", evidenceIds: ["op:effect", "spec:speculative"],
      }],
      edges: [{
        id: "edge:to-outcome", from: "objective:active",
        to: "outcome:result", kind: "produces", status: "inferred",
        evidenceIds: ["op:effect"],
      }],
      invariants: [],
      unknowns: [{
        id: "unknown:entry", question: "What does the selected code mean?",
        blockedSubjectIds: ["objective:active"],
        sourceEntryRegionId: "entry",
        evidenceIds: ["op:effect", "spec:old"],
      }, {
        id: "unknown:orphan", question: "What is the purpose of this state?",
        blockedSubjectIds: [], sourceEntryRegionId: "other",
        evidenceIds: ["op:orphan"],
      }],
    };
    const linked = deriveUnknownGameplayEvidenceInquiry(
      current, "unknown:entry", ["op:effect"]);
    expect(linked?.designDisposition).toBe("grounded-design");
    expect(linked?.approvedDesignEvidenceIds).toEqual(["spec:approved"]);
    expect(linked?.playerFacingEvidenceIds).toEqual(["cue:choice"]);
    expect(linked?.independentCues[0]?.approval).toBe("approved");
    expect(linked?.independentCues.find(item =>
      item.evidenceId === "cue:choice")?.literalPlayerText).toBe("Choose your path");
    expect(linked?.subjectLinks).toEqual([{
      subjectId: "objective:active", kind: "objective",
      basis: "SHARED_SELECTED_SOURCE_EVIDENCE",
    }]);
    expect(linked?.authoredRelationLeads.map(edge => edge.edgeId))
      .toEqual(["edge:to-outcome"]);
    expect(linked?.questions.map(question => question.focus))
      .toEqual(["DESIGN_PURPOSE", "PLAYER_PRESENTATION", "PLAYER_FLOW_OWNERSHIP"]);
    const allRefs = [
      ...(linked?.approvedDesignEvidenceIds ?? []),
      ...(linked?.playerFacingEvidenceIds ?? []),
    ];
    expect(allRefs).not.toContain("spec:unrelated");
    expect(allRefs).not.toContain("spec:speculative");
    expect(allRefs).not.toContain("spec:old");

    // A design record authored at the SAME technical site is not
    // independent corroboration, even if labeled approved.
    const coLocated: GameplayIntentModel = {
      ...current,
      evidence: current.evidence.map(item => item.id === "spec:approved"
        ? { ...item, locator: "scripts/entry.js:10:2" } : item),
    };
    const noIndependentDesign = deriveUnknownGameplayEvidenceInquiry(
      coLocated, "unknown:entry", ["op:effect"]);
    expect(noIndependentDesign?.approvedDesignEvidenceIds).toEqual([]);
    expect(noIndependentDesign?.designDisposition).not.toBe("grounded-design");

    // Draft gameplay notes must remain a claim, never an approved rule.
    const draft: GameplayIntentModel = {
      ...current,
      evidence: current.evidence.map(item => item.id === "spec:approved"
        ? { ...item, designStatus: "draft" as const } : item),
    };
    const draftInquiry = deriveUnknownGameplayEvidenceInquiry(
      draft, "unknown:entry", ["op:effect"]);
    expect(draftInquiry?.designDisposition).toBe("design-claim");
    expect(draftInquiry?.approvedDesignEvidenceIds).toEqual([]);
    expect(draftInquiry?.draftDesignEvidenceIds).toEqual(["spec:approved"]);

    const orphan = deriveUnknownGameplayEvidenceInquiry(
      current, "unknown:orphan", ["op:orphan"]);
    expect(orphan?.designDisposition).toBe("implementation-only");
    expect(orphan?.approvedDesignEvidenceIds).toEqual([]);
    expect(orphan?.subjectLinks).toEqual([]);
    expect(orphan?.questions[0]?.evidenceIds).toEqual([]);
    expect(deriveUnknownGameplayEvidenceInquiry(
      current, "unknown:entry", ["spec:old"])).toBeUndefined();
    expect(deriveUnknownGameplayEvidenceInquiry(
      current, "unknown:missing", ["op:effect"])).toBeUndefined();
  });
});
