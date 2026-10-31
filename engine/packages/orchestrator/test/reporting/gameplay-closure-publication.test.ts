import { describe, expect, it } from "vitest";
import {
  gameplayClosurePublicationIssues,
  gameplayDiscoveryPublicationIssues,
} from "../../src/reporting/report-defect-collector.js";
import type {
  GameplayModelClosureResult,
} from "../../../gameplay-intent/src/index.js";
import {
  assessGameplayDiscoveryClosure,
  type GameplayDiscoveryClosureStatus,
} from "../../src/inspection/gameplay-discovery-closure.js";

function closure(
  status: GameplayModelClosureResult["status"],
): GameplayModelClosureResult {
  return {
    status,
    surfaces: [],
    unaccountedSurfaceIds:
      status === "OPEN" ? ["surface:missing"] : [],
    blockingSurfaceIds: [],
    unknownSurfaceIds: [],
    stateModelComplete: status !== "OPEN",
    boundariesExtracted: true,
    reasons: [],
  };
}

function discovery(status: GameplayDiscoveryClosureStatus) {
  const parseFailed = status === "OPEN";
  return assessGameplayDiscoveryClosure({
    discoveredSurfaceIds: ["phase:lobby"],
    sourceRelevantFiles: 1,
    sourceIndexedFiles: parseFailed ? 0 : 1,
    sourceCoverageComplete: !parseFailed,
    sourceParseFailures: parseFailed ? 1 : 0,
    unsupportedRelevantSourcePaths: [],
    semanticUnderstandingGapPaths: [],
    unresolvedReferences: status === "PARTIAL" ? 1 : 0,
  });
}

describe("gameplay closure publication gate", () => {
  it("blocks publication while discovery closure is OPEN", () => {
    const issues =
      gameplayDiscoveryPublicationIssues(discovery("OPEN"));

    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toMatch(
      /Discovery Closure is OPEN/i,
    );
  });

  it("allows discovery publication gate for COMPLETE or PARTIAL", () => {
    for (const status of ["COMPLETE", "PARTIAL"] as const) {
      expect(
        gameplayDiscoveryPublicationIssues(discovery(status)),
      ).toEqual([]);
    }
  });

  it("blocks comprehensive publication while closure is OPEN", () => {
    const issues =
      gameplayClosurePublicationIssues(
        closure("OPEN"),
      );

    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toMatch(
      /closure is OPEN/i,
    );
  });

  it("allows publication gate to proceed for CLOSED or PARTIAL closure", () => {
    expect(
      gameplayClosurePublicationIssues(
        closure("CLOSED"),
      ),
    ).toEqual([]);
    expect(
      gameplayClosurePublicationIssues(
        closure("PARTIAL"),
      ),
    ).toEqual([]);
  });
});
