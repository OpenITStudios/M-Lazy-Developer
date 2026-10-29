import ts from "typescript";
import { sourceMethodRegion } from "../core/control-flow.js";
import type { SourceRef } from "../../../../packages/project-model/src/index.js";
import type {
  ScriptLiteralTranslationReference,
  ScriptMethodCall,
} from "../core/types.js";

type Forwarded = NonNullable<ScriptLiteralTranslationReference["forwardedUiSendCall"]>;
type Hop = Forwarded["hops"][number];
type Target = Omit<Forwarded, "hops">;

const MAX_CONST_HOPS = 4;
const MAX_TOTAL_HOPS = 5;

/**
 * Trace a literal through a small, unambiguous subset of JavaScript source.
 * Existing receiver inference remains the only Script API authority.
 * This adapter is NOT an interpreter, player-delivery observation,
 * helper execution guarantee, or gameplay design inference.
 */
export function createBoundedLiteralUiFlowResolver(
  file: ts.SourceFile,
  methodCalls: readonly ScriptMethodCall[],
  site: (node: ts.Node) => SourceRef,
  region: (node: ts.Node) => string,
): (property: ts.PropertyAssignment) => Forwarded | undefined {
  const identifiers = new Map<string, ts.Identifier[]>();
  const helpers = new Map<string, ts.FunctionDeclaration[]>();
  const isValueIdentifier = (node: ts.Identifier): boolean => {
    const parent = node.parent;
    return !(ts.isPropertyAccessExpression(parent) && parent.name === node) &&
      !(ts.isPropertyAssignment(parent) && parent.name === node) &&
      !(ts.isMethodDeclaration(parent) && parent.name === node) &&
      !(ts.isPropertySignature(parent) && parent.name === node);
  };
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && isValueIdentifier(node)) {
      const refs = identifiers.get(node.text) ?? [];
      refs.push(node);
      identifiers.set(node.text, refs);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  for (const statement of file.statements) {
    if (!ts.isFunctionDeclaration(statement) || !statement.name) continue;
    const matches = helpers.get(statement.name.text) ?? [];
    matches.push(statement);
    helpers.set(statement.name.text, matches);
  }

  const sameSite = (a: SourceRef, b: SourceRef): boolean =>
    a.artifactId === b.artifactId &&
    a.relativePath === b.relativePath &&
    a.jsonPointer === b.jsonPointer &&
    a.range?.lineStart !== undefined && b.range?.lineStart !== undefined &&
    a.range.lineEnd !== undefined && b.range.lineEnd !== undefined &&
    a.range.columnStart !== undefined && b.range.columnStart !== undefined &&
    a.range.columnEnd !== undefined && b.range.columnEnd !== undefined &&
    a.range.lineStart === b.range.lineStart &&
    a.range.lineEnd === b.range.lineEnd &&
    a.range.columnStart === b.range.columnStart &&
    a.range.columnEnd === b.range.columnEnd;

  const typedTarget = (call: ts.CallExpression): Target | undefined => {
    if (!ts.isPropertyAccessExpression(call.expression) ||
        call.arguments.length === 0) return undefined;
    const source = site(call);
    const matches = methodCalls.filter(item => sameSite(item.source, source) &&
      (((item.receiverType === "Player" || item.receiverType === "World") &&
        item.method === "sendMessage") ||
       (item.receiverType === "ScreenDisplay" &&
        (item.method === "setTitle" || item.method === "setActionBar"))));
    if (matches.length !== 1) return undefined;
    const item = matches[0]!;
    if ((item.receiverType === "Player" || item.receiverType === "World") &&
        item.method === "sendMessage")
      return { source, receiverType: item.receiverType,
        method: "sendMessage", executionRegion: region(call) };
    if (item.receiverType === "ScreenDisplay" &&
        (item.method === "setTitle" || item.method === "setActionBar"))
      return { source, receiverType: "ScreenDisplay", method: item.method,
        executionRegion: region(call) };
    return undefined;
  };
  const unwrap = (input: ts.Expression): ts.Expression => {
    let value = input;
    while (ts.isParenthesizedExpression(value) ||
           ts.isAsExpression(value) ||
           ts.isTypeAssertionExpression(value) ||
           ts.isSatisfiesExpression(value) ||
           ts.isNonNullExpression(value)) value = value.expression;
    return value;
  };
  const safeObject = (value: ts.ObjectLiteralExpression): boolean => {
    const keys = new Set<string>();
    for (const member of value.properties) {
      if (!ts.isPropertyAssignment(member) ||
          !(ts.isIdentifier(member.name) ||
            ts.isStringLiteralLike(member.name)) ||
          keys.has(member.name.text)) return false;
      keys.add(member.name.text);
    }
    return true;
  };
  const containsParam = (
    expr: ts.Expression, name: string, depth = 0,
  ): boolean => {
    if (depth > 8) return false;
    const value = unwrap(expr);
    if (ts.isIdentifier(value)) return value.text === name;
    if (ts.isObjectLiteralExpression(value)) {
      return safeObject(value) && value.properties.some(prop =>
        ts.isPropertyAssignment(prop) &&
        containsParam(prop.initializer, name, depth + 1));
    }
    if (ts.isArrayLiteralExpression(value)) {
      return value.elements.every(item => !ts.isSpreadElement(item)) &&
        value.elements.some(item => ts.isExpression(item) &&
          containsParam(item, name, depth + 1));
    }
    return false;
  };

  /** Only a unique top-level helper with one typed UI call statement. */
  const helperTarget = (
    caller: ts.CallExpression, index: number,
  ): Target | undefined => {
    if (!ts.isIdentifier(caller.expression) ||
        caller.arguments.some(ts.isSpreadElement)) return undefined;
    const name = caller.expression.text;
    const matching = helpers.get(name) ?? [];
    if (matching.length !== 1) return undefined;
    const fn = matching[0]!;
    if (!fn.body || fn.asteriskToken ||
        fn.modifiers?.some(mod => mod.kind === ts.SyntaxKind.AsyncKeyword) ||
        fn.parameters.length !== caller.arguments.length ||
        fn.parameters.some(param => !ts.isIdentifier(param.name) ||
          param.initializer !== undefined ||
          param.dotDotDotToken !== undefined)) return undefined;
    // Function symbol must not be overwritten, shadowed, exported by value,
    // or invoked through an alias in the inspected source file.
    const fnRefs = identifiers.get(name) ?? [];
    if (fnRefs.some(ref => ref !== fn.name &&
        !(ts.isCallExpression(ref.parent) &&
          ref.parent.expression === ref))) return undefined;
    if (fn.body.statements.length !== 1) return undefined;
    const statement = fn.body.statements[0]!;
    const bodyExpr = ts.isExpressionStatement(statement)
      ? statement.expression
      : ts.isReturnStatement(statement) ? statement.expression : undefined;
    if (!bodyExpr || !ts.isCallExpression(bodyExpr)) return undefined;
    const target = typedTarget(bodyExpr);
    const param = fn.parameters[index]?.name;
    if (!target || !param || !ts.isIdentifier(param) ||
        !bodyExpr.arguments[0] ||
        !containsParam(bodyExpr.arguments[0]!, param.text)) return undefined;
    const paramRefs = identifiers.get(param.text) ?? [];
    if (paramRefs.length !== 2 || !paramRefs.includes(param)) return undefined;
    const use = paramRefs.find(item => item !== param);
    if (!use) return undefined;
    let ancestor: ts.Node | undefined = use;
    let inPrimary = false;
    while (ancestor && ancestor !== bodyExpr) {
      if (ancestor === bodyExpr.arguments[0]) inPrimary = true;
      ancestor = ancestor.parent;
    }
    return ancestor === bodyExpr && inPrimary ? target : undefined;
  };


  /**
   * A uniquely selected static this.method argument -> formal parameter
   * -> typed UI call. The method may have control flow, but the payload
   * parameter must be read exactly once as the FIRST UI argument. This is
   * authored source eligibility, not observed dispatch or player delivery.
   */
  const localThisMethodTarget = (
    caller: ts.CallExpression, index: number,
  ): Target | undefined => {
    if (!ts.isPropertyAccessExpression(caller.expression) ||
        caller.expression.expression.kind !== ts.SyntaxKind.ThisKeyword ||
        caller.arguments.some(ts.isSpreadElement)) return undefined;
    let owner: ts.Node | undefined = caller.parent;
    while (owner && !ts.isMethodDeclaration(owner)) {
      // A nested function/callback can rebind the this receiver and has
      // its own execution region. It is not the class source owner.
      if (ts.isFunctionDeclaration(owner) ||
          ts.isFunctionExpression(owner) ||
          ts.isArrowFunction(owner) ||
          ts.isConstructorDeclaration(owner)) return undefined;
      owner = owner.parent;
    }
    if (!owner || !ts.isMethodDeclaration(owner)) return undefined;
    const cls = owner.parent;
    if ((!ts.isClassDeclaration(cls) && !ts.isClassExpression(cls)) ||
        (cls.heritageClauses?.length ?? 0) !== 0 ||
        !owner.modifiers?.some(m => m.kind === ts.SyntaxKind.StaticKeyword))
      return undefined;
    const methodName = caller.expression.name.text;
    // Same class only; identical method names elsewhere in a published
    // bundle have no source identity relationship to this invocation.
    const matched = cls.members.filter((member): member is ts.MethodDeclaration =>
      ts.isMethodDeclaration(member) &&
      (ts.isIdentifier(member.name) || ts.isStringLiteralLike(member.name)) &&
      member.name.text === methodName &&
      member.body !== undefined);
    if (matched.length !== 1) return undefined;
    const target = matched[0]!;
    if (target === owner ||
        !target.modifiers?.some(m => m.kind === ts.SyntaxKind.StaticKeyword) ||
        target.parameters.length !== caller.arguments.length ||
        target.parameters.some(p => !ts.isIdentifier(p.name) ||
          p.initializer !== undefined || p.dotDotDotToken !== undefined))
      return undefined;
    const parameter = target.parameters[index]?.name;
    if (!parameter || !ts.isIdentifier(parameter)) return undefined;
    const references: ts.Identifier[] = [];
    const collect = (node: ts.Node): void => {
      if (ts.isIdentifier(node) && node.text === parameter.text &&
          isValueIdentifier(node)) references.push(node);
      ts.forEachChild(node, collect);
    };
    collect(target.body!);
    if (references.length !== 1) return undefined;
    const use = references[0]!;
    const targetRegion = sourceMethodRegion(target, file);
    let resolved: Target | undefined;
    let matches = 0;
    const scan = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && node.arguments[0] === use &&
          !node.arguments.some(ts.isSpreadElement)) {
        const typed = typedTarget(node);
        if (typed && typed.executionRegion === targetRegion) {
          resolved = typed;
          matches++;
        }
      }
      ts.forEachChild(node, scan);
    };
    scan(target.body!);
    return matches === 1 ? resolved : undefined;
  };

  /** One immutable lexical binding and exactly one reference. */
  const uniqueConstUse = (
    declaration: ts.VariableDeclaration,
  ): ts.Identifier | undefined => {
    const list = declaration.parent;
    if (!ts.isVariableDeclarationList(list) ||
        !(list.flags & ts.NodeFlags.Const) ||
        !ts.isVariableStatement(list.parent) ||
        !ts.isIdentifier(declaration.name)) return undefined;
    const refs = identifiers.get(declaration.name.text) ?? [];
    if (refs.length !== 2 || !refs.includes(declaration.name)) return undefined;
    const use = refs.find(ref => ref !== declaration.name);
    if (!use) return undefined;
    const scope: ts.Node = list.parent.parent;
    if (!ts.isBlock(scope) && !ts.isSourceFile(scope)) return undefined;
    let ancestor: ts.Node | undefined = use;
    while (ancestor && ancestor !== scope) ancestor = ancestor.parent;
    return ancestor === scope ? use : undefined;
  };

  return (property): Forwarded | undefined => {
    let current: ts.Node = property;
    const hops: Hop[] = [];
    let constants = 0;
    const seen = new Set<ts.VariableDeclaration>();
    for (let iteration = 0; iteration < 36 && current.parent; iteration++) {
      const parent: ts.Node = current.parent;
      if (ts.isCallExpression(parent)) {
        const index = parent.arguments.indexOf(current as ts.Expression);
        if (index < 0) return undefined;
        if (index === 0) {
          const target = typedTarget(parent);
          if (target) return hops.length > 0 ? { ...target, hops } : undefined;
        }
        if (hops.length >= MAX_TOTAL_HOPS) return undefined;
        const simpleHelper = helperTarget(parent, index);
        const localMethod = simpleHelper === undefined
          ? localThisMethodTarget(parent, index) : undefined;
        const target = simpleHelper ?? localMethod;
        if (!target) return undefined;
        hops.push({
          kind: localMethod === undefined
            ? "simple-helper-parameter" : "local-this-method-parameter",
          declarationSource: site(parent),
          consumptionSource: target.source,
        });
        return { ...target, hops };
      }
      if (ts.isVariableDeclaration(parent)) {
        if (parent.initializer !== current || seen.has(parent) ||
            ++constants > MAX_CONST_HOPS || hops.length >= MAX_TOTAL_HOPS)
          return undefined;
        seen.add(parent);
        const use = uniqueConstUse(parent);
        if (!use) return undefined;
        hops.push({
          kind: "immutable-const-binding",
          declarationSource: site(parent),
          consumptionSource: site(use),
        });
        current = use;
      } else if (ts.isObjectLiteralExpression(parent)) {
        if (!safeObject(parent)) return undefined;
        current = parent;
      } else if (ts.isPropertyAssignment(parent)) {
        if (parent.initializer !== current ||
            !(ts.isIdentifier(parent.name) ||
              ts.isStringLiteralLike(parent.name))) return undefined;
        current = parent;
      } else if (ts.isArrayLiteralExpression(parent)) {
        if (parent.elements.some(ts.isSpreadElement)) return undefined;
        current = parent;
      } else if (ts.isParenthesizedExpression(parent) ||
                 ts.isAsExpression(parent) ||
                 ts.isTypeAssertionExpression(parent) ||
                 ts.isSatisfiesExpression(parent) ||
                 ts.isNonNullExpression(parent)) {
        current = parent;
      } else return undefined;
    }
    return undefined;
  };
}
