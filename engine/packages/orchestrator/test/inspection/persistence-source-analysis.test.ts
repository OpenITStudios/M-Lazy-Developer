import { describe, expect, it } from "vitest";
import {
  parseScriptFile,
} from "../../../../analyzers/scripts/src/index.js";
import {
  analyzePersistenceSource,
} from "../../src/inspection/persistence-source-analysis.js";

describe("persistence source analysis", () => {
  it("flags only unguarded fallible commit before later write and feedback", () => {
    const parse = (source: string) => parseScriptFile("transaction", source, {
      artifactId: "fixture:persistence", relativePath: "scripts/transactions.ts",
    });
    const positive = parse([
      "function commitResult() {",
      "  if (!journal.set('score', 2)) return false;",
      "  return true;",
      "}",
      "function publish() {",
      "  commitResult();",
      "  messageBus.enqueue('done');",
      "  sessionStore.set('completed', true);",
      "}",
    ].join("\n"));
    const signals = analyzePersistenceSource([positive]).ignoredCommitBeforeFeedback;
    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({
      calleeName: "commitResult", callerRegion: "function:publish",
      callSource: { range: { lineStart: 6 } },
      failedReturnSource: { range: { lineStart: 2 } },
      laterWriteSource: { range: { lineStart: 8 } },
      laterFeedbackSource: { range: { lineStart: 7 } },
      proof: "SOURCE_FAILURE_PATH_AND_SUCCESS_CANDIDATE_NOT_PROVEN_BUG",
    });
    for (const rejected of [
      // Return handling prevents a syntactically discarded failure.
      "function publish() { if (!commitResult()) return; messageBus.enqueue('done'); sessionStore.set('completed', true); }",
      "function publish() { const ok = commitResult(); if (!ok) return; messageBus.enqueue('done'); sessionStore.set('completed', true); }",
      // No success-presentation + write pair; not a transaction claim.
      "function publish() { commitResult(); messageBus.enqueue('done'); }",
      "function publish() { commitResult(); sessionStore.set('completed', true); }",
      // The global identifier is shadowed; cannot prove which function ran.
      "function publish(commitResult) { commitResult(); messageBus.enqueue('done'); sessionStore.set('completed', true); }",
    ]) {
      const fixture = parse([
        "function commitResult() {",
        "  if (!journal.set('score', 2)) return false;",
        "  return true;",
        "}", rejected,
      ].join("\n"));
      expect(analyzePersistenceSource([fixture]).ignoredCommitBeforeFeedback)
        .toEqual([]);
    }
  });

  it("identifies branch-local state commit before ignored failure and sibling success feedback", () => {
    const source = (body: readonly string[], signature = "finishAscent(player, ready)") =>
      parseScriptFile("transaction", [
        "function completeGameplayObjective() {",
        "  if (!sessions.set('score', 250)) return false;",
        "  return true;",
        "}",
        "function " + signature + " {",
        ...body,
        "}",
      ].join("\n"), {
        artifactId: "fixture:aftershock-pattern",
        relativePath: "scripts/ascent.js",
      });
    const candidate = source([
      "  if (ready) {",
      "    const stopped = stopTimer();",
      "    runtimeDb.set('state', 'ascent_complete_waiting');",
      "    completeGameplayObjective();",
      "  }",
      "  player.onScreenDisplay.setActionBar('Ascent Complete');",
      "  playCompleteCue(player);",
    ]);
    const findings = analyzePersistenceSource([candidate]).ignoredCommitBeforeFeedback;
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      callerRegion: "function:finishAscent",
      calleeName: "completeGameplayObjective",
      callSource: { range: { lineStart: 9 } },
      failedReturnSource: { range: { lineStart: 2 } },
      precedingWriteSource: { range: { lineStart: 8 } },
      laterFeedbackSource: { range: { lineStart: 11 } },
      proof: "SOURCE_FAILURE_PATH_AND_SUCCESS_CANDIDATE_NOT_PROVEN_BUG",
    });
    expect(findings[0].laterWriteSource).toBeUndefined();
    // Control cases: guarded result, missing state write, unproven feedback
    // reachability, and ambiguous local identity must not be promoted.
    const rejected: { body: string[]; signature?: string }[] = [
      { body: [
        "  if (ready) {",
        "    runtimeDb.set('state', 'complete');",
        "    if (!completeGameplayObjective()) return;",
        "  }",
        "  player.onScreenDisplay.setActionBar('Ascent Complete');",
      ] },
      { body: [
        "  if (ready) {",
        "    completeGameplayObjective();",
        "  }",
        "  player.onScreenDisplay.setActionBar('Ascent Complete');",
      ] },
      { body: [
        "  if (ready) {",
        "    runtimeDb.set('state', 'complete');",
        "    completeGameplayObjective();",
        "  }",
        "  if (needsReconciliation()) return;",
        "  player.onScreenDisplay.setActionBar('Ascent Complete');",
      ] },
      { body: [
        "  if (ready) {",
        "    runtimeDb.set('state', 'complete');",
        "    completeGameplayObjective();",
        "  }",
        "  if (ready) player.onScreenDisplay.setActionBar('Ascent Complete');",
      ] },
      { body: [
        "  if (ready) {",
        "    runtimeDb.set('state', 'complete');",
        "    completeGameplayObjective();",
        "  }",
        "  player.onScreenDisplay.setActionBar('Ascent Complete');",
      ], signature: "finishAscent(player, ready, completeGameplayObjective)" },
    ];
    for (const { body, signature } of rejected) {
      const map = source(body, signature);
      expect(analyzePersistenceSource([map]).ignoredCommitBeforeFeedback)
        .toEqual([]);
    }
  });

  it("traces two unique same-file direct-return forwarders to an explicit failed write", () => {
    const parse = (text: string) => parseScriptFile("flow", text, {
      artifactId: "fixture:forwarded", relativePath: "scripts/flow.ts",
    });
    const observed = parse([
      "function leafCommit() {",
      "  if (!db.set('score', 4)) return false;",
      "  return true;",
      "}",
      "function oneHop() { return leafCommit(); }",
      "function twoHop() { return oneHop(); }",
      "function after() {",
      "  twoHop();",
      "  player.sendMessage('complete');",
      "  state.set('completed', true);",
      "}",
      "function branch() {",
      "  if (ready) {",
      "    state.set('completed', true);",
      "    twoHop();",
      "  }",
      "  player.sendMessage('complete');",
      "}",
    ].join("\n"));
    const found = analyzePersistenceSource([observed]).ignoredCommitBeforeFeedback;
    expect(found).toHaveLength(2);
    for (const signal of found) {
      expect(signal).toMatchObject({
        calleeName: "twoHop",
        failedReturnSource: { range: { lineStart: 2 } },
        failurePropagationPath: ["twoHop", "oneHop", "leafCommit"],
        forwardingReturnSources: [
          { range: { lineStart: 6 } },
          { range: { lineStart: 5 } },
        ],
        proof: "SOURCE_FAILURE_PATH_AND_SUCCESS_CANDIDATE_NOT_PROVEN_BUG",
      });
    }
    expect(found.find(x => x.callerRegion === "function:after"))
      .toMatchObject({ laterWriteSource: { range: { lineStart: 10 } } });
    expect(found.find(x => x.callerRegion === "function:branch"))
      .toMatchObject({ precedingWriteSource: { range: { lineStart: 14 } } });
  });

  it("abstains on shadowed, async, indirect, out-of-depth and handled failure paths", () => {
    const leaf = [
      "function leafCommit() {",
      "  if (!db.set('score', 4)) return false;",
      "  return true;",
      "}",
      "function oneHop() { return leafCommit(); }",
    ];
    const caller = "function publish() { nextHop(); player.sendMessage('complete'); state.set('completed', true); }";
    for (const forwarding of [
      "function nextHop(oneHop) { return oneHop(); }",
      "function nextHop() { const oneHop = () => true; return oneHop(); }",
      "function nextHop() { return oneHop() || true; }",
      "function nextHop() { try { return oneHop(); } catch { return true; } }",
      "async function nextHop() { return oneHop(); }",
      "function nextHop() { return opaque.set('score', 4); }",
    ]) {
      const doc = parseScriptFile("negative", [...leaf, forwarding, caller].join("\n"), {
        artifactId: "fixture:recovery-negative", relativePath: "scripts/recovery.ts",
      });
      expect(analyzePersistenceSource([doc]).ignoredCommitBeforeFeedback).toEqual([]);
    }
    const beyond = parseScriptFile("depth", [
      ...leaf,
      "function middle() { return oneHop(); }",
      "function nextHop() { return middle(); }",
      caller,
    ].join("\n"), {
      artifactId: "fixture:depth", relativePath: "scripts/depth.ts",
    });
    expect(analyzePersistenceSource([beyond]).ignoredCommitBeforeFeedback).toEqual([]);
    const asyncLeaf = parseScriptFile("async-leaf", [
      "async function leafCommit() { if (!db.set('score', 4)) return false; return true; }",
      "function publish() { leafCommit(); player.sendMessage('complete'); state.set('complete', true); }",
    ].join("\n"), {
      artifactId: "fixture:async-leaf", relativePath: "scripts/async-leaf.ts",
    });
    expect(analyzePersistenceSource([asyncLeaf]).ignoredCommitBeforeFeedback)
      .toEqual([]);
    const handled = parseScriptFile("handled", [
      ...leaf,
      "function nextHop() { return oneHop(); }",
      "function publish() {",
      "  if (!nextHop()) return;",
      "  player.sendMessage('complete');",
      "  state.set('completed', true);",
      "}",
    ].join("\n"), {
      artifactId: "fixture:handled", relativePath: "scripts/handled.ts",
    });
    expect(analyzePersistenceSource([handled]).ignoredCommitBeforeFeedback).toEqual([]);
  });

  it("does not borrow success feedback across unknown recovery or control flow", () => {
    const parse = (body: readonly string[]) => parseScriptFile("recovery", [
      "function commit() { if (!db.set('score', 4)) return false; return true; }",
      "function publish() {", ...body, "}",
    ].join("\n"), {
      artifactId: "fixture:recovery", relativePath: "scripts/recovery.ts",
    });
    for (const rejected of [
      ["  commit();", "  retryOrRollback();",
       "  player.sendMessage('complete');", "  state.set('complete', true);"],
      ["  commit();",
       "  if (ready) { player.sendMessage('complete'); state.set('complete', true); }"],
      ["  commit();", "  try { state.set('complete', true); } catch {}",
       "  player.sendMessage('complete');"],
      ["  function commit() { return true; }", "  commit();",
       "  player.sendMessage('complete');", "  state.set('complete', true);"],
      ["  if (ready) { state.set('complete', true); commit(); }",
       "  reconcileState();", "  player.sendMessage('complete');"],
      ["  if (ready) { state.set('complete', true); commit(); }",
       "  const recovered = reconcileState();", "  player.sendMessage('complete');"],
    ]) {
      expect(analyzePersistenceSource([parse(rejected)])
        .ignoredCommitBeforeFeedback).toEqual([]);
    }
    expect(analyzePersistenceSource([parse([
      "  commit();", "  player.sendMessage('complete');",
      "  state.set('complete', true);",
    ])]).ignoredCommitBeforeFeedback).toHaveLength(1);
    expect(analyzePersistenceSource([parse([
      "  try { commit(); player.sendMessage('complete');",
      "    state.set('complete', true); }",
      "  catch { state.set('recovered', true); }",
    ])]).ignoredCommitBeforeFeedback).toEqual([]);
    expect(analyzePersistenceSource([parse([
      "  if (ready) { state.set('complete', true); commit(); }",
      "  player.sendMessage('complete');",
    ])]).ignoredCommitBeforeFeedback).toHaveLength(1);
  });

  it("resolves same-file class methods and named nested closures by owner", () => {
    const parsed = parseScriptFile("owner", [
      "class FirstRound {",
      "  commit() { if (!storage.set('score', 4)) return false; return true; }",
      "  finish() {",
      "    this.commit();",
      "    player.sendMessage('complete');",
      "    state.set('done', true);",
      "  }",
      "}",
      "class SecondRound {",
      "  commit() { return true; }",
      "  finish() {",
      "    this.commit();",
      "    player.sendMessage('complete');",
      "    state.set('done', true);",
      "  }",
      "}",
      "function outer() {",
      "  function commit() { if (!storage.set('score', 5)) return false; return true; }",
      "  const finish = () => {",
      "    commit();",
      "    player.sendMessage('complete');",
      "    state.set('done', true);",
      "  };",
      "  finish();",
      "}",
    ].join("\n"), {
      artifactId: "fixture:scope-ownership",
      relativePath: "scripts/owners.js",
    });
    const found = analyzePersistenceSource([parsed]).ignoredCommitBeforeFeedback;
    expect(found).toHaveLength(2);
    expect(found).toEqual(expect.arrayContaining([
      expect.objectContaining({
        callerRegion: "class:FirstRound.finish",
        calleeName: "this.commit",
        callSource: { range: { lineStart: 4 } },
        failedReturnSource: { range: { lineStart: 2 } },
        proof: "SOURCE_FAILURE_PATH_AND_SUCCESS_CANDIDATE_NOT_PROVEN_BUG",
      }),
      expect.objectContaining({
        callerRegion: "function:outer/finish",
        calleeName: "commit",
        callSource: { range: { lineStart: 20 } },
        failedReturnSource: { range: { lineStart: 18 } },
      }),
    ]));
    expect(found.some(row => row.callerRegion.includes("SecondRound"))).toBe(false);
  });

  it("keeps bounded return-forwarding within a single lexical or class owner", () => {
    const parsed = parseScriptFile("scoped-forward", [
      "class Owned {",
      "  commit() { if (!storage.set('score', 4)) return false; return true; }",
      "  forward() { return this.commit(); }",
      "  publish() {",
      "    this.forward();",
      "    player.sendMessage('complete');",
      "    state.set('done', true);",
      "  }",
      "}",
      "function outer() {",
      "  function commit() { if (!storage.set('score', 5)) return false; return true; }",
      "  function forward() { return commit(); }",
      "  function finish() {",
      "    forward();",
      "    player.sendMessage('complete');",
      "    state.set('done', true);",
      "  }",
      "}",
    ].join("\n"), {
      artifactId: "fixture:scoped-forward", relativePath: "scripts/forward.js",
    });
    const found = analyzePersistenceSource([parsed]).ignoredCommitBeforeFeedback;
    expect(found).toHaveLength(2);
    expect(found.find(row => row.callerRegion === "class:Owned.publish"))
      .toMatchObject({
        failurePropagationPath: ["class:Owned.forward", "class:Owned.commit"],
        forwardingReturnSources: [{ range: { lineStart: 3 } }],
        failedReturnSource: { range: { lineStart: 2 } },
      });
    expect(found.find(row => row.callerRegion === "function:outer/finish"))
      .toMatchObject({
        failurePropagationPath: ["outer::forward", "outer::commit"],
        forwardingReturnSources: [{ range: { lineStart: 12 } }],
        failedReturnSource: { range: { lineStart: 11 } },
      });
  });

  it("abstains on ambiguous class receivers, unrelated owners and local shadows", () => {
    const cases = [
      [
        "class Other {",
        "  commit() { if (!db.set('score', 4)) return false; return true; }",
        "}",
        "class Different {",
        "  finish() { this.commit(); ui.sendMessage('done'); state.set('done', true); }",
        "}",
      ],
      [
        "class Base {",
        "  commit() { if (!db.set('score', 4)) return false; return true; }",
        "}",
        "class Derived extends Base {",
        "  finish() { this.commit(); ui.sendMessage('done'); state.set('done', true); }",
        "}",
      ],
      [
        "class Owned {",
        "  commit() { if (!db.set('score', 4)) return false; return true; }",
        "  finish(obj) { obj.commit(); ui.sendMessage('done'); state.set('done', true); }",
        "}",
      ],
      [
        "class Owned {",
        "  static commit() { if (!db.set('score', 4)) return false; return true; }",
        "  finish() { this.commit(); ui.sendMessage('done'); state.set('done', true); }",
        "}",
      ],
      [
        "class Owned {",
        "  commit() { if (!db.set('score', 4)) return false; return true; }",
        "  finish() { this['commit'](); ui.sendMessage('done'); state.set('done', true); }",
        "}",
      ],
      [
        "class Owned {",
        "  commit() { if (!db.set('score', 4)) return false; return true; }",
        "  finish() {",
        "    function inner() {",
        "      this.commit(); ui.sendMessage('done'); state.set('done', true);",
        "    }",
        "    inner();",
        "  }",
        "}",
      ],
      [
        "function commit() { if (!db.set('score', 4)) return false; return true; }",
        "function outer() {",
        "  const commit = null;",
        "  const inner = () => {",
        "    commit(); ui.sendMessage('done'); state.set('done', true);",
        "  };",
        "}",
      ],
      [
        "class Owned {",
        "  commit() { if (!db.set('score', 4)) return false; return true; }",
        "  finish() {",
        "    jobs.forEach(() => this.commit());",
        "    ui.sendMessage('done');",
        "    state.set('done', true);",
        "  }",
        "}",
      ],
    ];
    for (const [index, lines] of cases.entries()) {
      const parsed = parseScriptFile("negative-" + index, lines.join("\n"), {
        artifactId: "fixture:scoped-negative", relativePath: "scripts/negatives.js",
      });
      expect(analyzePersistenceSource([parsed]).ignoredCommitBeforeFeedback)
        .toEqual([]);
    }
  });

  it("preserves source columns for one-line class-method bundles", () => {
    const source = "class C{commit(){if(!db.set('x',1))return false;return true;}finish(){this.commit();ui.sendMessage('done');state.set('done',true);}}";
    const parsed = parseScriptFile("minified", source, {
      artifactId: "fixture:minified", relativePath: "scripts/bundle.min.js",
    });
    const findings = analyzePersistenceSource([parsed]).ignoredCommitBeforeFeedback;
    expect(findings).toHaveLength(1);
    expect(findings[0].callSource.range).toMatchObject({ lineStart: 1 });
    expect(findings[0].callSource.range!.columnStart).toBeGreaterThan(1);
    expect(findings[0].failedReturnSource.range).toMatchObject({ lineStart: 1 });
  });

  it("owns static methods inside bundled class expressions separately from instance methods", () => {
    const parsed = parseScriptFile("static-class-bundle", [
      "var Service = class {",
      "  static commit() { if (!db.set('score', 4)) return false; return true; }",
      "  static finish() {",
      "    this.commit();",
      "    player.sendMessage('complete');",
      "    state.set('done', true);",
      "  }",
      "  static finishNamed() {",
      "    Service.commit();",
      "    player.sendMessage('complete');",
      "    state.set('done', true);",
      "  }",
      "  finishInstance() {",
      "    this.commit();",
      "    player.sendMessage('complete');",
      "    state.set('done', true);",
      "  }",
      "};",
      "var Unrelated = class {",
      "  static commit() { return true; }",
      "  static finish() {",
      "    this.commit();",
      "    player.sendMessage('complete');",
      "    state.set('done', true);",
      "  }",
      "};",
    ].join("\n"), {
      artifactId: "fixture:bundled-classes",
      relativePath: "scripts/bundle.js",
    });
    const findings = analyzePersistenceSource([parsed]).ignoredCommitBeforeFeedback;
    expect(findings).toHaveLength(2);
    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        callerRegion: "static:Service.finish",
        calleeName: "this.commit",
        callSource: { range: { lineStart: 4 } },
        failedReturnSource: { range: { lineStart: 2 } },
      }),
      expect.objectContaining({
        callerRegion: "static:Service.finishNamed",
        calleeName: "Service.commit",
        callSource: { range: { lineStart: 9 } },
        failedReturnSource: { range: { lineStart: 2 } },
      }),
    ]));
    expect(findings.some(x => x.callerRegion.includes("Instance") ||
      x.callerRegion.includes("Unrelated"))).toBe(false);
  });

  it("rejects static method replacement, qualified alias and receiver ambiguity", () => {
    const cases = [
      [
        "var A = class {",
        "  static commit() { if (!db.set('x',1)) return false; return true; }",
        "  static commit = () => true;",
        "  static finish() { this.commit(); ui.sendMessage('done'); state.set('done',true); }",
        "};",
      ],
      [
        "var A = class {",
        "  static commit() { if (!db.set('x',1)) return false; return true; }",
        "  static finish() {",
        "    this.commit = () => true;",
        "    this.commit(); ui.sendMessage('done'); state.set('done',true);",
        "  }",
        "};",
      ],
      [
        "var A = class {",
        "  static commit() { if (!db.set('x',1)) return false; return true; }",
        "  static finish() {",
        "    const Alias = A;",
        "    Alias.commit(); ui.sendMessage('done'); state.set('done',true);",
        "  }",
        "};",
      ],
      [
        "var A = class {",
        "  static commit() { if (!db.set('x',1)) return false; return true; }",
        "  static finish(A) {",
        "    A.commit(); ui.sendMessage('done'); state.set('done',true);",
        "  }",
        "};",
      ],
    ];
    for (const [index, lines] of cases.entries()) {
      const parsed = parseScriptFile("static-negative-" + index, lines.join("\n"), {
        artifactId: "fixture:static-ambiguity",
        relativePath: "scripts/static-bundle.js",
      });
      expect(analyzePersistenceSource([parsed]).ignoredCommitBeforeFeedback).toEqual([]);
    }
  });

  it("preserves class static this inside a nested arrow, not an ordinary function", () => {
    const parsed = parseScriptFile("static-this", [
      "var Service = class {",
      "  static commit() { if (!db.set('score', 4)) return false; return true; }",
      "  static publish() {",
      "    const direct = () => {",
      "      this.commit();",
      "      ui.sendMessage('complete');",
      "      state.set('done', true);",
      "    };",
      "    direct();",
      "  }",
      "  static dynamic() {",
      "    function inner() {",
      "      this.commit(); ui.sendMessage('complete'); state.set('done', true);",
      "    }",
      "    inner();",
      "  }",
      "};",
    ].join("\n"), {
      artifactId: "fixture:static-this",
      relativePath: "scripts/class-bundle.js",
    });
    const found = analyzePersistenceSource([parsed]).ignoredCommitBeforeFeedback;
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      callerRegion: "static:Service.publish/direct",
      calleeName: "this.commit",
      callSource: { range: { lineStart: 5 } },
      failedReturnSource: { range: { lineStart: 2 } },
      proof: "SOURCE_FAILURE_PATH_AND_SUCCESS_CANDIDATE_NOT_PROVEN_BUG",
    });
  });

  it("rejects class methods that are syntactically replaced by instance or static ownership", () => {
    const variants = [
      "class Owned { commit(){if(!db.set('x',1))return false;return true;} constructor(){this.commit=()=>true;} finish(){this.commit();ui.sendMessage('done');state.set('done',true)} }",
      "var Owned=class { static commit(){if(!db.set('x',1))return false;return true;} static {this.commit=()=>true;} static finish(){this.commit();ui.sendMessage('done');state.set('done',true)} };",
      "class Owned { commit(){if(!db.set('x',1))return false;return true;} constructor(){this['commit']=()=>true;} finish(){this.commit();ui.sendMessage('done');state.set('done',true)} }",
      "class Owned { commit(){if(!db.set('x',1))return false;return true;} get commit(){return ()=>true;} finish(){this.commit();ui.sendMessage('done');state.set('done',true)} }",
      "class Owned { commit(){if(!db.set('x',1))return false;return true;} ['commit']=()=>true; finish(){this.commit();ui.sendMessage('done');state.set('done',true)} }",
    ];
    for (const [index, text] of variants.entries()) {
      const parsed = parseScriptFile("rebound-" + index, text, {
        artifactId: "fixture:class-rebind", relativePath: "scripts/rebound.js",
      });
      expect(analyzePersistenceSource([parsed]).ignoredCommitBeforeFeedback)
        .toEqual([]);
    }
  });

  it("does not merge equal local names owned by separate nested closures", () => {
    const parsed = parseScriptFile("closures", [
      "function safeOuter() {",
      "  function commit() { return true; }",
      "  function publish() { commit(); ui.sendMessage('done'); state.set('done', true); }",
      "}",
      "function unsafeOuter() {",
      "  function commit() { if (!db.set('score',4)) return false; return true; }",
      "  function publish() { commit(); ui.sendMessage('done'); state.set('done', true); }",
      "}",
    ].join("\n"), {
      artifactId: "fixture:independent-closures",
      relativePath: "scripts/nested.js",
    });
    const found = analyzePersistenceSource([parsed]).ignoredCommitBeforeFeedback;
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      callerRegion: "function:unsafeOuter/publish",
      calleeName: "commit",
      failedReturnSource: { range: { lineStart: 6 } },
      callSource: { range: { lineStart: 7 } },
    });
  });

  it("grounds an ignored write through one constructor-initialized class receiver", () => {
    const source = [
      "class Journal {",
      "  write(value) {",
      "    if (!this.raw.set('score', value)) return false;",
      "    return true;",
      "  }",
      "}",
      "class Round {",
      "  constructor() { this.store = new Journal(); }",
      "  finish() {",
      "    this.store.write(4);",
      "    player.sendMessage('done');",
      "    state.set('finished', true);",
      "  }",
      "}",
    ].join("\n");
    const doc = parseScriptFile("owned-store", source, {
      artifactId: "fixture:owned-store", relativePath: "scripts/round.js",
    });
    const found = analyzePersistenceSource([doc]).ignoredCommitBeforeFeedback;
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      callerRegion: "class:Round.finish",
      calleeName: "this.store.write",
      callSource: { range: { lineStart: 10 } },
      failedReturnSource: { range: { lineStart: 3 } },
      receiverBindingSources: [{ range: { lineStart: 8 } }],
      laterFeedbackSource: { range: { lineStart: 11 } },
      laterWriteSource: { range: { lineStart: 12 } },
      proof: "SOURCE_FAILURE_PATH_AND_SUCCESS_CANDIDATE_NOT_PROVEN_BUG",
    });
  });

  it("carries grounded receiver source through bounded same-file return forwarding", () => {
    const source = [
      "class Journal {",
      "  write(value) {",
      "    if (this.raw.set('score', value) === false) return false;",
      "    return true;",
      "  }",
      "}",
      "class Round {",
      "  store = new Journal();",
      "  commit() { return this.store.write(5); }",
      "  finish() {",
      "    this.commit();",
      "    player.sendMessage('done');",
      "    state.set('finished', true);",
      "  }",
      "}",
    ].join("\n");
    const doc = parseScriptFile("owned-forward", source, {
      artifactId: "fixture:owned-forward", relativePath: "scripts/round.js",
    });
    const found = analyzePersistenceSource([doc]).ignoredCommitBeforeFeedback;
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      callerRegion: "class:Round.finish",
      calleeName: "this.commit",
      failedReturnSource: { range: { lineStart: 3 } },
      forwardingReturnSources: [{ range: { lineStart: 9 } }],
      failurePropagationPath: ["class:Round.commit", "class:Journal.write"],
      receiverBindingSources: [{ range: { lineStart: 8 } }],
      proof: "SOURCE_FAILURE_PATH_AND_SUCCESS_CANDIDATE_NOT_PROVEN_BUG",
    });
  });

  it("rejects ungrounded field receivers, unrelated failures and opaque writes", () => {
    const leaf = [
      "class Journal {",
      "  write(value) { if (!this.raw.set('score', value)) return false; return true; }",
      "}",
    ];
    const publish = [
      "  finish() {",
      "    this.store.write(4);",
      "    player.sendMessage('done');",
      "    state.set('finished', true);",
      "  }",
    ];
    const badOwners: readonly string[][] = [
      // A field name does not establish identity without direct new.
      ["class Round {", "  constructor() { this.store = getJournal(); }", ...publish, "}"],
      // Reassignment destroys the source-unique field binding.
      ["class Round {", "  store = new Journal();",
       "  reset() { this.store = new Other(); }", ...publish, "}"],
      // Replacing a METHOD on the same object also breaks its resolved
      // call edge, even though the field still holds new Journal().
      ["class Round {", "  store = new Journal();",
       "  reset() { this.store.write = () => true; }", ...publish, "}"],
      ["class Round {", "  store = new Journal();",
       "  reset() { this.store['write'] = () => true; }", ...publish, "}"],
      ["class Round {", "  store = new Journal();",
       "  reset() { this['store'].write = () => true; }", ...publish, "}"],
      ["class Round {", "  store = new Journal();",
       "  reset(key) { this[key].write = () => true; }", ...publish, "}"],
      ["class Round {", "  store = new Journal();",
       "  reset() { delete this.store.write; }", ...publish, "}"],
      ["class Round {", "  store = new Journal();",
       "  reset() { this.store.write++; }", ...publish, "}"],
      // Escaped receiver or field aliases can mutate the same instance.
      ["class Round {", "  store = new Journal();",
       "  reset() { const alias = this.store; alias.write = () => true; }",
       ...publish, "}"],
      ["class Round {", "  store = new Journal();",
       "  reset() { const self = this; self.store = new Other(); }",
       ...publish, "}"],
      ["class Round {", "  store = new Journal();",
       "  reset() { Object.assign(this.store, { write: () => true }); }",
       ...publish, "}"],
      ["class Round {", "  store = new Journal();",
       "  reset() { Reflect.set(this.store, 'write', () => true); }",
       ...publish, "}"],
      ["class Round {", "  store = new Journal();",
       "  reset() { Object.assign(this, { store: new Other() }); }",
       ...publish, "}"],
      // Constructor assignment must be unconditional and in the direct body.
      ["class Round {", "  constructor(ready) { if (ready) this.store = new Journal(); }", ...publish, "}"],
      // A shadowed target constructor does not prove a local class instance.
      ["class Round {", "  constructor(Journal) { this.store = new Journal(); }", ...publish, "}"],
      // A dynamically computed write can replace the instance field.
      ["class Round {", "  store = new Journal();",
       "  reset(key) { this[key] = new Other(); }", ...publish, "}"],
      // Non-own field or optional call is not an unconditional owned call.
      ["class Round {", "  store = new Journal();",
       "  finish() { this.store?.write(4); player.sendMessage('done'); state.set('finished',true); }", "}"],
      ["class Round {", "  store = new Journal();",
       "  finish() { this.store.write?.(4); player.sendMessage('done'); state.set('finished',true); }", "}"],
      ["class Round {", "  finish() { const store = new Journal();",
       "    store.write(4); player.sendMessage('done'); state.set('finished',true); }", "}"],
    ];
    for (const [index, owner] of badOwners.entries()) {
      const doc = parseScriptFile("unknown-field-" + index,
        [...leaf, ...owner].join("\n"), {
          artifactId: "fixture:unknown-fields",
          relativePath: "scripts/round.js",
        });
      expect(analyzePersistenceSource([doc]).ignoredCommitBeforeFeedback).toEqual([]);
    }
    const falseWithoutWriteFailure = parseScriptFile("unrelated-return", [
      "class Journal {",
      "  write(value) {",
      "    if (!value) return false;",
      "    this.raw.set('score', value);",
      "    return true;",
      "  }",
      "}",
      "class Round {",
      "  store = new Journal();",
      ...publish,
      "}",
    ].join("\n"), {
      artifactId: "fixture:unrelated-return", relativePath: "scripts/round.js",
    });
    expect(analyzePersistenceSource([falseWithoutWriteFailure])
      .ignoredCommitBeforeFeedback).toEqual([]);
    const unrelatedMutation = parseScriptFile("unrelated-member", [
      ...leaf,
      "class Round {",
      "  store = new Journal();",
      "  reset() { this.other = 4; this.counter++; }",
      ...publish,
      "}",
    ].join("\n"), {
      artifactId: "fixture:unrelated-member",
      relativePath: "scripts/unrelated.js",
    });
    expect(analyzePersistenceSource([unrelatedMutation])
      .ignoredCommitBeforeFeedback).toHaveLength(1);

    const reassignedTarget = parseScriptFile("reassigned-target", [
      ...leaf, "Journal = Other;",
      "class Round {", "  store = new Journal();", ...publish, "}",
    ].join("\n"), {
      artifactId: "fixture:reassigned-target", relativePath: "scripts/round.js",
    });
    expect(analyzePersistenceSource([reassignedTarget])
      .ignoredCommitBeforeFeedback).toEqual([]);
  });

  it("summarizes growth without promoting it to a defect", () => {
    const script = parseScriptFile(
      "main",
      `
        const history = JSON.parse(
          world.getDynamicProperty("history") ?? "[]"
        );
        history.push("match");
        world.setDynamicProperty(
          "history",
          JSON.stringify(history),
        );
      `,
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzePersistenceSource([script]);

    expect(result.appendWithoutClear).toBe(1);
    expect(
      result.worldScopedAppendWithoutClear,
    ).toBe(1);
    expect(result.properties[0]).toMatchObject({
      propertyId: "history",
      scope: "world",
      lifetime: "world",
      growth: "append-without-clear",
    });
  });

  it("projects exact reset sites without promoting source cleanup into a bounded lifetime", () => {
    const parsed = parseScriptFile("main", [
      'function reset(player) {',
      '  world.setDynamicProperty("matchSession", undefined);',
      '  player.setDynamicProperty("matchSession", "[]");',
      '  world.clearDynamicProperties();',
      '}',
    ].join("\n"), {
      artifactId: "a", relativePath: "scripts/main.ts",
    });
    const analysis = analyzePersistenceSource([parsed]);
    const property = analysis.properties.find(x => x.propertyId === "matchSession");
    expect(property?.scope).toBe("unknown");
    expect(property?.lifetime).toBe("unknown");
    expect(property?.resetSites).toHaveLength(2);
    expect(property?.resetSites?.map(x => x.receiverHint))
      .toEqual(["world", "player"]);
    expect(property?.resetSites?.map(x => x.kind))
      .toEqual(["undefined-removal", "empty-value-write"]);
    expect(property?.resetSites?.every(x =>
      x.executionRegion === "function:reset" &&
      x.source.relativePath === "scripts/main.ts")).toBe(true);
  });

  it("binds a property-specific reset to an exact playerLeave local-call path but not runtime completion", () => {
    const source = { artifactId: "map:one", relativePath: "scripts/lifecycle.ts" };
    const parsed = parseScriptFile("lifecycle", [
      'function clearRound() {',
      '  world.setDynamicProperty("roundState", undefined);',
      '}',
      'function onLeave(event) { clearRound(); }',
      'world.afterEvents.playerLeave.subscribe(onLeave);',
    ].join("\n"), source);
    const resetSite = parsed.persistentDataLifecycleEvidence
      ?.find(item => item.propertyKey === "roundState")?.resetSites?.[0];
    expect(resetSite).toBeDefined();
    // Explicit same-region generation evidence is not evidence that this
    // invalidation refers to the same player/property.
    parsed.arenaAuthorityEvidence = [{
      kind: "generation-invalidate", arenaExpression: "arena",
      generationExpression: "arena.generation",
      executionRegion: "function:clearRound",
      source: { ...source, range: {
        lineStart: 2, lineEnd: 2, columnStart: 1, columnEnd: 10,
      } },
    }];
    const result = analyzePersistenceSource([parsed]);
    expect(result.resetLifecycleAssociations).toHaveLength(1);
    const association = result.resetLifecycleAssociations[0]!;
    expect(association).toMatchObject({
      scriptId: "lifecycle", propertyId: "roundState",
      receiverHint: "world", resetKind: "undefined-removal",
      lifecycleEvent: "playerLeave", callbackRegion: "function:onLeave",
      resetRegion: "function:clearRound",
      pathKind: "local-call-reachable",
      evidenceStatus: "STATIC_SOURCE_REACHABILITY_ONLY",
    });
    expect(association.eventSource.relativePath).toBe(source.relativePath);
    expect(association.resetSource).toEqual(resetSite?.source);
    expect(association.coLocatedGenerationInvalidationSources)
      .toEqual([parsed.arenaAuthorityEvidence[0]!.source]);
    expect(result.properties.find(item => item.propertyId === "roundState")
      ?.lifetime).toBe("unknown");
  });

  it("keeps direct lifecycle callbacks separate from unconnected and non-lifecycle reset sites", () => {
    const source = { artifactId: "map:one", relativePath: "scripts/events.ts" };
    const parsed = parseScriptFile("events", [
      'world.afterEvents.playerSpawn.subscribe((event) => {',
      '  event.player.setDynamicProperty("sessionState", undefined);',
      '});',
      'function unusedReset() { world.setDynamicProperty("orphan", undefined); }',
      'world.afterEvents.playerBreakBlock.subscribe(() => {',
      '  world.setDynamicProperty("breaking", undefined);',
      '});',
    ].join("\n"), source);
    const result = analyzePersistenceSource([parsed]);
    expect(result.resetLifecycleAssociations).toHaveLength(1);
    expect(result.resetLifecycleAssociations[0]).toMatchObject({
      propertyId: "sessionState", lifecycleEvent: "playerSpawn",
      pathKind: "same-region", receiverHint: "event.player",
      coLocatedGenerationInvalidationSources: [],
    });
    const keys = result.properties.filter(item => item.resetSites?.length)
      .map(item => item.propertyId);
    expect(keys).toEqual(["breaking", "orphan", "sessionState"]);
    expect(result.resetLifecycleAssociations.every(item =>
      item.propertyId !== "orphan" && item.propertyId !== "breaking"))
      .toBe(true);
  });

  it("rejects reset associations when a reset source belongs to a different artifact", () => {
    const source = { artifactId: "map:one", relativePath: "scripts/events.ts" };
    const parsed = parseScriptFile("events", [
      'world.afterEvents.playerLeave.subscribe(() => {',
      '  world.setDynamicProperty("phase", undefined);',
      '});',
    ].join("\n"), source);
    const lifecycle = parsed.persistentDataLifecycleEvidence?.[0];
    expect(lifecycle?.resetSites).toHaveLength(1);
    parsed.persistentDataLifecycleEvidence = [{
      ...lifecycle!,
      resetSites: lifecycle!.resetSites!.map(site => ({
        ...site, source: { ...site.source, artifactId: "map:other" },
      })),
    }];
    expect(analyzePersistenceSource([parsed]).resetLifecycleAssociations)
      .toEqual([]);

    parsed.persistentDataLifecycleEvidence = [{
      ...lifecycle!,
      resetSites: lifecycle!.resetSites!.map(site => ({
        ...site, source: { artifactId: source.artifactId,
          relativePath: source.relativePath },
      })),
    }];
    // A file-only reference is not an exact reset site and must fail closed.
    expect(analyzePersistenceSource([parsed]).resetLifecycleAssociations)
      .toEqual([]);
  });

  it("records before/after source ordering only for matching receiver and direct block", () => {
    const parsed = parseScriptFile("round", [
      "function clearRound(arena) {",
      "  arena.generation++;",
      '  arena.setDynamicProperty("roundState", undefined);',
      "  arena.generation++;",
      "}",
      "function onLeave() { clearRound(arena); }",
      "world.afterEvents.playerLeave.subscribe(onLeave);",
    ].join("\n"), {
      artifactId: "map:one", relativePath: "scripts/round.ts",
    });
    const result = analyzePersistenceSource([parsed]);
    expect(result.resetLifecycleAssociations).toHaveLength(1);
    const candidate = result.resetLifecycleAssociations[0]!;
    expect(candidate.sequentialGenerationEvidence).toEqual([
      expect.objectContaining({
        arenaExpression: "arena", generationExpression: "arena.generation",
        order: "before-reset", evidenceStatus: "SOURCE_SEQUENCE_ONLY",
        source: expect.objectContaining({
          range: expect.objectContaining({ lineStart: 2 }),
        }),
      }),
      expect.objectContaining({
        arenaExpression: "arena", generationExpression: "arena.generation",
        order: "after-reset", evidenceStatus: "SOURCE_SEQUENCE_ONLY",
        source: expect.objectContaining({
          range: expect.objectContaining({ lineStart: 4 }),
        }),
      }),
    ]);
    expect(candidate.coLocatedGenerationInvalidationSources).toHaveLength(2);
    expect(candidate.evidenceStatus).toBe("STATIC_SOURCE_REACHABILITY_ONLY");
    expect(result.properties.find(x => x.propertyId === "roundState")?.lifetime)
      .toBe("unknown");
  });

  it("blocks source ordering when the receiver is rebound between generation and reset", () => {
    const script = parseScriptFile("arena", [
      "function cleanup(arena, otherArena) {",
      "  arena.generation++;",
      "  arena = otherArena;",
      '  arena.setDynamicProperty("roundState", undefined);',
      "}",
      "world.afterEvents.playerLeave.subscribe(() => cleanup(arena, otherArena));",
    ].join("\n"), {
      artifactId: "map:identity", relativePath: "scripts/lifecycle.ts",
    });
    const candidate = analyzePersistenceSource([script]).resetLifecycleAssociations[0];
    expect(candidate?.coLocatedGenerationInvalidationSources).toHaveLength(1);
    expect(candidate?.sequentialGenerationEvidence).toEqual([]);
    expect(candidate?.evidenceStatus).toBe("STATIC_SOURCE_REACHABILITY_ONLY");
  });

  it("blocks ordering after a nullish receiver reassignment", () => {
    const script = parseScriptFile("arena", [
      "function cleanup(arena, otherArena) {",
      "  arena.generation++;",
      "  arena ??= otherArena;",
      '  arena.setDynamicProperty("roundState", undefined);',
      "}",
      "world.afterEvents.playerLeave.subscribe(() => cleanup(arena, otherArena));",
    ].join("\n"), {
      artifactId: "map:identity", relativePath: "scripts/lifecycle.ts",
    });
    const candidate = analyzePersistenceSource([script]).resetLifecycleAssociations[0];
    expect(candidate?.sequentialGenerationEvidence).toEqual([]);
  });

  it("blocks source ordering when an early exit can prevent the reset", () => {
    const script = parseScriptFile("arena", [
      "function cleanup(arena, skip) {",
      "  arena.generation++;",
      "  if (skip) return;",
      '  arena.setDynamicProperty("roundState", undefined);',
      "}",
      "world.afterEvents.playerLeave.subscribe(() => cleanup(arena, false));",
    ].join("\n"), {
      artifactId: "map:identity", relativePath: "scripts/lifecycle.ts",
    });
    const candidate = analyzePersistenceSource([script]).resetLifecycleAssociations[0];
    expect(candidate?.coLocatedGenerationInvalidationSources).toHaveLength(1);
    expect(candidate?.sequentialGenerationEvidence).toEqual([]);
  });

  it("blocks ordering across a conditional receiver rebinding", () => {
    const script = parseScriptFile("arena", [
      "function cleanup(arena, otherArena, switchOwner) {",
      "  arena.generation++;",
      "  if (switchOwner) { arena = otherArena; }",
      '  arena.setDynamicProperty("roundState", undefined);',
      "}",
      "world.afterEvents.playerLeave.subscribe(() => cleanup(arena, otherArena, true));",
    ].join("\n"), {
      artifactId: "map:identity", relativePath: "scripts/lifecycle.ts",
    });
    const candidate = analyzePersistenceSource([script]).resetLifecycleAssociations[0];
    expect(candidate?.sequentialGenerationEvidence).toEqual([]);
  });

  it("preserves source order for direct siblings with the same earlier exit requirements", () => {
    const script = parseScriptFile("arena", [
      "function cleanup(arena, skip) {",
      "  if (skip) return;",
      "  arena.generation++;",
      '  arena.setDynamicProperty("roundState", undefined);',
      "}",
      "world.afterEvents.playerLeave.subscribe(() => cleanup(arena, false));",
    ].join("\n"), {
      artifactId: "map:identity", relativePath: "scripts/lifecycle.ts",
    });
    const candidate = analyzePersistenceSource([script]).resetLifecycleAssociations[0];
    expect(candidate?.sequentialGenerationEvidence).toEqual([
      expect.objectContaining({
        generationExpression: "arena.generation",
        arenaExpression: "arena",
        order: "before-reset",
        evidenceStatus: "SOURCE_SEQUENCE_ONLY",
      }),
    ]);
  });

  it("blocks generation/reset ordering across an opaque call passing the receiver", () => {
    const script = parseScriptFile("arena", [
      "function cleanup(arena) {",
      "  arena.generation++;",
      "  mutate(arena);",
      '  arena.setDynamicProperty("roundState", undefined);',
      "}",
      "world.afterEvents.playerLeave.subscribe(() => cleanup(arena));",
    ].join("\n"), {
      artifactId: "map:calls", relativePath: "scripts/cleanup.ts",
    });
    const [candidate] = analyzePersistenceSource([script]).resetLifecycleAssociations;
    expect(candidate?.coLocatedGenerationInvalidationSources).toHaveLength(1);
    expect(candidate?.sequentialGenerationEvidence).toEqual([]);
  });

  it("blocks source ordering across a direct const alias passed to a helper", () => {
    const script = parseScriptFile("arena", [
      "function cleanup(arena) {",
      "  arena.generation++;",
      "  const ref = arena;",
      "  mutate(ref);",
      '  arena.setDynamicProperty("roundState", undefined);',
      "}",
      "world.afterEvents.playerLeave.subscribe(() => cleanup(arena));",
    ].join("\n"), {
      artifactId: "map:calls", relativePath: "scripts/cleanup.ts",
    });
    const [candidate] = analyzePersistenceSource([script]).resetLifecycleAssociations;
    expect(candidate?.sequentialGenerationEvidence).toEqual([]);
  });

  it("blocks generation/reset correlation through a mutable receiver alias", () => {
    const script = parseScriptFile("arena", [
      "function cleanup(arena) {",
      "  arena.generation++;",
      "  let ref = arena;",
      "  mutate(ref);",
      '  arena.setDynamicProperty("roundState", undefined);',
      "}",
      "world.afterEvents.playerLeave.subscribe(() => cleanup(arena));",
    ].join("\n"), {
      artifactId: "map:mutable-alias", relativePath: "scripts/cleanup.ts",
    });
    const [candidate] = analyzePersistenceSource([script]).resetLifecycleAssociations;
    expect(candidate?.coLocatedGenerationInvalidationSources).toHaveLength(1);
    expect(candidate?.sequentialGenerationEvidence).toEqual([]);
  });

  it("blocks generation/reset correlation through an assigned transitive alias", () => {
    const script = parseScriptFile("arena", [
      "function cleanup(arena) {",
      "  arena.generation++;",
      "  let ref;",
      "  ref = arena;",
      "  const nestedRef = ref;",
      "  mutate(nestedRef);",
      '  arena.setDynamicProperty("roundState", undefined);',
      "}",
      "world.afterEvents.playerLeave.subscribe(() => cleanup(arena));",
    ].join("\n"), {
      artifactId: "map:transitive-alias", relativePath: "scripts/cleanup.ts",
    });
    const [candidate] = analyzePersistenceSource([script]).resetLifecycleAssociations;
    expect(candidate?.sequentialGenerationEvidence).toEqual([]);
  });

  it("blocks a conditional branch that creates and calls a receiver alias", () => {
    const script = parseScriptFile("arena", [
      "function cleanup(arena, shouldMutate) {",
      "  arena.generation++;",
      "  if (shouldMutate) {",
      "    const ref = arena;",
      "    mutate(ref);",
      "  }",
      '  arena.setDynamicProperty("roundState", undefined);',
      "}",
      "world.afterEvents.playerLeave.subscribe(() => cleanup(arena, true));",
    ].join("\n"), {
      artifactId: "map:conditional-alias", relativePath: "scripts/cleanup.ts",
    });
    const [candidate] = analyzePersistenceSource([script]).resetLifecycleAssociations;
    expect(candidate?.sequentialGenerationEvidence).toEqual([]);
  });

  it("does not treat an unrelated mutable alias or helper call as arena mutation", () => {
    const script = parseScriptFile("arena", [
      "function cleanup(arena, otherArena) {",
      "  arena.generation++;",
      "  let ref = otherArena;",
      "  mutate(ref);",
      '  arena.setDynamicProperty("roundState", undefined);',
      "}",
      "world.afterEvents.playerLeave.subscribe(() => cleanup(arena, otherArena));",
    ].join("\n"), {
      artifactId: "map:unrelated-alias", relativePath: "scripts/cleanup.ts",
    });
    const [candidate] = analyzePersistenceSource([script]).resetLifecycleAssociations;
    expect(candidate?.sequentialGenerationEvidence).toEqual([
      expect.objectContaining({
        arenaExpression: "arena",
        order: "before-reset",
        evidenceStatus: "SOURCE_SEQUENCE_ONLY",
      }),
    ]);
  });

  it("blocks an object-carried receiver alias passed to an opaque helper", () => {
    const script = parseScriptFile("arena", [
      "function cleanup(arena) {",
      "  arena.generation++;",
      "  const holder = { target: arena };",
      "  mutate(holder);",
      '  arena.setDynamicProperty("roundState", undefined);',
      "}",
      "world.afterEvents.playerLeave.subscribe(() => cleanup(arena));",
    ].join("\n"), {
      artifactId: "map:object-escape", relativePath: "scripts/cleanup.ts",
    });
    const [candidate] = analyzePersistenceSource([script]).resetLifecycleAssociations;
    expect(candidate?.coLocatedGenerationInvalidationSources).toHaveLength(1);
    expect(candidate?.sequentialGenerationEvidence).toEqual([]);
  });

  it("blocks array and nested object aliases passed through other locals", () => {
    const script = parseScriptFile("arena", [
      "function cleanup(arena) {",
      "  arena.generation++;",
      "  const packed = [{ value: arena }];",
      "  const ref = packed;",
      "  mutate(ref);",
      '  arena.setDynamicProperty("roundState", undefined);',
      "}",
      "world.afterEvents.playerLeave.subscribe(() => cleanup(arena));",
    ].join("\n"), {
      artifactId: "map:array-escape", relativePath: "scripts/cleanup.ts",
    });
    const [candidate] = analyzePersistenceSource([script]).resetLifecycleAssociations;
    expect(candidate?.sequentialGenerationEvidence).toEqual([]);
  });

  it("blocks a receiver-capturing callback passed to an external function", () => {
    const script = parseScriptFile("arena", [
      "function cleanup(arena) {",
      "  arena.generation++;",
      "  const captured = () => arena;",
      "  register(captured);",
      '  arena.setDynamicProperty("roundState", undefined);',
      "}",
      "world.afterEvents.playerLeave.subscribe(() => cleanup(arena));",
    ].join("\n"), {
      artifactId: "map:callback-escape", relativePath: "scripts/cleanup.ts",
    });
    const [candidate] = analyzePersistenceSource([script]).resetLifecycleAssociations;
    expect(candidate?.sequentialGenerationEvidence).toEqual([]);
  });

  it("blocks object methods and getters that capture the receiver", () => {
    const script = parseScriptFile("arena", [
      "function cleanup(arena) {",
      "  arena.generation++;",
      "  const holder = { get target() { return arena; } };",
      "  register(holder);",
      '  arena.setDynamicProperty("roundState", undefined);',
      "}",
      "world.afterEvents.playerLeave.subscribe(() => cleanup(arena));",
    ].join("\n"), {
      artifactId: "map:getter-escape", relativePath: "scripts/cleanup.ts",
    });
    const [candidate] = analyzePersistenceSource([script]).resetLifecycleAssociations;
    expect(candidate?.sequentialGenerationEvidence).toEqual([]);
  });

  it("blocks conditionally selected receiver aliases passed to another function", () => {
    const script = parseScriptFile("arena", [
      "function cleanup(arena, other, choose) {",
      "  arena.generation++;",
      "  const candidate = choose ? arena : other;",
      "  mutate(candidate);",
      '  arena.setDynamicProperty("roundState", undefined);',
      "}",
      "world.afterEvents.playerLeave.subscribe(() => cleanup(arena, other, true));",
    ].join("\n"), {
      artifactId: "map:conditional-escape", relativePath: "scripts/cleanup.ts",
    });
    const [candidate] = analyzePersistenceSource([script]).resetLifecycleAssociations;
    expect(candidate?.sequentialGenerationEvidence).toEqual([]);
  });

  it("blocks a receiver stored on a foreign object without any intervening call", () => {
    const script = parseScriptFile("arena", [
      "function cleanup(arena, registry) {",
      "  arena.generation++;",
      "  registry.current = arena;",
      '  arena.setDynamicProperty("roundState", undefined);',
      "}",
      "world.afterEvents.playerLeave.subscribe(() => cleanup(arena, registry));",
    ].join("\n"), {
      artifactId: "map:property-escape", relativePath: "scripts/cleanup.ts",
    });
    const [candidate] = analyzePersistenceSource([script]).resetLifecycleAssociations;
    expect(candidate?.sequentialGenerationEvidence).toEqual([]);
  });

  it("blocks a constructor that may retain the receiver", () => {
    const script = parseScriptFile("arena", [
      "function cleanup(arena) {",
      "  arena.generation++;",
      "  new Container(arena);",
      '  arena.setDynamicProperty("roundState", undefined);',
      "}",
      "world.afterEvents.playerLeave.subscribe(() => cleanup(arena));",
    ].join("\n"), {
      artifactId: "map:constructor-escape", relativePath: "scripts/cleanup.ts",
    });
    const [candidate] = analyzePersistenceSource([script]).resetLifecycleAssociations;
    expect(candidate?.sequentialGenerationEvidence).toEqual([]);
  });

  it("retains source order for unrelated object keys and boolean comparisons", () => {
    const script = parseScriptFile("arena", [
      "function cleanup(arena, other) {",
      "  arena.generation++;",
      "  const holder = { arena: other };",
      "  const getter = { get arena() { return other; } };",
      "  const comparison = arena === other;",
      "  mutate(holder);",
      "  mutate(getter);",
      "  notify(comparison);",
      '  arena.setDynamicProperty("roundState", undefined);',
      "}",
      "world.afterEvents.playerLeave.subscribe(() => cleanup(arena, other));",
    ].join("\n"), {
      artifactId: "map:unrelated-container", relativePath: "scripts/cleanup.ts",
    });
    const [candidate] = analyzePersistenceSource([script]).resetLifecycleAssociations;
    expect(candidate?.sequentialGenerationEvidence).toEqual([
      expect.objectContaining({
        arenaExpression: "arena", order: "before-reset",
        evidenceStatus: "SOURCE_SEQUENCE_ONLY",
      }),
    ]);
  });

  it("does not treat an inner shadowed arena as the outer receiver", () => {
    const script = parseScriptFile("arena", [
      "function cleanup(arena, other, choose) {",
      "  arena.generation++;",
      "  if (choose) {",
      "    const arena = other;",
      "    mutate(arena);",
      "  }",
      '  arena.setDynamicProperty("roundState", undefined);',
      "}",
      "world.afterEvents.playerLeave.subscribe(() => cleanup(arena, other, true));",
    ].join("\n"), {
      artifactId: "map:shadowed-block", relativePath: "scripts/cleanup.ts",
    });
    const [candidate] = analyzePersistenceSource([script]).resetLifecycleAssociations;
    expect(candidate?.sequentialGenerationEvidence).toEqual([
      expect.objectContaining({
        arenaExpression: "arena", order: "before-reset",
        evidenceStatus: "SOURCE_SEQUENCE_ONLY",
      }),
    ]);
  });

  it("does not conflate shadowed callback parameters with captured receiver", () => {
    const script = parseScriptFile("arena", [
      "function cleanup(arena) {",
      "  arena.generation++;",
      "  const callback = (arena) => arena;",
      "  register(callback);",
      '  arena.setDynamicProperty("roundState", undefined);',
      "}",
      "world.afterEvents.playerLeave.subscribe(() => cleanup(arena));",
    ].join("\n"), {
      artifactId: "map:shadowed-callback", relativePath: "scripts/cleanup.ts",
    });
    const [candidate] = analyzePersistenceSource([script]).resetLifecycleAssociations;
    expect(candidate?.sequentialGenerationEvidence).toHaveLength(1);
  });

  it("does not conflate a shadowed catch binding with the outer arena", () => {
    const script = parseScriptFile("arena", [
      "function cleanup(arena, other) {",
      "  arena.generation++;",
      "  try { notify(); } catch (arena) { mutate(arena); }",
      '  arena.setDynamicProperty("roundState", undefined);',
      "}",
      "world.afterEvents.playerLeave.subscribe(() => cleanup(arena, other));",
    ].join("\n"), {
      artifactId: "map:shadowed-catch", relativePath: "scripts/cleanup.ts",
    });
    const [candidate] = analyzePersistenceSource([script]).resetLifecycleAssociations;
    expect(candidate?.sequentialGenerationEvidence).toHaveLength(1);
  });

  it("reconciles array binding aliases only when a literal element carries receiver", () => {
    const make = (position: 0 | 1) => parseScriptFile("arena", [
      "function cleanup(arena, other) {",
      "  arena.generation++;",
      "  const pair = [arena, other];",
      "  const [first, second] = pair;",
      "  mutate(" + (position === 0 ? "first" : "second") + ");",
      '  arena.setDynamicProperty("roundState", undefined);',
      "}",
      "world.afterEvents.playerLeave.subscribe(() => cleanup(arena, other));",
    ].join("\n"), {
      artifactId: "map:array-binding", relativePath: "scripts/cleanup.ts",
    });
    const positive = analyzePersistenceSource([make(0)])
      .resetLifecycleAssociations[0];
    const negative = analyzePersistenceSource([make(1)])
      .resetLifecycleAssociations[0];
    expect(positive?.sequentialGenerationEvidence).toEqual([]);
    expect(negative?.sequentialGenerationEvidence).toHaveLength(1);
  });

  it("does not rely on a container literal after its field was reassigned", () => {
    const script = parseScriptFile("arena", [
      "function cleanup(arena, other) {",
      "  arena.generation++;",
      "  const holder = { target: arena, other: other };",
      "  holder.other = chooseReceiver();",
      "  const ref = holder.other;",
      "  mutate(ref);",
      '  arena.setDynamicProperty("roundState", undefined);',
      "}",
      "world.afterEvents.playerLeave.subscribe(() => cleanup(arena, other));",
    ].join("\n"), {
      artifactId: "map:mutable-container", relativePath: "scripts/cleanup.ts",
    });
    const [candidate] = analyzePersistenceSource([script]).resetLifecycleAssociations;
    expect(candidate?.sequentialGenerationEvidence).toEqual([]);
  });

  it("links an exact object destructuring field to its receiver alias", () => {
    const script = parseScriptFile("arena", [
      "function cleanup(arena) {",
      "  arena.generation++;",
      "  const holder = { target: arena };",
      "  const { target: ref } = holder;",
      "  mutate(ref);",
      '  arena.setDynamicProperty("roundState", undefined);',
      "}",
      "world.afterEvents.playerLeave.subscribe(() => cleanup(arena));",
    ].join("\n"), {
      artifactId: "map:destructure", relativePath: "scripts/cleanup.ts",
    });
    const [candidate] = analyzePersistenceSource([script]).resetLifecycleAssociations;
    expect(candidate?.coLocatedGenerationInvalidationSources).toHaveLength(1);
    expect(candidate?.sequentialGenerationEvidence).toEqual([]);
  });

  it("does not equate other fields of a receiver-bearing container", () => {
    const script = parseScriptFile("arena", [
      "function cleanup(arena, other) {",
      "  arena.generation++;",
      "  const holder = { target: arena, unrelated: other };",
      "  const { unrelated: ref } = holder;",
      "  mutate(ref);",
      '  arena.setDynamicProperty("roundState", undefined);',
      "}",
      "world.afterEvents.playerLeave.subscribe(() => cleanup(arena, other));",
    ].join("\n"), {
      artifactId: "map:destructure-other", relativePath: "scripts/cleanup.ts",
    });
    const [candidate] = analyzePersistenceSource([script]).resetLifecycleAssociations;
    expect(candidate?.sequentialGenerationEvidence).toHaveLength(1);
  });

  it("distinguishes exact container reads from unrelated property reads", () => {
    const make = (property: "target" | "other") => parseScriptFile("arena", [
      "function cleanup(arena, other) {",
      "  arena.generation++;",
      "  const holder = { target: arena, other: other };",
      "  const ref = holder." + property + ";",
      "  mutate(ref);",
      '  arena.setDynamicProperty("roundState", undefined);',
      "}",
      "world.afterEvents.playerLeave.subscribe(() => cleanup(arena, other));",
    ].join("\n"), {
      artifactId: "map:container-read", relativePath: "scripts/cleanup.ts",
    });
    const matching = analyzePersistenceSource([make("target")])
      .resetLifecycleAssociations[0];
    const unrelated = analyzePersistenceSource([make("other")])
      .resetLifecycleAssociations[0];
    expect(matching?.sequentialGenerationEvidence).toEqual([]);
    expect(unrelated?.sequentialGenerationEvidence).toHaveLength(1);
  });

  it("distinguishes literal container member and index reads from carriers", () => {
    const cases = [
      { expression: "holder.target", blocked: true },
      { expression: "holder.other", blocked: false },
      { expression: 'holder["target"]', blocked: true },
      { expression: 'holder["other"]', blocked: false },
      { expression: "holder[dynamicKey]", blocked: true },
      { expression: "pair[0]", blocked: true },
      { expression: "pair[1]", blocked: false },
      { expression: "pair[dynamicKey]", blocked: true },
    ] as const;
    for (const { expression, blocked } of cases) {
      const script = parseScriptFile("arena", [
        "function cleanup(arena, other, dynamicKey) {",
        "  arena.generation++;",
        "  const holder = { target: arena, other };",
        "  const pair = [arena, other];",
        "  mutate(" + expression + ");",
        '  arena.setDynamicProperty("roundState", undefined);',
        "}",
        "world.afterEvents.playerLeave.subscribe(() => cleanup(arena, other, key));",
      ].join("\n"), {
        artifactId: "map:literal-member", relativePath: "scripts/cleanup.ts",
      });
      const [candidate] = analyzePersistenceSource([script]).resetLifecycleAssociations;
      expect(candidate?.sequentialGenerationEvidence.length)
        .toBe(blocked ? 0 : 1);
    }
  });

  it("does not infer a unique field value across computed and spread writes", () => {
    const cases = [
      'const holder = { other, [key]: arena };',
      'const holder = { other, ...{ other: arena } };',
    ] as const;
    for (const declaration of cases) {
      const script = parseScriptFile("arena", [
        "function cleanup(arena, other, key) {",
        "  arena.generation++;",
        "  " + declaration,
        "  mutate(holder.other);",
        '  arena.setDynamicProperty("roundState", undefined);',
        "}",
        "world.afterEvents.playerLeave.subscribe(() => cleanup(arena, other, key));",
      ].join("\n"), {
        artifactId: "map:computed-fields", relativePath: "scripts/cleanup.ts",
      });
      const candidate = analyzePersistenceSource([script]).resetLifecycleAssociations[0];
      expect(candidate?.sequentialGenerationEvidence).toEqual([]);
    }
  });

  it("keeps methods on a receiver-bearing container as possible effects", () => {
    const make = (target: "arena" | "other") => parseScriptFile("arena", [
      "function cleanup(arena, other) {",
      "  arena.generation++;",
      "  const holder = { target: " + target + ", refresh() {} };",
      "  holder.refresh();",
      '  arena.setDynamicProperty("roundState", undefined);',
      "}",
      "world.afterEvents.playerLeave.subscribe(() => cleanup(arena, other));",
    ].join("\n"), {
      artifactId: "map:carrier-method", relativePath: "scripts/cleanup.ts",
    });
    expect(analyzePersistenceSource([make("arena")])
      .resetLifecycleAssociations[0]?.sequentialGenerationEvidence).toEqual([]);
    expect(analyzePersistenceSource([make("other")])
      .resetLifecycleAssociations[0]?.sequentialGenerationEvidence).toHaveLength(1);
  });

  it("invalidates every source alias when a shared object carrier is mutated", () => {
    const script = parseScriptFile("arena", [
      "function cleanup(arena, other) {",
      "  const holder = { target: arena, other };",
      "  const alias = holder;",
      "  alias.other = arena;",
      "  arena.generation++;",
      "  mutate(holder.other);",
      '  arena.setDynamicProperty("roundState", undefined);',
      "}",
      "world.afterEvents.playerLeave.subscribe(() => cleanup(arena, other));",
    ].join("\n"), {
      artifactId: "map:shared-carrier", relativePath: "scripts/cleanup.ts",
    });
    const [candidate] = analyzePersistenceSource([script]).resetLifecycleAssociations;
    expect(candidate?.coLocatedGenerationInvalidationSources).toHaveLength(1);
    // Mutation preceded both statements, but a later read through the
    // original alias must still block the generation/reset association.
    expect(candidate?.sequentialGenerationEvidence).toEqual([]);
  });

  it("invalidates every source alias when a shared array carrier is mutated", () => {
    const script = parseScriptFile("arena", [
      "function cleanup(arena, other) {",
      "  const pair = [arena, other];",
      "  const alias = pair;",
      "  alias[1] = arena;",
      "  arena.generation++;",
      "  mutate(pair[1]);",
      '  arena.setDynamicProperty("roundState", undefined);',
      "}",
      "world.afterEvents.playerLeave.subscribe(() => cleanup(arena, other));",
    ].join("\n"), {
      artifactId: "map:shared-array", relativePath: "scripts/cleanup.ts",
    });
    const [candidate] = analyzePersistenceSource([script]).resetLifecycleAssociations;
    expect(candidate?.sequentialGenerationEvidence).toEqual([]);
  });

  it("does not propagate a carrier mutation across independent literal objects", () => {
    const script = parseScriptFile("arena", [
      "function cleanup(arena, other) {",
      "  const holder = { target: arena, other };",
      "  const unrelated = { other };",
      "  unrelated.other = arena;",
      "  arena.generation++;",
      "  mutate(holder.other);",
      '  arena.setDynamicProperty("roundState", undefined);',
      "}",
      "world.afterEvents.playerLeave.subscribe(() => cleanup(arena, other));",
    ].join("\n"), {
      artifactId: "map:independent-carriers", relativePath: "scripts/cleanup.ts",
    });
    const [candidate] = analyzePersistenceSource([script]).resetLifecycleAssociations;
    expect(candidate?.sequentialGenerationEvidence).toEqual([
      expect.objectContaining({
        generationExpression: "arena.generation",
        order: "before-reset",
        evidenceStatus: "SOURCE_SEQUENCE_ONLY",
      }),
    ]);
  });

  it("keeps carrier identities distinct after reassignment to a new literal", () => {
    const script = parseScriptFile("arena", [
      "function cleanup(arena, other) {",
      "  const holder = { target: arena, other };",
      "  let alias = holder;",
      "  alias = { target: other, other };",
      "  alias.other = arena;",
      "  arena.generation++;",
      "  mutate(holder.other);",
      '  arena.setDynamicProperty("roundState", undefined);',
      "}",
      "world.afterEvents.playerLeave.subscribe(() => cleanup(arena, other));",
    ].join("\n"), {
      artifactId: "map:carrier-replaced", relativePath: "scripts/cleanup.ts",
    });
    const [candidate] = analyzePersistenceSource([script]).resetLifecycleAssociations;
    expect(candidate?.sequentialGenerationEvidence).toHaveLength(1);
  });

  it("does not trust a stale carrier literal after unresolved reassignment", () => {
    const make = (nextValue: string) => parseScriptFile("arena", [
      "function cleanup(arena, other) {",
      "  arena.generation++;",
      "  let holder = { target: arena, other };",
      "  holder = " + nextValue + ";",
      "  mutate(holder.other);",
      '  arena.setDynamicProperty("roundState", undefined);',
      "}",
      "world.afterEvents.playerLeave.subscribe(() => cleanup(arena, other));",
    ].join("\n"), {
      artifactId: "map:carrier-rebind", relativePath: "scripts/cleanup.ts",
    });
    expect(analyzePersistenceSource([make("lookup()")])
      .resetLifecycleAssociations[0]?.sequentialGenerationEvidence).toEqual([]);
    expect(analyzePersistenceSource([make("{ target: other, other }")])
      .resetLifecycleAssociations[0]?.sequentialGenerationEvidence).toHaveLength(1);
  });

  it("resolves literal container fields through assigned container aliases", () => {
    const make = (field: "target" | "other") => parseScriptFile("arena", [
      "function cleanup(arena, other) {",
      "  arena.generation++;",
      "  let holder;",
      "  holder = { target: arena, other };",
      "  const next = holder;",
      "  mutate(next." + field + ");",
      '  arena.setDynamicProperty("roundState", undefined);',
      "}",
      "world.afterEvents.playerLeave.subscribe(() => cleanup(arena, other));",
    ].join("\n"), {
      artifactId: "map:container-assignment", relativePath: "scripts/cleanup.ts",
    });
    const target = analyzePersistenceSource([make("target")])
      .resetLifecycleAssociations[0];
    const other = analyzePersistenceSource([make("other")])
      .resetLifecycleAssociations[0];
    expect(target?.sequentialGenerationEvidence).toEqual([]);
    expect(other?.sequentialGenerationEvidence).toHaveLength(1);
  });

  it("distinguishes callback captures of known carrier fields", () => {
    const make = (field: "target" | "other") => parseScriptFile("arena", [
      "function cleanup(arena, other) {",
      "  arena.generation++;",
      "  const holder = { target: arena, other };",
      "  const callback = () => holder." + field + ";",
      "  register(callback);",
      '  arena.setDynamicProperty("roundState", undefined);',
      "}",
      "world.afterEvents.playerLeave.subscribe(() => cleanup(arena, other));",
    ].join("\n"), {
      artifactId: "map:carrier-capture", relativePath: "scripts/cleanup.ts",
    });
    expect(analyzePersistenceSource([make("target")])
      .resetLifecycleAssociations[0]?.sequentialGenerationEvidence).toEqual([]);
    expect(analyzePersistenceSource([make("other")])
      .resetLifecycleAssociations[0]?.sequentialGenerationEvidence).toHaveLength(1);
  });

  it("blocks receiver method calls and callback captures before reset", () => {
    const script = parseScriptFile("arena", [
      "function cleanup(arena) {",
      "  arena.generation++;",
      "  system.run(() => arena.refresh());",
      '  arena.setDynamicProperty("roundState", undefined);',
      "}",
      "world.afterEvents.playerLeave.subscribe(() => cleanup(arena));",
    ].join("\n"), {
      artifactId: "map:calls", relativePath: "scripts/cleanup.ts",
    });
    const [candidate] = analyzePersistenceSource([script]).resetLifecycleAssociations;
    expect(candidate?.sequentialGenerationEvidence).toEqual([]);
  });

  it("does not block on calls whose arguments and receiver are unrelated", () => {
    const script = parseScriptFile("arena", [
      "function cleanup(arena, unrelated) {",
      "  arena.generation++;",
      '  notify("ready");',
      "  unrelated.arena();",
      "  const info = { arena: 1 };",
      '  arena.setDynamicProperty("roundState", undefined);',
      "}",
      "world.afterEvents.playerLeave.subscribe(() => cleanup(arena, other));",
    ].join("\n"), {
      artifactId: "map:calls", relativePath: "scripts/cleanup.ts",
    });
    const [candidate] = analyzePersistenceSource([script]).resetLifecycleAssociations;
    expect(candidate?.sequentialGenerationEvidence).toEqual([
      expect.objectContaining({
        arenaExpression: "arena", order: "before-reset",
        evidenceStatus: "SOURCE_SEQUENCE_ONLY",
      }),
    ]);
  });

  it("refuses generation ordering across conditional blocks or unrelated receivers", () => {
    const parsed = parseScriptFile("round", [
      "function reset(arena, other, flag) {",
      "  if (flag) { arena.generation++; }",
      '  arena.setDynamicProperty("roundState", undefined);',
      "  other.generation++;",
      "  if (flag) arena.generation++;",
      "}",
      "world.afterEvents.playerLeave.subscribe(() => reset(arena, other, true));",
    ].join("\n"), {
      artifactId: "map:one", relativePath: "scripts/round.ts",
    });
    const [candidate] = analyzePersistenceSource([parsed]).resetLifecycleAssociations;
    expect(candidate?.coLocatedGenerationInvalidationSources).toHaveLength(3);
    expect(candidate?.sequentialGenerationEvidence).toEqual([]);
  });

  it("does not upgrade manual generation evidence without an exact block", () => {
    const parsed = parseScriptFile("round", [
      "function reset(arena) {",
      '  arena.setDynamicProperty("roundState", undefined);',
      "}",
      "world.afterEvents.playerLeave.subscribe(() => reset(arena));",
    ].join("\n"), {
      artifactId: "map:one", relativePath: "scripts/round.ts",
    });
    parsed.arenaAuthorityEvidence = [{
      kind: "generation-invalidate",
      arenaExpression: "arena",
      generationExpression: "arena.generation",
      executionRegion: "function:reset",
      source: { artifactId: "map:one", relativePath: "scripts/round.ts",
        range: { lineStart: 1, lineEnd: 1,
          columnStart: 1, columnEnd: 10 } },
    }];
    const [candidate] = analyzePersistenceSource([parsed]).resetLifecycleAssociations;
    expect(candidate?.coLocatedGenerationInvalidationSources).toHaveLength(1);
    expect(candidate?.sequentialGenerationEvidence).toEqual([]);
  });

  it("keeps persisted session state read on reconnect as an explicit reconciliation gap", () => {
    const script = parseScriptFile(
      "main",
      [
        "world.afterEvents.playerJoin.subscribe((event) => {",
        "  restoreSession(event.player);",
        "});",
        "function restoreSession(player) {",
        "  const state = world.getDynamicProperty('matchSession');",
        "  return state;",
        "}",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzePersistenceSource([script]);

    expect(
      result.reconnectTransientRestoreRiskCount,
    ).toBe(1);
    expect(
      result.reconnectTransientRestoreRisks[0],
    ).toMatchObject({
      propertyId: "matchSession",
      lifecycleEvent: "playerJoin",
      scope: "session",
    });
  });

  it("does not flag player-durable reconnect reads as transient session restore", () => {
    const script = parseScriptFile(
      "main",
      [
        "world.afterEvents.playerJoin.subscribe((event) => {",
        "  const xp = event.player.getDynamicProperty('progressionXp');",
        "  return xp;",
        "});",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzePersistenceSource([script]);

    expect(
      result.reconnectTransientRestoreRiskCount,
    ).toBe(0);
  });

  it("classifies a durable result recovery record by semantic field coverage", () => {
    const script = parseScriptFile(
      "main",
      [
        "function commitResult(resultId) {",
        "  const record = {",
        "    arenaGeneration: 4,",
        "    resultId,",
        "    terminalReason: 'timeout',",
        "    participants: ['a', 'b'],",
        "    objectiveEvidence: { score: 7 },",
        "    commitTick: 1200,",
        "    rewardOperationId: 'reward:' + resultId,",
        "    winningSide: 'blue',",
        "  };",
        "  world.setDynamicProperty('matchResultJournal', JSON.stringify(record));",
        "}",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzePersistenceSource([script]);

    expect(
      result.completeResultAuditRecords,
    ).toBe(1);
    expect(
      result.resultAuditRecords[0],
    ).toMatchObject({
      propertyKey:
        "matchResultJournal",
      status: "complete",
      missingRequiredFields: [],
    });
  });

  it("keeps an incomplete durable result record explicit instead of treating it as recovery-safe", () => {
    const script = parseScriptFile(
      "main",
      [
        "function commitResult(resultId) {",
        "  world.setDynamicProperty('resultJournal', JSON.stringify({ resultId, terminalReason: 'win' }));",
        "}",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzePersistenceSource([script]);

    expect(
      result.partialResultAuditRecords,
    ).toBe(1);
    expect(
      result.resultAuditRecords[0]
        ?.missingRequiredFields,
    ).toEqual(
      expect.arrayContaining([
        "arena-generation",
        "participant-snapshot-or-revision",
        "objective-evidence",
        "commit-tick",
        "reward-operation-id",
      ]),
    );
  });
});
