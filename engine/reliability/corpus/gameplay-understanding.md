# Gameplay Understanding Calibration Corpus

Historical corpus table baseline: `2aaf14bf81856c995cdcaed9b8af330ec7c4065c`

Latest targeted semantic verification: `6e982f7e9bed9ff057bfd21c57dd94a4d5ecfe79`

The supplied representative worlds are now treated as an external calibration corpus for gameplay understanding.

No production world binary is committed to the repository.

## Why this corpus exists

The corpus tests whether one parser-independent understanding pipeline can recover meaning from different authoring styles:

```text
explicit source
→ modular compiled source
→ bundled/minified source
→ spatially authored route data
→ runtime evidence
```

The corpus is not a map-name rule database.

A map may teach the engine that a semantic pattern exists, but the engine must rediscover that pattern from evidence in every artifact.

## Cases

| Case | Source shape | Primary learning dimensions |
| --- | --- | --- |
| Marathon Test of Tactics L2 | explicit source | state machine, session lifecycle, reconnect recovery, ownership, resource lifecycle |
| Builder's Memory / BlitzBuild | modular compiled | build policy, reconnect, membership, scoring, plot semantics, water interaction |
| The Circuit | modular compiled | multi-mode gameplay, trial state machines, arena sessions, shop/loadout, capture/fortify/last-stand |
| Fall of the Pillager L1 | bundled/minified | class-member recovery, revive/knockdown, shop/upgrade, inventory/kit, reconnect, waves |
| Beach Bedwars | bundled/minified | team lifecycle, bed objective, economy, combat session, protocol-vs-gameplay state |
| Five Nights at Z Village L1 | bundled/minified | route topology, path-index ambiguity, arena transforms, entity navigation, runtime route evidence |
| Orb of the Illusioner L1 | bundled/minified | party state, hologram status, puzzle/stage flow, waves, player session lifecycle |
| Five Nights Defense L2 | bundled/minified | multi-arena defense, shop/upgrade, revive, route/spawn, score/economy, reset |

## Source-grounded cross-game locale calibration — 2026-10-23

These are **direct archive/source inspections**, not executed TypeScript audits,
Minecraft observations, frozen expectation edits, or semantic accuracy scores.
Each sample is an immutable selected map analyzed **separately**. The examples
demonstrate one generalized false-interpretation family: a language-pack
message must be retained as a player-facing source cue, never promoted to
an objective or winning rule solely by lexical keywords.

| Selected artifact / SHA-256 | Exact authored source | Semantic distinction |
| --- | --- | --- |
| BlitzBuild v1.0.2 / `d3a7082af1c2e5f8ded862f801eaa3880f02beb323280648a243d31e574e5504` | `resource_packs/blitzbuild_rp/texts/en_US.lang#L5`, `welcome.guide=...Memorize the build, rebuild...` | Player instructions are useful evidence even without a recognized mechanic name; they are not by themselves proof the builder/scoring loop functions |
| Beach Bedwars v1.1.0 / `97b4b143d674b37763501c82d63ba2f7ba0602d44e71f30cde6e5a23a08979c8` | `resource_packs/Beach_Bedwars_RP/texts/en_US.lang#L47`, `daigon.ui.winner.red=...RED WINS`; `#L52`, `...GREEN WINS` | Result announcements are displayed-text candidates, **not** independent winning-condition definitions or gameplay objective nodes |
| Daigon Composite v1.1.17 / `aab3f0b8de9d1d35274b8eae6cfb84aa8cc2b743454c891e78fbb47c6f1515c4` | `behavior_packs/BP/texts/en_US.lang#L24–L25`, flag instruction and podium/party ready/countdown text | One instruction may span multiple gameplay systems. Keep exact wording and current-map source; do not invent a proven Party → Session → Victory chain from the sentence |

The generic correction belongs to `inspection/gameplay-intent-resource-text.ts`
and the existing canonical Gameplay Intent evidence/handoff consumers: retain
the actual selected-artifact `.lang` wording with `playerFacingText`,
without keyword-classifying generic locale lines as `objective`,
`mechanic`, `phase` or other player-journey graph nodes. Explicit
stage/task localization structures continue as **source-content navigation**.
Pack/entity/item metadata and private-use glyph-only values do not become
gameplay text cues. The canonical Scenario Graph semantic coverage excludes
evidence-only copy from the requirement to have a mechanic owner. Existing
PROVE, counterproof, BUG/DESIGN_MISMATCH admission and runtime boundaries
remain unchanged.

For acceptance, demand an actual same-HEAD programmatic audit on these
distinct originals, source-scoped comparison to independent reviewed claims,
and separation of true source facts from intended design. Do not score the
historical eight-map inventory as semantic recall on the newer engine.

## Exact script-to-locale source references — 2026-10-23

An **isolated TypeScript AST traversal** of the real archived JavaScript
identified literal `{ translate: "key" }` properties; it did **not** run the
M-Lazy-Developer TypeScript pipeline, a Minecraft world, or a complete
understanding audit. The artifact SHA-256 fingerprints are the same pinned
ones listed above.

| Selected archive | Exact script source use | Interpretable source fact |
| --- | --- | --- |
| BlitzBuild v1.0.2 | `behavior_packs/blitzbuild_bp/scripts/runtime/globalPolicies.js:53:53`, `translate: "welcome.guide"` | One literal reference to the authored welcome instruction, inside a source `player.sendMessage` expression. Does not prove the call ran or was seen by the player |
| Beach Bedwars v1.1.0 | No direct literal `translate: "daigon.ui.winner.red"` property found in available script source | `resource_packs/Beach_Bedwars_RP/texts/en_US.lang#L47` is literal winner-status copy. Its use may be dynamic/indirect; **NOT FOUND is not UNUSED**, and copy does not define a winning condition |
| Composite v1.1.17 | `behavior_packs/BP/scripts/chunks/chunk-7WKHHBF4.js:2343:41`, `translate: "daigon.welcome.line2"` | One source key reference; the same localized key is defined in BOTH behavior-pack and resource-pack `en_US.lang` files. Rendered translation selection, party reachability, readiness, countdown and runtime delivery are not proven |

This evidence supports an exact **translation key reference** in the existing
Script Parser and a typed, evidence-only join in Gameplay Intent. It does not
authorize a new source graph, lexical UI-to-objective matching, or a
gameplay-defect verdict. Literal references outside a recognized locale key,
computed translation keys, and source aliases remain unproven/unknown. The
parser revision must be updated when adding this evidence so cached results
from an earlier parser are not mistaken for complete coverage.

## Composite welcome-to-party separation — source reconstruction, 2026-10-23

Selected immutable archive: Daigon Composite v1.1.17, SHA-256
`aab3f0b8de9d1d35274b8eae6cfb84aa8cc2b743454c891e78fbb47c6f1515c4`.

The player-facing copy `daigon.welcome.line2` promises a podium/party
ready/countdown experience; it is **NOT a causal source edge** into the
ready/countdown services. Direct read-only archive inspection found:

- `behavior_packs/BP/scripts/chunks/chunk-7WKHHBF4.js:2317–2328`:
  WelcomeService registers an initial-spawn event, checks initialSpawn and
  an existing locked party, then schedules its welcome message helper.
- Same script `:2339–2351`: `_sendWelcomeMessage` builds literal
  translation objects and schedules `player.sendMessage(line)` calls.
- `behavior_packs/BP/scripts/chunks/chunk-Q6BZV7BR.js:1491–1516`:
  PartyService handles `party:ready`, mutates member readiness and checks
  whether party members are all ready.
- `behavior_packs/BP/scripts/chunks/chunk-7YEVMDUW.js:17229–17241`:
  GameManager.resumeCountdown checks a stored `countdown` session state
  and can restart a countdown ticker.

**Why this matters for unknown game understanding:** locating a sentence,
an event listener, a state mutation and a countdown function in one world is
not proof of an authored connected ready → countdown causal route. Existing
Semantic IR region IDs, incoming/outgoing source edges and direct same-region
operations are usable *investigation context*, provided the operator sees
their proof boundaries. The source `translate` property itself cannot
authorize callback execution, branching outcome, player-facing delivery,
party membership, stage chronology or a BUG verdict. No actual whole-map
`runSelectedMapAudit()` or live Minecraft session was run for this claim.

## Exact script-memory state writes versus computed party readiness — 2026-10-23

Direct, isolated AST inspection of the **same pinned** Daigon Composite
v1.1.17 original shows three distinct JavaScript assignment sites in
`behavior_packs/BP/scripts/chunks/chunk-7YEVMDUW.js`:

- line **17607**: `session.status = "countdown"`
- line **25610**: `session.status = "countdown"`
- line **29851**: `session.status = "countdown"` (composite lobby countdown)

`behavior_packs/BP/scripts/chunks/chunk-Q6BZV7BR.js:1498`
has `member.ready = !member.ready` in PartyService.handleReady, and
`:1499` calls saveParty, which emits a PartyChanged application event in
`:1371`. The composite runtime subscribes to PartyChanged at
`chunk-7YEVMDUW.js:29708–29710`, calls the party-to-arena admission
checks at `:29764–29793`, and calls `startCompositeLobbyCountdown`
via `:29805–29845`.

**Critical semantic boundary:** Equal code expressions like
`session.status` do NOT establish runtime session identity or equal
arena ownership. A computed ready flag is NOT the same source fact as a
literal status assignment. The source event-bus and method chain are
candidate relations; live event subscription, callback invocation,
control-flow guard satisfaction, and observed countdown are
**NOT EXECUTED / UNKNOWN**.

The existing canonical Semantic IR already retains exact
`script-memory` literal state-write operations and the existing
SourceEffectSlice backward, resolved-edge `candidateIngress` paths.
Their absence from the *ChatGPT-readable model handoff* was a navigation
blind spot rather than a need for another parser, state graph, classifier,
or map-specific rule. The read-only handoff should group equal literal
target/value pairs for display **while retaining each distinct operation**
and validate every incoming path by the exact directed IR edge IDs and
region adjacency. Invalid or truncated source candidates must not be
promoted to execution, gameplay order or defect proof. This observation
has not been scored against a current-HEAD full `runSelectedMapAudit()`.

## Generic boolean state-source recovery — read-only samples, 2026-10-24

This work corrects a *general authoring-shape blind spot*, not a bug in
any production target map. The canonical JS parser formerly recorded
`member.ready = !member.ready` as a loose property mutation, but
`ScriptStateMutation` and Semantic IR's `script-memory` write projection
were focused on source names such as `state/status/phase/stage/mode`.
Consequently `member.ready` could lack an exact IR operation even while
the following `saveParty()` call and an internal-event bus handoff were
separately represented. This made the party-ready source path incomplete
in the model handoff.

Direct, isolated TypeScript AST inspection of the pinned originals:

- **Composite v1.1.17**, `chunk-Q6BZV7BR.js`: exact
  `member.ready = !member.ready` at **1498**,
  `member.ready = false` at **1532**, `member.ready = true` at **2157**,
  and `member.ready = false` at **2167**. All four are inside unique
  authored class methods. The following `this.saveParty()` at **1499**
  belongs to the same `handleReady` method as the source toggle.
- **Beach Bedwars v1.1.0**, minified `main.js:175`: exact
  `n.ready = !1` in method `step`. This is literal false encoded as
  JavaScript `!1`. Nearby `t.ready = !!n && this.loading.sweep(...)`
  is *computed*, not an exact boolean literal or self-negation of the
  same property, and MUST NOT be guessed as one.
- **Composite v1.1.17**, `chunk-7YEVMDUW.js`: distinct
  `session.status = "countdown"` writes at **17607**, **25610**,
  **29851** remain separate from the computed party `member.ready` toggle.

Generic correction: the **existing** JS authored-property mutation
evidence adds a narrowly scoped syntax tag only for `true`, `false`,
minified scalar `!0` / `!1`, or exact `x.flag = !x.flag`.
Semantic IR stores each as a separately source-site-qualified
`script-memory` state-write attempt, with no runtime receiver identity,
party/arena ownership, confirmed readiness, same-instance merging or
proved player progress. A read-only model handoff exposes bounded
backward root candidates and exact later call sites, but does not
convert co-location into event delivery, session transition, or BUG proof.

Additionally, the existing `SourceEffectSlice` temporal metadata now
retains the already-resolved `internal-event-dispatch` edge as an
**event boundary**. This is not the same as an unconditional synchronous
call; source-time registration and runtime event delivery are still
unverified. Both positive directed chains and deliberately mismatched
source edges remain distinguished in the canonical read-only projection.

The source facts above were observed directly on original bytes, NOT
produced by executing the latest repository TypeScript, Vitest,
`runSelectedMapAudit()` or Minecraft multiplayer. Treat scores as
UNKNOWN until one actual same-HEAD audit with independent review.

## Baseline proof limit (do not convert counts to comprehension)

The numbers below belong to the **historical source revision explicitly cited above**, not automatically to current `Local`. In particular, **0 recorded unknown intent across eight maps does not imply that all game mechanics, player objectives or temporal relationships were understood**. Unknowns are affected by what the old model could recognize and whether gaps were tracked. Node/invariant counts, source-style labels and the number of inferred nodes are inventory statistics; they are neither semantic precision/recall nor a player-reachability result.

Use the frozen, independently reviewed scoped claims—not total nodes—as the ground truth for assessing a new engine revision. If an improvement decreases incidental inferred nodes while preserving actual mechanic relations, this may be positive. Conversely, more nodes or more declared bindings may worsen confidence without increasing understanding. When no canonical real-map audit output or independently validated expectation is available, mark the case NOT_EXECUTED/UNSCORABLE and do not report whole-map PASS.

## Observed baseline

The following values are observations from one engine revision. They are not pass/fail thresholds.

| Case | Intent nodes | Authored | Inferred | Unknown | Invariants | State | Lifecycle | Mechanic | Resource | Policy | Outcome | Spatial | Route profiles / points |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Beach Bedwars | 82 | 13 | 69 | 0 | 0 | 11 | 34 | 4 | 9 | 4 | 0 | 8 | 0 / 0 |
| BlitzBuild | 113 | 45 | 68 | 0 | 22 | 21 | 17 | 11 | 13 | 15 | 10 | 14 | 0 / 0 |
| The Circuit | 284 | 36 | 248 | 0 | 1 | 33 | 38 | 48 | 74 | 4 | 1 | 51 | 0 / 0 |
| Defense L2 | 106 | 15 | 91 | 0 | 4 | 4 | 12 | 17 | 35 | 4 | 4 | 21 | 0 / 0 |
| Five Nights L1 | 179 | 14 | 165 | 0 | 4 | 3 | 30 | 33 | 61 | 5 | 4 | 32 | 3 / 67 |
| Marathon Test of Tactics L2 | 85 | 22 | 63 | 0 | 14 | 10 | 27 | 1 | 8 | 8 | 4 | 18 | 0 / 0 |
| Orb of the Illusioner L1 | 185 | 31 | 154 | 0 | 9 | 10 | 25 | 43 | 61 | 10 | 9 | 18 | 0 / 0 |
| Fall of the Pillager L1 | 111 | 5 | 106 | 0 | 0 | 6 | 19 | 24 | 44 | 1 | 0 | 8 | 0 / 0 |

Corpus aggregate at this revision:

```text
cases                 8
intent nodes          1145
authored nodes        181
inferred nodes        964
unknown intent        0
maps with unknowns    0
route profile cases   1
authored route points 67
```

All eight cases expose lifecycle, mechanic, resource, policy, spatial-region, and state concepts. Seven expose an explicit phase concept; Orb intentionally no longer counts countdown/finish helper actions as phases.

Six of eight expose authored/inferred outcome concepts.

## How to use the corpus

Materialize the sample worlds into one local directory. The filenames are described by:

```text
fixtures/calibration/gameplay-understanding-samples.json
```

Then run:

```text
npm run cli -- corpus-calibrate \
  fixtures/calibration/gameplay-understanding-samples.json \
  <artifact-root>
```

The command returns:

- a normalized gameplay-understanding fingerprint per artifact;
- source-shape coverage;
- learning-dimension coverage;
- authored/inferred/unknown distribution;
- intent-kind coverage;
- policy/outcome coverage;
- spatial route richness.

## Latest targeted semantic verification

At `6e982f7e9bed9ff057bfd21c57dd94a4d5ecfe79`, the reviewed bundled subset was re-run through the production corpus-calibration path.

```text
cases                           3
cases with assertion failures  0
total assertion failures       0
unknown intent                  0
```

Reviewed case checks:

| Case | Reviewed properties | Result |
| --- | --- | --- |
| Beach Bedwars | phase ≤ 1; state ≥ 12; gameplay outcomes = 0; minified/unknown policy predicates ≥ 3; unknown intent = 0 | PASS |
| Five Nights L1 | phase = 0; state ≥ 5; route profiles ≥ 3; route points ≥ 67; derived route contracts ≥ 366; unknown intent = 0 | PASS |
| Orb L1 | phase = 0; state ≥ 10; outcomes ≥ 9; unknown intent = 0 | PASS |

Five Nights route-corridor derivation is gap-preserving: authored index gaps are not bridged into one large bounding corridor. The current artifact produces 366 narrow multi-arena segment contracts from 3 route profiles and 67 authored points.

Bedwars block-journal recovery branches remain authored, but guards whose runtime operands are minified one-letter roots fail closed as unknown predicates instead of being treated as runtime-bindable state paths.

The corpus CLI now returns a non-zero exit code when a reviewed semantic assertion fails. Ordinary fingerprint drift remains an investigation signal rather than an automatic semantic failure.

## Interpretation rules

Do not optimize for the largest node count.

A useful calibration review asks:

- Did a previously authored concept disappear?
- Did a new unknown intent blocker appear?
- Did a semantic kind disappear entirely?
- Did route profiles or authored route points disappear?
- Did a false semantic category get corrected?
- Did bundled/minified coverage improve without increasing protocol/helper noise?
- Did one fix improve one map while degrading another source style?

A fingerprint drift is an investigation signal. It is not automatically a regression.

## Current blind spots exposed by the corpus

The corpus also tells us where understanding is still weak.

- The Circuit still has two unresolved intent questions and is the broadest mixed-mode stress case.
- Pillager remains predominantly inferred because bundled/minified source loses stronger authored type/state evidence.
- Bedwars deliberately has no gameplay outcomes in the current model after protocol status was reclassified as state.
- Five Nights is currently the strongest spatial calibration case; other maps still need richer typed geometry extraction.
- Runtime semantics such as real navigation target, route reachability, chunk availability, scheduler behavior, and multi-client ordering still require runtime evidence.

These blind spots should drive generic architecture work, not map-specific patches.


## Reviewed semantic corrections

At reviewed baseline `6bec916ed904fd06f064a799731de4021432e12d`:

- Beach Bedwars gained generic role/team and bed-objective recovery without map-name rules.
- generator/forge semantics are modeled as mechanics even when resource material names are present.
- Orb lost previous phase-kind presence because those nodes were helper actions; this is an intentional semantic correction, not loss of authored phase evidence.
- The Circuit structural return variants are no longer misclassified as gameplay outcomes; corpus unknown intent is now 0.
- Five Nights L1 retains 3 route profiles and 67 authored route points; those profiles now derive 366 narrow multi-arena route-segment contracts without bridging authored index gaps.
- Phase-like bundled properties such as stage indexes/names and countdown/cinematic state surfaces are no longer promoted to false gameplay phases.
- Beach Bedwars minified block-journal recovery guards fail closed for runtime policy evaluation rather than exposing minified operand names as trusted state paths.


## Historical intent comparison

Artifact history is compared semantically, not only by archive fingerprint.

The current comparator reports stable/expanded/reduced/changed gameplay intent, node/edge/invariant additions and removals, status changes, and evidence-origin changes.

Verified Marathon example:

```text
v1.0.2 artifact fingerprint != v2.2.0 artifact fingerprint
gameplay intent = stable
artifactChangedIntentStable = true
```

History alone does not prove dead code or a defect; reachability and runtime evidence remain separate requirements.
