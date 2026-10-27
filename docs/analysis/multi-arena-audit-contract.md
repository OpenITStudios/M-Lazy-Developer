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

### Effective-concurrency proof

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
sibling arenas. Use selected-map contracts and stronger evidence at
the existing audit proof/admission gates; publisher ZIP rules and
historical Skills Probe outcomes are reference, not universal map design.

## Simultaneous-start rule

Independent arenas must be reviewed under simultaneous start and overlapping lifecycle transitions. A system that works sequentially but fails when two arenas start together is a gameplay defect candidate.

## Reuse rule

After cleanup, an arena must be reusable without residue from a prior generation. Review at least one second-run path when the artifact supports reuse.

## Classification

A cross-arena or capacity defect requires player-visible impact and selected-artifact evidence.

Do not classify architecture complexity as a bug by itself. Do not dismiss a limitation as designed solely because a hard-coded limit exists.