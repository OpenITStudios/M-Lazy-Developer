import { describe, expect, it } from "vitest";
import {
  parseScriptFile,
  deriveScriptTerminalPrecedenceEvidence,
} from "../../../src/index.js";

const source = {
  artifactId: "art-arena",
  relativePath: "scripts/arena.ts",
};

describe("arena authority evidence", () => {
  it("retains a direct generation mutation's lexical block identity only", () => {
    const parsed = parseScriptFile("arena", [
      "function reset(arena, flag) {",
      "  arena.generation++;",
      "  if (flag) { arena.generation++; }",
      "  if (flag) arena.generation++;",
      "}",
    ].join("\n"), source);
    const generation = parsed.arenaAuthorityEvidence?.filter(
      item => item.kind === "generation-invalidate") ?? [];
    expect(generation).toHaveLength(3);
    expect(generation[0]?.sequentialBlockSource?.range?.lineStart).toBe(1);
    expect(generation[1]?.sequentialBlockSource?.range?.lineStart).toBe(3);
    expect(generation[2]?.sequentialBlockSource).toBeUndefined();
  });

  it("retains receiver rebindings and prior early exits as distinct statement paths", () => {
    const parsed = parseScriptFile("arena", [
      "function reset(arena, otherArena, skip) {",
      "  arena.generation++;",
      "  arena = otherArena;",
      "  arena.generation++;",
      "  if (skip) return;",
      "  arena.generation++;",
      "}",
    ].join("\n"), source);
    const items = parsed.arenaAuthorityEvidence?.filter(
      item => item.kind === "generation-invalidate") ?? [];
    expect(items).toHaveLength(3);
    expect(items[0]?.sequentialPathEvidence?.precedingReceiverRebindingSources)
      .toEqual([]);
    expect(items[1]?.sequentialPathEvidence?.precedingReceiverRebindingSources
      .map(item => item.range?.lineStart)).toEqual([3]);
    expect(items[2]?.sequentialPathEvidence?.precedingReceiverRebindingSources
      .map(item => item.range?.lineStart)).toEqual([3]);
    expect(items[0]?.sequentialPathEvidence?.precedingControlExitSources)
      .toEqual([]);
    expect(items[1]?.sequentialPathEvidence?.precedingControlExitSources)
      .toEqual([]);
    expect(items[2]?.sequentialPathEvidence?.precedingControlExitSources
      .map(item => item.range?.lineStart)).toEqual([5]);
  });

  it("retains calls touching the arena or same-block const alias as source barriers", () => {
    const parsed = parseScriptFile("arena", [
      "function reset(arena) {",
      "  arena.generation++;",
      "  const alias = arena;",
      "  mutate(alias);",
      "  arena.generation++;",
      "  arena.inspect();",
      "  arena.generation++;",
      "}",
    ].join("\n"), source);
    const items = parsed.arenaAuthorityEvidence?.filter(
      item => item.kind === "generation-invalidate") ?? [];
    expect(items).toHaveLength(3);
    expect(items[0]?.sequentialPathEvidence?.precedingReceiverCallSources)
      .toEqual([]);
    expect(items[1]?.sequentialPathEvidence?.precedingReceiverCallSources
      .map(item => item.range?.lineStart)).toEqual([4]);
    expect(items[2]?.sequentialPathEvidence?.precedingReceiverCallSources
      .map(item => item.range?.lineStart)).toEqual([4, 6]);
  });

  it("proves a capacity authority path only when capacity and membership commit share the same arena object and execution region", () => {
    const parsed = parseScriptFile(
      "arena",
      [
        "function join(arena, player) {",
        "  const maxPlayers = arena.maxPlayers;",
        "  if (arena.members.size >= maxPlayers) return;",
        "  arena.members.add(player);",
        "}",
      ].join("\n"),
      source,
    );

    expect(parsed.arenaAuthorityPaths).toEqual([
      expect.objectContaining({
        arenaExpression: "arena",
        executionRegion: expect.stringMatching(/^function:join@\d+$/),
        capacityAuthorityProven: true,
        startAuthorityProven: false,
        membershipCommit: expect.objectContaining({
          kind: "membership-commit",
          membershipExpression: "arena.members",
          subjectExpression: "player",
        }),
        capacityOperand: expect.objectContaining({
          kind: "capacity-operand",
          capacityExpression: "maxPlayers",
        }),
        capacityCheck: expect.objectContaining({
          kind: "capacity-check",
          membershipExpression: "arena.members",
          capacityExpression: "maxPlayers",
        }),
      }),
    ]);
  });


  it("accepts an inline numeric membership cap only with a same-arena commit", () => {
    const accepted = parseScriptFile(
      "literal",
      [
        "function join(arena, player) {",
        "  if (arena.members.length >= 5) return;",
        "  arena.members.push(player);",
        "}",
      ].join("\n"),
      source,
    );
    expect(accepted.arenaAuthorityPaths?.find(
      (item) => item.arenaExpression === "arena",
    )).toMatchObject({
      capacityAuthorityProven: true,
      capacityCheck: expect.objectContaining({
        capacityExpression: "5",
      }),
    });

    const wrongOwner = parseScriptFile(
      "other",
      [
        "function join(arena, otherArena, player) {",
        "  if (arena.members.length >= 5) return;",
        "  otherArena.members.push(player);",
        "}",
      ].join("\n"),
      source,
    );
    expect((wrongOwner.arenaAuthorityPaths ?? []).some(
      (item) => item.arenaExpression === "arena" && item.capacityAuthorityProven,
    )).toBe(false);
  });

  it("admits a full-party IfStatement only when the true branch terminates the same-block join", () => {
    const accepted = parseScriptFile(
      "admission-if",
      [
        "function join(arena, player) {",
        "  if (arena.members.length >= 5) {",
        '    player.sendMessage("Party full");',
        "    return;",
        "  }",
        "  arena.members.push(player);",
        "}",
      ].join("\n"),
      source,
    );
    expect(accepted.arenaAuthorityPaths?.find(
      (path) => path.arenaExpression === "arena",
    )?.capacityAuthorityProven).toBe(true);

    const loggingOnly = parseScriptFile(
      "logging-only",
      [
        "function join(arena, player) {",
        '  if (arena.members.length >= 5) player.sendMessage("Full");',
        "  arena.members.push(player);",
        "}",
      ].join("\n"),
      source,
    );
    expect(loggingOnly.arenaAuthorityPaths?.some(
      (path) => path.capacityAuthorityProven,
    )).toBe(false);

    const reversed = parseScriptFile(
      "reversed-comparison",
      [
        "function join(arena, player) {",
        "  if (arena.members.length < 5) return;",
        "  arena.members.push(player);",
        "}",
      ].join("\n"),
      source,
    );
    expect(reversed.arenaAuthorityPaths?.some(
      (path) => path.capacityAuthorityProven,
    )).toBe(false);

    const nonAdjacent = parseScriptFile(
      "non-adjacent",
      [
        "function join(arena, player) {",
        "  if (arena.members.length >= 5) return;",
        "  mutate(arena.members);",
        "  arena.members.push(player);",
        "}",
      ].join("\n"),
      source,
    );
    expect(nonAdjacent.arenaAuthorityPaths?.some(
      (path) => path.capacityAuthorityProven,
    )).toBe(false);
  });

  it("does not prove a full-roster branch that modifies roster before exit", () => {
    const safe = [
      "function join(arena, player) {",
      "  if (arena.members.length >= 5) {",
      "    player.sendMessage('Full');",
      "    return;",
      "  }",
      "  arena.members.push(player);",
      "}",
    ];
    const unsafe = [
      ["return-writes-roster", [
        "function join(arena, player) {",
        "  if (arena.members.length >= 5) return arena.members.push(player);",
        "  arena.members.push(player);",
        "}",
      ]],
      ["branch-writes-length", [
        "function join(arena, player) {",
        "  if (arena.members.length >= 5) {",
        "    arena.members.length += 1;",
        "    return;",
        "  }",
        "  arena.members.push(player);",
        "}",
      ]],
      ["branch-forwards-roster", [
        "function join(arena, player) {",
        "  if (arena.members.length >= 5) {",
        "    mutate(arena.members);",
        "    return;",
        "  }",
        "  arena.members.push(player);",
        "}",
      ]],
      ["return-unknown-call", [
        "function join(arena, player) {",
        "  if (arena.members.length >= 5) return mutate(arena);",
        "  arena.members.push(player);",
        "}",
      ]],
    ] as const;
    const parse = (name: string, lines: readonly string[]) =>
      parseScriptFile(name, lines.join("\n"), source);
    expect(parse("safe-full", safe).arenaAuthorityPaths?.some((item) =>
      item.capacityAuthorityProven)).toBe(true);
    for (const [name, lines] of unsafe)
      expect(parse(name, lines).arenaAuthorityPaths?.some((item) =>
        item.capacityAuthorityProven), name).toBe(false);
  });

  it("rejects uncounted effects in successful ternary admission arms", () => {
    const variants = [
      ["return-side-effect", [
        "function join(arena, player) {",
        "  return arena.members.length >= 5 ? false :",
        "    (arena.members.push(player), mutate(arena), true);",
        "}",
      ]],
      ["nested-subject-effect", [
        "function join(arena, player) {",
        "  return arena.members.length >= 5 ? false :",
        "    (arena.members.push(makePlayer()), true);",
        "}",
      ]],
      ["second-write-alias", [
        "function join(arena, player) {",
        "  return arena.members.length >= 5 ? false :",
        "    (arena.members.push(player), arena.members[0] = player, true);",
        "}",
      ]],
    ] as const;
    for (const [name, lines] of variants) {
      const parsed = parseScriptFile(name, lines.join("\n"), source);
      expect(parsed.arenaAuthorityPaths?.some((item) =>
        item.capacityAuthorityProven), name).toBe(false);
    }
  });

  it("links a guarded join to an immutable module-scope object capacity with its exact declaration", () => {
    const parsed = parseScriptFile("source-config", [
      "const config = { max_member: 5, enabled: true };",
      "function join(arena, player) {",
      "  if (arena.members.length >= config.max_member) return;",
      "  arena.members.push(player);",
      "}",
    ].join("\n"), source);
    const path = parsed.arenaAuthorityPaths?.find((item) => item.capacityAuthorityProven);
    expect(path?.capacityCheck).toMatchObject({
      capacityExpression: "config.max_member",
      resolvedCapacityValue: 5,
      resolvedCapacitySource: expect.objectContaining({
        range: expect.objectContaining({ lineStart: 1 }),
      }),
    });
  });

  it("does not steal a module config when the join shadows it or mutates the property", () => {
    const cases = [
      [
        "const config = { max_member: 5 };",
        "function join(arena, player, config) {",
        "  if (arena.members.length >= config.max_member) return;",
        "  arena.members.push(player);",
        "}",
      ],
      [
        "const config = { max_member: 5 };",
        "config.max_member = 9;",
        "function join(arena, player) {",
        "  if (arena.members.length >= config.max_member) return;",
        "  arena.members.push(player);",
        "}",
      ],
      [
        "const config = { max_member: 5 };",
        "mutate(config);",
        "function join(arena, player) {",
        "  if (arena.members.length >= config.max_member) return;",
        "  arena.members.push(player);",
        "}",
      ],
      [
        "const config = { max_member: 5 };",
        "function join(arena, player) {",
        "  if (arena.members.length >= other.max_member) return;",
        "  arena.members.push(player);",
        "}",
      ],
      [
        "const config = { max_member: 5 };",
        "delete config.max_member;",
        "function join(arena, player) {",
        "  if (arena.members.length >= config.max_member) return;",
        "  arena.members.push(player);",
        "}",
      ],
      [
        "const config = { max_member: 5 };",
        "[config.max_member] = [9];",
        "function join(arena, player) {",
        "  if (arena.members.length >= config.max_member) return;",
        "  arena.members.push(player);",
        "}",
      ],
      [
        "export const config = { max_member: 5 };",
        "function join(arena, player) {",
        "  if (arena.members.length >= config.max_member) return;",
        "  arena.members.push(player);",
        "}",
      ],
    ];
    for (const statements of cases) {
      const parsed = parseScriptFile("unproven-config", statements.join("\n"), source);
      expect(parsed.arenaAuthorityPaths?.some((item) =>
        item.capacityAuthorityProven
      )).toBe(false);
    }
  });

  it("binds uniform array.map configuration through a class-expression constructor", () => {
    const parsed = parseScriptFile("mapped-session", [
      "var definitions = [0, 128, 256].map((offset) => {",
      "  return { id: String(offset), maxPlayers: 5, offset };",
      "});",
      "var Party = class {",
      "  constructor(definition) { this.definition = definition; }",
      "  members = [];",
      "  join(player) {",
      "    return this.members.length >= this.definition.maxPlayers",
      "      ? false : (this.members.push(player), true);",
      "  }",
      "};",
      "const parties = definitions.map((item) => new Party(item));",
    ].join("\n"), source);
    const check = parsed.arenaAuthorityPaths?.find((item) =>
      item.capacityAuthorityProven
    )?.capacityCheck;
    expect(check).toMatchObject({
      capacityExpression: "this.definition.maxPlayers",
      resolvedCapacityValue: 5,
      resolvedCapacitySource: expect.objectContaining({
        range: expect.objectContaining({ lineStart: 2 }),
      }),
    });
    expect(check?.resolvedCapacityWitnesses?.length).toBeGreaterThanOrEqual(3);
  });

  it("does not borrow a mapped capacity after its instance config identity is replaced", () => {
    const base = [
      "const configs = [0, 1].map(i => ({maxPlayers: 5}));",
      "var Party = class {",
      "  constructor(definition) { this.definition = definition; }",
      "  join(p) {",
      "    return this.members.length >= this.definition.maxPlayers",
      "      ? false : (this.members.push(p), true);",
      "  }",
      "};",
      "const party = new Party(configs[0]);",
      "party.join('player');",
    ];
    const stable = parseScriptFile("mapped-stable-direct", base.join("\n"), source);
    expect(stable.arenaAuthorityPaths?.find((path) =>
      path.capacityAuthorityProven
    )?.capacityCheck?.resolvedCapacityValue).toBe(5);

    for (const mutation of [
      "party.definition = { maxPlayers: 9 };",
      "party['definition'] = { maxPlayers: 9 };",
      "party[key] = { maxPlayers: 9 };",
      "Object.assign(party.definition, { maxPlayers: 9 });",
      "const alias = party.definition;",
      "leak(party);",
      "const otherParty = party;",
      "party.runUninspectedMethod();",
      "function leakFromClosure() { return party; }",
    ]) {
      const parsed = parseScriptFile(
        "mapped-rebound-direct", [...base, mutation].join("\n"), source,
      );
      expect(parsed.arenaAuthorityPaths?.some((path) =>
        path.capacityCheck?.resolvedCapacityValue !== undefined
      )).toBe(false);
    }
  });

  it("preserves UNKNOWN for mutable, conflicting, aliased or escaping mapped capacity", () => {
    const base = [
      "var definitions = [0, 128].map((offset) => {",
      "  return { id: String(offset), maxPlayers: 5 };",
      "});",
      "var Party = class {",
      "  constructor(definition) { this.definition = definition; }",
      "  members = [];",
      "  join(player) {",
      "    return this.members.length >= this.definition.maxPlayers",
      "      ? false : (this.members.push(player), true);",
      "  }",
      "};",
      "const parties = definitions.map((item) => new Party(item));",
    ];
    const invalid = [
      (rows: string[]) => rows.map((line) =>
        line.replace("maxPlayers: 5", "maxPlayers: computeLimit()")),
      (rows: string[]) => [
        ...rows, "definitions[0].maxPlayers = 9;",
      ],
      (rows: string[]) => [
        ...rows, "var Alias = Party;",
      ],
      (rows: string[]) => rows.map((line) =>
        line.replace("this.definition = definition;",
          "this.definition = definition; this.definition = other;")),
      (rows: string[]) => [
        ...rows, "var alien = new Other(new Party(definitions[0]));",
      ],
      (rows: string[]) => rows.map((line) =>
        line.replace("return this.members.length >= this.definition.maxPlayers",
          "leak(this); return this.members.length >= this.definition.maxPlayers")),
      (rows: string[]) => rows.map((line) =>
        line.replace("return { id: String(offset), maxPlayers: 5 };",
          "if (offset) return {maxPlayers: 5}; return {maxPlayers: 6};")),
      (rows: string[]) => rows.map((line) =>
        line.replace("parties = definitions.map((item) => new Party(item))",
          "parties = definitions.map((item) => createParty(item))")),
    ];
    for (const modify of invalid) {
      const parsed = parseScriptFile("mapped-negative", modify(base).join("\n"), source);
      expect(parsed.arenaAuthorityPaths?.some((item) =>
        item.capacityCheck?.resolvedCapacityValue !== undefined
      )).toBe(false);
    }
  });

  it("rejects mutating method calls through mapped-config inspection aliases", () => {
    const base = [
      "const configs = [0, 1].map(id => ({ maxPlayers: 5, id }));",
      "var Party = class {",
      "  constructor(definition) { this.definition = definition; }",
      "  members = [];",
      "  join(p) { return this.members.length >= this.definition.maxPlayers",
      "    ? false : (this.members.push(p), true); }",
      "};",
      "const parties = configs.map(item => new Party(item));",
    ];
    const positive = parseScriptFile("readonly-some", [
      ...base,
      "configs.some(item => item.maxPlayers === 5);",
    ].join("\n"), source);
    expect(positive.arenaAuthorityPaths?.find(path =>
      path.capacityAuthorityProven
    )?.capacityCheck?.resolvedCapacityValue).toBe(5);

    for (const inspection of [
      "configs.some(item => item.__defineGetter__('maxPlayers', () => 9));",
      "configs.some(item => item.__defineSetter__('maxPlayers', value => {}));",
      "configs.some(item => item.valueOf());",
      "configs.some(item => item.nested.mutate());",
      "configs.some(item => item.maxPlayers++);",
      "configs.some(item => item.nested.value = 9);",
      "configs.some(item => leak(item.maxPlayers));",
    ]) {
      const parsed = parseScriptFile("unsafe-some", [
        ...base, inspection,
      ].join("\n"), source);
      expect(parsed.arenaAuthorityPaths?.some(path =>
        path.capacityCheck?.resolvedCapacityValue !== undefined
      )).toBe(false);
    }
  });

  it("rejects foreign callback effects and aliased source-array parameters", () => {
    const common = [
      "const configs = [0, 1].map(id => ({maxPlayers:5, id}));",
      "var Party = class {",
      "  constructor(definition) { this.definition = definition; }",
      "  members = [];",
      "  join(p) { return this.members.length >= this.definition.maxPlayers",
      "    ? false : (this.members.push(p), true); }",
      "};",
      "const parties = configs.map(item => new Party(item));",
    ];
    for (const safe of [
      "configs.some(item => item.maxPlayers === 5);",
      "configs.some(item => item.id === 0 || item.maxPlayers === 5);",
    ]) {
      const parsed = parseScriptFile("read-only-callback", [
        ...common, safe,
      ].join("\n"), source);
      expect(parsed.arenaAuthorityPaths?.find(path =>
        path.capacityAuthorityProven
      )?.capacityCheck?.resolvedCapacityValue).toBe(5);
    }
    for (const mutation of [
      "configs.some((unused, index, all) => all[index].__defineGetter__('maxPlayers', () => 9));",
      "configs.some(item => unknownSideEffect());",
      "configs.some(item => { const mutate = () => 9; return item.maxPlayers === 5; });",
      "configs.some(item => (globalCounter++, item.maxPlayers === 5));",
      "configs.some((item, index) => item.maxPlayers === 5);",
    ]) {
      const parsed = parseScriptFile("effectful-callback", [
        ...common, mutation,
      ].join("\n"), source);
      expect(parsed.arenaAuthorityPaths?.some(path =>
        path.capacityCheck?.resolvedCapacityValue !== undefined
      )).toBe(false);
    }
  });

  it("does not prove a map generator with hidden branches or partial execution", () => {
    const configured = (body: string): string => [
      "const configs = [0, 1].map((id) => {",
      body,
      "});",
      "var Party = class {",
      "  constructor(definition) { this.definition = definition; }",
      "  join(p) {",
      "    return this.members.length >= this.definition.maxPlayers",
      "      ? false : (this.members.push(p), true);",
      "  }",
      "};",
      "const party = new Party(configs[0]);",
      "party.join('player');",
    ].join("\n");
    for (const body of [
      "if (id) return {maxPlayers:9}; return {maxPlayers:5};",
      "if (id) throw Error('no config'); return {maxPlayers:5};",
      "switch (id) { case 0: return {maxPlayers:9}; default: return {maxPlayers:5}; }",
      "try { if (id) return {maxPlayers:9}; } finally {} return {maxPlayers:5};",
    ]) {
      const parsed = parseScriptFile("non-uniform-map", configured(body), source);
      expect(parsed.arenaAuthorityPaths?.some((path) =>
        path.capacityCheck?.resolvedCapacityValue !== undefined
      )).toBe(false);
    }
  });

  it("keeps sparse or spread-length map inputs unresolved", () => {
    const configured = (array: string, index: number): string => [
      `const configs = ${array}.map((id) => ({maxPlayers:5, id}));`,
      "var Party = class {",
      "  constructor(definition) { this.definition = definition; }",
      "  join(p) {",
      "    return this.members.length >= this.definition.maxPlayers",
      "      ? false : (this.members.push(p), true);",
      "  }",
      "};",
      `const party = new Party(configs[${index}]);`,
      "party.join('player');",
    ].join("\n");
    for (const [array, index] of [
      ["[, 1]", 0],
      ["[...[]]", 0],
      ["[0, ...[]]", 1],
    ] as const) {
      const parsed = parseScriptFile("sparse-map", configured(array, index), source);
      expect(parsed.arenaAuthorityPaths?.some((path) =>
        path.capacityCheck?.resolvedCapacityValue !== undefined
      )).toBe(false);
    }
  });

  it("does not prove mapped capacity from an async configuration producer", () => {
    const build = (asyncProducer: boolean) => [
      `const configs = [0, 1].map(${asyncProducer ? "async " : ""}(id) => ({maxPlayers:5, id}));`,
      "var Party = class {",
      "  constructor(definition) { this.definition = definition; }",
      "  members = [];",
      "  join(player) { return this.members.length >= this.definition.maxPlayers",
      "    ? false : (this.members.push(player), true); }",
      "};",
      "const party = new Party(configs[0]);",
      "party.join('one');",
    ].join("\n");
    const synchronous = parseScriptFile("sync-config", build(false), source);
    expect(synchronous.arenaAuthorityPaths?.find((path) =>
      path.capacityAuthorityProven
    )?.capacityCheck?.resolvedCapacityValue).toBe(5);
    const asynchronous = parseScriptFile("async-config", build(true), source);
    expect(asynchronous.arenaAuthorityPaths?.some((path) =>
      path.capacityCheck?.resolvedCapacityValue !== undefined
    )).toBe(false);
  });

  it("does not prove mapped capacity from asynchronous class allocations", () => {
    const build = (asyncAllocation: boolean) => [
      "const configs = [0, 1].map(id => ({maxPlayers:5, id}));",
      "var Party = class {",
      "  constructor(definition) { this.definition = definition; }",
      "  members = [];",
      "  join(player) { return this.members.length >= this.definition.maxPlayers",
      "    ? false : (this.members.push(player), true); }",
      "};",
      `const parties = configs.map(${asyncAllocation ? "async " : ""}(cfg) => new Party(cfg));`,
    ].join("\n");
    const synchronous = parseScriptFile("sync-alloc", build(false), source);
    expect(synchronous.arenaAuthorityPaths?.find((path) =>
      path.capacityAuthorityProven
    )?.capacityCheck?.resolvedCapacityValue).toBe(5);
    const asynchronous = parseScriptFile("async-alloc", build(true), source);
    expect(asynchronous.arenaAuthorityPaths?.some((path) =>
      path.capacityCheck?.resolvedCapacityValue !== undefined
    )).toBe(false);
  });

  it("does not prove numeric capacity from an exported map config collection", () => {
    const build = (prefix: string) => [
      prefix + " configs = [0, 1].map((id) => ({maxPlayers:5, id}));",
      "var Party = class {",
      "  constructor(definition) { this.definition = definition; }",
      "  members = [];",
      "  join(player) { return this.members.length >= this.definition.maxPlayers",
      "    ? false : (this.members.push(player), true); }",
      "};",
      "const party = new Party(configs[0]);",
      "party.join('one');",
    ].join("\n");
    const local = parseScriptFile("local-config", build("const"), source);
    expect(local.arenaAuthorityPaths?.find((path) =>
      path.capacityAuthorityProven
    )?.capacityCheck?.resolvedCapacityValue).toBe(5);
    for (const prefix of ["export const", "export var"]) {
      const exported = parseScriptFile("exported-config", build(prefix), source);
      expect(exported.arenaAuthorityPaths?.some((path) =>
        path.capacityCheck?.resolvedCapacityValue !== undefined
      )).toBe(false);
    }
  });

  it("rejects an out-of-range direct generated-config index", () => {
    const configured = (index: number): string => [
      "const configs = [0, 1].map((id) => ({maxPlayers:5, id}));",
      "var Party = class {",
      "  constructor(definition) { this.definition = definition; }",
      "  join(p) {",
      "    return this.members.length >= this.definition.maxPlayers",
      "      ? false : (this.members.push(p), true);",
      "  }",
      "};",
      `const party = new Party(configs[${index}]);`,
      "party.join('player');",
    ].join("\n");
    const lastValid = parseScriptFile("last-valid-index", configured(1), source);
    expect(lastValid.arenaAuthorityPaths?.find((path) =>
      path.capacityAuthorityProven
    )?.capacityCheck?.resolvedCapacityValue).toBe(5);
    for (const index of [2, 99]) {
      const parsed = parseScriptFile("out-of-range-index", configured(index), source);
      expect(parsed.arenaAuthorityPaths?.some((path) =>
        path.capacityCheck?.resolvedCapacityValue !== undefined
      )).toBe(false);
    }
  });

  it("rejects computed-key capacity overrides for mapped and direct constructor configs", () => {
    const generated = (value: string) => [
      "const configs = [0, 1].map((id) => (" + value + "));",
      "var Party = class {",
      "  constructor(definition) { this.definition = definition; }",
      "  members = [];",
      "  join(player) { return this.members.length >= this.definition.maxPlayers",
      "    ? false : (this.members.push(player), true); }",
      "};",
      "const party = new Party(configs[0]);",
      "party.join('one');",
    ].join("\n");
    const direct = (value: string) => [
      "class Party {",
      "  constructor(definition) { this.definition = definition; this.members = []; }",
      "  join(player) { return this.members.length >= this.definition.maxPlayers",
      "    ? false : (this.members.push(player), true); }",
      "}",
      "const party = new Party(" + value + ");",
      "party.join('one');",
    ].join("\n");
    for (const makeSource of [generated, direct]) {
      const safe = parseScriptFile("static-properties", makeSource(
        "{maxPlayers: 5, id: 1}"
      ), source);
      expect(safe.arenaAuthorityPaths?.find((path) =>
        path.capacityAuthorityProven
      )?.capacityCheck?.resolvedCapacityValue).toBe(5);

      for (const config of [
        '{maxPlayers: 5, ["maxPlayers"]: 9}',
        '{maxPlayers: 5, ["max" + "Players"]: 9}',
        '{maxPlayers: 5, ["other"]: 9}',
      ]) {
        const parsed = parseScriptFile(
          "computed-properties", makeSource(config), source,
        );
        expect(parsed.arenaAuthorityPaths?.some((path) =>
          path.capacityCheck?.resolvedCapacityValue !== undefined
        )).toBe(false);
      }
    }
  });

  it("keeps class-property-held mapped instances numerically UNKNOWN", () => {
    const common = [
      "const configs = [0, 1].map(id => ({ maxPlayers: 5, id }));",
      "var Party = class {",
      "  constructor(definition) { this.definition = definition; }",
      "  members = [];",
      "  join(p) { return this.members.length >= this.definition.maxPlayers",
      "    ? false : (this.members.push(p), true); }",
      "};",
    ];
    const fieldCases = [
      ["class Sessions { parties = configs.map(item => new Party(item)); }"],
      ["class Sessions { parties = configs.map(item => new Party(item)); }",
       "const owner = new Sessions(); owner.parties[0].definition.maxPlayers = 9;"],
      ["class Sessions { parties = configs.map(item => new Party(item)); }",
       "const owner = new Sessions(); leak(owner.parties);"],
      ["export class Sessions { parties = configs.map(item => new Party(item)); }"],
    ];
    for (const statements of fieldCases) {
      const parsed = parseScriptFile("class-field-owner-unknown", [
        ...common, ...statements,
      ].join("\n"), source);
      expect(parsed.arenaAuthorityPaths?.some((path) =>
        path.capacityCheck?.resolvedCapacityValue !== undefined
      )).toBe(false);
    }
    const local = parseScriptFile("const-owned-sessions", [
      ...common,
      "const parties = configs.map(item => new Party(item));",
      "parties[0].join('one');",
    ].join("\n"), source);
    expect(local.arenaAuthorityPaths?.find((path) =>
      path.capacityAuthorityProven
    )?.capacityCheck?.resolvedCapacityValue).toBe(5);
  });

  it("binds a const-owned mapped instance collection only through inspected methods", () => {
    const build = (usage: string, prefix = "const") => [
      "const configs = [0, 1].map(id => ({maxPlayers:5, id}));",
      "var Party = class {",
      "  constructor(definition) { this.definition = definition; }",
      "  members = [];",
      "  join(p) { return this.members.length >= this.definition.maxPlayers",
      "    ? false : (this.members.push(p), true); }",
      "};",
      prefix + " parties = configs.map(item => new Party(item));",
      usage,
    ].join("\n");
    for (const usage of ["", "parties[0].join('a');", "parties[1].join('a');"]) {
      const parsed = parseScriptFile("mapped-collection-owned", build(usage), source);
      expect(parsed.arenaAuthorityPaths?.find(path =>
        path.capacityAuthorityProven
      )?.capacityCheck?.resolvedCapacityValue).toBe(5);
    }
    for (const usage of [
      "parties[0].definition.maxPlayers = 9;",
      "parties[0]['definition'].maxPlayers = 9;",
      "const escaped = parties[0];",
      "leak(parties);",
      "parties[99].join('a');",
      "parties.forEach(p => mutate(p));",
    ]) {
      const parsed = parseScriptFile("mapped-collection-unsafe", build(usage), source);
      expect(parsed.arenaAuthorityPaths?.some(path =>
        path.capacityCheck?.resolvedCapacityValue !== undefined
      )).toBe(false);
    }
    for (const prefix of ["export const", "let", "var"]) {
      const parsed = parseScriptFile("mapped-collection-owner", build("", prefix), source);
      expect(parsed.arenaAuthorityPaths?.some(path =>
        path.capacityCheck?.resolvedCapacityValue !== undefined
      )).toBe(false);
    }
  });

  it("does not adopt a mapped instance collection passed to an unknown caller", () => {
    const sourceText = [
      "const configs = [0, 1].map(id => ({maxPlayers:5, id}));",
      "var Party = class {",
      "  constructor(definition) { this.definition = definition; }",
      "  members = [];",
      "  join(p) { return this.members.length >= this.definition.maxPlayers",
      "    ? false : (this.members.push(p), true); }",
      "};",
      "leak(configs.map(item => new Party(item)));",
    ].join("\n");
    const parsed = parseScriptFile("mapped-result-leak", sourceText, source);
    expect(parsed.arenaAuthorityPaths?.some(path =>
      path.capacityCheck?.resolvedCapacityValue !== undefined
    )).toBe(false);
  });

  it("does not turn recovery-only over-capacity validation into an admission guard", () => {
    const parsed = parseScriptFile("recovery-only", [
      "var definitions = [0, 1].map((id) => ({maxPlayers: 5}));",
      "function restore(session) {",
      "  if (session.members.length > 5) throw Error('invalid saved roster');",
      "  return session;",
      "}",
    ].join("\n"), source);
    expect(parsed.arenaAuthorityPaths?.some((item) =>
      item.capacityAuthorityProven || item.capacityCheck?.resolvedCapacityValue !== undefined
    )).toBe(false);
  });

  it("distinguishes a constructor formal from an identically named this.field", () => {
    for (const formalName of ["definition", "options"]) {
      const script = [
        "class Party {",
        "  constructor(" + formalName + ") { this.definition = " + formalName + "; this.members = []; }",
        "  join(player) {",
        "    return this.members.length >= this.definition.maxPlayers",
        "      ? false : (this.members.push(player), true);",
        "  }",
        "}",
        "const party = new Party({ maxPlayers: 5 });",
        "party.join('test');",
      ].join("\n");
      const parsed = parseScriptFile("constructor-names", script, source);
      const bound = parsed.arenaAuthorityPaths?.find((item) =>
        item.capacityAuthorityProven
      )?.capacityCheck;
      expect(bound?.resolvedCapacityValue).toBe(5);
      expect(bound?.resolvedCapacitySource?.range?.lineStart).toBe(8);
    }
  });

  it("resolves a literal constructor-to-instance cap through the existing field binding", () => {
    const script = [
      "class Party {",
      "  constructor(definition) { this.definition = definition; this.members = []; }",
      "  join(player) {",
      "    return this.members.length >= this.definition.maxPlayers",
      "      ? false : (this.members.push(player), true);",
      "  }",
      "}",
      "const party = new Party({ maxPlayers: 5 });",
      "party.join('test');",
    ].join("\n");
    const parsed = parseScriptFile("constructor-capacity",script,source);
    const cap = parsed.arenaAuthorityPaths?.find((item) => item.capacityAuthorityProven)?.capacityCheck;
    expect(cap).toMatchObject({
      capacityExpression: "this.definition.maxPlayers",
      resolvedCapacityValue: 5,
      resolvedCapacitySource: expect.objectContaining({range:expect.objectContaining({lineStart:8})}),
    });
    expect(cap?.resolvedCapacityWitnesses).toHaveLength(2);
  });

  it("keeps constructor dynamic values, escapes, conflicting values and mutations UNKNOWN", () => {
    const header = [
      "class Party {",
      "  constructor(definition) { this.definition = definition; this.members = []; }",
      "  join(player) {",
      "    return this.members.length >= this.definition.maxPlayers",
      "      ? false : (this.members.push(player), true);",
      "  }",
      "}",
    ].join("\n");
    const variants = [
      "const party = new Party(config); party.join('test');",
      "const a = new Party({maxPlayers:5}); const b = new Party({maxPlayers:3}); a.join('test');",
      "const a = new Party({maxPlayers:5}); leak(a);",
      "const a = new Party({maxPlayers:5}); a.definition.maxPlayers = 9;",
      "const a = new Party({maxPlayers:5}); const b = a; a.join('test');",
      "const a = new Party({maxPlayers:5}); a.definition = {maxPlayers:9};",
    ];
    for(const variant of variants){
      const parsed = parseScriptFile("constructor-unknown",header+"\n"+variant,source);
      const check = parsed.arenaAuthorityPaths?.find((item)=>item.capacityAuthorityProven)?.capacityCheck;
      expect(check?.resolvedCapacityValue).toBeUndefined();
    }
    const unsafeConstructors = [
      header.replace("this.definition = definition; this.members = [];",
        "this.definition = definition; this.other = definition; this.members = [];"),
      header.replace("this.definition = definition; this.members = [];",
        "this.definition = definition; Object.assign(this, {definition:{maxPlayers:9}}); this.members = [];"),
      header.replace("this.definition = definition; this.members = [];",
        "this.definition = definition; this['definition']={maxPlayers:9}; this.members = [];"),
      header.replace("class Party {","class Party extends Base {"),
    ];
    for(const definition of unsafeConstructors){
      const parsed = parseScriptFile("constructor-unsafe",
        definition+"\nconst party = new Party({maxPlayers:5}); party.join('test');",source);
      const cap = parsed.arenaAuthorityPaths?.find((item)=>item.capacityAuthorityProven)?.capacityCheck;
      expect(cap?.resolvedCapacityValue).toBeUndefined();
    }
  });

  it("does not prove capacity ownership when a local limit belongs to a different arena object", () => {
    const parsed = parseScriptFile(
      "arena",
      [
        "function join(arena, otherArena, player) {",
        "  const maxPlayers = otherArena.maxPlayers;",
        "  if (arena.members.size >= maxPlayers) return;",
        "  arena.members.add(player);",
        "}",
      ].join("\n"),
      source,
    );

    expect(
      parsed.arenaAuthorityPaths?.find(
        (path) =>
          path.arenaExpression === "arena",
      ),
    ).toMatchObject({
      capacityAuthorityProven: false,
    });
  });


  it("links a return-ternary rejection guard only to its successful membership commit", () => {
    const parsed = parseScriptFile(
      "minified-party",
      [
        "class Party {",
        "  join(player) {",
        "    return !['waiting','countdown'].includes(this.phase) ||",
        "      this.members.length >= this.definition.maxPlayers ||",
        "      this.members.includes(player)",
        "      ? !1 : (this.members.push(player), this.ready.delete(player), !0);",
        "  }",
        "}",
      ].join("\n"),
      source,
    );
    const path = parsed.arenaAuthorityPaths?.find(
      (item) => item.arenaExpression === "this" &&
        item.capacityCheck?.capacityExpression ===
          "this.definition.maxPlayers",
    );
    expect(path).toMatchObject({
      capacityAuthorityProven: true,
      capacityCheck: expect.objectContaining({
        membershipExpression: "this.members",
        executionRegion: expect.stringMatching(/^method:Party\.join@\d+$/),
        source: expect.objectContaining({
          range: expect.objectContaining({ lineStart: 4 }),
        }),
      }),
      membershipCommit: expect.objectContaining({
        membershipExpression: "this.members",
        executionRegion: expect.stringMatching(/^method:Party\.join@\d+$/),
      }),
    });
  });

  it("does not confuse a wrong-owner or wrong-polarity ternary with enforced membership capacity", () => {
    const wrongOwner = parseScriptFile(
      "other",
      [
        "class Party {",
        "  join(player, other) {",
        "    return this.members.length >= this.definition.maxPlayers",
        "      ? false : (other.members.push(player), true);",
        "  }",
        "}",
      ].join("\n"),
      source,
    );
    expect(wrongOwner.arenaAuthorityPaths?.some(
      (path) => path.capacityAuthorityProven,
    )).toBe(false);

    const wrongPolarity = parseScriptFile(
      "reversed",
      [
        "class Party {",
        "  join(player) {",
        "    return this.members.length >= this.definition.maxPlayers",
        "      ? (this.members.push(player), true) : false;",
        "  }",
        "}",
      ].join("\n"),
      source,
    );
    expect(wrongPolarity.arenaAuthorityPaths?.some(
      (path) => path.capacityAuthorityProven,
    )).toBe(false);

    const wrongConfig = parseScriptFile(
      "different-config",
      [
        "class Party {",
        "  join(player, other) {",
        "    return this.members.length >= other.definition.maxPlayers",
        "      ? false : (this.members.push(player), true);",
        "  }",
        "}",
      ].join("\n"),
      source,
    );
    expect(wrongConfig.arenaAuthorityPaths?.some(
      (path) => path.capacityAuthorityProven,
    )).toBe(false);
  });

  it("rejects an inverted capacity comparison even with the correct membership owner", () => {
    const parsed = parseScriptFile(
      "reversed-limit",
      [
        "class Party {",
        "  join(player) {",
        "    return this.members.length < this.definition.maxPlayers",
        "      ? false : (this.members.push(player), true);",
        "  }",
        "}",
      ].join("\n"),
      source,
    );
    expect(parsed.arenaAuthorityPaths?.some(
      (path) => path.capacityAuthorityProven,
    )).toBe(false);
  });

  it("does not credit AND-guard fallthrough as capacity enforcement", () => {
    const parsed = parseScriptFile(
      "and-fallthrough",
      [
        "class Party {",
        "  join(player, disabled) {",
        "    return this.members.length >= this.definition.maxPlayers && disabled",
        "      ? false : (this.members.push(player), true);",
        "  }",
        "}",
      ].join("\n"),
      source,
    );
    expect(parsed.arenaAuthorityPaths?.some(
      (path) => path.capacityAuthorityProven,
    )).toBe(false);
  });

  it("rejects greater-than guards that permit over-capacity joins", () => {
    const parsed = parseScriptFile("unsafe-greater-than", [
      "class Party {",
      "  join(player) {",
      "    return this.members.length > 5 ? false : (this.members.push(player), true);",
      "  }",
      "}",
    ].join("\n"), source);
    expect(parsed.arenaAuthorityPaths?.some((path) => path.capacityAuthorityProven)).toBe(false);
  });

  it("keeps same-named class methods in separate authority regions", () => {
    const parsed = parseScriptFile("class-scopes", [
      "class Limited {",
      "  join(player) {",
      "    if (this.members.length >= 5) return;",
      "    this.members.push(player);",
      "  }",
      "}",
      "class Open {",
      "  join(player) {",
      "    this.members.push(player);",
      "  }",
      "}",
    ].join("\n"), source);
    const paths = parsed.arenaAuthorityPaths ?? [];
    expect(paths).toHaveLength(2);
    expect(paths.filter((path) => path.capacityAuthorityProven)).toHaveLength(1);
    expect(paths.find((path) => path.executionRegion.startsWith("method:Limited.join@"))?.capacityAuthorityProven).toBe(true);
    expect(paths.find((path) => path.executionRegion.startsWith("method:Open.join@"))?.capacityAuthorityProven).toBe(false);
    expect(paths.find(path => path.executionRegion.startsWith("method:Limited.join@"))
      ?.parserExecutionRegion).toMatch(/^function:Limited\.join@\d+:\d+$/);
    expect(paths.find(path => path.executionRegion.startsWith("method:Open.join@"))
      ?.parserExecutionRegion).toMatch(/^function:Open\.join@\d+:\d+$/);
  });

  it("does not close capacity when a second unguarded roster write follows", () => {
    const parsed = parseScriptFile("double-commit", [
      "function join(arena, player) {",
      "  if (arena.members.length >= 5) return;",
      "  arena.members.push(player);",
      "  arena.members.push(player);",
      "}",
    ].join("\n"), source);
    expect(parsed.arenaAuthorityPaths?.some((path) => path.capacityAuthorityProven)).toBe(false);
  });

  it("distinguishes same-named nested and top-level join functions", () => {
    const parsed = parseScriptFile("two-functions", [
      "function join(arena, player) {",
      "  if (arena.members.length >= 5) return;",
      "  arena.members.push(player);",
      "}",
      "function outer() {",
      "  function join(arena, player) {",
      "    if (arena.members.length >= 9) return;",
      "    arena.members.push(player);",
      "  }",
      "}",
    ].join("\n"), source);
    const paths = (parsed.arenaAuthorityPaths ?? []).filter((path) => path.capacityAuthorityProven);
    expect(paths).toHaveLength(2);
    expect(new Set(paths.map((path) => path.executionRegion)).size).toBe(2);
    // The parser's bare function:join key is ambiguous for these two owners.
    expect(paths.every(path => path.parserExecutionRegion === undefined)).toBe(true);
  });

  it("proves start ownership only when owner acquisition and start-state commit share the same arena path", () => {
    const parsed = parseScriptFile(
      "arena",
      [
        "function start(arena) {",
        "  const arenaGeneration = arena.generation;",
        "  arena.startOwner = arenaGeneration;",
        '  arena.state = "countdown";',
        "}",
      ].join("\n"),
      source,
    );

    expect(
      parsed.arenaAuthorityPaths?.find(
        (path) =>
          path.arenaExpression === "arena",
      ),
    ).toMatchObject({
      startAuthorityProven: true,
      generationOperand: expect.objectContaining({
        kind: "arena-generation-operand",
        generationExpression: "arenaGeneration",
      }),
      startOwnerAcquire: expect.objectContaining({
        kind: "start-owner-acquire",
        ownerExpression: "arenaGeneration",
        generationExpression: "arenaGeneration",
      }),
      startStateCommit: expect.objectContaining({
        kind: "start-state-commit",
        stateExpression: "arena.state=countdown",
      }),
    });
  });

  it("does not merge start ownership across different arena objects", () => {
    const parsed = parseScriptFile(
      "arena",
      [
        "function start(arena, otherArena) {",
        "  const arenaGeneration = arena.generation;",
        "  otherArena.startOwner = arenaGeneration;",
        '  arena.state = "countdown";',
        "}",
      ].join("\n"),
      source,
    );

    expect(
      parsed.arenaAuthorityPaths?.find(
        (path) =>
          path.arenaExpression === "arena",
      ),
    ).toMatchObject({
      startAuthorityProven: false,
    });
  });

  it("keeps join-pad or queue-like arrays outside arena authority unless the authored property is an explicit membership surface", () => {
    const parsed = parseScriptFile(
      "arena",
      [
        "function join(arena, player) {",
        "  arena.queue.push(player);",
        "}",
      ].join("\n"),
      source,
    );

    expect(parsed.arenaAuthorityEvidence).toEqual([]);
    expect(parsed.arenaAuthorityPaths).toEqual([]);
  });

  it("flags a ready-set snapshot reused by a delayed start callback", () => {
    const parsed = parseScriptFile(
      "arena",
      [
        "function beginCountdown(arena) {",
        "  const readyCount = arena.readyPlayers.size;",
        "  system.runTimeout(() => {",
        "    if (readyCount < arena.maxPlayers) return;",
        "    arena.state = 'active';",
        "  }, 20);",
        "}",
      ].join("\n"),
      source,
    );

    expect(
      parsed.arenaAuthorityEvidence,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind:
            "ready-set-snapshot-risk",
          arenaExpression: "arena",
          subjectExpression:
            "readyCount",
          membershipExpression:
            "arena.readyPlayers",
        }),
      ]),
    );
  });

  it("does not flag a delayed start that re-reads the current ready set", () => {
    const parsed = parseScriptFile(
      "arena",
      [
        "function beginCountdown(arena) {",
        "  const readyCount = arena.readyPlayers.size;",
        "  system.runTimeout(() => {",
        "    if (arena.readyPlayers.size < arena.maxPlayers) return;",
        "    arena.state = 'active';",
        "  }, 20);",
        "}",
      ].join("\n"),
      source,
    );

    expect(
      parsed.arenaAuthorityEvidence
        ?.some(
          (item) =>
            item.kind ===
              "ready-set-snapshot-risk",
        ),
    ).toBe(false);
  });

  it("proves explicit ordered terminal outcome precedence only when the terminal owner consumes it", () => {
    const sourceText = [
      "const RESULT_PRECEDENCE = ['objective', 'timeout', 'disconnect'];",
      "function endGame(candidates) {",
      "  return RESULT_PRECEDENCE.find((reason) => candidates.has(reason));",
      "}",
    ].join("\n");

    expect(
      deriveScriptTerminalPrecedenceEvidence(
        sourceText,
        source,
      ),
    ).toEqual([
      expect.objectContaining({
        functionRegion:
          "function:endGame",
        policyBinding:
          "RESULT_PRECEDENCE",
        policyKind:
          "ordered-outcomes",
        outcomes: [
          "objective",
          "timeout",
          "disconnect",
        ],
      }),
    ]);
  });

  it("does not credit an unused precedence declaration as terminal resolution proof", () => {
    const sourceText = [
      "const RESULT_PRECEDENCE = ['objective', 'timeout'];",
      "function endGame(result) {",
      "  return result;",
      "}",
    ].join("\n");

    expect(
      deriveScriptTerminalPrecedenceEvidence(
        sourceText,
        source,
      ),
    ).toEqual([]);
  });
});
