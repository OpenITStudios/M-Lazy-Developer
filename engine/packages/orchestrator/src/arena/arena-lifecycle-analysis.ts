import type {
  CrossFileCallEdge,
  ParsedScriptFile,
  ScriptArenaAuthorityPath,
  ScriptTerminalIdempotencyEvidence,
  ScriptTerminalPrecedenceEvidence,
} from "../../../../analyzers/scripts/src/index.js";
import {
  composeQualifiedScriptLifecycleProjectGraph,
} from "../../../../analyzers/scripts/src/index.js";
import type { SourceRef } from "../../../project-model/src/index.js";

export type ArenaLifecycleConvergenceStatus =
  | "proven"
  | "partial"
  | "unresolved";

export interface ArenaLifecycleScopeAssessment {
  arenaExpression: string;
  membershipRelease: boolean;
  generationInvalidation: boolean;
  status: ArenaLifecycleConvergenceStatus;
}

export interface ArenaLifecycleTerminalAssessment {
  scriptId: string;
  terminalRegion: string;
  candidateBasis: readonly (
    | "terminal-name"
    | "membership-release"
    | "generation-invalidation"
  )[];
  reachableRegions: readonly string[];
  scopes: readonly ArenaLifecycleScopeAssessment[];
  unguardedDeferredCallbacks: number;
  status: ArenaLifecycleConvergenceStatus;
}

export interface ArenaTerminalIngressAssessment {
  scriptId: string;
  terminalRegion: string;
  incomingCallerRegions: readonly string[];
  incomingControlFlows: readonly (
    | "unconditional"
    | "conditional"
    | "deferred"
    | "unknown"
  )[];
  distinctIngresses: number;
  status: "single-ingress" | "multi-ingress";
}

export interface ArenaTerminalRaceIngress {
  readonly kind:
    | "event"
    | "deferred";
  readonly id: string;
  readonly callbackRegion: string;
  readonly guardStatus:
    | "guarded"
    | "unguarded"
    | "not-applicable";
}

export interface ArenaTerminalRaceAssessment {
  readonly scriptId: string;
  readonly terminalRegion: string;
  readonly ingresses:
    readonly ArenaTerminalRaceIngress[];
  readonly status:
    | "protected"
    | "contradicted"
    | "unresolved";
  readonly idempotencyKind?:
    | "boolean-latch"
    | "state-latch";
  readonly precedence?:
    | {
        readonly policyBinding: string;
        readonly policyKind:
          | "ordered-outcomes"
          | "priority-table";
        readonly outcomes:
          readonly string[];
      };
  readonly precedenceStatus:
    | "proven"
    | "unresolved";
  readonly reason: string;
}

export interface ArenaDeferredMutationAssessment {
  readonly scriptId: string;
  readonly scheduler:
    | "run"
    | "runTimeout"
    | "runInterval"
    | "runJob";
  readonly callbackRegion: string;
  readonly mutationRegions: readonly string[];
  readonly guardIdentifiers: readonly string[];
  readonly generationGuardSource?: SourceRef;
  readonly generationGuardOperands?: readonly [string, string];
  /** Reserved 'protected' requires ownership/capture proof not provided by
   * a lexical guard pattern or region-level reachability alone.
   */
  readonly status:
    | "protected"
    | "source-guard-candidate"
    | "unresolved";
  readonly reason: string;
}

export interface ArenaLifecycleAnalysis {
  terminalCandidates: number;
  proven: number;
  partial: number;
  unresolved: number;
  multiIngressTerminalTargets: number;
  terminalIngresses:
    readonly ArenaTerminalIngressAssessment[];
  terminalRaces:
    readonly ArenaTerminalRaceAssessment[];
  protectedTerminalRaces: number;
  provenTerminalRaces: number;
  unresolvedTerminalRaces: number;
  terminalPrecedenceProven: number;
  terminalPrecedenceUnresolved: number;
  /** Source-only guard patterns must never increment protected. */
  protectedDeferredMutations: number;
  sourceGuardCandidateDeferredMutations: number;
  /** Includes candidate guard patterns without owner/capture proof. */
  unresolvedDeferredMutations: number;
  staleReadySnapshotRisks: number;
  readySetSnapshotRisks: readonly {
    scriptId: string;
    arenaExpression: string;
    executionRegion: string;
    snapshotExpression?: string;
  }[];
  deferredMutations:
    readonly ArenaDeferredMutationAssessment[];
  assessments: readonly ArenaLifecycleTerminalAssessment[];
  crossFileCalls?: number;
}

const TERMINAL_NAMES = new Set([
  "endgame",
  "endmatch",
  "finishgame",
  "finishmatch",
  "cleanup",
  "cleanuparena",
  "reset",
  "resetarena",
  "abort",
  "abortgame",
  "timeout",
  "victory",
  "defeat",
  "stopgame",
  "leavearena",
  "disconnect",
  "playerleave",
  "onplayerleave",
]);

type CandidateBasis =
  ArenaLifecycleTerminalAssessment["candidateBasis"][number];

function regionFunctionName(
  region: string,
): string {
  const marker = "#function:";
  const qualified = region.lastIndexOf(marker);
  if (qualified >= 0) {
    return region.slice(
      qualified + marker.length,
    );
  }
  return region.startsWith("function:")
    ? region.slice("function:".length)
    : region;
}

function terminalNameCandidate(
  region: string,
): boolean {
  return TERMINAL_NAMES.has(
    regionFunctionName(region)
      .replace(/[^A-Za-z0-9]/g, "")
      .toLowerCase(),
  );
}

function qualifiedRegion(
  script: ParsedScriptFile,
  region: string,
): string {
  return (
    "module:" +
    script.source.relativePath +
    "#" +
    region
  );
}

function graphFor(
  script: ParsedScriptFile,
): Map<string, Set<string>> {
  const graph = new Map<
    string,
    Set<string>
  >();
  for (const call of script.localFunctionCalls) {
    const targets =
      graph.get(call.callerRegion) ??
      new Set<string>();
    targets.add(call.targetRegion);
    graph.set(
      call.callerRegion,
      targets,
    );
  }
  return graph;
}

function reachable(
  graph:
    ReadonlyMap<
      string,
      ReadonlySet<string>
    >,
  root: string,
): string[] {
  const seen = new Set<string>([root]);
  const queue = [root];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (
      const next of
        graph.get(current) ?? []
    ) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return [...seen].sort();
}

/** Position-qualified owner IDs remain canonical evidence identities.
 * A parser/CFG region can be used for graph traversal only after the parser
 * established its unique declaration binding. Never strip source offsets.
 */
function arenaRegion(path: ScriptArenaAuthorityPath): string {
  return path.parserExecutionRegion ?? path.executionRegion;
}

function authorityPathsByRegion(
  script: ParsedScriptFile,
): Map<string, ScriptArenaAuthorityPath[]> {
  const output =
    new Map<
      string,
      ScriptArenaAuthorityPath[]
    >();
  for (
    const path of
      script.arenaAuthorityPaths ?? []
  ) {
    const list =
      output.get(arenaRegion(path)) ??
      [];
    list.push(path);
    output.set(
      arenaRegion(path),
      list,
    );
  }
  return output;
}

function terminalRegions(
  script: ParsedScriptFile,
): Map<string, Set<CandidateBasis>> {
  const output =
    new Map<
      string,
      Set<CandidateBasis>
    >();

  const add = (
    region: string,
    basis: CandidateBasis,
  ) => {
    const set =
      output.get(region) ??
      new Set<CandidateBasis>();
    set.add(basis);
    output.set(region, set);
  };

  for (
    const call of
      script.localFunctionCalls
  ) {
    if (
      terminalNameCandidate(
        call.callerRegion,
      )
    ) {
      add(
        call.callerRegion,
        "terminal-name",
      );
    }
    if (
      terminalNameCandidate(
        call.targetRegion,
      )
    ) {
      add(
        call.targetRegion,
        "terminal-name",
      );
    }
  }

  for (
    const path of
      script.arenaAuthorityPaths ?? []
  ) {
    if (
      terminalNameCandidate(
        arenaRegion(path),
      )
    ) {
      add(
        arenaRegion(path),
        "terminal-name",
      );
    }
    if (path.membershipRelease) {
      add(
        arenaRegion(path),
        "membership-release",
      );
    }
    if (path.generationInvalidation) {
      add(
        arenaRegion(path),
        "generation-invalidation",
      );
    }
  }

  for (
    const callback of
      script.deferredCallbacks
  ) {
    if (
      callback.callerRegion &&
      terminalNameCandidate(
        callback.callerRegion,
      )
    ) {
      add(
        callback.callerRegion,
        "terminal-name",
      );
    }
  }

  return output;
}

function assessScript(
  script: ParsedScriptFile,
): ArenaLifecycleTerminalAssessment[] {
  const graph = graphFor(script);
  const paths =
    authorityPathsByRegion(script);
  const candidates =
    terminalRegions(script);
  const output:
    ArenaLifecycleTerminalAssessment[] =
      [];

  for (
    const [terminalRegion, basis] of
      candidates
  ) {
    const regions =
      reachable(
        graph,
        terminalRegion,
      );
    const byArena =
      new Map<
        string,
        {
          release: boolean;
          invalidate: boolean;
        }
      >();

    for (const region of regions) {
      for (
        const path of
          paths.get(region) ?? []
      ) {
        const state =
          byArena.get(
            path.arenaExpression,
          ) ?? {
            release: false,
            invalidate: false,
          };
        state.release ||=
          path.membershipRelease !==
          undefined;
        state.invalidate ||=
          path.generationInvalidation !==
          undefined;
        byArena.set(
          path.arenaExpression,
          state,
        );
      }
    }

    const scopes:
      ArenaLifecycleScopeAssessment[] =
      [...byArena.entries()]
        .map(
          ([
            arenaExpression,
            state,
          ]) => ({
            arenaExpression,
            membershipRelease:
              state.release,
            generationInvalidation:
              state.invalidate,
            status:
              state.release &&
              state.invalidate
                ? "proven" as const
                : state.release ||
                    state.invalidate
                  ? "partial" as const
                  : "unresolved" as const,
          }),
        )
        .sort((a, b) =>
          a.arenaExpression
            .localeCompare(
              b.arenaExpression,
            ),
        );

    const unguardedDeferredCallbacks =
      script.deferredCallbacks.filter(
        (callback) =>
          callback.callerRegion !==
            undefined &&
          regions.includes(
            callback.callerRegion,
          ) &&
          callback.guardEvidence ===
            "unresolved",
      ).length;

    const status:
      ArenaLifecycleConvergenceStatus =
      scopes.length === 0
        ? "unresolved"
        : scopes.every(
              (item) =>
                item.status ===
                "proven",
            )
          ? "proven"
          : "partial";

    output.push({
      scriptId:
        script.identifier,
      terminalRegion,
      candidateBasis:
        [...basis].sort(),
      reachableRegions: regions,
      scopes,
      unguardedDeferredCallbacks,
      status,
    });
  }

  return output.sort((a, b) =>
    a.scriptId.localeCompare(
      b.scriptId,
    ) ||
    a.terminalRegion.localeCompare(
      b.terminalRegion,
    ),
  );
}

function projectReachable(
  edges:
    readonly {
      callerRegion: string;
      targetRegion: string;
      controlFlow:
        | "unconditional"
        | "conditional"
        | "deferred"
        | "unknown";
    }[],
  root: string,
  unconditionalOnly: boolean,
): string[] {
  const byFrom =
    new Map<
      string,
      string[]
    >();

  for (const edge of edges) {
    if (
      unconditionalOnly &&
      edge.controlFlow !==
        "unconditional"
    ) {
      continue;
    }
    const list =
      byFrom.get(
        edge.callerRegion,
      ) ?? [];
    list.push(
      edge.targetRegion,
    );
    byFrom.set(
      edge.callerRegion,
      list,
    );
  }

  return reachable(
    new Map(
      [...byFrom.entries()].map(
        ([key, value]) => [
          key,
          new Set(value),
        ],
      ),
    ),
    root,
  );
}

function assessProject(
  scripts: readonly ParsedScriptFile[],
  crossFileCalls:
    readonly CrossFileCallEdge[],
): ArenaLifecycleTerminalAssessment[] {
  const projectGraph =
    composeQualifiedScriptLifecycleProjectGraph(
      scripts.map((script) => ({
        fileId:
          script.source.relativePath,
        localFunctionCalls:
          script.localFunctionCalls,
      })),
      crossFileCalls,
    );

  const paths =
    new Map<
      string,
      ScriptArenaAuthorityPath[]
    >();
  const candidates =
    new Map<
      string,
      {
        scriptId: string;
        basis: Set<CandidateBasis>;
      }
    >();

  const addCandidate = (
    script: ParsedScriptFile,
    region: string,
    basis: CandidateBasis,
  ) => {
    const key =
      qualifiedRegion(
        script,
        region,
      );
    const current =
      candidates.get(key) ?? {
        scriptId:
          script.identifier,
        basis:
          new Set<CandidateBasis>(),
      };
    current.basis.add(basis);
    candidates.set(
      key,
      current,
    );
  };

  const scriptsByPath =
    new Map(
      scripts.map((script) => [
        script.source.relativePath,
        script,
      ]),
    );

  for (const call of crossFileCalls) {
    const callerScript =
      scriptsByPath.get(
        call.callerModule,
      );
    if (
      callerScript &&
      terminalNameCandidate(
        call.callerRegion,
      )
    ) {
      addCandidate(
        callerScript,
        call.callerRegion,
        "terminal-name",
      );
    }

    if (
      call.status === "resolved" &&
      call.targetModule !== undefined
    ) {
      const targetScript =
        scriptsByPath.get(
          call.targetModule,
        );
      if (
        targetScript &&
        terminalNameCandidate(
          "function:" +
            call.targetExport,
        )
      ) {
        addCandidate(
          targetScript,
          "function:" +
            call.targetExport,
          "terminal-name",
        );
      }
    }
  }

  for (const script of scripts) {
    for (
      const path of
        script.arenaAuthorityPaths ??
        []
    ) {
      const key =
        qualifiedRegion(
          script,
          arenaRegion(path),
        );
      const list =
        paths.get(key) ?? [];
      list.push(path);
      paths.set(key, list);

      if (
        terminalNameCandidate(
          arenaRegion(path),
        )
      ) {
        addCandidate(
          script,
          arenaRegion(path),
          "terminal-name",
        );
      }
      if (path.membershipRelease) {
        addCandidate(
          script,
          arenaRegion(path),
          "membership-release",
        );
      }
      if (
        path.generationInvalidation
      ) {
        addCandidate(
          script,
          arenaRegion(path),
          "generation-invalidation",
        );
      }
    }

    for (
      const call of
        script.localFunctionCalls
    ) {
      if (
        terminalNameCandidate(
          call.callerRegion,
        )
      ) {
        addCandidate(
          script,
          call.callerRegion,
          "terminal-name",
        );
      }
      if (
        terminalNameCandidate(
          call.targetRegion,
        )
      ) {
        addCandidate(
          script,
          call.targetRegion,
          "terminal-name",
        );
      }
    }

    for (
      const callback of
        script.deferredCallbacks
    ) {
      if (
        callback.callerRegion &&
        terminalNameCandidate(
          callback.callerRegion,
        )
      ) {
        addCandidate(
          script,
          callback.callerRegion,
          "terminal-name",
        );
      }
    }
  }

  const output:
    ArenaLifecycleTerminalAssessment[] =
      [];

  for (
    const [
      terminalRegion,
      candidate,
    ] of candidates
  ) {
    const allRegions =
      projectReachable(
        projectGraph.callEdges,
        terminalRegion,
        false,
      );
    const strongRegions =
      new Set(
        projectReachable(
          projectGraph.callEdges,
          terminalRegion,
          true,
        ),
      );

    const byArena =
      new Map<
        string,
        {
          releaseAny: boolean;
          invalidateAny: boolean;
          releaseStrong: boolean;
          invalidateStrong:
            boolean;
        }
      >();

    for (const region of allRegions) {
      for (
        const path of
          paths.get(region) ?? []
      ) {
        const state =
          byArena.get(
            path.arenaExpression,
          ) ?? {
            releaseAny: false,
            invalidateAny: false,
            releaseStrong: false,
            invalidateStrong: false,
          };

        const release =
          path.membershipRelease !==
          undefined;
        const invalidate =
          path.generationInvalidation !==
          undefined;

        state.releaseAny ||= release;
        state.invalidateAny ||=
          invalidate;

        if (
          strongRegions.has(region)
        ) {
          state.releaseStrong ||=
            release;
          state.invalidateStrong ||=
            invalidate;
        }

        byArena.set(
          path.arenaExpression,
          state,
        );
      }
    }

    const scopes =
      [...byArena.entries()]
        .map(
          ([
            arenaExpression,
            state,
          ]) => ({
            arenaExpression,
            membershipRelease:
              state.releaseAny,
            generationInvalidation:
              state.invalidateAny,
            status:
              state.releaseStrong &&
              state.invalidateStrong
                ? "proven" as const
                : state.releaseAny ||
                    state.invalidateAny
                  ? "partial" as const
                  : "unresolved" as const,
          }),
        )
        .sort((a, b) =>
          a.arenaExpression
            .localeCompare(
              b.arenaExpression,
            ),
        );

    const unguardedDeferredCallbacks =
      scripts.reduce(
        (count, script) =>
          count +
          script.deferredCallbacks
            .filter(
              (callback) =>
                callback.callerRegion !==
                  undefined &&
                allRegions.includes(
                  qualifiedRegion(
                    script,
                    callback.callerRegion,
                  ),
                ) &&
                callback
                  .guardEvidence ===
                  "unresolved",
            )
            .length,
        0,
      );

    const status:
      ArenaLifecycleConvergenceStatus =
      scopes.length === 0
        ? "unresolved"
        : scopes.every(
              (item) =>
                item.status ===
                "proven",
            )
          ? "proven"
          : "partial";

    output.push({
      scriptId:
        candidate.scriptId,
      terminalRegion,
      candidateBasis:
        [...candidate.basis].sort(),
      reachableRegions:
        allRegions,
      scopes,
      unguardedDeferredCallbacks,
      status,
    });
  }

  return output.sort((a, b) =>
    a.scriptId.localeCompare(
      b.scriptId,
    ) ||
    a.terminalRegion.localeCompare(
      b.terminalRegion,
    ),
  );
}

function terminalIngressesForLocal(
  scripts: readonly ParsedScriptFile[],
  assessments:
    readonly ArenaLifecycleTerminalAssessment[],
): ArenaTerminalIngressAssessment[] {
  return assessments.map((assessment) => {
    const script = scripts.find(
      (item) =>
        item.identifier === assessment.scriptId,
    );
    const incoming =
      script?.localFunctionCalls.filter(
        (call) =>
          call.targetRegion ===
            assessment.terminalRegion,
      ) ?? [];
    const callers = [
      ...new Set(
        incoming.map(
          (call) => call.callerRegion,
        ),
      ),
    ].sort();
    const flows = [
      ...new Set(
        incoming.map(
          (call) =>
            call.controlFlow ??
            "unknown" as const,
        ),
      ),
    ].sort();
    return {
      scriptId: assessment.scriptId,
      terminalRegion:
        assessment.terminalRegion,
      incomingCallerRegions: callers,
      incomingControlFlows: flows,
      distinctIngresses: callers.length,
      status:
        callers.length > 1
          ? "multi-ingress" as const
          : "single-ingress" as const,
    };
  });
}

function terminalIngressesForProject(
  scripts: readonly ParsedScriptFile[],
  crossFileCalls:
    readonly CrossFileCallEdge[],
  assessments:
    readonly ArenaLifecycleTerminalAssessment[],
): ArenaTerminalIngressAssessment[] {
  const projectGraph =
    composeQualifiedScriptLifecycleProjectGraph(
      scripts.map((script) => ({
        fileId:
          script.source.relativePath,
        localFunctionCalls:
          script.localFunctionCalls,
      })),
      crossFileCalls,
    );

  return assessments.map((assessment) => {
    const incoming =
      projectGraph.callEdges.filter(
        (edge) =>
          edge.targetRegion ===
            assessment.terminalRegion,
      );
    const callers = [
      ...new Set(
        incoming.map(
          (edge) => edge.callerRegion,
        ),
      ),
    ].sort();
    const flows = [
      ...new Set(
        incoming.map(
          (edge) => edge.controlFlow,
        ),
      ),
    ].sort();
    return {
      scriptId: assessment.scriptId,
      terminalRegion:
        assessment.terminalRegion,
      incomingCallerRegions: callers,
      incomingControlFlows: flows,
      distinctIngresses: callers.length,
      status:
        callers.length > 1
          ? "multi-ingress" as const
          : "single-ingress" as const,
    };
  });
}

function terminalIdempotencyMap(
  evidence:
    readonly ScriptTerminalIdempotencyEvidence[],
): Map<
  string,
  ScriptTerminalIdempotencyEvidence
> {
  return new Map(
    evidence.map((item) => [
      "module:" +
        item.source.relativePath +
        "#" +
        item.functionRegion,
      item,
    ]),
  );
}

function terminalIngressReachable(
  edges:
    readonly {
      callerRegion: string;
      targetRegion: string;
      controlFlow:
        | "unconditional"
        | "conditional"
        | "deferred"
        | "unknown";
    }[],
  root: string,
  target: string,
  allowDeferredRoot: boolean,
): boolean {
  const seen =
    new Set<string>([root]);
  const queue: {
    region: string;
    root: boolean;
  }[] = [{
    region: root,
    root: true,
  }];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (
      current.region === target
    ) {
      return true;
    }

    for (
      const edge of edges.filter(
        (item) =>
          item.callerRegion ===
            current.region,
      )
    ) {
      const allowed =
        edge.controlFlow ===
          "unconditional" ||
        (
          current.root &&
          allowDeferredRoot &&
          edge.controlFlow ===
            "deferred"
        );
      if (
        !allowed ||
        seen.has(
          edge.targetRegion,
        )
      ) {
        continue;
      }
      seen.add(edge.targetRegion);
      queue.push({
        region:
          edge.targetRegion,
        root: false,
      });
    }
  }

  return false;
}

function terminalRaceAssessments(
  scripts: readonly ParsedScriptFile[],
  crossFileCalls:
    readonly CrossFileCallEdge[],
  assessments:
    readonly ArenaLifecycleTerminalAssessment[],
  idempotencyEvidence:
    readonly ScriptTerminalIdempotencyEvidence[],
  precedenceEvidence:
    readonly ScriptTerminalPrecedenceEvidence[],
): ArenaTerminalRaceAssessment[] {
  const idempotency =
    terminalIdempotencyMap(
      idempotencyEvidence,
    );
  const precedence = new Map(
    precedenceEvidence.map((item) => [
      item.source.relativePath +
        "|" +
        item.functionRegion,
      item,
    ]),
  );
  const output:
    ArenaTerminalRaceAssessment[] = [];

  const projectGraph =
    crossFileCalls.length === 0
      ? undefined
      : composeQualifiedScriptLifecycleProjectGraph(
          scripts.map((script) => ({
            fileId:
              script.source.relativePath,
            localFunctionCalls:
              script.localFunctionCalls,
          })),
          crossFileCalls,
        );

  for (const assessment of assessments) {
    const script =
      scripts.find(
        (item) =>
          item.identifier ===
          assessment.scriptId,
      );
    if (!script) continue;

    const target =
      assessment.terminalRegion.startsWith(
        "module:",
      )
        ? assessment.terminalRegion
        : qualifiedRegion(
            script,
            assessment.terminalRegion,
          );

    const ingresses:
      ArenaTerminalRaceIngress[] = [];

    for (const owner of scripts) {
      const localReach = (
        callbackRegion: string,
        allowDeferredRoot: boolean,
      ): boolean => {
        if (projectGraph) {
          return terminalIngressReachable(
            projectGraph.callEdges,
            qualifiedRegion(
              owner,
              callbackRegion,
            ),
            target,
            allowDeferredRoot,
          );
        }
        if (
          owner.identifier !==
            assessment.scriptId
        ) {
          return false;
        }
        const edges =
          owner.localFunctionCalls.map(
            (call) => ({
              callerRegion:
                call.callerRegion,
              targetRegion:
                call.targetRegion,
              controlFlow:
                call.controlFlow ??
                "unknown" as const,
            }),
          );
        return terminalIngressReachable(
          edges,
          callbackRegion,
          assessment.terminalRegion,
          allowDeferredRoot,
        );
      };

      for (
        const subscription of
          owner.events
      ) {
        if (
          subscription.callbackRegion ===
            undefined ||
          subscription.root ===
            "unknown" ||
          subscription.phase ===
            "unknown" ||
          !localReach(
            subscription.callbackRegion,
            false,
          )
        ) {
          continue;
        }
        ingresses.push({
          kind: "event",
          id:
            subscription.root +
            "." +
            subscription.phase +
            "." +
            subscription.event,
          callbackRegion:
            projectGraph
              ? qualifiedRegion(
                  owner,
                  subscription.callbackRegion,
                )
              : subscription.callbackRegion,
          guardStatus:
            "not-applicable",
        });
      }

      for (
        const callback of
          owner.deferredCallbacks
      ) {
        if (
          callback.callbackRegion ===
            undefined ||
          !localReach(
            callback.callbackRegion,
            true,
          )
        ) {
          continue;
        }
        ingresses.push({
          kind: "deferred",
          id:
            "deferred:" +
            callback.scheduler +
            "@" +
            (
              callback.callerRegion ??
              "unknown"
            ),
          callbackRegion:
            projectGraph
              ? qualifiedRegion(
                  owner,
                  callback.callbackRegion,
                )
              : callback.callbackRegion,
          guardStatus:
            callback.guardEvidence ===
              "explicit-generation-check"
              ? "guarded"
              : "unguarded",
        });
      }
    }

    const uniqueIngresses =
      [...new Map(
        ingresses.map((item) => [
          item.kind +
            "|" +
            item.id +
            "|" +
            item.callbackRegion,
          item,
        ]),
      ).values()].sort((a, b) =>
        a.id.localeCompare(b.id) ||
        a.callbackRegion.localeCompare(
          b.callbackRegion,
        )
      );

    const distinctIds =
      new Set(
        uniqueIngresses.map(
          (item) =>
            item.kind +
            ":" +
            item.id,
        ),
      );
    if (distinctIds.size < 2) {
      continue;
    }

    const latch =
      idempotency.get(target);
    const precedencePolicy =
      precedence.get(
        script.source.relativePath +
          "|" +
          assessment.terminalRegion,
      );
    const unguardedDeferred =
      uniqueIngresses.filter(
        (item) =>
          item.kind ===
            "deferred" &&
          item.guardStatus ===
            "unguarded",
      );
    const hasOtherIngress =
      uniqueIngresses.some(
        (item) =>
          !unguardedDeferred.includes(
            item,
          ),
      );

    const status =
      latch !== undefined
        ? "protected" as const
        : unguardedDeferred.length > 0 &&
            hasOtherIngress
          ? "contradicted" as const
          : "unresolved" as const;

    output.push({
      scriptId:
        assessment.scriptId,
      terminalRegion:
        assessment.terminalRegion,
      ingresses: uniqueIngresses,
      status,
      ...(latch === undefined
        ? {}
        : {
            idempotencyKind:
              latch.kind,
          }),
      ...(precedencePolicy === undefined
        ? {}
        : {
            precedence: {
              policyBinding:
                precedencePolicy.policyBinding,
              policyKind:
                precedencePolicy.policyKind,
              outcomes:
                [...precedencePolicy.outcomes],
            },
          }),
      precedenceStatus:
        precedencePolicy === undefined
          ? "unresolved"
          : "proven",
      reason:
        status === "protected"
          ? "Multiple distinct terminal ingresses converge on the same terminal owner, but the terminal owner has a source-proven one-shot latch."
          : status ===
              "contradicted"
            ? "An unguarded deferred terminal callback remains able to reach the same terminal owner as another distinct ingress, and the terminal owner has no source-proven one-shot latch."
            : "Multiple distinct terminal ingresses reach the same terminal owner, but source evidence does not yet prove coexistence or a blocking/idempotent exclusion.",
    });
  }

  return output.sort((a, b) =>
    a.scriptId.localeCompare(
      b.scriptId,
    ) ||
    a.terminalRegion.localeCompare(
      b.terminalRegion,
    )
  );
}


const ARENA_MUTATION_KINDS =
  new Set([
    "membership-commit",
    "membership-release",
    "generation-invalidate",
    "start-owner-acquire",
    "start-state-commit",
  ]);

const INVENTORY_MUTATION_KINDS =
  new Set([
    "inventory-clear-all",
    "inventory-clear-slot",
    "equipment-clear-slot",
    "item-grant",
    "equipment-set",
    "item-writeback",
    "item-drop",
    "item-world-spawn",
  ]);

const ECONOMY_MUTATION_KINDS =
  new Set([
    "inventory-grant",
    "world-drop",
    "score-credit",
    "score-debit",
    "score-adjust",
    "score-write",
    "item-consume",
  ]);

const COMBAT_MUTATION_KINDS =
  new Set([
    "damage-apply",
    "knockback",
    "effect-apply",
    "ignite",
    "projectile-spawn",
    "projectile-remove",
  ]);

const CHUNK_MUTATION_KINDS =
  new Set([
    "ticking-area-acquire",
    "ticking-area-release",
  ]);

const PROGRESSION_MUTATION_KINDS =
  new Set([
    "growth",
    "decrement",
    "replacement",
  ]);

function materialMutationRegions(
  script: ParsedScriptFile,
): string[] {
  return [
    ...new Set([
      ...(script.stateMutations ?? [])
        .map((item) =>
          item.executionRegion
        ),
      ...(script.arenaAuthorityEvidence ?? [])
        .filter((item) =>
          ARENA_MUTATION_KINDS.has(
            item.kind,
          )
        )
        .map((item) => {
          // Reuse exactly one evidence-owner-to-parser binding; a lexical
          // name shared by other declarations is not enough to join regions.
          const owners = (script.arenaAuthorityPaths ?? []).filter(path =>
            path.executionRegion === item.executionRegion &&
            path.arenaExpression === item.arenaExpression);
          return owners.length === 1
            ? arenaRegion(owners[0]!)
            : item.executionRegion;
        }),
      ...(script.inventoryLifecycleEvidence ?? [])
        .filter((item) =>
          INVENTORY_MUTATION_KINDS.has(
            item.kind,
          )
        )
        .map((item) =>
          item.executionRegion
        ),
      ...(script.economyEvidence ?? [])
        .filter((item) =>
          ECONOMY_MUTATION_KINDS.has(
            item.kind,
          )
        )
        .map((item) =>
          item.executionRegion
        ),
      ...(script.combatLifecycleEvidence ?? [])
        .filter((item) =>
          COMBAT_MUTATION_KINDS.has(
            item.kind,
          )
        )
        .map((item) =>
          item.executionRegion
        ),
      ...(script.chunkLifecycleEvidence ?? [])
        .filter((item) =>
          CHUNK_MUTATION_KINDS.has(
            item.kind,
          )
        )
        .map((item) =>
          item.executionRegion
        ),
      ...(script.progressionCounterEvidence ?? [])
        .filter((item) =>
          PROGRESSION_MUTATION_KINDS.has(
            item.kind,
          )
        )
        .map((item) =>
          item.executionRegion
        ),
      ...(script.progressionActorSpawnEvidence ?? [])
        .map((item) =>
          item.executionRegion
        ),
      ...script.entityEventTriggers.map(
        (item) =>
          item.executionRegion ??
          "module",
      ),
    ]),
  ].sort();
}

function deferredMutationAssessments(
  scripts: readonly ParsedScriptFile[],
  crossFileCalls:
    readonly CrossFileCallEdge[],
): ArenaDeferredMutationAssessment[] {
  const projectGraph =
    crossFileCalls.length === 0
      ? undefined
      : composeQualifiedScriptLifecycleProjectGraph(
          scripts.map((script) => ({
            fileId:
              script.source.relativePath,
            localFunctionCalls:
              script.localFunctionCalls,
          })),
          crossFileCalls,
        );

  const projectMutationRegions =
    new Set(
      scripts.flatMap((script) =>
        materialMutationRegions(script)
          .map((region) =>
            qualifiedRegion(
              script,
              region,
            )
          )
      ),
    );

  const output:
    ArenaDeferredMutationAssessment[] =
      [];

  for (const script of scripts) {
    const localMutations =
      new Set(
        materialMutationRegions(
          script,
        ),
      );
    const localGraph =
      graphFor(script);

    for (
      const callback of
        script.deferredCallbacks
    ) {
      if (!callback.callbackRegion) {
        continue;
      }

      const reachableRegions =
        projectGraph
          ? projectReachable(
              projectGraph.callEdges,
              qualifiedRegion(
                script,
                callback.callbackRegion,
              ),
              false,
            )
          : reachable(
              localGraph,
              callback.callbackRegion,
            );

      const mutationRegions =
        reachableRegions.filter(
          (region) =>
            projectGraph
              ? projectMutationRegions
                  .has(region)
              : localMutations
                  .has(region),
        );

      if (
        mutationRegions.length === 0
      ) {
        continue;
      }

      // A leading mismatch return is merely an authored guard candidate:
      // region co-location cannot prove stable token capture or arena/session
      // identity, and must never imply a protected gameplay mutation.
      const sameCallbackGuardCandidate =
        callback.guardEvidence === "explicit-generation-check" &&
        callback.generationGuardSource !== undefined &&
        mutationRegions.every(region =>
          region === (projectGraph
            ? qualifiedRegion(script, callback.callbackRegion!)
            : callback.callbackRegion));
      output.push({
        scriptId:
          script.identifier,
        scheduler:
          callback.scheduler,
        callbackRegion:
          callback.callbackRegion,
        mutationRegions:
          [...mutationRegions].sort(),
        guardIdentifiers:
          [...callback.guardIdentifiers],
        ...(callback.generationGuardSource === undefined ? {} : {
          generationGuardSource: callback.generationGuardSource,
        }),
        ...(callback.generationGuardOperands === undefined ? {} : {
          generationGuardOperands: callback.generationGuardOperands,
        }),
        status: sameCallbackGuardCandidate
          ? "source-guard-candidate"
          : "unresolved",
        reason: sameCallbackGuardCandidate
          ? "A leading mismatch exit is authored, but immutable captured token, same arena/session identity, invalidation, and mutation ownership remain unproven."
          : "A direct guard is not evidenced for every reachable mutation; deferred ownership remains unresolved.",
      });
    }
  }

  return output.sort((a, b) =>
    a.scriptId.localeCompare(
      b.scriptId,
    ) ||
    a.callbackRegion.localeCompare(
      b.callbackRegion,
    )
  );
}

export function analyzeArenaLifecycleConvergence(
  scripts: readonly ParsedScriptFile[],
  crossFileCalls:
    readonly CrossFileCallEdge[] = [],
  terminalIdempotencyEvidence:
    readonly ScriptTerminalIdempotencyEvidence[] = [],
  terminalPrecedenceEvidence:
    readonly ScriptTerminalPrecedenceEvidence[] = [],
): ArenaLifecycleAnalysis {
  const assessments =
    crossFileCalls.length === 0
      ? scripts.flatMap(assessScript)
      : assessProject(
          scripts,
          crossFileCalls,
        );

  const terminalIngresses =
    crossFileCalls.length === 0
      ? terminalIngressesForLocal(
          scripts,
          assessments,
        )
      : terminalIngressesForProject(
          scripts,
          crossFileCalls,
          assessments,
        );
  const terminalRaces =
    terminalRaceAssessments(
      scripts,
      crossFileCalls,
      assessments,
      terminalIdempotencyEvidence,
      terminalPrecedenceEvidence,
    );
  const deferredMutations =
    deferredMutationAssessments(
      scripts,
      crossFileCalls,
    );
  const readySetSnapshotRisks =
    scripts.flatMap((script) =>
      (script.arenaAuthorityEvidence ?? [])
        .filter(
          (item) =>
            item.kind ===
              "ready-set-snapshot-risk",
        )
        .map((item) => ({
          scriptId:
            script.identifier,
          arenaExpression:
            item.arenaExpression,
          executionRegion:
            item.executionRegion,
          ...(item.snapshotExpression === undefined
            ? {}
            : {
                snapshotExpression:
                  item.snapshotExpression,
              }),
        }))
    ).sort((a, b) =>
      a.scriptId.localeCompare(
        b.scriptId,
      ) ||
      a.executionRegion.localeCompare(
        b.executionRegion,
      )
    );

  return {
    terminalCandidates:
      assessments.length,
    proven:
      assessments.filter(
        (item) =>
          item.status === "proven",
      ).length,
    partial:
      assessments.filter(
        (item) =>
          item.status === "partial",
      ).length,
    unresolved:
      assessments.filter(
        (item) =>
          item.status ===
          "unresolved",
      ).length,
    multiIngressTerminalTargets:
      terminalIngresses.filter(
        (item) =>
          item.status ===
          "multi-ingress",
      ).length,
    terminalIngresses,
    terminalRaces,
    protectedTerminalRaces:
      terminalRaces.filter(
        (item) =>
          item.status ===
            "protected",
      ).length,
    provenTerminalRaces:
      terminalRaces.filter(
        (item) =>
          item.status ===
            "contradicted",
      ).length,
    unresolvedTerminalRaces:
      terminalRaces.filter(
        (item) =>
          item.status ===
            "unresolved",
      ).length,
    terminalPrecedenceProven:
      terminalRaces.filter(
        (item) =>
          item.precedenceStatus ===
            "proven",
      ).length,
    terminalPrecedenceUnresolved:
      terminalRaces.filter(
        (item) =>
          item.precedenceStatus ===
            "unresolved",
      ).length,
    protectedDeferredMutations:
      deferredMutations.filter(item => item.status === "protected").length,
    sourceGuardCandidateDeferredMutations:
      deferredMutations.filter(item =>
        item.status === "source-guard-candidate").length,
    unresolvedDeferredMutations:
      deferredMutations.filter(item => item.status !== "protected").length,
    staleReadySnapshotRisks:
      readySetSnapshotRisks.length,
    readySetSnapshotRisks,
    deferredMutations,
    assessments,
    ...(crossFileCalls.length === 0
      ? {}
      : {
          crossFileCalls:
            crossFileCalls.length,
        }),
  };
}
