import {
  extractGameplayIntentSignals,
  extractGameplayIntentSurfaceSignal,
  type GameplayIntentRelationSignal,
  type GameplayIntentSignal,
} from "../../../../analyzers/gameplay-intent/src/index.js";
import {
  resolveScriptImports,
  type ParsedScriptFile,
  type CrossFileCallEdge,
} from "../../../../analyzers/scripts/src/index.js";
import type {
  ParsedFunction,
} from "../../../../analyzers/functions/src/index.js";
import type { SourceRef } from "../../../project-model/src/index.js";
import type { GameplayResourceTextEntry } from "./gameplay-intent-resource-text.js";
import { semanticIrExecutionTraces, type SemanticIr } from "../../../semantic-ir/src/index.js";
import { eventRegionId, scriptRegionId } from "../diagnosis/semantic-ir-stage.js";
import { sourceClassMethodRegion } from "../../../../analyzers/scripts/src/index.js";
import {
  validateGameplayIntentModel,
  type GameplayIntentEdge,
  type GameplayIntentEvidence,
  type GameplayIntentInvariant,
  type GameplayIntentModel,
  type GameplayIntentNode,
  type GameplayIntentStatus,
} from "../../../gameplay-intent/src/index.js";

export interface GameplayIntentStageInput {
  id: string;
  artifactId?: string;
  parsedScripts: readonly {
    parsed: ParsedScriptFile;
  }[];
  /** Existing mcfunction source index from the same inspected artifact. */
  parsedFunctions?: readonly {
    parsed: ParsedFunction;
  }[];
  contractScripts?: readonly {
    parsed: ParsedScriptFile;
  }[];
  supplementalSignals?: readonly GameplayIntentSignal[];
  /** Literal current-world .lang text: source cue, never keyword-inferred intent. */
  playerFacingTextCues?: readonly GameplayResourceTextEntry[];
  /**
   * Authoritative physical file inventory from the SAME selected artifact,
   * supplied by inspectDirectory. Supplemental signals are candidates and
   * must never register their own locators as selected source truth.
   */
  selectedSourceInventoryPaths?: readonly string[];
  /** Source-resolved imported calls from the same selected artifact as Semantic IR. */
  crossFileCallEdges?: readonly CrossFileCallEdge[];
  /** Built from these same parsed sources; absent in lightweight consumers. */
  semanticIr?: SemanticIr;
}

const STATUS_RANK: Readonly<Record<GameplayIntentStatus, number>> = {
  hypothesis: 0,
  inferred: 1,
  authored: 2,
};

function evidenceId(
  signal: GameplayIntentSignal | GameplayIntentRelationSignal,
): string {
  return "intent-evidence:" + signal.id;
}

function sameExactCallSource(left: SourceRef, right: SourceRef): boolean {
  // Both endpoints require a complete source span. Two missing end
  // coordinates are not evidence that an invocation has exact provenance.
  const a = left.range;
  const b = right.range;
  return left.artifactId === right.artifactId &&
    left.relativePath === right.relativePath &&
    left.jsonPointer === right.jsonPointer &&
    a?.lineStart !== undefined && b?.lineStart !== undefined &&
    a.lineEnd !== undefined && b.lineEnd !== undefined &&
    a.columnStart !== undefined && b.columnStart !== undefined &&
    a.columnEnd !== undefined && b.columnEnd !== undefined &&
    a.lineStart === b.lineStart &&
    a.lineEnd === b.lineEnd &&
    a.columnStart === b.columnStart &&
    a.columnEnd === b.columnEnd;
}

export function buildGameplayIntentModel(
  input: GameplayIntentStageInput,
): GameplayIntentModel {
  const contractScripts = input.contractScripts ?? [];
  // Filter by artifact ID BEFORE classification. Identical relative paths
  // across map versions are not equivalent source authority and must not
  // contribute nodes, return policies, or alias/intent evidence.
  const currentScript = (entry: { parsed: ParsedScriptFile }): boolean =>
    input.artifactId === undefined ||
    entry.parsed.source.artifactId === input.artifactId;
  const selectedScripts = input.parsedScripts.filter(currentScript);
  const selectedContracts = contractScripts.filter(currentScript);
  const selectedCalls = (input.crossFileCallEdges ?? []).filter(call =>
    input.artifactId === undefined ||
    call.source.artifactId === input.artifactId);
  const extractedBase = extractGameplayIntentSignals([
    ...selectedScripts.map(item => item.parsed),
    ...selectedContracts.map(item => item.parsed),
  ], selectedCalls);
  const supplementalSignals =
    input.supplementalSignals ?? [];
  const extracted = {
    ...extractedBase,
    signals: [
      ...extractedBase.signals,
      ...supplementalSignals,
    ],
  };
  const selectedArtifactSourcePaths = new Set([
    ...selectedScripts.map(item => item.parsed.source.relativePath),
    ...selectedContracts.map(item => item.parsed.source.relativePath),
    ...(input.parsedFunctions ?? []).filter(item =>
      input.artifactId === undefined ||
      item.parsed.source.artifactId === input.artifactId,
    ).map(item => item.parsed.source.relativePath),
    ...(input.selectedSourceInventoryPaths ?? []),
  ]);
  // One source-to-locator adapter for authored IR witnesses and read-only
  // source navigation. A file-only ref remains file scoped.
  const sourceLocator = (source: SourceRef): string =>
    source.relativePath +
      (source.range?.lineStart === undefined ? "" :
        ":" + source.range.lineStart + ":" +
        (source.range.columnStart ?? 1));
  const selectedSourceLocator = (locator: string): boolean => {
    if (selectedArtifactSourcePaths.has(locator)) return true;
    // Each exact dialogue JSON pointer must point into an independently
    // inventoried selected-artifact file, never authorize its own path.
    const jsonPointerStart = locator.indexOf("#/");
    if (jsonPointerStart > 0 &&
        selectedArtifactSourcePaths.has(locator.slice(0, jsonPointerStart))) {
      return true;
    }
    // Localized strings retain their original file#Lline locator.
    return /#L[1-9][0-9]*$/.test(locator) &&
      selectedArtifactSourcePaths.has(
        locator.replace(/#L[1-9][0-9]*$/, ""),
      );
  };
  const authoredSiteLocator = (site: SourceRef): string =>
    site.jsonPointer === undefined
      ? sourceLocator(site)
      : site.relativePath + "#" + site.jsonPointer;

  const evidence = new Map<string, GameplayIntentEvidence>();
  const nodes = new Map<string, GameplayIntentNode>();
  const edges = new Map<string, GameplayIntentEdge>();
  const invariants = new Map<string, GameplayIntentInvariant>();
  const intentUnknowns: GameplayIntentModel["unknowns"][number][] = [];

  // Reuse the canonical Gameplay Intent evidence owner. A literal player
  // instruction is useful discovery evidence, but does not create a
  // mechanic/objective or approve a game rule. The source location is only
  // authorized by the physical current-artifact file inventory.
  if (input.artifactId !== undefined) {
    for (const cue of input.playerFacingTextCues ?? []) {
      if (!selectedArtifactSourcePaths.has(cue.relativePath) ||
          !Number.isSafeInteger(cue.line) || cue.line < 1 ||
          !cue.key.trim() || !cue.text.trim()) continue;
      const locator = cue.relativePath + "#L" + cue.line;
      const id = "player-facing-copy:" + encodeURIComponent(
        input.artifactId + ":" + locator + ":" + cue.key);
      evidence.set(id, {
        id, origin: "translation", scope: "selected-artifact",
        locator,
        summary: "Literal .lang presentation (" + cue.key +
          "); visibility, player objective and intended gameplay NOT PROVEN.",
        playerFacingText: { key: cue.key, text: cue.text },
      });
    }
  }

  // A literal script `{ translate: "key" }` may refer to a selected-world
  // locale key. It is an independent CODE site, not a delivered UI message
  // or proof that the locale entry is the actual rendered translation.
  // Reuse the parser's exact authored property sites; do not grep code text
  // or correlate by phrase similarity. More than one pack can define a key.
  if (input.artifactId !== undefined) {
    const authoredLocaleKeys = new Set([...evidence.values()]
      .flatMap(item => item.playerFacingText === undefined
        ? [] : [item.playerFacingText.key]));
    const irRegions = new Map((input.semanticIr?.execution.regions ?? [])
      .map(item => [item.id, item] as const));
    for (const { parsed: script } of [...selectedScripts, ...selectedContracts]) {
      for (const use of script.literalTranslationReferences ?? []) {
        if (!authoredLocaleKeys.has(use.key) ||
            use.source.artifactId !== input.artifactId ||
            use.source.artifactId !== script.source.artifactId ||
            use.source.relativePath !== script.source.relativePath ||
            !selectedArtifactSourcePaths.has(use.source.relativePath) ||
            use.source.range?.lineStart === undefined ||
            use.source.range.columnStart === undefined) continue;
        const locator = sourceLocator(use.source);
        // Region IDs share the existing parser/IR owner; a similarly named
        // function in another script must not be used as the same origin.
        const regionId = scriptRegionId(script.source, use.executionRegion);
        const region = irRegions.get(regionId);
        const exactRegion = region !== undefined &&
          region.ownerId === script.identifier &&
          region.source.artifactId === input.artifactId &&
          region.source.relativePath === use.source.relativePath;
        const sourceConditions = [
          ...(use.lexicalGuards ?? []).map(guard => ({
            kind: "lexical" as const, guard,
          })),
          ...(use.precedenceGuards ?? []).map(guard => ({
            kind: "precedence" as const, guard,
          })),
        ].filter(({ guard }) =>
          guard.source.artifactId === input.artifactId &&
          guard.source.relativePath === use.source.relativePath &&
          guard.source.range?.lineStart !== undefined &&
          guard.source.range?.columnStart !== undefined)
          .map(({ kind, guard }) => ({
            kind, condition: guard.conditionText,
            branch: guard.branch,
            sourceLocator: sourceLocator(guard.source),
          }));
        const id = "literal-translation-use:" + encodeURIComponent(
          input.artifactId + ":" + locator + ":" + use.key);
        evidence.set(id, {
          id,
          origin: "source-code",
          scope: "selected-artifact",
          locator,
          summary: "Exact authored translate-property string literal refers " +
            "to selected-world locale key " + use.key +
            "; call reachability, player-facing delivery, pack selection " +
            "and intended gameplay semantics remain UNKNOWN.",
          literalTranslationUse: {
            key: use.key,
            syntax: use.syntax,
            executionRegion: use.executionRegion,
            ...(exactRegion ? { executionRegionId: regionId } : {}),
            ...(sourceConditions.length ? { sourceConditions } : {}),
          },
        });
      }
    }
  }

  // Only an exact authored assignment (target, value, region, location and
  // artifact) may inherit its Semantic IR identity. Same-named state labels,
  // source co-location and ambiguous matches are not state-transition proof.
  const exactStateMutationIrEvidenceIds = (
    origins: GameplayIntentSignal["stateMutationOrigins"],
  ): string[] => {
    if (!input.semanticIr) return [];
    const linked = new Set<string>();
    for (const origin of origins ?? []) {
      if (origin.scriptSource.artifactId !== origin.mutation.source.artifactId ||
          origin.scriptSource.relativePath !== origin.mutation.source.relativePath) {
        continue;
      }
      const surfaces = input.semanticIr.state.surfaces.filter(surface =>
        surface.ref.kind === "script-memory" &&
        surface.ref.key === origin.scriptSource.relativePath + "::" + origin.mutation.target);
      if (surfaces.length !== 1) continue;
      const matches = input.semanticIr.state.operations.filter(operation =>
        operation.operation === "write" &&
        operation.surfaceId === surfaces[0]!.id &&
        operation.executionRegionId === scriptRegionId(
          origin.scriptSource, origin.mutation.executionRegion,
        ) &&
        (origin.mutation.value.kind === "literal"
          ? operation.writtenValue?.kind === "literal" &&
            operation.writtenValue.value === origin.mutation.value.literal
          : operation.writtenValue?.kind === "member" &&
            operation.writtenValue.symbol === origin.mutation.value.symbol) &&
        sameExactCallSource(operation.source, origin.mutation.source));
      if (matches.length !== 1) continue;
      const match = matches[0]!;
      linked.add(match.id);
      evidence.set(match.id, {
        id: match.id,
        origin: "source-code",
        locator: sourceLocator(match.source),
        scope: "selected-artifact",
        summary: "Exact authored state-write identity; effective state, transition and runtime result remain unproven.",
      });
    }
    return [...linked].sort();
  };

  // Register technical evidence on the existing inferred/authored subject
  // only with an exact parsed producer -> IR identity. This does not upgrade
  // intent status or prove runtime completion.
  const signalIrEvidenceIds = (signal: GameplayIntentSignal): string[] => {
    if (!input.semanticIr) return [];
    const linked = new Set<string>(exactStateMutationIrEvidenceIds(
      signal.stateMutationOrigins,
    ));
    // Exact IR region identity for observed classified function symbols.
    // Region membership does not prove invocation or player-visible behavior.
    for (const origin of signal.executionRegionOrigins ?? []) {
      if (input.artifactId !== undefined &&
          input.artifactId !== origin.scriptSource.artifactId) continue;
      const id = scriptRegionId(origin.scriptSource, origin.region);
      const matches = input.semanticIr.execution.regions.filter(item =>
        item.id === id &&
        item.kind === "script-function" &&
        item.ownerId === origin.scriptIdentifier &&
        item.label === origin.region &&
        item.source?.artifactId === origin.scriptSource.artifactId &&
        item.source.relativePath === origin.scriptSource.relativePath);
      if (matches.length !== 1) continue;
      const match = matches[0]!;
      linked.add(match.id);
      evidence.set(match.id, {
        id: match.id,
        origin: "source-code",
        locator: origin.scriptSource.relativePath,
        scope: "selected-artifact",
        summary: "Parser-observed named function region linked to a classified source candidate; execution and gameplay effect remain unproven.",
      });
    }
    for (const origin of signal.returnOutcomeOrigins ?? []) {
      if (origin.scriptSource.artifactId !== origin.outcome.source.artifactId ||
          origin.scriptSource.relativePath !== origin.outcome.source.relativePath) {
        continue;
      }
      const matches = (input.semanticIr.execution.outcomes ?? []).filter(item =>
        item.executionRegionId === scriptRegionId(
          origin.scriptSource, origin.outcome.executionRegion,
        ) &&
        item.propertyName === origin.outcome.propertyName &&
        item.value === origin.outcome.value &&
        sameExactCallSource(item.source, origin.outcome.source));
      if (matches.length !== 1) continue;
      const match = matches[0]!;
      linked.add(match.id);
      evidence.set(match.id, {
        id: match.id,
        origin: "source-code",
        locator: sourceLocator(match.source),
        scope: "selected-artifact",
        summary: "Exact authored return-site identity; game terminal meaning and activation are not established.",
      });
    }
    for (const origin of signal.resourceActionOrigins ?? []) {
      if (origin.scriptSource.artifactId !== origin.action.source.artifactId ||
          origin.scriptSource.relativePath !== origin.action.source.relativePath) {
        continue;
      }
      const matches = (input.semanticIr.state.resourceActions ?? []).filter(item =>
        item.executionRegionId === scriptRegionId(
          origin.scriptSource, origin.action.executionRegion,
        ) &&
        item.surface === origin.action.surface &&
        item.action === origin.action.action &&
        item.key === origin.action.key &&
        item.precision === origin.action.precision &&
        sameExactCallSource(item.source, origin.action.source));
      if (matches.length !== 1) continue;
      const match = matches[0]!;
      linked.add(match.id);
      evidence.set(match.id, {
        id: match.id,
        origin: "source-code",
        locator: sourceLocator(match.source),
        scope: "selected-artifact",
        summary: "Exact authored resource action inside a classified function; release does not prove gameplay cleanup.",
      });
    }
    return [...linked].sort();
  };

  // Aggregate one source-alias question per lexical value rather than
  // creating a new unknown for every write site in the same state surface.
  const stateAliasQuestions = new Map<string, {
    readonly subjectIds: Set<string>;
    readonly evidenceIds: Set<string>;
  }>();

  for (const signal of extracted.signals) {
    const id = evidenceId(signal);
    const signalScope =
      selectedSourceLocator(signal.locator)
        ? "selected-artifact" as const
        : undefined;
    evidence.set(id, {
      id,
      origin: signal.evidenceOrigin,
      locator: signal.locator,
      summary: signal.summary,
      ...(signalScope === undefined
        ? {}
        : { scope: signalScope }),
    });

    const exactTechnicalEvidenceIds = signalIrEvidenceIds(signal);
    const signalEvidenceIds = [id, ...exactTechnicalEvidenceIds];
    if (signalScope === "selected-artifact" &&
        signal.sourceStateCollisionBaseKey !== undefined) {
      const key = signal.sourceStateCollisionBaseKey;
      const group = stateAliasQuestions.get(key) ?? {
        subjectIds: new Set<string>(),
        evidenceIds: new Set<string>(),
      };
      group.subjectIds.add(signal.subjectKey);
      group.evidenceIds.add(id);
      stateAliasQuestions.set(key, group);
    }
    const existing = nodes.get(signal.subjectKey);
    if (!existing) {
      nodes.set(signal.subjectKey, {
        id: signal.subjectKey,
        kind: signal.nodeKind,
        label: signal.label,
        status: signal.status,
        evidenceIds: signalEvidenceIds,
        ...(signal.policyPredicate === undefined
          ? {}
          : { policyPredicate: signal.policyPredicate }),
        ...(signal.spatialProfile === undefined
          ? {}
          : { spatialProfile: signal.spatialProfile }),
      });
      continue;
    }

    const mergedEvidence = [
      ...new Set([...existing.evidenceIds, ...signalEvidenceIds]),
    ].sort();

    nodes.set(signal.subjectKey, {
      ...existing,
      status:
        STATUS_RANK[signal.status] > STATUS_RANK[existing.status]
          ? signal.status
          : existing.status,
      evidenceIds: mergedEvidence,
      ...(existing.policyPredicate !== undefined
        ? { policyPredicate: existing.policyPredicate }
        : signal.policyPredicate !== undefined
        ? { policyPredicate: signal.policyPredicate }
        : {}),
      ...(existing.spatialProfile !== undefined
        ? { spatialProfile: existing.spatialProfile }
        : signal.spatialProfile !== undefined
        ? { spatialProfile: signal.spatialProfile }
        : {}),
    });
  }

  for (const [valueKey, group] of [...stateAliasQuestions]
    .sort(([a], [b]) => a.localeCompare(b))) {
    if (group.subjectIds.size < 2) continue;
    intentUnknowns.push({
      id: "unknown:source-state-alias:" + encodeURIComponent(valueKey),
      question: "Multiple independently authored script-memory targets " +
        "produce this same lexical state value. Exact source ownership is " +
        "known, but shared runtime identity, cross-module aliasing, and " +
        "player/session/arena/mode scope are NOT established. Resolve " +
        "the storage/alias path before combining these state subjects.",
      blockedSubjectIds: [...group.subjectIds].sort(),
      evidenceIds: [...group.evidenceIds].sort(),
    });
  }

  for (const relation of extracted.relations) {
    if (
      !nodes.has(relation.fromSubjectKey) ||
      !nodes.has(relation.toSubjectKey)
    ) {
      continue;
    }

    const id = evidenceId(relation);
    const relationScope =
      selectedSourceLocator(relation.locator)
        ? "selected-artifact" as const
        : undefined;
    evidence.set(id, {
      id,
      origin: relation.evidenceOrigin,
      locator: relation.locator,
      summary: relation.summary,
      ...(relationScope === undefined
        ? {}
        : { scope: relationScope }),
    });

    // Carry exact IR identity across the existing intent edge, but do not
    // upgrade the inferred gameplay purpose of a syntactic function call.
    const exactIrEvidenceIds = new Set<string>();
    if (relation.edgeKind === "requires" && input.semanticIr) {
      for (const origin of relation.localCallOrigins ?? []) {
        if (origin.scriptSource.artifactId !== origin.call.source.artifactId ||
            origin.scriptSource.relativePath !== origin.call.source.relativePath) {
          continue;
        }
        const matches = input.semanticIr.execution.edges.filter(edge =>
          edge.kind === "synchronous-call" &&
          edge.resolution === "resolved" &&
          edge.from === scriptRegionId(origin.scriptSource, origin.call.callerRegion) &&
          edge.to === scriptRegionId(origin.scriptSource, origin.call.targetRegion) &&
          edge.targetLabel === origin.call.targetName &&
          sameExactCallSource(edge.source, origin.call.source));
        if (matches.length !== 1) continue;
        const matched = matches[0]!;
        exactIrEvidenceIds.add(matched.id);
        evidence.set(matched.id, {
          id: matched.id,
          origin: "source-code",
          locator: matched.source.relativePath,
          scope: "selected-artifact",
          summary: "Exact Semantic IR call edge from parsed source location; gameplay dependency remains inferred.",
        });
      }
    }
    if (relation.edgeKind === "requires" && input.semanticIr) {
      for (const origin of relation.crossFileCallOrigins ?? []) {
        const call = origin.call;
        if (call.status !== "resolved" ||
            call.targetModule === undefined || call.targetRegion === undefined ||
            origin.scriptSource.artifactId !== call.source.artifactId ||
            origin.targetScriptSource.artifactId !== call.source.artifactId ||
            origin.scriptSource.relativePath !== call.callerModule ||
            origin.targetScriptSource.relativePath !== call.targetModule ||
            (input.artifactId !== undefined &&
              input.artifactId !== call.source.artifactId)) continue;
        const matches = input.semanticIr.execution.edges.filter(edge =>
          edge.kind === "synchronous-call" &&
          edge.resolution === "resolved" &&
          edge.from === scriptRegionId(origin.scriptSource, call.callerRegion) &&
          edge.to === scriptRegionId(origin.targetScriptSource, call.targetRegion!) &&
          edge.targetLabel === call.localName &&
          sameExactCallSource(edge.source, call.source));
        if (matches.length !== 1) continue;
        const matched = matches[0]!;
        exactIrEvidenceIds.add(matched.id);
        evidence.set(matched.id, {
          id: matched.id,
          origin: "source-code",
          locator: sourceLocator(matched.source),
          scope: "selected-artifact",
          summary: "Exact cross-script Semantic IR call site and executable target. Gameplay purpose and actual execution remain inferred.",
        });
      }
    }
    if (input.semanticIr) {
      for (const origin of relation.callbackOrigins ?? []) {
        const source = origin.kind === "event"
          ? origin.event.source : origin.callback.source;
        if (origin.scriptSource.artifactId !== source.artifactId ||
            origin.scriptSource.relativePath !== source.relativePath) {
          continue;
        }
        const from = origin.kind === "event"
          ? eventRegionId(origin.event.root, origin.event.phase,
              origin.event.event, source)
          : scriptRegionId(origin.scriptSource,
              origin.callback.callerRegion ?? "module");
        const toRegion = origin.kind === "event"
          ? origin.event.callbackRegion : origin.callback.callbackRegion;
        if (!toRegion) continue;
        const target = scriptRegionId(origin.scriptSource, toRegion);
        const expectedKind = origin.kind === "event"
          ? "event-dispatch"
          : origin.callback.scheduler === "runInterval"
            ? "periodic" : "deferred";
        const expectedLabel = origin.kind === "event"
          ? origin.scriptIdentifier + ":" + toRegion : toRegion;
        const matches = input.semanticIr.execution.edges.filter(edge =>
          edge.kind === expectedKind &&
          edge.resolution === "resolved" &&
          edge.from === from && edge.to === target &&
          edge.targetLabel === expectedLabel &&
          (origin.kind !== "scheduler" ||
            edge.scheduler === origin.callback.scheduler) &&
          sameExactCallSource(edge.source, source));
        if (matches.length !== 1) continue;
        const matched = matches[0]!;
        exactIrEvidenceIds.add(matched.id);
        evidence.set(matched.id, {
          id: matched.id,
          origin: "source-code",
          locator: sourceLocator(matched.source),
          scope: "selected-artifact",
          summary: "Exact Semantic IR event/scheduler execution edge; gameplay purpose remains inferred.",
        });
        const temporalMatches = input.semanticIr.temporal.relations.filter(item =>
          item.id === "time:" + matched.id &&
          item.from === matched.from &&
          item.to === matched.to &&
          item.resolution === "resolved" &&
          sameExactCallSource(item.source, source));
        if (temporalMatches.length !== 1) continue;
        const temporal = temporalMatches[0]!;
        exactIrEvidenceIds.add(temporal.id);
        evidence.set(temporal.id, {
          id: temporal.id,
          origin: "source-code",
          locator: sourceLocator(temporal.source),
          scope: "selected-artifact",
          summary: "Exact Semantic IR temporal relation; runtime scheduling remains unverified.",
        });
      }
    }
    if (relation.edgeKind === "transitions-to") {
      for (const matchedId of exactStateMutationIrEvidenceIds(
        relation.stateMutationOrigins,
      )) exactIrEvidenceIds.add(matchedId);
    }
    // Exact guard/return witnesses also belong on the authored "requires"
    // relation; they do not upgrade source order into runtime causality.
    if ((relation.edgeKind === "produces" ||
         relation.edgeKind === "requires") && input.semanticIr) {
      for (const origin of relation.returnOutcomeOrigins ?? []) {
        if (origin.scriptSource.artifactId !== origin.outcome.source.artifactId ||
            origin.scriptSource.relativePath !== origin.outcome.source.relativePath ||
            (input.artifactId !== undefined &&
              input.artifactId !== origin.outcome.source.artifactId)) continue;
        const matches = (input.semanticIr.execution.outcomes ?? []).filter(item =>
          item.executionRegionId === scriptRegionId(
            origin.scriptSource, origin.outcome.executionRegion,
          ) &&
          item.propertyName === origin.outcome.propertyName &&
          item.value === origin.outcome.value &&
          sameExactCallSource(item.source, origin.outcome.source));
        if (matches.length !== 1) continue;
        const matched = matches[0]!;
        exactIrEvidenceIds.add(matched.id);
        evidence.set(matched.id, {
          id: matched.id, origin: "source-code",
          locator: sourceLocator(matched.source), scope: "selected-artifact",
          summary: "Exact authored return for inferred producer relationship; gameplay meaning and execution remain unproven.",
        });
      }
    }
    const relationEvidenceIds = [id, ...exactIrEvidenceIds].sort();

    const semanticKey = [
      relation.edgeKind,
      relation.fromSubjectKey,
      relation.toSubjectKey,
    ].join("::");

    const existing = edges.get(semanticKey);
    if (!existing) {
      edges.set(semanticKey, {
        id:
          "intent-edge:" +
          relation.edgeKind + ":" +
          relation.fromSubjectKey + ":" +
          relation.toSubjectKey,
        from: relation.fromSubjectKey,
        to: relation.toSubjectKey,
        kind: relation.edgeKind,
        status: relation.status,
        evidenceIds: relationEvidenceIds,
      });
      continue;
    }

    edges.set(semanticKey, {
      ...existing,
      status:
        STATUS_RANK[relation.status] >
        STATUS_RANK[existing.status]
          ? relation.status
          : existing.status,
      evidenceIds: [
        ...new Set([...existing.evidenceIds, ...relationEvidenceIds]),
      ].sort(),
    });
  }


  // Reconcile the mcfunction source owner with the Semantic IR already
  // produced by this inspection. Only individually identified, classified
  // functions participate; name similarity alone is never a new mechanic.
  // Graph edges below are source-observed, inferred dependencies, not
  // assertions about command success or Minecraft runtime state.
  if (input.semanticIr && input.parsedFunctions?.length) {
    const sourceFunctions = input.parsedFunctions
      .flatMap(({ parsed }) => {
        if (input.artifactId !== undefined &&
            parsed.source.artifactId !== input.artifactId) return [];
        const candidate = extractGameplayIntentSurfaceSignal({
          label: parsed.identifier,
          locator: parsed.source.relativePath,
          evidenceOrigin: "source-code",
        });
        // A source candidate must be in the current authoritative surface
        // signal inventory; do not invent it during orchestration.
        if (!candidate ||
            !supplementalSignals.some(signal =>
              signal.id === candidate.id &&
              signal.subjectKey === candidate.subjectKey &&
              signal.evidenceOrigin === "source-code" &&
              signal.locator === parsed.source.relativePath) ||
            !nodes.has(candidate.subjectKey)) return [];
        const regions = input.semanticIr!.execution.regions.filter(region =>
          region.kind === "mcfunction" &&
          region.ownerId === parsed.identifier &&
          region.source?.artifactId === parsed.source.artifactId &&
          region.source.relativePath === parsed.source.relativePath);
        if (regions.length !== 1) return [];
        return [{ parsed, subjectId: candidate.subjectKey, region: regions[0]! }];
      });
    const uniqueRegionOwners = new Map<string, typeof sourceFunctions>();
    for (const owner of sourceFunctions) {
      const list = uniqueRegionOwners.get(owner.region.id) ?? [];
      list.push(owner);
      uniqueRegionOwners.set(owner.region.id, list);
    }
    // A lexical subject key may match distinct mcfunctions in different
    // packs. Do not merge those executable owners into one gameplay node;
    // their IR records remain independently visible as Discovery residue.
    const uniqueSubjectOwners = new Map<string, typeof sourceFunctions>();
    for (const owner of sourceFunctions) {
      const list = uniqueSubjectOwners.get(owner.subjectId) ?? [];
      list.push(owner);
      uniqueSubjectOwners.set(owner.subjectId, list);
    }
    const accepted = sourceFunctions.filter(owner =>
      uniqueRegionOwners.get(owner.region.id)?.length === 1 &&
      uniqueSubjectOwners.get(owner.subjectId)?.length === 1);
    const byRegion = new Map(accepted.map(owner =>
      [owner.region.id, owner] as const));
    const addIrEvidence = (
      id: string,
      source: SourceRef,
      summary: string,
    ): void => {
      evidence.set(id, {
        id,
        origin: "source-code",
        locator: source.relativePath,
        scope: "selected-artifact",
        summary,
      });
    };
    const addInferredEdge = (
      from: string,
      to: string,
      kind: GameplayIntentEdge["kind"],
      witnessId: string,
      description: string,
    ): void => {
      const key = [kind, from, to].join("::");
      const existing = edges.get(key);
      const ids = [...new Set([...(existing?.evidenceIds ?? []), witnessId])].sort();
      edges.set(key, existing
        ? { ...existing, evidenceIds: ids }
        : {
            id: "intent-edge:" + kind + ":" + from + ":" + to,
            from, to, kind, status: "inferred",
            evidenceIds: ids, description,
          });
    };
    for (const owner of accepted) {
      addIrEvidence(
        owner.region.id,
        owner.parsed.source,
        "Authored mcfunction source region; activation and completion are not proven.",
      );
      const current = nodes.get(owner.subjectId)!;
      nodes.set(owner.subjectId, {
        ...current,
        evidenceIds: [...new Set([
          ...current.evidenceIds, owner.region.id,
        ])].sort(),
      });

      // Use the already-normalized IR scoreboard/tag surface. These are
      // technical resources; no economy, score, or player effect is inferred.
      for (const operation of input.semanticIr.state.operations) {
        if (operation.executionRegionId !== owner.region.id ||
            operation.source.artifactId !== owner.parsed.source.artifactId ||
            operation.source.relativePath !== owner.parsed.source.relativePath) {
          continue;
        }
        const surface = input.semanticIr.state.surfaces.find(item =>
          item.id === operation.surfaceId);
        if (!surface || (surface.ref.kind !== "scoreboard" &&
                         surface.ref.kind !== "tag")) continue;
        const key = "resource:" + surface.ref.kind + ":" +
          encodeURIComponent(surface.ref.key);
        addIrEvidence(
          operation.id, operation.source,
          "Authored " + surface.ref.kind + " " + operation.operation +
          " operation; live state and player-visible effects remain unverified.",
        );
        const prev = nodes.get(key);
        nodes.set(key, prev
          ? { ...prev,
              evidenceIds: [...new Set([...prev.evidenceIds, operation.id])].sort() }
          : {
              id: key,
              kind: "resource",
              label: (surface.ref.kind === "scoreboard"
                ? "Scoreboard " : "Tag ") + surface.ref.key,
              status: "authored",
              evidenceIds: [operation.id],
              description: "Source-observed technical state surface, not a declared game rule.",
            });
        addInferredEdge(
          owner.subjectId, key, "participates-in", operation.id,
          "This mcfunction references a technical state surface. " +
          "Direction, gameplay meaning and runtime effects are not proven.",
        );
      }

      // Direct calls carry the exact parsed command site and resolved IR
      // target; unresolved, ambiguous and unclassified callees are not linked.
      for (const reference of owner.parsed.references) {
        if (reference.kind !== "function") continue;
        const matches = input.semanticIr.execution.edges.filter(edge =>
          edge.kind === "synchronous-call" &&
          edge.resolution === "resolved" &&
          edge.from === owner.region.id &&
          edge.targetLabel === reference.target &&
          edge.to !== undefined &&
          byRegion.has(edge.to) &&
          sameExactCallSource(edge.source, reference.source));
        if (matches.length !== 1) continue;
        const match = matches[0]!;
        const target = byRegion.get(match.to!);
        if (!target) continue;
        addIrEvidence(
          match.id, match.source,
          "Exact mcfunction call to a uniquely identified source target; " +
          "branch reachability and gameplay purpose remain unproven.",
        );
        addInferredEdge(
          owner.subjectId, target.subjectId, "requires", match.id,
          "Source directly invokes this classified mcfunction. " +
          "Runtime execution and player-facing dependency are inferred.",
        );
      }
    }
  }

  // Reconcile selected-script tag and scoreboard state operations with the
  // same technical resource subjects already used for mcfunctions. The
  // operation site is canonical Semantic IR evidence: a tag name or score
  // objective is not itself a game objective, an entity instance or a
  // successful mutation. A classified mechanic receives an INFERRED
  // participates-in relation only when its EXACT IR region evidence uniquely
  // owns the operation's region in this selected source artifact.
  if (input.semanticIr) {
    const surfaces = new Map(input.semanticIr.state.surfaces.map(surface =>
      [surface.id, surface.ref] as const));
    const scriptRegions = new Map(input.semanticIr.execution.regions
      .filter(region => region.kind === "script-function" ||
        region.kind === "script-callback" ||
        region.kind === "script-module")
      .map(region => [region.id, region] as const));
    const byRegion = new Map<string, GameplayIntentNode[]>();
    for (const node of nodes.values()) {
      if (node.kind !== "mechanic" &&
          node.kind !== "phase" && node.kind !== "lifecycle" &&
          node.kind !== "objective") continue;
      for (const evidenceId of node.evidenceIds) {
        if (!scriptRegions.has(evidenceId)) continue;
        const owners = byRegion.get(evidenceId) ?? [];
        owners.push(node);
        byRegion.set(evidenceId, owners);
      }
    }
    const unresolvedTagKeys = new Map<string, Set<string>>();
    for (const operation of input.semanticIr.state.operations) {
      const surface = surfaces.get(operation.surfaceId);
      const region = scriptRegions.get(operation.executionRegionId);
      if (!surface || (surface.kind !== "tag" &&
                       surface.kind !== "scoreboard") ||
          !region ||
          (input.artifactId !== undefined &&
            operation.source.artifactId !== input.artifactId) ||
          region.source?.artifactId !== operation.source.artifactId ||
          region.source?.relativePath !== operation.source.relativePath) continue;

      evidence.set(operation.id, {
        id: operation.id,
        origin: surface.kind === "tag" ? "tag" : "scoreboard",
        locator: operation.source.relativePath,
        scope: "selected-artifact",
        summary: "Exact script/command source operation on a technical " +
          surface.kind + " surface; receiver alias, runtime state and game-design meaning remain unresolved.",
      });
      if (surface.key === "*") {
        if (surface.kind === "tag") {
          const sites = unresolvedTagKeys.get(region.id) ?? new Set<string>();
          sites.add(operation.id);
          unresolvedTagKeys.set(region.id, sites);
        }
        // A wildcard key has no exact, source-backed technical resource
        // identity. Do not merge computed tags with each other or with
        // known literal tags, even within one method or actor.
        continue;
      }
      const key = "resource:" + surface.kind + ":" +
        encodeURIComponent(surface.key);
      const previous = nodes.get(key);
      nodes.set(key, previous
        ? {
            ...previous,
            evidenceIds: [...new Set([...previous.evidenceIds, operation.id])].sort(),
          }
        : {
            id: key, kind: "resource",
            label: (surface.kind === "tag" ? "Tag " : "Scoreboard ") + surface.key,
            status: "authored",
            evidenceIds: [operation.id],
            description:
              "Source-observed technical surface only; actor/arena ownership and gameplay meaning are unknown.",
          });
      const owners = byRegion.get(region.id) ?? [];
      if (owners.length !== 1) continue;
      const owner = owners[0]!;
      const edgeKey = ["participates-in", owner.id, key].join("::");
      const existing = edges.get(edgeKey);
      edges.set(edgeKey, existing
        ? {
            ...existing,
            evidenceIds: [...new Set([...existing.evidenceIds, operation.id])].sort(),
          }
        : {
            id: "intent-edge:participates-in:" + owner.id + ":" + key,
            from: owner.id, to: key, kind: "participates-in",
            status: "inferred", evidenceIds: [operation.id],
            description:
              "Classified source region references an exact tag/scoreboard operation. " +
              "Source association only; effect, scope and gameplay purpose are unproven.",
          });
    }
    for (const [regionId, sites] of [...unresolvedTagKeys]
      .sort(([a], [b]) => a.localeCompare(b))) {
      intentUnknowns.push({
        id: "unknown:script-tag-dynamic-key:" + encodeURIComponent(regionId),
        question:
          "Typed Entity/Player tag access uses a dynamic or unsupported tag key. " +
          "Its exact source operations are recorded, but the tag name, runtime " +
          "receiver identity and relationship to other gameplay state are UNKNOWN.",
        blockedSubjectIds: [],
        evidenceIds: [...sites].sort(),
      });
    }
  }

  // Link only an exact IR world effect to ONE already classified candidate
  // that owns the same execution region; never manufacture new mechanics.
  for (const effect of input.semanticIr?.execution.worldEffects ?? []) {
    if (input.artifactId !== undefined &&
        effect.source.artifactId !== input.artifactId) continue;
    const owners = [...nodes.values()].filter(node =>
      node.status !== "hypothesis" &&
      node.evidenceIds.includes(effect.executionRegionId));
    if (owners.length !== 1) continue;
    const owner = owners[0]!;
    evidence.set(effect.id, {
      id: effect.id, origin: "source-code",
      locator: effect.source.relativePath,
      scope: "selected-artifact",
      summary: "Authored " + effect.kind + " attempt; source presence " +
        "does not establish gameplay execution or success.",
    });
    nodes.set(owner.id, {
      ...owner,
      evidenceIds: [...new Set([...owner.evidenceIds, effect.id])].sort(),
    });
  }

  const evidenceHasSelectedArtifactSource = (
    evidenceIds: readonly string[],
  ): boolean =>
    evidenceIds.some((id) => {
      const item = evidence.get(id);
      return (
        item !== undefined &&
        item.scope === "selected-artifact"
      );
    });

  const authoredTransitionsByFrom = new Map<
    string,
    GameplayIntentEdge[]
  >();

  for (const edge of edges.values()) {
    if (
      edge.kind !== "transitions-to" ||
      edge.status !== "authored"
    ) {
      continue;
    }
    const list =
      authoredTransitionsByFrom.get(edge.from) ?? [];
    list.push(edge);
    authoredTransitionsByFrom.set(edge.from, list);
  }

  for (const [from, transitions] of authoredTransitionsByFrom) {
    const targetLabels = transitions
      .map((edge) => nodes.get(edge.to)?.label ?? edge.to)
      .sort();
    const evidenceIds = [
      ...new Set(
        transitions.flatMap((edge) => edge.evidenceIds),
      ),
    ].sort();

    invariants.set("inv:allowed-transitions:" + from, {
      id: "inv:allowed-transitions:" + from,
      statement:
        (nodes.get(from)?.label ?? from) +
        " transitions only to declared successors: " +
        targetLabels.join(", "),
      strength: "must",
      status: evidenceHasSelectedArtifactSource(evidenceIds)
        ? "authored"
        : "inferred",
      subjectIds: [from],
      evidenceIds,
    });
  }

  for (const coverage of extracted.outcomePolicyCoverage) {
    const policyEdges = [...edges.values()].filter(
      (edge) =>
        edge.from === coverage.outcomeSubjectKey &&
        edge.kind === "requires" &&
        edge.status === "authored" &&
        nodes.get(edge.to)?.kind === "policy",
    );

    if (
      coverage.completeDirectGuardCoverage &&
      policyEdges.length > 0
    ) {
      const policyLabels = policyEdges
        .map((edge) => nodes.get(edge.to)?.label ?? edge.to)
        .sort();
      const evidenceIds = [
        ...new Set(
          policyEdges.flatMap((edge) => edge.evidenceIds),
        ),
      ].sort();

      invariants.set(
        "inv:admissible-policy:" +
          coverage.outcomeSubjectKey,
        {
          id:
            "inv:admissible-policy:" +
            coverage.outcomeSubjectKey,
          statement:
            (nodes.get(coverage.outcomeSubjectKey)?.label ??
              coverage.outcomeSubjectKey) +
            " is statically observed only under one of these direct guards: " +
            policyLabels.join(" OR "),
          strength: "must",
          status: evidenceHasSelectedArtifactSource(evidenceIds)
            ? "authored"
            : "inferred",
          subjectIds: [coverage.outcomeSubjectKey],
          evidenceIds,
        },
      );
      continue;
    }

    if (coverage.totalLiteralReturnSites > 0) {
      intentUnknowns.push({
        id:
          "unknown:outcome-policy-coverage:" +
          coverage.outcomeSubjectKey,
        question:
          "Not every recognized literal return site for this outcome is controlled by a directly modeled if-guard; switch/default/nested or other control flow may still define admissibility.",
        blockedSubjectIds: [coverage.outcomeSubjectKey],
        evidenceIds: (nodes.get(coverage.outcomeSubjectKey)?.evidenceIds ?? [])
          .filter(id => evidence.get(id)?.scope === "selected-artifact")
          .sort(),
      });
    }
  }

  // Source-grounded authored relations are technical evidence. Only NPC
  // buttons with literal visible text and an exact authored command site
  // admit a bounded UI-interaction candidate; no win/phase purpose inferred.
  const authoredByOwner = new Map<string, string[]>();
  const uiByOwner = new Map<string, {
    label: string; evidenceIds: Set<string>;
  }>();
  for (const relation of input.semanticIr?.execution.authoredBehaviorRelations ?? []) {
    if (input.artifactId !== undefined &&
        relation.source.artifactId !== input.artifactId) continue;
    evidence.set(relation.id, {
      id: relation.id,
      // The relation identifies COMMAND/source behavior. A dialogue
      // origin would misrepresent a command as displayed NPC wording.
      origin: "source-code",
      locator: authoredSiteLocator(relation.source),
      scope: "selected-artifact",
      summary: relation.kind + ": " + relation.reason +
        (relation.condition ? " Authored condition: " + relation.condition : ""),
    });
    const evidenceIds = [relation.id];
    for (const effectId of relation.worldEffectIds ?? []) {
      const effect = input.semanticIr?.execution.worldEffects?.find(item =>
        item.id === effectId &&
        item.source.artifactId === relation.source.artifactId &&
        item.source.relativePath === relation.source.relativePath &&
        item.source.jsonPointer === relation.source.jsonPointer);
      if (!effect) continue;
      evidenceIds.push(effect.id);
      evidence.set(effect.id, {
        id: effect.id, origin: "source-code",
        locator: authoredSiteLocator(effect.source), scope: "selected-artifact",
        summary: "Parsed authored command world-effect attempt; UI activation and runtime success remain unverified.",
      });
    }
    for (const operationId of relation.stateOperationIds ?? []) {
      const operation = input.semanticIr?.state.operations.find(item =>
        item.id === operationId &&
        item.source.artifactId === relation.source.artifactId &&
        item.source.relativePath === relation.source.relativePath &&
        item.source.jsonPointer === relation.source.jsonPointer);
      if (!operation) continue;
      evidenceIds.push(operation.id);
      evidence.set(operation.id, {
        id: operation.id, origin: "source-code",
        locator: authoredSiteLocator(operation.source), scope: "selected-artifact",
        summary: "Parsed authored command scoreboard/tag " + operation.operation +
          " operation; gameplay phase, score meaning and runtime value remain unproven.",
      });
    }
    for (const edgeId of relation.executionEdgeIds ?? []) {
      const edge = input.semanticIr?.execution.edges.find(item =>
        item.id === edgeId &&
        item.kind === "synchronous-call" &&
        item.source.artifactId === relation.source.artifactId &&
        item.source.relativePath === relation.source.relativePath &&
        item.source.jsonPointer === relation.source.jsonPointer);
      if (!edge) continue;
      evidenceIds.push(edge.id);
      evidence.set(edge.id, {
        id: edge.id, origin: "source-code",
        locator: authoredSiteLocator(edge.source), scope: "selected-artifact",
        summary: "Exact authored command-to-function reference (" +
          edge.resolution +
          "); activation, conditions and downstream gameplay outcomes are unproven.",
      });
    }
    const owned = authoredByOwner.get(relation.ownerId) ?? [];
    owned.push(...evidenceIds);
    authoredByOwner.set(relation.ownerId, owned);
    if (relation.kind === "dialogue-button-command" &&
        relation.resolution === "EXACT_REFERENCE" &&
        relation.interactionLabel?.trim() &&
        relation.targetSource?.jsonPointer &&
        relation.targetSource.artifactId === relation.source.artifactId &&
        relation.targetSource.relativePath === relation.source.relativePath &&
        relation.targetSource.jsonPointer !== relation.source.jsonPointer) {
      // This is the ONLY UI evidence in the exact label -> command relation.
      // Both sites belong to the same button, but the source relation does
      // not establish that the UI was opened or the command succeeded.
      const displayId = relation.id + ":display-text";
      evidence.set(displayId, {
        id: displayId, origin: "dialogue",
        locator: authoredSiteLocator(relation.targetSource),
        scope: "selected-artifact",
        summary: "Literal NPC button label: " + relation.interactionLabel.trim() +
          ". Same authored button contains a separate command, but UI presentation, design intent and player outcome remain unobserved.",
      });
      const existing = uiByOwner.get(relation.ownerId);
      if (existing && existing.label !== relation.interactionLabel.trim()) continue;
      const value = existing ?? {
        label: relation.interactionLabel.trim(), evidenceIds: new Set<string>(),
      };
      [...evidenceIds, displayId].forEach(id => value.evidenceIds.add(id));
      uiByOwner.set(relation.ownerId, value);
    }
  }
  for (const [ownerId, ui] of uiByOwner) {
    const id = "mechanic:dialogue-interaction:" + encodeURIComponent(ownerId);
    nodes.set(id, {
      id, kind: "mechanic",
      label: "NPC interaction: " + ui.label,
      status: "inferred",
      description: "NPC dialogue button with an authored command. This grounds an interaction surface, not its game-design purpose, availability or effect success.",
      evidenceIds: [...ui.evidenceIds].sort(),
    });
  }
  for (const [ownerId, evidenceIds] of authoredByOwner) {
    const uiId = "mechanic:dialogue-interaction:" + encodeURIComponent(ownerId);
    intentUnknowns.push({
      id: "unknown:authored-behavior:" + encodeURIComponent(ownerId),
      question: uiByOwner.has(ownerId)
        ? "NPC interaction is source-grounded, but gameplay objective, activation conditions and actual command outcome remain unverified."
        : "Authored entity/controller/dialogue/script references exist; their activation and gameplay meaning remain unclassified.",
      blockedSubjectIds: uiByOwner.has(ownerId) ? [uiId] : [],
      evidenceIds: [...new Set(evidenceIds)].sort(),
    });
  }

  // Reconcile observed material execution against recognized gameplay subjects.
  // A technical state/return/resource chain is not a named mechanic merely
  // because it exists. Keep unclassified behavior explicit without creating
  // phantom gameplay nodes or scenario seeds.
  if (input.semanticIr) {
    const material = new Map([
      ...input.semanticIr.state.operations.map(item => [item.id, item.source] as const),
      ...(input.semanticIr.state.resourceActions ?? []).map(item => [item.id, item.source] as const),
      ...(input.semanticIr.execution.outcomes ?? []).map(item => [item.id, item.source] as const),
      ...(input.semanticIr.execution.worldEffects ?? []).map(item => [item.id, item.source] as const),
    ]);
    const interpretedEvidenceIds = new Set([...nodes.values()]
      .filter(node => ["mechanic", "phase", "lifecycle", "objective", "outcome"].includes(node.kind))
      .flatMap(node => node.evidenceIds).concat(
        [...edges.values()].flatMap(edge => edge.evidenceIds),
      ));
    const observedExecution = semanticIrExecutionTraces(input.semanticIr);
    const byRegion = new Map<string, string[]>();
    for (const operation of input.semanticIr.state.operations) {
      // A clear/delete is just as material as a write for an unknown
      // mechanic. Reads alone never establish an authored state change.
      if (!["write", "clear", "delete"].includes(operation.operation)) continue;
      const ids = byRegion.get(operation.executionRegionId) ?? [];
      ids.push(operation.id);
      byRegion.set(operation.executionRegionId, ids);
    }
    for (const action of input.semanticIr.state.resourceActions ?? []) {
      const ids = byRegion.get(action.executionRegionId) ?? [];
      ids.push(action.id);
      byRegion.set(action.executionRegionId, ids);
    }
    for (const outcome of input.semanticIr.execution.outcomes ?? []) {
      const ids = byRegion.get(outcome.executionRegionId) ?? [];
      ids.push(outcome.id);
      byRegion.set(outcome.executionRegionId, ids);
    }
    for (const effect of input.semanticIr.execution.worldEffects ?? []) {
      const ids = byRegion.get(effect.executionRegionId) ?? [];
      ids.push(effect.id);
      byRegion.set(effect.executionRegionId, ids);
    }
    const candidates = [
      ...observedExecution.traces.map(trace => ({
        identity: trace.entryRegionId,
        ids: [
          ...trace.stateOperationIds.filter(id =>
            input.semanticIr!.state.operations.some(operation =>
              operation.id === id &&
              ["write", "clear", "delete"].includes(operation.operation))),
          ...trace.resourceActionIds,
          ...trace.returnOutcomeIds,
          ...(trace.worldEffectIds ?? []),
        ],
      })),
      ...observedExecution.regionsOutsideTraces.map(regionId => ({
        identity: regionId,
        ids: byRegion.get(regionId) ?? [],
      })),
    ];
    for (const candidate of candidates) {
      const observedIds = [...new Set(candidate.ids)]
        .filter(id => material.has(id)).sort();
      // Mixed flows must retain their still-uninterpreted effects even
      // when another operation in the same trace has a semantic owner.
      const exactIds = observedIds.filter(id => {
        if (interpretedEvidenceIds.has(id)) return false;
        const source = material.get(id)!;
        return input.artifactId === undefined ||
          source.artifactId === input.artifactId;
      });
      if (exactIds.length === 0) continue;
      for (const id of exactIds) {
        if (evidence.has(id)) continue;
        const source = material.get(id)!;
        evidence.set(id, {
          id, origin: "source-code",
          locator: sourceLocator(source),
          scope: "selected-artifact",
          summary: "Authored state, resource, return or Minecraft world-effect attempt has no interpreted gameplay owner; its player-facing meaning remains unknown.",
        });
      }
      intentUnknowns.push({
        id: "unknown:uninterpreted-execution:" + candidate.identity,
        question: "An observed source execution entry has material state, resource, return or world-effect evidence without a classified gameplay owner. Reconcile the linked technical effects with the intended mechanic and player-facing outcome; do not infer game rules from names or observed effects alone.",
        blockedSubjectIds: [],
        evidenceIds: exactIds,
        sourceEntryRegionId: candidate.identity,
      });
    }
  }

  // Source-content dependency belongs to the EXISTING Intent Graph. An
  // exact unique same-pack/module import and a source method-use site provide
  // a bounded "uses content" relationship. Neither proves that the method
  // executes, the content is selected, a round progresses, or a player scores.
  const ownedScripts = selectedScripts.map(item => item.parsed);
  const ownerPaths = new Map<string, ParsedScriptFile[]>();
  for (const script of ownedScripts) {
    const path = script.source.relativePath.replaceAll("\\", "/");
    ownerPaths.set(path, [...(ownerPaths.get(path) ?? []), script]);
  }

  // Authored content tree is source OWNERSHIP, not a runtime transition.
  // Reuse canonical Gameplay Intent subjects and explicit "owns" relations,
  // including scripts without a source-content reader or player-state method.
  // Never infer cross-pack/mode/locale joins from coincidentally equal names.
  const authoredContentId = (
    source: SourceRef, kind: string, sourceKey: string,
  ): string => kind + ":authored-source:" +
    encodeURIComponent(source.artifactId + ":" +
      source.relativePath + "#" + sourceKey);
  const addContentSubject = (
    source: SourceRef, kind: GameplayIntentNode["kind"],
    id: string, label: string, description: string,
  ): string | undefined => {
    if (input.artifactId !== undefined &&
        source.artifactId !== input.artifactId) return undefined;
    const evidenceId = "authored-content-evidence:" +
      encodeURIComponent(id + "#" + sourceLocator(source));
    evidence.set(evidenceId, {
      id: evidenceId, origin: "source-code", scope: "selected-artifact",
      locator: sourceLocator(source),
      summary: description + " Source-authored content only; gameplay " +
        "activation, completion and presentation are NOT OBSERVED.",
    });
    const existing = nodes.get(id);
    nodes.set(id, {
      id, kind, label, status: "inferred",
      evidenceIds: [...new Set([
        ...(existing?.evidenceIds ?? []), evidenceId,
      ])].sort(),
    });
    return evidenceId;
  };
  const linkAuthoredContent = (
    parentId: string, childId: string, evidenceIds: string[],
  ): void => {
    const id = "authored-content-owns:" +
      encodeURIComponent(parentId + "->" + childId);
    const existing = edges.get(id);
    edges.set(id, {
      id, from: parentId, to: childId, kind: "owns",
      status: "inferred",
      evidenceIds: [...new Set([
        ...(existing?.evidenceIds ?? []), ...evidenceIds,
      ])].sort(),
      description: "Literal nested source ownership only. Not gameplay " +
        "order, phase activation, player/arena scope, or runtime completion.",
    });
  };
  for (const script of ownedScripts) {
    const owner = script.source;
    const selected = (ref: SourceRef): boolean =>
      ref.artifactId === owner.artifactId &&
      ref.relativePath === owner.relativePath;
    for (const stage of script.waveConfigurations ?? []) {
      if (!selected(stage.source)) continue;
      const stageId = authoredContentId(owner,"resource",
        "config:" + stage.sourceCollection + ":" +
        sourceLocator(stage.source) + "#" + stage.id);
      const stageEvidence = addContentSubject(stage.source,"resource",
        stageId,(stage.sourceCollection === "stages" ? "Stage" : stage.sourceCollection === "levels" ? "Level" : "Round") + " " + stage.id + (stage.name ? " — " + stage.name : ""),
        "Direct " + stage.sourceCollection +
        " entry with authored stage ID " + stage.id + ".");
      if (!stageEvidence) continue;
      for (const wave of stage.waves) {
        if (!selected(wave.source)) continue;
        const waveId = authoredContentId(owner,"resource",
          "wave:" + sourceLocator(wave.source) + "#" + wave.number);
        const waveEvidence = addContentSubject(wave.source,"resource",
          waveId,"Wave " + wave.number,
          "Nested literal wave number " + wave.number +
          " of stage " + stage.id +
          "; recipe count " + wave.recipes.length +
          (wave.recipeListIncomplete ? " (incomplete)" : "") +
          (wave.delaySpawn === undefined ? "" :
            "; configured delay " + wave.delaySpawn) +
          (wave.nextWaveMinMob === undefined ? "" :
            "; configured next-wave threshold " + wave.nextWaveMinMob) + ".");
        if (!waveEvidence) continue;
        linkAuthoredContent(stageId,waveId,[stageEvidence,waveEvidence]);
        const maxRecipes = 128;
        for (const [i,recipe] of wave.recipes.slice(0,maxRecipes).entries()) {
          if (!selected(recipe.source)) continue;
          const recipeId = authoredContentId(owner,"resource",
            "spawn:" + sourceLocator(recipe.source) + "#" + i);
          const type = recipe.typeId ?? recipe.typeExpression ?? "UNKNOWN";
          const pos = recipe.coordinates
            ? [recipe.coordinates.x,recipe.coordinates.y,
              recipe.coordinates.z].join(" ")
            : recipe.coordinateExpression ?? "UNKNOWN";
          const recipeEvidence = addContentSubject(
            recipe.source,"resource",recipeId,
            "Spawn recipe " + (i+1) + ": " + type.slice(0,110),
            "Authored spawn recipe; identifier " + type.slice(0,160) +
              (recipe.typeExpression ? " (unresolved expression)" : "") +
              "; configured position " + pos.slice(0,160) +
              (recipe.coordinateExpression ? " (unresolved)" : "") +
              (recipe.event ? "; authored event " + recipe.event : "") +
              (recipe.tag ? "; authored tag " + recipe.tag : "") + ".");
          if (recipeEvidence)
            linkAuthoredContent(waveId,recipeId,[waveEvidence,recipeEvidence]);
        }
        // Wave-end commands are part of the authored wave contract, not
        // verified execution or completed progression. Their source sites
        // must remain distinct from spawn recipes and from state transitions.
        const maxEndCommands = 64;
        for (const [index, command] of
          wave.endCommands.slice(0,maxEndCommands).entries()) {
          if (!selected(command.source)) continue;
          const commandId = authoredContentId(owner,"resource",
            "wave-end:" + sourceLocator(command.source) + "#" + index);
          const commandEvidence = addContentSubject(
            command.source,"resource",commandId,
            "Wave-end command " + (index+1) + ": " +
              command.command.slice(0,110),
            "Source-authored wave end command: " +
              command.command.slice(0,180) +
              (command.delay === undefined ? "" :
                "; configured delay " + command.delay) +
              ". Command dispatch and resulting gameplay effects UNKNOWN.");
          if (commandEvidence) linkAuthoredContent(
            waveId,commandId,[waveEvidence,commandEvidence]);
        }
        if (wave.endCommandsIncomplete ||
            wave.endCommands.length > maxEndCommands) {
          intentUnknowns.push({
            id:"unknown:authored-wave-end-commands:"+
              encodeURIComponent(waveId),
            question:"Wave " + wave.number + " in stage " + stage.id +
              " has " + wave.endCommands.length +
              " recognized wave-end commands" +
              (wave.endCommandsIncomplete
                ? " and at least one unsupported command entry"
                : "") +
              ". Source command list or operator graph may be incomplete; " +
              "actual end-of-wave execution and its effects NOT PROVEN.",
            blockedSubjectIds:[waveId],
            evidenceIds:[waveEvidence],
          });
        }
        if (wave.recipes.length>maxRecipes) {
          intentUnknowns.push({
            id:"unknown:authored-content-truncation:"+
              encodeURIComponent(waveId),
            question: "Wave " + wave.number + " has " +
              wave.recipes.length + " authored recipes; only the first " +
              maxRecipes + " were projected into the navigation graph. " +
              "The original parsed script remains authoritative.",
            blockedSubjectIds:[waveId],evidenceIds:[waveEvidence],
          });
        }
      }
    }
    for (const entry of script.authoredGameplayCatalog ?? []) {
      if (!selected(entry.source)) continue;
      const id=authoredContentId(owner,"resource",
        "catalog:"+sourceLocator(entry.source)+"#"+entry.kind+
          ":"+entry.id);
      addContentSubject(entry.source,"resource",id,
        entry.kind + ": " + entry.name + (entry.number===undefined?"":" (#"+entry.number+")"),
        "Authored "+entry.kind+" catalog ID "+entry.id+
        ". No evidence this source entry is playable.");
    }
  }

  const resourceNodeId = (script: ParsedScriptFile, name: string) =>
    "resource:authored-content:" +
    encodeURIComponent(script.source.artifactId + ":" +
      script.source.relativePath + "#" + name);
  const contentByOwner = new Map<string, {
    readonly collection: NonNullable<ParsedScriptFile["authoredContentCollections"]>[number];
    readonly script: ParsedScriptFile;
    readonly nodeId: string;
    readonly evidenceId: string;
  }>();
  const ambiguousContentOwners = new Set<string>();
  for (const script of ownedScripts) {
    for (const collection of script.authoredContentCollections ?? []) {
      if (collection.source.artifactId !== script.source.artifactId ||
          collection.source.relativePath !== script.source.relativePath) continue;
      const nodeId = resourceNodeId(script, collection.name);
      const evidenceId = "source-content-definition:" +
        encodeURIComponent(nodeId);
      // Duplicate declared names must never silently pick a single owner.
      if (ambiguousContentOwners.has(nodeId)) continue;
      const prior = contentByOwner.get(nodeId);
      if (prior) {
        ambiguousContentOwners.add(nodeId);
        contentByOwner.delete(nodeId);
        nodes.delete(nodeId);
        evidence.delete(prior.evidenceId);
        continue;
      }
      contentByOwner.set(nodeId, {
        collection,script,nodeId,evidenceId,
      });
      evidence.set(evidenceId, {
        id: evidenceId,scope:"selected-artifact",origin:"source-code",
        locator: sourceLocator(collection.source),
        summary: "Source-authored categorized content collection. " +
          "Selection, intended mechanic and player delivery NOT OBSERVED.",
      });
      nodes.set(nodeId, {
        id: nodeId,kind:"resource",label:collection.name,
        status:"inferred",evidenceIds:[evidenceId],
      });
      const categories = new Map<string,string>();
      const maxChoices = 128;
      for (const [index,choice] of
        collection.entries.slice(0,maxChoices).entries()) {
        if (choice.source.artifactId !== script.source.artifactId ||
            choice.source.relativePath !== script.source.relativePath) continue;
        let categoryId=categories.get(choice.classification);
        if (!categoryId) {
          categoryId=authoredContentId(script.source,"resource",
            "category:"+nodeId+"#"+choice.classification);
          const catEvidence=addContentSubject(
            collection.source,"resource",categoryId,
            choice.classification,
            "Literal authored category "+choice.classification+
            " from collection "+collection.name+".");
          if (!catEvidence) continue;
          linkAuthoredContent(nodeId,categoryId,
            [evidenceId,catEvidence]);
          categories.set(choice.classification,categoryId);
        }
        const choiceId=authoredContentId(script.source,"resource",
          "choice:"+nodeId+"#"+sourceLocator(choice.source)+"#"+index);
        const choiceEvidence=addContentSubject(
          choice.source,"resource",choiceId,choice.text.slice(0,180),
          "Categorized authored content choice from "+collection.name+
          "; category "+choice.classification+".");
        const categoryNode=nodes.get(categoryId);
        if (choiceEvidence && categoryNode)
          linkAuthoredContent(categoryId,choiceId,[
            ...(categoryNode.evidenceIds ?? []),choiceEvidence,
          ]);
      }
      if (collection.entries.length>maxChoices) {
        intentUnknowns.push({
          id:"unknown:authored-content-truncation:"+
            encodeURIComponent(nodeId),
          question:collection.name+" has "+
            collection.entries.length+" source choices; "+
            "only the first "+maxChoices+
            " were materialized as navigable nodes.",
          blockedSubjectIds:[nodeId],evidenceIds:[evidenceId],
        });
      }
    }
  }
  const importedModules = resolveScriptImports(ownedScripts);
  for (const script of ownedScripts) {
    for (const use of script.authoredContentUses ?? []) {
      if (use.source.artifactId !== script.source.artifactId ||
          use.source.relativePath !== script.source.relativePath) continue;
      const matches = importedModules.filter(item =>
        item.status === "resolved" &&
        item.fromSourcePath === script.source.relativePath &&
        item.module === use.module &&
        item.targetSourcePath !== undefined);
      if (matches.length !== 1) continue;
      const resolution = matches[0]!;
      const providerPath = resolution.targetSourcePath!;
      if (ownerPaths.get(providerPath)?.length !== 1) continue;
      const provider = ownerPaths.get(providerPath)![0]!;
      if (provider.source.artifactId !== script.source.artifactId) continue;
      const definitionId = resourceNodeId(provider, use.importedName);
      const definition = contentByOwner.get(definitionId);
      if (!definition?.collection.exported ||
          definition.script !== provider ||
          !nodes.has(definitionId)) continue;
      const siteId = "source-content-site:" +
        encodeURIComponent(script.source.artifactId + ":" +
          sourceLocator(use.source) + "#" + use.localName + "." +
          use.method);
      const consumerId = "mechanic:source-content-consumer:" +
        encodeURIComponent(script.source.artifactId + ":" +
          script.source.relativePath + "#" + use.executionRegion);
      evidence.set(siteId, {
        id:siteId,scope:"selected-artifact",origin:"source-code",
        locator:sourceLocator(use.source),
        summary:"Exact static named ESM import and ." + use.method +
          " content access in " + use.executionRegion +
          ". No call reachability, phase or score effect proven.",
      });
      // Retain direct method-local assignments as context on the SAME
      // consumer node, without turning "source-after" into causal order.
      // The parser is responsible for exact AST assignment sites.
      const contextIds: string[] = [];
      for (const write of use.sourceContextWrites ?? []) {
        if (write.source.artifactId !== script.source.artifactId ||
            write.source.relativePath !== script.source.relativePath) continue;
        const writeId = "source-content-context:" +
          encodeURIComponent(consumerId + "#" +
            sourceLocator(write.source) + "#" + write.target);
        contextIds.push(writeId);
        evidence.set(writeId, {
          id:writeId,scope:"selected-artifact",origin:"source-code",
          locator:sourceLocator(write.source),
          summary:"Same-method source assignment (NOT CAUSAL): " +
            write.target + " " + write.operator + " " + write.expression +
            (write.branchConditions.length > 0
              ? "; lexical conditions: " +
                write.branchConditions.join(" AND ") : "") +
            ". Lexical source order does not prove branch reachability " +
            "or downstream runtime state.",
        });
        // Match only an existing Gameplay Intent state, and only through
        // the SAME exact mutation site. No second state model or alias guess.
        const matched = extracted.signals.filter(signal =>
          signal.nodeKind === "state" && nodes.has(signal.subjectKey) &&
          (signal.stateMutationOrigins ?? []).some(origin =>
            origin.scriptSource.artifactId === script.source.artifactId &&
            origin.scriptSource.relativePath === script.source.relativePath &&
            sameExactCallSource(origin.mutation.source, write.source)));
        if (matched.length !== 1) continue;
        const target = matched[0]!.subjectKey;
        const stateId = "source-content-state-context:" +
          encodeURIComponent(consumerId + "->" + target);
        const previous = edges.get(stateId);
        edges.set(stateId, {
          id:stateId,from:consumerId,to:target,
          kind:"participates-in",status:"inferred",
          evidenceIds: [...new Set([
            ...(previous?.evidenceIds ?? []),
            siteId,writeId,evidenceId(matched[0]!),
          ])].sort(),
          description:"Content reader and authored state write occur in the " +
            "same source method, with the assignment after the source read. " +
            "Conditional source-context association ONLY; not proof that " +
            "content selection causes the state write or a gameplay transition.",
        });
      }
      const existing = nodes.get(consumerId);
      nodes.set(consumerId, {
        id:consumerId,kind:"mechanic",
        label:use.executionRegion + " (source content reader)",
        status:"inferred",
        evidenceIds: [...new Set([
          ...(existing?.evidenceIds ?? []),siteId,...contextIds,
        ])].sort(),
      });
      const edgeId = "source-content-requires:" +
        encodeURIComponent(consumerId + "->" + definitionId);
      const prev = edges.get(edgeId);
      edges.set(edgeId, {
        id:edgeId,from:consumerId,to:definitionId,
        kind:"requires",status:"inferred",
        evidenceIds:[...new Set([
          ...(prev?.evidenceIds ?? []),siteId,definition.evidenceId,
        ])].sort(),
        description:"Exact selected-script import " +
          use.importedName + " and authored ." + use.method +
          " call in " + use.executionRegion +
          "; runtime invocation/selection and gameplay purpose unresolved.",
      });
    }
  }


  // The Semantic IR already owns exact local method calls. Preserve their
  // source-side topology in the EXISTING Gameplay Intent Graph when a selected
  // script has a proven content-reader anchor. Do not classify methods from
  // their names or manufacture a player journey from their call direction.
  for (const script of ownedScripts) {
    if (!input.semanticIr) break;
    const path = script.source.relativePath;
    const methodCounts = new Map<string,number>();
    for (const member of script.declaredMembers ?? []) {
      if (member.memberKind !== "method" ||
          member.source.artifactId !== script.source.artifactId ||
          member.source.relativePath !== path) continue;
      methodCounts.set(member.member,
        (methodCounts.get(member.member) ?? 0) + 1);
    }
    const methodRegion = (method: NonNullable<typeof script.sourceClassMethods>[number]): string | undefined =>
      sourceClassMethodRegion(method.className, method.methodName, method.source);
    const knownRegions = new Set((script.sourceClassMethods ?? [])
      .map(methodRegion).filter((region): region is string => region !== undefined));
    const uniqueMethod = (region: string): boolean =>
      knownRegions.has(region) ||
      (region.startsWith("function:") &&
       methodCounts.get(region.slice("function:".length)) === 1);
    const linkedContentRegions = new Map<string,string>();
    for (const use of script.authoredContentUses ?? []) {
      if (!use.executionRegion.startsWith("method:") ||
          use.source.artifactId !== script.source.artifactId ||
          use.source.relativePath !== path) continue;
      const methodName = use.executionRegion.slice("method:".length).split(".").at(-1);
      if (!methodName) continue;
      const declared = (script.sourceClassMethods ?? []).filter(method =>
        method.methodName === methodName &&
        use.executionRegion.includes("method:" + method.className + "."));
      if (declared.length !== 1) continue;
      const region = methodRegion(declared[0]!);
      if (!region || !uniqueMethod(region)) continue;
      const id = "mechanic:source-content-consumer:" +
        encodeURIComponent(script.source.artifactId + ":" +
          path + "#" + use.executionRegion);
      if (nodes.has(id)) linkedContentRegions.set(region,id);
    }
    const methodId = (region: string): string =>
      linkedContentRegions.get(region) ??
        "mechanic:source-method:" +
          encodeURIComponent(script.source.artifactId + ":" + path + "#" + region);
    const sourceCalls = (script.localFunctionCalls ?? [])
      .filter(call =>
        call.source.artifactId === script.source.artifactId &&
        call.source.relativePath === path &&
        uniqueMethod(call.callerRegion) &&
        uniqueMethod(call.targetRegion));
    // A game with no authored content pool still has meaningful phases.
    // Seed navigation from exact, literal source state writes in uniquely
    // owned methods (e.g. terminal/cleanup), not from English method names.
    const anchors = new Set<string>(linkedContentRegions.keys());
    for (const mutation of script.stateMutations ?? []) {
      if (mutation.source.artifactId === script.source.artifactId &&
          mutation.source.relativePath === path &&
          mutation.value.kind === "literal" &&
          uniqueMethod(mutation.executionRegion)) {
        anchors.add(mutation.executionRegion);
      }
    }
    if (anchors.size === 0) continue;
    // This is a bounded *source navigation neighborhood*, not a causal
    // player sequence. One/two-hop ancestors and callees allow the result
    // settlement chain to remain visible even when the map has no waves.
    const visibleRegions = new Set(anchors);
    for (let depth = 0; depth < 2; depth++) {
      const current = new Set(visibleRegions);
      for (const call of sourceCalls) {
        if (current.has(call.callerRegion)) visibleRegions.add(call.targetRegion);
        if (current.has(call.targetRegion)) visibleRegions.add(call.callerRegion);
      }
    }
    const relevantCalls = sourceCalls.filter(call =>
      visibleRegions.has(call.callerRegion) &&
      visibleRegions.has(call.targetRegion));
    // Retain only individually IR-backed, uniquely owned source sites.
    // Avoid discarding late-file terminal flows behind an arbitrary first
    // 80 calls. If even the bounded source navigation saturates, expose
    // that missing scope through the existing unknowns channel.
    const maxSourceCalls = 512;
    if (relevantCalls.length > maxSourceCalls) {
      intentUnknowns.push({
        id:"unknown:source-method-call-truncation:" +
          encodeURIComponent(script.source.artifactId + ":" + path),
        question:"Source method graph has " + relevantCalls.length +
          " relevant local calls; only " + maxSourceCalls +
          " were projected. Additional source calls remain available in " +
          "the canonical Semantic IR; full game design closure is blocked.",
        blockedSubjectIds:[],
      });
    }
    const acceptedRegions = new Set<string>();
    for (const call of relevantCalls.slice(0, maxSourceCalls)) {
      const matching = input.semanticIr.execution.edges.filter(edge =>
        edge.kind === "synchronous-call" &&
        edge.resolution === "resolved" &&
        edge.from === scriptRegionId(script.source,call.callerRegion) &&
        edge.to === scriptRegionId(script.source,call.targetRegion) &&
        edge.targetLabel === call.targetName &&
        sameExactCallSource(edge.source,call.source));
      if (matching.length !== 1) continue;
      const edge = matching[0]!;
      acceptedRegions.add(call.callerRegion);
      acceptedRegions.add(call.targetRegion);
      const from = methodId(call.callerRegion);
      const to = methodId(call.targetRegion);
      const conditions = [
        ...(call.lexicalGuards ?? []).map(g =>
          g.branch + ":" + g.conditionText),
        ...(call.precedenceGuards ?? []).map(g =>
          "preceding:" + g.branch + ":" + g.conditionText),
      ];
      const traceId = "source-method-site:" +
        encodeURIComponent(script.source.artifactId + ":" +
          sourceLocator(call.source) + "#" +
          call.callerRegion + "->" + call.targetRegion);
      evidence.set(traceId,{
        id:traceId,scope:"selected-artifact",origin:"source-code",
        locator:sourceLocator(call.source),
        summary:"Exact local call " + call.callerRegion +
          " -> " + call.targetRegion +
          "; source call control: " + (call.controlFlow ?? "unknown") +
          (conditions.length ? "; lexical guards: " +
            conditions.join(" AND ") : "") +
          ". Runtime execution, return policy, effects and play order UNKNOWN.",
      });
      evidence.set(edge.id,{
        id:edge.id,scope:"selected-artifact",origin:"source-code",
        locator:sourceLocator(edge.source),
        summary:"Canonical Semantic IR resolved synchronous local call. " +
          "Neither call reachability nor its gameplay purpose is established.",
      });
      const boundedRegions: [string, string][] = [[from, call.callerRegion], [to, call.targetRegion]];
      for (const [id,region] of boundedRegions) {
        const existing = nodes.get(id);
        nodes.set(id,{
          id,kind:"mechanic",
          label:existing?.label ??
            region + " (source method; gameplay purpose UNKNOWN)",
          status:"inferred",
          evidenceIds:[...new Set([
            ...(existing?.evidenceIds ?? []),traceId,edge.id,
          ])].sort(),
        });
      }
      const relationId = "source-method-call:" +
        encodeURIComponent(from + "->" + to);
      const prior = edges.get(relationId);
      edges.set(relationId,{
        id:relationId,from,to,kind:"requires",status:"inferred",
        evidenceIds:[...new Set([
          ...(prior?.evidenceIds ?? []),traceId,edge.id,
        ])].sort(),
        description:"Resolved same-source local method invocation " +
          "from the canonical Semantic IR. Source guard applies only to " +
          "the authored call site; no game-stage transition is asserted.",
      });
    }

    // The existing source-method graph also needs the ordinary JavaScript
    // property writes occurring in its owned methods. An authored update to
    // player.score is not necessarily the authoritative settled score, but
    // hiding the source mutation makes the player journey unusable.
    const methodRegions = acceptedRegions;
    const propertyCounts = new Map<string,number>();
    for (const mutation of script.authoredPropertyMutations ?? []) {
      if (!methodRegions.has(mutation.executionRegion) ||
          mutation.source.artifactId !== script.source.artifactId ||
          mutation.source.relativePath !== path) continue;
      const ownerId = methodId(mutation.executionRegion);
      const existing = nodes.get(ownerId);
      if (!existing) continue;
      const count = propertyCounts.get(ownerId) ?? 0;
      if (count >= 32) continue;
      propertyCounts.set(ownerId,count + 1);
      const siteId = "source-method-property-site:" +
        encodeURIComponent(ownerId + "#" + sourceLocator(mutation.source));
      const lexical = [
        ...(mutation.lexicalGuards ?? []).map(g =>
          g.branch + ":" + g.conditionText),
        ...(mutation.precedenceGuards ?? []).map(g =>
          "preceding:" + g.branch + ":" + g.conditionText),
      ];
      evidence.set(siteId,{
        id:siteId,origin:"source-code",scope:"selected-artifact",
        locator:sourceLocator(mutation.source),
        summary:"Authored JS property mutation in " +
          mutation.executionRegion + ": " +
          mutation.targetExpression + " " +
          mutation.operator + " " + mutation.valueExpression +
          (lexical.length ? "; source guards: " +
            lexical.join(" AND ") : "") +
          ". Source attempt only: not proof of authoritative scoring, " +
          "accepted action, committed result or Minecraft execution.",
      });
      nodes.set(ownerId,{
        ...existing,
        evidenceIds:[...new Set([...existing.evidenceIds,siteId])].sort(),
      });
    }

    // Another object may present the match result or write it to a store.
    // Without an exact receiver binding this is a SOURCE CALL SITE, never
    // an edge to a guessed implementation or proof of delivered feedback.
    const unresolvedCounts = new Map<string,number>();
    for (const call of script.unresolvedReceiverCalls ?? []) {
      if (!methodRegions.has(call.executionRegion) ||
          call.source.artifactId !== script.source.artifactId ||
          call.source.relativePath !== path) continue;
      const ownerId = methodId(call.executionRegion);
      const existing = nodes.get(ownerId);
      if (!existing) continue;
      const count = unresolvedCounts.get(ownerId) ?? 0;
      if (count >= 24) continue;
      unresolvedCounts.set(ownerId,count + 1);
      const evidenceId = "source-unresolved-receiver-site:" +
        encodeURIComponent(ownerId + "#" + sourceLocator(call.source));
      const conditions = [
        ...(call.lexicalGuards ?? []).map(g => g.branch + ":" + g.conditionText),
        ...(call.precedenceGuards ?? []).map(g =>
          "preceding:" + g.branch + ":" + g.conditionText),
      ];
      evidence.set(evidenceId,{
        id:evidenceId,origin:"source-code",scope:"selected-artifact",
        locator:sourceLocator(call.source),
        summary:"Authored receiver call " + call.receiverExpression +
          "." + call.method + "() in " + call.executionRegion +
          (conditions.length ? "; guards: " +
            conditions.join(" AND ") : "") +
          ". Receiver implementation, execution, presentation and " +
          "settlement effect NOT PROVEN.",
      });
      nodes.set(ownerId,{
        ...existing,
        evidenceIds:[...new Set([...existing.evidenceIds,evidenceId])].sort(),
      });
    }

    // Reuse the exact canonical state subject for a source method's literal
    // assignment. This is not an edge from a *previous* state, and does not
    // establish reachability, phase duration or runtime player ownership.
    for (const mutation of script.stateMutations ?? []) {
      if (!methodRegions.has(mutation.executionRegion) ||
          mutation.source.artifactId !== script.source.artifactId ||
          mutation.source.relativePath !== path) continue;
      const from = methodId(mutation.executionRegion);
      if (!nodes.has(from)) continue;
      const matches = extracted.signals.filter(signal =>
        signal.nodeKind === "state" &&
        nodes.has(signal.subjectKey) &&
        (signal.stateMutationOrigins ?? []).some(origin =>
          origin.scriptSource.artifactId === script.source.artifactId &&
          origin.scriptSource.relativePath === path &&
          sameExactCallSource(origin.mutation.source,mutation.source)));
      if (matches.length !== 1) continue;
      const subject = matches[0]!;
      const id = "source-method-state:" +
        encodeURIComponent(from + "->" + subject.subjectKey);
      const existing = edges.get(id);
      const sourceId = "source-method-state-site:" +
        encodeURIComponent(from + ":" + sourceLocator(mutation.source));
      evidence.set(sourceId,{
        id:sourceId,origin:"source-code",scope:"selected-artifact",
        locator:sourceLocator(mutation.source),
        summary:"Direct authored state assignment in " +
          mutation.executionRegion + " at " + mutation.target +
          " = " + (mutation.value.kind === "literal"
            ? mutation.value.literal : mutation.value.symbol) +
          ". The resulting player/arena phase and actual execution " +
          "remain unproven.",
      });
      edges.set(id,{
        id,from,to:subject.subjectKey,kind:"participates-in",
        status:"inferred",
        evidenceIds:[...new Set([
          ...(existing?.evidenceIds ?? []),
          sourceId,evidenceId(subject),
        ])].sort(),
        description:"Same unique source method directly assigns this " +
          "canonical state value; not proof of a completed gameplay transition.",
      });
    }
  }

  // Source Map ownership does not establish runtime session/arena identity.
  // Render exact same-class field initialization plus individually authored
  // .set/.get sites as dependencies on ONE existing Intent resource node.
  // Different key expressions never imply the same runtime key or owner.
  for(const script of ownedScripts){
    const collections=script.sourceClassMaps ?? [];
    for(const declared of collections){
      if(declared.source.artifactId!==script.source.artifactId ||
         declared.source.relativePath!==script.source.relativePath)continue;
      const accesses=(script.sourceClassMapAccesses ?? []).filter(item =>
        item.className===declared.className &&
        item.fieldName===declared.fieldName &&
        item.source.artifactId===script.source.artifactId &&
        item.source.relativePath===script.source.relativePath);
      // Ignore unrelated Maps unless the selected source visibly stores and
      // retrieves keyed values through the exact same owner field.
      if(!accesses.some(item=>item.operation==="set") ||
         !accesses.some(item=>item.operation==="get"))continue;
      const ownerId="resource:source-class-map:"+encodeURIComponent(
        script.source.artifactId+":"+script.source.relativePath+"#"+
        declared.className+"."+declared.fieldName);
      const definitionId="source-class-map-definition:"+
        encodeURIComponent(ownerId);
      evidence.set(definitionId,{
        id:definitionId,origin:"source-code",scope:"selected-artifact",
        locator:sourceLocator(declared.source),
        summary:"Direct source this."+declared.fieldName+
          " = new Map() field of "+declared.className+
          ". Key and stored object identity at runtime remain UNKNOWN.",
      });
      const allIds=[definitionId];
      const sourceMethodCounts=new Map<string,number>();
      for(const method of script.sourceClassMethods ?? []){
        if(method.className!==declared.className)continue;
        sourceMethodCounts.set(method.methodName,
          (sourceMethodCounts.get(method.methodName)??0)+1);
      }
      for(const access of accesses){
        const method = (script.sourceClassMethods ?? []).filter(m =>
          m.className === declared.className &&
          sourceClassMethodRegion(m.className, m.methodName, m.source) === access.executionRegion);
        if(method.length !== 1 ||
           sourceMethodCounts.get(method[0]!.methodName) !== 1) continue;
        const nodeId="mechanic:source-method:"+encodeURIComponent(
          script.source.artifactId+":"+script.source.relativePath+"#"+
          access.executionRegion);
        const siteId="source-class-map-access:"+encodeURIComponent(
          ownerId+"#"+sourceLocator(access.source)+"#"+access.operation);
        allIds.push(siteId);
        const creationCandidate=(script.importedThisConstructions ?? [])
          .filter(construct =>
            access.operation==="set" &&
            access.constructorSource!==undefined &&
            sameExactCallSource(construct.source,access.constructorSource!) &&
            importedModules.filter(route =>
              route.status==="resolved" &&
              route.fromSourcePath===script.source.relativePath &&
              route.module===construct.module &&
              route.targetSourcePath!==undefined &&
              (ownerPaths.get(route.targetSourcePath)?.length ?? 0)===1)
              .length===1);
        evidence.set(siteId,{
          id:siteId,origin:"source-code",scope:"selected-artifact",
          locator:sourceLocator(access.source),
          summary:"Source "+declared.className+".this."+
            declared.fieldName+"."+access.operation+
            "(key="+access.keyExpression+
            (access.valueExpression===undefined?"":", value="+
              access.valueExpression)+")"+
            (creationCandidate.length===1
              ? "; same-source constructed value from imported "+
                creationCandidate[0]!.importedName+
                " (constructor source candidate only)" : "")+
            ". Key equivalence, session/arena owner and runtime contents "+
            "NOT PROVEN.",
        });
        const old=nodes.get(nodeId);
        nodes.set(nodeId,{
          id:nodeId,kind:"mechanic",
          label:old?.label??access.executionRegion+
            " (source keyed collection access)",
          status:"inferred",
          evidenceIds:[...new Set([
            ...(old?.evidenceIds??[]),siteId,
          ])].sort(),
        });
        const edgeId="source-class-map-requires:"+encodeURIComponent(
          nodeId+"->"+ownerId);
        const prior=edges.get(edgeId);
        edges.set(edgeId,{
          id:edgeId,from:nodeId,to:ownerId,
          kind:"requires",status:"inferred",
          evidenceIds:[...new Set([
            ...(prior?.evidenceIds??[]),definitionId,siteId,
          ])].sort(),
          description:"The authored method accesses the same class Map "+
            "field. This does not prove that the stored and retrieved keys "+
            "or object instances are equal.",
        });
      }
      if(allIds.length===1)continue;
      nodes.set(ownerId,{
        id:ownerId,kind:"resource",
        label:declared.className+".this."+declared.fieldName+
          " (source keyed Map)",
        status:"inferred",evidenceIds:[...new Set(allIds)].sort(),
      });
      const writerKeys=new Set(accesses.filter(item=>
        item.operation==="set").map(item=>item.keyExpression));
      const readerKeys=new Set(accesses.filter(item=>
        item.operation==="get").map(item=>item.keyExpression));
      if(writerKeys.size>0 && readerKeys.size>0){
        intentUnknowns.push({
          id:"unknown:source-map-key-identity:"+
            encodeURIComponent(ownerId),
          question:"Selected source writes "+
            [...writerKeys].slice(0,6).join(" | ")+" and reads "+
            [...readerKeys].slice(0,6).join(" | ")+" in the same Map. "+
            "Matching the runtime key, stored class instance, owning "+
            "arena/session/player and post-reload identity requires "+
            "independent dataflow; source collection ownership alone "+
            "does NOT establish them.",
          blockedSubjectIds:[ownerId],
          evidenceIds:[...new Set(allIds)].sort(),
        });
      }
    }
  }

  // Candidate class receiver binding from a COMPLETE authored source witness:
  // new ImportedClass(this) → constructor this.field = argument →
  // this.field.method(this) → uniquely owned target method(parameter).
  // Propagate only direct stable parameter forwarding through exact IR-owned
  // this.method(parameter) call sites. This is a possible source instance
  // path, NOT universal runtime receiver identity or successful execution.
  type BoundReceiver = {
    readonly targetScript: ParsedScriptFile;
    readonly targetClass: string;
    readonly evidenceIds: readonly string[];
  };
  const methodFor = (script:ParsedScriptFile,className:string,name:string) => {
    const matches = (script.sourceClassMethods ?? []).filter(item =>
      item.className === className && item.methodName === name);
    return matches.length === 1 ? matches[0] : undefined;
  };
  const methodNames = (script:ParsedScriptFile,region:string) =>
    (script.sourceClassMethods ?? []).filter(m =>
      sourceClassMethodRegion(m.className, m.methodName, m.source) === region);
  const keyFor = (script:ParsedScriptFile, cls:string,method:string,index:number) =>
    [script.source.artifactId,script.source.relativePath,cls,method,index].join("\u0000");
  const bindings = new Map<string,BoundReceiver>();
  const ambiguous = new Set<string>();
  const sourceWitness = (kind:string,ref:SourceRef,reason:string):string => {
    const id=kind+":"+encodeURIComponent(ref.artifactId+":"+
      sourceLocator(ref));
    evidence.set(id,{
      id,origin:"source-code",scope:"selected-artifact",
      locator:sourceLocator(ref),summary:reason,
    });
    return id;
  };
  const addBinding = (key:string,binding:BoundReceiver) => {
    if (ambiguous.has(key)) return;
    const previous = bindings.get(key);
    if (!previous) { bindings.set(key,binding); return; }
    if (previous.targetScript !== binding.targetScript ||
        previous.targetClass !== binding.targetClass) {
      ambiguous.add(key);
      bindings.delete(key);
      return;
    }
    bindings.set(key,{
      ...previous,
      evidenceIds:[...new Set([
        ...previous.evidenceIds,...binding.evidenceIds,
      ])].sort(),
    });
  };
  const constructions = ownedScripts.flatMap(script =>
    (script.importedThisConstructions ?? []).map(item => ({script,item})));
  for (const {script:owner,item:construct} of constructions) {
    if (construct.source.artifactId !== owner.source.artifactId ||
        construct.source.relativePath !== owner.source.relativePath) continue;
    // Imported symbol resolution must be unique in this selected source.
    const routes = importedModules.filter(r =>
      r.fromSourcePath === owner.source.relativePath &&
      r.module === construct.module && r.status === "resolved" &&
      r.targetSourcePath !== undefined);
    if (routes.length !== 1) continue;
    const targetFiles=ownerPaths.get(routes[0]!.targetSourcePath!) ?? [];
    if (targetFiles.length !== 1) continue;
    const created=targetFiles[0]!;
    if (created.source.artifactId !== owner.source.artifactId) continue;
    const exported=(created.sourceClassMethods ?? []).some(m =>
      m.className === construct.importedName && m.exported);
    if (!exported) continue;
    const fieldBindings=(created.constructorFieldBindings ?? []).filter(b =>
      b.className === construct.importedName &&
      b.parameterIndex === construct.thisArgumentIndex);
    if (fieldBindings.length !== 1) continue;
    const stored=fieldBindings[0]!;
    for (const dispatch of created.thisInstanceDispatches ?? []) {
      if (dispatch.className !== construct.importedName ||
          dispatch.fieldName !== stored.fieldName) continue;
      const receiving=methodFor(owner,construct.ownerClass,dispatch.methodName);
      if (!receiving || !receiving.stableParameterIndices.includes(
        dispatch.thisArgumentIndex)) continue;
      const sourceIds=[
        sourceWitness("source-instance-construct",construct.source,
          "Selected-source imported-class construction with direct this argument; not a runtime singleton."),
        sourceWitness("source-instance-field",stored.source,
          "Constructor stores its exact service parameter in a direct this.field assignment."),
        sourceWitness("source-instance-forward",dispatch.source,
          "Constructed class forwards this into a method through the stored receiver field."),
      ];
      addBinding(keyFor(owner,construct.ownerClass,
        dispatch.methodName,dispatch.thisArgumentIndex),{
        targetScript:created,targetClass:construct.importedName,
        evidenceIds:sourceIds,
      });
    }
  }
  // Same-class direct-parameter forwarding, bounded depth. The first
  // source link is anchored by construction; later calls must match the
  // SAME exact resolved IR call edge and stable formal parameter source.
  for (let depth=0;depth<3;depth++) {
    let changed=false;
    for (const script of ownedScripts) {
      for (const call of script.localFunctionCalls ?? []) {
        if (!call.callerRegion.startsWith("function:") ||
            !call.targetRegion.startsWith("function:")) continue;
        const callers=methodNames(script,call.callerRegion);
        const targets=methodNames(script,call.targetRegion);
        if (callers.length!==1 || targets.length!==1 ||
            callers[0]!.className!==targets[0]!.className) continue;
        const caller=callers[0]!,target=targets[0]!;
        const proof=input.semanticIr?.execution.edges.filter(edge =>
          edge.resolution==="resolved" && edge.kind==="synchronous-call" &&
          edge.from===scriptRegionId(script.source,call.callerRegion) &&
          edge.to===scriptRegionId(script.source,call.targetRegion) &&
          sameExactCallSource(edge.source,call.source)) ?? [];
        if (proof.length!==1) continue;
        for(let i=0;i<(call.argumentExpressions ?? []).length;i++){
          const arg=call.argumentExpressions![i]!;
          const param=caller.parameterNames.indexOf(arg);
          if(param<0 || !/^[A-Za-z_$][\w$]*$/.test(arg) ||
             !caller.stableParameterIndices.includes(param) ||
             !target.stableParameterIndices.includes(i)) continue;
          const existing=bindings.get(keyFor(script,caller.className,
            caller.methodName,param));
          if(!existing)continue;
          const key=keyFor(script,target.className,target.methodName,i);
          const before=bindings.get(key);
          addBinding(key,{
            ...existing,evidenceIds:[...new Set([
              ...existing.evidenceIds,
              sourceWitness("source-instance-local-forward",call.source,
                "Exact same-class call forwards a stable method parameter into the callee."),
            ])],
          });
          if(!before && bindings.has(key)) changed=true;
        }
      }
    }
    if(!changed)break;
  }
  for(const script of ownedScripts){
    for(const site of script.unresolvedReceiverCalls ?? []){
      if(!/^[A-Za-z_$][\w$]*$/.test(site.receiverExpression) ||
         !site.executionRegion.startsWith("function:"))continue;
      const owners=methodNames(script,site.executionRegion);
      if(owners.length!==1)continue;
      const owner=owners[0]!;
      const index=owner.parameterNames.indexOf(site.receiverExpression);
      if(index<0 || !owner.stableParameterIndices.includes(index))continue;
      const receiver=bindings.get(keyFor(script,owner.className,
        owner.methodName,index));
      if(!receiver)continue;
      const target=methodFor(receiver.targetScript,
        receiver.targetClass,site.method);
      if(!target)continue;
      const sourceId="mechanic:source-method:"+
        encodeURIComponent(script.source.artifactId+":"+
          script.source.relativePath+"#"+site.executionRegion);
      if(!nodes.has(sourceId))continue;
      const targetRegion = sourceClassMethodRegion(target.className,
        target.methodName, target.source);
      if (!targetRegion) continue;
      const targetId="mechanic:source-method:"+
        encodeURIComponent(receiver.targetScript.source.artifactId+":"+
          receiver.targetScript.source.relativePath+"#"+targetRegion);
      const siteId=sourceWitness("source-instance-receiver-call",site.source,
        "Authored call on an exactly forwarded formal parameter; instance origin is a source candidate, not universal runtime identity.");
      const targetIdEvidence=sourceWitness(
        "source-instance-target-declaration",target.source,
        "Uniquely declared source class method; does not prove dynamic invocation.");
      if(!nodes.has(targetId))nodes.set(targetId,{
        id:targetId,kind:"mechanic",
        label:targetRegion+" (source method; gameplay purpose UNKNOWN)",
        status:"inferred",evidenceIds:[targetIdEvidence],
      });
      const edgeId="source-instance-candidate:"+
        encodeURIComponent(sourceId+"->"+targetId);
      const prev=edges.get(edgeId);
      edges.set(edgeId,{
        id:edgeId,from:sourceId,to:targetId,kind:"requires",
        status:"inferred",
        evidenceIds:[...new Set([
          ...(prev?.evidenceIds??[]),
          ...receiver.evidenceIds,siteId,targetIdEvidence,
        ])].sort(),
        description:"Candidate receiver source chain from explicit imported " +
          "construction, constructor-field binding, this-argument forwarding "+
          "and unique method declaration. Not universal instance identity "+
          "or successful call/result delivery.",
      });
    }
  }

  const model: GameplayIntentModel = {
    schemaVersion: 1,
    id: input.id,
    ...(input.artifactId === undefined
      ? {}
      : { artifactId: input.artifactId }),
    evidence: [...evidence.values()].sort(
      (a, b) => a.id.localeCompare(b.id),
    ),
    nodes: [...nodes.values()].sort(
      (a, b) => a.id.localeCompare(b.id),
    ),
    edges: [...edges.values()].sort(
      (a, b) => a.id.localeCompare(b.id),
    ),
    invariants: [...invariants.values()].sort(
      (a, b) => a.id.localeCompare(b.id),
    ),
    unknowns: [
      ...(nodes.size === 0
        ? [{
            id: "unknown:no-intent-signals",
            question:
              "No gameplay-intent signal could be grounded from the available selected-artifact evidence.",
            blockedSubjectIds: [] as readonly string[],
          }]
        : []),
      ...intentUnknowns,
    ],
  };

  const errors = validateGameplayIntentModel(model);
  if (errors.length > 0) {
    throw new Error(
      "Gameplay Intent Model failed validation: " +
        errors
          .map((error) => error.path + ": " + error.message)
          .join("; "),
    );
  }

  return model;
}
