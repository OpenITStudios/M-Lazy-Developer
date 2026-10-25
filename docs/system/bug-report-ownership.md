---
id: document.system.bug-report-ownership
class: DOCUMENT
domain: system
role: CONTRACT
authority: CANONICAL
lifecycle: ACTIVE
---

# Bug Report Ownership

M-Bedrock separates **audit truth** from the **approved bug ledger**. They are different scopes, not competing authorities.

## Core rule

```text
SelectedMapAuditRun / Map Audit Report
→ complete material finding truth
   (PROVEN + NEED_VALIDATION, BUG + DESIGN_MISMATCH)

approved PROVEN BUG subset
→ canonical Bug Report V2 persisted state
→ multiple read/export surfaces
```

There is one authority per scope. Bug Report V2 must never be treated as proof that unresolved audit findings do not exist.

Developer Notes are a third publication lane with separate authority: project/level `report/developer-notes.json` owns concrete developer/release notes admitted under `docs/analysis/developer-note-coverage.md`. DEV NOTE is not BUG, not DESIGN_MISMATCH, has no gameplay severity, and must never be used as a fallback for NEED_VALIDATION.

Physical placement does not create ownership. A copy, preview, export, spreadsheet, PDF, or external QA note is not authoritative merely because it contains bug information.

### Isolated Report System Next boundary

`apps/report-system-next/` is a separately design-locked **renderer source**, not a new current-map gameplay authority, an approved-BUG state owner, or the current Bug Report V2 publisher. It requires independently supplied, evidence-bound `m-lazy-report-next/v1` input and has no authorized production replacement/migration for `workspace/projects/*/output/` or the existing Bug Tracker. Its offline tester workspace is distinct user-edited presentation state; Passed/Failed, notes, and screenshot attachments do not directly mutate `SelectedMapAuditRun`, `report/bug-report.json`, or repair completion.

A future production connection must first trace exact Map Audit/approved-report producer → new-schema mapping → evidence and approval preservation → renderer consumer, then explicitly decide migration/version semantics. Until such integration is authorized and proved, preserve both established output authorities and do not describe the isolated renderer as the default report flow.

## Authorities

| Concern | Canonical owner |
|---|---|
| Complete selected-map audit finding truth | `SelectedMapAuditRun` / Map Audit Report projection |
| Approved bug semantics and lifecycle | `engine/packages/bug-report/` |
| Developer/release note state | project/level `report/developer-notes.json` + `docs/analysis/developer-note-coverage.md` admission contract |
| Persisted schema | `engine/schemas/bug-report/v2.schema.json` |
| Current canonical bug-report state | project/level `report/bug-report.json` |
| Human-facing published report | derived self-contained HTML snapshot |
| Optional report viewer source | `apps/bug-report-ui/` projection only |
| Revision history | Git history |
| Approved historical issue incidents | `engine/reliability/catalogs/regressions.json` (derived/search knowledge, not current bug authority) |
| Map binary/source artifacts | Google Drive |
| Incoming/legacy QA material | import/reference only |

## Current-version-first policy

The active recording lane is the latest/current map version being worked on.

Rules:

1. Create or maintain canonical Bug Report V2 only for the current audited map version.
2. Do not backfill old versions merely to make history look complete.
3. If an older version has no trustworthy bug record, leave it missing.
4. Never infer historical bugs from a newer report.
5. Never copy current bugs backward into old versions.
6. Historical QA files may be read as evidence or migration input only when they materially help current work.
7. Missing historical data is an accepted state, not a repair task.

This is an efficiency and integrity rule: unknown history stays unknown.

### Full recheck before current-version publication

When the current map version changes, the canonical Bug Report must not be refreshed from historical issue comparison alone.

The upstream audit must first satisfy the [Master Selected-Map Audit Workflow](../analysis/master-selected-map-audit-workflow.md) new-version full-recheck gate and the [Bug-Finding Coverage System](../analysis/bug-finding-coverage.md) version-transition coverage rule.

```text
new map version
→ full selected-artifact audit
→ complete current-version finding set
→ approval/reconciliation
→ canonical Bug Report V2
→ HTML + JSON publication
```

A historical-finding-only revalidation may update search knowledge, but it is insufficient evidence for report completeness and must not authorize final publication for the new version.


## Canonical lifecycle

```text
selected-map audit
→ Map Audit Report
   ├─ PROVEN BUG
   ├─ PROVEN DESIGN_MISMATCH
   ├─ NEED_VALIDATION BUG
   └─ NEED_VALIDATION DESIGN_MISMATCH
→ approved PROVEN BUG subset
→ Proposed Bug Set / review
→ Approved Bug Set
→ canonical Bug Report V2
→ repair / verification
→ canonical update
→ derived HTML + structured JSON output
```

Only explicitly approved, current-version defects enter canonical report state.

## Storage roles

### Canonical JSON

`workspace/projects/<project-id>/report/bug-report.json` for single-level projects, or `workspace/projects/<project-id>/levels/<level>/report/bug-report.json` for multi-level projects

- machine-readable;
- schema validated;
- Git tracked;
- current state authority;
- writable only through the canonical bug-report workflow.

### Bug Report Viewer Source

The optional report viewer is a read-only client/projection of canonical Bug Report V2, not the M-Lazy-Developer map-checking workflow.

It may:
- load canonical reports;
- present derived views;
- export JSON;
- inspect compatible external material as non-canonical input.

It must not:
- own a separate bug database;
- keep independent bug status;
- redefine severity, identity, readiness, or completion semantics;
- treat local UI state or imported files as persisted authority;
- create a new canonical report from imported material.

### Google Drive

Drive stores map artifacts and optional published human-facing bug-report snapshots.

A published HTML snapshot is:
- derived from the authoritative source for its scope: `SelectedMapAuditRun.mapAuditReport` for Map Audit Report, or canonical Bug Report V2 JSON for the approved bug ledger;
- a communication snapshot;
- allowed to contain presentation-only Fixed checkboxes for retest;
- not editable canonical state;
- never imported back as authoritative state.

Checking a box in HTML/Markdown does not set `fixed: true`, approve a bug, or update canonical workflow state.

Do not persist a second canonical JSON copy in Drive.

### Legacy and external QA

Legacy spreadsheets, PDFs, client sheets, chats, screenshots, and tester notes are sources/evidence only.

They may contribute to a current confirmed defect, but they do not update canonical state directly.

Do not maintain old QA spreadsheets as parallel live trackers.

## Identity

Bug identity must be stable within one map lineage.

The canonical engine derives Bug ID from map identity plus semantic defect identity. Adding an unrelated defect must not renumber existing defects.

A bug observed again in a newer build keeps its semantic identity when it is the same defect. A materially different defect receives a different identity.

Do not invent historical identities for legacy records that cannot be grounded reliably.

## Refresh and reconciliation

A repeated audit of the same current map version does not replace canonical state blindly.

```text
existing canonical report
+ refreshed confirmed-defect projection
→ reconcileCanonicalBugReport()
→ canonical current-version report
```

Reconciliation preserves existing completion state, retains omitted known bugs, opens newly discovered bugs, and rejects cross-version merges or obvious stable-ID semantic conflicts.

Absence from a later scan is not proof that a bug never existed or is fixed.

The selected map's **release version** is `mapVersion`; `testedVersion` is a testing-context field (it may hold an Education client version or a documented audit scope), not the map release version. Production review must not reject a correct map solely because these distinct values differ. When reconciling an existing current-version report, require the same Drive artifact URL, base-version context and tested-version/scope before retaining previously recorded `fixed` states. A change in one of those identifiers requires an explicit new review/reconciliation decision rather than silently carrying closure into another source or test scope.

## Completion

`fixed: true` is canonical only after the orchestrator closes a repair through `completeBugReportFromClosedRepair()` with matching repair and preservation proof. New report creation always starts bugs open, and generic reconciliation preserves existing completion state without creating a new completion decision.

Intermediate workflow labels such as "in progress", "ready for retest", or "reopened" are not persisted unless a proven product need later justifies a schema change.

## Historical knowledge boundary

Canonical current-version Bug Report V2 may feed durable issue history after project readiness:

```text
approved/current Bug Report V2
→ orchestrator historical projection
→ reliability regression catalog
```

The regression catalog is not another live bug database. It exists so future audits can ask what failed before, on which map/version, and which systems deserve earlier scrutiny.

A later/current audit must still prove every issue from its selected artifact.

Project registry stores only regression IDs/references; it does not copy the regression narrative.

## Publication boundary

```text
approved bug set
→ canonical JSON
→ validated projection
→ validated human HTML + complete structured JSON
→ optional publication
```

Publication is one-way. HTML edits never flow back into canonical state.

## Review boundary

Normal user-facing bug-report production is discussion-first.

- Proposed Bug Set is derived and temporary, not another persisted database.
- Every proposed Blocker/Major requires an explicit chat decision.
- `needs-discussion` blocks publication.
- Rejected items never enter Bug Report V2.
- If no items are approved, stop without generating HTML.
- HTML is generated once from the approved canonical report, not repeatedly during discussion.

## Non-goals

Do not add, without a proven need:

- a second report database;
- event sourcing;
- activity feeds;
- project-management boards;
- duplicate Markdown reports;
- Drive-side JSON mirrors;
- historical backfill jobs;
- speculative bug reconstruction.

The system optimizes for trustworthy current-version recording, low ambiguity, and minimal duplicated state.

## Presentation contract

Approved Bug Report V2 presentation does not own new gameplay facts.

Canonical HTML presentation, Map Report / Combined Report scope, tester interaction, Save behavior, lane order, and UI vocabulary are owned by [Bug Tracker UI](./bug-tracker-ui.md).

The renderer may omit absent optional information, but it must not infer or invent missing report content.
