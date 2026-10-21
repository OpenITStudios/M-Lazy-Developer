---
id: document.analysis.developer-practice-context
class: DOCUMENT
domain: analysis
role: DOMAIN
authority: REFERENCE
lifecycle: ACTIVE
---

# Developer-Practice Knowledge for Gameplay Interpretation

**Reference, not map authority.** This is the one routed interpretation surface
for evolving map-developer experience from the user-supplied
`minecraft-bedrock-agent-skills-main.zip`. It supplements **investigation**
during UNDERSTAND without creating a gameplay contract, runtime fact, defect
finding, installed agent skill, or new analyzer.

**Machine-readable candidate data:** [Developer practice signals](../../experiments/developer-practice-signals.json)
(`experiments/developer-practice-signals.json`).
**Original source inventory/provenance:** [ZIP reference](../examples/bedrock-developer-agent-skills-reference.md).
Stable document identity is this frontmatter `id`; update in place.

## 21 October 2026: two-archive selective intake

The user supplied `minecraft-bedrock-agent-skills-main (1).zip` (v0.24.0,
22 active skill files) and `skills-probe-main.zip` (test project with
an **older v0.23.0** skills lock). Their original uploaded ZIP SHA-256
identities, all 22 current `SKILL.md` digests, skill classifications,
and three scoped probe-result references now live in the existing
[`developer-practice-signals.json`](../../experiments/developer-practice-signals.json).
The source inventory/triage is documented in the existing
[skills reference](../examples/bedrock-developer-agent-skills-reference.md).
There are **16 source-reviewed reference hints**: the previous 13 stable
IDs plus bounded scene camera, JSON-versus-script state ownership and
idempotent recurring work questions. Six team/project workflow skills
cannot be selected as map-audit evidence.

**Probe facts are upstream reports, not reproduced gameplay proof.**
T20 reports an Education 26.32 camera scene PASS with defined scene
conditions; P49 reports FAIL for its custom particle-glyph labeling
layout/cutoff; P50's custom glyph display remains untested natively.
The older pending/research queue from the original 16-skill archive is
superseded as *current intake*, not silently treated as confirmed false.
Latest authoring guidance may suggest targeted investigation, but cannot
override source-authored game design, independently verified API/version
knowledge, or stronger observed selected-map evidence.

The existing `compileDeveloperPracticeReferenceContext()` is already
the consumption point. New records use the **same** bounded exact
Semantic IR witness and max-two selection, not a new retriever.
For scene cameras, `teleport` is only a candidate to inspect the actual
camera call and chunk ownership; for data storage, dynamic property
read/write is only a candidate to inspect state ownership; and for
idempotence, `system.runInterval` is only a reason to trace an
effect/guard. None establishes visual failure, data corruption, or lag
without selected-source and appropriate runtime evidence.

## Why this is separate from the other knowledge owners

- **Source ZIP**: developer statements, example code, prior project surveys,
  historical variants, pending research and feedback. It can change.
- **This REFERENCE**: normalized, narrowly scoped interpretation
  *questions*, expected source cues and counterexamples. Each record keeps
  the ZIP source path, stable record ID and status.
- **Platform Knowledge** `engine/knowledge/`: verified, edition/version-
  applicable Minecraft facts, NOT developer preferences. No automatic
  promotion of these records.
- **Game Design** `engine/design/`, `game-design-spec/`: map-/mode-scoped
  authored or approved intent, NOT generated from a general developer skill.
- **Selected artifact evidence**: the only authority for the game currently
  audited. Gameplay Intent and Scenario Graph must follow actual source
  and player-facing cues, and preserve UNKNOWN where purpose is unresolved.

The machine JSON is an explicitly linked **data companion** to this routed
reference document, not a second knowledge system, independent Source Catalog,
new Resource Catalog class, or a source of platform truth. The existing
repository Resource Catalog indexes this Markdown document; its H2/H3 sections
are navigable with the existing section-level retrieval.

## Intake on every new developer ZIP (review before publication)

1. **Acquire safely.** Treat archive entries as untrusted data. Inventory
   relative filenames, reject unsafe/absolute/traversal paths, cap pathological
   size/entry expansion, do not run `SKILL.md`, installers, checkers, or
   code samples. Record archive SHA-256 and exact file counts.
2. **Compare snapshots.** The JSON `sourceSnapshot.archiveSha256` signals
   whether the archive changed. Compare `sourceFiles[].sha256` for all
   **currently declared active SKILL.md** (22 in the 2026-10-21 ZIP), and
   `deferredSources[].sha256` only for files present in that same snapshot. Added, removed
   or changed files are reviewed separately; change outside these 36 tracked
   files still requires inspecting the new archive's full inventory before
   calling an update complete. Untracked referenced examples/scripts can
   change independently of `SKILL.md` and must NOT be assumed stable.
3. **Normalize into existing IDs.** Update `patterns[].id` in place when
   the meaning is the same; preserve original source path, source-file SHA,
   exact heading, question, candidate relations, applicability and negative
   control. New meaning gets a new stable ID. Never fork `v2`/`final`
   registries or merge similar phrases across different claims blindly.
4. **Adjudicate provenance.** Distinguish active developer-authored skills
   from `research/`, `pending/`, feedback and old agent-authored surveys.
   Historic project surveys support hypothesis generation only, not
   developer-approved specifications. Conflicting facts remain separate
   until scope and edition/version are resolved.
5. **Invalidate conservatively.** Source changed + no review means its
   dependent patterns must move back to `PROVISIONAL`, not continue with
   `SOURCE_REVIEWED` based on an old digest. A source file disappearing
   does not imply a negative gameplay assertion; retain superseded meaning
   in Git history. New pending/research material stays NOT_ELIGIBLE until
   individually reviewed. Publish updated ZIP/source fingerprints together
   with the affected reviewed records; do not silently preserve old claims.
6. **Do not copy the raw archive** into the GitHub source without origin,
   permission, license and security checks. Git history preserves prior
   normalized records and their update decisions; keep the original ZIP with
   the user for future source-level comparison.

## Usage in the existing selected-map audit flow

No new audit stage or engine authority is introduced.

| Existing stage | Appropriate use | Forbidden shortcut |
|---|---|---|
| TARGET | Identify edition, version, map/mode/arena scope from selected artifact | Adopt versions or preferences from ZIP |
| DISCOVERY | Parse selected source and collect exact call/command/effect IDs | Treat a reference pattern as proof a mechanic exists |
| UNDERSTAND | **Only if source evidence raises a relevant semantic question**, retrieve up to a few matching records and formulate alternative explanations | Fill missing objectives, phase order, win/loss or recovery from the ZIP |
| FORMALIZE | Trace the candidate relation against IR, state owner, lifecycle, actual code and design signals | Turn a matched API name or broad trace into causal ownership |
| EVALUATE / PROVE | Use negative controls to challenge false assumptions; require the usual selected-map contract and proof for any bug | Promote a team's engineering preference into BUG or DESIGN_MISMATCH |
| REPORT | Attribute the exact ZIP-origin hint if useful for unresolved investigation, and distinguish it from current-map evidence | Count advisory reference citations as verified code or runtime proof |

A short **conditional** retrieval pattern:
```text
selected-map source evidence
  → precise question (e.g. UI callback + phase change)
  → docs/analysis/developer-practice-context.md
  → matched developer-practice-signals.json record ID
  → source origin / confidence / edition version / negative control
  → independent selected-map source/Design check
  → optional investigation hint, or UNKNOWN
```

A bounded operator decision should select **at most two** relevant patterns
only when the selected-artifact evidence raises a specific question.
`sourceSignals[]` are *search cues*, not exact source observations: symbol
matches, filenames and similar words cannot by themselves establish an
execution path, state owner, mechanic or design contract. Each selected
record must preserve `id`, `sourceId`, `status`, archive SHA,
`question`, `negativeControl`, `versionApplicability` and
`prohibits`. The operator must explicitly compare it against the
selected map's source evidence and possible counterexamples.

The ordinary source audit works as before when this reference is missing,
provisional, workflow-only, unrelated or inapplicable. The JSON never
auto-authors gameplay edges, closures, defect findings or player rules.
A context compiler may pass selected reference text only with
`authority=REFERENCE` and original record/source ID. No silent retrieval
injection or ungrounded positive classification.

## Available semantic cues and intentionally excluded material

The JSON inventories **all 22 active skill documents**. **16**
are individually normalized as **16 source-reviewed, noncanonical hints**:
forms, entity lifecycle, state storage, game time, teleport, coordinates,
version targeting, debug logging, **entity damage policy**, **HUD lifecycle**,
**sound feedback**, **localized text/glyph**, and **performance instrumentation**.
Some are team-preference hints, not platform/genre-neutral best practices.

The six workflow/project-scoped skills (`bedrock-agent-team`, `bedrock-game-results`,
`bedrock-git-workflow`, `bedrock-project-setup`, `bedrock-release-export`,
`bedrock-testing-policy`) are explicitly `DEVELOPMENT_WORKFLOW_ONLY`. Their fingerprints are tracked for incremental
updates but they **must not** participate in map-design reference selection.

| Observed selected-map question | One candidate reference | Counter-reading always kept |
|---|---|---|
| Entity JSON damage policy versus team/arena-controlled damage | `developer.hint.entity.damage-owner` | Static JSON behavior may be intentional and complete |
| HUD/action bar during session or phase transition | `developer.hint.hud.message-owner` | Command-driven or multiple scoped HUD owners may be valid |
| Sound on round start, win or reset | `developer.hint.sound.feedback-vs-outcome` | A sound call neither proves success nor audible delivery |
| Translation key or name tag appears to describe a task | `developer.hint.text.localization-vs-design` | Display text is not an independently approved outcome contract |
| Repeated entity queries or tick scheduling | `developer.hint.profiler.source-hotspots` | Static hot spots do not prove measured lag |

Every hint has an original source, `negativeControl`, `prohibits`, and
explicit version uncertainty. The goal is **fewer fabricated conclusions**,
not more graph nodes. `deferredSources` tracks pending/research material
without admitting it as live semantic hints; old source archive surveys,
reference code and untracked ZIP content still require targeted review.
A future ZIP is expected to evolve.

## Bounded source-evidence selection and proof record

The existing `workflow/resource-context.ts` owns
`compileDeveloperPracticeReferenceContext()`; `workflow/context-compiler.ts`
accepts it as an **explicit optional** `ContextCompilerRequest.developerPractice`
input. No new retrieval graph or stored gameplay authority is introduced.
The request must include:

- already-loaded current-version `developer-practice-signals.json`;
- selected-map artifact ID from canonical `GameplayIntentModel.artifactId`;
- the existing `SemanticIr` from the same selected inspection; not
  manually supplied signal names, filenames or generated map-design guesses;
- the operator's precise question domain(s), e.g. `state` +
  `persistence`, `spatial`, or `scheduler`.

The selector derives `SelectedArtifactReferenceSignal` from exact
Semantic IR state-operation, world-effect and scheduler-edge IDs carrying
the same selected artifact ID and a non-empty source path. Supported
source cues are deliberately limited to typed/normalized observations:
`getDynamicProperty`, `setDynamicProperty`, `scoreboard`,
`teleport`, `playSound`, `system.runTimeout` and `system.runInterval`.
A `playSound` cue is emitted ONLY from a canonical Semantic IR
`audio-feedback` effect authored at a typed `Player` or `Dimension`
Script API call. It retains the exact script site and an authored
sound-argument expression (not a resolved asset or proof anyone heard it).
The world-effect representation preserves candidate source guards and
localization in the existing scenario/effect reasoning; this is not
evidence of a successful effect or intended gameplay terminal.
`teleport` means a source-observed attempted effect, **not**
necessarily `Player.teleport` or completed arrival. Equal scoreboard
labels do not establish actor ownership or gameplay scoring.

Other cues such as `ActionFormData`, `onScreenDisplay.setActionBar`
and arbitrary minified aliases are **NOT** promoted from raw text: the
existing Semantic IR does not currently expose them as exact typed
observations. The mere occurrence of a method named `playSound` is
also insufficient when parser receiver inference is unresolved.

**Cross-source motivation (HISTORICAL, not a semantic score):**
[developer-practice audio AST evidence](../../engine/reliability/history/audit-runs/learning/developer-practice-audio-source-2026-10-13.json)
records 13 literal method-name occurrences across four distinct selected
archives. Its AST census does not establish Minecraft receiver types or
audible feedback; the canonical typed parser/IR bridge alone admits each
`audio-feedback` site into the optional reference selector. The operator may still inspect such source directly and
document it separately, but no automatic developer-reference selection
is claimed for it.

This helper filters to SOURCE_REVIEWED/CORROBORATED, interpretation-eligible
source files with SHA-256 provenance, exact signal+domain matches, and a
default maximum of **two** reference patterns. It returns `REFERENCE`
context with the original question, sample relation hypotheses,
`negativeControl`, `prohibits`, matching selected-evidence IDs,
source-file SHA, and source-archive SHA. A mismatch, absent typed IR source proof, workflow-only source or unknown
source alias results in abstention.
Selecting a hint **cannot** change Game Design closure or issue disposition.
This opt-in context exists as source code; it does not run automatically
from `runSelectedMapAudit()`. Repository TypeScript execution, full
ContextCompiler pipeline acceptance and automatic source/ZIP hydration
have not been demonstrated.

**Real-source calibration example (HISTORICAL only):**
[developer-practice UI context source inspection](../../engine/reliability/history/audit-runs/learning/developer-practice-ui-context-2026-10-13.json).
The source analysis compared Beach Bedwars v1.0.4 (bundled/minified) with
Build & Decode v1.1.1 (modular), pinned by actual .mcworld SHA-256.
In Build & Decode, a form UI method returns a leave selection without a
local session check, **but the caller checks game token, current membership,
teleport revision and player identity after awaiting the response**.
A simplistic developer-reference rule would invent a defect. The selected
form reference instead asks to follow the real call chain, so no BUG is
inferred. In Beach Bedwars the runtime form class is minified; the helper
does not pretend that an unknown class alias is `ActionFormData`. A separate
explicit action-bar API site can select the HUD presentation reference,
but it does not prove feedback delivery. These examples are historical
**source-only** calibration, never prewritten conclusions for future maps.

## Bounded Script API receiver handoff from playerSpawn

The canonical receiver extractor now also recognizes a narrow,
**source-grounded** `PlayerSpawnAfterEvent.player` path. A
`world.afterEvents.playerSpawn.subscribe(event => ...)` callback may
provide a Player receiver for direct calls or for a same-file local helper
only when the `@minecraft/server` world import is exact, the event binding
is stable and the helper has one unambiguous direct caller, an unexported
declaration and an unmodified forwarded parameter. Any shadow, additional
caller, external alias or reassignment retains UNKNOWN. `playerJoin`
is deliberately not equivalent to `playerSpawn`.

The source/validation owner is
[Script API Static Analysis](./script-api.md), not this REFERENCE.
The historical [BlitzBuild event-to-helper source checkpoint](../../engine/reliability/history/audit-runs/learning/receiver-inference-player-spawn-forward-2026-10-13.json)
documents an independently inspected `event.player → welcome(player)`
candidate with two authored sound sites. It is NOT current-map Game Design
authority, not proof of running a repository TypeScript parser and not
Minecraft player audio observation. The developer sound pattern remains a
question/counterexample to test after typed IR extraction, never a win/loss
rule or developer-style mandate.

## Reference intake after typed receiver improvements

Reference-selection coverage should be measured against the canonical
`ScriptMethodCall` and selected-artifact Semantic IR source IDs,
not the raw count of functions named `playSound`. The
[13-site receiver boundary](../../engine/reliability/history/audit-runs/learning/typed-audio-receiver-boundary-2026-10-13.json)
is a HISTORICAL, independently inspected AST source census: it
contains **5 Player-shaped, 2 Dimension-shaped and 6 unresolved**
audio call sites across four source styles. Those classifications
remain candidate source interpretations until the actual repository
parser is executed. Unresolved class/service/method aliases must
abstain even when a developer reference makes them seem familiar.

The canonical Script API owner also recognizes the documented
`Block.dimension` and `Entity/Player.dimension` property
**only when the object's existing receiver type is already known**.
This supports tracing a source `Dimension.playSound` without
assuming that arbitrary `.dimension` properties represent
Minecraft API objects. A developer audio hint still cannot prove a
game terminal, delivered sound, intended player experience, or defect.

## Developer source implementation trace

The supplied developer skills archive includes implementation modules, not only written advice.
During a selected map bug audit, treat modules as examples of how a mechanic can be implemented;
identify whether the selected map actually uses the exact module and follow its real callers.
Compare the selected archive's file hash with the upstream module before claiming equivalence.

A form continuation can check its current session after an awaited user response;
entity removal for cleanup can differ from gameplay death; a teleport may be cancelled
when its original round ends. These are candidate explanations, not universal rules.
Expected behavior must still come from the selected map's authored design and source.
For a defect, cite the selected-map trigger, state owner, effect, outcome and counterexample;
when missing, record UNKNOWN rather than copying a developer preference.

## Source-grounded audit task integration

The developer v0.24.0 ZIP contains TypeScript implementation modules.
Ten existing reference patterns now link their relevant original
`modules/*/*.ts` file SHA-256 digests and exported entrypoints.
These links document upstream implementation provenance; they do not
claim that an audited map imports those exact files. An exact file match
requires comparing actual selected-map bytes, not function names or
similar style.

The existing production `runSelectedMapAudit()` accepts an optional
`developerPractice` reference payload. The normal CLI exposes an explicit
`--developer-practice` opt-in that loads the curated JSON, not the ZIP.
Selected-map model task packets now receive up to two matching hints
**only** when the task has source-backed Intent subjects and locators,
typed Semantic IR from the selected map at the same file, and a relevant
question domain. Each hint retains its own question, negative control,
prohibited inference, and optional code reference. The default audit
behavior remains unchanged without opt-in.

Source locators are matched exactly to the IR file or at its `:line`,
`#anchor`, or `@site` boundary. Unrecognized source locator formats
abstain; no fallback to lexical matches is allowed. A later audit
resolution may retain the hint only when question and selected-source
witnesses remain identical. This is model task guidance, **never** a
new expected-behavior policy, a defect-finding detector, automatic
source hydration, or Minecraft runtime verification.

For map bug finding, compare the selected code's actual call chain
against the developer example **only after** checking whether the same
module is present. The relevant source chain still determines what
that map does; a designer-approved expected behavior determines whether
it is wrong. An intentional alternative to the developer's programming
style is not a bug.

## Maturity and promotion

The JSON records start at `SOURCE_REVIEWED`: the source claim was inspected,
not externally verified and not validated on an arbitrary real map.
`CORROBORATED` means bounded, independently reviewed applicability only;
even such a record remains `REFERENCE`, not an approved map-specific rule.
`SUPERSEDED` applies after a reviewed replacement. These are *reference
review labels*, not A2/A7 proof or issue statuses.

Promote only a truly independent Minecraft platform fact into its existing
canonical domain with edition/Script API provenance and a real consumer.
Promote a map-specific expected behavior only with approved map-/mode-
scoped intent or sufficient authored evidence from the selected version;
never because this ZIP says the pattern is preferred.

## Acceptance / evidence ceiling

This curated snapshot makes **all 22 active skills discoverable and
fingerprinted**, **16 interpretation records searchable** and a conservative
subset conditionally selectable from existing typed Semantic IR through
the opt-in Context Compiler contract. The former **20 pending/research/feedback**
source records belonged to a prior ZIP; they are no longer current `deferredSources`
and remain traceable in Git history. The other ZIP
contents (code examples, assets, checkers, archive/history) remain in the
external original source and are not claimed fully ingested.

This is **not automatic ZIP ingest** and does not execute a repository
TypeScript retrieval consumer or any selected-map audit. At the next
updated ZIP, compare digests and affected stable record IDs. Automatic
interpretation-rule injection is intentionally not implemented; a full
selected-world pipeline acceptance remains an independent requirement.
