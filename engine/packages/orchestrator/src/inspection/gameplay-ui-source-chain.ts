import type { GameplayIntentEvidence } from "../../../gameplay-intent/src/index.js";
import type {
  AuthoredScriptApiCall,
  ObservedExecutionTrace,
  SemanticIr,
} from "../../../semantic-ir/src/index.js";

type Use = NonNullable<GameplayIntentEvidence["literalTranslationUse"]>;
type UiCall = NonNullable<Use["authoredUiSendCall"]>;
type Activation = NonNullable<UiCall["sourceActivation"]>;
type Path = Activation["sourcePaths"][number];

const MAX_ROOTS = 32;
const MAX_HOPS = 12;
const MAX_EXPLORED = 512;
const MAX_PATHS = 4;

/** Reuse canonical Semantic IR root eligibility. Bounded graph exploration
 * finds exact, contiguous source paths; it does not infer callback execution,
 * player identity, satisfied conditions, or successful client delivery.
 */
export function traceUiSourceActivation(
  ir: SemanticIr,
  traces: readonly ObservedExecutionTrace[],
  call: AuthoredScriptApiCall,
  artifactId: string,
): Activation {
  const unknown = (status: Activation["status"]): Activation => ({
    status,
    sourcePaths: [],
    unresolvedEntryCandidates: 0,
    proof: "SOURCE_ROOTED_IR_PATH_NOT_RUNTIME_EXECUTION",
  });
  if (ir.execution.manifestScriptRoots === undefined ||
      call.source.artifactId !== artifactId) {
    return unknown("MANIFEST_SOURCE_ROOTS_UNVERIFIED");
  }
  const regions = new Map(ir.execution.regions.map(region =>
    [region.id, region] as const));
  const entries = traces.filter(trace =>
    (trace.entryKind === "script-module" ||
      trace.entryKind === "event-source") &&
    trace.regionIds.includes(call.executionRegionId) &&
    regions.get(trace.entryRegionId)?.source?.artifactId === artifactId
  ).sort((a, b) => a.entryRegionId.localeCompare(b.entryRegionId));
  if (entries.length === 0) return unknown("NO_ADMITTED_SOURCE_ROOT_PATH");

  const byId = new Map(ir.execution.edges.map(edge => [edge.id, edge] as const));
  const results: Path[] = [];
  let bounded = entries.length > MAX_ROOTS;
  for (const trace of entries.slice(0, MAX_ROOTS)) {
    const scope = new Set(trace.regionIds);
    const byFrom = new Map<string, typeof ir.execution.edges[number][]>();
    for (const id of trace.executionEdgeIds) {
      const edge = byId.get(id);
      const range = edge?.source.range;
      if (!edge || edge.resolution !== "resolved" || !edge.to ||
          edge.source.artifactId !== artifactId ||
          range?.lineStart === undefined || range.lineEnd === undefined ||
          range.columnStart === undefined || range.columnEnd === undefined ||
          !scope.has(edge.from) || !scope.has(edge.to)) continue;
      const list = byFrom.get(edge.from) ?? [];
      list.push(edge);
      byFrom.set(edge.from, list);
    }
    for (const list of byFrom.values()) list.sort((a, b) =>
      a.to!.localeCompare(b.to!) || a.id.localeCompare(b.id));
    const queue: { id: string; edges: readonly string[] }[] = [
      { id: trace.entryRegionId, edges: [] },
    ];
    const visited = new Set<string>([trace.entryRegionId]);
    let result: Path | undefined;
    let cursor = 0;
    for (; cursor < queue.length && cursor < MAX_EXPLORED; cursor += 1) {
      const node = queue[cursor]!;
      if (node.id === call.executionRegionId) {
        const edgeGuards: Path["edgeGuards"][number][] = [];
        for (const id of node.edges) {
          const edge = byId.get(id);
          if (!edge) continue;
          for (const [kind, guards] of [
            ["lexical", edge.lexicalGuards ?? []],
            ["precedence", edge.precedenceGuards ?? []],
          ] as const) {
            for (const guard of guards) {
              const r = guard.source.range;
              if (guard.source.artifactId !== artifactId ||
                  r?.lineStart === undefined || r.lineEnd === undefined ||
                  r.columnStart === undefined || r.columnEnd === undefined) continue;
              edgeGuards.push({
                edgeId: id, kind,
                expression: guard.expression,
                branch: guard.branch,
                locator: guard.source.relativePath + ":" +
                  r.lineStart + ":" + r.columnStart,
              });
            }
          }
        }
        result = {
          entryRegionId: trace.entryRegionId,
          executionEdgeIds: node.edges,
          edgeGuards,
        };
        break;
      }
      if (node.edges.length >= MAX_HOPS) {
        if ((byFrom.get(node.id) ?? []).length > 0) bounded = true;
        continue;
      }
      for (const edge of byFrom.get(node.id) ?? []) {
        if (visited.has(edge.to!)) continue;
        visited.add(edge.to!);
        queue.push({ id: edge.to!, edges: [...node.edges, edge.id] });
      }
    }
    if (cursor < queue.length) bounded = true;
    if (result) results.push(result);
  }
  return {
    status: results.length > 0
      ? "SOURCE_ROOTED_PATH_CANDIDATE"
      : bounded ? "SOURCE_PATH_SEARCH_BOUNDED" :
        "NO_ADMITTED_SOURCE_ROOT_PATH",
    sourcePaths: results.slice(0, MAX_PATHS),
    unresolvedEntryCandidates: Math.max(0, entries.length -
      Math.min(results.length, MAX_PATHS)),
    proof: "SOURCE_ROOTED_IR_PATH_NOT_RUNTIME_EXECUTION",
  };
}
