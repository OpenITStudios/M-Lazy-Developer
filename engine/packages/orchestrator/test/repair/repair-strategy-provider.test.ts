import { describe, expect, it } from "vitest";
import { createPatchTransaction } from "../../../repair/src/index.js";
import {
  BUILTIN_REPAIR_STRATEGY_PROVIDERS,
  repairStrategyProviderRegistryRevision,
  validateRepairStrategyProviderProposal,
  validateRepairStrategyProviderRegistry,
  type RepairStrategyProviderRegistry,
} from "../../src/repair/repair-strategy-provider.js";
import { fixtureRepairAuthorization } from "../../../repair/test/fixture-authorization.js";

function transaction() {
  return createPatchTransaction({
    title: "repair",
    sourceFingerprint: "source",
    authorization: fixtureRepairAuthorization("source"),
    operations: [{
      kind: "replace-command",
      source: {
        artifactId: "art-1",
        relativePath: "functions/a.mcfunction",
        range: {
          lineStart: 4,
          lineEnd: 4,
        },
      },
      expected: "fill 0 0 0 1 1 1 stone",
      replacement: "fill 1 0 0 2 1 1 stone",
    }],
    preconditions: [{
      kind: "source-fingerprint",
      expected: "source",
    }],
    validation: [{
      kind: "rebuild-graph",
    }],
  });
}

function proposal(providerId: string, providerVersion = "1") {
  return {
    providerId,
    providerVersion,
    relatedDiagnosticIds: ["diag-1"],
    strategy: {
      strategyId: "strategy-1",
      transaction: transaction(),
      changedNodeIds: ["function:p:a"],
      supportingInvariantIds: ["invariant:ready"],
      addressesCandidateIds: ["cause-1"],
    },
  };
}

function causalProviderFixture(
  version: string,
): RepairStrategyProviderRegistry {
  return {
    schemaVersion: 1,
    providers: [{
      id: "verified",
      version,
      owner: "provider",
      deterministic: true,
      evidenceClass: "runtime-causal",
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

describe("repair strategy provider registry", () => {
  it("keeps the built-in topology provider proposal-only", () => {
    expect(
      validateRepairStrategyProviderRegistry(
        BUILTIN_REPAIR_STRATEGY_PROVIDERS,
      ),
    ).toEqual([]);

    const errors = validateRepairStrategyProviderProposal(
      BUILTIN_REPAIR_STRATEGY_PROVIDERS,
      proposal("linear-topology-repair"),
      { requireCausalAuto: true },
    );

    expect(errors.join(" "))
      .toMatch(/proposal-only/);
  });

  it("accepts a deterministic non-heuristic causal-auto provider", () => {
    const registry: RepairStrategyProviderRegistry = {
      schemaVersion: 1,
      providers: [{
        id: "verified-function-repair",
        version: "1",
        owner: "packages/orchestrator/src/example.ts",
        deterministic: true,
        evidenceClass: "runtime-causal",
        selectionMode: "causal-auto",
        supportedDiagnosticCodes: [
          "KNOWLEDGE_RELATION_VIOLATION",
        ],
        mutationKinds: ["replace-command"],
        requiresExactSourceEvidence: true,
        rationale: "fixture",
      }],
    };

    expect(validateRepairStrategyProviderRegistry(registry))
      .toEqual([]);
    expect(validateRepairStrategyProviderProposal(
      registry,
      proposal("verified-function-repair"),
      { requireCausalAuto: true },
    )).toEqual([]);
  });

  it("rejects heuristic providers from causal-auto mode", () => {
    const registry: RepairStrategyProviderRegistry = {
      schemaVersion: 1,
      providers: [{
        id: "unsafe",
        version: "1",
        owner: "provider",
        deterministic: true,
        evidenceClass: "heuristic-static",
        selectionMode: "causal-auto",
        supportedDiagnosticCodes: [
          "TOPOLOGY_TRANSLATION_OUTLIER",
        ],
        mutationKinds: ["replace-command"],
        requiresExactSourceEvidence: true,
        rationale: "fixture",
      }],
    };

    expect(validateRepairStrategyProviderRegistry(registry).join(" "))
      .toMatch(/cannot use heuristic-static/);
  });

  it("rejects mutation kinds outside the provider declaration", () => {
    const registry: RepairStrategyProviderRegistry = {
      schemaVersion: 1,
      providers: [{
        id: "text-only",
        version: "1",
        owner: "provider",
        deterministic: true,
        evidenceClass: "deterministic-static",
        selectionMode: "causal-auto",
        supportedDiagnosticCodes: [
          "KNOWLEDGE_RELATION_VIOLATION",
        ],
        mutationKinds: ["replace-text"],
        requiresExactSourceEvidence: true,
        rationale: "fixture",
      }],
    };

    expect(validateRepairStrategyProviderProposal(
      registry,
      proposal("text-only"),
      { requireCausalAuto: true },
    ).join(" ")).toMatch(/outside provider declaration/);
  });

  it("rejects missing exact source evidence when provider requires it", () => {
    const registry: RepairStrategyProviderRegistry = {
      schemaVersion: 1,
      providers: [{
        id: "exact",
        version: "1",
        owner: "provider",
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

    const value = proposal("exact");
    value.strategy.transaction.operations[0] = {
      kind: "replace-command",
      source: {
        artifactId: "art-1",
        relativePath: "functions/a.mcfunction",
      },
      expected: "say old",
      replacement: "say new",
    };

    expect(validateRepairStrategyProviderProposal(
      registry,
      value,
      { requireCausalAuto: true },
    ).join(" ")).toMatch(/exact single-line source evidence/);
  });

  it("fingerprints provider policy independent of declaration order", () => {
    const first: RepairStrategyProviderRegistry = {
      schemaVersion: 1,
      providers: [{
        id: "b",
        version: "1",
        owner: "b",
        deterministic: true,
        evidenceClass: "deterministic-static",
        selectionMode: "causal-auto",
        supportedDiagnosticCodes: [
          "UNRESOLVED_REFERENCE",
          "KNOWLEDGE_RELATION_VIOLATION",
        ],
        mutationKinds: ["replace-text", "replace-command"],
        requiresExactSourceEvidence: true,
        rationale: "b",
      }, {
        id: "a",
        version: "1",
        owner: "a",
        deterministic: true,
        evidenceClass: "runtime-causal",
        selectionMode: "causal-auto",
        supportedDiagnosticCodes: [
          "KNOWLEDGE_RELATION_VIOLATION",
        ],
        mutationKinds: ["replace-command"],
        requiresExactSourceEvidence: true,
        rationale: "a",
      }],
    };
    const second: RepairStrategyProviderRegistry = {
      ...first,
      providers: [...first.providers].reverse().map((provider) => ({
        ...provider,
        supportedDiagnosticCodes:
          [...provider.supportedDiagnosticCodes].reverse(),
        mutationKinds: [...provider.mutationKinds].reverse(),
      })),
    };

    expect(repairStrategyProviderRegistryRevision(first))
      .toBe(repairStrategyProviderRegistryRevision(second));
  });

  it("changes provider revision when provider policy/version changes", () => {
    const first = causalProviderFixture("1");
    const second = causalProviderFixture("2");

    expect(repairStrategyProviderRegistryRevision(first))
      .not.toBe(repairStrategyProviderRegistryRevision(second));
  });


  it("rejects duplicate provider capabilities and empty rationale", () => {
    const registry: RepairStrategyProviderRegistry = {
      schemaVersion: 1,
      providers: [{
        id: "duplicates",
        version: "1",
        owner: "provider",
        deterministic: true,
        evidenceClass: "runtime-causal",
        selectionMode: "causal-auto",
        supportedDiagnosticCodes: [
          "KNOWLEDGE_RELATION_VIOLATION",
          "KNOWLEDGE_RELATION_VIOLATION",
        ],
        mutationKinds: [
          "replace-command",
          "replace-command",
        ],
        requiresExactSourceEvidence: true,
        rationale: " ",
      }],
    };

    const errors =
      validateRepairStrategyProviderRegistry(registry).join(" ");
    expect(errors).toMatch(/Duplicate supported diagnostic code/);
    expect(errors).toMatch(/Duplicate mutation kind/);
    expect(errors).toMatch(/rationale must be non-empty/);
  });

});
