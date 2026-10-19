import { describe, expect, it } from "vitest";
import type {
  DecisionLedgerSnapshot,
} from "../../../project-model/src/index.js";
import type {
  ValidationTraceReport,
} from "../../../validation/src/index.js";
import {
  buildEngineeringReviewInvalidationProjection,
} from "../../src/workflow/engineering-review-invalidation.js";

describe("engineering review invalidation projection", () => {
  it("translates basis drift into a human-readable blocking action", () => {
    const ledger: DecisionLedgerSnapshot = {
      schemaVersion: 1,
      entries: [{
        id: "decision:repair",
        kind: "repair-authorization",
        status: "active",
        basis: {
          sourceFingerprint: "source-a",
          runtimeEvidenceRevision: "runtime-a",
        },
        upstreamDecisionIds: [],
        inputIds: [],
        outputIds: [],
        evidenceIds: [],
        createdSequence: 1,
      }],
    };

    const projection =
      buildEngineeringReviewInvalidationProjection(
        {
          sourceFingerprint: "source-b",
          runtimeEvidenceRevision: "runtime-a",
        },
        ledger,
      );

    expect(projection.invalidatedDecisionCount).toBe(1);
    expect(projection.items[0]).toMatchObject({
      category: "source-changed",
      nextAction: "reinspect-artifact",
      blocking: true,
      decisionId: "decision:repair",
    });
    expect(projection.items[0]?.reason).toMatch(
      /sourceFingerprint changed/,
    );
  });

  it("keeps superseded decisions non-blocking and points to the replacement", () => {
    const ledger: DecisionLedgerSnapshot = {
      schemaVersion: 1,
      entries: [
        {
          id: "old",
          kind: "diagnostic-candidate-selection",
          status: "superseded",
          basis: {},
          upstreamDecisionIds: [],
          inputIds: [],
          outputIds: [],
          evidenceIds: [],
          createdSequence: 1,
          supersededBy: "new",
        },
        {
          id: "new",
          kind: "diagnostic-candidate-selection",
          status: "active",
          basis: {},
          upstreamDecisionIds: [],
          inputIds: [],
          outputIds: [],
          evidenceIds: [],
          createdSequence: 2,
        },
      ],
    };

    const projection =
      buildEngineeringReviewInvalidationProjection(
        {},
        ledger,
      );

    expect(projection.supersededDecisionCount).toBe(1);
    expect(projection.blockingCount).toBe(0);
    expect(projection.items[0]).toMatchObject({
      category: "superseded",
      nextAction: "follow-replacement",
      blocking: false,
    });
    expect(projection.items[0]?.reason).toContain("new");
  });

  it("explains stale validation by cause without changing validation truth", () => {
    const trace: ValidationTraceReport = {
      runs: [{
        runId: "run:1",
        scenarioId: "scenario:1",
        scenarioRevision: "rev-1",
        intentInvariantIds: ["inv:1"],
        ok: true,
        proofLevel: "LIVE GAME VERIFIED",
        proofSufficient: true,
        current: false,
        staleReasons: [
          "artifact fingerprint changed since this validation run",
          "target runtime profile changed since this validation run",
        ],
        evidenceIds: ["ev:1"],
      }],
      invariants: [{
        invariantId: "inv:1",
        scenarioIds: ["scenario:1"],
        runIds: ["run:1"],
        currentPassingRunIds: [],
        current: false,
      }],
    };

    const projection =
      buildEngineeringReviewInvalidationProjection(
        {},
        undefined,
        trace,
      );

    expect(projection.staleValidationRunCount).toBe(1);
    expect(projection.items.map((item) => item.category)).toEqual([
      "validation-artifact-changed",
      "validation-runtime-changed",
    ]);
    expect(projection.blockingCount).toBe(2);
  });
});
