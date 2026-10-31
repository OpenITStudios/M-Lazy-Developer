# Test inventory — classification and bounded consolidation

## Active source audit — 2026-10-31: 385 physical test files

The canonical machine registry is `tooling/repository/test-inventory.json`.
The active source tree and inventory contain **385** physical test files.
The latest **389 -> 385** batch consolidates three runtime behavior families,
preserving **41** test registrations and **93** `expect()` callsites.
The prior **399 -> 389** batch consolidated seven families with **59**
test registrations and **148** `expect()` callsites. These source-only
counts do not establish fewer executed tests, faster runs, or executable
semantic/test isolation proof.

Historical provenance: earlier batches had 687 -> 402 source files and
a separately justified literal-only suite retirement to 401, followed
by 401 -> 399 safe consolidation. The 511 `it/test` and 1,706
`expect` callsites cited in that historical batch were static counts
for those source groups, not the number of tests executed now.

| Execution lane | Physical files |
| --- | ---: |
| `development` | 235 |
| `safety` | 46 |
| `runtime` | 46 |
| `regression` | 38 |
| `acceptance` | 20 |
| **Total** | **385** |

Inventory disposition: 289 provisional,
82 keep, 14 defer.
Review provenance: 284 case-inventory-reviewed
and 101 source-reviewed; feature mapping remains
`path-provisional` for 318 entries (67 source-case-inspected).
These provisional labels **cannot** justify deleting a unique test.

### Exact-source classification integrity — 2026-10-31

No physical test was removed in this review. Ten smaller source suites
were found to invoke unique production consumers and assert concrete
effects. Their classifications were upgraded from path-only labels after
reviewing the pinned source, not based only on filenames. Thirteen
previously classified `source-case-inspected` suites were also missing
a pinned source SHA; each was re-read and tied to its exact Git blob.
All **67 source-case-inspected entries now have an exact source SHA**.

The existing `tooling/repository/run-tests.mjs` inventory loader now
checks the byte identity (Git blob SHA-1, LF-normalized per repository
`.gitattributes`) of every source-case-inspected test. Missing or
stale fingerprints fail closed instead of silently inheriting a
high-confidence classification after a source edit. This is a
source-integrity gate, **not** a new runner, test lane, CI workflow,
or assertion that any test executed successfully.

The remaining **318 path-provisional** entries still need actual
consumer/fixture/positive-negative review. A small test, a deferred
test, a repeated assertion method name, or a fewer-files target
does not justify erasing a distinct production behavior test.

### Runtime family consolidation and source-case review — 2026-10-31

Three owner/feature/lane-local runtime test families were consolidated:
scheduler generation/cancellation/ordering, multiplayer concurrency/stress,
and chunk probes/readiness. This retires four physical source-file boundaries
while retaining all **41** original `it()/test()` registrations and **93**
`expect()` callsites in lexical scopes. Source SHA and original source
lineage, including previous chunk consolidations, are retained in the
canonical inventory. Important positive, negative, concurrency, timing,
and proof-gate cases were not intentionally removed.

Fifteen additional source-test files were inspected for actual
production-consumer invocation and deciding assertions. Their mapping basis
was advanced from `path-provisional` to `source-case-inspected` with pinned
Git blob and consumer symbol in the canonical inventory; this review
**does not** establish that any one file is a safe deletion candidate.
Separately, the existing fifteen `defer` suites were inspected and
found to call production consumers. `defer` indicates selective execution,
not obsolete tests; fourteen such suites remain after consolidation.

No changes were made to core/selected-map audit stages, feature gates,
proof-bound file paths, CI, or runtime implementations. Reduced physical
test-file count does **not** prove faster execution; merged files may
broaden `--affected` selection. TypeScript, Vitest, runtime isolation,
Minecraft gameplay and performance are **NOT EXECUTED**.

### Additional owner-local family consolidation — 2026-10-31

Seven focused source-file mergers reduce **399 -> 389** test files,
while preserving 59 test registrations and 148 assertion callsites.
Families are runtime observation framing/parsing, regression queue/report,
portfolio retest planning, structure and chunk evidence, command context
and transactions, historical QA planning, and regression batch execution.
Mergers retain the exact original file body within its own lexical block,
hoist only source-compatible imports, and record original blob SHAs plus
their merged SHA. Retired paths were not knowledge-detector or capability
proof bindings and were not in the default acceptance selection.

A previous multi-source `script-structure-correlation` consolidation
remains recorded under `priorConsolidationRecords` in the retained
structure proof suite. Seven retained source families have source-case-
inspected feature routing; the remaining provisional mappings must be
reviewed against their actual consumer rather than guessed from filenames.

**Proof ceiling:** source SHA, original body/callsite parity,
static import collision control and metadata integrity; TypeScript,
Vitest, runtime isolation, test timing, map audit and Minecraft
gameplay **NOT EXECUTED**. The target of around 100 file boundaries
is still conditional on semantic and negative-case equivalence.

### Current bounded consolidation and map-specific scenario routing

Two same-directory, same-owner, same-feature, same-lane `Development`
source suites were combined (401 -> **399** physical files). The retained
Script dataflow-context suite now includes Script API-update correlation;
the retained diagnostic-investigation suite includes diagnostic proof
disposition. Original source bodies, registrations and assertions remain in
distinct lexical scopes. The pinned paths, blob SHAs and new source SHAs are
registered in `test-inventory.json`. Neither retired path is a knowledge
or capability proof binding. The derived proof inventory fingerprint was
updated; `context.dataflow-slice` remains bound to the retained suite.
TypeScript, Vitest, isolation, performance and Minecraft are **NOT EXECUTED**.

Resolved `STORY_QUEST` and explicit map-type/mechanic scenario questions
use the existing classification and gameplay scenario owners. Universal
coverage, source-derived applicability and cross-system joins remain
mandatory when evidenced. No new runner, map-audit stage, checklist
authority or CI workflow was introduced.

### Separate source-grounded dead-suite retirement (2026-10-31)

After the 402-file consolidation snapshot, the Development suite
`engine/packages/orchestrator/test/inspection/version-aware-comparison.test.ts`
was retired: its **two** `it()` registrations and **five** `expect()` calls
only checked fields of literal objects constructed inside the tests.
It imported `VersionAwareEvidenceLink` as a **type only** and never invoked
`compareArtifactsForUpdate`, its comparison consumers, or any production
runtime behavior. The typed producer still constructs
`VersionAwareEvidenceLink[]` in production. This is a source-evidenced
removal of non-detecting runtime assertions, not a claim of end-to-end
test equivalence or runtime speedup. The standalone
`audit.change-comparison` feature catalog entry was retired with its
sole test; no knowledge/capability proof binding or default acceptance
selection referenced this file.

The consolidation registry's `sourceFilesAfter: 402` remains historical
provenance of the previous 21-group batch, not the active 401-file count.
No source production behavior, acceptance/risk lanes, map test obligations,
or CI policy changed. TypeScript, Vitest and Minecraft NOT EXECUTED.

### Physical reduction and preserved owner scope

The historical source inventory went **687 → 402** through consolidation, then
**402 → 401** by retiring one non-executing Development suite (net **286 fewer**). Cumulative lineage is 132 bounded consolidation
groups, 302 retired consolidation file paths, and 17 added paths; the separate
non-executing suite retirement removes one additional path. No source case
or assertion was deliberately deleted in the consolidation batch; only the
separately identified literal-only suite was subsequently removed. Earlier semantic
duplicate retirement remains separately recorded (four proven
duplicate `expect()` callsites); all other source cases are retained.

Current family consolidation covers Project Model telemetry/decisions,
topology, Orchestrator combat/entity/inventory/diagnosis/semantic IR,
selected-map source identity and gameplay closure, repair proof and
workflow decisions, Gameplay Intent, report findings, and Bug Tracker.
Each merged source records the original file path and pinned Git blob
SHA, the original registration and assertion counts, and the resulting
source blob SHA in the canonical inventory. Unsafe candidates involving
file-level hooks, import collisions or excessive coupling were skipped.

### Knowledge and capability proof paths

Existing knowledge-detector and capability-proof registries now reference
the new retained source paths for **65** knowledge and **3** capability
binding entries. The derived `engine/reliability/catalogs/capability-truth/current.json`
was reprojected against the exact source tree and proof registry; all
**55 task capabilities remain structurally bound**. A registered path
is *not* an execution result.

### Important test-count distinction

**401 files are not 401 executed tests.** The normal `npm test`
configuration still selects 10 Vitest suites plus one native Node
acceptance test; the full test suite remains separate. Merging physical
files does not reduce 511 source registrations or 1,706 assertion
callsites, does not demonstrate faster execution, and can expand
`--affected` dependency selection. No new runner or test lane was
added, and automatic CI remains disabled as requested.

**Evidence ceiling:** exact GitHub source/consumer review, lexical
source-body and callsite inclusion, current inventory/binding integrity.
TypeScript compiler, Vitest, `runSelectedMapAudit()`, selected-map
verification and live Minecraft gameplay **NOT EXECUTED**. The target
of around 100 source files is still a design objective, not grounds
for erasing distinct safety, regression, acceptance or negative cases.

### Three distinct meanings of "test"

1. **Repository source tests** are `*.test.*` files validating
   M-Lazy-Developer code. They are selected by changed source/ownership,
   existing lanes and source dependency, not by declaring a map PvP/PvE.
2. **Selected-map audit checks** are user-visible LOAD → UNDERSTAND →
   TEST → REPORT investigations derived from a particular immutable
   `.mcworld`. Canonical obligations are
   [Bug-Finding Coverage](../../docs/analysis/bug-finding-coverage.md)
   and [Mandatory Audit Procedure](../../docs/analysis/mandatory-audit-procedure.md).
   They are not the 402 source test files or upstream Skills Probe tests.
3. **External developer/Skills Probe evidence** is versioned
   reference material. The two newer supplied ZIPs match the inventory's
   v0.30.0 source-taxonomy archive SHA-256 digests
   `5e4608858cd824d9f5476a6d89242084db6b6d80ce61fa0b5e4b0c079669f0d8`
   and
   `89ec46832abb7fbb1215ec5e460275f18b4071ce5ca1d4c3cb3a7f052077f5d5`.
   The independently curated
   `skills/bedrock/source-lock.json` and
   `experiments/developer-practice-signals.json` still record
   developer v0.27.0 / Probe v0.23.0: **different
   reference snapshots, not permission to overwrite old report evidence,
   import unreviewed advice, or infer a selected-map PASS**.

### Mandatory versus applicable checks for each selected map

**Implemented source-selectivity correction (2026-10-31):**
`engine/packages/orchestrator/src/inspection/hidden-gameplay-defect-analysis.ts`
now derives the same three optional-scenario signals on initial inspection
and world refresh: actual dynamic-property evidence for persistence,
economy reward/debit evidence for transaction atomicity, and actor
counter or a scoped wave cue for entity-backed progression. Presence
of a zero-filled `persistence` summary, ordinary kit inventory
activity, or generic "round"/"objective"/"kill" wording no longer
automatically opens those optional scenario families. The baseline
journey, terminal ownership, observed cross-domain needs, and every
unresolved proof obligation are unchanged. A resolved map classification
may still **broaden** these scenarios, never suppress other source
evidence. This is an exact-source construction review only:
TypeScript/Vitest/Minecraft **NOT EXECUTED**. At the time of this source-selectivity correction the registered source-test
file count was **494**, before the subsequent seven suite consolidations.

The source artifact determines which gameplay surfaces exist. The
following is a *decision overlay* on the canonical coverage owner,
**not another stage, runner, registry, or checklist authority**.

| Scope | Applicability | Example coverage questions |
| --- | --- | --- |
| **Baseline audit integrity** | Every selected map | Archive and identity, edition/source support, authored gameplay goal, player-flow/surface accounting, source/evidence integrity, material access restrictions, causal/proof admission, final findings or explicit obligations |
| **Player/match lifecycle** | When player join/leave, start/end or session state matters | Join/ready/start, end-state, leaving, rejoin, replay, cleanup, information feedback; one valid happy path and relevant inverses |
| **Arena / multiplayer / team** | Only with evidenced arena, team, capacity or shared-state surface | Admission cap and cap+1, simultaneous joins, ownership isolation, per-arena scoreboard, reconnect and reset |
| **PvE / waves / entities** | Only with evidenced enemy/actor/wave contracts | Spawn versus counted actor, death/remove reconciliation, navigation and target, wave completion, cleanup |
| **PvP / combat / objectives** | Only with evidenced combat/objective contracts | Damage/kill scoring, class/team rules, respawn, win/lose and result ownership |
| **Building / plot / economy** | Only with evidenced block/inventory/transaction surface | Plot permissions, placement/breaking, inventory spend/grant/rollback, resource restoration, cross-player isolation |
| **Puzzle / parkour / quest** | Only with evidenced stage, checkpoint or scripted objective | Unreachable state/softlock, checkpoint restore, false completion, reset and final transition |
| **Persistence / world mutation / chunks** | When evidence identifies mutable state, save/restore, loaded area or spatial effects | Authoritative writer, restoration, safe bounds, chunk/simulation readiness, interrupted change |
| **Historical bug regression** | Only when current version still exposes the failure mechanism | One high-value positive + negative assertion, with historical evidence treated as prioritization rather than current defect proof |

Do not run an arena-stress or shop suite for a map lacking those
features, but a **NOT_APPLICABLE** disposition requires positive
selected-source evidence; simple absence of a scenario name is not
enough. Conversely, a meaningful state mutation, privilege boundary,
score/result or information-flow hazard must not be excluded just
because its inventory lane is not `safety`. Preserve every required
coverage surface, proof admission and unresolved obligation.
Grouping tests may reuse a setup but cannot silently erase distinct
deciding assertions or proof boundaries. The existing
`groupNeedValidationTests` and `planSelectiveValidation` owners
already support narrow per-finding proof and affected-closure
selection; do not create a third test scheduler.

### Target: approximately 100 high-value source suites

**100 is a user optimization goal, not an attained suite count or a
safe-delete quota.** At this snapshot there are 249 distinct
(owner, feature, lane) combinations; naive grouping to one file per
combination still leaves 249 files, and collapsing across owners or
safety/proof boundaries is not presumptively sound.

Before a candidate file/case is retired, establish **the same concrete
input/fixture, production consumer, decision/assertion, relevant
negative counterexample, trust/proof boundary, and coverage
binding/consumer dependency** in a retained case. Verify references
from knowledge-detector/capability proof bindings and acceptance
entrypoints. If any one is unique or uncertain, retain the test.
For true duplicates, prefer source-owner-local elimination or reuse
over creating a giant all-features suite. Avoid compensating
microtests, snapshot proliferation or CI enablement. Changed-source
`--affected` remains conservative for unknown/dynamic dependencies.

Track efficiency by **relevant checks selected, real time spent,
mutation/known-defect detection, missed defects, false positives,
maintenance and proof integrity** when such measurements genuinely
exist. A lower file count alone is not evidence of greater accuracy
or performance. No executable benchmark was run or requested here.

The remainder of this document is the archived provenance and
classification narrative at older consolidation phases. It must not
override the current machine inventory or the selected-map coverage
owners.

---

## Historical snapshot (phase five, 569 files; not current)

Working authority: GitHub `Local`; latest consolidation based on the pinned
parent `ccacc266ef2691b33da2a68821429d768b63784f`.
The canonical source test inventory is now **569 files**, down from **687**.
Across five bounded batches, **55 source-preserving family consolidations**
retired **120 obsolete paths** and created **2 retained family paths**
(net **118 fewer files**, not 118 deleted test cases).

The fifth batch combines **47 original Development files** into
**17 existing family suites**, retiring **30 old paths**. All
**173 `it()/test()`** and **362 `expect()`** source
call sites in those original files were retained with exact body
inclusion and source SHA lineage. Cumulatively the 55 merged suites
represent **173 original source-file inputs**, with **503**
`it()/test()` and **976** source assertion call sites
preserved by static counting.

**A smaller inventory is not fewer executed assertions**: source test
co-location can broaden `--affected` selection, alter module
initialization, or change test-file isolation. No actual TypeScript,
Vitest, map-audit or Minecraft runtime run or speedup is claimed.
Safety/acceptance/regression/runtime test files were not changed in
this fifth batch. Preserve source-specific failures and negative
controls rather than optimizing for a file count.

### Current classification

| Execution lane | Files | Intended role |
| --- | ---: | --- |
| `safety` | 48 | Trust boundaries, authorization and preservation |
| `acceptance` | 26 | Cross-component user-facing behavior |
| `runtime` | 74 | Harness, telemetry and environment-dependent contracts |
| `regression` | 54 | Historical, golden and failure-family checks |
| `development` | 367 | Component-level and evolving behavior checks |

| Review status | Files |
| --- | ---: |
| `case-inventory-reviewed` | 401 |
| `source-reviewed` | 168 |

| Retention recommendation | Files |
| --- | ---: |
| `keep-provisional` | 386 |
| `keep` | 153 |
| `defer` | 30 |
| `merge-candidate` | 0 |

All 569 registered paths have one owner, execution lane,
primary `functionalArea`, and one `featureId`. The canonical registry
remains `tooling/repository/test-inventory.json`. The area/feature
metadata is navigation only, not proof of gameplay or test uniqueness.

### Minecraft functional areas

| Area | Files | Meaning |
| --- | ---: | --- |
| `map-database` | 4 | LevelDB, NBT, world DB |
| `map-content` | 25 | World files, structure, topology and packs |
| `lobby-pre-match` | 0 | Lobby, team-selection and ready (no dedicated suite) |
| `player-session` | 6 | Join/leave/reconnect lifecycle |
| `arena-match` | 45 | Arena lifecycle, capacity and isolation |
| `player-state-persistence` | 9 | Player-state storage and recovery |
| `combat-entities` | 25 | Entity lifecycle, combat and AI/navigation |
| `inventory-economy` | 9 | Inventory, rewards and economy |
| `world-interaction` | 18 | Teleport, world mutation and chunks |
| `gameplay-scripting` | 27 | Script and command parsing/diagnostics |
| `gameplay-interpretation` | 55 | Authored intent and gameplay reconstruction |
| `audit-diagnosis` | 135 | Source investigation, causality, proof and reliability |
| `runtime-telemetry` | 83 | Runtime probes, host actions, telemetry contracts |
| `repair-preservation` | 54 | Authorized repair, invariant preservation |
| `reporting` | 47 | Bug Report V2, export and client UI |
| `platform-compatibility` | 3 | Bedrock/Education API/edition differences |
| `engineering-tooling` | 24 | Repository, project and workflow contracts |
| **Total** | **569** | 16 populated areas; lobby remains an explicit known gap |

### Consolidation lineage

| Retained suite | Original files → 1 | `it/test` sites | `expect` sites |
| --- | ---: | ---: | ---: |
| `engine/adapters/leveldb/test/inspect.test.ts` | 5 → 1 | 11 | 27 |
| `engine/adapters/mcstructure/test/mcstructure.test.ts` | 5 → 1 | 15 | 30 |
| `engine/analyzers/diagnostics/test/script/script-diagnostics.test.ts` | 8 → 1 | 26 | 29 |
| `engine/analyzers/manifest/test/analyze.test.ts` | 3 → 1 | 4 | 7 |
| `engine/analyzers/topology/test/arena-region.test.ts` | 5 → 1 | 10 | 21 |
| `engine/analyzers/topology/test/topology.test.ts` | 6 → 1 | 10 | 19 |
| `engine/packages/archive/test/inventory.test.ts` | 3 → 1 | 7 | 9 |
| `engine/packages/bug-report/test/client-document.test.ts` | 3 → 1 | 6 | 16 |
| `engine/packages/bug-report/test/project-confirmed-defect.test.ts` | 2 → 1 | 14 | 26 |
| `engine/packages/bug-report/test/v2.test.ts` | 2 → 1 | 7 | 19 |
| `engine/packages/reliability-search/test/history/history.test.ts` | 3 → 1 | 3 | 10 |
| `engine/packages/reliability-search/test/search/search.test.ts` | 6 → 1 | 20 | 41 |
| `engine/packages/repair/test/authorization.test.ts` | 5 → 1 | 10 | 13 |
| `engine/packages/runtime-lab/test/domains/chunk/chunk-probe-experiments.test.ts` | 4 → 1 | 7 | 15 |
| `engine/packages/orchestrator/test/inspection/combat-contract-analysis.test.ts` | 3 → 1 | 6 | 8 |
| `engine/packages/orchestrator/test/inspection/economy-contract-analysis.test.ts` | 3 → 1 | 8 | 17 |
| `engine/packages/orchestrator/test/inspection/spatial-authority-analysis.test.ts` | 3 → 1 | 8 | 10 |
| `engine/packages/orchestrator/test/inspection/route-navigation-environment-analysis.test.ts` | 2 → 1 | 5 | 8 |
| `engine/packages/orchestrator/test/inspection/inventory-contract-analysis.test.ts` | 2 → 1 | 6 | 9 |
| `engine/packages/orchestrator/test/inspection/inventory-lifecycle-analysis.test.ts` | 2 → 1 | 10 | 22 |
| `engine/packages/orchestrator/test/inspection/script-structure-correlation.test.ts` | 2 → 1 | 4 | 12 |
| `engine/packages/orchestrator/test/reporting/report-defect-classification.test.ts` | 2 → 1 | 9 | 17 |
| `engine/packages/orchestrator/test/diagnosis/diagnostic-probe-analysis.test.ts` | 3 → 1 | 11 | 24 |
| `engine/packages/orchestrator/test/reporting/report-confirmation-adapter.test.ts` | 3 → 1 | 11 | 12 |
| `engine/packages/orchestrator/test/inspection/world-db-diff.test.ts` | 2 → 1 | 3 | 7 |
| `engine/analyzers/entities/test/loot-table.test.ts` | 2 → 1 | 2 | 4 |
| `engine/packages/runtime-lab/test/scenario/scenario-execution-gate.test.ts` | 2 → 1 | 11 | 26 |
| `engine/packages/orchestrator/test/arena/arena-layout-reconciliation.test.ts` | 5 → 1 | 12 | 19 |
| `engine/packages/orchestrator/test/diagnosis/runtime-evidence-integrity.test.ts` | 5 → 1 | 19 | 32 |
| `engine/packages/runtime-lab/test/experiment/runner.test.ts` | 4 → 1 | 9 | 15 |
| `engine/packages/reliability/test/catalog/catalogs.test.ts` | 2 → 1 | 6 | 9 |
| `engine/packages/reliability/test/catalog/historical-regression-catalog.test.ts` | 2 → 1 | 7 | 13 |
| `engine/analyzers/scripts/test/flow/semantic-flow-witness.test.ts` | 3 → 1 | 4 | 6 |
| `engine/packages/orchestrator/test/release/release-identity-analysis.test.ts` | 3 → 1 | 6 | 16 |
| `engine/analyzers/entities/test/ai-stack.test.ts` | 3 → 1 | 5 | 8 |
| `engine/packages/reliability/test/runtime/runtime-observation.test.ts` | 3 → 1 | 7 | 15 |
| `engine/packages/orchestrator/test/arena/arena-golden-corpus.test.ts` | 3 → 1 | 7 | 12 |
| `engine/analyzers/entities/test/navigation.test.ts` | 2 → 1 | 4 | 11 |
| `engine/analyzers/commands/test/parse.test.ts` | 6 → 1 | 20 | 36 |
| `engine/packages/diagnostic-reasoning/test/diagnostic-reasoning.test.ts` | 5 → 1 | 23 | 42 |
| `engine/packages/analysis-planner/test/retrieval.test.ts` | 4 → 1 | 25 | 54 |
| `engine/packages/diagnostic-reasoning/test/gameplay-capability-delivery.test.ts` | 3 → 1 | 10 | 47 |
| `engine/packages/diagnostic-reasoning/test/reachability-capability-exposure.test.ts` | 3 → 1 | 13 | 31 |
| `engine/packages/diagnostic-reasoning/test/intent-gate.test.ts` | 3 → 1 | 13 | 16 |
| `engine/packages/logic-solver/test/solver.test.ts` | 3 → 1 | 12 | 24 |
| `engine/packages/orchestrator/test/inspection/client-feedback-analysis.test.ts` | 2 → 1 | 2 | 4 |
| `engine/analyzers/diagnostics/test/core/findings.test.ts` | 2 → 1 | 5 | 10 |
| `engine/packages/orchestrator/test/arena/arena-entity-population-proof.test.ts` | 2 → 1 | 4 | 7 |
| `engine/analyzers/scripts/test/domains/lifecycle/terminal-lifecycle-project.test.ts` | 2 → 1 | 3 | 6 |
| `engine/packages/orchestrator/test/inspection/entity-ai-stack-analysis.test.ts` | 2 → 1 | 4 | 8 |
| `engine/packages/orchestrator/test/inspection/entity-navigation-runtime-classification.test.ts` | 2 → 1 | 5 | 5 |
| `engine/packages/orchestrator/test/diagnosis/evidence-recovery.test.ts` | 2 → 1 | 5 | 13 |
| `engine/analyzers/scripts/test/recovery/source-recovery.test.ts` | 2 → 1 | 10 | 22 |
| `engine/packages/orchestrator/test/diagnosis/invariant-registry.test.ts` | 2 → 1 | 4 | 6 |
| `engine/analyzers/scripts/test/config/safe-config-compiler.test.ts` | 2 → 1 | 15 | 31 |
| **Total** | **173 → 55** | **503** | **976** |

The fifth bounded batch at pinned parent `ccacc266ef2691b33da2a68821429d768b63784f`
consolidates 47 source Development files into 17 existing suites,
retiring 30 obsolete paths. Cases and assertion bodies are source-retained;
no Safety, Acceptance, Runtime or Regression file was touched. The
original named imports were de-duplicated, and source bodies were
isolated in blocks to avoid top-level declaration collisions.
One Command analyzer import was normalized to its direct owning module
after verifying the original barrel re-export. No hoisted mocks or
per-file lifecycle hooks were found in the grouped source. **This is
static construction, not an executed TypeScript/Vitest proof.**
A co-located suite may execute more unrelated cases under `--affected`;
do not claim improved runtime without measuring the exact new HEAD.

The fourth bounded batch at parent `e8f4c5ad0451a1b847dd201baf55b7a6b1e335ac` combines 35
same-owner, same-feature, same-lane files into 11 retained suites
(24 retired paths), without deleting source test cases, safety/acceptance
tests or negative-control assertions. The selected families cover
arena layout and golden baselines; runtime evidence; experiment
lifecycle; catalog loading, writing and history; semantic dataflow;
release identity; entity behaviors/navigation; and session observations.
No file with declared hoisted mocks, per-file hooks or relative-path
isolation dependence was co-located. New merged suites have not
executed under exact TypeScript/Vitest.

The third batch at `a2da18e707febc89e67ddd2d54fd2cdf3f27261a` consolidates 12 source test files into five owner-local family suites (7 obsolete paths), retaining 38 it()/test() and 73 expect() call sites. No safety/acceptance/regression cases were removed, and one runtime family stays in the runtime lane.

The remaining eight Phase B merge candidates were inspected individually and **retained** because their assertions cover different source/consumer contracts. Presentation-only `engineering-analysis` and `engineering-review-invalidation` remain targeted/deferred; proof-gating, entity evidence, gameplay discovery, and API update checks remain separate. No executable case/assertion deduplication was claimed.

The second batch at `fc9e9cdf9ff4179a0a1bb8f7586464050a9dec99` consolidates 19 same-owner development source files into 8 retained suites (11 removed), preserving 56 case sites and 103 assertion sites; executable proof remains NOT EXECUTED.

Original file lists, source SHAs, and prior feature classifications
can be recovered from the `consolidation.sourceFiles` property
of each retained inventory row, as well as Git history at
`fd89e977970a5e1dbd631767df3a2e5d553f0aab` and second-batch parent
`fc9e9cdf9ff4179a0a1bb8f7586464050a9dec99`, and Phase B parent
`a2da18e707febc89e67ddd2d54fd2cdf3f27261a`.

No merge crossed source-owner or execution-lane boundaries.
In particular, `engine/analyzers/topology/test/regression-flow.test.ts`
remains a distinct **regression** test instead of being absorbed
into a **development**-lane topology file.
The 458 knowledge-to-proof declarations remain intact; the fifth batch redirects 13 knowledge and 2 capability proof-binding rows, and corrects one inherited stale `source.entities.economy` capability reference to the retained `loot-table.test.ts`. Neither proof declaration nor behavior test is removed. Phase B removed no referenced `proofPaths` (including the retained loot-table test); declaration count is not proof that assertions ran.

### Phase C — Semantic redundancy review (source-only)

Reference: `Local` commit `3f28fbfb3a22d4432a5a27b693d971b98a2c92c1`, 623 registered test files.
All **151 files** with primary functional area `audit-diagnosis` were read
for named cases, imported source consumers, assertion-call counts and
owner/lane routing. This is a **candidate screen**, not exhaustive
assertion-by-assertion equivalence proof or executed Vitest.

| Audit / Diagnosis lane | Files |
| --- | ---: |
| `development` | 90 |
| `regression` | 42 |
| `acceptance` | 17 |
| `safety` | 1 |
| `runtime` | 1 |
| **Total screened** | **151** |

**Decision:** zero test files, test cases or assertion calls were approved
for semantic deletion during Phase C. Shared topic, helper import, output
label or failure severity is insufficient to prove two cases redundant.
No case pair yet has demonstrated equivalence of **actual input, called
production consumer, expected assertions and negative-control/proof boundary**.
This is a conservative *no approved deletion* decision, not a claim that
every case is globally unique.

| Compared family | Why existing cases remain distinct |
| --- | --- |
| `invariant-mining` vs `invariant-mining-advanced` | Minimum support and historical counterproof differ from distinct-state, multi-source and Minecraft-version staleness checks, despite two shared production imports |
| `blindspot-tasks` vs `operator-effectiveness` | Survivor-to-task conversion differs from multi-campaign aggregation and search-budget policy, despite one shared production import |
| `causal-analysis`, `causal-incident-analysis`, `first-wrong-transition` | Dependency synthesis, incident grouping and first temporal violation have different consumers and required evidence |
| `map-audit-admission`, `map-audit-honesty`, `map-audit-proof-saturation` | Stage admission, residue integrity and family proof saturation protect different acceptance boundaries |

**Execution-cost distinction:** `tooling/repository/run-tests.mjs`
selects 10 Vitest suites and one native `node:test` file for the normal
`--acceptance` path. Exactly four of those Vitest files currently have
primary area `audit-diagnosis`. `--focus` and `--affected` provide bounded
selection; `--full` is explicitly comprehensive. The current 569-file inventory
is therefore **not** equivalent to 569 files executed on every normal
development run. The actual execution-time benefit of file consolidation
has **not been measured**.

**Next admissible deletion:** require pinned current and proposed case
bodies, exact producer/consumer comparison, same required negative
controls, and proof that deleting the candidate leaves no unique
behavior or source-to-knowledge proof uncovered. Preserve regression,
safety, acceptance and runtime boundaries and do not add a replacement
microtest, runner, registry or automatic CI. When the evidence is
insufficient, retain the case. The known lobby/team-selection and
logout→cleanup→rejoin coverage gaps remain separate questions.
TypeScript, Vitest, `runSelectedMapAudit()` and Minecraft were **NOT EXECUTED**.


### Phase D — Assertion-level anti-duplication screening (source-only)

Reference: pinned `Local` parent `e90ea7a52a782b6ca0677c1750dc60d773701881`, **599 source test files**.
The 103 largest test source files were inspected for literal `it/test`
declarations and repeated assertion call statements. This screening
identified about **1,536 syntactic test-declaration matches** and
**11 candidate groups of repeated assertion statements**. These are
static search counts, not an executed Vitest test census or proof of
semantic duplication across all 599 files.

- **One redundant assertion call was removed** from
  `engine/packages/orchestrator/test/map-audit-gameplay-acceptance.test.ts`:
  `gameplayFlowBasis` was checked twice against the same unchanged
  `result.mapAuditReport` field with only read-only observations in
  between. The earlier assertion and the test case remain intact.
- The remaining repeated statements protect **distinct transitions or
  inputs**, including before/after knowledge-catalog changes, differing
  source-provenance or generation states, Entity.kill vs Player.remove,
  runtime telemetry reset vs preserved evidence, incomplete vs foreign
  knowledge receipts, and multiple intentionally distinct negative
  inputs in loops. Equal expected values are **not** equivalent tests.
- No unique test case, safety gate, test owner, lane, or source-to-proof
  binding is deleted. File inventory remains **599**. Source-only
  verification does not prove same-head Vitest or Minecraft behavior.

**Next decision:** compare exact producer, fixture, assertion and
negative-control identity before further case deletion. Prefer removing
a demonstrably repeated check over adding catalog metadata or forcing
all source test cases under an arbitrary file count.

### Phase E — Owner-local Development consolidation (source-only)

The fifth source audit screened 17 families against the original
source paths, imported symbols, category owner and execution lane.
Each retained file has source-pinned `consolidation.sourceFiles`
lineage in the **single** test-inventory owner. The new 17 retained
suites preserve **173 test declarations** and **362
assertion call sites** (static counts, not executed PASS).

This batch does **not** certify that 17 large suites are necessarily
faster or that their 173 test cases are semantically unique. The
`--affected` runner may select more cases if several source modules
share one retained suite. No other runner, CI workflow or execution lane
was introduced. A future deletion still requires an exact same
fixture, consumer, expected result and negative-proof boundary.

### Upstream developers / Skills Probe

The prior reference crosswalk remains part of `featureCatalog`,
not an additional test manager:
- `minecraft-bedrock-agent-skills` ZIP v0.30.0: 24 skill documents and
  publisher-owned module vocabulary (13 local modules plus one external
  `database` module).
- `skills-probe` v0.30.0 skill lock: 14 indexed E/G examples and
  original test-report identities.
- The separate reviewed earlier version locks in
  `skills/bedrock/source-lock.json` were not silently replaced.
- **291** currently registered file paths have a topic-only upstream
  relationship; **278** paths are internal checker
  tests. Neither count establishes matching executable proof.

| Useful lookup | Feature | Boundary |
| --- | --- | --- |
| Database world | `database.leveldb` | LevelDB adapter (not equivalent to upstream database state-store) |
| Player join/leave | `player.join-spawn-leave` | Static lifecycle source extraction |
| Rejoin/reconnect | `player.reconnect-sessions` | Session model and experiment contracts, not actual client reconnect |
| Arena game end/reset | `arena.lifecycle` | Lifecycle and generation proof boundaries |
| Multi-arena isolation | `arena.state-isolation` | Same arena-scoped ownership and scoreboard/source evidence |
| Teleport | `world.teleport` | Source-level transaction interpretation |
| Form and player interaction | `world.player-interaction` | Not equivalent to end-to-end lobby |
| Bug Report V2 | `report.schema` | Internal checker/export schema, not Daigon GAME_RESULTS |

Do not confuse M-Lazy's actual world LevelDB/NBT reader with the
publisher's state-persistence `database` module, or Bug Report V2
with external `bedrock-game-results`.

### ZIP-aligned test grouping — source taxonomy, NOT new test lanes

The inventory's existing `functionalArea`, `featureId`, `lane`, and
`featureCatalog[featureId].upstream` relationships form one **read-only
grouping projection**. They do not change physical test directories,
production ownership or test execution. Native examples below are derived
from the exact two user-provided v0.30.0 ZIPs; **no upstream source was
installed or executed**.

```text
569 physical M-Lazy source test files
  → one primary M-Lazy functional area and feature, with an execution lane
  → native Developer Skill topic(s) / module(s), when relevant
  → independent Skills Probe E/G example(s) and P-ID(s), when relevant
  → otherwise M-Lazy internal-only checker capability
  → existing --focus / --affected / --lane / --acceptance / --full routes
```

**Scope:** 291 distinct files have publisher **topic-only**
relationships; 278 are explicitly `LAZY_INTERNAL_ONLY`.
Across the 24 Developer Skills, there are 426 **nonexclusive**
skill memberships, not 426 distinct tests (membership may overlap). Each file is counted
once within its primary M-Lazy area/lane, but it may appear in multiple
publisher reference lookups. A zero-match skill, module or example is
**unmapped topical context**, not proof that the checker lacks functionality.

#### Developer Skills (source ZIP skills.json v0.30.0)

| Developer skill | Related source files | Native module(s) | Probe example(s) |
| --- | ---: | --- | --- |
| `bedrock-agent-team` | 2 | — | — |
| `bedrock-analytics` | 4 | `analytics` | — |
| `bedrock-camera` | 8 | — | — |
| `bedrock-content` | 33 | — | `G1` |
| `bedrock-coordinates` | 23 | `coords` | — |
| `bedrock-data-persistence` | 35 | `database`, `items` | — |
| `bedrock-debug-logging` | 63 | `logging` | — |
| `bedrock-debug-profiling` | 61 | `profiling` | `E4` |
| `bedrock-entity-creation` | 24 | `entities` | `E3` |
| `bedrock-entity-lifecycle` | 17 | `entities` | `E2` |
| `bedrock-forms` | 3 | `forms` | `E5`, `G2` |
| `bedrock-game-results` | 0 | `game-results` | `E7` |
| `bedrock-game-time` | 17 | `time` | `G5` |
| `bedrock-git-workflow` | 9 | — | — |
| `bedrock-onscreen-display` | 1 | `display` | `E6` |
| `bedrock-player-attached-particles` | 0 | — | — |
| `bedrock-project-setup` | 5 | — | — |
| `bedrock-release-export` | 3 | — | `E9` |
| `bedrock-script-optimization` | 32 | `testing` | `E1` |
| `bedrock-sound` | 0 | `sound` | `G3` |
| `bedrock-teleport` | 1 | `teleport` | `G4` |
| `bedrock-testing-policy` | 72 | — | — |
| `bedrock-text-glyphs` | 0 | — | `E8` |
| `bedrock-version-targeting` | 13 | — | — |

#### Developer modules (source ZIP module.json / modules/README.md)

The module names are **publisher names**, not M-Lazy package identities.
In particular, upstream `database` is a separately owned state store,
not equivalent to M-Lazy's world LevelDB/NBT parser.

| Native module | Related source files | Developer Skill owner(s) | Native `requires` dependencies |
| --- | ---: | --- | --- |
| `analytics` | 4 | `bedrock-analytics` | `database`, `logging`, `time` |
| `coords` | 23 | `bedrock-coordinates` | — |
| `database` | 32 | `bedrock-data-persistence` | — (external source) |
| `display` | 1 | `bedrock-onscreen-display` | `logging` |
| `entities` | 29 | `bedrock-entity-lifecycle`, `bedrock-entity-creation` | `logging` |
| `forms` | 3 | `bedrock-forms` | `logging` |
| `game-results` | 0 | `bedrock-game-results` | — |
| `items` | 9 | `bedrock-data-persistence` | `logging` |
| `logging` | 63 | `bedrock-debug-logging` | — |
| `profiling` | 61 | `bedrock-debug-profiling` | — |
| `sound` | 0 | `bedrock-sound` | `logging` |
| `teleport` | 1 | `bedrock-teleport` | `logging`, `forms` |
| `testing` | 32 | `bedrock-script-optimization` | — |
| `time` | 17 | `bedrock-game-time` | `logging`, `database` |

#### Named external reference topics (not M-Lazy test IDs)

The original publisher uses codes such as `E7`, `G5`, `P53`, and
`P53END` as **source identifiers**. They are not gameplay feature names,
M-Lazy test identities, or execution receipts. M-Lazy navigation displays
descriptive labels first; the original source IDs are retained only to
trace independently pinned references without breaking historical links.

| Descriptive topic | External source focus | M-Lazy topic-related files | Upstream status / Node / engine | Original source ID (technical) |
| --- | --- | ---: | --- | --- |
| **Arena State & Performance** | Two-arena state, persistence, transitions, and bounded caches | 19 | pending / PASS / pending | `E1` |
| **Player Lifecycle & Cleanup** | Player-keyed state cleanup and spawn invalidation | 5 | pending / PASS / pending | `E2` |
| **Entity Model Placement** | Model offsets and placement across uneven surfaces | 4 | PASS / PASS / pending | `E3` |
| **Diagnostics & Profiling** | Diagnostic capture, profiling, and evidence procedures | 61 | pending / PASS / pending | `E4` |
| **Player Forms & Fallback** | Styled player forms with plain fallback | 2 | pending / PASS / pending | `E5` |
| **On-Screen Text & Localization** | Localized title-channel cards and item labels | 1 | pending / PASS / pending | `E6` |
| **Game Results & Export** | Game-results adapter and historical size-stress export | 0 | PASS / PASS / PASS | `E7` |
| **Text Glyphs & Display Sizing** | Glyph audit and display-size comparison | 0 | pending / PASS / pending | `E8` |
| **Project Naming** | Project name and slug naming conventions | 1 | PASS / not reported / not reported | `E9` |
| **Custom Blocks & Items** | Version-2 custom blocks and items | 4 | pending / PASS / pending | `G1` |
| **Confirmation & Paginated Menus** | Confirmation and paginated choice forms | 2 | pending / PASS / pending | `G2` |
| **Player Sound & Captions** | Per-player sound previews and captions | 0 | pending / PASS / pending | `G3` |
| **Teleport & Interrupted Travel** | Teleport fades and interrupted portal travel | 1 | pending / PASS / pending | `G4` |
| **Game Timer & Countdown** | Persistent per-player countdown | 14 | pending / PASS / pending | `G5` |

**Evidence boundary:** the source index has 3 overall `PASS` and
11 `pending` examples, scoped to the upstream revision and target.
These historical source statuses do **not** mean that M-Lazy or a selected
Minecraft world was tested. In particular, **Entity Model Placement**
has upstream engine checks pending, **Game Results & Export** has a
bounded upstream result with no directly mapped M-Lazy test file,
and **Project Naming** has only a naming-level upstream PASS.
Zero mapped files means no exact **topic reference mapping**, not that
the Minecraft feature is unsupported or has failed.

For technical provenance, the source index contains **52 distinct P-IDs**;
the M-Lazy feature catalog contains **36 topic P-ID tags**;
**13** IDs overlap, giving a **75-ID union**.
No child subcase is automatically mapped to all parent-topic tests.
The original ID lists and status triplets remain in the canonical
`test-inventory.json` `upstreamCategoryCrosswalk.probe.exampleDetails`.
Only that metadata is the source-identity authority. The human-readable
labels are presentation aliases, not a new runner, new test group,
or proof of gameplay coverage.

#### M-Lazy internal-only capabilities (no publisher equivalent)

| Primary functional area | M-Lazy-only test files |
| --- | ---: |
| `map-database` | 4 |
| `map-content` | 5 |
| `player-session` | 1 |
| `arena-match` | 14 |
| `gameplay-scripting` | 12 |
| `gameplay-interpretation` | 51 |
| `audit-diagnosis` | 88 |
| `repair-preservation` | 54 |
| `reporting` | 47 |
| `engineering-tooling` | 2 |
| **Total** | **278** |

`report.schema` (Bug Report V2), `database.leveldb` and selected-map
proof/admission checks remain under their **internal canonical owners**.
Do not mistake Daigon `bedrock-game-results` or publisher
`bedrock-data-persistence` for equivalent engine features.

#### Read-only navigation using descriptive names

```text
node tooling/repository/run-tests.mjs --list-test-groups
node tooling/repository/run-tests.mjs --show-test-group topic/player-lifecycle-cleanup
node tooling/repository/run-tests.mjs --show-test-group topic/entity-model-placement
node tooling/repository/run-tests.mjs --show-test-group topic/game-results-export
node tooling/repository/run-tests.mjs --show-test-group topic/player-sound-captions
node tooling/repository/run-tests.mjs --show-test-group topic/game-timer-countdown
node tooling/repository/run-tests.mjs --show-test-group internal/audit-diagnosis
```

`--list-test-groups` displays **names** and topical match counts by default.
The individual topic selectors above retrieve the same inventory files
without executing tests. To inspect native publisher source identity when
needed, the existing advanced `example/E2`, `probe/P53END`,
`skill/bedrock-entity-lifecycle`, and `module/teleport` selectors
remain compatible; they are not recommended user-facing names.
Execution selection (`--focus`, `--affected`, `--lane`,
`--acceptance`, `--full`) and CI policy remain unchanged.

**Source version boundaries:** the v0.30.0 ZIP-derived test crosswalk
in this inventory is independent of the earlier reviewed
`skills/bedrock/source-lock.json` and
`experiments/developer-practice-signals.json` reference snapshots.
No historic v0.23.0/v0.27.0 source lock or Probe report was silently
upgraded. A future source refresh must reconcile its own exact locks
and scoped evidence under the existing owner.


### Source-only navigation without test execution

```text
node tooling/repository/run-tests.mjs --list-lanes
node tooling/repository/run-tests.mjs --list-areas
node tooling/repository/run-tests.mjs --show-area player-session
node tooling/repository/run-tests.mjs --list-features
node tooling/repository/run-tests.mjs --show-feature database.leveldb
node tooling/repository/run-tests.mjs --list-mechanics
node tooling/repository/run-tests.mjs --show-mechanic lobby.join-pad
node tooling/repository/run-tests.mjs --list-upstream-skills
node tooling/repository/run-tests.mjs --show-upstream-skill bedrock-data-persistence
node tooling/repository/run-tests.mjs --show-upstream-module database
node tooling/repository/run-tests.mjs --list-probe-examples
node tooling/repository/run-tests.mjs --show-probe-example teleport-interrupted-travel
```

These commands read the registered paths and do not start Vitest.
The existing `--acceptance`, `--focus`, `--lane`,
`--affected`, and `--full` modes retain their original behavior.
Automatic CI remains disabled.

### Proof limits and next source review

The current consolidation reduces test **file fragmentation**
without knowingly reducing behavior or assertions. It does not certify
that the suites are fully equivalent under Vitest or Minecraft, and
does not prove that 569 files or any arbitrary file target is an optimal number.
No executed speedup is claimed; this fifth batch did not reduce test-case count.
Further reduction requires examining assertion duplication,
dependencies, and actual test-file isolation; **do not blindly combine
all tests that happen to share a category**.

The previously identified absence of a dedicated lobby/team-selection
end-to-end test and full logout→cleanup→rejoin scenario remains a
coverage question, not an invitation to add microtests during BUILD.
GitHub repository source and registries were reviewed statically;
TypeScript, Vitest, `runSelectedMapAudit()`, external Skills Probe
execution, and live Minecraft were **NOT EXECUTED**.
