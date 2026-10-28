import { resolveScriptImports, type ParsedScriptFile } from "../../../../analyzers/scripts/src/index.js";
import {
  evaluateSafeConfig,
  type SafeConfigExpression,
  type SafeConfigFunction,
  type SafeConfigValue,
} from "../../../behavior-model/src/index.js";
import type { SourceRef } from "../../../project-model/src/index.js";

export interface ResolvedScriptSafeConfigBinding {
  scriptId: string;
  name: string;
  value: SafeConfigValue;
  source: SourceRef;
}

export interface FailedScriptSafeConfigBinding {
  scriptId: string;
  name: string;
  reason: string;
  source: SourceRef;
}

export interface ScriptArenaCountCandidate {
  scriptId: string;
  name: string;
  value: number;
  source: SourceRef;
}

export interface ScriptArenaConcurrencyCandidate {
  scriptId: string;
  name: string;
  value: number;
  source: SourceRef;
}

/** Explicit, distinct authored arena identifiers; not physical world proof. */
export interface ScriptArenaIdCandidate {
  scriptId: string;
  name: string;
  arenaIds: readonly string[];
  source: SourceRef;
}

/** Exact keys of one keyed offset map, not a reconstructed spatial layout. */
export interface ScriptArenaOffsetKeyCandidate {
  scriptId: string;
  name: string;
  arenaIds: readonly string[];
  source: SourceRef;
}

export interface ScriptArenaLayoutCandidate {
  scriptId: string;
  name: string;
  mode: "absolute-centers" | "relative-offsets";
  points: readonly { x: number; y: number; z: number }[];
  source: SourceRef;
}

export interface ScriptArenaLayout {
  mode: "absolute-centers" | "relative-offsets";
  arenaCount: number;
  canonicalAnchor?: { x: number; y: number; z: number };
  offsets: readonly { x: number; y: number; z: number }[];
  sourceNames: readonly string[];
}

export interface ScriptSafeConfigAnalysis {
  compiledBindings: number;
  rejectedBindings: number;
  crossFileResolvedBindings: number;
  resolvedBindings: readonly ResolvedScriptSafeConfigBinding[];
  failedBindings: readonly FailedScriptSafeConfigBinding[];
  arenaCountCandidates: readonly ScriptArenaCountCandidate[];
  /** Explicit enabled IDs take part in count consistency, not runtime proof. */
  arenaIdCandidates?: readonly ScriptArenaIdCandidate[];
  arenaOffsetKeyCandidates?: readonly ScriptArenaOffsetKeyCandidate[];
  /** Missing/ambiguous keyed offset ownership prevents count certification. */
  arenaAuthoredIdConflict?: boolean;
  arenaConcurrencyCandidates:
    readonly ScriptArenaConcurrencyCandidate[];
  arenaLayoutCandidates: readonly ScriptArenaLayoutCandidate[];
  resolvedArenaCount?: number;
  resolvedArenaConcurrencyLimit?: number;
  resolvedArenaLayout?: ScriptArenaLayout;
  arenaCountConflict: boolean;
  arenaConcurrencyConflict: boolean;
  arenaLayoutConflict: boolean;
}

const ARENA_ENABLED_IDS_NAME = /^ENABLED_ARENA_IDS$/;
const ARENA_KEYED_OFFSETS_NAME = /^ARENA_OFFSETS$/;

function asEnabledArenaIds(value: SafeConfigValue): string[] | undefined {
  if (!Array.isArray(value) || value.length < 1 ||
      value.some(id => typeof id !== "string" || !id.trim() || id !== id.trim())) {
    return undefined;
  }
  const ids = value as string[];
  return new Set(ids).size === ids.length ? [...ids] : undefined;
}

function asKeyedArenaOffsets(value: SafeConfigValue): string[] | undefined {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    return undefined;
  }
  const entries = Object.entries(value);
  if (entries.length === 0 || entries.some(([id, offset]) =>
    !id.trim() || id !== id.trim() ||
    !(typeof offset === "number" && Number.isFinite(offset)) &&
    asVector3(offset) === undefined)) return undefined;
  return entries.map(([id]) => id).sort();
}

const ARENA_COUNT_NAME =
  /^(?:ARENA_COUNT|MAX_ARENAS)$/;
const ARENA_CONCURRENCY_NAME =
  /^(?:MAX_CONCURRENT_ARENAS|MAX_ACTIVE_ARENAS)$/;
const ARENA_ABSOLUTE_LAYOUT_NAME =
  /^(?:ARENA_CENTERS|ARENA_ANCHORS|ARENA_POSITIONS)$/;
const ARENA_OFFSET_LAYOUT_NAME =
  /^ARENA_OFFSETS$/;

function asVector3(
  value: SafeConfigValue,
): { x: number; y: number; z: number } | undefined {
  if (
    value === null ||
    Array.isArray(value) ||
    typeof value !== "object"
  ) return undefined;
  const item = value as Readonly<Record<string, SafeConfigValue>>;
  if (
    typeof item.x !== "number" ||
    !Number.isFinite(item.x) ||
    typeof item.y !== "number" ||
    !Number.isFinite(item.y) ||
    typeof item.z !== "number" ||
    !Number.isFinite(item.z)
  ) {
    return undefined;
  }
  return { x: item.x, y: item.y, z: item.z };
}

function asVectorSeries(
  value: SafeConfigValue,
): { x: number; y: number; z: number }[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const points = value.map(asVector3);
  return points.some((item) => item === undefined)
    ? undefined
    : points as { x: number; y: number; z: number }[];
}

function normalizedLayoutKey(
  candidate: ScriptArenaLayoutCandidate,
): string {
  const first = candidate.points[0]!;
  const normalized =
    candidate.mode === "absolute-centers"
      ? candidate.points.map((point) => ({
          x: point.x - first.x,
          y: point.y - first.y,
          z: point.z - first.z,
        }))
      : candidate.points.map((point) => ({
          x: point.x - first.x,
          y: point.y - first.y,
          z: point.z - first.z,
        }));
  return JSON.stringify(normalized);
}

export function analyzeScriptSafeConfig(
  scripts: readonly ParsedScriptFile[],
): ScriptSafeConfigAnalysis {
  const resolvedBindings: ResolvedScriptSafeConfigBinding[] = [];
  const failedBindings: FailedScriptSafeConfigBinding[] = [];
  const arenaCountCandidates: ScriptArenaCountCandidate[] = [];
  const arenaIdCandidates: ScriptArenaIdCandidate[] = [];
  const arenaOffsetKeyCandidates: ScriptArenaOffsetKeyCandidate[] = [];
  let malformedArenaIdOrOffsets = false;
  const arenaConcurrencyCandidates:
    ScriptArenaConcurrencyCandidate[] = [];
  const arenaLayoutCandidates: ScriptArenaLayoutCandidate[] = [];
  const scriptsById = new Map(
    scripts.map((script) => [script.identifier, script]),
  );
  const importResolutions = resolveScriptImports(scripts);
  const importTargetByKey = new Map(
    importResolutions
      .filter(
        (item) =>
          item.status === "resolved" &&
          item.targetIdentifier !== undefined,
      )
      .map((item) => [
        item.fromIdentifier + "|" + item.module,
        item.targetIdentifier!,
      ]),
  );

  const cache = new Map<string, SafeConfigValue>();
  const resolvingBindings = new Set<string>();
  const resolvingFunctions = new Set<string>();
  const functions = new Map<string, SafeConfigFunction>();
  let crossFileResolvedBindings = 0;

  const exportedLocalName = (
    script: ParsedScriptFile,
    exportedName: string,
  ): string | undefined =>
    (script.safeConfigExports ?? []).find(
      (item) => item.exportedName === exportedName,
    )?.localName;

  const importedTarget = (
    script: ParsedScriptFile,
    localName: string,
  ): {
    target: ParsedScriptFile;
    localName: string;
  } | undefined => {
    const imported = (script.safeConfigImports ?? []).find(
      (item) => item.localName === localName,
    );
    if (!imported) return undefined;

    const targetId = importTargetByKey.get(
      script.identifier + "|" + imported.module,
    );
    const target = targetId
      ? scriptsById.get(targetId)
      : undefined;
    if (!target) {
      throw new Error(
        "Safe config import " +
          imported.module +
          " from " +
          script.identifier +
          " is unresolved.",
      );
    }

    const targetLocalName = exportedLocalName(
      target,
      imported.importedName,
    );
    if (!targetLocalName) {
      throw new Error(
        "Safe config export " +
          imported.importedName +
          " is not declared by " +
          target.identifier,
      );
    }

    crossFileResolvedBindings += 1;
    return {
      target,
      localName: targetLocalName,
    };
  };

  const qualifiedFunctionName = (
    script: ParsedScriptFile,
    name: string,
  ) => script.identifier + "::" + name;

  let resolveExpression: (
    script: ParsedScriptFile,
    expression: SafeConfigExpression,
    localNames?: ReadonlySet<string>,
  ) => SafeConfigExpression;

  const resolveFunction = (
    script: ParsedScriptFile,
    name: string,
  ): string => {
    const qualified =
      qualifiedFunctionName(script, name);
    if (functions.has(qualified)) {
      return qualified;
    }
    if (resolvingFunctions.has(qualified)) {
      throw new Error(
        "Cross-file safe config function cycle includes " +
          qualified,
      );
    }

    const local = (script.safeConfigFunctions ?? []).find(
      (item) => item.name === name,
    );
    if (!local) {
      throw new Error(
        "Unknown safe config function " +
          name +
          " in " +
          script.identifier,
      );
    }

    resolvingFunctions.add(qualified);
    try {
      const parameterNames =
        new Set(local.definition.params);
      const body = resolveExpression(
        script,
        local.definition.body,
        parameterNames,
      );
      functions.set(qualified, {
        params: local.definition.params,
        body,
      });
      return qualified;
    } finally {
      resolvingFunctions.delete(qualified);
    }
  };

  const resolveBindingValue = (
    script: ParsedScriptFile,
    name: string,
  ): SafeConfigValue => {
    const cacheKey = script.identifier + "::" + name;
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey)!;
    }
    if (resolvingBindings.has(cacheKey)) {
      throw new Error(
        "Cross-file safe config reference cycle includes " +
          cacheKey,
      );
    }

    const binding = (script.safeConfigBindings ?? []).find(
      (item) => item.name === name,
    );
    if (!binding) {
      throw new Error(
        "Unknown safe config binding " +
          name +
          " in " +
          script.identifier,
      );
    }

    resolvingBindings.add(cacheKey);
    try {
      const expression = resolveExpression(
        script,
        binding.expression,
      );
      const value = evaluateSafeConfig(
        expression,
        {
          bindings: {},
          functions:
            Object.fromEntries(functions),
        },
      );
      cache.set(cacheKey, value);
      return value;
    } finally {
      resolvingBindings.delete(cacheKey);
    }
  };

  resolveExpression = (
    script,
    expression,
    localNames = new Set<string>(),
  ): SafeConfigExpression => {
    if (expression.kind === "literal") {
      return expression;
    }

    if (expression.kind === "ref") {
      if (localNames.has(expression.name)) {
        return expression;
      }

      const localBinding =
        (script.safeConfigBindings ?? []).some(
          (item) => item.name === expression.name,
        );
      if (localBinding) {
        return {
          kind: "literal",
          value: resolveBindingValue(
            script,
            expression.name,
          ),
        };
      }

      const imported = importedTarget(
        script,
        expression.name,
      );
      if (!imported) {
        throw new Error(
          "Unknown safe config reference " +
            expression.name +
            " in " +
            script.identifier,
        );
      }

      const targetHasBinding =
        (imported.target.safeConfigBindings ?? []).some(
          (item) =>
            item.name === imported.localName,
        );
      if (!targetHasBinding) {
        throw new Error(
          "Safe config import " +
            expression.name +
            " resolves to a function and cannot be used as a value.",
        );
      }

      return {
        kind: "literal",
        value: resolveBindingValue(
          imported.target,
          imported.localName,
        ),
      };
    }

    if (expression.kind === "call") {
      const args = expression.args.map((item) =>
        resolveExpression(
          script,
          item,
          localNames,
        )
      );

      const localFunction =
        (script.safeConfigFunctions ?? []).some(
          (item) => item.name === expression.name,
        );
      if (localFunction) {
        return {
          kind: "call",
          name: resolveFunction(
            script,
            expression.name,
          ),
          args,
        };
      }

      const imported = importedTarget(
        script,
        expression.name,
      );
      if (!imported) {
        throw new Error(
          "Unknown safe config function " +
            expression.name +
            " in " +
            script.identifier,
        );
      }
      const targetHasFunction =
        (imported.target.safeConfigFunctions ?? []).some(
          (item) =>
            item.name === imported.localName,
        );
      if (!targetHasFunction) {
        throw new Error(
          "Safe config import " +
            expression.name +
            " resolves to a value and cannot be called.",
        );
      }

      return {
        kind: "call",
        name: resolveFunction(
          imported.target,
          imported.localName,
        ),
        args,
      };
    }

    if (expression.kind === "array") {
      return {
        kind: "array",
        items: expression.items.map((item) =>
          resolveExpression(
            script,
            item,
            localNames,
          )
        ),
      };
    }

    if (expression.kind === "array-compose") {
      return {
        kind: "array-compose",
        parts: expression.parts.map((part) => ({
          spread: part.spread,
          expression: resolveExpression(
            script,
            part.expression,
            localNames,
          ),
        })),
      };
    }

    if (expression.kind === "object") {
      return {
        kind: "object",
        entries: Object.fromEntries(
          Object.entries(expression.entries).map(
            ([key, value]) => [
              key,
              resolveExpression(
                script,
                value,
                localNames,
              ),
            ],
          ),
        ),
      };
    }

    if (expression.kind === "object-merge") {
      return {
        kind: "object-merge",
        parts: expression.parts.map((part) =>
          resolveExpression(
            script,
            part,
            localNames,
          )
        ),
      };
    }

    if (
      expression.kind === "binary" ||
      expression.kind === "compare" ||
      expression.kind === "logical"
    ) {
      return {
        ...expression,
        left: resolveExpression(
          script,
          expression.left,
          localNames,
        ),
        right: resolveExpression(
          script,
          expression.right,
          localNames,
        ),
      };
    }

    if (expression.kind === "conditional") {
      return {
        kind: "conditional",
        condition: resolveExpression(
          script,
          expression.condition,
          localNames,
        ),
        whenTrue: resolveExpression(
          script,
          expression.whenTrue,
          localNames,
        ),
        whenFalse: resolveExpression(
          script,
          expression.whenFalse,
          localNames,
        ),
      };
    }

    if (expression.kind === "get") {
      return {
        kind: "get",
        object: resolveExpression(
          script,
          expression.object,
          localNames,
        ),
        key: expression.key,
      };
    }

    if (expression.kind === "intrinsic") {
      return {
        ...expression,
        args: expression.args.map((item) =>
          resolveExpression(
            script,
            item,
            localNames,
          )
        ),
      };
    }

    if (expression.kind === "map") {
      const callbackNames = new Set(localNames);
      callbackNames.add(expression.itemName);
      if (expression.indexName) {
        callbackNames.add(expression.indexName);
      }
      return {
        kind: "map",
        source: resolveExpression(
          script,
          expression.source,
          localNames,
        ),
        itemName: expression.itemName,
        ...(expression.indexName === undefined
          ? {}
          : {
              indexName:
                expression.indexName,
            }),
        body: resolveExpression(
          script,
          expression.body,
          callbackNames,
        ),
      };
    }

    const callbackNames = new Set(localNames);
    callbackNames.add(expression.indexName);
    return {
      kind: "array-from",
      length: resolveExpression(
        script,
        expression.length,
        localNames,
      ),
      indexName: expression.indexName,
      body: resolveExpression(
        script,
        expression.body,
        callbackNames,
      ),
    };
  };

  for (const script of scripts) {
    for (const binding of script.safeConfigBindings ?? []) {
      try {
        const value = resolveBindingValue(
          script,
          binding.name,
        );
        resolvedBindings.push({
          scriptId: script.identifier,
          name: binding.name,
          value,
          source: binding.source,
        });

        // Map authors may declare a fixed named arena roster instead of
        // ARENA_COUNT. Do not turn an unrecognized array or runtime list into
        // a capacity or spatial proof. Generated `var` goes through the
        // existing mutation/shadow checks in the safe-config compiler.
        if (ARENA_ENABLED_IDS_NAME.test(binding.name)) {
          const arenaIds = asEnabledArenaIds(value);
          if (arenaIds === undefined) {
            malformedArenaIdOrOffsets = true;
          } else {
            arenaIdCandidates.push({
              scriptId: script.identifier,
              name: binding.name,
              arenaIds,
              source: binding.source,
            });
            arenaCountCandidates.push({
              scriptId: script.identifier,
              name: binding.name,
              value: arenaIds.length,
              source: binding.source,
            });
          }
        }
        // Numeric X offsets or complete 3D keyed offsets are *relative*;
        // an omitted world anchor must never be fabricated from them.
        if (ARENA_KEYED_OFFSETS_NAME.test(binding.name) &&
            !Array.isArray(value)) {
          const arenaIds = asKeyedArenaOffsets(value);
          if (arenaIds === undefined) {
            malformedArenaIdOrOffsets = true;
          } else {
            arenaOffsetKeyCandidates.push({
              scriptId: script.identifier,
              name: binding.name,
              arenaIds,
              source: binding.source,
            });
          }
        }

        if (
          ARENA_COUNT_NAME.test(binding.name) &&
          typeof value === "number" &&
          Number.isInteger(value) &&
          value > 0
        ) {
          arenaCountCandidates.push({
            scriptId: script.identifier,
            name: binding.name,
            value,
            source: binding.source,
          });
        }

        if (
          ARENA_CONCURRENCY_NAME.test(binding.name) &&
          typeof value === "number" &&
          Number.isInteger(value) &&
          value > 0
        ) {
          arenaConcurrencyCandidates.push({
            scriptId: script.identifier,
            name: binding.name,
            value,
            source: binding.source,
          });
        }

        const points = asVectorSeries(value);
        const layoutMode =
          ARENA_ABSOLUTE_LAYOUT_NAME.test(binding.name)
            ? "absolute-centers" as const
            : ARENA_OFFSET_LAYOUT_NAME.test(binding.name)
              ? "relative-offsets" as const
              : undefined;
        if (points && layoutMode) {
          arenaLayoutCandidates.push({
            scriptId: script.identifier,
            name: binding.name,
            mode: layoutMode,
            points,
            source: binding.source,
          });
        }
      } catch (error) {
        failedBindings.push({
          scriptId: script.identifier,
          name: binding.name,
          reason:
            error instanceof Error
              ? error.message
              : String(error),
          source: binding.source,
        });
      }
    }
  }

  // A shadowed, dynamic or invalid enabled-list/offset declaration must not
  // silently certify the one remaining source as a complete authored roster.
  const failedAuthoredArenaSources = failedBindings.some(item =>
    ARENA_ENABLED_IDS_NAME.test(item.name) ||
    ARENA_KEYED_OFFSETS_NAME.test(item.name));
  const idSignatures = [...new Set(arenaIdCandidates.map(candidate =>
    JSON.stringify([...candidate.arenaIds].sort())))];
  const arenaAuthoredIdConflict = malformedArenaIdOrOffsets ||
    failedAuthoredArenaSources || idSignatures.length > 1 ||
    (idSignatures.length === 1 && arenaOffsetKeyCandidates.some(candidate =>
      JSON.stringify(candidate.arenaIds) !== idSignatures[0]));

  const distinctArenaCounts = [
    ...new Set(
      arenaCountCandidates.map((item) => item.value),
    ),
  ].sort((a, b) => a - b);

  const distinctArenaConcurrencyLimits = [
    ...new Set(
      arenaConcurrencyCandidates.map(
        (item) => item.value,
      ),
    ),
  ].sort((a, b) => a - b);
  const arenaConcurrencyConflict =
    distinctArenaConcurrencyLimits.length > 1;
  const resolvedArenaConcurrencyLimit =
    arenaConcurrencyConflict ||
    distinctArenaConcurrencyLimits.length === 0
      ? undefined
      : distinctArenaConcurrencyLimits[0];

  const distinctLayouts = [
    ...new Map(
      arenaLayoutCandidates.map((item) => [
        normalizedLayoutKey(item),
        item,
      ]),
    ).entries(),
  ];
  const arenaLayoutConflict = distinctLayouts.length > 1;
  const representativeLayout =
    distinctLayouts.length === 1
      ? distinctLayouts[0]![1]
      : undefined;
  const layoutArenaCount =
    representativeLayout?.points.length;
  const countFromNames =
    distinctArenaCounts.length === 1
      ? distinctArenaCounts[0]
      : undefined;
  const arenaCountConflict =
    arenaAuthoredIdConflict ||
    distinctArenaCounts.length > 1 ||
    (
      countFromNames !== undefined &&
      layoutArenaCount !== undefined &&
      countFromNames !== layoutArenaCount
    );
  const resolvedArenaCount =
    arenaCountConflict
      ? undefined
      : countFromNames ?? layoutArenaCount;

  const resolvedArenaLayout =
    representativeLayout === undefined ||
    arenaLayoutConflict
      ? undefined
      : {
          mode: representativeLayout.mode,
          arenaCount: representativeLayout.points.length,
          ...(representativeLayout.mode === "absolute-centers"
            ? {
                canonicalAnchor:
                  representativeLayout.points[0],
              }
            : {}),
          offsets: representativeLayout.points.map((point) => ({
            x: point.x - representativeLayout.points[0]!.x,
            y: point.y - representativeLayout.points[0]!.y,
            z: point.z - representativeLayout.points[0]!.z,
          })),
          sourceNames: arenaLayoutCandidates
            .filter((item) =>
              normalizedLayoutKey(item) ===
              normalizedLayoutKey(representativeLayout)
            )
            .map((item) => item.name)
            .sort(),
        } satisfies ScriptArenaLayout;

  return {
    compiledBindings: scripts.reduce(
      (sum, script) =>
        sum + (script.safeConfigBindings?.length ?? 0),
      0,
    ),
    rejectedBindings: scripts.reduce(
      (sum, script) =>
        sum + (script.safeConfigRejected?.length ?? 0),
      0,
    ),
    crossFileResolvedBindings,
    resolvedBindings: resolvedBindings.sort((a, b) =>
      a.scriptId.localeCompare(b.scriptId) ||
      a.name.localeCompare(b.name)
    ),
    failedBindings: failedBindings.sort((a, b) =>
      a.scriptId.localeCompare(b.scriptId) ||
      a.name.localeCompare(b.name)
    ),
    arenaCountCandidates: arenaCountCandidates.sort((a, b) =>
      a.scriptId.localeCompare(b.scriptId) ||
      a.name.localeCompare(b.name)
    ),
    arenaIdCandidates: arenaIdCandidates.sort((a,b) =>
      a.scriptId.localeCompare(b.scriptId) || a.name.localeCompare(b.name)),
    arenaOffsetKeyCandidates: arenaOffsetKeyCandidates.sort((a,b) =>
      a.scriptId.localeCompare(b.scriptId) || a.name.localeCompare(b.name)),
    arenaAuthoredIdConflict,
    arenaConcurrencyCandidates:
      arenaConcurrencyCandidates.sort((a, b) =>
        a.scriptId.localeCompare(b.scriptId) ||
        a.name.localeCompare(b.name)
      ),
    arenaLayoutCandidates: arenaLayoutCandidates.sort((a, b) =>
      a.scriptId.localeCompare(b.scriptId) ||
      a.name.localeCompare(b.name)
    ),
    ...(resolvedArenaCount === undefined
      ? {}
      : { resolvedArenaCount }),
    ...(resolvedArenaConcurrencyLimit === undefined
      ? {}
      : { resolvedArenaConcurrencyLimit }),
    ...(resolvedArenaLayout === undefined
      ? {}
      : { resolvedArenaLayout }),
    arenaCountConflict,
    arenaConcurrencyConflict,
    arenaLayoutConflict,
  };
}
