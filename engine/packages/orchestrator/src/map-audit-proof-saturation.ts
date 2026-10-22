import {
  classifyGameplayIssue,
  type GameplayIssueFailureDomain,
} from "../../diagnostic-reasoning/src/index.js";
import {
  blockingCounterProofFor,
  counterProofSearchIsGraphGrounded,
  familyCounterProofDimensionsForCriterion,
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

/**
 * Evidence admitted for one causal finding must originate from its own
 * selected-scenario graph neighborhood or its uniquely owned, satisfied
 * Knowledge requirements. Resolution/model text is not an evidence source.
 */
function causalSourceEvidenceIds(
  graph: GameplayScenarioGraph,
  link: GameplayScenarioGraph["causalLinks"][number],
): readonly string[] {
  const scoped = graph.causalLinks.filter((candidate) =>
    candidate.scenarioId === link.scenarioId &&
    (candidate.id === link.id ||
      (candidate.subjectIds ?? []).some((id) =>
        (link.subjectIds ?? []).includes(id)) ||
      (candidate.componentIds ?? []).some((id) =>
        (link.componentIds ?? []).includes(id)))
  );
  return [...new Set(scoped.flatMap((candidate) => [
    ...candidate.evidenceIds,
    ...candidate.impactPathEvidenceIds,
    ...Object.values(candidate.dimensionEvidence ?? {}).flat(),
  ]))].filter(nonEmpty).sort();
}

export function sourceBoundAuditEvidenceIds(
  graph: GameplayScenarioGraph,
  causalLinkId: string,
): readonly string[] {
  const link = graph.causalLinks.find((item) => item.id === causalLinkId);
  if (link === undefined) return [];
  const knowledgeEvidence = link.knowledgeRequirementIds.flatMap((id) => {
    const requirement = uniqueScenarioKnowledgeRequirement(
      graph, id, link.scenarioId,
    );
    return requirement === undefined ? [] :
      satisfiedScenarioKnowledgeReceipt(graph, requirement)?.evidenceIds ?? [];
  });
  return [...new Set([
    ...causalSourceEvidenceIds(graph, link),
    ...knowledgeEvidence,
  ])].filter(nonEmpty).sort();
}

export function proofSaturationFamilyCriteria(
  domain: GameplayIssueFailureDomain,
): readonly string[] {
  return FAMILY_CRITERIA[domain].map((item) => item.description);
}

// A causal contradiction is not by itself proof that the player-facing
// outcome is reachable. These family criteria require the link's own
// independently traced impact path, not just a scoped evidence ID.
const IMPACT_PATH_CRITERIA = new Set([
  "actor-player-impact-grounded",
  "gameplay-dependency-affected",
  "player-degradation-derived",
]);

function derivedFamilyCriterionEvidence(input: {
  criterionId: string;
  link: GameplayScenarioGraph["causalLinks"][number] | undefined;
  resolution: GameplayDefectResolution;
  knowledgeEvidenceByDomain: ReadonlyMap<string, readonly string[]>;
}): readonly string[] {
  const { criterionId, link, resolution, knowledgeEvidenceByDomain } = input;
  if (link === undefined || link.status !== "CONTRADICTED") return [];

  // Only the contradiction owner, not an externally supplied resolution or
  // loosely related scenario neighbor, can supply family source evidence.
  const contradictionEvidence = [
    ...new Set(link.evidenceIds),
  ].filter(Boolean);
  const impactEvidence =
    link.impactPathComponentIds.length > 0 &&
    link.impactPathEvidenceIds.length > 0
      ? [...link.impactPathEvidenceIds]
      : [];
  const familyCounterproofDimensions =
    familyCounterProofDimensionsForCriterion(criterionId);
  const searchedDimensions =
    resolution.counterProofSearch?.searchedDimensions ?? [];
  if (familyCounterproofDimensions.length > 0) {
    // A family claim such as reconciliation-exhausted cannot be established
    // by the subset that happened to be searched. Every declared family
    // dimension needs one exhaustive receipt from the current source graph.
    if (!familyCounterproofDimensions.every((dimension) =>
      searchedDimensions.includes(dimension as any)
    )) return [];
    const receipts =
      resolution.counterProofSearch?.dimensionReceipts ?? [];
    const matched = familyCounterproofDimensions.map((dimension) =>
      receipts.filter((receipt) =>
        receipt.dimension === dimension &&
        receipt.exhaustiveWithinScope === true &&
        receipt.evidenceIds.length > 0
      )
    );
    if (matched.some((records) => records.length !== 1)) return [];
    return [...new Set(matched.flatMap((records) =>
      records[0]?.evidenceIds ?? []
    ))].sort();
  }
  if (
    criterionId === "commit-revalidation-missing" ||
    criterionId === "cleanup-containment-missing" ||
    criterionId === "restore-outcome-derived"
  ) {
    // Presence of a guard, cleanup or owner witness proves the positive
    // observation, not that revalidation/containment/recovery is missing.
    // These negative-outcome criteria require an independently grounded
    // explicit family receipt from the contradicted causal owner.
    return [];
  }
  if (IMPACT_PATH_CRITERIA.has(criterionId)) {
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
  const authorizedEvidenceIds = sourceBoundAuditEvidenceIds(
    graph, resolution.causalLinkId,
  );
  const knownEvidenceIds = new Set(authorizedEvidenceIds);
  const causalEvidenceIds = link === undefined
    ? [] : causalSourceEvidenceIds(graph, link);
  const evidenceIds = [
    ...new Set([
      ...(link?.evidenceIds ?? []),
      ...(resolution.evidenceIds ?? []),
      ...(resolution.counterProofSearch?.evidenceIds ?? []),
      ...(link?.impactPathEvidenceIds ?? []),
      ...satisfiedKnowledge.flatMap((item) => item.receipt.evidenceIds),
    ]),
  ].filter((id) => knownEvidenceIds.has(id)).sort();
  const knowledgeEvidenceByDomain = new Map<string, string[]>();
  for (const { requirement, receipt } of satisfiedKnowledge) {
    knowledgeEvidenceByDomain.set(requirement.domain, [
      ...new Set([
        ...(knowledgeEvidenceByDomain.get(requirement.domain) ?? []),
        ...receipt.evidenceIds,
      ]),
    ].sort());
  }

  // Graph ownership alone selects the failure family. An externally supplied
  // resolution cannot add a foreign component to change the proof policy.
  const componentIds = [...new Set(link?.componentIds ?? [])].sort();

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
  const counterProofEvidenceBound =
    counterProofIds.length > 0 &&
    counterProofIds.every((id) => knownEvidenceIds.has(id));
  // The same source graph must agree with the supplied no-blocking
  // conclusion. A proof receipt must not override a later/independent
  // exact-target exclusion still present in the canonical Scenario Graph.
  const graphBlockingProofIds =
    link === undefined ? [] : blockingCounterProofFor(graph, link);
  // PROVE re-evaluates the current canonical source graph. A stale or
  // self-asserted receipt from another analysis revision cannot grant PROVEN.
  const counterProofCleared =
    link !== undefined &&
    counterProofSearchIsGraphGrounded(
      graph, link, scenario, resolution.counterProofSearch,
    ) &&
    counterProofEvidenceBound &&
    graphBlockingProofIds.length === 0;

  const familyReceipt =
    resolution.familyProof;
  const familyReceiptSchemaValid = familyReceipt === undefined ||
    (familyReceipt.schemaVersion === 1 &&
      familyReceipt.policy === "family-proof-receipt" &&
      familyReceipt.failureDomain === classification.failureDomain &&
      familyReceipt.criteria.every((item) =>
        FAMILY_CRITERIA[classification.failureDomain]
          .some((criterion) => criterion.id === item.id)
      ) &&
      new Set(familyReceipt.criteria.map((item) => item.id)).size ===
        familyReceipt.criteria.length);
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
        satisfied: causalEvidenceIds.length > 0,
        evidenceIds: causalEvidenceIds,
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
        evidenceIds: counterProofIds.filter((id) =>
          knownEvidenceIds.has(id)),
      },
      {
        id: "family-proof-receipt-valid",
        description:
          "Optional family proof has supported schema, owned criteria and no duplicate criterion identities.",
        satisfied: familyReceiptSchemaValid,
        evidenceIds: [],
      },
    ];

  const familyReceiptById = new Map(
    (familyReceiptSchemaValid ? familyReceipt?.criteria ?? [] : [])
      .map((item) => [item.id, item]),
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
      // Explicit family evidence must match the proof dimension it closes:
      // platform/runtime knowledge is matched to its RIG receipt; player
      // impact requires this causal link's own traced impact-path evidence.
      // A contradiction elsewhere in the same scenario is not impact proof.
      const requiredKnowledgeDomain = criterion.id.includes("platform-constraint")
        ? "platform-constraints"
        : criterion.id.includes("residency-requirement")
          ? "chunk-simulation"
          : undefined;
      const counterproofFamilyDimensions =
        familyCounterProofDimensionsForCriterion(criterion.id);
      const familyCounterproofReceipts =
        resolution.counterProofSearch?.dimensionReceipts ?? [];
      const familyCounterproofEvidence = counterProofCleared &&
        counterproofFamilyDimensions.length > 0 &&
        counterproofFamilyDimensions.every((dimension) =>
          familyCounterproofReceipts.some((item) =>
            item.dimension === dimension &&
            item.exhaustiveWithinScope &&
            item.evidenceIds.length > 0
          )
        )
        ? familyCounterproofReceipts
          .filter((item) => counterproofFamilyDimensions.includes(item.dimension))
          .flatMap((item) => item.evidenceIds)
        : [];
      // Negative claims and direct reachable/grounded claims must not take
      // arbitrary evidence from other links in the same scenario.
      const sourceSpecificFamilyClaim =
        criterion.id === "commit-revalidation-missing" ||
        criterion.id === "cleanup-containment-missing" ||
        criterion.id === "restore-outcome-derived" ||
        criterion.id.includes("reachable") ||
        criterion.id.includes("grounded");
      const allowedCriterionEvidenceIds =
        IMPACT_PATH_CRITERIA.has(criterion.id)
          ? new Set(
              link !== undefined && link.impactPathComponentIds.length > 0
                ? link.impactPathEvidenceIds
                : [],
            )
          : counterproofFamilyDimensions.length > 0
            ? new Set(familyCounterproofEvidence)
            : requiredKnowledgeDomain !== undefined
              ? new Set(knowledgeEvidenceByDomain.get(requiredKnowledgeDomain) ?? [])
              : sourceSpecificFamilyClaim
                ? new Set(link?.evidenceIds ?? [])
                : undefined;
      const explicitEvidence =
        receipt?.satisfied === true &&
        receipt.evidenceIds.length > 0 &&
        receipt.evidenceIds.every((id) =>
          knownEvidenceIds.has(id) &&
          (allowedCriterionEvidenceIds === undefined ||
            allowedCriterionEvidenceIds.has(id))
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
            }).filter((id) =>
              knownEvidenceIds.has(id) &&
              (allowedCriterionEvidenceIds === undefined ||
                allowedCriterionEvidenceIds.has(id))
            );
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

  const missingUniversalCriteriaIds = universalCriteria
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
