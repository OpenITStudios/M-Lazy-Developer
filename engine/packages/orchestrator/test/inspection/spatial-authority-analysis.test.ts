// Source-preserving family consolidation: original suites and assertions retained in separate lexical scopes.
import { describe } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { parseSpatialAuthorityBehaviorContract } from "../../src/inspection/spatial-authority-contract-load.js";
import { analyzeSpatialAuthorityCoverage } from "../../src/inspection/spatial-authority-analysis.js";
import { spatialAuthorityDiagnostics } from "../../src/inspection/spatial-authority-diagnostics.js";

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
