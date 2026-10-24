# Gameplay Flow Contract

## Required Player Flow

Map audit should describe the player journey:

```text
Lobby
→ Join Arena
→ Ready
→ Countdown
→ Preparation
→ Build / Shop
→ Combat
→ Wave Progression
→ Death / Respawn
→ Retry / Checkpoint
→ Level Progression
→ Victory
→ Result / Cleanup
```

Every bug must belong to a gameplay flow location.

## Bug Location

A report should answer:

- Where in the player journey does it happen?
- What action triggers it?
- What should happen?
- What happens instead?
