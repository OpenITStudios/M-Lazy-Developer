import ts from "typescript";
import type {
  SafeConfigExpression,
} from "../../../../../packages/behavior-model/src/index.js";
import type {
  SourceRef,
} from "../../../../../packages/project-model/src/index.js";
import {
  compileSafeConfigExpression,
} from "../../config/safe-config-compiler.js";

export type ScriptSpatialMutationKind =
  | "teleport"
  | "try-teleport"
  | "entity-spawn"
  | "structure-place";

export interface ScriptSpatialMutationEvidence {
  kind: ScriptSpatialMutationKind;
  executionRegion: string;
  receiverText: string;
  source: SourceRef;
  position: SafeConfigExpression;
  identifier?: string;
  /** Exact source of a resolved authored identifier; never runtime spawn proof. */
  identifierValueSource?: SourceRef;
  identifierResolution?: "inline-literal" | "unique-module-literal";
  /** Authored teleport options, not observed dimension/arrival evidence. */
  dimensionExpression?: string;
  checkForBlocks?: boolean;
  resultBinding?: string;
}

export interface ScriptSpatialMutationRejection {
  method: string;
  executionRegion: string;
  reason: string;
  source: SourceRef;
}

export interface ScriptSpatialMutationExtraction {
  mutations: readonly ScriptSpatialMutationEvidence[];
  rejected: readonly ScriptSpatialMutationRejection[];
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
      const name = current.name;
      if (
        ts.isIdentifier(name) ||
        ts.isStringLiteralLike(name)
      ) {
        return "function:" + name.text;
      }
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

function literalString(
  expression: ts.Expression | undefined,
): string | undefined {
  if (
    expression &&
    (
      ts.isStringLiteralLike(expression) ||
      ts.isNoSubstitutionTemplateLiteral(expression)
    )
  ) {
    return expression.text;
  }
  return undefined;
}

/** Resolve ONLY uniquely authored, top-level literal bindings. Generated
 * script bundles often compile const into var; that spelling alone is not
 * enough: shadowing, subsequent writes, dynamic evaluation or other bindings
 * must all prevent source-level identity attribution.
 *
 * This does not establish that an execution region is reached or that a
 * Dimension.spawnEntity request succeeds in Minecraft.
 */
function moduleSpawnIdentifiers(
  file: ts.SourceFile,
  source: SourceRef,
): ReadonlyMap<string, {
  identifier: string; valueSource: SourceRef; declarationEnd: number;
}> {
  const candidates = new Map<string, {
    identifier: string;
    declaration: ts.VariableDeclaration;
    valueSource: SourceRef;
    declarationEnd: number;
  }>();
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement) ||
        (statement.declarationList.flags & ts.NodeFlags.Let) !== 0) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name)) continue;
      const value = literalString(declaration.initializer);
      if (value === undefined) continue;
      candidates.set(declaration.name.text, {
        identifier: value,
        declaration,
        valueSource: nodeSource(file, declaration.initializer!, source),
        declarationEnd: declaration.getEnd(),
      });
    }
  }
  if (candidates.size === 0) return new Map();
  const bindingCounts = new Map<string, number>();
  const writes = new Set<string>();
  let dynamicEval = false;
  const bind = (name: ts.BindingName): void => {
    if (ts.isIdentifier(name)) {
      bindingCounts.set(name.text, (bindingCounts.get(name.text) ?? 0) + 1);
      return;
    }
    for (const element of name.elements) {
      if (ts.isBindingElement(element)) bind(element.name);
    }
  };
  const write = (node: ts.Node): void => {
    // Assignment destructuring may contain shorthand property nodes rather
    // than bare identifiers. Conservatively taint every identifier below an
    // authored assignment target, including nested patterns.
    if (ts.isIdentifier(node)) writes.add(node.text);
    else ts.forEachChild(node, write);
  };
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) || ts.isParameter(node) ||
        ts.isBindingElement(node)) {
      bind(node.name);
    } else if ((ts.isFunctionDeclaration(node) ||
                ts.isClassDeclaration(node) ||
                ts.isFunctionExpression(node) ||
                ts.isClassExpression(node)) && node.name) {
      bind(node.name);
    } else if (ts.isImportClause(node) && node.name) {
      bind(node.name);
    } else if (ts.isImportSpecifier(node)) {
      bind(node.name);
    } else if (ts.isNamespaceImport(node)) {
      bind(node.name);
    }
    if (ts.isBinaryExpression(node) &&
        node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
        node.operatorToken.kind <= ts.SyntaxKind.LastAssignment) {
      write(node.left);
    } else if ((ts.isPrefixUnaryExpression(node) ||
                ts.isPostfixUnaryExpression(node)) &&
               (node.operator === ts.SyntaxKind.PlusPlusToken ||
                node.operator === ts.SyntaxKind.MinusMinusToken)) {
      write(node.operand);
    } else if (ts.isForOfStatement(node) || ts.isForInStatement(node)) {
      if (ts.isExpression(node.initializer)) write(node.initializer);
    } else if (ts.isCallExpression(node) &&
               ts.isIdentifier(node.expression) &&
               node.expression.text === "eval") {
      dynamicEval = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  const result = new Map<string, {
    identifier: string; valueSource: SourceRef; declarationEnd: number;
  }>();
  if (dynamicEval) return result;
  for (const [name, candidate] of candidates) {
    if (bindingCounts.get(name) === 1 && !writes.has(name)) {
      result.set(name, {
        identifier: candidate.identifier,
        valueSource: candidate.valueSource,
        declarationEnd: candidate.declarationEnd,
      });
    }
  }
  return result;
}

function expressionAt(
  call: ts.CallExpression,
  index: number,
): SafeConfigExpression | undefined {
  const value = call.arguments[index];
  if (!value) return undefined;
  // Calls can invoke arbitrary runtime logic. A compiled call-shaped
  // expression does not prove that its coordinates are deterministic.
  let runtimeCall = false;
  const inspect = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) runtimeCall = true;
    ts.forEachChild(node, inspect);
  };
  inspect(value);
  return runtimeCall ? undefined : compileSafeConfigExpression(value);
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

export function deriveScriptSpatialMutations(
  text: string,
  source: SourceRef,
): ScriptSpatialMutationExtraction {
  const file = ts.createSourceFile(
    source.relativePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(source.relativePath),
  );
  const mutations: ScriptSpatialMutationEvidence[] = [];
  const rejected: ScriptSpatialMutationRejection[] = [];
  const identifiers = moduleSpawnIdentifiers(file, source);

  const reject = (
    call: ts.CallExpression,
    method: string,
    reason: string,
  ) => {
    rejected.push({
      method,
      executionRegion: executionRegion(call, file),
      reason,
      source: nodeSource(file, call, source),
    });
  };

  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression)
    ) {
      const method = node.expression.name.text;
      const receiverText =
        node.expression.expression.getText(file);
      const region = executionRegion(node, file);
      const sourceRef = nodeSource(file, node, source);

      if (method === "teleport" || method === "tryTeleport") {
        const position = expressionAt(node, 0);
        if (!position) {
          reject(
            node,
            method,
            "Teleport destination is outside the deterministic safe-config subset.",
          );
        } else {
          mutations.push({
            kind: method === "tryTeleport" ? "try-teleport" : "teleport",
            executionRegion: region,
            receiverText,
            source: sourceRef,
            position,
            ...(node.arguments[1]?.getText(file).match(/dimension\s*:\s*([^,}]+)/)?.[1] === undefined
              ? {}
              : { dimensionExpression: node.arguments[1]!.getText(file).match(/dimension\s*:\s*([^,}]+)/)![1]!.trim() }),
            ...(node.arguments[1]?.getText(file).match(/checkForBlocks\s*:\s*(true|false)/)?.[1] === undefined
              ? {}
              : { checkForBlocks: node.arguments[1]!.getText(file).match(/checkForBlocks\s*:\s*(true|false)/)![1] === "true" }),
            ...(method !== "tryTeleport" || assignedIdentifier(node) === undefined
              ? {}
              : { resultBinding: assignedIdentifier(node)! }),
          });
        }
      }

      if (method === "spawnEntity") {
        const position = expressionAt(node, 1);
        const identifier = literalString(node.arguments[0]);
        const binding = node.arguments[0] &&
          ts.isIdentifier(node.arguments[0])
          ? identifiers.get(node.arguments[0].text)
          : undefined;
        const resolved = identifier === undefined ? binding?.identifier : identifier;
        // Respect declaration order even when a call is inside a function:
        // a hoisted var may be undefined if executed before initialization.
        const valueSource = binding && node.arguments[0] &&
          binding.declarationEnd < node.arguments[0].getStart(file)
          ? binding.valueSource : undefined;
        if (!position) {
          reject(
            node,
            method,
            "spawnEntity position is outside the deterministic safe-config subset.",
          );
        } else {
          mutations.push({
            kind: "entity-spawn",
            executionRegion: region,
            receiverText,
            source: sourceRef,
            position,
            ...(identifier !== undefined
              ? { identifier,
                  identifierResolution: "inline-literal" as const,
                  identifierValueSource: nodeSource(file, node.arguments[0]!, source) }
              : valueSource === undefined
                ? {}
                : { identifier: resolved!,
                    identifierResolution: "unique-module-literal" as const,
                    identifierValueSource: valueSource }),
            ...(assignedIdentifier(node) === undefined
              ? {}
              : { resultBinding: assignedIdentifier(node)! }),
          });
        }
      }

      if (
        method === "place" &&
        /structureManager/i.test(receiverText)
      ) {
        const position = expressionAt(node, 2);
        const identifier = literalString(
          node.arguments[0],
        );
        if (!position) {
          reject(
            node,
            method,
            "Structure placement destination is outside the deterministic safe-config subset.",
          );
        } else {
          mutations.push({
            kind: "structure-place",
            executionRegion: region,
            receiverText,
            source: sourceRef,
            position,
            ...(identifier === undefined
              ? {}
              : { identifier }),
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(file);
  return {
    mutations,
    rejected,
  };
}
