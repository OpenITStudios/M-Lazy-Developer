import { describe, expect, it } from "vitest";
import { SemanticGraph } from "../../../graph/src/index.js";
import { createPatchTransaction } from "../../../repair/src/index.js";
import type {
  CausalChain,
  CausalIncident,
} from "../../../project-model/src/index.js";
import type {
  InvariantRegistrySnapshot,
} from "../../../project-model/src/index.js";
import {
  selectProviderBackedRepairStrategyForIncident,
} from "../../src/repair/provider-backed-repair-selection.js";
import {
  createDecisionLedger,
} from "../../src/workflow/decision-ledger.js";
import {
  recordProviderBackedRepairStrategySelection,
} from "../../src/workflow/decision-ledger-recording.js";
import type {
  RepairStrategyProviderRegistry,
} from "../../src/repair/repair-strategy-provider.js";
import { fixtureRepairAuthorization } from "../../../repair/test/fixture-authorization.js";

function source(relativePath: string) {
  return { artifactId: "art-1", relativePath };
}

const chain: CausalChain = {
  id: "chain-1",
  severity: "critical",
  confidence: "high",
  title: "requires ready",
  summary: "test",
  nodes: [{
    id: "root",
    kind: "observed-state",
    label: "start",
  }, {
    id: "missing",
    kind: "missing-requirement",
    label: "ready",
  }, {
    id: "violation",
    kind: "violation",
    label: "violation",
  }],
  links: [{
    from: "root",
    to: "missing",
    strength: "direct-evidence",
    relationId: "relation-ready",
    rationale: "requires ready",
  }],
  relatedDiagnosticIds: ["diag-knowledge"],
};

const incident: CausalIncident = {
  id: "incident-1",
  scopeKey: "arena-1",
  severity: "critical",
  confidence: "high",
  chainIds: ["chain-1"],
  relatedDiagnosticIds: ["diag-knowledge"],
  nodes: chain.nodes,
  links: chain.links,
  rootCauseCandidates: [{
    id: "cause-1",
    label: "start",
    evidenceLevel: "proven-dependency-violation",
    severity: "critical",
    confidence: "high",
    chainIds: ["chain-1"],
    relatedDiagnosticIds: ["diag-knowledge"],
    support: {
      dependencyViolations: 1,
      evidenceGaps: 0,
      corroboratedRisks: 0,
      observedOutcomes: 0,
    },
  }],
};

const diagnosticDecision = {
  incidentId: "incident-1",
  activeCandidateIds: ["cause-1"],
  disposition: "guarded-repair-eligible" as const,
  selectedCandidateId: "cause-1",
  effectiveEvidenceLevel:
    "proven-with-observed-outcome" as const,
  proofState: "intervention-supported" as const,
  claimStrength: "proven-runtime" as const,
  reasons: ["proof"],
};

const invariantRegistry: InvariantRegistrySnapshot = {
  schemaVersion: 1,
  revision: "inv-r1",
  profileKey: "bedrock",
  entries: [{
    id: "invariant::relation-ready",
    source: {
      kind: "knowledge-relation",
      id: "relation-ready",
      revision: "knowledge-r1",
    },
    enforcement: "runtime-state",
    minimumRepairClaim: "proven-static",
    stateRequirements: [{
      id: "ready",
      predicate: "ready",
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

function graphAndTransaction() {
  const graph = new SemanticGraph();
  graph.addNode({
    id: "function:p:target",
    identity: {
      kind: "function",
      scope: "p",
      identifier: "target",
    },
    kind: "function",
    identifier: "target",
    source: source("functions/target.mcfunction"),
  });

  const transaction = createPatchTransaction({
    title: "repair",
    sourceFingerprint: "source",
    authorization: fixtureRepairAuthorization("source"),
    operations: [{
      kind: "replace-command",
      source: {
        ...source("functions/target.mcfunction"),
        range: { lineStart: 1, lineEnd: 1 },
      },
      expected: "say old",
      replacement: "say new",
    }],
    preconditions: [{
      kind: "source-fingerprint",
      expected: "source",
    }],
    validation: [{ kind: "rebuild-graph" }],
  });

  return { graph, transaction };
}

function causalProvider(): RepairStrategyProviderRegistry {
  return {
    schemaVersion: 1,
    providers: [{
      id: "knowledge-fix",
      version: "1",
      owner: "fixture",
      deterministic: true,
      evidenceClass: "deterministic-static",
      selectionMode: "causal-auto",
      supportedDiagnosticCodes: [
        "KNOWLEDGE_RELATION_VIOLATION",
      ],
      mutationKinds: ["replace-command"],
      requiresExactSourceEvidence: true,
      rationale: "fixture",
    }],
  };
}

describe("provider-backed repair selection", () => {
  it("allows provider proposal whose diagnostic belongs to selected causal provenance", () => {
    const { graph, transaction } =
      graphAndTransaction();

    const result =
      selectProviderBackedRepairStrategyForIncident(
        graph,
        incident,
        [chain],
        diagnosticDecision,
        [{
          id: "diag-knowledge",
          code: "KNOWLEDGE_RELATION_VIOLATION",
          severity: "critical",
          message: "ready missing",
        }],
        invariantRegistry,
        causalProvider(),
        [{
          providerId: "knowledge-fix",
          providerVersion: "1",
          relatedDiagnosticIds: ["diag-knowledge"],
          strategy: {
            strategyId: "repair-ready",
            transaction,
            changedNodeIds: ["function:p:target"],
            supportingInvariantIds: [
              "invariant::relation-ready",
            ],
            addressesCandidateIds: ["cause-1"],
          },
        }],
        {
          allowGuarded: true,
          decisionBasis: {
            runtimeEvidenceRevision: "evidence-current",
          },
        },
      );

    expect(result.status).toBe("evaluated");
    if (result.status !== "evaluated") return;
    expect(result.result.status).toBe("evaluated");
    expect(result.providerRegistryRevision).toMatch(
      /^[a-f0-9]{64}$/,
    );
    expect(result.providerProvenance).toEqual([{
      providerId: "knowledge-fix",
      providerVersion: "1",
    }]);

    if (result.result.status !== "evaluated") return;
    expect(result.result.selection.status).toBe("selected");
    if (result.result.selection.status !== "selected") return;
    expect(
      result.result.selection.selected.pipeline.proof
        .decisionBasis.repairProviderRegistryRevision,
    ).toBe(result.providerRegistryRevision);

    const ledger = recordProviderBackedRepairStrategySelection(
      createDecisionLedger(),
      result,
      transaction.id,
      {
        decisionId: "provider-strategy",
        basis: {
          invariantRegistryRevision:
            invariantRegistry.revision,
        },
      },
    );
    expect(ledger.entries[0]?.inputIds)
      .toEqual(["repair-provider:knowledge-fix@1"]);
    expect(
      ledger.entries[0]?.basis.repairProviderRegistryRevision,
    ).toBe(result.providerRegistryRevision);
  });

  it("blocks proposal whose diagnostic is outside selected causal provenance", () => {
    const { graph, transaction } =
      graphAndTransaction();

    const registry: RepairStrategyProviderRegistry = {
      schemaVersion: 1,
      providers: [{
        id: "topology-causal",
        version: "1",
        owner: "fixture",
        deterministic: true,
        evidenceClass: "deterministic-static",
        selectionMode: "causal-auto",
        supportedDiagnosticCodes: [
          "TOPOLOGY_TRANSLATION_OUTLIER",
        ],
        mutationKinds: ["replace-command"],
        requiresExactSourceEvidence: true,
        rationale: "fixture",
      }],
    };

    const result =
      selectProviderBackedRepairStrategyForIncident(
        graph,
        incident,
        [chain],
        diagnosticDecision,
        [{
          id: "diag-knowledge",
          code: "KNOWLEDGE_RELATION_VIOLATION",
          severity: "critical",
          message: "ready missing",
        }, {
          id: "diag-topology",
          code: "TOPOLOGY_TRANSLATION_OUTLIER",
          severity: "medium",
          message: "outlier",
        }],
        invariantRegistry,
        registry,
        [{
          providerId: "topology-causal",
          providerVersion: "1",
          relatedDiagnosticIds: ["diag-topology"],
          strategy: {
            strategyId: "topology-fix",
            transaction,
            changedNodeIds: ["function:p:target"],
            supportingInvariantIds: [
              "invariant::relation-ready",
            ],
            addressesCandidateIds: ["cause-1"],
          },
        }],
        { allowGuarded: true },
      );

    expect(result.status)
      .toBe("provider-validation-blocked");
    if (
      result.status !==
      "provider-validation-blocked"
    ) return;
    expect(result.providerErrors.join(" "))
      .toMatch(/not part of the selected root-cause candidate provenance/);
  });

  it("blocks proposal with an unsupported diagnostic code", () => {
    const { graph, transaction } =
      graphAndTransaction();

    const result =
      selectProviderBackedRepairStrategyForIncident(
        graph,
        incident,
        [chain],
        diagnosticDecision,
        [{
          id: "diag-knowledge",
          code: "KNOWLEDGE_RELATION_VIOLATION",
          severity: "critical",
          message: "ready missing",
        }],
        invariantRegistry,
        {
          schemaVersion: 1,
          providers: [{
            id: "wrong-code",
            version: "1",
            owner: "fixture",
            deterministic: true,
            evidenceClass: "deterministic-static",
            selectionMode: "causal-auto",
            supportedDiagnosticCodes: [
              "UNRESOLVED_REFERENCE",
            ],
            mutationKinds: ["replace-command"],
            requiresExactSourceEvidence: true,
            rationale: "fixture",
          }],
        },
        [{
          providerId: "wrong-code",
          providerVersion: "1",
          relatedDiagnosticIds: ["diag-knowledge"],
          strategy: {
            strategyId: "repair",
            transaction,
            changedNodeIds: ["function:p:target"],
            supportingInvariantIds: [
              "invariant::relation-ready",
            ],
            addressesCandidateIds: ["cause-1"],
          },
        }],
        { allowGuarded: true },
      );

    expect(result.status)
      .toBe("provider-validation-blocked");
    if (
      result.status !==
      "provider-validation-blocked"
    ) return;
    expect(result.providerErrors.join(" "))
      .toMatch(/outside provider supportedDiagnosticCodes/);
  });
});
