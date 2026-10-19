import { describe, expect, it } from "vitest";
import { SemanticGraph } from "../../../graph/src/index.js";
import { authorizeRepair } from "../../../repair/src/index.js";
import {
  deriveSchedulerGenerationGuardTransformHints,
  parseScriptFile,
} from "../../../../analyzers/scripts/src/index.js";
import type {
  CausalChain,
  CausalIncident,
  DiagnosticRepairDecision,
  InvariantRegistrySnapshot,
} from "../../../project-model/src/index.js";
import type {
  DiagnosticFinding,
} from "../../../diagnostics/src/index.js";
import {
  BUILTIN_REPAIR_REALIZERS,
  BUILTIN_REPAIR_STRATEGY_SOURCES,
  assessRepairRealizerCoverage,
  buildRepairRealizationCoverageReport,
  createDecisionLedger,
  deriveRepairOpportunityEnvelope,
  enumerateRepairStrategySources,
  realizeSchedulerGenerationGuardFromParsedScripts,
  realizeSchedulerGenerationGuardHint,
  proveAndBindCompleteScriptTransform,
  recordRealizedRepairStrategySelection,
  repairStrategyPostTransformProofRevision,
  selectRealizedRepairStrategyForIncident,
  type RepairStrategyProviderRegistry,
} from "../../src/index.js";

const fileSource = {
  artifactId: "art-script",
  relativePath: "scripts/session.ts",
};

const scriptText = [
  'import { system } from "@minecraft/server";',
  "class SessionController {",
  "  generation = 0;",
  "  mutate() {}",
  "  schedule() {",
  "    const capturedGeneration = this.generation;",
  "    system.run(() => this.mutate());",
  "  }",
  "}",
].join("\n");

const hint =
  deriveSchedulerGenerationGuardTransformHints(
    "session-controller",
    scriptText,
    fileSource,
  )[0]!;

const chain: CausalChain = {
  id: "chain-scheduler",
  severity: "critical",
  confidence: "high",
  title: "stale scheduler generation",
  summary:
    "Deferred mutation executes after generation replacement.",
  nodes: [{
    id: "deferred-mutation",
    kind: "observed-state",
    label: "stale callback mutation",
    sourceRefs: [hint.source],
    diagnosticIds: ["diag-scheduler"],
  }, {
    id: "missing-generation-guard",
    kind: "missing-requirement",
    label: "generation guard",
  }],
  links: [{
    from: "deferred-mutation",
    to: "missing-generation-guard",
    strength: "direct-evidence",
    relationId: "relation-scheduler-generation",
    rationale:
      "Deferred mutation must be owned by the current generation.",
  }],
  relatedDiagnosticIds: ["diag-scheduler"],
};

const incident: CausalIncident = {
  id: "incident-scheduler",
  scopeKey: "session-controller",
  severity: "critical",
  confidence: "high",
  chainIds: [chain.id],
  relatedDiagnosticIds: ["diag-scheduler"],
  nodes: chain.nodes,
  links: chain.links,
  rootCauseCandidates: [{
    id: "cause-generation-guard",
    label: "missing scheduler generation guard",
    evidenceLevel:
      "proven-with-observed-outcome",
    proof: {
      state: "causal",
      interventionIds: [
        "exp:scheduler-generation",
      ],
      interventionProvenance: [{
        interventionId:
          "exp:scheduler-generation",
        experimentRevision: "rev-1",
        predicateId:
          "stale-callback-observed",
        controlledFactorIds: [
          "generation-guard-enabled",
        ],
        controlledFactorContrasts: [{
          factorId:
            "generation-guard-enabled",
          controlValue: true,
          treatmentValue: false,
        }],
        controlState: "absent",
        treatmentState: "present",
        expectedContrastDisposition: "matched",
        targetProfileFingerprint: "profile-a",
        fixtureFingerprint: "fixture-a",
        evidenceIds: ["runtime:stale-callback"],
      }],
      targetProfileFingerprint: "profile-a",
    },
    severity: "critical",
    confidence: "high",
    chainIds: [chain.id],
    relatedDiagnosticIds: ["diag-scheduler"],
    causalPredicateIds: [
      "stale-callback-observed",
    ],
    causalFactorIds: [
      "generation-guard-enabled",
    ],
    support: {
      dependencyViolations: 1,
      evidenceGaps: 0,
      corroboratedRisks: 0,
      observedOutcomes: 1,
    },
  }],
};

const decision: DiagnosticRepairDecision = {
  incidentId: incident.id,
  activeCandidateIds: [
    "cause-generation-guard",
  ],
  disposition: "repair-eligible",
  selectedCandidateId:
    "cause-generation-guard",
  effectiveEvidenceLevel:
    "proven-with-observed-outcome",
  proofState: "causal",
  causalProof:
    incident.rootCauseCandidates[0]!.proof!,
  claimStrength: "proven-runtime",
  reasons: ["controlled scheduler proof"],
};

const diagnostics: DiagnosticFinding[] = [{
  id: "diag-scheduler",
  code:
    "SEMANTIC_IR_DEFERRED_STATE_GUARD_UNKNOWN",
  severity: "critical",
  message:
    "Deferred state mutation has no generation guard.",
  source: hint.source,
}];

const invariants: InvariantRegistrySnapshot = {
  schemaVersion: 1,
  revision: "inv-scheduler-r1",
  profileKey: "bedrock",
  entries: [{
    id: "invariant::scheduler-generation",
    source: {
      kind: "knowledge-relation",
      id: "relation-scheduler-generation",
      revision: "knowledge-r1",
    },
    enforcement: "runtime-state",
    minimumRepairClaim: "proven-runtime",
    stateRequirements: [{
      id: "generation-current",
      predicate: "generation-current",
      expectedState: "present",
    }],
    temporalRequirements: [],
    revalidationLayers: [
      "static",
      "transitive",
      "runtime",
      "package",
    ],
  }],
};

const approvedReceipt = authorizeRepair({
  confirmedDefect: true,
  diagnosisEvidenceIds: ["diag-scheduler"],
  invariantIds: ["invariant::scheduler-generation"],
  sourceFingerprint: "source-a",
  sourceFingerprintMatches: true,
  evidenceFreshness: "fresh",
}).receipt!;

const emptyProviders: RepairStrategyProviderRegistry = {
  schemaVersion: 1,
  providers: [],
};

function enumeration() {
  const envelope = deriveRepairOpportunityEnvelope(
    incident,
    [chain],
    decision,
    diagnostics,
    invariants,
    "source-a",
  );

  return enumerateRepairStrategySources(
    envelope,
    diagnostics,
    emptyProviders,
    BUILTIN_REPAIR_STRATEGY_SOURCES,
  );
}

function graph() {
  const graph = new SemanticGraph();
  graph.addNode({
    id: "script-file:session",
    identity: {
      kind: "script_file",
      scope: "bp",
      identifier: "session",
    },
    kind: "script_file",
    identifier: "session",
    source: fileSource,
  });
  graph.addNode({
    id: "script-callback:session:7",
    identity: {
      kind: "script_file",
      scope: "bp",
      identifier: "session:callback:7",
    },
    kind: "script_file",
    identifier: "session:callback:7",
    source: hint.source,
  });
  return graph;
}

describe("script transform hint realizer", () => {
  it("refuses a transaction when the approved repair receipt is absent", () => {
    const result = realizeSchedulerGenerationGuardHint(
      graph(),
      enumeration(),
      BUILTIN_REPAIR_STRATEGY_SOURCES,
      BUILTIN_REPAIR_REALIZERS,
      hint,
    );
    expect(result).toMatchObject({
      status: "blocked",
      reasons: expect.arrayContaining([expect.stringMatching(/authorized repair receipt/i)]),
    });
  });
  it("realizes a scheduler generation guard only from an analyzer-owned exact hint", () => {
    const result =
      realizeSchedulerGenerationGuardHint(
        graph(),
        enumeration(),
        BUILTIN_REPAIR_STRATEGY_SOURCES,
        BUILTIN_REPAIR_REALIZERS,
        hint,
        approvedReceipt,
      );

    expect(result.status).toBe("realized");
    if (result.status !== "realized") return;

    expect(result.proposal).toMatchObject({
      sourceKind: "built-in-planner",
      sourceId:
        "scheduler-generation-guard-template",
      sourceVersion: "1",
      realizerId:
        "scheduler-generation-guard-realizer",
      realizerVersion: "1",
      hintId: hint.id,
      strategy: {
        addressesCandidateIds: [
          "cause-generation-guard",
        ],
        supportingInvariantIds: [
          "invariant::scheduler-generation",
        ],
        repairClass: "implementation-repair",
        reversible: true,
        idempotent: false,
        changedNodeIds: [
          "script-callback:session:7",
          "script-file:session",
        ],
        causalBinding: {
          interventionIds: [
            "exp:scheduler-generation",
          ],
          predicateIds: [
            "stale-callback-observed",
          ],
          factorIds: [
            "generation-guard-enabled",
          ],
        },
        validationObligations: {
          invariantIds: [
            "invariant::scheduler-generation",
          ],
          runtimeExperimentIds: [
            "exp:scheduler-generation",
          ],
          validationKinds: [
            "rebuild-graph",
            "reparse",
          ],
        },
      },
    });

    const transaction =
      result.proposal.strategy.transaction;
    expect(transaction.sourceFingerprint).toBe(
      "source-a",
    );
    expect(transaction.operations).toEqual([{
      kind: "replace-text",
      source: hint.source,
      expected: hint.expectedText,
      replacement: hint.replacementText,
    }]);
    expect(transaction.preconditions).toEqual([{
      kind: "source-fingerprint",
      expected: "source-a",
    }]);
  });

  it("feeds realized scheduler repair through coverage, causal selection, and ledger provenance", () => {
    const activeGraph = graph();
    const activeEnumeration = enumeration();
    const realization =
      realizeSchedulerGenerationGuardHint(
        activeGraph,
        activeEnumeration,
        BUILTIN_REPAIR_STRATEGY_SOURCES,
        BUILTIN_REPAIR_REALIZERS,
        hint,
        approvedReceipt,
      );

    expect(realization.status).toBe("realized");
    if (realization.status !== "realized") return;

    const realizerCoverage =
      assessRepairRealizerCoverage(
        activeEnumeration,
        BUILTIN_REPAIR_REALIZERS,
      );
    const coverage =
      buildRepairRealizationCoverageReport(
        activeEnumeration,
        realizerCoverage,
        [realization],
      );

    expect(coverage).toMatchObject({
      realizedCount: 1,
      noImplementationCoverage: false,
    });
    expect(
      coverage.items.find(
        (item) =>
          item.sourceId ===
            "scheduler-generation-guard-template",
      ),
    ).toMatchObject({
      disposition: "realized",
      strategyId:
        realization.proposal.strategy.strategyId,
    });

    const unproven =
      selectRealizedRepairStrategyForIncident(
        activeGraph,
        incident,
        [chain],
        decision,
        invariants,
        BUILTIN_REPAIR_STRATEGY_SOURCES,
        BUILTIN_REPAIR_REALIZERS,
        [realization.proposal],
        {
          decisionBasis: {
            runtimeEvidenceRevision:
              "runtime-current",
          },
        },
      );

    expect(unproven.result.status).toBe("evaluated");
    if (unproven.result.status !== "evaluated") return;
    expect(unproven.result.selection.status)
      .toBe("none-eligible");

    const bound =
      proveAndBindCompleteScriptTransform(
        realization.proposal,
        "session-controller",
        scriptText,
        fileSource,
        hint,
      );
    expect(bound.status).toBe("bound");
    if (bound.status !== "bound") return;

    const selected =
      selectRealizedRepairStrategyForIncident(
        activeGraph,
        incident,
        [chain],
        decision,
        invariants,
        BUILTIN_REPAIR_STRATEGY_SOURCES,
        BUILTIN_REPAIR_REALIZERS,
        [bound.proposal],
        {
          decisionBasis: {
            runtimeEvidenceRevision:
              "runtime-current",
          },
        },
      );

    expect(selected.result.status).toBe("evaluated");
    if (selected.result.status !== "evaluated") return;
    expect(selected.result.selection.status)
      .toBe("selected");
    if (
      selected.result.selection.status !==
        "selected"
    ) {
      return;
    }

    const transactionId =
      selected.result.selection.selected
        .transactionId;
    const ledger =
      recordRealizedRepairStrategySelection(
        createDecisionLedger(),
        selected,
        transactionId,
        {
          decisionId:
            "decision-scheduler-realizer",
          basis: {
            runtimeEvidenceRevision:
              "runtime-current",
            invariantRegistryRevision:
              invariants.revision,
          },
        },
      );

    const proofRevision =
      repairStrategyPostTransformProofRevision(
        bound.proposal.strategy
          .postTransformProof,
      )!;
    expect(ledger.entries[0]?.inputIds).toEqual(
      expect.arrayContaining([
        "repair-source:built-in-planner:scheduler-generation-guard-template@1",
        "repair-realizer:scheduler-generation-guard-realizer@1",
        "post-transform-proof:" +
          proofRevision,
      ]),
    );
    expect(
      ledger.entries[0]?.basis
        .postTransformProofRevision,
    ).toBe(proofRevision);
    expect(
      ledger.entries[0]?.basis
        .repairStrategySourceRegistryRevision,
    ).toBe(selected.sourceRegistryRevision);
    expect(
      ledger.entries[0]?.basis
        .repairRealizerRegistryRevision,
    ).toBe(selected.realizerRegistryRevision);
  });

  it("does not allow a complete transform proof to be reused after transaction semantics change", () => {
    const realization =
      realizeSchedulerGenerationGuardHint(
        graph(),
        enumeration(),
        BUILTIN_REPAIR_STRATEGY_SOURCES,
        BUILTIN_REPAIR_REALIZERS,
        hint,
        approvedReceipt,
      );
    expect(realization.status).toBe("realized");
    if (realization.status !== "realized") return;

    const bound =
      proveAndBindCompleteScriptTransform(
        realization.proposal,
        "session-controller",
        scriptText,
        fileSource,
        hint,
      );
    expect(bound.status).toBe("bound");
    if (bound.status !== "bound") return;

    const tampered = {
      ...bound.proposal,
      strategy: {
        ...bound.proposal.strategy,
        transaction: {
          ...bound.proposal.strategy.transaction,
          operations:
            bound.proposal.strategy.transaction.operations.map(
              (operation) => ({
                ...operation,
                replacement:
                  operation.replacement +
                  " /* changed */",
              }),
            ),
        },
      },
    };

    const selected =
      selectRealizedRepairStrategyForIncident(
        graph(),
        incident,
        [chain],
        decision,
        invariants,
        BUILTIN_REPAIR_STRATEGY_SOURCES,
        BUILTIN_REPAIR_REALIZERS,
        [tampered],
        {
          decisionBasis: {
            runtimeEvidenceRevision:
              "runtime-current",
          },
        },
      );

    expect(selected.result.status).toBe("evaluated");
    if (selected.result.status !== "evaluated") return;
    expect(selected.result.selection.status)
      .toBe("none-eligible");
    expect(
      selected.result.selection.assessments[0]
        ?.reasons.join(" "),
    ).toMatch(/exact selected patch transaction/i);
  });

  it("discovers the exact hint from parsed scripts so callers do not choose transform hints manually", () => {
    const parsed = parseScriptFile(
      "session-controller",
      scriptText,
      fileSource,
    );

    const result =
      realizeSchedulerGenerationGuardFromParsedScripts(
        graph(),
        enumeration(),
        BUILTIN_REPAIR_STRATEGY_SOURCES,
        BUILTIN_REPAIR_REALIZERS,
        [{ parsed }],
        approvedReceipt,
      );

    expect(result.status).toBe("realized");
    if (result.status !== "realized") return;
    expect(result.proposal.hintId).toBe(
      parsed.repairTransformHints?.[0]?.id,
    );

    const ambiguous =
      realizeSchedulerGenerationGuardFromParsedScripts(
        graph(),
        enumeration(),
        BUILTIN_REPAIR_STRATEGY_SOURCES,
        BUILTIN_REPAIR_REALIZERS,
        [{ parsed }, { parsed }],
        approvedReceipt,
      );

    expect(ambiguous).toMatchObject({
      status: "blocked",
      reasons: expect.arrayContaining([
        expect.stringMatching(/multiple exact scheduler/i),
      ]),
    });
  });

  it("blocks stale analyzer/parser revisions and source hints outside the causal opportunity", () => {
    const stale = {
      ...hint,
      analyzerRevision: "old",
    };
    expect(
      realizeSchedulerGenerationGuardHint(
        graph(),
        enumeration(),
        BUILTIN_REPAIR_STRATEGY_SOURCES,
        BUILTIN_REPAIR_REALIZERS,
        stale,
      ),
    ).toMatchObject({
      status: "blocked",
      reasons: expect.arrayContaining([
        expect.stringMatching(
          /analyzer identity\/revision/i,
        ),
      ]),
    });

    const wrongSource = {
      ...hint,
      source: {
        ...hint.source,
        relativePath: "scripts/other.ts",
      },
    };
    expect(
      realizeSchedulerGenerationGuardHint(
        graph(),
        enumeration(),
        BUILTIN_REPAIR_STRATEGY_SOURCES,
        BUILTIN_REPAIR_REALIZERS,
        wrongSource,
      ),
    ).toMatchObject({
      status: "blocked",
      reasons: expect.arrayContaining([
        expect.stringMatching(
          /not exact source evidence/i,
        ),
      ]),
    });
  });

  it("blocks a valid syntax hint when the causal opportunity contains unsupported predicates or factors", () => {
    const base = enumeration();
    const incompatible = {
      ...base,
      envelope: {
        ...base.envelope,
        causalBinding: {
          ...base.envelope.causalBinding,
          predicateIds: [
            "stale-callback-observed",
            "cross-arena-mutation-observed",
          ],
        },
      },
    };

    expect(
      realizeSchedulerGenerationGuardHint(
        graph(),
        incompatible,
        BUILTIN_REPAIR_STRATEGY_SOURCES,
        BUILTIN_REPAIR_REALIZERS,
        hint,
      ),
    ).toMatchObject({
      status: "blocked",
      reasons: expect.arrayContaining([
        expect.stringMatching(
          /does not cover every causal predicate/i,
        ),
      ]),
    });
  });
});
