import { describe, expect, it } from "vitest";
import {
  RegressionCorpus,
} from "../../../reliability/src/index.js";
import type {
  CounterexampleScenario,
} from "../../../runtime-lab/src/index.js";
import type {
  PostRepairClosureResult,
} from "../../src/index.js";
import {
  addClosedRepairToRegressionCorpus,
  regressionCaseFromClosedRepair,
} from "../../src/index.js";

const scenario: CounterexampleScenario = {
  schemaVersion: 1,
  id: "reconnect-membership",
  modelId: "model",
  queryId: "membership-invariant",
  runtimeStatus: "runtime-bound",
  steps: [{
    index: 1,
    transitionId: "join",
    transitionOwner: "player",
    instruction: "Join Arena 1.",
  }, {
    index: 2,
    transitionId: "disconnect",
    transitionOwner: "player",
    instruction: "Disconnect player.",
  }, {
    index: 3,
    transitionId: "reconnect",
    transitionOwner: "player",
    instruction: "Reconnect player.",
  }],
  assertion: {
    queryId: "membership-invariant",
    instruction:
      "Verify active player retains valid arena membership.",
  },
  replayTrace: [],
};

function closure(
  disposition:
    PostRepairClosureResult["disposition"],
): PostRepairClosureResult {
  return {
    transactionId: "tx-1",
    disposition,
    release: {
      transactionId: "tx-1",
      disposition:
        disposition === "fixed"
          ? "release-eligible"
          : "blocked",
      reasons: [],
    },
    defectRegression: {
      transactionId: "tx-1",
      scenarioId: scenario.id,
      originalDefectReproduced:
        disposition === "regression",
      evidenceIds: ["runtime:retest"],
    },
    reasons: [],
  };
}

describe("closed repair regression promotion", () => {
  it("promotes a fixed counterexample into a permanent regression case", () => {
    const regression =
      regressionCaseFromClosedRepair({
        closure: closure("fixed"),
        scenario,
        title:
          "Reconnect preserves arena membership",
        domain: "multiplayer",
        discoveredBy: "runtime",
        invariantIds: [
          "membership-invariant",
        ],
        triggerTags: [
          "disconnect",
          "reconnect",
        ],
        capabilityTags: [
          "multiplayer-session",
        ],
        observedDefect:
          "Reconnect returned an active player without arena membership.",
        firstObservedVersion: "1.0.2",
      });

    expect(regression.id).toBe(
      "regression:reconnect-membership:tx-1",
    );
    expect(regression.reproduction).toEqual([
      "1. Join Arena 1.",
      "2. Disconnect player.",
      "3. Reconnect player.",
      "Assert: Verify active player retains valid arena membership.",
    ]);
    expect(regression.domain).toBe(
      "multiplayer",
    );
  });

  it("adds the promoted regression to the existing corpus authority", () => {
    const corpus = new RegressionCorpus();

    const regression =
      addClosedRepairToRegressionCorpus(
        corpus,
        {
          closure: closure("fixed"),
          scenario,
          title:
            "Reconnect preserves arena membership",
          domain: "multiplayer",
          discoveredBy: "runtime",
          invariantIds: [
            "membership-invariant",
          ],
          triggerTags: [
            "reconnect",
          ],
          capabilityTags: [
            "multiplayer-session",
          ],
          observedDefect:
            "Membership was missing after reconnect.",
        },
      );

    expect(corpus.all()).toEqual([
      regression,
    ]);
  });

  it("refuses to promote incomplete repairs into regression history", () => {
    expect(() =>
      regressionCaseFromClosedRepair({
        closure: closure("incomplete"),
        scenario,
        title: "Incomplete repair",
        domain: "multiplayer",
        discoveredBy: "runtime",
        invariantIds: [
          "membership-invariant",
        ],
        triggerTags: [],
        capabilityTags: [],
        observedDefect:
          "Defect description.",
      })
    ).toThrow(/Only a fixed/);
  });

  it("refuses a different scenario than the defect regression receipt", () => {
    expect(() =>
      regressionCaseFromClosedRepair({
        closure: closure("fixed"),
        scenario: {
          ...scenario,
          id: "different-scenario",
        },
        title: "Wrong scenario",
        domain: "multiplayer",
        discoveredBy: "runtime",
        invariantIds: [
          "membership-invariant",
        ],
        triggerTags: [],
        capabilityTags: [],
        observedDefect:
          "Defect description.",
      })
    ).toThrow(/does not match/);
  });
});
