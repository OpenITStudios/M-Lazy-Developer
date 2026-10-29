import {
  hasIndependentApprovedDesignEvidence,
  isSelectedArtifactApprovedDesignEvidence,
  type GameplayIntentEdge,
  type GameplayIntentEvidence,
  type GameplayIntentModel,
  type GameplayIntentNode,
} from "../../../gameplay-intent/src/index.js";
import type { GameplayCausalLink } from "./gameplay-scenario-model.js";

/** One witness rule for both the authored causal link and every impact hop. */
const IMPACT_KINDS = new Set<GameplayIntentEdge["kind"]>([
  "produces", "transitions-to", "recovers-to",
  "wins-by", "loses-by", "requires",
]);

function implementationIdsFor(
  edge: GameplayIntentEdge,
  selectedIds: ReadonlySet<string>,
  implementationIds: ReadonlySet<string>,
  evidenceById: ReadonlyMap<string, GameplayIntentEvidence>,
): readonly string[] {
  if (edge.status !== "authored" || !IMPACT_KINDS.has(edge.kind)) return [];
  return [...new Set(edge.evidenceIds.filter(id => {
    const record = evidenceById.get(id);
    return selectedIds.has(id) && implementationIds.has(id) &&
      record?.scope === "selected-artifact" &&
      (record.origin === "source-code" || record.origin === "command") &&
      record.locator.trim().length > 0;
  }))].sort();
}

/** PROVEN here means a source-grounded dependency, not Minecraft execution,
 * satisfied guards, a player-visible effect or a confirmed bug.
 */
export function authoredIntentEdgeStatus(
  edge: GameplayIntentEdge,
  selectedIds: ReadonlySet<string>,
  implementationIds: ReadonlySet<string>,
  evidenceById: ReadonlyMap<string, GameplayIntentEvidence>,
): GameplayCausalLink["status"] {
  if (edge.status !== "authored") return "DETECTION_GAP";
  if (IMPACT_KINDS.has(edge.kind)) {
    return implementationIdsFor(edge, selectedIds, implementationIds, evidenceById)
      .length > 0 ? "PROVEN" : "DETECTION_GAP";
  }
  // Structural authored relations remain navigable; they cannot be
  // traversed as causal impact paths.
  return edge.evidenceIds.some(id => {
    const record = evidenceById.get(id);
    return selectedIds.has(id) && record?.scope === "selected-artifact" &&
      record.locator.trim().length > 0;
  }) ? "PROVEN" : "DETECTION_GAP";
}

type Path = {
  readonly nodes: readonly string[];
  readonly implementationIds: readonly string[];
};

/** Selected-source relevance to an independently approved objective/outcome.
 * Reverse-prune paths without an eligible terminal before spending the bounded
 * search budget. No path is a proof of runtime effect, design correctness or
 * actual player reachability. Search exhaustion means UNKNOWN, not absence.
 */
export function provenImpactPathFrom(
  startId: string,
  allowedNodes: ReadonlySet<string>,
  intent: GameplayIntentModel,
  selectedIds: ReadonlySet<string>,
  firstEdge?: GameplayIntentEdge,
  implementationIds?: ReadonlySet<string>,
  evidenceById?: ReadonlyMap<string, GameplayIntentEvidence>,
): Pick<GameplayCausalLink, "impactPathComponentIds" | "impactPathEvidenceIds"> {
  const empty = { impactPathComponentIds: [], impactPathEvidenceIds: [] };
  if (!implementationIds || !evidenceById || !allowedNodes.has(startId)) return empty;
  const sourceIds = (edge: GameplayIntentEdge) =>
    implementationIdsFor(edge, selectedIds, implementationIds, evidenceById);
  const counts = new Map<string, number>();
  for (const node of intent.nodes)
    counts.set(node.id, (counts.get(node.id) ?? 0) + 1);
  const terminals = new Map<string, readonly string[]>();
  for (const node of intent.nodes) {
    if (!allowedNodes.has(node.id) || counts.get(node.id) !== 1 ||
        node.status !== "authored" ||
        (node.kind !== "objective" && node.kind !== "outcome")) continue;
    const approved = [...new Set(node.evidenceIds.filter(id =>
      isSelectedArtifactApprovedDesignEvidence(evidenceById.get(id))
    ))].sort();
    if (approved.length > 0) terminals.set(node.id, approved);
  }
  if (terminals.size === 0) return empty;

  type Edge = { readonly to: string; readonly id: string; readonly ids: readonly string[] };
  const forward = new Map<string, Edge[]>();
  const reverse = new Map<string, Set<string>>();
  for (const edge of intent.edges) {
    if (!allowedNodes.has(edge.from) || !allowedNodes.has(edge.to) ||
        edge.from === edge.to) continue;
    const ids = sourceIds(edge);
    if (ids.length === 0) continue;
    const list = forward.get(edge.from) ?? [];
    list.push({ to: edge.to, id: edge.id, ids });
    forward.set(edge.from, list);
    const parents = reverse.get(edge.to) ?? new Set<string>();
    parents.add(edge.from);
    reverse.set(edge.to, parents);
  }
  // Reverse graph reachability is used only for search prioritization.
  // It does not itself assert that an authored gameplay edge can execute.
  const distances = new Map<string, number>();
  const queue = [...terminals.keys()].sort();
  for (const id of queue) distances.set(id, 0);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor]!;
    for (const parent of [...(reverse.get(current) ?? [])].sort()) {
      if (distances.has(parent)) continue;
      distances.set(parent, distances.get(current)! + 1);
      queue.push(parent);
    }
  }
  if (!distances.has(startId)) return empty;

  for (const choices of forward.values()) choices.sort((a, b) =>
    (distances.get(a.to) ?? Number.MAX_SAFE_INTEGER) -
      (distances.get(b.to) ?? Number.MAX_SAFE_INTEGER) ||
    a.to.localeCompare(b.to) || a.id.localeCompare(b.id));

  let initial: Path = { nodes: [startId], implementationIds: [] };
  if (firstEdge !== undefined) {
    const ids = sourceIds(firstEdge);
    if (firstEdge.to !== startId || !allowedNodes.has(firstEdge.from) ||
        firstEdge.from === startId || ids.length === 0) return empty;
    initial = { nodes: [firstEdge.from, startId], implementationIds: ids };
  }

  const MAX_PATH_STATES = 1024;
  const MAX_PATH_NODES = 12;
  const stack: Path[] = [initial];
  let examined = 0;
  while (stack.length > 0 && examined < MAX_PATH_STATES) {
    const path = stack.pop()!;
    examined += 1;
    const current = path.nodes[path.nodes.length - 1]!;
    const approved = (terminals.get(current) ?? []).filter(id =>
      hasIndependentApprovedDesignEvidence([
        ...path.implementationIds.map(sourceId => evidenceById.get(sourceId)),
        evidenceById.get(id),
      ]));
    if (path.nodes.length > 1 && path.implementationIds.length > 0 &&
        approved.length > 0) {
      return {
        impactPathComponentIds: [...path.nodes],
        impactPathEvidenceIds: [...new Set([
          ...path.implementationIds, ...approved,
        ])].sort(),
      };
    }
    if (path.nodes.length >= MAX_PATH_NODES) continue;
    const relevant = (forward.get(current) ?? []).filter(next => {
      const remaining = distances.get(next.to);
      return remaining !== undefined &&
        path.nodes.length + remaining < MAX_PATH_NODES &&
        !path.nodes.includes(next.to);
    });
    // LIFO: push lower-priority candidates first, then nearest terminals.
    const budget = Math.max(0, MAX_PATH_STATES - stack.length);
    const prioritized = relevant.slice(0, budget);
    for (let i = prioritized.length - 1; i >= 0; i -= 1) {
      const edge = prioritized[i]!;
      stack.push({
        nodes: [...path.nodes, edge.to],
        implementationIds: [...new Set([
          ...path.implementationIds, ...edge.ids,
        ])].sort(),
      });
    }
  }
  return empty;
}
