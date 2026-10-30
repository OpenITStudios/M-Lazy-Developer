# Test inventory — classification and bounded consolidation

## Current snapshot (source review only)

Branch `Local`, based on immutable previous HEAD
`fd89e977970a5e1dbd631767df3a2e5d553f0aab`.
The current consolidated inventory is **641 test files**,
down from **687**. There are
**14 source-preserving family consolidations**,
48 original paths removed, and
2 family test files introduced.

The change **does not mean 46 test cases were eliminated**.
The merged sources preserve the original `describe/it` bodies, with
**150 it()/test() call sites** and **282 expect() call sites**
across the 60 original files represented by the 14
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
| `runtime` | 78 | Harness, telemetry and environment-dependent contracts |
| `regression` | 60 | Historical, golden and failure-family checks |
| `development` | 429 | Component-level and evolving behavior checks |

| Review status | Files |
| --- | ---: |
| `case-inventory-reviewed` | 432 |
| `source-reviewed` | 209 |

| Retention recommendation | Files |
| --- | ---: |
| `keep-provisional` | 409 |
| `keep` | 187 |
| `defer` | 32 |
| `merge-candidate` | 13 |

All 641 registered paths have one owner, execution lane,
primary `functionalArea`, and one `featureId`. The canonical registry
remains `tooling/repository/test-inventory.json`. The area/feature
metadata is navigation only, not proof of gameplay or test uniqueness.

### Minecraft functional areas

| Area | Files | Meaning |
| --- | ---: | --- |
| `map-database` | 5 | LevelDB, NBT, world DB |
| `map-content` | 26 | World files, structure, topology and packs |
| `lobby-pre-match` | 0 | Lobby, team-selection and ready (no dedicated suite) |
| `player-session` | 6 | Join/leave/reconnect lifecycle |
| `arena-match` | 53 | Arena lifecycle, capacity and isolation |
| `player-state-persistence` | 9 | Player-state storage and recovery |
| `combat-entities` | 34 | Entity lifecycle, combat and AI/navigation |
| `inventory-economy` | 13 | Inventory, rewards and economy |
| `world-interaction` | 21 | Teleport, world mutation and chunks |
| `gameplay-scripting` | 36 | Script and command parsing/diagnostics |
| `gameplay-interpretation` | 59 | Authored intent and gameplay reconstruction |
| `audit-diagnosis` | 151 | Source investigation, causality, proof and reliability |
| `runtime-telemetry` | 95 | Runtime probes, host actions, telemetry contracts |
| `repair-preservation` | 54 | Authorized repair, invariant preservation |
| `reporting` | 50 | Bug Report V2, export and client UI |
| `platform-compatibility` | 3 | Bedrock/Education API/edition differences |
| `engineering-tooling` | 26 | Repository, project and workflow contracts |
| **Total** | **641** | 16 populated areas; lobby remains an explicit known gap |

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
| **Total** | **60 → 14** | **150** | **282** |

Original file lists, source SHAs, and prior feature classifications
can be recovered from the `consolidation.sourceFiles` property
of each retained inventory row, as well as Git history at
`fd89e977970a5e1dbd631767df3a2e5d553f0aab`.

No merge crossed source-owner or execution-lane boundaries.
In particular, `engine/analyzers/topology/test/regression-flow.test.ts`
remains a distinct **regression** test instead of being absorbed
into a **development**-lane topology file.
The 458 knowledge-to-proof declarations remain intact after
redirecting their old test paths to the retained suites; binding
declaration count is not proof that the original assertions ran.

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
- **335** currently registered file paths have a topic-only upstream
  relationship; **306** paths are internal checker
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
| `bedrock-content` | 45 |
| `bedrock-coordinates` | 29 |
| `bedrock-data-persistence` | 40 |
| `bedrock-debug-logging` | 71 |
| `bedrock-debug-profiling` | 69 |
| `bedrock-entity-creation` | 34 |
| `bedrock-entity-lifecycle` | 23 |
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
| `bedrock-testing-policy` | 78 |
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
does not prove that 641 test files is an optimal number.
Further reduction requires examining assertion duplication,
dependencies, and actual test-file isolation; **do not blindly combine
all tests that happen to share a category**.

The previously identified absence of a dedicated lobby/team-selection
end-to-end test and full logout→cleanup→rejoin scenario remains a
coverage question, not an invitation to add microtests during BUILD.
GitHub repository source and registries were reviewed statically;
TypeScript, Vitest, `runSelectedMapAudit()`, external Skills Probe
execution, and live Minecraft were **NOT EXECUTED**.
