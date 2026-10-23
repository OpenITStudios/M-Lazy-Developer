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
} from "./types.js";

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
    designChallenge,
    readiness,
  };
}
