import ts from "typescript";
import type { SourceRef } from "../../../../packages/project-model/src/index.js";
import type {
  ScriptApiReceiverType,
  ScriptMethodCall,
  ScriptMethodResultUse,
  ScriptPropertyAccess,
  ScriptPropertyWrite,
} from "../core/types.js";
import type { ScriptArgumentKind } from "../../../../packages/compatibility/src/index.js";

type ReceiverValueType =
  | ScriptApiReceiverType
  | `${ScriptApiReceiverType}[]`
  | "PlayerSpawnAfterEvent"
  | "ActionFormDataConstructor"
  | "ModalFormDataConstructor"
  | "MessageFormDataConstructor";

interface Scope {
  values: Map<string, ReceiverValueType | null>;
  parent?: Scope;
}

const ARRAY_CALLBACK_METHODS = new Set([
  "every",
  "filter",
  "find",
  "forEach",
  "map",
  "some",
]);

const ENTITY_INHERITED_METHODS = new Set([
  "addTag",
  "getTags",
  "hasTag",
  "removeTag",
  "getComponent",
  "runCommandAsync",
  "isValid",
  "applyKnockback",
  "applyImpulse",
  "clearVelocity",
  "teleport",
  "triggerEvent",
]);

const ENTITY_INHERITED_PROPERTIES = new Set([
  "dimension",
  "id",
  "isSneaking",
  "isValid",
  "location",
  "nameTag",
  "scoreboardIdentity",
  "typeId",
]);

function lineSource(
  sourceFile: ts.SourceFile,
  node: ts.Node,
  source: SourceRef,
): SourceRef {
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

function childScope(parent?: Scope): Scope {
  return parent
    ? { values: new Map<string, ReceiverValueType | null>(), parent }
    : { values: new Map<string, ReceiverValueType | null>() };
}

function minecraftSingletonBindings(
  file: ts.SourceFile,
): Map<string, ScriptApiReceiverType> {
  // Script API singletons are imported module bindings, not JS globals.
  // A bare identifier or unrelated import must never establish API evidence.
  const output = new Map<string, ScriptApiReceiverType>();

  for (const statement of file.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteralLike(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== "@minecraft/server" ||
      statement.importClause?.isTypeOnly
    ) {
      continue;
    }

    const named = statement.importClause?.namedBindings;
    if (!named || !ts.isNamedImports(named)) continue;

    for (const element of named.elements) {
      if (element.isTypeOnly) continue;
      const importedName = element.propertyName?.text ?? element.name.text;
      if (importedName === "world") output.set(element.name.text, "World");
      if (importedName === "system") output.set(element.name.text, "System");
    }
  }

  return output;
}

/** Treat only constructors imported from the official UI module as forms. */
function seedMinecraftUiBindings(scope: Scope, file: ts.SourceFile): void {
  const supported = new Set([
    "ActionFormData", "ModalFormData", "MessageFormData",
  ]);
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) ||
        !ts.isStringLiteralLike(statement.moduleSpecifier) ||
        statement.moduleSpecifier.text !== "@minecraft/server-ui" ||
        statement.importClause?.isTypeOnly) continue;
    const named = statement.importClause?.namedBindings;
    if (!named || !ts.isNamedImports(named)) continue;
    for (const element of named.elements) {
      const imported = element.propertyName?.text ?? element.name.text;
      if (element.isTypeOnly) continue;
      if (imported === "uiManager") {
        scope.values.set(element.name.text, "UIManager");
      } else if (supported.has(imported)) {
        scope.values.set(
          element.name.text,
          (imported + "Constructor") as ReceiverValueType,
        );
      }
    }
  }
}

function seedMinecraftSingletons(
  scope: Scope,
  bindings: ReadonlyMap<string, ScriptApiReceiverType>,
): void {
  for (const [localName, receiver] of bindings) {
    scope.values.set(localName, receiver);
  }
}

function lookup(scope: Scope, name: string): ReceiverValueType | undefined {
  let current: Scope | undefined = scope;
  while (current) {
    // Untyped lexical declarations mask parent/imported Minecraft bindings.
    if (current.values.has(name)) return current.values.get(name) ?? undefined;
    current = current.parent;
  }
  return undefined;
}

function hasLexicalBinding(scope: Scope, name: string): boolean {
  let current: Scope | undefined = scope;
  while (current) {
    // A null value is still an authored shadow, not an absent binding.
    if (current.values.has(name)) return true;
    current = current.parent;
  }
  return false;
}

/** Local bindings with no supported type are shadows, not inherited aliases. */
function bindName(scope: Scope, name: ts.BindingName, type?: ReceiverValueType): void {
  if (ts.isIdentifier(name)) {
    scope.values.set(name.text, type ?? null);
    return;
  }
  for (const element of name.elements) {
    if (ts.isBindingElement(element)) bindName(scope, element.name);
  }
}

function parameterScope(outer: Scope, parameters: ts.NodeArray<ts.ParameterDeclaration>): Scope {
  const scope = childScope(outer);
  for (const parameter of parameters) {
    bindName(scope, parameter.name, typeFromAnnotation(parameter.type));
  }
  return scope;
}

function directSingletonType(
  scope: Scope,
  identifier: ts.Identifier,
  receiver: ScriptApiReceiverType,
  bindings: ReadonlyMap<string, ScriptApiReceiverType>,
): boolean {
  let current = scope;
  while (current.parent) {
    if (current.values.has(identifier.text)) return false;
    current = current.parent;
  }
  return bindings.get(identifier.text) === receiver &&
    current.values.get(identifier.text) === receiver;
}

function receiverElement(
  type: ReceiverValueType | undefined,
): ScriptApiReceiverType | undefined {
  if (!type?.endsWith("[]")) return undefined;
  return type.slice(0, -2) as ScriptApiReceiverType;
}

function receiverObject(
  type: ReceiverValueType | undefined,
): ScriptApiReceiverType | undefined {
  // Internal event payload is only a bridge to its documented .player
  // property. It is not an arbitrary Minecraft API receiver type.
  return type && type !== "PlayerSpawnAfterEvent" &&
    !type.endsWith("Constructor") && !type.endsWith("[]")
    ? type as ScriptApiReceiverType
    : undefined;
}

function typeFromAnnotation(
  node: ts.TypeNode | undefined,
): ReceiverValueType | undefined {
  if (!node) return undefined;
  if (ts.isArrayTypeNode(node)) {
    const element = typeFromAnnotation(node.elementType);
    return element && !element.endsWith("[]")
      ? `${element}[]` as ReceiverValueType
      : undefined;
  }
  if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName)) {
    const name = node.typeName.text as ScriptApiReceiverType;
    if (
      name === "World" ||
      name === "System" ||
      name === "Player" ||
      name === "Entity" ||
      name === "Dimension" ||
      name === "Scoreboard" ||
      name === "ScoreboardObjective" ||
      name === "PlayerInputPermissions" ||
      name === "Block" ||
      name === "ItemStack" ||
      name === "BlockPermutation" ||
      name === "EntityFrictionModifierComponent" ||
      name === "EntityMarkVariantComponent" ||
      name === "EntityPushThroughComponent" ||
      name === "EntityScaleComponent" ||
      name === "EntitySkinIdComponent"
    ) {
      return name;
    }
  }
  return undefined;
}

function propertyType(
  receiver: ScriptApiReceiverType,
  property: string,
): ReceiverValueType | undefined {
  if (receiver === "World" && property === "scoreboard") return "Scoreboard";
  // Official Bedrock Script API: Block.dimension and inherited
  // Entity/Player.dimension expose a Dimension. This follows an already
  // known receiver; never infer a Block/Entity from arbitrary '.dimension'.
  if (property === "dimension" &&
      (receiver === "Block" || receiver === "Entity" ||
       receiver === "Player")) return "Dimension";
  if (receiver === "Block" && property === "permutation") return "BlockPermutation";
  if (receiver === "Player" && property === "inputPermissions") {
    return "PlayerInputPermissions";
  }
  if (receiver === "Player" && property === "onScreenDisplay") {
    return "ScreenDisplay";
  }
  // Derive a Camera only from a known Player; never from a same-named method.
  if (receiver === "Player" && property === "camera") return "Camera";
  return undefined;
}


function entityComponentType(
  call: ts.CallExpression,
): ScriptApiReceiverType | undefined {
  const argument = call.arguments[0];
  if (!argument || !ts.isStringLiteralLike(argument)) return undefined;

  switch (argument.text) {
    case "minecraft:friction_modifier":
      return "EntityFrictionModifierComponent";
    case "minecraft:mark_variant":
      return "EntityMarkVariantComponent";
    case "minecraft:push_through":
      return "EntityPushThroughComponent";
    case "minecraft:scale":
      return "EntityScaleComponent";
    case "minecraft:skin_id":
      return "EntitySkinIdComponent";
    default:
      return undefined;
  }
}

function methodReturnType(
  receiver: ScriptApiReceiverType,
  method: string,
  call?: ts.CallExpression,
): ReceiverValueType | undefined {
  // Fluent form builders retain their instance type. Only instances
  // from an import-qualified @minecraft/server-ui constructor qualify.
  if (receiver === "ActionFormData" &&
      ["title", "body", "button"].includes(method)) return receiver;
  if (receiver === "MessageFormData" &&
      ["title", "body", "button1", "button2"].includes(method)) return receiver;
  if (receiver === "ModalFormData" &&
      ["title", "dropdown", "slider", "textField", "toggle",
       "submitButton", "label", "divider"].includes(method)) return receiver;
  if (
    call &&
    (receiver === "Entity" || receiver === "Player") &&
    method === "getComponent"
  ) {
    return entityComponentType(call);
  }
  if (receiver === "World" && method === "getAllPlayers") return "Player[]";
  if (receiver === "World" && method === "getPlayers") return "Player[]";
  if (receiver === "World" && method === "getDimension") return "Dimension";
  if (receiver === "Dimension" && method === "getEntities") return "Entity[]";
  if (receiver === "Dimension" && method === "getPlayers") return "Player[]";
  if (receiver === "Dimension" && method === "getBlock") return "Block";
  if (receiver === "Scoreboard" && method === "getObjective") {
    return "ScoreboardObjective";
  }
  return undefined;
}

function isUndefinedLike(node: ts.Expression): boolean {
  return (
    node.kind === ts.SyntaxKind.NullKeyword ||
    (ts.isIdentifier(node) && node.text === "undefined")
  );
}

function isPositiveGuard(node: ts.Expression, name: string): boolean {
  if (ts.isIdentifier(node) && node.text === name) return true;
  if (ts.isParenthesizedExpression(node)) return isPositiveGuard(node.expression, name);
  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
  ) {
    return (
      isPositiveGuard(node.left, name) ||
      isPositiveGuard(node.right, name)
    );
  }
  if (
    ts.isBinaryExpression(node) &&
    ts.isIdentifier(node.left) &&
    node.left.text === name &&
    (
      node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsToken ||
      node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken
    ) &&
    isUndefinedLike(node.right)
  ) {
    return true;
  }
  return false;
}

function isNegativeGuard(node: ts.Expression, name: string): boolean {
  if (
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.ExclamationToken &&
    ts.isIdentifier(node.operand) &&
    node.operand.text === name
  ) {
    return true;
  }
  if (ts.isParenthesizedExpression(node)) return isNegativeGuard(node.expression, name);
  if (
    ts.isBinaryExpression(node) &&
    ts.isIdentifier(node.left) &&
    node.left.text === name &&
    (
      node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsToken ||
      node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken
    ) &&
    isUndefinedLike(node.right)
  ) {
    return true;
  }
  return false;
}

function statementTerminates(node: ts.Statement): boolean {
  if (ts.isReturnStatement(node) || ts.isThrowStatement(node)) return true;
  if (ts.isBlock(node)) {
    const last = node.statements.at(-1);
    return last ? statementTerminates(last) : false;
  }
  return false;
}

function identifierDereferenceState(
  node: ts.Node,
  name: string,
  guarded = false,
): { safe: boolean; risk: boolean } {
  let safe = false;
  let risk = false;

  const visit = (current: ts.Node, currentGuarded: boolean): void => {
    if (ts.isIfStatement(current) && isPositiveGuard(current.expression, name)) {
      visit(current.thenStatement, true);
      if (current.elseStatement) visit(current.elseStatement, currentGuarded);
      return;
    }

    if (
      ts.isConditionalExpression(current) &&
      isPositiveGuard(current.condition, name)
    ) {
      visit(current.whenTrue, true);
      visit(current.whenFalse, currentGuarded);
      return;
    }

    if (
      ts.isPropertyAccessExpression(current) &&
      ts.isIdentifier(current.expression) &&
      current.expression.text === name
    ) {
      if (current.questionDotToken || currentGuarded) safe = true;
      else risk = true;
    }

    if (
      ts.isElementAccessExpression(current) &&
      ts.isIdentifier(current.expression) &&
      current.expression.text === name
    ) {
      if (current.questionDotToken || currentGuarded) safe = true;
      else risk = true;
    }

    ts.forEachChild(current, (child) => visit(child, currentGuarded));
  };

  visit(node, guarded);
  return { safe, risk };
}

function assignedResultUse(
  declaration: ts.VariableDeclaration,
): ScriptMethodResultUse {
  if (!ts.isIdentifier(declaration.name)) return "assigned";
  const name = declaration.name.text;
  const declarationList = declaration.parent;
  const statement = declarationList.parent;
  if (!ts.isVariableStatement(statement)) return "assigned";

  const container = statement.parent;
  const statements = ts.isBlock(container) || ts.isSourceFile(container)
    ? container.statements
    : undefined;
  if (!statements) return "assigned";

  const start = statements.indexOf(statement);
  if (start < 0) return "assigned";

  let guardedAfterEarlyExit = false;
  let safe = false;

  for (let index = start + 1; index < statements.length; index += 1) {
    const candidate = statements[index];
    if (!candidate) continue;

    if (
      ts.isExpressionStatement(candidate) &&
      ts.isBinaryExpression(candidate.expression) &&
      candidate.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(candidate.expression.left) &&
      candidate.expression.left.text === name
    ) {
      break;
    }

    if (
      ts.isIfStatement(candidate) &&
      isNegativeGuard(candidate.expression, name) &&
      statementTerminates(candidate.thenStatement)
    ) {
      guardedAfterEarlyExit = true;
      continue;
    }

    const state = identifierDereferenceState(
      candidate,
      name,
      guardedAfterEarlyExit,
    );
    if (state.risk) return "unguarded-assigned";
    if (state.safe) safe = true;
  }

  return safe ? "guarded-assigned" : "assigned";
}

function callIsGuardCondition(call: ts.CallExpression): boolean {
  let current: ts.Node = call;
  let parent = current.parent;

  while (
    parent &&
    (
      ts.isParenthesizedExpression(parent) ||
      ts.isPrefixUnaryExpression(parent) ||
      ts.isBinaryExpression(parent)
    )
  ) {
    current = parent;
    parent = parent.parent;
  }

  if (parent && ts.isIfStatement(parent) && parent.expression === current) {
    return true;
  }
  if (
    parent &&
    ts.isConditionalExpression(parent) &&
    parent.condition === current
  ) {
    return true;
  }
  if (
    parent &&
    (ts.isWhileStatement(parent) || ts.isDoStatement(parent)) &&
    parent.expression === current
  ) {
    return true;
  }
  return false;
}

function executionRegionId(
  node: ts.Node,
  file: ts.SourceFile,
): string {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isFunctionDeclaration(current)) {
      return current.name
        ? "function:" + current.name.text
        : "function@" + lineSource(file, current, {
            artifactId: "",
            relativePath: file.fileName,
          }).range?.lineStart;
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

function methodResultUse(call: ts.CallExpression): ScriptMethodResultUse {
  if (callIsGuardCondition(call)) return "guard-condition";
  const parent = call.parent;

  if (ts.isPropertyAccessExpression(parent) && parent.expression === call) {
    return parent.questionDotToken ? "optional-dereferenced" : "dereferenced";
  }
  if (ts.isElementAccessExpression(parent) && parent.expression === call) {
    return parent.questionDotToken ? "optional-dereferenced" : "dereferenced";
  }
  if (ts.isNonNullExpression(parent)) return "non-null-asserted";
  if (ts.isVariableDeclaration(parent) && parent.initializer === call) {
    return assignedResultUse(parent);
  }
  if (ts.isReturnStatement(parent) && parent.expression === call) return "returned";
  if (ts.isExpressionStatement(parent)) return "ignored";
  return "other";
}

function argumentKind(node: ts.Expression): ScriptArgumentKind {
  if (ts.isNumericLiteral(node)) return "number";
  if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return "string";
  }
  if (node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword) {
    return "boolean";
  }
  if (node.kind === ts.SyntaxKind.NullKeyword) return "null";
  if (ts.isObjectLiteralExpression(node)) return "object";
  if (ts.isArrayLiteralExpression(node)) return "array";
  if (ts.isIdentifier(node)) return "identifier";
  if (ts.isCallExpression(node)) return "call";
  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
    return "property";
  }
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return "function";
  if (ts.isSpreadElement(node)) return "spread";
  return "other";
}

function canonicalMethodSymbol(
  receiver: ScriptApiReceiverType,
  method: string,
): string {
  if (receiver === "World") return `world.${method}`;
  if (receiver === "System") return `system.${method}`;
  if (receiver === "Player" && ENTITY_INHERITED_METHODS.has(method)) {
    return `Entity.${method}`;
  }
  return `${receiver}.${method}`;
}

function inferExpressionType(
  node: ts.Expression,
  scope: Scope,
  functionReturns: ReadonlyMap<string, ReceiverValueType>,
): ReceiverValueType | undefined {
  if (ts.isIdentifier(node)) return lookup(scope, node.text);

  if (ts.isNewExpression(node) && ts.isIdentifier(node.expression)) {
    const constructor = lookup(scope, node.expression.text);
    if (constructor === "ActionFormDataConstructor") return "ActionFormData";
    if (constructor === "ModalFormDataConstructor") return "ModalFormData";
    if (constructor === "MessageFormDataConstructor") return "MessageFormData";
    return undefined;
  }

  if (ts.isPropertyAccessExpression(node)) {
    const origin = inferExpressionType(node.expression, scope, functionReturns);
    if (origin === "PlayerSpawnAfterEvent") {
      // Official PlayerSpawnAfterEvent.player is a Player, unlike
      // PlayerJoinAfterEvent, which exposes only playerId/playerName.
      return node.name.text === "player" ? "Player" : undefined;
    }
    const receiver = receiverObject(origin);
    return receiver ? propertyType(receiver, node.name.text) : undefined;
  }

  if (ts.isElementAccessExpression(node)) {
    return receiverElement(
      inferExpressionType(node.expression, scope, functionReturns),
    );
  }

  if (ts.isCallExpression(node)) {
    if (ts.isIdentifier(node.expression)) {
      // A local callback, parameter or import can reuse a top-level helper's
      // minified name. Never inherit the helper's return receiver through
      // that lexical shadow.
      return hasLexicalBinding(scope, node.expression.text)
        ? undefined : functionReturns.get(node.expression.text);
    }

    if (ts.isPropertyAccessExpression(node.expression)) {
      const receiverType = inferExpressionType(
        node.expression.expression,
        scope,
        functionReturns,
      );
      const elementType = receiverElement(receiverType);
      const method = node.expression.name.text;
      if (elementType) {
        if (method === "find") return elementType;
        if (method === "filter") return `${elementType}[]`;
        return undefined;
      }

      const receiver = receiverObject(receiverType);
      return receiver ? methodReturnType(receiver, method, node) : undefined;
    }
  }

  if (ts.isParenthesizedExpression(node)) {
    return inferExpressionType(node.expression, scope, functionReturns);
  }

  return undefined;
}

function firstReturnExpression(
  fn: ts.FunctionDeclaration,
): ts.Expression | undefined {
  if (!fn.body) return undefined;
  const returns = fn.body.statements.filter(ts.isReturnStatement);
  if (returns.length !== 1) return undefined;
  return returns[0]?.expression;
}

function inferFunctionReturns(
  file: ts.SourceFile,
): Map<string, ReceiverValueType> {
  const output = new Map<string, ReceiverValueType>();
  const root = childScope();
  seedMinecraftSingletons(root, minecraftSingletonBindings(file));
  seedMinecraftUiBindings(root, file);

  for (const statement of file.statements) {
    if (!ts.isFunctionDeclaration(statement) || !statement.name) continue;
    const expression = firstReturnExpression(statement);
    if (!expression) continue;
    const type = inferExpressionType(expression, root, output);
    if (type) output.set(statement.name.text, type);
  }

  return output;
}

/**
 * Exact built-in event origin, never a match on a variable named "player".
 * We recognize only direct @minecraft/server world.afterEvents.playerSpawn
 * subscriptions. PlayerJoin has a different payload and MUST NOT qualify.
 */
function isImportedMinecraftWorld(file: ts.SourceFile): ReadonlySet<string> {
  const imported = new Set<string>();
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) ||
        !ts.isStringLiteralLike(statement.moduleSpecifier) ||
        statement.moduleSpecifier.text !== "@minecraft/server") continue;
    const named = statement.importClause?.namedBindings;
    if (!named || !ts.isNamedImports(named)) continue;
    for (const element of named.elements) {
      if ((element.propertyName?.text ?? element.name.text) === "world") {
        imported.add(element.name.text);
      }
    }
  }
  return imported;
}

function isDirectPlayerSpawnSubscription(
  call: ts.CallExpression,
  scope: Scope,
  imports: ReadonlyMap<string, ScriptApiReceiverType>,
  importedWorlds: ReadonlySet<string>,
): boolean {
  if (!ts.isPropertyAccessExpression(call.expression) ||
      call.expression.name.text !== "subscribe") return false;
  const signal = call.expression.expression;
  if (!ts.isPropertyAccessExpression(signal) ||
      signal.name.text !== "playerSpawn") return false;
  const events = signal.expression;
  if (!ts.isPropertyAccessExpression(events) ||
      events.name.text !== "afterEvents" ||
      !ts.isIdentifier(events.expression)) return false;
  return importedWorlds.has(events.expression.text) &&
    directSingletonType(scope, events.expression, "World", imports);
}

/**
 * A source event parameter may be rebound, shadowed or overwritten before
 * use. Refuse event-derived Player typing in that entire callback unless
 * its own event binding and .player property remain lexically stable.
 */
function stablePlayerSpawnEventParameter(
  callback: ts.ArrowFunction | ts.FunctionExpression,
): string | undefined {
  const first = callback.parameters[0];
  if (!first || !ts.isIdentifier(first.name)) return undefined;
  const name = first.name.text;
  let changed = false;
  const inspect = (node: ts.Node): void => {
    // Include nested closures in the source mutation/shadow inventory:
    // their execution order is unknown, so a captured mutable event is
    // deliberately not promoted into a stable Player receiver.
    if ((ts.isVariableDeclaration(node) || ts.isParameter(node) ||
         ts.isBindingElement(node)) &&
        ts.isIdentifier(node.name) && node.name.text === name) changed = true;
    if (ts.isBinaryExpression(node) &&
        (node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
         node.operatorToken.kind <= ts.SyntaxKind.LastAssignment) &&
        (ts.isIdentifier(node.left) && node.left.text === name ||
         ts.isPropertyAccessExpression(node.left) &&
           ts.isIdentifier(node.left.expression) &&
           node.left.expression.text === name &&
           node.left.name.text === "player")) changed = true;
    ts.forEachChild(node, inspect);
  };
  inspect(callback.body);
  return changed ? undefined : name;
}

/**
 * Narrow local helper handoff, not general interprocedural type inference.
 * Infer one function parameter only when a single direct call forwards the
 * exact event.player property from a verified playerSpawn callback.
 * Reject exports, aliases, shadowed names, reassignments, and extra calls.
 */
function uniqueSpawnPlayerForward(
  file: ts.SourceFile,
  imports: ReadonlyMap<string, ScriptApiReceiverType>,
): ReadonlyMap<string, number> {
  // Avoid accepting fake or shadowed world bindings. Imports (including
  // renamed imports) are the only trusted world origins for this pass.
  const worldImports = isImportedMinecraftWorld(file);
  if (worldImports.size === 0) return new Map();
  const topLevel = new Map<string, ts.FunctionDeclaration>();
  const duplicate = new Set<string>();
  for (const statement of file.statements) {
    if (!ts.isFunctionDeclaration(statement) || !statement.name ||
        statement.modifiers?.some(m =>
          m.kind === ts.SyntaxKind.ExportKeyword ||
          m.kind === ts.SyntaxKind.DefaultKeyword)) continue;
    const name = statement.name.text;
    if (topLevel.has(name)) duplicate.add(name);
    else topLevel.set(name, statement);
  }
  for (const name of duplicate) topLevel.delete(name);
  if (topLevel.size === 0) return new Map();

  // Collect direct invocations and any non-call use of the helper name.
  // A function passed around as a value has unknown additional callers.
  const calls = new Map<string, ts.CallExpression[]>();
  const unsafeReferences = new Set<string>();
  let shadowedWorld = false;
  const inventory = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && topLevel.has(node.text)) {
      const parent = node.parent;
      if (ts.isFunctionDeclaration(parent) && parent.name === node &&
          topLevel.get(node.text) === parent) {
        // The unique top-level declaration itself. A nested declaration of
        // the same name is a shadow, NOT that function's identity.
      } else if (ts.isCallExpression(parent) && parent.expression === node) {
        const list = calls.get(node.text) ?? [];
        list.push(parent);
        calls.set(node.text, list);
      } else if (!(ts.isPropertyAccessExpression(parent) &&
                   parent.name === node)) {
        unsafeReferences.add(node.text);
      }
    }
    if (ts.isIdentifier(node) && worldImports.has(node.text)) {
      const parent = node.parent;
      if ((ts.isParameter(parent) && parent.name === node) ||
          (ts.isVariableDeclaration(parent) && parent.name === node) ||
          (ts.isFunctionDeclaration(parent) && parent.name === node) ||
          (ts.isCatchClause(parent) && parent.variableDeclaration?.name === node) ||
          (ts.isBindingElement(parent) && parent.name === node)) {
        shadowedWorld = true;
      }
    }
    ts.forEachChild(node, inventory);
  };
  inventory(file);
  if (shadowedWorld) return new Map();

  const eligibleCalls = new Map<ts.CallExpression, {
    readonly functionName: string;
    readonly parameterIndex: number;
  }>();
  const eventOrigin = childScope();
  seedMinecraftSingletons(eventOrigin, imports);
  const inspect = (node: ts.Node): void => {
    if (ts.isCallExpression(node) &&
        isDirectPlayerSpawnSubscription(node, eventOrigin, imports, worldImports)) {
      const callback = node.arguments[0];
      if (callback &&
          (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) {
        const eventName = stablePlayerSpawnEventParameter(callback);
        if (eventName !== undefined) {
          const search = (nested: ts.Node): void => {
            if (nested !== callback.body && ts.isFunctionLike(nested)) return;
            if (ts.isCallExpression(nested) &&
                ts.isIdentifier(nested.expression) &&
                topLevel.has(nested.expression.text)) {
              const calledFunction = nested.expression.text;
              nested.arguments.forEach((argument, index) => {
                if (!ts.isPropertyAccessExpression(argument) ||
                    argument.name.text !== "player" ||
                    !ts.isIdentifier(argument.expression) ||
                    argument.expression.text !== eventName) return;
                eligibleCalls.set(nested, {
                  functionName: calledFunction,
                  parameterIndex: index,
                });
              });
            }
            ts.forEachChild(nested, search);
          };
          search(callback.body);
        }
      }
    }
    ts.forEachChild(node, inspect);
  };
  inspect(file);

  const formalIsStable = (fn: ts.FunctionDeclaration, index: number): boolean => {
    const parameter = fn.parameters[index];
    if (!parameter || !ts.isIdentifier(parameter.name) || !fn.body) return false;
    const name = parameter.name.text;
    let uncertain = false;
    const inspectBody = (node: ts.Node): void => {
      if ((ts.isVariableDeclaration(node) ||
           ts.isParameter(node) ||
           ts.isBindingElement(node)) &&
          ts.isIdentifier(node.name) && node.name.text === name) uncertain = true;
      if (ts.isBinaryExpression(node) &&
          ts.isIdentifier(node.left) && node.left.text === name &&
          (node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
         node.operatorToken.kind <= ts.SyntaxKind.LastAssignment)) uncertain = true;
      if ((ts.isPrefixUnaryExpression(node) ||
           ts.isPostfixUnaryExpression(node)) &&
          ts.isIdentifier(node.operand) && node.operand.text === name &&
          (node.operator === ts.SyntaxKind.PlusPlusToken ||
           node.operator === ts.SyntaxKind.MinusMinusToken)) uncertain = true;
      ts.forEachChild(node, inspectBody);
    };
    inspectBody(fn.body);
    return !uncertain;
  };

  const trusted = new Map<string, number>();
  for (const [call, candidate] of eligibleCalls) {
    const fn = topLevel.get(candidate.functionName);
    if (!fn || unsafeReferences.has(candidate.functionName) ||
        calls.get(candidate.functionName)?.length !== 1 ||
        calls.get(candidate.functionName)?.[0] !== call ||
        !formalIsStable(fn, candidate.parameterIndex)) {
      continue;
    }
    trusted.set(candidate.functionName, candidate.parameterIndex);
  }
  return trusted;
}

export function inferScriptMethodCalls(
  file: ts.SourceFile,
  source: SourceRef,
): ScriptMethodCall[] {
  const calls: ScriptMethodCall[] = [];
  const functionReturns = inferFunctionReturns(file);
  const singletonBindings = minecraftSingletonBindings(file);
  const rootScope = childScope();
  seedMinecraftSingletons(rootScope, singletonBindings);
  seedMinecraftUiBindings(rootScope, file);
  const trustedSpawnForward = uniqueSpawnPlayerForward(file, singletonBindings);
  const importedWorlds = isImportedMinecraftWorld(file);

  const recordCall = (
    call: ts.CallExpression,
    scope: Scope,
  ): void => {
    if (!ts.isPropertyAccessExpression(call.expression)) return;
    const receiverExpression = call.expression.expression;
    const receiver = receiverObject(
      inferExpressionType(receiverExpression, scope, functionReturns),
    );
    if (!receiver) return;

    const method = call.expression.name.text;
    const direct =
      ts.isIdentifier(receiverExpression) &&
      directSingletonType(scope, receiverExpression, receiver, singletonBindings);

    calls.push({
      receiverType: receiver,
      ...(direct
        ? { root: receiver === "World" ? "world" as const : "system" as const }
        : {}),
      method,
      symbol: canonicalMethodSymbol(receiver, method),
      inference: direct ? "direct" : "bounded",
      receiverHint: receiverExpression.getText(file),
      executionRegion: executionRegionId(call, file),
      argumentCount: call.arguments.length,
      argumentKinds: call.arguments.map((argument) => argumentKind(argument)),
      argumentTexts: call.arguments.map((argument) =>
        argument.getText(file)
      ),
      hasSpreadArgument: call.arguments.some(ts.isSpreadElement),
      resultUse: methodResultUse(call),
      source: lineSource(file, call, source),
    });
  };

  const visit = (node: ts.Node, scope: Scope): void => {
    if (ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isArrowFunction(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isGetAccessorDeclaration(node) ||
        ts.isSetAccessorDeclaration(node) ||
        ts.isConstructorDeclaration(node)) {
      const fnScope = parameterScope(scope, node.parameters);
      if (ts.isFunctionDeclaration(node) && node.name) {
        const index = trustedSpawnForward.get(node.name.text);
        const parameter = index === undefined ? undefined : node.parameters[index];
        if (parameter && ts.isIdentifier(parameter.name)) {
          fnScope.values.set(parameter.name.text, "Player");
        }
      }
      if (node.body) visit(node.body, fnScope);
      return;
    }

    if (ts.isBlock(node)) {
      const blockScope = childScope(scope);
      // Block declarations mask outer singleton names before type refinement.
      for (const statement of node.statements) {
        if (ts.isVariableStatement(statement)) {
          for (const declaration of statement.declarationList.declarations) {
            bindName(blockScope, declaration.name);
          }
        } else if (ts.isFunctionDeclaration(statement) && statement.name) {
          blockScope.values.set(statement.name.text, null);
        }
      }
      for (const statement of node.statements) visit(statement, blockScope);
      return;
    }

    if (ts.isCatchClause(node)) {
      const catchScope = childScope(scope);
      if (node.variableDeclaration) bindName(catchScope, node.variableDeclaration.name);
      visit(node.block, catchScope);
      return;
    }

    if (ts.isVariableDeclaration(node)) {
      const explicit = typeFromAnnotation(node.type);
      const inferred = node.initializer
        ? inferExpressionType(node.initializer, scope, functionReturns)
        : undefined;
      bindName(scope, node.name, explicit ?? inferred);
      if (node.initializer) visit(node.initializer, scope);
      return;
    }

    if (ts.isForOfStatement(node)) {
      visit(node.expression, scope);
      const element = receiverElement(
        inferExpressionType(node.expression, scope, functionReturns),
      );
      const loopScope = childScope(scope);
      const declaration = node.initializer;
      if (ts.isVariableDeclarationList(declaration)) {
        for (const item of declaration.declarations) bindName(loopScope, item.name);
        const item = declaration.declarations.length === 1
          ? declaration.declarations[0] : undefined;
        if (element && item && ts.isIdentifier(item.name)) {
          bindName(loopScope, item.name, element);
        }
      }
      visit(node.statement, loopScope);
      return;
    }

    if (ts.isCallExpression(node)) {
      recordCall(node, scope);

      if (isDirectPlayerSpawnSubscription(node, scope, singletonBindings, importedWorlds)) {
        const callback = node.arguments[0];
        if (callback &&
            (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) {
          const callbackScope = parameterScope(scope, callback.parameters);
          const eventName = stablePlayerSpawnEventParameter(callback);
          if (eventName !== undefined) {
            callbackScope.values.set(eventName, "PlayerSpawnAfterEvent");
          }
          visit(callback.body, callbackScope);
          for (let index = 1; index < node.arguments.length; index += 1) {
            visit(node.arguments[index]!, scope);
          }
          return;
        }
      }

      if (ts.isPropertyAccessExpression(node.expression)) {
        const receiverType = inferExpressionType(
          node.expression.expression,
          scope,
          functionReturns,
        );
        const element = receiverElement(receiverType);
        const method = node.expression.name.text;
        const callback = node.arguments[0];

        visit(node.expression, scope);

        if (
          element &&
          ARRAY_CALLBACK_METHODS.has(method) &&
          callback &&
          (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))
        ) {
          const callbackScope = parameterScope(scope, callback.parameters);
          const parameter = callback.parameters[0];
          if (parameter && ts.isIdentifier(parameter.name)) {
            callbackScope.values.set(parameter.name.text, element);
          }
          visit(callback.body, callbackScope);
          for (let index = 1; index < node.arguments.length; index += 1) {
            const argument = node.arguments[index];
            if (argument) visit(argument, scope);
          }
          return;
        }
      }
    }

    ts.forEachChild(node, (child) => visit(child, scope));
  };

  visit(file, rootScope);

  const seen = new Set<string>();
  return calls.filter((call) => {
    const line = call.source.range?.lineStart ?? 0;
    const column = call.source.range?.columnStart ?? 0;
    const key = `${call.symbol}\0${line}\0${column}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function canonicalPropertySymbol(
  receiver: ScriptApiReceiverType,
  property: string,
): string {
  if (receiver === "World") return `world.${property}`;
  if (receiver === "System") return `system.${property}`;
  if (receiver === "Player" && ENTITY_INHERITED_PROPERTIES.has(property)) {
    return `Entity.${property}`;
  }
  return `${receiver}.${property}`;
}

export function inferScriptPropertyAccesses(
  file: ts.SourceFile,
  source: SourceRef,
): ScriptPropertyAccess[] {
  const accesses: ScriptPropertyAccess[] = [];
  const functionReturns = inferFunctionReturns(file);
  const singletonBindings = minecraftSingletonBindings(file);
  const rootScope = childScope();
  seedMinecraftSingletons(rootScope, singletonBindings);
  seedMinecraftUiBindings(rootScope, file);

  const recordProperty = (
    node: ts.PropertyAccessExpression,
    scope: Scope,
  ): void => {
    if (ts.isCallExpression(node.parent) && node.parent.expression === node) {
      return;
    }

    const receiverExpression = node.expression;
    const receiver = receiverObject(
      inferExpressionType(receiverExpression, scope, functionReturns),
    );
    if (!receiver) return;

    const property = node.name.text;
    if (
      (receiver === "World" || receiver === "System") &&
      (property === "beforeEvents" || property === "afterEvents")
    ) {
      return;
    }

    const direct =
      ts.isIdentifier(receiverExpression) &&
      directSingletonType(scope, receiverExpression, receiver, singletonBindings);

    accesses.push({
      receiverType: receiver,
      ...(direct
        ? { root: receiver === "World" ? "world" as const : "system" as const }
        : {}),
      property,
      symbol: canonicalPropertySymbol(receiver, property),
      inference: direct ? "direct" : "bounded",
      source: lineSource(file, node, source),
    });
  };

  const visit = (node: ts.Node, scope: Scope): void => {
    if (ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isArrowFunction(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isGetAccessorDeclaration(node) ||
        ts.isSetAccessorDeclaration(node) ||
        ts.isConstructorDeclaration(node)) {
      const fnScope = parameterScope(scope, node.parameters);
      if (node.body) visit(node.body, fnScope);
      return;
    }

    if (ts.isBlock(node)) {
      const blockScope = childScope(scope);
      // Block declarations mask outer singleton names before type refinement.
      for (const statement of node.statements) {
        if (ts.isVariableStatement(statement)) {
          for (const declaration of statement.declarationList.declarations) {
            bindName(blockScope, declaration.name);
          }
        } else if (ts.isFunctionDeclaration(statement) && statement.name) {
          blockScope.values.set(statement.name.text, null);
        }
      }
      for (const statement of node.statements) visit(statement, blockScope);
      return;
    }

    if (ts.isCatchClause(node)) {
      const catchScope = childScope(scope);
      if (node.variableDeclaration) bindName(catchScope, node.variableDeclaration.name);
      visit(node.block, catchScope);
      return;
    }

    if (ts.isVariableDeclaration(node)) {
      const explicit = typeFromAnnotation(node.type);
      const inferred = node.initializer
        ? inferExpressionType(node.initializer, scope, functionReturns)
        : undefined;
      bindName(scope, node.name, explicit ?? inferred);
      if (node.initializer) visit(node.initializer, scope);
      return;
    }

    if (ts.isForOfStatement(node)) {
      visit(node.expression, scope);
      const element = receiverElement(
        inferExpressionType(node.expression, scope, functionReturns),
      );
      const loopScope = childScope(scope);
      const declaration = node.initializer;
      if (ts.isVariableDeclarationList(declaration)) {
        for (const item of declaration.declarations) bindName(loopScope, item.name);
        const item = declaration.declarations.length === 1
          ? declaration.declarations[0] : undefined;
        if (element && item && ts.isIdentifier(item.name)) {
          bindName(loopScope, item.name, element);
        }
      }
      visit(node.statement, loopScope);
      return;
    }

    if (ts.isPropertyAccessExpression(node)) {
      recordProperty(node, scope);
    }

    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const receiverType = inferExpressionType(
        node.expression.expression,
        scope,
        functionReturns,
      );
      const element = receiverElement(receiverType);
      const method = node.expression.name.text;
      const callback = node.arguments[0];

      visit(node.expression, scope);

      if (
        element &&
        ARRAY_CALLBACK_METHODS.has(method) &&
        callback &&
        (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))
      ) {
        const callbackScope = parameterScope(scope, callback.parameters);
        const parameter = callback.parameters[0];
        if (parameter && ts.isIdentifier(parameter.name)) {
          callbackScope.values.set(parameter.name.text, element);
        }
        visit(callback.body, callbackScope);
        for (let index = 1; index < node.arguments.length; index += 1) {
          const argument = node.arguments[index];
          if (argument) visit(argument, scope);
        }
        return;
      }
    }

    ts.forEachChild(node, (child) => visit(child, scope));
  };

  visit(file, rootScope);

  const seen = new Set<string>();
  return accesses.filter((access) => {
    const line = access.source.range?.lineStart ?? 0;
    const column = access.source.range?.columnStart ?? 0;
    const key = `${access.symbol}\0${line}\0${column}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function canonicalPropertyWriteSymbol(
  receiver: ScriptApiReceiverType,
  property: string,
): string {
  if (receiver === "World") return `world.${property}`;
  if (receiver === "System") return `system.${property}`;
  if (receiver === "Player" && ENTITY_INHERITED_PROPERTIES.has(property)) {
    return `Entity.${property}`;
  }
  return `${receiver}.${property}`;
}

function assignmentOperation(kind: ts.SyntaxKind): ScriptPropertyWrite["operation"] | undefined {
  if (kind === ts.SyntaxKind.EqualsToken) return "assign";
  if (
    kind === ts.SyntaxKind.PlusEqualsToken ||
    kind === ts.SyntaxKind.MinusEqualsToken ||
    kind === ts.SyntaxKind.AsteriskEqualsToken ||
    kind === ts.SyntaxKind.SlashEqualsToken ||
    kind === ts.SyntaxKind.PercentEqualsToken
  ) {
    return "compound";
  }
  return undefined;
}

export function inferScriptPropertyWrites(
  file: ts.SourceFile,
  source: SourceRef,
): ScriptPropertyWrite[] {
  const writes: ScriptPropertyWrite[] = [];
  const functionReturns = inferFunctionReturns(file);
  const singletonBindings = minecraftSingletonBindings(file);
  const rootScope = childScope();
  seedMinecraftSingletons(rootScope, singletonBindings);
  seedMinecraftUiBindings(rootScope, file);

  const record = (
    access: ts.PropertyAccessExpression,
    operation: ScriptPropertyWrite["operation"],
    node: ts.Node,
    scope: Scope,
  ): void => {
    const receiver = receiverObject(
      inferExpressionType(access.expression, scope, functionReturns),
    );
    if (!receiver) return;

    const property = access.name.text;
    writes.push({
      receiverType: receiver,
      property,
      symbol: canonicalPropertyWriteSymbol(receiver, property),
      operation,
      source: lineSource(file, node, source),
    });
  };

  const visit = (node: ts.Node, scope: Scope): void => {
    if (ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isArrowFunction(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isGetAccessorDeclaration(node) ||
        ts.isSetAccessorDeclaration(node) ||
        ts.isConstructorDeclaration(node)) {
      const fnScope = parameterScope(scope, node.parameters);
      if (node.body) visit(node.body, fnScope);
      return;
    }

    if (ts.isBlock(node)) {
      const blockScope = childScope(scope);
      // Block declarations mask outer singleton names before type refinement.
      for (const statement of node.statements) {
        if (ts.isVariableStatement(statement)) {
          for (const declaration of statement.declarationList.declarations) {
            bindName(blockScope, declaration.name);
          }
        } else if (ts.isFunctionDeclaration(statement) && statement.name) {
          blockScope.values.set(statement.name.text, null);
        }
      }
      for (const statement of node.statements) visit(statement, blockScope);
      return;
    }

    if (ts.isCatchClause(node)) {
      const catchScope = childScope(scope);
      if (node.variableDeclaration) bindName(catchScope, node.variableDeclaration.name);
      visit(node.block, catchScope);
      return;
    }

    if (ts.isVariableDeclaration(node)) {
      const explicit = typeFromAnnotation(node.type);
      const inferred = node.initializer
        ? inferExpressionType(node.initializer, scope, functionReturns)
        : undefined;
      bindName(scope, node.name, explicit ?? inferred);
      if (node.initializer) visit(node.initializer, scope);
      return;
    }

    if (ts.isBinaryExpression(node) && ts.isPropertyAccessExpression(node.left)) {
      const operation = assignmentOperation(node.operatorToken.kind);
      if (operation) record(node.left, operation, node, scope);
    }

    if (
      (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
      (node.operator === ts.SyntaxKind.PlusPlusToken ||
        node.operator === ts.SyntaxKind.MinusMinusToken) &&
      ts.isPropertyAccessExpression(node.operand)
    ) {
      record(node.operand, "increment", node, scope);
    }

    ts.forEachChild(node, (child) => visit(child, scope));
  };

  visit(file, rootScope);

  const seen = new Set<string>();
  return writes.filter((write) => {
    const line = write.source.range?.lineStart ?? 0;
    const column = write.source.range?.columnStart ?? 0;
    const key = `${write.symbol}\0${line}\0${column}\0${write.operation}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
