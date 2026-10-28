import ts from "typescript";
import { sourceMethodRegion } from "../../core/control-flow.js";
import type {
  SourceRef,
} from "../../../../../packages/project-model/src/index.js";

export type ScriptInventoryEvidenceKind =
  | "inventory-clear-all"
  | "inventory-clear-slot"
  | "equipment-clear-slot"
  | "item-grant"
  | "equipment-set"
  | "item-read"
  | "item-copy-mutation"
  | "item-writeback"
  | "item-drop"
  | "item-world-spawn";

export interface ScriptInventoryLifecycleEvidence {
  kind: ScriptInventoryEvidenceKind;
  executionRegion: string;
  subjectExpression: string;
  itemBinding?: string;
  itemIdentifier?: string;
  slotExpression?: string;
  grantResultBinding?: string;
  grantResultStatus?:
    | "unobserved"
    | "captured-unchecked"
    | "checked"
    | "propagated";
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

function isUndefinedExpression(
  expression: ts.Expression | undefined,
): boolean {
  return (
    expression === undefined ||
    (
      ts.isIdentifier(expression) &&
      expression.text === "undefined"
    ) ||
    (
      ts.isVoidExpression(expression) &&
      ts.isNumericLiteral(expression.expression) &&
      expression.expression.text === "0"
    )
  );
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

function containsIdentifier(
  node: ts.Node,
  identifier: string,
): boolean {
  let found = false;
  const visit = (current: ts.Node): void => {
    if (found) return;
    if (
      ts.isIdentifier(current) &&
      current.text === identifier
    ) {
      found = true;
      return;
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
  return found;
}

function executionOwner(
  node: ts.Node,
): ts.Node {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (
      ts.isFunctionDeclaration(current) ||
      ts.isMethodDeclaration(current) ||
      ts.isArrowFunction(current) ||
      ts.isFunctionExpression(current)
    ) {
      return current;
    }
    current = current.parent;
  }
  return node.getSourceFile();
}

function conditionExpression(
  node: ts.Node,
): ts.Expression | undefined {
  if (
    ts.isIfStatement(node) ||
    ts.isWhileStatement(node) ||
    ts.isDoStatement(node)
  ) {
    return node.expression;
  }
  if (ts.isForStatement(node)) {
    return node.condition;
  }
  if (ts.isConditionalExpression(node)) {
    return node.condition;
  }
  return undefined;
}

function grantResultEvidence(
  call: ts.CallExpression,
): {
  binding?: string;
  status:
    | "unobserved"
    | "captured-unchecked"
    | "checked"
    | "propagated";
} {
  const binding = assignedIdentifier(call);
  if (!binding) {
    return {
      status: ts.isReturnStatement(call.parent)
        ? "propagated"
        : "unobserved",
    };
  }

  const owner = executionOwner(call);
  const callEnd = call.getEnd();
  let checked = false;
  const visit = (node: ts.Node): void => {
    if (checked) return;
    const condition = conditionExpression(node);
    if (
      condition &&
      condition.getStart() > callEnd &&
      containsIdentifier(
        condition,
        binding,
      )
    ) {
      checked = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(owner, visit);

  return {
    binding,
    status: checked
      ? "checked"
      : "captured-unchecked",
  };
}

function itemStackIdentifier(
  expression: ts.Expression | undefined,
): string | undefined {
  if (!expression || !ts.isNewExpression(expression)) {
    return undefined;
  }
  const constructor = expression.expression;
  const isItemStack =
    (
      ts.isIdentifier(constructor) &&
      constructor.text === "ItemStack"
    ) ||
    (
      ts.isPropertyAccessExpression(constructor) &&
      constructor.name.text === "ItemStack"
    );
  if (!isItemStack) return undefined;

  const first = expression.arguments?.[0];
  return (
    first &&
    (
      ts.isStringLiteralLike(first) ||
      ts.isNoSubstitutionTemplateLiteral(first)
    )
  )
    ? first.text
    : undefined;
}

function rootIdentifier(
  expression: ts.Expression,
): string | undefined {
  if (ts.isIdentifier(expression)) {
    return expression.text;
  }
  if (
    ts.isPropertyAccessExpression(expression) ||
    ts.isElementAccessExpression(expression)
  ) {
    return rootIdentifier(expression.expression);
  }
  if (ts.isCallExpression(expression)) {
    return rootIdentifier(expression.expression);
  }
  return undefined;
}

export function deriveScriptInventoryLifecycleEvidence(
  text: string,
  source: SourceRef,
): ScriptInventoryLifecycleEvidence[] {
  const file = ts.createSourceFile(
    source.relativePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(source.relativePath),
  );

  const itemBindings =
    new Map<string, string>();
  const copiedItems = new Map<
    string,
    {
      region: string;
      subjectExpression: string;
      slotExpression?: string;
    }
  >();
  const output: ScriptInventoryLifecycleEvidence[] = [];

  const collectItemBindings = (
    node: ts.Node,
  ): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer
    ) {
      const identifier =
        itemStackIdentifier(node.initializer);
      if (identifier) {
        itemBindings.set(
          node.name.text,
          identifier,
        );
      }
    }
    ts.forEachChild(node, collectItemBindings);
  };

  collectItemBindings(file);

  const itemIdentifier = (
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
      ScriptInventoryLifecycleEvidence,
      "executionRegion" | "source"
    >,
  ) => {
    output.push({
      ...values,
      executionRegion:
        executionRegion(node, file),
      source: nodeSource(file, node, source),
    });
  };

  const collectCopies = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(
        node.expression,
      ) &&
      node.expression.name.text === "getItem"
    ) {
      const binding = assignedIdentifier(node);
      if (binding) {
        const slot = node.arguments[0];
        copiedItems.set(binding, {
          region: executionRegion(node, file),
          subjectExpression:
            node.expression.expression.getText(file),
          ...(slot === undefined
            ? {}
            : {
                slotExpression:
                  slot.getText(file),
              }),
        });
        push(node, {
          kind: "item-read",
          subjectExpression:
            node.expression.expression.getText(file),
          itemBinding: binding,
          ...(slot === undefined
            ? {}
            : {
                slotExpression:
                  slot.getText(file),
              }),
        });
      }
    }
    ts.forEachChild(node, collectCopies);
  };

  collectCopies(file);

  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(
        node.expression,
      )
    ) {
      const method = node.expression.name.text;
      const receiver =
        node.expression.expression.getText(file);

      if (method === "clearAll") {
        push(node, {
          kind: "inventory-clear-all",
          subjectExpression: receiver,
        });
      } else if (method === "addItem") {
        const item = node.arguments[0];
        const identifier =
          itemIdentifier(item);
        const result =
          grantResultEvidence(node);
        push(node, {
          kind: "item-grant",
          subjectExpression: receiver,
          ...(item && ts.isIdentifier(item)
            ? { itemBinding: item.text }
            : {}),
          ...(identifier === undefined
            ? {}
            : { itemIdentifier: identifier }),
          ...(result.binding === undefined
            ? {}
            : {
                grantResultBinding:
                  result.binding,
              }),
          grantResultStatus:
            result.status,
        });
      } else if (method === "setEquipment") {
        const item = node.arguments[1];
        const identifier =
          itemIdentifier(item);
        push(node, {
          kind:
            isUndefinedExpression(item)
              ? "equipment-clear-slot"
              : "equipment-set",
          subjectExpression: receiver,
          ...(node.arguments[0] === undefined
            ? {}
            : {
                slotExpression:
                  node.arguments[0]!.getText(file),
              }),
          ...(item && ts.isIdentifier(item)
            ? { itemBinding: item.text }
            : {}),
          ...(identifier === undefined
            ? {}
            : {
                itemIdentifier: identifier,
              }),
        });
      } else if (method === "setItem") {
        const slot = node.arguments[0];
        const item = node.arguments[1];
        const copiedBinding =
          item && ts.isIdentifier(item) &&
          copiedItems.has(item.text)
            ? item.text
            : undefined;

        if (
          isUndefinedExpression(item)
        ) {
          push(node, {
            kind: "inventory-clear-slot",
            subjectExpression: receiver,
            ...(slot === undefined
              ? {}
              : {
                  slotExpression:
                    slot.getText(file),
                }),
          });
        } else if (copiedBinding) {
          push(node, {
            kind: "item-writeback",
            subjectExpression: receiver,
            itemBinding: copiedBinding,
            ...(slot === undefined
              ? {}
              : {
                  slotExpression:
                    slot.getText(file),
                }),
          });
        }
      } else if (
        method === "spawnItem" ||
        method === "dropItem"
      ) {
        const item = node.arguments[0];
        const identifier =
          itemIdentifier(item);
        push(node, {
          kind:
            method === "dropItem"
              ? "item-drop"
              : "item-world-spawn",
          subjectExpression: receiver,
          ...(item && ts.isIdentifier(item)
            ? { itemBinding: item.text }
            : {}),
          ...(identifier === undefined
            ? {}
            : {
                itemIdentifier: identifier,
              }),
        });
      }

      const receiverRoot =
        rootIdentifier(node.expression.expression);
      if (
        receiverRoot &&
        copiedItems.has(receiverRoot) &&
        [
          "setLore",
          "setDynamicProperty",
          "setCanDestroy",
          "setCanPlaceOn",
        ].includes(method)
      ) {
        push(node, {
          kind: "item-copy-mutation",
          subjectExpression: receiver,
          itemBinding: receiverRoot,
        });
      }
    }

    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind ===
        ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(node.left)
    ) {
      const root = rootIdentifier(node.left);
      if (
        root &&
        copiedItems.has(root)
      ) {
        push(node, {
          kind: "item-copy-mutation",
          subjectExpression:
            node.left.getText(file),
          itemBinding: root,
        });
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
        candidate.itemBinding ===
          item.itemBinding &&
        candidate.itemIdentifier ===
          item.itemIdentifier &&
        candidate.slotExpression ===
          item.slotExpression &&
        candidate.grantResultBinding ===
          item.grantResultBinding &&
        candidate.grantResultStatus ===
          item.grantResultStatus &&
        candidate.source.range?.lineStart ===
          item.source.range?.lineStart
      ) === index
    )
    .sort((a, b) =>
      a.executionRegion.localeCompare(
        b.executionRegion,
      ) ||
      a.kind.localeCompare(b.kind) ||
      (a.itemBinding ?? "").localeCompare(
        b.itemBinding ?? "",
      )
    );
}

export function inventoryCopyMutationHasWriteback(
  evidence: readonly ScriptInventoryLifecycleEvidence[],
  itemBinding: string,
  executionRegion?: string,
): boolean {
  return evidence.some((item) =>
    item.kind === "item-writeback" &&
    item.itemBinding === itemBinding &&
    (
      executionRegion === undefined ||
      item.executionRegion ===
        executionRegion
    )
  );
}

