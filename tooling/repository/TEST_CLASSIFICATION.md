# Test inventory — classification and bounded consolidation

## Current snapshot (source review only)

Branch `Local`, based on immutable previous HEAD
`a2da18e707febc89e67ddd2d54fd2cdf3f27261a`.
The current consolidated inventory is **623 test files**,
down from **687**. There are
**27 source-preserving family consolidations**,
66 original paths removed cumulatively, and
2 family test files introduced in the earlier batch (none in the latest).

The cumulative reduction of 64 physical files **does not represent deletion of test cases**.
The merged sources preserve the original `describe/it` bodies, with
**244 it()/test() call sites** and **458 expect() call sites**
across the 91 source files represented by the 27
merged suites. Those are *static source counts*, not a Vitest PASS.
Before executing the exact merged code, changes in test-file isolation,
shared module initialization, or runner scheduling remain **NOT VERIFIED**.

Each merged inventory row has a `consolidation` source lineage
with prior path/blob SHA, the preserved call-site counts and the
new Git blob SHA. Git history retains the original paths and sources.

### Current classification

| Execution lane | Files | Intended role |
| --- | ---: | --- |
| `safety` | 48 | Trust boundaries, authorization and preservation |
| `acceptance` | 26 | Cross-component user-facing behavior |
| `runtime` | 77 | Harness, telemetry and environment-dependent contracts |
| `regression` | 60 | Historical, golden and failure-family checks |
| `development` | 412 | Component-level and evolving behavior checks |

| Review status | Files |
| --- | ---: |
| `case-inventory-reviewed` | 432 |
| `source-reviewed` | 191 |

| Retention recommendation | Files |
| --- | ---: |
| `keep-provisional` | 415 |
| `keep` | 174 |
| `defer` | 34 |
| `merge-candidate` | 0 |

All 623 registered paths have one owner, execution lane,
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
| `arena-match` | 53 | Arena lifecycle, capacity and isolation |
| `player-state-persistence` | 9 | Player-state storage and recovery |
| `combat-entities` | 30 | Entity lifecycle, combat and AI/navigation |
| `inventory-economy` | 9 | Inventory, rewards and economy |
| `world-interaction` | 19 | Teleport, world mutation and chunks |
| `gameplay-scripting` | 36 | Script and command parsing/diagnostics |
| `gameplay-interpretation` | 59 | Authored intent and gameplay reconstruction |
| `audit-diagnosis` | 151 | Source investigation, causality, proof and reliability |
| `runtime-telemetry` | 92 | Runtime probes, host actions, telemetry contracts |
| `repair-preservation` | 54 | Authorized repair, invariant preservation |
| `reporting` | 47 | Bug Report V2, export and client UI |
| `platform-compatibility` | 3 | Bedrock/Education API/edition differences |
| `engineering-tooling` | 26 | Repository, project and workflow contracts |
| **Total** | **623** | 16 populated areas; lobby remains an explicit known gap |

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
| **Total** | **91 → 27** | **244** | **458** |

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
The 458 knowledge-to-proof declarations remain intact after earlier proof-path redirects. Phase B removed no referenced `proofPaths` (including the retained loot-table test); declaration count is not proof that assertions ran.

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
selection; `--full` is explicitly comprehensive. The 623-file inventory
is therefore **not** equivalent to 623 files executed on every normal
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
- **321** currently registered file paths have a topic-only upstream
  relationship; **302** paths are internal checker
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
623 physical M-Lazy source test files
  → one primary M-Lazy functional area and feature, with an execution lane
  → native Developer Skill topic(s) / module(s), when relevant
  → independent Skills Probe E/G example(s) and P-ID(s), when relevant
  → otherwise M-Lazy internal-only checker capability
  → existing --focus / --affected / --lane / --acceptance / --full routes
```

**Scope:** 321 distinct files have publisher **topic-only**
relationships; 302 are explicitly `LAZY_INTERNAL_ONLY`.
Across the 24 Developer Skills, there are 470 **nonexclusive**
skill memberships, not 470 distinct tests. Each file is counted
once within its primary M-Lazy area/lane, but it may appear in multiple
publisher reference lookups. A zero-match skill, module or example is
**unmapped topical context**, not proof that the checker lacks functionality.

#### Developer Skills (source ZIP skills.json v0.30.0)

| Developer skill | Related source files | Native module(s) | Probe example(s) |
| --- | ---: | --- | --- |
| `bedrock-agent-team` | 2 | — | — |
| `bedrock-analytics` | 4 | `analytics` | — |
| `bedrock-camera` | 9 | — | — |
| `bedrock-content` | 41 | — | `G1` |
| `bedrock-coordinates` | 27 | `coords` | — |
| `bedrock-data-persistence` | 36 | `database`, `items` | — |
| `bedrock-debug-logging` | 69 | `logging` | — |
| `bedrock-debug-profiling` | 67 | `profiling` | `E4` |
| `bedrock-entity-creation` | 30 | `entities` | `E3` |
| `bedrock-entity-lifecycle` | 20 | `entities` | `E2` |
| `bedrock-forms` | 3 | `forms` | `E5`, `G2` |
| `bedrock-game-results` | 0 | `game-results` | `E7` |
| `bedrock-game-time` | 18 | `time` | `G5` |
| `bedrock-git-workflow` | 9 | — | — |
| `bedrock-onscreen-display` | 2 | `display` | `E6` |
| `bedrock-player-attached-particles` | 0 | — | — |
| `bedrock-project-setup` | 5 | — | — |
| `bedrock-release-export` | 5 | — | `E9` |
| `bedrock-script-optimization` | 32 | `testing` | `E1` |
| `bedrock-sound` | 0 | `sound` | `G3` |
| `bedrock-teleport` | 1 | `teleport` | `G4` |
| `bedrock-testing-policy` | 77 | — | — |
| `bedrock-text-glyphs` | 0 | — | `E8` |
| `bedrock-version-targeting` | 13 | — | — |

#### Developer modules (source ZIP module.json / modules/README.md)

The module names are **publisher names**, not M-Lazy package identities.
In particular, upstream `database` is a separately owned state store,
not equivalent to M-Lazy's world LevelDB/NBT parser.

| Native module | Related source files | Developer Skill owner(s) | Native `requires` dependencies |
| --- | ---: | --- | --- |
| `analytics` | 4 | `bedrock-analytics` | `database`, `logging`, `time` |
| `coords` | 27 | `bedrock-coordinates` | — |
| `database` | 33 | `bedrock-data-persistence` | — (external source) |
| `display` | 2 | `bedrock-onscreen-display` | `logging` |
| `entities` | 35 | `bedrock-entity-lifecycle`, `bedrock-entity-creation` | `logging` |
| `forms` | 3 | `bedrock-forms` | `logging` |
| `game-results` | 0 | `bedrock-game-results` | — |
| `items` | 9 | `bedrock-data-persistence` | `logging` |
| `logging` | 69 | `bedrock-debug-logging` | — |
| `profiling` | 67 | `bedrock-debug-profiling` | — |
| `sound` | 0 | `bedrock-sound` | `logging` |
| `teleport` | 1 | `bedrock-teleport` | `logging`, `forms` |
| `testing` | 32 | `bedrock-script-optimization` | — |
| `time` | 18 | `bedrock-game-time` | `logging`, `database` |

#### Skills Probe E/G examples (independent ZIP docs/examples/index.json)

Each row identifies an **analogy for investigation**, not an executed
M-Lazy test, a matching fixture, a runtime result, or a release gate.
Source index SHA-256:
`5b187d61b1ab634ac83d1304dc31f02f533e74d5f14027b166f2fd86a7ed1630`.
The upstream index separately reports `status`, `nodeStatus` and
`engineStatus`; these are **not projected as M-Lazy PASS/FAIL**.
The E/G index reports **3 overall PASS** and **11 pending**
source example rows, at their **original upstream revision and target**.
A row's overall status is not a verdict for its whole family or
for any M-Lazy test. For example, E3's new engine checks are pending;
E9's PASS is a naming-only result, and E7's source PASS concerns
its scoped game-results example.

| E/G | Developer Skill | Actual ZIP source pattern | Upstream `status` / `nodeStatus` / `engineStatus` | Upstream P-IDs | M-Lazy topic-related files |
| --- | --- | --- | --- | --- | ---: |
| `E1` | `bedrock-script-optimization` | Two-arena state, persistence, transitions and bounded apply caches | `pending` / `PASS` / `pending` | `P52` | 19 |
| `E2` | `bedrock-entity-lifecycle` | Player-keyed state cleanup and spawn invalidation | `pending` / `PASS` / `pending` | `P53`, `P53END` | 6 |
| `E3` | `bedrock-entity-creation` | Negative-model offset (E3) and placement reconciliation on unequal surfaces (E3b) | `PASS` / `PASS` / `pending` | `P38`, `P54`, `P54R`, `P54END` | 8 |
| `E4` | `bedrock-debug-profiling` | Diagnostics capture and agent evidence procedure | `pending` / `PASS` / `pending` | `P41`, `P46`, `P50` | 67 |
| `E5` | `bedrock-forms` | Stable skinned ActionForm and ModalForm with plain fallback | `pending` / `PASS` / `pending` | `P55`, `P05` | 2 |
| `E6` | `bedrock-onscreen-display` | Localized title-channel quest card and item label | `pending` / `PASS` / `pending` | `P56`, `P56S`, `P56P`, `P56C`, `P56I`, `P56L`, `P56X` | 2 |
| `E7` | `bedrock-game-results` | Small game-results adapter and historical size stress export | `PASS` / `PASS` / `PASS` | `P51`, `P35` The E/G index in the exact source ZIP contains **52 unique upstream P-IDs**,
including qualified IDs such as `P53END`, `P54R` and `P57A0`.
The existing M-Lazy `featureCatalog[featureId].upstream.probeIds`
contains **36 distinct TOPIC tags**; only **13** names overlap.
Thus **39** E/G source P-IDs have no file-level topical tag, while
**23** M-Lazy topic tags come from other Probe references
outside the E/G example index. The union contains **75 P-IDs**.
Neither set is a test-case coverage census. Do not copy upstream
PASS/PENDING into M-Lazy status, and do not automatically map a child
subcase to every file related to its parent E/G example.

For clarity: E3 has a narrow upstream example `PASS` but its newer
`engineStatus` is still `pending`; E7 reports a source-index engine
`PASS` for a bounded game-results example with **zero** mapped
M-Lazy topic files; E9 is a naming-only `PASS` with no separate Node
or engine verdict. `G3/P60` (sound) and many `E8/P57*` (glyphs)
have **zero** M-Lazy topic matches, which alone does not establish
missing implementation or failed testing.

#### M-Lazy internal-only capabilities (no publisher equivalent)

| Primary functional area | M-Lazy-only test files |
| --- | ---: |
| `map-database` | 4 |
| `map-content` | 5 |
| `player-session` | 1 |
| `arena-match` | 16 |
| `gameplay-scripting` | 16 |
| `gameplay-interpretation` | 55 |
| `audit-diagnosis` | 102 |
| `repair-preservation` | 54 |
| `reporting` | 47 |
| `engineering-tooling` | 2 |
| **Total** | **302** |

`report.schema` (Bug Report V2), `database.leveldb` and selected-map
proof/admission checks remain under their **internal canonical owners**.
Do not mistake Daigon `bedrock-game-results` or publisher
`bedrock-data-persistence` for equivalent engine features.

#### Read-only group navigation in the existing test runner

```text
node tooling/repository/run-tests.mjs --list-test-groups
node tooling/repository/run-tests.mjs --show-test-group skill/bedrock-entity-lifecycle
node tooling/repository/run-tests.mjs --show-test-group module/database
node tooling/repository/run-tests.mjs --show-test-group module/teleport
node tooling/repository/run-tests.mjs --show-test-group example/E2
node tooling/repository/run-tests.mjs --show-test-group probe/P53
node tooling/repository/run-tests.mjs --show-test-group probe/P53END
node tooling/repository/run-tests.mjs --show-test-group probe/P54R
node tooling/repository/run-tests.mjs --show-test-group probe/P60
node tooling/repository/run-tests.mjs --show-test-group internal/audit-diagnosis
```

The `--list-test-groups` and `--show-test-group` operations navigate
**the same 623 registered paths** in area → feature → execution-lane → file
order. Their parent-group view now also exposes the source-pinned
`requires` edges, example status triplets and the **75-ID union** with
explicit zero mappings. They do not invoke Vitest, Minecraft, skills,
or the upstream Probe, and cannot promote a topical reference or historical
UPSTREAM result to executed M-Lazy proof. Existing execution-selection
commands and CI policy remain unchanged.

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
node tooling/repository/run-tests.mjs --show-probe-example G4
```

These commands read the registered paths and do not start Vitest.
The existing `--acceptance`, `--focus`, `--lane`,
`--affected`, and `--full` modes retain their original behavior.
Automatic CI remains disabled.

### Proof limits and next source review

The current consolidation reduces test **file fragmentation**
without knowingly reducing behavior or assertions. It does not certify
that the suites are fully equivalent under Vitest or Minecraft, and
does not prove that 623 test files is an optimal number.
Further reduction requires examining assertion duplication,
dependencies, and actual test-file isolation; **do not blindly combine
all tests that happen to share a category**.

The previously identified absence of a dedicated lobby/team-selection
end-to-end test and full logout→cleanup→rejoin scenario remains a
coverage question, not an invitation to add microtests during BUILD.
GitHub repository source and registries were reviewed statically;
TypeScript, Vitest, `runSelectedMapAudit()`, external Skills Probe
execution, and live Minecraft were **NOT EXECUTED**.
