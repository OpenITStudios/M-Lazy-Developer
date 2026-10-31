import { describe, expect, it } from "vitest";
import {
  assessDiagnosticHypotheses,
  diagnosticEvidenceFromBehaviorProperties,
  type DiagnosticHypothesisSet,
} from "../src/index.js";

const hypotheses: DiagnosticHypothesisSet = {
  schemaVersion: 1,
  id: "start-stall",
  hypotheses: [{
    id: "stale-callback",
    statement:
      "A stale callback mutated or blocked the current session generation.",
    supportingPredicates: [
      "session-start-liveness-violated",
    ],
  }, {
    id: "unrelated-rendering",
    statement:
      "Rendering state explains the session start stall.",
    supportingPredicates: [
      "rendering-fault-observed",
    ],
  }],
};

describe("behavior property diagnostic evidence", () => {
  it("turns a violation into symptom evidence without selecting a cause", () => {
    const mapped =
      diagnosticEvidenceFromBehaviorProperties(
        [{
          propertyId:
            "start-eventually-playing",
          disposition: "violated",
          witnessTicks: [10, 30],
          reason: "deadline missed",
        }],
        [{
          propertyId:
            "start-eventually-playing",
          violationPredicate:
            "session-start-liveness-violated",
        }],
      );

    expect(mapped.observations).toEqual([{
      predicate:
        "session-start-liveness-violated",
      state: "present",
      evidenceId:
        "behavior-property:start-eventually-playing:violated",
    }]);

    const assessed =
      assessDiagnosticHypotheses(
        hypotheses,
        mapped.observations,
      );

    expect(
      assessed.find(
        (item) =>
          item.hypothesisId ===
          "stale-callback",
      )?.disposition,
    ).toBe("supported");
    expect(
      assessed.find(
        (item) =>
          item.hypothesisId ===
          "unrelated-rendering",
      )?.disposition,
    ).toBe("open");
  });

  it("preserves unresolved temporal evidence as unknown", () => {
    const mapped =
      diagnosticEvidenceFromBehaviorProperties(
        [{
          propertyId:
            "start-eventually-playing",
          disposition: "unknown",
          witnessTicks: [10],
          reason:
            "trace is incomplete",
        }],
        [{
          propertyId:
            "start-eventually-playing",
          violationPredicate:
            "session-start-liveness-violated",
        }],
      );

    expect(
      mapped.observations[0]?.state,
    ).toBe("unknown");

    expect(
      assessDiagnosticHypotheses(
        hypotheses,
        mapped.observations,
      ).find(
        (item) =>
          item.hypothesisId ===
          "stale-callback",
      )?.disposition,
    ).toBe("open");
  });

  it("reports unmapped properties instead of discarding them silently", () => {
    const mapped =
      diagnosticEvidenceFromBehaviorProperties(
        [{
          propertyId: "unmapped",
          disposition: "violated",
          witnessTicks: [1],
          reason: "x",
        }],
        [],
      );

    expect(
      mapped.unmappedPropertyIds,
    ).toEqual(["unmapped"]);
  });
});
