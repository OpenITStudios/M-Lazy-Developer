---
id: document.analysis.mandatory-audit-procedure
class: DOCUMENT
domain: analysis
role: WORKFLOW
authority: CANONICAL
lifecycle: ACTIVE
---

# Mandatory Gameplay Audit Procedure

> Operator navigation starts at `master-selected-map-audit-workflow.md`. This document remains the executable checkpoint contract and does not define a competing operator flow.

## Purpose

This is the canonical base procedure for every selected-map gameplay audit.

It is not a tester checklist and it is not a second knowledge base. It defines the minimum complete work that must exist before an audit can claim closure.

Before this production flow starts, user-initiated pre-testing audits require one communication preflight:

```text
user request
→ normalized prompt intake
→ Pre-Audit Plan
→ explicit chat confirmation
→ confirmation receipt
```

This preflight confirms **what will be checked and how the audit will work**. It is not a gameplay checkpoint and does not alter stage authority.

The production flow itself remains linear and has one canonical order:

```text
TARGET
→ DISCOVERY
→ UNDERSTAND
→ FORMALIZE
→ EVALUATE
→ PROVE
→ REPORT
```

Within EVALUATE, examine debit → material/reference → grant/mutation → rollback → feedback for value-consuming transactions, and check active-session reload/bootstrap separately from player reconnect where applicable. These are scoped checks, not workflow stages.

TARGET and DISCOVERY are first-class ordered stages. They are not aliases of UNDERSTAND and they are not parallel workflows. No later stage may authorize a decision while an earlier stage is blocked. Runtime evidence, review, HTML, and other projections are continuations or presentations of this same flow, never alternate audit paths.

Supporting documents such as Gameplay Model Closure, Blind Spots, and Cross-System Interaction provide specialist knowledge. They do not replace this procedure and they do not own a parallel checklist.

## Coverage adequacy invariant

Coverage presence is not coverage completion.

For every discovered material gameplay surface, the canonical audit must prove one of:

```text
static proof sufficient
or
targeted runtime proof executed/requested as an Audit Obligation
or
Detection Gap recorded as an Audit Obligation
or
not-applicable with positive evidence
```

A discovered surface, analyzer execution receipt, scenario object, or domain label by itself is never enough to claim that the required behavior was tested.

Unresolved evidence must remain actionable:

```text
RUNTIME_BLOCKED
→ exactly one narrow Audit Obligation / runtime proof request

DETECTION_GAP
→ exactly one Audit Obligation for missing semantic/detection proof
```

The publication gate may stop final closure, but investigation may continue collecting high-confidence evidence from later surfaces. An earlier blocker must never make unrelated required tests disappear.

### Boundary policy

When a material capacity or count exists, prefer meaningful boundaries rather than an arbitrary representative sample:

```text
1
2 when concurrency exists
known safe limit
safe limit + 1
selected-map maximum
```

Deduplicate identical values. For progression counters also cover first, final-1/final, zero remaining, and the transition immediately after completion when applicable.

### Inverse/negative-space policy

Every acquired or one-way material action must have its semantic inverse or explicit terminal accounting challenged:

```text
Acquire   → Release
Reserve   → Free
Lock      → Unlock
Spawn     → Death/remove accounting
Increment → Decrement/consume
Grant     → Clear/restore/reset
Persist   → Restore/reset
Schedule  → Cancel/revalidate
Create    → Cleanup
```

Absence of the inverse is not automatically a bug, but it is a mandatory contradiction/test candidate until selected-artifact evidence proves why no inverse is required.

## Flow-first execution rule

The checkpoint owner remains TARGET → DISCOVERY → UNDERSTAND → FORMALIZE → EVALUATE → PROVE → REPORT, but checks are executed and presented in player-flow order:

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

Technical domains such as chunk simulation, combat, inventory, persistence, economy, entity AI, spatial authority, and multi-arena are attached to the gameplay stage where they affect the player. They must not become independent audit branches.

For every material gameplay stage record:

```text
Entry condition
Owner
Required state/components
Player action / system action
Success condition
Failure condition
Next stage
Cleanup / recovery
Applicable technical checks
```

A map may merge or omit stages. Applicability is derived from the selected artifact, not forced from this template.

## Issue taxonomy rule

Only causal gameplay findings may be classified as issues. Discovery gaps, model gaps, unresolved runtime dependencies, incomplete counter-proof, negative-space risks, temporal risks, and unclassified replica divergence remain `Audit Obligation` until they establish a player-visible causal contradiction.

Confirmed / confirmation-ready gameplay findings must be classified through one taxonomy before REPORT:

```text
issueType
+ gameplayFlow
+ failureDomain
+ contributingDomains
+ severity at confirmed-report classification
```

Failure domain describes the primary gameplay failure surface, not necessarily every technical subsystem involved. Cross-system involvement is preserved in `contributingDomains`.

Examples:

```text
wave cannot complete because remote mobs stop simulating
primary: progression-wave-objective
contributing: chunk-simulation, entity-ai-combat

6 arenas presented but only 2 can run
primary: arena-multi-arena
issueType: DESIGN_MISMATCH

purchase removes coins but grant fails
primary: inventory-economy
issueType: BUG
```

Severity is impact-derived later; domain must never preselect severity.

## Issue classification rule

After a contradiction survives proof, classify it exactly once by:

```text
Issue Type
→ Gameplay Flow
→ Primary Failure Domain
→ Contributing Domains
→ Information Mismatch facet
→ Severity after player-impact proof
```

Cross-system participation does not create extra findings. One root cause remains one issue with one primary domain and optional contributing domains.

## Full-map replica flow

When repeated arenas/regions exist, full-map inspection must not audit each arena as an unrelated map. The following is one FORMALIZE → EVALUATE investigation, not parallel workflows:

```text
world DB / topology
+ source/config layout
→ detect repeated arena regions
→ normalize each arena to relative coordinates
→ select canonical baseline
→ compare world/topology fingerprints
→ compare block-entity/native records when available
→ classify replica proof
→ reconcile world DB versus source/config
→ classify delta
→ escalate only material/unresolved delta to EVALUATE/PROVE
```

Replica classification semantics:

```text
equivalent / expected variant
→ reuse baseline proof

material divergence
→ continue to causal PROVE

incomplete / no proof
→ preserve an EVALUATE C9 replica obligation; do not inherit baseline safety
→ FORMALIZE stays OPEN/PARTIAL only when authored arena count, state ownership, or lifecycle itself is unresolved
```

**Stage boundary:** FORMALIZE B4 accounts for authored arena count, state ownership and lifecycle contracts. EVALUATE C9 retains physical-versus-authored layout reconciliation, source-modeled concurrency limits and per-replica world/topology comparison. PROVE decides player-visible runtime consequences. Moving these existing obligations never satisfies them or permits whole-audit publication. A physical arena count is not proof of equivalent gameplay. Full-map closure still requires replica integrity and appropriate runtime/source ownership reasoning.

Do not generate one duplicated bug per arena when the same root cause affects all equivalent replicas. Conversely, do not generalize one arena's proof to all replicas when a material delta exists.

## Crosscheck rule

Every contradiction reaching PROVE must be challenged from all context-relevant dimensions before confirmation:

- guard / eligibility;
- scope;
- exclusion;
- ownership for shared or multiplayer resources;
- generation/revision for deferred, retry, reconnect, reload, or reuse paths;
- cleanup/release for terminal and replay paths;
- physical collision / barrier / geometry when reachability depends on space;
- role, permission, operator/Roommaster, admin tag and platform capability when authority matters;
- gamerule / world-setting baseline when world behavior is part of the claim;
- guard activation / registration so dead or uninstantiated protection is never credited;
- client/server representation when a predicted world mutation is cancelled or rewritten.

Every proposed finding must preserve a causal chain:

```text
reachable trigger
→ authoritative mechanism
→ expected contract
→ failed/missing protection
→ wrong reachable state
→ player-visible consequence
```

Before confirmation, actively search for a Blocking Proof that breaks the chain. A supporting condition such as `mayfly=true`, a loading-bound crossing, `doMobSpawning=false`, or the presence of a guard class is not by itself proof of the final consequence.

Technical root cause and player-visible consequence are recorded separately. A valid technical constraint may explain the root cause while the reduced/misleading gameplay capability remains a reportable issue.

## Checkpoint contract

Every checkpoint in this procedure is executable and must define:

```text
Trigger
Required Inputs
Mandatory Questions
Required Evidence
Failure Patterns
Output
Closure Rule
```

A heading without these answers is not an implemented audit procedure.

---

## Operator Vocabulary

Use these terms consistently throughout the audit.

| Term | Meaning |
| --- | --- |
| **Check** | One applicable integrity analysis performed against the selected artifact. |
| **Contract** | The expected lifecycle or state relationship that the check evaluates. |
| **Crosscheck** | A targeted interaction check between applicable systems that share state, ownership, timing, or resources. |
| **Contradiction** | Grounded evidence that actual behavior can violate the expected contract. |
| **Blocking Proof** | Evidence that prevents the suspected contradiction from occurring. |
| **PROVEN** | A reportable finding whose causal contradiction and player-visible consequence have sufficient proof. |
| **NEED_VALIDATION** | A confirmation-ready finding with exactly identified missing proof that cannot currently be resolved from available selected-artifact evidence. |
| **Audit Obligation** | Unresolved audit/model/proof work that is not yet justified as a gameplay finding. |
| **Runtime Verification** | One narrow in-game question used only when the deciding behavior is irreducible from available static evidence. |
| **Closure** | The point where an applicable check is resolved as safe, contradiction, or explicitly unresolved. |

Naming rules:

- Prefer concrete gameplay/system names over abstract framework terminology.
- Use **check** for routed audit work; reserve **contract** for the expected behavior being evaluated.
- Use **Crosscheck** consistently for interactions between systems.
- Do not use `candidate` as a user-facing issue status.
- Do not use `runtime validation`, `runtime residue`, or generic `needs testing` as final finding labels.
- BUG and DESIGN_MISMATCH are issue types; PROVEN and NEED_VALIDATION are proof states. Do not mix these axes.

---

# A. UNDERSTAND

## A1. Selected Artifact Integrity

### Trigger

Always.

### Required Inputs

- selected `.mcworld`;
- map/version metadata;
- behavior/resource pack manifests;
- file inventory;
- artifact fingerprint/identity where available.

### Mandatory Questions

- What exact artifact is being audited?
- What map/version does it claim to be?
- Which packs belong to this selected artifact?
- Is any stale/duplicate/foreign pack or source mixed into the audit?
- Are Expected and Actual Behavior being derived from this same artifact?

### Required Evidence

At minimum:

```text
artifactId
mapVersion
pack identities
file inventory
source/artifact fingerprint when available
```

### Failure Patterns

- multiple map versions mixed;
- old/development sources entering gameplay authority;
- manifest or pack identity mismatch;
- artifact version ambiguity;
- current behavior inferred from archive/reference material.

### Output

`SelectedArtifactReceipt` or equivalent authoritative artifact identity record.

### Closure Rule

CLOSED only when one exact selected map/version is deterministic and all current gameplay evidence is scoped to it.

---

## A2. Gameplay Surface Discovery

### Trigger

Always.

### Required Inputs

Selected-artifact sources, including applicable:

- scripts;
- functions;
- entities;
- structures;
- dialogue/UI;
- scoreboards;
- tags;
- commands;
- dynamic properties;
- world DB/native data.

### Mandatory Questions

For each discovered surface:

- What is it?
- Is it player-visible or progression-significant?
- What gameplay purpose does it serve?
- Does it create/read/mutate state?
- Does it have lifecycle or ownership?
- Which other systems depend on it?

### Required Surface Classes

The engine must actively discover applicable members of:

```text
ENTRY
JOIN
READY
START
ARENA
PHASE
LEVEL
WAVE
OBJECTIVE
ACTOR
ITEM
INVENTORY
COMBAT
DEATH
REVIVE
RESPAWN
REWARD
SCORE
CURRENCY
SHOP
TELEPORT
CINEMATIC
INPUT_LOCK
QUEUE
CAPACITY
PERSISTENCE
RECONNECT
RELOAD
CLEANUP
RETRY
VICTORY
DEFEAT
WORLD_MUTATION
STRUCTURE
```

This list is a discovery vocabulary, not an instruction that every map contains every surface.

### Required Evidence

For every material surface:

```text
surfaceId
type
selected-artifact source
gameplay purpose
owner/scope if known
dependencies
player-visible?
material?
```

### Failure Patterns

- material surface exists with no semantic owner;
- implementation exists but no gameplay purpose can be mapped;
- unparsed/unsupported material source silently disappears;
- discovered source omitted because the happy path does not use it.

### Output

Gameplay Surface Inventory.

### Closure Rule

Every material raw source/surface must have an exact selected-artifact indexed, parse-failed, unsupported, or unresolved-target disposition. A2 owns source/surface accounting, not the meaning of already-indexed gameplay. Semantic gaps, unowned execution facts and gameplay intent unknowns remain A7 UNDERSTAND obligations. Unresolved executable/scheduled targets, unsupported source families and incomplete native scans still block A2. A2 COMPLETE never authorizes NOT_APPLICABLE when material semantics remain unresolved.

---

## A3. Player Journey Reconstruction

### Trigger

Always.

### Required Inputs

Gameplay Surface Inventory and selected-artifact gameplay intent.

### Mandatory Questions

At every major stage:

- How does the player enter?
- What triggers this stage?
- What state must already exist?
- What state is created or consumed?
- What constitutes success?
- What constitutes failure?
- How does the player leave?
- What happens if the player disappears?

### Required Journey

At minimum map the applicable chain:

```text
ENTRY
→ JOIN
→ READY / START
→ SETUP
→ ACTIVE GAMEPLAY
→ PROGRESSION
→ TERMINAL
→ CLEANUP
→ REPLAY / EXIT
```

Branches are allowed and expected.

### Required Evidence

For each stage:

```text
Stage
Entry Condition
Owner
State Created
State Consumed
Success Exit
Failure Exit
Cleanup
Next Stage
```

### Failure Patterns

- stage has no grounded entry or exit;
- only happy path exists;
- failure has no exit;
- cleanup is assumed rather than reachable;
- retry/replay route is missing;
- a stage can be entered with impossible prerequisites.

### Output

Player Journey Graph.

### Closure Rule

Every required gameplay stage has grounded entry, success/failure exit, and next-state accounting.

---

## A4. State Registry

### Trigger

Whenever gameplay state exists.

### Required Inputs

Semantic IR, gameplay intent, scripts/functions, scoreboards/tags/properties.

### Mandatory Questions

For every material state:

- What is its scope?
- Who creates it?
- Who reads it?
- Who mutates it?
- Who clears it?
- What is its lifetime?
- Is it persisted?
- Can it become stale?

### Required State Record

```text
State ID
Scope: player / arena / session / world / entity
Created By
Read By
Mutated By
Cleared By
Lifetime
Persistence
Stale-State Risk
```

### Failure Patterns

- write without clear;
- multiple writers without authority;
- arena-local gameplay using world-global state;
- offline/dead player remains counted;
- state survives beyond its intended generation/run;
- stale state can mutate a later run.

### Output

State Registry.

### Closure Rule

Every material state has scope, lifecycle, and clear/preserve semantics or an explicit Detection Gap.

---

## A5. Ownership Registry

### Trigger

Whenever multiple players, sessions, arenas, entities, callbacks, or mutable shared resources exist.

### Required Inputs

State Registry, gameplay intent ownership edges, semantic IR, lifecycle analyzers.

### Mandatory Questions

For every material owner:

- Who owns this mutation/resource?
- What identifies the owner?
- Is there a generation/revision?
- How is ownership acquired?
- How is it validated before mutation?
- How is it released?
- What happens if the owner disappears?

### Required Ownership Record

```text
Owner
Owner ID
Generation/Revision
Acquire
Validate
Release
Owned Resources
Owner-Disappearance Behavior
```

### Failure Patterns

- no owner;
- ambiguous owner;
- old generation can commit;
- reconnect creates conflicting owners;
- arena reuse occurs before old ownership invalidation;
- global mutation executed from arena path without lease/restore.

### Output

Ownership Registry.

### Closure Rule

Every material mutable resource has one authoritative lifecycle or an explicit unresolved ownership gap.

---

## A6. Progression Contract

### Trigger

Whenever gameplay progresses through objectives, waves, levels, scores, checkpoints, kills, collections, or stages.

### Required Inputs

Player Journey Graph, State Registry, actor/objective mechanics.

### Mandatory Questions

- What starts progression?
- What condition is counted?
- Where is it tracked?
- What mutates the tracker?
- What marks completion?
- What transition consumes completion?
- What happens if an intermediate event fails or disappears?

### Required Chain

```text
Trigger
→ Condition
→ Tracker
→ Mutation
→ Completion
→ Transition
```

### Failure Patterns

- spawn/request counted but actual result not tracked;
- removal/death does not decrement accounting;
- retry duplicates tracker state;
- objective reaches zero but transition never fires;
- transition fires without satisfying objective;
- failed intermediate work disappears from accounting.

### Output

Progression Contract per material objective/mechanic.

### Closure Rule

Every required progression chain reaches a grounded player-visible transition or is explicitly unresolved.

---

## A7. Gameplay Model Closure

### Purpose

Aggregate UNDERSTAND closure after journey, state, ownership, and progression reconstruction.

### Closure Rule

Gameplay Model Closure is `CLOSED` only when:

- the material state model is complete;
- material boundaries are extracted;
- no discovered material surface remains unaccounted.

`OPEN` or `PARTIAL` blocks continuation through the Mandatory Audit Procedure. Admission does not re-evaluate this closure separately.

### Output

`GameplayModelClosure`.
---

## Detection Coverage Assurance

The executable coverage-accounting rules are owned by `master-selected-map-audit-workflow.md`.

Mandatory integration points:

```text
A2 Gameplay Surface Discovery
→ before specialist routing, enumerate every repeated physical arena/region/plot/room and normalize replica geometry/footprint
→ create/update Coverage Ledger

A4/A5 State + Ownership
→ derive authored Player Capability Model (game mode, abilities, inventory/catalog/build/interact acquisition surfaces) for every ordinary player role
→ build Mutable-State Reverse Index
→ promote every broad fresh-session reset into a state-agnostic per-player lifecycle invariant covering inventory, equipment, currency/scores, tags, properties, role/assignment, mode/capability, health/effects, position/checkpoint, and player-facing session state
→ trace every cleanup writer through its final player/entity ownership scope
→ when cooperative progression exists, model Required / Assigned / Online / Eligible / Gate-Observed participant sets separately

A8 Cross-System Coverage
→ generate required Crosschecks
→ require Cleanup × Cross-Arena Ownership for broad cleanup selectors
→ require Recurring World Mutation × Arena Isolation for player/entity-relative mutations

A22 Applicable Check Router
→ bind every material surface to applicable checks

FORMALIZE
→ derive structural invariants and transition graphs
→ validate material cross-content references

EVALUATE
→ run lifecycle differentials, boundaries, repeated-run and partial-failure scenarios
→ derive bounded Multi-Scenario Simulation cases for applicable multiplayer/multi-arena systems
→ interrupt material lifecycle boundaries with disconnect/reconnect where applicable
→ reduce scenarios through material pairwise coverage and dominance pruning without losing distinct ownership/order boundaries
→ retain one Scenario Proof Receipt per material scenario
→ run Connection Recovery Invariants when reconnect exists
→ pass the Simulation Honesty Gate
→ run Scenario Coverage Gate so no material shared-state interleaving is silently skipped
→ evaluate ordinary player actions against applicable gameplay invariants using the Adversarial Player Abuse Model
→ derive bounded misuse/edge-case sequences for progression, inventory/economy, ownership, capacity, reconnect/recovery, terminal/reward, world mutation, and reachable developer controls
→ run the Abuse Coverage Gate so every material player-controlled surface is accounted

→ require every progression-mutating developer item to close its acquisition graph through recipe ingredients and ordinary gameplay availability before suppression

PROVE
→ causal slice each contradiction
→ close Reachability / Contract / Contradiction / Player Consequence / Affected Scope / Blocking Proof claims
→ attempt formal Absence / Temporal Proof and deterministic Proof Substitution
→ retain NEED_VALIDATION only through the Promotion Matrix

before REPORT
→ Coverage Completeness Gate must pass
```

Regression cases are recall expectations only; they cannot supply current-artifact evidence.

---

## UNDERSTAND execution map

Run the base reconstruction first, then route only applicable specialist checks.

```text
A1–A7  Base reconstruction
       artifact → surfaces → journey → state → ownership → progression → closure
          ↓
A8     Cross-System Coverage Matrix
          ↓
A22    Applicable Check Router
          ↓
        only applicable checks from:
        A9–A21 and A26–A30
          ↓
A16 / A31 targeted Crosschecks when systems share material state/resources
          ↓
A23    Audit Priority & Stop Rules
          ↓
A24    Duplicate Finding Consolidation
          ↓
A25    Audit Coverage Summary
          ↓
B. FORMALIZE
```

Numbering identifies stable contract references; it does **not** mean every A-section runs sequentially.

---

## A8. Cross-System Coverage Matrix

### Purpose

Before FORMALIZE, convert reconstructed gameplay into explicit contradiction searches so high-value defect families cannot disappear behind a generally complete player journey.

### Required matrix

For every applicable selected-map system, record whether each boundary is grounded, contradicted, or not applicable:

```text
System
→ Start / admission
→ Active owner
→ Deferred owner
→ Completion
→ Cleanup
→ Reuse
→ Disconnect / reconnect
→ Cross-arena scope
→ Capacity / boundary
→ Player-facing feedback
```

### Mandatory high-yield joins

Always inspect these joins when both sides exist:

- session start × inventory reset;
- death countdown × reconnect recovery;
- wave pending work × retry queue × completion;
- arena reset × arena reuse;
- ticking/residency lease × cleanup × next generation;
- global selector/tag × arena-local gameplay;
- shop/loadout writer × death/reconnect/reset writer;
- terminal trigger × another terminal trigger;
- visible arena count × safe concurrent resource budget;
- remote entity/objective × simulation residency;
- structure/world mutation × next round footprint;
- score/reward commit × retry/reconnect/duplicate terminal path.

### Closure rule

UNDERSTAND is not complete merely because each subsystem is understood independently.

Every applicable high-yield join must be:
- proven safe by blocking evidence;
- promoted to a contradiction for EVALUATE/PROVE;
- or explicitly recorded as unresolved residue.

This matrix is not a tester checklist and must not be emitted as a parallel user-facing report.

---

## A9. Core Gameplay Integrity Contracts

These contracts are mandatory when the selected map exposes the corresponding system. They refine the Blindspot Closure Matrix; they do not create a second audit lane.

### Inventory, Loadout & Economy Integrity

Build one writer matrix per player inventory/equipment/economy scope:

```text
boundary/event
→ writer
→ scope
→ full clear / partial clear / grant / replace / purchase / refund
→ idempotency or generation guard
→ competing writer
→ postcondition
```

Always include applicable boundaries:
- fresh session;
- join / late join;
- disconnect / reconnect;
- kit/loadout change;
- shop purchase/refund;
- death/respawn;
- level transition;
- retry/restart;
- terminal cleanup;
- replay/new session.

Required contradiction searches:
- stale item survives a fresh-session boundary;
- managed cleanup misses ordinary inventory;
- duplicate grant/purchase/reward after retry/reconnect;
- two writers race or overwrite each other;
- reset removes state that should persist;
- persistence restores state that should have been cleared;
- economy commit occurs without matching ownership/session guard.

A player-visible inventory finding is PROVEN statically when the exact boundary, all applicable writers/clearers, missing exclusion/idempotency, and resulting wrong postcondition are grounded.

### Multi-Arena Capacity & Isolation

Build:

```text
visible arenas
→ admission owner
→ declared limit
→ actual shared resources per active arena
→ safe resource budget
→ queue/rejection behavior
→ isolation selectors/state
→ cleanup/release
→ arena reuse
```

Always challenge:
- visible capacity vs delivered concurrency;
- simultaneous start;
- safe limit and safe limit + 1;
- global tags/selectors from arena-local paths;
- cross-arena entity/world/UI/reward mutation;
- one arena cleanup releasing another arena's resource;
- reuse before old generation/reset completion;
- reconnect assignment and stale arena ownership.

Do not require runtime to prove a deterministic capacity mismatch when visible capacity, admission limit, and resource budget are source-grounded.

### Progression, Wave & Objective Integrity

For every required unit of progression, distinguish requested work from completed work:

```text
required work
→ scheduled/pending
→ attempt
→ retry/deferred owner
→ actual spawned/created/committed work
→ live/outstanding accounting
→ completion predicate
→ transition
```

Always challenge:
- pending work removed before retry resolves;
- spawn/request failure disappears from accounting;
- duplicate retry increments twice;
- entity unload/remove bypasses decrement;
- completion observes zero while required work remains pending;
- transition can fire twice;
- terminal path races normal completion;
- wave/level reset leaves delayed callbacks from the old generation.

A wave/progression finding is PROVEN when required work can deterministically escape the completion predicate or the transition can deterministically commit under an invalid state.

### Family closure

For each applicable check, closure requires one of:

```text
SAFE
→ exact blocking guard/ownership/accounting proof

CONTRADICTION
→ send to EVALUATE / PROVE

UNRESOLVED
→ preserve the exact missing claim and proof route
```

Generic statements such as “needs runtime testing” do not close a family.
---

## A10. Deferred Work & Generation Safety

### Purpose

Find bugs caused by valid work from an old lifecycle committing after ownership has moved to a new lifecycle.

This contract is mandatory whenever gameplay uses delayed callbacks, scheduled work, async reset, retry queues, deferred cleanup, reconnect recovery, or reusable arenas/sessions.

### Required timeline

For every applicable deferred operation reconstruct:

```text
schedule
→ captured owner/session/arena/generation
→ delay / await / retry
→ current owner at commit time
→ guard / generation check
→ mutation
→ completion / cleanup
```

### Mandatory challenges

- old reset commits after a new run starts;
- old cleanup releases a resource acquired by a new generation;
- delayed wave/spawn work survives retry/restart;
- reconnect recovery overwrites death/respawn ownership;
- timeout/terminal callback commits after another terminal path;
- delayed reward/score commit occurs after session replacement;
- deferred world mutation targets a reused arena;
- scheduled UI/message/audio is delivered to a stale owner.

### Static proof rule

A race does not require runtime merely because timing is involved.

It is statically PROVEN when:
- both operations are reachable;
- their ordering can overlap under source-defined scheduling/async behavior;
- they target the same material state/resource;
- the old operation lacks an applicable owner/generation/exclusion guard;
- the resulting commit violates the new lifecycle contract.

If overlap itself depends on native/runtime timing not decidable from source, preserve only that exact ordering question.

---

## A11. Terminal State & Duplicate-Commit Safety

### Purpose

Prevent duplicate endings, duplicate rewards, contradictory terminal states, and cleanup executing more than once.

For each game/session/level enumerate every terminal trigger:

```text
win
loss
timeout
flag/objective completion
all players gone
admin/developer restart
retry
disconnect-driven termination
fatal/reset path
```

Build:

```text
terminal trigger
→ terminal guard
→ state transition
→ score/reward commit
→ player mode/teleport
→ cleanup
→ persistence
→ reuse publication
```

Challenge every pair of simultaneously reachable terminal triggers.

Required questions:
- Is terminal commit idempotent?
- Is there one authoritative ended/finalizing state?
- Can two callbacks both pass their guards before either commits?
- Can reward/score persist twice?
- Can cleanup run twice or release a new generation?
- Can timeout race objective completion?
- Can retry/restart race normal terminal cleanup?

A terminal collision is PROVEN when two reachable terminal paths can both commit a non-idempotent consequence without a blocking guard.

**EVALUATE C6 source acceptance:** A compiled `terminal-collision` preset alone does not close Terminal Ownership. The canonical scenario must contain a selected-artifact-backed causal dependency reaching an authored outcome, or a separately classified multi-ingress terminal race, and its scoped knowledge receipts must be satisfied. Unresolved terminal ingress, precedence, or race ownership leaves C6 OPEN. This uses the same source-link and knowledge-applicability checks as EVALUATE C9. C6 CLOSED only means this bounded source contract was evaluated; PROVE independently decides causal defects, blocking counterproof, and irreducible runtime questions. No `DETECTION_GAP` link, generated preset label, or unrelated domain receipt may substitute for selected-source evidence.

---

## A12. Player-Facing Information Integrity

### Purpose

Treat wrong player-facing information as a real gameplay/reporting defect instead of ignoring it because mechanics still run.

For each material UI/feedback surface map:

```text
source-of-truth state
→ formatter/presenter
→ audience/scope
→ update trigger
→ clear/replace trigger
→ displayed claim
```

Applicable surfaces include:
- scoreboard;
- actionbar/title;
- NPC/dialogue;
- queue/start feedback;
- wave/level/objective status;
- timer;
- inventory/shop price or availability;
- arena/capacity presentation;
- win/loss/reward feedback.

Challenge:
- stale display after state transition;
- wrong arena/player scope;
- displayed capacity different from playable capacity;
- timer/status not cleared;
- UI says success while commit failed;
- UI says available while admission rejects;
- scoreboard/objective value sourced from a different lifecycle owner.

Classification remains evidence-driven:
- broken presentation of an implemented contract → BUG;
- authored/presented capability differs from delivered capability → DESIGN_MISMATCH.

---

## A13. Ticking, Residency & Remote Simulation

### Purpose

Prove whether gameplay-critical world regions remain simulated for the full period in which remote gameplay depends on them.

For every gameplay-critical remote region build:

```text
gameplay dependency
→ region geometry / coordinates
→ maximum player distance
→ residency requirement
→ residency owner
→ acquire/create
→ readiness before use
→ resource/chunk cost
→ shared capacity
→ release
→ reuse / next generation
```

Mandatory searches:
- configured ticking/residency region is never created;
- region exists but does not cover the actual spawn/path/objective footprint;
- gameplay starts before residency readiness;
- player movement can unload a required remote dependency;
- active arenas exceed safe residency capacity;
- cleanup removes another arena/generation's residency;
- acquire exists without reachable release;
- release exists without generation/owner validation;
- one oversized region exceeds platform/resource constraints;
- source/config declares residency that runtime owner never consumes.

### Geometry proof

Do not stop at the presence of a ticking-area declaration.

When coordinates are available, compare:
- declared bounds;
- gameplay spawn/objective/path bounds;
- arena offsets/replicas;
- player-local simulation assumptions;
- resource/chunk budget.

A missing or insufficient residency mechanism is statically PROVEN when a required remote dependency and its uncovered/unowned simulation region are both source-grounded.

Runtime is reserved for native simulation behavior that source + geometry + platform constraints cannot decide.

---

## A14. Entity Lifecycle & Objective Accounting

### Purpose

Prevent entity behavior from being treated as correct merely because spawn code exists.

For each progression-critical entity family reconstruct:

```text
request/spawn trigger
→ spawn attempt
→ retry owner
→ actual entity
→ arena/session ownership
→ target/navigation
→ combat/interaction
→ death/remove/despawn/unload
→ progression accounting
→ cleanup
```

Mandatory challenges:
- failed spawn is counted as completed work;
- retry creates duplicate entities/accounting;
- spawned entity lacks arena/session ownership;
- global selector can mutate another arena's entity;
- despawn/unload/remove bypasses objective accounting;
- entity death is counted twice;
- target becomes invalid without recovery;
- navigation-critical entity is outside residency;
- cleanup removes entities belonging to another generation;
- stale entity survives replay/reset and satisfies or blocks a later objective.

### Entity/accounting proof rule

Never equate:
- spawn requested with entity exists;
- entity removed with objective completed;
- zero currently visible entities with zero required outstanding work.

Progression proof must reconcile required, pending, live, terminal, and cleaned entity state.

---

## A15. World Mutation & Reset Integrity

### Purpose

Find persistent world-state defects that survive level, round, arena, or session boundaries.

For each material mutation build:

```text
baseline footprint
→ mutation owner
→ changed footprint
→ persistence
→ reset/restore source
→ restore footprint
→ uncovered delta
→ next-session reader/dependency
```

Applicable mutations include:
- structure load/place;
- fill/setblock;
- block break/place;
- doors/gates/barriers;
- fluids;
- containers/block entities;
- temporary paths/platforms;
- arena destruction/building;
- reset schematics/structures.

Mandatory challenges:
- reset footprint is smaller than mutation footprint;
- old structure cells remain outside the next footprint;
- structure replacement leaves block entities/container state;
- async restore overlaps next-session mutation;
- global fill/execute escapes arena scope;
- player-built blocks survive when a fresh arena is expected;
- required authored blocks are removed and never restored;
- replica arena geometry differs from canonical reset assumptions;
- reset publishes arena reusable before mutation finishes.

### Footprint-delta proof

When before/after/reset geometry is available, calculate:

```text
mutation footprint - guaranteed restore footprint
```

Any material non-empty delta that survives into a later gameplay dependency is a deterministic contradiction; do not require runtime solely to observe leftover blocks.

---

## A16. Simulation–Entity–World Crosscheck

### Purpose

Close defects that exist only when the three contracts above interact.

Always challenge applicable joins:

- remote spawn × missing residency;
- navigation path × unloaded region;
- entity retry × arena reset;
- entity cleanup × reused arena;
- structure placement × spawn/nav footprint;
- world reset × ticking/residency release;
- global world mutation × multi-arena isolation;
- replica geometry × source/config offset;
- delayed structure mutation × terminal/retry;
- entity objective × persistent stale block/entity from prior run.

### Closure

These joins must resolve to SAFE, CONTRADICTION, or an exact irreducible missing claim before EVALUATE/PROVE closure.

---

## A17. Persistence, Reconnect & Reload Integrity

### Purpose

Prove whether state survives, restores, or resets at the correct lifecycle boundary.

For every material persisted or reconnect-restored state build:

```text
state
→ persistence scope
→ writer
→ save trigger
→ restore trigger
→ owner/session identity
→ generation/version guard
→ clear/reset trigger
→ fallback when owner is gone
→ post-restore gameplay effect
```

Mandatory challenges:
- stale session state restores into a fresh session;
- reconnect restores state that death/reset already invalidated;
- disconnect misses a required fresh-session clear;
- player is assigned to the wrong arena/session on reconnect;
- persisted inventory/economy duplicates a later grant;
- old dynamic property/tag survives replay;
- restore happens before authoritative owner/session resolution;
- reload/reconnect replays a one-shot reward or terminal commit;
- reset clears persistent state that should survive;
- persistent state has append/growth with no bounded clear.

### Reconnect interleaving

When multiple reconnect handlers exist, order every writer by scheduling boundary and target state.

Do not declare reconnect safe because each handler is individually reasonable.

If handler A restores a protected lifecycle state and handler B later overwrites the same state without consulting A's owner, treat that as a direct contradiction candidate.

---

## A18. Reward, Score & Economy Transaction Integrity

### Purpose

Treat rewards and score as transactional gameplay state with explicit commit ownership.

For each material reward/score/economy mutation reconstruct:

```text
eligibility
→ owner/session
→ commit trigger
→ amount/item
→ idempotency key or guard
→ persistence
→ UI feedback
→ retry/reconnect behavior
→ rollback/refund if applicable
```

Mandatory challenges:
- terminal path can commit twice;
- reconnect/reload repeats a one-shot reward;
- retry duplicates score/currency/item grant;
- reward commits before objective success is authoritative;
- UI announces reward when commit failed;
- shop purchase removes currency without item grant;
- item grant occurs without matching currency commit;
- refund and purchase can both commit;
- cross-arena event rewards the wrong player/group;
- stale generation commits reward into a new session.

A duplicate/partial transaction is PROVEN when commit paths and missing idempotency/atomicity can be established from selected-artifact evidence.

---

## A19. Developer Tool & Permission Exposure

### Purpose

Detect development affordances that remain reachable by ordinary players and can alter progression, state, score, or report validity.

Discover all applicable:
- developer items;
- debug commands;
- skip/retry/restart controls;
- admin NPC/dialogue;
- special tags/permissions;
- test scoreboards;
- hidden interaction triggers;
- crafting paths to developer-trigger items.

For each affordance map:

```text
trigger
→ acquisition/reachability
→ permission guard
→ gameplay mutation
→ persistence/cleanup
→ ordinary-player path
```

Mandatory challenges:
- debug item can be crafted or found normally;
- command/event lacks developer permission guard;
- ordinary interaction can skip level/wave;
- restart/reset control can grief another arena;
- debug state persists after developer use;
- hidden tool alters score/reward or invalidates normal completion.

Do not classify an unreachable developer affordance as a gameplay bug. Player reachability or missing authorization must be grounded.

---

## A20. Capacity & Boundary Quantification

### Purpose

Replace vague capacity concerns with bounded quantitative proof.

For each bounded resource or gameplay limit identify:

```text
declared maximum
presented maximum
per-unit cost
shared budget
safe maximum
admission behavior
overflow behavior
cleanup/release
```

Applicable resources include:
- ticking/residency areas;
- chunks/regions;
- active arenas;
- players/teams;
- entities;
- scheduled callbacks;
- scoreboards/tags/properties where bounded;
- structure/reset workload.

Required boundary probes in reasoning:
- 1;
- 2 when concurrency exists;
- safe maximum;
- safe maximum + 1;
- presented/selected-map maximum.

Use arithmetic/static resource accounting when sufficient. Do not request broad runtime load testing merely to confirm a mathematically determined admission/capacity contradiction.

---

## A21. Recovery & Softlock Prevention

### Purpose

Ensure every abnormal but reachable player state has a normal recovery path or an intentional terminal path.

For each material abnormal state record:

```text
failure state
→ detection
→ player feedback
→ recovery owner
→ recovery action
→ timeout/fallback
→ cleanup
→ next valid state
```

Challenge:
- queue entry never admitted or cancelled;
- spectator/death state never resolves;
- wave/objective cannot progress and has no retry;
- disconnected owner leaves party/session locked;
- failed teleport/load leaves player stranded;
- failed structure/reset leaves arena permanently unavailable;
- shop/loadout failure removes required progression item with no recovery;
- UI says waiting while no owner can advance the state.

A softlock is a Blocker candidate when the normal player cannot continue or recover without leaving/restarting outside intended gameplay.

---

## A22. Applicable Check Router

### Purpose

Keep the audit complete without turning every map into a giant generic checklist.

The contracts in A8–A21 are conditional specialists. They are activated by discovered gameplay evidence, not run blindly.

### Routing rule

After UNDERSTAND reconstructs the player journey, state, ownership, progression, and gameplay surfaces, build one compact applicability record:

```text
family
→ trigger evidence
→ applicable: yes / no
→ reason
→ owned surfaces/resources
→ required joins
```

### Activation table

Activate only when the selected artifact contains the trigger:

- Inventory / Loadout / Economy → inventory writers, kits, shops, grants, equipment, currency, item persistence.
- Multi-Arena / Shared Capacity → multiple arenas/sessions/teams or shared admission/resource limits.
- Progression / Wave / Objective → waves, levels, counters, objectives, required entity/work accounting.
- Story / Quest / Dialogue → only with authored narrative, dialogue, branching, checkpoints or quest progression; check reachability, ordering, skipped steps, false completion, and recovery.
- Lifecycle Race / Generation → delayed callbacks, async work, retry, scheduled cleanup, reusable owner/session.
- Terminal / Idempotency → two or more terminal/retry/restart paths or non-idempotent terminal consequences.
- UI / Player-Facing → material scoreboard, actionbar/title, dialogue, timer, queue/capacity/reward feedback.
- Spatial / Ticking / Residency → remote world dependency, distant entities/objectives, explicit residency/ticking configuration.
- Entity Lifecycle → gameplay-critical spawned entities or entity-backed objectives.
- World / Structure Mutation → block/structure/container/world mutation expected to reset or remain arena-scoped.
- Persistence / Reconnect / Reload → saved state, dynamic properties/tags, reconnect/reload recovery.
- Reward / Score / Economy Commit → score, currency, reward, purchase, refund, one-shot grant.
- Developer / Cheat / Permission → debug/developer triggers, items, commands, tags, test controls.
- Boundary / Capacity → explicit/shared bounded resources or presented maximums.
- Recovery / No-Dead-End → waiting, spectator, queue, retry, failure/recovery states.
- Event / Scheduling Integrity → subscriptions, timers, intervals, delayed callbacks, retry schedulers.
- Identity / Selector / Cardinality → selectors, stored references, arena/session keys, shared scoreboards/tags/properties.
- Transaction / Partial Failure → multi-step mutations with commands/APIs that may fail independently.
- Bootstrap / Initialization → startup defaults, registries, readiness, reload/reinitialization.
- Resource Baseline / Leak → temporary resources created and cleaned across repeated sessions/rounds.

### Not-applicable proof

`not applicable` must be supported by discovery/model evidence. Do not run a family merely because it exists in this procedure.

### Join selection

Only generate cross-family joins when both families are applicable and share at least one material resource, owner, lifecycle boundary, selector, or commit target.

This replaces broad Cartesian-product testing.

---

## A23. Audit Priority & Stop Rules

### Purpose

Prioritize high-yield contradictions and stop analysis once sufficient proof exists.

Build one ordered work queue from applicable checks.

Priority order:

```text
1. progression blockers / no-recovery paths
2. shared ownership / cross-arena contamination
3. lifecycle generation races
4. simulation/residency blockers
5. inventory/reconnect state corruption
6. terminal/reward duplication
7. world/reset persistence
8. player-facing contract mismatch
9. lower-impact applicable residue
```

Within a priority, prefer:
- deterministic static proof over runtime;
- one root cause that explains multiple symptoms;
- shared-resource joins over isolated low-impact anomalies;
- player-visible consequence over technical irregularity.

### Stop rules

Stop investigating a candidate when:
- minimum sufficient proof is saturated and counter-proof is cleared → PROVEN;
- exact blocking proof shows the behavior is safe → suppress;
- only one irreducible deciding question remains → NEED_VALIDATION;
- the signal has no justified player-visible contradiction → Audit Obligation or suppress, as appropriate.

Do not continue searching merely to accumulate more evidence after proof saturation.

---

## A24. Duplicate Finding Consolidation

### Purpose

Prevent one underlying defect from becoming many noisy issue cards.

Before REPORT, cluster contradictions by:

```text
same owner/resource
+ same missing guard/accounting rule
+ same lifecycle boundary
+ same repair direction
```

If multiple symptoms share one causal defect, publish one issue with the affected scope and reproduction paths needed to demonstrate it.

Split findings only when:
- repair ownership differs;
- player contract differs materially;
- severity differs because consequences are independently reachable;
- fixing one does not necessarily fix the other.

Do not deduplicate unrelated defects merely because they occur in the same subsystem.

---

## A25. Audit Coverage Summary

### Purpose

Preserve audit completeness internally without leaking a giant checklist into the user-facing report.

At the end of UNDERSTAND / FORMALIZE / EVALUATE, retain one compact receipt:

```text
applicable checks
safe checks
contradiction checks
unresolved checks
cross-system joins checked
suppressed candidates with blocking proof
proven root-cause clusters
remaining exact validation questions
```

The receipt is internal audit/control data.

The user-facing outputs remain:
- concise issue list in chat;
- Map Audit output where appropriate;
- Approved Bug Report / Golden Tracker for approved issues.

Do not render the check router, work queue, or closure receipt as visible Bug Tracker UI.

---

## A26. Event Subscription & Scheduling Integrity

### Purpose

Detect duplicated, stale, or uncancelled work created by subscriptions, timers, intervals, delayed callbacks, and retry schedulers.

For each material scheduled/event-driven path record:

```text
registration
→ registration owner
→ multiplicity
→ callback owner/generation
→ cancellation/unsubscribe
→ re-registration/reload behavior
→ commit target
```

Mandatory challenges:
- handler registers twice after restart/reload;
- interval/timer survives session cleanup;
- retry scheduler duplicates pending work;
- callback fires after owner/session replacement;
- unsubscribe path is missing or unreachable;
- one event is consumed by both old and new generation;
- repeated initialization creates multiple equivalent listeners.

Static proof is sufficient when duplicate reachable registration or stale callback ownership deterministically permits duplicate/invalid mutation.

---

## A27. Identity, Selector & Result-Count Integrity

### Purpose

Ensure gameplay logic addresses exactly the intended owner, player, arena, entity, or state record.

For every material lookup/selector/reference record:

```text
identity key / selector
→ expected cardinality
→ actual possible cardinality
→ scope
→ uniqueness guarantee
→ missing-result behavior
→ multi-result behavior
→ stale-reference behavior
```

Mandatory challenges:
- code expects one result but selector can return zero or many;
- arena/session IDs collide or are reused before invalidation;
- global selector is used from arena-local logic;
- stored entity/player reference survives invalidation;
- two mechanics alias the same scoreboard/tag/property for different meanings;
- coordinate/offset identity resolves to the wrong replica;
- late join/disconnect changes the player set after a stale snapshot was captured.

Do not treat selector syntax as proof of correct cardinality. Prove the ownership and uniqueness contract.

---

## A28. Multi-Step Transaction & Failure Recovery

### Purpose

Find multi-step gameplay mutations that leave invalid state when an intermediate operation fails.

Model each material transaction:

```text
precondition
→ mutation 1
→ mutation 2
→ ...
→ commit point
→ success feedback
→ rollback/compensation
```

Applicable examples:
- currency removal + item grant;
- arena reservation + ticking/residency creation;
- inventory clear + loadout grant;
- structure reset + arena-ready publication;
- score/reward persistence + UI success;
- teleport + mode/state transition.

Mandatory challenges:
- command/API result is ignored;
- early mutation commits before later failure;
- success feedback is emitted despite failed commit;
- rollback is absent or incomplete;
- retry repeats already-committed steps;
- fail-open behavior allows gameplay after missing prerequisite;
- fail-closed behavior permanently blocks recovery.

A partial-failure defect is PROVEN when a reachable failure leaves a player-visible postcondition that violates the transaction contract.

---

## A29. Startup, Reload & Initialization Integrity

### Purpose

Ensure gameplay cannot consume state before its authoritative initialization is complete.

For each startup/bootstrap dependency reconstruct:

```text
world/script load
→ default creation
→ registry/config load
→ scoreboard/property/tag initialization
→ arena/session readiness
→ event/subscription activation
→ gameplay admission
```

Mandatory challenges:
- gameplay/event fires before required state exists;
- missing score/property defaults to a meaningful gameplay value;
- reload reinitializes only part of the state;
- subscription activates before owner registry is ready;
- arena is advertised/available before initialization completes;
- initialization runs twice and duplicates resources;
- late-created defaults overwrite valid restored state.

Readiness must be explicit or causally guaranteed; file/module order alone is not sufficient proof.

---

## A30. Temporary Resource Cleanup & Leak Detection

### Purpose

Detect temporary gameplay resources that accumulate or survive beyond their intended lifecycle.

For every applicable temporary resource define a baseline:

```text
R0 = valid pre-session baseline
→ acquire/create during gameplay
→ terminal/cleanup
→ R1 = post-cleanup state
→ classify R1 - R0
```

Track applicable resources:
- arena/player assignments;
- entities;
- tags;
- scoreboards/objectives;
- dynamic properties;
- event subscriptions;
- timers/intervals/callbacks;
- queues/retry work;
- leases/reservations;
- ticking/residency areas;
- temporary structures/blocks;
- session inventory/loadout state.

Mandatory challenges:
- producer exists with no bounded consumer/clear;
- cleanup only removes currently online/live owners;
- repeated rounds increase resource count monotonically;
- old-generation resource remains addressable;
- cleanup returns to a different baseline that affects next-session behavior;
- persistent delta is accidental but silently treated as normal.

### Baseline classification

A non-zero delta is not automatically a bug.

Classify:

```text
R1 - R0
→ intentional persistent state?
   yes → document ownership and next-session contract
   no  → does it affect later gameplay?
          yes → contradiction candidate
          no  → technical residue / Audit Obligation as appropriate
```

---

## A31. Software-State Crosscheck

### Purpose

Cross the five software-state contracts only with applicable gameplay families and shared material state.

High-yield joins include:
- duplicate subscription × reward/terminal commit;
- stale callback × arena reuse;
- selector cardinality × cross-arena isolation;
- identity collision × persistence/reconnect;
- ignored command failure × shop/loadout transaction;
- partial initialization × admission/start;
- resource leak × replay/repeated rounds;
- stale player snapshot × team/arena cleanup;
- coordinate identity × replica/world mutation;
- baseline leak × ticking/residency capacity.

Resolve each applicable join to SAFE, CONTRADICTION, or one exact unresolved claim.

---

# B. FORMALIZE

FORMALIZE converts the reconstructed gameplay into compact structural records used by the routed integrity checks. It does not repeat those checks.

## B1. Actor & Entity Model

When gameplay-critical entities exist, record:

```text
entity/actor
→ role
→ spawn trigger/location
→ required simulation
→ target/navigation
→ interaction/combat
→ death/remove
→ progression contribution
→ cleanup
```

A14 owns entity lifecycle/objective-accounting integrity. B1 only provides the structural model it consumes.

## B2. Spatial & Simulation Model

When gameplay depends on remote regions, structures, teleports, or off-player logic, record:

```text
region
→ dependent actor/system
→ purpose
→ locality/player distance
→ simulation requirement
→ residency mechanism
→ readiness
→ capacity
→ release
```

A13 owns ticking/residency integrity and quantitative coverage proof. B2 supplies the spatial model.

## B3. Multiplayer Ownership Model

When more than one player can participate, record:

```text
player-local state
shared state
party/session owner
admission rules
leave/death/disconnect ownership transfer
simultaneous mutation surfaces
player-count boundaries
```

Use meaningful counts only: 1, 2 when concurrency matters, selected maximum, and maximum + 1 when admission behavior is material.

Applicable integrity checks own the actual contradiction search.

## B4. Arena & Session Model

When multiple arenas/sessions/fronts exist, record:

```text
assignment
visible capacity
admission owner
concurrent capacity
shared resources
isolation scope
cleanup owner
reuse/generation
```

A9 Multi-Arena Capacity & Isolation and A20 Capacity & Boundary Quantification own the detailed safety/contradiction checks.

## B5. Boundary Registry

For each material numeric/discrete limit record:

```text
boundary
source
gameplay purpose
player visibility
below / at / above behavior
```

Use only relevant cases rather than a generic matrix.

Typical boundaries include players, arenas, retries, waves/levels, lives, timers, score/reward thresholds, entities, and residency resources.

### FORMALIZE closure

FORMALIZE is closed when every applicable structural dependency required by routed checks has a grounded record or one exact unresolved claim.

---

# C. EVALUATE

EVALUATE does not redefine the integrity contracts selected in UNDERSTAND. It applies adversarial timing, boundary, interruption, and repeated-run scenarios to the applicable checks already routed by A22.

## C1. Stress Scenario Builder

For each applicable check with a material mutable lifecycle, generate only scenarios supported by discovered mechanics.

Use these stress dimensions when relevant:

```text
interrupt
→ disconnect / leave / death / abort

overlap
→ two owners / two terminal triggers / old + new generation

delay
→ timer / callback / retry / async reset

boundary
→ safe maximum / safe maximum + 1 / geometry edge

repeat
→ retry / replay / second run / reload

partial failure
→ one step succeeds and a later step fails
```

Do not duplicate the base contract here. Reference the applicable A-section check and attack its weak boundaries.

### Mandatory combat extension

When combat/downed/revive exists, additionally challenge:
- self-revive where forbidden;
- multiple revivers;
- stale revive after death/terminal;
- respawn ownership after reconnect;
- projectile/effect cleanup.

---

## C2. Repeated-Run Baseline Comparison

When replay, retry, reload, or arena reuse is possible, compare the next-run baseline against the valid fresh baseline defined by A30.

Compare only applicable state/resources:
- assignments/ownership;
- entities;
- inventory/loadout/economy;
- score/objectives;
- structures/world mutation;
- timers/callbacks/subscriptions;
- residency/ticking resources;
- persistent properties/tags.

Any divergence must be classified as intentional persistence, contradiction, or unresolved exact claim.

---

## C3. Activated Cross-System Scenarios

Use A8 Cross-System Coverage, A16 Simulation–Entity–World Crosscheck, and A31 Software-State Crosscheck as the scenario source.

Activate an interaction only when systems coexist and share material state, ownership, timing, selector, resource, or commit target.

High-yield examples:

```text
reconnect × death/respawn
reconnect × inventory/reward
reload × deferred work
retry × progression/reward
cleanup × entity/world/residency
multi-arena × global selector/state
structure mutation × spawn/teleport
timeout × objective completion
player leave × arena ownership
old generation × new generation
partial transaction × retry
```

For each activated scenario ask:
- Which owner has authority?
- Can both operations overlap?
- Can one invalidate the other's pending work?
- Is state revalidated before commit?
- Can the combination duplicate, skip, or reorder a transition?
- Can state/resource leak to another player, arena, or run?

### Closure

EVALUATE is closed when every activated scenario is:
- blocked by exact safety proof;
- translated into a contradiction for PROVE;
- or preserved as one exact unresolved claim.

Do not create a broad generic testing matrix.

---

# D. PROVE

PROVE decides whether a contradiction has enough evidence to become a finding. It does not rediscover gameplay structure or repeat routed integrity checks.

## D1. Evidence Coverage

For every contradiction entering PROVE, bind only the evidence needed to decide these claims:

```text
scenario is reachable
expected contract is grounded
actual contradictory path is reachable
trigger is explicit
player-visible consequence is grounded
affected scope is known
applicable blocking proof has been searched
```

If a required knowledge/capability dependency is missing, preserve that exact missing claim as an Audit Obligation or NEED_VALIDATION input as appropriate.

The internal evidence graph/receipts may remain implementation details; they are not additional user-facing proof states.

## D2. Gameplay Contradiction

Translate technical evidence through one canonical causal chain:

```text
Technical Fact
→ Gameplay Dependency
→ Scenario
→ Trigger
→ Expected
→ Actual
→ Player Consequence
→ Affected Scope
```

A technical anomaly without grounded Expected behavior or player-visible consequence does not become a gameplay finding.

## D3. Blocking-Proof Search

Before confirming a contradiction, search the exact path for applicable:

- reachable guard;
- ownership validation;
- generation/revision validation;
- scope validation;
- explicit exclusion;
- reachable cleanup/recovery;
- deterministic fallback.

Blocking Proof is valid only when it is reachable, executes before the wrong mutation/commit, and makes the contradicted state unreachable.

**EVALUATE → PROVE source admission:** An externally supplied `BLOCKING_COUNTERPROOF` must cite evidence already owned by a `PROVEN` `excludes` causal link matching the contradicted scenario and commit target. A foreign guard, fabricated evidence ID, or overlapping but different target cannot dismiss a contradiction. Likewise, supplied `CONFIRMED_DEFECT_READY` cannot override a source-proven blocking exclusion. Validate all supplied resolution receipts **before** placing them in the canonical PROVE inventory; invalid receipts are rejected and the graph-owned automatic disposition remains visible, with an explicit admission issue. **At PROVE → issue projection, proof saturation rechecks the current Scenario Graph for an exact blocking exclusion:** a previously confirmed resolution cannot become `PROVEN` if fresh source evidence supplies the missing guard. An unrelated guard must not suppress the valid finding. The original EVALUATE and PROVE decisions and their per-finding evidence remain independent of whole-audit publication readiness. Source admission is not a claim that Minecraft gameplay has been executed.

The following are not Blocking Proof by themselves:
- nearby healthy code;
- existence of a queue/fallback/config;
- naming that implies safety;
- apparently intentional implementation.

Resolve the contradiction to exactly one canonical outcome:

```text
SAFE
→ exact Blocking Proof prevents the contradiction

PROVEN
→ contradiction + player consequence + affected scope are sufficiently proven

NEED_VALIDATION
→ exactly identified deciding proof remains irreducible

AUDIT_OBLIGATION
→ evidence/model gap is not yet justified as a gameplay finding
```

Do not expose internal intermediate labels as additional finding statuses.

## D4. Proof Promotion

Before retaining NEED_VALIDATION:

1. search selected-artifact evidence;
2. search applicable cross-domain evidence;
3. perform applicable quantitative/formal reasoning;
4. perform Blocking-Proof search;
5. use deterministic evidence substitution where valid;
6. isolate the smallest remaining deciding question.

If these steps decide the contradiction, promote to PROVEN or SAFE immediately.

Runtime Verification is permitted only for the final irreducible question.

## D5. Duplicate Finding Consolidation

Use A24 as the consolidation authority.

Every PROVEN causal contradiction must map to exactly one published root-cause finding unless independent repair ownership or independently reachable player contracts require separation.

### PROVE closure

PROVE is closed when every admitted contradiction is exactly one of:

```text
SAFE
PROVEN
NEED_VALIDATION
AUDIT_OBLIGATION
```

No alternate proof-state vocabulary may leave this stage.

---

# E. REPORT

REPORT projects proven gameplay findings into the existing issue/report authorities. It does not create a new taxonomy.

## E1. Finding Contract

A reportable finding must contain:

```text
Issue ID
Issue Type: BUG | DESIGN_MISMATCH
Severity: BLOCKER | MAJOR | MINOR
Gameplay Stage / Scenario
Issue
Trigger (In-Game)
Expected
Observed
Player Impact
Affected Scope
Technical Analysis
Source Evidence
Reproduction
Recommended Resolution
Must Preserve, when applicable
```

### Admission

Only PROVEN findings may enter the Proposed Issue Set.

BUG:
- an implemented/required gameplay contract is broken.

DESIGN_MISMATCH:
- authored/presented capability differs materially from delivered playable capability.

NEED_VALIDATION remains in Map Audit output and does not enter canonical Approved Bug Report V2 until promoted and approved.

Audit Obligations remain internal audit work.

### Severity

Assign severity only after finding admission:

- **BLOCKER** — required gameplay cannot normally start, continue, or complete, or normal recovery is unavailable.
- **MAJOR** — core gameplay, important player state, fairness, or delivered capability is materially wrong but normal play can continue/recover.
- **MINOR** — limited but real player-visible impact.

### Reproduction

Reproduction is written entirely in tester/gameplay language. The final step states the observable wrong result.

Do not ask the tester to inspect source code, logs, internal variables, scripts, or architecture.

### Publication flow

```text
PROVEN findings
→ Proposed Issue Set
→ explicit chat review
→ Approved Issue Set
→ Bug Report V2
→ Golden Bug Tracker HTML + JSON
```

Bug Report V2 owns persisted issue facts. Golden Bug Tracker owns presentation/workspace state only.

### REPORT closure

Every PROVEN finding is either:
- approved and persisted once;
- rejected with explicit review decision;
- or held from publication pending user decision.

No duplicate Markdown/HTML/JSON issue authority is created.

---

## Vital Gameplay Knowledge Closure projection

Before describing the selected map as fully understood, project the canonical audit through `vital-gameplay-knowledge-closure.md`.

This projection does not add a checkpoint or alternate state machine. It reads the already-authorized finding lanes and Audit Obligations and must preserve the ordered TARGET → DISCOVERY → UNDERSTAND → FORMALIZE → EVALUATE → PROVE → REPORT authority.

Closure rule:

```text
all applicable vital domains
→ UNDERSTOOD_PROVEN_SAFE
   or UNDERSTOOD_WITH_FINDING
   or NOT_APPLICABLE
→ Vital Gameplay Closure CLOSED
```

Any `RUNTIME_REQUIRED`, `DETECTION_GAP`, or unrouted material residue keeps the knowledge closure OPEN. Do not use absence of a finding as proof that a blocked vital domain is safe.

# Procedure Closure

The base procedure is complete only when:

```text
UNDERSTAND
- artifact integrity closed
- surfaces accounted
- journey reconstructed
- state/ownership/progression accounted

FORMALIZE
- applicable actor/spatial/multiplayer/multi-arena/boundary contracts closed

EVALUATE
- applicable lifecycle/recovery/cleanup/cross-system scenarios accounted

PROVE
- RIG closed
- contradictions resolved
- counter-proof searched
- root causes consolidated

REPORT
- every proposed bug satisfies Final Bug Contract
```

If any mandatory checkpoint is OPEN, the audit must not claim comprehensive completion.

## Anti-overdevelopment rule

Do not add a new checkpoint, analyzer, registry, or workflow layer merely because a possible bug class can be imagined.

Add capability only when one of these is true:

1. an existing mandatory checkpoint cannot be executed;
2. a required RIG node has a genuine CAPABILITY_GAP;
3. a proven regression demonstrates that current procedure systematically misses a material defect class.

The target is the **minimum complete procedure**, not maximum checklist size.
---

# Developer Note Integration

Developer Notes are part of the canonical audit/report flow, not a parallel scanner.

Authority:
- `docs/analysis/developer-note-coverage.md`

After gameplay/design proof and before final report publication, route the existing Coverage Ledger through the applicable Developer Note categories.

Canonical flow:

```text
Selected Artifact
→ UNDERSTAND
→ FORMALIZE
→ EVALUATE
→ PROVE
→ BUG / DESIGN_MISMATCH closure
→ Developer Note Extraction from the same evidence ledger
→ Developer Note Admission Gate
→ Root-Cause Deduplication
→ REPORT
```

Rules:
- BUG and DESIGN_MISMATCH always take precedence when player-visible or authored-capability contradiction is proven.
- DEV NOTE is only for concrete, actionable engineering/release conditions that remain after gameplay-finding deduplication.
- DEV NOTE must never be used to hide missing gameplay proof or generic NEED_VALIDATION.
- Every applicable Developer Note category must close as SAFE, DEV NOTE, already represented by BUG/DESIGN_MISMATCH, or exact unresolved evidence.
- Generic refactor/cleanup/optimization/test/logging advice is forbidden unless tied to a concrete selected-artifact condition.
- Developer Note titles must be plain and immediately understandable to a developer.
- Developer Notes do not receive gameplay severity and do not inflate BUG/DESIGN_MISMATCH totals.
- Complete HTML/JSON publication exports include Developer Notes separately.

Audit closure now requires both:
1. gameplay/design coverage closure; and
2. applicable Developer Note coverage closure.


## Proof Escalation requirement

The PROVE lane must enforce the `Proof Escalation Gate` owned by `master-selected-map-audit-workflow.md`.

Before any `NEED_VALIDATION` publication:

```text
exact missing claim
→ targeted evidence search
→ Blocking-Proof Exhaustion
→ applicable deterministic substitutions
→ cross-file causal closure
→ re-run claim closure
```

Only one irreducible deciding runtime fact may remain.

A first-pass proof failure, large source surface, callback/concurrency complexity, or tester convenience is not sufficient justification for `NEED_VALIDATION`.

Audit closure targets:
- unsupported PROVEN = 0;
- generic NEED_VALIDATION = 0;
- every retained NEED_VALIDATION has a complete Hard-Gate receipt.

---

# Proof Escalation Requirement

Authority:
- `docs/analysis/master-selected-map-audit-workflow.md#60-proof-promotion-rule`

Within PROVE, a contradiction with a missing claim must pass the Proof Escalation Gate before it can become NEED_VALIDATION.

Required behavior:

```text
missing claim
→ targeted evidence search
→ blocker exhaustion
→ applicable deterministic proof/substitution
→ crosscheck / causal-slice refresh
→ claim closure retry
```

Only after this loop may the result become:
- PROVEN;
- SAFE;
- Audit Obligation; or
- narrow NEED_VALIDATION with a complete receipt.

A generic NEED_VALIDATION is a procedure failure and blocks audit closure.

Audit metrics must preserve:
- Unsupported PROVEN = 0;
- Generic NEED_VALIDATION = 0;
- exact NEED_VALIDATION receipts for every remaining runtime question.

The engine must maximize PROVEN through stronger evidence and proof, never through reduced proof requirements.


## Multi-Scenario Check requirement

Machine-readable scenario records must conform to `.agents/schemas/multi-scenario-check-ledger.schema.json`. This is the single schema authority for multi-scenario records.

The EVALUATE lane must execute the canonical multi-scenario checks defined in `master-selected-map-audit-workflow.md`.

When applicable, use only these canonical check names:

```text
Stage Transition State Check
Carried Objective Ownership Check
Shared World State Check
Offline Progression Check
Container & Economy Reset Check
Disconnect / Reconnect Check
Reload Recovery Check
Multiplayer Shared-State Check
Multi-Arena Isolation Check
Player Capability Check
```

The engine should maximize relevant scenario coverage while remaining conservative in publication.


Naming discipline:
- tester/user examples are mapped into the canonical checks above;
- examples must not create new permanent workflow branches;
- one issue keeps one root-cause name and one canonical flow;
- report-facing names must remain plain and developer-readable;
- machine IDs may remain stable for compatibility.

Before EVALUATE closes:

```text
all material adjacent stage handoffs
→ mutation/reset differential

all carried/owned objectives
→ custody-state interruption matrix

all reused physical gameplay space
→ previous mutation × next-stage dependency compatibility

all player-independent timers/cinematics
→ offline progression differential

all gameplay containers/economy stores
→ provenance + carryover differential
```

Pairwise interaction coverage is the default. Generate a higher-order scenario only when three or more dimensions converge on the same state, resource, owner, geometry, or transition.

The audit must not ask the tester to broadly play through the map. Manual runtime work is reduced to exact irreducible questions after deterministic simulation.

Closure target:

```text
Unaccounted Material Interleavings = 0
Generic Runtime Questions = 0
Generic NEED_VALIDATION = 0
Unsupported PROVEN = 0
```


## High-yield state and geometry checks

The FORMALIZE/EVALUATE lanes must route the following checks whenever their trigger exists:

```text
State Snapshot Differential
Cross-Representation Consistency Check
Event Ordering & Duplicate Commit Check
Orphan State & Entity Check
Path & Geometry Dependency Check
Metamorphic Comparison Check
```

They are not separate workflows.

Routing rules:

- lifecycle boundary with material state → State Snapshot Differential;
- one gameplay concept stored in multiple representations → Cross-Representation Consistency Check;
- multiple producers/subscribers target the same consequence → Event Ordering & Duplicate Commit Check;
- created/reserved mutable object has a lifecycle owner → Orphan State & Entity Check;
- progression depends on traversal/physical route/interaction volume → Path & Geometry Dependency Check;
- two cases should preserve the same gameplay invariant → Metamorphic Comparison Check.

Before REPORT, every applicable routed check must resolve to SAFE, PROVEN, one exact irreducible runtime question, or a documented Audit Obligation. No applicable check may disappear because another issue was already found in the same map.


## Manual Test Last-Resort Gate

Manual testing is never the default continuation of an audit.

The system must first exhaust the available deterministic work:

```text
source / package inspection
→ state and ownership modeling
→ multi-scenario checks
→ cross-file causal tracing
→ Blocking-Proof Exhaustion
→ deterministic proof substitution
→ cross-map implementation comparison
→ selected-artifact re-open when evidence is stale/incomplete
→ PROVEN / SAFE / exact runtime-irreducible fact
```

A Runtime Test Queue item is therefore a **deferred verification obligation**, not an assignment to the tester.

Before an item may be handed to a human tester, all of the following must be true:

```text
Fresh selected artifact inspected: YES
Relevant source/pack surfaces traced: YES
State Snapshot Differential exhausted: YES
Cross-Representation Consistency exhausted: YES
Event Ordering / Duplicate Commit exhausted: YES
Orphan State / Entity lifetime exhausted: YES
Path / Geometry Dependency exhausted when applicable: YES
Metamorphic Comparison exhausted when applicable: YES
Proof Escalation Hard Gate passed: YES
Exactly one runtime-native deciding fact remains: YES
```

If any answer is NO, return the item to system analysis.

Operational target:

```text
manual tests requested from user = minimum practical count
broad playthrough requests = 0
generic "please test this map" requests = 0
```

The user should only receive a manual test request when the system can no longer reduce the uncertainty from the selected artifact and the test is necessary to decide one material claim.