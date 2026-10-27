import type {
  ParsedScriptFile,
  ScriptMethodCall,
  CrossFileCallEdge,
  ScriptArgumentParameterBinding,
} from "../../../../analyzers/scripts/src/index.js";
import type {
  SourceRef,
  StateAuthorityContract,
  StateSurfaceKind,
} from "../../../project-model/src/index.js";

export type ArenaStateScope =
  | "arena-local"
  | "player-local"
  | "entity-local"
  | "world-global"
  | "module-shared"
  | "unknown";

export type ArenaStateIsolationStatus =
  | "isolated"
  | "partition-proof-required"
  | "shared-global"
  | "unknown";

export interface ArenaStateIsolationObservation {
  scriptId: string;
  region: string;
  surface:
    | "dynamic-property"
    | "scoreboard"
    | "world-property"
    | "world-command"
    | "world-player-enumeration"
    | "dimension-entity-enumeration"
    | "entity-tag"
    | "module-state";
  key: string;
  scope: ArenaStateScope;
  status: ArenaStateIsolationStatus;
  reason: string;
  /** Exact owning artifact/module, never inferred from a script identifier. */
  source?: SourceRef;
  authorityContractIds?: readonly string[];
}

export interface ArenaStateIsolationAnalysis {
  arenaRegions: number;
  observations: readonly ArenaStateIsolationObservation[];
  isolated: number;
  partitionProofRequired: number;
  sharedGlobal: number;
  unknown: number;
}

function graphFor(
  script: ParsedScriptFile,
): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();
  for (const call of script.localFunctionCalls) {
    const targets =
      graph.get(call.callerRegion) ??
      new Set<string>();
    targets.add(call.targetRegion);
    graph.set(call.callerRegion, targets);
  }
  return graph;
}

function reachable(
  graph: ReadonlyMap<string, ReadonlySet<string>>,
  roots: readonly string[],
): Set<string> {
  const seen = new Set<string>(roots);
  const queue = [...roots];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of graph.get(current) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return seen;
}

function arenaRegionOf(
  path: NonNullable<ParsedScriptFile["arenaAuthorityPaths"]>[number],
): string {
  return path.parserExecutionRegion ?? path.executionRegion;
}

function arenaRegions(
  script: ParsedScriptFile,
): Set<string> {
  const roots = [
    ...new Set(
      (script.arenaAuthorityPaths ?? [])
        .map(arenaRegionOf),
    ),
  ];
  return reachable(graphFor(script), roots);
}

/** Source-only arena reachability across the canonical resolved ESM call sites.
 * A reachable callee is not proof that the caller's arena/player argument is
 * the callee's actual instance, that a guard executes or that state is safe.
 */
function arenaRegionsAcrossScripts(
  scripts: readonly ParsedScriptFile[],
  calls: readonly CrossFileCallEdge[],
): {
  regions: Map<ParsedScriptFile, Set<string>>;
  forwarded: Map<ParsedScriptFile, Map<string, readonly string[]>>;
} {
  type Region = { script: ParsedScriptFile; region: string };
  type ImportedRegion = Region & { call: CrossFileCallEdge };
  type Origin = { role: "arena" | "player"; root: string; rootName: string };
  type Context = Region & { aliases: ReadonlyMap<string, Origin> };
  const scopes = new Map<ParsedScriptFile, Set<string>>(
    scripts.map(script => [script, new Set<string>()]),
  );
  const local = new Map(scripts.map(script => [script, graphFor(script)]));
  // Duplicate module paths (even from different revisions) cannot own an
  // unambiguous cross-file edge. Lexical script identifiers are not owners.
  const byPath = new Map<string, ParsedScriptFile[]>();
  const pathOf = (path: string) => path.replaceAll("\\", "/");
  const packOf = (path: string): string | undefined => {
    const segments = pathOf(path).split("/");
    return (segments[0] === "behavior_packs" || segments[0] === "resource_packs")
      && segments.length > 2 ? segments.slice(0, 2).join("/") : undefined;
  };
  for (const script of scripts) {
    if (!script.source?.relativePath) continue;
    const path = pathOf(script.source.relativePath);
    byPath.set(path, [...(byPath.get(path) ?? []), script]);
  }
  const unique = (path: string): ParsedScriptFile | undefined => {
    const candidates = byPath.get(pathOf(path)) ?? [];
    return candidates.length === 1 ? candidates[0] : undefined;
  };

  const imported = new Map<ParsedScriptFile, Map<string, ImportedRegion[]>>();
  for (const call of calls) {
    if (call.status !== "resolved" || !call.targetModule || !call.targetRegion) {
      continue;
    }
    const caller = unique(call.callerModule);
    const target = unique(call.targetModule);
    if (!caller?.source || !target?.source ||
        caller.source.artifactId !== target.source.artifactId ||
        caller.source.artifactId !== call.source.artifactId ||
        pathOf(caller.source.relativePath) !== pathOf(call.source.relativePath) ||
        packOf(caller.source.relativePath) !== packOf(target.source.relativePath)) {
      continue;
    }
    // Do not trust a standalone "resolved" flag without one exact, current
    // parser-recognized imported call site and its complete source range.
    const exactSites = (caller.importedCallGuardSites ?? []).filter(site =>
      site.executionRegion === call.callerRegion &&
      sameExactCallSite(site.source, call.source));
    if (exactSites.length !== 1) continue;

    const from = imported.get(caller) ?? new Map<string, ImportedRegion[]>();
    const links = from.get(call.callerRegion) ?? [];
    links.push({ script: target, region: call.targetRegion, call });
    from.set(call.callerRegion, links);
    imported.set(caller, from);
  }

  const queue: Region[] = [];
  const admit = (next: Region): void => {
    const regions = scopes.get(next.script);
    if (!regions || regions.has(next.region)) return;
    regions.add(next.region);
    queue.push(next);
  };
  for (const script of scripts) {
    for (const root of script.arenaAuthorityPaths ?? []) {
      admit({ script, region: arenaRegionOf(root) });
    }
  }
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const item = queue[cursor]!;
    for (const region of local.get(item.script)?.get(item.region) ?? []) {
      admit({ script: item.script, region });
    }
    for (const target of imported.get(item.script)?.get(item.region) ?? []) {
      admit(target);
    }
  }
  // Source argument aliases are propagated over the SAME canonical imported
  // edge set. Local function calls remain reachable, but without a verified
  // actual/formal binding they intentionally lose identity evidence.
  const contexts = new Map<ParsedScriptFile,
    Map<string, ReadonlyMap<string, Origin>[]>>();
  const aliasQueue: Context[] = [];
  const seenAliases = new Set<string>();
  let exceeded = false;
  const admitAlias = (next: Context): void => {
    if (!scopes.get(next.script)?.has(next.region)) return;
    const signature = JSON.stringify([
      next.script.source?.artifactId, next.script.source?.relativePath,
      next.region, [...next.aliases.entries()].sort(([a], [b]) => a.localeCompare(b))
        .map(([name, origin]) => [name, origin.role, origin.root]),
    ]);
    if (seenAliases.has(signature)) return;
    if (seenAliases.size >= 512) {
      exceeded = true;
      return;
    }
    seenAliases.add(signature);
    const byRegion = contexts.get(next.script) ??
      new Map<string, ReadonlyMap<string, Origin>[]>();
    byRegion.set(next.region, [
      ...(byRegion.get(next.region) ?? []), next.aliases,
    ]);
    contexts.set(next.script, byRegion);
    aliasQueue.push(next);
  };
  const plain = (name: string) => /^[A-Za-z_$][\w$]*$/.test(name);
  for (const script of scripts) {
    for (const root of script.arenaAuthorityPaths ?? []) {
      const aliases = new Map<string, Origin>();
      const rootKey = [
        script.source?.artifactId, script.source?.relativePath,
        arenaRegionOf(root), root.arenaExpression,
      ].join(":");
      if (plain(root.arenaExpression)) {
        aliases.set(root.arenaExpression, {
          role: "arena", root: rootKey, rootName: root.arenaExpression,
        });
      }
      const member = root.membershipCommit?.subjectExpression ??
        root.membershipRelease?.subjectExpression;
      if (member && plain(member) && member !== root.arenaExpression) {
        aliases.set(member, {
          role: "player", root: rootKey + ":" + member, rootName: member,
        });
      }
      admitAlias({ script, region: arenaRegionOf(root), aliases });
    }
  }
  for (let cursor = 0; cursor < aliasQueue.length; cursor += 1) {
    const entry = aliasQueue[cursor]!;
    const mappedAliases = (
      target: ParsedScriptFile,
      source: SourceRef,
      bindings: readonly ScriptArgumentParameterBinding[],
    ): Map<string, Origin> => {
      const mapped = new Map<string, Origin>();
      const names = bindings.map(item => item.parameterName);
      const indices = bindings.map(item => item.index);
      if (new Set(names).size !== names.length ||
          new Set(indices).size !== indices.length) return mapped;
      const callerSource = entry.script.source;
      const targetSource = target.source;
      const outer = source.range;
      if (!callerSource || !targetSource || !outer ||
          source.artifactId !== callerSource.artifactId ||
          pathOf(source.relativePath) !== pathOf(callerSource.relativePath) ||
          outer.lineStart === undefined || outer.lineEnd === undefined ||
          outer.columnStart === undefined || outer.columnEnd === undefined) {
        return mapped;
      }
      for (const binding of bindings) {
        const origin = entry.aliases.get(binding.argumentName);
        const a = binding.argumentSource;
        const p = binding.parameterSource;
        const ar = a.range;
        const pr = p.range;
        if (!origin || !plain(binding.argumentName) ||
            !plain(binding.parameterName) ||
            !Number.isInteger(binding.index) || binding.index < 0 ||
            a.artifactId !== callerSource.artifactId ||
            pathOf(a.relativePath) !== pathOf(callerSource.relativePath) ||
            a.jsonPointer !== source.jsonPointer ||
            p.artifactId !== targetSource.artifactId ||
            pathOf(p.relativePath) !== pathOf(targetSource.relativePath) ||
            !ar || !pr ||
            ar.lineStart === undefined || ar.lineEnd === undefined ||
            ar.columnStart === undefined || ar.columnEnd === undefined ||
            pr.lineStart === undefined || pr.lineEnd === undefined ||
            pr.columnStart === undefined || pr.columnEnd === undefined ||
            ar.lineStart < outer.lineStart || ar.lineEnd > outer.lineEnd ||
            (ar.lineStart === outer.lineStart &&
             ar.columnStart < outer.columnStart) ||
            (ar.lineEnd === outer.lineEnd &&
             ar.columnEnd > outer.columnEnd) ||
            (binding.viaConstAliases ?? []).some(alias =>
              alias.source.artifactId !== callerSource.artifactId ||
              pathOf(alias.source.relativePath) !==
                pathOf(callerSource.relativePath) ||
              alias.source.range?.lineStart === undefined)) {
          continue;
        }
        mapped.set(binding.parameterName, origin);
      }
      return mapped;
    };
    for (const call of entry.script.localFunctionCalls) {
      if (call.callerRegion !== entry.region) continue;
      // Local reachability is not an actual/formal alias by itself.
      const mapped = mappedAliases(entry.script, call.source,
        call.argumentParameterBindings ?? []);
      admitAlias({ script: entry.script, region: call.targetRegion,
        aliases: mapped });
    }
    for (const destination of imported.get(entry.script)?.get(entry.region) ?? []) {
      const mapped = mappedAliases(destination.script, destination.call.source,
        destination.call.argumentParameterBindings ?? []);
      admitAlias({ script: destination.script, region: destination.region,
        aliases: mapped });
    }
  }

  const forwarded = new Map<ParsedScriptFile, Map<string, readonly string[]>>();
  // Every incoming path must carry the same source root for an identity note.
  // Any alternative missing/contradicting it (or a path-budget overflow)
  // eliminates this witness, without losing ordinary arena reachability.
  if (!exceeded) {
    for (const [script, regions] of contexts) {
      const perRegion = new Map<string, readonly string[]>();
      for (const [region, values] of regions) {
        // Root authority is not a forwarded parameter witness.
        if ((script.arenaAuthorityPaths ?? [])
          .some(path => arenaRegionOf(path) === region)) continue;
        const names = new Set(values.flatMap(aliases => [...aliases.keys()]));
        const messages: string[] = [];
        for (const name of [...names].sort()) {
          if (!values.every(aliases => aliases.has(name))) continue;
          const origins = values.map(aliases => aliases.get(name)!);
          if (!origins.every(item => item.role === origins[0]!.role &&
              item.root === origins[0]!.root)) continue;
          const origin = origins[0]!;
          messages.push(
            "Exact source argument-to-parameter forwarding: " +
            origin.role + " parameter " + origin.rootName +
            " reaches " + name + " (origin " + origin.root +
            "). This is source reference association only; live instance, " +
            "storage key uniqueness and runtime partition are unverified."
          );
        }
        if (messages.length) perRegion.set(region, messages.slice(0, 4));
      }
      if (perRegion.size) forwarded.set(script, perRegion);
    }
  }
  return { regions: scopes, forwarded };
}

/**
 * Match the existing parser's typed API-call evidence to THIS dynamic
 * property operation. Two matching file/line labels are insufficient: the
 * complete call span, owning artifact, module, region, method and receiver
 * expression must agree, and the typed call must be unique.
 */
function sameExactCallSite(left: SourceRef, right: SourceRef): boolean {
  const a = left.range;
  const b = right.range;
  return left.artifactId === right.artifactId &&
    left.relativePath === right.relativePath &&
    left.jsonPointer === right.jsonPointer &&
    a?.lineStart !== undefined && a.lineEnd !== undefined &&
    a.columnStart !== undefined && a.columnEnd !== undefined &&
    b?.lineStart !== undefined && b.lineEnd !== undefined &&
    b.columnStart !== undefined && b.columnEnd !== undefined &&
    a.lineStart === b.lineStart && a.lineEnd === b.lineEnd &&
    a.columnStart === b.columnStart && a.columnEnd === b.columnEnd;
}

function resolveDynamicReceiver(
  script: ParsedScriptFile,
  access: ParsedScriptFile["dynamicProperties"][number],
): {
  scope: ArenaStateScope;
  kind: "World" | "Player" | "Entity" | "unresolved";
  basis: "EXACT_TYPED_CALL_SITE" | "STABLE_WORLD_IMPORT" | "UNRESOLVED";
} {
  const method = access.operation === "get" ? "getDynamicProperty"
    : access.operation === "set" ? "setDynamicProperty"
    : access.operation === "clear" ? "clearDynamicProperties"
    : access.operation === "ids" ? "getDynamicPropertyIds"
    : access.operation === "size" ? "getDynamicPropertyTotalByteCount"
    : undefined;
  // Unique typed calls are source-side receiver classifications only. A
  // Player API type still does NOT prove which player instance was targeted.
  const candidates = method === undefined ? [] :
    script.methodCalls.filter(call =>
      call.method === method &&
      (call.receiverType === "World" ||
       call.receiverType === "Player" ||
       call.receiverType === "Entity") &&
      call.receiverHint === access.receiverHint &&
      (call.executionRegion ?? "module") ===
        (access.executionRegion ?? "module") &&
      access.source !== undefined &&
      call.source !== undefined &&
      sameExactCallSite(call.source, access.source));
  if (candidates.length > 1) {
    return { scope: "unknown", kind: "unresolved", basis: "UNRESOLVED" };
  }
  // The parser already records exact unshadowed ESM world-singleton
  // provenance for this statement; unlike spelling, this is admissible.
  if (access.sourceSequence?.stableWorldReceiver === true) {
    return { scope: "world-global", kind: "World",
      basis: "STABLE_WORLD_IMPORT" };
  }
  const call = candidates[0];
  if (!call) {
    return { scope: "unknown", kind: "unresolved", basis: "UNRESOLVED" };
  }
  // A shadowed identifier named "world" can be accepted as World by the
  // parser's broad singleton fallback. Without stable import provenance
  // that is not enough to identify a world receiver.
  if (access.receiverHint === "world" && call.receiverType === "World") {
    return { scope: "unknown", kind: "unresolved", basis: "UNRESOLVED" };
  }
  const kind = call.receiverType;
  if (kind !== "World" && kind !== "Player" && kind !== "Entity") {
    return { scope: "unknown", kind: "unresolved", basis: "UNRESOLVED" };
  }
  const scope: ArenaStateScope = kind === "World"
    ? "world-global" : kind === "Player"
      ? "player-local" : "entity-local";
  return { scope, kind, basis: "EXACT_TYPED_CALL_SITE" };
}

function normalizedExpression(
  value: string,
): string {
  return value
    .replace(/\s+/g, "")
    .toLowerCase();
}

function escapedRegex(
  value: string,
): string {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
}

function expressionUsesAuthority(
  expression: string | undefined,
  authorities: readonly string[],
): boolean {
  if (!expression) return false;
  const normalized =
    normalizedExpression(expression);

  return authorities.some((authority) => {
    const candidate =
      normalizedExpression(authority);
    if (!candidate) return false;

    // A qualified receiver such as "arena.id" must not match the tail
    // of "otherarena.id"; this would silently promote an unrelated world's
    // dynamic property / scoreboard owner to isolated. Match complete
    // authored expression tokens for both simple and dotted identifiers.
    const token = new RegExp(
      "(^|[^a-z0-9_$])" + escapedRegex(candidate) +
        "(?=$|[^a-z0-9_$])",
      "i",
    );
    return token.test(normalized);
  });
}
function scoreboardObservation(
  script: ParsedScriptFile,
  call: ScriptMethodCall,
  region: string,
  authorities: readonly string[],
): ArenaStateIsolationObservation | undefined {
  if (
    call.receiverType !== "ScoreboardObjective" ||
    ![
      "setScore",
      "addScore",
      "removeParticipant",
    ].includes(call.method)
  ) {
    return undefined;
  }

  const participant =
    call.argumentTexts?.[0];

  if (
    expressionUsesAuthority(
      participant,
      authorities,
    )
  ) {
    return {
      scriptId: script.identifier,
      region,
      surface: "scoreboard",
      key:
        call.symbol +
        ":" +
        participant,
      scope: "arena-local",
      status: "isolated",
      reason:
        "Scoreboard participant expression is explicitly keyed by the authored arena authority expression.",
    };
  }

  return {
    scriptId: script.identifier,
    region,
    surface: "scoreboard",
    key:
      call.symbol +
      ":" +
      (participant ?? "*"),
    scope: "world-global",
    status: "partition-proof-required",
    reason:
      "Scoreboard objective is world-shared and the participant expression does not prove arena/player partitioning.",
  };
}

function worldPlayerEnumerationObservation(
  script: ParsedScriptFile,
  call: ScriptMethodCall,
  region: string,
  authorities: readonly string[],
): ArenaStateIsolationObservation | undefined {
  if (
    call.receiverType !== "World" ||
    !["getPlayers", "getAllPlayers"].includes(call.method)
  ) {
    return undefined;
  }

  const query =
    (call.argumentTexts ?? []).join(" ");
  const authoredFilter = call.method === "getPlayers" &&
    /(?:^|[,{]\s*)(?:tags|location|volume|maxDistance|minDistance|name)\s*:/i
      .test(query);
  const authorityPartitioned = authoredFilter &&
    expressionUsesAuthority(query, authorities);

  return {
    scriptId: script.identifier,
    region,
    surface: "world-player-enumeration",
    key:
      call.symbol +
      "(" +
      query +
      ")",
    scope:
      authorityPartitioned
        ? "arena-local"
        : "world-global",
    // Source mention of arena authority is a filter CANDIDATE, not a proof
    // that queried players belong to this one arena or that later mutation
    // uses that same filtered result. Never close multiplayer isolation here.
    status: "partition-proof-required",
    reason:
      authorityPartitioned
        ? "The authored world-player query references an arena authority expression, but player membership, distinct arena IDs and downstream mutation ownership remain unverified. This is a source partition candidate, not isolation proof."
        : "Arena flow enumerates world players without proving arena partitioning. Downstream player/tag/state mutations must prove an arena filter or arena-context proxy before isolation can close."
  };
}

/** A typed Dimension query is an authored enumeration, not a verified
 * entity-owner filter or executed cleanup. Tag/spatial mention in the
 * current arena region can guide inspection but cannot prove exclusion
 * of entities from a sibling arena or an unloaded chunk.
 */
function dimensionEntityEnumerationObservation(
  script: ParsedScriptFile,
  call: ScriptMethodCall,
  region: string,
  authorities: readonly string[],
): ArenaStateIsolationObservation | undefined {
  if (call.receiverType !== "Dimension" ||
      call.method !== "getEntities") return undefined;

  const query = (call.argumentTexts ?? []).join(" ");
  const tagFilter = /(?:^|[,{]\s*)tags\s*:/i.test(query);
  const spatialFilter =
    /(?:^|[,{]\s*)(?:location|volume|maxDistance|minDistance)\s*:/i
      .test(query);
  const arenaCandidate = (tagFilter || spatialFilter) &&
    expressionUsesAuthority(query, authorities);

  return {
    scriptId: script.identifier,
    region,
    surface: "dimension-entity-enumeration",
    key: call.symbol + "(" + query + ")",
    scope: arenaCandidate ? "arena-local" : "world-global",
    status: "partition-proof-required",
    reason: arenaCandidate
      ? "An authored Dimension.getEntities query contains an arena identity and " +
        (tagFilter && spatialFilter ? "tag plus spatial" :
         tagFilter ? "tag" : "spatial") +
        " filter expressions. This is only a source partition candidate; " +
        "unique arena tags, entity owner membership, query volume, unload " +
        "handling and subsequent remove/kill target identity remain unverified."
      : "An arena-associated Dimension.getEntities call lacks a source-verifiable " +
        "arena-specific tag or spatial partition. Its returned entities and " +
        "downstream cleanup may span other arenas; require exact query, " +
        "membership, region and effect evidence before closing isolation.",
  };
}

function tagMutationObservation(
  script: ParsedScriptFile,
  call: ScriptMethodCall,
  region: string,
  authorities: readonly string[],
): ArenaStateIsolationObservation | undefined {
  if (
    !["addTag", "removeTag"].includes(call.method) ||
    !/(?:Player|Entity)$/i.test(call.receiverType ?? "")
  ) {
    return undefined;
  }

  const tagExpression =
    call.argumentTexts?.[0];
  if (!tagExpression) {
    return {
      scriptId: script.identifier,
      region,
      surface: "entity-tag",
      key: call.symbol + "(*)",
      scope: "unknown",
      status: "partition-proof-required",
      reason:
        "Arena flow mutates a player/entity tag but the tag expression is unresolved. Prove receiver scope and tag ownership before cross-arena isolation can close.",
    };
  }

  const authorityPartitioned =
    expressionUsesAuthority(
      tagExpression,
      authorities,
    );

  return {
    scriptId: script.identifier,
    region,
    surface: "entity-tag",
    key:
      call.symbol +
      "(" +
      tagExpression +
      ")",
    scope:
      authorityPartitioned
        ? "arena-local"
        : "unknown",
    // A tag NAME with an arena token does not prove the target entity is
    // owned by that arena. Keep the source-keyed candidate but no PASS.
    status: "partition-proof-required",
    reason:
      authorityPartitioned
        ? "Authored player/entity tag label contains an arena authority expression, but receiver entity identity and sibling-arena exclusion remain unverified."
        : "Arena flow mutates a player/entity tag without proving the tag or receiver is arena-partitioned. Generic tags are world-visible and cleanup/reconciliation must prove they cannot affect another arena.",
  };
}

function commandObservation(
  script: ParsedScriptFile,
  command: ParsedScriptFile["commandLiterals"][number],
  authorities: readonly string[],
): ArenaStateIsolationObservation | undefined {
  const raw = command.command.trim().replace(/^\//, "");
  const head = raw.split(/\s+/)[0]?.toLowerCase();

  if (
    head === "gamerule" ||
    head === "difficulty" ||
    head === "time" ||
    head === "weather"
  ) {
    return {
      scriptId: script.identifier,
      region: command.executionRegion ?? "module",
      surface: "world-command",
      key: raw,
      scope: "world-global",
      status: "shared-global",
      reason:
        "The command mutates world-global behavior and can affect concurrent arenas unless ownership/arbitration is proven.",
    };
  }

  if (head === "tickingarea") {
    const authorityPartitioned =
      expressionUsesAuthority(raw, authorities);

    return {
      scriptId: script.identifier,
      region: command.executionRegion ?? "module",
      surface: "world-command",
      key: raw,
      scope: authorityPartitioned ? "arena-local" : "world-global",
      status: authorityPartitioned ? "isolated" : "partition-proof-required",
      reason: authorityPartitioned
        ? "Ticking-area command includes the authored arena authority expression, providing arena-specific resource partitioning."
        : "Ticking-area names are world-shared resources. Arena flow using a non-partitioned name requires proof that concurrent arenas cannot remove or replace another arena's residency resource.",
    };
  }

  const targetsAllPlayers =
    /(^|\s)@a(?:\[|\b)/i.test(raw);
  const mutatesPlayerOrWorld =
    /(?:^|\s)(?:fill|setblock|clone|tag|kill|tp|teleport|clear|give|effect|gamemode|scoreboard)\b/i.test(
      raw,
    );

  if (targetsAllPlayers && mutatesPlayerOrWorld) {
    const authorityPartitioned =
      expressionUsesAuthority(raw, authorities);

    return {
      scriptId: script.identifier,
      region: command.executionRegion ?? "module",
      surface: "world-command",
      key: raw,
      scope: authorityPartitioned ? "arena-local" : "world-global",
      status: "partition-proof-required",
      reason: authorityPartitioned
        ? "The authored global-selector command references an arena authority expression, but the selector's actual player set and arena membership exclusion are not proven by that text alone."
        : "Arena flow mutates players or nearby world state through a global @a selector. Arena-context translation or an equivalent partitioning guard must be proven before cross-arena isolation can close.",
    };
  }

  return undefined;
}

function analyzeScript(
  script: ParsedScriptFile,
  regions: Set<string> = arenaRegions(script),
  forwarded: ReadonlyMap<string, readonly string[]> = new Map(),
): {
  regions: Set<string>;
  observations: ArenaStateIsolationObservation[];
} {
  const directlyReached = arenaRegions(script);
  const importedOnly = new Set(
    [...regions].filter(region => !directlyReached.has(region)),
  );
  // Authority expressions only prove ownership within their execution region.
  const authoritiesForRegion = (region: string): readonly string[] => [
    ...new Set(
      (script.arenaAuthorityPaths ?? [])
        .filter((item) => arenaRegionOf(item) === region)
        .map((item) => item.arenaExpression)
        .filter(Boolean),
    ),
  ];
  const observations: ArenaStateIsolationObservation[] = [];

  for (const access of script.dynamicProperties) {
    if (
      access.operation !== "set" &&
      access.operation !== "delete" &&
      access.operation !== "clear"
    ) {
      continue;
    }
    const region = access.executionRegion ?? "module";
    if (!regions.has(region)) continue;
    // Normal parsed records always have source owners. Older/synthetic
    // partial fixtures must stay UNKNOWN rather than throwing. When both
    // owners exist, a foreign nested operation cannot enter this analysis.
    if (access.source && script.source &&
        (access.source.artifactId !== script.source.artifactId ||
         access.source.relativePath !== script.source.relativePath)) continue;

    const receiver = resolveDynamicReceiver(script, access);
    const keyExpression =
      access.propertyExpression ??
      access.propertyId;

    const authorityPartitioned =
      receiver.basis === "STABLE_WORLD_IMPORT" &&
      expressionUsesAuthority(
        keyExpression,
        authoritiesForRegion(region),
      );
    const scope: ArenaStateScope =
      authorityPartitioned ? "arena-local" : receiver.scope;

    observations.push({
      scriptId: script.identifier,
      region,
      surface: "dynamic-property",
      key:
        (access.receiverHint ?? "unknown") +
        ":" +
        (
          access.propertyId ??
          access.propertyExpression ??
          "*"
        ),
      scope,
      source: access.source,
      status: authorityPartitioned
        ? "isolated" : "partition-proof-required",
      reason: authorityPartitioned
        ? "World dynamic-property key expression is explicitly partitioned by the authored arena authority expression. Static source claim only; uniqueness and runtime isolation remain unverified."
        : receiver.basis === "EXACT_TYPED_CALL_SITE"
          ? "Exact parser-typed " + receiver.kind +
            " dynamic-property call at the same authored site (" +
            receiver.basis + "). Receiver API type describes the source " +
            "surface, not a unique live player/entity/world instance, " +
            "arena partition, or successful state mutation."
          : scope === "world-global"
            ? "An unshadowed imported Minecraft world singleton owns this dynamic-property source site; globally shared storage requires source partition proof."
            : "Dynamic-property receiver lacks one trustworthy typed call at the exact selected source site; lexical player/arena/session names and unproven aliases cannot establish instance scope.",
    });
  }

  for (const call of script.methodCalls) {
    const region = call.executionRegion ?? "module";
    if (!regions.has(region)) continue;
    const scoreboard = scoreboardObservation(
      script,
      call,
      region,
      authoritiesForRegion(region),
    );
    if (scoreboard) observations.push({ ...scoreboard, source: call.source });

    const playerEnumeration =
      worldPlayerEnumerationObservation(
        script,
        call,
        region,
        authoritiesForRegion(region),
      );
    if (playerEnumeration) {
      observations.push({ ...playerEnumeration, source: call.source });
    }

    const entityQuery =
      dimensionEntityEnumerationObservation(
        script,
        call,
        region,
        authoritiesForRegion(region),
      );
    if (entityQuery) {
      observations.push({ ...entityQuery, source: call.source });
    }

    const tagMutation =
      tagMutationObservation(
        script,
        call,
        region,
        authoritiesForRegion(region),
      );
    if (tagMutation) {
      observations.push({ ...tagMutation, source: call.source });
    }
  }

  for (const write of script.propertyWrites) {
    if (
      write.receiverType !== "World" &&
      write.receiverType !== "System"
    ) {
      continue;
    }
    observations.push({
      scriptId: script.identifier,
      region: "module",
      surface: "world-property",
      key: write.symbol,
      source: write.source,
      scope: "world-global",
      status: "shared-global",
      reason:
        "World/System property mutation is process- or world-shared and requires explicit arbitration for concurrent arenas.",
    });
  }

  for (const command of script.commandLiterals) {
    const region = command.executionRegion ?? "module";
    const alreadyRooted = regions.has(region);
    const authoredLoop = command.arenaActiveSessionLoop;
    // A source-observed session/arena loop may contain a global command even
    // if it has no membership/start-authority path. Keep that observation
    // explicitly unproven rather than silently dropping a material mutation.
    if (!alreadyRooted && authoredLoop === undefined) continue;
    const observation = commandObservation(
      script,
      command,
      authoritiesForRegion(region),
    );
    if (!observation) continue;
    const guard = authoredLoop?.guardSource;
    const guardLocator = guard?.range?.lineStart === undefined
      ? "source site unresolved"
      : guard.relativePath + ":" + guard.range.lineStart;
    observations.push({
      ...observation,
      source: command.source,
      reason: observation.reason + (
        !alreadyRooted && authoredLoop !== undefined
          ? " Authored source loop requests a session for its for-of arena " +
            "binding and continues when not active (" + guardLocator +
            "). This is an arena-associated SOURCE CANDIDATE only; " +
            "live arena/player ownership and command execution are unverified."
          : ""
      ),
    });
  }

  for (const mutation of script.stateMutations ?? []) {
    if (!regions.has(mutation.executionRegion)) continue;
    const target = mutation.target;
    const authorityOwned = authoritiesForRegion(mutation.executionRegion)
      .some((authority) => target.startsWith(authority + "."));
    // Variable names containing "arena", "session", or "player" are not
    // evidence of ownership. Only a region-local authority receiver qualifies.
    const scope: ArenaStateScope = authorityOwned
      ? "arena-local"
      : target.includes(".")
        ? "unknown"
        : "module-shared";

    observations.push({
      scriptId: script.identifier,
      region: mutation.executionRegion,
      surface: "module-state",
      key: target,
      source: mutation.source,
      scope,
      status: authorityOwned ? "isolated" : "partition-proof-required",
      reason: authorityOwned
        ? "Mutation receiver matches an authored arena authority in the same execution region."
        : "Mutation target naming alone does not establish arena/player partitioning; ownership proof is required.",
    });
  }

  return {
    regions,
    observations: observations.map(item => ({
      ...item,
      // Preserve exact operation coordinates; use module attribution only
      // as a fallback for partial/legacy observations lacking SourceRef.
      ...(item.source !== undefined || script.source === undefined
        ? {} : { source: script.source }),
      ...(importedOnly.has(item.region) || forwarded.has(item.region) ? {
        reason: item.reason +
          (importedOnly.has(item.region)
            ? " An exact imported source call reaches this arena-associated region. "
            : " An exact local helper call forwards a source parameter into this region. ") +
          (forwarded.get(item.region)?.join(" ") ??
            "Source argument-to-parameter identity is unproven.") +
          " Arena membership, key partition and runtime session " +
          "ownership remain unproven.",
      } : {}),
    })),
  };
}


function contractSurfaceMatches(
  observation: ArenaStateIsolationObservation,
  surface: {
    kind: StateSurfaceKind;
    key: string;
  },
): boolean {
  if (
    observation.surface === "dynamic-property" &&
    surface.kind === "dynamic-property"
  ) {
    return (
      observation.key === surface.key ||
      observation.key.endsWith(
        ":" + surface.key,
      )
    );
  }

  if (
    observation.surface === "scoreboard" &&
    surface.kind === "scoreboard"
  ) {
    return (
      observation.key === surface.key ||
      observation.key.endsWith(":" + surface.key)
    );
  }

  if (
    observation.surface === "module-state" &&
    surface.kind === "script-memory"
  ) {
    return (
      observation.key === surface.key ||
      observation.key.endsWith(
        "." + surface.key,
      )
    );
  }

  return false;
}

function applyAuthorityContracts(
  observations: readonly ArenaStateIsolationObservation[],
  contracts: readonly StateAuthorityContract[],
): ArenaStateIsolationObservation[] {
  // Each observed operation carries its own authoring owner. A scriptId
  // reused across packs/revisions cannot assign another file's contracts.
  return observations.map((observation) => {
    const matches = contracts.filter((contract) => {
      if (
        contract.scope !== "arena" &&
        contract.scope !== "round" &&
        contract.scope !== "player" &&
        contract.scope !== "entity"
      ) {
        return false;
      }

      return [
        contract.authority,
        ...contract.mirrors,
      ].some((surface) =>
        contractSurfaceMatches(
          observation,
          surface,
        )
      );
    });

    if (matches.length === 0) {
      return observation;
    }

    // Contract declarations without source references are claims, not proof.
    // Keep the matched IDs, but never promote unproven metadata to isolation.
    if (matches.some((item) => !item.sourceRefs?.length)) {
      return {
        ...observation,
        scope: "unknown",
        status: "partition-proof-required",
        reason: "Matching state-authority contract lacks source provenance; isolation is not proven.",
        authorityContractIds: [...new Set(matches.map((item) => item.id))].sort(),
      };
    }

    // A supplied SourceRef must at least belong to the analyzed artifact.
    // This is an identity check, not proof that the contract semantics are true.
    if (matches.some((item) =>
      !item.sourceRefs?.length ||
      !item.sourceRefs.some((source) => {
        const owner = observation.source;
        return owner !== undefined &&
          source.artifactId === owner.artifactId &&
          source.relativePath === owner.relativePath;
      })
    )) {
      return {
        ...observation,
        scope: "unknown",
        status: "partition-proof-required",
        reason: "State-authority contract lacks a matching source file for the observed script; isolation is not proven.",
        authorityContractIds: [...new Set(matches.map((item) => item.id))].sort(),
      };
    }

    const scopes = [...new Set(matches.map((item) => item.scope))];
    // Different ownership scopes cannot prove one isolated state surface.
    // Preserve contract IDs so the conflict can be investigated upstream.
    if (scopes.length > 1) {
      return {
        ...observation,
        scope: "unknown",
        status: "partition-proof-required",
        reason: "Matching state-authority contracts disagree on ownership scope; isolation is not proven.",
        authorityContractIds: [...new Set(matches.map((item) => item.id))].sort(),
      };
    }

    // Same-file source metadata establishes attribution, not unique live
    // storage partitions; do not promote unresolved/shared surfaces.
    return {
      ...observation,
      reason: observation.reason +
        " Matching sourced state-authority contract declares " +
        scopes[0] +
        " ownership; file provenance is not per-instance partition proof.",
      authorityContractIds: [...new Set(matches.map((item) => item.id))].sort(),
    };
  });
}

export function analyzeArenaStateIsolation(
  scripts: readonly ParsedScriptFile[],
  contracts: readonly StateAuthorityContract[] = [],
  crossFileCalls: readonly CrossFileCallEdge[] = [],
): ArenaStateIsolationAnalysis {
  const scoped = crossFileCalls.length > 0 ||
    scripts.some(script => script.localFunctionCalls.some(call =>
      (call.argumentParameterBindings?.length ?? 0) > 0))
    ? arenaRegionsAcrossScripts(scripts, crossFileCalls) : undefined;
  const analyzed = scripts.map(script =>
    analyzeScript(script,
      scoped?.regions.get(script) ?? arenaRegions(script),
      scoped?.forwarded.get(script)));
  const observations = applyAuthorityContracts(
    analyzed.flatMap(
      (item) => item.observations,
    ),
    contracts,
  ).sort((a, b) =>
      a.scriptId.localeCompare(b.scriptId) ||
      a.region.localeCompare(b.region) ||
      a.surface.localeCompare(b.surface) ||
      a.key.localeCompare(b.key)
    );

  return {
    arenaRegions: analyzed.reduce(
      (sum, item) => sum + item.regions.size,
      0,
    ),
    observations,
    isolated: observations.filter(
      (item) => item.status === "isolated",
    ).length,
    partitionProofRequired: observations.filter(
      (item) =>
        item.status === "partition-proof-required",
    ).length,
    sharedGlobal: observations.filter(
      (item) => item.status === "shared-global",
    ).length,
    unknown: observations.filter(
      (item) => item.status === "unknown",
    ).length,
  };
}
