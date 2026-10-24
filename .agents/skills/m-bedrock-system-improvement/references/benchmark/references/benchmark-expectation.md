# Benchmark Expectation

A Detection Benchmark expectation must be frozen before evaluating the detector under test.

Canonical machine contract:

```text
.agents/schemas/benchmark-expectation.schema.json
```

Minimum identity:

```text
Expectation ID
Corpus lane
Artifact label
Artifact SHA-256
Map version when known
Target edition
Target Minecraft version
Expected disposition
Expected finding/domain when applicable
Expected proof ceiling
Reason / provenance
Frozen-before-run marker
```

Do not encode implementation details that are not part of observable behavior.

## Expected dispositions

- `defect`
- `designed-behavior`
- `ambiguous-intent`
- `insufficient-evidence`
- `runtime-proof-required`

A negative case normally expects `designed-behavior` or another explicit non-defect disposition; it must not be represented by simply omitting expectations.

## Blind acceptance

For `acceptance` cases:

1. verify artifact identity;
2. run detector without exposing expected semantics;
3. freeze observed output;
4. reveal expectation;
5. score.

## Mismatch interpretation

- missing expected defect → `false-negative`
- unexpected defect on a known-good case → `false-positive`
- right subject, wrong semantics → `semantic-mismatch`
- semantics correct but proof too weak → `evidence-insufficient`
- static ceiling correctly stops before runtime → `runtime-proof-required`
- expectation/source identity is invalid or stale → `fixture-invalid`


## Required regression families

The corpus must retain generic regression pressure for these failure families when representative artifacts are available:

- declared resource exists but is never materialized;
- materialized actor/resource is not kept simulated when gameplay depends on it;
- visible arena count differs from effective session/player throughput;
- two terminal paths can commit result/reward/cleanup without a single-commit guard;
- queued/requested world placement never becomes present;
- release/version identity disagrees across current artifact surfaces;
- restricted/debug capability is reachable through normal player acquisition;
- hardcoded default arena/session ownership is reachable from a non-default instance;
- deprecated/compatibility residue is present but has no proven gameplay consequence (negative case: must not be auto-promoted).

Expectations describe observable semantics, never a map name, symbol name, or one historical implementation. A detector that only recognizes the historical object is a benchmark failure.

## Generic frozen full-map source claims (P5)

An independently approved full-map expectation can use the **existing**
`expected.claims` alternative to a one-disposition expectation. Do not
rewrite a frozen historical oracle into this format merely to pass a benchmark;
get separately approved independent source-grounded claims first.

Each claim requires `id`, `subject`, `expectedClass` (`supported`,
`rejected` or `unknown`), `sourceRefs`, and `proofCeiling`. The
`rejected` class must be an independently evidenced counterexample—not a
missing bug report. `unknown` means evidence genuinely cannot decide the
claim at its proof tier; correct abstention counts separately rather than
being relabeled as a true negative.

Full-map source-review scoring uses the **existing**
`scripts/score-benchmark.mjs` with `evaluationScope:
"full-map-claim-review"`, `fullMapReview.frozenExpectationFile`,
`fullMapReview.frozenObservationFile`, independently declared reviewer and
review timestamp, and exactly one reviewed decision per frozen claim.
Decisions use `observedClass` from the same three classes plus a reason
and `observedEvidenceIds`. Decided positive AND negative observations must cite canonical
`gameplayStructure.sourceFlowCandidates[].sourceSteps[].id` whose **selected
artifact SourceRef file and inclusive line span** intersects that particular
frozen claim's `sourceRefs`; merely having an evidence ID anywhere in the
report is not enough. Oracle sourceRef syntax is `relative/path:line`,
`relative/path:start-end`, `relative/path:line:column` or
`relative/path:firstLine:firstColumn-lastLine:lastColumn` (inclusive).
If more than one **distinct SourceRef site** overlaps a locator, that locator
is **ambiguous** and cannot support a TP/TN, even when the cited evidence ID
exists. This matters especially for bundled/minified JavaScript where many
gameplay operations share a single source line. An independently approved
column-level locator can distinguish exact operations; never silently guess
columns or rewrite the frozen expectation after viewing the engine result.
Identical SourceRef sites repeated across valid flow entries count once. Duplicate source-step IDs are acceptable only
when they resolve to the exact same source owner and span across multiple
entry flows. Conflicting owners, forged lines, unsupported file-only source
locators, and free-text negative decisions without a matching counter-evidence
source step are UNSCORABLE rather than true positives/true negatives.

This **source-site correlation is necessary but not sufficient** for semantic
correctness: a reviewer must still explain how that authored operation proves
the particular claim. The scorer verifies the receipt's source identity and
recomputes counts, not the meaning of Minecraft gameplay automatically.
Claims based on NBT, entity JSON or whole-map absence that have no matching
canonical source-step representation remain UNKNOWN / not source-step scoreable
at the current P5 proof ceiling; do not invent a script locator or modify
the approved oracle to manufacture an eligible decision. Aggregate TP/TN/FP/FN/unknown
must equal the per-claim adjudications; entered counts never authorize scores.

The scorer rejects missing/mismatched archive SHA-256; malformed or unfrozen
canonical audit receipts; edition/version mismatch, unknown configured
Minecraft target, missing expectation approval chronology, incomplete/duplicate
claims, invented evidence IDs, and unsupported blind-acceptance declarations.
A frozen output's Git commit remains **freezer checkout provenance**, not
independently attested engine execution. A full-map PASS here means only
reviewed **static-source claim consistency**, not reliable live gameplay,
universal source coverage, first-pass recall or a runtime multiplayer PASS.
Blind independence remains reviewer-declared until independently attested;
do not claim blind acceptance from self-declaration alone.

When no canonical full-map output or compatible independently reviewed
expectation exists, keep the case `candidate`/`UNSCORABLE`. A map file
hash and an archived source review are not a substitute.

