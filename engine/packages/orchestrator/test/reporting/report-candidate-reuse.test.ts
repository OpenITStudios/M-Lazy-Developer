// Same-feature report finding tests; original source bodies remain lexically isolated.
import { describe, expect, it } from "vitest";
import type { GameplayIntentModel } from "../../../gameplay-intent/src/index.js";
import { collectConfirmedDefects, describeAuditReportCandidate, buildBugReportFromAuditCandidatesCompatibility as buildBugReportFromAuditCandidates, prepareBugReportReviewFromAuditCandidatesCompatibility as prepareBugReportReviewFromAuditCandidates } from "../../src/reporting/report-defect-collector.js";
import type { AuditReportCandidate, BuildBugReportFromAuditInput, AiConfirmedDefectDraft, ConfirmedDefectDraft } from "../../src/reporting/report-defect-collector.js";
import { planReportCandidateReuse } from "../../src/reporting/report-candidate-reuse.js";
import { derivePrimaryFailureSignalsFromDiagnostics } from "../../src/reporting/report-classification-producers.js";
import { deriveReportDefectClassification } from "../../src/reporting/report-defect-classification.js";
import type { IntentDiagnosticGateResult } from "../../../diagnostic-reasoning/src/index.js";
import type { GameplayIntentRuntimeAssessment } from "../../src/gameplay-intent-runtime-stage.js";
import { applyProposedBugReview, groupConfirmedDefects } from "../../../bug-report/src/index.js";
import type { SemanticIr } from "../../../semantic-ir/src/index.js";
import { bindSourceEvidenceSemanticOwners, resolveSourceSemanticOwner } from "../../src/reporting/report-source-owner.js";

// Original engine/packages/orchestrator/test/reporting/report-candidate-reuse.test.ts; blob 6fb7469c69c9b482f918f4fee02d72f272fb561e
{
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
    statement: "Cleanup resets state.",
    strength: "must",
    status: "authored",
    subjectIds: ["outcome:cleanup"],
    evidenceIds: ["intent:evidence"],
  }],
  unknowns: [],
};

function candidate(
  evidenceId: string,
  disposition:
    | "design-review"
    | "insufficient-evidence" = "design-review",
): AuditReportCandidate {
  return {
    route: "static" as const,
    intent,
    result: {
      disposition,
      subjectIds: ["outcome:cleanup"],
      basisInvariantIds:
        disposition === "design-review"
          ? ["inv:cleanup"]
          : [],
      evidenceIds: [evidenceId],
      nextEvidenceNeed:
        disposition === "design-review"
          ? "intent-grounding" as const
          : "contradiction-proof" as const,
      reasons: ["More evidence is required."],
    },
    defect: {
      title: "Cleanup retains state",
      problem: "State remains.",
      expectedStatement: "State resets.",
      observedStatement: "State remains.",
      classificationSignals: {
        impact: [{
          kind: "important-state-wrong" as const,
          evidenceIds: [evidenceId],
        }],
        primaryFailure: [{
          failure: "player-owned-state" as const,
          evidenceIds: ["intent:evidence"],
        }],
      },
      aiAnalysis: "Cleanup appears inconsistent.",
      sourceEvidence: [{
        source: {
          artifactId: "map",
          relativePath: "scripts/session.ts",
          range: {
            lineStart: 10,
            lineEnd: 12,
          },
        },
        reason: "Owns cleanup.",
      }],
      causalIncidentId: "incident:cleanup",
    },
  };
}

describe("report candidate reuse", () => {
  it("reuses an unchanged evidence-bound rejection", () => {
    const item = candidate("static:a");
    const descriptor =
      describeAuditReportCandidate(item);
    const previous = [{
      route: descriptor.route,
      semanticKey: descriptor.semanticKey,
      evidenceIds: descriptor.evidenceIds,
      nextEvidenceNeed: descriptor.nextEvidenceNeed,
      reasons: ["Need authored intent."],
    }];

    const plan = planReportCandidateReuse(
      [item],
      previous,
    );

    expect(plan.reevaluate).toHaveLength(0);
    expect(plan.reusedRejected).toEqual(previous);
  });

  it("reevaluates when evidence changes", () => {
    const oldItem = candidate("static:a");
    const nextItem = candidate("static:b");
    const oldDescriptor =
      describeAuditReportCandidate(oldItem);

    const plan = planReportCandidateReuse(
      [nextItem],
      [{
        route: oldDescriptor.route,
        semanticKey: oldDescriptor.semanticKey,
        evidenceIds: oldDescriptor.evidenceIds,
        nextEvidenceNeed: "contradiction-proof",
        reasons: ["Need contradiction proof."],
      }],
    );

    expect(plan.reevaluate).toEqual([nextItem]);
    expect(plan.reusedRejected).toHaveLength(0);
  });

  it("reevaluates terminal classifications even when evidence is unchanged", () => {
    const item = candidate("static:a");
    const descriptor =
      describeAuditReportCandidate(item);

    const plan = planReportCandidateReuse(
      [item],
      [{
        route: descriptor.route,
        semanticKey: descriptor.semanticKey,
        evidenceIds: descriptor.evidenceIds,
        nextEvidenceNeed: "none",
        reasons: ["Previously classified as non-defect."],
      }],
    );

    expect(plan.reevaluate).toEqual([item]);
  });

  it("reevaluates correction-driven rejections even with unchanged evidence", () => {
    const item = candidate("static:a");
    const descriptor =
      describeAuditReportCandidate(item);

    const plan = planReportCandidateReuse(
      [item],
      [{
        route: descriptor.route,
        semanticKey: descriptor.semanticKey,
        evidenceIds: descriptor.evidenceIds,
        nextEvidenceNeed: "candidate-correction",
        reasons: ["Correct report facts."],
      }],
    );

    expect(plan.reevaluate).toEqual([item]);
  });

  it("does not persist reuse state into confirmed defect collection", () => {
    const item = candidate(
      "static:a",
      "insufficient-evidence",
    );
    const result = collectConfirmedDefects([item]);

    expect(result.confirmed).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
    expect(
      "reuse" in result.rejected[0]!,
    ).toBe(false);
  });
});
}

// Original engine/packages/orchestrator/test/reporting/report-defect-classification.test.ts; blob e4bd43adc4384e511cb85483d12302c9e92c9ad2
{
describe("report diagnostic classification", () => {
  it("maps the complete diagnostic producer matrix without promoting unknown or spatial-only findings", () => {
    const cases = [
      {
        label: "entity event", id: "diag:entity",
        code: "ENTITY_TRIGGER_EVENT_UNDEFINED", severity: "medium",
        message: "Undefined event.",
        expected: { signals: [{ failure: "entity-decision", evidenceIds: ["diag:entity"] }], unmappedFindingIds: [] },
      },
      {
        label: "removed script API", id: "diag:compat",
        code: "SCRIPT_API_REMOVED_SYMBOL", severity: "critical",
        message: "Removed symbol.",
        expected: { signals: [{ failure: "runtime-compatibility", evidenceIds: ["diag:compat"] }], unmappedFindingIds: [] },
      },
      {
        label: "unclassified physical divergence", id: "diag:replica",
        code: "ARENA_VOXEL_DIVERGENCE", severity: "critical",
        message: "Replica differs physically.",
        expected: { signals: [], unmappedFindingIds: ["diag:replica"] },
      },
      {
        label: "ambiguous command behavior", id: "diag:unknown",
        code: "UNKNOWN_COMMAND_EFFECT", severity: "minor",
        message: "Unknown effect.",
        expected: { signals: [], unmappedFindingIds: ["diag:unknown"] },
      },
      {
        label: "capacity finding without inferred player impact", id: "diag:capacity",
        code: "ARENA_CONCURRENCY_CAPACITY_SHORTFALL", severity: "critical",
        message: "Capacity shortfall.",
        expected: { signals: [{ failure: "session-concurrency", evidenceIds: ["diag:capacity"] }], unmappedFindingIds: [] },
      },
    ] as const;

    const observed = cases.map(({ label, id, code, severity, message }) => {
      const result = derivePrimaryFailureSignalsFromDiagnostics([
        { id, code, severity, message },
      ]);
      return { label, ...result, hasUnprovenImpact: "impact" in result };
    });
    expect(observed).toEqual(cases.map(({ label, expected }) => ({
      label, ...expected, hasUnprovenImpact: false,
    })));
  });
});

describe("report defect classification", () => {
  const unaffectedImpact = {
    progression: "unaffected",
    recovery: "normal",
    stability: "stable",
    coreMechanic: "correct",
    importantState: "correct",
    fairness: "unaffected",
  } as const;

  it("derives evidenced player-state and blocked-progression classifications", () => {
    const cases = [
      {
        label: "material player-owned state",
        kind: "important-state-wrong",
        failure: "player-owned-state",
        impactEvidence: "runtime:inventory",
        failureEvidence: "intent:inventory",
        expectedImpact: { ...unaffectedImpact, importantState: "materially-wrong" },
      },
      {
        label: "blocked progression",
        kind: "progression-blocked",
        failure: "game-progression",
        impactEvidence: "runtime:blocked",
        failureEvidence: "intent:progression",
        expectedImpact: { ...unaffectedImpact, progression: "blocked" },
      },
    ] as const;
    const observed = cases.map(({ label, kind, failure, impactEvidence, failureEvidence }) => {
      const result = deriveReportDefectClassification({
        impact: [{ kind, evidenceIds: [impactEvidence] }],
        primaryFailure: [{ failure, evidenceIds: [failureEvidence] }],
      });
      return {
        label,
        ok: result.ok,
        impact: result.ok ? result.impact : undefined,
        primaryFailure: result.ok ? result.primaryFailure : undefined,
      };
    });
    expect(observed).toEqual(cases.map(({ label, failure, expectedImpact }) => ({
      label, ok: true, impact: expectedImpact, primaryFailure: failure,
    })));
  });

  it("rejects ambiguous or ungrounded classification signals", () => {
    const cases = [
      {
        label: "multiple competing failure classes",
        input: {
          impact: [{ kind: "important-state-wrong", evidenceIds: ["runtime:state"] }],
          primaryFailure: [
            { failure: "player-owned-state", evidenceIds: ["intent:state"] },
            { failure: "session-concurrency", evidenceIds: ["intent:session"] },
          ],
        },
        ambiguous: true,
      },
      {
        label: "impact without any evidence",
        input: {
          impact: [{ kind: "fairness-affected", evidenceIds: [] }],
          primaryFailure: [{ failure: "combat-rule", evidenceIds: ["intent:combat"] }],
        },
        ambiguous: false,
      },
    ] as const;
    const observed = cases.map(({ label, input }) => {
      const result = deriveReportDefectClassification(input);
      return {
        label,
        ok: result.ok,
        ambiguous: !result.ok && result.reasons.join(" ").includes("ambiguous"),
      };
    });
    expect(observed).toEqual(cases.map(({ label, ambiguous }) => ({
      label, ok: false, ambiguous,
    })));
  });
});
}

// Original engine/packages/orchestrator/test/reporting/report-defect-collector.test.ts; blob 22420f454e5f900313fd6c1cb455efc14a75775a
{
const intent: GameplayIntentModel = {
  schemaVersion: 1,
  id: "intent",
  evidence: [{
    id: "intent:evidence",
    origin: "source-code",
    locator: "scripts/session.ts",
    scope: "selected-artifact",
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
}

// Original engine/packages/orchestrator/test/reporting/report-source-owner.test.ts; blob 2d60e868ab149593f3d5699836aaa05f493493ec
{
const ir: SemanticIr = {
  schemaVersion: 1,
  execution: {
    regions: [
      {
        id: "exec:cleanup",
        kind: "script-function",
        ownerId: "scripts/session",
        label: "function:cleanup",
        source: {
          artifactId: "map",
          relativePath: "scripts/session.ts",
          range: {
            lineStart: 10,
            lineEnd: 30,
          },
        },
      },
      {
        id: "exec:other",
        kind: "script-function",
        ownerId: "scripts/session",
        label: "function:other",
        source: {
          artifactId: "map",
          relativePath: "scripts/session.ts",
          range: {
            lineStart: 40,
            lineEnd: 60,
          },
        },
      },
    ],
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

describe("report source semantic owner", () => {
  it("binds a precise source range to the single containing execution region", () => {
    expect(
      resolveSourceSemanticOwner(
        {
          artifactId: "map",
          relativePath: "scripts/session.ts",
          range: {
            lineStart: 15,
            lineEnd: 16,
          },
        },
        ir,
      ),
    ).toBe("exec:cleanup");
  });

  it("prefers a directly matched state operation over broad region source", () => {
    const withOperation: SemanticIr = {
      ...ir,
      state: {
        ...ir.state,
        surfaces: [{
          id: "state:session",
          ref: {
            kind: "dynamic-property",
            key: "session",
          },
        }],
        operations: [{
          id: "op:cleanup",
          executionRegionId: "exec:cleanup",
          surfaceId: "state:session",
          operation: "write",
          source: {
            artifactId: "map",
            relativePath: "scripts/session.ts",
            range: {
              lineStart: 22,
              lineEnd: 22,
            },
          },
        }],
      },
    };

    expect(
      resolveSourceSemanticOwner(
        {
          artifactId: "map",
          relativePath: "scripts/session.ts",
          range: {
            lineStart: 22,
            lineEnd: 22,
          },
        },
        withOperation,
      ),
    ).toBe("exec:cleanup");
  });

  it("does not guess when equally ranked semantic operations disagree", () => {
    const ambiguous: SemanticIr = {
      ...ir,
      execution: {
        ...ir.execution,
        regions: [
          ...ir.execution.regions,
          {
            id: "exec:shadow",
            kind: "script-function",
            ownerId: "scripts/session",
            label: "function:shadow",
          },
        ],
      },
      state: {
        ...ir.state,
        surfaces: [{
          id: "state:session",
          ref: {
            kind: "dynamic-property",
            key: "session",
          },
        }],
        operations: [{
          id: "op:cleanup",
          executionRegionId: "exec:cleanup",
          surfaceId: "state:session",
          operation: "write",
          source: {
            artifactId: "map",
            relativePath: "scripts/session.ts",
            range: {
              lineStart: 22,
              lineEnd: 22,
            },
          },
        }, {
          id: "op:shadow",
          executionRegionId: "exec:shadow",
          surfaceId: "state:session",
          operation: "write",
          source: {
            artifactId: "map",
            relativePath: "scripts/session.ts",
            range: {
              lineStart: 22,
              lineEnd: 22,
            },
          },
        }],
      },
    };

    expect(
      resolveSourceSemanticOwner(
        {
          artifactId: "map",
          relativePath: "scripts/session.ts",
          range: {
            lineStart: 22,
            lineEnd: 22,
          },
        },
        ambiguous,
      ),
    ).toBeUndefined();
  });

  it("does not guess when equally ranked regions overlap", () => {
    const ambiguous: SemanticIr = {
      ...ir,
      execution: {
        ...ir.execution,
        regions: [
          ir.execution.regions[0]!,
          {
            ...ir.execution.regions[0]!,
            id: "exec:cleanup-shadow",
          },
        ],
      },
    };

    expect(
      resolveSourceSemanticOwner(
        {
          artifactId: "map",
          relativePath: "scripts/session.ts",
          range: {
            lineStart: 15,
            lineEnd: 16,
          },
        },
        ambiguous,
      ),
    ).toBeUndefined();
  });

  it("preserves an explicitly bound owner for later validation", () => {
    const result = bindSourceEvidenceSemanticOwners(
      [{
        source: {
          artifactId: "map",
          relativePath: "scripts/session.ts",
          range: {
            lineStart: 15,
            lineEnd: 16,
          },
        },
        semanticOwnerId: "exec:cleanup",
        reason: "Cleanup mutation.",
      }],
      ir,
    );

    expect(result?.[0]?.semanticOwnerId)
      .toBe("exec:cleanup");
  });
});
}
