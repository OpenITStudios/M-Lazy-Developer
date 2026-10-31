import { describe, expect, it } from "vitest";
import { SemanticGraph } from "../../../graph/src/index.js";
import { createPatchTransaction } from "../../../repair/src/index.js";
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
  deduplicateRepairStrategyProposals,
  deriveRepairOpportunityEnvelope,
  enumerateRepairStrategySources,
  realizeProviderRepairStrategy,
  repairStrategySemanticFingerprint,
  selectProviderBackedRepairStrategyForIncident,
  type RepairStrategyProviderRegistry,
  type RepairStrategySourceRegistry,
} from "../../src/index.js";
import { fixtureRepairAuthorization } from "../../../repair/test/fixture-authorization.js";

const source = {
  artifactId: "art-1",
  relativePath: "functions/session.mcfunction",
  range: {
    lineStart: 7,
    lineEnd: 7,
  },
};

const chain: CausalChain = {
  id: "chain-1",
  severity: "critical",
  confidence: "high",
  title: "stale session guard",
  summary: "Reconnect stale callback violates session ownership.",
  nodes: [{
    id: "root",
    kind: "observed-state",
    label: "stale callback",
    sourceRefs: [source],
    diagnosticIds: ["diag-session"],
  }, {
    id: "missing-guard",
    kind: "missing-requirement",
    label: "connection generation guard",
  }],
  links: [{
    from: "root",
    to: "missing-guard",
    strength: "direct-evidence",
    relationId: "relation-session-guard",
    rationale: "Deferred mutation requires current session generation.",
  }],
  relatedDiagnosticIds: ["diag-session"],
};

const incident: CausalIncident = {
  id: "incident-1",
  scopeKey: "player-1",
  severity: "critical",
  confidence: "high",
  chainIds: ["chain-1"],
  relatedDiagnosticIds: ["diag-session"],
  nodes: chain.nodes,
  links: chain.links,
  rootCauseCandidates: [{
    id: "cause-session-guard",
    label: "missing connection generation guard",
    evidenceLevel: "proven-with-observed-outcome",
    proof: {
      state: "causal",
      interventionIds: ["exp:reconnect"],
      interventionProvenance: [{
        interventionId: "exp:reconnect",
        experimentRevision: "exp-rev-1",
        predicateId: "stale-session-mutation-observed",
        controlledFactorIds: [
          "connection-generation-guard-enabled",
        ],
        controlledFactorContrasts: [{
          factorId: "connection-generation-guard-enabled",
          controlValue: true,
          treatmentValue: false,
        }],
        controlState: "absent",
        treatmentState: "present",
        expectedContrastDisposition: "matched",
        targetProfileFingerprint: "profile-a",
        fixtureFingerprint: "fixture-a",
        evidenceIds: ["runtime:e1"],
      }],
      targetProfileFingerprint: "profile-a",
    },
    severity: "critical",
    confidence: "high",
    chainIds: ["chain-1"],
    relatedDiagnosticIds: ["diag-session"],
    causalPredicateIds: [
      "stale-session-mutation-observed",
    ],
    causalFactorIds: [
      "connection-generation-guard-enabled",
    ],
    support: {
      dependencyViolations: 1,
      evidenceGaps: 0,
      corroboratedRisks: 0,
      observedOutcomes: 1,
    },
  }],
};

const diagnostic: DiagnosticRepairDecision = {
  incidentId: "incident-1",
  activeCandidateIds: ["cause-session-guard"],
  disposition: "repair-eligible",
  selectedCandidateId: "cause-session-guard",
  effectiveEvidenceLevel:
    "proven-with-observed-outcome",
  proofState: "causal",
  causalProof:
    incident.rootCauseCandidates[0]!.proof!,
  claimStrength: "proven-runtime",
  reasons: ["controlled reconnect proof"],
};

const diagnostics: DiagnosticFinding[] = [{
  id: "diag-session",
  code: "KNOWLEDGE_RELATION_VIOLATION",
  severity: "critical",
  message: "Deferred session mutation is missing a current generation guard.",
  source,
}];

const invariantRegistry: InvariantRegistrySnapshot = {
  schemaVersion: 1,
  revision: "inv-r1",
  profileKey: "bedrock",
  entries: [{
    id: "invariant::relation-session-guard",
    source: {
      kind: "knowledge-relation",
      id: "relation-session-guard",
      revision: "knowledge-r1",
    },
    enforcement: "runtime-state",
    minimumRepairClaim: "proven-runtime",
    stateRequirements: [{
      id: "session-current",
      predicate: "session-current",
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

const providerRegistry: RepairStrategyProviderRegistry = {
  schemaVersion: 1,
  providers: [{
    id: "session-guard-a",
    version: "1",
    owner: "fixture:a",
    deterministic: true,
    evidenceClass: "runtime-causal",
    selectionMode: "causal-auto",
    supportedDiagnosticCodes: [
      "KNOWLEDGE_RELATION_VIOLATION",
    ],
    mutationKinds: ["replace-text"],
    requiresExactSourceEvidence: true,
    rationale: "Insert exact current-session generation guard.",
  }, {
    id: "session-guard-b",
    version: "1",
    owner: "fixture:b",
    deterministic: true,
    evidenceClass: "runtime-causal",
    selectionMode: "causal-auto",
    supportedDiagnosticCodes: [
      "KNOWLEDGE_RELATION_VIOLATION",
    ],
    mutationKinds: ["replace-text"],
    requiresExactSourceEvidence: true,
    rationale: "Equivalent deterministic session guard realization.",
  }, {
    id: "unrelated",
    version: "1",
    owner: "fixture:unrelated",
    deterministic: true,
    evidenceClass: "deterministic-static",
    selectionMode: "causal-auto",
    supportedDiagnosticCodes: [
      "UNRESOLVED_REFERENCE",
    ],
    mutationKinds: ["replace-text"],
    requiresExactSourceEvidence: true,
    rationale: "Unrelated source.",
  }],
};

function transaction(title: string, fingerprint = "source-a") {
  return createPatchTransaction({
    title,
    sourceFingerprint: fingerprint,
    authorization: fixtureRepairAuthorization(fingerprint),
    operations: [{
      kind: "replace-text",
      source,
      expected: "function old_session_mutation",
      replacement:
        "execute if score @s connection_gen = @s captured_gen run function guarded_session_mutation",
    }],
    preconditions: [{
      kind: "source-fingerprint",
      expected: fingerprint,
    }],
    validation: [{
      kind: "reparse",
      source,
    }, {
      kind: "rerun-diagnostic",
      code: "KNOWLEDGE_RELATION_VIOLATION",
      source,
      expectation: "absent",
    }],
  });
}

function envelope() {
  return deriveRepairOpportunityEnvelope(
    incident,
    [chain],
    diagnostic,
    diagnostics,
    invariantRegistry,
    "source-a",
  );
}

describe("repair strategy enumeration and realization", () => {
  it("derives a causal/source-bound repair opportunity envelope", () => {
    const result = envelope();

    expect(result).toMatchObject({
      incidentId: "incident-1",
      candidateId: "cause-session-guard",
      sourceFingerprint: "source-a",
      automaticRealizationAllowed: true,
      diagnosticIds: ["diag-session"],
      diagnosticCodes: [
        "KNOWLEDGE_RELATION_VIOLATION",
      ],
      invariantIds: [
        "invariant::relation-session-guard",
      ],
      targetProfileFingerprints: ["profile-a"],
      causalBinding: {
        interventionIds: ["exp:reconnect"],
        predicateIds: [
          "stale-session-mutation-observed",
        ],
        factorIds: [
          "connection-generation-guard-enabled",
        ],
      },
    });
    expect(result.exactSourceRefs).toEqual([source]);
  });

  it("enumerates applicable providers without granting unrelated providers authority", () => {
    const result = enumerateRepairStrategySources(
      envelope(),
      diagnostics,
      providerRegistry,
    );

    expect(
      result.applicableSources.map(
        (item) => item.sourceId,
      ),
    ).toEqual([
      "session-guard-a",
      "session-guard-b",
    ]);
    expect(
      result.inapplicableSources.map(
        (item) => item.sourceId,
      ),
    ).toEqual(["unrelated"]);
    expect(result.coverageMissing).toBe(false);
  });

  it("fails realization on stale source fingerprint or source outside the opportunity", () => {
    const enumeration =
      enumerateRepairStrategySources(
        envelope(),
        diagnostics,
        providerRegistry,
      );

    expect(
      realizeProviderRepairStrategy(
        enumeration,
        providerRegistry,
        {
          sourceId: "session-guard-a",
          sourceVersion: "1",
          transaction: transaction(
            "stale",
            "stale-source",
          ),
          changedNodeIds: ["function:p:session"],
          repairClass: "implementation-repair",
          reversible: true,
          idempotent: true,
        },
      ),
    ).toMatchObject({
      status: "blocked",
      reasons: expect.arrayContaining([
        expect.stringMatching(/source fingerprint/i),
      ]),
    });

    const wrongSourceTx = createPatchTransaction({
      title: "wrong source",
      sourceFingerprint: "source-a",
      authorization: fixtureRepairAuthorization("source-a"),
      operations: [{
        kind: "replace-text",
        source: {
          artifactId: "art-1",
          relativePath: "functions/other.mcfunction",
          range: { lineStart: 1, lineEnd: 1 },
        },
        expected: "old",
        replacement: "new",
      }],
      preconditions: [{
        kind: "source-fingerprint",
        expected: "source-a",
      }],
      validation: [{
        kind: "rebuild-graph",
      }],
    });

    expect(
      realizeProviderRepairStrategy(
        enumeration,
        providerRegistry,
        {
          sourceId: "session-guard-a",
          sourceVersion: "1",
          transaction: wrongSourceTx,
          changedNodeIds: ["function:p:other"],
          repairClass: "implementation-repair",
          reversible: true,
          idempotent: true,
        },
      ),
    ).toMatchObject({
      status: "blocked",
      reasons: expect.arrayContaining([
        expect.stringMatching(/not bound.*source evidence/i),
      ]),
    });
  });

  it("realizes candidate metadata from the opportunity instead of trusting provider guesses", () => {
    const enumeration =
      enumerateRepairStrategySources(
        envelope(),
        diagnostics,
        providerRegistry,
      );
    const realized = realizeProviderRepairStrategy(
      enumeration,
      providerRegistry,
      {
        sourceId: "session-guard-a",
        sourceVersion: "1",
        transaction: transaction("guard-a"),
        changedNodeIds: ["function:p:session"],
        repairClass: "implementation-repair",
        reversible: true,
        idempotent: true,
      },
    );

    expect(realized.status).toBe("realized");
    if (realized.status !== "realized") return;
    expect(realized.proposal.strategy).toMatchObject({
      addressesCandidateIds: [
        "cause-session-guard",
      ],
      supportingInvariantIds: [
        "invariant::relation-session-guard",
      ],
      repairClass: "implementation-repair",
      reversible: true,
      idempotent: true,
      validationObligations: {
        invariantIds: [
          "invariant::relation-session-guard",
        ],
        runtimeExperimentIds: ["exp:reconnect"],
        validationKinds: [
          "reparse",
          "rerun-diagnostic",
        ],
      },
      causalBinding: {
        interventionIds: ["exp:reconnect"],
        predicateIds: [
          "stale-session-mutation-observed",
        ],
        factorIds: [
          "connection-generation-guard-enabled",
        ],
      },
    });
  });

  it("deduplicates equivalent provider realizations while preserving all provider provenance through selection", () => {
    const enumeration =
      enumerateRepairStrategySources(
        envelope(),
        diagnostics,
        providerRegistry,
      );

    const realized = [
      ["session-guard-a", "guard-a"],
      ["session-guard-b", "guard-b"],
    ].map(([sourceId, title]) =>
      realizeProviderRepairStrategy(
        enumeration,
        providerRegistry,
        {
          sourceId: sourceId!,
          sourceVersion: "1",
          transaction: transaction(title!),
          changedNodeIds: ["function:p:session"],
          repairClass: "implementation-repair",
          reversible: true,
          idempotent: true,
        },
      )
    );

    expect(
      realized.every(
        (item) => item.status === "realized",
      ),
    ).toBe(true);

    const proposals = realized.flatMap((item) =>
      item.status === "realized"
        ? [item.proposal]
        : []
    );
    const dedup =
      deduplicateRepairStrategyProposals(
        proposals,
      );

    expect(dedup.duplicateCount).toBe(1);
    expect(dedup.proposals).toHaveLength(1);
    expect(dedup.groups[0]?.providers).toEqual([
      {
        providerId: "session-guard-a",
        providerVersion: "1",
      },
      {
        providerId: "session-guard-b",
        providerVersion: "1",
      },
    ]);

    const graph = new SemanticGraph();
    graph.addNode({
      id: "function:p:session",
      identity: {
        kind: "function",
        scope: "p",
        identifier: "session",
      },
      kind: "function",
      identifier: "session",
      source,
    });

    const selected =
      selectProviderBackedRepairStrategyForIncident(
        graph,
        incident,
        [chain],
        diagnostic,
        diagnostics,
        invariantRegistry,
        providerRegistry,
        dedup.proposals,
        {
          decisionBasis: {
            runtimeEvidenceRevision:
              "runtime-current",
          },
        },
      );

    expect(selected.status).toBe("evaluated");
    if (selected.status !== "evaluated") return;
    expect(selected.providerProvenance).toEqual([
      {
        providerId: "session-guard-a",
        providerVersion: "1",
      },
      {
        providerId: "session-guard-b",
        providerVersion: "1",
      },
    ]);
    expect(selected.result.status).toBe("evaluated");
    if (selected.result.status !== "evaluated") return;
    expect(selected.result.selection.status)
      .toBe("selected");
  });

  it("keeps semantic equivalence independent of provider/title but sensitive to validation contract", () => {
    const enumeration =
      enumerateRepairStrategySources(
        envelope(),
        diagnostics,
        providerRegistry,
      );

    const a = realizeProviderRepairStrategy(
      enumeration,
      providerRegistry,
      {
        sourceId: "session-guard-a",
        sourceVersion: "1",
        transaction: transaction("title-a"),
        changedNodeIds: ["function:p:session"],
        repairClass: "implementation-repair",
        reversible: true,
        idempotent: true,
      },
    );
    const b = realizeProviderRepairStrategy(
      enumeration,
      providerRegistry,
      {
        sourceId: "session-guard-b",
        sourceVersion: "1",
        transaction: transaction("title-b"),
        changedNodeIds: ["function:p:session"],
        repairClass: "implementation-repair",
        reversible: true,
        idempotent: true,
      },
    );

    expect(a.status).toBe("realized");
    expect(b.status).toBe("realized");
    if (
      a.status !== "realized" ||
      b.status !== "realized"
    ) return;

    expect(
      repairStrategySemanticFingerprint(a.proposal),
    ).toBe(
      repairStrategySemanticFingerprint(b.proposal),
    );

    const changedTx = createPatchTransaction({
      title: "different validation",
      sourceFingerprint: "source-a",
      authorization: fixtureRepairAuthorization("source-a"),
      operations: [{
        kind: "replace-text",
        source,
        expected: "function old_session_mutation",
        replacement:
          "execute if score @s connection_gen = @s captured_gen run function guarded_session_mutation",
      }],
      preconditions: [{
        kind: "source-fingerprint",
        expected: "source-a",
      }],
      validation: [{
        kind: "rebuild-graph",
      }],
    });
    const changed = realizeProviderRepairStrategy(
      enumeration,
      providerRegistry,
      {
        sourceId: "session-guard-a",
        sourceVersion: "1",
        transaction: changedTx,
        changedNodeIds: ["function:p:session"],
        repairClass: "implementation-repair",
        reversible: true,
        idempotent: true,
      },
    );

    expect(changed.status).toBe("realized");
    if (changed.status !== "realized") return;
    expect(
      repairStrategySemanticFingerprint(
        changed.proposal,
      ),
    ).not.toBe(
      repairStrategySemanticFingerprint(a.proposal),
    );
  });

  it("does not credit a realized provider from an older source revision", () => {
    const enumeration = enumerateRepairStrategySources(
      envelope(),
      diagnostics,
      providerRegistry,
    );
    const realized = realizeProviderRepairStrategy(
      enumeration,
      providerRegistry,
      {
        sourceId: "session-guard-a",
        sourceVersion: "1",
        transaction: transaction("stale-provider-proof"),
        changedNodeIds: ["function:p:session"],
        repairClass: "implementation-repair",
        reversible: true,
        idempotent: true,
      },
    );
    expect(realized.status).toBe("realized");
    if (realized.status !== "realized") return;

    // Hold realizer availability constant so only the source-version
    // identity can decide whether this realization is still applicable.
    const next = {
      ...enumeration,
      applicableSources: enumeration.applicableSources.map((item) =>
        item.sourceId === "session-guard-a"
          ? { ...item, sourceVersion: "2" }
          : item),
    };
    const coverage = {
      items: next.applicableSources.map((item) => ({
        sourceKind: item.sourceKind,
        sourceId: item.sourceId,
        sourceVersion: item.sourceVersion,
        selectionMode: item.selectionMode,
        deterministic: item.deterministic,
        status: "realizer-available" as const,
        reasons: ["Fixture realizer availability."],
      })),
      coveredSources: next.applicableSources.length,
      uncoveredSources: 0,
      realizerNotRequiredSources: 0,
      complete: true,
    };
    const report = buildRepairRealizationCoverageReport(
      next,
      coverage,
      [realized],
    );
    expect(report.items.find((item) =>
      item.sourceId === "session-guard-a")).toMatchObject({
      sourceVersion: "2",
      disposition: "blocked",
    });
    expect(report.realizedCount).toBe(0);
    expect(report.noImplementationCoverage).toBe(true);
  });

  it("cannot realize a provider from a same-ID built-in source", () => {
    const enumeration = enumerateRepairStrategySources(
      envelope(),
      diagnostics,
      providerRegistry,
    );
    const provider = enumeration.applicableSources.find((item) =>
      item.sourceKind === "provider" &&
      item.sourceId === "session-guard-a");
    expect(provider).toBeDefined();
    const foreignEnumeration = {
      ...enumeration,
      applicableSources: [{
        ...provider!,
        sourceKind: "built-in-planner" as const,
      }],
    };
    const realization = realizeProviderRepairStrategy(
      foreignEnumeration,
      providerRegistry,
      {
        sourceId: "session-guard-a",
        sourceVersion: "1",
        transaction: transaction("wrong-kind-source"),
        changedNodeIds: ["function:p:session"],
        repairClass: "implementation-repair",
        reversible: true,
        idempotent: true,
      },
    );
    expect(realization).toMatchObject({
      status: "blocked",
      sourceKind: "provider",
      sourceId: "session-guard-a",
      sourceVersion: "1",
    });
  });

  it("does not let a foreign blocked result mask a realized provider", () => {
    const enumeration = enumerateRepairStrategySources(
      envelope(),
      diagnostics,
      providerRegistry,
    );
    const realization = realizeProviderRepairStrategy(
      enumeration,
      providerRegistry,
      {
        sourceId: "session-guard-a",
        sourceVersion: "1",
        transaction: transaction("current-provider"),
        changedNodeIds: ["function:p:session"],
        repairClass: "implementation-repair",
        reversible: true,
        idempotent: true,
      },
    );
    expect(realization.status).toBe("realized");
    const coverage = {
      items: enumeration.applicableSources.map((item) => ({
        sourceKind: item.sourceKind,
        sourceId: item.sourceId,
        sourceVersion: item.sourceVersion,
        selectionMode: item.selectionMode,
        deterministic: item.deterministic,
        status: "realizer-available" as const,
        reasons: ["Source-kind-aware fixture coverage."],
      })),
      coveredSources: enumeration.applicableSources.length,
      uncoveredSources: 0,
      realizerNotRequiredSources: 0,
      complete: true,
    };
    const report = buildRepairRealizationCoverageReport(
      enumeration,
      coverage,
      [realization, {
        status: "blocked",
        sourceKind: "built-in-planner",
        sourceId: "session-guard-a",
        sourceVersion: "1",
        reasons: ["A different source was blocked."],
      }],
    );
    expect(report.items.find((item) =>
      item.sourceKind === "provider" &&
      item.sourceId === "session-guard-a")).toMatchObject({
      disposition: "realized",
    });
    expect(report.realizedCount).toBe(1);
  });

  it("does not borrow realizer coverage from another source kind with the same ID", () => {
    const enumeration = enumerateRepairStrategySources(
      envelope(),
      diagnostics,
      providerRegistry,
    );
    const provider = enumeration.applicableSources.find((item) =>
      item.sourceId === "session-guard-a");
    expect(provider).toBeDefined();
    const wrongKindCoverage = {
      items: [{
        sourceKind: "built-in-planner",
        sourceId: provider!.sourceId,
        sourceVersion: provider!.sourceVersion,
        selectionMode: provider!.selectionMode,
        deterministic: provider!.deterministic,
        status: "realizer-available" as const,
        reasons: ["Realizer belongs to a different source kind."],
      }],
      coveredSources: 1,
      uncoveredSources: 0,
      realizerNotRequiredSources: 0,
      complete: true,
    };
    const report = buildRepairRealizationCoverageReport(
      enumeration,
      wrongKindCoverage,
      [],
    );
    expect(report.items.find((item) =>
      item.sourceId === "session-guard-a")).toMatchObject({
      disposition: "missing-realizer",
    });
    expect(report.realizedCount).toBe(0);
  });

  it("enumerates non-provider proposal sources without converting them into patch transactions", () => {
    const proposalOnlyRegistry:
      RepairStrategySourceRegistry = {
        schemaVersion: 1,
        sources: [{
          id: "session-proposal-only",
          version: "1",
          kind: "built-in-planner",
          owner: "fixture:proposal-only",
          deterministic: false,
          selectionMode: "proposal-only",
          repairClass: "implementation-repair",
          supportedPredicateIds: [
            "stale-session-mutation-observed",
          ],
          supportedFactorIds: [
            "connection-generation-guard-enabled",
          ],
          requiresExactSourceEvidence: true,
          rationale:
            "Fixture proposal surface without a concrete realizer.",
        }],
      };

    const enumeration = enumerateRepairStrategySources(
      envelope(),
      diagnostics,
      providerRegistry,
      proposalOnlyRegistry,
    );

    const sessionTemplate =
      enumeration.applicableSources.find(
        (item) =>
          item.sourceId ===
            "session-proposal-only",
      );

    expect(sessionTemplate).toMatchObject({
      sourceKind: "built-in-planner",
      selectionMode: "proposal-only",
      deterministic: false,
      automaticRealizationEligible: false,
    });

    const coverage = assessRepairRealizerCoverage(
      enumeration,
      BUILTIN_REPAIR_REALIZERS,
    );

    expect(
      coverage.items.find(
        (item) =>
          item.sourceId ===
            "session-proposal-only",
      ),
    ).toMatchObject({
      status: "realizer-not-required",
    });

    const report =
      buildRepairRealizationCoverageReport(
        enumeration,
        coverage,
        [],
      );

    expect(report.noImplementationCoverage).toBe(true);
    expect(report.proposalOnlyCount).toBe(1);
    // The two applicable fixture providers are not in the built-in
    // realizer registry. This must remain visible as missing coverage;
    // the separate nondeterministic proposal-only template needs none.
    expect(report.missingRealizerCount).toBe(2);
    expect(report.items.filter((item) =>
      item.disposition === "missing-realizer").map((item) =>
      item.sourceId)).toEqual(["session-guard-a", "session-guard-b"]);
    expect(
      report.items.find(
        (item) =>
          item.sourceId ===
            "session-proposal-only",
      ),
    ).toMatchObject({
      disposition: "proposal-only",
    });
  });

  it("does not deduplicate identical edits when their pre-mutation proof obligations differ", () => {
    const enumeration =
      enumerateRepairStrategySources(
        envelope(),
        diagnostics,
        providerRegistry,
      );

    const realized = realizeProviderRepairStrategy(
      enumeration,
      providerRegistry,
      {
        sourceId: "session-guard-a",
        sourceVersion: "1",
        transaction: transaction("guard-a"),
        changedNodeIds: ["function:p:session"],
        repairClass: "implementation-repair",
        reversible: true,
        idempotent: true,
      },
    );

    expect(realized.status).toBe("realized");
    if (realized.status !== "realized") return;

    const proofBound = {
      ...realized.proposal,
      strategy: {
        ...realized.proposal.strategy,
        transaction: {
          ...realized.proposal.strategy.transaction,
          requiredProofs: [
            "post-transform" as const,
          ],
        },
      },
    };

    const dedup =
      deduplicateRepairStrategyProposals([
        realized.proposal,
        proofBound,
      ]);

    expect(dedup.duplicateCount).toBe(0);
    expect(dedup.proposals).toHaveLength(2);
  });

  it("reports explicit strategy coverage gaps", () => {
    const emptyRegistry:
      RepairStrategyProviderRegistry = {
        schemaVersion: 1,
        providers: [{
          id: "unrelated-only",
          version: "1",
          owner: "fixture",
          deterministic: true,
          evidenceClass: "deterministic-static",
          selectionMode: "causal-auto",
          supportedDiagnosticCodes: [
            "UNRESOLVED_REFERENCE",
          ],
          mutationKinds: ["replace-text"],
          requiresExactSourceEvidence: true,
          rationale: "No session repair.",
        }],
      };

    const result = enumerateRepairStrategySources(
      envelope(),
      diagnostics,
      emptyRegistry,
    );

    expect(result.coverageMissing).toBe(true);
    expect(result.reasons.join(" "))
      .toMatch(/no registered repair strategy source/i);
  });
});
