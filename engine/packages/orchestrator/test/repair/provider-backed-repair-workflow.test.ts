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
  createDecisionLedger,
} from "../../src/workflow/decision-ledger.js";
import {
  selectAndRecordProviderBackedRepairStrategy,
} from "../../src/repair/provider-backed-repair-workflow.js";
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
  title: "ready",
  summary: "ready",
  nodes: [{
    id: "root",
    kind: "observed-state",
    label: "start",
  }, {
    id: "missing",
    kind: "missing-requirement",
    label: "ready",
  }],
  links: [{
    from: "root",
    to: "missing",
    strength: "direct-evidence",
    relationId: "relation-ready",
    rationale: "requires ready",
  }],
  relatedDiagnosticIds: ["diag-ready"],
};

const incident: CausalIncident = {
  id: "incident-1",
  scopeKey: "arena-1",
  severity: "critical",
  confidence: "high",
  chainIds: ["chain-1"],
  relatedDiagnosticIds: ["diag-ready"],
  nodes: chain.nodes,
  links: chain.links,
  rootCauseCandidates: [{
    id: "cause-1",
    label: "start",
    evidenceLevel: "proven-dependency-violation",
    severity: "critical",
    confidence: "high",
    chainIds: ["chain-1"],
    relatedDiagnosticIds: ["diag-ready"],
    support: {
      dependencyViolations: 1,
      evidenceGaps: 0,
      corroboratedRisks: 0,
      observedOutcomes: 0,
    },
  }],
};

const diagnostic = {
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
      "runtime",
      "package",
    ],
  }],
};

function fixture() {
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

  const providerRegistry: RepairStrategyProviderRegistry = {
    schemaVersion: 1,
    providers: [{
      id: "ready-provider",
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

  return {
    graph,
    transaction,
    providerRegistry,
  };
}

describe("provider-backed repair workflow", () => {
  it("records provider revision and provenance atomically when selected", () => {
    const { graph, transaction, providerRegistry } =
      fixture();

    const result = selectAndRecordProviderBackedRepairStrategy({
      graph,
      incident,
      chains: [chain],
      diagnostic,
      diagnostics: [{
        id: "diag-ready",
        code: "KNOWLEDGE_RELATION_VIOLATION",
        severity: "critical",
        message: "ready missing",
      }],
      invariantRegistry,
      providerRegistry,
      proposals: [{
        providerId: "ready-provider",
        providerVersion: "1",
        relatedDiagnosticIds: ["diag-ready"],
        strategy: {
          strategyId: "ready-fix",
          transaction,
          changedNodeIds: ["function:p:target"],
          supportingInvariantIds: [
            "invariant::relation-ready",
          ],
          addressesCandidateIds: ["cause-1"],
        },
      }],
      ledger: createDecisionLedger(),
      decisionId: "strategy-decision",
      decisionBasis: {
        sourceFingerprint: "source",
        invariantRegistryRevision: "inv-r1",
        runtimeEvidenceRevision: "evidence-current",
      },
      policy: { allowGuarded: true },
    });

    expect(result.status).toBe("recorded");
    if (result.status !== "recorded") return;
    expect(result.ledger.entries).toHaveLength(1);
    expect(result.ledger.entries[0]?.inputIds)
      .toEqual(["repair-provider:ready-provider@1"]);
    expect(
      result.ledger.entries[0]?.basis
        .repairProviderRegistryRevision,
    ).toMatch(/^[a-f0-9]{64}$/);
  });

  it("leaves ledger unchanged when provider validation is blocked", () => {
    const { graph, transaction, providerRegistry } =
      fixture();
    const ledger = createDecisionLedger();

    const result = selectAndRecordProviderBackedRepairStrategy({
      graph,
      incident,
      chains: [chain],
      diagnostic,
      diagnostics: [{
        id: "diag-ready",
        code: "KNOWLEDGE_RELATION_VIOLATION",
        severity: "critical",
        message: "ready missing",
      }],
      invariantRegistry,
      providerRegistry,
      proposals: [{
        providerId: "ready-provider",
        providerVersion: "wrong",
        relatedDiagnosticIds: ["diag-ready"],
        strategy: {
          strategyId: "bad",
          transaction,
          changedNodeIds: ["function:p:target"],
          supportingInvariantIds: [
            "invariant::relation-ready",
          ],
          addressesCandidateIds: ["cause-1"],
        },
      }],
      ledger,
      decisionId: "blocked",
      decisionBasis: {
        runtimeEvidenceRevision: "evidence-current",
      },
      policy: { allowGuarded: true },
    });

    expect(result.status).toBe("not-recorded");
    expect(result.ledger).toEqual(ledger);
  });

  it("does not record a decision when no strategy is eligible", () => {
    const { graph, transaction, providerRegistry } =
      fixture();
    const ledger = createDecisionLedger();

    const result = selectAndRecordProviderBackedRepairStrategy({
      graph,
      incident,
      chains: [chain],
      diagnostic,
      diagnostics: [{
        id: "diag-ready",
        code: "KNOWLEDGE_RELATION_VIOLATION",
        severity: "critical",
        message: "ready missing",
      }],
      invariantRegistry,
      providerRegistry,
      proposals: [{
        providerId: "ready-provider",
        providerVersion: "1",
        relatedDiagnosticIds: ["diag-ready"],
        strategy: {
          strategyId: "not-causal",
          transaction,
          changedNodeIds: ["function:p:target"],
          supportingInvariantIds: [
            "invariant::relation-ready",
          ],
          addressesCandidateIds: ["other-cause"],
        },
      }],
      ledger,
      decisionId: "none",
      decisionBasis: {
        runtimeEvidenceRevision: "evidence-current",
      },
      policy: { allowGuarded: true },
    });

    expect(result.status).toBe("not-recorded");
    expect(result.ledger).toEqual(ledger);
  });
});
