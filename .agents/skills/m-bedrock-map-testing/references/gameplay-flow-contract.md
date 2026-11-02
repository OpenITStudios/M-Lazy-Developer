# Gameplay Flow Contract

This is a navigation reference only. Canonical order and proof are in
`docs/analysis/master-selected-map-audit-workflow.md` and
`docs/analysis/mandatory-audit-procedure.md`. Only the exact selected
`.mcworld` may establish which phases and mechanics are actually authored.

## Required player-flow reconstruction (where applicable)

```text
LOAD/DISCOVERY: world and pack initialization (not a player phase)
ENTRY_JOIN: connect -> initial spawn -> lobby -> select arena -> waiting
READY_START: team/role -> ready gate -> countdown (may cancel)
SETUP: reserve arena -> initialize/teleport/loadout -> start commit
ACTIVE_GAMEPLAY: preparation -> permitted player actions/mechanics
PROGRESSION: objectives -> wave/level/checkpoint -> LIVE scoring
TERMINAL: win/lose/draw/timeout -> FINAL score -> reward -> result UI
CLEANUP_REPLAY: stop callbacks -> cleanup/reset -> return lobby -> replay
RECOVERY: disconnect/reconnect, death/respawn, reload, abort across phases
```

Phases can branch, repeat, merge or be absent on positively grounded maps.
Multi-arena ownership and session generations cross the entire journey.
For every applicable phase and transition record entry trigger, guard,
owner, created/consumed state, success/failure exit, next state, cleanup,
recovery and exact current-source evidence.

## Bug-location rule

A finding identifies the stage/transition, action or event, expected
and actual behavior, affected player/arena/session, source evidence
and missing runtime proof. Distinguish LIVE score from FINAL result,
reward transaction and cleanup even when writers share a scoreboard.
A source-directed edge or preset question is NOT observed player play
or a QA PASS. An unresolved phase remains an audit obligation until
canonical PROVE resolves it.
