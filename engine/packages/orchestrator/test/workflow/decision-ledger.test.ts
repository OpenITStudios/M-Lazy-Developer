// Source-family consolidation; original testcase bodies are lexically isolated.
import { describe, expect, it } from "vitest";
import { activeDecisionLedgerEntries, appendDecisionLedgerEntry, createDecisionLedger, invalidateStaleDecisionLedger, supersedeDecisionLedgerEntry } from "../../src/workflow/decision-ledger.js";
import { recordDiagnosticRepairDecision, recordPackageVerificationDecision, recordPreservationVerificationDecision, recordReleaseDecision, recordRepairAdmissionDecision, recordRepairRealizationCoverage, recordRuntimeVerificationDecision } from "../../src/workflow/decision-ledger-recording.js";
import type { RepairLifecycleState } from "../../src/repair/repair-lifecycle.js";
import type { RepairProofBundle } from "../../src/repair/repair-proof-bundle.js";
import { CONTRACT_REGISTRY_REVISION } from "../../../project-model/src/index.js";
import type { DecisionLedgerSnapshot } from "../../../project-model/src/index.js";
import type { ValidationTraceReport, ValidationScenario } from "../../../validation/src/index.js";
import { buildEngineeringReviewInvalidationProjection } from "../../src/workflow/engineering-review-invalidation.js";
import { buildEngineeringReviewPriority } from "../../src/workflow/engineering-review-priority.js";
import { buildEngineeringReviewProjection } from "../../src/workflow/engineering-review-projection.js";
import type { EngineeringReviewSource } from "../../src/workflow/engineering-review-projection.js";
import { planSelectiveValidation, selectiveValidationPlanText } from "../../src/workflow/selective-validation-plan.js";
import { planPatchSemanticAffectedSet, planSemanticAffectedSet } from "../../src/workflow/semantic-affected-plan.js";
import type { SemanticAffectedPlan } from "../../src/workflow/semantic-affected-plan.js";
import { SemanticGraph } from "../../../graph/src/index.js";
import { authorizeRepair } from "../../../repair/src/index.js";
import type { PatchTransaction } from "../../../repair/src/index.js";

// Original engine/packages/orchestrator/test/workflow/decision-ledger.test.ts; blob 83480cfeeb0312f1db538ec2ebf9dc5be09088e1
{
// Source-preserving consolidation: original test cases remain in isolated lexical blocks.

// Consolidated suite from engine/packages/orchestrator/test/workflow/decision-ledger.test.ts
{
describe("decision ledger", () => {
  it("appends deterministic monotonic entries without overwriting history", () => {
    let ledger = createDecisionLedger();
    ledger = appendDecisionLedgerEntry(ledger, {
      id: "decision-1",
      kind: "repair-authorization",
      incidentId: "incident-1",
      basis: {
        sourceFingerprint: "source-a",
        graphFingerprint: "graph-a",
      },
      evidenceIds: ["evidence-1"],
    });
    ledger = appendDecisionLedgerEntry(ledger, {
      id: "decision-2",
      kind: "repair-admission",
      transactionId: "tx-1",
      basis: {
        sourceFingerprint: "source-a",
        graphFingerprint: "graph-a",
      },
      upstreamDecisionIds: ["decision-1"],
    });

    expect(ledger.entries.map((entry) => entry.createdSequence))
      .toEqual([1, 2]);
    expect(ledger.entries[0]?.status).toBe("active");
  });

  it("invalidates active decisions when a declared basis changes", () => {
    let ledger = appendDecisionLedgerEntry(
      createDecisionLedger(),
      {
        id: "decision-1",
        kind: "repair-authorization",
        basis: {
          sourceFingerprint: "source-a",
          graphFingerprint: "graph-a",
          invariantRegistryRevision: "inv-a",
        },
      },
    );

    ledger = invalidateStaleDecisionLedger(ledger, {
      sourceFingerprint: "source-a",
      graphFingerprint: "graph-b",
      invariantRegistryRevision: "inv-a",
    });

    expect(ledger.entries[0]).toMatchObject({
      status: "invalidated",
    });
    expect(ledger.entries[0]?.invalidationReason)
      .toMatch(/graphFingerprint changed/);
  });

  it("does not invalidate decisions for basis dimensions they never declared", () => {
    let ledger = appendDecisionLedgerEntry(
      createDecisionLedger(),
      {
        id: "decision-1",
        kind: "diagnostic-candidate-selection",
        basis: {
          knowledgeRevision: "k1",
        },
      },
    );

    ledger = invalidateStaleDecisionLedger(ledger, {
      knowledgeRevision: "k1",
      graphFingerprint: "graph-new",
    });

    expect(activeDecisionLedgerEntries(ledger)).toHaveLength(1);
  });

  it("supersedes rather than mutating prior decision content", () => {
    let ledger = createDecisionLedger();
    ledger = appendDecisionLedgerEntry(ledger, {
      id: "decision-1",
      kind: "diagnostic-candidate-selection",
      basis: { knowledgeRevision: "k1" },
    });
    ledger = appendDecisionLedgerEntry(ledger, {
      id: "decision-2",
      kind: "diagnostic-candidate-selection",
      basis: { knowledgeRevision: "k1" },
      upstreamDecisionIds: ["decision-1"],
    });
    ledger = supersedeDecisionLedgerEntry(
      ledger,
      "decision-1",
      "decision-2",
    );

    expect(ledger.entries[0]).toMatchObject({
      status: "superseded",
      supersededBy: "decision-2",
    });
    expect(ledger.entries[1]?.status).toBe("active");
  });

  it("rejects duplicate decision ids", () => {
    const ledger = appendDecisionLedgerEntry(
      createDecisionLedger(),
      {
        id: "decision-1",
        kind: "repair-admission",
        basis: {},
      },
    );

    expect(() => appendDecisionLedgerEntry(ledger, {
      id: "decision-1",
      kind: "repair-admission",
      basis: {},
    })).toThrow(/already exists/);
  });

  it("invalidates descendants when an upstream decision becomes stale", () => {
    let ledger = createDecisionLedger();
    ledger = appendDecisionLedgerEntry(ledger, {
      id: "parent",
      kind: "repair-authorization",
      basis: { graphFingerprint: "graph-a" },
    });
    ledger = appendDecisionLedgerEntry(ledger, {
      id: "child",
      kind: "repair-admission",
      basis: {},
      upstreamDecisionIds: ["parent"],
    });
    ledger = appendDecisionLedgerEntry(ledger, {
      id: "grandchild",
      kind: "release-admission",
      basis: {
        runtimeEvidenceRevision: "runtime-r1",
        preservationContractRevision: "preservation-contract-r1",
        preservationBaselineRevision: "preservation-baseline-r1",
      },
      upstreamDecisionIds: ["child"],
    });

    ledger = invalidateStaleDecisionLedger(ledger, {
      graphFingerprint: "graph-b",
    });

    expect(ledger.entries.map((entry) => entry.status))
      .toEqual(["invalidated", "invalidated", "invalidated"]);
    expect(ledger.entries[2]?.invalidationReason)
      .toMatch(/Upstream decision/);
  });

  it("rejects missing or inactive upstream decision parents", () => {
    expect(() => appendDecisionLedgerEntry(
      createDecisionLedger(),
      {
        id: "child",
        kind: "repair-admission",
        basis: {},
        upstreamDecisionIds: ["missing"],
      },
    )).toThrow(/does not exist/);

    let ledger = appendDecisionLedgerEntry(
      createDecisionLedger(),
      {
        id: "parent",
        kind: "repair-authorization",
        basis: { graphFingerprint: "old" },
      },
    );
    ledger = invalidateStaleDecisionLedger(ledger, {
      graphFingerprint: "new",
    });

    expect(() => appendDecisionLedgerEntry(
      ledger,
      {
        id: "child",
        kind: "repair-admission",
        basis: {},
        upstreamDecisionIds: ["parent"],
      },
    )).toThrow(/not active/);
  });

  it("rejects supersession by an older decision", () => {
    let ledger = createDecisionLedger();
    ledger = appendDecisionLedgerEntry(ledger, {
      id: "old",
      kind: "diagnostic-candidate-selection",
      basis: {},
    });
    ledger = appendDecisionLedgerEntry(ledger, {
      id: "new",
      kind: "diagnostic-candidate-selection",
      basis: {},
    });

    expect(() => supersedeDecisionLedgerEntry(
      ledger,
      "new",
      "old",
    )).toThrow(/newer/);
  });

  it("invalidates decisions when runtime evidence revision changes", () => {
    let ledger = appendDecisionLedgerEntry(
      createDecisionLedger(),
      {
        id: "evidence-bound",
        kind: "repair-authorization",
        basis: {
          runtimeEvidenceRevision: "evidence-a",
        },
      },
    );

    ledger = invalidateStaleDecisionLedger(ledger, {
      runtimeEvidenceRevision: "evidence-b",
    });

    expect(ledger.entries[0]).toMatchObject({
      status: "invalidated",
    });
    expect(ledger.entries[0]?.invalidationReason)
      .toMatch(/runtimeEvidenceRevision changed/);
  });

  it("invalidates runtime decisions when the experiment contract envelope revision changes", () => {
    let ledger = appendDecisionLedgerEntry(
      createDecisionLedger(),
      {
        id: "runtime-contract-bound",
        kind: "runtime-verification",
        transactionId: "tx-1",
        basis: {
          runtimeEvidenceRevision: "evidence-a",
          runtimeExperimentContractRevision: "contract-envelope-a",
        },
        outputIds: ["runtime-verification:passed"],
      },
    );

    ledger = invalidateStaleDecisionLedger(ledger, {
      runtimeEvidenceRevision: "evidence-a",
      runtimeExperimentContractRevision: "contract-envelope-b",
    });

    expect(ledger.entries[0]).toMatchObject({
      status: "invalidated",
    });
    expect(ledger.entries[0]?.invalidationReason)
      .toMatch(/runtimeExperimentContractRevision changed/);
  });

  it("invalidates descendants when a historical contract revision is stale", () => {
    let ledger = createDecisionLedger();
    ledger = appendDecisionLedgerEntry(ledger, {
      id: "contract-bound",
      kind: "repair-authorization",
      basis: {},
    });
    ledger = appendDecisionLedgerEntry(ledger, {
      id: "downstream",
      kind: "release-admission",
      basis: {
        runtimeEvidenceRevision: "runtime-r1",
        preservationContractRevision: "preservation-contract-r1",
        preservationBaselineRevision: "preservation-baseline-r1",
      },
      upstreamDecisionIds: ["contract-bound"],
    });
    ledger = {
      schemaVersion: 1,
      entries: ledger.entries.map((entry) =>
        entry.id === "contract-bound"
          ? {
              ...entry,
              basis: {
                ...entry.basis,
                contractRegistryRevision: "historical-contract-revision",
              },
            }
          : entry
      ),
    };

    ledger = invalidateStaleDecisionLedger(ledger, {});

    expect(ledger.entries.map((entry) => entry.status))
      .toEqual(["invalidated", "invalidated"]);
    expect(ledger.entries[0]?.invalidationReason)
      .toMatch(/contractRegistryRevision changed/);
    expect(ledger.entries[1]?.invalidationReason)
      .toMatch(/Upstream decision/);
  });


  it("automatically binds new decisions to the canonical contract registry", () => {
    const ledger = appendDecisionLedgerEntry(
      createDecisionLedger(),
      {
        id: "contract-bound-auto",
        kind: "repair-authorization",
        basis: {},
      },
    );

    expect(ledger.entries[0]?.basis.contractRegistryRevision)
      .toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects callers that try to append a stale contract revision", () => {
    expect(() => appendDecisionLedgerEntry(
      createDecisionLedger(),
      {
        id: "contract-stale",
        kind: "repair-authorization",
        basis: {
          contractRegistryRevision: "stale",
        },
      },
    )).toThrow(/contract registry revision is stale/);
  });


  it("invalidates repair strategy decisions when post-transform proof changes", () => {
    let ledger = appendDecisionLedgerEntry(
      createDecisionLedger(),
      {
        id: "post-transform-bound",
        kind: "repair-strategy-selection",
        transactionId: "tx-1",
        basis: {
          postTransformProofRevision:
            "proof-a",
        },
        inputIds: [
          "post-transform-proof:proof-a",
        ],
        outputIds: [
          "repair-strategy:selected",
        ],
      },
    );
    ledger = appendDecisionLedgerEntry(ledger, {
      id: "post-transform-downstream",
      kind: "repair-admission",
      transactionId: "tx-1",
      basis: {},
      upstreamDecisionIds: [
        "post-transform-bound",
      ],
    });

    ledger = invalidateStaleDecisionLedger(ledger, {
      postTransformProofRevision:
        "proof-b",
    });

    expect(
      ledger.entries.map((entry) => entry.status),
    ).toEqual(["invalidated", "invalidated"]);
    expect(
      ledger.entries[0]?.invalidationReason,
    ).toMatch(/postTransformProofRevision changed/);
  });

  it("invalidates repair strategy decisions when source registry changes", () => {
    let ledger = appendDecisionLedgerEntry(
      createDecisionLedger(),
      {
        id: "source-registry-bound",
        kind: "repair-strategy-realization",
        basis: {
          repairStrategySourceRegistryRevision:
            "sources-a",
        },
        outputIds: [
          "repair-realization:no-implementation-coverage:false",
        ],
      },
    );
    ledger = appendDecisionLedgerEntry(ledger, {
      id: "source-registry-downstream",
      kind: "repair-strategy-selection",
      transactionId: "tx-1",
      basis: {},
      upstreamDecisionIds: [
        "source-registry-bound",
      ],
      outputIds: [
        "repair-strategy:selected",
      ],
    });

    ledger = invalidateStaleDecisionLedger(ledger, {
      repairStrategySourceRegistryRevision:
        "sources-b",
    });

    expect(ledger.entries.map((entry) => entry.status))
      .toEqual(["invalidated", "invalidated"]);
    expect(ledger.entries[0]?.invalidationReason)
      .toMatch(/repairStrategySourceRegistryRevision changed/);
  });

  it("invalidates repair strategy decisions when realizer registry changes", () => {
    let ledger = appendDecisionLedgerEntry(
      createDecisionLedger(),
      {
        id: "realizer-bound",
        kind: "repair-strategy-selection",
        transactionId: "tx-1",
        basis: {
          repairRealizerRegistryRevision:
            "realizers-a",
        },
        inputIds: [
          "repair-realizer:fixture-realizer@1",
        ],
        outputIds: [
          "repair-strategy:selected",
        ],
      },
    );
    ledger = appendDecisionLedgerEntry(ledger, {
      id: "realizer-downstream",
      kind: "repair-admission",
      transactionId: "tx-1",
      basis: {},
      upstreamDecisionIds: ["realizer-bound"],
    });

    ledger = invalidateStaleDecisionLedger(ledger, {
      repairRealizerRegistryRevision:
        "realizers-b",
    });

    expect(ledger.entries.map((entry) => entry.status))
      .toEqual(["invalidated", "invalidated"]);
    expect(ledger.entries[0]?.invalidationReason)
      .toMatch(/repairRealizerRegistryRevision changed/);
  });

  it("invalidates provider-bound decisions when provider registry changes", () => {
    let ledger = appendDecisionLedgerEntry(
      createDecisionLedger(),
      {
        id: "provider-bound",
        kind: "repair-strategy-selection",
        transactionId: "tx-1",
        basis: {
          repairProviderRegistryRevision: "providers-a",
        },
        inputIds: ["repair-provider:fixture@1"],
      },
    );
    ledger = appendDecisionLedgerEntry(ledger, {
      id: "provider-downstream",
      kind: "repair-admission",
      transactionId: "tx-1",
      basis: {},
      upstreamDecisionIds: ["provider-bound"],
    });

    ledger = invalidateStaleDecisionLedger(ledger, {
      repairProviderRegistryRevision: "providers-b",
    });

    expect(ledger.entries.map((entry) => entry.status))
      .toEqual(["invalidated", "invalidated"]);
    expect(ledger.entries[0]?.invalidationReason)
      .toMatch(/repairProviderRegistryRevision changed/);
  });

});
}

// Consolidated suite from engine/packages/orchestrator/test/workflow/decision-ledger-recording.test.ts
{
const basis = {
  contractRegistryRevision: CONTRACT_REGISTRY_REVISION,
  sourceFingerprint: "source-a",
  graphFingerprint: "graph-a",
  invariantRegistryRevision: "inv-a",
  runtimeEvidenceRevision: "runtime-a",
  preservationContractRevision: "preservation-contract-a",
  preservationBaselineRevision: "preservation-baseline-a",
};

const lifecycle: RepairLifecycleState = {
  transactionId: "tx-1",
  stage: "static-validated",
  mutationPresent: true,
  localStaticValidationPassed: true,
  transitiveRevalidationComplete: true,
  runtimeVerificationComplete: true,
  preservationVerificationComplete: true,
  packageVerificationComplete: true,
  pendingNodeIds: [],
  pendingPaths: [],
  reasons: [],
};

const proof: RepairProofBundle = {
  transactionId: "tx-1",
  sourceFingerprint: "source-a",
  graphFingerprint: "graph-a",
  decisionBasis: basis,
  incidentId: "incident-1",
  selectedCandidateId: "candidate-1",
  diagnosticDisposition: "repair-eligible",
  claimStrength: "proven-runtime",
  effectiveEvidenceLevel:
    "proven-with-observed-outcome",
  proofState: "causal",
  blastRadiusDisposition: "minimal",
  admissionDisposition: "eligible",
  preservationContractId: "preserve:tx-1",
  preservationReadinessDisposition: "ready",
  preservationBaselineEvidenceIds: [
    "baseline:broken",
    "baseline:healthy",
  ],
  supportingInvariantIds: ["invariant:ready"],
  changedNodeIds: ["node-1"],
  affectedNodeIds: ["node-1"],
  requiredRevalidationNodeIds: [],
  requiredRevalidationPaths: [],
  impactTraces: [],
  reasons: [],
};

function ledgerBeforeRelease() {
  let ledger = createDecisionLedger();

  ledger = recordDiagnosticRepairDecision(
    ledger,
    {
      incidentId: "incident-1",
      activeCandidateIds: ["candidate-1"],
      disposition: "repair-eligible",
      selectedCandidateId: "candidate-1",
      effectiveEvidenceLevel:
        "proven-with-observed-outcome",
      proofState: "causal",
      claimStrength: "proven-runtime",
      reasons: ["proof"],
    },
    {
      decisionId: "decision-auth",
      basis,
      evidenceIds: ["runtime:root-cause"],
    },
  );

  ledger = appendDecisionLedgerEntry(ledger, {
    id: "decision-strategy",
    kind: "repair-strategy-selection",
    transactionId: "tx-1",
    basis,
    upstreamDecisionIds: ["decision-auth"],
    outputIds: [
      "repair-strategy:selected",
      "repair-strategy:small",
      "repair-transaction:tx-1",
      "repair-invariant:invariant:ready",
    ],
  });

  ledger = recordRepairAdmissionDecision(
    ledger,
    {
      transactionId: "tx-1",
      disposition: "eligible",
      reasons: ["bounded"],
    },
    "tx-1",
    {
      decisionId: "decision-admission",
      basis,
      upstreamDecisionIds: ["decision-strategy"],
    },
  );

  ledger = recordRuntimeVerificationDecision(
    ledger,
    {
      passed: true,
      satisfiedStateRequirementIds: ["ready"],
      failedStateRequirementIds: [],
      temporalAssessments: [],
      evidenceIds: ["runtime:ready"],
      receipt: {
        transactionId: "tx-1",
        kind: "runtime",
        passed: true,
        evidenceIds: ["runtime:ready"],
        runtimeExperimentContract: {
          interventionId: "exp:chunk",
          experimentRevision: "rev-2",
          compatibleWithRevisions: ["rev-1"],
          targetProfileFingerprint: "profile-a",
          fixtureFingerprint: "fixture-a",
          predicateIds: ["target-ready"],
          factorContrasts: [{
            factorId: "chunk-loaded",
            controlValue: false,
            treatmentValue: true,
          }],
          expectedContrasts: [{
            predicateId: "target-ready",
            controlState: "absent",
            treatmentState: "present",
          }],
        },
      },
      reasons: ["passed"],
    },
    "tx-1",
    {
      decisionId: "decision-runtime",
      basis,
      upstreamDecisionIds: ["decision-admission"],
    },
  );

  ledger = recordPreservationVerificationDecision(
    ledger,
    {
      passed: true,
      verifiedMustChangeInvariantIds: ["invariant:ready"],
      verifiedMustPreserveInvariantIds: ["invariant:stable"],
      failedInvariantIds: [],
      evidenceIds: ["preservation:pass"],
      receipt: {
        contractId: "preserve:tx-1",
        transactionId: "tx-1",
        passed: true,
        verifiedMustChangeInvariantIds: ["invariant:ready"],
        verifiedMustPreserveInvariantIds: ["invariant:stable"],
        evidenceIds: ["preservation:pass"],
      },
      reasons: ["passed"],
    },
    "tx-1",
    {
      decisionId: "decision-preservation",
      basis,
      upstreamDecisionIds: ["decision-admission"],
    },
  );

  ledger = recordPackageVerificationDecision(
    ledger,
    {
      ok: true,
      packageFingerprint: "pkg",
      source: { sha256: "content", files: 1 },
      extracted: { sha256: "content", files: 1 },
      archiveEntries: 1,
      receipt: {
        transactionId: "tx-1",
        kind: "package",
        passed: true,
        evidenceIds: ["package:pkg"],
      },
    },
    "tx-1",
    {
      decisionId: "decision-package",
      basis,
      upstreamDecisionIds: ["decision-admission"],
    },
  );

  return ledger;
}

describe("decision ledger recording", () => {
  it("records release only after executing a valid release lineage gate", () => {
    const result = recordReleaseDecision(
      ledgerBeforeRelease(),
      lifecycle,
      proof,
      basis,
      {
        decisionId: "decision-release",
        evidenceIds: ["release:proof-complete"],
      },
    );

    expect(result.recorded).toBe(true);
    expect(result.release.decision.disposition)
      .toBe("release-eligible");

    expect(result.ledger.entries.map((entry) => entry.id))
      .toEqual([
        "decision-auth",
        "decision-strategy",
        "decision-admission",
        "decision-runtime",
        "decision-preservation",
        "decision-package",
        "decision-release",
      ]);

    expect(
      result.ledger.entries.at(-1)
        ?.upstreamDecisionIds,
    ).toEqual([
      "decision-admission",
      "decision-auth",
      "decision-package",
      "decision-preservation",
      "decision-runtime",
      "decision-strategy",
    ]);

    const runtimeEntry = result.ledger.entries.find(
      (entry) => entry.id === "decision-runtime",
    );
    expect(runtimeEntry?.inputIds).toEqual(
      expect.arrayContaining([
        "runtime-experiment:exp:chunk",
        "runtime-experiment-revision:rev-2",
        "runtime-target-profile:profile-a",
        "runtime-fixture:fixture-a",
        "runtime-predicate:target-ready",
      ]),
    );
    expect(runtimeEntry?.outputIds).toContain(
      "runtime-verification-contract:exp:chunk@rev-2",
    );
  });

  it("does not record release admission when lineage gate blocks", () => {
    const staleBasis = {
      ...basis,
      graphFingerprint: "graph-new",
    };

    const result = recordReleaseDecision(
      ledgerBeforeRelease(),
      lifecycle,
      proof,
      staleBasis,
      {
        decisionId: "decision-release",
      },
    );

    expect(result.recorded).toBe(false);
    expect(result.release.decision.disposition)
      .toBe("blocked");
    expect(
      result.ledger.entries.some(
        (entry) => entry.kind === "release-admission",
      ),
    ).toBe(false);
    expect(
      result.ledger.entries.every(
        (entry) => entry.status === "invalidated",
      ),
    ).toBe(true);
  });
  it("records repair realization coverage with realizer registry revision", () => {
    const ledger = recordRepairRealizationCoverage(
      createDecisionLedger(),
      {
        incidentId: "incident-1",
        candidateId: "candidate-1",
        items: [{
          sourceKind: "built-in-planner",
          sourceId: "session-generation-guard-template",
          sourceVersion: "1",
          disposition: "missing-realizer",
          reasons: ["No concrete realizer."],
        }],
        realizedCount: 0,
        blockedCount: 0,
        proposalOnlyCount: 0,
        missingRealizerCount: 1,
        noImplementationCoverage: true,
      },
      {
        decisionId: "decision-realization",
        basis: {
          repairRealizerRegistryRevision:
            "realizers-r1",
        },
      },
    );

    expect(ledger.entries[0]).toMatchObject({
      kind: "repair-strategy-realization",
      incidentId: "incident-1",
      basis: {
        repairRealizerRegistryRevision:
          "realizers-r1",
      },
    });
    expect(ledger.entries[0]?.outputIds).toEqual(
      expect.arrayContaining([
        "repair-realization:missing-realizer:1",
        "repair-realization:no-implementation-coverage:true",
        "repair-realization-source:session-generation-guard-template@1:missing-realizer",
      ]),
    );

    expect(() =>
      recordRepairRealizationCoverage(
        createDecisionLedger(),
        {
          incidentId: "incident-1",
          candidateId: "candidate-1",
          items: [],
          realizedCount: 0,
          blockedCount: 0,
          proposalOnlyCount: 0,
          missingRealizerCount: 0,
          noImplementationCoverage: true,
        },
        {
          decisionId: "missing-realizer-revision",
          basis: {},
        },
      )
    ).toThrow(/repairRealizerRegistryRevision/);
  });

  it("rejects runtime decision recording without evidence revision", () => {
    expect(() => recordDiagnosticRepairDecision(
      createDecisionLedger(),
      {
        incidentId: "incident-1",
        activeCandidateIds: ["candidate-1"],
        disposition: "repair-eligible",
        selectedCandidateId: "candidate-1",
        effectiveEvidenceLevel:
          "proven-with-observed-outcome",
        claimStrength: "proven-runtime",
        reasons: ["proof"],
      },
      {
        decisionId: "missing-evidence-basis",
        basis: {
          sourceFingerprint: "source-a",
          graphFingerprint: "graph-a",
        },
      },
    )).toThrow(/runtimeEvidenceRevision/);

    expect(() => recordRuntimeVerificationDecision(
      createDecisionLedger(),
      {
        passed: true,
        satisfiedStateRequirementIds: [],
        failedStateRequirementIds: [],
        temporalAssessments: [],
        evidenceIds: [],
        receipt: {
          transactionId: "tx-1",
          kind: "runtime",
          passed: true,
          evidenceIds: [],
        },
        reasons: [],
      },
      "tx-1",
      {
        decisionId: "runtime-missing-evidence-basis",
        basis: {},
      },
    )).toThrow(/runtimeEvidenceRevision/);
  });
});
}
}

// Original engine/packages/orchestrator/test/workflow/engineering-review.test.ts; blob 931aa4373610064e754ee6a81bdbe4e9ead8bf62
{
// Source-preserving consolidation: original test cases remain in isolated lexical blocks.

// Consolidated suite from engine/packages/orchestrator/test/workflow/engineering-review-invalidation.test.ts
{
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
}

// Consolidated suite from engine/packages/orchestrator/test/workflow/engineering-review-priority.test.ts
{
const emptyRuntime = {
  "confirmed-defect": 0,
  "design-review": 0,
  "designed-behavior": 0,
  "engine-constraint": 0,
  "compatibility-difference": 0,
  "insufficient-evidence": 0,
  "ambiguous-intent": 0,
  "runtime-proof-required": 0,
} as const;

describe("engineering review priority", () => {
  it("puts stale blocking proof above defects and diagnostics", () => {
    const priority = buildEngineeringReviewPriority({
      runtimeClassifications: {
        ...emptyRuntime,
        "confirmed-defect": 1,
        "design-review": 2,
      },
      diagnostics: [{
        id: "diag:1",
        code: "CROSS_SCOPE_STATE_RISK",
        severity: "critical",
        message: "critical",
      }],
      evidenceRecovery: {
        required: false,
        actions: [],
        blocksCurrentStateClaims: false,
        blocksTemporalClaims: false,
        blocksFullRepairAuthorization: false,
      },
      invalidation: {
        items: [{
          id: "validation:run:1:0",
          source: "validation",
          category: "validation-artifact-changed",
          summary: "Artifact changed.",
          reason: "artifact fingerprint changed since this validation run",
          nextAction: "rerun-validation",
          blocking: true,
          validationRunId: "run:1",
        }],
        invalidatedDecisionCount: 0,
        supersededDecisionCount: 0,
        staleValidationRunCount: 1,
        blockingCount: 1,
      },
      repairCandidates: [],
    });

    expect(priority.items.map((item) => item.lane)).toEqual([
      "blocking-proof",
      "confirmed-defect",
      "critical-diagnostic",
      "design-review",
    ]);
    expect(priority.hasBlockingProofGap).toBe(true);
  });

  it("does not treat critical diagnostics as confirmed defects", () => {
    const priority = buildEngineeringReviewPriority({
      runtimeClassifications: emptyRuntime,
      diagnostics: [{
        id: "diag:1",
        code: "CROSS_SCOPE_STATE_RISK",
        severity: "critical",
        message: "critical",
      }],
      evidenceRecovery: {
        required: false,
        actions: [],
        blocksCurrentStateClaims: false,
        blocksTemporalClaims: false,
        blocksFullRepairAuthorization: false,
      },
      invalidation: {
        items: [],
        invalidatedDecisionCount: 0,
        supersededDecisionCount: 0,
        staleValidationRunCount: 0,
        blockingCount: 0,
      },
      repairCandidates: [],
    });

    expect(priority.hasCriticalDiagnostic).toBe(true);
    expect(priority.hasConfirmedDefect).toBe(false);
    expect(priority.items.map((item) => item.kind)).toEqual([
      "critical-diagnostic",
    ]);
  });

  it("orders evidence recovery before probable defects and planned repairs", () => {
    const priority = buildEngineeringReviewPriority({
      runtimeClassifications: {
        ...emptyRuntime,
        "design-review": 1,
        "runtime-proof-required": 1,
      },
      diagnostics: [],
      evidenceRecovery: {
        required: true,
        actions: [{
          id: "recover:1",
          channel: "runtime-probe",
          kind: "rerun-runtime-probe-bundle",
          priority: "high",
          requiredContext: "LIVE_MINECRAFT",
          blocks: ["full-repair-authorization"],
          reason: "missing proof",
        }],
        blocksCurrentStateClaims: false,
        blocksTemporalClaims: true,
        blocksFullRepairAuthorization: true,
      },
      invalidation: {
        items: [],
        invalidatedDecisionCount: 0,
        supersededDecisionCount: 0,
        staleValidationRunCount: 0,
        blockingCount: 0,
      },
      repairCandidates: [{
        kind: "linear-topology-outlier",
        diagnosticCode: "TOPOLOGY_TRANSLATION_OUTLIER",
        sourcePath: "functions/test.mcfunction",
        status: "proposal",
      }],
    });

    expect(priority.items.map((item) => item.kind)).toEqual([
      "evidence-recovery",
      "runtime-proof-required",
      "design-review",
      "proposed-repair",
    ]);
  });
});
}

// Consolidated suite from engine/packages/orchestrator/test/workflow/engineering-review-projection.test.ts
{
function sourceFixture(): EngineeringReviewSource {
  return {
    artifactId: "art_demo",
    fingerprint: "f".repeat(64),
    archiveEntries: 12,
    targetCompatibility: {
      edition: "education",
      version: "1.26.40",
      educationFeatures: "enabled",
    },
    gameplayIntent: {
      model: {
        schemaVersion: 1,
        id: "intent:demo",
        artifactId: "art_demo",
        evidence: [],
        nodes: [],
        edges: [],
        invariants: [],
        unknowns: [{
          id: "unknown:1",
          question: "Whether reconnect should resume or reset the active round.",
          blockedSubjectIds: ["session"],
        }],
      },
      contractSourceFiles: 1,
      nodes: 4,
      authoredNodes: 2,
      inferredNodes: 2,
      hypothesisNodes: 0,
      invariants: 1,
      unknowns: 1,
    },
    gameplayIntentRuntime: {
      assessments: [
        {
          outcomeObservation: { outcomeId: "outcome:session", evidenceId: "obs:1" },
          observationNeeds: [],
          result: {
            disposition: "design-review",
            subjectIds: ["session"],
            basisInvariantIds: ["inv:1"],
            evidenceIds: ["ev:1"],
            nextEvidenceNeed: "intent-grounding",
            reasons: ["Observed evidence contradicts inferred intent."],
          },
        },
        {
          outcomeObservation: { outcomeId: "outcome:scheduler", evidenceId: "obs:2" },
          observationNeeds: [],
          result: {
            disposition: "runtime-proof-required",
            subjectIds: ["scheduler"],
            basisInvariantIds: [],
            evidenceIds: ["ev:2"],
            nextEvidenceNeed: "runtime-proof",
            reasons: ["Runtime proof is required."],
          },
        },
      ],
      routeAssessments: [],
      routeStallAssessments: [],
      designedBehavior: 0,
      confirmedDefects: 0,
      ambiguousIntent: 0,
      insufficientEvidence: 0,
      runtimeStateObservations: 0,
      runtimeOutcomeObservations: 2,
      runtimeRouteObservations: 0,
      routeResolved: 0,
      routeAmbiguous: 0,
      routeUnresolved: 0,
      runtimeNavigationStallObservations: 0,
      runtimeNavigationTargetObservations: 0,
      runtimeRouteReachabilityObservations: 0,
      runtimeRouteChunkAvailabilityObservations: 0,
      routeEvidenceSatisfied: 0,
      routeInstrumentationRequired: 0,
      routeProbeRequests: 0,
      routeEvidenceBlocked: 0,
      stallTargetNearestMatch: 0,
      stallTargetNearestDivergence: 0,
      stallAmbiguous: 0,
      stallUnresolved: 0,
      stallRouteContextIncomplete: 0,
      stallTargetAssignmentDivergence: 0,
      stallRouteChunkUnavailable: 0,
      stallRouteUnreachable: 0,
      stallNavigationTargetDivergence: 0,
      stallNavigationRuntimeSuspect: 0,
      stallEvidenceIncomplete: 0,
      stallEntityAiStackIncomplete: 0,
      routeSupportedCandidates: 0,
      routeUnresolvedCandidates: 0,
      routeCauseSupportedStops: 0,
      navigationRuntimeCandidateIsolatedStops: 0,
      routeEvidenceCollectionContinuingStops: 0,
    },
    causalAnalysis: {
      chains: [],
      highConfidence: 0,
      mediumConfidence: 1,
      lowConfidence: 0,
      projectedRisks: 0,
      corroboratedRisks: 0,
      observedOutcomes: 1,
      incidents: [{
        id: "incident:1",
        scopeKey: "arena:A",
        severity: "medium",
        confidence: "medium",
        chainIds: ["chain:1"],
        relatedDiagnosticIds: ["diag:1"],
        nodes: [],
        links: [],
        rootCauseCandidates: [{
          id: "root:1",
          label: "Session cleanup ordering",
          evidenceLevel: "corroborated-candidate",
          severity: "medium",
          confidence: "medium",
          chainIds: ["chain:1"],
          relatedDiagnosticIds: ["diag:1"],
          support: {
            dependencyViolations: 0,
            evidenceGaps: 1,
            corroboratedRisks: 1,
            observedOutcomes: 1,
          },
        }],
      }],
      rootCauseCandidates: 1,
    },
    evidenceRecovery: {
      required: true,
      actions: [{
        id: "recover:1",
        channel: "runtime-probe",
        kind: "rerun-runtime-probe-bundle",
        priority: "medium",
        requiredContext: "LIVE_MINECRAFT",
        blocks: ["full-repair-authorization"],
        reason: "Probe exchange was incomplete.",
      }],
      blocksCurrentStateClaims: false,
      blocksTemporalClaims: true,
      blocksFullRepairAuthorization: true,
    },
    repairCandidates: [{
      kind: "linear-topology-outlier",
      diagnosticCode: "TOPOLOGY_TRANSLATION_OUTLIER",
      sourcePath: "functions/a.mcfunction",
      status: "proposal",
    }],
    diagnostics: [{
      id: "diag:1",
      code: "CROSS_SCOPE_STATE_RISK",
      severity: "critical",
      message: "Cross-scope mutation is not isolated.",
      relatedNodeIds: ["session"],
    }],
    decisionBasis: {} as never,
  };
}

describe("engineering review projection", () => {
  it("projects canonical inspection truth without promoting probable defects", () => {
    const review = buildEngineeringReviewProjection(sourceFixture());

    expect(review.schemaVersion).toBe(1);
    expect(review.artifact.id).toBe("art_demo");
    expect(review.understanding.unknowns).toHaveLength(1);
    expect(review.runtimeClassifications["design-review"]).toBe(1);
    expect(review.runtimeClassifications["confirmed-defect"]).toBe(0);
    expect(review.runtimeClassifications["runtime-proof-required"]).toBe(1);
    expect(review.runtimeAssessments).toEqual([
      {
        id: "runtime:outcome:session:obs:1",
        outcomeId: "outcome:session",
        disposition: "design-review",
        subjectIds: ["session"],
        basisInvariantIds: ["inv:1"],
        evidenceIds: ["ev:1"],
        nextEvidenceNeed: "intent-grounding",
        reasons: ["Observed evidence contradicts inferred intent."],
      },
      {
        id: "runtime:outcome:scheduler:obs:2",
        outcomeId: "outcome:scheduler",
        disposition: "runtime-proof-required",
        subjectIds: ["scheduler"],
        basisInvariantIds: [],
        evidenceIds: ["ev:2"],
        nextEvidenceNeed: "runtime-proof",
        reasons: ["Runtime proof is required."],
      },
    ]);
    expect(review.incidents[0]?.rootCauseCandidates[0]?.label).toBe(
      "Session cleanup ordering",
    );
    expect(review.attention.map((item) => item.kind)).toEqual([
      "critical-diagnostic",
      "design-review",
      "runtime-proof-required",
      "evidence-recovery",
      "proposed-repair",
    ]);
    expect(review.priority.items.map((item) => item.kind)).toEqual([
      "critical-diagnostic",
      "evidence-recovery",
      "runtime-proof-required",
      "design-review",
      "proposed-repair",
    ]);
    expect(review.priority.hasCriticalDiagnostic).toBe(true);
    expect(review.priority.hasConfirmedDefect).toBe(false);
  });

  it("keeps repair planning distinct from verification", () => {
    const review = buildEngineeringReviewProjection(sourceFixture());

    expect(review.repairCandidates).toEqual([
      {
        kind: "linear-topology-outlier",
        diagnosticCode: "TOPOLOGY_TRANSLATION_OUTLIER",
        sourcePath: "functions/a.mcfunction",
        status: "proposal",
      },
    ]);
    expect(
      review.attention.find((item) => item.kind === "proposed-repair")?.reason,
    ).toContain("not authorized, applied, or verified");
  });
});
}
}

// Original engine/packages/orchestrator/test/workflow/selective-validation-plan.test.ts; blob 5f92bf65b14abde305841b6523b8f3ea787e97bf
{
const scenarios:
  readonly ValidationScenario[] = [
  {
    schemaVersion: 1,
    id: "scenario:arena",
    revision: "1",
    title: "Arena lifecycle",
    intentInvariantIds: ["arena"],
    steps: [{ kind: "rebuild-graph" }],
    requiredProofLevel:
      "STATIC VERIFIED",
  },
  {
    schemaVersion: 1,
    id: "scenario:shop",
    revision: "1",
    title: "Shop behavior",
    intentInvariantIds: ["shop"],
    steps: [{ kind: "rebuild-graph" }],
    requiredProofLevel:
      "STATIC VERIFIED",
  },
  {
    schemaVersion: 1,
    id: "scenario:unbound",
    revision: "1",
    title: "Legacy conservative",
    intentInvariantIds: ["legacy"],
    steps: [{ kind: "rebuild-graph" }],
    requiredProofLevel:
      "STATIC VERIFIED",
  },
];

function affected():
  SemanticAffectedPlan {
  return {
    status: "planned",
    changedNodeIds: ["node:arena"],
    affectedNodeIds: [
      "node:arena",
      "node:caller",
    ],
    skippedNodeIds: [
      "node:shop",
      "node:other",
    ],
    affectedPaths: [
      "scripts/arena.ts",
    ],
    knownPaths: [
      "scripts/arena.ts",
      "scripts/shop.ts",
    ],
    totalNodeCount: 4,
    changedNodeCount: 1,
    affectedNodeCount: 2,
    skippedNodeCount: 2,
    skipRatio: 0.5,
    reasons: [],
  };
}

describe("selective validation planning", () => {
  it("runs affected scenarios, skips proven-unaffected scenarios, and keeps unbound scenarios conservative", () => {
    const plan =
      planSelectiveValidation(
        scenarios,
        [
          {
            scenarioId:
              "scenario:arena",
            semanticNodeIds: [
              "node:arena",
            ],
          },
          {
            scenarioId:
              "scenario:shop",
            semanticNodeIds: [
              "node:shop",
            ],
          },
        ],
        affected(),
      );

    expect(plan.status).toBe(
      "planned",
    );
    expect(
      plan.selected.map(
        (item) => item.scenarioId,
      ),
    ).toEqual([
      "scenario:arena",
      "scenario:unbound",
    ]);
    expect(
      plan.skipped.map(
        (item) => item.scenarioId,
      ),
    ).toEqual([
      "scenario:shop",
    ]);
    expect(plan.skipRatio)
      .toBeCloseTo(1 / 3);
  });

  it("supports source-path bindings and always-run safety scenarios", () => {
    const plan =
      planSelectiveValidation(
        scenarios.slice(0, 2),
        [
          {
            scenarioId:
              "scenario:arena",
            sourcePaths: [
              "scripts/arena.ts",
            ],
          },
          {
            scenarioId:
              "scenario:shop",
            alwaysRun: true,
            reason:
              "release smoke coverage",
          },
        ],
        affected(),
      );

    expect(plan.selected)
      .toHaveLength(2);
    expect(
      plan.selected[0]?.reason,
    ).toBe("affected-path");
    expect(
      plan.selected[1]?.reason,
    ).toBe("always-run");
    expect(plan.skipped)
      .toHaveLength(0);
  });

  it("blocks selective skipping when bindings contain stale source paths", () => {
    const plan =
      planSelectiveValidation(
        scenarios.slice(0, 1),
        [{
          scenarioId:
            "scenario:arena",
          sourcePaths: [
            "scripts/missing.ts",
          ],
        }],
        affected(),
      );

    expect(plan.status)
      .toBe("blocked");
    expect(plan.errors.join(" "))
      .toMatch(/source path absent/);
  });

  it("blocks selective skipping when bindings contain stale semantic nodes", () => {
    const plan =
      planSelectiveValidation(
        scenarios.slice(0, 1),
        [{
          scenarioId:
            "scenario:arena",
          semanticNodeIds: [
            "node:missing",
          ],
        }],
        affected(),
      );

    expect(plan.status).toBe(
      "blocked",
    );
    expect(plan.skipped)
      .toHaveLength(0);
    expect(plan.errors.join(" "))
      .toMatch(/absent/);
  });

  it("explains selected and skipped work", () => {
    const plan =
      planSelectiveValidation(
        scenarios,
        [
          {
            scenarioId:
              "scenario:arena",
            semanticNodeIds: [
              "node:arena",
            ],
          },
          {
            scenarioId:
              "scenario:shop",
            semanticNodeIds: [
              "node:shop",
            ],
          },
        ],
        affected(),
      );

    const text =
      selectiveValidationPlanText(
        plan,
      );

    expect(text)
      .toContain("Selected: 2");
    expect(text)
      .toContain("Skipped: 1");
    expect(text)
      .toContain("scenario:shop");
    expect(text)
      .toContain(
        "outside the affected closure",
      );
  });
});
}

// Original engine/packages/orchestrator/test/workflow/semantic-affected-plan.test.ts; blob 1aeed4a3ea976094f5a440e40f5b5fd2c6c544ec
{
function authorizedFixture() {
  const decision = authorizeRepair({
    confirmedDefect: true,
    diagnosisEvidenceIds: ["test:changed-source"],
    invariantIds: ["fixture:changed-function"],
    sourceFingerprint: "source",
    sourceFingerprintMatches: true,
    evidenceFreshness: "fresh",
  });
  if (!decision.receipt) throw new Error("Fixture repair authorization rejected.");
  return decision.receipt;
}

function graphFixture(): SemanticGraph {
  const graph = new SemanticGraph();

  for (const identifier of [
    "caller",
    "changed",
    "callee",
    "unrelated",
  ]) {
    graph.addNode({
      id: "function:pack:" + identifier,
      identity: {
        kind: "function",
        scope: "pack",
        identifier,
      },
      kind: "function",
      identifier,
      source: {
        artifactId: "map",
        relativePath:
          "functions/" +
          identifier +
          ".mcfunction",
      },
    });
  }

  graph.addNode({
    id: "structure:pack:arena-structure",
    identity: {
      kind: "structure",
      scope: "pack",
      identifier: "arena-structure",
    },
    kind: "structure",
    identifier: "arena-structure",
    source: {
      artifactId: "map",
      relativePath:
        "structures/arena.mcstructure",
    },
  });

  graph.addNode({
    id: "scoreboard:pack:round",
    identity: {
      kind: "scoreboard_objective",
      scope: "pack",
      identifier: "round",
    },
    kind: "scoreboard_objective",
    identifier: "round",
    source: {
      artifactId: "map",
      relativePath: "<derived>",
    },
  });

  graph.addEdge({
    from: "function:pack:caller",
    type: "CALLS",
    targetIdentifier: "changed",
    status: "resolved",
    to: "function:pack:changed",
    evidence: {
      source: {
        artifactId: "map",
        relativePath:
          "functions/caller.mcfunction",
      },
    },
  });

  graph.addEdge({
    from: "function:pack:changed",
    type: "CALLS",
    targetIdentifier: "callee",
    status: "resolved",
    to: "function:pack:callee",
    evidence: {
      source: {
        artifactId: "map",
        relativePath:
          "functions/changed.mcfunction",
      },
    },
  });

  graph.addEdge({
    from: "function:pack:changed",
    type: "LOADS_STRUCTURE",
    targetIdentifier:
      "arena-structure",
    status: "resolved",
    to:
      "structure:pack:arena-structure",
    evidence: {
      source: {
        artifactId: "map",
        relativePath:
          "functions/changed.mcfunction",
      },
    },
  });

  graph.addEdge({
    from: "function:pack:changed",
    type: "WRITES_SCOREBOARD",
    targetIdentifier: "round",
    status: "resolved",
    to: "scoreboard:pack:round",
    evidence: {
      source: {
        artifactId: "map",
        relativePath:
          "functions/changed.mcfunction",
      },
    },
  });

  return graph;
}

describe("semantic affected planning", () => {
  it("includes changed nodes, mutation targets, and reverse dependents without pulling ordinary callees", () => {
    const result =
      planSemanticAffectedSet(
        graphFixture(),
        ["function:pack:changed"],
      );

    expect(result.status).toBe(
      "planned",
    );
    expect(result.affectedNodeIds)
      .toEqual([
        "function:pack:caller",
        "function:pack:changed",
        "scoreboard:pack:round",
        "structure:pack:arena-structure",
      ]);
    expect(result.skippedNodeIds)
      .toEqual([
        "function:pack:callee",
        "function:pack:unrelated",
      ]);
    expect(result.skippedNodeCount)
      .toBe(2);
    expect(result.skipRatio)
      .toBeCloseTo(2 / 6);
  });

  it("derives the affected closure directly from patch source references", () => {
    const transaction:
      PatchTransaction = {
      id: "patch:1",
      title: "change function",
      sourceFingerprint: "source",
      authorization: authorizedFixture(),
      operations: [{
        kind: "replace-command",
        source: {
          artifactId: "map",
          relativePath:
            "functions/changed.mcfunction",
        },
        expected: "say old",
        replacement: "say new",
      }],
      preconditions: [],
      validation: [],
      affectedPaths: [
        "functions/changed.mcfunction",
      ],
    };

    const result =
      planPatchSemanticAffectedSet(
        graphFixture(),
        transaction,
      );

    expect(result.status).toBe(
      "planned",
    );
    expect(result.changedNodeIds)
      .toEqual([
        "function:pack:changed",
      ]);
    expect(result.affectedNodeIds)
      .toContain(
        "function:pack:caller",
      );
    expect(result.affectedNodeIds)
      .toContain(
        "scoreboard:pack:round",
      );
    expect(result.affectedNodeIds)
      .toContain(
        "structure:pack:arena-structure",
      );
    expect(result.skippedNodeIds)
      .toEqual([
        "function:pack:callee",
        "function:pack:unrelated",
      ]);
  });

  it("blocks selective validation when a patch operation cannot bind to the graph", () => {
    const transaction:
      PatchTransaction = {
      id: "patch:missing",
      title: "unknown source",
      sourceFingerprint: "source",
      authorization: authorizedFixture(),
      operations: [{
        kind: "replace-command",
        source: {
          artifactId: "map",
          relativePath:
            "functions/missing.mcfunction",
        },
        expected: "say old",
        replacement: "say new",
      }],
      preconditions: [],
      validation: [],
      affectedPaths: [
        "functions/missing.mcfunction",
      ],
    };

    const result =
      planPatchSemanticAffectedSet(
        graphFixture(),
        transaction,
      );

    expect(result.status).toBe(
      "blocked",
    );
    expect(
      result.unmatchedOperationPaths,
    ).toEqual([
      "functions/missing.mcfunction",
    ]);
  });
});
}
