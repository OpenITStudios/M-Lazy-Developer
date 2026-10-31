import type {
  GameDesignMapClassification,
  GameDesignMechanicTag,
  GameDesignMapType,
  GameDesignPlayerMode,
} from "./types.js";

export const GAME_DESIGN_MAP_TYPES = [
  "BUILDING",
  "COMBAT",
  "SURVIVAL",
  "STRATEGY",
  "SEARCH_PUZZLE",
  "STORY_QUEST",
  "CHALLENGE_COURSE",
  "SKILL_COURSE",
] as const satisfies readonly GameDesignMapType[];

export const GAME_DESIGN_PLAYER_MODES = [
  "SOLO",
  "COOPERATIVE",
  "COMPETITIVE",
  "TEAM_COMPETITIVE",
  "ASYMMETRIC",
] as const satisfies readonly GameDesignPlayerMode[];

export const GAME_DESIGN_MECHANIC_TAGS = [
  "BUILD",
  "MEMORY",
  "SEARCH",
  "PUZZLE",
  "PARKOUR",
  "MELEE_COMBAT",
  "RANGED_COMBAT",
  "TEAM_COMBAT",
  "BASE_DEFENSE",
  "BASE_ATTACK",
  "CAPTURE_OBJECTIVE",
  "ESCORT",
  "EXTRACTION",
  "WAVE_DEFENSE",
  "SURVIVAL_TIMER",
  "ENTITY_AI",
  "RESOURCE_ECONOMY",
  "SHOP",
  "LOADOUT",
  "CRAFTING",
  "COLLECTION",
  "RESPAWN",
  "REVIVE",
  "ROUND_TIMER",
  "MULTI_ARENA",
  "MULTI_STAGE",
  "PROGRESSION",
  "PERSISTENCE",
  "RECONNECT",
  "WORLD_RESET",
] as const satisfies readonly GameDesignMechanicTag[];

export function isResolvedMapClassification(
  classification: GameDesignMapClassification,
): boolean {
  return (
    classification.classificationStatus === "RESOLVED" &&
    classification.mapType !== null &&
    classification.playerMode !== null
  );
}


export function migrateLegacyMapClassification(
  legacyLabel: string,
  evidenceRef: string,
): GameDesignMapClassification {
  const normalized = legacyLabel
    .trim()
    .toLowerCase();

  const prefix =
    normalized.split(" - ")[0] ?? normalized;

  const base = {
    playerMode: null,
    classificationStatus:
      "UNRESOLVED" as const,
    evidenceRefs: [
      evidenceRef,
    ],
  };

  if (prefix === "build") {
    return {
      ...base,
      mapType: "BUILDING",
      mechanicTags: ["BUILD"],
    };
  }

  if (prefix === "pvp") {
    return {
      ...base,
      mapType: "COMBAT",
      mechanicTags: [],
    };
  }

  if (prefix === "story" || prefix === "quest") {
    return { ...base, mapType: "STORY_QUEST", mechanicTags: [] };
  }
  if (prefix === "challenge") {
    return {
      ...base,
      mapType: "CHALLENGE_COURSE",
      mechanicTags: [],
    };
  }

  if (
    prefix === "find the button"
  ) {
    return {
      ...base,
      mapType: "SEARCH_PUZZLE",
      mechanicTags: [
        "SEARCH",
        "PUZZLE",
      ],
    };
  }

  if (prefix === "skills") {
    return {
      ...base,
      mapType: "SKILL_COURSE",
      mechanicTags: [],
    };
  }

  return {
    ...base,
    mapType: null,
    mechanicTags: [],
  };
}
