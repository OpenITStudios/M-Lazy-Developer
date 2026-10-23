import type {
  GameplayIntentModel,
} from "./types.js";

export interface GameplayIntentValidationIssue {
  path: string;
  message: string;
}

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated].sort();
}

export function validateGameplayIntentModel(
  model: GameplayIntentModel,
): GameplayIntentValidationIssue[] {
  const issues: GameplayIntentValidationIssue[] = [];

  if (model.schemaVersion !== 1) {
    issues.push({
      path: "schemaVersion",
      message: "Unsupported Gameplay Intent schema version.",
    });
  }

  for (const [path, values] of [
    ["evidence", model.evidence.map((item) => item.id)],
    ["nodes", model.nodes.map((item) => item.id)],
    ["edges", model.edges.map((item) => item.id)],
    ["invariants", model.invariants.map((item) => item.id)],
    ["unknowns", model.unknowns.map((item) => item.id)],
  ] as const) {
    for (const id of duplicates(values)) {
      issues.push({
        path,
        message: `Duplicate identifier: ${id}.`,
      });
    }
  }

  for (const evidence of model.evidence) {
    if (evidence.designStatus !== undefined &&
        (evidence.origin !== "game-design-spec" ||
         evidence.scope !== "selected-artifact")) {
      issues.push({
        path: "evidence." + evidence.id + ".designStatus",
        message: "Design approval is only valid on selected-artifact game-design-spec evidence.",
      });
    }
  }

  for (const evidence of model.evidence) {
    if (evidence.playerFacingText !== undefined &&
        (evidence.origin !== "translation" ||
         evidence.scope !== "selected-artifact" ||
         !evidence.playerFacingText.key.trim() ||
         !evidence.playerFacingText.text.trim() ||
         !/^.+#L[1-9][0-9]*$/.test(evidence.locator))) {
      issues.push({
        path: "evidence." + evidence.id + ".playerFacingText",
        message: "Literal player-facing copy must be a line-located selected-artifact translation, never approved design.",
      });
    }
  }

  for (const evidence of model.evidence) {
    if (evidence.literalTranslationUse !== undefined &&
        (evidence.origin !== "source-code" ||
         evidence.scope !== "selected-artifact" ||
         !evidence.literalTranslationUse.key.trim() ||
         !evidence.literalTranslationUse.executionRegion.trim() ||
         evidence.literalTranslationUse.syntax !== "translate-object-literal" ||
         !/:[1-9][0-9]*:[1-9][0-9]*$/.test(evidence.locator))) {
      issues.push({
        path: "evidence." + evidence.id + ".literalTranslationUse",
        message: "A script translation reference must have an exact selected-artifact literal source site; it is not player-facing gameplay proof.",
      });
    }
  }

  const nodeIds = new Set(model.nodes.map((node) => node.id));
  const evidenceIds = new Set(
    model.evidence.map((evidence) => evidence.id),
  );

  const validateEvidenceRefs = (
    path: string,
    ids: readonly string[],
  ) => {
    if (ids.length === 0) {
      issues.push({
        path,
        message: "Semantic intent claims require evidence binding.",
      });
    }
    for (const id of ids) {
      if (!evidenceIds.has(id)) {
        issues.push({
          path,
          message: `Unknown evidence reference: ${id}.`,
        });
      }
    }
  };

  for (const node of model.nodes) {
    validateEvidenceRefs(
      `nodes.${node.id}.evidenceIds`,
      node.evidenceIds,
    );

    if (
      node.policyPredicate !== undefined &&
      node.kind !== "policy"
    ) {
      issues.push({
        path: `nodes.${node.id}.policyPredicate`,
        message:
          "Policy predicates are valid only on policy intent nodes.",
      });
    }

    if (
      node.spatialProfile !== undefined &&
      node.kind !== "spatial-region"
    ) {
      issues.push({
        path: `nodes.${node.id}.spatialProfile`,
        message:
          "Spatial profiles are valid only on spatial-region intent nodes.",
      });
    }

    if (
      node.spatialProfile !== undefined &&
      node.spatialProfile.points.length === 0
    ) {
      issues.push({
        path: `nodes.${node.id}.spatialProfile.points`,
        message:
          "Spatial route profiles require at least one point.",
      });
    }

    if (
      node.spatialProfile?.contextSeries !== undefined
    ) {
      if (
        node.spatialProfile.coordinateSpace !== "local" ||
        node.spatialProfile.transform?.kind !== "offset"
      ) {
        issues.push({
          path:
            `nodes.${node.id}.spatialProfile.contextSeries`,
          message:
            "Spatial context series requires a proven local offset transform.",
        });
      } else if (
        node.spatialProfile.contextSeries.offsetPath !==
        node.spatialProfile.transform.offsetPath
      ) {
        issues.push({
          path:
            `nodes.${node.id}.spatialProfile.contextSeries.offsetPath`,
          message:
            "Spatial context series offsetPath must match the proven transform offsetPath.",
        });
      }
    }
  }

  for (const edge of model.edges) {
    if (!nodeIds.has(edge.from)) {
      issues.push({
        path: `edges.${edge.id}.from`,
        message: `Unknown source node: ${edge.from}.`,
      });
    }
    if (!nodeIds.has(edge.to)) {
      issues.push({
        path: `edges.${edge.id}.to`,
        message: `Unknown target node: ${edge.to}.`,
      });
    }
    validateEvidenceRefs(
      `edges.${edge.id}.evidenceIds`,
      edge.evidenceIds,
    );
  }

  for (const invariant of model.invariants) {
    if (invariant.subjectIds.length === 0) {
      issues.push({
        path: `invariants.${invariant.id}.subjectIds`,
        message: "Invariant must reference at least one intent subject.",
      });
    }
    for (const subjectId of invariant.subjectIds) {
      if (!nodeIds.has(subjectId)) {
        issues.push({
          path: `invariants.${invariant.id}.subjectIds`,
          message: `Unknown intent subject: ${subjectId}.`,
        });
      }
    }
    validateEvidenceRefs(
      `invariants.${invariant.id}.evidenceIds`,
      invariant.evidenceIds,
    );
  }

  for (const unknown of model.unknowns) {
    for (const subjectId of unknown.blockedSubjectIds) {
      if (!nodeIds.has(subjectId)) {
        issues.push({
          path: `unknowns.${unknown.id}.blockedSubjectIds`,
          message: `Unknown blocked intent subject: ${subjectId}.`,
        });
      }
    }
    for (const evidenceId of unknown.evidenceIds ?? []) {
      if (!evidenceIds.has(evidenceId)) {
        issues.push({
          path: `unknowns.${unknown.id}.evidenceIds`,
          message: `Unknown evidence reference: ${evidenceId}.`,
        });
      }
    }
  }

  return issues;
}
