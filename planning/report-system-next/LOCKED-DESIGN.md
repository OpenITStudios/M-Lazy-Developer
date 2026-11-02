# Report System Next — LOCKED DESIGN 1.7.0

## 0. Ownership and scope

This is an isolated **new reporting system proposal**, with its own prospective output contract `m-lazy-report-next/v1`. The old Approved Bug Report V2, prior HTML renderers, old JSON schemas, old project snapshots and repair/audit workflows are not development targets here.

The human specification in this file and machine lock in `layout.lock.json` are **one agreed design**; the JSON lock is the mechanically inspectable list of identities/ordering/tokens. Conflicts halt implementation and require a design decision, not creative interpretation by the assistant. Changes to either design artifact after acceptance require a new version and explicit user approval.

## 1. Product objective

One standalone offline HTML file can be opened by a tester, used to inspect findings, enter tester results, notes and screenshot evidence, saved as a NEW portable HTML file, and sent to a developer. The same canonical report has one structured JSON projection. The developer sees the full source evidence and technical repair guidance without requiring additional software or network access.

The app must never silently mutate canonical issue facts from tester inputs. There is no server, database, login, external runtime script, or background autosync required.

## 2. Fixed hierarchy

For a **Map Report**, the ordered HTML structure is:

1. Report Header — **Bug Tracker Report**; design version; primary Save as HTML at the top.
2. Artifact Identity — name, edition, version, fingerprint label, source link if actually available.
3. Overview — total findings, Blocker, Major, Minor, Needs Validation.
4. After-Fix Retest Results — Passed, Failed, Untested, Not Retestable **derived only from eligible tester entries**.
5. Finding Controls — search; category, severity and retest filters; reset filter; matched-item count.
6. **Bugs** section.
7. **Design Mismatches** section.
8. **Developer Notes** section.
9. Footer — report provenance, contract version, summary of source proof limitations.

Empty finding groups are omitted but **never reordered**. Combined reports reuse the same order for each map and add a map navigation index; no alternate layout is improvised.

Finding card *collapsed*: sequential display number (cosmetic), severity (if applicable), evidence level, tester result if eligible, short title, concise problem, canonical finding ID.

Finding card *expanded*: authored rationale and impact if present, source-backed Test In-Game if available, two-column Expected / Observed-Evidence (stack on mobile), tester result if eligible, notes and screenshots, collapsed Technical Details containing analysis, relevant original files, recommended fix and Must Preserve. Developer Notes never display gameplay severity or Passed/Failed.

All finding cards default to **collapsed**. The HTML must use explicit labels, keyboard-operable native controls, visible focus styles and accessible live save-status text. Default report width 1080 px, typography and colors are frozen by `layout.lock.json`. No charts, persistent sidebars, decorative widgets or visual experiments in v1.

## 3. Semantics that must never drift

**Evidence level is NOT a Minecraft test result.**

| Canonical field | Meaning |
|---|---|
| `SOURCE_VERIFIED` | Authored source/design evidence was inspected and supports the stated source-level finding; does not prove live Minecraft manifestation |
| `PACKAGE_VERIFIED` | Relevant package/artifact evidence was inspected; still does not by itself mean live gameplay was run |
| `RUNTIME_OBSERVED` | Directly observed runtime behavior with recorded provenance; not an inferred simulation |
| `NEEDS_VALIDATION` | Current evidence is insufficient for the asserted behavior |

A finding is eligible for Passed/Failed **only if** its evidence status is not NEEDS_VALIDATION and its Test In-Game has adequate **source-backed, player-followable** steps, Expected/Observed text and a visible success/failure criterion. This eligibility must be computed; do not persist a second `ready` authority. `Passed`/`Failed` are tester workspace observations **after repair**, not canonical Fixed/Closed. Unready findings still allow notes/evidence, not false retest marks.

`testProcedure: null` explicitly means **no supported guided procedure**. Do not invent Minecraft steps from code symbols. Empty `expected` or `observed` may be `null` for genuinely unknown claims; the UI explains the proof gap rather than presenting empty invented paragraphs.

Every evidence ID in a finding and step must resolve to the `map.evidence[]` of the **same artifact**, and each relevant source path/coordinate may appear only if present in that evidence. `RUNTIME_OBSERVED` requires real runtime evidence; source-only evidence cannot be promoted to runtime by label. A verified defect also needs a supported expected-behavior/design authority; merely observing unfamiliar code is not a bug. These are **cross-reference / semantic validation rules beyond JSON Schema**.

## 4. Exactly two independent data authorities

- **Canonical report JSON** (`report.schema.json`) has approved findings, map identity, fingerprints, evidence and technical claims. It is read-only inside the HTML.
- **Tester workspace JSON** (`tester-workspace.schema.json`) has issue-ID-bound Passed/Failed, notes and image data. It must carry the canonical report digest and may never edit or replace canonical facts.

A Save as HTML snapshot embeds the complete canonical report plus the current tester workspace, including image bytes and captions. Saving starts a browser download but **does not** automatically overwrite the original HTML or guarantee disk completion. Browser autosave is temporary convenience, not an externally transmitted report. After editing, save a new copy to share the latest work.

Open a saved HTML without network: embedded snapshot loads first; only a draft from that exact same copy and artifact can override it in the browser. Failure of browser storage must leave in-memory edits available and clearly instruct the tester to Save as HTML before closing. Reset stores an explicit empty override, so old embedded notes/results never mysteriously return. Load JSON validates schema, digest and issue IDs before replacing data; rejection preserves the current workspace.

Portable HTML/JSON are untrusted input: escape all embedded data in the HTML script context, use textContent for user strings, validate attachment MIME and byte limits, never run arbitrary evidence as code. Provide a warning that saved HTML includes notes/screenshots and should be reviewed before sharing.

## 5. Deterministic, chat-independent rendering

**No AI-authored HTML after data preparation.** A single version-locked renderer owns the output; the assistant may prepare evidence-backed JSON but may not reorder components, rename labels, restyle CSS, or write alternate HTML just because the chat restarted.

Rendering contract:

```text
Verified selected-map evidence + explicit approved findings
    → new canonical Report JSON (schema + semantic checks)
    → deterministic normalization (fixed category/severity/ID order)
    → one renderer from exactly layout.lock.json@1.0.0
    → generated HTML + canonical JSON
    → golden / structural / parity / provenance acceptance
    → recipient's offline tester HTML workflow
```

For identical canonical inputs and layout version: canonical JSON bytes and freshly generated **base HTML bytes** are identical. For canonical JSON, use RFC 8785/JCS canonicalization **after** stable array ordering; timestamps, random IDs, environment-specific values, or model paraphrases must not enter the base HTML. The *saved tester HTML copy* is a snapshot containing mutable tester results, so different saved snapshots are **not** expected to have identical bytes. Preserve canonical digest identity across those saves.

Immutable design-v1 values and labels are in `layout.lock.json`. Golden HTML byte snapshots, visual desktop/mobile baselines, offline reopen, keyboard usability and roundtrip JSON/HTML acceptance are required before declaring the implemented system usable. Cross-browser pixel-perfect identity is not guaranteed; semantic layout, content, functionality and stable baseline are the enforceable goal.

## 6. Change and approval gate

Default for any new ChatGPT session: **READ → PIN → GENERATE ONLY TO THE LOCK**. No quiet `v2`, no new renderer, no optional theme based on taste, no reformat of canonical findings for style. If a genuine design change is requested:

1. Show the differences and why the change is necessary.
2. Obtain explicit user approval to change the locked presentation/data meaning.
3. Bump the design version, adjust JSON contracts only when necessary, retain old version for existing documents, and update golden fixtures.
4. Verify old output remains readable and the new output cannot be confused with an old version.

Never claim that a *Git file alone* technically enforces all of this. The lock is design authority; enforcement will come from the new renderer, schema/semantic validators, golden fixtures and fail-closed checks once implemented.

## 7. Acceptance matrix (not yet executed)

| Dimension | Required |
|---|---|
| Same input + same design version | byte-identical generated HTML and canonical JSON |
| Same report in a new chat | same section order, labels, CSS tokens, computed counts and grouping |
| Missing proof | explicit unknown; never invented reproduction, source line or Fixed |
| Multi-map or multi-level | stable map/level navigation and globally unique IDs |
| Editing by tester | notes, result and images remain in tester workspace, never canonical |
| Save as HTML | download snapshot opens offline on a second device/browser context |
| Browser quota error | work remains in memory; visible warning plus portable save |
| HTML/JSON parity | exact canonical document, artifact identity, issue/evidence references |
| UI usability | keyboard, focus, clear labels, readable widths, mobile layout |
| Change without approval | reject or use existing v1 lock |

**CURRENT PROOF CEILING:** proposed source-controlled design/schema/reference only. New HTML renderer, generated output snapshots, independent schema validator, browser acceptance and Minecraft gameplay have not been implemented or executed.

### Standards basis

- JSON Schema Draft 2020-12 (https://json-schema.org/draft/2020-12)
- RFC 8785 canonical JSON (https://www.rfc-editor.org/rfc/rfc8785.html)
- WCAG 2.2 (https://www.w3.org/TR/WCAG22/)

## Approved 1.1.0 addendum — source integrity and comfortable reading

The original v1.0.0 design and immutable Git blobs remain historical. This approved version extends the same compact layout without changing legacy Bug Tracker or its project outputs.

1. A `NEEDS_VALIDATION` finding MUST have `severity: null`, a written proof gap and one specific next check; proven issues have grounded severity and no pending validation object.
2. Every citation is displayed as an expandable source record with ID, kind, description and locator; source strings are escaped and never run as code.
3. Audit coverage is shown only from a separately supplied same-artifact, referenced record; missing coverage is explicitly **not established**, never reported as complete.
4. The reader continues to see collapsed findings by default, Test In-Game/Expected/Observed/After-Fix results, and separate technical details. Search now includes explanation and validation text; keyboard shortcuts add no permanent UI controls.
5. Offline Save as HTML, tester notes/screenshots, immutable report JSON, and exact digest binding stay unchanged. The v1.1.0 authored report schema changes; tester workspace format remains v1 and older self-contained report HTML snapshots remain readable. No automatic v1 JSON migration is permitted.
6. The original pinned `reference.html` stylesheet remains the visual base; restrained CSS additions improve proof legibility. New layout/schema/example blobs and golden bytes are version-pinned in the implementation.

Earlier sections document the 1.0.0 baseline and its former proof ceiling. Current 1.1.0 source-level implementation is described in `apps/report-system-next/README.md`; full browser acceptance and live selected-map reporting are not yet established.

## Approved 1.2.0 audit-truth integration (2026-11-02)

Source-bound Report Next 1.2.0 is an intentional versioned extension. Original v1 and v1.1 offline HTML copies remain unchanged. All canonical Map Audit V2 BUG and DESIGN_MISMATCH IDs and proof states must remain visible even when source evidence is unresolved. No final severity is inferred from PROVEN or from issue type; severity is null until separately grounded. Missing evidence is explicitly marked REFERENCE_UNRESOLVED, not promoted to actual Minecraft runtime observation. Audit source cues never constitute test procedures.

Unclassified Audit Obligations, validation groups, and blocked/unknown gameplay surfaces belong to the Audit Coverage "Unresolved Checks" disclosure, never BUG or DEV_NOTE. Zero findings plus incomplete source closure is still incomplete. Reporter requires exact matching artifact ID, SHA-256 fingerprint and audit revision, and uses the existing single audit CLI as an opt-in read-only HTML projection. It does not modify canonical Bug Report V2, repair closure, tester results, old project outputs or GitHub CI policy.

Actual browser handoff/Save as HTML, end-to-end execution on a real selected world and gameplay behavior remain NOT EXECUTED.

## Approved 1.3.0 addendum — JSON truth and reader experience

The user's approved improvements establish three allowed report origins: MAP_AUDIT, SOURCE_REVIEW and SYNTHETIC_DEMO. Only genuine canonical Map Audit source may carry auditRevision or be represented as source-audit COMPLETE. Approved Bug Report V2 is outside this renderer and not silently counted as zero.

Canonical PROVEN/NEED_VALIDATION is a proof axis, independent from the evidence tier. A pending source-backed hypothesis may reference inspected source without becoming a confirmed defect. Unresolved proof keeps severity null. Exact source scenario, affected scope, citations, reasoning, and proof navigation remain in the authored JSON; evidence level is shown on demand, not as a duplicate status badge.

Offline HTML keeps one canonical JCS report and a separate tester workspace. Download Report JSON and Save Tester Data must never be confused. Client-side SHA-256 comparison on opening prevents tester edits/export of a mismatched report and must visibly report unavailable crypto rather than claiming a PASS. SHA-256 detects accidental modification; it is not a publisher signature, gameplay test or external certification. Old HTML snapshots remain independent and unaffected.

This is a versioned design/contract change only; executable browser and actual Minecraft audit acceptance remain separate.

## Approved 1.4.0 addendum — desktop-first scope (2026-11-03)

The user explicitly prioritizes desktop over mobile. This decision supersedes historical mobile layout and acceptance rows in sections 2, 5 and 7: **mobile visual approval is no longer required before release**. Keep the existing small-screen CSS fallback, but do not add new mobile layout variants, a mobile reporting application, or a mobile test campaign.

The release-acceptance desktop viewport targets are **1366×768** and **1920×1080**. Approved max report width is **1200px**. Preserve the exact report hierarchy and all canonical material findings; optimize only spacing, desktop metric widths, search accessibility, and progressive disclosure of large missing-proof lists. Status/summary must remain visible even when the full gap list is collapsed. When zero guided retests are eligible, avoid displaying meaningless zero-only tester counters; keep all existing metric IDs available to the client, and explain explicitly that no Minecraft playtest has been performed.

The 1.4.0 schema/layout versions are deliberate. Existing v1.0–v1.3 standalone HTML copies remain readable and unmodified; no automatic old authored JSON migration. Desktop acceptance, keyboard navigation, canonical parity, and offline Save/Reopen are distinct from runSelectedMapAudit() and live Minecraft proof.

## Approved 1.5.0 desktop reading flow (2026-11-03)

The user asked to substantially simplify and clarify HTML reading, not just adjust fonts or colors. The active report flow now has one primary decision path:
**which map and audit source → which proof state and finding counts → which finding → exactly what check or retest should happen → where the backing evidence and tester notes are**.

Rules:
1. Keep map name, version, source proof status and three honest counts visible. Long fingerprints, full coverage evidence, audit obligations, technical call chains and advanced filters remain available in native collapsed details, never omitted from canonical JSON.
2. A collapsed finding must expose the exact canonical issue ID, BUG / DESIGN_MISMATCH / DEV_NOTE, PROVEN / NEED_VALIDATION where applicable, grounded severity if any, one concise explanation and the source-owned next action. Never turn source investigation cues into executed gameplay steps.
3. Expanded layout uses a readable desktop primary narrative column and a visually separate tester-notes panel. Show deciding validation proof or eligible after-fix test first, then Expected vs Recorded evidence and impact. Source IDs, the original locators, technical analysis and Must Preserve are still available on demand.
4. Filter toolbar highlights search, issue kind and proof status. Severity and after-fix retest filters remain in an Advanced disclosure, not a second permanent toolbar. Saved portable HTML must reset all presentation-only filter/disclosure states.
5. Never claim no approved issues because the separate approved ledger is not included; retain coverage PARTIAL/BLOCKED/UNKNOWN without implying a completed whole-world audit. Tester result does not mutate canonical Fixed. All original report data, evidence, unknowns and offline HTML save semantics remain.
6. Versioned layout/source contract is v1.5.0. Older v1.0–v1.4 standalone HTML documents remain readable unchanged. Desktop remains the sole visual acceptance target (1366×768, 1920×1080); mobile has no release gate.

## Approved 1.6.0 report-first problem / cause / verification design (2026-11-03)

Explicit user decision: the HTML must immediately explain **what is wrong, why it can happen, and how someone can verify whether it is a bug**. This supersedes older procedural/dashboard-heavy content ordering. A source conclusion must not be shown as a Minecraft observation.

- Collapsed issue: title, type, honest evidence status, grounded severity if any, concise problem and impact, canonical ID. Do not force a procedural Next Action on the summary.
- Expanded issue: **1. What is the problem?** including Expected vs Recorded (or explicitly Suspected) behavior; **2. Why could it happen?** using only source-backed causal reasoning; **3. How to check it?** showing actual source-owned steps and observable criteria, including clear *supports the issue* and *not reproduced this attempt* interpretations. A single unsuccessful reproduction does not prove absence.
- `auditDetails.reproductionCues` are sourced from current selected-audit `reproduceSteps`. Label them **source-derived, unexecuted guidance**, and NEVER convert them to `testProcedure` or enable Passed/Failed. If a validated player-followable testProcedure exists, show it with the source of authority and distinguish after-fix retest state from initial bug confirmation. Missing steps stay unknown; do not invent gameplay scripts.
- Original source files and evidence IDs are in one technical disclosure. Tester notes/screenshots and any authorized after-fix controls are optional, collapsed separately. Search is immediate; type/proof/severity/retest filters are available only on demand.
- Full audit coverage/unknown checks and original JSON remain intact. The source-only report cannot infer approved ledger counts or mutate canonical Fixed. Preserve design desktop targets 1366×768 and 1920×1080; mobile is not an acceptance gate.

The change is a versioned authored schema/layout 1.6.0; old self-contained HTML versions 1.0–1.5 remain readable, not silently migrated. True source-to-browser acceptance and Minecraft gameplay remain separate test evidence.

## Approved 1.7.0 addendum — approved ledger and initial confirmation (2026-11-03)

Following the reader-centered audit, the user approved source-correct issue provenance and a concrete way to test whether a bug initially reproduces. This remains **one deterministic HTML renderer**, not a combined approval/analysis store.

1. **Authoritative sources stay separate.** `MAP_AUDIT` means a selected-artifact Map Audit projection (possibly partial/unproven). `APPROVED_BUG_REPORT` means an opt-in, read-only rendering of the canonical project `report/bug-report.json` schema `m-bedrock-bug-report/v2`. An approved input requires a pinned 40-hex Git sourceRevision, the original project's exact ID/version/fingerprint, and the same SHA-256 explicitly stated in the approved source ledger. It cannot claim source-audit COMPLETE or independent Minecraft execution. Old Approved Bug Report V2 is unchanged.
2. **Approved issue fields survive.** Report reader preserves the actual issue kind, severity, original open/fixed flag, expected/observed discrepancy, why, impact, reproduction, cited code paths, recommended fix and Must Preserve. Never infer status from a test observation or overwrite canonical approved issues. The projection treats citation-only paths as unresolved until independently inspected; Git revision is a provenance pointer, not publisher authentication.
3. **Verification guidance never fabricates gameplay.** Author-authored reproduction steps are usable **source guidance** to attempt; they do not independently prove the trigger is reachable, game behavior happened, or a fix passed. If prerequisites are unreachable or the decisive observation cannot be made, the attempt is Blocked. Not Reproduced on one attempt does not disprove the issue. Missing steps remain unknown, not populated by invented gameplay instructions.
4. **Initial observation is independent of after-fix QA.** Tester workspace v2 stores a per-issue nullable `confirmation`: REPRODUCED, NOT_REPRODUCED, BLOCKED. This is *tester's observation only*. Optional after-fix `result` stays PASSED/FAILED/null only for source-eligible guided retests and never changes the issue Fixed owner. Neither grants runtime PROVEN to the immutable source report.
5. **Reader remains report-first.** Approved reader shows only the approved count and open/fixed counts, not a misleading Map Audit progress dashboard. On a card, start with what/why/how, keep author source notes and repair guidance in details, and place both tester actions under one optional disclosure.
6. **Versioning and desktop QA.** Contract/schema/layout are 1.7.0, tester workspace schema is v2. Older exported v1.0–v1.6 self-contained HTML is never rewritten or silently migrated; old workspace v1 import is rejected in the new reader. Desktop 1366×768 and 1920×1080 only. Real file:// Chromium and Minecraft gameplay proof must be separately observed, not inferred from authored tests.

**Export identity:** the approved ledger report must be distinguishable from the independent Map Audit report even when they describe the same selected map/version; approved output filenames use an `-Approved` suffix. An unverified edition is omitted from the main header rather than represented as a meaningful gameplay claim.

## Reader acceptance from exact selected artifact (2026-11-03)

The approved seven-issue Defense Challenge v1.1.3 case, at selected-world SHA-256 `14a0dcb7354a69edb9d83c0f8c1e9fd160c29238011aeb817bcdaf31c098fced`, is the source-grounded reader acceptance challenge. The file `defense-v1.1.3-reader-acceptance.md` describes setup, deciding observations, evidence needs, and Blocked gates. This is intentionally **outside** the generic v1.7.0 report schema; it adds no new template fields, issue status owners, approval records, or gameplay claims.

The inspected world has debug-spawn disabled, so that command must never be presented as an ordinary tester shortcut. Score provenance, flag radius, and retry policy mismatches can be checked in source; player-facing behavior needs actual observation and, in some cases, instrumented conditions. Real production HTML Chromium Save/Reopen and native Minecraft execution remain separately unverified.
