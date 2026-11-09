---
id: document.system.zero-waste-execution
class: DOCUMENT
domain: system
role: WORKFLOW
authority: CANONICAL
lifecycle: ACTIVE
---

# Zero-Waste Execution

M-Bedrock uses minimum sufficient execution rather than broad rescans.

## Canonical flow

```text
engineering task
→ explicit task route
→ minimum sufficient evidence plan
→ deterministic result reuse
→ diagnosis / repair
→ changed semantic nodes
→ reverse dependency affected closure
→ bounded AI context
→ selective validation
→ semantic proof reuse
→ zero-waste benchmark
→ STOP
```

## Owners

```text
task routing
→ packages/analysis-planner/src/task-routing.ts

minimum evidence planning
→ packages/analysis-planner/src/planner.ts

deterministic diagnosis reuse
→ packages/diagnosis-pipeline/src/cache.ts
→ packages/diagnosis-pipeline/src/execution.ts

semantic affected closure
→ packages/graph/src/invalidation.ts
→ packages/orchestrator/src/semantic-affected-plan.ts

bounded AI context
→ packages/orchestrator/src/context-compiler.ts

selective validation
→ packages/orchestrator/src/selective-validation-plan.ts

semantic proof reuse
→ packages/orchestrator/src/semantic-proof-cache.ts

workflow composition
→ packages/orchestrator/src/zero-waste-workflow.ts

durable continuation
→ packages/project-model/src/session/work-session.ts
→ packages/orchestrator/src/work-session-store.ts

efficiency measurement
→ packages/orchestrator/src/zero-waste-benchmark.ts

diagnosis accuracy measurement
→ packages/orchestrator/src/golden-diagnosis-benchmark.ts

adaptive runtime probe budgeting
→ packages/orchestrator/src/adaptive-runtime-probe.ts

multi-client execution contract
→ packages/runtime-lab/src/host/multi-client-orchestrator.ts
```

## Safety rules

- Cache is an optimization, never evidence authority.
- Only deterministic capabilities are eligible for deterministic result reuse.
- Cache identity includes capability/executor revision, context, and exact input.
- Selective validation may skip a scenario only when an explicit binding proves it outside the affected closure.
- Unbound validation scenarios run conservatively.
- A patch operation that cannot bind to the current semantic graph blocks selective validation.
- Proof reuse requires an unchanged claim revision, runtime profile when relevant, basis nodes, and incident dependency edges.
- Work-session checkpoints retain references, not duplicated graph or diagnosis truth.
- Context compilation never invents semantic/intent relationships from names.
- Runtime probes are globally budgeted by diagnostic value and cost.
- Full observation snapshots are targeted-first; dimension-wide entity enumeration is disabled by default.
- Multi-client orchestration is only a proof-capable runtime path when backed by a real runtime adapter. A fake/test adapter never upgrades proof level.

## Risk-first proof review (same map audit)

Current selected-map `analysisPriorities` now rank critical gameplay impact
before historical search pressure, reusing one deterministic comparator.
Only directly matching source component IDs may reorder independent
`PROOF_NAVIGATION` tasks within their established stage. Unmatched tasks
remain available in stable order, and mandatory checkpoint/causal producers
stay ahead. No checkpoint, knowledge or counterproof is treated as closed by
ranking. The compact 12-item brief presents PROVEN findings first and
prioritized NEED_VALIDATION tasks next; all original canonical findings and
obligations remain in the full report and paged handoff.

The change optimizes which already-supported decision appears first, not
runtime Minecraft test speed or when the engine initially finds a defect.
Real time-to-first-actionable-finding improvement requires a measured run on
the exact selected source, not source assertions alone.

## Evidence-bound audit cost contrast

A selected-map CLI invocation can emit `AUDIT_TIMINGS` on stderr with
`--timings`. A fresh, exact-source-and-map-bound `--execution-receipt`
additionally captures `costObservation` from that **same initial
`runSelectedMapAudit()` call**, without altering canonical Map Audit JSON,
status, or proof admission. The captured wall-clock `auditCallElapsedMs`
excludes CLI startup, Knowledge loading, rendering and stdout transport.
`firstScopedFindingAvailableElapsedMs` is the time by which a source-scoped
finding projection was available, not individual detector discovery time.
`generatedModelTaskPacketBytes` measures serialized task-packet UTF-8
bytes, **not** ChatGPT input tokens or model context actually consumed.

The existing freeze operation validates the cost timeline and carries the
metrics inside the SHA-256-bound CLI execution receipt. The existing
`score-benchmark.mjs --compare` may receive an explicitly predeclared
`efficiencyReview.maximumMeanAuditCallRatio` between 0 and 1. It still
requires 2–20 independent frozen map artifacts, identical independent
expectations, pinned baseline/candidate commits, canonical execution
receipt metadata and source-grounded reviewer decisions. In efficiency
mode, identical material audit findings are comparable **only when**
the reviewed claim classes and cited evidence IDs also match. This does
not create a new detector, runner or report authority.

The resulting `costReview` is separate from the established source-claim
`recommendation`. An apparent reduction earns at most
`REDUCED_COST_REVIEWABLE_NOT_ADOPTED` when no case regresses in source
quality, at least two measured pairs improve, no measured pair becomes
slower, and the predeclared mean ratio is met. Missing/contradictory
durations, zero-cost baselines or missing quality evidence never become
proof of savings. Sample p95 carries the sample count and does not imply
population-level latency. No automatic harness adoption is authorized.

ChatGPT tool-call counts, actual model context/token usage, and cold/warm
cache state are **unobserved by the canonical CLI**. They must not be
substituted by zero, generated task byte size, or synthetic fixture
timings. Repeated actual selected-map invocations and their independently
verified provenance remain necessary before claiming end-to-end speedup.
The freeze/compare receipts establish internal byte/provenance coherence,
not independent execution attestation or Minecraft gameplay proof.

## STOP

When the requested outcome has matching evidence, affected validation is closed, stale proof obligations are resolved, and no blocker remains, stop. Do not continue into unrelated cleanup or architecture expansion.

## Context efficiency

Minimum-sufficient execution also applies to context loading.

Default read budget after routing is known:

```text
canonical owner/source  → 1–3 focused reads
supporting docs         → only when decision-changing
history/research        → zero reads by default
broad repository scan  → zero by default
```

Use stable handles instead of retransmitting large payloads when possible:
- artifact fingerprint;
- project/session ID;
- semantic node/diagnostic ID;
- patch transaction ID;
- content hash;
- exact path and range.

### Context tiers

```text
T0 current request/result
T1 exact semantic owner/source
T2 selected specialist procedure
T3 selected durable contract/reference
T4 current planning/work state only when material
T5 research/history only when needed
```

Do not preload higher tiers for reassurance.

### Incremental context rule

```text
changed file
→ changed normalized component
→ affected graph branch
→ affected diagnostics
→ affected validation
→ bounded context refresh
```

Avoid duplicate summaries, repeated stable graph/manifest payloads, unrelated rescans, and separate caches with different authorities.

Efficiency is measured as cost to a correct accepted result, not minimum context at the expense of proof.

## Catalog / Graph / Retrieval

Repository knowledge access follows the same minimum-sufficient rule:

```text
Router
→ Catalog identity
→ Graph expansion
→ structural + lexical ranking
→ optional semantic ranking
→ Section Retrieval when needed
→ bounded Context
```

History remains opt-in. Planning and Workspace are current-state owners selected directly by Router, not default knowledge-search material.

Large documents remain single canonical owners; Section Retrieval loads only the relevant heading/range instead of forcing file fragmentation or full-file context.
