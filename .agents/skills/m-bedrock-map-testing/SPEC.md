# TEST MAP Specification

## Intent

Understand and test gameplay contradictions from one selected immutable map version through **LOAD → UNDERSTAND → TEST → REPORT**, preserving the existing seven internal checkpoints and single `runSelectedMapAudit()` programmatic owner. Direct ChatGPT source review is not an executed engine audit.

## Source isolation

```text
explicit selected .mcworld
or
single current root .mcworld
→ sole current gameplay evidence universe
```

Older versions, raw/development source, previous QA, Technical Docs, changelogs, other maps, and external documents are archive/reference only.

## Required entry state

```text
target artifact pinned
+ map version pinned
+ gameplay surfaces inventoried from that artifact
+ Gameplay Contract derived from that artifact
+ readiness = READY | scoped-safe PARTIAL
```

`BLOCKED` prevents defect classification for that scope.

## Evidence model

```text
selected artifact authored gameplay signals
→ Expected Behavior

selected artifact source contradictions OR observed runtime evidence
→ Actual Behavior at the actual source/runtime proof tier

Expected ≠ Actual
→ candidate
```

## Acceptance

- one artifact/version only;
- relevant selected-artifact source inventory balances indexed files plus explicit parse failures;
- every discovered gameplay surface has one coverage disposition;
- no discovered gameplay surface is silently skipped;
- every candidate has one disposition;
- only defects receive severity;
- counter-evidence and player impact are settled;
- proof ceiling is explicit;
- no engine or original selected-map mutation occurs; separately approved working-copy repair is a conditional operation outside the audit stages.

## Limit

Missing intent stays unknown. Never fill it from another version or stale documentation.
## ZIP method and Probe boundary

- `skills/bedrock/source-lock.json` owns independently pinned native methods/modules; `experiments/developer-practice-signals.json` owns reviewed developer patterns and separately locked Skills Probe results. The existing `engine/packages/orchestrator/src/workflow/resource-context.ts` selects only relevant, version-applicable patterns after exact selected-map locator and typed Semantic IR evidence (at most two hints).
- Developer practice may suggest questions for UNDERSTAND/TEST but cannot supply this map's Expected Behavior, an automatic bug rule or runtime proof. Workflow-only publisher skills and un-routed technical methods remain references; do not install upstream agents, modules or scripts.
- Preserve original Probe `status`, `nodeStatus`, `engineStatus`, PASS/FAIL/BLOCKED/PARTIAL/pending and original target/version; upstream PASS does not certify selected-map gameplay. Unsupported source becomes `capability-gap`, never an automatic switch to IMPROVE SYSTEM.
- Optional working-copy repair requires a separate explicit user approval and immutable original/working fingerprints, **Must Change** and **Must Preserve**, not just a finding.
