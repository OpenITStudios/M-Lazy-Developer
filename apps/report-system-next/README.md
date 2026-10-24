# Report System Next — New Isolated Renderer (Implementation Source)

**Implementation scope:** new, independent reporting surface. It does **not** import, update, regenerate or replace the old Bug Tracker, Approved Bug Report V2, existing `workspace/projects/*/output/`, or its canonical source.

**Design authority:** [planning/report-system-next/](../../planning/report-system-next/). The initial `layout.lock.json` is pinned to Git blob `c958b33054722c2884e791e5b4e811a7987d394d` and version **1.0.0**. The original reference HTML and both JSON Schemas are also pinned to their approved blob identities in `render.mjs`. If any locked input changes without a new authorized version, the renderer refuses generation.

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
