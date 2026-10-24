# User Input Translation Cases

Use these as qualitative prompt-intake benchmarks.

The goal is not exact wording. The goal is preserving symptom meaning, uncertainty, bounded search expansion, and non-authoritative semantics.

## Case 1 — Vague progression symptom

User:

```text
wave suka stuck kadang gak lanjut
```

Required interpretation:

```text
SYMPTOM_REPORT
- possible progression stall / transition failure

Priority domains
- progression-wave-objective
- entity-ai-combat
- chunk-simulation
- temporal-async

Priority player flow
- PROGRESSION
- TERMINAL

Do not assume
- ticking area
- entity AI
- scoreboard
- wave counter
until selected-artifact evidence decides.
```

## Case 2 — User guesses root cause

User:

```text
ini ticking area error kayaknya mobnya gak jalan
```

Required interpretation:

```text
SYMPTOM_REPORT
- remote actor may stop behaving/simulating

SUSPICION
- ticking/chunk residency may be involved

Priority domains
- chunk-simulation
- entity-ai-combat
- progression-wave-objective

Do not convert "ticking area error" into a bug fact.
Search alternative selected-artifact causes such as spawn ownership, navigation, actor lifecycle, and progression accounting.
```

## Case 3 — Inventory symptom

User:

```text
abis ganti kit barang kadang ilang kadang dobel
```

Required interpretation:

```text
SYMPTOM_REPORT
- possible item loss
- possible duplicate item grant

Priority domains
- inventory-economy
- persistence-recovery
- player-lifecycle
- state-ownership

Priority flows
- SETUP
- ACTIVE_GAMEPLAY
- CLEANUP_REPLAY
- RECOVERY

Search
- grant/consume
- reset
- restore ownership
- duplicate writers
- idempotency
- death/reconnect
- stale callbacks
```

## Case 4 — Multi-arena vague report

User:

```text
multi arena masih aneh, player kadang masuk tempat lain
```

Required interpretation:

```text
SYMPTOM_REPORT
- possible cross-arena assignment/isolation failure

Priority domains
- arena-multi-arena
- state-ownership
- player-lifecycle
- world-structure-mutation

Search
- assignment
- arena ownership
- selectors
- teleport/spatial scope
- cleanup/reuse
- stale generation
```

## Case 5 — Broad "game broken"

User:

```text
game kadang gak selesai cari masalahnya jangan test semua
```

Required interpretation:

```text
SYMPTOM_REPORT
- completion can fail

TEST_CONSTRAINT
- static-first bounded proof
- no broad manual trial matrix

Priority domains
- progression-wave-objective
- state-ownership
- entity-ai-combat
- chunk-simulation
- temporal-async

Search
- completion tracker
- required actor/work accounting
- transition path
- terminal collision
- deferred work
- cleanup/recovery

"jangan test semua" must not suppress discovered material gameplay.
```

## Case 6 — Design claim mixed with symptom

User:

```text
harusnya 6 arena bisa bareng tapi cuma 2 yang jalan
```

Required interpretation:

```text
SYMPTOM_REPORT
- observed/claimed effective concurrency is lower than presented/requested amount

DESIGN_CLAIM
- six concurrent arenas are expected by the user

Priority domains
- arena-multi-arena
- boundary-capacity
- chunk-simulation

Do not classify DESIGN_MISMATCH from the user claim alone.
Ground six-arena presentation/authored intent from the selected artifact first.
```

## Case 7 — Ambiguous wording

User:

```text
pas reset suka balik aneh
```

Required interpretation:

```text
SYMPTOM_REPORT
- post-reset state differs from expected player baseline

Possible bounded interpretations
- inventory reset
- position/teleport reset
- scoreboard/state reset
- arena cleanup
- persistence/recovery

Record ambiguity instead of choosing one root cause prematurely.
```

## Case 8 — False-positive resistance

User:

```text
ini pasti bug karena ada 2 writer
```

Required interpretation:

```text
SUSPICION
- competing writers may exist

EXPECTATION_CLAIM
- user believes multiple writers imply a defect

Search
- ownership
- mutual exclusion
- generation
- ordering
- idempotency

Multiple writers alone are not a gameplay issue.
Normal mutually-exclusive or idempotent writers must resolve as normal/not-applicable.
```

## Case 9 — Target hint conflicts with selected artifact

User:

```text
cek Defense V2, yang versi terbaru
```

Selected artifact:

```text
Defense V1.mcworld
```

Required interpretation:

```text
TARGET_HINT
- Defense V2 / latest

blockingAmbiguities
- user target hint conflicts with selected Defense V1 artifact
```

Do not:
- silently rename V1 as V2;
- use V2 expectations against V1;
- continue production audit until the exact target is resolved.

## Acceptance invariants

For every case:

1. preserve the reported symptom;
2. separate symptom from guessed cause;
3. expand only to bounded relevant mechanisms;
4. retain ambiguity where evidence has not decided;
5. never create Expected/Actual or issue type from user wording alone;
6. user focus raises priority but does not reduce canonical audit completeness;
7. unexplained material user symptoms remain visible as Audit Obligations;
8. only selected-artifact causal proof can promote to BUG / DESIGN_MISMATCH.
