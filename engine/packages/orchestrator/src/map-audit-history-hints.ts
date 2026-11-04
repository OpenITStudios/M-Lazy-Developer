import type { GameplayWorldModel } from "./inspection/gameplay-world-model.js";
import type { NeedValidationAuditIssueProjection } from "./map-audit-issue-projection.js";

/** Retained API shape. Prior map-derived family hints are retired. */
export interface AuditHistoricalSearchHint {
  readonly id: string;
  readonly family: string;
  readonly priority: "high" | "medium";
  readonly knowledgeDomains: readonly string[];
  readonly searchQuestions: readonly string[];
  readonly matchedBecause: readonly string[];
  readonly source: "generic-regression-learning" | "reliability-blindspot-family";
}

/** No previous map audit can rank new-map findings after the reset. */
export function historicalSearchHintsForFinding(
  _finding: NeedValidationAuditIssueProjection,
  _world: GameplayWorldModel,
): readonly AuditHistoricalSearchHint[] {
  return [];
}

export function historicalSearchPressure(
  _hints: readonly AuditHistoricalSearchHint[],
): number {
  return 0;
}

// The existing per-surface calculation below uses current-map evidence only.
export function historicalSurfaceSearchPressure(
  surfaceId: string,
  world: GameplayWorldModel,
): number {
  let pressure = 0;

  if (
    surfaceId === "runtime:chunks" &&
    world.entities.definitions > 0 &&
    (
      world.chunks.tickingAreaAcquires === 0 ||
      world.chunks.capacityUncheckedLeases > 0 ||
      world.chunks.readinessUnverifiedLeases > 0
    )
  ) {
    pressure += 3;
  }

  if (
    (
      surfaceId === "runtime:arena-isolation" ||
      surfaceId === "runtime:arena-cleanup" ||
      surfaceId === "runtime:arena"
    ) &&
    world.arenas.detected &&
    (
      world.arenas.isolation.sharedGlobal > 0 ||
      world.arenas.globalState.unleasedArenaMutations > 0 ||
      world.arenas.cleanup.resourceLedger.missing > 0
    )
  ) {
    pressure += 3;
  }

  if (
    surfaceId === "runtime:inventory" &&
    (
      world.inventory.restoreOwnership.multipleRestoreOwners > 0 ||
      world.inventory.restoreConflicts.length > 0 ||
      world.inventory.partialResets > 0
    )
  ) {
    pressure += 3;
  }

  if (
    surfaceId === "runtime:persistence" &&
    (
      (world.persistence?.appendWithoutClear ?? 0) > 0 ||
      (world.persistence?.unknownLifetime ?? 0) > 0 ||
      (world.persistence?.unknownScope ?? 0) > 0
    )
  ) {
    pressure += 2;
  }

  if (
    surfaceId === "runtime:structures" &&
    (
      world.structures.transitionResidueRisks > 0 ||
      world.structures.transitionResidueUnresolved > 0
    )
  ) {
    pressure += 2;
  }

  if (
    surfaceId === "runtime:entities" &&
    world.entities.definitions > 0 &&
    (
      world.chunks.entityRemoveObservers > 0 ||
      world.combat.deathHandlers > 0
    )
  ) {
    pressure += 1;
  }

  return pressure;
}
