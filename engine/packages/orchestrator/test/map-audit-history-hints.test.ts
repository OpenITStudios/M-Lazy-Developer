import { describe, expect, it } from "vitest";
import {
  historicalSearchHintsForFinding,
  historicalSearchPressure,
  historicalSurfaceSearchPressure,
} from "../src/map-audit-history-hints.js";
import type {
  GameplayWorldModel,
} from "../src/inspection/gameplay-world-model.js";
import type {
  NeedValidationAuditIssueProjection,
} from "../src/map-audit-issue-projection.js";

function finding(
  failureDomain: NeedValidationAuditIssueProjection["failureDomain"],
): NeedValidationAuditIssueProjection {
  return {
    status: "NEED_VALIDATION",
    issueType: "BUG",
    failureDomain,
    contributingDomains: [failureDomain],
    gameplayFlow: "PROGRESSION",
    informationMismatch: false,
    playerFacingEvidenceIds: [],
    causalLinkId: "link:test",
    scenarioId: "scenario:test",
    gameplayStage: "PROGRESSION",
    scenarioLabel: "wave-progression",
    gameplayTrigger: "Run the scenario.",
    gameplayConsequence: "Gameplay may fail.",
    expectedOutcome: "Gameplay dependency should hold.",
    actualOutcome: "Proof remains unresolved.",
    affectedScope: "scope:test",
    subjectIds: ["subject:test"],
    componentIds: [],
    evidenceIds: [],
    validationReason: "Proof incomplete.",
    missingProof: "Missing proof.",
    validationTest: "Run one targeted test.",
    validationGroupKey: "group:test",
  };
}

function worldWithSimulationGap(): GameplayWorldModel {
  return {
    arenas: {
      detected: false,
      isolation: {
        sharedGlobal: 0,
      },
      globalState: {
        unleasedArenaMutations: 0,
      },
      cleanup: {
        resourceLedger: {
          missing: 0,
        },
      },
    },
    entities: {
      definitions: 5,
    },
    chunks: {
      tickingAreaAcquires: 0,
      capacityUncheckedLeases: 0,
      readinessUnverifiedLeases: 0,
      entityRemoveObservers: 1,
    },
    inventory: {
      restoreOwnership: {
        multipleRestoreOwners: 0,
      },
      restoreConflicts: [],
      partialResets: 0,
    },
    persistence: undefined,
    structures: {
      transitionResidueRisks: 0,
      transitionResidueUnresolved: 0,
    },
    combat: {
      deathHandlers: 1,
    },
    spatial: {
      authority: {
        conflicts: 0,
      },
    },
  } as unknown as GameplayWorldModel;
}

describe("map audit clean-slate historical isolation", () => {
  it("does not reintroduce previous-map search hints", () => {
    const hints = historicalSearchHintsForFinding(
      finding("progression-wave-objective"), worldWithSimulationGap(),
    );
    expect(hints).toEqual([]);
    expect(historicalSearchPressure(hints)).toBe(0);
  });

  it("keeps source-evidenced current-map surface prioritization", () => {
    expect(historicalSurfaceSearchPressure(
      "runtime:chunks", worldWithSimulationGap(),
    )).toBeGreaterThan(0);
  });
});
