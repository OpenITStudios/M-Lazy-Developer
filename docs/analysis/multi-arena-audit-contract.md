---
id: document.analysis.multi-arena-audit-contract
class: DOCUMENT
domain: analysis
role: CONTRACT
authority: CANONICAL
lifecycle: ACTIVE
---

# Multi Arena Audit Contract

> Start from `master-selected-map-audit-workflow.md`. This document is the specialist contract for replica, capacity, isolation, cleanup, and reuse inside the canonical FORMALIZE/EVALUATE stages.

Multi Arena is a core gameplay system. Audit both **isolation** and **capacity**.

## Full-map baseline and delta rule

Before capacity/isolation proof, build one normalized replica model from world DB/topology and source/config evidence:

```text
Detect replicas
→ Normalize offsets
→ Baseline arena
→ World/topology comparison
→ Source/config reconciliation
→ Replica proof quality
→ Material delta set
```

Do not repeat a full audit six times for six equivalent arenas. Reuse baseline proof only for replicas whose proof is complete/bounded and whose differences are classified as non-material/expected.

A diverged replica is not automatically a bug. It becomes a causal candidate only when the delta affects gameplay structure, ownership, route, objective, simulation, cleanup, or another player-visible dependency.

An incomplete/no-proof replica cannot inherit baseline safety.

### Persisted ticking-area capacity evidence

For command-created ticking areas, the published Bedrock command ceiling is
**10 per world** ([Microsoft Ticking Areas](https://learn.microsoft.com/en-us/minecraft/creator/documents/tickingareacommand?view=minecraft-bedrock-stable)).
The ceiling is a platform rule, not evidence that all ten slots are free.

The canonical native World DB scan counts `tickingarea_` persisted records
without decoding user-controlled names. Only a **complete** selected-artifact
scan can supply the existing arena-capacity extraction owner with an occupancy
count, including a verified zero. A missing/truncated/unreadable scan is
**UNKNOWN**, never zero. For complete source-derived per-arena command families:

```text
command capacity ceiling = floor((10 - observed persisted areas) / per-arena adds)
```

This is still a *resource ceiling*, not proof that queues, allocation, chunk
readiness and actual concurrent starts work. Script-managed ticking area
capacity remains a separate unresolved backend unless independently grounded
for the target edition/version. A source-only declared admission cap cannot
close the native command-budget uncertainty. Historical project defaults
(such as five concurrent arenas) are never universal map design rules.

## Exact command-family accounting

A static `/tickingarea add` is only one **candidate** resource
operation. Relative or unsupported coordinates, invalid circle radius,
rectangular areas exceeding the documented chunk limit, incomplete
or duplicate replica offsets and reused area names may not silently be
discarded. Each invalid/unresolved command stays visible in the existing
arena-capacity evidence, and the overall command resource remains UNKNOWN.

After normalizing replica offsets, count authored `add` commands as a
**multiset of shape + absolute position**. Every expected translated
position must match exactly once and every authored add must be accounted
for. Equal arithmetic counts alone are insufficient: two candidate
families may share a position while a different source command is omitted.
Ambiguous family partitions fail closed instead of becoming evidence
that all arenas have equal ticking-area budgets.

These structural checks still do not prove the command was executed, the
name was accepted, or that an area was dynamically created rather than
already present in the native snapshot. The capacity calculation is
source/native resource analysis, not effective concurrent-start proof.

Include typed Script API `runCommand` / `runCommandAsync` literal calls
that mutate ticking areas and `.mcfunction` remove/remove_all commands in
the existing resource evidence. They are not evidence of execution or live
lease ordering. If any such mutation can change occupancy after the
selected-world database snapshot, leave the effective capacity `UNKNOWN`
in Gameplay World even if the source-only resource formula returns a
number. The existing diagnostic consumer must also abstain from a
**command-only critical shortfall** whenever the source/DB accounting does
not prove that live allocations are distinct from persisted areas—even
when no explicit remove was found. Keep the numeric source/DB snapshot
as a conditional internal resource calculation, not a proven safe
simultaneous capacity or a published blocker. Independently proven hard
admission-cap shortfalls remain actionable.
Retain the source location and conditional arithmetic instead of silently
promoting an admission cap to proven simultaneous gameplay.

## Effective-concurrency proof

Configured capacity is not deliverable capacity.

```text
MAX_CONCURRENT_ARENAS = N
+ N physical arenas
+ resource budget appears sufficient
≠ N arenas can actually start
```

Before closing a concurrency finding, trace the complete admission-to-commit path:

```text
ready/admission
→ startup/recovery gates
→ queue insertion
→ reservation
→ native resource allocation
→ readiness verification
→ countdown/start commit
```

Every gate that can hold a request before reservation is part of concurrency capacity. In particular, a global startup/recovery gate can reduce effective capacity to zero even when the configured cap is six.

For queue-backed systems, prove at runtime at least:

- an idle world can start one arena;
- multiple independent ready arenas leave the visible queue and acquire concurrently;
- queue position appears only when a real deliverable resource limit is reached;
- stale/recovery cleanup cannot hold all fresh requests indefinitely;
- failure diagnostics expose the exact gate/resource preventing allocation.

Do not close a historical concurrency bug from constants, resource arithmetic, or static topology alone when the player-visible claim is that multiple sessions can actually start.

### Runtime replica evidence

Direct runtime testing across every physical arena is valid gameplay evidence for the scenarios actually exercised.

```text
all physical arenas tested
+ same material gameplay path succeeds
→ runtime evidence for playable replica behavior
```

It does not prove byte/block-level structural equivalence outside the exercised paths. When deterministic world-DB/topology comparison is available, use it to strengthen reusable baseline/delta proof rather than discarding valid runtime evidence.

Record the distinction explicitly:

- runtime-safe on exercised gameplay path;
- structurally equivalent / bounded-equivalent / divergent / incomplete according to topology/world proof.

Do not keep a broad NEED_VALIDATION merely because structural proof is unavailable when direct runtime evidence has already decided the player-visible claim being audited.


## Required audit order

```text
Visible Arena Count
→ Playable Arena Count
→ Concurrent Arena Limit
→ Capacity + 1 Behavior
→ Queue / Admission Behavior
→ Player Feedback
→ Simultaneous Start
→ Shared / Global Resource Contention
→ Session Isolation
→ Player Isolation
→ Wave / Enemy / Score Isolation
→ Cleanup
→ Reuse
```

## Capacity rule

Do not infer that an arena is playable merely because it exists physically or has a join surface.

Record:

- visible arena count;
- actual concurrent arena limit;
- what happens at the limit;
- what happens at limit + 1;
- whether queueing is grounded as intended;
- whether players receive clear feedback.

Existence of queue code is not proof that queueing is intended design.

## Isolation rule

Check that one arena cannot materially affect another through:

- selectors;
- player/session state;
- enemies/projectiles;
- score/reward;
- timers;
- cinematics;
- structures/world mutation;
- gamerules or other global resources;
- cleanup/reset;
- developer/admin actions.

### Source-first query and cleanup ownership

An authored `world.getPlayers({ tags: ... })` query, a tag name
containing `arenaId`, or a command mentioning an arena identifier
is not proof that the returned players/targets are members of this
arena. Distinguish a source filter candidate from unique live membership
and downstream mutation ownership. `world.getAllPlayers()` must not
inherit filtering evidence from unrelated source expressions.

A typed `Dimension.getEntities(...)` inside an arena-associated source
flow now yields a scoped investigation observation. Its source argument
may include `tags`, `location`, `volume`, `maxDistance` or
`minDistance`; even an arena-keyed combination requires proof of distinct
tag allocation, correct query geometry, entity identity, unloaded-chunk
handling and cleanup effect scope. A plain/global query or computed
unresolved filter also remains `partition-proof-required` rather than a
speculative cross-arena BUG or isolated PASS.

A source-level `Entity.remove()`, `Entity.kill()` or persisted
`playerId` helper call cannot independently establish that cleanup
executed, targeted the right arena generation, or preserved active
sibling arenas. A command pair like `ability @s mayfly true` /
`ability @s mayfly false` only establishes a syntactic inverse, not
the same player identity across command-executor contexts. It remains
surface-level/partial until executor and session ownership are bound.
When several acquisitions share a surface/key, exact cleanup proof
requires every acquisition's source precision to be exact; one exact
occurrence cannot upgrade another unresolved player/entity owner.
Use selected-map contracts and stronger evidence at the existing audit
proof/admission gates; publisher ZIP rules and historical Skills Probe
outcomes are reference, not universal map design.

### Cross-file cleanup proof boundary

The selected-source ESM resolver may establish a unique, exact imported
call chain from a terminal into a cleanup helper in another module.
The existing cleanup analyzer follows only resolved, same-artifact calls
between unique source-module owners. A matching remote release is a
**partial cleanup candidate** with the source module path retained in
`releaseRegions`, but only if each reachable local/ESM hop has a unique
parser-proven unchanged argument-to-formal binding for the source resource
owner. Exact `World` singleton properties can instead cross no-argument
helpers because they have a stable world-level owner. Literal tag names,
`@s`, player selectors, unbound/renamed arguments and other unknown
receiver identities cannot borrow a remote cleanup proof. Even a fully
source-forwarded chain never certifies that the terminal and helper refer
to the same live player, arena, generation or executed reset. Unresolved,
ambiguous, cross-artifact, or absent imported calls cannot supply cleanup
evidence. The source-owned ledger keeps terminal assessments matched to
their exact script instance, not the potentially repeated
`script.identifier` display label.

## Simultaneous-start rule

Independent arenas must be reviewed under simultaneous start and overlapping lifecycle transitions. A system that works sequentially but fails when two arenas start together is a gameplay defect candidate.

## Reuse rule

After cleanup, an arena must be reusable without residue from a prior generation. Review at least one second-run path when the artifact supports reuse.

## Classification

A cross-arena or capacity defect requires player-visible impact and selected-artifact evidence.

Do not classify architecture complexity as a bug by itself. Do not dismiss a limitation as designed solely because a hard-coded limit exists.