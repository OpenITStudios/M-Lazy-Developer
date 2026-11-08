---
id: document.analysis.gameplay-bug-report-v2
class: DOCUMENT
domain: analysis
role: CONTRACT
authority: CANONICAL
lifecycle: ACTIVE
---

# Approved Gameplay Bug Report V2

## Purpose

Canonical persisted **approved BUG ledger** for confirmed Minecraft map implementation/runtime defects. It is a downstream repair/approval state, not the complete human-facing audit report.

The human-facing Complete Bug Report is the Map Audit Report and must show all material `PROVEN` and `NEED_VALIDATION` findings. This approved ledger intentionally stores only approved PROVEN BUG items so unresolved findings are not mistaken for confirmed defects.

This file owns canonical Bug Report V2 semantics. Rendering details belong in `templates/bug-report-v2-html-layout.md`. Persisted Bug Report V2 validation belongs in `engine/schemas/bug-report/`. Map Audit Output validation remains separately owned by `.agents/schemas/map-audit-output-v2.schema.json`.

## Reporting hierarchy

The complete human-facing audit report is the **Map Audit Report** projection. It must preserve every material finding from the same audit revision:

```text
Map Audit Report
├─ PROVEN BUG
├─ PROVEN DESIGN_MISMATCH
├─ NEED_VALIDATION BUG
└─ NEED_VALIDATION DESIGN_MISMATCH
```

The engine must attempt bounded proof promotion before leaving a finding unresolved. If deciding evidence is still unavailable, the finding remains visible as `NEED_VALIDATION` with its exact missing proof and targeted validation action.

Bug Report V2 is narrower:

```text
Map Audit Report
→ approved PROVEN BUG items only
→ Bug Report V2
```

Therefore Bug Report V2 is an approved defect ledger, not the complete audit finding surface. Absence from Bug Report V2 must never be interpreted as evidence that no unresolved material finding exists.

## Scope boundary: BUG vs DESIGN_MISMATCH

This artifact stores **BUG** items only.

`BUG` means the intended design/behavior is grounded, but implementation/runtime breaks it.

`DESIGN_MISMATCH` means the capability/design presented by the map is itself inconsistent with the actually playable/deliverable capability. DESIGN_MISMATCH belongs to the separate Map Audit Output section and must not be serialized into `bugs[]`.

Example:

```text
6 arenas presented
2 concurrently playable
→ DESIGN_MISMATCH
```

A technical platform limit may explain the mismatch but does not turn it into a BUG and does not erase it.

## Document order

Canonical Bug Report V2 contains only approved confirmed bugs.

```text
01 Overview
02 Bug Dashboard
03 Confirmed Bugs
04 Tester / Reproduction Checklist
05 Technical Detail when applicable
06 Report Scope / Version
```

The Complete Bug Report / Map Audit Output V2 exposes unresolved material findings as `NEED_VALIDATION` and keeps them visible until they are proven or disproved. Internal reasons such as runtime proof required, ambiguous intent, insufficient evidence, or Detection Gap are carried inside that status. They must not be promoted into canonical approved Bug Report V2 until they become `PROVEN`.

## Overview

Persisted report map metadata records:

- Map Name
- Map Version
- Map Drive
- Base Version
- Tested Version
- Repair By

Selected-artifact scope, proof ceiling, unresolved findings, and coverage remain upstream audit evidence unless explicitly added to the persisted Bug Report V2 schema.

## Canonical bug record

Persisted Bug Report V2 stores:

```text
Bug ID
Fixed
Severity
Category
Found By
Title
Issue / Problem
Expected
Observed
Reproduction
Technical Analysis, when available
Relevant Code, when available
Suggested Fix, when supported
Must Preserve, when supported
```

Upstream audit-only fields such as Gameplay Flow, player-impact proof, counter-evidence state, proof ceiling, `PROVEN` / `NEED_VALIDATION` status, validation obligations, and coverage accounting remain in Map Audit Output / diagnostic state unless a proven product requirement adds them to the persisted approved-report schema.

Before a defect enters canonical Bug Report V2 it must already have:

- approved confirmed-defect status;
- cleared counter-evidence;
- tester-ready reproduction;
- Blocker, Major, or Minor severity.

## Status boundary

Map Audit exposes exactly two public statuses:

- `PROVEN` — sufficiently proven finding, eligible for severity and approval.
- `NEED_VALIDATION` — materially plausible finding with an exact missing-proof obligation and targeted validation test.

Canonical approved Bug Report V2 persists only approved `PROVEN` BUG items.

The human-facing complete audit report is broader: it must include all material findings from the same audit revision, including `PROVEN` BUG, `PROVEN` DESIGN_MISMATCH, and `NEED_VALIDATION`. NEED_VALIDATION must never be hidden merely because it is not yet eligible for persisted Bug Report V2 approval.

Internal uncertainty reasons never create additional public status categories.

Designed/normal behavior and disproved findings are not published as bugs.

Exact duplicate candidates are accounted for by the existing
`contradictionRegistry` and must not silently discard a stronger,
independently confirmed candidate before its proof is examined.
Rejections remain visible with their reasons. Equivalent confirmed
outcomes may collapse to one defect; conflicting confirmed narratives
for the same route, semantic identity and evidence set must be returned
for correction rather than arbitrarily promoting either version.
This applies within the current audit revision, without borrowing
historical approval or creating another issue status.

## Audit coverage boundary

Full coverage accounting belongs to Map Audit Output V2.

Canonical Bug Report V2 may summarize report scope/version, but it must not become a second audit-coverage database.

A comprehensive Bug Report may be published only after the upstream Discovery Closure and Gameplay Model Closure publication gates pass.

## Language rule

Tester reproduction uses player-facing terms such as:

- World
- Player
- Level
- Wave
- Arena
- Enemy

Implementation details remain in Evidence, not reproduction steps.

## Ordering rule

Technical discovery order must never determine presentation order.

When canonical gameplay-flow ordering metadata exists, use gameplay journey first.

Until Bug Report V2 persists such metadata, use the deterministic fallback:

```text
Blocker → Major → Minor → Bug ID
```

Do not infer flow order from category, title, or implementation location.


## Complex finding depth

Simple bugs remain concise.

When a finding materially depends on shared resources, platform limits, replica divergence, prerequisite reachability, authorization, persistence, or cross-system timing, Technical Analysis should include the relevant subset of:

```text
Root Cause
Design Contradiction
Evidence Convergence
Quantitative / Platform Constraints
Prerequisite Reachability
Authorization / Capability Exposure
Repair Directions
Verification Scenario
```

Reachability gaps must be reported as unresolved evidence rather than converted into claims that a prerequisite is unreachable.

## Publication gate

Both preconditions apply:

- Gameplay Discovery Closure `OPEN` blocks comprehensive proposed review and final publication because the surface inventory is not stable.
- Gameplay Model Closure `OPEN` blocks comprehensive proposed review and final publication because discovered gameplay is not sufficiently understood.

A partial bug list must not be presented as the completed audit.