import type { SourceSequentialSite } from "../../project-model/src/index.js";
import type { SemanticIr, StateOperation } from "../../semantic-ir/src/index.js";
import { propagateReachingDefinitions } from "../../dataflow/src/index.js";

/**
 * Minecraft-specific interpretation of the generic Dataflow worklist.
 * Only an unshadowed ESM world binding and an exact dynamic-property key
 * admit source-level reaching-definition candidates.
 */
export function reconcileWorldStateReachingDefinitions(
  ir: SemanticIr,
  read: StateOperation,
): {
  readonly status: "COMPLETE" | "UNKNOWN" | "TRUNCATED";
  readonly writeIds: readonly string[];
  /** The sole possible writer also lies on every modeled source CFG path
   * to this guard read. This is a source-site attempt, NOT proof of a live
   * dynamic-property write, guard truth or per-player/session state.
   */
  readonly uniquelyDominatingWriteId?: string;
} {
  const unknown = () => ({ status: "UNKNOWN" as const, writeIds: [] });
  const flow = ir.execution.controlFlow?.find(item =>
    item.executionRegionId === read.executionRegionId);
  if (!flow || read.operation !== "read" ||
      !read.sourceSequence?.stableWorldReceiver || !read.targetHint) {
    return unknown();
  }
  // Stable coordinate tuple, not SourceRange object serialization order.
  const key = (site: SourceSequentialSite): string => {
    const r = site.block.range;
    return JSON.stringify([
      site.block.artifactId, site.block.relativePath,
      site.block.jsonPointer ?? null,
      r?.lineStart ?? null, r?.columnStart ?? null,
      r?.lineEnd ?? null, r?.columnEnd ?? null, site.statementIndex,
    ]);
  };
  const readKey = key(read.sourceSequence);
  const readNodes = flow.nodes.filter(node =>
    node.site !== undefined && key(node.site) === readKey);
  if (readNodes.length !== 1) return unknown();
  const surface = ir.state.surfaces.find(item =>
    item.id === read.surfaceId)?.ref;
  if (surface?.kind !== "dynamic-property" || surface.key === "*") return unknown();

  // Deletes, clears, computed keys and differently-spelled receivers can
  // invalidate definitions; no general alias or successful-write proof.
  const mutations = ir.state.operations.filter(item =>
    item.executionRegionId === read.executionRegionId &&
    ["write", "delete", "clear"].includes(item.operation));
  const bySurface = new Map(ir.state.surfaces.map(item =>
    [item.id, item.ref]));
  const mutatingDynamic = mutations.filter(item =>
    bySurface.get(item.surfaceId)?.kind === "dynamic-property");
  if (mutatingDynamic.some(item =>
    bySurface.get(item.surfaceId)?.key === "*" ||
    item.surfaceId === read.surfaceId && (
      item.operation !== "write" ||
      item.targetHint !== read.targetHint ||
      item.sourceSequence?.stableWorldReceiver !== true ||
      !item.sourceSequence.directCall
    ))) return unknown();

  const writers = mutatingDynamic.filter(item =>
    item.surfaceId === read.surfaceId);
  const siteNodes = new Map<string, typeof flow.nodes[number][]>();
  for (const node of flow.nodes) {
    if (!node.site) continue;
    const id = key(node.site);
    const list = siteNodes.get(id) ?? [];
    list.push(node);
    siteNodes.set(id, list);
  }
  const writesAtNode = new Map<string, string[]>();
  for (const writer of writers) {
    const id = key(writer.sourceSequence!);
    const matching = siteNodes.get(id) ?? [];
    if (matching.length !== 1) return unknown();
    const ids = writesAtNode.get(matching[0]!.id) ?? [];
    ids.push(writer.id);
    writesAtNode.set(matching[0]!.id, ids);
  }
  if ([...writesAtNode.values()].some(ids => ids.length !== 1)) return unknown();
  const transfers = new Map(flow.nodes.map(node => [
    node.id, {
      unknown: node.kind === "opaque",
      ...(writesAtNode.has(node.id)
        ? { killsPrevious: true, generatedIds: writesAtNode.get(node.id)! }
        : {}),
    },
  ] as const));
  const readNodeId = readNodes[0]!.id;
  const result = propagateReachingDefinitions(
    flow, readNodeId, transfers,
  );
  const base = { status: result.status, writeIds: result.definitionIds };
  if (result.status !== "COMPLETE" ||
      result.definitionIds.length !== 1) return base;

  // MAY-reaching with one candidate does not imply MUST-reaching:
  // e.g. if (condition) write(); read() includes a path with NO write.
  // The write must DOMINATE the read in the exact authored CFG. Check
  // whether the read is still reachable after removing that writer node.
  const sourceWriteId = result.definitionIds[0]!;
  const writerNodes = [...writesAtNode.entries()]
    .filter(([, ids]) => ids.includes(sourceWriteId))
    .map(([id]) => id);
  if (writerNodes.length !== 1) return base;
  const writerNodeId = writerNodes[0]!;
  const successors = new Map<string, string[]>();
  for (const edge of flow.edges) {
    const to = successors.get(edge.from) ?? [];
    to.push(edge.to);
    successors.set(edge.from, to);
  }
  const seen = new Set<string>();
  const pending = [flow.entryId];
  let cursor = 0;
  while (cursor < pending.length) {
    const id = pending[cursor++]!;
    if (seen.has(id) || id === writerNodeId) continue;
    if (id === readNodeId) return base;
    seen.add(id);
    for (const to of successors.get(id) ?? []) {
      if (!seen.has(to)) pending.push(to);
    }
  }
  return { ...base, uniquelyDominatingWriteId: sourceWriteId };
}
