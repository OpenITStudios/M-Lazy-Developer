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
         !/^.+#L[1-9][0-9]*$/.test(evidence.locator) ||
         (evidence.playerFacingText.pack !== undefined &&
           (!evidence.playerFacingText.pack.root.trim() ||
            !evidence.locator.replaceAll("\\", "/").startsWith(
              evidence.playerFacingText.pack.root.replaceAll("\\", "/").replace(/\/$/, "") + "/") ||
            !["listed", "not-listed", "unknown"].includes(
              evidence.playerFacingText.pack.worldAttachment))))) {
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
         (evidence.literalTranslationUse.authoredUiSendCall !== undefined &&
           (evidence.literalTranslationUse.executionRegionId === undefined ||
            !evidence.literalTranslationUse.authoredUiSendCall.apiCallEvidenceId.startsWith("api-call:") ||
            !/:[1-9][0-9]*:[1-9][0-9]*$/.test(
              evidence.literalTranslationUse.authoredUiSendCall.sourceLocator) ||
            evidence.literalTranslationUse.authoredUiSendCall.proof !==
              "EXACT_SOURCE_ARGUMENT_TO_TYPED_UI_CALL_NOT_DELIVERY" ||
            !((["Player", "World"].includes(
              evidence.literalTranslationUse.authoredUiSendCall.receiverType) &&
              evidence.literalTranslationUse.authoredUiSendCall.method === "sendMessage") ||
              (evidence.literalTranslationUse.authoredUiSendCall.receiverType === "ScreenDisplay" &&
               ["setTitle", "setActionBar"].includes(
                 evidence.literalTranslationUse.authoredUiSendCall.method))))) ||
         (evidence.literalTranslationUse.executionRegionId !== undefined &&
          !evidence.literalTranslationUse.executionRegionId.startsWith("exec:script:")) ||
         evidence.literalTranslationUse.sourceConditions?.some(condition =>
           !condition.condition.trim() || !condition.sourceLocator.trim() ||
           (condition.kind !== "lexical" && condition.kind !== "precedence")) ||
         !/:[1-9][0-9]*:[1-9][0-9]*$/.test(evidence.locator))) {
      issues.push({
        path: "evidence." + evidence.id + ".literalTranslationUse",
        message: "A script translation reference must have an exact selected-artifact literal source site; it is not player-facing gameplay proof.",
      });
    }
  }

  // A source-root trace is never a proof of actual callback firing. Reject
  // malformed or promoted guard/path declarations while retaining old
  // source-only fixture contracts that do not carry these optional fields.
  for (const item of model.evidence) {
    const call = item.literalTranslationUse?.authoredUiSendCall;
    if (call === undefined) continue;
    const guardsValid = (call.callGuards ?? []).every(guard =>
      guard.expression.trim().length > 0 &&
      /:[1-9][0-9]*:[1-9][0-9]*$/.test(guard.locator) &&
      (guard.kind === "lexical" || guard.kind === "precedence") &&
      (guard.branch === "true" || guard.branch === "false"));
    const activation = call.sourceActivation;
    const activationValid = activation === undefined ||
      (activation.proof === "SOURCE_ROOTED_IR_PATH_NOT_RUNTIME_EXECUTION" &&
       ["MANIFEST_SOURCE_ROOTS_UNVERIFIED", "SOURCE_ROOTED_PATH_CANDIDATE",
        "NO_ADMITTED_SOURCE_ROOT_PATH", "SOURCE_PATH_SEARCH_BOUNDED"]
         .includes(activation.status) &&
       Number.isSafeInteger(activation.unresolvedEntryCandidates) &&
       activation.unresolvedEntryCandidates >= 0 &&
       (activation.status === "SOURCE_ROOTED_PATH_CANDIDATE") ===
         (activation.sourcePaths.length > 0) &&
       activation.sourcePaths.every(path =>
         path.entryRegionId.trim().length > 0 &&
         path.executionEdgeIds.every(id => id.trim().length > 0) &&
         path.edgeGuards.every(guard =>
           path.executionEdgeIds.includes(guard.edgeId) &&
           guard.expression.trim().length > 0 &&
           /:[1-9][0-9]*:[1-9][0-9]*$/.test(guard.locator) &&
           (guard.kind === "lexical" || guard.kind === "precedence") &&
           (guard.branch === "true" || guard.branch === "false"))));
    if (!guardsValid || !activationValid ||
        (call.receiverInference !== undefined &&
         call.receiverInference !== "direct" &&
         call.receiverInference !== "bounded")) {
      issues.push({
        path: "evidence." + item.id + ".literalTranslationUse.authoredUiSendCall",
        message: "Source UI call guards and entry paths must be exact, bounded and explicitly non-runtime evidence.",
      });
    }
  }

  // A reported typed UI call must have its own exact current-map source
  // witness, not just a self-referential ID inside the translation literal.
  for (const item of model.evidence) {
    const witness = item.literalTranslationUse?.authoredUiSendCall;
    if (witness === undefined) continue;
    const matches = model.evidence.filter(candidate =>
      candidate.id === witness.apiCallEvidenceId &&
      candidate.origin === "source-code" &&
      candidate.scope === "selected-artifact" &&
      candidate.locator === witness.sourceLocator);
    if (matches.length !== 1) {
      issues.push({
        path: "evidence." + item.id + ".literalTranslationUse.authoredUiSendCall",
        message: "Typed UI send attempt requires a unique source evidence site in this selected artifact.",
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
    const sourceRelationKeys = new Set<string>();
    for (const relation of unknown.sourceRelations ?? []) {
      const key = [relation.sourceClaim, relation.fromStepId, relation.toStepId].join("\u0000");
      const pair = [relation.fromStepId, relation.toStepId];
      const evidence = [...new Set(relation.evidenceIds)].sort();
      if (sourceRelationKeys.has(key) ||
          !unknown.sourceEntryRegionId?.trim() ||
          relation.proofBoundary !==
            "REVIEWED_TYPED_SOURCE_RELATION_NOT_GAMEPLAY_OR_RUNTIME_PROOF" ||
          !([
            "SOURCE_GUARD_VALUE_HANDOFF_CANDIDATE",
            "SOURCE_EFFECT_RETURN_CANDIDATE",
          ] as readonly string[]).includes(relation.sourceClaim) ||
          pair.some(id => !id?.trim() ||
            !unknown.evidenceIds?.includes(id) ||
            model.evidence.filter(item => item.id === id &&
              item.origin === "source-code" &&
              item.scope === "selected-artifact" &&
              item.locator.trim().length > 0).length !== 1) ||
          pair[0] === pair[1] ||
          evidence.length !== 2 ||
          !pair.every(id => evidence.includes(id))) {
        issues.push({
          path: "unknowns." + unknown.id + ".sourceRelations",
          message: "Reviewed source relation needs distinct, selected-source-owned operation evidence and a unique unknown entry.",
        });
      }
      sourceRelationKeys.add(key);
    }
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
