import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import type { KnowledgeCatalog } from "../../knowledge/src/index.js";
import { inspectDirectory } from "../src/inspection/inspect.js";

const catalog: KnowledgeCatalog = {
  schemaVersion: 1,
  sources: [{
    id: "policy",
    title: "Policy",
    url: "project://knowledge/causal-integration",
    authority: "project-policy",
    confidence: "designed",
    retrievedDate: "2026-09-24",
  }],
  facts: [],
  relations: [{
    id: "route-mutation-needs-revalidation",
    domain: "entity-runtime",
    subject: "route-affecting-world-mutation",
    kind: "requires",
    object: "route-revalidation",
    classification: "project-policy",
    applicability: { editions: ["bedrock"] },
    sourceIds: ["policy"],
    diagnosticSeverity: "medium",
    causalConsequences: [
      "navigation-stall-risk",
      "fallback-recovery-risk",
    ],
    causalCorroborators: {
      "navigation-stall-risk": [
        "route-navigation-consumer-present",
        "route-target-driven-consumer-present",
      ],
    },
    causalOutcomePredicates: {
      "navigation-stall-risk": [
        "navigation-stall-observed",
      ],
      "fallback-recovery-risk": [
        "teleport-fallback-observed",
      ],
    },
  }],
};

describe("inspection causal analysis", () => {
  it("projects navigation risk from an overlapping route mutation without claiming an observed stall", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-causal-test-"));
    try {
      const functions = join(root, "behavior_pack", "functions");
      await mkdir(functions, { recursive: true });
      await writeFile(
        join(functions, "mutate.mcfunction"),
        "fill 10 64 10 20 70 20 minecraft:stone\n",
        "utf8",
      );

      const result = await inspectDirectory(
        root,
        "artifact-test",
        {
          edition: "bedrock",
          staticExecutionDimension: "overworld",
          routeCorridors: [{
            id: "bridge-route",
            dimension: "overworld",
            volume: {
              min: { x: 0, y: 60, z: 0 },
              max: { x: 30, y: 80, z: 30 },
            },
          }],
        },
        "fingerprint-test",
        catalog,
      );

      expect(result.routeAnalysis.overlaps).toBe(1);
      expect(result.knowledgeRuntime.evidenceGaps).toBe(1);
      expect(result.causalAnalysis.chains).toHaveLength(1);
      expect(result.causalAnalysis.lowConfidence).toBe(1);
      expect(result.causalAnalysis.projectedRisks).toBe(2);
      expect(result.causalAnalysis.incidents).toHaveLength(1);
      expect(result.causalAnalysis.rootCauseCandidates).toBe(1);

      const chain = result.causalAnalysis.chains[0]!;
      expect(chain.nodes).toEqual(expect.arrayContaining([
        expect.objectContaining({
          label: "route-affecting-world-mutation",
          kind: "observed-state",
        }),
        expect.objectContaining({
          label: "route-revalidation",
          kind: "missing-requirement",
        }),
        expect.objectContaining({
          label: "navigation-stall-risk",
          kind: "downstream-risk",
        }),
      ]));
      expect(chain.nodes.some(
        (node) => node.label === "navigation-stall-observed",
      )).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it("corroborates navigation risk only when the route explicitly links a navigable entity", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-causal-linked-test-"));
    try {
      const functions = join(root, "behavior_pack", "functions");
      const entities = join(root, "behavior_pack", "entities");
      await mkdir(functions, { recursive: true });
      await mkdir(entities, { recursive: true });

      await writeFile(
        join(functions, "mutate.mcfunction"),
        "fill 10 64 10 20 70 20 minecraft:stone\n",
        "utf8",
      );
      await writeFile(
        join(entities, "zombie.json"),
        JSON.stringify({
          format_version: "1.21.0",
          "minecraft:entity": {
            description: {
              identifier: "demo:zombie",
            },
            components: {
              "minecraft:navigation.walk": {},
              "minecraft:movement.basic": {},
              "minecraft:behavior.nearest_attackable_target": {
                entity_types: [{
                  filters: {
                    test: "is_family",
                    subject: "other",
                    value: "player",
                  },
                  max_dist: 32,
                }],
              },
            },
          },
        }),
        "utf8",
      );

      const result = await inspectDirectory(
        root,
        "artifact-linked-test",
        {
          edition: "bedrock",
          staticExecutionDimension: "overworld",
          routeCorridors: [{
            id: "bridge-route",
            dimension: "overworld",
            entityKeys: ["demo:zombie"],
            volume: {
              min: { x: 0, y: 60, z: 0 },
              max: { x: 30, y: 80, z: 30 },
            },
          }],
        },
        "fingerprint-linked-test",
        catalog,
      );

      expect(result.routeAnalysis.overlaps).toBe(1);
      expect(result.causalAnalysis.mediumConfidence).toBe(1);
      expect(result.causalAnalysis.lowConfidence).toBe(0);

      const chain = result.causalAnalysis.chains[0]!;
      const navigationRisk = chain.nodes.find(
        (node) => node.label === "navigation-stall-risk",
      );
      expect(navigationRisk).toEqual(expect.objectContaining({
        kind: "downstream-risk",
        corroboratingPredicates: [
          "route-navigation-consumer-present",
          "route-target-driven-consumer-present",
        ],
      }));
      expect(chain.links).toEqual(expect.arrayContaining([
        expect.objectContaining({
          to: navigationRisk?.id,
          strength: "corroborated-risk",
        }),
      ]));
      expect(chain.nodes.some(
        (node) => node.label === "navigation-stall-observed",
      )).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it("does not corroborate from an unrelated navigable entity", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-causal-unlinked-test-"));
    try {
      const functions = join(root, "behavior_pack", "functions");
      const entities = join(root, "behavior_pack", "entities");
      await mkdir(functions, { recursive: true });
      await mkdir(entities, { recursive: true });

      await writeFile(
        join(functions, "mutate.mcfunction"),
        "fill 10 64 10 20 70 20 minecraft:stone\n",
        "utf8",
      );
      await writeFile(
        join(entities, "other.json"),
        JSON.stringify({
          "minecraft:entity": {
            description: { identifier: "demo:other" },
            components: {
              "minecraft:navigation.walk": {},
              "minecraft:behavior.nearest_attackable_target": {
                entity_types: [{
                  filters: {
                    test: "is_family",
                    subject: "other",
                    value: "player",
                  },
                }],
              },
            },
          },
        }),
        "utf8",
      );

      const result = await inspectDirectory(
        root,
        "artifact-unlinked-test",
        {
          edition: "bedrock",
          staticExecutionDimension: "overworld",
          routeCorridors: [{
            id: "bridge-route",
            dimension: "overworld",
            entityKeys: ["demo:zombie"],
            volume: {
              min: { x: 0, y: 60, z: 0 },
              max: { x: 30, y: 80, z: 30 },
            },
          }],
        },
        "fingerprint-unlinked-test",
        catalog,
      );

      expect(result.causalAnalysis.lowConfidence).toBe(1);
      expect(result.causalAnalysis.mediumConfidence).toBe(0);
      expect(result.causalAnalysis.chains[0]?.links.some(
        (link) => link.strength === "corroborated-risk",
      )).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it("promotes a matching runtime stall observation without claiming sole causation", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-causal-observed-test-"));
    try {
      const functions = join(root, "behavior_pack", "functions");
      const entities = join(root, "behavior_pack", "entities");
      await mkdir(functions, { recursive: true });
      await mkdir(entities, { recursive: true });

      await writeFile(
        join(functions, "mutate.mcfunction"),
        "fill 10 64 10 20 70 20 minecraft:stone\n",
        "utf8",
      );
      await writeFile(
        join(entities, "zombie.json"),
        JSON.stringify({
          "minecraft:entity": {
            description: { identifier: "demo:zombie" },
            components: {
              "minecraft:navigation.walk": {},
              "minecraft:behavior.nearest_attackable_target": {
                entity_types: [{
                  filters: {
                    test: "is_family",
                    subject: "other",
                    value: "player",
                  },
                }],
              },
            },
          },
        }),
        "utf8",
      );

      const operationId =
        "artifact-observed:behavior_pack/functions/mutate.mcfunction:1:0";

      const result = await inspectDirectory(
        root,
        "artifact-observed",
        {
          edition: "bedrock",
          staticExecutionDimension: "overworld",
          routeCorridors: [{
            id: "bridge-route",
            dimension: "overworld",
            entityKeys: ["demo:zombie"],
            volume: {
              min: { x: 0, y: 60, z: 0 },
              max: { x: 30, y: 80, z: 30 },
            },
          }],
        },
        "fingerprint-observed",
        catalog,
        [{
          predicate: "navigation-stall-observed",
          state: "present",
          confidence: "observed",
          scope: { operationId },
          note: "QA telemetry observed no navigation progress in the route scope.",
        }],
      );

      expect(result.causalAnalysis.mediumConfidence).toBe(1);
      expect(result.causalAnalysis.corroboratedRisks).toBe(1);
      expect(result.causalAnalysis.observedOutcomes).toBe(1);

      const chain = result.causalAnalysis.chains[0]!;
      expect(chain.nodes).toEqual(expect.arrayContaining([
        expect.objectContaining({
          kind: "observed-state",
          label: "navigation-stall-observed",
        }),
      ]));
      expect(chain.summary).toMatch(/attribution remains a corroborated candidate/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });


  it("replays two-script Discovery through the production inspection entrypoint without promoting inferred lifecycle", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-discovery-acceptance-"));
    try {
      const scripts = join(root, "behavior_packs", "demo", "scripts");
      await mkdir(scripts, { recursive: true });
      await writeFile(join(scripts, "main.js"), [
        'import { world } from "@minecraft/server";',
        'import { cleanupSession } from "./cleanup.js";',
        'function resetArena(ended, player) {',
        '  if (ended) cleanupSession(player);',
        '}',
        'world.afterEvents.playerLeave.subscribe(event => resetArena(true, event.player));',
      ].join("\n"), "utf8");
      await writeFile(join(scripts, "cleanup.js"), [
        'let sessionPhase = "active";',
        'export function cleanupSession(player) {',
        '  sessionPhase = "finished";',
        '  player.removeTag("playing");',
        '  return { action: "finish" };',
        '}',
      ].join("\n"), "utf8");

      const result = await inspectDirectory(
        root, "fixture:direct-import-discovery",
        { edition: "bedrock", staticExecutionDimension: "overworld" },
        "fixture-fingerprint", catalog,
      );
      const ir = result.semanticIrModel;
      const imported = ir.execution.edges.filter(edge =>
        edge.kind === "synchronous-call" &&
        edge.targetLabel === "cleanupSession" &&
        edge.source.relativePath.endsWith("/scripts/main.js"));
      expect(imported).toHaveLength(1);
      expect(imported[0]).toMatchObject({
        resolution: "resolved",
        controlFlow: "conditional",
      });
      expect(imported[0]?.lexicalGuards?.map(guard =>
        [guard.expression, guard.branch])).toEqual([["ended", "true"]]);
      const outcome = ir.execution.outcomes?.find(item =>
        item.value === "finish" &&
        item.source.relativePath.endsWith("/scripts/cleanup.js"));
      expect(outcome).toBeDefined();
      expect(imported[0]?.to).toBe(outcome?.executionRegionId);
      const phaseWrite = ir.state.operations.find(op =>
        op.operation === "write" &&
        op.writtenValue?.kind === "literal" &&
        op.writtenValue.value === "finished" &&
        op.executionRegionId === outcome?.executionRegionId);
      const resourceRelease = ir.state.resourceActions?.find(action =>
        action.action === "release" && action.key === "player:playing" &&
        action.executionRegionId === outcome?.executionRegionId);
      expect(phaseWrite).toBeDefined();
      expect(resourceRelease).toBeDefined();

      const intent = result.gameplayIntent.model;
      const relation = intent.edges.find(edge =>
        edge.kind === "requires" &&
        edge.evidenceIds.includes(imported[0]!.id));
      expect(relation?.status).toBe("inferred");
      expect(intent.evidence.some(item =>
        item.id === imported[0]!.id &&
        item.scope === "selected-artifact")).toBe(true);
      const stateRelation = intent.edges.find(edge =>
        edge.kind === "transitions-to" &&
        edge.evidenceIds.includes(phaseWrite!.id));
      const resultRelation = intent.edges.find(edge =>
        edge.kind === "produces" &&
        edge.evidenceIds.includes(outcome!.id));
      expect(stateRelation?.status).toBe("inferred");
      expect(resultRelation?.status).toBe("inferred");
      expect(intent.evidence.some(item =>
        item.id === resourceRelease!.id &&
        item.scope === "selected-artifact")).toBe(true);

      const scenario = result.hiddenGameplayDefects.scenarioAudit.graph;
      const links = scenario.causalLinks.filter(link =>
        link.evidenceIds.includes(imported[0]!.id));
      expect(links.every(link => link.status !== "PROVEN")).toBe(true);
      const challenges = result.hiddenGameplayDefects.discoveryChallenges;
      expect(challenges.some(item =>
        item.kind === "unowned-execution-edge" &&
        item.evidenceIds.includes(imported[0]!.id))).toBe(true);
      expect(result.gameplayDiscoveryClosure.status).toBe("OPEN");
      expect(result.gameplayDiscoveryClosure.discoveryChallengeIds.length)
        .toBeGreaterThan(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });


  it("keeps repeated class names source-scoped and outside gameplay scenarios until behavior grounds them", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-class-owner-"));
    try {
      const scripts = join(root, "behavior_packs", "demo", "scripts");
      await mkdir(scripts, { recursive: true });
      await writeFile(join(scripts, "session.js"), [
        'import { world } from "@minecraft/server";',
        'class PlayerSession { reconnect() {} }',
        'class ArenaSession { reconnect() {} }',
        'function resetArena() { return { action: "finish" }; }',
        'world.afterEvents.playerLeave.subscribe(() => resetArena());',
      ].join("\n"), "utf8");
      const result = await inspectDirectory(
        root, "fixture:class-identity",
        { edition: "bedrock", staticExecutionDimension: "overworld" },
        "fixture-fingerprint", catalog,
      );
      const nodes = result.gameplayIntent.model.nodes;
      const declarations = nodes.filter(node =>
        node.id.startsWith("lifecycle:reconnect:declaration:"));
      expect(declarations).toHaveLength(2);
      expect(new Set(declarations.map(node => node.id)).size).toBe(2);
      expect(declarations.every(node => node.status === "hypothesis")).toBe(true);
      const graph = result.hiddenGameplayDefects.scenarioAudit.graph;
      expect(graph.scenarios.some(scenario =>
        declarations.some(node =>
          scenario.sourceSubjectIds.includes(node.id) ||
          scenario.componentIds.includes(node.id)))).toBe(false);
      expect(graph.components.some(component =>
        declarations.some(node => node.id === component.id))).toBe(false);

      const reset = nodes.find(node => node.id === "lifecycle:reset-arena");
      expect(reset).toBeDefined();
      expect(reset?.status).not.toBe("hypothesis");
      expect(graph.scenarios.some(scenario =>
        scenario.sourceSubjectIds.includes(reset!.id))).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps missing imported gameplay targets unresolved through production inspection", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-discovery-unresolved-"));
    try {
      const scripts = join(root, "behavior_packs", "demo", "scripts");
      await mkdir(scripts, { recursive: true });
      await writeFile(join(scripts, "main.js"), [
        'import { cleanupSession } from "./missing.js";',
        'function resetArena(ended) {',
        '  if (ended) cleanupSession();',
        '}',
      ].join("\n"), "utf8");
      const result = await inspectDirectory(
        root, "fixture:unresolved-import",
        { edition: "bedrock", staticExecutionDimension: "overworld" },
        "fixture-fingerprint", catalog,
      );
      const edges = result.semanticIrModel.execution.edges.filter(edge =>
        edge.kind === "synchronous-call" &&
        edge.targetLabel === "cleanupSession");
      expect(edges).toHaveLength(1);
      expect(edges[0]?.resolution).toBe("unresolved");
      expect(edges[0]?.to).toBeUndefined();
      expect(result.semanticIrModel.execution.outcomes ?? []).toEqual([]);
      expect(result.gameplayIntent.model.edges.some(edge =>
        edge.evidenceIds.includes(edges[0]!.id))).toBe(false);
      expect(result.hiddenGameplayDefects.discoveryChallenges.some(item =>
        item.kind === "unresolved-execution-edge" &&
        item.evidenceIds.includes(edges[0]!.id))).toBe(true);
      expect(result.gameplayDiscoveryClosure.status).toBe("OPEN");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("retains only exact guarded-return evidence in the authored scenario guard dimension", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-direct-return-guard-"));
    try {
      const scripts = join(root, "behavior_packs", "demo", "scripts");
      await mkdir(scripts, { recursive: true });
      const filename = join(scripts, "session.js");
      const inspect = async (suffix: string) => inspectDirectory(
        root, "fixture:direct-return-guard:" + suffix,
        { edition: "bedrock", staticExecutionDimension: "overworld" },
        "fixture-fingerprint-" + suffix, catalog,
      );
      await writeFile(filename, [
        "function decideReconnect(state) {",
        '  if (state.pendingCleanup) return { action: "cleanup" };',
        '  return { action: "lobby" };',
        "}",
      ].join("\n"), "utf8");

      const guarded = await inspect("guarded");
      const intent = guarded.gameplayIntent.model;
      const relation = intent.edges.find((edge) =>
        edge.kind === "requires" && edge.status === "authored" &&
        edge.from.includes("outcome:decide-reconnect-cleanup") &&
        intent.nodes.some((node) =>
          node.id === edge.to && node.kind === "policy"
        )
      );
      expect(relation).toBeDefined();
      const returnWitness = (guarded.semanticIrModel.execution.outcomes ?? [])
        .find((item) => item.value === "cleanup" &&
          item.source.relativePath.endsWith("session.js"));
      expect(returnWitness).toBeDefined();
      expect(relation?.evidenceIds).toContain(returnWitness!.id);
      const matching = guarded.hiddenGameplayDefects.scenarioAudit.graph.causalLinks
        .filter((link) => link.fromComponentId === relation?.from &&
          link.toComponentId === relation?.to);
      expect(matching.length).toBeGreaterThan(0);
      expect(matching.every((link) =>
        link.dimensionEvidence.guard?.includes(returnWitness!.id)
      )).toBe(true);
      expect(matching.every((link) =>
        link.dimensionEvidence.scope === undefined &&
        link.dimensionEvidence.exclusion === undefined
      )).toBe(true);
      // Merely classifying a lifecycle return is not proof of a gameplay run.
      expect(guarded.hiddenGameplayDefects.scenarioAudit.graph.sourceFlowCandidates
        ?.every((candidate) => candidate.runtimeStatus === "NOT_OBSERVED"))
        .toBe(true);

      // Same named outcome also has an unguarded return. Its policy relation
      // remains observable, but full authored guard coverage is absent.
      await writeFile(filename, [
        "function decideReconnect(state) {",
        '  if (state.pendingCleanup) return { action: "cleanup" };',
        '  return { action: "cleanup" };',
        "}",
      ].join("\n"), "utf8");
      const uncovered = await inspect("unguarded-alternative");
      const secondIntent = uncovered.gameplayIntent.model;
      expect(secondIntent.invariants.some((item) =>
        item.id.startsWith("inv:admissible-policy:") &&
        item.id.includes("decide-reconnect-cleanup"))).toBe(false);
      const otherLinks = uncovered.hiddenGameplayDefects.scenarioAudit.graph.causalLinks
        .filter((link) => link.intentEdgeKind === "requires" &&
          link.fromComponentId.includes("decide-reconnect-cleanup"));
      expect(otherLinks.every((link) =>
        (link.dimensionEvidence.guard ?? []).length === 0
      )).toBe(true);

      // Even when every literal return site is directly guarded, two
      // different policy owners cannot borrow one another's guard proof.
      await writeFile(filename, [
        "function decideReconnect(state) {",
        '  if (state.pendingCleanup) return { action: "cleanup" };',
        '  if (state.forceCleanup) return { action: "cleanup" };',
        '  return { action: "lobby" };',
        "}",
      ].join("\n"), "utf8");
      const ambiguous = await inspect("two-different-guards");
      const policyLinks = ambiguous.hiddenGameplayDefects.scenarioAudit.graph.causalLinks
        .filter((link) => link.intentEdgeKind === "requires" &&
          link.fromComponentId.includes("decide-reconnect-cleanup"));
      expect(policyLinks.length).toBeGreaterThan(1);
      expect(policyLinks.every((link) =>
        (link.dimensionEvidence.guard ?? []).length === 0
      )).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("does not attach a runtime stall observation from a different operation scope", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-causal-wrong-scope-test-"));
    try {
      const functions = join(root, "behavior_pack", "functions");
      await mkdir(functions, { recursive: true });
      await writeFile(
        join(functions, "mutate.mcfunction"),
        "fill 10 64 10 20 70 20 minecraft:stone\n",
        "utf8",
      );

      const result = await inspectDirectory(
        root,
        "artifact-wrong-scope",
        {
          edition: "bedrock",
          staticExecutionDimension: "overworld",
          routeCorridors: [{
            id: "bridge-route",
            dimension: "overworld",
            volume: {
              min: { x: 0, y: 60, z: 0 },
              max: { x: 30, y: 80, z: 30 },
            },
          }],
        },
        "fingerprint-wrong-scope",
        catalog,
        [{
          predicate: "navigation-stall-observed",
          state: "present",
          confidence: "observed",
          scope: {
            operationId: "artifact-wrong-scope:other/function.mcfunction:9:0",
          },
        }],
      );

      expect(result.causalAnalysis.observedOutcomes).toBe(0);
      expect(result.causalAnalysis.lowConfidence).toBe(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
