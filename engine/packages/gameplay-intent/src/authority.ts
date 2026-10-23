import type {
  GameplayIntentEvidenceOrigin,
  GameplayIntentModel,
} from "./types.js";

export type GameplayAuthorityDomain =
  | "intended-gameplay"
  | "actual-behavior"
  | "release-identity";

export type GameplayAuthorityFreshness =
  | "current"
  | "historical";

export type GameplayAuthoritySource =
  | "current-user-decision"
  | "approved-game-design"
  | "current-gameplay-documentation"
  | "derived-intent"
  | "current-runtime-observation"
  | "current-root-artifact"
  | "current-source"
  | "derived-static-behavior"
  | "selected-artifact"
  | "current-manifest"
  | "current-changelog"
  | "historical-evidence";

export interface GameplayAuthorityClaim {
  readonly id: string;
  readonly domain: GameplayAuthorityDomain;
  readonly freshness: GameplayAuthorityFreshness;
  readonly source: GameplayAuthoritySource;
  readonly scope: string;
  readonly value: string;
}

export type GameplayAuthorityResolutionDisposition =
  | "resolved"
  | "ambiguous"
  | "unknown";

export interface GameplayAuthorityResolution {
  readonly domain: GameplayAuthorityDomain;
  readonly scope: string;
  readonly disposition: GameplayAuthorityResolutionDisposition;
  readonly value?: string;
  readonly basisClaimIds: readonly string[];
  readonly historicalHintIds: readonly string[];
  readonly reasons: readonly string[];
}

export const SELECTED_ARTIFACT_GAMEPLAY_CONTRACT_ORIGINS =
  [
    "game-design-spec",
    "source-code",
    "manifest",
    "command",
    "scoreboard",
    "tag",
    "dialogue",
    "translation",
    "structure",
  ] as const satisfies readonly GameplayIntentEvidenceOrigin[];

const selectedArtifactGameplayContractOrigins =
  new Set<GameplayIntentEvidenceOrigin>(
    SELECTED_ARTIFACT_GAMEPLAY_CONTRACT_ORIGINS,
  );

export function isSelectedArtifactGameplayContractOrigin(
  origin: GameplayIntentEvidenceOrigin,
): boolean {
  return selectedArtifactGameplayContractOrigins.has(origin);
}

export function selectedArtifactGameplayContractEvidenceIds(
  model: GameplayIntentModel,
  invariantIds: readonly string[],
): readonly string[] {
  const ids = new Set(invariantIds);
  const evidenceById = new Map(
    model.evidence.map((evidence) => [
      evidence.id,
      evidence,
    ]),
  );

  return [
    ...new Set(
      model.invariants
        .filter(
          (invariant) =>
            ids.has(invariant.id) &&
            invariant.status === "authored",
        )
        .flatMap((invariant) => invariant.evidenceIds)
        .filter((id) => {
          const evidence = evidenceById.get(id);
          return (
            evidence !== undefined &&
            evidence.scope === "selected-artifact" &&
            isSelectedArtifactGameplayContractOrigin(
              evidence.origin,
            )
          );
        }),
    ),
  ].sort();
}

const intendedRank: Readonly<
  Partial<Record<GameplayAuthoritySource, number>>
> = {
  "selected-artifact": 100,
};

const actualRank: Readonly<
  Partial<Record<GameplayAuthoritySource, number>>
> = {
  "current-runtime-observation": 100,
  "current-root-artifact": 90,
  "current-source": 80,
  "derived-static-behavior": 60,
};

const releaseRank: Readonly<
  Partial<Record<GameplayAuthoritySource, number>>
> = {
  "selected-artifact": 100,
  "current-root-artifact": 90,
  "current-manifest": 80,
  "current-changelog": 70,
};

function rankFor(
  domain: GameplayAuthorityDomain,
  source: GameplayAuthoritySource,
): number | undefined {
  if (domain === "intended-gameplay") {
    return intendedRank[source];
  }
  if (domain === "actual-behavior") {
    return actualRank[source];
  }
  return releaseRank[source];
}

export function resolveGameplayAuthority(
  claims: readonly GameplayAuthorityClaim[],
  domain: GameplayAuthorityDomain,
  scope: string,
): GameplayAuthorityResolution {
  const scoped = claims.filter(
    (claim) =>
      claim.domain === domain &&
      claim.scope === scope,
  );

  const historicalHintIds = scoped
    .filter(
      (claim) =>
        claim.freshness === "historical" ||
        claim.source === "historical-evidence",
    )
    .map((claim) => claim.id)
    .sort();

  const current = scoped
    .filter(
      (claim) =>
        claim.freshness === "current" &&
        claim.source !== "historical-evidence",
    )
    .map((claim) => ({
      claim,
      rank: rankFor(domain, claim.source),
    }))
    .filter(
      (
        item,
      ): item is {
        claim: GameplayAuthorityClaim;
        rank: number;
      } => item.rank !== undefined,
    );

  if (current.length === 0) {
    return {
      domain,
      scope,
      disposition: "unknown",
      basisClaimIds: [],
      historicalHintIds,
      reasons: [
        historicalHintIds.length > 0
          ? "Only historical evidence exists for this scope; it is a hint, not current authority."
          : "No current authority exists for this scope.",
      ],
    };
  }

  const highestRank = Math.max(
    ...current.map((item) => item.rank),
  );
  const strongest = current
    .filter((item) => item.rank === highestRank)
    .map((item) => item.claim)
    .sort((left, right) =>
      left.id.localeCompare(right.id)
    );

  const values = [
    ...new Set(strongest.map((claim) => claim.value)),
  ];

  if (values.length > 1) {
    return {
      domain,
      scope,
      disposition: "ambiguous",
      basisClaimIds: strongest.map((claim) => claim.id),
      historicalHintIds,
      reasons: [
        "Equally authoritative current claims conflict within the same scope.",
      ],
    };
  }

  return {
    domain,
    scope,
    disposition: "resolved",
    value: values[0]!,
    basisClaimIds: strongest.map((claim) => claim.id),
    historicalHintIds,
    reasons: [
      "Resolved from the strongest current authority for this domain and exact scope.",
    ],
  };
}
