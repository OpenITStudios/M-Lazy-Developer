import { describe, expect, it } from "vitest";
import {
  classifyGameplayIssue,
  GAMEPLAY_ISSUE_FAILURE_DOMAINS,
} from "../src/index.js";

describe("gameplay issue taxonomy", () => {
  it("classifies multi-arena capacity as arena domain at ready/start", () => {
    expect(
      classifyGameplayIssue({
        gameplayStage: "READY_START",
        scenarioLabel: "arena-capacity-plus-one",
        componentIds: [
          "runtime:arena",
          "runtime:arena-capacity",
        ],
        knowledgeDomains:
          ["multiplayer-interleaving"],
      }),
    ).toEqual({
      failureDomain: "arena-multi-arena",
      contributingDomains: [
        "arena-multi-arena",
      ],
      gameplayFlow: "READY_START",
    });
  });

  it("classifies wave progression above entity implementation detail", () => {
    expect(
      classifyGameplayIssue({
        gameplayStage: "PROGRESSION",
        scenarioLabel: "wave-progression",
        componentIds: [
          "runtime:entities",
          "runtime:chunks",
        ],
        knowledgeDomains: ["entity-behavior"],
      }),
    ).toEqual({
      failureDomain:
        "progression-wave-objective",
      contributingDomains: [
        "chunk-simulation",
        "entity-ai-combat",
        "progression-wave-objective",
      ],
      gameplayFlow: "PROGRESSION",
    });
  });

  it("classifies inventory economy interactions consistently", () => {
    expect(
      classifyGameplayIssue({
        gameplayStage: "ACTIVE_GAMEPLAY",
        scenarioLabel: "shop-purchase",
        componentIds: [
          "runtime:economy",
          "runtime:inventory",
        ],
        knowledgeDomains: ["economy-reward"],
      }),
    ).toEqual({
      failureDomain: "inventory-economy",
      contributingDomains: [
        "inventory-economy",
      ],
      gameplayFlow: "ACTIVE_GAMEPLAY",
    });
  });

  it("classifies ticking-area and residency failures as chunk simulation", () => {
    expect(
      classifyGameplayIssue({
        gameplayStage: "SETUP",
        scenarioLabel: "spawn-readiness",
        componentIds: ["runtime:chunks"],
        knowledgeDomains: ["chunk-simulation"],
      }),
    ).toEqual({
      failureDomain: "chunk-simulation",
      contributingDomains: [
        "chunk-simulation",
      ],
      gameplayFlow: "SETUP",
    });
  });

  it("classifies player-facing UI information separately", () => {
    expect(
      classifyGameplayIssue({
        gameplayStage: "READY_START",
        scenarioLabel: "queue-feedback",
        componentIds: ["runtime:ui-form"],
      }),
    ).toEqual({
      failureDomain:
        "ui-feedback-information",
      contributingDomains: [
        "ui-feedback-information",
      ],
      gameplayFlow: "READY_START",
    });
  });

  it("keeps misleading arena feedback in the UI domain while preserving arena contribution", () => {
    expect(
      classifyGameplayIssue({
        gameplayStage: "READY_START",
        scenarioLabel: "arena-availability-feedback",
        componentIds: ["runtime:arena"],
        knowledgeDomains:
          ["multiplayer-interleaving"],
      }),
    ).toEqual({
      failureDomain:
        "ui-feedback-information",
      contributingDomains: [
        "arena-multi-arena",
        "ui-feedback-information",
      ],
      gameplayFlow: "READY_START",
    });
  });

  it("does not classify platform performance as UI just because it contains form", () => {
    for (const scenarioLabel of [
      "performance-budget-exceeded",
      "platform-performance",
    ]) {
      expect(classifyGameplayIssue({
        gameplayStage: "ACTIVE_GAMEPLAY",
        scenarioLabel,
        componentIds: ["runtime:environment"],
      })).toMatchObject({
        failureDomain: "platform-performance",
      });
    }
    expect(classifyGameplayIssue({
      gameplayStage: "ACTIVE_GAMEPLAY",
      scenarioLabel: "openFormResponse",
      componentIds: ["runtime:ui-form"],
    })).toMatchObject({
      failureDomain: "ui-feedback-information",
    });
  });

  it("routes delayed callback ownership to temporal async", () => {
    expect(
      classifyGameplayIssue({
        gameplayStage: "RECOVERY",
        scenarioLabel: "deferred-callback-recovery",
        componentIds: [
          "runtime:persistence",
          "runtime:async-command-transaction",
        ],
        knowledgeDomains:
          ["temporal-ownership"],
      }),
    ).toEqual({
      failureDomain: "temporal-async",
      contributingDomains: [
        "persistence-recovery",
        "temporal-async",
      ],
      gameplayFlow: "RECOVERY",
    });
  });

  it("keeps one semantic primary while retaining all cross-domain contributors", () => {
    expect(
      classifyGameplayIssue({
        gameplayStage: "ACTIVE_GAMEPLAY",
        scenarioLabel: "generic-runtime-failure",
        componentIds: [],
        knowledgeDomains: [
          "platform-constraints",
          "chunk-simulation",
          "temporal-ownership",
          "state-flow",
        ],
      }),
    ).toEqual({
      failureDomain: "state-ownership",
      contributingDomains: [
        "chunk-simulation",
        "platform-performance",
        "state-ownership",
        "temporal-async",
      ],
      gameplayFlow: "ACTIVE_GAMEPLAY",
    });
  });

  it("rejects full-journey composition as a report flow", () => {
    expect(() =>
      classifyGameplayIssue({
        gameplayStage: "FULL_JOURNEY",
        scenarioLabel: "full-journey",
        componentIds: ["runtime:state"],
      })
    ).toThrow(/composition scenario/i);
  });

  it("keeps the domain vocabulary bounded", () => {
    expect(new Set(
      GAMEPLAY_ISSUE_FAILURE_DOMAINS,
    ).size).toBe(
      GAMEPLAY_ISSUE_FAILURE_DOMAINS.length,
    );
  });
});
