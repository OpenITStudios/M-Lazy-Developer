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
