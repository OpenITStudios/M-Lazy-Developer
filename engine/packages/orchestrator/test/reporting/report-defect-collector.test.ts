import {
  describe,
  expect,
  it,
} from "vitest";
import type {
  IntentDiagnosticGateResult,
} from "../../../diagnostic-reasoning/src/index.js";
import type {
  GameplayIntentModel,
} from "../../../gameplay-intent/src/index.js";
import type {
  GameplayIntentRuntimeAssessment,
} from "../../src/gameplay-intent-runtime-stage.js";
import {
  applyProposedBugReview,
  groupConfirmedDefects,
} from "../../../bug-report/src/index.js";
import {
  buildBugReportFromAuditCandidatesCompatibility as buildBugReportFromAuditCandidates,
  collectConfirmedDefects,
  describeAuditReportCandidate,
  prepareBugReportReviewFromAuditCandidatesCompatibility as prepareBugReportReviewFromAuditCandidates,
  type BuildBugReportFromAuditInput,
  type AiConfirmedDefectDraft,
  type ConfirmedDefectDraft,
} from "../../src/reporting/report-defect-collector.js";

const intent: GameplayIntentModel = {
  schemaVersion: 1,
  id: "intent",
  evidence: [{
    id: "intent:evidence",
    origin: "source-code",
    locator: "scripts/session.ts",
    summary: "Authored cleanup contract.",
  }],
  nodes: [{
    id: "outcome:cleanup",
    kind: "outcome",
    label: "Cleanup",
    status: "authored",
    evidenceIds: ["intent:evidence"],
  }],
  edges: [],
  invariants: [{
    id: "inv:cleanup",
    statement: "Cleanup must reset match state.",
    strength: "must",
    status: "authored",
    subjectIds: ["outcome:cleanup"],
    evidenceIds: ["intent:evidence"],
  }],
  unknowns: [],
};

const runtimeAssessment: GameplayIntentRuntimeAssessment = {
  outcomeObservation: {
    outcomeId: "outcome:cleanup",
    evidenceId: "runtime:cleanup",
  },
  result: {
    disposition: "confirmed-defect",
    subjectIds: ["outcome:cleanup"],
    basisInvariantIds: ["inv:cleanup"],
    evidenceIds: ["runtime:cleanup"],
    nextEvidenceNeed: "none",
    reasons: ["Runtime state contradicts authored cleanup intent."],
  },
  observationNeeds: [],
};

const staticResult: IntentDiagnosticGateResult = {
  disposition: "confirmed-defect",
  subjectIds: ["outcome:cleanup"],
  basisInvariantIds: ["inv:cleanup"],
  evidenceIds: ["static:cleanup"],
  nextEvidenceNeed: "none",
  reasons: ["Static implementation contradicts authored cleanup intent."],
};

type DefectOptions = {
  ai?: boolean;
  impactEvidenceIds?: readonly string[];
  primaryEvidenceIds?: readonly string[];
};

function defect(label: string, options: DefectOptions & { reproduction: readonly string[] }): ConfirmedDefectDraft;
function defect(label: string, options?: DefectOptions & { reproduction?: never }): AiConfirmedDefectDraft;
function defect(
  label: string,
  options: {
    ai?: boolean;
    reproduction?: readonly string[];
    impactEvidenceIds?: readonly string[];
    primaryEvidenceIds?: readonly string[];
  } = {},
): ConfirmedDefectDraft | AiConfirmedDefectDraft {
  return {
    title: "Cleanup retains match state",
    problem: "Match-owned state remains after cleanup.",
    expectedStatement:
      "Match-owned state is reset.",
    observedStatement:
      "Previous match state remains active.",
    classificationSignals: {
      impact: [{
        kind: "important-state-wrong" as const,
        evidenceIds:
          options.impactEvidenceIds ??
          ["static:cleanup"],
      }],
      primaryFailure: [{
        failure: "player-owned-state" as const,
        evidenceIds:
          options.primaryEvidenceIds ??
          ["intent:evidence"],
      }],
    },
    ...(options.reproduction === undefined
      ? {}
      : { reproduction: options.reproduction }),
    ...(options.ai
      ? {
          aiAnalysis: "Cleanup does not clear the owned state.",
          sourceEvidence: [{
            source: {
              artifactId: "map",
              relativePath: "scripts/session.ts",
              range: {
                lineStart: 10,
                lineEnd: 12,
              },
            },
            reason: "Owns match cleanup.",
          }],
        }
      : {}),
    brokenInvariantIds: ["inv:cleanup"],
  };
}

function buildApprovedReport(
  input: Omit<BuildBugReportFromAuditInput, "approved">,
) {
  const prepared =
    prepareBugReportReviewFromAuditCandidates({
      map: input.map,
      files: input.files,
      candidates: input.candidates,
      ...(input.groupResolutions === undefined
        ? {}
        : { groupResolutions: input.groupResolutions }),
    });

  const reviewed = applyProposedBugReview(
    prepared.proposed,
    prepared.proposed.items.map((item) => ({
      semanticKey: item.semanticKey,
      decision: "approve" as const,
    })),
  );
  if (!reviewed.ok) {
    throw new Error(reviewed.issues.join("; "));
  }

  return buildBugReportFromAuditCandidates({
    ...input,
    approved: reviewed.approved,
  });
}

describe("report defect collector", () => {
  it("collects canonical defects from all three evidence routes", () => {
    const result = collectConfirmedDefects([
      {
        route: "runtime",
        intent,
        assessment: runtimeAssessment,
        defect: defect("runtime-cleanup", {
          ai: true,
          impactEvidenceIds: ["runtime:cleanup"],
        }),
      },
      {
        route: "static",
        intent,
        result: staticResult,
        defect: defect("static-cleanup", { ai: true }),
      },
      {
        route: "tester",
        subjectIds: ["outcome:cleanup"],
        confirmation: {
          expectedBehaviorAuthority: "explicit-requirement",
          expectedStatement: "Match-owned state is reset.",
          expectedEvidenceIds: ["requirement:cleanup"],
          observationEvidenceIds: ["tester:observation"],
          reproduced: true,
          evidence: "State persists after two repeated match completions.",
        },
        defect: defect("tester-cleanup", {
          impactEvidenceIds: ["tester:observation"],
          primaryEvidenceIds: ["requirement:cleanup"],
          reproduction: [
            "Complete a match normally.",
            "Return to the lobby.",
            "Start another match.",
            "Confirm the previous match state remains active.",
          ],
        }),
      },
    ]);

    expect(result.confirmed).toHaveLength(3);
    expect(result.rejected).toHaveLength(0);
    expect(
      result.confirmed.map((item) => item.foundBy),
    ).toEqual(["ai", "ai", "tester"]);
  });

  it("ignores caller-supplied AI broken invariant identity", () => {
    const attempted = {
      ...defect("attempted-identity", { ai: true }),
      brokenInvariantIds: ["inv:caller-controlled"],
    };

    const result = collectConfirmedDefects([{
      route: "static",
      intent,
      result: staticResult,
      defect: attempted,
    }]);

    expect(result.confirmed).toHaveLength(1);
    expect(result.confirmed[0]?.brokenInvariantIds)
      .toEqual(["inv:cleanup"]);
    expect(result.confirmed[0]?.semanticKey)
      .toContain("invariants=inv:cleanup");
    expect(result.confirmed[0]?.semanticKey)
      .not.toContain("caller-controlled");
  });

  it("keeps confirmed AI defects internal until Bug Trigger is available", () => {
    const candidate = {
      route: "static" as const,
      intent,
      result: staticResult,
      defect: defect("ai-without-trigger", { ai: true }),
    };

    const collected =
      collectConfirmedDefects([candidate]);

    expect(collected.confirmed).toHaveLength(1);
    expect(
      describeAuditReportCandidate(candidate)
        .nextEvidenceNeed,
    ).toBe("tester-reproduction");

    const report =
      buildApprovedReport({
        map: {
          name: "Beach Bedwars",
          drive: "https://drive.google.com/file/d/1FAKE_TEST_ONLY_WORLD/view",
          mapVersion: "1.0.4",
          baseVersion: "1.26.20",
          testedVersion: "1.26.32",
        },
        repairBy: "developer",
        files: [{
          relativePath: "scripts/session.ts",
          size: 1,
        }],
        candidates: [candidate],
      });

    expect(report.promotion.ok).toBe(false);
    if (report.promotion.ok) return;
    expect(
      report.promotion.issues.map(
        (issue) => issue.code,
      ),
    ).toContain("missing-reproduction");
  });

  it("requires expected and observed defect evidence for AI Test In-Game", () => {
    const common = {
      route: "static" as const,
      intent,
      result: staticResult,
      defect: defect("source-bound-trigger", { ai: true }),
    };
    const trigger = {
      gameplayBasis: "authored-gameplay" as const,
      startingCondition: "Finish the match and return to the lobby",
      actions: ["Start the same arena again"],
      observableFailure: "the next match does not start",
      evidenceIds: ["intent:evidence"],
      stepEvidence: {
        startingCondition: ["intent:evidence"],
        actions: [["intent:evidence"]],
        observableFailure: ["intent:evidence"],
      },
    };
    const expectationOnly = { ...common, bugTrigger: trigger };
    expect(describeAuditReportCandidate(expectationOnly).nextEvidenceNeed)
      .toBe("candidate-correction");
    const rejected = collectConfirmedDefects([expectationOnly]);
    expect(rejected.confirmed).toHaveLength(0);
    expect(rejected.rejected[0]?.reasons.join(" "))
      .toMatch(/observable failure lacks matching observed-defect evidence/);

    const complete = {
      ...common,
      bugTrigger: { ...trigger,
        evidenceIds: ["intent:evidence", "static:cleanup"],
        stepEvidence: { ...trigger.stepEvidence,
          observableFailure: ["static:cleanup"],
        },
      },
    };
    expect(describeAuditReportCandidate(complete).nextEvidenceNeed).toBe("none");
    expect(collectConfirmedDefects([complete]).confirmed).toHaveLength(1);

    const technical = {
      ...common,
      bugTrigger: {
        ...trigger,
        actions: ["Inspect the session function"],
        evidenceIds: ["intent:evidence", "static:cleanup"],
        stepEvidence: { ...trigger.stepEvidence,
          observableFailure: ["static:cleanup"],
        },
      },
    };
    expect(describeAuditReportCandidate(technical).nextEvidenceNeed)
      .toBe("candidate-correction");
    expect(collectConfirmedDefects([technical]).confirmed).toHaveLength(0);
  });

  it("rejects aggregate evidence when an individual Test In-Game step cites the wrong authority", () => {
    const base = {
      route: "static" as const,
      intent,
      result: staticResult,
      defect: defect("per-step-mismatch", { ai: true }),
      bugTrigger: {
        gameplayBasis: "authored-gameplay" as const,
        startingCondition: "Finish the match and return to the lobby",
        actions: ["Start the same arena again"],
        observableFailure: "the new match does not start",
        evidenceIds: ["intent:evidence", "static:cleanup"],
        stepEvidence: {
          startingCondition: ["intent:evidence"],
          actions: [["intent:evidence"]],
          observableFailure: ["static:cleanup"],
        },
      },
    };
    expect(collectConfirmedDefects([base]).confirmed).toHaveLength(1);

    const wrongSetup = { ...base,
      bugTrigger: { ...base.bugTrigger, stepEvidence: {
        ...base.bugTrigger.stepEvidence,
        startingCondition: ["static:cleanup"],
      } },
    };
    expect(describeAuditReportCandidate(wrongSetup).nextEvidenceNeed)
      .toBe("candidate-correction");
    expect(collectConfirmedDefects([wrongSetup]).rejected[0]?.reasons.join(" "))
      .toMatch(/starting condition lacks matching gameplay-basis evidence/);

    const wrongAction = { ...base,
      bugTrigger: { ...base.bugTrigger, stepEvidence: {
        ...base.bugTrigger.stepEvidence,
        actions: [["static:cleanup"]],
      } },
    };
    expect(collectConfirmedDefects([wrongAction]).rejected[0]?.reasons.join(" "))
      .toMatch(/player action lacks matching gameplay-basis evidence/);

    const wrongFailure = { ...base,
      bugTrigger: { ...base.bugTrigger, stepEvidence: {
        ...base.bugTrigger.stepEvidence,
        observableFailure: ["intent:evidence"],
      } },
    };
    expect(collectConfirmedDefects([wrongFailure]).rejected[0]?.reasons.join(" "))
      .toMatch(/observable failure step lacks matching observed-defect evidence/);
  });

  it("keeps tester reproduction open when the observed defect has no usable steps", () => {
    const candidate = {
      route: "tester" as const,
      subjectIds: ["outcome:cleanup"],
      confirmation: {
        expectedBehaviorAuthority: "explicit-requirement" as const,
        expectedStatement: "Match-owned state is reset.",
        expectedEvidenceIds: ["requirement:cleanup"],
        observationEvidenceIds: ["tester:cleanup"],
        reproduced: true,
        evidence: "Tester confirmed stale state after cleanup.",
      },
      defect: defect("tester-empty-instructions", {
        reproduction: [],
        primaryEvidenceIds: ["requirement:cleanup"],
        impactEvidenceIds: ["tester:cleanup"],
      }),
    };
    expect(describeAuditReportCandidate(candidate).nextEvidenceNeed)
      .toBe("tester-reproduction");
  });

  it("compiles an evidence-bound AI Bug Trigger into the final report", () => {
    const result =
      buildApprovedReport({
        map: {
          name: "Beach Bedwars",
          drive: "https://drive.google.com/file/d/1FAKE_TEST_ONLY_WORLD/view",
          mapVersion: "1.0.4",
          baseVersion: "1.26.20",
          testedVersion: "1.26.32",
        },
        repairBy: "developer",
        files: [{
          relativePath: "scripts/session.ts",
          size: 1,
        }],
        candidates: [{
          route: "static",
          intent,
          result: staticResult,
          bugTrigger: {
            gameplayBasis: "authored-gameplay",
            startingCondition:
              "Finish a match and return to the lobby",
            actions: [
              "Start the same arena again",
            ],
            observableFailure:
              "the new match does not start",
            evidenceIds: [
              "intent:evidence",
              "static:cleanup",
            ],
            stepEvidence: {
              startingCondition: ["intent:evidence"],
              actions: [["intent:evidence"]],
              observableFailure: ["static:cleanup"],
            },
          },
          defect: defect("ai-ready", { ai: true }),
        }],
      });

    expect(result.promotion.ok).toBe(true);
    if (!result.promotion.ok) return;
    expect(
      result.promotion.report.bugs[0]?.reproduction,
    ).toEqual([
      "Finish a match and return to the lobby.",
      "Start the same arena again.",
      "Confirm: the new match does not start.",
    ]);
  });

  it("rejects AI Bug Trigger evidence from another defect", () => {
    const result = collectConfirmedDefects([{
      route: "static",
      intent,
      result: staticResult,
      bugTrigger: {
        gameplayBasis: "authored-gameplay",
        startingCondition: "Finish a match",
        observableFailure:
          "the next match does not start",
        evidenceIds: ["runtime:unrelated"],
        stepEvidence: {
          startingCondition: ["runtime:unrelated"],
          actions: [],
          observableFailure: ["runtime:unrelated"],
        },
      },
      defect: defect("ai-unrelated-trigger", {
        ai: true,
      }),
    }]);

    expect(result.confirmed).toHaveLength(0);
    expect(result.rejected[0]).toEqual(
      expect.objectContaining({
        nextEvidenceNeed: "candidate-correction",
      }),
    );
    expect(
      result.rejected[0]?.reasons.join(" "),
    ).toMatch(/Bug Trigger evidence/);
  });

  it("rejects static AI triggers that claim runtime gameplay basis", () => {
    const result = collectConfirmedDefects([{
      route: "static",
      intent,
      result: staticResult,
      bugTrigger: {
        gameplayBasis: "runtime-gameplay",
        startingCondition: "Finish a match.",
        observableFailure:
          "the next match does not start",
        evidenceIds: ["static:cleanup"],
        stepEvidence: {
          startingCondition: ["static:cleanup"],
          actions: [],
          observableFailure: ["static:cleanup"],
        },
      },
      defect: defect("invalid-trigger-basis", {
        ai: true,
      }),
    }]);

    expect(result.confirmed).toHaveLength(0);
    expect(
      result.rejected[0]?.reasons.join(" "),
    ).toMatch(/authored gameplay intent/);
  });

  it("rejects authored gameplay triggers without authored gameplay evidence", () => {
    const result = collectConfirmedDefects([{
      route: "static",
      intent,
      result: staticResult,
      bugTrigger: {
        gameplayBasis: "authored-gameplay",
        startingCondition: "Finish a match.",
        observableFailure:
          "the next match does not start",
        evidenceIds: ["static:cleanup"],
        stepEvidence: {
          startingCondition: ["static:cleanup"],
          actions: [],
          observableFailure: ["static:cleanup"],
        },
      },
      defect: defect("unsupported-gameplay-basis", {
        ai: true,
      }),
    }]);

    expect(result.confirmed).toHaveLength(0);
    expect(
      result.rejected[0]?.reasons.join(" "),
    ).toMatch(/matching gameplay evidence/);
  });

  it("derives severity category and ids during final projection", () => {
    const result = buildApprovedReport({
      map: {
        name: "Beach Bedwars",
        drive: "https://drive.google.com/file/d/1FAKE_TEST_ONLY_WORLD/view",
        mapVersion: "1.0.4",
        baseVersion: "1.26.20",
        testedVersion: "1.26.32",
      },
      repairBy: "developer",
      files: [{
        relativePath: "scripts/session.ts",
        size: 1,
      }],
      candidates: [{
        route: "tester",
        subjectIds: ["outcome:cleanup"],
        confirmation: {
          expectedBehaviorAuthority: "explicit-requirement",
          expectedStatement: "Match-owned state is reset.",
          expectedEvidenceIds: ["requirement:cleanup"],
          observationEvidenceIds: ["tester:observation"],
          reproduced: true,
          evidence: "State persists after repeated completion.",
        },
        defect: defect("cleanup", {
          impactEvidenceIds: ["tester:observation"],
          primaryEvidenceIds: ["requirement:cleanup"],
          reproduction: [
            "Complete a match.",
            "Observe retained state.",
          ],
        }),
      }],
    });

    expect(result.promotion.ok).toBe(true);
    if (!result.promotion.ok) return;
    expect(result.promotion.report.bugs[0]).toEqual(
      expect.objectContaining({
        id: expect.stringMatching(/^BUG-BB-[A-Z0-9]+$/),
        severity: "major",
        category: "player-state",
        foundBy: "tester",
      }),
    );
  });

  it("keeps non-confirmed candidates out of the final report", () => {
    const result = buildApprovedReport({
      map: {
        name: "Map",
        drive: "https://drive.google.com/file/d/1FAKE_TEST_ONLY_WORLD/view",
        mapVersion: "1.0.0",
        baseVersion: "1.26.20",
        testedVersion: "1.26.32",
      },
      repairBy: "developer",
      files: [{
        relativePath: "scripts/session.ts",
        size: 1,
      }],
      candidates: [
        {
          route: "runtime",
          intent,
          assessment: {
            ...runtimeAssessment,
            result: {
              ...runtimeAssessment.result,
              disposition: "ambiguous-intent",
              basisInvariantIds: [],
              nextEvidenceNeed: "contract-evidence",
            },
          },
          defect: defect("rejected", {
            ai: true,
            impactEvidenceIds: ["runtime:cleanup"],
          }),
        },
        {
          route: "tester",
          subjectIds: ["outcome:cleanup"],
          confirmation: {
            expectedBehaviorAuthority: "explicit-requirement",
            expectedStatement: "Match-owned state is reset.",
            expectedEvidenceIds: ["requirement:cleanup"],
            observationEvidenceIds: ["tester:observation"],
            reproduced: true,
            evidence: "The state persists after repeated completion.",
          },
          defect: defect("accepted", {
            impactEvidenceIds: ["tester:observation"],
            primaryEvidenceIds: ["requirement:cleanup"],
            reproduction: [
              "Complete a match.",
              "Observe retained state.",
            ],
          }),
        },
      ],
    });

    expect(result.collection.confirmed).toHaveLength(1);
    expect(result.collection.rejected).toEqual([
      expect.objectContaining({
        route: "runtime",
        semanticKey: expect.stringContaining(
          "subjects=outcome:cleanup",
        ),
      }),
    ]);
    expect(result.promotion.ok).toBe(true);
    if (!result.promotion.ok) return;
    expect(result.promotion.report.bugs).toHaveLength(1);
  });

  it("exposes targeted next evidence for rejected candidates", () => {
    const result = collectConfirmedDefects([
      {
        route: "runtime",
        intent,
        assessment: {
          ...runtimeAssessment,
          result: {
            ...runtimeAssessment.result,
            disposition: "ambiguous-intent",
            basisInvariantIds: [],
            nextEvidenceNeed: "contract-evidence",
          },
        },
        defect: defect("needs-authored-intent", {
          ai: true,
          impactEvidenceIds: ["runtime:cleanup"],
        }),
      },
      {
        route: "tester",
        subjectIds: ["outcome:cleanup"],
        confirmation: {
          expectedBehaviorAuthority: "explicit-requirement",
          expectedStatement: "Match-owned state is reset.",
          expectedEvidenceIds: ["requirement:cleanup"],
          observationEvidenceIds: ["tester:observation"],
          reproduced: false,
          evidence: "Observed once.",
        },
        defect: defect("needs-reproduction", {
          impactEvidenceIds: ["tester:observation"],
          primaryEvidenceIds: ["requirement:cleanup"],
          reproduction: ["Attempt reproduction."],
        }),
      },
    ]);

    expect(result.rejected).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          route: "runtime",
          semanticKey: expect.stringContaining(
            "subjects=outcome:cleanup",
          ),
          nextEvidenceNeed: "contract-evidence",
          evidenceIds: expect.arrayContaining([
            "runtime:cleanup",
          ]),
        }),
        expect.objectContaining({
          route: "tester",
          semanticKey: expect.stringContaining(
            "subjects=outcome:cleanup",
          ),
          nextEvidenceNeed: "tester-reproduction",
          evidenceIds: expect.arrayContaining([
            "requirement:cleanup",
          ]),
        }),
      ]),
    );
  });

  it("derives classification from runtime experiment evidence bound to the same confirmation", () => {
    const base = defect("runtime-experiment", { ai: true });
    const runtimeEvidenceId =
      "runtime:stale-session-mutation-observed";
    const result = collectConfirmedDefects([{
      route: "runtime",
      intent,
      assessment: {
        ...runtimeAssessment,
        result: {
          ...runtimeAssessment.result,
          evidenceIds: [
            "runtime:cleanup",
            runtimeEvidenceId,
          ],
        },
      },
      runtimeExperimentClassification: {
        definition: {
          schemaVersion: 1,
          id: "exp:session",
          title: "Session",
          domain: "multiplayer",
          requiredContext: "LIVE_MINECRAFT",
          mutationRisk: "read-only",
          targetProfileFingerprint: "target",
          fixtureFingerprint: "fixture",
          protocol: [],
          factors: [],
          arms: [],
          outcomePredicateIds: [
            "stale-session-mutation-observed",
          ],
          minimumRunsPerArm: 1,
        },
        bridge: {
          experimentId: "exp:session",
          qualificationState: "repeatable",
          predicates: [{
            predicate:
              "stale-session-mutation-observed",
            observation: {
              predicate:
                "stale-session-mutation-observed",
              state: "present",
              evidenceId: "bridge:stale-session",
            },
            ceiling: "repeatable",
            sourceEvidenceIds: [
              runtimeEvidenceId,
            ],
          }],
          observations: [],
        },
      },
      defect: {
        ...base,
        classificationSignals: {
          impact: [],
          primaryFailure: [],
        },
      },
    }]);

    expect(result.confirmed).toHaveLength(1);
    expect(result.confirmed[0]?.primaryFailure)
      .toBe("session-concurrency");
    expect(result.confirmed[0]?.impact.importantState)
      .toBe("materially-wrong");
  });

  it("rejects runtime classification evidence unrelated to confirmation", () => {
    const base = defect("runtime-unrelated", { ai: true });
    const result = collectConfirmedDefects([{
      route: "runtime",
      intent,
      assessment: runtimeAssessment,
      runtimeExperimentClassification: {
        definition: {
          schemaVersion: 1,
          id: "exp:other",
          title: "Other",
          domain: "multiplayer",
          requiredContext: "LIVE_MINECRAFT",
          mutationRisk: "read-only",
          targetProfileFingerprint: "target",
          fixtureFingerprint: "fixture",
          protocol: [],
          factors: [],
          arms: [],
          outcomePredicateIds: [
            "stale-session-mutation-observed",
          ],
          minimumRunsPerArm: 1,
        },
        bridge: {
          experimentId: "exp:other",
          qualificationState: "repeatable",
          predicates: [{
            predicate:
              "stale-session-mutation-observed",
            observation: {
              predicate:
                "stale-session-mutation-observed",
              state: "present",
              evidenceId: "bridge:other",
            },
            ceiling: "repeatable",
            sourceEvidenceIds: [
              "runtime:other-experiment",
            ],
          }],
          observations: [],
        },
      },
      defect: {
        ...base,
        classificationSignals: {
          impact: [],
          primaryFailure: [],
        },
      },
    }]);

    expect(result.confirmed).toHaveLength(0);
    expect(result.rejected[0]?.reasons.join(" "))
      .toMatch(/not part of the confirmation evidence/);
  });

  it("derives primary failure from an unambiguous diagnostic family", () => {
    const base = defect("diagnostic-classification", {
      ai: true,
    });
    const result = collectConfirmedDefects([{
      route: "static",
      intent,
      result: staticResult,
      classificationDiagnostics: [{
        id: "diag:entity",
        code: "ENTITY_TRIGGER_EVENT_UNDEFINED",
        severity: "medium",
        message: "Undefined entity event.",
      }],
      defect: {
        ...base,
        classificationSignals: {
          ...base.classificationSignals,
          primaryFailure: [],
        },
      },
    }]);

    expect(result.confirmed).toHaveLength(1);
    expect(result.confirmed[0]?.primaryFailure)
      .toBe("entity-decision");
  });

  it("rejects conflicting explicit and diagnostic primary failure signals", () => {
    const result = collectConfirmedDefects([{
      route: "static",
      intent,
      result: staticResult,
      classificationDiagnostics: [{
        id: "diag:entity",
        code: "ENTITY_TRIGGER_EVENT_UNDEFINED",
        severity: "medium",
        message: "Undefined entity event.",
      }],
      defect: defect("classification-conflict", {
        ai: true,
      }),
    }]);

    expect(result.confirmed).toHaveLength(0);
    expect(result.rejected[0]?.reasons.join(" "))
      .toMatch(/ambiguous/);
  });

  it("rejects classification evidence outside the defect evidence universe", () => {
    const result = collectConfirmedDefects([{
      route: "static",
      intent,
      result: staticResult,
      defect: {
        ...defect("bad-classification", { ai: true }),
        classificationSignals: {
          impact: [{
            kind: "important-state-wrong",
            evidenceIds: ["unrelated:impact"],
          }],
          primaryFailure: [{
            failure: "player-owned-state",
            evidenceIds: ["intent:evidence"],
          }],
        },
      },
    }]);

    expect(result.confirmed).toHaveLength(0);
    expect(result.rejected[0]?.reasons.join(" "))
      .toMatch(/Classification evidence/);
  });

  it("derives AI Expected and Observed provenance from the confirmation route", () => {
    const result = collectConfirmedDefects([{
      route: "static",
      intent,
      result: staticResult,
      defect: defect("route-provenance", { ai: true }),
    }]);

    expect(result.confirmed).toHaveLength(1);
    expect(result.confirmed[0]?.expected).toEqual({
      authority: "selected-artifact",
      statement: "Match-owned state is reset.",
      evidenceIds: ["intent:evidence"],
    });
    expect(result.confirmed[0]?.observed.evidenceIds)
      .toEqual(["static:cleanup"]);
  });

  it("derives tester Expected and Observed provenance from confirmation input", () => {
    const result = collectConfirmedDefects([{
      route: "tester",
      subjectIds: ["outcome:cleanup"],
      confirmation: {
        expectedBehaviorAuthority: "explicit-requirement",
        expectedStatement: "Match-owned state is reset.",
        expectedEvidenceIds: ["requirement:cleanup"],
        observationEvidenceIds: ["tester:cleanup"],
        reproduced: true,
        evidence: "The state persists after repeated completion.",
      },
      defect: defect("tester-route-provenance", {
        impactEvidenceIds: ["tester:cleanup"],
        primaryEvidenceIds: ["requirement:cleanup"],
        reproduction: [
          "Complete a match and return to the lobby.",
          "Start the next match.",
          "Confirm the previous match state remains active.",
        ],
      }),
    }]);

    expect(result.confirmed).toHaveLength(1);
    expect(result.confirmed[0]?.expected).toEqual({
      authority: "explicit-requirement",
      statement: "Match-owned state is reset.",
      evidenceIds: ["requirement:cleanup"],
    });
    expect(result.confirmed[0]?.observed.evidenceIds)
      .toEqual(["tester:cleanup"]);
  });

  it("blocks promotion when AI source evidence is not in the audited inventory", () => {
    const result = buildApprovedReport({
      map: {
        name: "Map",
        drive: "https://drive.google.com/file/d/1FAKE_TEST_ONLY_WORLD/view",
        mapVersion: "1.0.0",
        baseVersion: "1.26.20",
        testedVersion: "1.26.20",
      },
      repairBy: "developer",
      files: [],
      candidates: [{
        route: "static",
        intent,
        result: staticResult,
        defect: defect("missing-source", { ai: true }),
      }],
    });

    expect(result.promotion.ok).toBe(false);
    if (result.promotion.ok) return;
    expect(
      result.promotion.issues.map((issue) => issue.code),
    ).toContain("invalid-confirmed-defect");
  });

  it("auto-binds a unique Semantic IR execution owner", () => {
    const semanticIr = {
      schemaVersion: 1 as const,
      execution: {
        regions: [{
          id: "exec:cleanup",
          kind: "script-function" as const,
          ownerId: "scripts/session",
          label: "function:cleanup",
          source: {
            artifactId: "map",
            relativePath: "scripts/session.ts",
            range: {
              lineStart: 1,
              lineEnd: 30,
            },
          },
        }],
        edges: [],
      },
      state: {
        surfaces: [],
        operations: [],
        authorityBindings: [],
      },
      temporal: {
        relations: [],
      },
    };

    const result = collectConfirmedDefects([{
      route: "static",
      intent,
      result: staticResult,
      semanticIr,
      defect: defect("auto-owner", { ai: true }),
    }]);

    expect(result.confirmed).toHaveLength(1);
    expect(result.confirmed[0]?.sourceEvidence?.[0]?.semanticOwnerId)
      .toBe("exec:cleanup");
    expect(result.confirmed[0]?.repairUnitIds).toEqual([
      "execution-region:exec:cleanup",
    ]);
  });

  it("accepts a source semantic owner proven by Semantic IR", () => {
    const semanticIr = {
      schemaVersion: 1 as const,
      execution: {
        regions: [{
          id: "exec:cleanup",
          kind: "script-function" as const,
          ownerId: "scripts/session",
          label: "function:cleanup",
          source: {
            artifactId: "map",
            relativePath: "scripts/session.ts",
            range: {
              lineStart: 10,
              lineEnd: 12,
            },
          },
        }],
        edges: [],
      },
      state: {
        surfaces: [],
        operations: [],
        authorityBindings: [],
      },
      temporal: {
        relations: [],
      },
    };

    const result = collectConfirmedDefects([{
      route: "static",
      intent,
      result: staticResult,
      semanticIr,
      defect: {
        ...defect("semantic-owner", { ai: true }),
        sourceEvidence: [{
          source: {
            artifactId: "map",
            relativePath: "scripts/session.ts",
            range: {
              lineStart: 10,
              lineEnd: 12,
            },
          },
          semanticOwnerId: "exec:cleanup",
          reason: "Owns cleanup.",
        }],
      },
    }]);

    expect(result.confirmed).toHaveLength(1);
    expect(result.confirmed[0]?.repairUnitIds).toEqual([
      "execution-region:exec:cleanup",
    ]);
  });

  it("rejects an unproven source semantic owner", () => {
    const result = collectConfirmedDefects([{
      route: "static",
      intent,
      result: staticResult,
      semanticIr: {
        schemaVersion: 1,
        execution: {
          regions: [],
          edges: [],
        },
        state: {
          surfaces: [],
          operations: [],
          authorityBindings: [],
        },
        temporal: {
          relations: [],
        },
      },
      defect: {
        ...defect("bad-owner", { ai: true }),
        sourceEvidence: [{
          source: {
            artifactId: "map",
            relativePath: "scripts/session.ts",
            range: {
              lineStart: 10,
              lineEnd: 12,
            },
          },
          semanticOwnerId: "exec:missing",
          reason: "Claimed owner.",
        }],
      },
    }]);

    expect(result.confirmed).toHaveLength(0);
    expect(result.rejected[0]?.reasons.join(" "))
      .toMatch(/not present in Semantic IR/);
  });

  it("rejects Suggested Fix without a repair decision", () => {
    const result = collectConfirmedDefects([{
      route: "static",
      intent,
      result: staticResult,
      defect: {
        ...defect("repair-advice", { ai: true }),
        suggestedFix: "Rewrite cleanup ownership.",
      },
    }]);

    expect(result.confirmed).toHaveLength(0);
    expect(result.rejected[0]).toEqual(
      expect.objectContaining({
        semanticKey: expect.stringContaining(
          "subjects=outcome:cleanup",
        ),
        reasons: [
          "Suggested Fix requires a diagnostic repair decision.",
        ],
        nextEvidenceNeed: "repair-decision",
      }),
    );
  });

  it("resolves multi-symptom groups through the high-level audit entry point", () => {
    const first = {
      route: "tester" as const,
      subjectIds: ["subject:a"],
      confirmation: {
        expectedBehaviorAuthority: "explicit-requirement" as const,
        expectedStatement: "Match-owned state is reset.",
        expectedEvidenceIds: ["requirement:cleanup"],
        observationEvidenceIds: ["tester:observation"],
        reproduced: true,
        evidence: "Symptom A is reproducible.",
      },
      defect: {
        ...defect("a", {
          ai: true,
          impactEvidenceIds: ["tester:observation"],
          primaryEvidenceIds: ["requirement:cleanup"],
          reproduction: [
            "Enter the gameplay state for symptom A.",
            "Confirm symptom A remains visible after the expected cleanup.",
          ],
        }),
        causalIncidentId: "incident:cleanup",
      },
    };
    const second = {
      route: "tester" as const,
      subjectIds: ["subject:b"],
      confirmation: {
        expectedBehaviorAuthority: "explicit-requirement" as const,
        expectedStatement: "Match-owned state is reset.",
        expectedEvidenceIds: ["requirement:cleanup"],
        observationEvidenceIds: ["tester:observation"],
        reproduced: true,
        evidence: "Symptom B is reproducible.",
      },
      defect: {
        ...defect("b", {
          ai: true,
          impactEvidenceIds: ["tester:observation"],
          primaryEvidenceIds: ["requirement:cleanup"],
          reproduction: [
            "Enter the gameplay state for symptom B.",
            "Confirm symptom B remains visible after the expected cleanup.",
          ],
        }),
        causalIncidentId: "incident:cleanup",
      },
    };

    const preview = collectConfirmedDefects([
      first,
      second,
    ]);
    const groupKey = groupConfirmedDefects(
      preview.confirmed,
    )[0]!.key;

    const result = buildApprovedReport({
      map: {
        name: "Beach Bedwars",
        drive: "https://drive.google.com/file/d/1FAKE_TEST_ONLY_WORLD/view",
        mapVersion: "1.0.4",
        baseVersion: "1.26.20",
        testedVersion: "1.26.20",
      },
      repairBy: "developer",
      files: [{
        relativePath: "scripts/session.ts",
        size: 1,
      }],
      candidates: [first, second],
      groupResolutions: [{
        groupKey,
        narrative: {
          title: "Cleanup retains match state",
          problem: "Multiple state symptoms share one cleanup defect.",
          expected: {
            statement: "Cleanup resets all match-owned state.",
          },
          observed: {
            statement: "Multiple state surfaces remain active.",
          },
          expectedAuthority: "explicit-requirement",
          foundBy: "tester",
          primaryFailure: "player-owned-state",
          reproduction: [
            "Complete a match.",
            "Return to lobby.",
            "Observe retained state.",
          ],
        },
      }],
    });

    expect(result.promotion.ok).toBe(true);
    if (!result.promotion.ok) return;
    expect(result.promotion.report.bugs).toHaveLength(1);
  });

  it("allocates the same ids regardless of candidate order", () => {
    const makeCandidates = (reversed: boolean) => {
      const entries = [
        {
          route: "tester" as const,
          subjectIds: ["outcome:a"],
          confirmation: {
            expectedBehaviorAuthority: "explicit-requirement" as const,
            expectedStatement: "Match-owned state is reset.",
            expectedEvidenceIds: ["requirement:cleanup"],
            observationEvidenceIds: ["tester:observation"],
            reproduced: true,
            evidence: "A",
          },
          defect: defect("a", {
            impactEvidenceIds: ["tester:observation"],
            primaryEvidenceIds: ["requirement:cleanup"],
            reproduction: ["Enter outcome A.", "Confirm outcome A remains incorrect."],
          }),
        },
        {
          route: "tester" as const,
          subjectIds: ["outcome:b"],
          confirmation: {
            expectedBehaviorAuthority: "explicit-requirement" as const,
            expectedStatement: "Match-owned state is reset.",
            expectedEvidenceIds: ["requirement:cleanup"],
            observationEvidenceIds: ["tester:observation"],
            reproduced: true,
            evidence: "B",
          },
          defect: defect("b", {
            impactEvidenceIds: ["tester:observation"],
            primaryEvidenceIds: ["requirement:cleanup"],
            reproduction: ["Enter outcome B.", "Confirm outcome B remains incorrect."],
          }),
        },
      ];
      return reversed ? [...entries].reverse() : entries;
    };

    const input = {
      map: {
        name: "Beach Bedwars",
        drive: "https://drive.google.com/file/d/1FAKE_TEST_ONLY_WORLD/view",
        mapVersion: "1.0.4",
        baseVersion: "1.26.20",
        testedVersion: "1.26.20",
      },
      repairBy: "developer" as const,
      files: [{
        relativePath: "scripts/session.ts",
        size: 1,
      }],
    };

    const first = buildApprovedReport({
      ...input,
      candidates: makeCandidates(false),
    });
    const second = buildApprovedReport({
      ...input,
      candidates: makeCandidates(true),
    });

    expect(first.promotion.ok).toBe(true);
    expect(second.promotion.ok).toBe(true);
    if (!first.promotion.ok || !second.promotion.ok) return;

    const firstByTitle = [...first.promotion.report.bugs]
      .map((item) => item.id)
      .sort();
    const secondByTitle = [...second.promotion.report.bugs]
      .map((item) => item.id)
      .sort();
    expect(firstByTitle).toEqual(secondByTitle);
  });
});
