# Reliability Corpus

This directory owns frozen evaluation manifests for real-map and reduced regression evidence.

```text
calibration.json             detector-development corpus; may inform implementation
acceptance.json              blind/holdout corpus; must not inform detector changes before scoring
regressions.json             minimized bug-specific regression cases
audit-detection-cases.json   frozen historical detection/recall pressure; never current-artifact proof
gameplay-understanding.md    human-readable calibration corpus context and semantic baselines
```

## Generalization-first evaluation boundary

**Sample ≠ rule:** full maps in this corpus may illustrate a missing *general* mechanic (interaction → state → resource → outcome, scope, recovery), never define the production answer for that map name. Frozen SHA-256, title and case ID are selectors for the **evaluation artifact** only. Do not put case-specific rules, coordinates, old client bugs or expected fixture answers into `gameplay-intent`, `semantic-ir`, `behavior-model`, Scenario Graph, the proof gate or the model task prompt.

**Three independent concepts:**
1. **Declared case readiness** is a manifest statement and fields such as `artifactFingerprint` and `frozenExpectation`. It neither proves availability of a byte-identical full map nor that an expectation validates.
2. **Executed observation** requires the genuine canonical engine result tied to exact artifact SHA, code commit, target edition/version and proof tier. Reduced source fixture execution is not a full-map audit or Minecraft runtime observation.
3. **Scored understanding/detection** requires an expectation independently reviewed and frozen *before* observing the engine output, one explicit scope and a comparable proof tier. Static source calibration is not runtime concurrency/success evidence.

**Existing form separation:** the existing `corpus-status.mjs` exposes declared map-artifact, reduced-fixture and reference/unknown case forms without changing case scores. The classification comes from manifest shape, not verified runtime availability. `candidate`, `ready` and `blocked` remain corpus lifecycle metadata; their totals must not be described as engine PASS. The reduced-fixture blind acceptance cases currently in `acceptance.json` cannot prove generalization to unfamiliar complete worlds. A genuine full-map blind holdout requires independently accepted artifact identity/expectation and no development exposure before the candidate output is frozen.

**Generic evaluation dimensions:** 
- Source-grounded claim validity: claim IDs, exact selected-map source locators and whether each cited edge independently supports its asserted relation.
- Player-facing semantics: distinguish authored design, presented UI/dialogue hints, technical implementation and unsupported conjecture; unknown is acceptable and must be truthful.
- Relational completeness in verified scope: actor, trigger, guard, action, state/resource, outcome and recovery; count missing supported relations only against an independent oracle with a known denominator.
- Isolation: objective, outcome and state must not leak across mode/level/arena/role/session or historic version. Different scoped objectives are not a contradiction until scopes overlap.
- Counterexamples: no inferred winning condition from a debug return or name; no assumption that `scoreboard` implies score, that six configured arenas ran concurrently, or that last-version prices remain the contract.
- Metamorphic checks where valid: irrelevant file/variable renaming, archive member ordering, duplicated labels in different pack/namespace scopes and coherent spatial offset. If renaming removes the only genuine semantic signal, output should degrade to UNKNOWN rather than invent meaning.
- Cost: measured audit time, memory, source re-inspection and model/token usage *only when actually executed*.

**Score/report discipline:** report raw TP/FP/FN/TN and denominators only for independently adjudicated scoped expectations; distinguish semantic precision/recall from defect precision/recall and from completeness of source indexing. Include abstention/unknown behavior and unscorable cases separately. Show per-style results (explicit, modular/compiled, bundled/minified, spatial) and worst-case regressions before weighted aggregate. An improvement must preserve negative examples and not substitute noisy additional candidate nodes for meaningful design understanding. See existing `gameplay-understanding.md` for the historical, non-authoritative node-count baseline.

**Current static snapshot on 2026-10-11, GitHub `Local` at `9408782d5130`:** calibration 13 `candidate` / 0 `ready`; acceptance 8 `ready` reduced-source fixtures / 0 confirmed full-map runs; regressions 46 cases, 19 declared `ready` and 27 `candidate`. These are manifest readings, NOT benchmark execution. The Defense v1.1.5 frozen multi-claim static oracle has a pinned SHA but does not match the standard single-disposition expectation schema and has no observed `runSelectedMapAudit()` output: remains `candidate` and NOT SCORABLE. Do not silently rewrite its oracle or promote it to ready.

### Exact full-map audit output identity

The production `runSelectedMapAudit()` already computes the selected `.mcworld` SHA-256. Its current MapAuditOutputV2 now projects this as `artifactFingerprint`; the property is optional in the V2 schema for older reports but is always authored by the current producer. The existing benchmark freeze helper computes SHA-256 from the **supplied archive's actual bytes** and rejects absent, malformed or unequal report fingerprints. Filename, level name, version, a syntactically valid JSON, and historical output are not comparable substitutes.

A frozen receipt proves only that the supplied report declares the same selected artifact byte identity. Its `execution.gitCommit` is the Git checkout when **freezing**, not independent proof of which code built the report. Claiming full-map gameplay accuracy additionally requires genuine canonical engine execution, independently frozen map-scoped expectations, matching edition/version/proof tier, and blind-evaluation integrity where applicable. This change does not make the current Defense multi-claim oracle scoreable, upgrade reduced fixtures, or verify Minecraft runtime.

## Current artifact verification (metadata, not audit execution)

On 2026-10-12 a ChatGPT-accessible Google Drive source delivered
`Defense Challenge v1.1.5.mcworld` (24,032,943 bytes) at the file ID
already present in `calibration.json`. Independent byte hashing in the
ChatGPT analysis environment matched the pinned
`eb554476d26b7b9de949628d8efe00f12beb95669f6c424a2eb754b52d39f45c`.
The archive contained 529 entries including the named script-chunk path
referenced by the existing frozen oracle. The original binary is NOT
committed to GitHub and no artifact transferability, source correctness,
canonical engine execution, or runtime effect is inferred from this check.

The frozen `cal-defense-challenge-1-1-5` oracle remains a multi-claim
historical document with unresolved target edition; no matching observed
`runSelectedMapAudit()` V2 output exists at the current `Local` commit.
Thus it remains **candidate / UNSCORABLE**, even though the exact external
artifact was available and its SHA verified. Never promote metadata
availability into semantic recall.

## Rules

- Map binaries remain outside Git unless they are explicitly safe, minimized fixtures.
- Every external artifact must be identified by stable metadata and SHA-256 before a result is accepted.
- Expectations are frozen before a benchmark run.
- Acceptance expectations must not be rewritten to match detector output.
- Material detectors need both positive and negative cases.
- Runtime-only behavior is not converted into a static defect when runtime proof is missing.
- A corpus change requires provenance independent of the implementation under test.

## Execution boundary

Corpus cases do not define an alternate detector.

- Real-map cases are replayed through the canonical selected-map audit entrypoint.
- Reduced fixtures are replayed through their owning production analyzer/capability.
- Historical reports/catalogs are comparison or search-pressure inputs only; they are never fed into the production audit as defect evidence.
- Metrics from reduced fixtures and real-map production replay must remain distinguishable; do not claim end-to-end map recall from analyzer-only fixtures.

## Case lifecycle

```text
candidate
→ expectation-approved
→ artifact-verified
→ runnable
→ scored
→ retained as calibration / acceptance / regression evidence
```

A candidate without approved expectations or artifact identity is not benchmark evidence.


## Readiness states

Reduced-fixture `ready` cases are checked against the **actual repository
fixture-file SHA-256** in both the corpus validator and the case-promotion gate.
A mismatched frozen fingerprint blocks the case; do not rewrite frozen
expectations to match changed source. For external `.mcworld` cases, matching
manifest metadata is not proof that the archive was retrieved or executed.
Such artifact identity still requires an independent byte-level verification.

```text
candidate  known source exists, but scoring prerequisites are incomplete
ready      artifact identity + frozen expectation are complete
blocked    source/evidence is invalid or cannot currently be evaluated
```

A candidate must never be counted as benchmark proof.

Check current readiness manually:

```text
node .agents/skills/m-bedrock-detection-benchmark/scripts/corpus-status.mjs
```


Before changing a case to `ready`, run:

```text
node .agents/skills/m-bedrock-detection-benchmark/scripts/check-case-ready.mjs <manifest.json> <case-id>
```

Promotion is fail-closed: unresolved source references or any declared missing prerequisite keep the case out of benchmark-ready state.


## Evidence role

Where the source evidence already supports classification, a case may declare:

```text
positive  known defect/failure evidence
negative  known-good/non-defect evidence
```

Do not infer an evidence role merely from the map name or from the absence of a recorded issue outside a defined QA scope.

Existing semantic-understanding calibration cases remain role-unspecified until an independent expectation is grounded.


## Regression priority basis

Regression cases may carry objective `priorityBasis` tags such as:

```text
repeated-across-maps
runtime-sensitive
semantic-owner-present
intermittent-reproduction
explicit-invariant
```

These are routing reasons, not a quality score or winner ranking.

Filter current candidates manually:

```text
node .agents/skills/m-bedrock-detection-benchmark/scripts/regression-priority.mjs
node .agents/skills/m-bedrock-detection-benchmark/scripts/regression-priority.mjs runtime-sensitive
node .agents/skills/m-bedrock-detection-benchmark/scripts/regression-priority.mjs repeated-across-maps
```

## Corpus roles

Not every corpus file has the same shape.

```text
calibration / acceptance / regressions
→ machine benchmark manifests

audit-detection-cases
→ reusable frozen defect-family recall expectations

gameplay-understanding
→ human-readable calibration context and reviewed semantic baselines
```

All corpus content is evaluation/reference material. None of it is current map truth.

Historical chronological results belong in `engine/reliability/history/`, not here.
