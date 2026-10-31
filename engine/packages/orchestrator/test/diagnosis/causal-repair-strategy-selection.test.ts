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
  selectRepairStrategyForIncident,
} from "../../src/diagnosis/causal-repair-strategy-selection.js";
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
  relatedDiagnosticIds: ["diag-1"],
};

const incident: CausalIncident = {
  id: "incident-1",
  scopeKey: "arena-1",
  severity: "critical",
  confidence: "high",
  chainIds: ["chain-1"],
  relatedDiagnosticIds: ["diag-1"],
  nodes: chain.nodes,
  links: chain.links,
  rootCauseCandidates: [{
    id: "cause-1",
    label: "start",
    evidenceLevel: "proven-dependency-violation",
    severity: "critical",
    confidence: "high",
    chainIds: ["chain-1"],
    relatedDiagnosticIds: ["diag-1"],
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

const registry: InvariantRegistrySnapshot = {
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
    title: "fix ready",
    sourceFingerprint: "source",
    authorization: fixtureRepairAuthorization("source"),
    operations: [{
      kind: "replace-text",
      source: source("functions/target.mcfunction"),
      expected: "old",
      replacement: "new",
    }],
    preconditions: [{
      kind: "source-fingerprint",
      expected: "source",
    }],
    validation: [{
      kind: "rebuild-graph",
    }],
  });

  return {
    graph,
    candidate: {
      strategyId: "fix-ready",
      transaction,
      changedNodeIds: ["function:p:target"],
      supportingInvariantIds: [
        "invariant::relation-ready",
      ],
      addressesCandidateIds: ["cause-1"],
    },
  };
}

describe("causal repair strategy selection", () => {
  it("derives required invariants and evaluates the strategy without caller-supplied invariant ids", () => {
    const { graph, candidate } = fixture();
    const result = selectRepairStrategyForIncident(
      graph,
      incident,
      [chain],
      diagnostic,
      registry,
      [candidate],
      {
        allowGuarded: true,
        decisionBasis: {
          runtimeEvidenceRevision: "evidence-current",
        },
      },
    );

    expect(result.status).toBe("evaluated");
    if (result.status !== "evaluated") return;
    expect(result.derivation.invariantIds)
      .toEqual(["invariant::relation-ready"]);
    expect(result.selection.status).toBe("selected");
  });

  it("blocks automatic strategy selection when selected causal chain is unavailable", () => {
    const { graph, candidate } = fixture();
    const result = selectRepairStrategyForIncident(
      graph,
      incident,
      [],
      diagnostic,
      registry,
      [candidate],
      { allowGuarded: true },
    );

    expect(result.status)
      .toBe("invariant-derivation-blocked");
    if (
      result.status !==
      "invariant-derivation-blocked"
    ) return;
    expect(result.derivation.missingChainIds)
      .toEqual(["chain-1"]);
  });
  it("forwards decision basis into selected repair proof", () => {
    const { graph, candidate } = fixture();
    const runtimeIncident: CausalIncident = {
      ...incident,
      rootCauseCandidates: [{
        ...incident.rootCauseCandidates[0]!,
        evidenceLevel: "proven-with-observed-outcome",
        support: {
          ...incident.rootCauseCandidates[0]!.support,
          observedOutcomes: 1,
        },
      }],
    };
    const runtimeDiagnostic = {
      ...diagnostic,
      disposition: "repair-eligible" as const,
      effectiveEvidenceLevel:
        "proven-with-observed-outcome" as const,
      proofState: "causal" as const,
      claimStrength: "proven-runtime" as const,
    };

    const result = selectRepairStrategyForIncident(
      graph,
      runtimeIncident,
      [chain],
      runtimeDiagnostic,
      registry,
      [candidate],
      {
        decisionBasis: {
          runtimeEvidenceRevision: "evidence-current",
        },
      },
    );

    expect(result.status).toBe("evaluated");
    if (result.status !== "evaluated") return;
    expect(result.selection.status).toBe("selected");
    if (result.selection.status !== "selected") return;
    expect(
      result.selection.selected.pipeline.proof.decisionBasis
        .runtimeEvidenceRevision,
    ).toBe("evidence-current");
  });
});
