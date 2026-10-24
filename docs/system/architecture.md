---
id: document.system.architecture
class: DOCUMENT
domain: system
role: ARCHITECTURE
authority: CANONICAL
lifecycle: ACTIVE
---

# Architecture

Lazy-Developer uses semantic ownership and one-way dependency direction.

## Operating architecture: ChatGPT Chat, GitHub source, Google Drive selected maps

**M-Lazy-Developer is operated through ChatGPT Chat to inspect Minecraft Bedrock/Education maps.** An accessible selected `.mcworld` is supplied through Google Drive; GitHub `Local` owns source, semantic contracts, provenance, knowledge and reusable analysis logic. Source files, typed modules, declared CLI paths, test definitions and Node configuration are not proof of execution. Do not require ChatGPT Work, the user's PC, a VM, CI or a separate operator surface for source-only checking.

The source modules below document one canonical reasoning architecture. Their behavior at a commit is executable evidence only if that exact source was genuinely invoked; direct ChatGPT archive/script/NBT inspection is valid source evidence but must not be misidentified as `runSelectedMapAudit()` execution. Record exact source, interpretation, confidence and missing proof, leaving runtime-dependent claims UNKNOWN unless observed.

## Semantic reasoning and production ownership

There are **two separate task routes**, not one mandatory audit-then-repair chain. Their source contracts never substitute for evidence of executed repository code or observed Minecraft gameplay.

**Selected-map audit (read-only):**

```text
runSelectedMapAudit({ artifactPath })    ← one programmatic coordinator, if executed
  TARGET → DISCOVERY → UNDERSTAND → FORMALIZE → EVALUATE → PROVE → REPORT
                 ↕ calls/derives from existing semantic owners
selected .mcworld (sole current gameplay authority)
  → artifact / archive / native adapters
  → read-only analyzers + normalized project model
  → semantic graph / Semantic IR / Gameplay Intent / Behavioral World Model
  → diagnostics / counter-evidence / proof requirements
  → evidence-bounded Map Audit Output V2 projection
```

The stages belong to the selected-map workflow. Their order/admission is owned by the orchestrator, while artifact, analysis, semantic modeling, diagnostics and validation meaning remain with their canonical packages. A model is a derived representation, **not** a standalone `MODEL` stage. Stress, concurrency, boundary and cross-system challenges are part of `EVALUATE`, **not** a standalone `STRESS` stage. The operator-facing report does not implicitly approve a bug or authorize mutation.

**Separately authorized repair (only after approval):**

```text
approved BUG / explicitly approved design change
  → repair admission + Must Change / Must Preserve
  → existing repair + preservation owners
  → targeted validation / permitted packaging
  → approved downstream report or artifact handoff
```

Repair is neither a compulsory audit stage nor an analyzer side effect. Source inspection, GitHub commits, isolated code tests, an actual programmatic selected-map audit, and live Minecraft observations remain distinct proof ceilings.
## Development sequencing — reusable Game Design boundary and downstream work

Game Design feature expansion is **PAUSED as a development priority**, not disabled, deleted or certified complete. Retain existing `gameplay-intent`, `semantic-ir`, `game-design-spec`, authored-source analyzers and the scoped `GameplayContract` API. Additional mechanics/evidence can later be represented through their existing semantic owner with downstream consumer review; no frozen claim of universal meaning, runtime reachability or contract immutability is implied.

The downstream architecture must consume only the existing evidence-bounded handoff:

```text
selected artifact identity + exact source/evidence references
→ scoped Gameplay Intent / Gameplay Contract (readiness + material UNKNOWNs)
→ existing diagnostic reasoning / counterproof / proof requirements
→ existing issue classification and human approval boundary
→ authorized Repair Contract: Must Change + Must Preserve
→ existing validation + preservation proof
→ archive/package transport + single report projection
```

- **Partial input is not a closed audit:** Architecture work may advance when some game mechanics remain unresolved. The selected-map audit still enforces UNDERSTAND/FORMALIZE/EVALUATE/PROVE as applicable; missing understanding cannot become a confirmed BUG, approved repair, zero-findings PASS or runtime success.
- **Single owner per decision:** `gameplay-intent` owns authored purpose and unknowns; `diagnostic-reasoning` owns alternative explanations and source-grounded intent disposition; `diagnosis-pipeline` owns only its declared planned execution/reuse; existing orchestrator defect resolution/admission owns selected-audit disposition; `bug-report` owns approved BUG state. These are composed rather than replicated.
- **Change-safe extensibility:** Future Game Design enrichment updates the existing producer and verified consumer contracts. No downstream stage may parse raw labels or guess missing intent as a fallback. Preserve selected-artifact identity, evidence locators, scope, uncertainty and compatibility applicability across every handoff; fail closed if they are absent.
- **REA-style falsification:** For each architectural source route, trace caller → decision → output and backward from the claimed output → exact evidence; challenge missing activation, alternate ownership, wrong version/arena, guarded exit and counter-evidence. This applies REA investigation principles through direct GitHub source review, **not** an executed REA MCP/CLI assessment. A source-verified contract is not executable/runtime proof.

Next implementation work should investigate one real generic UNDERSTAND→DIAGNOSE/PROVE consumer route before modifying code, then follow the existing repair/validation/package/report owners. Avoid a second workflow, engine, registry or generic interface invented solely for this deferral.

### Literal JavaScript `import()` requests versus executable gameplay

The canonical source parser `engine/analyzers/scripts/src/parser/parse.ts` now records literal `import("./chunk.js")` requests in the **existing `ScriptImport` inventory** with `importSyntax=dynamic-literal`, owning SourceRef and execution region. Nonliteral `import(variable)` becomes `dynamic-expression`, `unresolved`, and can never be assigned a fabricated file path. The original `resolveScriptImports()` checks same-artifact and same-pack source ownership and uniqueness; `populateInspectionScriptImportGraph()` projects the dependency through the **existing semantic graph**, preserving `importSyntax` and the actual import call site.

These are **source-level module-lookup/dependency edges**, not proof of executed gameplay. The existing `buildInspectionSemanticIr()` also projects authored `import()` requests into **deferred source-handoff candidates** in the canonical Semantic IR, retaining resolution, source site, lexical/precedence guards and same-block authored order when known. A `resolved` target means the selected source file is present; neither this IR edge nor a candidate trace establishes that the importing function ran, its guards were satisfied, the JavaScript engine loaded/initialized the module, or Minecraft gameplay occurred. Dynamic imports must not be fed into cross-file ESM function-call ownership by spelling alone. Compiler-produced `.js` specifiers may match a unique corresponding `.ts` source; ambiguous competing targets, foreign artifacts, cross-pack traversal and computed expressions stay unresolved. No special rules or map identifiers are used.

## Game-centric Discovery production spine

The production route is an integrated **source-to-understanding** contract, not a sequence of independent gates that each demand new tests:

```text
selected Minecraft artifact
→ physical/source inventory (adapters + analyzers/discovery)
→ parsed authored behavior and exact provenance (domain analyzers)
→ normalized execution/state/temporal evidence (semantic-ir)
→ authored gameplay purpose/mechanics (gameplay-intent)
→ transitions, dependencies, outcomes (behavior-model + graph)
→ scenario composition / gameplay-world understanding (existing orchestrator)
→ navigable Game → Systems → Mechanics → Flows/States → Scenarios
→ evidence-backed audit/report projection
```

Ownership constraints:
- Physical file accounting is not game-understanding completeness. `OPEN` structural gaps and `PARTIAL` recorded uncertainty must never be silently rewritten as confirmed semantics.
- `semantic-ir` describes source execution/state; `gameplay-intent` assigns player-facing purpose. Neither alone proves the complete game or runtime behavior.
- Scenario presets guide inspection; they must not invent undiscovered mechanics or replace source-grounded relationships. The scenario graph and architecture navigation are derived views, not competing canonical model stores.
- Discovery Challenger compares raw material source facts against modeled, evidence-backed behaviors, and retains unowned facts as visible gaps. It does not require endless per-edge patching to publish independent, scoped evidence.
- Existing report/admission owners control final publication. An incomplete model may expose scoped evidence, but never claim whole-map closure.
- During construction, prioritize wiring and consolidating this full spine before adding detectors, another graph layer, micro-fixtures or test harnesses. End-to-end acceptance is a later integration boundary; runtime claims still require runtime evidence.

### Game-centric operator projection

The canonical `deriveGameplayArchitectureNavigation()` projection exposes `gameplayStructure` from the existing scenario graph and exact selected-artifact evidence. The production `runSelectedMapAudit()` composes this once, retaining it on `SelectedMapAuditRun.gameplayArchitecture` and passing the same derived structure to the optional, backward-compatible `MapAuditOutputV2.gameplayStructure` field.

- **Game:** existing `game` subject IDs, or an empty list when none were grounded. The same projection includes a compact `subjects` and `scenarios` lookup so every relationship endpoint/scenario ID remains navigable in the standalone report without reconstructing another graph.
- **Systems:** existing runtime-domain components. `provenFeatureIds` require an exact PROVEN causal link; `coPlacedFeatureIds` are only navigational scenario co-placement.
- **Features:** existing mechanic, objective, phase, lifecycle and outcome subjects. Each exposes source evidence, scenario membership, typed dependency/effect/transition/outcome links with their original status, and IR traces matched by exact evidence.
- **Unmodeled:** unplaced features and unmatched technical Semantic IR evidence remain visible. Empty association is not positive proof of feature absence.
- **Authority:** this is a rebuildable view. It does not infer missing player design, promote unresolved relationships to PROVEN, change the mandatory audit gates or claim runtime truth.

During BUILD, complete missing authored semantics at existing source/intent/behavior owners before inventing deeper feature taxonomies, test fixtures, or alternate graph stores. Integration acceptance remains deferred until the full path is ready.

### Universal interpretation / sample isolation contract

**This is a product invariant, not a new parser or execution stage.** The selected artifact is the sole current-game evidence universe. Sample names, historical QA findings, known-game labels, fixture IDs, hand-curated map-specific source paths and prior benchmark outputs belong to evaluation/navigation only. Source-facing processing must rediscover mechanics through the *actual selected artifact* and its existing provenance/call/guard/state evidence, including when the game is entirely unfamiliar. No dedicated "Defense"/"Bedwars"/"Circuit" production rule is permitted simply because one calibration sample exposed a gap.

**Stable semantic kernel:** retain reusable typed relations for actor, trigger, precondition/guard, action, state/resource write/read, physical/world effect, objective/outcome and recovery. Source-native relation IDs, selected-artifact fingerprints and scope boundaries must be preserved end-to-end. Expand existing producers when a demonstrated source pattern is missing; do not create genre-specific graphs, store a finished design per map, use names alone as ground truth or transfer expected behavior from the calibration oracle into runtime logic.

**Scope before explanation:** bind a claim only to mode, arena, team/role, session, level, revision and/or time boundary actually supported by evidence. If two plausible objectives/outcomes cannot be associated with a unique scope, report competing candidates or UNKNOWN rather than electing the first. An authored API/config branch can establish a source rule without proving runtime reachability. Game types are optional routing hints, never rules or objective defaults.

**Evidence discipline:** distinguish *embedded design instruction* from *player-facing source cue* from *implementation-derived candidate*; keep all three separate from actually observed Minecraft runtime. Neither source-text co-location nor endpoints with evidence can authorize an unsupported connecting edge. A path through resource/scoreboard/state does not establish session chronology. Silent or zero-finding reports and a graph with many nodes do not prove map-wide understanding. Contradictory current sources remain visible pending scoped resolution.

**Admissible improvement:** before editing a canonical semantic owner, specify a generic falsifiable capability (e.g., accurately link interaction to a typed state write using exact IR edges), an independent source-backed positive, an unrelated or blocked negative, affected consumers and a named regression risk on a contrasting source shape. Develop against calibration evidence only; freeze and withhold blind-holdout expectations until the candidate implementation/output is fixed. Semantic improvements are not accepted on node count, copied client-map code paths, canned AI answers or a new specialized detector.

**Readiness vs scientific proof:** repository source review may validate the integration contract, but executable/typechecked behavior, full `.mcworld` replay, player reachability and live runtime each need their own actual evidence tier. Missing evidence must be reported as UNKNOWN/NOT_EXECUTED, not converted into a percent confidence. Current decisions and implementation owners remain in `planning/development.md` and `docs/system/implementation-map.md`; evaluation cases remain in `engine/reliability/corpus/`.

### Source-owned identities for generic Gameplay Intent extraction (P2)

The canonical `engine/analyzers/gameplay-intent/src/extract.ts` now distinguishes **lexically classified named region candidates by their source-module/region owner** whenever the same semantic function key occurs in more than one script module. The owner suffix uses the stable source-module path and exact declared region, not an artifact release fingerprint, map name, genre, QA history, file-count threshold or a stored game profile. Selected-artifact identity remains authoritative in the evidence/model instead of changing otherwise stable semantic IDs across releases. Functions whose classified key has one observed owner keep their existing semantic ID. Explicit source relationships (local/cross-module resolved call sites) still link the real owners; repeated text alone cannot link two game modes.

Function-derived state mutations, discriminated status/outcome returns, guarded predicates and their relation/coverage IDs inherit the same owner scope on ambiguous names. **Independently authored transition tables with the same table label in different source modules** are also kept distinct; typed/untyped declarations are deduplicated only within their owning script instead of permitting another mode's typed table to erase a source transition. Otherwise a source-owned function would be split correctly but its outputs merged again, fabricating a cross-module dependency. Only an exact `function:<parsedName>` region label admits a classified source candidate; the parser-assigned label by itself is not proof that a declaration is reachable or executed. Resolved ESM export aliases are looked up by **actual resolved executable target region**, not the imported/exported alias string. Unresolved or ambiguous calls remain unproven source debt. These changes preserve selected-artifact provenance through existing Gameplay Intent stage, scenario and audit consumers without adding a second owner or report contract.

**Remaining limitations:** a shared world scoreboard objective can legitimately be global and must not be blindly module-scoped. Same-file duplicate function/member declarations without exact unique parser/IR owner identity, unclassified source entries, and semantic equivalence of real state across modules remain unresolved until independently grounded. This P2 slice improves identity safety, not coverage of all actor/trigger/guard semantics or Minecraft runtime correctness.

### Exact authored return-to-guard evidence (P2)

The canonical Gameplay Intent extractor must not equate counts of returned discriminants and guard declarations with **proven guard coverage**. A classified `action`/`outcome`/`result` return remains source-observed; an `authored` policy edge and `admissible-policy` invariant require a unique matching return **source span**, exact module and selected-artifact owner, discriminant property/value and parsed execution region. Ambiguous or absent source spans do not certify a guard-to-return edge. A duplicated guard annotation for one return site is not a second guarded return, and only one of two same-valued return sites being guarded is explicitly incomplete.

The existing `outcomePolicyCoverage` projection counts parsed return records and distinct exactly matched guarded return sites; `completeDirectGuardCoverage` requires every counted return to have a unique full site matched by a direct guard. Unresolved cases remain `unknown:outcome-policy-coverage:...` on the existing Gameplay Intent model with selected-source evidence, visible in the existing operator brief and bounded model handoff. The proof gate, report schema and game classification do not change. A source-guarded branch still does **not** prove the guard is satisfied, its return runs, or that its value is a player win/lose condition.

Before extraction, the selected-artifact Gameplay Intent stage filters parsed/contract scripts and resolved cross-file references by the explicit selected artifact ID. A different map version with the same relative path cannot supply an alternative current-world return. Each nested return and direct-guard record must also belong to its owning parsed script. Standalone module-level or unclassified utility return values remain technical IR evidence, **not** gameplay outcomes minted from `success` or `complete` strings. Existing Semantic IR keeps unclassified source data for investigation, not implicit game-design authority.

**Proof ceiling:** committed source changes and authoring of narrow positive/negative tests do not imply TypeScript/Vitest, selected-map CLI, player-level path reconstruction, real Minecraft runtime or cross-map accuracy PASS. Only exact-source comparison and checked consumer contracts are valid until those runs actually occur.

### Source-memory identity and unresolved aliasing (P2)

A `Gameplay Intent` state value is not a runtime storage or game-scope claim. The original source extractor could merge two writes to identically named state values (e.g., two modules both assigning an enum `Active`) regardless of the **actual script-memory surface**. The existing Semantic IR's `script-memory` surface instead identifies the source module and the exact written target. This mismatch could make two unrelated mode/arena/session candidates appear to share a state even when no source alias relation was established.

The canonical `engine/analyzers/gameplay-intent/src/extract.ts` now uses that same *module + exact target* identity when a state label collides across more than one source-memory surface. Single-owner lexical IDs remain stable; the collision uses `:memory:<encoded-module>:<encoded-target>` on the affected Intent state subjects, and the existing source-bound transition relationships point to those specific subjects. Multiple functions that write the same source target keep one syntactic state subject; this still does not prove they operate on the same live object instance. A foreign-artifact/module mutation cannot be attributed to a selected-script state owner.

The existing `buildGameplayIntentModel()` records one `unknown:source-state-alias:...` per colliding *lexical label* with all relevant source state subjects and selected-artifact evidence IDs. This asks whether the source-local references actually alias shared runtime storage and which player/session/arena/mode scope applies. **Source identity separation is not proof of runtime isolation; nor should equal labels prove runtime sharing.** The canonical `--brief` and bounded `--handoff` expose these questions without changing Bug admission or introducing a parallel design model.

A scoreboard/tag objective is a different explicitly named shared technical resource, not script-memory; this change must not automatically split it by source module. Real scoreboard participant identity, imported memory aliasing, per-instance ownership, module-level return/outcome identity and temporal crossing remain separate unproven questions until corroborated by more precise source/IR or runtime evidence. All actual Minecraft behavior remains NOT OBSERVED.

### Trigger-to-effect source interpretation (P2)

The existing `reconstructClassifiedMechanics()` in the Scenario Graph now distinguishes an authored *source entry reference* from trace co-placement. An inferred `requires` helper dependency, `valid-during` rule or `scoped-to` label does not prove that a mechanic has a trigger. An entry reference must be source-associated with an event, NPC dialogue or behavior animation and match the exact selected-artifact Intent/IR evidence; otherwise it remains `TRACE_CONTEXT_ONLY` and activation remains unresolved.

One existing mechanic projection records `sourceActivationCandidates` with source-flow/entry IDs, entry kind, exact supporting source IDs, directly matched material source steps, branch-point count and unresolved call edges. An exact source state write, resource action or world effect can establish limited *source-effect linkage* without proving that the source executed or that the effect is intended Game Design. The canonical Map Audit Output V2, `--brief` and bounded `--handoff` expose these receipts without adding another proof engine, manager, agent or report.

The model is still static: an authored entry is not proof of player accessibility, execution, guards being satisfied, effective world changes or actual gameplay. All runtime-native claims and independent cross-map recall remain UNKNOWN.

### Exact parser receiver type versus live state-instance ownership (P3)

The canonical `arena-state-isolation-analysis.ts` now reuses the **existing**
script parser's `inferScriptMethodCalls()` source record for dynamic-property
operations. A `Player`, `Entity`, or `World` receiver-type candidate may be
attached to one source-state access **only** where the exact authored method
name, receiver expression, execution region, artifact, script path, JSON
pointer and complete line/column span agree uniquely. The API receiver
type is a bounded parser result; it is not proof that the correct player,
entity, arena, or session instance owns the state. A typed `Player` or
`Entity` source receiver is recorded as `player-local` or
`entity-local` with `partition-proof-required`, never automatically
`isolated`. Type-annotated `World` aliases remain world-global source
surfaces needing a partition guard.

The parser already emits `sourceSequence.stableWorldReceiver` for an
**unshadowed named ESM import** of the Minecraft world singleton, including
an explicitly aliased import. A receiver that is merely spelled `world`
does NOT establish this provenance: when import/alias identity is absent,
or the identifier is shadowed by a local argument, source partition stays
`unknown` unless a different exact nonshadowed typed witness exists.
Conflicting duplicate typed-call witnesses, shifted source spans, foreign
artifacts, and untyped dynamic-property receivers must all fail closed.
Nested operation source IDs must belong to the currently inspected script.

This bounded enrichment **reuses** the existing analyzer observation
`scope/status/reason/source`, Gameplay World projection, Scenario Graph
arena evidence, Map Audit V2 `multiArena.isolationRules`, operator brief and
bounded model handoff: no new identity registry, receiver-type heuristic,
graph, standalone report or LLM authority. Actual player identity,
per-arena scope mapping, cross-module aliasing, live storage separation and
behavior at runtime remain UNKNOWN without independent evidence; downstream
`arenaSessionMapping` remains `NOT_YET_ESTABLISHED`.

### P3 receiver and authored-contract proof ceiling

The same-source receiver parser now blocks untyped lexical parameters, callback arguments, local bindings and catch/loop variables from inheriting Minecraft singleton identities. Dynamic-property source-only `isolated` partition candidates require a uniquely proven unshadowed imported Minecraft `world` receiver, not merely a parser-inferred `World` type. A custom declaration also named `World` can still be classified as a source-type candidate but never proves the real SDK object or a live instance. Mutable receiver rebinding and cross-module aliases remain unproven.

A sourced `StateAuthorityContract` only associates an authored ownership declaration with a file. It does not prove the storage key is partitioned, nor that a player/arena instance is unique; matching contracts are now preserved as evidence IDs without promoting unresolved observations into `isolated`. Literal dynamic-property key observations use the parsed unquoted key to match those source contracts correctly. The original scope/status/reason pipeline through Gameplay World, Scenario Graph, Map Audit V2, brief and bounded handoff stays unchanged. Existing source-only `isolated` labels must never be presented as live multiplayer isolation proof.

### Scoped arena call reachability across script modules (P3)

The canonical inspection already derives exact same-artifact and same-pack resolved ESM call edges for Semantic IR and Gameplay Intent. The runtime analysis reuses that same result instead of independently resolving identical modules. Arena State Isolation now traverses authored arena-region source reachability through uniquely owned, parser-source-matched resolved imported call sites and existing intra-file function edges. Imported helper state mutations previously outside any arena-rooted source region become inspection candidates in the canonical `multiArena.isolationRules` and operator brief/handoff with original callee source ownership.

Cross-module reachability is **not** cross-module argument alias proof. The caller's arena/role/session/receiver authority expression is never copied into the callee; imported-only observations retain `partition-proof-required` for unproven shared or player/entity state and a reason explaining the missing instance mapping. Missing/shifted imported call-site witnesses, unresolved calls, duplicate source module paths, mismatched artifact IDs and cross-pack targets do not join. No new registry, schema, parser fork, named-map behavior or gameplay BUG finding is introduced. TypeScript/Vitest, unseen map acceptance and Minecraft runtime evidence remain pending.

### Exact parameter forwarding across imported script modules (P3)

The canonical `deriveCrossFileCallEdges()` now attaches optional `argumentParameterBindings` with both exact AST source spans, only for direct identifier actual arguments and uniquely resolved unmodified formal parameters. Computed expressions, const/member aliases, lexical shadows, default/rest arguments, ambiguous callable exports and potential assignment/rebinding do not establish this witness. Resolver import, artifact and pack isolation remain unchanged.

The existing Arena State Isolation reachability now carries these parameter candidates from selected-source arena membership evidence through uniquely matched imported-call sites, including multiple ESM hops. Intra-file calls without independent actual/formal evidence drop the identity candidate. Conflicting/missing incoming paths or the bounded traversal limit fail closed while retaining source reachability. This evidence adds only bounded explanations to existing isolation observation reasons for imported-only regions: it does NOT upgrade `scope`, `status`, gameplay design authority, or live player/arena/session partition proof. Tests are authored but TypeScript/Vitest, real `.mcworld` and runtime validation remain unexecuted.

### Stable local source aliases and local helper parameter identity (P3)

The canonical script parser now reuses the same AST actual/formal parameter reconciliation as the cross-file resolver. A directly passed parameter, or a unique preceding same-function `const selected = original` identifier chain, may be reconciled with a unique unshadowed local function declaration or a resolved ESM callable. The existing `ScriptArgumentParameterBinding` records exact argument/formal SourceRefs and optional const-alias declaration sites; syntactic source reference flow does **not** prove that the live player, arena, session, storage key or runtime object is isolated.

Conservative limits: ambiguous or shadowed callee names, nested alias shadowing, computed/member/destructured arguments, `let`/mutable bindings, parameter reassignments, default/rest formals, unreachable declaration order, cycles and unresolved imports carry no source-identity claim. The existing Arena State Isolation source-reachability consumer now carries independently evidenced local and imported parameter mappings, including mixed local→ESM chains. It appends bounded source reasoning through the existing observation `reason`, but does not raise `scope`, `status` or a gameplay design rule from parameter mapping. Unproven ownership and cross-arena correctness remain explicit; no parallel graph, identity registry, report schema, dedicated map rule or second analyzer has been added.

This is static-source integration. TypeScript/Vitest, actual `.mcworld` acceptance, independent cross-map quality measurement and Minecraft runtime evidence remain **NOT EXECUTED**.

### Scope provenance before player/arena/session interpretation (P3)

**Existing state-isolation owner**: `engine/packages/orchestrator/src/arena/arena-state-isolation-analysis.ts`. The script parser's `DynamicPropertyAccess.receiverHint` is an **expression string**, NOT a resolved `Player`, `Entity` or arena instance type. Receiver spellings such as `player`, `group.player`, `session`, `arena`, `round`, or `serverWorld` cannot by themselves establish partition, even when an inferred arena-related function contains that access. Only the directly authored Minecraft `world` root is treated as a known world-global receiver; where an exact same-region authored authority expression partitions the *key* of a world dynamic property, that is a static source partition candidate and **not** proof that live arena IDs are unique.

**String match false-positive guard:** authored authority expressions (including qualified `arena.id`) must match complete token boundaries. `arena.id` appearing as a substring of `otherarena.id` is NOT the same authority. Ambiguous receiver expressions now carry `scope=unknown` and `status=partition-proof-required` instead of being certified `isolated` merely by variable naming. Existing explicit source-partition evidence and selected-artifact state-authority contracts still flow through the same producer; all genuine runtime actor/arena/player identity and successful isolation require further evidence.

**Duplicate script ID protection:** each isolation observation retains its own `SourceRef` from the parsed script and is checked against authority-contract source references by **artifact ID and relative path**. A `scriptId` can appear in multiple packs or map revisions and is not a unique source identity; a contract from another map cannot prove this one's storage partition. The canonical `GameplayWorldModel.arenas.isolation.observations` carries `surface`, `scope`, `reason` and nullable `sourcePath` end-to-end; existing Scenario Graph arena evidence reuses these optional fields for legacy consumers, without generating any runtime game loop. The unchanged `MapAuditOutputV2.multiArena.isolationRules` string list exposes source scope and locator, `--brief` shows a bounded sample of unresolved partition questions, and the same bounded `--handoff` retains up to eight. Nothing is promoted to BUG or an authored game rule.

**Limits:** `isolated` is an analysis-side source observation, not player-instance identity, complete multiplayer safety, runtime state ownership, or actual Minecraft execution. `arenaSessionMapping` remains `NOT_YET_ESTABLISHED`; source contract declarations and source-key spellings do not prove key uniqueness. A map name, historical bug or sample expectation cannot change these semantics.

### Cross-source joins in partial game loops (P3 initial source guard)

The existing Scenario Graph's `reconstructAuthoredJourneyCandidates()` no longer treats two independently selected-source-backed relationships that merely touch the same state/scoreboard/resource subject as proof that they compose a single game loop. A shared lexical node does **not** establish that a write in one module satisfies a condition or produces the state/outcome of another module. This applies equally to maps containing one game, several rounds, multiple modes, or unfamiliar mechanics; names and sample-map profiles are never consulted.

On the canonical source-flow path, adjacent directed Intent relations may remain one **partial** candidate only when they have either (a) the SAME exact selected-artifact source evidence ID, or (b) an individual exact IR witness from EACH relation on the SAME bounded Semantic IR source trace containing a resolved execution reference. **The same filename/source locator alone is no longer an admissible join witness.** A common trace remains executable-source context, **not** a proven reaching definition, objective/role scope, chronological player route or successful Minecraft runtime.

If neither witness exists, the old journey producer stops that segment at `SOURCE_JOIN_UNPROVEN`, records the two edge IDs, shared subject ID, source locators and the exact missing join proof, and preserves the independently supported downstream segment as a separate candidate. This is a source-scoped boundary rather than a BUG or a finding. Independent cycles remain bounded and repeated segment work is deduplicated. The canonical `gameplayStructure.gameplayJourneyCandidates[].interpretation.sourceJoinGap` is optional, strictly schema-contracted and appears through existing operator `--brief` and bounded `--handoff`. No additional graph, registry, detector, database, analysis stage or report is created.

**Same-file source branch isolation (P3):** the existing Semantic IR trace is the union of possible source sites, including sites guarded by different exact branches. Its `branchPoints` preserve the source site and direct evidence IDs for authored `true` and `false` arms. The same Scenario Graph join decision checks those exact operation/call/return/effect witnesses before joining: if the two relations have direct exclusive evidence from opposite arms of one authored guard, the join is stopped with `sourceJoinGap.missingProof = OPPOSITE_AUTHORED_BRANCH_ARMS`. This exact counter-evidence takes priority over a coarse trace or a repeated source witness. An allowed *same-arm* relation stays a source-only candidate, never a proven evaluated branch or runtime dataflow. Where no compatible exact evidence exists, the original `SHARED_EXACT_SOURCE_FLOW_OR_SAME_SOURCE_WITNESS` missing-proof reason applies with its clarified meaning: **same witness ID**, not same file path. The original bounded `--brief` names the blocker; the standard `--handoff` receives it in existing `sourceDesignPaths`. No second IR interpreter or scope store is created.

**Scope/proof ceiling:** without exact evidence, even same-file links may conceal unobserved branch, player, session, mode, arena or role divisions. Resolved cross-file calls do not prove alias/dataflow through parameters. P3 remains PARTIAL and the full-map holdout acceptance and runtime proof remain NOT_EXECUTED.

### Partial game-loop interpretation (source only)

The existing Scenario Graph's `reconstructAuthoredJourneyCandidates()` now retains exact selected-artifact **state/resource bridge subjects** between classified mechanics, objectives and outcomes. It does not add invented gameplay subjects, infer transitions from nearby source, use historical design as authority, or traverse non-temporal `requires/owns` relationships as player actions. The same bounded graph traversal, not a new game-loop owner, derives `gameplayStructure.gameplayJourneyCandidates[].interpretation`. An interpretation identifies each known subject and relationship, whether a cue comes from embedded authored design, player-facing source text or only technical source naming, exact source evidence, known source-flow links, and explicit missing design/runtime proof.

Production `runSelectedMapAudit()` exposes this in the canonical Map Audit Output V2, optional `--brief` and bounded `--handoff` through existing owners. Legacy one-line objective/win/lose summaries refuse arbitrary selection among conflicting/multi-mode candidates, ignore unscoped/foreign evidence, and reserve `authored` for current-artifact embedded design evidence. A source relation's direction does **not** prove game chronology, a configured source flow does not prove a player can enter or finish, and no interpretation upgrades BUG admission or report stage. A nonempty path is useful *partial* design context, not whole-map comprehension. Test the actual selected artifact and independent oracle before claiming recall, completeness or runtime correctness.

### Classified function and guarded-return provenance

The existing `Gameplay Intent` producer now retains parser-observed named function regions on already classified subjects and links them to unique Semantic IR region identities using artifact, source module, region and owner. This supplies navigable execution traces without claiming that functions actually ran or that lexical labels prove game design.

The source-grounded guarded return path reconciles `ScriptGuardedOutcome.outcomeSource` with a unique `ScriptReturnOutcome.source` at the exact authored range, execution region, property and value. The existing Intent outcome/state nodes and guarded `requires` relationships inherit that precise return witness. Ambiguous or missing sites remain unresolved; no mechanic or second graph is invented.

### mcfunction-to-gameplay evidence continuity

The canonical `inspect.ts` passes its existing indexed `.mcfunction` sources into `buildGameplayIntentModel()` alongside the same Semantic IR. A classified function is linked only when its source identity matches a unique `mcfunction` execution region and the corresponding surface candidate already exists. Direct `function` invocations require an exact parsed command location and a uniquely resolved IR target. Scoreboard and tag operations use the existing normalized state-surface IDs and are represented as technical `resource` facts, not assumed scoring rules or player effects.

All new function-to-function and function-to-resource Intent relations remain `inferred`. Missing, ambiguous, or unclassified content remains evidence debt in the existing IR/Discovery Challenger. No second parser, scenario compiler, graph, or report authority is introduced.

### Effect-directed source reconstruction

`behavior-model/source-evidence.ts` now derives bounded, backward `SourceEffectSlice` records from existing Semantic IR state mutations, resource actions and authored returns. This follows CodeQL/Joern-style **principles** without installing an engine, adding a graph database or claiming CodeQL-level def-use precision.

For each authored effect/return the owner traverses *only uniquely identified resolved IR execution edges* backward toward event sources, script modules or uncalled mcfunctions; it retains a representative entry-to-effect edge chain, lexical/precedence guards, deferred/periodic boundaries, same-surface preceding read candidates and existing same-region source-ordered return associations. Hard per-effect limits cap depth, visited regions and entry candidates; truncation is surfaced as `TRUNCATED`. Missing ingress stays `NO_KNOWN_INGRESS`, **not** unreachable code or evidence of gameplay absence.

The existing `deriveGameplayArchitectureNavigation()` consumes these behavior-model slices once, connects effects to graph components only by exact evidence ID and separately labels feature associations encountered on a source-call path. It publishes them through the already-established `MapAuditOutputV2.gameplayStructure` view. Static path association is not player-facing gameplay meaning or PROVEN causality; unowned effect IDs remain explicit. Testing/CI are deferred until the integrated BUILD acceptance boundary.

### Authored UI/animation command-to-function causal continuity

The previously disconnected command-to-function path is now wired through
the existing Semantic IR: an NPC dialogue button/scene command or behavior
animation/controller command containing an authored `/function` call records
a uniquely resolved (or explicit unresolved) synchronous source reference
to the existing mcfunction execution region. The execution-edge and temporal
inventories are finalized **after** these authored command sites are examined;
otherwise the newly discovered edges would have been omitted from both.
An `execute ... run function` nested command is kept as a conditional
source reference without evaluating its execution predicates.

Semantic IR's canonical source-entry query includes isolated NPC/animation
command regions as AUTHORED, activation-unknown source candidates, allowing
the same source-flow traversal to display target mcfunction state/world
effects while retaining source evidence identity. The authored behavior
relation carries exact execution-edge IDs; Gameplay Intent and the
existing Scenario Graph project those relationships alongside world-effect
and scoreboard/tag operation evidence. No inferred active game session,
NPC selection, animation playback, successful function invocation or
win/loss outcome is admitted by a resolved command reference.

This is a correction to the first missing causal owner, not another
parallel flow processor. There is no additional runtime dependency or
selected-map data mutation.

### Authored command state and guarded source transitions

The canonical Semantic IR now processes scoreboard and tag reads/writes from
NPC dialogue button/open/close commands and BP animation/controller commands
with the same command analyzer and state operation authority already used by
mcfunction and script sources. Exact JSON-pointer command source identity
links each state operation to the authored dialogue/animation relation; both
the state operation and any world effect IDs are carried to Gameplay Intent
before inferred NPC interaction nodes are reconciled. State writes are authored
attempts, not actual score, progression or phase outcomes.

The existing Behavior Model owns direct literal dynamic-property
guarded-transition reconstruction. The Scenario Compiler now reuses its exact
read/write candidate records in the existing Scenario Graph and links them
to classified mechanic profiles *only* by the write operation's IR ID. The
operator-facing gameplayStructure exposes those same guarded source
candidates and their unresolved continuations. World-only graph refreshes
retain the original read/write evidence without fabricating new observations.
No source-local comparison or raw scoreboard operation is automatically
promoted into a proven game-rule, terminal condition or runtime state.

### Authored NPC dialogue interaction → exact command → IR source effects

The canonical dialogue parser retains JSON-pointer identities for scene
indices, displayed NPC/button text and each open/close/button command, even
when two scenes share a scene_tag. Its command analyzer receives the exact
command source location. The existing gameplay surface owner derives
dialogue-button-command / dialogue-scene-command relations from exact
button indices rather than semantic similarity between displayed words and
source symbols.

The existing Semantic IR normalizes these commands through its canonical
command analyzer and associates source-observed world effect IDs with the
dialogue relations. The Gameplay Intent owner admits an INFERRED NPC
interaction mechanic candidate only for a button with literal visible text
and an exact authored command site. It retains the matching world effects
and explicit unknown for objective, activation and runtime success. Unlabelled
buttons, scene open/close commands, and non-world-effect commands remain
technical evidence, not manufactured player objectives.

The existing Gameplay Scenario Compiler automatically consumes these
classified interaction candidates and exact IR IDs through existing feature
reconstruction; Map Audit V2 receives the original derived gameplayStructure.
The translation .lang parser now splits real CR/LF lines instead of literal
backslash sequences, preserving authored line locators. No second graph,
intent store, classifier or runtime evaluator is introduced.

### Evidence-linked mechanic profiles and authored journey candidates

The existing Scenario Compiler now reconciles classified Gameplay Intent
mechanic/objective/phase/lifecycle/outcome subjects with exact source-flow
step, IR edge and authored behavior-relation IDs. Only current selected-artifact
evidence can ground a profile; a source filename, matching label or scenario
co-placement does not establish ownership. Each observed mechanic profile
preserves original directional Intent relationship IDs, authored/inferred
status, and explicit gaps for activation, state/effect and outcome.

The same Scenario Graph also provides *bounded candidate chains* following
selected-artifact evidence on authored/inferred directed transitions,
recoveries, effects and terminal relations. Chain order is **authored relation
order**, not runtime chronology. Cycles, sink nodes and depth/path truncation
are explicit, and an outcome label is not proof of successful gameplay
completion. Disconnected authored relation cycles remain represented separately from rooted
chains. Missing activation/state/outcome dimensions apply only to appropriate
feature roles; a declared outcome does not require a separate win relation
to itself. Path/depth caps remain explicit and do not imply closure.

These profiles and candidate routes appear in the existing
Gameplay Architecture Navigation / Map Audit V2 gameplayStructure only.
They do not create new mechanic/phase nodes, playable scenarios, causal
PROVEN edges, audit closure or a replacement map-agnostic game-flow checklist.

This is a structural link toward mechanic identification, not general
automatic understanding of unknown game purpose, successful runtime
transitions, multiplayer correctness or full-stage lifecycle.

### Source-backed flow candidates in the canonical scenario graph

The scenario compiler now consumes the SAME selected-artifact Semantic IR as
Gameplay Intent and derives source-flow candidates from its exact entry-region
traces, state operations, resource actions, object return sites and world-effect
attempts. Intraregion source order, branch arms, unresolved execution edges,
temporal boundaries and exact behavior-animation effect IDs remain distinct;
no cross-region order or player outcome is inferred. Isolated authored animation
regions with material source effects remain visible without inventing runnable
event-dispatch edges.

These observations belong to the existing GameplayScenarioGraph as
sourceFlowCandidates, deliberately NOT to its playable scenarios, knowledge
receipts, causal proof or closure statuses. The existing Gameplay Architecture
Navigation reconciles their exact source evidence with classified feature IDs,
unclassified effects and only contextual matching scenarios. Unknown intent
evidence remains visible; a named mechanic is never manufactured by a
technical effect. World-only graph recomposition preserves these source facts.

Map Audit V2 continues to expose its longstanding generic audit-stage checklist
as gameplayFlow but now explicitly labels its basis as
AUDIT_CHECKLIST_NOT_OBSERVED_GAMEPLAY. The actual source candidates are under
gameplayStructure.sourceFlowCandidates. This prevents interpreting the generic
audit checklist as a discovered player journey while keeping its existing
consumer contract. Full mechanic meaning and game lifecycle are still
unverified until evidence supports them.

### Behavior animation timelines and normalized source effects

The canonical entity analyzer also parses behavior-pack animations by exact
animation identifier, numeric nonnegative authored timepoint and literal
command source JSON pointer. Unsupported command entries and large/invalid
timelines remain explicit IR uncertainty evidence; repeated commands are
not deduplicated by command text. The existing cross-source resolver now binds
scripts.animate aliases and controller animation aliases to a UNIQUE same-pack
behavior animation, never to a matching filename or a resource-pack animation.

Both animation timeline commands and already-extracted controller on_entry/
on_exit commands are passed to the SAME canonical command analyzer used by
mcfunctions and scripts. The existing Semantic IR stores source-observed world
effect attempts in isolated behavior-animation regions, retaining authored
timeline seconds and source location. Corresponding authored behavior relations
carry exact world-effect IDs so Gameplay Intent and the existing derived Game
Architecture projection can navigate command-to-effect evidence without
inventing a confirmed execution path.

An authored command can be present even when activation, Molang predicates,
scheduler/tick timing, entity binding, permissions, world effects, or the
player-facing mechanic remain unknown. No second parser/graph, flow controller,
runtime evaluator, or deployment dependency is introduced.

### Authored cross-source entity/controller behavior references

Entity descriptions now preserve exact animation alias targets and explicitly
activated scripts.animate entries. The existing entity analyzer reads
behavior-pack controller state names, ordered Molang transitions, referenced
animation aliases, and on-entry/on-exit commands without evaluating Molang.

The existing entity-event evidence owner reconciles these definitions through
same-pack controller identifiers, exact entity-local event names, and typed
script/mcfunction command triggers. Unscoped command targets are only possible
matches, never a confirmed entity binding. It records their source and target
provenance as authored behavior relations in the canonical Semantic IR.

Gameplay Intent keeps these facts as grouped unresolved behavioral meaning,
while the existing Game Architecture Navigation exposes the same IR relations
through its derived gameplayStructure projection. No branch activation,
animation playback, world mutation, complete mechanics or player-facing
outcome is inferred. The previous source semantic gaps for behavior animations
and controllers remain open until their downstream effects and cross-format
references are fully interpreted. No second parser/graph or runtime engine was
introduced.

### Structured Bedrock entity event semantics

The canonical entity parser preserves source-authored sequence, randomize,
filters, direct component-group add/remove and local event triggers as an
operator tree. Existing addGroups/removeGroups/triggerEvents arrays remain
MAY-reference inventories, never proof of simultaneous effects. Each operator
retains the selected entity JSON pointer.

The existing entity state-graph owner enumerates bounded group configurations:
sequences apply operations in order, randomized branches remain alternatives,
and filters yield possible apply/skip arms with explicit conditional context.
Unsupported operators, ambiguous mixed effects or truncated alternatives
become explicit static-analysis limits rather than fabricated composite states.
The entity knowledge and runtime-evidence consumers now expose source-path
limitations and identify event configurations as authored candidates rather
than observed gameplay. Triggered event IDs remain possible reference links,
not proof that a nested event actually executed.

Cross-event sequencing, property mutations, animation controller/Molang event
triggers, runtime weights, and Minecraft Education version-specific behavior
remain unresolved; this is not proof of complete entity gameplay.
No duplicate parser, semantic graph or reporting store is introduced.

### Minecraft authored world-effect sinks

The existing Semantic IR execution owner now normalizes **source-observed attempts** from canonical command, script method, spatial mutation and entity-event parsers into optional `worldEffects` records (spawn, teleport, block change, structure load, dialogue and entity event). Records carry exact source and execution-region IDs, kind, mechanism and evidence precision—not runtime success or game-design meaning. No second detector/parser is introduced.

Canonical forward source traces and behavior-model backward effect slices include these IDs. Gameplay Intent only links effect evidence when the same execution-region ID is owned by exactly one recognized, non-hypothetical source candidate. Unowned and ambiguous effects remain visible in the existing Game-Centric navigation and Map Audit V2 source-effect contract. Report publication and proof gates are unchanged.

### Per-mechanic source behavior paths

Source slicing now preserves alternative caller paths rather than using one global visited-region set that can suppress a second ingress. The traversal remains bounded by path states, depth and collected entry candidates; cycles and excess paths explicitly mark `TRUNCATED`. Every admitted path carries the exact call-site lexical/precedence guards, while resource action slices distinguish authored acquire from release (without claiming cleanup succeeded).

The existing game-centric `features[].sourceBehaviorPaths` is a **derived view over the existing effect slices**. Each effect candidate presents source entry, call edges, guard evidence, preceding same-surface reads, authored resource acquire/release, and guarded source-ordered return IDs where available. `DIRECT_EFFECT_EVIDENCE` is reserved for exact effect IDs on the recognized feature; `CALL_PATH_CONTEXT` identifies a feature encountered on a possible call path and is not proof of gameplay ownership. This projection does not merge incompatible branch outcomes or invent a terminal/recovery flow when source evidence is absent. Neither status constitutes real Minecraft execution.

### World effects and authored returns

The existing Behavior Model source-evidence owner now reconciles normalized Minecraft world-effect attempts and literal return sites only in the exact same execution region and source document, with complete and ordered source positions. An unguarded return permits only a `SOURCE_ORDER_CANDIDATE` claim, not effect success, gameplay causality or terminal proof. Guarded returns remain `UNRESOLVED` when world-effect records lack compatible exact branch ancestry.

The canonical backward `SourceEffectSlice.sourceOrderedOutcomeIds`, Scenario `observedSourceRelationships` and Discovery Challenger all consume this same reconciliation. There is no new parser, graph, report field or proof gate. Ambiguous source relationships remain explicit rather than being upgraded to PROVEN.

### Authored guard provenance for Minecraft world effects

The existing Script AST parser preserves lexical and preceding-exit guards for selected typed API calls, explicit `runCommand` sites, spatial mutations and entity-event triggers through exact call-source identity. The existing spatial world-mutation analyzer's output is now returned by `parseScriptFile` and reaches Semantic IR. Plain embedded command strings remain source content, not executed command evidence.

Semantic IR world effects retain the exact authored branch ancestry. Existing source execution traces place world effects on matching branch arms; backward effect slices expose their guards. The Behavior Model correlates each world-effect/return pair only when its source order, lexical branch arms and early-exit conditions are compatible. `precedingWorldEffectIds` preserves nearby evidence while `guardCompatibleWorldEffectIds` gives the bounded source-order subset. Scenario relationships classify each ID independently instead of borrowing proof from another effect. Even a compatible source path does not prove execution, causality, or gameplay design.

### Bounded intraregion source CFG and reaching definitions

The canonical Script AST parser now emits source-local CFG statement nodes for
sequential blocks, if/else branches, returns and throws, and opaque boundaries
for unsupported syntax or unknown side effects. The existing inspection
Semantic IR owns the normalized CFG and validates graph endpoint/region identity.
CFG projection is attached only to already identified execution regions; it
must not invent extra executable functions from declarations. Lexical block
identity is compared by canonical source coordinates, not object key order.
The Dataflow package owns a parser-independent forward union/kill worklist.
The Behavior Model alone translates imported world receiver identities,
source site matching and typed dynamic-property mutations into its transfers.
An opaque path,
alias ambiguity, wildcard write, incomplete statement identity or work cap
returns UNKNOWN rather than a reaching definition. The Behavior Model
consumes these results when relating exact guard reads to earlier writes;
conditional writes after branch joins can remain alternate reaching candidates
without inventing gameplay purpose or runtime outcomes. No second parser,
graph store or audit entrypoint is introduced.

This representation does NOT yet cover full switch/loop/try/async control
flow, indirect mutations, per-player aliases, callback/session lifetime,
runtime effect success or interprocedural fixpoint. Such cases retain the
source-order candidate ceiling and need further source/semantic reconciliation.

### Same-block source candidate supersession

The canonical Script AST parser now retains a statement-block identity and
ordinal for exact dynamic-property and resolved local-call sites. Only an
unshadowed named ESM import of Minecraft's `world` is treated as a stable
receiver candidate; player, arena, entity, property aliases, conditional calls,
and unknown ownership do not inherit singleton semantics.

The existing Dataflow owner performs bounded same-block source-order
supersession: a later **direct** world dynamic-property write in the same
lexical block can replace an earlier source candidate when the guard read
(or a resolved synchronous caller site) occurs afterward. The canonical
Behavior Model applies this to its existing guard-write/value handoffs and
per-ingress caller-write evidence. Caller-side candidates are grouped by
exact state surface and receiver, so different keys cannot shadow each other.
Existing Semantic IR validation also rejects malformed or cross-source
statement-block identities. No extra graph, storage, detector, report field
or new parsing pass is introduced.

The reduction is an authored-source candidate relation, not proof of
Minecraft execution, effective world mutation, generalized reaching definitions,
control-flow dominance across branches, or live session state. When source
identity, block spans or order are missing, preserve the prior candidates.
This is a bounded prerequisite to complete CFG/fixpoint reconstruction.

### Effect-first continuity for unclassified source behavior

The canonical Gameplay Intent producer now reconciles all observed selected-artifact
state, resource, return **and Minecraft world-effect** IDs against already
grounded gameplay subjects. Exact unowned effects remain per-entry
`GameplayIntentUnknown` evidence with a directly recorded IR entry-region
identity; raw world effects are never automatically renamed into gameplay
mechanics or made into scenario seeds.

The existing `deriveGameplayArchitectureNavigation()` uses those *same*
unknowns and the already-derived Behavior Model source-effect slices to expose
`gameplayStructure.uninterpretedSourceFlows` in Map Audit V2. Each record
navigates from its exact entry and missing-meaning evidence to effect kinds,
guarded source sites, potential outcomes, state handoffs, and only those
candidate call paths rooted at that exact entry. Material evidence without a
source-effect slice remains visible. Recognized feature links are context,
not newly proven gameplay ownership. This is a derived view, never a second
model, interpreter, mechanism catalog, or report authority.

No whole-game percentage, confirmed player journey, or Minecraft runtime
effect is inferred from these static technical flows.

### Source-local guard state provenance

The existing Script AST parser preserves exact lexical and preceding-exit guards on `getDynamicProperty` and `setDynamicProperty` calls; `semantic-ir-stage` carries them into the **existing** state operation records. No second symbol model or control-flow graph is created.

The canonical `deriveSourceEffectSlices()` now resolves exact state-read call spans *inside* an authored effect guard expression (`guardStateReadIds`) rather than assuming all nearby reads are preconditions. Where a literal dynamic-property surface, stable source receiver expression, exact function/document, source order and compatible guard ancestry all match, the view also records **candidate** earlier state writes (`candidateGuardStateWriteIds`). A reused expression is not guaranteed to be the same runtime object, so these remain source-level possible definitions—not reaching-def proof or game-causal truth. Wildcard keys, other regions, and inconsistent guards do not qualify. The existing Gameplay Architecture feature paths and optional Map Audit V2 schema consume this source evidence; unknowns and publication gates remain unchanged.

### Bounded interprocedural guard-state candidates

The existing `deriveSourceEffectSlices()` may now identify a preceding dynamic-property write in a **source-recorded caller** when the callee's effect guard contains an exact dynamic-property read. `candidateIngress[].candidateCallerStateWriteIds` is scoped to that ingress path, and `features[].sourceBehaviorPaths` exposes it without a new dataflow or graph owner.

Admission requires unique resolved *synchronous* call steps from the write's call edge to the target effect, identical selected-artifact identity, an earlier write site in the caller document/region, the same statically identified non-wildcard state surface and receiver hint, and compatible exact guard ancestry. Deferred/periodic/event edges after a write do not qualify. Object identity, state lifetime, aliasing, intervening mutations and runtime execution remain **UNPROVEN**: this is a source-order candidate, not reaching-definition proof or verified lifecycle behavior. Source-local candidate writes remain separate from caller-derived candidates.

### Scoped resource acquisition, release and return candidates

The canonical `behavior-model/source-evidence.ts` now derives `reconcileSourceResourceLifetimes()` directly from existing Semantic IR resource actions and returns. Its per-acquire `SourceResourceLifetimeCandidate` requires exact (non-wildcard) matching surface/key and owner region/document, acquire-before-release source order, compatible lexical/early-exit guards, and no intervening same-key acquisition. It exposes source-ordered candidate release IDs, candidate returns *after* those releases, and blocking reacquire evidence.

The existing `SourceEffectSlice` for each acquired resource consumes this reconciliation once, and existing `gameplayStructure.features[].sourceBehaviorPaths` projects the same candidate without new parser, ledger, graph, inference status, or lifecycle manager. Cross-region, deferred, wildcard, ambiguous, or missing action sites remain `UNRESOLVED` and cannot be called cleanup failures. A source-ordered release and return do not prove successful Minecraft side effects, terminal state, or arena reset; full runtime lifecycle remains unverified.

### Authored scalar state and source-grounded lifecycle handoffs

The existing Script parser now retains only **direct scalar literal arguments** to `setDynamicProperty`: quoted strings, numeric literals (including direct negative literals), and boolean literals. It does not evaluate variable references or arbitrary expressions. Semantic IR `StateOperation.writtenValue` holds the value and scalar kind on the same exact write operation identity; existing Script memory writes without a recognized scalar kind remain unchanged.

The canonical Behavior Model `deriveSourceEffectSlices()` now exposes `authoredStateValue` for each exact non-wildcard dynamic-property write. It also joins **already established** exact guard-read/prior-write candidates into `sourceLocalStateValueHandoffs` and each ingress's `candidateCallerStateValueHandoffs`. Every handoff carries the read ID, write ID, state surface, receiver hint, authored literal and value type, and whether it is source-local or a recorded synchronous caller. Scenario `features[].sourceBehaviorPaths` and existing Map Audit V2 schema project these values without another lifecycle store or coordinator.

A handoff is not a verified reaching definition, previous-state value, session phase transition, Minecraft runtime state, or successful cleanup. Unknown aliases, dynamic values, impossible branch combinations and runtime recovery remain unproven. No state named `waiting`, `active`, `finished` or `reset` is inferred without a directly authored literal and connected evidence. Integration tests remain deferred during BUILD.

### Directly guarded authored state transitions and declaration value correspondence

The canonical Script parser retains a **direct strict** `getDynamicProperty("key") === "from"` or `!==` scalar comparison as part of that original state-read AST site, with its exact comparison source range. The existing Semantic IR state operations preserve the read comparison and typed literal destination writes; authored transition-table declarations are normalized into the same Semantic IR source fact record set, without replacing the Gameplay Intent owner that already models permitted state edges.

The existing `Behavior Model` owner derives `reconcileSourceGuardedStateTransitions()` only when a write is syntactically controlled by that same exact comparison site and matching branch arm, on the exact same non-wildcard state surface, receiver, region/document and typed string value. The old compared value must differ from the new directly authored value. Prior guard conditions must agree; potential intervening same-surface writes are retained as `UNRESOLVED`. `coLocatedDeclarationIds` identifies only **same-document tables that happen to list this value pair**—it does not claim the table is invoked or bound to the property. No state is inferred from labels/names alone.

`SourceEffectSlice.guardedStateTransitionCandidates` and existing `features[].sourceBehaviorPaths` expose these bounded candidates through Map Audit Output V2, with exact read/write evidence and source-inference ceiling. A guarded write is not proof of actual runtime transition, complete control-flow path, state initialization, termination, cleanup, or recovery. Unsupported compound guards and untyped/dynamic values remain outside this candidate subset. No new graph, coordinator or lifecycle registry is introduced.

### Transition-source continuation to effects, returns and cleanup

The existing `reconcileSourceGuardedStateTransitions()` now follows each **source-grounded** state `from → to` candidate forward, rather than treating the state write itself as game completion. Its nested `continuation` records exact same-function post-write world-effect sites, resource release sites and authored return sites, **only when source order and exact lexical/precedence guard ancestry are compatible with that write**. Later unguarded code is not attributed to a conditional transition merely because it follows in the file.

For downstream functions, only a directly resolved `synchronous-call` edge authored after the state write and on a compatible guard path may contribute candidate callee world effects, resource releases and return sites. These targets are **call-body inventory**, not proven runtime results. Unresolved call targets, event dispatch and deferred/periodic boundaries remain in `unsupportedBoundaryEdgeIds`. Bounded target counts set `truncated` rather than silently asserting comprehensive coverage.

Pairs of source-authored resource release and later return sites come from the existing `reconcileSourceResourceOutcomes()` owner; both `sourceOrderedReleaseReturnPairs` and the target-local `releaseReturnPairs` retain exact action/return IDs. Merely listing release and return in the same callee is not itself promoted to a source-ordered pair.

The existing `SourceEffectSlice.guardedStateTransitionCandidates` and `features[].sourceBehaviorPaths` carry this same evidence through Map Audit Output V2 without another graph, lifecycle owner or report layer. A return is not a game terminal; a release is not successful cleanup; and a transition's authored label is not evidence of an arena session state. Proven runtime lifecycle and interprocedural def-use remain unknown.

### Deferred callback session-guard evidence, per source ingress

The canonical Script parser no longer classifies any generation-named comparison anywhere in a deferred callback as `explicit-generation-check`. The accepted source subset is now a **leading first-statement** `if (generationToken !== capturedToken) return/throw` (also allowing a single-statement block), with at least one token-like identifier and no alternate `else` branch. All other callback forms remain `unresolved`. This eliminates broad false-positive "protected" claims in existing Arena Lifecycle consumers, while a recognized early exit remains only a source-level candidate, not proof that tokens refer to the right session.

The canonical Behavior Model backward effect slicer now preserves each event/deferred/periodic boundary as `candidateIngress[].temporalBoundaryEvidence`: exact edge identity, scheduler, normalized source guard status, guard identifiers, and only exact schedule-source matches to already-observed deferred callback handle acquisitions. A matching release ID is obtained from the existing same-region resource lifetime reconciliation. This is never proof that `clearRun` succeeded, a callback executed, or a session/generation owner remained valid. Event dispatch and unrecognized deferred guards remain explicit unknown boundaries, not invented temporal causality.

The existing Gameplay Architecture `features[].sourceBehaviorPaths` and optional Map Audit V2 schema consume the same per-ingress boundary observations. No second async analyzer, graph owner, lifecycle registry or extra verifier was introduced. Full runtime session isolation, stale callback prevention and terminal/cleanup acceptance remain unexecuted.

### Source-level generation gates on actual asynchronous effect paths

An exact leading `if (generation !== capturedGeneration) return/throw` inside an inline deferred callback is now recorded with its original condition source range, as well as the previously preserved guard identifiers. Both operands must be authored reference expressions; comparisons to a constant, checks later in the callback, named callback bodies not resolved by the producer, or arbitrary conditional expressions remain `unresolved`. A matching variable name is never evidence of actual session ownership.

The existing Semantic IR scheduler edge carries `generationGuardSource`; `Behavior Model` backward `SourceEffectSlice.candidateIngress[].temporalBoundaryEvidence` reconciles it with the actual effect path. `sourceGateStatus` is `DIRECT_EFFECT_SITE_GATED` only when that exact guard is an authored necessary early-exit prerequisite on the effect site in the callback region, or `SYNCHRONOUS_CALL_SITE_GATED` when the exact guard precedes the **first** resolved synchronous call leaving the callback and there are no later async boundaries along that candidate path. Other paths are `UNRESOLVED`; guard evidence on a scheduling edge is not implicitly copied into downstream effects across temporal boundaries.

The existing arena deferred-mutation consumer also keeps its historical `protected` classification only when an exact leading mismatch guard is present and all discovered mutation regions are confined to that callback's region. Cross-function mutations without site-level guarded-call proof stay `unresolved`. This is deliberately conservative and does not prove generation token freshness, live arena/session owner identity, successful `clearRun`, lifecycle closure, or player-visible behavior. No new async manager, state store, graph, or report owner has been introduced. The existing Gameplay Architecture path and Map Audit Output V2 schema consume the same bounded evidence.

### Explicit generation mutations and deferred callback session references

The existing arena-authority AST analyzer already observes direct generation invalidations (`generation-invalidate`), including the literal authored `generationExpression`, exact statement site, and function region. These records are now normalized as optional `SemanticIr.state.generationInvalidations`; the callback parser also retains the two exact reference operands of a leading mismatch early exit, not just identifiers matching a regular expression.

Within the existing `SourceEffectSlice.candidateIngress[].temporalBoundaryEvidence`, `matchingGenerationInvalidationIds` lists only invalidations whose exact authored expression equals a callback guard operand and whose script path/artifact match the scheduling edge. `postScheduleCallerInvalidationIds` is a narrower subset: same scheduling caller execution region and exact source order schedule → invalidation. The `generationOwnerRelation` status distinguishes `CALLER_POST_SCHEDULE_CANDIDATE`, `EXPRESSION_MATCH_ONLY`, and `UNRESOLVED`. This is a *source-coincidence* measure, not proof of shared runtime object identity, token capture, session ownership or invalidation-before-callback execution. Multiple distinct arena instances may share the same source expression.

The new records reuse the canonical parser, Semantic IR and backward Behavior Model; Gameplay Scenario already projects the containing `temporalBoundaryEvidence` without a second lifecycle output authority. The Map Audit V2 contract is extended in place. Event, unresolved and deferred boundaries retain their existing path gating and unknown semantics. Terminal, cleanup and recovery success remain runtime-unverified; no manager, registry, new execution model, or dependency was introduced.

### Exact branch feasibility and per-ingress feature association

The canonical bounded backwards `deriveSourceEffectSlices()` now excludes a call-path extension when it requires both opposite arms of **the same exact authored guard location** in one synchronous evaluation segment, reusing the existing guard comparison helper. Event dispatch, deferred and periodic boundaries begin a separate evaluation segment; a guard at scheduling time is not treated as a guard in the callback at a later tick. This is a conservative source-path contradiction filter, NOT proof that a path is executable or that a missing path is unreachable. `excludedContradictoryPathCount` makes pruned alternatives visible in the existing effect slice and Map Audit V2 projection without an extra tracking owner. Paths excluded due to a source contradiction are not counted as truncation.

The canonical Gameplay Architecture `features[].sourceBehaviorPaths` now selects `CALL_PATH_CONTEXT` **per candidate ingress**, only where that specific candidate's `regionIds` includes an exact region evidence ID on the feature. The slice-wide `pathAssociatedFeatureIds` remains a union for navigation and does not authorize fabricating other paths for that feature. `DIRECT_EFFECT_EVIDENCE` still projects all admitted paths of an exactly bound effect; paths with no known ingress do not become spurious contextual associations. Neither relationship establishes the gameplay purpose or verified runtime execution.

This is a single owner-to-consumer correction across existing Behavior Model and Gameplay Scenario. It introduces no second CFG, registry, manager, or duplicated knowledge, and intentionally defers executable acceptance while the larger Discovery architecture is still in BUILD.

## Behavioral claim provenance

Behavior variables, transitions, and temporal properties may carry provenance with an explicit evidence ceiling:

```text
designed
inferred
documented
observed
intervention-supported
```

Designed Minecraft overlays are bound to explicit Map Game Design or authored Behavior Contracts. They are specifications to test, not claims that the engine has already been proven to behave that way.

A provenance audit reports unbound claims rather than silently accepting them.

## Concurrency semantics

Reliability search must not infer independence solely from declared reads/writes.

The concurrency layer can additionally consume:

- explicit happens-before edges;
- causal parent ordering;
- generation ordering;
- event-delivery ordering;
- hidden engine dependency surfaces.

Operations sharing a configured hidden engine surface are treated as dependent even when their explicit resources differ.

Examples include:

```text
event-ordering
deferred-callback-order
chunk-residency
network-input-order
```

Happens-before graphs must be acyclic. A cycle is a model error, not an empty valid schedule space.

## Separation of authorities

Game Design owns explicit intended gameplay for the current map/mode.

Gameplay Contract is a scoped derived working projection used by audit/repair. It is never a second persisted Game Design authority.

The semantic graph owns references/dependencies.

Semantic IR owns normalized source execution/state/scheduling structure.

Gameplay Intent owns evidence-backed reconstruction of authored mechanics, actors, objectives, phases, lifecycles, resources, spatial semantics, policies, outcomes, and explicit unknowns. It does not declare root cause.

The Behavioral World Model owns explicit semantic state, transitions, nondeterminism declarations, and temporal properties.

Diagnostic Reasoning owns competing explanations and evidence discrimination.

Reliability Search owns bounded state/schedule exploration.

Runtime Lab owns controlled empirical experiments.

No layer may silently promote its own representation into another proof authority.

## Orchestration boundary

The orchestrator composes semantic owners; it must not duplicate parser, graph, diagnostics, archive, compatibility, or domain-analysis semantics.

Canonical direction:

```text
artifact / source representation
→ adapters + analyzers
→ semantic/project models
→ gameplay understanding / diagnosis
→ repair / validation owners
→ orchestrator composition
→ CLI / report-source projection
```

Low-level owners remain authoritative for their domain semantics. Orchestration owns sequencing, composition, continuation, and cross-owner coordination only.

## Integrated analysis rule

Cross-domain analysis is built by composing evidence from existing owners rather than creating another all-purpose analyzer.

Examples include:
- manifest + script dependency compatibility;
- selector/state scope + arena ownership;
- structure/world evidence + gameplay topology;
- entity/navigation + chunk/simulation readiness;
- inventory/economy + lifecycle ownership.

A cross-domain rule may correlate evidence, but it does not take ownership away from the contributing analyzers.

## Conservative inference

Topology, runtime behavior, cross-domain state, and platform capability must remain evidence-bounded. Repeated patterns, parser success, or nearby healthy code do not by themselves prove gameplay correctness.

## Normalized project model

The normalized project model is the boundary between physical files and semantic analysis:

```text
artifact graph
→ file inventory
→ normalized components
→ semantic dependency graph
```

These layers are separate authorities.

Extracted files remain source truth. Normalized components and semantic graphs are derived/rebuildable truth and must remain traceable through source references.

Component identity should be stable across workspace relocation and based on semantic scope + identifier rather than absolute paths.

The project-model package may organize internal contracts, evidence, runtime normalization, and session continuity into subgroups, but those groups do not become separate semantic authorities.
## Knowledge access architecture

Repository information is accessed through one composable path:

```text
Task / Question
→ Router
→ Catalog
→ Graph
→ Retrieval
→ Context
→ Reasoning / Audit / Development
```

Each stage has one responsibility:

- Router — selects the initial domain/canonical owner.
- Catalog — resolves stable resource identity and metadata.
- Graph — expands only typed relationships relevant to the concern.
- Retrieval — ranks the bounded candidate set.
- Context — compiles the minimum evidence package.

This path supplements source ownership; it does not replace it.

### Management flow

New or changed information follows:

```text
Discover
→ Classify
→ Register
→ Relate
→ Validate
→ Consume
→ Update
→ Retire
```

A change is production-complete only when the affected resource remains reachable through its Router/consumer and its relationships remain valid.

### Retrieval order

Use structural evidence before semantic similarity:

```text
Router scope
→ canonical owner
→ Catalog identity
→ Graph neighbors
→ source/ownership structure
→ lexical ranking
→ optional semantic ranking
→ authority filtering
→ Context
```

Lexical ranking is repository-native and requires no external provider. Semantic ranking is optional enrichment after routing, graph, and structural/lexical narrowing.

Pure vector similarity must not search the entire repository as an unbounded first step.

### Document section indexing

H2/H3 headings in canonical documents are exposed as DERIVED Catalog resources. They retain the parent path and use a heading locator.

```text
DOCUMENT parent
→ derived H2/H3 section
→ Retrieval candidate
```

This enables bounded loading of large owners without fragmenting them into many files.

### Generated projections

Generated indexes and graphs are DERIVED.

They must be:

- deterministic when inputs are unchanged;
- rebuildable from canonical sources;
- safe to delete and regenerate;
- excluded from manual semantic editing;
- validated against current source identities.

### No management-layer proliferation

Do not introduce parallel responsibilities named Knowledge Manager, RAG Manager, Memory Manager, Context Manager, Docs Manager, or Graph Manager when the responsibility already belongs to Catalog, Graph, Retrieval, Context, or an existing canonical package.

Prefer extending existing graph, analysis-planner, knowledge, project-model, and orchestrator owners rather than creating a parallel subsystem.