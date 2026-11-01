---
id: document.system.project-lifecycle
class: DOCUMENT
domain: system
role: CONTRACT
authority: CANONICAL
lifecycle: ACTIVE
---

# Project Lifecycle and Publication

## Authority

Project identity, current version, and exact Drive binding belong to `workspace/projects/<project-id>/project.json`. There is no global project registry.

The legacy TypeScript publication flow must update that existing per-project file rather than creating `workspace/project-registry.json`. It may hydrate omitted fields from an existing single-level record without altering the selected world identity. A multi-level record requires explicit level-scoped routing; until that adapter exists the legacy publication flow must fail closed rather than flatten levels or create another project owner. See [Workspace](../../workspace/README.md) for the canonical single-level and multi-level directory contracts.

| Concern | Canonical owner |
|---|---|
| Project identity, current version, Drive artifact binding | `workspace/projects/<project-id>/project.json` |
| Current confirmed approved bugs | Project or level `report/bug-report.json` |
| Current Developer Notes | Matching `report/developer-notes.json`, only when notes exist |
| Human-facing report and structured export | Matching `output/bug-tracker.html` and `output/bug-tracker.json` (derived) |
| Historical retained versions | Matching `archive/vX.Y.Z/`, only when intentionally retained |
| Selected-map audit execution state | `SelectedMapAuditRun`; not derived HTML or a global report ledger |
| Historical approved issue incidents | `engine/reliability/catalogs/regressions.json` |
| Reusable failure patterns | `engine/reliability/catalogs/failure-patterns.json` |
| Per-map reliability knowledge | `engine/reliability/catalogs/map-knowledge/` |
| Approved map/source delivery | Version-bound Google Drive destination |

## One project, one scope

A single independently versioned map uses the shallow project `report/`, `output/`, and optional `archive/` directories. Multi-level games keep one `project.json` with each independently versioned map in `levels/<level-id>/`. Do not flatten levels, invent a global report path, or create empty optional folders.

`project.json` is the current identity/Drive binding. It does not become a duplicate Bug Report, audit finding store, or activity log. Current reports are not authoritative for older map versions. Replacing the selected artifact requires a new full audit and version-bound reconciliation.

## Audit, approval, and publication

```text
exact current selected map
→ canonical SelectedMapAuditRun / Map Audit Report
→ explicit review of proven BUG items
→ approved Bug Report V2 under the matching project/level report/
→ validated Bug Tracker document
→ matching HTML + JSON projections under output/
→ separately authorized publication to bound Drive destination
```

Map Audit Report includes `PROVEN` and `NEED_VALIDATION` for both `BUG` and `DESIGN_MISMATCH`; Approved Bug Report V2 is only the approved proven BUG subset. Developer Notes remain separate. Neither HTML nor its JSON projection is a second persisted issue authority.

Approval must be explicit. An audit finding alone cannot authorize repair. Correcting a bug requires approved repair authority and preservation proof before marking it fixed; an intentional design change requires its own approval.

A portable HTML tester save records tester interaction only; it must not overwrite canonical report state. Publication projections are regenerated from canonical inputs and must preserve issue IDs. The matching Drive destination is resolved through the project binding, not an invented global folder ledger.

## Durable evidence and continuity

Historical issue evidence may be projected into the existing reliability catalog only after approved/current-version admission. It is search pressure for later maps, not current gameplay proof. Keep operational continuity in the actual owning project and existing work-session contracts only when execution genuinely persists them; do not invent `workspace/project-registry.json`, global report files, session ledgers, or publication snapshots as prerequisites.

For exact publication contracts see [Bug Report Ownership](./bug-report-ownership.md), [Bug Tracker UI](./bug-tracker-ui.md), and [Drive Storage](./drive-storage.md). For the production audit flow see [Master Selected-Map Audit Workflow](../analysis/master-selected-map-audit-workflow.md).

## STOP

Stop after the requested report, authorized repair, or publication outcome is saved to its canonical owner with proportionate proof. Unresolved runtime behavior stays an explicit proof boundary; it does not justify another state store or parallel workflow.
