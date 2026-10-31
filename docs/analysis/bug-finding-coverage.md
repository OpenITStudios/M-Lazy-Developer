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

### Choosing applicable checks — one selected-map audit

These are four **selection inputs** to the existing selected-map audit, not
four test runners, proof owners or separate checklists:

| Input | When it applies | Existing owner |
| --- | --- | --- |
| **Universal** | Every selected artifact: source/surface accounting, applicable player journey, state ownership, inverse/cleanup challenge, coverage/proof closure | Mandatory Audit Procedure and the five coverage layers above |
| **Feature-based** | A source-grounded mechanic or runtime dependency exists: multi-arena, reconnect, persistence, world DB/structure, entity AI, shops, wave progression, boundaries, etc. | Existing scenario preset, semantic/analysis owners and EVALUATE/PROVE |
| **Map-type** | Selected-artifact-bound `RESOLVED` type and player mode, plus its authored mechanic tags; the type supplies focus, not a fabricated expected behavior | `map-classification-audit-profile.ts` consumed by `gameplay-audit-scenario-preset.ts` |
| **Regression/risk** | Relevant changed-source impact, historical failure family or shared mutable owner/resource/timing raises additional investigation pressure | Existing regression knowledge, source coverage and proof owners |

Read selection as **Core + applicable feature + resolved game type +
relevant regression/risk**, then deduplicate checks by one causal owner.
Source-derived scenario questions are investigation tasks, **not** automatic
gameplay `PASS`, new issue types or evidence that Minecraft was executed.

Operator-facing applicability labels can be explained as follows; these are
**descriptive views**, not new persisted enums, runner lanes or proof states:

- `REQUIRED`: universal audit/coverage obligation; apply it to the actually authored player flow.
- `CONDITIONAL_ACTIVE`: an observed or positively supported feature/type activates its relevant check.
- `NOT_APPLICABLE`: a particular check is excluded **only with positive current-artifact evidence**, never because a file/tag/search result is missing.
- `UNRESOLVED`: evidence is insufficient to decide applicability or a material check; retain a scoped Audit Obligation/Detection Gap rather than silently skipping it.

Final proof still uses the canonical `SAFE`, `PROVEN`, `NEED_VALIDATION`,
`AUDIT_OBLIGATION` and `NOT_APPLICABLE` dispositions with established
checkpoint gates. Applicability is **not** a second proof/closure authority.

**Source-test categories are different.** `tooling/repository/test-inventory.json`
owns the 381 repository source-test files by `functionalArea`, `featureId`,
optional lowercase `mechanicTags[]` and `lane`. These fields select tests of
M-Lazy-Developer's implementation when affected or intentionally requested;
they do not directly select `.mcworld` scenarios. The selected-map classifier
uses eight `GameDesignMapType` values, five player modes and 30 uppercase
`GameDesignMechanicTag` values. The 13 gameplay `failureDomain` values
classify independently proven findings **after** PROVE. No one-to-one
file/tag/domain correspondence is required.

**World database is an evidence source, not a fourteenth failure domain.**
Inspect LevelDB/world DB, NBT, structures and script/config references when
available and material; classify unreadable/unsupported/ambiguous records
as source or proof gaps. Only an evidenced player-facing causal contradiction
may become `world-structure-mutation`, `persistence-recovery`,
`state-ownership` or another existing issue domain.

**Examples of activation:** A cooperative multi-arena wave-defense map
requires its authored join/start, parallel arena ownership, wave/entity
progression, simulation and cleanup/reconnect paths; shops are checked only
if the selected source actually supports a shop. A building-plot map instead
activates placement, permission, liquid/stateful-block, spatial-boundary and
applicable reset checks. No `WAVE_DEFENSE` check is forced on a map where
its absence is positively established. Shared writer/selector/ownership
intersections justify a bounded cross-system challenge, not a Cartesian
product of microtests.

### Defect indicators — from category to deciding evidence

These are **investigation indicators**, not automatic test assertions, a second
test inventory, or a new bug taxonomy. Every relevant selected-map scenario
uses an indicator on the existing `GameplayAuditScenario.detectionIndicator`
projection. `candidateFailureDomains[]` lists possible destinations; the
canonical issue classifier and `PROVE` still determine the actual primary
`failureDomain`, `contributingDomains[]`, `issueType`, `gameplayFlow` and
impact-derived severity after current-artifact proof. The generic full-journey
and map-type coverage scenarios deliberately carry no single bug indicator.

| Canonical failure domain | Activate when selected artifact shows | Contract to establish | Suspected contradiction | Deciding evidence | Disconfirming evidence |
| --- | --- | --- | --- | --- | --- |
| `arena-multi-arena` | Parallel/replica arena or shared admission | Arena-scoped state, capacity and cleanup stay independent | Cross-arena mutation or advertised capacity not delivered | Exact arena IDs, selectors, resource leases, replica/world comparison | Scoped ownership/complete replica proof |
| `inventory-economy` | Kit, inventory clear, shop or reward writer | Grant/debit/rollback belongs to correct player/session and commits coherently | Missing grant, stale item or duplicate debit/reward | Writer matrix, transaction ordering, idempotency and failure branches | Reachable rollback or exactly-once grant |
| `progression-wave-objective` | Objective, wave, stage or entity-backed counter | Required work settles before one legal transition | Stalled wave, premature zero or repeated completion | Pending/spawn/death/remove accounting and completion guard | Complete authoritative counter/transition proof |
| `chunk-simulation` | Remote actor/route/objective depends on active simulation | Required chunks/actors resident before gameplay uses them | Remote objective cannot progress or spawn is only requested | Coordinates, lease creation, geometry and readiness evidence | Proved residency or independence from it |
| `player-lifecycle` | Join, lobby, ready, leave, respawn, rejoin | Eligible player has one roster/role/state owner per transition | Stale membership, wrong spawn or premature party reset | Join/leave handlers, roster and generation reconciliation | Reachable roster/phase guards and correct authored quorum |
| `entity-ai-combat` | Combat/target/AI/spawn behavior is required | Actor and target lifecycle allows intended encounter/termination | Attack/target stalls, wrong damage or unaccounted removal | Entity config, event routes, targets and movement prerequisites | Active valid target, navigation and lifecycle evidence |
| `world-structure-mutation` | Plot/build, structure load, teleport, world reset | Authorized blocks and positions change or restore within owned footprint | Unauthorized build, incomplete reset or material replica gap | World files, structure coordinates, mutation footprints and protections | Active bounds/collision/protection and full restoration |
| `ui-feedback-information` | Timer, score, status, dialog, title or queue | Player-visible information matches committed owned state | Stale, misleading or cross-session status | State producer, send route, selected player receiver, delivery when native | Correct scoped postcommit delivery or targeted observation |
| `state-ownership` | Shared mutable state or ownership change | Only authoritative current generation/session may mutate it | Wrong owner or stale generation overwrites state | Exact writer/reader keys, guards and owner transitions | Reached scope/generation exclusion prevents the path |
| `temporal-async` | Timer, subscription, callback, retry or cleanup | Deferred effect remains valid when it commits | Old callback races reset, end or reconnect | Schedule/commit/order, cancellation and generation | All affected branches cancel/revalidate ownership |
| `boundary-capacity` | Capacity, physical edge, maximum+1 or authority cap | Authored boundary is enforced and has a valid overflow result | Overadmission, escape, dead queue or hidden limit | Exact max, resource budget, collision/eligibility guard | Source-supported rejection/queue or complete containment |
| `persistence-recovery` | Persistent state, reload or rejoin | Persisted state reconciles, and transient dependencies restore/reset | Duplicate apply, missing timer or stale restored state | Persisted keys, load path, generation/idempotency and resets | Complete recovery or independent intentional reset |
| `platform-performance` | Edition/API/version or runtime resource limit matters | Claimed capability is supported for exact target and required load | Unsupported API assumption or playable capacity degradation | Pinned runtime profile, capabilities, actual constraint and performance proof | Profile-specific compatibility or measured adequate resources |

**EVALUATE indicator consumption:** The canonical pipeline reuses the
selected map's `auditScenarioPreset` and `deriveAuditModelTaskPackets()`.
The **Mandatory Audit Procedure** alone identifies the applicable preset
scenario IDs for C6 (terminal), C8 (repeated run) and C9 (required cross-system
scenarios). C1–C5/C7 retain their deterministic checks: analysis capability
receipts are not proof that any specific gameplay scenario was encountered.

A blocking checkpoint can receive `scenarioIndicators[]` only where its
declared scenario identity matches one compiled Scenario Graph owner and an
exact causal link with selected-artifact implementation evidence and a
source-backed component. **DETECTION_GAP can supply an investigation question
without supplying C9 closure/PROVEN evidence**; that source is carried to the
model task separately from the checkpoint's proof-admissible evidence.
External/stale sources, unsupported names and duplicate identities cannot
activate an indicator.

C6/C8 own their specific questions before C9, so an indicator is not
presented twice across a blocking task batch. Unresolved causal links take
priority, and each task presents up to three distinct grounded questions,
counting any omitted ones. Task IDs, existing deterministic checkpoint
outcomes, PROVE/REPORT authority and frozen benchmarks remain unchanged.
The absence of an indicator is never proof that a map is safe.

**Application rule:** discover the actual authored gameplay surface and the
selected-source evidence first. For each applicable indicator determine one
grounded expected behavior; investigate the exact adverse branch; search
negative/control cases and Blocking Proof; then record outcome in the existing
surface/flow/vital/cross-system/proof coverage owners. The indicator alone
cannot establish the expected design, actual behavior, runtime success,
severity, or BUG versus DESIGN_MISMATCH. If the source evidence is not enough
to establish a causal player-facing issue, retain a scoped `Audit Obligation`;
if confirmation-ready with a specified missing decisive fact, use the existing
`NEED_VALIDATION` path. Only fully admitted findings may be `PROVEN`.

**Lobby/ready coverage:** the join-pad/team/ready checks are part of the
entry and admission journey when actually present. The absence of a dedicated
`lobby-pre-match` source-test file cannot make that gameplay surface disappear
from selected-map coverage, nor does an existing arena unit test prove its
end-to-end behavior. The full journey and player scenarios require the
source-bound join/ready/leave/start contract when applicable.

**Reference boundary:** the independently versioned developer-skills and
Skills Probe ZIP topic mappings in `tooling/repository/test-inventory.json`
help locate relevant methods and adverse examples only. Their PASS and Node
statuses never count as detected map defects, passing local test cases, or
proof of a particular player's observed Minecraft behavior.

### Indicator evidence-readiness review — historical 31 October 2026

Earlier source-only review mapped 15 historical failure-family cases:
12 had a direct scenario indicator, while 3 were owned by the
canonical multi-scenario checks (container carryover, stage mutation
blocking the next route, and carried-objective disconnect). This was
**routing evidence, not measured detection recall**.

At that snapshot, the regression corpus had 17 declared ready
expectations: 6 defect, 6 designed-behavior, 5 insufficient-evidence.
Those were **expected classes**, not observed detector outputs.
Current TP/TN/FP/FN and precision/recall are **NOT MEASURED**.
Missing cosmetic feedback without authored need or player impact
does not automatically become a gameplay BUG.

The [complete historical crosswalk with frozen case IDs](https://github.com/OpenITStudios/M-Lazy-Developer/blob/dc53541c54e5968d09d19674ae7d94d6ab3b0680/docs/analysis/bug-finding-coverage.md#indicator-evidence-readiness-review--31-october-2026)
remains available at the exact previous Git commit. Current
readiness belongs to the source manifests and actual map evidence.

### Map-type scenario questions (existing canonical owners)

Every selected map retains the universal five coverage layers and player-journey contract.
A resolved, selected-artifact-bound Map Classification activates questions for
`BUILDING`, `COMBAT`, `SURVIVAL`, `STRATEGY`, `SEARCH_PUZZLE`,
`STORY_QUEST`, `CHALLENGE_COURSE`, or `SKILL_COURSE` through the
existing `map-classification-audit-profile.ts` and `gameplay-audit-scenario-preset.ts`.
Every declared canonical mechanic tag adds its own bounded targeted question;
all 30 design mechanic tags are covered in the existing map-classification
profile. These questions supplement the eight type-specific question families
and never establish a bug independently. Multiple gameplay families may apply
to the same selected map.

The classification does not assert defects, suppress discovered hazards, invent
Minecraft proof, or create a new test lane. Unknown classification does not
create type-specific questions. A not-applicable disposition needs positive
current-map evidence. Only shared state/owner/resource/lifecycle intersections
justify cross-system challenges; no Cartesian-product microtest campaign.

### Exact gameplay QA classification by design profile

**Purpose:** make requirements auditable, not merely assign labels to test
files. This is the canonical selected-map coverage owner's human navigation
projection. It adds no test runner, machine test ID, enum, registry, gate or
new proof state. For every check below, expected behavior comes from the
**current selected map**, not the category name or past reports.

**Reference boundary:** User-supplied *Gameplay Analytics Research*
(Minecraft Education 26.32, pp. 1–24) supplies illustrative activities
(PvP Arena, Objective, Chase, Bed Defense, Combat/Waves, Building, Parkour,
Puzzle/Exploration, Stealth, Mining, Education) and possible event signals.
It is research on analytics, **not** a verified QA acceptance standard or
evidence that a selected game implements every example. The private document
is not committed. The requirements below are audit design derived from its
examples plus canonical repository concepts.

#### Classification axes

| Dimension | Canonical value | Meaning |
| --- | --- | --- |
| Base type | 8 `GameDesignMapType` values | One dominant map type; not an isolated test runner. |
| Player mode | 5 `GameDesignPlayerMode` values | Solo/co-op/competitive/team/asymmetric; controls role and ownership challenges. |
| Mechanics | 30 `GameDesignMechanicTag` values | Many allowed; specific checks activate only on current-artifact evidence. |
| Activity/subtype | Derived label (e.g. PvP Bed Defense) | No new enum. Explain using type + mode + mechanics and actual authored behavior. |
| Technical surface | LevelDB, NBT, structures, scripts, session, chunk | Evidence source and implementation scope, not another game type. |
| Gameplay bug | 13 canonical `failureDomain` values after PROVE | One primary and optional contributing root-cause domains; not test-file buckets. |

**Applicability:** `REQUIRED` (universal), `CONDITIONAL_ACTIVE`
(mechanic/type/source-supported), `NOT_APPLICABLE` (positive current-map
evidence rules it out) and `UNRESOLVED` (retain an Audit Obligation). These
are explanatory selection labels, *not* new persisted enums or closure.
Existing `SAFE`, `PROVEN`, `NEED_VALIDATION`, `AUDIT_OBLIGATION` and
`NOT_APPLICABLE` proof rules remain authoritative. Historical regression
cases prioritize but never prove a current bug. Deduplicate checks that
share the same causal owner.

#### Universal — every selected map

| ID | Must establish from selected map |
| --- | --- |
| U01 | Artifact identity, manifest and dependency graph match the exact selected .mcworld and declared platform. |
| U02 | Authored actor, goal, inputs, world/state and permitted success/failure routes can be reconstructed from current artifact evidence. |
| U03 | All applicable ENTRY → START → ACTIVE → PROGRESSION → TERMINAL → CLEANUP → RECOVERY stages are accounted for. |
| U04 | All material mutable state has explicit owner, readers/writers, clear/restore and persistence scope. |
| U05 | Positive, negative, boundary/limit+1 and interleaving checks are considered where materially applicable. |
| U06 | Any suspected contradiction receives source/current-world counterproof; uncertainty is not converted into PASS. |
| U07 | Terminal and exit/replay settle and release the right resources; repeat-run parity is assessed if supported. |
| U08 | Player-facing UI/instructions/result and report match supported state, with precise proof limits. |

#### PvP Core — COMBAT with competitive player mode

The resolved source classification `COMBAT` plus `COMPETITIVE`,
`TEAM_COMPETITIVE` or `ASYMMETRIC` routes these questions through the
existing map-classification profile. The same PvP checks can apply as
source-discovered combat surfaces in larger SURVIVAL/STRATEGY maps; the
primary type label must never suppress a discovered mechanic.
Feature-specific details below are only required where authored.
Each question needs exact source/selector/state evidence, a counterexample
or runtime proof where the effect cannot be established statically.

| ID | Area | What must be true | Deciding evidence |
| --- | --- | --- | --- |
| P01 | Join/roster | Each player is in exactly one authorized active match; duplicate or late joining follows the selected map's rule. | Roster/join/leave source and membership guards |
| P02 | Ready/start | A match starts only after its authored participant/ready conditions; pre-start actors cannot progress it. | Ready quorum, phase guards and terminal ownership |
| P03 | Capacity | The declared minimum, maximum and max+1 are accepted, rejected or queued consistently without partial admission. | Capacity/config, admission and negative branch |
| P04 | Spawn/region | Spawn and teleport destinations are reachable, valid and contained; protected or spectator roles cannot escape through movement privileges. | Spawn, permission and physical world geometry |
| P05 | Eligibility | Unready, eliminated, post-terminal, outsider or protected actors cannot damage, score or mutate the match illegally. | Participant/phase/target guards |
| P06 | Combat/damage | Melee, projectile, environmental damage and health changes affect only legal targets according to the authored rules. | Hit vs actual hurt vs damage writer and guards |
| P07 | Kill/death credit | Each death commits once; kill, environmental death, assist and final-elimination credit go to the correct participant without duplication. | Death and game-defined kill/final-kill ownership |
| P08 | Score/ownership | Individual, team and objective scores are scoped and updated exactly once, never by another arena or side. | Scoreboard keys, source writers, causal score commit |
| P09 | Win/loss/draw | All authored victory, defeat, tie, forfeiture and no-result paths reach exactly one coherent result. | Outcome predicates and player-facing result |
| P10 | Terminal races | Simultaneous final kills, death, timeout, score threshold or overtime cannot produce competing winners or double rewards. | Terminal ownership/atomicity and negative race |
| P11 | Explicit exit | Confirmed quit/surrender is not inferred from disconnect, death, timer expiry or forced removal. | Intent confirmation, session result/penalty branch |
| P12 | Connection loss | Offline roster membership and active-session progression follow the defined missing-player and quorum rules. | Leave/disconnect/timeout lifecycle and owner |
| P13 | Rejoin policy | If reconnect exists, restore the correct team, life, kit, arena and match; otherwise reject/forfeit re-entry consistently. | Source-identified rejoin or explicit non-resume policy |
| P14 | UI/scoreboard | Current HUD, timer, player/team labels and winner announcements reflect committed state for the correct audience. | UI data writer/reader, causal result |
| P15 | Post-match freeze | After the terminal result, old damage, timers, rewards, subscriptions or projectiles cannot mutate the finished outcome. | Generation/phase guard and terminal rejection |
| P16 | Cleanup | Owned player state, inventory, entities, timers and world changes are cleaned or intentionally persisted at exit/abort. | Release/inverse/reset writer contract |
| P17 | Second run | Replay starts from the authored baseline, not stale Run 1 state, roster or delayed callbacks. | Second-run lifecycle and world/state equivalence |

**Meaning of 'required':** every P01–P17 question receives a grounded
disposition, but a feature such as ready pads or in-session reconnect
is not invented for a game lacking it. If absent, prove why the
specific conditional branch is not applicable.

#### PvP conditional mechanic matrix

| Feature | When to activate | Additional exact acceptance |
| --- | --- | --- |
| Team combat | TEAM_COMBAT / TEAM_COMPETITIVE | Legal assignment/switching; team-only scoring and authored friendly-fire restrictions; no cross-team target/role leak. |
| Respawn, lives, final kills | RESPAWN or authored life mechanic | Correct life counter, location and eligibility; permanent elimination only under stated contract. |
| Loadout / class | LOADOUT / authored kit | Selection and switching preserve legal equipment and owned upgrades; death/round restoration matches design. |
| Melee / ranged / special effect | MELEE_COMBAT, RANGED_COMBAT or authored special action | Actual damage vs impact, cooldown/effect duration and target permissions; use start is not completion. |
| Economy / shop / upgrade | SHOP / RESOURCE_ECONOMY | Personal/team payer, recipient, inventory effects, debit-grant-rollback, idempotency, insufficient funds. |
| Round timer / overtime | ROUND_TIMER / SURVIVAL_TIMER | Pause, expiry, extra-time and end collision behave once; stale timer never affects next match. |
| Multiple arenas | MULTI_ARENA or repeated playable arena regions | 2-way and maximal concurrent isolation; scoreboard/selector, replica completeness and shared resource cleanup. |
| World build / destructible arena | BUILD / WORLD_RESET or any world mutation surface | Place/break/damage only inside allowed region/phase; no ghost client state; world restores for replay. |
| Saved state / reconnect | PERSISTENCE / RECONNECT | Persisted vs transient state, invalid session restore, reload and intentional reset have explicit ownership. |
| AI, chunks, projectiles | ENTITY_AI / WAVE_DEFENSE or other remote entity dependency | Navigation, spawn/death removal, chunk readiness and projectile cleanup do not stall or cross boundaries. |
| Objectives / capture | CAPTURE_OBJECTIVE / BASE_ATTACK / BASE_DEFENSE | Single owner of objective HP/flag; contested capture, drop, return, defeat and victory commit exactly once. |

#### Derived activity subtypes — not additional map-type enums

| Subtype | Example from reference or derived activity | Profile combination (illustrative) | Additional QA burden |
| --- | --- | --- | --- |
| PvP Duel / FFA | PvP Arena (Raid Arena Classic) | COMBAT + COMPETITIVE | Legal one-on-one/FFA roster, kills vs death credit, life/score limit, draw, spawn reset; no team-only assumptions. |
| PvP Team Match | Competitive team combat | COMBAT + TEAM_COMPETITIVE | Team/role assignment, friendly fire, team score, switch/leave, team victory and per-player reward isolation. |
| PvP Capture / Flag | Attack Challenge / The Circuit flag examples | COMBAT/STRATEGY + CAPTURE_OBJECTIVE | Carrier ownership, flag pickup/drop/return, valid objective capture, death while carrying and once-only score. |
| PvP Objective / MOBA | Threefold Citadel | COMBAT/STRATEGY + BASE_ATTACK + team/upgrade mechanics | Tower/base health, role/side change, shared objective attacks, win transition; if authored: minions, shops, resource ownership. |
| PvP Chase / Manhunt | Manhunt | COMBAT/SURVIVAL + ASYMMETRIC | Initial Hunter/Runner roles, conversion/tag, owned traps and victim, survival timer, recovery area and role-specific victory. |
| PvP Bed Defense / Bedwars | Beach Bedwars | COMBAT + TEAM_COMPETITIVE + BASE_DEFENSE + RESPAWN | Bed destruction disables only that side's future respawns; final kills are a subset of kills; fireballs, currencies and team upgrades remain scoped. |
| PvP Multi-minigames | Marathon Test of Tactics | COMBAT + active minigame mode switching | One legal vote per player; transition/reset between Bridge/Duels/TNT; no mixing survival time with wins under different modes. |
| PvE Wave / Defense | Defense Challenge / Fall of the Pillager | COMBAT + COOPERATIVE + WAVE_DEFENSE | Enemy spawn/death/despawn counters and objective HP; group wave result separate from individual kill; revive and retry only when authored. |
| Build and Fight | The Circuit / The Gauntlet | BUILD + COMBAT or BUILDING with timed phases | Legal building and timed handoff; enemy vs player-caused block removal; fortification readiness and post-wave restoration. |
| Parkour / Obstacle | Aftershock / The Gauntlet | CHALLENGE_COURSE + PARKOUR | Reachable checkpoint and valid fall/teleport reset, timing, hazards, assistance and complete/replay. |
| Puzzle / Explore | Mysteries of Biomes / Clockwork | SEARCH_PUZZLE + SEARCH/PUZZLE | Correct/wrong input, clue request, valve/relay action ordering, valid completion, no softlock and retry. |
| Build & Guess | Build & Decode | BUILDING + competitive/coop roles | Builder and guesser permissions, categorized answer outcomes, valid/invalid guesses, timer and result; no raw answer retention requirement. |
| Stealth / Hazard | Clockwork | SEARCH_PUZZLE/SURVIVAL + ENTITY_AI if authored | Alert/detection source, distraction use vs observed effect, trap/relay damage vs disable, player hazard/recovery. |
| Mining / Collection | Aftershock | SURVIVAL/SEARCH_PUZZLE + COLLECTION | Ore target vs decoy classification, dedupe per position, owned resource rewards, successful goal and cleanup. |
| Learning / Inquiry | Suggested Education prototype | SKILL_COURSE + appropriate choice/feedback mechanics | Task rules, choice and revision evidence, feedback validity, retry and completion without treating a coded answer as general reasoning ability. |

Subtypes overlap. Example: `Beach Bedwars` is PvP Core + Team Combat +
Bed/Respawn ownership + Shop/Economy + destructible World/Reset + any
Multi-Arena surface detected. Do not run all variants by default.

#### Eight canonical base types — required focal checks

| Base map type | What to verify if this type/feature is observed | Example activity |
| --- | --- | --- |
| BUILDING | Allowed block/item, plot/phase permission, invalid placement and liquid rejection, material grant vs use, reference comparison if authored, world/inventory cleanup. | Build barrier; reference wall; Build & Guess |
| COMBAT | Legal attack/damage/death/credit; kit/life/score; authoritative objective/terminal; wave NPC accounting for PvE; full PvP Core when competitive. | PvP Arena; The Circuit; Defense Challenge |
| SURVIVAL | Hazard/damage cause, resource/life depletion, healing, survival/round timer, NPC threat/chunk readiness, death/restart. | Survival/chase; timed defense |
| STRATEGY | Team/individual resources, purchases/upgrades, objective HP/control, concurrent writes, temporal dependencies and victory. | Threefold Citadel upgrades; tower match |
| SEARCH_PUZZLE | Clue reachability, correct/wrong actions, ordered triggers, unskippable guards, phase reset and no softlock. | Mysteries of Biomes; Clockwork |
| STORY_QUEST | Dialogue/quest trigger ordering, choices/branch, player input, checkpoint recovery, valid story ending and replay. | Adventure objective examples (derived QA extension) |
| CHALLENGE_COURSE | Physical path reachability, jump/fall checkpoint, hazard activation vs damage, retries/assistance, time and completion. | Aftershock; The Gauntlet |
| SKILL_COURSE | Objective/instruction alignment, observed player decision/action, feedback correctness, retry/assessment, supported completion claims. | Proposed learning inquiry prototype |

These broad type requirements supplement the detailed mechanic questions
in `map-classification-audit-profile.ts` and the universal coverage layers.
They never declare a design expected behavior without selected source.

#### Technical QA applies by evidence, not by game label

- `Multi-Arena`: all concurrent sessions and advertised replicas, shared selectors, scoreboards, resource leases, limit/limit+1, arena cleanup and physical geometry.
- `Player Session`: admission/leave/reconnect/reload, role/team ownership and no phantom offline players; actual network loss requires runtime proof.
- `Map DB/NBT/Structure`: archive source consistency, exact record decoding, material world geometry, structure loading, script/config linkage; unreadable DB is a source/proof gap, **not automatically a gameplay defect**.
- `Mechanics`: combat, shop, inventory, crafting, wave, capture, build, parkour, puzzle, minigame voting and progression are checked only if supported by selected artifact evidence.
- `Temporal/Async`: timers, delayed rewards, cleanup and next-run generation guards when any associated callback or deferred writer is reachable.
- `Client/Server and Chunk`: cross-client visual reconciliation, chunk readiness, projectile/AI delivery and real multiplayer concurrency only at the proof tier actually observed.
- `Repair`: developer-source tests and authorized patch preservation are separate from TEST MAP; no original user `.mcworld` is mutated during inspection.

#### Research analytics versus QA evidence

| Event/metric | What the supplied research supports | What it does NOT establish |
| --- | --- | --- |
| playerSpawn / playerLeave | Spawn may be join or respawn; leave gives no reason | Do not infer surrender or unique entry from event count. |
| entityHitEntity / entityHurt / entityDie | A hit, actual damage and death are not the same signal | Kill credit, final elimination and game result need game-owned logic. |
| projectileHitEntity / projectileHitBlock | Target/position impact evidence | Impact does not independently prove damage, valid kill or objective credit. |
| entityHeal / effectAdd | Heal/effect-add report | Full-health event need not restore HP; effectAdd alone does not show expiration. |
| playerInventoryItemChange | Inventory slot mutation | Slot movement is not item acquisition; purchase/consumption requires game logic. |
| itemStartUse / itemCompleteUse | Started vs completed use | Purchase or start is not completed potion consumption. |
| playerPlaceBlock / playerBreakBlock | Block action by player | World edits also occur via scripts/enemies; event count is not final world state or permission proof. |
| Position samples / action sequences | Sampled visits / selected actions | Not a continuous trace; broad high-rate collection grows history or processing load. |

Analytics measurements may be useful for debugging and balancing, but
`entityHitEntity` does not demonstrate valid damage; death alone does not
terminate an attempt; a disconnect is not surrender; final-kill counts
must not be added to ordinary kills; group wave kills are not individual
PvP kills; selected hotbar slots are not item uses; and timed location
samples are not full movement traces. The document warns about event
volume, history growth and per-tick scanning; those are potential cost
markers, not measured performance. Nominal 20 ticks/second is not
guaranteed real elapsed time.

#### What a selected-map report must make clear

Use the existing report/obligation owners to express: exact selected
artifact fingerprint and edition/version, inferred type/mode/tag evidence,
which universal/PvP/type/feature checks apply, which are positively
not applicable, each material requirement's source proof and counterproof,
confirmed finding vs unresolved obligation, and the exact runtime evidence
still needed. The category or analytics event itself never means PASS.

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

## Bounded literal-value forwarding into typed UI calls

The selected-map parser admits a limited source-only value path from a
literal `{ translate: "key" }` to a typed UI API call: up to four uniquely
owned, immutable `const` bindings with one lexical consumption each, static
object/array containers, a unique single-statement helper, and one
uniquely resolved static `this.method(...)` within the same authored class.
For the class path, the selected formal must occur exactly once in the
method body as the FIRST argument of an independently typed Minecraft UI
API call; its class-qualified source region and an exact matching
`localFunctionCalls` edge are both mandatory. Canonical receiver inference
now uses `sourceMethodRegion` for typed API calls authored inside class
methods, including named class expressions; nested callbacks still own
their separate execution regions. The parser still owns the original literal
site; the independent canonical Semantic IR verifies the *target* API
call's own execution region, receiver, method and full source span.
Each handoff is registered as a separate selected-artifact source witness
and is retained in the existing Gameplay Contract / model handoff.

Do not assume that an immutable variable name proves immutable content:
multiple reads, other uses/mutation, shadowed declarations, computed or
spread properties, duplicate object keys, dynamically constructed keys,
nested/async helpers, non-static or inherited class-method dispatch,
anonymous classes without position-qualified source identity, method
properties explicitly replaced through same-file assignment, delete or
owner-level mutation, competing static member/accessor/computed declarations,
reassigned or multi-use method parameters, expression-level transforms,
ambiguous call targets and unknown typed receivers fail closed. A source-forwarded text value does
NOT establish that a helper ran, message was displayed, locale selected,
a player/arena owned the recipient, or that any objective/outcome was
achieved. Source-only evidence must never upgrade design authority or
close Proof Saturation / final PROVEN thresholds. Frozen calibration and
blind acceptance expectations remain unchanged.

### Bounded UI literal source acceptance — October 29, 2026

The within-file literal-to-typed-UI source feature has a bounded source
acceptance receipt; it does **not** have end-to-end or Minecraft-runtime
acceptance. Direct analysis of four SHA-256-verified calibration archives
found 4 same-class UI value forwarding candidates in Composite out of 81
literal translation sites across 62 scripts. All four candidates have
exact source coordinates and locale keys present in the original archive.
The exact GitHub value-flow module blob
`86c93d772a6d80eb680af5184b66dcd51bd0bde7` passed a strict isolated
stub-import type check and 19/19 positive/negative AST scenarios.

**Proof separation:** the selected-map receiver inference was executed
from a portable October 25 repository snapshot with the canonical
class-method region correction; it was **not** the full current HEAD
parser/IR/Gameplay Intent execution. No `runSelectedMapAudit()`, Minecraft
runtime, effective pack selection or change in `PROVEN` was measured.
This is a source-calibration acceptance record, not a scorable frozen
benchmark or a substitute for complete selected-map runtime evidence.
Do not extend the source detector solely to inflate candidate counts.
The specific evidence and missing proof remain recorded at
`engine/reliability/history/audit-runs/evaluations/2026-10-29-ui-literal-source-acceptance.json`.

## Exact source UI-send attempts and map-native player contracts

The parser admits a literal translation's UI-send attempt only when its
JSON-like `{ translate: "key" }` object is directly contained in the argument
of a uniquely typed Player/World `sendMessage` or ScreenDisplay `setTitle` /
`setActionBar` AST call. Variable aliases, nested helper invocations, dynamic
expressions, untyped same-named calls, object spreads, duplicate property
names (including duplicate nested `rawtext` containers), and unrelated
same-function API calls do not supply that edge. A later duplicate object
member could overwrite the supposedly delivered translation; both direct
and forwarded source adapters must therefore reject the ambiguous object. The Gameplay Intent Stage independently
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

## Source-guarded UI entry paths

The canonical typed Semantic IR API call preserves exact lexical and
precedence guard source sites of that call. Authored guard syntax is not
proof that the guard was satisfied in play. UI source-path navigation reuses
canonical `semanticIrExecutionTraces()` entrypoint eligibility and bounded,
cycle-safe directed, source-located resolved IR edges. Each entry candidate
retains its own contiguous edge chain and branch guards; conditions of
different alternative chains must never be merged into a single proof.

A source path is admitted only when the selected map has resolved
manifest-attached script roots. Missing manifest authority, disconnected
source paths and bounded exploration remain distinct explicit gaps.
Selected-source path eligibility does not prove that an event fires, a guard
passes, a particular player/arena receives the UI, the client selects a
specific pack/locale, or the intended gameplay objective is correct. The
canonical Gameplay Contract and model handoff present these source-only
witnesses without changing APPROVED design, Proof Saturation or PROVEN.


## Exact UI-to-gameplay source-step correlation

A source-reachable UI call is not itself a valid dependency on a phase,
objective, state, or outcome. The canonical Gameplay Intent stage now binds
candidate UI calls only to exact, already owned Semantic IR state writes,
authored return outcomes and world-effect attempts in their *same* source
execution region. Both the UI call and source step need a unique current
artifact evidence locator, and the subject must cite the exact source-step
ID. Same file, similar labels, shared function names and shared trace entry
are not sufficient. Opposite arms of the same fully located authored
guard exclude a candidate. A return before a later UI call in that function
is not silently treated as a reachable UI continuation.

The candidate preserves strict lexical before/after source order, source
step guards, and whether the UI region has a manifest-rooted source path.
Lexical order and lack of an exact opposite-branch witness are not proof of
the branch being taken or the operation causing the UI. Phase/goal claims
without exact IR-step ownership remain unbound. The earlier
`relatedOutcomeCandidateIds` projection is now restricted to objective or
outcome subjects with exact source-step correlation, rather than loose
execution-region membership. Bounded omissions are explicit. All these are
read-only investigation hints, not new Intent edges, approved objectives,
player delivery proofs, bug findings or Proof Saturation criteria.

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
