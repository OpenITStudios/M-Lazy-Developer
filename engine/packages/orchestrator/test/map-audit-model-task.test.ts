import { describe, expect, it } from "vitest";
import type { GameplayIntentModel } from "../../../packages/gameplay-intent/src/index.js";
import type { MandatoryAuditCheckpointReceipt } from "../src/inspection/mandatory-audit-procedure.js";
import {
  deriveAuditModelKnowledgeLookup,
  selectCheckpointIntentSubjects,
} from "../src/map-audit-model-task.js";
import {
  compileDeveloperPracticeReferenceContext,
} from "../src/workflow/resource-context.js";

describe("source-scoped UNDERSTAND checkpoint navigation", () => {
  const path = "behavior_packs/arena/scripts/round.ts";
  const intent: GameplayIntentModel = {
    schemaVersion: 1,
    id: "intent:selected",
    artifactId: "selected",
    evidence: [{
      id: "ev:phase", origin: "source-code", scope: "selected-artifact",
      locator: path + ":13:3", summary: "Authored round phase",
    }, {
      id: "ev:state", origin: "source-code", scope: "selected-artifact",
      locator: path + ":14:3", summary: "Dynamic property state",
    }, {
      id: "ev:actor", origin: "source-code", scope: "selected-artifact",
      locator: "behavior_packs/arena/scripts/actor.ts:6:2",
      summary: "Authored arena actor",
    }, {
      id: "ev:external", origin: "historical-diff", scope: "external-reference",
      locator: "previous-map/round.ts:1", summary: "Older map",
    }],
    nodes: [{
      id: "phase:ready", kind: "phase", label: "Active round",
      status: "authored", evidenceIds: ["ev:phase"],
    }, {
      id: "state:round", kind: "state", label: "Round persistent state",
      status: "authored", evidenceIds: ["ev:state"],
    }, {
      id: "actor:keeper", kind: "actor", label: "Arena keeper",
      status: "inferred", evidenceIds: ["ev:actor"],
    }, {
      id: "phase:old", kind: "phase", label: "Old round state",
      status: "authored", evidenceIds: ["ev:external"],
    }, {
      id: "phase:guess", kind: "phase", label: "Imagined round",
      status: "hypothesis", evidenceIds: ["ev:phase"],
    }],
    edges: [], invariants: [],
    unknowns: [{
      id: "unknown:state-owner", question: "Who owns round state?",
      blockedSubjectIds: ["state:round"], evidenceIds: ["ev:state"],
    }],
  };
  const checkpoint = (
    id: string,
    evidenceIds: readonly string[] = [],
    block: MandatoryAuditCheckpointReceipt["block"] = "UNDERSTAND",
    blocksPublication = true,
  ): MandatoryAuditCheckpointReceipt => ({
    id, block, label: "Scoped blocker", status: "OPEN",
    reasonCode: "OBLIGATION_INCOMPLETE", blocksPublication,
    evidenceIds, outputIds: [], obligations: [],
    reason: "Missing source-grounded interpretation",
  });

  it("routes A3-A6 only through selected-source subject kinds, with explicit provenance", () => {
    expect(selectCheckpointIntentSubjects(checkpoint("A3"), intent)).toEqual({
      subjectIds: ["phase:ready"],
      basis: "SOURCE_ROLE_CANDIDATE",
      omittedCandidates: 0,
    });
    const a4 = selectCheckpointIntentSubjects(checkpoint("A4"), intent);
    expect(a4.subjectIds).toEqual(["state:round"]);
    expect(a4.basis).toBe("SOURCE_ROLE_CANDIDATE");
    expect(selectCheckpointIntentSubjects(checkpoint("A5"), intent)
      .subjectIds).toEqual(["state:round", "actor:keeper"]);
    expect(selectCheckpointIntentSubjects(
      checkpoint("A4", ["ev:state"]), intent,
    ).basis).toBe("CHECKPOINT_EVIDENCE_LINK");
  });

  it("routes A7 only through exact source/unknown proof, never the full map", () => {
    expect(selectCheckpointIntentSubjects(checkpoint("A7"), intent)
      .subjectIds).toEqual([]);
    expect(selectCheckpointIntentSubjects(
      checkpoint("A7", ["unknown:state-owner"]), intent,
    )).toMatchObject({
      subjectIds: ["state:round"],
      basis: "CHECKPOINT_EVIDENCE_LINK",
    });
    expect(selectCheckpointIntentSubjects(
      checkpoint("A4", [], "DISCOVERY"), intent,
    ).subjectIds).toEqual([]);
    expect(selectCheckpointIntentSubjects(
      checkpoint("A4", [], "UNDERSTAND", false), intent,
    ).subjectIds).toEqual([]);
  });

  it("passes a checkpoint source candidate to typed IR-based developer retrieval", () => {
    const selection = selectCheckpointIntentSubjects(
      checkpoint("A4"), intent,
    );
    const lookup = deriveAuditModelKnowledgeLookup(
      intent, "Resolve persistent round state ownership", selection.subjectIds,
    );
    expect(lookup?.grounding).toBe("SELECTED_ARTIFACT");
    expect(lookup?.sourceEvidenceIds).toContain("ev:state");
    const data = {
      authority: "REFERENCE" as const,
      usagePolicy: "CONTEXT_HINT_ONLY_NOT_GAME_DESIGN_OR_DEFECT_PROOF" as const,
      sourceSnapshot: { archiveSha256: "a".repeat(64) },
      sourceFiles: [{
        id: "src.bedrock-data-persistence",
        path: "skills/bedrock-data-persistence/SKILL.md",
        sha256: "b".repeat(64),
        auditUsage: "INTERPRETATION_CANDIDATE",
      }],
      patterns: [{
        id: "developer.hint.persistence.state-ownership",
        sourceId: "src.bedrock-data-persistence",
        kind: "IMPLEMENTATION_PATTERN", status: "SOURCE_REVIEWED",
        domains: ["state", "persistence"],
        sourceSignals: ["getDynamicProperty"],
        question: "Who owns the selected-map state?",
        candidateRelations: ["read/state-owner"],
        negativeControl: "An intentional world-scope key may be correct.",
        versionApplicability: "NOT_EVALUATED",
        prohibits: "Do not infer broken persistence from a read call.",
      }],
    };
    const ir = {
      schemaVersion: 1 as const,
      execution: { regions: [], edges: [] },
      state: {
        surfaces: [{
          id: "surface:round",
          ref: { kind: "dynamic-property" as const, key: "round" },
        }],
        operations: [{
          id: "state-op:round",
          executionRegionId: "exec:read",
          surfaceId: "surface:round",
          operation: "read" as const,
          source: { artifactId: "selected", relativePath: path },
        }],
        authorityBindings: [],
      },
      temporal: { relations: [] },
    };
    const guidance = compileDeveloperPracticeReferenceContext({
      data, selectedArtifactId: "selected",
      semanticIr: ir,
      domains: ["state", "persistence"],
      sourceLocators: lookup?.sourceLocators,
    });
    expect(guidance?.items.map(item => item.patternId)).toEqual([
      "developer.hint.persistence.state-ownership",
    ]);
    expect(guidance?.items[0]?.matchingEvidenceIds).toContain("state-op:round");
    expect(compileDeveloperPracticeReferenceContext({
      data, selectedArtifactId: "another-artifact",
      semanticIr: ir, domains: ["state"],
      sourceLocators: lookup?.sourceLocators,
    })?.items ?? []).toHaveLength(0);
    expect(compileDeveloperPracticeReferenceContext({
      data, selectedArtifactId: "selected",
      semanticIr: ir, domains: ["state"],
      sourceLocators: ["behavior_packs/other/scripts/main.ts:1"],
    })?.items ?? []).toHaveLength(0);
  });
});
