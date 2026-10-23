import {
  analyzeCommand,
  flattenCommandEffects,
  scoreboardAccesses,
  tagAccesses,
} from "../../../../analyzers/commands/src/index.js";
import type { ParsedFunction } from "../../../../analyzers/functions/src/index.js";
import { resolveScriptImports } from "../../../../analyzers/scripts/src/index.js";
import type {
  ParsedScriptFile,
  CrossFileCallEdge,
  ScriptImportResolution,
} from "../../../../analyzers/scripts/src/index.js";
import {
  stateSurfaceKey,
  type SourceRef,
  type StateAuthorityContract,
  type StateSurfaceRef,
} from "../../../project-model/src/index.js";
import {
  validateSemanticIr,
  type ExecutionEdge,
  type AuthoredBehaviorRelation,
  type AuthoredBranchGuard,
  type AuthoredReturnOutcome,
  type AuthoredWorldEffect,
  type AuthoredScriptApiCall,
  type AuthoredScriptApiPropertyRead,
  type AuthoredResourceAction,
  type ExecutionRegion,
  type ExecutionRegionKind,
  type SemanticIr,
  type StateOperation,
  type StateOperationKind,
  type AuthoredStateTransitionDeclaration,
  type AuthoredGenerationInvalidation,
  type StateSurface,
  type TemporalRelation,
  type SourceControlFlowRegion,
} from "../../../semantic-ir/src/index.js";

export interface InspectionSemanticIrInput {
  parsedFunctions: readonly {
    parsed: ParsedFunction;
  }[];
  parsedScripts: readonly {
    parsed: ParsedScriptFile;
  }[];
  authoredBehaviorRelations?: readonly AuthoredBehaviorRelation[];
  /** Bound by the existing cross-file call analyzer from the same selected source. */
  crossFileCallEdges?: readonly CrossFileCallEdge[];
  /** Source-only manifest-root scope; absence means entry identity unknown. */
  manifestScriptRoots?: SemanticIr["execution"]["manifestScriptRoots"];
  /** Same resolver result already consumed by the source import graph. */
  resolvedScriptImports?: readonly ScriptImportResolution[];
  tickFunctionRegistrations?: readonly {
    source: SourceRef;
    functions: readonly string[];
  }[];
  stateAuthorityContracts?: readonly StateAuthorityContract[];
}

function token(value: string): string {
  return encodeURIComponent(value);
}

function sourceToken(source: SourceRef): string {
  const range = source.range;
  return [
    token(source.relativePath),
    range?.lineStart ?? 0,
    range?.columnStart ?? 0,
    range?.lineEnd ?? 0,
    range?.columnEnd ?? 0,
    ...(source.jsonPointer === undefined ? [] : [token(source.jsonPointer)]),
  ].join(":");
}

export function scriptRegionId(source: SourceRef, region: string): string {
  return "exec:script:" + token(source.relativePath) + ":" + token(region);
}

function functionSourceRegionId(source: SourceRef): string {
  return "exec:mcfunction-source:" + token(source.relativePath);
}

export function eventRegionId(
  root: string,
  phase: string,
  event: string,
  source: SourceRef,
): string {
  return "exec:event:" + sourceToken(source) + ":" + token(root + "." + phase + "." + event);
}

function stateId(ref: StateSurfaceRef): string {
  return "state:" + token(stateSurfaceKey(ref));
}

function regionKind(region: string): ExecutionRegionKind {
  if (region === "module") return "script-module";
  if (region.startsWith("function:")) return "script-function";
  return "script-callback";
}

function operationFromDynamicProperty(
  operation: ParsedScriptFile["dynamicProperties"][number]["operation"],
): StateOperationKind | undefined {
  switch (operation) {
    case "get":
      return "read";
    case "set":
      return "write";
    case "delete":
      return "delete";
    case "clear":
      return "clear";
    case "ids":
      return "enumerate";
    case "size":
      return "size";
    case "unknown":
      return undefined;
  }
}

function temporalKind(
  edge: ExecutionEdge,
): TemporalRelation["kind"] {
  if (edge.kind === "synchronous-call") return "same-turn";
  if (edge.kind === "event-dispatch") return "event-dispatch";
  if (edge.kind === "periodic") return "periodic";
  return "deferred";
}

export function buildInspectionSemanticIr(
  input: InspectionSemanticIrInput,
): SemanticIr {
  const regions = new Map<string, ExecutionRegion>();
  const edges = new Map<string, ExecutionEdge>();
  const surfaces = new Map<string, StateSurface>();
  const operations = new Map<string, StateOperation>();
  const transitionDeclarations = new Map<string, AuthoredStateTransitionDeclaration>();
  const generationInvalidations = new Map<string, AuthoredGenerationInvalidation>();
  const outcomes = new Map<string, AuthoredReturnOutcome>();
  const resourceActions = new Map<string, AuthoredResourceAction>();
  const worldEffects = new Map<string, AuthoredWorldEffect>();
  const apiCalls = new Map<string, AuthoredScriptApiCall>();
  const apiPropertyReads = new Map<string, AuthoredScriptApiPropertyRead>();
  const sourceControlFlow = new Map<string, SourceControlFlowRegion>();
  const ambiguousControlRegions = new Set<string>();
  const worldEffectCounts = new Map<string, number>();
  const addWorldEffect = (effect: Omit<AuthoredWorldEffect, "id">): void => {
    const base = ["world-effect", token(effect.executionRegionId), effect.kind,
      sourceToken(effect.source), token(effect.targetLabel)].join(":");
    const count = worldEffectCounts.get(base) ?? 0;
    worldEffectCounts.set(base, count + 1);
    worldEffects.set(base + ":" + count, { ...effect, id: base + ":" + count });
  };
  // Use the canonical command analyzer; never reparse or guess command effects.
  const addCommandWorldEffects = (
    commandEffects: ReturnType<typeof flattenCommandEffects>,
    executionRegionId: string,
    mechanism: AuthoredWorldEffect["mechanism"],
    lexicalGuards?: readonly AuthoredBranchGuard[],
    precedenceGuards?: readonly AuthoredBranchGuard[],
    authoredTimingSeconds?: number,
  ): void => {
    for (const effect of commandEffects) {
      let kind: AuthoredWorldEffect["kind"] | undefined;
      let targetLabel: string | undefined;
      switch (effect.kind) {
        case "entity-spawn":
          kind = "entity-spawn"; targetLabel = effect.entityIdentifier; break;
        case "teleport":
          kind = "teleport"; targetLabel = effect.target; break;
        case "fill":
        case "setblock":
          kind = "block-mutation"; targetLabel = effect.block; break;
        case "clone":
          kind = "block-mutation"; targetLabel = "clone"; break;
        case "structure-load":
          kind = "structure-load"; targetLabel = effect.target; break;
        case "dialogue":
          kind = "dialogue";
          targetLabel = effect.operation + ":" + effect.npcTarget; break;
        case "entity-event-trigger":
          kind = "entity-event"; targetLabel = effect.event; break;
      }
      if (kind === undefined || targetLabel === undefined) continue;
      addWorldEffect({
        kind, targetLabel, executionRegionId, mechanism,
        precision: "parsed-command", source: effect.source,
        ...(authoredTimingSeconds === undefined ? {} : { authoredTimingSeconds }),
        ...(lexicalGuards?.length ? { lexicalGuards } : {}),
        ...(precedenceGuards?.length ? { precedenceGuards } : {}),
      });
    }
  };

  const ensureRegion = (region: ExecutionRegion): void => {
    const existing = regions.get(region.id);
    if (existing) return;
    regions.set(region.id, region);
  };

  const ensureScriptRegion = (
    script: ParsedScriptFile,
    region: string,
    source: SourceRef = script.source,
  ): string => {
    const id = scriptRegionId(script.source, region);
    ensureRegion({
      id,
      kind: regionKind(region),
      ownerId: script.identifier,
      label: region,
      source,
    });
    return id;
  };

  const ensureSurface = (ref: StateSurfaceRef): string => {
    const id = stateId(ref);
    if (!surfaces.has(id)) surfaces.set(id, { id, ref });
    return id;
  };

  const irGuards = (guards?: readonly {
    conditionText: string;
    branch: "true" | "false";
    source: SourceRef;
  }[]): readonly AuthoredBranchGuard[] | undefined =>
    guards?.length ? guards.map(guard => ({
      expression: guard.conditionText,
      branch: guard.branch,
      source: guard.source,
    })) : undefined;

  /** Convert once, then omit absent guards instead of emitting undefined. */
  const irGuardEvidence = (
    lexical?: Parameters<typeof irGuards>[0],
    precedence?: Parameters<typeof irGuards>[0],
  ) => {
    const lexicalGuards = irGuards(lexical);
    const precedenceGuards = irGuards(precedence);
    return {
      ...(lexicalGuards === undefined ? {} : { lexicalGuards }),
      ...(precedenceGuards === undefined ? {} : { precedenceGuards }),
    };
  };

  const addStateOperation = (
    executionRegionId: string,
    ref: StateSurfaceRef,
    operation: StateOperationKind,
    source: SourceRef,
    targetHint?: string,
    writtenValue?: StateOperation["writtenValue"],
    lexicalGuards?: readonly AuthoredBranchGuard[],
    precedenceGuards?: readonly AuthoredBranchGuard[],
    readComparison?: StateOperation["readComparison"],
    sourceSequence?: StateOperation["sourceSequence"],
  ): void => {
    const surfaceId = ensureSurface(ref);
    const id = [
      "state-op",
      token(executionRegionId),
      token(surfaceId),
      operation,
      sourceToken(source),
    ].join(":");
    operations.set(id, {
      id,
      executionRegionId,
      surfaceId,
      operation,
      source,
      ...(targetHint === undefined ? {} : { targetHint }),
      ...(writtenValue === undefined ? {} : { writtenValue }),
      ...(readComparison === undefined ? {} : { readComparison }),
      ...(sourceSequence === undefined ? {} : { sourceSequence }),
      ...(lexicalGuards === undefined ? {} : { lexicalGuards }),
      ...(precedenceGuards === undefined ? {} : { precedenceGuards }),
    });
  };

  const addEdge = (
    edge: Omit<ExecutionEdge, "id">,
    occurrence?: number,
  ): string => {
    const id = [
      "exec-edge",
      token(edge.from),
      edge.kind,
      token(edge.targetLabel),
      sourceToken(edge.source),
      ...(occurrence === undefined ? [] : [String(occurrence)]),
    ].join(":");
    edges.set(id, { ...edge, id });
    return id;
  };

  // Source identity and command identifier are separate: multiple packs may
  // contain the same function name, which is not proof of one runtime target.
  const functionTargets = new Map<string, string[]>();
  for (const { parsed } of input.parsedFunctions) {
    const id = functionSourceRegionId(parsed.source);
    ensureRegion({
      id,
      kind: "mcfunction",
      ownerId: parsed.identifier,
      label: parsed.identifier,
      source: parsed.source,
    });
    functionTargets.set(parsed.identifier, [
      ...(functionTargets.get(parsed.identifier) ?? []), id,
    ]);
  }
  const resolveFunction = (identifier: string): string | undefined => {
    const candidates = functionTargets.get(identifier) ?? [];
    return candidates.length === 1 ? candidates[0] : undefined;
  };

  // Register vanilla tick roots as periodic execution evidence, not
  // proof that the referenced gameplay completed or even ran.
  for (const registration of input.tickFunctionRegistrations ?? []) {
    const from = "exec:tick:" + token(registration.source.relativePath);
    ensureRegion({
      id: from,
      kind: "event-source",
      ownerId: registration.source.relativePath,
      label: "functions/tick.json",
      source: registration.source,
    });
    for (const [index, targetLabel] of registration.functions.entries()) {
      const targetId = resolveFunction(targetLabel);
      const resolved = targetId !== undefined;
      addEdge({
        from,
        kind: "periodic",
        targetLabel,
        resolution: resolved ? "resolved" : "unresolved",
        ...(targetId !== undefined ? { to: targetId } : {}),
        source: registration.source,
      }, index);
    }
  }

  for (const { parsed } of input.parsedFunctions) {
    const from = functionSourceRegionId(parsed.source);

    for (const ref of parsed.references) {
      if (ref.kind !== "function") continue;
      const targetId = resolveFunction(ref.target);
      const resolved = targetId !== undefined;
      addEdge({
        from,
        kind: "synchronous-call",
        targetLabel: ref.target,
        resolution: resolved ? "resolved" : "unresolved",
        ...(targetId !== undefined ? { to: targetId } : {}),
        source: ref.source,
      });
    }

    for (const command of parsed.commands) {
      const effects = flattenCommandEffects(command.analysis);
      addCommandWorldEffects(effects, from, "mcfunction-command");
      for (const access of scoreboardAccesses(effects)) {
        addStateOperation(
          from,
          { kind: "scoreboard", key: access.objective },
          access.access,
          access.source ?? command.source,
          access.target,
        );
      }
      for (const access of tagAccesses(effects)) {
        addStateOperation(
          from,
          { kind: "tag", key: access.tag },
          access.access,
          access.source ?? command.source,
          access.target,
        );
      }
    }
  }

  for (const { parsed } of input.parsedScripts) {
    for (const flow of parsed.controlFlowRegions ?? []) {
      const executionRegionId = scriptRegionId(parsed.source, flow.region);
      if (sourceControlFlow.has(executionRegionId)) {
        ambiguousControlRegions.add(executionRegionId);
        continue;
      }
      sourceControlFlow.set(executionRegionId, {
        executionRegionId, entryId: flow.entryId,
        nodes: flow.nodes, edges: flow.edges,
      });
    }
    ensureScriptRegion(parsed, "module");

    const regionSources = new Map<string, SourceRef>();
    for (const call of parsed.localFunctionCalls) {
      regionSources.set(call.callerRegion, call.source);
      // An invocation does not define the target method's location.
      // Exact target sites, if available, are reconciled after all region
      // evidence so ordinary method/API records cannot override them.
      if (!regionSources.has(call.targetRegion)) {
        regionSources.set(call.targetRegion, call.source);
      }
    }
    for (const access of parsed.dynamicProperties) {
      if (access.executionRegion) {
        regionSources.set(access.executionRegion, access.source);
      }
    }
    for (const invalidation of parsed.arenaAuthorityEvidence ?? []) {
      if (invalidation.kind === "generation-invalidate") {
        regionSources.set(invalidation.executionRegion, invalidation.source);
      }
    }
    for (const command of parsed.commandLiterals) {
      if (command.executionRegion) {
        regionSources.set(command.executionRegion, command.source);
      }
    }
    for (const call of parsed.methodCalls) {
      if (call.executionRegion) {
        regionSources.set(call.executionRegion, call.source);
      }
    }
    for (const callback of parsed.deferredCallbacks) {
      if (callback.callerRegion) {
        regionSources.set(callback.callerRegion, callback.source);
      }
      if (callback.callbackRegion && callback.callbackSource) {
        regionSources.set(callback.callbackRegion, callback.callbackSource);
      }
    }
    for (const event of parsed.events) {
      if (event.executionRegion) {
        regionSources.set(event.executionRegion, event.source);
      }
      if (event.callbackRegion && event.callbackSource) {
        regionSources.set(event.callbackRegion, event.callbackSource);
      }
    }

    for (const call of parsed.localFunctionCalls) {
      if (call.targetSource !== undefined &&
          call.targetSource.artifactId === parsed.source.artifactId &&
          call.targetSource.relativePath === parsed.source.relativePath) {
        regionSources.set(call.targetRegion, call.targetSource);
      }
    }

    for (const [region, source] of regionSources) {
      ensureScriptRegion(parsed, region, source);
    }

    for (const call of parsed.localFunctionCalls) {
      const from = ensureScriptRegion(
        parsed,
        call.callerRegion,
        call.source,
      );
      const to = ensureScriptRegion(
        parsed,
        call.targetRegion,
        call.targetSource ?? call.source,
      );
      addEdge({
        from,
        to,
        kind: "synchronous-call",
        targetLabel: call.targetName,
        resolution: "resolved",
        source: call.source,
        ...(call.controlFlow === undefined ? {} : { controlFlow: call.controlFlow }),
        ...(call.sourceSequence === undefined ? {} : { sourceSequence: call.sourceSequence }),
        ...irGuardEvidence(call.lexicalGuards, call.precedenceGuards),
      });
    }

    for (const event of parsed.events) {
      const eventId = eventRegionId(
        event.root,
        event.phase,
        event.event,
        event.source,
      );
      ensureRegion({
        id: eventId,
        kind: "event-source",
        ownerId: event.root,
        label: event.root + "." + event.phase + "." + event.event,
        source: event.source,
      });

      const to = event.callbackRegion
        ? ensureScriptRegion(
            parsed,
            event.callbackRegion,
            event.callbackSource ?? event.source,
          )
        : undefined;
      addEdge({
        from: eventId,
        kind: "event-dispatch",
        targetLabel:
          parsed.identifier + ":" +
          (event.callbackRegion ?? "unresolved-subscription-callback"),
        resolution: to ? "resolved" : "unresolved",
        ...(to ? { to } : {}),
        source: event.source,
      });
    }

    for (const callback of parsed.deferredCallbacks) {
      const from = ensureScriptRegion(
        parsed,
        callback.callerRegion ?? "module",
        callback.source,
      );
      const to = callback.callbackRegion
        ? ensureScriptRegion(
            parsed,
            callback.callbackRegion,
            callback.callbackSource ?? callback.source,
          )
        : undefined;
      addEdge({
        from,
        kind:
          callback.scheduler === "runInterval"
            ? "periodic"
            : "deferred",
        targetLabel:
          callback.callbackRegion ??
          callback.scheduler + ":unresolved-callback",
        resolution: to ? "resolved" : "unresolved",
        ...(to ? { to } : {}),
        source: callback.source,
        scheduler: callback.scheduler,
        guardEvidence: callback.guardEvidence,
        guardIdentifiers: callback.guardIdentifiers,
        ...(callback.generationGuardSource === undefined ? {} : {
          generationGuardSource: callback.generationGuardSource,
        }),
        ...(callback.generationGuardOperands === undefined ? {} : {
          generationGuardOperands: callback.generationGuardOperands,
        }),
      });
    }

    // Project only parser-confirmed lifecycle/teleport API call sites.
    // Do not infer receiver type from method spelling or imported aliases.
    // Calls represent authored attempts, never actual removal or arrival.
    for (const call of parsed.methodCalls) {
      const entityLifecycle =
        (call.receiverType === "Entity" || call.receiverType === "Player") &&
        (call.method === "kill" || call.method === "remove" ||
         call.method === "teleport");
      const playerFeedback =
        (call.receiverType === "Player" || call.receiverType === "World") &&
        call.method === "sendMessage";
      const displayFeedback = call.receiverType === "ScreenDisplay" &&
        (call.method === "setActionBar" || call.method === "setTitle" ||
         call.method === "setHudVisibility");
      const cameraPresentation = call.receiverType === "Camera" &&
        (call.method === "setCamera" || call.method === "clear");
      // Only source-typed API queries inform profiling questions.
      // They never establish frequency, workload size or actual lag.
      const profilingQuery =
        (call.receiverType === "World" && call.method === "getAllPlayers") ||
        (call.receiverType === "Dimension" && call.method === "getEntities");
      const formClosing = call.receiverType === "UIManager" &&
        call.method === "closeAllForms";
      const formPresentation =
        (call.receiverType === "ActionFormData" ||
         call.receiverType === "ModalFormData" ||
         call.receiverType === "MessageFormData") && call.method === "show";
      if (!entityLifecycle && !playerFeedback &&
          !displayFeedback && !cameraPresentation &&
          !profilingQuery && !formClosing && !formPresentation) continue;
      const regionId = ensureScriptRegion(
        parsed, call.executionRegion ?? "module", call.source,
      );
      const key = [
        "api-call", token(regionId), token(call.symbol),
        sourceToken(call.source),
      ].join(":");
      // Preserve distinct receiver/method witnesses; an identical site
      // repeated by the extractor must not multiply reference evidence.
      apiCalls.set(key, {
        id: key,
        receiverType: call.receiverType,
        method: call.method,
        symbol: call.symbol,
        inference: call.inference,
        source: call.source,
        executionRegionId: regionId,
      });
    }

    // Keep this one Script API property in the existing typed IR path.
    // A currentTick read is not a clock model, proof of persistence or lag.
    for (const access of parsed.propertyAccesses) {
      if (access.receiverType !== "System" ||
          access.property !== "currentTick" ||
          access.symbol !== "system.currentTick") continue;
      const key = ["api-property", "system.currentTick",
        sourceToken(access.source)].join(":");
      apiPropertyReads.set(key, {
        id: key,
        receiverType: "System",
        property: "currentTick",
        symbol: "system.currentTick",
        inference: access.inference,
        source: access.source,
      });
    }

    // Canonical typed Entity/Player tag accesses join the SAME Semantic IR
    // state surface used by mcfunctions and authored commands. A lexical
    // literal is required: computed keys, escaped spellings and ambiguous
    // receivers must not be silently promoted to exact tag identity.
    // This observes a source operation, NOT a completed tag mutation,
    // player state, lifecycle transition or validated game rule.
    for (const call of parsed.methodCalls) {
      if ((call.receiverType !== "Entity" && call.receiverType !== "Player") ||
          !["hasTag", "addTag", "removeTag"].includes(call.method)) continue;
      const literal = call.argumentTexts?.[0];
      const literalTag = call.argumentCount === 1 &&
        !call.hasSpreadArgument && call.argumentKinds[0] === "string" &&
        literal !== undefined && /^(?:"[^"\\]*"|'[^'\\]*')$/.test(literal)
          ? literal.slice(1, -1)
          : undefined;
      // Keep dynamic/unresolved tag keys as *source* evidence. A wildcard
      // is NOT a real tag, nor authority to merge different tag expressions.
      const tag = literalTag && literalTag.length > 0 ? literalTag : "*";
      const operation: StateOperationKind = call.method === "hasTag"
        ? "read" : call.method === "addTag" ? "write" : "delete";
      addStateOperation(
        ensureScriptRegion(parsed, call.executionRegion ?? "module", call.source),
        { kind: "tag", key: tag },
        operation,
        call.source,
        call.receiverHint,
        operation === "write"
          ? { kind: "literal", value: "true", scalarKind: "boolean" }
          : undefined,
        irGuards(call.lexicalGuards),
        irGuards(call.precedenceGuards),
      );
    }

    // Only typed API call sites are admitted; unknown receiver calls are not.
    for (const call of parsed.methodCalls) {
      const kind: AuthoredWorldEffect["kind"] | undefined =
        call.receiverType === "Dimension" && call.method === "spawnEntity"
          ? "entity-spawn"
          : (call.receiverType === "Entity" || call.receiverType === "Player") &&
              (call.method === "teleport" || call.method === "tryTeleport")
            ? "teleport"
            : (call.receiverType === "Player" || call.receiverType === "Dimension") &&
                call.method === "playSound"
              ? "audio-feedback" : undefined;
      if (!kind) continue;
      addWorldEffect({
        kind,
        targetLabel: kind === "entity-spawn"
          ? call.argumentTexts?.[0] ?? "unknown-entity-expression"
          : kind === "audio-feedback"
            ? "playSound:" + (call.argumentTexts?.[0]?.trim().slice(0, 120) ??
                "unresolved-sound-expression")
            : call.receiverHint ?? call.receiverType,
        executionRegionId: ensureScriptRegion(
          parsed, call.executionRegion ?? "module", call.source,
        ),
        source: call.source,
        mechanism: "script-api",
        precision: call.inference === "direct" ? "typed-method" : "bounded-method",
        ...irGuardEvidence(call.lexicalGuards, call.precedenceGuards),
      });
    }
    // Reuse the existing spatial AST analysis rather than generic method names.
    for (const mutation of parsed.spatialWorldMutations ?? []) {
      addWorldEffect({
        kind: "block-mutation",
        targetLabel: mutation.writeIdentity ?? mutation.method,
        executionRegionId: ensureScriptRegion(
          parsed, mutation.executionRegion, mutation.source,
        ),
        source: mutation.source, mechanism: "script-spatial",
        precision: mutation.status === "resolved"
          ? "resolved-spatial" : "unresolved-spatial",
        ...irGuardEvidence(mutation.lexicalGuards, mutation.precedenceGuards),
      });
    }
    for (const trigger of parsed.entityEventTriggers) {
      addWorldEffect({
        kind: "entity-event",
        targetLabel: trigger.event,
        executionRegionId: ensureScriptRegion(
          parsed, trigger.executionRegion ?? "module", trigger.source,
        ),
        source: trigger.source, mechanism: "script-api",
        precision: "typed-method",
        ...irGuardEvidence(trigger.lexicalGuards, trigger.precedenceGuards),
      });
    }

    for (const access of parsed.dynamicProperties) {
      const operation = operationFromDynamicProperty(access.operation);
      if (!operation) continue;
      const region = ensureScriptRegion(
        parsed,
        access.executionRegion ?? "module",
        access.source,
      );
      addStateOperation(
        region,
        {
          kind: "dynamic-property",
          key: access.propertyId ?? "*",
        },
        operation,
        access.source,
        access.receiverHint,
        operation === "write" && access.writtenLiteral
          ? {
              kind: "literal",
              value: access.writtenLiteral.value,
              scalarKind: access.writtenLiteral.scalarKind,
            }
          : undefined,
        irGuards(access.lexicalGuards),
        irGuards(access.precedenceGuards),
        operation === "read" && access.comparedLiteral
          ? {
              value: access.comparedLiteral.value,
              scalarKind: access.comparedLiteral.scalarKind,
              operator: access.comparedLiteral.operator,
              source: access.comparedLiteral.comparisonSource,
            }
          : undefined,
        access.sourceSequence,
      );
    }

    // A transition table lists permitted values but does not prove that the
    // runtime dynamic property is governed by this specific table.
    for (const declaration of parsed.transitionDeclarations ?? []) {
      const id = [
        "state-transition-declaration",
        token(declaration.source.artifactId),
        sourceToken(declaration.source),
        token(declaration.tableName),
        token(declaration.from),
      ].join(":");
      transitionDeclarations.set(id, {
        id,
        tableName: declaration.tableName,
        ...(declaration.stateType === undefined
          ? {} : { stateType: declaration.stateType }),
        from: declaration.from,
        to: [...declaration.to],
        source: declaration.source,
      });
    }

    // Reuse the arena-authority analyzer's exact authored generation
    // mutation identity. Never rescan method names or infer invalidation
    // from variable names alone.
    for (const item of parsed.arenaAuthorityEvidence ?? []) {
      if (item.kind !== "generation-invalidate" ||
          item.generationExpression === undefined) continue;
      const region = ensureScriptRegion(
        parsed, item.executionRegion, item.source);
      const id = [
        "generation-invalidation",
        token(item.source.artifactId),
        token(region),
        sourceToken(item.source),
        token(item.generationExpression),
      ].join(":");
      generationInvalidations.set(id, {
        id,
        executionRegionId: region,
        generationExpression: item.generationExpression,
        source: item.source,
      });
    }

    // Return-property evidence is not a game terminal or runtime observation.
    for (const outcome of parsed.returnOutcomes ?? []) {
      const region = ensureScriptRegion(
        parsed, outcome.executionRegion, outcome.source,
      );
      const id = [
        "return-outcome", token(region), token(outcome.propertyName),
        sourceToken(outcome.source),
      ].join(":");
      outcomes.set(id, {
        id,
        executionRegionId: region,
        propertyName: outcome.propertyName,
        value: outcome.value,
        source: outcome.source,
        ...irGuardEvidence(outcome.lexicalGuards, outcome.precedenceGuards),
      });
    }

    // Preserve the existing cleanup analyzer's precision and action identity.
    // A release call does not prove a successful reset.
    for (const resource of parsed.cleanupResourceEvidence ?? []) {
      const region = ensureScriptRegion(
        parsed, resource.executionRegion, resource.source,
      );
      const id = [
        "resource-action", token(region), resource.surface,
        resource.action, sourceToken(resource.source),
      ].join(":");
      resourceActions.set(id, {
        id,
        executionRegionId: region,
        surface: resource.surface,
        action: resource.action,
        key: resource.key,
        precision: resource.precision,
        source: resource.source,
        ...irGuardEvidence(resource.lexicalGuards, resource.precedenceGuards),
      });
    }

    for (const mutation of parsed.stateMutations ?? []) {
      const region = ensureScriptRegion(
        parsed, mutation.executionRegion, mutation.source,
      );
      // Source-local authored expression; not runtime instance identity.
      addStateOperation(
        region,
        { kind: "script-memory",
          key: parsed.source.relativePath + "::" + mutation.target },
        "write",
        mutation.source,
        undefined,
        mutation.value.kind === "literal"
          ? { kind: "literal", value: mutation.value.literal }
          : { kind: "member", symbol: mutation.value.symbol },
        irGuards(mutation.lexicalGuards),
        irGuards(mutation.precedenceGuards),
      );
    }

    for (const command of parsed.commandLiterals) {
      // Uninvoked embedded string is not an authored execution attempt.
      if (command.mechanism === "embedded-literal") continue;
      const region = ensureScriptRegion(
        parsed,
        command.executionRegion ?? "module",
        command.source,
      );
      const analysis = analyzeCommand(
        command.command,
        command.source,
      );
      const effects = flattenCommandEffects(analysis);
      addCommandWorldEffects(
        effects, region, "script-command",
        irGuards(command.lexicalGuards), irGuards(command.precedenceGuards),
      );

      for (const effect of effects) {
        if (effect.kind !== "function-call") continue;
        const target = resolveFunction(effect.target);
        const resolved = target !== undefined;
        addEdge({
          from: region,
          kind: "synchronous-call",
          targetLabel: effect.target,
          resolution: resolved ? "resolved" : "unresolved",
          ...(target !== undefined ? { to: target } : {}),
          source: effect.source,
        });
      }

      for (const access of scoreboardAccesses(effects)) {
        addStateOperation(
          region,
          { kind: "scoreboard", key: access.objective },
          access.access,
          access.source ?? command.source,
          access.target,
        );
      }
      for (const access of tagAccesses(effects)) {
        addStateOperation(
          region,
          { kind: "tag", key: access.tag },
          access.access,
          access.source ?? command.source,
          access.target,
        );
      }
    }
  }

  // Exact ESM source calls must not stop at the module boundary. Resolve to
  // the analyzer's unique exported *executable* region, not an import label.
  // Unresolved class/alias/shadow/foreign-pack targets remain bounded gaps.
  const scriptsByPath = new Map<string, ParsedScriptFile[]>();
  for (const { parsed } of input.parsedScripts) {
    const path = parsed.source.relativePath.replaceAll("\\", "/");
    scriptsByPath.set(path, [...(scriptsByPath.get(path) ?? []), parsed]);
  }
  const resolvedImports = input.resolvedScriptImports ?? resolveScriptImports(
    input.parsedScripts.map(item => item.parsed),
  );
  // Only an exact, manifest-rooted static import authorizes source module
  // dependency topology. It does NOT prove runtime evaluation or callback
  // execution, and must never become a synchronous function call.
  const rootedPaths = input.manifestScriptRoots === undefined
    ? undefined : new Set(input.manifestScriptRoots.staticallyReachablePaths);
  for (const resolution of resolvedImports) {
    if (resolution.typeOnly || resolution.importSyntax !== undefined ||
        resolution.status !== "resolved" ||
        resolution.source === undefined ||
        resolution.targetSourcePath === undefined) continue;
    const fromPath = resolution.fromSourcePath.replaceAll("\\", "/");
    const toPath = resolution.targetSourcePath.replaceAll("\\", "/");
    if (!rootedPaths?.has(fromPath) || !rootedPaths.has(toPath)) continue;
    const callers = scriptsByPath.get(fromPath) ?? [];
    const targets = scriptsByPath.get(toPath) ?? [];
    if (callers.length !== 1 || targets.length !== 1 ||
        callers[0]!.source.artifactId !== resolution.source.artifactId ||
        callers[0]!.source.relativePath !== resolution.source.relativePath ||
        targets[0]!.source.artifactId !== resolution.source.artifactId) continue;
    addEdge({
      from: ensureScriptRegion(callers[0]!, "module", callers[0]!.source),
      to: ensureScriptRegion(targets[0]!, "module", targets[0]!.source),
      kind: "static-module-dependency",
      targetLabel: resolution.module,
      resolution: "resolved",
      source: resolution.source,
    });
  }

  // import("./chunk.js") is a possible asynchronous module handoff, not a
  // synchronous function call, a Minecraft runtime observation or evidence
  // that the imported module initialized successfully.
  //
  // Reuse the existing source import resolver (pack/artifact and ambiguity
  // checks) rather than choosing a matching file by label. A nonliteral
  // request, missing target or ambiguous target remains an unresolved edge.
  for (const resolution of resolvedImports) {
    if (!resolution.importSyntax) continue;
    const candidates = scriptsByPath.get(
      resolution.fromSourcePath.replaceAll("\\", "/")) ?? [];
    const site = resolution.source;
    if (candidates.length !== 1 || site === undefined ||
        resolution.executionRegion === undefined ||
        candidates[0]!.source.artifactId !== site.artifactId ||
        candidates[0]!.source.relativePath !== site.relativePath)
      continue;
    const from = ensureScriptRegion(
      candidates[0]!, resolution.executionRegion, site);
    const targets = resolution.targetSourcePath
      ? scriptsByPath.get(resolution.targetSourcePath.replaceAll("\\", "/")) ?? []
      : [];
    const target = resolution.status === "resolved" &&
      targets.length === 1 &&
      targets[0]!.source.artifactId === site.artifactId
      ? targets[0] : undefined;
    const to = target === undefined ? undefined :
      ensureScriptRegion(target, "module", target.source);
    addEdge({
      from,
      ...(to === undefined ? {} : { to }),
      kind: "deferred",
      targetLabel: "import(" + resolution.module + ")",
      resolution: to === undefined ? "unresolved" : "resolved",
      controlFlow: "deferred",
      source: site,
      ...(resolution.sourceSequence === undefined ? {} : {
        sourceSequence: resolution.sourceSequence,
      }),
      ...irGuardEvidence(resolution.lexicalGuards, resolution.precedenceGuards),
    });
  }

  const exactImportedCallSite = (
    script: ParsedScriptFile,
    call: CrossFileCallEdge,
  ) => {
    const span = call.source.range;
    if (!span || span.lineStart === undefined ||
        span.lineEnd === undefined || span.columnStart === undefined ||
        span.columnEnd === undefined) return undefined;
    const matches = (script.importedCallGuardSites ?? []).filter(site => {
      const r = site.source.range;
      return site.executionRegion === call.callerRegion &&
        site.source.artifactId === call.source.artifactId &&
        site.source.relativePath === call.source.relativePath &&
        site.source.jsonPointer === call.source.jsonPointer &&
        r?.lineStart === span.lineStart && r?.lineEnd === span.lineEnd &&
        r?.columnStart === span.columnStart && r?.columnEnd === span.columnEnd;
    });
    return matches.length === 1 ? matches[0] : undefined;
  };
  for (const call of input.crossFileCallEdges ?? []) {
    const callers = scriptsByPath.get(call.callerModule) ?? [];
    if (callers.length !== 1 ||
        callers[0]!.source.artifactId !== call.source.artifactId) continue;
    const from = ensureScriptRegion(callers[0]!, call.callerRegion, call.source);
    const callGuards = exactImportedCallSite(callers[0]!, call);
    const targets = call.targetModule === undefined
      ? [] : scriptsByPath.get(call.targetModule) ?? [];
    const target = call.status === "resolved" &&
      call.targetRegion !== undefined &&
      targets.length === 1 &&
      targets[0]!.source.artifactId === call.source.artifactId
      ? targets[0] : undefined;
    const validTargetSource = target !== undefined &&
      call.targetSource?.artifactId === target.source.artifactId &&
      call.targetSource?.relativePath === target.source.relativePath
      ? call.targetSource : undefined;
    const to = target === undefined ? undefined :
      ensureScriptRegion(target, call.targetRegion!,
        validTargetSource ?? target.source);
    if (to !== undefined && validTargetSource !== undefined) {
      // A target may already have been indexed from a less specific API
      // site earlier in this inspection. Re-anchor to the unique declaration,
      // not to an arbitrary prior call site or a broad module path.
      const existing = regions.get(to);
      if (existing !== undefined) {
        regions.set(to, { ...existing, source: validTargetSource });
      }
    }
    addEdge({
      from,
      ...(to === undefined ? {} : { to }),
      kind: "synchronous-call",
      targetLabel: call.localName,
      resolution: to === undefined ? "unresolved" : "resolved",
      controlFlow: call.controlFlow,
      source: call.source,
      // The existing ESM analyzer owns the precise lexical handoff.
      ...(to === undefined || !call.argumentParameterBindings?.length ? {} : {
        argumentParameterBindings: call.argumentParameterBindings.map(binding => ({
          index: binding.index,
          argumentName: binding.argumentName,
          parameterName: binding.parameterName,
          argumentSource: binding.argumentSource,
          parameterSource: binding.parameterSource,
          ...(binding.viaConstAliases === undefined ? {} : {
            viaConstAliases: [...binding.viaConstAliases],
          }),
        })),
      }),
      ...irGuardEvidence(callGuards?.lexicalGuards, callGuards?.precedenceGuards),
    });
  }

  const authorityBindings = (input.stateAuthorityContracts ?? [])
    .map((contract) => ({
      contract,
      authoritySurfaceId: ensureSurface(contract.authority),
      mirrorSurfaceIds: contract.mirrors.map(ensureSurface),
    }))
    .sort((a, b) => a.contract.id.localeCompare(b.contract.id));

  // Authored button and animation command sites have unknown activation.
  // A literal /function invocation can still name a unique executable target
  // source. Reuse canonical IR edges; never fabricate an activation edge.
  const seenBehaviorCommandSites = new Set<string>();
  const behaviorCommandCallIds = new Map<string, string[]>();
  for (const relation of input.authoredBehaviorRelations ?? []) {
    if (relation.kind !== "animation-timeline-command" &&
        relation.kind !== "controller-state-command" &&
        relation.kind !== "dialogue-button-command" &&
        relation.kind !== "dialogue-scene-command") continue;
    const identity = JSON.stringify([
      relation.kind, relation.from, relation.source.artifactId,
      relation.source.relativePath, relation.source.jsonPointer,
      relation.to, relation.timingSeconds ?? null,
    ]);
    if (seenBehaviorCommandSites.has(identity)) continue;
    seenBehaviorCommandSites.add(identity);
    const dialogueCommand = relation.kind === "dialogue-button-command" ||
      relation.kind === "dialogue-scene-command";
    const regionId = (dialogueCommand ? "exec:dialogue-command:" :
      "exec:behavior-animation:") + token(relation.from);
    ensureRegion({
      id: regionId, kind: dialogueCommand
        ? "dialogue-command" : "behavior-animation",
      ownerId: relation.ownerId, label: relation.from,
      source: relation.source,
    });
    const effects = flattenCommandEffects(analyzeCommand(
      relation.to, relation.source));
    addCommandWorldEffects(
      effects, regionId,
      dialogueCommand ? "dialogue-command" :
        relation.kind === "animation-timeline-command"
        ? "behavior-animation-command" : "behavior-controller-command",
      undefined, undefined, relation.timingSeconds,
    );
    for (const effect of effects) {
      if (effect.kind !== "function-call") continue;
      const targetRegion = resolveFunction(effect.target);
      // A resolved target is the authored function source only, not proof
      // of player action, Molang evaluation, command permissions or success.
      const edgeId = addEdge({
        from: regionId,
        kind: "synchronous-call",
        targetLabel: effect.target,
        resolution: targetRegion ? "resolved" : "unresolved",
        ...(targetRegion ? { to: targetRegion } : {}),
        source: effect.source,
        controlFlow: relation.to.trim().replace(/^[/]/, "")
          .toLowerCase().startsWith("execute ")
          ? "conditional" : "unconditional",
      });
      const existing = behaviorCommandCallIds.get(relation.id) ?? [];
      existing.push(edgeId);
      behaviorCommandCallIds.set(relation.id, existing);
    }
    // Use exactly the same state-access normalization as mcfunction/script.
    // Dialogue and animation commands often drive progression via scoreboard
    // or tags even when they have NO player-visible world-effect primitive.
    for (const access of scoreboardAccesses(effects)) {
      addStateOperation(
        regionId,
        { kind: "scoreboard", key: access.objective },
        access.access, access.source ?? relation.source, access.target,
      );
    }
    for (const access of tagAccesses(effects)) {
      addStateOperation(
        regionId,
        { kind: "tag", key: access.tag },
        access.access, access.source ?? relation.source, access.target,
      );
    }
  }
  const behaviorRelationships = (input.authoredBehaviorRelations ?? [])
    .map(relation => {
      if (relation.kind !== "animation-timeline-command" &&
          relation.kind !== "controller-state-command" &&
          relation.kind !== "dialogue-button-command" &&
          relation.kind !== "dialogue-scene-command") return relation;
      const dialogueCommand = relation.kind === "dialogue-button-command" ||
        relation.kind === "dialogue-scene-command";
      const regionId = (dialogueCommand ? "exec:dialogue-command:" :
        "exec:behavior-animation:") + token(relation.from);
      const worldEffectIds = [...worldEffects.values()]
        .filter(effect => effect.executionRegionId === regionId &&
          effect.source.artifactId === relation.source.artifactId &&
          effect.source.relativePath === relation.source.relativePath &&
          effect.source.jsonPointer === relation.source.jsonPointer &&
          (relation.timingSeconds === undefined ||
            effect.authoredTimingSeconds === relation.timingSeconds))
        .map(effect => effect.id).sort();
      const stateOperationIds = [...operations.values()]
        .filter(op => op.executionRegionId === regionId &&
          op.source.artifactId === relation.source.artifactId &&
          op.source.relativePath === relation.source.relativePath &&
          op.source.jsonPointer === relation.source.jsonPointer)
        .map(op => op.id).sort();
      const executionEdgeIds = [...new Set(
        behaviorCommandCallIds.get(relation.id) ?? [],
      )].sort();
      return worldEffectIds.length || stateOperationIds.length ||
        executionEdgeIds.length
        ? {
            ...relation,
            ...(worldEffectIds.length ? { worldEffectIds } : {}),
            ...(stateOperationIds.length ? { stateOperationIds } : {}),
            ...(executionEdgeIds.length ? { executionEdgeIds } : {}),
          } : relation;
    });
  // Materialize all authored edges, but static module dependencies express
  // source graph topology rather than same-turn or deferred execution.
  const executionEdges = [...edges.values()]
    .sort((a, b) => a.id.localeCompare(b.id));
  const temporalRelations: TemporalRelation[] =
    executionEdges.filter(edge => edge.kind !== "static-module-dependency")
      .map((edge) => ({
      id: "time:" + edge.id,
      from: edge.from,
      targetLabel: edge.targetLabel,
      resolution: edge.resolution,
      ...(edge.to === undefined ? {} : { to: edge.to }),
      kind: temporalKind(edge),
      source: edge.source,
      ...(edge.guardEvidence === undefined
        ? {}
        : { guardEvidence: edge.guardEvidence }),
      ...(edge.guardIdentifiers === undefined
        ? {}
        : { guardIdentifiers: edge.guardIdentifiers }),
    }));

  const ir: SemanticIr = {
    schemaVersion: 1,
    execution: {
      ...(input.manifestScriptRoots === undefined ? {} : {
        manifestScriptRoots: input.manifestScriptRoots,
      }),
      regions: [...regions.values()].sort(
        (a, b) => a.id.localeCompare(b.id),
      ),
      edges: executionEdges,
      apiCalls: [...apiCalls.values()].sort((a, b) => a.id.localeCompare(b.id)),
      ...(apiPropertyReads.size === 0 ? {} : {
        apiPropertyReads: [...apiPropertyReads.values()]
          .sort((a, b) => a.id.localeCompare(b.id)),
      }),
      outcomes: [...outcomes.values()].sort((a, b) => a.id.localeCompare(b.id)),
      worldEffects: [...worldEffects.values()].sort((a, b) => a.id.localeCompare(b.id)),
      controlFlow: [...sourceControlFlow.values()].filter(item =>
        !ambiguousControlRegions.has(item.executionRegionId) &&
        regions.has(item.executionRegionId)).sort((a, b) =>
        a.executionRegionId.localeCompare(b.executionRegionId)),
      authoredBehaviorRelations: behaviorRelationships
        .sort((a, b) => a.id.localeCompare(b.id)),
    },
    state: {
      surfaces: [...surfaces.values()].sort(
        (a, b) => a.id.localeCompare(b.id),
      ),
      operations: [...operations.values()].sort(
        (a, b) => a.id.localeCompare(b.id),
      ),
      resourceActions: [...resourceActions.values()].sort(
        (a, b) => a.id.localeCompare(b.id),
      ),
      transitionDeclarations: [...transitionDeclarations.values()].sort(
        (a, b) => a.id.localeCompare(b.id),
      ),
      generationInvalidations: [...generationInvalidations.values()].sort(
        (a, b) => a.id.localeCompare(b.id),
      ),
      authorityBindings,
    },
    temporal: {
      relations: temporalRelations,
    },
  };

  const errors = validateSemanticIr(ir);
  if (errors.length > 0) {
    throw new Error(
      "Inspection Semantic IR failed validation: " +
        errors.join("; "),
    );
  }

  return ir;
}
