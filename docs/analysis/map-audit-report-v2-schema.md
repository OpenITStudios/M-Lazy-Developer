---
id: document.analysis.map-audit-report-v2-schema
class: DOCUMENT
domain: analysis
role: CONTRACT
authority: CANONICAL
lifecycle: ACTIVE
---

# Map Audit Report V2 Schema

## Purpose

Defines the **Map Audit Report** used by humans after selected-map analysis. This is the honest report surface and must preserve every material finding, whether `PROVEN` or `NEED_VALIDATION`.

The report engine must first try to resolve NEED_VALIDATION toward PROVEN using the bounded proof route. If deciding proof remains unavailable, the finding stays visible as NEED_VALIDATION; it must never be dropped merely because it is not yet proven.

## Required audit model

```text
World Artifact
→ Evidence Scope
→ Gameplay Surface Inventory
→ Gameplay Discovery Closure
→ Game Design Model
→ Gameplay Flow + State Closure
→ Boundary / Multi Arena / Capacity / Replica Model
→ Reachability + Capability Exposure
→ Blind-Spot + Cross-System Coverage
→ Gameplay Model Closure
→ BUG Findings
→ DESIGN_MISMATCH Findings
→ Coverage Accounting
→ Closure-gated Production Report
```

## Evidence scope

Current gameplay conclusions must come from the selected artifact only.

The output records:
- selected artifact;
- selected-map-version-only mode;
- archive sources not used as current gameplay authority.

## Game design model

Required understanding:
- objective;
- win condition;
- lose condition;
- reset rules;
- preserve rules;
- progression rules;
- multiplayer rules;
- multi-arena/capacity rules when applicable.

## Coverage accounting

Every applicable audit surface is recorded as:

- checked;
- blocked, with reason; or
- not-applicable, with reason.

Unsupported or unparsed mechanics remain internal detection-gap reasons and must project publicly as NEED_VALIDATION with exact missing proof and one narrow validation test.

## Canonical issue taxonomy

Every reportable finding is described on four independent axes:

```text
Issue Type
+ Gameplay Flow
+ Failure Domain
+ Severity
```

### Issue Type

- `BUG`
- `DESIGN_MISMATCH`

### Gameplay Flow

- `ENTRY_JOIN`
- `READY_START`
- `SETUP`
- `ACTIVE_GAMEPLAY`
- `PROGRESSION`
- `TERMINAL`
- `CLEANUP_REPLAY`
- `RECOVERY`

### Failure Domain

- `arena-multi-arena`
- `inventory-economy`
- `progression-wave-objective`
- `chunk-simulation`
- `player-lifecycle`
- `entity-ai-combat`
- `world-structure-mutation`
- `ui-feedback-information`
- `state-ownership`
- `temporal-async`
- `boundary-capacity`
- `persistence-recovery`
- `platform-performance`

`failureDomain` is the primary reader-facing domain. `contributingDomains[]` preserves materially involved cross-system domains for the same root cause.

### Severity

Severity remains independent from issue type/domain and is derived from actual impact:

- Blocker
- Major
- Minor

Do not infer severity merely because an issue belongs to multi-arena, inventory, UI, or another domain.

## Issue type split

Map Audit Output V2 has two distinct issue-type lanes. Each lane may contain PROVEN or NEED_VALIDATION findings; unresolved material findings must remain visible until resolved or disproved.

### BUG

Use when the selected artifact has a grounded intended behavior/design, but implementation or runtime behavior breaks that intent.

Examples:

- spawn should happen but fails;
- reconnect should restore loadout but does not;
- purchase consumes currency but fails to deliver effect;
- cleanup leaves stale state that corrupts the next run.

### DESIGN_MISMATCH

Use when the capability/design presented by the map does not match what can actually be played or delivered, even if the implementation is internally consistent.

Examples:

- six arenas are presented but only two can run concurrently;
- a visible mechanic or route is offered but the supported capability is materially lower;
- platform/resource constraints make the authored design undeliverable as presented.

Technical constraints are recorded as root cause/constraint evidence. They do not convert a DESIGN_MISMATCH into normal behavior.

A finding must belong to exactly one of these two lanes. Do not duplicate one root cause into both.

## BUG record

Every reportable issue requires:

```text
Bug ID
Issue Type
Failure Domain
Contributing Domains
Gameplay Flow
Status
Issue
Player Impact
Reproduction Steps
Expected Behavior
Actual Behavior
Evidence
Proof Ceiling
```

PROVEN findings require:
- cleared counter-evidence;
- tester-ready reproduction.

Blocker / Major / Minor severity is included only after impact classification is grounded. Severity becomes mandatory when a PROVEN BUG is promoted into approved Bug Report V2; the Map Audit Report must not invent severity merely to satisfy presentation.

## DESIGN_MISMATCH record

DESIGN_MISMATCH uses the same evidence, gameplay-flow, severity, reproduction, expected/actual, proof-ceiling, and counter-evidence discipline as BUG.

Additional fields may include:

```text
Mismatch Kind
Technical Constraint
Presented Capability
Playable Capability
```

## Canonical unresolved-proof fields

Every public NEED_VALIDATION finding uses the same names:

```text
validationReason
missingProof
validationTest
validationGroupKey
proofNavigation
```

`proofNavigation` may expose:

```text
proofGoal
provenClaims[]
missingClaims[]
route[]
evidenceSubstitutions[]
historicalSearchHints[]
historyPressure
familyProofCriteria[]
proofStopRule
runtimeLastResort
```

These are proof-navigation fields, not additional public statuses.

Map-level audit output also carries:

```text
validationTests[]
honesty
qualityGates.vitalGameplay
qualityGates.informationIntegrity
qualityGates.zeroFinding
fullMapReplica
```

The quality gates are projections over the same canonical audit state. They do not create new finding lanes, new gameplay authority, or a second audit state machine.

- `vitalGameplay` projects exactly eight vital domains and is `CLOSED` only when every applicable domain is `UNDERSTOOD_PROVEN_SAFE`, `UNDERSTOOD_WITH_FINDING`, or `NOT_APPLICABLE`. `RUNTIME_REQUIRED`, `DETECTION_GAP`, or unrouted material residue keeps it `OPEN`.
- `informationIntegrity` is `CLOSED_CLEAR`, `CLOSED_WITH_FINDINGS`, or `BLOCKED`. Any contradiction remains exactly once in `bugs[]` or `designMismatches[]`.
- `zeroFinding` is `ELIGIBLE`, `NOT_ELIGIBLE`, or `NOT_APPLICABLE`. It may be ELIGIBLE only when both finding lanes are empty and canonical coverage/closure/honesty are fully closed with no remaining Audit Obligations or validation groups.

The canonical Map Audit Output V2 preserves every material finding in exactly two issue-type lanes:

```text
bugs[]
designMismatches[]
```

Each lane may contain both `PROVEN` and `NEED_VALIDATION`.

Internal/report-build APIs may expose convenience projections such as `findings`, `proven`, or `needValidation`, but those are not additional Map Audit Output V2 authorities.

`NEED_VALIDATION` items must remain visible until they are either promoted to `PROVEN` by sufficient proof or independently disproved. They must never disappear merely because they are not yet approved bugs.

`fullMapReplica` uses only:

```text
replicaBaseline
replicaResults[]
replicaId
replicaStatus
replicaDivergenceIds[]
incompleteReplicaIds[]
baselineReusableForAllReplicas
```

## Human-facing report completeness

**Operator-facing final summary versus technical evidence:** The final operator report contains only `Bug` and `Design Mismatch` categories. Within both, every scoped `PROVEN` and `NEED_VALIDATION` finding must remain individually visible with its status; pending candidates are not asserted as confirmed. Pending findings include the suspected issue, expected/indicated actual result, potential impact, source evidence, `validationReason`, `missingProof` and `validationTest`. `SAFE` remains internal-only. A `Pemeriksaan belum selesai` note is a completeness indicator, never a replacement for pending findings. The operator view labels **every material unresolved proof question NEED_VALIDATION**, including previously unclassified internal Audit Obligations, index-only unknown surfaces/source links and unmatched validation assertions. Unclassified proof work is listed individually below the two issue categories with "jenis masalah belum ditentukan"; it must never be promoted to BUG/DESIGN_MISMATCH without the existing proof gate. Overlapping issue and obligation IDs share one displayed finding, preserving additional proof needs. The canonical structured V2 and technical brief retain the distinct internal Audit Obligation owner; no audit proof gate or schema changes.

The Map Audit Report must render all material findings:

```text
PROVEN BUG
PROVEN DESIGN_MISMATCH
NEED_VALIDATION BUG
NEED_VALIDATION DESIGN_MISMATCH
```

Rules:

- try to promote NEED_VALIDATION through source/cross-domain/formal/counter-proof routes first;
- keep unresolved findings visible when proof is still missing;
- show `validationReason`, `missingProof`, and `validationTest` for NEED_VALIDATION;
- do not assign final Blocker/Major/Minor severity to NEED_VALIDATION;
- do not invent severity for PROVEN findings before grounded impact classification;
- do not convert NEED_VALIDATION into PROVEN merely to make the report look complete;
- do not omit a material finding from the human-facing report because it is not eligible for the approved bug ledger.

## Status

Every material finding uses exactly one of two proof statuses (shown per finding, not as report categories):

- `PROVEN` — contradiction is sufficiently proven from selected-artifact evidence and blocking counter-proof is cleared. Final Blocker / Major / Minor severity is allowed.
- `NEED_VALIDATION` — the finding remains materially plausible but one specific proof obligation is unresolved. It must include a concise validation reason, the exact missing proof, and one narrow validation test. Final severity is not allowed yet.

BUG versus DESIGN_MISMATCH remains an independent `issueType`; status does not replace issue type.

Internal states such as RUNTIME_PROOF_REQUIRED, DETECTION_GAP, COUNTERPROOF_SEARCH_REQUIRED, GAMEPLAY_TRANSLATION_REQUIRED, insufficient evidence, or ambiguous intent are mapped into NEED_VALIDATION fields and never exposed as additional public statuses.


## Gameplay Model Closure

- `CLOSED` — discovered surfaces are accounted and material state/boundary understanding is complete.
- `PARTIAL` — discovered surfaces are accounted, but explicitly identified material evidence remains blocked/unknown.
- `OPEN` — one or more discovered surfaces are unaccounted, the major state model is incomplete, or material boundaries are not sufficiently extracted.

`OPEN` may contain non-empty `unaccountedSurfaceIds` and blocks comprehensive production review/publication.

## Advanced coverage

When applicable, coverage includes:

- replica integrity/completeness;
- prerequisite reachability;
- sensitive capability exposure/authorization;
- negative-space and mechanic completeness;
- temporal/cross-system risk;
- repeated-run baseline/reset proof;
- player-facing evidence;
- quantitative/platform constraints.


## Publication precondition

Gameplay Discovery Closure is a production control gate and does not create a second persisted report authority.

Before Map Audit Output V2 is treated as comprehensive:

- Gameplay Discovery Closure must be `COMPLETE`; both `OPEN` and `PARTIAL` block publication.
- Gameplay Model Closure must be `CLOSED`; both `OPEN` and `PARTIAL` block publication.

If either closure is not fully closed, the human-facing report may still expose the honest partial finding set and exact unresolved obligations, but it must not claim comprehensive audit completion.
## Optional cross-domain reasoning metadata

A BUG or DESIGN_MISMATCH finding may carry an optional `reasoning` object when canonical causal-link reasoning passes evidence admission. This metadata does not create a new finding status or repair authority.

Canonical fields:

```text
reportClassification
diagnosticDisposition
proofConfidence
evidenceDomainSources[]
evidenceChain[]
unresolvedPredicates[]
recommendedValidationPredicate
recommendedReadOnlyProbeId
```

`reportClassification` is explanatory report vocabulary only. The canonical public finding status remains `PROVEN` or `NEED_VALIDATION`, and BUG versus DESIGN_MISMATCH remains the canonical issue type. Missing or rejected reasoning must not remove the underlying finding.
