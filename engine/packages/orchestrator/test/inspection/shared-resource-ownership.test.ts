import { describe, expect, it } from "vitest";
import {
  analyzeSharedResourceOwnership,
} from "../../src/inspection/shared-resource-ownership.js";
import type {
  SemanticIr,
} from "../../../semantic-ir/src/index.js";

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
