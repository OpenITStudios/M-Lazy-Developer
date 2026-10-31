// Owner-local same-feature test suite consolidation (source-only).
import { describe, expect, it } from "vitest";
import { buildGameplayAuditScenarioPreset } from "../src/gameplay-audit-scenario-preset.js";
import { assessGameplayCapabilityDelivery, detectGameplayDegradation } from "../src/index.js";

// Original suite: engine/packages/diagnostic-reasoning/test/gameplay-audit-scenario-preset.test.ts (blob 5322de5c927721826be2306b5ec81df1986ea1b3)
{


describe("gameplay audit scenario preset flow stages", () => {
  it("binds mandatory scenarios to player-journey stages", () => {
    const preset = buildGameplayAuditScenarioPreset({
      maxPartySize: 4,
      arenaCount: 3,
      concurrentArenaLimit: 2,
      hasMultiArena: true,
      hasPersistence: true,
      hasDeferredWork: true,
      hasRepeatedRunSurface: true,
    });

    const byKind = new Map(
      preset.scenarios.map((scenario) => [
        scenario.kind,
        scenario.flowStage,
      ]),
    );

    expect(byKind.get("full-journey")).toBe(
      "FULL_JOURNEY",
    );
    expect(byKind.get("solo")).toBe("ENTRY_JOIN");
    expect(byKind.get("party-capacity-plus-one")).toBe(
      "READY_START",
    );
    expect(byKind.get("multi-arena-parallel")).toBe(
      "READY_START",
    );
    expect(byKind.get("arena-replica-integrity")).toBe(
      "SETUP",
    );
    const parallelScenario = preset.scenarios.find(
      (scenario) =>
        scenario.kind === "multi-arena-parallel",
    );
    expect(parallelScenario?.concurrentArenas).toBe(3);
    const replicaScenario = preset.scenarios.find(
      (scenario) =>
        scenario.kind === "arena-replica-integrity",
    );
    expect(replicaScenario?.concurrentArenas).toBe(3);
    expect(replicaScenario?.questions.join(" ")).toMatch(
      /world\/topology|replica/i,
    );
    expect(byKind.get("arena-capacity-plus-one")).toBe(
      "READY_START",
    );
    const capacityScenario = preset.scenarios.find(
      (scenario) =>
        scenario.kind === "arena-capacity-plus-one",
    );
    expect(capacityScenario?.concurrentArenas).toBe(3);
    expect(capacityScenario?.reason).toMatch(
      /gameplay\/design capacity degradation/i,
    );
    expect(byKind.get("terminal-collision")).toBe(
      "TERMINAL",
    );
    const progressionPreset =
      buildGameplayAuditScenarioPreset({
        hasProgressionActorSurface: true,
      });
    const progressionScenario =
      progressionPreset.scenarios.find(
        (scenario) =>
          scenario.kind ===
            "progression-wave-integrity",
      );
    expect(progressionScenario?.flowStage).toBe(
      "PROGRESSION",
    );
    expect(
      progressionScenario?.questions.join(" "),
    ).toMatch(
      /death\/removal|stop simulating|completion counter/i,
    );
    const terminalScenario = preset.scenarios.find(
      (scenario) =>
        scenario.kind === "terminal-collision",
    );
    expect(terminalScenario?.questions.join(" ")).toMatch(
      /ordinary player|terminal scopes/i,
    );
    const reconnectScenario = preset.scenarios.find(
      (scenario) =>
        scenario.kind === "disconnect-reconnect",
    );
    expect(reconnectScenario?.questions.join(" ")).toMatch(
      /locked required roster|builder\/role selection/i,
    );
    expect(byKind.get("disconnect-reconnect")).toBe(
      "RECOVERY",
    );
    expect(byKind.get("reload-recovery")).toBe(
      "RECOVERY",
    );
    expect(byKind.get("repeated-run")).toBe(
      "CLEANUP_REPLAY",
    );
  });

  it("derives minimum audit coverage and bounded scenarios from resolved map classification", () => {
    const preset =
      buildGameplayAuditScenarioPreset({
        classification: {
          mapType: "SURVIVAL",
          playerMode: "COOPERATIVE",
          mechanicTags: [
            "WAVE_DEFENSE",
            "MULTI_ARENA",
            "ROUND_TIMER",
            "WORLD_RESET",
          ],
          classificationStatus:
            "RESOLVED",
          evidenceRefs: [
            "design:survival-loop",
          ],
        },
      });

    const coverage = preset.scenarios.find(
      (item) =>
        item.kind ===
          "map-type-coverage",
    );

    expect(
      coverage?.requiredKnowledgeDomains,
    ).toEqual(
      expect.arrayContaining([
        "state-flow",
        "combat-lifecycle",
        "entity-behavior",
        "temporal-ownership",
        "multiplayer-interleaving",
        "chunk-simulation",
        "arena-lifecycle",
        "world-structure",
      ]),
    );

    const kinds = new Set(
      preset.scenarios.map(
        (item) => item.kind,
      ),
    );

    expect(kinds.has(
      "multi-arena-parallel",
    )).toBe(true);
    expect(kinds.has(
      "progression-wave-integrity",
    )).toBe(true);
    expect(kinds.has(
      "simulation-distance",
    )).toBe(true);
    expect(kinds.has(
      "deferred-ownership",
    )).toBe(true);
    expect(kinds.has(
      "repeated-run",
    )).toBe(true);
    // Resolved solo excludes irrelevant roster checks, but never hides a
    // multi-arena or contradictory multiplayer source/design obligation.
    const classified = (
      playerMode: "SOLO" | "COOPERATIVE",
      overrides: Partial<Parameters<typeof buildGameplayAuditScenarioPreset>[0]> = {},
    ) => buildGameplayAuditScenarioPreset({
      classification: {
        mapType: "CHALLENGE_COURSE",
        playerMode,
        mechanicTags: [],
        classificationStatus: "RESOLVED",
        evidenceRefs: ["design:player-mode"],
      },
      ...overrides,
    });
    const mixedKinds = (
      preset: ReturnType<typeof buildGameplayAuditScenarioPreset>,
    ) => preset.scenarios.filter((scenario) =>
      scenario.kind === "two-player" ||
      scenario.kind === "disconnect-reconnect").map((scenario) => scenario.kind);
    const mixed = ["two-player", "disconnect-reconnect"];

    expect(mixedKinds(classified("SOLO"))).toEqual([]);
    expect(mixedKinds(classified("SOLO", { maxPartySize: 1 }))).toEqual([]);
    expect(mixedKinds(classified("SOLO", { maxPartySize: 2 }))).toEqual(mixed);
    expect(mixedKinds(classified("SOLO", {
      hasMultiArena: true, arenaCount: 2,
    }))).toEqual(mixed);
    expect(mixedKinds(classified("COOPERATIVE", {
      maxPartySize: 1,
    }))).toEqual(mixed);
    expect(mixedKinds(buildGameplayAuditScenarioPreset({
      classification: {
        mapType: "CHALLENGE_COURSE",
        playerMode: "SOLO",
        mechanicTags: [],
        classificationStatus: "UNRESOLVED",
        evidenceRefs: [],
      },
    }))).toEqual(mixed);
  });

  it("does not route unresolved map classification into mandatory audit coverage", () => {
    const preset =
      buildGameplayAuditScenarioPreset({
        classification: {
          mapType: null,
          playerMode: null,
          mechanicTags: [
            "MULTI_ARENA",
          ],
          classificationStatus:
            "UNRESOLVED",
          evidenceRefs: [],
        },
      });

    expect(
      preset.scenarios.some(
        (item) =>
          item.kind ===
            "map-type-coverage",
      ),
    ).toBe(false);
    expect(
      preset.scenarios.some(
        (item) =>
          item.kind ===
            "multi-arena-parallel",
      ),
    ).toBe(false);
  });
});
}

// Original suite: engine/packages/diagnostic-reasoning/test/gameplay-capability-delivery.test.ts (blob bd7507e9afad26ee60e9ea75fc533e2dc38d95b5)
{


describe("gameplay capability delivery", () => {
  it("classifies visible capacity that exceeds playable capacity as design failure", () => {
    const result = assessGameplayCapabilityDelivery({
      subjectId: "runtime:arena-capacity",
      label: "Arena capacity",
      playerVisible: true,
      designed: true,
      implementationPresent: true,
      expectedCapacity: 6,
      playableCapacity: 2,
      technicalConstraintReasons: [
        "world ticking-area capacity",
      ],
      evidenceIds: [
        "world:arena-count",
        "capacity:safe-concurrency",
      ],
      playerFacingEvidenceIds: [
        "world:arena-count",
      ],
    });

    expect(result.status).toBe("DEGRADED");
    expect(result.failureClass).toBe(
      "DESIGN_FAILURE",
    );
    expect(result.issueType).toBe(
      "DESIGN_MISMATCH",
    );
    expect(result.expectedCapacity).toBe(6);
    expect(result.playableCapacity).toBe(2);
    expect(result.informationMismatch).toBe(true);
    expect(result.playerFacingEvidenceIds).toEqual([
      "world:arena-count",
    ]);
    expect(result.reason).toMatch(
      /does not deliver/i,
    );
  });

  it("classifies a player-visible designed capability with no implementation as design-implementation mismatch", () => {
    const result = assessGameplayCapabilityDelivery({
      subjectId: "mechanic:shop-upgrade",
      label: "Shop Upgrade",
      playerVisible: true,
      designed: true,
      implementationPresent: false,
      evidenceIds: ["dialogue:shop-upgrade"],
      playerFacingEvidenceIds: [
        "dialogue:shop-upgrade",
      ],
    });

    expect(result.status).toBe("MISSING");
    expect(result.failureClass).toBe(
      "DESIGN_IMPLEMENTATION_MISMATCH",
    );
    expect(result.issueType).toBe(
      "DESIGN_MISMATCH",
    );
    expect(result.informationMismatch).toBe(true);
  });

  it("classifies incomplete implemented behavior as implementation failure", () => {
    const result = assessGameplayCapabilityDelivery({
      subjectId: "mechanic:retry",
      label: "Retry",
      playerVisible: true,
      designed: true,
      implementationPresent: true,
      behaviorComplete: false,
      evidenceIds: ["source:retry"],
    });

    expect(result.status).toBe("DEGRADED");
    expect(result.failureClass).toBe(
      "IMPLEMENTATION_FAILURE",
    );
    expect(result.issueType).toBe("BUG");
  });

  it("does not manufacture a design issue when capability evidence is ungrounded", () => {
    const result = assessGameplayCapabilityDelivery({
      subjectId: "mechanic:unknown",
      label: "Unknown mechanic",
      playerVisible: false,
      designed: false,
    });

    expect(result.status).toBe("UNPROVEN");
    expect(result.failureClass).toBeUndefined();
  });
});
}

// Original suite: engine/packages/diagnostic-reasoning/test/gameplay-degradation.test.ts (blob 4083a104e73378b5ad8f1bdc1e3ca867ea7ac169)
{


describe("gameplay degradation", () => {
  it("detects reduced capacity while gameplay still runs", () => {
    const signals = detectGameplayDegradation({
      subjectId: "arena-capacity",
      primaryExpected: true,
      primaryObserved: false,
      expectedCapacity: 6,
      observedCapacity: 2,
    });

    expect(
      signals.some(
        (item) =>
          item.kind === "capacity-reduced",
      ),
    ).toBe(true);
  });

  it("keeps reduced arena capacity as an issue even when gameplay remains available", () => {
    const signals = detectGameplayDegradation({
      subjectId: "runtime:arena-capacity",
      primaryExpected: true,
      primaryObserved: false,
      fallbackObserved: true,
      expectedCapacity: 6,
      observedCapacity: 2,
    });

    expect(
      signals.some(
        (item) =>
          item.kind === "capacity-reduced" &&
          item.reason.includes("does not erase"),
      ),
    ).toBe(true);
  });

  it("detects fallback masking a failed primary mechanic", () => {
    const signals = detectGameplayDegradation({
      subjectId: "special-enemy",
      primaryExpected: true,
      primaryObserved: false,
      fallbackObserved: true,
    });

    expect(signals[0]?.kind)
      .toBe("fallback-masks-primary-failure");
  });
});
}
