// Consolidated same-owner feature family preserving original source bodies.
import { describe, expect, it } from "vitest";
import { parseMcFunction } from "../../../../analyzers/functions/src/index.js";
import { analyzeFunctionTopology } from "../../src/topology-analysis.js";
import { analyzeStructureAndChunkRuntime } from "../../src/structure-runtime-analysis.js";
import { derivePlacementProofs } from "../../src/structure-proof-analysis.js";
import { correlateRouteMutations, routeMutationRuntimeEvidence } from "../../src/inspection/route-mutation-analysis.js";
import { parseScriptFile } from "../../../../analyzers/scripts/src/index.js";
import { analyzeScriptSpatialMutations } from "../../src/inspection/script-spatial-analysis.js";
import { parseSpatialAuthorityBehaviorContract } from "../../src/inspection/spatial-authority-contract-load.js";
import { analyzeSpatialAuthorityCoverage } from "../../src/inspection/spatial-authority-analysis.js";
import { spatialAuthorityDiagnostics } from "../../src/inspection/spatial-authority-diagnostics.js";

// Source engine/packages/orchestrator/test/inspection/route-mutation-analysis.test.ts; pinned blob 5c76955db18bbb4b7f3c4b3420e1b327f141e773
{
const fn = parseMcFunction(
  "demo:mutate",
  "fill 10 64 10 20 70 20 minecraft:stone",
  { artifactId: "a", relativePath: "functions/mutate.mcfunction" },
);

const topology = analyzeFunctionTopology([fn]);
const structureRuntime = analyzeStructureAndChunkRuntime([fn]);
const proofs = derivePlacementProofs(structureRuntime, [fn]);

describe("route mutation correlation", () => {
  it("keeps canonical route identity separate from segment contract identity", () => {
    const correlations = correlateRouteMutations([{
      id: "intent-route:main:arena_1:0-1",
      routeId: "main",
      volume: {
        min: { x: 0, y: 60, z: 0 },
        max: { x: 30, y: 80, z: 30 },
      },
    }], topology, proofs);

    expect(correlations[0]).toEqual(expect.objectContaining({
      routeId: "main",
      contractId: "intent-route:main:arena_1:0-1",
      status: "overlap",
    }));
  });

  it("proves overlap for a dimension-agnostic route contract", () => {
    const correlations = correlateRouteMutations([{
      id: "bridge",
      volume: {
        min: { x: 0, y: 60, z: 0 },
        max: { x: 30, y: 80, z: 30 },
      },
    }], topology, proofs);

    expect(correlations).toHaveLength(1);
    expect(correlations[0]?.status).toBe("overlap");
    expect(routeMutationRuntimeEvidence(correlations)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          predicate: "route-affecting-world-mutation",
          state: "present",
        }),
      ]),
    );
  });

  it("keeps overlap unresolved when route dimension is known but mutation dimension is not", () => {
    const correlations = correlateRouteMutations([{
      id: "bridge",
      dimension: "overworld",
      volume: {
        min: { x: 0, y: 60, z: 0 },
        max: { x: 30, y: 80, z: 30 },
      },
    }], topology, proofs);

    expect(correlations[0]?.status).toBe("dimension-unresolved");
    expect(routeMutationRuntimeEvidence(correlations)).toEqual([]);
  });

  it("rejects coordinate overlap across explicitly different dimensions", () => {
    const correlations = correlateRouteMutations([{
      id: "bridge",
      dimension: "overworld",
      volume: {
        min: { x: 0, y: 60, z: 0 },
        max: { x: 30, y: 80, z: 30 },
      },
    }], topology, proofs, "nether");

    expect(correlations[0]?.status).toBe("no-overlap");
  });
});
}

// Source engine/packages/orchestrator/test/inspection/script-spatial-analysis.test.ts; pinned blob a61e4600a3addf187b1016f10e2fe56a287f1e48
{
describe("script spatial analysis", () => {
  it("resolves deterministic script coordinates into topology effects", () => {
    const script = parseScriptFile(
      "main",
      [
        "const P = { x: 10, y: 20, z: 30 };",
        "function setup(dimension) {",
        "  dimension.setBlockType(P, 'minecraft:stone');",
        "  dimension.spawnEntity('minecraft:zombie', P);",
        "}",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result = analyzeScriptSpatialMutations([script]);
    expect(result.resolvedEffects).toEqual([
      {
        kind: "setblock",
        position: { x: 10, y: 20, z: 30 },
        block: "minecraft:stone",
        sourcePath: "scripts/main.ts",
      },
      {
        kind: "entity-spawn",
        entityIdentifier: "minecraft:zombie",
        position: { x: 10, y: 20, z: 30 },
        sourcePath: "scripts/main.ts",
      },
    ]);
  });

  it("preserves teleport destination policy in resolved source evidence", () => {
    const script = parseScriptFile(
      "main",
      [
        "const P = { x: 1, y: 2, z: 3 };",
        "player.teleport(P, { dimension: nether, checkForBlocks: true });",
      ].join("\n"),
      { artifactId: "fixture", relativePath: "scripts/main.ts" },
    );
    const result = analyzeScriptSpatialMutations([script]);
    expect(result.resolvedEffectSources[0]).toMatchObject({
      dimensionExpression: "nether",
      checkForBlocks: true,
    });
  });

  it("keeps tryTeleport result identity available for transaction verification", () => {
    const script = parseScriptFile(
      "main",
      [
        "const P = { x: 1, y: 2, z: 3 };",
        "const moved = player.tryTeleport(P, { checkForBlocks: true });",
      ].join("\n"),
      { artifactId: "fixture", relativePath: "scripts/main.ts" },
    );
    expect(analyzeScriptSpatialMutations([script]).resolvedEffectSources[0]).toMatchObject({
      resultBinding: "moved",
      checkForBlocks: true,
    });
  });

  it("keeps runtime-dynamic block identity out of topology proof", () => {
    const script = parseScriptFile(
      "main",
      [
        "const P = { x: 1, y: 2, z: 3 };",
        "function setup(dimension, blockType) {",
        "  dimension.setBlockType(P, blockType);",
        "}",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result = analyzeScriptSpatialMutations([script]);
    expect(result.resolvedEffects).toEqual([]);
    expect(result.failures[0]?.reason).toMatch(
      /runtime-dynamic/,
    );
  });
});
}

// Source engine/packages/orchestrator/test/inspection/spatial-authority-analysis.test.ts; pinned blob 2d9c759fea774a209fb68a96d9229d7706b850a5
{
// Source-preserving owner-local family consolidation at pinned GitHub revision.
// Original case/expect bodies retained in separate lexical blocks.

// Original engine/packages/orchestrator/test/inspection/spatial-authority-analysis.test.ts; blob 746b1faa6b058a4438783f4f180a1eb215b13602
{
// Source-preserving family consolidation: original suites and assertions retained in separate lexical scopes.

// Original suite engine/packages/orchestrator/test/inspection/spatial-authority-contract-load.test.ts, blob 4cddeccad552080e1c3fdc4b47d4d7d421650f3e
{



describe("spatial authority contract parser", () => {
  it("normalizes a valid contract without inventing defaults", () => {
    expect(
      parseSpatialAuthorityBehaviorContract({
        schemaVersion: 1,
        id: "blitz-build",
        rules: [
          {
            id: "build-plot-place",
            regionId: "build-plot",
            actor: "player",
            action: "place-block",
            phases: ["building", "building"],
            decision: "allow",
          },
        ],
      }),
    ).toEqual({
      schemaVersion: 1,
      id: "blitz-build",
      rules: [
        {
          id: "build-plot-place",
          regionId: "build-plot",
          actor: "player",
          action: "place-block",
          phases: ["building"],
          decision: "allow",
        },
      ],
    });
  });

  it("accepts system block-mutation authority without aliasing it to player break-block", () => {
    const parsed = parseSpatialAuthorityBehaviorContract({
      schemaVersion: 1,
      id: "hazard-policy",
      rules: [{
        id: "system-hazard-mutation",
        regionId: "arena",
        actor: "system",
        action: "mutate-blocks",
        decision: "allow",
      }],
    });
    expect(parsed.rules[0]?.action).toBe("mutate-blocks");
  });

  it("rejects duplicate rule ids at the parser boundary", () => {
    expect(() =>
      parseSpatialAuthorityBehaviorContract({
        schemaVersion: 1,
        id: "duplicate",
        rules: [
          {
            id: "same",
            regionId: "build-plot",
            actor: "player",
            action: "place-block",
            decision: "allow",
          },
          {
            id: "same",
            regionId: "lobby",
            actor: "player",
            action: "place-block",
            decision: "deny",
          },
        ],
      }),
    ).toThrow(/Duplicate spatial authority rule id/);
  });

  it("rejects unknown actions instead of silently accepting typos", () => {
    expect(() =>
      parseSpatialAuthorityBehaviorContract({
        schemaVersion: 1,
        id: "invalid",
        rules: [
          {
            id: "bad-action",
            regionId: "build-plot",
            actor: "player",
            action: "placeblock",
            decision: "allow",
          },
        ],
      }),
    ).toThrow(/invalid action/);
  });
});

}

// Original suite engine/packages/orchestrator/test/inspection/spatial-authority-analysis.test.ts, blob 773a491f923893c1bba55278b955b4017ee05d56
{



const regions = [
  {
    id: "build-plot",
    role: "mutable" as const,
    coordinateSpace: "absolute" as const,
    volume: {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 10, y: 10, z: 10 },
    },
  },
  {
    id: "lobby",
    role: "static" as const,
    coordinateSpace: "absolute" as const,
    volume: {
      min: { x: 20, y: 0, z: 0 },
      max: { x: 30, y: 10, z: 10 },
    },
  },
];

describe("spatial authority coverage", () => {
  it("reports covered and uncovered gameplay authority requirements separately", () => {
    const result = analyzeSpatialAuthorityCoverage(
      regions,
      {
        schemaVersion: 1,
        id: "arena-policy",
        rules: [
          {
            id: "build-only-during-building",
            regionId: "build-plot",
            actor: "player",
            action: "place-block",
            phases: ["building"],
            decision: "allow",
          },
          {
            id: "deny-lobby-mutation",
            regionId: "lobby",
            actor: "player",
            action: "break-block",
            decision: "deny",
          },
        ],
      },
      [
        {
          regionId: "build-plot",
          actor: "player",
          action: "place-block",
          phase: "building",
        },
        {
          regionId: "build-plot",
          actor: "player",
          action: "use-item",
          phase: "building",
        },
      ],
    );

    expect(result).toMatchObject({
      policyValid: true,
      resolved: 1,
      uncovered: 1,
      conflicts: 0,
      unknownRegions: 0,
    });
  });

  it("rejects policy references to unknown region contracts", () => {
    const result = analyzeSpatialAuthorityCoverage(
      regions,
      {
        schemaVersion: 1,
        id: "bad-policy",
        rules: [
          {
            id: "ghost-rule",
            regionId: "missing-region",
            actor: "player",
            action: "place-block",
            decision: "deny",
          },
        ],
      },
      [],
    );

    expect(result.policyValid).toBe(false);
    expect(result.referencedUnknownRegions).toEqual([
      "missing-region",
    ]);
  });
});

}

// Original suite engine/packages/orchestrator/test/inspection/spatial-authority-diagnostics.test.ts, blob e98029ac73965c0b374fffc506cc02388fda911a
{



describe("spatial authority diagnostics", () => {
  it("emits medium severity for conflicting or invalid policy coverage", () => {
    const findings =
      spatialAuthorityDiagnostics({
        policyId: "policy",
        policyValid: false,
        policyErrors: [],
        knownRegions: ["plot"],
        referencedUnknownRegions: ["ghost"],
        resolved: 0,
        uncovered: 0,
        conflicts: 1,
        unknownRegions: 1,
        assessments: [],
      });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      code: "SPATIAL_AUTHORITY_POLICY_GAP",
      severity: "medium",
    });
  });

  it("uses minor severity for uncovered authored requirements only", () => {
    const findings =
      spatialAuthorityDiagnostics({
        policyId: "policy",
        policyValid: true,
        policyErrors: [],
        knownRegions: ["plot"],
        referencedUnknownRegions: [],
        resolved: 1,
        uncovered: 1,
        conflicts: 0,
        unknownRegions: 0,
        assessments: [],
      });

    expect(findings[0]).toMatchObject({
      code: "SPATIAL_AUTHORITY_POLICY_GAP",
      severity: "minor",
    });
  });
});

}
}

// Original engine/packages/orchestrator/test/spatial-authority-inspection-input.test.ts; blob 921c676ef252887e2c9d8973aab4b2f4297a9767
{
describe("spatial authority inspection inputs", () => {
  it("resolves explicit requirements against authored regions and policy", () => {
    const result =
      analyzeSpatialAuthorityCoverage(
        [{
          id: "plot",
          role: "mutable",
          coordinateSpace: "absolute",
          volume: {
            min: { x: 0, y: 0, z: 0 },
            max: { x: 10, y: 10, z: 10 },
          },
        }],
        {
          schemaVersion: 1,
          id: "policy",
          rules: [{
            id: "deny-observation-build",
            regionId: "plot",
            actor: "player",
            action: "place-block",
            phases: ["observation"],
            decision: "deny",
          }],
        },
        [{
          regionId: "plot",
          actor: "player",
          action: "place-block",
          phase: "observation",
        }],
      );

    expect(result).toMatchObject({
      policyValid: true,
      resolved: 1,
      uncovered: 0,
      conflicts: 0,
      unknownRegions: 0,
    });
    expect(result.assessments[0]).toMatchObject({
      status: "resolved",
      decision: "deny",
    });
  });
});
}
}
