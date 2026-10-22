import {
  createDiagnostic,
  type DiagnosticFinding,
} from "../../../diagnostics/src/index.js";
import type { SemanticIr } from "../../../semantic-ir/src/index.js";

function mutatingOperation(operation: string): boolean {
  return operation === "write" ||
    operation === "delete" ||
    operation === "clear";
}

export function semanticIrDiagnostics(
  ir: SemanticIr,
): DiagnosticFinding[] {
  const output: DiagnosticFinding[] = [];

  for (const edge of ir.execution.edges) {
    if (edge.resolution !== "unresolved") continue;

    output.push(createDiagnostic({
      code: "SEMANTIC_IR_EXECUTION_TARGET_UNRESOLVED",
      severity: "info",
      message:
        "Semantic IR cannot resolve execution target " +
        edge.targetLabel +
        "; downstream execution claims must remain unknown.",
      source: edge.source,
      relatedNodeIds: [edge.from],
      data: {
        subject: "execution-target:" + edge.targetLabel,
        object: "execution-target-resolved",
        semanticIrEdgeId: edge.id,
        fromExecutionRegionId: edge.from,
        targetLabel: edge.targetLabel,
        executionKind: edge.kind,
      },
    }));
  }

  const operationsByRegion = new Map<string, typeof ir.state.operations[number][]>();
  for (const operation of ir.state.operations) {
    if (!mutatingOperation(operation.operation)) continue;
    const list = operationsByRegion.get(operation.executionRegionId) ?? [];
    list.push(operation);
    operationsByRegion.set(operation.executionRegionId, list);
  }

  // Reuse only exact resolved source-call edges. A matching function name
  // or lexical parameter does not establish a state owner or an execution
  // path; a new deferred/periodic/event edge starts a separate timeline.
  const regions = new Map(ir.execution.regions.map(item => [item.id, item]));
  const callsByRegion = new Map<string, typeof ir.execution.edges[number][]>();
  for (const edge of ir.execution.edges) {
    if (edge.kind !== "synchronous-call" || edge.resolution !== "resolved" ||
        edge.to === undefined) continue;
    const from = regions.get(edge.from);
    const target = regions.get(edge.to);
    if (from?.source?.artifactId !== edge.source.artifactId ||
        from?.source?.relativePath !== edge.source.relativePath ||
        target?.source?.artifactId !== edge.source.artifactId) continue;
    const calls = callsByRegion.get(edge.from) ?? [];
    calls.push(edge);
    callsByRegion.set(edge.from, calls);
  }

  for (const relation of ir.temporal.relations) {
    if (
      relation.kind !== "deferred" &&
      relation.kind !== "periodic"
    ) {
      continue;
    }
    if (relation.guardEvidence === "explicit-generation-check") {
      continue;
    }
    if (!relation.to) continue;

    // Bounded source-only reachability from the callback region. This
    // includes exact ESM helper calls but never a second scheduled callback,
    // unrelated event handler, ambiguous target or other selected artifact.
    const visited = new Set<string>();
    const queue = [relation.to];
    const traversedCalls: typeof ir.execution.edges[number][] = [];
    const mutatingSites = new Map<string, typeof ir.state.operations[number]>();
    for (let i = 0; i < queue.length && i < 64; i += 1) {
      const regionId = queue[i]!;
      if (visited.has(regionId)) continue;
      visited.add(regionId);
      for (const op of operationsByRegion.get(regionId) ?? []) {
        if (op.source.artifactId === relation.source.artifactId) {
          mutatingSites.set(op.id, op);
        }
      }
      for (const edge of callsByRegion.get(regionId) ?? []) {
        if (edge.to === undefined) continue;
        const alreadyReached = visited.has(edge.to) || queue.includes(edge.to);
        if (!alreadyReached && queue.length >= 64) continue;
        traversedCalls.push(edge);
        if (!alreadyReached) queue.push(edge.to);
      }
    }
    // Keep only calls on an authored route toward a mutation; an
    // unrelated helper invoked by the same callback is NOT evidence of
    // that mutation. Reverse reachability uses only the bounded traversal.
    const reachesMutation = new Set([...mutatingSites.values()]
      .map(op => op.executionRegionId));
    for (let i = 0; i < 64; i += 1) {
      let grew = false;
      for (const call of traversedCalls) {
        if (call.to && reachesMutation.has(call.to) &&
            !reachesMutation.has(call.from)) {
          reachesMutation.add(call.from);
          grew = true;
        }
      }
      if (!grew) break;
    }
    const relevantCallIds = [...new Set(traversedCalls
      .filter(call => call.to && reachesMutation.has(call.to) &&
        reachesMutation.has(call.from))
      .map(call => call.id))].sort();
    const mutatedSurfaces = [...new Set([...mutatingSites.values()]
      .map(op => op.surfaceId))].sort();
    if (mutatedSurfaces.length === 0) continue;

    output.push(createDiagnostic({
      code: "SEMANTIC_IR_DEFERRED_STATE_GUARD_UNKNOWN",
      severity: "minor",
      message:
        "Deferred callback has a source-reachable state mutation without a proven generation/ownership guard; stale callback risk requires runtime proof.",
      source: relation.source,
      relatedNodeIds: [relation.from, relation.to],
      data: {
        subject: "deferred-state-mutation:" + relation.id,
        object: "current-generation-ownership-proof",
        semanticIrRelationId: relation.id,
        fromExecutionRegionId: relation.from,
        toExecutionRegionId: relation.to,
        mutatedStateSurfaceIds: mutatedSurfaces,
        // Source receipts for narrow investigation; never runtime proof.
        authoredStateMutationIds: [...mutatingSites.keys()].sort(),
        resolvedSynchronousCallEdgeIds: relevantCallIds,
        temporalKind: relation.kind,
      },
    }));
  }

  return output.sort((a, b) => a.id.localeCompare(b.id));
}
