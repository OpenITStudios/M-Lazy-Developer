import ts from "typescript";
import { sourceMethodRegion } from "../../core/control-flow.js";
import type {
  SourceRef,
} from "../../../../../packages/project-model/src/index.js";
import type { ScriptLexicalGuard } from "../../core/types.js";

export type ScriptCleanupResourceSurface =
  | "tag"
  | "effect"
  | "scoreboard"
  | "deferred-callback"
  | "input-permission"
  | "mount-relationship";

/** Source-only witnesses, not a runtime reset failure or observed skipped chunk. */
export type ScriptArenaResetCompletionKind =
  | "reset-error-swallowed-candidate"
  | "partial-reset-result-candidate"
  | "idle-before-cleanup-settlement-candidate";

export interface ScriptArenaResetCompletionEvidence {
  readonly kind: ScriptArenaResetCompletionKind;
  readonly executionRegion: string;
  readonly source: SourceRef;
  readonly detail: string;
}

export interface ScriptCleanupResourceEvidence {
  surface: ScriptCleanupResourceSurface;
  action: "acquire" | "release";
  key: string;
  executionRegion: string;
  precision: "exact" | "surface-level";
  source: SourceRef;
  /** Filled by the canonical script parser using the exact authored AST site. */
  lexicalGuards?: readonly ScriptLexicalGuard[];
  /** Necessary opposite arms after direct early exits, not runtime proof. */
  precedenceGuards?: readonly ScriptLexicalGuard[];
}

function scriptKind(path: string): ts.ScriptKind {
  if (path.endsWith(".ts")) return ts.ScriptKind.TS;
  if (path.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (path.endsWith(".jsx")) return ts.ScriptKind.JSX;
  return ts.ScriptKind.JS;
}

function nodeSource(
  file: ts.SourceFile,
  node: ts.Node,
  source: SourceRef,
): SourceRef {
  const start =
    file.getLineAndCharacterOfPosition(
      node.getStart(file),
    );
  const end =
    file.getLineAndCharacterOfPosition(
      node.getEnd(),
    );
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

function executionRegion(
  node: ts.Node,
  file: ts.SourceFile,
): string {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (
      ts.isFunctionDeclaration(current) &&
      current.name
    ) {
      return "function:" + current.name.text;
    }
    if (ts.isMethodDeclaration(current)) {
      // Use the parser's canonical source-qualified class-method identity.
      // A bare method name can alias another class in the same bundle.
      return sourceMethodRegion(current, file);
    }
    if (
      ts.isArrowFunction(current) ||
      ts.isFunctionExpression(current)
    ) {
      const start =
        file.getLineAndCharacterOfPosition(
          current.getStart(file),
        );
      return (
        "callback@" +
        (start.line + 1) +
        ":" +
        (start.character + 1)
      );
    }
    current = current.parent;
  }
  return "module";
}

function literal(
  expression: ts.Expression | undefined,
): string | undefined {
  if (!expression) return undefined;
  if (
    ts.isStringLiteralLike(expression) ||
    ts.isNoSubstitutionTemplateLiteral(expression) ||
    ts.isNumericLiteral(expression)
  ) {
    return expression.text;
  }
  if (
    expression.kind === ts.SyntaxKind.TrueKeyword
  ) return "true";
  if (
    expression.kind === ts.SyntaxKind.FalseKeyword
  ) return "false";
  return undefined;
}

function receiverText(
  expression: ts.Expression,
  file: ts.SourceFile,
): string {
  return expression.getText(file);
}

function participantText(
  expression: ts.Expression | undefined,
  file: ts.SourceFile,
): string {
  return expression?.getText(file) ?? "*";
}

function assignedIdentifier(
  call: ts.CallExpression,
): string | undefined {
  const parent = call.parent;
  if (
    ts.isVariableDeclaration(parent) &&
    ts.isIdentifier(parent.name)
  ) {
    return parent.name.text;
  }
  if (
    ts.isBinaryExpression(parent) &&
    parent.operatorToken.kind ===
      ts.SyntaxKind.EqualsToken &&
    ts.isIdentifier(parent.left)
  ) {
    return parent.left.text;
  }
  return undefined;
}

export function deriveScriptCleanupResourceEvidence(
  text: string,
  source: SourceRef,
): ScriptCleanupResourceEvidence[] {
  const file = ts.createSourceFile(
    source.relativePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(source.relativePath),
  );
  const output: ScriptCleanupResourceEvidence[] = [];

  const push = (
    node: ts.Node,
    surface: ScriptCleanupResourceSurface,
    action: "acquire" | "release",
    key: string | undefined,
  ) => {
    output.push({
      surface,
      action,
      key: key ?? "*",
      executionRegion:
        executionRegion(node, file),
      precision:
        key === undefined
          ? "surface-level"
          : "exact",
      source:
        nodeSource(file, node, source),
    });
  };

  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(
        node.expression,
      )
    ) {
      const method =
        node.expression.name.text;
      const receiver = receiverText(
        node.expression.expression,
        file,
      );

      if (method === "addTag") {
        const tag = literal(node.arguments[0]);
        push(
          node,
          "tag",
          "acquire",
          tag === undefined
            ? undefined
            : receiver + ":" + tag,
        );
      } else if (method === "removeTag") {
        const tag = literal(node.arguments[0]);
        push(
          node,
          "tag",
          "release",
          tag === undefined
            ? undefined
            : receiver + ":" + tag,
        );
      } else if (method === "addEffect") {
        const effect = literal(
          node.arguments[0],
        );
        push(
          node,
          "effect",
          "acquire",
          effect === undefined
            ? undefined
            : receiver + ":" + effect,
        );
      } else if (method === "removeEffect") {
        const effect = literal(
          node.arguments[0],
        );
        push(
          node,
          "effect",
          "release",
          effect === undefined
            ? undefined
            : receiver + ":" + effect,
        );
      } else if (method === "clearEffects") {
        push(
          node,
          "effect",
          "release",
          receiver + ":*",
        );
      } else if (
        method === "setScore" ||
        method === "addScore"
      ) {
        push(
          node,
          "scoreboard",
          "acquire",
          receiver +
            ":" +
            participantText(
              node.arguments[0],
              file,
            ),
        );
      } else if (
        method === "removeParticipant"
      ) {
        push(
          node,
          "scoreboard",
          "release",
          receiver +
            ":" +
            participantText(
              node.arguments[0],
              file,
            ),
        );
      } else if (
        method === "runTimeout" ||
        method === "runInterval" ||
        method === "runJob"
      ) {
        const handle =
          assignedIdentifier(node);
        push(
          node,
          "deferred-callback",
          "acquire",
          handle === undefined
            ? undefined
            : "handle:" + handle,
        );
      } else if (method === "addRider") {
        const rider = node.arguments[0]?.getText(file);
        push(node, "mount-relationship", "acquire",
          rider === undefined ? undefined : receiver + ":" + rider);
      } else if (method === "removeRider") {
        const rider = node.arguments[0]?.getText(file);
        push(node, "mount-relationship", "release",
          rider === undefined ? undefined : receiver + ":" + rider);
      } else if (method === "ejectRiders") {
        push(node, "mount-relationship", "release", receiver + ":*");
      } else if (method === "clearRun") {
        const handle =
          node.arguments[0] &&
          ts.isIdentifier(node.arguments[0])
            ? node.arguments[0].text
            : undefined;
        push(
          node,
          "deferred-callback",
          "release",
          handle === undefined
            ? undefined
            : "handle:" + handle,
        );
      }
    }

    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind ===
        ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(
        node.left,
      )
    ) {
      const target = node.left.getText(file);
      if (
        /inputPermissions/i.test(target)
      ) {
        const value = literal(node.right);
        push(
          node,
          "input-permission",
          value === "true"
            ? "release"
            : "acquire",
          target,
        );
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(file);

  return output.sort((a, b) =>
    a.executionRegion.localeCompare(
      b.executionRegion,
    ) ||
    a.surface.localeCompare(b.surface) ||
    a.key.localeCompare(b.key) ||
    a.action.localeCompare(b.action)
  );
}

/** Bounded reset-completion source witnesses using the parser's existing AST.
 * A source catch or partial return is not evidence of an actual failed game.
 */
export function deriveScriptArenaResetCompletionEvidence(
  file: ts.SourceFile,
  source: SourceRef,
): ScriptArenaResetCompletionEvidence[] {
  const output: ScriptArenaResetCompletionEvidence[] = [];
  const named = (name: ts.PropertyName | undefined): string | undefined =>
    name && (ts.isIdentifier(name) || ts.isStringLiteralLike(name))
      ? name.text : undefined;
  const propertyCall = (
    node: ts.Node, name: string,
  ): node is ts.CallExpression & { expression: ts.PropertyAccessExpression } =>
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === name;
  const consoleOnly = (body: ts.ConciseBody): boolean =>
    ts.isBlock(body) && body.statements.every(statement => {
      if (!ts.isExpressionStatement(statement) ||
          !ts.isCallExpression(statement.expression) ||
          !ts.isPropertyAccessExpression(statement.expression.expression)) return false;
      const member = statement.expression.expression;
      return ts.isIdentifier(member.expression) &&
        member.expression.text === "console" &&
        ["warn", "error", "log", "info"].includes(member.name.text);
    });
  const resolvedReturn = (statement: ts.Statement): boolean => {
    if (!ts.isReturnStatement(statement) || !statement.expression) return false;
    const expr = statement.expression;
    return ts.isCallExpression(expr) &&
      ts.isPropertyAccessExpression(expr.expression) &&
      ts.isIdentifier(expr.expression.expression) &&
      expr.expression.expression.text === "Promise" &&
      expr.expression.name.text === "resolve" &&
      expr.arguments.length === 0;
  };
  const idleSessionCall = (statement: ts.Statement): boolean => {
    if (!ts.isExpressionStatement(statement) ||
        !propertyCall(statement.expression, "saveSession")) return false;
    const config = statement.expression.arguments[1];
    return !!config && ts.isObjectLiteralExpression(config) &&
      config.properties.some(property =>
        ts.isPropertyAssignment(property) &&
        named(property.name) === "status" &&
        ts.isStringLiteralLike(property.initializer) &&
        property.initializer.text === "idle");
  };
  const cleanupCall = (statement: ts.Statement): boolean => {
    const expr = ts.isReturnStatement(statement)
      ? statement.expression
      : ts.isExpressionStatement(statement) ? statement.expression : undefined;
    return !!expr && propertyCall(expr, "trackArenaCleanup");
  };
  const inspectOwner = (
    owner: ts.MethodDeclaration | ts.FunctionDeclaration,
  ): void => {
    if (!owner.body) return;
    const methodName = named(owner.name);
    if (!methodName) return;
    const parent = ts.isMethodDeclaration(owner) ? owner.parent : undefined;
    const className = parent &&
      (ts.isClassDeclaration(parent) || ts.isClassExpression(parent))
      ? parent.name?.text ??
        (ts.isVariableDeclaration(parent.parent) &&
         ts.isIdentifier(parent.parent.name) ? parent.parent.name.text : "")
      : "";
    const relevant = /(?:reset|cleanup)/i.test(methodName) ||
      /reset/i.test(className);
    const region = executionRegion(owner.body, file);
    const emit = (kind: ScriptArenaResetCompletionKind, node: ts.Node, detail: string): void => {
      output.push({ kind, executionRegion: region, source: nodeSource(file, node, source), detail });
    };
    // Only direct-statement order is known. No dominance or runtime re-entry
    // is inferred from a preceding idle write.
    const statements = owner.body.statements;
    for (let i = 0; i < statements.length; i++) {
      if (idleSessionCall(statements[i]!) &&
          statements.slice(i + 1).some(cleanupCall)) {
        emit("idle-before-cleanup-settlement-candidate", statements[i]!,
          "Source idle-session write precedes cleanup handoff; admission guards are assessed separately.");
      }
    }
    if (!relevant) return;

    const skippedResultIds = new Set<string>();
    const returnedIds = new Set<string>();
    const skippedPushes: ts.CallExpression[] = [];
    const visit = (node: ts.Node): void => {
      // Callbacks are independent execution regions. Do not borrow their
      // control flow as direct statements of the enclosing reset method.
      if (node !== owner.body && (ts.isArrowFunction(node) ||
          ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node) ||
          ts.isMethodDeclaration(node))) return;
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) &&
          node.initializer && ts.isObjectLiteralExpression(node.initializer) &&
          node.initializer.properties.some(property =>
            ts.isPropertyAssignment(property) &&
            named(property.name) === "skippedChunks" &&
            ts.isArrayLiteralExpression(property.initializer))) {
        skippedResultIds.add(node.name.text);
      }
      if (ts.isReturnStatement(node) && node.expression &&
          ts.isIdentifier(node.expression)) returnedIds.add(node.expression.text);
      if (propertyCall(node, "push") &&
          ts.isPropertyAccessExpression(node.expression.expression) &&
          node.expression.expression.name.text === "skippedChunks" &&
          ts.isIdentifier(node.expression.expression.expression)) {
        skippedPushes.push(node);
      }
      if (propertyCall(node, "catch") && !ts.isVoidExpression(node.parent)) {
        const callback = node.arguments[0];
        if (callback && (ts.isArrowFunction(callback) ||
            ts.isFunctionExpression(callback)) && consoleOnly(callback.body)) {
          emit("reset-error-swallowed-candidate", node,
            "An inline catch has no direct failure propagation; source-only candidate.");
        }
      }
      if (ts.isCatchClause(node) &&
          node.block.statements.some(resolvedReturn) &&
          !node.block.statements.some(ts.isThrowStatement)) {
        emit("reset-error-swallowed-candidate", node,
          "A reset-related catch returns an empty resolved Promise.");
      }
      ts.forEachChild(node, visit);
    };
    visit(owner.body);
    const partial = skippedPushes.find(call =>
      ts.isPropertyAccessExpression(call.expression) &&
      ts.isPropertyAccessExpression(call.expression.expression) &&
      ts.isIdentifier(call.expression.expression.expression) &&
      skippedResultIds.has(call.expression.expression.expression.text) &&
      returnedIds.has(call.expression.expression.expression.text));
    if (partial && /reset/i.test(className)) {
      emit("partial-reset-result-candidate", partial,
        "A reset source records skippedChunks while allowing a normal resolved result.");
    }
  };
  const visit = (node: ts.Node): void => {
    if (ts.isMethodDeclaration(node) || ts.isFunctionDeclaration(node)) {
      inspectOwner(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return output.sort((a, b) =>
    a.source.relativePath.localeCompare(b.source.relativePath) ||
    (a.source.range?.lineStart ?? 0) - (b.source.range?.lineStart ?? 0) ||
    (a.source.range?.columnStart ?? 0) - (b.source.range?.columnStart ?? 0) ||
    a.kind.localeCompare(b.kind));
}
