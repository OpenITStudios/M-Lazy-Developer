import { describe, expect, it } from "vitest";
import {
  appendDecisionLedgerEntry,
  createDecisionLedger,
} from "../../src/workflow/decision-ledger.js";
import {
  decideRepairReleaseWithLineage,
} from "../../src/repair/repair-release-lineage.js";
import type {
  RepairLifecycleState,
} from "../../src/repair/repair-lifecycle.js";
import type {
  RepairProofBundle,
} from "../../src/repair/repair-proof-bundle.js";
import {
  CONTRACT_REGISTRY_REVISION,
} from "../../../project-model/src/index.js";

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

const basis = {
  contractRegistryRevision: CONTRACT_REGISTRY_REVISION,
  sourceFingerprint: "source",
  graphFingerprint: "graph",
  invariantRegistryRevision: "inv-r1",
  runtimeEvidenceRevision: "runtime-r1",
  preservationContractRevision: "preservation-contract-r1",
  preservationBaselineRevision: "preservation-baseline-r1",
};

function proof(
  overrides: Partial<RepairProofBundle> = {},
): RepairProofBundle {
  return {
    transactionId: "tx-1",
    sourceFingerprint: "source",
    graphFingerprint: "graph",
    decisionBasis: basis,
    incidentId: "incident-1",
    selectedCandidateId: "cause-1",
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
    changedNodeIds: ["function:p:target"],
    affectedNodeIds: ["function:p:target"],
    requiredRevalidationNodeIds: [],
    requiredRevalidationPaths: [],
    impactTraces: [],
    reasons: [],
    ...overrides,
  };
}

function completeLedger(
  repairProof = proof(),
  options: {
    includeTransitive?: boolean;
    verificationParent?: "admission" | "transitive" | "strategy";
  } = {},
) {
  let ledger = createDecisionLedger();

  ledger = appendDecisionLedgerEntry(ledger, {
    id: "auth",
    kind: "repair-authorization",
    incidentId: "incident-1",
    basis,
    outputIds: [
      "repair-disposition:repair-eligible",
      "root-cause:cause-1",
    ],
  });

  ledger = appendDecisionLedgerEntry(ledger, {
    id: "strategy",
    kind: "repair-strategy-selection",
    transactionId: "tx-1",
    basis,
    upstreamDecisionIds: ["auth"],
    outputIds: [
      "repair-strategy:selected",
      "repair-strategy:small",
      "repair-transaction:tx-1",
      ...repairProof.supportingInvariantIds.map(
        (id) => "repair-invariant:" + id,
      ),
    ],
  });

  ledger = appendDecisionLedgerEntry(ledger, {
    id: "admission",
    kind: "repair-admission",
    transactionId: "tx-1",
    basis,
    upstreamDecisionIds: ["strategy"],
    outputIds: ["repair-admission:eligible"],
  });

  const includeTransitive =
    options.includeTransitive === true;
  if (includeTransitive) {
    ledger = appendDecisionLedgerEntry(ledger, {
      id: "transitive",
      kind: "transitive-revalidation",
      transactionId: "tx-1",
      basis,
      upstreamDecisionIds: ["admission"],
      inputIds: [
        ...repairProof.requiredRevalidationNodeIds.map(
          (id) => "revalidation-node:" + id,
        ),
        ...repairProof.requiredRevalidationPaths.map(
          (value) => "revalidation-path:" + value,
        ),
      ],
      outputIds: ["transitive-revalidation:passed"],
      evidenceIds: ["static:dependent-pass"],
    });
  }

  const verificationParent =
    options.verificationParent ??
    (includeTransitive ? "transitive" : "admission");

  ledger = appendDecisionLedgerEntry(ledger, {
    id: "runtime",
    kind: "runtime-verification",
    transactionId: "tx-1",
    basis,
    upstreamDecisionIds: [verificationParent],
    outputIds: ["runtime-verification:passed"],
    evidenceIds: ["runtime:pass"],
  });

  ledger = appendDecisionLedgerEntry(ledger, {
    id: "preservation",
    kind: "preservation-verification",
    transactionId: "tx-1",
    basis,
    upstreamDecisionIds: [verificationParent],
    inputIds: [
      "must-change-invariant:invariant:ready",
      "must-preserve-invariant:invariant:stable",
    ],
    outputIds: ["preservation-verification:passed"],
    evidenceIds: ["preservation:pass"],
  });

  ledger = appendDecisionLedgerEntry(ledger, {
    id: "package",
    kind: "package-verification",
    transactionId: "tx-1",
    basis,
    upstreamDecisionIds: [verificationParent],
    outputIds: ["package-verification:passed"],
    evidenceIds: ["package:pass"],
  });

  return ledger;
}

describe("repair release lineage", () => {
  it("allows release only with a complete active proof chain", () => {
    const repairProof = proof();
    const result = decideRepairReleaseWithLineage(
      lifecycle,
      repairProof,
      completeLedger(repairProof),
      basis,
    );

    expect(result.decision.disposition)
      .toBe("release-eligible");
    expect(result.lineageDecisionIds).toEqual([
      "admission",
      "auth",
      "package",
      "preservation",
      "runtime",
      "strategy",
    ]);
  });

  it("blocks release when lifecycle claims runtime complete without covering the authorizing experiment envelope", () => {
    const repairProof = proof({
      causalInterventionProvenance: [{
        interventionId: "exp:chunk",
        experimentRevision: "rev-1",
        predicateId: "chunk-ready",
        controlledFactorIds: ["chunk-loaded"],
        controlledFactorContrasts: [{
          factorId: "chunk-loaded",
          controlValue: false,
          treatmentValue: true,
        }],
        controlState: "absent",
        treatmentState: "present",
        expectedContrastDisposition: "matched",
        targetProfileFingerprint: "profile-a",
        fixtureFingerprint: "fixture-a",
        evidenceIds: ["runtime:chunk"],
      }],
    });

    const result = decideRepairReleaseWithLineage(
      lifecycle,
      repairProof,
      completeLedger(repairProof),
      basis,
    );

    expect(result.decision.disposition).toBe("blocked");
    expect(result.decision.reasons.join(" "))
      .toMatch(/complete repair-authorizing experiment envelope/i);
  });

  it("blocks guarded intervention proof from release", () => {
    const repairProof = proof({
      diagnosticDisposition: "guarded-repair-eligible",
      proofState: "intervention-supported",
      admissionDisposition: "guarded",
    });
    const result = decideRepairReleaseWithLineage(
      lifecycle,
      repairProof,
      completeLedger(proof()),
      basis,
    );

    expect(result.decision.disposition).toBe("blocked");
    expect(result.decision.reasons.join(" "))
      .toMatch(/causal root-cause proof/);
  });

  it("blocks stale proof and returns transitively invalidated lineage", () => {
    const repairProof = proof();
    const result = decideRepairReleaseWithLineage(
      lifecycle,
      repairProof,
      completeLedger(repairProof),
      {
        ...basis,
        graphFingerprint: "graph-new",
      },
    );

    expect(result.decision.disposition).toBe("blocked");
    expect(
      result.ledger.entries.every(
        (entry) => entry.status === "invalidated",
      ),
    ).toBe(true);
    expect(result.decision.reasons.join(" "))
      .toMatch(/decision basis is stale/);
  });

  it("blocks release when strategy selection is missing", () => {
    const repairProof = proof();
    let ledger = createDecisionLedger();

    ledger = appendDecisionLedgerEntry(ledger, {
      id: "auth",
      kind: "repair-authorization",
      basis,
      outputIds: ["root-cause:cause-1"],
    });
    ledger = appendDecisionLedgerEntry(ledger, {
      id: "admission",
      kind: "repair-admission",
      transactionId: "tx-1",
      basis,
      upstreamDecisionIds: ["auth"],
      outputIds: ["repair-admission:eligible"],
    });
    ledger = appendDecisionLedgerEntry(ledger, {
      id: "runtime",
      kind: "runtime-verification",
      transactionId: "tx-1",
      basis,
      upstreamDecisionIds: ["admission"],
      outputIds: ["runtime-verification:passed"],
    });
    ledger = appendDecisionLedgerEntry(ledger, {
      id: "preservation",
      kind: "preservation-verification",
      transactionId: "tx-1",
      basis,
      upstreamDecisionIds: ["admission"],
      outputIds: ["preservation-verification:passed"],
      evidenceIds: ["preservation:pass"],
    });
    ledger = appendDecisionLedgerEntry(ledger, {
      id: "package",
      kind: "package-verification",
      transactionId: "tx-1",
      basis,
      upstreamDecisionIds: ["admission"],
      outputIds: ["package-verification:passed"],
    });

    const result = decideRepairReleaseWithLineage(
      lifecycle,
      repairProof,
      ledger,
      basis,
    );

    expect(result.decision.disposition).toBe("blocked");
    expect(result.decision.reasons.join(" "))
      .toMatch(/Missing active repair-strategy-selection/);
  });

  it("allows multiple active runtime verification decisions when all are passing and share the valid lineage", () => {
    const repairProof = proof();
    let ledger = completeLedger(repairProof);
    ledger = appendDecisionLedgerEntry(ledger, {
      id: "runtime-secondary",
      kind: "runtime-verification",
      transactionId: "tx-1",
      basis,
      upstreamDecisionIds: ["admission"],
      outputIds: ["runtime-verification:passed"],
      evidenceIds: ["runtime:secondary-pass"],
    });

    const result = decideRepairReleaseWithLineage(
      lifecycle,
      repairProof,
      ledger,
      basis,
    );

    expect(result.decision.disposition)
      .toBe("release-eligible");
    expect(result.lineageDecisionIds).toEqual([
      "admission",
      "auth",
      "package",
      "preservation",
      "runtime",
      "runtime-secondary",
      "strategy",
    ]);
  });

  it("blocks release when any active runtime verification has invalid lineage", () => {
    const repairProof = proof();
    let ledger = completeLedger(repairProof);
    ledger = appendDecisionLedgerEntry(ledger, {
      id: "runtime-invalid-parent",
      kind: "runtime-verification",
      transactionId: "tx-1",
      basis,
      upstreamDecisionIds: ["strategy"],
      outputIds: ["runtime-verification:passed"],
      evidenceIds: ["runtime:secondary-pass"],
    });

    const result = decideRepairReleaseWithLineage(
      lifecycle,
      repairProof,
      ledger,
      basis,
    );

    expect(result.decision.disposition).toBe("blocked");
    expect(result.decision.reasons.join(" "))
      .toMatch(/runtime-invalid-parent.*not descended/i);
  });

  it("blocks release when verification is not descended from admission", () => {
    const repairProof = proof();
    const ledger = completeLedger(
      repairProof,
      { verificationParent: "strategy" },
    );

    const result = decideRepairReleaseWithLineage(
      lifecycle,
      repairProof,
      ledger,
      basis,
    );

    expect(result.decision.disposition).toBe("blocked");
    expect(result.decision.reasons.join(" "))
      .toMatch(/Runtime verification .* is not descended/);
  });

  it("blocks release when strategy lineage omits a proof invariant", () => {
    const repairProof = proof();
    const ledger = completeLedger({
      ...repairProof,
      supportingInvariantIds: [],
    });

    const result = decideRepairReleaseWithLineage(
      lifecycle,
      repairProof,
      ledger,
      basis,
    );

    expect(result.decision.disposition).toBe("blocked");
    expect(result.decision.reasons.join(" "))
      .toMatch(/does not carry supporting invariant/);
  });

  it("requires transitive revalidation lineage when proof has a dependent envelope", () => {
    const repairProof = proof({
      affectedNodeIds: [
        "function:p:target",
        "function:p:caller",
      ],
      requiredRevalidationNodeIds: [
        "function:p:caller",
      ],
      requiredRevalidationPaths: [
        "functions/caller.mcfunction",
      ],
    });

    const missing = decideRepairReleaseWithLineage(
      lifecycle,
      repairProof,
      completeLedger(repairProof),
      basis,
    );
    expect(missing.decision.disposition).toBe("blocked");
    expect(missing.decision.reasons.join(" "))
      .toMatch(/Missing active transitive-revalidation/);

    const complete = decideRepairReleaseWithLineage(
      lifecycle,
      repairProof,
      completeLedger(repairProof, {
        includeTransitive: true,
      }),
      basis,
    );
    expect(complete.decision.disposition)
      .toBe("release-eligible");
    expect(complete.lineageDecisionIds)
      .toContain("transitive");
  });

  it("blocks release when transitive lineage misses required envelope coverage", () => {
    const repairProof = proof({
      affectedNodeIds: [
        "function:p:target",
        "function:p:caller",
      ],
      requiredRevalidationNodeIds: [
        "function:p:caller",
      ],
    });

    let ledger = completeLedger(repairProof, {
      includeTransitive: true,
    });
    ledger = {
      schemaVersion: 1,
      entries: ledger.entries.map((entry) =>
        entry.id === "transitive"
          ? { ...entry, inputIds: [] }
          : entry
      ),
    };

    const result = decideRepairReleaseWithLineage(
      lifecycle,
      repairProof,
      ledger,
      basis,
    );

    expect(result.decision.disposition).toBe("blocked");
    expect(result.decision.reasons.join(" "))
      .toMatch(/does not cover required node/);
  });

  it("blocks lineage entries that omit a proof basis dimension", () => {
    const repairProof = proof();
    const baseLedger = completeLedger(repairProof);
    const ledger = {
      schemaVersion: 1 as const,
      entries: baseLedger.entries.map((entry) =>
        entry.id === "runtime"
          ? {
              ...entry,
              basis: {
                contractRegistryRevision: CONTRACT_REGISTRY_REVISION,
                sourceFingerprint: "source",
                graphFingerprint: "graph",
                runtimeEvidenceRevision: "runtime-r1",
                preservationContractRevision: "preservation-contract-r1",
                preservationBaselineRevision: "preservation-baseline-r1",
              },
            }
          : entry
      ),
    };

    const result = decideRepairReleaseWithLineage(
      lifecycle,
      repairProof,
      ledger,
      basis,
    );

    expect(result.decision.disposition).toBe("blocked");
    expect(result.decision.reasons.join(" "))
      .toMatch(/does not carry current proof basis invariantRegistryRevision/);
  });


  it("blocks release when runtime evidence revision changes", () => {
    const runtimeBasis = {
      ...basis,
      runtimeEvidenceRevision: "runtime-r1",
    };
    const repairProof = proof({
      decisionBasis: runtimeBasis,
    });
    const baseLedger = completeLedger(repairProof);
    const ledger = {
      schemaVersion: 1 as const,
      entries: baseLedger.entries.map((entry) => ({
        ...entry,
        basis: runtimeBasis,
      })),
    };

    const result = decideRepairReleaseWithLineage(
      lifecycle,
      repairProof,
      ledger,
      {
        ...runtimeBasis,
        runtimeEvidenceRevision: "runtime-r2",
      },
    );

    expect(result.decision.disposition).toBe("blocked");
    expect(result.decision.reasons.join(" "))
      .toMatch(/runtimeEvidenceRevision changed/);
    expect(
      result.ledger.entries.every(
        (entry) => entry.status === "invalidated",
      ),
    ).toBe(true);
  });

  it("blocks release when the authorizing runtime experiment envelope revision changes", () => {
    const contractBasis = {
      ...basis,
      runtimeExperimentContractRevision:
        "runtime-experiment-envelope:old",
    };
    const repairProof = proof({
      decisionBasis: contractBasis,
    });
    const baseLedger = completeLedger(repairProof);
    const ledger = {
      schemaVersion: 1 as const,
      entries: baseLedger.entries.map((entry) => ({
        ...entry,
        basis: contractBasis,
      })),
    };

    const result = decideRepairReleaseWithLineage(
      lifecycle,
      repairProof,
      ledger,
      {
        ...contractBasis,
        runtimeExperimentContractRevision:
          "runtime-experiment-envelope:new",
      },
    );

    expect(result.decision.disposition).toBe("blocked");
    expect(result.decision.reasons.join(" "))
      .toMatch(/runtimeExperimentContractRevision changed/);
    expect(
      result.ledger.entries.every(
        (entry) => entry.status === "invalidated",
      ),
    ).toBe(true);
  });

  it("blocks runtime proof that has no evidence revision", () => {
    const repairProof = proof({
      decisionBasis: {
        contractRegistryRevision: CONTRACT_REGISTRY_REVISION,
        sourceFingerprint: "source",
        graphFingerprint: "graph",
        invariantRegistryRevision: "inv-r1",
        preservationContractRevision: "preservation-contract-r1",
        preservationBaselineRevision: "preservation-baseline-r1",
      },
    });

    const result = decideRepairReleaseWithLineage(
      lifecycle,
      repairProof,
      completeLedger(proof()),
      basis,
    );

    expect(result.decision.disposition).toBe("blocked");
    expect(result.decision.reasons.join(" "))
      .toMatch(/runtimeEvidenceRevision/);
  });

  it("blocks provider-bound release without strategy provider provenance", () => {
    const providerBasis = {
      ...basis,
      repairProviderRegistryRevision: "provider-r1",
    };
    const repairProof = proof({
      decisionBasis: providerBasis,
    });
    const baseLedger = completeLedger(repairProof);
    const ledger = {
      schemaVersion: 1 as const,
      entries: baseLedger.entries.map((entry) => ({
        ...entry,
        basis: providerBasis,
      })),
    };

    const result = decideRepairReleaseWithLineage(
      lifecycle,
      repairProof,
      ledger,
      providerBasis,
    );

    expect(result.decision.disposition).toBe("blocked");
    expect(result.decision.reasons.join(" "))
      .toMatch(/requires repair-provider provenance/);
  });

});
