/** Read-only selected-map model handoff over the SINGLE canonical audit.
 * Neither model task eligibility nor navigation is gameplay/defect proof.
 * Canonical audit admission and response mutations remain in map-audit-pipeline.ts.
 */
import type { MapAuditOutputV2 } from "../map-audit-output-v2.js";
import type { GameplayIntentEvidence } from "../../../gameplay-intent/src/index.js";
import type { SemanticIr } from "../../../semantic-ir/src/index.js";
import type { AuditModelTaskPacket } from "../map-audit-model-task.js";
import { MODEL_RESOLVABLE_KINDS } from "../map-audit-model-task.js";
import type { SelectedMapAuditRun } from "../map-audit-pipeline.js";

export interface SelectedMapAuditModelHandoff {
  readonly schemaVersion: 1;
  readonly policy: "selected-map-audit-model-handoff";
  readonly artifactId: string;
  readonly artifactFingerprint: string;
  readonly auditRevision: string;
  readonly currentStage: SelectedMapAuditRun["currentStage"];
  readonly allowedNextAction: SelectedMapAuditRun["allowedNextAction"];
  readonly gameUnderstanding: {
    readonly gameDesign: MapAuditOutputV2["gameDesign"];
    readonly gameplayFlowBasis: MapAuditOutputV2["gameplayFlowBasis"];
    readonly features: readonly {
      readonly id: string;
      readonly label: string;
      readonly kind: string;
      readonly grounding: "SOURCE_EVIDENCED" | "UNVERIFIED";
      readonly sourceEvidenceIds: readonly string[];
      readonly sourceEffectCount: number;
      readonly sourceActivationCandidates:
        NonNullable<MapAuditOutputV2["gameplayStructure"]>["mechanicReconstructions"][number]["sourceActivationCandidates"];
    }[];
    readonly omittedFeatures: number;
    /** Literal locale wording from the SAME selected artifact. These are
     * presentation cues, NOT inferred mechanics or approved game rules.
     */
    readonly playerFacingTextCues: readonly {
      readonly evidenceId: string;
      readonly key: string;
      readonly text: string;
      readonly sourceLocator: string;
      /** Exact key match to authored script `{ translate: "key" }` sites.
       * Neither a recorded key nor a matching translation proves the text
       * was displayed, the owning call fired or the chosen pack/locale.
       */
      readonly literalTranslationReferences: readonly {
        readonly evidenceId: string;
        readonly sourceLocator: string;
        readonly executionRegion: string;
        readonly syntax: "translate-object-literal";
        /** Exact AST conditions on the translation expression, NOT a
         * claim that the displayed message or player saw those conditions. */
        readonly sourceConditions: NonNullable<
          GameplayIntentEvidence["literalTranslationUse"]
        >["sourceConditions"];
        /** Read-only IR neighborhood anchored on the exact source region.
         * Source trace membership, caller edges and target-region API
         * calls do NOT prove the translation value was delivered.
         */
        readonly sourceContext: {
          readonly status: "EXACT_IR_SOURCE_REGION_CONTEXT" |
            "IR_SOURCE_REGION_UNRESOLVED";
          readonly executionRegionId: string | null;
          readonly incomingEdges: readonly {
            readonly edgeId: string;
            readonly fromRegionId: string;
            readonly kind: string;
            readonly sourceLocator: string;
            readonly controlFlow: string;
            readonly scheduler: string | null;
            readonly authoredGuards: readonly string[];
          }[];
          readonly omittedIncomingEdges: number;
          readonly outgoingEdges: readonly {
            readonly edgeId: string;
            readonly toRegionId: string;
            readonly kind: string;
            readonly sourceLocator: string;
            readonly controlFlow: string;
            readonly scheduler: string | null;
            readonly authoredGuards: readonly string[];
            /** DIRECT target region, not all steps of a broad source trace. */
            readonly directTargetSites: readonly {
              readonly id: string;
              readonly kind: string;
              readonly operation: string;
              readonly sourceLocator: string;
            }[];
            readonly omittedDirectTargetSites: number;
          }[];
          readonly omittedOutgoingEdges: number;
          readonly directRegionSites: readonly {
            readonly id: string;
            readonly kind: string;
            readonly operation: string;
            readonly sourceLocator: string;
          }[];
          readonly omittedDirectRegionSites: number;
          readonly sourceTraceEntries: readonly {
            readonly entryRegionId: string;
            readonly sourceTraceStatus: string;
          }[];
          readonly omittedSourceTraceEntries: number;
          readonly proof: "SOURCE_REGION_NAVIGATION_NOT_UI_DELIVERY_OR_GAME_CAUSALITY";
        };
      }[];
      readonly omittedLiteralTranslationReferences: number;
      readonly sourceReferenceStatus:
        "EXACT_LITERAL_TRANSLATE_SOURCE_REFERENCE" |
        "NO_LITERAL_TRANSLATE_REFERENCE_FOUND";
      /** One key may be authored by both behavior and resource packs. */
      readonly matchingLocaleDefinitionCount: number;
      readonly proof: "LITERAL_SELECTED_SOURCE_COPY_NOT_GAME_DESIGN";
    }[];
    readonly omittedPlayerFacingTextCues: number;
    /**
     * Read-only exact script-memory LITERAL assignments and candidate
     * incoming IR call paths. A common lexical property such as
     * `session.status` is NOT a shared runtime session identity; source
     * call paths are NOT player reachability, a proven state transition,
     * live event delivery or evidence of a defect. Unlike generic source
     * inventory, each variant keeps its exact operation/site/guard.
     */
    readonly sourceStateAssignments: readonly {
      readonly surfaceId: string;
      readonly authoredTarget: string;
      readonly assignedValue: string;
      readonly scalarKind: "string" | "number" | "boolean" | "unknown";
      readonly lexicalOnly: true;
      readonly sites: readonly {
        readonly operationId: string;
        readonly sourceLocator: string;
        readonly executionRegionId: string;
        readonly effectPathStatus:
          "CANDIDATE_INGRESS" | "NO_KNOWN_INGRESS" | "TRUNCATED" | "NOT_INDEXED";
        readonly authoredGuards: readonly {
          readonly kind: "lexical" | "precedence";
          readonly expression: string;
          readonly branch: "true" | "false";
          readonly sourceLocator: string;
        }[];
        readonly omittedAuthoredGuards: number;
        readonly sourcePaths: readonly {
          readonly entryRegionId: string;
          readonly sourceTraceStatus:
            "SOURCE_ROOT_TRACE" | "DISCONNECTED_SOURCE_REGION" | "UNKNOWN";
          readonly linkage:
            "EXACT_RESOLVED_IR_CHAIN" | "IR_CHAIN_UNRESOLVED";
          readonly regionIds: readonly string[];
          readonly executionEdgeIds: readonly string[];
          readonly edgeSites: readonly {
            readonly edgeId: string;
            readonly fromRegionId: string;
            readonly toRegionId: string;
            readonly kind: string;
            readonly sourceLocator: string;
            readonly controlFlow: string;
            readonly guardExpressions: readonly string[];
            readonly temporalBoundary: boolean;
          }[];
          readonly omittedEdgeSites: number;
          readonly temporalBoundaryCount: number;
        }[];
        readonly omittedSourcePaths: number;
        readonly proof: "SCRIPT_LITERAL_WRITE_WITH_SOURCE_PATH_NOT_EXECUTED";
      }[];
      readonly omittedSites: number;
    }[];
    readonly omittedSourceStateAssignments: number;
    /** Exact NPC button text and its OWN authored command, never design or execution proof. */
    readonly playerFacingCommandBindings: readonly {
      readonly featureId: string;
      readonly label: string;
      readonly sourceRelationId: string;
      readonly labelSource: import("../../../project-model/src/index.js").SourceRef;
      readonly commandSource: import("../../../project-model/src/index.js").SourceRef;
      readonly commandText: string;
      readonly authoredCondition: string | null;
      readonly sourceCallEdgeIds: readonly string[];
      readonly resolvedDirectTargetRegionIds: readonly string[];
      readonly directCommandWorldEffectIds: readonly string[];
      readonly directCommandStateOperationIds: readonly string[];
      readonly directTargetStateWriteIds: readonly string[];
      readonly directTargetWorldEffectIds: readonly string[];
      readonly directTargetReleaseIds: readonly string[];
      readonly omittedDirectTargetHandoffs: number;
      readonly proof: "EXACT_UI_BUTTON_COMMAND_SOURCE_NOT_EXECUTION";
    }[];
    readonly omittedPlayerFacingCommandBindings: number;
    /**
     * Unnamed source behavior with material effects, from the EXISTING
     * canonical Intent unknowns and Scenario/IR navigation. Never a new
     * mechanic, game rule, executable player journey or defect verdict.
     * Limited witnesses are previews; omission is not absence of evidence.
     */
    readonly uninterpretedSourceFlows: readonly {
      readonly unknownId: string;
      readonly question: string;
      readonly entryRegionId: string;
      readonly sourceTraceStatus:
        "SOURCE_ROOT_TRACE" | "DISCONNECTED_SOURCE_REGION" | "UNKNOWN";
      readonly materialEvidenceIds: readonly string[];
      readonly omittedMaterialEvidenceIds: number;
      readonly sourceLocators: readonly string[];
      readonly omittedSourceLocators: number;
      readonly effects: readonly {
        readonly effectId: string;
        readonly effectKind: NonNullable<MapAuditOutputV2["gameplayStructure"]>[
          "uninterpretedSourceFlows"][number]["effectPaths"][number]["effectKind"];
        readonly targetLabel: string | null;
        readonly evidenceStatus: NonNullable<MapAuditOutputV2["gameplayStructure"]>[
          "uninterpretedSourceFlows"][number]["effectPaths"][number]["evidenceStatus"];
        readonly guards: NonNullable<MapAuditOutputV2["gameplayStructure"]>[
          "uninterpretedSourceFlows"][number]["effectPaths"][number]["effectGuards"];
        readonly omittedGuards: number;
        readonly guardStateReadIds: readonly string[];
        readonly candidateOutcomeIds: readonly string[];
        readonly ingressEdgeIds: readonly string[];
        readonly candidateCallerStateWriteIds: readonly string[];
        readonly sourceLocalStateValueHandoffs: NonNullable<MapAuditOutputV2[
          "gameplayStructure"]>["uninterpretedSourceFlows"][number][
          "effectPaths"][number]["sourceLocalStateValueHandoffs"];
        readonly omittedValueHandoffs: number;
        readonly temporalBoundaryCount: number;
      }[];
      readonly omittedEffects: number;
    }[];
    readonly omittedUninterpretedSourceFlows: number;
    /** Literal source containment from the SAME canonical Gameplay Intent
     * model. Resources here are content, not activated phases or gameplay
     * scenarios; absence from a bounded preview never proves absence.
     */
    readonly authoredContent: {
      readonly basis: "SOURCE_CONTAINMENT_ONLY_NOT_GAMEPLAY_ORDER";
      readonly roots: readonly {
        readonly id: string;
        readonly label: string;
        readonly sourceLocator: string;
        readonly directChildCount: number;
        readonly children: readonly {
          readonly id: string;
          readonly label: string;
          readonly sourceLocator: string;
          readonly directChildCount: number;
          readonly children: readonly {
            readonly id: string;
            readonly label: string;
            readonly sourceLocator: string;
          }[];
          readonly omittedChildren: number;
        }[];
        readonly omittedChildren: number;
      }[];
      readonly omittedRoots: number;
    };
    /** Selected-source memory alias uncertainty; not game/runtime scope. */
    readonly sourceStateIdentityQuestions: readonly {
      readonly id: string;
      readonly question: string;
      readonly blockedSubjectIds: readonly string[];
      readonly evidenceIds: readonly string[];
    }[];
    readonly omittedSourceStateIdentityQuestions: number;
    /** Scoped return-guard matching questions; no authored policy proof. */
    readonly sourceReturnPolicyQuestions: readonly {
      readonly id: string;
      readonly question: string;
      readonly blockedSubjectIds: readonly string[];
      readonly evidenceIds: readonly string[];
    }[];
    readonly omittedSourceReturnPolicyQuestions: number;
    /** Bounded source-only arena/player partition questions, not runtime proof. */
    readonly sourceArenaPartitionQuestions: readonly string[];
    readonly omittedSourceArenaPartitionQuestions: number;
    /** Existing directed source paths, not chronological player sessions. */
    readonly sourceDesignPaths: NonNullable<MapAuditOutputV2["gameplayStructure"]>["gameplayJourneyCandidates"];
    readonly omittedSourceDesignPaths: number;
    /** Source-only resolved inter-region calls and immediate target operations.
     * Not proof of callback activation, live cancellation or player arrival.
     */
    readonly sourceHandoffs: readonly {
      readonly sourceFlowId: string;
      readonly edgeId: string;
      readonly fromRegionId: string;
      readonly toRegionId: string;
      readonly kind: "synchronous-call" | "event-dispatch" | "deferred" | "periodic";
      readonly source: import("../../../project-model/src/index.js").SourceRef;
      readonly scheduler?: "run" | "runTimeout" | "runInterval" | "runJob";
      readonly generationGuard: "EXPLICIT_SOURCE_CHECK" | "UNRESOLVED" | "NOT_RECORDED";
      readonly directTargetStateWriteIds: readonly string[];
      readonly directTargetWorldEffectIds: readonly string[];
      readonly directTargetReleaseIds: readonly string[];
      readonly omittedDirectTargetSteps: number;
      readonly proof: "RESOLVED_SOURCE_EDGE_NOT_RUNTIME_EXECUTION";
    }[];
    readonly omittedSourceHandoffs: number;
    readonly unresolved: MapAuditOutputV2["unresolved"];
  };
  /** Read-only consolidation of the EXISTING admitted BUG root groups and
   * unresolved validation groups. No new finding, proof, admission or root ID.
   */
  readonly diagnosisNavigation: {
    readonly authority: "READ_ONLY_CANONICAL_GROUPS_NOT_REPORT_PROOF";
    readonly admittedBugRootGroups: readonly {
      readonly candidateGroupKey: string;
      readonly technicalOwnerId: string;
      readonly dependencyTargetId: string;
      readonly causalLinkIds: readonly string[];
      readonly failureDomains: readonly string[];
    }[];
    readonly omittedBugRootGroups: number;
    readonly pendingProofGroups: readonly {
      readonly key: string;
      readonly verificationMode: "STATIC_PROOF_COMPLETION" | "NARROW_RUNTIME_VERIFICATION";
      readonly causalLinkIds: readonly string[];
      readonly nextCheck: string;
      readonly missingProof: readonly string[];
    }[];
    readonly omittedPendingProofGroups: number;
  };
  readonly taskCount: number;
  readonly offset: number;
  readonly nextOffset: number | null;
  readonly tasks: readonly {
    readonly task: AuditModelTaskPacket;
    readonly resolutionEligible: boolean;
  }[];
  readonly proofBoundary: "MODEL_RESPONSE_IS_UNTRUSTED_UNTIL_CANONICAL_ENGINE_ADMISSION";
}

/**
 * Bounded source-content navigation from the canonical Intent graph.
 * A stage/wave, gameplay catalogue, or choice collection is a source resource;
 * its nested 'owns' relation cannot grant playable chronology, delivery,
 * execution, or scenario/issue proof.
 */
function projectSelectedAuthoredContent(
  model: SelectedMapAuditRun["inspection"]["gameplayIntent"]["model"],
): SelectedMapAuditModelHandoff["gameUnderstanding"]["authoredContent"] {
  const selectedEvidence = new Map(model.evidence
    .filter(item => item.scope === "selected-artifact")
    .map(item => [item.id, item] as const));
  const authored = model.nodes.filter(node =>
    node.kind === "resource" &&
    (node.id.includes(":authored-source:") ||
      node.id.startsWith("resource:authored-content:")) &&
    node.evidenceIds.some(id => selectedEvidence.has(id)));
  const byId = new Map(authored.map(node => [node.id, node] as const));
  const children = new Map<string, string[]>();
  const contained = new Set<string>();
  for (const edge of model.edges) {
    if (!edge.id.startsWith("authored-content-owns:") ||
        edge.kind !== "owns" || edge.status !== "inferred" ||
        !byId.has(edge.from) || !byId.has(edge.to) ||
        !edge.evidenceIds.some(id => selectedEvidence.has(id))) continue;
    const siblings = children.get(edge.from) ?? [];
    if (!siblings.includes(edge.to)) siblings.push(edge.to);
    children.set(edge.from, siblings);
    contained.add(edge.to);
  }
  const locator = (id: string): string =>
    byId.get(id)?.evidenceIds
      .map(evidenceId => selectedEvidence.get(evidenceId))
      .find(item => item !== undefined)?.locator ??
    "UNRESOLVED_SELECTED_SOURCE";
  // Source order, not lexicographic Stage 1, Stage 10, Stage 2.
  const sourceOrder = (a: string, b: string): number => {
    const parse = (id: string) => {
      const site = locator(id);
      const match = /^(.*):([0-9]+):([0-9]+)$/.exec(site);
      return match
        ? { path: match[1]!, line: Number(match[2]),
            column: Number(match[3]) }
        : { path: site, line: 0, column: 0 };
    };
    const left = parse(a);
    const right = parse(b);
    return left.path.localeCompare(right.path) ||
      left.line - right.line || left.column - right.column ||
      a.localeCompare(b);
  };
  const sortedChildren = (id: string): string[] =>
    [...(children.get(id) ?? [])].sort(sourceOrder);
  const roots = authored.filter(node => !contained.has(node.id))
    .sort((a, b) => sourceOrder(a.id, b.id));
  const visibleRoots = roots.slice(0, 16);
  return {
    basis: "SOURCE_CONTAINMENT_ONLY_NOT_GAMEPLAY_ORDER",
    roots: visibleRoots.map(root => {
      const direct = sortedChildren(root.id);
      return {
        id: root.id,
        label: root.label,
        sourceLocator: locator(root.id),
        directChildCount: direct.length,
        children: direct.slice(0, 4).map(childId => {
          const child = byId.get(childId)!;
          const nested = sortedChildren(childId);
          return {
            id: child.id,
            label: child.label,
            sourceLocator: locator(childId),
            directChildCount: nested.length,
            children: nested.slice(0, 2).map(grandchildId => ({
              id: grandchildId,
              label: byId.get(grandchildId)!.label,
              sourceLocator: locator(grandchildId),
            })),
            omittedChildren: Math.max(0, nested.length - 2),
          };
        }),
        omittedChildren: Math.max(0, direct.length - 4),
      };
    }),
    omittedRoots: Math.max(0, roots.length - visibleRoots.length),
  };
}

export function projectSelectedMapAuditModelHandoff(
  audit: SelectedMapAuditRun,
  offset = 0,
  limit = 12,
): SelectedMapAuditModelHandoff {
  if (!Number.isSafeInteger(offset) || offset < 0 ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > 50) {
    throw new Error("Model handoff offset must be nonnegative and limit must be 1–50.");
  }
  const graph = audit.inspection.hiddenGameplayDefects.scenarioAudit.graph;
  const resolvable = new Set(graph.causalLinks
    .filter((link) => ["CONTRADICTED", "RUNTIME_BLOCKED", "DETECTION_GAP"]
      .includes(link.status))
    .map((link) => link.id));
  const features = audit.mapAuditReport.gameplayStructure?.features ?? [];
  const allCopy = audit.inspection.gameplayIntent.model.evidence
    .filter(item =>
      item.scope === "selected-artifact" &&
      item.origin === "translation" &&
      item.playerFacingText !== undefined);
  const sourceTranslationRefs = audit.inspection.gameplayIntent.model.evidence
    .filter(item =>
      item.scope === "selected-artifact" &&
      item.origin === "source-code" &&
      item.literalTranslationUse !== undefined);
  const refsByKey = new Map<string, typeof sourceTranslationRefs>();
  for (const reference of sourceTranslationRefs) {
    const key = reference.literalTranslationUse!.key;
    const list = refsByKey.get(key) ?? [];
    list.push(reference);
    refsByKey.set(key, list);
  }
  for (const list of refsByKey.values()) {
    list.sort((a, b) => a.locator.localeCompare(b.locator) ||
      a.id.localeCompare(b.id));
  }
  const definitionCounts = new Map<string, number>();
  for (const item of allCopy) {
    const key = item.playerFacingText!.key;
    definitionCounts.set(key, (definitionCounts.get(key) ?? 0) + 1);
  }
  // Prefer source-referenced explanatory sentences for investigation,
  // never for approval or truthfulness of a game's objective.
  // Generic result announcements remain available even when not referenced.
  // never for design authority. Preserve all omitted source cues in Intent.
  const copyWords = (item: typeof allCopy[number]): number =>
    item.playerFacingText!.text
      .replace(/§./g, " ")
      .replace(/[\uE000-\uF8FF]/g, " ")
      .trim().split(/\s+/).filter(Boolean).length;
  const rankedCopy = [...allCopy].sort((a, b) =>
    Number((refsByKey.get(b.playerFacingText!.key)?.length ?? 0) > 0) -
      Number((refsByKey.get(a.playerFacingText!.key)?.length ?? 0) > 0) ||
    copyWords(b) - copyWords(a) ||
    a.locator.localeCompare(b.locator) ||
    a.id.localeCompare(b.id));
  // Canonical, selected-artifact IR navigation for exact lexical
  // translation sites. Build local indexes ONCE: no second semantic model.
  // Do not index the whole map's execution graph on unrelated reports.
  // A source key join is useful only if one of the bounded locale entries
  // actually has an authored literal reference.
  const hasVisibleSourceReferences = rankedCopy.slice(0, 12).some(item =>
    (refsByKey.get(item.playerFacingText!.key)?.length ?? 0) > 0);
  const semanticIr: SemanticIr | undefined = hasVisibleSourceReferences
    ? audit.inspection.semanticIrModel
    : undefined;
  const regionsById = new Map((semanticIr?.execution.regions ?? [])
    .map(region => [region.id, region] as const));
  type SourceSite = NonNullable<SelectedMapAuditModelHandoff[
    "gameUnderstanding"]["playerFacingTextCues"][number][
      "literalTranslationReferences"][number]["sourceContext"]>[
        "directRegionSites"][number];
  const siteByRegion = new Map<string, SourceSite[]>();
  const location = (source: {relativePath:string; range?: {
    lineStart?:number; columnStart?:number;
  } | undefined}): string =>
    source.relativePath + (source.range?.lineStart === undefined ? "" :
      ":" + source.range.lineStart + ":" + (source.range.columnStart ?? 1));
  const addSite = (regionId: string, site: SourceSite): void => {
    const group = siteByRegion.get(regionId) ?? [];
    group.push(site);
    siteByRegion.set(regionId, group);
  };
  for (const item of semanticIr?.state.operations ?? []) {
    if (item.source.artifactId !== audit.identity.artifactId) continue;
    addSite(item.executionRegionId, {
      id: item.id, kind: "state", operation: item.operation,
      sourceLocator: location(item.source),
    });
  }
  for (const item of semanticIr?.state.resourceActions ?? []) {
    if (item.source.artifactId !== audit.identity.artifactId) continue;
    addSite(item.executionRegionId, {
      id: item.id, kind: "resource", operation: item.action,
      sourceLocator: location(item.source),
    });
  }
  for (const item of semanticIr?.execution.worldEffects ?? []) {
    if (item.source.artifactId !== audit.identity.artifactId) continue;
    addSite(item.executionRegionId, {
      id: item.id, kind: "world-effect", operation: item.kind,
      sourceLocator: location(item.source),
    });
  }
  for (const item of semanticIr?.execution.outcomes ?? []) {
    if (item.source.artifactId !== audit.identity.artifactId) continue;
    addSite(item.executionRegionId, {
      id: item.id, kind: "code-return", operation: item.propertyName,
      sourceLocator: location(item.source),
    });
  }
  for (const item of semanticIr?.execution.apiCalls ?? []) {
    if (item.source.artifactId !== audit.identity.artifactId) continue;
    addSite(item.executionRegionId, {
      id: item.id, kind: "typed-api-call", operation: item.method,
      sourceLocator: location(item.source),
    });
  }
  for (const group of siteByRegion.values()) {
    group.sort((a,b) =>
      Number(b.kind === "typed-api-call" && b.operation === "sendMessage") -
        Number(a.kind === "typed-api-call" && a.operation === "sendMessage") ||
      a.sourceLocator.localeCompare(b.sourceLocator) ||
      a.id.localeCompare(b.id));
  }
  const incomingByRegion = new Map<string, SemanticIr["execution"]["edges"][number][]>();
  const outgoingByRegion = new Map<string, SemanticIr["execution"]["edges"][number][]>();
  for (const edge of semanticIr?.execution.edges ?? []) {
    if (edge.resolution !== "resolved" || edge.to === undefined ||
        edge.source.artifactId !== audit.identity.artifactId ||
        !regionsById.has(edge.from) || !regionsById.has(edge.to)) continue;
    const incoming = incomingByRegion.get(edge.to) ?? [];
    incoming.push(edge);
    incomingByRegion.set(edge.to, incoming);
    const outgoing = outgoingByRegion.get(edge.from) ?? [];
    outgoing.push(edge);
    outgoingByRegion.set(edge.from, outgoing);
  }
  for(const map of [incomingByRegion, outgoingByRegion]){
    for(const group of map.values()) group.sort((a,b)=>a.id.localeCompare(b.id));
  }
  const sourceFlows = hasVisibleSourceReferences
    ? audit.mapAuditReport.gameplayStructure?.sourceFlowCandidates ?? []
    : [];
  const traceEntriesByRegion = new Map<string, {
    entryRegionId: string; sourceTraceStatus: string;
  }[]>();
  for(const flow of sourceFlows){
    for(const regionId of flow.regionIds){
      const group=traceEntriesByRegion.get(regionId)??[];
      group.push({entryRegionId:flow.entryRegionId,
        sourceTraceStatus:flow.sourceTraceStatus ?? "UNKNOWN"});
      traceEntriesByRegion.set(regionId,group);
    }
  }
  const edgeGuards = (edge: SemanticIr["execution"]["edges"][number]): string[] =>
    [...(edge.lexicalGuards??[]),...(edge.precedenceGuards??[])]
      .map(guard=>guard.expression+" ["+guard.branch+"] @ "+location(guard.source));
  const playerFacingTextCues: SelectedMapAuditModelHandoff[
    "gameUnderstanding"]["playerFacingTextCues"] =
    rankedCopy.slice(0, 12).map(item => ({
      evidenceId: item.id,
      key: item.playerFacingText!.key,
      text: item.playerFacingText!.text,
      sourceLocator: item.locator,
      literalTranslationReferences:
        (refsByKey.get(item.playerFacingText!.key) ?? []).slice(0, 5)
          .map(ref => {
            const use = ref.literalTranslationUse!;
            const regionId = use.executionRegionId;
            const region = regionId === undefined ? undefined :
              regionsById.get(regionId);
            const exactRegion = region !== undefined &&
              region.source.artifactId === audit.identity.artifactId &&
              region.source.relativePath ===
                ref.locator.replace(/:[1-9][0-9]*:[1-9][0-9]*$/, "");
            const direct = exactRegion
              ? siteByRegion.get(regionId!) ?? [] : [];
            const inbound = exactRegion
              ? incomingByRegion.get(regionId!) ?? [] : [];
            const outbound = exactRegion
              ? outgoingByRegion.get(regionId!) ?? [] : [];
            const traces = exactRegion
              ? traceEntriesByRegion.get(regionId!) ?? [] : [];
            return {
              evidenceId: ref.id,
              sourceLocator: ref.locator,
              executionRegion: use.executionRegion,
              syntax: use.syntax,
              sourceConditions: use.sourceConditions ?? [],
              sourceContext: {
                status: exactRegion
                  ? "EXACT_IR_SOURCE_REGION_CONTEXT"
                  : "IR_SOURCE_REGION_UNRESOLVED",
                executionRegionId: exactRegion ? regionId! : null,
                incomingEdges: inbound.slice(0, 4).map(edge => ({
                  edgeId: edge.id, fromRegionId: edge.from,
                  kind: edge.kind, sourceLocator: location(edge.source),
                  controlFlow: edge.controlFlow ?? "UNRESOLVED",
                  scheduler: edge.scheduler ?? null,
                  authoredGuards: edgeGuards(edge).slice(0, 4),
                })),
                omittedIncomingEdges: Math.max(0, inbound.length - 4),
                outgoingEdges: outbound.slice(0, 4).map(edge => {
                  const sites = siteByRegion.get(edge.to!) ?? [];
                  return {
                    edgeId: edge.id, toRegionId: edge.to!,
                    kind: edge.kind, sourceLocator: location(edge.source),
                    controlFlow: edge.controlFlow ?? "UNRESOLVED",
                    scheduler: edge.scheduler ?? null,
                    authoredGuards: edgeGuards(edge).slice(0, 4),
                    directTargetSites: sites.slice(0, 6),
                    omittedDirectTargetSites: Math.max(0, sites.length - 6),
                  };
                }),
                omittedOutgoingEdges: Math.max(0, outbound.length - 4),
                directRegionSites: direct.slice(0, 8),
                omittedDirectRegionSites: Math.max(0, direct.length - 8),
                sourceTraceEntries: traces.slice(0, 4),
                omittedSourceTraceEntries: Math.max(0, traces.length - 4),
                proof: "SOURCE_REGION_NAVIGATION_NOT_UI_DELIVERY_OR_GAME_CAUSALITY",
              },
            };
          }),
      omittedLiteralTranslationReferences: Math.max(0,
        (refsByKey.get(item.playerFacingText!.key)?.length ?? 0) - 5),
      sourceReferenceStatus:
        (refsByKey.get(item.playerFacingText!.key)?.length ?? 0) > 0
          ? "EXACT_LITERAL_TRANSLATE_SOURCE_REFERENCE"
          : "NO_LITERAL_TRANSLATE_REFERENCE_FOUND",
      matchingLocaleDefinitionCount:
        definitionCounts.get(item.playerFacingText!.key) ?? 0,
      proof: "LITERAL_SELECTED_SOURCE_COPY_NOT_GAME_DESIGN",
    }));
  // The existing IR owns ALL state-write and call-edge identities. Reuse
  // them rather than inferring a route from matching function/mode names.
  // Distinct source sites assigning one literal lexical state are grouped
  // only for navigation; group membership never merges session ownership.
  const sourceIr = audit.inspection.semanticIrModel;
  const sourceSurfacesById = new Map((sourceIr?.state.surfaces ?? [])
    .map(surface => [surface.id, surface] as const));
  const sourceEdgesById = new Map((sourceIr?.execution.edges ?? [])
    .map(edge => [edge.id, edge] as const));
  const sourceEffectById = new Map((audit.mapAuditReport.gameplayStructure
    ?.effectSlices ?? []).map(effect => [effect.effectId, effect] as const));
  const sourceFlowByRoot = new Map((audit.mapAuditReport.gameplayStructure
    ?.sourceFlowCandidates ?? []).map(flow => [flow.entryRegionId, flow] as const));
  type ScriptLiteralOperation = SemanticIr["state"]["operations"][number];
  const literalWrites = (sourceIr?.state.operations ?? []).filter(operation =>
    operation.operation === "write" &&
    operation.source.artifactId === audit.identity.artifactId &&
    operation.writtenValue?.kind === "literal" &&
    sourceSurfacesById.get(operation.surfaceId)?.ref.kind === "script-memory");
  const writesByLexicalValue = new Map<string, ScriptLiteralOperation[]>();
  for (const operation of literalWrites) {
    const literal = operation.writtenValue;
    if (literal?.kind !== "literal") continue;
    const identity = JSON.stringify([
      operation.surfaceId, literal.value, literal.scalarKind ?? null,
    ]);
    const group = writesByLexicalValue.get(identity) ?? [];
    group.push(operation);
    writesByLexicalValue.set(identity, group);
  }
  const rootedPathCount = (operations: readonly ScriptLiteralOperation[]): number =>
    operations.reduce((total, operation) => {
      const effect = sourceEffectById.get(operation.id);
      return total + (effect?.candidateIngress ?? []).filter(path =>
        sourceFlowByRoot.get(path.entryRegionId)?.sourceTraceStatus ===
          "SOURCE_ROOT_TRACE").length;
    }, 0);
  const sortedWrites = [...writesByLexicalValue.values()]
    .sort((a, b) =>
      Number(rootedPathCount(b) > 0) - Number(rootedPathCount(a) > 0) ||
      b.length - a.length ||
      a[0]!.surfaceId.localeCompare(b[0]!.surfaceId) ||
      (a[0]!.writtenValue?.kind === "literal"
        ? a[0]!.writtenValue.value : "").localeCompare(
        b[0]!.writtenValue?.kind === "literal"
          ? b[0]!.writtenValue.value : ""));
  const sourceStateAssignments: SelectedMapAuditModelHandoff[
    "gameUnderstanding"]["sourceStateAssignments"] =
    sortedWrites.slice(0, 12).map(operations => {
      const first = operations[0]!;
      const literal = first.writtenValue!;
      if (literal.kind !== "literal") {
        throw new Error("Script-memory literal source selection was invalid.");
      }
      const rawKey = sourceSurfacesById.get(first.surfaceId)?.ref.key ?? "";
      const authoredTarget = rawKey.includes("::")
        ? rawKey.slice(rawKey.indexOf("::") + 2) : rawKey;
      const sortedSites = [...operations].sort((a, b) =>
        a.source.relativePath.localeCompare(b.source.relativePath) ||
        (a.source.range?.lineStart ?? 0) - (b.source.range?.lineStart ?? 0) ||
        (a.source.range?.columnStart ?? 0) - (b.source.range?.columnStart ?? 0) ||
        a.id.localeCompare(b.id));
      return {
        surfaceId: first.surfaceId,
        authoredTarget,
        assignedValue: literal.value,
        scalarKind: literal.scalarKind ?? "unknown",
        lexicalOnly: true,
        sites: sortedSites.slice(0, 6).map(operation => {
          const effect = sourceEffectById.get(operation.id);
          const allGuards = [
            ...(operation.lexicalGuards ?? []).map(guard => ({
              kind: "lexical" as const, guard,
            })),
            ...(operation.precedenceGuards ?? []).map(guard => ({
              kind: "precedence" as const, guard,
            })),
          ];
          const paths = effect?.candidateIngress ?? [];
          return {
            operationId: operation.id,
            sourceLocator: location(operation.source),
            executionRegionId: operation.executionRegionId,
            effectPathStatus: effect?.status ?? "NOT_INDEXED",
            authoredGuards: allGuards.slice(0, 5).map(({kind,guard}) => ({
              kind, expression: guard.expression,
              branch: guard.branch, sourceLocator: location(guard.source),
            })),
            omittedAuthoredGuards: Math.max(0, allGuards.length - 5),
            sourcePaths: paths.slice(0, 4).map(path => {
              const edges = path.executionEdgeIds.map(id =>
                sourceEdgesById.get(id));
              // A path is a directed chain only if every exact edge connects
              // the NEXT path region in order. A broad IR trace alone cannot
              // assert continuity, and a missing call edge fails closed.
              const exact = path.regionIds.length ===
                path.executionEdgeIds.length + 1 &&
                path.regionIds[0] === path.entryRegionId &&
                path.regionIds.at(-1) === operation.executionRegionId &&
                edges.every((edge, index) =>
                  edge !== undefined && edge.resolution === "resolved" &&
                  edge.to !== undefined &&
                  edge.source.artifactId === audit.identity.artifactId &&
                  edge.from === path.regionIds[index] &&
                  edge.to === path.regionIds[index + 1]);
              const flow = sourceFlowByRoot.get(path.entryRegionId);
              return {
                entryRegionId: path.entryRegionId,
                sourceTraceStatus: flow?.sourceTraceStatus ?? "UNKNOWN",
                linkage: exact
                  ? "EXACT_RESOLVED_IR_CHAIN"
                  : "IR_CHAIN_UNRESOLVED",
                regionIds: path.regionIds.slice(0, 13),
                executionEdgeIds: path.executionEdgeIds.slice(0, 12),
                edgeSites: exact ? edges.slice(0, 8).flatMap(edge =>
                  edge === undefined ? [] : [{
                    edgeId: edge.id, fromRegionId: edge.from,
                    toRegionId: edge.to!, kind: edge.kind,
                    sourceLocator: location(edge.source),
                    controlFlow: edge.controlFlow ?? "UNKNOWN",
                    guardExpressions: [
                      ...(edge.lexicalGuards ?? []),
                      ...(edge.precedenceGuards ?? []),
                    ].slice(0, 4).map(guard =>
                      guard.expression + " [" + guard.branch + "] @ " +
                        location(guard.source)),
                    temporalBoundary: edge.kind === "event-dispatch" ||
                      edge.kind === "deferred" || edge.kind === "periodic",
                  }]) : [],
                omittedEdgeSites: exact ? Math.max(0, edges.length - 8) : 0,
                temporalBoundaryCount: exact ? edges.filter(edge =>
                  edge?.kind === "event-dispatch" ||
                  edge?.kind === "deferred" ||
                  edge?.kind === "periodic").length : 0,
              };
            }),
            omittedSourcePaths: Math.max(0, paths.length - 4),
            proof: "SCRIPT_LITERAL_WRITE_WITH_SOURCE_PATH_NOT_EXECUTED",
          };
        }),
        omittedSites: Math.max(0, sortedSites.length - 6),
      };
    });
  const sourceRelations = audit.mapAuditReport.gameplayStructure
    ?.authoredBehaviorRelationships ?? [];
  const allSourceFlows = audit.mapAuditReport.gameplayStructure?.sourceFlowCandidates ?? [];
  const featureById = new Map(features.map(item => [item.id, item] as const));
  const availableHandoffs = new Map(allSourceFlows.flatMap(flow =>
    (flow.sourceHandoffs ?? []).map(handoff => [handoff.edgeId, handoff] as const)));
  // Only literal text and command positions from the SAME authored button.
  // The source target must also be owned by the exact selected feature.
  const authoredButtons = sourceRelations.filter(relation => {
    if (relation.kind !== "dialogue-button-command" ||
        relation.resolution !== "EXACT_REFERENCE" ||
        !relation.targetSource?.jsonPointer ||
        !relation.source.jsonPointer ||
        !relation.interactionLabel?.trim() ||
        relation.source.artifactId !== audit.identity.artifactId ||
        relation.targetSource.artifactId !== audit.identity.artifactId ||
        relation.source.relativePath !== relation.targetSource.relativePath) return false;
    const label = relation.targetSource.jsonPointer;
    const command = relation.source.jsonPointer;
    const parent = label.replace(/\/(?:name|text)$/, "");
    if (parent === label || !command.startsWith(parent + "/commands/")) return false;
    const featureId = "mechanic:dialogue-interaction:" +
      encodeURIComponent(relation.ownerId);
    return featureById.get(featureId)?.sourceEvidenceIds.includes(relation.id) === true;
  }).sort((a,b) =>
    a.source.relativePath.localeCompare(b.source.relativePath) ||
    (a.source.jsonPointer ?? "").localeCompare(b.source.jsonPointer ?? "") ||
    a.id.localeCompare(b.id));
  const playerFacingCommandBindings: SelectedMapAuditModelHandoff[
    "gameUnderstanding"]["playerFacingCommandBindings"] =
    authoredButtons.slice(0, 8).map(relation => {
      const relevantHandoffs = (relation.executionEdgeIds ?? []).flatMap(id => {
        const item = availableHandoffs.get(id);
        return item === undefined ? [] : [item];
      });
      const material = (key: "directTargetStateWriteIds" |
        "directTargetWorldEffectIds" | "directTargetReleaseIds"): string[] =>
        [...new Set(relevantHandoffs.flatMap(item => item[key]))].sort();
      return {
        featureId: "mechanic:dialogue-interaction:" +
          encodeURIComponent(relation.ownerId),
        label: relation.interactionLabel!.trim(),
        sourceRelationId: relation.id,
        labelSource: relation.targetSource!,
        commandSource: relation.source,
        commandText: relation.to,
        authoredCondition: relation.condition ?? null,
        sourceCallEdgeIds: [...(relation.executionEdgeIds ?? [])].sort(),
        resolvedDirectTargetRegionIds: [...new Set(relevantHandoffs
          .map(item => item.toRegionId))].sort(),
        directCommandWorldEffectIds: [...(relation.worldEffectIds ?? [])].sort(),
        directCommandStateOperationIds: [...(relation.stateOperationIds ?? [])].sort(),
        directTargetStateWriteIds: material("directTargetStateWriteIds").slice(0, 8),
        directTargetWorldEffectIds: material("directTargetWorldEffectIds").slice(0, 8),
        directTargetReleaseIds: material("directTargetReleaseIds").slice(0, 8),
        omittedDirectTargetHandoffs: Math.max(0,
          (relation.executionEdgeIds?.length ?? 0) - relevantHandoffs.length),
        proof: "EXACT_UI_BUTTON_COMMAND_SOURCE_NOT_EXECUTION",
      };
    });
  const authoredContent = projectSelectedAuthoredContent(
    audit.inspection.gameplayIntent.model,
  );
  const unclassified = audit.mapAuditReport.gameplayStructure
    ?.uninterpretedSourceFlows ?? [];
  const allFlows = audit.mapAuditReport.gameplayStructure?.sourceFlowCandidates ?? [];
  const flowByEntry = new Map<string, typeof allFlows[number]>();
  for (const flow of allFlows) {
    const previous = flowByEntry.get(flow.entryRegionId);
    if (!previous ||
        (previous.sourceTraceStatus !== "SOURCE_ROOT_TRACE" &&
          flow.sourceTraceStatus === "SOURCE_ROOT_TRACE")) {
      flowByEntry.set(flow.entryRegionId, flow);
    }
  }
  const unknownById = new Map(audit.inspection.gameplayIntent.model.unknowns
    .map(item => [item.id, item] as const));
  const evidenceById = new Map(audit.inspection.gameplayIntent.model.evidence
    .map(item => [item.id, item] as const));
  const selectedUnclassified = [...unclassified].sort((a, b) => {
    const ranked = (item: typeof unclassified[number]) =>
      flowByEntry.get(item.entryRegionId)?.sourceTraceStatus === "SOURCE_ROOT_TRACE"
        ? 0 : 1;
    return ranked(a) - ranked(b) ||
      Number(b.effectPaths.length > 0) - Number(a.effectPaths.length > 0) ||
      b.materialEvidenceIds.length - a.materialEvidenceIds.length ||
      a.unknownId.localeCompare(b.unknownId);
  });
  const uninterpretedSourceFlows: SelectedMapAuditModelHandoff[
    "gameUnderstanding"]["uninterpretedSourceFlows"] =
    selectedUnclassified.slice(0, 8).map(item => {
      const flow = flowByEntry.get(item.entryRegionId);
      const ids = new Set(item.materialEvidenceIds);
      const sources = [...new Set((flow?.sourceSteps ?? [])
        .filter(step => ids.has(step.id) &&
          step.source.artifactId === audit.identity.artifactId)
        .map(step => step.source.relativePath +
          (step.source.range?.lineStart === undefined ? "" :
            ":" + step.source.range.lineStart + ":" +
              (step.source.range.columnStart ?? 1))))];
      // Preserve a coarse current-artifact locator when the IR lacks spans.
      if (sources.length === 0) {
        for (const id of item.materialEvidenceIds) {
          const evidence = evidenceById.get(id);
          if (evidence?.scope === "selected-artifact" && evidence.locator) {
            sources.push(evidence.locator);
          }
        }
      }
      const sourceLocators = [...new Set(sources)].sort();
      return {
        unknownId: item.unknownId,
        question: unknownById.get(item.unknownId)?.question ??
          "Determine the selected-source trigger, state, effect and player-facing purpose without inventing a game rule.",
        entryRegionId: item.entryRegionId,
        sourceTraceStatus: flow?.sourceTraceStatus ?? "UNKNOWN",
        materialEvidenceIds: item.materialEvidenceIds.slice(0, 16),
        omittedMaterialEvidenceIds: Math.max(0, item.materialEvidenceIds.length - 16),
        sourceLocators: sourceLocators.slice(0, 4),
        omittedSourceLocators: Math.max(0, sourceLocators.length - 4),
        effects: item.effectPaths.slice(0, 4).map(effect => {
          const edgeIds = [...new Set(effect.matchingIngress.flatMap(path =>
            path.executionEdgeIds))].sort();
          const callerWrites = [...new Set(effect.matchingIngress.flatMap(path =>
            path.candidateCallerStateWriteIds))].sort();
          return {
            effectId: effect.effectId,
            effectKind: effect.effectKind,
            targetLabel: effect.targetLabel,
            evidenceStatus: effect.evidenceStatus,
            guards: effect.effectGuards.slice(0, 4),
            omittedGuards: Math.max(0, effect.effectGuards.length - 4),
            guardStateReadIds: effect.guardStateReadIds.slice(0, 6),
            candidateOutcomeIds: effect.candidateOutcomeIds.slice(0, 6),
            ingressEdgeIds: edgeIds.slice(0, 6),
            candidateCallerStateWriteIds: callerWrites.slice(0, 6),
            sourceLocalStateValueHandoffs:
              effect.sourceLocalStateValueHandoffs.slice(0, 3),
            omittedValueHandoffs: Math.max(0,
              effect.sourceLocalStateValueHandoffs.length - 3),
            temporalBoundaryCount: effect.matchingIngress.reduce(
              (n, path) => n + path.temporalBoundaryEvidence.length, 0),
          };
        }),
        omittedEffects: Math.max(0, item.effectPaths.length - 4),
      };
    });
  const activationByFeature = new Map(
    (audit.mapAuditReport.gameplayStructure?.mechanicReconstructions ?? [])
      .map(item => [item.featureId, item.sourceActivationCandidates] as const),
  );
  const sourceStateIdentityQuestions =
    audit.inspection.gameplayIntent.model.unknowns
      .filter(item => item.id.startsWith("unknown:source-state-alias:"))
      .sort((a, b) => a.id.localeCompare(b.id));
  const sourceReturnPolicyQuestions =
    audit.inspection.gameplayIntent.model.unknowns
      .filter(item => item.id.startsWith("unknown:outcome-policy-coverage:"))
      .sort((a, b) => a.id.localeCompare(b.id));
  const sourceArenaPartitionQuestions =
    audit.mapAuditReport.multiArena.isolationRules.filter(rule =>
      rule.includes("=partition-proof-required") ||
      rule.includes("=unknown"));
  const selected = audit.modelTaskPackets.slice(offset, offset + limit);
  const handoffFlows =
    audit.mapAuditReport.gameplayStructure?.sourceFlowCandidates ?? [];
  const handoffsByEdge = new Map<string, {
    sourceFlowId: string;
    handoff: NonNullable<typeof handoffFlows[number]["sourceHandoffs"]>[number];
  }>();
  for (const flow of handoffFlows) {
    for (const handoff of flow.sourceHandoffs ?? []) {
      if (!handoffsByEdge.has(handoff.edgeId)) {
        handoffsByEdge.set(handoff.edgeId, {
          sourceFlowId: flow.id, handoff,
        });
      }
    }
  }
  const handoffs = [...handoffsByEdge.values()].sort((a, b) =>
    a.handoff.edgeId.localeCompare(b.handoff.edgeId));
  const omittedHandoffsInFlows = handoffFlows.reduce((sum, flow) =>
    sum + (flow.omittedSourceHandoffs ?? 0), 0);
  return {
    schemaVersion: 1,
    policy: "selected-map-audit-model-handoff",
    artifactId: audit.identity.artifactId,
    artifactFingerprint: audit.identity.artifactFingerprint,
    auditRevision: audit.auditRevision,
    currentStage: audit.currentStage,
    allowedNextAction: audit.allowedNextAction,
    gameUnderstanding: {
      gameDesign: audit.mapAuditReport.gameDesign,
      gameplayFlowBasis: audit.mapAuditReport.gameplayFlowBasis,
      features: features.slice(0, 16).map((feature) => ({
        id: feature.id,
        label: feature.label,
        kind: feature.kind,
        grounding: feature.grounding,
        sourceEvidenceIds: [...feature.sourceEvidenceIds],
        sourceEffectCount: new Set(feature.sourceBehaviorPaths
          .filter((path) => path.association === "DIRECT_EFFECT_EVIDENCE")
          .map((path) => path.effectId)).size,
        sourceActivationCandidates:
          (activationByFeature.get(feature.id) ?? []).slice(0, 3),
      })),
      omittedFeatures: Math.max(0, features.length - 16),
      playerFacingTextCues,
      omittedPlayerFacingTextCues:
        Math.max(0, rankedCopy.length - playerFacingTextCues.length),
      sourceStateAssignments,
      omittedSourceStateAssignments:
        Math.max(0, sortedWrites.length - sourceStateAssignments.length),
      playerFacingCommandBindings,
      omittedPlayerFacingCommandBindings:
        Math.max(0, authoredButtons.length - playerFacingCommandBindings.length),
      authoredContent,
      uninterpretedSourceFlows,
      omittedUninterpretedSourceFlows:
        Math.max(0, selectedUnclassified.length - 8),
      sourceStateIdentityQuestions: sourceStateIdentityQuestions.slice(0, 8)
        .map(item => ({
          id: item.id,
          question: item.question,
          blockedSubjectIds: [...item.blockedSubjectIds],
          evidenceIds: [...(item.evidenceIds ?? [])],
        })),
      omittedSourceStateIdentityQuestions: Math.max(
        0, sourceStateIdentityQuestions.length - 8,
      ),
      sourceReturnPolicyQuestions: sourceReturnPolicyQuestions.slice(0, 8)
        .map(item => ({
          id: item.id,
          question: item.question,
          blockedSubjectIds: [...item.blockedSubjectIds],
          evidenceIds: [...(item.evidenceIds ?? [])],
        })),
      omittedSourceReturnPolicyQuestions: Math.max(
        0, sourceReturnPolicyQuestions.length - 8,
      ),
      sourceArenaPartitionQuestions: sourceArenaPartitionQuestions.slice(0, 8),
      omittedSourceArenaPartitionQuestions: Math.max(0,
        sourceArenaPartitionQuestions.length - 8),
      sourceDesignPaths: (audit.mapAuditReport.gameplayStructure?.gameplayJourneyCandidates ?? [])
        .slice(0, 6),
      omittedSourceDesignPaths: Math.max(0,
        (audit.mapAuditReport.gameplayStructure?.gameplayJourneyCandidates.length ?? 0) - 6),
      sourceHandoffs: handoffs.slice(0, 12).map(({ sourceFlowId, handoff }) => ({
        sourceFlowId,
        edgeId: handoff.edgeId,
        fromRegionId: handoff.fromRegionId,
        toRegionId: handoff.toRegionId,
        kind: handoff.kind,
        source: handoff.source,
        ...(handoff.scheduler === undefined ? {} : { scheduler: handoff.scheduler }),
        generationGuard: handoff.generationGuard,
        directTargetStateWriteIds: handoff.directTargetStateWriteIds,
        directTargetWorldEffectIds: handoff.directTargetWorldEffectIds,
        directTargetReleaseIds: handoff.directTargetReleaseIds,
        omittedDirectTargetSteps: handoff.omittedDirectTargetSteps,
        proof: handoff.proof,
      })),
      omittedSourceHandoffs:
        Math.max(0, handoffs.length - 12) + omittedHandoffsInFlows,
      unresolved: audit.mapAuditReport.unresolved,
    },
    diagnosisNavigation: {
      authority: "READ_ONLY_CANONICAL_GROUPS_NOT_REPORT_PROOF",
      admittedBugRootGroups: audit.candidateGroups.slice(0, 8).map(group => ({
        candidateGroupKey: group.candidateGroupKey,
        technicalOwnerId: group.technicalOwnerId,
        dependencyTargetId: group.dependencyTargetId,
        causalLinkIds: [...group.causalLinkIds],
        failureDomains: [...group.failureDomains],
      })),
      omittedBugRootGroups: Math.max(0, audit.candidateGroups.length - 8),
      pendingProofGroups: audit.validationTests.slice(0, 8).map(group => ({
        key: group.key,
        verificationMode: group.verificationMode,
        causalLinkIds: [...group.findingIds],
        nextCheck: group.test,
        missingProof: [...group.missingProof],
      })),
      omittedPendingProofGroups: Math.max(0, audit.validationTests.length - 8),
    },
    taskCount: audit.modelTaskPackets.length,
    offset,
    nextOffset: offset + selected.length < audit.modelTaskPackets.length
      ? offset + selected.length
      : null,
    tasks: selected.map((task) => ({
      task,
      resolutionEligible:
        task.auditRevision === audit.auditRevision &&
        MODEL_RESOLVABLE_KINDS.has(task.kind) &&
        task.causalLinkId !== undefined &&
        resolvable.has(task.causalLinkId),
    })),
    proofBoundary:
      "MODEL_RESPONSE_IS_UNTRUSTED_UNTIL_CANONICAL_ENGINE_ADMISSION",
  };
}

