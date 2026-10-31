import { describe, expect, it } from "vitest";
import { parseMcFunction } from "../../../../analyzers/functions/src/index.js";
import { parseScriptFile } from "../../../../analyzers/scripts/src/index.js";
import { deriveReliabilityFingerprint } from "../../src/reliability/reliability-fingerprint.js";

describe("automatic reliability fingerprint", () => {
  it("derives capability and risk tags only from observed facts", () => {
    const fn = parseMcFunction(
      "main",
      [
        "execute as @a run fill 0 0 0 1 1 1 stone",
        "structure load demo:room 0 0 0",
        "scoreboard players set @a active 1",
      ].join("\n"),
      {
        artifactId: "art",
        relativePath: "behavior_packs/demo/functions/main.mcfunction",
      },
    );

    const script = parseScriptFile(
      "scripts/main",
      [
        'import { world } from "@minecraft/server";',
        'world.afterEvents.playerSpawn.subscribe((event) => {',
        '  event.player.setDynamicProperty("joined", true);',
        '});',
      ].join("\n"),
      {
        artifactId: "art",
        relativePath: "behavior_packs/demo/scripts/main.js",
      },
    );

    const result = deriveReliabilityFingerprint({
      mapId: "art",
      artifactFingerprint: "sha",
      packs: [{
        root: "behavior_packs/demo",
        type: "behavior",
        minEngineVersion: "1.21.0",
        educationMetadata: false,
        scriptModules: [{
          moduleName: "@minecraft/server",
          version: "2.0.0-beta",
          track: "beta",
        }],
      }],
      functions: [fn],
      scripts: [script],
      structures: 1,
      parsedStructures: 1,
      entities: 0,
      entityKnowledgeGaps: 0,
      worldDatabasePresent: true,
      stateAccesses: 1,
      broadStateWrites: 1,
      repeatedTopologyCandidates: 1,
      diagnostics: [],
      target: {
        edition: "bedrock",
        experiments: ["Beta APIs"],
      },
    });

    expect(result.fingerprint.commandVerbs).toEqual(expect.arrayContaining([
      "execute",
      "scoreboard",
      "structure",
    ]));
    expect(result.fingerprint.capabilityTags).toEqual(expect.arrayContaining([
      "script-module:@minecraft/server",
      "structure-load",
      "gameplay-state",
      "dynamic-properties",
      "script-events",
      "world-db",
    ]));
    expect(result.fingerprint.riskSurfaces).toEqual(expect.arrayContaining([
      "script-beta",
      "multiplayer-concurrency",
      "repeated-topology",
      "world-db-native",
    ]));

    expect(result.fingerprint.riskSurfaces).not.toContain("entity-ai");
    expect(result.fingerprint.riskSurfaces).not.toContain("chunk-lifecycle");
  });
  it("captures causal evidence quality in fingerprint tags", () => {
    const baseInput = {
      mapId: "art",
      packs: [],
      functions: [],
      scripts: [],
      structures: 0,
      parsedStructures: 0,
      entities: 0,
      entityKnowledgeGaps: 0,
      worldDatabasePresent: false,
      stateAccesses: 0,
      broadStateWrites: 0,
      repeatedTopologyCandidates: 0,
      diagnostics: [],
      target: { edition: "bedrock" as const },
    };

    const projected = deriveReliabilityFingerprint({
      ...baseInput,
      causalChains: [{
        id: "chain-low",
        scopeKey: "op:1",
        severity: "info",
        confidence: "low",
        title: "route mutation",
        summary: "projection",
        nodes: [{
          id: "risk",
          kind: "downstream-risk",
          label: "navigation-stall-risk",
        }],
        links: [],
        relatedDiagnosticIds: [],
      }],
      causalIncidents: [],
    });

    const observed = deriveReliabilityFingerprint({
      ...baseInput,
      causalChains: [{
        id: "chain-high",
        scopeKey: "op:1",
        severity: "critical",
        confidence: "high",
        title: "route mutation",
        summary: "observed",
        nodes: [{
          id: "risk",
          kind: "downstream-risk",
          label: "navigation-stall-risk",
        }, {
          id: "observed",
          kind: "observed-state",
          label: "navigation-stall-observed",
        }],
        links: [{
          from: "risk",
          to: "observed",
          strength: "direct-evidence",
          rationale: "runtime observation",
        }],
        relatedDiagnosticIds: [],
      }],
      causalIncidents: [{
        id: "incident-1",
        scopeKey: "op:1",
        severity: "critical",
        confidence: "high",
        chainIds: ["chain-high"],
        relatedDiagnosticIds: [],
        nodes: [],
        links: [],
        rootCauseCandidates: [{
          id: "candidate-1",
          label: "route-affecting-world-mutation",
          evidenceLevel: "proven-with-observed-outcome",
          severity: "critical",
          confidence: "high",
          chainIds: ["chain-high"],
          relatedDiagnosticIds: [],
          support: {
            dependencyViolations: 1,
            evidenceGaps: 0,
            corroboratedRisks: 0,
            observedOutcomes: 1,
          },
        }],
      }],
    });

    expect(projected.fingerprint.capabilityTags).toContain("causal-analysis");
    expect(projected.fingerprint.riskSurfaces)
      .not.toContain("observed-downstream-outcome");

    expect(observed.fingerprint.capabilityTags).toEqual(expect.arrayContaining([
      "causal-analysis",
      "causal-high-confidence",
      "causal-observed-outcome",
      "root-cause-candidate",
    ]));
    expect(observed.fingerprint.riskSurfaces).toEqual(expect.arrayContaining([
      "causal-root-cause-high-confidence",
      "observed-downstream-outcome",
      "root-cause-evidence",
    ]));
    expect(observed.id).not.toBe(projected.id);
  });
});
