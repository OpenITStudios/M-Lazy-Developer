import ts from "typescript";
import { sourceMethodRegion } from "../core/control-flow.js";
import type { SourceRef } from "../../../../packages/project-model/src/index.js";
import type { ScriptArgumentParameterBinding, ScriptImportedThisConstruction, ScriptConstructorFieldBinding, ScriptThisInstanceDispatch, ScriptSourceClassMethod, ScriptClassMapCollection, ScriptClassMapAccess } from "../core/types.js";

export interface ScriptModuleSourceInput {
  path: string;
  text: string;
  source: SourceRef;
}

export interface CrossFileCallEdge {
  callerModule: string;
  callerRegion: string;
  targetModule?: string;
  targetExport: string;
  /** Exact declared executable region; omitted for non-callable/ambiguous exports. */
  targetRegion?: string;
  localName: string;
  controlFlow: "unconditional" | "conditional" | "deferred";
  status: "resolved" | "unresolved";
  /** Direct or bounded immutable-const source forwarding, never instance proof. */
  argumentParameterBindings?: readonly ScriptArgumentParameterBinding[];
  source: SourceRef;
}

interface ExportTarget {
  modulePath: string;
  exportName: string;
}

interface ReExportBinding {
  exportedName: string;
  importedName: string;
  moduleSpecifier: string;
}

interface ParsedModuleExports {
  localExports: ReadonlyMap<string, string>;
  namedReExports: readonly ReExportBinding[];
  starReExports: readonly string[];
}

function normalizePath(value: string): string {
  const parts: string[] = [];
  for (const part of value.replaceAll("\\", "/").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return parts.join("/");
}

function dirname(value: string): string {
  const normalized = normalizePath(value);
  const index = normalized.lastIndexOf("/");
  return index < 0 ? "" : normalized.slice(0, index);
}

function resolveRelative(
  importer: string,
  specifier: string,
  known: ReadonlySet<string>,
): string | undefined {
  const base = normalizePath(
    [dirname(importer), specifier].filter(Boolean).join("/"),
  );
  const stem = base.replace(/\.(?:[cm]?[jt]sx?)$/i, "");
  // An exact authored target is authoritative. For TS transpiler .js
  // specifiers, use a fallback only if exactly one source candidate exists.
  // Never silently choose the first of multiple .ts/.js copies.
  if (known.has(base)) return base;
  const alternatives = [
    stem, stem + ".ts", stem + ".tsx", stem + ".js", stem + ".jsx",
    stem + "/index.ts", stem + "/index.tsx",
    stem + "/index.js", stem + "/index.jsx",
  ];
  const matches = [...new Set(alternatives.filter(candidate => known.has(candidate)))];
  return matches.length === 1 ? matches[0] : undefined;
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
  const start = file.getLineAndCharacterOfPosition(node.getStart(file));
  const end = file.getLineAndCharacterOfPosition(node.getEnd());
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

function region(node: ts.Node, file: ts.SourceFile): string {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isFunctionDeclaration(current) && current.name) {
      return "function:" + current.name.text;
    }
    if (ts.isMethodDeclaration(current)) {
      const name = current.name;
      if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) {
        return sourceMethodRegion(current, file);
      }
    }
    if (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) {
      const start = file.getLineAndCharacterOfPosition(current.getStart(file));
      return "callback@" + (start.line + 1) + ":" + (start.character + 1);
    }
    current = current.parent;
  }
  return "module";
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

function controlFlow(
  node: ts.Node,
): CrossFileCallEdge["controlFlow"] {
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

    if (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) {
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

    if (ts.isFunctionDeclaration(current) || ts.isMethodDeclaration(current)) {
      return "unconditional";
    }

    current = current.parent;
  }
  return "unconditional";
}

function hasModifier(
  node: ts.Node,
  kind: ts.SyntaxKind,
): boolean {
  return ts.canHaveModifiers(node) &&
    (ts.getModifiers(node)?.some(modifier => modifier.kind === kind) ?? false);
}

function moduleExports(
  file: ts.SourceFile,
): ParsedModuleExports {
  const localExports = new Map<string, string>();
  const namedReExports: ReExportBinding[] = [];
  const starReExports: string[] = [];

  for (const statement of file.statements) {
    if (ts.isExportDeclaration(statement)) {
      // Type-only exports do not create runtime module call edges.
      if (statement.isTypeOnly) continue;
      const moduleSpecifier =
        statement.moduleSpecifier &&
        ts.isStringLiteralLike(statement.moduleSpecifier)
          ? statement.moduleSpecifier.text
          : undefined;
      const clause = statement.exportClause;

      if (moduleSpecifier && clause && ts.isNamedExports(clause)) {
        for (const item of clause.elements) {
          if (item.isTypeOnly) continue;
          namedReExports.push({
            exportedName: item.name.text,
            importedName:
              item.propertyName?.text ?? item.name.text,
            moduleSpecifier,
          });
        }
        continue;
      }

      if (moduleSpecifier && !clause) {
        starReExports.push(moduleSpecifier);
        continue;
      }

      if (!moduleSpecifier && clause && ts.isNamedExports(clause)) {
        for (const item of clause.elements) {
          if (item.isTypeOnly) continue;
          localExports.set(
            item.name.text,
            item.propertyName?.text ?? item.name.text,
          );
        }
      }
      continue;
    }

    const exported =
      hasModifier(statement, ts.SyntaxKind.ExportKeyword);
    if (!exported) continue;

    const isDefault =
      hasModifier(statement, ts.SyntaxKind.DefaultKeyword);

    if (
      (ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement))
    ) {
      const localName =
        statement.name?.text ?? "default";
      if (isDefault) {
        localExports.set("default", localName);
      } else if (statement.name) {
        localExports.set(
          statement.name.text,
          statement.name.text,
        );
      }
      continue;
    }

    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) {
          localExports.set(
            declaration.name.text,
            declaration.name.text,
          );
        }
      }
    }
  }

  return {
    localExports,
    namedReExports,
    starReExports,
  };
}

interface CallableSource {
  region: string;
  parameters: ts.NodeArray<ts.ParameterDeclaration>;
  body: ts.Node;
}

/** Only unambiguous executable top-level exports own cross-file parameters. */
function callableSource(file: ts.SourceFile): ReadonlyMap<string, CallableSource> {
  const declarations = new Map<string, CallableSource[]>();
  const add = (name: string, candidate: CallableSource): void => {
    declarations.set(name, [...(declarations.get(name) ?? []), candidate]);
  };
  for (const statement of file.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name && statement.body) {
      add(statement.name.text, {
        region: "function:" + statement.name.text,
        parameters: statement.parameters, body: statement.body,
      });
    }
    if (ts.isVariableStatement(statement) &&
        (statement.declarationList.flags & ts.NodeFlags.Const)) {
      for (const declaration of statement.declarationList.declarations) {
        const fn = declaration.initializer;
        if (!ts.isIdentifier(declaration.name) || !fn ||
            !(ts.isFunctionExpression(fn) || ts.isArrowFunction(fn))) continue;
        const pos = file.getLineAndCharacterOfPosition(fn.getStart(file));
        add(declaration.name.text, {
          region: "callback@" + (pos.line + 1) + ":" + (pos.character + 1),
          parameters: fn.parameters, body: fn.body,
        });
      }
    }
  }
  return new Map([...declarations]
    .filter(([, versions]) => versions.length === 1)
    .map(([name, versions]) => [name, versions[0]!]));
}


interface TopLevelSourceClass {
  readonly name: string;
  readonly declaration: ts.ClassDeclaration | ts.ClassExpression;
  /** Cross-module ownership is not stable after a visible class rebinding. */
  readonly exported: boolean;
  readonly bindingStable: boolean;
  readonly overwrittenMembers: ReadonlySet<string>;
  readonly unknownMemberWrite: boolean;
}

/**
 * The same top-level class-owner inventory feeds static import targets,
 * Gameplay Intent class methods, and authored class Map storage.
 * A `var Name = class {}` is a declaration of Name, not a live instance.
 * Duplicated top-level bindings and shadowing declarations are not unique.
 */
function topLevelSourceClasses(file: ts.SourceFile): readonly TopLevelSourceClass[] {
  const bindings = new Map<string, number>();
  const candidates: { name: string; declaration: TopLevelSourceClass["declaration"] }[] = [];
  const add = (name: string): void => {
    bindings.set(name, (bindings.get(name) ?? 0) + 1);
  };
  for (const statement of file.statements) {
    if ((ts.isFunctionDeclaration(statement) ||
         ts.isClassDeclaration(statement)) && statement.name) {
      add(statement.name.text);
      if (ts.isClassDeclaration(statement)) {
        candidates.push({name: statement.name.text, declaration: statement});
      }
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) continue;
        const name = declaration.name.text;
        add(name);
        if (declaration.initializer && ts.isClassExpression(declaration.initializer)) {
          candidates.push({name, declaration: declaration.initializer});
        }
      }
    } else if (ts.isImportDeclaration(statement) && statement.importClause) {
      const clause = statement.importClause;
      if (clause.name) add(clause.name.text);
      if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
        add(clause.namedBindings.name.text);
      } else if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const named of clause.namedBindings.elements) add(named.name.text);
      }
    }
  }
  const exportedLocals = new Set(moduleExports(file).localExports.values());
  const rebound = new Set<string>();
  const overwritten = new Map<string, Set<string>>();
  const unknownMembers = new Set<string>();
  const overwrite = (name: string, member?: string): void => {
    if (member === undefined) {
      unknownMembers.add(name);
      return;
    }
    const names = overwritten.get(name) ?? new Set<string>();
    names.add(member);
    overwritten.set(name, names);
  };
  const markWrite = (node: ts.Node): void => {
    if (ts.isParenthesizedExpression(node)) {
      markWrite(node.expression);
    } else if (ts.isIdentifier(node)) {
      rebound.add(node.text);
    } else if (ts.isPropertyAccessExpression(node)) {
      if (ts.isIdentifier(node.expression)) {
        overwrite(node.expression.text, node.name.text);
      } else {
        markWrite(node.expression);
      }
    } else if (ts.isElementAccessExpression(node)) {
      if (ts.isIdentifier(node.expression)) {
        const key = node.argumentExpression;
        overwrite(node.expression.text,
          key && ts.isStringLiteralLike(key) ? key.text : undefined);
      } else {
        markWrite(node.expression);
      }
    } else if (ts.isObjectLiteralExpression(node)) {
      for (const prop of node.properties) {
        if (ts.isShorthandPropertyAssignment(prop)) rebound.add(prop.name.text);
        else if (ts.isPropertyAssignment(prop)) markWrite(prop.initializer);
        else if (ts.isSpreadAssignment(prop)) markWrite(prop.expression);
      }
    } else if (ts.isArrayLiteralExpression(node)) {
      for (const element of node.elements) {
        if (!ts.isOmittedExpression(element)) markWrite(element);
      }
    }
  };
  const visitWrites = (node: ts.Node): void => {
    if (ts.isBinaryExpression(node) &&
        node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
        node.operatorToken.kind <= ts.SyntaxKind.LastAssignment) {
      markWrite(node.left);
    } else if (ts.isDeleteExpression(node)) {
      markWrite(node.expression);
    } else if ((ts.isPrefixUnaryExpression(node) ||
                ts.isPostfixUnaryExpression(node)) &&
               (node.operator === ts.SyntaxKind.PlusPlusToken ||
                node.operator === ts.SyntaxKind.MinusMinusToken)) {
      markWrite(node.operand);
    } else if (ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        node.arguments[0] && ts.isIdentifier(node.arguments[0])) {
      const owner = node.arguments[0].text;
      const root = node.expression.expression.text;
      const method = node.expression.name.text;
      if ((root === "Object" && method === "assign") ||
          (root === "Reflect" && method === "set")) {
        overwrite(owner);
      } else if (root === "Object" && method === "defineProperty") {
        const key = node.arguments[1];
        overwrite(owner,
          key && ts.isStringLiteralLike(key) ? key.text : undefined);
      }
    }
    ts.forEachChild(node, visitWrites);
  };
  visitWrites(file);
  return candidates.filter(item => bindings.get(item.name) === 1)
    .map(item => {
      const bindingStable = !rebound.has(item.name);
      const unknownMemberWrite = unknownMembers.has(item.name);
      return {
        ...item,
        bindingStable,
        overwrittenMembers: overwritten.get(item.name) ?? new Set<string>(),
        unknownMemberWrite,
        exported: bindingStable && !unknownMemberWrite &&
          exportedLocals.has(item.name),
      };
    });
}

/**
 * Source-only imported class member ownership. Compiled Bedrock chunks often
 * declare `var Service = class { static method() {} }` and export the
 * variable later. These are callable bodies, not proof of initialization.
 *
 * Unique source-coordinate method regions distinguish same-named
 * declarations. Mutated class bindings and duplicate member declarations
 * remain unresolved rather than being joined through a guessed target.
 */
function staticClassCallables(file: ts.SourceFile): {
  readonly classNames: ReadonlySet<string>;
  readonly methods: ReadonlyMap<string, CallableSource>;
} {
  const sourceClasses = topLevelSourceClasses(file);

  const nameOf = (node: ts.PropertyName | undefined): string | undefined =>
    node && (ts.isIdentifier(node) || ts.isStringLiteralLike(node))
      ? node.text : undefined;

  const classes = new Set<string>();
  const methods = new Map<string, CallableSource>();
  for (const { name, declaration, bindingStable,
               overwrittenMembers, unknownMemberWrite } of sourceClasses) {
    classes.add(name);
    // Changing an unrelated static field does not replace every method.
    // Rebinding the class or an unknown computed static member still blocks
    // callable resolution; an explicit method replacement blocks that method.
    if (!bindingStable || unknownMemberWrite) continue;
    for (const member of declaration.members) {
      if (!ts.isMethodDeclaration(member) || !member.body ||
          !hasModifier(member, ts.SyntaxKind.StaticKeyword)) continue;
      const methodName = nameOf(member.name);
      if (!methodName || overwrittenMembers.has(methodName) ||
          declaration.members.filter(item => nameOf(item.name) === methodName).length !== 1)
        continue;
      methods.set(JSON.stringify([name, methodName]), {
        region: sourceMethodRegion(member, file),
        parameters: member.parameters,
        body: member.body,
      });
    }
  }
  return { classNames: classes, methods };
}

function enclosingCallable(node: ts.Node): CallableSource | undefined {
  let parent: ts.Node | undefined = node.parent;
  while (parent) {
    if (ts.isFunctionDeclaration(parent) && parent.body) {
      return { region: "", parameters: parent.parameters, body: parent.body };
    }
    if ((ts.isFunctionExpression(parent) || ts.isArrowFunction(parent) ||
         ts.isMethodDeclaration(parent) || ts.isGetAccessorDeclaration(parent) ||
         ts.isSetAccessorDeclaration(parent) || ts.isConstructorDeclaration(parent)) &&
        parent.body) {
      return { region: "", parameters: parent.parameters, body: parent.body };
    }
    parent = parent.parent;
  }
  return undefined;
}

function uniqueDirectParameter(
  callable: CallableSource, name: string,
): ts.ParameterDeclaration | undefined {
  const matches = callable.parameters.filter(parameter =>
    ts.isIdentifier(parameter.name) && parameter.name.text === name &&
    !parameter.dotDotDotToken && !parameter.initializer);
  return matches.length === 1 ? matches[0] : undefined;
}

/** Do not assert stable parameter forwarding across a possible reassignment,
 * destructuring target, loop assignment or lexical redeclaration.
 */
function parameterMayBeRebound(
  body: ts.Node, name: string, except?: ts.VariableDeclaration,
): boolean {
  let unstable = false;
  const isTarget = (node: ts.Node): boolean => {
    if (ts.isIdentifier(node)) return node.text === name;
    if (ts.isParenthesizedExpression(node)) return isTarget(node.expression);
    if (ts.isArrayLiteralExpression(node) || ts.isObjectLiteralExpression(node)) {
      let found = false;
      const scan = (candidate: ts.Node): void => {
        if (found) return;
        if (ts.isIdentifier(candidate) && candidate.text === name) {
          found = true;
          return;
        }
        ts.forEachChild(candidate, scan);
      };
      scan(node);
      return found;
    }
    return false;
  };
  const visit = (node: ts.Node): void => {
    if (unstable || node === except) return;
    if ((ts.isVariableDeclaration(node) || ts.isParameter(node)) &&
        ts.isIdentifier(node.name) && node.name.text === name) {
      unstable = true;
      return;
    }
    if (ts.isBinaryExpression(node) && isTarget(node.left) &&
        node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
        node.operatorToken.kind <= ts.SyntaxKind.LastAssignment) {
      unstable = true;
      return;
    }
    if ((ts.isForInStatement(node) || ts.isForOfStatement(node)) &&
        isTarget(node.initializer)) {
      unstable = true;
      return;
    }
    if ((ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
        isTarget(node.operand) &&
        (node.operator === ts.SyntaxKind.PlusPlusToken ||
         node.operator === ts.SyntaxKind.MinusMinusToken)) {
      unstable = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(body);
  return unstable;
}

/** The caller formal or same-body const chain must be visible at the call.
 * Nested block/loop/catch shadowing makes a spelling ambiguous.
 */
function shadowedAtCall(
  call: ts.CallExpression,
  body: ts.Node,
  name: string,
): boolean {
  const binds = (binding: ts.BindingName): boolean =>
    ts.isIdentifier(binding) ? binding.text === name :
    binding.elements.some(element =>
      ts.isBindingElement(element) && binds(element.name));
  let current: ts.Node = call;
  while (current !== body) {
    const parent = current.parent;
    if (!parent) return true;
    if (parent === body) return false;
    if (ts.isBlock(parent) && parent.statements.some(statement =>
      (ts.isVariableStatement(statement) &&
       statement.declarationList.declarations.some(decl => binds(decl.name))) ||
      (ts.isFunctionDeclaration(statement) && statement.name?.text === name))) {
      return true;
    }
    if (ts.isCatchClause(parent) && parent.variableDeclaration &&
        binds(parent.variableDeclaration.name)) return true;
    if ((ts.isForStatement(parent) || ts.isForOfStatement(parent) ||
         ts.isForInStatement(parent)) && parent.initializer &&
        ts.isVariableDeclarationList(parent.initializer) &&
        parent.initializer.declarations.some(decl => binds(decl.name))) {
      return true;
    }
    current = parent;
  }
  return false;
}

/** Only a direct parameter or a preceding, unique, stable const-id chain.
 * This is deliberately not general reaching definitions or JS object identity.
 */
function stableParameterOrigin(
  argument: ts.Expression,
  call: ts.CallExpression,
  caller: CallableSource,
  file: ts.SourceFile,
  source: SourceRef,
): { parameterName: string; aliases: { name: string; source: SourceRef }[] } | undefined {
  if (!ts.isIdentifier(argument)) return undefined;
  let name = argument.text;
  let preceding = argument.getStart(file);
  const aliases: { name: string; source: SourceRef }[] = [];
  const visited = new Set<string>();
  for (let depth = 0; depth < 8; depth += 1) {
    if (visited.has(name) || shadowedAtCall(call, caller.body, name)) {
      return undefined;
    }
    visited.add(name);
    if (uniqueDirectParameter(caller, name)) {
      if (parameterMayBeRebound(caller.body, name)) return undefined;
      return { parameterName: name, aliases: aliases.reverse() };
    }
    if (!ts.isBlock(caller.body)) return undefined;
    const declarations = caller.body.statements.flatMap<{ declaration: ts.VariableDeclaration | undefined; isConst: boolean }>(statement => {
      if (ts.isFunctionDeclaration(statement) && statement.name?.text === name) {
        return [{ declaration: undefined as ts.VariableDeclaration | undefined, isConst: false }];
      }
      if (!ts.isVariableStatement(statement)) return [];
      return statement.declarationList.declarations
        .filter(declaration =>
          ts.isIdentifier(declaration.name) && declaration.name.text === name)
        .map(declaration => ({
          declaration,
          isConst: !!(statement.declarationList.flags & ts.NodeFlags.Const),
        }));
    });
    if (declarations.length !== 1) return undefined;
    const item = declarations[0]!;
    const declaration = item.declaration;
    if (!item.isConst || !declaration ||
        declaration.getStart(file) >= preceding ||
        !declaration.initializer || !ts.isIdentifier(declaration.initializer) ||
        parameterMayBeRebound(caller.body, name, declaration)) return undefined;
    aliases.push({ name, source: nodeSource(file, declaration, source) });
    preceding = declaration.getStart(file);
    name = declaration.initializer.text;
  }
  return undefined;
}

/** Same source AST rule for a local call and a resolved ESM call.
 * A value-reference forwarding witness never proves an arena/player instance.
 */
export function inferExactCallArgumentParameterBindings(
  call: ts.CallExpression,
  callerFile: ts.SourceFile,
  callerSource: SourceRef,
  target: CallableSource,
  targetFile: ts.SourceFile,
  targetSource: SourceRef,
): readonly ScriptArgumentParameterBinding[] {
  const caller = enclosingCallable(call);
  if (!caller || call.arguments.length !== target.parameters.length) return [];
  const bindings: ScriptArgumentParameterBinding[] = [];
  for (let index = 0; index < call.arguments.length; index += 1) {
    const argument = call.arguments[index];
    const formal = target.parameters[index];
    if (!argument || !formal || !ts.isIdentifier(formal.name) ||
        formal.dotDotDotToken || formal.initializer ||
        !uniqueDirectParameter(target, formal.name.text) ||
        parameterMayBeRebound(target.body, formal.name.text)) continue;
    const origin = stableParameterOrigin(
      argument, call, caller, callerFile, callerSource);
    if (!origin) continue;
    bindings.push({
      index,
      argumentName: origin.parameterName,
      parameterName: formal.name.text,
      argumentSource: nodeSource(callerFile, argument, callerSource),
      parameterSource: nodeSource(targetFile, formal.name, targetSource),
      ...(origin.aliases.length ? { viaConstAliases: origin.aliases } : {}),
    });
  }
  return bindings;
}


function packScope(path: string): string | undefined {
  const segments = normalizePath(path).split("/");
  return segments.length > 1 &&
    (segments[0] === "behavior_packs" || segments[0] === "resource_packs")
    ? segments.slice(0, 2).join("/")
    : undefined;
}

function resolveExportTarget(
  modulePath: string,
  exportName: string,
  exportsByModule: ReadonlyMap<string, ParsedModuleExports>,
  knownPaths: ReadonlySet<string>,
  stack = new Set<string>(),
): ExportTarget | undefined {
  const key = modulePath + "#" + exportName;
  if (stack.has(key)) return undefined;

  const info = exportsByModule.get(modulePath);
  if (!info) return undefined;

  const localTarget =
    info.localExports.get(exportName);
  if (localTarget !== undefined) {
    return {
      modulePath,
      exportName: localTarget,
    };
  }

  const nextStack = new Set(stack);
  nextStack.add(key);

  const namedMatches = info.namedReExports.filter(
    (item) => item.exportedName === exportName,
  );
  // A conflicting barrel export must not resolve by declaration order.
  if (namedMatches.length > 1) return undefined;
  const named = namedMatches[0];
  if (named) {
    const targetModule = resolveRelative(
      modulePath,
      named.moduleSpecifier,
      knownPaths,
    );
    if (!targetModule) return undefined;
    return resolveExportTarget(
      targetModule,
      named.importedName,
      exportsByModule,
      knownPaths,
      nextStack,
    );
  }

  const starTargets = info.starReExports.flatMap((specifier) => {
    const targetModule = resolveRelative(
      modulePath,
      specifier,
      knownPaths,
    );
    if (!targetModule) return [];
    const resolved = resolveExportTarget(
      targetModule,
      exportName,
      exportsByModule,
      knownPaths,
      nextStack,
    );
    return resolved ? [resolved] : [];
  });

  const unique = new Map(
    starTargets.map((item) => [
      item.modulePath + "#" + item.exportName,
      item,
    ]),
  );

  return unique.size === 1
    ? [...unique.values()][0]
    : undefined;
}

export function deriveCrossFileCallEdges(
  modules: readonly ScriptModuleSourceInput[],
): CrossFileCallEdge[] {
  // Do not let a duplicate path from another source silently replace an
  // authoritative selected-artifact module.
  const counts = new Map<string, number>();
  for (const module of modules) {
    const normalized = normalizePath(module.path);
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  const normalizedModules = new Map(modules
    .filter(module => counts.get(normalizePath(module.path)) === 1)
    .map(module => [normalizePath(module.path), module]));
  const known = new Set(normalizedModules.keys());
  const parsedFiles = new Map<string, ts.SourceFile>();
  const exportsByModule =
    new Map<string, ParsedModuleExports>();
  const callableByModule = new Map<string, ReadonlyMap<string, CallableSource>>();
  const classCallablesByModule = new Map<string, ReturnType<typeof staticClassCallables>>();

  for (const [path, module] of normalizedModules) {
    const file = ts.createSourceFile(
      path,
      module.text,
      ts.ScriptTarget.Latest,
      true,
      scriptKind(path),
    );
    parsedFiles.set(path, file);
    exportsByModule.set(path, moduleExports(file));
    callableByModule.set(path, callableSource(file));
    classCallablesByModule.set(path, staticClassCallables(file));
  }

  const output: CrossFileCallEdge[] = [];

  for (const [modulePath, module] of normalizedModules) {
    const file = parsedFiles.get(modulePath)!;
    const directImports = new Map<string, {
      moduleSpecifier: string;
      importedName: string;
    }>();
    const namespaceImports = new Map<string, string>();

    const bindsName = (binding: ts.BindingName, name: string): boolean =>
      ts.isIdentifier(binding) ? binding.text === name :
      binding.elements.some(element =>
        ts.isBindingElement(element) && bindsName(element.name, name));
    const isShadowed = (use: ts.Identifier): boolean => {
      let current: ts.Node | undefined = use.parent;
      while (current && current !== file) {
        if (ts.isFunctionLike(current) && current.parameters.some(parameter =>
            bindsName(parameter.name, use.text))) return true;
        if (ts.isCatchClause(current) && current.variableDeclaration &&
            bindsName(current.variableDeclaration.name, use.text)) return true;
        if ((ts.isForStatement(current) || ts.isForInStatement(current) ||
            ts.isForOfStatement(current)) && current.initializer &&
            ts.isVariableDeclarationList(current.initializer) &&
            current.initializer.declarations.some(declaration =>
              bindsName(declaration.name, use.text))) return true;
        if (ts.isBlock(current) &&
            current.statements.some(statement =>
              (ts.isVariableStatement(statement) &&
                statement.declarationList.declarations.some(declaration =>
                  bindsName(declaration.name, use.text))) ||
              (ts.isFunctionDeclaration(statement) &&
                statement.name?.text === use.text))) return true;
        current = current.parent;
      }
      return false;
    };

    for (const statement of file.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteralLike(statement.moduleSpecifier) ||
        !statement.moduleSpecifier.text.startsWith(".")
      ) {
        continue;
      }

      const moduleSpecifier =
        statement.moduleSpecifier.text;
      const clause = statement.importClause;

      if (clause?.name && !clause.isTypeOnly) {
        directImports.set(clause.name.text, {
          moduleSpecifier,
          importedName: "default",
        });
      }

      const named = clause?.namedBindings;
      if (named && ts.isNamedImports(named)) {
        for (const element of named.elements) {
          if (clause?.isTypeOnly || element.isTypeOnly) continue;
          directImports.set(element.name.text, {
            moduleSpecifier,
            importedName:
              element.propertyName?.text ??
              element.name.text,
          });
        }
      } else if (named && !clause?.isTypeOnly && ts.isNamespaceImport(named)) {
        namespaceImports.set(
          named.name.text,
          moduleSpecifier,
        );
      }
    }

    const appendEdge = (
      node: ts.CallExpression,
      imported: {
        moduleSpecifier: string;
        importedName: string;
        localName: string;
      },
      staticMethodName?: string,
    ): void => {
      const importedModule = resolveRelative(
        modulePath,
        imported.moduleSpecifier,
        known,
      );
      const target =
        importedModule === undefined
          ? undefined
          : resolveExportTarget(
              importedModule,
              imported.importedName,
              exportsByModule,
              known,
            );
      const targetSource = target === undefined
        ? undefined : normalizedModules.get(target.modulePath)?.source;
      const sameOwner = targetSource !== undefined &&
        targetSource.artifactId === module.source.artifactId &&
        packScope(modulePath) === packScope(target!.modulePath);
      const targetCallable = sameOwner && target
        ? staticMethodName === undefined
          ? callableByModule.get(target.modulePath)?.get(target.exportName)
          : classCallablesByModule.get(target.modulePath)?.methods.get(
              JSON.stringify([target.exportName, staticMethodName]))
        : undefined;
      const targetRegion = targetCallable?.region;
      const targetFile = target === undefined
        ? undefined : parsedFiles.get(target.modulePath);
      const argumentParameterBindings = targetCallable && targetFile && targetSource
        ? inferExactCallArgumentParameterBindings(
            node, file, { ...module.source, relativePath: modulePath },
            targetCallable, targetFile,
            { ...targetSource, relativePath: target!.modulePath },
          )
        : [];

      output.push({
        callerModule: modulePath,
        callerRegion: region(node, file),
        ...(target
          ? { targetModule: target.modulePath }
          : importedModule
            ? { targetModule: importedModule }
            : {}),
        targetExport:
          target?.exportName ??
          imported.importedName,
        ...(targetRegion === undefined ? {} : { targetRegion }),
        ...(argumentParameterBindings.length ? { argumentParameterBindings } : {}),
        localName: imported.localName,
        controlFlow: controlFlow(node),
        status: targetRegion ? "resolved" : "unresolved",
        source: nodeSource(file, node, {
          ...module.source,
          relativePath: modulePath,
        }),
      });
    };

    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node)) {
        if (ts.isIdentifier(node.expression)) {
          const imported =
            directImports.get(node.expression.text);
          if (imported && !isShadowed(node.expression)) {
            appendEdge(node, {
              ...imported,
              localName: node.expression.text,
            });
          }
        } else if (
          ts.isPropertyAccessExpression(node.expression) &&
          ts.isIdentifier(node.expression.expression)
        ) {
          const namespace =
            node.expression.expression.text;
          const moduleSpecifier =
            namespaceImports.get(namespace);
          if (moduleSpecifier && !isShadowed(node.expression.expression)) {
            appendEdge(node, {
              moduleSpecifier,
              importedName:
                node.expression.name.text,
              localName:
                namespace +
                "." +
                node.expression.name.text,
            });
          } else {
            const imported = directImports.get(namespace);
            if (imported && !isShadowed(node.expression.expression)) {
              const importedModule = resolveRelative(
                modulePath, imported.moduleSpecifier, known);
              const target = importedModule === undefined ? undefined
                : resolveExportTarget(
                    importedModule, imported.importedName, exportsByModule, known);
              // A member call on an imported function/object is not
              // evidence of a class static method.
              const targetModule = target === undefined
                ? undefined : normalizedModules.get(target.modulePath);
              if (target && targetModule &&
                  targetModule.source.artifactId === module.source.artifactId &&
                  packScope(target.modulePath) === packScope(modulePath) &&
                  classCallablesByModule.get(target.modulePath)?.classNames.has(
                    target.exportName)) {
                appendEdge(node, {
                  ...imported,
                  localName: namespace + "." + node.expression.name.text,
                }, node.expression.name.text);
              }
            }
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(file);
  }

  return output.sort((a, b) =>
    a.callerModule.localeCompare(b.callerModule) ||
    a.callerRegion.localeCompare(b.callerRegion) ||
    a.localName.localeCompare(b.localName)
  );
}


/** Bounded source-side constructor/receiver handoffs, not runtime identity.
 * These direct AST facts are reused by Gameplay Intent's exact source binding.
 */
export function extractScriptClassWiring(
  file: ts.SourceFile, owner: SourceRef,
): {
  readonly importedThisConstructions: readonly ScriptImportedThisConstruction[];
  readonly constructorFieldBindings: readonly ScriptConstructorFieldBinding[];
  readonly thisInstanceDispatches: readonly ScriptThisInstanceDispatch[];
  readonly sourceClassMethods: readonly ScriptSourceClassMethod[];
  /** Immutable source-unique local static targets, keyed by [class, method].
   * Derived in the existing class inventory pass, never a second graph.
   */
  readonly localStaticCallables: ReadonlyMap<string, CallableSource>;
} {
  const localStaticCallables = new Map<string, CallableSource>();
  const constructors: ScriptImportedThisConstruction[] = [];
  const fields: ScriptConstructorFieldBinding[] = [];
  const forwards: ScriptThisInstanceDispatch[] = [];
  const methods: ScriptSourceClassMethod[] = [];
  const imports = new Map<string, { module: string; importedName: string }[]>();
  for (const declaration of file.statements) {
    if (!ts.isImportDeclaration(declaration) ||
        !ts.isStringLiteralLike(declaration.moduleSpecifier) ||
        !declaration.moduleSpecifier.text.startsWith(".") ||
        declaration.importClause?.isTypeOnly) continue;
    const bindings = declaration.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const symbol of bindings.elements) {
      if (symbol.isTypeOnly) continue;
      const local = symbol.name.text;
      imports.set(local, [...(imports.get(local) ?? []), {
        module: declaration.moduleSpecifier.text,
        importedName: symbol.propertyName?.text ?? local,
      }]);
    }
  }
  for (const { name: className, declaration: cls, exported, bindingStable,
               overwrittenMembers, unknownMemberWrite } of topLevelSourceClasses(file)) {
    const methodList = cls.members.filter(
      (member): member is ts.MethodDeclaration =>
        ts.isMethodDeclaration(member) &&
        (ts.isIdentifier(member.name) || ts.isStringLiteralLike(member.name)) &&
        member.body !== undefined);
    const methodCount = new Map<string,number>();
    for (const method of methodList) {
      const name = (method.name as ts.Identifier | ts.StringLiteral).text;
      methodCount.set(name, (methodCount.get(name) ?? 0) + 1);
    }
    for (const method of methodList) {
      const methodName = (method.name as ts.Identifier | ts.StringLiteral).text;
      if (methodCount.get(methodName) !== 1) continue;
      // Bundled esbuild chunks declare same-file helpers as
      // "var Service = class { static read() {} }". Reuse the uniquely bound
      // class inventory rather than treating Service.read() as an opaque API.
      // A changed class binding or replaced method must not create an edge.
      if (bindingStable && !unknownMemberWrite &&
          !overwrittenMembers.has(methodName) &&
          hasModifier(method, ts.SyntaxKind.StaticKeyword) &&
          cls.members.filter(member =>
            ts.isMethodDeclaration(member) &&
            (ts.isIdentifier(member.name) || ts.isStringLiteralLike(member.name)) &&
            member.name.text === methodName).length === 1) {
        localStaticCallables.set(JSON.stringify([className, methodName]), {
          region: sourceMethodRegion(method, file),
          parameters: method.parameters,
          body: method.body!,
        });
      }
      const params = method.parameters.map(p =>
        ts.isIdentifier(p.name) ? p.name.text : null);
      const stable = params.flatMap((name,index) => {
        if (name === null) return [];
        let mutated = false;
        const visit = (node:ts.Node):void => {
          if (mutated) return;
          if (ts.isBinaryExpression(node) && ts.isIdentifier(node.left) &&
              node.left.text === name &&
              node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
              node.operatorToken.kind <= ts.SyntaxKind.LastAssignment) {
            mutated = true;
          }
          if ((ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
              ts.isIdentifier(node.operand) && node.operand.text === name &&
              (node.operator === ts.SyntaxKind.PlusPlusToken ||
               node.operator === ts.SyntaxKind.MinusMinusToken)) mutated = true;
          if (ts.isVariableDeclaration(node) &&
              ts.isIdentifier(node.name) && node.name.text === name) mutated = true;
          ts.forEachChild(node,visit);
        };
        if (method.body) visit(method.body);
        return mutated ? [] : [index];
      });
      methods.push({
        className, methodName, parameterNames: params,
        stableParameterIndices:stable,
        exported: exported && !overwrittenMembers.has(methodName),
        source:nodeSource(file,method,owner),
      });
    }
    const constructorDeclarations = cls.members.filter(ts.isConstructorDeclaration);
    if (constructorDeclarations.length === 1) {
      const ctor = constructorDeclarations[0]!;
      const params = ctor.parameters.map(p =>
        ts.isIdentifier(p.name) && !p.dotDotDotToken && !p.initializer
          ? p.name.text : undefined);
      // A constructor argument that is reassigned before the field write
      // does not preserve the imported instance. Conservatively reject any
      // authored rebind of the formal anywhere in this constructor.
      const reboundParameters = new Set<string>();
      if (ctor.body) {
        const scan = (node: ts.Node): void => {
          if (ts.isBinaryExpression(node) &&
              ts.isIdentifier(node.left) &&
              node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
              node.operatorToken.kind <= ts.SyntaxKind.LastAssignment) {
            reboundParameters.add(node.left.text);
          }
          if ((ts.isPrefixUnaryExpression(node) ||
               ts.isPostfixUnaryExpression(node)) &&
              ts.isIdentifier(node.operand) &&
              (node.operator === ts.SyntaxKind.PlusPlusToken ||
               node.operator === ts.SyntaxKind.MinusMinusToken)) {
            reboundParameters.add(node.operand.text);
          }
          if (ts.isVariableDeclaration(node) &&
              ts.isIdentifier(node.name)) {
            reboundParameters.add(node.name.text);
          }
          ts.forEachChild(node,scan);
        };
        scan(ctor.body);
      }
      const seen = new Map<string, {index:number;node:ts.Node}[]>();
      if (ctor.body) {
        const visit = (node:ts.Node):void => {
          if (ts.isBinaryExpression(node) &&
              node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
              ts.isPropertyAccessExpression(node.left) &&
              node.left.expression.kind === ts.SyntaxKind.ThisKeyword) {
            const field = node.left.name.text;
            const index = ts.isIdentifier(node.right)
              ? params.indexOf(node.right.text) : -1;
            const entries = seen.get(field) ?? [];
            entries.push({index,node});
            seen.set(field,entries);
          }
          ts.forEachChild(node,visit);
        };
        visit(ctor.body);
      }
      // Reject reassignments to this.field outside the constructor too.
      const laterWrites = new Set<string>();
      let dynamicFieldWrite = false;
      for (const method of methodList) {
        if (!method.body) continue;
        const visit=(node:ts.Node):void => {
          if (ts.isBinaryExpression(node) &&
              node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
              node.operatorToken.kind <= ts.SyntaxKind.LastAssignment) {
            if (ts.isPropertyAccessExpression(node.left) &&
                node.left.expression.kind === ts.SyntaxKind.ThisKeyword)
              laterWrites.add(node.left.name.text);
            if (ts.isElementAccessExpression(node.left) &&
                node.left.expression.kind === ts.SyntaxKind.ThisKeyword) {
              const key=node.left.argumentExpression;
              if (key && ts.isStringLiteralLike(key))
                laterWrites.add(key.text);
              else dynamicFieldWrite = true;
            }
          }
          ts.forEachChild(node,visit);
        };
        visit(method.body);
      }
      for (const [field, entries] of seen) {
        if (entries.length !== 1 || entries[0]!.index < 0 ||
            dynamicFieldWrite || laterWrites.has(field) ||
            reboundParameters.has(params[entries[0]!.index]!)) continue;
        fields.push({
          source:nodeSource(file,entries[0]!.node,owner),
          className,fieldName:field,parameterIndex:entries[0]!.index,
        });
      }
    }

    const shadowedNames = new Map<ts.Node,Set<string>>();
    const lexicalShadow = (
      member:ts.ConstructorDeclaration | ts.MethodDeclaration,
      name:string,
    ):boolean => {
      let names=shadowedNames.get(member);
      if (!names) {
        names=new Set<string>();
        for (const param of member.parameters)
          if (ts.isIdentifier(param.name)) names.add(param.name.text);
        const walkBinding=(node:ts.Node):void => {
          if ((ts.isVariableDeclaration(node) ||
               ts.isFunctionDeclaration(node) ||
               ts.isClassDeclaration(node)) &&
              node.name && ts.isIdentifier(node.name))
            names!.add(node.name.text);
          ts.forEachChild(node,walkBinding);
        };
        if(member.body) walkBinding(member.body);
        shadowedNames.set(member,names);
      }
      return names.has(name);
    };
    const conflictingTopLevel = new Set<string>();
    for (const statement of file.statements) {
      if ((ts.isFunctionDeclaration(statement) ||
           ts.isClassDeclaration(statement)) && statement.name) {
        conflictingTopLevel.add(statement.name.text);
      } else if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name))
            conflictingTopLevel.add(declaration.name.text);
        }
      }
    }
    const walk=(node:ts.Node,member:ts.ConstructorDeclaration | ts.MethodDeclaration):void => {
      // A nested ordinary function/class binds its own 'this'. Arrow
      // callbacks inherit the enclosing class instance and are admissible.
      if (node !== member &&
          (ts.isFunctionDeclaration(node) ||
           ts.isFunctionExpression(node) ||
           ts.isMethodDeclaration(node) ||
           ts.isConstructorDeclaration(node) ||
           ts.isClassDeclaration(node) ||
           ts.isClassExpression(node))) return;
      if (ts.isNewExpression(node) && ts.isIdentifier(node.expression)) {
        const importedLocal = node.expression.text;
        const binding = imports.get(importedLocal);
        if (binding?.length === 1 &&
            !conflictingTopLevel.has(importedLocal) &&
            !lexicalShadow(member,importedLocal)) {
          for (let index = 0; index < (node.arguments?.length ?? 0); index++) {
            if (node.arguments![index]!.kind !== ts.SyntaxKind.ThisKeyword)
              continue;
            constructors.push({
              source:nodeSource(file,node,owner),
              ownerClass:className,
              module:binding[0]!.module,
              importedName:binding[0]!.importedName,
              thisArgumentIndex:index,
            });
          }
        }
      }
      if (ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          ts.isPropertyAccessExpression(node.expression.expression) &&
          node.expression.expression.expression.kind === ts.SyntaxKind.ThisKeyword) {
        const fieldName = node.expression.expression.name.text;
        const methodName = node.expression.name.text;
        node.arguments.forEach((arg,index) => {
          if (arg.kind !== ts.SyntaxKind.ThisKeyword) return;
          forwards.push({
            source:nodeSource(file,node,owner),
            className,fieldName,methodName,thisArgumentIndex:index,
          });
        });
      }
      ts.forEachChild(node,child=>walk(child,member));
    };
    for (const member of cls.members) {
      if (ts.isMethodDeclaration(member) || ts.isConstructorDeclaration(member))
        walk(member,member);
    }
  }
  return {
    importedThisConstructions:constructors,
    constructorFieldBindings:fields,
    thisInstanceDispatches:forwards,
    sourceClassMethods:methods,
    localStaticCallables,
  };
}


/**
 * Exact source Map field storage. Do not connect differently authored key
 * expressions or promote a retrieved value into a runtime-owned session.
 * This is a data-ownership view in the existing script parser.
 */
export function extractScriptClassMapSites(file: ts.SourceFile, owner: SourceRef): {
  readonly sourceClassMaps: readonly ScriptClassMapCollection[];
  readonly sourceClassMapAccesses: readonly ScriptClassMapAccess[];
} {
  const collections: ScriptClassMapCollection[] = [];
  const accesses: ScriptClassMapAccess[] = [];
  // A local declaration of Map removes certainty about the global native Map.
  const shadowedMap = file.statements.some(statement =>
    ((ts.isClassDeclaration(statement) ||
      ts.isFunctionDeclaration(statement)) && statement.name?.text === "Map") ||
    (ts.isVariableStatement(statement) &&
      statement.declarationList.declarations.some(decl =>
        ts.isIdentifier(decl.name) && decl.name.text === "Map")));
  if (shadowedMap) return {sourceClassMaps:[],sourceClassMapAccesses:[]};

  for (const { name: className, declaration: cls } of
    topLevelSourceClasses(file)) {
    const ctor = cls.members.filter(ts.isConstructorDeclaration);
    if (ctor.length !== 1 || !ctor[0]!.body) continue;
    if (ctor[0]!.parameters.some(p =>
      ts.isIdentifier(p.name) && p.name.text === "Map")) continue;
    let mapShadowedWithinConstructor=false;
    const lookForShadow=(node:ts.Node):void=>{
      if ((ts.isVariableDeclaration(node) ||
           ts.isFunctionDeclaration(node) ||
           ts.isClassDeclaration(node)) &&
          node.name && ts.isIdentifier(node.name) &&
          node.name.text==="Map")mapShadowedWithinConstructor=true;
      ts.forEachChild(node,lookForShadow);
    };
    lookForShadow(ctor[0]!.body);
    if(mapShadowedWithinConstructor)continue;
    const declared = new Map<string,{source:SourceRef;count:number}>();
    const writes = new Map<string,number>();
    let unknownComputedWrite = false;
    const visitWrite=(node:ts.Node):void => {
      if (ts.isBinaryExpression(node) &&
          node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
          node.operatorToken.kind <= ts.SyntaxKind.LastAssignment) {
        if (ts.isPropertyAccessExpression(node.left) &&
            node.left.expression.kind === ts.SyntaxKind.ThisKeyword) {
          const key = node.left.name.text;
          writes.set(key,(writes.get(key) ?? 0)+1);
          if (node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
              ts.isNewExpression(node.right) &&
              ts.isIdentifier(node.right.expression) &&
              node.right.expression.text === "Map" &&
              (node.right.arguments?.length ?? 0) === 0 &&
              node.getStart(file) >= ctor[0]!.getStart(file) &&
              node.getEnd() <= ctor[0]!.getEnd()) {
            const prev = declared.get(key);
            declared.set(key,{source:nodeSource(file,node,owner),
              count:(prev?.count ?? 0)+1});
          }
        } else if(ts.isElementAccessExpression(node.left) &&
            node.left.expression.kind === ts.SyntaxKind.ThisKeyword) {
          if (ts.isStringLiteralLike(node.left.argumentExpression)) {
            const key=node.left.argumentExpression.text;
            writes.set(key,(writes.get(key) ?? 0)+1);
          } else unknownComputedWrite=true;
        }
      }
      ts.forEachChild(node,visitWrite);
    };
    for (const member of cls.members) visitWrite(member);
    if (unknownComputedWrite) continue;
    const confirmed = new Set<string>();
    for (const [key,decl] of declared) {
      if(decl.count!==1 || writes.get(key)!==1)continue;
      confirmed.add(key);
      collections.push({source:decl.source,
        className:className,fieldName:key});
    }
    if(confirmed.size===0)continue;
    const methods=cls.members.filter((m):m is ts.MethodDeclaration=>
      ts.isMethodDeclaration(m) && m.body !== undefined &&
      (ts.isIdentifier(m.name) || ts.isStringLiteralLike(m.name)));
    const counts = new Map<string,number>();
    for(const m of methods) {
      const name=(m.name as ts.Identifier|ts.StringLiteral).text;
      counts.set(name,(counts.get(name) ?? 0)+1);
    }
    for(const method of methods) {
      const methodName=(method.name as ts.Identifier|ts.StringLiteral).text;
      if(counts.get(methodName)!==1)continue;
      const visit=(node:ts.Node):void => {
        if (node !== method &&
            (ts.isFunctionDeclaration(node) ||
             ts.isFunctionExpression(node) ||
             ts.isMethodDeclaration(node) ||
             ts.isClassDeclaration(node) ||
             ts.isClassExpression(node))) return;
        if (ts.isCallExpression(node) &&
            ts.isPropertyAccessExpression(node.expression) &&
            ts.isPropertyAccessExpression(node.expression.expression) &&
            node.expression.expression.expression.kind === ts.SyntaxKind.ThisKeyword) {
          const field=node.expression.expression.name.text;
          const operation=node.expression.name.text;
          if(confirmed.has(field) &&
              (operation==="set" || operation==="get" ||
               operation==="has" || operation==="delete") &&
              node.arguments.length >= (operation==="set" ? 2 : 1)) {
            const keyExpr=node.arguments[0]!.getText(file).slice(0,200);
            const value=operation==="set" ? node.arguments[1] : undefined;
            let constructorName:string|undefined;
            let constructorSource:SourceRef|undefined;
            // Same lexical block immutable initialization, preceding the set.
            if(value && ts.isIdentifier(value)) {
              const valueName = value.text;
              let block:ts.Block|undefined;
              for(let current:ts.Node|undefined=node.parent;current;current=current.parent){
                if(ts.isBlock(current)){block=current;break;}
                if(current===method)break;
              }
              if(block){
                const candidates=block.statements.filter(ts.isVariableStatement)
                  .flatMap(statement=>statement.declarationList.declarations
                    .filter(decl=>ts.isIdentifier(decl.name) &&
                      decl.name.text===valueName &&
                      !!(statement.declarationList.flags & ts.NodeFlags.Const) &&
                      decl.getStart(file)<node.getStart(file)));
                const initializer=candidates[0]?.initializer;
                if(candidates.length===1 && initializer &&
                    ts.isNewExpression(initializer) &&
                    ts.isIdentifier(initializer.expression)) {
                  const ctorExpr=initializer;
                  // Assignment to the identifier would invalidate the source
                  // reference. Exclude even late writes conservatively.
                  let mutated=false;
                  const check=(n:ts.Node):void=>{
                    if (ts.isBinaryExpression(n) && ts.isIdentifier(n.left) &&
                        n.left.text===valueName &&
                        n.operatorToken.kind>=ts.SyntaxKind.FirstAssignment &&
                        n.operatorToken.kind<=ts.SyntaxKind.LastAssignment)mutated=true;
                    ts.forEachChild(n,check);
                  };
                  check(block);
                  if(!mutated) {
                    constructorName=ts.isIdentifier(ctorExpr.expression) ? ctorExpr.expression.text : undefined;
                    constructorSource=nodeSource(file,ctorExpr,owner);
                  }
                }
              }
            }
            accesses.push({
              source:nodeSource(file,node,owner),
              className:className,
              executionRegion:sourceMethodRegion(method, file),
              fieldName:field,operation,keyExpression:keyExpr,
              ...(value===undefined?{}:{valueExpression:value.getText(file).slice(0,200)}),
              ...(constructorName===undefined?{}:{constructorName}),
              ...(constructorSource===undefined?{}:{constructorSource}),
            });
          }
        }
        ts.forEachChild(node,visit);
      };
      visit(method);
    }
  }
  return {
    sourceClassMaps:collections.sort((a,b)=>
      a.source.relativePath.localeCompare(b.source.relativePath) ||
      (a.source.range?.lineStart??0)-(b.source.range?.lineStart??0)),
    sourceClassMapAccesses:accesses.sort((a,b)=>
      a.source.relativePath.localeCompare(b.source.relativePath) ||
      (a.source.range?.lineStart??0)-(b.source.range?.lineStart??0) ||
      (a.source.range?.columnStart??0)-(b.source.range?.columnStart??0)),
  };
}
