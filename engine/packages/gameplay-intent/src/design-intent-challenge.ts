import type {
  GameplayIntentEvidence,
  GameplayIntentStatus,
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

export function selectedArtifactPlayerFacingEvidence(
  evidence: readonly GameplayIntentEvidence[],
): readonly string[] {
  return [...new Set(evidence
    .filter(isSelectedArtifactPlayerFacingClaimEvidence)
    .map(item => item.id))].sort();
}
