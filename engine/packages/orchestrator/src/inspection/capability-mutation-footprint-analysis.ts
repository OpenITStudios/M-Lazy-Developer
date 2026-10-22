import type {
  ArenaCleanupSurfaceAnalysis,
} from "../arena/arena-cleanup-surface-analysis.js";
import type {
  InventoryLifecycleAnalysis,
} from "./inventory-lifecycle-analysis.js";
import type {
  PlayerCapabilitySurfaceAnalysis,
} from "./player-capability-surface-analysis.js";
import type {
  SpatialAuthorityCoverageReport,
} from "./spatial-authority-analysis.js";

export type CapabilityMutationSurface =
  | "inventory"
  | "equipment"
  | "gamemode"
  | "player-capability"
  | "world-mutation";

export interface CapabilityMutationFootprintItem {
  surface: CapabilityMutationSurface;
  requiredBecause: readonly string[];
  status: "covered" | "partial" | "unresolved";
  reason: string;
}

export interface CapabilityMutationFootprintAnalysis {
  broadCapabilityDetected: boolean;
  surfaces: readonly CapabilityMutationFootprintItem[];
  covered: number;
  partial: number;
  unresolved: number;
}

function cleanupStatus(
  cleanup: ArenaCleanupSurfaceAnalysis | undefined,
  surface: "gamemode" | "player-capability",
): CapabilityMutationFootprintItem["status"] {
  const matches =
    cleanup?.ledger?.obligations.filter(
      (item) => item.surface === surface,
    ) ?? [];
  if (matches.length === 0) return "unresolved";
  if (matches.every((item) => item.status === "complete")) {
    return "covered";
  }
  if (matches.some((item) => item.status === "partial")) {
    return "partial";
  }
  return "unresolved";
}

export function analyzeCapabilityMutationFootprint(input: {
  playerCapabilities: PlayerCapabilitySurfaceAnalysis;
  arenaCleanup?: ArenaCleanupSurfaceAnalysis;
  inventory?: InventoryLifecycleAnalysis;
  spatialAuthority?: SpatialAuthorityCoverageReport;
}): CapabilityMutationFootprintAnalysis {
  const reasons: string[] = [];
  if (input.playerCapabilities.creativeModeGrants > 0) {
    reasons.push("creative");
  }
  if (input.playerCapabilities.spectatorModeGrants > 0) {
    reasons.push("spectator");
  }
  if (input.playerCapabilities.mayflyGrants > 0) {
    reasons.push("mayfly");
  }
  if (input.playerCapabilities.commandPermissionWrites > 0) {
    reasons.push("command-permission");
  }
  if (input.playerCapabilities.privilegedBypassReturns > 0) {
    reasons.push("privileged-bypass");
  }

  const surfaces: CapabilityMutationFootprintItem[] = [];

  if (input.playerCapabilities.creativeModeGrants > 0) {
    const inventory = input.inventory;
    const inventoryStatus =
      inventory === undefined ||
      inventory.resetCandidates === 0
        ? "unresolved" as const
        : inventory.partialResets > 0
          ? "partial" as const
          : inventory.completeResets > 0
            ? "covered" as const
            : "unresolved" as const;
    surfaces.push({
      surface: "inventory",
      requiredBecause: ["creative"],
      status: inventoryStatus,
      reason:
        inventoryStatus === "covered"
          ? "Creative inventory mutation has a complete discovered reset path."
          : "Creative broad item access requires a complete inventory reset across every terminal/recovery path.",
    });

    const equipmentStatus =
      inventory === undefined ||
      inventory.resetCandidates === 0
        ? "unresolved" as const
        : inventory.unresolvedEquipmentSlotEvidence > 0 ||
          inventory.partialResets > 0
          ? "partial" as const
          : inventory.completeResets > 0
            ? "covered" as const
            : "unresolved" as const;
    surfaces.push({
      surface: "equipment",
      requiredBecause: ["creative"],
      status: equipmentStatus,
      reason:
        equipmentStatus === "covered"
          ? "Equipment reset is included in the discovered complete player reset."
          : "Inventory clear alone cannot prove Creative equipment/offhand cleanup.",
    });
  }

  if (
    input.playerCapabilities.creativeModeGrants > 0 ||
    input.playerCapabilities.spectatorModeGrants > 0
  ) {
    const status = cleanupStatus(
      input.arenaCleanup,
      "gamemode",
    );
    surfaces.push({
      surface: "gamemode",
      requiredBecause: [
        ...(input.playerCapabilities.creativeModeGrants > 0
          ? ["creative"]
          : []),
        ...(input.playerCapabilities.spectatorModeGrants > 0
          ? ["spectator"]
          : []),
      ],
      status,
      reason:
        status === "covered"
          ? "Temporary gameplay gamemode has complete terminal release coverage."
          : "Temporary gamemode grant lacks complete terminal cleanup proof.",
    });
  }

  if (input.playerCapabilities.mayflyGrants > 0) {
    const status = cleanupStatus(
      input.arenaCleanup,
      "player-capability",
    );
    surfaces.push({
      surface: "player-capability",
      requiredBecause: ["mayfly"],
      status,
      reason:
        status === "covered"
          ? "Temporary mayfly capability has complete terminal release coverage."
          : "Temporary mayfly capability lacks complete terminal release proof.",
    });
  }

  if (input.playerCapabilities.privilegedBypassReturns > 0) {
    const spatial = input.spatialAuthority;
    const status =
      spatial !== undefined &&
      spatial.policyValid &&
      spatial.uncovered === 0 &&
      spatial.conflicts === 0 &&
      spatial.unknownRegions === 0
        ? "covered" as const
        : "unresolved" as const;
    surfaces.push({
      surface: "world-mutation",
      requiredBecause: ["privileged-bypass"],
      status,
      reason:
        status === "covered"
          ? "Privileged world mutation is bounded by complete spatial-authority coverage."
          : "Privileged bypass exists without complete spatial-authority proof; live-world mutation scope remains unresolved.",
    });
  }

  return {
    broadCapabilityDetected: reasons.length > 0,
    surfaces,
    covered:
      surfaces.filter(
        (item) => item.status === "covered",
      ).length,
    partial:
      surfaces.filter(
        (item) => item.status === "partial",
      ).length,
    unresolved:
      surfaces.filter(
        (item) => item.status === "unresolved",
      ).length,
  };
}
