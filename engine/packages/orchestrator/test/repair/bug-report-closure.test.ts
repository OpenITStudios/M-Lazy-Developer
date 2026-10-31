import {
  describe,
  expect,
  it,
} from "vitest";
import type {
  BugReportV2,
} from "../../../bug-report/src/index.js";
import {
  completeBugReportFromClosedRepair,
} from "../../src/repair/bug-report-closure.js";

function report(): BugReportV2 {
  return {
    schema: "m-bedrock-bug-report/v2",
    map: {
      name: "Arena",
      mapVersion: "1.0.0",
      drive: "https://drive.google.com/file/d/map/view",
      baseVersion: "1.26.20",
      testedVersion: "1.26.32",
    },
    repairBy: "developer",
    bugs: [{
      id: "BUG-001",
      fixed: false,
      severity: "major",
      category: "game-flow",
      foundBy: "tester",
      title: "Round cannot continue",
      problem: "The next round never starts.",
      expected: "The next round starts.",
      observed: "The game remains stuck.",
      mustPreserve: ["Existing score state."],
    }],
  };
}

const closure = {
  schemaVersion: 1 as const,
  transactionId: "tx:1",
  scenarioId: "scenario:1",
  disposition: "fixed" as const,
  proofLayerEvidence: {
    transitive: ["evidence:transitive"],
    runtime: ["evidence:runtime"],
    preservation: ["evidence:preserve"],
    package: ["evidence:package"],
  },
  regressionEvidenceIds: ["evidence:regression"],
  evidenceIds: [
    "evidence:transitive",
    "evidence:runtime",
    "evidence:preserve",
    "evidence:package",
    "evidence:regression",
  ],
};

const preservation = {
  contractId: "contract:1",
  transactionId: "tx:1",
  passed: true,
  verifiedMustChangeInvariantIds: ["intent:round-flow"],
  verifiedMustPreserveInvariantIds: ["intent:score-state"],
  evidenceIds: ["evidence:preserve"],
};

describe("closed repair bug report bridge", () => {
  it("marks the canonical report fixed from a complete closure receipt", () => {
    const completed = completeBugReportFromClosedRepair({
      report: report(),
      bugId: "BUG-001",
      repairBy: "developer",
      closure,
      preservation,
    });

    expect(completed.bugs[0]?.fixed).toBe(true);
  });

  it("rejects mismatched or incomplete preservation proof", () => {
    expect(() =>
      completeBugReportFromClosedRepair({
        report: report(),
        bugId: "BUG-001",
        repairBy: "developer",
        closure,
        preservation: {
          ...preservation,
          transactionId: "tx:other",
        },
      })
    ).toThrow(/matching passed preservation proof/);

    expect(() =>
      completeBugReportFromClosedRepair({
        report: report(),
        bugId: "BUG-001",
        repairBy: "developer",
        closure,
        preservation: {
          ...preservation,
          verifiedMustPreserveInvariantIds: [],
        },
      })
    ).toThrow(/Must Preserve/);
  });
});
