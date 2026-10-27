import type {
  DynamicPropertyAccess,
} from "../../core/types.js";

export type PersistentStateScope =
  | "player"
  | "entity"
  | "item"
  | "arena"
  | "session"
  | "world"
  | "unknown";

export interface PersistentStateScopeEvidence {
  propertyId: string;
  scope: PersistentStateScope;
  confidence: "exact-receiver" | "name-pattern" | "unknown";
  reasons: readonly string[];
}

export function inferPersistentStateScopes(
  accesses: readonly DynamicPropertyAccess[],
): PersistentStateScopeEvidence[] {
  const byProperty = new Map<
    string,
    DynamicPropertyAccess[]
  >();

  for (const access of accesses) {
    if (!access.propertyId) continue;
    const bucket =
      byProperty.get(access.propertyId) ?? [];
    bucket.push(access);
    byProperty.set(access.propertyId, bucket);
  }

  return [...byProperty.entries()]
    .map(([propertyId, items]) => {
      // A receiverHint is original source spelling, NOT Script API identity.
      // An arbitrary object named "world" or "player" must never gain
      // "exact-receiver" evidence by matching a regex. Use only direct typed
      // receiver witnesses and abstain on bounded/ambiguous ownership.
      const receiverKinds = items.map(item => {
        if (item.receiverInference !== "direct") return undefined;
        switch (item.receiverType) {
          case "World": return "world" as const;
          case "Player": return "player" as const;
          case "Entity": return "entity" as const;
          case "ItemStack": return "item" as const;
          default: return undefined;
        }
      });
      const known = [...new Set(receiverKinds.filter(
        (scope): scope is "player" | "entity" | "item" | "world" =>
          scope !== undefined,
      ))];

      // One property literal reused across player and world receivers is
      // NOT one shared state owner. Neither name nor first match wins.
      if (known.length > 1 ||
          (known.length > 0 && receiverKinds.some(kind => kind === undefined))) {
        return {
          propertyId,
          scope: "unknown" as const,
          confidence: "unknown" as const,
          reasons: [
            "The same property key is observed on conflicting or unresolved receivers; source evidence does not establish a unique state owner.",
          ],
        };
      }

      if (known.length === 1) {
        return {
          propertyId,
          scope: known[0]!,
          confidence: "exact-receiver" as const,
          reasons: [
            "All observed accesses use the same recognized receiver scope.",
          ],
        };
      }

      // An actual typed-but-bounded observation blocks naming guesses.
      // It may be real, but the current source cannot prove a unique scope.
      if (items.some(item => item.receiverType !== undefined)) {
        return {
          propertyId,
          scope: "unknown" as const,
          confidence: "unknown" as const,
          reasons: [
            "Receiver type is inferred only within bounds or mixed with unknown source; a property key or variable name cannot upgrade ownership proof.",
          ],
        };
      }

      // Only an expressly low-confidence name-pattern suggestion remains
      // when no typed receiver evidence exists at all.
      if (/arena/i.test(propertyId)) {
        return {
          propertyId,
          scope: "arena" as const,
          confidence: "name-pattern" as const,
          reasons: ["Property identifier contains an arena-scoped naming signal."],
        };
      }
      if (/(?:session|match|round)/i.test(propertyId)) {
        return {
          propertyId,
          scope: "session" as const,
          confidence: "name-pattern" as const,
          reasons: ["Property identifier contains a session/match/round naming signal."],
        };
      }

      return {
        propertyId,
        scope: "unknown" as const,
        confidence: "unknown" as const,
        reasons: [
          "Available source evidence does not establish ownership scope.",
        ],
      };
    })
    .sort((a, b) =>
      a.propertyId.localeCompare(b.propertyId)
    );
}
