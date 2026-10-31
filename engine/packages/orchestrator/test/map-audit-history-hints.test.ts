import { describe, expect, it } from "vitest";
import {
  historicalSearchHintsForFinding,
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

describe("map audit historical search hints", () => {
  it("raises generic simulation failure hints when selected-artifact facts match", () => {
    const world = worldWithSimulationGap();
    const hints = historicalSearchHintsForFinding(
      finding("progression-wave-objective"),
      world,
    );

    expect(hints.map((item) => item.id)).toContain(
      "history:simulation-resource-realization",
    );
    expect(
      historicalSurfaceSearchPressure(
        "runtime:chunks",
        world,
      ),
    ).toBeGreaterThan(0);
  });

  it("does not inject unrelated inventory history into a pure simulation finding", () => {
    const hints = historicalSearchHintsForFinding(
      finding("progression-wave-objective"),
      worldWithSimulationGap(),
    );

    expect(hints.map((item) => item.id)).not.toContain(
      "history:recovery-authority-collision",
    );
  });
});
