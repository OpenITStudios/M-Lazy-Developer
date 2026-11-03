import ts from "typescript";
import type { ParsedScriptFile } from "../../../../analyzers/scripts/src/index.js";
import type { SemanticGraph, SemanticNode } from "../../../graph/src/index.js";
import type {
  GameplayIntentRelationSignal,
  GameplayIntentSignal,
} from "../../../../analyzers/gameplay-intent/src/index.js";

/**
 * Read-only projection of exact authored BP block/item/loot definitions into
 * the canonical Gameplay Intent source-evidence path. The SemanticGraph
 * remains the sole reference owner. A declaration is NOT a played mechanic,
 * an observed drop, a completed objective, or an approved game-design rule.
 *
 * Unsupported / dynamic / conditional loot entries intentionally produce no
 * item-output relation. The original semantic-coverage gaps are preserved;
 * this projection alone does not close A7 source-understanding admission.
 */
export interface OwnedGameplaySourceSignals {
  readonly signals: readonly GameplayIntentSignal[];
  readonly relations: readonly GameplayIntentRelationSignal[];
}

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined;

const number = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const sourceIdentity = (node: SemanticNode): string =>
  "resource:bp-definition:" + encodeURIComponent(node.source.relativePath);

const lootItemIdentity = (pack: string, itemId: string): string =>
  "resource:bp-loot-item:" + encodeURIComponent(pack) + ":" +
  encodeURIComponent(itemId);

const packRoot = (path: string): string | undefined => {
  const segments = path.replaceAll("\\", "/").split("/");
  if (segments.length < 4 || !["behavior_packs", "behavior_pack"].includes(segments[0]!)) {
    return undefined;
  }
  return segments.slice(0, 2).join("/");
};

const signal = (node: SemanticNode, label: string, pointer: string,
  summary: string): GameplayIntentSignal => ({
  id: "signal:bp-definition:" + encodeURIComponent(
    node.source.artifactId + ":" + node.source.relativePath),
  subjectKey: sourceIdentity(node),
  nodeKind: "resource",
  label,
  status: "inferred",
  evidenceOrigin: "source-code",
  locator: node.source.relativePath + "#" + pointer,
  summary: summary + " Authored source declaration only; activation, " +
    "player use and gameplay outcomes are not observed.",
});

const link = (node: SemanticNode, from: string, to: string,
  kind: GameplayIntentRelationSignal["edgeKind"], pointer: string,
  summary: string): GameplayIntentRelationSignal => ({
  id: "bp-definition-link:" + encodeURIComponent(
    node.source.artifactId + ":" + node.source.relativePath + ":" + pointer + ":" + to),
  fromSubjectKey: from,
  toSubjectKey: to,
  edgeKind: kind,
  status: "inferred",
  evidenceOrigin: "source-code",
  locator: node.source.relativePath + "#" + pointer,
  summary,
});

/** Only a single literal, unconditioned pool-entry declaration qualifies.
 * Even then the output is a *possible authored reward*, not a player drop.
 * Later mechanics (silk touch, game rules, API hooks, loot activation) may
 * change what happens during actual play. */
const literalLootOutputs = (node: SemanticNode): readonly {
  itemId: string; count?: number; pointer: string;
}[] => {
  const doc = asRecord(node.data);
  const pools = doc?.pools;
  if (!Array.isArray(pools) || pools.length > 32) return [];
  if (doc?.conditions !== undefined || doc?.functions !== undefined) return [];
  const output: Array<{itemId: string; count?: number; pointer: string}> = [];
  for (const [poolIndex, value] of pools.entries()) {
    const pool = asRecord(value);
    if (!pool || pool.conditions !== undefined || pool.bonus_rolls !== undefined ||
        pool.rolls !== 1 || !Array.isArray(pool.entries) ||
        pool.entries.length !== 1) continue;
    const entry = asRecord(pool.entries[0]);
    if (!entry || entry.type !== "item" ||
        typeof entry.name !== "string" ||
        !/^[a-z0-9_.-]+:[a-z0-9_.-]+$/i.test(entry.name) ||
        entry.conditions !== undefined) continue;
    const weight = entry.weight;
    if (weight !== undefined && weight !== 1) continue;
    const functions = entry.functions;
    let count: number | undefined;
    if (functions !== undefined) {
      if (!Array.isArray(functions) || functions.length !== 1) continue;
      const functionValue = asRecord(functions[0]);
      const c = number(functionValue?.count);
      if (functionValue?.function !== "set_count" ||
          c === undefined || c < 1 || !Number.isSafeInteger(c)) continue;
      count = c;
    }
    output.push({
      itemId: entry.name,
      ...(count === undefined ? {} : {count}),
      pointer: `/pools/${poolIndex}/entries/0/name`,
    });
  }
  return output;
};

export function deriveOwnedGameplaySourceSignals(input: {
  readonly artifactId: string;
  readonly graph: SemanticGraph;
  readonly nodes: readonly SemanticNode[];
  readonly scripts?: readonly { parsed: ParsedScriptFile; text?: string }[];
}): OwnedGameplaySourceSignals {
  const nodes = input.nodes.filter(node =>
    node.source.artifactId === input.artifactId &&
    packRoot(node.source.relativePath) !== undefined &&
    ["block", "item", "loot_table"].includes(node.kind));
  const byId = new Map(nodes.map(item => [item.id, item]));
  const signals: GameplayIntentSignal[] = [];
  const relations: GameplayIntentRelationSignal[] = [];
  const yieldSignals = new Map<string, GameplayIntentSignal>();

  for (const node of nodes) {
    const root = asRecord(node.data);
    const pack = packRoot(node.source.relativePath)!;
    if (node.kind === "block") {
      const definition = asRecord(root?.["minecraft:block"]);
      const components = asRecord(definition?.components);
      const name = asRecord(definition?.description)?.identifier;
      if (!components || typeof name !== "string" ||
          !/^[a-z0-9_.-]+:[a-z0-9_.-]+$/i.test(name)) continue;
      const mining = asRecord(components["minecraft:destructible_by_mining"]);
      const seconds = number(mining?.seconds_to_destroy);
      const facts = [
        `Block ${name}`,
        seconds === undefined ? "Mining duration unspecified" :
          `mining seconds_to_destroy=${seconds}`,
      ];
      const loot = components["minecraft:loot"];
      if (typeof loot === "string") facts.push(`declared loot path=${loot}`);
      signals.push(signal(node, `Block ${name}`, "/minecraft:~1block",
        facts.join("; ") + "."));
      // Reuse ONLY the actual reference resolver output, not a filename or
      // loose text match that may conflate different packs or map versions.
      const resolved = input.graph.outgoingEdges(node.id, "REFERENCES")
        .filter(edge => edge.evidence.source.artifactId === input.artifactId &&
          edge.evidence.source.relativePath === node.source.relativePath &&
          edge.evidence.source.jsonPointer ===
            "/minecraft:~1block/components/minecraft:~1loot" &&
          edge.status === "resolved" && edge.to !== undefined &&
          byId.get(edge.to)?.kind === "loot_table");
      if (resolved.length === 1) {
        const table = byId.get(resolved[0]!.to!)!;
        relations.push(link(node, sourceIdentity(node), sourceIdentity(table),
          "requires", "/minecraft:~1block/components/minecraft:~1loot",
          `Exact same-pack source reference from ${name} to its authored loot table; ` +
          "no Minecraft mining, table execution, or actual drop is proven."));
      }
    } else if (node.kind === "loot_table") {
      const pools = root?.pools;
      if (!Array.isArray(pools)) continue;
      const explicitEmpty = pools.length === 0;
      signals.push(signal(node, `Loot table ${node.source.relativePath}`,
        "/pools", explicitEmpty
          ? "Authored pools=[] (no declared pool entries); cannot infer global no-drop rule."
          : `Authored ${pools.length} pool(s); conditional/dynamic entries remain source-unknown unless individually resolved.`));
      for (const output of literalLootOutputs(node)) {
        const identity = lootItemIdentity(pack, output.itemId);
        if (!yieldSignals.has(identity)) {
          yieldSignals.set(identity, {
            id: "signal:bp-loot-item:" + encodeURIComponent(input.artifactId + ":" + identity),
            subjectKey: identity, nodeKind: "resource", label: output.itemId,
            status: "inferred", evidenceOrigin: "source-code",
            locator: node.source.relativePath + "#" + output.pointer,
            summary: "An authored loot table declares this literal possible item. " +
              "Game execution, player pickup and item delivery remain unverified.",
          });
        }
        relations.push(link(node, sourceIdentity(node), identity,
          "produces", output.pointer,
          `Single literal unconditioned pool entry declares possible ${output.itemId}` +
          (output.count === undefined ? "" : `, set_count=${output.count}`) +
          "; does not prove the item will be awarded in gameplay."));
      }
    } else if (node.kind === "item") {
      const item = asRecord(root?.["minecraft:item"]);
      const name = asRecord(item?.description)?.identifier;
      const components = asRecord(item?.components);
      if (typeof name !== "string" ||
          !/^[a-z0-9_.-]+:[a-z0-9_.-]+$/i.test(name) || !components) continue;
      const stack = number(components["minecraft:max_stack_size"]);
      const cooldown = asRecord(components["minecraft:cooldown"]);
      const modifiers = asRecord(components["minecraft:use_modifiers"]);
      const facts = [
        `Item ${name}`,
        ...(stack === undefined ? [] : [`max_stack_size=${stack}`]),
        ...(typeof cooldown?.category === "string" &&
          number(cooldown.duration) !== undefined
          ? [`cooldown ${cooldown.category}=${cooldown.duration}s`] : []),
        ...(number(modifiers?.use_duration) === undefined ? [] :
          [`use_duration=${modifiers!.use_duration}s`]),
      ];
      signals.push(signal(node, `Item ${name}`, "/minecraft:~1item/components",
        facts.join("; ") + "."));
    }
  }
  // Each exact source file is a separate resource. Vanilla item IDs are
  // shared only within one pack; repeated declarations retain their sites.
  signals.push(...yieldSignals.values());
  const sourceUses = sourceResourceUses({
    artifactId: input.artifactId, nodes,
    scriptEntries: input.scripts ?? [], outputItems: yieldSignals,
  });
  signals.push(...sourceUses.signals);
  relations.push(...sourceUses.relations);
  return {
    signals: signals.sort((a, b) => a.id.localeCompare(b.id)),
    relations: relations.sort((a, b) => a.id.localeCompare(b.id)),
  };
}

/**
 * Link selected BP resources to *actual authored script reference sites*.
 * A lexical ID match alone never creates a gameplay relationship: the site
 * must be a resolved local call, an imported ItemStack constructor, a direct
 * type-ID comparison, or a setCanDestroy call on a locally owned ItemStack.
 *
 * These are source-use witnesses, not proof that a player mined a block,
 * received an item, satisfied a threshold, or triggered an objective.
 * In particular, a local helper named countInventoryItem has no special
 * meaning here: the parser must separately resolve its call target.
 */
function sourceResourceUses(input: {
  readonly artifactId: string;
  readonly nodes: readonly SemanticNode[];
  readonly scriptEntries: readonly {
    parsed: ParsedScriptFile;
    text?: string;
  }[];
  readonly outputItems: ReadonlyMap<string, GameplayIntentSignal>;
}): OwnedGameplaySourceSignals {
  const identified = new Map<string, Map<string, Set<string>>>();
  const addId = (pack: string, resourceId: string, key: string): void => {
    if (!/^[a-z0-9_.-]+:[a-z0-9_.-]+$/i.test(resourceId)) return;
    const ids = identified.get(pack) ?? new Map<string, Set<string>>();
    const keys = ids.get(resourceId) ?? new Set<string>();
    keys.add(key);
    ids.set(resourceId, keys);
    identified.set(pack, ids);
  };
  for (const node of input.nodes) {
    if (node.source.artifactId !== input.artifactId) continue;
    const pack = packRoot(node.source.relativePath);
    if (pack === undefined || (node.kind !== "block" && node.kind !== "item")) continue;
    const root = asRecord(node.data);
    const owner = node.kind === "block" ? "minecraft:block" : "minecraft:item";
    const identifier = asRecord(asRecord(root?.[owner])?.description)?.identifier;
    if (typeof identifier === "string") addId(pack, identifier, sourceIdentity(node));
  }
  for (const item of input.outputItems.values()) {
    const match = item.subjectKey.match(/^resource:bp-loot-item:(.*):([^:]*)$/);
    if (!match) continue;
    try { addId(decodeURIComponent(match[1]!), decodeURIComponent(match[2]!), item.subjectKey); }
    catch { /* Invalid item identity is not an authored source witness. */ }
  }

  const useSignals: GameplayIntentSignal[] = [];
  const useRelations: GameplayIntentRelationSignal[] = [];
  for (const entry of input.scriptEntries) {
    const script = entry.parsed;
    if (script.source.artifactId !== input.artifactId) continue;
    const pack = packRoot(script.source.relativePath);
    const resources = pack === undefined ? undefined : identified.get(pack);
    // Never combine a parsed source identity with unrelated input text.
    if (entry.text !== undefined && script.text !== undefined &&
        entry.text !== script.text) continue;
    const text = entry.text ?? script.text;
    if (!resources || !text) continue;
    const sourceKind = /\.tsx?$/i.test(script.source.relativePath)
      ? ts.ScriptKind.TS : ts.ScriptKind.JS;
    const file = ts.createSourceFile(script.source.relativePath, text,
      ts.ScriptTarget.Latest, true, sourceKind);
    if (((file as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] })
      .parseDiagnostics?.length ?? 0) > 0) continue;
    const declarations = new Map<string, ts.VariableDeclaration[]>();
    for (const statement of file.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const decl of statement.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name)) continue;
        declarations.set(decl.name.text,
          [...(declarations.get(decl.name.text) ?? []), decl]);
      }
    }
    // A global mutable assignment, destructuring, direct eval, or any
    // second declaration makes source identity unknown instead of guessed.
    const writes = new Set<string>();
    let dynamicMutation = false;
    const assignmentNames = (node: ts.Node): string[] => {
      if (ts.isIdentifier(node)) return [node.text];
      if (ts.isParenthesizedExpression(node) || ts.isSpreadElement(node))
        return assignmentNames(node.expression);
      if (ts.isArrayLiteralExpression(node))
        return node.elements.flatMap(assignmentNames);
      if (ts.isObjectLiteralExpression(node)) return node.properties.flatMap(prop =>
        ts.isShorthandPropertyAssignment(prop) ? [prop.name.text] :
        ts.isPropertyAssignment(prop) ? assignmentNames(prop.initializer) :
        ts.isSpreadAssignment(prop) ? assignmentNames(prop.expression) : []);
      return [];
    };
    const visitWrites = (node: ts.Node): void => {
      if (ts.isWithStatement(node)) dynamicMutation = true;
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) &&
          (node.expression.text === "eval" || node.expression.text === "Function"))
        dynamicMutation = true;
      if (ts.isBinaryExpression(node) &&
          node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
          node.operatorToken.kind <= ts.SyntaxKind.LastAssignment) {
        for (const name of assignmentNames(node.left)) writes.add(name);
      } else if ((ts.isPrefixUnaryExpression(node) ||
                  ts.isPostfixUnaryExpression(node)) &&
          (node.operator === ts.SyntaxKind.PlusPlusToken ||
           node.operator === ts.SyntaxKind.MinusMinusToken)) {
        for (const name of assignmentNames(node.operand)) writes.add(name);
      } else if ((ts.isForOfStatement(node) || ts.isForInStatement(node)) &&
                 !ts.isVariableDeclarationList(node.initializer)) {
        for (const name of assignmentNames(node.initializer)) writes.add(name);
      }
      ts.forEachChild(node, visitWrites);
    };
    visitWrites(file);
    const stable = new Map<string, string>();
    if (!dynamicMutation) for (const [name, values] of declarations) {
      if (values.length !== 1 || writes.has(name) ||
          !values[0]!.initializer ||
          !ts.isStringLiteralLike(values[0]!.initializer)) continue;
      const id = values[0]!.initializer.text;
      if (resources.has(id)) stable.set(name, id);
    }
    const bindsName = (name: ts.BindingName, identifier: string): boolean =>
      ts.isIdentifier(name) ? name.text === identifier :
        name.elements.some(element => ts.isBindingElement(element) &&
          bindsName(element.name, identifier));
    const isShadowed = (ident: ts.Identifier): boolean => {
      let current: ts.Node | undefined = ident.parent;
      while (current && current !== file) {
        if (ts.isFunctionLike(current) && current.parameters.some(param =>
          bindsName(param.name, ident.text))) return true;
        if (ts.isCatchClause(current) && current.variableDeclaration &&
            bindsName(current.variableDeclaration.name, ident.text)) return true;
        if ((ts.isForOfStatement(current) || ts.isForInStatement(current) ||
             ts.isForStatement(current)) && current.initializer &&
            ts.isVariableDeclarationList(current.initializer) &&
            current.initializer.declarations.some(decl =>
              bindsName(decl.name, ident.text))) return true;
        if (ts.isBlock(current)) for (const statement of current.statements) {
          if (ts.isVariableStatement(statement) &&
              statement.declarationList.declarations.some(decl =>
                ts.isIdentifier(decl.name) && decl.name.text === ident.text)) return true;
          if (ts.isFunctionDeclaration(statement) &&
              statement.name?.text === ident.text) return true;
        }
        current = current.parent;
      }
      return false;
    };
    const idFor = (arg: ts.Expression | undefined): string | undefined => {
      if (arg === undefined) return undefined;
      if (ts.isStringLiteralLike(arg)) return arg.text;
      if (ts.isIdentifier(arg) && !isShadowed(arg)) return stable.get(arg.text);
      return undefined;
    };
    const calls = new Map<string, ParsedScriptFile["localFunctionCalls"][number]>();
    for (const call of script.localFunctionCalls ?? []) {
      if (!call.targetSource || call.source.artifactId !== input.artifactId ||
          call.targetSource.artifactId !== input.artifactId ||
          call.targetSource.relativePath !== script.source.relativePath ||
          call.source.relativePath !== script.source.relativePath) continue;
      const range = call.source.range;
      if (range) calls.set(`${range.lineStart}:${range.columnStart}`, call);
    }
    const stacks = new Set((script.importedSymbols ?? [])
      .filter(item => item.module === "@minecraft/server" &&
        item.importedName === "ItemStack" && !item.typeOnly)
      .map(item => item.localName));
    const position = (node: ts.Node): { line: number; column: number } => {
      const p = file.getLineAndCharacterOfPosition(node.getStart(file));
      return {line: p.line + 1, column: p.character + 1};
    };
    const emitted = new Set<string>();
    const addUse = (node: ts.Node, role: string, resourcesUsed: readonly string[],
      description: string): void => {
      const exact = [...new Set(resourcesUsed)].filter(value =>
        resources.get(value)?.size === 1).sort();
      if (!exact.length) return;
      const {line, column} = position(node);
      // One technical source subject per REAL enclosing function/callback
      // and operation role; retain individual source sites as distinct
      // evidence IDs. A script with repeated item checks should not spawn
      // a fictitious gameplay subsystem per syntactic occurrence.
      let ownerNode: ts.Node | undefined = node.parent;
      while (ownerNode && ownerNode !== file && !ts.isFunctionLike(ownerNode)) {
        ownerNode = ownerNode.parent;
      }
      const owner = ownerNode && ownerNode !== file
        ? (() => { const at = position(ownerNode!); return `scope@${at.line}:${at.column}`; })()
        : `module-statement@${line}`;
      const subjectIdentity = `${input.artifactId}:${script.source.relativePath}:${owner}:${role}`;
      const siteIdentity = `${subjectIdentity}:${line}:${column}`;
      const subject = "resource:bp-script-use:" + encodeURIComponent(subjectIdentity);
      if (!emitted.has(siteIdentity)) {
        emitted.add(siteIdentity);
        useSignals.push({
          id: "signal:bp-script-use:" + encodeURIComponent(siteIdentity),
          subjectKey: subject, nodeKind: "resource", label: "Script source " + role,
          status: "inferred", evidenceOrigin: "source-code",
          locator: `${script.source.relativePath}#L${line}`,
          summary: `${description}; direct authored source site line ${line}, column ${column}. ` +
            "This is only source identity/usage, not active gameplay or player outcome.",
        });
      }
      for (const value of exact) {
        const target = [...resources.get(value)!][0]!;
        useRelations.push({
          id: "bp-script-use-link:" + encodeURIComponent(siteIdentity + ":" + target),
          fromSubjectKey: subject, toSubjectKey: target,
          edgeKind: "participates-in", status: "inferred", evidenceOrigin: "source-code",
          locator: `${script.source.relativePath}#L${line}`,
          summary: `Script source ${role} references exact ${value}; ` +
            "no runtime execution, authorization, inventory award or progression is proven.",
        });
      }
    };
    const eligibleStackBinding = (call: ts.CallExpression): boolean => {
      if (!ts.isPropertyAccessExpression(call.expression) ||
          !ts.isIdentifier(call.expression.expression)) return false;
      const identifier = call.expression.expression;
      let scope: ts.Node | undefined = call.parent;
      while (scope && !ts.isBlock(scope)) scope = scope.parent;
      if (!scope) return false;
      const defs = scope.statements.filter(ts.isVariableStatement)
        .flatMap(stmt => [...stmt.declarationList.declarations]
          .filter(decl => !!(stmt.declarationList.flags & ts.NodeFlags.Const)))
        .filter(decl => ts.isIdentifier(decl.name) &&
          decl.name.text === identifier.text &&
          !!decl.initializer && ts.isNewExpression(decl.initializer) &&
          ts.isIdentifier(decl.initializer.expression) &&
          stacks.has(decl.initializer.expression.text) &&
          !isShadowed(decl.initializer.expression));
      return defs.length === 1;
    };
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node)) {
        if (ts.isIdentifier(node.expression)) {
          const {line, column} = position(node);
          const localCall = calls.get(`${line}:${column}`);
          if (localCall && localCall.targetName === node.expression.text) {
            const ids = node.arguments.map(arg => idFor(arg)).filter((id): id is string => !!id);
            addUse(node, "resolved local call", ids,
              `Source passes resource ID into resolved local helper ${localCall.targetName}`);
          }
        }
        if (ts.isPropertyAccessExpression(node.expression) &&
            node.expression.name.text === "setCanDestroy" &&
            eligibleStackBinding(node) &&
            node.arguments.length > 0 &&
            ts.isArrayLiteralExpression(node.arguments[0]!)) {
          const ids = node.arguments[0].elements.map(e =>
            ts.isExpression(e) ? idFor(e) : undefined)
            .filter((id): id is string => !!id);
          addUse(node, "item destroy permission", ids,
            "Source calls setCanDestroy on a uniquely declared local ItemStack");
        }
      }
      if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) &&
          stacks.has(node.expression.text) && !isShadowed(node.expression)) {
        const id = idFor(node.arguments?.[0]);
        if (id) addUse(node, "ItemStack construction", [id],
          "Source constructs an ItemStack with an authored item ID");
      }
      if (ts.isBinaryExpression(node) &&
          [ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.EqualsEqualsEqualsToken,
           ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken]
            .includes(node.operatorToken.kind)) {
        const typeIdAccess = (value: ts.Expression): boolean =>
          ts.isPropertyAccessExpression(value) &&
          (value.name.text === "typeId" || value.name.text === "blockTypeId");
        const id = typeIdAccess(node.left) ? idFor(node.right) :
          typeIdAccess(node.right) ? idFor(node.left) : undefined;
        if (id) addUse(node, "type ID comparison", [id],
          "Source compares typeId/blockTypeId against an authored resource ID");
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
  }
  return {signals: useSignals.sort((a,b)=>a.id.localeCompare(b.id)),
    relations: useRelations.sort((a,b)=>a.id.localeCompare(b.id))};
}
