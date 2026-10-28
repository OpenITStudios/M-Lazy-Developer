import type { SemanticGraph, SemanticNode } from "../../../packages/graph/src/index.js";
import type { EntityEventProgram, ParsedEntityDefinition } from "../../entities/src/index.js";
import {
  matchPublishedVanillaLootSample,
  type PublishedVanillaLootSample,
} from "./published-vanilla-loot-samples.js";

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

/**
 * An observed authored reference chain, never proof that the entity spawned,
 * its component group was enabled, or the loot table executed in Minecraft.
 * A missing chain does NOT mean the table is unreachable: scripts, runtime
 * identifiers and unsupported source paths may still supply the table.
 */
export interface OwnedLootTableSourceRoute {
  readonly classification: "entity-authored-chain" | "no-entity-chain-observed";
  readonly proofCeiling: "SOURCE_REFERENCES_ONLY";
  readonly rootEntityId?: string;
  readonly rootReferencePath?: string;
  readonly rootReferencePointer?: string;
  /** A version-unverified match to Mojang's published vanilla sample tree.
   * Source-graph status remains unresolved/ambiguous until the selected target
   * and runtime pack stack supply independent proof.
   */
  readonly publishedVanillaSample?: PublishedVanillaLootSample;
  /** Activation is an authored MAY path, never a witnessed game event. */
  readonly rootActivation?: {
    readonly scope: "base" | "component-group";
    readonly groupId?: string;
    readonly status:
      | "BASE_COMPONENT_DECLARED"
      | "GROUP_ADD_EVENT_DECLARED"
      | "NO_LOCAL_GROUP_ADD_EVENT_OBSERVED"
      | "UNSUPPORTED_EVENT_PROGRAM"
      | "GROUP_ACTIVATION_UNASSESSED";
    readonly sourceEventIds?: readonly string[];
    readonly sourceEventPointers?: readonly string[];
  };
}

/**
 * Annotate only literal, same-artifact/same-pack loot-table references.
 * The graph already owns the authoritative edges; this is a derived routing
 * hint for diagnostic investigation, not another detector, issue or owner.
 */
export function classifyOwnedLootTableSourceRoutes(
  graph: SemanticGraph,
  entities: readonly { node: SemanticNode; parsed: ParsedEntityDefinition }[] = [],
): ReadonlyMap<string, OwnedLootTableSourceRoute> {
  const entityModels = new Map(entities.map(item => [item.node.id, item.parsed]));
  const nodes = new Map(graph.allNodes().map(node => [node.id, node]));
  const edges = graph.allEdges();
  type Root = { entityId: string; path: string; pointer: string };
  const rooted = new Map<string, Root>();
  const children = new Map<string, string[]>();
  const queue: string[] = [];
  const isTable = (id: string | undefined): id is string =>
    id !== undefined && nodes.get(id)?.kind === "loot_table";
  const sameSourcePack = (from: SemanticNode, to: SemanticNode): boolean => {
    const owner = packRoot(from.source.relativePath);
    return owner !== undefined && owner === packRoot(to.source.relativePath) &&
      from.source.artifactId === to.source.artifactId;
  };

  for (const edge of edges) {
    if (edge.type !== "REFERENCES" || edge.status !== "resolved" ||
        !isTable(edge.to)) continue;
    const from = nodes.get(edge.from);
    const to = nodes.get(edge.to!);
    if (!from || !to || !sameSourcePack(from, to) ||
        edge.evidence.source.artifactId !== from.source.artifactId ||
        edge.evidence.source.relativePath.replaceAll("\\", "/") !==
          from.source.relativePath.replaceAll("\\", "/")) continue;
    if (from.kind === "entity" &&
        /^\/minecraft:entity\/(components|component_groups\/[^/]+)\/minecraft:(loot|equipment)\/table$/.test(
          edge.evidence.source.jsonPointer ?? "") &&
        edge.targetIdentifier.replaceAll("\\", "/").startsWith("loot_tables/")) {
      // Component-group references are authored MAY paths, not active groups.
      if (!rooted.has(to.id)) {
        rooted.set(to.id, {
          entityId: from.id,
          path: edge.evidence.source.relativePath,
          pointer: edge.evidence.source.jsonPointer ?? "",
        });
        queue.push(to.id);
      }
    } else if (from.kind === "loot_table" &&
               /^\/pools\/\d+\/entries\/\d+(?:\/children\/\d+)*\/name$/.test(
                 edge.evidence.source.jsonPointer ?? "")) {
      const links = children.get(from.id) ?? [];
      links.push(to.id);
      children.set(from.id, links);
    }
  }
  // Finite breadth-first traversal handles nesting, cross-pack isolation and
  // cycles; each table gets one deterministic source-root witness at most.
  for (let i = 0; i < queue.length; i++) {
    const sourceId = queue[i]!;
    const root = rooted.get(sourceId)!;
    for (const targetId of children.get(sourceId) ?? []) {
      if (rooted.has(targetId)) continue;
      rooted.set(targetId, root);
      queue.push(targetId);
    }
  }

  // A coarse addGroups list includes even branches whose execution operators
  // were rejected by the entity parser. Only supported authored mutation nodes
  // may witness a candidate event add; this never means the event ran.
  const knownAdd = (program: EntityEventProgram | undefined, groupId: string): boolean => {
    if (!program || program.kind === "unsupported") return false;
    if (program.kind === "mutation") return program.addGroups?.includes(groupId) === true;
    return program.steps?.some(step => knownAdd(step, groupId)) === true;
  };

  const activationFor = (root: Root): OwnedLootTableSourceRoute["rootActivation"] => {
    // Preserve the existing route output if no matching parsed source model is
    // supplied (for example, reduced graph-only reference tests).
    const parsed = entityModels.get(root.entityId);
    if (!parsed || parsed.source.relativePath !== root.path ||
        nodes.get(root.entityId)?.source.artifactId !== parsed.source.artifactId) {
      return undefined;
    }
    if (root.pointer.startsWith("/minecraft:entity/components/")) {
      return { scope: "base", status: "BASE_COMPONENT_DECLARED" };
    }
    const groupToken = /^\/minecraft:entity\/component_groups\/([^/]+)\//.exec(root.pointer)?.[1];
    if (!groupToken) return undefined;
    const groupId = groupToken.replaceAll("~1", "/").replaceAll("~0", "~");
    if (parsed.componentGroupData[groupId] === undefined) {
      return { scope: "component-group", groupId, status: "GROUP_ACTIVATION_UNASSESSED" };
    }
    const candidates = Object.entries(parsed.events)
      .filter(([, event]) => event.addGroups.includes(groupId));
    const supported = candidates.filter(([, event]) =>
      knownAdd(event.program, groupId));
    if (supported.length > 0) {
      return {
        scope: "component-group", groupId,
        status: "GROUP_ADD_EVENT_DECLARED",
        sourceEventIds: supported.map(([id]) => id).sort(),
        sourceEventPointers: supported.map(([, event]) => event.program!.path).sort(),
      };
    }
    return {
      scope: "component-group", groupId,
      status: candidates.length > 0
        ? "UNSUPPORTED_EVENT_PROGRAM"
        : "NO_LOCAL_GROUP_ADD_EVENT_OBSERVED",
    };
  };

  const routes = new Map<string, OwnedLootTableSourceRoute>();
  for (const edge of edges) {
    if (edge.type !== "REFERENCES" ||
        (edge.status !== "unresolved" && edge.status !== "ambiguous") ||
        !edge.targetIdentifier.replaceAll("\\", "/").startsWith("loot_tables/")) continue;
    const from = nodes.get(edge.from);
    if (!from || (from.kind !== "loot_table" && from.kind !== "entity") ||
        packRoot(from.source.relativePath) === undefined ||
        edge.evidence.source.artifactId !== from.source.artifactId ||
        edge.evidence.source.relativePath.replaceAll("\\", "/") !==
          from.source.relativePath.replaceAll("\\", "/")) continue;
    const pointer = edge.evidence.source.jsonPointer ?? "";
    if (from.kind === "entity" &&
        !/^\/minecraft:entity\/(components|component_groups\/[^/]+)\/minecraft:(loot|equipment)\/table$/.test(pointer)) continue;
    if (from.kind === "loot_table" &&
        !/^\/pools\/\d+\/entries\/\d+(?:\/children\/\d+)*\/name$/.test(pointer)) continue;
    const root: Root | undefined = from.kind === "entity"
      ? {
          entityId: from.id,
          path: edge.evidence.source.relativePath,
          pointer: edge.evidence.source.jsonPointer ?? "",
        }
      : rooted.get(from.id);
    const published = matchPublishedVanillaLootSample(edge.targetIdentifier);
    const activation = root === undefined ? undefined : activationFor(root);
    routes.set(edge.id, {
      classification: root === undefined
        ? "no-entity-chain-observed" : "entity-authored-chain",
      proofCeiling: "SOURCE_REFERENCES_ONLY",
      ...(root === undefined ? {} : {
        rootEntityId: root.entityId,
        rootReferencePath: root.path,
        rootReferencePointer: root.pointer,
      }),
      ...(published === undefined ? {} : { publishedVanillaSample: published }),
      ...(activation === undefined ? {} : { rootActivation: activation }),
    });
  }
  return routes;
}
