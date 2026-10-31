export type GameDesignStatus = "draft" | "approved";
export type GameDesignSourceKind = "authored-spec" | "client-brief" | "approved-reconstruction";

export type GameDesignMapType =
  | "BUILDING"
  | "COMBAT"
  | "SURVIVAL"
  | "STRATEGY"
  | "SEARCH_PUZZLE"
  | "STORY_QUEST"
  | "CHALLENGE_COURSE"
  | "SKILL_COURSE";

export type GameDesignPlayerMode =
  | "SOLO"
  | "COOPERATIVE"
  | "COMPETITIVE"
  | "TEAM_COMPETITIVE"
  | "ASYMMETRIC";

export type GameDesignMechanicTag =
  | "BUILD"
  | "MEMORY"
  | "SEARCH"
  | "PUZZLE"
  | "PARKOUR"
  | "MELEE_COMBAT"
  | "RANGED_COMBAT"
  | "TEAM_COMBAT"
  | "BASE_DEFENSE"
  | "BASE_ATTACK"
  | "CAPTURE_OBJECTIVE"
  | "ESCORT"
  | "EXTRACTION"
  | "WAVE_DEFENSE"
  | "SURVIVAL_TIMER"
  | "ENTITY_AI"
  | "RESOURCE_ECONOMY"
  | "SHOP"
  | "LOADOUT"
  | "CRAFTING"
  | "COLLECTION"
  | "RESPAWN"
  | "REVIVE"
  | "ROUND_TIMER"
  | "MULTI_ARENA"
  | "MULTI_STAGE"
  | "PROGRESSION"
  | "PERSISTENCE"
  | "RECONNECT"
  | "WORLD_RESET";

export type GameDesignMapClassificationStatus =
  | "RESOLVED"
  | "UNRESOLVED";

export interface GameDesignMapClassification {
  readonly mapType: GameDesignMapType | null;
  readonly playerMode: GameDesignPlayerMode | null;
  readonly mechanicTags: readonly GameDesignMechanicTag[];
  readonly classificationStatus:
    GameDesignMapClassificationStatus;
  readonly evidenceRefs: readonly string[];
}

export interface GameDesignSpec {
  schemaVersion: 1;
  id: string;
  title?: string;
  status: GameDesignStatus;
  scope?: { mapId?: string; modeId?: string };
  source: { kind: GameDesignSourceKind; reference: string };
  classification?: GameDesignMapClassification;
  mechanics: readonly { id: string; statement: string; tags?: readonly string[] }[];
  intentRules?: readonly GameDesignIntentRule[];
  behaviorConstraints?: GameDesignBehaviorConstraints;
  invariants: readonly {
    id: string;
    statement: string;
    strength: "must" | "must-not" | "should";
    subjectIds?: readonly string[];
  }[];
}

export interface GameDesignBehaviorConstraints {
  combat?: {
    friendlyFireAllowed?: boolean;
    crossArenaDamageAllowed?: boolean;
    environmentalDamageAllowed?: boolean;
    selfReviveAllowed?: boolean;
    multipleReviversAllowed?: boolean;
    reviveAfterDeathAllowed?: boolean;
  };
  economy?: {
    deathRewardArbitration?: "complementary" | "mutually-exclusive" | "unresolved";
    pickupCurrencyItemPolicy?: "consume" | "retain" | "not-applicable";
    inventoryFullPolicy?: "leave-remainder" | "defer" | "convert" | "reject" | "compensate" | "not-applicable";
  };
  inventory?: {
    rules: readonly {
      id: string;
      itemClass: string;
      ownershipScope: "player-durable" | "session" | "arena" | "round" | "life";
      dropAllowed: boolean;
      resetOn: readonly ("kit-switch" | "round-end" | "arena-end" | "death" | "respawn" | "disconnect" | "reconnect" | "lobby-return")[];
      restoreOn?: readonly ("kit-switch" | "round-end" | "arena-end" | "death" | "respawn" | "disconnect" | "reconnect" | "lobby-return")[];
    }[];
  };
  spatial?: {
    rules: readonly {
      id: string;
      regionId: string;
      actor: "player" | "entity" | "system" | "*";
      action: "place-block" | "break-block" | "interact-block" | "use-item" | "use-container" | "teleport" | "spawn-entity" | "place-structure" | "*";
      phases?: readonly string[];
      decision: "allow" | "deny";
    }[];
  };
}


export type GameDesignIntentOutcome =
  | "required"
  | "forbidden"
  | "allowed"
  | "unspecified";

export type GameDesignIntentDeterminism =
  | "deterministic"
  | "bounded-random"
  | "unspecified";

export interface GameDesignIntentScope {
  readonly modes?: readonly string[];
  readonly phases?: readonly string[];
  readonly actorTypes?: readonly ("player" | "entity" | "system")[];
  readonly stateTags?: readonly string[];
}

export interface GameDesignIntentException {
  readonly id: string;
  readonly statement: string;
  readonly stateTags: readonly string[];
}

export interface GameDesignIntentRule {
  readonly id: string;
  readonly statement: string;
  readonly subjectIds?: readonly string[];
  readonly outcome: GameDesignIntentOutcome;
  readonly appliesWhen?: GameDesignIntentScope;
  readonly exceptions?: readonly GameDesignIntentException[];
  readonly determinism?: GameDesignIntentDeterminism;
}

export type IntentAuthorityStrength =
  | "authoritative"
  | "strong"
  | "inferred"
  | "unknown";

