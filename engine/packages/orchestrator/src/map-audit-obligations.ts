import type {
  GameplayIntentModel,
  GameplayModelClosureResult,
} from "../../gameplay-intent/src/index.js";
import type {
  GameplayCapabilityDeliveryAssessment,
  NegativeSpaceSignal,
  TemporalInteractionRisk,
} from "../../diagnostic-reasoning/src/index.js";
import type {
  GameplayScenarioGraph,
} from "./inspection/gameplay-scenario-model.js";
import {
  satisfiedScenarioKnowledgeReceipt,
  uniqueScenarioKnowledgeRequirement,
} from "./inspection/gameplay-scenario-knowledge.js";
import { SELECTED_MAP_AUDIT_STAGE_ORDER } from "./map-audit-admission.js";
import {
  capabilityDeliveryMatchesScope,
  type GameplayDefectResolutionGate,
} from "./inspection/gameplay-defect-resolution.js";
import type {
  GameplayWorldModel,
} from "./inspection/gameplay-world-model.js";
import type { MandatoryAuditProcedureReceipt } from "./inspection/mandatory-audit-support.js";
import type { GameplayDiscoveryClosure } from "./inspection/gameplay-discovery-closure.js";
import type {
  AuditUserIntentEnvelope,
} from "./map-audit-user-intent.js";
import type {
  GameplayDiscoveryChallengeSignal,
} from "./inspection/gameplay-discovery-challenger.js";
import type {
  SharedResourceOwnershipSignal,
} from "./inspection/shared-resource-ownership.js";
import type {
  AccumulationGrowthSignal,
  CompoundBoundarySignal,
} from "./inspection/gameplay-compound-growth-analysis.js";
import type {
  CapabilityExposureSummary,
} from "./inspection/capability-exposure-stage.js";

export type AuditObligationSource =
  | "knowledge-gap"
  | "scenario-coverage"
  | "graph-structure"
  | "gameplay-closure"
  | "negative-space"
  | "temporal-risk"
  | "discovery-challenge"
  | "shared-resource"
  | "compound-boundary"
  | "accumulation-growth"
  | "replica-divergence"
  | "runtime-proof"
  | "detection-gap"
  | "gameplay-translation"
  | "counterproof-search"
  | "user-reported-symptom"
  | "user-input-unmapped";

/** Current selected-source questions for an unknown gameplay entry.
 * These questions are a derived investigation plan, not semantic proof.
 */
export interface AuditUnknownSourceProofRequirement {
  readonly unknownId: string;
  readonly sourceEvidenceIds: readonly string[];
  readonly missingClaims: readonly string[];
}

export interface AuditObligation {
  readonly id: string;
  readonly source: AuditObligationSource;
  readonly stage:
    | "DISCOVERY"
    | "UNDERSTAND"
    | "FORMALIZE"
    | "EVALUATE"
    | "PROVE";
  readonly title: string;
  readonly reason: string;
  readonly missingProof: string;
  readonly validationTest: string;
  readonly validationGroupKey: string;
  readonly subjectIds: readonly string[];
  readonly componentIds: readonly string[];
  readonly evidenceIds: readonly string[];
  /** Bounded source-specific questions rather than a blanket request to
   * reconstruct every map's gameplay. Not a second proof authority.
   */
  readonly sourceProofRequirements?: readonly AuditUnknownSourceProofRequirement[];
  readonly omittedSourceProofRequirements?: number;
}

// The projection creates tens of thousands of mostly empty evidence/subject
// lists on large maps. Reuse only the immutable empty result; nonempty lists
// remain freshly normalized so callers cannot share mutable source arrays.
const EMPTY_IDS: readonly string[] = Object.freeze([]);

function unique(values: readonly string[]): readonly string[] {
  if (values.length === 0) return EMPTY_IDS;
  if (values.length === 1) return values[0] ? [values[0]] : EMPTY_IDS;
  return [...new Set(values.filter(Boolean))].sort();
}

/** Preserve Array.find's first-match semantics even for ambiguous IDs. */
function firstById<T extends { readonly id: string }>(
  values: readonly T[],
): ReadonlyMap<string, T> {
  const index = new Map<string, T>();
  for (const value of values) {
    if (!index.has(value.id)) index.set(value.id, value);
  }
  return index;
}

function normalize(
  value: AuditObligation,
): AuditObligation {
  return {
    ...value,
    subjectIds: unique(value.subjectIds),
    componentIds: unique(value.componentIds),
    evidenceIds: unique(value.evidenceIds),
  };
}

/**
 * A required scenario Knowledge receipt is usable only when there is exactly
 * one matching owner/domain receipt with nonempty selected proof evidence.
 * Keep this rule aligned with the existing PROVE saturation gate; do not
 * let missing or duplicate receipts disappear from Audit Obligations.
 */
export function unresolvedKnowledgeRequirements(
  graph: GameplayScenarioGraph,
): readonly {
  readonly requirement: GameplayScenarioGraph["knowledgeRequirements"][number];
  readonly receipt?: GameplayScenarioGraph["knowledgeReceipts"][number];
}[] {
  return graph.knowledgeRequirements.flatMap((requirement) => {
    // The requirement ID is the canonical RIG identity. Duplicate owners,
    // including identical copies or IDs reused by a different scenario,
    // cannot borrow one receipt to claim complete Knowledge coverage.
    const uniqueOwner = uniqueScenarioKnowledgeRequirement(
      graph, requirement.id, requirement.scenarioId,
    ) !== undefined;
    const receipts = graph.knowledgeReceipts.filter((receipt) =>
      receipt.requirementId === requirement.id
    );
    const matchedReceipt = receipts.length === 1 &&
      receipts[0]?.scenarioId === requirement.scenarioId &&
      receipts[0].domain === requirement.domain
        ? receipts[0]
        : undefined;
    if (satisfiedScenarioKnowledgeReceipt(graph, requirement) !== undefined) {
      return [];
    }
    return [{
      requirement,
      ...(uniqueOwner && matchedReceipt !== undefined
        ? { receipt: matchedReceipt }
        : {}),
    }];
  });
}

function graphObligations(
  graph: GameplayScenarioGraph,
  scenarioById: ReadonlyMap<string, GameplayScenarioGraph["scenarios"][number]>,
): AuditObligation[] {
  const items: AuditObligation[] = [];

  for (const link of graph.causalLinks) {
    if (
      link.status !== "RUNTIME_BLOCKED" &&
      link.status !== "DETECTION_GAP"
    ) {
      continue;
    }
    const scenario = scenarioById.get(link.scenarioId);
    items.push(normalize({
      id: link.id,
      source:
        link.status === "RUNTIME_BLOCKED"
          ? "runtime-proof"
          : "detection-gap",
      stage:
        link.status === "RUNTIME_BLOCKED"
          ? "PROVE"
          : "UNDERSTAND",
      title:
        link.status === "RUNTIME_BLOCKED"
          ? "Resolve runtime-dependent gameplay evidence"
          : "Resolve gameplay detection gap",
      reason: link.reason,
      missingProof:
        link.status === "RUNTIME_BLOCKED"
          ? "One narrow deciding runtime observation for the unresolved gameplay dependency."
          : "Selected-artifact semantic evidence sufficient to understand and causally classify the gameplay dependency.",
      validationTest:
        link.status === "RUNTIME_BLOCKED"
          ? "Run only the narrow unresolved runtime dependency for scenario '" +
            (scenario?.label ?? link.scenarioId) +
            "'. Promote to a finding only if the observation proves a wrong player-visible outcome."
          : "Resolve the semantic owner and gameplay effect for this dependency, then rerun causal contradiction analysis before issue classification.",
      validationGroupKey:
        (scenario?.id ?? link.scenarioId) +
        ":" +
        (
          link.status === "RUNTIME_BLOCKED"
            ? "runtime-proof"
            : "detection-gap"
        ),
      subjectIds: link.subjectIds,
      componentIds: link.componentIds,
      evidenceIds: link.evidenceIds,
    }));
  }

  for (const { requirement, receipt } of unresolvedKnowledgeRequirements(graph)) {
    const scenario = scenarioById.get(requirement.scenarioId);
    items.push(normalize({
      id: "knowledge-gap:" + requirement.id,
      source: "knowledge-gap",
      stage: "PROVE",
      title:
        "Resolve required " + requirement.domain + " knowledge",
      reason: receipt?.reason ??
        "Required knowledge has no unique, evidenced SATISFIED receipt for its owning scenario and domain.",
      missingProof:
        "One matching SATISFIED receipt with scenario-scoped " +
        requirement.domain + " evidence sufficient to decide the dependency.",
      validationTest:
        "Resolve the " +
        requirement.domain +
        " dependency for scenario '" +
        (scenario?.label ?? requirement.scenarioId) +
        "' before classifying any gameplay issue.",
      validationGroupKey:
        requirement.scenarioId + ":" + requirement.domain,
      subjectIds: [
        ...requirement.subjectIds,
        ...(receipt?.subjectIds ?? []),
      ],
      componentIds: [
        ...requirement.componentIds,
        ...(receipt?.componentIds ?? []),
      ],
      evidenceIds: receipt?.evidenceIds ?? [],
    }));
  }

  // A receipt without a matching requirement owner (ID + scenario +
  // domain) is structural residue, even when its status says SATISFIED.
  // Do not transfer its unscoped evidence into causal proof. The earliest
  // outstanding work is FORMALIZE, before any PROVE knowledge saturation.
  for (const receipt of graph.knowledgeReceipts) {
    if (graph.knowledgeRequirements.some((requirement) =>
      requirement.id === receipt.requirementId &&
      requirement.scenarioId === receipt.scenarioId &&
      requirement.domain === receipt.domain
    )) continue;

    items.push(normalize({
      id: "knowledge-gap:" + receipt.requirementId,
      source: "knowledge-gap",
      stage: "FORMALIZE",
      title: "Resolve orphaned Knowledge receipt " + receipt.requirementId,
      reason: "A Knowledge receipt with status " + receipt.status +
        " has no matching requirement owner in this scenario/domain.",
      missingProof:
        "A matching scenario/domain Knowledge requirement and rederived " +
        "receipt, or evidence-backed removal of the orphaned receipt.",
      validationTest:
        "Trace the exact requirement ID, scenario and Knowledge domain; " +
        "rebuild the canonical inspection graph before PROVE or publication.",
      validationGroupKey:
        "knowledge-receipt-owner:" + receipt.requirementId,
      subjectIds: receipt.subjectIds,
      componentIds: receipt.componentIds,
      // A detached receipt's evidence cannot claim selected-artifact
      // authority before its missing scenario/requirement link is repaired.
      evidenceIds: [],
    }));
  }

  for (const scenario of graph.scenarios) {
    if (
      scenario.composedScenarioIds.length === 0 &&
      scenario.componentIds.length > 0 &&
      scenario.causalLinkIds.length === 0
    ) {
      items.push(normalize({
        id: "shallow-scenario:" + scenario.id,
        source: "scenario-coverage",
        stage: "UNDERSTAND",
        title:
          "Ground causal dependencies for " + scenario.label,
        reason:
          "The gameplay scenario has selected-artifact components but no causal proof edge.",
        missingProof:
          "At least one scenario-scoped causal dependency and deciding evidence.",
        validationTest:
          "Trace scenario '" +
          scenario.label +
          "' through success and failure exits and bind every required transition to causal evidence.",
        validationGroupKey:
          scenario.id + ":scenario-closure",
        subjectIds: scenario.sourceSubjectIds,
        componentIds: scenario.componentIds,
        evidenceIds: [],
      }));
    }

    if (
      scenario.composedScenarioIds.length === 0 &&
      scenario.componentIds.length === 0
    ) {
      items.push(normalize({
        id: "scenario-without-components:" + scenario.id,
        source: "graph-structure",
        stage: "UNDERSTAND",
        title:
          "Bind scenario to selected-artifact components",
        reason:
          "The gameplay scenario exists without concrete selected-artifact component binding.",
        missingProof:
          "Selected-artifact scripts/functions/entities/state implementing the scenario.",
        validationTest:
          "Trace scenario '" +
          scenario.label +
          "' to the concrete selected-artifact components that implement it.",
        validationGroupKey:
          "scenario-components:" + scenario.id,
        subjectIds: scenario.sourceSubjectIds,
        componentIds: [],
        evidenceIds: [],
      }));
    }
  }

  const scenarioIds = new Set(
    graph.scenarios.map((item) => item.id),
  );
  for (const scenario of graph.scenarios) {
    const missingChildren =
      scenario.composedScenarioIds.filter(
        (id) => !scenarioIds.has(id),
      );
    if (missingChildren.length === 0) continue;
    items.push(normalize({
      id: "incomplete-composition:" + scenario.id,
      source: "graph-structure",
      stage: "UNDERSTAND",
      title:
        "Complete scenario composition for " + scenario.label,
      reason:
        "Composed gameplay references missing child scenario(s): " +
        missingChildren.sort().join(", ") +
        ".",
      missingProof:
        "Concrete child-scenario coverage for every composed path.",
      validationTest:
        "Trace the composed gameplay flow for '" +
        scenario.label +
        "' and account for each missing child path before issue classification.",
      validationGroupKey:
        "scenario-composition:" + scenario.id,
      subjectIds: scenario.sourceSubjectIds,
      componentIds: scenario.componentIds,
      evidenceIds: [],
    }));
  }

  for (const component of graph.components) {
    if (!component.orphan && component.gameplayPurpose.trim()) {
      continue;
    }
    const orphan = component.orphan;
    items.push(normalize({
      id:
        (orphan
          ? "orphan-component:"
          : "missing-purpose:") +
        component.id,
      source: "graph-structure",
      stage: "UNDERSTAND",
      title:
        orphan
          ? "Resolve orphan component " + component.label
          : "Ground gameplay purpose for " + component.label,
      reason:
        orphan
          ? "Component is not correlated to any material gameplay scenario."
          : "Component has no grounded gameplay purpose.",
      missingProof:
        "Concrete gameplay purpose, semantic owner, and scenario dependency.",
      validationTest:
        "Trace " +
        component.label +
        " from selected-artifact execution/state evidence to its observable gameplay role. Do not classify it as a bug unless a causal gameplay contradiction is established.",
      validationGroupKey:
        "component-coverage:" + component.id,
      subjectIds: [component.id],
      componentIds: [component.id],
      evidenceIds: component.evidenceIds,
    }));
  }

  return items;
}

function resolutionObligations(
  gate: GameplayDefectResolutionGate,
  scenarioById: ReadonlyMap<string, GameplayScenarioGraph["scenarios"][number]>,
  linkById: ReadonlyMap<string, GameplayScenarioGraph["causalLinks"][number]>,
): AuditObligation[] {
  const items: AuditObligation[] = [];

  for (const resolution of gate.resolutions) {
    if (
      resolution.disposition !== "GAMEPLAY_TRANSLATION_REQUIRED" &&
      resolution.disposition !== "COUNTERPROOF_SEARCH_REQUIRED" &&
      resolution.disposition !== "RUNTIME_PROOF_REQUIRED" &&
      resolution.disposition !== "DETECTION_GAP"
    ) {
      continue;
    }

    const link = linkById.get(resolution.causalLinkId);
    if (!link) continue;
    const scenario = scenarioById.get(link.scenarioId);
    const label =
      scenario?.label ?? link.scenarioId;

    if (
      resolution.disposition ===
      "GAMEPLAY_TRANSLATION_REQUIRED"
    ) {
      items.push(normalize({
        id: resolution.causalLinkId,
        source: "gameplay-translation",
        stage: "PROVE",
        title:
          "Translate technical contradiction into gameplay impact",
        reason:
          "A source contradiction exists, but its player-visible defect contract is incomplete.",
        missingProof:
          "Concrete trigger, expected outcome, actual outcome, player-visible consequence, and affected scope.",
        validationTest:
          "Translate the contradicted dependency for scenario '" +
          label +
          "' using selected-artifact evidence. This is analysis work, not a tester bug claim.",
        validationGroupKey:
          label + ":gameplay-translation",
        subjectIds: link.subjectIds,
        componentIds: link.componentIds,
        evidenceIds: [
          ...link.evidenceIds,
          ...(resolution.evidenceIds ?? []),
        ],
      }));
      continue;
    }

    if (
      resolution.disposition ===
      "COUNTERPROOF_SEARCH_REQUIRED"
    ) {
      items.push(normalize({
        id: resolution.causalLinkId,
        source: "counterproof-search",
        stage: "PROVE",
        title: "Complete blocking counter-proof search",
        reason:
          "A translated contradiction exists, but a reachable guard/owner/scope/generation/cleanup/exclusion may still prevent the wrong state.",
        missingProof:
          "Bounded exhaustive counter-proof receipt for the exact contradicted commit/dependency.",
        validationTest:
          "Search only the exact contradicted dependency for blocking guard, scope, exclusion, owner, generation, and cleanup proof. Promote only after the search is exhaustive and returns NO_BLOCKING_PROOF.",
        validationGroupKey:
          label + ":counterproof",
        subjectIds: link.subjectIds,
        componentIds: link.componentIds,
        evidenceIds: [
          ...link.evidenceIds,
          ...(resolution.evidenceIds ?? []),
        ],
      }));
      continue;
    }

    if (
      resolution.disposition ===
      "RUNTIME_PROOF_REQUIRED"
    ) {
      items.push(normalize({
        id: resolution.causalLinkId,
        source: "runtime-proof",
        stage: "PROVE",
        title: "Resolve irreducible runtime behavior",
        reason:
          resolution.runtimeReason ??
          "The dependency cannot be decided safely from static/package evidence.",
        missingProof:
          "One narrow deciding runtime observation bound to the selected artifact/runtime profile.",
        validationTest:
          resolution.narrowRuntimeQuestion ??
          (
            "Observe only the unresolved runtime dependency for scenario '" +
            label +
            "'. Promote only if the observation proves a wrong player-visible outcome."
          ),
        validationGroupKey:
          label + ":runtime-proof",
        subjectIds: link.subjectIds,
        componentIds: link.componentIds,
        evidenceIds: [
          ...link.evidenceIds,
          ...(resolution.evidenceIds ?? []),
        ],
      }));
      continue;
    }

    items.push(normalize({
      id: resolution.causalLinkId,
      source: "detection-gap",
      stage: "PROVE",
      title: "Resolve detection capability gap",
      reason:
        resolution.detectionGapReason ??
        "The selected artifact exposes a semantic/detection gap that prevents reliable causal classification.",
      missingProof:
        resolution.missingCapability
          ? "Analysis capability: " +
            resolution.missingCapability
          : "Selected-artifact semantic evidence sufficient to causally classify the dependency.",
      validationTest:
        "Resolve the missing semantic/capability evidence for scenario '" +
        label +
        "', then rerun causal analysis. Do not promote from absence of analysis alone.",
      validationGroupKey:
        label + ":detection-gap",
      subjectIds: link.subjectIds,
      componentIds: link.componentIds,
      evidenceIds: [
        ...link.evidenceIds,
        ...(resolution.evidenceIds ?? []),
      ],
    }));
  }

  return items;
}

function unmappedUserInputObligations(
  userIntent: AuditUserIntentEnvelope | undefined,
): AuditObligation[] {
  if (userIntent === undefined) return [];

  const fragments = new Map(
    userIntent.fragments.map(
      (fragment) => [fragment.id, fragment],
    ),
  );

  return userIntent.unmappedFragmentIds.flatMap(
    (id) => {
      const fragment = fragments.get(id);
      if (!fragment) return [];

      return [normalize({
        id: "user-input-unmapped:" + id,
        source: "user-input-unmapped",
        stage: "DISCOVERY",
        title:
          "Resolve unmapped user input",
        reason:
          "A material part of the user's prompt was preserved but could not yet be translated safely into a bounded symptom, suspicion, claim, scope, constraint, or historical hint: " +
          fragment.raw,
        missingProof:
          "A bounded interpretation grounded enough to route this prompt fragment into search guidance, or an explicit evidence-backed not-applicable disposition.",
        validationTest:
          "Interpret this prompt fragment conservatively, preserve alternative meanings when needed, and route it only as non-authoritative search guidance. Do not create a gameplay issue from the wording alone.",
        validationGroupKey:
          "user-input-unmapped:" + id,
        subjectIds: [],
        componentIds: [],
        evidenceIds: [],
      })];
    },
  );
}

function userIntentCoverageObligations(
  userIntent: AuditUserIntentEnvelope | undefined,
  world: GameplayWorldModel,
  graph: GameplayScenarioGraph,
): AuditObligation[] {
  if (userIntent === undefined) return [];

  const symptoms = userIntent.items.filter(
    (item) => item.kind === "SYMPTOM_REPORT",
  );
  if (symptoms.length === 0) return [];

  const surfaces = new Set(
    world.surfaceDiscovery.surfaceIds,
  );
  const scenarios = graph.scenarios;

  const covered = (
    domain:
      AuditUserIntentEnvelope["priorityDomains"][number],
  ): boolean => {
    switch (domain) {
      case "arena-multi-arena":
        return (
          world.arenas.detected ||
          [...surfaces].some((id) =>
            id.startsWith("runtime:arena")
          )
        );
      case "inventory-economy":
        return (
          surfaces.has("runtime:inventory") ||
          surfaces.has("runtime:economy")
        );
      case "progression-wave-objective":
        return scenarios.some((scenario) =>
          scenario.gameplayStage === "PROGRESSION" ||
          /wave|objective|level|progress/i.test(
            scenario.label,
          )
        );
      case "chunk-simulation":
        return surfaces.has("runtime:chunks");
      case "player-lifecycle":
        return (
          surfaces.has("runtime:teleport") ||
          scenarios.some((scenario) =>
            scenario.gameplayStage === "ENTRY_JOIN" ||
            scenario.gameplayStage === "RECOVERY" ||
            /join|leave|death|respawn|reconnect|recovery/i.test(
              scenario.label,
            )
          )
        );
      case "entity-ai-combat":
        return (
          surfaces.has("runtime:entities") ||
          surfaces.has("runtime:combat")
        );
      case "world-structure-mutation":
        return (
          surfaces.has("runtime:structures") ||
          surfaces.has("runtime:spatial")
        );
      case "ui-feedback-information":
        return (
          surfaces.has("runtime:ui-form") ||
          scenarios.some((scenario) =>
            /ui|form|dialogue|message|indicator|display|hud/i.test(
              scenario.label,
            )
          )
        );
      case "state-ownership":
        return surfaces.has("runtime:state");
      case "temporal-async":
        return (
          surfaces.has(
            "runtime:async-command-transaction",
          ) ||
          surfaces.has("runtime:dynamic-command") ||
          scenarios.some((scenario) =>
            /async|deferred|timer|delay|callback|timeout/i.test(
              scenario.label,
            )
          )
        );
      case "boundary-capacity":
        return (
          surfaces.has("runtime:boundaries") ||
          surfaces.has("runtime:arena-capacity")
        );
      case "persistence-recovery":
        return surfaces.has("runtime:persistence");
      case "platform-performance":
        return (
          surfaces.has("runtime:environment") ||
          world.platformKnowledge.claims.length > 0
        );
    }
  };

  const uncoveredDomains =
    userIntent.priorityDomains.filter(
      (domain) => !covered(domain),
    );

  const items: AuditObligation[] =
    uncoveredDomains.map((domain) =>
      normalize({
        id:
          "user-symptom-uncovered-domain:" +
          domain,
        source: "user-reported-symptom",
        stage: "DISCOVERY",
        title:
          "Reconcile user-reported symptom with " +
          domain,
        reason:
          "The user reported a potentially material symptom and raised " +
          domain +
          " as a search priority, but the selected-artifact audit has not yet discovered a sufficient matching gameplay surface/scenario. The user report is not proof that the domain exists or is broken.",
        missingProof:
          "Selected-artifact evidence that either identifies the implementing gameplay surface/scenario or proves this interpretation is not applicable to the selected map/version.",
        validationTest:
          "Re-check discovery/semantic ownership for " +
          domain +
          " using the selected artifact. If no matching gameplay mechanism exists, retain an evidence-backed not-applicable explanation rather than inventing a bug.",
        validationGroupKey:
          "user-input:" + domain,
        subjectIds: [],
        componentIds: [],
        evidenceIds: [],
      })
    );

  if (
    userIntent.priorityDomains.length === 0 &&
    userIntent.priorityPlayerFlows.length === 0
  ) {
    items.push(normalize({
      id: "user-symptom-unmapped",
      source: "user-reported-symptom",
      stage: "DISCOVERY",
      title:
        "Map user-reported symptom to selected-artifact gameplay",
      reason:
        "The user reported one or more symptoms, but the translated intake has no bounded priority domain or player-flow mapping yet.",
      missingProof:
        "A bounded selected-artifact gameplay/domain interpretation for the reported symptom.",
      validationTest:
        "Map the reported symptom to all cheap plausible selected-artifact gameplay mechanisms, preserve alternatives when ambiguous, and do not classify an issue until evidence resolves the interpretation.",
      validationGroupKey:
        "user-input:unmapped-symptom",
      subjectIds: [],
      componentIds: [],
      evidenceIds: [],
    }));
  }

  return items;
}

function closureObligations(
  closure: GameplayModelClosureResult,
): AuditObligation[] {
  const items: AuditObligation[] = [];

  for (const surface of closure.surfaces) {
    if (
      !surface.material ||
      (
        surface.status !== "unknown" &&
        surface.status !== "blocked"
      )
    ) {
      continue;
    }
    items.push(normalize({
      id: "closure-surface:" + surface.id,
      source: "gameplay-closure",
      stage: "UNDERSTAND",
      title:
        "Resolve gameplay surface " + surface.label,
      reason:
        surface.reason ??
        "Material gameplay surface remains unresolved.",
      missingProof:
        "Decisive selected-artifact evidence for " +
        surface.label +
        ".",
      validationTest:
        "Resolve " +
        surface.label +
        " through its normal and failure/recovery path before deciding whether a gameplay issue exists.",
      validationGroupKey:
        "closure-surface:" + surface.id,
      subjectIds: [surface.id],
      componentIds: [],
      evidenceIds: surface.evidenceIds ?? [],
    }));
  }

  for (const id of closure.unaccountedSurfaceIds) {
    items.push(normalize({
      id: "unaccounted-surface:" + id,
      source: "gameplay-closure",
      stage: "UNDERSTAND",
      title: "Account discovered surface " + id,
      reason:
        "A discovered material surface is not represented in Gameplay Model Closure.",
      missingProof:
        "Semantic ownership, gameplay purpose, dependencies, and proof path.",
      validationTest:
        "Trace " +
        id +
        " from trigger through state mutation and exit, then rerun causal analysis.",
      validationGroupKey:
        "unaccounted-surface:" + id,
      subjectIds: [id],
      componentIds: [],
      evidenceIds: [],
    }));
  }

  if (!closure.stateModelComplete) {
    items.push(normalize({
      id: "closure-gap:state-model",
      source: "gameplay-closure",
      stage: "UNDERSTAND",
      title: "Complete material state model",
      reason:
        "Gameplay Model Closure reports stateModelComplete=false.",
      missingProof:
        "Complete material state ownership and lifecycle coverage.",
      validationTest:
        "Complete create/read/write/clear/lifetime ownership for material gameplay state before issue classification.",
      validationGroupKey: "closure:state-model",
      subjectIds: [],
      componentIds: [],
      evidenceIds: [],
    }));
  }

  if (!closure.boundariesExtracted) {
    items.push(normalize({
      id: "closure-gap:boundaries",
      source: "gameplay-closure",
      stage: "FORMALIZE",
      title: "Complete material gameplay boundaries",
      reason:
        "Gameplay Model Closure reports boundariesExtracted=false.",
      missingProof:
        "Complete boundary registry and below/at/above semantics.",
      validationTest:
        "Resolve each material boundary at N-1, N, and N+1 (or equivalent first/final points) before classifying a boundary defect.",
      validationGroupKey: "closure:boundaries",
      subjectIds: [],
      componentIds: [],
      evidenceIds: [],
    }));
  }

  return items;
}

/** Non-finding FORMALIZE residue shared by the obligation list and honesty gate. */
export function capabilityDeliveryObligations(
  assessments: readonly GameplayCapabilityDeliveryAssessment[],
  graph: GameplayScenarioGraph,
): readonly AuditObligation[] {
  if (assessments.length === 0) {
    return [normalize({
      id: "capability-delivery:unassessed",
      source: "gameplay-closure",
      stage: "FORMALIZE",
      title: "Account for selected-artifact gameplay capabilities",
      reason: "No capability delivery assessment was produced; an empty list is not proof of no applicable capability or successful delivery.",
      missingProof: "Selected-artifact gameplay capability inventory and applicability, including unresolved source and intent surfaces.",
      validationTest: "Reconcile discovered player-facing mechanics against intent and source/model capability assessments. Preserve UNKNOWN where purpose or activation is ungrounded.",
      validationGroupKey: "formalize:capability-delivery",
      subjectIds: [],
      componentIds: [],
      evidenceIds: [],
    })];
  }

  const unproven = assessments
    .filter(item => item.status === "UNPROVEN")
    .map(item => normalize({
      id: "capability-delivery:" + item.subjectId,
      source: "gameplay-closure",
      stage: "FORMALIZE",
      title: "Ground capability delivery for " + item.label,
      reason: item.reason,
      missingProof: "Selected-artifact evidence of designed player-visible behavior, implementation, ownership and effect; source classification does not prove runtime delivery.",
      validationTest: "Trace the selected capability through intent, activation guards, effects and player-visible delivery. Retain narrow native-runtime uncertainty.",
      validationGroupKey: "formalize:capability-delivery:" + item.subjectId,
      subjectIds: [item.subjectId],
      componentIds: [],
      evidenceIds: item.evidenceIds,
    }));

  // A model-classified failure cannot be promoted without a grounded
  // CONTRADICTED causal link. Preserve a PROVE obligation for the missing
  // relation rather than assuming a particular root cause or player impact.
  const discrepant = assessments.filter(item =>
    item.status === "DEGRADED" || item.status === "MISSING"
  );
  const contradictedLinks = graph.causalLinks.filter(link =>
    link.status === "CONTRADICTED"
  );
  const scenarioById = firstById(graph.scenarios);
  const unroutedFailures = discrepant
    .filter(item => !contradictedLinks.some(link =>
      capabilityDeliveryMatchesScope(
        item.subjectId,
        scenarioById.get(link.scenarioId)?.label,
        link.subjectIds,
        link.componentIds,
      )
    ))
    .map(item => normalize({
      id: "capability-delivery:unrouted:" + item.subjectId,
      source: "gameplay-translation",
      stage: "PROVE",
      title: "Trace capability discrepancy for " + item.label,
      reason: item.reason +
        " No matching CONTRADICTED causal link is grounded in the selected map.",
      missingProof: "A selected-artifact causal link connecting this capability discrepancy to a reachable player-visible dependency and scoped expected/actual contradiction.",
      validationTest: "Trace this capability through its exact owner, activation, effect and player consequence; seek blocking evidence before deciding whether a causal contradiction exists. Do not classify it as a BUG without PROVE.",
      validationGroupKey: "prove:capability-delivery:" + item.subjectId,
      subjectIds: [item.subjectId],
      componentIds: [],
      evidenceIds: item.evidenceIds,
    }));

  return [...unproven, ...unroutedFailures];
}

function mandatoryCrossSystemCoverageObligations(
  procedure: MandatoryAuditProcedureReceipt | undefined,
): AuditObligation[] {
  const checkpoint = procedure?.checkpoints.find((item) => item.id === "C9");
  if (
    checkpoint === undefined ||
    checkpoint.status === "CLOSED" ||
    checkpoint.status === "NOT_APPLICABLE"
  ) return [];

  const missing = checkpoint.obligations.filter(
    (item) => item.required && !item.satisfied,
  );
  // Project the existing checkpoint decision; do not independently recompute
  // scenario admission or treat checkpoint IDs as selected-source evidence.
  return [normalize({
    id: "mandatory-checkpoint:C9",
    source: "scenario-coverage",
    stage: "EVALUATE",
    title: "Resolve required cross-system scenario coverage (C9)",
    reason: checkpoint.reason,
    missingProof: missing.length > 0
      ? missing.map((item) => item.id + ": " + item.reason).join(" ")
      : "Complete selected-artifact discovery or establish the outstanding cross-system applicability and evidence.",
    validationTest:
      "Reconcile every required preset against source-bound components, scenario-scoped causal links and its knowledge receipts; resolve missing identities and rerun the existing checkpoint. This is not proof of a bug or runtime success.",
    validationGroupKey: "mandatory:C9",
    subjectIds: [],
    componentIds: [],
    evidenceIds: checkpoint.evidenceIds,
  })];
}

/**
 * Derive next-source-proof questions from the CURRENT map, not from its
 * genre or a universal list of mechanics. Already reviewed typed pairs
 * narrow the question; they do not prove guards, ownership, player impact
 * or intended gameplay. A source root is a candidate entry, never execution.
 */
function unknownSourceProofRequirements(
  graph: GameplayScenarioGraph,
  intent: GameplayIntentModel | undefined,
  unknownIds: readonly string[],
): readonly AuditUnknownSourceProofRequirement[] {
  if (!intent?.artifactId) return [];
  const currentEvidence = new Set(intent.evidence.filter(item =>
    item.origin === "source-code" &&
    item.scope === "selected-artifact" &&
    item.locator.trim().length > 0).map(item => item.id));
  const byUnknown = new Map<string, GameplayIntentModel["unknowns"][number][]>();
  for (const unknown of intent.unknowns) {
    const owners = byUnknown.get(unknown.id) ?? [];
    owners.push(unknown);
    byUnknown.set(unknown.id, owners);
  }
  const byEntry = new Map<string,
    NonNullable<GameplayScenarioGraph["sourceFlowCandidates"]>[number][]>();
  for (const flow of graph.sourceFlowCandidates ?? []) {
    const matches = byEntry.get(flow.entryRegionId) ?? [];
    matches.push(flow);
    byEntry.set(flow.entryRegionId, matches);
  }

  return [...new Set(unknownIds)].sort().map(unknownId => {
    const owners = byUnknown.get(unknownId) ?? [];
    const unknown = owners.length === 1 ? owners[0] : undefined;
    const owned = new Set((unknown?.evidenceIds ?? []).filter(id =>
      currentEvidence.has(id)));
    const entries = unknown?.sourceEntryRegionId === undefined ? [] :
      (byEntry.get(unknown.sourceEntryRegionId) ?? [])
        .filter(flow => flow.sourceTraceStatus === "SOURCE_ROOT_TRACE" &&
          flow.sourceSteps.some(step =>
            owned.has(step.id) && step.source.artifactId === intent.artifactId));
    const source = entries.length === 1 ? entries[0] : undefined;
    const steps = source?.sourceSteps.filter(step =>
      owned.has(step.id) &&
      step.source.artifactId === intent.artifactId) ?? [];
    // Bounded display IDs cannot decide whether a later source-pair
    // witness exists. Check the complete current selected-entry scope.
    const allExactIds = new Set(steps.map(step => step.id));
    const sourceEvidenceIds = unique(steps.map(step => step.id)).slice(0, 16);
    const reviewed = (graph.reviewedSourceRelationships ?? []).filter(item =>
      item.unknownId === unknownId &&
      item.sourceEntryRegionId === unknown?.sourceEntryRegionId &&
      unknown?.sourceRelations?.some(relation =>
        relation.sourceClaim === item.sourceClaim &&
        relation.fromStepId === item.fromStepId &&
        relation.toStepId === item.toStepId) &&
      [item.fromStepId, item.toStepId].every(id =>
        allExactIds.has(id)));
    // Intended gameplay is always a separate authority from source syntax.
    // Lead with this decisive unknown so bounded summaries never omit it.
    const missing: string[] = [
      "Tetapkan tujuan dan expected outcome mekanik " + unknownId +
        " dari bukti desain/presentasi map yang benar-benar berlaku, lalu " +
        "hubungkan ke jalur pemain; jangan gunakan interpretasi AI sebagai bukti.",
    ];
    if (source === undefined) {
      missing.push("Buktikan satu entry source terhubung dan tidak ambigu untuk " +
        unknownId + "; hubungan di file atau nama yang mirip belum cukup.");
    } else {
      const ids = (kind: typeof steps[number]["kind"], operations?: readonly string[]) =>
        unique(steps.filter(step => step.kind === kind &&
          (operations === undefined || operations.includes(step.operation ?? "")))
          .map(step => step.id)).slice(0, 4);
      const writes = ids("state", ["write", "clear", "delete"]);
      const resources = ids("resource-action");
      const effects = ids("world-effect");
      const returns = ids("return");
      // All questions below are triggered by typed operations in the
      // selected source. Never use a map name, filename or genre as a rule.
      if (source.unresolvedExecutionEdgeIds.length > 0) {
        missing.push("Tentukan target pemanggilan source yang masih ambigu: " +
          source.unresolvedExecutionEdgeIds.slice(0, 3).join(", ") + ".");
      }
      for (const relation of reviewed.slice(0, 4)) {
        if (relation.sourceClaim === "SOURCE_GUARD_VALUE_HANDOFF_CANDIDATE") {
          missing.push("Hubungan source " + relation.fromStepId +
            " → " + relation.toStepId + " sudah dicatat. Buktikan kelayakan " +
            "guard, pemilik state dan penerima efek pada sesi pemain yang sama.");
        } else {
          missing.push("Hubungan efek " + relation.fromStepId +
            " → hasil fungsi " + relation.toStepId + " sudah dicatat. " +
            "Buktikan kapan hasil itu dicapai dan apakah memengaruhi hasil gameplay pemain.");
        }
      }
      if (writes.length > 0) {
        missing.push("Telusuri pemilik, scope pemain/arena/sesi dan reset " +
          "untuk operasi state " + writes.join(", ") + ".");
      }
      if (resources.length > 0) {
        missing.push("Periksa siklus acquire/use/release pada operasi resource " +
          resources.join(", ") + ", termasuk jalur gagal dan keluar.");
      }
      if (effects.length > 0) {
        missing.push("Buktikan guard, target dan jangkauan efek dunia " +
          effects.join(", ") + " pada entry source ini.");
      }
      if (returns.length > 0 &&
          !reviewed.some(item =>
            item.sourceClaim === "SOURCE_EFFECT_RETURN_CANDIDATE")) {
        missing.push("Tentukan hubungan hasil fungsi " + returns.join(", ") +
          " dengan efek sebelumnya dan kondisi hasil pemain.");
      }
      if (reviewed.length === 0 && steps.length > 1) {
        missing.push("Cari hubungan langsung antara operasi source " +
          sourceEvidenceIds.slice(0, 4).join(", ") +
          "; jangan menganggap urutan source sebagai urutan gameplay.");
      }
    }
    return {
      unknownId,
      sourceEvidenceIds,
      missingClaims: [...new Set(missing)].slice(0, 9),
    };
  });
}

export function deriveAuditObligations(input: {
  readonly graph: GameplayScenarioGraph;
  /** Source-only per-map understanding, never a model-proposed design rule. */
  readonly intent?: GameplayIntentModel;
  readonly mandatoryAuditProcedure?: MandatoryAuditProcedureReceipt;
  readonly defectResolution: GameplayDefectResolutionGate;
  readonly gameplayWorld: GameplayWorldModel;
  readonly capabilityDelivery:
    readonly GameplayCapabilityDeliveryAssessment[];
  readonly userIntent?: AuditUserIntentEnvelope;
  readonly gameplayClosure: GameplayModelClosureResult;
  readonly discovery?: GameplayDiscoveryClosure;
  readonly negativeSpace: readonly NegativeSpaceSignal[];
  readonly temporalRisks: readonly TemporalInteractionRisk[];
  readonly discoveryChallenges:
    readonly GameplayDiscoveryChallengeSignal[];
  readonly sharedResourceSignals:
    readonly SharedResourceOwnershipSignal[];
  readonly compoundBoundaries:
    readonly CompoundBoundarySignal[];
  readonly accumulationGrowth:
    readonly AccumulationGrowthSignal[];
  readonly capabilityExposure?: CapabilityExposureSummary;
  readonly replicaDivergenceIds?: readonly string[];
}): readonly AuditObligation[] {
  // Both graph and resolution projection look up the same selected-map links.
  // Index once rather than searching an ever-larger graph per obligation.
  const scenarioById = firstById(input.graph.scenarios);
  const linkById = firstById(input.graph.causalLinks);
  const items: AuditObligation[] = [
    ...mandatoryCrossSystemCoverageObligations(input.mandatoryAuditProcedure),
    ...graphObligations(input.graph, scenarioById),
    ...closureObligations(input.gameplayClosure),
    ...capabilityDeliveryObligations(input.capabilityDelivery, input.graph),
    ...resolutionObligations(
      input.defectResolution,
      scenarioById,
      linkById,
    ),
    ...unmappedUserInputObligations(
      input.userIntent,
    ),
    ...userIntentCoverageObligations(
      input.userIntent,
      input.gameplayWorld,
      input.graph,
    ),
  ];

  // Group semantic debt while retaining every affected path or unknown ID.
  if (input.discovery && input.discovery.semanticUnderstandingGapPaths.length > 0) {
    items.push(normalize({
      id: "indexed-source-semantic-coverage",
      source: "detection-gap",
      stage: "UNDERSTAND",
      title: "Interpret indexed gameplay source definitions",
      reason: String(input.discovery.semanticUnderstandingGaps) +
        " indexed gameplay source(s) lack domain semantics.",
      missingProof: "Domain semantics and causal relationships for the affected paths.",
      validationTest: "Reconcile source definitions through existing domain analyzers and gameplay intent.",
      validationGroupKey: "understand:indexed-source-semantics",
      subjectIds: input.discovery.semanticUnderstandingGapPaths,
      componentIds: [],
      evidenceIds: [],
    }));
  }
  if (input.discovery && input.discovery.gameplayIntentUnknownIds.length > 0) {
    const allUnknownIds = unique(input.discovery.gameplayIntentUnknownIds);
    const requirements = unknownSourceProofRequirements(
      input.graph, input.intent, allUnknownIds);
    // Prioritize entries with actual selected-source witnesses rather than
    // arbitrary unknown names. Keep ALL unknown IDs and omission counts.
    const prioritized = [...requirements].sort((a, b) =>
      b.sourceEvidenceIds.length - a.sourceEvidenceIds.length ||
      a.unknownId.localeCompare(b.unknownId));
    // Keep one existing UNDERSTAND obligation, all original unknown IDs and
    // an explicit omitted count; do not emit hundreds of micro tasks.
    const visible = prioritized.slice(0, 4);
    const omitted = Math.max(0, requirements.length - visible.length);
    const sourceQuestions = visible.flatMap(item =>
      item.missingClaims.slice(0, 4).map(question =>
        item.unknownId + ": " + question));
    const summary = sourceQuestions.length > 0
      ? sourceQuestions.join(" ") +
        (omitted > 0
          ? " " + omitted + " unknown lain tetap memerlukan pembuktian; " +
            "semua identitas dicatat dalam bagian terkait." : "")
      : "Exact source-grounded mechanic and scenario ownership for every unknown.";
    items.push(normalize({
      id: "uninterpreted-gameplay-intent",
      source: "gameplay-closure",
      stage: "UNDERSTAND",
      title: "Reconcile unclassified material gameplay",
      reason: String(allUnknownIds.length) +
        " gameplay intent unknown(s) remain unresolved. " +
        "Known source relations are not player-purpose or runtime proof.",
      missingProof: summary,
      validationTest: sourceQuestions.length > 0
        ? "Periksa hubungan operasi yang belum terbukti pada entry source " +
          "terpilih; cocokkan guard, state, efek dan outcome dengan desain " +
          "map, lalu evaluasi ulang pemeriksaan kanonis."
        : "Reconstruct the effects and mechanics for each unresolved intent identity.",
      validationGroupKey: "understand:gameplay-intent-unknowns",
      subjectIds: allUnknownIds,
      componentIds: [],
      evidenceIds: visible.flatMap(item => item.sourceEvidenceIds),
      ...(visible.length > 0 ? { sourceProofRequirements: visible } : {}),
      ...(omitted > 0 ? { omittedSourceProofRequirements: omitted } : {}),
    }));
  }

  for (const signal of input.negativeSpace) {
    items.push(normalize({
      id: signal.id,
      source: "negative-space",
      stage: "EVALUATE",
      title: "Resolve lifecycle asymmetry for " + signal.subjectId,
      reason: signal.reason,
      missingProof:
        "Scenario-scoped proof that the missing lifecycle counterpart is required, reachable, and player-visible.",
      validationTest:
        "Trace the lifecycle counterpart implied by " +
        signal.kind +
        " for " +
        signal.subjectId +
        ". Promote to a finding only if a concrete gameplay contradiction is proven.",
      validationGroupKey:
        "negative-space:" + signal.subjectId,
      subjectIds: [signal.subjectId],
      componentIds: [],
      evidenceIds: signal.evidenceIds,
    }));
  }

  for (const risk of input.temporalRisks) {
    if (risk.priority !== "high") continue;
    const id =
      "temporal-risk:" +
      risk.leftSystem +
      ":" +
      risk.rightSystem;
    items.push(normalize({
      id,
      source: "temporal-risk",
      stage: "EVALUATE",
      title:
        "Resolve temporal interaction " +
        risk.leftSystem +
        " ↔ " +
        risk.rightSystem,
      reason:
        "High-risk timing factors are present: " +
        risk.factors.join(", ") +
        ".",
      missingProof:
        "Whether stale or overlapping work can actually commit after the relevant ownership/state transition.",
      validationTest:
        risk.factors.includes("reconnect") ||
        risk.factors.includes("reload") ||
        risk.factors.includes("cleanup") ||
        risk.factors.includes("terminal-transition")
          ? "Resolve this lifecycle race from selected-artifact control flow, state ownership, generation guards, and bounded interleaving first. Do not request a reconnect/reload/terminal playtest unless native ordering remains the single irreducible fact."
          : "Prove commit ordering/ownership across before, overlap, and after windows. Promote only if stale work can reach a wrong gameplay state.",
      validationGroupKey:
        "temporal:" +
        [risk.leftSystem, risk.rightSystem]
          .sort()
          .join(":"),
      subjectIds: [
        risk.leftSystem,
        risk.rightSystem,
      ],
      componentIds: [],
      evidenceIds: [],
    }));
  }

  for (const signal of input.discoveryChallenges) {
    items.push(normalize({
      id: signal.id,
      source: "discovery-challenge",
      stage: signal.kind === "unresolved-execution-edge" ? "DISCOVERY" : "UNDERSTAND",
      title: "Resolve discovery challenge " + signal.subjectId,
      reason: signal.reason,
      missingProof:
        "Gameplay purpose, semantic owner, downstream effect, and scenario relationship.",
      validationTest:
        "Resolve " +
        signal.subjectId +
        " into its player-visible gameplay effect. If material, add it to the semantic/scenario model and rerun contradiction analysis.",
      validationGroupKey:
        "discovery-challenge:" + signal.subjectId,
      subjectIds: [signal.subjectId],
      componentIds: [],
      evidenceIds: signal.evidenceIds,
    }));
  }

  for (const signal of input.sharedResourceSignals) {
    items.push(normalize({
      id: signal.id,
      source: "shared-resource",
      stage: "EVALUATE",
      title:
        "Resolve shared-resource ownership for " +
        signal.surfaceId,
      reason: signal.reason,
      missingProof:
        "Mutual exclusion, authoritative ownership, generation scope, and ordering proof across writers.",
      validationTest:
        "Prove shared-resource ownership across overlap, cleanup, retry, reconnect, and reuse. Promote only if competing/stale writes can reach a wrong gameplay state.",
      validationGroupKey:
        "shared-resource:" + signal.surfaceId,
      subjectIds: [signal.surfaceId],
      componentIds: signal.regionIds,
      evidenceIds: signal.evidenceIds,
    }));
  }

  for (const signal of input.compoundBoundaries) {
    items.push(normalize({
      id: signal.id,
      source: "compound-boundary",
      stage: "EVALUATE",
      title:
        "Resolve compound boundary " +
        signal.dimensions.join(" × "),
      reason: signal.reason,
      missingProof:
        "Behavior at the combined boundary and whether the effective limit contradicts grounded gameplay intent.",
      validationTest:
        "Prove the combined boundary at the grounded safe point and next step. Promote only if a player-visible gameplay contradiction is established.",
      validationGroupKey: signal.id,
      subjectIds: signal.dimensions,
      componentIds: [],
      evidenceIds: signal.evidenceIds,
    }));
  }

  for (const signal of input.accumulationGrowth) {
    items.push(normalize({
      id: signal.id,
      source: "accumulation-growth",
      stage: "EVALUATE",
      title:
        "Resolve repeated-run growth for " +
        signal.subjectId,
      reason: signal.reason,
      missingProof:
        "A grounded balancing cleanup/reset path or proof that equivalent repeated runs do not accumulate state/resources.",
      validationTest:
        "Prove producer/consumer balance across repeated runs. Promote only if accumulation reaches a wrong player-visible gameplay state.",
      validationGroupKey: signal.id,
      subjectIds: [signal.subjectId],
      componentIds: [],
      evidenceIds: signal.evidenceIds,
    }));
  }


  for (const observation of input.gameplayWorld.arenas.isolation.observations) {
    if (observation.status === "isolated") continue;
    const id =
      "arena-isolation:" +
      observation.scriptId +
      ":" +
      observation.region +
      ":" +
      observation.key;
    items.push(normalize({
      id,
      source: "shared-resource",
      stage: "EVALUATE",
      title:
        "Prove arena isolation for " +
        observation.key,
      reason:
        observation.status === "shared-global"
          ? "Arena gameplay reaches a world-shared resource. Concurrent ownership/arbitration has not been proven."
          : observation.status === "partition-proof-required"
            ? "Arena gameplay reaches a potentially shared resource, but arena-context partitioning has not been proven."
            : "Arena isolation scope is unresolved for this gameplay resource.",
      missingProof:
        "Arena-specific selector/resource partitioning or explicit arbitration proving one arena cannot mutate another arena's players, entities, world state, objectives, or cleanup.",
      validationTest:
        "Trace this exact resource through two simultaneous arenas, including cleanup/reuse. Prove context translation or arena-keyed ownership before closing isolation.",
      validationGroupKey:
        "arena-isolation:" +
        observation.scriptId +
        ":" +
        observation.region,
      subjectIds: [observation.key],
      componentIds: [
        observation.scriptId,
        observation.region,
      ],
      evidenceIds: [],
    }));
  }

  for (const replica of input.gameplayWorld.arenas.replicaProof) {
    if (
      replica.status !== "incomplete-proof" &&
      replica.status !== "budget-exceeded" &&
      replica.status !== "no-proof"
    ) {
      continue;
    }
    items.push(normalize({
      id:
        "replica-proof-incomplete:" +
        replica.arenaId,
      source: "detection-gap",
      stage: "FORMALIZE",
      title:
        "Complete replica proof for " +
        replica.arenaId,
      reason:
        "This arena replica does not have sufficient world/topology proof to inherit the canonical arena's safety.",
      missingProof:
        "World/topology evidence sufficient to classify this replica as equivalent, bounded-equivalent, or materially divergent.",
      validationTest:
        "Compare this replica against the canonical arena using normalized coordinates and world/topology evidence. Do not assume source/config equality proves world equality.",
      validationGroupKey:
        "full-map-replica:" +
        replica.arenaId,
      subjectIds: [replica.arenaId],
      componentIds: [],
      evidenceIds: replica.evidenceIds,
    }));
  }

  for (const exposure of input.capabilityExposure?.exposures ?? []) {
    if (
      exposure.impact !== "progression" &&
      exposure.impact !== "state" &&
      exposure.impact !== "fairness"
    ) {
      continue;
    }

    if (exposure.status === "potentially-exposed") {
      items.push(normalize({
        id:
          "capability-reachability:" +
          exposure.capabilityId,
        source: "detection-gap",
        stage: "UNDERSTAND",
        title:
          "Prove ordinary-player reachability for " +
          exposure.capabilityLabel,
        reason:
          "A release-enabled restricted capability lacks its required authorization gate, but ordinary-player prerequisite reachability is still unresolved.",
        missingProof:
          "A complete player-accessible acquisition path or blocking proof for every required trigger prerequisite.",
        validationTest:
          "Trace player-accessible grants, containers, crafting, loot, drops, and world acquisition to the trigger. If reachable, continue to gameplay contradiction classification; if not, retain the blocking proof.",
        validationGroupKey:
          "capability-reachability:" +
          exposure.capabilityId,
        subjectIds: [exposure.capabilityId],
        componentIds: [],
        evidenceIds: exposure.evidenceIds,
      }));
    } else if (exposure.status === "exposed") {
      items.push(normalize({
        id:
          "capability-gameplay-translation:" +
          exposure.capabilityId,
        source: "gameplay-translation",
        stage: "PROVE",
        title:
          "Translate exposed restricted capability " +
          exposure.capabilityLabel,
        reason:
          "The restricted capability is release-enabled, player-triggerable, reachable, and missing its required authorization gate.",
        missingProof:
          "Concrete player-visible trigger, consequence, expected outcome, actual outcome, and affected gameplay scope.",
        validationTest:
          "Bind the exposed capability to its exact in-game trigger and player-visible consequence, then run bounded counter-proof before report admission.",
        validationGroupKey:
          "capability-exposure:" +
          exposure.capabilityId,
        subjectIds: [exposure.capabilityId],
        componentIds: [],
        evidenceIds: exposure.evidenceIds,
      }));
    }
  }

  for (const id of input.replicaDivergenceIds ?? []) {
    items.push(normalize({
      id,
      source: "replica-divergence",
      stage: "FORMALIZE",
      title: "Classify replica divergence " + id,
      reason:
        "A world/topology difference exists but its gameplay significance is not yet classified.",
      missingProof:
        "Grounded evidence showing whether the divergence is expected/non-material or affects a player-visible gameplay dependency.",
      validationTest:
        "Trace the divergent world/topology evidence to gameplay purpose. Promote only a grounded gameplay consequence into causal PROVE.",
      validationGroupKey:
        "full-map-replica:" + id,
      subjectIds: [id],
      componentIds: [],
      evidenceIds: [id],
    }));
  }

  const byId = new Map<string, AuditObligation>();
  for (const item of items) {
    const existing = byId.get(item.id);
    if (existing === undefined) {
      byId.set(item.id, item);
      continue;
    }
    // Graph source and defect resolution can describe the SAME causal link
    // with different outstanding work (e.g. UNDERSTAND detection gap vs
    // PROVE capability proof). Do not let the later projection silently
    // erase the earlier blocker or either source's evidence.
    const stageOf = (obligation: AuditObligation): number =>
      SELECTED_MAP_AUDIT_STAGE_ORDER.indexOf(obligation.stage);
    const primary = stageOf(existing) < stageOf(item) ? existing : item;
    const secondary = primary === existing ? item : existing;
    const combined = (left: string, right: string): string =>
      left === right ? left : left + " " + right;
    byId.set(item.id, {
      ...primary,
      reason: combined(primary.reason, secondary.reason),
      missingProof: combined(primary.missingProof, secondary.missingProof),
      validationTest: combined(primary.validationTest, secondary.validationTest),
      subjectIds: unique([...primary.subjectIds, ...secondary.subjectIds]),
      componentIds: unique([...primary.componentIds, ...secondary.componentIds]),
      evidenceIds: unique([...primary.evidenceIds, ...secondary.evidenceIds]),
    });
  }

  // Audit Obligations drive the bounded model-task handoff. Their order
  // follows the SAME canonical admission stages; lexical order incorrectly
  // puts EVALUATE before FORMALIZE and UNDERSTAND.
  return [...byId.values()].sort((a, b) =>
    SELECTED_MAP_AUDIT_STAGE_ORDER.indexOf(a.stage) -
      SELECTED_MAP_AUDIT_STAGE_ORDER.indexOf(b.stage) ||
    a.source.localeCompare(b.source) ||
    a.id.localeCompare(b.id)
  );
}
