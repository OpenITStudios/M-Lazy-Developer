import { describe, expect, it } from "vitest";
import {
  BUILT_IN_INVARIANTS,
  InvariantRegistry,
  createMapCompatibilityFingerprint,
  augmentRetestPlan,
  createUpdateDelta,
  fingerprintIdentity,
  planRetest,
  type RetestPlan,
} from "../../src/index.js";

describe("reliability foundation", () => {
  it("rejects conflicting invariant semantics under one id", () => {
    const registry = new InvariantRegistry(BUILT_IN_INVARIANTS);
    expect(() => registry.register({
      ...BUILT_IN_INVARIANTS[0]!,
      title: "different meaning",
    })).toThrow(/already registered/);
  });

  it("creates deterministic map compatibility fingerprints", () => {
    const a = createMapCompatibilityFingerprint({
      mapId: "map-a",
      commandVerbs: ["fill", "execute", "fill"],
      capabilityTags: ["entity-ai", "structure-load"],
      domains: ["entities", "commands"],
    });

    const b = createMapCompatibilityFingerprint({
      mapId: "map-a",
      commandVerbs: ["execute", "fill"],
      capabilityTags: ["structure-load", "entity-ai"],
      domains: ["commands", "entities"],
    });

    expect(fingerprintIdentity(a)).toBe(fingerprintIdentity(b));
  });

  it("raises retest priority when an update overlaps volatile map capabilities and history", () => {
    const fingerprint = createMapCompatibilityFingerprint({
      mapId: "the-circuit",
      capabilityTags: ["entity-ai", "structure-load", "scoreboard"],
      domains: ["entities", "structures", "multiplayer"],
      riskSurfaces: ["entity-ai", "multiplayer-concurrency"],
    });

    const delta = createUpdateDelta("1.99.0", [{
      id: "entity-validation-change",
      kind: "behavior-changed",
      domain: "entities",
      capabilityTags: ["entity-ai"],
      affectedIdentifiers: [],
      summary: "Entity behavior changed.",
      source: "fixture",
      confidence: "documented",
    }], "1.98.0");

    const plan = planRetest(
      fingerprint,
      delta,
      [{
        id: "reg_entity_wall",
        title: "Entity failed to break wall",
        domain: "entities",
        discoveredBy: "manual",
        invariantIds: [],
        triggerTags: ["minecraft-update"],
        capabilityTags: ["entity-ai"],
        reproduction: ["start level"],
        expected: "wall breaks",
        observed: "wall remains",
      }],
      [{
        domain: "entities",
        lane: "differential",
        state: "unknown",
      }],
    );

    expect(plan.priority).toBe("P0");
    expect(plan.suggestedLanes).toEqual(expect.arrayContaining([
      "static",
      "differential",
      "runtime",
      "generative",
    ]));
  });
  it("augments retest plans from causal regression evidence", () => {
    const base: RetestPlan = {
      mapId: "map",
      updateVersion: "1.30.0",
      priority: "P3",
      reasons: [],
      suggestedLanes: ["static"],
      affectedDomains: [],
    };

    const augmented = augmentRetestPlan(
      base,
      [{
        kind: "causal-regression",
        detail: "Observed downstream causal outcomes increased by 1.",
        weight: 5,
      }],
      ["unknown"],
    );

    expect(augmented.priority).toBe("P2");
    expect(augmented.suggestedLanes).toEqual(expect.arrayContaining([
      "static",
      "runtime",
      "differential",
    ]));
    expect(augmented.affectedDomains).toContain("unknown");
  });
});
