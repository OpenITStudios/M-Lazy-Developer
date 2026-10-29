import {
  assessGameplayDesignReadiness,
  type GameplayDesignReadinessResult,
} from "./design-readiness.js";
import {
  selectedArtifactGameplayContractEvidenceIds,
} from "./authority.js";
import {
  challengeDesignIntent,
  isSelectedArtifactDesignClaimEvidence,
  isSelectedArtifactPlayerFacingClaimEvidence,
  type DesignIntentChallengeResult,
} from "./design-intent-challenge.js";
import type {
  GameplayIntentModel,
  GameplayIntentEvidence,
  GameplayUiSourceStepBinding,
} from "./types.js";


/**
 * A candidate player-facing contract reconstructed from the selected map's
 * literal locale + script-source evidence. It is NOT intended-gameplay
 * authority, validated delivery, player reachability or a bug conclusion.
 *
 * Locale identity is deliberately separated from its key: translations in
 * different languages are not conflicting definitions of one locale.
 */
export interface MapNativePlayerFacingContractCandidate {
  readonly textEvidenceId: string;
  readonly key: string;
  readonly locale: string | null;
  readonly sourceStatus:
    | "COPY_ONLY"
    | "EXACT_SOURCE_KEY_REFERENCE"
    | "EXACT_SOURCE_REGION_CORRELATION"
    | "EXACT_AUTHORED_UI_SEND_ATTEMPT";
  readonly sameLocaleDefinitionCount: number;
  /** Manifest/world pack-list attachment evidence, not client resource-pack
   * priority or locale choice.
   */
  readonly pack?: {
    readonly root: string;
    readonly worldAttachment: "listed" | "not-listed" | "unknown";
  };
  /** Reuse the canonical typed Intent witness without reshaping its
   * guard/entrypoint records into a competing report-only authority.
   */
  readonly authoredUiSendCalls: readonly NonNullable<
    NonNullable<GameplayIntentEvidence["literalTranslationUse"]>["authoredUiSendCall"]
  >[];
  /** Only subjects owning an exact typed IR source operation in the UI
   * execution region. Still not an accepted gameplay causal dependency.
   */
  readonly sourceGameplayStepBindings:
    readonly GameplayUiSourceStepBinding[];
  readonly omittedSourceGameplayStepBindings: number;
  /** Outcome/objective source-step subjects, never approved player goals. */
  readonly relatedOutcomeCandidateIds: readonly string[];
  readonly sourceReferenceEvidenceIds: readonly string[];
  readonly sourceRegionIds: readonly string[];
  /** Source-region co-membership, not gameplay purpose or execution proof. */
  readonly relatedIntentSubjectIds: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly unresolved: readonly (
    | "PLAYER_DELIVERY"
    | "PLAYER_ACTIVATION"
    | "INTENDED_GAMEPLAY"
    | "PACK_LOCALE_SELECTION"
    | "PACK_ATTACHMENT_UNKNOWN"
    | "PACK_NOT_LISTED"
    | "SOURCE_ENTRY_PATH"
    | "SOURCE_GUARD_SATISFIABILITY"
    | "PLAYER_RECEIVER_IDENTITY"
    | "SOURCE_UI_SEND_BINDING"
    | "SOURCE_GAMEPLAY_STEP_BINDING"
    | "SOURCE_GAMEPLAY_STEP_BUDGET"
    | "OBJECTIVE_CAUSAL_BINDING"
    | "DUPLICATE_LOCALE_DEFINITION"
    | "SOURCE_REGION_IDENTITY"
    | "GAMEPLAY_SUBJECT_ASSOCIATION"
  )[];
  readonly authority: "SELECTED_MAP_SOURCE_CANDIDATE_NOT_APPROVED_DESIGN_OR_RUNTIME_PROOF";
}

/**
 * Evidence identity is already owned by the selected Gameplay Intent Model.
 * Reconstruct contract CANDIDATES without inventing new objectives, mutating
 * the model, guessing game genre, parsing prose, or granting design approval.
 * The only joins are exact locale keys and exact, selected-source IR regions.
 */
export function reconstructMapNativePlayerFacingContracts(
  model: GameplayIntentModel,
): readonly MapNativePlayerFacingContractCandidate[] {
  if (!model.artifactId?.trim()) return [];
  const evidenceById = new Map(model.evidence.map(item =>
    [item.id, item] as const));
  const playerCopy = model.evidence.filter(item =>
    item.scope === "selected-artifact" &&
    item.origin === "translation" &&
    item.playerFacingText !== undefined &&
    item.playerFacingText.key.trim().length > 0 &&
    item.playerFacingText.text.trim().length > 0 &&
    /\/texts\/[^/]+\.lang#L[1-9][0-9]*$/i.test("/" + item.locator)
  );

  const localeFor = (locator: string): string | null =>
    (("/" + locator).match(/\/texts\/([^/]+)\.lang#L[1-9][0-9]*$/i)
      ?.[1] ?? null)?.toLowerCase() ?? null;
  const sameLocaleCounts = new Map<string, number>();
  const countKey = (key: string, locale: string | null): string =>
    JSON.stringify([key, locale]);
  for (const item of playerCopy) {
    const key = countKey(item.playerFacingText!.key, localeFor(item.locator));
    sameLocaleCounts.set(key, (sameLocaleCounts.get(key) ?? 0) + 1);
  }

  const referencesByKey = new Map<string, GameplayIntentModel["evidence"][number][]>();
  const regionIds = new Set<string>();
  for (const evidence of model.evidence) {
    if (evidence.scope !== "selected-artifact" ||
        evidence.origin !== "source-code" ||
        evidence.literalTranslationUse?.syntax !== "translate-object-literal" ||
        !evidence.literalTranslationUse.key.trim() ||
        !/:[1-9][0-9]*:[1-9][0-9]*$/.test(evidence.locator)) continue;
    const list = referencesByKey.get(evidence.literalTranslationUse.key) ?? [];
    list.push(evidence);
    referencesByKey.set(evidence.literalTranslationUse.key, list);
    if (evidence.literalTranslationUse.executionRegionId)
      regionIds.add(evidence.literalTranslationUse.executionRegionId);
  }

  // The canonical source IR region is admitted only when its evidence site is
  // independently present in THIS selected-artifact model at the same file.
  // A lexical function name or unrelated execution region is never enough.
  const subjectsByRegion = new Map<string, Set<string>>();
  for (const id of regionIds) {
    const region = evidenceById.get(id);
    if (region?.scope === "selected-artifact" &&
        region.origin === "source-code" &&
        region.locator.trim().length > 0) subjectsByRegion.set(id, new Set());
  }
  for (const node of model.nodes) {
    for (const id of node.evidenceIds) {
      if (subjectsByRegion.has(id)) subjectsByRegion.get(id)!.add(node.id);
    }
  }

  return playerCopy.map(item => {
    const key = item.playerFacingText!.key;
    const locale = localeFor(item.locator);
    const refs = [...(referencesByKey.get(key) ?? [])]
      .sort((left, right) =>
        left.locator.localeCompare(right.locator) ||
        left.id.localeCompare(right.id));
    const admittedRegionIds = [...new Set(refs.flatMap(ref => {
      const regionId = ref.literalTranslationUse?.executionRegionId;
      if (!regionId || !subjectsByRegion.has(regionId)) return [];
      const region = evidenceById.get(regionId);
      const sourceFile = ref.locator.replace(/:[1-9][0-9]*:[1-9][0-9]*$/, "");
      return region?.locator === sourceFile ? [regionId] : [];
    }))].sort();
    const relatedSubjects = [...new Set(admittedRegionIds.flatMap(id =>
      [...(subjectsByRegion.get(id) ?? [])]))].sort();
    const authoredUiSendCalls = [...new Map(refs.flatMap(ref => {
      const call = ref.literalTranslationUse?.authoredUiSendCall;
      if (call === undefined) return [];
      const evidence = evidenceById.get(call.apiCallEvidenceId);
      if (evidence?.scope !== "selected-artifact" ||
          evidence.origin !== "source-code" ||
          evidence.locator !== call.sourceLocator) return [];
      return [[call.apiCallEvidenceId, call] as const];
    })).values()].sort((a, b) =>
      a.apiCallEvidenceId.localeCompare(b.apiCallEvidenceId));
    const sourceGameplayStepBindings = [...new Map(
      authoredUiSendCalls.flatMap(call =>
        (call.sourceGameplayStepBindings ?? []).map(binding => [
          [binding.subjectId, binding.sourceStepEvidenceId,
            binding.sourceStepKind].join("::"),
          binding,
        ] as const))
    ).values()].sort((a, b) =>
      a.subjectId.localeCompare(b.subjectId) ||
      a.sourceStepEvidenceId.localeCompare(b.sourceStepEvidenceId));
    const omittedSourceGameplayStepBindings =
      authoredUiSendCalls.reduce((sum, call) =>
        sum + (call.omittedSourceGameplayStepBindings ?? 0), 0);
    const outcomes = [...new Set(sourceGameplayStepBindings
      .filter(binding =>
        binding.subjectKind === "objective" ||
        binding.subjectKind === "outcome")
      .map(binding => binding.subjectId))].sort();
    const sameLocaleDefinitionCount =
      sameLocaleCounts.get(countKey(key, locale)) ?? 0;
    const unresolved: MapNativePlayerFacingContractCandidate["unresolved"][number][] = [
      "PLAYER_DELIVERY", "PLAYER_ACTIVATION", "INTENDED_GAMEPLAY",
      "PACK_LOCALE_SELECTION", "OBJECTIVE_CAUSAL_BINDING",
    ];
    if (item.playerFacingText?.pack?.worldAttachment === "not-listed")
      unresolved.push("PACK_NOT_LISTED");
    if (item.playerFacingText?.pack?.worldAttachment !== "listed" &&
        item.playerFacingText?.pack?.worldAttachment !== "not-listed")
      unresolved.push("PACK_ATTACHMENT_UNKNOWN");
    if (authoredUiSendCalls.length === 0) unresolved.push("SOURCE_UI_SEND_BINDING");
    if (authoredUiSendCalls.some(call =>
      call.sourceActivation?.status !== "SOURCE_ROOTED_PATH_CANDIDATE"))
      unresolved.push("SOURCE_ENTRY_PATH");
    // Static receiver typing is not a player/session/arena binding; source
    // guards have not been evaluated against any live state.
    if (authoredUiSendCalls.length > 0)
      unresolved.push("SOURCE_GUARD_SATISFIABILITY", "PLAYER_RECEIVER_IDENTITY");
    if (sameLocaleDefinitionCount > 1)
      unresolved.push("DUPLICATE_LOCALE_DEFINITION");
    if (refs.length > 0 && admittedRegionIds.length === 0)
      unresolved.push("SOURCE_REGION_IDENTITY");
    if (relatedSubjects.length === 0 &&
        sourceGameplayStepBindings.length === 0)
      unresolved.push("GAMEPLAY_SUBJECT_ASSOCIATION");
    if (authoredUiSendCalls.length > 0 &&
        sourceGameplayStepBindings.length === 0)
      unresolved.push("SOURCE_GAMEPLAY_STEP_BINDING");
    if (omittedSourceGameplayStepBindings > 0)
      unresolved.push("SOURCE_GAMEPLAY_STEP_BUDGET");
    return {
      textEvidenceId: item.id,
      key, locale,
      ...(item.playerFacingText?.pack === undefined ? {} :
        { pack: item.playerFacingText.pack }),
      authoredUiSendCalls,
      sourceGameplayStepBindings,
      omittedSourceGameplayStepBindings,
      relatedOutcomeCandidateIds: outcomes,
      sourceStatus: authoredUiSendCalls.length > 0
        ? "EXACT_AUTHORED_UI_SEND_ATTEMPT" as const
        : admittedRegionIds.length > 0
        ? "EXACT_SOURCE_REGION_CORRELATION" as const
        : refs.length > 0
          ? "EXACT_SOURCE_KEY_REFERENCE" as const
          : "COPY_ONLY" as const,
      sameLocaleDefinitionCount,
      sourceReferenceEvidenceIds: refs.map(ref => ref.id),
      sourceRegionIds: admittedRegionIds,
      relatedIntentSubjectIds: relatedSubjects,
      evidenceIds: [...new Set([
        item.id, ...refs.map(ref => ref.id), ...admittedRegionIds,
        ...authoredUiSendCalls.map(call => call.apiCallEvidenceId),
        ...authoredUiSendCalls.flatMap(call =>
          (call.valueFlow?.hops ?? []).map(hop => hop.evidenceId)),
        ...sourceGameplayStepBindings.map(binding =>
          binding.sourceStepEvidenceId),
      ])].sort(),
      unresolved,
      authority: "SELECTED_MAP_SOURCE_CANDIDATE_NOT_APPROVED_DESIGN_OR_RUNTIME_PROOF" as const,
    };
  }).sort((left, right) =>
    left.key.localeCompare(right.key) ||
    (left.locale ?? "").localeCompare(right.locale ?? "") ||
    left.textEvidenceId.localeCompare(right.textEvidenceId));
}

export interface GameplayContractBuildInput {
  readonly subjectIds: readonly string[];
  readonly materialUnknownIds?: readonly string[];
  readonly nonMaterialUnknownIds?: readonly string[];
}

export interface GameplayContract {
  readonly schemaVersion: 1;
  readonly modelId: string;
  readonly artifactId?: string;
  readonly evidenceScope: "selected-artifact-only";
  readonly subjectIds: readonly string[];
  readonly invariantIds: readonly string[];
  /** Only separately located, approved game-design-spec witnesses. */
  readonly authorityEvidenceIds: readonly string[];
  /** Implementation evidence persists when design readiness is blocked. */
  readonly implementationEvidenceIds: readonly string[];
  /** UI promises support mismatch investigation, not approved design. */
  readonly playerFacingClaimEvidenceIds: readonly string[];
  /** Selected-map source candidates related by exact IR region to this scope.
   * No candidate upgrades gameplay readiness or objective/impact authority.
   */
  readonly mapNativePlayerFacingCandidates:
    readonly MapNativePlayerFacingContractCandidate[];
  readonly designChallenge: DesignIntentChallengeResult;
  readonly readiness: GameplayDesignReadinessResult;
}

export function buildGameplayContract(
  model: GameplayIntentModel,
  input: GameplayContractBuildInput,
): GameplayContract {
  const subjects = new Set(input.subjectIds);
  const invariantIds = model.invariants
    .filter((invariant) =>
      invariant.subjectIds.some((subjectId) =>
        subjects.has(subjectId),
      ),
    )
    .map((invariant) => invariant.id)
    .sort();

  const authoredEvidenceIds =
    selectedArtifactGameplayContractEvidenceIds(
      model,
      invariantIds,
    );
  const byId = new Map(model.evidence.map(item => [item.id, item]));
  const designChallenge = challengeDesignIntent({
    evidence: model.evidence,
    status: "authored",
    implementationEvidenceIds: authoredEvidenceIds.filter(id =>
      !isSelectedArtifactDesignClaimEvidence(byId.get(id)) &&
      !isSelectedArtifactPlayerFacingClaimEvidence(byId.get(id))),
    independentDesignEvidenceIds: authoredEvidenceIds.filter(id =>
      isSelectedArtifactDesignClaimEvidence(byId.get(id))),
    playerFacingEvidenceIds: authoredEvidenceIds.filter(id =>
      isSelectedArtifactPlayerFacingClaimEvidence(byId.get(id))),
  });
  const authorityEvidenceIds = designChallenge.designEvidenceIds;

  const readiness = assessGameplayDesignReadiness(
    model,
    {
      scopeSubjectIds: [...input.subjectIds],
      authoritativeDesignAvailable:
        model.artifactId !== undefined &&
        designChallenge.disposition === "grounded-design",
      ...(input.materialUnknownIds === undefined
        ? {}
        : {
            materialUnknownIds:
              input.materialUnknownIds,
          }),
      ...(input.nonMaterialUnknownIds === undefined
        ? {}
        : {
            nonMaterialUnknownIds:
              input.nonMaterialUnknownIds,
          }),
    },
  );

  return {
    schemaVersion: 1,
    modelId: model.id,
    ...(model.artifactId === undefined
      ? {}
      : { artifactId: model.artifactId }),
    evidenceScope: "selected-artifact-only",
    subjectIds: [...input.subjectIds],
    invariantIds,
    authorityEvidenceIds,
    implementationEvidenceIds: designChallenge.implementationEvidenceIds,
    playerFacingClaimEvidenceIds: designChallenge.playerFacingEvidenceIds,
    mapNativePlayerFacingCandidates: reconstructMapNativePlayerFacingContracts(model)
      .filter(candidate =>
        candidate.relatedIntentSubjectIds.some(id => subjects.has(id)) ||
        candidate.sourceGameplayStepBindings.some(binding =>
          subjects.has(binding.subjectId))),
    designChallenge,
    readiness,
  };
}
