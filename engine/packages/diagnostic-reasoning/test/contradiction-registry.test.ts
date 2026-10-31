import { describe, expect, it } from "vitest";
import {
  buildContradictionRegistry,
} from "../src/index.js";

describe("contradiction registry", () => {
  it("dedupes only exact work and preserves corroborating routes", () => {
    const registry =
      buildContradictionRegistry([
        {
          semanticKey: "same-defect",
          route: "static",
          evidenceIds: ["e1"],
        },
        {
          semanticKey: "same-defect",
          route: "static",
          evidenceIds: ["e1"],
        },
        {
          semanticKey: "same-defect",
          route: "runtime",
          evidenceIds: ["e2"],
        },
      ]);

    expect(
      registry.exactDuplicateIndexes,
    ).toEqual([1]);
    expect(
      registry.uniqueCandidateIndexes,
    ).toEqual([0, 2]);
    expect(
      registry.corroboratedSemanticKeys,
    ).toEqual(["same-defect"]);
  });
});
