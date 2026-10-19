import { reconstructAuthoredJourneyCandidates } from
  "../src/inspection/gameplay-scenario-compiler.js";
import type {
  GameplayMechanicReconstruction,
  GameplaySourceFlowCandidate,
} from "../src/inspection/gameplay-scenario-model.js";
import type { GameplayIntentModel } from
  "../../gameplay-intent/src/index.js";
import { readFileSync } from "node:fs";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { packageDirectoryDeterministically } from "../../archive/src/index.js";
import {
  runSelectedMapAudit,
  applySelectedMapAuditModelResponses,
  projectSelectedMapAuditModelHandoff,
} from "../src/map-audit-pipeline.js";
import {
  deriveAuditModelKnowledgeLookup,
  deriveAuditModelTaskPackets,
  retrieveAuditTaskKnowledge,
} from "../src/map-audit-model-task.js";
import { formatSelectedMapAuditBrief } from "../src/map-audit-output-v2.js";

/**
 * Synthetic authoring styles, not production game maps or runtime evidence.
 * Exercise the real .mcworld -> single selected-map audit -> operator output,
 * without a second extractor, a private map, or genre-specific expectations.
 */
type Case = "dialogue" | "animation" | "ambiguous-target";

async function syntheticMcworld(kind: Case): Promise<{
  archive: string;
  cleanup: () => Promise<void>;
}> {
  const root = await mkdtemp(join(tmpdir(), "m-bedrock-gameplay-acceptance-"));
  const world = join(root, "world");
  const first = join(world, "behavior_packs", "demo");
  const second = join(world, "behavior_packs", "other");
  const manifest = (uuid: string, moduleUuid: string) => ({
    format_version: 2,
    header: {
      name: "Synthetic source-flow acceptance",
      description: "Synthetic test world; no private assets",
      uuid,
      version: [1, 0, 0],
      min_engine_version: [1, 20, 0],
    },
    modules: [{ type: "data", uuid: moduleUuid, version: [1, 0, 0] }],
  });
  try {
    await mkdir(join(first, "functions", "arena"), { recursive: true });
    await writeFile(join(world, "levelname.txt"), "Synthetic source-flow acceptance\n");
    await writeFile(join(first, "manifest.json"), JSON.stringify(manifest(
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab",
    )));
    await writeFile(join(first, "functions", "arena", "start.mcfunction"),
      kind === "animation"
        ? "setblock 1 64 1 stone\n"
        : "scoreboard players set @p session 1\ntp @p 5 70 5\n",
    );
    const packs = [{
      pack_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      version: [1, 0, 0],
    }];
    if (kind === "ambiguous-target") {
      await mkdir(join(second, "functions", "arena"), { recursive: true });
      await writeFile(join(second, "manifest.json"), JSON.stringify(manifest(
        "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbc",
      )));
      await writeFile(join(second, "functions", "arena", "start.mcfunction"),
        "summon zombie 3 70 3\n",
      );
      packs.push({
        pack_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        version: [1, 0, 0],
      });
    }
    if (kind !== "animation") {
      await mkdir(join(first, "dialogue"), { recursive: true });
      await writeFile(join(first, "dialogue", "npc.json"), JSON.stringify({
        format_version: "1.17.0",
        "minecraft:npc_dialogue": {
          scenes: [{
            scene_tag: "synthetic:entry",
            npc_name: "Guide",
            text: "Choose an action.",
            buttons: [{
              name: "Start Challenge",
              commands: ["function arena/start"],
            }],
          }],
        },
      }));
    } else {
      await mkdir(join(first, "animations"), { recursive: true });
      await mkdir(join(first, "entities"), { recursive: true });
      await writeFile(join(first, "animations", "start.json"), JSON.stringify({
        format_version: "1.10.0",
        animations: {
          "animation.synthetic.start": {
            loop: false,
            timeline: { "0.2": ["/function arena/start"] },
          },
        },
      }));
      await writeFile(join(first, "entities", "trigger.json"), JSON.stringify({
        format_version: "1.16.0",
        "minecraft:entity": {
          description: {
            identifier: "synthetic:trigger",
            animations: { begin: "animation.synthetic.start" },
            scripts: { animate: ["begin"] },
          },
          components: {},
          events: {},
        },
      }));
    }
    await writeFile(join(world, "world_behavior_packs.json"), JSON.stringify(packs));
    const archive = join(root, kind + ".mcworld");
    await packageDirectoryDeterministically(world, archive);
    return { archive, cleanup: () => rm(root, { recursive: true, force: true }) };
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
}

// One acceptance boundary checks the real operator output, rather than
// treating individual source/Intent/Scenario helpers as product proof.
function expectReconstructionContract(
  result: Awaited<ReturnType<typeof runSelectedMapAudit>>,
): void {
  const discovery = result.inspection.gameplayDiscoveryClosure;
  const view = result.mapAuditReport.gameplayStructure;
  expect(discovery.sourceFileAccountingComplete).toBe(true);
  expect(discovery.inventoriedFileCount)
    .toBe(result.inspection.fileInventory.length);
  expect(discovery.sourceInventoryBalanced).toBe(true);
  expect(result.mapAuditReport.artifactFingerprint)
    .toBe(result.identity.artifactFingerprint);
  expect(result.mapAuditReport.artifactFingerprint)
    .toBe(result.inspection.fingerprint);
  expect(result.mapAuditReport.artifactFingerprint)
    .toMatch(/^[a-f0-9]{64}$/);
  expect(result.mapAuditReport.auditTarget).toMatchObject({
    source: "selected-audit-runtime-target-not-live-observation",
  });
  expect(view).toBeDefined();

  const schema = JSON.parse(readFileSync(
    ".agents/schemas/map-audit-output-v2.schema.json", "utf8",
  )) as { properties: { gameplayStructure: {
    required: string[];
    properties: Record<string, unknown>;
  } } };
  for (const key of schema.properties.gameplayStructure.required) {
    // Keep the strict report contract aligned with the actual production
    // projection; a documented property without its producer is not accepted.
    expect(view).toHaveProperty(key);
    expect(schema.properties.gameplayStructure.properties).toHaveProperty(key);
  }
  expect(view!.sourceFlowCandidates.every(item =>
    item.runtimeStatus === "NOT_OBSERVED")).toBe(true);
  expect(view!.mechanicReconstructions.every(item =>
    item.runtimeStatus === "NOT_OBSERVED")).toBe(true);
  expect(view!.gameplayJourneyCandidates.every(item =>
    item.runtimeStatus === "NOT_OBSERVED" &&
    item.interpretation?.basis ===
      "DIRECTED_SELECTED_SOURCE_RELATIONS_NOT_PLAYER_SEQUENCE" &&
    item.interpretation.steps.length === item.subjectIds.length &&
    item.interpretation.relationships.length === item.relationIds.length &&
    item.interpretation.missingUnderstanding.includes("RUNTIME_NOT_OBSERVED")
  )).toBe(true);
  expect(result.mapAuditReport.gameplayFlowBasis)
    .toBe("AUDIT_CHECKLIST_NOT_OBSERVED_GAMEPLAY");
}

describe("Game Reconstruction selected-map production acceptance (synthetic)", () => {
  it("follows NPC button -> unique function -> sourced score and teleport effects", async () => {
    const fixture = await syntheticMcworld("dialogue");
    try {
      const result = await runSelectedMapAudit({ artifactPath: fixture.archive });
      expectReconstructionContract(result);
      // A source report with the wrong selected archive SHA cannot become
      // frozen benchmark evidence, even when all V2 fields otherwise match.
      const freezeTemp = await mkdtemp(join(tmpdir(), "map-audit-sha-gate-"));
      try {
        const wrongReport = join(freezeTemp, "wrong-report.json");
        const output = join(freezeTemp, "should-not-exist.json");
        await writeFile(wrongReport, JSON.stringify({
          ...result.mapAuditReport,
          artifactFingerprint: "0".repeat(64),
        }));
        const attempt = spawnSync(process.execPath, [
          ".agents/skills/m-bedrock-detection-benchmark/scripts/freeze-observed-map-audit.mjs",
          fixture.archive, wrongReport, output,
        ], { encoding: "utf8" });
        expect(attempt.status).not.toBe(0);
        expect(attempt.stderr).toContain("does not match");
      } finally {
        await rm(freezeTemp, { recursive: true, force: true });
      }
      const ir = result.inspection.semanticIrModel;
      const relation = ir.execution.authoredBehaviorRelations?.find(item =>
        item.kind === "dialogue-button-command");
      expect(relation?.interactionLabel).toBe("Start Challenge");
      expect(relation?.executionEdgeIds).toHaveLength(1);
      const edge = ir.execution.edges.find(item =>
        item.id === relation!.executionEdgeIds![0]);
      expect(edge?.resolution).toBe("resolved");
      expect(edge?.to).toBeDefined();
      const teleport = ir.execution.worldEffects?.find(effect =>
        effect.kind === "teleport" &&
        effect.executionRegionId === edge!.to);
      expect(teleport).toBeDefined();
      const sourceFlow = result.mapAuditReport.gameplayStructure
        ?.sourceFlowCandidates.find(flow =>
          flow.entryKind === "dialogue-command" &&
          flow.executionEdgeIds.includes(edge!.id));
      expect(sourceFlow?.sourceSteps.some(step => step.id === teleport!.id)).toBe(true);
      expect(sourceFlow?.sourceSteps.some(step =>
        step.kind === "state" && step.executionRegionId === edge!.to)).toBe(true);
      expect(result.inspection.gameplayIntent.model.nodes.some(node =>
        node.kind === "mechanic" &&
        node.label === "NPC interaction: Start Challenge" &&
        node.status === "inferred")).toBe(true);
      const brief = formatSelectedMapAuditBrief({
        report: result.mapAuditReport,
        intent: result.inspection.gameplayIntent.model,
        modelTaskPackets: result.modelTaskPackets,
      });
      expect(brief).toContain("# Selected Map Audit");
      expect(brief).toContain("NPC interaction: Start Challenge");
      expect(brief).toContain("Source-derived relations: activation");
      const handoff = projectSelectedMapAuditModelHandoff(result);
      expect(handoff.gameUnderstanding.sourceStateIdentityQuestions).toEqual([]);
      expect(handoff.gameUnderstanding.omittedSourceStateIdentityQuestions)
        .toBe(0);
      expect(handoff.gameUnderstanding.sourceReturnPolicyQuestions).toEqual([]);
      expect(handoff.gameUnderstanding.omittedSourceReturnPolicyQuestions)
        .toBe(0);
      expect(handoff.gameUnderstanding.sourceArenaPartitionQuestions)
        .toEqual([]);
      expect(handoff.gameUnderstanding.omittedSourceArenaPartitionQuestions)
        .toBe(0);
      expect(handoff.policy).toBe("selected-map-audit-model-handoff");
      expect(handoff.artifactId).toBe(result.identity.artifactId);
      expect(handoff.artifactFingerprint).toBe(result.identity.artifactFingerprint);
      expect(handoff.auditRevision).toBe(result.auditRevision);
      expect(handoff.gameUnderstanding.gameplayFlowBasis)
        .toBe("AUDIT_CHECKLIST_NOT_OBSERVED_GAMEPLAY");
      expect(handoff.taskCount).toBe(result.modelTaskPackets.length);
      // Independent proof-navigation tasks must not leapfrog an earlier
      // canonical audit checkpoint in the model-facing task queue.
      const packetStageRanks = result.modelTaskPackets.map(task =>
        result.stageOrder.indexOf(task.stage));
      expect(packetStageRanks).toEqual(
        [...packetStageRanks].sort((left, right) => left - right),
      );
      expect(handoff.tasks.every(({ task }) =>
        task.auditRevision === result.auditRevision)).toBe(true);
      const emptyAnswers = {
        schemaVersion: 1 as const,
        policy: "selected-map-audit-model-responses" as const,
        artifactId: handoff.artifactId,
        artifactFingerprint: handoff.artifactFingerprint,
        auditRevision: handoff.auditRevision,
        resolutions: [],
      };
      expect(applySelectedMapAuditModelResponses({
        audit: result,
        responses: emptyAnswers,
      })).toBe(result);
      expect(() => applySelectedMapAuditModelResponses({
        audit: result,
        responses: { ...emptyAnswers, auditRevision: "stale-revision" },
      })).toThrow(/different selected artifact or audit revision/);
      expect(() => applySelectedMapAuditModelResponses({
        audit: result,
        responses: {
          ...emptyAnswers,
          resolutions: [{
            taskId: "fabricated-model-task",
            resolution: {
              causalLinkId: "fabricated-causal-link",
              disposition: "CONFIRMED_DEFECT_READY" as const,
            },
          }],
        },
      })).toThrow(/does not belong to a resolvable causal task/);
      expect(brief).toContain("Possible player journeys (NOT OBSERVED)");
      expect(brief).toContain("Source associations and knowledge lookup hints are not Minecraft runtime proof.");
      expect(result.mapAuditReport.gameplayFlowBasis)
        .toBe("AUDIT_CHECKLIST_NOT_OBSERVED_GAMEPLAY");
      const interaction = result.mapAuditReport.gameplayStructure?.features
        .find(item => item.label === "NPC interaction: Start Challenge");
      expect(interaction?.purpose).toContain("Gameplay purpose UNKNOWN");
      expect(interaction?.purpose).toContain("Source context:");
      expect(interaction?.grounding).toBe("SOURCE_EVIDENCED");
      expect(result.inspection.gameplayIntent.model.unknowns.some(item =>
        item.blockedSubjectIds.includes(interaction!.id))).toBe(true);
      expect(result.mapAuditReport.gameplayFlowBasis)
        .toBe("AUDIT_CHECKLIST_NOT_OBSERVED_GAMEPLAY");
      const reconstructed = result.mapAuditReport.gameplayStructure
        ?.mechanicReconstructions.find(item =>
          item.name === "NPC interaction: Start Challenge");
      expect(reconstructed?.exactSourceFlowIds).toContain(sourceFlow!.id);
      const entry = reconstructed?.sourceActivationCandidates.find(item =>
        item.sourceFlowId === sourceFlow!.id);
      expect(entry?.entryKind).toBe("dialogue-command");
      expect(entry?.evidenceBasis).toBe("EXACT_SOURCE_ENTRY_REFERENCE");
      expect(entry?.supportingEvidenceIds).toContain(relation!.id);
      expect(entry?.runtimeStatus).toBe("NOT_OBSERVED");
      expect(reconstructed?.unresolvedDimensions)
        .not.toContain("NO_ACTIVATION_RELATION");
      expect(brief).toContain("Source entry (EXACT_SOURCE_ENTRY_REFERENCE; NOT EXECUTED)");
      expect(result.mapAuditReport.gameplayStructure
        ?.features.find(item => item.label === "NPC interaction: Start Challenge")
        ?.sourceBehaviorPaths.some(path =>
          path.effectId === teleport!.id &&
          path.association === "CALL_PATH_CONTEXT" &&
          path.executionEdgeIds.includes(edge!.id))).toBe(true);
    } finally {
      await fixture.cleanup();
    }
  });

  it("links entity animation alias -> timeline command -> unique function effect", async () => {
    const fixture = await syntheticMcworld("animation");
    try {
      const result = await runSelectedMapAudit({ artifactPath: fixture.archive });
      expectReconstructionContract(result);
      const ir = result.inspection.semanticIrModel;
      expect(ir.execution.authoredBehaviorRelations?.some(item =>
        item.kind === "entity-animation-activation" &&
        item.resolution === "EXACT_REFERENCE")).toBe(true);
      const timeline = ir.execution.authoredBehaviorRelations?.find(item =>
        item.kind === "animation-timeline-command");
      expect(timeline?.timingSeconds).toBe(0.2);
      expect(timeline?.executionEdgeIds).toHaveLength(1);
      const edge = ir.execution.edges.find(item =>
        item.id === timeline!.executionEdgeIds![0]);
      expect(edge?.resolution).toBe("resolved");
      const effect = ir.execution.worldEffects?.find(item =>
        item.kind === "block-mutation" &&
        item.executionRegionId === edge!.to);
      expect(effect).toBeDefined();
      const flow = result.mapAuditReport.gameplayStructure?.sourceFlowCandidates
        .find(item => item.entryKind === "behavior-animation" &&
          item.executionEdgeIds.includes(edge!.id));
      expect(flow?.sourceSteps.some(item => item.id === effect!.id)).toBe(true);
      expect(result.mapAuditReport.gameplayStructure?.authoredBehaviorRelationships
        .some(item => item.id === timeline!.id)).toBe(true);
      expect(result.mapAuditReport.gameDesign.winConditionGrounding)
        .not.toBe("authored");
    } finally {
      await fixture.cleanup();
    }
  });

  it("does not traverse either target when a command resolves to duplicate pack functions", async () => {
    const fixture = await syntheticMcworld("ambiguous-target");
    try {
      const result = await runSelectedMapAudit({ artifactPath: fixture.archive });
      expectReconstructionContract(result);
      const ir = result.inspection.semanticIrModel;
      const relation = ir.execution.authoredBehaviorRelations?.find(item =>
        item.kind === "dialogue-button-command");
      const edge = ir.execution.edges.find(item =>
        item.id === relation?.executionEdgeIds?.[0]);
      expect(edge?.resolution).toBe("unresolved");
      expect(edge?.to).toBeUndefined();
      const flow = result.mapAuditReport.gameplayStructure?.sourceFlowCandidates
        .find(item => item.entryKind === "dialogue-command" &&
          item.executionEdgeIds.includes(edge!.id));
      expect(flow?.unresolvedExecutionEdgeIds).toContain(edge?.id);
      // An unresolved edge cannot authorize an exact source-entry receipt.
      const activation = result.mapAuditReport.gameplayStructure
        ?.mechanicReconstructions.flatMap(item => item.sourceActivationCandidates) ?? [];
      expect(activation.every(item =>
        !item.supportingEvidenceIds.includes(edge!.id))).toBe(true);
      // Recognition succeeds, but ambiguity blocks exact target traversal;
      // it must not be converted to an understood or executed mechanic.
      expect(result.inspection.gameplayDiscoveryClosure.status).toBe("PARTIAL");
      expect(result.inspection.gameplayDiscoveryClosure.unresolvedSourceLinkIds)
        .toContain(edge!.id);
      expect(flow?.regionIds).toHaveLength(1);
      expect(flow?.sourceSteps.some(step =>
        step.executionRegionId !== flow.entryRegionId)).toBe(false);
      // An unresolved/duplicate target cannot be credited with effects
      // from either same-named function. No guessed call-path context.
      expect(result.mapAuditReport.gameplayStructure?.features
        .filter(item => item.label === "NPC interaction: Start Challenge")
        .flatMap(item => item.sourceBehaviorPaths)).toEqual([]);
      expect(result.mapAuditReport.gameplayFlowBasis)
        .toBe("AUDIT_CHECKLIST_NOT_OBSERVED_GAMEPLAY");
    } finally {
      await fixture.cleanup();
    }
  });
});

describe("model handoff Knowledge owner boundary", () => {
  it("keeps a foreign scenario requirement unresolved despite a SATISFIED receipt", () => {
    const required = {
      id: "knowledge:foreign:state",
      scenarioId: "scenario:foreign",
      domain: "state-flow",
      reason: "Foreign scenario state ownership",
      capabilityIds: ["state-flow"],
      dependsOnRequirementIds: [],
      subjectIds: ["state:foreign"],
      componentIds: ["state:foreign"],
    };
    const receipt = {
      requirementId: required.id,
      scenarioId: required.scenarioId,
      domain: required.domain,
      status: "SATISFIED",
      evidenceIds: ["e:foreign-knowledge"],
      knowledgeIds: ["fact:foreign"],
      capabilityIdsUsed: ["state-flow"],
      subjectIds: required.subjectIds,
      componentIds: required.componentIds,
      reason: "Valid evidence for a different scenario.",
    };
    const base = {
      admission: {
        status: "BLOCKED",
        firstBlockingStage: "PROVE",
        issues: [],
      },
      procedure: { checkpoints: [], blockingCheckpointIds: [] },
      graph: {
        scenarios: [{
          id: "scenario:owned",
          label: "Own scenario",
          gameplayStage: "PROGRESSION",
          purpose: "Resolve owned causal dependency",
        }],
        causalLinks: [{
          id: "link:owned",
          scenarioId: "scenario:owned",
          knowledgeRequirementIds: [required.id],
          status: "CONTRADICTED",
          evidenceIds: ["e:link"],
          subjectIds: ["state:owned"],
          componentIds: ["state:owned"],
        }],
        knowledgeRequirements: [required],
        knowledgeReceipts: [receipt],
      },
      defectResolution: {
        gameplayTranslationRequiredIds: ["link:owned"],
        counterProofSearchRequiredIds: [],
      },
      intent: { nodes: [], evidence: [] },
      auditRevision: "revision:owned",
      world: { platformKnowledge: { claims: [] } },
    } as any;
    const task = deriveAuditModelTaskPackets(base).find(
      (item) => item.kind === "GAMEPLAY_TRANSLATION",
    );
    expect(task?.scenarioId).toBe("scenario:owned");
    expect(task?.requiredKnowledgeIds).toEqual([required.id]);
    expect(task?.knowledgeContext).toEqual([{
      requirementId: required.id,
      domain: "unresolved",
      status: "MISSING_RECEIPT",
      capabilityIds: [],
      evidenceIds: [],
    }]);
    expect(task?.evidenceIds).not.toContain("e:foreign-knowledge");

    // Even a valid matching owner cannot borrow a duplicated receipt ID.
    const sameScenario = {
      ...base,
      graph: {
        ...base.graph,
        knowledgeRequirements: [{ ...required, scenarioId: "scenario:owned" }],
        knowledgeReceipts: [{ ...receipt, scenarioId: "scenario:owned" }],
      },
    };
    const admitted = deriveAuditModelTaskPackets(sameScenario).find(
      (item) => item.kind === "GAMEPLAY_TRANSLATION",
    );
    expect(admitted?.knowledgeContext[0]?.status).toBe("SATISFIED");
    expect(admitted?.knowledgeContext[0]?.evidenceIds)
      .toEqual(["e:foreign-knowledge"]);
  });
});

describe("selected-map Knowledge consumption (read-only)", () => {
  const intent = {
    schemaVersion: 1 as const,
    id: "selected-map",
    evidence: [{
      id: "src:arena",
      origin: "source-code" as const,
      locator: "scripts/arena.ts:20",
      summary: "Arena cleanup source",
      scope: "selected-artifact" as const,
    }],
    nodes: [{
      id: "mechanic:arena-cleanup",
      kind: "mechanic" as const,
      label: "Arena cleanup",
      status: "inferred" as const,
      evidenceIds: ["src:arena"],
    }],
    edges: [], invariants: [], unknowns: [],
  };
  const catalog = {
    schemaVersion: 1 as const,
    sources: [{
      id: "source:official",
      title: "Minecraft Creator reference",
      url: "https://learn.microsoft.com/en-us/minecraft/creator/",
      authority: "official" as const,
      confidence: "documented" as const,
      retrievedDate: "2026-10-11",
    }],
    facts: [{
      id: "cleanup.arena-state-reset",
      domain: "arena-cleanup" as const,
      subject: "arena cleanup",
      statement: "Arena cleanup must reset old scoreboard and inventory surfaces.",
      classification: "derived-rule" as const,
      applicability: { editions: ["bedrock" as const] },
      sourceIds: ["source:official"],
      capabilityTags: ["arena-cleanup"],
      riskSurfaces: ["inventory-reset"],
    }, {
      id: "cleanup.education-reset",
      domain: "arena-cleanup" as const,
      subject: "arena cleanup",
      statement: "Arena cleanup Education-mode reset example.",
      classification: "engine-fact" as const,
      applicability: { editions: ["education" as const] },
      sourceIds: ["source:official"],
      capabilityTags: ["arena-cleanup"],
      riskSurfaces: [],
    }, {
      id: "chunks.unrelated",
      domain: "chunks" as const,
      subject: "remote chunk residency",
      statement: "Remote chunk residency has different runtime requirements.",
      applicability: { editions: ["bedrock" as const] },
      sourceIds: ["source:official"],
      capabilityTags: ["chunks"],
      riskSurfaces: [],
    }],
    relations: [],
  };

  it("selects only scoped knowledge with source and declared edition; does not treat a retrieved fact as bug proof", () => {
    const lookup = deriveAuditModelKnowledgeLookup(
      intent,
      "Why is arena cleanup missing inventory reset?",
      ["mechanic:arena-cleanup"],
    )!;
    const result = retrieveAuditTaskKnowledge({
      catalog,
      lookup,
      intent,
      edition: "bedrock",
    });
    expect(result.status).toBe("MATCHED");
    expect(result.references.map((item) => item.knowledgeId))
      .toEqual(["cleanup.arena-state-reset"]);
    expect(result.references[0]?.sourceIds).toEqual(["source:official"]);
    expect(result.references[0]?.editionCheck).toBe("MATCHED_EDITION_ONLY");
    expect(result.references[0]?.authority)
      .toBe("RETRIEVED_REFERENCE_NOT_BUG_PROOF");
    expect(result.references.some((item) =>
      item.knowledgeId === "chunks.unrelated")).toBe(false);

    const edu = retrieveAuditTaskKnowledge({
      catalog, lookup, intent, edition: "education",
    });
    expect(edu.references.map((item) => item.knowledgeId))
      .toEqual(["cleanup.education-reset"]);

    const noEdition = retrieveAuditTaskKnowledge({
      catalog, lookup, intent,
    });
    expect(noEdition.references.every((item) =>
      item.editionCheck === "NOT_EVALUATED")).toBe(true);
  });

  it("does not retrieve from goal-only/historical-looking prompts without selected artifact grounding", () => {
    const lookup = deriveAuditModelKnowledgeLookup(
      intent, "Maybe a historical arena was faulty.", ["mechanic:missing"],
    )!;
    const result = retrieveAuditTaskKnowledge({ catalog, lookup, intent });
    expect(result.status).toBe("NO_SCOPED_MATCH");
    expect(result.references).toEqual([]);

    const spoof = retrieveAuditTaskKnowledge({
      catalog, intent,
      lookup: {
        ...lookup,
        grounding: "SELECTED_ARTIFACT",
        matchedSubjectIds: ["mechanic:arena-cleanup"],
        sourceEvidenceIds: ["nonexistent-source-evidence"],
      },
    });
    expect(spoof.references).toEqual([]);
  });
});

describe("source-grounded Knowledge search hints", () => {
  it("routes supported map mechanics without treating historical or unknown mechanics as established", () => {
    const intent = {
      schemaVersion: 1 as const,
      id: "selected-map",
      evidence: [{
        id: "src:arena", origin: "source-code" as const,
        locator: "scripts/arena.ts:20", summary: "Arena reset",
        scope: "selected-artifact" as const,
      }, {
        id: "old:arena", origin: "historical-diff" as const,
        locator: "old-version", summary: "Previous behavior",
        scope: "external-reference" as const,
      }],
      nodes: [{
        id: "mechanic:reset", kind: "mechanic" as const, label: "Arena cleanup",
        status: "inferred" as const, evidenceIds: ["src:arena"],
      }, {
        id: "mechanic:legacy", kind: "mechanic" as const, label: "Legacy mode",
        status: "hypothesis" as const, evidenceIds: ["old:arena"],
      }],
      edges: [], invariants: [], unknowns: [],
    };
    const lookup = deriveAuditModelKnowledgeLookup(
      intent,
      "Why does replay keep old inventory?",
      ["mechanic:reset", "mechanic:legacy", "mechanic:novel"],
    );
    expect(lookup?.grounding).toBe("SELECTED_ARTIFACT");
    expect(lookup?.query).toContain("Arena cleanup");
    expect(lookup?.query).not.toContain("Legacy mode");
    expect(lookup?.matchedSubjectIds).toEqual(["mechanic:reset"]);
    expect(lookup?.sourceEvidenceIds).toEqual(["src:arena"]);
    expect(lookup?.sourceLocators).toEqual(["scripts/arena.ts:20"]);
    expect(lookup?.omittedSupportedSubjectIds).toEqual([]);
    expect(lookup?.unresolvedSubjectIds).toEqual([
      "mechanic:legacy", "mechanic:novel",
    ]);
    expect(lookup?.authority).toBe("SEARCH_HINT_NOT_GAMEPLAY_PROOF");

    const unknownOnly = deriveAuditModelKnowledgeLookup(
      intent, "Investigate the new mechanic", ["mechanic:novel"],
    );
    expect(unknownOnly?.grounding).toBe("GOAL_ONLY");
    expect(unknownOnly?.query).toBe("Investigate the new mechanic");
    expect(deriveAuditModelKnowledgeLookup(intent, "all", [])).toBeUndefined();
  });
});



describe("source-linked Game Design path bridges (bounded source-only)", () => {
  it("retains an exact-source resource bridge without inventing play order or intent", () => {
    const evidence = [
      "e:action", "e:resource", "e:goal", "e:win",
      "e:link-resource", "e:link-goal", "e:link-win",
    ].map(id => ({
      id, origin: "source-code" as const, scope: "selected-artifact" as const,
      locator: "behavior_packs/a/scripts/game.js", summary: id,
    }));
    const nodes: GameplayIntentModel["nodes"] = [
      { id: "mechanic:start", kind: "mechanic", label: "Start",
        status: "inferred", evidenceIds: ["e:action"] },
      { id: "resource:score", kind: "resource", label: "Scoreboard score",
        status: "authored", evidenceIds: ["e:resource"] },
      { id: "objective:goal", kind: "objective", label: "Capture flag",
        status: "inferred", evidenceIds: ["e:goal"] },
      { id: "outcome:win", kind: "outcome", label: "Win",
        status: "inferred", evidenceIds: ["e:win"] },
    ];
    const model: GameplayIntentModel = {
      schemaVersion: 1, id: "intent:source-chain", artifactId: "artifact:1",
      evidence, nodes,
      edges: [
        { id: "link:resource", kind: "produces", from: "mechanic:start",
          to: "resource:score", status: "inferred",
          evidenceIds: ["e:link-resource"] },
        { id: "link:goal", kind: "transitions-to", from: "resource:score",
          to: "objective:goal", status: "inferred",
          evidenceIds: ["e:link-goal"] },
        { id: "link:win", kind: "wins-by", from: "objective:goal",
          to: "outcome:win", status: "inferred",
          evidenceIds: ["e:link-win"] },
      ],
      invariants: [], unknowns: [],
    };
    const reconstructions: GameplayMechanicReconstruction[] =
      (["mechanic", "objective", "outcome"] as const).map(kind => {
        const node = nodes.find(node => node.kind === kind)!;
        return {
          featureId: node.id, kind,
          name: node.label, meaningStatus: "INFERRED",
          declaredEvidenceIds: [...node.evidenceIds],
          exactSourceFlowIds: kind === "mechanic" ? ["flow:start"] : [],
          exactSourceStepIds: [], authoredBehaviorRelationIds: [],
          sourceGuardedTransitionCandidateIds: [],
          sourceActivationCandidates: [],
          relations: [], unresolvedDimensions: [],
          runtimeStatus: "NOT_OBSERVED",
        };
      });
    // Equal script filename is not a source-flow, branch or handoff witness.
    const sameFileOnly = reconstructAuthoredJourneyCandidates(model, reconstructions);
    expect(sameFileOnly.candidates.some(item =>
      item.subjectIds.join(",") ===
        "mechanic:start,resource:score,objective:goal,outcome:win")).toBe(false);
    const unsupported = sameFileOnly.candidates.find(item =>
      item.subjectIds.join(",") === "mechanic:start,resource:score");
    expect(unsupported?.boundary).toBe("SOURCE_JOIN_UNPROVEN");
    expect(unsupported?.interpretation?.sourceJoinGap?.previousSourceLocators)
      .toEqual(["behavior_packs/a/scripts/game.js"]);
    expect(unsupported?.interpretation?.sourceJoinGap?.nextSourceLocators)
      .toEqual(["behavior_packs/a/scripts/game.js"]);

    // Multiple relations carrying the SAME exact source witness may still
    // form a partial SOURCE-ONLY interpretation, never a player chronology.
    const sharedWitness = "e:exact-source-witness";
    const joined: GameplayIntentModel = {
      ...model,
      evidence: [...evidence, { id: sharedWitness,
        origin: "source-code" as const,
        scope: "selected-artifact" as const,
        locator: "behavior_packs/a/scripts/game.js", summary: "Exact source relation witness" }],
      edges: model.edges.map(edge => ({
        ...edge, evidenceIds: [...edge.evidenceIds, sharedWitness],
      })),
    };
    const result = reconstructAuthoredJourneyCandidates(joined, reconstructions);
    expect(result.candidates).toHaveLength(1);
    const path = result.candidates[0]!;
    expect(path.subjectIds).toEqual([
      "mechanic:start", "resource:score", "objective:goal", "outcome:win",
    ]);
    expect(path.interpretation?.sourceOutcome).toBe("WIN_RELATION_CANDIDATE");
    expect(path.interpretation?.relationships.map(item => item.kind))
      .toEqual(["produces", "transitions-to", "wins-by"]);
    expect(path.interpretation?.steps[1]?.meaningBasis).toBe("TECHNICAL_SOURCE_ONLY");
    expect(path.interpretation?.missingUnderstanding).toContain(
      "PLAYER_GOAL_NOT_INDEPENDENTLY_GROUNDED");
    expect(path.interpretation?.missingUnderstanding).toContain(
      "SOURCE_RELATION_DIRECTION_NOT_PLAY_ORDER");
    expect(path.interpretation?.missingUnderstanding).toContain(
      "RUNTIME_NOT_OBSERVED");
    // External text cannot bridge two current-artifact subjects. The partial
    // local source segment can remain visible; the win link cannot be invented.
    const foreign: GameplayIntentModel = {
      ...model,
      evidence: [...evidence, {
        id: "e:foreign", origin: "official-documentation",
        scope: "external-reference", locator: "external",
        summary: "Not selected map authority.",
      }],
      edges: model.edges.map(edge => edge.id === "link:goal"
        ? { ...edge, evidenceIds: ["e:foreign"] } : edge),
    };
    const rejected = reconstructAuthoredJourneyCandidates(foreign, reconstructions);
    expect(rejected.candidates.some(item =>
      item.subjectIds.includes("mechanic:start") &&
      item.subjectIds.includes("objective:goal"))).toBe(false);
    // Goal → outcome remains independently source-backed, and is retained.
    expect(rejected.candidates.some(item =>
      item.subjectIds.join(",") === "objective:goal,outcome:win")).toBe(true);
    expect(rejected.candidates.some(item =>
      item.subjectIds.join(",") === "mechanic:start,resource:score")).toBe(true);
  });

  it("splits independently sourced resource-bridge relations rather than fabricating a cross-module player loop", () => {
    const a = "behavior_packs/example/scripts/alpha.js";
    const b = "behavior_packs/example/scripts/beta.js";
    const locators: Record<string, string> = {
      "e:enter": a, "e:score": a, "e:goal": b,
      "e:done": b, "e:write": a, "e:read": b, "e:win": b,
      // One independently shared exact source witness makes the DOWNSTREAM
      // goal -> outcome segment admissible without file-name shortcuts.
      "e:downstream-join": b,
      "ir:call": a, "ir:effect": b,
    };
    const evidence: GameplayIntentModel["evidence"] =
      Object.entries(locators).map(([id, locator]) => ({
        id, locator, summary: id,
        origin: "source-code" as const,
        scope: "selected-artifact" as const,
      }));
    const nodes: GameplayIntentModel["nodes"] = [
      { id: "mechanic:enter", kind: "mechanic",
        label: "Enter", status: "inferred", evidenceIds: ["e:enter"] },
      { id: "resource:shared", kind: "resource",
        label: "Shared counter", status: "authored", evidenceIds: ["e:score"] },
      { id: "objective:goal", kind: "objective",
        label: "Goal", status: "inferred", evidenceIds: ["e:goal"] },
      { id: "outcome:done", kind: "outcome",
        label: "Done", status: "inferred", evidenceIds: ["e:done"] },
    ];
    const intent: GameplayIntentModel = {
      schemaVersion: 1, id: "intent:two-source-joins",
      artifactId: "art:two-source-joins",
      evidence, nodes, invariants: [], unknowns: [],
      edges: [
        { id: "rel:write", from: "mechanic:enter", to: "resource:shared",
          kind: "produces", status: "inferred", evidenceIds: ["e:write"] },
        { id: "rel:read", from: "resource:shared", to: "objective:goal",
          kind: "transitions-to", status: "inferred",
          evidenceIds: ["e:read", "e:downstream-join"] },
        { id: "rel:win", from: "objective:goal", to: "outcome:done",
          kind: "wins-by", status: "inferred",
          evidenceIds: ["e:win", "e:downstream-join"] },
      ],
    };
    const reconstructions: GameplayMechanicReconstruction[] =
      nodes.filter(node => node.kind !== "resource").map(node => ({
        featureId: node.id,
        kind: node.kind as GameplayMechanicReconstruction["kind"],
        name: node.label, meaningStatus: "INFERRED",
        declaredEvidenceIds: [...node.evidenceIds],
        exactSourceFlowIds: [], exactSourceStepIds: [],
        authoredBehaviorRelationIds: [],
        sourceGuardedTransitionCandidateIds: [],
        sourceActivationCandidates: [],
        relations: [], unresolvedDimensions: [],
        runtimeStatus: "NOT_OBSERVED",
      }));
    const unlinked = reconstructAuthoredJourneyCandidates(intent, reconstructions);
    expect(unlinked.truncated).toBe(false);
    expect(unlinked.candidates.some(path =>
      path.subjectIds.join(",") ===
        "mechanic:enter,resource:shared,objective:goal,outcome:done"))
      .toBe(false);
    const upstream = unlinked.candidates.find(path =>
      path.subjectIds.join(",") === "mechanic:enter,resource:shared");
    expect(upstream?.boundary).toBe("SOURCE_JOIN_UNPROVEN");
    expect(upstream?.interpretation?.sourceJoinGap).toMatchObject({
      viaSubjectId: "resource:shared",
      previousRelationId: "rel:write",
      nextRelationId: "rel:read",
      previousSourceLocators: [a],
      nextSourceLocators: [b],
      missingProof: "SHARED_EXACT_SOURCE_FLOW_OR_SAME_SOURCE_WITNESS",
    });
    expect(upstream?.interpretation?.missingUnderstanding)
      .toContain("CROSS_SOURCE_JOIN_UNPROVEN");
    const downstream = unlinked.candidates.find(path =>
      path.subjectIds.join(",") === "resource:shared,objective:goal,outcome:done");
    expect(downstream?.boundary).toBe("OUTCOME_SUBJECT");
    expect(downstream?.runtimeStatus).toBe("NOT_OBSERVED");

    // Two source facts observed on ONE exact IR flow retain a candidate
    // link, but the output still refuses player sequence and runtime proof.
    const sourceBacked: GameplayIntentModel = {
      ...intent, edges: intent.edges.map(edge =>
        edge.id === "rel:write"
          ? { ...edge, evidenceIds: [...edge.evidenceIds, "ir:call"] }
          : edge.id === "rel:read"
            ? { ...edge, evidenceIds: [...edge.evidenceIds, "ir:effect"] }
            : edge),
    };
    const sharedFlow: GameplaySourceFlowCandidate = {
      id: "source-flow:resolved-entry",
      entryRegionId: "event:entry",
      entryKind: "event-source",
      regionIds: ["event:entry", "function:target"],
      executionEdgeIds: ["ir:call"],
      unresolvedExecutionEdgeIds: [], temporalRelationIds: [],
      branchPoints: [],
      sourceSteps: [{
        id: "ir:effect", kind: "state",
        executionRegionId: "function:target",
        source: { artifactId: "art:two-source-joins", relativePath: b },
        operation: "write",
      }],
      authoredBehaviorRelationIds: [],
      sourceOrderScope: "PER_EXECUTION_REGION_ONLY",
      runtimeStatus: "NOT_OBSERVED",
    };
    const withFlow = reconstructAuthoredJourneyCandidates(
      sourceBacked, reconstructions, 128, 12, [sharedFlow]);
    expect(withFlow.candidates.some(path =>
      path.subjectIds.join(",") ===
        "mechanic:enter,resource:shared,objective:goal,outcome:done")).toBe(true);
    expect(withFlow.candidates.every(path =>
      path.runtimeStatus === "NOT_OBSERVED" &&
      path.interpretation?.missingUnderstanding.includes(
        "SOURCE_RELATION_DIRECTION_NOT_PLAY_ORDER"))).toBe(true);

    // One IR trace is a UNION of syntactically reachable alternatives.
    // It must not join a state/action on the TRUE arm to an outcome from
    // the FALSE arm of the same precisely authored guard site.
    const guardSource = { artifactId: "art:two-source-joins",
      relativePath: a, range: {
        lineStart: 10, lineEnd: 10, columnStart: 5, columnEnd: 21,
      } };
    const emptyArm = (branch: "true" | "false") => ({
      branch, executionEdgeIds: [] as string[],
      stateWriteOperationIds: [] as string[],
      returnOutcomeIds: [] as string[],
      resourceActionIds: [] as string[],
      resourceReleaseActionIds: [] as string[],
      worldEffectIds: [] as string[],
      precedenceEvidenceIds: [] as string[],
    });
    const leftArm = { ...emptyArm("true"),
      executionEdgeIds: ["ir:call"] };
    const rightArm = { ...emptyArm("false"),
      stateWriteOperationIds: ["ir:effect"] };
    const opposed: GameplaySourceFlowCandidate = {
      ...sharedFlow,
      branchPoints: [{
        expression: "phase === active", source: guardSource,
        branches: [leftArm, rightArm],
      }],
    };
    const sameFileEvidence: GameplayIntentModel = {
      ...sourceBacked,
      evidence: sourceBacked.evidence.map(item => ({
        ...item, locator: a,
      })),
    };
    const sameFileOpposed: GameplaySourceFlowCandidate = {
      ...opposed,
      sourceSteps: opposed.sourceSteps.map(step => ({
        ...step, source: { ...step.source, relativePath: a },
      })),
    };
    const contradictory = reconstructAuthoredJourneyCandidates(
      sameFileEvidence, reconstructions, 128, 12, [sameFileOpposed]);
    expect(contradictory.candidates.some(path =>
      path.subjectIds.join(",") ===
        "mechanic:enter,resource:shared,objective:goal,outcome:done")).toBe(false);
    const stopped = contradictory.candidates.find(path =>
      path.subjectIds.join(",") === "mechanic:enter,resource:shared");
    expect(stopped?.boundary).toBe("SOURCE_JOIN_UNPROVEN");
    expect(stopped?.interpretation?.sourceJoinGap?.missingProof)
      .toBe("OPPOSITE_AUTHORED_BRANCH_ARMS");
    expect(stopped?.interpretation?.sourceJoinGap?.previousSourceLocators)
      .toEqual([a]);
    expect(stopped?.interpretation?.sourceJoinGap?.nextSourceLocators)
      .toEqual([a]);

    // A coarse source trace cannot cancel the more precise opposite-arm
    // source counterexample from a second observation of the same source.
    const mixed = reconstructAuthoredJourneyCandidates(
      sameFileEvidence, reconstructions, 128, 12,
      [sharedFlow, sameFileOpposed]);
    expect(mixed.candidates.some(path =>
      path.subjectIds.join(",") ===
        "mechanic:enter,resource:shared,objective:goal,outcome:done"))
      .toBe(false);
    expect(mixed.candidates.find(path =>
      path.subjectIds.join(",") ===
        "mechanic:enter,resource:shared")
      ?.interpretation?.sourceJoinGap?.missingProof)
      .toBe("OPPOSITE_AUTHORED_BRANCH_ARMS");

    // Two exact IR facts in the SAME arm may remain a source candidate,
    // even while live branch satisfaction and actual value-flow are UNKNOWN.
    const sameArm: GameplaySourceFlowCandidate = {
      ...sameFileOpposed,
      branchPoints: [{
        expression: "phase === active", source: guardSource,
        branches: [{
          ...leftArm, stateWriteOperationIds: ["ir:effect"],
        }, { ...rightArm, stateWriteOperationIds: [] }],
      }],
    };
    const compatible = reconstructAuthoredJourneyCandidates(
      sameFileEvidence, reconstructions, 128, 12, [sameArm]);
    expect(compatible.candidates.some(path =>
      path.subjectIds.join(",") ===
        "mechanic:enter,resource:shared,objective:goal,outcome:done")).toBe(true);
    expect(compatible.candidates.every(path =>
      path.runtimeStatus === "NOT_OBSERVED")).toBe(true);

    // Without an explicitly selected artifact ID, an arbitrary trace from
    // an otherwise matching external world is NOT a current-map join proof.
    const { artifactId: _unselectedArtifact, ...unknownArtifact } = sourceBacked;
    // Absence of a selected artifact is not the same as an explicitly
    // present property whose value is undefined.
    const missingArtifact = reconstructAuthoredJourneyCandidates(
      unknownArtifact, reconstructions, 128, 12, [sharedFlow]);
    expect(missingArtifact.candidates.some(path =>
      path.subjectIds.join(",") ===
        "mechanic:enter,resource:shared,objective:goal,outcome:done")).toBe(false);

    // Unresolved edges and foreign-artifact flows never bridge the source.
    for (const rejectedFlow of [
      { ...sharedFlow, unresolvedExecutionEdgeIds: ["ir:call"] },
      { ...sharedFlow, sourceSteps: sharedFlow.sourceSteps.map(step => ({
        ...step, source: { ...step.source, artifactId: "other-artifact" },
      })) },
    ]) {
      const blocked = reconstructAuthoredJourneyCandidates(
        sourceBacked, reconstructions, 128, 12, [rejectedFlow]);
      expect(blocked.candidates.some(path =>
        path.subjectIds.includes("mechanic:enter") &&
        path.subjectIds.includes("objective:goal"))).toBe(false);
    }

    // A cycle with only ungrounded cross-source joins must terminate at
    // the bounded source segments; do not enqueue the same join forever.
    const cyclic = { ...intent, edges: [
      intent.edges[0]!,
      { id: "rel:back", from: "resource:shared", to: "mechanic:enter",
        kind: "recovers-to" as const,
        status: "inferred" as const, evidenceIds: ["e:read"] },
    ] };
    const bounded = reconstructAuthoredJourneyCandidates(cyclic, reconstructions);
    expect(bounded.truncated).toBe(false);
    expect(bounded.candidates).toHaveLength(2);
    expect(bounded.candidates.every(path =>
      path.boundary === "SOURCE_JOIN_UNPROVEN")).toBe(true);
  });

});
