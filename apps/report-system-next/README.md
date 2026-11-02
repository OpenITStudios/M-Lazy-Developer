# Report System Next — New Isolated Renderer (Implementation Source)

**Implementation scope:** versioned, independent reporting surface (reader UX and proof integrity). It does **not** import, update, regenerate or replace the old Bug Tracker, Approved Bug Report V2, existing `workspace/projects/*/output/`, or its canonical source.

**Design authority:** [planning/report-system-next/](../../planning/report-system-next/). Current layout **1.6.0** is pinned to Git blob `7eb8ac2d721bc1126a91daf09e8dc75195a1bbb6`. The original v1.0.0 baseline blob `c958b33054722c2884e791e5b4e811a7987d394d` remains in Git history. The original reference HTML and both JSON Schemas are also pinned to their approved blob identities in `render.mjs`. If any locked input changes without a new authorized version, the renderer refuses generation.

## Existing new-only files

- `contract.mjs`: validates the exact new report and workspace schema shape (current JSON Schema Draft 2020-12 vocabulary used by these two schemas), enforces evidence references and proof levels, canonicalizes JSON by ECMAScript/JCS ordering, and derives retest eligibility.
- `render.mjs`: **the only new canonical HTML generator**. Reads the approved lock, schemas, and static CSS from the immutable reference. Normalizes finding order, emits exact report JSON and self-contained HTML (embedded CSS, JS and canonical source). It imports nothing from the old reporting package.
- `client.js`: embedded offline interaction for tester results, notes, screenshots, filtering, browser autosave, Save as HTML, Save JSON, Load JSON and Reset. It cannot rewrite canonical report JSON. File downloads are initiated, but browser save completion cannot be proven by JavaScript.
- `render.test.mjs`: focused built-in Node regression specifications for deterministic generation, schema/provenance rejection, offline script parsing, and combined-map normalization. Tests are evidence only if executed, not merely committed.
- `golden.json`: the locked SHA-256 baseline of the synthetic example output HTML and JCS JSON. Any later renderer/style/script change that modifies the output bytes must be reviewed against the versioned design instead of silently replacing this baseline.
- `client.acceptance.test.mjs`: isolated browser-DOM interaction harness using only built-in Node modules. Exercises Passed/Failed, screenshot/caption, Save as HTML embedded tester snapshot, saved-file reopen with independent storage, Reset recovery, malformed JSON import, quota-error fallback, and unverified-issue admission. **This is not a real Chromium/browser run.**

## API contract

```js
import { renderReportNext } from "./apps/report-system-next/render.mjs";

const output = await renderReportNext(newCanonicalReport);
// output.html — newly generated, self-contained HTML bytes
// output.json — stable canonical report JSON (RFC 8785/JCS-shaped)
// output.digest — sha256 of output.json
// output.report — normalized canonical input, never tester state
```

**No migration/legacy adapter** and no second CLI/runner. An authorized caller must supply a new `m-lazy-report-next/v1` document with actual artifact identity, approved source-backed findings and exact evidence IDs. Incomplete claims stay `NEEDS_VALIDATION`; do not make up gameplay steps to enable Passed/Failed.

**Runtime witness boundary:** Any `LIVE_MINECRAFT` evidence is rejected by default, even if no finding references it. A trusted importer with independent runtime provenance may call `renderReportNext(report, { authorizeRuntimeEvidence })`, providing a synchronous callback that returns the literal boolean `true` only for a reviewed witness identified by its map ID, artifact ID, fingerprint and evidence object. Missing authorization, `false`, and truthy nonboolean values all fail closed. The callback is a trust boundary: the renderer does **not** inspect Minecraft, authenticate the caller, or make fabricated evidence real. A blindly permissive callback is not valid verification. The synthetic test callback proves this API path only, not a live game run. No design lock, schema, old report, or golden output is changed.

The renderer outputs two data authorities: immutable canonical report and separate tester workspace. A saved offline HTML copy contains both; browser autosave is convenience, not proof the downloaded file is current. Edited copies must be saved again and checked before sharing.

## Portable HTML baseline normalization

Saving the **tester handoff copy** resets presentation-only HTML state: previously open finding/map disclosures are closed, search and severity/result/kind controls default to All, no-matches guidance is hidden, and an old browser-storage warning is replaced by a loading label. It does **not** reset Passed/Failed, Tester Notes, screenshot attachments or captions: those remain in the embedded workspace snapshot.

This fulfills the already locked `ALL_FINDING_CARDS_COLLAPSED` default without changing `layout.lock.json` or either canonical JSON schema. The golden HTML SHA-256 is intentionally recalculated after this narrowly reviewed **functional script correction**; canonical JCS JSON bytes, report digest, UI hierarchy and design version stay identical. Subsequent unapproved visual redesigns are still prohibited.

Chromium executed a minimal native DOM-clone and serialization scenario validating the disclosure and filter reset. The five direct client acceptance tests also passed in an isolated JavaScript DOM mock. These checks are **not** yet the full generated HTML opened/saved/reopened in Chromium and must not be promoted to full-browser release acceptance.

## Proof and limitations

Source commits establish the renderer code stored in GitHub, not that a report was generated from a current map audit or that Minecraft gameplay was observed. A JS-only browser mock or source-level test does **not** establish cross-browser interaction, filesystem download persistence, accessibility conformance, or real map report accuracy. The locked reference image/HTML is a static visual guide; final pixel-level acceptance still requires rendered visual comparison.

**Recorded source-level acceptance (commit following 50754e7):** the original embedded client JavaScript was run in an isolated V8 DOM mock. Four interaction scenarios passed: portable snapshot Save/reopen/Reset, different-report JSON rejection, browser-storage quota fallback, and NEEDS_VALIDATION exclusion from Passed/Failed. The executable acceptance harness is now source-controlled for reproducibility. This does not establish browser-native download, cross-browser storage, accessibility, or real Minecraft behavior.

**Remaining acceptance boundary:** execute the original new-system Node tests on one exact-head source snapshot, and validate the generated HTML in a real browser against the locked desktop/mobile reference. Independently exercise Save as HTML → reopen offline on another browser context, including image data/notes and failure handling. Do not report these as PASSED without actual execution.

## Version 1.1.0 — source-reviewed reader improvements

- Unproven issues carry null severity and explicit reason, missing proof and next check; no invented final severity.
- Expandable source references show the evidence type, description and exact original locator. Technical guidance remains on demand.
- Audit Coverage is explicitly unknown if no sourced coverage record is supplied; it is not proof of whole-map closure.
- Search includes expected/observed, rationale and validation text. `/` focuses search and `Esc` clears focused search.
- Tester state remains separate from immutable report JSON and offline HTML can be handed off without a server.
- Previously saved v1.0.0 self-contained HTML is not changed or invalidated; old authored v1 JSON is not silently migrated.

**Proof boundary:** this is source implementation with a synthetic renderer derivation, not a real browser acceptance or executed selected-world audit. Full Map Audit V2 → Report Next 1.1.0 source mapping remains unconnected.

## Source-bound Map Audit reporting — v1.2.0

The opt-in `--report-next` view of the SAME existing `npm run audit` entrypoint now projects `SelectedMapAuditRun` into a deterministic self-contained HTML report; `renderReportNext` keeps both HTML and canonical JSON outputs. Original Bug Tracker/approved Bug Report V2 and old HTML files are not modified.

Audit `PROVEN/NEED_VALIDATION` is separate from evidence strength, severity and tester Passed/Failed. No severity is manufactured when the audit does not provide an assessed priority. Selected source references are verified against the current intent evidence model; missing source references remain marked `REFERENCE_UNRESOLVED` and disable guided retest. Source-derived reproduction cues are visible but are NOT invented Test In-Game instructions. Audit obligations, validation groups and blocked/unknown gameplay surfaces appear in collapsed **Unresolved Checks** under Audit Coverage, never as new BUGs or Developer Notes. A BLOCKED audit still produces an explicitly incomplete report, not a false PASS.

Proof limit: synthetic source-level evaluation only; no Node, browser, real selected-world audit, live Minecraft observation or release acceptance was executed.

**Publication safety:** source-audit completeness additionally requires the real run's review stage and READY status, absence of pending finding proof, and the canonical zero-finding eligibility gate when no findings exist. This is not permission to publish a report as a released/current project Bug Tracker.

## 1.3.0 — source truth and comfortable handoff

- New report JSON explicitly states MAP_AUDIT, SOURCE_REVIEW or SYNTHETIC_DEMO; only Map Audit has an exact auditRevision. Approved Bug Report V2 is a separate, uncounted ledger, not a zero count or invented report type.
- Source evidence tier is independent from PROVEN / NEED_VALIDATION. A pending issue may have inspected source but cannot claim final severity or completed retest. Source-specific scenario, affected scope, causal reasoning, evidence provenance and proof navigation survive the projection.
- HTML shows report kind and PARTIAL/BLOCKED coverage before issue counts. Repeated proof/evidence labels and zero-only severity cards are reduced; evidence and technical proof remain expandable.
- **Download Report JSON** exports the JCS canonical report; **Save Tester Data** exports the separate mutable workspace. Save as HTML remains the primary portable tester handoff.
- Browser re-hashes the embedded JSON using SHA-256 before permitting tester edits or export. On mismatch or unavailable browser SHA-256, editing/export is visibly blocked. This validates local file consistency only, not publisher authentication or Minecraft gameplay.
- Existing approved Bug Report V2 and v1.0-v1.2 self-contained HTML are unchanged. No migration or automatic publication occurs.

**Proof ceiling:** source-level design/renderer review and deterministic synthetic derivation, distinct from actual Node/browser and `runSelectedMapAudit()` execution.

## 1.4.0 — desktop-first design and acceptance

Approved viewports: **1366×768 and 1920×1080**. Mobile is no longer an acceptance/release prerequisite; the historical responsive CSS is preserved solely as a graceful fallback, with no separate mobile renderer or QA campaign.

The single renderer expands the desktop report width from 1080 to 1200px while reducing excess section/card padding. Summary metrics reflow inside a desktop grid. Audit status and conclusion remain visible; the complete missing-proof list moves into a keyboard-accessible disclosure that reports its count. All text and canonical JSON survive unchanged. Where no source-backed guided after-fix retest is eligible, the numeric tester strip is hidden (its stable DOM ID anchors remain for the current client) and an explicit no-test statement is shown.

Required acceptance remains JSON/HTML source parity, 1366×768 and 1920×1080 layout, keyboard focus, source proof/unknown preservation, and portable tester HTML Save/Reopen. This is not Minecraft gameplay evidence.

## 1.5.0 — desktop reader hierarchy and actionable findings

User-approved redesign replaces the old run of equally weighted report panels with **map and audit status → three honest counts → searchable findings → next action → optional evidence and tester notes**. The source artifact fingerprint, all missing proof and all audit obligations remain in canonical JSON and in keyboard-operable details; they are not deleted to make the page shorter.

Each collapsed issue shows its kind, exact proof status, severity only when grounded, canonical ID, concise problem and **one next step**. Expansion leads with the proof gap or permitted guided retest, then Expected/Recorded evidence and player impact. Source locations, source investigation cues and developer repair notes are collapsed by default. Tester notes and screenshots live alongside the issue; editing them never approves an issue, certifies gameplay, or marks canonical Fixed.

The main controls are search, type and proof status. Severity/retest filters remain accessible in Advanced filters. A saved portable HTML resets all visual filters/disclosures while retaining the complete source report and tester workspace. The existing one-renderer, offline SHA-256 report consistency, approved Bug Report V2 separation and no-forged-runtime-evidence boundaries stay unchanged.

Desktop acceptance uses 1366×768 and 1920×1080. Mobile remains out of release-acceptance scope. Source review and any representative visual preview are not themselves an executed Minecraft or completed canonical TypeScript Map Audit.

## 1.6.0 — direct issue explanation and reliable verification

Every BUG and DESIGN_MISMATCH is presented as three reader questions:
- **What is the problem?** Source-backed finding, expected versus recorded or explicitly suspected behavior, and impact.
- **Why could it happen?** Canonical causal explanation when available, or a clearly identified unresolved hypothesis. No fabricated mechanism.
- **How to check it?** Source-supplied reproduction cues or evidence-backed guided procedure, plus a clear expected-versus-reported outcome comparison. No claim that these steps have already run.

Only a validated, source-backed Test In-Game procedure may enable after-fix Passed/Failed; source-audit `reproduceSteps` merely provide **unexecuted verification guidance**, never runtime evidence or a tester PASS. An unsuccessful attempt is labelled Not Reproduced, not a disproof. When no credible steps exist, show the audit's original next check or state that gameplay steps remain unknown.

The main view is a concise summary and issue search. Source IDs/code locations and tester notes/screenshots use optional disclosures; filters and old approved issue state remain independent. Report Next 1.6.0 uses version-locked authored JSON and deterministic HTML. Old standalone HTML v1.0–v1.5 and Approved Bug Report V2 are not migrated or modified.
