import ts from "typescript";
import { directStatementSequence } from "../../core/statement-sequence.js";
import type {
  SourceRef,
  SourceSequentialSite,
} from "../../../../../packages/project-model/src/index.js";
import type {
  ScriptArenaAuthorityEvidence,
  ScriptArenaAuthorityPath,
  ScriptConstructorFieldBinding,
} from "../../core/types.js";

export interface ScriptTerminalIdempotencyEvidence {
  readonly functionRegion: string;
  readonly guardTarget: string;
  readonly kind:
    | "boolean-latch"
    | "state-latch";
  readonly source: SourceRef;
}

export interface ScriptTerminalPrecedenceEvidence {
  readonly functionRegion: string;
  readonly policyBinding: string;
  readonly policyKind:
    | "ordered-outcomes"
    | "priority-table";
  readonly outcomes: readonly string[];
  readonly source: SourceRef;
}

const MEMBERSHIP_PROPERTY =
  /^(?:members|players|participants|memberships)$/i;
const READY_PROPERTY =
  /^(?:ready|readyPlayers|readyMembers|readyParticipants)$/i;
const CAPACITY_PROPERTY =
  /^(?:maxPlayers|maxParticipants|maxMembers|max_member|max_members|capacity)$/i;
const GENERATION_PROPERTY =
  /^(?:generation|arenaGeneration|generationId)$/i;
const START_OWNER_PROPERTY =
  /^(?:startOwner|startOwnerId|startToken|startGenerationOwner)$/i;
const START_STATE_PROPERTY =
  /^(?:started|active|state|status|phase)$/i;
const START_STATE_VALUE =
  /^(?:true|starting|countdown|active|started|running)$/i;

function scriptKind(path: string): ts.ScriptKind {
  if (path.endsWith(".ts")) return ts.ScriptKind.TS;
  if (path.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (path.endsWith(".jsx")) return ts.ScriptKind.JSX;
  return ts.ScriptKind.JS;
}

function lineSource(
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

function declarationMemberName(
  node: ts.PropertyName | undefined,
): string | undefined {
  if (!node) return undefined;
  return ts.isIdentifier(node) ||
      ts.isStringLiteralLike(node)
    ? node.text
    : undefined;
}

export function localExecutionRegionId(
  node: ts.Node,
  file: ts.SourceFile,
): string {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isFunctionDeclaration(current)) {
      // Source position distinguishes same-named lexical declarations.
      return "function:" + (current.name?.text ?? "anonymous") +
        "@" + current.getStart(file);
    }
    if (ts.isMethodDeclaration(current)) {
      const name = declarationMemberName(current.name);
      if (name) {
        const parent = current.parent;
        const owner =
          ts.isClassDeclaration(parent) || ts.isClassExpression(parent)
            ? parent.name?.text ?? "anonymous-class" : "object";
        return "method:" + owner + "." + name +
          "@" + current.getStart(file);
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

function assignment(
  node: ts.Node,
):
  | {
      left: ts.Expression;
      right: ts.Expression;
      statement: ts.ExpressionStatement;
    }
  | undefined {
  if (!ts.isExpressionStatement(node)) {
    return undefined;
  }
  const expression = node.expression;
  if (
    !ts.isBinaryExpression(expression) ||
    expression.operatorToken.kind !==
      ts.SyntaxKind.EqualsToken
  ) {
    return undefined;
  }
  return {
    left: expression.left,
    right: expression.right,
    statement: node,
  };
}

function directProperty(
  expression: ts.Expression,
):
  | {
      owner: ts.Expression;
      property: string;
      text: string;
    }
  | undefined {
  if (!ts.isPropertyAccessExpression(expression)) {
    return undefined;
  }
  return {
    owner: expression.expression,
    property: expression.name.text,
    text: expression.getText(),
  };
}

function membershipCollection(
  expression: ts.Expression,
):
  | {
      arenaExpression: string;
      membershipExpression: string;
      collectionKind: "set" | "array" | "map";
    }
  | undefined {
  if (!ts.isPropertyAccessExpression(expression)) {
    return undefined;
  }
  if (!MEMBERSHIP_PROPERTY.test(expression.name.text)) {
    return undefined;
  }

  return {
    arenaExpression: expression.expression.getText(),
    membershipExpression: expression.getText(),
    collectionKind: "set",
  };
}

function membershipCommitEvidence(
  node: ts.Node,
  file: ts.SourceFile,
  source: SourceRef,
): ScriptArenaAuthorityEvidence | undefined {
  if (!ts.isExpressionStatement(node)) {
    return undefined;
  }
  const call = node.expression;
  if (
    !ts.isCallExpression(call) ||
    !ts.isPropertyAccessExpression(call.expression)
  ) {
    return undefined;
  }

  const method = call.expression.name.text;
  if (
    method !== "add" &&
    method !== "push" &&
    method !== "set"
  ) {
    return undefined;
  }

  const membership = membershipCollection(
    call.expression.expression,
  );
  if (!membership) return undefined;

  const subject = call.arguments[0];
  if (!subject) return undefined;

  return {
    kind: "membership-commit",
    arenaExpression: membership.arenaExpression,
    subjectExpression: subject.getText(file),
    membershipExpression:
      membership.membershipExpression,
    executionRegion:
      localExecutionRegionId(node, file),
    source: lineSource(file, node, source),
  };
}

/** Share the canonical direct-statement/block meaning used by the
 * main script parser. A nested conditional owns its own block; merely
 * sharing an enclosing function never establishes sequential cleanup.
 */
function authoredStatementPosition(
  statement: ts.Node,
  file: ts.SourceFile,
  source: SourceRef,
): SourceSequentialSite | undefined {
  if (!ts.isExpressionStatement(statement) || !ts.isBlock(statement.parent)) {
    return undefined;
  }
  const block = statement.parent;
  const index = block.statements.indexOf(statement);
  if (index < 0) return undefined;
  return {
    block: lineSource(file, block, source),
    statementIndex: index,
    directCall: ts.isCallExpression(statement.expression),
  };
}

function membershipReleaseEvidence(
  node: ts.Node,
  file: ts.SourceFile,
  source: SourceRef,
): ScriptArenaAuthorityEvidence | undefined {
  if (!ts.isExpressionStatement(node)) return undefined;
  const call = node.expression;
  if (
    !ts.isCallExpression(call) ||
    !ts.isPropertyAccessExpression(call.expression)
  ) {
    return undefined;
  }

  if (call.expression.name.text !== "delete") {
    return undefined;
  }

  const membership = membershipCollection(
    call.expression.expression,
  );
  if (!membership) return undefined;

  const subject = call.arguments[0];
  if (!subject) return undefined;
  const statementPosition = authoredStatementPosition(node, file, source);

  return {
    kind: "membership-release",
    arenaExpression: membership.arenaExpression,
    subjectExpression: subject.getText(file),
    membershipExpression:
      membership.membershipExpression,
    executionRegion:
      localExecutionRegionId(node, file),
    source: lineSource(file, node, source),
    ...(statementPosition === undefined ? {} : {
      sourceSequence: statementPosition,
    }),
  };
}

function generationInvalidationEvidence(
  node: ts.Node,
  file: ts.SourceFile,
  source: SourceRef,
): ScriptArenaAuthorityEvidence | undefined {
  let target: ts.Expression | undefined;

  if (
    ts.isExpressionStatement(node) &&
    ts.isBinaryExpression(node.expression) &&
    [
      ts.SyntaxKind.EqualsToken,
      ts.SyntaxKind.PlusEqualsToken,
      ts.SyntaxKind.MinusEqualsToken,
    ].includes(node.expression.operatorToken.kind)
  ) {
    target = node.expression.left;
  } else if (
    ts.isExpressionStatement(node) &&
    (
      ts.isPostfixUnaryExpression(node.expression) ||
      ts.isPrefixUnaryExpression(node.expression)
    ) &&
    (
      node.expression.operator === ts.SyntaxKind.PlusPlusToken ||
      node.expression.operator === ts.SyntaxKind.MinusMinusToken
    )
  ) {
    target = node.expression.operand;
  }

  if (!target) return undefined;
  const property = directProperty(target);
  if (
    !property ||
    !GENERATION_PROPERTY.test(property.property)
  ) {
    return undefined;
  }

  const sequence = directStatementSequence(
    node, property.owner.getText(file), file, source,
  );
  const statementPosition = authoredStatementPosition(node, file, source);
  return {
    kind: "generation-invalidate",
    arenaExpression: property.owner.getText(file),
    generationExpression: property.text,
    executionRegion:
      localExecutionRegionId(node, file),
    source: lineSource(file, node, source),
    // This assignment is a direct statement in the parent block. An
    // enclosing if/loop body has its OWN block identity and cannot be
    // silently considered sequential with statements outside that block.
    ...(sequence ? {
      sequentialBlockSource: sequence.blockSource,
      sequentialPathEvidence: sequence,
    } : {}),
    ...(statementPosition === undefined ? {} : {
      sourceSequence: statementPosition,
    }),
  };
}

function variableOperandEvidence(
  node: ts.Node,
  file: ts.SourceFile,
  source: SourceRef,
): ScriptArenaAuthorityEvidence[] {
  if (!ts.isVariableStatement(node)) return [];

  const output: ScriptArenaAuthorityEvidence[] = [];
  for (const declaration of node.declarationList.declarations) {
    if (
      !ts.isIdentifier(declaration.name) ||
      !declaration.initializer ||
      !ts.isPropertyAccessExpression(
        declaration.initializer,
      )
    ) {
      continue;
    }

    const property =
      declaration.initializer.name.text;
    const arenaExpression =
      declaration.initializer.expression.getText(file);
    const executionRegion =
      localExecutionRegionId(node, file);

    if (CAPACITY_PROPERTY.test(property)) {
      output.push({
        kind: "capacity-operand",
        arenaExpression,
        capacityExpression:
          declaration.name.text,
        executionRegion,
        source: lineSource(
          file,
          declaration,
          source,
        ),
      });
    }

    if (GENERATION_PROPERTY.test(property)) {
      output.push({
        kind: "arena-generation-operand",
        arenaExpression,
        generationExpression:
          declaration.name.text,
        executionRegion,
        source: lineSource(
          file,
          declaration,
          source,
        ),
      });
    }
  }

  return output;
}

function membershipCount(
  expression: ts.Expression,
  file: ts.SourceFile,
):
  | {
      arenaExpression: string;
      membershipExpression: string;
      countExpression: string;
    }
  | undefined {
  if (!ts.isPropertyAccessExpression(expression)) {
    return undefined;
  }
  if (
    expression.name.text !== "length" &&
    expression.name.text !== "size"
  ) {
    return undefined;
  }
  const membership = membershipCollection(
    expression.expression,
  );
  if (!membership) return undefined;

  return {
    arenaExpression: membership.arenaExpression,
    membershipExpression:
      membership.membershipExpression,
    countExpression: expression.getText(file),
  };
}

function capacityExpression(
  expression: ts.Expression,
  file: ts.SourceFile,
):
  | {
      expression: string;
      arenaExpression?: string;
    }
  | undefined {
  if (ts.isIdentifier(expression)) {
    return {
      expression: expression.text,
    };
  }
  if (
    ts.isPropertyAccessExpression(expression) &&
    CAPACITY_PROPERTY.test(expression.name.text)
  ) {
    return {
      expression: expression.getText(file),
      arenaExpression:
        expression.expression.getText(file),
    };
  }
  if (ts.isNumericLiteral(expression)) {
    return {
      expression: expression.text,
    };
  }
  return undefined;
}

/**
 * A module-scope const object literal is a numeric capacity source only
 * while the whole source keeps the object identity local and read-only.
 * Any escaping reference, shadow declaration or property mutation abstains.
 * This is selected-source authored capacity, never Minecraft runtime proof.
 */
function staticModuleCapacity(
  expression: ts.Expression,
  file: ts.SourceFile,
  source: SourceRef,
): { value: number; source: SourceRef } | undefined {
  if (!ts.isPropertyAccessExpression(expression) ||
      !ts.isIdentifier(expression.expression) ||
      !CAPACITY_PROPERTY.test(expression.name.text)) return undefined;
  const bindingName = expression.expression.text;
  const declarations = file.statements.flatMap((statement) =>
    ts.isVariableStatement(statement) &&
    // An exported const object can be mutated by an external importer.
    !statement.modifiers?.some((item) =>
      item.kind === ts.SyntaxKind.ExportKeyword ||
      item.kind === ts.SyntaxKind.DefaultKeyword
    ) &&
    (statement.declarationList.flags & ts.NodeFlags.Const) !== 0
      ? statement.declarationList.declarations.filter((declaration) =>
          ts.isIdentifier(declaration.name) &&
          declaration.name.text === bindingName
        )
      : [],
  );
  if (declarations.length !== 1) return undefined;
  const declaration = declarations[0]!;
  const initializer = declaration.initializer;
  if (!initializer || !ts.isObjectLiteralExpression(initializer) ||
      !initializer.properties.every((property) =>
        ts.isPropertyAssignment(property) &&
        (ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name))
      )) return undefined;
  const candidates = initializer.properties.filter((property) =>
    ts.isPropertyAssignment(property) &&
    (ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)) &&
    property.name.text === expression.name.text
  );
  if (candidates.length !== 1) return undefined;
  const property = candidates[0] as ts.PropertyAssignment;
  if (!ts.isNumericLiteral(property.initializer)) return undefined;
  const value = Number(property.initializer.text);
  if (!Number.isSafeInteger(value) || value < 1) return undefined;

  let stable = true;
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && node.text === bindingName) {
      if (node === declaration.name) {
        // This is the unique declaration of the object.
      } else if (ts.isPropertyAccessExpression(node.parent) &&
                 node.parent.expression === node) {
        const access = node.parent;
        const parent = access.parent;
        // Follow nested assignment targets, including destructuring.
        // Reading the scalar is fine; writing through any enclosing LHS,
        // deleting it, or dispatching a method against the object is not.
        let target: ts.Node = access;
        while (target.parent && !ts.isExpressionStatement(target.parent)) {
          const enclosing = target.parent;
          if ((ts.isBinaryExpression(enclosing) &&
               enclosing.left === target &&
               enclosing.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
               enclosing.operatorToken.kind <= ts.SyntaxKind.LastAssignment) ||
              (ts.isPrefixUnaryExpression(enclosing) &&
               (enclosing.operator === ts.SyntaxKind.PlusPlusToken ||
                enclosing.operator === ts.SyntaxKind.MinusMinusToken)) ||
              (ts.isPostfixUnaryExpression(enclosing) &&
               (enclosing.operator === ts.SyntaxKind.PlusPlusToken ||
                enclosing.operator === ts.SyntaxKind.MinusMinusToken)) ||
              (ts.isDeleteExpression(enclosing) &&
               enclosing.expression === target) ||
              (ts.isForOfStatement(enclosing) &&
               enclosing.initializer === target) ||
              (ts.isForInStatement(enclosing) &&
               enclosing.initializer === target) ||
              (ts.isCallExpression(enclosing) &&
               enclosing.expression === access)) {
            stable = false;
            break;
          }
          if (ts.isFunctionLike(enclosing) || ts.isSourceFile(enclosing)) break;
          target = enclosing;
        }
      } else {
        stable = false;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return stable ? { value, source: lineSource(file, property, source) } : undefined;
}


/**
 * Trace one closed same-file zero-argument getter into the immediately
 * guarded membership admission. A shared capacity object is authoritative
 * only when its literal value, getter, local alias, and guard have unique
 * source identities and no other references can mutate or expose them.
 * Dynamic lookup parameters, callbacks, and foreign owners remain UNKNOWN.
 */
function getterBoundModuleCapacity(
  expression: ts.Expression,
  file: ts.SourceFile,
  source: SourceRef,
): { value: number; source: SourceRef; witnesses: readonly SourceRef[] } | undefined {
  if (!ts.isPropertyAccessExpression(expression) ||
      !ts.isIdentifier(expression.expression) ||
      !CAPACITY_PROPERTY.test(expression.name.text)) return undefined;
  const aliasName = expression.expression.text;
  const comparison = expression.parent;
  if (!ts.isBinaryExpression(comparison) ||
      comparison.right !== expression ||
      comparison.operatorToken.kind !== ts.SyntaxKind.GreaterThanEqualsToken) return undefined;
  const guard = comparison.parent;
  if (!ts.isIfStatement(guard) || guard.expression !== comparison ||
      !ts.isBlock(guard.parent)) return undefined;
  const statements = guard.parent.statements;
  const guardIndex = statements.indexOf(guard);
  // A keyed lookup must reject a missing own key before the numeric
  // comparison. Otherwise inherited Object.prototype properties may
  // bypass a seemingly uniform capacity table.
  const preceding = statements[guardIndex - 1];
  const isMissingKeyGuard = preceding !== undefined &&
    ts.isIfStatement(preceding) &&
    preceding.elseStatement === undefined &&
    ts.isPrefixUnaryExpression(preceding.expression) &&
    preceding.expression.operator === ts.SyntaxKind.ExclamationToken &&
    ts.isIdentifier(preceding.expression.operand) &&
    preceding.expression.operand.text === aliasName &&
    (ts.isReturnStatement(preceding.thenStatement) ||
      (ts.isBlock(preceding.thenStatement) &&
       preceding.thenStatement.statements.length === 1 &&
       ts.isReturnStatement(preceding.thenStatement.statements[0]!)));
  const aliasStatement = statements[guardIndex - (isMissingKeyGuard ? 2 : 1)];
  if (!aliasStatement || !ts.isVariableStatement(aliasStatement) ||
      (aliasStatement.declarationList.flags & ts.NodeFlags.Const) === 0 ||
      aliasStatement.declarationList.declarations.length !== 1) return undefined;
  const alias = aliasStatement.declarationList.declarations[0]!;
  if (!ts.isIdentifier(alias.name) || alias.name.text !== aliasName ||
      !alias.initializer || !ts.isCallExpression(alias.initializer) ||
      !ts.isIdentifier(alias.initializer.expression) ||
      alias.initializer.arguments.length > 1) return undefined;
  const call = alias.initializer;
  // Narrow the saved AST node itself: checking alias.initializer.expression
  // does not preserve its type through the new const alias in strict TS.
  if (!ts.isIdentifier(call.expression)) return undefined;
  const getterName = call.expression.text;
  const getters = file.statements.filter((statement): statement is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(statement) &&
    statement.name?.text === getterName &&
    !statement.modifiers?.some((modifier) =>
      modifier.kind === ts.SyntaxKind.ExportKeyword ||
      modifier.kind === ts.SyntaxKind.DefaultKeyword ||
      modifier.kind === ts.SyntaxKind.AsyncKeyword
    )
  );
  if (getters.length !== 1) return undefined;
  const getter = getters[0]!;
  if (!getter.name || !getter.body || getter.asteriskToken ||
      getter.parameters.length > 1 || getter.body.statements.length !== 1) return undefined;
  const returned = getter.body.statements[0]!;
  if (!ts.isReturnStatement(returned) || !returned.expression) return undefined;

  // The keyed form is admitted only when the getter's unique formal key
  // indexes the module object, while its unique actual key is a property
  // of the very same arena whose roster the comparison checks.
  const keyed = getter.parameters.length === 1;
  let configReference: ts.Identifier;
  let keyDeclaration: ts.Identifier | undefined;
  let keyReference: ts.Identifier | undefined;
  let keySelectorName: ts.Identifier | undefined;
  let ownTableReference: ts.Identifier | undefined;
  let ownFormalReference: ts.Identifier | undefined;
  let ownObjectReference: ts.Identifier | undefined;
  if (keyed) {
    const result = returned.expression;
    const parameter = getter.parameters[0]!;
    const actual = call.arguments[0];
    const membership = membershipCount(comparison.left, file);
    // An own-key check makes the indexed path total over only the
    // explicitly authored table entries. Requiring void 0 as fallback
    // avoids a shadowable variable named "undefined".
    if (!isMissingKeyGuard ||
        !ts.isConditionalExpression(result) ||
        !ts.isCallExpression(result.condition) ||
        !ts.isPropertyAccessExpression(result.condition.expression) ||
        !ts.isIdentifier(result.condition.expression.expression) ||
        result.condition.expression.expression.text !== "Object" ||
        result.condition.expression.name.text !== "hasOwn" ||
        result.condition.arguments.length !== 2 ||
        !result.condition.arguments[0] ||
        !ts.isIdentifier(result.condition.arguments[0]) ||
        !result.condition.arguments[1] ||
        !ts.isIdentifier(result.condition.arguments[1]) ||
        !ts.isElementAccessExpression(result.whenTrue) ||
        !ts.isIdentifier(result.whenTrue.expression) ||
        !result.whenTrue.argumentExpression ||
        !ts.isIdentifier(result.whenTrue.argumentExpression) ||
        !ts.isVoidExpression(result.whenFalse) ||
        !ts.isNumericLiteral(result.whenFalse.expression) ||
        result.whenFalse.expression.text !== "0" ||
        !ts.isIdentifier(parameter.name) ||
        parameter.initializer || parameter.dotDotDotToken ||
        result.condition.arguments[0].text !== result.whenTrue.expression.text ||
        result.condition.arguments[1].text !== parameter.name.text ||
        result.whenTrue.argumentExpression.text !== parameter.name.text ||
        !actual || !ts.isPropertyAccessExpression(actual) ||
        !ts.isIdentifier(actual.name) ||
        !/^(?:id|arenaId|configId|configKey)$/.test(actual.name.text) ||
        !membership ||
        actual.expression.getText(file) !== membership.arenaExpression) return undefined;
    configReference = result.whenTrue.expression;
    keyDeclaration = parameter.name;
    keyReference = result.whenTrue.argumentExpression;
    ownTableReference = result.condition.arguments[0];
    ownFormalReference = result.condition.arguments[1];
    ownObjectReference = result.condition.expression.expression;
    // Property names are AST identifiers too, not free references
    // to the getter's lexical formal argument.
    keySelectorName = actual.name;
  } else {
    if (isMissingKeyGuard || call.arguments.length !== 0 ||
        !ts.isIdentifier(returned.expression)) return undefined;
    configReference = returned.expression;
  }
  const configName = configReference.text;
  const owners = file.statements.flatMap((statement) =>
    ts.isVariableStatement(statement) &&
    !statement.modifiers?.some((modifier) =>
      modifier.kind === ts.SyntaxKind.ExportKeyword ||
      modifier.kind === ts.SyntaxKind.DefaultKeyword
    ) &&
    (statement.declarationList.flags & ts.NodeFlags.Const) !== 0
      ? statement.declarationList.declarations.filter((declaration) =>
          ts.isIdentifier(declaration.name) && declaration.name.text === configName
        )
      : []
  );
  if (owners.length !== 1) return undefined;
  const config = owners[0]!;
  if (!ts.isIdentifier(config.name) || !config.initializer ||
      !ts.isObjectLiteralExpression(config.initializer)) return undefined;
  const object = config.initializer;
  // All evaluated fields must be scalar literals. No spread, computed
  // key, getter, helper call, or late property override is authoritative.
  const scalarFields = (fields: ts.NodeArray<ts.ObjectLiteralElementLike>): boolean =>
    fields.every((property) =>
      ts.isPropertyAssignment(property) &&
      (ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)) &&
      (ts.isNumericLiteral(property.initializer) ||
       ts.isStringLiteralLike(property.initializer) ||
       property.initializer.kind === ts.SyntaxKind.TrueKeyword ||
       property.initializer.kind === ts.SyntaxKind.FalseKeyword ||
       property.initializer.kind === ts.SyntaxKind.NullKeyword)
    );
  const capFields = (fields: ts.NodeArray<ts.ObjectLiteralElementLike>) =>
    fields.filter((property): property is ts.PropertyAssignment =>
      ts.isPropertyAssignment(property) &&
      (ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)) &&
      property.name.text === expression.name.text
    );
  const capacityProperties: ts.PropertyAssignment[] = [];
  const sourceEntries: SourceRef[] = [];
  if (keyed) {
    const keys = new Set<string>();
    if (object.properties.length === 0) return undefined;
    for (const entry of object.properties) {
      if (!ts.isPropertyAssignment(entry) ||
          !(ts.isIdentifier(entry.name) ||
            ts.isStringLiteralLike(entry.name) ||
            ts.isNumericLiteral(entry.name)) ||
          entry.name.text === "__proto__" ||
          keys.has(entry.name.text) ||
          !ts.isObjectLiteralExpression(entry.initializer) ||
          !scalarFields(entry.initializer.properties)) return undefined;
      keys.add(entry.name.text);
      const members = capFields(entry.initializer.properties);
      if (members.length !== 1 ||
          !ts.isNumericLiteral(members[0]!.initializer)) return undefined;
      capacityProperties.push(members[0]!);
      sourceEntries.push(lineSource(file, entry, source));
    }
  } else {
    if (!scalarFields(object.properties)) return undefined;
    const members = capFields(object.properties);
    if (members.length !== 1 ||
        !ts.isNumericLiteral(members[0]!.initializer)) return undefined;
    capacityProperties.push(members[0]!);
  }
  const values = capacityProperties.map((property) =>
    Number((property.initializer as ts.NumericLiteral).text));
  if (values.length === 0 ||
      values.some((value) => !Number.isSafeInteger(value) || value <= 0) ||
      new Set(values).size !== 1) return undefined;
  const value = values[0]!;

  // Require the complete file to reference each identity only at its
  // declaration and at the exact next link in the proven path.
  const onlyReferences = (name: string, allowed: readonly ts.Identifier[]): boolean => {
    let valid = true;
    const visit = (node: ts.Node): void => {
      if (ts.isIdentifier(node) && node.text === name &&
          !allowed.includes(node)) valid = false;
      ts.forEachChild(node, visit);
    };
    visit(file);
    return valid;
  };
  if (!onlyReferences(configName, [
        config.name, configReference,
        ...(ownTableReference ? [ownTableReference] : []),
      ]) ||
      !onlyReferences(getterName, [getter.name, call.expression]) ||
      !onlyReferences(aliasName, [
        alias.name, expression.expression,
        ...(isMissingKeyGuard ? [
          (preceding as ts.IfStatement).expression,
        ].flatMap((node) =>
          ts.isPrefixUnaryExpression(node) &&
          ts.isIdentifier(node.operand) ? [node.operand] : []) : []),
      ])) return undefined;
  if (keyed &&
      (!keyDeclaration || !keyReference || !ownFormalReference ||
       !ownObjectReference ||
       !onlyReferences("Object", [ownObjectReference]) ||
       !onlyReferences(keyDeclaration.text, [
         keyDeclaration, keyReference, ownFormalReference,
         ...(keySelectorName ? [keySelectorName] : []),
       ])))
    return undefined;

  return {
    value,
    source: lineSource(file, capacityProperties[0]!, source),
    witnesses: [
      lineSource(file, object, source),
      ...sourceEntries,
      ...capacityProperties.slice(1).map((property) =>
        lineSource(file, property, source)),
      lineSource(file, getter, source),
      lineSource(file, aliasStatement, source),
      ...(keyed ? [
        lineSource(file, returned.expression!, source),
        lineSource(file, (preceding as ts.IfStatement), source),
        lineSource(file, call.arguments[0]!, source),
      ] : []),
    ],
  };
}

/**
 * Bounded constructor-to-instance evidence: only a non-exported top-level
 * class, with canonical constructor-field forwarding and entirely visible,
 * const-bound literal instances can supply a numeric source value.
 * Unknown factory arguments, escaping instances, shadowed classes and
 * conflicting configurations remain unresolved, not zero or PASS.
 */
function staticConstructorCapacity(
  expression: ts.Expression,
  file: ts.SourceFile,
  source: SourceRef,
  fieldBindings: readonly ScriptConstructorFieldBinding[],
): { value: number; source: SourceRef; witnesses: readonly SourceRef[] } | undefined {
  if (!ts.isPropertyAccessExpression(expression) ||
      !CAPACITY_PROPERTY.test(expression.name.text) ||
      !ts.isPropertyAccessExpression(expression.expression) ||
      expression.expression.expression.kind !== ts.SyntaxKind.ThisKeyword) return undefined;
  const fieldName = expression.expression.name.text;
  let scope: ts.Node | undefined = expression.parent;
  while (scope && !ts.isMethodDeclaration(scope)) {
    if (ts.isFunctionLike(scope) || ts.isClassLike(scope)) return undefined;
    scope = scope.parent;
  }
  if (!scope || !ts.isMethodDeclaration(scope) ||
      !ts.isClassDeclaration(scope.parent) ||
      scope.parent.parent !== file ||
      !scope.parent.name ||
      scope.parent.modifiers?.some((modifier) =>
        modifier.kind === ts.SyntaxKind.ExportKeyword ||
        modifier.kind === ts.SyntaxKind.DefaultKeyword
      )) return undefined;
  const cls = scope.parent;
  // An inherited method may mutate the capacity field out of sight.
  if (cls.heritageClauses?.length) return undefined;
  const name = cls.name!.text;
  const fields = fieldBindings.filter((binding) =>
    binding.className === name &&
    binding.fieldName === fieldName &&
    binding.source.artifactId === source.artifactId &&
    binding.source.relativePath === source.relativePath
  );
  if (fields.length !== 1) return undefined;
  const binding = fields[0]!;
  const ctors = cls.members.filter(ts.isConstructorDeclaration);
  if (ctors.length !== 1) return undefined;
  const ctor = ctors[0]!;
  const param = ctor.parameters[binding.parameterIndex];
  if (!param || !ts.isIdentifier(param.name) ||
      param.initializer || param.dotDotDotToken) return undefined;
  const formalName = param.name.text;
  let formalReferences = 0;
  const countFormal = (node: ts.Node): void => {
    // TypeScript's AST represents the name of this.definition as an
    // Identifier too. A field named like the constructor parameter is
    // not an additional lexical reference to the parameter.
    if (ts.isIdentifier(node) && node.text === formalName &&
        !(ts.isPropertyAccessExpression(node.parent) &&
          node.parent.name === node) &&
        !(ts.isPropertyAssignment(node.parent) &&
          node.parent.name === node)) formalReferences++;
    ts.forEachChild(node, countFormal);
  };
  countFormal(ctor);
  // One declaration and one direct field write; no mutable config alias.
  if (formalReferences !== 2) return undefined;

  // This field can only be set by the exact constructor binding.
  let fieldUseSafe = true;
  const scanClass = (node: ts.Node): void => {
    if (ts.isElementAccessExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ThisKeyword) {
      fieldUseSafe = false;
    }
    if (node.kind === ts.SyntaxKind.ThisKeyword) {
      const parent = node.parent;
      if (ts.isCallExpression(parent) ||
          ts.isReturnStatement(parent) ||
          ts.isVariableDeclaration(parent) ||
          ts.isArrayLiteralExpression(parent) ||
          ts.isPropertyAssignment(parent)) fieldUseSafe = false;
    }
    if (ts.isPropertyAccessExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ThisKeyword &&
        node.name.text === fieldName) {
      const site = lineSource(file, node.parent, source).range;
      const assignment = ts.isBinaryExpression(node.parent) &&
        node.parent.left === node &&
        node.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken;
      const constructorWrite = assignment &&
        node.parent.parent &&
        node.parent.parent.parent === ctor.body &&
        site?.lineStart === binding.source.range?.lineStart &&
        site?.columnStart === binding.source.range?.columnStart;
      if (!constructorWrite) {
        // Reading this.field.foo is safe only when it is an ordinary
        // property read. Passing out the entire field or writing it is not.
        const parent = node.parent;
        if (!ts.isPropertyAccessExpression(parent) ||
            parent.expression !== node) fieldUseSafe = false;
        else {
          let current: ts.Node = parent;
          while (current.parent && !ts.isFunctionLike(current.parent)) {
            const ancestor = current.parent;
            if ((ts.isBinaryExpression(ancestor) &&
                 ancestor.left === current &&
                 ancestor.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
                 ancestor.operatorToken.kind <= ts.SyntaxKind.LastAssignment) ||
                (ts.isDeleteExpression(ancestor) && ancestor.expression === current) ||
                ((ts.isPrefixUnaryExpression(ancestor) ||
                  ts.isPostfixUnaryExpression(ancestor)) &&
                 ancestor.operand === current) ||
                (ts.isCallExpression(ancestor) &&
                 ancestor.expression === current)) fieldUseSafe = false;
            current = ancestor;
          }
        }
      }
    }
    ts.forEachChild(node,scanClass);
  };
  if (cls.members.length === 0) return undefined;
  for (const member of cls.members) scanClass(member);
  if (!fieldUseSafe) return undefined;

  const instances: Array<{ value:number; source:SourceRef; call:SourceRef }> = [];
  const instanceNames = new Set<string>();
  let valid = true;
  const scanFile = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && node.text === name &&
        node !== cls.name &&
        !(ts.isNewExpression(node.parent) && node.parent.expression === node)) {
      valid = false;
    }
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) &&
        node.expression.text === name) {
      const declaration = node.parent;
      if (!ts.isVariableDeclaration(declaration) ||
          declaration.initializer !== node ||
          !ts.isIdentifier(declaration.name) ||
          !ts.isVariableDeclarationList(declaration.parent) ||
          (declaration.parent.flags & ts.NodeFlags.Const) === 0 ||
          !ts.isVariableStatement(declaration.parent.parent) ||
          declaration.parent.parent.modifiers?.some((modifier) =>
            modifier.kind === ts.SyntaxKind.ExportKeyword
          )) {
        valid=false;
      } else {
        instanceNames.add(declaration.name.text);
      }
      const arg = node.arguments?.[binding.parameterIndex];
      if (!arg || !ts.isObjectLiteralExpression(arg)) {
        valid=false;
      } else {
        const properties = arg.properties.filter((item) =>
          ts.isPropertyAssignment(item) &&
          (ts.isIdentifier(item.name) || ts.isStringLiteralLike(item.name)) &&
          item.name.text === expression.name.text
        );
        const property = properties[0];
        if (properties.length !== 1 ||
            !property || !ts.isPropertyAssignment(property) ||
            !ts.isNumericLiteral(property.initializer) ||
            // Computed keys can overwrite maxPlayers at runtime, even
            // when an earlier literal numeric property appears canonical.
            !arg.properties.every((candidate) =>
              ts.isPropertyAssignment(candidate) &&
              (ts.isIdentifier(candidate.name) ||
                ts.isStringLiteralLike(candidate.name)))) {
          valid=false;
        } else {
          const value=Number(property.initializer.text);
          if (!Number.isSafeInteger(value) || value < 1) valid=false;
          else instances.push({
            value,
            source:lineSource(file,property,source),
            call:lineSource(file,node,source),
          });
        }
      }
    }
    ts.forEachChild(node,scanFile);
  };
  scanFile(file);
  if (!valid || instances.length===0 ||
      new Set(instances.map((entry)=>entry.value)).size!==1) return undefined;
  const onlyMethods = new Set(cls.members
    .filter(ts.isMethodDeclaration)
    .map((method)=>declarationMemberName(method.name))
    .filter((item): item is string => item !== undefined));
  const scanInstances=(node:ts.Node):void=>{
    if (ts.isIdentifier(node) && instanceNames.has(node.text)) {
      const parent=node.parent;
      if (ts.isVariableDeclaration(parent) && parent.name===node) {
        // Original const instance declaration.
      } else if (ts.isPropertyAccessExpression(parent) &&
                 parent.expression===node &&
                 onlyMethods.has(parent.name.text) &&
                 ts.isCallExpression(parent.parent) &&
                 parent.parent.expression===parent) {
        // Invocation of an inspected class method; object does not escape.
      } else valid=false;
    }
    ts.forEachChild(node,scanInstances);
  };
  scanInstances(file);
  if (!valid) return undefined;
  const first = instances[0]!;
  return {
    value:first.value,
    source:first.source,
    witnesses: [
      binding.source,
      ...instances.flatMap((item, index) =>
        index === 0 ? [item.call] : [item.source, item.call]
      ),
    ],
  };
}


/**
 * Source-only uniform capacity carried through an array generator and a
 * constructor parameter. This is deliberately a closed, same-file AST
 * witness, not a numeric guess from a property name or a recovery check.
 * Dynamic factories, escaped generated elements, writes and mixed values
 * stay unresolved.
 */
function mappedConstructorCapacity(
  expression: ts.Expression,
  file: ts.SourceFile,
  source: SourceRef,
  fieldBindings: readonly ScriptConstructorFieldBinding[],
): { value: number; source: SourceRef; witnesses: readonly SourceRef[] } | undefined {
  if (!ts.isPropertyAccessExpression(expression) ||
      !CAPACITY_PROPERTY.test(expression.name.text) ||
      !ts.isPropertyAccessExpression(expression.expression) ||
      expression.expression.expression.kind !== ts.SyntaxKind.ThisKeyword) return undefined;
  const fieldName = expression.expression.name.text;
  let method: ts.Node | undefined = expression.parent;
  while (method && !ts.isMethodDeclaration(method)) {
    if (ts.isFunctionLike(method) || ts.isClassLike(method)) return undefined;
    method = method.parent;
  }
  if (!method || !ts.isMethodDeclaration(method) ||
      !ts.isClassExpression(method.parent)) return undefined;
  const cls = method.parent;
  const declaration = cls.parent;
  if (!ts.isVariableDeclaration(declaration) ||
      !ts.isIdentifier(declaration.name) ||
      !ts.isVariableDeclarationList(declaration.parent) ||
      !ts.isVariableStatement(declaration.parent.parent) ||
      declaration.parent.parent.parent !== file ||
      declaration.parent.parent.modifiers?.some((modifier) =>
        modifier.kind === ts.SyntaxKind.ExportKeyword ||
        modifier.kind === ts.SyntaxKind.DefaultKeyword
      ) ||
      cls.heritageClauses?.length) return undefined;
  const className = declaration.name.text;
  // A mutable class binding is not unique instance identity.
  if (declaration.initializer !== cls) return undefined;
  const fields = fieldBindings.filter((binding) =>
    binding.className === className &&
    binding.fieldName === fieldName &&
    binding.source.artifactId === source.artifactId &&
    binding.source.relativePath === source.relativePath
  );
  if (fields.length !== 1) return undefined;
  const binding = fields[0]!;
  const constructors = cls.members.filter(ts.isConstructorDeclaration);
  if (constructors.length !== 1) return undefined;
  const ctor = constructors[0]!;
  const parameter = ctor.parameters[binding.parameterIndex];
  if (!parameter || !ts.isIdentifier(parameter.name) ||
      parameter.initializer || parameter.dotDotDotToken) return undefined;
  const formalName = parameter.name.text;
  let formalReferences = 0;
  let fieldAccesses = 0;
  let fieldStable = true;
  const scanClass = (node: ts.Node): void => {
    if (node.kind === ts.SyntaxKind.ThisKeyword) {
      const parent = node.parent;
      if (ts.isCallExpression(parent) ||
          ts.isReturnStatement(parent) ||
          ts.isVariableDeclaration(parent) ||
          ts.isArrayLiteralExpression(parent) ||
          ts.isPropertyAssignment(parent)) fieldStable = false;
    }
    if (ts.isElementAccessExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ThisKeyword)
      fieldStable = false;
    if (ts.isIdentifier(node) && node.text === formalName &&
        node.pos >= ctor.pos && node.end <= ctor.end &&
        !(ts.isPropertyAccessExpression(node.parent) &&
          node.parent.name === node) &&
        !(ts.isPropertyAssignment(node.parent) &&
          node.parent.name === node)) formalReferences++;
    if (ts.isPropertyAccessExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ThisKeyword &&
        node.name.text === fieldName) {
      fieldAccesses++;
      const p = node.parent;
      const constructorWrite =
        ts.isBinaryExpression(p) &&
        p.left === node &&
        p.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        p.right.getText(file) === formalName &&
        p.parent.parent === ctor.body;
      const capacityRead = node === expression.expression &&
        ts.isPropertyAccessExpression(p) && p.expression === node;
      if (!constructorWrite && !capacityRead) fieldStable = false;
    }
    if (ts.isElementAccessExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ThisKeyword) fieldStable = false;
    ts.forEachChild(node, scanClass);
  };
  scanClass(cls);
  if (!fieldStable || fieldAccesses !== 2 || formalReferences !== 2) return undefined;

  // A module-local const array of literal IDs is equivalent to a direct
  // array literal only if the exact declaration and this .map() receiver
  // are its ONLY uses. This prevents aliasing, later mutation, exporting,
  // shadowed bindings, and dynamic elements from granting numeric proof.
  const mapInputArray = (receiver: ts.Expression): {
    array: ts.ArrayLiteralExpression;
    inputSource?: SourceRef;
  } | undefined => {
    if (ts.isArrayLiteralExpression(receiver)) return { array: receiver };
    if (!ts.isIdentifier(receiver)) return undefined;
    const name = receiver.text;
    const owners = file.statements.flatMap((statement) =>
      ts.isVariableStatement(statement) &&
      !statement.modifiers?.some((modifier) =>
        modifier.kind === ts.SyntaxKind.ExportKeyword ||
        modifier.kind === ts.SyntaxKind.DefaultKeyword
      ) &&
      (statement.declarationList.flags & ts.NodeFlags.Const) !== 0
        ? statement.declarationList.declarations.filter((item) =>
            ts.isIdentifier(item.name) && item.name.text === name
          )
        : []
    );
    if (owners.length !== 1) return undefined;
    const owner = owners[0]!;
    if (!owner.initializer ||
        !ts.isArrayLiteralExpression(owner.initializer) ||
        !owner.initializer.elements.every((element) =>
          ts.isNumericLiteral(element) || ts.isStringLiteralLike(element)
        )) return undefined;
    let references = 0;
    let stable = true;
    const scan = (node: ts.Node): void => {
      if (ts.isIdentifier(node) && node.text === name) {
        if (node === owner.name || node === receiver) references++;
        else stable = false;
      }
      ts.forEachChild(node, scan);
    };
    scan(file);
    if (!stable || references !== 2) return undefined;
    return {
      array: owner.initializer,
      inputSource: lineSource(file, owner.initializer, source),
    };
  };
  // Source-only numeric capacity must not borrow a value from an
  // initializer whose evaluation can perform an unknown mutation. Such
  // code may rewrite previously generated config objects during .map().
  const unknownEvaluationEffects = (expression: ts.Node): boolean => {
    let unsafe = false;
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) ||
          ts.isNewExpression(node) ||
          ts.isTaggedTemplateExpression(node) ||
          ts.isAwaitExpression(node) ||
          ts.isYieldExpression(node) ||
          ts.isDeleteExpression(node) ||
          ts.isPropertyAccessExpression(node) ||
          ts.isElementAccessExpression(node) ||
          (ts.isBinaryExpression(node) &&
           node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
           node.operatorToken.kind <= ts.SyntaxKind.LastAssignment) ||
          ((ts.isPrefixUnaryExpression(node) ||
            ts.isPostfixUnaryExpression(node)) &&
           (node.operator === ts.SyntaxKind.PlusPlusToken ||
            node.operator === ts.SyntaxKind.MinusMinusToken))) {
        unsafe = true;
      }
      ts.forEachChild(node, visit);
    };
    visit(expression);
    return unsafe;
  };
  // A definite object literal with one unshadowed capacity key must be
  // produced for every member of the proven input array.
  const generators = new Map<string, {
    value: number;
    property: SourceRef;
    generator: SourceRef;
    inputSource?: SourceRef;
    elementCount: number;
  }>();
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement) ||
        // An importer can mutate an exported collection or its elements.
        // This source has no closed same-file identity authority.
        statement.modifiers?.some((modifier) =>
          modifier.kind === ts.SyntaxKind.ExportKeyword ||
          modifier.kind === ts.SyntaxKind.DefaultKeyword)) continue;
    for (const d of statement.declarationList.declarations) {
      if (!ts.isIdentifier(d.name) || !d.initializer ||
          !ts.isCallExpression(d.initializer) ||
          !ts.isPropertyAccessExpression(d.initializer.expression) ||
          d.initializer.expression.name.text !== "map" ||
          // The optional thisArg is evaluated before map() executes and
          // can change the source configuration. Do not silently ignore it.
          d.initializer.arguments.length !== 1) continue;
      const input = mapInputArray(d.initializer.expression.expression);
      if (!input) continue;
      const cb = d.initializer.arguments[0];
      if (!cb || !ts.isArrowFunction(cb) ||
          // Async callbacks return Promise<config>, never the object
          // consumed synchronously by new Class(configs[index]).
          cb.modifiers?.some((modifier) =>
            modifier.kind === ts.SyntaxKind.AsyncKeyword)) continue;
      // A single top-level return is not enough: nested if/switch/try
      // branches can return a different config or throw before it.
      // Until full path-sensitive return proof exists, only a callback
      // whose body is exactly one unconditional return is admitted.
      const result = ts.isBlock(cb.body)
        ? (cb.body.statements.length === 1 &&
           ts.isReturnStatement(cb.body.statements[0]!)
            ? cb.body.statements[0]!.expression : undefined)
        : cb.body;
      if (!result) continue;
      const returned = ts.isParenthesizedExpression(result)
        ? result.expression : result;
      if (!ts.isObjectLiteralExpression(returned) ||
          // Computed names can evaluate to the same numeric capacity key
          // (e.g. {maxPlayers:5, ["maxPlayers"]:9}). Unknown keys must
          // not be promoted as uniform authored configuration.
          !returned.properties.every((p) =>
            (ts.isPropertyAssignment(p) ||
              ts.isShorthandPropertyAssignment(p)) &&
            (ts.isIdentifier(p.name) ||
              ts.isStringLiteralLike(p.name)) &&
            (!ts.isPropertyAssignment(p) ||
              !unknownEvaluationEffects(p.initializer)))) continue;
      // A shorthand of the same capacity key is also a duplicate and
      // prevents inferring that the numeric property is authoritative.
      const props = returned.properties.filter((p) =>
        (ts.isPropertyAssignment(p) ||
         ts.isShorthandPropertyAssignment(p)) &&
        (ts.isIdentifier(p.name) || ts.isStringLiteralLike(p.name)) &&
        p.name.text === expression.name.text
      );
      if (props.length !== 1 || !ts.isPropertyAssignment(props[0]!) ||
          !ts.isNumericLiteral(props[0]!.initializer)) continue;
      const value = Number(props[0]!.initializer.text);
      if (Number.isSafeInteger(value) && value > 0 &&
          input.array.elements.length > 0 &&
          input.array.elements.every((element) =>
            !ts.isOmittedExpression(element) &&
            !ts.isSpreadElement(element)))
        generators.set(d.name.text, {
          value,
          property: lineSource(file, props[0]!, source),
          generator: lineSource(file, d.initializer, source),
          ...(input.inputSource ? { inputSource: input.inputSource } : {}),
          elementCount: input.array.elements.length,
        });
    }
  }
  if (generators.size === 0) return undefined;
  // Only exact one-source generator identities can support an instance cap.
  // Ambiguous or rebound class/collection identifiers are not adopted.
  const seenBindings = new Map<string, number>();
  const scanBindings = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      seenBindings.set(node.name.text,
        (seenBindings.get(node.name.text) ?? 0) + 1);
    }
    ts.forEachChild(node, scanBindings);
  };
  scanBindings(file);
  if (seenBindings.get(className) !== 1) return undefined;
  let valid = true;
  const allocations: SourceRef[] = [];
  const directInstanceNames = new Set<string>();
  // If a mapped allocation is stored in a module-local collection, the
  // collection's later uses must not expose or mutate its instances.
  const mappedInstanceCollections = new Set<string>();
  let generatorName: string | undefined;
  const stableElement = (argument: ts.Expression, callbackName?: string):
    string | undefined => {
    if (callbackName !== undefined &&
        ts.isIdentifier(argument) && argument.text === callbackName)
      return generatorName;
    if (ts.isElementAccessExpression(argument) &&
        ts.isIdentifier(argument.expression) &&
        argument.argumentExpression &&
        ts.isNumericLiteral(argument.argumentExpression)) {
      const generator = generators.get(argument.expression.text);
      const index = Number(argument.argumentExpression.text);
      if (generator && Number.isSafeInteger(index) &&
          index >= 0 && index < generator.elementCount)
        return argument.expression.text;
    }
    return undefined;
  };
  const walkAllocations = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && node.text === className &&
        node !== declaration.name &&
        !(ts.isNewExpression(node.parent) && node.parent.expression === node))
      valid = false;
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) &&
        node.expression.text === className) {
      const argument = node.arguments?.[binding.parameterIndex];
      // Additional constructor arguments are evaluated before the
      // constructor receives its configuration and may mutate shared
      // source state. No numeric proof without a closed argument list.
      if (!argument || node.arguments?.length !== 1) {
        valid = false; return;
      }
      let sourceName: string | undefined;
      if (ts.isArrowFunction(node.parent) &&
          // Async allocation returns Promise<instance>, not an
          // immediately owned class instance in the mapped collection.
          !node.parent.modifiers?.some((modifier) =>
            modifier.kind === ts.SyntaxKind.AsyncKeyword) &&
          ts.isCallExpression(node.parent.parent) &&
          ts.isPropertyAccessExpression(node.parent.parent.expression) &&
          node.parent.parent.expression.name.text === "map" &&
          node.parent.parent.arguments.length === 1 &&
          node.parent.parent.arguments[0] === node.parent &&
          ts.isIdentifier(node.parent.parent.expression.expression) &&
          node.parent.parameters.length === 1 &&
          ts.isIdentifier(node.parent.parameters[0]!.name) &&
          node.parent.body === node &&
          ts.isIdentifier(argument) &&
          argument.text === node.parent.parameters[0]!.name.text) {
        sourceName = node.parent.parent.expression.expression.text;
        const mapCall = node.parent.parent;
        const receiver = mapCall.parent;
        if (ts.isVariableDeclaration(receiver) &&
            receiver.initializer === mapCall &&
            ts.isIdentifier(receiver.name) &&
            ts.isVariableDeclarationList(receiver.parent) &&
            (receiver.parent.flags & ts.NodeFlags.Const) !== 0 &&
            ts.isVariableStatement(receiver.parent.parent) &&
            !receiver.parent.parent.modifiers?.some((modifier) =>
              modifier.kind === ts.SyntaxKind.ExportKeyword ||
              modifier.kind === ts.SyntaxKind.DefaultKeyword)) {
          mappedInstanceCollections.add(receiver.name.text);
        } else {
          // A class-field initializer does not prove who owns the resulting
          // instances. Even an unexported class can later expose, mutate or
          // replace this.field[i].definition through a class instance.
          // Do not borrow numeric authority until field-owner provenance
          // and all consumers are traced with the same strictness as const.
          // Unknown consumers and forwarded map results fail closed too.
          valid = false;
        }
      } else {
        // Direct literal-index instance allocations are supported only
        // when a const owns the object; forwarding an instance to an
        // unknown constructor/function would lose mutation authority.
        const parent = node.parent;
        const owned = ts.isVariableDeclaration(parent) &&
          parent.initializer === node &&
          ts.isVariableDeclarationList(parent.parent) &&
          (parent.parent.flags & ts.NodeFlags.Const) !== 0;
        if (owned) {
          sourceName = stableElement(argument);
          if (sourceName && ts.isIdentifier(parent.name))
            directInstanceNames.add(parent.name.text);
        }
      }
      if (!sourceName || !generators.has(sourceName) ||
          (generatorName !== undefined && generatorName !== sourceName))
        valid = false;
      else {
        generatorName = sourceName;
        allocations.push(lineSource(file, node, source));
      }
    }
    ts.forEachChild(node, walkAllocations);
  };
  walkAllocations(file);
  if (!valid || allocations.length === 0 || !generatorName) return undefined;
  const gen = generators.get(generatorName)!;
  if (seenBindings.get(generatorName) !== 1) return undefined;
  // No authored mutable write to the numeric field may override
  // the generator value (including writes through other receivers).
  const visitWrites = (node: ts.Node): void => {
    const capacityProperty = ts.isPropertyAccessExpression(node) &&
      node.name.text === expression.name.text;
    const capacityField = ts.isPropertyAccessExpression(node) &&
      node.name.text === fieldName;
    // A computed write to an unrelated collection is not evidence that
    // this constructor configuration changed. Limit dynamic keys to this
    // or a directly owned Party instance; exact string field keys match
    // independently of the receiver.
    const computedField = ts.isElementAccessExpression(node) &&
      ((node.argumentExpression !== undefined &&
        ts.isStringLiteralLike(node.argumentExpression) &&
        node.argumentExpression.text === fieldName) ||
       ((node.argumentExpression === undefined ||
         !ts.isStringLiteralLike(node.argumentExpression)) &&
        (node.expression.kind === ts.SyntaxKind.ThisKeyword ||
         (ts.isIdentifier(node.expression) &&
          directInstanceNames.has(node.expression.text)))));
    if (capacityProperty || capacityField || computedField) {
      const parent = node.parent;
      const assigned = ts.isBinaryExpression(parent) && parent.left === node &&
        parent.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
        parent.operatorToken.kind <= ts.SyntaxKind.LastAssignment;
      const overwritten = assigned ||
        ((ts.isPrefixUnaryExpression(parent) ||
          ts.isPostfixUnaryExpression(parent)) && parent.operand === node) ||
        (ts.isDeleteExpression(parent) && parent.expression === node);
      const exactConstructorWrite = assigned && capacityField &&
        ts.isPropertyAccessExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ThisKeyword &&
        parent.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isIdentifier(parent.right) && parent.right.text === formalName &&
        parent.parent.parent === ctor.body;
      if (overwritten && !exactConstructorWrite) valid = false;
      // Passing the configuration field to an unknown caller, returning
      // or rebinding it elsewhere loses its value/identity authority.
      if (capacityField && !exactConstructorWrite &&
          (ts.isVariableDeclaration(parent) ||
           ts.isReturnStatement(parent) ||
           ts.isCallExpression(parent) ||
           ts.isArrayLiteralExpression(parent) ||
           ts.isPropertyAssignment(parent)))
        valid = false;
    }
    ts.forEachChild(node, visitWrites);
  };
  visitWrites(file);
  if (!valid) return undefined;

  // A const-bound direct instance has to remain locally owned. Tracking
  // its configuration writes is insufficient when the entire instance can
  // escape through a call, return, assignment or an unknown method.
  const classMethods = new Set(
    cls.members.filter(ts.isMethodDeclaration)
      .map((member) => declarationMemberName(member.name))
      .filter((name): name is string => name !== undefined),
  );
  for (const name of directInstanceNames) {
    if (seenBindings.get(name) !== 1) valid = false;
  }
  for (const name of mappedInstanceCollections) {
    if (seenBindings.get(name) !== 1) valid = false;
  }
  const scanMappedInstanceCollections = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && mappedInstanceCollections.has(node.text)) {
      const parent = node.parent;
      if (ts.isVariableDeclaration(parent) && parent.name === node) {
        // Original const binding to the mapped instance collection.
      } else if (ts.isElementAccessExpression(parent) &&
                 parent.expression === node &&
                 parent.argumentExpression &&
                 ts.isNumericLiteral(parent.argumentExpression) &&
                 Number.isSafeInteger(Number(parent.argumentExpression.text)) &&
                 Number(parent.argumentExpression.text) >= 0 &&
                 Number(parent.argumentExpression.text) < gen.elementCount &&
                 ts.isPropertyAccessExpression(parent.parent) &&
                 parent.parent.expression === parent &&
                 classMethods.has(parent.parent.name.text) &&
                 ts.isCallExpression(parent.parent.parent) &&
                 parent.parent.parent.expression === parent.parent) {
        // Only direct calls to an inspected class method on a valid slot.
        // Field reads, aliases, writes and external calls remain unknown.
      } else {
        valid = false;
      }
    }
    ts.forEachChild(node, scanMappedInstanceCollections);
  };
  scanMappedInstanceCollections(file);
  if (!valid) return undefined;
  const scanDirectInstances = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && directInstanceNames.has(node.text)) {
      const parent = node.parent;
      if (ts.isVariableDeclaration(parent) && parent.name === node) {
        // The original const owner: const party = new Party(configs[0]).
      } else if (ts.isPropertyAccessExpression(parent) &&
                 parent.expression === node &&
                 classMethods.has(parent.name.text) &&
                 ts.isCallExpression(parent.parent) &&
                 parent.parent.expression === parent) {
        // Invocation of an inspected method does not expose the instance.
      } else {
        valid = false;
      }
    }
    ts.forEachChild(node, scanDirectInstances);
  };
  scanDirectInstances(file);
  if (!valid) return undefined;

  // The generated collection may be inspected by map/some/for-of, but its
  // elements must never escape or be reassigned through those readers.
  const readOnlyAlias = (scope: ts.Node, name: string): boolean => {
    let safe = true;
    const visit = (node: ts.Node): void => {
      // The entire callback must be read-only, not only occurrences
      // of its first parameter. Array.some supplies the input array as a
      // third argument, and an unrelated call can mutate it indirectly.
      const assignment = ts.isBinaryExpression(node) &&
        node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
        node.operatorToken.kind <= ts.SyntaxKind.LastAssignment;
      const update = (ts.isPrefixUnaryExpression(node) ||
                      ts.isPostfixUnaryExpression(node)) &&
        (node.operator === ts.SyntaxKind.PlusPlusToken ||
         node.operator === ts.SyntaxKind.MinusMinusToken);
      if (assignment || update ||
          ts.isDeleteExpression(node) ||
          ts.isCallExpression(node) ||
          ts.isNewExpression(node) ||
          ts.isAwaitExpression(node) ||
          ts.isYieldExpression(node) ||
          ts.isFunctionLike(node))
        safe = false;
      if (ts.isIdentifier(node) && node.text !== name &&
          !(ts.isPropertyAccessExpression(node.parent) &&
            node.parent.name === node))
        safe = false;
      if (ts.isIdentifier(node) && node.text === name) {
        if (ts.isParameter(node.parent) && node.parent.name === node) {
          // declaration
        } else if (ts.isVariableDeclaration(node.parent) &&
                   node.parent.name === node) {
          // declaration
        } else if (ts.isPropertyAccessExpression(node.parent) &&
                   node.parent.expression === node) {
          // A property access is not necessarily a read. Calls such as
          // item.__defineGetter__("maxPlayers", () => 9) mutate the
          // configuration without a syntactic assignment to maxPlayers.
          // Walk through dotted accesses and reject writes, invocation,
          // computed access, escapes and unknown value consumers.
          let access: ts.Node = node.parent;
          while (ts.isPropertyAccessExpression(access.parent) &&
                 access.parent.expression === access)
            access = access.parent;
          while (ts.isParenthesizedExpression(access.parent) &&
                 access.parent.expression === access)
            access = access.parent;
          const use = access.parent;
          const assigned = ts.isBinaryExpression(use) &&
            use.left === access &&
            use.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
            use.operatorToken.kind <= ts.SyntaxKind.LastAssignment;
          const updated = (ts.isPrefixUnaryExpression(use) ||
                           ts.isPostfixUnaryExpression(use)) &&
            use.operand === access;
          const removed = ts.isDeleteExpression(use) &&
            use.expression === access;
          const invoked = ts.isCallExpression(use) &&
            (use.expression === access || use.arguments.some((arg) => arg === access));
          const escaped = (ts.isVariableDeclaration(use) &&
                             use.initializer === access) ||
            (ts.isPropertyAssignment(use) && use.initializer === access) ||
            (ts.isSpreadElement(use) && use.expression === access) ||
            (ts.isElementAccessExpression(use) && use.expression === access);
          if (assigned || updated || removed || invoked || escaped)
            safe = false;
        } else safe = false;
      }
      ts.forEachChild(node, visit);
    };
    visit(scope);
    return safe;
  };
  const checkReferences = (node: ts.Node): void => {
    if (!ts.isIdentifier(node) || node.text !== generatorName) {
      ts.forEachChild(node, checkReferences);
      return;
    }
    if (ts.isVariableDeclaration(node.parent) && node.parent.name === node)
      return;
    const p = node.parent;
    if (ts.isPropertyAccessExpression(p) && p.expression === node &&
        ts.isCallExpression(p.parent) && p.parent.expression === p &&
        (p.name.text === "map" || p.name.text === "some")) {
      const cb = p.parent.arguments[0];
      if (!cb || !ts.isArrowFunction(cb) ||
          cb.modifiers?.some((modifier) =>
            modifier.kind === ts.SyntaxKind.AsyncKeyword) ||
          cb.parameters.length !== 1 || !ts.isIdentifier(cb.parameters[0]!.name))
        valid = false;
      else if (p.name.text === "some" ||
          !(ts.isNewExpression(cb.body) &&
            ts.isIdentifier(cb.body.expression) &&
            cb.body.expression.text === className)) {
        if (!readOnlyAlias(cb.body, cb.parameters[0]!.name.text))
          valid = false;
      }
    } else if (ts.isForOfStatement(p) && p.expression === node &&
               ts.isVariableDeclarationList(p.initializer) &&
               p.initializer.declarations.length === 1 &&
               ts.isIdentifier(p.initializer.declarations[0]!.name)) {
      if (!readOnlyAlias(p.statement, p.initializer.declarations[0]!.name.text))
        valid = false;
    } else if (ts.isElementAccessExpression(p) && p.expression === node &&
               p.argumentExpression &&
               ts.isNumericLiteral(p.argumentExpression) &&
               ts.isNewExpression(p.parent) &&
               ts.isIdentifier(p.parent.expression) &&
               p.parent.expression.text === className) {
      // new Class(generatedCollection[literalIndex])
    } else valid = false;
  };
  checkReferences(file);
  if (!valid) return undefined;
  return {
    value: gen.value,
    source: gen.property,
    witnesses: [
      binding.source,
      gen.generator,
      ...(gen.inputSource ? [gen.inputSource] : []),
      ...allocations,
    ],
  };
}

function capacityComparisonEvidence(
  condition: ts.Expression,
  file: ts.SourceFile,
  source: SourceRef,
  fieldBindings: readonly ScriptConstructorFieldBinding[],
): ScriptArenaAuthorityEvidence | undefined {
  if (!ts.isBinaryExpression(condition)) {
    return undefined;
  }

  const supportedOperators = new Set([
    ts.SyntaxKind.GreaterThanToken,
    ts.SyntaxKind.GreaterThanEqualsToken,
    ts.SyntaxKind.LessThanToken,
    ts.SyntaxKind.LessThanEqualsToken,
  ]);
  if (
    !supportedOperators.has(
      condition.operatorToken.kind,
    )
  ) {
    return undefined;
  }

  const leftMembership = membershipCount(
    condition.left,
    file,
  );
  const rightMembership = membershipCount(
    condition.right,
    file,
  );

  const membership =
    leftMembership ?? rightMembership;
  if (!membership) return undefined;

  const other = leftMembership
    ? condition.right
    : condition.left;
  const capacity = capacityExpression(
    other,
    file,
  );
  if (!capacity) return undefined;
  const staticCapacity: { value: number; source: SourceRef; witnesses?: readonly SourceRef[] } | undefined = staticModuleCapacity(other, file, source) ??
    getterBoundModuleCapacity(other, file, source) ??
    staticConstructorCapacity(other, file, source, fieldBindings) ??
    mappedConstructorCapacity(other, file, source, fieldBindings);

  if (
    capacity.arenaExpression !== undefined &&
    capacity.arenaExpression !== membership.arenaExpression &&
    // this.definition.maxPlayers is an object-owned configuration path;
    // a different receiver remains unrelated until separately proven.
    capacity.arenaExpression !==
      membership.arenaExpression + ".definition" &&
    staticCapacity === undefined
  ) {
    return undefined;
  }

  return {
    kind: "capacity-check",
    arenaExpression:
      membership.arenaExpression,
    membershipExpression:
      membership.membershipExpression,
    capacityExpression:
      capacity.expression,
    ...(staticCapacity ? {
      resolvedCapacityValue: staticCapacity.value,
      resolvedCapacitySource: staticCapacity.source,
      ...(staticCapacity.witnesses !== undefined
        ? { resolvedCapacityWitnesses: staticCapacity.witnesses } : {}),
    } : {}),
    executionRegion:
      localExecutionRegionId(condition, file),
    source: lineSource(
      file,
      condition,
      source,
    ),
  };
}

/** Reject hidden roster mutation/escape on a capacity-rejection path. */
function guardHasRosterSideEffects(
  branch: ts.Statement,
  file: ts.SourceFile,
  arenaExpression: string,
  rosterExpression: string,
): boolean {
  let unsafe = false;
  const owned = (expression: ts.Expression): boolean => {
    const value = expression.getText(file);
    return value === rosterExpression ||
      value.startsWith(rosterExpression + ".") ||
      value.startsWith(rosterExpression + "[");
  };
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      if (ts.isPropertyAccessExpression(node.expression) &&
          owned(node.expression.expression)) unsafe = true;
      if (node.arguments.some((argument) =>
        owned(argument) || argument.getText(file) === arenaExpression
      )) unsafe = true;
    }
    const written = ts.isBinaryExpression(node) &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment &&
      owned(node.left);
    const updated = (ts.isPrefixUnaryExpression(node) ||
                     ts.isPostfixUnaryExpression(node)) &&
      (node.operator === ts.SyntaxKind.PlusPlusToken ||
       node.operator === ts.SyntaxKind.MinusMinusToken) &&
      owned(node.operand);
    const deleted = ts.isDeleteExpression(node) && owned(node.expression);
    const leaked = ts.isVariableDeclaration(node) &&
      node.initializer !== undefined && owned(node.initializer);
    if (written || updated || deleted || leaked) unsafe = true;
    ts.forEachChild(node, visit);
  };
  visit(branch);
  return unsafe;
}

function scalarAdmissionOutcome(expression: ts.Expression): boolean {
  if (ts.isParenthesizedExpression(expression))
    return scalarAdmissionOutcome(expression.expression);
  return ts.isNumericLiteral(expression) ||
    ts.isStringLiteralLike(expression) ||
    expression.kind === ts.SyntaxKind.TrueKeyword ||
    expression.kind === ts.SyntaxKind.FalseKeyword ||
    expression.kind === ts.SyntaxKind.NullKeyword ||
    (ts.isPrefixUnaryExpression(expression) &&
     expression.operator === ts.SyntaxKind.ExclamationToken &&
     scalarAdmissionOutcome(expression.operand));
}

function capacityCheckEvidence(
  node: ts.Node,
  file: ts.SourceFile,
  source: SourceRef,
  fieldBindings: readonly ScriptConstructorFieldBinding[],
): ScriptArenaAuthorityEvidence | undefined {
  if (!ts.isIfStatement(node) || !ts.isBlock(node.parent)) return undefined;
  const condition = node.expression;
  // A capacity check only establishes admission protection when a full
  // party definitely exits and the next statement commits the SAME roster.
  // If a guard merely logs or compares an inverted limit, recording it as
  // capacityAuthorityProven would incorrectly close FORMALIZE.
  if (
    !ts.isBinaryExpression(condition) ||
    condition.operatorToken.kind !== ts.SyntaxKind.GreaterThanEqualsToken ||
    membershipCount(condition.left, file) === undefined
  ) return undefined;
  const thenBranch = node.thenStatement;
  const terminal = ts.isBlock(thenBranch)
    ? thenBranch.statements[thenBranch.statements.length - 1]
    : thenBranch;
  if (
    terminal === undefined ||
    (!ts.isReturnStatement(terminal) && !ts.isThrowStatement(terminal))
  ) return undefined;
  // An expression-return can mutate the roster before exiting.
  if (ts.isReturnStatement(terminal) && terminal.expression &&
      !scalarAdmissionOutcome(terminal.expression)) return undefined;
  const block = node.parent;
  const next = block.statements[block.statements.indexOf(node) + 1];
  if (next === undefined) return undefined;
  const commit = membershipCommitEvidence(next, file, source);
  const check = capacityComparisonEvidence(condition, file, source, fieldBindings);
  if (
    commit === undefined ||
    check === undefined ||
    commit.arenaExpression !== check.arenaExpression ||
    commit.membershipExpression !== check.membershipExpression ||
    guardHasRosterSideEffects(
      thenBranch, file, check.arenaExpression, check.membershipExpression!
    )
  ) return undefined;
  return { ...check, guardedCommitSource: commit.source };
}

/**
 * Conservative return-ternary join contract:
 * return (otherRejections || members.length >= cap) ? false
 *   : (members.push(player), true)
 *
 * A comparison in an arbitrary expression is not enough. Membership
 * must be committed directly on the successful (false) branch of the
 * same returned conditional, not a nested/independent call or opposite
 * branch. Only OR-chains can establish that all rejection guards are
 * false before the successful branch is selected.
 */
function returnTernaryCapacityEvidence(
  node: ts.Node,
  file: ts.SourceFile,
  source: SourceRef,
  fieldBindings: readonly ScriptConstructorFieldBinding[],
): readonly ScriptArenaAuthorityEvidence[] {
  if (!ts.isConditionalExpression(node)) return [];
  let expression: ts.Node = node;
  while (
    expression.parent !== undefined &&
    ts.isParenthesizedExpression(expression.parent)
  ) expression = expression.parent;
  if (!ts.isReturnStatement(expression.parent)) return [];

  const unwrap = (value: ts.Expression): ts.Expression =>
    ts.isParenthesizedExpression(value)
      ? unwrap(value.expression)
      : value;
  const rejection = unwrap(node.whenTrue);
  const definitelyFalse =
    rejection.kind === ts.SyntaxKind.FalseKeyword ||
    (
      ts.isPrefixUnaryExpression(rejection) &&
      rejection.operator === ts.SyntaxKind.ExclamationToken &&
      ts.isNumericLiteral(rejection.operand) &&
      rejection.operand.text === "1"
    );
  if (!definitelyFalse) return [];

  const conditionChecks = (value: ts.Expression):
    ScriptArenaAuthorityEvidence[] => {
    const expr = unwrap(value);
    if (
      ts.isBinaryExpression(expr) &&
      expr.operatorToken.kind === ts.SyntaxKind.BarBarToken
    ) {
      return [
        ...conditionChecks(expr.left),
        ...conditionChecks(expr.right),
      ];
    }
    // Reject-on-true requires count >= cap: count > cap admits one
    // additional player and cannot prove the authored maximum.
    // The generic IfStatement collector supports other directions, but
    // importing them here would invert the meaning of the rejection gate.
    if (
      !ts.isBinaryExpression(expr) ||
      ![
        ts.SyntaxKind.GreaterThanEqualsToken,
      ].includes(expr.operatorToken.kind) ||
      membershipCount(expr.left, file) === undefined
    ) return [];
    const check = capacityComparisonEvidence(expr, file, source, fieldBindings);
    return check === undefined ? [] : [check];
  };
  const checks = conditionChecks(node.condition);
  if (checks.length === 0) return [];

  const committed = (value: ts.Expression):
    ScriptArenaAuthorityEvidence[] => {
    const expr = unwrap(value);
    if (
      ts.isBinaryExpression(expr) &&
      expr.operatorToken.kind === ts.SyntaxKind.CommaToken
    ) {
      return [
        ...committed(expr.left),
        ...committed(expr.right),
      ];
    }
    if (
      !ts.isCallExpression(expr) ||
      !ts.isPropertyAccessExpression(expr.expression) ||
      !["push", "add", "set"].includes(expr.expression.name.text)
    ) return [];
    const membership = membershipCollection(expr.expression.expression);
    const subject = expr.arguments[0];
    if (membership === undefined || subject === undefined) return [];
    return [{
      kind: "membership-commit",
      arenaExpression: membership.arenaExpression,
      membershipExpression: membership.membershipExpression,
      subjectExpression: subject.getText(file),
      executionRegion: localExecutionRegionId(node, file),
      source: lineSource(file, expr, source),
    }];
  };
  const commits = committed(node.whenFalse);
  // Comma arms can conceal uncounted calls or assignments after a
  // membership write. One counted add and inert results are the limit.
  const safeSuccessArm = (value: ts.Expression): boolean => {
    const expr = unwrap(value);
    if (ts.isBinaryExpression(expr) &&
        expr.operatorToken.kind === ts.SyntaxKind.CommaToken)
      return safeSuccessArm(expr.left) && safeSuccessArm(expr.right);
    if (scalarAdmissionOutcome(expr)) return true;
    if (!ts.isCallExpression(expr) ||
        !ts.isPropertyAccessExpression(expr.expression) ||
        !["push", "add", "set"].includes(expr.expression.name.text) ||
        !membershipCollection(expr.expression.expression) ||
        expr.arguments.length < 1 ||
        !expr.arguments.every((argument) =>
          ts.isIdentifier(argument) || scalarAdmissionOutcome(argument)
        )) return false;
    return true;
  };
  if (commits.length !== 1 || !safeSuccessArm(node.whenFalse)) return [];
  // Emit only a matched comparison and commit for exactly the same arena
  // membership collection. Never merge two different session owners.
  const supported = checks.flatMap((check) =>
    commits.filter((commit) =>
      commit.arenaExpression === check.arenaExpression &&
      commit.membershipExpression === check.membershipExpression
    ).flatMap((commit) => [
      { ...check, guardedCommitSource: commit.source }, commit,
    ])
  );
  return supported;
}

function startOwnerEvidence(
  node: ts.Node,
  file: ts.SourceFile,
  source: SourceRef,
): ScriptArenaAuthorityEvidence | undefined {
  const value = assignment(node);
  if (!value) return undefined;

  const target = directProperty(value.left);
  if (
    !target ||
    !START_OWNER_PROPERTY.test(target.property)
  ) {
    return undefined;
  }

  const ownerExpression =
    value.right.getText(file);
  return {
    kind: "start-owner-acquire",
    arenaExpression:
      target.owner.getText(file),
    subjectExpression: target.text,
    ownerExpression,
    ...(GENERATION_PROPERTY.test(
      ownerExpression,
    )
      ? {
          generationExpression:
            ownerExpression,
        }
      : {}),
    executionRegion:
      localExecutionRegionId(node, file),
    source: lineSource(
      file,
      value.statement,
      source,
    ),
  };
}

function isNullOrUndefined(
  expression: ts.Expression,
): boolean {
  return (
    expression.kind === ts.SyntaxKind.NullKeyword ||
    (
      ts.isIdentifier(expression) &&
      expression.text === "undefined"
    )
  );
}

function startOwnerGuardEvidence(
  node: ts.Node,
  file: ts.SourceFile,
  source: SourceRef,
): ScriptArenaAuthorityEvidence | undefined {
  if (!ts.isIfStatement(node)) return undefined;
  const condition = node.expression;
  if (
    !ts.isBinaryExpression(condition) ||
    ![
      ts.SyntaxKind.ExclamationEqualsToken,
      ts.SyntaxKind.ExclamationEqualsEqualsToken,
    ].includes(condition.operatorToken.kind)
  ) {
    return undefined;
  }

  const left = directProperty(condition.left);
  const right = directProperty(condition.right);

  const ownerTarget =
    left &&
    START_OWNER_PROPERTY.test(left.property) &&
    isNullOrUndefined(condition.right)
      ? left
      : right &&
          START_OWNER_PROPERTY.test(right.property) &&
          isNullOrUndefined(condition.left)
        ? right
        : undefined;

  if (!ownerTarget) return undefined;

  const thenStatement = node.thenStatement;
  const directReturn =
    ts.isReturnStatement(thenStatement) ||
    (
      ts.isBlock(thenStatement) &&
      thenStatement.statements.length === 1 &&
      ts.isReturnStatement(
        thenStatement.statements[0]!,
      )
    );
  if (!directReturn) return undefined;

  return {
    kind: "start-owner-guard",
    arenaExpression:
      ownerTarget.owner.getText(file),
    subjectExpression: ownerTarget.text,
    executionRegion:
      localExecutionRegionId(node, file),
    source: lineSource(
      file,
      condition,
      source,
    ),
  };
}

function startStateValue(
  expression: ts.Expression,
): string | undefined {
  if (
    expression.kind ===
      ts.SyntaxKind.TrueKeyword
  ) {
    return "true";
  }
  if (
    ts.isStringLiteralLike(expression) ||
    ts.isNoSubstitutionTemplateLiteral(
      expression,
    )
  ) {
    return expression.text;
  }
  return undefined;
}

function startStateCommitEvidence(
  node: ts.Node,
  file: ts.SourceFile,
  source: SourceRef,
): ScriptArenaAuthorityEvidence | undefined {
  const value = assignment(node);
  if (!value) return undefined;

  const target = directProperty(value.left);
  if (
    !target ||
    !START_STATE_PROPERTY.test(target.property)
  ) {
    return undefined;
  }

  const state = startStateValue(value.right);
  if (
    state === undefined ||
    !START_STATE_VALUE.test(state)
  ) {
    return undefined;
  }

  return {
    kind: "start-state-commit",
    arenaExpression:
      target.owner.getText(file),
    stateExpression:
      target.text + "=" + state,
    executionRegion:
      localExecutionRegionId(node, file),
    source: lineSource(
      file,
      value.statement,
      source,
    ),
  };
}


function arenaCollectionCount(
  expression: ts.Expression,
  file: ts.SourceFile,
): { arena: string; collection: string } | undefined {
  if (
    !ts.isPropertyAccessExpression(expression) ||
    !["size", "length"].includes(expression.name.text) ||
    !ts.isPropertyAccessExpression(expression.expression)
  ) {
    return undefined;
  }
  const collection = expression.expression;
  if (
    !MEMBERSHIP_PROPERTY.test(collection.name.text) &&
    !READY_PROPERTY.test(collection.name.text)
  ) {
    return undefined;
  }
  return {
    arena: collection.expression.getText(file),
    collection: collection.getText(file),
  };
}

function nodeContainsIdentifier(
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

function delayedReadySnapshotEvidence(
  file: ts.SourceFile,
  source: SourceRef,
): ScriptArenaAuthorityEvidence[] {
  const snapshots = new Map<string, {
    arena: string;
    collection: string;
    region: string;
    start: number;
  }>();

  const collect = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer
    ) {
      const count =
        arenaCollectionCount(
          node.initializer,
          file,
        );
      if (count) {
        snapshots.set(node.name.text, {
          ...count,
          region:
            localExecutionRegionId(
              node,
              file,
            ),
          start:
            node.getStart(file),
        });
      }
    }
    ts.forEachChild(node, collect);
  };
  collect(file);

  const output:
    ScriptArenaAuthorityEvidence[] = [];

  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(
        node.expression,
      ) &&
      node.expression.expression.getText(file) === "system" &&
      /^(?:run|runTimeout|runInterval|runJob)$/.test(
        node.expression.name.text,
      )
    ) {
      const callback = node.arguments[0];
      if (
        callback &&
        (
          ts.isArrowFunction(callback) ||
          ts.isFunctionExpression(callback)
        )
      ) {
        let startCommit = false;
        let liveArenaCount:
          string | undefined;

        const scan = (inner: ts.Node): void => {
          const value =
            assignment(inner);
          if (value) {
            const target =
              directProperty(
                value.left,
              );
            const state =
              startStateValue(
                value.right,
              );
            if (
              target &&
              START_STATE_PROPERTY.test(
                target.property,
              ) &&
              state !== undefined &&
              START_STATE_VALUE.test(
                state,
              )
            ) {
              startCommit = true;
            }
          }

          if (
            ts.isPropertyAccessExpression(
              inner,
            )
          ) {
            const count =
              arenaCollectionCount(
                inner,
                file,
              );
            if (count) {
              liveArenaCount ??=
                count.arena;
            }
          }
          ts.forEachChild(
            inner,
            scan,
          );
        };
        scan(callback.body);

        if (startCommit) {
          const schedulerRegion =
            localExecutionRegionId(
              node,
              file,
            );
          for (
            const [binding, snapshot]
              of snapshots
          ) {
            if (
              snapshot.region !==
                schedulerRegion ||
              snapshot.start >=
                node.getStart(file) ||
              !nodeContainsIdentifier(
                callback.body,
                binding,
              ) ||
              liveArenaCount ===
                snapshot.arena
            ) {
              continue;
            }
            output.push({
              kind:
                "ready-set-snapshot-risk",
              arenaExpression:
                snapshot.arena,
              membershipExpression:
                snapshot.collection,
              subjectExpression:
                binding,
              snapshotExpression:
                binding +
                "=" +
                snapshot.collection,
              executionRegion:
                localExecutionRegionId(
                  callback,
                  file,
                ),
              source:
                lineSource(
                  file,
                  callback,
                  source,
                ),
            });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);

  return output;
}

function evidenceKey(
  evidence: ScriptArenaAuthorityEvidence,
): string {
  return [
    evidence.kind,
    evidence.arenaExpression,
    evidence.executionRegion,
    evidence.source.relativePath,
    evidence.source.range?.lineStart ?? 0,
    evidence.source.range?.columnStart ?? 0,
  ].join("|");
}

const TERMINAL_FUNCTION_NAME =
  /^(?:endgame|endmatch|finishgame|finishmatch|cleanup|cleanuparena|reset|resetarena|abort|abortgame|timeout|victory|defeat|stopgame|leavearena|disconnect|playerleave|onplayerleave)$/i;

function terminalLiteralValue(
  expression: ts.Expression,
): string | undefined {
  if (
    expression.kind ===
      ts.SyntaxKind.TrueKeyword
  ) {
    return "true";
  }
  if (
    expression.kind ===
      ts.SyntaxKind.FalseKeyword
  ) {
    return "false";
  }
  if (
    ts.isStringLiteralLike(expression) ||
    ts.isNoSubstitutionTemplateLiteral(
      expression,
    )
  ) {
    return expression.text;
  }
  return undefined;
}

function terminalReturnOnly(
  statement: ts.Statement,
): boolean {
  return (
    ts.isReturnStatement(statement) ||
    (
      ts.isBlock(statement) &&
      statement.statements.length === 1 &&
      ts.isReturnStatement(
        statement.statements[0]!,
      )
    )
  );
}

function terminalGuard(
  expression: ts.Expression,
  file: ts.SourceFile,
): {
  readonly target: string;
  readonly mode:
    | "truthy"
    | "equal"
    | "not-equal";
  readonly value?: string;
} | undefined {
  if (
    ts.isIdentifier(expression) ||
    ts.isPropertyAccessExpression(
      expression,
    )
  ) {
    return {
      target:
        expression.getText(file),
      mode: "truthy",
    };
  }

  if (
    !ts.isBinaryExpression(expression)
  ) {
    return undefined;
  }

  const operator =
    expression.operatorToken.kind;
  const equal =
    operator ===
      ts.SyntaxKind.EqualsEqualsToken ||
    operator ===
      ts.SyntaxKind.EqualsEqualsEqualsToken;
  const notEqual =
    operator ===
      ts.SyntaxKind.ExclamationEqualsToken ||
    operator ===
      ts.SyntaxKind.ExclamationEqualsEqualsToken;
  if (!equal && !notEqual) {
    return undefined;
  }

  const pairs: readonly [
    ts.Expression,
    ts.Expression,
  ][] = [
    [expression.left, expression.right],
    [expression.right, expression.left],
  ];

  for (const [candidate, literal] of pairs) {
    if (
      !ts.isIdentifier(candidate) &&
      !ts.isPropertyAccessExpression(
        candidate,
      )
    ) {
      continue;
    }
    const value =
      terminalLiteralValue(literal);
    if (value === undefined) continue;
    return {
      target:
        candidate.getText(file),
      mode:
        equal
          ? "equal"
          : "not-equal",
      value,
    };
  }

  return undefined;
}

function terminalLatchAssignment(
  statement: ts.Statement,
  file: ts.SourceFile,
): {
  readonly target: string;
  readonly value: string;
  readonly sourceNode:
    ts.BinaryExpression;
} | undefined {
  if (
    !ts.isExpressionStatement(statement) ||
    !ts.isBinaryExpression(
      statement.expression,
    ) ||
    statement.expression.operatorToken.kind !==
      ts.SyntaxKind.EqualsToken
  ) {
    return undefined;
  }

  const value =
    terminalLiteralValue(
      statement.expression.right,
    );
  if (value === undefined) {
    return undefined;
  }

  return {
    target:
      statement.expression.left.getText(
        file,
      ),
    value,
    sourceNode:
      statement.expression,
  };
}

export function deriveScriptTerminalIdempotencyEvidence(
  text: string,
  source: SourceRef,
): ScriptTerminalIdempotencyEvidence[] {
  const file = ts.createSourceFile(
    source.relativePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(source.relativePath),
  );
  const output:
    ScriptTerminalIdempotencyEvidence[] = [];

  const visit = (node: ts.Node): void => {
    if (
      (
        ts.isFunctionDeclaration(node) ||
        ts.isMethodDeclaration(node)
      ) &&
      node.body
    ) {
      const name =
        declarationMemberName(
          node.name,
        );
      if (
        name &&
        TERMINAL_FUNCTION_NAME.test(
          name.replace(
            /[^A-Za-z0-9]/g,
            "",
          ),
        ) &&
        node.body.statements.length >= 2
      ) {
        const first =
          node.body.statements[0]!;
        const second =
          node.body.statements[1]!;
        if (
          ts.isIfStatement(first) &&
          first.elseStatement ===
            undefined &&
          terminalReturnOnly(
            first.thenStatement,
          )
        ) {
          const guard =
            terminalGuard(
              first.expression,
              file,
            );
          const latch =
            terminalLatchAssignment(
              second,
              file,
            );
          if (
            guard &&
            latch &&
            guard.target ===
              latch.target
          ) {
            const protectedByLatch =
              (
                guard.mode === "truthy" &&
                latch.value === "true"
              ) ||
              (
                guard.mode === "equal" &&
                guard.value ===
                  latch.value
              ) ||
              (
                guard.mode ===
                  "not-equal" &&
                guard.value !== undefined &&
                guard.value !==
                  latch.value
              );
            if (protectedByLatch) {
              output.push({
                functionRegion:
                  "function:" + name,
                guardTarget:
                  guard.target,
                kind:
                  guard.mode ===
                    "truthy"
                    ? "boolean-latch"
                    : "state-latch",
                source:
                  lineSource(
                    file,
                    latch.sourceNode,
                    source,
                  ),
              });
            }
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(file);

  return output.sort((a, b) =>
    a.functionRegion.localeCompare(
      b.functionRegion,
    ) ||
    a.guardTarget.localeCompare(
      b.guardTarget,
    )
  );
}

export function deriveScriptArenaAuthorityEvidence(
  text: string,
  source: SourceRef,
  fieldBindings: readonly ScriptConstructorFieldBinding[] = [],
): ScriptArenaAuthorityEvidence[] {
  const file = ts.createSourceFile(
    source.relativePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(source.relativePath),
  );

  const output: ScriptArenaAuthorityEvidence[] = [
    ...delayedReadySnapshotEvidence(
      file,
      source,
    ),
  ];

  const visit = (node: ts.Node): void => {
    const membership =
      membershipCommitEvidence(
        node,
        file,
        source,
      );
    if (membership) output.push(membership);

    const release = membershipReleaseEvidence(
      node,
      file,
      source,
    );
    if (release) output.push(release);

    const generationInvalidation =
      generationInvalidationEvidence(
        node,
        file,
        source,
      );
    if (generationInvalidation) {
      output.push(generationInvalidation);
    }

    output.push(
      ...variableOperandEvidence(
        node,
        file,
        source,
      ),
    );

    const capacity = capacityCheckEvidence(
      node,
      file,
      source,
      fieldBindings,
    );
    if (capacity) output.push(capacity);
    output.push(...returnTernaryCapacityEvidence(node, file, source, fieldBindings));

    const ownerGuard = startOwnerGuardEvidence(
      node,
      file,
      source,
    );
    if (ownerGuard) output.push(ownerGuard);

    const owner = startOwnerEvidence(
      node,
      file,
      source,
    );
    if (owner) output.push(owner);

    const start = startStateCommitEvidence(
      node,
      file,
      source,
    );
    if (start) output.push(start);

    ts.forEachChild(node, visit);
  };

  visit(file);

  return [
    ...new Map(
      output.map((item) => [
        evidenceKey(item),
        item,
      ]),
    ).values(),
  ].sort((a, b) =>
    evidenceKey(a).localeCompare(
      evidenceKey(b),
    )
  );
}

function sameCommitSource(expected: SourceRef | undefined, actual: SourceRef): boolean {
  const a = expected?.range, b = actual.range;
  return a?.lineStart !== undefined && a.columnStart !== undefined &&
    a.lineEnd !== undefined && a.columnEnd !== undefined &&
    b !== undefined && expected?.artifactId === actual.artifactId &&
    expected.relativePath === actual.relativePath &&
    a.lineStart === b.lineStart && a.columnStart === b.columnStart &&
    a.lineEnd === b.lineEnd && a.columnEnd === b.columnEnd;
}

export function correlateScriptArenaAuthorityPaths(
  evidence:
    readonly ScriptArenaAuthorityEvidence[],
): ScriptArenaAuthorityPath[] {
  const grouped = new Map<
    string,
    { arenaExpression: string; executionRegion: string; items: ScriptArenaAuthorityEvidence[] }
  >();
  for (const item of evidence) {
    const key = JSON.stringify([item.arenaExpression, item.executionRegion]);
    const group = grouped.get(key) ?? {
      arenaExpression: item.arenaExpression,
      executionRegion: item.executionRegion,
      items: [],
    };
    group.items.push(item);
    grouped.set(key, group);
  }

  return [...grouped.values()]
    .map(({ arenaExpression, executionRegion, items }) => {
      // An exact guard-to-write witness, not co-location, establishes authority.
      const pairs = items.flatMap((check) =>
        check.kind === "capacity-check" && check.guardedCommitSource
          ? items.filter((commit) =>
              commit.kind === "membership-commit" &&
              check.arenaExpression === commit.arenaExpression &&
              check.membershipExpression === commit.membershipExpression &&
              sameCommitSource(check.guardedCommitSource, commit.source)
            ).map((commit) => ({ check, commit }))
          : [],
      );
      const first = pairs[0];
      const bound = first !== undefined &&
        pairs.every(({ check }) =>
          check.capacityExpression === first.check.capacityExpression &&
          check.membershipExpression === first.check.membershipExpression
        ) &&
        items.filter((item) =>
          item.kind === "membership-commit" &&
          item.membershipExpression === first.commit.membershipExpression
        ).length === pairs.length
          ? first : undefined;
      const membershipCommit = bound?.commit ??
        items.find((item) => item.kind === "membership-commit");
      const membershipRelease = items.find(
        (item) =>
          item.kind ===
            "membership-release",
      );
      const capacityOperand = items.find(
        (item) =>
          item.kind ===
            "capacity-operand",
      );
      const capacityCheck = bound?.check ??
        items.find((item) => item.kind === "capacity-check");
      const generationOperand = items.find(
        (item) =>
          item.kind ===
            "arena-generation-operand",
      );
      const generationInvalidation = items.find(
        (item) =>
          item.kind ===
            "generation-invalidate",
      );
      const startOwnerGuard = items.find(
        (item) =>
          item.kind ===
            "start-owner-guard",
      );
      const startOwnerAcquire = items.find(
        (item) =>
          item.kind ===
            "start-owner-acquire",
      );
      const startStateCommit = items.find(
        (item) =>
          item.kind ===
            "start-state-commit",
      );

      const capacityExpression =
        capacityCheck?.capacityExpression;
      const directCapacityExpression =
        capacityExpression !== undefined &&
        capacityExpression.includes(".");
      // A positive integer literal is already a source-scoped capacity
      // limit when the same lexical path contains the membership commit.
      // Do not require a separate capacity operand for an inline ">= 5"
      // check; the upstream extractor still rejects zero/noninteger caps.
      const numericCapacityLiteral =
        capacityExpression !== undefined &&
        /^(?:0|[1-9]\d*)$/.test(capacityExpression);
      const localCapacityExpression =
        capacityExpression !== undefined &&
        /^[A-Za-z_$][\w$]*$/.test(
          capacityExpression,
        );
      const capacityMatchesOperand =
        numericCapacityLiteral ||
        directCapacityExpression ||
        (
          localCapacityExpression &&
          capacityOperand?.capacityExpression ===
            capacityExpression
        );

      const capacityAuthorityProven =
        bound !== undefined && capacityMatchesOperand;

      const startAuthorityProven =
        startOwnerAcquire !== undefined &&
        startStateCommit !== undefined &&
        (
          startOwnerAcquire.generationExpression !==
            undefined ||
          generationOperand !== undefined
        );
      const startGuardProven =
        startAuthorityProven &&
        startOwnerGuard !== undefined &&
        startOwnerGuard.subjectExpression !== undefined &&
        startOwnerGuard.subjectExpression ===
          startOwnerAcquire?.subjectExpression;

      return {
        arenaExpression:
          arenaExpression ?? "",
        executionRegion:
          executionRegion ?? "",
        ...(membershipCommit
          ? { membershipCommit }
          : {}),
        ...(membershipRelease
          ? { membershipRelease }
          : {}),
        ...(capacityOperand
          ? { capacityOperand }
          : {}),
        ...(capacityCheck
          ? { capacityCheck }
          : {}),
        ...(generationOperand
          ? { generationOperand }
          : {}),
        ...(generationInvalidation
          ? { generationInvalidation }
          : {}),
        ...(startOwnerGuard
          ? { startOwnerGuard }
          : {}),
        ...(startOwnerAcquire
          ? { startOwnerAcquire }
          : {}),
        ...(startStateCommit
          ? { startStateCommit }
          : {}),
        capacityAuthorityProven,
        startAuthorityProven,
        startGuardProven,
      };
    })
    .filter(
      (item) =>
        item.arenaExpression.length > 0 &&
        item.executionRegion.length > 0,
    )
    .sort((a, b) =>
      a.arenaExpression.localeCompare(
        b.arenaExpression,
      ) ||
      a.executionRegion.localeCompare(
        b.executionRegion,
      )
    );
}


const TERMINAL_PRECEDENCE_BINDING =
  /(?:(?:terminal|result|outcome|winner).*(?:precedence|priority|tie)|(?:precedence|priority|tie).*(?:terminal|result|outcome|winner))/i;

function precedenceArrayOutcomes(
  expression: ts.Expression,
): string[] | undefined {
  if (!ts.isArrayLiteralExpression(expression)) {
    return undefined;
  }
  const values = expression.elements
    .map((item) =>
      ts.isStringLiteralLike(item)
        ? item.text.trim()
        : undefined
    )
    .filter(
      (item): item is string =>
        Boolean(item),
    );
  return values.length >= 2
    ? values
    : undefined;
}

function precedenceObjectOutcomes(
  expression: ts.Expression,
): string[] | undefined {
  if (!ts.isObjectLiteralExpression(expression)) {
    return undefined;
  }
  const ranked = expression.properties
    .flatMap((property) => {
      if (!ts.isPropertyAssignment(property)) {
        return [];
      }
      const name =
        declarationMemberName(property.name);
      if (!name) return [];
      const value = property.initializer;
      if (
        !ts.isNumericLiteral(value) &&
        !ts.isStringLiteralLike(value)
      ) {
        return [];
      }
      const rank = Number(value.text);
      return Number.isFinite(rank)
        ? [{ name, rank }]
        : [];
    });
  if (ranked.length < 2) {
    return undefined;
  }
  return ranked
    .sort((a, b) =>
      b.rank - a.rank ||
      a.name.localeCompare(b.name)
    )
    .map((item) => item.name);
}

function functionReferencesBinding(
  node:
    | ts.FunctionDeclaration
    | ts.MethodDeclaration,
  binding: string,
): boolean {
  if (!node.body) return false;
  let found = false;
  const visit = (current: ts.Node): void => {
    if (found) return;
    if (
      ts.isIdentifier(current) &&
      current.text === binding
    ) {
      found = true;
      return;
    }
    ts.forEachChild(current, visit);
  };
  visit(node.body);
  return found;
}

export function deriveScriptTerminalPrecedenceEvidence(
  text: string,
  source: SourceRef,
): ScriptTerminalPrecedenceEvidence[] {
  const file = ts.createSourceFile(
    source.relativePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(source.relativePath),
  );

  const policies = new Map<
    string,
    {
      kind:
        | "ordered-outcomes"
        | "priority-table";
      outcomes: readonly string[];
      node: ts.Node;
    }
  >();

  const collect = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      TERMINAL_PRECEDENCE_BINDING.test(
        node.name.text,
      )
    ) {
      const array =
        precedenceArrayOutcomes(
          node.initializer,
        );
      const object =
        array === undefined
          ? precedenceObjectOutcomes(
              node.initializer,
            )
          : undefined;
      if (array) {
        policies.set(node.name.text, {
          kind: "ordered-outcomes",
          outcomes: array,
          node,
        });
      } else if (object) {
        policies.set(node.name.text, {
          kind: "priority-table",
          outcomes: object,
          node,
        });
      }
    }
    ts.forEachChild(node, collect);
  };
  collect(file);

  const output:
    ScriptTerminalPrecedenceEvidence[] = [];
  const visit = (node: ts.Node): void => {
    if (
      (
        ts.isFunctionDeclaration(node) ||
        ts.isMethodDeclaration(node)
      ) &&
      node.body
    ) {
      const name =
        declarationMemberName(node.name);
      if (
        !name ||
        !TERMINAL_FUNCTION_NAME.test(
          name.replace(/[^A-Za-z0-9]/g, ""),
        )
      ) {
        ts.forEachChild(node, visit);
        return;
      }

      for (const [binding, policy] of policies) {
        if (
          !functionReferencesBinding(
            node,
            binding,
          )
        ) {
          continue;
        }
        output.push({
          functionRegion:
            "function:" + name,
          policyBinding: binding,
          policyKind: policy.kind,
          outcomes:
            [...policy.outcomes],
          source:
            lineSource(
              file,
              policy.node,
              source,
            ),
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);

  return output.sort((a, b) =>
    a.functionRegion.localeCompare(
      b.functionRegion,
    ) ||
    a.policyBinding.localeCompare(
      b.policyBinding,
    )
  );
}
