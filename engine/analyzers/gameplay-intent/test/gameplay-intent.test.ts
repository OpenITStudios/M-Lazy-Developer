import { describe, expect, it } from "vitest";
import {
  extractGameplayIntentSignals,
} from "../src/index.js";
import type {
  ParsedScriptFile,
} from "../../scripts/src/index.js";

const source = {
  artifactId: "art_test",
  relativePath:
    "behavior_packs/demo/src/domain/session-state-machine.ts",
};

const bundledModuleSource = {
  artifactId: "art_test",
  relativePath: "behavior_packs/demo/scripts/main.js",
};

function script(): ParsedScriptFile {
  return {
    identifier: "domain/session-state-machine.ts",
    source,
    imports: [],
    events: [],
    dynamicProperties: [],
    restrictedMutations: [],
    deferredCallbacks: [],
    localFunctionCalls: [{
      callerRegion: "module",
      targetRegion: "function:resetArena",
      targetName: "resetArena",
      source,
    }],
    blockMatchGuards: [],
    methodCalls: [],
    propertyAccesses: [],
    propertyWrites: [],
    entityEventTriggers: [],
    commandLiterals: [{
      command: "scoreboard players add @s coins 1",
      source,
    }],
    lifecycleMemberExposures: [{
      member: "recoveryPolicy",
      candidateSymbols: ["RecoveryPolicy"],
      evidence: "exact-symbol",
      exactSymbol: "RecoveryPolicy",
      source,
    }],
    moduleMemberAccesses: [],
    importedSymbols: [],
    enumValueComparisons: [{
      module: "./types",
      enumName: "SessionState",
      member: "Active",
      symbol: "SessionState.Active",
      operator: "===",
      literal: "active",
      source,
    }],
    stateMutations: [{
      target: "session.state",
      targetName: "state",
      value: {
        kind: "member",
        owner: "SessionState",
        member: "Active",
        symbol: "SessionState.Active",
      },
      executionRegion: "function:resetArena",
      source,
    }],
    typeProperties: [
      {
        containerName: "ResourceRecord",
        propertyName: "owner",
        typeText: "SessionToken",
        optional: false,
        source,
      },
      {
        containerName: "GameSession",
        propertyName: "resources",
        typeText: "ResourceRecord[]",
        optional: false,
        source,
      },
    ],
    transitionDeclarations: [{
      tableName: "TRANSITIONS",
      stateType: "SessionPhase",
      from: "active",
      to: ["finishing", "failed"],
      source,
    }],
    returnOutcomes: [
      {
        executionRegion: "function:decideReconnect",
        propertyName: "action",
        value: "cleanup",
        source: { ...source, range: {
          lineStart: 10, lineEnd: 10, columnStart: 4, columnEnd: 28,
        } },
      },
      {
        executionRegion: "function:decideReconnect",
        propertyName: "action",
        value: "lobby",
        source,
      },
    ],
    guardedOutcomes: [{
      executionRegion: "function:decideReconnect",
      conditionText: "state.pendingCleanup",
      conditionIdentifiers: ["state", "state.pendingCleanup"],
      predicate: {
        kind: "truthy",
        operand: {
          kind: "path",
          path: "state.pendingCleanup",
        },
      },
      propertyName: "action",
      value: "cleanup",
      conditionSource: source,
      outcomeSource: { ...source, range: {
        lineStart: 10, lineEnd: 10, columnStart: 4, columnEnd: 28,
      } },
    }],
    capabilities: [],
  };
}

describe("gameplay intent analyzer", () => {

  it("does not invent gameplay from source folder or filename alone", () => {
    const empty: ParsedScriptFile = {
      identifier: "arena/wave",
      source: {
        artifactId: "sample:empty",
        relativePath: "behavior_packs/demo/scripts/arena/wave.js",
      },
      imports: [], events: [], dynamicProperties: [],
      restrictedMutations: [], deferredCallbacks: [],
      localFunctionCalls: [], blockMatchGuards: [],
      methodCalls: [], propertyAccesses: [], propertyWrites: [],
      entityEventTriggers: [], commandLiterals: [],
      lifecycleMemberExposures: [], moduleMemberAccesses: [],
      importedSymbols: [], enumValueComparisons: [],
      capabilities: [],
    };
    const fromPathOnly = extractGameplayIntentSignals([empty]);
    expect(fromPathOnly.signals).toEqual([]);
    expect(fromPathOnly.relations).toEqual([]);

    const observed = extractGameplayIntentSignals([{
      ...empty,
      localFunctionCalls: [{
        callerRegion: "function:runWave",
        targetRegion: "function:resetArena",
        targetName: "resetArena",
        source: { ...empty.source, range: {
          lineStart: 2, lineEnd: 2, columnStart: 5, columnEnd: 17,
        } },
      }],
    }]);
    // Parsed behavior may produce inferred Intent candidates. The path
    // remains a locator, never independent evidence of a gameplay phase.
    expect(observed.signals.some(item => item.subjectKey === "mechanic:wave"))
      .toBe(false);
    expect(observed.signals.some(item => item.subjectKey === "lifecycle:reset-arena"))
      .toBe(true);
    expect(observed.relations.some(item =>
      item.edgeKind === "requires" && item.status === "inferred"))
      .toBe(true);
  });

  it("downgrades minified bundled guard predicates to unknown", () => {
    const base = script();
    const own = { artifactId: "art_test",
      relativePath: "behavior_packs/demo/scripts/main.js" };
    const ret = { ...own, range: {
      lineStart: 6, lineEnd: 6, columnStart: 4, columnEnd: 24,
    } };
    const bundled: ParsedScriptFile = {
      ...base,
      identifier: "scripts/main",
      source: {
        artifactId: "art_test",
        relativePath:
          "behavior_packs/demo/scripts/main.js",
      },
      localFunctionCalls: [],
      lifecycleMemberExposures: [],
      enumValueComparisons: [],
      stateMutations: [],
      typeProperties: [],
      transitionDeclarations: [],
      commandLiterals: [],
      declaredMembers: [{
        member: "readRecovery",
        memberKind: "method",
        source: own,
      }],
      returnOutcomes: [{
        executionRegion: "function:readRecovery",
        propertyName: "status",
        value: "reading",
        source: ret,
      }],
      guardedOutcomes: [{
        executionRegion: "function:readRecovery",
        conditionText: "o.nextPage < o.header.pages",
        conditionIdentifiers: [
          "o",
          "o.nextPage",
          "o.header",
          "o.header.pages",
        ],
        predicate: {
          kind: "comparison",
          operator: "lt",
          left: {
            kind: "path",
            path: "o.nextPage",
          },
          right: {
            kind: "path",
            path: "o.header.pages",
          },
        },
        propertyName: "status",
        value: "reading",
        conditionSource: own,
        outcomeSource: ret,
      }],
    };

    const result =
      extractGameplayIntentSignals([bundled]);
    const policy = result.signals.find(
      (signal) =>
        signal.nodeKind === "policy" &&
        signal.subjectKey.includes("read-recovery"),
    );

    expect(policy?.policyPredicate).toEqual({
      kind: "unknown",
      text: "o.nextPage < o.header.pages",
    });
    expect(policy?.label).toBe(
      "Read Recovery Guarded Reading",
    );
  });

  it("preserves stable bundled guard predicates with named roots", () => {
    const base = script();
    const own = { artifactId: "art_test",
      relativePath: "behavior_packs/demo/scripts/main.js" };
    const ret = { ...own, range: {
      lineStart: 6, lineEnd: 6, columnStart: 4, columnEnd: 24,
    } };
    const bundled: ParsedScriptFile = {
      ...base,
      identifier: "scripts/main",
      source: {
        artifactId: "art_test",
        relativePath:
          "behavior_packs/demo/scripts/main.js",
      },
      localFunctionCalls: [],
      lifecycleMemberExposures: [],
      enumValueComparisons: [],
      stateMutations: [],
      typeProperties: [],
      transitionDeclarations: [],
      commandLiterals: [],
      declaredMembers: [{
        member: "decideReconnect",
        memberKind: "method",
        source: own,
      }],
      returnOutcomes: [{
        executionRegion: "function:decideReconnect",
        propertyName: "action",
        value: "resume",
        source: ret,
      }],
      guardedOutcomes: [{
        executionRegion: "function:decideReconnect",
        conditionText: 'session.phase === "active"',
        conditionIdentifiers: [
          "session",
          "session.phase",
        ],
        predicate: {
          kind: "comparison",
          operator: "eq",
          left: {
            kind: "path",
            path: "session.phase",
          },
          right: {
            kind: "literal",
            value: "active",
          },
        },
        propertyName: "action",
        value: "resume",
        conditionSource: own,
        outcomeSource: ret,
      }],
    };

    const result =
      extractGameplayIntentSignals([bundled]);
    const policy = result.signals.find(
      (signal) =>
        signal.nodeKind === "policy" &&
        signal.subjectKey.includes("decide-reconnect"),
    );

    expect(policy?.policyPredicate).toEqual({
      kind: "comparison",
      operator: "eq",
      left: {
        kind: "path",
        path: "session.phase",
      },
      right: {
        kind: "literal",
        value: "active",
      },
    });
  });

  it("treats phase-like declared properties as state or resource surfaces", () => {
    const base = script();
    const bundled: ParsedScriptFile = {
      ...base,
      identifier: "scripts/main",
      source: bundledModuleSource,
      localFunctionCalls: [],
      lifecycleMemberExposures: [],
      enumValueComparisons: [],
      stateMutations: [],
      typeProperties: [],
      transitionDeclarations: [],
      returnOutcomes: [],
      guardedOutcomes: [],
      commandLiterals: [],
      declaredMembers: [
        {
          member: "currentStageIndex",
          memberKind: "property",
          source: bundledModuleSource,
        },
        {
          member: "stageNames",
          memberKind: "property",
          source: bundledModuleSource,
        },
        {
          member: "countdownRunning",
          memberKind: "property",
          source: bundledModuleSource,
        },
        {
          member: "activeCinematics",
          memberKind: "property",
          source: bundledModuleSource,
        },
        {
          member: "startCountdown",
          memberKind: "method",
          source: bundledModuleSource,
        },
      ],
    };

    const result =
      extractGameplayIntentSignals([bundled]);
    const ids = new Set(
      result.signals.map((signal) => signal.subjectKey),
    );

    expect(ids.has("resource:current-stage-index")).toBe(true);
    expect(ids.has("resource:stage-names")).toBe(true);
    expect(ids.has("state:countdown-running")).toBe(true);
    expect(ids.has("state:active-cinematics")).toBe(true);
    expect(ids.has("phase:current-stage-index")).toBe(false);
    expect(ids.has("phase:stage-names")).toBe(false);
    expect(ids.has("phase:countdown-running")).toBe(false);
    expect(ids.has("phase:active-cinematics")).toBe(false);
  });

  it("avoids treating build-prefixed helper functions as gameplay phases", () => {
    const base = script();
    const helper = (
      relativePath: string,
      identifier: string,
    ): ParsedScriptFile => ({
      ...base,
      identifier,
      source: {
        artifactId: "art_test",
        relativePath,
      },
      localFunctionCalls: [],
      lifecycleMemberExposures: [],
      enumValueComparisons: [],
      stateMutations: [],
      typeProperties: [],
      transitionDeclarations: [],
      returnOutcomes: [],
      guardedOutcomes: [],
      commandLiterals: [],
      // Declared members belong to this exact module: filenames alone
      // are insufficient evidence for an intent candidate.
      declaredMembers: [{
        member: identifier.split("/").slice(-1)[0]!,
        memberKind: "method",
        source: { artifactId: "art_test", relativePath },
      }],
    });

    const result = extractGameplayIntentSignals([
      helper(
        "behavior_packs/demo/scripts/domain/buildInventory.js",
        "scripts/domain/buildInventory",
      ),
      helper(
        "behavior_packs/demo/scripts/domain/buildMutationPolicy.js",
        "scripts/domain/buildMutationPolicy",
      ),
      helper(
        "behavior_packs/demo/scripts/ui/buildHud.js",
        "scripts/ui/buildHud",
      ),
    ]);

    expect(
      result.signals.some(
        (signal) =>
          signal.subjectKey === "resource:build-inventory",
      ),
    ).toBe(true);
    expect(
      result.signals.some(
        (signal) =>
          signal.subjectKey === "policy:build-mutation-policy",
      ),
    ).toBe(true);
    expect(
      result.signals.some(
        (signal) =>
          signal.subjectKey === "mechanic:build-hud",
      ),
    ).toBe(true);
    expect(
      result.signals.some(
        (signal) =>
          signal.subjectKey.startsWith("phase:build-"),
      ),
    ).toBe(false);
  });

  it("classifies helper verbs by their specific gameplay noun instead of phase keywords", () => {
    const base = script();
    const helper = (
      relativePath: string,
      identifier: string,
    ): ParsedScriptFile => ({
      ...base,
      identifier,
      source: {
        artifactId: "art_test",
        relativePath,
      },
      localFunctionCalls: [],
      lifecycleMemberExposures: [],
      enumValueComparisons: [],
      stateMutations: [],
      typeProperties: [],
      transitionDeclarations: [],
      returnOutcomes: [],
      guardedOutcomes: [],
      commandLiterals: [],
      // Declared members belong to this exact module: filenames alone
      // are insufficient evidence for an intent candidate.
      declaredMembers: [{
        member: identifier.split("/").slice(-1)[0]!,
        memberKind: "method",
        source: { artifactId: "art_test", relativePath },
      }],
    });

    const result = extractGameplayIntentSignals([
      helper(
        "behavior_packs/demo/scripts/domain/calculateCombatQuality.js",
        "scripts/domain/calculateCombatQuality",
      ),
      helper(
        "behavior_packs/demo/scripts/domain/getFortifyWaveSize.js",
        "scripts/domain/getFortifyWaveSize",
      ),
      helper(
        "behavior_packs/demo/scripts/domain/getFortifyTierResources.js",
        "scripts/domain/getFortifyTierResources",
      ),
      helper(
        "behavior_packs/demo/scripts/domain/getCombatPhaseCountdownSeconds.js",
        "scripts/domain/getCombatPhaseCountdownSeconds",
      ),
    ]);

    expect(
      result.signals.some(
        (signal) =>
          signal.subjectKey ===
          "mechanic:calculate-combat-quality",
      ),
    ).toBe(true);
    expect(
      result.signals.some(
        (signal) =>
          signal.subjectKey ===
          "mechanic:get-fortify-wave-size",
      ),
    ).toBe(true);
    expect(
      result.signals.some(
        (signal) =>
          signal.subjectKey ===
          "resource:get-fortify-tier-resources",
      ),
    ).toBe(true);
    expect(
      result.signals.some(
        (signal) =>
          signal.subjectKey ===
          "resource:get-combat-phase-countdown-seconds",
      ),
    ).toBe(true);

    expect(
      result.signals.some(
        (signal) =>
          signal.subjectKey.startsWith("phase:calculate-") ||
          signal.subjectKey.startsWith("phase:get-fortify-") ||
          signal.subjectKey.startsWith("phase:get-combat-"),
      ),
    ).toBe(false);
  });

  it("recovers gameplay concepts from declared bundled class members", () => {
    const base = script();
    const bundled: ParsedScriptFile = {
      ...base,
      identifier: "scripts/main",
      source: bundledModuleSource,
      localFunctionCalls: [],
      lifecycleMemberExposures: [],
      enumValueComparisons: [],
      stateMutations: [],
      typeProperties: [],
      transitionDeclarations: [],
      returnOutcomes: [],
      guardedOutcomes: [],
      commandLiterals: [],
      declaredMembers: [
        {
          member: "phase",
          memberKind: "property",
          containerHint: "A",
          source: bundledModuleSource,
        },
        {
          member: "reconnect",
          memberKind: "method",
          containerHint: "A",
          source: bundledModuleSource,
        },
        {
          member: "disconnect",
          memberKind: "method",
          containerHint: "A",
          source: bundledModuleSource,
        },
        {
          member: "clearPlayerInventory",
          memberKind: "method",
          containerHint: "B",
          source: bundledModuleSource,
        },
        {
          member: "getNearbyReviver",
          memberKind: "method",
          containerHint: "C",
          source: bundledModuleSource,
        },
        {
          member: "initializeScoreboard",
          memberKind: "method",
          containerHint: "C",
          source: bundledModuleSource,
        },
      ],
    };

    const result = extractGameplayIntentSignals([bundled]);
    const ids = new Set(
      result.signals.map((signal) => signal.subjectKey),
    );

    expect(ids.has("state:phase")).toBe(true);
    expect(result.signals.filter(signal =>
      signal.subjectKey === "state:phase").every(signal =>
        signal.status === "hypothesis")).toBe(true);
    expect(ids.has("lifecycle:reconnect")).toBe(true);
    expect(ids.has("lifecycle:disconnect")).toBe(true);
    expect(ids.has("resource:clear-player-inventory")).toBe(true);
    expect(ids.has("mechanic:get-nearby-reviver")).toBe(true);
    expect(ids.has("resource:initialize-scoreboard")).toBe(true);
  });

  it("keeps phase classification for state-like names but not phase helper actions", () => {
    const base = script();
    const bundled: ParsedScriptFile = {
      ...base,
      identifier: "scripts/main",
      source: bundledModuleSource,
      localFunctionCalls: [],
      lifecycleMemberExposures: [],
      enumValueComparisons: [],
      stateMutations: [],
      typeProperties: [],
      transitionDeclarations: [],
      returnOutcomes: [],
      guardedOutcomes: [],
      commandLiterals: [],
      declaredMembers: [
        "active",
        "cinematic",
        "finishStage1",
        "startStageTimers",
        "updateStageTimers",
        "stopCountdown",
        "refreshLobbyEffects",
        "teleportLobby",
        "clearPlayerHudForLobbyReturn",
        "countdownFeedback",
      ].map((member) => ({
        member,
        memberKind: "method" as const,
        containerHint: "A",
        source: bundledModuleSource,
      })),
    };

    const result = extractGameplayIntentSignals([bundled]);

    const ids = new Set(
      result.signals.map((signal) => signal.subjectKey),
    );

    expect(ids.has("phase:active")).toBe(true);
    expect(ids.has("phase:cinematic")).toBe(true);

    expect(ids.has("phase:finish-stage1")).toBe(false);
    expect(ids.has("phase:start-stage-timers")).toBe(false);
    expect(ids.has("phase:update-stage-timers")).toBe(false);
    expect(ids.has("phase:stop-countdown")).toBe(false);
    expect(ids.has("phase:refresh-lobby-effects")).toBe(false);
    expect(ids.has("phase:teleport-lobby")).toBe(false);
    expect(ids.has("phase:clear-player-hud-for-lobby-return")).toBe(false);
    expect(ids.has("phase:countdown-feedback")).toBe(false);

    expect(ids.has("resource:start-stage-timers")).toBe(true);
    expect(ids.has("resource:update-stage-timers")).toBe(true);
    expect(ids.has("mechanic:refresh-lobby-effects")).toBe(true);
    expect(ids.has("spatial-region:teleport-lobby")).toBe(true);
    expect(ids.has("mechanic:clear-player-hud-for-lobby-return")).toBe(true);
    expect(ids.has("mechanic:countdown-feedback")).toBe(true);
  });

  it("recovers source-owned class behavior across modular chunks without foreign member promotion", () => {
    const base = script();
    const modular = (index: number): ParsedScriptFile => ({
      ...base,
      identifier: "scripts/chunks/chunk-" + index,
      source: {
        artifactId: "art_test",
        relativePath:
          "behavior_packs/demo/scripts/chunks/chunk-" +
          index +
          ".js",
      },
      localFunctionCalls: [],
      lifecycleMemberExposures: [],
      enumValueComparisons: [],
      stateMutations: [],
      typeProperties: [],
      transitionDeclarations: [],
      returnOutcomes: [],
      guardedOutcomes: [],
      commandLiterals: [],
      declaredMembers: [{
        member: "reconnect",
        memberKind: "method",
        containerHint: "A",
        source: {
          artifactId: "art_test",
          relativePath: "behavior_packs/demo/scripts/chunks/chunk-" + index + ".js",
          range: { lineStart: index, columnStart: 3,
            lineEnd: index, columnEnd: 25 },
        },
      }],
    });

    const result = extractGameplayIntentSignals([
      modular(1),
      modular(2),
      modular(3),
    ]);
    const candidates = result.signals.filter(signal =>
      signal.subjectKey.startsWith("lifecycle:reconnect:declaration:"));
    expect(candidates).toHaveLength(3);
    expect(new Set(candidates.map(signal => signal.subjectKey)).size).toBe(3);
    expect(candidates.every(signal => signal.status === "hypothesis")).toBe(true);

    // The exact member source, not its name or the project module count,
    // decides admission. A foreign declaration cannot create an Intent node.
    const foreign = extractGameplayIntentSignals([
      ...[modular(1), modular(2), modular(3)].map(script => ({
        ...script,
        declaredMembers: script.declaredMembers!.map(member => ({
          ...member, source: base.source,
        })),
      })),
    ]);
    expect(foreign.signals.some(signal =>
      signal.subjectKey.startsWith("lifecycle:reconnect"))).toBe(false);

    // Repeated same-file members with no precise declaration spans must not
    // be collapsed into a single fictional class/lifecycle owner.
    const ambiguous = modular(1);
    const noSpan = {
      ...ambiguous.declaredMembers![0]!,
      source: {
        artifactId: "art_test",
        relativePath: ambiguous.source.relativePath,
      },
    };
    const rejected = extractGameplayIntentSignals([{
      ...ambiguous, declaredMembers: [noSpan, { ...noSpan }],
    }]);
    expect(rejected.signals.some(signal =>
      signal.subjectKey.startsWith("lifecycle:reconnect"))).toBe(false);
  });

  it("models classified status returns as state values instead of gameplay outcomes", () => {
    const base = script();
    const own = { artifactId: "art_test",
      relativePath: "behavior_packs/demo/scripts/recovery.js" };
    const ret = { ...own, range: {
      lineStart: 6, lineEnd: 6, columnStart: 4, columnEnd: 24,
    } };
    const recovery: ParsedScriptFile = {
      ...base,
      identifier: "scripts/recovery",
      source: {
        artifactId: "art_test",
        relativePath:
          "behavior_packs/demo/scripts/recovery.js",
      },
      localFunctionCalls: [],
      lifecycleMemberExposures: [],
      enumValueComparisons: [],
      stateMutations: [],
      typeProperties: [],
      transitionDeclarations: [],
      commandLiterals: [],
      declaredMembers: [],
      returnOutcomes: [
        {
          executionRegion: "function:readRecovery",
          propertyName: "status",
          value: "ready",
          source: own,
        },
        {
          executionRegion: "function:readRecovery",
          propertyName: "status",
          value: "clean",
          source: ret,
        },
      ],
      guardedOutcomes: [{
        executionRegion: "function:readRecovery",
        conditionText: "record === undefined",
        conditionIdentifiers: ["record"],
        predicate: {
          kind: "comparison",
          operator: "eq",
          left: { kind: "path", path: "record" },
          right: { kind: "literal", value: null },
        },
        propertyName: "status",
        value: "clean",
        conditionSource: own,
        outcomeSource: ret,
      }],
    };

    const result = extractGameplayIntentSignals([recovery]);
    const ids = new Set(
      result.signals.map((signal) => signal.subjectKey),
    );

    expect(ids.has("state:read-recovery:ready")).toBe(true);
    expect(ids.has("state:read-recovery:clean")).toBe(true);
    expect(
      [...ids].some((id) =>
        id.startsWith("outcome:read-recovery-")
      ),
    ).toBe(false);

    expect(
      result.relations.some(
        (relation) =>
          relation.fromSubjectKey ===
            "state:read-recovery:clean" &&
          relation.edgeKind === "requires" &&
          relation.status === "authored",
      ),
    ).toBe(true);
  });

  it("ignores generic status discriminants outside classified gameplay functions", () => {
    const base = script();
    const internal: ParsedScriptFile = {
      ...base,
      identifier: "scripts/main",
      source: {
        artifactId: "art_test",
        relativePath:
          "behavior_packs/demo/scripts/main.js",
      },
      localFunctionCalls: [],
      lifecycleMemberExposures: [],
      enumValueComparisons: [],
      stateMutations: [],
      typeProperties: [],
      transitionDeclarations: [],
      commandLiterals: [],
      declaredMembers: [],
      returnOutcomes: [{
        executionRegion: "function:readPage",
        propertyName: "status",
        value: "ready",
        source: base.source,
      }],
      guardedOutcomes: [{
        executionRegion: "function:readPage",
        conditionText: "page.nextPage",
        conditionIdentifiers: ["page", "page.nextPage"],
        predicate: {
          kind: "truthy",
          operand: {
            kind: "path",
            path: "page.nextPage",
          },
        },
        propertyName: "status",
        value: "reading",
        conditionSource: base.source,
        outcomeSource: base.source,
      }],
    };

    const result = extractGameplayIntentSignals([internal]);

    expect(
      result.signals.some(
        (signal) =>
          signal.subjectKey === "outcome:read-page-ready" ||
          signal.subjectKey === "outcome:read-page-reading",
      ),
    ).toBe(false);
    expect(
      result.signals.some(
        (signal) => signal.nodeKind === "policy",
      ),
    ).toBe(false);
  });

  it("treats bare phase/state members as state surfaces and phase helper verbs as helpers", () => {
    const base = script();
    const bundled: ParsedScriptFile = {
      ...base,
      identifier: "scripts/main",
      source: bundledModuleSource,
      localFunctionCalls: [],
      lifecycleMemberExposures: [],
      enumValueComparisons: [],
      stateMutations: [],
      typeProperties: [],
      transitionDeclarations: [],
      returnOutcomes: [],
      guardedOutcomes: [],
      commandLiterals: [],
      declaredMembers: [
        "phase",
        "stage",
        "completeCurrentStage",
        "processCinematicGroup",
        "skipToStage",
        "prepareCinematicPlayers",
      ].map((member) => ({
        member,
        memberKind: "method" as const,
        containerHint: "A",
        source: bundledModuleSource,
      })),
    };

    const result = extractGameplayIntentSignals([bundled]);
    const ids = new Set(
      result.signals.map((signal) => signal.subjectKey),
    );

    expect(ids.has("state:phase")).toBe(true);
    expect(ids.has("state:stage")).toBe(true);
    expect(
      [...ids].some((id) =>
        id.startsWith("phase:complete-current-stage") ||
        id.startsWith("phase:process-cinematic-group") ||
        id.startsWith("phase:skip-to-stage") ||
        id.startsWith("phase:prepare-cinematic-players")
      ),
    ).toBe(false);
  });

  it("aggregates authored route points into typed spatial intent profiles", () => {
    const base = script();
    const routeSource = {
      artifactId: "art_test",
      relativePath:
        "behavior_packs/demo/scripts/main.js",
    };
    const routes: ParsedScriptFile = {
      ...base,
      identifier: "scripts/main",
      source: routeSource,
      localFunctionCalls: [],
      lifecycleMemberExposures: [],
      enumValueComparisons: [],
      stateMutations: [],
      typeProperties: [],
      transitionDeclarations: [],
      returnOutcomes: [],
      guardedOutcomes: [],
      commandLiterals: [],
      declaredMembers: [],
      spatialRoutePoints: [
        {
          routeId: "main",
          location: { x: 0, y: 64, z: 0 },
          index: 0,
          collectionHint: "routes",
          source: base.source,
        },
        {
          routeId: "main",
          location: { x: 10, y: 64, z: 0 },
          index: 1,
          collectionHint: "routes",
          source: base.source,
        },
        {
          routeId: "bridge",
          location: { x: 10, y: 64, z: 5 },
          index: 600,
          collectionHint: "routes",
          source: base.source,
        },
      ],
    };

    const result = extractGameplayIntentSignals([routes]);
    const main = result.signals.find(
      (signal) =>
        signal.subjectKey === "spatial-region:route-main",
    );
    const bridge = result.signals.find(
      (signal) =>
        signal.subjectKey ===
        "spatial-region:route-bridge",
    );

    expect(main).toEqual(expect.objectContaining({
      nodeKind: "spatial-region",
      status: "authored",
      spatialProfile: expect.objectContaining({
        coordinateSpace: "unknown",
        routeId: "main",
        collectionHint: "routes",
        points: [
          { x: 0, y: 64, z: 0, index: 0 },
          { x: 10, y: 64, z: 0, index: 1 },
        ],
        indexRanges: [{ min: 0, max: 1 }],
      }),
    }));
    expect(bridge?.spatialProfile?.points).toEqual([
      { x: 10, y: 64, z: 5, index: 600 },
    ]);
    expect(bridge?.spatialProfile?.indexRanges).toEqual([
      { min: 600, max: 600 },
    ]);
  });

  it("promotes route coordinate space to local only with proven offset transform use", () => {
    const base = script();
    const routeSource = {
      artifactId: "art_test",
      relativePath:
        "behavior_packs/demo/scripts/main.js",
    };
    const routes: ParsedScriptFile = {
      ...base,
      identifier: "scripts/main",
      source: routeSource,
      localFunctionCalls: [],
      lifecycleMemberExposures: [],
      enumValueComparisons: [],
      stateMutations: [],
      typeProperties: [],
      transitionDeclarations: [],
      returnOutcomes: [],
      guardedOutcomes: [],
      commandLiterals: [],
      declaredMembers: [],
      spatialRoutePoints: [{
        routeId: "main",
        location: { x: 1, y: 2, z: 3 },
        index: 0,
        collectionHint: "routes",
        source: routeSource,
      }],
      spatialOffsetTransforms: [{
        functionName: "applyOffset",
        pointParameter: "point",
        contextParameter: "arena",
        offsetPath: "gameplayOffset",
        source: routeSource,
      }],
      spatialTransformUses: [{
        functionName: "applyOffset",
        pointExpression: "definition.location",
        contextExpression: "arena",
        source: routeSource,
      }],
    };

    const result = extractGameplayIntentSignals([routes]);
    const route = result.signals.find(
      (signal) =>
        signal.subjectKey === "spatial-region:route-main",
    );

    expect(route?.spatialProfile).toEqual({
      coordinateSpace: "local",
      routeId: "main",
      collectionHint: "routes",
      points: [
        { x: 1, y: 2, z: 3, index: 0 },
      ],
      indexRanges: [{ min: 0, max: 0 }],
      transform: {
        kind: "offset",
        offsetPath: "gameplayOffset",
        functionName: "applyOffset",
      },
    });
  });

  it("keeps route coordinate space unknown when transform definition is unused", () => {
    const base = script();
    const routeSource = {
      artifactId: "art_test",
      relativePath:
        "behavior_packs/demo/scripts/main.js",
    };
    const routes: ParsedScriptFile = {
      ...base,
      identifier: "scripts/main",
      source: routeSource,
      localFunctionCalls: [],
      lifecycleMemberExposures: [],
      enumValueComparisons: [],
      stateMutations: [],
      typeProperties: [],
      transitionDeclarations: [],
      returnOutcomes: [],
      guardedOutcomes: [],
      commandLiterals: [],
      declaredMembers: [],
      spatialRoutePoints: [{
        routeId: "main",
        location: { x: 1, y: 2, z: 3 },
        index: 0,
        source: routeSource,
      }],
      spatialOffsetTransforms: [{
        functionName: "applyOffset",
        pointParameter: "point",
        contextParameter: "arena",
        offsetPath: "gameplayOffset",
        source: routeSource,
      }],
      spatialTransformUses: [],
    };

    const result = extractGameplayIntentSignals([routes]);
    expect(
      result.signals.find(
        (signal) =>
          signal.subjectKey === "spatial-region:route-main",
      )?.spatialProfile?.coordinateSpace,
    ).toBe("unknown");
  });

  it("attaches compatible context offset series to local route profiles", () => {
    const base = script();
    const routeSource = {
      artifactId: "art_test",
      relativePath:
        "behavior_packs/demo/scripts/main.js",
    };
    const routes: ParsedScriptFile = {
      ...base,
      identifier: "scripts/main",
      source: routeSource,
      localFunctionCalls: [],
      lifecycleMemberExposures: [],
      enumValueComparisons: [],
      stateMutations: [],
      typeProperties: [],
      transitionDeclarations: [],
      returnOutcomes: [],
      guardedOutcomes: [],
      commandLiterals: [],
      declaredMembers: [],
      spatialRoutePoints: [{
        routeId: "main",
        location: { x: -17.5, y: -28.5, z: -110.5 },
        index: 0,
        collectionHint: "routes",
        source: routeSource,
      }],
      spatialOffsetTransforms: [{
        functionName: "applyOffset",
        pointParameter: "point",
        contextParameter: "arena",
        offsetPath: "gameplayOffset",
        source: routeSource,
      }],
      spatialTransformUses: [{
        functionName: "applyOffset",
        pointExpression: "definition.location",
        contextExpression: "arena",
        source: routeSource,
      }],
      spatialContextOffsetSeries: [{
        collectionName: "arenas",
        sourceCollectionName: "joins",
        contextCount: 6,
        offsetPath: "gameplayOffset",
        offsetBase: { x: 0, y: 0, z: 0 },
        offsetStride: { x: 351, y: 0, z: 0 },
        contextIdPrefix: "arena_",
        contextIdIndexBase: 1,
        source: routeSource,
      }],
    };

    const result = extractGameplayIntentSignals([routes]);
    const profile = result.signals.find(
      (signal) =>
        signal.subjectKey === "spatial-region:route-main",
    )?.spatialProfile;

    expect(profile?.contextSeries).toEqual({
      collectionName: "arenas",
      contextCount: 6,
      offsetPath: "gameplayOffset",
      offsetBase: { x: 0, y: 0, z: 0 },
      offsetStride: { x: 351, y: 0, z: 0 },
      contextIdPrefix: "arena_",
      contextIdIndexBase: 1,
    });
  });

  it("classifies generic bedwars gameplay vocabulary from bundled members", () => {
    const base = script();
    const bundled: ParsedScriptFile = {
      ...base,
      identifier: "scripts/main",
      source: bundledModuleSource,
      localFunctionCalls: [],
      lifecycleMemberExposures: [],
      enumValueComparisons: [],
      stateMutations: [],
      typeProperties: [],
      transitionDeclarations: [],
      returnOutcomes: [],
      guardedOutcomes: [],
      commandLiterals: [],
      declaredMembers: [
        "team",
        "spectator",
        "breakBed",
        "winner",
        "eliminated",
        "diamondGenerators",
        "shop",
        "armor",
        "wool",
        "respawnTimers",
      ].map((member) => ({
        member,
        memberKind: "method" as const,
        containerHint: "A",
        source: bundledModuleSource,
      })),
    };

    const result = extractGameplayIntentSignals([bundled]);
    const ids = new Set(
      result.signals.map((signal) => signal.subjectKey),
    );

    expect(ids.has("role:team")).toBe(true);
    expect(ids.has("role:spectator")).toBe(true);
    expect(ids.has("objective:break-bed")).toBe(true);
    expect(ids.has("objective:winner")).toBe(true);
    expect(ids.has("objective:eliminated")).toBe(true);
    expect(ids.has("mechanic:diamond-generators")).toBe(true);
    expect(ids.has("mechanic:shop")).toBe(true);
    expect(ids.has("resource:armor")).toBe(true);
    expect(ids.has("resource:wool")).toBe(true);
    expect(ids.has("lifecycle:respawn-timers")).toBe(true);
  });

  it("suppresses countdown and finish helper actions while retaining parkour mechanics", () => {
    const base = script();
    const bundled: ParsedScriptFile = {
      ...base,
      identifier: "scripts/main",
      source: bundledModuleSource,
      localFunctionCalls: [],
      lifecycleMemberExposures: [],
      enumValueComparisons: [],
      stateMutations: [],
      typeProperties: [],
      transitionDeclarations: [],
      returnOutcomes: [],
      guardedOutcomes: [],
      commandLiterals: [],
      declaredMembers: [
        "addCountdownActionBars",
        "cancelCountdown",
        "hideParkourSelectorAtFinish",
        "showParkourSelectorAtFinish",
      ].map((member) => ({
        member,
        memberKind: "method" as const,
        containerHint: "A",
        source: bundledModuleSource,
      })),
    };

    const result = extractGameplayIntentSignals([bundled]);
    const ids = new Set(
      result.signals.map((signal) => signal.subjectKey),
    );

    expect(ids.has("phase:add-countdown-action-bars")).toBe(false);
    expect(ids.has("phase:cancel-countdown")).toBe(false);
    expect(ids.has("mechanic:hide-parkour-selector-at-finish"))
      .toBe(true);
    expect(ids.has("mechanic:show-parkour-selector-at-finish"))
      .toBe(true);
  });

  it("ignores structural helper return discriminants while preserving lifecycle decisions", () => {
    const base = script();
    const own = { artifactId: "art_test",
      relativePath: "behavior_packs/demo/scripts/domain/helpers.js" };
    const sample: ParsedScriptFile = {
      ...base,
      identifier: "scripts/domain/helpers",
      source: {
        artifactId: "art_test",
        relativePath:
          "behavior_packs/demo/scripts/domain/helpers.js",
      },
      localFunctionCalls: [],
      lifecycleMemberExposures: [],
      enumValueComparisons: [],
      stateMutations: [],
      typeProperties: [],
      transitionDeclarations: [],
      commandLiterals: [],
      declaredMembers: [],
      returnOutcomes: [
        {
          executionRegion:
            "function:createKitTrialPerformance",
          propertyName: "outcome",
          value: "pending",
          source: own,
        },
        {
          executionRegion:
            "function:resolveInventoryTarget",
          propertyName: "kind",
          value: "inventory",
          source: own,
        },
        {
          executionRegion:
            "function:decideReconnect",
          propertyName: "kind",
          value: "cleanup_to_lobby",
          source: own,
        },
      ],
      guardedOutcomes: [],
    };

    const result = extractGameplayIntentSignals([sample]);
    const ids = new Set(
      result.signals.map((signal) => signal.subjectKey),
    );

    expect(
      ids.has(
        "outcome:create-kit-trial-performance-pending",
      ),
    ).toBe(false);
    expect(
      ids.has(
        "outcome:resolve-inventory-target-inventory",
      ),
    ).toBe(false);
    expect(
      ids.has(
        "outcome:decide-reconnect-cleanup-to-lobby",
      ),
    ).toBe(true);
  });

  it("accepts kind/type return discriminants only for classified gameplay functions", () => {
    const base = script();
    const own = { artifactId: "art_test",
      relativePath: "behavior_packs/demo/scripts/domain/reconnect.js" };
    const ret = { ...own, range: {
      lineStart: 6, lineEnd: 6, columnStart: 4, columnEnd: 24,
    } };
    const reconnect: ParsedScriptFile = {
      ...base,
      identifier: "scripts/domain/reconnect",
      source: {
        artifactId: "art_test",
        relativePath:
          "behavior_packs/demo/scripts/domain/reconnect.js",
      },
      localFunctionCalls: [],
      lifecycleMemberExposures: [],
      enumValueComparisons: [],
      stateMutations: [],
      typeProperties: [],
      transitionDeclarations: [],
      commandLiterals: [],
      returnOutcomes: [
        {
          executionRegion: "function:decideReconnect",
          propertyName: "kind",
          value: "cleanup_to_lobby",
          source: ret,
        },
        {
          executionRegion: "function:helper",
          propertyName: "kind",
          value: "internal",
          source: own,
        },
      ],
      guardedOutcomes: [{
        executionRegion: "function:decideReconnect",
        conditionText: "membership === undefined",
        conditionIdentifiers: ["membership"],
        predicate: {
          kind: "comparison",
          operator: "eq",
          left: { kind: "path", path: "membership" },
          right: { kind: "literal", value: null },
        },
        propertyName: "kind",
        value: "cleanup_to_lobby",
        conditionSource: own,
        outcomeSource: ret,
      }],
    };

    const result = extractGameplayIntentSignals([reconnect]);

    expect(
      result.signals.some(
        (signal) =>
          signal.subjectKey ===
          "outcome:decide-reconnect-cleanup-to-lobby",
      ),
    ).toBe(true);
    expect(
      result.signals.some(
        (signal) =>
          signal.subjectKey === "outcome:helper-internal",
      ),
    ).toBe(false);
  });

  it("extracts authored and inferred intent signals without map-specific names", () => {
    const result = extractGameplayIntentSignals([script()]);

    expect(
      result.signals.some(
        (signal) =>
          signal.subjectKey ===
          "state:session-state-active" &&
          signal.status === "authored",
      ),
    ).toBe(true);

    expect(
      result.signals.some(
        (signal) =>
          signal.nodeKind === "lifecycle" &&
          signal.status === "authored",
      ),
    ).toBe(true);

    expect(
      result.signals.some(
        (signal) =>
          signal.subjectKey === "resource:coins",
      ),
    ).toBe(true);

    expect(
      result.relations.some(
        (relation) =>
          relation.edgeKind === "transitions-to" &&
          relation.toSubjectKey ===
            "state:session-state-active",
      ),
    ).toBe(true);

    expect(
      result.relations.some(
        (relation) =>
          relation.edgeKind === "owns" &&
          relation.status === "authored",
      ),
    ).toBe(true);

    expect(
      result.relations.some(
        (relation) =>
          relation.edgeKind === "transitions-to" &&
          relation.status === "authored" &&
          relation.fromSubjectKey ===
            "state:session-phase-active" &&
          relation.toSubjectKey ===
            "state:session-phase-finishing",
      ),
    ).toBe(true);

    expect(
      result.signals.some(
        (signal) =>
          signal.nodeKind === "outcome" &&
          signal.subjectKey ===
            "outcome:decide-reconnect-cleanup",
      ),
    ).toBe(true);

    expect(
      result.signals.some(
        (signal) =>
          signal.nodeKind === "policy" &&
          signal.subjectKey.includes("pending-cleanup") &&
          signal.policyPredicate?.kind === "truthy",
      ),
    ).toBe(true);

    expect(
      result.relations.some(
        (relation) =>
          relation.edgeKind === "requires" &&
          relation.status === "authored" &&
          relation.fromSubjectKey ===
            "outcome:decide-reconnect-cleanup" &&
          relation.toSubjectKey.startsWith("policy:"),
      ),
    ).toBe(true);

    expect(
      result.outcomePolicyCoverage.find(
        (item) =>
          item.outcomeSubjectKey ===
          "outcome:decide-reconnect-cleanup",
      ),
    ).toEqual(expect.objectContaining({
      totalLiteralReturnSites: 1,
      directlyGuardedReturnSites: 1,
      completeDirectGuardCoverage: true,
    }));

    expect(
      result.outcomePolicyCoverage.find(
        (item) =>
          item.outcomeSubjectKey ===
          "outcome:decide-reconnect-lobby",
      ),
    ).toEqual(expect.objectContaining({
      totalLiteralReturnSites: 1,
      directlyGuardedReturnSites: 0,
      completeDirectGuardCoverage: false,
    }));
  });
});


describe("source-owned gameplay interpretation across modules", () => {
  const makeScript = (relativePath: string): ParsedScriptFile => {
    const authoredSource = {
      artifactId: "art:two-mode-example",
      relativePath,
    };
    return {
      ...script(),
      identifier: relativePath,
      source: authoredSource,
      localFunctionCalls: [{
        callerRegion: "function:startWave",
        targetRegion: "function:resetArena",
        targetName: "resetArena",
        source: authoredSource,
      }],
      lifecycleMemberExposures: [],
      enumValueComparisons: [],
      typeProperties: [],
      transitionDeclarations: [],
      events: [],
      deferredCallbacks: [],
      commandLiterals: [],
      stateMutations: [{
        target: "session.state",
        targetName: "state",
        value: {
          kind: "member" as const,
          owner: "SessionState",
          member: "Active",
          symbol: "SessionState.Active",
        },
        executionRegion: "function:resetArena",
        source: authoredSource,
      }],
      returnOutcomes: [{
        executionRegion: "function:resetArena",
        propertyName: "action",
        value: "finish",
        source: { ...authoredSource, range: {
          lineStart: 9, lineEnd: 9, columnStart: 4, columnEnd: 29,
        } },
      }],
      guardedOutcomes: [{
        executionRegion: "function:resetArena",
        propertyName: "action",
        value: "finish",
        conditionText: "session.enabled",
        conditionIdentifiers: ["session", "session.enabled"],
        predicate: {
          kind: "truthy",
          operand: { kind: "path", path: "session.enabled" },
        },
        conditionSource: authoredSource,
        outcomeSource: { ...authoredSource, range: {
          lineStart: 9, lineEnd: 9, columnStart: 4, columnEnd: 29,
        } },
      }],
    };
  };

  it("keeps duplicate function, state and outcome names in their actual source owners", () => {
    const paths = [
      "behavior_packs/demo/scripts/mode-a.js",
      "behavior_packs/demo/scripts/mode-b.js",
    ];
    const result = extractGameplayIntentSignals(paths.map(makeScript));
    for (const path of paths) {
      const ownerBase = ":site:" + encodeURIComponent(path) + ":";
      const startId = "mechanic:start-wave" +
        ownerBase + encodeURIComponent("function:startWave");
      const resetSite = ownerBase + encodeURIComponent("function:resetArena");
      const resetId = "lifecycle:reset-arena" + resetSite;
      const stateId = "state:session-state-active:memory:" +
        encodeURIComponent(path) + ":" + encodeURIComponent("session.state");
      const outcomeId = "outcome:reset-arena-finish" + resetSite;
      const policyId = "policy:reset-arena-session-enabled" + resetSite;
      for (const id of [startId, resetId, stateId, outcomeId, policyId]) {
        expect(result.signals.some(signal =>
          signal.subjectKey === id && signal.locator === path)).toBe(true);
      }
      expect(result.relations.some(relation =>
        relation.edgeKind === "requires" &&
        relation.fromSubjectKey === startId &&
        relation.toSubjectKey === resetId)).toBe(true);
      expect(result.relations.some(relation =>
        relation.edgeKind === "transitions-to" &&
        relation.fromSubjectKey === resetId &&
        relation.toSubjectKey === stateId)).toBe(true);
      expect(result.relations.some(relation =>
        relation.edgeKind === "produces" &&
        relation.fromSubjectKey === resetId &&
        relation.toSubjectKey === outcomeId)).toBe(true);
      expect(result.relations.some(relation =>
        relation.edgeKind === "requires" &&
        relation.fromSubjectKey === outcomeId &&
        relation.toSubjectKey === policyId)).toBe(true);
    }
    expect(result.signals.filter(item =>
      item.subjectKey.startsWith("lifecycle:reset-arena:site:"))).toHaveLength(2);
    expect(result.signals.some(item =>
      item.subjectKey === "lifecycle:reset-arena")).toBe(false);
    const moduleKeys = paths.map(path =>
      ":site:" + encodeURIComponent(path) + ":");
    expect(result.relations.every(relation => {
      const fromOwner = moduleKeys.find(key =>
        relation.fromSubjectKey.includes(key));
      const toOwner = moduleKeys.find(key =>
        relation.toSubjectKey.includes(key));
      return fromOwner === undefined ||
        toOwner === undefined || fromOwner === toOwner;
    })).toBe(true);
    const outcomes = result.outcomePolicyCoverage.filter(item =>
      item.outcomeSubjectKey.startsWith("outcome:reset-arena-finish:site:"));
    expect(outcomes).toHaveLength(2);
    expect(outcomes.every(item => item.completeDirectGuardCoverage))
      .toBe(true);
  });

  it("preserves unambiguous names and resolves imported export aliases to actual functions", () => {
    const entry = "behavior_packs/demo/scripts/entry.js";
    const owner = "behavior_packs/demo/scripts/actions.js";
    const artifactId = "art:source-identity";
    const imported = extractGameplayIntentSignals([
      { ...makeScript(entry), source: { artifactId, relativePath: entry },
        localFunctionCalls: [], stateMutations: [], returnOutcomes: [] },
      { ...makeScript(owner), source: { artifactId, relativePath: owner },
        localFunctionCalls: [], stateMutations: [], returnOutcomes: [] },
    ], [{
      callerModule: entry,
      callerRegion: "function:resetArena",
      targetModule: owner,
      targetExport: "waveAlias",
      targetRegion: "function:prepareWave",
      localName: "waveAlias",
      controlFlow: "unconditional",
      status: "resolved",
      source: { artifactId, relativePath: entry },
    }]);
    const importedRelation = imported.relations.find(relation =>
      relation.crossFileCallOrigins?.length);
    expect(importedRelation).toBeDefined();
    expect(importedRelation?.fromSubjectKey).toBe("lifecycle:reset-arena");
    expect(importedRelation?.toSubjectKey).toBe("mechanic:prepare-wave");
    expect(imported.signals.some(item =>
      item.subjectKey === "mechanic:wave-alias")).toBe(false);
    expect(imported.signals.some(item =>
      item.subjectKey === "mechanic:prepare-wave")).toBe(true);
    // An unresolved import must never create a function-to-function
    // gameplay dependency, even if its names happen to be descriptive.
    const unresolved = extractGameplayIntentSignals([
      { ...makeScript(entry), source: { artifactId, relativePath: entry },
        localFunctionCalls: [], stateMutations: [], returnOutcomes: [] },
      { ...makeScript(owner), source: { artifactId, relativePath: owner },
        localFunctionCalls: [], stateMutations: [], returnOutcomes: [] },
    ], [{
      callerModule: entry, callerRegion: "function:resetArena",
      targetModule: owner, targetExport: "waveAlias",
      targetRegion: "function:prepareWave", localName: "waveAlias",
      controlFlow: "unconditional", status: "unresolved",
      source: { artifactId, relativePath: entry },
    }]);
    expect(unresolved.relations.some(relation =>
      relation.crossFileCallOrigins?.length)).toBe(false);
  });

  it("does not merge different declared names that normalize to the same lexical key", () => {
    const path = "behavior_packs/demo/scripts/round.js";
    const sample = makeScript(path);
    const mutation = sample.stateMutations![0]!;
    const outcome = sample.returnOutcomes![0]!;
    const enriched: ParsedScriptFile = {
      ...sample,
      localFunctionCalls: [
        ...sample.localFunctionCalls,
        {
          callerRegion: "function:start_wave",
          targetRegion: "function:reset_arena",
          targetName: "reset_arena",
          source: sample.source,
        },
      ],
      stateMutations: [
        mutation,
        { ...mutation, executionRegion: "function:reset_arena" },
      ],
      returnOutcomes: [
        outcome,
        { ...outcome, executionRegion: "function:reset_arena" },
      ],
    };
    const result = extractGameplayIntentSignals([enriched]);
    const ownerBase = ":site:" + encodeURIComponent(path) + ":";
    const begin = [
      "mechanic:start-wave" + ownerBase +
        encodeURIComponent("function:startWave"),
      "mechanic:start-wave" + ownerBase +
        encodeURIComponent("function:start_wave"),
    ];
    const reset = [
      "lifecycle:reset-arena" + ownerBase +
        encodeURIComponent("function:resetArena"),
      "lifecycle:reset-arena" + ownerBase +
        encodeURIComponent("function:reset_arena"),
    ];
    for (const id of [...begin, ...reset]) {
      expect(result.signals.some(signal => signal.subjectKey === id))
        .toBe(true);
    }
    expect(result.relations.some(rel =>
      rel.fromSubjectKey === begin[0] && rel.toSubjectKey === reset[0]))
      .toBe(true);
    expect(result.relations.some(rel =>
      rel.fromSubjectKey === begin[1] && rel.toSubjectKey === reset[1]))
      .toBe(true);
    expect(result.relations.some(rel =>
      rel.fromSubjectKey === begin[0] && rel.toSubjectKey === reset[1]))
      .toBe(false);
  });



  it("separates identical state labels written to distinct source-memory targets", () => {
    const paths = [
      "behavior_packs/demo/scripts/alpha.js",
      "behavior_packs/demo/scripts/beta.js",
    ];
    const first = makeScript(paths[0]!);
    const second = makeScript(paths[1]!);
    const crossModule = extractGameplayIntentSignals([
      first,
      {
        ...second,
        localFunctionCalls: [],
        stateMutations: second.stateMutations!.map(item => ({
          ...item, executionRegion: "function:decideReconnect",
        })),
      },
    ]);
    const stateKeys = paths.map(path =>
      "state:session-state-active:memory:" +
        encodeURIComponent(path) + ":" + encodeURIComponent("session.state"));
    for (const key of stateKeys) {
      const signal = crossModule.signals.find(item => item.subjectKey === key);
      expect(signal?.status).toBe("authored");
      expect(signal?.sourceStateCollisionBaseKey).toBe("state:session-state-active");
      expect(signal?.stateMutationOrigins).toHaveLength(1);
    }
    expect(crossModule.signals.some(item =>
      item.subjectKey === "state:session-state-active")).toBe(false);
    expect(crossModule.relations.some(edge =>
      edge.toSubjectKey === stateKeys[0])).toBe(true);
    expect(crossModule.relations.some(edge =>
      edge.toSubjectKey === stateKeys[1])).toBe(true);

    // A mutation to a different target in the SAME source also has a
    // different canonical script-memory surface even with the same label.
    const ownTarget = first.stateMutations![0]!;
    const sameModule = extractGameplayIntentSignals([{
      ...first,
      stateMutations: [
        ownTarget,
        { ...ownTarget, target: "player.state" },
      ],
    }]);
    const localKeys = ["session.state", "player.state"].map(target =>
      "state:session-state-active:memory:" +
        encodeURIComponent(paths[0]!) + ":" + encodeURIComponent(target));
    expect(localKeys.every(key => sameModule.signals.some(signal =>
      signal.subjectKey === key &&
      signal.sourceStateCollisionBaseKey === "state:session-state-active")))
      .toBe(true);
  });

  it("keeps one actual source-memory target shared between source functions and preserves global scoreboard resources", () => {
    const path = "behavior_packs/demo/scripts/round.js";
    const one = makeScript(path);
    const original = one.stateMutations![0]!;
    const sameTarget = extractGameplayIntentSignals([{
      ...one,
      stateMutations: [
        original,
        { ...original, executionRegion: "function:decideReconnect" },
      ],
    }]);
    const state = sameTarget.signals.find(item =>
      item.subjectKey === "state:session-state-active");
    expect(state?.stateMutationOrigins).toHaveLength(2);
    expect(state?.sourceStateCollisionBaseKey).toBeUndefined();
    expect(sameTarget.signals.some(item =>
      item.subjectKey.startsWith("state:session-state-active:memory:")))
      .toBe(false);

    // A scoreboard objective is a global technical resource in Semantic IR,
    // not a per-module script-memory target. Do not scope it on the basis
    // of unrelated source modules.
    const a = makeScript("behavior_packs/demo/scripts/a.js");
    const b = makeScript("behavior_packs/demo/scripts/b.js");
    const commands = [a, b].map(item => ({
      ...item,
      stateMutations: [],
      commandLiterals: [{
        command: "scoreboard players add @s coins 1",
        source: item.source,
      }],
    }));
    const scoreboard = extractGameplayIntentSignals(commands);
    expect(scoreboard.signals.filter(item =>
      item.subjectKey === "resource:coins")).toHaveLength(1);

    const foreign = extractGameplayIntentSignals([{
      ...one,
      stateMutations: [{
        ...original, source: { ...one.source, artifactId: "another-artifact" },
      }],
    }]);
    expect(foreign.signals.some(item =>
      item.stateMutationOrigins?.length)).toBe(false);
  });

  it("does not let a typed transition table in one source suppress another source's transitions", () => {
    const sourceA = makeScript("behavior_packs/demo/scripts/phase-a.js");
    const sourceB = makeScript("behavior_packs/demo/scripts/phase-b.js");
    const shared = { tableName: "TRANSITIONS", from: "active",
      to: ["finished"] };
    const a: ParsedScriptFile = {
      ...sourceA,
      localFunctionCalls: [], stateMutations: [], returnOutcomes: [],
      guardedOutcomes: [],
      transitionDeclarations: [
        { ...shared, stateType: "SessionPhase", source: sourceA.source },
        { ...shared, source: sourceA.source },
      ],
    };
    const b: ParsedScriptFile = {
      ...sourceB,
      localFunctionCalls: [], stateMutations: [], returnOutcomes: [],
      guardedOutcomes: [],
      transitionDeclarations: [
        { ...shared, source: sourceB.source },
      ],
    };
    const result = extractGameplayIntentSignals([a, b]);
    const scope = (path: string) =>
      ":site:" + encodeURIComponent(path) + ":" +
        encodeURIComponent("table:TRANSITIONS");
    const typedA = "state:session-phase-active" + scope(a.source.relativePath);
    const typedAFinish = "state:session-phase-finished" +
      scope(a.source.relativePath);
    const untypedB = "state:transitions-active" +
      scope(b.source.relativePath);
    const untypedBFinish = "state:transitions-finished" +
      scope(b.source.relativePath);
    expect(result.signals.some(item => item.subjectKey === typedA)).toBe(true);
    expect(result.signals.some(item => item.subjectKey === untypedB)).toBe(true);
    expect(result.relations.some(edge =>
      edge.fromSubjectKey === typedA &&
      edge.toSubjectKey === typedAFinish &&
      edge.status === "authored")).toBe(true);
    expect(result.relations.some(edge =>
      edge.fromSubjectKey === untypedB &&
      edge.toSubjectKey === untypedBFinish &&
      edge.status === "authored")).toBe(true);
    // Duplicate untyped declaration in the SAME module is still suppressed.
    expect(result.signals.some(item =>
      item.subjectKey === "state:transitions-active" +
        scope(a.source.relativePath))).toBe(false);
    expect(result.relations.every(edge =>
      !(edge.fromSubjectKey.includes(scope(a.source.relativePath)) &&
        edge.toSubjectKey.includes(scope(b.source.relativePath))))).toBe(true);
  });



  it("does not equate one unmatched guard with an equal-count authored return", () => {
    const file = makeScript("behavior_packs/demo/scripts/decision.js");
    const returnSite = file.returnOutcomes![0]!.source;
    const notTheReturnSite = {
      ...returnSite, range: {
        lineStart: 19, lineEnd: 19, columnStart: 4, columnEnd: 24,
      },
    };
    const result = extractGameplayIntentSignals([{
      ...file,
      guardedOutcomes: file.guardedOutcomes!.map(item => ({
        ...item, outcomeSource: notTheReturnSite,
      })),
    }]);
    const key = "outcome:reset-arena-finish";
    expect(result.signals.some(item => item.subjectKey === key)).toBe(true);
    expect(result.relations.some(item =>
      item.fromSubjectKey === key && item.edgeKind === "requires"))
      .toBe(false);
    expect(result.outcomePolicyCoverage.find(item =>
      item.outcomeSubjectKey === key)).toEqual({
        outcomeSubjectKey: key,
        totalLiteralReturnSites: 1,
        directlyGuardedReturnSites: 0,
        completeDirectGuardCoverage: false,
      });
  });

  it("deduplicates matched guard observations without treating a partially guarded outcome as complete", () => {
    const file = makeScript("behavior_packs/demo/scripts/decision.js");
    const guard = file.guardedOutcomes![0]!;
    const duplicated = extractGameplayIntentSignals([{
      ...file, guardedOutcomes: [guard, { ...guard }],
    }]);
    const key = "outcome:reset-arena-finish";
    expect(duplicated.outcomePolicyCoverage.find(item =>
      item.outcomeSubjectKey === key)).toEqual({
        outcomeSubjectKey: key,
        totalLiteralReturnSites: 1,
        directlyGuardedReturnSites: 1,
        completeDirectGuardCoverage: true,
      });

    const otherSite = {
      ...file.returnOutcomes![0]!,
      source: { ...file.source, range: {
        lineStart: 20, lineEnd: 20, columnStart: 4, columnEnd: 24,
      } },
    };
    const partial = extractGameplayIntentSignals([{
      ...file, returnOutcomes: [...file.returnOutcomes!, otherSite],
    }]);
    expect(partial.outcomePolicyCoverage.find(item =>
      item.outcomeSubjectKey === key)).toEqual({
        outcomeSubjectKey: key,
        totalLiteralReturnSites: 2,
        directlyGuardedReturnSites: 1,
        completeDirectGuardCoverage: false,
      });
  });

  it("rejects foreign return sites and does not turn module-level technical returns into game outcomes", () => {
    const file = makeScript("behavior_packs/demo/scripts/decision.js");
    const foreign = extractGameplayIntentSignals([{
      ...file,
      returnOutcomes: file.returnOutcomes!.map(item => ({
        ...item,
        source: { ...item.source, artifactId: "foreign-map-version" },
      })),
    }]);
    expect(foreign.signals.some(item =>
      item.subjectKey === "outcome:reset-arena-finish")).toBe(false);
    expect(foreign.relations.some(item =>
      item.toSubjectKey === "outcome:reset-arena-finish")).toBe(false);
    expect(foreign.outcomePolicyCoverage).toEqual([]);

    const moduleOnly = extractGameplayIntentSignals([{
      ...file, localFunctionCalls: [], stateMutations: [],
      returnOutcomes: [{
        executionRegion: "module", propertyName: "action", value: "complete",
        source: { ...file.source, range: {
          lineStart: 2, lineEnd: 2, columnStart: 1, columnEnd: 25,
        } },
      }],
      guardedOutcomes: [],
    }]);
    expect(moduleOnly.signals.some(item =>
      item.nodeKind === "outcome" || item.nodeKind === "policy"))
      .toBe(false);
    expect(moduleOnly.outcomePolicyCoverage).toEqual([]);
  });


});
