import { describe, expect, it } from "vitest";
import { extractArenaConcurrencyCapacity } from "../../src/arena/arena-capacity-extraction.js";
import { parseScriptFile } from "../../../../analyzers/scripts/src/index.js";
import type { ParsedScriptFile } from "../../../../analyzers/scripts/src/index.js";

const absolute = (x: number, y: number, z: number) => ({
  x: { mode: "absolute" as const, value: x },
  y: { mode: "absolute" as const, value: y },
  z: { mode: "absolute" as const, value: z },
});

describe("arena concurrency capacity extraction", () => {
  it("derives command ticking-area per-arena cost from complete translated families", () => {
    const result = extractArenaConcurrencyCapacity({
      discovery: {
        canonical: {
          arenaId: "arena-1",
          anchor: { x: 0, y: 0, z: 0 },
          items: [],
        },
        replicas: [{
          arenaId: "arena-2",
          anchor: { x: 100, y: 0, z: 0 },
          items: [],
        }],
        offsets: [{ x: 100, y: 0, z: 0 }],
        supportByOffset: { "100,0,0": 3 },
        confidence: "medium",
        evidenceCandidates: 3,
      },
      tickingAreas: [
        {
          functionId: "arena/setup",
          semantics: {
            action: "add-circle",
            center: absolute(0, 0, 0),
            radius: 2,
          },
        },
        {
          functionId: "arena/setup",
          semantics: {
            action: "add-circle",
            center: absolute(100, 0, 0),
            radius: 2,
          },
        },
      ],
    });

    expect(result.evidence).toMatchObject({
      requestedConcurrentArenas: 2,
      completeCommandTickingAreaFamilies: 1,
      unmatchedCommandTickingAreaAdds: 0,
      commandTickingAreaResourceResolved: true,
    });
    expect(result.resources).toEqual([{
      id: "command-tickingarea-slots",
      backend: "fixed-pool",
      perArena: 1,
      total: 10,
    }]);
    expect(result.report?.ok).toBe(true);
  });

  it("refuses to infer capacity from incomplete translated families", () => {
    const result = extractArenaConcurrencyCapacity({
      discovery: {
        canonical: {
          arenaId: "arena-1",
          anchor: { x: 0, y: 0, z: 0 },
          items: [],
        },
        replicas: [{
          arenaId: "arena-2",
          anchor: { x: 100, y: 0, z: 0 },
          items: [],
        }],
        offsets: [{ x: 100, y: 0, z: 0 }],
        supportByOffset: { "100,0,0": 3 },
        confidence: "medium",
        evidenceCandidates: 3,
      },
      tickingAreas: [{
        functionId: "arena/setup",
        semantics: {
          action: "add-circle",
          center: absolute(0, 0, 0),
          radius: 2,
        },
      }],
    });

    expect(result.resources).toEqual([]);
    expect(
      result.evidence.commandTickingAreaResourceResolved,
    ).toBe(false);
    expect(result.report?.safeConcurrentArenas).toBeNull();
  });

  it("reports player capacity as evidence without treating it as an arena limiter", () => {
    const script = {
      source: { artifactId: "fixture", relativePath: "scripts/main.ts" },
      arenaAuthorityPaths: [{
        arenaExpression: "arena",
        executionRegion: "function:join",
        capacityAuthorityProven: true,
        startAuthorityProven: false,
        startGuardProven: false,
        membershipCommit: {
          kind: "membership-commit",
          arenaExpression: "arena",
          membershipExpression: "arena.players",
          subjectExpression: "player",
          executionRegion: "function:join",
          source: {
            artifactId: "fixture",
            relativePath: "scripts/main.ts",
            range: { lineStart: 4, columnStart: 1, lineEnd: 4, columnEnd: 25 },
          },
        },
        capacityCheck: {
          kind: "capacity-check",
          arenaExpression: "arena",
          membershipExpression: "arena.players",
          capacityExpression: "5",
          executionRegion: "function:join",
          guardedCommitSource: {
            artifactId: "fixture",
            relativePath: "scripts/main.ts",
            range: { lineStart: 4, columnStart: 1, lineEnd: 4, columnEnd: 25 },
          },
          source: {
            artifactId: "fixture",
            relativePath: "scripts/main.ts",
            range: { lineStart: 3, columnStart: 1, lineEnd: 3, columnEnd: 33 },
          },
        },
      }],
      propertyAccesses: [],
      methodCalls: [],
      moduleMemberAccesses: [],
    } as unknown as ParsedScriptFile;

    const result = extractArenaConcurrencyCapacity({
      discovery: {
        canonical: {
          arenaId: "arena-1",
          anchor: { x: 0, y: 0, z: 0 },
          items: [],
        },
        replicas: [{
          arenaId: "arena-2",
          anchor: { x: 100, y: 0, z: 0 },
          items: [],
        }],
        offsets: [{ x: 100, y: 0, z: 0 }],
        supportByOffset: {},
        confidence: "medium",
        evidenceCandidates: 2,
      },
      tickingAreas: [],
      scripts: [script],
    });

    expect(result.evidence).toMatchObject({
      perArenaPlayerCapacity: 5,
      perArenaPlayerCapacitySources: [{
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      }],
      declaredMaxConcurrentPlayers: 10,
      conflictingPlayerCapacityValues: [],
    });
    expect(result.resources).toEqual([]);
    expect(result.report?.safeConcurrentArenas).toBeNull();
  });

  it("refuses forged cross-file and unbound capacity proofs at the extraction boundary", () => {
    const parsed = parseScriptFile("verified", [
      "function join(arena, player) {",
      "  if (arena.members.length >= 5) return;",
      "  arena.members.push(player);",
      "}",
    ].join("\n"), {
      artifactId: "fixture", relativePath: "scripts/canonical.js",
    });
    expect(extractArenaConcurrencyCapacity({
      tickingAreas: [], scripts: [parsed],
    }).evidence.perArenaPlayerCapacity).toBe(5);

    const original = parsed.arenaAuthorityPaths?.find((item) => item.capacityAuthorityProven);
    expect(original?.capacityCheck?.guardedCommitSource).toBeDefined();
    if (!original || !original.capacityCheck) throw new Error("missing source fixture");
    const sourceCheck = original.capacityCheck;
    const validSpan = sourceCheck.guardedCommitSource!;
    const falseClaims: ParsedScriptFile[] = [
      { ...parsed, source: { ...parsed.source, relativePath: "scripts/foreign.js" } },
      { ...parsed, arenaAuthorityPaths: [{ ...original,
        capacityCheck: { ...sourceCheck, guardedCommitSource: {
          ...validSpan, range: { ...validSpan.range, lineStart: 90 },
        } },
      }] },
      { ...parsed, arenaAuthorityPaths: [{ ...original,
        capacityCheck: (() => {
          const unchecked = { ...sourceCheck };
          delete unchecked.guardedCommitSource;
          return unchecked;
        })(),
      }] },
      { ...parsed, arenaAuthorityPaths: [{ ...original,
        capacityCheck: { ...sourceCheck, source: {
          ...sourceCheck.source, relativePath: "scripts/foreign.js",
        } },
      }] },
      { ...parsed, arenaAuthorityPaths: [{ ...original,
        capacityAuthorityProven: true,
        membershipCommit: { ...original.membershipCommit!,
          membershipExpression: "arena.otherMembers",
        },
      }] },
    ];
    for (const candidate of falseClaims) {
      const result = extractArenaConcurrencyCapacity({
        tickingAreas: [], scripts: [candidate],
      });
      expect(result.evidence.perArenaPlayerCapacity).toBeUndefined();
      expect(result.evidence.perArenaPlayerCapacitySources).toBeUndefined();
      expect(result.evidence.declaredMaxConcurrentPlayers).toBeUndefined();
    }
  });

  it("rejects numeric capacity carrying foreign or imprecise value witnesses", () => {
    const parsed = parseScriptFile("local-cap", [
      "const config = { max_member: 5 };",
      "function join(arena, player) {",
      "  if (arena.members.length >= config.max_member) return;",
      "  arena.members.push(player);",
      "}",
    ].join("\n"), {
      artifactId: "fixture", relativePath: "scripts/main.js",
    });
    const proven = parsed.arenaAuthorityPaths?.find((path) =>
      path.capacityAuthorityProven &&
      path.capacityCheck?.resolvedCapacityValue === 5
    );
    expect(proven?.capacityCheck).toBeDefined();
    if (!proven?.capacityCheck) throw new Error("missing control capacity");
    for (const witness of [
      { artifactId: "foreign", relativePath: "scripts/main.js",
        range: { lineStart: 1, columnStart: 1 } },
      { artifactId: "fixture", relativePath: "scripts/other.js",
        range: { lineStart: 1, columnStart: 1 } },
      { artifactId: "fixture", relativePath: "scripts/main.js" },
    ]) {
      const altered: ParsedScriptFile = {
        ...parsed,
        arenaAuthorityPaths: [{
          ...proven,
          capacityCheck: {
            ...proven.capacityCheck,
            resolvedCapacityWitnesses: [witness],
          },
        }],
      };
      const result = extractArenaConcurrencyCapacity({
        tickingAreas: [], scripts: [altered],
      });
      expect(result.evidence.perArenaPlayerCapacity).toBeUndefined();
      expect(result.evidence.unresolvedRosterCapacityPaths).toBe(1);
      expect(result.evidence.perArenaPlayerCapacitySources).toBeUndefined();
    }
  });

  it("retains both guard and immutable declaration provenance for source-owned capacity", () => {
    const script = parseScriptFile(
      "module-capacity",
      [
        "const settings = { max_member: 5 };",
        "function join(arena, player) {",
        "  if (arena.members.length >= settings.max_member) return;",
        "  arena.members.push(player);",
        "}",
      ].join("\n"),
      { artifactId: "fixture", relativePath: "scripts/main.js" },
    );
    const result = extractArenaConcurrencyCapacity({
      tickingAreas: [], scripts: [script],
    });
    expect(result.evidence.perArenaPlayerCapacity).toBe(5);
    expect(result.evidence.perArenaPlayerCapacitySources).toEqual([
      expect.objectContaining({ range: expect.objectContaining({ lineStart: 3 }) }),
      expect.objectContaining({ range: expect.objectContaining({ lineStart: 1 }) }),
    ]);
  });

  it("carries constructor-source proof through to the B3/B5 capacity evidence", () => {
    const script = parseScriptFile("construct",[
      "class Party {",
      "  constructor(definition) { this.definition = definition; this.members = []; }",
      "  join(player) { return this.members.length >= this.definition.maxPlayers",
      "    ? false : (this.members.push(player), true); }",
      "}",
      "const party = new Party({maxPlayers:5});",
      "party.join('one');",
    ].join("\n"),{artifactId:"fixture",relativePath:"scripts/main.js"});
    const result=extractArenaConcurrencyCapacity({tickingAreas:[],scripts:[script]});
    expect(result.evidence.perArenaPlayerCapacity).toBe(5);
    expect(result.evidence.perArenaPlayerCapacitySources?.length).toBe(4);
    expect(result.evidence.perArenaPlayerCapacitySources?.every((item)=>
      item.relativePath==="scripts/main.js")).toBe(true);
  });

  it("retains all equal constructor source declarations without borrowing inconsistent instances", () => {
    const script = parseScriptFile("two-literal-instances", [
      "class Party {",
      "  constructor(definition) { this.definition = definition; this.members = []; }",
      "  join(player) { return this.members.length >= this.definition.maxPlayers",
      "    ? false : (this.members.push(player), true); }",
      "}",
      "const alpha = new Party({maxPlayers:5});",
      "const beta = new Party({maxPlayers:5});",
      "alpha.join('one'); beta.join('two');",
    ].join("\n"), { artifactId: "fixture", relativePath: "scripts/main.js" });
    const result=extractArenaConcurrencyCapacity({tickingAreas:[],scripts:[script]});
    expect(result.evidence.perArenaPlayerCapacity).toBe(5);
    const evidence=result.evidence.perArenaPlayerCapacitySources ?? [];
    expect(evidence).toHaveLength(6);
    expect(evidence.map(item=>item.range?.lineStart)).toEqual([3,6,2,6,7,7]);
  });

  it("does not promote one proven cap over another unguarded roster owner", () => {
    const proven = parseScriptFile("limited", [
      "class Limited {",
      "  join(player) {",
      "    if (this.members.length >= 5) return;",
      "    this.members.push(player);",
      "  }",
      "}",
    ].join("\n"), {
      artifactId: "fixture", relativePath: "scripts/limited.js",
    });
    const unguarded = parseScriptFile("open", [
      "class Open {",
      "  join(player) { this.members.push(player); }",
      "}",
    ].join("\n"), {
      artifactId: "fixture", relativePath: "scripts/open.js",
    });
    const result = extractArenaConcurrencyCapacity({
      tickingAreas: [], scripts: [proven, unguarded], declaredArenaCount: 2,
    });
    expect(result.evidence.perArenaPlayerCapacity).toBeUndefined();
    expect(result.evidence.declaredMaxConcurrentPlayers).toBeUndefined();
    expect(result.evidence.unresolvedRosterCapacityPaths).toBe(1);
    expect(result.evidence.reasons).toEqual(expect.arrayContaining([
      expect.stringContaining("no enforced numeric capacity proof"),
    ]));
  });

  it("does not treat an unresolved property guard as a global cap of a different arena", () => {
    const proven = parseScriptFile("limited", [
      "function join(arena, player) {",
      "  if (arena.members.length >= 5) return;",
      "  arena.members.push(player);",
      "}",
    ].join("\n"), {
      artifactId: "fixture", relativePath: "scripts/limited.js",
    });
    const unknown = parseScriptFile("unresolved", [
      "class Party {",
      "  join(player) {",
      "    return this.members.length >= this.definition.maxPlayers",
      "      ? false : (this.members.push(player), true);",
      "  }",
      "}",
    ].join("\n"), {
      artifactId: "fixture", relativePath: "scripts/other.js",
    });
    const result = extractArenaConcurrencyCapacity({
      tickingAreas: [], scripts: [proven, unknown], declaredArenaCount: 2,
    });
    expect(result.evidence.perArenaPlayerCapacity).toBeUndefined();
    expect(result.evidence.declaredMaxConcurrentPlayers).toBeUndefined();
    expect(result.evidence.conflictingPlayerCapacityValues).toEqual([]);
  });

  it("does not project player capacity from a full-roster return that adds a player", () => {
    const broken = parseScriptFile("side-effect-reject", [
      "function join(arena, player) {",
      "  if (arena.members.length >= 5) return arena.members.push(player);",
      "  arena.members.push(player);",
      "}",
    ].join("\n"), {
      artifactId: "fixture", relativePath: "scripts/join.js",
    });
    const result = extractArenaConcurrencyCapacity({
      tickingAreas: [], scripts: [broken], declaredArenaCount: 2,
    });
    expect(result.evidence.perArenaPlayerCapacity).toBeUndefined();
    expect(result.evidence.declaredMaxConcurrentPlayers).toBeUndefined();
  });

  it("accepts matching proven roster caps across independent source owners", () => {
    const scripts = ["alpha", "beta"].map((name) =>
      parseScriptFile(name, [
        "function join(arena, player) {",
        "  if (arena.members.length >= 5) return;",
        "  arena.members.push(player);",
        "}",
      ].join("\n"), {
        artifactId: "fixture", relativePath: "scripts/" + name + ".js",
      })
    );
    const result = extractArenaConcurrencyCapacity({
      tickingAreas: [], scripts, declaredArenaCount: 2,
    });
    expect(result.evidence.perArenaPlayerCapacity).toBe(5);
    expect(result.evidence.declaredMaxConcurrentPlayers).toBe(10);
    expect(result.evidence.perArenaPlayerCapacitySources).toHaveLength(2);
  });

  it("keeps capacity UNKNOWN when mapped configuration or allocation evaluates unknown effects", () => {
    const base = [
      "const configs = [0, 1].map(id => ({maxPlayers: 5, id}));",
      "var Party = class {",
      "  constructor(definition) { this.definition = definition; }",
      "  members = [];",
      "  join(player) {",
      "    return this.members.length >= this.definition.maxPlayers",
      "      ? false : (this.members.push(player), true);",
      "  }",
      "};",
      "const parties = configs.map(cfg => new Party(cfg));",
    ];
    const cases: [string, string, string][] = [
      ["generator-evaluation", "const configs = [0, 1].map(id => ({maxPlayers: 5, id}));",
        "const configs = [0, 1].map(id => ({maxPlayers: 5, id, extra: mutateConfiguration()}));"],
      ["generator-this-arg", "const configs = [0, 1].map(id => ({maxPlayers: 5, id}));",
        "const configs = [0, 1].map(id => ({maxPlayers: 5, id}), mutateConfiguration());"],
      ["allocation-this-arg", "const parties = configs.map(cfg => new Party(cfg));",
        "const parties = configs.map(cfg => new Party(cfg), mutateConfiguration());"],
      ["constructor-extra-arg", "const parties = configs.map(cfg => new Party(cfg));",
        "const parties = configs.map(cfg => new Party(cfg, mutateConfiguration()));"],
      ["constructor-direct-extra-arg", "const parties = configs.map(cfg => new Party(cfg));",
        "const parties = [new Party(configs[0], mutateConfiguration())];"],
    ];
    const parse = (id: string, src: string[]) => parseScriptFile(
      id, src.join("\n"), {
        artifactId: "side-effect-fixture",
        relativePath: "scripts/" + id + ".js",
      },
    );
    const baseline = extractArenaConcurrencyCapacity({
      tickingAreas: [], scripts: [parse("pure-generator", base)],
      declaredArenaCount: 2,
    }).evidence;
    expect(baseline.perArenaPlayerCapacity).toBe(5);
    for (const [id, from, to] of cases) {
      const fixture = [...base];
      const index = fixture.indexOf(from);
      expect(index, id).toBeGreaterThanOrEqual(0);
      fixture[index] = to;
      const evidence = extractArenaConcurrencyCapacity({
        tickingAreas: [], scripts: [parse(id, fixture)],
        declaredArenaCount: 2,
      }).evidence;
      expect(evidence.perArenaPlayerCapacity, id).toBeUndefined();
      expect(evidence.declaredMaxConcurrentPlayers, id).toBeUndefined();
    }
  });

  it("joins a uniform keyed configuration table to the same arena ID and roster", () => {
    const base = [
      "const CONFIGS = { north: { max_member: 5 }, south: { max_member: 5 } };",
      "function getConfig(id) { return Object.hasOwn(CONFIGS, id) ? CONFIGS[id] : void 0; }",
      "function join(arena, player) {",
      "  const cfg = getConfig(arena.id);",
      "  if (!cfg) return;",
      "  if (arena.members.length >= cfg.max_member) return;",
      "  arena.members.push(player);",
      "}",
    ];
    const run = (id: string, code: readonly string[]) =>
      extractArenaConcurrencyCapacity({
        tickingAreas: [],
        declaredArenaCount: 2,
        scripts: [parseScriptFile(id, code.join("\n"), {
          artifactId: "fixture",
          relativePath: "scripts/" + id + ".js",
        })],
      }).evidence;
    const accepted = run("keyed-config", base);
    expect(accepted.perArenaPlayerCapacity).toBe(5);
    expect(accepted.declaredMaxConcurrentPlayers).toBe(10);
    const spans = accepted.perArenaPlayerCapacitySources?.map((item) =>
      item.range?.lineStart) ?? [];
    expect(spans).toContain(1);
    expect(spans).toContain(2);
    expect(spans).toContain(4);
    expect(spans).toContain(5);

    const negative: readonly [string, readonly string[]][] = [
      ["mixed-capacities", [
        "const CONFIGS = { north: { max_member: 5 }, south: { max_member: 9 } };",
        ...base.slice(1),
      ]],
      ["foreign-selection", [
        ...base.slice(0, 3),
        "  const cfg = getConfig(other.id);",
        ...base.slice(4),
      ]],
      ["unbound-selection", [
        ...base.slice(0, 3),
        "  const cfg = getConfig(id);",
        ...base.slice(4),
      ]],
      ["dynamic-entry", [
        "const CONFIGS = { north: { max_member: 5 }, south: { max_member: getCap() } };",
        ...base.slice(1),
      ]],
      ["mutable-config", [
        ...base,
        "CONFIGS.north.max_member = 10;",
      ]],
      ["exported-table", [
        "export const CONFIGS = { north: { max_member: 5 }, south: { max_member: 5 } };",
        ...base.slice(1),
      ]],
      ["shadowed-formal", [
        ...base.slice(0, 2),
        "function other(id) { return id; }",
        ...base.slice(2),
      ]],
      ["computed-capacity-property", [
        "const CONFIGS = { north: { max_member: 5, ['max_member']: 9 }, south: { max_member: 5 } };",
        ...base.slice(1),
      ]],
      ["escaped-return", [
        ...base.slice(0, 2),
        "const leaked = getConfig('north');",
        ...base.slice(2),
      ]],
      ["unguarded-inherited-key", [
        base[0]!,
        "function getConfig(id) { return CONFIGS[id]; }",
        ...base.slice(2),
      ]],
      ["no-missing-config-guard", [
        ...base.slice(0, 4),
        ...base.slice(5),
      ]],
      ["mocked-has-own", [
        ...base,
        "Object.hasOwn = () => true;",
      ]],
    ];
    for (const [id, code] of negative) {
      const evidence = run(id, code);
      expect(evidence.perArenaPlayerCapacity, id).toBeUndefined();
      expect(evidence.declaredMaxConcurrentPlayers, id).toBeUndefined();
    }
  });

  it("binds an exact zero-argument module config getter to a roster admission guard", () => {
    const base = [
      "const CONFIG = { max_member: 5, label: 'arena' };",
      "function getArenaConfig() { return CONFIG; }",
      "function join(arena, player) {",
      "  const cfg = getArenaConfig();",
      "  if (arena.members.length >= cfg.max_member) return;",
      "  arena.members.push(player);",
      "}",
    ];
    const inspect = (name: string, lines: readonly string[]) =>
      extractArenaConcurrencyCapacity({
        tickingAreas: [],
        declaredArenaCount: 2,
        scripts: [parseScriptFile(name, lines.join('\n'), {
          artifactId: "fixture",
          relativePath: "scripts/" + name + ".js",
        })],
      }).evidence;
    const good = inspect("pure-getter", base);
    expect(good.perArenaPlayerCapacity).toBe(5);
    expect(good.declaredMaxConcurrentPlayers).toBe(10);
    expect(good.perArenaPlayerCapacitySources?.some((item) =>
      item.range?.lineStart === 1)).toBe(true);
    expect(good.perArenaPlayerCapacitySources?.some((item) =>
      item.range?.lineStart === 2)).toBe(true);

    const negative: readonly [string, readonly string[]][] = [
      ["parameterized-getter", [
        base[0]!,
        "function getArenaConfig(id) { return CONFIG; }",
        ...base.slice(2),
      ]],
      ["mutating-getter", [
        base[0]!,
        "function getArenaConfig() { CONFIG.max_member = 9; return CONFIG; }",
        ...base.slice(2),
      ]],
      ["exported-config", [
        "export const CONFIG = { max_member: 5, label: 'arena' };",
        ...base.slice(1),
      ]],
      ["escaped-config", [
        ...base,
        "const leaked = CONFIG;",
      ]],
      ["forwarded-alias", [
        ...base.slice(0, 4),
        "  use(cfg);",
        ...base.slice(4),
      ]],
      ["foreign-roster", [
        ...base.slice(0, 5),
        "  other.members.push(player);",
        "}",
      ]],
    ];
    for (const [name, lines] of negative) {
      const found = inspect(name, lines);
      expect(found.perArenaPlayerCapacity, name).toBeUndefined();
      expect(found.declaredMaxConcurrentPlayers, name).toBeUndefined();
    }
  });

  it("projects module-local const array generators only with exact immutable identity", () => {
    const base = [
      "const arenaIds = [0, 200];",
      "const configs = arenaIds.map(id => ({ id, maxPlayers: 5 }));",
      "var Party = class {",
      "  constructor(definition) { this.definition = definition; }",
      "  members = [];",
      "  join(player) {",
      "    return this.members.length >= this.definition.maxPlayers",
      "      ? false : (this.members.push(player), true);",
      "  }",
      "};",
      "const parties = configs.map(cfg => new Party(cfg));",
    ];
    const read = (name: string, lines: readonly string[]) => parseScriptFile(
      name, lines.join("\n"), {
        artifactId: "fixture", relativePath: "scripts/" + name + ".js",
      },
    );
    const projected = extractArenaConcurrencyCapacity({
      tickingAreas: [],
      scripts: [read("named-map-source", base)],
      declaredArenaCount: 2,
    }).evidence;
    expect(projected.perArenaPlayerCapacity).toBe(5);
    expect(projected.perArenaPlayerCapacitySources?.some((item) =>
      item.range?.lineStart === 1)).toBe(true);

    for (const [name, lines] of [
      ["escaped-id-array", [...base, "const leaked = arenaIds;"]],
      ["mutated-id-array", [...base, "arenaIds.push(400);"]],
      ["shadowed-id-array", [...base, "function f(arenaIds) { return 1; }"]],
      ["dynamic-id-array", [
        "const arenaIds = [getArenaId(), 200];", ...base.slice(1),
      ]],
    ] as const) {
      const evidence = extractArenaConcurrencyCapacity({
        tickingAreas: [], scripts: [read(name, lines)],
        declaredArenaCount: 2,
      }).evidence;
      expect(evidence.perArenaPlayerCapacity, name).toBeUndefined();
      expect(evidence.unresolvedRosterCapacityPaths, name).toBe(1);
    }
  });

  it("projects a source-bound mapped constructor capacity without equating it to runtime slots", () => {
    const script = parseScriptFile("mapped-classes", [
      "var configs = [0, 200].map((offset) => {",
      "  return { offset: offset, maxPlayers: 5 };",
      "});",
      "var Party = class {",
      "  constructor(definition) { this.definition = definition; }",
      "  members = [];",
      "  join(player) {",
      "    return this.members.length >= this.definition.maxPlayers",
      "      ? false : (this.members.push(player), true);",
      "  }",
      "};",
      "const sessions = configs.map((cfg) => new Party(cfg));",
    ].join("\n"), {
      artifactId: "fixture", relativePath: "scripts/generated-sessions.js",
    });
    const result = extractArenaConcurrencyCapacity({
      tickingAreas: [], scripts: [script], declaredArenaCount: 2,
    });
    expect(result.evidence.perArenaPlayerCapacity).toBe(5);
    expect(result.evidence.declaredMaxConcurrentPlayers).toBe(10);
    expect(result.evidence.perArenaPlayerCapacitySources).toEqual([
      expect.objectContaining({
        range: expect.objectContaining({ lineStart: 8 }),
      }),
      expect.objectContaining({
        range: expect.objectContaining({ lineStart: 2 }),
      }),
      ...Array(3).fill(expect.objectContaining({
        artifactId: "fixture",
        relativePath: "scripts/generated-sessions.js",
      })),
    ]);
    // Source-authored slot arithmetic must not turn into a delivered
    // multi-arena capacity or observed gameplay assertion.
    expect(result.report?.safeConcurrentArenas ?? null).toBeNull();
  });

  it("does not project mutated mapped-config inspection aliases into B3/B5", () => {
    const base = [
      "const configs = [0, 1].map(id => ({maxPlayers:5, id}));",
      "var Party = class {",
      "  constructor(definition) { this.definition = definition; }",
      "  members = [];",
      "  join(p) { return this.members.length >= this.definition.maxPlayers",
      "    ? false : (this.members.push(p), true); }",
      "};",
      "const parties = configs.map(item => new Party(item));",
    ];
    const sourceRef = { artifactId: "fixture", relativePath: "scripts/aliases.js" };
    const clean = parseScriptFile("readonly-aliased-config", [
      ...base, "configs.some(item => item.maxPlayers === 5);",
    ].join("\n"), sourceRef);
    expect(extractArenaConcurrencyCapacity({
      tickingAreas: [], scripts: [clean], declaredArenaCount: 2,
    }).evidence.perArenaPlayerCapacity).toBe(5);
    const mutated = parseScriptFile("mutated-aliased-config", [
      ...base,
      "configs.some(item => item.__defineGetter__('maxPlayers', () => 9));",
    ].join("\n"), sourceRef);
    const evidence = extractArenaConcurrencyCapacity({
      tickingAreas: [], scripts: [mutated], declaredArenaCount: 2,
    }).evidence;
    expect(evidence.perArenaPlayerCapacity).toBeUndefined();
    expect(evidence.declaredMaxConcurrentPlayers).toBeUndefined();
  });

  it("does not project third-argument source-array mutation into B3/B5", () => {
    const sourceRef = {artifactId:"fixture",relativePath:"scripts/array-callback.js"};
    const base = [
      "const configs = [0, 1].map(id => ({maxPlayers:5, id}));",
      "var Party = class {",
      "  constructor(definition) { this.definition = definition; }",
      "  members = [];",
      "  join(p) { return this.members.length >= this.definition.maxPlayers",
      "    ? false : (this.members.push(p), true); }",
      "};",
      "const parties = configs.map(item => new Party(item));",
    ];
    const safe = parseScriptFile("safe-array-read", [
      ...base, "configs.some(item => item.maxPlayers === 5);",
    ].join("\n"), sourceRef);
    expect(extractArenaConcurrencyCapacity({
      tickingAreas:[],scripts:[safe],declaredArenaCount:2,
    }).evidence.perArenaPlayerCapacity).toBe(5);
    const unsafe = parseScriptFile("array-parameter-write", [
      ...base,
      "configs.some((unused, index, all) => all[index].__defineGetter__('maxPlayers', () => 9));",
    ].join("\n"), sourceRef);
    const evidence = extractArenaConcurrencyCapacity({
      tickingAreas:[],scripts:[unsafe],declaredArenaCount:2,
    }).evidence;
    expect(evidence.perArenaPlayerCapacity).toBeUndefined();
    expect(evidence.declaredMaxConcurrentPlayers).toBeUndefined();
  });

  it("keeps B3/B5 numeric capacity UNKNOWN for hidden map-return branches", () => {
    const script = parseScriptFile("branching-config", [
      "const configs = [0, 1].map((id) => {",
      "  if (id) return { maxPlayers: 9 };",
      "  return { maxPlayers: 5 };",
      "});",
      "var Party = class {",
      "  constructor(definition) { this.definition = definition; }",
      "  members = [];",
      "  join(player) {",
      "    return this.members.length >= this.definition.maxPlayers",
      "      ? false : (this.members.push(player), true);",
      "  }",
      "};",
      "const party = new Party(configs[0]);",
      "party.join('one');",
    ].join("\n"), {
      artifactId: "fixture", relativePath: "scripts/branching-config.js",
    });
    const result = extractArenaConcurrencyCapacity({
      tickingAreas: [], scripts: [script], declaredArenaCount: 2,
    });
    expect(result.evidence.perArenaPlayerCapacity).toBeUndefined();
    expect(result.evidence.declaredMaxConcurrentPlayers).toBeUndefined();
    expect(result.evidence.unresolvedRosterCapacityPaths).toBe(1);
  });

  it("does not project sparse map array slots as proven player capacity", () => {
    const script = parseScriptFile("sparse-config", [
      "const configs = [, 1].map((id) => ({ maxPlayers: 5, id }));",
      "var Party = class {",
      "  constructor(definition) { this.definition = definition; }",
      "  members = [];",
      "  join(player) {",
      "    return this.members.length >= this.definition.maxPlayers",
      "      ? false : (this.members.push(player), true);",
      "  }",
      "};",
      "const party = new Party(configs[0]);",
      "party.join('one');",
    ].join("\n"), {
      artifactId: "fixture", relativePath: "scripts/sparse-config.js",
    });
    const result = extractArenaConcurrencyCapacity({
      tickingAreas: [], scripts: [script], declaredArenaCount: 2,
    });
    expect(result.evidence.perArenaPlayerCapacity).toBeUndefined();
    expect(result.evidence.declaredMaxConcurrentPlayers).toBeUndefined();
  });

  it("keeps B3/B5 numeric capacity UNKNOWN for out-of-range mapped config indices", () => {
    const script = parseScriptFile("invalid-index", [
      "const configs = [0, 1].map((id) => ({ maxPlayers: 5, id }));",
      "var Party = class {",
      "  constructor(definition) { this.definition = definition; }",
      "  members = [];",
      "  join(player) {",
      "    return this.members.length >= this.definition.maxPlayers",
      "      ? false : (this.members.push(player), true);",
      "  }",
      "};",
      "const party = new Party(configs[99]);",
      "party.join('one');",
    ].join("\n"), {
      artifactId: "fixture", relativePath: "scripts/invalid-index.js",
    });
    const result = extractArenaConcurrencyCapacity({
      tickingAreas: [], scripts: [script], declaredArenaCount: 2,
    });
    expect(result.evidence.perArenaPlayerCapacity).toBeUndefined();
    expect(result.evidence.declaredMaxConcurrentPlayers).toBeUndefined();
    expect(result.evidence.unresolvedRosterCapacityPaths).toBe(1);
  });

  it("does not promote computed-key constructor overrides into B3/B5 numeric proof", () => {
    for (const config of [
      '{maxPlayers:5, ["maxPlayers"]:9}',
      '{maxPlayers:5, ["max" + "Players"]:9}',
    ]) {
      for (const mapped of [false, true]) {
        const sourceText = mapped
          ? [
              "const configs = [0, 1].map((id) => (" + config + "));",
              "var Party = class {",
              "  constructor(definition) { this.definition = definition; }",
              "  join(player) { return this.members.length >= this.definition.maxPlayers",
              "    ? false : (this.members.push(player), true); }",
              "};",
              "const party = new Party(configs[0]);",
              "party.join('one');",
            ].join("\n")
          : [
              "class Party {",
              "  constructor(definition) { this.definition = definition; this.members = []; }",
              "  join(player) { return this.members.length >= this.definition.maxPlayers",
              "    ? false : (this.members.push(player), true); }",
              "}",
              "const party = new Party(" + config + ");",
              "party.join('one');",
            ].join("\n");
        const script = parseScriptFile(
          "computed-key", sourceText,
          { artifactId: "fixture", relativePath: "scripts/computed-key.js" },
        );
        const result = extractArenaConcurrencyCapacity({
          tickingAreas: [], scripts: [script], declaredArenaCount: 2,
        });
        expect(result.evidence.perArenaPlayerCapacity).toBeUndefined();
        expect(result.evidence.declaredMaxConcurrentPlayers).toBeUndefined();
      }
    }
  });

  it("does not project Promise-based mapped configs or sessions into B3/B5", () => {
    for (const asyncStage of ["generator", "allocator"] as const) {
      const script = parseScriptFile("async-config-stage", [
        `const configs = [0, 1].map(${asyncStage === "generator" ? "async " : ""}(id) => ({maxPlayers:5, id}));`,
        "var Party = class {",
        "  constructor(definition) { this.definition = definition; }",
        "  members = [];",
        "  join(player) { return this.members.length >= this.definition.maxPlayers",
        "    ? false : (this.members.push(player), true); }",
        "};",
        `const parties = configs.map(${asyncStage === "allocator" ? "async " : ""}(cfg) => new Party(cfg));`,
      ].join("\n"), {
        artifactId: "fixture", relativePath: "scripts/async-config.js",
      });
      const result = extractArenaConcurrencyCapacity({
        tickingAreas: [], scripts: [script], declaredArenaCount: 2,
      });
      expect(result.evidence.perArenaPlayerCapacity).toBeUndefined();
      expect(result.evidence.declaredMaxConcurrentPlayers).toBeUndefined();
    }
  });

  it("does not promote externally mutable exported map configuration into B3/B5", () => {
    const script = parseScriptFile("exported-config", [
      "export const configs = [0, 1].map((id) => ({maxPlayers:5, id}));",
      "var Party = class {",
      "  constructor(definition) { this.definition = definition; }",
      "  members = [];",
      "  join(player) { return this.members.length >= this.definition.maxPlayers",
      "    ? false : (this.members.push(player), true); }",
      "};",
      "const party = new Party(configs[0]);",
      "party.join('one');",
    ].join("\n"), {
      artifactId: "fixture", relativePath: "scripts/exported-config.js",
    });
    const output = extractArenaConcurrencyCapacity({
      tickingAreas: [], scripts: [script], declaredArenaCount: 2,
    });
    expect(output.evidence.perArenaPlayerCapacity).toBeUndefined();
    expect(output.evidence.declaredMaxConcurrentPlayers).toBeUndefined();
  });

  it("does not project class-field-held mapped sessions into B3/B5 capacity", () => {
    const common = [
      "const configs = [0, 1].map(id => ({ maxPlayers: 5, id }));",
      "var Party = class {",
      "  constructor(definition) { this.definition = definition; }",
      "  members = [];",
      "  join(p) { return this.members.length >= this.definition.maxPlayers",
      "    ? false : (this.members.push(p), true); }",
      "};",
    ];
    const variants = [
      ["class Sessions { parties = configs.map(item => new Party(item)); }"],
      ["class Sessions { parties = configs.map(item => new Party(item)); }",
       "const owner = new Sessions(); owner.parties[0].definition.maxPlayers = 9;"],
      ["class Sessions { parties = configs.map(item => new Party(item)); }",
       "const owner = new Sessions(); leak(owner.parties);"],
    ];
    for (const extra of variants) {
      const script = parseScriptFile("class-field-capacity-unproven", [
        ...common, ...extra,
      ].join("\n"), {
        artifactId: "fixture",
        relativePath: "scripts/class-field-sessions.js",
      });
      const result = extractArenaConcurrencyCapacity({
        tickingAreas: [], scripts: [script], declaredArenaCount: 2,
      });
      expect(result.evidence.perArenaPlayerCapacity).toBeUndefined();
      expect(result.evidence.declaredMaxConcurrentPlayers).toBeUndefined();
    }
  });

  it("keeps B3/B5 UNKNOWN when a const-owned mapped instance collection escapes", () => {
    const original = [
      "const configs = [0, 1].map(id => ({maxPlayers:5, id}));",
      "var Party = class {",
      "  constructor(definition) { this.definition = definition; }",
      "  members = [];",
      "  join(p) { return this.members.length >= this.definition.maxPlayers",
      "    ? false : (this.members.push(p), true); }",
      "};",
      "const parties = configs.map(item => new Party(item));",
    ];
    const bound = parseScriptFile("mapped-bound", [
      ...original,
      "parties[0].join('a');",
    ].join("\n"), {
      artifactId: "fixture", relativePath: "scripts/sessions.js",
    });
    const positive = extractArenaConcurrencyCapacity({
      tickingAreas: [], scripts: [bound], declaredArenaCount: 2,
    });
    expect(positive.evidence.perArenaPlayerCapacity).toBe(5);
    for (const mutation of [
      "parties[0].definition.maxPlayers = 9;",
      "leak(parties);",
      "parties[3].join('a');",
    ]) {
      const mutated = parseScriptFile("mapped-escaped", [
        ...original, mutation,
      ].join("\n"), {
        artifactId: "fixture", relativePath: "scripts/sessions.js",
      });
      const result = extractArenaConcurrencyCapacity({
        tickingAreas: [], scripts: [mutated], declaredArenaCount: 2,
      });
      expect(result.evidence.perArenaPlayerCapacity).toBeUndefined();
      expect(result.evidence.declaredMaxConcurrentPlayers).toBeUndefined();
    }
  });

  it("does not convert a guarded but unresolved config property into numeric capacity", () => {
    const script = {
      arenaAuthorityPaths: [{
        arenaExpression: "this",
        executionRegion: "method:join",
        capacityAuthorityProven: true,
        startAuthorityProven: false,
        startGuardProven: false,
        capacityCheck: {
          kind: "capacity-check",
          arenaExpression: "this",
          membershipExpression: "this.members",
          capacityExpression: "this.definition.maxPlayers",
          executionRegion: "method:join",
          source: {
            artifactId: "fixture",
            relativePath: "scripts/compiled.js",
          },
        },
      }],
      propertyAccesses: [],
      methodCalls: [],
      moduleMemberAccesses: [],
    } as unknown as ParsedScriptFile;

    const result = extractArenaConcurrencyCapacity({
      tickingAreas: [],
      scripts: [script],
    });
    expect(result.evidence.perArenaPlayerCapacity).toBeUndefined();
    expect(result.evidence.perArenaPlayerCapacitySources).toBeUndefined();
  });

  it("reports a shortfall when runtime admission caps six arenas at two", () => {
    const offsets = Array.from(
      { length: 5 },
      (_, index) => ({
        x: (index + 1) * 100,
        y: 0,
        z: 0,
      }),
    );

    const result =
      extractArenaConcurrencyCapacity({
        discovery: {
          canonical: {
            arenaId: "arena-1",
            anchor: { x: 0, y: 0, z: 0 },
            items: [],
          },
          replicas: offsets.map(
            (offset, index) => ({
              arenaId:
                "arena-" + String(index + 2),
              anchor: offset,
              items: [],
            }),
          ),
          offsets,
          supportByOffset: {},
          confidence: "high",
          evidenceCandidates: 6,
        },
        tickingAreas: [],
        declaredConcurrentArenaLimit: 2,
      });

    expect(result.evidence).toMatchObject({
      requestedConcurrentArenas: 6,
      declaredConcurrentArenaLimit: 2,
    });
    expect(result.resources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "runtime-arena-admission-cap",
          perArena: 1,
          total: 2,
        }),
      ]),
    );
    expect(result.report).toMatchObject({
      requestedConcurrentArenas: 6,
      safeConcurrentArenas: 2,
      ok: false,
    });
  });

  it("reports a shortfall when proven command families exceed the 10-slot backend", () => {
    const offsets = Array.from({ length: 5 }, (_, index) => ({
      x: (index + 1) * 100,
      y: 0,
      z: 0,
    }));
    const arenaOffsets = [{ x: 0, y: 0, z: 0 }, ...offsets];
    const tickingAreas = arenaOffsets.flatMap((offset) =>
      [0, 20].map((localX) => ({
        functionId: "arena/setup",
        semantics: {
          action: "add-circle" as const,
          center: absolute(offset.x + localX, 0, 0),
          radius: 2,
        },
      }))
    );

    const result = extractArenaConcurrencyCapacity({
      discovery: {
        canonical: {
          arenaId: "arena-1",
          anchor: { x: 0, y: 0, z: 0 },
          items: [],
        },
        replicas: offsets.map((offset, index) => ({
          arenaId: `arena-${index + 2}`,
          anchor: offset,
          items: [],
        })),
        offsets,
        supportByOffset: {},
        confidence: "high",
        evidenceCandidates: 6,
      },
      tickingAreas,
    });

    expect(result.resources[0]).toMatchObject({
      perArena: 2,
      total: 10,
    });
    expect(result.report).toMatchObject({
      requestedConcurrentArenas: 6,
      safeConcurrentArenas: 5,
      ok: false,
    });
  });
});
