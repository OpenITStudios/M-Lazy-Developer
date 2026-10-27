import { describe, expect, it } from "vitest";
import {
  inferPersistentStateScopes,
} from "../../../src/domains/persistence/persistent-state-scope.js";

describe("persistent state scope inference", () => {
  it("lets recognized world receiver outrank a round/arena key name", () => {
    const result = inferPersistentStateScopes([{
      operation: "set", propertyId: "arenaRoundState",
      receiverHint: "world",
      receiverType: "World",
      receiverInference: "direct",
      source: { artifactId: "a", relativePath: "scripts/main.ts" },
    }]);
    expect(result[0]).toMatchObject({
      scope: "world", confidence: "exact-receiver",
    });
  });

  it("keeps same literal key across player/world owners unresolved", () => {
    const source = { artifactId: "a", relativePath: "scripts/main.ts" };
    const result = inferPersistentStateScopes([
      { operation: "get", propertyId: "roundState",
        receiverHint: "world", receiverType: "World", receiverInference: "direct", source },
      { operation: "set", propertyId: "roundState",
        receiverHint: "player", receiverType: "Player", receiverInference: "direct", source },
    ]);
    expect(result[0]).toMatchObject({
      scope: "unknown", confidence: "unknown",
    });
  });

  it("does not turn an unidentified receiver into an exact mixed ownership proof", () => {
    const source = { artifactId: "a", relativePath: "scripts/main.ts" };
    const result = inferPersistentStateScopes([
      { operation: "get", propertyId: "matchState",
        receiverHint: "world", receiverType: "World", receiverInference: "direct", source },
      { operation: "set", propertyId: "matchState",
        receiverHint: "manager", source },
    ]);
    expect(result[0]?.scope).toBe("unknown");
    expect(result[0]?.confidence).toBe("unknown");
  });


  it("prefers receiver evidence over naming heuristics", () => {
    const result = inferPersistentStateScopes([
      {
        operation: "set",
        propertyId: "lastMatch",
        receiverHint: "player",
        receiverType: "Player",
        receiverInference: "direct",
        source: {
          artifactId: "artifact:test",
          relativePath: "scripts/main.ts",
        },
      },
    ]);

    expect(result[0]).toEqual(
      expect.objectContaining({
        scope: "player",
        confidence: "exact-receiver",
      }),
    );
  });


  it("does not promote a lexical world-looking variable to typed ownership", () => {
    const source = { artifactId: "selected", relativePath: "scripts/main.ts" };
    const lexicalOnly = inferPersistentStateScopes([{
      operation: "set", propertyId: "arenaRoundState",
      receiverHint: "world", source,
    }]);
    expect(lexicalOnly[0]).toMatchObject({
      scope: "arena", confidence: "name-pattern",
    });
    const bounded = inferPersistentStateScopes([{
      operation: "get", propertyId: "arenaRoundState",
      receiverHint: "world", receiverType: "World",
      receiverInference: "bounded", source,
    }]);
    expect(bounded[0]).toMatchObject({
      scope: "unknown", confidence: "unknown",
    });
  });

  it("preserves exact item dynamic-property ownership without borrowing player state", () => {
    const result = inferPersistentStateScopes([{
      operation: "get", propertyId: "item:unique-id",
      receiverHint: "item", receiverType: "ItemStack",
      receiverInference: "direct",
      source: { artifactId: "selected", relativePath: "scripts/items.ts" },
    }]);
    expect(result[0]).toMatchObject({
      scope: "item", confidence: "exact-receiver",
    });
  });

  it("keeps ambiguous properties unknown", () => {
    const result = inferPersistentStateScopes([
      {
        operation: "get",
        propertyId: "data",
        receiverHint: "manager",
        source: {
          artifactId: "artifact:test",
          relativePath: "scripts/main.ts",
        },
      },
    ]);

    expect(result[0]?.scope).toBe("unknown");
  });
});
