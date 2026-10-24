# Finding Contract

Used by **Map Bug Audit**.

## Audit header

```text
Selected Artifact
Map Version
Evidence Scope = selected-map-version-only
Archive Sources Used = false
```

## Surface accounting

Every discovered gameplay surface must have exactly one record:

```text
Subject
Kind
Status = checked | blocked | not-applicable
Candidate IDs, if any
Reason, required when blocked
```

`accounted` means every **discovered** surface has a record. It does not prove all map mechanics were discovered.

## Candidate

Every candidate records:

```text
Subject IDs
Disposition
Expected Authority = selected-artifact
Evidence
Player Impact
Counter-Evidence
Tester Trigger Ready
Proof Ceiling
Severity, defect only
```

Decision order:

```text
Selected Map Version
→ Gameplay Contract
→ Actual Behavior
→ Contradiction
→ Counter-Evidence
→ Player Impact
→ Tester Trigger
→ Defect
→ Severity
```

## Reportable defect

Requires all of:

- grounded contradiction;
- cleared counter-evidence;
- player-visible impact (`blocking`, `material`, or `limited`);
- tester-verifiable in-game trigger.

Every material finding shown to the operator uses exactly one public status:

- `PROVEN` — contradiction is sufficiently proven and blocking counter-proof is cleared. BUG vs DESIGN_MISMATCH remains in `issueType`. PROVEN findings receive final severity.
- `NEED_VALIDATION` — the finding remains materially plausible but final proof is still missing. It stays visible and must include `validationReason`, `missingProof`, and one exact `validationTest`. It must not receive final severity.

Internal causes such as `runtime-proof-required`, `insufficient-evidence`, `ambiguous-intent`, and `detection-gap` are reasons behind NEED_VALIDATION, not additional public status categories.

A source-proven contradiction with a complete gameplay translation is automatically challenged by bounded counter-proof search. It should become PROVEN whenever the selected-artifact evidence is sufficient; only irreducible missing proof remains NEED_VALIDATION.

Designed behavior, disproved candidates, and proven-normal surfaces remain hidden from the finding list but stay in the audit trace.

## Finding conservation

No material candidate may disappear between discovery, proof, review, and publication.

Every material candidate must end with exactly one explicit disposition:

```text
PROVEN
NEED_VALIDATION
REJECTED_WITH_COUNTERPROOF
SUPERSEDED_BY:<finding-id>
INTENTIONALLY_EXCLUDED:<non-gameplay reason>
```

Rules:

- `REJECTED_WITH_COUNTERPROOF` requires concrete selected-artifact counter-evidence.
- `SUPERSEDED_BY` requires the surviving finding ID and must not erase distinct player impact.
- `INTENTIONALLY_EXCLUDED` is only for non-gameplay/release-health residue; it must retain the reason and may not hide a plausible material gameplay consequence.
- approval filtering is not a disposition and must never delete a finding silently;
- runtime-proof-required material findings remain `NEED_VALIDATION` with one exact test;
- deprecated/stale/release residue remains visible in audit trace and is promoted only when a selected-artifact gameplay consequence is grounded.

Before REPORT is ready, reconcile:

```text
all material candidates
=
visible PROVEN
+ visible NEED_VALIDATION
+ explicit rejected/superseded/excluded dispositions
```

Any unmatched material candidate is a conservation violation and blocks finalization.

## Delivery-state proof

Configuration or declaration is never sufficient proof that a gameplay dependency is delivered. For every material resource/capability, trace the applicable states:

```text
declared
→ materialized
→ active
→ owned
→ simulated
→ completed/released
```

Examples include ticking areas, spawned entities, structures, kit stations, objectives, queues, timers, and cleanup resources. A missing transition must become a causal finding or an explicit proof obligation; it must not be treated as normal merely because configuration exists.
