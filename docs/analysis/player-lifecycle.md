---
id: document.analysis.player-lifecycle
class: DOCUMENT
domain: analysis
role: DOMAIN
authority: CANONICAL
lifecycle: ACTIVE
---

# Player Lifecycle

## Purpose

Canonical analysis contract for player identity, connection, participation, death/downed/respawn, reconnect, and deferred-work ownership.

Minecraft runtime identity, project session identity, arena membership, participation, and life state are separate lifecycles. Treating them as one timeless player object causes stale callbacks, reconnect leaks, duplicate transitions, and revive/respawn corruption.

## Identity model

Keep these independent:

```text
logical player identity
≠ current Player runtime reference
≠ connectionGeneration
≠ arena membership
≠ arenaGeneration
≠ participationGeneration
≠ lifeGeneration
```

Recommended correlation envelope:

```text
playerKey
connectionGeneration
arenaId?
arenaGeneration?
participationGeneration?
lifeGeneration?
```

Every deferred callback or transaction captures the relevant envelope and revalidates it before mutation.

## Session lifecycle

```text
ABSENT
→ CONNECTED_UNINITIALIZED
→ RECONCILING
→ LOBBY_READY
→ ARENA_ASSIGNED
→ ACTIVE
   ├→ DOWNED
   ├→ DEAD
   ├→ SPECTATOR
   ├→ TRANSITIONING
   └→ DISCONNECTED
```

Reconnect always creates a new connection generation.

Respawn is not reconnect. Reconnect is not resume. Persisted state is not current-session authority.

## Life lifecycle

Project life-state may differ from Minecraft engine state:

```text
ACTIVE
→ DOWNED
→ BEING_REVIVED
   ├→ REVIVED
   └→ DEAD_CONFIRMED
→ RESPAWNING
→ ACTIVE / ELIMINATED
```

Do not collapse:
- low-health threshold;
- health zero;
- entity death event;
- respawn event

into one proof signal.

## Reconnect reconciliation

Durable facts may be restored by policy. Transient state must be reconciled, including:
- ready state;
- downed/revive ownership;
- forms/UI;
- pending teleports;
- spectator/loader duties;
- countdown participation;
- timers and callbacks;
- cached runtime references;
- pending async work.

Old-generation callbacks must never mutate the new connection/session.

## Respawn reconciliation

Define reset/preserve behavior explicitly for:
- life state;
- health/max-health;
- gamemode;
- inventory/equipment;
- effects;
- input permissions;
- tags/scoreboard mirrors;
- dynamic properties;
- pending teleports;
- revive ownership;
- timers;
- arena membership.

Only one restore owner may apply a given life-generation recovery to avoid duplicate kit/state restoration.

## Revive ownership

A valid revive transaction requires, when applicable:

```text
target is DOWNED
reviver exists
reviver != target
same arena/session generation
reviver connected and ACTIVE
interaction still valid
revive generation current
target still eligible at completion
```

Invalidate revive on death, disconnect, respawn, arena/participation generation change, invalid interaction, or competing terminal transition.

## Arena/session transaction rule

Events request evaluation; they do not each own transitions.

```text
WAITING
→ COUNTDOWN
→ SETUP
→ ACTIVE
→ FINALIZING
→ COMPLETE
```

Each transition has one accepted owner per generation. Terminal side effects must be idempotent.

## High-value failure modes

- ghost-ready state after disconnect;
- stale reconnect continuation;
- duplicate countdown/start;
- cross-arena selector leakage;
- respawn state contamination;
- self-revive or multiple revive owners;
- revive completion after death/disconnect;
- stale runtime reference;
- persisted state used as current-session authority;
- duplicate terminal side effects;
- dead/respawning players counted active/ready.

## Required review

For each player-sensitive subsystem ask:

1. Which identity layer owns this state?
2. What invalidates it?
3. What changes on disconnect?
4. What changes on respawn?
5. What may reconnect restore?
6. What generation owns deferred work?
7. Can multiple actors request the same transition?
8. Is terminal/recovery commit idempotent?
9. Is arena/session scope explicit?
10. Can a stale mirror or runtime reference masquerade as authority?

## Coverage integration

Player Lifecycle feeds:
- `CONNECTION_RECOVERY`;
- `ENTRY_ADMISSION`;
- `GAME_STATE_PROGRESSION`;
- `INVENTORY_PLAYER_CAPABILITY` when restore/reset affects player state;
- cross-system checks for reconnect × inventory, reconnect × death/respawn, retry/recovery, terminal collision, and deferred ownership.

It remains subordinate to the canonical selected-map audit and [Bug-Finding Coverage](./bug-finding-coverage.md).
## Platform knowledge

Minecraft platform facts referenced by this analysis are owned by:

- [Player Life](../../engine/knowledge/player-runtime/player-life-bedrock.json)
- [Player Runtime](../../engine/knowledge/player-runtime/player-runtime-bedrock.json)

This document owns audit/failure-model guidance. The linked knowledge files own platform facts and applicability.

### Source-typed player persistence evidence

The selected-script session summary counts dynamic-property access attempts
only when the existing AST receiver inference identifies a `Player`.
An arbitrary helper named `playerCache` is not player-persistent state,
while a typed player alias is still visible. Join, spawn and leave event
subscriptions require an actual `@minecraft/server` runtime import; source
presence alone does not establish session cleanup, generation invalidation,
or post-reconnect state correctness.

### Source-first player ID / initial-spawn investigation (2026-10-27)

The canonical script parser now retains only exact current-map callback
evidence from imported `world.afterEvents.playerLeave` and `playerSpawn`:
direct `event.playerId` call arguments; a bounded direct
`moduleConstMapOrSet.delete(event.playerId)` call when the receiver is a
unique module-level `new Map` / `new Set`; and explicit reads of the
callback's `event.initialSpawn` flag. Shadows, arbitrary method names,
nested callbacks and unrelated user objects cannot manufacture these
sites. Passing an ID to a helper is NOT evidence of that helper's cleanup;
one direct delete is NOT proof all session caches were evicted.

The existing `analyzePlayerSessionLifecycle()` owner is now consumed by the
production `analyzeInspectionRuntimeState()` stage using the selected
artifact's parsed scripts; its source-only summary flows through
`InspectDirectoryResult.playerSessionLifecycle` into the existing
`--brief` formatter. No new game-audit entrypoint, engine proof gate,
cache manager or external code was installed. A textual arena authority
in `world.getPlayers()` is a candidate partition, not proof that its
result or later mutations exclude sibling arenas.

The existing exact local/ESM call resolver now links an authored
`playerLeave` `event.playerId` argument to one resolved helper declaration
in the same selected artifact, if unique. The selected-source brief shows
the helper's file/line alongside the call site; unresolved/ambiguous
helper targets remain unknown. This is source call topology only: a
resolved declaration may not delete a single cache entry, invalidate a
generation or preserve the other arena's active player state.

### Exact helper-body Map/Set deletion source (2026-10-27)

The one script parser also retains direct `Map/Set.delete(formal)` calls in
unique top-level helpers with a module-const collection and an unreassigned,
unshadowed helper parameter. The established exact local/ESM call resolver
joins a `playerLeave` callback to that authored helper deletion only when
there is a unique source call, a unique direct `event.playerId` argument
position, and matching callable declaration, parameter position and arity
in the same selected artifact. Nested closures, unsupported aliases, edited
parameters, ambiguous targets and unowned collections stay unresolved. The
existing audit brief reports the matched source location as a **candidate
deletion call**, never a verified eviction, complete multi-cache cleanup,
generation invalidation, or player/arena safety proof.

### Player-leave helper, arena generation, and delayed-work boundaries

The production Player Session source projection now correlates the exact
`event.playerId` helper call to an authored arena membership release
**only** when the uniquely resolved target's direct module-const
`Map/Set.delete(formal)` witness receives the same parameter as an
`arena.members/players.delete(formal)` source statement in the same
parser-resolved helper region. An `arena.generation` write from that same
authored arena/region is listed separately, never treated as proof it ran
before or after another operation. Unknown parameter forwarding, another
helper, a different region, or a different arena expression cannot close
the join.

Scheduler sites authored inside that resolved helper are also surfaced,
with the parser's existing *leading mismatch early-exit* generation-guard
source when present. Exact syntax matching of a guarded operand against
the same authored arena generation write is a **source reference candidate**,
not a valid session-token capture or executed cancellation. The actual
player object, stale callback generation, active arena membership, and
sibling-arena preservation remain `UNKNOWN` without independent proof.
The analysis does not modify the original map, replace the existing
arena-lifecycle analyzer, or copy project-specific upstream modules.

### Source ambiguity and deferred safety boundary

The arena authority correlator keeps multiple matching membership releases
or generation writes ambiguous rather than selecting the first source
statement in a region. Player Session accepts a helper membership-release
join only when the release's AST argument resolves to the same unshadowed
formal parameter index and arity as the selected playerLeave call.
Same-spelled local identifiers do not establish that binding.

Arena Lifecycle now classifies a leading generation mismatch exit as
`source-guard-candidate`, not `protected`, even when a material mutation
occurs in that callback region. Mutable session tokens, owner identity,
mutation-target scope, generation invalidation on all reset paths, and
side effects between checks remain unproven. The existing lifecycle
diagnostic surfaces unresolved deferred mutation safety, including
authored guard candidates. This is a conservative source-level change,
not a finding that the selected Minecraft map is actually broken.
Existing tests asserting `protected` from guard syntax require reassessment
when the deferred verification phase is authorized.

### Same-block generation snapshot candidates

The parser now captures a unique direct `const owner` followed by
`const token = owner.generation` in the scheduler's exact lexical block
before a direct scheduling call whose callback first checks a token-vs-
generation mismatch and exits. Mutable or competing declarations, callback
shadows and non-direct schedulers remain unknown. This record passes
through the existing Semantic IR, Player Session, Arena Lifecycle and brief.

`source-snapshot-candidate` is NOT `protected`: live selected-arena and
session identity, the exact mutation target, control-flow dominance, and
all-path generation invalidation/cancellation remain unproven. Both
snapshot and guard-only candidates still count toward unresolved deferred
mutation ownership, and Minecraft execution is not implied.

### Captured generation versus direct typed mutation source

The canonical arena authority and state-write evidence can now be joined
to direct expression statements after a callback's leading mismatch guard
ONLY inside its exact authored callback body. A typed mutation's arena
expression is compared with the prior same-block `const` owner expression;
same-authored-expression and different-authored-expression remain distinct.
Lexical shadowed/nested statements, indirect helpers and unknown side
effects do not inherit a direct guard or owner identity.

A `source-snapshot-candidate` now additionally requires at least one
direct typed mutation of the captured authored owner expression and no
direct different-expression mutation or reachable helper mutation region.
The source evidence is carried through the existing Semantic IR execution
edge, Arena Lifecycle diagnostic and Player Session brief. This cannot
prove live object identity, arbitrary control-flow dominance, actual
generation invalidation/cancellation or Minecraft gameplay safety.
Every such candidate remains unresolved for runtime ownership, while
TypeScript, Vitest, CI and Minecraft testing remain NOT EXECUTED.

### Exact statement order versus generation safety

The canonical script parser records the containing lexical block and
statement index for direct helper `Map/Set.delete(formal)` calls and
scheduler invocations. The existing arena-authority extractor now supplies
the same source positions for membership release and generation
invalidation. The Player Session projection compares source positions
**only** inside the exact same artifact/module/block. A deletion in a
different `if` arm, loop, nested function, or unrelated arena therefore
has unknown relative order. Multiple matching source deletes or generation
paths cannot be selected arbitrarily.

Reported `before`/`after` directions are authored statement indices, not
control-flow dominance: intervening exits, callbacks, mutations, exceptions,
runtime time of execution and captured generation correctness remain
unproven. A deferred guard is a source candidate only when the existing
parser finds its leading generation mismatch exit, and an authored arena
generation comparison is noted only where one unambiguous path and
distinct operands are visible. The existing arena-lifecycle analysis
remains the owner for whether a deferred gameplay mutation has direct
generation-guard evidence. No new proof owner or test runner is created.
All TypeScript, Vitest, CI and Minecraft validation remain NOT EXECUTED
until the user permits them.

The developer's `bedrock-entity-lifecycle` guidance and Skills Probe P53
source demonstrate player-ID-keyed ephemeral collections, leave eviction,
initial-spawn invalidation and different respawn behavior. P53's Node
reports do **not** establish Minecraft event delivery or multiplayer
correctness: its engine/multiclient checks remain pending. No Minecraft,
TypeScript, Vitest or CI execution is implied by this source change.
