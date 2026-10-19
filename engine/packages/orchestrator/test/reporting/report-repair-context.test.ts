import {
  describe,
  expect,
  it,
} from "vitest";
import {
  deriveConfirmedDefectSemanticKey,
  type ConfirmedDefect,
} from "../../../bug-report/src/index.js";
import type {
  InvariantRegistrySnapshot,
} from "../../../project-model/src/index.js";
import {
  applyReportRepairContext,
  deriveMustPreserveFromRepairInvariants,
} from "../../src/reporting/report-repair-context.js";

const defectIdentity = {
  subjectIds: ["outcome:cleanup"],
  brokenInvariantIds: ["inv:broken"],
  repairUnitIds: ["unit:cleanup"],
  primaryFailure: "player-owned-state" as const,
};

const defect: ConfirmedDefect = {
  ...defectIdentity,
  semanticKey:
    deriveConfirmedDefectSemanticKey(defectIdentity),
  foundBy: "ai",
  confirmation: {
    basis: "authored-contract-violation",
    evidence: "cleanup contradiction",
  },
  impact: {
    progression: "degraded",
    recovery: "normal",
    stability: "stable",
    coreMechanic: "correct",
    importantState: "materially-wrong",
    fairness: "unaffected",
  },
  title: "Cleanup retains state",
  problem: "State remains.",
  expected: {
    authority: "selected-artifact",
    statement: "State resets.",
    evidenceIds: ["intent:cleanup"],
  },
  observed: {
    statement: "State remains.",
    evidenceIds: ["static:cleanup"],
  },
  aiAnalysis: "Cleanup omits reset.",
  sourceEvidence: [{
    source: {
      artifactId: "map",
      relativePath: "scripts/session.ts",
    },
    reason: "Owns cleanup.",
  }],
  suggestedFix: "Reset owned state during cleanup.",
  brokenInvariantIds: ["inv:broken"],
  repairUnitIds: ["unit:cleanup"],
};

const registry: InvariantRegistrySnapshot = {
  schemaVersion: 1,
  revision: "r1",
  profileKey: "bedrock",
  entries: [{
    id: "inv:preserve",
    source: {
      kind: "knowledge-relation",
      id: "relation:session",
      revision: "k1",
    },
    enforcement: "runtime-state",
    minimumRepairClaim: "proven-runtime",
    stateRequirements: [{
      id: "state:arena-isolation",
      predicate: "arenaIsolation",
      expectedState: "present",
    }],
    temporalRequirements: [],
    revalidationLayers: ["static", "runtime"],
    rationale: "Cross-arena isolation must remain intact.",
  }],
};

describe("report repair context", () => {
  it("derives Must Preserve only from automatically selected repair invariants", () => {
    const values = deriveMustPreserveFromRepairInvariants(
      {
        incidentId: "incident",
        candidateId: "candidate",
        chainIds: ["chain"],
        relationIds: ["relation:session"],
        invariantIds: ["inv:preserve"],
        missingChainIds: [],
        unsupportedRelationIds: [],
        automaticSelectionAllowed: true,
        reasons: [],
      },
      registry,
    );

    expect(values).toEqual([
      "Cross-arena isolation must remain intact.",
      "Preserve arenaIsolation as present.",
    ]);
  });

  it("fails closed when invariant selection is not automatic", () => {
    const values = deriveMustPreserveFromRepairInvariants(
      {
        incidentId: "incident",
        chainIds: [],
        relationIds: [],
        invariantIds: ["inv:preserve"],
        missingChainIds: [],
        unsupportedRelationIds: [],
        automaticSelectionAllowed: false,
        reasons: ["insufficient provenance"],
      },
      registry,
    );

    expect(values).toEqual([]);
  });

  it("removes Suggested Fix while repair decision is observe-only", () => {
    const result = applyReportRepairContext(
      defect,
      {
        decision: {
          incidentId: "incident",
          activeCandidateIds: ["a", "b"],
          disposition: "observe-only",
          claimStrength: "hypothesis",
          reasons: ["Multiple candidates remain."],
        },
      },
    );

    expect(result.suggestedFix).toBeUndefined();
  });
});
