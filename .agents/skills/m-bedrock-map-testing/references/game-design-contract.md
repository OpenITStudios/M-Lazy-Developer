# Game Design Contract

Used before gameplay bug discovery.

## Purpose

Reconstruct the selected world version as a player experience before classifying defects.

## Required Model

```text
Selected World
→ Objective
→ Win Condition
→ Lose Condition
→ Gameplay Flow
→ State Transitions
→ Reset Rules
→ Preserve Rules
→ Progression Rules
→ Multiplayer Rules
→ Bug Discovery
```

## Minimum Questions

- What is the player trying to achieve?
- What makes the player win?
- What makes the player fail?
- Which progress resets?
- Which progress persists?
- How does the player move from one state to another?

Do not classify implementation anomalies as bugs before this contract exists.

## Developer code as a guide to authored gameplay

The supplied developer source is useful for recognizing implementation intent,
but it is **not** a design specification for every selected map.

When the map contains forms, entity cleanup, teleport, scheduled callbacks,
audio, UI, persistence, or custom components:

1. Read the **selected-map** caller and callee, then reconstruct
   trigger → guard → state owner → effect → player outcome → cleanup/reset.
2. Consult only the relevant developer reference in
   `docs/analysis/developer-practice-context.md`; where a source-code hash
   is supplied in `experiments/developer-practice-signals.json`, compare
   it with the selected map's module bytes before claiming the *same code*
   runs. A similar symbol name is not a file match.
3. Trace delayed answers and callbacks after `await`, arena/session identity,
   scoreboard/dynamic-property ownership, and cancellation after round
   transitions. Developer implementations illustrate testable counterexamples,
   not mandates that every map follow their architecture.
4. Establish a BUG only from a selected-version expected/actual contradiction.
   Keep unrelated valid designs as EXPECTED and insufficient evidence UNKNOWN.
   External Skills Probe observations do not replace target-specific proof.

The optional `--developer-practice` source path to model task packets
provides bounded REFERENCE questions, never a new detector or proof receipt.

## REA-derived investigation

Apply these questions inside the existing UNDERSTAND/FORMALIZE work, not as a second
map audit, graph, proof ledger, or report. REA is an external investigation
reference/provider; Minecraft semantics remain owned by our existing analyzers,
Semantic IR, Gameplay Intent, Scenario Graph and proof gate.

### Route by the evidence actually needed

For a complete source repository, inspect the pinned source directly. REA's own
skill explicitly excludes ordinary source-repository architecture analysis.
For an exact shipped package, extracted JavaScript bundle, binary or runtime
question not answered by source, use an actually available REA capability with
its advertised schema. A skill file is not a connected MCP server. Do not run
setup/readiness repeatedly or require a user PC, runner, deployment or new
production dependency. Lack of a callable provider limits that operation only.
Bedrock NBT, LevelDB, command blocks, pack activation and Minecraft scheduling
still require our format/domain owners; a generic REA graph does not replace them.

### Trace a mechanic rather than collecting matching names

Start from one player-visible objective or a precisely located source operation.
Trace forward through trigger, guard, receiver/owner, state/resource mutation,
consumer, terminal/recovery path and player feedback. Trace backwards from the
claimed result to its prerequisites as a counter-check. Use exact existing node,
edge and source identities. Follow cross-file imports, parameters and actual
call sites; a similar name, source co-location, connected graph or function
return does not prove causality, guard feasibility, execution or game victory.

Read the relevant configuration, dialogue, locale, entity or structure beside
the code when it changes the question. Distinguish expected design, implemented
source behavior and observed behavior. A developer-reference pattern supplies a
question, not a map rule. Separate independent gameplay modes only when actual
ownership/entry evidence establishes their boundaries; do not merge roots merely
to satisfy a single-entry closure check.

### Retain evidence once and preserve every material question

Reuse the matching artifact SHA, source location, analysis revision and existing
evidence record. Read a summary, then the exact unanswered source/graph region.
For real REA output preserve its `evidence_id`, provider/profile, authority,
coverage, limitations and residual unknowns; never invent these fields for a
manual review. Page a retained result instead of rerunning its producer.
A fully delivered page is not complete source coverage.

Represent unanswered questions using existing `GameplayIntentUnknown` and
`AuditObligation` fields: the exact question/reason, affected subject/component,
source evidence, missing proof and smallest discriminating validation action.
Keep supporting and contradicting sources visible in the same evidence context.
Unbound questions, missing node identities and stale selections remain unresolved.
A partial priority list of material unknowns cannot erase the other unknowns;
explicit non-material tolerance is scope-specific, and material evidence wins
when classifications conflict. An unmapped finding remains visible as residue.

### Challenge the explanation before closure

Try one relevant counterexample: another owner with the same label, a missing
call target, a guard rejecting the action, retry/reuse, an intentional alternative,
or a failure between resource debit and effect delivery. Preserve valid source
paths even when an unrelated frontier is incomplete, but do not claim absence
from an incomplete search. REA's traversal assumes upstream admission: its raw
function is not a validator for arbitrary seeds/graphs. Reuse the reasoning
principle, not every helper's unstated trust assumptions.

Use independent frozen mechanic expectations for real-map evaluation, including
negative controls and intentional unknowns. Renaming/reordering that preserves
meaning should not change the chosen explanation; removal of a real evidence
source must lower confidence rather than create an invented replacement.
Node counts, zero findings, regression replay and a finite passing test set do
not establish whole-map comprehension.

### Operator result and stop

Present game design, evidence-backed deviations, and the exact remaining
questions. Explain which source establishes each material claim and what could
refute it. Keep source reachability separate from runtime behavior. A blocked
canonical audit, unrouted residue or contradictory arena finding cannot justify
`NOT_APPLICABLE` from non-detection. A derived terminal status still relies on
the canonical audit's evidence; it is not independent absence or safety proof.
Stop the scoped question when it is answered or its precise remaining authority
is established. Whole-map closure still requires the existing mandatory audit
contract; unresolved roots, semantic scope or live behavior remain explicit.

### Pinned external references (reference, not gameplay authority)

Reviewed REA revision: `f611d8ce722cd36345e9ff83b9669ef2e7fe57a9`.

- [Target routing and staged investigation](https://github.com/morluto/rea/blob/f611d8ce722cd36345e9ff83b9669ef2e7fe57a9/.agents/skills/reverse-engineer-anything/SKILL.md)
- [Evidence, comparison and unknown lifecycle](https://github.com/morluto/rea/blob/f611d8ce722cd36345e9ff83b9669ef2e7fe57a9/.agents/skills/reverse-engineer-anything/references/evidence-workflows.md)
- [Source feature traversal](https://github.com/morluto/rea/blob/f611d8ce722cd36345e9ff83b9669ef2e7fe57a9/src/domain/javascript/javascriptFeatureTraversal.ts)

## ChatGPT-native reverse engineering — no REA MCP required

**Execution authority:** This is a procedure for ChatGPT using tools **actually
available in the current conversation**, not an installed REA server or a
separate audit engine. Follow the selected-map Pre-Audit confirmation and the
same TARGET → DISCOVERY → UNDERSTAND → FORMALIZE → EVALUATE → PROVE → REPORT flow.
Use the selected `.mcworld` (not a prior map or an extracted historical sample)
as the only current gameplay authority.

### 1. Verify artifact and inventory before tracing

When an exact map artifact is present, identify its bytes (SHA-256 when tools
support hashing), edition/version evidence and package inventory. For local
ChatGPT artifact access, read the ZIP using an available bounded, **read-only**
archive tool; Python's standard `zipfile` is acceptable when the container
and file are actually available. Reject absolute paths, `..` traversal, unsafe
links, duplicate normalized entry names, malformed archive entries and
resource-exhausting entries before materialization. Avoid execution of embedded
JavaScript, native modules, installers or untrusted source. Build a logical
inventory of behavior packs, resource packs, scripts, functions, manifests,
dialogue, entities, structures and native world files; report unavailable or
unparsed formats rather than silently skipping them.

Resolve active packs only from selected-artifact pack/level evidence; folder
presence and matching filenames cannot prove activation. Record source identity
as artifact digest + actual pack + normalized relative path + source range
(line **and column** for minified JS), or a format-native key for LevelDB,
command blocks and NBT. Inventory completeness is not gameplay completeness.

### 2. REA-style source reconstruction inside ChatGPT

Start with a **specific mechanic/question** (entry, role, objective, item,
shop, reward, phase, arena, reset/reconnect). Identify the smallest authoritative
source seed and its **actual source declaration**, not just a textual match.

For JavaScript, parse with a syntax-aware tool **only if one is actually
available**; otherwise use bounded, explicitly less-complete source inspection.
Follow exact exports/imports, calls, callback registration and parameter
handoffs across files and bundles. Track shadowed variables, same-named
functions, unresolved dynamic imports, alias receivers, minified names and
disputed targets as unresolved; never resolve on naming similarity. Treat
minified physical line numbers alone as insufficient location identifiers.
Do not claim to run `analyze_javascript_application`,
`trace_application_feature`, `trace_javascript_semantics`, REA CLI or MCP
unless that precise capability was genuinely invoked.

Trace **forward**: player entry or event registration → guards/prerequisites
→ reachable call candidate → mutation or world effect → consumer/result/feedback
→ retry/reset/recovery. Trace **backward** from each intended outcome or
observable side effect to the originating caller, input/owner and necessary
conditions. Record every broken edge, ambiguous target, deferred/scheduled
handoff, exception/return boundary and unexamined dependency. A source call
path is a **candidate** route, not proof that guards are satisfiable, the event
runs, a command succeeds, an entity navigates, or a player wins.

For Bedrock semantics join these source observations only with independently
matching selected-artifact Script API calls, commands, NBT/LevelDB,
`.mcstructure`, entity configuration, localization and pack references.
Do not repurpose generic Electron/IPC/native REA concepts as Minecraft
mechanics. A REA graph never substitutes for the engine's existing
`semantic-ir`, Gameplay Intent or Scenario Graph.

### 3. Record bounded results in existing owners

For each material investigated mechanic, return these **fields in the existing
Game Understanding/Obligations presentation**, without creating a new database
or second report schema:

- question + scope, exact selected artifact and relevant pack/version;
- authored design evidence and distinct observed source implementation;
- source seed, forward path and backward counter-trace, with source locations
  and exact IDs where established;
- actor/session/arena ownership, relevant guards, effects, terminal/retry
  behavior and player feedback **only where evidenced**;
- confirmed links, inferred links, missing/dynamic edges, contradicting
  evidence and search boundaries;
- source-only interpretation, possible divergence, or **UNKNOWN** with the
  smallest deciding source or runtime check.

Use the existing `GameplayIntentUnknown` and `AuditObligation` owners for
unanswered questions; when the TypeScript path actually runs, let the existing
`gameplay-discovery-challenger` identify unowned IR operations and unresolved
edges. A manual ChatGPT review may describe the analogous gap but must not
fabricate engine-generated IDs, audit revision, closure receipts or issue lanes.

### 4. Coverage challenge and cross-map generalization

Perform a reverse source sweep before declaring a scope understood: enumerate
material authored event roots, state writes, resource debits/grants, world
effects, returns, timers, command blocks, dialogue targets, structure loads
and active pack branches; ask which are not explained by a current mechanic or
linked to a source-backed outcome. Treat alternate execution roots separately,
including independent games or modes. A valid graph may have several authored
structural entries; multiple roots alone do **not** establish selectable
gameplay modes or player activation.

Challenge an apparent match with at least one realistic counterexample:
guard rejecting action, different arena/player owner, shadowed symbol, failed
resource delivery, disconnected source file, nonactivated pack, race/reload,
or a different stage using the same label. A candidate bug requires an
independent selected-artifact Expected/Actual contradiction; negative source
search requires demonstrably complete relevant coverage.

Reuse existing map-source reviews as navigation/benchmark ideas only, never
as truth about the currently selected version. After a bounded source path is
integrated, compare source-backed questions across a modular JS map,
a minified JS map and a contrasting multi-mode/build map. Report discovered
true links, missed links, false joins and unsupported/unknown questions
separately; never translate a green synthetic test or restored historical
miss into first-pass recall.

### 5. Tool boundary and report honesty

Use available ChatGPT file/analysis tools directly; GitHub `Local` remains
versioned source/knowledge authority, **not** a filesystem checkout or REA MCP
connection. No installation, cloud runner, user-PC workflow or dependency is
needed to complete accessible ChatGPT source work. If a parser/native decoder
is unavailable, finish the source questions that can be answered and mark only
the affected evidence as `UNKNOWN / NOT EXECUTED`. Report the exact level:
source inspected, GitHub source modified, code independently executed in the
ChatGPT environment, programmatic selected audit actually executed, or live
Minecraft observed. Never infer one level from another.
