import ts from "typescript";
import { sourceMethodRegion } from "../../core/control-flow.js";
import type {
  SourceRef,
} from "../../../../../packages/project-model/src/index.js";

export type ScriptEconomyEvidenceKind =
  | "pickup-subscription"
  | "inventory-grant"
  | "world-drop"
  | "score-credit"
  | "score-debit"
  | "score-adjust"
  | "score-write"
  | "item-consume"
  | "death-entity-type-guard";

export interface ScriptEconomyEvidence {
  kind: ScriptEconomyEvidenceKind;
  executionRegion: string;
  subjectExpression: string;
  itemIdentifier?: string;
  itemBinding?: string;
  participantExpression?: string;
  objectiveExpression?: string;
  amount?: number;
  entityIdentifier?: string;
  source: SourceRef;
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

function callbackRegion(
  call: ts.CallExpression,
  file: ts.SourceFile,
): string | undefined {
  const callback = call.arguments[0];
  if (
    !callback ||
    (
      !ts.isArrowFunction(callback) &&
      !ts.isFunctionExpression(callback)
    )
  ) {
    return undefined;
  }
  const start =
    file.getLineAndCharacterOfPosition(
      callback.getStart(file),
    );
  return (
    "callback@" +
    (start.line + 1) +
    ":" +
    (start.character + 1)
  );
}

function eventName(
  call: ts.CallExpression,
): string | undefined {
  if (
    !ts.isPropertyAccessExpression(
      call.expression,
    ) ||
    call.expression.name.text !== "subscribe"
  ) {
    return undefined;
  }
  const owner =
    call.expression.expression;
  return ts.isPropertyAccessExpression(owner)
    ? owner.name.text
    : undefined;
}

function itemStackIdentifier(
  expression: ts.Expression | undefined,
): string | undefined {
  if (
    !expression ||
    !ts.isNewExpression(expression)
  ) {
    return undefined;
  }
  const ctor = expression.expression;
  const isItemStack =
    (
      ts.isIdentifier(ctor) &&
      ctor.text === "ItemStack"
    ) ||
    (
      ts.isPropertyAccessExpression(ctor) &&
      ctor.name.text === "ItemStack"
    );
  if (!isItemStack) return undefined;

  const first =
    expression.arguments?.[0];
  return (
    first &&
    (
      ts.isStringLiteralLike(first) ||
      ts.isNoSubstitutionTemplateLiteral(
        first,
      )
    )
  )
    ? first.text
    : undefined;
}

function numericLiteral(
  expression: ts.Expression | undefined,
): number | undefined {
  if (!expression) return undefined;
  if (ts.isNumericLiteral(expression)) {
    return Number(expression.text);
  }
  if (
    ts.isPrefixUnaryExpression(expression) &&
    (
      expression.operator ===
        ts.SyntaxKind.MinusToken ||
      expression.operator ===
        ts.SyntaxKind.PlusToken
    ) &&
    ts.isNumericLiteral(expression.operand)
  ) {
    const value =
      Number(expression.operand.text);
    return expression.operator ===
      ts.SyntaxKind.MinusToken
      ? -value
      : value;
  }
  return undefined;
}

export function deriveScriptEconomyEvidence(
  text: string,
  source: SourceRef,
): ScriptEconomyEvidence[] {
  const file = ts.createSourceFile(
    source.relativePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(source.relativePath),
  );
  const output: ScriptEconomyEvidence[] = [];
  const itemBindings =
    new Map<string, string>();

  const collectBindings = (
    node: ts.Node,
  ): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer
    ) {
      const identifier =
        itemStackIdentifier(
          node.initializer,
        );
      if (identifier) {
        itemBindings.set(
          node.name.text,
          identifier,
        );
      }
    }
    ts.forEachChild(
      node,
      collectBindings,
    );
  };
  collectBindings(file);

  const resolveItem = (
    expression: ts.Expression | undefined,
  ): string | undefined => {
    const direct =
      itemStackIdentifier(expression);
    if (direct) return direct;
    return (
      expression &&
      ts.isIdentifier(expression)
    )
      ? itemBindings.get(expression.text)
      : undefined;
  };

  const push = (
    node: ts.Node,
    values: Omit<
      ScriptEconomyEvidence,
      "executionRegion" | "source"
    >,
    regionOverride?: string,
  ) => {
    output.push({
      ...values,
      executionRegion:
        regionOverride ??
        executionRegion(node, file),
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
      const receiver =
        node.expression.expression.getText(
          file,
        );
      const event = eventName(node);

      if (event === "entityItemPickup") {
        push(
          node,
          {
            kind: "pickup-subscription",
            subjectExpression:
              node.expression.getText(file),
          },
          callbackRegion(node, file),
        );
      }

      if (method === "addItem") {
        const item = node.arguments[0];
        const identifier =
          resolveItem(item);
        push(node, {
          kind: "inventory-grant",
          subjectExpression: receiver,
          ...(item && ts.isIdentifier(item)
            ? {
                itemBinding:
                  item.text,
              }
            : {}),
          ...(identifier === undefined
            ? {}
            : {
                itemIdentifier:
                  identifier,
              }),
        });
      } else if (method === "spawnItem") {
        const item = node.arguments[0];
        const identifier =
          resolveItem(item);
        push(node, {
          kind: "world-drop",
          subjectExpression: receiver,
          ...(item && ts.isIdentifier(item)
            ? {
                itemBinding:
                  item.text,
              }
            : {}),
          ...(identifier === undefined
            ? {}
            : {
                itemIdentifier:
                  identifier,
              }),
        });
      } else if (
        method === "addScore"
      ) {
        const participant =
          node.arguments[0];
        const amount =
          numericLiteral(
            node.arguments[1],
          );
        push(node, {
          kind:
            amount === undefined
              ? "score-adjust"
              : amount < 0
                ? "score-debit"
                : "score-credit",
          subjectExpression: receiver,
          objectiveExpression: receiver,
          ...(participant === undefined
            ? {}
            : {
                participantExpression:
                  participant.getText(file),
              }),
          ...(amount === undefined
            ? {}
            : { amount }),
        });
      } else if (
        method === "setScore"
      ) {
        const participant =
          node.arguments[0];
        const amount =
          numericLiteral(
            node.arguments[1],
          );
        push(node, {
          kind: "score-write",
          subjectExpression: receiver,
          objectiveExpression: receiver,
          ...(participant === undefined
            ? {}
            : {
                participantExpression:
                  participant.getText(file),
              }),
          ...(amount === undefined
            ? {}
            : { amount }),
        });
      } else if (
        (
          method === "remove" ||
          method === "kill"
        ) &&
        /item|drop|reward/i.test(
          receiver,
        )
      ) {
        push(node, {
          kind: "item-consume",
          subjectExpression: receiver,
        });
      }
    }

    if (
      ts.isBinaryExpression(node) &&
      (
        node.operatorToken.kind ===
          ts.SyntaxKind.EqualsEqualsToken ||
        node.operatorToken.kind ===
          ts.SyntaxKind.EqualsEqualsEqualsToken
      )
    ) {
      const pairs: readonly [
        ts.Expression,
        ts.Expression,
      ][] = [
        [node.left, node.right],
        [node.right, node.left],
      ];
      for (const [candidate, literal] of pairs) {
        if (
          ts.isPropertyAccessExpression(
            candidate,
          ) &&
          candidate.name.text === "typeId" &&
          ts.isStringLiteralLike(literal)
        ) {
          push(node, {
            kind: "death-entity-type-guard",
            subjectExpression:
              candidate.expression.getText(file),
            entityIdentifier: literal.text,
          });
          break;
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(file);

  return output
    .filter((item, index, array) =>
      array.findIndex((candidate) =>
        candidate.kind === item.kind &&
        candidate.executionRegion ===
          item.executionRegion &&
        candidate.subjectExpression ===
          item.subjectExpression &&
        candidate.itemIdentifier ===
          item.itemIdentifier &&
        candidate.participantExpression ===
          item.participantExpression &&
        candidate.amount ===
          item.amount &&
        candidate.entityIdentifier ===
          item.entityIdentifier &&
        candidate.source.range?.lineStart ===
          item.source.range?.lineStart
      ) === index
    )
    .sort((a, b) =>
      a.executionRegion.localeCompare(
        b.executionRegion,
      ) ||
      a.kind.localeCompare(b.kind) ||
      (a.itemIdentifier ?? "").localeCompare(
        b.itemIdentifier ?? "",
      )
    );
}
