# Report System Next — Locked Design Entry

**Work mode:** Isolated reporting source development. This directory is a proposed, isolated reporting product contract, **not** an implementation of the older Bug Tracker and not a claim that a new report application runs.

**Design version:** `1.1.0` — **approved report UX and proof-integrity revision**. Earlier v1.0.0 locked blobs remain the historical design baseline; self-contained old HTML remains readable. The immutable Git commit that first adds this pack, plus the verified blob identity below, is the baseline. New chats must not freely redesign it.

## Start a new chat here

Use this exact directory as the source of design continuity:

`https://github.com/MIVUBI-STD/M-Lazy-Developer/tree/Local/planning/report-system-next`

Suggested instruction: **"Lanjutkan pengembangan Report System Next menggunakan LOCKED-DESIGN.md dan layout.lock.json versi 1.0.0. Dilarang mengubah sistem report lama, urutan UI, label, schema, atau palet tanpa persetujuan eksplisit saya. Pin GitHub Local HEAD sebelum bekerja."**

## Read order

1. [LOCKED-DESIGN.md](./LOCKED-DESIGN.md) — human product and acceptance rules.
2. [layout.lock.json](./layout.lock.json) — machine-readable identity, layout, labels, colors, ordering, workflow, and acceptance.
3. [report.schema.json](./report.schema.json) — **new** canonical report contract (JSON Schema Draft 2020-12).
4. [tester-workspace.schema.json](./tester-workspace.schema.json) — user-entered tester observations, separate from source facts.
5. [example.report.json](./example.report.json) — deliberately **synthetic** example, not a real Minecraft audit.
6. [reference.html](./reference.html) — static **design reference**, not a working test form, HTML publisher, or generated production report.

### Pinned baseline identities

The initial `layout.lock.json` content is Git blob `c958b33054722c2884e791e5b4e811a7987d394d`. The new report JSON Schema is `cbc64bba748da661f2ec8f32a4af01a3c43e6230`. The tester workspace JSON Schema is `78cf4ae0abc9e5d3f468a47c34c4e031e21783ce`. The static design reference HTML is Git blob `2cce615368348cae8d77137867442f3f793fa584`. These immutable blob identities allow a future session to compare the design against the original, even if `Local` moves. Any intended design revision must be approved and assigned a new design version, not silently edited.

## What the design lock means

- **Locked now:** source-controlled layout, vocabulary, color/spacing tokens, report/workspace data contracts, ordering, meaning of statuses, and acceptance requirements. A new chat must read these files instead of inventing another style.
- **Not yet guaranteed:** exact rendered HTML, in-browser save, cross-browser pixels, or live integration. Those require the new deterministic renderer plus executable golden/visual/behavior tests. Merely saving documents to GitHub does **not** prove production enforcement.
- **Data can differ:** map identity, approved findings, cited evidence, observations, tester results and screenshots. The template may not change based on chat or model preference.
- **Old system remains untouched:** no changes to existing `tooling/bug-report-documents/`, `engine/packages/bug-report/`, old `docs/system/bug-tracker-ui.md`, `workspace/projects/*/output/`, or legacy schemas. No regeneration/migration unless separately authorized.
- **No source facts invented:** unknown data stays unknown; evidence authority, tester actions and repair closure remain separate.

## Next independent construction milestone

Implement **a new renderer in its own module/namespace** consuming only `report.schema.json`-valid inputs, producing identical canonical JSON and generated HTML for identical inputs under the same lock, then test against a golden output and `reference.html`. Do not point it at existing report files or rewrite old components during the design phase.

**State:** DESIGN LOCKED / SOURCE BUILD; **new isolated renderer source authored** under [apps/report-system-next/](../../apps/report-system-next/). Browser acceptance, live Minecraft and full repository execution are not yet established. The locked layout/schema/reference files are unchanged.

## Implementation route (for subsequent chats)

- Do not manually regenerate report HTML using the language model. Use the single new renderer `apps/report-system-next/render.mjs` after supplying a genuinely evidence-backed `m-lazy-report-next/v1` document.
- The separately authored `apps/report-system-next/client.js` is included in the generated HTML for portable tester interaction.
- Check `apps/report-system-next/golden.json` and `render.test.mjs` before treating visual or JSON changes as authorized. A changed golden output without a bumped, approved design version is a regression, not a cosmetic improvement.
- **Never** route the new system through the old `tooling/bug-report-documents/` or previous project's output folders.
- Any future design revision must retain the original immutable Git blob IDs and obtain explicit user approval for a new design version.

**Current acceptance limit:** isolated source/JS checks and golden baseline authoring do not prove a packaged application or real-browser Save as HTML → reopen behavior.

## Authorized 1.1.0 change (2026-11-02)

- Unproven findings have no final severity, and must describe exactly why evidence is insufficient and what check is next.
- Source evidence is readable on demand and coverage stays explicitly unknown unless independently supplied with same-map references.
- Compact report navigation, search and offline handoff are preserved. No migration or replacement of Approved Bug Report V2 or current project outputs is authorized.
- Current 1.1.0 layout Git blob: `01b700ffcaab61db6cdea17eb6171a36803f524e`; report schema blob: `7d5da39cccee8e4a989b3d03b9628478ac0a348e`. Historical original blobs above remain valid **for v1.0.0**, not the current version.
- The isolated renderer is not an integrated `SelectedMapAuditRun` publisher; that source-to-report mapping requires separate, verified implementation.

## 1.3.0 source/HTML integrity revision (2026-11-02)

Current Report Next design version is **1.3.0**. Source-aligned authored reports distinguish MAP_AUDIT, SOURCE_REVIEW and SYNTHETIC_DEMO; the only accepted MAP_AUDIT has an exact audit revision. The previous 1.0.0/1.1.0/1.2.0 locks above remain historical references, not active schema authority. Old offline HTML is untouched. The single renderer now distinguishes canonical JSON from tester state and verifies the embedded canonical JSON digest at browser open. No Approved Bug Report V2 conversion or migration is implied.

## Desktop-first acceptance scope — Report Next 1.4.0 (2026-11-03)

Desktop-only user priority: 1366×768 and 1920×1080. The original responsive CSS is retained, but mobile visual acceptance is no longer a release gate. This remains one versioned renderer, not a second desktop app. Canonical proof/evidence, approved Bug Report V2 ownership, and tester state are unchanged.

## Report Next v1.5.0 — desktop reader simplification

Approved user intent: prioritize immediate readability and actionability over dense reporting metadata. The one existing renderer now owns the desktop-first flow and folded evidence/technical views. The JSON data authority, Map Audit V2 adapter, approved Bug Report V2 and offline tester state remain unchanged. Desktop visual checks should confirm a readable first finding without hidden proof, source confusion or a new mobile acceptance requirement.

## Report Next v1.6.0 — explanation and confirmation without procedural clutter

The approved reader now communicates each issue with problem, source-based cause, and a check path with an expected-versus-reported outcome. Reproduction cues from SelectedMapAuditRun are clearly marked unexecuted and never become a trusted guided Test In-Game or a canonical bug closure. The report-first HTML retains original evidence, approved bug ledger separation and offline tester integrity while moving optional controls off the main reading flow.

## 1.7.0 reader trust and initial verification

Approved Bug Report V2 can now be projected read-only via its own opt-in source adapter; Map Audit keeps its independent source and proof. Both feed the same renderer. Initial bug reproduction is captured only as tester workspace v2 data, separate from approved Fixed and after-fix Passed/Failed. Source reproduction steps are displayed, not certified as run. Negative identity and newly supplied source-bound reader acceptance are part of the bounded verification scope, with remaining desktop browser and Minecraft runtime proof explicitly separate.

## New-map reader verification

Any reader acceptance uses newly selected source and evidence, not retired map issues, previous test verdicts, or old reports.
