# Test classification and registration

## Pinned inventory evidence

At GitHub `Local` commit `d2f764efb79bb7aee53f66fde185f69804a8a1a9`, all **687 source test files** were matched
one-to-one against `tooling/repository/test-inventory.json`: **0 omitted, 0
stale, 0 duplicate paths**. All rows have an owner, execution lane, review
scope, retention recommendation, rationale and actionable triage. The existing
test runner is the sole execution route; there is no additional test registry.

This audit directly read all 300 files formerly labeled
`pending-semantic-review` from that exact source revision and identified
test cases and assertion call sites. One tracker parity suite generates
five cases with `it(testCase, ...)` instead of literal case titles.
Those 300 rows are now `case-inventory-reviewed`, with their inspected
Git blob SHA recorded in `triage.sourceBlobSha`. **This is case-level source
inventory, not full assertion/consumer equivalence, test execution, or
proof that any test can safely be removed.** The prior 230
`source-reviewed` statuses are inherited; they were not all freshly
revalidated in this pass.

| Review scope | Files | Meaning |
| --- | ---: | --- |
| source-reviewed | 230 | Prior source-level review, not an executable PASS |
| case-inventory-reviewed | 457 | Named or generated cases identified; deep assertion equivalence still open |
| pending-semantic-review | 0 | No file still awaits an initial case-inventory read |

Current retention decisions: **204 keep, 430 keep-provisional, 34 defer,
19 merge-candidate, 0 obsolete**. `keep-provisional` prevents premature
deletion; it is not a claim of unique or indispensable coverage. `defer`
means targeted execution, not removal. A `merge-candidate` requires
checking assertion and production-consumer equivalence before consolidation.

## Existing execution lanes

| Lane | Files | Intended selection |
| --- | ---: | --- |
| safety | 54 | Authorization, preservation, mutation and trust boundaries |
| acceptance | 26 | Cross-component user-facing and integration behavior |
| runtime | 81 | Runtime/telemetry/harness *contracts*, not observed live Minecraft |
| regression | 67 | Frozen/historical failure-family and golden checks |
| development | 459 | Owner-specific evolving component contracts |

Every file has exactly one *routing* lane plus one source owner. A single
lane does not mean the file has only that risk or purpose; many development
tests contain safety-relevant assertions. The large development lane is
further distinguished by each row's specific owner, not by inventing
new frameworks or physical directory migrations.

`npm test` / `--acceptance` currently selects **11 curated files
across lanes** (5 acceptance, 2 development, 2 safety, 2 regression).
It is **not** the same as the 26-file `--lane acceptance` selection.
`--lane`, `--list-lanes`, `--focus`, `--affected` and `--full`
are already supported by the existing `run-tests.mjs`.
All modes now validate complete source-file registration, including
owner/review/triage consistency, before test selection or execution.
`--affected --plan` is planning only; it does not run tests.

## Review rule and proof boundary

For a further `source-reviewed` promotion, inspect the production import
owner, actual assertions, positive/negative/UNKNOWN behavior, authoritative
consumer, and overlap with neighboring tests. If the source is changed,
revalidate a pinned case review against its recorded blob SHA. Distinct
failure-family/safety protections cannot be removed merely to reduce file
count. Consolidate only where the same behavior is protected without
losing assertions.

GitHub CI remains disabled as previously requested. This pass performs
**source/static verification only**. It does not execute TypeScript,
Vitest, `runSelectedMapAudit()`, or Minecraft gameplay, and it does not
modify production implementation or test-case bodies.

## Functional map/gameplay areas (user-facing navigation)

The existing five *execution lanes* do **not** tell which Minecraft subsystem a test covers.
To answer map-testing questions without a new registry, every one of the 687 entries
in the same `test-inventory.json` now has one `functionalArea` and a
`mechanicTags[]` array. Multiple tags are allowed for cross-system tests.
These are **navigation hints, not evidence of gameplay PASS or exhaustive coverage**:
- `path-provisional`: assigned from the canonical file path and module name; confirm assertions/consumers before claiming behavior coverage.
- `source-case-inspected`: named cases and evidence-bearing source read on the pinned repository revision; not full assertion-equivalence review or execution.
- Empty `mechanicTags` means no explicit mechanic mapped yet; it does not mean the file is useless or has no gameplay effect.

| Primary functional area | Files | Purpose |
| --- | ---: | --- |
| `map-database` | 9 | LevelDB, world DB, NBT evidence |
| `map-content` | 43 | .mcworld archive, structures, world layout, content |
| `lobby-pre-match` | 0 | Join pad, team selection, ready state, matchmaking (unproven dedicated coverage) |
| `player-session` | 6 | Join, spawn, leave, disconnect, reconnect |
| `arena-match` | 53 | Arena allocation, match start, isolation, reset, multiple arenas |
| `player-state-persistence` | 10 | Persistent properties, restoration, state lifetime |
| `combat-entities` | 40 | Damage, death/revive, mob/entity AI |
| `inventory-economy` | 14 | Inventory, items, rewards, currencies |
| `world-interaction` | 26 | Chunks, teleport, movement, forms and interaction |
| `gameplay-scripting` | 50 | Functions, scripts, commands, scheduling |
| `gameplay-interpretation` | 58 | Gameplay intent, authored behavior, semantic models |
| `audit-diagnosis` | 161 | Inspection, diagnostic reasoning, evidence/proof gates |
| `runtime-telemetry` | 93 | Runtime harness, probes, telemetry contracts |
| `repair-preservation` | 51 | Authorized repair, preservation, mutation safety |
| `reporting` | 44 | Bug reports, tracker, UI/output projection |
| `platform-compatibility` | 3 | Minecraft edition/version compatibility |
| `engineering-tooling` | 26 | Repository, project workflow, test tooling |
| **TOTAL** | **687** | One primary area per registered file |

### Find tests by actual Minecraft subsystem

| Question | Concrete existing source tests | Evidence limit |
| --- | --- | --- |
| Map Database / LevelDB | `engine/adapters/leveldb/test/inspect.test.ts`, `engine/analyzers/world-db/test/world-db-evidence.test.ts`, `engine/packages/orchestrator/test/inspection/world-db-runtime-evidence.test.ts` | World DB parsing/source evidence; disk chunk is not live loaded-chunk proof |
| Player join/spawn/leave (logout-related) | `engine/packages/orchestrator/test/inspection/player-session-lifecycle-analysis.test.ts`, `engine/packages/orchestrator/test/inspection/persistence-source-analysis.test.ts` | Source lifecycle callback recognition, not observed server logout |
| Disconnect and reconnect | `engine/packages/reliability/test/session/session-model.test.ts`, `engine/packages/runtime-lab/test/domains/multiplayer/multiplayer-session-experiment.test.ts` | Model/experiment contract; not a real connected-client replay |
| Lobby join pad | `engine/packages/runtime-lab/test/domains/multiplayer/multiplayer-session-experiment.test.ts`, `engine/analyzers/scripts/test/domains/arena/arena-authority-evidence.test.ts` | Partial join-pad behavior only; no fully verified lobby system |
| Arena, scoreboards and multi-instance state | `engine/packages/orchestrator/test/arena/arena-state-isolation-analysis.test.ts`, `engine/packages/orchestrator/test/arena/arena-lifecycle-analysis.test.ts` | Source contracts for state partition and lifecycle |
| Match end and arena reset | `engine/packages/orchestrator/test/arena/arena-reset-closure-analysis.test.ts` | Reset closure gating; not a live game reset proof |
| Inventory restored on joining/respawn | `engine/packages/orchestrator/test/inspection/inventory-restore-ownership-analysis.test.ts` | Prevents duplicate restore ownership in source model |

### Confirmed classification gaps

- **Complete Lobby flow** (lobby entry → team selection → ready/queue → start): no dedicated verified end-to-end test identified in this audit; join-pad and arena-start contracts cover only pieces. The primary `lobby-pre-match` area is therefore currently empty rather than assigning unrelated tests to it.
- **Logout** is not a directly named suite. `playerLeave`, disconnect, reconnect, persistence and restore have source-level checks; a complete real-game logout/rejoin scenario remains **NOT EXECUTED**.
- **Database** checks validate source and adapter contracts, not successful reading/importing of a particular live user world.

The existing `tooling/repository/run-tests.mjs` supports read-only `--list-areas`,
`--show-area <functionalArea>`, `--list-mechanics`, and `--show-mechanic <tag>`.
For example, `--show-mechanic lobby.join-pad` lists two relevant partial source tests;
`--show-mechanic player.reconnect` lists two. None of these modes runs Vitest. The existing execution commands and suspended CI remain unchanged.
