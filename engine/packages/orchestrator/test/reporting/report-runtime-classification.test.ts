import {
  describe,
  expect,
  it,
} from "vitest";
import type {
  RuntimeExperimentDefinition,
} from "../../../runtime-lab/src/index.js";
import {
  deriveReportClassificationFromRuntimeExperiment,
} from "../../src/reporting/report-runtime-classification.js";

function definition(
  domain: RuntimeExperimentDefinition["domain"],
): RuntimeExperimentDefinition {
  return {
    schemaVersion: 1,
    id: "exp:test",
    title: "Test",
    domain,
    requiredContext: "LIVE_MINECRAFT",
    mutationRisk: "read-only",
    targetProfileFingerprint: "target",
    fixtureFingerprint: "fixture",
    protocol: [],
    factors: [],
    arms: [],
    outcomePredicateIds: [],
    minimumRunsPerArm: 1,
  };
}

function bridge(
  predicate: string,
  state: "present" | "absent" = "present",
) {
  return {
    experimentId: "exp:test",
    qualificationState: "repeatable" as const,
    predicates: [{
      predicate,
      observation: {
        predicate,
        state,
        evidenceId: "bridge:" + predicate,
      },
      ceiling: "repeatable" as const,
      sourceEvidenceIds: [
        "runtime:" + predicate,
      ],
    }],
    observations: [],
  };
}

describe("runtime report classification", () => {
  it("derives multiplayer state impact and session-concurrency failure from stale session mutation", () => {
    const result =
      deriveReportClassificationFromRuntimeExperiment(
        definition("multiplayer"),
        bridge("stale-session-mutation-observed"),
      );

    expect(result.impact).toEqual([{
      kind: "important-state-wrong",
      evidenceIds: [
        "runtime:stale-session-mutation-observed",
      ],
    }]);
    expect(result.primaryFailure).toEqual([{
      failure: "session-concurrency",
      evidenceIds: [
        "runtime:stale-session-mutation-observed",
      ],
    }]);
  });

  it("derives entity-decision only for an explicit entity-ai failure predicate", () => {
    const result =
      deriveReportClassificationFromRuntimeExperiment(
        definition("entity-ai"),
        bridge("navigation-stall-observed"),
      );

    expect(result.impact[0]?.kind)
      .toBe("core-mechanic-wrong");
    expect(result.primaryFailure[0]?.failure)
      .toBe("entity-decision");
  });

  it("does not turn success or measurement predicates into impact", () => {
    const result =
      deriveReportClassificationFromRuntimeExperiment(
        definition("multiplayer"),
        bridge("arena-player-count-sampled"),
      );

    expect(result.impact).toEqual([]);
    expect(result.primaryFailure).toEqual([]);
    expect(result.unmappedPresentPredicateIds)
      .toEqual(["arena-player-count-sampled"]);
  });

  it("does not derive impact when the failure predicate is absent", () => {
    const result =
      deriveReportClassificationFromRuntimeExperiment(
        definition("multiplayer"),
        bridge(
          "stale-session-mutation-observed",
          "absent",
        ),
      );

    expect(result.impact).toEqual([]);
    expect(result.primaryFailure).toEqual([]);
  });

  it("rejects mismatched experiment identities", () => {
    expect(() =>
      deriveReportClassificationFromRuntimeExperiment(
        definition("multiplayer"),
        {
          ...bridge(
            "stale-session-mutation-observed",
          ),
          experimentId: "exp:other",
        },
      )
    ).toThrow(/same experiment id/);
  });
});
