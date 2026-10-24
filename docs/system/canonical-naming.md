---
id: document.system.canonical-naming
class: DOCUMENT
domain: system
role: CONTRACT
authority: CANONICAL
lifecycle: ACTIVE
---

# Canonical Naming

This document defines repository-wide canonical terminology.

## Version suffix policy for canonical source files

The repository maintains **one current implementation and one canonical name per responsibility**. Git history records source revisions; source files and folders must not be copied into `-v1`, `-v2`, `-v3`, `-new`, or `-final` variants merely to iterate or preserve prior work.

### When a version suffix is valid

| Case | Naming decision | Reason |
|---|---|---|
| Internal implementation of the same responsibility | Use one unversioned responsibility name | Future changes update the canonical source in place |
| Duplicate wrapper or historical alias | Retire only after consumer and compatibility proof | Do not create new aliases while simplifying names |
| Public serialized schema/protocol | Preserve explicit version until a migration is approved | Existing data must remain readable and unambiguous |
| Minecraft/Script API version, game/map version, archived run | Preserve the exact version identity | Version identifies externally distinct behavior or evidence |
| Golden fixture for an explicitly versioned contract | Preserve version only when the fixture asserts that contract | Fixtures must reference the actual schema they verify |
| Released external API with two genuinely concurrent contracts | Keep qualified names only while both contracts are supported | Compatibility boundaries must be explicit, not cosmetic |

**Current contracts are not renamed by declaration alone.** For example, Bug Report V1 migration and Bug Report V2 persistence are genuine format boundaries, while suffixes on Knowledge source modules require a separate export/import/semantic consumer review before deciding whether they represent a contract or leftover implementation naming. The public Map Audit Output V2 name also stays until its output-schema contract and consumers are reconciled.

### Responsibility and migration rule

1. Identify the behavior, exactly one canonical owner, and current entry/output contract from source.
2. Classify a versioned path as `FORMAT_CONTRACT`, `ARTIFACT_IDENTITY`, `HISTORICAL_EVIDENCE`, or `IMPLEMENTATION_NAMING_DEBT` using actual consumers; ambiguous paths remain unresolved.
3. For confirmed naming debt, rename the **existing** implementation rather than copy it, and update all import/export sites, tests, tooling, docs, retrieval/ownership edges, and package entrypoints in one logical change.
4. Do not preserve a second internal import name solely for convenience. A compatibility shim is allowed only while a verified external contract requires it, with a concrete retirement condition.
5. Verify the affected dependency closure before deleting old paths; never mislabel a renamed implementation as a new version or promote source checks into runtime proof.

The naming goal is **one source → one meaning → one authoritative output**, not one version string across unrelated Minecraft artifacts or persisted formats.

## Repository domain vocabulary

Use these names consistently:

| Domain | Canonical meaning |
|---|---|
| `apps/` | optional CLI and report-interface source consumers; ChatGPT Chat remains the operator |
| `engine/` | product implementation and executable semantics |
| `docs/` | durable human-facing guides, architecture, reference, and specifications |
| `planning/` | development, operations, and project work intent |
| `workspace/` | working artifacts, project execution data, continuity, and canonical current report handoff |
| `experiments/` | bounded non-authoritative research and curated developer-practice reference |
| `skills/bedrock/` | read-only native developer skill/module release identities; no internal agent activation |
| `tooling/` | repository/build/developer verification tooling |
| `.agents/` | bounded agent procedures, routing, permissions, and evals |

Do not use `workspace` as a synonym for backlog/planning. Do not use `docs` as a store for current work state. Do not use `planning` as proof, gameplay truth, or execution-state authority.

### Planning vocabulary

```text
planning/development.md → improve Lazy-Developer itself
planning/operations.md  → operate/maintain across projects
planning/projects.md    → concise project-specific continuation intent
```

Avoid parallel names such as `todo`, `next-to-do`, `current-work`, `misc`, `latest`, or `final` as planning owners.

## Authorities

| Canonical term | Meaning | Canonical location |
|---|---|---|
| Selected Map Version | Exact `.mcworld` currently being audited; sole current gameplay truth | selected current root artifact |
| Gameplay Contract | Scoped expected behavior derived only from the Selected Map Version | `engine/packages/gameplay-intent/` |
| Actual Behavior | What current source/artifact/runtime does | analyzers + behavior/runtime layers |
| Confirmed Defect | Evidence-proven gameplay contradiction; not user approval | diagnostic/bug-report bridge |
| Approved Bug | Confirmed defect explicitly approved in chat for report/repair flow | `engine/packages/bug-report/src/review.ts` |
| Repair Candidate | Internal technically plausible repair direction; no mutation authority | orchestrator diagnosis/repair reasoning |
| Repair Contract | Must Change + Must Preserve constraints for one authorized repair | preservation/orchestrator repair |
| Authorized Repair | Approved Bug/design change + Repair Contract + current proof | orchestrator repair admission |
| Design System | Schema, vocabulary, templates, compiler for Game Design | `engine/design/` |
| Game Design Spec | Typed model/loader/compiler package | `engine/packages/game-design-spec/` |
| Platform Knowledge | Descriptive Minecraft Bedrock/Education facts | `engine/knowledge/` + `engine/packages/knowledge/` |
| Platform Rule | Executable/versioned capability decision | `engine/rules/` |
| Behavior Contract | Target-specific authored runtime constraints | `engine/packages/behavior-model/` + inspection target |
| Engineering Contract | Global MIVUBI implementation/validation constraints | `engine/contracts/engineering/` |
| Gameplay Intent | Reconstructed intent from authored artifact evidence | `engine/packages/gameplay-intent/` |
| Gameplay Semantic Model | Canonical gameplay meaning projection | orchestrator `gameplaySemantic` |
| Engineering Assessment | Canonical QA/engineering projection | orchestrator `engineeringAssessment` |
| Runtime Evidence | What was observed in Minecraft/runtime | runtime/telemetry/probe layers |
| Audit Obligation | Unresolved audit/model/proof work that is not yet a gameplay finding | orchestrator `auditObligations[]` |
| Blocking Proof | Evidence that prevents the exact suspected causal path | gameplay defect resolution / counter-proof search |
| Runtime Verification | Narrow final runtime check for an irreducible native-behavior question | validation plan / runtime proof |
| Physical Containment Proof | Geometry/collision proof that decides whether a player-sized path can leave an enclosure | orchestrator arena voxel proof |

## Operator workflow vocabulary

**Map Audit** has one canonical stage sequence, defined in [Map Audit Naming Contract](../analysis/map-audit-naming-contract.md) and owned programmatically by `map-audit-admission.ts`. Its user-facing result is the `Map Audit Report`, not an authorized repair. This document defines cross-workflow terms only; it does not own a second map-audit stage list.

`Selected Map Version` is the audit's current gameplay authority. `Gameplay Contract` is scoped expected behavior; `Actual Behavior` is selected-source/runtime evidence; `Confirmed Defect` is an evidence-backed causal conclusion rather than user approval. After REPORT, an explicitly requested **separate Repair workflow** may use an `Approved Bug`, `Repair Contract`, `Authorized Repair` and repair verification. Approval, map mutation, and packaging must never be implied by a map audit.

Internal terms such as Gameplay Intent, `repair-eligible`, causal proof state, semantic keys, and evidence IDs stay internal unless technical detail is requested. Do not use `Confirmed Defect` and `Approved Bug` interchangeably.

## Filesystem disambiguation

Several domains intentionally have a data/source owner and a reusable typed package. When referring to them in prose, use the qualified term rather than the bare folder name.

| Qualified term | Responsibility | Path |
|---|---|---|
| Platform Knowledge Catalog | versioned evidence-backed Minecraft facts/data | `engine/knowledge/` |
| Platform Knowledge Package | claim loading, applicability, freshness, typed knowledge contracts | `engine/packages/knowledge/` |
| Reliability Catalog/History | durable regression, update, capability, and campaign evidence | `engine/reliability/` |
| Reliability Package | reusable reliability models, invariants, fingerprints, and retest contracts | `engine/packages/reliability/` |
| Reliability Search Package | bounded search, interleavings, minimization, and detector-quality strategy | `engine/packages/reliability-search/` |
| Diagnostics Analyzer | derives findings from supported analyzer facts | `engine/analyzers/diagnostics/` |
| Diagnostics Contract Package | stable diagnostic contracts and identifiers | `engine/packages/diagnostics/` |
| Gameplay Intent Analyzer | extracts intent signals from authored source evidence | `engine/analyzers/gameplay-intent/` |
| Gameplay Intent Package | typed evidence-backed intent model and grounding rules | `engine/packages/gameplay-intent/` |
| Runtime Harness | bounded Minecraft-facing proof harness content | `engine/runtime/` |
| Runtime Lab Package | controlled experiment contracts, trials, qualification, and provenance | `engine/packages/runtime-lab/` |

These paired owners are not aliases. One owns concrete data/extraction/harness material; the package owner owns reusable typed behavior or contracts.

## Forbidden ambiguous canonical names

Do not introduce new canonical owners/files/types using:

- `project-policy`;
- generic `policy` for Behavior Contracts or Engineering Contracts;
- `game-design` as an engine-global authority directory/package;
- `gameplayWorld` as a new primary consumer model;
- `player-experience`, `entity-systems`, `arena-gameplay`, or `world-runtime` as knowledge-domain folders.

Legacy aliases may remain only when explicitly marked deprecated and resolving to one canonical owner.

## Decision rule

Ask whether a statement would remain true if the map were replaced by a completely different map.

- **No** → selected-map Gameplay Contract / Behavior Contract.
- **Yes, because Minecraft behaves that way** → Platform Knowledge / Platform Rule.
- **Yes, because MIVUBI requires implementations to be safe that way** → Engineering Contract.


## Map classification vocabulary

Map classification is map-specific Game Design metadata owned by `engine/packages/game-design-spec/`.

Use exactly these canonical fields:

```text
Map Type
Player Mode
Mechanic Tags
Classification Status
Evidence Refs
```

Canonical **Map Type** values:

```text
BUILDING
COMBAT
SURVIVAL
STRATEGY
SEARCH_PUZZLE
CHALLENGE_COURSE
SKILL_COURSE
```

Map Type identifies the map's primary gameplay architecture and has exactly one resolved value.

Canonical **Player Mode** values:

```text
SOLO
COOPERATIVE
COMPETITIVE
TEAM_COMPETITIVE
ASYMMETRIC
```

Player Mode describes the relationship between players. Do not encode it into Map Type.

Canonical **Mechanic Tags** are multi-value audit-routing signals. They are not a second definition of the root `GameDesignSpec.mechanics` objects.

```text
BUILD
MEMORY
SEARCH
PUZZLE
PARKOUR
MELEE_COMBAT
RANGED_COMBAT
TEAM_COMBAT
BASE_DEFENSE
BASE_ATTACK
CAPTURE_OBJECTIVE
ESCORT
EXTRACTION
WAVE_DEFENSE
SURVIVAL_TIMER
ENTITY_AI
RESOURCE_ECONOMY
SHOP
LOADOUT
CRAFTING
COLLECTION
RESPAWN
REVIVE
ROUND_TIMER
MULTI_ARENA
MULTI_STAGE
PROGRESSION
PERSISTENCE
RECONNECT
WORLD_RESET
```

Classification Status uses only:

```text
RESOLVED
UNRESOLVED
```

Rules:

- `RESOLVED` requires one canonical Map Type, one canonical Player Mode, and Evidence Refs;
- `UNRESOLVED` may keep Map Type or Player Mode null; do not create `UNKNOWN` as a Map Type or Player Mode;
- Map Type selects minimum audit knowledge coverage, not a defect conclusion;
- Mechanic Tags add bounded audit scenarios/capabilities and may be empty when no reusable mechanic is yet proven;
- selected-artifact evidence remains the authority for gameplay truth and defect proof;
- historical patterns may raise search pressure but never determine Map Type.

Do not introduce parallel classification fields or aliases such as:

```text
Genre
Game Genre
Map Category
Game Category
Experience Type
Map Class
```

Legacy spreadsheet values such as `PvP`, `Minigame`, `Challenge`, `Skills`, or `Find the button` must be translated into the canonical fields instead of becoming new Map Type values. For example, `PvP` belongs primarily in Player Mode plus combat Mechanic Tags, while `Find the button` belongs in search/puzzle Mechanic Tags.

## Audit role and spatial vocabulary

Canonical role labels:

```text
Player
Builder
Roommaster / Operator
Developer / Maintenance
```

Canonical spatial-bound labels:

```text
Loading Bounds
Simulation Bounds
Gameplay Bounds
Physical Collision Bounds
Session Ownership Bounds
```

These names are deliberately non-interchangeable. Source-native identifiers such as `admin` remain valid in evidence/code references, but human-facing audit language maps them to the appropriate canonical role.

Detailed audit status, role, proof, and bound naming is owned by:

`docs/analysis/map-audit-naming-contract.md`

## Knowledge architecture vocabulary

These terms have one repository-wide meaning. Do not introduce aliases for the same responsibility.

| Term | Canonical meaning |
|---|---|
| Catalog | durable structured collection of resources or facts |
| Registry | executable membership/lookup/admission set for a bounded code contract |
| Index | derived lookup acceleration built from canonical owners; never authority |
| Graph | typed relationships between registered resources |
| Router | deterministic selection of the first canonical owner/domain |
| Retrieval | bounded selection and ranking of relevant registered resources |
| Context | minimum evidence/content package supplied to reasoning or execution |
| Owner | single canonical authority for one responsibility |
| History | chronological execution evidence; never current authority |
| Corpus | reusable/frozen evaluation material |
| Planning | current/future work intent |
| Workspace | current project execution data and working artifacts |

Qualified forms preserve the same meaning. For example, `Reliability Catalog`, `Platform Knowledge Catalog`, and `Resource Catalog` are all catalogs; the qualifier identifies the domain, not a different concept.

Forbidden architectural aliases for these concepts include:

```text
Directory / Knowledge List               → Catalog
Registry used as knowledge inventory      → Catalog
Persisted index used as source of truth   → canonical Owner; Index stays DERIVED
Knowledge Graph Manager / Link Graph      → Graph
Dispatcher / Resolver                     → Router
RAG Manager / Semantic Search Manager     → Retrieval
Memory Bundle                             → Context
Master / Golden / Primary Owner           → Owner
Archive Log / Execution Log Store         → History
Benchmark Dataset / Evaluation Dataset    → Corpus
Todo / Backlog Store / Current Work       → Planning
Active State Store / Project Memory       → Workspace
```

`Context` is the only architectural name for bounded reasoning input. Concrete source types should use `Context` terminology; legacy `*ContextPack` identifiers are migration debt, not a second concept.

Catalog and Registry are deliberately different:

```text
Catalog
→ describes what resources/facts are available
→ derived/rebuildable when used for repository knowledge access
→ does not own operational mutation state

Registry
→ owns a typed set of registered entries
→ may enforce registration/update/revision rules
→ may be persisted or runtime state when its domain requires it
```

Examples of valid Registry usage include capability registration, project records, invariant registration, and contract registration. Do not rename those to Catalog unless their responsibility is actually reduced to descriptive discovery.

The forbidden terms may still appear when they describe an external API/library concept or a source-native identifier, but they must not become new canonical repository responsibilities.

### Catalog, Registry, and Index

These terms are deliberately different:

```text
Catalog
→ durable resource/fact inventory

Registry
→ executable membership, lookup, uniqueness, or admission contract

Index
→ rebuildable lookup acceleration
```

Rules:

- do not rename a runtime Registry to Catalog merely because both contain entries;
- do not call a knowledge/resource inventory Registry;
- Index is always `DERIVED` and may be deleted/rebuilt;
- Catalog may reference canonical owners but does not replace them;
- Registry may enforce runtime/code membership semantics but does not become repository knowledge authority.

Examples:

```text
Resource Catalog        → Catalog
Platform Knowledge Catalog → Catalog
capability-registry.ts  → Registry
contract-registry.json  → Registry
Document Section Index  → Index
```

### Document metadata

Every Markdown document under `docs/` carries a minimal metadata frontmatter:

```yaml
---
id: document.analysis.player-lifecycle
class: DOCUMENT
domain: analysis
role: DOMAIN
authority: CANONICAL
lifecycle: ACTIVE
---
```

This metadata is the document's Catalog identity contract.

Rules:

- `id` is stable identity and must not be regenerated merely because the file moves;
- `path` is discovered from the repository and is not duplicated in frontmatter;
- `locator` identifies one stable item inside a multi-item owner file (for example a knowledge fact ID); it is Catalog data, not document frontmatter;
- only the six canonical fields are allowed;
- no `title`, `tags`, `aliases`, `topics`, `misc`, or arbitrary extension fields;
- relationships belong to Graph, not document metadata;
- examples use `REFERENCE` authority; normal canonical docs use `CANONICAL`;
- domain README files use `ROUTER` role.

### Resource classes

Every registered knowledge-architecture resource uses exactly one class:

```text
DOCUMENT
KNOWLEDGE
SOURCE
RELIABILITY
SCHEMA
EXAMPLE
```

Class meanings:

- `DOCUMENT` — human-facing durable documentation.
- `KNOWLEDGE` — machine-readable facts or requirements, including platform facts and engineering contract facts; authority determines whether the item is supporting reference or canonical requirement.
- `SOURCE` — implementation owner/module.
- `RELIABILITY` — reliability evidence/catalog/corpus/history resource.
- `SCHEMA` — structural schema.
- `EXAMPLE` — non-authoritative sample payload/artifact used to illustrate a contract; always supporting reference, never current truth.

Do not add synonymous classes such as NOTE, PAGE, ARTICLE, RESOURCE, CONTENT, DOC_NODE, SAMPLE, or WORKFLOW. `EXAMPLE` is the only class name for non-authoritative sample payloads. Workflow is a document role, not a resource class.

### Document roles

Every registered document uses exactly one role:

```text
ROUTER
WORKFLOW
CONTRACT
DOMAIN
ARCHITECTURE
GUIDE
```

These roles are mutually exclusive at registration time. `DOMAIN` means descriptive domain semantics/reference material; `REFERENCE` is reserved exclusively for the Authority vocabulary. A document can discuss another role without acquiring it.

Do not introduce PROCEDURE, PLAYBOOK, HANDBOOK, MANUAL, SPEC, or PROTOCOL as parallel role names. Existing filenames may retain historical wording until a deliberate rename is justified; the registered role remains canonical.

### Authority classes

Every registered resource uses exactly one authority class:

```text
CANONICAL
REFERENCE
HISTORICAL
DERIVED
```

Meaning:

- `CANONICAL` — owns the current rule/state/contract for its concern.
- `REFERENCE` — evidence-backed supporting information consumed by canonical owners.
- `HISTORICAL` — past execution or incident evidence; search pressure only.
- `DERIVED` — rebuildable projection/index/cache generated from other owners.

Do not introduce PRIMARY, MASTER, GOLDEN, OFFICIAL, or SOURCE_OF_TRUTH as alternative authority-class values.

### Relation types

The knowledge graph uses only these relation types unless a genuinely new invariant cannot be represented:

```text
ROUTES_TO
OWNS
IMPLEMENTS
USES
DEPENDS_ON
VALIDATES
RELATES_TO
DERIVED_FROM
```

Relation names are directional and semantic. Do not create synonyms such as CONSUMES for USES, BACKED_BY for DERIVED_FROM, or REFERENCES for RELATES_TO.

### Resource identity

Registered IDs are semantic and readable:

```text
<class>.<domain>.<name>
```

Examples:

```text
document.analysis.player-lifecycle
knowledge.world.chunks
source.orchestrator.map-audit
reliability.regression.multi-arena-concurrency
schema.bug-report.v2
example.examples.map-audit-output-v2
```

Rules:

- lowercase;
- dot-separated semantic segments;
- stable across file relocation;
- no sequential numeric IDs;
- no `new`, `latest`, `final`, `v2` suffix unless the version is part of the actual schema/product identity;
- one ID resolves to one resource;
- one resource has one ID.

Path is location. ID is identity. They are not interchangeable.

### Update naming rule

Ordinary updates do not change canonical identity.

Forbidden update naming patterns for new owners/resources include:

```text
-new
-latest
-final
-copy
-backup
-v2
```

A version suffix is allowed only when version is part of the real product/schema identity (for example Bug Report V2), not as a substitute for updating an existing owner.

## Third-party ZIP and derived-view naming

The `experiments/developer-practice-signals.json` snapshot has one
stable current identity. Its referenced module files, probe fixtures and
native report paths are **external source identities**: an indexed
reference is not a locally installed module or an executed test. A new
archive is a new provenance *revision*, not a reason to mint a competing
`-v2`, `-latest`, `-copy` or `final` reference catalog. Preserve
each origin release/lock and file SHA independently.

The public names `MapAuditOutputV2`,
`formatSelectedMapAuditBrief` and
`projectSelectedMapAuditModelHandoff` remain stable contracts.
Named re-exports from `map-audit-output-v2.ts` and
`map-audit-pipeline.ts` are compatibility entrypoints only; the
human brief and read-only model handoff have exactly one implementation
under `reporting/`. Read-only presentation modules do not own
admission, persistence, source evidence or Expected Behavior.

## Data lifecycle vocabulary

Resource lifecycle uses one state vocabulary:

```text
ACTIVE
RETIRED
```

Resource management follows one process:

```text
Discover
→ Classify
→ Register
→ Relate
→ Validate
→ Consume
→ Update
→ Retire
```

Definitions:

- Discover — detect a new resource/fact/capability.
- Classify — assign class, domain, role when applicable, and authority.
- Register — assign one stable ID and owner/path.
- Relate — add only typed graph relationships required for retrieval/impact.
- Validate — verify identity, ownership, relationships, applicability, and consumers.
- Consume — make the resource reachable from Router/Retrieval or executable consumers.
- Update — modify the existing owner/resource rather than creating an alias/copy.
- Retire — remove it from active routing/consumption; Git History preserves superseded repository content when no current artifact is needed.

Do not create lifecycle states such as OLD, LEGACY, DEPRECATED, SUPERSEDED, ARCHIVED, or INACTIVE as parallel registry states. Domain-specific version/deprecation semantics may exist inside the owned data, but resource lifecycle remains ACTIVE or RETIRED.