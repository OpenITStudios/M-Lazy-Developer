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
