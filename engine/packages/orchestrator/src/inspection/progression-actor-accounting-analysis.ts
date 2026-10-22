import { deriveProgressionActiveStateValues } from "../../../../analyzers/scripts/src/index.js";
import type { SourceRef } from "../../../project-model/src/index.js";
import type {
  CrossFileCallEdge,
  ParsedScriptFile,
  ScriptProgressionAdvanceEvidence,
  ScriptProgressionCounterEvidence,
  ScriptProgressionIdempotencyEvidence,
  ScriptProgressionOrdinalAdvanceEvidence,
  ScriptProgressionStateTransitionEvidence,
} from "../../../../analyzers/scripts/src/index.js";
import {
  analyzeEntityTransitionReachability,
  type ParsedEntityDefinition,
} from "../../../../analyzers/entities/src/index.js";
import type {
  EntityEventExternalEvidence,
} from "./entity-event-evidence.js";
import type {
  ScriptProgressionActiveCallEvidence,
  ScriptProgressionActiveEventEvidence,
} from "../../../../analyzers/scripts/src/index.js";
import type {
  ArenaLifecycleAnalysis,
  ArenaLifecycleTerminalAssessment,
} from "../arena/arena-lifecycle-analysis.js";

export type ProgressionCounterKind =
  | "variable"
  | "scoreboard";

export type ProgressionCounterStatus =
  | "reconciled-from-matched-actor-lifecycle"
  | "actor-identity-mismatch"
  | "spawn-quantity-mismatch"
  | "instant-despawn-without-reconciliation"
  | "active-instant-despawn-without-reconciliation"
  | "missing-reconciliation"
  | "deferred-spawn-accounting-unproven"
  | "unresolved";

export interface ProgressionCounterAssessment {
  readonly scriptId: string;
  readonly counterId: string;
  readonly kind: ProgressionCounterKind;
  readonly growthWrites: number;
  readonly decrementWrites: number;
  readonly replacementWrites: number;
  readonly completionChecks: number;
  readonly lifecycleLinkedDecrements: number;
  readonly deathLinkedDecrements: number;
  readonly removeLinkedDecrements: number;
  readonly reconciliationLifecycleKinds:
    readonly ("death" | "remove")[];
  readonly deathLifecycleActorIdentifiers:
    readonly string[];
  readonly removeLifecycleActorIdentifiers:
    readonly string[];
  readonly scriptedRemovalActorIdentifiers:
    readonly string[];
  readonly uncoveredScriptedRemovalActorIdentifiers:
    readonly string[];
  readonly scriptedRemovalCoverage:
    | "covered"
    | "uncovered"
    | "none"
    | "unresolved";
  readonly terminalOnlyScriptedRemovalActorIdentifiers:
    readonly string[];
  readonly nonTerminalScriptedRemovalActorIdentifiers:
    readonly string[];
  readonly unresolvedScriptedRemovalActorIdentifiers:
    readonly string[];
  readonly scriptedRemovalScope:
    | "terminal-only"
    | "non-terminal"
    | "unresolved"
    | "none";
  readonly immediateDespawnActorIdentifiers:
    readonly string[];
  readonly conditionalDespawnActorIdentifiers:
    readonly string[];
  readonly reachableConditionalDespawnActorIdentifiers:
    readonly string[];
  readonly terminalOnlyConditionalDespawnActorIdentifiers:
    readonly string[];
  readonly inactiveConditionalDespawnActorIdentifiers:
    readonly string[];
  readonly activeInstantDespawnActorIdentifiers:
    readonly string[];
  readonly uncoveredActiveInstantDespawnActorIdentifiers:
    readonly string[];
  readonly uncoveredImmediateDespawnActorIdentifiers:
    readonly string[];
  readonly unresolvedConditionalDespawnActorIdentifiers:
    readonly string[];
  readonly quantityComparableGrowths: number;
  readonly quantityMatchedGrowths: number;
  readonly quantityMismatchGrowths: number;
  readonly spawnQuantityStatus:
    | "matched"
    | "mismatch"
    | "unresolved"
    | "not-applicable";
  readonly actorAccountingCandidate: boolean;
  readonly spawnLinkedActorIdentifiers:
    readonly string[];
  readonly lifecycleActorIdentifiers:
    readonly string[];
  readonly matchedActorIdentifiers:
    readonly string[];
  readonly actorIdentityStatus:
    | "matched"
    | "mismatch"
    | "unresolved"
    | "not-applicable";
  readonly deferredSpawnActorIdentifiers:
    readonly string[];
  readonly deferredSpawnCallbacks: number;
  readonly deferredSpawnReservationStatus:
    | "covered-before-defer"
    | "unresolved"
    | "none";
  readonly deferredSpawnGenerationStatus:
    | "generation-guarded"
    | "unresolved"
    | "none";
  readonly deferredSpawnQuantityStatus:
    | "matched"
    | "mismatch"
    | "unresolved"
    | "none";
  readonly status: ProgressionCounterStatus;
  readonly reasons: readonly string[];
}

export interface ProgressionActorRegistryAuthorityAssessment {
  readonly scriptId: string;
  readonly registryExpression: string;
  readonly actorIdentifiers:
    readonly string[];
  readonly materializePaths: number;
  readonly lifecycleReleasePaths: number;
  readonly completionChecks: number;
  readonly generationBound: boolean;
  readonly status:
    | "generation-bound-authoritative"
    | "generation-unbound"
    | "incomplete";
  readonly reason: string;
}

export interface ProgressionStateTransitionAssessment {
  readonly scriptId: string;
  readonly target: string;
  readonly from: string;
  readonly to: string;
  readonly tableName?: string;
  readonly status:
    | "valid"
    | "invalid"
    | "unresolved";
  readonly allowedTargets:
    readonly string[];
  readonly reason: string;
}

export interface ProgressionAdvanceOwnershipAssessment {
  readonly scriptId: string;
  readonly executionRegion: string;
  readonly counterId: string;
  readonly effectTarget: string;
  readonly calls: number;
  readonly status:
    | "single"
    | "duplicate";
  readonly reason: string;
}

export interface ProgressionCrossIngressOrdinalAssessment {
  readonly scriptId: string;
  readonly ingress: string;
  readonly target: string;
  readonly callbackRegions:
    readonly string[];
  readonly totalAmount: number;
  readonly reason: string;
}

export interface ProgressionCrossIngressEffectAssessment {
  readonly scriptId: string;
  readonly ingress: string;
  readonly target: string;
  readonly callbackRegions:
    readonly string[];
  readonly status:
    | "idempotent"
    | "contradicted"
    | "unresolved";
  readonly directOrdinalAmount: number;
  readonly idempotencyKind?:
    | "boolean-latch"
    | "state-latch";
  readonly reason: string;
}

export interface ProgressionStateMachineAssessment {
  readonly scriptId: string;
  readonly tableName: string;
  readonly stateType?: string;
  readonly status:
    | "complete"
    | "dead-end"
    | "unresolved";
  readonly activeStates:
    readonly string[];
  readonly terminalStates:
    readonly string[];
  readonly deadEndStates:
    readonly string[];
  readonly sourceEnteredDeadEndStates:
    readonly string[];
  readonly reason: string;
}

export interface ProgressionActorAccountingAnalysis {
  readonly counters:
    readonly ProgressionCounterAssessment[];
  readonly provenMissingReconciliation: number;
  readonly provenActorIdentityMismatch: number;
  readonly provenSpawnQuantityMismatch: number;
  readonly scriptedRemovalCoverageGaps: number;
  readonly terminalOnlyScriptedRemovalCounters: number;
  readonly nonTerminalScriptedRemovalCounters: number;
  readonly provenImmediateDespawnWithoutReconciliation: number;
  readonly conditionalDespawnUnknowns: number;
  readonly reachableConditionalDespawnCounters: number;
  readonly terminalOnlyConditionalDespawnCounters: number;
  readonly inactiveConditionalDespawnCounters: number;
  readonly provenActiveInstantDespawnWithoutReconciliation: number;
  readonly activeInterproceduralProofs: number;
  readonly activeTransitionProofs: number;
  readonly declaredActiveStateAliases: number;
  readonly stateTransitions:
    readonly ProgressionStateTransitionAssessment[];
  readonly validStateTransitions: number;
  readonly invalidStateTransitions: number;
  readonly unresolvedStateTransitions: number;
  readonly stateMachines:
    readonly ProgressionStateMachineAssessment[];
  readonly completeStateMachines: number;
  readonly deadEndStateMachines: number;
  readonly unresolvedStateMachines: number;
  readonly sourceEnteredDeadEndStates: number;
  readonly progressionAdvances:
    readonly ProgressionAdvanceOwnershipAssessment[];
  readonly duplicateProgressionAdvances: number;
  readonly crossIngressOrdinalAdvances:
    readonly ProgressionCrossIngressOrdinalAssessment[];
  readonly provenCrossIngressOrdinalAdvances: number;
  readonly crossIngressEffectCalls:
    readonly ProgressionCrossIngressEffectAssessment[];
  readonly idempotentCrossIngressEffectCalls: number;
  readonly provenCrossIngressEffectCalls: number;
  readonly unresolvedCrossIngressEffectCalls: number;
  readonly reconciledFromMatchedActorLifecycle: number;
  readonly deferredSpawnAccountingGaps: number;
  readonly registryAuthorityAssessments:
    readonly ProgressionActorRegistryAuthorityAssessment[];
  readonly generationBoundRegistryAuthorities: number;
  readonly unboundRegistryAuthorities: number;
  readonly unresolvedRegistryAuthorities: number;
  readonly unresolvedCounters: number;
}

export type ProgressionActorAccountingInput =
  | ParsedScriptFile
  | {
      readonly parsed: ParsedScriptFile;
      readonly text?: string;
    };

interface NormalizedScript {
  readonly parsed: ParsedScriptFile;
  readonly text: string;
}

interface CounterEvidenceRecord {
  readonly scriptPath: string;
  readonly scriptId: string;
  readonly counterId: string;
  readonly kind: ProgressionCounterKind;
  readonly operation:
    | "growth"
    | "decrement"
    | "replacement"
    | "completion-check";
  readonly executionRegion: string;
  readonly amount?: number;
  readonly executionShape:
    | "single"
    | "conditional"
    | "repeated"
    | "unknown";
  readonly sourceLine?: number;
}

interface SpawnEvidenceRecord {
  readonly scriptPath: string;
  readonly executionRegion: string;
  readonly actorIdentifier: string;
  readonly executionShape:
    | "single"
    | "conditional"
    | "repeated"
    | "unknown";
  readonly sourceLine?: number;
}

interface LifecycleActorGuard {
  readonly scriptPath: string;
  readonly executionRegion: string;
  readonly actorIdentifier: string;
  readonly subjectExpression?: string;
  readonly conditionSource?: SourceRef;
}

interface ScriptedRemovalEvidence {
  readonly scriptPath: string;
  readonly executionRegion: string;
  readonly actorIdentifier: string;
  readonly mechanism:
    | "entity-remove"
    | "entity-kill"
    | "command-kill";
}

interface EntityDespawnEvidence {
  readonly actorIdentifier: string;
  readonly kind:
    | "immediate"
    | "conditional";
  readonly basis: string;
}

const ACTOR_COUNTER_NAME =
  /(?:enemy|enemies|mob|mobs|remaining|alive)/i;

const SCOREBOARD_COUNTER_NAME =
  /(?:wave|enemy|enemies|mob|mobs|remaining|alive|objective|progress|count)/i;

function normalizedInput(
  input: ProgressionActorAccountingInput,
): NormalizedScript {
  return "parsed" in input
    ? {
        parsed: input.parsed,
        text: input.text ?? "",
      }
    : {
        parsed: input,
        text: "",
      };
}

function normalizeActorIdentifier(
  value: string,
): string {
  const trimmed = value.trim();
  const unquoted =
    (
      (
        trimmed.startsWith('"') &&
        trimmed.endsWith('"')
      ) ||
      (
        trimmed.startsWith("'") &&
        trimmed.endsWith("'")
      ) ||
      (
        trimmed.startsWith("`") &&
        trimmed.endsWith("`")
      )
    )
      ? trimmed.slice(1, -1)
      : trimmed;
  return unquoted.toLowerCase();
}

function scoreboardEvidence(
  script: NormalizedScript,
): CounterEvidenceRecord[] {
  const output: CounterEvidenceRecord[] = [];
  for (
    const command of
      script.parsed.commandLiterals
  ) {
    const text =
      command.command
        .trim()
        .replace(/^\//, "");
    const mutation =
      /^scoreboard\s+players\s+(add|remove|set)\s+\S+\s+([A-Za-z0-9_.:-]+)\s+(-?\d+)/i.exec(
        text,
      );
    if (mutation) {
      const action =
        mutation[1]!.toLowerCase();
      const counterId =
        mutation[2]!;
      if (
        SCOREBOARD_COUNTER_NAME.test(
          counterId,
        )
      ) {
        const value =
          Number(mutation[3]!);
        const operation =
          action === "set"
            ? "replacement" as const
            : (
                action === "remove" &&
                value > 0
              ) ||
              (
                action === "add" &&
                value < 0
              )
              ? "decrement" as const
              : action === "add" &&
                  value > 0
                ? "growth" as const
                : undefined;
        if (operation) {
          output.push({
            scriptPath:
              script.parsed.source.relativePath,
            scriptId:
              script.parsed.identifier,
            counterId,
            kind: "scoreboard",
            operation,
            executionRegion:
              command.executionRegion ??
              "module",
            ...((operation === "growth" || operation === "decrement") ? { amount: Math.abs(value) } : {}),
            executionShape: "unknown",
            ...(command.source.range?.lineStart === undefined ? {} : { sourceLine: command.source.range.lineStart }),
          });
        }
      }
    }

    const completion =
      /(?:if|unless)\s+score\s+\S+\s+([A-Za-z0-9_.:-]+)\s+matches\s+(?:\.\.)?0(?:\b|\.\.)[^\r\n]*\brun\s+([^\r\n]+)/i.exec(
        text,
      );
    if (
      completion &&
      SCOREBOARD_COUNTER_NAME.test(
        completion[1]!,
      ) &&
      /(?:next.*(?:wave|round|level|stage)|advance|progress|complete|finish|end(?:wave|round|level|stage)|proceed)/i.test(
        completion[2]!,
      )
    ) {
      output.push({
        scriptPath:
          script.parsed.source.relativePath,
        scriptId:
          script.parsed.identifier,
        counterId: completion[1]!,
        kind: "scoreboard",
        operation: "completion-check",
        executionRegion:
          command.executionRegion ??
          "module",
        executionShape: "unknown",
        ...(command.source.range?.lineStart === undefined ? {} : { sourceLine: command.source.range.lineStart }),
      });
    }
  }
  return output;
}

function variableEvidence(
  script: NormalizedScript,
): CounterEvidenceRecord[] {
  return (
    script.parsed
      .progressionCounterEvidence ?? []
  ).map((
    item:
      ScriptProgressionCounterEvidence,
  ) => ({
    scriptPath:
      script.parsed.source.relativePath,
    scriptId:
      script.parsed.identifier,
    counterId: item.counterId,
    kind: item.counterKind,
    operation: item.kind,
    executionRegion:
      item.executionRegion,
    ...(item.amount === undefined ? {} : { amount: item.amount }),
    executionShape:
      item.executionShape,
    ...(item.source.range?.lineStart === undefined ? {} : { sourceLine: item.source.range.lineStart }),
  }));
}

function localNode(
  path: string,
  region: string,
): string {
  return (
    "module:" +
    path +
    "#" +
    region
  );
}

function callGraph(
  scripts: readonly NormalizedScript[],
  crossFileCalls:
    readonly CrossFileCallEdge[],
): Map<string, Set<string>> {
  const graph =
    new Map<string, Set<string>>();
  const add = (
    from: string,
    to: string,
  ) => {
    const next =
      graph.get(from) ??
      new Set<string>();
    next.add(to);
    graph.set(from, next);
  };

  for (const script of scripts) {
    const path =
      script.parsed.source.relativePath;
    for (
      const call of
        script.parsed.localFunctionCalls
    ) {
      add(
        localNode(
          path,
          call.callerRegion,
        ),
        localNode(
          path,
          call.targetRegion,
        ),
      );
    }
  }

  for (const call of crossFileCalls) {
    if (
      call.status !== "resolved" ||
      call.targetModule === undefined
    ) {
      continue;
    }
    add(
      localNode(
        call.callerModule,
        call.callerRegion,
      ),
      localNode(
        call.targetModule,
        "function:" +
          call.targetExport,
      ),
    );
  }
  return graph;
}

function reachableFrom(
  roots: ReadonlySet<string>,
  graph:
    ReadonlyMap<
      string,
      ReadonlySet<string>
    >,
): Set<string> {
  const seen =
    new Set<string>(roots);
  const queue = [...roots];

  while (queue.length > 0) {
    const current =
      queue.shift()!;
    for (
      const next of
        graph.get(current) ?? []
    ) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return seen;
}

function reaches(
  from: string,
  to: string,
  graph:
    ReadonlyMap<
      string,
      ReadonlySet<string>
    >,
): boolean {
  return reachableFrom(
    new Set([from]),
    graph,
  ).has(to);
}

function lifecycleRootsByKind(
  scripts: readonly NormalizedScript[],
): {
  readonly death: Set<string>;
  readonly remove: Set<string>;
} {
  const death = new Set<string>();
  const remove = new Set<string>();

  for (const script of scripts) {
    const path =
      script.parsed.source.relativePath;
    for (
      const evidence of
        script.parsed
          .combatLifecycleEvidence ?? []
    ) {
      if (
        evidence.kind ===
        "death-subscription"
      ) {
        death.add(
          localNode(
            path,
            evidence.executionRegion,
          ),
        );
      }
    }
    for (
      const evidence of
        script.parsed
          .chunkLifecycleEvidence ?? []
    ) {
      if (
        evidence.kind ===
        "entity-remove-subscription"
      ) {
        remove.add(
          localNode(
            path,
            evidence.executionRegion,
          ),
        );
      }
    }
  }

  return { death, remove };
}

function spawnEvidence(
  scripts: readonly NormalizedScript[],
): SpawnEvidenceRecord[] {
  const output: SpawnEvidenceRecord[] = [];

  for (const script of scripts) {
    const path =
      script.parsed.source.relativePath;

    for (
      const spawn of
        script.parsed
          .progressionActorSpawnEvidence ??
        []
    ) {
      output.push({
        scriptPath: path,
        executionRegion:
          spawn.executionRegion,
        actorIdentifier:
          spawn.actorIdentifier,
        executionShape:
          spawn.executionShape,
        ...(spawn.source.range?.lineStart === undefined ? {} : { sourceLine: spawn.source.range.lineStart }),
      });
    }

    for (
      const command of
        script.parsed.commandLiterals
    ) {
      const match =
        /^\/?summon\s+([a-z0-9_.:-]+)/i.exec(
          command.command.trim(),
        );
      if (!match?.[1]) continue;
      output.push({
        scriptPath: path,
        executionRegion:
          command.executionRegion ??
          "module",
        actorIdentifier:
          normalizeActorIdentifier(
            match[1],
          ),
        executionShape: "unknown",
      });
    }
  }

  return output.filter(
    (item, index, all) =>
      all.findIndex((candidate) =>
        candidate.scriptPath ===
          item.scriptPath &&
        candidate.executionRegion ===
          item.executionRegion &&
        candidate.actorIdentifier ===
          item.actorIdentifier &&
        candidate.executionShape ===
          item.executionShape &&
        candidate.sourceLine ===
          item.sourceLine
      ) === index,
  );
}


interface DeferredSpawnAccountingAssessment {
  readonly actorIdentifiers: readonly string[];
  readonly callbacks: number;
  readonly reservationStatus:
    | "covered-before-defer"
    | "unresolved"
    | "none";
  readonly generationStatus:
    | "generation-guarded"
    | "unresolved"
    | "none";
  readonly quantityStatus:
    | "matched"
    | "mismatch"
    | "unresolved"
    | "none";
}

function deferredSpawnAccountingAssessment(
  scripts: readonly NormalizedScript[],
  growth: readonly CounterEvidenceRecord[],
  spawns: readonly SpawnEvidenceRecord[],
  graph: ReadonlyMap<
    string,
    ReadonlySet<string>
  >,
): DeferredSpawnAccountingAssessment {
  const relevant: {
    actorIdentifier: string;
    reservationCovered: boolean;
    generationGuarded: boolean;
    quantityStatus:
      | "matched"
      | "mismatch"
      | "unresolved";
  }[] = [];

  for (const script of scripts) {
    const path =
      script.parsed.source.relativePath;
    for (
      const deferred of
        script.parsed.deferredCallbacks
    ) {
      if (
        deferred.callbackRegion ===
        undefined
      ) {
        continue;
      }

      const callbackNode =
        localNode(
          path,
          deferred.callbackRegion,
        );
      const reachable =
        reachableFrom(
          new Set([callbackNode]),
          graph,
        );
      const schedulerLine =
        deferred.source.range?.lineStart;

      const preReservationItems =
        growth.filter((item) =>
          item.scriptPath === path &&
          item.executionRegion ===
            deferred.callerRegion &&
          item.sourceLine !== undefined &&
          schedulerLine !== undefined &&
          item.sourceLine < schedulerLine
        );
      const preReserved =
        preReservationItems.length > 0;
      const reachableSpawns =
        spawns.filter((spawn) =>
          reachable.has(
            localNode(
              spawn.scriptPath,
              spawn.executionRegion,
            ),
          )
        );
      const materializationGrowth =
        growth.some((item) =>
          reachable.has(
            localNode(
              item.scriptPath,
              item.executionRegion,
            ),
          )
        );

      if (
        !preReserved &&
        !materializationGrowth
      ) {
        continue;
      }

      const reservationAmounts =
        preReservationItems.map(
          (item) => item.amount,
        );
      const quantityStatus =
        !preReserved
          ? "unresolved" as const
          : reservationAmounts.some(
              (amount) =>
                amount === undefined,
            ) ||
            reachableSpawns.some(
              (spawn) =>
                spawn.executionShape !==
                "single",
            )
            ? "unresolved" as const
            : reservationAmounts.reduce<number>(
                 (sum, amount) =>
                  sum + (amount ?? 0),
                0,
              ) ===
              reachableSpawns.length
              ? "matched" as const
              : "mismatch" as const;

      for (const spawn of reachableSpawns) {
        relevant.push({
          actorIdentifier:
            spawn.actorIdentifier,
          reservationCovered:
            preReserved,
          generationGuarded:
            deferred.guardEvidence ===
            "explicit-generation-check",
          quantityStatus,
        });
      }
    }
  }

  if (relevant.length === 0) {
    return {
      actorIdentifiers: [],
      callbacks: 0,
      reservationStatus: "none",
      generationStatus: "none",
      quantityStatus: "none",
    };
  }

  return {
    actorIdentifiers: [
      ...new Set(
        relevant.map((item) =>
          item.actorIdentifier
        ),
      ),
    ].sort(),
    callbacks: relevant.length,
    reservationStatus:
      relevant.every((item) =>
        item.reservationCovered
      )
        ? "covered-before-defer"
        : "unresolved",
    generationStatus:
      relevant.every((item) =>
        item.generationGuarded
      )
        ? "generation-guarded"
        : "unresolved",
    quantityStatus:
      relevant.some((item) =>
        item.quantityStatus === "mismatch"
      )
        ? "mismatch"
        : relevant.every((item) =>
            item.quantityStatus === "matched"
          )
          ? "matched"
          : "unresolved",
  };
}

function lifecycleActorGuards(
  scripts: readonly NormalizedScript[],
): LifecycleActorGuard[] {
  return scripts.flatMap((script) =>
    (
      script.parsed.economyEvidence ?? []
    ).flatMap((item) =>
      item.kind ===
        "death-entity-type-guard" &&
      item.entityIdentifier !== undefined
        ? [{
            scriptPath:
              script.parsed.source.relativePath,
            executionRegion:
              item.executionRegion,
            actorIdentifier:
              normalizeActorIdentifier(
                item.entityIdentifier,
              ),
            ...(item.subjectExpression === undefined
              ? {} : { subjectExpression: item.subjectExpression }),
            conditionSource: item.source,
          }]
        : [],
    )
  );
}

function scriptedRemovalEvidence(
  scripts: readonly NormalizedScript[],
  guards: readonly LifecycleActorGuard[],
): ScriptedRemovalEvidence[] {
  const output:
    ScriptedRemovalEvidence[] = [];

  for (const script of scripts) {
    const path =
      script.parsed.source.relativePath;
    const regionGuards = new Map<
      string,
      string[]
    >();

    for (
      const guard of guards.filter(
        (item) =>
          item.scriptPath === path,
      )
    ) {
      regionGuards.set(
        guard.executionRegion,
        [
          ...(regionGuards.get(
            guard.executionRegion,
          ) ?? []),
          guard.actorIdentifier,
        ],
      );
    }

    for (
      const call of
        script.parsed.methodCalls
    ) {
      if (
        call.executionRegion ===
          undefined ||
        (
          call.method !== "remove" &&
          call.method !== "kill"
        ) ||
        (
          call.receiverType !== "Entity" &&
          call.receiverType !== "Player"
        )
      ) {
        continue;
      }

      const actorIds =
        regionGuards.get(
          call.executionRegion,
        ) ?? [];
      for (const actorIdentifier of actorIds) {
        output.push({
          scriptPath: path,
          executionRegion:
            call.executionRegion,
          actorIdentifier,
          mechanism:
            call.method === "remove"
              ? "entity-remove"
              : "entity-kill",
        });
      }
    }

    // Untyped entity.remove() remains a candidate only when an exact
    // actor-type condition guards the SAME receiver and source call site.
    // This does not establish live actor identity or execution.
    for (const call of script.parsed.unresolvedReceiverCalls ?? []) {
      if (call.method !== "remove" && call.method !== "kill") continue;
      for (const guard of guards) {
        if (guard.scriptPath !== path ||
            guard.executionRegion !== call.executionRegion ||
            guard.subjectExpression !== call.receiverExpression ||
            !guard.conditionSource) continue;
        const a = guard.conditionSource;
        const x = a.range;
        const matched = (call.lexicalGuards ?? []).some(branch => {
          const b = branch.source;
          const y = b.range;
          return branch.branch === "true" &&
            a.artifactId === b.artifactId &&
            a.relativePath === b.relativePath &&
            a.jsonPointer === b.jsonPointer &&
            x?.lineStart !== undefined &&
            x.columnStart !== undefined &&
            x.lineEnd !== undefined &&
            x.columnEnd !== undefined &&
            y?.lineStart === x.lineStart &&
            y.columnStart === x.columnStart &&
            y.lineEnd === x.lineEnd &&
            y.columnEnd === x.columnEnd;
        });
        if (!matched) continue;
        output.push({
          scriptPath: path,
          executionRegion: call.executionRegion,
          actorIdentifier: guard.actorIdentifier,
          mechanism: call.method === "remove"
            ? "entity-remove" : "entity-kill",
        });
      }
    }

    for (
      const command of
        script.parsed.commandLiterals
    ) {
      const normalized =
        command.command
          .trim()
          .replace(/^\//, "");
      const kill =
        /^kill\s+@e\[([^\]]+)\]/i.exec(
          normalized,
        );
      if (!kill?.[1]) continue;
      const typeMatch =
        /(?:^|,)\s*type\s*=\s*([^,!\s\]]+)/i.exec(
          kill[1],
        );
      if (
        !typeMatch?.[1] ||
        typeMatch[1].startsWith("!")
      ) {
        continue;
      }
      output.push({
        scriptPath: path,
        executionRegion:
          command.executionRegion ??
          "module",
        actorIdentifier:
          normalizeActorIdentifier(
            typeMatch[1],
          ),
        mechanism: "command-kill",
      });
    }
  }

  return output
    .filter((item, index, all) =>
      all.findIndex((candidate) =>
        candidate.scriptPath ===
          item.scriptPath &&
        candidate.executionRegion ===
          item.executionRegion &&
        candidate.actorIdentifier ===
          item.actorIdentifier &&
        candidate.mechanism ===
          item.mechanism
      ) === index
    )
    .sort((a, b) =>
      a.actorIdentifier.localeCompare(
        b.actorIdentifier,
      ) ||
      a.executionRegion.localeCompare(
        b.executionRegion,
      )
    );
}

function assessmentIncludesRegion(
  assessment:
    ArenaLifecycleTerminalAssessment,
  removal: ScriptedRemovalEvidence,
): boolean {
  const qualified =
    localNode(
      removal.scriptPath,
      removal.executionRegion,
    );
  return (
    assessment.terminalRegion ===
      removal.executionRegion ||
    assessment.terminalRegion ===
      qualified ||
    assessment.reachableRegions.includes(
      removal.executionRegion,
    ) ||
    assessment.reachableRegions.includes(
      qualified,
    )
  );
}

function terminalReachableRegions(
  lifecycle:
    ArenaLifecycleAnalysis | undefined,
): Set<string> {
  const output = new Set<string>();
  for (
    const assessment of
      lifecycle?.assessments ?? []
  ) {
    if (assessment.status !== "proven") {
      continue;
    }
    output.add(
      assessment.terminalRegion,
    );
    for (
      const region of
        assessment.reachableRegions
    ) {
      output.add(region);
    }
  }
  return output;
}

function incomingCallers(
  scripts: readonly NormalizedScript[],
  crossFileCalls:
    readonly CrossFileCallEdge[],
): Map<string, Set<string>> {
  const output =
    new Map<string, Set<string>>();
  const add = (
    target: string,
    caller: string,
  ) => {
    const values =
      output.get(target) ??
      new Set<string>();
    values.add(caller);
    output.set(target, values);
  };

  for (const script of scripts) {
    const path =
      script.parsed.source.relativePath;
    for (
      const call of
        script.parsed.localFunctionCalls
    ) {
      add(
        localNode(
          path,
          call.targetRegion,
        ),
        localNode(
          path,
          call.callerRegion,
        ),
      );
    }
  }

  for (const call of crossFileCalls) {
    if (
      call.status !== "resolved" ||
      call.targetModule === undefined
    ) {
      continue;
    }
    add(
      localNode(
        call.targetModule,
        "function:" +
          call.targetExport,
      ),
      localNode(
        call.callerModule,
        call.callerRegion,
      ),
    );
  }

  return output;
}

function scriptedRemovalScope(
  removal: ScriptedRemovalEvidence,
  lifecycle:
    ArenaLifecycleAnalysis | undefined,
  terminalRegions:
    ReadonlySet<string>,
  incoming:
    ReadonlyMap<
      string,
      ReadonlySet<string>
    >,
): "terminal-only" | "non-terminal" | "unresolved" {
  const node =
    localNode(
      removal.scriptPath,
      removal.executionRegion,
    );
  const provenAssessments =
    (lifecycle?.assessments ?? [])
      .filter((assessment) =>
        assessment.status === "proven"
      );
  const directTerminal =
    provenAssessments.some(
      (assessment) =>
        assessmentIncludesRegion(
          assessment,
          removal,
        ) &&
        (
          assessment.terminalRegion ===
            removal.executionRegion ||
          assessment.terminalRegion ===
            node
        ),
    );

  const callers =
    incoming.get(node) ??
    new Set<string>();
  const anyTerminalPath =
    provenAssessments.some(
      (assessment) =>
        assessmentIncludesRegion(
          assessment,
          removal,
        ),
    );

  if (
    directTerminal &&
    [...callers].every((caller) =>
      terminalRegions.has(caller)
    )
  ) {
    return "terminal-only";
  }

  if (
    anyTerminalPath &&
    callers.size > 0 &&
    [...callers].every((caller) =>
      terminalRegions.has(caller)
    )
  ) {
    return "terminal-only";
  }

  if (
    [...callers].some((caller) =>
      !terminalRegions.has(caller)
    )
  ) {
    return "non-terminal";
  }

  return "unresolved";
}

function directRemovalCanReachDecrement(
  removal: ScriptedRemovalEvidence,
  decrements:
    readonly CounterEvidenceRecord[],
  graph:
    ReadonlyMap<
      string,
      ReadonlySet<string>
    >,
): boolean {
  const from =
    localNode(
      removal.scriptPath,
      removal.executionRegion,
    );
  return decrements.some((item) => {
    const to =
      localNode(
        item.scriptPath,
        item.executionRegion,
      );
    return (
      from === to ||
      reaches(
        from,
        to,
        graph,
      )
    );
  });
}

function followEntityEvents(
  entity: ParsedEntityDefinition,
  roots: readonly string[],
): Set<string> {
  const defined =
    new Set(Object.keys(entity.events));
  const seen = new Set<string>();
  const queue =
    roots.filter((event) =>
      defined.has(event)
    );
  while (queue.length > 0) {
    const event = queue.shift()!;
    if (seen.has(event)) continue;
    seen.add(event);
    for (
      const next of
        entity.events[event]
          ?.triggerEvents ?? []
    ) {
      if (
        defined.has(next) &&
        !seen.has(next)
      ) {
        queue.push(next);
      }
    }
  }
  return seen;
}

function conditionalDespawnEventKinds(
  entity: ParsedEntityDefinition,
): Map<string, "instant" | "despawn" | "mixed"> {
  const groupKinds =
    new Map<
      string,
      "instant" | "despawn" | "mixed"
    >();

  for (
    const [groupId, components] of
      Object.entries(
        entity.componentGroups,
      )
  ) {
    const hasInstant =
      components.includes(
        "minecraft:instant_despawn",
      );
    const hasDespawn =
      components.includes(
        "minecraft:despawn",
      );
    if (!hasInstant && !hasDespawn) {
      continue;
    }
    groupKinds.set(
      groupId,
      hasInstant && hasDespawn
        ? "mixed"
        : hasInstant
          ? "instant"
          : "despawn",
    );
  }

  const output =
    new Map<
      string,
      "instant" | "despawn" | "mixed"
    >();
  for (
    const [eventId, mutation] of
      Object.entries(entity.events)
  ) {
    const kinds =
      mutation.addGroups
        .map((groupId) =>
          groupKinds.get(groupId)
        )
        .filter(
          (
            value,
          ): value is
            | "instant"
            | "despawn"
            | "mixed" =>
            value !== undefined,
        );
    if (kinds.length === 0) {
      continue;
    }
    const instant =
      kinds.some(
        (kind) =>
          kind === "instant" ||
          kind === "mixed",
      );
    const despawn =
      kinds.some(
        (kind) =>
          kind === "despawn" ||
          kind === "mixed",
      );
    output.set(
      eventId,
      instant && despawn
        ? "mixed"
        : instant
          ? "instant"
          : "despawn",
    );
  }
  return output;
}

function conditionalDespawnEvents(
  entity: ParsedEntityDefinition,
): string[] {
  const despawnGroups =
    new Set(
      Object.entries(
        entity.componentGroups,
      )
        .filter(([, components]) =>
          components.includes(
            "minecraft:despawn",
          ) ||
          components.includes(
            "minecraft:instant_despawn",
          )
        )
        .map(([groupId]) => groupId),
    );

  return Object.entries(entity.events)
    .filter(([, mutation]) =>
      mutation.addGroups.some(
        (groupId) =>
          despawnGroups.has(groupId),
      )
    )
    .map(([eventId]) => eventId)
    .sort();
}

function eventEvidenceMatchesEntity(
  evidence:
    EntityEventExternalEvidence,
  actorIdentifier: string,
): boolean {
  return (
    evidence.entityIdentifier !== undefined &&
    normalizeActorIdentifier(
      evidence.entityIdentifier,
    ) === actorIdentifier
  );
}

function lifecycleScopeForRegion(
  path: string,
  region: string | undefined,
  lifecycle:
    ArenaLifecycleAnalysis | undefined,
  terminalRegions:
    ReadonlySet<string>,
  incoming:
    ReadonlyMap<
      string,
      ReadonlySet<string>
    >,
): "terminal-only" | "non-terminal" | "unresolved" {
  if (!region) return "unresolved";
  const synthetic: ScriptedRemovalEvidence = {
    scriptPath: path,
    executionRegion: region,
    actorIdentifier: "*",
    mechanism: "entity-remove",
  };
  return scriptedRemovalScope(
    synthetic,
    lifecycle,
    terminalRegions,
    incoming,
  );
}

function activeReachableRegions(
  scripts: readonly NormalizedScript[],
  crossFileCalls:
    readonly CrossFileCallEdge[],
  activeCalls:
    readonly ScriptProgressionActiveCallEvidence[],
  graph:
    ReadonlyMap<
      string,
      ReadonlySet<string>
    >,
): Set<string> {
  const roots = new Set<string>();

  for (const active of activeCalls) {
    const path =
      active.source.relativePath;
    const script =
      scripts.find(
        (item) =>
          item.parsed.source.relativePath ===
          path,
      );

    const localTargets =
      script?.parsed.localFunctionCalls
        .filter((call) =>
          call.callerRegion ===
            active.callerRegion &&
          call.targetName ===
            active.targetName,
        ) ?? [];
    for (const call of localTargets) {
      roots.add(
        localNode(
          path,
          call.targetRegion,
        ),
      );
    }

    for (const call of crossFileCalls) {
      if (
        call.status !== "resolved" ||
        call.targetModule === undefined ||
        call.callerModule !== path ||
        call.callerRegion !==
          active.callerRegion ||
        call.localName !==
          active.targetName
      ) {
        continue;
      }
      roots.add(
        localNode(
          call.targetModule,
          "function:" +
            call.targetExport,
        ),
      );
    }
  }

  return reachableFrom(
    roots,
    graph,
  );
}

function conditionalDespawnReachabilityForActor(
  actorIdentifier: string,
  entities:
    readonly ParsedEntityDefinition[],
  externalEvidence:
    readonly EntityEventExternalEvidence[],
  lifecycle:
    ArenaLifecycleAnalysis | undefined,
  terminalRegions:
    ReadonlySet<string>,
  incoming:
    ReadonlyMap<
      string,
      ReadonlySet<string>
    >,
): {
  readonly status:
    | "reachable"
    | "terminal-only"
    | "inactive"
    | "unresolved";
  readonly activationEvents:
    readonly string[];
} {
  const entity =
    entities.find(
      (item) =>
        item.identifier !== undefined &&
        normalizeActorIdentifier(
          item.identifier,
        ) === actorIdentifier,
    );
  if (!entity) {
    return {
      status: "unresolved",
      activationEvents: [],
    };
  }

  const activationEvents =
    conditionalDespawnEvents(entity);
  if (activationEvents.length === 0) {
    return {
      status: "inactive",
      activationEvents: [],
    };
  }

  const internal =
    analyzeEntityTransitionReachability(
      entity,
    );
  const internallyReachable =
    new Set([
      ...internal.reachableEvents,
      ...internal.externallyReachableEvents,
    ]);
  if (
    activationEvents.some((event) =>
      internallyReachable.has(event)
    )
  ) {
    return {
      status: "reachable",
      activationEvents,
    };
  }

  const exactEvidence =
    externalEvidence.filter(
      (item) =>
        eventEvidenceMatchesEntity(
          item,
          actorIdentifier,
        ) &&
        Object.hasOwn(
          entity.events,
          item.event,
        ),
    );
  const exactReachable =
    followEntityEvents(
      entity,
      exactEvidence.map(
        (item) => item.event,
      ),
    );
  const reachesDespawn =
    activationEvents.some((event) =>
      exactReachable.has(event)
    );

  if (reachesDespawn) {
    const relevantEvidence =
      exactEvidence.filter(
        (item) => {
          const reachable =
            followEntityEvents(
              entity,
              [item.event],
            );
          return activationEvents.some(
            (event) =>
              reachable.has(event),
          );
        },
      );
    const scopes =
      relevantEvidence.map((item) =>
        lifecycleScopeForRegion(
          item.source.relativePath,
          item.executionRegion,
          lifecycle,
          terminalRegions,
          incoming,
        )
      );
    if (
      scopes.length > 0 &&
      scopes.every(
        (scope) =>
          scope === "terminal-only",
      )
    ) {
      return {
        status: "terminal-only",
        activationEvents,
      };
    }
    if (
      scopes.some(
        (scope) =>
          scope === "non-terminal",
      )
    ) {
      return {
        status: "reachable",
        activationEvents,
      };
    }
    return {
      status: "unresolved",
      activationEvents,
    };
  }

  const broadEvidence =
    externalEvidence.filter(
      (item) =>
        item.entityIdentifier ===
          undefined &&
        Object.hasOwn(
          entity.events,
          item.event,
        ),
    );
  const broadReachable =
    followEntityEvents(
      entity,
      broadEvidence.map(
        (item) => item.event,
      ),
    );
  if (
    activationEvents.some((event) =>
      broadReachable.has(event)
    )
  ) {
    return {
      status: "unresolved",
      activationEvents,
    };
  }

  if (entity.runtimeIdentifier) {
    return {
      status: "unresolved",
      activationEvents,
    };
  }

  return {
    status: "inactive",
    activationEvents,
  };
}

function entityDespawnEvidence(
  entities:
    readonly ParsedEntityDefinition[],
): EntityDespawnEvidence[] {
  const output:
    EntityDespawnEvidence[] = [];

  for (const entity of entities) {
    if (!entity.identifier) continue;
    const actorIdentifier =
      normalizeActorIdentifier(
        entity.identifier,
      );

    if (
      entity.baseComponents.includes(
        "minecraft:instant_despawn",
      )
    ) {
      output.push({
        actorIdentifier,
        kind: "immediate",
        basis:
          "base:minecraft:instant_despawn",
      });
    } else if (
      entity.baseComponents.includes(
        "minecraft:despawn",
      )
    ) {
      output.push({
        actorIdentifier,
        kind: "conditional",
        basis:
          "base:minecraft:despawn",
      });
    }

    for (
      const [
        groupId,
        components,
      ] of Object.entries(
        entity.componentGroups,
      )
    ) {
      if (
        components.includes(
          "minecraft:instant_despawn",
        )
      ) {
        output.push({
          actorIdentifier,
          kind: "conditional",
          basis:
            "group:" +
            groupId +
            ":minecraft:instant_despawn",
        });
      } else if (
        components.includes(
          "minecraft:despawn",
        )
      ) {
        output.push({
          actorIdentifier,
          kind: "conditional",
          basis:
            "group:" +
            groupId +
            ":minecraft:despawn",
        });
      }
    }
  }

  return output.filter(
    (item, index, all) =>
      all.findIndex((candidate) =>
        candidate.actorIdentifier ===
          item.actorIdentifier &&
        candidate.kind === item.kind &&
        candidate.basis === item.basis
      ) === index,
  );
}

function actorIdsForGrowth(
  item: CounterEvidenceRecord,
  spawns: readonly SpawnEvidenceRecord[],
  graph:
    ReadonlyMap<
      string,
      ReadonlySet<string>
    >,
): string[] {
  if (item.operation !== "growth") {
    return [];
  }
  const growthNode =
    localNode(
      item.scriptPath,
      item.executionRegion,
    );
  return [
    ...new Set(
      spawns.flatMap((spawn) => {
        const spawnNode =
          localNode(
            spawn.scriptPath,
            spawn.executionRegion,
          );
        return (
          growthNode === spawnNode ||
          reaches(
            growthNode,
            spawnNode,
            graph,
          ) ||
          reaches(
            spawnNode,
            growthNode,
            graph,
          )
        )
          ? [spawn.actorIdentifier]
          : [];
      }),
    ),
  ].sort();
}

function actorIdsForDecrement(
  item: CounterEvidenceRecord,
  guards: readonly LifecycleActorGuard[],
  lifecycleReachable:
    ReadonlySet<string>,
  graph:
    ReadonlyMap<
      string,
      ReadonlySet<string>
    >,
): string[] {
  if (item.operation !== "decrement") {
    return [];
  }
  const decrementNode =
    localNode(
      item.scriptPath,
      item.executionRegion,
    );
  if (
    !lifecycleReachable.has(
      decrementNode,
    )
  ) {
    return [];
  }

  return [
    ...new Set(
      guards.flatMap((guard) => {
        const guardNode =
          localNode(
            guard.scriptPath,
            guard.executionRegion,
          );
        return (
          lifecycleReachable.has(
            guardNode,
          ) &&
          (
            guardNode === decrementNode ||
            reaches(
              guardNode,
              decrementNode,
              graph,
            )
          )
        )
          ? [guard.actorIdentifier]
          : [];
      }),
    ),
  ].sort();
}

function quantityForGrowth(
  item: CounterEvidenceRecord,
  spawns: readonly SpawnEvidenceRecord[],
): {
  readonly status:
    | "matched"
    | "mismatch"
    | "unresolved";
  readonly spawnCount?: number;
  readonly counterAmount?: number;
} {
  if (
    item.operation !== "growth" ||
    item.kind !== "variable" ||
    item.executionShape !== "single" ||
    item.amount === undefined ||
    !Number.isInteger(item.amount) ||
    item.amount <= 0
  ) {
    return { status: "unresolved" };
  }

  const directSpawns =
    spawns.filter((spawn) =>
      spawn.scriptPath ===
        item.scriptPath &&
      spawn.executionRegion ===
        item.executionRegion,
    );

  if (
    directSpawns.length === 0 ||
    directSpawns.some(
      (spawn) =>
        spawn.executionShape !==
        "single",
    )
  ) {
    return { status: "unresolved" };
  }

  const actorIds =
    new Set(
      directSpawns.map(
        (spawn) =>
          spawn.actorIdentifier,
      ),
    );
  if (actorIds.size !== 1) {
    return { status: "unresolved" };
  }

  const spawnCount =
    directSpawns.length;
  return {
    status:
      spawnCount === item.amount
        ? "matched"
        : "mismatch",
    spawnCount,
    counterAmount:
      item.amount,
  };
}

function counterKey(
  item: CounterEvidenceRecord,
): string {
  return (
    item.kind +
    ":" +
    item.counterId
  );
}

function normalizedStateOwner(
  value: string,
): string {
  return value
    .replace(/[^A-Za-z0-9]/g, "")
    .replace(
      /(?:state|status|phase|stage|mode|transitions?)$/i,
      "",
    )
    .toLowerCase();
}

function stateTransitionAssessments(
  scripts: readonly NormalizedScript[],
  actual:
    readonly ScriptProgressionStateTransitionEvidence[],
): ProgressionStateTransitionAssessment[] {
  return actual
    .map((transition) => {
      const script =
        scripts.find(
          (item) =>
            item.parsed.source.relativePath ===
              transition.source.relativePath,
        );
      const declarations =
        script?.parsed
          .transitionDeclarations ?? [];

      const targetOwner =
        normalizedStateOwner(
          transition.target,
        );
      const candidates =
        declarations
          .filter((item) =>
            item.from ===
              transition.from
          )
          .filter((item) => {
            const tableOwner =
              normalizedStateOwner(
                item.tableName,
              );
            const typeOwner =
              item.stateType === undefined
                ? ""
                : normalizedStateOwner(
                    item.stateType,
                  );
            return (
              targetOwner.length > 0 &&
              (
                tableOwner ===
                  targetOwner ||
                typeOwner ===
                  targetOwner ||
                tableOwner.startsWith(
                  targetOwner,
                ) ||
                targetOwner.startsWith(
                  tableOwner,
                )
              )
            );
          });

      const tableNames =
        [...new Set(
          candidates.map(
            (item) =>
              item.tableName,
          ),
        )];

      if (
        candidates.length === 0 ||
        tableNames.length !== 1
      ) {
        return {
          scriptId:
            script?.parsed.identifier ??
            transition.source.relativePath,
          target: transition.target,
          from: transition.from,
          to: transition.to,
          status: "unresolved" as const,
          allowedTargets: [],
          reason:
            candidates.length === 0
              ? "No uniquely correlated authored transition table owns this guarded state mutation."
              : "Multiple authored transition tables plausibly own this guarded state mutation.",
        };
      }

      const allowedTargets =
        [...new Set(
          candidates.flatMap(
            (item) => item.to,
          ),
        )].sort();
      const tableName =
        tableNames[0]!;
      const valid =
        allowedTargets.includes(
          transition.to,
        );

      return {
        scriptId:
          script?.parsed.identifier ??
          transition.source.relativePath,
        target: transition.target,
        from: transition.from,
        to: transition.to,
        tableName,
        status:
          valid
            ? "valid" as const
            : "invalid" as const,
        allowedTargets,
        reason:
          valid
            ? "The guarded source transition is allowed by its uniquely correlated authored transition table."
            : "The guarded source transition skips or violates the uniquely correlated authored transition table.",
      };
    })
    .sort((a, b) =>
      a.scriptId.localeCompare(
        b.scriptId,
      ) ||
      a.target.localeCompare(
        b.target,
      ) ||
      a.from.localeCompare(b.from) ||
      a.to.localeCompare(b.to)
    );
}

/**
 * Both progression causal analyses use the same exact event subscriptions.
 * One named callback can serve multiple events; do not overwrite earlier
 * subscriptions or promote unknown/shadowed event roots into gameplay proof.
 */
function eventIngressByCaller(
  scripts: readonly NormalizedScript[],
): ReadonlyMap<string, readonly string[]> {
  const registrations = new Map<string, Set<string>>();
  for (const script of scripts) {
    const path = script.parsed.source.relativePath;
    for (const subscription of script.parsed.events) {
      if (
        subscription.callbackRegion === undefined ||
        subscription.root === "unknown" ||
        subscription.phase === "unknown"
      ) continue;
      const caller = localNode(path, subscription.callbackRegion);
      const ingress =
        subscription.root + "." + subscription.phase + "." + subscription.event;
      const ingresses = registrations.get(caller) ?? new Set<string>();
      ingresses.add(ingress);
      registrations.set(caller, ingresses);
    }
  }
  return new Map([...registrations].map(([caller, ingresses]) => [
    caller, [...ingresses].sort(),
  ]));
}

function progressionCrossIngressOrdinalAdvances(
  scripts: readonly NormalizedScript[],
  evidence:
    readonly ScriptProgressionOrdinalAdvanceEvidence[],
  ingressByCaller: ReadonlyMap<string, readonly string[]>,
): ProgressionCrossIngressOrdinalAssessment[] {
  const output:
    ProgressionCrossIngressOrdinalAssessment[] = [];

  for (const script of scripts) {
    const path =
      script.parsed.source.relativePath;
    const groups =
      new Map<
        string,
        {
          ingress: string;
          target: string;
          items:
            ScriptProgressionOrdinalAdvanceEvidence[];
        }
      >();

    for (
      const item of evidence.filter(
        (candidate) =>
          candidate.source.relativePath ===
            path &&
          candidate.executionShape ===
            "single",
      )
    ) {
      for (const ingress of (
        ingressByCaller.get(localNode(path, item.executionRegion)) ?? []
      )) {
        const key =
          ingress +
          "\0" +
          item.target;
        const group =
          groups.get(key) ?? {
            ingress,
            target: item.target,
            items: [],
          };
        group.items.push(item);
        groups.set(key, group);
      }
    }

    for (const group of groups.values()) {
      const callbackRegions =
        [...new Set(
          group.items.map(
            (item) =>
              item.executionRegion,
          ),
        )].sort();
      if (callbackRegions.length < 2) {
        continue;
      }
      output.push({
        scriptId:
          script.parsed.identifier,
        ingress: group.ingress,
        target: group.target,
        callbackRegions,
        totalAmount:
          group.items.reduce(
            (sum, item) =>
              sum + item.amount,
            0,
          ),
        reason:
          "One exact event ingress has multiple distinct unconditional callbacks that directly advance the same progression ordinal.",
      });
    }
  }

  return output.sort((a, b) =>
    a.scriptId.localeCompare(
      b.scriptId,
    ) ||
    a.ingress.localeCompare(
      b.ingress,
    ) ||
    a.target.localeCompare(
      b.target,
    )
  );
}

const PROGRESSION_EFFECT_TARGET =
  /(?:next.*(?:wave|round|level|stage)|advance|progress|complete|finish|end(?:wave|round|level|stage)|proceed)/i;

function progressionCrossIngressEffects(
  scripts: readonly NormalizedScript[],
  crossFileCalls:
    readonly CrossFileCallEdge[],
  ordinalEvidence:
    readonly ScriptProgressionOrdinalAdvanceEvidence[],
  idempotencyEvidence:
    readonly ScriptProgressionIdempotencyEvidence[],
  ingressByCaller: ReadonlyMap<string, readonly string[]>,
): ProgressionCrossIngressEffectAssessment[] {
  const groups =
    new Map<
      string,
      {
        ingress: string;
        target: string;
        callers: Set<string>;
      }
    >();

  const add = (
    callerPath: string,
    callerRegion: string,
    targetPath: string,
    targetRegion: string,
    targetName: string,
  ) => {
    if (
      !PROGRESSION_EFFECT_TARGET.test(
        targetName,
      )
    ) {
      return;
    }

    const caller =
      localNode(
        callerPath,
        callerRegion,
      );
    const target = localNode(targetPath, targetRegion);
    for (const ingress of ingressByCaller.get(caller) ?? []) {
      const key =
        ingress +
        "\0" +
        target;
      const group =
        groups.get(key) ?? {
          ingress,
          target,
          callers: new Set<string>(),
        };
      group.callers.add(caller);
      groups.set(key, group);
    }
  };

  for (const script of scripts) {
    const path =
      script.parsed.source.relativePath;
    for (
      const call of
        script.parsed.localFunctionCalls
    ) {
      if (
        call.controlFlow !==
          "unconditional"
      ) {
        continue;
      }
      add(
        path,
        call.callerRegion,
        path,
        call.targetRegion,
        call.targetName,
      );
    }
  }

  for (const call of crossFileCalls) {
    if (
      call.status !== "resolved" ||
      call.targetModule === undefined ||
      call.controlFlow !==
        "unconditional"
    ) {
      continue;
    }
    add(
      call.callerModule,
      call.callerRegion,
      call.targetModule,
      "function:" +
        call.targetExport,
      call.targetExport,
    );
  }

  const idempotencyByTarget =
    new Map(
      idempotencyEvidence.map(
        (item) => [
          localNode(
            item.source.relativePath,
            item.functionRegion,
          ),
          item,
        ],
      ),
    );

  const ordinalByTarget =
    new Map<string, number>();
  for (
    const item of
      ordinalEvidence.filter(
        (candidate) =>
          candidate.executionShape ===
            "single",
      )
  ) {
    const key =
      localNode(
        item.source.relativePath,
        item.executionRegion,
      );
    ordinalByTarget.set(
      key,
      (
        ordinalByTarget.get(key) ??
        0
      ) + item.amount,
    );
  }

  return [...groups.values()]
    .flatMap((group) => {
      const callbackRegions =
        [...group.callers].sort();
      if (
        callbackRegions.length < 2
      ) {
        return [];
      }

      const idempotency =
        idempotencyByTarget.get(
          group.target,
        );
      const directOrdinalAmount =
        ordinalByTarget.get(
          group.target,
        ) ?? 0;

      return [{
        scriptId:
          group.target,
        ingress: group.ingress,
        target: group.target,
        callbackRegions,
        status:
          idempotency !== undefined
            ? "idempotent" as const
            : directOrdinalAmount > 0
              ? "contradicted" as const
              : "unresolved" as const,
        directOrdinalAmount,
        ...(idempotency === undefined
          ? {}
          : {
              idempotencyKind:
                idempotency.kind,
            }),
        reason:
          idempotency !== undefined
            ? "The same exact event ingress reaches this progression effect through multiple callbacks, but the target has a source-proven one-shot latch before its progression work."
            : directOrdinalAmount > 0
              ? "The same exact event ingress reaches the same progression effect through multiple unconditional callbacks, and the target directly advances a progression ordinal without a source-proven one-shot latch."
              : "Duplicate invocation of the progression-looking effect is source-proven, but the target effect has neither direct ordinal mutation proof nor source-proven idempotency.",
      }];
    })
    .sort((a, b) =>
      a.ingress.localeCompare(
        b.ingress,
      ) ||
      a.target.localeCompare(
        b.target,
      )
    );
}

function progressionAdvanceOwnership(
  scripts: readonly NormalizedScript[],
  evidence:
    readonly ScriptProgressionAdvanceEvidence[],
): ProgressionAdvanceOwnershipAssessment[] {
  const grouped =
    new Map<
      string,
      ScriptProgressionAdvanceEvidence[]
    >();

  for (const item of evidence) {
    const key = [
      item.source.relativePath,
      item.executionRegion,
      item.counterId,
      item.effectTarget,
    ].join("\0");
    grouped.set(
      key,
      [
        ...(grouped.get(key) ?? []),
        item,
      ],
    );
  }

  return [...grouped.values()]
    .map((items) => {
      const first = items[0]!;
      const script =
        scripts.find(
          (item) =>
            item.parsed.source.relativePath ===
              first.source.relativePath,
        );
      const duplicate =
        items.length > 1;
      return {
        scriptId:
          script?.parsed.identifier ??
          first.source.relativePath,
        executionRegion:
          first.executionRegion,
        counterId:
          first.counterId,
        effectTarget:
          first.effectTarget,
        calls: items.length,
        status:
          duplicate
            ? "duplicate" as const
            : "single" as const,
        reason:
          duplicate
            ? "The same progression effect is invoked more than once from the same completion gate region for the same counter."
            : "The completion gate owns one direct invocation of this progression effect.",
      };
    })
    .sort((a, b) =>
      a.scriptId.localeCompare(
        b.scriptId,
      ) ||
      a.executionRegion.localeCompare(
        b.executionRegion,
      ) ||
      a.counterId.localeCompare(
        b.counterId,
      ) ||
      a.effectTarget.localeCompare(
        b.effectTarget,
      )
    );
}

const TERMINAL_GAMEPLAY_STATE =
  /^(?:complete|completed|finish|finished|done|victory|defeat|ended|end|success|successful|failure|failed|win|won|loss|lost|abort|aborted)$/i;

// Result/terminal tables are progression lifecycles too: the evaluator below
// already enforces their ordered result -> reward -> cleanup contract.
const PROGRESSION_MACHINE_OWNER =
  /(?:wave|round|level|stage|phase|game|match|progress|combat|result|terminal)/i;

const RESULT_LIFECYCLE_PHASES = [
  "active",
  "terminalcandidate",
  "resolving",
  "resultcommitted",
  "rewarding",
  "cleanup",
  "complete",
] as const;

function normalizedLifecycleState(
  value: string,
): string {
  return value
    .replace(/[^A-Za-z0-9]/g, "")
    .toLowerCase();
}

function stateCanReachTerminal(
  start: string,
  outgoing:
    ReadonlyMap<
      string,
      ReadonlySet<string>
    >,
  terminals:
    ReadonlySet<string>,
): boolean {
  const seen =
    new Set<string>([start]);
  const queue = [start];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (terminals.has(current)) {
      return true;
    }
    for (
      const next of
        outgoing.get(current) ?? []
    ) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }

  return false;
}

function stateMachineAssessments(
  scripts: readonly NormalizedScript[],
  actual:
    readonly ProgressionStateTransitionAssessment[],
): ProgressionStateMachineAssessment[] {
  const output:
    ProgressionStateMachineAssessment[] = [];

  for (const script of scripts) {
    const declarations =
      script.parsed
        .transitionDeclarations ?? [];
    const byTable =
      new Map<
        string,
        typeof declarations
      >();

    for (const declaration of declarations) {
      const list =
        byTable.get(
          declaration.tableName,
        ) ?? [];
      byTable.set(
        declaration.tableName,
        [...list, declaration],
      );
    }

    for (
      const [tableName, table] of
        byTable
    ) {
      const stateType =
        table.find(
          (item) =>
            item.stateType !== undefined,
        )?.stateType;
      const material =
        PROGRESSION_MACHINE_OWNER.test(
          tableName,
        ) ||
        (
          stateType !== undefined &&
          PROGRESSION_MACHINE_OWNER.test(
            stateType,
          )
        );
      if (!material) continue;

      const states =
        new Set<string>();
      const outgoing =
        new Map<
          string,
          Set<string>
        >();

      for (const item of table) {
        states.add(item.from);
        const next =
          outgoing.get(item.from) ??
          new Set<string>();
        for (const target of item.to) {
          states.add(target);
          next.add(target);
        }
        outgoing.set(
          item.from,
          next,
        );
      }

      const activeStates =
        deriveProgressionActiveStateValues(
          table,
        );
      const terminalStates =
        [...states]
          .filter((state) =>
            TERMINAL_GAMEPLAY_STATE.test(
              state,
            )
          )
          .sort();

      const normalizedStates =
        new Set(
          [...states].map(
            normalizedLifecycleState,
          ),
        );
      const resultLifecycle =
        /(?:result|terminal)/i.test(
          tableName,
        ) ||
        (
          stateType !== undefined &&
          /(?:result|terminal)/i.test(
            stateType,
          )
        ) ||
        [
          "terminalcandidate",
          "resolving",
          "resultcommitted",
          "rewarding",
          "cleanup",
        ].some((state) =>
          normalizedStates.has(state)
        );

      if (resultLifecycle) {
        const normalizedOutgoing =
          new Map<string, Set<string>>();
        for (
          const [from, targets] of
            outgoing
        ) {
          normalizedOutgoing.set(
            normalizedLifecycleState(
              from,
            ),
            new Set(
              [...targets].map(
                normalizedLifecycleState,
              ),
            ),
          );
        }

        const missingPhases =
          RESULT_LIFECYCLE_PHASES
            .filter(
              (phase) =>
                !normalizedStates.has(
                  phase,
                ),
            );
        const orderingViolations:
          string[] = [];

        for (
          let index = 0;
          index <
            RESULT_LIFECYCLE_PHASES.length -
              1;
          index += 1
        ) {
          const from =
            RESULT_LIFECYCLE_PHASES[
              index
            ]!;
          const to =
            RESULT_LIFECYCLE_PHASES[
              index + 1
            ]!;
          if (
            !normalizedStates.has(from) ||
            !normalizedStates.has(to)
          ) {
            continue;
          }
          if (
            !stateCanReachTerminal(
              from,
              normalizedOutgoing,
              new Set([to]),
            )
          ) {
            orderingViolations.push(
              from + " !-> " + to,
            );
          }
        }

        if (
          missingPhases.length > 0 ||
          orderingViolations.length > 0
        ) {
          output.push({
            scriptId:
              script.parsed.identifier,
            tableName,
            ...(stateType === undefined
              ? {}
              : { stateType }),
            status: "unresolved",
            activeStates,
            terminalStates,
            deadEndStates: [],
            sourceEnteredDeadEndStates: [],
            reason:
              "Authored result lifecycle does not close the required ACTIVE -> TERMINAL_CANDIDATE -> RESOLVING -> RESULT_COMMITTED -> REWARDING -> CLEANUP -> COMPLETE contract. Missing=[" +
              missingPhases.join(",") +
              "] ordering=[" +
              orderingViolations.join(",") +
              "].",
          });
          continue;
        }
      }

      if (
        activeStates.length === 0 ||
        terminalStates.length === 0
      ) {
        output.push({
          scriptId:
            script.parsed.identifier,
          tableName,
          ...(stateType === undefined
            ? {}
            : { stateType }),
          status: "unresolved",
          activeStates,
          terminalStates,
          deadEndStates: [],
          sourceEnteredDeadEndStates: [],
          reason:
            activeStates.length === 0
              ? "The authored progression-like transition table has no explicit active anchor from which completion reachability can be proven."
              : "The authored progression-like transition table has no recognizable terminal/completion state, so absence of a legal completion path cannot be proven safely.",
        });
        continue;
      }

      const terminals =
        new Set(terminalStates);
      const deadEndStates =
        activeStates
          .filter((state) =>
            !stateCanReachTerminal(
              state,
              outgoing,
              terminals,
            )
          )
          .sort();
      const deadEndSet =
        new Set(deadEndStates);
      const sourceEnteredDeadEndStates =
        actual
          .filter((item) =>
            item.scriptId ===
              script.parsed.identifier &&
            item.tableName ===
              tableName &&
            item.status === "valid" &&
            deadEndSet.has(item.to)
          )
          .map((item) => item.to)
          .filter((state, index, all) =>
            all.indexOf(state) === index
          )
          .sort();

      output.push({
        scriptId:
          script.parsed.identifier,
        tableName,
        ...(stateType === undefined
          ? {}
          : { stateType }),
        status:
          deadEndStates.length > 0
            ? "dead-end"
            : "complete",
        activeStates,
        terminalStates,
        deadEndStates,
        sourceEnteredDeadEndStates,
        reason:
          deadEndStates.length > 0
            ? "Active-reachable authored state(s) have no legal path to any recognized terminal/completion state in this transition table."
            : "Every active-reachable authored state has at least one legal path to a recognized terminal/completion state.",
      });
    }
  }

  return output.sort((a, b) =>
    a.scriptId.localeCompare(
      b.scriptId,
    ) ||
    a.tableName.localeCompare(
      b.tableName,
    )
  );
}


function progressionActorRegistryAuthorityAssessments(
  scripts: readonly NormalizedScript[],
  lifecycleReachable:
    ReadonlySet<string>,
): ProgressionActorRegistryAuthorityAssessment[] {
  const groups =
    new Map<
      string,
      {
        scriptIds: Set<string>;
        registryExpression: string;
        actorIdentifiers: Set<string>;
        materializePaths: number;
        lifecycleReleasePaths: number;
        completionChecks: number;
        generationBound: boolean;
      }
    >();

  for (const script of scripts) {
    const path =
      script.parsed.source.relativePath;
    for (
      const evidence of
        script.parsed
          .progressionActorRegistryEvidence ??
        []
    ) {
      const key =
        evidence.registryExpression;
      const current =
        groups.get(key) ?? {
          scriptIds: new Set<string>(),
          registryExpression: key,
          actorIdentifiers:
            new Set<string>(),
          materializePaths: 0,
          lifecycleReleasePaths: 0,
          completionChecks: 0,
          generationBound: true,
        };
      current.scriptIds.add(
        script.parsed.identifier,
      );
      if (
        evidence.actorIdentifier !==
        undefined
      ) {
        current.actorIdentifiers.add(
          evidence.actorIdentifier,
        );
      }
      if (
        evidence.action ===
        "materialize"
      ) {
        current.materializePaths += 1;
      } else if (
        evidence.action === "release"
      ) {
        if (
          lifecycleReachable.has(
            localNode(
              path,
              evidence.executionRegion,
            ),
          )
        ) {
          current.lifecycleReleasePaths += 1;
        }
      } else {
        current.completionChecks += 1;
      }
      current.generationBound =
        current.generationBound &&
        evidence.generationBound;
      groups.set(key, current);
    }
  }

  return [...groups.values()]
    .map((item) => {
      const complete =
        item.materializePaths > 0 &&
        item.lifecycleReleasePaths > 0 &&
        item.completionChecks > 0 &&
        item.actorIdentifiers.size > 0;
      return {
        scriptId:
          [...item.scriptIds]
            .sort()
            .join(","),
        registryExpression:
          item.registryExpression,
        actorIdentifiers:
          [...item.actorIdentifiers].sort(),
        materializePaths:
          item.materializePaths,
        lifecycleReleasePaths:
          item.lifecycleReleasePaths,
        completionChecks:
          item.completionChecks,
        generationBound:
          item.generationBound,
        status:
          !complete
            ? "incomplete" as const
            : item.generationBound
              ? "generation-bound-authoritative" as const
              : "generation-unbound" as const,
        reason:
          !complete
            ? "Actor registry evidence is partial: materialization, lifecycle-linked release, zero-gated completion, and actor identity are not all proven on the same registry expression."
            : item.generationBound
              ? "The same generation-bound actor registry owns materialization, lifecycle-linked release, and the progression empty-gate for identified actor type(s)."
              : "The actor registry owns materialization, lifecycle-linked release, and the progression empty-gate, but the collection expression is not explicitly bound to a generation/epoch/round/session identity.",
      };
    })
    .sort((a, b) =>
      a.registryExpression.localeCompare(
        b.registryExpression,
      )
    );
}

export function analyzeProgressionActorAccounting(
  inputs:
    readonly ProgressionActorAccountingInput[],
  crossFileCalls:
    readonly CrossFileCallEdge[] = [],
  entities:
    readonly ParsedEntityDefinition[] = [],
  arenaLifecycle?:
    ArenaLifecycleAnalysis,
  entityEventEvidence:
    readonly EntityEventExternalEvidence[] = [],
  activeEventEvidence:
    readonly ScriptProgressionActiveEventEvidence[] = [],
  activeCallEvidence:
    readonly ScriptProgressionActiveCallEvidence[] = [],
  stateTransitionEvidence:
    readonly ScriptProgressionStateTransitionEvidence[] = [],
  advanceEvidence:
    readonly ScriptProgressionAdvanceEvidence[] = [],
  ordinalAdvanceEvidence:
    readonly ScriptProgressionOrdinalAdvanceEvidence[] = [],
  idempotencyEvidence:
    readonly ScriptProgressionIdempotencyEvidence[] = [],
): ProgressionActorAccountingAnalysis {
  const scripts =
    inputs.map(normalizedInput);
  const ingressByCaller = eventIngressByCaller(scripts);
  const progressionAdvances =
    progressionAdvanceOwnership(
      scripts,
      advanceEvidence,
    );
  const crossIngressOrdinalAdvances =
    progressionCrossIngressOrdinalAdvances(
      scripts,
      ordinalAdvanceEvidence,
      ingressByCaller,
    );
  const crossIngressEffectCalls =
    progressionCrossIngressEffects(
      scripts,
      crossFileCalls,
      ordinalAdvanceEvidence,
      idempotencyEvidence,
      ingressByCaller,
    );
  const stateTransitions =
    stateTransitionAssessments(
      scripts,
      stateTransitionEvidence,
    );
  const stateMachines =
    stateMachineAssessments(
      scripts,
      stateTransitions,
    );
  const evidence = scripts.flatMap(
    (script) => [
      ...variableEvidence(script),
      ...scoreboardEvidence(script),
    ],
  );
  const graph =
    callGraph(
      scripts,
      crossFileCalls,
    );
  const activeReachable =
    activeReachableRegions(
      scripts,
      crossFileCalls,
      activeCallEvidence,
      graph,
    );
  const lifecycleRoots =
    lifecycleRootsByKind(scripts);
  const deathReachable =
    reachableFrom(
      lifecycleRoots.death,
      graph,
    );
  const removeReachable =
    reachableFrom(
      lifecycleRoots.remove,
      graph,
    );
  const lifecycleReachable =
    new Set([
      ...deathReachable,
      ...removeReachable,
    ]);
  const registryAuthorityAssessments =
    progressionActorRegistryAuthorityAssessments(
      scripts,
      lifecycleReachable,
    );
  const spawns =
    spawnEvidence(scripts);
  const guards =
    lifecycleActorGuards(scripts);
  const scriptedRemovals =
    scriptedRemovalEvidence(
      scripts,
      guards,
    );
  const terminalRegions =
    terminalReachableRegions(
      arenaLifecycle,
    );
  const incoming =
    incomingCallers(
      scripts,
      crossFileCalls,
    );
  const despawnEvidence =
    entityDespawnEvidence(entities);

  const grouped =
    new Map<
      string,
      CounterEvidenceRecord[]
    >();
  for (const item of evidence) {
    const key = counterKey(item);
    grouped.set(
      key,
      [
        ...(grouped.get(key) ?? []),
        item,
      ],
    );
  }

  const counters =
    [...grouped.values()]
      .map((items) => {
        const first = items[0]!;
        const growth = items.filter(
          (item) =>
            item.operation === "growth",
        );
        const decrements = items.filter(
          (item) =>
            item.operation ===
            "decrement",
        );
        const growthWrites =
          growth.length;
        const decrementWrites =
          decrements.length;
        const replacementWrites =
          items.filter(
            (item) =>
              item.operation ===
              "replacement",
          ).length;
        const completionChecks =
          items.filter(
            (item) =>
              item.operation ===
              "completion-check",
          ).length;
        const linkedDecrements =
          decrements.filter(
            (item) =>
              lifecycleReachable.has(
                localNode(
                  item.scriptPath,
                  item.executionRegion,
                ),
              ),
          ).length;
        const deathLinkedDecrements =
          decrements.filter(
            (item) =>
              deathReachable.has(
                localNode(
                  item.scriptPath,
                  item.executionRegion,
                ),
              ),
          ).length;
        const removeLinkedDecrements =
          decrements.filter(
            (item) =>
              removeReachable.has(
                localNode(
                  item.scriptPath,
                  item.executionRegion,
                ),
              ),
          ).length;
        const reconciliationLifecycleKinds = [
          ...(deathLinkedDecrements > 0
            ? ["death" as const]
            : []),
          ...(removeLinkedDecrements > 0
            ? ["remove" as const]
            : []),
        ];
        const actorAccountingCandidate =
          ACTOR_COUNTER_NAME.test(
            first.counterId,
          );
        const quantityResults =
          growth.map((item) =>
            quantityForGrowth(
              item,
              spawns,
            )
          );
        const quantityComparableGrowths =
          quantityResults.filter(
            (item) =>
              item.status === "matched" ||
              item.status === "mismatch",
          ).length;
        const quantityMatchedGrowths =
          quantityResults.filter(
            (item) =>
              item.status === "matched",
          ).length;
        const quantityMismatchGrowths =
          quantityResults.filter(
            (item) =>
              item.status === "mismatch",
          ).length;

        const deferredSpawnAccounting =
          actorAccountingCandidate &&
          completionChecks > 0
            ? deferredSpawnAccountingAssessment(
                scripts,
                growth,
                spawns,
                graph,
              )
            : {
                actorIdentifiers: [],
                callbacks: 0,
                reservationStatus:
                  "none" as const,
                generationStatus:
                  "none" as const,
                quantityStatus:
                  "none" as const,
              };
        const spawnLinkedActorIdentifiers =
          [
            ...new Set([
              ...growth.flatMap((item) =>
                actorIdsForGrowth(
                  item,
                  spawns,
                  graph,
                )
              ),
              ...(deferredSpawnAccounting
                    .reservationStatus ===
                    "covered-before-defer"
                ? deferredSpawnAccounting
                    .actorIdentifiers
                : []),
            ]),
          ].sort();
        const deathLifecycleActorIdentifiers =
          [
            ...new Set(
              decrements.flatMap((item) =>
                actorIdsForDecrement(
                  item,
                  guards,
                  deathReachable,
                  graph,
                )
              ),
            ),
          ].sort();
        const removeLifecycleActorIdentifiers =
          [
            ...new Set(
              decrements.flatMap((item) =>
                actorIdsForDecrement(
                  item,
                  guards,
                  removeReachable,
                  graph,
                )
              ),
            ),
          ].sort();
        const lifecycleActorIdentifiers =
          [
            ...new Set([
              ...deathLifecycleActorIdentifiers,
              ...removeLifecycleActorIdentifiers,
            ]),
          ].sort();
        const lifecycleSet =
          new Set(
            lifecycleActorIdentifiers,
          );
        const matchedActorIdentifiers =
          spawnLinkedActorIdentifiers
            .filter((id) =>
              lifecycleSet.has(id)
            )
            .sort();
        const spawnActorSet =
          new Set(
            spawnLinkedActorIdentifiers,
          );
        const relevantScriptedRemovals =
          scriptedRemovals
            .filter((item) =>
              spawnActorSet.has(
                item.actorIdentifier,
              )
            );
        const scriptedRemovalActorIdentifiers =
          [
            ...new Set(
              relevantScriptedRemovals
                .map((item) =>
                  item.actorIdentifier
                ),
            ),
          ].sort();
        const terminalOnlyScriptedRemovalActorIdentifiers =
          [
            ...new Set(
              relevantScriptedRemovals
                .filter((item) =>
                  scriptedRemovalScope(
                    item,
                    arenaLifecycle,
                    terminalRegions,
                    incoming,
                  ) ===
                    "terminal-only",
                )
                .map((item) =>
                  item.actorIdentifier
                ),
            ),
          ].sort();
        const nonTerminalScriptedRemovalActorIdentifiers =
          [
            ...new Set(
              relevantScriptedRemovals
                .filter((item) =>
                  scriptedRemovalScope(
                    item,
                    arenaLifecycle,
                    terminalRegions,
                    incoming,
                  ) ===
                    "non-terminal",
                )
                .map((item) =>
                  item.actorIdentifier
                ),
            ),
          ].sort();
        const unresolvedScriptedRemovalActorIdentifiers =
          [
            ...new Set(
              relevantScriptedRemovals
                .filter((item) =>
                  scriptedRemovalScope(
                    item,
                    arenaLifecycle,
                    terminalRegions,
                    incoming,
                  ) ===
                    "unresolved",
                )
                .map((item) =>
                  item.actorIdentifier
                ),
            ),
          ].sort();
        const scriptedRemovalScopeStatus =
          nonTerminalScriptedRemovalActorIdentifiers
              .length > 0
            ? "non-terminal" as const
            : unresolvedScriptedRemovalActorIdentifiers
                  .length > 0
              ? "unresolved" as const
              : terminalOnlyScriptedRemovalActorIdentifiers
                    .length > 0
                ? "terminal-only" as const
                : "none" as const;
        const removeLifecycleSet =
          new Set(
            removeLifecycleActorIdentifiers,
          );
        const riskyRemovalActorSet =
          new Set([
            ...nonTerminalScriptedRemovalActorIdentifiers,
            ...unresolvedScriptedRemovalActorIdentifiers,
          ]);
        const uncoveredScriptedRemovalActorIdentifiers =
          scriptedRemovalActorIdentifiers
            .filter((actorIdentifier) => {
              if (
                !riskyRemovalActorSet.has(
                  actorIdentifier,
                ) ||
                removeLifecycleSet.has(
                  actorIdentifier,
                )
              ) {
                return false;
              }
              return scriptedRemovals
                .filter((item) =>
                  item.actorIdentifier ===
                    actorIdentifier,
                )
                .every((item) =>
                  !directRemovalCanReachDecrement(
                    item,
                    decrements,
                    graph,
                  ),
                );
            })
            .sort();
        const scriptedRemovalCoverage =
          scriptedRemovalActorIdentifiers
              .length === 0
            ? "none" as const
            : uncoveredScriptedRemovalActorIdentifiers
                .length > 0
              ? "uncovered" as const
              : removeLifecycleActorIdentifiers
                    .length > 0 ||
                  scriptedRemovals.some(
                    (item) =>
                      scriptedRemovalActorIdentifiers
                        .includes(
                          item.actorIdentifier,
                        ) &&
                      directRemovalCanReachDecrement(
                        item,
                        decrements,
                        graph,
                      ),
                  )
                ? "covered" as const
                : "unresolved" as const;
        const spawnActorSetForDespawn =
          new Set(
            spawnLinkedActorIdentifiers,
          );
        const immediateDespawnActorIdentifiers =
          [
            ...new Set(
              despawnEvidence
                .filter((item) =>
                  item.kind ===
                    "immediate" &&
                  spawnActorSetForDespawn.has(
                    item.actorIdentifier,
                  )
                )
                .map((item) =>
                  item.actorIdentifier
                ),
            ),
          ].sort();
        const conditionalDespawnActorIdentifiers =
          [
            ...new Set(
              despawnEvidence
                .filter((item) =>
                  item.kind ===
                    "conditional" &&
                  spawnActorSetForDespawn.has(
                    item.actorIdentifier,
                  )
                )
                .map((item) =>
                  item.actorIdentifier
                ),
            ),
          ].sort();
        const conditionalReachability =
          new Map(
            conditionalDespawnActorIdentifiers.map(
              (actorIdentifier) => [
                actorIdentifier,
                conditionalDespawnReachabilityForActor(
                  actorIdentifier,
                  entities,
                  entityEventEvidence,
                  arenaLifecycle,
                  terminalRegions,
                  incoming,
                ),
              ],
            ),
          );
        const reachableConditionalDespawnActorIdentifiers =
          conditionalDespawnActorIdentifiers
            .filter((id) =>
              conditionalReachability
                .get(id)?.status ===
                "reachable",
            );
        const terminalOnlyConditionalDespawnActorIdentifiers =
          conditionalDespawnActorIdentifiers
            .filter((id) =>
              conditionalReachability
                .get(id)?.status ===
                "terminal-only",
            );
        const inactiveConditionalDespawnActorIdentifiers =
          conditionalDespawnActorIdentifiers
            .filter((id) =>
              conditionalReachability
                .get(id)?.status ===
                "inactive",
            );
        const activeInstantDespawnActorIdentifiers =
          conditionalDespawnActorIdentifiers
            .filter((actorIdentifier) => {
              const entity =
                entities.find(
                  (item) =>
                    item.identifier !== undefined &&
                    normalizeActorIdentifier(
                      item.identifier,
                    ) === actorIdentifier,
                );
              if (!entity) return false;
              const kinds =
                conditionalDespawnEventKinds(
                  entity,
                );
              const exactExternal =
                entityEventEvidence.filter(
                  (item) =>
                    eventEvidenceMatchesEntity(
                      item,
                      actorIdentifier,
                    )
                );
              return exactExternal.some(
                (item) =>
                  (
                    kinds.get(item.event) ===
                      "instant" ||
                    kinds.get(item.event) ===
                      "mixed"
                  ) &&
                  (
                    activeEventEvidence.some(
                      (active) =>
                        active.event ===
                          item.event &&
                        active.source
                          .relativePath ===
                          item.source
                            .relativePath &&
                        active.executionRegion ===
                          item.executionRegion,
                    ) ||
                    (
                      item.executionRegion !==
                        undefined &&
                      activeReachable.has(
                        localNode(
                          item.source.relativePath,
                          item.executionRegion,
                        ),
                      )
                    )
                  ),
              );
            })
            .sort();
        const uncoveredImmediateDespawnActorIdentifiers =
          immediateDespawnActorIdentifiers
            .filter((id) =>
              !removeLifecycleSet.has(id)
            )
            .sort();
        const unresolvedConditionalDespawnActorIdentifiers =
          conditionalDespawnActorIdentifiers
            .filter((id) =>
              !removeLifecycleSet.has(id) &&
              (
                conditionalReachability
                  .get(id)?.status ===
                  "reachable" ||
                conditionalReachability
                  .get(id)?.status ===
                  "unresolved"
              )
            )
            .sort();
        const uncoveredActiveInstantDespawnActorIdentifiers =
          activeInstantDespawnActorIdentifiers
            .filter((id) =>
              !removeLifecycleSet.has(id)
            )
            .sort();

        const missingReconciliation =
          actorAccountingCandidate &&
          growthWrites > 0 &&
          completionChecks > 0 &&
          decrementWrites === 0 &&
          replacementWrites === 0;

        const identityComparable =
          actorAccountingCandidate &&
          growthWrites > 0 &&
          completionChecks > 0 &&
          spawnLinkedActorIdentifiers
            .length > 0 &&
          lifecycleActorIdentifiers
            .length > 0;
        const identityMismatch =
          identityComparable &&
          matchedActorIdentifiers.length ===
            0 &&
          replacementWrites === 0;
        const matched =
          identityComparable &&
          matchedActorIdentifiers.length > 0 &&
          linkedDecrements > 0;


        const deferredSpawnAccountingUnproven =
          actorAccountingCandidate &&
          completionChecks > 0 &&
          deferredSpawnAccounting.callbacks > 0 &&
          (
            deferredSpawnAccounting
              .reservationStatus !==
              "covered-before-defer" ||
            deferredSpawnAccounting
              .generationStatus !==
              "generation-guarded"
          );

        const actorIdentityStatus =
          !actorAccountingCandidate
            ? "not-applicable" as const
            : matched
              ? "matched" as const
              : identityMismatch
                ? "mismatch" as const
                : "unresolved" as const;
        const deferredQuantityMismatch =
          deferredSpawnAccounting
            .quantityStatus ===
            "mismatch";
        const directQuantityMatched =
          quantityComparableGrowths > 0 &&
          quantityMatchedGrowths ===
            quantityComparableGrowths;
        const deferredQuantityMatched =
          deferredSpawnAccounting.callbacks > 0 &&
          deferredSpawnAccounting
            .quantityStatus === "matched";
        const spawnQuantityStatus =
          !actorAccountingCandidate
            ? "not-applicable" as const
            : quantityMismatchGrowths > 0 ||
                deferredQuantityMismatch
              ? "mismatch" as const
              : (
                    quantityComparableGrowths === 0 ||
                    directQuantityMatched
                  ) &&
                  (
                    deferredSpawnAccounting.callbacks === 0 ||
                    deferredQuantityMatched
                  ) &&
                  (
                    quantityComparableGrowths > 0 ||
                    deferredSpawnAccounting.callbacks > 0
                  )
                ? "matched" as const
                : "unresolved" as const;
        const quantityMismatch =
          actorAccountingCandidate &&
          growthWrites > 0 &&
          completionChecks > 0 &&
          quantityMismatchGrowths > 0 &&
          replacementWrites === 0;
        const immediateDespawnWithoutReconciliation =
          actorAccountingCandidate &&
          growthWrites > 0 &&
          completionChecks > 0 &&
          uncoveredImmediateDespawnActorIdentifiers
            .length > 0 &&
          replacementWrites === 0;
        const activeInstantDespawnWithoutReconciliation =
          actorAccountingCandidate &&
          growthWrites > 0 &&
          completionChecks > 0 &&
          uncoveredActiveInstantDespawnActorIdentifiers
            .length > 0 &&
          replacementWrites === 0;

        return {
          scriptId: [
            ...new Set(
              items.map(
                (item) => item.scriptId,
              ),
            ),
          ].sort().join(","),
          counterId:
            first.counterId,
          kind: first.kind,
          growthWrites,
          decrementWrites,
          replacementWrites,
          completionChecks,
          lifecycleLinkedDecrements:
            linkedDecrements,
          deathLinkedDecrements,
          removeLinkedDecrements,
          reconciliationLifecycleKinds,
          deathLifecycleActorIdentifiers,
          removeLifecycleActorIdentifiers,
          scriptedRemovalActorIdentifiers,
          terminalOnlyScriptedRemovalActorIdentifiers,
          nonTerminalScriptedRemovalActorIdentifiers,
          unresolvedScriptedRemovalActorIdentifiers,
          scriptedRemovalScope:
            scriptedRemovalScopeStatus,
          uncoveredScriptedRemovalActorIdentifiers,
          scriptedRemovalCoverage,
          immediateDespawnActorIdentifiers,
          conditionalDespawnActorIdentifiers,
          reachableConditionalDespawnActorIdentifiers,
          terminalOnlyConditionalDespawnActorIdentifiers,
          inactiveConditionalDespawnActorIdentifiers,
          activeInstantDespawnActorIdentifiers,
          uncoveredActiveInstantDespawnActorIdentifiers,
          uncoveredImmediateDespawnActorIdentifiers,
          unresolvedConditionalDespawnActorIdentifiers,
          quantityComparableGrowths,
          quantityMatchedGrowths,
          quantityMismatchGrowths,
          spawnQuantityStatus,
          actorAccountingCandidate,
          spawnLinkedActorIdentifiers,
          lifecycleActorIdentifiers,
          matchedActorIdentifiers,
          actorIdentityStatus,
          deferredSpawnActorIdentifiers:
            [...deferredSpawnAccounting.actorIdentifiers],
          deferredSpawnCallbacks:
            deferredSpawnAccounting.callbacks,
          deferredSpawnReservationStatus:
            deferredSpawnAccounting.reservationStatus,
          deferredSpawnGenerationStatus:
            deferredSpawnAccounting.generationStatus,
          deferredSpawnQuantityStatus:
            deferredSpawnAccounting.quantityStatus,
          status:
            missingReconciliation
              ? "missing-reconciliation" as const
              : identityMismatch
                ? "actor-identity-mismatch" as const
                : quantityMismatch
                  ? "spawn-quantity-mismatch" as const
                  : activeInstantDespawnWithoutReconciliation
                    ? "active-instant-despawn-without-reconciliation" as const
                    : immediateDespawnWithoutReconciliation
                      ? "instant-despawn-without-reconciliation" as const
                      : deferredSpawnAccountingUnproven
                        ? "deferred-spawn-accounting-unproven" as const
                      : matched &&
                      spawnQuantityStatus ===
                        "matched"
                    ? "reconciled-from-matched-actor-lifecycle" as const
                    : "unresolved" as const,
          reasons:
            missingReconciliation
              ? [
                  "An actor-accounting counter grows and gates completion at zero, but the selected artifact exposes no decrement or replacement/recompute path.",
                ]
              : identityMismatch
                ? [
                    "Counter growth is source-linked to actor type(s) " +
                    spawnLinkedActorIdentifiers.join(", ") +
                    ", while lifecycle-linked decrement is guarded for different actor type(s) " +
                    lifecycleActorIdentifiers.join(", ") +
                    ". No matching actor identity can reconcile the growth path.",
                  ]
                : quantityMismatch
                  ? [
                      "A single-invocation actor spawn region has a deterministic literal spawn count that does not match the actor-counter growth amount. The counter can diverge from the population it claims to represent.",
                    ]
                  : activeInstantDespawnWithoutReconciliation
                    ? [
                        "A counted actor has an exact event-driven minecraft:instant_despawn activation under a source-proven active gameplay state guard, but no matching entity-remove reconciliation path reaches the counter.",
                      ]
                    : immediateDespawnWithoutReconciliation
                      ? [
                          "A counted actor definition includes base minecraft:instant_despawn, but no matching entity-remove reconciliation path reaches the actor counter. The actor can disappear immediately while the completion gate still depends on the counter.",
                        ]
                      : matched &&
                      spawnQuantityStatus ===
                        "matched"
                    ? [
                        "Counter growth is source-linked to actor type(s) " +
                        matchedActorIdentifiers.join(", ") +
                        ", actor quantity matches the direct spawn count, and matching actor reconciliation reaches the decrement through lifecycle kind(s): " +
                        reconciliationLifecycleKinds.join(", ") +
                        ".",
                      ]
                    : [
                      linkedDecrements > 0
                        ? "A lifecycle-linked decrement exists, but the selected artifact does not yet prove that it reconciles the same actor identity that caused the counter growth."
                        : decrementWrites > 0
                          ? "A decrement exists, but no selected-artifact entity-death/entity-remove call path proves that the actor lifecycle can reach it."
                          : replacementWrites > 0
                            ? "Replacement/set writes exist, but their role may be initialization, reset, or recomputation. They are not credited as actor reconciliation without lifecycle proof."
                            : "Only part of the actor-counter lifecycle is grounded. Do not classify it safe or defective until producer, completion, and reconciliation ownership are complete.",
                    ],
        };
      })
      .filter((item) =>
        item.growthWrites > 0 ||
        item.decrementWrites > 0 ||
        item.replacementWrites > 0 ||
        item.completionChecks > 0
      )
      .sort((a, b) =>
        a.counterId.localeCompare(
          b.counterId,
        ) ||
        a.kind.localeCompare(b.kind)
      );

  return {
    counters,
    provenMissingReconciliation:
      counters.filter(
        (item) =>
          item.status ===
          "missing-reconciliation",
      ).length,
    provenActorIdentityMismatch:
      counters.filter(
        (item) =>
          item.status ===
          "actor-identity-mismatch",
      ).length,
    provenSpawnQuantityMismatch:
      counters.filter(
        (item) =>
          item.status ===
          "spawn-quantity-mismatch",
      ).length,
    scriptedRemovalCoverageGaps:
      counters.filter(
        (item) =>
          item.scriptedRemovalCoverage ===
          "uncovered",
      ).length,
    terminalOnlyScriptedRemovalCounters:
      counters.filter(
        (item) =>
          item.scriptedRemovalScope ===
          "terminal-only",
      ).length,
    nonTerminalScriptedRemovalCounters:
      counters.filter(
        (item) =>
          item.scriptedRemovalScope ===
          "non-terminal",
      ).length,
    provenImmediateDespawnWithoutReconciliation:
      counters.filter(
        (item) =>
          item.status ===
          "instant-despawn-without-reconciliation",
      ).length,
    conditionalDespawnUnknowns:
      counters.filter(
        (item) =>
          item.unresolvedConditionalDespawnActorIdentifiers
            .length > 0,
      ).length,
    reachableConditionalDespawnCounters:
      counters.filter(
        (item) =>
          item.reachableConditionalDespawnActorIdentifiers
            .length > 0,
      ).length,
    terminalOnlyConditionalDespawnCounters:
      counters.filter(
        (item) =>
          item.terminalOnlyConditionalDespawnActorIdentifiers
            .length > 0,
      ).length,
    inactiveConditionalDespawnCounters:
      counters.filter(
        (item) =>
          item.inactiveConditionalDespawnActorIdentifiers
            .length > 0,
      ).length,
    provenActiveInstantDespawnWithoutReconciliation:
      counters.filter(
        (item) =>
          item.status ===
          "active-instant-despawn-without-reconciliation",
      ).length,
    activeInterproceduralProofs:
      activeReachable.size,
    activeTransitionProofs:
      activeEventEvidence.filter(
        (item) =>
          item.basis ===
          "transition",
      ).length +
      activeCallEvidence.filter(
        (item) =>
          item.basis ===
          "transition",
      ).length,
    declaredActiveStateAliases:
      new Set(
        scripts.flatMap((script) =>
          deriveProgressionActiveStateValues(
            script.parsed
              .transitionDeclarations ??
              [],
          )
        ),
      ).size,
    stateTransitions,
    validStateTransitions:
      stateTransitions.filter(
        (item) =>
          item.status === "valid",
      ).length,
    invalidStateTransitions:
      stateTransitions.filter(
        (item) =>
          item.status === "invalid",
      ).length,
    unresolvedStateTransitions:
      stateTransitions.filter(
        (item) =>
          item.status === "unresolved",
      ).length,
    stateMachines,
    completeStateMachines:
      stateMachines.filter(
        (item) =>
          item.status === "complete",
      ).length,
    deadEndStateMachines:
      stateMachines.filter(
        (item) =>
          item.status === "dead-end",
      ).length,
    unresolvedStateMachines:
      stateMachines.filter(
        (item) =>
          item.status === "unresolved",
      ).length,
    sourceEnteredDeadEndStates:
      stateMachines.reduce(
        (count, item) =>
          count +
          item.sourceEnteredDeadEndStates
            .length,
        0,
      ),
    progressionAdvances,
    duplicateProgressionAdvances:
      progressionAdvances.filter(
        (item) =>
          item.status ===
          "duplicate",
      ).length,
    crossIngressOrdinalAdvances,
    provenCrossIngressOrdinalAdvances:
      crossIngressOrdinalAdvances.length,
    crossIngressEffectCalls,
    idempotentCrossIngressEffectCalls:
      crossIngressEffectCalls.filter(
        (item) =>
          item.status ===
          "idempotent",
      ).length,
    provenCrossIngressEffectCalls:
      crossIngressEffectCalls.filter(
        (item) =>
          item.status ===
          "contradicted",
      ).length,
    unresolvedCrossIngressEffectCalls:
      crossIngressEffectCalls.filter(
        (item) =>
          item.status ===
          "unresolved",
      ).length,
    reconciledFromMatchedActorLifecycle:
      counters.filter(
        (item) =>
          item.status ===
          "reconciled-from-matched-actor-lifecycle",
      ).length,
    deferredSpawnAccountingGaps:
      counters.filter(
        (item) =>
          item.status ===
          "deferred-spawn-accounting-unproven",
      ).length,
    registryAuthorityAssessments,
    generationBoundRegistryAuthorities:
      registryAuthorityAssessments.filter(
        (item) =>
          item.status ===
          "generation-bound-authoritative",
      ).length,
    unboundRegistryAuthorities:
      registryAuthorityAssessments.filter(
        (item) =>
          item.status ===
          "generation-unbound",
      ).length,
    unresolvedRegistryAuthorities:
      registryAuthorityAssessments.filter(
        (item) =>
          item.status === "incomplete",
      ).length,
    unresolvedCounters:
      counters.filter(
        (item) =>
          item.status === "unresolved",
      ).length,
  };
}
