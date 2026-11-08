import type {
  ArenaReplicaDiscovery,
  Translation3,
} from "../../../../analyzers/topology/src/index.js";
import type {
  ArenaCapacityReport,
  ArenaCapacityResource,
} from "../../../../analyzers/diagnostics/src/index.js";
import {
  solveArenaConcurrencyCapacity,
} from "../../../../analyzers/diagnostics/src/index.js";
import type {
  TickingAreaSemantics,
} from "../../../../analyzers/commands/src/index.js";
import type { ParsedScriptFile } from "../../../../analyzers/scripts/src/index.js";
import type { SourceRef } from "../../../project-model/src/index.js";

/**
 * A producer's boolean claim is not sufficient proof on its own.
 * Only a same-artifact, same-region guard bound to the exact roster write
 * can contribute a global numeric party capacity. A source file without
 * exact spans is still useful evidence but cannot close this boundary.
 */
function sameSourceArtifact(a: SourceRef | undefined, b: SourceRef | undefined): boolean {
  return a !== undefined && b !== undefined &&
    a.artifactId.trim().length > 0 &&
    a.relativePath.trim().length > 0 &&
    a.artifactId === b.artifactId &&
    a.relativePath === b.relativePath;
}

function sameSourceSpan(a: SourceRef | undefined, b: SourceRef | undefined): boolean {
  const x = a?.range, y = b?.range;
  return sameSourceArtifact(a,b) &&
    x?.lineStart !== undefined && x.columnStart !== undefined &&
    x.lineEnd !== undefined && x.columnEnd !== undefined &&
    y?.lineStart !== undefined && y.columnStart !== undefined &&
    y.lineEnd !== undefined && y.columnEnd !== undefined &&
    x.lineStart === y.lineStart && x.columnStart === y.columnStart &&
    x.lineEnd === y.lineEnd && x.columnEnd === y.columnEnd;
}

function hasExactRosterCapacityAuthority(
  scriptSource: SourceRef,
  path: NonNullable<ParsedScriptFile["arenaAuthorityPaths"]>[number],
): boolean {
  const check = path.capacityCheck;
  const commit = path.membershipCommit;
  return path.capacityAuthorityProven &&
    check !== undefined && commit !== undefined &&
    check.kind === "capacity-check" &&
    commit.kind === "membership-commit" &&
    path.arenaExpression === check.arenaExpression &&
    check.arenaExpression === commit.arenaExpression &&
    check.membershipExpression !== undefined &&
    check.membershipExpression === commit.membershipExpression &&
    path.executionRegion === check.executionRegion &&
    check.executionRegion === commit.executionRegion &&
    sameSourceArtifact(scriptSource,check.source) &&
    sameSourceArtifact(check.source,commit.source) &&
    check.source.range?.lineStart !== undefined &&
    check.source.range?.columnStart !== undefined &&
    sameSourceSpan(check.guardedCommitSource,commit.source);
}

export interface ArenaCommandTickingAreaRecord {
  semantics: TickingAreaSemantics;
  functionId: string;
  line?: number;
}

export interface ArenaCapacityExtractionInput {
  discovery?: ArenaReplicaDiscovery;
  tickingAreas: readonly ArenaCommandTickingAreaRecord[];
  scripts?: readonly ParsedScriptFile[];
  declaredArenaCount?: number;
  declaredConcurrentArenaLimit?: number;
  /** Persisted command ticking areas from a complete selected-world DB scan. */
  observedPermanentTickingAreas?: number;
}

export interface ArenaCapacityExtractionEvidence {
  requestedConcurrentArenas?: number;
  discoveredArenaCount?: number;
  declaredArenaCount?: number;
  declaredConcurrentArenaLimit?: number;
  arenaCountConflict: boolean;
  commandTickingAreaAdds: number;
  /** Add commands with unresolved/invalid shape or relative coordinates. */
  unresolvedCommandTickingAreaAdds: number;
  completeCommandTickingAreaFamilies: number;
  unmatchedCommandTickingAreaAdds: number;
  commandTickingAreaResourceResolved: boolean;
  /** Source commands that can mutate active area leases after the DB snapshot. */
  tickingAreaMutationSourceSites: number;
  /** Exact script command-literal locators, never evidence of execution. */
  scriptTickingAreaMutationSources: readonly SourceRef[];
  /** No number means no complete selected-world occupancy proof. */
  observedPermanentTickingAreas?: number;
  scriptTickingAreaManagerReferenced: boolean;
  scriptCapacitySignals: readonly string[];
  scriptTickingAreaCapacityResolved: boolean;
  perArenaPlayerCapacity?: number;
  /** Source references for authority-proven party capacity, not runtime success. */
  perArenaPlayerCapacitySources?: readonly SourceRef[];
  /** Detected roster admission paths still lacking source-bound numeric proof. */
  unresolvedRosterCapacityPaths?: number;
  declaredMaxConcurrentPlayers?: number;
  conflictingPlayerCapacityValues: readonly number[];
  reasons: readonly string[];
}

export interface ArenaCapacityExtractionResult {
  resources: readonly ArenaCapacityResource[];
  evidence: ArenaCapacityExtractionEvidence;
  report?: ArenaCapacityReport;
}

function absolutePoint(
  coordinate:
    | { x: { mode: string; value: number }; y: { mode: string; value: number }; z: { mode: string; value: number } }
    | undefined,
): { x: number; y: number; z: number } | undefined {
  if (!coordinate) return undefined;
  if (
    coordinate.x.mode !== "absolute" ||
    coordinate.y.mode !== "absolute" ||
    coordinate.z.mode !== "absolute" ||
    !Number.isFinite(coordinate.x.value) ||
    !Number.isFinite(coordinate.y.value) ||
    !Number.isFinite(coordinate.z.value)
  ) {
    return undefined;
  }
  return {
    x: coordinate.x.value,
    y: coordinate.y.value,
    z: coordinate.z.value,
  };
}

function anchorForTickingArea(
  semantics: TickingAreaSemantics,
): { x: number; y: number; z: number } | undefined {
  if (semantics.action === "add-circle") {
    return absolutePoint(semantics.center);
  }
  if (semantics.action === "add-rectangle") {
    const from = absolutePoint(semantics.from);
    const to = absolutePoint(semantics.to);
    if (!from || !to) return undefined;
    return {
      x: Math.min(from.x, to.x),
      y: Math.min(from.y, to.y),
      z: Math.min(from.z, to.z),
    };
  }
  return undefined;
}

function shapeKey(
  semantics: TickingAreaSemantics,
): string | undefined {
  if (semantics.action === "add-circle") {
    // Official /tickingarea command range, not a guessed resource cost.
    if (!Number.isInteger(semantics.radius) ||
        semantics.radius < 0 || semantics.radius > 4) return undefined;
    return [
      "circle",
      semantics.radius,
      semantics.preload ?? false,
    ].join(":");
  }
  if (semantics.action === "add-rectangle") {
    const from = absolutePoint(semantics.from);
    const to = absolutePoint(semantics.to);
    if (!from || !to) return undefined;
    const chunkSpan = (a: number, b: number): number =>
      Math.floor(Math.max(a, b) / 16) -
      Math.floor(Math.min(a, b) / 16) + 1;
    // A command area can contain at most 100 chunks. Source coordinates
    // larger than this are an unresolved/invalid creation attempt, not
    // proof of a valid per-arena slot.
    if (chunkSpan(from.x, to.x) * chunkSpan(from.z, to.z) > 100) {
      return undefined;
    }
    return [
      "rectangle",
      Math.abs(to.x - from.x),
      Math.abs(to.y - from.y),
      Math.abs(to.z - from.z),
      semantics.preload ?? false,
    ].join(":");
  }
  return undefined;
}

function offsetKey(
  offset: Translation3,
): string {
  return `${offset.x},${offset.y},${offset.z}`;
}

function pointKey(
  point: { x: number; y: number; z: number },
): string {
  return `${point.x},${point.y},${point.z}`;
}

function subtract(
  point: { x: number; y: number; z: number },
  offset: Translation3,
) {
  return {
    x: point.x - offset.x,
    y: point.y - offset.y,
    z: point.z - offset.z,
  };
}

export function extractArenaConcurrencyCapacity(
  input: ArenaCapacityExtractionInput,
): ArenaCapacityExtractionResult {
  const reasons: string[] = [];
  const discoveredArenaCount =
    input.discovery === undefined
      ? undefined
      : 1 + input.discovery.replicas.length;
  const declaredArenaCount =
    input.declaredArenaCount;
  const arenaCountConflict =
    discoveredArenaCount !== undefined &&
    declaredArenaCount !== undefined &&
    discoveredArenaCount !== declaredArenaCount;
  const requestedConcurrentArenas =
    arenaCountConflict
      ? undefined
      : discoveredArenaCount ??
        declaredArenaCount;

  if (arenaCountConflict) {
    reasons.push(
      `Detected arena count ${discoveredArenaCount} conflicts with deterministic script-declared arena count ${declaredArenaCount}; concurrency request remains unresolved.`,
    );
  } else if (
    discoveredArenaCount !== undefined &&
    declaredArenaCount !== undefined
  ) {
    reasons.push(
      `Topology and deterministic script config agree on ${discoveredArenaCount} arena(s).`,
    );
  }

  const authoredAdds = input.tickingAreas.filter((record) =>
    record.semantics.action === "add-circle" ||
    record.semantics.action === "add-rectangle");
  const addRecords = authoredAdds.flatMap((record) => {
    const anchor = anchorForTickingArea(record.semantics);
    const shape = shapeKey(record.semantics);
    return anchor && shape
      ? [{ record, anchor, shape }]
      : [];
  });
  // Do not silently drop relative/unresolved/invalid add commands. A
  // numerically complete subset cannot establish the whole resource cost.
  const unresolvedAdds = authoredAdds.length - addRecords.length;
  if (unresolvedAdds > 0) reasons.push(
    String(unresolvedAdds) + " authored /tickingarea add command(s) have " +
    "relative/unresolved coordinates or invalid area shape; whole-map " +
    "command residency cost is UNKNOWN.");

  const names = authoredAdds.flatMap((item) =>
    item.semantics.action === "add-circle" ||
    item.semantics.action === "add-rectangle"
      ? item.semantics.name?.trim()
        ? [item.semantics.name.trim().toLowerCase()]
        : []
      : []);
  // Name uniqueness is a necessary, not sufficient, global allocation
  // condition. Distinct positions with one reused name cannot be proven
  // concurrently creatable from geometry alone.
  const ambiguousNames = new Set(names).size !== names.length;
  if (ambiguousNames) reasons.push(
    "Repeated authored ticking-area names require lifecycle/rename proof. " +
    "Do not infer independent concurrent leases from coordinates alone.");

  const offsets = input.discovery?.offsets ?? [];
  const expectedOffsets = input.discovery?.replicas.length;
  const offsetKeys = [
    offsetKey({ x: 0, y: 0, z: 0 }),
    ...offsets.map(offsetKey),
  ];
  const completeOffsets =
    input.discovery !== undefined &&
    expectedOffsets === offsets.length &&
    offsetKeys.length === new Set(offsetKeys).size &&
    offsets.every(offset =>
      Number.isSafeInteger(offset.x) &&
      Number.isSafeInteger(offset.y) &&
      Number.isSafeInteger(offset.z));
  if (input.discovery !== undefined && !completeOffsets && authoredAdds.length > 0) {
    reasons.push(
      "Arena replica offsets are missing, duplicate or non-integral. " +
      "Translated command families cannot establish a complete per-arena cost.");
  }

  // .mcfunction parsing and Script API runCommand literals are distinct
  // owners of authored command operations. Neither proves invocation order,
  // whether a persisted area has been removed or whether it is acquired
  // again before a new arena starts.
  const functionTickingAreaMutations = input.tickingAreas.filter((item) =>
    item.semantics.action === "remove" ||
    item.semantics.action === "remove-all");
  const scriptTickingAreaMutations = (input.scripts ?? [])
    .flatMap((script) => (script.commandLiterals ?? []).filter((item) =>
      /(?:^|\brun\s+)\/?tickingarea\s+(?:add|remove(?:_all)?)\b/i
        .test(item.command.trim())));
  const tickingAreaMutationSourceSites =
    functionTickingAreaMutations.length +
    scriptTickingAreaMutations.length;
  if (tickingAreaMutationSourceSites > 0) reasons.push(
    String(tickingAreaMutationSourceSites) +
    " source-side /tickingarea mutation(s) may change persisted occupancy " +
    "between the world snapshot and arena admission. Resource arithmetic " +
    "is conditional and does not establish the effective concurrent limit.");

  const resources: ArenaCapacityResource[] = [];

  if (
    input.declaredConcurrentArenaLimit !== undefined
  ) {
    if (
      !Number.isInteger(
        input.declaredConcurrentArenaLimit,
      ) ||
      input.declaredConcurrentArenaLimit < 1
    ) {
      reasons.push(
        "Declared concurrent arena limit is invalid and cannot be used as capacity evidence.",
      );
    } else {
      resources.push({
        id: "runtime-arena-admission-cap",
        backend: "fixed-pool",
        perArena: 1,
        total:
          input.declaredConcurrentArenaLimit,
      });
      reasons.push(
        "Runtime admission explicitly caps active arenas at " +
          String(
            input.declaredConcurrentArenaLimit,
          ) +
          ".",
      );
    }
  }
  // Numeric capacity is a global projection. Every discovered roster
  // admission path must have an enforced, resolvable source bound; one
  // successful path cannot certify unrelated/unknown arena owners.
  const rosterPaths = (input.scripts ?? []).flatMap((script) =>
    (script.arenaAuthorityPaths ?? [])
      .filter((path) => path.membershipCommit !== undefined)
      .map((path) => ({ source: script.source, path }))
  );
  const playerCapacityAuthorityEvidence =
    rosterPaths
        .filter(({ path, source }) =>
          hasExactRosterCapacityAuthority(source,path) &&
          path.capacityCheck?.capacityExpression !== undefined
        )
        .flatMap(({ path }) => {
          const check = path.capacityCheck!;
          const literalValue = Number(check.capacityExpression);
          const literal =
            Number.isSafeInteger(literalValue) && literalValue > 0
              ? literalValue : undefined;
          const bound =
            sameSourceArtifact(check.source, check.resolvedCapacitySource) &&
            check.resolvedCapacitySource?.range?.lineStart !== undefined &&
            check.resolvedCapacitySource.range.columnStart !== undefined &&
            (check.resolvedCapacityWitnesses ?? []).every((witness) =>
              sameSourceArtifact(check.source, witness) &&
              witness.range?.lineStart !== undefined &&
              witness.range.columnStart !== undefined
            ) &&
            Number.isSafeInteger(check.resolvedCapacityValue ?? NaN) &&
            (check.resolvedCapacityValue ?? 0) > 0
              ? check.resolvedCapacityValue : undefined;
          const value = literal ?? bound;
          return value === undefined ? [] : [{
            value,
            sources: [
              check.source,
              ...(literal === undefined && bound !== undefined
                ? [check.resolvedCapacitySource!,
                    ...(check.resolvedCapacityWitnesses ?? [])] : []),
            ],
          }];
        });
  const unresolvedRosterPaths =
    rosterPaths.length - playerCapacityAuthorityEvidence.length;
  const numericPlayerCapacities = [
    ...new Set(playerCapacityAuthorityEvidence.map((item) => item.value)),
  ].sort((a, b) => a - b);
  const perArenaPlayerCapacity =
    numericPlayerCapacities.length === 1 && unresolvedRosterPaths === 0
      ? numericPlayerCapacities[0]
      : undefined;
  const perArenaPlayerCapacitySources =
    perArenaPlayerCapacity === undefined
      ? []
      : playerCapacityAuthorityEvidence
          .filter((item) => item.value === perArenaPlayerCapacity)
          .flatMap((item) => item.sources);
  const declaredMaxConcurrentPlayers =
    perArenaPlayerCapacity !== undefined &&
    requestedConcurrentArenas !== undefined
      ? perArenaPlayerCapacity *
        requestedConcurrentArenas
      : undefined;

  const scriptCapacitySignals = [
    ...new Set(
      (input.scripts ?? []).flatMap((script) => [
        ...script.propertyAccesses
          .filter((item) =>
            item.property === "tickingAreaManager" ||
            item.property === "maxChunkCount"
          )
          .map((item) => item.symbol),
        ...script.methodCalls
          .filter((item) =>
            item.method === "hasCapacity" ||
            item.symbol.includes("tickingAreaManager")
          )
          .map((item) => item.symbol),
        ...script.moduleMemberAccesses
          .filter((item) =>
            item.member === "tickingAreaManager" ||
            item.member === "maxChunkCount" ||
            item.member === "hasCapacity"
          )
          .map((item) => item.symbol),
      ]),
    ),
  ].sort();
  const scriptTickingAreaManagerReferenced =
    scriptCapacitySignals.length > 0;
  let completeFamilies = 0;
  let unmatched = authoredAdds.length;
  let commandResourceResolved = false;

  if (
    requestedConcurrentArenas !== undefined &&
    requestedConcurrentArenas > 0 &&
    input.discovery !== undefined &&
    completeOffsets &&
    addRecords.length > 0
  ) {
    const arenaOffsets: Translation3[] = [
      { x: 0, y: 0, z: 0 },
      ...input.discovery.offsets,
    ];

    const recordsByShapeAndPoint = new Map<string, number>();
    for (const item of addRecords) {
      const key = item.shape + "|" + pointKey(item.anchor);
      recordsByShapeAndPoint.set(
        key,
        (recordsByShapeAndPoint.get(key) ?? 0) + 1,
      );
    }

    const familyKeys = new Set<string>();
    for (const item of addRecords) {
      for (const offset of arenaOffsets) {
        const base = subtract(item.anchor, offset);
        familyKeys.add(item.shape + "|" + pointKey(base));
      }
    }

    const completeFamilyKeys: string[] = [];
    for (const familyKey of familyKeys) {
      const separator = familyKey.indexOf("|");
      const shape = familyKey.slice(0, separator);
      const [xText, yText, zText] = familyKey
        .slice(separator + 1)
        .split(",");
      const base = {
        x: Number(xText),
        y: Number(yText),
        z: Number(zText),
      };

      const complete = arenaOffsets.every((offset) => {
        const key =
          shape +
          "|" +
          pointKey({
            x: base.x + offset.x,
            y: base.y + offset.y,
            z: base.z + offset.z,
          });
        return (recordsByShapeAndPoint.get(key) ?? 0) > 0;
      });
      if (complete) completeFamilyKeys.push(familyKey);
    }

    completeFamilies = completeFamilyKeys.length;
    // A family can overlap another family's translated positions. Counting
    // N * number-of-families alone admitted false exact coverage when one
    // authored command was reused by two families and a different command
    // was never matched. Match the complete position MULTISET instead.
    const consumed = new Map<string, number>();
    for (const familyKey of completeFamilyKeys) {
      const separator = familyKey.indexOf("|");
      const shape = familyKey.slice(0, separator);
      const [x, y, z] = familyKey.slice(separator + 1).split(",").map(Number);
      for (const offset of arenaOffsets) {
        const key = shape + "|" +
          pointKey({ x: x! + offset.x, y: y! + offset.y, z: z! + offset.z });
        consumed.set(key, (consumed.get(key) ?? 0) + 1);
      }
    }
    unmatched = unresolvedAdds +
      [...recordsByShapeAndPoint].reduce(
        (sum, [key, observed]) =>
          sum + Math.abs(observed - (consumed.get(key) ?? 0)),
        0);

    if (
      completeFamilies > 0 &&
      unmatched === 0 &&
      !ambiguousNames &&
      completeFamilies * arenaOffsets.length === addRecords.length
    ) {
      reasons.push(
        `Detected ${completeFamilies} complete /tickingarea add family/families repeated across all ${requestedConcurrentArenas} arena(s).`,
      );
      const occupied = input.observedPermanentTickingAreas;
      if (occupied !== undefined &&
          Number.isSafeInteger(occupied) && occupied >= 0 &&
          occupied <= 10) {
        // Official Bedrock command rule: ten /tickingarea entries per world.
        // Existing world records (lobby/admin/other dimensions) consume slots.
        // This is a resource ceiling, not proof a session starts successfully.
        resources.push({
          id: "command-tickingarea-slots",
          backend: "fixed-pool",
          perArena: completeFamilies,
          total: 10,
          reserved: occupied,
        });
        commandResourceResolved = true;
        reasons.push(
          `Selected-world native DB has ${occupied} persisted ticking area(s); command budget is (10 - ${occupied}) / ${completeFamilies} per arena. This does not prove admission, scheduling or native gameplay.`,
        );
      } else {
        reasons.push(
          "Command ticking-area cost was reconstructed, but complete selected-world occupancy is unavailable or invalid. Do not assume zero permanent areas or report a safe simultaneous capacity.",
        );
      }
    } else {
      reasons.push(
        "Command ticking-area usage could not be reduced to complete translated families across every detected arena; capacity remains unresolved.",
      );
    }
  } else if (authoredAdds.length > 0) {
    reasons.push(
      "Authored command ticking-area additions exist, but complete " +
      "arena topology/offset or position evidence is unavailable. " +
      "Per-arena resource cost remains unresolved.",
    );
  }

  if (unresolvedRosterPaths > 0) {
    reasons.push(
      String(unresolvedRosterPaths) +
      " roster admission source path(s) have no enforced numeric capacity proof; global per-arena capacity and derived player slots remain unresolved.",
    );
  }
  if (numericPlayerCapacities.length > 1) {
    reasons.push(
      "Multiple proven per-arena player capacity literals disagree; player capacity is reported as conflicting evidence rather than collapsed to one value.",
    );
  } else if (perArenaPlayerCapacity !== undefined) {
    reasons.push(
      `Detected a consistent source-proven per-arena player capacity of ${perArenaPlayerCapacity} across all discovered roster admission paths; Minecraft runtime delivery remains unverified.`,
    );
  }

  if (scriptTickingAreaManagerReferenced) {
    reasons.push(
      "Script ticking-area capacity signals were detected, but this repository does not yet have a knowledge-catalog contract that resolves TickingAreaManager reported capacity into a deterministic resource value. The Script API backend is therefore detected-but-unresolved and does not constrain the solver.",
    );
  }

  if (addRecords.length === 0) {
    reasons.push(
      "No command /tickingarea add usage was detected; command ticking-area capacity does not constrain the extracted model.",
    );
  }

  const report =
    requestedConcurrentArenas === undefined
      ? undefined
      : solveArenaConcurrencyCapacity(
          requestedConcurrentArenas,
          resources,
        );

  return {
    resources,
    evidence: {
      ...(requestedConcurrentArenas === undefined
        ? {}
        : { requestedConcurrentArenas }),
      ...(discoveredArenaCount === undefined
        ? {}
        : { discoveredArenaCount }),
      ...(declaredArenaCount === undefined
        ? {}
        : { declaredArenaCount }),
      ...(input.declaredConcurrentArenaLimit === undefined
        ? {}
        : {
            declaredConcurrentArenaLimit:
              input.declaredConcurrentArenaLimit,
          }),
      arenaCountConflict,
      commandTickingAreaAdds: authoredAdds.length,
      unresolvedCommandTickingAreaAdds: unresolvedAdds,
      completeCommandTickingAreaFamilies:
        completeFamilies,
      unmatchedCommandTickingAreaAdds: unmatched,
      commandTickingAreaResourceResolved:
        commandResourceResolved,
      tickingAreaMutationSourceSites,
      scriptTickingAreaMutationSources:
        scriptTickingAreaMutations.map(item => item.source),
      ...(input.observedPermanentTickingAreas === undefined ? {} : {
        observedPermanentTickingAreas:
          input.observedPermanentTickingAreas,
      }),
      scriptTickingAreaManagerReferenced,
      scriptCapacitySignals,
      scriptTickingAreaCapacityResolved: false,
      unresolvedRosterCapacityPaths: unresolvedRosterPaths,
      ...(perArenaPlayerCapacity === undefined
        ? {}
        : {
            perArenaPlayerCapacity,
            perArenaPlayerCapacitySources,
          }),
      ...(declaredMaxConcurrentPlayers === undefined
        ? {}
        : { declaredMaxConcurrentPlayers }),
      conflictingPlayerCapacityValues:
        numericPlayerCapacities.length > 1
          ? numericPlayerCapacities
          : [],
      reasons,
    },
    ...(report === undefined ? {} : { report }),
  };
}
