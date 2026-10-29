import type {
  GameplayIntentEvidence,
  GameplayIntentModel,
  GameplayIntentStatus,
  type GameplayIntentSourceRelation,
} from "./types.js";

export type DesignIntentChallengeDisposition =
  | "grounded-design"
  | "design-claim"
  | "player-facing-claim"
  | "implementation-only"
  | "ambiguous";

export interface DesignIntentChallengeInput {
  readonly implementationEvidenceIds: readonly string[];
  readonly independentDesignEvidenceIds: readonly string[];
  readonly playerFacingEvidenceIds?: readonly string[];
  /** Evidence IDs without selected-artifact provenance never establish intent. */
  readonly evidence?: readonly GameplayIntentEvidence[];
  readonly status?: GameplayIntentStatus;
}

export interface DesignIntentChallengeResult {
  readonly disposition: DesignIntentChallengeDisposition;
  readonly reasons: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly implementationEvidenceIds: readonly string[];
  readonly designEvidenceIds: readonly string[];
  readonly designClaimEvidenceIds: readonly string[];
  readonly playerFacingEvidenceIds: readonly string[];
}

export function isSelectedArtifactDesignClaimEvidence(
  evidence: GameplayIntentEvidence | undefined,
): evidence is GameplayIntentEvidence {
  return evidence?.scope === "selected-artifact" &&
    evidence.origin === "game-design-spec" &&
    evidence.locator.trim().length > 0;
}

export function isSelectedArtifactApprovedDesignEvidence(
  evidence: GameplayIntentEvidence | undefined,
): evidence is GameplayIntentEvidence {
  return isSelectedArtifactDesignClaimEvidence(evidence) &&
    evidence.designStatus === "approved";
}

/** Text/dialogue is a presentation claim, not proof of delivered gameplay. */
export function isSelectedArtifactPlayerFacingClaimEvidence(
  evidence: GameplayIntentEvidence | undefined,
): evidence is GameplayIntentEvidence {
  return evidence?.scope === "selected-artifact" &&
    (evidence.origin === "dialogue" ||
      evidence.origin === "translation") &&
    evidence.locator.trim().length > 0;
}

/** Distinct evidence IDs or source names alone do not prove independence. */
export function hasIndependentApprovedDesignEvidence(
  evidence: readonly (GameplayIntentEvidence | undefined)[],
): boolean {
  const technicalLocations = new Set(evidence.filter(
    (item): item is GameplayIntentEvidence =>
      item?.scope === "selected-artifact" &&
      !isSelectedArtifactDesignClaimEvidence(item) &&
      !isSelectedArtifactPlayerFacingClaimEvidence(item),
  ).map(item => item.locator.trim()).filter(Boolean));
  return evidence.some(item =>
    isSelectedArtifactApprovedDesignEvidence(item) &&
    !technicalLocations.has(item.locator.trim()));
}

/**
 * Source-implemented behavior, approved design, draft specification and
 * player-facing promises have distinct authority. A scoreboard/command/world
 * DB entry never becomes a player-facing rule. Same-site IDs cannot masquerade
 * as two independent witnesses. All technical operations remain available to
 * Semantic IR and existing counterproof; no new graph or detector is created.
 */
export function challengeDesignIntent(
  input: DesignIntentChallengeInput,
): DesignIntentChallengeResult {
  const catalogue = new Map((input.evidence ?? [])
    .filter(item => item.scope === "selected-artifact")
    .map(item => [item.id, item] as const));
  const suppliedImplementation = new Set(input.implementationEvidenceIds);
  const implementation = [...suppliedImplementation].filter(id => {
    const item = catalogue.get(id);
    return item !== undefined && item.locator.trim().length > 0 &&
      !isSelectedArtifactDesignClaimEvidence(item) &&
      !isSelectedArtifactPlayerFacingClaimEvidence(item);
  }).sort();
  const implementationLocations = new Set(implementation
    .map(id => catalogue.get(id)!.locator.trim()));

  const independent = (
    ids: readonly string[],
    qualifies: (item: GameplayIntentEvidence | undefined) => boolean,
  ): string[] => input.status === "hypothesis" ? [] :
    [...new Set(ids)].filter(id => {
      if (suppliedImplementation.has(id)) return false;
      const item = catalogue.get(id);
      return qualifies(item) &&
        !implementationLocations.has(item!.locator.trim());
    }).sort();

  const allDesign = independent(
    input.independentDesignEvidenceIds,
    isSelectedArtifactDesignClaimEvidence,
  );
  const approved = allDesign.filter(id =>
    isSelectedArtifactApprovedDesignEvidence(catalogue.get(id)));
  const draft = allDesign.filter(id => !approved.includes(id));
  const playerFacing = independent(
    input.playerFacingEvidenceIds ?? [],
    isSelectedArtifactPlayerFacingClaimEvidence,
  );
  const common = {
    evidenceIds: [...new Set([
      ...implementation, ...approved, ...draft, ...playerFacing,
    ])].sort(),
    implementationEvidenceIds: implementation,
    designEvidenceIds: approved,
    designClaimEvidenceIds: draft,
    playerFacingEvidenceIds: playerFacing,
  };
  if (approved.length > 0) return {
    ...common,
    disposition: "grounded-design",
    reasons: [
      "An independently located selected-artifact Game Design claim is marked approved; runtime fulfillment remains unproven.",
    ],
  };
  if (draft.length > 0) return {
    ...common,
    disposition: "design-claim",
    reasons: [
      "An independently located Game Design claim exists without verified approval; it cannot authorize intended-behavior proof.",
    ],
  };
  if (playerFacing.length > 0) return {
    ...common,
    disposition: "player-facing-claim",
    reasons: [
      "A player-facing promise exists, but it is not approved design or proof of successful gameplay delivery.",
    ],
  };
  if (implementation.length > 0) return {
    ...common,
    disposition: "implementation-only",
    reasons: [
      "Source behavior is present without a separately evidenced intended gameplay rule.",
    ],
  };
  return {
    ...common,
    disposition: "ambiguous",
    reasons: [
      "No selected-artifact evidence with validated provenance supports an implementation or design conclusion.",
    ],
  };
}

/** Admit only typed operation pairs already positively reviewed against
 * this exact selected-artifact source. Caller must establish the typed
 * SourceEffectSlice relationship; the model cannot attest that by prose.
 * Do not add gameplay nodes, edges, invariants, or delete an unknown.
 */
export function admitReviewedUnknownSourceRelations(
  model: GameplayIntentModel,
  reviewed: readonly {
    readonly unknownId: string;
    readonly fromStepId: string;
    readonly toStepId: string;
    readonly sourceClaim: GameplayIntentSourceRelation["sourceClaim"];
    readonly sourceRelationEvidenceIds: readonly string[];
  }[],
): GameplayIntentModel {
  if (reviewed.length === 0) return model;
  if (!model.artifactId?.trim()) {
    throw new Error("Reviewed source relationships require one selected artifact.");
  }
  const evidenceById = new Map(model.evidence.map(item => [item.id, item] as const));
  const updates = new Map<string, GameplayIntentSourceRelation[]>();
  for (const item of reviewed) {
    const owners = model.unknowns.filter(unknown => unknown.id === item.unknownId);
    const owner = owners[0];
    const ids = [item.fromStepId, item.toStepId];
    const owned = new Set(owner?.evidenceIds ?? []);
    const uniqueEvidence = [...new Set(item.sourceRelationEvidenceIds)].sort();
    if (owners.length !== 1 || !owner?.sourceEntryRegionId?.trim() ||
        ids.some(id => !id?.trim() || !owned.has(id) ||
          evidenceById.get(id)?.scope !== "selected-artifact" ||
          evidenceById.get(id)?.origin !== "source-code" ||
          !evidenceById.get(id)?.locator.trim()) ||
        ids[0] === ids[1] ||
        uniqueEvidence.length !== 2 ||
        !ids.every(id => uniqueEvidence.includes(id)) ||
        !([
          "SOURCE_GUARD_VALUE_HANDOFF_CANDIDATE",
          "SOURCE_EFFECT_RETURN_CANDIDATE",
        ] as readonly string[]).includes(item.sourceClaim)) {
      throw new Error("Reviewed source relationship cites unowned, non-source or ambiguous operation sites.");
    }
    const existing = [...(owner.sourceRelations ?? []), ...(updates.get(owner.id) ?? [])];
    if (existing.some(relation =>
      relation.sourceClaim === item.sourceClaim &&
      relation.fromStepId === item.fromStepId &&
      relation.toStepId === item.toStepId)) {
      throw new Error("Source relationship was already reviewed for this selected-map unknown.");
    }
    updates.set(owner.id, [
      ...(updates.get(owner.id) ?? []),
      {
        sourceClaim: item.sourceClaim,
        fromStepId: item.fromStepId,
        toStepId: item.toStepId,
        evidenceIds: uniqueEvidence,
        proofBoundary: "REVIEWED_TYPED_SOURCE_RELATION_NOT_GAMEPLAY_OR_RUNTIME_PROOF",
      },
    ]);
  }
  return {
    ...model,
    unknowns: model.unknowns.map(unknown => {
      const additions = updates.get(unknown.id);
      if (additions === undefined) return unknown;
      return {
        ...unknown,
        sourceRelations: [...(unknown.sourceRelations ?? []), ...additions]
          .sort((a,b) => a.sourceClaim.localeCompare(b.sourceClaim) ||
            a.fromStepId.localeCompare(b.fromStepId) ||
            a.toStepId.localeCompare(b.toStepId)),
      };
    }),
  };
}

export function selectedArtifactPlayerFacingEvidence(
  evidence: readonly GameplayIntentEvidence[],
): readonly string[] {
  return [...new Set(evidence
    .filter(isSelectedArtifactPlayerFacingClaimEvidence)
    .map(item => item.id))].sort();
}


/**
 * Navigate from an unclassified exact source entry to independently authored
 * current-map design/presentation cues. A shared Intent subject or an explicit
 * blocked-subject link is a SOURCE NAVIGATION relation, never proof the
 * technical operations implement its objective or delivered UI.
 */
export interface UnknownGameplayEvidenceInquiry {
  readonly unknownId: string;
  readonly sourceEvidenceIds: readonly string[];
  readonly subjectLinks: readonly {
    readonly subjectId: string;
    readonly kind: GameplayIntentModel["nodes"][number]["kind"];
    readonly basis: "SHARED_SELECTED_SOURCE_EVIDENCE" | "EXPLICIT_UNKNOWN_BLOCKED_SUBJECT";
  }[];
  readonly omittedSubjectLinks: number;
  readonly authoredRelationLeads: readonly {
    readonly edgeId: string;
    readonly from: string;
    readonly to: string;
    readonly kind: GameplayIntentModel["edges"][number]["kind"];
    readonly evidenceIds: readonly string[];
    readonly omittedEvidenceIds: number;
  }[];
  readonly omittedAuthoredRelationLeads: number;
  /** Uses canonical selected-source design validation. This is still just
   * context for the unknown operation, not acceptance of that design rule. */
  readonly designDisposition: DesignIntentChallengeDisposition;
  readonly approvedDesignEvidenceIds: readonly string[];
  readonly draftDesignEvidenceIds: readonly string[];
  readonly playerFacingEvidenceIds: readonly string[];
  readonly independentCues: readonly {
    readonly evidenceId: string;
    readonly origin: "game-design-spec" | "dialogue" | "translation";
    readonly locator: string;
    readonly summary: string;
    readonly approval: "approved" | "draft" | "player-facing-cue";
    readonly literalPlayerText?: string;
  }[];
  readonly omittedIndependentCues: number;
  readonly questions: readonly {
    readonly focus: "DESIGN_PURPOSE" | "PLAYER_PRESENTATION" | "PLAYER_FLOW_OWNERSHIP";
    readonly question: string;
    readonly evidenceIds: readonly string[];
  }[];
  readonly authority: "LINKED_SELECTED_INTENT_CONTEXT_NOT_UNKNOWN_MECHANIC_OR_RUNTIME_PROOF";
}

export function deriveUnknownGameplayEvidenceInquiry(
  model: GameplayIntentModel,
  unknownId: string,
  exactSourceEvidenceIds: readonly string[],
): UnknownGameplayEvidenceInquiry | undefined {
  if (!model.artifactId) return undefined;
  const unknowns = model.unknowns.filter(item => item.id === unknownId);
  if (unknowns.length !== 1) return undefined;
  const unknown = unknowns[0]!;
  const evidenceById = new Map(model.evidence.map(item => [item.id, item] as const));
  const sourceScope = new Set(unknown.evidenceIds ?? []);
  const selected = (id: string): GameplayIntentEvidence | undefined => {
    const item = evidenceById.get(id);
    return item?.scope === "selected-artifact" &&
      item.locator.trim() ? item : undefined;
  };
  const sourceEvidenceIds = [...new Set(exactSourceEvidenceIds)]
    .filter(id => sourceScope.has(id) && selected(id) !== undefined &&
      !isSelectedArtifactDesignClaimEvidence(selected(id)) &&
      !isSelectedArtifactPlayerFacingClaimEvidence(selected(id))).sort();
  if (sourceEvidenceIds.length === 0) return undefined;
  const sourceIds = new Set(sourceEvidenceIds);
  const blocked = new Set(unknown.blockedSubjectIds);
  // A hypothesis-only subject cannot lend design or player-flow authority.
  const linked = model.nodes.filter(node =>
    node.status !== "hypothesis" &&
    (blocked.has(node.id) ||
      node.evidenceIds.some(id => sourceIds.has(id))) &&
    node.evidenceIds.some(id => selected(id) !== undefined))
    .map(node => ({
      node,
      basis: node.evidenceIds.some(id => sourceIds.has(id))
        ? "SHARED_SELECTED_SOURCE_EVIDENCE" as const
        : "EXPLICIT_UNKNOWN_BLOCKED_SUBJECT" as const,
    })).sort((a, b) => a.node.id.localeCompare(b.node.id));
  const linkedIds = new Set(linked.map(item => item.node.id));
  const relatedEvidenceIds = [...new Set([
    ...(unknown.evidenceIds ?? []),
    ...linked.flatMap(item => item.node.evidenceIds),
  ])];
  const approvedAndDraft = relatedEvidenceIds.filter(id =>
    isSelectedArtifactDesignClaimEvidence(selected(id)));
  const playerFacing = relatedEvidenceIds.filter(id =>
    isSelectedArtifactPlayerFacingClaimEvidence(selected(id)));
  const challenge = challengeDesignIntent({
    implementationEvidenceIds: sourceEvidenceIds,
    independentDesignEvidenceIds: approvedAndDraft,
    playerFacingEvidenceIds: playerFacing,
    evidence: model.evidence,
  });
  const cueIds = [
    ...challenge.designEvidenceIds,
    ...challenge.designClaimEvidenceIds,
    ...challenge.playerFacingEvidenceIds,
  ];
  const cues = cueIds.flatMap(evidenceId => {
    const item = selected(evidenceId);
    if (!item || !(isSelectedArtifactDesignClaimEvidence(item) ||
        isSelectedArtifactPlayerFacingClaimEvidence(item))) return [];
    return [{
      evidenceId,
      origin: item.origin as "game-design-spec" | "dialogue" | "translation",
      locator: item.locator,
      summary: item.summary.slice(0, 180),
      approval: isSelectedArtifactApprovedDesignEvidence(item)
        ? "approved" as const
        : item.origin === "game-design-spec"
          ? "draft" as const : "player-facing-cue" as const,
      ...(item.playerFacingText === undefined ? {} :
        { literalPlayerText: item.playerFacingText.text.slice(0, 180) }),
    }];
  });
  const authoredRelations = model.edges.filter(edge =>
    edge.status !== "hypothesis" &&
    (linkedIds.has(edge.from) || linkedIds.has(edge.to)) &&
    edge.evidenceIds.some(id => selected(id) !== undefined) &&
    model.nodes.some(node =>
      node.id === edge.from && node.status !== "hypothesis" &&
      node.evidenceIds.some(id => selected(id) !== undefined)) &&
    model.nodes.some(node =>
      node.id === edge.to && node.status !== "hypothesis" &&
      node.evidenceIds.some(id => selected(id) !== undefined)))
    .sort((a, b) => a.id.localeCompare(b.id));
  const questions: UnknownGameplayEvidenceInquiry["questions"][number][] = [{
    focus: "DESIGN_PURPOSE",
    question: challenge.designEvidenceIds.length > 0
      ? "Does the linked, independently located APPROVED selected-map design actually specify the intended player objective and expected result for this source entry? Validate applicability against its exact activation and state owner."
      : challenge.designClaimEvidenceIds.length > 0
        ? "Does the linked DRAFT design describe this entry's intended player objective, and is there independent approval or current-map authority? Do not promote draft wording into a requirement."
        : "What is the independently supported intended player objective and expected result for this source entry? No linked selected-artifact approved design witness has been established.",
    evidenceIds: [
      ...challenge.designEvidenceIds, ...challenge.designClaimEvidenceIds,
    ].slice(0, 4),
  }];
  if (challenge.playerFacingEvidenceIds.length > 0) {
    questions.push({
      focus: "PLAYER_PRESENTATION",
      question: "Is the linked dialogue/translation actually presented to players on this exact source path, under the selected locale and conditions? Source copy is a cue, not delivered gameplay or approved design.",
      evidenceIds: challenge.playerFacingEvidenceIds.slice(0, 4),
    });
  }
  questions.push({
    focus: "PLAYER_FLOW_OWNERSHIP",
    question: linkedIds.size > 0
      ? "Does an explicitly linked or shared-source Intent subject actually own this entry's player-flow step? Trace entrance, guard, player/arena/session scope, effect and exit independently; Intent edge direction is not game-time order."
      : "Which player-flow step and owner, if any, uses the exact source operations? No independently linked non-hypothetical Intent subject was found.",
    evidenceIds: sourceEvidenceIds.slice(0, 4),
  });
  return {
    unknownId,
    sourceEvidenceIds: sourceEvidenceIds.slice(0, 12),
    subjectLinks: linked.slice(0, 4).map(item => ({
      subjectId: item.node.id,
      kind: item.node.kind,
      basis: item.basis,
    })),
    omittedSubjectLinks: Math.max(0, linked.length - 4),
    authoredRelationLeads: authoredRelations.slice(0, 4).map(edge => {
      const ids = edge.evidenceIds.filter(id => selected(id) !== undefined);
      return {
        edgeId: edge.id, from: edge.from, to: edge.to, kind: edge.kind,
        evidenceIds: ids.slice(0, 4),
        omittedEvidenceIds: Math.max(0, ids.length - 4),
      };
    }),
    omittedAuthoredRelationLeads: Math.max(0, authoredRelations.length - 4),
    designDisposition: challenge.disposition,
    approvedDesignEvidenceIds: challenge.designEvidenceIds.slice(0, 4),
    draftDesignEvidenceIds: challenge.designClaimEvidenceIds.slice(0, 4),
    playerFacingEvidenceIds: challenge.playerFacingEvidenceIds.slice(0, 4),
    independentCues: cues.slice(0, 4),
    omittedIndependentCues: Math.max(0, cues.length - 4),
    questions,
    authority: "LINKED_SELECTED_INTENT_CONTEXT_NOT_UNKNOWN_MECHANIC_OR_RUNTIME_PROOF",
  };
}
