import { describe, expect, it } from "vitest";
import type {
  IntentDiagnosticGateResult,
} from "../../diagnostic-reasoning/src/index.js";
import {
  routeIntentDiagnosticNextAnalysis,
} from "../src/index.js";

function result(
  nextEvidenceNeed:
    IntentDiagnosticGateResult["nextEvidenceNeed"],
): IntentDiagnosticGateResult {
  return {
    disposition:
      nextEvidenceNeed === "runtime-proof"
        ? "runtime-proof-required"
        : "insufficient-evidence",
    subjectIds: ["arena"],
    basisInvariantIds: [],
    evidenceIds: [],
    nextEvidenceNeed,
    reasons: [],
  };
}

describe("diagnostic analysis routing", () => {
  it("stops automatically for complete classifications", () => {
    expect(
      routeIntentDiagnosticNextAnalysis(
        result("none"),
      ).disposition,
    ).toBe("complete");
  });

  it("routes runtime-proof needs to runtime behavior analysis", () => {
    expect(
      routeIntentDiagnosticNextAnalysis(
        result("runtime-proof"),
      ),
    ).toMatchObject({
      disposition: "analyze",
      goal: "runtime-behavior",
    });

    expect(
      routeIntentDiagnosticNextAnalysis(
        result("runtime-evidence-integrity"),
      ),
    ).toMatchObject({
      disposition: "analyze",
      goal: "runtime-evidence-integrity",
    });
  });

  it("routes contradiction proof separately from intent evidence", () => {
    expect(
      routeIntentDiagnosticNextAnalysis(
        result("contradiction-proof"),
      ),
    ).toMatchObject({
      disposition: "analyze",
      goal: "contradiction-proof",
    });

    expect(
      routeIntentDiagnosticNextAnalysis(
        result("contract-evidence"),
      ),
    ).toMatchObject({
      disposition: "analyze",
      goal: "contract-evidence",
    });
  });
});
