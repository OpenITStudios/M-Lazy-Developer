import ts from "typescript";
import type {
  SafeConfigExpression,
  SafeConfigFunction,
} from "../../../../packages/behavior-model/src/index.js";
import type {
  SourceRef,
} from "../../../../packages/project-model/src/index.js";

export interface ScriptSafeConfigFunction {
  name: string;
  definition: SafeConfigFunction;
  source: SourceRef;
}

export interface ScriptSafeConfigBinding {
  name: string;
  expression: SafeConfigExpression;
  source: SourceRef;
}

export interface ScriptSafeConfigRejection {
  name?: string;
  reason:
    | "non-const"
    | "destructuring"
    | "unsupported-expression"
    | "unsupported-property"
    | "unsupported-call";
  detail: string;
  source: SourceRef;
}

export interface ScriptSafeConfigImport {
  module: string;
  importedName: string;
  localName: string;
  kind: "named" | "default" | "namespace";
  source: SourceRef;
}

export interface ScriptSafeConfigReExport {
  module: string;
  importedName?: string;
  exportedName?: string;
  exportAll: boolean;
  source: SourceRef;
}

export interface ScriptSafeConfigExport {
  localName: string;
  exportedName: string;
  source: SourceRef;
}

export interface ScriptSafeConfigCompilation {
  bindings: readonly ScriptSafeConfigBinding[];
  functions: readonly ScriptSafeConfigFunction[];
  imports: readonly ScriptSafeConfigImport[];
  exports: readonly ScriptSafeConfigExport[];
  reExports: readonly ScriptSafeConfigReExport[];
  rejected: readonly ScriptSafeConfigRejection[];
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
  const start = file.getLineAndCharacterOfPosition(
    node.getStart(file),
  );
  const end = file.getLineAndCharacterOfPosition(
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

function propertyName(
  node: ts.PropertyName,
): string | undefined {
  if (
    ts.isIdentifier(node) ||
    ts.isStringLiteralLike(node) ||
    ts.isNumericLiteral(node)
  ) {
    return node.text;
  }
  return undefined;
}


function functionParameterNames(
  parameters: readonly ts.ParameterDeclaration[],
): string[] | undefined {
  const names: string[] = [];
  for (const parameter of parameters) {
    if (
      !ts.isIdentifier(parameter.name) ||
      parameter.dotDotDotToken !== undefined ||
      parameter.initializer !== undefined
    ) {
      return undefined;
    }
    names.push(parameter.name.text);
  }
  return names;
}

function functionBodyExpression(
  node:
    | ts.FunctionDeclaration
    | ts.FunctionExpression
    | ts.ArrowFunction,
): ts.Expression | undefined {
  if (ts.isArrowFunction(node) && !ts.isBlock(node.body)) {
    return node.body;
  }

  const body = node.body;
  if (!body || !ts.isBlock(body)) {
    return undefined;
  }
  if (
    body.statements.length !== 1 ||
    !body.statements[0] || !ts.isReturnStatement(body.statements[0]) ||
    body.statements[0]!.expression === undefined
  ) {
    return undefined;
  }
  return body.statements[0]!.expression;
}

function compileSafeFunction(
  node:
    | ts.FunctionDeclaration
    | ts.FunctionExpression
    | ts.ArrowFunction,
): SafeConfigFunction | undefined {
  if (
    "asteriskToken" in node &&
    node.asteriskToken !== undefined
  ) {
    return undefined;
  }
  const modifiers =
    "modifiers" in node
      ? node.modifiers
      : undefined;
  if (
    modifiers?.some(
      (modifier) =>
        modifier.kind === ts.SyntaxKind.AsyncKeyword,
    )
  ) {
    return undefined;
  }

  const params =
    functionParameterNames(node.parameters);
  const body =
    functionBodyExpression(node);
  if (!params || !body) return undefined;
  const compiled =
    compileSafeConfigExpression(body);
  return compiled
    ? {
        params,
        body: compiled,
      }
    : undefined;
}

function objectLengthExpression(
  expression: ts.Expression,
): SafeConfigExpression | undefined {
  if (!ts.isObjectLiteralExpression(expression)) {
    return undefined;
  }
  const lengthProperty =
    expression.properties.find(
      (property) =>
        ts.isPropertyAssignment(property) &&
        propertyName(property.name) === "length",
    );
  if (
    !lengthProperty ||
    !ts.isPropertyAssignment(lengthProperty)
  ) {
    return undefined;
  }
  return compileSafeConfigExpression(
    lengthProperty.initializer,
  );
}

export function compileSafeConfigExpression(
  expression: ts.Expression,
): SafeConfigExpression | undefined {
  const value =
    ts.isParenthesizedExpression(expression)
      ? expression.expression
      : expression;

  if (ts.isStringLiteralLike(value)) {
    return {
      kind: "literal",
      value: value.text,
    };
  }
  if (ts.isNumericLiteral(value)) {
    const number = Number(value.text);
    return Number.isFinite(number)
      ? { kind: "literal", value: number }
      : undefined;
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

  if (ts.isIdentifier(value)) {
    return {
      kind: "ref",
      name: value.text,
    };
  }

  if (
    ts.isPrefixUnaryExpression(value) &&
    (
      value.operator === ts.SyntaxKind.PlusToken ||
      value.operator === ts.SyntaxKind.MinusToken
    )
  ) {
    const operand = compileSafeConfigExpression(value.operand);
    if (!operand) return undefined;
    return {
      kind: "binary",
      operator:
        value.operator === ts.SyntaxKind.PlusToken
          ? "+"
          : "-",
      left: { kind: "literal", value: 0 },
      right: operand,
    };
  }

  if (ts.isArrayLiteralExpression(value)) {
    const parts: Array<{
      expression: SafeConfigExpression;
      spread: boolean;
    }> = [];
    let hasSpread = false;

    for (const item of value.elements) {
      if (ts.isSpreadElement(item)) {
        const compiled =
          compileSafeConfigExpression(
            item.expression,
          );
        if (!compiled) return undefined;
        parts.push({
          expression: compiled,
          spread: true,
        });
        hasSpread = true;
        continue;
      }

      const compiled =
        compileSafeConfigExpression(item);
      if (!compiled) return undefined;
      parts.push({
        expression: compiled,
        spread: false,
      });
    }

    return hasSpread
      ? {
          kind: "array-compose",
          parts,
        }
      : {
          kind: "array",
          items: parts.map(
            (part) => part.expression,
          ),
        };
  }

  if (ts.isObjectLiteralExpression(value)) {
    const parts: SafeConfigExpression[] = [];
    let pending: Record<
      string,
      SafeConfigExpression
    > = {};
    let hasSpread = false;

    const flushPending = () => {
      if (
        Object.keys(pending).length === 0
      ) return;
      parts.push({
        kind: "object",
        entries: pending,
      });
      pending = {};
    };

    for (const property of value.properties) {
      if (
        ts.isSpreadAssignment(property)
      ) {
        flushPending();
        const compiled =
          compileSafeConfigExpression(
            property.expression,
          );
        if (!compiled) return undefined;
        parts.push(compiled);
        hasSpread = true;
        continue;
      }

      if (
        ts.isShorthandPropertyAssignment(
          property,
        )
      ) {
        pending[property.name.text] = {
          kind: "ref",
          name: property.name.text,
        };
        continue;
      }

      if (
        !ts.isPropertyAssignment(property)
      ) {
        return undefined;
      }
      const key = propertyName(property.name);
      if (key === undefined) return undefined;
      const compiled =
        compileSafeConfigExpression(
          property.initializer,
        );
      if (!compiled) return undefined;
      pending[key] = compiled;
    }
    flushPending();

    if (!hasSpread && parts.length === 1) {
      return parts[0]!;
    }
    return {
      kind: "object-merge",
      parts,
    };
  }

  if (
    ts.isCallExpression(value) &&
    ts.isPropertyAccessExpression(value.expression) &&
    value.expression.name.text === "map"
  ) {
    if (value.arguments.length !== 1) {
      return undefined;
    }
    const source =
      compileSafeConfigExpression(
        value.expression.expression,
      );
    const callback = value.arguments[0];
    if (!source || !callback) {
      return undefined;
    }

    if (ts.isIdentifier(callback)) {
      const itemName = "$item";
      return {
        kind: "map",
        source,
        itemName,
        body: {
          kind: "call",
          name: callback.text,
          args: [{
            kind: "ref",
            name: itemName,
          }],
        },
      };
    }

    if (
      !ts.isArrowFunction(callback) &&
      !ts.isFunctionExpression(callback)
    ) {
      return undefined;
    }

    const params =
      functionParameterNames(
        callback.parameters,
      );
    const body =
      functionBodyExpression(callback);
    if (
      !params ||
      params.length < 1 ||
      params.length > 2 ||
      !body
    ) {
      return undefined;
    }
    const compiledBody =
      compileSafeConfigExpression(body);
    if (!compiledBody) return undefined;

    return {
      kind: "map",
      source,
      itemName: params[0]!,
      ...(params[1] === undefined
        ? {}
        : { indexName: params[1] }),
      body: compiledBody,
    };
  }

  if (
    ts.isCallExpression(value) &&
    ts.isPropertyAccessExpression(value.expression) &&
    ts.isIdentifier(value.expression.expression) &&
    value.expression.expression.text === "Array" &&
    value.expression.name.text === "from"
  ) {
    if (value.arguments.length !== 2) {
      return undefined;
    }
    const length =
      objectLengthExpression(
        value.arguments[0]!,
      );
    const callback =
      value.arguments[1]!;
    if (
      !length ||
      (
        !ts.isArrowFunction(callback) &&
        !ts.isFunctionExpression(callback)
      )
    ) {
      return undefined;
    }
    const params =
      functionParameterNames(
        callback.parameters,
      );
    const body =
      functionBodyExpression(callback);
    if (
      !params ||
      params.length !== 2 ||
      !params[0]!.startsWith("_") ||
      !body
    ) {
      return undefined;
    }
    const compiledBody =
      compileSafeConfigExpression(body);
    if (!compiledBody) return undefined;

    return {
      kind: "array-from",
      length,
      indexName: params[1]!,
      body: compiledBody,
    };
  }

  if (ts.isPropertyAccessExpression(value)) {
    const object = compileSafeConfigExpression(value.expression);
    if (!object) return undefined;
    return {
      kind: "get",
      object,
      key: value.name.text,
    };
  }

  if (ts.isElementAccessExpression(value)) {
    const object = compileSafeConfigExpression(value.expression);
    const argument = value.argumentExpression;
    if (
      !object ||
      !argument ||
      (
        !ts.isStringLiteralLike(argument) &&
        !ts.isNumericLiteral(argument)
      )
    ) {
      return undefined;
    }
    return {
      kind: "get",
      object,
      key: argument.text,
    };
  }

  if (ts.isConditionalExpression(value)) {
    const condition =
      compileSafeConfigExpression(
        value.condition,
      );
    const whenTrue =
      compileSafeConfigExpression(
        value.whenTrue,
      );
    const whenFalse =
      compileSafeConfigExpression(
        value.whenFalse,
      );
    if (
      !condition ||
      !whenTrue ||
      !whenFalse
    ) {
      return undefined;
    }
    return {
      kind: "conditional",
      condition,
      whenTrue,
      whenFalse,
    };
  }

  if (ts.isTemplateExpression(value)) {
    let expression:
      SafeConfigExpression = {
        kind: "literal",
        value: value.head.text,
      };

    for (
      const span of
        value.templateSpans
    ) {
      const middle =
        compileSafeConfigExpression(
          span.expression,
        );
      if (!middle) return undefined;

      expression = {
        kind: "binary",
        operator: "+",
        left: expression,
        right: middle,
      };
      if (span.literal.text.length > 0) {
        expression = {
          kind: "binary",
          operator: "+",
          left: expression,
          right: {
            kind: "literal",
            value: span.literal.text,
          },
        };
      }
    }

    return expression;
  }

  if (ts.isBinaryExpression(value)) {
    const left =
      compileSafeConfigExpression(value.left);
    const right =
      compileSafeConfigExpression(value.right);
    if (!left || !right) return undefined;

    const arithmetic =
      value.operatorToken.kind ===
        ts.SyntaxKind.PlusToken
        ? "+"
        : value.operatorToken.kind ===
            ts.SyntaxKind.MinusToken
          ? "-"
          : value.operatorToken.kind ===
              ts.SyntaxKind.AsteriskToken
            ? "*"
            : value.operatorToken.kind ===
                ts.SyntaxKind.SlashToken
              ? "/"
              : undefined;
    if (arithmetic) {
      return {
        kind: "binary",
        operator: arithmetic,
        left,
        right,
      };
    }

    const comparison =
      value.operatorToken.kind ===
        ts.SyntaxKind.EqualsEqualsToken
        ? "=="
        : value.operatorToken.kind ===
            ts.SyntaxKind.EqualsEqualsEqualsToken
          ? "==="
          : value.operatorToken.kind ===
              ts.SyntaxKind.ExclamationEqualsToken
            ? "!="
            : value.operatorToken.kind ===
                ts.SyntaxKind.ExclamationEqualsEqualsToken
              ? "!=="
              : value.operatorToken.kind ===
                  ts.SyntaxKind.LessThanToken
                ? "<"
                : value.operatorToken.kind ===
                    ts.SyntaxKind.LessThanEqualsToken
                  ? "<="
                  : value.operatorToken.kind ===
                      ts.SyntaxKind.GreaterThanToken
                    ? ">"
                    : value.operatorToken.kind ===
                        ts.SyntaxKind.GreaterThanEqualsToken
                      ? ">="
                      : undefined;
    if (comparison) {
      return {
        kind: "compare",
        operator: comparison,
        left,
        right,
      };
    }

    const logical =
      value.operatorToken.kind ===
        ts.SyntaxKind.AmpersandAmpersandToken
        ? "&&"
        : value.operatorToken.kind ===
            ts.SyntaxKind.BarBarToken
          ? "||"
          : value.operatorToken.kind ===
              ts.SyntaxKind.QuestionQuestionToken
            ? "??"
            : undefined;
    if (logical) {
      return {
        kind: "logical",
        operator: logical,
        left,
        right,
      };
    }

    return undefined;
  }

  if (
    ts.isCallExpression(value) &&
    ts.isIdentifier(value.expression) &&
    value.expression.text === "translate3"
  ) {
    const args = value.arguments.map(compileSafeConfigExpression);
    if (
      args.length !== 2 ||
      args.some(
        (item): item is undefined => item === undefined,
      )
    ) {
      return undefined;
    }
    return {
      kind: "intrinsic",
      name: "translate3",
      args: args as SafeConfigExpression[],
    };
  }

  if (
    ts.isCallExpression(value) &&
    ts.isIdentifier(value.expression)
  ) {
    const args =
      value.arguments.map(
        compileSafeConfigExpression,
      );
    if (
      args.some(
        (item): item is undefined =>
          item === undefined,
      )
    ) {
      return undefined;
    }
    return {
      kind: "call",
      name: value.expression.text,
      args: args as SafeConfigExpression[],
    };
  }

  return undefined;
}

function rejectionReason(
  expression: ts.Expression,
): ScriptSafeConfigRejection["reason"] {
  if (ts.isCallExpression(expression)) {
    return "unsupported-call";
  }
  if (
    ts.isObjectLiteralExpression(expression) &&
    expression.properties.some(
      (property) =>
        !ts.isPropertyAssignment(property) ||
        propertyName(property.name) === undefined,
    )
  ) {
    return "unsupported-property";
  }
  return "unsupported-expression";
}

/**
 * Collect assignment syntax once for all top-level mutable bindings. The
 * original conservative name-only rule intentionally includes assignments
 * in nested scopes; this index changes only its cost, not its proof policy.
 */
function indexReassignmentSites(
  file: ts.SourceFile,
): ReadonlyMap<string, readonly ts.Node[]> {
  const byName = new Map<string, ts.Node[]>();
  const add = (name: string, node: ts.Node): void => {
    const sites = byName.get(name);
    if (sites) sites.push(node);
    else byName.set(name, [node]);
  };
  const visit = (node: ts.Node): void => {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment &&
      ts.isIdentifier(node.left)
    ) {
      add(node.left.text, node);
    }
    if (
      (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
      (node.operator === ts.SyntaxKind.PlusPlusToken ||
        node.operator === ts.SyntaxKind.MinusMinusToken) &&
      ts.isIdentifier(node.operand)
    ) {
      add(node.operand.text, node);
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(file, visit);
  return byName;
}

function identifierIsReassigned(
  reassignmentSites: ReadonlyMap<string, readonly ts.Node[]>,
  name: string,
  declaration: ts.VariableDeclaration,
): boolean {
  return (reassignmentSites.get(name) ?? []).some((site) => {
    // The previous full-AST walk skipped the current declaration *and its
    // initializer subtree*. Preserve that exact exclusion, including
    // assignment syntax nested inside an initializer function.
    let ancestor: ts.Node | undefined = site;
    while (ancestor) {
      if (ancestor === declaration) return false;
      ancestor = ancestor.parent;
    }
    return true;
  });
}

export function compileScriptSafeConfig(
  text: string,
  source: SourceRef,
): ScriptSafeConfigCompilation {
  const file = ts.createSourceFile(
    source.relativePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(source.relativePath),
  );

  const bindings: ScriptSafeConfigBinding[] = [];
  const functions: ScriptSafeConfigFunction[] = [];
  const imports: ScriptSafeConfigImport[] = [];
  const exports: ScriptSafeConfigExport[] = [];
  const reExports: ScriptSafeConfigReExport[] = [];
  const rejected: ScriptSafeConfigRejection[] = [];
  // Most files have no mutable top-level bindings; allocate the lookup only
  // on the first declaration that needs reassignment inspection.
  let reassignmentSites: ReadonlyMap<string, readonly ts.Node[]> | undefined;

  for (const statement of file.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteralLike(statement.moduleSpecifier) &&
      (
        statement.moduleSpecifier.text.startsWith(".") ||
        statement.moduleSpecifier.text.startsWith("/")
      )
    ) {
      const clause = statement.importClause;
      if (!clause || clause.isTypeOnly) {
        continue;
      }

      if (clause.name) {
        imports.push({
          module: statement.moduleSpecifier.text,
          importedName: "default",
          localName: clause.name.text,
          kind: "default",
          source: nodeSource(file, clause.name, source),
        });
      }

      const named = clause.namedBindings;
      if (named && ts.isNamedImports(named)) {
        for (const element of named.elements) {
          if (element.isTypeOnly) continue;
          imports.push({
            module: statement.moduleSpecifier.text,
            importedName:
              element.propertyName?.text ??
              element.name.text,
            localName: element.name.text,
            kind: "named",
            source: nodeSource(file, element, source),
          });
        }
      } else if (
        named &&
        ts.isNamespaceImport(named)
      ) {
        imports.push({
          module: statement.moduleSpecifier.text,
          importedName: "*",
          localName: named.name.text,
          kind: "namespace",
          source: nodeSource(file, named, source),
        });
      }
      continue;
    }

    if (
      ts.isExportDeclaration(statement)
    ) {
      const moduleSpecifier =
        statement.moduleSpecifier &&
        ts.isStringLiteralLike(
          statement.moduleSpecifier,
        )
          ? statement.moduleSpecifier.text
          : undefined;

      if (
        moduleSpecifier &&
        (
          moduleSpecifier.startsWith(".") ||
          moduleSpecifier.startsWith("/")
        )
      ) {
        if (
          statement.exportClause &&
          ts.isNamespaceExport(
            statement.exportClause,
          )
        ) {
          rejected.push({
            name:
              statement.exportClause.name.text,
            reason:
              "unsupported-expression",
            detail:
              "Namespace re-export is outside the bounded safe-config module subset.",
            source: nodeSource(
              file,
              statement.exportClause,
              source,
            ),
          });
          continue;
        }

        if (
          statement.exportClause &&
          ts.isNamedExports(
            statement.exportClause,
          )
        ) {
          for (
            const element of
              statement.exportClause.elements
          ) {
            reExports.push({
              module: moduleSpecifier,
              importedName:
                element.propertyName?.text ??
                element.name.text,
              exportedName:
                element.name.text,
              exportAll: false,
              source: nodeSource(
                file,
                element,
                source,
              ),
            });
          }
        } else if (
          statement.exportClause ===
          undefined
        ) {
          reExports.push({
            module: moduleSpecifier,
            exportAll: true,
            source: nodeSource(
              file,
              statement,
              source,
            ),
          });
        }
        continue;
      }

      if (
        !moduleSpecifier &&
        statement.exportClause &&
        ts.isNamedExports(
          statement.exportClause,
        )
      ) {
        for (
          const element of
            statement.exportClause.elements
        ) {
          exports.push({
            localName:
              element.propertyName?.text ??
              element.name.text,
            exportedName:
              element.name.text,
            source: nodeSource(
              file,
              element,
              source,
            ),
          });
        }
      }
      continue;
    }

    if (
      ts.isExportAssignment(statement) &&
      !statement.isExportEquals
    ) {
      const expression =
        compileSafeConfigExpression(
          statement.expression,
        );
      if (!expression) {
        rejected.push({
          name: "default",
          reason:
            rejectionReason(
              statement.expression,
            ),
          detail:
            "Default export is outside the deterministic safe-config subset and was not executed.",
          source: nodeSource(
            file,
            statement,
            source,
          ),
        });
        continue;
      }

      const defaultName =
        "$safeConfigDefault";
      const defaultSource =
        nodeSource(
          file,
          statement,
          source,
        );
      bindings.push({
        name: defaultName,
        expression,
        source: defaultSource,
      });
      exports.push({
        localName: defaultName,
        exportedName: "default",
        source: defaultSource,
      });
      continue;
    }

    if (
      ts.isFunctionDeclaration(statement) &&
      statement.name === undefined &&
      (
        statement.modifiers?.some(
          (modifier) =>
            modifier.kind ===
            ts.SyntaxKind.ExportKeyword,
        ) ?? false
      )
    ) {
      rejected.push({
        name: "default",
        reason:
          "unsupported-expression",
        detail:
          "Anonymous exported functions are not accepted by safe-config compilation; use a named pure helper.",
        source: nodeSource(
          file,
          statement,
          source,
        ),
      });
      continue;
    }

    if (
      ts.isFunctionDeclaration(statement) &&
      statement.name
    ) {
      const definition =
        compileSafeFunction(statement);
      if (definition) {
        const sourceRef =
          nodeSource(
            file,
            statement,
            source,
          );
        functions.push({
          name: statement.name.text,
          definition,
          source: sourceRef,
        });
        const exported =
          statement.modifiers?.some(
            (modifier) =>
              modifier.kind ===
              ts.SyntaxKind.ExportKeyword,
          ) ?? false;
        if (exported) {
          const isDefault =
            statement.modifiers?.some(
              (modifier) =>
                modifier.kind ===
                ts.SyntaxKind.DefaultKeyword,
            ) ?? false;
          exports.push({
            localName:
              statement.name.text,
            exportedName:
              isDefault
                ? "default"
                : statement.name.text,
            source: sourceRef,
          });
        }
      }
      continue;
    }

    if (!ts.isVariableStatement(statement)) continue;

    const isConst =
      (statement.declarationList.flags &
        ts.NodeFlags.Const) !== 0;

    for (const declaration of
      statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name)) {
        rejected.push({
          reason: "destructuring",
          detail:
            "Only identifier bindings are accepted by safe config compilation.",
          source: nodeSource(file, declaration, source),
        });
        continue;
      }

      const name = declaration.name.text;
      if (
        !isConst &&
        identifierIsReassigned(
          reassignmentSites ??= indexReassignmentSites(file),
          name,
          declaration,
        )
      ) {
        rejected.push({
          name,
          reason: "non-const",
          detail:
            "Mutable top-level let/var declarations are rejected. Bundler-lowered let/var is accepted only when no reassignment exists in the file.",
          source: nodeSource(file, declaration, source),
        });
        continue;
      }

      if (!declaration.initializer) continue;

      if (
        ts.isArrowFunction(
          declaration.initializer,
        ) ||
        ts.isFunctionExpression(
          declaration.initializer,
        )
      ) {
        const definition =
          compileSafeFunction(
            declaration.initializer,
          );
        if (!definition) {
          rejected.push({
            name,
            reason:
              "unsupported-expression",
            detail:
              "Pure safe-config helper must have identifier parameters and exactly one expression/return body.",
            source:
              nodeSource(
                file,
                declaration,
                source,
              ),
          });
          continue;
        }

        const functionSource =
          nodeSource(
            file,
            declaration,
            source,
          );
        functions.push({
          name,
          definition,
          source: functionSource,
        });
        const isExported =
          statement.modifiers?.some(
            (modifier) =>
              modifier.kind ===
              ts.SyntaxKind.ExportKeyword,
          ) ?? false;
        if (isExported) {
          exports.push({
            localName: name,
            exportedName: name,
            source: functionSource,
          });
        }
        continue;
      }

      const expression =
        compileSafeConfigExpression(declaration.initializer);
      if (!expression) {
        rejected.push({
          name,
          reason:
            rejectionReason(declaration.initializer),
          detail:
            "Initializer is outside the deterministic safe-config subset and was not executed.",
          source: nodeSource(file, declaration, source),
        });
        continue;
      }

      const bindingSource =
        nodeSource(file, declaration, source);
      bindings.push({
        name,
        expression,
        source: bindingSource,
      });

      const isExported =
        statement.modifiers?.some(
          (modifier) =>
            modifier.kind ===
            ts.SyntaxKind.ExportKeyword,
        ) ?? false;
      if (isExported) {
        exports.push({
          localName: name,
          exportedName: name,
          source: bindingSource,
        });
      }
    }
  }

  return {
    bindings: bindings.sort((a, b) =>
      a.name.localeCompare(b.name)
    ),
    functions: functions.sort((a, b) =>
      a.name.localeCompare(b.name)
    ),
    imports: imports.sort((a, b) =>
      a.module.localeCompare(b.module) ||
      a.localName.localeCompare(b.localName)
    ),
    exports: exports.sort((a, b) =>
      a.exportedName.localeCompare(b.exportedName) ||
      a.localName.localeCompare(b.localName)
    ),
    reExports: reExports.sort((a, b) =>
      a.module.localeCompare(b.module) ||
      (a.exportedName ?? "").localeCompare(
        b.exportedName ?? "",
      )
    ),
    rejected: rejected.sort((a, b) =>
      (a.name ?? "").localeCompare(b.name ?? "") ||
      (a.source.range?.lineStart ?? 0) -
        (b.source.range?.lineStart ?? 0)
    ),
  };
}
