import { describe, expect, it } from "vitest";
import {
  analysisCapabilitiesFor,
  createAnalysisCapabilityRegistry,
  validateAnalysisCapabilityRegistry,
  type AnalysisCapability,
} from "../src/index.js";

function capability(
  id: string,
  prerequisites: readonly string[] = [],
): AnalysisCapability {
  return {
    id,
    executionPhase: "discovery-core",
    evidenceLevel: "static",
    cost: "cheap",
    tags: ["session"],
    deterministic: true,
    contexts: ["LOCAL_ARTIFACT"],
    producesTraits: ["structural-proof"],
    prerequisites,
  };
}

describe("analysis capability registry", () => {
  it("normalizes a valid registry deterministically", () => {
    const registry =
      createAnalysisCapabilityRegistry([
        capability("b"),
        capability("a"),
      ]);

    expect(
      registry.capabilities.map(
        (item) => item.id,
      ),
    ).toEqual(["a", "b"]);
  });

  it("rejects duplicate ids and unknown prerequisites", () => {
    const errors =
      validateAnalysisCapabilityRegistry({
        schemaVersion: 1,
        capabilities: [
          capability("a", ["missing"]),
          capability("a"),
        ],
      });

    expect(errors.join(" ")).toMatch(
      /Duplicate analysis capability id/,
    );
    expect(errors.join(" ")).toMatch(
      /unknown prerequisite/,
    );
  });

  it("rejects prerequisite cycles", () => {
    const errors =
      validateAnalysisCapabilityRegistry({
        schemaVersion: 1,
        capabilities: [
          capability("a", ["b"]),
          capability("b", ["a"]),
        ],
      });

    expect(errors.join(" ")).toMatch(
      /prerequisite cycle/,
    );
  });

  it("filters capabilities by context and relevance tags", () => {
    const registry =
      createAnalysisCapabilityRegistry([
        capability("session"),
        {
          ...capability("dialogue"),
          tags: ["dialogue"],
        },
      ]);

    expect(
      analysisCapabilitiesFor(
        registry,
        ["session"],
        "LOCAL_ARTIFACT",
      ).map((item) => item.id),
    ).toEqual(["session"]);
  });
});
