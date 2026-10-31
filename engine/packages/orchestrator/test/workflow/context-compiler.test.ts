// Bounded same-directory feature family; preserve original lexical bodies.
import { describe, expect, it } from "vitest";
import { SemanticGraph } from "../../../graph/src/index.js";
import type { GameplayIntentModel } from "../../../gameplay-intent/src/index.js";
import { compileContextPack } from "../../src/workflow/context-compiler.js";
import type { RetrievalResult } from "../../../analysis-planner/src/index.js";
import { compileResourceContext, compileSectionContext, compileDeveloperPracticeReferenceContext, prepareDeveloperPracticeReferenceSelector } from "../../src/workflow/resource-context.js";
import type { RetrievedKnowledgeContext } from "../../src/workflow/resource-context.js";

// Original engine/packages/orchestrator/test/workflow/context-compiler.test.ts, source blob 5e7f683b43755c4373b935c21f687bfbf57afc22
{
function fixtureGraph() {
  const graph =
    new SemanticGraph();
  for (const id of [
    "arena",
    "shop",
    "unrelated",
  ]) {
    graph.addNode({
      id: "function:pack:" + id,
      identity: {
        kind: "function",
        scope: "pack",
        identifier: id,
      },
      kind: "function",
      identifier: id,
      source: {
        artifactId: "map",
        relativePath:
          "functions/" +
          id +
          ".mcfunction",
      },
    });
  }
  graph.addEdge({
    from: "function:pack:arena",
    type: "CALLS",
    targetIdentifier: "shop",
    status: "resolved",
    to: "function:pack:shop",
    evidence: {
      source: {
        artifactId: "map",
        relativePath:
          "functions/arena.mcfunction",
      },
    },
  });
  return graph;
}

const intent: GameplayIntentModel = {
  schemaVersion: 1,
  id: "intent:map",
  evidence: [{
    id: "e:arena",
    origin: "source-code",
    locator:
      "functions/arena.mcfunction",
    summary: "arena state",
  }, {
    id: "e:shop",
    origin: "source-code",
    locator:
      "functions/shop.mcfunction",
    summary: "shop state",
  }],
  nodes: [{
    id: "intent:arena",
    kind: "mechanic",
    label: "Arena",
    status: "authored",
    evidenceIds: ["e:arena"],
  }, {
    id: "intent:shop",
    kind: "mechanic",
    label: "Shop",
    status: "authored",
    evidenceIds: ["e:shop"],
  }],
  edges: [],
  invariants: [{
    id: "inv:arena",
    statement:
      "Player belongs to one arena",
    strength: "must",
    status: "authored",
    subjectIds: ["intent:arena"],
    evidenceIds: ["e:arena"],
  }],
  unknowns: [{
    id: "unknown:arena",
    question: "Arena cleanup?",
    blockedSubjectIds: [
      "intent:arena",
    ],
    evidenceIds: ["e:arena"],
  }],
};

describe("context compiler", () => {
  it("restricts semantic context to affected nodes and explicit intent subjects", () => {
    const pack =
      compileContextPack({
        goal: "diagnose arena",
        graph: fixtureGraph(),
        intent,
        affected: {
          status: "planned",
          changedNodeIds: [
            "function:pack:arena",
          ],
          affectedNodeIds: [
            "function:pack:arena",
          ],
          skippedNodeIds: [
            "function:pack:shop",
            "function:pack:unrelated",
          ],
          affectedPaths: [
            "functions/arena.mcfunction",
          ],
          knownPaths: [
            "functions/arena.mcfunction",
            "functions/shop.mcfunction",
            "functions/unrelated.mcfunction",
          ],
          totalNodeCount: 3,
          changedNodeCount: 1,
          affectedNodeCount: 1,
          skippedNodeCount: 2,
          skipRatio: 2 / 3,
          reasons: [],
        },
        relevantIntentSubjectIds: [
          "intent:arena",
        ],
      });

    expect(
      pack.semantic.nodes.map(
        (node) => node.id,
      ),
    ).toEqual([
      "function:pack:arena",
    ]);
    expect(
      pack.intent.nodes.map(
        (node) => node.id,
      ),
    ).toEqual([
      "intent:arena",
    ]);
    expect(
      pack.intent.evidence.map(
        (item) => item.id,
      ),
    ).toEqual(["e:arena"]);
    expect(pack.semantic.edges)
      .toHaveLength(1);
    expect(
      pack.semantic.edges[0]?.type,
    ).toBe("CALLS");
  });

  it("uses explicit invariant and evidence relationships to avoid unrelated intent nodes", () => {
    const byInvariant =
      compileContextPack({
        goal: "invariant-only",
        graph: fixtureGraph(),
        intent,
        relevantInvariantIds: [
          "inv:arena",
        ],
      });

    expect(
      byInvariant.intent.nodes.map(
        (node) => node.id,
      ),
    ).toEqual([
      "intent:arena",
    ]);

    const byEvidence =
      compileContextPack({
        goal: "evidence-only",
        graph: fixtureGraph(),
        intent,
        relevantEvidenceIds: [
          "e:shop",
        ],
      });

    expect(
      byEvidence.intent.nodes.map(
        (node) => node.id,
      ),
    ).toEqual([
      "intent:shop",
    ]);
  });

  it("does not widen to every intent node when explicit evidence has no subject binding", () => {
    const pack =
      compileContextPack({
        goal: "evidence-no-subject",
        graph: fixtureGraph(),
        intent: {
          ...intent,
          evidence: [
            ...intent.evidence,
            {
              id: "e:global",
              origin: "source-code",
              locator:
                "global/source",
              summary:
                "global evidence",
            },
          ],
        },
        relevantEvidenceIds: [
          "e:global",
        ],
      });

    expect(pack.intent.nodes)
      .toEqual([]);
    expect(
      pack.intent.evidence.map(
        (item) => item.id,
      ),
    ).toEqual(["e:global"]);
  });

  it("reports truncation instead of silently overloading context", () => {
    const pack =
      compileContextPack({
        goal: "bounded",
        graph: fixtureGraph(),
        intent,
        budget: {
          maxSemanticNodes: 1,
          maxSemanticEdges: 1,
          maxIntentNodes: 1,
        },
      });

    expect(
      pack.semantic.nodes,
    ).toHaveLength(1);
    expect(
      pack.truncation
        .semanticNodes,
    ).toBe(2);
    expect(
      pack.truncation.intentNodes,
    ).toBe(1);
    expect(pack.complete)
      .toBe(false);
  });

  it("allows optional truncation when explicit required scope is fully retained", () => {
    const pack =
      compileContextPack({
        goal: "scoped-bounded",
        graph: fixtureGraph(),
        intent,
        relevantSemanticNodeIds: [
          "function:pack:arena",
        ],
        relevantIntentSubjectIds: [
          "intent:arena",
        ],
        budget: {
          maxSemanticNodes: 1,
          maxSemanticEdges: 1,
          maxIntentNodes: 1,
        },
      });

    expect(pack.complete)
      .toBe(true);
    expect(
      pack.semantic.nodes.map(
        (node) => node.id,
      ),
    ).toEqual([
      "function:pack:arena",
    ]);
    expect(
      pack.truncation.semanticNodes,
    ).toBeGreaterThan(0);
  });

  it("includes explicitly required semantic nodes even when they are outside the affected closure", () => {
    const pack =
      compileContextPack({
        goal: "explicit-outside-affected",
        graph: fixtureGraph(),
        intent,
        affected: {
          status: "planned",
          changedNodeIds: [
            "function:pack:arena",
          ],
          affectedNodeIds: [
            "function:pack:arena",
          ],
          skippedNodeIds: [
            "function:pack:shop",
            "function:pack:unrelated",
          ],
          affectedPaths: [
            "functions/arena.mcfunction",
          ],
          knownPaths: [
            "functions/arena.mcfunction",
            "functions/shop.mcfunction",
            "functions/unrelated.mcfunction",
          ],
          totalNodeCount: 3,
          changedNodeCount: 1,
          affectedNodeCount: 1,
          skippedNodeCount: 2,
          skipRatio: 2 / 3,
          reasons: [],
        },
        relevantSemanticNodeIds: [
          "function:pack:shop",
        ],
      });

    expect(
      pack.semantic.nodes.map(
        (node) => node.id,
      ),
    ).toContain(
      "function:pack:shop",
    );
  });

  it("rejects a budget smaller than explicitly required relationships", () => {
    expect(() =>
      compileContextPack({
        goal: "too-small-edge-budget",
        graph: fixtureGraph(),
        intent,
        relevantSemanticNodeIds: [
          "function:pack:arena",
        ],
        budget: {
          maxSemanticEdges: 1,
        },
      })
    ).not.toThrow();

    expect(() =>
      compileContextPack({
        goal: "too-small-node-budget",
        graph: fixtureGraph(),
        intent,
        relevantSemanticNodeIds: [
          "function:pack:arena",
          "function:pack:shop",
        ],
        budget: {
          maxSemanticNodes: 1,
        },
      })
    ).toThrow(
      /maxSemanticNodes/,
    );
  });

  it("marks the pack incomplete when a requested invariant points to a missing subject", () => {
    const pack =
      compileContextPack({
        goal:
          "dangling-invariant-subject",
        graph: fixtureGraph(),
        intent: {
          ...intent,
          invariants: [{
            id: "inv:dangling",
            statement:
              "Missing subject must hold",
            strength: "must",
            status: "authored",
            subjectIds: [
              "intent:missing-subject",
            ],
            evidenceIds: [
              "e:arena",
            ],
          }],
        },
        relevantInvariantIds: [
          "inv:dangling",
        ],
      });

    expect(pack.complete)
      .toBe(false);
    expect(
      pack.missingRequested
        .intentSubjectIds,
    ).toEqual([
      "intent:missing-subject",
    ]);
  });

  it("marks the pack incomplete when explicitly requested ids are missing", () => {
    const pack =
      compileContextPack({
        goal: "missing",
        graph: fixtureGraph(),
        intent,
        relevantIntentSubjectIds: [
          "intent:missing",
        ],
        relevantEvidenceIds: [
          "e:missing",
        ],
      });

    expect(pack.complete)
      .toBe(false);
    expect(
      pack.missingRequested
        .semanticNodeIds,
    ).toEqual([]);
    expect(
      pack.missingRequested
        .intentSubjectIds,
    ).toEqual([
      "intent:missing",
    ]);
    expect(
      pack.missingRequested
        .evidenceIds,
    ).toEqual([
      "e:missing",
    ]);
  });

  it("passes target applicability to the model-facing context for selected Knowledge", () => {
    const resourceId = "knowledge.persistence.dynamic-properties-survive-restart";
    const result = compileContextPack({
      goal: "examine persistent state",
      graph: fixtureGraph(),
      intent,
      resourceSelection: [{
        resource: {
          id: resourceId, class: "KNOWLEDGE", domain: "persistence",
          authority: "REFERENCE",
          path: "engine/knowledge/world-engine/persistence-bedrock.json",
          locator: "persistence.dynamic-properties-survive-restart",
          lifecycle: "ACTIVE",
        },
        score: { routing: 30, graph: 0, structural: 8, lexical: 30, semantic: 0, authority: 10, total: 78 },
        reasons: ["lexical-rank"],
      }],
      resourceKnowledge: {
        [resourceId]: {
          kind: "fact",
          subject: "dynamic properties",
          summary: "World dynamic properties survive restart.",
          classification: "engine-fact",
          applicability: { editions: ["education"] },
          applicabilityStatus: "NOT_EVALUATED",
          sourceIds: ["official"],
          sources: [{
            id: "official", title: "Official reference",
            url: "https://learn.microsoft.com/en-us/minecraft/creator/",
            authority: "official", confidence: "documented", retrievedDate: "2026-09-23",
          }],
        },
      },
      targetRuntimeProfile: {
        schemaVersion: 2,
        product: { family: "bedrock-engine", edition: "bedrock-retail", version: "1.21.30" },
        host: "client", scriptModules: {}, experiments: [],
        inventory: {
          scriptModules: "unknown", experiments: "unknown",
          worldSettings: "unknown", packs: "unknown",
        },
      },
    });
    expect(result.resources?.items[0]?.targetApplicability?.state)
      .toBe("does-not-apply");
  });

  it("rejects invalid context budgets", () => {
    expect(() =>
      compileContextPack({
        goal: "bad",
        graph: fixtureGraph(),
        intent,
        budget: {
          maxSemanticNodes: 0,
        },
      })
    ).toThrow(/positive integers/);
  });
  it("carries repository execution scope without widening semantic context", () => {
    const pack = compileContextPack({
      goal: "scoped-execution",
      graph: fixtureGraph(),
      intent,
      repositoryTaskPlan: {
        schemaVersion: 1,
        status: "planned",
        affected: {
          changedPaths: [
            "analyzers/scripts/src/inventory-lifecycle-evidence.ts",
          ],
          directCapabilityIds: [
            "source.scripts.inventory",
          ],
          affectedCapabilityIds: [
            "source.scripts.inventory",
            "domain.inventory",
            "domain.economy",
            "projection.world-model",
            "context.compile",
          ],
          unmatchedPaths: [],
        },
        execution: {
          status: "ready",
          selectedCapabilityIds: [
            "source.scripts.inventory",
            "domain.inventory",
            "domain.economy",
            "projection.world-model",
            "context.compile",
          ],
          skippedCapabilityIds: [],
          blockedCapabilityIds: [],
          reasons: [],
        },
        reasons: [],
      },
    });

    expect(pack.executionScope)
      .toEqual({
        status: "planned",
        affectedCapabilityIds: [
          "source.scripts.inventory",
          "domain.inventory",
          "domain.economy",
          "projection.world-model",
          "context.compile",
        ],
        selectedCapabilityIds: [
          "source.scripts.inventory",
          "domain.inventory",
          "domain.economy",
          "projection.world-model",
          "context.compile",
        ],
        unmatchedPaths: [],
      });
  });

  it("compresses domain attention into compact world signals", () => {
    const pack = compileContextPack({
      goal: "domain-risk",
      graph: fixtureGraph(),
      intent,
      worldModel: {
        subjects: [],
        arenas: {
          lifecycle: {
            terminalCandidates: 1,
            proven: 0,
            partial: 1,
            unresolved: 0,
          },
          cleanup: {
            acquiredSurfaces: 1,
            exactProven: 0,
            partial: 0,
            unresolved: 0,
            resourceLedger: {
              resources: 1,
              complete: 0,
              partial: 0,
              missing: 1,
              coverageRatio: 0,
            },
          },
          isolation: {
            isolated: 0,
            partitionProofRequired: 0,
            sharedGlobal: 0,
            unknown: 0,
          },
          globalState: {
            arenaScopedMutations: 0,
            pairedLeaseEvidence: 0,
            unleasedArenaMutations: 0,
            unauditedArenaMutations: 0,
          },
          stress: {
            status: "unavailable",
          },
        },
        spatial: {
          unresolvedScriptMutations: 0,
          rejectedScriptMutations: 0,
          authority: {
            configured: true,
            policyValid: true,
            resolved: 0,
            uncovered: 1,
            conflicts: 0,
            unknownRegions: 0,
          },
        },
        inventory: {
          partialResets: 1,
          copyMutationRisks: 1,
          unresolvedEquipmentSlotEvidence: 0,
          restoreOwnership: {
            multipleRestoreOwners: 0,
          },
          policy: {
            deniedDrops: 0,
            uncoveredDrops: 0,
            unknownDrops: 0,
          },
        },
        entities: {
          aiStack: {
            targetedStackIncomplete: 1,
          },
          navigationEnvironment: {
            incompatible: 0,
            stateDependent: 0,
            unresolved: 0,
          },
        },
        combat: {
          hurtOnlyTerminalRisk: 0,
          policy: {
            reviveContractContradictions: 1,
            projectileCleanupContractGap: 0,
          },
          runtime: {
            scopedLifeGenerationMissing: 0,
            scopedArenaGenerationMissing: 0,
          },
        },
        chunks: {
          acquireWithoutRelease: 0,
          releaseUnreachable: 0,
          cleanupOrderUnproven: 1,
          dynamicLeaseKeys: 0,
          capacityUncheckedLeases: 0,
          readinessUnverifiedLeases: 1,
          shutdownOnlyCleanupRisk: 0,
          unguardedDeferredChunkWork: 0,
        },
        economy: {
          policy: {
            deathRewardOverlapContractConflicts: 0,
            deathRewardOverlapUnresolved: 1,
            pickupCurrencyConsumeCoverageGaps: 0,
            pickupCurrencyContractMismatch: 0,
            idempotencyCoverageGaps: 0,
            staleDropCleanupCoverageGaps: 0,
            inventoryFullContractGaps: 0,
            pickupScopeValidationUnproven: 0,
            terminalRewardResultCommitUnproven: 0,
          },
        },
        state: {
          broadWrites: 0,
        },
        intent: {
          unknowns: [],
        },
      } as any,
    });

    expect(pack.world?.domainSignals)
      .toEqual({
        arenaLifecycle: 2,
        spatialAuthority: 1,
        inventory: 2,
        entityAiNavigation: 1,
        combat: 1,
        chunks: 2,
        persistence: 0,
        economy: 1,
      });
  });

  it("passes selected knowledge contents to the model-facing context and blocks incomplete hydration", () => {
    const selectedResource = {
      resource: {
        id: "knowledge.persistence.relation-worldload-gates-reconcile",
        class: "KNOWLEDGE" as const,
        domain: "persistence",
        authority: "REFERENCE" as const,
        path: "engine/knowledge/world-engine/persistence-bedrock.json",
        locator: "persistence.relation-worldload-gates-reconcile",
        lifecycle: "ACTIVE" as const,
      },
      score: {
        routing: 30, graph: 0, structural: 16,
        lexical: 25, semantic: 0, authority: 10, total: 81,
      },
      reasons: ["domain-route", "lexical-rank"],
    };
    const knowledge = {
      kind: "relation" as const,
      subject: "worldLoad",
      summary: "worldLoad gates durable-state-reconciliation",
      classification: "derived-rule" as const,
      applicability: { editions: ["bedrock" as const] },
      applicabilityStatus: "NOT_EVALUATED" as const,
      sourceIds: ["ms-persist-v2"],
      sources: [{
        id: "ms-persist-v2",
        title: "Official reference",
        url: "https://learn.microsoft.com/en-us/minecraft/creator/",
        authority: "official" as const,
        confidence: "documented" as const,
        retrievedDate: "2026-09-23",
      }],
      relation: { kind: "gates" as const, object: "durable-state-reconciliation" },
    };
    const core = {
      goal: "why is reconnect state stale?",
      graph: fixtureGraph(),
      intent,
      resourceSelection: [selectedResource],
    };
    const filled = compileContextPack({
      ...core,
      resourceKnowledge: { [selectedResource.resource.id]: knowledge },
    });
    expect(filled.resources?.items[0]?.knowledge?.summary)
      .toBe("worldLoad gates durable-state-reconciliation");
    expect(filled.resources?.knowledgeContent?.status).toBe("COMPLETE");

    const missing = compileContextPack({
      ...core,
      resourceKnowledge: {},
    });
    expect(missing.resources?.knowledgeContent?.status).toBe("PARTIAL");
    expect(missing.complete).toBe(false);
    expect(missing.reasons.some((reason) => reason.includes("not hydrated")))
      .toBe(true);
  });

});
}

// Original engine/packages/orchestrator/test/workflow/resource-context.test.ts, source blob b835f9bb8a0b134ca710f6c525f258f39f40b0dd
{
const selection: readonly RetrievalResult[] = [
  {
    resource: {
      id: "document.analysis.player-lifecycle",
      class: "DOCUMENT",
      domain: "analysis",
      role: "DOMAIN",
      authority: "CANONICAL",
      path: "docs/analysis/player-lifecycle.md",
      lifecycle: "ACTIVE",
    },
    score: {
      routing: 30,
      graph: 12,
      structural: 16,
      lexical: 0,
      semantic: 0,
      authority: 20,
      total: 78,
    },
    reasons: [
      "domain-route",
      "graph-relation",
      "structural-match",
      "authority:CANONICAL",
    ],
  },
  {
    resource: {
      id: "reliability.system.history",
      class: "RELIABILITY",
      domain: "system",
      authority: "HISTORICAL",
      path: "engine/reliability/history",
      lifecycle: "ACTIVE",
    },
    score: {
      routing: 0,
      graph: 0,
      structural: 8,
      lexical: 0,
      semantic: 0,
      authority: 0,
      total: 8,
    },
    reasons: [
      "structural-match",
      "authority:HISTORICAL",
    ],
  },
];

describe("compileResourceContext", () => {
  it("preserves authority and ranking provenance", () => {
    const context = compileResourceContext(selection, 1);

    expect(context).toEqual({
      items: [
        {
          id: "document.analysis.player-lifecycle",
          class: "DOCUMENT",
          domain: "analysis",
          role: "DOMAIN",
          authority: "CANONICAL",
          path: "docs/analysis/player-lifecycle.md",
          score: 78,
          reasons: [
            "domain-route",
            "graph-relation",
            "structural-match",
            "authority:CANONICAL",
          ],
        },
      ],
      omitted: 1,
    });
  });

  it("delivers selected Knowledge content with provenance and explicit unknown applicability", () => {
    const chosen: RetrievalResult = {
      ...selection[0]!,
      resource: {
        id: "knowledge.persistence.relation-worldload-gates-reconcile",
        class: "KNOWLEDGE",
        domain: "persistence",
        authority: "REFERENCE",
        path: "engine/knowledge/world-engine/persistence-bedrock.json",
        locator: "persistence.relation-worldload-gates-reconcile",
        lifecycle: "ACTIVE",
      },
    };
    const record: RetrievedKnowledgeContext = {
      kind: "relation",
      subject: "worldLoad",
      summary: "worldLoad gates durable-state-reconciliation",
      classification: "derived-rule",
      applicability: { editions: ["bedrock", "education"] },
      applicabilityStatus: "NOT_EVALUATED",
      sourceIds: ["ms-persist-v2"],
      sources: [{
        id: "ms-persist-v2",
        title: "Multiplayer-Aware Scripts",
        url: "https://learn.microsoft.com/en-us/minecraft/creator/",
        authority: "official",
        confidence: "documented",
        retrievedDate: "2026-09-23",
      }],
      relation: { kind: "gates", object: "durable-state-reconciliation" },
    };
    const withContent = compileResourceContext([chosen], 1, {
      [chosen.resource.id]: record,
    });
    expect(withContent?.items[0]?.knowledge).toEqual(record);
    expect(withContent?.knowledgeContent).toEqual({
      status: "COMPLETE",
      missingResourceIds: [],
    });

    const withoutContent = compileResourceContext([chosen], 1, {});
    expect(withoutContent?.items[0]?.knowledge).toBeUndefined();
    expect(withoutContent?.knowledgeContent).toEqual({
      status: "PARTIAL",
      missingResourceIds: [chosen.resource.id],
    });
  });

  it("evaluates selected Knowledge against an explicit target profile without promoting it to runtime proof", () => {
    const selected = {
      ...selection[0]!,
      resource: {
        id: "knowledge.persistence.dynamic-properties-survive-restart",
        class: "KNOWLEDGE" as const,
        domain: "persistence",
        authority: "REFERENCE" as const,
        path: "engine/knowledge/world-engine/persistence-bedrock.json",
        locator: "persistence.dynamic-properties-survive-restart",
        lifecycle: "ACTIVE" as const,
      },
    };
    const record: RetrievedKnowledgeContext = {
      kind: "fact",
      subject: "dynamic properties",
      summary: "World dynamic properties survive restart.",
      classification: "engine-fact",
      applicability: {
        editions: ["bedrock"],
        versions: {
          minMinecraftVersion: "1.21.0",
          scriptModule: "@minecraft/server",
          scriptModuleVersion: "2.0.0",
        },
      },
      applicabilityStatus: "NOT_EVALUATED",
      sourceIds: ["official-example"],
      sources: [{
        id: "official-example",
        title: "Official reference",
        url: "https://learn.microsoft.com/en-us/minecraft/creator/",
        authority: "official",
        confidence: "documented",
        retrievedDate: "2026-09-23",
      }],
      capabilityTags: ["dynamic-properties"],
      riskSurfaces: ["stale-persistence"],
    };
    const profile = {
      schemaVersion: 2 as const,
      product: { family: "bedrock-engine" as const, edition: "bedrock-retail" as const, version: "1.21.30" },
      host: "client" as const,
      experiments: [],
      scriptModules: { "@minecraft/server": { version: "2.1.0", track: "stable" as const } },
      inventory: {
        scriptModules: "complete" as const,
        experiments: "unknown" as const,
        worldSettings: "unknown" as const,
        packs: "unknown" as const,
      },
    };
    const source = { [selected.resource.id]: record };
    const withoutProfile = compileResourceContext([selected], 1, source);
    expect(withoutProfile?.items[0]?.targetApplicability?.state).toBe("not-evaluated");

    const applies = compileResourceContext([selected], 1, source, profile);
    expect(applies?.items[0]?.targetApplicability?.state).toBe("applies");
    expect(applies?.items[0]?.knowledge?.applicabilityStatus).toBe("NOT_EVALUATED");

    const differentEdition = compileResourceContext([selected], 1, source, {
      ...profile,
      product: { ...profile.product, edition: "education" as const },
    });
    expect(differentEdition?.items[0]?.targetApplicability?.state).toBe("does-not-apply");

    const unknownModule = compileResourceContext([selected], 1, source, {
      ...profile,
      scriptModules: {},
      inventory: { ...profile.inventory, scriptModules: "partial" as const },
    });
    expect(unknownModule?.items[0]?.targetApplicability?.state).toBe("unknown");
    expect(unknownModule?.items[0]?.targetApplicability?.missing).toContain(
      "script-module:@minecraft/server",
    );
  });

  it("rejects invalid resource context limits", () => {
    expect(() => compileResourceContext(selection, 0)).toThrow(
      /positive integer/,
    );
  });
});

describe("compileSectionContext", () => {
  it("preserves exact document range and ranking provenance", () => {
    const context = compileSectionContext([
      {
        section: {
          id: "document.analysis.mandatory-audit-procedure#prove",
          documentId: "document.analysis.mandatory-audit-procedure",
          path: "docs/analysis/mandatory-audit-procedure.md",
          heading: "PROVE",
          level: 2,
          anchor: "prove",
          startLine: 100,
          endLine: 180,
        },
        score: {
          documentScope: 30,
          heading: 40,
          lexical: 0,
          semantic: 0,
          level: 8,
          total: 78,
        },
        reasons: [
          "document-scope",
          "heading-match",
          "heading-level:2",
        ],
      },
    ]);

    expect(context).toEqual({
      items: [
        {
          id: "document.analysis.mandatory-audit-procedure#prove",
          documentId: "document.analysis.mandatory-audit-procedure",
          path: "docs/analysis/mandatory-audit-procedure.md",
          heading: "PROVE",
          anchor: "prove",
          startLine: 100,
          endLine: 180,
          score: 78,
          reasons: [
            "document-scope",
            "heading-match",
            "heading-level:2",
          ],
        },
      ],
      omitted: 0,
    });
  });
});
// The manifest is a source declaration in a selected pack, not the engine
// version or proof that a pack's script actually executed in Minecraft.
describe("developer practice manifest-scoped version hints", () => {
  const ir = {
    schemaVersion: 1 as const,
    execution: { regions: [], edges: [] },
    state: { surfaces: [], operations: [], authorityBindings: [] },
    temporal: { relations: [] },
  };
  const data = {
    authority: "REFERENCE" as const,
    usagePolicy: "CONTEXT_HINT_ONLY_NOT_GAME_DESIGN_OR_DEFECT_PROOF" as const,
    sourceSnapshot: { archiveSha256: "a".repeat(64) },
    sourceFiles: [{
      id: "src.bedrock-version-targeting",
      path: "skills/bedrock-version-targeting/SKILL.md",
      sha256: "b".repeat(64),
      auditUsage: "INTERPRETATION_CANDIDATE",
      methodology: {
        applicability: "MAP_SOURCE_INTERPRETATION" as const,
        sourceSections: ["1. Source meaning", "2. Counterexample"],
        objective: "Interpret the selected manifest declaration.",
        investigationSteps: [
          "Inspect the exact selected source.",
          "Compare its intended behavior with an alternative explanation.",
        ],
        disconfirmingCase: "Manifest versions do not prove an executed runtime.",
        proofBoundary: "EXTERNAL_DEVELOPER_METHOD_NOT_SELECTED_MAP_BEHAVIOR_PROOF" as const,
      },
    }],
    patterns: [{
      id: "developer.hint.version.compatibility",
      sourceId: "src.bedrock-version-targeting",
      kind: "IMPLEMENTATION_PATTERN",
      status: "SOURCE_REVIEWED",
      domains: ["manifest", "edition", "script-api"],
      sourceSignals: ["manifest.json", "min_engine_version", "@minecraft/server"],
      question: "What version does the selected pack declare?",
      candidateRelations: ["manifest dependency is not runtime support"],
      negativeControl: "A minimum engine version is not a live game version.",
      versionApplicability: "UNKNOWN",
      prohibits: "Never claim observed gameplay compatibility from manifest metadata.",
    }],
  };
  const witness = {
    packRoot: "behavior_packs/demo",
    source: {
      artifactId: "selected",
      relativePath: "behavior_packs/demo/manifest.json",
    },
    minEngineVersion: "1.21.0",
    scriptModules: [{
      moduleName: "@minecraft/server",
      version: "2.8.0",
      track: "stable",
    }],
    worldAttachment: "unknown" as const,
  };
  const baseline = {
    data, semanticIr: ir, selectedArtifactId: "selected",
    domains: ["manifest"], maximum: 2,
  };

  it("includes declared min-engine and Script API only for the selected pack", () => {
    const result = compileDeveloperPracticeReferenceContext({
      ...baseline,
      sourceLocators: ["behavior_packs/demo/scripts/main.ts:17"],
      manifestWitnesses: [witness],
    });
    expect(result?.items).toHaveLength(1);
    expect(result?.items[0]?.matchingSignals).toEqual(
      expect.arrayContaining(["manifest.json", "min_engine_version", "@minecraft/server"]),
    );
    expect(result?.items[0]?.manifestDeclarations).toEqual([{
      sourcePath: "behavior_packs/demo/manifest.json",
      minEngineVersion: "1.21.0",
      scriptModules: [{
        moduleName: "@minecraft/server", version: "2.8.0", track: "stable",
      }],
      worldAttachment: "unknown",
      proof: "MANIFEST_DECLARATION_ONLY",
    }]);
  });

  it("keeps per-audit precompiled typed IR references identical to per-query compilation", () => {
    const prepared = prepareDeveloperPracticeReferenceSelector(ir, "selected");
    for (const sourceLocators of [
      ["behavior_packs/demo/scripts/main.ts:17"],
      ["behavior_packs/demo-other/scripts/main.ts"],
      [],
    ]) {
      const query = {
        data, domains: ["manifest"], sourceLocators,
        manifestWitnesses: [witness], maximum: 2,
      };
      expect(prepared(query)).toEqual(compileDeveloperPracticeReferenceContext({
        ...query, semanticIr: ir, selectedArtifactId: "selected",
      }));
    }
    expect(prepareDeveloperPracticeReferenceSelector(ir, "other-artifact")({
      data, domains: ["manifest"],
      sourceLocators: ["behavior_packs/demo/scripts/main.ts"],
      manifestWitnesses: [witness],
    })?.items ?? []).toEqual([]);
  });

  it("abstains from another pack, missing source, or another artifact", () => {
    for (const sourceLocators of [
      [],
      ["behavior_packs/another/scripts/main.js"],
      ["behavior_packs/demo-other/scripts/main.js"],
    ]) {
      const result = compileDeveloperPracticeReferenceContext({
        ...baseline, sourceLocators, manifestWitnesses: [witness],
      });
      expect(result?.items ?? []).toHaveLength(0);
    }
    const crossed = compileDeveloperPracticeReferenceContext({
      ...baseline,
      sourceLocators: ["behavior_packs/demo/scripts/main.ts"],
      manifestWitnesses: [{
        ...witness, source: { ...witness.source, artifactId: "other-map" },
      }],
    });
    expect(crossed?.items ?? []).toHaveLength(0);
  });

  it("does not treat invented min-engine versions as verified", () => {
    const result = compileDeveloperPracticeReferenceContext({
      ...baseline, sourceLocators: ["behavior_packs/demo/scripts/main.ts"],
      manifestWitnesses: [{ ...witness, minEngineVersion: "future" }],
    });
    expect(result?.items ?? []).toHaveLength(0);
  });

  it("retains upstream clean-example status boundaries after an exact source match", () => {
    // Synthetic upstream-index fixture: the source/lock and selected-map
    // witness gates, NOT a claim that this example exists in Skills Probe.
    const exampleIndex = {
      schemaVersion: 1 as const,
      authority: "UPSTREAM_INDEX_ONLY_NOT_SELECTED_MAP_PROOF" as const,
      sourceArchiveSha256: "c".repeat(64),
      indexPath: "docs/examples/index.json" as const,
      indexSha256: "d".repeat(64),
      sourceSkillLockTag: "v0.23.0",
      sourceSkillLockCommit: "e".repeat(40),
      target: { client: "education 26.32", engine: "1.26.30" },
      entries: [{
        id: "X1",
        skill: "bedrock-version-targeting",
        status: "PASS" as const,
        nodeStatus: "PASS",
        engineStatus: "pending",
        probeIds: ["PX"],
        report: null,
        sourcePath: "docs/examples/version/README.md",
      }],
    };
    const full = {
      ...baseline,
      data: {
        ...data,
        probeSnapshot: { observedSkillsLockTag: "v0.23.0", observedSkillsLockCommit: "e".repeat(40), archiveSha256: "c".repeat(64), archiveHistorySha256: [] },
        probeExamples: exampleIndex,
      },
      sourceLocators: ["behavior_packs/demo/scripts/main.ts:17"],
      manifestWitnesses: [witness],
    };
    const result = compileDeveloperPracticeReferenceContext(full);
    expect(result?.items).toHaveLength(1);
    expect(result?.items[0]?.cleanExamples).toMatchObject([{
      id: "X1",
      status: "PASS",
      nodeStatus: "PASS",
      engineStatus: "pending",
      sourceSkillLockTag: "v0.23.0",
      proof: "UPSTREAM_SOURCE_INDEX_ONLY_NOT_SELECTED_MAP_PROOF",
    }]);

    const noWitness = compileDeveloperPracticeReferenceContext({
      ...full, sourceLocators: ["behavior_packs/other/scripts/main.ts"],
    });
    expect(noWitness?.items ?? []).toHaveLength(0);

    const wrongRelease = compileDeveloperPracticeReferenceContext({
      ...full,
      data: {
        ...full.data,
        probeSnapshot: { observedSkillsLockTag: "v0.27.0", archiveSha256: "c".repeat(64), archiveHistorySha256: [] },
      },
    });
    expect(wrongRelease?.items[0]?.cleanExamples).toBeUndefined();

    // The same installed skill-lock with a *different probe source ZIP*
    // cannot borrow the previous clean-example index's runtime claims.
    const wrongArchive = compileDeveloperPracticeReferenceContext({
      ...full,
      data: {
        ...full.data,
        probeSnapshot: {
          observedSkillsLockTag: "v0.23.0",
          archiveSha256: "f".repeat(64),
          archiveHistorySha256: ["c".repeat(64)],
        },
      },
    });
    expect(wrongArchive?.items[0]?.cleanExamples).toBeUndefined();
  });
  it("never selects a source-reviewed but un-routed upstream technical skill", () => {
    const unroutedData = {
      ...data,
      sourceFiles: data.sourceFiles.map(file => ({
        ...file,
        id: "src.bedrock-player-attached-particles",
        path: "skills/bedrock-player-attached-particles/SKILL.md",
        auditUsage: "REFERENCE_ONLY_NOT_ROUTED",
        methodology: {
          ...file.methodology,
          applicability: "UNROUTED_TECHNICAL_REFERENCE" as const,
        },
      })),
      patterns: data.patterns.map(pattern => ({
        ...pattern,
        sourceId: "src.bedrock-player-attached-particles",
      })),
    };
    const result = compileDeveloperPracticeReferenceContext({
      ...baseline,
      data: unroutedData,
      sourceLocators: ["behavior_packs/demo/scripts/main.ts:17"],
      manifestWitnesses: [witness],
    });
    expect(result?.items).toEqual([]);
  });

});

describe("source-first Daigon export investigation reference", () => {
  const source = {
    artifactId: "selected",
    relativePath: "behavior_packs/demo/scripts/results.ts",
    range: { lineStart: 12, lineEnd: 12, columnStart: 1, columnEnd: 65 },
  };
  const subscription = {
    id: "event:results",
    kind: "event-source" as const,
    ownerId: "system",
    label: "system.afterEvents.scriptEventReceive",
    source,
    scriptEventIdRejection: {
      eventId: "daigon:get_all_scoring",
      source,
      valueSource: source,
      resolution: "inline-literal" as const,
    },
  };
  const data = {
    authority: "REFERENCE" as const,
    usagePolicy: "CONTEXT_HINT_ONLY_NOT_GAME_DESIGN_OR_DEFECT_PROOF" as const,
    sourceSnapshot: { archiveSha256: "a".repeat(64), release: "v0.27.0" },
    sourceFiles: [{
      id: "src.bedrock-game-results",
      path: "skills/bedrock-game-results/SKILL.md",
      sha256: "b".repeat(64),
      auditUsage: "INTERPRETATION_CANDIDATE" as const,
      methodology: {
        applicability: "MAP_SOURCE_INTERPRETATION" as const,
        sourceSections: ["1. How the export works"],
        objective: "Check Daigon export only when adopted by this map.",
        investigationSteps: [
          "Establish selected-map Daigon requirement.",
          "Inspect original handler and stored snapshot source.",
        ],
        disconfirmingCase: "Unrelated ScriptEventReceive is not a Daigon contract.",
        proofBoundary: "EXTERNAL_DEVELOPER_METHOD_NOT_SELECTED_MAP_BEHAVIOR_PROOF" as const,
      },
    }],
    patterns: [{
      id: "developer.hint.game-results.daigon-export",
      sourceId: "src.bedrock-game-results",
      kind: "IMPLEMENTATION_PATTERN",
      status: "SOURCE_REVIEWED" as const,
      domains: ["scoring", "result"],
      sourceSignals: ["scriptevent:daigon:get_all_scoring"],
      question: "Does an explicitly adopted results export satisfy its contract?",
      candidateRelations: ["subscription to potential export investigation"],
      negativeControl: "A generic event subscriber never proves Daigon scope.",
      versionApplicability: "SOURCE_SCOPE_ONLY",
      prohibits: "No Daigon bug without map-specific contractual proof.",
    }],
  };
  const context = (event: typeof subscription, sourceLocators: string[], domains = ["scoring"]) =>
    compileDeveloperPracticeReferenceContext({
      data,
      semanticIr: {
        schemaVersion: 1 as const,
        execution: { regions: [event], edges: [] },
        state: { surfaces: [], operations: [], authorityBindings: [] },
        temporal: { relations: [] },
      },
      selectedArtifactId: "selected",
      domains,
      sourceLocators,
    });

  it("routes the reviewed developer question only from an exact authored Daigon event filter", () => {
    const result = context(subscription, ["behavior_packs/demo/scripts/results.ts:12:20"]);
    expect(result?.items.map(item => item.patternId)).toEqual([
      "developer.hint.game-results.daigon-export",
    ]);
    expect(result?.items[0]?.methodology?.investigationSteps).toHaveLength(2);
    expect(result?.authority).toBe("REFERENCE");
    expect(result?.status).toBe("INVESTIGATION_HINTS_ONLY");
  });

  it("refuses a spoofed event root, another map/source, or an unrelated question", () => {
    for (const event of [
      { ...subscription, ownerId: "world" },
      { ...subscription, label: "system.afterEvents.anotherEvent" },
      { ...subscription, source: { ...source, artifactId: "other-map" } },
      { ...subscription, scriptEventIdRejection: undefined },
      { ...subscription, scriptEventIdRejection: {
        ...subscription.scriptEventIdRejection, eventId: "other:export",
      } },
      { ...subscription, scriptEventIdRejection: {
        ...subscription.scriptEventIdRejection,
        valueSource: { ...source, artifactId: "other-map" },
      } },
    ]) {
      expect(context(event, ["behavior_packs/demo/scripts/results.ts:12:20"])?.items)
        .toEqual([]);
    }
    expect(context(subscription, ["behavior_packs/demo/scripts/elsewhere.ts"])?.items)
      .toEqual([]);
    expect(context(subscription, ["behavior_packs/demo/scripts/results.ts:12:20"], ["combat"])?.items)
      .toEqual([]);
  });

  it("keeps bounded prepared selectors identical to direct source proof", () => {
    const semanticIr = {
      schemaVersion: 1 as const,
      execution: { regions: [subscription], edges: [] },
      state: { surfaces: [], operations: [], authorityBindings: [] },
      temporal: { relations: [] },
    };
    const prepared = prepareDeveloperPracticeReferenceSelector(semanticIr, "selected");
    for (const sourceLocators of [
      ["behavior_packs/demo/scripts/results.ts:12:20"],
      ["behavior_packs/demo/scripts/results.ts:12:20"],
      ["behavior_packs/demo/scripts/results.ts:12:200"],
      ["behavior_packs/demo/scripts/results.ts"],
      ["behavior_packs/demo/scripts/results.ts@unresolved"],
      ["behavior_packs/demo/scripts/results.ts-other:12:20"],
      ["behavior_packs/demo/scripts/elsewhere.ts"],
      [],
    ]) {
      expect(prepared({ data, sourceLocators, domains: ["scoring"] }))
        .toEqual(context(subscription, sourceLocators));
    }
    const sourceLocators = ["behavior_packs/demo/scripts/results.ts:12:20"];
    expect(prepared({ data, sourceLocators, domains: ["scoring", "scoring"] }))
      .toEqual(context(subscription, sourceLocators));
    // A different reviewed input cannot borrow an earlier selection.
    const changedData = {
      ...data,
      patterns: data.patterns.map(pattern => ({
        ...pattern, id: "developer.hint.game-results.changed",
      })),
    };
    expect(prepared({ data: changedData, sourceLocators, domains: ["scoring"] }))
      .toEqual(compileDeveloperPracticeReferenceContext({
        data: changedData, semanticIr, selectedArtifactId: "selected",
        sourceLocators, domains: ["scoring"],
      }));
  });
});
}
