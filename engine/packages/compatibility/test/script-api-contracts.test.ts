import { describe, expect, it } from "vitest";
import { checkScriptApiCapability } from "../src/script-api-matrix.js";
import {
  findScriptEventRule,
  scriptEventSymbol,
} from "../src/script-event-matrix.js";
import { evaluateScriptSymbolLifecycle } from "../src/script-lifecycle.js";
import {
  checkScriptMethodSymbol,
  findScriptMethodRule,
} from "../src/script-method-matrix.js";
import { checkScriptReturnContract } from "../src/script-return-contract-matrix.js";
import {
  checkScriptMethodSignature,
  type ScriptArgumentKind,
  type ScriptMethodCallShapeObservation,
} from "../src/script-signature-matrix.js";

// Original coverage: script-api-matrix.test.ts
describe("Script API version matrix", () => {
  it("evaluates documented stable capability minima", () => {
    expect(checkScriptApiCapability(
      "script.dynamic-properties.world-entity",
      "@minecraft/server",
      "1.7.0",
    ).supported).toBe(true);

    expect(checkScriptApiCapability(
      "script.dynamic-properties.world-entity",
      "@minecraft/server",
      "1.6.0",
    ).supported).toBe(false);
  });

  it("keeps beta/prerelease evaluation unknown unless track-specific", () => {
    expect(checkScriptApiCapability(
      "script.system-before-events",
      "@minecraft/server",
      "2.12.0-beta.1.26.60-preview.25",
    ).supported).toBe("unknown");
  });
});

// Original coverage: script-event-matrix.test.ts
describe("Script API event symbol matrix", () => {
  it("marks current beta-only world before events as pre-release", () => {
    const rule = findScriptEventRule(
      scriptEventSymbol("world", "beforeEvents", "playerPlaceBlock"),
    );

    expect(rule).toMatchObject({
      stability: "pre-release",
      introducedIn: "2.12.0-beta.1.26.60-preview.23",
    });
  });

  it("keeps long-lived scriptEventReceive stable without inventing a minimum version", () => {
    const rule = findScriptEventRule(
      "system.afterEvents.scriptEventReceive",
    );

    expect(rule?.stability).toBe("stable");
    expect(rule?.introducedIn).toBeUndefined();
  });
});

// Original coverage: script-lifecycle.test.ts
const lifecycle = {
  deprecatedInMajor: 1,
  removedIn: "2.0.0",
  replacement: "Dimension.playSound",
  sourceIds: ["official"],
} as const;

describe("Script API symbol lifecycle", () => {
  it("marks documented 1.x legacy usage as deprecated", () => {
    expect(evaluateScriptSymbolLifecycle(
      lifecycle,
      "1.19.0",
      "stable",
    ).state).toBe("deprecated");
  });

  it("marks 2.x usage as removed, including prerelease tracks", () => {
    expect(evaluateScriptSymbolLifecycle(
      lifecycle,
      "2.0.0",
      "stable",
    ).state).toBe("removed");
    expect(evaluateScriptSymbolLifecycle(
      lifecycle,
      "2.12.0-beta.1.26.60-preview.25",
      "beta",
    ).state).toBe("removed");
  });

  it("supports remove-and-reintroduce lifecycles", () => {
    const reintroduced = {
      deprecatedInMajor: 1,
      removedIn: "2.0.0",
      reintroducedIn: "2.6.0",
      sourceIds: ["official"],
    } as const;

    expect(evaluateScriptSymbolLifecycle(
      reintroduced,
      "1.19.0",
      "stable",
    ).state).toBe("deprecated");
    expect(evaluateScriptSymbolLifecycle(
      reintroduced,
      "2.0.0",
      "stable",
    ).state).toBe("removed");
    expect(evaluateScriptSymbolLifecycle(
      reintroduced,
      "2.5.0",
      "stable",
    ).state).toBe("removed");
    expect(evaluateScriptSymbolLifecycle(
      reintroduced,
      "2.6.0",
      "stable",
    ).state).toBe("active");
    expect(evaluateScriptSymbolLifecycle(
      reintroduced,
      "2.12.0-beta.1.26.60-preview.25",
      "beta",
    ).state).toBe("active");
  });

  it("supports removed-without-prior-deprecation transitions", () => {
    expect(evaluateScriptSymbolLifecycle({
      removedIn: "2.0.0",
      replacement: "GameMode.Adventure",
      sourceIds: ["official"],
    }, "1.19.0", "stable").state).toBe("active");

    expect(evaluateScriptSymbolLifecycle({
      removedIn: "2.0.0",
      replacement: "GameMode.Adventure",
      sourceIds: ["official"],
    }, "2.0.0", "stable").state).toBe("removed");
  });

  it("does not guess when the module track is unknown", () => {
    expect(evaluateScriptSymbolLifecycle(
      lifecycle,
      "latest",
      "unknown",
    ).state).toBe("unknown");
  });
});

// Original coverage: script-method-matrix.test.ts
describe("Script API method symbol matrix", () => {
  it("tracks stable minima for methods used by the runtime harness", () => {
    expect(findScriptMethodRule("world.getAllPlayers")).toMatchObject({
      stability: "stable",
      introducedIn: "1.0.0",
    });
    expect(findScriptMethodRule("system.runInterval")).toMatchObject({
      stability: "stable",
      introducedIn: "1.1.0",
    });
  });

  it("tracks evidence-backed receiver method minima", () => {
    expect(findScriptMethodRule("Dimension.getEntities")).toMatchObject({
      stability: "stable",
      introducedIn: "1.1.0",
    });
    expect(findScriptMethodRule("Entity.getTags")).toMatchObject({
      stability: "stable",
      introducedIn: "1.2.0",
    });
    expect(findScriptMethodRule("Entity.addTag")).toMatchObject({
      stability: "stable",
      introducedIn: "1.2.0",
    });
  });

  it("evaluates stable method minima without guessing beta compatibility", () => {
    expect(checkScriptMethodSymbol(
      "system.runInterval",
      "1.0.0",
      "stable",
    ).supported).toBe(false);
    expect(checkScriptMethodSymbol(
      "system.runInterval",
      "1.1.0",
      "stable",
    ).supported).toBe(true);
    expect(checkScriptMethodSymbol(
      "system.runInterval",
      "2.12.0-beta.1.26.60-preview.25",
      "beta",
    ).supported).toBe("unknown");
  });
});

// Original coverage: script-return-contract-matrix.test.ts
describe("Script API return-contract matrix", () => {
  it("only treats direct dereference as risk after the optional-return transition", () => {
    expect(checkScriptReturnContract({
      symbol: "Entity.getComponent",
      resultUse: "dereferenced",
    }, "1.17.0", "stable").state).toBe("safe");

    expect(checkScriptReturnContract({
      symbol: "Entity.getComponent",
      resultUse: "dereferenced",
    }, "1.18.0", "stable").state).toBe("risk");

    expect(checkScriptReturnContract({
      symbol: "Entity.getComponent",
      resultUse: "optional-dereferenced",
    }, "1.18.0", "stable").state).toBe("safe");
  });

  it("distinguishes bounded guarded and unguarded assigned results", () => {
    expect(checkScriptReturnContract({
      symbol: "Entity.getComponent",
      resultUse: "guarded-assigned",
    }, "1.18.0", "stable").state).toBe("safe");

    expect(checkScriptReturnContract({
      symbol: "Entity.getComponent",
      resultUse: "unguarded-assigned",
    }, "1.18.0", "stable").state).toBe("risk");
  });

  it("tracks the other 1.18 optional return transitions", () => {
    for (const symbol of [
      "Block.getComponent",
      "ItemStack.getComponent",
      "BlockPermutation.getState",
    ]) {
      expect(checkScriptReturnContract({
        symbol,
        resultUse: "dereferenced",
      }, "1.17.0", "stable").state).toBe("safe");

      expect(checkScriptReturnContract({
        symbol,
        resultUse: "dereferenced",
      }, "1.18.0", "stable").state).toBe("risk");
    }
  });

  it("keeps assigned results unknown instead of guessing downstream guards", () => {
    expect(checkScriptReturnContract({
      symbol: "Entity.getComponent",
      resultUse: "assigned",
    }, "1.18.0", "stable").state).toBe("unknown");
  });
});

// Original coverage: script-signature-matrix.test.ts
function call(
  symbol: string,
  argumentKinds: ScriptArgumentKind[],
): ScriptMethodCallShapeObservation {
  return {
    symbol,
    argumentCount: argumentKinds.length,
    argumentKinds,
    hasSpreadArgument: argumentKinds.includes("spread"),
  };
}

describe("Script API signature matrix", () => {
  it("distinguishes applyKnockback 1.x and 2.x call shapes", () => {
    const legacy = call("Entity.applyKnockback", [
      "number", "number", "number", "number",
    ]);
    const current = call("Entity.applyKnockback", ["object", "number"]);

    expect(checkScriptMethodSignature(
      legacy,
      "1.19.0",
      "stable",
    ).compatible).toBe(true);
    expect(checkScriptMethodSignature(
      legacy,
      "2.0.0",
      "stable",
    ).compatible).toBe(false);
    expect(checkScriptMethodSignature(
      current,
      "2.0.0",
      "stable",
    ).compatible).toBe(true);
  });

  it("allows spawnEntity options only from 2.0.0 onward", () => {
    const withOptions = call("Dimension.spawnEntity", [
      "string", "object", "object",
    ]);

    expect(checkScriptMethodSignature(
      withOptions,
      "1.19.0",
      "stable",
    ).compatible).toBe(false);
    expect(checkScriptMethodSignature(
      withOptions,
      "2.0.0",
      "stable",
    ).compatible).toBe(true);
  });

  it("keeps spread-argument arity unknown", () => {
    const spread = call("Entity.applyKnockback", ["spread"]);
    expect(checkScriptMethodSignature(
      spread,
      "2.0.0",
      "stable",
    ).compatible).toBe("unknown");
  });
});

