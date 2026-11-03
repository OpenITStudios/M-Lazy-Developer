# Bug Report

This package owns canonical Bug Report V2 semantics, approval projection, severity/reportability, tester readiness, repair completion state, and human-facing report projections.

## Normal flow

```text
Confirmed Defect
→ Tester Readiness
→ Proposed Issue Set
→ Chat Approval
→ Approved Issue Set
→ Bug Report V2
→ preview / HTML
```

`Confirmed Defect` is evidence state. `Approved Bug` is workflow authority. They are not interchangeable.

## Canonical owners

| Concern | Owner |
|---|---|
| V2 data semantics | `v2.ts` + schema |
| Admission / severity | `decision.ts` |
| Proposed → Approved review | `review.ts` |
| Tester readiness | `report-readiness.ts` |
| Trigger authoring | `bug-trigger.ts` |
| Copy quality | `COPY.md` + `copy-quality.ts` |
| Preview | `PREVIEW.md` + preview code |
| Client document | `DOCUMENT.md` + `src/document/` |
| Completion/fixed state | repair closure bridge |

## Rules

- normal user-facing creation is approval-gated;
- only Blocker/Major are shown by default;
- Issue describes player impact, not implementation mechanism;
- Issue type is explicit when needed: `BUG` or `DESIGN_MISMATCH`; legacy V2 entries without `issueType` are read as `BUG`.
- every visible bug needs an in-game trigger;
- technical diagnostics do not become report copy automatically;
- Severity, Category, Bug ID, and Fixed state remain engine-owned;
- imported/legacy reports are compatibility/reference input, not parallel authority;
- HTML/preview are derived projections, never canonical state.

## Optional Bug Trigger provenance in V2 JSON

Approved Bug Report V2 may persist `reproductionProvenance` alongside
`reproduction`. It records the original, evidence-bound Bug Trigger
`gameplayBasis` and the source evidence IDs for the starting condition,
each player action, and observable failure. The existing authoring compiler
and confirmed-defect evidence gate own those links; they are **source
references, not a Minecraft playtest result or after-fix verification**.

This field is optional: existing V2 reports without it remain valid.
Grouped defects retain it only when the approved canonical reproduction
steps and original cited provenance match; otherwise it is omitted instead
of reconstructed. The Report Next v1.7 approved projection exposes
the cited IDs as `REFERENCE_UNRESOLVED` evidence, keeps
`testProcedure: null`, and cannot change canonical `fixed` state.
No legacy issue is backfilled with invented evidence.

## Creation boundary

`createBugReportV2()` and direct confirmed-defect projection are low-level primitives. Normal audit publication uses `buildBugReportFromApprovedBugSet()`.

If all proposed bugs are rejected, no report artifact is generated.

## Repair boundary

Bug Report V2 records approved issue state. Repair authorization is owned by the repair workflow:

```text
Approved Bug
+ Repair Contract
→ repair
→ verified closure
→ fixed: true
```

Generic save/reconcile/import cannot set a bug fixed.

## Compatibility

V1 is import-only. New reports use V2.

Workflow terminology is owned by `docs/product/flow.md`. Storage/publication ownership is defined in `docs/system/bug-report-ownership.md`.