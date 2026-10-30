// Cohesive source test family; same owner, feature, execution lane.
import { describe, expect, it } from "vitest";
import { buildKnowledgeEvidenceOverlay } from "../../src/diagnosis/evidence-overlay.js";
import { type RuntimeEvidenceIntegrityReport } from "../../../project-model/src/index.js";
import { planEvidenceRecovery } from "../../src/diagnosis/evidence-recovery.js";

// Original source suite: engine/packages/orchestrator/test/diagnosis/evidence-overlay.test.ts (Git blob 03013baefb43747bf20ba67e8a5580a32dde1195)
{


describe("knowledge evidence overlay", () => {
  it("translates runtime state observations into normalized mirror evidence", () => {
    const overlay = buildKnowledgeEvidenceOverlay({
      stateAuthorityContracts: [{
        id: "ready",
        authority: { kind: "scoreboard", key: "ready" },
        mirrors: [{ kind: "tag", key: "ready" }],
      }],
      stateObservations: [{
        surface: { kind: "scoreboard", key: "ready" },
        scopeKey: "player:a",
        value: 1,
        revision: 2,
      }, {
        surface: { kind: "tag", key: "ready" },
        scopeKey: "player:a",
        value: 0,
        revision: 1,
      }],
    });

    expect(overlay.stateMirrorCorrelations[0]?.status).toBe("revision-stale");
    expect(overlay.records).toEqual(expect.arrayContaining([
      expect.objectContaining({
        predicate: "state-authority-observed",
        state: "present",
      }),
      expect.objectContaining({
        predicate: "state-mirror-consistent",
        state: "absent",
      }),
    ]));
  });
});
}

// Original source suite: engine/packages/orchestrator/test/diagnosis/evidence-recovery.test.ts (Git blob f714ed620cbb0c954330c7bf4dbc820d9a01852e)
{


function integrity(
  overrides: Partial<RuntimeEvidenceIntegrityReport> = {},
): RuntimeEvidenceIntegrityReport {
  return {
    records: 1,
    observedRecords: 1,
    derivedRecords: 0,
    unknownConfidenceRecords: 0,
    unlocatedObservedRecords: 0,
    unresolvedConflictPredicates: [],
    resolvedConflictCount: 0,
    continuityComplete: true,
    telemetryContinuityComplete: true,
    safeForCurrentStateClaims: true,
    safeForTemporalViolationClaims: true,
    reasons: [
      "No evidence-integrity blocker is detected for the assessed claim classes.",
    ],
    ...overrides,
  };
}

describe("evidence recovery planning", () => {
  it("requires no recovery for healthy evidence channels", () => {
    expect(planEvidenceRecovery(
      integrity(),
      integrity(),
    )).toEqual({
      required: false,
      actions: [],
      blocksCurrentStateClaims: false,
      blocksTemporalClaims: false,
      blocksFullRepairAuthorization: false,
    });
  });

  it("requests telemetry recapture for missing temporal location and continuity", () => {
    const plan = planEvidenceRecovery(
      integrity({
        unlocatedObservedRecords: 2,
        continuityComplete: false,
        telemetryContinuityComplete: false,
        safeForTemporalViolationClaims: false,
      }),
      integrity(),
    );

    expect(plan.required).toBe(true);
    expect(plan.blocksCurrentStateClaims).toBe(false);
    expect(plan.blocksTemporalClaims).toBe(true);
    expect(plan.blocksFullRepairAuthorization).toBe(true);
    expect(plan.actions.map((item) => item.kind)).toEqual([
      "recapture-continuous-stream",
      "recapture-with-observation-points",
    ]);
  });

  it("requests runtime-probe rerun without blocking healthy telemetry current-state claims", () => {
    const plan = planEvidenceRecovery(
      integrity(),
      integrity({
        continuityComplete: false,
        safeForTemporalViolationClaims: false,
      }),
    );

    expect(plan.actions).toEqual([
      expect.objectContaining({
        channel: "runtime-probe",
        kind: "rerun-runtime-probe-bundle",
      }),
    ]);
    expect(plan.blocksCurrentStateClaims).toBe(false);
    expect(plan.blocksTemporalClaims).toBe(true);
  });

  it("treats unresolved state conflict as a current-state blocker", () => {
    const plan = planEvidenceRecovery(
      integrity({
        unresolvedConflictPredicates: ["route-ready"],
        safeForCurrentStateClaims: false,
        safeForTemporalViolationClaims: false,
      }),
      integrity(),
    );

    expect(plan.actions).toEqual([
      expect.objectContaining({
        channel: "telemetry",
        kind: "resolve-current-state-conflicts",
        blocks: expect.arrayContaining([
          "current-state-claims",
          "full-repair-authorization",
        ]),
      }),
    ]);
    expect(plan.blocksCurrentStateClaims).toBe(true);
  });
});
}
