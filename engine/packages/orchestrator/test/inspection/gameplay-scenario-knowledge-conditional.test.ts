import { describe, expect, it } from "vitest";
import {
  requiredKnowledgeDomainsForPreset,
  uniqueScenarioKnowledgeRequirement,
  satisfiedScenarioKnowledgeReceipt,
  gameplayScenarioNeighborhoodNodeIds,
  isAuthoredSourceContentNode,
} from "../../src/inspection/gameplay-scenario-knowledge.js";
import type {
  GameplayWorldModel,
} from "../../src/inspection/gameplay-world-model.js";
import type { GameplayIntentModel } from
  "../../../../packages/gameplay-intent/src/index.js";
import {
  derivePreflightKnowledgeDemand,
} from "../../src/inspection/preflight-knowledge-demand.js";

function world(): GameplayWorldModel {
  return {
    arenas: {
      detected: true,
    },
    inventory: {
      regions: 1,
      grantRegions: 1,
      dropRegions: 0,
    },
    economy: {
      sourceKinds: ["script-inventory-grant"],
    },
    persistence: {
      properties: 2,
    },
    chunks: {
      tickingAreaAcquires: 1,
      tickingAreaReadinessStates: 0,
      readinessProbes: 0,
      entityResidencyObservability: "partial",
    },
    entities: {
      definitions: 4,
    },
    combat: {
      hurtHandlers: 0,
      deathHandlers: 0,
      damageApplications: 0,
    },
    structures: {
      definitions: 0,
      loads: 0,
      runtimeLogicLoads: 0,
    },
    spatial: {
      resolvedScriptEffects: 0,
      structurePlacements: 0,
      authority: {
        configured: false,
      },
    },
    platformKnowledge: {
      profileResolved: true,
    },
  } as unknown as GameplayWorldModel;
}

describe("graph-scoped Knowledge proof identity", () => {
  const requirement = {
    id: "knowledge:wave:state",
    scenarioId: "scenario:wave",
    domain: "state-flow" as const,
    reason: "Wave ownership",
    capabilityIds: ["state-flow"],
    dependsOnRequirementIds: [],
    subjectIds: ["objective:wave"],
    componentIds: ["state:wave"],
  };
  const receipt = {
    requirementId: requirement.id,
    scenarioId: requirement.scenarioId,
    domain: requirement.domain,
    status: "SATISFIED" as const,
    evidenceIds: ["source:wave"],
    knowledgeIds: ["knowledge:wave"],
    capabilityIdsUsed: ["state-flow"],
    subjectIds: requirement.subjectIds,
    componentIds: requirement.componentIds,
    reason: "Grounded.",
  };

  it("rejects duplicate receipt ID even when only one matches scenario/domain", () => {
    const base = {
      knowledgeRequirements: [requirement],
      knowledgeReceipts: [receipt],
    };
    expect(uniqueScenarioKnowledgeRequirement(
      base, requirement.id, requirement.scenarioId,
    )).toEqual(requirement);
    expect(satisfiedScenarioKnowledgeReceipt(base, requirement)).toEqual(receipt);

    for (const extra of [
      { ...receipt, scenarioId: "scenario:foreign" },
      { ...receipt, domain: "chunk-simulation" as const },
      { ...receipt },
    ]) {
      const withDuplicate = {
        ...base,
        knowledgeReceipts: [receipt, extra],
      };
      expect(satisfiedScenarioKnowledgeReceipt(
        withDuplicate, requirement,
      )).toBeUndefined();
    }
  });
});

describe("conditional gameplay knowledge dependencies", () => {
  it("expands reconnect inventory proof into persistence, arena, and temporal ownership when those surfaces coexist", () => {
    const domains =
      requiredKnowledgeDomainsForPreset(
        "disconnect-reconnect",
        world(),
      );

    expect(domains).toEqual(
      expect.arrayContaining([
        "inventory-state",
        "persistence-recovery",
        "arena-lifecycle",
        "multiplayer-interleaving",
        "temporal-ownership",
        "chunk-simulation",
        "platform-constraints",
        "entity-behavior",
      ]),
    );
  });

  it("keeps chunk-simulation mandatory for simulation-distance even when no ticking mechanism exists", () => {
    const input = world();
    const noChunkMechanism = {
      ...input,
      chunks: {
        ...input.chunks,
        tickingAreaAcquires: 0,
        tickingAreaReadinessStates: 0,
        readinessProbes: 0,
        entityResidencyObservability: "absent",
      },
    } as GameplayWorldModel;

    const domains =
      requiredKnowledgeDomainsForPreset(
        "simulation-distance",
        noChunkMechanism,
      );

    expect(domains).toContain(
      "chunk-simulation",
    );
    expect(domains).toContain(
      "platform-constraints",
    );
  });

  it("routes transaction atomicity into inventory/economy/temporal proof instead of state-flow only", () => {
    const domains =
      requiredKnowledgeDomainsForPreset(
        "transaction-atomicity",
        world(),
      );

    expect(domains).toEqual(
      expect.arrayContaining([
        "inventory-state",
        "economy-reward",
        "temporal-ownership",
      ]),
    );
  });

  it("keeps chunk and temporal proof mandatory for entity-backed progression even when removal accounting is absent", () => {
    const input = world();
    const noAccounting = {
      ...input,
      chunks: {
        ...input.chunks,
        entityRemoveObservers: 0,
      },
    } as GameplayWorldModel;

    const domains =
      requiredKnowledgeDomainsForPreset(
        "progression-wave-integrity",
        noAccounting,
      );

    expect(domains).toEqual(
      expect.arrayContaining([
        "chunk-simulation",
        "entity-behavior",
        "platform-constraints",
        "temporal-ownership",
      ]),
    );
  });

  it("does not require economy knowledge when no economy surface exists", () => {
    const input = world();
    const withoutEconomy = {
      ...input,
      economy: {
        ...input.economy,
        sourceKinds: [],
      },
    } as GameplayWorldModel;

    const domains =
      requiredKnowledgeDomainsForPreset(
        "disconnect-reconnect",
        withoutEconomy,
      );

    expect(domains).not.toContain(
      "economy-reward",
    );
  });
  it("keeps source-only stage/wave/choice ownership outside causal scenarios while preserving real resources", () => {
    const evidence = {id:"e:source",origin:"source-code" as const,
      locator:"behavior_packs/example/scripts/game.js:20:2",
      summary:"Authored selected source",scope:"selected-artifact" as const};
    const nodes: GameplayIntentModel["nodes"] = [{
      id:"mechanic:selectRound",kind:"mechanic",label:"Select round",
      status:"inferred",evidenceIds:[evidence.id],
    },{
      id:"resource:team-score",kind:"resource",label:"Team score",
      status:"authored",evidenceIds:[evidence.id],
    },{
      id:"resource:authored-source:stage-one",kind:"resource",
      label:"Stage 1",status:"inferred",evidenceIds:[evidence.id],
    },{
      id:"resource:authored-source:wave-one",kind:"resource",
      label:"Wave 1",status:"inferred",evidenceIds:[evidence.id],
    },{
      id:"resource:authored-content:guess-pool",kind:"resource",
      label:"GuessText",status:"inferred",evidenceIds:[evidence.id],
    }];
    const model:GameplayIntentModel = {
      schemaVersion:1,id:"graph:content-not-scenario",
      evidence:[evidence],nodes,unknowns:[],invariants:[],
      edges:[{
        id:"edge:score",from:"mechanic:selectRound",
        to:"resource:team-score",kind:"requires",
        status:"inferred",evidenceIds:[evidence.id],
      },{
        id:"edge:pool",from:"mechanic:selectRound",
        to:"resource:authored-content:guess-pool",kind:"requires",
        status:"inferred",evidenceIds:[evidence.id],
      },{
        id:"authored-content-owns:one",
        from:"resource:authored-source:stage-one",
        to:"resource:authored-source:wave-one",kind:"owns",
        status:"inferred",evidenceIds:[evidence.id],
      }],
    };
    expect(isAuthoredSourceContentNode(nodes[2]!)).toBe(true);
    expect(isAuthoredSourceContentNode(nodes[3]!)).toBe(true);
    expect(isAuthoredSourceContentNode(nodes[4]!)).toBe(true);
    expect(isAuthoredSourceContentNode(nodes[1]!)).toBe(false);
    expect(gameplayScenarioNeighborhoodNodeIds(model,"mechanic:selectRound"))
      .toEqual(["mechanic:selectRound","resource:team-score"]);
    expect(gameplayScenarioNeighborhoodNodeIds(
      model,"resource:authored-source:stage-one")).toEqual([]);
    // Source catalogue and wave tree are NOT deleted from the canonical Intent.
    expect(model.nodes).toHaveLength(5);
    expect(model.edges).toHaveLength(3);

    // Preflight is the real runtime-analysis consumer. Content-only sources
    // must not trigger inventory/economy without gameplay-source evidence.
    const contentOnly: GameplayIntentModel = {
      ...model,
      nodes: nodes.filter(isAuthoredSourceContentNode),
      edges: model.edges.filter(edge =>
        edge.id.startsWith("authored-content-owns:")),
    };
    const demand = (
      intent: GameplayIntentModel,
      required: readonly ("inventory-state" | "economy-reward")[] = [],
    ) => derivePreflightKnowledgeDemand({
      intent,
      scripts: [],
      entityCount: 0,
      target: { requiredKnowledgeDomains: required },
    });
    const contentDemand = demand(contentOnly);
    expect(contentDemand).toContain("state-flow");
    expect(contentDemand).not.toContain("inventory-state");
    expect(contentDemand).not.toContain("economy-reward");

    // Real gameplay resources and caller-demanded domains remain included.
    expect(demand(model)).toContain("inventory-state");
    expect(demand(model)).toContain("economy-reward");
    expect(demand(contentOnly, ["inventory-state", "economy-reward"]))
      .toEqual(["economy-reward", "inventory-state", "state-flow"]);
  });

});
