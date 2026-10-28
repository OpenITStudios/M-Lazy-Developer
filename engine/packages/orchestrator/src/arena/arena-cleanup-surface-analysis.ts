import type {
  ParsedScriptFile,
} from "../../../../analyzers/scripts/src/index.js";
import { isArenaTerminalRegionCandidate } from "./arena-lifecycle-analysis.js";

export type ArenaCleanupSurfaceKind =
  | "membership"
  | "dynamic-property"
  | "deferred-callback"
  | "entity"
  | "tag"
  | "effect"
  | "scoreboard"
  | "input-permission"
  | "inventory"
  | "equipment"
  | "gamemode"
  | "player-capability"
  | "mount-relationship";

export type ArenaCleanupEvidencePrecision =
  | "exact"
  | "surface-level";

export interface ArenaCleanupSurfaceMutation {
  scriptId: string;
  region: string;
  surface: ArenaCleanupSurfaceKind;
  key: string;
  action: "acquire" | "release";
  precision: ArenaCleanupEvidencePrecision;
}

export interface ArenaCleanupSurfaceAssessment {
  surface: ArenaCleanupSurfaceKind;
  key: string;
  acquisitionRegions: readonly string[];
  releaseRegions: readonly string[];
  releaseReachableFromTerminal: boolean;
  precision: ArenaCleanupEvidencePrecision;
  status: "proven" | "partial" | "unresolved";
}

export interface ArenaCleanupTerminalAssessment {
  scriptId: string;
  terminalRegion: string;
  reachableRegions: readonly string[];
  surfaces: readonly ArenaCleanupSurfaceAssessment[];
  exactProven: number;
  partial: number;
  unresolved: number;
}

export type ArenaCleanupObligationStatus =
  | "complete"
  | "partial"
  | "missing";

export interface ArenaCleanupResourceObligation {
  scriptId: string;
  surface: ArenaCleanupSurfaceKind;
  key: string;
  acquisitionRegions: readonly string[];
  requiredTerminals: number;
  provenTerminals: number;
  partialTerminals: number;
  missingTerminals: number;
  status: ArenaCleanupObligationStatus;
}

export interface ArenaCleanupResourceLedger {
  resources: number;
  complete: number;
  partial: number;
  missing: number;
  coverageRatio: number;
  obligations: readonly ArenaCleanupResourceObligation[];
}

export interface ArenaCleanupLifecycleAssessment {
  scriptId: string;
  tableName: string;
  stateType?: string;
  status: "complete" | "unresolved";
  missingPhases: readonly string[];
  orderingViolations: readonly string[];
  reason: string;
}

export interface ArenaCleanupLifecycleSummary {
  declared: boolean;
  complete: number;
  unresolved: number;
  assessments: readonly ArenaCleanupLifecycleAssessment[];
}

export interface ArenaResetCompletionSourceSummary {
  swallowedFailurePaths: number;
  partialResultPaths: number;
  earlyIdlePaths: number;
  /** Same-source start waits for cleanup settlement before countdown. */
  settlementOnlyAdmissions?: number;
  observations: readonly ({
    scriptId: string;
  } & NonNullable<ParsedScriptFile["arenaResetCompletionEvidence"]>[number])[];
}

export interface ArenaCleanupSurfaceAnalysis {
  acquiredSurfaces: number;
  terminalAssessments: readonly ArenaCleanupTerminalAssessment[];
  exactProven: number;
  partial: number;
  unresolved: number;
  ledger?: ArenaCleanupResourceLedger;
  lifecycle: ArenaCleanupLifecycleSummary;
  asyncResetCompletion?: ArenaResetCompletionSourceSummary;
}

function normalizedRegion(region: string | undefined): string {
  return region ?? "module";
}

function graphFor(
  script: ParsedScriptFile,
): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();
  for (const call of script.localFunctionCalls) {
    const next = graph.get(call.callerRegion) ?? new Set<string>();
    next.add(call.targetRegion);
    graph.set(call.callerRegion, next);
  }
  return graph;
}

function reachable(
  graph: ReadonlyMap<string, ReadonlySet<string>>,
  root: string,
): string[] {
  const seen = new Set<string>([root]);
  const queue = [root];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of graph.get(current) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return [...seen].sort();
}

function terminalRegions(script: ParsedScriptFile): string[] {
  const regions = new Set<string>();
  for (const call of script.localFunctionCalls) {
    if (isArenaTerminalRegionCandidate(call.callerRegion)) {
      regions.add(call.callerRegion);
    }
    if (isArenaTerminalRegionCandidate(call.targetRegion)) {
      regions.add(call.targetRegion);
    }
  }
  for (const path of script.arenaAuthorityPaths ?? []) {
    // Graph edges are parser-region qualified; keep that identity when
    // joining a class method to arena cleanup ownership evidence.
    const region = path.parserExecutionRegion ?? path.executionRegion;
    if (
      isArenaTerminalRegionCandidate(region) ||
      path.membershipRelease ||
      path.generationInvalidation
    ) {
      regions.add(region);
    }
  }
  for (const resource of script.cleanupResourceEvidence ?? []) {
    if (isArenaTerminalRegionCandidate(resource.executionRegion)) {
      regions.add(resource.executionRegion);
    }
  }
  return [...regions].sort();
}

function mutationKey(
  surface: ArenaCleanupSurfaceKind,
  key: string,
): string {
  return surface + "|" + key;
}

function extractMutations(
  script: ParsedScriptFile,
): ArenaCleanupSurfaceMutation[] {
  const output: ArenaCleanupSurfaceMutation[] = [];

  for (const path of script.arenaAuthorityPaths ?? []) {
    if (path.membershipCommit?.membershipExpression) {
      output.push({
        scriptId: script.identifier,
        region: path.parserExecutionRegion ?? path.executionRegion,
        surface: "membership",
        key: path.membershipCommit.membershipExpression,
        action: "acquire",
        precision: "exact",
      });
    }
    if (path.membershipRelease?.membershipExpression) {
      output.push({
        scriptId: script.identifier,
        region: path.parserExecutionRegion ?? path.executionRegion,
        surface: "membership",
        key: path.membershipRelease.membershipExpression,
        action: "release",
        precision: "exact",
      });
    }
  }

  for (const access of script.dynamicProperties) {
    const region = normalizedRegion(access.executionRegion);
    // Only a directly identified World singleton is stable across source
    // sites. Same-spelled player/entity/item expressions may be different
    // instances in separate arena sessions.
    const stableWorld = access.receiverType === "World" &&
      access.receiverInference === "direct";
    const receiverKey = stableWorld
      ? "world"
      : access.receiverHint?.trim() || access.receiverType || "unknown";
    const key = receiverKey + ":" + (access.propertyId ?? "*");
    const precision = stableWorld && access.propertyId !== undefined
      ? "exact" as const : "surface-level" as const;
    if (access.operation === "set") {
      output.push({
        scriptId: script.identifier,
        region,
        surface: "dynamic-property",
        key,
        action: "acquire",
        precision,
      });
    } else if (access.operation === "delete") {
      output.push({
        scriptId: script.identifier,
        region,
        surface: "dynamic-property",
        key,
        action: "release",
        precision,
      });
    } else if (access.operation === "clear") {
      output.push({
        scriptId: script.identifier,
        region,
        surface: "dynamic-property",
        key: receiverKey + ":*",
        action: "release",
        precision: "surface-level",
      });
    }
  }

  for (const resource of script.cleanupResourceEvidence ?? []) {
    output.push({
      scriptId: script.identifier,
      region: resource.executionRegion,
      surface: resource.surface,
      key: resource.key,
      action: resource.action,
      // Literal tag/effect keys identify source syntax, not a stable
      // Player/Entity receiver across two different gameplay paths.
      // Never upgrade that text match into exact reset/cleanup proof.
      precision:
        resource.surface === "tag" || resource.surface === "effect"
          ? "surface-level"
          : resource.precision,
    });
  }

  for (const evidence of script.inventoryLifecycleEvidence ?? []) {
    const region = normalizedRegion(evidence.executionRegion);
    if (evidence.kind === "item-grant") {
      output.push({
        scriptId: script.identifier,
        region,
        surface: "inventory",
        key: evidence.subjectExpression,
        action: "acquire",
        precision: "surface-level",
      });
    } else if (
      evidence.kind === "inventory-clear-all" ||
      evidence.kind === "inventory-clear-slot"
    ) {
      output.push({
        scriptId: script.identifier,
        region,
        surface: "inventory",
        key: evidence.subjectExpression,
        action: "release",
        precision: "surface-level",
      });
    } else if (evidence.kind === "equipment-set") {
      output.push({
        scriptId: script.identifier,
        region,
        surface: "equipment",
        key: evidence.subjectExpression,
        action: "acquire",
        precision: "surface-level",
      });
    } else if (evidence.kind === "equipment-clear-slot") {
      output.push({
        scriptId: script.identifier,
        region,
        surface: "equipment",
        key: evidence.subjectExpression,
        action: "release",
        precision: "surface-level",
      });
    }
  }

  for (const call of script.methodCalls) {
    const region = normalizedRegion(call.executionRegion);
    const method = call.method;

    if (method === "setGameMode") {
      const gameMode = call.argumentTexts?.[0]?.toLowerCase() ?? "";
      const action =
        /creative|spectator/.test(gameMode)
          ? "acquire" as const
          : /survival|adventure/.test(gameMode)
            ? "release" as const
            : undefined;
      if (action !== undefined) {
        output.push({
          scriptId: script.identifier,
          region,
          surface: "gamemode",
          key: call.receiverHint ?? call.receiverType,
          action,
          precision: "surface-level",
        });
      }
    }

    const pair:
      | {
          surface: ArenaCleanupSurfaceKind;
          action: "acquire" | "release";
          key: string;
        }
      | undefined =
      method === "spawnEntity" && call.receiverType === "Dimension"
        ? {
            surface: "entity",
            action: "acquire",
            key: call.receiverHint ?? call.receiverType,
          }
        : method === "remove" && call.receiverType === "Entity"
          ? {
              surface: "entity",
              action: "release",
              key: call.receiverHint ?? call.receiverType,
            }
          : undefined;
    // Entity.kill() is a gameplay death, not reset cleanup. Same-spelled
    // remove() on another receiver is not entity despawn evidence.
    if (pair) {
      output.push({
        scriptId: script.identifier,
        region,
        surface: pair.surface,
        key: pair.key,
        action: pair.action,
        precision: "surface-level",
      });
    }
  }
  for (const command of script.commandLiterals) {
    const region = normalizedRegion(command.executionRegion);
    const text = command.command.trim();

    const gameMode = /^gamemode\s+(creative|spectator|survival|adventure)\b(?:\s+(.+))?/i.exec(text);
    if (gameMode) {
      output.push({
        scriptId: script.identifier,
        region,
        surface: "gamemode",
        key: (gameMode[2]?.trim() || command.receiverHint || "player"),
        action:
          /creative|spectator/i.test(gameMode[1]!)
            ? "acquire"
            : "release",
        precision: "surface-level",
      });
    }

    const ability = /^ability\s+(\S+)\s+(mayfly|worldbuilder|mute)\s+(true|false)\b/i.exec(text);
    if (ability) {
      output.push({
        scriptId: script.identifier,
        region,
        surface: "player-capability",
        key: ability[1]! + ":" + ability[2]!.toLowerCase(),
        action:
          ability[3]!.toLowerCase() === "true"
            ? "acquire"
            : "release",
        precision: "exact",
      });
    }
  }



  return output;
}

function releaseMatches(
  acquire: ArenaCleanupSurfaceMutation,
  release: ArenaCleanupSurfaceMutation,
): boolean {
  if (
    acquire.surface !== release.surface ||
    release.action !== "release"
  ) return false;

  if (acquire.precision === "exact" && release.precision === "exact") {
    return acquire.key === release.key;
  }

  if (acquire.surface === "dynamic-property") {
    const acquireReceiver = acquire.key.split(":")[0];
    const releaseReceiver = release.key.split(":")[0];
    // Matching unverified player/entity text is at most PARTIAL, never
    // exact identity across sessions. The status owner checks precision.
    return acquireReceiver !== "unknown" &&
      acquireReceiver === releaseReceiver &&
      (acquire.key === release.key ||
       release.key === releaseReceiver + ":*");
  }

  return (
    acquire.key === release.key ||
    release.key === "system"
  );
}

function analyzeScript(
  script: ParsedScriptFile,
): ArenaCleanupTerminalAssessment[] {
  const mutations = extractMutations(script);
  const acquisitions = mutations.filter(
    (item) => item.action === "acquire",
  );
  const releases = mutations.filter(
    (item) => item.action === "release",
  );
  const graph = graphFor(script);

  return terminalRegions(script).map((terminalRegion) => {
    const regions = reachable(graph, terminalRegion);
    const surfaces = [
      ...new Map(
        acquisitions.map((item) => [
          mutationKey(item.surface, item.key),
          item,
        ]),
      ).values(),
    ].map((acquire): ArenaCleanupSurfaceAssessment => {
      const matching = releases.filter((release) =>
        releaseMatches(acquire, release)
      );
      const reachableMatching = matching.filter((release) =>
        regions.includes(release.region)
      );
      const exact =
        acquire.precision === "exact" &&
        reachableMatching.some(
          (release) =>
            release.precision === "exact" &&
            release.key === acquire.key,
        );
      const status =
        exact
          ? "proven" as const
          : reachableMatching.length > 0
            ? "partial" as const
            : "unresolved" as const;

      return {
        surface: acquire.surface,
        key: acquire.key,
        acquisitionRegions: acquisitions
          .filter((item) =>
            item.surface === acquire.surface &&
            item.key === acquire.key
          )
          .map((item) => item.region)
          .filter((value, index, array) =>
            array.indexOf(value) === index
          )
          .sort(),
        releaseRegions: reachableMatching
          .map((item) => item.region)
          .filter((value, index, array) =>
            array.indexOf(value) === index
          )
          .sort(),
        releaseReachableFromTerminal:
          reachableMatching.length > 0,
        precision:
          exact
            ? "exact"
            : "surface-level",
        status,
      };
    }).sort((a, b) =>
      a.surface.localeCompare(b.surface) ||
      a.key.localeCompare(b.key)
    );

    return {
      scriptId: script.identifier,
      terminalRegion,
      reachableRegions: regions,
      surfaces,
      exactProven: surfaces.filter(
        (item) => item.status === "proven",
      ).length,
      partial: surfaces.filter(
        (item) => item.status === "partial",
      ).length,
      unresolved: surfaces.filter(
        (item) => item.status === "unresolved",
      ).length,
    };
  });
}

function buildResourceLedger(
  scripts: readonly ParsedScriptFile[],
  terminalAssessments: readonly ArenaCleanupTerminalAssessment[],
): ArenaCleanupResourceLedger {
  const obligations: ArenaCleanupResourceObligation[] = [];

  for (const script of scripts) {
    const acquisitions = extractMutations(script).filter(
      (item) => item.action === "acquire",
    );
    const unique = new Map<string, ArenaCleanupSurfaceMutation>();

    for (const acquisition of acquisitions) {
      unique.set(
        mutationKey(acquisition.surface, acquisition.key),
        acquisition,
      );
    }

    const terminals = terminalAssessments.filter(
      (item) => item.scriptId === script.identifier,
    );

    for (const acquisition of unique.values()) {
      const matchingAcquisitions = acquisitions.filter(
        (item) =>
          item.surface === acquisition.surface &&
          item.key === acquisition.key,
      );
      let provenTerminals = 0;
      let partialTerminals = 0;
      let missingTerminals = 0;

      for (const terminal of terminals) {
        const surface = terminal.surfaces.find(
          (item) =>
            item.surface === acquisition.surface &&
            item.key === acquisition.key,
        );
        if (surface?.status === "proven") {
          provenTerminals++;
        } else if (surface?.status === "partial") {
          partialTerminals++;
        } else {
          missingTerminals++;
        }
      }

      const requiredTerminals = terminals.length;
      const status: ArenaCleanupObligationStatus =
        requiredTerminals > 0 &&
        provenTerminals === requiredTerminals
          ? "complete"
          : provenTerminals > 0 || partialTerminals > 0
            ? "partial"
            : "missing";

      obligations.push({
        scriptId: script.identifier,
        surface: acquisition.surface,
        key: acquisition.key,
        acquisitionRegions: matchingAcquisitions
          .map((item) => item.region)
          .filter((value, index, array) =>
            array.indexOf(value) === index
          )
          .sort(),
        requiredTerminals,
        provenTerminals,
        partialTerminals,
        missingTerminals:
          requiredTerminals === 0
            ? 1
            : missingTerminals,
        status,
      });
    }
  }

  obligations.sort((a, b) =>
    a.scriptId.localeCompare(b.scriptId) ||
    a.surface.localeCompare(b.surface) ||
    a.key.localeCompare(b.key)
  );

  const complete = obligations.filter(
    (item) => item.status === "complete",
  ).length;
  const partial = obligations.filter(
    (item) => item.status === "partial",
  ).length;
  const missing = obligations.filter(
    (item) => item.status === "missing",
  ).length;
  const denominator = obligations.length;

  return {
    resources: denominator,
    complete,
    partial,
    missing,
    coverageRatio:
      denominator === 0
        ? 1
        : complete / denominator,
    obligations,
  };
}


const CLEANUP_LIFECYCLE_PHASES = [
  "freeze",
  "invalidate",
  "clean",
  "restorebaseline",
  "verifyempty",
  "readyfornextgeneration",
] as const;

function normalizedCleanupState(
  value: string,
): string {
  return value
    .replace(/[^A-Za-z0-9]/g, "")
    .toLowerCase();
}

function cleanupStateCanReach(
  start: string,
  target: string,
  outgoing:
    ReadonlyMap<string, ReadonlySet<string>>,
): boolean {
  const seen = new Set<string>([start]);
  const queue = [start];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === target) return true;
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

function cleanupLifecycleSummary(
  scripts: readonly ParsedScriptFile[],
  acquiredSurfaces: number,
): ArenaCleanupLifecycleSummary {
  const assessments:
    ArenaCleanupLifecycleAssessment[] = [];

  for (const script of scripts) {
    const declarations =
      script.transitionDeclarations ?? [];
    const byTable =
      new Map<
        string,
        typeof declarations
      >();

    for (const declaration of declarations) {
      const owner =
        (
          declaration.tableName +
          " " +
          (declaration.stateType ?? "")
        );
      if (
        !/(?:cleanup|reset)/i.test(owner)
      ) {
        continue;
      }
      const list =
        byTable.get(
          declaration.tableName,
        ) ?? [];
      byTable.set(
        declaration.tableName,
        [...list, declaration],
      );
    }

    for (const [tableName, table] of byTable) {
      const stateType =
        table.find(
          (item) =>
            item.stateType !== undefined,
        )?.stateType;
      const states =
        new Set<string>();
      const outgoing =
        new Map<string, Set<string>>();

      for (const transition of table) {
        const from =
          normalizedCleanupState(
            transition.from,
          );
        states.add(from);
        const next =
          outgoing.get(from) ??
          new Set<string>();
        for (const target of transition.to) {
          const normalized =
            normalizedCleanupState(
              target,
            );
          states.add(normalized);
          next.add(normalized);
        }
        outgoing.set(from, next);
      }

      const missingPhases =
        CLEANUP_LIFECYCLE_PHASES
          .filter(
            (phase) =>
              !states.has(phase),
          );
      const orderingViolations:
        string[] = [];

      for (
        let index = 0;
        index <
          CLEANUP_LIFECYCLE_PHASES.length -
            1;
        index += 1
      ) {
        const from =
          CLEANUP_LIFECYCLE_PHASES[
            index
          ]!;
        const to =
          CLEANUP_LIFECYCLE_PHASES[
            index + 1
          ]!;
        if (
          !states.has(from) ||
          !states.has(to)
        ) {
          continue;
        }
        if (
          !cleanupStateCanReach(
            from,
            to,
            outgoing,
          )
        ) {
          orderingViolations.push(
            from + " !-> " + to,
          );
        }
      }

      const status =
        missingPhases.length === 0 &&
        orderingViolations.length === 0
          ? "complete" as const
          : "unresolved" as const;

      assessments.push({
        scriptId: script.identifier,
        tableName,
        ...(stateType === undefined
          ? {}
          : { stateType }),
        status,
        missingPhases,
        orderingViolations,
        reason:
          status === "complete"
            ? "Authored cleanup lifecycle closes FREEZE -> INVALIDATE -> CLEAN -> RESTORE_BASELINE -> VERIFY_EMPTY -> READY_FOR_NEXT_GENERATION in order."
            : "Authored cleanup lifecycle does not close the required cleanup transaction. Missing=[" +
              missingPhases.join(",") +
              "] ordering=[" +
              orderingViolations.join(",") +
              "].",
      });
    }
  }

  if (
    assessments.length === 0 &&
    acquiredSurfaces > 0
  ) {
    return {
      declared: false,
      complete: 0,
      unresolved: 1,
      assessments: [],
    };
  }

  return {
    declared:
      assessments.length > 0,
    complete:
      assessments.filter(
        (item) =>
          item.status === "complete",
      ).length,
    unresolved:
      assessments.filter(
        (item) =>
          item.status === "unresolved",
      ).length,
    assessments:
      assessments.sort((a, b) =>
        a.scriptId.localeCompare(
          b.scriptId,
        ) ||
        a.tableName.localeCompare(
          b.tableName,
        )
      ),
  };
}

export function analyzeArenaCleanupSurfaces(
  scripts: readonly ParsedScriptFile[],
): ArenaCleanupSurfaceAnalysis {
  const terminalAssessments = scripts.flatMap(analyzeScript);
  const acquiredSurfaces = scripts.reduce(
    (sum, script) =>
      sum +
      extractMutations(script).filter(
        (item) => item.action === "acquire",
      ).length,
    0,
  );

  const ledger = buildResourceLedger(
    scripts,
    terminalAssessments,
  );
  const lifecycle =
    cleanupLifecycleSummary(
      scripts,
      acquiredSurfaces,
    );
  const observations = scripts.flatMap(script =>
    (script.arenaResetCompletionEvidence ?? []).map(evidence => ({
      scriptId: script.identifier,
      ...evidence,
    })));
  const asyncResetCompletion: ArenaResetCompletionSourceSummary = {
    swallowedFailurePaths: observations.filter(item =>
      item.kind === "reset-error-swallowed-candidate").length,
    partialResultPaths: observations.filter(item =>
      item.kind === "partial-reset-result-candidate").length,
    earlyIdlePaths: observations.filter(item =>
      item.kind === "idle-before-cleanup-settlement-candidate").length,
    settlementOnlyAdmissions: observations.filter(item =>
      item.kind === "start-admission-on-cleanup-settlement-candidate").length,
    observations,
  };

  return {
    acquiredSurfaces,
    terminalAssessments,
    ledger,
    asyncResetCompletion,
    exactProven: terminalAssessments.reduce(
      (sum, item) => sum + item.exactProven,
      0,
    ),
    partial: terminalAssessments.reduce(
      (sum, item) => sum + item.partial,
      0,
    ),
    unresolved: terminalAssessments.reduce(
      (sum, item) => sum + item.unresolved,
      0,
    ),
    lifecycle,
  };
}
