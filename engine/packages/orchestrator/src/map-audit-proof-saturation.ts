import {
  classifyGameplayIssue,
  type GameplayIssueFailureDomain,
} from "../../diagnostic-reasoning/src/index.js";
import {
  blockingCounterProofFor,
  type GameplayDefectResolution,
} from "./inspection/gameplay-defect-resolution.js";
import type {
  GameplayScenarioGraph,
} from "./inspection/gameplay-scenario-model.js";
import {
  satisfiedScenarioKnowledgeReceipt,
  uniqueScenarioKnowledgeRequirement,
} from "./inspection/gameplay-scenario-knowledge.js";

export interface AuditProofSaturationCriterion {
  readonly id: string;
  readonly description: string;
  readonly satisfied: boolean;
  readonly evidenceIds: readonly string[];
}

export interface AuditProofSaturationAssessment {
  readonly policy: "minimum-sufficient-proof";
  readonly causalLinkId: string;
  readonly failureDomain: GameplayIssueFailureDomain;
  readonly universalCriteria:
    readonly AuditProofSaturationCriterion[];
  readonly familyCriteria: readonly AuditProofSaturationCriterion[];
  readonly saturated: boolean;
  readonly missingUniversalCriteriaIds: readonly string[];
  readonly missingFamilyCriteriaIds: readonly string[];
  readonly stopRule: string;
}

const FAMILY_CRITERIA: Readonly<
  Record<
    GameplayIssueFailureDomain,
    readonly { readonly id: string; readonly description: string }[]
  >
> = {
  "progression-wave-objective": [
    { id: "completion-dependency-grounded", description: "Completion dependency is grounded." },
    { id: "failing-path-reachable", description: "The failing/incorrect mutation or missing accounting path is reachable." },
    { id: "reconciliation-exhausted", description: "No alternate reconciliation path repairs progression before player impact." },
  ],
  "arena-multi-arena": [
    { id: "arena-contract-grounded", description: "Arena ownership/capacity contract is grounded." },
    { id: "concurrent-violation-reachable", description: "The violating shared/global/capacity path is reachable under concurrent use." },
    { id: "arena-counterproof-exhausted", description: "Isolation/admission/cleanup counter-proof is exhausted." },
  ],
  "inventory-economy": [
    { id: "item-scope-grounded", description: "Item/currency identity and player/run scope are grounded." },
    { id: "competing-writer-reachable", description: "Competing grant/restore/consume path reachability is grounded." },
    { id: "idempotency-exclusion-exhausted", description: "Mutual exclusion/idempotency/generation counter-proof is exhausted." },
  ],
  "temporal-async": [
    { id: "deferred-work-grounded", description: "Deferred work and eventual mutation are grounded." },
    { id: "owner-change-reachable", description: "Owner/session/arena/phase can change before commit." },
    { id: "commit-revalidation-missing", description: "Commit-time cancellation/generation revalidation is absent or contradicted." },
  ],
  "chunk-simulation": [
    { id: "simulation-dependency-grounded", description: "Gameplay-critical simulation dependency is grounded." },
    { id: "residency-requirement-grounded", description: "Simulation ownership/readiness requirement is grounded." },
    { id: "platform-constraint-bound", description: "Applicable platform/resource constraint and missing/insufficient ownership are grounded." },
  ],
  "persistence-recovery": [
    { id: "persisted-scope-grounded", description: "Persisted state identity, scope, and intended lifetime are grounded." },
    { id: "recovery-path-reachable", description: "Recovery/reset path is reachable." },
    { id: "restore-outcome-derived", description: "Missing/stale/duplicate restore outcome follows from the grounded lifecycle." },
  ],
  "state-ownership": [
    { id: "state-owner-grounded", description: "Material state owner and writers are grounded." },
    { id: "conflict-path-reachable", description: "Conflicting/missing reset or exit path is reachable." },
    { id: "ownership-counterproof-exhausted", description: "No guard/ownership rule makes the wrong state unreachable." },
  ],
  "entity-ai-combat": [
    { id: "actor-contract-grounded", description: "Actor/combat lifecycle contract is grounded." },
    { id: "actor-failure-reachable", description: "Failing spawn/navigation/hurt/death/revive path is reachable." },
    { id: "actor-player-impact-grounded", description: "Player-visible gameplay dependency on that actor/lifecycle is grounded." },
  ],
  "world-structure-mutation": [
    { id: "mutation-contract-grounded", description: "World/structure mutation contract and target scope are grounded." },
    { id: "mutation-failure-reachable", description: "Incorrect ordering/residue/leakage path is reachable." },
    { id: "cleanup-containment-missing", description: "Required cleanup/replacement/spatial containment is absent or contradicted." },
  ],
  "boundary-capacity": [
    { id: "boundary-grounded", description: "The intended/visible boundary is grounded." },
    { id: "effective-limit-grounded", description: "The effective implementation/platform limit is grounded." },
    { id: "boundary-contradiction-derived", description: "Below/at/above-boundary behavior yields a deterministic contradiction." },
  ],
  "player-lifecycle": [
    { id: "lifecycle-owner-grounded", description: "Lifecycle transition and owning player/session state are grounded." },
    { id: "invalid-transition-reachable", description: "The invalid join/leave/death/reconnect/recovery path is reachable." },
    { id: "recovery-counterproof-exhausted", description: "A valid recovery/reset alternative does not block the wrong state." },
  ],
  "ui-feedback-information": [
    { id: "presented-information-grounded", description: "Player-facing information is grounded." },
    { id: "actual-state-grounded", description: "Actual gameplay state/capability is independently grounded." },
    { id: "same-condition-mismatch-reachable", description: "The mismatch is reachable in the same player-facing condition." },
  ],
  "platform-performance": [
    { id: "platform-constraint-grounded", description: "Exact selected-version platform constraint is grounded." },
    { id: "gameplay-dependency-affected", description: "A required gameplay dependency is affected by that constraint." },
    { id: "player-degradation-derived", description: "The resulting player-visible degradation/limit is deterministically derived." },
  ],
};

function nonEmpty(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function proofSaturationFamilyCriteria(
  domain: GameplayIssueFailureDomain,
): readonly string[] {
  return FAMILY_CRITERIA[domain].map((item) => item.description);
}

const FAMILY_COUNTERPROOF_DIMENSIONS: Readonly<
  Partial<Record<string, readonly string[]>>
> = {
  "reconciliation-exhausted": [
    "guard",
    "exclusion",
    "scope",
  ],
  "arena-counterproof-exhausted": [
    "owner",
    "guard",
    "generation",
    "cleanup",
    "exclusion",
    "scope",
  ],
  "idempotency-exclusion-exhausted": [
    "guard",
    "generation",
    "exclusion",
    "scope",
  ],
  "ownership-counterproof-exhausted": [
    "owner",
    "guard",
    "exclusion",
    "scope",
  ],
  "recovery-counterproof-exhausted": [
    "owner",
    "generation",
    "cleanup",
    "guard",
    "scope",
  ],
};

function derivedFamilyCriterionEvidence(input: {
  criterionId: string;
  link: GameplayScenarioGraph["causalLinks"][number] | undefined;
  resolution: GameplayDefectResolution;
  knowledgeEvidenceByDomain: ReadonlyMap<string, readonly string[]>;
}): readonly string[] {
  const { criterionId, link, resolution, knowledgeEvidenceByDomain } = input;
  if (link === undefined || link.status !== "CONTRADICTED") return [];

  const contradictionEvidence = [
    ...new Set([
      ...link.evidenceIds,
      ...(resolution.evidenceIds ?? []),
    ]),
  ].filter(Boolean);
  const impactEvidence =
    link.impactPathComponentIds.length > 0 &&
    link.impactPathEvidenceIds.length > 0
      ? [...link.impactPathEvidenceIds]
      : [];
  const familyCounterproofDimensions =
    FAMILY_COUNTERPROOF_DIMENSIONS[criterionId] ?? [];
  const searchedDimensions =
    resolution.counterProofSearch?.searchedDimensions ?? [];
  const requiredCounterproofDimensions =
    familyCounterproofDimensions.filter((dimension) =>
      searchedDimensions.includes(dimension as any)
    );
  if (
    familyCounterproofDimensions.length > 0 &&
    requiredCounterproofDimensions.length > 0
  ) {
    const receipts =
      resolution.counterProofSearch?.dimensionReceipts ?? [];
    const matched = requiredCounterproofDimensions.map(
      (dimension) =>
        receipts.find(
          (receipt) =>
            receipt.dimension === dimension &&
            receipt.exhaustiveWithinScope === true &&
            receipt.evidenceIds.length > 0,
        ),
    );
    if (matched.some((receipt) => receipt === undefined)) {
      return [];
    }
    return [
      ...new Set(
        matched.flatMap(
          (receipt) => receipt?.evidenceIds ?? [],
        ),
      ),
    ].sort();
  }
  const dimensionEvidence = (
    dimensions: readonly string[],
  ): readonly string[] =>
    resolution.counterProofSearch?.dimensionReceipts
      .filter(
        (receipt) =>
          dimensions.includes(receipt.dimension) &&
          receipt.exhaustiveWithinScope === true,
      )
      .flatMap((receipt) => receipt.evidenceIds) ?? [];

  if (criterionId === "commit-revalidation-missing") {
    return dimensionEvidence([
      "generation",
      "guard",
      "exclusion",
    ]);
  }
  if (criterionId === "cleanup-containment-missing") {
    return dimensionEvidence([
      "cleanup",
      "geometry",
      "scope",
    ]);
  }
  if (criterionId === "restore-outcome-derived") {
    return dimensionEvidence([
      "generation",
      "cleanup",
      "owner",
    ]);
  }
  if (
    criterionId.includes("player-impact") ||
    criterionId.includes("gameplay-dependency-affected") ||
    criterionId.includes("player-degradation-derived")
  ) {
    return impactEvidence;
  }
  if (criterionId.includes("platform-constraint")) {
    return knowledgeEvidenceByDomain.get("platform-constraints") ?? [];
  }
  if (criterionId.includes("residency-requirement")) {
    return knowledgeEvidenceByDomain.get("chunk-simulation") ?? [];
  }
  if (
    criterionId.includes("reachable") ||
    (
      criterionId.includes("grounded") &&
      !criterionId.includes("platform") &&
      !criterionId.includes("residency")
    )
  ) {
    return contradictionEvidence;
  }
  return [];
}

export function assessReadyResolutionSaturation(
  graph: GameplayScenarioGraph,
  resolution: GameplayDefectResolution,
): AuditProofSaturationAssessment {
  const link = graph.causalLinks.find(
    (item) => item.id === resolution.causalLinkId,
  );
  const scenario =
    link === undefined
      ? undefined
      : graph.scenarios.find(
          (item) => item.id === link.scenarioId,
        );

  // The causal link, not a supplied resolution, owns required knowledge.
  // Every exact scenario requirement must have one matching satisfied receipt;
  // a source contradiction/family proof cannot replace missing RIG knowledge.
  const scopedRequirementIds = [...new Set(
    link?.knowledgeRequirementIds ?? [],
  )].sort();
  const scopedRequirements = scopedRequirementIds.flatMap((id) => {
    const requirement = uniqueScenarioKnowledgeRequirement(
      graph, id, link?.scenarioId ?? "",
    );
    return requirement === undefined ? [] : [requirement];
  });
  const satisfiedKnowledge = scopedRequirements.flatMap((requirement) => {
    const receipt = satisfiedScenarioKnowledgeReceipt(graph, requirement);
    return receipt === undefined ? [] : [{ requirement, receipt }];
  });
  const missingKnowledgeRequirementIds = scopedRequirementIds.filter((id) =>
    !satisfiedKnowledge.some((item) => item.requirement.id === id)
  );
  const evidenceIds = [
    ...new Set([
      ...(link?.evidenceIds ?? []),
      ...(resolution.evidenceIds ?? []),
      ...(resolution.counterProofSearch?.evidenceIds ?? []),
      ...(link?.impactPathEvidenceIds ?? []),
      ...satisfiedKnowledge.flatMap((item) => item.receipt.evidenceIds),
    ]),
  ].sort();
  const knownEvidenceIds = new Set(evidenceIds);
  const knowledgeEvidenceByDomain = new Map<string, string[]>();
  for (const { requirement, receipt } of satisfiedKnowledge) {
    knowledgeEvidenceByDomain.set(requirement.domain, [
      ...new Set([
        ...(knowledgeEvidenceByDomain.get(requirement.domain) ?? []),
        ...receipt.evidenceIds,
      ]),
    ].sort());
  }

  const componentIds = [
    ...new Set([
      ...(link?.componentIds ?? []),
      ...(resolution.componentIds ?? []),
    ]),
  ].sort();

  // Ambiguous Knowledge IDs must not choose an arbitrary domain for proof
  // family selection; source-valid scoped requirements remain navigable.
  const knowledgeDomains =
    scopedRequirements.map((item) => item.domain);
  const classification = classifyGameplayIssue({
    gameplayStage:
      scenario?.gameplayStage ?? "ACTIVE_GAMEPLAY",
    scenarioLabel:
      scenario?.label ?? resolution.scenarioId ?? "unknown",
    componentIds,
    knowledgeDomains,
  });

  const counterProofIds =
    resolution.counterProofSearch?.evidenceIds ?? [];
  // The same source graph must agree with the supplied no-blocking
  // conclusion. A proof receipt must not override a later/independent
  // exact-target exclusion still present in the canonical Scenario Graph.
  const graphBlockingProofIds =
    link === undefined ? [] : blockingCounterProofFor(graph, link);
  const counterProofCleared =
    resolution.counterProofSearch?.conclusion ===
      "NO_BLOCKING_PROOF" &&
    resolution.counterProofSearch
      .exhaustiveWithinScope === true &&
    graphBlockingProofIds.length === 0;

  const universalCriteria:
    AuditProofSaturationCriterion[] = [
      {
        id: "scenario-grounded",
        description:
          "Finding is attached to one concrete gameplay scenario with selected-artifact components.",
        satisfied:
          scenario !== undefined &&
          scenario.componentIds.length > 0,
        evidenceIds,
      },
      {
        id: "contradiction-grounded",
        description:
          "Expected dependency and contradictory actual behavior are grounded.",
        satisfied:
          link?.status === "CONTRADICTED" &&
          nonEmpty(link.purpose) &&
          nonEmpty(link.reason),
        evidenceIds,
      },
      {
        id: "player-impact-translated",
        description:
          "Trigger and player-visible gameplay consequence are explicit.",
        satisfied:
          nonEmpty(resolution.gameplayTrigger) &&
          nonEmpty(resolution.gameplayConsequence),
        evidenceIds,
      },
      {
        id: "expected-actual-bound",
        description:
          "Expected and actual outcomes are explicitly bound.",
        satisfied:
          nonEmpty(resolution.expectedOutcome) &&
          nonEmpty(resolution.actualOutcome),
        evidenceIds,
      },
      {
        id: "scope-bound",
        description:
          "Affected gameplay/source scope is explicit.",
        satisfied:
          nonEmpty(resolution.affectedScope),
        evidenceIds,
      },
      {
        id: "evidence-bound",
        description:
          "At least one selected-artifact/analysis evidence id supports the contradiction.",
        satisfied: evidenceIds.length > 0,
        evidenceIds,
      },
      {
        id: "required-knowledge-satisfied",
        description:
          "Every knowledge requirement owned by the causal link has a matching, satisfied scenario receipt.",
        satisfied: missingKnowledgeRequirementIds.length === 0,
        evidenceIds: satisfiedKnowledge.flatMap((item) =>
          item.receipt.evidenceIds),
      },
      {
        id: "counter-proof-cleared",
        description:
          "Bounded counter-proof search is exhaustive in scope and found no blocking proof.",
        satisfied: counterProofCleared,
        evidenceIds: [...counterProofIds],
      },
    ];

  const familyReceipt =
    resolution.familyProof;
  const familyReceiptById = new Map(
    (familyReceipt?.criteria ?? []).map((item) => [
      item.id,
      item,
    ]),
  );
  const familyCriteria =
    FAMILY_CRITERIA[
      classification.failureDomain
    ].map((criterion) => {
      const receipt =
        familyReceipt?.failureDomain ===
          classification.failureDomain
          ? familyReceiptById.get(criterion.id)
          : undefined;
      // An explicit family receipt can cite existing proof, but cannot
      // bypass a missing/wrong-scope RIG receipt for platform/simulation.
      const requiredKnowledgeDomain = criterion.id.includes("platform-constraint")
        ? "platform-constraints"
        : criterion.id.includes("residency-requirement")
          ? "chunk-simulation"
          : undefined;
      const allowedKnowledgeIds = requiredKnowledgeDomain === undefined
        ? undefined
        : new Set(knowledgeEvidenceByDomain.get(requiredKnowledgeDomain) ?? []);
      const explicitEvidence =
        receipt?.satisfied === true &&
        receipt.evidenceIds.length > 0 &&
        receipt.evidenceIds.every((id) =>
          knownEvidenceIds.has(id) &&
          (allowedKnowledgeIds === undefined || allowedKnowledgeIds.has(id))
        )
          ? [...receipt.evidenceIds]
          : [];
      const derivedEvidence =
        explicitEvidence.length > 0
          ? []
          : derivedFamilyCriterionEvidence({
              criterionId: criterion.id,
              link,
              resolution,
              knowledgeEvidenceByDomain,
            }).filter((id) => knownEvidenceIds.has(id));
      const criterionEvidence = [
        ...new Set([
          ...explicitEvidence,
          ...derivedEvidence,
        ]),
      ].sort();
      return {
        id: criterion.id,
        description: criterion.description,
        satisfied: criterionEvidence.length > 0,
        evidenceIds: criterionEvidence,
      };
    });

  const missingUniversalCriteriaIds =
    universalCriteria
      .filter((item) => !item.satisfied)
      .map((item) => item.id)
      .sort();
  const missingFamilyCriteriaIds =
    familyCriteria
      .filter((item) => !item.satisfied)
      .map((item) => item.id)
      .sort();

  return {
    policy: "minimum-sufficient-proof",
    causalLinkId: resolution.causalLinkId,
    failureDomain:
      classification.failureDomain,
    universalCriteria,
    familyCriteria,
    saturated:
      missingUniversalCriteriaIds.length === 0 &&
      missingFamilyCriteriaIds.length === 0,
    missingUniversalCriteriaIds,
    missingFamilyCriteriaIds,
    stopRule:
      missingUniversalCriteriaIds.length === 0 &&
      missingFamilyCriteriaIds.length === 0
        ? "Universal and family-specific proof are saturated. Stop searching; runtime manifestation is unnecessary unless a separate irreducible runtime claim exists."
        : "Continue only on missing universal/family proof criteria. Do not broaden search into already-satisfied dimensions.",
  };
}
