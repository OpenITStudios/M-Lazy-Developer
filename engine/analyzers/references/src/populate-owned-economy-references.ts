import type { SemanticGraph, SemanticNode } from "../../../packages/graph/src/index.js";

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined;
}

function packRoot(path: string): string | undefined {
  const segments = path.replaceAll("\\", "/").split("/");
  const index = segments.findIndex(segment =>
    segment === "behavior_packs" || segment === "behavior_pack");
  return index >= 0 && segments[index + 1]
    ? segments.slice(0, index + 2).join("/") : undefined;
}

const pointer = (value: string): string =>
  value.replaceAll("~", "~0").replaceAll("/", "~1");

/** Source-only, exact-pack reference relationships for authored reward
 * definitions. The edges do not establish table load, recipe acquisition,
 * gameplay eligibility, or the runtime probability of a drop.
 *
 * Unknown structures, tag ingredients, dynamic identifiers, and vanilla
 * objects are NOT promoted to resolved project-local dependencies.
 */
export function populateOwnedEconomyReferences(
  graph: SemanticGraph,
  nodes: readonly SemanticNode[],
): void {
  const tables = nodes.filter(item => item.kind === "loot_table");
  const tableTargets = new Map<string, SemanticNode[]>();
  const itemTargets = new Map<string, SemanticNode[]>();
  const add = (index: Map<string, SemanticNode[]>, key: string, node: SemanticNode) => {
    const matches = index.get(key) ?? [];
    matches.push(node);
    index.set(key, matches);
  };
  for (const candidate of tables) {
    const owner = packRoot(candidate.source.relativePath);
    if (owner) add(tableTargets, candidate.source.relativePath.replaceAll("\\", "/"), candidate);
  }
  for (const candidate of nodes.filter(item => item.kind === "item")) {
    const owner = packRoot(candidate.source.relativePath);
    const definition = record(record(candidate.data)?.["minecraft:item"]);
    const identifier = record(definition?.description)?.identifier;
    if (owner && typeof identifier === "string") {
      add(itemTargets, owner + "/" + identifier, candidate);
    }
  }

  const resolve = (
    source: SemanticNode,
    targetKind: "loot_table" | "item",
    targetName: string,
    jsonPointer: string,
  ): void => {
    const owner = packRoot(source.source.relativePath);
    if (!owner) return;
    const targetKey = owner + "/" + (targetKind === "loot_table"
      ? (targetName.endsWith(".json") ? targetName : targetName + ".json")
      : targetName);
    const matches = (targetKind === "loot_table" ? tableTargets : itemTargets)
      .get(targetKey)?.filter(candidate =>
        candidate.source.artifactId === source.source.artifactId) ?? [];
    graph.addEdge({
      from: source.id,
      type: "REFERENCES",
      targetIdentifier: targetName,
      status: matches.length === 1 ? "resolved" : matches.length === 0 ? "unresolved" : "ambiguous",
      ...(matches.length === 1 ? { to: matches[0]!.id } : {}),
      ...(matches.length > 1 ? { candidates: matches.map(item => item.id).sort() } : {}),
      evidence: { source: { ...source.source, jsonPointer } },
    });
  };

  const linkItem = (source: SemanticNode, value: unknown, jsonPointer: string): void => {
    const identifier = typeof value === "string" ? value : record(value)?.item;
    // Source-owned custom item identities, not vanilla or tag-based inputs.
    if (typeof identifier !== "string" || !/^[a-z0-9_.-]+:[a-z0-9_./-]+$/i.test(identifier) ||
        identifier.toLowerCase().startsWith("minecraft:")) return;
    resolve(source, "item", identifier, jsonPointer);
  };

  for (const node of tables) {
    const pools = record(node.data)?.pools;
    if (!Array.isArray(pools)) continue;
    // Traversal only observes literal, explicit references. No interpretation
    // of loot conditions, rolls, enchantments, or table execution.
    const visit = (entryValue: unknown, path: string, depth: number): void => {
      if (depth > 12) return;
      const entry = record(entryValue);
      if (!entry) return;
      const name = entry.name;
      if (entry.type === "loot_table" && typeof name === "string") {
        const canonical = name.replaceAll("\\", "/");
        const pieces = canonical.split("/");
        if (pieces[0] === "loot_tables" && pieces.length > 1 &&
            pieces.every(piece => piece && piece !== "." && piece !== "..") &&
            /^[\w./-]+$/.test(canonical)) {
          resolve(node, "loot_table", canonical, path + "/name");
        }
      } else if (entry.type === "item") {
        linkItem(node, name, path + "/name");
      }
      if (Array.isArray(entry.children)) {
        entry.children.forEach((child, index) =>
          visit(child, path + "/children/" + index, depth + 1));
      }
    };
    pools.forEach((pool, index) => {
      const entries = record(pool)?.entries;
      if (!Array.isArray(entries)) return;
      entries.forEach((entry, offset) =>
        visit(entry, `/pools/${index}/entries/${offset}`, 0));
    });
  }

  for (const node of nodes.filter(item => item.kind === "recipe")) {
    const raw = record(node.data);
    if (!raw) continue;
    for (const [recipeType, definition] of Object.entries(raw)) {
      if (!recipeType.startsWith("minecraft:recipe_")) continue;
      const body = record(definition);
      if (!body) continue;
      const path = "/" + pointer(recipeType);
      if (Array.isArray(body.result)) {
        body.result.forEach((value, index) =>
          linkItem(node, value, path + `/result/${index}`));
      } else {
        linkItem(node, body.result, path + "/result");
      }
      // Only literal input items are dependencies. Tags are sets with
      // unknown membership until a separate tag registry is available.
      const keys = record(body.key);
      if (keys) for (const [key, value] of Object.entries(keys)) {
        linkItem(node, value, path + "/key/" + pointer(key));
      }
      if (Array.isArray(body.ingredients)) {
        body.ingredients.forEach((value, index) =>
          linkItem(node, value, path + `/ingredients/${index}`));
      }
    }
  }
}
