import { parseLocalizedStageKey } from "./inspection/gameplay-intent-resource-text.js";
import type { ScriptWaveStage, ScriptAuthoredGameplayEntry, ScriptAuthoredContentCollection } from "../../../analyzers/scripts/src/index.js";
import type {
  GameDesignMapClassification,
} from "../../game-design-spec/src/index.js";
import type {
  GameplayIntentEdge,
  GameplayIntentModel,
  GameplayIntentNode,
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
import type {
  GameplayArchitectureNavigation,
} from "./inspection/gameplay-scenario-model.js";
import type {
  AuditUserIntentEnvelope,
} from "./map-audit-user-intent.js";
import type { AuditModelTaskPacket } from "./map-audit-model-task.js";
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
  return ids.some(id => {
    const source = byId.get(id);
    return source?.scope === "selected-artifact" &&
      source.origin === "game-design-spec";
  });
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
  const unresolvedIds = new Set([
    ...needValidationIds,
    ...auditObligationIds,
    ...unknownSurfaceIds,
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
    control: input.control,
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
            " [source:" + (item.sourcePath ?? "UNRESOLVED") + "]" +
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
 * Human-facing read-only view of the canonical MapAuditOutputV2.
 * No new report schema, audit authority, or inferred Minecraft runtime proof.
 */
export function formatSelectedMapAuditBrief(input: {
  readonly report: MapAuditOutputV2;
  readonly intent: GameplayIntentModel;
  /** Existing architecture projection from the SAME selected-map audit run. */
  readonly architecture?: GameplayArchitectureNavigation;
  /** Selected-archive source recipes, never a claim of spawning. */
  readonly waveStages?: readonly ScriptWaveStage[];
  readonly gameplayCatalog?: readonly ScriptAuthoredGameplayEntry[];
  readonly contentCollections?: readonly ScriptAuthoredContentCollection[];
  readonly modelTaskPackets: readonly AuditModelTaskPacket[];
}): string {
  const { report, intent, modelTaskPackets } = input;
  const waveStages = input.waveStages ?? [];
  const gameplayCatalog = input.gameplayCatalog ?? [];
  const contentCollections = input.contentCollections ?? [];
  const concise = (value: string): string =>
    value.replace(/\s+/g, " ").trim().slice(0, 300) || "unresolved";
  const evidenceById = new Map(
    intent.evidence.map((item) => [item.id, item]),
  );
  const features = report.gameplayStructure?.features ?? [];
  // A source-localized stage is navigational content, not a player state,
  // proof of a wave, or a causal link. Keep namespace/pack ownership intact.
  const localized = features.flatMap(feature => {
    if (feature.grounding !== "SOURCE_EVIDENCED") return [];
    const marker = feature.id.startsWith("phase:localized:")
      ? "phase:localized:" :
      feature.id.startsWith("mechanic:localized:")
        ? "mechanic:localized:" : undefined;
    if (marker === undefined) return [];
    let authored: string;
    try {
      authored = decodeURIComponent(feature.id.slice(marker.length));
    } catch {
      return [];
    }
    const separator = authored.lastIndexOf("#");
    if (separator < 1) return [];
    const path = authored.slice(0, separator);
    const key = authored.slice(separator + 1);
    const parsed = parseLocalizedStageKey(key);
    if (parsed === undefined) return [];
    const source = feature.sourceEvidenceIds.map(id => evidenceById.get(id))
      .find(item =>
        item?.scope === "selected-artifact" &&
        item.origin === "translation" &&
        item.locator.startsWith(path + "#L"));
    if (!source) return [];
    return [{
      feature,
      source: source.locator,
      group: [path, parsed.scopePrefix, parsed.kind, parsed.number].join("#"),
      path,
      parsed,
    }];
  });
  const localizedIds = new Set(localized.map(item => item.feature.id));
  const visibleFeatures = features.filter(feature =>
    !localizedIds.has(feature.id) &&
    // A feature supported ONLY by an old/external source is not a selected-map
    // mechanic; keep current unclassified features as unknown instead.
    !(feature.sourceEvidenceIds.length > 0 &&
      feature.sourceEvidenceIds.every(id =>
        evidenceById.get(id)?.scope === "external-reference")));
  const localizedGroups = new Map<string, typeof localized>();
  for (const item of localized) {
    const entries = localizedGroups.get(item.group) ?? [];
    entries.push(item);
    localizedGroups.set(item.group, entries);
  }
  const orderedGroups = [...localizedGroups.values()]
    .sort((a, b) =>
      a[0]!.path.localeCompare(b[0]!.path) ||
      a[0]!.parsed.scopePrefix.localeCompare(b[0]!.parsed.scopePrefix) ||
      a[0]!.parsed.kind.localeCompare(b[0]!.parsed.kind) ||
      a[0]!.parsed.number - b[0]!.parsed.number);

  const reconstructionByFeature = new Map(
    (report.gameplayStructure?.mechanicReconstructions ?? [])
      .map((mechanic) => [mechanic.featureId, mechanic] as const),
  );
  const journeys = report.gameplayStructure?.gameplayJourneyCandidates ?? [];
  const sourceStateAliasUnknowns = intent.unknowns
    .filter(item => item.id.startsWith("unknown:source-state-alias:"))
    .sort((a, b) => a.id.localeCompare(b.id));
  const returnPolicyUnknowns = intent.unknowns
    .filter(item => item.id.startsWith("unknown:outcome-policy-coverage:"))
    .sort((a, b) => a.id.localeCompare(b.id));
  const findings = [...report.bugs, ...report.designMismatches];
  const sourceIsolationRules = report.multiArena.isolationRules;
  const unresolvedSourceIsolation = sourceIsolationRules.filter(rule =>
    rule.includes("=partition-proof-required") ||
    rule.includes("=unknown"));
  const unresolvedSurfaces = report.gameplayClosure.surfaceInventory.filter(
    (item) => item.status === "blocked" || item.status === "unknown",
  );
  const out: string[] = [
    "# Selected Map Audit",
    "",
    "**Map:** " + concise(report.evidenceScope.selectedArtifact),
    "**Version:** " + concise(report.mapVersion),
    "**Status:** " + report.control.status + " / " +
      report.control.currentStage,
    "**Next action:** " + report.control.allowedNextAction,
    "",
    "## Game Understanding",
    "**Objective (" + report.gameDesign.objectiveGrounding + "):** " +
      concise(report.gameDesign.objective),
    "**Win (" + report.gameDesign.winConditionGrounding + "):** " +
      concise(report.gameDesign.winCondition),
    "**Lose (" + report.gameDesign.loseConditionGrounding + "):** " +
      concise(report.gameDesign.loseCondition),
    "**State route topology:** " +
      (report.gameplayClosure.stateModelComplete
        ? "Source-connected structural routes; player reachability NOT proven."
        : "Incomplete or unresolved source state routes."),
    "**Game terminal proof:** " +
      (report.gameplayClosure.surfaceInventory.some(surface =>
        surface.id === "runtime:terminal-outcome" &&
        surface.status === "unknown")
        ? "UNKNOWN: a source-state sink is not a win/loss or settlement."
        : "See independently grounded win/lose conditions; runtime NOT proven."),
    "",
  ];
  // A compact decision appears BEFORE the potentially large authored
  // source inventory. It projects existing report and task data only:
  // no new verdict, proof receipt, gameplay route or second state owner.
  const provenBugs = report.bugs.filter(item => item.status === "PROVEN");
  const provenMismatches = report.designMismatches.filter(item =>
    item.status === "PROVEN");
  const pendingFindings = [...report.bugs, ...report.designMismatches]
    .filter(item => item.status === "NEED_VALIDATION");
  const sourcedFeatures = visibleFeatures.filter(feature =>
    feature.grounding === "SOURCE_EVIDENCED");
  const firstTask = modelTaskPackets[0];
  const firstObligation = report.auditObligations?.[0];
  out.push(
    "## Immediate Decision (CURRENT SOURCE ONLY)",
    "**Authored feature candidates:** " + sourcedFeatures.length +
      "; these do not establish playability or execution.",
    "**Findings:** BUG " + provenBugs.length + " PROVEN / " +
      report.bugs.filter(item => item.status === "NEED_VALIDATION").length +
      " NEED_VALIDATION; DESIGN_MISMATCH " + provenMismatches.length +
      " PROVEN / " + report.designMismatches.filter(item =>
        item.status === "NEED_VALIDATION").length + " NEED_VALIDATION.",
    "**Open audit obligations:** " + (report.auditObligations?.length ?? 0) +
      "; remaining evidence questions: " + report.unresolved.total +
      ". Neither is a bug verdict.",
  );
  if (sourcedFeatures.length > 0) {
    out.push("**Selected-source mechanics to trace (sample):**");
    for (const feature of sourcedFeatures.slice(0, 5)) {
      const locations = feature.sourceEvidenceIds
        .map(id => evidenceById.get(id))
        .filter(item => item?.scope === "selected-artifact")
        .map(item => item!.locator);
      out.push("- " + concise(feature.label) +
        (locations.length === 0 ? " — source site unresolved" :
          " — " + [...new Set(locations)].slice(0, 2).map(concise).join("; ")));
    }
    if (sourcedFeatures.length > 5) {
      out.push("Other authored candidates not listed: " +
        (sourcedFeatures.length - 5) + ".");
    }
  }
  if (firstTask !== undefined) {
    const locations = [...new Set([
      ...(firstTask.knowledgeLookup?.sourceLocators ?? []),
      ...firstTask.evidenceContext.flatMap(item =>
        item.kind === "selected-artifact-evidence" && item.locator
          ? [item.locator] : []),
    ])];
    out.push(
      "**Next decision [" + firstTask.stage + " / " + firstTask.kind +
        "]:** " + concise(firstTask.decisionNeeded),
      "**Required next action:** " + concise(firstTask.goal),
      ...(firstTask.subjectSelection === undefined ? [] : [
        "**Source subject selection (NOT checkpoint proof):** " +
          firstTask.subjectSelection.basis + "; omitted candidates " +
          firstTask.subjectSelection.omittedCandidates,
      ]),
      "**Stop when:** " + concise(firstTask.stopCondition),
      ...(locations.length === 0 ? [
        "**Source witness:** unresolved; do not substitute external guides.",
      ] : [
        "**Source witness:** " + locations.slice(0, 3).map(concise).join("; "),
      ]),
    );
    if (firstTask.developerPractice?.items.length) {
      const guide = firstTask.developerPractice.items[0]!;
      out.push(
        "**Developer reference (NOT proof):** " + concise(guide.question),
        "**Design counterexample to check:** " + concise(guide.negativeControl),
      );
    }
  } else if (firstObligation !== undefined) {
    out.push(
      "**Next obligation [" + firstObligation.stage + "]:** " +
        concise(firstObligation.title),
      "**Deciding evidence:** " + concise(firstObligation.missingProof),
      "**Next check:** " + concise(firstObligation.validationTest),
    );
  } else if (pendingFindings.length > 0) {
    out.push(
      "**Next unresolved contradiction:** " + concise(pendingFindings[0]!.issue),
      "**Deciding evidence:** " + concise(pendingFindings[0]!.missingProof ??
        pendingFindings[0]!.validationReason ?? "not identified"),
    );
  } else {
    out.push(
      "**Next decision:** " +
        (report.control.status === "BLOCKED"
          ? "Current stage is blocked; no bounded source task was produced."
          : "No pending model task is present in this view."),
    );
  }
  out.push(
    "",
    "## Detailed Source Navigation (NOT A PLAYER PLAYTHROUGH)",
    "Technical source trees below are investigative references. They do not " +
      "override the game understanding, confirmed findings or next decision above.",
    "",
  );
  // Unlike broad trace co-membership, these are literal resolved IR edges.
  // Their target steps belong directly to the target region, but still
  // require player/session reachability and guard evaluation before any BUG.
  const sourceHandoffs = new Map<string, {
    readonly flowId: string;
    readonly edge: NonNullable<
      NonNullable<MapAuditOutputV2["gameplayStructure"]>
        ["sourceFlowCandidates"][number]["sourceHandoffs"]
    >[number];
  }>();
  for (const flow of report.gameplayStructure?.sourceFlowCandidates ?? []) {
    for (const edge of flow.sourceHandoffs ?? []) {
      if (!sourceHandoffs.has(edge.edgeId)) {
        sourceHandoffs.set(edge.edgeId, { flowId: flow.id, edge });
      }
    }
  }
  const selectedHandoffs = [...sourceHandoffs.values()]
    .sort((a, b) => a.edge.edgeId.localeCompare(b.edge.edgeId));
  if (selectedHandoffs.length > 0) {
    out.push(
      "### Cross-region source handoffs (RESOLVED CODE EDGES; NOT EXECUTION)",
      "Each entry records a single resolved source call or callback link to " +
        "the DIRECT target region. Other steps in the same broad trace are " +
        "not presumed causal successors. A guard check observed in source " +
        "is not proof that a stale callback was cancelled.",
    );
    for (const { edge } of selectedHandoffs.slice(0, 8)) {
      const site = edge.source.relativePath +
        (edge.source.range?.lineStart === undefined ? "" :
          ":" + edge.source.range.lineStart);
      out.push(
        "- " + edge.kind +
          (edge.scheduler === undefined ? "" : " [" + edge.scheduler + "]") +
          ": " + concise(edge.fromRegionId) + " → " +
          concise(edge.toRegionId),
        "  Call site: " + concise(site) +
          "; generation guard: " + edge.generationGuard,
        "  Direct target state writes: " +
          edge.directTargetStateWriteIds.slice(0, 4).map(concise).join("; ") +
          "; world effect attempts: " +
          edge.directTargetWorldEffectIds.slice(0, 4).map(concise).join("; ") +
          "; resource releases: " +
          edge.directTargetReleaseIds.slice(0, 4).map(concise).join("; ") +
          "; additional target steps omitted: " + edge.omittedDirectTargetSteps,
      );
    }
    if (selectedHandoffs.length > 8) {
      out.push("Additional resolved source handoffs not expanded: " +
        (selectedHandoffs.length - 8));
    }
    const truncated = (report.gameplayStructure?.sourceFlowCandidates ?? [])
      .reduce((n, flow) => n + (flow.omittedSourceHandoffs ?? 0), 0);
    if (truncated > 0) out.push("Other handoffs truncated at source flow: " +
      truncated + " (not proof of absence).");
  }
  // Navigation over the EXISTING canonical Intent owns edges. This is
  // source-structure containment, never a chronological player journey.
  // Show the discovered shape first, before technical evidence inventories.
  const authoredNodes=intent.nodes.filter(node =>
    (node.id.includes(":authored-source:") ||
     node.id.startsWith("resource:authored-content:")) &&
    node.evidenceIds.some(id=>
      evidenceById.get(id)?.scope==="selected-artifact"));
  const authoredIds=new Set(authoredNodes.map(node=>node.id));
  const authoredOwnership=intent.edges.filter(edge =>
    edge.id.startsWith("authored-content-owns:") &&
    edge.kind==="owns" && edge.status==="inferred" &&
    authoredIds.has(edge.from) && authoredIds.has(edge.to) &&
    edge.evidenceIds.some(id=>
      evidenceById.get(id)?.scope==="selected-artifact"));
  const children=new Map<string,typeof authoredOwnership>();
  const contained=new Set<string>();
  for(const edge of authoredOwnership){
    children.set(edge.from,[...(children.get(edge.from)??[]),edge]);
    contained.add(edge.to);
  }
  const authoredById=new Map(authoredNodes.map(node=>[node.id,node]));
  const sourceRef=(id:string):string=>{
    const node=authoredById.get(id);
    const site=node?.evidenceIds.map(x=>evidenceById.get(x))
      .find(e=>e?.scope==="selected-artifact");
    return site?.locator??"UNKNOWN";
  };
  // Source coordinates define authored order. Lexical comparison of
  // ":100:..." and ":20:..." would otherwise misorder stages.
  const sourceOrder=(left:string,right:string):number=>{
    const parsed=(locator:string)=>{
      const match=/^(.*):(\d+):(\d+)$/.exec(locator);
      return match ? {
        path:match[1]!,line:Number(match[2]),column:Number(match[3]),
      } : {path:locator,line:0,column:0};
    };
    const a=parsed(sourceRef(left)),b=parsed(sourceRef(right));
    return a.path.localeCompare(b.path) ||
      a.line-b.line || a.column-b.column || left.localeCompare(right);
  };
  const orderedChildren=(id:string)=>
    [...(children.get(id)??[])].sort((a,b)=>
      sourceOrder(a.to,b.to));
  const rootNodes=authoredNodes.filter(node=>!contained.has(node.id))
    .sort((a,b)=>sourceOrder(a.id,b.id));
  if(rootNodes.length>0){
    out.push("", "### Game design content graph (SOURCE HIERARCHY ONLY)");
    out.push("Literal authored containment, not player progression. "+
      "The root overview is shown before bounded per-branch details so "+
      "a spawn-heavy early stage cannot hide later levels, modes or rounds. "+
      "No node proves activation, completion, actual spawning, or a "+
      "delivered result.");

    // Root coverage is independent of the cost of rendering grandchildren.
    // Keep per-root and per-branch limits explicit; never confuse a
    // presentation omission with a missing authored design node.
    const maxRoots=64;
    const visibleRoots=rootNodes.slice(0,maxRoots);
    out.push("**Authored root overview:** "+
      visibleRoots.length+" of "+rootNodes.length+
      " source root(s) represented.");
    for(const root of visibleRoots){
      const immediate=orderedChildren(root.id);
      out.push("- **"+concise(root.label)+"**"+
        " — "+immediate.length+" direct content item(s); source "+
        concise(sourceRef(root.id)));
      if(immediate.length>0){
        const labels=immediate.slice(0,36).map(edge=>
          authoredById.get(edge.to)?.label ?? "UNKNOWN");
        out.push("  Direct children: "+labels.map(concise).join(" | ")+
          (immediate.length>36
            ? " | +"+(immediate.length-36)+
              " more authored children (not listed in overview)" : ""));
      }
    }
    if(rootNodes.length>maxRoots){
      out.push("Additional authored roots not expanded in this brief: "+
        (rootNodes.length-maxRoots)+
        ". All remain in the canonical Intent Graph.");
    }

    const maxDirectTotal=240;
    const maxDirectPerRoot=Math.max(1,Math.min(48,
      Math.floor(maxDirectTotal/visibleRoots.length)));
    const directShownCount=visibleRoots.reduce((total,root)=>
      total+Math.min(orderedChildren(root.id).length,maxDirectPerRoot),0);
    const maxLeafTotal=150;
    // Give compact pools enough room for all authored choices (e.g. 8
    // per difficulty) while the shared budget still limits large maps.
    const maxLeafPerDirect=Math.max(1,Math.min(12,
      Math.floor(maxLeafTotal/Math.max(1,directShownCount))));
    const addAuthoredConfig=(id:string,indent:string):void=>{
      const node=authoredById.get(id);
      if(!node)return;
      let decodedId="";
      try { decodedId=decodeURIComponent(id); } catch {}
      const detailed=decodedId.includes("#wave:") ||
        decodedId.includes("#spawn:") ||
        decodedId.includes("#wave-end:") ||
        decodedId.includes("#config:");
      if(!detailed)return;
      const sourceFact=node.evidenceIds
        .filter(x=>x.startsWith("authored-content-evidence:"))
        .map(x=>evidenceById.get(x))
        .find(x=>x?.scope==="selected-artifact");
      const summary=sourceFact?.summary.split(
        " Source-authored content only;")[0] ?? "";
      if(summary)out.push(indent+"  Authored config: "+
        concise(summary));
    };
    out.push("", "**Branch details (balanced source samples, NOT OBSERVED):**");
    for(const root of visibleRoots){
      const direct=orderedChildren(root.id);
      const directShown=direct.slice(0,maxDirectPerRoot);
      out.push("- **"+concise(root.label)+"** [authored root]");
      addAuthoredConfig(root.id,"  ");
      if(direct.length===0){
        out.push("  Source: "+concise(sourceRef(root.id)));
        continue;
      }
      for(const edge of directShown){
        const node=authoredById.get(edge.to);
        if(!node)continue;
        const nested=orderedChildren(edge.to);
        out.push("  - **"+concise(node.label)+"**"+
          " ["+nested.length+" nested source item(s)]"+
          " — "+concise(sourceRef(edge.to)));
        addAuthoredConfig(edge.to,"    ");
        for(const child of nested.slice(0,maxLeafPerDirect)){
          const leaf=authoredById.get(child.to);
          if(!leaf)continue;
          out.push("    - "+concise(leaf.label)+
            " — "+concise(sourceRef(leaf.id)));
          addAuthoredConfig(leaf.id,"      ");
          const deeper=orderedChildren(leaf.id);
          if(deeper.length>0)out.push(
            "      Deeper authored items not expanded: "+deeper.length);
        }
        if(nested.length>maxLeafPerDirect)
          out.push("    Additional authored items in "+
            concise(node.label)+": "+
            (nested.length-maxLeafPerDirect)+
            " (not displayed; canonical source graph retains them).");
      }
      if(direct.length>directShown.length)
        out.push("  Additional direct children of "+
          concise(root.label)+": "+(direct.length-directShown.length)+
          " (not expanded; see overview and canonical graph).");
    }
    const unjoined=(
      waveStages.length>0 && orderedGroups.length>0
    ) || (gameplayCatalog.length>0 && waveStages.length>0);
    if(unjoined){
      out.push("Cross-source content relationships (e.g. localized "+
        "stage labels versus script stage definitions, or mode versus wave "+
        "ownership) remain UNKNOWN unless exact selected-source dependency "+
        "evidence connects them.");
    }
  }
  if (gameplayCatalog.length > 0) {
    out.push("", "### Script-authored gameplay/mode catalog (NOT OBSERVED)");
    out.push("These are independently labelled source catalog entries, not " +
      "proof of a playable mode, active challenge, wave, player progression, " +
      "or implementation of its described mechanics.");
    const ordered = [...gameplayCatalog].sort((a,b) =>
      a.source.relativePath.localeCompare(b.source.relativePath) ||
      (a.number ?? Number.MAX_SAFE_INTEGER) -
        (b.number ?? Number.MAX_SAFE_INTEGER) ||
      a.id.localeCompare(b.id));
    for (const entry of ordered.slice(0, 50)) {
      const ordinal = entry.number === undefined ? "" : " #" + entry.number;
      const source = entry.source.relativePath +
        (entry.source.range === undefined ? "" :
          ":" + entry.source.range.lineStart + ":" +
          (entry.source.range.columnStart ?? 1));
      out.push("- **" + entry.kind + ordinal + ": " +
        concise(entry.name) + "** / id=" + concise(entry.id) +
        " [source-labelled; gameplay semantics UNKNOWN]",
        "  Source: " + concise(source));
    }
    if (ordered.length > 50) {
      out.push("Additional source catalog entries omitted: " +
        (ordered.length - 50));
    }
    if (waveStages.length === 0) {
      out.push("No direct nested stage/wave recipes were extracted in this " +
        "view. This is not evidence that the map contains no waves.");
    }
  }
  const contentDependencyEdges = intent.edges.filter(edge =>
    edge.id.startsWith("source-content-requires:") &&
    edge.kind === "requires" &&
    edge.status === "inferred" &&
    edge.evidenceIds.some(id =>
      evidenceById.get(id)?.scope === "selected-artifact"));
  if (contentDependencyEdges.length > 0) {
    out.push("", "### Source-content dependencies (INTENT GRAPH; NOT OBSERVED)");
    out.push("These are exact static import/use references. They do not " +
      "prove selected rounds, execution of a reader, state progression, " +
      "gameplay purpose, or score settlement.");
    const intentNodes = new Map(intent.nodes.map(node => [node.id,node]));
    for (const edge of contentDependencyEdges.slice(0, 30)) {
      const from = intentNodes.get(edge.from);
      const to = intentNodes.get(edge.to);
      if (!from || !to) continue;
      const sites = edge.evidenceIds.map(id => evidenceById.get(id))
        .filter(item => item?.scope === "selected-artifact")
        .map(item => concise(item!.locator));
      out.push("- **" + concise(from.label) + "** --(requires; SOURCE ONLY)--> " +
        "**" + concise(to.label) + "**",
        "  Source: " + [...new Set(sites)].slice(0, 4).join("; "));
      const writes = from.evidenceIds
        .filter(id => id.startsWith("source-content-context:"))
        .map(id => evidenceById.get(id))
        .filter(record => record?.scope === "selected-artifact");
      if (writes.length > 0) {
        out.push("  Source-local assignments (NOT execution/causation):");
        for (const write of writes.slice(0, 12)) {
          out.push("  - " + concise(write!.summary),
            "    Source: " + concise(write!.locator));
        }
        if (writes.length > 12) {
          out.push("  Additional source-local assignments omitted: " +
            (writes.length - 12));
        }
      }
    }
    if (contentDependencyEdges.length > 30) {
      out.push("Additional authored source-content references omitted: " +
        (contentDependencyEdges.length - 30));
    }
  }
  // A navigable source tree over the SAME Intent edges, not a second graph.
  // Source call direction is a technical dependency, not play chronology.
  const ownedMaps = intent.nodes.filter(node =>
    node.id.startsWith("resource:source-class-map:"));
  if(ownedMaps.length>0){
    out.push("", "### Source keyed storage ownership (KEY IDENTITY UNKNOWN)");
    out.push("One source class initializes a Map and calls set/get on the "+
      "same field. This connects source code to a collection, NOT a stable "+
      "runtime arena/session/player or equivalent read/write key.");
    for(const map of ownedMaps.slice(0,12)){
      out.push("- **"+concise(map.label)+"**");
      const definition=map.evidenceIds.map(id=>evidenceById.get(id))
        .find(e=>e?.id.startsWith("source-class-map-definition:"));
      if(definition)out.push("  - Declaration: "+
        concise(definition.locator));
      const sites=map.evidenceIds.map(id=>evidenceById.get(id))
        .filter(e=>e?.scope==="selected-artifact" &&
          e.id.startsWith("source-class-map-access:"));
      for(const site of sites.slice(0,28)){
        out.push("  - "+concise(site!.summary),
          "    Source: "+concise(site!.locator));
      }
      if(sites.length>28)out.push("  Additional access sites omitted: "+
        (sites.length-28));
      const unknown=intent.unknowns.find(u=>
        u.id.startsWith("unknown:source-map-key-identity:") &&
        u.blockedSubjectIds.includes(map.id));
      if(unknown)out.push("  - Key identity unresolved: "+
        concise(unknown.question));
    }
    if(ownedMaps.length>12)out.push("Additional owned Maps omitted: "+
      (ownedMaps.length-12));
  }
  const designCallEdges = intent.edges.filter(edge =>
    (edge.id.startsWith("source-method-call:") ||
     edge.id.startsWith("source-instance-candidate:")) &&
    edge.kind === "requires" && edge.status === "inferred");
  if (designCallEdges.length > 0) {
    const byNode = new Map(intent.nodes.map(node => [node.id,node]));
    const outgoing = new Map<string, typeof designCallEdges>();
    const inbound = new Set<string>();
    for (const edge of designCallEdges) {
      if (!byNode.has(edge.from) || !byNode.has(edge.to)) continue;
      outgoing.set(edge.from,[...(outgoing.get(edge.from) ?? []),edge]);
      inbound.add(edge.to);
    }
    const stateNodes = new Map<string,string[]>();
    for (const edge of intent.edges) {
      if (!edge.id.startsWith("source-method-state:") ||
          edge.kind !== "participates-in" ||
          edge.status !== "inferred") continue;
      const label = byNode.get(edge.to)?.label;
      if (!label) continue;
      stateNodes.set(edge.from,[...(stateNodes.get(edge.from) ?? []),label]);
    }
    const informative = (id:string):boolean =>
      (stateNodes.get(id)?.length ?? 0) > 0 ||
      (byNode.get(id)?.evidenceIds.some(ref =>
        ref.startsWith("source-method-property-site:") ||
        ref.startsWith("source-unresolved-receiver-site:")) ?? false);
    const reachableInformative = (id:string,visited:Set<string>,
      depth:number):boolean => {
      if (informative(id)) return true;
      if (depth >= 5) return false;
      for (const edge of outgoing.get(id) ?? []) {
        if (visited.has(edge.to)) continue;
        const next = new Set(visited);
        next.add(edge.to);
        if (reachableInformative(edge.to,next,depth+1)) return true;
      }
      return false;
    };
    const roots = [...outgoing.keys()]
      .filter(id=>!inbound.has(id))
      .sort((a,b)=>
        Number(reachableInformative(b,new Set([b]),0)) -
        Number(reachableInformative(a,new Set([a]),0)) ||
        a.localeCompare(b));
    // Cyclic graphs have no root; expose each technical component once as
    // a candidate rather than fabricate a source entry.
    const entries = roots.length ? roots : [...outgoing.keys()].sort();
    const maxRoots = 12;
    let visitedBudget = 0;
    const maxNodes = 120;
    const outputTree = (id:string, depth:number, seen:Set<string>,
      relation?:string):void => {
      if(visitedBudget>=maxNodes)return;
      visitedBudget++;
      const node=byNode.get(id);
      if(!node)return;
      const indent="  ".repeat(depth);
      out.push(indent + "- " +
        (relation ? relation + " → " : "") +
        "**" + concise(node.label) + "**" +
        (seen.has(id)?" [cycle]":""));
      if(seen.has(id))return;
      for(const label of (stateNodes.get(id)??[]).slice(0,3))
        out.push(indent + "  - Authored state value: " + concise(label) +
          " [NOT OBSERVED]");
      const facts=(node.evidenceIds??[])
        .filter(ref=>ref.startsWith("source-method-property-site:") ||
          ref.startsWith("source-unresolved-receiver-site:"))
        .map(ref=>evidenceById.get(ref))
        .filter(item=>item?.scope==="selected-artifact");
      for (const fact of facts.slice(0,3)) out.push(indent +
        "  - " + concise(fact!.summary));
      if(depth>=5)return;
      const next=new Set(seen);next.add(id);
      for(const edge of (outgoing.get(id)??[]).slice(0,12)) {
        if(visitedBudget>=maxNodes)break;
        outputTree(edge.to,depth+1,next,
          edge.id.startsWith("source-instance-candidate:")
            ? "candidate receiver" : "source call");
      }
    };
    if(entries.length) {
      out.push("", "### Source-backed method dependency tree (NOT PLAY SEQUENCE)");
      out.push("Source call and candidate receiver links are navigational " +
        "only. State labels and property writes are authored source facts, " +
        "not a guaranteed player route, score settlement or observed result.");
      for(const root of entries.slice(0,maxRoots)) {
        if(visitedBudget>=maxNodes)break;
        outputTree(root,0,new Set());
      }
      if(entries.length>maxRoots || visitedBudget>=maxNodes)
        out.push("Additional source branches omitted by presentation limit; " +
          "the existing Intent/Semantic IR graph remains the authority.");
    }
  }
  const methodCallEdges = intent.edges.filter(edge =>
    edge.id.startsWith("source-method-call:") &&
    edge.kind === "requires" && edge.status === "inferred");
  if (methodCallEdges.length > 0) {
    out.push("", "### Source-local method call graph (NOT PLAY ORDER)");
    out.push("Each directed call comes from an exact, uniquely resolved " +
      "Semantic IR source site near an exact content reader or " +
      "authored literal state-write anchor. It does not prove method execution, " +
      "state activation, gameplay sequence or scoring success.");
    const byNode = new Map(intent.nodes.map(node => [node.id,node]));
    // Terminal/state-bearing methods and methods with exact property or
    // unresolved receiver calls are easier to interpret than arbitrary
    // early-file helpers. Ranking is navigation, NOT semantic proof.
    const stateOwners = new Set(intent.edges.filter(edge =>
      edge.id.startsWith("source-method-state:")).map(edge => edge.from));
    const relevance = (id: string): number => {
      const node = byNode.get(id);
      return (stateOwners.has(id) ? 4 : 0) +
        (node?.evidenceIds.some(e => e.startsWith(
          "source-method-property-site:")) ? 2 : 0) +
        (node?.evidenceIds.some(e => e.startsWith(
          "source-unresolved-receiver-site:")) ? 1 : 0);
    };
    const orderedMethodCalls = [...methodCallEdges].sort((a,b) =>
      relevance(b.from) + relevance(b.to) -
      relevance(a.from) - relevance(a.to) ||
      a.id.localeCompare(b.id));
    for (const edge of orderedMethodCalls.slice(0, 96)) {
      const from = byNode.get(edge.from);
      const to = byNode.get(edge.to);
      if (!from || !to) continue;
      const sites = edge.evidenceIds.map(id => evidenceById.get(id))
        .filter(item => item?.scope === "selected-artifact" &&
          item.id.startsWith("source-method-site:"));
      out.push("- **" + concise(from.label) + "** --(source call)--> **" +
        concise(to.label) + "**");
      for (const site of sites.slice(0, 4)) {
        out.push("  - " + concise(site!.summary),
          "    Source: " + concise(site!.locator));
      }
    }
    if (methodCallEdges.length > 96) {
      out.push("Additional source method relationships omitted: " +
        (methodCallEdges.length - 96) +
        ". Full source topology remains in the canonical Semantic IR.");
    }
  }
  const methodPropertyNodes = intent.nodes.flatMap(node => {
    const writes = node.evidenceIds
      .filter(id => id.startsWith("source-method-property-site:"))
      .map(id => evidenceById.get(id))
      .filter(record => record?.scope === "selected-artifact");
    return writes.length ? [{node,writes}] : [];
  });
  if (methodPropertyNodes.length > 0) {
    out.push("", "### Source method property changes (NOT SETTLED RESULTS)");
    out.push("These are exact authored JavaScript assignments in source methods " +
      "identified by the local call graph. A score-looking property write is " +
      "not proof of a player award, durable ledger, terminal ranking or " +
      "player-visible match result.");
    for (const entry of methodPropertyNodes.slice(0, 24)) {
      out.push("- **" + concise(entry.node.label) + "**");
      for (const write of entry.writes.slice(0, 12)) {
        out.push("  - " + concise(write!.summary),
          "    Source: " + concise(write!.locator));
      }
      if (entry.writes.length > 12) {
        out.push("  Additional direct writes omitted: " +
          (entry.writes.length - 12));
      }
    }
    if (methodPropertyNodes.length > 24) {
      out.push("Additional source methods omitted: " +
        (methodPropertyNodes.length - 24));
    }
  }
  const unresolvedReceiverMethods = intent.nodes.flatMap(node => {
    const calls = node.evidenceIds
      .filter(id => id.startsWith("source-unresolved-receiver-site:"))
      .map(id => evidenceById.get(id))
      .filter(item => item?.scope === "selected-artifact");
    return calls.length > 0 ? [{node,calls}] : [];
  });
  if (unresolvedReceiverMethods.length > 0) {
    out.push("", "### Authored cross-object calls (TARGET UNRESOLVED)");
    out.push("These exact source calls may belong to a session object, UI, " +
      "repository or external service. Without receiver binding, no " +
      "cross-module method edge, finished result or delivered player " +
      "message is established.");
    for (const item of unresolvedReceiverMethods.slice(0, 24)) {
      out.push("- **" + concise(item.node.label) + "**");
      for (const call of item.calls.slice(0, 16)) {
        out.push("  - " + concise(call!.summary),
          "    Source: " + concise(call!.locator));
      }
      if (item.calls.length > 16) out.push(
        "  Additional calls omitted: " + (item.calls.length - 16));
    }
    if (unresolvedReceiverMethods.length > 24) out.push(
      "Additional methods omitted: " +
      (unresolvedReceiverMethods.length - 24));
  }
  const receiverCandidates = intent.edges.filter(edge =>
    edge.id.startsWith("source-instance-candidate:") &&
    edge.status === "inferred" && edge.kind === "requires");
  if (receiverCandidates.length > 0) {
    out.push("", "### Cross-module receiver candidates (SOURCE CHAIN ONLY)");
    out.push("Each candidate has authored class construction, constructor " +
      "field storage, direct this-argument handoff, stable local parameter " +
      "forwarding and a uniquely declared receiving method. A candidate " +
      "does NOT prove all receiver instances, runtime invocation, matching " +
      "results, durable settlement or delivered presentation.");
    const byId = new Map(intent.nodes.map(node => [node.id,node]));
    for (const edge of receiverCandidates.slice(0, 48)) {
      const from=byId.get(edge.from),to=byId.get(edge.to);
      if (!from || !to) continue;
      const sourceRefs=[...new Set(edge.evidenceIds
        .map(id=>evidenceById.get(id))
        .filter(ev=>ev?.scope === "selected-artifact")
        .map(ev=>concise(ev!.locator)))];
      out.push("- **" + concise(from.label) + "** --(candidate receiver)--> **" +
        concise(to.label) + "**",
        "  Authored witnesses: " + sourceRefs.slice(0, 7).join("; "));
    }
    if (receiverCandidates.length > 48) out.push(
      "Additional receiver candidates omitted: " +
      (receiverCandidates.length - 48));
  }
  const sourceMethodStateEdges = intent.edges.filter(edge =>
    edge.id.startsWith("source-method-state:") &&
    edge.kind === "participates-in" && edge.status === "inferred");
  if (sourceMethodStateEdges.length > 0) {
    out.push("", "### Source method → authored state values (NOT OBSERVED)");
    out.push("The method contains an exact source state-write site. " +
      "This is not a completed transition, player sequence, or confirmed " +
      "state lifetime.");
    const byId = new Map(intent.nodes.map(node => [node.id,node]));
    for (const edge of sourceMethodStateEdges.slice(0, 32)) {
      const from = byId.get(edge.from), to = byId.get(edge.to);
      if (!from || !to) continue;
      const sources = edge.evidenceIds.map(id=>evidenceById.get(id))
        .filter(e=>e?.scope === "selected-artifact" &&
          e.id.startsWith("source-method-state-site:"));
      out.push("- **" + concise(from.label) +
        "** --(contains state assignment)--> **" +
        concise(to.label) + "**");
      for (const site of sources.slice(0, 3)) {
        out.push("  Source: " + concise(site!.locator) +
          "; " + concise(site!.summary));
      }
    }
    if (sourceMethodStateEdges.length > 32) out.push(
      "Additional method/state records omitted: " +
      (sourceMethodStateEdges.length - 32));
  }
  const sourceLocalStateEdges = intent.edges.filter(edge =>
    edge.id.startsWith("source-content-state-context:") &&
    edge.kind === "participates-in" && edge.status === "inferred");
  if (sourceLocalStateEdges.length > 0) {
    const byNode = new Map(intent.nodes.map(node => [node.id,node]));
    out.push("", "### Source-local state association (NOT CAUSAL)");
    out.push("A content access and state mutation occur in the same source " +
      "method; neither an effective phase transition nor selected " +
      "player/arena owner is established.");
    for (const edge of sourceLocalStateEdges.slice(0, 20)) {
      const from = byNode.get(edge.from);
      const to = byNode.get(edge.to);
      if (!from || !to) continue;
      out.push("- " + concise(from.label) +
        " --(same-method source assignment)--> " + concise(to.label));
    }
    if (sourceLocalStateEdges.length > 20) {
      out.push("Additional state associations omitted: " +
        (sourceLocalStateEdges.length - 20));
    }
  }
  if (contentCollections.length > 0) {
    out.push("", "### Script-authored content choices (NOT OBSERVED)");
    out.push("These are categorized literal source choices, not verified " +
      "round selection, scoring, guessing, building, or player presentation.");
    for (const collection of contentCollections.slice(0, 20)) {
      const locator = (ref: ScriptAuthoredContentCollection["source"]): string =>
        concise(ref.relativePath + (ref.range
          ? ":" + ref.range.lineStart + ":" +
            (ref.range.columnStart ?? 1)
          : ""));
      out.push("- **" + concise(collection.name) + "** / " +
        collection.entries.length + " literal choices" +
        (collection.incomplete ? " + unresolved entries" : "") +
        "; label field=" + collection.textField +
        "; classification field=" + collection.classificationField,
        "  Source: " + locator(collection.source));
      const groups = new Map<string,
        ScriptAuthoredContentCollection["entries"][number][]>();
      for (const item of collection.entries) {
        const values = groups.get(item.classification) ?? [];
        values.push(item);
        groups.set(item.classification, values);
      }
      for (const [category, items] of groups) {
        out.push("  - " + concise(category) + ": " + items.length + " choice(s)");
        for (const item of items.slice(0, 50)) {
          out.push("    - " + concise(item.text) +
            " / source " + locator(item.source));
        }
        if (items.length > 50) {
          out.push("    Additional choices omitted: " + (items.length - 50));
        }
      }
    }
    if (contentCollections.length > 20) {
      out.push("Additional content collections omitted: " +
        (contentCollections.length - 20));
    }
  }
  if (orderedGroups.length > 0) {
    out.push("", "### Source-labelled level/stage hierarchy (NOT OBSERVED)");
    out.push("Grouping follows exact selected-artifact locale keys; neither " +
      "stage execution nor chronological transitions are proven. Wave counts, " +
      "spawn recipes and coordinates require independent script/world evidence.");
    for (const group of orderedGroups.slice(0, 24)) {
      const first = group[0]!;
      const type = first.parsed.kind.charAt(0).toUpperCase() +
        first.parsed.kind.slice(1);
      out.push("- **" + type + " " + first.parsed.number + "**" +
        " [source-labelled; activation UNKNOWN]" +
        (first.parsed.scopePrefix
          ? " / namespace: " + concise(first.parsed.scopePrefix)
          : ""));
      const entries = [...group].sort((a, b) => {
        const priority = (section: typeof a.parsed.section) =>
          section === "guide" ? 0 : section === "task" ? 1 : 2;
        return priority(a.parsed.section) - priority(b.parsed.section) ||
          (a.parsed.taskNumber ?? 0) - (b.parsed.taskNumber ?? 0);
      });
      for (const item of entries.slice(0, 16)) {
        const category = item.parsed.section === "guide"
          ? "Guide" : item.parsed.section === "task"
            ? "Task " + item.parsed.taskNumber
            : "Success text (not proof of completion)";
        const content = item.feature.label.slice(
          item.feature.label.indexOf(": ") + 2,
        );
        out.push("  - " + category + ": " + concise(content),
          "    Source: " + concise(item.source));
      }
      if (entries.length > 16) {
        out.push("  Additional source-labelled items omitted: " +
          (entries.length - 16));
      }
    }
    if (orderedGroups.length > 24) {
      out.push("Additional source-labelled stages omitted: " +
        (orderedGroups.length - 24));
    }
  }
  if (waveStages.length > 0) {
    out.push("", "### Script-authored stage → wave → spawn hierarchy (NOT OBSERVED)");
    out.push("These are direct nested literal source recipes, not verified " +
      "spawns, entity-load success, arena offsets, wave completion, or " +
      "runtime progression. Dynamic type/event expressions remain unresolved.");
    const locator = (ref: ScriptWaveStage["source"]): string =>
      concise(ref.relativePath + (ref.range === undefined
        ? "" : ":" + ref.range.lineStart + ":" +
          (ref.range.columnStart ?? 1)));
    for (const stage of waveStages) {
      out.push("- **" + concise(stage.sourceCollection) + " / " +
        concise(stage.id) + "**" +
        (stage.name ? " — " + concise(stage.name) : "") +
        " [authored configuration; activation UNKNOWN]",
        "  Source: " + locator(stage.source));
      for (const wave of stage.waves) {
        out.push("  - **Wave " + wave.number + "**" +
          " / " + wave.recipes.length + " literal spawn recipe(s)" +
          (wave.recipeListIncomplete
            ? " + UNKNOWN dynamic/unsupported entries" : "") +
          (wave.delaySpawn === undefined ? "" :
            " / delay_spawn=" + wave.delaySpawn) +
          (wave.nextWaveMinMob === undefined ? "" :
            " / next_wave_min_mob=" + wave.nextWaveMinMob) +
          " (configured threshold, not proven completion)",
          "    Source: " + locator(wave.source));
        for (const [index, recipe] of wave.recipes.entries()) {
          const identity = recipe.typeId ??
            (recipe.typeExpression
              ? recipe.typeExpression + " [dynamic ID unresolved]" :
              "UNKNOWN");
          const position = recipe.coordinates === undefined
            ? recipe.coordinateExpression
              ? recipe.coordinateExpression + " [coordinate unresolved]"
              : "UNKNOWN"
            : [recipe.coordinates.x, recipe.coordinates.y,
              recipe.coordinates.z].join(" ");
          out.push("    - Spawn recipe " + (index + 1) +
            ": type=" + concise(identity) +
            "; position=" + concise(position) +
            (recipe.event === undefined && recipe.eventExpression === undefined
              ? "" : "; event=" +
                concise(recipe.event ?? recipe.eventExpression!) +
                (recipe.eventExpression === undefined
                  ? "" : " [expression unresolved]")) +
            (recipe.tag === undefined ? "" :
              "; tag=" + concise(recipe.tag)),
            "      Source: " + locator(recipe.source));
        }
        for (const command of wave.endCommands) {
          out.push("    - Authored end command: " +
            concise(command.command) +
            (command.delay === undefined ? "" :
              "; delay=" + command.delay) +
            " [NOT EXECUTED]",
            "      Source: " + locator(command.source));
        }
        if (wave.endCommandsIncomplete) {
          out.push("    - Other end commands: UNKNOWN / dynamic entries");
        }
      }
    }
  }
  if (report.stateTransitions.length > 0) {
    out.push("", "### Source-derived state transitions (NOT OBSERVED)");
    out.push("Relations are from selected source, not evidence a player " +
      "entered these states in Minecraft.");
    for (const transition of report.stateTransitions.slice(0, 12)) {
      out.push("- " + concise(transition.from) + " --(" +
        concise(transition.event) + ")--> " +
        concise(transition.to) +
        (transition.notes ? "; " + concise(transition.notes) : ""));
    }
    if (report.stateTransitions.length > 12) {
      out.push("Additional state relationships omitted: " +
        (report.stateTransitions.length - 12));
    }
  }
  // The source analysis already reconstructs strict guard-read -> state-write
  // candidates and source-ordered continuation. Present that known path
  // before listing isolated mechanic names. These are NOT player transitions.
  const guarded = [...(report.gameplayStructure?.guardedSourceTransitions ?? [])]
    .sort((a, b) =>
      a.guardComparisonSource.relativePath.localeCompare(
        b.guardComparisonSource.relativePath) ||
      (a.guardComparisonSource.range?.lineStart ?? 0) -
        (b.guardComparisonSource.range?.lineStart ?? 0) ||
      a.readOperationId.localeCompare(b.readOperationId) ||
      a.writeOperationId.localeCompare(b.writeOperationId));
  if (guarded.length > 0) {
    out.push("", "### Condition → state write → source continuation (NOT EXECUTED)");
    out.push("Exact guard/write identities can show a conditional source path. " +
      "A source return is NOT a game terminal, a resource release site is " +
      "NOT successful settlement, and a world-effect site is NOT player feedback.");
    for (const transition of guarded.slice(0, 8)) {
      const candidateId = transition.readOperationId + ":" + transition.writeOperationId;
      const directReferences = [...reconstructionByFeature.values()]
        .filter(feature => feature.sourceGuardedTransitionCandidateIds.includes(candidateId))
        .map(feature => feature.name).sort();
      const sourceContexts = [...reconstructionByFeature.values()]
        .filter(feature => (feature.sourceGuardedTransitionContexts ?? [])
          .some(context => context.readOperationId === transition.readOperationId &&
            context.writeOperationId === transition.writeOperationId))
        .map(feature => feature.name).sort();
      const continuation = transition.continuation;
      const calleeReleaseReturnPairs = continuation.directSynchronousCallees
        .reduce((sum, callee) => sum + callee.releaseReturnPairs.length, 0);
      const location = transition.guardComparisonSource;
      out.push(
        "- **" + concise(transition.fromValue) + " → " +
          concise(transition.toValue) + "** [" + transition.status +
          "] / source state " + concise(transition.surfaceId) + ".",
        "  Guard source: " + concise(location.relativePath +
          (location.range?.lineStart === undefined ? "" :
            ":" + location.range.lineStart + ":" +
            (location.range.columnStart ?? 1))) +
          "; owning execution region " + concise(transition.executionRegionId) + ".",
        "  Exact evidence: read " + concise(transition.readOperationId) +
          "; write " + concise(transition.writeOperationId) + ".",
        "  Mechanic matching: direct write-evidence=" +
          directReferences.length + (directReferences.length === 0 ? "" :
            " [" + directReferences.slice(0, 3).map(concise).join("; ") +
            (directReferences.length > 3 ? "; additional omitted" : "") + "]") +
          "; same exact execution-region context (NOT ownership)=" +
          sourceContexts.length + (sourceContexts.length === 0 ? "" :
            " [" + sourceContexts.slice(0, 3).map(concise).join("; ") +
            (sourceContexts.length > 3 ? "; additional omitted" : "") + "]") + ".",
        "  Same-path source candidates: world-effect " +
          continuation.sourceOrderedWorldEffectIds.length +
          ", release " + continuation.sourceOrderedResourceReleaseIds.length +
          ", return " + continuation.sourceOrderedReturnOutcomeIds.length +
          ", release-before-return pairs " +
          continuation.sourceOrderedReleaseReturnPairs.length + ".",
        "  Resolved direct call candidates: " +
          continuation.directSynchronousCallees.length +
          "; callee release-before-return pairs: " + calleeReleaseReturnPairs +
          "; unresolved execution boundaries: " +
          continuation.unsupportedBoundaryEdgeIds.length +
          (continuation.truncated ? "; source exploration TRUNCATED." : "."),
        ...(transition.interveningWriteOperationIds.length === 0 ? [] : [
          "  Conflicting/intervening source writes: " +
            transition.interveningWriteOperationIds.slice(0, 3)
              .map(concise).join("; ") + ".",
        ]),
        "  Game terminal, successful settlement and delivered player feedback: UNKNOWN.",
      );
    }
    if (guarded.length > 8) {
      out.push("Additional guarded transitions omitted: " +
        (guarded.length - 8) + ".");
    }
  }

  // No second semantic extractor: the canonical Gameplay Architecture
  // projection already reconciles exact source operation/return pairs with
  // existing scenario links. Render their evidence and missing proof openly.
  const sourceRelations = input.architecture?.semanticIrCoverage
    .observedSourceRelationships ?? [];
  const relationsByOutcome = new Map<string, typeof sourceRelations>();
  for (const relation of sourceRelations) {
    const list = relationsByOutcome.get(relation.outcomeId) ?? [];
    relationsByOutcome.set(relation.outcomeId, [...list, relation]);
  }
  if (relationsByOutcome.size > 0) {
    const returnSteps = (report.gameplayStructure?.sourceFlowCandidates ?? [])
      .flatMap(flow => flow.sourceSteps.filter(step => step.kind === "return"));
    const returnsById = new Map(returnSteps.map(step => [step.id, step]));
    const relationshipKinds = [
      "entry-to-outcome", "direct-call-to-outcome",
      "state-write-to-outcome", "resource-action-to-outcome",
      "world-effect-to-outcome",
    ] as const;
    out.push("", "### Source entry / state / resource / effect → code return (NOT GAME RESULT)");
    out.push("Pairs have exact source IDs, but their adjacency or source " +
      "order does not prove reachability, execution, settlement, or victory. " +
      "An existing PROVEN scenario link is source-scoped, not Minecraft runtime proof.");
    const outcomeGroups = [...relationsByOutcome].sort(([a], [b]) =>
      a.localeCompare(b));
    for (const [outcomeId, relations] of outcomeGroups.slice(0, 8)) {
      const returnStep = returnsById.get(outcomeId);
      const knownProvenLinkIds = [...new Set(relations.flatMap(
        relation => relation.exactProvenCausalLinkIds))].sort();
      const gaps = [...new Set(relations.flatMap(relation =>
        relation.gap === null ? [] : [relation.gap]))].sort();
      out.push(
        "- **Authored code return:** " +
          concise(returnStep?.targetLabel ?? outcomeId) + ".",
        "  Source: " + (returnStep === undefined ? "exact return locator unresolved" :
          concise(returnStep.source.relativePath +
            (returnStep.source.range?.lineStart === undefined ? "" :
              ":" + returnStep.source.range.lineStart +
              ":" + (returnStep.source.range.columnStart ?? 1)))) + ".",
        "  Source associations: " + relationshipKinds
          .map(kind => kind + "=" + relations.filter(item =>
            item.kind === kind).length).join("; ") + ".",
        "  Existing exact source-scoped scenario links: " +
          knownProvenLinkIds.length + "; outstanding relation gaps: " +
          (gaps.length > 0 ? gaps.join(", ") : "none in measured source pairs") + ".",
        "  Player goal / terminal result / settlement / feedback: NOT PROVEN.",
      );
      for (const relation of relations.slice(0, 3)) {
        out.push("  - " + relation.kind +
          " [" + relation.sourceBasis + "; " +
          (relation.gap ?? "SOURCE_LINK_ACCOUNTED") +
          "] from " + concise(relation.fromEvidenceId) + ".");
      }
      if (relations.length > 3) {
        out.push("  Additional exact source associations omitted: " +
          (relations.length - 3) + ".");
      }
    }
    if (outcomeGroups.length > 8) {
      out.push("Additional code return groups omitted: " +
        (outcomeGroups.length - 8) + ".");
    }
  }
  // Unified technical state-surface view: typed script tag calls and
  // authored command accesses refer to the SAME normalized Semantic IR
  // resource identity. A named tag/scoreboard is not a gameplay objective,
  // shared player-state identity or evidence the operation succeeded.
  const technicalSourceSteps = new Map<string,
    NonNullable<GameplayArchitectureNavigation["gameplayStructure"][
      "sourceFlowCandidates"]>[number]["sourceSteps"][number]>();
  for (const flow of input.architecture?.gameplayStructure.sourceFlowCandidates ?? []) {
    for (const step of flow.sourceSteps) {
      if (step.kind === "state") technicalSourceSteps.set(step.id, step);
    }
  }
  const technicalResources = intent.nodes.filter(node =>
    node.kind === "resource" &&
    (node.id.startsWith("resource:tag:") ||
      node.id.startsWith("resource:scoreboard:")) &&
    node.evidenceIds.some(id =>
      evidenceById.get(id)?.scope === "selected-artifact" &&
      technicalSourceSteps.has(id)))
    .sort((a, b) => a.id.localeCompare(b.id));
  if (technicalResources.length > 0) {
    out.push("", "### Tag and scoreboard technical state (SOURCE ONLY)");
    out.push("Same technical key across different actors, arenas or sessions " +
      "does NOT prove shared live storage, gameplay phase or successful " +
      "mutation. Unresolved receiver aliases and dynamic keys remain unknown.");
    for (const resource of technicalResources.slice(0, 12)) {
      const steps = resource.evidenceIds
        .flatMap(id => {
          const step = technicalSourceSteps.get(id);
          return step === undefined ? [] : [step];
        });
      const locations = [...new Set(steps.map(step =>
        step.source.relativePath +
        (step.source.range?.lineStart === undefined ? "" :
          ":" + step.source.range.lineStart)))].sort();
      out.push(
        "- **" + concise(resource.label) + "**" +
          " [source-observed technical surface; game rule UNKNOWN].",
        "  Access candidates: read=" + steps.filter(step =>
          step.operation === "read").length +
          ", write=" + steps.filter(step => step.operation === "write").length +
          ", delete=" + steps.filter(step => step.operation === "delete").length +
          ", other=" + steps.filter(step =>
            !["read", "write", "delete"].includes(step.operation ?? "")).length + ".",
        "  Source: " + (locations.length === 0 ? "UNRESOLVED" :
          locations.slice(0, 3).map(concise).join("; ")) +
          (locations.length > 3 ? "; additional sources omitted" : "") + ".",
      );
    }
    if (technicalResources.length > 12) {
      out.push("Additional technical surfaces omitted: " +
        (technicalResources.length - 12) + ".");
    }
  }

  const dynamicTagQuestions = intent.unknowns
    .filter(unknown => unknown.id.startsWith("unknown:script-tag-dynamic-key:"))
    .sort((a, b) => a.id.localeCompare(b.id));
  if (dynamicTagQuestions.length > 0) {
    out.push("", "### Unresolved dynamic tag state (SOURCE EVIDENCE; UNKNOWN)");
    out.push("Computed tag keys are NOT collapsed into a fictitious literal " +
      "tag name. Source references are preserved without attributing a " +
      "gameplay condition or player/arena instance.");
    for (const question of dynamicTagQuestions.slice(0, 6)) {
      const sourceLocations = [...new Set((question.evidenceIds ?? [])
        .flatMap(id => {
          const evidence = evidenceById.get(id);
          return evidence?.scope === "selected-artifact"
            ? [evidence.locator] : [];
        }))].sort();
      out.push(
        "- Dynamic tag group: " + (question.evidenceIds ?? []).length +
          " exact source operation(s); key and effective state UNKNOWN.",
        "  Source: " + (sourceLocations.length === 0 ? "UNRESOLVED" :
          sourceLocations.slice(0, 3).map(concise).join("; ")) + ".",
      );
    }
    if (dynamicTagQuestions.length > 6) {
      out.push("Additional unresolved tag source groups omitted: " +
        (dynamicTagQuestions.length - 6) + ".");
    }
  }

  out.push("", "### Other mechanics (source inspection; not gameplay execution)");
  if (features.length === 0) {
    out.push("No recognized gameplay features in this view; the map may still contain unclassified gameplay.");
  }
  if (sourceIsolationRules.length > 0) {
    out.push("", "### State ownership (SOURCE ONLY; NOT RUNTIME)");
    out.push("State isolation is not established by variable names or parser " +
      "receiver hints; even an authored arena-keyed source partition is " +
      "not proof of a distinct live player/arena instance.");
    out.push("Source observations: " + sourceIsolationRules.length +
      "; unresolved partition proof: " + unresolvedSourceIsolation.length + ".");
    for (const item of unresolvedSourceIsolation.slice(0, 5)) {
      out.push("- " + concise(item));
    }
    if (unresolvedSourceIsolation.length > 5) {
      out.push("Additional source isolation gaps omitted: " +
        (unresolvedSourceIsolation.length - 5));
    }
  }
  for (const feature of visibleFeatures.slice(0, 12)) {
    const references = feature.sourceEvidenceIds.flatMap((id) => {
      const e = evidenceById.get(id);
      return e === undefined || e.scope === "external-reference" ||
        e.scope === "runtime" ? [] : [concise(e.locator)];
    });
    const directEffects = new Set(feature.sourceBehaviorPaths
      .filter((path) => path.association === "DIRECT_EFFECT_EVIDENCE")
      .map((path) => path.effectId)).size;
    out.push(
      "- **" + concise(feature.label) + "** [" + feature.grounding +
        "; source effects: " + directEffects + "] — " +
        concise(feature.purpose),
      references.length > 0
        ? "  Source: " + references.slice(0, 3).join("; ")
        : "  Source locator: unresolved",
      "  Source-derived relations: activation " +
        feature.activationRelationIds.length + ", effects " +
        feature.effectRelationIds.length + ", transitions " +
        feature.transitionRelationIds.length + ", outcomes " +
        feature.outcomeRelationIds.length + ".",
      ...((reconstructionByFeature.get(feature.id)?.sourceActivationCandidates ?? [])
        .slice(0, 2).map(candidate =>
          "  Source entry (" + candidate.evidenceBasis + "; NOT EXECUTED): " +
          concise(candidate.entryKind + " " + candidate.entryRegionId) +
          "; linked source IDs " + candidate.supportingEvidenceIds.length +
          "; material steps " + candidate.materialSourceStepIds.length +
          "; branch points " + candidate.branchPointCount +
          "; unresolved call edges " + candidate.unresolvedExecutionEdgeIds.length +
          ". No player reachability or game-design activation proven.")),
      ...((reconstructionByFeature.get(feature.id)?.sourceActivationCandidates.length ?? 0) > 2
        ? ["  Additional entry candidates omitted: " +
          (reconstructionByFeature.get(feature.id)!.sourceActivationCandidates.length - 2)]
        : []),
      ...((reconstructionByFeature.get(feature.id)?.sourceGuardedTransitionContexts ?? [])
        .slice(0, 2).map(context =>
          "  Guarded state candidate (SAME_EXECUTION_REGION; NOT CAUSAL): " +
          concise(context.readOperationId) + " → " + concise(context.writeOperationId) +
          " [" + context.candidateStatus + "; region " +
          concise(context.executionRegionId) + "; feature source witnesses " +
          context.featureRegionEvidenceIds.slice(0, 2).map(concise).join("; ") +
          (context.featureRegionEvidenceIds.length > 2 ? "; additional omitted" : "") +
          "; shared flow candidates " + context.sharedSourceFlowIds.length + "].")),
      ...((reconstructionByFeature.get(feature.id)?.sourceGuardedTransitionContextOmitted ?? 0) > 0
        ? ["  Additional guarded source-flow contexts omitted: " +
          reconstructionByFeature.get(feature.id)!.sourceGuardedTransitionContextOmitted]
        : []),
      ...feature.sourceBehaviorPaths.slice(0, 2).map(path =>
        "  Candidate effect (" + path.association + "; " + path.evidenceStatus +
        "): " + concise(path.effectKind +
          (path.effectTarget === null ? "" : " " + path.effectTarget)) +
        (path.preconditions.length === 0 ? "; guards unresolved."
          : "; authored guard candidates: " +
            path.preconditions.slice(0, 2).map(guard =>
              concise(guard.expression) + "=" + guard.branch).join("; ") +
            ". Not evaluated at runtime.")),
      ...(reconstructionByFeature.get(feature.id)?.unresolvedDimensions.length
        ? ["  Unresolved mechanics: " +
          reconstructionByFeature.get(feature.id)!.unresolvedDimensions.join(", ")]
        : []),
    );
  }
  if (visibleFeatures.length > 12) {
    out.push("Additional features omitted: " + (visibleFeatures.length - 12));
  }
  if (sourceStateAliasUnknowns.length > 0) {
    out.push("", "### State identity questions (SOURCE ONLY; UNRESOLVED)");
    out.push("Identical state labels in distinct source-memory targets do NOT " +
      "prove shared runtime storage or distinct player/arena state.");
    for (const unknown of sourceStateAliasUnknowns.slice(0, 5)) {
      const sourceLocations = [...new Set((unknown.evidenceIds ?? [])
        .flatMap(id => {
          const record = evidenceById.get(id);
          return record?.scope === "selected-artifact"
            ? [record.locator] : [];
        }))].sort();
      out.push(
        "- " + concise(unknown.id) + ": " +
          unknown.blockedSubjectIds.length + " source-owned state subjects; " +
          "runtime alias/scope unresolved.",
        "  Exact subjects: " + unknown.blockedSubjectIds.slice(0, 4)
          .map(concise).join("; "),
        "  Sources: " + (sourceLocations.length
          ? sourceLocations.slice(0, 3).map(concise).join("; ")
          : "unresolved"),
      );
    }
    if (sourceStateAliasUnknowns.length > 5) {
      out.push("Additional state identity questions omitted: " +
        (sourceStateAliasUnknowns.length - 5));
    }
  }
  if (returnPolicyUnknowns.length > 0) {
    out.push("", "### Return policy questions (SOURCE ONLY; UNRESOLVED)");
    out.push("Equal return/guard counts, similar function names and missing " +
      "source spans do NOT establish that an outcome is guarded.");
    for (const unknown of returnPolicyUnknowns.slice(0, 5)) {
      const ids = unknown.evidenceIds ?? [];
      const sourceLocations = [...new Set(ids.flatMap(id => {
        const record = evidenceById.get(id);
        return record?.scope === "selected-artifact"
          ? [record.locator] : [];
      }))].sort();
      out.push(
        "- " + concise(unknown.id) + ": " + concise(unknown.question),
        "  Subjects: " + unknown.blockedSubjectIds
          .slice(0, 3).map(concise).join("; "),
        "  Source: " + (sourceLocations.length > 0
          ? sourceLocations.slice(0, 3).map(concise).join("; ")
          : "unresolved"),
      );
    }
    if (returnPolicyUnknowns.length > 5) {
      out.push("Additional return-policy questions omitted: " +
        (returnPolicyUnknowns.length - 5));
    }
  }
  out.push("", "### Possible player journeys (NOT OBSERVED)");
  out.push("A directed source relation does NOT prove chronological gameplay, player access or engine execution.");
  if (journeys.length === 0) {
    out.push("No connected source-design path could be grounded; game loop remains UNKNOWN.");
  }
  for (const journey of journeys.slice(0, 5)) {
    const reading = journey.interpretation;
    if (reading === undefined) {
      out.push("- " + concise(journey.id) + " [" +
        journey.meaningStatus + "; " + journey.boundary +
        "] subjects: " + concise(journey.subjectIds.join(", ")));
      continue;
    }
    const route = reading.steps.map((step, index) => {
      const name = concise(step.label) + " [" + step.kind + ", " +
        step.meaningBasis + "]";
      return index === 0 ? name
        : " --(" + (reading.relationships[index - 1]?.kind ?? "unknown") +
          ")--> " + name;
    }).join("");
    const evidenceLocations = journey.evidenceIds.flatMap(id => {
      const source = evidenceById.get(id);
      return source?.scope === "selected-artifact"
        ? [source.locator] : [];
    });
    out.push(
      "- **Source-design candidate:** " + route,
      "  Outcome: " + reading.sourceOutcome +
        "; boundary: " + journey.boundary + "; runtime: NOT OBSERVED.",
      "  Exact source-flow links: " + journey.exactSourceFlowIds.length +
        "; selected source relation evidence: " + journey.evidenceIds.length + ".",
      evidenceLocations.length > 0
        ? "  Source: " + [...new Set(evidenceLocations)]
          .slice(0, 3).map(concise).join("; ")
        : "  Source locator: unresolved",
      "  Still unknown: " + reading.missingUnderstanding.join(", "),
      ...(reading.sourceJoinGap === undefined ? [] : [
        "  Unverified source join via " +
          concise(reading.sourceJoinGap.viaSubjectId) + ": " +
          concise(reading.sourceJoinGap.previousRelationId) + " → " +
          concise(reading.sourceJoinGap.nextRelationId) + ".",
        "  Source groups: " +
          reading.sourceJoinGap.previousSourceLocators.slice(0, 2)
            .map(concise).join("; ") + " / " +
          reading.sourceJoinGap.nextSourceLocators.slice(0, 2)
            .map(concise).join("; ") +
          (reading.sourceJoinGap.missingProof === "OPPOSITE_AUTHORED_BRANCH_ARMS"
            ? ". Opposite exact authored true/false branch arms; " +
              "no compatible source route demonstrated."
            : ". Missing shared exact source evidence or compatible " +
              "resolved IR flow; a common filename is insufficient."),
      ]),
    );
  }
  if (journeys.length > 5) {
    out.push("Additional candidates omitted: " + (journeys.length - 5));
  }
  out.push("", "## Findings");
  if (findings.length === 0) {
    out.push("No published finding; **this does not mean the map is free of bugs**.");
  }
  for (const finding of findings.slice(0, 12)) {
    out.push(
      "- [" + finding.status + "] " + finding.issueType + ": " +
        concise(finding.issue),
      "  Impact: " + concise(finding.playerImpact),
      "  Expected / actual: " + concise(finding.expected) + " / " +
        concise(finding.actual),
      ...(finding.evidenceIds.length === 0
        ? ["  Source evidence: UNRESOLVED"]
        : ["  Evidence IDs: " +
          finding.evidenceIds.slice(0, 5).map(concise).join("; ")]),
      ...(finding.missingProof === undefined ? [] :
        ["  Missing proof: " + concise(finding.missingProof)]),
    );
  }
  if (findings.length > 12) {
    out.push("Additional findings omitted: " + (findings.length - 12));
  }
  if (report.control.status === "BLOCKED" && findings.length > 0) {
    out.push(
      "These are scoped audit findings, not an approved issue set. " +
      "Overall map review and publication remain BLOCKED.",
    );
  }
  // Use the canonical Audit Obligations rather than hiding them behind
  // optional model tasks or reconstructing a separate report-state owner.
  // Keep C9 prominent and leave every omitted entry in the full JSON output.
  const auditObligations = [
    ...(report.auditObligations ?? []).filter((item) =>
      item.id === "mandatory-checkpoint:C9"
    ),
    ...(report.auditObligations ?? []).filter((item) =>
      item.id !== "mandatory-checkpoint:C9"
    ),
  ];
  out.push(
    "",
    "## Next Investigations",
    "Unresolved material: " + report.unresolved.total +
      " / Gameplay closure: " + report.gameplayClosure.status,
  );
  if (auditObligations.length > 0) {
    out.push(
      "",
      "### Audit Obligations (NOT BUG FINDINGS)",
      "Unresolved proof work: " + auditObligations.length +
        "; these are not approved findings.",
    );
    for (const obligation of auditObligations.slice(0, 10)) {
      out.push(
        "- [" + obligation.stage + "] " + concise(obligation.title) +
          " (" + concise(obligation.id) + ")",
        "  Reason: " + concise(obligation.reason),
        "  Missing proof: " + concise(obligation.missingProof),
        "  Next check: " + concise(obligation.validationTest),
      );
    }
    if (auditObligations.length > 10) {
      out.push(
        "Additional audit obligations omitted from this brief: " +
          (auditObligations.length - 10) +
          ". All remain in the structured Map Audit output.",
      );
    }
  }
  if (modelTaskPackets.length === 0 &&
      unresolvedSurfaces.length === 0 &&
      auditObligations.length === 0) {
    out.push("No specific investigation task in the current audit view.");
  }
  for (const task of modelTaskPackets.slice(0, 8)) {
    const locations = [...new Set([
      ...(task.knowledgeLookup?.sourceLocators ?? []),
      ...task.evidenceContext.flatMap((e) =>
        e.kind === "selected-artifact-evidence" &&
        e.locator !== undefined ? [e.locator] : []),
    ])];
    out.push(
      "- " + task.kind + " [" + concise(task.id) + "]: " +
        concise(task.decisionNeeded),
      ...(task.causalLinkId === undefined ? []
        : ["  Causal link: " + concise(task.causalLinkId)]),
      ...(task.unresolvedEvidenceIds.length === 0 ? []
        : ["  Missing source evidence: " +
          task.unresolvedEvidenceIds.slice(0, 5).map(concise).join("; ")]),
      "  Stop condition: " + concise(task.stopCondition),
      ...(task.subjectSelection === undefined ? [] : [
        "  Checkpoint source navigation (NOT proof of its blocker): " +
          task.subjectSelection.basis + "; omitted " +
          task.subjectSelection.omittedCandidates + " candidates",
      ]),
      ...(locations.length === 0 ? [] :
        ["  Source: " + locations.slice(0, 4).map(concise).join("; ")]),
      ...(task.knowledgeLookup === undefined ? [] :
        ["  Search hint (not proof): " +
          concise(task.knowledgeLookup.query)]),
      ...(task.developerPractice?.items ?? []).slice(0, 2).flatMap(guide => [
        "  Developer source guide (REFERENCE; NOT map proof): " +
          concise(guide.question),
        "  Counterexample: " + concise(guide.negativeControl),
        "  Forbidden inference: " + concise(guide.prohibits),
        "  Exact selected-IR sites: " +
          guide.matchingEvidenceIds.slice(0, 4).map(concise).join("; "),
        ...(guide.referenceCode === undefined ? [] : [
          "  External code example: " + concise(guide.referenceCode.path) +
            " / sha256:" + guide.referenceCode.sha256,
        ]),
        ...(guide.manifestDeclarations ?? []).slice(0, 2).map(item =>
          "  Pack manifest declaration (NOT observed runtime): " +
            concise(item.sourcePath) + "; min_engine=" +
            concise(item.minEngineVersion ?? "unresolved") +
            "; module dependencies=" + item.scriptModules
              .map(module => module.moduleName + "@" + module.version)
              .slice(0, 3).join(", ")),
        ...(guide.upstreamProbes ?? []).slice(0, 2).map(item =>
          "  External probe (NOT selected map proof): " +
            concise(item.sourcePath) + " [" + item.status + "]"),
      ]),
      ...(task.retrievedKnowledge?.references ?? []).flatMap((reference) => [
        "  Knowledge reference (NOT bug or detector proof): " +
          concise(reference.knowledgeId) + " — " +
          concise(reference.statement),
        "  Source: " + reference.sources
          .map((source) => concise(source.title) + " (" + concise(source.url) + ")")
          .join("; "),
        "  Applicability: " + reference.editionCheck +
          "; declared editions: " + reference.applicability.editions.join(", ") +
          "; version, experiments and runtime behavior NOT VERIFIED.",
      ]),
      ...((task.retrievedKnowledge?.omitted ?? 0) > 0
        ? ["  Additional scoped references omitted: " +
          task.retrievedKnowledge!.omitted]
        : []),
    );
  }
  if (modelTaskPackets.length > 8) {
    out.push("Additional model tasks omitted: " +
      (modelTaskPackets.length - 8));
  }
  for (const surface of unresolvedSurfaces.slice(0, 6)) {
    out.push("- Unresolved: " + concise(surface.label) +
      (surface.reason === undefined ? "" :
        " — " + concise(surface.reason)));
  }
  if (unresolvedSurfaces.length > 6) {
    out.push("Additional unresolved surfaces omitted: " +
      (unresolvedSurfaces.length - 6));
  }
  out.push(
    "",
    "## Evidence Boundary",
    "Gameplay flow labels are audit checklist stages, not an observed player route.",
    "Source associations and knowledge lookup hints are not Minecraft runtime proof.",
    ...(report.control.status === "BLOCKED"
      ? ["Audit is BLOCKED. Missing findings cannot be read as bug absence."]
      : []),
    ...(report.unresolved.total > 0
      ? ["Unresolved evidence remains; this is not a complete defect inventory."]
      : []),
  );
  return out.join("\n") + "\n";
}
