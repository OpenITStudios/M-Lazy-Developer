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
import type {
  GameplayScenarioGraph,
} from "../inspection/gameplay-scenario-model.js";
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
  const link = input.graph.causalLinks.find(
    (item) => item.id === input.construction.causalLinkId,
  );
  if (!link) return [];

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

  for (const requirementId of link.knowledgeRequirementIds) {
    const receipt = input.graph.knowledgeReceipts.find(
      (item) => item.requirementId === requirementId,
    );
    const predicate =
      "causal-link:" + link.id + ":knowledge:" +
      requirementId;
    output.push({
      predicate,
      state:
        receipt?.status === "SATISFIED"
          ? "present"
          : receipt === undefined
            ? "unknown"
            : "absent",
      evidenceId: evidenceId(
        "knowledge-receipt",
        receipt?.evidenceIds.length
          ? receipt.evidenceIds
          : [requirementId],
      ),
      domain: "knowledge",
      sourceEvidenceIds: receipt?.evidenceIds ?? [],
    });

    for (const knowledgeId of receipt?.knowledgeIds ?? []) {
      output.push({
        predicate:
          "causal-link:" + link.id + ":knowledge:" +
          knowledgeId,
        state:
          receipt?.status === "SATISFIED"
            ? "present"
            : "absent",
        evidenceId: evidenceId(
          "knowledge-record",
          receipt?.evidenceIds.length
            ? receipt.evidenceIds
            : [knowledgeId],
        ),
        domain: "knowledge",
        sourceEvidenceIds: receipt?.evidenceIds ?? [],
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
