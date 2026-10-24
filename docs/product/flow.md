---
id: document.product.flow
class: DOCUMENT
domain: product
role: WORKFLOW
authority: CANONICAL
lifecycle: ACTIVE
---

# Product Flow

**Current operator: ChatGPT Chat.** The user provides an accessible selected `.mcworld` map (normally by Google Drive link), and ChatGPT examines source evidence using GitHub `Local` knowledge/policies. The workflow below defines an evidence-first analysis contract, not proof that repository TypeScript or Minecraft executed. Reserve `SelectedMapAuditRun` and engine-owned checkpoint/quality receipts for genuine programmatic execution.

## Single source of truth

For gameplay audit, one exact selected `.mcworld` is the only current gameplay authority.

Historical QA, old map versions, Development/Source, changelogs, and external documents may support comparison/calibration only. They never silently define current Expected Behavior.

## Primary outcome — understand the map and report deviations

The product succeeds when a reviewer can explain **what the selected map is designed to do**, identify **where its implementation conflicts with that design**, and give the developer **actionable, source-grounded findings**. The number of checkers, passed validation gates, graph edges, diagnostic candidates, or tests is not a measure of that success.

The useful operator-facing result, whether from a bounded ChatGPT source review or a genuinely executed programmatic audit, has three parts drawn from the same selected-artifact evidence:

1. **Map design / gameplay blueprint:** player objective; entry → setup → main mechanics → progression → victory/failure → cleanup/replay; arena/player ownership; and only material systems actually present in the map. For each claimed mechanic, distinguish authored facts from inferred purpose and unknown runtime behavior.
2. **Deviations / actionable findings:** expected behavior justified by the selected source or an explicitly approved design; the contradictory implementation or observed behavior; causal consequence; exact source/area; counter-evidence considered; `BUG` versus `DESIGN_MISMATCH`; `PROVEN` versus `NEED_VALIDATION`. Never turn a missing file, generic diagnostic, old QA item, or heuristic alone into a gameplay bug.
3. **Precise remaining questions:** only material unknowns affecting game understanding or a candidate finding, with the smallest deciding source/runtime observation. An unresolved question is not a defect and is not a reason to hide independently supported findings.

A partial source review may already give this useful **scoped** design-and-deviation assessment; it must name incomplete surfaces and must not be presented as a closed production Map Audit Report. The canonical final REPORT still obeys the existing evidence/admission rules. Do not defer all practical map understanding until every unrelated checker or possible test is finished.

Technical domains (entity, scoreboard, Script API, ticking, NBT, structures, inventory, permissions, concurrency) serve the reconstructed player journey. They are not independent feature quotas. An unfamiliar mechanic remains valid even if no pre-existing category covers it.

## Concrete operating loop — from map to decision

A useful audit is **not** a generic checklist of every Minecraft feature.
One selected map/version supplies the content; the operator reconstructs
its actual player-facing mechanics and resolves the **first material**
uncertainty or contradiction. The same canonical owners work as follows:

| Step | Actual input | One decision/output | Existing owner |
|---|---|---|---|
| 1. Select | One `.mcworld` and its fingerprint; approved user focus | Exact map/version/scope, never mixed archives | Artifact + `map-audit-user-intent.ts` |
| 2. Discover | Manifest, packs, scripts, entity/structure/world source | Inventory and source IDs; list unsupported content rather than assume absence | `inspection/inspect-artifact.ts` and format analyzers |
| 3. Understand | Source call paths, event triggers, owner/state relationships, authored content and selected evidence | Objective, start/join, active mechanics, progression, terminal/cleanup/replay; mark inferred and UNKNOWN | `gameplay-intent/` and selected-source analyzers |
| 4. Formalize | Typed Semantic IR + source-grounded Intent | Explicit state/actor/arena ownership, trigger → guard → effect → continuation, and scenario/contract alternatives | `semantic-ir/`, Scenario Graph, Gameplay World Model |
| 5. Evaluate | One scenario, normal path, edge case, disconfirming conditions | Expected-versus-actual **candidate**, or intentional design/UNKNOWN; no issue promoted yet | Existing scenario, diagnostic and platform owners |
| 6. Prove | Source evidence, counterproof, applicable platform facts, narrowly needed runtime residue | PROVEN or NEED_VALIDATION; one root cause, one issue lane; no generic runtime requirement | Defect Resolution Gate and admission |
| 7. Report | Closed admission plus supported findings | Human-readable gameplay blueprint, separate BUG/DESIGN_MISMATCH, and exact remaining decisions | Map Audit Output V2 and approved Bug Report V2 |

The next cycle always starts with the **earliest unresolved stage**, not
with the first convenient checker. Read one relevant owner and follow the
smallest deciding source path. If a source-only question can be answered,
answer it before proposing a Minecraft runtime test. A bounded source
review may communicate independently supported mechanics/defects
without claiming the full production audit closed.

### UNDERSTAND checkpoint → selected-source subjects (Batch A)

A3–A7 checkpoints are currently emitted by the canonical
`mandatory-audit-procedure.ts`. Their technical receipt evidence often
uses Scenario/IR identifiers rather than Gameplay Intent subject IDs.
The existing `map-audit-model-task.ts` now performs a **read-only,
bounded projection** to enable source-grounded investigation without
changing a checkpoint's status:

- **Direct route:** choose a non-hypothetical Intent node when its
  selected-artifact evidence matches the checkpoint/unsatisfied obligation
  evidence, or a checkpoint-linked Intent unknown explicitly blocks it.
- **Role candidate route:** for A3 (journey), A4 (state), A5 (ownership),
  or A6 (progression) only, choose up to four nodes of the corresponding
  existing Intent kinds, all independently backed by selected-artifact
  source. This is navigational context, **not** proof the node caused
  the checkpoint to block.
- **A7 semantic closure:** no generic fallback. Without an exact evidence
  or linked unknown witness, it must abstain rather than sample the map
  inventory arbitrarily.
- **No promotion:** external/historical nodes and pure hypotheses never
  qualify. Selected subjects then pass through the already existing
  source-evidence lookup, typed Semantic IR join and optional developer
  reference selector. The resulting task carries a `subjectSelection`
  provenance marker and omitted count; no new graph, detector, expected
  behavior, checkpoint closure, or bug report is created.

The `--brief` formatter surfaces the route marker as **NOT checkpoint
proof**. A candidate may direct ChatGPT to inspect a source path, but
only the canonical audit/defect proof owners can resolve the blocker.

### Batch B — cross-region causal investigation (source edges only)

The existing Scenario Compiler now projects `sourceHandoffs` from
**resolved Semantic IR execution edges** within an existing source flow.
Unlike simply listing everything reached by a broad trace, each handoff
records its precise `edgeId`, caller and callee region, synchronous/
event/deferred/periodic kind, authored source location, optional scheduler,
and the **direct** callee-region state writes, world-effect attempts and
resource releases. Its generation-guard field distinguishes a source
check, an unresolved guard and a check not recorded in the IR.

```text
selected-map trigger/event source
→ resolved call or deferred-callback edge [exact edge ID]
→ actual target region [same artifact]
→ direct target-state writes / effect attempts / releases
→ open question: guards, identity, state relevance, return/cleanup
→ existing scenario + counterproof reasoning (NEVER auto-confirm bug)
```

When a target is unresolved, points to a different artifact, or contains
only unrelated operations in a broad trace, **no direct target handoff
is invented**. The view is bounded (24 edges per source flow; eight
direct target steps per edge) with omitted counts, and is derived from
the existing IR rather than a second behavioral graph. It does not
establish actual execution order between regions, that a timer fired,
that a form/session guard was satisfied, or that player teleport/
cleanup occurred. Source-level guard presence is not a runtime result.

The existing `gameplayStructure.sourceFlowCandidates[]` carries those
source-only handoffs, `--brief` shows bounded navigation, and the
existing `--handoff` model projection includes a deduplicated subset.
No issue classification or proof/admission gate is changed.

### Batch C — diagnosis and counterproof grouping

The existing canonical audit produces two different collections from
independently admitted source/proof evidence:

1. **PROVEN candidate root groups:** the existing
   `groupReadyAuditIssuesForCandidateCoverage()` groups BUG causal links
   only if they share the same technical owner, **same exact downstream
   dependency target**, compatible source-domain requirement identity and
   dependency kind. Multiple player-facing symptoms may share one source
   root; different downstream dependencies cannot be collapsed merely
   because their failure domains or owner names match. Ambiguous or
   foreign-scenario Knowledge requirement IDs must not determine grouping.
2. **NEED_VALIDATION deciding-proof groups:** the existing
   `groupNeedValidationTests()` reuses a shared group key only within the
   same scenario, issue type and proof mode. Collisions are partitioned
   into deterministic scoped keys, keeping static/formal source checks
   apart from narrow native-runtime questions. The original key is
   preserved for an unambiguous group.

These are **projections**, not another problem database and not permission
to merge or invent BUGs. The canonical causal link, source evidence,
counter-proof search, mandatory audit gates, and BUG/DESIGN_MISMATCH
classification are unchanged. A missing counterproof receipt remains
NEED_VALIDATION, and a reference from the developer ZIP remains advisory.

The existing `--handoff` now surfaces bounded
`diagnosisNavigation.admittedBugRootGroups` and
`diagnosisNavigation.pendingProofGroups`. The existing `--brief`
optionally reports the number of source-verified BUG causal links versus
their admitted root groups, alongside counts of static and runtime
proof groups. Its earliest stage-ordered model task still owns the
operator's next step. These summaries are not independent defect proof,
confirmed repair or a replacement for canonical REPORT.

### Batch D/E — canonical source identity and reference freshness

The selected source identity has one adapter under
`project-model/src/project/source-ref.ts` for recognized
file/line/JSON-pointer/source-symbol locators. This replaces
unrestricted source-path prefix matching in the existing developer
reference selector; the authored `GameplayIntentEvidence` scope and
typed Semantic IR witness still decide eligibility.

`modelTaskPackets` derive conditional context from the **current,
explicit** Knowledge Catalog and developer-reference snapshot. A
continuation without those snapshots does not silently retain
previous-turn knowledge excerpts or developer hints. The CLI passes
the same explicitly loaded snapshots to its response continuation
when present. Source facts and canonical proof receipts are never
rewritten from these reference hints.

Full structured evidence remains with its original owners. Audit
revision protects source/proof decisions; the reference snapshot
lifecycle protects read-only retrieval. Neither is a second
checkpoint, another source of Expected Behavior or proof that a
previously opened Minecraft map behaved in a particular way.

### One developer-method investigation path

The CLI now loads the vetted `developerPractice` snapshot by default;
the API keeps explicit injection. Selection requires exact selected-map
source evidence and matching typed Semantic IR/question context. The same
bounded context can deliver the relevant SHA-pinned developer methodology **within the same bounded
model task**: actual SKILL.md chapter references, a three-step source
investigation, a concrete design counterexample, and linked example
module/unit-test/checker/probe sources. This replaces scattered
standalone developer advice with one source-grounded investigation
path. Additional contexts remain omitted if no exact selected-map
typed source cue exists.

The six team/release/setup/result/testing workflow methods are
development-only provenance. They cannot be chosen as gameplay
Expected Behavior or as a detector. All external tool scripts,
developer unit-test sources and probe reports are **NOT executed**
during source reference retrieval. The current source artifact and
canonical proof gate always decide the map finding.

### External developer source: comparison, never replacement

The supplied `minecraft-bedrock-agent-skills` v0.24.0 and
`skills-probe` references are optional, versioned **REFERENCE** input
to a source-grounded model task. The path is:

```text
Selected-map source evidence + typed Semantic IR + question
→ existing modelTaskPackets
→ at most two relevant developer interpretation questions
→ inspect map's actual caller/state/effect and negative controls
→ decide Expected / contradiction / UNKNOWN through existing proof gate
```

No developer module is silently installed or executed. A probe FAIL does
not establish a bug in another map; a developer implementation preference
does not become a gameplay requirement. **Version compatibility** is
derived from the selected pack manifest and separately verified runtime
target, not a borrowed developer version. When no exact typed cue or
source-location join exists, omit the hint instead of inventing a match.

### Batch F — projection/presentation ownership

The authoritative `MapAuditOutputV2` type and
`projectMapAuditOutputV2()` remain in
`engine/packages/orchestrator/src/map-audit-output-v2.ts`.
Its much larger **human-readable** `formatSelectedMapAuditBrief()`
implementation is now owned only by
`engine/packages/orchestrator/src/reporting/map-audit-brief.ts`.
The previous import path re-exports that function for CLI/consumer
compatibility; it does not create a second structured report.

Similarly, `runSelectedMapAudit()`, revision validation, continuation,
defect admission, and actual response mutation stay in
`map-audit-pipeline.ts`. Only the read-only paginated
`projectSelectedMapAuditModelHandoff()` implementation moved into
`reporting/map-audit-model-handoff.ts`. Its previous public import
path remains a named re-export. The set of model-response-eligible
**task kinds** is declared once by `map-audit-model-task.ts` and shared
between the canonical response gate and the handoff projector.
Those task kinds alone do not permit resolution; causal-link scope and
revision admission are still mandatory.

Both movements are **source-preserving extractions**; presentation
does not reinterpret gameplay, select new evidence, classify bugs,
or change publication authority. No new report schema, audit stage,
provider registry or separate pipeline was introduced.

### What the operator sees first

The existing `--brief` formatter presents **Game Understanding → Immediate
Decision → Detailed Source Navigation → Findings → Next Investigations**.
The immediate decision includes confirmed versus unresolved finding
counts, a bounded set of selected-source mechanic candidates, and the
first stage-ordered task or obligation. Only when that task actually
has an admitted developer reference does its question appear; the full
task section exposes source IDs, counterexamples and provenance.

This front section is a **read-only projection of existing source evidence**,
not a new stage, an alternative issue database, a cached decision, or
proof of successful runtime execution. The detailed source inventory
remains navigable later; it must not hide the decision or be confused
with chronological player gameplay.

## One source-declared programmatic audit flow (optional; only if executed)

```text
Selected .mcworld
→ runSelectedMapAudit()
→ TARGET
→ DISCOVERY
→ UNDERSTAND
→ FORMALIZE
→ EVALUATE
→ PROVE
→ REPORT
```

There is one canonical TypeScript selected-map pipeline. Direct ChatGPT Chat analysis uses the same evidence/uncertainty discipline but cannot fabricate an engine-produced audit receipt; it must retain exact source evidence and report its actual proof ceiling.

The engine authority chain is:

```text
map-audit-pipeline
→ Mandatory Audit Procedure
→ ordered admission
→ scenario/RIG evidence
→ contradiction resolution
→ confirmed issue projection
→ BUG | DESIGN_MISMATCH
→ report/review
```

### Stage meaning

| Stage | Must answer before continuing |
|---|---|
| TARGET | Which exact artifact/version is current truth? |
| DISCOVERY | Are all gameplay-sensitive sources accounted and semantically owned? |
| UNDERSTAND | Is the player journey, state, ownership, progression and intent understood? |
| FORMALIZE | Are the evidenced actors, states, ownership, boundaries and gameplay contracts made explicit without inventing intended behavior? |
| EVALUATE | Have applicable normal behavior, boundaries, recovery, concurrency and cross-system conditions been evaluated for contradictions? |
| PROVE | Does each contradiction survive scoped counter-proof, or become runtime residue/detection gap? |
| REPORT | Is each confirmed root cause classified exactly once as `BUG` or `DESIGN_MISMATCH`? |

A blocked stage stops this same sequence. It does not create another workflow.

## Player-flow execution

Within those stages, checks follow the game:

```text
ENTRY / JOIN
→ READY / START
→ SETUP
→ ACTIVE GAMEPLAY
→ PROGRESSION
→ TERMINAL
→ CLEANUP / REPLAY
→ RECOVERY
```

Domain analyzers are evidence providers attached to the relevant player-flow stage.

## Issue types

### BUG

Use when intended behavior is grounded but implementation/runtime breaks it.

```text
expected gameplay contract
→ implementation/runtime contradiction
→ BUG
```

### DESIGN_MISMATCH

Use when the capability presented/authored by the game is materially different from actual playable/deliverable capability.

```text
presented capability
≠ playable capability
→ DESIGN_MISMATCH
```

A platform constraint, queue, fallback, or performance safeguard may explain root cause but does not erase the mismatch.

One root cause belongs to exactly one report lane.

## Fail-closed rule

The system must never translate uncertainty into PASS.

```text
source accounted but semantics missing
→ Detection Gap

semantic model incomplete
→ block UNDERSTAND/FORMALIZE

cross-system scenario missing
→ block EVALUATE

counter-proof incomplete
→ block PROVE

irreducible Minecraft behavior
→ one narrow Runtime Proof request
```

“No issue found” is meaningful only when the ordered gates close.

## Audit-only use

```text
Selected .mcworld
→ runSelectedMapAudit()
→ resolve blocking stages / defect resolution
→ issueLanes.BUG + issueLanes.DESIGN_MISMATCH
→ STOP
```

## Audit + report

```text
closed audit
→ review confirmed root causes
→ BUG section
→ DESIGN_MISMATCH section
→ production Map Audit report
```

Bug Report V2 remains the persisted approved `BUG` lane. DESIGN_MISMATCH remains a separate Map Audit output lane.

## Repair

Repairs start from an approved issue, not from raw analyzer findings.

```text
Approved BUG or approved design change
+ Must Change
+ Must Preserve
→ mutation
→ targeted verification
→ preservation verification
→ Fix Verification Readiness
```

Fix Verification Readiness is a projection of the existing post-repair differential and preservation proof. It does not create a second repair workflow. Its terminal statuses are `VERIFIED_FIXED`, `NOT_FIXED`, `REGRESSION_FOUND`, or `CONFIRMATION_REQUIRED`.

## Final quality projections

After canonical REPORT projection, final assessments make result interpretation explicit without adding another audit path:

```text
closed canonical audit
→ Vital Gameplay Knowledge Closure
→ Information Integrity projection
→ Zero-Finding assessment when findings = 0
```

Vital Gameplay Knowledge Closure projects eight production-critical domains across the same canonical evidence: entry/admission, progression, multi-arena isolation, connection/recovery, inventory/player capability, world/reset integrity, score/result integrity, and player-facing information. Its detailed contract is in `../analysis/vital-gameplay-knowledge-closure.md`.

It never creates findings or advances audit stages. A domain may only be `UNDERSTOOD_PROVEN_SAFE` after the canonical audit itself is ready for review. Runtime residue remains `RUNTIME_REQUIRED`; semantic/capability uncertainty remains `DETECTION_GAP`.

Information Integrity crosschecks the canonical finding lanes for player-facing information contradictions. It may be `CLOSED_CLEAR`, `CLOSED_WITH_FINDINGS`, or `BLOCKED`; findings remain normal `BUG | DESIGN_MISMATCH` items and are never duplicated into a new issue lane.

Zero-Finding assessment applies only when both issue lanes are empty. `ELIGIBLE` requires closed canonical coverage, CLOSED gameplay closure, PASS honesty, zero Audit Obligations, and zero remaining validation groups. Otherwise the result is `NOT_ELIGIBLE`. This is an absence-confidence statement, never a claim that the map is universally bug-free.

A new map version restarts TARGET and Discovery. Prior findings are regression/calibration evidence only.