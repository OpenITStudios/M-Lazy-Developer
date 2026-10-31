import {
  GAME_DESIGN_MAP_TYPES,
  GAME_DESIGN_MECHANIC_TAGS,
  GAME_DESIGN_PLAYER_MODES,
} from "./classification.js";
import type {
  GameDesignIntentRule,
  GameDesignMapClassification,
  GameDesignSpec,
} from "./types.js";

function nonEmptyStringArray(
  value: unknown,
): value is readonly string[] {
  return Array.isArray(value) &&
    value.every((item) =>
      typeof item === "string" &&
      item.trim().length > 0
    );
}


export function validateGameDesignMapClassification(
  value: unknown,
): string[] {
  if (value === undefined) return [];
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return [
      "Game Design classification must be an object when provided.",
    ];
  }

  const item =
    value as Partial<GameDesignMapClassification>;
  const errors: string[] = [];

  if (
    item.classificationStatus !== "RESOLVED" &&
    item.classificationStatus !== "UNRESOLVED"
  ) {
    errors.push(
      "Game Design classificationStatus must be RESOLVED or UNRESOLVED.",
    );
  }

  if (
    item.mapType !== null &&
    item.mapType !== undefined &&
    !GAME_DESIGN_MAP_TYPES.includes(
      item.mapType as any,
    )
  ) {
    errors.push(
      "Game Design mapType is not canonical.",
    );
  }

  if (
    item.playerMode !== null &&
    item.playerMode !== undefined &&
    !GAME_DESIGN_PLAYER_MODES.includes(
      item.playerMode as any,
    )
  ) {
    errors.push(
      "Game Design playerMode is not canonical.",
    );
  }

  if (!Array.isArray(item.mechanicTags)) {
    errors.push(
      "Game Design classification mechanicTags must be an array.",
    );
  } else {
    const invalid = item.mechanicTags.filter(
      (mechanic) =>
        !GAME_DESIGN_MECHANIC_TAGS.includes(
          mechanic as any,
        ),
    );
    if (invalid.length > 0) {
      errors.push(
        "Game Design classification contains non-canonical mechanic tag(s): " +
          invalid.join(", ") +
          ".",
      );
    }
    if (
      new Set(item.mechanicTags).size !==
      item.mechanicTags.length
    ) {
      errors.push(
        "Game Design classification mechanicTags must be unique.",
      );
    }
  }

  if (!Array.isArray(item.evidenceRefs)) {
    errors.push(
      "Game Design classification evidenceRefs must be an array.",
    );
  } else {
    if (
      item.evidenceRefs.some(
        (entry) =>
          typeof entry !== "string" ||
          !entry.trim(),
      )
    ) {
      errors.push(
        "Game Design classification evidenceRefs must contain non-empty strings.",
      );
    }
    if (
      new Set(item.evidenceRefs).size !==
      item.evidenceRefs.length
    ) {
      errors.push(
        "Game Design classification evidenceRefs must be unique.",
      );
    }
  }

  if (item.modes !== undefined) {
    if (!Array.isArray(item.modes) || item.modes.length > 32) {
      errors.push("Game Design modes must be an array of at most 32 entries.");
    } else {
      const gameIds = new Set<string>();
      const modeIds = new Set<string>();
      for (const [index, mode] of item.modes.entries()) {
        const label = "Game Design mode " + index;
        if (mode === null || typeof mode !== "object" ||
            Array.isArray(mode)) {
          errors.push(label + " must be an object.");
          continue;
        }
        if (typeof mode.modeId !== "string" || !mode.modeId.trim() ||
            mode.modeId.length > 128 || modeIds.has(mode.modeId)) {
          errors.push(label + " requires a unique modeId (1-128 characters).");
        } else modeIds.add(mode.modeId);
        if (typeof mode.gameSubjectId !== "string" ||
            !mode.gameSubjectId.trim() || mode.gameSubjectId.length > 256 ||
            gameIds.has(mode.gameSubjectId)) {
          errors.push(label + " requires a unique source gameSubjectId (1-256 characters).");
        } else gameIds.add(mode.gameSubjectId);
        if (!GAME_DESIGN_MAP_TYPES.includes(mode.mapType as any)) {
          errors.push(label + " mapType is not canonical.");
        }
        if (!GAME_DESIGN_PLAYER_MODES.includes(mode.playerMode as any)) {
          errors.push(label + " playerMode is not canonical.");
        }
        if (!Array.isArray(mode.mechanicTags) ||
            mode.mechanicTags.some((tag: string) =>
              !GAME_DESIGN_MECHANIC_TAGS.includes(tag as any)) ||
            new Set(mode.mechanicTags).size !== mode.mechanicTags.length) {
          errors.push(label + " mechanicTags must be unique canonical tags.");
        }
        if (!Array.isArray(mode.evidenceRefs) ||
            mode.evidenceRefs.length === 0 ||
            mode.evidenceRefs.some((ref: string) =>
              typeof ref !== "string" || !ref.trim()) ||
            new Set(mode.evidenceRefs).size !== mode.evidenceRefs.length) {
          errors.push(label + " evidenceRefs must be unique nonempty selected-source IDs.");
        }
      }
    }
  }

  if (
    item.classificationStatus === "RESOLVED"
  ) {
    if (item.mapType == null) {
      errors.push(
        "Resolved Game Design classification requires mapType.",
      );
    }
    if (item.playerMode == null) {
      errors.push(
        "Resolved Game Design classification requires playerMode.",
      );
    }
    if (
      !Array.isArray(item.evidenceRefs) ||
      item.evidenceRefs.length === 0
    ) {
      errors.push(
        "Resolved Game Design classification requires evidenceRefs.",
      );
    }
  }

  return errors;
}

function validateIntentRules(
  value: unknown,
): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    return ["Game Design intentRules must be an array when provided."];
  }

  const errors: string[] = [];
  const ids = new Set<string>();

  for (const raw of value) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      errors.push("Game Design intent rule must be an object.");
      continue;
    }
    const rule = raw as Partial<GameDesignIntentRule>;
    if (typeof rule.id !== "string" || !rule.id.trim()) {
      errors.push("Game Design intent rule id is required.");
      continue;
    }
    if (ids.has(rule.id)) {
      errors.push("Duplicate Game Design intent rule id: " + rule.id + ".");
    }
    ids.add(rule.id);

    if (typeof rule.statement !== "string" || !rule.statement.trim()) {
      errors.push("Game Design intent rule " + rule.id + " requires a statement.");
    }
    if (!["required", "forbidden", "allowed", "unspecified"].includes(String(rule.outcome))) {
      errors.push("Game Design intent rule " + rule.id + " has invalid outcome.");
    }
    if (
      rule.subjectIds !== undefined &&
      !nonEmptyStringArray(rule.subjectIds)
    ) {
      errors.push("Game Design intent rule " + rule.id + " subjectIds must contain non-empty strings.");
    }
    if (
      rule.determinism !== undefined &&
      !["deterministic", "bounded-random", "unspecified"].includes(rule.determinism)
    ) {
      errors.push("Game Design intent rule " + rule.id + " has invalid determinism.");
    }
    if (rule.appliesWhen !== undefined) {
      const scope = rule.appliesWhen as Record<string, unknown>;
      for (const key of ["modes", "phases", "stateTags"] as const) {
        const value = scope[key];
        if (value !== undefined && !nonEmptyStringArray(value)) {
          errors.push(
            "Game Design intent rule " + rule.id +
              " appliesWhen." + key +
              " must contain non-empty strings.",
          );
        }
      }
      const actorTypes = scope.actorTypes;
      if (
        actorTypes !== undefined &&
        (
          !Array.isArray(actorTypes) ||
          actorTypes.some((value) =>
            !["player", "entity", "system"].includes(String(value))
          )
        )
      ) {
        errors.push(
          "Game Design intent rule " + rule.id +
            " appliesWhen.actorTypes is invalid.",
        );
      }
    }

    const exceptionIds = new Set<string>();
    for (const exception of rule.exceptions ?? []) {
      if (
        !exception.id?.trim() ||
        !exception.statement?.trim() ||
        !nonEmptyStringArray(exception.stateTags)
      ) {
        errors.push("Game Design intent rule " + rule.id + " has an invalid exception.");
        continue;
      }
      if (exceptionIds.has(exception.id)) {
        errors.push(
          "Game Design intent rule " + rule.id +
            " has duplicate exception id: " + exception.id + ".",
        );
      }
      exceptionIds.add(exception.id);
    }
  }

  return errors;
}

export function validateGameDesignSpec(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return ["Game Design specification must be an object."];
  const item=value as Record<string,unknown>;
  const errors:string[]=[];
  if (item.schemaVersion!==1) errors.push("Game Design schemaVersion must be 1.");
  if (typeof item.id!=="string" || !item.id.trim()) errors.push("Game Design id is required.");
  if (item.status!=="draft" && item.status!=="approved") errors.push("Game Design status must be draft or approved.");
  if (!item.source || typeof item.source!=="object" || Array.isArray(item.source)) errors.push("Game Design source is required.");
  else {
    const source=item.source as Record<string,unknown>;
    if (!["authored-spec","client-brief","approved-reconstruction"].includes(String(source.kind))) errors.push("Game Design source kind is invalid.");
    if (typeof source.reference!=="string" || !source.reference.trim()) errors.push("Game Design source reference is required.");
  }
  if (!Array.isArray(item.mechanics)) errors.push("Game Design mechanics must be an array.");
  errors.push(
    ...validateGameDesignMapClassification(
      item.classification,
    ),
  );
  errors.push(...validateIntentRules(item.intentRules));
  if (!Array.isArray(item.invariants)) errors.push("Game Design invariants must be an array.");
  if (item.behaviorConstraints !== undefined && (!item.behaviorConstraints || typeof item.behaviorConstraints !== "object" || Array.isArray(item.behaviorConstraints))) errors.push("Game Design behaviorConstraints must be an object when provided.");
  return errors;
}

export function assertGameDesignSpec(value: unknown): GameDesignSpec {
  const errors=validateGameDesignSpec(value);
  if (errors.length) throw new Error("Invalid Game Design specification: "+errors.join(" "));
  return value as GameDesignSpec;
}
