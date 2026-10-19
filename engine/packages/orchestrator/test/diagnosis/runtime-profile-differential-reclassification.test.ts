import { describe, expect, it } from "vitest";
import type {
  GameplayIntentModel,
} from "../../../gameplay-intent/src/index.js";
import {
  reclassifyIntentDiagnosticFromProfileDifferential,
  type RuntimeProfileDifferentialReport,
} from "../../src/index.js";

function intent(): GameplayIntentModel {
  return {
    schemaVersion: 1,
    id: "compatibility-intent",
    artifactId: "fixture:selected-map",
    evidence: [{
      id: "intent-evidence",
      origin: "source-code",
      locator: "scripts/feature.ts",
      scope: "selected-artifact",
      summary:
        "Authored feature behavior expected by the project.",
    }],
    nodes: [{
      id: "feature",
      kind: "state",
      label: "Feature state",
      status: "authored",
      evidenceIds: ["intent-evidence"],
    }],
    edges: [],
    invariants: [{
      id: "feature-invariant",
      statement:
        "Feature behavior is authored, but runtime support policy determines which profiles must preserve it.",
      strength: "must",
      status: "authored",
      subjectIds: ["feature"],
      evidenceIds: ["intent-evidence"],
    }],
    unknowns: [],
  };
}

function report(
  disposition: "stable" | "divergent" | "insufficient",
): RuntimeProfileDifferentialReport {
  return {
    experimentId: "exp:profile-differential",
    differentialContractRevision: "contract-r1",
    disposition,
    validationErrors:
      disposition === "insufficient"
        ? ["one profile is not repeatable"]
        : [],
    comparisons: [{
      key:
        "feature-behavior-observed@role:treatment",
      predicate: "feature-behavior-observed",
      role: "treatment",
      disposition,
      states:
        disposition === "insufficient"
          ? []
          : [{
              profileFingerprint: "profile-retail",
              edition: "bedrock-retail",
              host: "listen-server",
              version: "1.26.40",
              scriptModules: {},
              experiments: [],
              armId: "treatment",
              role: "treatment",
              predicate:
                "feature-behavior-observed",
              state: "present",
              evidenceIds: ["retail:evidence"],
            }, {
              profileFingerprint: "profile-education",
              edition: "education",
              host: "education-host",
              version: "1.26.40",
              scriptModules: {},
              experiments: [],
              armId: "treatment",
              role: "treatment",
              predicate:
                "feature-behavior-observed",
              state:
                disposition === "divergent"
                  ? "absent"
                  : "present",
              evidenceIds: ["education:evidence"],
            }],
    }],
  };
}

describe("runtime profile differential reclassification", () => {
  it("classifies validated cross-profile divergence as compatibility-difference rather than confirmed defect", () => {
    const result =
      reclassifyIntentDiagnosticFromProfileDifferential({
        intent: intent(),
        subjectIds: ["feature"],
        report: report("divergent"),
      });

    expect(result.disposition).toBe(
      "compatibility-difference",
    );
    expect(
      result.matchedCompatibilityPredicates,
    ).toEqual([
      "runtime-profile-divergence:feature-behavior-observed@role:treatment",
    ]);
    expect(result.gate.evidenceIds).toEqual(
      expect.arrayContaining([
        "retail:evidence",
        "education:evidence",
      ]),
    );
  });

  it("does not convert stable profile behavior into a defect or compatibility difference", () => {
    const result =
      reclassifyIntentDiagnosticFromProfileDifferential({
        intent: intent(),
        subjectIds: ["feature"],
        report: report("stable"),
      });

    expect(result.disposition).toBe(
      "insufficient-evidence",
    );
    expect(
      result.matchedCompatibilityPredicates,
    ).toEqual([]);
  });

  it("fails closed when profile comparison itself is insufficient", () => {
    const result =
      reclassifyIntentDiagnosticFromProfileDifferential({
        intent: intent(),
        subjectIds: ["feature"],
        report: report("insufficient"),
      });

    expect(result.disposition).toBe(
      "insufficient-evidence",
    );
    expect(result.gate.evidenceIds).toEqual([]);
  });
});
