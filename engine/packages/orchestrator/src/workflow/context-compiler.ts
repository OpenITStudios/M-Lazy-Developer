import type {
  GameplayIntentModel,
} from "../../../gameplay-intent/src/index.js";
import type { GameplayWorldModel } from "../inspection/gameplay-world-model.js";
import type {
  SemanticGraph,
  SemanticNode,
} from "../../../graph/src/index.js";
import type {
  SourceRef,
} from "../../../project-model/src/index.js";
import type {
  SemanticAffectedPlan,
} from "../workflow/semantic-affected-plan.js";
import type {
  RepositoryTaskPlan,
} from "../workflow/repository-task-plan.js";
import type {
  CompiledDataFlowContextSlice,
} from "../inspection/script-dataflow-context.js";
import type {
  RetrievalResult,
  SectionRetrievalResult,
} from "../../../analysis-planner/src/index.js";
import type { MinecraftRuntimeProfile } from "../../../runtime-profile/src/index.js";
import type { SemanticIr } from "../../../semantic-ir/src/index.js";
import {
  compileResourceContext,
  compileSectionContext,
  compileDeveloperPracticeReferenceContext,
  type DeveloperPracticeReferenceData,
  type CompiledDeveloperPracticeReferenceContext,
  type CompiledResourceContext,
  type CompiledSectionContext,
  type RetrievedKnowledgeContext,
} from "./resource-context.js";

export interface ContextCompilerBudget {
  maxSemanticNodes: number;
  maxSemanticEdges: number;
  maxIntentNodes: number;
  maxInvariants: number;
  maxUnknowns: number;
  maxEvidence: number;
}

export interface ContextCompilerRequest {
  goal: string;
  graph: SemanticGraph;
  intent: GameplayIntentModel;
  affected?: SemanticAffectedPlan;
  relevantSemanticNodeIds?: readonly string[];
  relevantIntentSubjectIds?: readonly string[];
  relevantInvariantIds?: readonly string[];
  relevantEvidenceIds?: readonly string[];
  worldModel?: GameplayWorldModel;
  repositoryTaskPlan?: RepositoryTaskPlan;
  dataFlowSlice?: CompiledDataFlowContextSlice;
  resourceSelection?: readonly RetrievalResult[];
  resourceLimit?: number;
  resourceKnowledge?: Readonly<Record<string, RetrievedKnowledgeContext>>;
  /** Only an actual selected-target profile may authorize applicability. */
  targetRuntimeProfile?: MinecraftRuntimeProfile;
  sectionSelection?: readonly SectionRetrievalResult[];
  sectionLimit?: number;
  /** Opt-in developer REFERENCE data; NEVER generated from Intent labels. */
  developerPractice?: {
    readonly data: DeveloperPracticeReferenceData;
    /** Canonical selected-map Semantic IR, not caller-authored signal labels. */
    readonly semanticIr: SemanticIr;
    /** Specific interpretation question domains, chosen independently. */
    readonly domains: readonly string[];
    /** Exact selected-map source locators; omitted/empty means no ZIP hints. */
    readonly sourceLocators?: readonly string[];
  };
  budget?: Partial<ContextCompilerBudget>;
}

export interface CompiledContextPack {
  schemaVersion: 1;
  goal: string;
  semantic: {
    nodes: Array<{
      id: string;
      kind: string;
      identifier: string;
      source: SourceRef;
    }>;
    edges: Array<{
      from: string;
      type: string;
      targetIdentifier: string;
      status: string;
      to?: string;
      source: SourceRef;
    }>;
    omitted: number;
    omittedEdges: number;
  };
  intent: {
    nodes: Array<{
      id: string;
      kind: string;
      label: string;
      status: string;
      evidenceIds: readonly string[];
    }>;
    invariants: Array<{
      id: string;
      statement: string;
      strength: string;
      status: string;
      subjectIds: readonly string[];
      evidenceIds: readonly string[];
    }>;
    unknowns: Array<{
      id: string;
      question: string;
      blockedSubjectIds: readonly string[];
      evidenceIds: readonly string[];
    }>;
    evidence: Array<{
      id: string;
      origin: string;
      locator: string;
      summary: string;
    }>;
  };
  world?: {
    arenaCount?: number;
    arenaBasis?: "topology" | "script-config" | "reconciled";
    objectives: readonly string[];
    phases: readonly string[];
    outcomes: readonly string[];
    lifecycle: GameplayWorldModel["arenas"]["lifecycle"];
    cleanup: GameplayWorldModel["arenas"]["cleanup"];
    isolation: GameplayWorldModel["arenas"]["isolation"];
    globalState:
      GameplayWorldModel["arenas"]["globalState"];
    persistence?: GameplayWorldModel["persistence"];
    stress:
      GameplayWorldModel["arenas"]["stress"];
    proofMode?: string;
    skippedProofLayers: readonly string[];
    broadWrites: number;
    unresolvedScriptMutations: number;
    intentUnknowns: number;
    domainSignals: Partial<{
      arenaLifecycle: number;
      spatialAuthority: number;
      inventory: number;
      entityAiNavigation: number;
      combat: number;
      chunks: number;
      economy: number;
      persistence: number;
    }>;
  };
  dataFlow?: CompiledDataFlowContextSlice;
  resources?: CompiledResourceContext;
  sections?: CompiledSectionContext;
  /** Advisory reference selection cannot close model coverage or prove a bug. */
  developerPractice?: CompiledDeveloperPracticeReferenceContext;
  executionScope?: {
    status: RepositoryTaskPlan["status"];
    affectedCapabilityIds: readonly string[];
    selectedCapabilityIds: readonly string[];
    unmatchedPaths: readonly string[];
  };
  budget: ContextCompilerBudget;
  truncation: {
    semanticNodes: number;
    semanticEdges: number;
    intentNodes: number;
    invariants: number;
    unknowns: number;
    evidence: number;
  };
  missingRequested: {
    semanticNodeIds: readonly string[];
    intentSubjectIds: readonly string[];
    invariantIds: readonly string[];
    evidenceIds: readonly string[];
  };
  complete: boolean;
  reasons: readonly string[];
}

const DEFAULT_BUDGET:
  ContextCompilerBudget = {
  maxSemanticNodes: 24,
  maxSemanticEdges: 40,
  maxIntentNodes: 20,
  maxInvariants: 16,
  maxUnknowns: 12,
  maxEvidence: 32,
};

function positiveInteger(
  value: number | undefined,
  fallback: number,
): number {
  if (value === undefined) {
    return fallback;
  }

  if (
    !Number.isInteger(value) ||
    value < 1
  ) {
    throw new Error(
      "Context compiler budgets must be positive integers.",
    );
  }

  return value;
}

function resolveBudget(
  value:
    Partial<ContextCompilerBudget> |
    undefined,
): ContextCompilerBudget {
  return {
    maxSemanticNodes:
      positiveInteger(
        value?.maxSemanticNodes,
        DEFAULT_BUDGET
          .maxSemanticNodes,
      ),
    maxSemanticEdges:
      positiveInteger(
        value?.maxSemanticEdges,
        DEFAULT_BUDGET
          .maxSemanticEdges,
      ),
    maxIntentNodes:
      positiveInteger(
        value?.maxIntentNodes,
        DEFAULT_BUDGET
          .maxIntentNodes,
      ),
    maxInvariants:
      positiveInteger(
        value?.maxInvariants,
        DEFAULT_BUDGET
          .maxInvariants,
      ),
    maxUnknowns:
      positiveInteger(
        value?.maxUnknowns,
        DEFAULT_BUDGET
          .maxUnknowns,
      ),
    maxEvidence:
      positiveInteger(
        value?.maxEvidence,
        DEFAULT_BUDGET
          .maxEvidence,
      ),
  };
}

function unique(
  values: readonly string[] |
    undefined,
): string[] {
  return [
    ...new Set(
      (values ?? []).filter(
        (value) =>
          value.trim().length > 0,
      ),
    ),
  ].sort();
}

function take<T>(
  values: readonly T[],
  maximum: number,
): {
  values: T[];
  omitted: number;
} {
  return {
    values:
      values.slice(0, maximum),
    omitted:
      Math.max(
        0,
        values.length - maximum,
      ),
  };
}

function semanticCandidates(
  graph: SemanticGraph,
  affected:
    SemanticAffectedPlan |
    undefined,
): SemanticNode[] {
  const nodes =
    graph.allNodes();

  if (
    affected?.status !== "planned"
  ) {
    return nodes;
  }

  const allowed =
    new Set(
      affected.affectedNodeIds,
    );

  return nodes.filter(
    (node) =>
      allowed.has(node.id),
  );
}

export function compileContextPack(
  input: ContextCompilerRequest,
): CompiledContextPack {
  if (!input.goal.trim()) {
    throw new Error(
      "Context compiler goal must be non-empty.",
    );
  }

  const budget =
    resolveBudget(input.budget);
  const resources =
    compileResourceContext(
      input.resourceSelection,
      input.resourceLimit,
      input.resourceKnowledge,
      input.targetRuntimeProfile,
    );
  const sections =
    compileSectionContext(
      input.sectionSelection,
      input.sectionLimit,
    );
  // Never let context from another version of the map enter the pack.
  // A reference is explicit opt-in and cannot change gameplay closure.
  const developerPractice = input.developerPractice === undefined ||
      input.intent.artifactId === undefined
    ? undefined
    : compileDeveloperPracticeReferenceContext({
        data: input.developerPractice.data,
        selectedArtifactId: input.intent.artifactId,
        semanticIr: input.developerPractice.semanticIr,
        domains: input.developerPractice.domains,
        sourceLocators: input.developerPractice.sourceLocators ?? [],
      });
  const semanticPool =
    semanticCandidates(
      input.graph,
      input.affected,
    );
  const requestedSemanticIds =
    new Set(
      unique(
        input.relevantSemanticNodeIds,
      ),
    );
  const allGraphNodes =
    input.graph.allNodes();
  const semanticById =
    new Map(
      allGraphNodes.map((node) => [
        node.id,
        node,
      ]),
    );
  const requiredSemanticNodes =
    [...requestedSemanticIds]
      .map((id) =>
        semanticById.get(id)
      )
      .filter(
        (node):
          node is SemanticNode =>
          node !== undefined,
      )
      .sort((a, b) =>
        a.id.localeCompare(b.id)
      );

  if (
    requiredSemanticNodes.length >
    budget.maxSemanticNodes
  ) {
    throw new Error(
      "Context compiler maxSemanticNodes is smaller than the explicitly required semantic node set.",
    );
  }

  const requiredSemanticSet =
    new Set(
      requiredSemanticNodes.map(
        (node) => node.id,
      ),
    );
  const optionalSemanticNodes =
    semanticPool.filter(
      (node) =>
        !requiredSemanticSet.has(
          node.id,
        ),
    );
  const semanticCapacity =
    budget.maxSemanticNodes -
    requiredSemanticNodes.length;
  const optionalSemanticSelection =
    take(
      optionalSemanticNodes,
      semanticCapacity,
    );
  const semanticSelection = {
    values: [
      ...requiredSemanticNodes,
      ...optionalSemanticSelection.values,
    ].sort((a, b) =>
      a.id.localeCompare(b.id)
    ),
    omitted:
      optionalSemanticSelection.omitted,
  };
  const selectedSemanticIds =
    new Set(
      semanticSelection.values.map(
        (node) => node.id,
      ),
    );
  const allSemanticEdges =
    input.graph.allEdges();
  const requiredSemanticEdges =
    allSemanticEdges
      .filter((edge) =>
        requiredSemanticSet.has(
          edge.from,
        ) ||
        (
          edge.to !== undefined &&
          requiredSemanticSet.has(
            edge.to,
          )
        )
      )
      .sort((a, b) =>
        a.id.localeCompare(b.id)
      );

  if (
    requiredSemanticEdges.length >
    budget.maxSemanticEdges
  ) {
    throw new Error(
      "Context compiler maxSemanticEdges is smaller than the relationships required by the explicit semantic node set.",
    );
  }

  const requiredSemanticEdgeIds =
    new Set(
      requiredSemanticEdges.map(
        (edge) => edge.id,
      ),
    );
  const optionalSemanticEdges =
    allSemanticEdges
      .filter((edge) =>
        !requiredSemanticEdgeIds.has(
          edge.id,
        ) &&
        (
          selectedSemanticIds.has(
            edge.from,
          ) ||
          (
            edge.to !== undefined &&
            selectedSemanticIds.has(
              edge.to,
            )
          )
        )
      )
      .sort((a, b) =>
        a.id.localeCompare(b.id)
      );
  const semanticEdgeCapacity =
    budget.maxSemanticEdges -
    requiredSemanticEdges.length;
  const optionalSemanticEdgeSelection =
    take(
      optionalSemanticEdges,
      semanticEdgeCapacity,
    );
  const semanticEdgeSelection = {
    values: [
      ...requiredSemanticEdges,
      ...optionalSemanticEdgeSelection.values,
    ].sort((a, b) =>
      a.id.localeCompare(b.id)
    ),
    omitted:
      optionalSemanticEdgeSelection.omitted,
  };

  const requestedSubjects =
    new Set(
      unique(
        input
          .relevantIntentSubjectIds,
      ),
    );
  const requestedInvariants =
    new Set(
      unique(
        input.relevantInvariantIds,
      ),
    );
  const requestedEvidence =
    new Set(
      unique(
        input.relevantEvidenceIds,
      ),
    );

  const invariantSubjectIds =
    new Set(
      input.intent.invariants
        .filter((invariant) =>
          requestedInvariants.has(
            invariant.id,
          )
        )
        .flatMap(
          (invariant) =>
            invariant.subjectIds,
        ),
    );

  const evidenceSubjectIds =
    new Set(
      input.intent.nodes
        .filter((node) =>
          node.evidenceIds.some(
            (id) =>
              requestedEvidence.has(id),
          )
        )
        .map((node) => node.id),
    );

  const explicitSubjectScope =
    new Set([
      ...requestedSubjects,
      ...invariantSubjectIds,
      ...evidenceSubjectIds,
    ]);

  const explicitIntentRequest =
    requestedSubjects.size > 0 ||
    requestedInvariants.size > 0 ||
    requestedEvidence.size > 0;

  const intentNodes =
    input.intent.nodes
      .filter((node) =>
        !explicitIntentRequest ||
        explicitSubjectScope.has(
          node.id,
        )
      )
      .sort((a, b) =>
        a.id.localeCompare(b.id)
      );

  if (
    explicitSubjectScope.size > 0 &&
    intentNodes.length >
      budget.maxIntentNodes
  ) {
    throw new Error(
      "Context compiler maxIntentNodes is smaller than the explicitly required intent subject set.",
    );
  }

  const nodeSelection =
    explicitSubjectScope.size > 0
      ? {
          values: [...intentNodes],
          omitted: 0,
        }
      : take(
          intentNodes,
          budget.maxIntentNodes,
        );
  const selectedSubjectIds =
    new Set(
      nodeSelection.values.map(
        (node) => node.id,
      ),
    );

  const invariants =
    input.intent.invariants
      .filter((invariant) =>
        (
          requestedInvariants.size > 0 &&
          requestedInvariants.has(
            invariant.id,
          )
        ) ||
        (
          selectedSubjectIds.size > 0 &&
          invariant.subjectIds.some(
            (id) =>
              selectedSubjectIds.has(
                id,
              ),
          )
        )
      )
      .sort((a, b) =>
        a.id.localeCompare(b.id)
      );

  if (
    explicitSubjectScope.size > 0 &&
    invariants.length >
      budget.maxInvariants
  ) {
    throw new Error(
      "Context compiler maxInvariants is smaller than the invariants required by the explicit intent scope.",
    );
  }

  const invariantSelection =
    explicitSubjectScope.size > 0
      ? {
          values: [...invariants],
          omitted: 0,
        }
      : take(
          invariants,
          budget.maxInvariants,
        );

  const relevantIntentIds =
    new Set([
      ...selectedSubjectIds,
      ...invariantSelection.values
        .flatMap(
          (item) =>
            item.subjectIds,
        ),
    ]);

  const unknowns =
    input.intent.unknowns
      .filter((unknown) =>
        unknown.blockedSubjectIds
          .length === 0 ||
        unknown.blockedSubjectIds
          .some((id) =>
            relevantIntentIds.has(id)
          )
      )
      .sort((a, b) =>
        a.id.localeCompare(b.id)
      );

  if (
    explicitSubjectScope.size > 0 &&
    unknowns.length >
      budget.maxUnknowns
  ) {
    throw new Error(
      "Context compiler maxUnknowns is smaller than the unknowns required by the explicit intent scope.",
    );
  }

  const unknownSelection =
    explicitSubjectScope.size > 0
      ? {
          values: [...unknowns],
          omitted: 0,
        }
      : take(
          unknowns,
          budget.maxUnknowns,
        );

  const evidenceIds =
    new Set([
      ...requestedEvidence,
      ...nodeSelection.values
        .flatMap(
          (item) =>
            item.evidenceIds,
        ),
      ...invariantSelection.values
        .flatMap(
          (item) =>
            item.evidenceIds,
        ),
      ...unknownSelection.values
        .flatMap(
          (item) =>
            item.evidenceIds ?? [],
        ),
    ]);

  const evidence =
    input.intent.evidence
      .filter((item) =>
        evidenceIds.has(item.id)
      )
      .sort((a, b) =>
        a.id.localeCompare(b.id)
      );

  const explicitIntentScope =
    explicitSubjectScope.size > 0 ||
    requestedInvariants.size > 0 ||
    requestedEvidence.size > 0;

  if (
    explicitIntentScope &&
    evidence.length >
      budget.maxEvidence
  ) {
    throw new Error(
      "Context compiler maxEvidence is smaller than the evidence required by the explicit intent scope.",
    );
  }

  const evidenceSelection =
    explicitIntentScope
      ? {
          values: [...evidence],
          omitted: 0,
        }
      : take(
          evidence,
          budget.maxEvidence,
        );

  const knownIntentIds =
    new Set(
      input.intent.nodes.map(
        (item) => item.id,
      ),
    );
  const knownInvariantIds =
    new Set(
      input.intent.invariants.map(
        (item) => item.id,
      ),
    );
  const knownEvidenceIds =
    new Set(
      input.intent.evidence.map(
        (item) => item.id,
      ),
    );

  const allGraphNodeIds =
    new Set(
      input.graph.allNodes().map(
        (node) => node.id,
      ),
    );

  const missingRequested = {
    semanticNodeIds: [
      ...requestedSemanticIds,
    ].filter(
      (id) =>
        !allGraphNodeIds.has(id),
    ).sort(),
    intentSubjectIds: [
      ...explicitSubjectScope,
    ].filter(
      (id) => !knownIntentIds.has(id),
    ).sort(),
    invariantIds: [
      ...requestedInvariants,
    ].filter(
      (id) =>
        !knownInvariantIds.has(id),
    ).sort(),
    evidenceIds: [
      ...requestedEvidence,
    ].filter(
      (id) =>
        !knownEvidenceIds.has(id),
    ).sort(),
  };

  const resourceSelectionTruncated =
    (resources?.omitted ?? 0) > 0;
  const sectionSelectionTruncated =
    (sections?.omitted ?? 0) > 0;
  const optionalTruncated =
    semanticSelection.omitted > 0 ||
    semanticEdgeSelection.omitted > 0 ||
    nodeSelection.omitted > 0 ||
    invariantSelection.omitted > 0 ||
    unknownSelection.omitted > 0 ||
    evidenceSelection.omitted > 0 ||
    resourceSelectionTruncated ||
    sectionSelectionTruncated;
  const semanticScopeExplicit =
    requestedSemanticIds.size > 0;
  const intentScopeExplicit =
    requestedSubjects.size > 0 ||
    requestedInvariants.size > 0 ||
    requestedEvidence.size > 0;
  const semanticOptionalTruncated =
    semanticSelection.omitted > 0 ||
    semanticEdgeSelection.omitted > 0;
  const intentOptionalTruncated =
    nodeSelection.omitted > 0 ||
    invariantSelection.omitted > 0 ||
    unknownSelection.omitted > 0 ||
    evidenceSelection.omitted > 0;

  const missingRequestedCount =
    missingRequested
      .semanticNodeIds.length +
    missingRequested
      .intentSubjectIds.length +
    missingRequested
      .invariantIds.length +
    missingRequested
      .evidenceIds.length;
  const complete =
    missingRequestedCount === 0 &&
    (input.dataFlowSlice?.complete ?? true) &&
    (resources?.omitted ?? 0) === 0 &&
    resources?.knowledgeContent?.status !== "PARTIAL" &&
    (sections?.omitted ?? 0) === 0 &&
    (
      semanticScopeExplicit ||
      !semanticOptionalTruncated
    ) &&
    (
      intentScopeExplicit ||
      !intentOptionalTruncated
    );

  const noExplicitIntentScope =
    requestedSubjects.size === 0 &&
    requestedInvariants.size === 0 &&
    requestedEvidence.size === 0;

  const worldModel =
    input.worldModel;
  const domainSignals =
    worldModel === undefined
      ? undefined
      : {
          arenaLifecycle:
            worldModel.arenas.lifecycle.partial +
            worldModel.arenas.lifecycle.unresolved +
            worldModel.arenas.cleanup.partial +
            worldModel.arenas.cleanup.unresolved +
            (worldModel.arenas.cleanup
              .resourceLedger?.partial ?? 0) +
            (worldModel.arenas.cleanup
              .resourceLedger?.missing ?? 0),
          spatialAuthority:
            worldModel.spatial.authority.uncovered +
            worldModel.spatial.authority.conflicts +
            worldModel.spatial.authority.unknownRegions +
            (
              worldModel.spatial.authority.configured &&
              !worldModel.spatial.authority.policyValid
                ? 1
                : 0
            ),
          inventory:
            worldModel.inventory.partialResets +
            worldModel.inventory.copyMutationRisks +
            worldModel.inventory
              .unresolvedEquipmentSlotEvidence +
            worldModel.inventory.restoreOwnership
              .multipleRestoreOwners +
            worldModel.inventory.policy.deniedDrops +
            worldModel.inventory.policy.uncoveredDrops +
            worldModel.inventory.policy.unknownDrops,
          entityAiNavigation:
            worldModel.entities.aiStack
              .targetedStackIncomplete +
            worldModel.entities.navigationEnvironment
              .incompatible +
            worldModel.entities.navigationEnvironment
              .stateDependent +
            worldModel.entities.navigationEnvironment
              .unresolved,
          combat:
            worldModel.combat.hurtOnlyTerminalRisk +
            worldModel.combat.policy
              .reviveContractContradictions +
            worldModel.combat.policy
              .projectileCleanupContractGap +
            worldModel.combat.runtime
              .scopedLifeGenerationMissing +
            worldModel.combat.runtime
              .scopedArenaGenerationMissing,
          chunks:
            worldModel.chunks.acquireWithoutRelease +
            worldModel.chunks.releaseUnreachable +
            worldModel.chunks.cleanupOrderUnproven +
            worldModel.chunks.dynamicLeaseKeys +
            worldModel.chunks.capacityUncheckedLeases +
            worldModel.chunks.readinessUnverifiedLeases +
            worldModel.chunks.shutdownOnlyCleanupRisk +
            worldModel.chunks.unguardedDeferredChunkWork,
          persistence:
            (worldModel.persistence?.worldScopedAppendWithoutClear ?? 0) +
            (worldModel.persistence?.unknownLifetime ?? 0),
          economy:
            worldModel.economy.policy
              .deathRewardOverlapContractConflicts +
            worldModel.economy.policy
              .deathRewardOverlapUnresolved +
            worldModel.economy.policy
              .pickupCurrencyConsumeCoverageGaps +
            worldModel.economy.policy
              .pickupCurrencyContractMismatch +
            worldModel.economy.policy
              .idempotencyCoverageGaps +
            worldModel.economy.policy
              .staleDropCleanupCoverageGaps +
            worldModel.economy.policy
              .inventoryFullContractGaps +
            worldModel.economy.policy
              .pickupScopeValidationUnproven +
            worldModel.economy.policy
              .terminalRewardResultCommitUnproven,
        };

  const affectedCapabilities =
    input.repositoryTaskPlan?.status === "planned"
      ? new Set(
          input.repositoryTaskPlan
            .affected.affectedCapabilityIds,
        )
      : undefined;
  const domainScope = {
    arenaLifecycle:
      affectedCapabilities?.has(
        "domain.arena-lifecycle",
      ) ?? false,
    spatialAuthority:
      affectedCapabilities?.has(
        "domain.spatial-authority",
      ) ?? false,
    inventory:
      affectedCapabilities?.has(
        "domain.inventory",
      ) ?? false,
    entityAiNavigation:
      (
        affectedCapabilities?.has(
          "domain.entity-ai",
        ) ||
        affectedCapabilities?.has(
          "runtime.entity-ai",
        )
      ) ?? false,
    combat:
      affectedCapabilities?.has(
        "domain.combat",
      ) ?? false,
    chunks:
      (
        affectedCapabilities?.has(
          "domain.chunks",
        ) ||
        affectedCapabilities?.has(
          "runtime.chunks",
        )
      ) ?? false,
    persistence:
      (
        affectedCapabilities?.has(
          "domain.persistence",
        ) ||
        affectedCapabilities?.has(
          "runtime.persistence",
        )
      ) ?? false,
    economy:
      affectedCapabilities?.has(
        "domain.economy",
      ) ?? false,
  };
  const hasScopedDomain =
    Object.values(domainScope).some(Boolean);
  const scopedDomainSignals =
    domainSignals === undefined
      ? undefined
      : affectedCapabilities === undefined ||
          !hasScopedDomain
        ? domainSignals
        : Object.fromEntries(
            Object.entries(domainSignals)
              .filter(([domain]) =>
                domainScope[
                  domain as keyof typeof domainScope
                ]
              ),
          );

  const world = worldModel === undefined
    ? undefined
    : {
        ...(worldModel.arenas.count === undefined
          ? {}
          : { arenaCount: worldModel.arenas.count }),
        ...(worldModel.arenas.basis === undefined
          ? {}
          : { arenaBasis: worldModel.arenas.basis }),
        objectives:
          worldModel.subjects.find(
            (item) => item.kind === "objective",
          )?.ids ?? [],
        phases:
          worldModel.subjects.find(
            (item) => item.kind === "phase",
          )?.ids ?? [],
        outcomes:
          worldModel.subjects.find(
            (item) => item.kind === "outcome",
          )?.ids ?? [],
        lifecycle: worldModel.arenas.lifecycle,
        cleanup: worldModel.arenas.cleanup,
        isolation: worldModel.arenas.isolation,
        globalState:
          worldModel.arenas.globalState,
        ...(worldModel.persistence === undefined
          ? {}
          : {
              persistence:
                worldModel.persistence,
            }),
        stress:
          worldModel.arenas.stress,
        ...(worldModel.arenas
          .proofExecution === undefined
          ? {}
          : {
              proofMode:
                worldModel.arenas
                  .proofExecution.mode,
            }),
        skippedProofLayers:
          worldModel.arenas
            .proofExecution?.skippedLayers ?? [],
        broadWrites:
          worldModel.state.broadWrites,
        unresolvedScriptMutations:
          worldModel.spatial
            .unresolvedScriptMutations +
          worldModel.spatial
            .rejectedScriptMutations,
        intentUnknowns:
          worldModel.intent.unknowns.length,
        domainSignals:
          scopedDomainSignals!,
      };

  const executionScope =
    input.repositoryTaskPlan === undefined
      ? undefined
      : {
          status:
            input.repositoryTaskPlan.status,
          affectedCapabilityIds: [
            ...input.repositoryTaskPlan
              .affected.affectedCapabilityIds,
          ],
          selectedCapabilityIds: [
            ...input.repositoryTaskPlan
              .execution.selectedCapabilityIds,
          ],
          unmatchedPaths: [
            ...input.repositoryTaskPlan
              .affected.unmatchedPaths,
          ],
        };

  return {
    schemaVersion: 1,
    goal: input.goal,
    ...(world === undefined ? {} : { world }),
    ...(executionScope === undefined
      ? {}
      : { executionScope }),
    ...(input.dataFlowSlice === undefined
      ? {}
      : { dataFlow: input.dataFlowSlice }),
    ...(resources === undefined
      ? {}
      : { resources }),
    ...(sections === undefined
      ? {}
      : { sections }),
    ...(developerPractice === undefined
      ? {}
      : { developerPractice }),
    semantic: {
      nodes:
        semanticSelection.values.map(
          (node) => ({
            id: node.id,
            kind: node.kind,
            identifier:
              node.identifier,
            source: {
              ...node.source,
              ...(node.source.range ===
              undefined
                ? {}
                : {
                    range: {
                      ...node.source.range,
                    },
                  }),
            },
          }),
        ),
      edges:
        semanticEdgeSelection.values.map(
          (edge) => ({
            from: edge.from,
            type: edge.type,
            targetIdentifier:
              edge.targetIdentifier,
            status: edge.status,
            ...(edge.to === undefined
              ? {}
              : { to: edge.to }),
            source: {
              ...edge.evidence.source,
              ...(edge.evidence.source
                .range === undefined
                ? {}
                : {
                    range: {
                      ...edge.evidence
                        .source.range,
                    },
                  }),
            },
          }),
        ),
      omitted:
        semanticSelection.omitted,
      omittedEdges:
        semanticEdgeSelection.omitted,
    },
    intent: {
      nodes:
        nodeSelection.values.map(
          (node) => ({
            id: node.id,
            kind: node.kind,
            label: node.label,
            status: node.status,
            evidenceIds: [
              ...node.evidenceIds,
            ],
          }),
        ),
      invariants:
        invariantSelection.values
          .map((item) => ({
            id: item.id,
            statement:
              item.statement,
            strength:
              item.strength,
            status: item.status,
            subjectIds: [
              ...item.subjectIds,
            ],
            evidenceIds: [
              ...item.evidenceIds,
            ],
          })),
      unknowns:
        unknownSelection.values
          .map((item) => ({
            id: item.id,
            question:
              item.question,
            blockedSubjectIds: [
              ...item
                .blockedSubjectIds,
            ],
            evidenceIds: [
              ...(item
                .evidenceIds ??
                []),
            ],
          })),
      evidence:
        evidenceSelection.values
          .map((item) => ({
            id: item.id,
            origin: item.origin,
            locator: item.locator,
            summary: item.summary,
          })),
    },
    budget,
    truncation: {
      semanticNodes:
        semanticSelection.omitted,
      semanticEdges:
        semanticEdgeSelection.omitted,
      intentNodes:
        nodeSelection.omitted,
      invariants:
        invariantSelection.omitted,
      unknowns:
        unknownSelection.omitted,
      evidence:
        evidenceSelection.omitted,
    },
    missingRequested,
    complete,
    reasons: [
      input.affected?.status ===
      "planned"
        ? "Semantic context is restricted to the proven affected closure."
        : "No proven affected closure was supplied; semantic context remains conservatively broad within budget.",
      noExplicitIntentScope
        ? "No explicit intent subject/invariant scope was supplied; intent nodes are conservatively included within budget."
        : "Intent context uses only explicitly requested subjects/invariants and their directly referenced evidence.",
      resourceSelectionTruncated
        ? "Resource Context omitted " +
          String(resources?.omitted ?? 0) +
          " ranked resource(s); narrow Retrieval or raise resourceLimit."
        : "Resource Context did not omit ranked resources.",
      ...(resources?.knowledgeContent?.status === "PARTIAL"
        ? ["Some selected Knowledge records were not hydrated; context is incomplete."]
        : []),
      sectionSelectionTruncated
        ? "Section Context omitted " +
          String(sections?.omitted ?? 0) +
          " ranked section(s); narrow Section Retrieval or raise sectionLimit."
        : "Section Context did not omit ranked sections.",
      optionalTruncated
        ? complete
          ? "Context budget truncated only optional surrounding context; explicitly required scope remains complete."
          : "Context budget truncated an unscoped context category; narrow relevance or expand that category budget."
        : "Context budget did not truncate the selected evidence.",
      missingRequestedCount > 0
        ? "One or more explicitly requested intent/invariant/evidence ids are missing; the context pack is incomplete."
        : "All explicitly requested intent/invariant/evidence ids are present.",
      input.dataFlowSlice === undefined
        ? "No data-flow slice was supplied; context remains semantic/intent scoped only."
        : input.dataFlowSlice.complete
          ? "Supplied data-flow slice is complete for its explicit seed/budget contract."
          : "Supplied data-flow slice is incomplete because seeds are missing or its explicit budget truncated value flow.",
    ],
  };
}