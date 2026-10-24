# Production Bug Report Contract

Canonical report semantics are owned by:

- `../../../../docs/analysis/gameplay-bug-report-v2.md`
- `../../../../docs/analysis/map-audit-report-v2-schema.md`
- `../../../../docs/analysis/developer-note-coverage.md`
- `../../../schemas/map-audit-output-v2.schema.json`
- `../../../../docs/system/bug-report-ownership.md`

HTML presentation has two scopes:

- Map Audit Report (audit finding truth, including unresolved material findings) → `../../../../tooling/bug-report-documents/render.ts`
- Published Golden Bug Tracker → Approved Bug Report V2 + Project Registry + canonical `workspace/developer-notes.json` → `../../../../tooling/bug-report-documents/tracker/`

The published Golden Bug Tracker has three parallel lanes:

1. **BUGS**
2. **DESIGN MISMATCHES**
3. **DEV NOTES**

DEV NOTE is not a gameplay finding type and has no gameplay severity. It is admitted only by the canonical Developer Note contract. It must never absorb generic NEED_VALIDATION or duplicate an existing BUG/DESIGN_MISMATCH root cause.

The Map Audit renderer must preserve audit truth; the Golden Bug Tracker must remain a reader-first publication projection and must not dump internal audit control, closure bookkeeping, proof graphs, or discovery residue.

## Skill rule

Do not redefine the report shape here. Follow the canonical files above so the skill, schema, documentation, developer-note authority, and rendered report cannot drift.

Tester-facing reproduction remains player/world language. Technical implementation details belong in Evidence / Technical Analysis. Developer Notes use Developer Note → Evidence → Action and remain separate from gameplay severity and fixed/retest state.
