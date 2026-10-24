---
name: m-bedrock-map-bug-audit
description: >
  Audit one Minecraft Bedrock/Education map version for gameplay bugs using game-design-first analysis and production report output.
---

# Lazy-Developer Map Bug Audit

**Lane:** OPERATIONAL / MAP USE

## Purpose

Inspect one selected Minecraft Bedrock/Education artifact and preserve evidence/unknown boundaries before admitting gameplay defects.

## Entry criteria

Select one exact map artifact and verify its identity; user symptoms prioritize inspection but do not define game-design truth.

## Allowed actions

Inspect the selected artifact read-only, derive evidence-backed gameplay contracts, record Audit Obligations, and report appropriately bounded findings.

## Forbidden actions

Do not patch the target, promote assumptions to proven defects, substitute old versions for current evidence, or invent test receipts.

## Actual operating environment — ChatGPT Chat map checking

**M-Lazy-Developer is operated through ChatGPT Chat.** When the user supplies an accessible Google Drive `.mcworld` link, retrieve and inspect the selected artifact read-only with available connected tools; GitHub `Local` provides canonical source/knowledge/reference authority. Do not require the user's PC, ChatGPT Work, a checkout, npm, CI or an emulator as a prerequisite for source analysis.

**Distinguish two different proof types without creating two competing engines:**

- **ChatGPT source audit (available now):** direct, read-only archive/script/mcfunction/NBT/LevelDB/structure inspection as actually possible; reason against canonical Minecraft/source contracts, identify actor/trigger/state/outcome/recovery, negative evidence and UNKNOWNs. Give exact selected-artifact source citations/locations and an independently qualified assessment. Do **not** invent `SelectedMapAuditRun`, `auditRevision`, `issueLanes`, `MapAuditOutputV2` receipts, or pretend `runSelectedMapAudit()` ran.
- **Optional repository TypeScript execution (only if genuinely callable):** `runSelectedMapAudit()` is the **sole programmatic code entrypoint** and its own gates/reports govern any real programmatic output. Source files and authored tests do not prove this executable route ran.

The same semantic concepts and proof discipline apply to ChatGPT review; they do not require a parallel interpreter or a second persisted audit engine. In a ChatGPT report, label conclusions as *observed static source*, *inference*, *source-grounded concern*, or *needs runtime proof*. Do not claim live multiplayer, successful concurrent arenas, pathfinding or release safety without appropriate observation.

## Source of truth

Audit exactly one selected `.mcworld`.

That selected map version is the only current gameplay source of truth.

Do not use older versions, Development/Source, old QA/Bug Reports, Technical Docs, changelogs, other maps, or external design documents to infer current mechanics unless comparison/history is explicitly requested.

## User prompt intake

Before starting the selected-map audit, translate the user's wording through `../../../docs/analysis/user-input-translation-contract.md`.

The user prompt is **search guidance, not gameplay authority**.

Classify material statements into target hints, symptoms, suspicions, expectation/design claims, scope priorities, test constraints, output preferences, historical hints, and ambiguities.

Rules:

- preserve every material raw prompt fragment; each fragment must be mapped to one or more intent items or explicitly retained as unmapped input;
- if structured translation is unavailable, preserve the raw prompt through `createFallbackAuditUserIntent()`; never discard it;
- unmapped prompt fragments become non-bug Audit Obligations and must not be guessed into findings;
- if a target hint conflicts materially with the exact selected artifact/version, record a blocking ambiguity and resolve it before production audit;
- preserve the user's symptom even when their suspected root cause may be wrong;
- expand vague symptoms into a bounded set of relevant failure families;
- use user focus to raise search priority, never to suppress other material selected-artifact surfaces;
- never convert user wording directly into Expected Behavior, BUG, DESIGN_MISMATCH, severity, or PROVEN;
- when several cheap interpretations are plausible, retain them and let selected-artifact evidence resolve them;
- ask only when ambiguity blocks exact target identity or materially changes the requested outcome.

Examples:

```text
"wave suka stuck"
→ prioritize progression accounting + entity lifecycle + chunk/residency + terminal transition

"inventory suka hilang/duplicate"
→ prioritize grant/consume + reset + restore ownership + reconnect/recovery + idempotency

"multi arena error"
→ prioritize capacity + assignment + isolation + parallel start + cleanup/reuse

"jangan test semuanya"
→ static-first bounded proof strategy
NOT → skip discovered material gameplay
```

## Mandatory chat confirmation

After translating the user's prompt and before starting the selected-map analysis in ChatGPT (or invoking the programmatic entrypoint if actually available), present one concise **Pre-Audit Plan** in chat and obtain explicit confirmation.

For the normal pre-testing workflow, do not require the user to know symptoms or suspected bugs.

Show:
- exact target/map hint if present;
- audit objective;
- the gameplay/system coverage that will be checked;
- proof/testing strategy;
- requested focus/exclusions/constraints;
- expected output;
- symptoms/suspicions only when the user actually supplied them;
- ambiguities and unmapped input only when relevant.

Then state that the canonical audit will still inspect other material gameplay surfaces discovered in the selected artifact and that none of the user's suspicions will be treated as a bug without evidence.

After an explicit confirm such as `ya`, `setuju`, `benar`, or equivalent, begin the ChatGPT source audit. Create the code-only `AuditUserIntentConfirmation` receipt solely when an actual executable `runSelectedMapAudit()` invocation needs it; never fabricate one for a ChatGPT conversation.

If the user corrects or materially changes the interpretation, rebuild the intent and ask for confirmation again. A prior confirmation receipt is stale by design.

Do not ask multiple rounds when one compact confirmation is sufficient.

## Required audit order

Bug discovery cannot start before the selected world is reconstructed.

The canonical base procedure is `../../../docs/analysis/mandatory-audit-procedure.md`. Production audit is one linear sequence:

```text
TARGET → DISCOVERY → UNDERSTAND → FORMALIZE → EVALUATE → PROVE → REPORT
```

A blocker pauses this same sequence; it never creates a second workflow.

This skill routes the work; it must not duplicate or weaken those checkpoint closure rules.

**Code-contract boundary (only when actually executed):** the repository's programmatic production audit has one canonical entry: `runSelectedMapAudit({ artifactPath })` in `map-audit-pipeline.ts`, and `artifactPath` must be the exact selected `.mcworld`. These are source instructions for an optional TypeScript invocation, not evidence that the canonical audit was executed. The normal ChatGPT-native checker still inspects the selected artifact directly, without pretending this call occurred. Low-level inspection/analyzer/reporting functions—including `inspectDirectory()` and `inspectArtifact()`—are engine plumbing and must not be used as alternate production entry points. Artifact-level native proof must finish before the Mandatory Audit Procedure is re-derived and allowed to close. Ordered readiness is owned only by `map-audit-admission.ts` across TARGET → DISCOVERY → UNDERSTAND → FORMALIZE → EVALUATE → PROVE → REPORT. The first blocking stage prevents production continuation. If PROVE stops on Defect Resolution, continue through `resolveSelectedMapAudit()` with the same audit run. The audit run is also the sole owner of `currentStage`, `allowedNextAction`, bounded `modelTaskPackets`, deterministic `issueLanes`, `issueLanes.BUG`, `issueLanes.DESIGN_MISMATCH`, conservative `candidateGroups`, and selected-artifact identity; do not ask the model to infer the next stage, search unrelated systems, invent AI defects outside `issueLanes`, split a deterministic candidate group into duplicate AI bugs without new causal evidence, or map one deterministic candidate group to multiple AI candidates, or supply a different map/version identity at review/report time. A model may promote a contradiction to `CONFIRMED_DEFECT_READY` only with a bounded `CounterProofSearchReceipt` proving the configured search scope was exhausted without blocking proof. Every model task/result must retain the `auditRevision`; `resolveSelectedMapAudit()`, `prepareSelectedMapAuditReview()`, and `buildSelectedMapAuditReport()` reject stale revisions. `runSelectedMapAudit()` reconciles preflight demand against final RIG requirements with one bounded union-demand rerun; review readiness requires the second pass to be stable when reconciliation was needed. Work Session must remain subordinate: its stage is a coarse projection of `SelectedMapAuditRun`, never an independent authority; workflow/map-audit-work-session.ts is the only projection/persistence owner. Eager evidence collection never implies stage completion: `executionTrace` is the authority for which ordered decisions are actually authorized. Later-stage projections stay inert before authorization; `issueLanes` and `candidateGroups` must be empty until PROVE is reached. If a generic Work Session is persisted, it must carry WorkSessionAuditBinding projected from the current SelectedMapAuditRun through map-audit-work-session; its legacy stage names are only a mirror and never audit authority. Review continues through `prepareSelectedMapAuditReview()`; final production report continues through `buildSelectedMapAuditReport()`. The original audit run is carried forward so source inventory, closures, RIG, procedure receipt, and defect-resolution gates cannot be reconstructed or omitted downstream.

The engine-owned machine-readable receipt is `inspection/mandatory-audit-procedure.ts`. Production report publication must receive this receipt. OPEN checkpoints block publication. PARTIAL checkpoints block publication unless their reason is specifically `RUNTIME_PROOF_REQUIRED`; absence of a detected feature is not sufficient for `NOT_APPLICABLE` unless Discovery Closure is complete and positive non-applicability evidence is present. Do not create a parallel manual status table.

```text
Selected Map Version
→ TARGET
→ DISCOVERY
→ UNDERSTAND
→ FORMALIZE
→ EVALUATE
→ PROVE
→ REPORT
→ BUG | DESIGN_MISMATCH
```

Required references:

- `../../../docs/analysis/mandatory-audit-procedure.md`
- `references/game-design-contract.md`
- `references/gameplay-flow-contract.md`
- `references/multi-arena-contract.md`
- `references/bug-report-contract.md`
- `references/user-input-translation-cases.md`
- `../../../docs/analysis/gameplay-model-closure.md`
- `../../../docs/analysis/bug-finding-coverage.md`
- `../../../docs/analysis/hidden-gameplay-defect-analysis.md`
- `../../../docs/analysis/vital-gameplay-knowledge-closure.md`
- `../../schemas/map-audit-output-v2.schema.json`


## Post-audit control-plane hardening

The **optional executable-code path**, if ever genuinely invoked, remains single-entry through `runSelectedMapAudit({ artifactPath })`. ChatGPT-native inspection is not that code execution, and cannot assert the code's checkpoint/status receipts.

Additional binding rules:

- production `SelectedMapAuditInput.target` may contain runtime/platform identity only; caller-supplied map-specific behavior contracts, arena layouts, state-authority contracts, spatial policies, economy/combat/inventory contracts, or release intent are forbidden;
- preflight → final RIG demand may perform at most two full artifact passes: discovery, then one union-demand reconciliation pass; non-convergence after pass two is a blocking engine gap, not permission to reread repeatedly;
- scenario component scope uses typed directional traversal and semantic stop boundaries, never arbitrary undirected N-hop expansion;
- `SelectedMapAuditRun.continuation` owns whether the next step is engine/evidence rerun, Defect Resolution, or review; before PROVE, model task packets are diagnostic only and cannot authorize checkpoint closure;
- raw closed-audit reporting routes require opaque `SelectedMapAuditAuthority`; manually reconstructed closure inputs are not production authority;
- production semantic-proof reuse and rejected-candidate reuse must use audit-bound wrappers and match the current `auditRevision`;
- generic Work Session remains subordinate to `SelectedMapAuditRun`; its audit binding is a persistence/UI projection only;
- eager evidence collection does not grant decision authority; `executionTrace` is authoritative for ordered stage authorization.
- platform-constraint reasoning must use bounded applicable platform relation claims (rule/status/source/evidence) from the active runtime profile; `analysis:platform-constraints` alone is only an execution receipt, not proof of a specific Minecraft/Education rule.

## One-door authority summary

Do not choose among specialist documents as workflows.

```text
runSelectedMapAudit()
→ Mandatory Audit Procedure
→ map-audit-admission
→ RIG/scenario/analyzer evidence
→ Gameplay Defect Resolution
→ auditObligations[] for unresolved non-findings
→ issueLanes for causal findings
   ├─ issueLanes.BUG
   └─ issueLanes.DESIGN_MISMATCH
→ review/report
```

- Discovery Closure is subordinate to DISCOVERY.
- Gameplay Model Closure is subordinate to UNDERSTAND/FORMALIZE.
- Bug-Finding Coverage is the single coverage owner across DISCOVERY → PROVE; its EVALUATE sections activate blind-spot and cross-system pressure without creating parallel workflows.
- Scenario Closure and Counter-Proof belong to PROVE.
- HTML/chat/JSON are REPORT projections only.

No subordinate document, analyzer, legacy schema, Work Session, or UI may independently authorize PASS/completion.

## Gameplay Contract

Before bug discovery, the audit must establish and account for the full gameplay model:

- objective;
- win condition;
- lose condition;
- player journey;
- state transitions;
- reset rules;
- preserve rules;
- progression rules;
- multiplayer rules;
- multi arena rules when applicable;
- capacity/concurrency rules when applicable;
- recovery and softlock paths;
- boundary scenarios;
- player-facing feedback for material limitations;
- persistence boundaries.

If expected behavior cannot be grounded from the selected artifact, keep it unknown. Do not convert unknown into Designed Behavior.

Bug discovery starts only after Gameplay Model Closure is CLOSED. Gameplay Model Closure PARTIAL is not a runtime exception: it means material boundaries, blocked surfaces, or unknown gameplay semantics still exist and therefore blocks production continuation. Gameplay Scenario Closure is the only closure allowed to remain PARTIAL, and only because that state is reserved for irreducible Minecraft runtime proof.

## Canonical issue taxonomy

Every confirmed causal issue projected by the engine must carry:

```text
issueType
gameplayFlow
failureDomain
contributingDomains[]
informationMismatch
severity when confirmed for report
```

Primary failure domains:

```text
arena-multi-arena
inventory-economy
progression-wave-objective
chunk-simulation
player-lifecycle
entity-ai-combat
world-structure-mutation
ui-feedback-information
state-ownership
temporal-async
boundary-capacity
persistence-recovery
platform-performance
```

Use one primary `failureDomain` for reader clarity. Preserve materially involved cross-system domains in `contributingDomains`.

Examples:

```text
Wave cannot finish because remote mobs stop simulating
→ failureDomain: progression-wave-objective
→ contributingDomains:
  chunk-simulation
  entity-ai-combat

Arena UI says available while the session is actually full
→ failureDomain: ui-feedback-information
→ contributingDomains:
  arena-multi-arena
  ui-feedback-information

Six arenas are presented but only two can run concurrently
→ issueType: DESIGN_MISMATCH
→ failureDomain: arena-multi-arena
```

`informationMismatch` is true only when grounded player-facing information contradicts actual playable/runtime behavior. UI presence alone is not enough.

Do not infer severity from scenario name or failure domain. Severity is based on grounded player/game impact.

## Report issue types

Every confirmed reportable issue must be assigned exactly one report issue type:

- `BUG` — intended behavior/design is grounded, but implementation/runtime is broken.
- `DESIGN_MISMATCH` — presented/authored capability does not match actual playable/deliverable capability.

Do not place DESIGN_MISMATCH items in the BUG list. Present them as separate report sections while preserving the same severity and evidence discipline.

Internal subtypes such as design capacity failure or design–implementation mismatch may explain root cause, but the reader-facing issue type remains `DESIGN_MISMATCH`.

## Flow-first audit projection

The model must reason in player-flow order, not analyzer/domain order:

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

Each technical capability is invoked only inside the gameplay stage that requires it. Example: chunk/ticking analysis belongs to SETUP or ACTIVE GAMEPLAY when spawn/simulation depends on it; inventory belongs to SETUP, ACTIVE, TERMINAL, CLEANUP, or RECOVERY only where the selected game uses it. Do not output a detached domain checklist.

The final issue order must follow this player-flow order. Recovery findings attach to the stage they return to or invalidate, while retaining RECOVERY as their scenario class.

## Gameplay scenario audit backbone

The audit is scenario-driven. Surface discovery and technical analyzers provide evidence; they do not close gameplay by themselves.

Knowledge activation is also scenario-driven. Do not preload every analyzer and do not rely on names/keywords to decide applicability.

**Conditional developer ZIP reference (ChatGPT-native UNDERSTAND / FORMALIZE):** Only when an exact selected-map source site and a specific interpretation question justify it, consult the relevant section of `docs/analysis/developer-practice-context.md` and at most two matching `SOURCE_REVIEWED` / `CORROBORATED` reference patterns from `experiments/developer-practice-signals.json`. Keep the originating ZIP/source identity, source locator, applicability uncertainty, question, negative control, and prohibited inference. Avoid loading all 22 upstream skills or the entire reference inventory into every audit. The six `DEVELOPMENT_WORKFLOW_ONLY` skills are not map evidence. If the selected source does not support a precise match, abstain; selected-artifact evidence and independently applicable platform knowledge always take precedence. This is direct ChatGPT reference reading, **not** execution of the upstream ZIP or `compileDeveloperPracticeReferenceContext()`, and it never authorizes a gameplay finding, checkpoint closure, or runtime assertion.

Preflight is not allowed to prove non-applicability by silence. It must combine raw structured source evidence, selected-artifact semantic intent, selected-artifact contracts, and platform/profile facts. Discovery Closure must retain and balance relevant/indexed/parse-failure/unsupported-residue source counts. Discovery OPEN or PARTIAL blocks production continuation; do not prune a domain as absent while selected-artifact references remain unresolved.

Capabilities must declare one execution phase. `discovery-core` is reserved for the cheapest information required to discover/reconstruct gameplay; `rig-directed` capabilities should execute only when required by active RIG nodes or explicit higher-context proof. Do not move deep diagnostic work into discovery-core for convenience.

For every material Gameplay Scenario:

```text
Scenario semantics
→ Required Knowledge Set
→ analysis-planner capability selection
→ existing analyzer evidence
→ Knowledge Receipt
→ Causal Link resolution
```

The target is the **minimum complete knowledge set**: the smallest applicable set that can fully prove the scenario. A required domain with a registered capability but no returned evidence is `MISSING_REQUIRED_KNOWLEDGE` and blocks Scenario Closure. A genuinely absent capability is `CAPABILITY_GAP` and routes to Detection Development. These states must never be collapsed into generic `Needs Validation`.

The Required Knowledge Set is the **Required Inspection Graph (RIG)**. RIG is not a second knowledge base or workflow engine; it is the fail-closed dependency graph over existing knowledge requirements.

The analysis capability registry is the single owner of which knowledge domain a capability can satisfy. RIG must query that registry; it must not maintain a parallel hard-coded capability map. Every RIG node also carries the selected-artifact subject/component scope that caused the requirement, so later proof can stay bounded instead of becoming domain-global.

Each RIG node must declare:

```text
scenario
→ required knowledge domain
→ required capability
→ prerequisite RIG nodes
→ execution receipt
```

A downstream node cannot become satisfied while a prerequisite node is unresolved. `BLOCKED_BY_PREREQUISITE`, `MISSING_REQUIRED_KNOWLEDGE`, and `CAPABILITY_GAP` all keep Gameplay Scenario Closure OPEN. Do not create additional manager/router/service layers around RIG.

The mandatory execution path is:

```text
Selected Map
→ reconstruct player journey
→ compile material gameplay scenarios
→ map every technical/gameplay component to a gameplay purpose
→ build Gameplay Causal Links
→ route each link to existing analyzers
→ resolve each link
→ detect missing links and orphan components
→ analyze player-count/failure/recovery variants
→ translate technical contradictions into player-visible gameplay consequences
→ Gameplay Scenario Closure
→ Proposed Issue Set
```

A component is not considered understood merely because it was parsed or counted. For every material component answer:

```text
What is its technical role?
What gameplay purpose does it serve?
Which scenario uses it?
What dependency does it provide?
What breaks if it fails?
What does the player experience?
```

Every material scenario must account for its causal links. Valid Gameplay Causal Link states are `PROVEN`, `CONTRADICTED`, `RUNTIME_BLOCKED`, or `DETECTION_GAP`. There is no gameplay-level `checked` state.

Runtime-domain causal links must carry the originating RIG requirement, scenario scope, subject/component scope, and execution evidence. A domain-wide analyzer counter alone is not sufficient provenance for report admission.

When an analyzer exposes scoped findings (for example script/region chunk leases), causal contradiction must prefer those scoped findings. Aggregate counters may prioritize follow-up, but they must not automatically contaminate unrelated scenarios.

This rule applies to arena isolation/global state, inventory lifecycle, combat paths, persistence properties, and reward/economy paths as their scoped analyzer detail becomes available. The World Model must preserve detail needed for correlation instead of collapsing it to counters only.

Every `CONTRADICTED` Gameplay Causal Link must enter Gameplay Defect Resolution before report review. The only allowed final dispositions are:

- `CONFIRMED_DEFECT_READY` — gameplay trigger, consequence, expected outcome, actual outcome, and affected scope are complete;
- `BLOCKING_COUNTERPROOF` — concrete evidence proves the wrong state is unreachable;
- `RUNTIME_PROOF_REQUIRED` — source reasoning is exhausted and one narrow Minecraft-runtime question remains;
- `DETECTION_GAP` — a named engine capability is genuinely missing.

The temporary state `GAMEPLAY_TRANSLATION_REQUIRED` may block report publication only when a contradicted causal link cannot yet be translated into a complete player-facing defect contract. Source-proven contradictions with complete translation must run bounded counter-proof search automatically and resolve to `CONFIRMED_DEFECT_READY` or `BLOCKING_COUNTERPROOF`; do not park them in `COUNTERPROOF_SEARCH_REQUIRED` or tester-facing `Needs Validation`.

When a contradicted causal link already has a scenario, scoped RIG provenance, purpose, reason, and evidence, the engine must auto-translate that context and advance directly to `COUNTERPROOF_SEARCH_REQUIRED`. Do not waste another manual translation pass. Automatic translation never confirms the bug by itself; blocking counter-proof still must be searched.

Do not use `Needs Validation` as a generic outcome. Tester/runtime escalation is allowed only through `RUNTIME_PROOF_REQUIRED`, with a specific runtime reason and one narrow question. A broad validation checklist is forbidden.

Gameplay Scenario Closure is:

- `CLOSED` only when components are correlated to scenarios and causal links are resolved;
- `PARTIAL` only for irreducible Minecraft runtime proof;
- `OPEN` when a component is orphaned, a gameplay purpose is missing, a causal link is unproven, or a scenario is not bound to selected-artifact components.

An OPEN Gameplay Scenario Closure forbids claims that the audit is complete.

## Gameplay audit scenario preset

Before contradiction analysis, derive one reusable scenario preset from the selected map's own gameplay model. The preset is mandatory audit input, not a manual test matrix.

Always model the full journey:

```text
Entry → Join → Start → Preparation → Gameplay → Objective
→ Success/Failure → Transition → Final Result → Cleanup → Replay
```

Add only relevant scenario families:

- solo, two-player, maximum-party, and maximum+1 admission boundaries;
- simultaneous player actions and one-player-leaves-while-others-continue;
- multi-arena parallel start, capacity+1, isolation, cleanup, and reuse;
- disconnect/reconnect at materially different gameplay states;
- reload/recovery where persisted gameplay exists;
- deferred callbacks that can outlive player/session/arena ownership;
- first/final/max boundaries for levels, waves, retries, objectives, or timers;
- terminal collisions such as victory × timeout, defeat × respawn, or cleanup × pending work;
- complete second run after cleanup.

The engine-owned preset is `buildGameplayAuditScenarioPreset()` in diagnostic reasoning and is surfaced by Hidden Gameplay Defect Analysis. Do not replace it with an exhaustive tester checklist.

Every scenario is static-first:

```text
scenario
→ dependency chain
→ owner/state transition
→ contradiction or counter-proof
→ player-visible result
→ runtime confirmation only if Minecraft simulation is irreducible
```

A plausible explanation is not counter-proof. Counter-evidence may suppress a candidate only when it demonstrates a reachable guard/owner that deterministically prevents the wrong state.

Automatic counter-proof may only finalize when the same scenario contains selected-artifact `PROVEN` exclusion evidence whose scope overlaps the contradicted dependency. Other guards remain `COUNTERPROOF_SEARCH_REQUIRED`; keyword similarity or nearby healthy code is not blocking proof.

## Single-pass audit discipline

Default behavior is one comprehensive discovery pass before reporting.

```text
Discover all gameplay surfaces
→ close Discovery Closure
→ close/account the gameplay model
→ challenge implementation-only design assumptions
→ verify mechanic completeness and negative space
→ prioritize temporal/cross-system risks
→ check design-consistency anomalies
→ prioritize proof depth by gameplay risk
→ detect silent degradation / fallback masking
→ trace prerequisite reachability and restricted capability exposure
→ generate relevant mixed-player and repeated-run verification
→ build root-cause / constraint / evidence-convergence analysis for complex findings
→ analyze contradictions across all understood surfaces
→ apply early counter-evidence/confirmation
→ deduplicate exact candidate work while retaining corroboration
→ classify the complete surviving issue set
→ report once
```

Do not publish an early partial bug list and rely on repeated rechecks to discover the rest. Recheck is for new artifacts, changed versions, blocked evidence becoming available, or explicit verification—not as the normal discovery strategy.

If Gameplay Model Closure is OPEN, report the missing/unaccounted surfaces instead of pretending the bug list is complete. Production review and final publication must remain closure-gated.

## Bug admission

A confirmed defect requires:

1. grounded contradiction inside the selected version;
2. counter-evidence cleared;
3. player-visible impact;
4. tester-verifiable world reproduction path.

Severity:

- Blocker — required gameplay cannot normally start/continue/complete and recovery is unavailable;
- Major — core gameplay/state/fairness is materially wrong;
- Minor — limited but real player-visible impact.

## Output contract

Primary audit output uses Map Audit Output V2. Approved gameplay findings use Production Bug Report V2. Concrete developer/release work that is not justified as BUG or DESIGN_MISMATCH uses the separate canonical Developer Note lane.

Each issue must contain:

```text
Bug ID
Category
Gameplay Flow
Severity
Status
Issue
Player Impact
Reproduce Steps
Expected Behavior
Actual Behavior
Evidence
```

Tester instructions use player language:

- World
- Player
- Level
- Wave
- Arena
- Enemy

Reproduction is explanatory evidence, not a checkbox procedure. In HTML, one issue equals one checklist item. Setup/reproduction steps remain readable scenario detail and must not become individual checkboxes.

Do not expose implementation details as reproduction steps.

### Developer Notes

Developer Notes follow `references/bug-report-contract.md` and `docs/analysis/developer-note-coverage.md`.

A DEV NOTE requires:
- concrete selected-artifact evidence;
- clear engineering/release consequence;
- specific affected scope;
- actionable correction;
- no duplicate BUG/DESIGN_MISMATCH root cause;
- no speculative language.

DEV NOTE has no gameplay severity and is never a fallback for NEED_VALIDATION. Published Bug Tracker presentation keeps BUGS, DESIGN MISMATCHES, and DEV NOTES as three separate lanes.

## Review

```text
Gameplay Causal Links
→ Gameplay Defect Resolution
→ CONFIRMED_DEFECT_READY only
→ Confirmed Defect
→ Proposed Issue Set
→ chat review
→ Approved Issue Set
→ Bug Report V2
```

`RUNTIME_PROOF_REQUIRED` and `DETECTION_GAP` remain explicit audit residue and do not enter the canonical bug report as confirmed bugs. `BLOCKING_COUNTERPROOF` is retained as rejection evidence. Temporary resolver states block review.

Do not publish normal/designed behavior or disproved work as bugs. Material unresolved work must remain visible as `NEED_VALIDATION` with an exact missing-proof obligation and targeted test; only `PROVEN` findings may enter approved Bug Report V2.

Production AI report candidates must reference one or more `CONFIRMED_DEFECT_READY` Gameplay Causal Links. Multiple causal links may consolidate into one report candidate when they share one semantic root cause. Every ready link must be covered exactly once across the candidate set; unbound static/runtime candidates are rejected. Tester-originated candidates may remain independent because their proof authority is direct tester reproduction.

## Forbidden

- start from suspicious code patterns alone;
- encode regression examples as map/object-specific production rules;
- mix evidence from different map versions;
- use stale docs as gameplay authority;
- assign severity before defect admission;
- mutate target world during audit.

## Handoff

- detection gap → `m-bedrock-detection-development`
- approved repair → `m-bedrock-target-repair`

## Vital Gameplay Knowledge Closure

After canonical REPORT projection, inspect `qualityGates.vitalGameplay`. This is a read-only projection of the same SelectedMapAuditRun, not another workflow.

The projection must cover exactly the eight vital domains defined in `../../../docs/analysis/vital-gameplay-knowledge-closure.md`. Never convert a blocked domain into SAFE because no finding was detected. `RUNTIME_REQUIRED`, `DETECTION_GAP`, or unrouted material residue means the map is not yet fully understood even when existing findings are already reportable.

Prioritize Tier 0 vital domains when searching for Blocker impact: entry/admission, core progression, multi-arena isolation, and connection/recovery.

## STOP

The audit may stop only when:

```text
✓ Selected Map Version remains the sole gameplay authority
✓ Gameplay Discovery Closure is COMPLETE or justified PARTIAL
✓ Gameplay Model Closure is CLOSED or justified PARTIAL
✓ Gameplay Scenario Closure is CLOSED or justified PARTIAL
✓ Every material Gameplay Scenario is accounted
✓ Every Gameplay Scenario Component has a gameplay purpose
✓ Every RIG node has a capability-backed execution receipt
✓ MISSING_REQUIRED_KNOWLEDGE = 0
✓ BLOCKED_BY_PREREQUISITE = 0
✓ CAPABILITY_GAP = 0 or explicitly handed to Detection Development
✓ Every material Gameplay Causal Link is resolved
✓ Every CONTRADICTED link has a final Gameplay Defect Resolution
✓ GAMEPLAY_TRANSLATION_REQUIRED = 0
✓ COUNTERPROOF_SEARCH_REQUIRED = 0
✓ Confirmed defects are consolidated by gameplay/root cause
✓ Runtime proof residue is narrow and explicitly justified
✓ Detection gaps name the missing engine capability
✓ Proposed Issue Set contains confirmed defects only
✓ Vital Gameplay Closure has no hidden/unrouted material residue
✓ Any RUNTIME_REQUIRED or DETECTION_GAP vital domain is explicitly retained rather than called safe
✓ Production report is generated only after chat approval
```

Do not use analyzer execution count, surface `checked` state, or a broad tester validation list as completion evidence.


## Defect narrative binding

After `CONFIRMED_DEFECT_READY`, AI candidates must preserve the exact `expectedOutcome` and `actualOutcome` from Defect Resolution. Presentation may be improved, but factual Expected/Actual cannot drift. Multiple ready links with different factual narratives cannot be collapsed into one candidate before ConfirmedDefect grouping.


## Model packet completeness

A bounded audit task packet includes resolved selected-artifact evidence descriptors, RIG knowledge receipt context, and `unresolvedEvidenceIds`. Treat unresolved evidence as missing context, never as permission to guess. Request/resolve only those ids before continuing the same packet.