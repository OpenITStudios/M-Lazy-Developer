import ts from "typescript";
import type {
  ParsedScriptFile,
} from "../../../../analyzers/scripts/src/index.js";
import type {
  ScriptSequentialPathEvidence,
} from "../../../../analyzers/scripts/src/index.js";
import type { SourceRef } from "../../../project-model/src/index.js";

export interface PersistenceSourceProperty {
  scriptId: string;
  propertyId: string;
  growth:
    | "append-without-clear"
    | "append-with-clear"
    | "no-append"
    | "unknown";
  scope:
    | "player"
    | "entity"
    | "item"
    | "arena"
    | "session"
    | "world"
    | "unknown";
  lifetime:
    | "round"
    | "match"
    | "player-session"
    | "world"
    | "unknown";
  scopeConfidence:
    | "exact-receiver"
    | "name-pattern"
    | "unknown";
  lifetimeConfidence:
    | "bounded"
    | "unknown";
  /** Exact authored property reset-like sites; no runtime reset/lifetime proof. */
  resetSites?: NonNullable<ParsedScriptFile["persistentDataLifecycleEvidence"]>[number]["resetSites"];
}

export interface PersistenceReconnectRestoreRisk {
  scriptId: string;
  propertyId: string;
  lifecycleEvent:
    | "playerJoin"
    | "playerSpawn";
  callbackRegion: string;
  scope:
    | "arena"
    | "session";
  reason: string;
}

/** Exact property reset site reachable from one authored lifecycle event.
 * This is a static local-call path, never proof that the event ran or cleanup
 * completed. Generation evidence is co-located only, not authority binding. */
export interface PersistenceResetLifecycleAssociation {
  readonly scriptId: string;
  readonly propertyId: string;
  readonly receiverHint: string;
  readonly resetKind: "undefined-removal" | "empty-value-write";
  readonly lifecycleEvent: "playerLeave" | "playerJoin" | "playerSpawn" | "worldLoad";
  readonly callbackRegion: string;
  readonly resetRegion: string;
  readonly pathKind: "same-region" | "local-call-reachable";
  readonly eventSource: SourceRef;
  readonly resetSource: SourceRef;
  readonly coLocatedGenerationInvalidationSources: readonly SourceRef[];
  /** Same authored receiver expression and direct sequential block; the
   * underlying runtime owner, generation change and reset remain unproven. */
  readonly sequentialGenerationEvidence: readonly {
    readonly generationExpression: string;
    readonly arenaExpression: string;
    readonly source: SourceRef;
    readonly order: "before-reset" | "after-reset";
    readonly evidenceStatus: "SOURCE_SEQUENCE_ONLY";
  }[];
  readonly evidenceStatus: "STATIC_SOURCE_REACHABILITY_ONLY";
}

export interface PersistenceResultAuditRecordAssessment {
  readonly scriptId: string;
  readonly propertyKey: string;
  readonly status:
    | "complete"
    | "partial";
  readonly semanticFields:
    readonly string[];
  readonly missingRequiredFields:
    readonly string[];
}

/** Source candidate only: an explicitly failing local commit result is
 * discarded before a later source write and user-feedback-looking call.
 * Names and lexical order are NOT runtime execution or gameplay proof. */
export interface IgnoredCommitBeforeFeedbackCandidate {
  readonly scriptId: string;
  readonly callerRegion: string;
  readonly calleeName: string;
  readonly callSource: SourceRef;
  readonly failedReturnSource: SourceRef;
  readonly laterWriteSource: SourceRef;
  readonly laterFeedbackSource: SourceRef;
  readonly proof: "SOURCE_FAILURE_PATH_AND_SUCCESS_CANDIDATE_NOT_PROVEN_BUG";
}

export interface PersistenceSourceAnalysis {
  readonly ignoredCommitBeforeFeedback: readonly IgnoredCommitBeforeFeedbackCandidate[];
  properties: readonly PersistenceSourceProperty[];
  resultAuditRecords:
    readonly PersistenceResultAuditRecordAssessment[];
  completeResultAuditRecords: number;
  partialResultAuditRecords: number;
  reconnectTransientRestoreRisks:
    readonly PersistenceReconnectRestoreRisk[];
  /** Read-only lifetime entry/exit candidates from exact reset sites. */
  resetLifecycleAssociations: readonly PersistenceResetLifecycleAssociation[];
  appendWithoutClear: number;
  worldScopedAppendWithoutClear: number;
  unknownScope: number;
  unknownLifetime: number;
  reconnectTransientRestoreRiskCount: number;
}

function graphFor(
  script: ParsedScriptFile,
): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();
  for (const call of script.localFunctionCalls) {
    const next =
      graph.get(call.callerRegion) ??
      new Set<string>();
    next.add(call.targetRegion);
    graph.set(call.callerRegion, next);
  }
  return graph;
}

function reachable(
  graph: ReadonlyMap<string, ReadonlySet<string>>,
  root: string,
): Set<string> {
  const seen = new Set<string>([root]);
  const queue = [root];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of graph.get(current) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return seen;
}

function exactSourcePosition(source: SourceRef): boolean {
  return source.range?.lineStart !== undefined &&
    source.range.lineEnd !== undefined &&
    source.range.columnStart !== undefined &&
    source.range.columnEnd !== undefined;
}

/** Precise lexical block identity, not a runtime execution-path proof. */
function sameSequentialBlock(
  a: SourceRef | undefined,
  b: SourceRef | undefined,
): boolean {
  if (!a || !b || !exactSourcePosition(a) || !exactSourcePosition(b)) {
    return false;
  }
  const x = a.range!;
  const y = b.range!;
  return a.artifactId === b.artifactId &&
    a.relativePath === b.relativePath &&
    a.jsonPointer === b.jsonPointer &&
    x.lineStart === y.lineStart &&
    x.columnStart === y.columnStart &&
    x.lineEnd === y.lineEnd &&
    x.columnEnd === y.columnEnd;
}

/** Source-position ordering of disjoint direct expressions only. */
function exactSourceToken(source: SourceRef): string | undefined {
  if (!exactSourcePosition(source)) return undefined;
  const span = source.range!;
  return JSON.stringify([
    source.artifactId, source.relativePath, source.jsonPointer ?? null,
    span.lineStart, span.columnStart, span.lineEnd, span.columnEnd,
  ]);
}

function sameSequentialPath(
  generation: ScriptSequentialPathEvidence,
  reset: ScriptSequentialPathEvidence,
  laterResetSource?: SourceRef,
): boolean {
  if (!sameSequentialBlock(generation.blockSource, reset.blockSource)) return false;
  // For a generation invalidation AFTER a reset, that direct reset statement
  // legitimately appears among preceding receiver-touching calls. Exclude
  // exactly that statement, not any other call, escape or control barrier.
  // directStatementSequence already requires a standalone call expression.
  const matchesResetStatement = (statement: SourceRef): boolean => {
    if (!laterResetSource || !exactSourcePosition(statement) ||
        !exactSourcePosition(laterResetSource)) return false;
    const a = statement.range!;
    const b = laterResetSource.range!;
    return statement.artifactId === laterResetSource.artifactId &&
      statement.relativePath === laterResetSource.relativePath &&
      statement.jsonPointer === laterResetSource.jsonPointer &&
      a.lineStart === b.lineStart && a.columnStart === b.columnStart &&
      a.lineEnd === b.lineEnd && a.columnEnd! >= b.columnEnd!;
  };
  const recordedCalls = generation.precedingReceiverCallSources ?? [];
  const resetCallCount = recordedCalls.filter(matchesResetStatement).length;
  if (laterResetSource && resetCallCount !== 1) return false;
  const comparableCalls = laterResetSource
    ? recordedCalls.filter(site => !matchesResetStatement(site))
    : recordedCalls;
  const sameSites = (a: readonly SourceRef[], b: readonly SourceRef[]) => {
    if (a.length !== b.length) return false;
    return a.every((source, i) => {
      const left = exactSourceToken(source);
      const right = exactSourceToken(b[i]!);
      return left !== undefined && left === right;
    });
  };
  // An intervening return/throw, receiver assignment, receiver-touching
  // call, or an escape into external storage makes necessary source evidence
  // differ. Unknown downstream effects are not assumed harmless.
  return sameSites(generation.precedingControlExitSources,
      reset.precedingControlExitSources) &&
    sameSites(generation.precedingReceiverRebindingSources,
      reset.precedingReceiverRebindingSources) &&
    sameSites(comparableCalls,
      reset.precedingReceiverCallSources ?? []) &&
    sameSites(generation.precedingReceiverEscapeSources ?? [],
      reset.precedingReceiverEscapeSources ?? []);
}

function sourceOrder(
  generation: SourceRef,
  reset: SourceRef,
): "before-reset" | "after-reset" | undefined {
  if (!exactSourcePosition(generation) || !exactSourcePosition(reset)) {
    return undefined;
  }
  const g = generation.range!;
  const r = reset.range!;
  if (g.lineEnd! < r.lineStart! ||
      (g.lineEnd === r.lineStart && g.columnEnd! <= r.columnStart!)) {
    return "before-reset";
  }
  if (r.lineEnd! < g.lineStart! ||
      (r.lineEnd === g.lineStart && r.columnEnd! <= g.columnStart!)) {
    return "after-reset";
  }
  return undefined;
}

function resetLifecycleEvent(
  event: ParsedScriptFile["events"][number],
): PersistenceResetLifecycleAssociation["lifecycleEvent"] | undefined {
  // Keep only known world lifecycle events. Unknown roots and arbitrary event
  // names are not sufficient to bind a property reset to a lifecycle.
  if (event.root !== "world" || event.phase !== "afterEvents") return undefined;
  switch (event.event) {
    case "playerLeave":
    case "playerJoin":
    case "playerSpawn":
    case "worldLoad":
      return event.event;
    default:
      return undefined;
  }
}

function reconnectLifecycleEvent(
  event: string,
): "playerJoin" | "playerSpawn" | undefined {
  const normalized =
    event.replace(/[^A-Za-z0-9]/g, "")
      .toLowerCase();
  if (normalized === "playerjoin") {
    return "playerJoin";
  }
  if (normalized === "playerspawn") {
    return "playerSpawn";
  }
  return undefined;
}

/**
 * Cross-producer region identity: arena evidence retains a position-qualified
 * declaration ID while lifecycle reset sites use the parser's region ID.
 * Reuse only the unique AST-backed binding already admitted by parseScriptFile.
 * Never strip offsets or merge same-named declarations to manufacture proof.
 */
function sameAuthoredResetRegion(
  script: ParsedScriptFile,
  evidence: NonNullable<ParsedScriptFile["arenaAuthorityEvidence"]>[number],
  resetRegion: string,
): boolean {
  if (evidence.executionRegion === resetRegion) return true;
  return (script.arenaAuthorityPaths ?? []).filter(path =>
    path.executionRegion === evidence.executionRegion &&
    path.arenaExpression === evidence.arenaExpression &&
    path.parserExecutionRegion === resetRegion).length === 1;
}

/**
 * Conservative, same-file AST path search; never infer a cross-file
 * recipient, dynamic dispatch, successful persistence or player-visible UI.
 * Avoids name-keyword rules such as "save", "win", "relay" or "finish".
 */
function ignoredCommitBeforeFeedback(
  script: ParsedScriptFile,
): readonly IgnoredCommitBeforeFeedbackCandidate[] {
  if (!script.text || !script.source.artifactId.trim() ||
      !script.source.relativePath.trim()) return [];
  const file = ts.createSourceFile(
    script.source.relativePath, script.text, ts.ScriptTarget.Latest, true,
    /\.tsx?$/i.test(script.source.relativePath) ? ts.ScriptKind.TS : ts.ScriptKind.JS,
  );
  type Callable = ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression;
  const declarations = new Map<string, Callable[]>();
  const add = (name: string, fn: Callable) =>
    declarations.set(name, [...(declarations.get(name) ?? []), fn]);
  for (const statement of file.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name && statement.body) {
      add(statement.name.text, statement);
    } else if (ts.isVariableStatement(statement)) {
      for (const decl of statement.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.initializer &&
            (ts.isArrowFunction(decl.initializer) ||
             ts.isFunctionExpression(decl.initializer))) {
          add(decl.name.text, decl.initializer);
        }
      }
    }
  }
  const unique = new Map([...declarations.entries()]
    .filter(([, values]) => values.length === 1)
    .map(([name, values]) => [name, values[0]!] as const));
  const site = (node: ts.Node): SourceRef => {
    const start = file.getLineAndCharacterOfPosition(node.getStart(file));
    const end = file.getLineAndCharacterOfPosition(node.getEnd());
    return { ...script.source, range: {
      lineStart: start.line + 1, columnStart: start.character + 1,
      lineEnd: end.line + 1, columnEnd: end.character + 1,
    } };
  };
  const walkBody = (node: ts.Node, fn: Callable, visit: (n: ts.Node) => void): void => {
    if (node !== fn && ts.isFunctionLike(node)) return;
    visit(node);
    ts.forEachChild(node, child => walkBody(child, fn, visit));
  };
  // Require direct false/null return AND an actual .set operation in this
  // unique authored function. A plausible failure name or type is insufficient.
  const fallible = new Map<string, SourceRef>();
  for (const [name, fn] of unique) {
    if (!fn.body) continue;
    const failed: SourceRef[] = [];
    let hasWrite = false;
    walkBody(fn.body, fn, node => {
      if (ts.isReturnStatement(node) && node.expression &&
          (node.expression.kind === ts.SyntaxKind.FalseKeyword ||
           node.expression.kind === ts.SyntaxKind.NullKeyword)) {
        failed.push(site(node));
      }
      if (ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          (node.expression.name.text === "set" ||
           node.expression.name.text === "setDynamicProperty")) hasWrite = true;
    });
    if (hasWrite && failed.length > 0) fallible.set(name, failed[0]!);
  }
  if (fallible.size === 0) return [];
  const feedbackMethods = new Set([
    "enqueue", "sendMessage", "setTitle", "setActionBar", "show",
  ]);
  const output: IgnoredCommitBeforeFeedbackCandidate[] = [];
  for (const [callerName, fn] of unique) {
    if (!fn.body || !ts.isBlock(fn.body)) continue;
    const shadowed = new Set(fn.parameters.filter(parameter =>
      ts.isIdentifier(parameter.name)).map(parameter =>
      (parameter.name as ts.Identifier).text));
    // Reject caller-local shadowing of a global function. No free-variable
    // name matching is accepted when the actual callee could be different.
    walkBody(fn.body, fn, node => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name))
        shadowed.add(node.name.text);
    });
    walkBody(fn.body, fn, node => {
      if (!ts.isBlock(node)) return;
      for (const [index, statement] of node.statements.entries()) {
        if (!ts.isExpressionStatement(statement) ||
            !ts.isCallExpression(statement.expression) ||
            !ts.isIdentifier(statement.expression.expression)) continue;
        const calleeName = statement.expression.expression.text;
        const failure = fallible.get(calleeName);
        if (!failure || shadowed.has(calleeName)) continue;
        let write: SourceRef | undefined;
        let feedback: SourceRef | undefined;
        for (const later of node.statements.slice(index + 1)) {
          if (ts.isReturnStatement(later) || ts.isThrowStatement(later)) break;
          walkBody(later, fn, n => {
            if (!ts.isCallExpression(n) ||
                !ts.isPropertyAccessExpression(n.expression)) return;
            const method = n.expression.name.text;
            if (!write && (method === "set" || method === "setDynamicProperty")) {
              write = site(n);
            }
            if (!feedback && feedbackMethods.has(method)) feedback = site(n);
          });
          if (write && feedback) break;
        }
        if (!write || !feedback) continue;
        output.push({
          scriptId: script.identifier,
          callerRegion: "function:" + callerName,
          calleeName,
          callSource: site(statement.expression),
          failedReturnSource: failure,
          laterWriteSource: write,
          laterFeedbackSource: feedback,
          proof: "SOURCE_FAILURE_PATH_AND_SUCCESS_CANDIDATE_NOT_PROVEN_BUG",
        });
      }
    });
  }
  return output.sort((a, b) =>
    a.callSource.relativePath.localeCompare(b.callSource.relativePath) ||
    (a.callSource.range?.lineStart ?? 0) - (b.callSource.range?.lineStart ?? 0) ||
    (a.callSource.range?.columnStart ?? 0) - (b.callSource.range?.columnStart ?? 0));
}

export function analyzePersistenceSource(
  scripts: readonly ParsedScriptFile[],
  sourceReviewScripts: readonly ParsedScriptFile[] = scripts,
): PersistenceSourceAnalysis {
  const properties: PersistenceSourceProperty[] = [];
  const reconnectTransientRestoreRisks:
    PersistenceReconnectRestoreRisk[] = [];
  const resetLifecycleAssociations: PersistenceResetLifecycleAssociation[] = [];

  for (const script of scripts) {
    const scopes = new Map(
      (script.persistentStateScopes ?? []).map((item) => [
        item.propertyId,
        item,
      ]),
    );
    const lifetimes = new Map(
      (script.persistentStateLifetimes ?? []).map((item) => [
        item.propertyId,
        item,
      ]),
    );

    for (
      const lifecycle of
        script.persistentDataLifecycleEvidence ?? []
    ) {
      const scope = scopes.get(lifecycle.propertyKey);
      const lifetime = lifetimes.get(lifecycle.propertyKey);

      properties.push({
        scriptId: script.identifier,
        propertyId: lifecycle.propertyKey,
        growth: lifecycle.growth,
        scope: scope?.scope ?? "unknown",
        lifetime: lifetime?.lifetime ?? "unknown",
        scopeConfidence:
          scope?.confidence ?? "unknown",
        lifetimeConfidence:
          lifetime?.confidence ?? "unknown",
        ...(lifecycle.resetSites?.length ? {
          resetSites: lifecycle.resetSites,
        } : {}),
      });
    }

    const graph = graphFor(script);

    // Exact source-local association, not a terminal/reset contract: the
    // existence of a subscribed event and resolved local calls does not prove
    // event delivery, successful reset, or a generation match.
    for (const event of script.events) {
      const lifecycleEvent = resetLifecycleEvent(event);
      if (lifecycleEvent === undefined || event.callbackRegion === undefined ||
          event.source.artifactId !== script.source.artifactId ||
          event.source.relativePath !== script.source.relativePath ||
          !exactSourcePosition(event.source)) {
        continue;
      }
      const regions = reachable(graph, event.callbackRegion);
      for (const lifecycle of script.persistentDataLifecycleEvidence ?? []) {
        for (const site of lifecycle.resetSites ?? []) {
          if (site.propertyKey !== lifecycle.propertyKey ||
              site.source.artifactId !== event.source.artifactId ||
              site.source.relativePath !== event.source.relativePath ||
              !exactSourcePosition(site.source) ||
              !regions.has(site.executionRegion)) continue;

          // Same function is not proof that an invalidation concerns the same
          // arena, player, or property. Preserve the separate source locations.
          const coLocatedGenerationInvalidationSources =
            (script.arenaAuthorityEvidence ?? [])
              .filter(item => item.kind === "generation-invalidate" &&
                sameAuthoredResetRegion(script, item, site.executionRegion) &&
                item.source.artifactId === site.source.artifactId &&
                item.source.relativePath === site.source.relativePath)
              .map(item => item.source)
              .sort((a, b) =>
                (a.range?.lineStart ?? 0) - (b.range?.lineStart ?? 0) ||
                (a.range?.columnStart ?? 0) - (b.range?.columnStart ?? 0));

          // Equal receiver syntax is not runtime identity. Only comparable
          // direct statements with unchanged necessary source path evidence
          // are projected. Calls/aliases outside this small model remain
          // unknown rather than proof of an executed generation transition.
          const sequentialGenerationEvidence =
            (script.arenaAuthorityEvidence ?? [])
              .flatMap(item => {
                if (item.kind !== "generation-invalidate" ||
                    !sameAuthoredResetRegion(script, item, site.executionRegion) ||
                    item.arenaExpression !== site.receiverHint ||
                    !item.sequentialPathEvidence ||
                    !site.sequentialPathEvidence ||
                    item.source.artifactId !== site.source.artifactId ||
                    item.source.relativePath !== site.source.relativePath ||
                    !item.generationExpression) return [];
                const order = sourceOrder(item.source, site.source);
                if (!order || !sameSequentialPath(
                  item.sequentialPathEvidence, site.sequentialPathEvidence,
                  order === "after-reset" ? site.source : undefined,
                )) return [];
                return [{
                  generationExpression: item.generationExpression,
                  arenaExpression: item.arenaExpression,
                  source: item.source,
                  order,
                  evidenceStatus: "SOURCE_SEQUENCE_ONLY" as const,
                }];
              })
              .sort((a, b) =>
                (a.source.range?.lineStart ?? 0) - (b.source.range?.lineStart ?? 0) ||
                (a.source.range?.columnStart ?? 0) - (b.source.range?.columnStart ?? 0));

          resetLifecycleAssociations.push({
            scriptId: script.identifier,
            propertyId: site.propertyKey,
            receiverHint: site.receiverHint,
            resetKind: site.kind,
            lifecycleEvent,
            callbackRegion: event.callbackRegion,
            resetRegion: site.executionRegion,
            pathKind: event.callbackRegion === site.executionRegion
              ? "same-region" : "local-call-reachable",
            eventSource: event.source,
            resetSource: site.source,
            coLocatedGenerationInvalidationSources,
            sequentialGenerationEvidence,
            evidenceStatus: "STATIC_SOURCE_REACHABILITY_ONLY",
          });
        }
      }
    }

    const scopeByProperty = new Map(
      (script.persistentStateScopes ?? [])
        .map((item) => [
          item.propertyId,
          item.scope,
        ] as const),
    );

    for (const event of script.events) {
      const lifecycleEvent =
        reconnectLifecycleEvent(
          event.event,
        );
      if (
        lifecycleEvent === undefined ||
        event.callbackRegion === undefined
      ) {
        continue;
      }

      const reachableRegions =
        reachable(
          graph,
          event.callbackRegion,
        );

      for (
        const access of
          script.dynamicProperties
      ) {
        if (
          access.operation !== "get" ||
          access.propertyId === undefined ||
          access.executionRegion === undefined ||
          !reachableRegions.has(
            access.executionRegion,
          )
        ) {
          continue;
        }

        const scope =
          scopeByProperty.get(
            access.propertyId,
          );
        // The receiver describes physical storage ownership. A world
        // dynamic property named matchSession may still hold transient
        // gameplay information that is restored during reconnect, but
        // that conclusion is only a naming-based risk, not scope proof.
        const candidateScope = scope === "arena" || scope === "session"
          ? scope
          : scope === "world" && /arena/i.test(access.propertyId)
            ? "arena" as const
            : scope === "world" && /(?:session|match|round)/i.test(access.propertyId)
              ? "session" as const
              : undefined;
        if (!candidateScope) continue;

        reconnectTransientRestoreRisks.push({
          scriptId:
            script.identifier,
          propertyId:
            access.propertyId,
          lifecycleEvent,
          callbackRegion:
            event.callbackRegion,
          scope: candidateScope,
          reason:
            "Reconnect/initial-spawn path reads persistent state with a " +
            candidateScope +
            " gameplay-lifetime signal without source proof that stale ownership is reconciled against the current session/arena generation. A storage receiver does not establish transient lifetime.",
        });
      }
    }
  }

  properties.sort((a, b) =>
    a.scriptId.localeCompare(b.scriptId) ||
    a.propertyId.localeCompare(b.propertyId)
  );

  resetLifecycleAssociations.sort((a, b) =>
    a.scriptId.localeCompare(b.scriptId) ||
    a.propertyId.localeCompare(b.propertyId) ||
    a.lifecycleEvent.localeCompare(b.lifecycleEvent) ||
    (a.resetSource.range?.lineStart ?? 0) - (b.resetSource.range?.lineStart ?? 0) ||
    (a.resetSource.range?.columnStart ?? 0) - (b.resetSource.range?.columnStart ?? 0)
  );

  reconnectTransientRestoreRisks.sort((a, b) =>
    a.scriptId.localeCompare(b.scriptId) ||
    a.propertyId.localeCompare(b.propertyId) ||
    a.lifecycleEvent.localeCompare(
      b.lifecycleEvent,
    )
  );

  const resultAuditRecords =
    scripts.flatMap((script) =>
      (
        script.resultAuditRecordEvidence ??
        []
      ).map((item) => ({
        scriptId: script.identifier,
        propertyKey: item.propertyKey,
        status: item.status,
        semanticFields:
          [...item.semanticFields],
        missingRequiredFields:
          [...item.missingRequiredFields],
      }))
    ).sort((a, b) =>
      a.scriptId.localeCompare(b.scriptId) ||
      a.propertyKey.localeCompare(
        b.propertyKey,
      )
    );

  return {
    properties,
    ignoredCommitBeforeFeedback: sourceReviewScripts.flatMap(ignoredCommitBeforeFeedback),
    resultAuditRecords,
    completeResultAuditRecords:
      resultAuditRecords.filter(
        (item) =>
          item.status === "complete",
      ).length,
    partialResultAuditRecords:
      resultAuditRecords.filter(
        (item) =>
          item.status === "partial",
      ).length,
    reconnectTransientRestoreRisks,
    resetLifecycleAssociations,
    appendWithoutClear:
      properties.filter(
        (item) =>
          item.growth ===
          "append-without-clear",
      ).length,
    worldScopedAppendWithoutClear:
      properties.filter(
        (item) =>
          item.growth ===
            "append-without-clear" &&
          item.scope === "world",
      ).length,
    unknownScope:
      properties.filter(
        (item) =>
          item.scope === "unknown",
      ).length,
    unknownLifetime:
      properties.filter(
        (item) =>
          item.lifetime === "unknown",
      ).length,
    reconnectTransientRestoreRiskCount:
      reconnectTransientRestoreRisks.length,
  };
}
