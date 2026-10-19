import type { ParsedEntityDefinition } from "../../../../analyzers/entities/src/index.js";
import type { ParsedScriptFile } from "../../../../analyzers/scripts/src/index.js";
import type { ArenaRegionContract } from "../../../project-model/src/index.js";
import type { SpatialAuthorityPolicy } from "../../../behavior-model/src/index.js";
import { analyzeSpatialAuthorityCoverage } from "./spatial-authority-analysis.js";

export interface EnvironmentHazardAnalysis {
  explosionBeforeHandlers: number;
  explosionAfterHandlers: number;
  hurtOnConditionEntities: number;
  damageSensorEntities: number;
  hazardEntities: readonly {
    entityIdentifier?: string;
    sourcePath: string;
    hurtOnCondition: boolean;
    damageSensor: boolean;
  }[];
  explosionControlStatus:
    | "pre-mutation-control-present"
    | "post-only"
    | "absent";
  explosionContainmentStatus:
    | "resolved"
    | "unresolved"
    | "not-applicable";
  repeatedDamageStatus:
    | "generation-policy-unresolved"
    | "not-applicable";
}

function hasComponent(
  entity: ParsedEntityDefinition,
  component: string,
): boolean {
  if (entity.baseComponents.includes(component)) return true;
  return Object.values(entity.componentGroups).some(
    (components) => components.includes(component),
  );
}

export function analyzeEnvironmentHazards(
  scripts: readonly ParsedScriptFile[],
  entities: readonly ParsedEntityDefinition[],
  authority?: {
    readonly regions: readonly ArenaRegionContract[];
    readonly contract: SpatialAuthorityPolicy;
    readonly regionIds: readonly string[];
  },
): EnvironmentHazardAnalysis {
  const explosionBeforeHandlers = scripts.reduce(
    (sum, script) =>
      sum +
      script.events.filter(
        (event) =>
          event.root === "world" &&
          event.phase === "beforeEvents" &&
          event.event === "explosion",
      ).length,
    0,
  );
  const explosionAfterHandlers = scripts.reduce(
    (sum, script) =>
      sum +
      script.events.filter(
        (event) =>
          event.root === "world" &&
          event.phase === "afterEvents" &&
          event.event === "explosion",
      ).length,
    0,
  );

  const hazardEntities = entities
    .map((entity) => ({
      ...(entity.identifier === undefined
        ? {}
        : { entityIdentifier: entity.identifier }),
      sourcePath: entity.source.relativePath,
      hurtOnCondition: hasComponent(
        entity,
        "minecraft:hurt_on_condition",
      ),
      damageSensor: hasComponent(
        entity,
        "minecraft:damage_sensor",
      ),
    }))
    .filter(
      (item) =>
        item.hurtOnCondition ||
        item.damageSensor,
    )
    .sort((a, b) =>
      a.sourcePath.localeCompare(b.sourcePath),
    );

  const hurtOnConditionEntities =
    hazardEntities.filter(
      (item) => item.hurtOnCondition,
    ).length;
  const damageSensorEntities =
    hazardEntities.filter(
      (item) => item.damageSensor,
    ).length;
  const hasExplosion =
    explosionBeforeHandlers > 0 ||
    explosionAfterHandlers > 0;
  // Only an explicit, valid rule for every requested spatial region can
  // establish mutation authority. A beforeEvents handler alone does not
  // prove containment, nor does a partial/missing policy.
  const containment = hasExplosion &&
    authority !== undefined &&
    authority.regionIds.length > 0
      ? analyzeSpatialAuthorityCoverage(
          authority.regions,
          authority.contract,
          authority.regionIds.map((regionId) => ({
            regionId,
            actor: "system" as const,
            action: "mutate-blocks" as const,
          })),
        )
      : undefined;
  const containmentResolved =
    containment !== undefined &&
    containment.policyValid &&
    containment.assessments.length === authority?.regionIds.length &&
    containment.assessments.every((item) =>
      item.status === "resolved" && item.decision !== undefined
    );

  return {
    explosionBeforeHandlers,
    explosionAfterHandlers,
    hurtOnConditionEntities,
    damageSensorEntities,
    hazardEntities,
    explosionControlStatus:
      explosionBeforeHandlers > 0
        ? "pre-mutation-control-present"
        : explosionAfterHandlers > 0
          ? "post-only"
          : "absent",
    explosionContainmentStatus:
      !hasExplosion ? "not-applicable"
        : containmentResolved ? "resolved" : "unresolved",
    repeatedDamageStatus:
      hurtOnConditionEntities > 0
        ? "generation-policy-unresolved"
        : "not-applicable",
  };
}
