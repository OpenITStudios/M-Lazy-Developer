import { describe, expect, it } from "vitest";
import type {
  CausalChain,
  CausalIncident,
} from "../../../project-model/src/index.js";
import type {
  InvariantRegistrySnapshot,
} from "../../../project-model/src/index.js";
import {
  deriveRepairInvariants,
} from "../../src/repair/repair-invariant-derivation.js";

const chain: CausalChain = {
  id: "chain-1",
  severity: "critical",
  confidence: "high",
  title: "ready missing",
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

const decision = {
  incidentId: "incident-1",
  activeCandidateIds: ["cause-1"],
  disposition: "guarded-repair-eligible" as const,
  selectedCandidateId: "cause-1",
  effectiveEvidenceLevel:
    "proven-dependency-violation" as const,
  claimStrength: "proven-static" as const,
  reasons: ["proof"],
};

function registry(
  enforcement:
    | "runtime-state"
    | "diagnostic-only" = "runtime-state",
): InvariantRegistrySnapshot {
  return {
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
      enforcement,
      minimumRepairClaim:
        enforcement === "diagnostic-only"
          ? "hypothesis"
          : "proven-static",
      stateRequirements:
        enforcement === "diagnostic-only"
          ? []
          : [{
              id: "ready",
              predicate: "ready",
              expectedState: "present",
            }],
      temporalRequirements: [],
      revalidationLayers: ["static"],
    }],
  };
}

describe("repair invariant derivation", () => {
  it("derives required invariant from selected candidate causal relation", () => {
    const result = deriveRepairInvariants(
      incident,
      decision,
      [chain],
      registry(),
    );

    expect(result).toMatchObject({
      candidateId: "cause-1",
      chainIds: ["chain-1"],
      relationIds: ["relation-ready"],
      invariantIds: ["invariant::relation-ready"],
      automaticSelectionAllowed: true,
    });
  });

  it("fails closed when causal chain provenance is unavailable", () => {
    const result = deriveRepairInvariants(
      incident,
      decision,
      [],
      registry(),
    );

    expect(result.automaticSelectionAllowed).toBe(false);
    expect(result.missingChainIds).toEqual(["chain-1"]);
  });

  it("fails closed when relation maps only to diagnostic-only invariant", () => {
    const result = deriveRepairInvariants(
      incident,
      decision,
      [chain],
      registry("diagnostic-only"),
    );

    expect(result.automaticSelectionAllowed).toBe(false);
    expect(result.unsupportedRelationIds)
      .toEqual(["relation-ready"]);
  });

  it("fails closed when selected candidate is absent", () => {
    const result = deriveRepairInvariants(
      incident,
      {
        ...decision,
        selectedCandidateId: "missing",
      },
      [chain],
      registry(),
    );

    expect(result.automaticSelectionAllowed).toBe(false);
    expect(result.reasons.join(" "))
      .toMatch(/not present/);
  });
});
