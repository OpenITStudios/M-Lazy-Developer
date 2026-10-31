# Test Classification — Active Source Contract

## Authority and current snapshot

The **single source of truth** is `tooling/repository/test-inventory.json`,
and `tooling/repository/run-tests.mjs` remains the **only repository test
selector**. This is a compact view of the exact `Local` Git snapshot
`dc53541c54e5968d09d19674ae7d94d6ab3b0680` (31 October 2026), not a second registry or a live dashboard.
Always re-read the registry after a later source commit.

- **381** physical test-source files, **113** feature IDs and **17** functional areas.
- **381 source-case-inspected** feature mappings and **381** reviewed mechanic-mapping decisions; **0 path-provisional**.
- Review depth: **100 source-reviewed** and **281 case-inventory-reviewed**.
- Retention: **368 keep**, **13 defer**; **96** files have mechanic tags.

`triage.sourceBlobSha` pins source-case classifications to exact Git
test bytes. Any test change requires fresh consumer/assertion inspection
and SHA re-pinning before the existing runner may select that test.
The registry's `sourceCommit` and other review SHA metadata retain
historical source-review provenance, not necessarily the latest HEAD.

## Classification axes — distinct responsibilities

| Field | Means | Does NOT imply |
| --- | --- | --- |
| `functionalArea` | Primary repository source-test area | Gameplay bug failureDomain |
| `featureId` | Production consumer/behavior family | End-to-end game feature PASS |
| `mechanicTags[]` | Optional secondary mechanic lookup | Current-map applicability or completeness |
| `lane` | Source-test selection group | Severity or independent safety certification |
| `featureMappingBasis` / `mechanicMappingBasis` | Source-bound category review | Executed test or detector accuracy |
| `review` | Historical inspection depth | Complete case/consumer equivalence |
| `recommendation` | Conservative retention status | Authorized deletion of unique tests |

`source-case-inspected` means case declarations, deciding assertions and
direct or indirect consumers were reviewed at an exact source revision.
`case-inventory-reviewed` means cases are known but full semantic
equivalence is still not proven. `source-reviewed` is a deeper historic
review flag and is **not** runtime proof. Empty `mechanicTags` is valid
for tooling tests.

## Current functional areas

| Functional area | Source files |
| --- | ---: |
| `map-database` | 4 |
| `map-content` | 17 |
| `lobby-pre-match` | 0 |
| `player-session` | 6 |
| `arena-match` | 26 |
| `player-state-persistence` | 7 |
| `combat-entities` | 21 |
| `inventory-economy` | 8 |
| `world-interaction` | 13 |
| `gameplay-scripting` | 22 |
| `gameplay-interpretation` | 31 |
| `audit-diagnosis` | 87 |
| `runtime-telemetry` | 48 |
| `repair-preservation` | 51 |
| `reporting` | 18 |
| `platform-compatibility` | 3 |
| `engineering-tooling` | 19 |
| **Total** | **381** |

Zero dedicated `lobby-pre-match` test files does not prove lobby
behavior absent; join/ready evidence may belong to arena or session
tests. A selected map still needs its own player-flow audit.

## Selection lanes

| Lane | Source files |
| --- | ---: |
| `development` | 231 |
| `safety` | 46 |
| `runtime` | 46 |
| `regression` | 38 |
| `acceptance` | 20 |
| **Total** | **381** |

`npm test` uses the curated default acceptance selection (10 Vitest
and one native suite at this source snapshot), which is **not**
`--lane acceptance`. `--affected`, `--focus`, `--lane` and `--full`
are choices of the same runner. See `TEST_EXECUTION.md`. The
`Local` CI workflow remains disabled.

## Separate meaning of testing and external references

Repository `*.test.*` files evaluate M-Lazy implementation behavior.
Selected-map checks are activated by an exact `.mcworld` through the
[Bug-Finding Coverage](../../docs/analysis/bug-finding-coverage.md)
and [Mandatory Audit Procedure](../../docs/analysis/mandatory-audit-procedure.md).
The 13 gameplay failure domains and issue proof belong to existing
diagnostic-reasoning/PROVE owners, not this source-test inventory.

The inventory's v0.30.0 Developer Skills / Skills Probe ZIP mappings
are `TOPIC_REFERENCE_ONLY` (not local tests or game proofs):
- Developer ZIP SHA-256: `5e4608858cd824d9f5476a6d89242084db6b6d80ce61fa0b5e4b0c079669f0d8`.
- Probe ZIP SHA-256: `89ec46832abb7fbb1215ec5e460275f18b4071ce5ca1d4c3cb3a7f052077f5d5`.
Separate curated references remain owned by
`skills/bedrock/source-lock.json` and
`experiments/developer-practice-signals.json`; do not overwrite
older reference revisions merely to mirror a newer ZIP.

## Safe consolidation

Reducing the physical file count to 100 is a target, **not permission
to delete coverage**. Preserve unique input/fixture, consumer,
assertion, negative control, lifecycle/fixture isolation, trust boundary
and capability/knowledge bindings. A `defer` test is still retained.
Fewer files do not imply faster execution or better bug recall;
measure only when a comparable test/benchmark actually runs.

## Earlier consolidation/source audits — historical snapshots

Prior 687 → 402 → 401 → 399 → 389 → 385 → 381 source-file
mergers, 301-provisional reviews, prior file-count phases and
source-case/callsite conservation analysis remain intact in the
[immutable full prior review](https://github.com/OpenITStudios/M-Lazy-Developer/blob/dc53541c54e5968d09d19674ae7d94d6ab3b0680/tooling/repository/TEST_CLASSIFICATION.md).
Ancestry also remains in the canonical machine inventory where
recorded. Old figures do not override current source classifications.

## Historical snapshot (phase five, 569 files; not current)

See the [old phase-five detail](https://github.com/OpenITStudios/M-Lazy-Developer/blob/dc53541c54e5968d09d19674ae7d94d6ab3b0680/tooling/repository/TEST_CLASSIFICATION.md#historical-snapshot-phase-five-569-files-not-current), not today's test count.

## Read-only navigation using descriptive names

The existing runner offers `--list-areas`, `--show-area`,
`--list-features`, `--show-feature`, `--list-mechanics`,
`--show-mechanic` and `--list-lanes` without running tests.

## Proof limits

REMOTE_GITHUB confirms source/static identity only. TypeScript,
Vitest, selected-map audit and Minecraft runtime are **NOT EXECUTED**
unless actual run evidence is independently provided.

