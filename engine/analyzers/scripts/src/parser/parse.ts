import ts from "typescript";
import { extractScriptWaveStages, extractScriptGameplayCatalog, extractScriptContentCollections, extractScriptContentUseSites } from "./source-gameplay-content.js";

export const SCRIPT_PARSER_REVISION =
  "m-bedrock-script-parser:2:typescript:" +
  ts.version;
import type { SourceRef } from "../../../../packages/project-model/src/index.js";
import type {
  DynamicPropertyAccess,
  ParsedScriptFile,
  RestrictedExecutionMutation,
  ScriptCapabilityUse,
  ScriptEventSubscription,
  ScriptEntityEventTrigger,
  ScriptDeferredCallback,
  ScriptLocalFunctionCall,
  ScriptImportedCallGuardSite,
  ScriptLexicalGuard,
  ScriptBlockMatchGuard,
  ScriptCommandLiteral,
  ScriptAuthoredPropertyMutation,
  ScriptUnresolvedReceiverCall,
  ScriptImport,
  ScriptImportedSymbol,
  ScriptModuleMemberAccess,
  ScriptEnumValueComparison,
  ScriptStateMutation,
  ScriptTransitionDeclaration,
  ScriptArenaAuthorityPath,
  ScriptTypeProperty,
  ScriptReturnOutcome,
  ScriptGuardedOutcome,
  ScriptGuardOperand,
  ScriptGuardPredicate,
  ScriptDeclaredMember,
  ScriptSpatialRoutePoint,
  ScriptSpatialOffsetTransform,
  ScriptSpatialTransformUse,
  ScriptSpatialContextOffsetSeries,
} from "../core/types.js";
import {
  inferScriptMethodCalls,
  inferScriptPropertyAccesses,
  inferScriptPropertyWrites,
} from "./receiver-inference.js";
import { inferExactCallArgumentParameterBindings, extractScriptClassWiring, extractScriptClassMapSites } from "./cross-file-call.js";
import { findScriptExecutionPrivilegeRule } from "../../../../packages/compatibility/src/index.js";
import { inferScriptLifecycleMemberExposures } from "../domains/lifecycle/lifecycle-exposure.js";
import {
  deriveCapturedGenerationGuardTransformHints,
  derivePersistenceIdempotencyGuardTransformHints,
} from "../repair/repair-transform-hints.js";
import {
  deriveArenaCapacityGuardTransformHints,
  deriveArenaStartOwnershipGuardTransformHints,
} from "../domains/arena/arena-repair-transform-hints.js";
import {
  correlateScriptArenaAuthorityPaths,
  deriveScriptArenaAuthorityEvidence,
  localExecutionRegionId as arenaEvidenceExecutionRegionId,
} from "../domains/arena/arena-authority-evidence.js";
import {
  derivePersistenceIdempotencyGuards,
} from "../domains/persistence/persistence-idempotency-evidence.js";
import { compileScriptSafeConfig } from "../config/safe-config-compiler.js";
import { deriveScriptSpatialWorldMutations } from "../domains/spatial/spatial-world-mutation.js";
import { deriveScriptSpatialMutations } from "../domains/spatial/spatial-mutation-evidence.js";
import { deriveScriptCleanupResourceEvidence } from "../domains/cleanup/cleanup-resource-evidence.js";
import { deriveScriptCombatLifecycleEvidence } from "../domains/combat/combat-lifecycle-evidence.js";
import { deriveScriptChunkLifecycleEvidence } from "../domains/chunk/chunk-lifecycle-evidence.js";
import { deriveScriptEconomyEvidence } from "../domains/economy/economy-evidence.js";
import {
  deriveScriptProgressionActorRegistryEvidence,
  deriveScriptProgressionActorSpawnEvidence,
  deriveScriptProgressionCounterEvidence,
} from "../domains/progression/progression-counter-evidence.js";
import { deriveScriptInventoryLifecycleEvidence } from "../domains/inventory/inventory-lifecycle-evidence.js";
import { deriveScriptGlobalLeaseEvidence } from "../domains/arena/global-lease-evidence.js";
import {
  derivePersistentDataLifecycleEvidence,
  deriveResultAuditRecordEvidence,
} from "../domains/persistence/persistent-data-lifecycle.js";
import { inferPersistentStateScopes } from "../domains/persistence/persistent-state-scope.js";
import { inferPersistentStateLifetimes } from "../domains/persistence/persistent-state-lifetime.js";
import { deriveBlockCustomComponentRegistrations } from "../domains/automation/block-custom-component-evidence.js";
import { deriveScriptControlFlow, sourceMethodRegion } from "../core/control-flow.js";
import { derivePersistentReconciliationEvidence } from "../domains/persistence/persistent-reconciliation.js";

function scriptKind(path: string): ts.ScriptKind {
  if (path.endsWith(".ts")) return ts.ScriptKind.TS;
  if (path.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (path.endsWith(".jsx")) return ts.ScriptKind.JSX;
  return ts.ScriptKind.JS;
}

function lineSource(sourceFile: ts.SourceFile, node: ts.Node, source: SourceRef): SourceRef {
  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
  return {
    ...source,
    range: {
      lineStart: start.line + 1,
      lineEnd: end.line + 1,
      columnStart: start.character + 1,
      columnEnd: end.character + 1,
    },
  };
}

/**
 * Exact nearest lexical statement container. This is source order only:
 * control flow, aliasing and callback execution remain separately proven.
 */
function sourceSequentialSite(
  node: ts.Node,
  file: ts.SourceFile,
  source: SourceRef,
  stableWorldReceiver = false,
): import("../../../../packages/project-model/src/index.js").SourceSequentialSite | undefined {
  let current: ts.Node = node;
  while (current.parent) {
    const parent = current.parent;
    if ((ts.isBlock(parent) || ts.isSourceFile(parent)) &&
        ts.isStatement(current)) {
      const index = parent.statements.indexOf(current);
      if (index < 0) return undefined;
      return {
        block: lineSource(file, parent, source),
        statementIndex: index,
        directCall: ts.isCallExpression(node) &&
          ts.isExpressionStatement(current) && current.expression === node,
        ...(stableWorldReceiver ? { stableWorldReceiver: true } : {}),
      };
    }
    if (ts.isFunctionLike(parent)) return undefined;
    current = parent;
  }
  return undefined;
}

function importBindings(node: ts.ImportDeclaration): string[] {
  const clause = node.importClause;
  if (!clause) return [];

  const bindings: string[] = [];
  if (clause.name) bindings.push(clause.name.text);

  const named = clause.namedBindings;
  if (named && ts.isNamespaceImport(named)) {
    bindings.push(named.name.text);
  } else if (named && ts.isNamedImports(named)) {
    for (const element of named.elements) bindings.push(element.name.text);
  }

  return bindings;
}


function minecraftNamedBindings(file: ts.SourceFile): Map<string, {
  module: string;
  importedName: string;
}> {
  const output = new Map<string, { module: string; importedName: string }>();

  for (const statement of file.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteralLike(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== "@minecraft/server" ||
      statement.importClause?.isTypeOnly
    ) {
      continue;
    }

    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;

    for (const element of bindings.elements) {
      if (element.isTypeOnly) continue;
      output.set(element.name.text, {
        module: "@minecraft/server",
        importedName: element.propertyName?.text ?? element.name.text,
      });
    }
  }

  return output;
}


function minecraftNamespaceBindings(file: ts.SourceFile): Map<string, string> {
  const output = new Map<string, string>();

  for (const statement of file.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteralLike(statement.moduleSpecifier)
    ) {
      continue;
    }

    const module = statement.moduleSpecifier.text;
    if (!module.startsWith("@minecraft/")) continue;

    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamespaceImport(bindings)) {
      output.set(bindings.name.text, module);
    }
  }

  return output;
}

function qualifiedNameChain(node: ts.EntityName): string[] {
  if (ts.isIdentifier(node)) return [node.text];
  return [...qualifiedNameChain(node.left), node.right.text];
}

function classifyModule(module: string): ScriptImport["kind"] {
  if (module.startsWith("@minecraft/")) return "minecraft";
  if (module.startsWith(".") || module.startsWith("/")) return "relative";
  return "external";
}

function propertyAccessChain(node: ts.Expression): string[] {
  const names: string[] = [];
  let current: ts.Expression = node;

  while (ts.isPropertyAccessExpression(current)) {
    names.unshift(current.name.text);
    current = current.expression;
  }

  if (ts.isIdentifier(current)) names.unshift(current.text);
  return names;
}

function runCommandStringContext(
  node: ts.StringLiteralLike,
  file: ts.SourceFile,
): {
  mechanism: "runCommand" | "runCommandAsync";
  executionRegion: string;
  receiverHint: string;
} | undefined {
  const parent = node.parent;
  if (!ts.isCallExpression(parent) || parent.arguments[0] !== node) {
    return undefined;
  }
  if (!ts.isPropertyAccessExpression(parent.expression)) return undefined;
  const method = parent.expression.name.text;
  if (method !== "runCommand" && method !== "runCommandAsync") {
    return undefined;
  }
  return {
    mechanism: method,
    executionRegion: localExecutionRegionId(parent, file),
    receiverHint: parent.expression.expression.getText(file),
  };
}

function stringArgument(node: ts.CallExpression, index = 0): string | undefined {
  const arg = node.arguments[index];
  return arg && ts.isStringLiteralLike(arg) ? arg.text : undefined;
}

function dynamicPropertyOperation(name: string): DynamicPropertyAccess["operation"] {
  if (name === "getDynamicProperty") return "get";
  if (name === "setDynamicProperty") return "set";
  if (name === "clearDynamicProperties") return "clear";
  if (name === "getDynamicPropertyIds") return "ids";
  if (name === "getDynamicPropertyTotalByteCount") return "size";
  return "unknown";
}

function callbackNode(call: ts.CallExpression): ts.Node | undefined {
  const candidate = call.arguments[0];
  if (
    candidate &&
    (ts.isArrowFunction(candidate) || ts.isFunctionExpression(candidate))
  ) {
    return candidate;
  }
  return undefined;
}

const GENERATION_GUARD_PATTERN =
  /(?:generation|epoch|revision|rev|token|operationId|sessionId|roundId|lifeId|entityId)/i;

function deferredScheduler(
  call: ts.CallExpression,
  file: ts.SourceFile,
  typedSchedulerSites: ReadonlySet<string>,
): ScriptDeferredCallback["scheduler"] | undefined {
  if (!ts.isPropertyAccessExpression(call.expression)) return undefined;
  const method = call.expression.name.text;
  const start = file.getLineAndCharacterOfPosition(call.getStart(file));
  // Reuse parser-typed System method calls. An unbound or shadowed
  // identifier named "system" is not scheduler evidence.
  if (!typedSchedulerSites.has(
    `${start.line + 1}:${start.character + 1}:${method}`,
  )) return undefined;

  if (
    method === "run" ||
    method === "runTimeout" ||
    method === "runInterval" ||
    method === "runJob"
  ) {
    return method;
  }
  return undefined;
}

/**
 * Only classify a *leading* generation-mismatch early exit. A comparison
 * mentioned anywhere in a callback is not a stale-work guard: it can occur
 * after a mutation, on the wrong branch, or only in a log expression.
 *
 * This remains a source candidate. It does NOT prove the compared token is
 * tied to the real session owner or that the callback will ever run.
 */
/**
 * Only an exact leading generation-mismatch exit counts as candidate source
 * gating. Both operands must be authored reference expressions, not constants
 * or arbitrary computation. This is NOT proof of session owner identity.
 */
function leadingGenerationGuard(
  node: ts.Node,
  file: ts.SourceFile,
  source: SourceRef,
): {
  identifiers: string[];
  guardSource: SourceRef;
  operands: readonly [string, string];
} | undefined {
  if (!ts.isArrowFunction(node) &&
      !ts.isFunctionExpression(node) &&
      !ts.isFunctionDeclaration(node)) return undefined;
  const body = node.body;
  if (!body || !ts.isBlock(body) || body.statements.length === 0) {
    return undefined;
  }
  const first = body.statements[0]!;
  if (!ts.isIfStatement(first) || first.elseStatement) return undefined;
  const earlyExit = (statement: ts.Statement): boolean =>
    ts.isReturnStatement(statement) || ts.isThrowStatement(statement) ||
    (ts.isBlock(statement) && statement.statements.length === 1 &&
      (ts.isReturnStatement(statement.statements[0]!) ||
       ts.isThrowStatement(statement.statements[0]!)));
  if (!earlyExit(first.thenStatement)) return undefined;
  const comparison = ts.isParenthesizedExpression(first.expression)
    ? first.expression.expression : first.expression;
  if (!ts.isBinaryExpression(comparison) ||
      (comparison.operatorToken.kind !== ts.SyntaxKind.ExclamationEqualsToken &&
       comparison.operatorToken.kind !== ts.SyntaxKind.ExclamationEqualsEqualsToken)) {
    return undefined;
  }
  // Requiring reference operands rejects comparisons like generation !== 0.
  // It does NOT prove that two references denote the actual session owner.
  const isReference = (value: ts.Expression): boolean =>
    ts.isIdentifier(value) || ts.isPropertyAccessExpression(value) ||
    ts.isElementAccessExpression(value);
  if (!isReference(comparison.left) || !isReference(comparison.right)) {
    return undefined;
  }
  const identifiers = new Set<string>();
  const visit = (candidate: ts.Node): void => {
    if (ts.isIdentifier(candidate) &&
        GENERATION_GUARD_PATTERN.test(candidate.text)) {
      identifiers.add(candidate.text);
    }
    if (ts.isPropertyAccessExpression(candidate) &&
        GENERATION_GUARD_PATTERN.test(candidate.name.text)) {
      identifiers.add(candidate.name.text);
    }
    ts.forEachChild(candidate, visit);
  };
  visit(comparison.left);
  visit(comparison.right);
  if (identifiers.size === 0) return undefined;
  return {
    identifiers: [...identifiers].sort(),
    guardSource: lineSource(file, first.expression, source),
    operands: [comparison.left.getText(file), comparison.right.getText(file)],
  };
}

function enclosingClassLike(
  node: ts.Node,
): ts.ClassDeclaration | ts.ClassExpression | undefined {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (
      ts.isClassDeclaration(current) ||
      ts.isClassExpression(current)
    ) {
      return current;
    }
    current = current.parent;
  }
  return undefined;
}

function directThisMethodTarget(
  call: ts.CallExpression,
): string | undefined {
  if (!ts.isPropertyAccessExpression(call.expression)) {
    return undefined;
  }
  if (call.expression.expression.kind !== ts.SyntaxKind.ThisKeyword) {
    return undefined;
  }

  const methodName = call.expression.name.text;
  const container = enclosingClassLike(call);
  if (!container) return undefined;

  const declared = container.members.some((member) => {
    if (!ts.isMethodDeclaration(member)) return false;
    return declarationMemberName(member.name) === methodName;
  });

  return declared ? methodName : undefined;
}

function statementMayExitFunction(
  node: ts.Node,
): boolean {
  if (
    ts.isReturnStatement(node) ||
    ts.isThrowStatement(node)
  ) {
    return true;
  }

  if (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node)
  ) {
    return false;
  }

  let found = false;
  ts.forEachChild(node, (child) => {
    if (!found && statementMayExitFunction(child)) {
      found = true;
    }
  });
  return found;
}

function hasPriorPossibleFunctionExit(
  node: ts.Node,
): boolean {
  let current: ts.Node | undefined = node;

  while (current?.parent) {
    const parent: ts.Node = current.parent;

    if (
      ts.isBlock(parent) &&
      ts.isStatement(current)
    ) {
      const index =
        parent.statements.indexOf(current);
      if (index > 0) {
        for (
          const previous of
            parent.statements.slice(0, index)
        ) {
          if (
            statementMayExitFunction(
              previous,
            )
          ) {
            return true;
          }
        }
      }
    }

    if (
      ts.isFunctionDeclaration(parent) ||
      ts.isFunctionExpression(parent) ||
      ts.isArrowFunction(parent) ||
      ts.isMethodDeclaration(parent)
    ) {
      break;
    }

    current = parent;
  }

  return false;
}

/** Only enclosing lexical branches, not inferred guards from previous exits. */
function lexicalBranchGuards(
  node: ts.Node,
  file: ts.SourceFile,
  source: SourceRef,
): ScriptLexicalGuard[] {
  const guards: ScriptLexicalGuard[] = [];
  let child: ts.Node = node;
  let parent = node.parent;
  while (parent) {
    // A nested callback does not inherit an outer caller's execution guard.
    if (ts.isFunctionLike(parent)) break;
    let expression: ts.Expression | undefined;
    let branch: "true" | "false" | undefined;
    if (ts.isIfStatement(parent)) {
      if (child === parent.thenStatement) {
        expression = parent.expression;
        branch = "true";
      } else if (child === parent.elseStatement) {
        expression = parent.expression;
        branch = "false";
      }
    } else if (ts.isConditionalExpression(parent)) {
      if (child === parent.whenTrue) {
        expression = parent.condition;
        branch = "true";
      } else if (child === parent.whenFalse) {
        expression = parent.condition;
        branch = "false";
      }
    } else if (ts.isBinaryExpression(parent) && child === parent.right) {
      if (parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
        expression = parent.left;
        branch = "true";
      } else if (parent.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
        expression = parent.left;
        branch = "false";
      }
    }
    if (expression && branch) {
      guards.unshift({
        conditionText: expression.getText(file),
        branch,
        predicate: guardPredicate(expression, file),
        source: lineSource(file, expression, source),
      });
    }
    child = parent;
    parent = parent.parent;
  }
  return guards;
}

/**
 * A prior if-branch with one direct return/throw forces the opposite
 * branch for any later statement in that same block. Only necessary
 * source-time decisions are retained. Nested/multi-statement exits, switch,
 * loop control, and both-branch exits remain outside this proof.
 */
function precedingEarlyExitGuards(
  node: ts.Node,
  file: ts.SourceFile,
  source: SourceRef,
): ScriptLexicalGuard[] {
  const definitelyExits = (statement: ts.Statement | undefined): boolean => {
    if (!statement) return false;
    if (ts.isReturnStatement(statement) || ts.isThrowStatement(statement)) {
      return true;
    }
    return ts.isBlock(statement) && statement.statements.length === 1 &&
      definitelyExits(statement.statements[0]);
  };
  const scopes: ScriptLexicalGuard[][] = [];
  let current: ts.Node = node;
  let parent = node.parent;
  while (parent) {
    if ((ts.isBlock(parent) || ts.isSourceFile(parent)) &&
        ts.isStatement(current)) {
      const index = parent.statements.indexOf(current);
      const guards: ScriptLexicalGuard[] = [];
      for (const previous of parent.statements.slice(0, Math.max(index, 0))) {
        if (!ts.isIfStatement(previous)) continue;
        const trueExits = definitelyExits(previous.thenStatement);
        const falseExits = definitelyExits(previous.elseStatement);
        if (trueExits === falseExits) continue;
        guards.push({
          conditionText: previous.expression.getText(file),
          branch: trueExits ? "false" : "true",
          predicate: guardPredicate(previous.expression, file),
          source: lineSource(file, previous.expression, source),
        });
      }
      if (guards.length) scopes.unshift(guards);
    }
    if (ts.isFunctionLike(parent)) break;
    current = parent;
    parent = parent.parent;
  }
  // Enclosing blocks precede inner blocks; each block remains source ordered.
  return scopes.flat();
}

function localCallControlFlow(
  node: ts.Node,
): "unconditional" | "conditional" | "deferred" {
  if (hasPriorPossibleFunctionExit(node)) {
    return "conditional";
  }

  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (
      ts.isIfStatement(current) ||
      ts.isConditionalExpression(current) ||
      ts.isCaseClause(current) ||
      ts.isDefaultClause(current)
    ) {
      return "conditional";
    }

    if (
      ts.isArrowFunction(current) ||
      ts.isFunctionExpression(current)
    ) {
      const parent = current.parent;
      if (
        ts.isCallExpression(parent) &&
        parent.arguments.includes(current) &&
        ts.isPropertyAccessExpression(parent.expression) &&
        /^(?:run|runTimeout|runInterval|runJob)$/.test(
          parent.expression.name.text,
        )
      ) {
        return "deferred";
      }
      return "unconditional";
    }

    if (
      ts.isFunctionDeclaration(current) ||
      ts.isMethodDeclaration(current)
    ) {
      return "unconditional";
    }

    current = current.parent;
  }
  return "unconditional";
}

function localExecutionRegionId(
  node: ts.Node,
  file: ts.SourceFile,
): string {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isFunctionDeclaration(current)) {
      return current.name
        ? "function:" + current.name.text
        : "anonymous-function";
    }
    if (ts.isMethodDeclaration(current)) {
      const name = declarationMemberName(current.name);
      if (name) return sourceMethodRegion(current, file);
    }
    if (
      ts.isArrowFunction(current) ||
      ts.isFunctionExpression(current)
    ) {
      const start = file.getLineAndCharacterOfPosition(current.getStart(file));
      return "callback@" + (start.line + 1) + ":" + (start.character + 1);
    }
    current = current.parent;
  }
  return "module";
}

/**
 * Join position-qualified arena evidence with parser/CFG region identity using
 * the SAME parsed AST. Unique source declarations only: a same-named nested
 * function must never inherit another declaration's arena authority.
 * This is a source-region correspondence, not a proof of a live arena.
 */
function bindArenaParserRegions(
  file: ts.SourceFile,
  paths: readonly ScriptArenaAuthorityPath[],
): ScriptArenaAuthorityPath[] {
  const candidates = new Map<string, string[]>();
  const canonicalCounts = new Map<string, number>();
  const visit = (node: ts.Node): void => {
    let parserRegion: string | undefined;
    let body: ts.Block | undefined;
    if (ts.isFunctionDeclaration(node) && node.body) {
      parserRegion = node.name
        ? "function:" + node.name.text
        : "anonymous-function";
      body = node.body;
    } else if (ts.isMethodDeclaration(node) && node.body &&
               ts.isIdentifier(node.name)) {
      parserRegion = sourceMethodRegion(node, file);
      body = node.body;
    }
    if (parserRegion !== undefined && body !== undefined) {
      const evidenceRegion =
        arenaEvidenceExecutionRegionId(body, file);
      candidates.set(evidenceRegion, [
        ...(candidates.get(evidenceRegion) ?? []), parserRegion,
      ]);
      canonicalCounts.set(parserRegion,
        (canonicalCounts.get(parserRegion) ?? 0) + 1);
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(file, visit);
  return paths.map(path => {
    const matches = candidates.get(path.executionRegion) ?? [];
    const parserRegion = matches.length === 1 ? matches[0] : undefined;
    return parserRegion !== undefined &&
      canonicalCounts.get(parserRegion) === 1
        ? { ...path, parserExecutionRegion: parserRegion }
        : path;
  });
}

function callbackExecutionRegionId(
  node: ts.Node,
  file: ts.SourceFile,
): string {
  const start = file.getLineAndCharacterOfPosition(node.getStart(file));
  return "callback@" + (start.line + 1) + ":" + (start.character + 1);
}

function directReturnStatements(
  statement: ts.Statement,
): ts.ReturnStatement[] {
  if (ts.isReturnStatement(statement)) return [statement];
  if (!ts.isBlock(statement)) return [];
  return statement.statements.filter(ts.isReturnStatement);
}

function outcomePropertiesFromReturn(
  node: ts.ReturnStatement,
): Array<{ propertyName: string; value: string; sourceNode: ts.Node }> {
  const expression = node.expression &&
    (ts.isParenthesizedExpression(node.expression)
      ? node.expression.expression
      : node.expression);
  if (!expression || !ts.isObjectLiteralExpression(expression)) return [];

  const output: Array<{
    propertyName: string;
    value: string;
    sourceNode: ts.Node;
  }> = [];

  for (const property of expression.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const propertyName =
      ts.isIdentifier(property.name) ||
      ts.isStringLiteralLike(property.name)
        ? property.name.text
        : undefined;
    if (!propertyName) continue;

    const initializer = property.initializer;
    const value =
      ts.isStringLiteralLike(initializer) ||
      ts.isNoSubstitutionTemplateLiteral(initializer)
        ? initializer.text
        : undefined;
    if (value === undefined) continue;

    output.push({
      propertyName,
      value,
      sourceNode: property,
    });
  }

  return output;
}

function declarationMemberName(
  node: ts.PropertyName | undefined,
): string | undefined {
  if (!node) return undefined;
  if (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) {
    return node.text;
  }
  return undefined;
}

function declarationContainerHint(
  node: ts.Node,
): string | undefined {
  const parent = node.parent;
  if (
    parent &&
    (ts.isClassDeclaration(parent) ||
      ts.isClassExpression(parent)) &&
    parent.name
  ) {
    return parent.name.text;
  }
  return undefined;
}

function numericLiteralValue(
  expression: ts.Expression,
): number | undefined {
  const value =
    ts.isParenthesizedExpression(expression)
      ? expression.expression
      : expression;

  if (ts.isNumericLiteral(value)) {
    const parsed = Number(value.text);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  if (
    ts.isPrefixUnaryExpression(value) &&
    (
      value.operator === ts.SyntaxKind.MinusToken ||
      value.operator === ts.SyntaxKind.PlusToken
    ) &&
    ts.isNumericLiteral(value.operand)
  ) {
    const parsed = Number(value.operand.text);
    if (!Number.isFinite(parsed)) return undefined;
    return value.operator === ts.SyntaxKind.MinusToken
      ? -parsed
      : parsed;
  }

  return undefined;
}

function objectPropertyAssignment(
  object: ts.ObjectLiteralExpression,
  names: readonly string[],
): ts.PropertyAssignment | undefined {
  const allowed = new Set(names);
  return object.properties.find((property) => {
    if (!ts.isPropertyAssignment(property)) return false;
    const name = declarationMemberName(property.name);
    return name !== undefined && allowed.has(name);
  }) as ts.PropertyAssignment | undefined;
}

function spatialRouteCollectionHint(
  node: ts.ObjectLiteralExpression,
): string | undefined {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isVariableDeclaration(current)) {
      return ts.isIdentifier(current.name)
        ? current.name.text
        : undefined;
    }
    if (ts.isPropertyAssignment(current)) {
      return declarationMemberName(current.name);
    }
    if (
      ts.isFunctionDeclaration(current) ||
      ts.isMethodDeclaration(current) ||
      ts.isFunctionExpression(current) ||
      ts.isArrowFunction(current) ||
      ts.isSourceFile(current)
    ) {
      break;
    }
    current = current.parent;
  }
  return undefined;
}

function spatialRoutePointFromObject(
  node: ts.ObjectLiteralExpression,
  file: ts.SourceFile,
  source: SourceRef,
): ScriptSpatialRoutePoint | undefined {
  const routeProperty = objectPropertyAssignment(
    node,
    ["route", "routeId", "lane", "pathRoute"],
  );
  if (
    !routeProperty ||
    !ts.isStringLiteralLike(routeProperty.initializer)
  ) {
    return undefined;
  }

  const locationProperty = objectPropertyAssignment(
    node,
    ["location", "position", "point"],
  );
  if (
    !locationProperty ||
    !ts.isObjectLiteralExpression(
      locationProperty.initializer,
    )
  ) {
    return undefined;
  }

  const location = locationProperty.initializer;
  const xProperty = objectPropertyAssignment(location, ["x"]);
  const yProperty = objectPropertyAssignment(location, ["y"]);
  const zProperty = objectPropertyAssignment(location, ["z"]);
  if (!xProperty || !yProperty || !zProperty) {
    return undefined;
  }

  const x = numericLiteralValue(xProperty.initializer);
  const y = numericLiteralValue(yProperty.initializer);
  const z = numericLiteralValue(zProperty.initializer);
  if (x === undefined || y === undefined || z === undefined) {
    return undefined;
  }

  const indexProperty = objectPropertyAssignment(
    node,
    ["pathIndex", "index", "order", "sequence"],
  );
  const index = indexProperty
    ? numericLiteralValue(indexProperty.initializer)
    : undefined;
  const collectionHint = spatialRouteCollectionHint(node);

  return {
    routeId: routeProperty.initializer.text,
    location: { x, y, z },
    ...(index === undefined ? {} : { index }),
    ...(collectionHint === undefined
      ? {}
      : { collectionHint }),
    source: lineSource(file, node, source),
  };
}

function spatialOffsetTransformFromFunction(
  node: ts.FunctionDeclaration,
  file: ts.SourceFile,
  source: SourceRef,
): ScriptSpatialOffsetTransform | undefined {
  if (!node.name || !node.body || node.parameters.length < 2) {
    return undefined;
  }

  const pointParameterNode = node.parameters[0]?.name;
  const contextParameterNode = node.parameters[1]?.name;
  if (
    !pointParameterNode ||
    !contextParameterNode ||
    !ts.isIdentifier(pointParameterNode) ||
    !ts.isIdentifier(contextParameterNode)
  ) {
    return undefined;
  }

  const returnStatement = node.body.statements.find(
    ts.isReturnStatement,
  );
  const returned = returnStatement?.expression;
  if (!returned || !ts.isObjectLiteralExpression(returned)) {
    return undefined;
  }

  const pointParameter = pointParameterNode.text;
  const contextParameter = contextParameterNode.text;
  let offsetPath: string | undefined;

  const axisMatches = (axis: "x" | "y" | "z"): boolean => {
    const property = objectPropertyAssignment(returned, [axis]);
    if (!property || !ts.isBinaryExpression(property.initializer)) {
      return false;
    }
    if (
      property.initializer.operatorToken.kind !==
      ts.SyntaxKind.PlusToken
    ) {
      return false;
    }

    const matchesPair = (
      pointSide: ts.Expression,
      offsetSide: ts.Expression,
    ): boolean => {
      if (
        !ts.isPropertyAccessExpression(pointSide) ||
        pointSide.name.text !== axis ||
        !ts.isIdentifier(pointSide.expression) ||
        pointSide.expression.text !== pointParameter
      ) {
        return false;
      }

      const chain = propertyAccessChain(offsetSide);
      if (
        chain.length !== 3 ||
        chain[0] !== contextParameter ||
        chain[2] !== axis
      ) {
        return false;
      }

      const candidateOffsetPath = chain[1];
      if (!candidateOffsetPath) return false;
      if (
        offsetPath !== undefined &&
        offsetPath !== candidateOffsetPath
      ) {
        return false;
      }
      offsetPath = candidateOffsetPath;
      return true;
    };

    return (
      matchesPair(
        property.initializer.left,
        property.initializer.right,
      ) ||
      matchesPair(
        property.initializer.right,
        property.initializer.left,
      )
    );
  };

  if (
    !axisMatches("x") ||
    !axisMatches("y") ||
    !axisMatches("z") ||
    offsetPath === undefined
  ) {
    return undefined;
  }

  return {
    functionName: node.name.text,
    pointParameter,
    contextParameter,
    offsetPath,
    source: lineSource(file, node, source),
  };
}

function spatialOffsetTransformsFromFile(
  file: ts.SourceFile,
  source: SourceRef,
): ScriptSpatialOffsetTransform[] {
  const output: ScriptSpatialOffsetTransform[] = [];
  for (const statement of file.statements) {
    if (!ts.isFunctionDeclaration(statement)) continue;
    const transform = spatialOffsetTransformFromFunction(
      statement,
      file,
      source,
    );
    if (transform) output.push(transform);
  }
  return output;
}

interface AffineScalar {
  base: number;
  stride: number;
}

function affineExpression(
  expression: ts.Expression,
  file: ts.SourceFile,
  values: ReadonlyMap<string, AffineScalar>,
  constants: ReadonlyMap<string, number>,
): AffineScalar | undefined {
  const value =
    ts.isParenthesizedExpression(expression)
      ? expression.expression
      : expression;

  const numeric = numericLiteralValue(value);
  if (numeric !== undefined) {
    return { base: numeric, stride: 0 };
  }

  if (ts.isIdentifier(value)) {
    const local = values.get(value.text);
    if (local) return local;
    const constant = constants.get(value.text);
    return constant === undefined
      ? undefined
      : { base: constant, stride: 0 };
  }

  if (!ts.isBinaryExpression(value)) return undefined;

  const left = affineExpression(
    value.left,
    file,
    values,
    constants,
  );
  const right = affineExpression(
    value.right,
    file,
    values,
    constants,
  );
  if (!left || !right) return undefined;

  switch (value.operatorToken.kind) {
    case ts.SyntaxKind.PlusToken:
      return {
        base: left.base + right.base,
        stride: left.stride + right.stride,
      };
    case ts.SyntaxKind.MinusToken:
      return {
        base: left.base - right.base,
        stride: left.stride - right.stride,
      };
    case ts.SyntaxKind.AsteriskToken:
      if (left.stride === 0) {
        return {
          base: left.base * right.base,
          stride: left.base * right.stride,
        };
      }
      if (right.stride === 0) {
        return {
          base: right.base * left.base,
          stride: right.base * left.stride,
        };
      }
      return undefined;
    case ts.SyntaxKind.SlashToken:
      if (right.stride !== 0 || right.base === 0) {
        return undefined;
      }
      return {
        base: left.base / right.base,
        stride: left.stride / right.base,
      };
    default:
      return undefined;
  }
}

function topLevelNumericConstants(
  file: ts.SourceFile,
): Map<string, number> {
  const constants = new Map<string, number>();
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        !ts.isIdentifier(declaration.name) ||
        !declaration.initializer
      ) {
        continue;
      }
      const numeric = numericLiteralValue(
        declaration.initializer,
      );
      if (numeric !== undefined) {
        constants.set(declaration.name.text, numeric);
      }
    }
  }
  return constants;
}

function topLevelArrayCounts(
  file: ts.SourceFile,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.initializer &&
        ts.isArrayLiteralExpression(
          declaration.initializer,
        )
      ) {
        counts.set(
          declaration.name.text,
          declaration.initializer.elements.length,
        );
      }
    }
  }
  return counts;
}

function spatialContextOffsetSeriesFromDeclaration(
  declaration: ts.VariableDeclaration,
  file: ts.SourceFile,
  source: SourceRef,
  constants: ReadonlyMap<string, number>,
  arrayCounts: ReadonlyMap<string, number>,
): ScriptSpatialContextOffsetSeries | undefined {
  if (
    !ts.isIdentifier(declaration.name) ||
    !declaration.initializer ||
    !ts.isCallExpression(declaration.initializer) ||
    !ts.isPropertyAccessExpression(
      declaration.initializer.expression,
    ) ||
    declaration.initializer.expression.name.text !== "map"
  ) {
    return undefined;
  }

  const sourceExpression =
    declaration.initializer.expression.expression;
  if (!ts.isIdentifier(sourceExpression)) {
    return undefined;
  }
  const contextCount = arrayCounts.get(
    sourceExpression.text,
  );
  if (contextCount === undefined) return undefined;

  const callback = declaration.initializer.arguments[0];
  if (
    !callback ||
    !(
      ts.isArrowFunction(callback) ||
      ts.isFunctionExpression(callback)
    ) ||
    callback.parameters.length < 2
  ) {
    return undefined;
  }

  const indexParameterNode = callback.parameters[1]?.name;
  if (
    !indexParameterNode ||
    !ts.isIdentifier(indexParameterNode)
  ) {
    return undefined;
  }

  const values = new Map<string, AffineScalar>();
  values.set(indexParameterNode.text, {
    base: 0,
    stride: 1,
  });

  let returned: ts.Expression | undefined;
  if (ts.isBlock(callback.body)) {
    for (const statement of callback.body.statements) {
      if (ts.isVariableStatement(statement)) {
        for (const local of statement.declarationList.declarations) {
          if (
            !ts.isIdentifier(local.name) ||
            !local.initializer
          ) {
            continue;
          }
          const affine = affineExpression(
            local.initializer,
            file,
            values,
            constants,
          );
          if (affine) values.set(local.name.text, affine);
        }
      } else if (ts.isReturnStatement(statement)) {
        returned = statement.expression;
      }
    }
  } else {
    returned = callback.body;
  }

  if (
    !returned ||
    !ts.isObjectLiteralExpression(returned)
  ) {
    return undefined;
  }

  const offsetProperty = returned.properties.find(
    (property): property is ts.PropertyAssignment =>
      ts.isPropertyAssignment(property) &&
      declarationMemberName(property.name) !== undefined &&
      /offset/i.test(
        declarationMemberName(property.name)!,
      ) &&
      ts.isObjectLiteralExpression(property.initializer),
  );
  if (
    !offsetProperty ||
    !ts.isObjectLiteralExpression(
      offsetProperty.initializer,
    )
  ) {
    return undefined;
  }

  const offsetPath = declarationMemberName(
    offsetProperty.name,
  );
  if (!offsetPath) return undefined;

  const axis = (
    name: "x" | "y" | "z",
  ): AffineScalar | undefined => {
    const property = objectPropertyAssignment(
      offsetProperty.initializer as ts.ObjectLiteralExpression,
      [name],
    );
    return property
      ? affineExpression(
          property.initializer,
          file,
          values,
          constants,
        )
      : undefined;
  };

  const x = axis("x");
  const y = axis("y");
  const z = axis("z");
  if (!x || !y || !z) return undefined;

  let contextIdPrefix: string | undefined;
  let contextIdIndexBase: number | undefined;
  const idProperty = objectPropertyAssignment(
    returned,
    ["id", "arenaId", "contextId"],
  );
  if (
    idProperty &&
    ts.isTemplateExpression(idProperty.initializer) &&
    idProperty.initializer.templateSpans.length === 1
  ) {
    const span =
      idProperty.initializer.templateSpans[0]!;
    const idValue = affineExpression(
      span.expression,
      file,
      values,
      constants,
    );
    if (
      idValue &&
      idValue.stride === 1 &&
      span.literal.text.length === 0
    ) {
      contextIdPrefix =
        idProperty.initializer.head.text;
      contextIdIndexBase = idValue.base;
    }
  }

  return {
    collectionName: declaration.name.text,
    sourceCollectionName: sourceExpression.text,
    contextCount,
    offsetPath,
    offsetBase: {
      x: x.base,
      y: y.base,
      z: z.base,
    },
    offsetStride: {
      x: x.stride,
      y: y.stride,
      z: z.stride,
    },
    ...(contextIdPrefix === undefined
      ? {}
      : { contextIdPrefix }),
    ...(contextIdIndexBase === undefined
      ? {}
      : { contextIdIndexBase }),
    source: lineSource(file, declaration, source),
  };
}

function spatialContextOffsetSeriesFromFile(
  file: ts.SourceFile,
  source: SourceRef,
): ScriptSpatialContextOffsetSeries[] {
  const constants = topLevelNumericConstants(file);
  const arrayCounts = topLevelArrayCounts(file);
  const output: ScriptSpatialContextOffsetSeries[] = [];

  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      const series =
        spatialContextOffsetSeriesFromDeclaration(
          declaration,
          file,
          source,
          constants,
          arrayCounts,
        );
      if (series) output.push(series);
    }
  }

  return output;
}

function conditionIdentifiers(
  expression: ts.Expression,
): string[] {
  const values = new Set<string>();

  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node)) values.add(node.text);
    if (ts.isPropertyAccessExpression(node)) {
      values.add(node.getText());
    }
    ts.forEachChild(node, visit);
  };
  visit(expression);
  return [...values].sort();
}

function guardOperand(
  expression: ts.Expression,
  file: ts.SourceFile,
): ScriptGuardOperand | undefined {
  const value =
    ts.isParenthesizedExpression(expression)
      ? expression.expression
      : expression;

  if (
    ts.isIdentifier(value) ||
    ts.isPropertyAccessExpression(value)
  ) {
    return {
      kind: "path",
      path: value.getText(file),
    };
  }

  if (ts.isElementAccessExpression(value)) {
    const base = guardOperand(value.expression, file);
    const argument = value.argumentExpression
      ? guardOperand(value.argumentExpression, file)
      : undefined;
    if (base && argument) {
      return {
        kind: "index",
        base,
        key: argument,
      };
    }
    return undefined;
  }

  if (
    ts.isStringLiteralLike(value) ||
    ts.isNoSubstitutionTemplateLiteral(value)
  ) {
    return {
      kind: "literal",
      value: value.text,
    };
  }

  if (ts.isNumericLiteral(value)) {
    return {
      kind: "literal",
      value: Number(value.text),
    };
  }

  if (value.kind === ts.SyntaxKind.TrueKeyword) {
    return { kind: "literal", value: true };
  }
  if (value.kind === ts.SyntaxKind.FalseKeyword) {
    return { kind: "literal", value: false };
  }
  if (value.kind === ts.SyntaxKind.NullKeyword) {
    return { kind: "literal", value: null };
  }

  return undefined;
}

function guardPredicate(
  expression: ts.Expression,
  file: ts.SourceFile,
): ScriptGuardPredicate {
  const value =
    ts.isParenthesizedExpression(expression)
      ? expression.expression
      : expression;

  if (
    ts.isPrefixUnaryExpression(value) &&
    value.operator === ts.SyntaxKind.ExclamationToken
  ) {
    const operand = guardOperand(value.operand, file);
    return operand
      ? { kind: "falsy", operand }
      : { kind: "unknown", text: value.getText(file) };
  }

  if (
    ts.isCallExpression(value) &&
    ts.isPropertyAccessExpression(value.expression) &&
    value.expression.name.text === "includes" &&
    value.arguments.length === 1 &&
    ts.isArrayLiteralExpression(value.expression.expression)
  ) {
    const operand = value.arguments[0]
      ? guardOperand(value.arguments[0], file)
      : undefined;
    const members: Array<
      string | number | boolean | null
    > = [];

    for (const element of value.expression.expression.elements) {
      const member = guardOperand(element as ts.Expression, file);
      if (!member || member.kind !== "literal") {
        return {
          kind: "unknown",
          text: value.getText(file),
        };
      }
      members.push(member.value);
    }

    if (operand) {
      return {
        kind: "in",
        operand,
        values: members,
      };
    }
  }

  if (ts.isBinaryExpression(value)) {
    if (
      value.operatorToken.kind ===
      ts.SyntaxKind.AmpersandAmpersandToken
    ) {
      return {
        kind: "all",
        predicates: [
          guardPredicate(value.left, file),
          guardPredicate(value.right, file),
        ],
      };
    }

    if (
      value.operatorToken.kind ===
      ts.SyntaxKind.BarBarToken
    ) {
      return {
        kind: "any",
        predicates: [
          guardPredicate(value.left, file),
          guardPredicate(value.right, file),
        ],
      };
    }

    const operator: Extract<
      ScriptGuardPredicate,
      { kind: "comparison" }
    >["operator"] | undefined =
      value.operatorToken.kind ===
      ts.SyntaxKind.EqualsEqualsToken ||
      value.operatorToken.kind ===
      ts.SyntaxKind.EqualsEqualsEqualsToken
        ? "eq"
        : value.operatorToken.kind ===
            ts.SyntaxKind.ExclamationEqualsToken ||
          value.operatorToken.kind ===
            ts.SyntaxKind.ExclamationEqualsEqualsToken
        ? "neq"
        : value.operatorToken.kind ===
            ts.SyntaxKind.LessThanToken
        ? "lt"
        : value.operatorToken.kind ===
            ts.SyntaxKind.LessThanEqualsToken
        ? "lte"
        : value.operatorToken.kind ===
            ts.SyntaxKind.GreaterThanToken
        ? "gt"
        : value.operatorToken.kind ===
            ts.SyntaxKind.GreaterThanEqualsToken
        ? "gte"
        : undefined;

    if (operator) {
      const left = guardOperand(value.left, file);
      const right = guardOperand(value.right, file);
      if (left && right) {
        return {
          kind: "comparison",
          operator,
          left,
          right,
        };
      }
    }
  }

  const operand = guardOperand(value, file);
  if (operand) return { kind: "truthy", operand };

  return {
    kind: "unknown",
    text: value.getText(file),
  };
}

function inferFallbackGuardedOutcomes(
  file: ts.SourceFile,
  source: SourceRef,
): ScriptGuardedOutcome[] {
  const output: ScriptGuardedOutcome[] = [];

  const scanBody = (
    body: ts.Block,
    executionRegion: string,
  ): void => {
    const priorTerminalGuards: ScriptGuardPredicate[] = [];
    const priorGuardTexts: string[] = [];

    for (const inner of body.statements) {
      if (ts.isIfStatement(inner)) {
        const returns = directReturnStatements(
          inner.thenStatement,
        );
        if (returns.length > 0) {
          priorTerminalGuards.push(
            guardPredicate(inner.expression, file),
          );
          priorGuardTexts.push(
            inner.expression.getText(file),
          );
        }
        continue;
      }

      if (
        ts.isReturnStatement(inner) &&
        priorTerminalGuards.length > 0
      ) {
        for (const outcome of outcomePropertiesFromReturn(inner)) {
          output.push({
            executionRegion,
            conditionText:
              "fallback after: " +
              priorGuardTexts.join(" | "),
            conditionIdentifiers: [
              ...new Set(
                priorGuardTexts.flatMap((text) =>
                  text.match(/[A-Za-z_$][\w$]*/g) ?? []
                ),
              ),
            ].sort(),
            predicate: {
              kind: "fallback",
              excludedPredicates: [
                ...priorTerminalGuards,
              ],
            },
            propertyName: outcome.propertyName,
            value: outcome.value,
            conditionSource: lineSource(
              file,
              inner,
              source,
            ),
            outcomeSource: lineSource(
              file,
              outcome.sourceNode,
              source,
            ),
          });
        }
      }
    }
  };

  const visit = (node: ts.Node): void => {
    if (ts.isFunctionDeclaration(node) && node.body) {
      scanBody(
        node.body,
        node.name
          ? "function:" + node.name.text
          : "anonymous-function",
      );
    } else if (ts.isMethodDeclaration(node) && node.body) {
      const name = declarationMemberName(node.name);
      if (name) scanBody(node.body, sourceMethodRegion(node, file));
    }

    ts.forEachChild(node, visit);
  };

  visit(file);
  return output;
}

function requiredTrueCalls(
  expression: ts.Expression,
): ts.CallExpression[] {
  if (ts.isParenthesizedExpression(expression)) {
    return requiredTrueCalls(expression.expression);
  }
  if (ts.isCallExpression(expression)) return [expression];

  if (ts.isBinaryExpression(expression)) {
    if (expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
      return [
        ...requiredTrueCalls(expression.left),
        ...requiredTrueCalls(expression.right),
      ];
    }

    const equality =
      expression.operatorToken.kind === ts.SyntaxKind.EqualsEqualsToken ||
      expression.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken;
    const inequality =
      expression.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsToken ||
      expression.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken;

    if (equality || inequality) {
      const leftTrue = expression.left.kind === ts.SyntaxKind.TrueKeyword;
      const rightTrue = expression.right.kind === ts.SyntaxKind.TrueKeyword;
      const leftFalse = expression.left.kind === ts.SyntaxKind.FalseKeyword;
      const rightFalse = expression.right.kind === ts.SyntaxKind.FalseKeyword;

      if ((equality && leftTrue) || (inequality && leftFalse)) {
        return requiredTrueCalls(expression.right);
      }
      if ((equality && rightTrue) || (inequality && rightFalse)) {
        return requiredTrueCalls(expression.left);
      }
    }
  }

  return [];
}

function sameStart(a: SourceRef, b: SourceRef): boolean {
  return (
    a.relativePath === b.relativePath &&
    a.range?.lineStart === b.range?.lineStart &&
    a.range?.columnStart === b.range?.columnStart
  );
}

function inferBlockMatchGuards(
  file: ts.SourceFile,
  source: SourceRef,
  methodCalls: readonly ParsedScriptFile["methodCalls"][number][],
): ScriptBlockMatchGuard[] {
  const output: ScriptBlockMatchGuard[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isIfStatement(node)) {
      for (const callNode of requiredTrueCalls(node.expression)) {
        const callSource = lineSource(file, callNode, source);
        const call = methodCalls.find((item) =>
          sameStart(item.source, callSource) &&
          item.method === "matches" &&
          (
            item.receiverType === "Block" ||
            item.receiverType === "BlockPermutation"
          )
        );
        if (!call?.receiverHint) continue;
        const receiverType =
          call.receiverType === "Block" || call.receiverType === "BlockPermutation"
            ? call.receiverType
            : undefined;
        if (!receiverType) continue;

        output.push({
          receiverHint: call.receiverHint,
          receiverType,
          conditionSource: lineSource(file, node.expression, source),
          guardedSource: lineSource(file, node.thenStatement, source),
          executionRegion: localExecutionRegionId(node, file),
        });
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(file);
  return output;
}

function customCommandCallback(
  call: ts.CallExpression,
): ts.ArrowFunction | ts.FunctionExpression | undefined {
  if (!ts.isPropertyAccessExpression(call.expression)) return undefined;
  const chain = propertyAccessChain(call.expression);
  if (
    chain.length !== 3 ||
    chain[1] !== "customCommandRegistry" ||
    chain[2] !== "registerCommand"
  ) {
    return undefined;
  }

  const callback = call.arguments[1];
  return callback &&
    (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))
    ? callback
    : undefined;
}

function sourceInside(inner: SourceRef, outer: SourceRef): boolean {
  const innerStartLine = inner.range?.lineStart;
  const innerEndLine = inner.range?.lineEnd;
  const outerStartLine = outer.range?.lineStart;
  const outerEndLine = outer.range?.lineEnd;
  if (
    innerStartLine === undefined ||
    innerEndLine === undefined ||
    outerStartLine === undefined ||
    outerEndLine === undefined
  ) {
    return false;
  }

  const innerStartColumn = inner.range?.columnStart;
  const innerEndColumn = inner.range?.columnEnd;
  const outerStartColumn = outer.range?.columnStart;
  const outerEndColumn = outer.range?.columnEnd;

  const startsAfterOuter =
    innerStartLine > outerStartLine ||
    (
      innerStartLine === outerStartLine &&
      (
        outerStartColumn === undefined ||
        innerStartColumn === undefined ||
        innerStartColumn >= outerStartColumn
      )
    );

  const endsBeforeOuter =
    innerEndLine < outerEndLine ||
    (
      innerEndLine === outerEndLine &&
      (
        outerEndColumn === undefined ||
        innerEndColumn === undefined ||
        innerEndColumn <= outerEndColumn
      )
    );

  return startsAfterOuter && endsBeforeOuter;
}

function contextualCallSymbol(node: ts.CallExpression): string | undefined {
  if (!ts.isPropertyAccessExpression(node.expression)) return undefined;
  const method = node.expression.name.text;
  const receiver = node.expression.expression;

  if (
    ts.isPropertyAccessExpression(receiver) &&
    (receiver.name.text === "player" || receiver.name.text === "entity")
  ) {
    if (method === "setGameMode" || method === "setSpawnPoint") {
      return `Player.${method}`;
    }
    if (
      method === "addTag" ||
      method === "removeTag" ||
      method === "applyKnockback" ||
      method === "setProperty" ||
      method === "teleport"
    ) {
      return `Entity.${method}`;
    }
  }

  return undefined;
}

function contextualWriteSymbol(node: ts.BinaryExpression): string | undefined {
  if (node.operatorToken.kind !== ts.SyntaxKind.EqualsToken) return undefined;
  if (!ts.isPropertyAccessExpression(node.left)) return undefined;

  const property = node.left.name.text;
  const receiver = node.left.expression;
  if (
    ts.isPropertyAccessExpression(receiver) &&
    receiver.name.text === "player"
  ) {
    if (property === "commandPermissionLevel") return "Player.commandPermissionLevel";
    if (property === "nameTag" || property === "isSneaking") {
      return `Entity.${property}`;
    }
  }
  return undefined;
}

function scanRestrictedMutations(
  callback: ts.Node,
  root: RestrictedExecutionMutation["root"],
  context: RestrictedExecutionMutation["context"],
  event: string,
  file: ts.SourceFile,
  source: SourceRef,
  methodCalls: ReadonlyArray<ParsedScriptFile["methodCalls"][number]>,
  propertyWrites: ReadonlyArray<ParsedScriptFile["propertyWrites"][number]>,
): RestrictedExecutionMutation[] {
  const output: RestrictedExecutionMutation[] = [];
  const callbackSource = lineSource(file, callback, source);
  const occupied = new Set<string>();

  for (const call of methodCalls) {
    if (!sourceInside(call.source, callbackSource)) continue;
    const rule = findScriptExecutionPrivilegeRule(call.symbol, "call");
    if (!rule) continue;
    const line = call.source.range?.lineStart ?? 0;
    occupied.add(`${line}\0call\0${call.method}`);
    output.push({
      root,
      context,
      event,
      method: call.method,
      symbol: call.symbol,
      operation: "call",
      evidence: "exact-symbol",
      ruleId: rule.id,
      source: call.source,
    });
  }

  for (const write of propertyWrites) {
    if (!sourceInside(write.source, callbackSource)) continue;
    const rule = findScriptExecutionPrivilegeRule(write.symbol, "write");
    if (!rule) continue;
    const line = write.source.range?.lineStart ?? 0;
    occupied.add(`${line}\0write\0${write.property}`);
    output.push({
      root,
      context,
      event,
      method: write.property,
      symbol: write.symbol,
      operation: "write",
      evidence: "exact-symbol",
      ruleId: rule.id,
      source: write.source,
    });
  }

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const symbol = contextualCallSymbol(node);
      if (symbol && ts.isPropertyAccessExpression(node.expression)) {
        const rule = findScriptExecutionPrivilegeRule(symbol, "call");
        const nodeSource = lineSource(file, node, source);
        const line = nodeSource.range?.lineStart ?? 0;
        const method = node.expression.name.text;
        const key = `${line}\0call\0${method}`;
        if (rule && !occupied.has(key)) {
          output.push({
            root,
            context,
            event,
            method,
            symbol,
            operation: "call",
            evidence: "contextual-fallback",
            ruleId: rule.id,
            source: nodeSource,
          });
        }
      }
    }

    if (ts.isBinaryExpression(node)) {
      const symbol = contextualWriteSymbol(node);
      if (symbol && ts.isPropertyAccessExpression(node.left)) {
        const rule = findScriptExecutionPrivilegeRule(symbol, "write");
        const nodeSource = lineSource(file, node.left, source);
        const line = nodeSource.range?.lineStart ?? 0;
        const method = node.left.name.text;
        const key = `${line}\0write\0${method}`;
        if (rule && !occupied.has(key)) {
          output.push({
            root,
            context,
            event,
            method,
            symbol,
            operation: "write",
            evidence: "contextual-fallback",
            ruleId: rule.id,
            source: nodeSource,
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(callback);

  const seen = new Set<string>();
  return output.filter((item) => {
    const key = [
      item.source.range?.lineStart ?? 0,
      item.symbol,
      item.operation,
    ].join("\0");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function parseScriptFile(
  identifier: string,
  text: string,
  source: SourceRef,
): ParsedScriptFile {
  const file = ts.createSourceFile(
    source.relativePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(source.relativePath),
  );
  const classWiring = extractScriptClassWiring(file, source);
  const arenaAuthorityEvidence =
    deriveScriptArenaAuthorityEvidence(
      text,
      source,
      classWiring.constructorFieldBindings,
    );
  const arenaAuthorityPaths = bindArenaParserRegions(
    file,
    correlateScriptArenaAuthorityPaths(arenaAuthorityEvidence),
  );
  const persistenceIdempotencyGuards =
    derivePersistenceIdempotencyGuards(
      text,
      source,
    );
  const safeConfig = compileScriptSafeConfig(
    text,
    source,
  );
  const mapWiring = extractScriptClassMapSites(file, source);
  const spatialMutations = deriveScriptSpatialMutations(
    text,
    source,
  );
  const inventoryLifecycleEvidence =
    deriveScriptInventoryLifecycleEvidence(
      text,
      source,
    );
  const combatLifecycleEvidence =
    deriveScriptCombatLifecycleEvidence(
      text,
      source,
    );
  const chunkLifecycleEvidence =
    deriveScriptChunkLifecycleEvidence(
      text,
      source,
    );
  const economyEvidence =
    deriveScriptEconomyEvidence(
      text,
      source,
    );
  const cleanupResourceEvidence =
    deriveScriptCleanupResourceEvidence(
      text,
      source,
    );
  // The domain extractor owns *which* resource calls are relevant. The
  // canonical parser owns branch provenance and already walks this AST.
  // Reconcile only complete, exact source spans; never match method names.
  const resourceSiteKey = (ref: SourceRef): string | undefined => {
    const range = ref.range;
    if (range?.lineStart === undefined || range.columnStart === undefined ||
        range.lineEnd === undefined || range.columnEnd === undefined) {
      return undefined;
    }
    return JSON.stringify([
      ref.artifactId, ref.relativePath, ref.jsonPointer ?? null,
      range.lineStart, range.columnStart, range.lineEnd, range.columnEnd,
    ]);
  };
  const cleanupSiteKeys = new Set(cleanupResourceEvidence
    .map(item => resourceSiteKey(item.source))
    .filter((key): key is string => key !== undefined));
  const resourceBranchContext = new Map<string, {
    lexicalGuards: readonly ScriptLexicalGuard[];
    precedenceGuards: readonly ScriptLexicalGuard[];
  }>();
  // The existing AST parser owns branch ancestry at exact typed method sites.
  const callSiteGuards = new Map<string, {
    lexicalGuards: readonly ScriptLexicalGuard[];
    precedenceGuards: readonly ScriptLexicalGuard[];
  }>();
  const globalLeaseEvidence =
    deriveScriptGlobalLeaseEvidence(
      text,
      source,
    );
  const progressionCounterEvidence =
    deriveScriptProgressionCounterEvidence(
      text,
      source,
    );
  const progressionActorSpawnEvidence =
    deriveScriptProgressionActorSpawnEvidence(
      text,
      source,
    );
  const progressionActorRegistryEvidence =
    deriveScriptProgressionActorRegistryEvidence(
      text,
      source,
    );
  const persistentDataLifecycleEvidence =
    derivePersistentDataLifecycleEvidence(
      text,
      source,
    );
  const resultAuditRecordEvidence =
    deriveResultAuditRecordEvidence(
      text,
      source,
    );
  const blockCustomComponentRegistrations =
    deriveBlockCustomComponentRegistrations(text, source);
  const persistentReconciliation =
    derivePersistentReconciliationEvidence(text, source);
  // A module-level name is safe to resolve only if its binding is unique.
  const moduleBindings = new Map<string, number>();
  const addBinding = (name: string): void => {
    moduleBindings.set(name, (moduleBindings.get(name) ?? 0) + 1);
  };
  for (const statement of file.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name) {
      addBinding(statement.name.text);
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) addBinding(declaration.name.text);
      }
    } else if (ts.isImportDeclaration(statement) && statement.importClause) {
      const clause = statement.importClause;
      if (clause.name) addBinding(clause.name.text);
      if (clause.namedBindings) {
        if (ts.isNamespaceImport(clause.namedBindings)) addBinding(clause.namedBindings.name.text);
        else for (const specifier of clause.namedBindings.elements) addBinding(specifier.name.text);
      }
    }
  }
  const uniqueModuleBinding = (name: string): boolean => moduleBindings.get(name) === 1;
  const topLevelFunctionNames = new Set(
    file.statements
      .filter(ts.isFunctionDeclaration)
      .flatMap((statement) => statement.name ? [statement.name.text] : []),
  );
  // Only a unique, authored top-level function body can own local-call
  // parameter evidence. Same-spelled shadowed callables do not qualify.
  const localCallableDeclarations = new Map(
    file.statements
      .filter((statement): statement is ts.FunctionDeclaration =>
        ts.isFunctionDeclaration(statement) && statement.name !== undefined &&
        statement.body !== undefined && uniqueModuleBinding(statement.name.text))
      .map(statement => [statement.name!.text, statement] as const),
  );

  const relativeImportedNames = new Set<string>();
  const relativeImportedNamespaces = new Set<string>();
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) ||
        !ts.isStringLiteralLike(statement.moduleSpecifier) ||
        !statement.moduleSpecifier.text.startsWith(".") ||
        statement.importClause?.isTypeOnly) continue;
    const clause = statement.importClause;
    if (clause?.name) relativeImportedNames.add(clause.name.text);
    const named = clause?.namedBindings;
    if (named && ts.isNamedImports(named)) {
      for (const element of named.elements) {
        if (!element.isTypeOnly) relativeImportedNames.add(element.name.text);
      }
    } else if (named && ts.isNamespaceImport(named)) {
      relativeImportedNamespaces.add(named.name.text);
    }
  }

  const topLevelCallbackSources = new Map(
    file.statements
      .filter(ts.isFunctionDeclaration)
      .flatMap(statement => statement.name
        ? [[statement.name.text, lineSource(file, statement, source)] as const]
        : []),
  );
  // Top-level const function values have a stable declaration source.
  // Mutable bindings and untracked alias chains remain unresolved.
  const topLevelConstCallbacks = new Map<string, ts.ArrowFunction | ts.FunctionExpression>();
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement) ||
        !(statement.declarationList.flags & ts.NodeFlags.Const)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
      if (ts.isArrowFunction(declaration.initializer) ||
          ts.isFunctionExpression(declaration.initializer)) {
        topLevelConstCallbacks.set(declaration.name.text, declaration.initializer);
      }
    }
  }
  const topLevelConstAliases = new Map<string, string>();
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement) ||
        !(statement.declarationList.flags & ts.NodeFlags.Const)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.initializer &&
          ts.isIdentifier(declaration.initializer)) {
        const target = declaration.initializer.text;
        if (uniqueModuleBinding(declaration.name.text) && uniqueModuleBinding(target) &&
            (topLevelFunctionNames.has(target) || topLevelConstCallbacks.has(target))) {
          topLevelConstAliases.set(declaration.name.text, target);
        }
      }
    }
  }
  const bindsName = (binding: ts.BindingName, name: string): boolean =>
    ts.isIdentifier(binding)
      ? binding.text === name
      : binding.elements.some(element =>
          ts.isBindingElement(element) && bindsName(element.name, name));
  const isShadowed = (identifier: ts.Identifier): boolean => {
    let current: ts.Node | undefined = identifier.parent;
    while (current && current !== file) {
      if (ts.isFunctionLike(current) && current.parameters.some(parameter =>
        bindsName(parameter.name, identifier.text))) return true;
      if (ts.isCatchClause(current) && current.variableDeclaration &&
          bindsName(current.variableDeclaration.name, identifier.text)) return true;
      if ((ts.isForStatement(current) || ts.isForInStatement(current) ||
          ts.isForOfStatement(current)) && current.initializer &&
          ts.isVariableDeclarationList(current.initializer) &&
          current.initializer.declarations.some(declaration =>
            bindsName(declaration.name, identifier.text))) return true;
      if (ts.isBlock(current) || ts.isSourceFile(current)) {
        const statements = current.statements;
        if (statements?.some(statement =>
          (ts.isVariableStatement(statement) && statement.declarationList.declarations.some(
            declaration => bindsName(declaration.name, identifier.text))) ||
          (ts.isFunctionDeclaration(statement) && statement.name?.text === identifier.text)
        )) {
          if (current !== file) return true;
        }
      }
      current = current.parent;
    }
    return false;
  };
  // Resolve only lexical const function values actually in scope at the call.
  // Parameters, mutable bindings and uncertain aliases remain unresolved.
  const localConstCallback = (call: ts.CallExpression): ts.ArrowFunction | ts.FunctionExpression | undefined => {
    const arg = call.arguments[0];
    if (!arg || !ts.isIdentifier(arg)) return undefined;
    let current: ts.Node | undefined = call.parent;
    while (current && current !== file) {
      if (ts.isFunctionLike(current) && current.parameters.some(parameter =>
        bindsName(parameter.name, arg.text))) return undefined;
      if (ts.isCatchClause(current) && current.variableDeclaration &&
          bindsName(current.variableDeclaration.name, arg.text)) return undefined;
      if ((ts.isForStatement(current) || ts.isForInStatement(current) ||
          ts.isForOfStatement(current)) && current.initializer &&
          ts.isVariableDeclarationList(current.initializer) &&
          current.initializer.declarations.some(declaration =>
            bindsName(declaration.name, arg.text))) return undefined;
      if (ts.isBlock(current)) {
        const declarations = current.statements
          .filter(ts.isVariableStatement)
          .flatMap(statement => statement.declarationList.declarations.map(declaration => ({
            declaration, isConst: !!(statement.declarationList.flags & ts.NodeFlags.Const),
          })))
          .filter(item => bindsName(item.declaration.name, arg.text));
        if (declarations.length > 0) {
          if (declarations.length !== 1) return undefined;
          const { declaration, isConst } = declarations[0]!;
          if (!isConst || declaration.getStart(file) >= call.getStart(file)) return undefined;
          const value = declaration.initializer;
          return value && (ts.isArrowFunction(value) || ts.isFunctionExpression(value))
            ? value : undefined;
        }
      }
      current = current.parent;
    }
    return undefined;
  };
  const directCallbackName = (call: ts.CallExpression): string | undefined => {
    const first = call.arguments[0];
    if (!first || !ts.isIdentifier(first) || isShadowed(first)) return undefined;
    return topLevelConstAliases.get(first.text) ?? first.text;
  };
  const constCallback = (call: ts.CallExpression): ts.ArrowFunction | ts.FunctionExpression | undefined => {
    const name = directCallbackName(call);
    return name && uniqueModuleBinding(name) ? topLevelConstCallbacks.get(name) : undefined;
  };
  const namedCallback = (call: ts.CallExpression): string | undefined => {
    const name = directCallbackName(call);
    return name && uniqueModuleBinding(name) && topLevelFunctionNames.has(name) ? name : undefined;
  };

  const imports: ScriptImport[] = [];
  const events: ScriptEventSubscription[] = [];
  const dynamicProperties: DynamicPropertyAccess[] = [];
  const restrictedMutations: RestrictedExecutionMutation[] = [];
  const deferredCallbacks: ScriptDeferredCallback[] = [];
  const localFunctionCalls: ScriptLocalFunctionCall[] = [];
  const importedCallGuardSites: ScriptImportedCallGuardSite[] = [];
  const methodCalls = inferScriptMethodCalls(file, source);
  const spatialWorldMutations =
    deriveScriptSpatialWorldMutations(
      text,
      source,
      methodCalls,
      safeConfig.bindings,
    );
  const blockMatchGuards = inferBlockMatchGuards(
    file,
    source,
    methodCalls,
  );
  const propertyAccesses = inferScriptPropertyAccesses(file, source);
  const propertyWrites = inferScriptPropertyWrites(file, source);
  const entityEventTriggers: ScriptEntityEventTrigger[] = [];
  const commandLiterals: ScriptCommandLiteral[] = [];
  const authoredPropertyMutations: ScriptAuthoredPropertyMutation[] = [];
  const unresolvedReceiverCalls: ScriptUnresolvedReceiverCall[] = [];
  const lifecycleMemberExposures = inferScriptLifecycleMemberExposures(
    file,
    source,
    methodCalls,
  );
  const moduleMemberAccesses: ScriptModuleMemberAccess[] = [];
  const importedSymbols: ScriptImportedSymbol[] = [];
  const enumValueComparisons: ScriptEnumValueComparison[] = [];
  const stateMutations: ScriptStateMutation[] = [];
  const typeProperties: ScriptTypeProperty[] = [];
  const transitionDeclarations: ScriptTransitionDeclaration[] = [];
  const returnOutcomes: ScriptReturnOutcome[] = [];
  const guardedOutcomes: ScriptGuardedOutcome[] = [];
  const declaredMembers: ScriptDeclaredMember[] = [];
  const spatialRoutePoints: ScriptSpatialRoutePoint[] = [];
  const spatialOffsetTransforms =
    spatialOffsetTransformsFromFile(file, source);
  const spatialTransformUses: ScriptSpatialTransformUse[] = [];
  const spatialContextOffsetSeries =
    spatialContextOffsetSeriesFromFile(file, source);
  const spatialTransformNames = new Set(
    spatialOffsetTransforms.map((item) => item.functionName),
  );
  const namedMinecraftBindings = minecraftNamedBindings(file);
  // Derive scheduler eligibility once from typed receiver inference instead
  // of repeatedly guessing from a source identifier's spelling.
  const typedSchedulerSites = new Set(methodCalls
    .filter(call => call.receiverType === "System" &&
      ["run", "runTimeout", "runInterval", "runJob"].includes(call.method))
    .map(call => [call.source.range?.lineStart ?? 0,
      call.source.range?.columnStart ?? 0, call.method].join(":")));
  const namespaceMinecraftBindings = minecraftNamespaceBindings(file);
  const canonicalMinecraftMember = (
    expression: ts.Expression,
  ): { module: string; enumName: string; member: string; symbol: string } | undefined => {
    if (!ts.isPropertyAccessExpression(expression)) return undefined;

    if (ts.isIdentifier(expression.expression)) {
      const binding = namedMinecraftBindings.get(expression.expression.text);
      if (binding) {
        return {
          module: binding.module,
          enumName: binding.importedName,
          member: expression.name.text,
          symbol: `${binding.importedName}.${expression.name.text}`,
        };
      }
    }

    const chain = propertyAccessChain(expression);
    const namespaceModule = chain[0]
      ? namespaceMinecraftBindings.get(chain[0])
      : undefined;
    if (namespaceModule && chain.length === 3 && chain[1] && chain[2]) {
      return {
        module: namespaceModule,
        enumName: chain[1],
        member: chain[2],
        symbol: `${chain[1]}.${chain[2]}`,
      };
    }

    return undefined;
  };

  const STATE_TARGET_PATTERN =
    /(?:^|[_$.-])(?:state|status|phase|stage|mode)(?:$|[_$.-])/i;
  // Ordinary JavaScript camelCase state owners (e.g. residencyState)
  // also qualify. Preserve word boundaries: statement or estate must not.
  const CAMEL_CASE_STATE_TARGET_PATTERN =
    /(?:State|Status|Phase|Stage|Mode)(?:$|[A-Z_$.-])/;
  const isStateTargetName = (name: string): boolean =>
    STATE_TARGET_PATTERN.test(name) ||
    CAMEL_CASE_STATE_TARGET_PATTERN.test(name);

  const stateMutationTarget = (
    expression: ts.Expression,
  ): { target: string; targetName: string } | undefined => {
    if (ts.isIdentifier(expression)) {
      if (!isStateTargetName(expression.text)) return undefined;
      return {
        target: expression.text,
        targetName: expression.text,
      };
    }
    if (ts.isPropertyAccessExpression(expression)) {
      const target = expression.getText(file);
      const targetName = expression.name.text;
      if (!isStateTargetName(targetName)) return undefined;
      return { target, targetName };
    }
    return undefined;
  };

  const stateMutationValue = (
    expression: ts.Expression,
  ): ScriptStateMutation["value"] | undefined => {
    if (
      ts.isStringLiteralLike(expression) ||
      ts.isNoSubstitutionTemplateLiteral(expression)
    ) {
      return {
        kind: "literal",
        literal: expression.text,
      };
    }
    if (ts.isNumericLiteral(expression)) {
      return {
        kind: "literal",
        literal: expression.text,
      };
    }
    if (
      expression.kind === ts.SyntaxKind.TrueKeyword ||
      expression.kind === ts.SyntaxKind.FalseKeyword
    ) {
      return {
        kind: "literal",
        literal:
          expression.kind === ts.SyntaxKind.TrueKeyword
            ? "true"
            : "false",
      };
    }
    if (ts.isPropertyAccessExpression(expression)) {
      const chain = propertyAccessChain(expression);
      if (chain.length < 2) return undefined;
      const owner = chain.slice(0, -1).join(".");
      const member = chain.at(-1);
      if (!member) return undefined;
      return {
        kind: "member",
        owner,
        member,
        symbol: chain.join("."),
      };
    }
    return undefined;
  };

  const recordStateType = (
    node: ts.TypeNode | undefined,
  ): string | undefined => {
    if (!node) return undefined;
    const text = node.getText(file);
    const match = text.match(/Record\s*<\s*([A-Za-z_$][\w$]*)\s*,/);
    return match?.[1];
  };

  const transitionArray = (
    expression: ts.Expression,
  ): string[] | undefined => {
    const value =
      ts.isAsExpression(expression) ||
      ts.isTypeAssertionExpression(expression)
        ? expression.expression
        : expression;
    if (!ts.isArrayLiteralExpression(value)) return undefined;
    const items: string[] = [];
    for (const element of value.elements) {
      if (!ts.isStringLiteralLike(element)) return undefined;
      items.push(element.text);
    }
    return items;
  };

  // Exact direct scalar syntax only. No constant folding, alias resolution,
  // coercion or arbitrary expression evaluation during static reconstruction.
  const authoredScalar = (
    expression: ts.Expression | undefined,
  ): NonNullable<DynamicPropertyAccess["writtenLiteral"]> | undefined => {
    if (!expression) return undefined;
    if (ts.isStringLiteralLike(expression)) {
      return { scalarKind: "string", value: expression.text };
    }
    if (ts.isNumericLiteral(expression)) {
      return { scalarKind: "number", value: expression.text };
    }
    if (ts.isPrefixUnaryExpression(expression) &&
        expression.operator === ts.SyntaxKind.MinusToken &&
        ts.isNumericLiteral(expression.operand)) {
      return { scalarKind: "number", value: "-" + expression.operand.text };
    }
    if (expression.kind === ts.SyntaxKind.TrueKeyword ||
        expression.kind === ts.SyntaxKind.FalseKeyword) {
      return {
        scalarKind: "boolean",
        value: expression.kind === ts.SyntaxKind.TrueKeyword ? "true" : "false",
      };
    }
    return undefined;
  };

  const capabilities: ScriptCapabilityUse[] = [
    ...methodCalls.map((call) => ({
      capability: "api-method" as const,
      detail: call.symbol,
      source: call.source,
    })),
    ...propertyAccesses.map((access) => ({
      capability: "api-property" as const,
      detail: access.symbol,
      source: access.source,
    })),
    ...propertyWrites.map((write) => ({
      capability: "api-property-write" as const,
      detail: write.symbol,
      source: write.source,
    })),
  ];

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      // Calls on method parameters or nested receivers are authored source
      // attempts, not resolved same-class calls. Retain them separately.
      if (ts.isPropertyAccessExpression(node.expression) &&
          node.expression.expression.kind !== ts.SyntaxKind.ThisKeyword) {
        const callerRegion = localExecutionRegionId(node, file);
        if (callerRegion.startsWith("function:")) {
          unresolvedReceiverCalls.push({
            executionRegion: callerRegion,
            receiverExpression: node.expression.expression.getText(file).slice(0,160),
            method: node.expression.name.text,
            source: lineSource(file, node, source),
            lexicalGuards: lexicalBranchGuards(node, file, source),
            precedenceGuards: precedingEarlyExitGuards(node, file, source),
          });
        }
      }
      const site = resourceSiteKey(lineSource(file, node, source));
      if (site !== undefined) {
        callSiteGuards.set(site, {
          lexicalGuards: lexicalBranchGuards(node, file, source),
          precedenceGuards: precedingEarlyExitGuards(node, file, source),
        });
      }
      const imported = ts.isIdentifier(node.expression)
        ? relativeImportedNames.has(node.expression.text) &&
          !isShadowed(node.expression)
        : ts.isPropertyAccessExpression(node.expression) &&
          ts.isIdentifier(node.expression.expression) &&
          relativeImportedNamespaces.has(node.expression.expression.text) &&
          !isShadowed(node.expression.expression);
      if (imported) {
        const lexicalGuards = lexicalBranchGuards(node, file, source);
        const precedenceGuards = precedingEarlyExitGuards(node, file, source);
        importedCallGuardSites.push({
          executionRegion: localExecutionRegionId(node, file),
          source: lineSource(file, node, source),
          ...(lexicalGuards.length ? { lexicalGuards } : {}),
          ...(precedenceGuards.length ? { precedenceGuards } : {}),
        });
      }
    }
    if (cleanupSiteKeys.size > 0 &&
        (ts.isCallExpression(node) ||
          (ts.isBinaryExpression(node) &&
            node.operatorToken.kind === ts.SyntaxKind.EqualsToken))) {
      const site = resourceSiteKey(lineSource(file, node, source));
      if (site !== undefined && cleanupSiteKeys.has(site)) {
        resourceBranchContext.set(site, {
          lexicalGuards: lexicalBranchGuards(node, file, source),
          precedenceGuards: precedingEarlyExitGuards(node, file, source),
        });
      }
    }
    if (ts.isObjectLiteralExpression(node)) {
      const routePoint = spatialRoutePointFromObject(
        node,
        file,
        source,
      );
      if (routePoint) spatialRoutePoints.push(routePoint);
    }

    if (
      ts.isMethodDeclaration(node) ||
      ts.isPropertyDeclaration(node)
    ) {
      const member = declarationMemberName(node.name);
      if (member) {
        const containerHint =
          declarationContainerHint(node);
        declaredMembers.push({
          member,
          memberKind: ts.isMethodDeclaration(node)
            ? "method"
            : "property",
          ...(containerHint === undefined
            ? {}
            : { containerHint }),
          source: lineSource(file, node, source),
        });
      }
    }

    if (ts.isStringLiteralLike(node)) {
      const command = node.text.trim();
      const runCommandContext = runCommandStringContext(node, file);
      if (
        !runCommandContext &&
        /^\/?(?:summon|event)\s+/i.test(command)
      ) {
        commandLiterals.push({
          command,
          mechanism: "embedded-literal",
          executionRegion: localExecutionRegionId(node, file),
          source: lineSource(file, node, source),
        });
      }
    }

    if (ts.isReturnStatement(node) && node.expression) {
      for (const outcome of outcomePropertiesFromReturn(node)) {
        returnOutcomes.push({
          executionRegion: localExecutionRegionId(node, file),
          lexicalGuards: lexicalBranchGuards(node, file, source),
          precedenceGuards: precedingEarlyExitGuards(node, file, source),
          propertyName: outcome.propertyName,
          value: outcome.value,
          source: lineSource(file, outcome.sourceNode, source),
        });
      }
    }

    if (ts.isIfStatement(node)) {
      const conditionText = node.expression.getText(file);
      const identifiers = conditionIdentifiers(node.expression);
      for (const returnNode of directReturnStatements(node.thenStatement)) {
        for (const outcome of outcomePropertiesFromReturn(returnNode)) {
          guardedOutcomes.push({
            executionRegion: localExecutionRegionId(node, file),
            conditionText,
            conditionIdentifiers: identifiers,
            predicate: guardPredicate(node.expression, file),
            propertyName: outcome.propertyName,
            value: outcome.value,
            conditionSource: lineSource(file, node.expression, source),
            outcomeSource: lineSource(file, outcome.sourceNode, source),
          });
        }
      }
    }

    if (ts.isInterfaceDeclaration(node)) {
      for (const member of node.members) {
        if (!ts.isPropertySignature(member) || !member.type || !member.name) {
          continue;
        }
        const propertyName =
          ts.isIdentifier(member.name) ||
          ts.isStringLiteralLike(member.name)
            ? member.name.text
            : undefined;
        if (!propertyName) continue;
        typeProperties.push({
          containerName: node.name.text,
          propertyName,
          typeText: member.type.getText(file),
          optional: member.questionToken !== undefined,
          source: lineSource(file, member, source),
        });
      }
    }

    if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (
          !ts.isIdentifier(declaration.name) ||
          !declaration.initializer ||
          !/transition/i.test(declaration.name.text)
        ) {
          continue;
        }

        const initializer =
          ts.isAsExpression(declaration.initializer) ||
          ts.isTypeAssertionExpression(declaration.initializer)
            ? declaration.initializer.expression
            : declaration.initializer;
        if (!ts.isObjectLiteralExpression(initializer)) continue;

        const tableName = declaration.name.text;
        const stateType = recordStateType(declaration.type);

        for (const property of initializer.properties) {
          if (!ts.isPropertyAssignment(property)) continue;
          const from =
            ts.isIdentifier(property.name) ||
            ts.isStringLiteralLike(property.name)
              ? property.name.text
              : undefined;
          if (!from) continue;
          const to = transitionArray(property.initializer);
          if (!to) continue;
          transitionDeclarations.push({
            tableName,
            ...(stateType === undefined ? {} : { stateType }),
            from,
            to,
            source: lineSource(file, property, source),
          });
        }
      }
    }

    // import("./literal.js") is not an ImportDeclaration. Recover the exact
    // source request without treating it as an executed entrypoint/call edge.
    // Expressions such as import(variable) remain an unresolved import,
    // never a guessed relative path or an external module.
    if (ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const specifier = node.arguments[0];
      const literalModule = specifier && ts.isStringLiteralLike(specifier)
        ? specifier.text : undefined;
      const module = literalModule ??
        (specifier?.getText(file).slice(0, 240) ??
          "<missing dynamic import expression>");
      const dynamicImportSequence = sourceSequentialSite(node, file, source);
      imports.push({
        module,
        kind: literalModule !== undefined
          ? classifyModule(literalModule) : "unresolved",
        bindings: [],
        source: lineSource(file, node, source),
        importSyntax: literalModule !== undefined
          ? "dynamic-literal" : "dynamic-expression",
        executionRegion: localExecutionRegionId(node, file),
        lexicalGuards: lexicalBranchGuards(node, file, source),
        precedenceGuards: precedingEarlyExitGuards(node, file, source),
        ...(dynamicImportSequence === undefined ? {} : {
          sourceSequence: dynamicImportSequence,
        }),
      });
    }
    if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
      const module = node.moduleSpecifier.text;
      imports.push({
        module,
        kind: classifyModule(module),
        bindings: importBindings(node),
        source: lineSource(file, node, source),
      });

      const clause = node.importClause;
      const named = clause?.namedBindings;
      if (module.startsWith("@minecraft/") && named && ts.isNamedImports(named)) {
        for (const element of named.elements) {
          const importedName = element.propertyName?.text ?? element.name.text;
          const use: ScriptImportedSymbol = {
            module,
            importedName,
            localName: element.name.text,
            typeOnly: clause?.isTypeOnly === true || element.isTypeOnly,
            source: lineSource(file, element, source),
          };
          importedSymbols.push(use);
          capabilities.push({
            capability: "api-imported-symbol",
            detail: importedName,
            source: use.source,
          });
        }
      }
    }

    if (
      ts.isPropertyAccessExpression(node) &&
      !(ts.isCallExpression(node.parent) && node.parent.expression === node)
    ) {
      if (ts.isIdentifier(node.expression)) {
        const binding = namedMinecraftBindings.get(node.expression.text);
        if (binding) {
          const access: ScriptModuleMemberAccess = {
            module: binding.module,
            importedName: binding.importedName,
            localName: node.expression.text,
            member: node.name.text,
            symbol: `${binding.importedName}.${node.name.text}`,
            source: lineSource(file, node, source),
          };
          moduleMemberAccesses.push(access);
          capabilities.push({
            capability: "api-module-member",
            detail: access.symbol,
            source: access.source,
          });
        }
      }

      const chain = propertyAccessChain(node);
      const namespaceModule = chain[0]
        ? namespaceMinecraftBindings.get(chain[0])
        : undefined;
      const namespaceLocal = chain[0];
      const importedName = chain[1];
      const member = chain[2];
      if (
        namespaceModule &&
        chain.length === 3 &&
        namespaceLocal &&
        importedName &&
        member
      ) {
        const access: ScriptModuleMemberAccess = {
          module: namespaceModule,
          importedName,
          localName: namespaceLocal,
          member,
          symbol: `${importedName}.${member}`,
          source: lineSource(file, node, source),
        };
        moduleMemberAccesses.push(access);
        capabilities.push({
          capability: "api-module-member",
          detail: access.symbol,
          source: access.source,
        });
      }
    }

    if (ts.isTypeReferenceNode(node) && ts.isQualifiedName(node.typeName)) {
      const chain = qualifiedNameChain(node.typeName);
      const module = chain[0]
        ? namespaceMinecraftBindings.get(chain[0])
        : undefined;
      if (module && chain.length === 2 && chain[1]) {
        const use: ScriptImportedSymbol = {
          module,
          importedName: chain[1],
          localName: `${chain[0]}.${chain[1]}`,
          typeOnly: true,
          source: lineSource(file, node, source),
        };
        importedSymbols.push(use);
        capabilities.push({
          capability: "api-imported-symbol",
          detail: chain[1],
          source: use.source,
        });
      }
    }

    if (ts.isBinaryExpression(node)) {
      const op = node.operatorToken.kind === ts.SyntaxKind.EqualsToken
        ? "=" as const
        : node.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken
          ? "+=" as const
          : node.operatorToken.kind === ts.SyntaxKind.MinusEqualsToken
            ? "-=" as const
            : undefined;
      if (op && (ts.isPropertyAccessExpression(node.left) ||
          ts.isElementAccessExpression(node.left))) {
        const executionRegion = localExecutionRegionId(node, file);
        if (executionRegion.startsWith("function:")) {
          authoredPropertyMutations.push({
            executionRegion,
            targetExpression: node.left.getText(file).slice(0, 180),
            valueExpression: node.right.getText(file).slice(0, 180),
            operator: op,
            source: lineSource(file, node, source),
            lexicalGuards: lexicalBranchGuards(node, file, source),
            precedenceGuards: precedingEarlyExitGuards(node, file, source),
          });
        }
      }
      if (node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
        const target = stateMutationTarget(node.left);
        const value = stateMutationValue(node.right);
        if (target && value) {
          stateMutations.push({
            ...target,
            value,
            executionRegion: localExecutionRegionId(node, file),
            lexicalGuards: lexicalBranchGuards(node, file, source),
            precedenceGuards: precedingEarlyExitGuards(node, file, source),
            source: lineSource(file, node, source),
          });
        }
      }

      const operatorKind = node.operatorToken.kind;
      const operator =
        operatorKind === ts.SyntaxKind.EqualsEqualsToken ? "==" :
        operatorKind === ts.SyntaxKind.EqualsEqualsEqualsToken ? "===" :
        operatorKind === ts.SyntaxKind.ExclamationEqualsToken ? "!=" :
        operatorKind === ts.SyntaxKind.ExclamationEqualsEqualsToken ? "!==" :
        undefined;

      if (operator) {
        const leftMember = canonicalMinecraftMember(node.left);
        const rightMember = canonicalMinecraftMember(node.right);
        const leftLiteral = ts.isStringLiteralLike(node.left) ? node.left.text : undefined;
        const rightLiteral = ts.isStringLiteralLike(node.right) ? node.right.text : undefined;
        const member = leftMember ?? rightMember;
        const literal = leftMember ? rightLiteral : leftLiteral;

        if (member && literal !== undefined) {
          enumValueComparisons.push({
            module: member.module,
            enumName: member.enumName,
            member: member.member,
            symbol: member.symbol,
            operator,
            literal,
            source: lineSource(file, node, source),
          });
        }
      }
    }

    if (ts.isIdentifier(node) && (node.text === "world" || node.text === "system")) {
      capabilities.push({
        capability: node.text === "world" ? "world-access" : "system-access",
        source: lineSource(file, node, source),
      });
    }

    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      spatialTransformNames.has(node.expression.text) &&
      node.arguments.length >= 2
    ) {
      const pointExpression = node.arguments[0];
      const contextExpression = node.arguments[1];
      if (pointExpression && contextExpression) {
        const pointText = pointExpression.getText(file);
        if (
          /(?:^|\.)(?:location|position|point)$/.test(
            pointText,
          )
        ) {
          spatialTransformUses.push({
            functionName: node.expression.text,
            pointExpression: pointText,
            contextExpression:
              contextExpression.getText(file),
            source: lineSource(file, node, source),
          });
        }
      }
    }

    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      localCallableDeclarations.has(node.expression.text) &&
      !isShadowed(node.expression)
    ) {
      const target = localCallableDeclarations.get(node.expression.text)!;
      const bindings = inferExactCallArgumentParameterBindings(
        node, file, source,
        { region: "function:" + node.expression.text, parameters: target.parameters, body: target.body! },
        file, source);
      const lexicalGuards = lexicalBranchGuards(node, file, source);
      const precedenceGuards = precedingEarlyExitGuards(node, file, source);
      const localCallSequence = sourceSequentialSite(node, file, source);
      localFunctionCalls.push({
        callerRegion: localExecutionRegionId(node, file),
        targetRegion: "function:" + node.expression.text,
        targetName: node.expression.text,
        ...(bindings.length ? { argumentParameterBindings: bindings } : {}),
        controlFlow: lexicalGuards.length || precedenceGuards.length
          ? "conditional" : localCallControlFlow(node),
        lexicalGuards,
        precedenceGuards,
        source: lineSource(file, node, source),
        ...(localCallSequence === undefined ? {} : {
          sourceSequence: localCallSequence,
        }),
      });
    }

    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const chain = propertyAccessChain(node.expression);
      const methodName = node.expression.name.text;

      const localMethodTarget = directThisMethodTarget(node);
      if (localMethodTarget) {
        const container = enclosingClassLike(node);
        const targets = container?.members.filter((member): member is ts.MethodDeclaration =>
          ts.isMethodDeclaration(member) &&
          declarationMemberName(member.name) === localMethodTarget &&
          member.body !== undefined) ?? [];
        const target = targets.length === 1 ? targets[0] : undefined;
        const bindings = target
          ? inferExactCallArgumentParameterBindings(node, file, source,
              {region:sourceMethodRegion(target, file),parameters:target.parameters,body:target.body!},file,source)
          : [];
        const lexicalGuards = lexicalBranchGuards(node, file, source);
        const precedenceGuards = precedingEarlyExitGuards(node, file, source);
        const methodCallSequence = sourceSequentialSite(node, file, source);
        if (target) localFunctionCalls.push({
          callerRegion: localExecutionRegionId(node, file),
          targetRegion: sourceMethodRegion(target, file),
          targetName: localMethodTarget,
          ...(bindings.length ? {argumentParameterBindings:bindings} : {}),
          argumentExpressions:node.arguments.map(arg => arg.getText(file)),
          controlFlow: lexicalGuards.length || precedenceGuards.length
            ? "conditional" : localCallControlFlow(node),
          lexicalGuards,
          precedenceGuards,
          source: lineSource(file, node, source),
          ...(methodCallSequence === undefined ? {} : {
            sourceSequence: methodCallSequence,
          }),
        });
      }

      if (methodName === "runCommand" || methodName === "runCommandAsync") {
        const argument = node.arguments[0];
        if (
          argument &&
          (
            ts.isStringLiteralLike(argument) ||
            ts.isNoSubstitutionTemplateLiteral(argument)
          )
        ) {
          commandLiterals.push({
            command: argument.text.trim(),
            mechanism: methodName,
            executionRegion: localExecutionRegionId(node, file),
            receiverHint: node.expression.expression.getText(file),
            source: lineSource(file, argument, source),
            lexicalGuards: lexicalBranchGuards(node, file, source),
            precedenceGuards: precedingEarlyExitGuards(node, file, source),
          });
        }
      }

      const scheduler = deferredScheduler(node, file, typedSchedulerSites);
      if (scheduler) {
        const callback = callbackNode(node) ?? localConstCallback(node) ?? constCallback(node);
        const namedScheduledCallback = namedCallback(node);
        const generationGuard = callback
          ? leadingGenerationGuard(callback, file, source)
          : undefined;
        const guardIdentifiers = generationGuard?.identifiers ?? [];
        const delayArgument =
          (
            scheduler === "runTimeout" ||
            scheduler === "runInterval"
          )
            ? node.arguments[1]
            : undefined;
        const delayTicks =
          delayArgument === undefined
            ? undefined
            : numericLiteralValue(
                delayArgument,
              );
        deferredCallbacks.push({
          scheduler,
          source: lineSource(file, node, source),
          callerRegion: localExecutionRegionId(node, file),
          ...(callback
            ? {
                callbackRegion: callbackExecutionRegionId(callback, file),
                callbackSource: lineSource(file, callback, source),
              }
            : namedScheduledCallback
              ? {
                  callbackRegion: "function:" + namedScheduledCallback,
                  ...(topLevelCallbackSources.get(namedScheduledCallback) === undefined ? {} : {
                    callbackSource: topLevelCallbackSources.get(namedScheduledCallback)!,
                  }),
                }
              : {}),
          guardEvidence: guardIdentifiers.length > 0
            ? "explicit-generation-check"
            : "unresolved",
          guardIdentifiers,
          ...(generationGuard === undefined ? {} : {
            generationGuardSource: generationGuard.guardSource,
            ...(generationGuard.operands === undefined ? {} : {
              generationGuardOperands: generationGuard.operands,
            }),
          }),
          ...(delayTicks === undefined
            ? {}
            : { delayTicks }),
        });
      }

      if (node.expression.name.text === "triggerEvent") {
        const eventArg = node.arguments[0];
        if (eventArg && ts.isStringLiteralLike(eventArg)) {
          entityEventTriggers.push({
            event: eventArg.text,
            receiverHint: node.expression.expression.getText(file),
            executionRegion: localExecutionRegionId(node, file),
            source: lineSource(file, node, source),
            lexicalGuards: lexicalBranchGuards(node, file, source),
            precedenceGuards: precedingEarlyExitGuards(node, file, source),
          });
        }
      }

      const commandCallback = customCommandCallback(node);
      if (commandCallback) {
        restrictedMutations.push(
          ...scanRestrictedMutations(
            commandCallback,
            "system",
            "custom-command",
            "customCommand",
            file,
            source,
            methodCalls,
            propertyWrites,
          ),
        );
      }

      if (chain.at(-1) === "subscribe") {
        const root = chain[0];
        const phase = chain[1];
        const event = chain[2];
        // The event chain must resolve to an unshadowed runtime singleton
        // import. A user-local 'world.afterEvents' lookalike remains unknown.
        let rootExpression: ts.Expression = node.expression.expression;
        while (ts.isPropertyAccessExpression(rootExpression)) {
          rootExpression = rootExpression.expression;
        }
        const rootBinding = root && ts.isIdentifier(rootExpression) &&
          rootExpression.text === root && !isShadowed(rootExpression)
            ? namedMinecraftBindings.get(root)
            : undefined;
        const canonicalRoot = rootBinding?.importedName;
        const normalizedRoot: ScriptEventSubscription["root"] =
          canonicalRoot === "world" || canonicalRoot === "system"
            ? canonicalRoot : "unknown";
        const normalizedPhase: ScriptEventSubscription["phase"] =
          phase === "beforeEvents" || phase === "afterEvents" ? phase : "unknown";

        if (event) {
          const eventSource = lineSource(file, node, source);
          const eventCallback = callbackNode(node) ?? localConstCallback(node) ?? constCallback(node);
          const namedEventCallback = namedCallback(node);
          events.push({
            root: normalizedRoot,
            phase: normalizedPhase,
            event,
            executionRegion: localExecutionRegionId(node, file),
            ...(eventCallback
              ? {
                  callbackRegion: callbackExecutionRegionId(eventCallback, file),
                  callbackSource: lineSource(file, eventCallback, source),
                }
              : namedEventCallback
                ? {
                    callbackRegion: "function:" + namedEventCallback,
                    ...(topLevelCallbackSources.get(namedEventCallback) === undefined ? {} : {
                      callbackSource: topLevelCallbackSources.get(namedEventCallback)!,
                    }),
                  }
                : {}),
            source: eventSource,
          });
          capabilities.push({
            capability: "event-subscription",
            detail: `${normalizedRoot}.${normalizedPhase}.${event}`,
            source: eventSource,
          });

          if (normalizedPhase === "beforeEvents") {
            capabilities.push({
              capability:
                normalizedRoot === "system" && event === "startup"
                  ? "early-execution"
                  : "restricted-execution",
              detail: `${normalizedRoot}.${normalizedPhase}.${event}`,
              source: eventSource,
            });

            const isStartup =
              normalizedRoot === "system" && event === "startup";
            if (eventCallback && !isStartup) {
              restrictedMutations.push(
                ...scanRestrictedMutations(
                  eventCallback,
                  normalizedRoot,
                  "before-event",
                  event,
                  file,
                  source,
                  methodCalls,
                  propertyWrites,
                ),
              );
            }
          }

          if (
            normalizedRoot === "system" &&
            normalizedPhase === "afterEvents" &&
            event === "scriptEventReceive"
          ) {
            capabilities.push({
              capability: "script-event",
              detail: "system.afterEvents.scriptEventReceive",
              source: eventSource,
            });
          }
        }
      }

      const method = chain.at(-1);
      if (
        method === "getDynamicProperty" ||
        method === "setDynamicProperty" ||
        method === "clearDynamicProperties" ||
        method === "getDynamicPropertyIds" ||
        method === "getDynamicPropertyTotalByteCount"
      ) {
        const access: DynamicPropertyAccess = {
          operation: dynamicPropertyOperation(method),
          receiverHint: node.expression.expression.getText(file),
          executionRegion: localExecutionRegionId(node, file),
          source: lineSource(file, node, source),
          lexicalGuards: lexicalBranchGuards(node, file, source),
          precedenceGuards: precedingEarlyExitGuards(node, file, source),
        };
        const propertyArgument = node.arguments[0];
        if (propertyArgument) {
          access.propertyExpression =
            propertyArgument.getText(file);
        }
        const propertyId = stringArgument(node);
        if (propertyId) access.propertyId = propertyId;
        if (method === "setDynamicProperty") {
          const literal = authoredScalar(node.arguments[1]);
          if (literal) access.writtenLiteral = literal;
        }
        // Only direct strict scalar comparison to the same get call site.
        // The condition's exact AST span must later be an actual guard on a
        // write; a comparison in ordinary data does not establish a phase.
        if (method === "getDynamicProperty" &&
            ts.isBinaryExpression(node.parent) &&
            (node.parent.left === node || node.parent.right === node)) {
          const comparison = node.parent;
          const op = comparison.operatorToken.kind;
          if (op === ts.SyntaxKind.EqualsEqualsEqualsToken ||
              op === ts.SyntaxKind.ExclamationEqualsEqualsToken) {
            const other = comparison.left === node
              ? comparison.right : comparison.left;
            const literal = authoredScalar(other);
            if (literal) {
              access.comparedLiteral = {
                ...literal,
                operator: op === ts.SyntaxKind.EqualsEqualsEqualsToken
                  ? "strict-eq" : "strict-neq",
                comparisonSource: lineSource(file, comparison, source),
              };
            }
          }
        }
        // Singleton provenance is accepted only for a named, unshadowed
        // import of 'world' from @minecraft/server. Player/entity receiver
        // spellings may alias or rebind and must not inherit this identity.
        const receiver = ts.isPropertyAccessExpression(node.expression)
          ? node.expression.expression : undefined;
        const stableWorldReceiver = receiver !== undefined &&
          ts.isIdentifier(receiver) &&
          namedMinecraftBindings.get(receiver.text)?.importedName === "world" &&
          !isShadowed(receiver);
        const sourceSequence = sourceSequentialSite(
          node, file, source, stableWorldReceiver);
        if (sourceSequence) access.sourceSequence = sourceSequence;
        dynamicProperties.push(access);
        capabilities.push({
          capability: "dynamic-properties",
          ...(propertyId ? { detail: `${access.operation}:${propertyId}` } : { detail: access.operation }),
          source: access.source,
        });
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(file);

  const withCallGuards = <T extends { source: SourceRef }>(item: T) => {
    const site = resourceSiteKey(item.source);
    const guards = site === undefined ? undefined : callSiteGuards.get(site);
    return {
      ...item,
      ...(guards?.lexicalGuards.length ? { lexicalGuards: guards.lexicalGuards } : {}),
      ...(guards?.precedenceGuards.length ? { precedenceGuards: guards.precedenceGuards } : {}),
    };
  };
  const contextualCleanupResourceEvidence = cleanupResourceEvidence.map(item => {
    const key = resourceSiteKey(item.source);
    const context = key === undefined ? undefined : resourceBranchContext.get(key);
    return {
      ...item,
      ...(context?.lexicalGuards.length
        ? { lexicalGuards: context.lexicalGuards } : {}),
      ...(context?.precedenceGuards.length
        ? { precedenceGuards: context.precedenceGuards } : {}),
    };
  });

  for (const fallback of inferFallbackGuardedOutcomes(
    file,
    source,
  )) {
    guardedOutcomes.push(fallback);
  }

  return {
    identifier,
    source,
    text,
    controlFlowRegions: deriveScriptControlFlow(file, source),
    waveConfigurations: extractScriptWaveStages(file, source),
    authoredGameplayCatalog: extractScriptGameplayCatalog(file, source),
    authoredContentCollections: extractScriptContentCollections(file, source),
    authoredContentUses: extractScriptContentUseSites(file, source),
    authoredPropertyMutations,
    unresolvedReceiverCalls,
    ...classWiring,
    ...mapWiring,
    blockCustomComponentRegistrations,
    persistentReconciliation,
    arenaAuthorityEvidence,
    arenaAuthorityPaths,
    persistenceIdempotencyGuards,
    safeConfigBindings: [...safeConfig.bindings],
    safeConfigFunctions: [...safeConfig.functions],
    safeConfigImports: [...safeConfig.imports],
    safeConfigExports: [...safeConfig.exports],
    safeConfigRejected: [...safeConfig.rejected],
    repairTransformHints: [
      ...deriveCapturedGenerationGuardTransformHints(
        identifier,
        text,
        source,
      ),
      ...derivePersistenceIdempotencyGuardTransformHints(
        identifier,
        text,
        source,
      ),
      ...deriveArenaCapacityGuardTransformHints(
        identifier,
        text,
        source,
      ),
      ...deriveArenaStartOwnershipGuardTransformHints(
        identifier,
        text,
        source,
      ),
    ],
    imports,
    events,
    dynamicProperties,
    restrictedMutations,
    deferredCallbacks,
    localFunctionCalls,
    importedCallGuardSites,
    blockMatchGuards,
    methodCalls: methodCalls.map(withCallGuards),
    propertyAccesses,
    propertyWrites,
    entityEventTriggers,
    commandLiterals,
    lifecycleMemberExposures,
    moduleMemberAccesses,
    importedSymbols,
    enumValueComparisons,
    stateMutations,
    typeProperties,
    transitionDeclarations,
    returnOutcomes,
    guardedOutcomes,
    declaredMembers,
    spatialRoutePoints,
    spatialOffsetTransforms,
    spatialTransformUses,
    spatialContextOffsetSeries,
    spatialWorldMutations: spatialWorldMutations.map(withCallGuards),
    spatialMutations: [...spatialMutations.mutations],
    cleanupResourceEvidence: contextualCleanupResourceEvidence,
    chunkLifecycleEvidence: [
      ...chunkLifecycleEvidence,
    ],
    combatLifecycleEvidence: [
      ...combatLifecycleEvidence,
    ],
    economyEvidence: [
      ...economyEvidence,
    ],
    inventoryLifecycleEvidence: [
      ...inventoryLifecycleEvidence,
    ],
    globalLeaseEvidence: [...globalLeaseEvidence],
    progressionCounterEvidence: [
      ...progressionCounterEvidence,
    ],
    progressionActorSpawnEvidence: [
      ...progressionActorSpawnEvidence,
    ],
    progressionActorRegistryEvidence: [
      ...progressionActorRegistryEvidence,
    ],
    persistentDataLifecycleEvidence: [
      ...persistentDataLifecycleEvidence,
    ],
    resultAuditRecordEvidence: [
      ...resultAuditRecordEvidence,
    ],
    persistentStateScopes:
      inferPersistentStateScopes(
        dynamicProperties,
      ),
    persistentStateLifetimes:
      inferPersistentStateLifetimes(
        persistentDataLifecycleEvidence,
        inferPersistentStateScopes(
          dynamicProperties,
        ),
        contextualCleanupResourceEvidence,
      ),
    spatialMutationRejected: [...spatialMutations.rejected],
    capabilities,
  };
}
