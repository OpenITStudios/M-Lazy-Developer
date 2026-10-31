// Same-directory feature suite, retaining original lexical test bodies.
import { describe, expect, it } from "vitest";
import { buildDecisionBasis } from "../../src/workflow/decision-basis.js";
import { BUILTIN_REPAIR_REALIZERS } from "../../src/repair/repair-realizer-registry.js";
import { BUILTIN_REPAIR_STRATEGY_SOURCES } from "../../src/repair/repair-strategy-source-registry.js";
import { SemanticGraph } from "../../../graph/src/index.js";
import { assessSemanticProofReuse, createSemanticProofClaim } from "../../src/workflow/semantic-proof-cache.js";

// Original engine/packages/orchestrator/test/workflow/decision-basis.test.ts; blob 67011b47005efc6baed0889d2f019aa13918be19
{
describe("decision basis", () => {
  it("fingerprints probe bindings independently of input ordering", () => {
    const a = {
      probeId: "a",
      predicate: "a",
      query: {
        kind: "entity-resolvable" as const,
        entityId: "e1",
      },
      outcomeByState: {
        present: "yes",
        absent: "no",
      },
    };
    const b = {
      probeId: "b",
      predicate: "b",
      query: {
        kind: "tag-present" as const,
        subjectKind: "entity" as const,
        subjectId: "e1",
        tag: "ready",
      },
      outcomeByState: {
        present: "yes",
        absent: "no",
      },
    };

    expect(buildDecisionBasis({
      probeBindings: [a, b],
    }).probeBindingRevision).toBe(
      buildDecisionBasis({
        probeBindings: [b, a],
      }).probeBindingRevision,
    );
  });

  it("changes target profile fingerprint when decision context changes", () => {
    const left = buildDecisionBasis({
      target: {
        edition: "bedrock",
        version: "1.26.40",
      },
    });
    const right = buildDecisionBasis({
      target: {
        edition: "education",
        version: "1.26.40",
      },
    });

    expect(left.targetProfileFingerprint)
      .not.toBe(right.targetProfileFingerprint);
  });
  it("fingerprints runtime evidence independently of record ordering", () => {
    const a = {
      predicate: "route-ready",
      state: "present" as const,
      confidence: "observed" as const,
      origin: "telemetry" as const,
      scope: { operationId: "op-a" },
      observedAt: { tick: 10, streamId: "s", sequence: 1 },
    };
    const z = {
      predicate: "entity-stall-observed",
      state: "present" as const,
      confidence: "observed" as const,
      origin: "runtime-probe" as const,
      scope: { operationId: "op-a" },
      observedAt: { tick: 12 },
    };

    expect(buildDecisionBasis({
      runtimeEvidence: [a, z],
    }).runtimeEvidenceRevision).toBe(
      buildDecisionBasis({
        runtimeEvidence: [z, a],
      }).runtimeEvidenceRevision,
    );
  });

  it("changes runtime evidence revision when target binding changes", () => {
    const base = {
      predicate: "route-ready",
      state: "present" as const,
      confidence: "observed" as const,
      origin: "runtime-probe" as const,
      observedAt: { tick: 10 },
    };

    const left = buildDecisionBasis({
      runtimeEvidence: [{
        ...base,
        targetProfileFingerprint: "profile-a",
      }],
    });
    const right = buildDecisionBasis({
      runtimeEvidence: [{
        ...base,
        targetProfileFingerprint: "profile-b",
      }],
    });

    expect(left.runtimeEvidenceRevision)
      .not.toBe(right.runtimeEvidenceRevision);
  });

  it("changes runtime evidence revision when experiment provenance changes", () => {
    const base = {
      predicate: "route-ready",
      state: "present" as const,
      confidence: "observed" as const,
      origin: "controlled-experiment" as const,
      targetProfileFingerprint: "profile-a",
      observedAt: { tick: 10 },
    };

    const left = buildDecisionBasis({
      runtimeEvidence: [{
        ...base,
        provenanceKey: "experiment:a:trial:1",
      }],
    });
    const right = buildDecisionBasis({
      runtimeEvidence: [{
        ...base,
        provenanceKey: "experiment:b:trial:1",
      }],
    });

    expect(left.runtimeEvidenceRevision)
      .not.toBe(right.runtimeEvidenceRevision);
  });

  it("changes runtime evidence revision when observed state or integrity changes", () => {
    const base = {
      predicate: "route-ready",
      state: "present" as const,
      confidence: "observed" as const,
      origin: "telemetry" as const,
      scope: { operationId: "op-a" },
      observedAt: { tick: 10 },
    };

    const left = buildDecisionBasis({
      runtimeEvidence: [base],
      evidenceIntegrity: {
        telemetry: {
          records: 1,
          observedRecords: 1,
          derivedRecords: 0,
          unknownConfidenceRecords: 0,
          unlocatedObservedRecords: 0,
          unresolvedConflictPredicates: [],
          resolvedConflictCount: 0,
          continuityComplete: true,
          telemetryContinuityComplete: true,
          safeForCurrentStateClaims: true,
          safeForTemporalViolationClaims: true,
          reasons: ["healthy"],
        },
      },
    });

    const changedState = buildDecisionBasis({
      runtimeEvidence: [{ ...base, state: "absent" as const }],
      evidenceIntegrity: {
        telemetry: {
          records: 1,
          observedRecords: 1,
          derivedRecords: 0,
          unknownConfidenceRecords: 0,
          unlocatedObservedRecords: 0,
          unresolvedConflictPredicates: [],
          resolvedConflictCount: 0,
          continuityComplete: true,
          telemetryContinuityComplete: true,
          safeForCurrentStateClaims: true,
          safeForTemporalViolationClaims: true,
          reasons: ["healthy"],
        },
      },
    });

    const changedIntegrity = buildDecisionBasis({
      runtimeEvidence: [base],
      evidenceIntegrity: {
        telemetry: {
          records: 1,
          observedRecords: 1,
          derivedRecords: 0,
          unknownConfidenceRecords: 0,
          unlocatedObservedRecords: 1,
          unresolvedConflictPredicates: [],
          resolvedConflictCount: 0,
          continuityComplete: true,
          telemetryContinuityComplete: true,
          safeForCurrentStateClaims: true,
          safeForTemporalViolationClaims: false,
          reasons: ["missing temporal point"],
        },
      },
    });

    expect(left.runtimeEvidenceRevision)
      .not.toBe(changedState.runtimeEvidenceRevision);
    expect(left.runtimeEvidenceRevision)
      .not.toBe(changedIntegrity.runtimeEvidenceRevision);
  });
  it("ignores explanatory note and integrity reason wording in evidence revision", () => {
    const record = {
      predicate: "route-ready",
      state: "present" as const,
      confidence: "observed" as const,
      origin: "telemetry" as const,
      scope: { operationId: "op-a" },
      observedAt: { tick: 10 },
    };

    const commonIntegrity = {
      records: 1,
      observedRecords: 1,
      derivedRecords: 0,
      unknownConfidenceRecords: 0,
      unlocatedObservedRecords: 0,
      unresolvedConflictPredicates: [] as string[],
      resolvedConflictCount: 0,
      continuityComplete: true,
      telemetryContinuityComplete: true,
      safeForCurrentStateClaims: true,
      safeForTemporalViolationClaims: true,
    };

    const left = buildDecisionBasis({
      runtimeEvidence: [{
        ...record,
        note: "first human explanation",
      }],
      evidenceIntegrity: {
        telemetry: {
          ...commonIntegrity,
          reasons: ["wording one"],
        },
      },
    });

    const right = buildDecisionBasis({
      runtimeEvidence: [{
        ...record,
        note: "different human explanation",
      }],
      evidenceIntegrity: {
        telemetry: {
          ...commonIntegrity,
          reasons: ["wording two"],
        },
      },
    });

    expect(left.runtimeEvidenceRevision)
      .toBe(right.runtimeEvidenceRevision);
  });

  it("changes semantic IR revision when execution semantics change", () => {
    const source = {
      artifactId: "a",
      relativePath: "scripts/main.js",
    };
    const base = {
      schemaVersion: 1 as const,
      execution: {
        regions: [{
          id: "exec:a",
          kind: "script-module" as const,
          ownerId: "main",
          label: "module",
          source,
        }],
        edges: [],
      },
      state: {
        surfaces: [],
        operations: [],
        authorityBindings: [],
      },
      temporal: {
        relations: [],
      },
    };

    const changed = {
      ...base,
      execution: {
        ...base.execution,
        regions: [
          ...base.execution.regions,
          {
            id: "exec:b",
            kind: "script-callback" as const,
            ownerId: "main",
            label: "callback",
            source,
          },
        ],
      },
    };

    expect(buildDecisionBasis({
      semanticIr: base,
    }).semanticIrRevision).not.toBe(
      buildDecisionBasis({
        semanticIr: changed,
      }).semanticIrRevision,
    );
  });

  it("fingerprints preservation contract and baseline independently", () => {
    const contract = {
      schemaVersion: 1 as const,
      id: "preserve:tx-1",
      transactionId: "tx-1",
      mustChangeInvariantIds: ["inv:broken"],
      mustPreserveInvariantIds: ["inv:healthy"],
    };
    const baseline = {
      schemaVersion: 1 as const,
      contractId: contract.id,
      sourceFingerprint: "source-a",
      invariantResults: [{
        invariantId: "inv:broken",
        state: "violated" as const,
        evidenceIds: ["before:broken"],
      }, {
        invariantId: "inv:healthy",
        state: "satisfied" as const,
        evidenceIds: ["before:healthy"],
      }],
    };

    const left = buildDecisionBasis({
      preservationContract: contract,
      preservationBaseline: baseline,
    });
    const changedContract = buildDecisionBasis({
      preservationContract: {
        ...contract,
        mustPreserveInvariantIds: ["inv:healthy", "inv:other"],
      },
      preservationBaseline: baseline,
    });
    const changedBaseline = buildDecisionBasis({
      preservationContract: contract,
      preservationBaseline: {
        ...baseline,
        sourceFingerprint: "source-b",
      },
    });

    expect(left.preservationContractRevision)
      .not.toBe(changedContract.preservationContractRevision);
    expect(left.preservationBaselineRevision)
      .not.toBe(changedBaseline.preservationBaselineRevision);
  });

  it("binds decision basis to repair realizer registry revision", () => {
    const left = buildDecisionBasis({
      repairRealizerRegistry:
        BUILTIN_REPAIR_REALIZERS,
    });
    const right = buildDecisionBasis({
      repairRealizerRegistry: {
        ...BUILTIN_REPAIR_REALIZERS,
        realizers:
          BUILTIN_REPAIR_REALIZERS.realizers.map(
            (item) => ({
              ...item,
              version: item.version + ".next",
            }),
          ),
      },
    });

    expect(left.repairRealizerRegistryRevision)
      .toMatch(/^[a-f0-9]{64}$/);
    expect(left.repairRealizerRegistryRevision)
      .not.toBe(
        right.repairRealizerRegistryRevision,
      );
  });

  it("binds decision basis to repair strategy source registry revision", () => {
    const left = buildDecisionBasis({
      repairStrategySourceRegistry:
        BUILTIN_REPAIR_STRATEGY_SOURCES,
    });
    const right = buildDecisionBasis({
      repairStrategySourceRegistry: {
        ...BUILTIN_REPAIR_STRATEGY_SOURCES,
        sources:
          BUILTIN_REPAIR_STRATEGY_SOURCES.sources.map(
            (item) => ({
              ...item,
              version: item.version + ".next",
            }),
          ),
      },
    });

    expect(left.repairStrategySourceRegistryRevision)
      .toMatch(/^[a-f0-9]{64}$/);
    expect(left.repairStrategySourceRegistryRevision)
      .not.toBe(
        right.repairStrategySourceRegistryRevision,
      );
  });

  it("always binds the canonical contract registry revision", () => {
    const basis = buildDecisionBasis({});
    expect(basis.contractRegistryRevision)
      .toMatch(/^[a-f0-9]{64}$/);
  });

});
}

// Original engine/packages/orchestrator/test/workflow/semantic-proof-cache.test.ts; blob 6664f42ea9deec4d1e5e90f763f52793d76d061d
{
function graph(
  changedShop = false,
  changedArena = false,
): SemanticGraph {
  const value =
    new SemanticGraph();

  value.addNode({
    id: "function:pack:arena",
    identity: {
      kind: "function",
      scope: "pack",
      identifier: "arena",
    },
    kind: "function",
    identifier: "arena",
    source: {
      artifactId: "map",
      relativePath:
        "functions/arena.mcfunction",
    },
    contentHash:
      changedArena
        ? "arena-v2"
        : "arena-v1",
  });

  value.addNode({
    id: "function:pack:shop",
    identity: {
      kind: "function",
      scope: "pack",
      identifier: "shop",
    },
    kind: "function",
    identifier: "shop",
    source: {
      artifactId: "map",
      relativePath:
        "functions/shop.mcfunction",
    },
    contentHash:
      changedShop
        ? "shop-v2"
        : "shop-v1",
  });

  return value;
}

describe("semantic proof cache", () => {
  it("requires runtime claims to bind an exact runtime profile", () => {
    expect(() =>
      createSemanticProofClaim({
        claimId: "claim:runtime-unbound",
        claimRevision: "1",
        kind: "runtime",
        graph: graph(),
        basisNodeIds: [
          "function:pack:arena",
        ],
        evidenceIds: [
          "runtime:arena:1",
        ],
      })
    ).toThrow(
      /targetProfileFingerprint/,
    );
  });

  it("blocks reuse when stored evidence is no longer available", () => {
    const claim =
      createSemanticProofClaim({
        claimId: "claim:evidence",
        claimRevision: "1",
        kind: "static",
        graph: graph(),
        basisNodeIds: [
          "function:pack:arena",
        ],
        evidenceIds: [
          "evidence:required",
        ],
      });

    const result =
      assessSemanticProofReuse(
        claim,
        {
          graph: graph(),
          claimRevision: "1",
          availableEvidenceIds: [],
        },
      );

    expect(result.status)
      .toBe("blocked");
  });
  it("reuses proof when unrelated semantic nodes change", () => {
    const claim =
      createSemanticProofClaim({
        claimId:
          "claim:arena-capacity",
        claimRevision: "1",
        kind: "validation",
        graph: graph(),
        basisNodeIds: [
          "function:pack:arena",
        ],
        evidenceIds: [
          "validation:arena:1",
        ],
      });

    const result =
      assessSemanticProofReuse(
        claim,
        {
          graph: graph(true, false),
          claimRevision: "1",
          availableEvidenceIds: [
            "validation:arena:1",
          ],
        },
      );

    expect(result.status)
      .toBe("reusable");
  });

  it("invalidates proof when a basis node changes", () => {
    const claim =
      createSemanticProofClaim({
        claimId:
          "claim:arena-capacity",
        claimRevision: "1",
        kind: "validation",
        graph: graph(),
        basisNodeIds: [
          "function:pack:arena",
        ],
        evidenceIds: [
          "validation:arena:1",
        ],
      });

    const result =
      assessSemanticProofReuse(
        claim,
        {
          graph:
            graph(false, true),
          claimRevision: "1",
          availableEvidenceIds: [
            "validation:arena:1",
            "semantic:scoreboard:1",
            "semantic:edge:1",
          ],
        },
      );

    expect(result.status)
      .toBe("stale");
  });

  it("invalidates arena runtime proof when generation changes", () => {
    const claim =
      createSemanticProofClaim({
        claimId: "claim:arena-generation",
        claimRevision: "1",
        kind: "runtime",
        graph: graph(),
        basisNodeIds: ["function:pack:arena"],
        evidenceIds: ["runtime:arena:g4"],
        targetProfileFingerprint: "runtime-a",
        runtimeScope: {
          arenaId: "arena-2",
          arenaGeneration: 4,
        },
      });

    const result =
      assessSemanticProofReuse(claim, {
        graph: graph(),
        claimRevision: "1",
        availableEvidenceIds: ["runtime:arena:g4"],
        targetProfileFingerprint: "runtime-a",
        runtimeScope: {
          arenaId: "arena-2",
          arenaGeneration: 5,
        },
      });

    expect(result.status).toBe("stale");
  });

  it("invalidates proof when its evidence is explicitly stale", () => {
    const claim =
      createSemanticProofClaim({
        claimId: "claim:stale-evidence",
        claimRevision: "1",
        kind: "static",
        graph: graph(),
        basisNodeIds: ["function:pack:arena"],
        evidenceIds: ["evidence:old"],
      });

    const result =
      assessSemanticProofReuse(claim, {
        graph: graph(),
        claimRevision: "1",
        availableEvidenceIds: ["evidence:old"],
        staleEvidenceIds: ["evidence:old"],
      });

    expect(result.status).toBe("stale");
  });

  it("rejects mixed runtime generations inside one reused proof campaign", () => {
    const claim =
      createSemanticProofClaim({
        claimId: "claim:mixed-generation",
        claimRevision: "1",
        kind: "runtime",
        graph: graph(),
        basisNodeIds: ["function:pack:arena"],
        evidenceIds: ["runtime:a", "runtime:b"],
        targetProfileFingerprint: "runtime-a",
        runtimeScope: {
          arenaId: "arena-2",
          arenaGeneration: 4,
        },
      });

    const result =
      assessSemanticProofReuse(claim, {
        graph: graph(),
        claimRevision: "1",
        availableEvidenceIds: ["runtime:a", "runtime:b"],
        targetProfileFingerprint: "runtime-a",
        runtimeScope: {
          arenaId: "arena-2",
          arenaGeneration: 4,
        },
        runtimeEvidenceRecords: [{
          predicate: "ready",
          state: "present",
          confidence: "observed",
          targetProfileFingerprint: "runtime-a",
          scope: {
            arenaId: "arena-2",
            arenaGeneration: 4,
          },
        }, {
          predicate: "released",
          state: "present",
          confidence: "observed",
          targetProfileFingerprint: "runtime-a",
          scope: {
            arenaId: "arena-2",
            arenaGeneration: 5,
          },
        }],
      });

    expect(result.status).toBe("stale");
  });

  it("invalidates runtime-bound proof when target profile changes", () => {
    const claim =
      createSemanticProofClaim({
        claimId:
          "claim:arena-runtime",
        claimRevision: "1",
        kind: "runtime",
        graph: graph(),
        basisNodeIds: [
          "function:pack:arena",
        ],
        evidenceIds: [
          "runtime:arena:1",
        ],
        targetProfileFingerprint:
          "runtime-a",
      });

    const result =
      assessSemanticProofReuse(
        claim,
        {
          graph: graph(),
          claimRevision: "1",
          availableEvidenceIds: [
            "runtime:arena:1",
          ],
          targetProfileFingerprint:
            "runtime-b",
        },
      );

    expect(result.status)
      .toBe("stale");
  });

  it("invalidates a derived-node proof when an incident source node changes even if topology stays the same", () => {
    const before = graph();
    before.addNode({
      id: "scoreboard:pack:round",
      identity: {
        kind: "scoreboard_objective",
        scope: "pack",
        identifier: "round",
      },
      kind: "scoreboard_objective",
      identifier: "round",
      source: {
        artifactId: "map",
        relativePath: "<derived>",
      },
    });
    before.addEdge({
      from: "function:pack:arena",
      type: "READS_SCOREBOARD",
      targetIdentifier: "round",
      status: "resolved",
      to: "scoreboard:pack:round",
      evidence: {
        source: {
          artifactId: "map",
          relativePath:
            "functions/arena.mcfunction",
        },
      },
    });

    const claim =
      createSemanticProofClaim({
        claimId:
          "claim:derived-scoreboard",
        claimRevision: "1",
        kind: "semantic",
        graph: before,
        basisNodeIds: [
          "scoreboard:pack:round",
        ],
        evidenceIds: [
          "semantic:scoreboard:1",
        ],
      });

    const after =
      graph(false, true);
    after.addNode({
      id: "scoreboard:pack:round",
      identity: {
        kind: "scoreboard_objective",
        scope: "pack",
        identifier: "round",
      },
      kind: "scoreboard_objective",
      identifier: "round",
      source: {
        artifactId: "map",
        relativePath: "<derived>",
      },
    });
    after.addEdge({
      from: "function:pack:arena",
      type: "READS_SCOREBOARD",
      targetIdentifier: "round",
      status: "resolved",
      to: "scoreboard:pack:round",
      evidence: {
        source: {
          artifactId: "map",
          relativePath:
            "functions/arena.mcfunction",
        },
      },
    });

    const result =
      assessSemanticProofReuse(
        claim,
        {
          graph: after,
          claimRevision: "1",
          availableEvidenceIds: [
            "semantic:scoreboard:1",
          ],
        },
      );

    expect(result.status)
      .toBe("stale");
  });

  it("invalidates proof when an incident dependency edge changes", () => {
    const before = graph();
    before.addEdge({
      from:
        "function:pack:shop",
      type: "CALLS",
      targetIdentifier: "arena",
      status: "resolved",
      to:
        "function:pack:arena",
      evidence: {
        source: {
          artifactId: "map",
          relativePath:
            "functions/shop.mcfunction",
        },
      },
    });

    const claim =
      createSemanticProofClaim({
        claimId:
          "claim:arena-edge",
        claimRevision: "1",
        kind: "semantic",
        graph: before,
        basisNodeIds: [
          "function:pack:arena",
        ],
        evidenceIds: [
          "semantic:edge:1",
        ],
      });

    const result =
      assessSemanticProofReuse(
        claim,
        {
          graph: graph(),
          claimRevision: "1",
          availableEvidenceIds: [
            "validation:arena:1",
            "semantic:scoreboard:1",
            "semantic:edge:1",
          ],
        },
      );

    expect(result.status)
      .toBe("stale");
  });
});
}
