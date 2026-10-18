import { artifactIdFromFingerprint } from "../../../artifact/src/index.js";
import type { SemanticIr } from "../../../semantic-ir/src/index.js";
import type { GameplayIntentModel } from "../../../gameplay-intent/src/index.js";
import type { GameplayWorldModel } from "./gameplay-world-model.js";
import type {
  GameplayScenario,
  GameplayScenarioGraph,
} from "./gameplay-scenario-model.js";
import {
  satisfiedScenarioKnowledgeReceipt,
  uniqueScenarioKnowledgeRequirement,
} from "./gameplay-scenario-knowledge.js";
import type { GameplayDiscoveryClosure } from "./gameplay-discovery-closure.js";
import type { GameplayBoundaryRegistry } from "./gameplay-boundary-registry.js";
import type { MultiplayerStateValidationPlan } from "./multiplayer-state-validation.js";
import type { HiddenGameplayDefectAnalysis } from "./hidden-gameplay-defect-analysis.js";
import { capabilityDeliveryMatchesScope } from "./gameplay-defect-resolution.js";
import {
  deriveMandatoryOwnershipRegistry,
  deriveMandatoryProgressionContracts,
  deriveMandatoryStateRegistry,
  mandatoryAuditBlockClosure as blockClosure,
  mandatoryAuditObligation as obligation,
  mandatoryAuditReceipt as receipt,
  positiveNotApplicable,
} from "./mandatory-audit-support.js";
export type {
  MandatoryAuditBlock,
  MandatoryAuditBlockClosure,
  MandatoryAuditCheckpointReasonCode,
  MandatoryAuditCheckpointReceipt,
  MandatoryAuditCheckpointStatus,
  MandatoryAuditObligation,
  MandatoryAuditOwnershipRecord,
  MandatoryAuditProcedureReceipt,
  MandatoryAuditProgressionRecord,
  MandatoryAuditStateRecord,
} from "./mandatory-audit-support.js";
import type {
  MandatoryAuditCheckpointReceipt,
  MandatoryAuditProcedureReceipt,
} from "./mandatory-audit-support.js";

/**
 * Shared selected-source causal-link admission for EVALUATE C6/C9.
 * A domain-only runtime edge or a matching scenario name is not evidence
 * that an authored gameplay dependency was evaluated.
 */
function sourceBoundScenarioLinks(
  scenario: GameplayScenario,
  graph: GameplayScenarioGraph,
  selectedSourceEvidenceIds: ReadonlySet<string>,
): GameplayScenarioGraph["causalLinks"][number][] {
  return scenario.causalLinkIds.flatMap((id) =>
    graph.causalLinks.filter((link) =>
      link.id === id &&
      link.scenarioId === scenario.id &&
      link.status !== "DETECTION_GAP" &&
      link.fromComponentId !== link.toComponentId &&
      scenario.componentIds.includes(link.fromComponentId) &&
      scenario.componentIds.includes(link.toComponentId) &&
      link.evidenceIds.some((evidenceId) =>
        selectedSourceEvidenceIds.has(evidenceId)
      ) &&
      [link.fromComponentId, link.toComponentId].some((componentId) =>
        graph.components.some((component) =>
          component.id === componentId &&
          component.evidenceIds.some((evidenceId) =>
            selectedSourceEvidenceIds.has(evidenceId)
          )
        )
      )
    )
  );
}

function scenarioKnowledgeAccounted(
  scenario: GameplayScenario,
  graph: GameplayScenarioGraph,
): boolean {
  return scenario.requiredKnowledgeIds.length > 0 &&
    scenario.requiredKnowledgeIds.every((id) => {
      const required = uniqueScenarioKnowledgeRequirement(graph, id, scenario.id);
      return required !== undefined &&
        satisfiedScenarioKnowledgeReceipt(graph, required) !== undefined;
    });
}

/**
 * C6 readiness describes an evaluated source contract, never the
 * absence of bugs or observed Minecraft terminal behavior.
 */
export function assessTerminalCollisionSourceCoverage(input: {
  readonly scenario: GameplayScenario | undefined;
  readonly graph: GameplayScenarioGraph;
  readonly selectedSourceEvidenceIds: ReadonlySet<string>;
  readonly lifecycle: Pick<GameplayWorldModel["arenas"]["lifecycle"], "unresolvedTerminalRaces" | "terminalPrecedenceUnresolved" | "multiIngressTerminalTargets" | "terminalRaces">;
}): {
  readonly complete: boolean;
  readonly evidenceIds: readonly string[];
  readonly missing: readonly string[];
} {
  const { scenario, graph, selectedSourceEvidenceIds, lifecycle } = input;
  const links = scenario === undefined ? [] :
    sourceBoundScenarioLinks(scenario, graph, selectedSourceEvidenceIds);
  const knowledgeReady = scenario !== undefined &&
    scenarioKnowledgeAccounted(scenario, graph);
  // A source link elsewhere in the same preset does not establish that
  // the authored ending itself was evaluated. Require a source-grounded
  // outcome path, or an explicitly classified multi-ingress terminal race.
  const outcomeLinked = links.some((link) =>
    graph.components.some((component) =>
      component.kind === "outcome" &&
      component.evidenceIds.some((id) => selectedSourceEvidenceIds.has(id)) &&
      (link.fromComponentId === component.id ||
       link.toComponentId === component.id ||
       (link.impactPathComponentIds.includes(component.id) &&
        link.impactPathEvidenceIds.some((id) =>
          selectedSourceEvidenceIds.has(id))))
    )
  );
  const terminalRaceClassified = lifecycle.terminalRaces.some((race) =>
    race.ingresses.length >= 2 && race.status !== "unresolved"
  );
  const terminalPathAccounted = outcomeLinked || terminalRaceClassified;
  const unresolvedTerminalOwnership =
    lifecycle.unresolvedTerminalRaces > 0 ||
    lifecycle.terminalPrecedenceUnresolved > 0 ||
    lifecycle.multiIngressTerminalTargets > lifecycle.terminalRaces.length;
  const missing = [
    ...(scenario === undefined
      ? ["exact compiled terminal-collision preset is absent"] : []),
    ...(scenario !== undefined && links.length === 0
      ? ["no exact selected-source causal link supports the terminal scenario"] : []),
    ...(scenario !== undefined && links.length > 0 && !terminalPathAccounted
      ? ["source-bound scenario links do not establish an authored terminal outcome or classified multi-ingress path"] : []),
    ...(scenario !== undefined && !knowledgeReady
      ? ["terminal scenario knowledge requirements are not all satisfied"] : []),
    ...(unresolvedTerminalOwnership
      ? ["terminal ingress, precedence or race ownership remains unresolved"] : []),
  ];
  return {
    complete: missing.length === 0,
    evidenceIds: [...new Set(links.flatMap((link) =>
      link.evidenceIds.filter((id) => selectedSourceEvidenceIds.has(id))
    ))].sort(),
    missing,
  };
}

export function deriveMandatoryAuditProcedureReceipt(input: {
  readonly artifactId: string;
  readonly artifactFingerprint?: string;
  readonly archiveEntries?: number;
  readonly discovery: GameplayDiscoveryClosure;
  readonly world: GameplayWorldModel;
  readonly intent: GameplayIntentModel;
  readonly semanticIr: SemanticIr;
  readonly boundaries: GameplayBoundaryRegistry;
  readonly multiplayer: MultiplayerStateValidationPlan;
  readonly hidden: HiddenGameplayDefectAnalysis;
}): MandatoryAuditProcedureReceipt {
  const {
    artifactId,
    discovery,
    world,
    intent,
    semanticIr,
    boundaries,
    multiplayer,
    hidden,
  } = input;
  const graph = hidden.scenarioAudit.graph;
  const scenarioClosure = hidden.scenarioAudit.closure;
  // Preset identity is the authority for mandatory scenario activation.
  // A source-authored scenario may legitimately have the same display label,
  // but cannot substitute for a missing generated preset or its flow scope.
  const compiledPresetScenarios =
    hidden.auditScenarioPreset.scenarios.flatMap((preset) =>
      graph.scenarios.filter((scenario) =>
        scenario.id === "preset:" + preset.id &&
        scenario.label === preset.kind &&
        scenario.gameplayStage === preset.flowStage
      )
    );
  // Source accounting alone cannot prove a gameplay system is not applicable.
  const discoverySupportsAbsence = positiveNotApplicable(discovery, false, false);
  const defectResolution = hidden.scenarioAudit.defectResolution;
  const stateRegistry = deriveMandatoryStateRegistry(
    semanticIr,
    world.persistence?.propertiesDetail ?? [],
  );
  const ownershipRegistry = deriveMandatoryOwnershipRegistry(semanticIr);
  const progressionContracts = deriveMandatoryProgressionContracts(intent);
  const demanded = new Set(world.analysisDemand ?? []);
  const deferredRelations = semanticIr.temporal.relations.filter(
    (relation) =>
      relation.kind === "deferred" ||
      relation.kind === "periodic",
  );
  const writableStates = stateRegistry.filter(
    (item) => item.writeRegions.length > 0,
  );
  const unboundedWritableStates = writableStates.filter(
    (item) =>
      item.clearRegions.length === 0 &&
      item.authorityContractIds.length === 0 &&
      item.staleRisk !== "bounded",
  );
  const explicitOwnership = ownershipRegistry.filter(
    (item) =>
      item.authorityStatus === "explicit-contract",
  );
  const unresolvedOwnership = ownershipRegistry.filter(
    (item) =>
      item.authorityStatus ===
      "multi-writer-unresolved",
  );
  const capabilityDeliveryFailures =
    hidden.capabilityDelivery.filter(
      (item) =>
        item.status === "DEGRADED" ||
        item.status === "MISSING",
    );
  const capabilityDeliveryUnproven =
    hidden.capabilityDelivery.filter(
      (item) => item.status === "UNPROVEN",
    );
  const capabilityFailureRoutedIds =
    capabilityDeliveryFailures
      .filter((failure) =>
        graph.causalLinks.some((link) =>
          link.status === "CONTRADICTED" &&
          capabilityDeliveryMatchesScope(
            failure.subjectId,
            graph.scenarios.find((scenario) =>
              scenario.id === link.scenarioId
            )?.label,
            link.subjectIds,
            link.componentIds,
          )
        )
      )
      .map((item) => item.subjectId)
      .sort();
  const progressionIncomplete = progressionContracts.filter(
    (item) =>
      item.kind === "objective"
        ? item.inboundEdgeIds.length === 0 ||
          (
            item.effectEdgeIds.length === 0 &&
            item.transitionEdgeIds.length === 0 &&
            item.terminalEdgeIds.length === 0
          )
        : item.kind === "outcome"
          ? item.inboundEdgeIds.length === 0 &&
            item.terminalEdgeIds.length === 0
          : item.inboundEdgeIds.length === 0 &&
            item.transitionEdgeIds.length === 0 &&
            item.outboundEdgeIds.length === 0,
  );
  const checkpoint: MandatoryAuditCheckpointReceipt[] = [];

  const fingerprint = input.artifactFingerprint;
  const targetVerified =
    fingerprint !== undefined &&
    /^[a-f0-9]{64}$/i.test(fingerprint) &&
    artifactId === artifactIdFromFingerprint(fingerprint) &&
    input.archiveEntries !== undefined &&
    Number.isSafeInteger(input.archiveEntries) &&
    input.archiveEntries > 0;

  checkpoint.push(receipt(
    "A1",
    "TARGET",
    "Selected Artifact Integrity",
    targetVerified ? "CLOSED" : "OPEN",
    targetVerified
      ? "Selected artifact fingerprint, identity, and extracted archive inventory are verified."
      : "Selected artifact integrity is not verified by a matching SHA-256 identity and nonempty archive inventory.",
    targetVerified
      ? ["artifact:" + artifactId, "sha256:" + fingerprint]
      : [],
    ["SelectedArtifactReceipt"],
  ));

  checkpoint.push(receipt(
    "A2",
    "DISCOVERY",
    "Source Recognition and Discovery",
    discovery.status === "OPEN"
      ? "OPEN"
      : discovery.status === "PARTIAL"
        ? "PARTIAL"
        : "CLOSED",
    "Source Recognition (physical inventory and relevant file dispositions) is " + discovery.status +
      "; gameplay interpretation remains an UNDERSTAND responsibility.",
    discovery.discoveredSurfaceIds,
    ["GameplaySurfaceInventory"],
  ));

  const fullJourney = graph.scenarios.find(
    (scenario) => scenario.label === "full-journey",
  );
  checkpoint.push(receipt(
    "A3",
    "UNDERSTAND",
    "Player Journey Reconstruction",
    fullJourney &&
    fullJourney.composedScenarioIds.length > 0 &&
    scenarioClosure.status !== "OPEN" &&
    intent.nodes.some((node) =>
      node.kind === "objective" ||
      node.kind === "phase" ||
      node.kind === "outcome"
    )
      ? "CLOSED"
      : "OPEN",
    fullJourney && fullJourney.composedScenarioIds.length > 0
      ? "Full journey is represented as a composition of concrete gameplay scenarios."
      : "No complete full-journey composition is available.",
    fullJourney?.composedScenarioIds ?? [],
    ["PlayerJourneyGraph"],
    {
      obligations: [
        obligation(
          "journey-composition",
          true,
          (fullJourney?.composedScenarioIds.length ?? 0) > 0,
          "Full journey must compose concrete gameplay scenarios.",
          fullJourney?.composedScenarioIds ?? [],
        ),
        obligation(
          "journey-core-semantics",
          true,
          intent.nodes.some((node) => node.kind === "phase") &&
            intent.nodes.some((node) =>
              node.kind === "objective" ||
              node.kind === "outcome"
            ),
          "Journey must contain grounded phase plus objective/outcome semantics.",
          intent.nodes
            .filter((node) =>
              node.kind === "phase" ||
              node.kind === "objective" ||
              node.kind === "outcome"
            )
            .flatMap((node) => node.evidenceIds),
        ),
        obligation(
          "journey-scenario-closure",
          true,
          scenarioClosure.status !== "OPEN",
          "Journey cannot close while scenario closure is OPEN.",
          graph.causalLinks.flatMap((item) => item.evidenceIds),
        ),
      ],
    },
  ));

  checkpoint.push(receipt(
    "A4",
    "UNDERSTAND",
    "State Registry",
    stateRegistry.length === 0
      ? discoverySupportsAbsence
        ? "NOT_APPLICABLE"
        : "OPEN"
      : unboundedWritableStates.length > 0
        ? "PARTIAL"
        : "CLOSED",
    stateRegistry.length === 0
      ? discoverySupportsAbsence
        ? "No material Semantic IR state surfaces were discovered after complete discovery."
        : "State applicability cannot be closed while discovery is incomplete."
      : unboundedWritableStates.length > 0
        ? "Writable state remains without clear/reset or explicit authority evidence."
        : "Material state surfaces have bounded write/clear or authority evidence.",
    semanticIr.state.operations.map((item) => item.id),
    ["StateRegistry"],
    {
      obligations: [
        obligation(
          "state-writes-bounded",
          writableStates.length > 0,
          unboundedWritableStates.length === 0,
          "Every writable material state must have clear/reset or explicit authority evidence.",
          writableStates.map((item) => item.surfaceId),
        ),
      ],
    },
  ));

  const ownershipApplicable =
    ownershipRegistry.length > 0 ||
    world.arenas.detected ||
    deferredRelations.length > 0;
  checkpoint.push(receipt(
    "A5",
    "UNDERSTAND",
    "Ownership Registry",
    !ownershipApplicable
      ? discoverySupportsAbsence
        ? "NOT_APPLICABLE"
        : "OPEN"
      : unresolvedOwnership.length > 0
        ? "PARTIAL"
        : "CLOSED",
    !ownershipApplicable
      ? discoverySupportsAbsence
        ? "No shared/session/deferred ownership surface remains after complete discovery."
        : "Ownership applicability cannot close while discovery is incomplete."
      : "Ownership obligations are evaluated from authority bindings, arena lifecycle/isolation, and deferred ownership.",
    ownershipRegistry.flatMap((item) => [
      ...(item.authorityContractId === undefined
        ? []
        : [item.authorityContractId]),
      ...item.observedWriterRegionIds,
    ]),
    ["OwnershipRegistry"],
    {
      obligations: [
        obligation(
          "state-authority-accounted",
          explicitOwnership.length > 0,
          explicitOwnership.every(
            (item) =>
              (item.authoritySurfaceId?.trim().length ?? 0) > 0,
          ),
          "Explicit state authority bindings must identify a concrete authority surface.",
          explicitOwnership.flatMap((item) =>
            item.authorityContractId === undefined
              ? []
              : [item.authorityContractId]
          ),
        ),
        obligation(
          "arena-ownership-accounted",
          world.arenas.detected,
          !world.arenas.detected ||
            (
              world.analysisExecution.executedCapabilityIds.includes(
                "arena-lifecycle-integrity",
              ) &&
              world.arenas.lifecycle.unresolved === 0 &&
              world.arenas.isolation.unknown === 0
            ),
          "Detected arenas require lifecycle and isolation ownership to resolve.",
          ["analysis:arena-lifecycle", "analysis:multiplayer-interleaving"],
        ),
        obligation(
          "state-multi-writer-authority-resolved",
          ownershipRegistry.some(
            (item) =>
              item.observedWriterRegionIds.length > 1,
          ),
          unresolvedOwnership.length === 0,
          "State surfaces with multiple writer regions require explicit authority binding or remain unresolved.",
          unresolvedOwnership.flatMap(
            (item) => item.observedWriterRegionIds,
          ),
        ),
        obligation(
          "deferred-ownership-accounted",
          deferredRelations.length > 0,
          deferredRelations.length === 0 ||
            world.analysisExecution.executedCapabilityIds.includes(
              "temporal-ownership-integrity",
            ),
          "Deferred/periodic work requires temporal ownership analysis.",
          deferredRelations.map((item) => item.id),
        ),
      ],
    },
  ));

  checkpoint.push(receipt(
    "A6",
    "UNDERSTAND",
    "Progression Contract",
    progressionContracts.length === 0
      ? discoverySupportsAbsence
        ? "NOT_APPLICABLE"
        : "OPEN"
      : progressionIncomplete.length === 0
        ? "CLOSED"
        : "PARTIAL",
    progressionContracts.length === 0
      ? discoverySupportsAbsence
        ? "No objective/phase/outcome progression surface remains after complete discovery."
        : "Progression applicability cannot close while discovery is incomplete."
      : "Objective/phase/outcome progression edges are projected from gameplay intent.",
    progressionContracts.flatMap((item) => [
      ...item.inboundEdgeIds,
      ...item.outboundEdgeIds,
      ...item.dependencyEdgeIds,
      ...item.stateResourceSubjectIds,
    ]),
    ["ProgressionContracts"],
    {
      obligations: [
        obligation(
          "progression-chain-connected",
          progressionContracts.length > 0,
          progressionIncomplete.length === 0,
          "Objectives require inbound and outbound progression links; outcomes require inbound proof; phases require at least one transition connection.",
          progressionContracts.flatMap((item) => [
            ...item.inboundEdgeIds,
            ...item.outboundEdgeIds,
          ]),
        ),
      ],
    },
  ));

  // Preserve all indexed-source interpretation debt at its A7 owner.
  const discoverySemanticsUnderstood =
    discovery.semanticUnderstandingGaps === 0 &&
    discovery.discoveryChallengeIds.length === 0 &&
    discovery.gameplayIntentUnknownIds.length === 0;
  const gameplayModelStatus =
    world.gameplayClosure.status === "CLOSED" && !discoverySemanticsUnderstood
      ? "PARTIAL" as const
      : world.gameplayClosure.status;
  checkpoint.push(receipt(
    "A7",
    "UNDERSTAND",
    "Gameplay Model Closure",
    gameplayModelStatus,
    gameplayModelStatus === "CLOSED"
      ? "Gameplay model and indexed source semantics are accounted."
      : "Gameplay model remains " + gameplayModelStatus +
        "; indexed semantic gaps, unowned source evidence and unknown gameplay meaning still block closure.",
    [
      ...world.gameplayClosure.surfaces.flatMap((surface) => surface.evidenceIds).filter((id): id is string => typeof id === "string"),
      ...discovery.discoveryChallengeIds,
      ...discovery.gameplayIntentUnknownIds,
    ],
    ["GameplayModelClosure"],
    {
      obligations: [
        obligation(
          "gameplay-source-semantics-reconciled", true,
          discovery.semanticUnderstandingGaps === 0,
          "Indexed gameplay-sensitive source definitions require domain semantics under A7.",
          discovery.semanticUnderstandingGapPaths,
        ),
        obligation(
          "gameplay-source-challenges-reconciled", true,
          discovery.discoveryChallengeIds.length === 0,
          "Raw execution/state records require grounded gameplay/scenario dispositions.",
          discovery.discoveryChallengeIds,
        ),
        obligation(
          "gameplay-intent-unknowns-reconciled", true,
          discovery.gameplayIntentUnknownIds.length === 0,
          "Unclassified gameplay intent must be reconciled before model closure.",
          discovery.gameplayIntentUnknownIds,
        ),
        obligation(
          "gameplay-model-state-complete",
          true,
          world.gameplayClosure.stateModelComplete,
          "Gameplay model closure requires a complete material state model.",
          world.gameplayClosure.surfaces.flatMap(
             (surface) => surface.evidenceIds,
           ).filter((id): id is string => typeof id === "string"),
        ),
        obligation(
          "gameplay-model-boundaries-extracted",
          true,
          world.gameplayClosure.boundariesExtracted,
          "Gameplay model closure requires material boundaries to be extracted.",
          world.gameplayClosure.surfaces.flatMap(
             (surface) => surface.boundaries,
           ).filter((id): id is string => typeof id === "string"),
        ),
        obligation(
          "gameplay-model-surfaces-accounted",
          true,
          world.gameplayClosure.unaccountedSurfaceIds.length === 0,
          "Gameplay model closure requires every discovered material surface to be accounted.",
          world.gameplayClosure.unaccountedSurfaceIds,
        ),
      ],
    },
  ));

  // Vanilla actors and player roles need not have custom entity JSON.
  // FORMALIZE must account for the authored actor/role and scenario demand,
  // not infer actor absence from zero custom entity definitions alone.
  const selectedEvidenceIds = new Set(
    intent.evidence
      .filter((item) => item.scope === "selected-artifact")
      .map((item) => item.id),
  );
  const actorNodes = intent.nodes.filter((node) =>
    (node.kind === "actor" || node.kind === "role") &&
    node.status !== "hypothesis"
  );
  const groundedActorNodes = actorNodes.filter((node) =>
    node.evidenceIds.some((id) => selectedEvidenceIds.has(id))
  );
  const actorKnowledgeRequirements = graph.knowledgeRequirements.filter(
    (item) => item.domain === "entity-behavior"
  );
  const actorKnowledgeDemanded =
    demanded.has("entity-behavior") ||
    actorKnowledgeRequirements.length > 0;
  const actorApplicable =
    world.entities.definitions > 0 ||
    world.entities.resolvedSpawnEvidence > 0 ||
    actorNodes.length > 0 ||
    actorKnowledgeDemanded;
  const actorEvidenceMissing =
    world.entities.definitions === 0 &&
    world.entities.resolvedSpawnEvidence === 0 &&
    groundedActorNodes.length === 0;
  const actorKnowledgeUnresolved =
    actorKnowledgeDemanded &&
    (actorKnowledgeRequirements.length === 0 ||
      actorKnowledgeRequirements.some((required) =>
        satisfiedScenarioKnowledgeReceipt(graph, required) === undefined
      ));
  const actorFormalizationGaps = [
    ...(actorNodes.length > groundedActorNodes.length
      ? ["actor/role intent lacks selected-source grounding"] : []),
    ...(world.entities.knowledgePrerequisiteGaps > 0
      ? ["required entity knowledge prerequisites are unresolved"] : []),
    ...(world.entities.staticAnalysisLimits > 0
      ? ["entity static analysis remains limited"] : []),
    ...(world.entities.navigationEnvironment.unresolved > 0
      ? ["entity navigation/environment contracts are unresolved"] : []),
    ...(world.entities.aiStack.targetedStackIncomplete > 0
      ? ["targeted entity AI stack is incomplete"] : []),
    ...(actorKnowledgeUnresolved
      ? ["required actor/entity knowledge receipts are incomplete"] : []),
  ];
  checkpoint.push(receipt(
    "B1",
    "FORMALIZE",
    "Actor / Entity Contract",
    !actorApplicable
      ? discoverySupportsAbsence ? "NOT_APPLICABLE" : "OPEN"
      : actorEvidenceMissing
        ? "OPEN"
        : actorFormalizationGaps.length > 0
          ? "PARTIAL"
          : "CLOSED",
    !actorApplicable
      ? discoverySupportsAbsence
        ? "No selected-source actor/role, entity implementation, spawn evidence, or entity-behavior demand remains after complete discovery."
        : "Actor/entity applicability is unresolved while discovery remains incomplete."
      : actorEvidenceMissing
        ? "Actor/entity behavior is demanded, but no selected-source actor/role, entity definition, or resolved spawn evidence grounds the contract."
        : actorFormalizationGaps.length > 0
          ? "Actor/entity FORMALIZE is incomplete: " +
            actorFormalizationGaps.join("; ") + "."
          : "Actor/entity source and required knowledge are accounted; this is not Minecraft runtime behavior proof.",
    [...new Set([
      ...groundedActorNodes.flatMap((node) =>
        node.evidenceIds.filter((id) => selectedEvidenceIds.has(id))
      ),
      ...actorKnowledgeRequirements.flatMap((required) =>
        satisfiedScenarioKnowledgeReceipt(graph, required)?.evidenceIds ?? []
      ),
    ])],
    ["ActorEntityContract"],
  ));

  // FORMALIZE applicability includes semantic demand from the selected
  // gameplay scenarios, not only a detected chunk lease or spatial effect.
  // Absence of a residency mechanism can be the exact contract gap to record.
  const chunkKnowledgeRequired =
    demanded.has("chunk-simulation") ||
    world.chunks.leases.length > 0 ||
    graph.knowledgeRequirements.some(
      (item) => item.domain === "chunk-simulation"
    );
  const spatialApplicable =
    world.spatial.resolvedScriptEffects > 0 ||
    world.spatial.structurePlacements > 0 ||
    chunkKnowledgeRequired;
  const spatialFormalizationGaps = [
    ...(world.chunks.cleanupOrderUnproven > 0
      ? ["chunk cleanup order is unproven"] : []),
    ...(world.chunks.readinessUnverifiedLeases > 0
      ? ["chunk readiness remains unverified"] : []),
    ...(spatialApplicable && !world.platformKnowledge.profileResolved
      ? ["applicable platform profile is unresolved"] : []),
    ...(chunkKnowledgeRequired &&
        !world.analysisExecution.executedCapabilityIds.includes(
          "chunk-lifecycle-integrity",
        )
      ? ["required chunk/simulation knowledge was not executed"] : []),
  ];
  checkpoint.push(receipt(
    "B2",
    "FORMALIZE",
    "Spatial & Simulation Contract",
    !spatialApplicable
      ? discoverySupportsAbsence
        ? "NOT_APPLICABLE"
        : "OPEN"
      : spatialFormalizationGaps.length > 0
        ? "PARTIAL"
        : "CLOSED",
    !spatialApplicable
      ? discoverySupportsAbsence
        ? "No material spatial/simulation dependency remains after complete discovery."
        : "Spatial/simulation applicability cannot close while discovery is incomplete."
      : spatialFormalizationGaps.length > 0
        ? "Spatial/simulation FORMALIZE remains incomplete: " +
          spatialFormalizationGaps.join("; ") + "."
        : "Applicable spatial and chunk/simulation source/model knowledge is accounted; this does not prove Minecraft runtime delivery.",
    [
      "analysis:spatial-authority",
      "analysis:chunk-simulation",
      "analysis:platform-constraints",
    ],
    ["SpatialSimulationContract"],
    {
      obligations: [
        obligation(
          "platform-knowledge-resolved",
          spatialApplicable,
          world.platformKnowledge.profileResolved,
          "Runtime-sensitive spatial/simulation reasoning requires resolved Minecraft/Education platform knowledge.",
          world.platformKnowledge.profileResolved
            ? ["analysis:platform-constraints"]
            : [],
        ),
        obligation(
          "chunk-knowledge-executed",
          chunkKnowledgeRequired,
          world.analysisExecution.executedCapabilityIds.includes(
            "chunk-lifecycle-integrity",
          ),
          "Required chunk/simulation knowledge must execute when the scenario depends on it.",
          ["analysis:chunk-simulation"],
        ),
      ],
    },
  ));

  // A playerCount on a Scenario Graph node can be an injected audit
  // scenario budget (including the default two-player preset), not a
  // declaration that the selected map supports multiplayer. The synthetic
  // mixed:* validation plan likewise cannot prove an authored player contract.
  // Reuse the same source-authority receipt already consumed by B5.
  // The capacity analyzer only emits the limit after an authored
  // membership-capacity guard is demonstrated in the selected script.
  const playerCapacitySources =
    world.arenas.perArenaPlayerCapacitySources ?? [];
  // An unresolved roster admission source prevents proving absence of a
  // multiplayer contract, but it does not establish multiplayer itself.
  const rosterAdmissionUnresolved =
    (world.arenas.unresolvedRosterCapacityPaths ?? 0) > 0;
  const multiplayerCapacitySourceGrounded =
    (world.arenas.perArenaPlayerCapacity ?? 0) > 1 &&
    playerCapacitySources.some((source) =>
      source.relativePath.trim().length > 0
    );
  const authoredMultiplayerSignal =
    /(?:^|[^a-z])(?:multiplayer|co-?op|cooperative|teams?|parties|party|roster|membership|participants|player-count|players)(?:$|[^a-z])/i;
  const multiplayerSourceEvidenceIds = [
    ...new Set(intent.nodes
      .filter((node) =>
        node.status !== "hypothesis" &&
        (node.kind === "mechanic" ||
          node.kind === "lifecycle" ||
          node.kind === "policy" ||
          node.kind === "state" ||
          node.kind === "role" ||
          node.kind === "resource") &&
        authoredMultiplayerSignal.test(node.id + " " + node.label)
      )
      .flatMap((node) => node.evidenceIds)
      .filter((id) => selectedEvidenceIds.has(id))),
  ].sort();
  const multiplayerSourceContractGrounded =
    multiplayerSourceEvidenceIds.length > 0 ||
    multiplayerCapacitySourceGrounded;
  const playerCapacityDemandsMultiplayer =
    (world.arenas.perArenaPlayerCapacity ?? 0) > 1 ||
    (world.arenas.declaredMaxConcurrentPlayers ?? 0) > 1 ||
    (world.arenas.count ?? 0) > 1;
  const multiplayerKnowledgeRequired =
    demanded.has("multiplayer-interleaving") ||
    graph.knowledgeRequirements.some(
      (item) =>
        item.domain === "multiplayer-interleaving" &&
        !item.scenarioId.startsWith("preset:")
    );
  const multiplayerRequired =
    multiplayerSourceEvidenceIds.length > 0 ||
    playerCapacityDemandsMultiplayer ||
    multiplayerKnowledgeRequired;
  const multiplayerAnalysisExecuted =
    world.analysisExecution.executedCapabilityIds.includes(
      "multiplayer-interleaving",
    );
  const multiplayerFormalizationGaps = [
    ...(!multiplayerSourceContractGrounded
      ? ["no selected-artifact participant/party ownership or capacity-authority source evidence grounds the multiplayer contract"] : []),
    ...(!multiplayerAnalysisExecuted
      ? ["multiplayer interleaving/isolation analysis has not executed"] : []),
  ];
  checkpoint.push(receipt(
    "B3",
    "FORMALIZE",
    "Multiplayer Contract",
    !multiplayerRequired
      ? discoverySupportsAbsence && !world.arenas.detected &&
          !rosterAdmissionUnresolved
        ? "NOT_APPLICABLE"
        : "OPEN"
      : multiplayerFormalizationGaps.length > 0
        ? "PARTIAL"
        : "CLOSED",
    !multiplayerRequired
      ? discoverySupportsAbsence && !world.arenas.detected &&
          !rosterAdmissionUnresolved
        ? "No selected-artifact shared-player source signal, declared multi-player capacity or source-bound multiplayer knowledge demand remains after complete discovery. Hypothetical two-player audit presets do not establish multiplayer design."
        : rosterAdmissionUnresolved
          ? "Roster admission source is present, but its capacity and multiplayer applicability remain unresolved; absence cannot be proven from an unclassified membership write."
          : "Multiplayer applicability remains unresolved while discovery or arena source ownership is incomplete."
      : multiplayerFormalizationGaps.length > 0
        ? "Multiplayer FORMALIZE is incomplete: " +
          multiplayerFormalizationGaps.join("; ") + "."
        : "Selected-source multiplayer ownership and interleaving analysis are accounted" +
          (multiplayerCapacitySourceGrounded
            ? " (capacity authority: " +
              playerCapacitySources
                .filter((source) => source.relativePath.trim().length > 0)
                .map((source) => source.relativePath)
                .slice(0, 3).join(", ") + ")"
            : "") +
          "; a hypothetical stress scenario does not prove Minecraft runtime delivery.",
    multiplayerSourceEvidenceIds,
    ["MultiplayerContract"],
    {
      obligations: [
        obligation(
          "multiplayer-source-contract-grounded",
          multiplayerRequired,
          multiplayerSourceContractGrounded,
          "An applicable multiplayer contract needs selected-artifact participant/party ownership evidence or an authority-proven multi-player capacity source; generated scenario counts and hypothetical test plans are not gameplay design evidence.",
          multiplayerSourceEvidenceIds,
        ),
        obligation(
          "multiplayer-knowledge-executed",
          multiplayerRequired,
          multiplayerAnalysisExecuted,
          "Required shared-player interaction, including non-arena multiplayer, must execute existing interleaving/isolation analysis.",
          multiplayerAnalysisExecuted
            ? ["analysis:multiplayer-interleaving"]
            : [],
        ),
      ],
    },
  ));
  const multiArena =
    world.arenas.detected && (world.arenas.count ?? 0) > 1;
  // Capacity/replica declarations are gameplay design demand even if
  // the topology classifier has not yet recognized multiple arenas.
  const multiArenaDemanded =
    (world.arenas.requestedConcurrentArenas ?? 0) > 1 ||
    world.arenas.replicaProof.length > 0 ||
    hidden.auditScenarioPreset.scenarios.some((preset) =>
      preset.kind === "multi-arena-parallel" ||
      preset.kind === "arena-replica-integrity" ||
      preset.kind === "arena-capacity-plus-one"
    );
  const multiArenaRequired = multiArena || multiArenaDemanded;
  const expectedReplicaProofs =
    multiArena && world.arenas.count !== undefined
      ? Math.max(0, world.arenas.count - 1)
      : 0;
  const distinctReplicaIds = new Set(
    world.arenas.replicaProof.map((item) => item.arenaId),
  );
  const replicaCoverageIncomplete = multiArena && (
    world.arenas.replicaProof.length !== expectedReplicaProofs ||
    distinctReplicaIds.size !== expectedReplicaProofs
  );
  const replicaProofIncomplete =
    world.arenas.replicaIntegrity.incomplete > 0 ||
    world.arenas.replicaIntegrity.noProof > 0 ||
    world.arenas.replicaIntegrity.bounded > 0 ||
    replicaCoverageIncomplete;
  // The canonical layout reconciler distinguishes script-only,
  // topology-only, unavailable, conflict and consistent. Presence of one
  // layout source is not proof that script and physical layouts agree.
  const arenaLayoutReconciled =
    world.arenas.layoutStatus === "consistent";
  // FORMALIZE owns source-authored arena count, ownership and lifecycle.
  // Physical replica parity and concurrency budget remain mandatory at C9.
  const multiArenaFormalizationGaps = [
    ...(!multiArena
      ? ["multi-arena design is demanded but source/topology count is not established"] : []),
    ...(multiArena && world.arenas.isolation.unknown > 0
      ? ["arena state ownership remains unknown"] : []),
    ...(multiArena && world.arenas.isolation.partitionProofRequired > 0
      ? ["arena state partitions require ownership proof"] : []),
  ];
  checkpoint.push(receipt(
    "B4",
    "FORMALIZE",
    "Multi-Arena Contract",
    !multiArenaRequired
      ? discoverySupportsAbsence &&
          (!world.arenas.detected || world.arenas.count === 1)
        ? "NOT_APPLICABLE"
        : "OPEN"
      : !multiArena
        ? "OPEN"
        : multiArenaFormalizationGaps.length > 0
          ? "PARTIAL"
          : "CLOSED",
    !multiArenaRequired
      ? discoverySupportsAbsence
        ? "Complete discovery supports a single/no-arena model without multi-arena demand."
        : "Multi-arena applicability cannot close while discovery or arena count is unresolved."
      : multiArenaFormalizationGaps.length > 0
        ? "Multi-arena FORMALIZE is incomplete: " +
          multiArenaFormalizationGaps.join("; ") + "."
        : "Authored arena count, ownership and lifecycle contracts are accounted. EVALUATE C9 retains physical layout, replica and concurrency checks; no runtime success is inferred.",
    [
      "analysis:arena-lifecycle",
      "analysis:multiplayer-interleaving",
    ],
    ["MultiArenaContract"],
    {
      obligations: [
        obligation(
          "arena-count-resolved",
          multiArenaRequired,
          multiArena && world.arenas.count !== undefined,
          "A required multi-arena contract needs a grounded visible arena count greater than one.",
          multiArena ? ["world:arena-count"] : [],
        ),
        obligation(
          "arena-isolation-analyzed",
          multiArenaRequired,
          world.analysisExecution.executedCapabilityIds.includes(
            "multiplayer-interleaving",
          ) &&
          world.arenas.isolation.unknown === 0 &&
          world.arenas.isolation.partitionProofRequired === 0,
          "Multi-arena requires scoped isolation analysis without unresolved ownership or partition proof.",
          ["analysis:multiplayer-interleaving"],
        ),
        obligation(
          "arena-lifecycle-analyzed",
          multiArenaRequired,
          world.analysisExecution.executedCapabilityIds.includes(
            "arena-lifecycle-integrity",
          ),
          "Multi-arena requires lifecycle/cleanup analysis.",
          ["analysis:arena-lifecycle"],
        ),
      ],
    },
  ));
  // Numeric capacity contracts already extracted from the selected map
  // are material boundaries even when the safe-config extractor found no
  // named binding. Missing bindings are a formalization gap, not absence.
  // The Arena Capacity Extraction owner returns a numeric player cap only
  // after an authority-backed selected-script capacity check. Do not require
  // a duplicate safe-config variable for the same object-property limit.
  // Derived total slots and requested topology counts belong to B4.
  const playerCapacitySourceGrounded =
    world.arenas.perArenaPlayerCapacity !== undefined &&
    playerCapacitySources.some((source) =>
      source.relativePath.trim().length > 0
    );
  const unresolvedRosterCapacityPaths =
    world.arenas.unresolvedRosterCapacityPaths ?? 0;
  const numericBoundaryDemand =
    world.arenas.perArenaPlayerCapacity !== undefined ||
    world.arenas.declaredConcurrentArenaLimit !== undefined ||
    unresolvedRosterCapacityPaths > 0;
  const ungroundedBoundaryRecords = boundaries.records.filter((record) =>
    record.sourcePath.trim().length === 0 ||
    record.cases.length === 0
  );
  // Boundary Registry covers named, source-bound numerical values. A
  // retry/round limit cannot stand in for a distinct, source-declared
  // player or concurrent-arena capacity of the same numerical value.
  // Requested arena count and derived total player slots are not separate
  // explicit limits: the capacity extractor computes them from topology
  // and per-arena source declarations, so do not demand fictional bindings.
  const declaredCapacityBoundaries = [
    {
      label: "per-arena player capacity",
      value: world.arenas.perArenaPlayerCapacity,
      namePattern: /(?:max.*(?:player|party|member)|(?:player|party|member).*(?:max|limit|capacit))/i,
      sourceAuthoritySatisfied: playerCapacitySourceGrounded,
    },
    {
      label: "declared concurrent arena limit",
      value: world.arenas.declaredConcurrentArenaLimit,
      namePattern: /(?:concurren|parallel|(?:max|limit|cap).*arena|arena.*(?:max|limit|cap))/i,
      sourceAuthoritySatisfied: false,
    },
  ];
  const missingDeclaredCapacityBounds = declaredCapacityBoundaries
    .filter((bound) => {
      const value = bound.value;
      if (value === undefined || bound.sourceAuthoritySatisfied) return false;
      return !boundaries.records.some((record) =>
        bound.namePattern.test(record.name) &&
        record.value === value &&
        record.sourcePath.trim().length > 0 &&
        record.cases.includes(value)
      );
    })
    .map((bound) =>
      bound.label + "=" + String(bound.value)
    );
  const conflictingNamedCapacityValues = declaredCapacityBoundaries
    .filter((bound) => bound.value !== undefined)
    .flatMap((bound) => boundaries.records
      .filter((record) =>
        bound.namePattern.test(record.name) &&
        record.value !== bound.value
      )
      .map((record) => record.id + " differs from " +
        bound.label + "=" + String(bound.value))
    );
  const boundaryFormalizationGaps = [
    ...(unresolvedRosterCapacityPaths > 0
      ? [String(unresolvedRosterCapacityPaths) +
          " detected roster-admission path(s) lack an enforceable, source-bound numeric capacity; unresolved boundaries cannot be classified as safe or not applicable"] : []),
    ...(conflictingNamedCapacityValues.length > 0
      ? ["conflicting capacity declarations: " +
          conflictingNamedCapacityValues.join(", ")] : []),
    ...(boundaries.unresolvedNames.length > 0
      ? ["unresolved boundary names: " +
          boundaries.unresolvedNames.join(", ")] : []),
    ...(ungroundedBoundaryRecords.length > 0
      ? ["boundary records have missing source paths or no edge cases: " +
          ungroundedBoundaryRecords.map((item) => item.id).join(", ")] : []),
    ...(missingDeclaredCapacityBounds.length > 0
      ? ["declared capacity bounds lack corresponding named source records: " +
          missingDeclaredCapacityBounds.join(", ")] : []),
  ];
  const hasSourceBoundaries =
    boundaries.records.length > 0 || playerCapacitySourceGrounded;
  checkpoint.push(receipt(
    "B5",
    "FORMALIZE",
    "Boundary Registry",
    !hasSourceBoundaries &&
      boundaries.unresolvedNames.length === 0
      ? numericBoundaryDemand || !discoverySupportsAbsence
        ? "OPEN"
        : "NOT_APPLICABLE"
      : boundaryFormalizationGaps.length > 0
        ? "PARTIAL"
        : "CLOSED",
    !hasSourceBoundaries &&
      boundaries.unresolvedNames.length === 0
      ? numericBoundaryDemand
        ? "A declared numeric gameplay limit lacks both a grounded arena-capacity authority value and a matching named boundary record."
        : discoverySupportsAbsence
          ? "Complete discovery supports absence of named or declared numeric gameplay boundaries."
          : "Boundary applicability remains unresolved while discovery is incomplete."
      : boundaryFormalizationGaps.length > 0
        ? "Boundary FORMALIZE is incomplete: " +
          boundaryFormalizationGaps.join("; ") + "."
        : "Named boundaries and authority-backed party capacity are accounted in selected source (" +
            (playerCapacitySources.map((source) => source.relativePath)
              .filter((path) => path.trim().length > 0)
              .join(", ") || "named script bindings") +
            "); gameplay behavior is not yet evaluated.",
    boundaries.records.map((item) => item.id),
    ["BoundaryRegistry"],
  ));

  // This is FORMALIZE's source-backed assessment coverage, not proof
  // Minecraft delivered a capability. Zero assessments cannot satisfy
  // classification vacuously (nor prove that no capability exists).
  const hasCapabilityAssessments =
    hidden.capabilityDelivery.length > 0;
  // A nonempty capability inventory must still cover the selected model's
  // mechanic assessment inventory, with one unambiguous assessment per ID.
  const capabilitySubjectIds = hidden.capabilityDelivery.map(
    (item) => item.subjectId,
  );
  const capabilitySubjectSet = new Set(capabilitySubjectIds);
  const missingMechanicCapabilityIds = hidden.mechanicCompleteness
    .map((item) => item.mechanicId)
    .filter((id) => !capabilitySubjectSet.has(id))
    .sort();
  const duplicateCapabilitySubjectIds = capabilitySubjectIds
    .filter((id, index) => capabilitySubjectIds.indexOf(id) !== index)
    .filter((id, index, items) => items.indexOf(id) === index)
    .sort();
  const capabilityFormalizationGaps = [
    ...(capabilityDeliveryUnproven.length > 0
      ? ["unproven capability subjects: " +
          capabilityDeliveryUnproven.map((item) => item.subjectId).join(", ")] : []),
    ...(missingMechanicCapabilityIds.length > 0
      ? ["mechanics missing capability assessments: " +
          missingMechanicCapabilityIds.join(", ")] : []),
    ...(duplicateCapabilitySubjectIds.length > 0
      ? ["duplicate capability assessment subjects: " +
          duplicateCapabilitySubjectIds.join(", ")] : []),
  ];
  checkpoint.push(receipt(
    "B6",
    "FORMALIZE",
    "Gameplay Capability Delivery",
    !hasCapabilityAssessments
      ? "OPEN"
      : capabilityFormalizationGaps.length > 0
        ? "PARTIAL"
        : "CLOSED",
    !hasCapabilityAssessments
      ? "No selected-artifact capability assessments are available. Missing assessments cannot establish capability absence or successful delivery."
      : capabilityFormalizationGaps.length > 0
        ? "Gameplay capability FORMALIZE is incomplete: " +
          capabilityFormalizationGaps.join("; ") + "."
        : capabilityDeliveryFailures.length > 0
          ? "Assessed capability degradation or absence must continue to PROVE; this structural checkpoint does not establish runtime behavior."
          : "All currently assessed capabilities have a source/model classification; runtime delivery remains unproven without independent observation.",
    hidden.capabilityDelivery.flatMap(
      (item) => item.evidenceIds,
    ),
    ["GameplayCapabilityDelivery"],
    {
      obligations: [
        obligation(
          "capability-delivery-classified",
          true,
          hasCapabilityAssessments &&
            capabilityFormalizationGaps.length === 0,
          "Every selected-artifact mechanic assessment must be represented exactly once and classified in the existing capability inventory; classification does not prove live runtime delivery.",
          hidden.capabilityDelivery.flatMap(
            (item) => item.evidenceIds,
          ),
        ),
      ],
    },
  ));

  const combatApplicable =
    world.combat.hurtHandlers > 0 ||
    world.combat.deathHandlers > 0 ||
    world.combat.damageApplications > 0;
  checkpoint.push(receipt(
    "C1",
    "EVALUATE",
    "Combat Lifecycle",
    combatApplicable
      ? "CLOSED"
      : positiveNotApplicable(
          discovery,
          demanded.has("combat-lifecycle"),
          combatApplicable,
        )
        ? "NOT_APPLICABLE"
        : "OPEN",
    combatApplicable
      ? "Combat lifecycle obligations are evaluated; contradictions flow into PROVE."
      : discoverySupportsAbsence
        ? "No combat intent or runtime combat surface remains after complete discovery."
        : "Combat applicability is unresolved while discovery is incomplete.",
    ["analysis:combat-lifecycle"],
    ["CombatLifecycleContract"],
    {
      obligations: [
        obligation(
          "combat-capability-executed",
          combatApplicable,
          world.analysisExecution.executedCapabilityIds.includes(
            "combat-lifecycle-contract",
          ),
          "Combat capability must execute when combat is applicable.",
          ["analysis:combat-lifecycle"],
        ),
        obligation(
          "combat-path-accounted",
          combatApplicable,
          world.combat.paths.length > 0 ||
            world.combat.policy.reviveContractContradictions > 0,
          "Applicable combat requires at least one scoped combat path or explicit contract contradiction.",
          world.combat.paths.map((item) =>
            item.scriptId + ":" + item.callbackRegion
          ),
        ),
      ],
    },
  ));

  const inventoryApplicable =
    world.inventory.regions > 0 ||
    world.inventory.grantRegions > 0 ||
    world.inventory.dropRegions > 0;
  checkpoint.push(receipt(
    "C2",
    "EVALUATE",
    "Inventory Lifecycle",
    inventoryApplicable
      ? "CLOSED"
      : positiveNotApplicable(
          discovery,
          demanded.has("inventory-state"),
          inventoryApplicable,
        )
        ? "NOT_APPLICABLE"
        : "OPEN",
    inventoryApplicable
      ? "Inventory lifecycle obligations are evaluated."
      : discoverySupportsAbsence
        ? "No inventory intent or lifecycle surface remains after complete discovery."
        : "Inventory applicability is unresolved while discovery is incomplete.",
    ["analysis:inventory-state"],
    ["InventoryLifecycleContract"],
    {
      obligations: [
        obligation(
          "inventory-capability-executed",
          inventoryApplicable,
          world.analysisExecution.executedCapabilityIds.includes(
            "inventory-lifecycle-integrity",
          ),
          "Inventory capability must execute when inventory is applicable.",
          ["analysis:inventory-state"],
        ),
        obligation(
          "inventory-scoped-assessment",
          inventoryApplicable,
          world.inventory.assessments.length > 0,
          "Applicable inventory must expose scoped lifecycle assessment.",
          world.inventory.assessments.map((item) =>
            item.scriptId + ":" + item.executionRegion
          ),
        ),
      ],
    },
  ));

  const economyApplicable = world.economy.sourceKinds.length > 0;
  checkpoint.push(receipt(
    "C3",
    "EVALUATE",
    "Reward / Economy Contract",
    economyApplicable
      ? "CLOSED"
      : positiveNotApplicable(
          discovery,
          demanded.has("economy-reward"),
          economyApplicable,
        )
        ? "NOT_APPLICABLE"
        : "OPEN",
    economyApplicable
      ? "Reward/economy obligations are evaluated."
      : discoverySupportsAbsence
        ? "No reward/economy intent or source remains after complete discovery."
        : "Reward/economy applicability is unresolved while discovery is incomplete.",
    ["analysis:economy-reward"],
    ["RewardEconomyContract"],
    {
      obligations: [
        obligation(
          "economy-capability-executed",
          economyApplicable,
          world.analysisExecution.executedCapabilityIds.includes(
            "economy-reward-integrity",
          ),
          "Economy capability must execute when reward/economy is applicable.",
          ["analysis:economy-reward"],
        ),
        obligation(
          "economy-path-accounted",
          economyApplicable,
          world.economy.paths.length > 0 ||
            world.economy.engineLootEntities > 0 ||
            world.economy.functionLootCommands > 0,
          "Applicable reward/economy requires a scoped reward path or explicit engine/function reward source.",
          world.economy.paths.map((item) =>
            item.scriptId + ":" + item.callbackRegion
          ),
        ),
      ],
    },
  ));

  const persistenceApplicable = (world.persistence?.properties ?? 0) > 0;
  checkpoint.push(receipt(
    "C4",
    "EVALUATE",
    "Persistence Matrix",
    persistenceApplicable
      ? (world.persistence?.unknownScope ?? 0) > 0 ||
        (world.persistence?.unknownLifetime ?? 0) > 0
        ? "PARTIAL"
        : "CLOSED"
      : discoverySupportsAbsence &&
          !demanded.has("persistence-recovery")
        ? "NOT_APPLICABLE"
        : "OPEN",
    persistenceApplicable
      ? "Persistence scope/lifetime evidence is projected across lifecycle boundaries."
      : discoverySupportsAbsence
        ? "No persistent gameplay state remains after complete discovery."
        : "Persistence applicability cannot close while discovery is incomplete.",
    ["analysis:persistence-recovery"],
    ["PersistenceMatrix"],
  ));

  checkpoint.push(receipt(
    "C5",
    "EVALUATE",
    "Deferred Work Registry",
    deferredRelations.length > 0
      ? "CLOSED"
      : discoverySupportsAbsence &&
          !demanded.has("temporal-ownership")
        ? "NOT_APPLICABLE"
        : "OPEN",
    deferredRelations.length > 0
      ? "Deferred/periodic work is enumerated with guard evidence; unsafe work flows into contradiction analysis."
      : discoverySupportsAbsence
        ? "No deferred/periodic gameplay work remains after complete discovery."
        : "Deferred-work applicability cannot close while discovery is incomplete.",
    deferredRelations.map((item) => item.id),
    ["DeferredWorkRegistry"],
    {
      obligations: [
        obligation(
          "deferred-relations-enumerated",
          deferredRelations.length > 0,
          deferredRelations.length > 0,
          "Deferred/periodic relations must be enumerated.",
          deferredRelations.map((item) => item.id),
        ),
        obligation(
          "deferred-ownership-analysis",
          deferredRelations.length > 0,
          world.analysisExecution.executedCapabilityIds.includes(
            "temporal-ownership-integrity",
          ),
          "Deferred work requires temporal ownership analysis.",
          ["analysis:temporal-ownership"],
        ),
      ],
    },
  ));

  const terminalScenario = compiledPresetScenarios.find(
    (scenario) => scenario.label === "terminal-collision",
  );
  const terminalPresetRequired =
    hidden.auditScenarioPreset.scenarios.some(
      (preset) => preset.kind === "terminal-collision",
    );
  const competingTerminalIntent =
    intent.nodes.filter((node) => node.kind === "outcome").length > 1;
  const terminalCoverage = assessTerminalCollisionSourceCoverage({
    scenario: terminalScenario,
    graph,
    selectedSourceEvidenceIds: selectedEvidenceIds,
    lifecycle: world.arenas.lifecycle,
  });
  const terminalRequired =
    terminalScenario !== undefined ||
    terminalPresetRequired ||
    competingTerminalIntent ||
    world.arenas.lifecycle.multiIngressTerminalTargets > 0 ||
    world.arenas.lifecycle.terminalRaces.length > 0 ||
    world.arenas.lifecycle.unresolvedTerminalRaces > 0 ||
    world.arenas.lifecycle.terminalPrecedenceUnresolved > 0;
  checkpoint.push(receipt(
    "C6",
    "EVALUATE",
    "Terminal Ownership",
    terminalRequired
      ? terminalCoverage.complete ? "CLOSED" : "OPEN"
      : discoverySupportsAbsence ? "NOT_APPLICABLE" : "OPEN",
    terminalRequired
      ? terminalCoverage.complete
        ? "The exact terminal-collision scenario has selected-source causal evidence and satisfied knowledge receipts; actual gameplay outcome proof belongs to PROVE."
        : "Terminal collision EVALUATE is incomplete: " +
          terminalCoverage.missing.join("; ") + "."
      : discoverySupportsAbsence
        ? "No materially competing terminal scenario was activated after complete discovery."
        : "Terminal-collision applicability cannot close while discovery is incomplete.",
    terminalCoverage.evidenceIds,
    ["TerminalCollisionMatrix"],
    {
      obligations: [
        obligation(
          "terminal-collision-source-evaluated",
          terminalRequired,
          terminalCoverage.complete,
          "A terminal-collision scenario requires an exact selected-source causal link, satisfied scenario knowledge, and no unaccounted terminal ownership residue; PROVE separately decides gameplay failure or safety.",
          terminalCoverage.evidenceIds,
        ),
      ],
    },
  ));

  const cleanupApplicable =
    world.arenas.cleanup.acquiredSurfaces > 0 ||
    world.arenas.cleanup.resourceLedger.resources > 0;
  const cleanupDemand =
    cleanupApplicable ||
    world.arenas.detected ||
    deferredRelations.length > 0 ||
    inventoryApplicable ||
    world.entities.definitions > 0 ||
    world.structures.loads > 0 ||
    world.chunks.tickingAreaAcquires > 0;
  checkpoint.push(receipt(
    "C7",
    "EVALUATE",
    "Cleanup Ledger",
    !cleanupApplicable
      ? discoverySupportsAbsence && !cleanupDemand
        ? "NOT_APPLICABLE"
        : "OPEN"
      : world.arenas.cleanup.resourceLedger.missing > 0 ||
          world.arenas.cleanup.unresolved > 0
        ? "PARTIAL"
        : "CLOSED",
    cleanupApplicable
      ? "Cleanup resources and terminal coverage are accounted."
      : discoverySupportsAbsence && !cleanupDemand
        ? "No material mutable resource requiring cleanup remains after complete discovery."
        : "Cleanup obligations are expected from detected mutable gameplay resources but no complete cleanup ledger is available.",
    ["analysis:arena-lifecycle"],
    ["CleanupLedger"],
    {
      obligations: [
        obligation(
          "cleanup-ledger-complete",
          cleanupApplicable,
          world.arenas.cleanup.resourceLedger.missing === 0 &&
            world.arenas.cleanup.unresolved === 0,
          "Every acquired cleanup resource must be accounted on applicable terminal paths.",
          ["analysis:arena-lifecycle"],
        ),
      ],
    },
  ));

  const repeated = compiledPresetScenarios.find(
    (scenario) => scenario.label === "repeated-run",
  );
  const repeatedPresetRequired =
    hidden.auditScenarioPreset.scenarios.some(
      (preset) => preset.kind === "repeated-run",
    );
  const reuseDemand =
    world.arenas.detected ||
    intent.edges.some(
      (edge) =>
        edge.kind === "resets" ||
        edge.kind === "recovers-to",
    );
  checkpoint.push(receipt(
    "C8",
    "EVALUATE",
    "Second-Run Equivalence",
    repeated
      ? "CLOSED"
      : discoverySupportsAbsence &&
          !reuseDemand &&
          !repeatedPresetRequired
        ? "NOT_APPLICABLE"
        : "OPEN",
    repeated
      ? "The repeated-run preset is represented by its compiled identity; lifecycle proof is assessed by the applicable knowledge obligations."
      : repeatedPresetRequired
        ? "The required repeated-run preset is missing or its compiled identity/flow does not match."
        : discoverySupportsAbsence && !reuseDemand
          ? "No replay/reuse/reset/recovery surface is present after complete discovery."
          : "Replay/reuse applicability is unresolved; detected reset/recovery or arena lifecycle requires explicit repeated-run accounting.",
    repeated ? [repeated.id] : [],
    ["SecondRunEquivalenceAssessment"],
    {
      obligations: [
        obligation(
          "repeated-run-scenario",
          repeatedPresetRequired || reuseDemand,
          repeated !== undefined,
          "Replay/reuse requires a repeated-run scenario.",
          repeated ? [repeated.id] : [],
        ),
        obligation(
          "repeated-run-dependencies-resolved",
          repeated !== undefined,
          repeated === undefined ||
            (repeated.requiredKnowledgeIds.length === 0 ||
              scenarioKnowledgeAccounted(repeated, graph)),
          "Repeated-run scenario requires all applicable cleanup/state/world dependencies to return satisfied receipts.",
          repeated?.requiredKnowledgeIds ?? [],
        ),
      ],
    },
  ));

  const requiredCrossSystemScenarioLabels =
    new Set<string>();

  const hasArena =
    demanded.has("arena-lifecycle") ||
    world.arenas.detected;
  const hasMultiplayer =
    demanded.has("multiplayer-interleaving") ||
    multiplayer.applicable;
  const hasCombat =
    demanded.has("combat-lifecycle");
  const hasInventory =
    demanded.has("inventory-state");
  const hasPersistence =
    demanded.has("persistence-recovery") ||
    (world.persistence?.properties ?? 0) > 0;
  const hasEconomy =
    demanded.has("economy-reward");
  const hasTemporal =
    demanded.has("temporal-ownership") ||
    deferredRelations.length > 0;
  const hasMutableRunState =
    hasArena ||
    hasInventory ||
    hasPersistence ||
    hasEconomy ||
    world.entities.definitions > 0 ||
    world.structures.loads > 0 ||
    world.chunks.tickingAreaAcquires > 0;

  if (hasArena && hasMultiplayer) {
    requiredCrossSystemScenarioLabels.add(
      "multi-arena-parallel",
    );
  }
  // Demand survives a missing or incomplete native arena count.
  if (multiArenaRequired) {
    requiredCrossSystemScenarioLabels.add(
      "arena-replica-integrity",
    );
  }
  if (
    hasPersistence &&
    (
      hasInventory ||
      hasCombat ||
      hasArena
    )
  ) {
    requiredCrossSystemScenarioLabels.add(
      "disconnect-reconnect",
    );
    requiredCrossSystemScenarioLabels.add(
      "reload-recovery",
    );
  }
  if (hasTemporal) {
    requiredCrossSystemScenarioLabels.add(
      "deferred-ownership",
    );
  }
  if (
    hasCombat &&
    (
      hasEconomy ||
      hasArena ||
      hasTemporal
    )
  ) {
    requiredCrossSystemScenarioLabels.add(
      "terminal-collision",
    );
  }
  if (hasMutableRunState) {
    requiredCrossSystemScenarioLabels.add(
      "repeated-run",
    );
  }
  if (
    world.arenas.count !== undefined &&
    world.arenas.safeConcurrentArenas !== undefined &&
    world.arenas.safeConcurrentArenas !== null &&
    world.arenas.safeConcurrentArenas <
      world.arenas.count
  ) {
    requiredCrossSystemScenarioLabels.add(
      "arena-capacity-plus-one",
    );
  }

  for (const kind of [
    "player-capability-integrity",
    "world-rule-authority",
    "client-server-reconciliation",
    "spatial-containment",
  ] as const) {
    if (
      hidden.auditScenarioPreset.scenarios.some(
        (scenario) => scenario.kind === kind,
      )
    ) {
      requiredCrossSystemScenarioLabels.add(kind);
    }
  }

  const requiredCrossSystemPresets =
    hidden.auditScenarioPreset.scenarios.filter((preset) =>
      requiredCrossSystemScenarioLabels.has(preset.kind)
    );
  const crossSystemScenarios = compiledPresetScenarios.filter(
    (scenario) => requiredCrossSystemPresets.some(
      (preset) => scenario.id === "preset:" + preset.id,
    ),
  );
  // A required kind missing from the preset inventory is still a gap;
  // a declared preset missing from the graph is a separate specific gap.
  const missingCrossSystemLabels = [
    ...[...requiredCrossSystemScenarioLabels].filter((kind) =>
      !requiredCrossSystemPresets.some((preset) => preset.kind === kind)
    ),
    ...requiredCrossSystemPresets
      .filter((preset) => !crossSystemScenarios.some(
        (scenario) => scenario.id === "preset:" + preset.id,
      ))
      .map((preset) => preset.kind + " [" + preset.id + "]"),
  ].sort();

  // Compiling a preset is not the same as evaluating a gameplay dependency.
  // Verify scoped source components, a concrete causal path, and every
  // declared knowledge receipt using existing Scenario Graph evidence.
  // Leave missing evidence unresolved rather than accepting an empty
  // scenario or a domain-only/generic placeholder as inspected gameplay.
  // Analysis capability receipts are domain context, not selected-source
  // causal evidence. An evidenced edge must belong to this exact scenario,
  // one of its linked components must have selected-artifact evidence, and
  // the source compiler must not classify the edge as a DETECTION_GAP.
  // RUNTIME_BLOCKED remains valid EVALUATE source coverage, not PROVE success.
  const selectedSourceEvidenceIds = selectedEvidenceIds;
  const sourceBoundCrossSystemLinks = crossSystemScenarios.map((scenario) => ({
    scenarioId: scenario.id,
    links: sourceBoundScenarioLinks(scenario, graph, selectedSourceEvidenceIds),
  }));
  const unboundCrossSystemScenarios = sourceBoundCrossSystemLinks
    .filter((item) => item.links.length === 0)
    .map((item) => item.scenarioId)
    .sort();
  const sourceBoundCrossSystemEvidenceIds = [
    ...new Set(sourceBoundCrossSystemLinks.flatMap((item) =>
      item.links.flatMap((link) =>
        link.evidenceIds.filter((id) => selectedSourceEvidenceIds.has(id))
      )
    )),
  ].sort();
  const unaccountedCrossSystemKnowledge = crossSystemScenarios
    .filter((scenario) =>
      !scenarioKnowledgeAccounted(scenario, graph)
    )
    .map((scenario) => scenario.id)
    .sort();
  // These are EVALUATE source/world and resource checks, not B4
  // gameplay-intent claims. PROVE still owns actual in-game delivery.
  const multiArenaEvaluationGaps = [
    ...(multiArenaRequired && world.arenas.safeConcurrentArenas == null
      ? ["multi-arena resource/concurrency capacity is not source-resolved"] : []),
    ...(multiArenaRequired && !arenaLayoutReconciled
      ? ["authored versus physical arena layout is unverified (" +
          (world.arenas.layoutStatus ?? "unavailable") + ")"] : []),
    ...(multiArenaRequired && (replicaProofIncomplete ||
      !multiArena ||
      (world.arenas.replicaIntegrity.complete === 0 &&
       world.arenas.replicaIntegrity.diverged === 0))
      ? ["physical arena replica integrity lacks complete source/world proof"] : []),
  ];
  const crossSystemCoverageComplete =
    missingCrossSystemLabels.length === 0 &&
    unboundCrossSystemScenarios.length === 0 &&
    unaccountedCrossSystemKnowledge.length === 0 &&
    multiArenaEvaluationGaps.length === 0;
  const crossSystemCoverageReasons = [
    ...multiArenaEvaluationGaps,
    ...(missingCrossSystemLabels.length === 0 ? [] : [
      "Required cross-system preset identities are missing: " +
        missingCrossSystemLabels.join(", ") + ".",
    ]),
    ...(unboundCrossSystemScenarios.length === 0 ? [] : [
      "Cross-system scenarios lack supported selected-source causal links (or retain a detection gap): " +
        unboundCrossSystemScenarios.join(", ") + ".",
    ]),
    ...(unaccountedCrossSystemKnowledge.length === 0 ? [] : [
      "Cross-system scenarios lack satisfied scoped knowledge receipts: " +
        unaccountedCrossSystemKnowledge.join(", ") + ".",
    ]),
  ];

  checkpoint.push(receipt(
    "C9",
    "EVALUATE",
    "Cross-System Scenario Coverage",
    requiredCrossSystemScenarioLabels.size === 0
      ? discoverySupportsAbsence
        ? "NOT_APPLICABLE"
        : "OPEN"
      : crossSystemCoverageComplete
        ? "CLOSED"
        : "OPEN",
    crossSystemCoverageReasons.length > 0
      ? crossSystemCoverageReasons.join(" ")
      : requiredCrossSystemScenarioLabels.size > 0
        ? "Every required cross-system preset has scoped component/link evidence and satisfied knowledge receipts; PROVE separately determines gameplay conclusions."
        : discoverySupportsAbsence
          ? "No high-value cross-system intersection is demanded after complete discovery."
          : "Cross-system applicability cannot close while discovery is incomplete.",
    sourceBoundCrossSystemEvidenceIds,
    ["ActivatedCrossSystemScenarioSet"],
    {
      obligations: [
        obligation(
          "required-cross-system-scenarios-activated",
          requiredCrossSystemScenarioLabels.size > 0,
          missingCrossSystemLabels.length === 0,
          "Every materially demanded cross-system intersection must activate its exact preset identity.",
          [],
        ),
        obligation(
          "cross-system-scenarios-source-bound",
          requiredCrossSystemScenarioLabels.size > 0,
          missingCrossSystemLabels.length === 0 &&
            unboundCrossSystemScenarios.length === 0,
          "Every required cross-system scenario must bind selected-source components and a scoped evidenced causal link that is not classified DETECTION_GAP; a preset name or unsupported inferred edge is insufficient.",
          sourceBoundCrossSystemEvidenceIds,
        ),
        obligation(
          "cross-system-scenarios-knowledge-accounted",
          requiredCrossSystemScenarioLabels.size > 0,
          missingCrossSystemLabels.length === 0 &&
            unaccountedCrossSystemKnowledge.length === 0,
          "Each required cross-system scenario must have explicit, satisfied knowledge receipts scoped to its declared requirements.",
          crossSystemScenarios.flatMap((scenario) =>
            scenario.requiredKnowledgeIds.flatMap((id) =>
              graph.knowledgeRequirements
                .filter((required) =>
                  required.id === id && required.scenarioId === scenario.id
                )
                .flatMap((required) =>
                  satisfiedScenarioKnowledgeReceipt(graph, required)?.evidenceIds ?? []
                )
            )
          ),
        ),
        obligation(
          "arena-concurrency-resolved",
          multiArenaRequired,
          multiArena && world.arenas.safeConcurrentArenas != null,
          "EVALUATE requires source-modeled resource/concurrency capacity; arithmetic is not live Minecraft delivery.",
          world.arenas.safeConcurrentArenas == null
            ? []
            : ["capacity:safe-concurrency"],
        ),
        obligation(
          "arena-world-db-replica-proof",
          multiArenaRequired,
          multiArena &&
            !replicaProofIncomplete &&
            (world.arenas.replicaIntegrity.complete > 0 ||
             world.arenas.replicaIntegrity.diverged > 0),
          "EVALUATE requires distinct world/topology evidence for each non-baseline arena; incomplete replicas cannot inherit baseline safety.",
          ["analysis:arena-replica-integrity"],
        ),
        obligation(
          "arena-layout-reconciled",
          multiArenaRequired,
          multiArena && arenaLayoutReconciled,
          "EVALUATE must reconcile the authored and physical arena layouts before replica or concurrency conclusions.",
          [],
        ),
      ],
    },
  ));

  // D1 independently validates the exact scoped Knowledge contract.
  // Scenario closure tracks analyzer statuses but cannot by itself detect
  // a forged SATISFIED receipt with empty evidence, duplicate ownership or
  // a receipt detached from its originating requirement.
  const unresolvedRigRequirements = graph.knowledgeRequirements.filter(
    (required) =>
      satisfiedScenarioKnowledgeReceipt(graph, required) === undefined
  );
  const orphanRigReceipts = graph.knowledgeReceipts.filter((receipt) =>
    !graph.knowledgeRequirements.some((required) =>
      required.id === receipt.requirementId &&
      required.scenarioId === receipt.scenarioId &&
      required.domain === receipt.domain
    )
  );
  const rigKnowledgeComplete =
    unresolvedRigRequirements.length === 0 &&
    orphanRigReceipts.length === 0;
  const scopedRigEvidenceIds = graph.knowledgeRequirements.flatMap(
    (required) =>
      satisfiedScenarioKnowledgeReceipt(graph, required)?.evidenceIds ?? []
  );

  checkpoint.push(receipt(
    "D1",
    "PROVE",
    "Required Inspection Graph",
    !rigKnowledgeComplete ||
    scenarioClosure.missingRequiredKnowledgeIds.length > 0 ||
      scenarioClosure.capabilityGapKnowledgeIds.length > 0 ||
      scenarioClosure.prerequisiteBlockedKnowledgeIds.length > 0 ||
      capabilityFailureRoutedIds.length !==
        capabilityDeliveryFailures.length
      ? "OPEN"
      : "CLOSED",
    capabilityFailureRoutedIds.length !==
        capabilityDeliveryFailures.length
      ? "A gameplay capability delivery failure exists without a CONTRADICTED causal link; design/implementation failure has not been routed into proof."
      : !rigKnowledgeComplete
        ? "RIG Knowledge requirements lack unique, scenario/domain-scoped, evidenced SATISFIED receipts or have orphaned receipts."
        : "RIG knowledge receipts and gameplay capability delivery failures are evaluated fail-closed.",
    [
      ...scopedRigEvidenceIds,
      ...hidden.capabilityDelivery.flatMap(
        (item) => item.evidenceIds,
      ),
    ],
    ["RequiredInspectionGraph", "GameplayCapabilityDelivery"],
    {
      obligations: [
        obligation(
          "rig-knowledge-receipts-accounted",
          graph.knowledgeRequirements.length > 0 ||
            graph.knowledgeReceipts.length > 0,
          rigKnowledgeComplete,
          "Every RIG Knowledge requirement must have one evidenced SATISFIED receipt owned by its scenario/domain, with no detached receipts.",
          scopedRigEvidenceIds,
        ),
        obligation(
          "capability-failures-routed-to-proof",
          capabilityDeliveryFailures.length > 0,
          capabilityFailureRoutedIds.length ===
            capabilityDeliveryFailures.length,
          "Every degraded/missing player-visible capability must map to a CONTRADICTED causal link; technical explanation alone cannot close it.",
          capabilityFailureRoutedIds,
        ),
        obligation(
          "runtime-residue-has-targeted-tests",
          scenarioClosure.runtimeBlockedCausalLinkIds.length > 0,
          scenarioClosure.runtimeProofRequests.length ===
            scenarioClosure.runtimeBlockedCausalLinkIds.length,
          "Every runtime-blocked gameplay dependency must emit one narrow runtime proof request; unresolved runtime residue may never remain a status-only note.",
          scenarioClosure.runtimeProofRequests.map(
            (item) => item.causalLinkId,
          ),
        ),
        obligation(
          "detection-gaps-have-targeted-tests",
          scenarioClosure.detectionGapCausalLinkIds.length > 0,
          scenarioClosure.detectionGapTestRequests.length ===
            scenarioClosure.detectionGapCausalLinkIds.length,
          "Every detection gap must emit one targeted tester obligation so unsupported semantics cannot silently remove a required gameplay test.",
          scenarioClosure.detectionGapTestRequests.map(
            (item) => item.causalLinkId,
          ),
        ),
      ],
    },
  ));

  checkpoint.push(receipt(
    "D2",
    "PROVE",
    "Contradiction Admission",
    scenarioClosure.status === "OPEN"
      ? "OPEN"
      : scenarioClosure.status === "PARTIAL"
        ? "PARTIAL"
        : "CLOSED",
    "Gameplay causal links are resolved to scenario-level proof states.",
    graph.causalLinks.flatMap((item) => item.evidenceIds),
    ["GameplayCausalLinks"],
    {
      reasonCode:
        scenarioClosure.status === "PARTIAL"
          ? "RUNTIME_PROOF_REQUIRED"
          : scenarioClosure.status === "OPEN"
            ? "PROCEDURE_BLOCKED"
            : "COMPLETE",
    },
  ));

  checkpoint.push(receipt(
    "D3",
    "PROVE",
    "Counter-Proof Search",
    defectResolution.counterProofSearchRequiredIds.length > 0 ||
      defectResolution.gameplayTranslationRequiredIds.length > 0
      ? "OPEN"
      : defectResolution.runtimeProofRequiredIds.length > 0
        ? "PARTIAL"
        : "CLOSED",
    "Every contradiction is routed through Gameplay Defect Resolution.",
    defectResolution.resolutions.flatMap(
      (item) => item.counterProofEvidenceIds ?? [],
    ),
    ["GameplayDefectResolution"],
    {
      reasonCode:
        defectResolution.runtimeProofRequiredIds.length > 0 &&
        defectResolution.counterProofSearchRequiredIds.length === 0 &&
        defectResolution.gameplayTranslationRequiredIds.length === 0
          ? "RUNTIME_PROOF_REQUIRED"
          : defectResolution.counterProofSearchRequiredIds.length > 0 ||
              defectResolution.gameplayTranslationRequiredIds.length > 0
            ? "PROCEDURE_BLOCKED"
            : "COMPLETE",
    },
  ));

  checkpoint.push(receipt(
    "D4",
    "PROVE",
    "Root-Cause Consolidation",
    scenarioClosure.status === "OPEN" ||
      defectResolution.status === "BLOCKED"
      ? "PARTIAL"
      : "CLOSED",
    scenarioClosure.status === "OPEN"
      ? "Root-cause consolidation cannot close while material scenario residue remains unresolved."
      : "Resolved defects are ready for semantic root-cause consolidation; report coverage enforces one-time causal-link coverage.",
    defectResolution.confirmedDefectReadyIds,
    ["RootCauseConsolidation"],
  ));

  checkpoint.push(receipt(
    "E1",
    "REPORT",
    "Map Audit Report Contract",
    scenarioClosure.status === "OPEN" ||
      defectResolution.status === "BLOCKED"
      ? "OPEN"
      : scenarioClosure.status === "PARTIAL"
        ? "PARTIAL"
        : "CLOSED",
    scenarioClosure.status === "OPEN"
      ? "Material scenario residue remains unresolved; report readiness is blocked until it becomes PROVEN, targeted NEED_VALIDATION, or explicit counter-proof."
      : scenarioClosure.status === "PARTIAL"
        ? "Only irreducible runtime-proof residue remains; every item must stay visible with its targeted validation test."
        : "Map Audit Report may preserve every material PROVEN and NEED_VALIDATION finding; approved Bug Report V2 promotion remains downstream.",
    [
      ...defectResolution.confirmedDefectReadyIds,
      ...defectResolution.runtimeProofRequiredIds,
      ...defectResolution.detectionGapIds,
    ],
    ["MapAuditReport"],
    {
      reasonCode:
        scenarioClosure.status === "PARTIAL"
          ? "RUNTIME_PROOF_REQUIRED"
          : scenarioClosure.status === "OPEN" ||
              defectResolution.status === "BLOCKED"
            ? "PROCEDURE_BLOCKED"
            : "COMPLETE",
    },
  ));

  const blocks = (
    ["TARGET", "DISCOVERY", "UNDERSTAND", "FORMALIZE", "EVALUATE", "PROVE", "REPORT"] as const
  ).map((block) => blockClosure(block, checkpoint));

  const status =
    blocks.some((item) => item.status === "OPEN")
      ? "OPEN"
      : blocks.some((item) => item.status === "PARTIAL")
        ? "PARTIAL"
        : "CLOSED";

  const reasons = blocks.flatMap((block) =>
    block.status === "CLOSED"
      ? []
      : [
          block.block +
            " is " +
            block.status +
            (block.openCheckpointIds.length > 0
              ? "; open: " + block.openCheckpointIds.join(", ")
              : "") +
            (block.partialCheckpointIds.length > 0
              ? "; partial: " + block.partialCheckpointIds.join(", ")
              : "") +
            ".",
        ],
  );

  const blockingCheckpointIds = checkpoint
    .filter((item) => item.blocksPublication)
    .map((item) => item.id)
    .sort();

  return {
    schemaVersion: 1,
    policy: "mandatory-gameplay-audit-procedure",
    checkpoints: checkpoint,
    blocks,
    status,
    stateRegistry,
    ownershipRegistry,
    progressionContracts,
    blockingCheckpointIds,
    reasons,
  };
}
