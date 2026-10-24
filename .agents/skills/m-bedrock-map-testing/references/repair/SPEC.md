# Target Repair Specification

## Entry

Bug repair requires:

```text
Approved Bug
+ violated selected-version Gameplay Contract
+ Repair Contract
  - Must Change
  - Must Preserve
```

Intentional modification is separate and requires explicit user approval of the behavior change.

## Scope

In scope:
- exact repair owner;
- bounded PatchTransaction;
- stale-state protection / rollback;
- defect verification;
- preservation verification;
- explicit runtime residue.

Out of scope:
- inventing expected gameplay;
- changing behavior outside the approved request;
- mutating the original artifact;
- detector development;
- unrelated cleanup.

## Acceptance

- Must Change maps to the Approved Bug;
- Must Preserve maps to the selected-version Gameplay Contract;
- patch scope is the smallest complete owner;
- original artifact remains immutable;
- defect and preservation checks are rerun;
- proof level is not overstated.

Symptom removal without gameplay preservation is not completion.