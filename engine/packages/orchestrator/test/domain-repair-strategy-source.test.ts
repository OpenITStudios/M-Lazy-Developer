import { describe, expect, it } from "vitest";
import {
  BUILTIN_REPAIR_REALIZERS,
  BUILTIN_REPAIR_STRATEGY_SOURCES,
  assessRepairRegistryCoverage,
  assessRepairRealizerCoverage,
  enumerateRepairStrategySources,
  validateRepairStrategySourceRegistry,
} from "../src/index.js";
import type {
  RepairStrategyProviderRegistry,
} from "../src/index.js";

describe("domain repair strategy source safety", () => {
  it("keeps domain remediation proposal-only when mutation is not deterministic", () => {
    const byId = new Map(
      BUILTIN_REPAIR_STRATEGY_SOURCES.sources.map(
        (item) => [item.id, item],
      ),
    );

    expect(
      byId.get(
        "chunk-lifecycle-remediation",
      ),
    ).toMatchObject({
      deterministic: false,
      selectionMode: "proposal-only",
      supportedDiagnosticCodes: [
        "CHUNK_LIFECYCLE_RUNTIME_RISK",
        "CHUNK_LIFECYCLE_SOURCE_RISK",
      ],
    });

    expect(
      byId.get(
        "combat-revive-remediation",
      ),
    ).toMatchObject({
      deterministic: false,
      selectionMode: "proposal-only",
      supportedDiagnosticCodes: [
        "COMBAT_REVIVE_POLICY_VIOLATION",
      ],
    });

    expect(
      byId.get(
        "economy-policy-remediation",
      ),
    ).toMatchObject({
      deterministic: false,
      selectionMode: "proposal-only",
      supportedDiagnosticCodes: [
        "ECONOMY_POLICY_CONFLICT",
        "ECONOMY_POLICY_COVERAGE_GAP",
      ],
    });

    expect(
      byId.get(
        "inventory-lifecycle-remediation",
      ),
    ).toMatchObject({
      deterministic: false,
      selectionMode: "proposal-only",
      supportedDiagnosticCodes: [
        "INVENTORY_POLICY_CONFLICT",
        "INVENTORY_LIFECYCLE_COVERAGE_GAP",
      ],
    });

    expect(
      byId.get(
        "entity-ai-navigation-remediation",
      ),
    ).toMatchObject({
      deterministic: false,
      selectionMode: "proposal-only",
      supportedDiagnosticCodes: [
        "ENTITY_AI_NAVIGATION_COVERAGE_GAP",
      ],
    });

    expect(
      byId.get(
        "arena-lifecycle-remediation",
      ),
    ).toMatchObject({
      deterministic: false,
      selectionMode: "proposal-only",
      supportedDiagnosticCodes: [
        "ARENA_LIFECYCLE_COVERAGE_GAP",
      ],
    });

    expect(
      byId.get(
        "spatial-authority-remediation",
      ),
    ).toMatchObject({
      deterministic: false,
      selectionMode: "proposal-only",
      supportedDiagnosticCodes: [
        "SPATIAL_AUTHORITY_POLICY_GAP",
      ],
    });
  });

  it("routes combat revive policy diagnostics to proposal-only remediation without requiring automatic realization", () => {
    const emptyProviders:
      RepairStrategyProviderRegistry = {
        schemaVersion: 1,
        providers: [],
      };
    const enumeration =
      enumerateRepairStrategySources(
        {
          incidentId: "incident-combat",
          candidateId: "cause-revive",
          sourceFingerprint: "source-a",
          chainIds: ["chain-combat"],
          relationIds: [],
          invariantIds: [],
          diagnosticIds: ["diag-combat"],
          diagnosticCodes: [
            "COMBAT_REVIVE_POLICY_VIOLATION",
          ],
          sourceRefs: [],
          exactSourceRefs: [],
          causalBinding: {},
          targetProfileFingerprints: [],
          automaticRealizationAllowed: false,
          reasons: [],
        },
        [{
          id: "diag-combat",
          code:
            "COMBAT_REVIVE_POLICY_VIOLATION",
          severity: "medium",
          message:
            "Observed revive transaction contradicts authored combat policy.",
        }],
        emptyProviders,
        BUILTIN_REPAIR_STRATEGY_SOURCES,
      );

    expect(
      enumeration.applicableSources.find(
        (item) =>
          item.sourceId ===
          "combat-revive-remediation",
      ),
    ).toMatchObject({
      selectionMode: "proposal-only",
      deterministic: false,
      automaticRealizationEligible: false,
    });

    expect(
      assessRepairRealizerCoverage(
        enumeration,
        BUILTIN_REPAIR_REALIZERS,
      ).items.find(
        (item) =>
          item.sourceId ===
          "combat-revive-remediation",
      ),
    ).toMatchObject({
      status: "realizer-not-required",
    });
  });

  it("routes economy policy diagnostics without requiring an automatic realizer", () => {
    const emptyProviders:
      RepairStrategyProviderRegistry = {
        schemaVersion: 1,
        providers: [],
      };
    const enumeration =
      enumerateRepairStrategySources(
        {
          incidentId: "incident-economy",
          candidateId: "cause-economy",
          sourceFingerprint: "source-a",
          chainIds: ["chain-economy"],
          relationIds: [],
          invariantIds: [],
          diagnosticIds: ["diag-economy"],
          diagnosticCodes: [
            "ECONOMY_POLICY_CONFLICT",
          ],
          sourceRefs: [],
          exactSourceRefs: [],
          causalBinding: {},
          targetProfileFingerprints: [],
          automaticRealizationAllowed: false,
          reasons: [],
        },
        [{
          id: "diag-economy",
          code: "ECONOMY_POLICY_CONFLICT",
          severity: "medium",
          message:
            "Authored economy policy conflicts with correlated reward evidence.",
        }],
        emptyProviders,
        BUILTIN_REPAIR_STRATEGY_SOURCES,
      );

    expect(
      enumeration.applicableSources.find(
        (item) =>
          item.sourceId ===
          "economy-policy-remediation",
      ),
    ).toMatchObject({
      selectionMode: "proposal-only",
      deterministic: false,
      automaticRealizationEligible: false,
    });

    expect(
      assessRepairRealizerCoverage(
        enumeration,
        BUILTIN_REPAIR_REALIZERS,
      ).items.find(
        (item) =>
          item.sourceId ===
          "economy-policy-remediation",
      ),
    ).toMatchObject({
      status: "realizer-not-required",
    });
  });

  it("keeps the builtin registry unique and all required realizers covered", () => {
    expect(
      validateRepairStrategySourceRegistry(
        BUILTIN_REPAIR_STRATEGY_SOURCES,
      ),
    ).toEqual([]);

    const report =
      assessRepairRegistryCoverage(
        BUILTIN_REPAIR_STRATEGY_SOURCES,
        BUILTIN_REPAIR_REALIZERS,
      );

    expect(report.complete).toBe(true);
    expect(
      report.missingRequiredRealizers,
    ).toBe(0);
    expect(
      report.incompatibleRealizers,
    ).toBe(0);
  });
});
