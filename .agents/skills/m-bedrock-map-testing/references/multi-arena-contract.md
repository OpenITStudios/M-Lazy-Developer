# Multi Arena Contract

Multi arena is a core gameplay flow, not an optional feature.

Audit:

```text
Arena Assignment
→ Session Isolation
→ Player Isolation
→ Wave Isolation
→ Enemy Isolation
→ Score Isolation
→ Cleanup
→ Arena Reuse
```

Expected:

- Arena state does not leak between sessions.
- Player actions affect only their assigned arena.
- Cleanup releases the arena correctly.
- Queue and active arena limits are documented as design rules, not automatically treated as bugs.
