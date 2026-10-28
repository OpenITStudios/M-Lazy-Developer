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

## Publisher-aligned Bedrock skills and Skills Probe evidence

**One product workflow, two independent upstream sources.** The native developer
skills repository defines individual `bedrock-*` methodologies, complete
`skills/<name>/` folder identities, module manifests/`requires` and
release/hash locks. The Skills Probe repository separately defines the target,
its installed skills/modules lock, experimental fixtures, clean examples in
`docs/examples/index.json`, and source-scoped reports. These are developer
method and test-evidence authorities **for their own source projects**; they
are not the expected design or executed gameplay of an arbitrary map.

There are two entry routes with **one shared canonical source/reference owner**:

```text
IMPROVE SYSTEM / source refresh
  skills ZIP or verified immutable upstream ref
    → skills.json → whole-folder skill hashes → module.json/requires → source lock
  Skills Probe ZIP or verified immutable upstream ref (may update separately)
    → bedrock-target.json + skills/modules locks
    → clean-examples index + individually scoped reports
  → read-only comparison and source/consumer review
  → experiments/developer-practice-signals.json (curated REFERENCE metadata)
  → approved bounded engine/knowledge improvement, if demonstrated

TEST MAP / selected world
  exact .mcworld + selected-map source IDs
  → DISCOVERY → typed Semantic IR/Gameplay Intent
  → UNDERSTAND: up to two relevant *reviewed* developer reference patterns
     plus separately versioned clean-example/report pointers when applicable
  → FORMALIZE → EVALUATE → PROVE → REPORT
```

The first route is development intake, **not** a new gameplay-audit stage.
The second route never installs or executes external `SKILL.md`, developer
modules, test-pack code, or agent commands. The selected map remains the only
authority on its authored gameplay; an upstream coding preference is not a
map defect. Source-level references can clarify *what to investigate* but
cannot close a checkpoint or turn a candidate into a proven finding.

### Repository ownership and operating boundaries

| Responsibility | One authoritative owner |
|---|---|
| Native skill/module release identity and lock | `skills/bedrock/source-lock.json` |
| Read-only ZIP/lock/index inspection | `tooling/repository/inspect-developer-upstream.mjs` |
| Reviewed interpretations, external probe reports and clean-example index | `experiments/developer-practice-signals.json` |
| Source-evidence-matched context selection | `engine/packages/orchestrator/src/workflow/resource-context.ts` |
| Facts about Minecraft editions/Script API | `engine/knowledge/`, only after independent version-scoped validation |
| Selected-map flow and evidence admission | Existing `runSelectedMapAudit()` / source review, no second entrypoint |
| Agent task permissions and skill lanes | `.agents/skill-registry.json` and `docs/system/skill-routing.md` |

Only hashes, identities, status dimensions and safe source references are
persisted for the private upstream ZIPs. Exact ZIP bytes must be accessible
again for full reinspection; a SHA alone cannot reconstruct the source.
The original scripts/modules are **not** installed into our public repository.

### Evidence statuses must never be conflated

An example's `status`, `nodeStatus`, and `engineStatus` are independent,
upstream-reported fields. An index `PASS` can describe a narrow pattern;
a Node `PASS` never implies Minecraft rendering or gameplay `PASS`.
For example, the source index labels E3 `PASS` while its additional engine
cases remain `pending`; E9 `PASS` only checks a naming convention.
An experimental probe can deliberately contain broken fixtures. All test
claims keep their original client version, commit/lock, source path, report
and unresolved conditions. Matching the current map's actual Edition,
target and implementation remains a separate step.

**Current snapshot separation:** all 23 developer skill documents are
source-reviewed against the v0.27.0 ZIP. The existing sixteen interpretation
patterns retain their exact selected-source Semantic IR admission. One
additional, strictly conditional `bedrock-game-results` investigation
requires an exact source-owned `scriptEventReceive` rejection guard for
`daigon:get_all_scoring`, including a uniquely resolved imported constant:
**17 reviewed reference patterns**. Generic subscriptions do not qualify. Five upstream team/project/testing/release methods
remain non-audit workflows. The new
`bedrock-player-attached-particles` method is **technical REFERENCE only,
not routed to Map Audit**, because no precise supported particle-attachment
witness exists yet. Its P63 source reports include scoped failures and
blocked cases, not universal verified gameplay.

Skills Probe remains independently locked to v0.23.0, and its new
829-file source ZIP has **49 individually SHA-pinned narrative reports**.
The 22 previously indexed report texts remain byte-identical; 27 new
reports include 23 separate P63 attempts (13 overall FAIL and 10 BLOCKED,
with some narrow successful subcases). Neither the report status nor a
P63 later visual/user judgement certifies all lifecycle and strict spark
criteria. The 14 clean examples remain source-index metadata, not replayed
Minecraft tests; per-surface PASS/pending boundaries appear only on
reviewed, selected-source matched references.

Every report retains its own original archive identity, reported source
revision where available and family. The newest 106 pack TypeScript and
35 source tool files are separately hashed; current code SHA must never
silently replace a historical report fixture SHA. A future ZIP update
reviews only changed source and its real consumers, not every Map Audit
case or test suite.

See [Developer-Practice Context](../analysis/developer-practice-context.md)
for review rules and [Native Bedrock Skills](../../skills/bedrock/README.md)
for the independent source/lock contract.

## Primary outcome — understand the map and report deviations

The product succeeds when a reviewer can explain **what the selected map is designed to do**, identify **where its implementation conflicts with that design**, and give the developer **actionable, source-grounded findings**. The number of checkers, passed validation gates, graph edges, diagnostic candidates, or tests is not a measure of that success.

The useful operator-facing result, whether from a bounded ChatGPT source review or a genuinely executed programmatic audit, has three parts drawn from the same selected-artifact evidence:

1. **Map design / gameplay blueprint:** player objective; entry → setup → main mechanics → progression → victory/failure → cleanup/replay; arena/player ownership; and only material systems actually present in the map. For each claimed mechanic, distinguish authored facts from inferred purpose and unknown runtime behavior.
2. **Deviations / actionable findings:** expected behavior justified by the selected source or an explicitly approved design; the contradictory implementation or observed behavior; causal consequence; exact source/area; counter-evidence considered; `BUG` versus `DESIGN_MISMATCH`; `PROVEN` versus `NEED_VALIDATION`. Never turn a missing file, generic diagnostic, old QA item, or heuristic alone into a gameplay bug.
3. **Precise remaining questions:** only material unknowns affecting game understanding or a candidate finding, with the smallest deciding source/runtime observation. An unresolved question is not a defect and is not a reason to hide independently supported findings.

A partial source review may already give this useful **scoped** design-and-deviation assessment; it must name incomplete surfaces and must not be presented as a closed production Map Audit Report. The canonical final REPORT still obeys the existing evidence/admission rules. Do not defer all practical map understanding until every unrelated checker or possible test is finished.

Technical domains (entity, scoreboard, Script API, ticking, NBT, structures, inventory, permissions, concurrency) serve the reconstructed player journey. They are not independent feature quotas. An unfamiliar mechanic remains valid even if no pre-existing category covers it.

For unclassified material source behavior, the existing UNDERSTAND Audit Obligation can carry a bounded, selected-artifact Semantic IR source slice inside its model task: exact operation identities, authored branch membership, resolved source handoffs, and explicitly unmatched or omitted evidence. This is an **investigation aid**, not a newly inferred mechanic, an alternative Gameplay Intent authority, an executed path, or permission to close a checkpoint. A source-grounded interpretation is a hypothesis until the canonical semantic owner and proof gates re-evaluate it; absent evidence remains UNKNOWN.

For a material unknown with two precisely identified source operations, a ChatGPT model may submit one bounded SAME_AUTHORED_BRANCH_CANDIDATE through the existing selected-map model-response admission. The shared Semantic IR source owner can refute that specific direct branch-co-occurrence claim if the operations reside on opposite exclusive true/false arms of one source-located condition; otherwise the proposed relationship remains UNKNOWN. This is an ephemeral review on the existing model task only: it is discarded when the canonical audit is rebuilt and can never redefine Gameplay Intent, close checkpoints, promote issues, or assert runtime execution.

The canonical Gameplay Architecture already builds `SourceEffectSlice` records for source-local guard reads/value handoffs, possible effect ingress and source-ordered return candidates. Reuse only the same selected-artifact, same unknown/source-entry slices in the bounded UNDERSTAND model task; never rebuild slices or turn nearby same-named variables into relationships. For two exact selected-source steps, model suggestions `SOURCE_GUARD_VALUE_HANDOFF_CANDIDATE` and `SOURCE_EFFECT_RETURN_CANDIDATE` may be reviewed against these typed candidate records. A matching source relation remains a **source-only candidate**; nonmatching/incomplete relations remain UNKNOWN, and neither supplies game-design authority, runtime proof or a BUG.

A read-only source behavior shape in the existing Behavioral Model compares typed effect kinds and per-effect guard/value/return/temporal relationships without using names, paths, literal labels or map-specific identifiers. Its limited purpose is to identify **structural analog candidates** between distinct source entries—even when one is authored as scripts and another as commands or event callbacks. This is not gameplay equivalence: player objective, state ownership, runtime/version applicability, activation and actual outcome must be grounded separately. Missing ingress, unresolved source edges, or omitted operations prevent an affirmative structural match. The same pure comparison can be applied to independently sourced maps in a future explicit comparison; it does not introduce cross-map state or a new selected-map audit entrypoint.

For each unclassified source entry, the existing Gameplay Intent design-intent challenge may now provide a **bounded independent-purpose investigation**. Only exact current-artifact source operation IDs and non-hypothetical Intent subjects tied by shared evidence or an explicitly blocked subject qualify. Linked approved Game Design, unapproved/draft wording, and authored player-facing copy remain distinct source cues; none establishes that an unknown source behavior implements that design or actually delivered the UI. An existing authored player-journey candidate is exposed only when its selected source-flow ID, operation evidence, and an Intent subject all intersect. Missing independent purpose, player activation, session/arena ownership and outcomes remain open questions. For structurally similar source entries, each side's design/copy evidence is contrasted separately: a known objective on one side **never transfers** to the other. These read-only questions live on the existing UNDERSTAND model task/brief, never alter Gameplay Intent, audit admission, defect proofs, or the model-response authority.

**Cross-style source calibration, not blind scoring:** Direct read-only SHA-256
examination of BlitzBuild v1.0.2 (d3a7082af1c2e5f8ded862f801eaa3880f02beb323280648a243d31e574e5504)
and Beach Bedwars v1.1.0 (97b4b143d674b37763501c82d63ba2f7ba0602d44e71f30cde6e5a23a08979c8)
confirms materially different modular (45 JavaScript/source files) and
bundled (1 JavaScript/source file) implementations. Both contain literal false
and logical-expression writes to Boolean-like properties. The prior
source-flow abstraction discarded the already captured RHS form and used
only the generic state write operation for structural comparison. The
existing Semantic IR owner now projects an authored syntax form into the
existing source-flow step, and the Behavioral Model distinguishes literal,
logical and unknown write forms while preserving per-operation multiplicity.
Absent typed source write syntax causes INSUFFICIENT_SOURCE, not a forced
structural analog. A logical RHS may contain nested calls; no evaluated
value, receiver identity, player intent or Minecraft runtime result is inferred.
These are calibration worlds already considered during development, not
independent held-out acceptance; no frozen corpus expectation or score was changed.


## Concrete operating loop — from map to decision

Exactly **two internal skills** are registered. IMPROVE SYSTEM builds and
validates Lazy-Developer; TEST MAP uses it on one exact selected map.
Developer Skills and Skills Probe form one linked technical source and
evidence context but are **not** installed internal work lanes or native
test execution receipts.

After one Pre-Audit communication confirmation, TEST MAP has **four main
operator-facing stages**:

| Operator stage | Existing internal checkpoints (preserved) | Evidence-grounded responsibility |
|---|---|---|
| **LOAD** | TARGET + DISCOVERY | Identity/fingerprint of one immutable map, manifest/pack/source inventory and unsupported source |
| **UNDERSTAND** | UNDERSTAND + FORMALIZE | Reconstruct player journey, typed Semantic IR, gameplay intent, state, ownership, actors, arena and progression |
| **TEST** | EVALUATE + PROVE | Evaluate normal/edge/multiplayer/recovery scenarios, counterproof, applicable Minecraft version and actual proof ceiling; Probe reports remain separately versioned references |
| **REPORT** | REPORT | One design understanding, supported BUG/DESIGN_MISMATCH findings, NEED_VALIDATION and exact Audit Obligations |

This is **one** audit, not a new stage engine. The actual
`runSelectedMapAudit()`, `Mandatory Audit Procedure`,
`SelectedMapAuditAdmission`, `Defect Resolution Gate` and honesty/
proof rules remain the source of truth for internal checkpoint closure.
`operatorMapTestStageFor()` makes the grouping available in the
`MapAuditOutputV2.control.operatorStage` read-only projection and
the human-facing brief; `currentStage` remains the internal proof
and continuation detail.

Skills/Probe input is source-witness-bound through the current
`resource-context.ts` owner. Never treat upstream implementation
preferences, reported clean-example PASS, or historically failed P63
trials as a current-map gameplay contract or runtime proof. An
unsupported map mechanism is a source-identified capability gap for
an explicitly separate IMPROVE SYSTEM task; it is not automatically
resolved by spawning more skills, detectors or microtests.

Approved target repair is an **optional explicit TEST MAP suboperation**,
not a fifth operator stage or third internal skill: approval and
original-map identity → Must Change and Must Preserve → guarded
working-copy mutation → preservation/targeted proof. IMPROVE SYSTEM
owns code/source improvements and its restricted benchmark operation.

### Native developer ZIP methods inside the two Lazy-Dev flows

Adopt the **source-reviewed developer's method and its negative controls**, not the publisher's separate execution environment. `skills/bedrock/source-lock.json` holds skill/module source identities and `experiments/developer-practice-signals.json` holds reviewed methods and **independent** Skills Probe reports/installed lock.

| ZIP method family | Existing flow | Boundary |
|---|---|---|
| `bedrock-agent-team`, `bedrock-project-setup` | **IMPROVE SYSTEM: DEFINE / INVESTIGATE / DESIGN** | Identify one owner, target edition, source/proof contract; no new agent-team hierarchy or scaffold. |
| `bedrock-git-workflow` | **IMPROVE SYSTEM: IMPLEMENT / COMMIT & STOP** | Pinned GitHub source, cohesive patch, confirmed SHA; no upstream branch/release permission imported. |
| `bedrock-testing-policy` + Skills Probe | **IMPROVE SYSTEM: VERIFY** and **TEST MAP: TEST** | Focused positive/negative/runtime-boundary reasoning; Probe PASS/FAIL/BLOCKED/PARTIAL and original client/lock are not current-map gameplay proof, and broad CI is not assumed. |
| `bedrock-release-export` | Existing report/export owners, **TEST MAP: REPORT** when relevant | Keep source and edition/release authority; no automatic release or upload. |
| `bedrock-game-results` | **TEST MAP: UNDERSTAND / TEST**, conditional source-reference method | A typed system `scriptEventReceive` subscriber must have a strict early-return ID filter resolving to `daigon:get_all_scoring`, including the native imported constant. Only a results-related selected-source task can then select the reference question. The map must still expressly adopt Daigon's contract; output or BDS runtime cannot be inferred. |
| 17 source-reviewed `MAP_SOURCE_INTERPRETATION` methods | **TEST MAP: LOAD / UNDERSTAND / TEST** | Native skill/module identity + scoped current-map typed Semantic IR → relevant Resource Context hints (max two per task), not a global bug-coverage cap or automatic detector. |
| Un-routed `bedrock-player-attached-particles` | **REFERENCE ONLY** | Preserve scoped Probe negatives; abstain until a precise supported typed source witness exists. |

The existing selected-map pipeline remains: immutable artifact → source inventory → Semantic IR / Gameplay Intent → authored game systems and player journey → cross-system negative-path test/counterproof → one evidence-grounded REPORT. These map onto **LOAD → UNDERSTAND → TEST → REPORT** while retaining internal admission and runtime-proof checkpoints. Any unsupported behavior becomes a source-identified `capability-gap`, never an automatic third work lane.

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

Discovery source ownership uses the same canonical SourceRef identity but a
stricter selected-artifact site join when Semantic IR provides a range or JSON
pointer: an operation on another line/column or a different JSON member is
**not** the same evidence. A file-only SourceRef remains file-scoped evidence,
not independently verified positional proof; unresolvable `@symbol` hints and
duplicate evidence, component, causal-link or scenario IDs cannot close an
ownership question. The canonical Scenario Graph identity check prevents
ambiguous components from satisfying raw Discovery ownership, closing
Scenario Closure, or promoting PROVEN Map Audit findings while unrelated
independently scoped source evidence remains navigable. The same *exact
link + scenario + component scope* is now required by Defect Resolution,
minimum-sufficient PROVE, both PROVEN/NEED_VALIDATION report projections,
and admission of model responses (including responses with zero cited
evidence). A stale confirmation index cannot turn ambiguous graph ownership
into a provisional player-facing defect. Discovery challenges remain
source-analysis debt, not automatic BUGs, player reachability, or Minecraft
runtime proof.

`modelTaskPackets` derive conditional context from the **current,
explicit** Knowledge Catalog and developer-reference snapshot. A
continuation without those snapshots does not silently retain
previous-turn knowledge excerpts or developer hints. The CLI passes
the same explicitly loaded snapshots to its response continuation
when present. Source facts and canonical proof receipts are never
rewritten from these reference hints.

Full structured evidence remains with its original owners. Audit
revision protects source/proof decisions **and the exact current operator
intent used to formulate model tasks**; a new question or exclusion
replaces stale response authority even when the selected .mcworld bytes
and causal IDs remain unchanged. The reference snapshot lifecycle
protects read-only retrieval. A causal link must also be named by its
own scenario and its declared component IDs must belong to that
scenario before PROVE/report or model-response admission. None of these
guards is a second checkpoint, an expected-behavior source, or proof
that a previously opened Minecraft map behaved in a particular way.

### One developer-method investigation path

The CLI now loads the vetted `developerPractice` snapshot by default;
the API keeps explicit injection. Selection requires exact selected-map
source evidence and matching typed Semantic IR/question context. For a
causal-link investigation, operation-level selected-artifact source locators
already authorized by that link take precedence over a broad Gameplay Intent
file locator; a nearby write/call in the same bundled file must not select an
unrelated developer method. If no precise source site exists, current scoped
source evidence remains a limited navigation hint, never causal proof. The same
bounded context can deliver the relevant SHA-pinned developer methodology **within the same bounded
model task**: actual SKILL.md chapter references, a three-step source
investigation, a concrete design counterexample, and linked example
module/unit-test/checker/probe sources. This replaces scattered
standalone developer advice with one source-grounded investigation
path. Additional contexts remain omitted if no exact selected-map
typed source cue exists.

The five team/release/setup/testing workflow methods are
development-only provenance. The Daigon-specific results method is a
conditional source-interpretation question, not a universal gameplay contract.
Neither these developer methods nor workflow preferences can become
gameplay Expected Behavior or a detector by themselves. All external tool scripts,
developer unit-test sources and probe reports are **NOT executed**
during source reference retrieval. The current source artifact and
canonical proof gate always decide the map finding.

### External developer source: comparison, never replacement

The currently source-reviewed `minecraft-bedrock-agent-skills` v0.27.0
methods and separately locked Skills Probe v0.23.0 installed skills are
optional **REFERENCE** input
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
→ runSelectedMapAudit() [only when genuinely executed]
→ LOAD        [TARGET + DISCOVERY internal checkpoints]
→ UNDERSTAND  [UNDERSTAND + FORMALIZE]
→ TEST        [EVALUATE + PROVE]
→ REPORT      [REPORT]
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

### Internal checkpoint meanings (not operator stages)

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