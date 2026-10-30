// Source-preserving consolidation: original test cases remain in isolated lexical blocks.
import { describe, expect, it } from "vitest";
import { activeDecisionLedgerEntries, appendDecisionLedgerEntry, createDecisionLedger, invalidateStaleDecisionLedger, supersedeDecisionLedgerEntry } from "../../src/workflow/decision-ledger.js";
import { recordDiagnosticRepairDecision, recordPackageVerificationDecision, recordPreservationVerificationDecision, recordReleaseDecision, recordRepairAdmissionDecision, recordRepairRealizationCoverage, recordRuntimeVerificationDecision } from "../../src/workflow/decision-ledger-recording.js";
import type { RepairLifecycleState } from "../../src/repair/repair-lifecycle.js";
import type { RepairProofBundle } from "../../src/repair/repair-proof-bundle.js";
import { CONTRACT_REGISTRY_REVISION } from "../../../project-model/src/index.js";

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
