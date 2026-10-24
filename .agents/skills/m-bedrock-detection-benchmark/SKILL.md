---
name: m-bedrock-detection-benchmark
description: >
  Measure bug-detection correctness, coverage, and regression against frozen expectations. Use for detector evaluation; not production implementation changes or map auditing.
---

# Lazy-Developer Detection Benchmark

**Lane:** EVALUATION / DETECTION REGRESSION

## Purpose

Measure detector correctness and proof coverage against frozen expectations without changing production capability. **Operating context: ChatGPT Chat map checking backed by GitHub `Local` and accessible selected `.mcworld` inputs.** A direct ChatGPT source review is not, by itself, a `runSelectedMapAudit()` observation, validated programmatic result, or whole-map precision/recall denominator. A repository scorer module is source code until genuinely executed.

## Entry criteria

Use only when a frozen expectation exists. For real-map scoring, artifact identity and SHA-256 must be verified first.

Corpus lanes:

- `calibration` — may inform detector development;
- `acceptance` — blind/holdout evaluation; must not inform implementation before scoring;
- `regression` — minimized bug-specific evidence retained after a reproduced failure.

Canonical manifests live under `engine/reliability/corpus/`.

## Allowed actions

- execute current detection capability;
- compare expected vs observed;
- classify TP/TN/FP/FN and semantic/proof mismatches;
- measure precision, recall, specificity, false-positive rate, evidence tier, cost, and regression state.

## Forbidden actions

- modify production detector code;
- modify target maps;
- rewrite expectations to fit output;
- reveal acceptance expectations to detector-development work before output is frozen;
- turn benchmark results into production Bug Report findings.

## Execution authority

Benchmark execution must use the same canonical capability that owns the evaluated artifact shape.

- real selected-map artifacts (`.mcworld` / approved packaged map) → only a genuinely executed `runSelectedMapAudit()` / CLI `audit` result may be scored as a **programmatic full-map run**; never use a direct ChatGPT interpretation, an unexecuted source design, a dev projection or a historical report as a substituted programmatic output;
- minimized analyzer fixtures → the production analyzer/capability that owns that fixture contract;
- benchmark scripts own validation, blind comparison, scoring, and aggregation only. They must not implement a second detector or a second map-audit pipeline.

A reduced fixture is not evidence that the full selected-map production flow passed. A real-map replay may be scored as production audit coverage only when artifact identity/fingerprint and frozen expectation are ready.

## Workflow

Artifact identity → frozen expectation → current detector → freeze observed output → compare → result class → quality metrics → bounded development handoff if needed.

For blind acceptance, observed output must be frozen before expected results are revealed.

### Blind acceptance contamination

Blind acceptance is fail-closed.

If the current evaluator, agent session, or implementation-development context has already seen the acceptance expectation semantics before the observed detector output is frozen:

- do not claim or score that run as blind acceptance;
- do not use the exposed expectation to modify production detection capability;
- do not rewrite, relabel, or promote the contaminated case to make the run admissible;
- limit the contaminated context to corpus/readiness/static review;
- use an independent evaluator/context that has not seen the expectation, or a fresh acceptance case whose expectation remains hidden, for the actual blind score.

Contamination invalidates only the blind claim; it does not invalidate the frozen fixture or expectation themselves.

## Contracts

Expectation schema: `../../schemas/benchmark-expectation.schema.json`

Result schema: `../../schemas/benchmark-result.schema.json`

Check corpus integrity:

```text
node scripts/validate-corpus.mjs
```

Check corpus readiness:

```text
node scripts/corpus-status.mjs
```

Filter regression candidates by objective priority basis:

```text
node scripts/regression-priority.mjs [basis]
```

Validate a frozen expectation:

```text
node scripts/validate-expectation.mjs expectation.json
```

Score:

```text
node scripts/score-benchmark.mjs result.json
```

Result classes: pass, false-negative, false-positive, semantic-mismatch, evidence-insufficient, runtime-proof-required, fixture-invalid.

## Output contract

Produce a frozen-expectation comparison with TP/TN/FP/FN classification when ground truth supports it; include denominators, artifact identity, proof tier, scoring limits and next-action ownership. Otherwise return UNSCORABLE without manufacturing metrics.

## Handoff

Reusable mismatch → bounded handoff to m-bedrock-detection-development. Never auto-resume Map Bug Audit.

A benchmark failure is evidence for investigation, not permission to broaden the detector blindly.

## Full-map source-claim evidence gate (P5)

For `evaluationScope="full-map-claim-review"`, the canonical scorer requires
an exact SHA-matched frozen `MapAuditOutputV2`, matching configured Minecraft
edition/version, an independently approved frozen expectation with explicit
positive, negative and allowed-UNKNOWN source claims, and reviewer decisions
covering **every claim ID**. It recomputes confusion counts and refuses totals
without their source review. Decided `supported` **and** `rejected` claims
must cite source-step IDs from the canonical selected-artifact report matching
the claim's independently frozen exact file/line/column source locators.
A file/line or line-range locator covering multiple distinct source-step
locations is ambiguous and never admits TP/TN. Use a separately approved
exact-column locator for bundled/minified same-line operations; do not
backfill columns from scored engine output. Global evidence-ID presence,
unrelated statements and a reviewer-only negative
classification are insufficient to produce TP/TN. Identical source-step
evidence may appear in multiple flow entry candidates; genuinely conflicting
same IDs fail closed. This is a source-location gate, **not automatic semantic
judgment**. Non-script-source claims without a directly projected step remain
UNSCORABLE at this narrow benchmark tier. Missing runtime proof stays missing; a frozen
report's Git SHA identifies the freezer checkout, not verified audit execution.
A manually declared blind flag is **not** independent blind verification.
Historical metrics-only results are now explicitly labeled
`AGGREGATE_INPUT_ONLY_NOT_CURRENT_FULL_MAP_EVIDENCE`, never full-map proof.

The original Defense 1.1.5 multi-claim static oracle remains immutable,
candidate and UNSCORABLE until its target edition/version and an actual
current-engine audit output are independently established. Do not adapt a
current detector to blind expectations or silently call a calibration case
blind acceptance.

## Map Audit quality mapping

For selected-map audit evaluation, also apply:

`docs/validation/retest-and-regression.md`

This preserves the distinction between detector correctness and proof maturity: NEED_VALIDATION is acceptable only when the frozen expectation explicitly permits unresolved proof at the configured evidence ceiling.

## Reference routing

- references/benchmark-expectation.md
- references/corpus-rules.md
- ../../references/detector-quality-metrics.md
- ../../references/evidence-cost-ladder.md

## STOP

Stop once the frozen expectation has a result class, quality metrics, and bounded handoff/residue.
