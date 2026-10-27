import { operatorMapTestStageFor, type OperatorMapTestStage } from "./map-audit-admission.js";
import type {
  GameDesignMapClassification,
} from "../../game-design-spec/src/index.js";
import {
  hasIndependentApprovedDesignEvidence,
  type GameplayIntentEdge,
  type GameplayIntentModel,
  type GameplayIntentNode,
} from "../../gameplay-intent/src/index.js";
import type {
  InspectArtifactResult,
} from "./inspection/inspect-artifact.js";
import type {
  SelectedMapAuditIdentity,
} from "./map-audit-identity.js";
import type {
  AuditIssueProjection,
  NeedValidationAuditIssueProjection,
} from "./map-audit-issue-projection.js";
import type {
  AuditValidationTestGroup,
} from "./map-audit-validation-plan.js";
import type {
  AuditHonestyAssessment,
} from "./map-audit-honesty.js";
import type {
  FullMapReplicaReceipt,
} from "./arena/full-map-replica-receipt.js";
import type {
  AuditObligation,
} from "./map-audit-obligations.js";
import type { SourceRef } from "../../project-model/src/index.js";
import type {
  GameplayArchitectureNavigation,
} from "./inspection/gameplay-scenario-model.js";
import type {
  AuditUserIntentEnvelope,
} from "./map-audit-user-intent.js";
import {
  deriveMapAuditQualityGates,
  type MapAuditQualityGates,
} from "./map-audit-quality-gates.js";

export interface MapAuditOutputV2FindingReasoning {
  readonly reportClassification:
    | "PROVEN BUG"
    | "LIKELY BUG"
    | "RISK"
    | "DESIGN MISMATCH"
    | "UNKNOWN"
    | "EXPECTED";
  readonly diagnosticDisposition?: string;
  readonly proofConfidence:
    | "unknown"
    | "low"
    | "medium"
    | "high"
    | "proven";
  readonly evidenceDomainSources: readonly string[];
  readonly evidenceChain: readonly string[];
  readonly unresolvedPredicates: readonly string[];
  readonly recommendedValidationPredicate?: string;
  readonly recommendedReadOnlyProbeId?: string;
}

export interface MapAuditOutputV2Finding {
  readonly id: string;
  readonly status: "PROVEN" | "NEED_VALIDATION";
  readonly issueType: "BUG" | "DESIGN_MISMATCH";
  readonly gameplayFlow: string;
  readonly failureDomain: string;
  readonly contributingDomains: readonly string[];
  readonly informationMismatch: boolean;
  readonly playerFacingEvidenceIds: readonly string[];
  readonly issue: string;
  readonly playerImpact: string;
  readonly reproduceSteps: readonly string[];
  readonly expected: string;
  readonly actual: string;
  readonly evidenceIds: readonly string[];
  /** Source-owned knowledge obligations for this finding, when present. */
  readonly knowledgeRequirementIds?: readonly string[];
  readonly proofCeiling:
    | "PROVEN"
    | "NEEDS_DECIDING_PROOF";
  readonly counterEvidence:
    | "cleared"
    | "unresolved";
  readonly validationReason?: string;
  readonly missingProof?: string;
  readonly validationTest?: string;
  readonly validationGroupKey?: string;
  readonly proofNavigation?:
    NeedValidationAuditIssueProjection["proofNavigation"];
  readonly reasoning?: MapAuditOutputV2FindingReasoning;
}

export interface MapAuditOutputControl {
  readonly status: "READY_FOR_REVIEW" | "BLOCKED";
  /** Public LOAD/UNDERSTAND/TEST/REPORT stage. The seven legacy internal
   * currentStage states remain source-proof/admission detail.
   */
  readonly operatorStage?: OperatorMapTestStage;
  readonly currentStage:
    | "TARGET"
    | "DISCOVERY"
    | "UNDERSTAND"
    | "FORMALIZE"
    | "EVALUATE"
    | "PROVE"
    | "REPORT"
    | "COMPLETE";
  readonly allowedNextAction:
    | "RESOLVE_BLOCKING_STAGE"
    | "RESOLVE_DEFECTS"
    | "PREPARE_REVIEW";
  readonly continuationOwner:
    | "ENGINE_OR_EVIDENCE"
    | "DEFECT_RESOLUTION"
    | "REVIEW";
  readonly requiresNewAuditRun: boolean;
  readonly blockingCheckpointIds: readonly string[];
  readonly reasons: readonly string[];
}

export interface MapAuditOutputV2 {
  readonly schemaVersion: 2;
  readonly artifactId: string;
  /** SHA-256 of selected archive bytes, always projected by current engine.
   * Optional for legacy V2 data, not an attestation of executable Git commit.
   */
  readonly artifactFingerprint?: string;
  /** Configured audit target, not a verified Minecraft runtime platform. */
  readonly auditTarget?: {
    readonly edition: "bedrock" | "education" | "unknown";
    readonly minecraftVersion?: string;
    readonly source: "selected-audit-runtime-target-not-live-observation";
  };
  readonly mapVersion: string;
  readonly control: MapAuditOutputControl;
  readonly userIntent?: AuditUserIntentEnvelope;
  readonly mapClassification?: {
    readonly use: "audit-routing-only";
    readonly classification:
      GameDesignMapClassification;
  };
  readonly evidenceScope: {
    readonly mode: "selected-map-version-only";
    readonly selectedArtifact: string;
    readonly archiveSourcesUsed: false;
  };
  readonly gameDesign: {
    readonly objective: string;
    readonly objectiveGrounding:
      | "authored"
      | "inferred"
      | "unresolved";
    readonly winCondition: string;
    readonly winConditionGrounding:
      | "authored"
      | "inferred"
      | "unresolved";
    readonly loseCondition: string;
    readonly loseConditionGrounding:
      | "authored"
      | "inferred"
      | "unresolved";
    readonly resetRules: readonly string[];
    readonly preserveRules: readonly string[];
    readonly progressionRules: readonly string[];
  };
  /** Audit checklist stages, NOT a reconstructed or observed player route. */
  readonly gameplayFlow: readonly string[];
  readonly gameplayFlowBasis: "AUDIT_CHECKLIST_NOT_OBSERVED_GAMEPLAY";
  /** Derived game-centric source navigation; not a second Game Design or bug authority. */
  readonly gameplayStructure?: GameplayArchitectureNavigation["gameplayStructure"];
  readonly stateTransitions: readonly {
    readonly from: string;
    readonly event: string;
    readonly to: string;
    readonly notes?: string;
  }[];
  readonly multiArena: {
    readonly detected: boolean;
    readonly visibleArenaCount: number | null;
    readonly declaredConcurrentArenaLimit: number | null;
    readonly safeConcurrentArenaLimit: number | null;
    readonly queueBehavior: string;
    readonly isolationRules: readonly string[];
  };
  readonly coverage: {
    readonly disposition:
      | "accounted"
      | "incomplete";
    readonly records: readonly {
      readonly surface: string;
      readonly status:
        | "understood"
        | "blocked"
        | "not-applicable";
      readonly reason?: string;
      readonly evidenceIds: readonly string[];
    }[];
  };
  readonly gameplayClosure: {
    readonly status: "CLOSED" | "PARTIAL" | "OPEN";
    readonly surfaceInventory: readonly {
      readonly id: string;
      readonly label: string;
      readonly kind: string;
      readonly status:
        | "understood"
        | "blocked"
        | "unknown"
        | "not-applicable";
      readonly reason?: string;
      readonly boundaries: readonly string[];
    }[];
    readonly stateModelComplete: boolean;
    readonly boundariesExtracted: boolean;
    readonly unaccountedSurfaceIds: readonly string[];
    readonly notes: string;
  };
  readonly bugs: readonly MapAuditOutputV2Finding[];
  readonly designMismatches:
    readonly MapAuditOutputV2Finding[];
  readonly auditObligations?:
    readonly AuditObligation[];
  readonly validationTests:
    readonly AuditValidationTestGroup[];
  /**
   * Derived visibility index only. It never changes issue type/proof state and
   * exists so gray-zone evidence cannot disappear from the human report.
   */
  readonly unresolved: {
    readonly status:
      | "CLEAR"
      | "HAS_UNRESOLVED";
    readonly total: number;
    readonly needValidationIds: readonly string[];
    readonly staticProofPendingIds: readonly string[];
    readonly runtimeRequiredIds: readonly string[];
    readonly auditObligationIds: readonly string[];
    readonly unknownSurfaceIds: readonly string[];
    /** Exact unresolved source-call/scheduler IDs from selected-map
     * Discovery A2. Optional for existing V2 readers; never game or bug proof.
     */
    readonly unresolvedSourceLinkIds?: readonly string[];
    /** Bounded source-only unresolved deferred mutations from the existing
     * Arena Lifecycle owner, NOT observed callbacks or reportable bugs.
     * Optional so existing V2 consumers remain valid.
     */
    readonly deferredMutationOwnership?: {
      readonly total: number;
      readonly samples: readonly {
        readonly scheduler: "run" | "runTimeout" | "runInterval" | "runJob";
        readonly source: SourceRef;
        readonly status:
          | "source-guard-candidate"
          | "source-snapshot-candidate"
          | "unresolved";
        readonly reason: string;
      }[];
      readonly omitted: number;
    };
  };
  readonly honesty: AuditHonestyAssessment;
  readonly qualityGates: MapAuditQualityGates;
  readonly fullMapReplica?: FullMapReplicaReceipt;
}

const PLAYER_FLOW = [
  "ENTRY_JOIN",
  "READY_START",
  "SETUP",
  "ACTIVE_GAMEPLAY",
  "PROGRESSION",
  "TERMINAL",
  "CLEANUP_REPLAY",
  "RECOVERY",
] as const;

function nodeText(
  node: GameplayIntentNode | undefined,
): string | undefined {
  const value =
    node?.description?.trim() ||
    node?.label.trim();
  return value || undefined;
}

function selectedSourceIds(model: GameplayIntentModel): Set<string> {
  return new Set((model.evidence ?? []).filter(item =>
    item.scope === "selected-artifact").map(item => item.id));
}

function independentlyAuthoredDesign(
  model: GameplayIntentModel,
  ids: readonly string[],
): boolean {
  const byId = new Map((model.evidence ?? []).map(item => [item.id, item]));
  return hasIndependentApprovedDesignEvidence(ids.map(id => byId.get(id)));
}

/**
 * Preserve a bounded view of distinct selected-artifact design candidates.
 * Their source identity is retained in the original GameplayIntentModel;
 * textual alternatives do not establish mutual reachability or mode scope.
 */
function summarizeSourceAlternatives(
  subject: string,
  missingScope: string,
  statements: readonly string[],
): string {
  const shown = statements.slice(0, 3).map(statement =>
    JSON.stringify(statement.replace(/\s+/g, " ").trim().slice(0, 65)),
  );
  const omitted = statements.length - shown.length;
  return "Multiple source-backed " + subject + " (" + statements.length +
    "; " + missingScope + " unresolved): " + shown.join("; ") +
    (omitted > 0 ? "; +" + omitted + " further candidates." : ".");
}

function summarizeSourceObjectives(model: GameplayIntentModel): {
  readonly text: string;
  readonly grounding: "authored" | "inferred" | "unresolved";
} {
  const selected = selectedSourceIds(model);
  const candidates = (model.nodes ?? []).filter(node =>
    node.kind === "objective" && node.status !== "hypothesis" &&
    node.evidenceIds.some(id => selected.has(id)))
    .sort((left, right) => left.id.localeCompare(right.id));
  if (candidates.length === 0) return {
    text: "Unresolved from selected artifact.",
    grounding: "unresolved",
  };
  // Multiple real modes can have different objectives. Do not collapse
  // their selected-source statements to an unhelpful count, and do not imply
  // that any candidate is the one map-wide/player-wide objective.
  if (candidates.length > 1) return {
    text: summarizeSourceAlternatives(
      "objective candidates",
      "player/mode scope",
      candidates.map(node => nodeText(node) ?? node.id),
    ),
    grounding: "unresolved",
  };
  const node = candidates[0]!;
  return {
    text: nodeText(node) ?? "Unresolved from selected artifact.",
    grounding: node.status === "authored" &&
      independentlyAuthoredDesign(model, node.evidenceIds)
      ? "authored" : "inferred",
  };
}

function edgeStatement(
  edge: GameplayIntentEdge,
  nodes: ReadonlyMap<string, GameplayIntentNode>,
): string {
  if (edge.description?.trim()) {
    return edge.description.trim();
  }
  const from =
    nodeText(nodes.get(edge.from)) ?? edge.from;
  const to =
    nodeText(nodes.get(edge.to)) ?? edge.to;
  return from + " " + edge.kind + " " + to;
}

function outcomeFor(
  model: GameplayIntentModel,
  kind: "wins-by" | "loses-by",
): {
  readonly text: string;
  readonly grounding: "authored" | "inferred" | "unresolved";
} | undefined {
  const nodes = new Map((model.nodes ?? []).map(node => [node.id, node]));
  const source = selectedSourceIds(model);
  const current = (ids: readonly string[]) =>
    ids.some(id => source.has(id));
  const candidates = (model.edges ?? []).filter(edge =>
    edge.kind === kind && edge.status !== "hypothesis" &&
    current(edge.evidenceIds) &&
    current(nodes.get(edge.from)?.evidenceIds ?? []) &&
    current(nodes.get(edge.to)?.evidenceIds ?? []))
    .sort((left, right) => left.id.localeCompare(right.id));
  if (candidates.length > 1) return {
    text: summarizeSourceAlternatives(
      kind + " relations",
      "mode/player scope",
      candidates.map(edge => edgeStatement(edge, nodes)),
    ),
    grounding: "unresolved",
  };
  const edge = candidates[0];
  if (edge === undefined) return undefined;
  return {
    text: edgeStatement(edge, nodes),
    grounding: edge.status === "authored" &&
      independentlyAuthoredDesign(model, edge.evidenceIds)
      ? "authored" : "inferred",
  };
}

function projectFinding(
  finding: AuditIssueProjection,
  reasoningByCausalLinkId?: Readonly<Record<string, MapAuditOutputV2FindingReasoning>>,
): MapAuditOutputV2Finding {
  const base = {
    id: finding.causalLinkId,
    status: finding.status,
    issueType: finding.issueType,
    gameplayFlow: finding.gameplayFlow,
    failureDomain: finding.failureDomain,
    contributingDomains:
      [...finding.contributingDomains],
    informationMismatch:
      finding.informationMismatch,
    playerFacingEvidenceIds:
      [...finding.playerFacingEvidenceIds],
    issue: finding.gameplayConsequence,
    playerImpact: finding.gameplayConsequence,
    reproduceSteps: [
      finding.gameplayTrigger,
      "Observe whether: " + finding.actualOutcome,
    ],
    expected: finding.expectedOutcome,
    actual: finding.actualOutcome,
    evidenceIds: [...finding.evidenceIds],
    ...(finding.knowledgeRequirementIds?.length
      ? { knowledgeRequirementIds: [...new Set(finding.knowledgeRequirementIds)].sort() }
      : {}),
    proofCeiling:
      finding.status === "PROVEN"
        ? "PROVEN" as const
        : "NEEDS_DECIDING_PROOF" as const,
    counterEvidence:
      finding.status === "PROVEN"
        ? "cleared" as const
        : "unresolved" as const,
    ...(reasoningByCausalLinkId?.[finding.causalLinkId] === undefined
      ? {}
      : { reasoning: reasoningByCausalLinkId[finding.causalLinkId] }),
  };

  if (finding.status === "PROVEN") {
    return base;
  }

  if (finding.proofNavigation === undefined) {
    throw new Error(
      "NEED_VALIDATION finding is missing proofNavigation: " +
        finding.causalLinkId +
        ".",
    );
  }

  return {
    ...base,
    validationReason:
      finding.validationReason,
    missingProof:
      finding.missingProof,
    validationTest:
      finding.validationTest,
    validationGroupKey:
      finding.validationGroupKey,
    proofNavigation:
      finding.proofNavigation,
  };
}

export function projectMapAuditOutputV2(input: {
  readonly inspection: InspectArtifactResult;
  readonly identity: SelectedMapAuditIdentity;
  readonly issueLanes: {
    readonly BUG: readonly AuditIssueProjection[];
    readonly DESIGN_MISMATCH:
      readonly AuditIssueProjection[];
  };
  readonly auditObligations:
    readonly AuditObligation[];
  readonly validationTests:
    readonly AuditValidationTestGroup[];
  readonly honesty: AuditHonestyAssessment;
  readonly userIntent?: AuditUserIntentEnvelope;
  readonly control: MapAuditOutputControl;
  readonly fullMapReplica?: FullMapReplicaReceipt;
  readonly gameplayStructure?: GameplayArchitectureNavigation["gameplayStructure"];
  readonly reasoningByCausalLinkId?: Readonly<Record<string, MapAuditOutputV2FindingReasoning>>;
}): MapAuditOutputV2 {
  const model =
    input.inspection.gameplayIntent.model;
  const nodes = new Map(
    model.nodes.map((node) => [node.id, node]),
  );
  const sourceIds = selectedSourceIds(model);
  const isCurrent = (ids: readonly string[]): boolean =>
    ids.some(id => sourceIds.has(id));
  const currentEdge = (edge: GameplayIntentEdge): boolean =>
    isCurrent(edge.evidenceIds) &&
    isCurrent(nodes.get(edge.from)?.evidenceIds ?? []) &&
    isCurrent(nodes.get(edge.to)?.evidenceIds ?? []);
  const objectiveSummary = summarizeSourceObjectives(model);
  const objective = objectiveSummary.text;
  const objectiveGrounding = objectiveSummary.grounding;
  const win = outcomeFor(model, "wins-by");
  const lose = outcomeFor(model, "loses-by");
  const winCondition = win?.text ?? "Unresolved from selected artifact.";
  const loseCondition = lose?.text ?? "Unresolved from selected artifact.";

  const resetRules = model.edges
    .filter((edge) =>
      edge.kind === "resets" &&
      edge.status !== "hypothesis" && currentEdge(edge)
    )
    .map((edge) => edgeStatement(edge, nodes))
    .sort();
  const preserveRules = model.edges
    .filter((edge) =>
      edge.kind === "persists" &&
      edge.status !== "hypothesis" && currentEdge(edge)
    )
    .map((edge) => edgeStatement(edge, nodes))
    .sort();
  const progressionRules = [
    ...model.edges
      .filter((edge) =>
        (
          edge.kind === "transitions-to" ||
          edge.kind === "produces" ||
          edge.kind === "consumes"
        ) &&
        edge.status !== "hypothesis" &&
        currentEdge(edge)
      )
      .map((edge) => edgeStatement(edge, nodes)),
    ...model.invariants
      .filter((item) =>
        item.status !== "hypothesis" &&
        isCurrent(item.evidenceIds) &&
        item.subjectIds.every(id =>
          isCurrent(nodes.get(id)?.evidenceIds ?? []))
      )
      .map((item) => item.statement.trim())
      .filter(Boolean),
  ].filter(
    (value, index, all) =>
      all.indexOf(value) === index,
  ).sort();

  const stateTransitions = model.edges
    .filter((edge) =>
      (
        edge.kind === "transitions-to" ||
        edge.kind === "recovers-to"
      ) &&
      edge.status !== "hypothesis" && currentEdge(edge)
    )
    .map((edge) => ({
      from:
        nodeText(nodes.get(edge.from)) ??
        edge.from,
      event: edge.kind,
      to:
        nodeText(nodes.get(edge.to)) ??
        edge.to,
      ...(edge.description?.trim()
        ? { notes: edge.description.trim() }
        : {}),
    }));

  const world = input.inspection.gameplayWorld;
  const closure = world.gameplayClosure;
  const coverageRecords = closure.surfaces.map(
    (surface) => ({
      surface: surface.id,
      status:
        surface.status === "understood"
          ? "understood" as const
          : surface.status === "not-applicable"
            ? "not-applicable" as const
            : "blocked" as const,
      ...(surface.reason === undefined
        ? {}
        : { reason: surface.reason }),
      evidenceIds:
        [...(surface.evidenceIds ?? [])],
    }),
  );

  const coverageDisposition =
    closure.status === "CLOSED" &&
    closure.unaccountedSurfaceIds.length === 0 &&
    closure.stateModelComplete &&
    closure.boundariesExtracted
      ? "accounted" as const
      : "incomplete" as const;
  const allFindings = [
    ...input.issueLanes.BUG,
    ...input.issueLanes.DESIGN_MISMATCH,
  ];
  const needValidationIds = allFindings
    .filter((finding) =>
      finding.status === "NEED_VALIDATION"
    )
    .map((finding) => finding.causalLinkId)
    .sort();
  const runtimeRequiredIds = input.validationTests
    .filter((group) =>
      group.verificationMode ===
        "NARROW_RUNTIME_VERIFICATION"
    )
    .flatMap((group) => group.findingIds)
    .filter((id, index, values) =>
      values.indexOf(id) === index
    )
    .sort();
  const runtimeRequiredSet =
    new Set(runtimeRequiredIds);
  const staticProofPendingIds =
    needValidationIds
      .filter((id) =>
        !runtimeRequiredSet.has(id)
      )
      .sort();
  const auditObligationIds =
    input.auditObligations
      .map((item) => item.id)
      .sort();
  const unknownSurfaceIds =
    closure.surfaces
      .filter((surface) =>
        surface.status === "unknown"
      )
      .map((surface) => surface.id)
      .sort();
  // A2 already knows which exact selected-map function/scheduler targets
  // could not be resolved. Do not lose those uncertainties just because
  // later Gameplay Intent or report findings are unavailable. A source-link
  // gap is a DISCOVERY obligation, never an inferred player-facing BUG.
  const unresolvedSourceLinkIds = [...new Set(
    input.inspection.gameplayDiscoveryClosure?.unresolvedSourceLinkIds ?? [],
  )].filter((id) => id.trim().length > 0).sort();
  // Projection only: reuse the canonical selected-artifact Arena Lifecycle
  // assessment and never infer a BUG from a missing runtime safety proof.
  const deferredMutationSources = [
    ...(input.inspection.arenaAnalysis.lifecycle?.deferredMutations ?? []),
  ].filter(item => item.status !== "protected")
    .sort((a, b) =>
      a.source.relativePath.localeCompare(b.source.relativePath) ||
      (a.source.range?.lineStart ?? 0) -
        (b.source.range?.lineStart ?? 0) ||
      (a.source.range?.columnStart ?? 0) -
        (b.source.range?.columnStart ?? 0) ||
      a.callbackRegion.localeCompare(b.callbackRegion) ||
      a.scheduler.localeCompare(b.scheduler));
  // One source-only question, not one independent audit blocker for EVERY
  // callback. Preserve exact site count and bounded provenance below; this
  // never creates a canonical finding, audit obligation or proof receipt.
  const deferredMutationIds = deferredMutationSources.length > 0
    ? ["source-only:deferred-mutation-ownership"]
    : [];
  const deferredMutationSamples = deferredMutationSources.slice(0, 6).map(item => ({
    scheduler: item.scheduler,
    source: item.source,
    status: item.status as
      "source-guard-candidate" | "source-snapshot-candidate" | "unresolved",
    reason: item.reason,
  }));
  const unresolvedIds = new Set([
    ...needValidationIds,
    ...auditObligationIds,
    ...unknownSurfaceIds,
    ...unresolvedSourceLinkIds,
    ...deferredMutationIds,
  ]);
  const unresolved = {
    status:
      unresolvedIds.size === 0
        ? "CLEAR" as const
        : "HAS_UNRESOLVED" as const,
    total: unresolvedIds.size,
    needValidationIds,
    staticProofPendingIds,
    runtimeRequiredIds,
    auditObligationIds,
    unknownSurfaceIds,
    ...(unresolvedSourceLinkIds.length === 0
      ? {} : { unresolvedSourceLinkIds }),
    ...(deferredMutationSources.length === 0 ? {} : {
      deferredMutationOwnership: {
        total: deferredMutationSources.length,
        samples: deferredMutationSamples,
        omitted: Math.max(0,
          deferredMutationSources.length - deferredMutationSamples.length),
      },
    }),
  };

  const qualityGates = deriveMapAuditQualityGates({
    controlStatus: input.control.status,
    coverageDisposition,
    gameplayClosureStatus: closure.status,
    honestyStatus: input.honesty.status,
    findings: allFindings.map((finding) => ({
      id: finding.causalLinkId,
      status: finding.status,
      informationMismatch:
        finding.informationMismatch,
      failureDomain: finding.failureDomain,
      contributingDomains:
        [...finding.contributingDomains],
      gameplayFlow: finding.gameplayFlow,
    })),
    auditObligationCount:
      input.auditObligations.length,
    validationTestCount:
      input.validationTests.length,
    auditObligations:
      input.auditObligations,
    multiArenaDetected:
      world.arenas.detected,
  });

  return {
    schemaVersion: 2,
    artifactId: input.identity.artifactId,
    artifactFingerprint: input.identity.artifactFingerprint,
    auditTarget: {
      edition: input.inspection.targetCompatibility?.edition ?? "unknown",
      ...(input.inspection.targetCompatibility?.version === undefined
        ? {}
        : { minecraftVersion: input.inspection.targetCompatibility.version }),
      source: "selected-audit-runtime-target-not-live-observation",
    },
    control: {
      ...input.control,
      operatorStage: operatorMapTestStageFor(input.control.currentStage),
    },
    ...(input.userIntent === undefined
      ? {}
      : { userIntent: input.userIntent }),
    mapVersion:
      input.identity.releaseVersion ??
      "UNRESOLVED",
    ...(input.inspection.hiddenGameplayDefects
      .classification === undefined
      ? {}
      : {
          mapClassification: {
            use: "audit-routing-only" as const,
            classification:
              input.inspection
                .hiddenGameplayDefects
                .classification,
          },
        }),
    evidenceScope: {
      mode: "selected-map-version-only",
      selectedArtifact:
        input.identity.levelName ??
        input.identity.artifactId,
      archiveSourcesUsed: false,
    },
    gameDesign: {
      objective,
      objectiveGrounding,
      winCondition,
      winConditionGrounding:
        win?.grounding ?? "unresolved",
      loseCondition,
      loseConditionGrounding:
        lose?.grounding ?? "unresolved",
      resetRules,
      preserveRules,
      progressionRules,
    },
    gameplayFlow: PLAYER_FLOW,
    gameplayFlowBasis: "AUDIT_CHECKLIST_NOT_OBSERVED_GAMEPLAY",
    ...(input.gameplayStructure === undefined
      ? {}
      : { gameplayStructure: input.gameplayStructure }),
    stateTransitions,
    multiArena: {
      detected: world.arenas.detected,
      visibleArenaCount:
        world.arenas.count ?? null,
      declaredConcurrentArenaLimit:
        world.arenas.declaredConcurrentArenaLimit ??
        null,
      safeConcurrentArenaLimit:
        world.arenas.safeConcurrentArenas ??
        null,
      queueBehavior:
        world.arenas.detected
          ? "Unresolved from selected artifact."
          : "not-applicable",
      isolationRules:
        world.arenas.isolation.observations
          .map(item =>
            item.key + "=" + item.status +
            " [source-scope:" + item.scope + "]" +
            " [source:" + (item.sourceLocator ?? item.sourcePath ?? "UNRESOLVED") + "]" +
            " " + item.reason
          )
          .sort(),
    },
    coverage: {
      disposition: coverageDisposition,
      records: coverageRecords,
    },
    gameplayClosure: {
      status: closure.status,
      surfaceInventory:
        closure.surfaces.map((surface) => ({
          id: surface.id,
          label: surface.label,
          kind: surface.kind,
          status: surface.status,
          ...(surface.reason === undefined
            ? {}
            : { reason: surface.reason }),
          boundaries:
            [...(surface.boundaries ?? [])],
        })),
      stateModelComplete:
        closure.stateModelComplete,
      boundariesExtracted:
        closure.boundariesExtracted,
      unaccountedSurfaceIds:
        [...closure.unaccountedSurfaceIds],
      notes: closure.reasons.join(" "),
    },
    bugs:
      input.issueLanes.BUG.map((finding) => projectFinding(finding, input.reasoningByCausalLinkId)),
    designMismatches:
      input.issueLanes.DESIGN_MISMATCH.map(
        (finding) => projectFinding(finding, input.reasoningByCausalLinkId),
      ),
    auditObligations:
      [...(input.auditObligations ?? [])],
    validationTests:
      [...input.validationTests],
    unresolved,
    honesty: input.honesty,
    qualityGates,
    ...(input.fullMapReplica === undefined
      ? {}
      : {
          fullMapReplica:
            input.fullMapReplica,
        }),
  };
}

/**
 * Stable public import path for existing clients. Formatter implementation
 * belongs exclusively to the read-only reporting view; this re-export does
 * not introduce an alternative Map Audit report/proof authority.
 */
export { formatSelectedMapAuditBrief } from "./reporting/map-audit-brief.js";
