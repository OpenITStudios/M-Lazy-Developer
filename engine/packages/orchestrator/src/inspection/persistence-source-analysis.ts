import ts from "typescript";
import { posix } from "node:path";
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

/** Source candidate only: an explicitly fallible local commit result is
 * discarded with a nearby state write (before or after the call) and a later
 * feedback-looking call. Lexical relations are NOT gameplay or BUG proof. */
export interface IgnoredCommitBeforeFeedbackCandidate {
  readonly scriptId: string;
  readonly callerRegion: string;
  readonly calleeName: string;
  readonly callSource: SourceRef;
  readonly failedReturnSource: SourceRef;
  /** A direct authored setter in a try whose single catch returns
   * false/null. This is NOT proof the storage API throws or that the
   * candidate actually occurred in Minecraft. */
  readonly caughtStorageExceptionWriteSource?: SourceRef;
  /** Source sites establishing a direct this.field = new LocalClass()
   * or field = new LocalClass() receiver, not runtime object identity. */
  readonly receiverBindingSources?: readonly SourceRef[];
  /** Exact same-file return-forwarding sites, ordered outer to inner. */
  readonly forwardingReturnSources?: readonly SourceRef[];
  /** Names of the bounded resolved call chain, outer to fallible leaf. */
  readonly failurePropagationPath?: readonly string[];
  /** Existing same-block case: state write after the unchecked call. */
  readonly laterWriteSource?: SourceRef;
  /** Guarded branch case: state write before the unchecked call, with
   * subsequent feedback in the enclosing block. Never gameplay proof. */
  readonly precedingWriteSource?: SourceRef;
  /** The discarded cross-file commit itself is the authored write; no
   * unrelated second state write may be inferred as a success path. */
  readonly directFallibleWriteSource?: SourceRef;
  /** Explicitly named imported class and constructor-bound receiver only. */
  readonly receiverBindingKind?: "direct-named-esm-class";
  readonly laterFeedbackSource: SourceRef;
  readonly proof: "SOURCE_FAILURE_PATH_AND_SUCCESS_CANDIDATE_NOT_PROVEN_BUG";
}

/** Same-block ordered counter and payload writes through one storage-like
 * source callee. This does not prove backend atomicity or a gameplay defect.
 */
export interface SequentialCounterBeforePayloadCandidate {
  readonly scriptId: string;
  readonly callerRegion: string;
  readonly counterKey: string;
  readonly firstWriteSource: SourceRef;
  readonly payloadWriteSource: SourceRef;
  readonly storageSetSource: SourceRef;
  readonly proof: "SOURCE_ORDERED_COUNTER_PAYLOAD_NOT_ATOMICITY_PROOF";
}

export interface PersistenceSourceAnalysis {
  readonly ignoredCommitBeforeFeedback: readonly IgnoredCommitBeforeFeedbackCandidate[];
  readonly sequentialCounterBeforePayload?: readonly SequentialCounterBeforePayloadCandidate[];
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
  file: ts.SourceFile,
): readonly IgnoredCommitBeforeFeedbackCandidate[] {
  if (!script.text || !script.source.artifactId.trim() ||
      !script.source.relativePath.trim()) return [];
  // A callable is resolved by its lexical owner, not its bare method name.
  // Identical method/local names in other classes or closures are unrelated.
  // Unnamed callbacks, arbitrary obj.method(), and dynamic/computed receivers
  // remain unknown rather than supplying guessed call-graph edges.
  type Callable = ts.FunctionDeclaration | ts.ArrowFunction |
    ts.FunctionExpression | ts.MethodDeclaration;
  const declarations = new Map<string, Callable[]>();
  const parentScope = new Map<string, string>();
  const thisOwner = new Map<string, string>();
  const staticThis = new Set<string>();
  // Instance member identity is admitted only for one direct source-visible
  // initialization and no other write in this class. It does not attest
  // runtime construction, side effects or external mutation.
  const classOwnerCount = new Map<string, number>();
  const receiverFields = new Map<string, Map<string, {
    readonly target: string; readonly source: ts.Node;
  }>>();
  const reassignedClassSymbols = new Set<string>();
  const findClassReassignments = (node: ts.Node): void => {
    if (ts.isBinaryExpression(node) &&
        node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
        node.operatorToken.kind <= ts.SyntaxKind.LastAssignment &&
        ts.isIdentifier(node.left)) reassignedClassSymbols.add(node.left.text);
    ts.forEachChild(node, findClassReassignments);
  };
  findClassReassignments(file);
  const add = (
    key: string, fn: Callable, parent?: string, className?: string,
    depth = 0, isStatic = false,
  ): void => {
    declarations.set(key, [...(declarations.get(key) ?? []), fn]);
    if (parent) parentScope.set(key, parent);
    if (className) thisOwner.set(key, className);
    if (isStatic) staticThis.add(key);
    // Only direct, named lexical declarations in a bounded enclosing body.
    // A deeper scope remains an UNKNOWN instead of leaking into a global map.
    if (depth >= 4 || !fn.body || !ts.isBlock(fn.body)) return;
    for (const statement of fn.body.statements) {
      if (ts.isFunctionDeclaration(statement) && statement.name && statement.body) {
        add(key + "::" + statement.name.text, statement, key, undefined, depth + 1);
      } else if (ts.isVariableStatement(statement)) {
        for (const decl of statement.declarationList.declarations) {
          if (ts.isIdentifier(decl.name) && decl.initializer &&
              (ts.isArrowFunction(decl.initializer) ||
               ts.isFunctionExpression(decl.initializer))) {
            // Arrow functions preserve lexical this; normal functions do not.
            const inheritedThis = ts.isArrowFunction(decl.initializer)
              ? className : undefined;
            add(key + "::" + decl.name.text, decl.initializer,
              key, inheritedThis, depth + 1,
              !!inheritedThis && staticThis.has(key));
          }
        }
      }
    }
  };
  const addClass = (
    owner: string, definition: ts.ClassDeclaration | ts.ClassExpression,
  ): void => {
    classOwnerCount.set(owner, (classOwnerCount.get(owner) ?? 0) + 1);
    if (definition.heritageClauses?.length) return;
    // Direct class declarations and variable class expressions share a
    // lexical source owner. Static and instance namespaces are separate;
    // a class-field/this.member rebinding invalidates only its own side.
    const reboundInstance = new Set<string>();
    const reboundStatic = new Set<string>();
    const isStatic = (member: ts.ClassElement): boolean =>
      ts.canHaveModifiers(member) &&
      !!ts.getModifiers(member)?.some(mod => mod.kind === ts.SyntaxKind.StaticKeyword);
    const memberName = (name: ts.PropertyName): string | undefined => {
      if (ts.isIdentifier(name) || ts.isStringLiteralLike(name))
        return name.text;
      if (ts.isComputedPropertyName(name) && ts.isStringLiteralLike(name.expression))
        return name.expression.text;
      return undefined;
    };
    const scan = (node: ts.Node, unstable: Set<string>): void => {
      if (ts.isBinaryExpression(node) &&
          node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
        const left = node.left;
        if (ts.isPropertyAccessExpression(left) &&
            left.expression.kind === ts.SyntaxKind.ThisKeyword)
          unstable.add(left.name.text);
        if (ts.isElementAccessExpression(left) &&
            left.expression.kind === ts.SyntaxKind.ThisKeyword &&
            ts.isStringLiteralLike(left.argumentExpression))
          unstable.add(left.argumentExpression.text);
      }
      ts.forEachChild(node, child => scan(child, unstable));
    };
    for (const member of definition.members) {
      if (ts.isPropertyDeclaration(member) ||
          ts.isGetAccessorDeclaration(member) ||
          ts.isSetAccessorDeclaration(member)) {
        const name = memberName(member.name);
        if (name !== undefined)
          (isStatic(member) ? reboundStatic : reboundInstance).add(name);
      }
      if (ts.isConstructorDeclaration(member) && member.body)
        scan(member.body, reboundInstance);
      if (ts.isClassStaticBlockDeclaration(member))
        scan(member.body, reboundStatic);
      if (ts.isMethodDeclaration(member) && member.body)
        scan(member.body, isStatic(member) ? reboundStatic : reboundInstance);
    }
    // Source-grounded instance field identity for this.field.method().
    // Anything conditional, rebound, dynamically addressed or shadowed is
    // unknown. This is an ownership edge, not a transaction-success claim.
    const fieldWrites = new Map<string, ts.Node[]>();
    let dynamicWrite = false;
    const recordField = (field: string, node: ts.Node): void => {
      fieldWrites.set(field, [...(fieldWrites.get(field) ?? []), node]);
    };
    // A unique this.field initialization does not keep the target method
    // immutable: this.field.write = ..., delete this.field.write, or a
    // receiver alias can change the invoked callable without reassigning
    // this.field itself. Reuse the same source-identity gate, never promote
    // a guessed target in this uncertain case.
    const invalidateNestedMember = (target: ts.Node): void => {
      const base = ts.isPropertyAccessExpression(target) ||
        ts.isElementAccessExpression(target) ? target.expression : undefined;
      if (base && ts.isPropertyAccessExpression(base) &&
          base.expression.kind === ts.SyntaxKind.ThisKeyword)
        recordField(base.name.text, target);
      if (base && ts.isElementAccessExpression(base) &&
          base.expression.kind === ts.SyntaxKind.ThisKeyword) {
        if (base.argumentExpression &&
            ts.isStringLiteralLike(base.argumentExpression))
          recordField(base.argumentExpression.text, target);
        else dynamicWrite = true;
      }
    };
    const assignments = (node: ts.Node): void => {
      if (ts.isBinaryExpression(node) &&
          node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
          node.operatorToken.kind <= ts.SyntaxKind.LastAssignment) {
        const left = node.left;
        if (ts.isPropertyAccessExpression(left) &&
            left.expression.kind === ts.SyntaxKind.ThisKeyword)
          recordField(left.name.text, node);
        if (ts.isElementAccessExpression(left) &&
            left.expression.kind === ts.SyntaxKind.ThisKeyword) {
          if (left.argumentExpression &&
              ts.isStringLiteralLike(left.argumentExpression))
            recordField(left.argumentExpression.text, node);
          else dynamicWrite = true;
        }
        invalidateNestedMember(left);
      }
      if (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) {
        const operand = node.operand;
        if (ts.isPropertyAccessExpression(operand) &&
            operand.expression.kind === ts.SyntaxKind.ThisKeyword)
          recordField(operand.name.text, node);
        invalidateNestedMember(operand);
      }
      if (ts.isDeleteExpression(node)) {
        const operand = node.expression;
        if (ts.isPropertyAccessExpression(operand) &&
            operand.expression.kind === ts.SyntaxKind.ThisKeyword)
          recordField(operand.name.text, node);
        invalidateNestedMember(operand);
      }
      if (node.kind === ts.SyntaxKind.ThisKeyword) {
        // Passing/capturing 'this' can expose the receiver to an untracked
        // mutation through an alias. Ordinary this.member reads stay local.
        const parent = node.parent;
        if (!((ts.isPropertyAccessExpression(parent) ||
                ts.isElementAccessExpression(parent)) &&
               parent.expression === node)) dynamicWrite = true;
      }
      if (ts.isPropertyAccessExpression(node) &&
          node.expression.kind === ts.SyntaxKind.ThisKeyword) {
        const parent = node.parent;
        const escaped = ts.isVariableDeclaration(parent) &&
            parent.initializer === node ||
          ts.isCallExpression(parent) && parent.arguments.some(arg => arg === node) ||
          ts.isReturnStatement(parent) && parent.expression === node ||
          ts.isPropertyAssignment(parent) && parent.initializer === node ||
          ts.isBinaryExpression(parent) && parent.right === node ||
          ts.isArrayLiteralExpression(parent) &&
            parent.elements.some(element => element === node);
        if (escaped) recordField(node.name.text, node);
      }
      ts.forEachChild(node, assignments);
    };
    for (const member of definition.members) {
      if (ts.isPropertyDeclaration(member) && !isStatic(member)) {
        const name = memberName(member.name);
        if (name) recordField(name, member);
      }
      if (ts.isConstructorDeclaration(member) && member.body)
        assignments(member.body);
      if (ts.isMethodDeclaration(member) && member.body && !isStatic(member))
        assignments(member.body);
    }
    if (!dynamicWrite) {
      const fields = new Map<string, { target: string; source: ts.Node }>();
      for (const [field, writes] of fieldWrites) {
        if (writes.length !== 1) continue;
        const write = writes[0]!;
        const value = ts.isPropertyDeclaration(write) ? write.initializer :
          ts.isBinaryExpression(write) &&
            write.operatorToken.kind === ts.SyntaxKind.EqualsToken ?
            write.right : undefined;
        if (!value || !ts.isNewExpression(value) ||
            !ts.isIdentifier(value.expression)) continue;
        if (ts.isBinaryExpression(write)) {
          const statement = write.parent;
          const constructorBody = statement.parent;
          const constructor = constructorBody.parent;
          const targetName = value.expression.text;
          if (!ts.isExpressionStatement(statement) ||
              !ts.isBlock(constructorBody) ||
              !ts.isConstructorDeclaration(constructor) ||
              constructor.body !== constructorBody ||
              !constructorBody.statements.includes(statement) ||
              constructor.parameters.some(param =>
                ts.isIdentifier(param.name) && param.name.text === targetName) ||
              constructorBody.statements.some(other =>
                ts.isVariableStatement(other) &&
                other.declarationList.declarations.some(decl =>
                  ts.isIdentifier(decl.name) && decl.name.text === targetName) ||
                ts.isFunctionDeclaration(other) &&
                other.name?.text === targetName ||
                ts.isClassDeclaration(other) &&
                other.name?.text === targetName)) continue;
        }
        fields.set(field, { target: value.expression.text, source: write });
      }
      if (fields.size) receiverFields.set(owner, fields);
    }
    for (const member of definition.members) {
      if (!ts.isMethodDeclaration(member) || !member.body ||
          !ts.isIdentifier(member.name)) continue;
      const staticMember = isStatic(member);
      if ((staticMember ? reboundStatic : reboundInstance).has(member.name.text))
        continue;
      add((staticMember ? "static:" : "class:") +
        owner + "." + member.name.text, member, undefined, owner, 0,
        staticMember);
    }
  };
  for (const statement of file.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name && statement.body) {
      add(statement.name.text, statement);
    } else if (ts.isVariableStatement(statement)) {
      for (const decl of statement.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
        if (ts.isArrowFunction(decl.initializer) ||
            ts.isFunctionExpression(decl.initializer)) {
          add(decl.name.text, decl.initializer);
        } else if (ts.isClassExpression(decl.initializer)) {
          // A direct variable initializer provides a stable source identifier
          // for method ownership; it is NOT proof of runtime class identity.
          addClass(decl.name.text, decl.initializer);
        }
      }
    } else if (ts.isClassDeclaration(statement) && statement.name) {
      addClass(statement.name.text, statement);
    }
  }
  const unique = new Map([...declarations.entries()]
    .filter(([, values]) => values.length === 1)
    .map(([key, values]) => [key, values[0]!] as const));
  const bindings = new Map<string, Set<string>>();
  for (const [key, fn] of unique) {
    const names = new Set(fn.parameters
      .filter(param => ts.isIdentifier(param.name))
      .map(param => (param.name as ts.Identifier).text));
    const visit = (node: ts.Node): void => {
      if (node !== fn && ts.isFunctionLike(node)) {
        if (ts.isFunctionDeclaration(node) && node.name) names.add(node.name.text);
        return;
      }
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name))
        names.add(node.name.text);
      ts.forEachChild(node, visit);
    };
    if (fn.body) visit(fn.body);
    bindings.set(key, names);
  }
  const resolveCall = (callerKey: string, expr: ts.LeftHandSideExpression): {
    readonly key: string; readonly bindingSource?: ts.Node;
  } | undefined => {
    if (ts.isIdentifier(expr)) {
      let scope: string | undefined = callerKey;
      while (scope) {
        const localKey: string = scope + "::" + expr.text;
        // A parameter, local variable or local declaration shadows any
        // outer/global callable. Only uniquely indexed local functions pass.
        if (unique.get(scope)?.parameters.some(param =>
            ts.isIdentifier(param.name) && param.name.text === expr.text)) return undefined;
        if (bindings.get(scope)?.has(expr.text) || declarations.has(localKey))
          return unique.has(localKey) ? { key: localKey } : undefined;
        scope = parentScope.get(scope);
      }
      return unique.has(expr.text) ? { key: expr.text } : undefined;
    }
    if (ts.isPropertyAccessExpression(expr)) {
      // Optional member access cannot establish an unconditional call edge.
      if (expr.questionDotToken ||
          (ts.isPropertyAccessExpression(expr.expression) &&
           expr.expression.questionDotToken)) return undefined;
      const owner = thisOwner.get(callerKey);
      if (!owner) return undefined;
      const staticOwner = staticThis.has(callerKey);
      if (ts.isPropertyAccessExpression(expr.expression) &&
          expr.expression.expression.kind === ts.SyntaxKind.ThisKeyword &&
          !staticOwner && classOwnerCount.get(owner) === 1) {
        const binding = receiverFields.get(owner)?.get(expr.expression.name.text);
        if (!binding || classOwnerCount.get(binding.target) !== 1 ||
            reassignedClassSymbols.has(binding.target) ||
            !unique.has("class:" + binding.target + "." + expr.name.text))
          return undefined;
        // No dynamic/intermediate alias resolution; this.field is grounded
        // by a single same-file new LocalClass() initialization only.
        return {
          key: "class:" + binding.target + "." + expr.name.text,
          bindingSource: binding.source,
        };
      }
      if (expr.expression.kind !== ts.SyntaxKind.ThisKeyword &&
          !(staticOwner && ts.isIdentifier(expr.expression) &&
            expr.expression.text === owner &&
            !bindings.get(callerKey)?.has(owner))) return undefined;
      const key = (staticOwner ? "static:" : "class:") +
        owner + "." + expr.name.text;
      return unique.has(key) ? { key } : undefined;
    }
    return undefined;
  };
  const ownerRegion = (key: string): string =>
    key.startsWith("class:") || key.startsWith("static:")
      ? key.replaceAll("::", "/")
      : "function:" + key.replaceAll("::", "/");
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
  // A source-only fallible leaf requires either a guarded setter result
  // returning false/null, or one direct setter in try with a single literal
  // false/null catch-return. Throw reachability, backend recovery and
  // transaction success remain UNKNOWN. Other error shapes are not inferred.
  // Bounded forwarding traces SAME-FILE facts, not durable runtime proof.
  interface FailureTrace {
    readonly failedReturnSource: SourceRef;
    readonly caughtStorageExceptionWriteSource?: SourceRef;
    readonly forwardingReturnSources: readonly SourceRef[];
    readonly receiverBindingSources: readonly SourceRef[];
    readonly names: readonly string[];
  }
  const fallible = new Map<string, FailureTrace>();
  for (const [name, fn] of unique) {
    // An async call yields a Promise rather than a directly checked
    // false/null result. Do not promote it as a synchronous failure.
    if (!fn.body ||
        fn.modifiers?.some(mod => mod.kind === ts.SyntaxKind.AsyncKeyword)) continue;
    const failed: {
      readonly failedReturnSource: SourceRef;
      readonly caughtStorageExceptionWriteSource?: SourceRef;
    }[] = [];
    // A direct terminal finally return/throw overrides a return made by
    // the guarded storage-write branch. Such a branch does NOT establish
    // that false/null reaches callers; keep its propagation UNKNOWN.
    // Only the direct unconditional terminal is modeled. Nested and
    // conditional finalizers remain source-uncertain, never success proof.
    const overriddenByFinally = (node: ts.Node): boolean => {
      for (let ancestor: ts.Node | undefined = node.parent;
           ancestor && ancestor !== fn; ancestor = ancestor.parent) {
        if (!ts.isBlock(ancestor) ||
            !ts.isTryStatement(ancestor.parent) ||
            ancestor.parent.tryBlock !== ancestor) continue;
        const last = ancestor.parent.finallyBlock?.statements.at(-1);
        if (last && (ts.isReturnStatement(last) ||
                     ts.isThrowStatement(last))) return true;
      }
      return false;
    };
    const isWrite = (node: ts.Node): node is ts.CallExpression =>
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      (node.expression.name.text === "set" ||
       node.expression.name.text === "setDynamicProperty");
    // A computed call argument or opaque receiver can throw *before* the
    // setter is invoked. A catch-return then cannot be attributed to the
    // storage write without more source facts; abstain from that shortcut.
    const directValue = (arg: ts.Expression): boolean =>
      ts.isIdentifier(arg) || ts.isStringLiteralLike(arg) ||
      ts.isNumericLiteral(arg) ||
      arg.kind === ts.SyntaxKind.TrueKeyword ||
      arg.kind === ts.SyntaxKind.FalseKeyword ||
      arg.kind === ts.SyntaxKind.NullKeyword;
    const directReceiver = (expr: ts.Expression): boolean =>
      ts.isIdentifier(expr) || expr.kind === ts.SyntaxKind.ThisKeyword ||
      (ts.isPropertyAccessExpression(expr) &&
       expr.expression.kind === ts.SyntaxKind.ThisKeyword &&
       !expr.questionDotToken);
    walkBody(fn.body, fn, node => {
      if (ts.isTryStatement(node)) {
        // Only one direct setter and one direct literal catch-return are
        // eligible. Other throwing work, retry, rollback or a nonempty
        // finally leaves source failure propagation UNKNOWN.
        const attempts = node.tryBlock.statements;
        const handler = node.catchClause?.block.statements;
        const attempt = attempts.length === 1 &&
            ts.isExpressionStatement(attempts[0]!) &&
            ts.isCallExpression(attempts[0]!.expression)
          ? attempts[0]!.expression : undefined;
        const caught = handler?.length === 1 &&
            ts.isReturnStatement(handler[0]!)
          ? handler[0] : undefined;
        if (attempt && isWrite(attempt) &&
            !attempt.questionDotToken &&
            ts.isPropertyAccessExpression(attempt.expression) &&
            !attempt.expression.questionDotToken &&
            directReceiver(attempt.expression.expression) &&
            attempt.arguments.length === 2 &&
            attempt.arguments.every(directValue) &&
            caught?.expression &&
            (caught.expression.kind === ts.SyntaxKind.FalseKeyword ||
             caught.expression.kind === ts.SyntaxKind.NullKeyword) &&
            (node.finallyBlock?.statements.length ?? 0) === 0 &&
            !overriddenByFinally(attempts[0]!)) {
          failed.push({
            failedReturnSource: site(caught),
            caughtStorageExceptionWriteSource: site(attempt),
          });
        }
        return;
      }
      if (!ts.isIfStatement(node) || overriddenByFinally(node)) return;
      const then = ts.isBlock(node.thenStatement)
        ? node.thenStatement.statements[0]
        : node.thenStatement;
      if (!then || !ts.isReturnStatement(then) || !then.expression ||
          (then.expression.kind !== ts.SyntaxKind.FalseKeyword &&
           then.expression.kind !== ts.SyntaxKind.NullKeyword)) return;
      const condition = node.expression;
      if (ts.isPrefixUnaryExpression(condition) &&
          condition.operator === ts.SyntaxKind.ExclamationToken &&
          isWrite(condition.operand)) failed.push({ failedReturnSource: site(then) });
      if (ts.isBinaryExpression(condition) &&
          condition.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken &&
          condition.right.kind === ts.SyntaxKind.FalseKeyword &&
          isWrite(condition.left)) failed.push({ failedReturnSource: site(then) });
    });
    if (failed.length > 0) {
      fallible.set(name, {
        failedReturnSource: failed[0]!.failedReturnSource,
        ...(failed[0]!.caughtStorageExceptionWriteSource === undefined ? {} : {
          caughtStorageExceptionWriteSource:
            failed[0]!.caughtStorageExceptionWriteSource,
        }),
        forwardingReturnSources: [],
        receiverBindingSources: [],
        names: [name],
      });
    }
  }
  // No guessing through aliases, async, member dispatch, conditional/logical
  // expressions, nested functions or unbounded chains. Snapshotting each
  // iteration prevents declaration order from silently increasing depth.
  for (let hop = 0; hop < 2; hop++) {
    const earlier = new Map(fallible);
    for (const [name, fn] of unique) {
      if (fallible.has(name) || !fn.body || !ts.isBlock(fn.body) ||
          fn.modifiers?.some(mod => mod.kind === ts.SyntaxKind.AsyncKeyword)) continue;
      const last = fn.body.statements.at(-1);
      if (!last || !ts.isReturnStatement(last) ||
          !last.expression || !ts.isCallExpression(last.expression) ||
          last.expression.questionDotToken) continue;
      const resolved = resolveCall(name, last.expression.expression);
      const underlying = resolved === undefined ? undefined : earlier.get(resolved.key);
      if (!underlying || underlying.names.includes(name)) continue;
      fallible.set(name, {
        failedReturnSource: underlying.failedReturnSource,
        ...(underlying.caughtStorageExceptionWriteSource === undefined ? {} : {
          caughtStorageExceptionWriteSource:
            underlying.caughtStorageExceptionWriteSource,
        }),
        forwardingReturnSources: [site(last), ...underlying.forwardingReturnSources],
        receiverBindingSources: [
          ...(resolved?.bindingSource ? [site(resolved.bindingSource)] : []),
          ...underlying.receiverBindingSources,
        ],
        names: [name, ...underlying.names],
      });
    }
  }
  if (fallible.size === 0) return [];
  const feedbackMethods = new Set([
    "enqueue", "sendMessage", "setTitle", "setActionBar", "show",
  ]);
  const output: IgnoredCommitBeforeFeedbackCandidate[] = [];
  for (const [callerName, fn] of unique) {
    if (!fn.body || !ts.isBlock(fn.body)) continue;
    // Call-site binding resolution is shared with return forwarding.
    // A class method, nested closure or global function cannot borrow a
    // same-named callable belonging to another lexical owner.
    walkBody(fn.body, fn, node => {
      if (!ts.isBlock(node)) return;
      // Catch/finally may compensate or transform the source outcome.
      // A try-owned block does not prove a simple straight-line commit.
      for (let parent: ts.Node | undefined = node.parent;
           parent && parent !== fn; parent = parent.parent) {
        if (ts.isTryStatement(parent) || ts.isCatchClause(parent)) return;
      }
      for (const [index, statement] of node.statements.entries()) {
        if (!ts.isExpressionStatement(statement) ||
            !ts.isCallExpression(statement.expression) ||
            statement.expression.questionDotToken) continue;
        const resolved = resolveCall(callerName, statement.expression.expression);
        const failure = resolved === undefined ? undefined : fallible.get(resolved.key);
        if (!failure) continue;
        const calleeName = statement.expression.expression.getText(file);
        let write: SourceRef | undefined;
        let feedback: SourceRef | undefined;
        // Source-visible adjacent siblings only. A branch, try/catch,
        // unmodeled call or possible compensation is a deciding-proof gap:
        // do not gather unrelated nested write/feedback as a success path.
        for (const later of node.statements.slice(index + 1)) {
          if (!ts.isExpressionStatement(later) ||
              !ts.isCallExpression(later.expression) ||
              !ts.isPropertyAccessExpression(later.expression.expression)) break;
          const method = later.expression.expression.name.text;
          if (method === "set" || method === "setDynamicProperty") {
            if (!write) write = site(later.expression);
          } else if (feedbackMethods.has(method)) {
            if (!feedback) feedback = site(later.expression);
          } else break;
          if (write && feedback) break;
        }
        if (!write || !feedback) continue;
        output.push({
          scriptId: script.identifier,
          callerRegion: ownerRegion(callerName),
          calleeName,
          callSource: site(statement.expression),
          failedReturnSource: failure.failedReturnSource,
          ...(failure.caughtStorageExceptionWriteSource === undefined ? {} : {
            caughtStorageExceptionWriteSource:
              failure.caughtStorageExceptionWriteSource,
          }),
          ...(failure.forwardingReturnSources.length === 0 ? {} : {
            forwardingReturnSources: failure.forwardingReturnSources,
            failurePropagationPath: failure.names,
          }),
          ...((resolved?.bindingSource || failure.receiverBindingSources.length) ? {
            receiverBindingSources: [
              ...(resolved?.bindingSource ? [site(resolved.bindingSource)] : []),
              ...failure.receiverBindingSources,
            ],
          } : {}),
          laterWriteSource: write,
          laterFeedbackSource: feedback,
          proof: "SOURCE_FAILURE_PATH_AND_SUCCESS_CANDIDATE_NOT_PROVEN_BUG",
        });
      }
    });
    // A distinct path shape can discard a fallible commit AFTER mutating
    // state, then publish feedback outside the enclosing if block.
    // Keep this conservative: the call must be a bare final statement in a
    // direct, single-arm block, preceded by a direct state write. Feedback
    // must be a straight-line sibling (not a possibly unrelated branch).
    // Example: if (ready) { state.set(...); commit(); } ui.setActionBar(...).
    for (const [index, statement] of fn.body.statements.entries()) {
      if (!ts.isIfStatement(statement) || statement.elseStatement ||
          !ts.isBlock(statement.thenStatement)) continue;
      const branch = statement.thenStatement.statements;
      const last = branch.at(-1);
      if (!last || !ts.isExpressionStatement(last) ||
          !ts.isCallExpression(last.expression) ||
          last.expression.questionDotToken) continue;
      const resolved = resolveCall(callerName, last.expression.expression);
      const failure = resolved === undefined ? undefined : fallible.get(resolved.key);
      if (!failure) continue;
      const calleeName = last.expression.expression.getText(file);
      let precedingWrite: SourceRef | undefined;
      for (const prior of branch.slice(0, -1)) {
        if (!ts.isExpressionStatement(prior) ||
            !ts.isCallExpression(prior.expression) ||
            !ts.isPropertyAccessExpression(prior.expression.expression)) continue;
        if (prior.expression.expression.name.text === "set" ||
            prior.expression.expression.name.text === "setDynamicProperty") {
          precedingWrite = site(prior.expression);
        }
      }
      if (!precedingWrite) continue;
      let feedback: SourceRef | undefined;
      for (const later of fn.body.statements.slice(index + 1)) {
        // An intervening branch/exit makes reachability uncertain; abstain.
        if (ts.isReturnStatement(later) || ts.isThrowStatement(later) ||
            ts.isIfStatement(later) || ts.isTryStatement(later) ||
            ts.isForStatement(later) || ts.isForOfStatement(later) ||
            ts.isForInStatement(later) || ts.isWhileStatement(later) ||
            ts.isDoStatement(later) || ts.isSwitchStatement(later)) break;
        if (!ts.isExpressionStatement(later) ||
            !ts.isCallExpression(later.expression) ||
            !ts.isPropertyAccessExpression(later.expression.expression)) break;
        if (feedbackMethods.has(later.expression.expression.name.text)) {
          feedback = site(later.expression);
        }
        // Unmodeled intervening effects may retry, compensate or redirect
        // the outcome. Do not borrow later feedback from another source path.
        break;
      }
      if (!feedback) continue;
      output.push({
        scriptId: script.identifier,
        callerRegion: ownerRegion(callerName),
        calleeName,
        callSource: site(last.expression),
        failedReturnSource: failure.failedReturnSource,
        ...(failure.caughtStorageExceptionWriteSource === undefined ? {} : {
          caughtStorageExceptionWriteSource:
            failure.caughtStorageExceptionWriteSource,
        }),
        ...(failure.forwardingReturnSources.length === 0 ? {} : {
          forwardingReturnSources: failure.forwardingReturnSources,
          failurePropagationPath: failure.names,
        }),
        ...((resolved?.bindingSource || failure.receiverBindingSources.length) ? {
          receiverBindingSources: [
            ...(resolved?.bindingSource ? [site(resolved.bindingSource)] : []),
            ...failure.receiverBindingSources,
          ],
        } : {}),
        precedingWriteSource: precedingWrite,
        laterFeedbackSource: feedback,
        proof: "SOURCE_FAILURE_PATH_AND_SUCCESS_CANDIDATE_NOT_PROVEN_BUG",
      });
    }
  }
  return output.sort((a, b) =>
    a.callSource.relativePath.localeCompare(b.callSource.relativePath) ||
    (a.callSource.range?.lineStart ?? 0) - (b.callSource.range?.lineStart ?? 0) ||
    (a.callSource.range?.columnStart ?? 0) - (b.callSource.range?.columnStart ?? 0));
}

/** Reuse exact parser call, declaration, block and storage setter evidence.
 * Direct storage.set(key, value) and same-class write-wrapper calls share
 * one bounded lexical pairing rule; neither proves atomicity or gameplay.
 */
function sequentialCounterBeforePayload(
  script: ParsedScriptFile,
): readonly SequentialCounterBeforePayloadCandidate[] {
  const storageReceiver = (value: string): boolean =>
    /^this\.(?:storage|store|database|db|journal)$/.test(value);
  const stores = new Map<string, SourceRef>();
  for (const site of script.unresolvedReceiverCalls ?? []) {
    if (site.method !== "set" || !storageReceiver(site.receiverExpression) ||
        site.source.artifactId !== script.source.artifactId ||
        site.source.relativePath !== script.source.relativePath) continue;
    if (!stores.has(site.executionRegion))
      stores.set(site.executionRegion, site.source);
  }
  const literal = (s: string | undefined): string | undefined =>
    /^(['"])([A-Za-z0-9_.:-]{1,96})\1$/.exec(s?.trim() ?? "")?.[2];
  const inc = (s: string | undefined): boolean =>
    /^[A-Za-z_$][\w$]*\s*\+\s*1$/.test(s?.trim() ?? "");
  const separateKeyCandidate = (s: string | undefined, first: string): boolean => {
    if (!s) return false;
    const constant = literal(s);
    if (constant !== undefined) return constant !== first;
    const value = s.trim();
    return value.charCodeAt(0) === 96 &&
      value.charCodeAt(value.length - 1) === 96 &&
      value.includes("$" + "{");
  };
  type Write = {
    readonly callerRegion: string;
    readonly argumentExpressions: readonly string[];
    readonly source: SourceRef;
    readonly sourceSequence: NonNullable<
      ParsedScriptFile["localFunctionCalls"][number]["sourceSequence"]
    >;
    readonly storageSetSource: SourceRef;
  };
  const groups = new Map<string, Write[]>();
  const add = (kind: string, target: string, write: Write): void => {
    // Include exact containing block in the key. Comparing every write
    // against writes in unrelated branches would waste quadratic work.
    const block = exactSourceToken(write.sourceSequence.block);
    if (block === undefined) return;
    const key = JSON.stringify([kind, write.callerRegion, target, block]);
    const group = groups.get(key) ?? [];
    group.push(write);
    groups.set(key, group);
  };

  // Existing same-class writer wrapper: this.write(counter, n+1)
  // followed by this.write(payload, record).
  for (const call of script.localFunctionCalls) {
    const store = stores.get(call.targetRegion);
    const targetSource = call.targetSource &&
      exactSourceToken(call.targetSource);
    if (!store || call.argumentExpressions?.length !== 2 ||
        targetSource === undefined || !call.sourceSequence?.directCall ||
        call.source.artifactId !== script.source.artifactId ||
        call.source.relativePath !== script.source.relativePath ||
        call.targetSource?.artifactId !== script.source.artifactId ||
        call.targetSource?.relativePath !== script.source.relativePath) continue;
    add("wrapper", JSON.stringify([call.targetRegion, targetSource]), {
      callerRegion: call.callerRegion,
      argumentExpressions: call.argumentExpressions,
      source: call.source,
      sourceSequence: call.sourceSequence,
      storageSetSource: store,
    });
  }

  // Direct same-receiver storage calls need no extra AST traversal. The
  // generic parser already provides exact arguments and direct-block order.
  // Receiver rebinding, backend transaction semantics and exception recovery
  // remain unproven; this is an investigation candidate, never BUG proof.
  for (const site of script.unresolvedReceiverCalls ?? []) {
    if (site.method !== "set" || !storageReceiver(site.receiverExpression) ||
        site.argumentExpressions?.length !== 2 ||
        !site.sourceSequence?.directCall ||
        site.source.artifactId !== script.source.artifactId ||
        site.source.relativePath !== script.source.relativePath) continue;
    add("direct", site.receiverExpression, {
      callerRegion: site.executionRegion,
      argumentExpressions: site.argumentExpressions,
      source: site.source,
      sourceSequence: site.sourceSequence,
      storageSetSource: site.source,
    });
  }

  const found: SequentialCounterBeforePayloadCandidate[] = [];
  for (const calls of groups.values()) {
    const sorted = [...calls].sort((a, b) =>
      a.sourceSequence.statementIndex - b.sourceSequence.statementIndex);
    let selected = false;
    for (const first of sorted) {
      if (selected) break;
      const counterKey = literal(first.argumentExpressions[0]);
      if (!counterKey || !inc(first.argumentExpressions[1])) continue;
      for (const second of sorted) {
        if (second.sourceSequence.statementIndex <= first.sourceSequence.statementIndex ||
            !sameSequentialBlock(first.sourceSequence.block, second.sourceSequence.block) ||
            !separateKeyCandidate(second.argumentExpressions[0], counterKey) ||
            inc(second.argumentExpressions[1])) continue;
        found.push({
          scriptId: script.identifier,
          callerRegion: first.callerRegion,
          counterKey,
          firstWriteSource: first.source,
          payloadWriteSource: second.source,
          storageSetSource: first.storageSetSource,
          proof: "SOURCE_ORDERED_COUNTER_PAYLOAD_NOT_ATOMICITY_PROOF",
        });
        selected = true;
        break;
      }
    }
  }
  return found.sort((a, b) =>
    a.firstWriteSource.relativePath.localeCompare(b.firstWriteSource.relativePath) ||
    (a.firstWriteSource.range?.lineStart ?? 0) - (b.firstWriteSource.range?.lineStart ?? 0) ||
    (a.firstWriteSource.range?.columnStart ?? 0) - (b.firstWriteSource.range?.columnStart ?? 0));
}


/** Bounded source-only alternative for a directly imported class whose
 * fallible write result is discarded immediately before feedback. Unlike
 * same-file lexical resolution, this requires an exact unique named ESM
 * import, same-artifact file, exported class, one constructor binding and
 * a terminal false/null fallback after a directly paired write/success
 * path without modeled compensation. Other paths remain UNKNOWN. No
 * dynamic modules, aliases, virtual paths, reexports or runtime claims.
 */
function crossFileIgnoredWriteBeforeFeedback(
  scripts: readonly ParsedScriptFile[],
  sourceAsts: ReadonlyMap<ParsedScriptFile, ts.SourceFile>,
): readonly IgnoredCommitBeforeFeedbackCandidate[] {
  type Entry = { readonly script: ParsedScriptFile; readonly file: ts.SourceFile };
  const bySourcePath = new Map<string, Entry[]>();
  const makeKey = (artifactId: string, relativePath: string): string =>
    JSON.stringify([artifactId, relativePath]);
  for (const script of scripts) {
    if (!script.text || !script.source.artifactId.trim() ||
        !script.source.relativePath.trim()) continue;
    const file = sourceAsts.get(script);
    if (file === undefined) continue;
    const key = makeKey(script.source.artifactId, script.source.relativePath);
    bySourcePath.set(key, [...(bySourcePath.get(key) ?? []), { script, file }]);
  }
  const site = (entry: Entry, node: ts.Node): SourceRef => {
    const start = entry.file.getLineAndCharacterOfPosition(node.getStart(entry.file));
    const end = entry.file.getLineAndCharacterOfPosition(node.getEnd());
    return { ...entry.script.source, range: {
      lineStart: start.line + 1, columnStart: start.character + 1,
      lineEnd: end.line + 1, columnEnd: end.character + 1,
    } };
  };
  const hasModifier = (node: ts.HasModifiers, kind: ts.SyntaxKind): boolean =>
    ts.getModifiers(node)?.some(mod => mod.kind === kind) ?? false;
  const feedbackMethods = new Set([
    "enqueue", "sendMessage", "setTitle", "setActionBar", "show",
  ]);
  const writeMethods = new Set(["set", "setScore", "setDynamicProperty"]);
  // An arbitrary write somewhere in try is not a source-coupled success.
  // Require an authored setter followed immediately by return true.
  const isWriteThenTrue = (statements: readonly ts.Statement[]): boolean => {
    if (statements.length < 2) return false;
    const write = statements[statements.length - 2]!;
    const success = statements[statements.length - 1]!;
    return ts.isExpressionStatement(write) &&
      ts.isCallExpression(write.expression) &&
      !write.expression.questionDotToken &&
      ts.isPropertyAccessExpression(write.expression.expression) &&
      !write.expression.expression.questionDotToken &&
      writeMethods.has(write.expression.expression.name.text) &&
      ts.isReturnStatement(success) &&
      success.expression?.kind === ts.SyntaxKind.TrueKeyword;
  };
  const hasSourceCoupledSuccess = (block: ts.Block): boolean =>
    isWriteThenTrue(block.statements) ||
    block.statements.some(statement => {
      if (!ts.isIfStatement(statement) || statement.elseStatement ||
          !(ts.isIdentifier(statement.expression) ||
            (ts.isPropertyAccessExpression(statement.expression) &&
              !statement.expression.questionDotToken))) return false;
      const branch = ts.isBlock(statement.thenStatement)
        ? statement.thenStatement.statements : [statement.thenStatement];
      return isWriteThenTrue(branch);
    });
  const hasNestedCall = (node: ts.Node): boolean => {
    let found = false;
    const visit = (current: ts.Node): void => {
      if (ts.isCallExpression(current) || ts.isNewExpression(current)) {
        found = true; return;
      }
      ts.forEachChild(current, visit);
    };
    visit(node);
    return found;
  };
  const nonCompensatingCatch = (block: ts.Block): boolean =>
    block.statements.every(statement => {
      if (!ts.isExpressionStatement(statement) ||
          !ts.isCallExpression(statement.expression) ||
          statement.expression.questionDotToken ||
          !ts.isPropertyAccessExpression(statement.expression.expression) ||
          statement.expression.expression.questionDotToken) return false;
      const method = statement.expression.expression;
      return ts.isIdentifier(method.expression) &&
        method.expression.text === "console" &&
        (method.name.text === "warn" ||
          method.name.text === "log" || method.name.text === "error") &&
        statement.expression.arguments.every(arg => !hasNestedCall(arg));
    });
  const result: IgnoredCommitBeforeFeedbackCandidate[] = [];

  for (const entries of bySourcePath.values()) {
    if (entries.length !== 1) continue;
    const caller = entries[0]!;
    const imported = new Map<string, {
      readonly target: Entry;
      readonly definition: ts.ClassDeclaration;
      readonly source: ts.ImportDeclaration;
    }>();
    for (const statement of caller.file.statements) {
      if (!ts.isImportDeclaration(statement) ||
          !ts.isStringLiteralLike(statement.moduleSpecifier) ||
          !statement.moduleSpecifier.text.startsWith(".") ||
          !statement.importClause?.namedBindings ||
          !ts.isNamedImports(statement.importClause.namedBindings)) continue;
      const relativePath = posix.normalize(posix.join(
        posix.dirname(caller.script.source.relativePath),
        statement.moduleSpecifier.text,
      ));
      const targetEntries = bySourcePath.get(makeKey(
        caller.script.source.artifactId, relativePath,
      ));
      if (targetEntries?.length !== 1) continue;
      const target = targetEntries[0]!;
      for (const named of statement.importClause.namedBindings.elements) {
        // Aliases introduce possible class-name shadowing; do not guess.
        if (named.propertyName || !ts.isIdentifier(named.name)) continue;
        const definitions = target.file.statements.filter((node):
          node is ts.ClassDeclaration =>
            ts.isClassDeclaration(node) &&
            node.name?.text === named.name.text &&
            hasModifier(node, ts.SyntaxKind.ExportKeyword));
        if (definitions.length !== 1 || imported.has(named.name.text)) {
          imported.delete(named.name.text);
          continue;
        }
        imported.set(named.name.text, {
          target, definition: definitions[0]!, source: statement,
        });
      }
    }
    if (imported.size === 0) continue;

    for (const definition of caller.file.statements) {
      if (!ts.isClassDeclaration(definition) || !definition.name ||
          definition.heritageClauses?.length) continue;
      const ctor = definition.members.find(ts.isConstructorDeclaration);
      if (!ctor?.body) continue;
      const fieldWrites = new Map<string, ts.Node[]>();
      let opaqueReceiverWrite = false;
      const recordFieldWrite = (field: string, node: ts.Node): void => {
        fieldWrites.set(field, [...(fieldWrites.get(field) ?? []), node]);
      };
      const thisField = (node: ts.Node): string | undefined => {
        if (ts.isPropertyAccessExpression(node) &&
            node.expression.kind === ts.SyntaxKind.ThisKeyword) {
          return node.name.text;
        }
        if (ts.isElementAccessExpression(node) &&
            node.expression.kind === ts.SyntaxKind.ThisKeyword) {
          if (node.argumentExpression &&
              ts.isStringLiteralLike(node.argumentExpression)) {
            return node.argumentExpression.text;
          }
          // Unknown computed receiver may alias the constructor field.
          opaqueReceiverWrite = true;
        }
        return undefined;
      };
      const trackMutationTarget = (target: ts.Node, node: ts.Node): void => {
        const direct = thisField(target);
        if (direct !== undefined) recordFieldWrite(direct, node);
        if (ts.isPropertyAccessExpression(target) ||
            ts.isElementAccessExpression(target)) {
          // A method replacement (this.field.fn = ...) invalidates the
          // imported-method identity even if this.field itself is unchanged.
          const nested = thisField(target.expression);
          if (nested !== undefined) recordFieldWrite(nested, node);
        }
      };
      const collectWrites = (node: ts.Node): void => {
        if (ts.isBinaryExpression(node) &&
            node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
            node.operatorToken.kind <= ts.SyntaxKind.LastAssignment) {
          trackMutationTarget(node.left, node);
        }
        if (ts.isPrefixUnaryExpression(node) ||
            ts.isPostfixUnaryExpression(node)) {
          trackMutationTarget(node.operand, node);
        }
        if (ts.isDeleteExpression(node)) {
          trackMutationTarget(node.expression, node);
        }
        ts.forEachChild(node, collectWrites);
      };
      ts.forEachChild(definition, collectWrites);
      if (opaqueReceiverWrite) continue;
      const boundFields = new Map<string, {
        readonly target: Entry;
        readonly source: ts.ImportDeclaration;
        readonly definition: ts.ClassDeclaration;
        readonly initialization: ts.BinaryExpression;
      }>();
      for (const statement of ctor.body.statements) {
        if (!ts.isExpressionStatement(statement) ||
            !ts.isBinaryExpression(statement.expression)) continue;
        const assignment = statement.expression;
        if (assignment.operatorToken.kind !== ts.SyntaxKind.EqualsToken ||
            !ts.isPropertyAccessExpression(assignment.left) ||
            assignment.left.expression.kind !== ts.SyntaxKind.ThisKeyword ||
            !ts.isNewExpression(assignment.right) ||
            !ts.isIdentifier(assignment.right.expression)) continue;
        const constructorName = assignment.right.expression.text;
        const binding = imported.get(constructorName);
        const shadowedByConstructor = ctor.body.statements.some(s =>
          ts.isVariableStatement(s) &&
            s.declarationList.declarations.some(d =>
              ts.isIdentifier(d.name) && d.name.text === constructorName) ||
          ts.isFunctionDeclaration(s) && s.name?.text === constructorName ||
          ts.isClassDeclaration(s) && s.name?.text === constructorName);
        if (!binding || shadowedByConstructor ||
            (fieldWrites.get(assignment.left.name.text)?.length ?? 0) !== 1 ||
            fieldWrites.get(assignment.left.name.text)?.[0] !== assignment ||
            ctor.parameters.some(param =>
              ts.isIdentifier(param.name) &&
              param.name.text === constructorName)) {
          continue;
        }
        boundFields.set(assignment.left.name.text, {
          ...binding, initialization: assignment,
        });
      }
      if (boundFields.size === 0) continue;
      for (const method of definition.members) {
        if (!ts.isMethodDeclaration(method) || !method.body ||
            !ts.isIdentifier(method.name) ||
            hasModifier(method, ts.SyntaxKind.StaticKeyword)) continue;
        const visit = (node: ts.Node): void => {
          if (node !== method.body && ts.isFunctionLike(node)) return;
          if (ts.isBlock(node)) {
            for (let i = 0; i + 1 < node.statements.length; i += 1) {
              const statement = node.statements[i]!;
              const next = node.statements[i + 1]!;
              if (!ts.isExpressionStatement(statement) ||
                  !ts.isCallExpression(statement.expression) ||
                  !ts.isPropertyAccessExpression(statement.expression.expression)) continue;
              const call = statement.expression;
              const receiver = call.expression.expression;
              if (call.questionDotToken || call.expression.questionDotToken ||
                  !ts.isPropertyAccessExpression(receiver) ||
                  receiver.expression.kind !== ts.SyntaxKind.ThisKeyword ||
                  receiver.questionDotToken) continue;
              const bound = boundFields.get(receiver.name.text);
              if (!bound) continue;
              const implementations = bound.definition.members.filter((item):
                item is ts.MethodDeclaration =>
                  ts.isMethodDeclaration(item) && !!item.body &&
                  ts.isIdentifier(item.name) &&
                  item.name.text === call.expression.name.text &&
                  !hasModifier(item, ts.SyntaxKind.AsyncKeyword) &&
                  !hasModifier(item, ts.SyntaxKind.StaticKeyword));
              if (implementations.length !== 1) continue;
              const implementation = implementations[0]!;
              const last = implementation.body!.statements.at(-1);
              if (!last || !ts.isReturnStatement(last) || !last.expression ||
                  (last.expression.kind !== ts.SyntaxKind.FalseKeyword &&
                   last.expression.kind !== ts.SyntaxKind.NullKeyword)) continue;
              // The penultimate direct try must prove a paired write/true
              // return and no modeled compensation; otherwise stay UNKNOWN.
              const attempt = implementation.body!.statements.at(-2);
              if (!attempt || !ts.isTryStatement(attempt) ||
                  attempt.finallyBlock || !attempt.catchClause ||
                  !nonCompensatingCatch(attempt.catchClause.block) ||
                  !hasSourceCoupledSuccess(attempt.tryBlock) ||
                  !ts.isExpressionStatement(next) ||
                  !ts.isCallExpression(next.expression) ||
                  !ts.isPropertyAccessExpression(next.expression.expression) ||
                  !feedbackMethods.has(next.expression.expression.name.text))
                continue;
              result.push({
                scriptId: caller.script.identifier,
                callerRegion: "class:" + definition.name.text + "." + method.name.text,
                calleeName: call.expression.getText(caller.file),
                callSource: site(caller, call),
                failedReturnSource: site(bound.target, last),
                directFallibleWriteSource: site(caller, call),
                receiverBindingSources: [
                  site(caller, bound.source), site(caller, bound.initialization),
                ],
                receiverBindingKind: "direct-named-esm-class",
                laterFeedbackSource: site(caller, next.expression),
                proof: "SOURCE_FAILURE_PATH_AND_SUCCESS_CANDIDATE_NOT_PROVEN_BUG",
              });
            }
          }
          ts.forEachChild(node, visit);
        };
        visit(method.body);
      }
    }
  }
  return result.sort((a, b) =>
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

  // Both existing source detectors inspect the same immutable parsed
  // scripts. Parse each eligible source once per invocation; a transient
  // identity map is sufficient and does not persist proof or source state.
  const sourceAsts = new Map<ParsedScriptFile, ts.SourceFile>();
  for (const script of sourceReviewScripts) {
    if (!script.text || !script.source.artifactId.trim() ||
        !script.source.relativePath.trim() || sourceAsts.has(script)) continue;
    sourceAsts.set(script, ts.createSourceFile(
      script.source.relativePath, script.text, ts.ScriptTarget.Latest, true,
      /\.tsx?$/i.test(script.source.relativePath)
        ? ts.ScriptKind.TS : ts.ScriptKind.JS,
    ));
  }
  return {
    properties,
    ignoredCommitBeforeFeedback: [
      ...sourceReviewScripts.flatMap(script => {
        const file = sourceAsts.get(script);
        return file === undefined ? [] : ignoredCommitBeforeFeedback(script, file);
      }),
      ...crossFileIgnoredWriteBeforeFeedback(sourceReviewScripts, sourceAsts),
    ],
    sequentialCounterBeforePayload: sourceReviewScripts.flatMap(sequentialCounterBeforePayload),
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
