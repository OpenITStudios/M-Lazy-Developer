# Tooling

Repository-owned developer/build/verification control plane.

```text
tooling/
├─ repository/           repository structure, dependency, ownership and API verification
├─ windows-toolchain/    normal Windows developer routing behind DEV.cmd
├─ bug-report-documents/ report document rendering/build support
└─ bug-report-ui/        Vite/GitHub persistence support for the report UI
```

`DEV.cmd` is the sole root developer entrypoint.

Tooling may invoke canonical owners but must not duplicate Bedrock semantics. `ownership.json` records the canonical tooling partition.

## Test navigation

`tooling/repository/test-inventory.json` is the single registry of physical
source-test paths and source-pinned functional categories, features and execution
lanes. The existing `run-tests.mjs` consumes that inventory; there is no
second domain/test inventory or runner.

Implementation ownership follows `engine/<package-or-analyzer>/src/` and
matching `test/` families where present. **Functional area** describes covered
gameplay/engineering behavior across packages; **lane** describes test selection.
Neither is an alternate implementation owner. See the
[Orchestrator test layout](../engine/packages/orchestrator/README.md#test-layout-and-functional-domains)
for an example.

Each test has one evidence-reviewed **primary** `functionalArea`/`featureId`.
Optional `mechanicTags` identify secondary topics without promoting them into
another primary owner. `--list-areas` includes every declared area, including
areas with zero primary test files; `--show-area <area>` distinguishes a
declared-but-empty area from a misspelled/unknown area. Look up secondary cases
via `--list-mechanics` and `--show-mechanic <tag>`. Do not fill an empty
area by reclassifying unrelated suites or by adding placeholder tests.
Similar fixtures used at analyzer and Orchestrator layers can cover distinct
producer and consumer contracts; overlap alone does not authorize deletion.
Classified source tests, selected lanes and historical consolidation metadata
are not executed test or Minecraft gameplay results.


## Functional taxonomy (one authority)

The same `test-inventory.json` now owns **six navigation parents** that
partition its 17 existing `functionalAreaTaxonomy.areas`. It does not create
new test lanes, implementation packages, or separate category registries.

| Parent ID | Primary functional areas |
| --- | --- |
| `source-platform` | `map-database`, `map-content`, `gameplay-scripting`, `platform-compatibility` |
| `gameplay-systems` | `lobby-pre-match`, `player-session`, `arena-match`, `player-state-persistence`, `combat-entities`, `inventory-economy`, `world-interaction` |
| `gameplay-understanding` | `gameplay-interpretation` |
| `audit-evidence` | `audit-diagnosis`, `runtime-telemetry` |
| `repair-delivery` | `repair-preservation`, `reporting` |
| `engineering` | `engineering-tooling` |

**Boundaries:** `player-session` covers join/leave/reconnect and transient
ownership; `player-state-persistence` covers durable state and recovery.
`gameplay-interpretation` reconstructs authored meaning, `audit-diagnosis`
challenges possible defects, and `runtime-telemetry` manages observation
and proof context. `combat-entities` and `inventory-economy` remain combined
primary areas with separately named combat/entity and inventory/economy
features; split only if actual source semantics/consumers justify it.
`lobby-pre-match` remains a declared **empty primary area**; `lobby.join-pad`
is a secondary tag elsewhere, not an invented lobby acceptance result.

Feature identifiers and their primary areas belong to `featureCatalog`.
Each parent is **derived** by finding the feature's area in the parent
partition. Nothing duplicates a parent on every test. The existing runner
validates that parent IDs are unique and cover all 17 areas exactly once;
`--list-areas` groups its output by parent, and `--list-features` /
`--show-feature` display the derived parent and area. Source ownership,
physical test path, mechanic tags and execution lane remain orthogonal.

The area/feature audit corrected five misleading primary assignments after
inspecting their original assertions: frozen map-audit benchmark scoring is
`audit.reliability`; source-reference locator precision is
`audit.evidence-integrity`; graph invalidation and task dependency planning
are `tooling.graph`; work-session checkpoints are `tooling.projects`.
Those changes do not edit tests, add cases, or claim executed correctness.


## Mechanic-tag vocabulary (optional secondary navigation)

`test-inventory.json` contains the one `mechanicTagVocabulary` alongside
the existing primary area/feature taxonomy. Its 11 semantic namespaces
(`map`, `world`, `lobby`, `player`, `arena`, `combat`, `entity`,
`inventory`, `economy`, `gameplay` and `scoreboard`) describe **secondary
mechanic topics**, not 11 more functional areas or physical source owners.
Every existing tag has one namespace, readable label and precise meaning.
The same `run-tests.mjs` validates registered, distinct and actually-used
tags, requiring source-inspected test mappings and deterministic tag order.

`--list-mechanics` now groups tag identities by namespace. A
`--show-mechanic <tag>` query explains its meaning and lists source-classified
test files. Multi-feature umbrella tags such as `entity.ai-navigation`,
`economy.currency-rewards`, `combat.damage-lifecycle` and
`world.interaction-ui` are intentionally retained: their cases cover
different feature owners under one meaningful mechanic topic. A test may
have multiple secondary tags or none. Do not assign extra tags merely to
fill coverage; primary `functionalArea` / `featureId` and test `lane`
remain unchanged.

The former `map.chunk` tag was replaced by `world.chunk-readiness` for
the four suites that actually inspect source/host chunk readiness and
ticking-area lifecycle. This is a vocabulary correction, **not** a new
checker, a new test, a proved runtime result or an alias to a missing
primary test. No alternate tag aliases or compatibility registry were
created. A previously saved `--show-mechanic map.chunk` query must use
`world.chunk-readiness`.


## Read-only category-to-test navigation

The **existing** `tooling/repository/run-tests.mjs` exposes a coherent
drill-down from category to domain to feature to optional mechanic topic
and then to the exact source-test path. The inventory remains the sole
authority; these commands only read existing source metadata:

```text
--list-areas
  -> --show-category gameplay-systems
  -> --show-area arena-match
  -> --show-feature arena.start-ownership
  -> --show-mechanic arena.start
  -> --show-test engine/packages/orchestrator/test/repair/arena-start-ownership-guard-realizer.test.ts
```

`--show-category` lists its existing domains and each domain's registered
features. `--show-area` groups features rather than mixing file paths from
different owners. `--show-feature` shows secondary mechanic tags when
available and the complete list of its primary source-test files;
`--show-mechanic` shows linked files **grouped by their own primary**
domain and feature, including cross-domain relationships. Mechanics are
optional: an untagged file remains reachable directly through its feature.
`--show-test` shows that file's exact classification, source-review Git
blob, implementation owner, selection lane and mechanic relations.

**Evidence and status remain separate:** `functionalArea`, `featureId`
and `mechanicTags` answer *what source behavior a file covers*;
`owner` identifies the canonical implementation responsibility;
`lane` answers *why the runner might select it*; `review`,
`featureMappingBasis` and source blob SHA record source-inspection
provenance, not correctness. The inventory has **no current execution
receipt or PASS/FAIL authority**. Read-only navigation prints this limit
explicitly and never invokes Vitest, TypeScript or Minecraft. A lane
named `runtime` or `acceptance` is **not** an observed runtime or
acceptance result. Existing execution selection commands and CI policy
remain unchanged.


## Primary feature tie-breaker (source-to-assertion audit)

Classify a source-test file by its **asserted semantic output**, not by the
physical owner directory, the imported input's type or the presence of a
generic `inspect`/`runtime` word in its path. The implementation owner remains
the unchanged source package, and the lane remains only an execution-selection
hint. Use the existing feature catalog; do not create new primary domains for
each combined test case or mechanically infer the primary feature from a
filename.

For example, `inspection/world-rule-authority-analysis.test.ts` checks
gamerules, natural spawning versus manual spawning, and difficulty/time/weather
state: its primary feature is `world.blocks-rules` even though it invokes an
inspection implementation. `reporting/report-runtime-classification.test.ts`
checks report `impact` and `primaryFailure` projection, so it is
`report.findings` despite consuming runtime experiment evidence.

A source-file audit can confirm this primary category match and the exact
test Git blob, **not** execution success, safety, exhaustive case equivalence
or selected-map bug detection. Broad umbrella mechanic tags are optional
cross-links; do not use them to manufacture primary coverage for
`lobby-pre-match` or to split source suites without proven need.
