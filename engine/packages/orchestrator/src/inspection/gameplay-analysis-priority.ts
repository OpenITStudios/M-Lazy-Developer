import {
  assessAuditRisk,
  type AuditGameplayCriticality,
  type AuditRiskAssessment,
  type AuditRiskFactor,
} from "../../../diagnostic-reasoning/src/index.js";
import type {
  GameplayWorldModel,
} from "./gameplay-world-model.js";
import type {
  GameplayKnowledgeDomain,
  GameplayScenarioGraph,
} from "./gameplay-scenario-model.js";
import type {
  CapabilityExposureSummary,
} from "./capability-exposure-stage.js";
import {
  historicalSurfaceSearchPressure,
} from "../map-audit-history-hints.js";

function factorsForSurface(
  surfaceId: string,
  world: GameplayWorldModel,
  capabilities: CapabilityExposureSummary,
): readonly AuditRiskFactor[] {
  switch (surfaceId) {
    case "runtime:arena":
      return ["multiplayer"];
    case "runtime:arena-capacity":
      return [
        "multiplayer",
        "capacity",
        "external-runtime-dependency",
      ];
    case "runtime:arena-lifecycle":
      return [
        "multiplayer",
        "terminal-transition",
      ];
    case "runtime:arena-cleanup":
      return [
        "multiplayer",
        "shared-state",
        "terminal-transition",
      ];
    case "runtime:arena-isolation":
      return [
        "multiplayer",
        "shared-state",
      ];
    case "runtime:arena-replica-integrity":
      return [
        "replica-integrity",
        "world-mutation",
        "multiplayer",
      ];
    case "runtime:state":
      return [
        "shared-state",
        "terminal-transition",
      ];
    case "runtime:chunks":
      return [
        "async",
        "external-runtime-dependency",
      ];
    case "runtime:persistence":
      return [
        "persistence",
        "reload",
        "reconnect",
      ];
    case "runtime:economy":
      return ["persistence"];
    case "runtime:combat":
      return ["multiplayer"];
    case "runtime:inventory":
      return [
        "persistence",
        "reconnect",
      ];
    case "runtime:spatial":
    case "runtime:structures":
      return ["world-mutation"];
    case "runtime:entities":
      return [
        "async",
        "external-runtime-dependency",
      ];
    case "runtime:boundaries":
      return ["capacity"];
    default:
      return capabilities.releaseBlocking > 0
        ? ["permission"]
        : [];
  }
}

function criticalityForSurface(
  surfaceId: string,
): AuditGameplayCriticality {
  switch (surfaceId) {
    case "runtime:arena-capacity":
    case "runtime:arena-lifecycle":
    case "runtime:arena-cleanup":
    case "runtime:arena-isolation":
    case "runtime:state":
    case "runtime:chunks":
    case "runtime:combat":
    case "runtime:inventory":
    case "runtime:entities":
      return "high";
    case "runtime:persistence":
      return "high";
    case "runtime:economy":
    case "runtime:spatial":
    case "runtime:structures":
    case "runtime:boundaries":
      return "medium";
    case "runtime:arena-replica-integrity":
      return "high";
    default:
      return "low";
  }
}

const SURFACE_KNOWLEDGE_DOMAIN:
  Readonly<Partial<Record<string, GameplayKnowledgeDomain>>> = {
    "runtime:arena": "arena-lifecycle",
    "runtime:arena-capacity": "multiplayer-interleaving",
    "runtime:arena-lifecycle": "arena-lifecycle",
    "runtime:arena-cleanup": "arena-lifecycle",
    "runtime:arena-isolation": "multiplayer-interleaving",
    "runtime:arena-replica-integrity": "world-structure",
    "runtime:state": "state-flow",
    "runtime:chunks": "chunk-simulation",
    "runtime:persistence": "persistence-recovery",
    "runtime:economy": "economy-reward",
    "runtime:combat": "combat-lifecycle",
    "runtime:inventory": "inventory-state",
    "runtime:spatial": "spatial-authority",
    "runtime:structures": "world-structure",
    "runtime:entities": "entity-behavior",
  };

export interface GameplayAnalysisPriority
  extends AuditRiskAssessment {
  readonly rigDemand: number;
  readonly historyPressure: number;
}

// One source-owned ordering for navigation and directly linked proof tasks.
// Historical examples influence search only, never gameplay defect authority.
const IMPACT_ORDER: Readonly<Record<AuditGameplayCriticality, number>> = {
  blocker: 3, high: 2, medium: 1, low: 0,
};
export function compareGameplayAnalysisPriority(
  a: GameplayAnalysisPriority,
  b: GameplayAnalysisPriority,
): number {
  return IMPACT_ORDER[b.criticality] - IMPACT_ORDER[a.criticality] ||
    b.score - a.score ||
    b.rigDemand - a.rigDemand ||
    b.historyPressure - a.historyPressure ||
    a.surfaceId.localeCompare(b.surfaceId);
}

export function deriveGameplayAnalysisPriorities(
  world: GameplayWorldModel,
  capabilities: CapabilityExposureSummary,
  scenarioGraph?: GameplayScenarioGraph,
): readonly GameplayAnalysisPriority[] {
  const unknown = new Set(
    world.gameplayClosure.surfaces
      .filter(
        (surface) =>
          surface.status === "unknown" ||
          surface.status === "blocked",
      )
      .map((surface) => surface.id),
  );

  const demandByDomain = new Map<
    GameplayKnowledgeDomain,
    number
  >();
  for (const requirement of
    scenarioGraph?.knowledgeRequirements ?? []) {
    demandByDomain.set(
      requirement.domain,
      (demandByDomain.get(requirement.domain) ?? 0) + 1,
    );
  }

  const surfacePriorities = world.surfaceDiscovery.surfaceIds
    .map((surfaceId) => {
      const base = assessAuditRisk({
        surfaceId,
        factors:
          factorsForSurface(
            surfaceId,
            world,
            capabilities,
          ),
        unresolved: unknown.has(surfaceId),
        criticality: criticalityForSurface(surfaceId),
      });
      const domain =
        SURFACE_KNOWLEDGE_DOMAIN[surfaceId];
      return {
        ...base,
        rigDemand:
          domain === undefined
            ? 0
            : demandByDomain.get(domain) ?? 0,
        historyPressure:
          historicalSurfaceSearchPressure(
            surfaceId,
            world,
          ),
      };
    });

  const capabilityPriorities: GameplayAnalysisPriority[] =
    capabilities.exposures
      .filter(
        (item) =>
          item.status === "exposed" ||
          item.status === "potentially-exposed" ||
          item.status === "unknown",
      )
      .map((item) => {
        const highImpact =
          item.impact === "progression" ||
          item.impact === "state" ||
          item.impact === "fairness";
        const base = assessAuditRisk({
          surfaceId:
            "capability:" + item.capabilityId,
          factors: ["permission"],
          unresolved:
            item.status !== "exposed",
          criticality:
            highImpact
              ? "high"
              : item.impact === "interaction" ||
                  item.impact === "debug-information"
                ? "medium"
                : "low",
        });
        return {
          ...base,
          rigDemand: 0,
          historyPressure: 0,
        };
      });

  return [
    ...surfacePriorities,
    ...capabilityPriorities,
  ].sort(compareGameplayAnalysisPriority);
}
