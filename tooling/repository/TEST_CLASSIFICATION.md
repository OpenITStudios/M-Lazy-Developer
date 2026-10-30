# Test inventory — classification and bounded consolidation

## Current snapshot (source review only)

Branch `Local`, based on immutable previous HEAD
`a2da18e707febc89e67ddd2d54fd2cdf3f27261a`.
The current consolidated inventory is **623 test files**,
down from **687**. There are
**27 source-preserving family consolidations**,
66 original paths removed cumulatively, and
2 family test files introduced in the earlier batch (none in the latest).

The cumulative reduction of 64 physical files **does not mean 57 test cases were eliminated**.
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

### Publisher skill index (topic references only)

| Developer skill | Related M-Lazy test files |
| --- | ---: |
| `bedrock-agent-team` | 2 |
| `bedrock-analytics` | 4 |
| `bedrock-camera` | 9 |
| `bedrock-content` | 41 |
| `bedrock-coordinates` | 27 |
| `bedrock-data-persistence` | 36 |
| `bedrock-debug-logging` | 69 |
| `bedrock-debug-profiling` | 67 |
| `bedrock-entity-creation` | 30 |
| `bedrock-entity-lifecycle` | 20 |
| `bedrock-forms` | 3 |
| `bedrock-game-results` | 0 |
| `bedrock-game-time` | 18 |
| `bedrock-git-workflow` | 9 |
| `bedrock-onscreen-display` | 2 |
| `bedrock-player-attached-particles` | 0 |
| `bedrock-project-setup` | 5 |
| `bedrock-release-export` | 5 |
| `bedrock-script-optimization` | 32 |
| `bedrock-sound` | 0 |
| `bedrock-teleport` | 1 |
| `bedrock-testing-policy` | 77 |
| `bedrock-text-glyphs` | 0 |
| `bedrock-version-targeting` | 13 |

Upstream `E7`, `E8`, `G3`, sound, glyph, results and particle
scenarios do not become tested M-Lazy features merely by a topical
name match.

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
