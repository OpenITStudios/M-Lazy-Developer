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
  return {
    signals: signals.sort((a, b) => a.id.localeCompare(b.id)),
    relations: relations.sort((a, b) => a.id.localeCompare(b.id)),
  };
}
