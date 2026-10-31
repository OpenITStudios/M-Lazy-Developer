// Same-directory feature/lane test consolidation, original cases kept in lexical blocks.
import { describe, expect, it } from "vitest";
import { parseDecisionLedgerSnapshot, validateDecisionLedgerSnapshot } from "../../src/evidence/decision-ledger-validate.js";
import { parseInvariantRegistrySnapshot, validateInvariantRegistrySnapshot } from "../../src/evidence/invariant-registry-validate.js";

// Original engine/packages/project-model/test/evidence/decision-ledger-validate.test.ts; SHA 08a4e3b0380916c7997b6abe5fb390db7df8938c
{
function entry(
  id: string,
  sequence: number,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    kind: "repair-admission",
    status: "active",
    basis: {},
    upstreamDecisionIds: [],
    inputIds: [],
    outputIds: [],
    evidenceIds: [],
    createdSequence: sequence,
    ...overrides,
  };
}

describe("decision ledger validation", () => {
  it("accepts a valid append-only decision DAG", () => {
    const snapshot = {
      schemaVersion: 1,
      entries: [
        entry("parent", 1),
        entry("child", 2, {
          upstreamDecisionIds: ["parent"],
        }),
      ],
    };

    expect(parseDecisionLedgerSnapshot(snapshot))
      .toEqual(snapshot);
  });

  it("rejects missing and forward upstream decisions", () => {
    expect(validateDecisionLedgerSnapshot({
      schemaVersion: 1,
      entries: [
        entry("child", 1, {
          upstreamDecisionIds: ["missing"],
        }),
      ],
    }).join(" ")).toMatch(/missing upstream decision/);

    expect(validateDecisionLedgerSnapshot({
      schemaVersion: 1,
      entries: [
        entry("child", 1, {
          upstreamDecisionIds: ["parent"],
        }),
        entry("parent", 2),
      ],
    }).join(" ")).toMatch(/must be older/);
  });

  it("rejects an active child of an invalidated parent", () => {
    expect(validateDecisionLedgerSnapshot({
      schemaVersion: 1,
      entries: [
        entry("parent", 1, {
          status: "invalidated",
          invalidationReason: "basis changed",
        }),
        entry("child", 2, {
          upstreamDecisionIds: ["parent"],
        }),
      ],
    }).join(" ")).toMatch(/depends on non-active/);
  });

  it("rejects non-monotonic sequence order", () => {
    expect(validateDecisionLedgerSnapshot({
      schemaVersion: 1,
      entries: [
        entry("a", 2),
        entry("b", 1),
      ],
    }).join(" ")).toMatch(/strictly increasing/);
  });

  it("rejects supersession by an older decision", () => {
    expect(validateDecisionLedgerSnapshot({
      schemaVersion: 1,
      entries: [
        entry("old", 1),
        entry("new", 2, {
          status: "superseded",
          supersededBy: "old",
        }),
      ],
    }).join(" ")).toMatch(/newer decision/);
  });

  it("rejects duplicate ids and duplicate lineage values", () => {
    const errors = validateDecisionLedgerSnapshot({
      schemaVersion: 1,
      entries: [
        entry("a", 1),
        entry("a", 2, {
          upstreamDecisionIds: ["a", "a"],
        }),
      ],
    }).join(" ");

    expect(errors).toMatch(/Duplicate decision ledger id/);
    expect(errors).toMatch(/duplicate value/);
  });

  it("rejects unknown or empty decision basis revisions", () => {
    const base = {
      schemaVersion: 1,
      entries: [{
        id: "d1",
        kind: "repair-authorization",
        status: "active",
        basis: {
          contractRegistryRevision: "",
          contractRegsitryRevision: "typo",
        },
        upstreamDecisionIds: [],
        inputIds: [],
        outputIds: [],
        evidenceIds: [],
        createdSequence: 1,
      }],
    };

    const errors = validateDecisionLedgerSnapshot(base);
    expect(errors.join(" ")).toMatch(/contractRegistryRevision/);
    expect(errors.join(" ")).toMatch(/unknown field contractRegsitryRevision/);
  });


  it("rejects runtime verification without runtime evidence revision", () => {
    const errors = validateDecisionLedgerSnapshot({
      schemaVersion: 1,
      entries: [{
        id: "runtime",
        kind: "runtime-verification",
        status: "active",
        transactionId: "tx-1",
        basis: {},
        upstreamDecisionIds: [],
        inputIds: [],
        outputIds: ["runtime-verification:passed"],
        evidenceIds: ["runtime:pass"],
        createdSequence: 1,
      }],
    });

    expect(errors.join(" "))
      .toMatch(/runtime-verification requires runtimeEvidenceRevision/);
  });

  it("rejects provider provenance without provider registry revision", () => {
    const errors = validateDecisionLedgerSnapshot({
      schemaVersion: 1,
      entries: [{
        id: "strategy",
        kind: "repair-strategy-selection",
        status: "active",
        transactionId: "tx-1",
        basis: {
          invariantRegistryRevision: "inv-r1",
        },
        upstreamDecisionIds: [],
        inputIds: ["repair-provider:provider@1"],
        outputIds: [
          "repair-strategy:selected",
          "repair-invariant:inv-1",
        ],
        evidenceIds: [],
        createdSequence: 1,
      }],
    });

    expect(errors.join(" "))
      .toMatch(/repairProviderRegistryRevision/);
  });

  it("rejects invariant provenance without invariant registry revision", () => {
    const errors = validateDecisionLedgerSnapshot({
      schemaVersion: 1,
      entries: [{
        id: "strategy",
        kind: "repair-strategy-selection",
        status: "active",
        transactionId: "tx-1",
        basis: {},
        upstreamDecisionIds: [],
        inputIds: [],
        outputIds: [
          "repair-strategy:selected",
          "repair-invariant:inv-1",
        ],
        evidenceIds: [],
        createdSequence: 1,
      }],
    });

    expect(errors.join(" "))
      .toMatch(/invariantRegistryRevision/);
  });

  it("rejects provider-bound strategy basis without provider provenance", () => {
    const errors = validateDecisionLedgerSnapshot({
      schemaVersion: 1,
      entries: [{
        id: "strategy",
        kind: "repair-strategy-selection",
        status: "active",
        transactionId: "tx-1",
        basis: {
          repairProviderRegistryRevision: "providers-r1",
        },
        upstreamDecisionIds: [],
        inputIds: [],
        outputIds: ["repair-strategy:selected"],
        evidenceIds: [],
        createdSequence: 1,
      }],
    });

    expect(errors.join(" "))
      .toMatch(/requires repair-provider provenance/);
  });

});
}

// Original engine/packages/project-model/test/evidence/invariant-registry-validate.test.ts; SHA f9e1e357ba11b3ec8bd41d3dcec421b85d502141
{
function entry(overrides: Record<string, unknown> = {}) {
  return {
    id: "invariant:ready",
    source: {
      kind: "manual-policy",
      id: "policy",
      revision: "r1",
    },
    enforcement: "runtime-state",
    minimumRepairClaim: "proven-runtime",
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
    ...overrides,
  };
}

describe("invariant registry validation", () => {
  it("accepts a coherent executable registry", () => {
    const snapshot = {
      schemaVersion: 1,
      revision: "registry-r1",
      profileKey: "bedrock:1.26.40",
      entries: [entry()],
    };

    expect(parseInvariantRegistrySnapshot(snapshot))
      .toEqual(snapshot);
  });

  it("rejects duplicate invariant ids", () => {
    const errors = validateInvariantRegistrySnapshot({
      schemaVersion: 1,
      revision: "registry-r1",
      profileKey: "bedrock:1.26.40",
      entries: [entry(), entry()],
    });

    expect(errors.join(" ")).toMatch(/Duplicate invariant registry id/);
  });

  it("rejects runtime-state enforcement without state requirements", () => {
    const errors = validateInvariantRegistrySnapshot({
      schemaVersion: 1,
      revision: "registry-r1",
      profileKey: "bedrock:1.26.40",
      entries: [entry({
        stateRequirements: [],
      })],
    });

    expect(errors.join(" ")).toMatch(/requires stateRequirements/);
  });

  it("rejects runtime-temporal enforcement without temporal requirements", () => {
    const errors = validateInvariantRegistrySnapshot({
      schemaVersion: 1,
      revision: "registry-r1",
      profileKey: "bedrock:1.26.40",
      entries: [entry({
        enforcement: "runtime-temporal",
        stateRequirements: [],
        temporalRequirements: [],
      })],
    });

    expect(errors.join(" ")).toMatch(/requires temporalRequirements/);
  });

  it("rejects diagnostic-only runtime execution semantics", () => {
    const errors = validateInvariantRegistrySnapshot({
      schemaVersion: 1,
      revision: "registry-r1",
      profileKey: "bedrock:1.26.40",
      entries: [entry({
        enforcement: "diagnostic-only",
        minimumRepairClaim: "hypothesis",
        stateRequirements: [],
        temporalRequirements: [],
        revalidationLayers: ["static", "runtime", "package"],
      })],
    });

    expect(errors.join(" ")).toMatch(/diagnostic-only/);
  });

  it("rejects duplicate revalidation layers", () => {
    const errors = validateInvariantRegistrySnapshot({
      schemaVersion: 1,
      revision: "registry-r1",
      profileKey: "bedrock:1.26.40",
      entries: [entry({
        revalidationLayers: ["runtime", "runtime"],
      })],
    });

    expect(errors.join(" ")).toMatch(/duplicate revalidation layer/);
  });

  it("rejects malformed runtime requirement payloads", () => {
    const errors = validateInvariantRegistrySnapshot({
      schemaVersion: 1,
      revision: "registry-r1",
      profileKey: "bedrock:1.26.40",
      entries: [entry({
        stateRequirements: [{
          id: "ready",
          predicate: "",
          expectedState: "unknown",
          scope: {
            arenaGeneration: -1,
            typoScopeField: "bad",
          },
        }],
      })],
    });

    const joined = errors.join(" ");
    expect(joined).toMatch(/predicate must be non-empty/);
    expect(joined).toMatch(/expectedState must be present or absent/);
    expect(joined).toMatch(/arenaGeneration/);
    expect(joined).toMatch(/unknown field typoScopeField/);
  });

  it("rejects duplicate runtime requirement ids", () => {
    const errors = validateInvariantRegistrySnapshot({
      schemaVersion: 1,
      revision: "registry-r1",
      profileKey: "bedrock:1.26.40",
      entries: [entry({
        stateRequirements: [{
          id: "same",
          predicate: "a",
          expectedState: "present",
        }, {
          id: "same",
          predicate: "b",
          expectedState: "absent",
        }],
      })],
    });

    expect(errors.join(" "))
      .toMatch(/duplicate state requirement id same/);
  });

  it("rejects malformed temporal requirements", () => {
    const errors = validateInvariantRegistrySnapshot({
      schemaVersion: 1,
      revision: "registry-r1",
      profileKey: "bedrock:1.26.40",
      entries: [entry({
        enforcement: "runtime-temporal",
        stateRequirements: [],
        temporalRequirements: [{
          id: "order",
          beforePredicate: "",
          afterPredicate: "after",
          maxTickDelta: -1,
          scope: {
            operationId: "",
          },
        }],
      })],
    });

    const joined = errors.join(" ");
    expect(joined).toMatch(/beforePredicate must be non-empty/);
    expect(joined).toMatch(/maxTickDelta/);
    expect(joined).toMatch(/operationId/);
  });

  it("rejects duplicate temporal requirement ids", () => {
    const errors = validateInvariantRegistrySnapshot({
      schemaVersion: 1,
      revision: "registry-r1",
      profileKey: "bedrock:1.26.40",
      entries: [entry({
        enforcement: "runtime-temporal",
        stateRequirements: [],
        temporalRequirements: [{
          id: "same",
          beforePredicate: "a",
          afterPredicate: "b",
        }, {
          id: "same",
          beforePredicate: "b",
          afterPredicate: "c",
        }],
      })],
    });

    expect(errors.join(" "))
      .toMatch(/duplicate temporal requirement id same/);
  });

});
}
