import ts from "typescript";
import type {
  SourceRef,
} from "../../../../../packages/project-model/src/index.js";

export type ScriptProgressionCounterKind =
  | "variable"
  | "scoreboard";

export type ScriptProgressionExecutionShape =
  | "single"
  | "conditional"
  | "repeated";

export type ScriptProgressionCounterEvidenceKind =
  | "growth"
  | "decrement"
  | "replacement"
  | "completion-check";

export interface ScriptProgressionCounterEvidence {
  readonly kind:
    ScriptProgressionCounterEvidenceKind;
  readonly counterKind:
    ScriptProgressionCounterKind;
  readonly counterId: string;
  readonly executionRegion: string;
  readonly executionShape:
    ScriptProgressionExecutionShape;
  readonly amount?: number;
  readonly source: SourceRef;
}

export interface ScriptProgressionActorSpawnEvidence {
  readonly actorIdentifier: string;
  readonly executionRegion: string;
  readonly executionShape:
    ScriptProgressionExecutionShape;
  readonly source: SourceRef;
}

export interface ScriptProgressionActorRegistryEvidence {
  readonly registryExpression: string;
  readonly action:
    | "materialize"
    | "release"
    | "completion-check";
  readonly executionRegion: string;
  readonly generationBound: boolean;
  readonly actorIdentifier?: string;
  readonly source: SourceRef;
}

export interface ScriptProgressionActiveEventEvidence {
  readonly event: string;
  readonly executionRegion: string;
  readonly basis?: "guard" | "transition";
  readonly source: SourceRef;
}

export interface ScriptProgressionActiveCallEvidence {
  readonly callerRegion: string;
  readonly targetName: string;
  readonly basis?: "guard" | "transition";
  readonly source: SourceRef;
}

export interface ScriptProgressionStateTransitionEvidence {
  readonly target: string;
  readonly from: string;
  readonly to: string;
  readonly executionRegion: string;
  readonly source: SourceRef;
}

export interface ScriptProgressionAdvanceEvidence {
  readonly counterId: string;
  readonly effectTarget: string;
  readonly executionRegion: string;
  readonly source: SourceRef;
}

export interface ScriptProgressionOrdinalAdvanceEvidence {
  readonly target: string;
  readonly amount: number;
  readonly executionRegion: string;
  readonly executionShape:
    ScriptProgressionExecutionShape;
  readonly source: SourceRef;
}

export interface ScriptProgressionIdempotencyEvidence {
  readonly functionRegion: string;
  readonly guardTarget: string;
  readonly kind:
    | "boolean-latch"
    | "state-latch";
  readonly source: SourceRef;
}

const COUNTER_NAME =
  /(?:wave|enemy|enemies|mob|mobs|remaining|alive|objective|progress|count)/i;

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
  let current: ts.Node | undefined =
    node.parent;
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
        String(start.line + 1) +
        ":" +
        String(start.character + 1)
      );
    }
    current = current.parent;
  }
  return "module";
}

function executionShape(
  node: ts.Node,
): ScriptProgressionExecutionShape {
  let current: ts.Node | undefined =
    node.parent;
  let conditional = false;

  while (current) {
    if (
      ts.isForStatement(current) ||
      ts.isForInStatement(current) ||
      ts.isForOfStatement(current) ||
      ts.isWhileStatement(current) ||
      ts.isDoStatement(current)
    ) {
      return "repeated";
    }
    if (
      ts.isIfStatement(current) ||
      ts.isConditionalExpression(current) ||
      ts.isCaseClause(current) ||
      ts.isDefaultClause(current) ||
      ts.isSwitchStatement(current)
    ) {
      conditional = true;
    }
    if (
      ts.isFunctionDeclaration(current) ||
      ts.isMethodDeclaration(current) ||
      ts.isArrowFunction(current) ||
      ts.isFunctionExpression(current)
    ) {
      break;
    }
    current = current.parent;
  }

  return conditional
    ? "conditional"
    : "single";
}

function counterId(
  expression: ts.Expression,
): string | undefined {
  if (ts.isIdentifier(expression)) {
    return COUNTER_NAME.test(expression.text)
      ? expression.text
      : undefined;
  }
  if (
    ts.isPropertyAccessExpression(expression)
  ) {
    return COUNTER_NAME.test(
      expression.name.text,
    )
      ? expression.getText()
      : undefined;
  }
  return undefined;
}

function numericLiteral(
  expression: ts.Expression,
): number | undefined {
  if (ts.isNumericLiteral(expression)) {
    return Number(expression.text);
  }
  if (
    ts.isPrefixUnaryExpression(expression) &&
    ts.isNumericLiteral(expression.operand)
  ) {
    const value =
      Number(expression.operand.text);
    if (
      expression.operator ===
      ts.SyntaxKind.MinusToken
    ) {
      return -value;
    }
    if (
      expression.operator ===
      ts.SyntaxKind.PlusToken
    ) {
      return value;
    }
  }
  return undefined;
}

function literalString(
  expression: ts.Expression | undefined,
): string | undefined {
  return (
    expression &&
    (
      ts.isStringLiteralLike(expression) ||
      ts.isNoSubstitutionTemplateLiteral(
        expression,
      )
    )
  )
    ? expression.text
    : undefined;
}

const ACTIVE_STATE_LITERAL =
  /^(?:active|running|combat|wave|round|playing|in_progress|in-progress)$/i;

const INACTIVE_OR_TERMINAL_STATE_LITERAL =
  /^(?:idle|waiting|wait|ready|setup|preparing|prepare|lobby|complete|completed|finish|finished|done|victory|defeat|ended|end|stopped|stop|aborted|abort)$/i;

export function deriveProgressionActiveStateValues(
  transitions:
    readonly {
      readonly from: string;
      readonly to: readonly string[];
    }[],
): string[] {
  const adjacency =
    new Map<string, Set<string>>();
  const states = new Set<string>();

  for (const transition of transitions) {
    states.add(transition.from);
    const next =
      adjacency.get(transition.from) ??
      new Set<string>();
    for (const target of transition.to) {
      next.add(target);
      states.add(target);
    }
    adjacency.set(
      transition.from,
      next,
    );
  }

  const active =
    new Set(
      [...states].filter((state) =>
        ACTIVE_STATE_LITERAL.test(state)
      ),
    );
  const queue = [...active];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (
      const next of
        adjacency.get(current) ?? []
    ) {
      if (
        active.has(next) ||
        INACTIVE_OR_TERMINAL_STATE_LITERAL.test(
          next,
        )
      ) {
        continue;
      }
      active.add(next);
      queue.push(next);
    }
  }

  return [...active].sort();
}

function isActiveStateValue(
  value: string,
  activeStateValues:
    readonly string[],
): boolean {
  return (
    ACTIVE_STATE_LITERAL.test(value) ||
    activeStateValues.some(
      (candidate) =>
        candidate.toLowerCase() ===
        value.toLowerCase(),
    )
  );
}

function conditionProvesActiveState(
  expression: ts.Expression,
  file: ts.SourceFile,
  activeStateValues:
    readonly string[] = [],
): boolean {
  if (
    ts.isParenthesizedExpression(expression)
  ) {
    return conditionProvesActiveState(
      expression.expression,
      file,
      activeStateValues,
    );
  }

  if (
    ts.isBinaryExpression(expression) &&
    (
      expression.operatorToken.kind ===
        ts.SyntaxKind.EqualsEqualsToken ||
      expression.operatorToken.kind ===
        ts.SyntaxKind.EqualsEqualsEqualsToken
    )
  ) {
    const pairs: readonly [
      ts.Expression,
      ts.Expression,
    ][] = [
      [expression.left, expression.right],
      [expression.right, expression.left],
    ];
    return pairs.some(
      ([candidate, literal]) => {
        const value =
          literalString(literal);
        if (
          value === undefined ||
          !isActiveStateValue(
            value,
            activeStateValues,
          )
        ) {
          return false;
        }
        const target =
          candidate.getText(file);
        return /(?:state|status|phase|stage|wave|round|mode)/i.test(
          target,
        );
      },
    );
  }

  if (
    expression.kind ===
      ts.SyntaxKind.AmpersandAmpersandToken
  ) {
    return false;
  }

  if (
    ts.isBinaryExpression(expression) &&
    expression.operatorToken.kind ===
      ts.SyntaxKind.AmpersandAmpersandToken
  ) {
    return (
      conditionProvesActiveState(
        expression.left,
        file,
        activeStateValues,
      ) ||
      conditionProvesActiveState(
        expression.right,
        file,
        activeStateValues,
      )
    );
  }

  return false;
}

function isInsideActiveGuard(
  node: ts.Node,
  file: ts.SourceFile,
  activeStateValues:
    readonly string[] = [],
): boolean {
  let current: ts.Node | undefined =
    node.parent;
  while (current) {
    if (ts.isIfStatement(current)) {
      const statement =
        current.thenStatement;
      const position =
        node.getStart(file);
      if (
        position >=
          statement.getStart(file) &&
        position < statement.getEnd() &&
        conditionProvesActiveState(
          current.expression,
          file,
          activeStateValues,
        )
      ) {
        return true;
      }
    }
    if (
      ts.isFunctionDeclaration(current) ||
      ts.isMethodDeclaration(current) ||
      ts.isArrowFunction(current) ||
      ts.isFunctionExpression(current)
    ) {
      break;
    }
    current = current.parent;
  }
  return false;
}

function isZero(
  expression: ts.Expression,
): boolean {
  return numericLiteral(expression) === 0;
}

const PROGRESSION_EFFECT_NAME =
  /(?:next.*(?:wave|round|level|stage)|advance|progress|complete|finish|end(?:wave|round|level|stage)|proceed)/i;

function containsProgressionEffect(
  node: ts.Node,
  file: ts.SourceFile,
): boolean {
  let found = false;
  const visit = (current: ts.Node): void => {
    if (found) return;

    if (ts.isCallExpression(current)) {
      const target =
        current.expression.getText(file);
      if (
        PROGRESSION_EFFECT_NAME.test(
          target,
        )
      ) {
        found = true;
        return;
      }
    }

    if (
      ts.isBinaryExpression(current) &&
      current.operatorToken.kind ===
        ts.SyntaxKind.EqualsToken
    ) {
      const left =
        current.left.getText(file);
      const right =
        current.right.getText(file);
      if (
        /(?:state|status|phase|stage|wave|round|level|progress)/i.test(
          left,
        ) &&
        /(?:next|complete|completed|finish|finished|done|advance)/i.test(
          right,
        )
      ) {
        found = true;
        return;
      }
    }

    ts.forEachChild(
      current,
      visit,
    );
  };
  visit(node);
  return found;
}

function completionControlsProgression(
  node: ts.BinaryExpression,
  file: ts.SourceFile,
): boolean {
  let current: ts.Node | undefined =
    node.parent;

  while (current) {
    if (ts.isIfStatement(current)) {
      const start =
        current.expression.getStart(file);
      const end =
        current.expression.getEnd();
      const position =
        node.getStart(file);
      if (
        position >= start &&
        position < end
      ) {
        return (
          containsProgressionEffect(
            current.thenStatement,
            file,
          ) ||
          (
            current.elseStatement !==
              undefined &&
            containsProgressionEffect(
              current.elseStatement,
              file,
            )
          )
        );
      }
    }

    if (
      ts.isConditionalExpression(current)
    ) {
      const position =
        node.getStart(file);
      if (
        position >=
          current.condition.getStart(file) &&
        position <
          current.condition.getEnd()
      ) {
        return (
          containsProgressionEffect(
            current.whenTrue,
            file,
          ) ||
          containsProgressionEffect(
            current.whenFalse,
            file,
          )
        );
      }
    }

    if (
      ts.isFunctionDeclaration(current) ||
      ts.isMethodDeclaration(current) ||
      ts.isArrowFunction(current) ||
      ts.isFunctionExpression(current)
    ) {
      break;
    }
    current = current.parent;
  }

  return false;
}

function completionCounterInCondition(
  expression: ts.Expression,
): string | undefined {
  if (
    ts.isBinaryExpression(expression)
  ) {
    const direct =
      completionCounter(expression);
    if (direct) return direct;

    if (
      expression.operatorToken.kind ===
        ts.SyntaxKind.AmpersandAmpersandToken ||
      expression.operatorToken.kind ===
        ts.SyntaxKind.BarBarToken
    ) {
      return (
        completionCounterInCondition(
          expression.left,
        ) ??
        completionCounterInCondition(
          expression.right,
        )
      );
    }
  }

  if (
    ts.isParenthesizedExpression(expression)
  ) {
    return completionCounterInCondition(
      expression.expression,
    );
  }

  return undefined;
}

function progressionCallsInStatement(
  statement: ts.Statement,
  file: ts.SourceFile,
  source: SourceRef,
  counter: string,
): ScriptProgressionAdvanceEvidence[] {
  const output:
    ScriptProgressionAdvanceEvidence[] = [];

  const visit = (node: ts.Node): void => {
    if (
      node !== statement &&
      (
        ts.isFunctionDeclaration(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isArrowFunction(node) ||
        ts.isFunctionExpression(node)
      )
    ) {
      return;
    }

    if (ts.isCallExpression(node)) {
      const target =
        node.expression.getText(file);
      if (
        PROGRESSION_EFFECT_NAME.test(
          target,
        )
      ) {
        output.push({
          counterId: counter,
          effectTarget: target,
          executionRegion:
            executionRegion(
              node,
              file,
            ),
          source:
            nodeSource(
              file,
              node,
              source,
            ),
        });
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(statement);
  return output;
}

function completionCounter(
  node: ts.BinaryExpression,
): string | undefined {
  const operator =
    node.operatorToken.kind;
  const direct =
    counterId(node.left);
  const reverse =
    counterId(node.right);

  if (
    direct &&
    isZero(node.right) &&
    (
      operator ===
        ts.SyntaxKind.EqualsEqualsToken ||
      operator ===
        ts.SyntaxKind.EqualsEqualsEqualsToken ||
      operator ===
        ts.SyntaxKind.LessThanEqualsToken
    )
  ) {
    return direct;
  }

  if (
    reverse &&
    isZero(node.left) &&
    (
      operator ===
        ts.SyntaxKind.EqualsEqualsToken ||
      operator ===
        ts.SyntaxKind.EqualsEqualsEqualsToken ||
      operator ===
        ts.SyntaxKind.GreaterThanEqualsToken
    )
  ) {
    return reverse;
  }

  return undefined;
}

export function deriveScriptProgressionCounterEvidence(
  text: string,
  source: SourceRef,
): ScriptProgressionCounterEvidence[] {
  const file = ts.createSourceFile(
    source.relativePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(source.relativePath),
  );
  const output:
    ScriptProgressionCounterEvidence[] = [];

  const push = (
    node: ts.Node,
    values: Omit<
      ScriptProgressionCounterEvidence,
      "executionRegion" |
      "executionShape" |
      "source"
    >,
  ) => {
    output.push({
      ...values,
      executionRegion:
        executionRegion(node, file),
      executionShape:
        executionShape(node),
      source: nodeSource(
        file,
        node,
        source,
      ),
    });
  };

  const visit = (node: ts.Node): void => {
    if (
      ts.isPrefixUnaryExpression(node) ||
      ts.isPostfixUnaryExpression(node)
    ) {
      const id =
        counterId(node.operand);
      if (id) {
        if (
          node.operator ===
          ts.SyntaxKind.PlusPlusToken
        ) {
          push(node, {
            kind: "growth",
            counterKind: "variable",
            counterId: id,
            amount: 1,
          });
        } else if (
          node.operator ===
          ts.SyntaxKind.MinusMinusToken
        ) {
          push(node, {
            kind: "decrement",
            counterKind: "variable",
            counterId: id,
            amount: 1,
          });
        }
      }
    }

    if (ts.isBinaryExpression(node)) {
      const id =
        counterId(node.left);
      const operator =
        node.operatorToken.kind;

      if (id) {
        if (
          operator ===
          ts.SyntaxKind.PlusEqualsToken
        ) {
          const amount =
            numericLiteral(node.right);
          if (
            amount !== undefined &&
            amount > 0
          ) {
            push(node, {
              kind: "growth",
              counterKind: "variable",
              counterId: id,
              amount,
            });
          } else if (
            amount !== undefined &&
            amount < 0
          ) {
            push(node, {
              kind: "decrement",
              counterKind: "variable",
              counterId: id,
              amount:
                Math.abs(amount),
            });
          }
        } else if (
          operator ===
          ts.SyntaxKind.MinusEqualsToken
        ) {
          const amount =
            numericLiteral(node.right);
          if (
            amount !== undefined &&
            amount > 0
          ) {
            push(node, {
              kind: "decrement",
              counterKind: "variable",
              counterId: id,
              amount,
            });
          }
        } else if (
          operator ===
          ts.SyntaxKind.EqualsToken
        ) {
          push(node, {
            kind: "replacement",
            counterKind: "variable",
            counterId: id,
          });
        }
      }

      const completion =
        completionCounter(node);
      if (
        completion &&
        completionControlsProgression(
          node,
          file,
        )
      ) {
        push(node, {
          kind: "completion-check",
          counterKind: "variable",
          counterId: completion,
        });
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(file);

  return output
    .filter((item, index, all) =>
      all.findIndex((candidate) =>
        candidate.kind === item.kind &&
        candidate.counterKind ===
          item.counterKind &&
        candidate.counterId ===
          item.counterId &&
        candidate.executionRegion ===
          item.executionRegion &&
        candidate.source.range?.lineStart ===
          item.source.range?.lineStart
      ) === index
    )
    .sort((a, b) =>
      a.executionRegion.localeCompare(
        b.executionRegion,
      ) ||
      a.counterId.localeCompare(
        b.counterId,
      ) ||
      a.kind.localeCompare(b.kind)
    );
}

function guardedStateValue(
  expression: ts.Expression,
  file: ts.SourceFile,
): {
  readonly target: string;
  readonly value: string;
} | undefined {
  if (
    ts.isParenthesizedExpression(expression)
  ) {
    return guardedStateValue(
      expression.expression,
      file,
    );
  }

  if (
    !ts.isBinaryExpression(expression) ||
    (
      expression.operatorToken.kind !==
        ts.SyntaxKind.EqualsEqualsToken &&
      expression.operatorToken.kind !==
        ts.SyntaxKind.EqualsEqualsEqualsToken
    )
  ) {
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
    const value =
      literalString(literal);
    if (value === undefined) continue;
    const target =
      candidate.getText(file);
    if (
      /(?:state|status|phase|stage|wave|round|mode)/i.test(
        target,
      )
    ) {
      return {
        target,
        value,
      };
    }
  }

  return undefined;
}

function assignmentsInStatement(
  statement: ts.Statement,
  file: ts.SourceFile,
): readonly {
  readonly target: string;
  readonly value: string;
  readonly node: ts.BinaryExpression;
}[] {
  const output: {
    target: string;
    value: string;
    node: ts.BinaryExpression;
  }[] = [];

  const visit = (node: ts.Node): void => {
    if (
      node !== statement &&
      (
        ts.isFunctionDeclaration(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isArrowFunction(node) ||
        ts.isFunctionExpression(node)
      )
    ) {
      return;
    }

    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind ===
        ts.SyntaxKind.EqualsToken
    ) {
      const target =
        node.left.getText(file);
      const value =
        literalString(node.right);
      if (
        value !== undefined &&
        /(?:state|status|phase|stage|wave|round|mode)/i.test(
          target,
        )
      ) {
        output.push({
          target,
          value,
          node,
        });
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(statement);
  return output;
}

export function deriveScriptProgressionStateTransitionEvidence(
  text: string,
  source: SourceRef,
): ScriptProgressionStateTransitionEvidence[] {
  return deriveScriptProgressionStateTransitionEvidenceFromSourceFile(text, source);
}

function deriveScriptProgressionStateTransitionEvidenceFromSourceFile(
  text: string,
  source: SourceRef,
  parsedFile?: ts.SourceFile,
): ScriptProgressionStateTransitionEvidence[] {
  // The optional file is supplied only by the same selected-script bundle.
  // A mismatched source falls back to the independent canonical parse.
  const file = parsedFile?.text === text &&
    parsedFile.fileName === source.relativePath
    ? parsedFile
    : ts.createSourceFile(
        source.relativePath,
        text,
        ts.ScriptTarget.Latest,
        true,
        scriptKind(source.relativePath),
      );
  const output:
    ScriptProgressionStateTransitionEvidence[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isIfStatement(node)) {
      const guarded =
        guardedStateValue(
          node.expression,
          file,
        );
      if (guarded) {
        for (
          const assignment of
            assignmentsInStatement(
              node.thenStatement,
              file,
            )
        ) {
          if (
            assignment.target !==
              guarded.target ||
            assignment.value ===
              guarded.value
          ) {
            continue;
          }
          output.push({
            target:
              guarded.target,
            from:
              guarded.value,
            to:
              assignment.value,
            executionRegion:
              executionRegion(
                assignment.node,
                file,
              ),
            source:
              nodeSource(
                file,
                assignment.node,
                source,
              ),
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(file);

  return output
    .filter((item, index, all) =>
      all.findIndex((candidate) =>
        candidate.target === item.target &&
        candidate.from === item.from &&
        candidate.to === item.to &&
        candidate.executionRegion ===
          item.executionRegion &&
        candidate.source.range?.lineStart ===
          item.source.range?.lineStart
      ) === index
    )
    .sort((a, b) =>
      a.target.localeCompare(b.target) ||
      a.from.localeCompare(b.from) ||
      a.to.localeCompare(b.to)
    );
}

function directStateAssignment(
  statement: ts.Statement,
  file: ts.SourceFile,
): {
  readonly target: string;
  readonly value?: string;
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

  const target =
    statement.expression.left.getText(file);
  if (
    !/(?:state|status|phase|stage|wave|round|mode)/i.test(
      target,
    )
  ) {
    return undefined;
  }

  const value = literalString(statement.expression.right);
  return { target, ...(value === undefined ? {} : { value }) };
}

function transitionOwnedCallsAndEvents(
  statement: ts.Statement,
  file: ts.SourceFile,
  source: SourceRef,
  calls:
    ScriptProgressionActiveCallEvidence[],
  events:
    ScriptProgressionActiveEventEvidence[],
): void {
  const visit = (node: ts.Node): void => {
    if (
      node !== statement &&
      (
        ts.isFunctionDeclaration(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isArrowFunction(node) ||
        ts.isFunctionExpression(node)
      )
    ) {
      return;
    }

    if (ts.isCallExpression(node)) {
      const region =
        executionRegion(node, file);

      if (
        ts.isPropertyAccessExpression(
          node.expression,
        ) &&
        node.expression.name.text ===
          "triggerEvent"
      ) {
        const event =
          literalString(
            node.arguments[0],
          );
        if (event) {
          events.push({
            event,
            executionRegion: region,
            basis: "transition",
            source:
              nodeSource(
                file,
                node,
                source,
              ),
          });
        }
      } else if (
        ts.isPropertyAccessExpression(
          node.expression,
        ) &&
        (
          node.expression.name.text ===
            "runCommand" ||
          node.expression.name.text ===
            "runCommandAsync"
        )
      ) {
        const command =
          literalString(
            node.arguments[0],
          );
        const match =
          command?.match(
            /^\/?event\s+entity\s+\S+\s+([A-Za-z0-9_.:-]+)/i,
          );
        if (match?.[1]) {
          events.push({
            event: match[1],
            executionRegion: region,
            basis: "transition",
            source:
              nodeSource(
                file,
                node,
                source,
              ),
          });
        }
      } else {
        let targetName:
          string | undefined;
        if (
          ts.isIdentifier(
            node.expression,
          )
        ) {
          targetName =
            node.expression.text;
        } else if (
          ts.isPropertyAccessExpression(
            node.expression,
          ) &&
          node.expression.expression.kind ===
            ts.SyntaxKind.ThisKeyword
        ) {
          targetName =
            node.expression.name.text;
        }

        if (
          targetName &&
          !/^(?:spawnEntity)$/i.test(
            targetName,
          )
        ) {
          calls.push({
            callerRegion: region,
            targetName,
            basis: "transition",
            source:
              nodeSource(
                file,
                node,
                source,
              ),
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(statement);
}

function returnOnlyStatement(
  statement: ts.Statement,
): boolean {
  if (ts.isReturnStatement(statement)) {
    return true;
  }
  return (
    ts.isBlock(statement) &&
    statement.statements.length === 1 &&
    ts.isReturnStatement(
      statement.statements[0]!,
    )
  );
}

function literalGuardValue(
  expression: ts.Expression,
): string | undefined {
  const stringValue =
    literalString(expression);
  if (stringValue !== undefined) {
    return stringValue;
  }
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
  if (ts.isNumericLiteral(expression)) {
    return expression.text;
  }
  return undefined;
}

function idempotencyGuard(
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
      literalGuardValue(literal);
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

function directLatchAssignment(
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
    literalGuardValue(
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

function idempotencyEvidenceForFunction(
  node:
    | ts.FunctionDeclaration
    | ts.MethodDeclaration,
  file: ts.SourceFile,
  source: SourceRef,
): ScriptProgressionIdempotencyEvidence | undefined {
  const body = node.body;
  if (
    !body ||
    body.statements.length < 2
  ) {
    return undefined;
  }

  const nameNode = node.name;
  if (
    !nameNode ||
    (
      !ts.isIdentifier(nameNode) &&
      !ts.isStringLiteralLike(nameNode)
    )
  ) {
    return undefined;
  }
  const functionName = nameNode.text;
  if (
    !PROGRESSION_EFFECT_NAME.test(
      functionName,
    )
  ) {
    return undefined;
  }

  const guardStatement =
    body.statements[0]!;
  const latchStatement =
    body.statements[1]!;
  if (
    !ts.isIfStatement(
      guardStatement,
    ) ||
    guardStatement.elseStatement !==
      undefined ||
    !returnOnlyStatement(
      guardStatement.thenStatement,
    )
  ) {
    return undefined;
  }

  const guard =
    idempotencyGuard(
      guardStatement.expression,
      file,
    );
  const latch =
    directLatchAssignment(
      latchStatement,
      file,
    );
  if (
    !guard ||
    !latch ||
    guard.target !== latch.target
  ) {
    return undefined;
  }

  const protectedByLatch =
    (
      guard.mode === "truthy" &&
      latch.value === "true"
    ) ||
    (
      guard.mode === "equal" &&
      guard.value === latch.value
    ) ||
    (
      guard.mode === "not-equal" &&
      guard.value !== undefined &&
      guard.value !== latch.value
    );

  if (!protectedByLatch) {
    return undefined;
  }

  return {
    functionRegion:
      "function:" +
      functionName,
    guardTarget:
      guard.target,
    kind:
      guard.mode === "truthy"
        ? "boolean-latch"
        : "state-latch",
    source:
      nodeSource(
        file,
        latch.sourceNode,
        source,
      ),
  };
}

export function deriveScriptProgressionIdempotencyEvidence(
  text: string,
  source: SourceRef,
): ScriptProgressionIdempotencyEvidence[] {
  return deriveScriptProgressionIdempotencyEvidenceFromSourceFile(text, source);
}

function deriveScriptProgressionIdempotencyEvidenceFromSourceFile(
  text: string,
  source: SourceRef,
  parsedFile?: ts.SourceFile,
): ScriptProgressionIdempotencyEvidence[] {
  // The optional file is supplied only by the same selected-script bundle.
  // A mismatched source falls back to the independent canonical parse.
  const file = parsedFile?.text === text &&
    parsedFile.fileName === source.relativePath
    ? parsedFile
    : ts.createSourceFile(
        source.relativePath,
        text,
        ts.ScriptTarget.Latest,
        true,
        scriptKind(source.relativePath),
      );
  const output:
    ScriptProgressionIdempotencyEvidence[] = [];

  const visit = (node: ts.Node): void => {
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isMethodDeclaration(node)
    ) {
      const evidence =
        idempotencyEvidenceForFunction(
          node,
          file,
          source,
        );
      if (evidence) {
        output.push(evidence);
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

export function deriveScriptProgressionOrdinalAdvanceEvidence(
  text: string,
  source: SourceRef,
): ScriptProgressionOrdinalAdvanceEvidence[] {
  return deriveScriptProgressionOrdinalAdvanceEvidenceFromSourceFile(text, source);
}

function deriveScriptProgressionOrdinalAdvanceEvidenceFromSourceFile(
  text: string,
  source: SourceRef,
  parsedFile?: ts.SourceFile,
): ScriptProgressionOrdinalAdvanceEvidence[] {
  // The optional file is supplied only by the same selected-script bundle.
  // A mismatched source falls back to the independent canonical parse.
  const file = parsedFile?.text === text &&
    parsedFile.fileName === source.relativePath
    ? parsedFile
    : ts.createSourceFile(
        source.relativePath,
        text,
        ts.ScriptTarget.Latest,
        true,
        scriptKind(source.relativePath),
      );
  const output:
    ScriptProgressionOrdinalAdvanceEvidence[] = [];
  const targetPattern =
    /(?:wave|round|level|stage|phase|progress)/i;

  const push = (
    node: ts.Node,
    target: string,
    amount: number,
  ) => {
    if (
      !targetPattern.test(target) ||
      amount <= 0
    ) return;
    output.push({
      target,
      amount,
      executionRegion:
        executionRegion(node, file),
      executionShape:
        executionShape(node),
      source:
        nodeSource(file, node, source),
    });
  };

  const visit = (node: ts.Node): void => {
    if (
      (ts.isPrefixUnaryExpression(node) ||
        ts.isPostfixUnaryExpression(node)) &&
      node.operator ===
        ts.SyntaxKind.PlusPlusToken
    ) {
      push(
        node,
        node.operand.getText(file),
        1,
      );
    }

    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind ===
        ts.SyntaxKind.PlusEqualsToken
    ) {
      const amount =
        numericLiteral(node.right);
      if (
        amount !== undefined &&
        amount > 0
      ) {
        push(
          node,
          node.left.getText(file),
          amount,
        );
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(file);

  return output
    .filter((item, index, all) =>
      all.findIndex((candidate) =>
        candidate.target === item.target &&
        candidate.amount === item.amount &&
        candidate.executionRegion ===
          item.executionRegion &&
        candidate.source.range?.lineStart ===
          item.source.range?.lineStart
      ) === index
    )
    .sort((a, b) =>
      a.executionRegion.localeCompare(
        b.executionRegion,
      ) ||
      a.target.localeCompare(b.target) ||
      (
        a.source.range?.lineStart ?? 0
      ) -
        (
          b.source.range?.lineStart ?? 0
        )
    );
}

export function deriveScriptProgressionAdvanceEvidence(
  text: string,
  source: SourceRef,
): ScriptProgressionAdvanceEvidence[] {
  return deriveScriptProgressionAdvanceEvidenceFromSourceFile(text, source);
}

function deriveScriptProgressionAdvanceEvidenceFromSourceFile(
  text: string,
  source: SourceRef,
  parsedFile?: ts.SourceFile,
): ScriptProgressionAdvanceEvidence[] {
  // The optional file is supplied only by the same selected-script bundle.
  // A mismatched source falls back to the independent canonical parse.
  const file = parsedFile?.text === text &&
    parsedFile.fileName === source.relativePath
    ? parsedFile
    : ts.createSourceFile(
        source.relativePath,
        text,
        ts.ScriptTarget.Latest,
        true,
        scriptKind(source.relativePath),
      );
  const output:
    ScriptProgressionAdvanceEvidence[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isIfStatement(node)) {
      const counter =
        completionCounterInCondition(
          node.expression,
        );
      if (counter) {
        output.push(
          ...progressionCallsInStatement(
            node.thenStatement,
            file,
            source,
            counter,
          ),
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
    a.counterId.localeCompare(
      b.counterId,
    ) ||
    a.effectTarget.localeCompare(
      b.effectTarget,
    ) ||
    (
      a.source.range?.lineStart ?? 0
    ) -
      (
        b.source.range?.lineStart ?? 0
      )
  );
}

export function deriveScriptProgressionActiveTransitionEvidence(
  text: string,
  source: SourceRef,
  activeStateValues:
    readonly string[] = [],
): {
  readonly calls:
    ScriptProgressionActiveCallEvidence[];
  readonly events:
    ScriptProgressionActiveEventEvidence[];
} {
  return deriveScriptProgressionActiveTransitionEvidenceFromSourceFile(text, source, activeStateValues);
}

function deriveScriptProgressionActiveTransitionEvidenceFromSourceFile(
  text: string,
  source: SourceRef,
  activeStateValues:
    readonly string[] = [],
  parsedFile?: ts.SourceFile,
): {
  readonly calls:
    ScriptProgressionActiveCallEvidence[];
  readonly events:
    ScriptProgressionActiveEventEvidence[];
} {
  // The optional file is supplied only by the same selected-script bundle.
  // A mismatched source falls back to the independent canonical parse.
  const file = parsedFile?.text === text &&
    parsedFile.fileName === source.relativePath
    ? parsedFile
    : ts.createSourceFile(
        source.relativePath,
        text,
        ts.ScriptTarget.Latest,
        true,
        scriptKind(source.relativePath),
      );
  const calls:
    ScriptProgressionActiveCallEvidence[] = [];
  const events:
    ScriptProgressionActiveEventEvidence[] = [];

  const scanStatements = (
    statements:
      readonly ts.Statement[],
  ): void => {
    const activeTargets =
      new Set<string>();

    for (const statement of statements) {
      const assignment =
        directStateAssignment(
          statement,
          file,
        );
      if (assignment) {
        if (
          assignment.value !== undefined &&
          isActiveStateValue(
            assignment.value,
            activeStateValues,
          )
        ) {
          activeTargets.add(
            assignment.target,
          );
        } else {
          activeTargets.delete(
            assignment.target,
          );
        }
        continue;
      }

      if (activeTargets.size > 0) {
        transitionOwnedCallsAndEvents(
          statement,
          file,
          source,
          calls,
          events,
        );
      }
    }
  };

  scanStatements(file.statements);
  for (const statement of file.statements) {
    if (
      ts.isFunctionDeclaration(statement) &&
      statement.body
    ) {
      scanStatements(
        statement.body.statements,
      );
    }
  }

  const uniqueCalls =
    calls.filter((item, index, all) =>
      all.findIndex((candidate) =>
        candidate.callerRegion ===
          item.callerRegion &&
        candidate.targetName ===
          item.targetName &&
        candidate.source.range?.lineStart ===
          item.source.range?.lineStart
      ) === index
    );
  const uniqueEvents =
    events.filter((item, index, all) =>
      all.findIndex((candidate) =>
        candidate.event === item.event &&
        candidate.executionRegion ===
          item.executionRegion &&
        candidate.source.range?.lineStart ===
          item.source.range?.lineStart
      ) === index
    );

  return {
    calls: uniqueCalls.sort((a, b) =>
      a.callerRegion.localeCompare(
        b.callerRegion,
      ) ||
      a.targetName.localeCompare(
        b.targetName,
      )
    ),
    events: uniqueEvents.sort((a, b) =>
      a.executionRegion.localeCompare(
        b.executionRegion,
      ) ||
      a.event.localeCompare(b.event)
    ),
  };
}

export function deriveScriptProgressionActiveCallEvidence(
  text: string,
  source: SourceRef,
  activeStateValues:
    readonly string[] = [],
): ScriptProgressionActiveCallEvidence[] {
  return deriveScriptProgressionActiveCallEvidenceFromSourceFile(text, source, activeStateValues);
}

function deriveScriptProgressionActiveCallEvidenceFromSourceFile(
  text: string,
  source: SourceRef,
  activeStateValues:
    readonly string[] = [],
  parsedFile?: ts.SourceFile,
): ScriptProgressionActiveCallEvidence[] {
  // The optional file is supplied only by the same selected-script bundle.
  // A mismatched source falls back to the independent canonical parse.
  const file = parsedFile?.text === text &&
    parsedFile.fileName === source.relativePath
    ? parsedFile
    : ts.createSourceFile(
        source.relativePath,
        text,
        ts.ScriptTarget.Latest,
        true,
        scriptKind(source.relativePath),
      );
  const output:
    ScriptProgressionActiveCallEvidence[] = [];

  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      isInsideActiveGuard(
        node,
        file,
        activeStateValues,
      )
    ) {
      let targetName:
        string | undefined;
      if (
        ts.isIdentifier(
          node.expression,
        )
      ) {
        targetName =
          node.expression.text;
      } else if (
        ts.isPropertyAccessExpression(
          node.expression,
        ) &&
        node.expression.expression.kind ===
          ts.SyntaxKind.ThisKeyword
      ) {
        targetName =
          node.expression.name.text;
      }

      if (
        targetName &&
        !/^(?:triggerEvent|runCommand|runCommandAsync|spawnEntity)$/i.test(
          targetName,
        )
      ) {
        output.push({
          callerRegion:
            executionRegion(
              node,
              file,
            ),
          targetName,
          basis: "guard",
          source:
            nodeSource(
              file,
              node,
              source,
            ),
        });
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(file);

  return output
    .filter((item, index, all) =>
      all.findIndex((candidate) =>
        candidate.callerRegion ===
          item.callerRegion &&
        candidate.targetName ===
          item.targetName &&
        candidate.source.range?.lineStart ===
          item.source.range?.lineStart
      ) === index
    )
    .sort((a, b) =>
      a.callerRegion.localeCompare(
        b.callerRegion,
      ) ||
      a.targetName.localeCompare(
        b.targetName,
      )
    );
}

export function deriveScriptProgressionActiveEventEvidence(
  text: string,
  source: SourceRef,
  activeStateValues:
    readonly string[] = [],
): ScriptProgressionActiveEventEvidence[] {
  return deriveScriptProgressionActiveEventEvidenceFromSourceFile(text, source, activeStateValues);
}

function deriveScriptProgressionActiveEventEvidenceFromSourceFile(
  text: string,
  source: SourceRef,
  activeStateValues:
    readonly string[] = [],
  parsedFile?: ts.SourceFile,
): ScriptProgressionActiveEventEvidence[] {
  // The optional file is supplied only by the same selected-script bundle.
  // A mismatched source falls back to the independent canonical parse.
  const file = parsedFile?.text === text &&
    parsedFile.fileName === source.relativePath
    ? parsedFile
    : ts.createSourceFile(
        source.relativePath,
        text,
        ts.ScriptTarget.Latest,
        true,
        scriptKind(source.relativePath),
      );
  const output:
    ScriptProgressionActiveEventEvidence[] = [];

  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      isInsideActiveGuard(
        node,
        file,
        activeStateValues,
      )
    ) {
      if (
        ts.isPropertyAccessExpression(
          node.expression,
        ) &&
        node.expression.name.text ===
          "triggerEvent"
      ) {
        const event =
          literalString(
            node.arguments[0],
          );
        if (event) {
          output.push({
            event,
            executionRegion:
              executionRegion(
                node,
                file,
              ),
            basis: "guard",
            source:
              nodeSource(
                file,
                node,
                source,
              ),
          });
        }
      }

      if (
        ts.isPropertyAccessExpression(
          node.expression,
        ) &&
        (
          node.expression.name.text ===
            "runCommand" ||
          node.expression.name.text ===
            "runCommandAsync"
        )
      ) {
        const command =
          literalString(
            node.arguments[0],
          );
        const match =
          command?.match(
            /^\/?event\s+entity\s+\S+\s+([A-Za-z0-9_.:-]+)/i,
          );
        if (match?.[1]) {
          output.push({
            event: match[1],
            executionRegion:
              executionRegion(
                node,
                file,
              ),
            basis: "guard",
            source:
              nodeSource(
                file,
                node,
                source,
              ),
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(file);

  return output
    .filter((item, index, all) =>
      all.findIndex((candidate) =>
        candidate.event === item.event &&
        candidate.executionRegion ===
          item.executionRegion &&
        candidate.source.range?.lineStart ===
          item.source.range?.lineStart
      ) === index
    )
    .sort((a, b) =>
      a.executionRegion.localeCompare(
        b.executionRegion,
      ) ||
      a.event.localeCompare(b.event)
    );
}

export function deriveScriptProgressionActorSpawnEvidence(
  text: string,
  source: SourceRef,
): ScriptProgressionActorSpawnEvidence[] {
  const file = ts.createSourceFile(
    source.relativePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(source.relativePath),
  );
  const output:
    ScriptProgressionActorSpawnEvidence[] = [];

  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(
        node.expression,
      ) &&
      node.expression.name.text ===
        "spawnEntity"
    ) {
      const actorIdentifier =
        literalString(node.arguments[0]);
      if (
        actorIdentifier &&
        /^[a-z0-9_.-]+:[a-z0-9_./-]+$/i.test(
          actorIdentifier,
        )
      ) {
        output.push({
          actorIdentifier:
            actorIdentifier.toLowerCase(),
          executionRegion:
            executionRegion(node, file),
          executionShape:
            executionShape(node),
          source:
            nodeSource(
              file,
              node,
              source,
            ),
        });
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(file);

  return output
    .filter((item, index, all) =>
      all.findIndex((candidate) =>
        candidate.actorIdentifier ===
          item.actorIdentifier &&
        candidate.executionRegion ===
          item.executionRegion &&
        candidate.source.range?.lineStart ===
          item.source.range?.lineStart
      ) === index
    )
    .sort((a, b) =>
      a.executionRegion.localeCompare(
        b.executionRegion,
      ) ||
      a.actorIdentifier.localeCompare(
        b.actorIdentifier,
      )
    );
}

const ACTOR_REGISTRY_NAME =
  /(?:enemy|enemies|hostile|hostiles|mob|mobs|actor|actors|entity|entities|registry)/i;
const GENERATION_BINDING_NAME =
  /(?:generation|epoch|roundid|sessionid|waveid|lifeid)/i;

function actorRegistryCollection(
  expression: ts.Expression,
  file: ts.SourceFile,
): string | undefined {
  const text = expression.getText(file);
  return ACTOR_REGISTRY_NAME.test(text)
    ? text
    : undefined;
}

export function deriveScriptProgressionActorRegistryEvidence(
  text: string,
  source: SourceRef,
): ScriptProgressionActorRegistryEvidence[] {
  const file = ts.createSourceFile(
    source.relativePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(source.relativePath),
  );
  const actorVariables = new Map<string, string>();
  const output: ScriptProgressionActorRegistryEvidence[] = [];

  const collectActors = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      ts.isPropertyAccessExpression(node.initializer.expression) &&
      node.initializer.expression.name.text === "spawnEntity"
    ) {
      const actorIdentifier =
        literalString(node.initializer.arguments[0]);
      if (
        actorIdentifier &&
        /^[a-z0-9_.-]+:[a-z0-9_./-]+$/i.test(actorIdentifier)
      ) {
        actorVariables.set(
          node.name.text,
          actorIdentifier.toLowerCase(),
        );
      }
    }
    ts.forEachChild(node, collectActors);
  };
  collectActors(file);

  const push = (
    node: ts.Node,
    registryExpression: string,
    action: ScriptProgressionActorRegistryEvidence["action"],
    actorIdentifier?: string,
  ) => {
    output.push({
      registryExpression,
      action,
      executionRegion:
        executionRegion(node, file),
      generationBound:
        GENERATION_BINDING_NAME.test(
          registryExpression.replace(/[^A-Za-z0-9]/g, ""),
        ),
      ...(actorIdentifier === undefined
        ? {}
        : { actorIdentifier }),
      source: nodeSource(file, node, source),
    });
  };

  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression)
    ) {
      const method = node.expression.name.text;
      const registryExpression =
        actorRegistryCollection(
          node.expression.expression,
          file,
        );
      if (
        registryExpression &&
        (method === "add" || method === "set")
      ) {
        const first = node.arguments[0];
        const actorVariable =
          first &&
          (
            ts.isPropertyAccessExpression(first)
              ? first.expression
              : first
          );
        const actorIdentifier =
          actorVariable &&
          ts.isIdentifier(actorVariable)
            ? actorVariables.get(actorVariable.text)
            : undefined;
        push(
          node,
          registryExpression,
          "materialize",
          actorIdentifier,
        );
      } else if (
        registryExpression &&
        method === "delete"
      ) {
        push(node, registryExpression, "release");
      }
    }

    if (
      ts.isBinaryExpression(node) &&
      completionControlsProgression(node, file)
    ) {
      const pairs: readonly [ts.Expression, ts.Expression][] = [
        [node.left, node.right],
        [node.right, node.left],
      ];
      for (const [candidate, zero] of pairs) {
        if (
          !isZero(zero) ||
          !ts.isPropertyAccessExpression(candidate) ||
          candidate.name.text !== "size"
        ) {
          continue;
        }
        const registryExpression =
          actorRegistryCollection(
            candidate.expression,
            file,
          );
        if (registryExpression) {
          push(
            node,
            registryExpression,
            "completion-check",
          );
          break;
        }
      }
    }

    ts.forEachChild(node, visit);
  };
  visit(file);

  return output
    .filter((item, index, all) =>
      all.findIndex((candidate) =>
        candidate.registryExpression === item.registryExpression &&
        candidate.action === item.action &&
        candidate.executionRegion === item.executionRegion &&
        candidate.source.range?.lineStart ===
          item.source.range?.lineStart
      ) === index
    )
    .sort((a, b) =>
      a.registryExpression.localeCompare(
        b.registryExpression,
      ) ||
      a.action.localeCompare(b.action) ||
      a.executionRegion.localeCompare(
        b.executionRegion,
      )
    );
}

/** Parse one exact selected source for related progression analyses. These
 * seven existing detectors retain independent dispositions and return values;
 * only their transient TypeScript syntax tree is shared within this call.
 * The tree is not retained in the resulting evidence or Semantic IR.
 */
export function deriveScriptProgressionRuntimeEvidenceBundle(
  text: string,
  source: SourceRef,
  activeStateValues: readonly string[] = [],
) {
  const file = ts.createSourceFile(
    source.relativePath, text, ts.ScriptTarget.Latest,
    true, scriptKind(source.relativePath),
  );
  return {
    activeEvents: deriveScriptProgressionActiveEventEvidenceFromSourceFile(text, source, activeStateValues, file),
    activeCalls: deriveScriptProgressionActiveCallEvidenceFromSourceFile(text, source, activeStateValues, file),
    activeTransition: deriveScriptProgressionActiveTransitionEvidenceFromSourceFile(text, source, activeStateValues, file),
    stateTransitions: deriveScriptProgressionStateTransitionEvidenceFromSourceFile(text, source, file),
    advances: deriveScriptProgressionAdvanceEvidenceFromSourceFile(text, source, file),
    ordinals: deriveScriptProgressionOrdinalAdvanceEvidenceFromSourceFile(text, source, file),
    idempotency: deriveScriptProgressionIdempotencyEvidenceFromSourceFile(text, source, file),
  };
}
