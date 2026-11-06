import type {
  CrossDomainEvidenceObservation,
} from "../../../diagnostic-reasoning/src/index.js";
import type {
  RuntimeProbeTranscript,
} from "../../../project-model/src/index.js";
import type {
  CausalLinkHypothesisConstruction,
} from "./causal-link-hypothesis-construction.js";
import type {
  GameplayDefectResolution,
} from "../inspection/gameplay-defect-resolution.js";
import {
  uniqueGameplayCausalLinkScope,
  type GameplayScenarioGraph,
} from "../inspection/gameplay-scenario-model.js";
import {
  uniqueScenarioKnowledgeRequirement,
  satisfiedScenarioKnowledgeReceipt,
} from "../inspection/gameplay-scenario-knowledge.js";
import type { RuntimeScope } from "../../../project-model/src/index.js";
import { assessRuntimeGenerationIntegrity } from "./runtime-generation-integrity.js";

/** Transient provenance: derived observation IDs need original source links. */
export interface CausalLinkEvidenceObservation extends CrossDomainEvidenceObservation {
  readonly sourceEvidenceIds: readonly string[];
}

function evidenceId(prefix: string, ids: readonly string[]): string {
  return prefix + ":" + ids.slice().sort().join("+");
}

export function constructCausalLinkEvidence(input: {
  graph: GameplayScenarioGraph;
  resolution: GameplayDefectResolution;
  construction: CausalLinkHypothesisConstruction;
  runtimeProbeTranscript?: RuntimeProbeTranscript;
  expectedArtifactId?: string;
  expectedRuntimeScope?: RuntimeScope;
}): CausalLinkEvidenceObservation[] {
  const scope = uniqueGameplayCausalLinkScope(
    input.graph, input.construction.causalLinkId,
  );
  if (scope === undefined ||
      (input.resolution.scenarioId !== undefined &&
       input.resolution.scenarioId !== scope.scenario.id)) return [];
  const { link, scenario } = scope;

  const output: CausalLinkEvidenceObservation[] = [];
  const contradictionPredicate =
    "causal-link:" + link.id + ":contradiction:none";
  output.push({
    predicate: contradictionPredicate,
    state: link.status === "CONTRADICTED"
      ? "present"
      : link.status === "PROVEN"
        ? "absent"
        : "unknown",
    evidenceId: evidenceId(
      "causal-link",
      link.evidenceIds.length > 0 ? link.evidenceIds : [link.id],
    ),
    domain: "static",
    sourceEvidenceIds: link.evidenceIds,
  });

  if (link.impactPathComponentIds.length > 0) {
    output.push({
      predicate:
        "causal-link:" + link.id + ":impact-path:none",
      state:
        link.impactPathEvidenceIds.length > 0
          ? "present"
          : "unknown",
      evidenceId: evidenceId(
        "impact-path",
        link.impactPathEvidenceIds.length > 0
          ? link.impactPathEvidenceIds
          : [link.id],
      ),
      domain: "static",
      sourceEvidenceIds: link.impactPathEvidenceIds,
    });
  }

  for (const requirementId of [...new Set(link.knowledgeRequirementIds)]) {
    const owner = uniqueScenarioKnowledgeRequirement(
      input.graph, requirementId, scenario.id,
    );
    // An explicit negative result has meaning only with one exact owner.
    // Foreign, duplicated, or evidence-less satisfied receipts are UNKNOWN.
    const candidates = input.graph.knowledgeReceipts.filter(
      (item) => item.requirementId === requirementId,
    );
    const ownedReceipt = owner !== undefined && candidates.length === 1 &&
        candidates[0]?.scenarioId === scenario.id &&
        candidates[0]?.domain === owner.domain
      ? candidates[0] : undefined;
    const satisfied = owner === undefined ? undefined :
      satisfiedScenarioKnowledgeReceipt(input.graph, owner);
    const predicate = "causal-link:" + link.id + ":knowledge:" +
      requirementId;
    output.push({
      predicate,
      state: satisfied !== undefined ? "present" :
        ownedReceipt !== undefined && ownedReceipt.status !== "SATISFIED"
          ? "absent" : "unknown",
      evidenceId: evidenceId(
        "knowledge-receipt",
        ownedReceipt?.evidenceIds.length
          ? ownedReceipt.evidenceIds
          : [requirementId],
      ),
      domain: "knowledge",
      sourceEvidenceIds: ownedReceipt?.evidenceIds ?? [],
    });

    // Only a uniquely SATISFIED canonical receipt can contribute extra
    // Knowledge predicates, never a foreign or missing-source record.
    for (const knowledgeId of satisfied?.knowledgeIds ?? []) {
      output.push({
        predicate: "causal-link:" + link.id + ":knowledge:" +
          knowledgeId,
        state: "present",
        evidenceId: evidenceId(
          "knowledge-record",
          satisfied?.evidenceIds.length
            ? satisfied.evidenceIds
            : [knowledgeId],
        ),
        domain: "knowledge",
        sourceEvidenceIds: satisfied?.evidenceIds ?? [],
      });
    }
  }

  const counterProofIds = [
    ...(input.resolution.counterProofEvidenceIds ?? []),
    ...(input.resolution.counterProofSearch?.conclusion === "BLOCKING_PROOF_FOUND"
      ? input.resolution.counterProofSearch.evidenceIds
      : []),
  ].filter((value, index, all) => all.indexOf(value) === index);

  output.push({
    predicate: "causal-link:" + link.id + ":counterproof:none",
    state: counterProofIds.length > 0 ? "present" : "absent",
    evidenceId: evidenceId(
      "counterproof",
      counterProofIds.length > 0 ? counterProofIds : [link.id],
    ),
    domain: "static",
    sourceEvidenceIds: counterProofIds,
  });

  const runtimePredicate =
    "causal-link:" + link.id + ":runtime:none";
  if (
    input.construction.requiredPredicateIds.includes(runtimePredicate)
  ) {
    const transcriptArtifactMismatch =
      input.runtimeProbeTranscript?.artifactId !== undefined &&
      input.expectedArtifactId !== undefined &&
      input.runtimeProbeTranscript.artifactId !== input.expectedArtifactId;
    const exchanges = transcriptArtifactMismatch
      ? []
      : input.runtimeProbeTranscript?.exchanges.filter(
          (exchange) =>
            exchange.request.incidentId === link.id &&
            exchange.request.predicate === runtimePredicate &&
            exchange.response.ok &&
            exchange.response.evidence.proofAuthority === "live-runtime" &&
            assessRuntimeGenerationIntegrity(
              exchange,
              input.expectedRuntimeScope,
            ).status !== "STALE",
        ) ?? [];
    if (exchanges.length === 0) {
      output.push({
        predicate: runtimePredicate,
        state: "unknown",
        evidenceId: transcriptArtifactMismatch
          ? "runtime-artifact-mismatch:" + link.id
          : "runtime-unobserved:" + link.id,
        domain: "runtime",
        sourceEvidenceIds: [],
      });
    } else {
      const decisiveStates = [...new Set(
        exchanges.map((exchange) => exchange.response.state)
          .filter((state) => state !== "unknown"),
      )];
      const state =
        decisiveStates.length === 1
          ? decisiveStates[0]!
          : "unknown";
      output.push({
        predicate: runtimePredicate,
        state,
        evidenceId: evidenceId(
          decisiveStates.length > 1
            ? "runtime-conflict"
            : "runtime-probe",
          exchanges.map((exchange) =>
            exchange.response.requestId
          ),
        ),
        domain: "runtime",
        sourceEvidenceIds: [],
      });
    }
  }

  return output;
}
