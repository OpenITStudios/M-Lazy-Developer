---
id: document.analysis.bug-finding-coverage
class: DOCUMENT
domain: analysis
role: CONTRACT
authority: CANONICAL
lifecycle: ACTIVE
---

# Bug-Finding Coverage System

## Purpose

This is the canonical coverage owner for selected-map bug finding.

The production flow remains:

```text
TARGET → DISCOVERY → UNDERSTAND → FORMALIZE → EVALUATE → PROVE → REPORT
```

This document ensures material gameplay surfaces, reusable knowledge, detectors, reliability evidence, boundary checks, and unresolved residue cannot silently disappear from the audit.

## Coverage layers

Every audit closes five cumulative layers:

1. **Surface accounting** — every material discovered surface has purpose, owner, route, proof state, and final disposition.
2. **Player-flow coverage** — checks attach to ENTRY/JOIN → READY/START → SETUP → ACTIVE → PROGRESSION → TERMINAL → CLEANUP/REPLAY → RECOVERY.
3. **Vital-domain coverage** — entry/admission, progression, multi-arena isolation, connection/recovery, inventory/player capability, world/reset integrity, score/result integrity, and player-facing information.
4. **Cross-system and boundary stress** — lifecycle intersections, concurrency, maximum+1, retry/reconnect/reload, deferred work, cleanup/reuse, and negative-space inverse checks.
5. **Proof and conservation closure** — every contradiction or residue ends as a finding, explicit Audit Obligation, safe/not-applicable disposition, or counter-proof rejection.

No layer replaces another.

## Evidence roles

The selected artifact is the only current gameplay authority.

- Engine analyzers and semantic models derive evidence from it.
- Platform knowledge/rules may support a claim only when applicable to the selected runtime profile.
- Reliability regressions and failure patterns raise search priority and detector recall; they never prove a current defect by themselves.
- User/client feedback raises scenario priority; it never creates a finding by itself.
- Runtime verification resolves only irreducible behavior.
- Old versions and archived reports are historical search hints only.

### Version-transition coverage rule

Coverage resets against the exact selected artifact whenever the selected map version changes.

Historical coverage receipts, old report counts, and old finding lists do not satisfy current-version coverage by themselves.

```text
old version coverage
→ regression/search hints

new version
→ fresh surface accounting
→ fresh player-flow coverage
→ fresh vital-domain coverage
→ fresh cross-system/boundary stress
→ fresh proof/conservation closure
```

Reuse is allowed only for a current-artifact fact that is positively proven equivalent and still applicable. Reuse must preserve the evidence binding to the new artifact; it is not inherited merely because files, names, or version lineage look similar.

A current-version coverage summary must account for:
- historical findings revalidated;
- newly introduced surfaces/deltas;
- unchanged-but-currently-proven applicable surfaces;
- regression paths created by fixes/changes;
- unrelated new candidates;
- previously missed candidates discovered by the fresh sweep;
- all unresolved material residue.

A zero-new-finding result is valid only after these current-version coverage layers close. It cannot be concluded from historical parity.


## Surface accounting

Every material surface must record:

```text
Surface ID
Source / Evidence
Gameplay Purpose
Gameplay Owner
Lifecycle Owner
Mutable Resources
Player-Flow Stage
Vital Domain(s)
Applicable Checks
Required Crosschecks
Proof State
Finding / Audit Obligation / Safe Disposition
Closure
```

Allowed terminal closure:

```text
SAFE
PROVEN
NEED_VALIDATION
AUDIT_OBLIGATION
NOT_APPLICABLE
```

`NOT_APPLICABLE` requires positive selected-artifact evidence.

Block closure when a material surface has no purpose, no owner, no route, unresolved mutable state, missing required crosschecks, or unresolved evidence absent from findings and Audit Obligations.

## Discovery challenger

After normal discovery, challenge raw state/execution from the opposite direction:

```text
raw state / command / callback / selector / mutation
→ semantic owner?
→ gameplay purpose?
→ scenario?
→ lifecycle owner?
→ closure?
```

Orphan execution/state remains a Detection Gap until resolved.

## Player-flow coverage

For every applicable gameplay stage account for:

```text
entry condition
owner
required state/resources
player/system action
success condition
failure condition
next transition
cleanup
recovery
applicable technical checks
```

Technical domains are invoked where they affect gameplay; they are not separate audit branches.

## Vital-domain coverage

Project the canonical audit into exactly eight vital domains:

- `ENTRY_ADMISSION`
- `GAME_STATE_PROGRESSION`
- `MULTI_ARENA_ISOLATION`
- `CONNECTION_RECOVERY`
- `INVENTORY_PLAYER_CAPABILITY`
- `WORLD_RESET_INTEGRITY`
- `SCORE_RESULT_INTEGRITY`
- `PLAYER_FACING_INFORMATION`

For each applicable domain answer:

```text
source of truth
mutation owner
ownership-change boundary
interruption behavior
restore / clear / persist / preserve contract
```

Pressure each domain through happy path, failure path, disconnect/recovery, second run, concurrent interleaving, and boundary/capacity scenarios.

Vital Closure remains a read-only projection and never creates findings.

## Mandatory bug-finding families

Activate when applicable:

- capacity, admission, concurrency;
- multi-arena isolation and replica integrity;
- progression, waves, objective completion;
- terminal collisions and exactly-once result ownership;
- inventory, equipment, kit, shop, currency lifecycle;
- player capability and privileged-role exposure;
- gamerule/world-setting authority;
- entity lifecycle, combat, navigation, disappearance accounting;
- ticking/chunk residency and simulation readiness;
- world/structure/block/liquid mutation and reset footprint;
- client/server reconciliation for cancelled or rewritten mutations;
- persistence, disconnect, reconnect, reload, retry;
- cleanup, replay, second-run equivalence;
- UI, score, timer, queue, player-facing information;
- meaningful boundary values and maximum+1;
- deferred callbacks/subscriptions/timers and generation ownership;
- referential integrity and missing guard/capability/cleanup;
- platform/performance limits when they change playable behavior.

These are coverage families, not a manual test checklist.

## Mutable-state reverse index

For every material mutable resource build:

```text
Resource
→ Creator
→ Readers
→ Writers
→ Clearers
→ Deferred Writers
→ Owner
→ Generation / Revision
→ Persistence Scope
→ Cleanup Boundary
```

Challenge multiple writers without authority, global mutation of local state, deferred writers without generation validation, create/acquire without cleanup, mutation after owner invalidation, and persistent state without restore/reset ownership.

This reverse index selects higher-order interaction checks.

## Negative-space coverage

Every one-way material action must have an inverse or explicit terminal accounting:

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

Missing inverse is a mandatory contradiction candidate until selected-artifact evidence proves no inverse is required.

## Cross-system stress

Generate crosschecks only when systems share material state, ownership, timing, geometry, selector, resource, or commit target.

High-value interactions include:

Lifecycle-sensitive deferred work is source-first. When deferred/periodic execution intersects disconnect/reconnect, reload, cleanup, or terminal transitions, classify that lifecycle boundary explicitly and keep the gray-zone residue visible until generation/ownership/order proof closes it. A generic reconnect or replay playtest is not the default proof method.

```text
Reconnect × Inventory
Reconnect × Death/Respawn
Reconnect × Reward/Score
Retry × Progression
Retry × Reward Commit
Reset × Arena Reuse
Cleanup × New Generation
Global Selector × Arena Isolation
Shared Identity × Cleanup
Terminal Trigger × Terminal Trigger
Remote Gameplay × Residency
Entity Objective × Residency
World Mutation × Reset Footprint
Deferred Work × Owner Generation
Initialization × Admission
Partial Transaction × Retry
Resource Leak × Repeated Run
Multi Arena × Gamerules
Multi Arena × privileged roles
Client Prediction × Cancelled World Mutation
Liquid/Waterlogging × Interaction Guard
Physical Boundary × Collision/Barrier Geometry
```

For each relevant interaction examine guard, scope, exclusion, owner, generation, cleanup, physical/world counter-proof, role authority, world settings, guard activation, and client/server representation.

Do not generate a Cartesian product of unrelated systems.

## Selected-source causal impact path

Both a directly authored gameplay link and a longer directed path through
state/phase/mechanic subjects use the **same source-impact rule**. Every
traversed causal relation must be authored and supported by its own selected
map source-code/command implementation witness; a design specification,
translated label, inferred edge or structural owns/scoped-to association
cannot substitute for any causal hop. The terminal objective/outcome must
have an independently located APPROVED current-map design witness.
When the shortest candidate terminates in a source-only or draft outcome,
continue checking other bounded authored paths rather than falsely
declaring that unrelated terminal PROVEN. Traversal is bounded and
cycle-safe; missing complete evidence remains an explicit proof gap.
Causal link status and each impact hop now share the same selected-source
implementation witness rule. A selected-artifact design/text evidence ID does
not independently grant a causal link PROVEN. Impact search prunes branches
without an authored, independently approved terminal before exploring the
bounded, cycle-safe alternatives; a budget limit never proves absence.
A source-backed authored path is impact **relevance**, never proof of
player triggering, operation success, guard satisfiability or a confirmed
Bug. The same canonical source proof, Counter-Proof and Proof Saturation
still govern both direct and multi-hop causal links.

## Selected-map-native player-facing contract candidates

Reconstruct source cues from actual selected-artifact locale lines and exact
literal source translation references. An exact execution-region association
may link the cue to classified Intent subjects only when the independently
selected-source region evidence exists at the same script file. Distinct
locales for one key are **not** conflicting definitions; repeated definitions
of the same key *within* one locale remain explicit pack/override ambiguity.

This reconstruction is a read-only projection of the canonical Gameplay Intent
evidence and is exposed through Gameplay Contract and the existing model
handoff. It cannot invent an objective or invariant, upgrade a dialogue/locale
cue into APPROVED design, establish that text was displayed, clear material
unknowns, or directly satisfy impact/reachability/counter-proof criteria.
Player activation, delivered UI, effective resource-pack selection and
intended-gameplay authority remain separate proof obligations.

## Exact source UI-send attempts and map-native player contracts

The parser admits a literal translation's UI-send attempt only when its
JSON-like `{ translate: "key" }` object is directly contained in the argument
of a uniquely typed Player/World `sendMessage` or ScreenDisplay `setTitle` /
`setActionBar` AST call. Variable aliases, nested helper invocations, dynamic
expressions, untyped same-named calls, object spreads and unrelated same-function
API calls do not supply that edge. The Gameplay Intent Stage independently
matches the COMPLETE parser call source span, receiver, method and execution
region to ONE current-artifact Semantic IR API call before recording its ID.
A call site is an authored SEND ATTEMPT only; it is not player execution,
message delivery, selected locale, visible UI, a Game Design rule or gameplay
impact.

Selected .lang evidence may carry the unique world-pack-list attachment
declaration already collected in inspection. A not-listed or unknown pack
is explicitly flagged; `listed` is only source eligibility, never evidence
of the effective client resource-pack order or locale. Exact source-region
co-membership with an objective/outcome is a navigation candidate, not a
causal or approved game rule. The canonical Gameplay Contract and model handoff
expose these immutable evidence IDs and remaining obligations without altering
Bug/Design Mismatch decisions, Proof Saturation or status thresholds.

## Direct selected-source impact path

A canonical authored Intent link whose target is already the final
objective/outcome must not lose its one-edge impact path merely because
there is no further outgoing gameplay relation. The existing Scenario
Compiler now recognizes this **direct authored dependency** only when
the link has exact selected-artifact source-code/command evidence AND the
terminal node has independently approved current-artifact design evidence.
Its impact-path proof records both the original source relation and the
approved destination, never a guessed mechanic name, reused earlier map,
draft/translation cue or self-asserted expected behavior. This is
source-grounded relevance of a dependency to a player objective, NOT proof
that the action executed, a state write committed, the Minecraft effect
succeeded, or the player experienced a bug. All PROVE counter-proof,
reachability, family-specific evidence and native-runtime ceilings remain.

## Effective-delivery proof

Configured or theoretical capacity is not deliverable capacity.

Do not close a capability from any subset of:

- configured maximums;
- number of physical arenas/replicas;
- chunk/resource arithmetic;
- correct offsets;
- correct selectors/tags;
- intended comments;
- existence of retry/recovery code.

For user-visible capabilities, enumerate every gate from user action to delivered behavior. A downstream mechanism can be correct while an earlier gate prevents all users from reaching it.

For queue/capacity systems specifically, acceptance must challenge below-capacity behavior:

```text
0 active + 1 request → must deliver
1 active + next request → must deliver if capacity >1
...
N requests below advertised capacity → no capacity queue
capacity exhausted → queue may appear
release one slot → exactly one queued request advances
```

If runtime queues below proven capacity, classify the capability as failing even when source constants advertise a larger maximum.

## Effective-delivery and gate proof

A configured capability is not closed until every blocking gate between user intent and delivered gameplay has been evaluated.

For any advertised capacity, queue, allocator, lease, preload, or recovery system, reconstruct:

```text
user becomes eligible
→ global/startup gates
→ admission
→ queue
→ reservation
→ native resource allocation
→ readiness verification
→ gameplay transition
→ observable delivery
```

Never infer delivered capacity from constants, physical replicas, resource arithmetic, or intended architecture alone.

### Below-capacity queue invariant

If a system advertises capacity `N`, then for each `1..N` valid independent requests, a clean/idle runtime must not leave requests in an overflow queue solely because an internal startup/recovery gate failed to open.

A visible queue below advertised capacity is a failure signal that requires causal investigation.

### Idempotent cleanup semantic check

For startup/recovery cleanup, explicitly test the already-clean case:

```text
resource exists  → cleanup removes it → clean
resource absent  → cleanup recognizes absence → clean
real removal error → not clean
```

Do not conflate `0 removed` / `already absent` with cleanup failure unless the platform contract proves that interpretation.

When a new version changes cleanup return values, success predicates, error handling, or readiness gates, compare the semantic contract with the previous selected version. A refactor that reverses the meaning of `0`, `false`, absence, or idempotent success is a regression candidate even if the new architecture looks more robust.

## Closed domain model before subsystem audit

Before applying generic concurrency, queue, multiplayer, or replica heuristics, reconstruct the selected map's finite gameplay domain from artifact authority.

Record at minimum when applicable:

```text
physical playable units and exact cardinality
party/team cardinality and binding
players per party/team
whether units are fixed, allocated, or dynamically created
level/stage cardinality
legal session states
legal transitions
resource ownership
whether a queue is a gameplay concept, internal serialization, or impossible by design
```

Do not invent generic overflow cases. For a fixed six-arena map with exactly six arena-bound parties and advertised six-arena concurrency, a hypothetical seventh arena request is outside the domain and must not appear in acceptance criteria.

Generic detector vocabulary must be translated through the map model before use:

```text
"capacity overflow"
→ identify the actual domain actor that can exceed capacity
→ if no such actor exists, reject the scenario

"queue"
→ identify who can legally queue and why
→ distinguish internal work serialization from player-facing capacity queue

"replica"
→ identify whether it is dynamically assigned or permanently bound
```

A subsystem audit performed without this closed domain model is incomplete even if individual source mechanisms were inspected.

## Per-replica gameplay parity matrix

When a map exposes multiple playable arenas/replicas, source/config replica equivalence does not by itself close gameplay coverage. Build one parity matrix that projects every material gameplay subsystem across every playable replica.

Minimum applicable columns:

```text
replica / arena
→ admission / ready
→ residency / preload
→ spawn / teleport
→ shop / NPC / dialogue
→ kit / loadout
→ inventory / equipment
→ currency / chest economy
→ objective / flag
→ combat / death / respawn
→ retry / progression
→ terminal / score
→ cleanup / reuse
→ disconnect / reconnect
```

For offset-generated replicas, prove that every material coordinate-bearing dependency is either:
- intentionally shared and reachable under a shared residency owner; or
- transformed by the replica offset / arena-local owner.

A single correctly offset spawn or arena boundary does not prove that shop NPCs, kit structures, storage chests, objectives, entity tags, cleanup bounds, and reconnect destinations are also replica-safe.

### Inventory/economy writer closure

For maps with kits, shops, upgrades, currency, or carried items, enumerate every material inventory/equipment/economy writer before declaring the domain safe:

```text
fresh-session clear
loadout application
kit change
shop purchase
currency consume / award / restore
equipment replacement
enchantment / upgrade
death / respawn
disconnect / reconnect
retry
level advance
full inventory / overflow
world item drop
cleanup / return-to-lobby
```

For each writer prove:

```text
what may be removed
what must be preserved
what may move slots
what may drop to world
what is restored
what happens on partial failure
which arena/session owns the mutation
```

Explicitly challenge:
- silent overwrite/deletion;
- purchase charged without delivery;
- delivery without charge;
- duplicate restore;
- stale loadout after reconnect;
- kit swap erasing purchases/upgrades;
- overflow drop followed by arena cleanup;
- currency preserved through the wrong boundary;
- shared chest/config coordinates across replicas.

### Transaction atomicity

Any gameplay exchange with two or more mutations must be treated as a transaction candidate, but a defensive failure branch is not proof that the failure is reachable.

Before promoting a partial-transaction candidate to PROVEN, establish both:

```text
reachable failure trigger on the selected artifact
+
missing/incorrect rollback, refund, idempotency, or commit handling
→ reachable wrong player state
```

The following evidence alone is insufficient to prove a gameplay defect:

- a `try/catch` exists;
- an API/command can theoretically throw;
- an error message exists;
- rollback/refund code is absent;
- a fallback branch exists;
- an operation is asynchronous;
- a hypothetical full-inventory/network/platform failure was not observed in selected-artifact evidence.

If no concrete reachable failure trigger can be established after source, platform-contract, and selected-artifact counter-proof, reject the gameplay finding. Do not preserve it as NEED_VALIDATION merely because failure is theoretically imaginable.

Any gameplay exchange with two or more mutations must be treated as a transaction candidate:

```text
validate
→ reserve / charge
→ deliver / mutate
→ commit feedback
```

If a later step can fail, prove rollback/refund/idempotency or classify the reachable partial state. Success feedback must only follow successful commit.

## Differential lifecycle coverage

Compare equivalent goals reached by different paths when applicable:

```text
Normal Start vs Reconnect Start
Normal Start vs Late Join
Death/Respawn vs Reconnect During Death
Normal Completion vs Timeout Completion
Fresh Run vs Retry
Fresh Run vs Second Run
Normal Loadout vs Shop/Kit Change
Normal Cleanup vs Disconnect Cleanup
Normal Bootstrap vs Reload Bootstrap
```

Compare writers, clearers, ownership, generation guards, required resources, and postconditions.

## Boundary and quantitative coverage

Prefer meaningful boundaries:

```text
1
2 when concurrency exists
known safe limit
safe limit + 1
selected/presented maximum
```

For progression also include first, final-1, final, zero remaining, and the transition immediately after completion.

For bounded resources calculate when possible:

```text
shared budget / per-active-unit cost = safe maximum
```

Compare presented maximum, admission maximum, calculated safe maximum, and actual fallback behavior.

## Mutation, reset, and replica coverage

For resettable world mutation:

```text
Mutation Footprint
- Guaranteed Restore Footprint
= Residual Footprint
```

Classify residuals by later gameplay consequence.

For repeated arenas/regions, normalize to a baseline, compare topology/geometry/native evidence, reuse proof only for equivalent replicas, and route divergent replicas back into FORMALIZE/EVALUATE/PROVE.

## Knowledge and reliability consumption

Reusable intelligence must be consumed, not merely stored.

`engine/reliability/catalogs/knowledge-detector-bindings.json` verifies that high-value knowledge has a production consumer, analyzer path, and proof path. A knowledge item with no consumer is coverage debt.

Historical regressions/failure patterns may raise search pressure, seed failure families, and test detector recall. They never prove the current defect.

Approved current findings may later improve historical reliability knowledge; current report truth remains current-artifact owned.

## Claim-based proof

Every contradiction entering PROVE must close:

```text
REACHABILITY
CONTRACT
CONTRADICTION
PLAYER_CONSEQUENCE
AFFECTED_SCOPE
BLOCKING_PROOF_CLEARED
```

Use bounded causal slicing:

```text
trigger
→ authoritative mechanism
→ owner/generation
→ broken contract
→ wrong reachable state
→ player-visible consequence
```

Nearby healthy code, generic guard presence, queue existence, platform limits, or generic confidence are not Blocking Proof unless they deterministically prevent the contradicted state.

Absence claims require enumeration of possible authoritative owners and implementation surfaces before absence is considered proven.

Timing-sensitive claims must explicitly prove event ordering and stale/new ownership.

## Proof-gap-first automatic resolution

At each PROVE attempt, the existing saturation owner must expose the exact
**unsatisfied universal and family criteria** on the current causal link.
The existing NEED_VALIDATION projection carries those criterion IDs and
descriptions, plus exact canonical counter-proof dimensions that lack an
exhaustive source witness. The source-first Proof Navigation and existing
model-task handoff consume this list rather than requiring every family
criterion to be re-investigated. Any matching source/Knowledge/formal
evidence must still be admitted through the unchanged source-bound proof
and counter-proof rules; describing or searching a gap is not proof.
Keep fixed source identity, preserve current MapAuditOutputV2 and the two
final Bug/Design Mismatch categories. Do not broaden AI to entire maps,
rerun already-proven dimensions, or silently convert blocked source work
into a Minecraft playtest.

## Incremental source-bound proof continuation

The existing PROOF_NAVIGATION model task can return one complete current
FamilyProofReceipt or a proof-only resolution with causalLinkId, unchanged
CONFIRMED_DEFECT_READY disposition, optional matching scenarioId and a
familyProof containing *only* the missing family criteria. The canonical
source/PROVE owner merges those criteria with the current resolution; it
does not overwrite earlier valid translation, search or family witnesses.
Each new criterion must be missing on the current audit revision and
must independently become satisfied from source-scoped evidence. Duplicate,
foreign, unsupported or unproductive replies are rejected. The normal
resolveSelectedMapAudit continuation then re-derives admission, proof
saturation, PROVEN/NEED_VALIDATION and the report from the same selected
artifact. Never merge across revisions, infer source evidence from AI
text, or claim that source revalidation equals live Minecraft execution.

## Positive source witnesses without proof inflation

The current selected-artifact Scenario Graph now reuses completed arena
replica comparisons as bounded `geometry` witnesses, including positive
physical divergence. It requires all declared replicas to be compared
without unresolved blocks and never promotes a partial sibling or unknown
arena count into exhaustive geometry evidence. The player-capability
scenario likewise reuses the existing analyzer's **source-reachable,
confirmed `exposed`** status as an `activation` witness only when its
source evidence matches the full selected-map file identity. A merely
potential exposure, an absent trigger, a foreign file of the same name,
or an unrelated gameplay scenario cannot supply activation.

These are inputs to the SAME canonical counter-proof/PROVE engine, not
direct PROVEN verdicts. Guard, source/commit scope, ownership, cleanup,
generation, player impact and any remaining universal/family criteria
must still be proven separately. No label, global count or filename
substring grants a witness; native runtime effects remain unobserved.

## Runtime-last rule

Runtime verification is only for behavior static/package/formal reasoning cannot decide, such as native pathfinding/collision, actual simulation, client/server ordering, multi-client visual divergence, rendering/input, or performance manifestation.

A `DETECTION_GAP` is a source/proof obligation, not a manual-test instruction. It stays visible as gray-zone evidence and must continue through selected-artifact, ownership, reachability, lifecycle, cross-domain, and formal proof before any runtime escalation.

`runtimeLastResort` means runtime is available only as the final escalation tier; it does **not** mean a Minecraft/local-player test is already required. A validation group becomes `NARROW_RUNTIME_VERIFICATION` only when the unresolved claim is explicitly classified `runtimeRequired` after static/cross-domain/formal substitutions are exhausted.

Each unresolved runtime item becomes exactly one narrow Audit Obligation/question.


## Lifecycle settlement, readiness, and presentation conservation

The following failure families are mandatory cross-system pressure when their surfaces are discovered. They generalize across maps; do not encode map, entity, arena, or item names as detector rules.

### Terminal entity settlement divergence

When an entity can intercept or replace its normal fatal-damage/death path, reconstruct the full terminal chain:

```text
fatal condition
→ authoritative terminal state
→ combat/AI exclusion
→ player-visible death feedback
→ score / kill / objective settlement
→ registry/progression settlement
→ removal / replacement / despawn
```

Do not assume that disappearance, removal, despawn, replacement, or a custom dying animation is equivalent to the death event consumed by scoring/progression code.

If gameplay settlement listens only to one terminal mechanism (for example a death observer), while a reachable entity path can terminate through another mechanism (for example explicit removal, replacement, or despawn), require one of:

- an explicit shared settlement owner reached by every terminal path;
- positive platform/source proof that the alternate path necessarily emits the consumed terminal event; or
- an explicit unresolved obligation.

A custom terminal presentation must not silently bypass exactly-once kill, score, retry-survivor, objective, or progression accounting.

### Pending critical work is not readiness

Queued/retrying/deferred work that is required for the playable state remains part of readiness until it has a terminal disposition.

```text
requested
→ pending / retrying
→ materialized
→ verified
→ registered
→ gameplay-ready
```

Do not close setup/readiness merely because retry was scheduled or because the happy-path setup function returned. If required entities, objectives, structures, leases, inventory state, or other critical resources are still pending, gameplay activation must either remain gated or have an explicitly grounded degraded-mode contract.

### Presentation transition ownership

For transitions intended to hide intermediate world state (camera fades, black screens, loading overlays, cutscenes, teleport covers, input locks), reconstruct one ownership chain:

```text
acquire presentation
→ prove/establish hidden or locked state
→ perform hidden mutation / teleport / load
→ prove destination readiness
→ establish final camera/UI state
→ release presentation
→ release input
```

Fire-and-forget or independently scheduled acquire/release operations are temporal-risk evidence when gameplay mutation can proceed between them. A fixed delay is not readiness proof unless the selected-artifact/platform contract grounds that delay as sufficient.

Check fresh start, retry, reconnect, level/stage advance, terminal return, and overlapping transition owners where applicable.

### Player-facing information parity

When multiple surfaces describe the same authoritative state (title, subtitle, chat, HUD, form, scoreboard, sound/cinematic cue), compare the semantic payload, not literal wording.

Material fields such as state, attempt, multiplier, timer, score, capacity, objective, result, and required player action must not contradict or selectively omit information needed to understand the same decision.

Different wording is allowed. Different gameplay meaning is not.

### Phase-gated gameplay mutation

Any player-triggered mutation that is intended for a bounded phase (kit/loadout selection, shop/setup actions, ready controls, objective interaction, developer controls) must be checked at the effect commit, not only at UI visibility.

```text
player trigger
→ current session/arena owner
→ current phase/generation eligibility
→ authorization
→ mutation
```

A reachable interaction surface plus a mutation path without a phase check is a mandatory intent/reachability challenge. Hidden UI alone is not an authorization boundary.


## Final conservation gate

Before REPORT:

```text
all discovered material surfaces
+ all material candidates
+ all runtime/detection/model residue
=
SAFE / NOT_APPLICABLE
+ PROVEN findings
+ NEED_VALIDATION findings
+ explicit Audit Obligations
+ REJECTED_WITH_COUNTERPROOF
+ SUPERSEDED_BY
+ INTENTIONALLY_EXCLUDED with reason
```

Nothing may disappear because a detector did not fire, another analyzer looked healthy, approval was withheld, runtime was inconvenient, or a UI/projection omitted it.

Unknown is not a bug by itself, but it is never equivalent to safe. Every material gray-zone item remains explicitly visible through the derived `unresolved` report index until it closes as PROVEN, NEED_VALIDATION detail, an Audit Obligation, NOT_APPLICABLE with positive evidence, or rejected with counter-proof. The report must distinguish static-proof residue from truly runtime-required residue so unresolved state does not automatically become player testing.

Finalization also requires stable artifact identity, one root cause per issue, separate BUG and DESIGN_MISMATCH lanes, impact-derived severity, and no unresolved material coverage hidden behind generic PASS/CHECKED.

## Anti-forgetting rule

A new analyzer, knowledge catalog, reliability pattern, runtime probe, gameplay domain, or audit check is not production-complete until it is connected to:

```text
applicable surface
→ coverage route
→ scenario / RIG requirement
→ production consumer
→ proof criteria
→ closure / finding / obligation
```

If it cannot be routed, record a Detection Gap.

Do not solve coverage by adding parallel checklists, managers, report lanes, or state stores. Improve the earliest existing owner that failed.

## STOP

Stop architecture expansion when every material discovered surface is accounted, every applicable vital domain is terminal, all material interaction/boundary families have dispositions, all contradictions have proof or one narrow unresolved question, and no required capability/knowledge item is silently unused.

The goal is not theoretical completeness over every Minecraft behavior.

The goal is:

> No material gameplay surface or reusable bug-finding capability can disappear from the audit without an explicit disposition.