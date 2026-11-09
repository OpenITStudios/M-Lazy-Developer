import type {
  ScriptLocalFunctionCall,
} from "../../core/types.js";
import type {
  CrossFileCallEdge,
} from "../../parser/cross-file-call.js";

export interface ScriptLifecycleProjectInput {
  fileId: string;
  /** Selected artifact identity, required before source-positive
   * qualified graph edges can be used for convergence/entry proof.
   */
  artifactId?: string;
  localFunctionCalls:
    readonly ScriptLocalFunctionCall[];
}

export interface ScriptLifecycleProjectGraph {
  callEdges: readonly {
    callerRegion: string;
    targetRegion: string;
    targetName: string;
    controlFlow:
      | "unconditional"
      | "conditional"
      | "deferred"
      | "unknown";
    /** Source declaration and full argument forwarding validated for
     * proof-sensitive traversal. False retains an investigative edge only.
     */
    sourceBound?: boolean;
  }[];
  reachableReleaseFunctions:
    readonly string[];
}

function functionName(
  region: string,
): string | undefined {
  const marker = "#function:";
  const qualified =
    region.lastIndexOf(marker);

  if (qualified >= 0) {
    return region.slice(
      qualified + marker.length,
    );
  }

  return region.startsWith(
    "function:",
  )
    ? region.slice(
        "function:".length,
      )
    : undefined;
}

function qualifiedRegion(
  modulePath: string,
  region: string,
): string {
  return (
    "module:" +
    modulePath +
    "#" +
    region
  );
}

function summarizeCallGraph(
  callEdges:
    ScriptLifecycleProjectGraph[
      "callEdges"
    ],
  releaseFunctionPattern: RegExp,
): Pick<
  ScriptLifecycleProjectGraph,
  "callEdges" |
    "reachableReleaseFunctions"
> {
  const adjacency =
    new Map<string, string[]>();

  for (const edge of callEdges) {
    const list =
      adjacency.get(
        edge.callerRegion,
      ) ?? [];
    list.push(edge.targetRegion);
    adjacency.set(
      edge.callerRegion,
      list,
    );
  }

  const releaseRegions =
    new Set(
      callEdges
        .map(
          (edge) =>
            edge.targetRegion,
        )
        .filter((region) => {
          const name =
            functionName(region);
          return Boolean(
            name &&
            releaseFunctionPattern
              .test(name),
          );
        }),
    );

  const reachableReleaseFunctions =
    new Set<string>();

  for (
    const start of
      adjacency.keys()
  ) {
    const queue = [start];
    const seen = new Set<string>();

    while (queue.length > 0) {
      const current =
        queue.shift()!;
      if (seen.has(current)) {
        continue;
      }
      seen.add(current);

      if (
        releaseRegions.has(
          current,
        )
      ) {
        reachableReleaseFunctions
          .add(current);
      }

      for (
        const next of
          adjacency.get(current) ??
          []
      ) {
        queue.push(next);
      }
    }
  }

  return {
    callEdges,
    reachableReleaseFunctions:
      [
        ...reachableReleaseFunctions,
      ].sort(),
  };
}

export function composeScriptLifecycleProjectGraph(
  inputs:
    readonly ScriptLifecycleProjectInput[],
  releaseFunctionPattern:
    RegExp =
      /(?:release|cleanup|reset|finish|finalize)/i,
): ScriptLifecycleProjectGraph {
  const callEdges =
    inputs.flatMap((item) =>
      item.localFunctionCalls.map(
        (call) => ({
          callerRegion:
            call.callerRegion,
          targetRegion:
            call.targetRegion,
          targetName:
            call.targetName,
          controlFlow:
            call.controlFlow ??
            "unknown" as const,
        }),
      ),
    );

  return summarizeCallGraph(
    callEdges,
    releaseFunctionPattern,
  );
}

export function composeQualifiedScriptLifecycleProjectGraph(
  inputs:
    readonly ScriptLifecycleProjectInput[],
  crossFileCalls:
    readonly CrossFileCallEdge[],
  releaseFunctionPattern:
    RegExp =
      /(?:release|cleanup|reset|finish|finalize)/i,
): ScriptLifecycleProjectGraph {
  const moduleOwners = new Map<string, ScriptLifecycleProjectInput[]>();
  for (const input of inputs) {
    const known = moduleOwners.get(input.fileId);
    if (known) known.push(input);
    else moduleOwners.set(input.fileId, [input]);
  }
  // Source-bound means unique current-artifact module ownership plus
  // exact authored call/declaration evidence. It never proves the call
  // executed or that a live player/arena object was retained.
  const validSpan = (source: {
    artifactId: string;
    relativePath: string;
    range?: { lineStart?: number; columnStart?: number;
      lineEnd?: number; columnEnd?: number };
  } | undefined): boolean => {
    const r = source?.range;
    return Boolean(source?.artifactId.trim() && source.relativePath.trim() &&
      r && [r.lineStart, r.columnStart, r.lineEnd, r.columnEnd]
        .every(n => typeof n === "number" &&
          Number.isSafeInteger(n) && n > 0));
  };
  const owned = (path: string, artifactId: string): boolean => {
    const modules = moduleOwners.get(path) ?? [];
    return artifactId.trim().length > 0 &&
      modules.length === 1 && modules[0]!.artifactId === artifactId;
  };
  const localEdges = inputs.flatMap(item =>
    item.localFunctionCalls.map(call => ({
      callerRegion: qualifiedRegion(item.fileId, call.callerRegion),
      targetRegion: qualifiedRegion(item.fileId, call.targetRegion),
      targetName: call.targetName,
      controlFlow: call.controlFlow ?? "unknown" as const,
      sourceBound: item.artifactId !== undefined &&
        owned(item.fileId, item.artifactId) &&
        validSpan(call.source) && validSpan(call.targetSource) &&
        call.source.artifactId === item.artifactId &&
        call.source.relativePath === item.fileId &&
        call.targetSource?.artifactId === item.artifactId &&
        call.targetSource.relativePath === item.fileId,
    })));

  const sourceBoundExternal = (call: CrossFileCallEdge): boolean => {
    const target = call.targetSource;
    if (call.status !== "resolved" || !target || !call.targetModule ||
        !call.targetRegion || !validSpan(call.source) || !validSpan(target) ||
        call.source.artifactId !== target.artifactId ||
        call.source.relativePath !== call.callerModule ||
        target.relativePath !== call.targetModule ||
        !owned(call.callerModule, call.source.artifactId) ||
        !owned(call.targetModule, target.artifactId)) return false;
    // A resolved function name does not bind the arena passed to it.
    // Zero-argument source calls are eligible by arity. Nonzero calls
    // require a complete one-to-one stable actual/formal correspondence,
    // from the existing exact ESM resolver, before SOURCE-positive proof.
    const n = call.actualArgumentCount;
    if (n === undefined || n !== call.targetParameterCount) return false;
    if (n === 0) return true;
    const bindings = call.argumentParameterBindings ?? [];
    if (bindings.length !== n) return false;
    const indexes = new Set<number>();
    for (const binding of bindings) {
      if (!Number.isSafeInteger(binding.index) || binding.index < 0 ||
          binding.index >= n || indexes.has(binding.index) ||
          !validSpan(binding.argumentSource) ||
          !validSpan(binding.parameterSource) ||
          binding.argumentSource.artifactId !== call.source.artifactId ||
          binding.argumentSource.relativePath !== call.callerModule ||
          binding.parameterSource.artifactId !== target.artifactId ||
          binding.parameterSource.relativePath !== call.targetModule) {
        return false;
      }
      indexes.add(binding.index);
    }
    return indexes.size === n;
  };

  // Keep an unverified ESM route in the graph for investigation, but
  // prohibit it from satisfying a strong terminal/deferred ownership path.
  // Do not silently reinterpret a source-authored unconditional call as
  // conditional; controlFlow and sourceBound describe different facts.
  const externalEdges = crossFileCalls.map(call => ({
    callerRegion: qualifiedRegion(call.callerModule, call.callerRegion),
    targetRegion:
      call.status === "resolved" &&
      call.targetModule !== undefined &&
      call.targetRegion !== undefined
        ? qualifiedRegion(call.targetModule, call.targetRegion)
        : "unresolved:" + call.callerModule + "->" + call.targetExport,
    targetName: call.targetExport,
    controlFlow: call.controlFlow,
    sourceBound: sourceBoundExternal(call),
  }));

  return summarizeCallGraph(
    [
      ...localEdges,
      ...externalEdges,
    ],
    releaseFunctionPattern,
  );
}
